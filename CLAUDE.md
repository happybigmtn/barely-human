# Barely Human - DeFi Casino with AI Bot Gamblers

## Quick Reference
- **Project**: DeFi Casino with AI Bot Gamblers  
- **Stack**: Solidity 0.8.28, Hardhat 3.0, Viem, ElizaOS, Chainlink VRF
- **Networks**: Base (8453), Base Sepolia (84532)
- **Repository**: https://github.com/happybigmtn/barely-human

## Critical Development Rules

### ALWAYS Before Completing Any Task
1. Run linting: `npm run lint`
2. Run type checking: `npm run typecheck`  
3. Run tests: `npm test`
4. Check gas usage: `npm run gas-report`

### Code Standards
- **Solidity**: Version 0.8.28, use OpenZeppelin contracts v5.x
- **Security**: ReentrancyGuard on fund transfers, AccessControl for roles
- **Gas**: Optimize with storage packing, batch operations
- **Testing**: Minimum 90% coverage
- **No shortcuts**: Fix errors properly, no workarounds

## Hardhat 3 + Viem Testing Framework

### Critical Pattern for Tests
```typescript
import { network } from "hardhat";

// CORRECT: Access viem through network.connect()
const connection = await network.connect();
const { viem } = connection;

// Get clients and deploy contracts
const publicClient = await viem.getPublicClient();
const contract = await viem.deployContract("ContractName", [args]);

// IMPORTANT: Close connection when done
await connection.close();
```

### Test Execution
- Run tests with: `npx hardhat run test/[filename].ts`
- NOT `npx hardhat test` (that's for Solidity tests in Hardhat 3)

## Project Structure
```
contracts/        # Smart contracts
├── token/       # BOT ERC20 token
├── vault/       # LP vaults (ERC4626)
├── game/        # Craps logic & VRF
├── staking/     # Reward distribution
├── treasury/    # Fee management
└── hooks/       # Uniswap V4 2% fee

scripts/         # Deployment scripts
test/           # Test files (Viem-based)
frontend/       # CLI application
```

## Smart Contract Architecture

### Core Contracts (All Deployed & Ready)
- **BOTToken**: ERC20 with roles, 1B fixed supply
- **CrapsGame**: Main game logic with VRF integration  
- **CrapsBets**: All 64 bet types implemented
- **CrapsVault**: ERC4626-compliant LP vaults
- **BotManager**: 10 AI personalities with strategies
- **Treasury**: Fee collection and distribution
- **StakingPool**: BOT token staking rewards

### 10 AI Bot Personalities
1. **Alice "All-In"** - Aggressive high-roller
2. **Bob "Calculator"** - Statistical analyzer  
3. **Charlie "Lucky"** - Superstitious gambler
4. **Diana "Ice Queen"** - Cold, methodical
5. **Eddie "Entertainer"** - Theatrical showman
6. **Fiona "Fearless"** - Never backs down
7. **Greg "Grinder"** - Steady, consistent
8. **Helen "Hot Streak"** - Momentum believer
9. **Ivan "Intimidator"** - Psychological warfare
10. **Julia "Jinx"** - Claims to control luck

## Essential Commands

```bash
# Development
npm install && npm test && npm run lint

# Hardhat 3 Testing
npx hardhat run test/[filename].ts

# Compilation
npx hardhat compile

# Deployment (Base Sepolia)
npx hardhat run scripts/deploy-base-sepolia-viem.ts --network baseSepolia
```

## Contract Templates

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

## Current Status
✅ **All core contracts deployed to Base Sepolia**  
✅ **200+ tests passing with 100% coverage**  
✅ **ElizaOS bot personalities configured**  
✅ **Production-ready architecture with proxy patterns**  
✅ **Gas optimized (40% reduction achieved)**

## Next Priorities
1. **Frontend CLI Enhancement** - Improve user interface
2. **NFT Mint Pass System** - Implement gacha rewards  
3. **Mainnet Deployment** - Production launch preparation
4. **External Audit** - Security review
5. **Performance Monitoring** - Analytics and alerts

## Security Reminders
- Never expose private keys in code
- Always use ReentrancyGuard for transfers
- Always validate inputs with require/revert
- Never use tx.origin for authentication
- Always emit events for state changes
- Always test edge cases

## Key Technical Notes
- Contract reads return structs as arrays (access with index)
- Function names must match exactly (case-sensitive)
- Use VaultFactoryOptimized instead of VaultFactory
- Call initializeBots() after BotManager deployment
- Token amounts: 1-10,000 BOT range for bets