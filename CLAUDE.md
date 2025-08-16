# Barely Human - Project Context

## Quick Reference
**Project**: DeFi Casino with AI Bot Gamblers
**Stage**: Development Phase 1 - Core Infrastructure
**Stack**: Solidity 0.8.31, Hardhat, ElizaOS, Chainlink VRF
**Networks**: Base (8453), Base Sepolia (84532), Unichain (TBD)

## Current Focus
- [ ] Implement BOT token contract (ERC20 with roles)
- [ ] Create vault system for LP management
- [ ] Set up Chainlink VRF integration
- [ ] Begin craps game logic (64 bet types)
- [ ] Initialize testing framework

## Critical Development Rules

### ALWAYS Before Completing Any Task
1. Run linting: `npm run lint`
2. Run type checking: `npm run typecheck`  
3. Run tests: `npm test`
4. Check gas usage: `npm run gas-report`
5. Update documentation if needed

### Code Standards
- **Solidity**: Strictly 0.8.31, use OpenZeppelin contracts
- **Security**: ReentrancyGuard on fund transfers, AccessControl for roles
- **Gas**: Optimize with storage packing, batch operations, inline functions
- **Testing**: Minimum 90% coverage, test all 64 bet types
- **No shortcuts**: Fix errors properly, no workarounds

### Project Structure
```
contracts/        # Smart contracts ONLY
├── token/       # BOT ERC20
├── vault/       # LP vaults (ERC4626)
├── game/        # Craps logic & VRF
├── staking/     # Reward distribution
├── nft/         # Generative art & raffles
├── hooks/       # Uniswap V4 2% fee
└── treasury/    # Fee management

scripts/         # Deployment scripts
tests/          # Test files (90% coverage required)
docs/           # Documentation (FULL_BLUEPRINT.md for reference)
frontend/       # CLI application
backend/        # ElizaOS agents
```

## Smart Contract Architecture

### 1. BOT Token (contracts/token/BOTToken.sol)
```solidity
contract BOTToken is ERC20, AccessControl {
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant STAKING_ROLE = keccak256("STAKING_ROLE");
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10**18;
}
```
- Fixed supply: 1B tokens
- No transfer fees (fees via Uniswap V4 hooks)
- Roles: TREASURY_ROLE, STAKING_ROLE

### 2. Vault System (contracts/vault/BotVault.sol)
- ERC4626 compliant for LP shares
- Performance fee: 2% on profits
- Functions: `deposit()`, `withdraw()`, `placeBet()`, `settleBet()`
- Funds never leave vault (internal accounting)

### 3. Game Coordinator (contracts/game/GameCoordinator.sol)
- Chainlink VRF for randomness
- Game phases: IDLE, COME_OUT, POINT
- Series tracking with unique IDs
- Callback gas limit: 200k

### 4. Craps Bet Types (contracts/game/CrapsBetTypes.sol)
All 64 types implemented:
- 0-3: Line bets (Pass/Don't Pass/Come/Don't Come)
- 4: Field
- 5-24: YES/NO bets
- 25-28: Hardways
- 29-32: Odds (true odds, 0% house edge)
- 33-42: Bonus (Fire, Small/Tall/All, etc.)
- 43-53: NEXT (one-roll)
- 54-63: Repeater

### 5. Staking (contracts/staking/StakingPool.sol)
- Single-token staking (BOT only)
- Rewards from: 2% swap fees + performance fees
- Accumulative reward model
- Functions: `stake()`, `unstake()`, `claimRewards()`

### 6. NFT System (contracts/nft/GachaMintPass.sol)
- Weighted raffle after each series
- Mint passes redeemable for generative art
- Deterministic art from VRF seed
- Bot-specific art styles

## AI Bot Personalities (10 Total)

1. **Alice "All-In"** - Aggressive high-roller
2. **Bob "The Calculator"** - Statistical analyzer  
3. **Charlie "Lucky Charm"** - Superstitious
4. **Diana "Ice Queen"** - Cold, methodical
5. **Eddie "The Entertainer"** - Showman
6. **Fiona "Fearless"** - Never backs down
7. **Greg "The Grinder"** - Steady, consistent
8. **Helen "Hot Streak"** - Momentum believer
9. **Ivan "The Intimidator"** - Psychological warfare
10. **Julia "Jinx"** - Claims to control luck

Each bot needs:
- Character file (YAML)
- Unique traits (3-5)
- Dialogue style
- Blockchain plugin access
- Memory persistence

## External Integrations

### Required
- **Chainlink VRF**: Dice rolls & raffle (subscription ID needed)
- **Uniswap V4**: 2% swap fee via hooks
- **The Graph**: Data indexing (deploy subgraph)
- **OpenZeppelin**: Contract libraries

### Optional
- **ENS**: Name resolution
- **OpenSea**: NFT marketplace
- **Circle/Coinbase**: Fiat onramps
- **Privy**: Web3 auth

## Testing Requirements

### Coverage Targets
- Contracts: 90% minimum
- All 64 bet types tested individually
- Edge cases and failures covered
- Gas benchmarks documented

### Test Structure
```javascript
describe("ContractName", () => {
    describe("functionName", () => {
        it("should handle normal case", async () => {});
        it("should revert on invalid input", async () => {});
        it("should emit correct events", async () => {});
    });
});
```

## CLI Commands Reference

```bash
# Development
npm install              # Install dependencies
npm test                # Run tests
npm run lint            # Check code style
npm run typecheck       # Type checking
npm run gas-report      # Gas usage analysis

# Hardhat
npx hardhat compile     # Compile contracts
npx hardhat test        # Run tests
npx hardhat coverage    # Coverage report
npx hardhat deploy      # Deploy contracts

# Git Flow
git checkout -b feature/name  # New feature
git commit -m "type(scope): description"
# Types: feat, fix, docs, test, refactor
```

## Deployment Checklist

### Before Testnet
- [ ] All tests passing (90% coverage)
- [ ] Gas optimization complete
- [ ] Documentation updated
- [ ] Internal security review
- [ ] Integration tests passed

### Before Mainnet
- [ ] External audit complete
- [ ] Bug bounty program active
- [ ] Performance benchmarks met
- [ ] Deployment scripts tested
- [ ] Emergency procedures documented

## Current Implementation Status

### ✅ MAJOR SESSION COMPLETED (2025-08-16)
**Repository**: https://github.com/happybigmtn/barely-human

#### Core Game Implementation (COMPLETE)
- **CrapsGame.sol**: Main game logic with VRF integration ✅
- **CrapsBets.sol**: All 64 bet types with gas optimization ✅  
- **CrapsSettlement.sol**: Comprehensive payout system ✅
- **ICrapsGame.sol**: Complete interface definitions ✅

#### Vault & Bot System (COMPLETE)
- **CrapsVault.sol**: ERC4626-compliant vault for LPs ✅
- **VaultFactory.sol**: Factory for 10 bot vaults ✅
- **BotManager.sol**: 10 AI personalities with strategies ✅

#### Testing Suite (COMPLETE)
- **3200+ lines of test code** across 5 test files ✅
- **100% coverage** of all 64 bet types ✅
- **Gas optimization** testing and reporting ✅
- **Mock contracts** for VRF and tokens ✅

#### Security & Performance (COMPLETE)
- ReentrancyGuard on all external functions ✅
- AccessControl with role-based permissions ✅
- Pausable functionality for emergencies ✅
- Gas limits: Settlement <500k, Bets <200k ✅

### 📋 Next Phase (Ready to Start)
1. **Frontend/CLI Development**: User interface implementation
2. **ElizaOS Integration**: Connect AI personalities to game logic
3. **Deployment Scripts**: Configure for Base/Unichain networks
4. **NFT Mint Pass System**: Implement generative art rewards
5. **BOT Token Economics**: Staking and tokenomics implementation

## Quick Contract Templates

### Access Control Pattern
```solidity
contract MyContract is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        _;
    }
}
```

### VRF Integration Pattern
```solidity
contract GameVRF is VRFConsumerBaseV2 {
    function requestRandomness() internal returns (uint256) {
        return COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            3, // confirmations
            200000, // callback gas
            1 // num words
        );
    }
}
```

### Vault Deposit Pattern
```solidity
function deposit(uint256 assets) public returns (uint256 shares) {
    shares = previewDeposit(assets);
    _mint(msg.sender, shares);
    IERC20(asset).transferFrom(msg.sender, address(this), assets);
    emit Deposit(msg.sender, assets, shares);
}
```

## Security Reminders

- **Never** expose private keys in code
- **Always** use ReentrancyGuard for transfers
- **Always** validate inputs with require/revert
- **Never** use tx.origin for auth
- **Always** emit events for state changes
- **Always** test edge cases

## Performance Guidelines

- Pack storage variables (use uint128, uint64 when possible)
- Batch operations to save gas
- Use events instead of storage for logs
- Inline small functions with @inline
- Cache array lengths in loops

## Documentation Links

- [Full Blueprint](docs/FULL_BLUEPRINT.md) - Complete original specification
- [Chainlink VRF Docs](https://docs.chain.link/vrf/v2/introduction)
- [Uniswap V4 Hooks](https://docs.uniswap.org/contracts/v4/overview)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/4.x/)
- [Base Network Docs](https://docs.base.org/)

## MCP Servers (Installed)

✅ **All MCP servers have been installed and configured:**
- **context7-mcp**: Documentation & code examples lookup
- **mcp-server-playwright**: Browser automation testing
- **task-master-mcp**: Task management & orchestration

Config location: `~/.config/claude/claude_desktop_config.json`
Servers installed globally via npm in: `/home/r/.local/share/mise/installs/node/22.18.0/bin/`

## Session Summary (2025-08-16)

### Major Accomplishments
- **Complete Craps game implementation** with all 64 bet types
- **10 AI bot personalities** with unique betting strategies  
- **ERC4626 vault system** for LP management with 2% performance fees
- **Comprehensive test suite** with 3200+ lines and full coverage
- **GitHub repository created** and deployed: https://github.com/happybigmtn/barely-human

### Technical Decisions Made
- **Modular architecture**: Separated game logic, bet management, settlement
- **Interface-based design**: Flexible contract communication via ICrapsGame
- **Gas optimization**: Bitmap tracking, batch processing, storage packing
- **Security first**: ReentrancyGuard, AccessControl, Pausable patterns
- **Standard compliance**: ERC4626 vaults, OpenZeppelin best practices

### Files Created This Session
```
contracts/game/
├── CrapsGame.sol (524 lines) - Main game logic with VRF
├── CrapsBets.sol (687 lines) - All 64 bet types  
├── CrapsSettlement.sol (892 lines) - Settlement logic
├── BotManager.sol (743 lines) - 10 AI personalities
└── ICrapsGame.sol (156 lines) - Interface definitions

contracts/vault/  
├── CrapsVault.sol (445 lines) - ERC4626 LP vault
└── VaultFactory.sol (287 lines) - Bot vault factory

test/
├── CrapsGame.test.js (524 lines)
├── CrapsBets.test.js (756 lines)  
├── CrapsSettlement.test.js (623 lines)
├── CrapsVault.test.js (734 lines)
├── BotManager.test.js (658 lines)
├── helpers/TestHelpers.js (267 lines)
└── GasReporter.js (89 lines)
```

### Performance Metrics Achieved
- **Settlement**: <500k gas for 10 players
- **Bet placement**: <200k gas per bet
- **Vault operations**: <250k gas
- **Contract compilation**: All successful
- **Test coverage**: 100% of critical paths

### Next Session Priorities
1. **Frontend CLI**: Build terminal interface
2. **ElizaOS**: Integrate AI personalities  
3. **Deployment**: Configure Base/Unichain
4. **NFT system**: Mint pass rewards
5. **Token economics**: BOT staking system

### Repository Status
- **Branch**: main
- **Latest commit**: feat: Complete Craps game implementation with all 64 bet types
- **Status**: Ready for next development phase
- **Tests**: All passing (`npm test`)
- **GitHub**: https://github.com/happybigmtn/barely-human

## Session Start: 2025-08-16

### Session Context
- **Time**: Starting new development session
- **Previous Work**: Core game contracts complete with full test coverage
- **Git Status**: Repository initialized, ready for initial commit
- **Focus Areas**: Ready to begin next phase of development

### Session Goals
- [x] Set up initial git repository and make first commit
- [x] Choose next development priority from the roadmap
- [x] Begin implementation of selected feature

### Session Progress
- ✅ **BOT Token Contract Completed**
  - Created `contracts/token/BOTToken.sol` with full implementation
  - ERC20 with AccessControl for role-based permissions
  - Fixed supply of 1 billion tokens with proper allocations
  - TREASURY_ROLE and STAKING_ROLE for protocol operations
  - Pausable functionality for emergency situations
  - Burn functionality for deflationary mechanics
  - Comprehensive test suite created
  - Deployment script ready for all networks

### Technical Details - BOT Token
- **Contract**: `contracts/token/BOTToken.sol`
- **Supply**: 1,000,000,000 BOT (fixed, no inflation)
- **Allocations**:
  - Treasury: 20% (200M BOT)
  - Liquidity: 30% (300M BOT)
  - Staking Rewards: 25% (250M BOT)
  - Team: 15% (150M BOT)
  - Community: 10% (100M BOT)
- **Key Features**:
  - No transfer fees (fees via Uniswap V4 hooks)
  - Role-based access control
  - Pausable transfers for emergencies
  - Burn functionality
  - Gas optimized with `_update` hook

### Next Development Priorities
1. **Staking Pool Contract**: Build single-token staking with reward distribution
2. **NFT Mint Pass System**: Create generative art rewards system
3. **Treasury Contract**: Manage fee collection and distribution
4. **Frontend CLI**: Terminal interface for game interaction
5. **Deployment to Testnet**: Deploy all contracts to Base Sepolia