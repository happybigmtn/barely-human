# Barely Human Casino - The Graph Subgraph

A comprehensive subgraph for indexing all events and data from the Barely Human DeFi Casino project. This subgraph enables real-time querying of game statistics, bot performance, liquidity provider activities, NFT events, treasury operations, and more.

## 🎯 Features

### Game Analytics
- **Game Series Tracking**: Every craps game with dice rolls, phases, and outcomes
- **Betting Analytics**: All 64 bet types with real-time tracking and settlement
- **Player Statistics**: Win rates, P&L, favorite games, betting patterns
- **Bot Performance**: 10 AI personalities with strategy analysis and bankroll tracking

### DeFi Operations  
- **Vault Management**: ERC4626 LP vaults with TVL, performance fees, and share prices
- **Staking Pools**: BOT token staking with rewards distribution and epoch tracking
- **Treasury Analytics**: Fee collection, distribution, buyback execution
- **Token Economics**: BOT token transfers, holder analytics, supply metrics

### NFT & Gamification
- **Gacha Raffles**: Entry tracking, winner selection, mint pass distribution
- **Generative Art**: NFT creation from mint pass redemption
- **Bot Betting Escrow**: Users betting on which bot performs best

### DEX Integration
- **Uniswap V4 Hooks**: 2% swap fee collection and treasury distribution
- **Liquidity Analytics**: Pool performance and fee generation

## 📊 Key Entities

### Core Game Entities
- `Protocol` - Global protocol statistics and metrics
- `User` - Player profiles with comprehensive statistics
- `Bot` - AI personality performance and strategies
- `GameSeries` - Individual craps games with outcomes
- `DiceRoll` - VRF-generated dice results
- `Bet` - Individual bets with types and settlements

### DeFi Entities
- `Vault` - LP vault performance and management
- `LPPosition` - Individual liquidity provider positions
- `StakingPool` - BOT token staking operations
- `StakingPosition` - User staking balances and rewards
- `Treasury` - Fee collection and distribution

### NFT Entities
- `GachaRaffle` - Raffle rounds and participation
- `MintPass` - NFT mint passes from raffles
- `GenerativeArt` - Created artwork from redeemed passes

### Analytics Entities
- `DailyMetric` - Daily aggregated statistics
- `HourlyMetric` - Hourly activity tracking
- `BotPerformance` - Betting round performance tracking

## 🚀 Quick Start

### Prerequisites
```bash
npm install -g @graphprotocol/graph-cli
```

### Setup
```bash
# Clone and install dependencies
cd subgraph
npm install

# Configure for your target network
cp config/base-sepolia.json.example config/base-sepolia.json
# Edit config/base-sepolia.json with actual contract addresses
```

### Deploy to The Graph Studio
```bash
# Authenticate with The Graph Studio
graph auth --studio <YOUR_DEPLOY_KEY>

# Deploy to testnet
./scripts/deploy.sh base-sepolia barely-human-casino

# Deploy to mainnet
./scripts/deploy.sh base barely-human-casino
```

### Deploy to Local Graph Node
```bash
# Start local graph node (requires Docker)
git clone https://github.com/graphprotocol/graph-node
cd graph-node/docker
docker-compose up

# Deploy subgraph
./scripts/deploy.sh local barely-human-casino
```

## 📡 Configuration

### Network Configuration Files
- `config/local.json` - Local development
- `config/base-sepolia.json` - Base Sepolia testnet  
- `config/base.json` - Base mainnet

### Required Contract Addresses
Update the config file for your network:
```json
{
  "network": "base-sepolia",
  "contracts": {
    "BOTToken": "0x...",
    "CrapsGame": "0x...",
    "CrapsBets": "0x...",
    "CrapsSettlement": "0x...",
    "BotManager": "0x...",
    "VaultFactory": "0x...",
    "StakingPool": "0x...",
    "Treasury": "0x...",
    "GachaMintPass": "0x...",
    "BotBettingEscrow": "0x...",
    "BotSwapFeeHookV4": "0x..."
  },
  "startBlocks": {
    "BOTToken": 1234567,
    // ... deployment block numbers
  }
}
```

## 🔍 Example Queries

### Protocol Overview
```graphql
query ProtocolStats {
  protocol(id: "protocol") {
    totalGamesPlayed
    totalAmountWagered
    totalPayouts
    totalPlayers
    totalBots
    totalVaultTVL
    totalStaked
  }
}
```

### Bot Performance Leaderboard
```graphql
query BotLeaderboard {
  bots(orderBy: netPnL, orderDirection: desc) {
    name
    personality
    bettingStrategy
    netPnL
    winRate
    totalBetsPlaced
    currentBankroll
    vault {
      totalAssets
      sharePrice
    }
  }
}
```

### Recent Game Activity
```graphql
query RecentGames {
  gameSeries(
    first: 10
    orderBy: startTime
    orderDirection: desc
  ) {
    id
    phase
    pointNumber
    totalBets
    totalAmount
    rollCount
    diceRolls(first: 5) {
      dice1
      dice2
      sum
      timestamp
    }
    bets(first: 5) {
      betType
      amount
      payout
      player {
        id
      }
    }
  }
}
```

### Vault Performance
```graphql
query VaultPerformance {
  vaults(orderBy: totalAssets, orderDirection: desc) {
    name
    bot {
      name
      personality
    }
    totalAssets
    totalShares
    sharePrice
    totalDeposits
    totalWithdrawals
    totalPerformanceFees
    totalPnL
    lpCount
    lpPositions(first: 5) {
      user {
        id
      }
      shares
      deposits
      withdrawals
      currentValue
    }
  }
}
```

### Daily Analytics
```graphql
query DailyAnalytics($date: Int!) {
  dailyMetric(id: $date) {
    date
    totalVolume
    totalBets
    uniquePlayers
    totalGames
    totalVaultDeposits
    totalVaultWithdrawals
    netVaultFlow
    totalStaked
    netStakeFlow
    topPerformingBot {
      name
    }
    avgBotPnL
    totalFees
    protocolRevenue
  }
}
```

### User Portfolio
```graphql
query UserPortfolio($userAddress: String!) {
  user(id: $userAddress) {
    totalBetsPlaced
    totalAmountWagered
    totalWinnings
    netPnL
    winRate
    gamesPlayed
    
    # LP Positions
    lpPositions {
      vault {
        name
        bot {
          name
        }
      }
      shares
      currentValue
      totalPnL
    }
    
    # Staking Positions
    stakingPositions {
      pool {
        id
      }
      stakedAmount
      rewardsPaid
      pendingRewards
    }
    
    # NFT Holdings
    mintPassesOwned
    generativeArtOwned
    
    # Bot Betting
    totalBotBets
    totalBotBetWinnings
  }
}
```

### NFT Raffle Activity
```graphql
query RaffleActivity {
  gachaRaffles(
    first: 5
    orderBy: startTime
    orderDirection: desc
  ) {
    raffleId
    mintPassCount
    entryCount
    totalTickets
    isActive
    winnersSelected
    winners
    entries(first: 10) {
      player {
        id
      }
      tickets
    }
  }
}
```

### Treasury Operations
```graphql
query TreasuryActivity {
  treasury(id: "treasury-address") {
    totalFeesCollected
    totalFeesDistributed
    stakingDistributed
    buybackDistributed
    totalBuybacks
    totalTokensBoughtBack
    
    feeCollections(first: 10, orderBy: timestamp, orderDirection: desc) {
      from
      amount
      timestamp
    }
    
    buybacks(first: 5, orderBy: timestamp, orderDirection: desc) {
      ethSpent
      tokensReceived
      timestamp
    }
  }
}
```

## 📈 Monitoring & Analytics

### Key Metrics to Track
- **Game Volume**: Daily/hourly betting volume and frequency
- **Bot Performance**: Win rates, bankroll changes, strategy effectiveness
- **Vault Health**: TVL growth, performance fees, LP satisfaction
- **User Engagement**: Active players, retention, betting patterns
- **Treasury Efficiency**: Fee collection, distribution ratios, buyback impact
- **NFT Activity**: Raffle participation, mint pass redemption rates

### Dashboard Ideas
- **Protocol Dashboard**: TVL, volume, active users, revenue
- **Bot Leaderboard**: Performance ranking with detailed stats
- **Vault Analytics**: ROI tracking, fee generation, LP positions
- **Game Analytics**: Popular bet types, average game duration, outcomes
- **User Journey**: Onboarding funnel, engagement patterns

## 🛠️ Development

### File Structure
```
subgraph/
├── schema.graphql           # GraphQL schema definitions
├── subgraph.template.yaml   # Template configuration
├── package.json            # Dependencies and scripts
├── src/
│   ├── mappings/           # Event handlers
│   │   ├── crapsGame.ts    # Game logic events
│   │   ├── crapsBets.ts    # Betting events
│   │   ├── botManager.ts   # Bot decision events
│   │   ├── crapsVault.ts   # Vault operations
│   │   ├── stakingPool.ts  # Staking events
│   │   ├── treasury.ts     # Treasury events
│   │   ├── gachaMintPass.ts # NFT events
│   │   ├── botBettingEscrow.ts # Escrow events
│   │   ├── botSwapFeeHookV4.ts # Uniswap hooks
│   │   └── botToken.ts     # Token events
│   └── utils/
│       └── helpers.ts      # Utility functions
├── abis/                   # Contract ABIs
├── config/                 # Network configurations
└── scripts/                # Deployment scripts
```

### Adding New Events
1. Add event definition to `schema.graphql`
2. Update contract ABI in `abis/`
3. Add event handler in appropriate mapping file
4. Update helper functions if needed
5. Test with local deployment

### Testing
```bash
# Generate types and build
npm run codegen
npm run build

# Deploy to local node for testing
./scripts/deploy.sh local test-subgraph

# Query local GraphQL endpoint
curl -X POST http://localhost:8000/subgraphs/name/test-subgraph \
  -H "Content-Type: application/json" \
  -d '{"query": "{ protocol { totalGamesPlayed } }"}'
```

## 🌐 Networks

### Supported Networks
- **Base Mainnet** (Chain ID: 8453)
- **Base Sepolia** (Chain ID: 84532)  
- **Local Development** (Chain ID: 31337)

### Future Networks
- **Unichain** (when launched)
- **Arbitrum** (potential expansion)
- **Optimism** (potential expansion)

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 🔗 Links

- **Main Repository**: [Barely Human Casino](https://github.com/happybigmtn/barely-human)
- **The Graph Docs**: [https://thegraph.com/docs/](https://thegraph.com/docs/)
- **Base Network**: [https://base.org/](https://base.org/)
- **ElizaOS**: [AI Agent Framework](https://github.com/ai16z/eliza)

---

Built with ❤️ for ETHGlobal New York 2025