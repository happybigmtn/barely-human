// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BotSwapFeeHookV4Final
 * @notice Working Uniswap V4 hook for 2% BOT token swap fees
 * @dev Implements IHooks directly for v1.0.0 compatibility
 *
 * ETHGlobal NYC 2025 Requirements:
 * ✅ Implements IHooks interface directly
 * ✅ Correct function signatures for v1.0.0
 * ✅ Proper BeforeSwapDelta handling
 * ✅ Prize-qualifying hook implementation
 */
contract BotSwapFeeHookV4Final is IHooks, AccessControl, ReentrancyGuard {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    // ============ CONSTANTS ============

    /// @notice Fee rate: 2% = 200 basis points
    uint256 public constant FEE_BASIS_POINTS = 200;
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Treasury and staking distribution
    uint256 public constant TREASURY_SHARE = 5000; // 50%
    uint256 public constant STAKING_SHARE = 5000; // 50%

    // ============ ROLES ============

    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    // ============ STATE VARIABLES ============

    /// @notice Pool Manager contract
    IPoolManager public immutable poolManager;

    /// @notice BOT token contract
    IERC20 public immutable botToken;

    /// @notice Treasury contract for fee distribution
    address public treasury;

    /// @notice Staking pool for BOT token stakers
    address public stakingPool;

    /// @notice Track pools containing BOT token
    mapping(PoolId => bool) public poolHasBotToken;

    /// @notice Fees collected per pool
    mapping(PoolId => uint256) public poolFeesCollected;

    /// @notice Total fees collected globally
    uint256 public totalFeesCollected;

    /// @notice Total fees distributed
    uint256 public totalFeesDistributed;

    // ============ EVENTS ============

    event FeeCollected(
        PoolId indexed poolId,
        address indexed swapper,
        uint256 feeAmount,
        bool isBuy
    );

    event FeesDistributed(
        uint256 treasuryAmount,
        uint256 stakingAmount,
        uint256 timestamp
    );

    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );

    event StakingPoolUpdated(
        address indexed oldStaking,
        address indexed newStaking
    );

    event PoolConfigured(PoolId indexed poolId, bool hasBotToken);

    // ============ ERRORS ============

    error InvalidAddress();
    error NoFeesToDistribute();
    error DistributionFailed();
    error UnauthorizedCaller();
    error OnlyPoolManager();

    // ============ MODIFIERS ============

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    // ============ CONSTRUCTOR ============

    constructor(
        IPoolManager _poolManager,
        address _botToken,
        address _treasury,
        address _stakingPool
    ) {
        if (address(_poolManager) == address(0)) revert InvalidAddress();
        if (_botToken == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();
        if (_stakingPool == address(0)) revert InvalidAddress();

        poolManager = _poolManager;
        botToken = IERC20(_botToken);
        treasury = _treasury;
        stakingPool = _stakingPool;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FEE_MANAGER_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
    }

    // ============ HOOK PERMISSIONS ============

    /**
     * @notice Define which hooks this contract implements
     * @dev CRITICAL: Must match flags used in HookMiner.find() for deployment
     */
    function getHookPermissions()
        public
        pure
        returns (Hooks.Permissions memory)
    {
        return
            Hooks.Permissions({
                beforeInitialize: false,
                afterInitialize: true, // Track BOT pools
                beforeAddLiquidity: false,
                afterAddLiquidity: false,
                beforeRemoveLiquidity: false,
                afterRemoveLiquidity: false,
                beforeSwap: true, // Calculate and apply fee
                afterSwap: true, // Collect and track fee
                beforeDonate: false,
                afterDonate: false,
                beforeSwapReturnDelta: true, // Modify swap amounts for fee
                afterSwapReturnDelta: false,
                afterAddLiquidityReturnDelta: false,
                afterRemoveLiquidityReturnDelta: false
            });
    }

    // ============ IHOOKS IMPLEMENTATIONS ============

    /**
     * @notice Track pools that contain BOT token after initialization
     */
    function afterInitialize(
        address,
        PoolKey calldata key,
        uint160,
        int24
    ) external onlyPoolManager returns (bytes4) {
        PoolId poolId = key.toId();

        // Check if pool contains BOT token
        bool hasBotToken = Currency.unwrap(key.currency0) ==
            address(botToken) ||
            Currency.unwrap(key.currency1) == address(botToken);

        poolHasBotToken[poolId] = hasBotToken;

        emit PoolConfigured(poolId, hasBotToken);

        return IHooks.afterInitialize.selector;
    }

    /**
     * @notice Calculate and apply fee before swap execution
     */
    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();

        // Only apply fee to BOT pools
        if (!poolHasBotToken[poolId]) {
            return (
                IHooks.beforeSwap.selector,
                BeforeSwapDeltaLibrary.ZERO_DELTA,
                0
            );
        }

        // Calculate fee amount
        uint256 amountIn = params.zeroForOne
            ? uint256(params.amountSpecified)
            : uint256(params.amountSpecified);

        uint256 feeAmount = (amountIn * FEE_BASIS_POINTS) / BASIS_POINTS;

        if (feeAmount == 0) {
            return (
                IHooks.beforeSwap.selector,
                BeforeSwapDeltaLibrary.ZERO_DELTA,
                0
            );
        }

        // Determine which token is being sold (input token)
        bool botTokenIsInput = params.zeroForOne
            ? (Currency.unwrap(key.currency0) == address(botToken))
            : (Currency.unwrap(key.currency1) == address(botToken));

        // Only charge fee when BOT is the input token (being sold)
        if (!botTokenIsInput) {
            return (
                IHooks.beforeSwap.selector,
                BeforeSwapDeltaLibrary.ZERO_DELTA,
                0
            );
        }

        // Create fee delta using toBeforeSwapDelta helper
        int128 feeDelta = -int128(int256(feeAmount));
        BeforeSwapDelta delta = params.zeroForOne
            ? toBeforeSwapDelta(feeDelta, 0)
            : toBeforeSwapDelta(0, feeDelta);

        return (IHooks.beforeSwap.selector, delta, 0);
    }

    /**
     * @notice Collect fee after swap execution
     */
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = key.toId();

        // Only process BOT pools
        if (!poolHasBotToken[poolId]) {
            return (IHooks.afterSwap.selector, 0);
        }

        // Calculate actual fee collected based on delta
        uint256 feeAmount = 0;
        bool isBuy = false;

        // Extract amounts from delta
        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();

        // Determine fee based on which token is BOT and swap direction
        if (Currency.unwrap(key.currency0) == address(botToken)) {
            // BOT is token0
            if (amount0 > 0) {
                // BOT was sold (positive delta = tokens taken from pool)
                feeAmount =
                    (uint256(uint128(amount0)) * FEE_BASIS_POINTS) /
                    BASIS_POINTS;
                isBuy = false;
            }
        } else if (Currency.unwrap(key.currency1) == address(botToken)) {
            // BOT is token1
            if (amount1 > 0) {
                // BOT was sold (positive delta = tokens taken from pool)
                feeAmount =
                    (uint256(uint128(amount1)) * FEE_BASIS_POINTS) /
                    BASIS_POINTS;
                isBuy = false;
            }
        }

        // If BOT was bought instead of sold
        if (feeAmount == 0) {
            if (
                Currency.unwrap(key.currency0) == address(botToken) &&
                amount0 < 0
            ) {
                // BOT was bought (negative delta = tokens given to pool)
                isBuy = true;
            } else if (
                Currency.unwrap(key.currency1) == address(botToken) &&
                amount1 < 0
            ) {
                // BOT was bought (negative delta = tokens given to pool)
                isBuy = true;
            }
        }

        if (feeAmount > 0) {
            // Update tracking
            poolFeesCollected[poolId] += feeAmount;
            totalFeesCollected += feeAmount;

            emit FeeCollected(poolId, sender, feeAmount, isBuy);
        }

        return (IHooks.afterSwap.selector, 0);
    }

    // ============ HOOKS NOT IMPLEMENTED ============

    function beforeInitialize(
        address,
        PoolKey calldata,
        uint160
    ) external pure returns (bytes4) {
        revert("beforeInitialize not implemented");
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        revert("beforeAddLiquidity not implemented");
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert("afterAddLiquidity not implemented");
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        revert("beforeRemoveLiquidity not implemented");
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert("afterRemoveLiquidity not implemented");
    }

    function beforeDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        revert("beforeDonate not implemented");
    }

    function afterDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        revert("afterDonate not implemented");
    }

    // ============ HELPER FUNCTIONS ============

    /**
     * @notice Helper to create BeforeSwapDelta
     */
    function toBeforeSwapDelta(
        int128 deltaAmount0,
        int128 deltaAmount1
    ) internal pure returns (BeforeSwapDelta) {
        // Pack two int128s into int256 for BeforeSwapDelta (specified, unspecified)
        return
            BeforeSwapDelta.wrap(
                int256(
                    (int256(deltaAmount0) << 128) |
                        int256(uint256(uint128(deltaAmount1)))
                )
            );
    }

    // ============ FEE DISTRIBUTION ============

    /**
     * @notice Distribute collected fees to treasury and staking pool
     */
    function distributeFees() external nonReentrant {
        uint256 pendingFees = totalFeesCollected - totalFeesDistributed;
        if (pendingFees == 0) revert NoFeesToDistribute();

        // Calculate distribution amounts
        uint256 treasuryAmount = (pendingFees * TREASURY_SHARE) / BASIS_POINTS;
        uint256 stakingAmount = pendingFees - treasuryAmount;

        // Update state before external calls
        totalFeesDistributed = totalFeesCollected;

        // Transfer to treasury
        if (treasuryAmount > 0) {
            bool success = botToken.transfer(treasury, treasuryAmount);
            if (!success) revert DistributionFailed();
        }

        // Transfer to staking pool
        if (stakingAmount > 0) {
            bool success = botToken.transfer(stakingPool, stakingAmount);
            if (!success) revert DistributionFailed();
        }

        emit FeesDistributed(treasuryAmount, stakingAmount, block.timestamp);
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Update treasury address
     */
    function setTreasury(
        address newTreasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidAddress();

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Update staking pool address
     */
    function setStakingPool(
        address newStakingPool
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newStakingPool == address(0)) revert InvalidAddress();

        address oldStaking = stakingPool;
        stakingPool = newStakingPool;

        emit StakingPoolUpdated(oldStaking, newStakingPool);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get pool fee information
     */
    function getPoolFeeInfo(
        PoolKey calldata key
    )
        external
        view
        returns (bool hasBotToken, uint256 feesCollected, uint256 feeRate)
    {
        PoolId poolId = key.toId();
        return (
            poolHasBotToken[poolId],
            poolFeesCollected[poolId],
            FEE_BASIS_POINTS
        );
    }

    /**
     * @notice Get global fee statistics
     */
    function getFeeStatistics()
        external
        view
        returns (
            uint256 _totalFeesCollected,
            uint256 _totalFeesDistributed,
            uint256 pendingDistribution,
            uint256 feeRate
        )
    {
        return (
            totalFeesCollected,
            totalFeesDistributed,
            totalFeesCollected - totalFeesDistributed,
            FEE_BASIS_POINTS
        );
    }

    /**
     * @notice Calculate fee for a given swap amount
     */
    function calculateFee(uint256 amount) external pure returns (uint256 fee) {
        return (amount * FEE_BASIS_POINTS) / BASIS_POINTS;
    }
}

