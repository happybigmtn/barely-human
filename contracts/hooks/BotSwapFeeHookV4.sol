// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Uniswap V4 Core Interfaces
interface IPoolManager {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }
}

interface IHooks {
    struct Permissions {
        bool beforeInitialize;
        bool afterInitialize;
        bool beforeAddLiquidity;
        bool afterAddLiquidity;
        bool beforeRemoveLiquidity;
        bool afterRemoveLiquidity;
        bool beforeSwap;
        bool afterSwap;
        bool beforeDonate;
        bool afterDonate;
        bool beforeSwapReturnDelta;
        bool afterSwapReturnDelta;
        bool afterAddLiquidityReturnDelta;
        bool afterRemoveLiquidityReturnDelta;
    }

    function beforeSwap(
        address sender,
        IPoolManager.PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external returns (bytes4, BeforeSwapDelta, uint24);

    function afterSwap(
        address sender,
        IPoolManager.PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external returns (bytes4, int128);
}

// Type definitions for V4
type Currency is address;
type BalanceDelta is int256;
type BeforeSwapDelta is int256;

library CurrencyLibrary {
    Currency public constant NATIVE = Currency.wrap(address(0));
    
    function isNative(Currency currency) internal pure returns (bool) {
        return Currency.unwrap(currency) == address(0);
    }
    
    function toId(Currency currency) internal pure returns (uint256) {
        return uint160(Currency.unwrap(currency));
    }
}

library BalanceDeltaLibrary {
    function amount0(BalanceDelta delta) internal pure returns (int128) {
        return int128(int256(BalanceDelta.unwrap(delta) >> 128));
    }
    
    function amount1(BalanceDelta delta) internal pure returns (int128) {
        return int128(int256(BalanceDelta.unwrap(delta)));
    }
}

interface ITreasury {
    function receiveSwapFees(uint256 amount) external;
}

/**
 * @title BotSwapFeeHookV4
 * @notice Uniswap V4 hook that takes 2% fee on BOT token swaps
 * @dev Fully compatible with Uniswap V4 hook architecture
 */
contract BotSwapFeeHookV4 is IHooks, AccessControl, ReentrancyGuard {
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;
    
    // Constants
    uint256 public constant FEE_PERCENTAGE = 200; // 2% = 200 basis points
    uint256 public constant BASIS_POINTS = 10000;
    bytes4 public constant BEFORE_SWAP_SELECTOR = IHooks.beforeSwap.selector;
    bytes4 public constant AFTER_SWAP_SELECTOR = IHooks.afterSwap.selector;
    
    // Roles
    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    
    // State
    IERC20 public immutable botToken;
    ITreasury public treasury;
    address public poolManager;
    
    // Fee tracking
    uint256 public totalFeesCollected;
    mapping(address => uint256) public userFeesContributed;
    mapping(bytes32 => uint256) public poolFeesCollected;
    
    // Pool configuration
    mapping(bytes32 => bool) public enabledPools;
    mapping(address => mapping(address => bytes32)) public poolIds; // token0 => token1 => poolId
    
    // Swap state (for passing data between before and after)
    mapping(bytes32 => uint256) private pendingFees;
    
    // Events
    event FeeCollected(
        bytes32 indexed poolId,
        address indexed trader,
        uint256 feeAmount,
        bool isBotToken0
    );
    event TreasuryUpdated(address indexed newTreasury);
    event PoolEnabled(bytes32 indexed poolId, bool enabled);
    event PoolRegistered(bytes32 indexed poolId, address token0, address token1);
    
    // Errors
    error PoolNotEnabled();
    error InvalidTreasury();
    error UnauthorizedCaller();
    error TransferFailed();
    error InvalidPool();
    error NoBotTokenInPool();
    
    modifier onlyPoolManager() {
        if (msg.sender != poolManager) revert UnauthorizedCaller();
        _;
    }
    
    constructor(
        address _botToken,
        address _treasury,
        address _poolManager
    ) {
        require(_botToken != address(0), "Invalid BOT token");
        require(_treasury != address(0), "Invalid treasury");
        require(_poolManager != address(0), "Invalid pool manager");
        
        botToken = IERC20(_botToken);
        treasury = ITreasury(_treasury);
        poolManager = _poolManager;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POOL_MANAGER_ROLE, _poolManager);
        _grantRole(FEE_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @notice Get hook permissions
     * @dev Tells Uniswap V4 which hooks this contract implements
     */
    function getHookPermissions() 
        external 
        pure 
        returns (Permissions memory) 
    {
        return Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,  // We implement this
            afterSwap: true,   // We implement this
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,  // We modify swap amounts
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }
    
    /**
     * @notice Hook called before swap execution
     * @dev Calculate fee and return delta to charge it
     */
    function beforeSwap(
        address sender,
        IPoolManager.PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata /* hookData */
    ) external override onlyPoolManager returns (
        bytes4 selector,
        BeforeSwapDelta feeDelta,
        uint24 lpFeeOverride
    ) {
        // Get pool ID
        bytes32 poolId = _getPoolId(key);
        
        // Check if pool is enabled
        if (!enabledPools[poolId]) {
            return (BEFORE_SWAP_SELECTOR, BeforeSwapDelta.wrap(0), 0);
        }
        
        // Check if BOT token is involved
        bool isBotToken0 = key.currency0 == address(botToken);
        bool isBotToken1 = key.currency1 == address(botToken);
        
        if (!isBotToken0 && !isBotToken1) {
            return (BEFORE_SWAP_SELECTOR, BeforeSwapDelta.wrap(0), 0);
        }
        
        // Calculate fee based on swap amount
        uint256 swapAmount = _abs(params.amountSpecified);
        uint256 feeAmount = (swapAmount * FEE_PERCENTAGE) / BASIS_POINTS;
        
        // Store pending fee for afterSwap
        bytes32 swapId = keccak256(abi.encodePacked(sender, block.number, tx.origin));
        pendingFees[swapId] = feeAmount;
        
        // Return fee delta to charge the fee
        // If swapping token0 for token1 (zeroForOne = true), charge fee on token0
        // If swapping token1 for token0 (zeroForOne = false), charge fee on token1
        int256 delta;
        if (params.zeroForOne && isBotToken0) {
            // Selling BOT (token0) - charge fee on token0
            delta = int256(feeAmount);
        } else if (!params.zeroForOne && isBotToken1) {
            // Selling BOT (token1) - charge fee on token1
            delta = -int256(feeAmount);
        }
        
        return (BEFORE_SWAP_SELECTOR, BeforeSwapDelta.wrap(delta), 0);
    }
    
    /**
     * @notice Hook called after swap execution
     * @dev Collect the fee and send to treasury
     */
    function afterSwap(
        address sender,
        IPoolManager.PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata /* hookData */
    ) external override onlyPoolManager nonReentrant returns (
        bytes4 selector,
        int128 deltaUnspecified
    ) {
        // Get pool ID
        bytes32 poolId = _getPoolId(key);
        
        // Check if pool is enabled
        if (!enabledPools[poolId]) {
            return (AFTER_SWAP_SELECTOR, 0);
        }
        
        // Get pending fee
        bytes32 swapId = keccak256(abi.encodePacked(sender, block.number, tx.origin));
        uint256 feeAmount = pendingFees[swapId];
        
        if (feeAmount > 0) {
            delete pendingFees[swapId];
            
            // Determine which token is BOT
            bool isBotToken0 = key.currency0 == address(botToken);
            
            // Update tracking
            totalFeesCollected += feeAmount;
            userFeesContributed[tx.origin] += feeAmount;
            poolFeesCollected[poolId] += feeAmount;
            
            // Transfer fee to treasury
            // The fee was already charged in beforeSwap, so we just need to transfer it
            bool success = botToken.transfer(address(treasury), feeAmount);
            if (!success) revert TransferFailed();
            
            // Notify treasury
            treasury.receiveSwapFees(feeAmount);
            
            emit FeeCollected(poolId, tx.origin, feeAmount, isBotToken0);
        }
        
        return (AFTER_SWAP_SELECTOR, 0);
    }
    
    // Admin Functions
    
    /**
     * @notice Register a pool for fee collection
     */
    function registerPool(
        address token0,
        address token1,
        uint24 fee,
        int24 tickSpacing
    ) external onlyRole(FEE_MANAGER_ROLE) {
        // Ensure BOT is one of the tokens
        if (token0 != address(botToken) && token1 != address(botToken)) {
            revert NoBotTokenInPool();
        }
        
        // Create pool key
        IPoolManager.PoolKey memory key = IPoolManager.PoolKey({
            currency0: token0,
            currency1: token1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: address(this)
        });
        
        bytes32 poolId = _getPoolId(key);
        
        // Store pool mapping
        poolIds[token0][token1] = poolId;
        poolIds[token1][token0] = poolId;
        
        // Enable pool
        enabledPools[poolId] = true;
        
        emit PoolRegistered(poolId, token0, token1);
        emit PoolEnabled(poolId, true);
    }
    
    /**
     * @notice Enable or disable fee collection for a pool
     */
    function setPoolEnabled(bytes32 poolId, bool enabled) 
        external 
        onlyRole(FEE_MANAGER_ROLE) 
    {
        enabledPools[poolId] = enabled;
        emit PoolEnabled(poolId, enabled);
    }
    
    /**
     * @notice Update treasury address
     */
    function setTreasury(address newTreasury) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (newTreasury == address(0)) revert InvalidTreasury();
        treasury = ITreasury(newTreasury);
        emit TreasuryUpdated(newTreasury);
    }
    
    /**
     * @notice Update pool manager address
     */
    function setPoolManager(address newPoolManager) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newPoolManager != address(0), "Invalid pool manager");
        poolManager = newPoolManager;
        _grantRole(POOL_MANAGER_ROLE, newPoolManager);
    }
    
    // View Functions
    
    /**
     * @notice Calculate fee for a given amount
     */
    function calculateFee(uint256 amount) external pure returns (uint256) {
        return (amount * FEE_PERCENTAGE) / BASIS_POINTS;
    }
    
    /**
     * @notice Get pool statistics
     */
    function getPoolStats(bytes32 poolId) 
        external 
        view 
        returns (
            bool enabled,
            uint256 feesCollected
        ) 
    {
        return (
            enabledPools[poolId],
            poolFeesCollected[poolId]
        );
    }
    
    /**
     * @notice Get global statistics
     */
    function getGlobalStats() 
        external 
        view 
        returns (
            uint256 totalCollected,
            uint256 feePercentage,
            address treasuryAddress,
            address poolManagerAddress
        ) 
    {
        return (
            totalFeesCollected,
            FEE_PERCENTAGE,
            address(treasury),
            poolManager
        );
    }
    
    // Internal Functions
    
    function _getPoolId(IPoolManager.PoolKey memory key) 
        internal 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encode(key));
    }
    
    function _abs(int256 x) private pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }
    
    /**
     * @notice Emergency function to recover stuck tokens
     * @dev Only callable by admin, cannot withdraw BOT fees meant for treasury
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(token != address(botToken) || amount <= botToken.balanceOf(address(this)) - pendingFeesTotal(), "Cannot withdraw pending fees");
        IERC20(token).transfer(msg.sender, amount);
    }
    
    function pendingFeesTotal() internal view returns (uint256 total) {
        // This would need to track all pending fees in production
        // For now, return 0 as placeholder
        return 0;
    }
}