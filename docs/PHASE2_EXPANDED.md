# Phase 2 Implementation Plan - ETHGlobal NYC 2025 (Expanded)

## Executive Summary
Barely Human Casino has completed Phase 1 with full game logic, AI bots, and Uniswap V4 hooks. Phase 2 focuses on omnichain expansion via LayerZero V2 and deep Coinbase Developer Platform integration to maximize prize qualifications.

## Prize Qualification Status

### ✅ Already Qualified
| Sponsor | Requirements Met | Status |
|---------|-----------------|--------|
| **Uniswap V4** | Custom hooks with 2% fee | ✅ Complete |
| **The Graph** | Subgraph schema complete | ✅ Ready |
| **Hardhat 3** | Using v3.0.0-beta.13 | ✅ Complete |

### 🎯 Priority Implementations
| Sponsor | Implementation Strategy | Priority |
|---------|------------------------|----------|
| **LayerZero V2** | Omnichain LP system across 3 chains | 🔴 Critical |
| **Coinbase CDP** | Full platform integration (4 tools) | 🔴 Critical |
| **Circle** | USDC pools with CCTP | 🟡 High |
| **Dynamic** | Wallet abstraction | 🟡 High |
| **Hyperlane** | Redundant messaging | 🟢 Medium |

---

## Part 1: LayerZero V2 Omnichain Architecture

### Overview
LayerZero V2 enables true omnichain functionality where LPs from multiple chains (Arbitrum Sepolia, Base Sepolia, Flow) contribute to a single shared state, with all game logic remaining on Base Sepolia as the hub.

### 🏗️ Hub-Spoke Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Base Sepolia (Hub)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           OmniVaultCoordinator.sol                   │   │
│  │  • Authoritative vault state for all chains          │   │
│  │  • Game integration (CrapsGame.sol)                  │   │
│  │  • Cross-chain message processing                    │   │
│  │  • State synchronization broadcaster                 │   │
│  │  • Emergency controls across all chains              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                    ↕️ LayerZero V2 Messages ↕️
    ┌──────────────────────┐     ┌──────────────────────┐
    │  Arbitrum Sepolia    │     │    Flow Testnet      │
    │  SpokeVaultProxy.sol │     │  FlowVaultProxy.cdc  │
    │  • LP deposits       │     │  • LP deposits       │
    │  • State mirroring   │     │  • State mirroring   │
    │  • Local caching     │     │  • Local caching     │
    └──────────────────────┘     └──────────────────────┘
```

### 📨 Message Protocol Specification

```solidity
// Complete message type enumeration
enum MessageType {
    DEPOSIT,              // 0: LP deposit from spoke chain
    WITHDRAW_REQUEST,     // 1: Withdrawal initiation
    WITHDRAW_CONFIRM,     // 2: Withdrawal confirmation
    STATE_UPDATE,         // 3: Global state synchronization
    EMERGENCY_PAUSE,      // 4: Emergency control
    REBALANCE,           // 5: Liquidity rebalancing
    PERFORMANCE_UPDATE,   // 6: Vault performance metrics
    BOT_STATS_UPDATE,    // 7: Bot statistics sync
    TREASURY_CLAIM,      // 8: Fee distribution
    SHARE_MINT,          // 9: Cross-chain share minting
    SHARE_BURN          // 10: Cross-chain share burning
}

// Comprehensive message structure
struct CrossChainMessage {
    MessageType msgType;
    uint32 sourceEid;        // Source endpoint ID
    uint32 destEid;          // Destination endpoint ID
    address sender;          // Original transaction sender
    uint256 amount;          // Amount in transaction
    uint256 shares;          // Share amount (if applicable)
    bytes32 recipient;       // Cross-chain recipient
    uint256 nonce;           // Sequential nonce for ordering
    uint256 timestamp;       // Message timestamp
    bytes payload;           // Additional encoded data
    bytes32 messageHash;     // Hash for verification
}
```

### 🔐 Omnichain State Management

```solidity
contract OmniVaultCoordinator is OAppReceiver, OAppCore {
    using OAppOptionsType3 for bytes;
    using OptionsBuilder for bytes;
    
    // Global state maintained on hub
    struct GlobalVaultState {
        uint256 totalAssets;                     // Aggregated from all chains
        uint256 totalShares;                     // Total LP shares issued
        mapping(uint32 => ChainState) chains;    // Per-chain state
        uint256 lastSyncBlock;
        bytes32 stateRoot;                       // Merkle root for verification
        uint256 syncNonce;                       // Global sync counter
    }
    
    struct ChainState {
        uint256 assets;          // Assets on this chain
        uint256 shares;          // Shares issued to this chain
        uint256 pendingDeposits; // Deposits awaiting confirmation
        uint256 pendingWithdrawals;
        bool active;             // Chain active status
        uint256 lastMessageNonce;
    }
    
    // LayerZero V2 configuration
    mapping(uint32 => bytes32) public trustedRemotes;
    mapping(uint32 => uint256) public minGasLimits;
    
    // Events
    event CrossChainDeposit(uint32 indexed srcEid, address indexed user, uint256 amount, uint256 shares);
    event CrossChainWithdrawal(uint32 indexed destEid, address indexed user, uint256 amount);
    event StateSync(uint256 indexed nonce, bytes32 stateRoot);
    
    constructor(
        address _endpoint,
        address _crapsGame,
        address _treasury
    ) OAppCore(_endpoint, msg.sender) {
        crapsGame = ICrapsGame(_crapsGame);
        treasury = ITreasury(_treasury);
    }
    
    // Process incoming LayerZero messages
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        CrossChainMessage memory msg = abi.decode(_message, (CrossChainMessage));
        
        // Verify message integrity
        require(msg.sourceEid == _origin.srcEid, "Invalid source");
        require(msg.messageHash == keccak256(_message), "Invalid hash");
        
        // Process based on message type
        if (msg.msgType == MessageType.DEPOSIT) {
            _processDeposit(msg);
        } else if (msg.msgType == MessageType.WITHDRAW_REQUEST) {
            _processWithdrawal(msg);
        } else if (msg.msgType == MessageType.EMERGENCY_PAUSE) {
            _processEmergency(msg);
        }
        
        // Broadcast state update to all spokes
        _broadcastStateUpdate();
    }
    
    // Process cross-chain deposit
    function _processDeposit(CrossChainMessage memory msg) internal {
        // Update global state
        globalState.totalAssets += msg.amount;
        globalState.chains[msg.sourceEid].assets += msg.amount;
        
        // Calculate shares based on global state
        uint256 shares = _convertToShares(msg.amount);
        globalState.totalShares += shares;
        globalState.chains[msg.sourceEid].shares += shares;
        
        emit CrossChainDeposit(msg.sourceEid, address(uint160(uint256(msg.recipient))), msg.amount, shares);
        
        // Send confirmation back to spoke
        _sendConfirmation(msg.sourceEid, msg.sender, shares);
    }
    
    // Broadcast state to all spokes
    function _broadcastStateUpdate() internal {
        bytes memory statePayload = abi.encode(
            globalState.totalAssets,
            globalState.totalShares,
            globalState.stateRoot,
            globalState.syncNonce++
        );
        
        // Send to all active spoke chains
        for (uint32 eid = 0; eid < registeredEndpoints.length; eid++) {
            if (globalState.chains[registeredEndpoints[eid]].active) {
                _lzSend(
                    registeredEndpoints[eid],
                    statePayload,
                    _options(200000, 0, address(0))
                );
            }
        }
        
        emit StateSync(globalState.syncNonce, globalState.stateRoot);
    }
}
```

### 🔄 Spoke Chain Implementation

```solidity
contract SpokeVaultProxy is OAppSender, ERC4626 {
    using OAppOptionsType3 for bytes;
    
    uint32 public immutable hubEndpointId;
    
    // Local state cache
    struct LocalState {
        uint256 totalAssets;    // Cached from hub
        uint256 totalShares;    // Cached from hub
        uint256 pendingDeposits; // Awaiting hub confirmation
        uint256 lastSyncNonce;
        mapping(address => uint256) userPendingShares;
    }
    
    LocalState public localState;
    
    constructor(
        address _endpoint,
        address _usdc,
        uint32 _hubEid
    ) OAppCore(_endpoint, msg.sender) ERC4626(IERC20(_usdc)) {
        hubEndpointId = _hubEid;
        name = "Omni USDC Vault - Arbitrum";
        symbol = "ovUSDC-ARB";
    }
    
    // Override deposit to handle cross-chain
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        returns (uint256 shares) 
    {
        // Transfer USDC to this contract
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);
        
        // Update local pending state
        localState.pendingDeposits += assets;
        
        // Calculate estimated shares based on cached state
        shares = _convertToShares(assets);
        localState.userPendingShares[receiver] += shares;
        
        // Send deposit message to hub
        CrossChainMessage memory message = CrossChainMessage({
            msgType: MessageType.DEPOSIT,
            sourceEid: _getLocalEndpointId(),
            destEid: hubEndpointId,
            sender: receiver,
            amount: assets,
            shares: 0, // Hub will calculate
            recipient: bytes32(uint256(uint160(receiver))),
            nonce: ++messageNonce,
            timestamp: block.timestamp,
            payload: "",
            messageHash: 0
        });
        
        message.messageHash = keccak256(abi.encode(message));
        
        // Send via LayerZero V2
        _lzSend(
            hubEndpointId,
            abi.encode(message),
            _options(300000, 0, receiver)
        );
        
        emit DepositInitiated(receiver, assets, shares);
        return shares;
    }
    
    // Receive state updates from hub
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        require(_origin.srcEid == hubEndpointId, "Only hub");
        
        // Decode state update
        (
            uint256 totalAssets,
            uint256 totalShares,
            bytes32 stateRoot,
            uint256 syncNonce
        ) = abi.decode(_message, (uint256, uint256, bytes32, uint256));
        
        // Update local cache
        localState.totalAssets = totalAssets;
        localState.totalShares = totalShares;
        localState.lastSyncNonce = syncNonce;
        
        emit StateUpdated(totalAssets, totalShares, syncNonce);
    }
}
```

---

## Part 2: Coinbase Developer Platform Integration

### Overview
Deep integration with all 4 CDP tools to maximize prize qualification and provide superior user experience.

### 🏦 1. Coinbase Onramp Integration

```typescript
// frontend/src/components/CoinbaseOnramp.tsx
import { CoinbaseOnrampButton } from '@coinbase/onchainkit/onramp';
import { useAccount } from 'wagmi';

export function FundVaultWithFiat() {
    const { address } = useAccount();
    
    return (
        <CoinbaseOnrampButton
            token="USDC"
            onSuccess={(txHash) => {
                // Auto-deposit to vault after onramp
                depositToVault(txHash);
            }}
            onExit={() => console.log('Onramp closed')}
            config={{
                destinationWallets: [{
                    address: address,
                    blockchains: ['base-sepolia', 'arbitrum-sepolia']
                }],
                defaultAmount: 100,
                defaultCurrency: 'USD'
            }}
        />
    );
}
```

### 💼 2. CDP Wallets (Server & Embedded)

#### Server Wallet for Bot Management
```typescript
// backend/src/cdp-wallet-manager.ts
import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';

export class CDPBotWalletManager {
    private coinbase: Coinbase;
    private botWallets: Map<number, Wallet> = new Map();
    
    constructor() {
        this.coinbase = new Coinbase({
            apiKeyName: process.env.CDP_API_KEY_NAME!,
            privateKey: process.env.CDP_PRIVATE_KEY!
        });
    }
    
    async createBotWallet(botId: number, botName: string): Promise<Wallet> {
        // Create server-managed wallet for each bot
        const wallet = await Wallet.create({
            networkId: 'base-sepolia'
        });
        
        // Fund wallet with initial USDC
        await wallet.faucet('usdc', 1000);
        
        // Store wallet reference
        this.botWallets.set(botId, wallet);
        
        // Set up automated betting logic
        await this.setupAutomatedBetting(wallet, botId);
        
        return wallet;
    }
    
    async setupAutomatedBetting(wallet: Wallet, botId: number) {
        // Create smart contract wallet for gasless transactions
        const smartWallet = await wallet.createSmartWallet();
        
        // Deploy betting automation contract
        const automation = await smartWallet.deployContract({
            abi: BETTING_AUTOMATION_ABI,
            bytecode: BETTING_AUTOMATION_BYTECODE,
            args: [botId, CRAPS_GAME_ADDRESS]
        });
        
        // Configure betting strategy based on bot personality
        await automation.invoke('setBettingStrategy', {
            args: this.getBotStrategy(botId)
        });
        
        return automation;
    }
    
    async executeBotBet(botId: number, betType: number, amount: bigint) {
        const wallet = this.botWallets.get(botId);
        if (!wallet) throw new Error('Bot wallet not found');
        
        // Execute bet transaction
        const tx = await wallet.invokeContract({
            contractAddress: CRAPS_GAME_ADDRESS,
            method: 'placeBet',
            args: {
                betType,
                amount,
                botId
            }
        });
        
        // Wait for confirmation
        await tx.wait();
        
        return tx.getTransactionHash();
    }
}
```

#### Embedded Wallet for Users
```typescript
// frontend/src/hooks/useEmbeddedWallet.ts
import { useEffect, useState } from 'react';
import { WalletClient } from '@coinbase/wallet-sdk';

export function useEmbeddedWallet() {
    const [wallet, setWallet] = useState<WalletClient | null>(null);
    const [isReady, setIsReady] = useState(false);
    
    useEffect(() => {
        const initWallet = async () => {
            // Initialize embedded wallet
            const walletClient = new WalletClient({
                appName: 'Barely Human Casino',
                appLogoUrl: 'https://casino.app/logo.png',
                enableMPC: true, // Multi-party computation for security
            });
            
            // Create or restore wallet
            const wallet = await walletClient.createWallet({
                network: 'base-sepolia',
                // Gasless transactions via Coinbase
                paymasterUrl: process.env.NEXT_PUBLIC_PAYMASTER_URL
            });
            
            setWallet(wallet);
            setIsReady(true);
        };
        
        initWallet();
    }, []);
    
    const placeBet = async (amount: string, betType: number) => {
        if (!wallet) return;
        
        // Gasless transaction via embedded wallet
        const tx = await wallet.sendTransaction({
            to: CRAPS_GAME_ADDRESS,
            data: encodeFunctionData({
                abi: CRAPS_ABI,
                functionName: 'placeBet',
                args: [betType, parseEther(amount)]
            }),
            // Coinbase sponsors gas
            sponsored: true
        });
        
        return tx;
    };
    
    return { wallet, isReady, placeBet };
}
```

### 📊 3. CDP Data APIs Integration

#### Token Balance API
```typescript
// backend/src/cdp-data-api.ts
import { CoinbaseDataAPI } from '@coinbase/cdp-data-api';

export class VaultBalanceTracker {
    private dataAPI: CoinbaseDataAPI;
    
    constructor() {
        this.dataAPI = new CoinbaseDataAPI({
            apiKey: process.env.CDP_DATA_API_KEY!
        });
    }
    
    // Track all vault balances across chains
    async getOmnichainVaultBalances() {
        const chains = ['base-sepolia', 'arbitrum-sepolia'];
        const balances: Record<string, any> = {};
        
        for (const chain of chains) {
            // Get USDC balances for all vaults
            const vaultBalances = await this.dataAPI.getTokenBalances({
                network: chain,
                tokenAddress: USDC_ADDRESSES[chain],
                addresses: VAULT_ADDRESSES[chain]
            });
            
            // Get BOT token balances
            const botBalances = await this.dataAPI.getTokenBalances({
                network: chain,
                tokenAddress: BOT_TOKEN_ADDRESS,
                addresses: VAULT_ADDRESSES[chain]
            });
            
            balances[chain] = {
                usdc: vaultBalances,
                bot: botBalances,
                total: this.calculateTotalValue(vaultBalances, botBalances)
            };
        }
        
        return balances;
    }
}
```

#### Event API for Game Monitoring
```typescript
export class GameEventMonitor {
    private eventAPI: CoinbaseEventAPI;
    private webhookUrl: string;
    
    constructor() {
        this.eventAPI = new CoinbaseEventAPI({
            apiKey: process.env.CDP_EVENT_API_KEY!
        });
        this.webhookUrl = process.env.WEBHOOK_URL!;
    }
    
    async subscribeToGameEvents() {
        // Subscribe to bet placed events
        await this.eventAPI.createWebhook({
            network: 'base-sepolia',
            address: CRAPS_GAME_ADDRESS,
            events: ['BetPlaced', 'BetSettled', 'GameStateChanged'],
            webhookUrl: this.webhookUrl,
            filters: {
                // Only track bets over 100 USDC
                minAmount: parseUnits('100', 6)
            }
        });
        
        // Subscribe to vault events
        await this.eventAPI.createWebhook({
            network: 'base-sepolia',
            address: OMNI_VAULT_COORDINATOR,
            events: ['CrossChainDeposit', 'CrossChainWithdrawal', 'StateSync'],
            webhookUrl: this.webhookUrl
        });
    }
    
    // Process webhook events
    async handleWebhook(event: any) {
        switch(event.eventName) {
            case 'BetPlaced':
                await this.processBetPlaced(event);
                break;
            case 'CrossChainDeposit':
                await this.processCrossChainDeposit(event);
                break;
            case 'StateSync':
                await this.updateGlobalState(event);
                break;
        }
    }
}
```

#### SQL API for Analytics
```typescript
export class CasinoAnalytics {
    private sqlAPI: CoinbaseSQLAPI;
    
    constructor() {
        this.sqlAPI = new CoinbaseSQLAPI({
            apiKey: process.env.CDP_SQL_API_KEY!
        });
    }
    
    // Get comprehensive betting statistics
    async getBettingStats(timeframe: string = '7d') {
        const query = `
            WITH bet_data AS (
                SELECT 
                    bot_id,
                    bet_type,
                    amount,
                    payout,
                    timestamp,
                    CASE WHEN payout > amount THEN 'win' ELSE 'loss' END as result
                FROM craps_game_events
                WHERE event_name = 'BetSettled'
                    AND timestamp > NOW() - INTERVAL '${timeframe}'
            ),
            vault_data AS (
                SELECT 
                    chain,
                    SUM(total_assets) as total_liquidity,
                    COUNT(DISTINCT depositor) as unique_lps
                FROM vault_deposits
                WHERE timestamp > NOW() - INTERVAL '${timeframe}'
                GROUP BY chain
            )
            SELECT 
                bd.bot_id,
                COUNT(*) as total_bets,
                SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
                SUM(amount) as total_wagered,
                SUM(payout - amount) as net_profit,
                AVG(amount) as avg_bet_size,
                vd.total_liquidity,
                vd.unique_lps
            FROM bet_data bd
            CROSS JOIN vault_data vd
            GROUP BY bd.bot_id, vd.total_liquidity, vd.unique_lps
            ORDER BY net_profit DESC
        `;
        
        const results = await this.sqlAPI.query({
            query,
            network: 'base-sepolia'
        });
        
        return this.formatAnalytics(results);
    }
    
    // Real-time dashboard data
    async getDashboardMetrics() {
        const queries = {
            totalVolume: `
                SELECT SUM(amount) as volume 
                FROM craps_game_events 
                WHERE timestamp > NOW() - INTERVAL '24h'
            `,
            activeUsers: `
                SELECT COUNT(DISTINCT user_address) as users 
                FROM transactions 
                WHERE timestamp > NOW() - INTERVAL '1h'
            `,
            crossChainActivity: `
                SELECT 
                    source_chain,
                    COUNT(*) as transactions,
                    SUM(amount) as volume
                FROM cross_chain_messages
                WHERE timestamp > NOW() - INTERVAL '24h'
                GROUP BY source_chain
            `
        };
        
        const metrics = {};
        for (const [key, query] of Object.entries(queries)) {
            metrics[key] = await this.sqlAPI.query({ query, network: 'base-sepolia' });
        }
        
        return metrics;
    }
}
```

### 🔗 4. Complete CDP Integration Example

```typescript
// backend/src/cdp-integration.ts
import { Coinbase, Wallet, DataAPI, EventAPI } from '@coinbase/coinbase-sdk';
import { OnchainKit } from '@coinbase/onchainkit';

export class CompleteCDPIntegration {
    private coinbase: Coinbase;
    private dataAPI: DataAPI;
    private eventAPI: EventAPI;
    private botWallets: Map<number, Wallet> = new Map();
    
    async initialize() {
        // Initialize all CDP services
        this.coinbase = new Coinbase({
            apiKeyName: process.env.CDP_API_KEY_NAME!,
            privateKey: process.env.CDP_PRIVATE_KEY!
        });
        
        this.dataAPI = new DataAPI({
            apiKey: process.env.CDP_DATA_API_KEY!
        });
        
        this.eventAPI = new EventAPI({
            apiKey: process.env.CDP_EVENT_API_KEY!
        });
        
        // Create wallets for all 10 bots
        await this.initializeBotWallets();
        
        // Set up event monitoring
        await this.setupEventMonitoring();
        
        // Initialize analytics
        await this.initializeAnalytics();
    }
    
    async initializeBotWallets() {
        const botNames = [
            'Alice All-In', 'Bob Calculator', 'Charlie Lucky',
            'Diana Ice Queen', 'Eddie Entertainer', 'Fiona Fearless',
            'Greg Grinder', 'Helen Hot Streak', 'Ivan Intimidator', 'Julia Jinx'
        ];
        
        for (let i = 0; i < 10; i++) {
            // Create CDP-managed wallet for each bot
            const wallet = await Wallet.create({
                networkId: 'base-sepolia'
            });
            
            // Deploy smart wallet for gasless transactions
            const smartWallet = await wallet.deploySmartWallet({
                factoryAddress: SMART_WALLET_FACTORY,
                owners: [wallet.getDefaultAddress()]
            });
            
            // Fund with initial USDC
            await this.fundBotWallet(wallet, '1000');
            
            // Store wallet
            this.botWallets.set(i, wallet);
            
            console.log(`Bot ${i} (${botNames[i]}) wallet created: ${wallet.getDefaultAddress()}`);
        }
    }
    
    async fundBotWallet(wallet: Wallet, amountUSDC: string) {
        // Use Coinbase faucet for testnet
        if (process.env.NETWORK === 'testnet') {
            await wallet.faucet('usdc', parseFloat(amountUSDC));
        } else {
            // Production: Transfer from treasury
            const treasuryWallet = await this.coinbase.getWallet(TREASURY_WALLET_ID);
            await treasuryWallet.transfer({
                amount: amountUSDC,
                assetId: 'usdc',
                destination: wallet.getDefaultAddress()
            });
        }
    }
    
    async executeCrossChainDeposit(
        userAddress: string,
        amount: string,
        sourceChain: string,
        destinationChain: string
    ) {
        // Use CDP for cross-chain transfer
        const transfer = await this.coinbase.createTransfer({
            amount,
            assetId: 'usdc',
            sourceNetworkId: sourceChain,
            destinationNetworkId: destinationChain,
            destinationAddress: OMNI_VAULT_ADDRESSES[destinationChain],
            metadata: {
                user: userAddress,
                type: 'vault_deposit'
            }
        });
        
        // Monitor transfer status
        const status = await transfer.wait();
        
        // Update local state
        await this.updateVaultState(destinationChain, amount, userAddress);
        
        return status;
    }
    
    async getComprehensiveAnalytics() {
        // Combine all CDP data sources
        const [balances, events, analytics] = await Promise.all([
            this.dataAPI.getTokenBalances({
                addresses: Object.values(VAULT_ADDRESSES).flat()
            }),
            this.eventAPI.getRecentEvents({
                contracts: [CRAPS_GAME_ADDRESS, OMNI_VAULT_COORDINATOR],
                limit: 100
            }),
            this.sqlAPI.query({
                query: ANALYTICS_QUERY
            })
        ]);
        
        return {
            totalValueLocked: this.calculateTVL(balances),
            recentActivity: this.formatEvents(events),
            botPerformance: analytics.botStats,
            crossChainMetrics: analytics.crossChain,
            userEngagement: analytics.users
        };
    }
}
```

---

## Part 3: Implementation Timeline

### Week 1: Foundation (Days 1-7)

#### Days 1-2: Setup & Configuration
```bash
# Install ALL required packages
npm install @layerzerolabs/lz-evm-oapp-v2@^2.3.40
npm install @layerzerolabs/oapp-evm@^2.3.40
npm install @coinbase/coinbase-sdk@latest
npm install @coinbase/onchainkit@latest
npm install @coinbase/wallet-sdk@latest
npm install @circle-fin/verite@latest
npm install @dynamic-labs/sdk-react-core@^3.0.0
```

#### Days 3-4: Deploy LayerZero V2 Hub (Base Sepolia)
- Deploy `OmniVaultCoordinator.sol`
- Configure trusted endpoints
- Set up message validation

#### Days 5-6: Deploy Spoke Chains
- Deploy `SpokeVaultProxy.sol` on Arbitrum Sepolia
- Deploy Flow Cadence contracts
- Test cross-chain messaging

#### Day 7: CDP Integration
- Set up CDP wallets for all bots
- Configure data APIs
- Initialize event monitoring

### Week 2: Advanced Features (Days 8-14)

#### Days 8-9: Coinbase Onramp
- Integrate onramp widget
- Auto-deposit to vaults
- Test fiat-to-vault flow

#### Days 10-11: Cross-Chain State Sync
- Implement state broadcasting
- Test multi-chain deposits
- Verify state consistency

#### Days 12-14: Analytics & Monitoring
- Deploy CDP SQL queries
- Set up real-time dashboard
- Configure alerts

### Week 3: Production Hardening (Days 15-21)

#### Days 15-16: Security Audit
- Test emergency pause
- Verify message validation
- Audit cross-chain flows

#### Days 17-18: Gas Optimization
- Batch message processing
- Optimize state updates
- Implement caching

#### Days 19-21: UI/UX Polish
- Dynamic wallet integration
- Gasless transactions
- Mobile optimization

### Week 4: Launch Preparation (Days 22-28)

#### Days 22-23: Multi-Chain Deployment
- Deploy to all testnets
- Verify contracts
- Initialize pools

#### Days 24-25: Integration Testing
- End-to-end testing
- Load testing
- Cross-chain stress test

#### Days 26-27: Documentation
- Technical documentation
- Demo video creation
- Submission preparation

#### Day 28: Launch
- Final deployment
- Submit to ETHGlobal
- Complete feedback forms

---

## Part 4: Technical Configuration

### LayerZero V2 Endpoints
```typescript
const LZ_ENDPOINTS = {
    baseSepolia: {
        eid: 40245,
        endpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f"
    },
    arbitrumSepolia: {
        eid: 40231,
        endpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f"
    },
    flowTestnet: {
        eid: TBD,
        endpoint: "TBD"
    }
};
```

### CDP Configuration
```typescript
const CDP_CONFIG = {
    apiKeys: {
        wallets: process.env.CDP_WALLET_API_KEY,
        data: process.env.CDP_DATA_API_KEY,
        events: process.env.CDP_EVENT_API_KEY,
        sql: process.env.CDP_SQL_API_KEY
    },
    networks: {
        base: 'base-sepolia',
        arbitrum: 'arbitrum-sepolia'
    },
    contracts: {
        smartWalletFactory: "0x...",
        paymaster: "0x..."
    }
};
```

### Circle CCTP Configuration
```typescript
const CCTP_CONFIG = {
    tokenMessenger: {
        baseSepolia: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
        arbitrumSepolia: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"
    },
    domains: {
        baseSepolia: 6,
        arbitrumSepolia: 3
    }
};
```

---

## Part 5: Prize Qualification Checklist

### ✅ LayerZero V2 Requirements
- [ ] Using V2 packages (NOT V1)
- [ ] OApp implementation complete
- [ ] 3+ chains integrated
- [ ] Cross-chain state management
- [ ] Security features implemented

### ✅ Coinbase CDP Requirements
- [ ] Onramp integration
- [ ] CDP Wallets (Server + Embedded)
- [ ] Data APIs (Balance, Event, SQL)
- [ ] Base deployment
- [ ] Smart wallet implementation

### ✅ Circle Requirements
- [ ] USDC vault integration
- [ ] CCTP cross-chain transfers
- [ ] Programmable wallets
- [ ] Multi-chain USDC support

### ✅ Additional Prizes
- [ ] Dynamic wallet abstraction
- [ ] Hyperlane redundant messaging
- [ ] Flow blockchain deployment
- [ ] The Graph subgraph
- [ ] Uniswap V4 hooks

---

## Conclusion

This expanded Phase 2 implementation provides:

1. **Complete LayerZero V2 omnichain architecture** with hub-spoke model
2. **Full Coinbase Developer Platform integration** using all 4 required tools
3. **Circle USDC and CCTP** for stablecoin accessibility
4. **Multi-chain deployment** across Base, Arbitrum, and Flow

The architecture enables:
- **Unified liquidity** across all chains
- **Gasless transactions** via CDP wallets
- **Fiat onramps** directly to vaults
- **Comprehensive analytics** via SQL API
- **Real-time monitoring** via Event API

This positions Barely Human Casino to qualify for **8+ sponsor prizes** at ETHGlobal NYC 2025 while delivering a genuinely innovative omnichain gaming experience.