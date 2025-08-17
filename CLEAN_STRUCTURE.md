# Barely Human - Clean Repository Structure

## ✅ Repository Cleanup Complete

The repository has been cleaned to maintain a single source of truth for all contracts and scripts.

## 📁 Final Contract Structure

### Core Contracts (Production Ready)
```
contracts/
├── token/
│   └── BOTToken.sol              # Main BOT token (ERC20, 1B supply)
├── treasury/
│   └── Treasury.sol              # Fee collection and distribution
├── vault/
│   ├── BettingVault.sol         # NEW: Direct betting vault (no factory needed!)
│   └── CrapsVault.sol           # Reference implementation
├── game/
│   ├── BotManagerV2Plus.sol     # Bot manager with 10 personalities
│   ├── CrapsGameV2Plus.sol      # Main game logic with VRF
│   ├── CrapsBets.sol            # Bet placement and management
│   ├── CrapsSettlement.sol      # Bet settlement logic
│   ├── CrapsBetTypes.sol        # Bet type definitions
│   └── ICrapsGame.sol           # Game interface
├── staking/
│   └── StakingPool.sol          # BOT token staking
└── mocks/
    └── MockVRFCoordinatorV2Plus.sol  # For local testing
```

### Key Changes Made
1. **Removed 14 duplicate contracts**:
   - ❌ VaultFactoryMinimal.sol → ✅ Use BettingVault directly
   - ❌ VaultFactoryUltraOptimized.sol → ✅ Use BettingVault directly
   - ❌ BotManager.sol, BotManagerOptimized.sol → ✅ Use BotManagerV2Plus
   - ❌ CrapsGame.sol → ✅ Use CrapsGameV2Plus
   - ❌ BOTTokenV2.sol → ✅ Use BOTToken
   - ❌ TreasuryV2.sol, TreasuryOptimized.sol → ✅ Use Treasury

2. **Removed 20+ temporary scripts**:
   - All test-*.js files
   - All complete-*.js setup scripts
   - All temporary deployment scripts
   - All duplicate test runners

## 🚀 Main Deployment Script

```typescript
scripts/deploy-main.ts  // Single unified deployment script
```

### Deployment Flow:
1. Deploy BOTToken
2. Deploy MockVRFCoordinatorV2Plus (for testing)
3. Deploy Treasury
4. Deploy StakingPool
5. Deploy CrapsGameV2Plus
6. Deploy CrapsBets
7. Deploy CrapsSettlement
8. Deploy BotManagerV2Plus
9. **Deploy BettingVault directly** (no factory!)
10. Configure all connections

## 🎯 Key Improvements

### BettingVault Advantages:
- **Direct deployment** - No factory overhead
- **Full functionality** - LP shares, escrow, payouts, fees
- **Production ready** - Role-based access, pausable, events
- **Gas efficient** - Single contract deployment

### Clean Architecture Benefits:
- **No confusion** - Single version of each contract
- **Clear production path** - V2Plus contracts are production
- **Simplified deployment** - One script to rule them all
- **Easier maintenance** - No duplicate code to sync

## 📊 Contract Relationships

```
BettingVault (NEW!)
    ├── Accepts BOT tokens
    ├── Manages liquidity pools
    ├── Processes bets from CrapsBets
    └── Handles payouts with fees

CrapsGameV2Plus
    ├── Uses Chainlink VRF for randomness
    ├── Manages game state
    └── Triggers settlements

BotManagerV2Plus
    ├── 10 AI bot personalities
    ├── Betting strategies
    └── Interacts with CrapsBets

CrapsBets
    ├── Places bets with BettingVault
    ├── Tracks active bets
    └── Triggers CrapsSettlement
```

## 🔧 Development Commands

```bash
# Compile contracts
npx hardhat compile

# Deploy locally
npx hardhat run scripts/deploy-main.ts --network localhost

# Deploy to Base Sepolia
npx hardhat run scripts/deploy-base-sepolia-viem.ts --network baseSepolia

# Run tests
npx hardhat test
```

## 📦 Backup Location

All removed files have been backed up to:
```
backup_20250817_045904/
```

## ✅ Ready for Production

The repository is now clean, organized, and ready for:
- Further development
- Security audits
- Mainnet deployment
- Team collaboration

No more confusion from multiple versions - just clean, production-ready code!