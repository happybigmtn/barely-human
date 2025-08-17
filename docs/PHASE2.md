# Phase 2 Implementation Plan - ETHGlobal NYC 2025

## Executive Summary
Barely Human Casino has completed Phase 1 with full game logic, AI bots, and Uniswap V4 hooks. Phase 2 focuses on cross-chain expansion and stablecoin integration to maximize prize qualifications.

## Prize Qualification Status

### ✅ Already Qualified
| Sponsor | Requirements Met | Status |
|---------|-----------------|--------|
| **Uniswap V4** | Custom hooks with 2% fee | ✅ Complete |
| **Coinbase** | Base deployment, OnchainKit | ✅ Ready |
| **The Graph** | Subgraph schema complete | ✅ Ready |
| **Hardhat 3** | Using v3.0.0-beta.13 | ✅ Complete |

### 🚧 Need Implementation
| Sponsor | Missing Components | Priority |
|---------|-------------------|----------|
| **LayerZero** | V2 OApp implementation | 🔴 Critical |
| **Circle** | USDC pools, CCTP bridge | 🟡 High |
| **Dynamic** | Wallet abstraction | 🟡 High |
| **Hyperlane** | Cross-chain messaging | 🟡 High |
| **Flow** | Flow testnet deployment | 🟢 Medium |

## Amended Uniswap V4 Strategy

### USDC Pool Implementation (Circle Prize)
```solidity
// Deploy USDC/BOT pool with our hook for Circle prize
PoolKey memory usdcPool = PoolKey({
    currency0: USDC_ADDRESS,        // Circle's USDC
    currency1: BOT_TOKEN_ADDRESS,    // Our BOT token
    fee: 3000,                       // 0.3% fee tier
    tickSpacing: 60,
    hooks: BOT_SWAP_FEE_HOOK        // Our 2% fee hook
});
```

### Multi-Stablecoin Support
1. **USDC/BOT Pool** - Primary for Circle prize
2. **USDT/BOT Pool** - Tether integration
3. **DAI/BOT Pool** - MakerDAO integration
4. **ETH/BOT Pool** - Already implemented

## Phase 2 Architecture

### Cross-Chain Infrastructure
```
Base Sepolia (Primary Chain)
├── Core Contracts
│   ├── CrapsGame.sol
│   ├── BOTToken.sol
│   ├── Treasury.sol
│   └── BotSwapFeeHookV4.sol
├── Stablecoin Vaults
│   ├── USDCVault.sol (NEW)
│   ├── USDTVault.sol (NEW)
│   └── DAIVault.sol (NEW)
└── Cross-Chain
    ├── LayerZeroEndpoint.sol (NEW)
    ├── CircleCCTPBridge.sol (NEW)
    └── HyperlaneMailbox.sol (NEW)

Arbitrum Sepolia (Secondary)
├── BOTTokenOApp.sol (LayerZero V2)
├── SimplifiedVaults.sol
└── CrossChainCoordinator.sol

Flow Testnet (Tertiary)
├── FlowCrapsGame.cdc
├── FlowBOTToken.cdc
└── FlowBridge.cdc
```

## Implementation Priorities

### Week 1: Cross-Chain Foundation
**Goal**: LayerZero V2 integration for prize qualification

> **📋 Reference**: See [LayerZero Omnichain Architecture](./LAYERZERO_OMNICHAIN_ARCHITECTURE.md) for complete technical specifications

#### Day 1-2: Package Installation & Setup
```bash
# Critical V2 packages (V1 will disqualify)
npm install @layerzerolabs/lz-evm-oapp-v2@^2.3.40
npm install @layerzerolabs/lz-evm-protocol-v2@^2.3.40
npm install @layerzerolabs/lz-evm-messagelib-v2@^2.3.40
```

#### Day 3-4: OmniVault Implementation
Following the hub-spoke architecture detailed in the omnichain architecture document:
- **Hub Chain (Base Sepolia)**: Deploy `OmniVaultCoordinator.sol`
- **Spoke Chains**: Deploy `SpokeVaultProxy.sol` on Arbitrum Sepolia
- **Message Protocol**: Implement cross-chain deposit/withdrawal messaging

#### Day 5-7: Deploy & Test Cross-Chain
- Deploy complete omnichain vault system
- Test cross-chain LP deposits and state synchronization
- Validate security controls and emergency mechanisms

### Week 2: Stablecoin Integration
**Goal**: Circle USDC integration for broader accessibility

#### Day 8-9: USDC Vault Implementation
```solidity
contract USDCBotVault is ERC4626, IVault {
    IERC20 public constant USDC = IERC20(0x...); // Circle USDC
    
    function deposit(uint256 assets) public override returns (uint256) {
        // Accept USDC deposits for betting
    }
    
    function placeBet(uint256 amount, uint8 betType) external {
        // Allow USDC betting alongside BOT
    }
}
```

#### Day 10-11: Circle CCTP Integration
```solidity
contract CircleCCTPIntegration {
    ITokenMessenger public tokenMessenger;
    
    function bridgeUSDC(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 recipient
    ) external {
        USDC.approve(address(tokenMessenger), amount);
        tokenMessenger.depositForBurn(
            amount,
            destinationDomain,
            recipient,
            address(USDC)
        );
    }
}
```

#### Day 12-14: Uniswap V4 USDC Pool
- Create USDC/BOT pool with hook
- Add initial liquidity
- Test swap fee collection

### Week 3: Enhanced UX & Multi-Chain
**Goal**: Dynamic wallet integration and Hyperlane messaging

#### Day 15-16: Dynamic Wallet Integration
```typescript
// Replace RainbowKit with Dynamic
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';

const config = {
    environmentId: DYNAMIC_ENV_ID,
    walletConnectors: [EthereumWalletConnectors],
    features: {
        socialSignIn: true,
        emailSignIn: true
    }
};
```

#### Day 17-18: Hyperlane Implementation
```solidity
contract HyperlaneMessenger is IMessageRecipient {
    IMailbox public mailbox;
    
    function dispatchBet(
        uint32 destination,
        bytes32 recipient,
        bytes calldata betData
    ) external payable {
        mailbox.dispatch(
            destination,
            recipient,
            betData
        );
    }
}
```

#### Day 19-21: Flow Blockchain Port
```cadence
// Flow Cadence contracts
pub contract BarelyHumanCasino {
    pub resource Bot {
        pub let id: UInt8
        pub let name: String
        pub var balance: UFix64
    }
    
    pub fun placeBet(amount: UFix64, betType: UInt8) {
        // Flow-native betting logic
    }
}
```

### Week 4: Polish & Deployment
**Goal**: Complete multi-chain deployment and documentation

#### Day 22-23: Multi-Chain Deployment
```bash
# Deploy to all required testnets
npm run deploy:base-sepolia
npm run deploy:arbitrum-sepolia
npm run deploy:flow-testnet
```

#### Day 24-25: Integration Testing
- Cross-chain bet synchronization
- USDC vault operations
- Dynamic wallet flows

#### Day 26-27: Documentation & Video
- Update README with multi-chain setup
- Create 3-minute demo video
- Prepare submission materials

#### Day 28: Final Submission
- Deploy to all testnets
- Submit to ETHGlobal portal
- Complete sponsor feedback forms

## Technical Specifications

### LayerZero V2 Configuration
```typescript
const lzConfig = {
    eid: {
        baseSepolia: 40245,
        arbitrumSepolia: 40231,
        // Flow EID when available
    },
    endpoints: {
        baseSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
        arbitrumSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f"
    }
};
```

### Circle USDC Addresses
```typescript
const USDC = {
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    arbitrumSepolia: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
};
```

### Hyperlane Configuration
```typescript
const hyperlaneConfig = {
    mailbox: {
        baseSepolia: "0x...", // Deploy mailbox
        arbitrumSepolia: "0x..."
    },
    igp: {
        baseSepolia: "0x...", // Interchain gas paymaster
        arbitrumSepolia: "0x..."
    }
};
```

## Stablecoin Pool Economics

### USDC Vault Benefits
1. **Lower Barrier**: Users can bet with stablecoins
2. **No Volatility**: Stable value for risk-averse players
3. **Circle Integration**: Qualifies for Circle prize
4. **Cross-Chain**: CCTP enables seamless bridging

### Pool Configuration
```solidity
struct StablecoinPoolConfig {
    address stablecoin;      // USDC/USDT/DAI
    uint256 minBet;          // 1 USDC
    uint256 maxBet;          // 10,000 USDC
    uint256 houseEdge;       // 2%
    bool acceptsDeposits;    // true
    bool crossChainEnabled;  // true for USDC (CCTP)
}
```

### Liquidity Incentives
- **USDC Depositors**: Earn BOT rewards + betting fees
- **LP Tokens**: vUSDC representing vault shares
- **Cross-Chain Yield**: Aggregate yields across chains

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| LayerZero V2 complexity | Start with simple token bridge |
| Multi-chain state sync | Use eventual consistency model |
| Circle CCTP delays | Implement async settlement |
| Flow language differences | Port minimal contract set |

### Economic Risks
| Risk | Mitigation |
|------|------------|
| USDC liquidity fragmentation | Incentivize concentrated liquidity |
| Cross-chain arbitrage | Rate limiting on bridges |
| Stablecoin depegs | Multiple stablecoin options |

## Success Metrics

### Prize Qualification
- [ ] Deploy to 3+ testnets (Base, Arbitrum, Flow)
- [ ] LayerZero V2 implementation working
- [ ] Circle USDC integration complete
- [ ] Dynamic wallet integration live
- [ ] Hyperlane messaging functional
- [ ] The Graph subgraph deployed
- [ ] Demo video recorded

### User Metrics
- [ ] Support for 3+ stablecoins
- [ ] <5 second cross-chain transfers
- [ ] Gasless transactions via Dynamic
- [ ] 10+ test users across chains

## Conclusion

Phase 2 transforms Barely Human Casino into a **multi-chain, multi-asset DeFi gaming platform**. By prioritizing LayerZero V2 and Circle USDC integration, we maximize prize qualification while delivering real utility. The stablecoin pools make the platform accessible to traditional users, while cross-chain capabilities showcase cutting-edge blockchain interoperability.

**Timeline**: 4 weeks
**Budget**: Gas fees for 3 testnets (~0.5 ETH)
**Team**: Focus on technical implementation over UI polish
**Goal**: Qualify for 7+ sponsor prizes at ETHGlobal NYC 2025