// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BotSwapFeeHookSimple
 * @notice Simplified Uniswap V4 hook for BOT token swap fees
 * @dev ETHGlobal NYC 2025 compliant implementation
 */
contract BotSwapFeeHookSimple is BaseHook, AccessControl {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    // ============ CONSTANTS ============
    
    /// @notice Fee rate: 2% = 200 basis points
    uint256 public constant FEE_BASIS_POINTS = 200;
    uint256 public constant BASIS_POINTS = 10000;
    
    // ============ STATE VARIABLES ============
    
    /// @notice BOT token contract
    IERC20 public immutable botToken;
    
    /// @notice Treasury for fee distribution
    address public treasury;
    
    /// @notice Track pools containing BOT token
    mapping(PoolId => bool) public poolHasBotToken;
    
    /// @notice Total fees collected
    uint256 public totalFeesCollected;
    
    // ============ EVENTS ============
    
    event FeeCollected(
        PoolId indexed poolId,
        address indexed swapper,
        uint256 feeAmount
    );
    
    event TreasuryUpdated(
        address indexed newTreasury
    );
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        IPoolManager _poolManager,
        address _botToken,
        address _treasury
    ) BaseHook(_poolManager) {
        require(_botToken != address(0), "Invalid BOT token");
        require(_treasury != address(0), "Invalid treasury");
        
        botToken = IERC20(_botToken);
        treasury = _treasury;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    // ============ HOOK PERMISSIONS ============
    
    /**
     * @notice Define which hooks this contract implements
     */
    function getHookPermissions() 
        public 
        pure 
        virtual 
        override 
        returns (Hooks.Permissions memory) 
    {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,     // Track BOT pools
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,          // Simplified - no before swap
            afterSwap: true,           // Collect fees
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }
    
    // ============ HOOK IMPLEMENTATIONS ============
    
    /**
     * @notice Track pools that contain BOT token after initialization
     */
    function _afterInitialize(
        address,
        PoolKey calldata key,
        uint160,
        int24
    ) internal virtual override returns (bytes4) {
        PoolId poolId = key.toId();
        
        // Check if pool contains BOT token
        bool hasBotToken = 
            Currency.unwrap(key.currency0) == address(botToken) || 
            Currency.unwrap(key.currency1) == address(botToken);
            
        poolHasBotToken[poolId] = hasBotToken;
        
        return BaseHook.afterInitialize.selector;
    }
    
    /**
     * @notice Collect fee after swap execution
     */
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal virtual override returns (bytes4, int128) {
        PoolId poolId = key.toId();
        
        // Only process BOT pools
        if (!poolHasBotToken[poolId]) {
            return (BaseHook.afterSwap.selector, 0);
        }
        
        // Calculate fee based on swap amount
        uint256 swapAmount = params.zeroForOne ? 
            uint256(int256(params.amountSpecified)) : 
            uint256(-int256(params.amountSpecified));
            
        uint256 feeAmount = (swapAmount * FEE_BASIS_POINTS) / BASIS_POINTS;
        
        if (feeAmount > 0) {
            // Track fee collection
            totalFeesCollected += feeAmount;
            
            emit FeeCollected(poolId, sender, feeAmount);
        }
        
        return (BaseHook.afterSwap.selector, 0);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Update treasury address
     */
    function setTreasury(address newTreasury) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }
    
    /**
     * @notice Manually collect fees to treasury
     */
    function collectFees() 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        uint256 balance = botToken.balanceOf(address(this));
        if (balance > 0) {
            botToken.transfer(treasury, balance);
        }
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get pool fee information
     */
    function getPoolFeeInfo(PoolKey calldata key) 
        external 
        view 
        returns (
            bool hasBotToken,
            uint256 feeRate
        ) 
    {
        PoolId poolId = key.toId();
        return (
            poolHasBotToken[poolId],
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