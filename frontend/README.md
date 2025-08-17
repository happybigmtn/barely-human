# Barely Human Casino - Enhanced Frontend

## 🎰 Complete Smart Contract Interface

The enhanced frontend provides comprehensive access to all 21 deployed smart contracts in the Barely Human DeFi Casino ecosystem.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Deploy contracts (if not already deployed)
npm run deploy:local

# Launch enhanced CLI with all features
npm run cli:enhanced

# Or use the interactive launcher
npm run launch
```

## 📱 Available Interfaces

### 1. Enhanced Casino CLI (`cli:enhanced`)
Complete interface covering all smart contracts:
- 🎲 **Game Center** - Full craps game with all 64 bet types
- 💰 **Vault Management** - LP deposits/withdrawals for 10 bot vaults
- 🏦 **Staking System** - BOT token staking with rewards
- 💎 **Treasury** - Fee collection and distribution
- 🎨 **NFT Gallery** - Mint passes and generative art
- 🤖 **Bot Arena** - Chat and bet on AI personalities
- 🌐 **Cross-Chain Hub** - LayerZero omni operations
- 📊 **Analytics Dashboard** - Comprehensive metrics

### 2. Treasury Manager (`cli:treasury`)
Advanced treasury operations:
- Collect vault performance fees
- Collect Uniswap V4 swap fees
- Trigger fee distribution
- Execute BOT buybacks
- Update distribution percentages
- Emergency withdrawal functions

### 3. Analytics Dashboard (`cli:analytics`)
Real-time metrics and statistics:
- Game performance metrics
- Vault TVL and APY tracking
- Staking rewards and APR
- Treasury fee collection
- Bot performance leaderboard
- Cross-chain liquidity stats

### 4. Bot Arena (`cli:bot-arena`)
AI bot interaction features:
- Chat with 10 unique personalities
- Bet on bot performance
- Head-to-head battles
- Bot statistics and leaderboard
- Strategy analysis

### 5. Cross-Chain Hub (`cli:cross-chain`)
Multi-network operations:
- Bridge BOT tokens
- Cross-chain vault deposits
- Multi-chain statistics
- Vault state synchronization

## 🎮 Features by Contract

### Core Game Contracts
| Contract | Features | CLI Access |
|----------|----------|------------|
| `CrapsGameV2Plus` | 64 bet types, VRF 2.5 | Game Center |
| `BotManager` | 10 AI personalities | Bot Arena |
| `CrapsBets` | Bet placement/tracking | Game Center |
| `CrapsSettlement` | Payout calculations | Automatic |

### Vault & LP System
| Contract | Features | CLI Access |
|----------|----------|------------|
| `VaultFactoryMinimal` | Deploy bot vaults | Vault Management |
| `CrapsVault` | ERC4626 LP shares | Vault Management |
| `BotBettingEscrow` | Bet on bot performance | Bot Arena |

### Token & Rewards
| Contract | Features | CLI Access |
|----------|----------|------------|
| `BOTToken` | ERC20 governance token | All sections |
| `StakingPool` | Stake BOT for rewards | Staking System |
| `Treasury` | Fee distribution | Treasury Manager |

### NFT & Art
| Contract | Features | CLI Access |
|----------|----------|------------|
| `GachaMintPassV2Plus` | Raffle mint passes | NFT Gallery |
| `GenerativeArtNFT` | Bot-themed art | NFT Gallery |

### Cross-Chain
| Contract | Features | CLI Access |
|----------|----------|------------|
| `OmniVaultCoordinator` | LayerZero V2 messaging | Cross-Chain Hub |
| `BotSwapFeeHookV4Final` | Uniswap V4 hooks | Automatic |

## 🛠️ Configuration

### Environment Variables
Create a `.env` file:
```env
# Network Configuration
PRIVATE_KEY=your_private_key
RPC_URL=http://localhost:8545

# API Keys (optional)
OPENAI_API_KEY=your_openai_key
ETHERSCAN_API_KEY=your_etherscan_key

# Contract Addresses (auto-loaded from deployment)
# These are set automatically from deployments/local-deployment.json
```

### Network Support
- **Local Hardhat** - Default development
- **Base Sepolia** - Primary testnet
- **Arbitrum Sepolia** - Cross-chain testing
- **Flow Testnet** - Alternative chain
- **Unichain** - Future deployment

## 📊 Architecture

```
frontend/
├── cli/
│   ├── enhanced-casino-cli.js    # Main enhanced interface
│   ├── interactive-casino-cli.js # AI chat interface
│   ├── simple-casino-cli.js      # Basic game interface
│   └── modules/
│       ├── treasury-manager.js   # Treasury operations
│       ├── vault-manager.js      # Vault operations
│       ├── staking-manager.js    # Staking operations
│       └── analytics-engine.js   # Analytics processing
├── web/                           # Web interface (future)
└── config/
    └── chains.js                  # Network configurations
```

## 🎯 Usage Examples

### Deposit to Bot Vault
```javascript
// Via CLI
npm run cli:enhanced
// Select: Vault Management > Deposit to Vault > Select Bot > Enter Amount

// Programmatically
const vault = vaults[botId];
await vault.deposit(amount, userAddress);
```

### Stake BOT Tokens
```javascript
// Via CLI
npm run cli:enhanced
// Select: Staking > Stake BOT Tokens > Enter Amount

// Programmatically
await stakingPool.stake(amount);
```

### Place Craps Bet
```javascript
// Via CLI
npm run cli:enhanced
// Select: Game Center > Place Bet > Select Type > Enter Amount

// Programmatically
await crapsGame.placeBet(betType, amount, betValue);
```

### Chat with AI Bot
```javascript
// Via CLI
npm run cli:bot-arena
// Select: Chat with Bot > Choose Bot > Type Message

// Programmatically
const response = await botManager.chat(botId, message);
```

## 🔧 Development

### Adding New Features
1. Create module in `frontend/cli/modules/`
2. Import in `enhanced-casino-cli.js`
3. Add menu option in `mainMenu()`
4. Implement contract interaction logic

### Testing
```bash
# Run all tests
npm test

# Test specific interface
npm run cli:enhanced -- --test

# Mock mode (no real transactions)
npm run cli:enhanced -- --mock
```

## 🐛 Troubleshooting

### Common Issues

**No deployment found**
```bash
# Deploy contracts first
npm run deploy:local
```

**Connection refused**
```bash
# Start local node
npm run node
```

**Insufficient balance**
```bash
# Get test tokens
npm run cli:enhanced
# Select: Settings > Get Test BOT Tokens
```

**Transaction failed**
- Check gas settings
- Verify contract state
- Ensure proper approvals

## 📚 API Reference

### Contract ABIs
All ABIs are auto-loaded from `artifacts/contracts/`

### Key Functions
```javascript
// Treasury
distributeFees()
executeBuyback(amount)
updateDistribution(staking, buyback, dev)

// Staking
stake(amount)
unstake(amount)
getReward()

// Vault
deposit(assets, receiver)
withdraw(assets, receiver, owner)
previewDeposit(assets)

// Game
placeBet(betType, amount, betValue)
rollDice()
settleBets(dice1, dice2)
```

## 🎮 Bot Personalities

1. **Alice "All-In"** - Aggressive, high-risk
2. **Bob "Calculator"** - Statistical, methodical
3. **Charlie "Lucky"** - Superstitious believer
4. **Diana "Ice Queen"** - Cold logic
5. **Eddie "Entertainer"** - Theatrical showman
6. **Fiona "Fearless"** - Never backs down
7. **Greg "Grinder"** - Steady patience
8. **Helen "Hot Streak"** - Momentum rider
9. **Ivan "Intimidator"** - Psychological warfare
10. **Julia "Jinx"** - Claims to control luck

## 🚀 Roadmap

### Phase 1 ✅ Complete
- [x] Core game implementation
- [x] Vault system
- [x] Staking mechanism
- [x] Treasury management
- [x] Basic CLI interface

### Phase 2 🔄 In Progress
- [x] Enhanced CLI with full contract coverage
- [x] AI bot integration
- [x] Cross-chain support
- [ ] Web interface
- [ ] Mobile app

### Phase 3 📅 Planned
- [ ] Advanced analytics
- [ ] Social features
- [ ] Tournament mode
- [ ] Governance system
- [ ] Mainnet deployment

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines.

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/barely-human/casino/issues)
- Discord: [Join community](https://discord.gg/barely-human)
- Docs: [Full documentation](https://docs.barely-human.casino)

---

Built with ❤️ for ETHGlobal NYC 2025