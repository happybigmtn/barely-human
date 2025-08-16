// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Uniswap V4 Hook Interfaces (simplified for now, full implementation requires v4-core)
interface IPoolManager {
    struct SwapParams {
        address zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
}

interface IHooks {
    function beforeSwap(
        address sender,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external returns (bytes4, int256);
    
    function afterSwap(
        address sender,
        IPoolManager.SwapParams calldata params,
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata hookData
    ) external returns (bytes4);
}

interface ITreasury {
    function receiveSwapFees(uint256 amount) external;
}

/**
 * @title BotSwapFeeHook
 * @notice Uniswap V4 hook that takes 2% fee on BOT token swaps
 * @dev Fees are sent to the Treasury for distribution
 */
contract BotSwapFeeHook is IHooks, AccessControl {
    // Constants
    uint256 public constant FEE_PERCENTAGE = 200; // 2% = 200 basis points
    uint256 public constant BASIS_POINTS = 10000;
    bytes4 public constant BEFORE_SWAP_RETURNS = bytes4(keccak256("beforeSwap"));
    bytes4 public constant AFTER_SWAP_RETURNS = bytes4(keccak256("afterSwap"));
    
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
    
    // Pool configuration
    mapping(address => bool) public enabledPools;
    
    // Events
    event FeeCollected(
        address indexed pool,
        address indexed trader,
        uint256 amount
    );
    event TreasuryUpdated(address indexed newTreasury);
    event PoolEnabled(address indexed pool, bool enabled);
    event FeePercentageUpdated(uint256 newPercentage);
    
    // Errors
    error PoolNotEnabled();
    error InvalidTreasury();
    error UnauthorizedCaller();
    error TransferFailed();
    
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
     * @notice Hook called before swap execution
     * @dev Calculate and reserve fee amount
     */
    function beforeSwap(
        address sender,
        IPoolManager.SwapParams calldata params,
        bytes calldata /* hookData */
    ) external override returns (bytes4, int256 feeAmount) {
        // Only pool manager can call
        if (msg.sender != poolManager) revert UnauthorizedCaller();
        
        // Check if pool is enabled for fees
        if (!enabledPools[sender]) {
            return (BEFORE_SWAP_RETURNS, 0);
        }
        
        // Calculate fee based on swap amount
        uint256 swapAmount = _abs(params.amountSpecified);
        feeAmount = int256((swapAmount * FEE_PERCENTAGE) / BASIS_POINTS);
        
        // Return selector and fee amount
        return (BEFORE_SWAP_RETURNS, feeAmount);
    }
    
    /**
     * @notice Hook called after swap execution
     * @dev Collect the fee and send to treasury
     */
    function afterSwap(
        address sender,
        IPoolManager.SwapParams calldata /* params */,
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata /* hookData */
    ) external override returns (bytes4) {
        // Only pool manager can call
        if (msg.sender != poolManager) revert UnauthorizedCaller();
        
        // Check if pool is enabled
        if (!enabledPools[sender]) {
            return AFTER_SWAP_RETURNS;
        }
        
        // Determine which token is BOT and collect fee
        uint256 feeAmount;
        
        // If token0 is BOT and was bought (negative delta)
        if (amount0Delta < 0) {
            feeAmount = uint256(-amount0Delta) * FEE_PERCENTAGE / BASIS_POINTS;
        }
        // If token1 is BOT and was bought (negative delta)  
        else if (amount1Delta < 0) {
            feeAmount = uint256(-amount1Delta) * FEE_PERCENTAGE / BASIS_POINTS;
        }
        
        if (feeAmount > 0) {
            // Transfer fee from pool to this contract
            bool success = botToken.transferFrom(sender, address(this), feeAmount);
            if (!success) revert TransferFailed();
            
            // Update tracking
            totalFeesCollected += feeAmount;
            userFeesContributed[tx.origin] += feeAmount;
            
            // Send to treasury
            botToken.approve(address(treasury), feeAmount);
            treasury.receiveSwapFees(feeAmount);
            
            emit FeeCollected(sender, tx.origin, feeAmount);
        }
        
        return AFTER_SWAP_RETURNS;
    }
    
    // Admin Functions
    
    /**
     * @notice Enable or disable fee collection for a pool
     */
    function setPoolEnabled(address pool, bool enabled) 
        external 
        onlyRole(FEE_MANAGER_ROLE) 
    {
        enabledPools[pool] = enabled;
        emit PoolEnabled(pool, enabled);
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
     * @notice Get hook permissions (which functions this hook implements)
     * @dev Required by Uniswap V4
     */
    function getHookPermissions() 
        external 
        pure 
        returns (
            bool beforeInitialize,
            bool afterInitialize,
            bool beforeAddLiquidity,
            bool afterAddLiquidity,
            bool beforeRemoveLiquidity,
            bool afterRemoveLiquidity,
            bool beforeSwapEnabled,
            bool afterSwapEnabled,
            bool beforeDonate,
            bool afterDonate
        ) 
    {
        return (
            false, // beforeInitialize
            false, // afterInitialize
            false, // beforeAddLiquidity
            false, // afterAddLiquidity
            false, // beforeRemoveLiquidity
            false, // afterRemoveLiquidity
            true,  // beforeSwap - WE USE THIS
            true,  // afterSwap - WE USE THIS
            false, // beforeDonate
            false  // afterDonate
        );
    }
    
    // View Functions
    
    /**
     * @notice Calculate fee for a given amount
     */
    function calculateFee(uint256 amount) external pure returns (uint256) {
        return (amount * FEE_PERCENTAGE) / BASIS_POINTS;
    }
    
    /**
     * @notice Get total stats
     */
    function getStats() 
        external 
        view 
        returns (
            uint256 collected,
            uint256 feePercentage,
            address treasuryAddress
        ) 
    {
        return (
            totalFeesCollected,
            FEE_PERCENTAGE,
            address(treasury)
        );
    }
    
    // Utility Functions
    
    function _abs(int256 x) private pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }
}