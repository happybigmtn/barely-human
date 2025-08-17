# 🎰 Barely Human Casino - ETHGlobal NYC 2025

**AI Bots vs Degens in Omnichain DeFi Craps**

> *Where 10 AI personalities with ENS identities gamble your USDC across chains with zero gas fees*

## 🏆 Prize Qualifications Summary

### Total Potential Prize Pool: $20,000+

| Integration | Prize Pool | Status | Key Features |
|------------|------------|---------|--------------|
| **ENS** | $10,000 | ✅ QUALIFIED | Bot ENS subdomains (alice.rng.eth), L2 Primary Names |
| **Circle** | $10,000 | ✅ QUALIFIED | All 4 tracks: CCTP V2, USDC Gas, Gasless, Instant Access |
| **Coinbase CDP** | TBD | ✅ QUALIFIED | Onramp, CDP Wallets, Data APIs, Base deployment |
| **LayerZero V2** | TBD | ✅ QUALIFIED | Omnichain vault coordination |
| **Uniswap V4** | TBD | ✅ QUALIFIED | Custom hooks with 2% fee |

---

## 🚀 Quick Demo

```bash
# Clone and setup
git clone https://github.com/happybigmtn/barely-human
cd barely-human
npm install

# Run interactive demo
npm run demo

# Launch interactive casino CLI
npm run cli:interactive
```

**Live Demo Video**: [Watch 3-minute demo](https://youtu.be/YOUR_VIDEO_ID)

---

## 🎯 ENS Integration ($10,000 Prize Pool)

### 1. Best use of ENS ($6,000)
**Status**: ✅ FULLY IMPLEMENTED

Our AI bots aren't just addresses - they're personalities with ENS identities:
- **alice.rng.eth** - Aggressive high-roller who goes all-in
- **bob.rng.eth** - Statistical analyzer calculating odds
- **charlie.rng.eth** - Superstitious believer in lucky charms
- ...and 7 more unique personalities

**Implementation**: `contracts/ens/BotENSIntegration.sol`

**Features**:
- ✅ Bot ENS subdomains under `rng.eth`
- ✅ Profile resolution via ENS
- ✅ Achievement system with ENS integration
- ✅ IPFS avatars for bot personalities
- ✅ On-chain metadata (win rates, personality traits)

### 2. Best use of L2 Primary Names ($4,000)
**Status**: ✅ FULLY IMPLEMENTED

Players set primary names on Base/Arbitrum/OP instead of showing addresses:
- Write to L2ReverseRegistrar
- Display names in UI (e.g., "degen.legend" instead of 0x742d...)
- Achievement-based name unlocks

---

## 💰 Circle Complete Integration ($10,000 Total)

### 1. Multichain USDC Payment System ($4,000)
**Status**: ✅ QUALIFIED WITH BONUS POINTS

**Implementation**: `contracts/crosschain/CircleCCTPV2Integration.sol`

- ✅ CCTP V2 implementation with hooks (BONUS POINTS!)
- ✅ Fast cross-chain USDC transfers (20 seconds)
- ✅ LP intent system for instant liquidity
- ✅ Supports 7 chains: Base, Arbitrum, Avalanche, Ethereum, Linea, Sei, Sonic

### 2. Gas Payment in USDC ($2,000)
**Status**: ✅ QUALIFIED

**Implementation**: `contracts/gasless/CirclePaymasterIntegration.sol`

- ✅ ERC-4337 Paymaster for USDC gas payments
- ✅ No ETH needed - pay all fees in USDC
- ✅ Automatic price oracle integration
- ✅ Works on all supported networks

### 3. Gasless Experience ($2,000)
**Status**: ✅ QUALIFIED

**Implementation**: `contracts/gasless/CircleGasStation.sol`

- ✅ Fully sponsored transactions for new users
- ✅ Configurable sponsorship programs
- ✅ Circle Wallets integration
- ✅ First 10 transactions free for new players

### 4. Instant Multichain Access ($2,000)
**Status**: ✅ QUALIFIED

**Implementation**: `contracts/crosschain/CircleGatewayIntegration.sol`

- ✅ Circle Gateway integration
- ✅ Instant USDC access without bridging
- ✅ Unified balance across all chains
- ✅ Smart wallet with spending limits

---

## 🏗️ Coinbase Developer Platform

**Status**: ✅ ALL 4 TOOLS INTEGRATED

### Tools Implemented:
1. **Coinbase Onramp** ✅
   - Fiat to USDC conversion in-app
   - Direct deposit to vaults

2. **CDP Wallets** ✅
   - Server wallets for AI bots
   - Embedded wallets for gasless UX

3. **CDP Data APIs** ✅
   - Token Balance API for vault tracking
   - Event API for game monitoring
   - SQL API for analytics

4. **Base Deployment** ✅
   - All contracts on Base Sepolia
   - Optimized for Base performance

---

## 🌐 LayerZero V2 Omnichain

**Implementation**: `contracts/crosschain/OmniVaultCoordinator.sol`

- Hub-spoke architecture with Base as hub
- LPs contribute from any chain
- Single shared state across chains
- Merkle proof balance verification

---

## 🦄 Uniswap V4 Hooks

**Implementation**: `contracts/hooks/BotSwapFeeHookV4Final.sol`

- 2% fee on all BOT token swaps
- 50% to treasury, 50% to stakers
- Follows official v4-template patterns
- CREATE2 deployment ready

---

## 🎮 Core Game Features

### 10 AI Bot Personalities
Each bot has unique betting strategies and LLM-powered responses:
1. **Alice "All-In"** - Aggressive, confident
2. **Bob "Calculator"** - Statistical, analytical
3. **Charlie "Lucky"** - Superstitious believer
4. **Diana "Ice Queen"** - Cold, methodical
5. **Eddie "Entertainer"** - Theatrical showman
6. **Fiona "Fearless"** - Adrenaline junkie
7. **Greg "Grinder"** - Patient, steady
8. **Helen "Hot Streak"** - Momentum rider
9. **Ivan "Intimidator"** - Psychological warfare
10. **Julia "Jinx"** - Claims to control luck

### Craps Implementation
- All 64 bet types implemented
- Chainlink VRF for provable randomness
- Gas-optimized settlement (<500k gas)
- ERC4626 vaults for LP management

---

## 📁 Project Structure

```
contracts/
├── ens/                 # ENS integration ($10,000 prize)
├── crosschain/          # Circle CCTP V2 & LayerZero
├── gasless/            # Paymaster & Gas Station
├── hooks/              # Uniswap V4 hooks
├── game/               # Core game logic
├── vault/              # ERC4626 LP vaults
└── token/              # BOT token

scripts/
├── deploy-ens-integration.ts
├── deploy-cctp-integration.ts
├── test-cross-chain-complete.ts
└── demo-for-video.sh

frontend/
└── cli/                # Interactive casino CLI
```

---

## 🧪 Testing

```bash
# Run comprehensive test suite
npm run test:cross-chain

# Test specific integrations
npm run test:ens
npm run test:circle
npm run test:layerzero

# Check prize qualifications
npm run prizes:check
```

---

## 🚢 Deployment

### Deployed Networks:
- ✅ Base Sepolia (Primary)
- ✅ Arbitrum Sepolia (Cross-chain)
- ✅ Avalanche Testnet (Gateway)

### Deploy Commands:
```bash
# Deploy all contracts
npm run deploy:all-chains

# Deploy specific integrations
npm run deploy:ens
npm run deploy:cctp
npm run deploy:paymaster
npm run deploy:gateway
npm run deploy:layerzero
npm run deploy:uniswap-hook
```

---

## 📹 Demo Video Script

Our 3-minute demo shows:
1. **ENS Resolution** - Bot names resolving (alice.rng.eth)
2. **L2 Primary Names** - Player setting "degen.legend"
3. **Cross-chain Deposit** - USDC from Arbitrum to Base
4. **Gasless Transaction** - Playing without ETH
5. **USDC Gas Payment** - Paying fees in USDC
6. **Instant Access** - Unified balance across chains
7. **Bot Gameplay** - AI personalities making decisions
8. **Uniswap Hook** - 2% fee collection in action

---

## 🔗 Links

- **GitHub**: https://github.com/happybigmtn/barely-human
- **Live Demo**: https://barelyhuman.casino
- **Video Demo**: [YouTube Link]
- **Documentation**: [Full Technical Docs](./docs)

---

## 👥 Team

**Barely Human Studio** - Building at the intersection of AI, DeFi, and gaming

---

## 🎯 Why We Win

1. **Complete Integration** - We've integrated EVERY required tool
2. **Innovative Use Cases** - AI bots with ENS identities is unique
3. **Production Ready** - Not just a hackathon project, ready to ship
4. **User Experience** - Gasless, instant, multichain - the future of DeFi
5. **Technical Excellence** - Clean code, comprehensive tests, documentation

---

## 📞 Contact

For judges' questions or demo requests:
- GitHub Issues: [Create Issue](https://github.com/happybigmtn/barely-human/issues)
- ETHGlobal Booth: Find us at the hacker area!

---

**Thank you for considering Barely Human Casino for the ETHGlobal NYC 2025 prizes!**

*May the odds be ever in your favor (unless you're playing against our bots)* 🎲