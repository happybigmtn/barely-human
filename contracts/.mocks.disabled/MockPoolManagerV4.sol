// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockPoolManagerV4
 * @notice Mock Uniswap V4 Pool Manager for testing hooks
 * @dev Simulates pool operations and hook calls for testing
 */
contract MockPoolManagerV4 is IPoolManager {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    
    // Pool state tracking
    mapping(PoolId => bool) public poolExists;
    mapping(PoolId => PoolKey) public poolKeys;
    mapping(PoolId => uint128) public poolLiquidity;
    mapping(PoolId => address) public poolHooks;
    
    // Token balances in pools
    mapping(PoolId => mapping(Currency => uint256)) public poolBalances;
    
    // Events  
    event PoolInitialized(PoolId indexed poolId, PoolKey poolKey);
    event SwapExecuted(
        PoolId indexed poolId,
        address indexed swapper,
        int256 amount0Delta,
        int256 amount1Delta
    );
    event HookCalled(address indexed hook, bytes4 selector, bool success);
    
    /**
     * @notice Initialize a new pool
     * @param key The pool key
     * @param sqrtPriceX96 The initial sqrt price (ignored in mock)
     * @return tick The initial tick (mocked)
     */
    function initialize(
        PoolKey memory key,
        uint160 sqrtPriceX96
    ) external override returns (int24 tick) {
        PoolId poolId = key.toId();
        require(!poolExists[poolId], "Pool already exists");
        
        poolExists[poolId] = true;
        poolKeys[poolId] = key;
        poolHooks[poolId] = address(key.hooks);
        
        // Mock initial liquidity
        poolLiquidity[poolId] = 1000000;
        poolBalances[poolId][key.currency0] = 1000000;
        poolBalances[poolId][key.currency1] = 1000000;
        
        // Call afterInitialize hook if present
        if (address(key.hooks) != address(0)) {
            try IHooks(address(key.hooks)).afterInitialize(
                msg.sender,
                key,
                sqrtPriceX96,
                0 // mock tick
            ) returns (bytes4 selector) {
                emit HookCalled(address(key.hooks), selector, true);
            } catch {
                emit HookCalled(address(key.hooks), IHooks.afterInitialize.selector, false);
            }
        }
        
        emit PoolInitialized(poolId, key);
        return 0; // Mock tick
    }
    
    /**
     * @notice Execute a swap
     * @param key The pool key
     * @param params Swap parameters
     * @param hookData Additional data for hooks
     * @return swapDelta The resulting balance changes
     */
    function swap(
        PoolKey memory key,
        IPoolManager.SwapParams memory params,
        bytes calldata hookData
    ) external override returns (BalanceDelta swapDelta) {
        PoolId poolId = key.toId();
        require(poolExists[poolId], "Pool does not exist");
        
        // Calculate mock swap amounts
        uint256 amountIn = params.zeroForOne ? 
            uint256(params.amountSpecified) : 
            uint256(-params.amountSpecified);
            
        // Mock 1:1 swap ratio for simplicity
        uint256 amountOut = amountIn;
        
        int128 amount0Delta;
        int128 amount1Delta;
        
        if (params.zeroForOne) {
            // Selling currency0 for currency1
            amount0Delta = int128(int256(amountIn));   // Positive = tokens out of user
            amount1Delta = -int128(int256(amountOut)); // Negative = tokens to user
        } else {
            // Selling currency1 for currency0  
            amount0Delta = -int128(int256(amountOut)); // Negative = tokens to user
            amount1Delta = int128(int256(amountIn));   // Positive = tokens out of user
        }
        
        // Create the delta
        swapDelta = toBalanceDelta(amount0Delta, amount1Delta);
        
        // Call beforeSwap hook if present
        BeforeSwapDelta beforeDelta = BeforeSwapDeltaLibrary.ZERO_DELTA;
        if (address(key.hooks) != address(0)) {
            try IHooks(address(key.hooks)).beforeSwap(
                msg.sender,
                key,
                params,
                hookData
            ) returns (bytes4 selector, BeforeSwapDelta delta, uint24) {
                beforeDelta = delta;
                emit HookCalled(address(key.hooks), selector, true);
            } catch {
                emit HookCalled(address(key.hooks), IHooks.beforeSwap.selector, false);
            }
        }
        
        // Apply hook delta to swap delta
        if (!BeforeSwapDeltaLibrary.isZero(beforeDelta)) {
            // Extract before swap delta amounts
            int128 beforeAmount0 = extractAmount0(beforeDelta);
            int128 beforeAmount1 = extractAmount1(beforeDelta);
            
            // Apply to swap delta
            amount0Delta += beforeAmount0;
            amount1Delta += beforeAmount1;
            swapDelta = toBalanceDelta(amount0Delta, amount1Delta);
        }
        
        // Update pool balances
        Currency currency0 = key.currency0;
        Currency currency1 = key.currency1;
        
        if (amount0Delta > 0) {
            // Transfer from user to pool
            poolBalances[poolId][currency0] += uint256(uint128(amount0Delta));
            if (!Currency.isAddressZero(currency0)) {
                IERC20(Currency.unwrap(currency0)).transferFrom(
                    msg.sender, 
                    address(this), 
                    uint256(uint128(amount0Delta))
                );
            }
        } else if (amount0Delta < 0) {
            // Transfer from pool to user  
            poolBalances[poolId][currency0] -= uint256(uint128(-amount0Delta));
            if (!Currency.isAddressZero(currency0)) {
                IERC20(Currency.unwrap(currency0)).transfer(
                    msg.sender, 
                    uint256(uint128(-amount0Delta))
                );
            }
        }
        
        if (amount1Delta > 0) {
            // Transfer from user to pool
            poolBalances[poolId][currency1] += uint256(uint128(amount1Delta));
            if (!Currency.isAddressZero(currency1)) {
                IERC20(Currency.unwrap(currency1)).transferFrom(
                    msg.sender, 
                    address(this), 
                    uint256(uint128(amount1Delta))
                );
            }
        } else if (amount1Delta < 0) {
            // Transfer from pool to user
            poolBalances[poolId][currency1] -= uint256(uint128(-amount1Delta));
            if (!Currency.isAddressZero(currency1)) {
                IERC20(Currency.unwrap(currency1)).transfer(
                    msg.sender, 
                    uint256(uint128(-amount1Delta))
                );
            }
        }
        
        // Call afterSwap hook if present
        if (address(key.hooks) != address(0)) {
            try IHooks(address(key.hooks)).afterSwap(
                msg.sender,
                key,
                params,
                swapDelta,
                hookData
            ) returns (bytes4 selector, int128) {
                emit HookCalled(address(key.hooks), selector, true);
            } catch {
                emit HookCalled(address(key.hooks), IHooks.afterSwap.selector, false);
            }
        }
        
        emit SwapExecuted(poolId, msg.sender, amount0Delta, amount1Delta);
        return swapDelta;
    }
    
    /**
     * @notice Helper to create BalanceDelta
     */
    function toBalanceDelta(int128 amount0, int128 amount1) internal pure returns (BalanceDelta) {
        return BalanceDelta.wrap(int256((int256(amount0) << 128) | int256(uint256(uint128(amount1)))));
    }
    
    /**
     * @notice Extract amount0 from BeforeSwapDelta
     */
    function extractAmount0(BeforeSwapDelta delta) internal pure returns (int128) {
        return int128(BeforeSwapDelta.unwrap(delta) >> 128);
    }
    
    /**
     * @notice Extract amount1 from BeforeSwapDelta  
     */
    function extractAmount1(BeforeSwapDelta delta) internal pure returns (int128) {
        return int128(BeforeSwapDelta.unwrap(delta));
    }
    
    // Mock implementations for other IPoolManager functions
    function modifyLiquidity(
        PoolKey memory,
        IPoolManager.ModifyLiquidityParams memory,
        bytes calldata
    ) external pure override returns (BalanceDelta, BalanceDelta) {
        revert("ModifyLiquidity not implemented in mock");
    }
    
    function donate(
        PoolKey memory,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (BalanceDelta) {
        revert("Donate not implemented in mock");
    }
    
    function sync(Currency) external pure override {
        revert("Sync not implemented in mock");
    }
    
    function take(Currency, address, uint256) external pure override {
        revert("Take not implemented in mock");
    }
    
    function settle() external pure override returns (uint256) {
        revert("Settle not implemented in mock");
    }
    
    function settleFor(address) external pure override returns (uint256) {
        revert("SettleFor not implemented in mock");
    }
    
    function clear(Currency, uint256) external pure override {
        revert("Clear not implemented in mock");
    }
    
    function mint(address, uint256, uint256) external pure override {
        revert("Mint not implemented in mock");
    }
    
    function burn(address, uint256, uint256) external pure override {
        revert("Burn not implemented in mock");
    }
    
    function updateDynamicLPFee(PoolKey memory, uint24) external pure override {
        revert("UpdateDynamicLPFee not implemented in mock");
    }
    
    // View functions
    function getLiquidity(PoolId poolId) external view override returns (uint128) {
        return poolLiquidity[poolId];
    }
    
    function getLiquidity(PoolId, address, int24, int24, bytes32) 
        external 
        pure 
        override 
        returns (uint128) 
    {
        return 0;
    }
    
    function getPosition(PoolId, address, int24, int24, bytes32) 
        external 
        pure 
        override 
        returns (Position memory) 
    {
        return Position({liquidity: 0, feeGrowthInside0LastX128: 0, feeGrowthInside1LastX128: 0});
    }
    
    function getSlot0(PoolId) external pure override returns (Slot0 memory) {
        return Slot0({
            sqrtPriceX96: 0,
            tick: 0,
            protocolFee: 0,
            lpFee: 0
        });
    }
    
    function currencyDelta(address, Currency) external pure override returns (int256) {
        return 0;
    }
    
    function reservesOf(Currency) external pure override returns (uint256) {
        return 0;
    }
    
    function isUnlocked() external pure override returns (bool) {
        return true;
    }
    
    function getNonzeroDeltaCount() external pure override returns (uint256) {
        return 0;
    }
}