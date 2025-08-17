# 🌐 Barely Human Web Interface Setup Guide

This guide will help you set up and run the complete Barely Human DeFi Casino with the React web interface.

## 🚀 Quick Start (Automated)

### One-Command Setup
```bash
# Install all dependencies and deploy everything
npm install
npm run setup:web

# Start the full casino (blockchain + web + bots)
npm run dev:full
```

This will:
1. ✅ Compile all smart contracts
2. ✅ Start Hardhat local blockchain
3. ✅ Deploy all contracts
4. ✅ Install web dependencies
5. ✅ Update web configuration with contract addresses
6. ✅ Build the web application
7. ✅ Start web server, blockchain, and bot orchestrator

Open http://localhost:3000 in your browser and start playing!

---

## 🛠️ Manual Setup (Step by Step)

### Prerequisites
- Node.js 18+ and npm
- Git
- A Web3 wallet (MetaMask recommended)

### 1. Clone and Install
```bash
# Clone the repository
git clone https://github.com/happybigmtn/barely-human.git
cd barely-human

# Install main dependencies
npm install

# Install web dependencies
npm run web:install
```

### 2. Start Blockchain
```bash
# Terminal 1: Start Hardhat node
npm run node
```

### 3. Deploy Contracts
```bash
# Terminal 2: Deploy all contracts
npm run deploy:local

# Optional: Deploy escrow contract for bot betting
npm run deploy:escrow
```

### 4. Configure Web App
```bash
# Copy and edit environment file
cd web
cp .env.example .env.local

# Edit .env.local with your settings
# The setup script should have already populated contract addresses
```

### 5. Start Web Application
```bash
# Terminal 3: Start web development server
npm run web:dev

# Or from main directory
npm run web:dev
```

### 6. Start Bot Orchestrator (Optional)
```bash
# Terminal 4: Start automated bots
npm run bots
```

---

## 🎮 Using the Web Interface

### 1. Connect Your Wallet
- Click "Connect Wallet" in the top right
- Choose MetaMask or your preferred wallet
- Make sure you're on the Hardhat Local network (Chain ID: 31337)

### 2. Get Test Tokens
The deployment script automatically funds the first account. If you need more BOT tokens:
```bash
# Fund additional accounts
npm run fund-accounts
```

### 3. Explore Features

#### Dashboard
- 📊 **Live Game View**: Watch dice rolls and bot actions
- 📈 **Performance Charts**: TVL, volume, and price data
- 🏆 **Top Performers**: Leading bots by win rate
- 🔔 **Recent Activity**: Live feed of all actions

#### AI Bots
- 🤖 **10 Unique Personalities**: Each with distinct traits
- 💬 **Chat Interface**: Talk to bots (requires Ollama setup)
- 📊 **Performance Tracking**: Individual stats and strategies
- 🎯 **Betting History**: See what bots are wagering on

#### Vaults (LP Interface)
- 🏦 **Deposit/Withdraw**: Provide liquidity to bot vaults
- 💰 **Yield Tracking**: Real-time APY calculations
- 📈 **Performance Metrics**: Risk vs. reward analysis
- 💼 **Portfolio Overview**: Your total positions

#### NFT Gallery
- 🎨 **Mint Passes**: Collectible passes earned from gameplay
- 🖼️ **Generated Art**: Unique AI artwork from VRF seeds
- 💎 **Rarity Tiers**: Common, Rare, Epic, Legendary
- 🔍 **Metadata Explorer**: Detailed NFT attributes

#### Leaderboard
- 🥇 **Top Performers**: Ranked by various metrics
- 📊 **Historical Data**: Performance over time
- 🏆 **Achievements**: Unlock badges and milestones
- 🎖️ **Competitions**: Weekly and monthly tournaments

---

## 🔧 Configuration Options

### Environment Variables (web/.env.local)
```env
# Wallet Connect
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-project-id

# Network
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545

# Contract Addresses (auto-populated by setup script)
NEXT_PUBLIC_BOT_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_CRAPS_GAME_ADDRESS=0x...
# ... other contracts

# Feature Flags
NEXT_PUBLIC_ENABLE_CHAT=true
NEXT_PUBLIC_ENABLE_NFT=true
NEXT_PUBLIC_ENABLE_STAKING=true
```

### Network Switching
To use different networks:

#### Base Sepolia Testnet
```env
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
```

#### Base Mainnet
```env
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
```

---

## 🤖 AI Chat Setup (Optional)

For the full AI bot experience with chat:

### Install Ollama (Free Local AI)
```bash
# Run the setup script
npm run setup:ollama

# This installs Ollama and downloads Mistral model
# Completely free and runs locally
```

### Alternative: Use Hugging Face (Cloud AI)
1. Get API key from https://huggingface.co/settings/tokens
2. Update web configuration:
```env
NEXT_PUBLIC_HF_API_KEY=your-huggingface-key
```

---

## 📱 Mobile Support

The web interface is fully responsive and works great on mobile:

- 📱 **Progressive Web App**: Can be installed on home screen
- 👆 **Touch Optimized**: Large buttons and swipe gestures
- 🔄 **Auto-Refresh**: Live updates without manual refresh
- 🎯 **Mobile Wallet**: Works with mobile wallet apps

### Install as PWA
1. Open the site on mobile browser
2. Tap "Add to Home Screen"
3. Launch from home screen for native app experience

---

## 🚨 Troubleshooting

### Common Issues

#### "Network Mismatch" Error
```bash
# Make sure Hardhat node is running
npm run node

# Check if contracts are deployed
npm run deploy:local
```

#### "Contract Not Found" Error
```bash
# Update contract addresses
npm run setup:web

# Or manually check deployment-summary.json
```

#### Web App Won't Start
```bash
# Install dependencies
npm run web:install

# Clear Next.js cache
cd web && rm -rf .next && npm run dev
```

#### Bots Not Moving
```bash
# Start bot orchestrator
npm run bots

# Check bot balances
npm run balance:check
```

### Performance Issues

#### Slow Loading
- Enable RPC caching in wallet
- Use Alchemy endpoint instead of local RPC
- Reduce update frequency in settings

#### High Memory Usage
- Close unused browser tabs
- Disable real-time features temporarily
- Use lighter wallet (WalletConnect vs MetaMask)

---

## 🔍 Development

### Hot Reload
The development setup supports hot reload for:
- ✅ React components and pages
- ✅ Tailwind CSS styles
- ✅ TypeScript changes
- ❌ Smart contract changes (requires redeploy)

### Code Structure
```
web/
├── src/
│   ├── app/              # Next.js 13+ App Router
│   ├── components/       # React components
│   │   ├── dashboard/    # Dashboard specific
│   │   ├── layout/       # Layout components
│   │   └── ui/          # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and constants
│   ├── store/           # Zustand state management
│   └── types/           # TypeScript definitions
├── public/              # Static assets
└── styles/              # Global styles
```

### Adding New Features

#### New Page
1. Create component in `src/app/[page]/page.tsx`
2. Add navigation in `src/components/layout/Sidebar.tsx`
3. Update routing in main layout

#### New Contract Integration
1. Add ABI to `src/lib/wagmi.ts`
2. Create hooks in `src/hooks/useContract.ts`
3. Add address to environment variables
4. Update deployment script

---

## 🚀 Production Deployment

### Build for Production
```bash
# Build optimized version
npm run web:build

# Start production server
npm run web:start
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from web directory
cd web
vercel --prod
```

### Deploy to Netlify
```bash
# Build static version
npm run web:build
npm run web:export

# Upload dist/ folder to Netlify
```

---

## 📊 Monitoring

### Performance Metrics
- Bundle size: Check with `npm run web:analyze`
- Core Web Vitals: Use Lighthouse
- Real User Monitoring: Enable in production

### Error Tracking
- Console errors logged automatically
- Transaction failures shown in UI
- Network issues handled gracefully

---

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Make changes and test thoroughly
4. Submit pull request

### Code Standards
- TypeScript for all new code
- ESLint + Prettier for formatting
- Responsive design for all components
- Accessibility (a11y) compliance

---

## 📞 Support

### Getting Help
- 📚 **Documentation**: Check `/docs` folder
- 🐛 **Issues**: GitHub Issues page
- 💬 **Discord**: Join our community
- 📧 **Email**: Support team

### Common Commands Reference
```bash
# Development
npm run dev:full          # Start everything
npm run web:dev           # Web only
npm run bots              # Bots only

# Deployment
npm run setup:web         # Full setup
npm run deploy:local      # Contracts only

# Maintenance
npm run balance:check     # Check balances
npm run fund-accounts     # Add test tokens
npm run clean            # Clean build files
```

---

🎰 **Ready to play? Open http://localhost:3000 and let the games begin!** 🎲