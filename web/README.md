# 🎰 Barely Human - DeFi Casino Web Interface

A comprehensive React web application for the Barely Human DeFi Casino, where AI bots battle it out in high-stakes craps games.

## 🚀 Features

### 🎯 Dashboard
- **Live Game Monitoring** - Watch AI bots play craps in real-time
- **Performance Analytics** - Track bot performance, win rates, and earnings
- **Market Overview** - TVL charts, token prices, and trading volume
- **Recent Activity** - Live feed of all casino activities

### 🤖 AI Bot Showcase
- **10 Unique Personalities** - Each bot with distinct traits and strategies
- **Interactive Chat** - Powered by local LLM (Ollama) or cloud AI
- **Performance Tracking** - Individual bot statistics and leaderboards
- **Strategy Analysis** - Deep dive into each bot's betting patterns

### 🏦 Vault Management
- **LP Interface** - Deposit/withdraw from bot-operated vaults
- **Yield Tracking** - Real-time APY and performance metrics
- **Portfolio Overview** - Your total positions across all vaults
- **Risk Assessment** - Performance vs. risk analysis

### 🎨 NFT Gallery
- **Mint Pass Collection** - View and manage your NFT mint passes
- **Generative Art** - Redeem passes for unique AI-generated artwork
- **Rarity System** - Common, Rare, Epic, and Legendary tiers
- **Metadata Explorer** - Detailed NFT attributes and history

### 🏆 Leaderboards
- **Top Performers** - Ranked by win rate, profit, ROI, and more
- **Competition Tracking** - Weekly and monthly tournaments
- **Achievement System** - Unlock badges and milestones
- **Historical Data** - Long-term performance trends

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom casino theme
- **Web3**: Wagmi, Viem, RainbowKit for wallet connections
- **State Management**: Zustand with subscriptions
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion for smooth interactions
- **Real-time**: WebSocket connections for live updates

## 🔧 Setup & Installation

### Prerequisites
- Node.js 18+ and npm
- Running Hardhat node with deployed contracts
- Web3 wallet (MetaMask, Coinbase Wallet, etc.)

### Installation
```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Configuration
Update `.env.local` with your configuration:
```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-project-id
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545

# Contract addresses (filled after deployment)
NEXT_PUBLIC_BOT_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_CRAPS_GAME_ADDRESS=0x...
# ... other contracts
```

## 🎮 Usage

### 1. Connect Wallet
- Click "Connect Wallet" in the header
- Choose your preferred wallet provider
- Ensure you're on the correct network (Hardhat local or Base)

### 2. Fund Your Wallet
- Get BOT tokens from the faucet or deployment script
- Approve spending for vault deposits and game bets

### 3. Explore Features
- **Dashboard**: Monitor live games and overall statistics
- **Bots**: Chat with AI personalities and track performance
- **Vaults**: Provide liquidity and earn yields
- **NFTs**: Collect mint passes and redeem artwork
- **Leaderboard**: See top performing bots and competitions

### 4. Interact with Bots
- Click on any bot to open chat interface
- Ask about their strategies and recent performance
- Watch them explain their betting decisions in real-time

## 🎨 Design System

### Color Palette
- **Neon Red**: `#ff073a` - Primary accent, warnings
- **Neon Green**: `#39ff14` - Success, profits, wins
- **Neon Blue**: `#00bfff` - Information, links
- **Neon Purple**: `#bf00ff` - Secondary accent
- **Neon Yellow**: `#ffff00` - Highlights, energy
- **Casino Dark**: `#0a0a0a` - Background
- **Casino Darker**: `#050505` - Darker elements

### Typography
- **Display**: Orbitron - Futuristic headers
- **Mono**: JetBrains Mono - Numbers, addresses
- **Body**: Inter - General text

### Components
- **Glass Cards**: Semi-transparent backgrounds with blur
- **Neon Effects**: Glowing borders and text shadows
- **Dice Animations**: 3D rolling effects
- **Bot Indicators**: Status lights and emoji representations

## 📱 Responsive Design

- **Mobile First**: Optimized for phones and tablets
- **Breakpoints**: SM (640px), MD (768px), LG (1024px), XL (1280px)
- **Touch Friendly**: Large tap targets and swipe gestures
- **Progressive Enhancement**: Works without JavaScript

## 🔒 Security Features

- **Wallet Security**: Never stores private keys
- **Input Validation**: All user inputs sanitized
- **Rate Limiting**: Protection against spam
- **Error Boundaries**: Graceful error handling
- **HTTPS Only**: Secure connections in production

## 🚀 Performance Optimizations

- **Code Splitting**: Route-based lazy loading
- **Image Optimization**: Next.js automatic optimization
- **Bundle Analysis**: Tree shaking and minimal dependencies
- **Caching**: React Query for API responses
- **Prefetching**: Next.js automatic prefetching

## 🧪 Testing

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Build for production
npm run build
```

## 📦 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run start
```

### Static Export
```bash
npm run build
npm run export
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Main Repository**: [GitHub](https://github.com/happybigmtn/barely-human)
- **Live Demo**: Coming soon
- **Documentation**: See `/docs` folder
- **Discord**: Join our community

---

Built with ❤️ for the ETHGlobal New York 2025 Hackathon