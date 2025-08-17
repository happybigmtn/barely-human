[dotenv@17.2.1] injecting env (15) from .env -- tip: 📡 auto-backup env with Radar: https://dotenvx.com/radar
// Sources flattened with hardhat v3.0.0 https://hardhat.org

// SPDX-License-Identifier: MIT

// File contracts/game/CrapsSettlementSimple.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.28;


/**
 * @title CrapsSettlementSimple
 * @notice Simplified settlement for deployment - only core functionality
 * @dev Extremely minimal to fit under size limit
 */
contract CrapsSettlementSimple is AccessControl {
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    ICrapsGame public gameContract;
    uint8 public lastTotal;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setContracts(address _game) external onlyRole(DEFAULT_ADMIN_ROLE) {
        gameContract = ICrapsGame(_game);
        _grantRole(GAME_ROLE, _game);
    }

    function settleRoll(uint8 die1, uint8 die2) external onlyRole(GAME_ROLE) returns (uint256) {
        lastTotal = die1 + die2;
        // Minimal implementation - just return a value for now
        // Full logic would be implemented off-chain or in separate contracts
        return 0;
    }

    function settleSeries(uint256) external view onlyRole(GAME_ROLE) returns (uint256) {
        return 0;
    }

    function getPayoutMultiplier(uint8, uint8) external pure returns (uint256) {
        return 100; // 1:1 default
    }

    function isWinningBet(uint8 betType, uint8 rollTotal, uint8 point) external pure returns (bool) {
        // Simplified logic for Pass Line only
        if (betType == 0) { // Pass Line
            if (point == 0) { // Come out roll
                return rollTotal == 7 || rollTotal == 11;
            } else { // Point phase
                return rollTotal == point;
            }
        }
        return false;
    }

    function getSettlementDetails(
        uint8 betType,
        uint256 amount,
        uint8 rollTotal,
        uint8 point
    ) external pure returns (uint256 payout, bool won, bool pushed) {
        // Simplified for Pass Line
        if (betType == 0) {
            if (point == 0) {
                if (rollTotal == 7 || rollTotal == 11) {
                    return (amount * 2, true, false);
                }
                if (rollTotal == 2 || rollTotal == 3 || rollTotal == 12) {
                    return (0, false, false);
                }
            } else {
                if (rollTotal == point) {
                    return (amount * 2, true, false);
                }
                if (rollTotal == 7) {
                    return (0, false, false);
                }
            }
            return (amount, false, true); // Push
        }
        return (0, false, false);
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

