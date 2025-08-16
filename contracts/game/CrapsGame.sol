// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "./ICrapsGame.sol";
import "./CrapsBetTypes.sol";

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
    uint256 public minBetAmount = 0.001 ether;
    uint256 public maxBetAmount = 10 ether;
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