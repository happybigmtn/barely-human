# Barely Human Casino - Enhanced CLI Documentation

## Overview

The Enhanced CLI provides comprehensive non-interactive testing capabilities for all smart contract functions in the Barely Human Casino ecosystem. It supports local Hardhat nodes, Base Sepolia testnet, and includes advanced features like gas reporting, batch operations, and bot simulations.

## Features

### ✅ Complete Non-Interactive Mode
- All commands accept CLI arguments to avoid interactive prompts
- Batch operation support via command files
- Comprehensive error handling and validation

### ✅ Multi-Network Support
- **Local Hardhat Node**: `--network local` (default)
- **Base Sepolia Testnet**: `--network baseSepolia`
- Automatic network detection and contract address resolution

### ✅ Comprehensive Contract Testing
- **BOTToken**: Balance checks, transfers, approvals
- **CrapsGame**: Betting, dice rolling, game state management
- **Vaults**: Deposits, withdrawals, performance tracking
- **Staking**: Token staking, reward claiming
- **Bot Manager**: AI personality simulation and testing
- **Treasury**: Fee collection and distribution tracking

### ✅ Advanced Features
- **Gas Reporting**: Detailed gas usage analysis for each transaction
- **Transaction Receipts**: Complete transaction information
- **Bot Simulation**: AI personality testing with configurable strategies
- **Batch Operations**: Execute multiple commands from files
- **Error Recovery**: Robust error handling with detailed reporting

## Command Line Interface

### Basic Usage
```bash
# Interactive mode (default)
npm run cli

# Show help
npm run cli:help

# Run all tests with gas reporting
npm run cli:test

# Run specific network tests
npm run cli:test-local
npm run cli:test-sepolia
```

### Non-Interactive Commands

#### Game Operations
```bash
# Place a bet and roll dice
npm run cli -- --network local --non-interactive --command bet --amount 100 --bet-type 0 --gas-report

# Roll dice only
npm run cli -- --network local --non-interactive --command roll --gas-report
```

#### Vault Operations
```bash
# Deposit to vault
npm run cli -- --network local --non-interactive --command vault-deposit --amount 1000 --gas-report

# Withdraw from vault  
npm run cli -- --network local --non-interactive --command vault-withdraw --amount 500 --gas-report
```

#### Staking Operations
```bash
# Stake BOT tokens
npm run cli -- --network local --non-interactive --command stake --amount 200 --gas-report

# Unstake BOT tokens
npm run cli -- --network local --non-interactive --command unstake --amount 100 --gas-report

# Claim staking rewards
npm run cli -- --network local --non-interactive --command claim-rewards --gas-report
```

#### Bot Simulations
```bash
# Simulate bot playing (Alice All-In, 5 rounds)
npm run cli -- --network local --non-interactive --command bot-play --bot-id 0 --rounds 5 --gas-report

# Simulate different bot personalities
npm run cli -- --network local --non-interactive --command bot-play --bot-id 1 --rounds 3 --gas-report
```

### Batch Operations
```bash
# Execute commands from batch file
npm run cli:batch

# Custom batch file
npm run cli -- --network local --batch-file my-test-commands.txt --gas-report
```

## Bot Personalities & Strategies

The CLI includes 10 unique AI bot personalities, each with distinct betting strategies:

| Bot ID | Name | Emoji | Strategy | Bet Amount | Preferred Bet |
|--------|------|-------|----------|------------|---------------|
| 0 | Alice All-In | 🎯 | Aggressive high-roller | 100 BOT | Pass Line |
| 1 | Bob Calculator | 🧮 | Statistical analyzer | 25 BOT | Field |
| 2 | Charlie Lucky | 🍀 | Superstitious gambler | 50 BOT | Come |
| 3 | Diana Ice Queen | ❄️ | Cold, methodical | 20 BOT | Don't Pass |
| 4 | Eddie Entertainer | 🎭 | Theatrical showman | 75 BOT | Big 6 |
| 5 | Fiona Fearless | ⚡ | Never backs down | 150 BOT | Pass Line |
| 6 | Greg Grinder | 💎 | Steady, consistent | 10 BOT | Hard 4 |
| 7 | Helen Hot Streak | 🔥 | Momentum believer | 200 BOT | Any Seven |
| 8 | Ivan Intimidator | 👹 | Psychological warfare | 30 BOT | Don't Pass |
| 9 | Julia Jinx | 🌀 | Claims to control luck | 13 BOT | Any Craps |

## Bet Types Reference

The CLI supports all 64 craps bet types:

### Core Bets (0-6)
- **0**: Pass Line - Basic winning bet
- **1**: Don't Pass - Opposite of Pass Line
- **2**: Come - Similar to Pass Line during point phase
- **3**: Don't Come - Opposite of Come
- **4**: Field - One-roll bet on specific numbers
- **5**: Big 6 - Betting 6 comes before 7
- **6**: Big 8 - Betting 8 comes before 7

### Place Bets (7-12)
- Place bets on numbers 4, 5, 6, 8, 9, 10

### Buy Bets (13-18)
- Buy bets with better odds on numbers 4, 5, 6, 8, 9, 10

### Lay Bets (19-24)
- Betting against numbers 4, 5, 6, 8, 9, 10

### Hard Ways (25-28)
- Hard 4, Hard 6, Hard 8, Hard 10

### Proposition Bets (29-63)
- One-roll bets, hop bets, horn bets, etc.

## Gas Reporting

When using `--gas-report`, the CLI provides detailed gas analysis:

```
⛽ Gas Usage Report

┌─────────────────────────┬────────────┬───────────────┬─────────────────────────┐
│ Contract.Method         │ Gas Used   │ Gas Cost (ETH)│ Tx Hash                 │
├─────────────────────────┼────────────┼───────────────┼─────────────────────────┤
│ BOTToken.approve        │ 46394      │ 0.000046394   │ 0x1234567890abcdef...   │
│ CrapsBets.placeBet      │ 124587     │ 0.000124587   │ 0xabcdef1234567890...   │
│ CrapsGame.rollDice      │ 89234      │ 0.000089234   │ 0x567890abcdef1234...   │
└─────────────────────────┴────────────┴───────────────┴─────────────────────────┘
Total Gas Cost: 0.000260215 ETH
```

## Batch File Format

Create text files with commands (one per line):

```bash
# Sample batch test file
# Lines starting with # are comments

# Place some bets
--command bet --amount 10 --bet-type 0
--command roll
--command bet --amount 25 --bet-type 4
--command roll

# Test vault operations
--command vault-deposit --amount 100
--command vault-withdraw --amount 50

# Bot simulations
--command bot-play --bot-id 0 --rounds 2
--command bot-play --bot-id 1 --rounds 1
```

## Network Configuration

### Local Hardhat Node
```javascript
{
  rpcUrl: 'http://127.0.0.1:8545',
  chainId: 31337,
  deploymentFile: 'localhost.json'
}
```

### Base Sepolia Testnet
```javascript
{
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  chainId: 84532,
  deploymentFile: 'base-sepolia-deployment.json'
}
```

## Error Handling

The CLI provides comprehensive error reporting:

- **Network Connection Errors**: RPC connectivity issues
- **Contract Errors**: Invalid function calls, insufficient funds
- **Validation Errors**: Invalid parameters, missing arguments
- **Gas Estimation Failures**: Transaction simulation problems

## Testing Examples

### Complete System Test
```bash
# Run comprehensive test suite
npm run cli:test-local

# Test with specific network
npm run cli -- --network baseSepolia --test --gas-report
```

### Individual Component Tests
```bash
# Test game mechanics
npm run cli:bet

# Test vault system
npm run cli:vault

# Test bot AI
npm run cli:bot-demo
```

### Performance Testing
```bash
# Batch operations for load testing
npm run cli:batch

# Multiple bot simulations
npm run cli -- --network local --non-interactive --command bot-play --bot-id 0 --rounds 10 --gas-report
```

## Integration with Development Workflow

1. **Start Local Node**: `npm run node`
2. **Deploy Contracts**: `npm run deploy:local`
3. **Run CLI Tests**: `npm run cli:test-local`
4. **Debug Issues**: Use `--gas-report` for transaction analysis
5. **Batch Testing**: Create custom batch files for specific scenarios

## Exit Codes

- **0**: Success - All operations completed successfully
- **1**: Failure - One or more operations failed
- **Error Details**: Available in test results summary

## Environment Variables

Required environment variables for different networks:

```bash
# Local development
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Base Sepolia
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
DEPLOYER_PRIVATE_KEY="your_sepolia_private_key"
```

This enhanced CLI provides a complete testing framework for the Barely Human Casino, enabling thorough validation of all smart contract functions with detailed reporting and flexible execution options.