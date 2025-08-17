[dotenv@17.2.1] injecting env (15) from .env -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com
// Sources flattened with hardhat v3.0.0 https://hardhat.org

// SPDX-License-Identifier: MIT

// File contracts/game/CrapsGame.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.28;







/**
 * @title CrapsGame
 * @notice Main contract managing the craps game state and dice rolls
 * @dev Integrates with Chainlink VRF for provably fair randomness
 */
contract CrapsGame is 
    ICrapsGame, 
    VRFConsumerBaseV2, 
    AccessControl, 
    ReentrancyGuard, 
    Pausable 
{
    using CrapsBetTypes for uint8;
    
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    
    // Chainlink VRF configuration
    VRFCoordinatorV2Interface private immutable COORDINATOR;
    uint64 private immutable subscriptionId;
    bytes32 private immutable keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 200000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 2; // Two dice
    
    // Game state
    ShooterState public currentShooter;
    Phase public currentPhase;
    DiceRoll public lastRoll;
    uint256 public currentSeriesId;
    uint256 public totalRollsInSeries;
    
    // Request tracking
    mapping(uint256 => bool) public pendingRequests;
    mapping(uint256 => uint256) public requestToSeries;
    
    // Series history
    mapping(uint256 => ShooterState) public seriesHistory;
    mapping(uint256 => uint256) public seriesTotalRolls;
    
    // Configuration
    uint256 public minBetAmount = 1 * 10**18; // 1 BOT tokens minimum
    uint256 public maxBetAmount = 10000 * 10**18; // 10,000 BOT tokens maximum
    bool public autoRollEnabled = true;
    uint256 public rollCooldown = 10 seconds;
    uint256 public lastRollTimestamp;
    
    // Connected contracts
    address public betsContract;
    address public settlementContract;
    address public vaultContract;
    
    // Modifiers
    modifier onlyBetsContract() {
        require(msg.sender == betsContract, "Only bets contract");
        _;
    }
    
    modifier onlySettlementContract() {
        require(msg.sender == settlementContract, "Only settlement contract");
        _;
    }
    
    modifier gameActive() {
        require(currentPhase != Phase.IDLE, "Game not active");
        _;
    }
    
    modifier validPhase(Phase requiredPhase) {
        require(currentPhase == requiredPhase, "Invalid phase");
        _;
    }
    
    /**
     * @notice Constructor
     * @param _vrfCoordinator Chainlink VRF Coordinator address
     * @param _subscriptionId Chainlink VRF subscription ID
     * @param _keyHash Chainlink VRF key hash
     */
    constructor(
        address _vrfCoordinator,
        uint64 _subscriptionId,
        bytes32 _keyHash
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        currentPhase = Phase.IDLE;
    }
    
    // ============ Configuration Functions ============
    
    /**
     * @notice Set connected contracts
     * @param _betsContract Address of the bets contract
     * @param _settlementContract Address of the settlement contract
     * @param _vaultContract Address of the vault contract
     */
    function setContracts(
        address _betsContract,
        address _settlementContract,
        address _vaultContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_betsContract != address(0), "Invalid bets contract");
        require(_settlementContract != address(0), "Invalid settlement contract");
        require(_vaultContract != address(0), "Invalid vault contract");
        
        betsContract = _betsContract;
        settlementContract = _settlementContract;
        vaultContract = _vaultContract;
        
        _grantRole(SETTLEMENT_ROLE, _settlementContract);
        _grantRole(VAULT_ROLE, _vaultContract);
    }
    
    /**
     * @notice Update game configuration
     * @param _minBet Minimum bet amount
     * @param _maxBet Maximum bet amount
     * @param _autoRoll Enable automatic rolling
     * @param _cooldown Cooldown between rolls
     */
    function updateConfig(
        uint256 _minBet,
        uint256 _maxBet,
        bool _autoRoll,
        uint256 _cooldown
    ) external onlyRole(OPERATOR_ROLE) {
        require(_minBet > 0 && _minBet <= _maxBet, "Invalid bet limits");
        require(_cooldown >= 5 seconds, "Cooldown too short");
        
        minBetAmount = _minBet;
        maxBetAmount = _maxBet;
        autoRollEnabled = _autoRoll;
        rollCooldown = _cooldown;
    }
    
    // ============ Game Management Functions ============
    
    /**
     * @notice Start a new game series
     * @param shooter Address of the shooter (can be bot or player)
     */
    function startNewSeries(address shooter) external override onlyRole(OPERATOR_ROLE) {
        require(currentPhase == Phase.IDLE, "Series already active");
        require(shooter != address(0), "Invalid shooter");
        
        currentSeriesId++;
        totalRollsInSeries = 0;
        
        currentShooter = ShooterState({
            shooter: shooter,
            point: 0,
            phase: Phase.COME_OUT,
            pointsMadeCount: 0,
            consecutiveWins: 0,
            fireMask: 0,
            doublesMask: 0,
            smallTallMask: 0,
            rollCount: [uint8(0), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            seriesStartBlock: block.number
        });
        
        currentPhase = Phase.COME_OUT;
        
        emit GameStarted(shooter, currentSeriesId);
        emit PhaseChanged(Phase.IDLE, Phase.COME_OUT);
    }
    
    /**
     * @notice End the current series
     */
    function endCurrentSeries() external override onlyRole(OPERATOR_ROLE) {
        require(currentPhase != Phase.IDLE, "No active series");
        
        // Store series history
        seriesHistory[currentSeriesId] = currentShooter;
        seriesTotalRolls[currentSeriesId] = totalRollsInSeries;
        
        emit SevenOut(currentSeriesId, currentShooter.shooter);
        
        // Reset state
        currentPhase = Phase.IDLE;
        delete currentShooter;
        
        emit PhaseChanged(currentPhase, Phase.IDLE);
    }
    
    /**
     * @notice Request a dice roll using Chainlink VRF
     * @return requestId The VRF request ID
     */
    function requestDiceRoll() external override gameActive nonReentrant returns (uint256) {
        require(
            hasRole(OPERATOR_ROLE, msg.sender) || 
            msg.sender == currentShooter.shooter ||
            autoRollEnabled,
            "Not authorized to roll"
        );
        
        require(
            block.timestamp >= lastRollTimestamp + rollCooldown,
            "Cooldown not met"
        );
        
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            NUM_WORDS
        );
        
        pendingRequests[requestId] = true;
        requestToSeries[requestId] = currentSeriesId;
        lastRollTimestamp = block.timestamp;
        
        emit RandomnessRequested(requestId);
        
        return requestId;
    }
    
    /**
     * @notice Chainlink VRF callback
     * @param requestId The request ID
     * @param randomWords Array of random words
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        require(pendingRequests[requestId], "Invalid request");
        require(requestToSeries[requestId] == currentSeriesId, "Series mismatch");
        
        delete pendingRequests[requestId];
        
        // Generate dice values (1-6)
        uint8 die1 = uint8((randomWords[0] % 6) + 1);
        uint8 die2 = uint8((randomWords[1] % 6) + 1);
        uint8 total = die1 + die2;
        
        // Store roll
        lastRoll = DiceRoll({
            die1: die1,
            die2: die2,
            total: total,
            timestamp: block.timestamp,
            requestId: requestId
        });
        
        totalRollsInSeries++;
        
        // Update roll count for repeater bets
        if (total >= 2 && total <= 12) {
            currentShooter.rollCount[total]++;
        }
        
        // Update doubles mask for Different Doubles bet
        if (die1 == die2) {
            uint8 doubleBit = uint8(1 << (die1 - 1));
            currentShooter.doublesMask |= doubleBit;
        }
        
        // Update Small/Tall/All mask
        if (total >= 2 && total <= 6) {
            currentShooter.smallTallMask |= uint16(1 << (total - 2));
        } else if (total >= 8 && total <= 12) {
            currentShooter.smallTallMask |= uint16(1 << (total + 3));
        }
        
        emit DiceRolled(currentSeriesId, die1, die2, total);
        emit RandomnessFulfilled(requestId, randomWords[0]);
        
        // Process game logic
        _processRoll(die1, die2, total);
    }
    
    /**
     * @notice Process the dice roll and update game state
     * @param die1 First die value
     * @param die2 Second die value
     * @param total Sum of dice
     */
    function _processRoll(uint8 die1, uint8 die2, uint8 total) private {
        if (currentPhase == Phase.COME_OUT) {
            _processComeOutRoll(total);
        } else if (currentPhase == Phase.POINT) {
            _processPointRoll(total);
        }
        
        // Notify settlement contract
        if (settlementContract != address(0)) {
            ICrapsSettlement(settlementContract).settleRoll(die1, die2);
        }
    }
    
    /**
     * @notice Process come-out roll
     * @param total Dice total
     */
    function _processComeOutRoll(uint8 total) private {
        if (total == 7 || total == 11) {
            // Natural - Pass wins
            currentShooter.consecutiveWins++;
            // Stay in come-out phase
        } else if (total == 2 || total == 3 || total == 12) {
            // Craps - Pass loses
            currentShooter.consecutiveWins = 0;
            // Stay in come-out phase
        } else {
            // Point established
            currentShooter.point = total;
            currentPhase = Phase.POINT;
            
            emit PointEstablished(currentSeriesId, total);
            emit PhaseChanged(Phase.COME_OUT, Phase.POINT);
        }
    }
    
    /**
     * @notice Process point phase roll
     * @param total Dice total
     */
    function _processPointRoll(uint8 total) private {
        if (total == currentShooter.point) {
            // Point made
            currentShooter.pointsMadeCount++;
            currentShooter.consecutiveWins++;
            
            // Update Fire bet mask
            if (currentShooter.point >= 4 && currentShooter.point <= 10) {
                uint8 pointBit = uint8(1 << (currentShooter.point - 4));
                currentShooter.fireMask |= pointBit;
            }
            
            emit PointMade(currentSeriesId, currentShooter.point);
            
            // Reset to come-out
            currentShooter.point = 0;
            currentPhase = Phase.COME_OUT;
            
            emit PhaseChanged(Phase.POINT, Phase.COME_OUT);
            
        } else if (total == 7) {
            // Seven-out
            emit SevenOut(currentSeriesId, currentShooter.shooter);
            
            // Notify settlement for seven-out resolution
            if (settlementContract != address(0)) {
                ICrapsSettlement(settlementContract).settleSevenOut();
            }
            
            // End series
            this.endCurrentSeries();
        }
        // Other numbers continue the point phase
    }
    
    // ============ View Functions ============
    
    function getCurrentShooter() external view override returns (ShooterState memory) {
        return currentShooter;
    }
    
    function getCurrentPhase() external view override returns (Phase) {
        return currentPhase;
    }
    
    function getLastRoll() external view override returns (DiceRoll memory) {
        return lastRoll;
    }
    
    function getSeriesId() external view override returns (uint256) {
        return currentSeriesId;
    }
    
    function isGameActive() external view override returns (bool) {
        return currentPhase != Phase.IDLE;
    }
    
    /**
     * @notice Check if a bet type can be placed in current phase
     * @param betType The bet type to check
     * @return bool Whether the bet can be placed
     */
    function canPlaceBet(uint8 betType) external view override returns (bool) {
        if (currentPhase == Phase.IDLE) return false;
        
        // Pass/Don't Pass only on come-out
        if (betType == CrapsBetTypes.BET_PASS || betType == CrapsBetTypes.BET_DONT_PASS) {
            return currentPhase == Phase.COME_OUT;
        }
        
        // Come/Don't Come only during point phase
        if (betType == CrapsBetTypes.BET_COME || betType == CrapsBetTypes.BET_DONT_COME) {
            return currentPhase == Phase.POINT;
        }
        
        // Odds bets only when point is established
        if (betType >= CrapsBetTypes.BET_ODDS_PASS && betType <= CrapsBetTypes.BET_ODDS_DONT_COME) {
            return currentShooter.point > 0;
        }
        
        // Most other bets can be placed anytime during active game
        return true;
    }
    
    /**
     * @notice Validate if bet type is valid
     * @param betType The bet type to validate
     * @return bool Whether the bet type is valid
     */
    function isBetTypeValid(uint8 betType) external pure override returns (bool) {
        return betType <= 63; // 0-63 are valid bet types
    }
    
    // ============ Emergency Functions ============
    
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }
}


// File npm/@chainlink/contracts@1.4.0/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol

// Original license: SPDX_License_Identifier: MIT

// solhint-disable-next-line interface-starts-with-i
interface VRFCoordinatorV2Interface {
  /**
   * @notice Get configuration relevant for making requests
   * @return minimumRequestConfirmations global min for request confirmations
   * @return maxGasLimit global max for request gas limit
   * @return s_provingKeyHashes list of registered key hashes
   */
  function getRequestConfig() external view returns (uint16, uint32, bytes32[] memory);

  /**
   * @notice Request a set of random words.
   * @param keyHash - Corresponds to a particular oracle job which uses
   * that key for generating the VRF proof. Different keyHash's have different gas price
   * ceilings, so you can select a specific one to bound your maximum per request cost.
   * @param subId  - The ID of the VRF subscription. Must be funded
   * with the minimum subscription balance required for the selected keyHash.
   * @param minimumRequestConfirmations - How many blocks you'd like the
   * oracle to wait before responding to the request. See SECURITY CONSIDERATIONS
   * for why you may want to request more. The acceptable range is
   * [minimumRequestBlockConfirmations, 200].
   * @param callbackGasLimit - How much gas you'd like to receive in your
   * fulfillRandomWords callback. Note that gasleft() inside fulfillRandomWords
   * may be slightly less than this amount because of gas used calling the function
   * (argument decoding etc.), so you may need to request slightly more than you expect
   * to have inside fulfillRandomWords. The acceptable range is
   * [0, maxGasLimit]
   * @param numWords - The number of uint256 random values you'd like to receive
   * in your fulfillRandomWords callback. Note these numbers are expanded in a
   * secure way by the VRFCoordinator from a single random value supplied by the oracle.
   * @return requestId - A unique identifier of the request. Can be used to match
   * a request to a response in fulfillRandomWords.
   */
  function requestRandomWords(
    bytes32 keyHash,
    uint64 subId,
    uint16 minimumRequestConfirmations,
    uint32 callbackGasLimit,
    uint32 numWords
  ) external returns (uint256 requestId);

  /**
   * @notice Create a VRF subscription.
   * @return subId - A unique subscription id.
   * @dev You can manage the consumer set dynamically with addConsumer/removeConsumer.
   * @dev Note to fund the subscription, use transferAndCall. For example
   * @dev  LINKTOKEN.transferAndCall(
   * @dev    address(COORDINATOR),
   * @dev    amount,
   * @dev    abi.encode(subId));
   */
  function createSubscription() external returns (uint64 subId);

  /**
   * @notice Get a VRF subscription.
   * @param subId - ID of the subscription
   * @return balance - LINK balance of the subscription in juels.
   * @return reqCount - number of requests for this subscription, determines fee tier.
   * @return owner - owner of the subscription.
   * @return consumers - list of consumer address which are able to use this subscription.
   */
  function getSubscription(
    uint64 subId
  ) external view returns (uint96 balance, uint64 reqCount, address owner, address[] memory consumers);

  /**
   * @notice Request subscription owner transfer.
   * @param subId - ID of the subscription
   * @param newOwner - proposed new owner of the subscription
   */
  function requestSubscriptionOwnerTransfer(uint64 subId, address newOwner) external;

  /**
   * @notice Request subscription owner transfer.
   * @param subId - ID of the subscription
   * @dev will revert if original owner of subId has
   * not requested that msg.sender become the new owner.
   */
  function acceptSubscriptionOwnerTransfer(uint64 subId) external;

  /**
   * @notice Add a consumer to a VRF subscription.
   * @param subId - ID of the subscription
   * @param consumer - New consumer which can use the subscription
   */
  function addConsumer(uint64 subId, address consumer) external;

  /**
   * @notice Remove a consumer from a VRF subscription.
   * @param subId - ID of the subscription
   * @param consumer - Consumer to remove from the subscription
   */
  function removeConsumer(uint64 subId, address consumer) external;

  /**
   * @notice Cancel a subscription
   * @param subId - ID of the subscription
   * @param to - Where to send the remaining LINK to
   */
  function cancelSubscription(uint64 subId, address to) external;

  /*
   * @notice Check to see if there exists a request commitment consumers
   * for all consumers and keyhashes for a given sub.
   * @param subId - ID of the subscription
   * @return true if there exists at least one unfulfilled request for the subscription, false
   * otherwise.
   */
  function pendingRequestExists(uint64 subId) external view returns (bool);
}


// File npm/@chainlink/contracts@1.4.0/src/v0.8/vrf/VRFConsumerBaseV2.sol

// Original license: SPDX_License_Identifier: MIT

/** ****************************************************************************
 * @notice Interface for contracts using VRF randomness
 * *****************************************************************************
 * @dev PURPOSE
 *
 * @dev Reggie the Random Oracle (not his real job) wants to provide randomness
 * @dev to Vera the verifier in such a way that Vera can be sure he's not
 * @dev making his output up to suit himself. Reggie provides Vera a public key
 * @dev to which he knows the secret key. Each time Vera provides a seed to
 * @dev Reggie, he gives back a value which is computed completely
 * @dev deterministically from the seed and the secret key.
 *
 * @dev Reggie provides a proof by which Vera can verify that the output was
 * @dev correctly computed once Reggie tells it to her, but without that proof,
 * @dev the output is indistinguishable to her from a uniform random sample
 * @dev from the output space.
 *
 * @dev The purpose of this contract is to make it easy for unrelated contracts
 * @dev to talk to Vera the verifier about the work Reggie is doing, to provide
 * @dev simple access to a verifiable source of randomness. It ensures 2 things:
 * @dev 1. The fulfillment came from the VRFCoordinator
 * @dev 2. The consumer contract implements fulfillRandomWords.
 * *****************************************************************************
 * @dev USAGE
 *
 * @dev Calling contracts must inherit from VRFConsumerBase, and can
 * @dev initialize VRFConsumerBase's attributes in their constructor as
 * @dev shown:
 *
 * @dev   contract VRFConsumer {
 * @dev     constructor(<other arguments>, address _vrfCoordinator, address _link)
 * @dev       VRFConsumerBase(_vrfCoordinator) public {
 * @dev         <initialization with other arguments goes here>
 * @dev       }
 * @dev   }
 *
 * @dev The oracle will have given you an ID for the VRF keypair they have
 * @dev committed to (let's call it keyHash). Create subscription, fund it
 * @dev and your consumer contract as a consumer of it (see VRFCoordinatorInterface
 * @dev subscription management functions).
 * @dev Call requestRandomWords(keyHash, subId, minimumRequestConfirmations,
 * @dev callbackGasLimit, numWords),
 * @dev see (VRFCoordinatorInterface for a description of the arguments).
 *
 * @dev Once the VRFCoordinator has received and validated the oracle's response
 * @dev to your request, it will call your contract's fulfillRandomWords method.
 *
 * @dev The randomness argument to fulfillRandomWords is a set of random words
 * @dev generated from your requestId and the blockHash of the request.
 *
 * @dev If your contract could have concurrent requests open, you can use the
 * @dev requestId returned from requestRandomWords to track which response is associated
 * @dev with which randomness request.
 * @dev See "SECURITY CONSIDERATIONS" for principles to keep in mind,
 * @dev if your contract could have multiple requests in flight simultaneously.
 *
 * @dev Colliding `requestId`s are cryptographically impossible as long as seeds
 * @dev differ.
 *
 * *****************************************************************************
 * @dev SECURITY CONSIDERATIONS
 *
 * @dev A method with the ability to call your fulfillRandomness method directly
 * @dev could spoof a VRF response with any random value, so it's critical that
 * @dev it cannot be directly called by anything other than this base contract
 * @dev (specifically, by the VRFConsumerBase.rawFulfillRandomness method).
 *
 * @dev For your users to trust that your contract's random behavior is free
 * @dev from malicious interference, it's best if you can write it so that all
 * @dev behaviors implied by a VRF response are executed *during* your
 * @dev fulfillRandomness method. If your contract must store the response (or
 * @dev anything derived from it) and use it later, you must ensure that any
 * @dev user-significant behavior which depends on that stored value cannot be
 * @dev manipulated by a subsequent VRF request.
 *
 * @dev Similarly, both miners and the VRF oracle itself have some influence
 * @dev over the order in which VRF responses appear on the blockchain, so if
 * @dev your contract could have multiple VRF requests in flight simultaneously,
 * @dev you must ensure that the order in which the VRF responses arrive cannot
 * @dev be used to manipulate your contract's user-significant behavior.
 *
 * @dev Since the block hash of the block which contains the requestRandomness
 * @dev call is mixed into the input to the VRF *last*, a sufficiently powerful
 * @dev miner could, in principle, fork the blockchain to evict the block
 * @dev containing the request, forcing the request to be included in a
 * @dev different block with a different hash, and therefore a different input
 * @dev to the VRF. However, such an attack would incur a substantial economic
 * @dev cost. This cost scales with the number of blocks the VRF oracle waits
 * @dev until it calls responds to a request. It is for this reason that
 * @dev that you can signal to an oracle you'd like them to wait longer before
 * @dev responding to the request (however this is not enforced in the contract
 * @dev and so remains effective only in the case of unmodified oracle software).
 */
abstract contract VRFConsumerBaseV2 {
  error OnlyCoordinatorCanFulfill(address have, address want);
  // solhint-disable-next-line chainlink-solidity/prefix-immutable-variables-with-i
  address private immutable vrfCoordinator;

  /**
   * @param _vrfCoordinator address of VRFCoordinator contract
   */
  constructor(address _vrfCoordinator) {
    vrfCoordinator = _vrfCoordinator;
  }

  /**
   * @notice fulfillRandomness handles the VRF response. Your contract must
   * @notice implement it. See "SECURITY CONSIDERATIONS" above for important
   * @notice principles to keep in mind when implementing your fulfillRandomness
   * @notice method.
   *
   * @dev VRFConsumerBaseV2 expects its subcontracts to have a method with this
   * @dev signature, and will call it once it has verified the proof
   * @dev associated with the randomness. (It is triggered via a call to
   * @dev rawFulfillRandomness, below.)
   *
   * @param requestId The Id initially returned by requestRandomness
   * @param randomWords the VRF output expanded to the requested number of words
   */
  // solhint-disable-next-line chainlink-solidity/prefix-internal-functions-with-underscore
  function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal virtual;

  // rawFulfillRandomness is called by VRFCoordinator when it receives a valid VRF
  // proof. rawFulfillRandomness then calls fulfillRandomness, after validating
  // the origin of the call
  function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
    if (msg.sender != vrfCoordinator) {
      revert OnlyCoordinatorCanFulfill(msg.sender, vrfCoordinator);
    }
    fulfillRandomWords(requestId, randomWords);
  }
}


// File npm/@openzeppelin/contracts@5.4.0/access/AccessControl.sol

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (access/AccessControl.sol)




/**
 * @dev Contract module that allows children to implement role-based access
 * control mechanisms. This is a lightweight version that doesn't allow enumerating role
 * members except through off-chain means by accessing the contract event logs. Some
 * applications may benefit from on-chain enumerability, for those cases see
 * {AccessControlEnumerable}.
 *
 * Roles are referred to by their `bytes32` identifier. These should be exposed
 * in the external API and be unique. The best way to achieve this is by
 * using `public constant` hash digests:
 *
 * ```solidity
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * Roles can be used to represent a set of permissions. To restrict access to a
 * function call, use {hasRole}:
 *
 * ```solidity
 * function foo() public {
 *     require(hasRole(MY_ROLE, msg.sender));
 *     ...
 * }
 * ```
 *
 * Roles can be granted and revoked dynamically via the {grantRole} and
 * {revokeRole} functions. Each role has an associated admin role, and only
 * accounts that have a role's admin role can call {grantRole} and {revokeRole}.
 *
 * By default, the admin role for all roles is `DEFAULT_ADMIN_ROLE`, which means
 * that only accounts with this role will be able to grant or revoke other
 * roles. More complex role relationships can be created by using
 * {_setRoleAdmin}.
 *
 * WARNING: The `DEFAULT_ADMIN_ROLE` is also its own admin: it has permission to
 * grant and revoke this role. Extra precautions should be taken to secure
 * accounts that have been granted it. We recommend using {AccessControlDefaultAdminRules}
 * to enforce additional security measures for this role.
 */
abstract contract AccessControl is Context, IAccessControl, ERC165 {
    struct RoleData {
        mapping(address account => bool) hasRole;
        bytes32 adminRole;
    }

    mapping(bytes32 role => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /**
     * @dev Modifier that checks that an account has a specific role. Reverts
     * with an {AccessControlUnauthorizedAccount} error including the required role.
     */
    modifier onlyRole(bytes32 role) {
        _checkRole(role);
        _;
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) public view virtual returns (bool) {
        return _roles[role].hasRole[account];
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `_msgSender()`
     * is missing `role`. Overriding this function changes the behavior of the {onlyRole} modifier.
     */
    function _checkRole(bytes32 role) internal view virtual {
        _checkRole(role, _msgSender());
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `account`
     * is missing `role`.
     */
    function _checkRole(bytes32 role, address account) internal view virtual {
        if (!hasRole(role, account)) {
            revert AccessControlUnauthorizedAccount(account, role);
        }
    }

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) public view virtual returns (bytes32) {
        return _roles[role].adminRole;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleGranted} event.
     */
    function grantRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleRevoked} event.
     */
    function revokeRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been revoked `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     *
     * May emit a {RoleRevoked} event.
     */
    function renounceRole(bytes32 role, address callerConfirmation) public virtual {
        if (callerConfirmation != _msgSender()) {
            revert AccessControlBadConfirmation();
        }

        _revokeRole(role, callerConfirmation);
    }

    /**
     * @dev Sets `adminRole` as ``role``'s admin role.
     *
     * Emits a {RoleAdminChanged} event.
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    /**
     * @dev Attempts to grant `role` to `account` and returns a boolean indicating if `role` was granted.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleGranted} event.
     */
    function _grantRole(bytes32 role, address account) internal virtual returns (bool) {
        if (!hasRole(role, account)) {
            _roles[role].hasRole[account] = true;
            emit RoleGranted(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Attempts to revoke `role` from `account` and returns a boolean indicating if `role` was revoked.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleRevoked} event.
     */
    function _revokeRole(bytes32 role, address account) internal virtual returns (bool) {
        if (hasRole(role, account)) {
            _roles[role].hasRole[account] = false;
            emit RoleRevoked(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }
}


// File npm/@openzeppelin/contracts@5.4.0/access/IAccessControl.sol

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (access/IAccessControl.sol)


/**
 * @dev External interface of AccessControl declared to support ERC-165 detection.
 */
interface IAccessControl {
    /**
     * @dev The `account` is missing a role.
     */
    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);

    /**
     * @dev The caller of a function is not the expected one.
     *
     * NOTE: Don't confuse with {AccessControlUnauthorizedAccount}.
     */
    error AccessControlBadConfirmation();

    /**
     * @dev Emitted when `newAdminRole` is set as ``role``'s admin role, replacing `previousAdminRole`
     *
     * `DEFAULT_ADMIN_ROLE` is the starting admin for all roles, despite
     * {RoleAdminChanged} not being emitted to signal this.
     */
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    /**
     * @dev Emitted when `account` is granted `role`.
     *
     * `sender` is the account that originated the contract call. This account bears the admin role (for the granted role).
     * Expected in cases where the role was granted using the internal {AccessControl-_grantRole}.
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Emitted when `account` is revoked `role`.
     *
     * `sender` is the account that originated the contract call:
     *   - if using `revokeRole`, it is the admin role bearer
     *   - if using `renounceRole`, it is the role bearer (i.e. `account`)
     */
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) external view returns (bool);

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {AccessControl-_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) external view returns (bytes32);

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function revokeRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been granted `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     */
    function renounceRole(bytes32 role, address callerConfirmation) external;
}


// File npm/@openzeppelin/contracts@5.4.0/utils/Context.sol

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)


/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File npm/@openzeppelin/contracts@5.4.0/utils/introspection/ERC165.sol

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/ERC165.sol)


/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts that want to implement ERC-165 should inherit from this contract and override {supportsInterface} to check
 * for the additional interface id that will be supported. For example:
 *
 * ```solidity
 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
 * }
 * ```
 */
abstract contract ERC165 is IERC165 {
    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}


// File npm/@openzeppelin/contracts@5.4.0/utils/introspection/IERC165.sol

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/IERC165.sol)


/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File npm/@openzeppelin/contracts@5.4.0/utils/Pausable.sol

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.3.0) (utils/Pausable.sol)


/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract Pausable is Context {
    bool private _paused;

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    /**
     * @dev The operation failed because the contract is paused.
     */
    error EnforcedPause();

    /**
     * @dev The operation failed because the contract is not paused.
     */
    error ExpectedPause();

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}


// File npm/@openzeppelin/contracts@5.4.0/utils/ReentrancyGuard.sol

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)


/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}


// File contracts/game/CrapsBetTypes.sol

// Original license: SPDX_License_Identifier: MIT

/**
 * @title CrapsBetTypes
 * @notice Defines all 64 bet types supported in the Barely Human craps game
 * @dev Based on ton-craps implementation with complete casino bet coverage
 */
library CrapsBetTypes {
    // Core Line Bets (0-3)
    uint8 constant BET_PASS = 0; // Pass Line
    uint8 constant BET_DONT_PASS = 1; // Don't Pass
    uint8 constant BET_COME = 2; // Come
    uint8 constant BET_DONT_COME = 3; // Don't Come

    // Field Bet (4)
    uint8 constant BET_FIELD = 4; // Field (2,3,4,9,10,11,12)

    // YES Bets - Number Before 7 (5-14)
    uint8 constant BET_YES_2 = 5;
    uint8 constant BET_YES_3 = 6;
    uint8 constant BET_YES_4 = 7;
    uint8 constant BET_YES_5 = 8;
    uint8 constant BET_YES_6 = 9;
    uint8 constant BET_YES_8 = 10;
    uint8 constant BET_YES_9 = 11;
    uint8 constant BET_YES_10 = 12;
    uint8 constant BET_YES_11 = 13;
    uint8 constant BET_YES_12 = 14;

    // NO Bets - 7 Before Number (15-24)
    uint8 constant BET_NO_2 = 15;
    uint8 constant BET_NO_3 = 16;
    uint8 constant BET_NO_4 = 17;
    uint8 constant BET_NO_5 = 18;
    uint8 constant BET_NO_6 = 19;
    uint8 constant BET_NO_8 = 20;
    uint8 constant BET_NO_9 = 21;
    uint8 constant BET_NO_10 = 22;
    uint8 constant BET_NO_11 = 23;
    uint8 constant BET_NO_12 = 24;

    // Hardways Bets (25-28)
    uint8 constant BET_HARD4 = 25; // Hard 4 (2+2)
    uint8 constant BET_HARD6 = 26; // Hard 6 (3+3)
    uint8 constant BET_HARD8 = 27; // Hard 8 (4+4)
    uint8 constant BET_HARD10 = 28; // Hard 10 (5+5)

    // Odds Bets (29-32)
    uint8 constant BET_ODDS_PASS = 29;
    uint8 constant BET_ODDS_DONT_PASS = 30;
    uint8 constant BET_ODDS_COME = 31;
    uint8 constant BET_ODDS_DONT_COME = 32;

    // Special/Bonus Bets (33-42)
    uint8 constant BET_HOT_ROLLER = 33; // Progressive streak
    uint8 constant BET_FIRE = 34; // 4-6 unique points
    uint8 constant BET_TWICE_HARD = 35; // Same hardway twice
    uint8 constant BET_RIDE_LINE = 36; // Pass line win streak
    uint8 constant BET_MUGGSY = 37; // 7 on comeout or point-7
    uint8 constant BET_BONUS_SMALL = 38; // All 2-6 before 7
    uint8 constant BET_BONUS_TALL = 39; // All 8-12 before 7
    uint8 constant BET_BONUS_ALL = 40; // All numbers except 7
    uint8 constant BET_REPLAY = 41; // Same point 3+ times
    uint8 constant BET_DIFFERENT_DOUBLES = 42; // Unique doubles before 7

    // NEXT Bets - One-Roll Proposition (43-53)
    uint8 constant BET_NEXT_2 = 43;
    uint8 constant BET_NEXT_3 = 44;
    uint8 constant BET_NEXT_4 = 45;
    uint8 constant BET_NEXT_5 = 46;
    uint8 constant BET_NEXT_6 = 47;
    uint8 constant BET_NEXT_7 = 48;
    uint8 constant BET_NEXT_8 = 49;
    uint8 constant BET_NEXT_9 = 50;
    uint8 constant BET_NEXT_10 = 51;
    uint8 constant BET_NEXT_11 = 52;
    uint8 constant BET_NEXT_12 = 53;

    // Repeater Bets (54-63)
    uint8 constant BET_REPEATER_2 = 54; // 2 must appear 2 times
    uint8 constant BET_REPEATER_3 = 55; // 3 must appear 3 times
    uint8 constant BET_REPEATER_4 = 56; // 4 must appear 4 times
    uint8 constant BET_REPEATER_5 = 57; // 5 must appear 5 times
    uint8 constant BET_REPEATER_6 = 58; // 6 must appear 6 times
    uint8 constant BET_REPEATER_8 = 59; // 8 must appear 6 times
    uint8 constant BET_REPEATER_9 = 60; // 9 must appear 5 times
    uint8 constant BET_REPEATER_10 = 61; // 10 must appear 4 times
    uint8 constant BET_REPEATER_11 = 62; // 11 must appear 3 times
    uint8 constant BET_REPEATER_12 = 63; // 12 must appear 2 times

    /**
     * @notice Get payout multiplier for a bet type
     * @param betType The type of bet
     * @param point Current point (for odds bets)
     * @return multiplier Payout multiplier in basis points (100 = 1:1)
     */
    function getPayoutMultiplier(
        uint8 betType,
        uint8 point
    ) internal pure returns (uint256) {
        // Pass/Don't Pass/Come/Don't Come
        if (betType <= 3) return 100; // 1:1

        // Field bet
        if (betType == BET_FIELD) return 100; // 1:1 (except 2 and 12)

        // YES bets (2% house edge from true odds)
        if (betType == BET_YES_2) return 588; // 5.88:1
        if (betType == BET_YES_3) return 294; // 2.94:1
        if (betType == BET_YES_4) return 196; // 1.96:1
        if (betType == BET_YES_5) return 147; // 1.47:1
        if (betType == BET_YES_6) return 118; // 1.18:1
        if (betType == BET_YES_8) return 118; // 1.18:1
        if (betType == BET_YES_9) return 147; // 1.47:1
        if (betType == BET_YES_10) return 196; // 1.96:1
        if (betType == BET_YES_11) return 294; // 2.94:1
        if (betType == BET_YES_12) return 588; // 5.88:1

        // NO bets (2% house edge from true odds)
        if (betType == BET_NO_2) return 16; // 0.16:1
        if (betType == BET_NO_3) return 33; // 0.33:1
        if (betType == BET_NO_4) return 49; // 0.49:1
        if (betType == BET_NO_5) return 65; // 0.65:1
        if (betType == BET_NO_6) return 82; // 0.82:1
        if (betType == BET_NO_8) return 82; // 0.82:1
        if (betType == BET_NO_9) return 65; // 0.65:1
        if (betType == BET_NO_10) return 49; // 0.49:1
        if (betType == BET_NO_11) return 33; // 0.33:1
        if (betType == BET_NO_12) return 16; // 0.16:1

        // Hardways
        if (betType == BET_HARD4 || betType == BET_HARD10) return 700; // 7:1
        if (betType == BET_HARD6 || betType == BET_HARD8) return 900; // 9:1

        // Odds bets (true odds, no house edge)
        if (betType == BET_ODDS_PASS || betType == BET_ODDS_COME) {
            if (point == 4 || point == 10) return 200; // 2:1
            if (point == 5 || point == 9) return 150; // 3:2
            if (point == 6 || point == 8) return 120; // 6:5
        }
        if (betType == BET_ODDS_DONT_PASS || betType == BET_ODDS_DONT_COME) {
            if (point == 4 || point == 10) return 50; // 1:2
            if (point == 5 || point == 9) return 67; // 2:3
            if (point == 6 || point == 8) return 83; // 5:6
        }

        // Bonus bets
        if (betType == BET_FIRE) return 0; // Variable based on points made
        if (betType == BET_TWICE_HARD) return 600; // 6:1
        if (betType == BET_RIDE_LINE) return 0; // Variable based on streak
        if (betType == BET_MUGGSY) return 200; // 2:1 or 3:1
        if (betType == BET_BONUS_SMALL) return 3000; // 30:1
        if (betType == BET_BONUS_TALL) return 3000; // 30:1
        if (betType == BET_BONUS_ALL) return 15000; // 150:1
        if (betType == BET_REPLAY) return 0; // Variable
        if (betType == BET_DIFFERENT_DOUBLES) return 0; // Variable

        // NEXT bets (98% of true odds)
        if (betType == BET_NEXT_2) return 3430; // 34.3:1
        if (betType == BET_NEXT_3) return 1666; // 16.66:1
        if (betType == BET_NEXT_4) return 1078; // 10.78:1
        if (betType == BET_NEXT_5) return 784; // 7.84:1
        if (betType == BET_NEXT_6) return 608; // 6.08:1
        if (betType == BET_NEXT_7) return 490; // 4.9:1
        if (betType == BET_NEXT_8) return 608; // 6.08:1
        if (betType == BET_NEXT_9) return 784; // 7.84:1
        if (betType == BET_NEXT_10) return 1078; // 10.78:1
        if (betType == BET_NEXT_11) return 1666; // 16.66:1
        if (betType == BET_NEXT_12) return 3430; // 34.3:1

        // Repeater bets
        if (betType == BET_REPEATER_2 || betType == BET_REPEATER_12)
            return 4000; // 40:1
        if (betType == BET_REPEATER_3 || betType == BET_REPEATER_11)
            return 5000; // 50:1
        if (betType == BET_REPEATER_4 || betType == BET_REPEATER_10)
            return 6500; // 65:1
        if (betType == BET_REPEATER_5 || betType == BET_REPEATER_9) return 8000; // 80:1
        if (betType == BET_REPEATER_6 || betType == BET_REPEATER_8) return 9000; // 90:1

        return 0; // Invalid bet type
    }
}


// File contracts/game/ICrapsGame.sol

// Original license: SPDX_License_Identifier: MIT

/**
 * @title ICrapsGame
 * @notice Interface for the main Craps game contract
 * @dev Defines the core game mechanics and state management
 */
interface ICrapsGame {
    // Game phases
    enum Phase {
        IDLE,       // No active game
        COME_OUT,   // Come-out roll phase
        POINT       // Point established phase
    }
    
    // Dice roll result
    struct DiceRoll {
        uint8 die1;
        uint8 die2;
        uint8 total;
        uint256 timestamp;
        uint256 requestId;
    }
    
    // Shooter state
    struct ShooterState {
        address shooter;
        uint8 point;
        Phase phase;
        uint8 pointsMadeCount;
        uint8 consecutiveWins;
        uint8 fireMask;          // Bit mask for unique points (Fire bet)
        uint8 doublesMask;       // Bit mask for doubles seen
        uint16 smallTallMask;    // Bit mask for Small/Tall/All
        uint8[13] rollCount;     // Count per total for repeater bets
        uint256 seriesStartBlock;
    }
    
    // Events
    event GameStarted(address indexed shooter, uint256 seriesId);
    event DiceRolled(uint256 indexed seriesId, uint8 die1, uint8 die2, uint8 total);
    event PointEstablished(uint256 indexed seriesId, uint8 point);
    event PointMade(uint256 indexed seriesId, uint8 point);
    event SevenOut(uint256 indexed seriesId, address shooter);
    event PhaseChanged(Phase from, Phase to);
    event RandomnessRequested(uint256 requestId);
    event RandomnessFulfilled(uint256 requestId, uint256 randomness);
    
    // Core game functions
    function requestDiceRoll() external returns (uint256 requestId);
    function getCurrentShooter() external view returns (ShooterState memory);
    function getCurrentPhase() external view returns (Phase);
    function getLastRoll() external view returns (DiceRoll memory);
    function getSeriesId() external view returns (uint256);
    
    // Game state management
    function startNewSeries(address shooter) external;
    function endCurrentSeries() external;
    function isGameActive() external view returns (bool);
    
    // Bet validation
    function canPlaceBet(uint8 betType) external view returns (bool);
    function isBetTypeValid(uint8 betType) external pure returns (bool);
}

/**
 * @title ICrapsBets
 * @notice Interface for bet management in Craps
 */
interface ICrapsBets {
    // Bet structure
    struct Bet {
        uint256 amount;
        uint8 betType;
        uint8 point;        // For Come/Don't Come bets
        uint256 timestamp;
        bool isActive;
    }
    
    // Player bet summary
    struct PlayerBets {
        uint256 totalAtRisk;
        uint256 potentialWin;
        uint64 activeBetsBitmap;  // Bit mask for active bet types
        uint8 activeBetCount;
    }
    
    // Events
    event BetPlaced(
        address indexed player,
        uint256 indexed seriesId,
        uint8 betType,
        uint256 amount
    );
    
    event BetResolved(
        address indexed player,
        uint256 indexed seriesId,
        uint8 betType,
        uint256 amount,
        uint256 payout,
        bool won
    );
    
    event OddsBetPlaced(
        address indexed player,
        uint8 baseBetType,
        uint256 oddsAmount,
        uint8 point
    );
    
    // Betting functions
    function placeBet(uint8 betType, uint256 amount) external;
    function placeOddsBet(uint8 baseBetType, uint256 oddsAmount) external;
    function removeBet(uint8 betType) external;
    function clearBet(address player, uint8 betType) external;
    
    // View functions
    function getPlayerBets(address player) external view returns (PlayerBets memory);
    function getBet(address player, uint8 betType) external view returns (Bet memory);
    function hasActiveBet(address player, uint8 betType) external view returns (bool);
    function getTotalAtRisk(address player) external view returns (uint256);
}

/**
 * @title ICrapsSettlement
 * @notice Interface for bet settlement and payout calculations
 */
interface ICrapsSettlement {
    // Settlement batch for gas optimization
    struct SettlementBatch {
        address[] players;
        uint8[] betTypes;
        uint256[] amounts;
        uint256[] payouts;
    }
    
    // Events
    event BatchSettlement(
        uint256 indexed seriesId,
        uint256 rollNumber,
        uint8 diceTotal,
        uint256 totalPayout
    );
    
    event FieldBetResolved(
        address indexed player,
        uint8 diceTotal,
        uint256 payout
    );
    
    event HardwayResolved(
        address indexed player,
        uint8 hardwayType,
        bool wonHard,
        uint256 payout
    );
    
    // Settlement functions
    function settleRoll(uint8 die1, uint8 die2) external returns (uint256 totalPayout);
    function settleComeOutRoll(uint8 total) external returns (uint256 totalPayout);
    function settlePointRoll(uint8 total, uint8 point) external returns (uint256 totalPayout);
    function settleSevenOut() external returns (uint256 totalPayout);
    
    // Payout calculations
    function calculatePayout(
        uint8 betType,
        uint256 amount,
        uint8 point
    ) external pure returns (uint256);
    
    function getFieldPayout(uint8 total) external pure returns (uint256 multiplier);
    function isHardway(uint8 die1, uint8 die2, uint8 total) external pure returns (bool);
}

/**
 * @title ICrapsVault
 * @notice Interface for vault integration with the Craps game
 */
interface ICrapsVault {
    function processBet(
        address player,
        uint256 amount
    ) external returns (bool);
    
    function processPayout(
        address player,
        uint256 amount
    ) external returns (bool);
    
    function getPlayerBalance(address player) external view returns (uint256);
    function getTotalLiquidity() external view returns (uint256);
    function getActiveBotVaults() external view returns (address[] memory);
}

