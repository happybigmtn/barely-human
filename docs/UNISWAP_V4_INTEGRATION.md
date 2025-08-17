# Uniswap V4 Hook Integration Guide

## Overview
This guide explains the Barely Human Casino's integration with Uniswap V4 on Base Sepolia, including our custom hook that collects a 2% fee on BOT token swaps.

## Architecture

### Hook Contract: `BotSwapFeeHookV4Updated`
Our hook implements the following Uniswap V4 hooks:
- `beforeSwap`: Calculates and applies the 2% fee
- `afterSwap`: Transfers collected fees to the Treasury
- `beforeSwapReturnDelta`: Modifies swap amounts to account for fees

### Key Features
- **2% Fee Collection**: Automatically collected on all BOT token swaps
- **Treasury Integration**: Fees are sent directly to the Treasury contract
- **Pool-Specific Control**: Can enable/disable fee collection per pool
- **Access Control**: Role-based permissions for management
- **Statistics Tracking**: Monitors total fees and per-pool collections

## Base Sepolia Deployment

### Network Details
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Block Explorer**: https://sepolia.basescan.org

### Uniswap V4 Contracts on Base Sepolia
| Contract | Address |
|----------|---------|
| PoolManager | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |
| Universal Router | `0x492e6456d9528771018deb9e87ef7750ef184104` |
| Position Manager | `0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80` |
| State View | `0x571291b572ed32ce6751a2cb2486ebee8defb9b4` |
| Quoter | `0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

## Deployment Instructions

### Prerequisites
1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Add your private key and RPC URL to .env
   ```

2. **Install Dependencies**
   ```bash
   npm install
   npm install @uniswap/v4-core @uniswap/v4-periphery
   ```

3. **Fund Deployer Wallet**
   - Get Base Sepolia ETH from faucet
   - Ensure sufficient balance for deployment (~0.1 ETH)

### Deployment Steps

1. **Deploy Core Contracts** (if not already deployed)
   ```bash
   npm run deploy:base-sepolia
   ```

2. **Deploy Uniswap V4 Hook**
   ```bash
   npm run deploy:uniswap-hook
   ```

3. **Verify Contracts**
   ```bash
   npx hardhat verify --network baseSepolia <HOOK_ADDRESS> \
     <POOL_MANAGER> <BOT_TOKEN> <TREASURY>
   ```

## Hook Implementation Details

### Hook Permissions
The hook must declare which functions it implements:
```solidity
function getHookPermissions() returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        beforeSwap: true,
        afterSwap: true,
        beforeSwapReturnDelta: true,
        // ... other permissions false
    });
}
```

### Fee Calculation
```solidity
uint256 feeAmount = (swapAmount * 200) / 10000; // 2% fee
```

### Pool Key Structure
```solidity
struct PoolKey {
    Currency currency0;    // ETH or token address
    Currency currency1;    // BOT token address
    uint24 fee;           // 3000 = 0.3%
    int24 tickSpacing;    // 60 for 0.3% fee tier
    IHooks hooks;         // Our hook contract address
}
```

## Usage Examples

### Creating a BOT/ETH Pool
```typescript
const poolKey = {
    currency0: "0x0000000000000000000000000000000000000000", // ETH
    currency1: botTokenAddress,
    fee: 3000, // 0.3%
    tickSpacing: 60,
    hooks: hookAddress
};

await poolManager.initialize(poolKey, sqrtPriceX96, "0x");
```

### Enabling Fee Collection
```typescript
await hookContract.setPoolEnabled(poolKey, true);
```

### Performing a Swap
```typescript
const swapParams = {
    zeroForOne: true, // Swap ETH for BOT
    amountSpecified: parseEther("1"),
    sqrtPriceLimitX96: 0 // No price limit
};

await universalRouter.swap(poolKey, swapParams, "0x");
```

## Testing

### Local Testing
```bash
# Run hook tests
npx hardhat run test/BotSwapFeeHookV4.test.ts

# Test with local fork
npx hardhat node --fork https://sepolia.base.org
npm test
```

### Base Sepolia Testing
1. Deploy contracts to testnet
2. Add liquidity through Position Manager
3. Execute test swaps through Universal Router
4. Monitor fee collection in Treasury

## Fee Flow

1. **User initiates swap** involving BOT tokens
2. **beforeSwap hook** calculates 2% fee
3. **Fee is deducted** from swap amount
4. **Swap executes** with adjusted amounts
5. **afterSwap hook** transfers fee to Treasury
6. **Treasury distributes** fees to stakers

## Security Considerations

### Access Control
- `DEFAULT_ADMIN_ROLE`: Can update treasury and critical settings
- `FEE_MANAGER_ROLE`: Can enable/disable pools
- `onlyPoolManager`: Ensures only PoolManager can call hooks

### Reentrancy Protection
- Uses OpenZeppelin's ReentrancyGuard
- Critical functions are protected

### Fee Limits
- Fixed 2% fee prevents manipulation
- Cannot exceed defined maximum

## Monitoring & Analytics

### Track Fee Collection
```typescript
const totalFees = await hookContract.totalFeesCollected();
const poolFees = await hookContract.poolFeesCollected(poolId);
const userContribution = await hookContract.userFeesContributed(userAddress);
```

### Get Pool Statistics
```typescript
const stats = await hookContract.getPoolStats(poolKey);
console.log("Enabled:", stats.enabled);
console.log("Fees Collected:", stats.feesCollected);
```

## Troubleshooting

### Common Issues

1. **Hook Address Pattern**
   - Hooks must be deployed at specific addresses with flag bits
   - Use CREATE2 for deterministic deployment

2. **Pool Not Enabled**
   - Ensure `setPoolEnabled()` is called after pool creation
   - Verify BOT token is in the pool

3. **Fee Not Collected**
   - Check hook is properly registered with pool
   - Verify treasury contract is set correctly

4. **Gas Issues**
   - Hook operations add ~50-100k gas to swaps
   - Ensure sufficient gas limits

## Future Enhancements

1. **Dynamic Fee Rates**: Adjust fees based on volume or market conditions
2. **Fee Rebates**: Reward high-volume traders
3. **Multi-Pool Support**: Expand beyond BOT/ETH pairs
4. **Cross-Chain Hooks**: Deploy on multiple chains
5. **MEV Protection**: Implement anti-sandwich mechanisms

## Resources

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [Hook Development Guide](https://docs.uniswap.org/contracts/v4/guides/hooks/hook-development)
- [Base Sepolia Faucet](https://docs.base.org/tools/network-faucets)
- [BaseScan Testnet](https://sepolia.basescan.org)

## Support

For issues or questions:
- GitHub: [barely-human/issues](https://github.com/barely-human/issues)
- Discord: [Join our server](https://discord.gg/barely-human)
- Documentation: [Full Blueprint](./FULL_BLUEPRINT.md)