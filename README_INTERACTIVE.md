# 🎰 Barely Human - Interactive AI Casino

## 🚀 Quick Start

### 1. Start the System
```bash
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
npm run deploy:local

# Terminal 3: Deploy escrow (optional, for betting on bots)
npm run deploy:escrow
```

### 2. Setup Free AI (Ollama)
```bash
# Install and configure Ollama for free local AI
npm run setup:ollama

# This will:
# - Install Ollama (free, runs locally)
# - Download a language model (Mistral/Llama)
# - Configure the bots to use it
```

### 3. Run Interactive Casino
```bash
# Start the interactive CLI with AI chat
npm run cli:interactive
```

## 🎮 Features

### 💬 Chat with AI Bots
- Each bot has a unique personality powered by LLM
- Learn their strategies and quirks
- Get betting advice directly from them

### 🎯 Bet on Bots (Escrow System)
- Place bets on which bot will perform best
- Escrow contract manages the betting pool
- Winners share the pot based on their stake

### 🤖 10 Unique Bot Personalities

1. **🎯 Alice "All-In"** - Aggressive high-roller
2. **🧮 Bob "The Calculator"** - Statistical analyzer
3. **🍀 Charlie "Lucky Charm"** - Superstitious believer
4. **❄️ Diana "Ice Queen"** - Cold, methodical
5. **🎭 Eddie "The Entertainer"** - Theatrical showman
6. **⚡ Fiona "Fearless"** - Adrenaline junkie
7. **💎 Greg "The Grinder"** - Patient and steady
8. **🔥 Helen "Hot Streak"** - Momentum player
9. **👹 Ivan "The Intimidator"** - Mind games expert
10. **🌀 Julia "Jinx"** - Chaos controller

## 🎲 Game Mechanics

### Craps Rules
- **Come-Out Roll**: 7/11 wins, 2/3/12 loses
- **Point Phase**: Hit point to win, 7 to lose
- **64 Bet Types**: From simple Pass/Don't Pass to complex propositions

### Bot Betting Strategies
- **Conservative**: Small, calculated bets
- **Aggressive**: High risk, high reward
- **Martingale**: Double after losses
- **Fibonacci**: Mathematical progression
- **Paroli**: Increase on wins
- **Oscar's Grind**: Small steady gains
- **Adaptive**: Changes based on performance
- **Random**: Pure chaos
- **Mixed**: Combination of strategies

## 🏗️ Architecture

### Smart Contracts
- **BOTToken**: ERC20 token for betting
- **CrapsGame**: Main game logic with VRF
- **BotManager**: AI personality management
- **BotBettingEscrow**: Betting on bot performance
- **VaultFactory**: Individual bot vaults

### AI Integration
- **Ollama**: Free, local LLM (no API costs!)
- **Personality System**: Each bot has unique prompts
- **Context-Aware**: Bots remember game state and performance
- **Interactive Chat**: Real conversations with bots

### Supported LLMs (All Free!)
1. **Ollama (Recommended)**
   - Runs locally, completely free
   - Models: Mistral, Llama2, Phi
   - No internet required after setup

2. **Hugging Face (Alternative)**
   - Free tier: 1000 requests/month
   - Cloud-based, no local GPU needed
   - Set env: `HUGGINGFACE_API_KEY`

## 📊 CLI Commands

```bash
# Different CLI versions
npm run cli:simple      # Basic interface
npm run cli             # Full featured
npm run cli:interactive # With AI chat (recommended)

# Bot automation
npm run bots           # Watch bots play automatically

# Development
npm run node           # Start Hardhat node
npm run deploy:local   # Deploy all contracts
npm run deploy:escrow  # Deploy betting escrow
npm run test          # Run tests
```

## 🛠️ Troubleshooting

### Ollama Not Working?
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
pkill ollama
ollama serve &

# Pull a model manually
ollama pull mistral
```

### Network Connection Issues?
```bash
# Ensure Hardhat node is running
npx hardhat node

# Redeploy contracts
npm run deploy:local
```

### Bots Not Responding?
- The system includes fallback responses
- Works even without LLM connection
- Check Ollama status with: `ollama list`

## 💡 Tips

1. **Chat First**: Talk to bots before betting to understand their style
2. **Watch Patterns**: Bots have consistent personalities
3. **Bet Smart**: Use the escrow system to bet on your favorite bot
4. **Track Performance**: Check leaderboard for top performers

## 🎯 Next Steps

1. **Add more LLM providers**: GPT4All, LocalAI
2. **Enhanced betting mechanics**: Parlays, futures
3. **Tournament mode**: Bots compete in brackets
4. **NFT achievements**: Mint badges for wins
5. **Social features**: Share bot conversations

## 📜 License

MIT - Feel free to fork and extend!

---

**Built for ETHGlobal Hackathon** 🚀

*"Where AI meets DeFi gambling - may the best bot win!"*