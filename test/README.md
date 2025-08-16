# Craps Game Test Suite

Comprehensive test coverage for the Barely Human Craps game smart contracts.

## Test Structure

### Core Test Files

1. **CrapsGame.test.js** - Core game mechanics
   - Game phase transitions (IDLE -> COME_OUT -> POINT)
   - Dice roll processing and VRF integration
   - Point establishment and resolution
   - Seven-out scenarios
   - Shooter state tracking

2. **CrapsBets.test.js** - All 64 bet types
   - Pass/Don't Pass line bets
   - Come/Don't Come bets
   - Odds bets with true odds payouts
   - Field bets with special payouts
   - Hardway bets
   - Single-roll proposition bets
   - Place/Lay (YES/NO) bets
   - Bonus bets (Fire, Small/Tall/All, etc.)

3. **CrapsSettlement.test.js** - Settlement logic
   - Payout calculations for each bet type
   - Batch settlement processing
   - Gas optimization limits
   - Edge cases and error conditions

4. **CrapsVault.test.js** - Vault functionality
   - ERC4626 compliance
   - Deposit/withdrawal mechanics
   - Performance fee calculations
   - Bet locking/unlocking
   - LP tracking for raffles

5. **BotManager.test.js** - Bot automation
   - Strategy execution for each bot personality
   - Bet amount calculations
   - Dynamic strategy switching
   - Session management

### Helper Utilities

- **TestHelpers.js** - Common test utilities
  - Contract deployment helpers
  - Dice roll simulation
  - Payout calculation
  - Gas usage tracking
  - Account funding

- **GasReporter.js** - Gas optimization analysis
  - Transaction gas tracking
  - Contract deployment costs
  - Method gas profiling
  - Optimization recommendations

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:game       # Game mechanics
npm run test:bets       # Bet placement
npm run test:settlement # Settlement logic
npm run test:vault      # Vault operations
npm run test:bot        # Bot manager

# Run with coverage report
npm run test:coverage

# Run with gas reporting
npm run test:gas
```

## Test Coverage

The test suite covers:

- ✅ All 64 bet types
- ✅ Game phase transitions
- ✅ VRF randomness integration
- ✅ Payout calculations
- ✅ Batch processing
- ✅ Access control
- ✅ Emergency functions
- ✅ Gas optimization
- ✅ Edge cases and error conditions

## Key Test Scenarios

### Game Flow
- Come-out roll naturals (7, 11)
- Come-out roll craps (2, 3, 12)
- Point establishment (4, 5, 6, 8, 9, 10)
- Point made
- Seven out

### Bet Resolution
- Pass/Don't Pass wins and losses
- Field bet special payouts (2 and 12 pay 2:1)
- Hardway wins vs easy ways
- True odds calculations
- Come/Don't Come point tracking

### Bot Strategies
- Conservative (low risk, small bets)
- Aggressive (high risk, large bets)
- Martingale (double after loss)
- Fibonacci sequence
- Adaptive (adjusts to bankroll)

### Vault Operations
- LP deposits and withdrawals
- Share price calculations
- Performance fee extraction
- Bet locking for active games
- Emergency withdrawals

## Gas Benchmarks

Expected gas usage for common operations:

| Operation | Gas Usage |
|-----------|-----------|
| Place Pass Bet | < 200,000 |
| Place Field Bet | < 150,000 |
| Dice Roll | < 200,000 |
| Settlement (10 players) | < 500,000 |
| Vault Deposit | < 250,000 |
| Vault Withdraw | < 200,000 |
| Bot Bet Execution | < 300,000 |

## Mock Contracts

The test suite includes mocks for:
- VRF Coordinator (Chainlink VRF)
- ERC20 Token (USDC)

## Environment Setup

Tests use Hardhat's local network with:
- Chain ID: 1337
- Auto-mining enabled
- Reset between test suites
- Deterministic accounts

## Continuous Integration

The test suite is designed to run in CI/CD pipelines:
- All tests must pass before deployment
- Gas usage tracked for regression
- Coverage must remain above 90%

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all edge cases are covered
3. Add gas benchmarks for new operations
4. Update this README with new test scenarios