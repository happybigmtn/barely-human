# Barely Human Vault System

## Overview

The vault system implements ERC4626-compliant vaults for managing bot bankrolls in the Barely Human craps game. Each of the 10 AI bots has its own vault where LPs can deposit funds to back that bot's gambling activities.

## Contracts

### CrapsVault.sol

An ERC4626-compliant vault that manages LP deposits and bot bankrolls:

**Key Features:**
- **ERC4626 Compliance**: Standard vault interface for deposits/withdrawals
- **Bet Locking**: Locks funds when bets are placed, preventing withdrawals of active bet amounts
- **Performance Fees**: Automatically extracts 2% fee on profits
- **LP Tracking**: Maintains list of LPs for raffle participation
- **Weighted Selection**: Supports fair raffle selection based on LP share weights

**Core Functions:**
- `deposit()/mint()`: Add liquidity to the vault
- `withdraw()/redeem()`: Remove liquidity (blocked if funds are locked in bets)
- `placeBet()`: Lock funds for an active bet (game contract only)
- `settleBet()`: Settle a bet and update vault balance
- `findShareHolderByWeight()`: Select LP for raffle based on weight

### VaultFactory.sol

Factory contract for deploying and managing all bot vaults:

**Key Features:**
- **Vault Deployment**: Creates vaults for each of the 10 bots
- **Bot Configuration**: Stores personality traits and betting parameters
- **Centralized Management**: Tracks all vaults and provides aggregate statistics
- **Role Management**: Configures access controls across all vaults

**Bot Personalities:**
1. **Lucky** - Optimistic, believes in streaks (30% aggressive)
2. **Dice Devil** - High-risk aggressive player (90% aggressive)
3. **Risk Taker** - Strategic risk-taker (70% aggressive)
4. **Calculator** - Mathematical, focuses on odds (40% aggressive)
5. **Zen Master** - Patient and calm (20% aggressive)
6. **Hot Shot** - Confident on hot streaks (85% aggressive)
7. **Cool Hand** - Smart under pressure (50% aggressive)
8. **Wild Card** - Unpredictable chaos (95% aggressive)
9. **Steady Eddie** - Conservative approach (15% aggressive)
10. **Maverick** - Unconventional strategies (75% aggressive)

### BotManager.sol

Manages automated betting behavior for all bots:

**Key Features:**
- **Strategy System**: 10 different betting strategies (Martingale, Fibonacci, etc.)
- **Personality-Driven Decisions**: Betting decisions based on bot traits
- **Adaptive Behavior**: Bots adjust confidence and strategy based on results
- **VRF Integration**: Uses Chainlink VRF for random decision elements
- **Session Management**: Tracks bot performance across betting sessions

**Betting Strategies:**
- `CONSERVATIVE`: Low risk, small bets
- `AGGRESSIVE`: High risk, large bets
- `MARTINGALE`: Double after losses
- `FIBONACCI`: Fibonacci sequence progression
- `PAROLI`: Positive progression on wins
- `DALEMBERT`: Gradual increase/decrease
- `OSCAR_GRIND`: Target small consistent profits
- `RANDOM`: VRF-based random amounts
- `ADAPTIVE`: Adjusts based on performance
- `MIXED`: Switches strategies dynamically

## Integration Points

### With CrapsGame Contract
- Vaults provide funding for bets
- Game contract calls `placeBet()` and `settleBet()`
- Bet amounts locked during active games

### With Raffle System
- LP holders automatically entered in NFT raffles
- Weight-based selection using vault shares
- Winners selected via Chainlink VRF

### With Treasury
- Performance fees sent to treasury
- Treasury distributes to BOT stakers

## Security Features

1. **Access Control**: Role-based permissions for all critical functions
2. **Reentrancy Protection**: Guards against reentrancy attacks
3. **Pausable**: Emergency pause functionality
4. **Bet Locking**: Prevents withdrawal of funds in active bets
5. **Input Validation**: Comprehensive checks on all inputs

## Usage Example

```javascript
// Deploy factory
const factory = await VaultFactory.deploy(usdcAddress, treasuryAddress);

// Deploy all bot vaults
await factory.deployAllBots();

// Get a specific vault
const vaultAddress = await factory.getVault(0); // Lucky's vault
const vault = await ethers.getContractAt("CrapsVault", vaultAddress);

// LP deposits funds
await usdc.approve(vault.address, amount);
await vault.deposit(amount, lpAddress);

// Bot places bet (via game contract)
const betId = await vault.placeBet(betAmount, seriesId);

// Settle bet after game
await vault.settleBet(betId, payout);

// LP withdraws (if no active bets)
await vault.withdraw(assets, receiver, owner);
```

## Deployment

Use the provided deployment script:
```bash
npx hardhat run scripts/deploy-vault-system.js --network base
```

## Testing Considerations

1. Test each bot's unique strategy behavior
2. Verify performance fee calculations
3. Test LP raffle selection fairness
4. Ensure bet locking prevents exploits
5. Test emergency pause functionality

## Gas Optimization

- Efficient LP tracking using arrays and mappings
- Batch operations where possible
- Optimized weight calculation for raffles
- Minimal storage updates

## Future Enhancements

1. Dynamic strategy adjustment based on market conditions
2. Cross-bot collaboration strategies
3. Advanced risk management parameters
4. Integration with additional DeFi protocols
5. Bot reputation system based on performance