# Base Sepolia Deployment Status

## Deployment Date: 2025-08-16

### Deployer Wallet
- **Address**: `0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB`
- **Initial Balance**: 0.45 ETH (funded by user)
- **Current Balance**: ~0.4499 ETH

### Successfully Deployed Contracts ✅

1. **BOT Token** - `0xedbce0a53a24f9e5f4684937ed3ee64e936cd048`
   - Fixed supply ERC20 token
   - 1 billion total supply
   - Roles: TREASURY_ROLE, STAKING_ROLE

2. **Treasury** - `0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a`
   - Central fee collection
   - Distribution: 50% staking, 20% buyback, 15% dev, 15% insurance
   - Integrated with staking pool

3. **StakingPool** - `0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2`
   - Single-token staking for BOT
   - 7-day epochs
   - Accumulative reward model

4. **CrapsGame** - `0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a`
   - Main game logic with VRF integration
   - Game phases: IDLE, COME_OUT, POINT
   - Series tracking with unique IDs
   - **NEEDS**: Add as consumer to VRF subscription

5. **CrapsBets** - `0x7283196cb2aa54ebca3ec2198eb5a86215e627cb`
   - All 64 bet types implemented
   - Gas-optimized bitmap tracking
   - Batch processing capabilities

6. **CrapsSettlementSimple** - `0xe156b261025e74a19b298c9d94260c744ae85d7f`
   - Simplified settlement logic (minimal version)
   - Deployed to fit under size limit
   - Core Pass Line logic implemented

7. **VaultFactoryLib** - `0xde72434108dcbd4ddd164e3f9f347478ddcf16b6`
   - Library for vault factory functionality
   - Deployed but not yet used

### Pending Deployments ⏳

1. **VaultFactory/VaultFactoryOptimized**
   - Issue: Contract size exceeds 24KB limit
   - Status: Needs further optimization

2. **BotManager**
   - Dependency: Requires VaultFactory to be deployed first
   - 10 bot personalities ready to initialize

3. **10 Bot Vaults**
   - Dependency: Requires VaultFactory and BotManager

4. **GachaMintPass**
   - NFT raffle system
   - Requires VRF integration

5. **BarelyHumanArt**
   - Generative art NFT
   - Ready to deploy

6. **ArtRedemptionService**
   - Links mint passes to art NFTs
   - Dependency: GachaMintPass and BarelyHumanArt

7. **BotBettingEscrow**
   - Player betting on bot performance
   - Ready to deploy

8. **Uniswap V4 Hooks**
   - 2% swap fee implementation
   - Requires separate deployment

### Chainlink VRF Configuration

**Subscription ID**: `22376417694825733668962562671731634456669048679979758256841549539628619732572`

**Contracts that need to be added as consumers**:
1. CrapsGame - `0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a`
2. GachaMintPass - (pending deployment)
3. BotManager - (pending deployment)

**VRF Settings**:
- Coordinator: `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634`
- Key Hash: `0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c`
- Callback Gas Limit: 200,000

### Issues Encountered

1. **VaultFactory Size Issue**
   - Original VaultFactory: 26,177 bytes (exceeds 24KB limit)
   - VaultFactoryOptimized: 25,133 bytes (still too large)
   - Solution needed: Further optimization or splitting

2. **CrapsSettlement Size Issue**
   - Original: 25,759 bytes (too large)
   - Solution: Deployed CrapsSettlementSimple with minimal functionality

3. **VRF Subscription ID Format**
   - Chainlink V2.5 uses uint256 subscription IDs
   - BotManager constructor expects uint64
   - Workaround: Use temporary ID (1) for deployment, update later

4. **Uniswap V4 Dependencies**
   - Missing imports for hooks
   - Temporarily removed problematic contracts

### Next Steps

1. **Immediate Actions**:
   - Add deployed contracts as VRF consumers
   - Fund bot vaults with BOT tokens
   - Set up contract roles and permissions

2. **Contract Optimization**:
   - Further optimize VaultFactory to fit under 24KB
   - Consider splitting into multiple contracts
   - Deploy remaining infrastructure

3. **Verification**:
   - Verify all contracts on BaseScan
   - Document deployment addresses
   - Update frontend configurations

4. **Testing**:
   - Test VRF integration
   - Validate game mechanics
   - Ensure treasury fee distribution

### Gas Usage Summary
- BOT Token: ~0.000057 ETH
- Treasury: ~0.000074 ETH
- StakingPool: ~0.000030 ETH
- CrapsGame: ~0.000044 ETH
- CrapsBets: ~0.000047 ETH
- CrapsSettlementSimple: ~0.000010 ETH
- Total used: ~0.00026 ETH

### Repository Status
- **Branch**: master
- **Latest commit**: Working on Base Sepolia deployment
- **Tests**: All passing locally (203/203)
- **Documentation**: Updated with deployment addresses