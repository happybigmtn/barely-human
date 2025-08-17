# Interactive Casino CLI - Complete Guide

## 🎰 Overview
The Barely Human Interactive CLI provides a full casino experience with AI-powered bot personalities, betting, and live game watching.

## 🚀 Quick Start

### Option 1: Use the Fixed Version (Recommended)
```bash
npm run cli:interactive
```

### Option 2: Use the Launcher Script
```bash
./start-interactive-cli.sh
```

### Option 3: Run Directly
```bash
node frontend/cli/interactive-casino-fixed.js
```

## 📦 Available Versions

### 1. Fixed Interactive CLI (`interactive-casino-fixed.js`)
✅ **Fully Working Version**
- Demo Mode (no blockchain required)
- Blockchain Mode (connects to local Hardhat node)
- AI bot chat with personalities
- Bet on bot performance
- Watch live games
- Leaderboard and statistics

### 2. Simple Interactive CLI (`interactive-casino-simple.js`)
✅ **Basic Demo Version**
- Standalone demo (no dependencies)
- Simulated bot interactions
- Basic betting mechanics
- Good for testing UI flow

### 3. Original Interactive CLI (`interactive-casino-cli.js`)
⚠️ **May have import issues**
- Full blockchain integration
- Requires all dependencies configured
- Use for development only

## 🎮 Features

### Demo Mode
- No blockchain required
- Instant startup
- Simulated transactions
- Perfect for testing

### Blockchain Mode
- Connects to local Hardhat node
- Real smart contract interactions
- Actual BOT token transactions
- Full DeFi experience

## 🤖 Bot Personalities

1. **Alice "All-In"** 🎯 - Aggressive high-roller
2. **Bob "The Calculator"** 🧮 - Statistical analyzer
3. **Charlie "Lucky Charm"** 🍀 - Superstitious believer
4. **Diana "Ice Queen"** ❄️ - Cold, logical player
5. **Eddie "The Entertainer"** 🎭 - Theatrical showman

Each bot has unique:
- Chat responses
- Betting strategies
- Win/loss reactions
- Personality traits

## 💬 Interactive Features

### Chat with Bots
- Ask about strategies
- Get betting tips
- Learn their personalities
- Hear their stories

### Bet on Bots
- Choose your favorite bot
- Place bets on their performance
- Win double your bet
- Track your profit/loss

### Watch Live Games
- See all bots play simultaneously
- Watch dice rolls in real-time
- Track round-by-round results
- Observe betting patterns

### View Statistics
- Leaderboard rankings
- Win/loss records
- Balance tracking
- Performance metrics

## 🛠️ Troubleshooting

### If you see import errors:
```bash
# Use the fixed version instead
npm run cli:interactive
```

### If blockchain connection fails:
1. Start local node: `npm run node`
2. Deploy contracts: `npm run deploy:local`
3. Or just use Demo Mode (no blockchain needed)

### If module not found:
```bash
# Install dependencies
npm install

# Use the fixed version
node frontend/cli/interactive-casino-fixed.js
```

## 📝 NPM Scripts

```bash
# Main interactive CLI (fixed version)
npm run cli:interactive

# Simple demo version
npm run cli:interactive:simple

# Original version (may have issues)
npm run cli:interactive:original

# Interactive launcher menu
npm run cli:interactive:test
```

## 🎯 Usage Examples

### Basic Flow
1. Start the CLI
2. Choose Demo Mode (no setup required)
3. Chat with bots to learn their personalities
4. Place bets on your favorite bot
5. Watch them play live
6. Check the leaderboard
7. Track your winnings

### Advanced Flow
1. Start Hardhat node: `npm run node`
2. Deploy contracts: `npm run deploy:local`
3. Start CLI in Blockchain Mode
4. Experience full DeFi casino with real transactions

## 🔧 Development

### File Structure
```
frontend/cli/
├── interactive-casino-fixed.js   # Working version
├── interactive-casino-simple.js  # Demo version
├── interactive-casino-cli.js     # Original (issues)
└── wallet-manager.js             # Wallet utilities
```

### Key Components
- **SimpleLLMManager**: Simulated AI responses
- **SimpleGameConnector**: Game state management
- **InteractiveCasinoCLI**: Main UI controller

## 📊 Game Rules

### Betting
- Minimum bet: $1
- Maximum bet: Your balance
- Win payout: 2x your bet
- House edge: Varies by bot strategy

### Bot Strategies
- **Aggressive**: Higher risk, higher reward
- **Conservative**: Lower risk, steady gains
- **Superstitious**: Random based on "luck"
- **Logical**: Calculated decisions
- **Showman**: Entertainment-focused

## 🎉 Tips for Best Experience

1. **Start with Demo Mode** - No setup required
2. **Chat with each bot** - Learn their personalities
3. **Watch a few rounds** - Understand patterns
4. **Bet strategically** - Each bot has different odds
5. **Check statistics** - Track performance over time

## 🐛 Known Issues

1. Original CLI has import path issues (use fixed version)
2. Blockchain mode requires local node running
3. Some TypeScript files may not import correctly in JS

## 📚 Additional Resources

- Main README: `/README.md`
- Full Blueprint: `/docs/FULL_BLUEPRINT.md`
- Contract Tests: `/test/`
- Deployment Scripts: `/scripts/`

## 🚦 Status

✅ **Fixed Interactive CLI**: Fully functional
✅ **Simple Interactive CLI**: Working demo
⚠️ **Original Interactive CLI**: Has import issues
✅ **Demo Mode**: No dependencies required
✅ **Bot Personalities**: Fully implemented
✅ **Betting System**: Complete
✅ **Statistics**: Tracking enabled

---

Enjoy the Barely Human Interactive Casino! 🎰