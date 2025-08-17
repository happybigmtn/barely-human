[dotenv@17.2.1] injecting env (15) from .env -- tip: 📡 auto-backup env with Radar: https://dotenvx.com/radar
// Sources flattened with hardhat v3.0.0 https://hardhat.org

// SPDX-License-Identifier: MIT

// File contracts/game/CrapsBets.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.28;





/**
 * @title CrapsBets
 * @notice Manages all bet placement and storage for the Craps game
 * @dev Optimized for gas efficiency with bitmap tracking and batch operations
 */
contract CrapsBets is ICrapsBets, AccessControl, ReentrancyGuard, Pausable {
    using CrapsBetTypes for uint8;

    // Roles
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // Connected contracts
    ICrapsGame public gameContract;
    ICrapsVault public vaultContract;
    address public settlementContract;

    // Bet storage - optimized with nested mappings
    // player => betType => Bet
    mapping(address => mapping(uint8 => Bet)) public bets;

    // Player bet tracking
    mapping(address => PlayerBets) public playerBetSummary;

    // Active players for batch processing
    address[] public activePlayers;
    mapping(address => uint256) public playerIndex;
    mapping(address => bool) public isActivePlayer;

    // Series tracking
    uint256 public currentSeriesId;
    mapping(uint256 => uint256) public seriesTotalBets;
    mapping(uint256 => uint256) public seriesTotalVolume;

    // Bet limits
    uint256 public minBetAmount = 1 * 10 ** 18; // 10 BOT tokens minimum
    uint256 public maxBetAmount = 10000 * 10 ** 18; // 10,000 BOT tokens maximum
    uint256 public maxOddsMultiple = 5; // 5x odds max

    // State tracking for Come/Don't Come bets
    mapping(address => mapping(uint8 => uint8)) public comePoints; // player => comeNumber => point

    // Events (from interface)
    // event BetPlaced(address indexed player, uint256 indexed seriesId, uint8 betType, uint256 amount);
    // event BetResolved(address indexed player, uint256 indexed seriesId, uint8 betType, uint256 amount, uint256 payout, bool won);
    // event OddsBetPlaced(address indexed player, uint8 baseBetType, uint256 oddsAmount, uint8 point);

    // Additional events
    event BetRemoved(address indexed player, uint8 betType, uint256 amount);
    event BatchProcessed(uint256 playersProcessed, uint256 totalPayouts);

    // Modifiers
    modifier onlyGame() {
        require(msg.sender == address(gameContract), "Only game contract");
        _;
    }

    modifier onlySettlement() {
        require(msg.sender == settlementContract, "Only settlement contract");
        _;
    }

    modifier validBetType(uint8 betType) {
        require(betType <= 63, "Invalid bet type");
        _;
    }

    modifier betAmountValid(uint256 amount) {
        require(
            amount >= minBetAmount && amount <= maxBetAmount,
            "Invalid bet amount"
        );
        _;
    }

    /**
     * @notice Constructor
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // ============ Configuration Functions ============

    /**
     * @notice Set connected contracts
     * @param _gameContract Address of the game contract
     * @param _vaultContract Address of the vault contract
     * @param _settlementContract Address of the settlement contract
     */
    function setContracts(
        address _gameContract,
        address _vaultContract,
        address _settlementContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_gameContract != address(0), "Invalid game contract");
        require(_vaultContract != address(0), "Invalid vault contract");
        require(
            _settlementContract != address(0),
            "Invalid settlement contract"
        );

        gameContract = ICrapsGame(_gameContract);
        vaultContract = ICrapsVault(_vaultContract);
        settlementContract = _settlementContract;

        _grantRole(GAME_ROLE, _gameContract);
        _grantRole(SETTLEMENT_ROLE, _settlementContract);
    }

    /**
     * @notice Update bet limits
     * @param _minBet Minimum bet amount
     * @param _maxBet Maximum bet amount
     * @param _maxOdds Maximum odds multiple
     */
    function updateLimits(
        uint256 _minBet,
        uint256 _maxBet,
        uint256 _maxOdds
    ) external onlyRole(OPERATOR_ROLE) {
        require(_minBet > 0 && _minBet <= _maxBet, "Invalid bet limits");
        require(_maxOdds >= 1 && _maxOdds <= 10, "Invalid odds multiple");

        minBetAmount = _minBet;
        maxBetAmount = _maxBet;
        maxOddsMultiple = _maxOdds;
    }

    // ============ Betting Functions ============

    /**
     * @notice Place a bet
     * @param betType Type of bet to place
     * @param amount Amount to bet
     */
    function placeBet(
        uint8 betType,
        uint256 amount
    )
        external
        override
        nonReentrant
        whenNotPaused
        validBetType(betType)
        betAmountValid(amount)
    {
        require(gameContract.isGameActive(), "Game not active");
        require(gameContract.canPlaceBet(betType), "Cannot place this bet now");

        // Check if player has an active bet of this type
        require(!bets[msg.sender][betType].isActive, "Bet already exists");

        // Process payment through vault
        require(vaultContract.processBet(msg.sender, amount), "Payment failed");

        // Get current series ID
        uint256 seriesId = gameContract.getSeriesId();
        if (seriesId != currentSeriesId) {
            currentSeriesId = seriesId;
        }

        // Store bet
        bets[msg.sender][betType] = Bet({
            amount: amount,
            betType: betType,
            point: 0,
            timestamp: block.timestamp,
            isActive: true
        });

        // Handle Come/Don't Come point tracking
        if (
            betType == CrapsBetTypes.BET_COME ||
            betType == CrapsBetTypes.BET_DONT_COME
        ) {
            // Point will be set on next roll
            comePoints[msg.sender][betType] = 0;
        }

        // Update player tracking
        _updatePlayerTracking(msg.sender, betType, amount, true);

        // Update series stats
        seriesTotalBets[seriesId]++;
        seriesTotalVolume[seriesId] += amount;

        emit BetPlaced(msg.sender, seriesId, betType, amount);
    }

    /**
     * @notice Place an odds bet on existing Pass/Come or Don't Pass/Don't Come bet
     * @param baseBetType The base bet type (Pass, Don't Pass, Come, Don't Come)
     * @param oddsAmount Amount for the odds bet
     */
    function placeOddsBet(
        uint8 baseBetType,
        uint256 oddsAmount
    ) external override nonReentrant whenNotPaused betAmountValid(oddsAmount) {
        // Validate base bet type
        require(
            baseBetType == CrapsBetTypes.BET_PASS ||
                baseBetType == CrapsBetTypes.BET_DONT_PASS ||
                baseBetType == CrapsBetTypes.BET_COME ||
                baseBetType == CrapsBetTypes.BET_DONT_COME,
            "Invalid base bet for odds"
        );

        // Check player has active base bet
        Bet memory baseBet = bets[msg.sender][baseBetType];
        require(baseBet.isActive, "No active base bet");

        // Get current point
        ICrapsGame.ShooterState memory shooter = gameContract
            .getCurrentShooter();
        uint8 point = shooter.point;

        // For Come/Don't Come, use the come point
        if (
            baseBetType == CrapsBetTypes.BET_COME ||
            baseBetType == CrapsBetTypes.BET_DONT_COME
        ) {
            point = comePoints[msg.sender][baseBetType];
        }

        require(point > 0, "No point established");

        // Check odds limit
        require(
            oddsAmount <= baseBet.amount * maxOddsMultiple,
            "Exceeds max odds multiple"
        );

        // Determine odds bet type
        uint8 oddsBetType;
        if (baseBetType == CrapsBetTypes.BET_PASS) {
            oddsBetType = CrapsBetTypes.BET_ODDS_PASS;
        } else if (baseBetType == CrapsBetTypes.BET_DONT_PASS) {
            oddsBetType = CrapsBetTypes.BET_ODDS_DONT_PASS;
        } else if (baseBetType == CrapsBetTypes.BET_COME) {
            oddsBetType = CrapsBetTypes.BET_ODDS_COME;
        } else {
            oddsBetType = CrapsBetTypes.BET_ODDS_DONT_COME;
        }

        // Check no existing odds bet
        require(
            !bets[msg.sender][oddsBetType].isActive,
            "Odds bet already exists"
        );

        // Process payment
        require(
            vaultContract.processBet(msg.sender, oddsAmount),
            "Payment failed"
        );

        // Store odds bet
        bets[msg.sender][oddsBetType] = Bet({
            amount: oddsAmount,
            betType: oddsBetType,
            point: point,
            timestamp: block.timestamp,
            isActive: true
        });

        // Update tracking
        _updatePlayerTracking(msg.sender, oddsBetType, oddsAmount, true);

        emit OddsBetPlaced(msg.sender, baseBetType, oddsAmount, point);
    }

    /**
     * @notice Remove a bet (if allowed)
     * @param betType Type of bet to remove
     */
    function removeBet(
        uint8 betType
    ) external override nonReentrant whenNotPaused {
        Bet memory bet = bets[msg.sender][betType];
        require(bet.isActive, "No active bet");

        // Some bets cannot be removed once placed
        require(_canRemoveBet(betType), "Cannot remove this bet");

        // Return funds to player through vault
        require(
            vaultContract.processPayout(msg.sender, bet.amount),
            "Refund failed"
        );

        // Clear bet
        delete bets[msg.sender][betType];

        // Update tracking
        _updatePlayerTracking(msg.sender, betType, bet.amount, false);

        emit BetRemoved(msg.sender, betType, bet.amount);
    }

    // ============ Settlement Functions ============

    /**
     * @notice Clear a resolved bet (called by settlement contract)
     * @param player Player address
     * @param betType Bet type to clear
     */
    function clearBet(
        address player,
        uint8 betType
    ) external onlyRole(SETTLEMENT_ROLE) {
        delete bets[player][betType];
        _updatePlayerTracking(player, betType, 0, false);
    }

    /**
     * @notice Update come point after roll (called by settlement)
     * @param player Player address
     * @param betType Come or Don't Come bet type
     * @param point New point value
     */
    function updateComePoint(
        address player,
        uint8 betType,
        uint8 point
    ) external onlyRole(SETTLEMENT_ROLE) {
        require(
            betType == CrapsBetTypes.BET_COME ||
                betType == CrapsBetTypes.BET_DONT_COME,
            "Not a come bet"
        );

        comePoints[player][betType] = point;

        // Update the bet's point value
        if (bets[player][betType].isActive) {
            bets[player][betType].point = point;
        }
    }

    /**
     * @notice Get all active players for batch processing
     * @param offset Start index
     * @param limit Max number to return
     * @return players Array of player addresses
     */
    function getActivePlayers(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory players) {
        uint256 length = activePlayers.length;
        if (offset >= length) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }

        players = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            players[i - offset] = activePlayers[i];
        }
    }

    // ============ View Functions ============

    function getPlayerBets(
        address player
    ) external view override returns (PlayerBets memory) {
        return playerBetSummary[player];
    }

    function getBet(
        address player,
        uint8 betType
    ) external view override returns (Bet memory) {
        return bets[player][betType];
    }

    function hasActiveBet(
        address player,
        uint8 betType
    ) external view override returns (bool) {
        return bets[player][betType].isActive;
    }

    function getTotalAtRisk(
        address player
    ) external view override returns (uint256) {
        return playerBetSummary[player].totalAtRisk;
    }

    /**
     * @notice Get all active bet types for a player
     * @param player Player address
     * @return betTypes Array of active bet type IDs
     */
    function getActiveBetTypes(
        address player
    ) external view returns (uint8[] memory) {
        uint64 bitmap = playerBetSummary[player].activeBetsBitmap;
        uint8 count = playerBetSummary[player].activeBetCount;

        uint8[] memory betTypes = new uint8[](count);
        uint8 index = 0;

        for (uint8 i = 0; i < 64 && index < count; i++) {
            if (bitmap & (1 << i) != 0) {
                betTypes[index++] = i;
            }
        }

        return betTypes;
    }

    // ============ Internal Functions ============

    /**
     * @notice Update player tracking when bets change
     * @param player Player address
     * @param betType Bet type
     * @param amount Bet amount
     * @param isAdding True if adding bet, false if removing
     */
    function _updatePlayerTracking(
        address player,
        uint8 betType,
        uint256 amount,
        bool isAdding
    ) private {
        PlayerBets storage summary = playerBetSummary[player];

        if (isAdding) {
            // Add to bitmap
            if ((summary.activeBetsBitmap & (1 << betType)) == 0) {
                summary.activeBetsBitmap |= uint64(1 << betType);
                summary.activeBetCount++;
            }

            // Update totals
            summary.totalAtRisk += amount;

            // Add to active players if first bet
            if (!isActivePlayer[player]) {
                isActivePlayer[player] = true;
                playerIndex[player] = activePlayers.length;
                activePlayers.push(player);
            }
        } else {
            // Remove from bitmap
            if ((summary.activeBetsBitmap & (1 << betType)) != 0) {
                summary.activeBetsBitmap &= ~uint64(1 << betType);
                summary.activeBetCount--;
            }

            // Update totals
            if (amount > 0 && summary.totalAtRisk >= amount) {
                summary.totalAtRisk -= amount;
            }

            // Remove from active players if no more bets
            if (summary.activeBetCount == 0 && isActivePlayer[player]) {
                uint256 index = playerIndex[player];
                uint256 lastIndex = activePlayers.length - 1;

                if (index != lastIndex) {
                    address lastPlayer = activePlayers[lastIndex];
                    activePlayers[index] = lastPlayer;
                    playerIndex[lastPlayer] = index;
                }

                activePlayers.pop();
                delete playerIndex[player];
                isActivePlayer[player] = false;
            }
        }
    }

    /**
     * @notice Check if a bet type can be removed
     * @param betType Bet type to check
     * @return bool Whether the bet can be removed
     */
    function _canRemoveBet(uint8 betType) private pure returns (bool) {
        // Pass/Don't Pass cannot be removed after come-out
        if (
            betType == CrapsBetTypes.BET_PASS ||
            betType == CrapsBetTypes.BET_DONT_PASS
        ) {
            return false;
        }

        // Come/Don't Come cannot be removed once point is established
        if (
            betType == CrapsBetTypes.BET_COME ||
            betType == CrapsBetTypes.BET_DONT_COME
        ) {
            return false;
        }

        // Most other bets can be removed
        return true;
    }

    // ============ Emergency Functions ============

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
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

