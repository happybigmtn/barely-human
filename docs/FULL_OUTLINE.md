Blueprint Outline

## Core Concept

A decentralized application that gamifies viral TikTok trends into blockchain challenges where users can stake, participate, and earn rewards based on trend performance and participation.

## Technical Architecture

### Frontend

- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand + React Query
- **Wallet Integration**: RainbowKit + wagmi
- **Video Handling**: Video.js for playback

### Smart Contracts

- **Main Chain**: Arbitrum for low-cost transactions
- **Cross-chain**: LayerZero for omnichain functionality
- **Development**: Hardhat + TypeScript
- **Testing**: Hardhat + Chai

### Backend Services

- **API**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis
- **Video Storage**: IPFS via Pinata

### AI/ML Components

- **Trend Analysis**: OpenAI API for trend scoring
- **Content Moderation**: AI-powered content filtering

## Key Features

### 1. Trend Challenges

- Users can create challenges based on viral TikTok trends
- Stake tokens to participate
- Vote on submissions
- Earn rewards based on performance

### 2. Cross-chain Rewards

- Deploy on multiple chains using LayerZero
- Bridge rewards between chains
- Unified leaderboard across chains

### 3. Creator Tokens

- Trend creators can launch their own tokens
- Token value tied to trend performance
- Staking and governance features

### 4. Social Features

- Follow creators
- Share challenges
- Comment and react to submissions
- Leaderboards and achievements

## Development Timeline

### Phase 1: Core Infrastructure (Day 1)

- Set up development environment
- Initialize smart contracts
- Basic frontend structure
- Wallet connection

### Phase 2: Smart Contracts (Day 1-2)

- Challenge creation contract
- Staking mechanism
- Voting system
- Reward distribution

### Phase 3: Frontend Development (Day 2)

- Challenge creation UI
- Submission interface
- Voting mechanism
- Leaderboards

### Phase 4: Integration & Testing (Day 2)

- Connect frontend to contracts
- Test all user flows
- Deploy to testnets
- Final polish

## Deployment Strategy

- Deploy contracts to Arbitrum Sepolia
- Use LayerZero for cross-chain messaging
- Frontend on Vercel
- IPFS for media storage

---

# ETHGlobal New York 2025 - Prize Integration Strategy

## Target Prizes & Total Potential: $110,000

We're strategically targeting 8 high-value prizes that align perfectly with our TikTok Trends DApp architecture. Our approach integrates multiple sponsor technologies to maximize prize qualification while building a cohesive product.

## Priority 1: Core Infrastructure Prizes ($60,000)

### 1. LayerZero - $20,000 Total

**Target Categories:**

- **Best Omnichain Interaction** ($12,500): 1st: $6,500, 2nd: $4,500, 3rd: $1,500
- **Best Omnichain DeFi Primitive** ($7,500): 1st: $4,500, 2nd: $3,000

**Integration Plan:**

- Deploy LayerZero V2 OApp for cross-chain trend challenges
- Enable users to stake and vote from multiple chains
- Unified reward distribution across Arbitrum, Base, and Polygon
- Cross-chain leaderboard synchronization

**Technical Requirements:**

- Deploy LayerZero V2 contract (NOT V1)
- Public GitHub repository
- Working demo with multiple chain interactions
- Complete feedback form

**Documentation:**

- Main Docs: <https://docs.layerzero.network/v2>
- OApp Quickstart: <https://docs.layerzero.network/v2/developers/evm/oapp/overview>
- Message Library: <https://docs.layerzero.network/v2/developers/evm/protocol/message-library>
- Security Config: <https://docs.layerzero.network/v2/developers/evm/protocol/security>

**Required Packages:**

```json
"@layerzerolabs/lz-evm-oapp-v2": "^2.3.40",
"@layerzerolabs/lz-evm-protocol-v2": "^2.3.40",
"@layerzerolabs/lz-evm-messagelib-v2": "^2.3.40",
"@layerzerolabs/toolbox-hardhat": "^0.3.20"
```

### 2. Flow - $20,000 Total

**Target Categories:**

- **Best Killer App on Flow** ($6,000): 1st: $3,500, 2nd: $1,500, 3rd: $1,000
- **Best Use of Actions & Agents** ($4,000): 1st: $2,000, 2nd: $1,000, 3rd: $1,000

**Integration Plan:**

- Deploy social features on Flow for low-cost interactions
- Implement Flow Actions for automated trend tracking
- Use scheduled transactions for reward distributions
- Leverage Flow's social graph capabilities

**Technical Requirements:**

- Deploy on Flow Testnet or Mainnet
- Use Cadence or Flow EVM
- Implement Actions or scheduled transactions

**Documentation:**

- Main Docs: <https://developers.flow.com/>
- Cadence Tutorial: <https://cadence-lang.org/docs>
- Flow EVM: <https://developers.flow.com/evm/how-it-works>
- Actions & Hooks: <https://developers.flow.com/build/advanced-concepts/actions-and-hooks>

**Required Packages:**

```json
"@onflow/fcl": "^1.11.0",
"@onflow/types": "^1.3.0",
"@onflow/flow-js-testing": "^0.6.0"
```

### 3. Coinbase Developer Platform - $20,000 Total

**Target Category:**

- **Build a Great Onchain App Using CDP** (Up to 4 teams @ $5,000 each)

**Integration Plan:**

- Onramp SDK for fiat-to-crypto conversion
- Smart Wallet for seamless user onboarding
- Commerce SDK for creator monetization
- AgentKit for AI-powered trend analysis

**Technical Requirements:**

- Use at least one CDP tool
- Public code repository
- Demo video submission
- Share build on Twitter

**Documentation:**

- CDP Overview: <https://docs.cdp.coinbase.com/>
- Onramp: <https://docs.cdp.coinbase.com/onramp/docs/welcome>
- Smart Wallet: <https://docs.cdp.coinbase.com/smart-wallet/docs/welcome>
- AgentKit: <https://docs.cdp.coinbase.com/agentkit/docs/welcome>
- Commerce: <https://docs.cdp.coinbase.com/commerce-onchain/docs/welcome>

**Required Packages:**

```json
"@coinbase/coinbase-sdk": "^0.10.0",
"@coinbase/wallet-sdk": "^4.0.4",
"@coinbase/onchainkit": "^0.35.5"
```

## Priority 2: DeFi & Trading Features ($20,000)

### 4. Uniswap Foundation - $10,000 Total

**Target Category:**

- **v4 Hooks on Unichain** ($10,000): Multiple winners

**Integration Plan:**

- Custom v4 hooks for creator token trading
- Dynamic fee structure based on trend performance
- Liquidity incentives for trending tokens
- Automated market making for new creator tokens

**Technical Requirements:**

- Use Hardhat v3 (production-ready, currently in beta)
- Deploy custom hooks on Unichain testnet
- GitHub repository with clear documentation
- Working demo

**Documentation:**

- v4 Docs: <https://docs.uniswap.org/contracts/v4/overview>
- Hooks Guide: <https://docs.uniswap.org/contracts/v4/guides/hooks/>
- Unichain Info: <https://docs.uniswap.org/contracts/v4/guides/deploy-to-unichain>
- Hook Examples: <https://github.com/uniswapfoundation/v4-periphery>

**Required Packages:**

```json
"hardhat": "^3.0.0-beta.13",
"@uniswap/v4-core": "^1.0.0",
"@uniswap/v4-periphery": "^1.0.0",
"@uniswap/v3-sdk": "^3.13.1"
```

### 5. Circle - $10,000 Total

**Target Categories:**

- **Best DeFi** ($3,334)
- **Cross-Chain** ($3,333)
- **Best Overall** ($3,333)

**Integration Plan:**

- USDC for stable rewards and staking
- CCTP for cross-chain USDC transfers
- Programmable Wallets for user accounts
- Paymaster for gasless transactions

**Technical Requirements:**

- Integrate USDC or EURC
- Use CCTP for cross-chain transfers
- Implement Programmable Wallets or Smart Contract Platform

**Documentation:**

- CCTP Docs: <https://developers.circle.com/stablecoins/docs/cctp-getting-started>
- Programmable Wallets: <https://developers.circle.com/w3s/docs/programmable-wallets>
- Smart Contract Platform: <https://developers.circle.com/w3s/docs/smart-contract-platform>
- Paymaster: <https://developers.circle.com/w3s/docs/paymaster>

**Required Packages:**

```json
"@circle-fin/smart-contract-platform": "^1.0.0",
"@circle-fin/w3s-pw-web-sdk": "^1.0.0"
```

## Priority 3: Infrastructure & Data ($30,000)

### 6. The Graph - $10,000 Total

**Target Categories:**

- **Best New Subgraph** ($2,500)
- **Best Use of Subgraph** ($2,500)
- **Best Use of Substreams** ($2,500)
- **Pool Prize** ($2,500)

**Integration Plan:**

- Subgraph for indexing trend challenges and votes
- Real-time leaderboard updates
- Historical trend performance analytics
- Creator token price tracking

**Technical Requirements:**

- Deploy subgraph to The Graph Network
- Use Graph CLI for deployment
- Query subgraph in application

**Documentation:**

- Quick Start: <https://thegraph.com/docs/en/quick-start/>
- Subgraph Studio: <https://thegraph.com/studio/>
- Substreams: <https://thegraph.com/docs/en/substreams/>
- Graph CLI: <https://thegraph.com/docs/en/deploying/deploying-a-subgraph-to-studio/>

**Required Packages:**

```json
"@graphprotocol/graph-cli": "^0.79.0",
"@graphprotocol/graph-ts": "^0.35.1",
"@urql/core": "^5.0.6"
```

### 7. Hyperlane - $10,000 Total

**Target Categories:**

- **Interchain Degen Madness** ($5,000)
- **Most Innovative Interchain Application** ($5,000)

**Integration Plan:**

- Alternative to LayerZero for redundancy
- Permissionless interchain messaging
- Custom routing for trend data synchronization
- Cross-chain governance for trend validation

**Technical Requirements:**

- Deploy Hyperlane Mailbox contract
- Implement Interchain Security Modules (ISMs)
- Multi-chain deployment

**Documentation:**

- Getting Started: <https://docs.hyperlane.xyz/docs/intro>
- Mailbox Contracts: <https://docs.hyperlane.xyz/docs/reference/messaging/mailbox>
- ISM Guide: <https://docs.hyperlane.xyz/docs/reference/ISM/specify-your-ISM>
- SDK Docs: <https://docs.hyperlane.xyz/docs/reference/libraries/typescript-sdk>

**Required Packages:**

```json
"@hyperlane-xyz/core": "^5.5.0",
"@hyperlane-xyz/sdk": "^5.5.0",
"@hyperlane-xyz/utils": "^5.5.0"
```

### 8. Dynamic - $9,999 Total

**Target Category:**

- **Most Delightful Implementation** ($9,999): Up to 5 teams

**Integration Plan:**

- Multi-wallet authentication
- Embedded wallets for Web2 users
- Social login integration
- User profile management

**Technical Requirements:**

- Implement Dynamic SDK
- Support multiple wallet types
- Smooth onboarding flow

**Documentation:**

- Quick Start: <https://docs.dynamic.xyz/quickstart>
- React SDK: <https://docs.dynamic.xyz/react-sdk/overview>
- Embedded Wallets: <https://docs.dynamic.xyz/wallets/embedded-wallets/overview>
- Social Auth: <https://docs.dynamic.xyz/authentication/social-auth>

**Required Packages:**

```json
"@dynamic-labs/sdk-react-core": "^3.0.0",
"@dynamic-labs/ethereum": "^3.0.0",
"@dynamic-labs/wagmi-connector": "^3.0.0"
```

## Implementation Checklist

### Smart Contract Requirements

- [ ] Use Hardhat v3 (beta) for Uniswap v4 hooks development
- [ ] Deploy LayerZero V2 OApp contract
- [ ] Implement Uniswap v4 hooks
- [ ] Integrate Circle CCTP
- [ ] Deploy Hyperlane Mailbox
- [ ] Deploy to multiple testnets (Arbitrum Sepolia, Base Sepolia, Flow Testnet)

### Frontend Requirements

- [ ] Integrate Dynamic for authentication
- [ ] Add Coinbase Onramp
- [ ] Implement Smart Wallet support
- [ ] Query The Graph subgraph
- [ ] Show cross-chain interactions

### Documentation Requirements

- [ ] Public GitHub repository
- [ ] Clear README with setup instructions
- [ ] Demo video (2-3 minutes)
- [ ] Architecture diagrams
- [ ] API documentation

### Testing Requirements

- [ ] Unit tests for smart contracts
- [ ] Integration tests for cross-chain features
- [ ] Frontend E2E tests
- [ ] Testnet deployment verification

## Bonus Considerations

### Additional Prizes (Lower Priority)

- **ENS ($10,000)**: Integrate ENS names for user profiles
- **Ledger ($10,000)**: Clear signing support for Ledger devices
- **Privy ($5,000)**: Alternative auth solution
- **Lit Protocol ($5,000)**: Encrypted content for premium trends

## Package Version Matrix

```json
{
  "dependencies": {
    "@layerzerolabs/lz-evm-oapp-v2": "^2.3.40",
    "@coinbase/coinbase-sdk": "^0.10.0",
    "@coinbase/onchainkit": "^0.35.5",
    "@dynamic-labs/sdk-react-core": "^3.0.0",
    "@uniswap/v4-core": "^1.0.0",
    "@circle-fin/w3s-pw-web-sdk": "^1.0.0",
    "@hyperlane-xyz/sdk": "^5.5.0",
    "@graphprotocol/graph-cli": "^0.79.0",
    "@onflow/fcl": "^1.11.0",
    "hardhat": "^3.0.0-beta.13",
    "ethers": "^6.13.0",
    "wagmi": "^2.12.0",
    "viem": "^2.21.0"
  }
}
```

## Critical Notes

1. **Hardhat Version**: Hardhat v3 is now production-ready (in beta). Use v3.0.0-beta.13 for Uniswap v4 hooks. Requires Node.js v22+
2. **LayerZero Version**: Must use V2, not V1 - this is critical for qualification
3. **Multiple Testnets**: Deploy to at least 3 testnets for cross-chain prizes
4. **Documentation**: Every prize requires clear documentation and demo
5. **Social Sharing**: Coinbase requires Twitter/X post about the build

## Submission Strategy

1. **Day 1**: Deploy core contracts with LayerZero and Hyperlane
2. **Day 2 Morning**: Integrate Coinbase CDP and Dynamic
3. **Day 2 Afternoon**: Add Uniswap v4 hooks and Circle integration
4. **Day 2 Evening**: Deploy The Graph subgraph and test everything
5. **Final Hours**: Record demo video, polish documentation, submit to all categories

## Expected Prize Potential

Conservative Estimate (winning 3-4 categories): $30,000-$50,000
Optimistic Estimate (winning 6-8 categories): $60,000-$90,000
Maximum Potential (winning all targeted categories): $110,000
