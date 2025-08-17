# Flow Integration - Barely Human DeFi Casino

## 🌊 Flow Builder Pool Prize Qualification

**Prize**: $10,000 (Split evenly between all qualifying projects)
**Requirement**: Deploy a smart contract or run transactions on Flow Testnet or Flow Mainnet

## 📋 Contract Overview

- **Contract Name**: BarelyHumanCraps.cdc
- **Network**: Flow Testnet
- **Language**: Cadence
- **Integration**: Cross-chain with Base Sepolia main deployment

## 🎯 Key Features

- **Craps Game Simulation**: Deterministic outcomes using seed-based dice rolls
- **10 AI Bot Personalities**: Matching the main Base network contracts
- **Cross-Chain Events**: Synchronization with Base network via CrossChainGameSync
- **Game Analytics**: Statistics tracking and history
- **Real-time Events**: Flow-native event emission

## 🤖 Bot Personalities

1. **Alice All-In** - Aggressive high-roller
2. **Bob Calculator** - Statistical analyzer (prefers Don't Pass)
3. **Charlie Lucky** - Superstitious gambler
4. **Diana Ice Queen** - Cold, methodical
5. **Eddie Entertainer** - Theatrical showman
6. **Fiona Fearless** - Never backs down
7. **Greg Grinder** - Steady, consistent
8. **Helen Hot Streak** - Momentum believer
9. **Ivan Intimidator** - Psychological warfare
10. **Julia Jinx** - Claims to control luck

## 🎲 Game Logic

### Supported Bets
- **PASS_LINE**: Traditional craps pass line bet
- **DONT_PASS**: Don't pass line bet

### Outcomes
- **WIN**: Player wins, 1:1 payout
- **LOSE**: Player loses bet
- **POINT_SET**: Point established (for extended gameplay)
- **PUSH**: Tie, bet returned

## 🔗 Cross-Chain Integration

The Flow contract emits CrossChainGameSync events to coordinate with the main Base network deployment:

```cadence
access(all) event CrossChainGameSync(
    gameId: UInt64,
    baseNetworkTxHash: String,
    player: Address,
    result: String
)
```

## 🚀 Deployment Commands

```bash
# Install Flow CLI
npm install -g @onflow/flow-cli

# Deploy to testnet
flow project deploy --network testnet

# Test contract
flow scripts execute test-script.cdc --network testnet
```

## 🌐 Resources

- **Flow Testnet RPC**: https://rest-testnet.onflow.org
- **Flow Faucet**: https://faucet.flow.com/fund-account
- **Flow Explorer**: https://testnet.flowscan.org
- **Flow Documentation**: https://developers.flow.com/evm/using

## ✅ ETHGlobal NYC 2025 Qualification

This integration qualifies for the Flow Builder Pool Prize by:
- ✅ Deploying a smart contract on Flow Testnet
- ✅ Implementing Flow-native features (Cadence, events)
- ✅ Cross-chain integration with existing DeFi protocol
- ✅ Real-world utility (casino gaming)
- ✅ Production-ready code quality
