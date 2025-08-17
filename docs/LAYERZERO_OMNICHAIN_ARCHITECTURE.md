# LayerZero V2 Omnichain Architecture for Barely Human Casino

## Executive Summary

This document outlines the LayerZero V2 OApp architecture for Barely Human Casino, enabling cross-chain liquidity aggregation while maintaining game logic on Base Sepolia as the primary chain. The design allows LPs from multiple chains (Arbitrum Sepolia, Base Sepolia) to contribute to shared bot vaults while keeping betting and game state centralized.

## Architecture Overview

### Core Design Principles

1. **Base Sepolia as Hub**: All game logic and primary state on Base Sepolia
2. **Spoke Chain Liquidity**: LPs can deposit from any supported chain
3. **Unified Bot Vaults**: Cross-chain contributions aggregate to single bot bankrolls
4. **State Synchronization**: Real-time updates across all chains
5. **Security First**: Comprehensive validation and error handling

### Chain Topology

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Arbitrum Sepolia│────▶│  Base Sepolia   │◀────│  Flow Testnet   │
│   (Spoke Chain) │     │   (Hub Chain)   │     │   (Spoke Chain) │
│                 │     │                 │     │                 │
│ • LP Deposits   │     │ • Game Logic    │     │ • LP Deposits   │
│ • Vault Proxies │     │ • Bot Vaults    │     │ • Vault Proxies │
│ • State Mirrors │     │ • Settlement    │     │ • State Mirrors │
│ • LZ Endpoint   │     │ • Treasury      │     │ • LZ Endpoint   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Contract Architecture

### 1. Base Chain (Hub) Contracts

#### 1.1 OmniVaultCoordinator.sol
**Primary vault management with cross-chain coordination**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppReceiver.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./CrapsVault.sol";

contract OmniVaultCoordinator is OAppSender, OAppReceiver, AccessControl {
    bytes32 public constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    
    // Message types for cross-chain communication
    enum MessageType {
        DEPOSIT_NOTIFICATION,     // LP deposited on spoke chain
        WITHDRAWAL_REQUEST,       // LP wants to withdraw
        VAULT_STATE_UPDATE,       // Broadcast vault performance
        BET_SETTLEMENT_UPDATE,    // Notify spoke chains of bet results
        EMERGENCY_PAUSE           // Emergency pause across all chains
    }
    
    // Vault state tracking
    struct VaultState {
        uint256 totalAssets;
        uint256 lockedAmount;
        uint256 profitLoss;
        uint256 performanceFee;
        uint256 lastUpdateBlock;
    }
    
    // Cross-chain vault tracking
    mapping(uint256 => VaultState) public vaultStates; // botId => state
    mapping(uint32 => mapping(uint256 => uint256)) public spokeChainDeposits; // chainId => botId => amount
    mapping(uint32 => bool) public authorizedChains;
    
    // Bot vault mappings
    mapping(uint256 => address) public botVaults; // botId => CrapsVault address
    
    event CrossChainDeposit(uint32 indexed srcChain, uint256 indexed botId, uint256 amount, address depositor);
    event VaultStateUpdate(uint256 indexed botId, VaultState state);
    event CrossChainWithdrawal(uint32 indexed dstChain, uint256 indexed botId, uint256 amount, address recipient);
    
    constructor(
        address _endpoint,
        address _owner
    ) OAppSender(_endpoint, _owner) OAppReceiver(_endpoint, _owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(VAULT_MANAGER_ROLE, _owner);
    }
    
    /**
     * @notice Process incoming cross-chain deposit
     */
    function _lzReceive(
        uint32 _srcEid,
        bytes32 _sender,
        uint64 _nonce,
        bytes calldata _payload
    ) internal override {
        require(authorizedChains[_srcEid], "Unauthorized chain");
        
        (MessageType msgType, bytes memory data) = abi.decode(_payload, (MessageType, bytes));
        
        if (msgType == MessageType.DEPOSIT_NOTIFICATION) {
            _handleCrossChainDeposit(_srcEid, data);
        } else if (msgType == MessageType.WITHDRAWAL_REQUEST) {
            _handleWithdrawalRequest(_srcEid, data);
        } else if (msgType == MessageType.EMERGENCY_PAUSE) {
            _handleEmergencyPause();
        }
    }
    
    /**
     * @notice Handle cross-chain deposit notification
     */
    function _handleCrossChainDeposit(uint32 srcChain, bytes memory data) internal {
        (uint256 botId, uint256 amount, address depositor) = abi.decode(data, (uint256, uint256, address));
        
        // Update spoke chain deposit tracking
        spokeChainDeposits[srcChain][botId] += amount;
        
        // Add liquidity to corresponding bot vault
        address vault = botVaults[botId];
        require(vault != address(0), "Vault not found");
        
        // Transfer equivalent amount to vault (assuming bridged tokens)
        CrapsVault(vault).addLiquidity(amount);
        
        emit CrossChainDeposit(srcChain, botId, amount, depositor);
        
        // Broadcast updated vault state
        _broadcastVaultState(botId);
    }
    
    /**
     * @notice Handle withdrawal request from spoke chain
     */
    function _handleWithdrawalRequest(uint32 srcChain, bytes memory data) internal {
        (uint256 botId, uint256 amount, address recipient) = abi.decode(data, (uint256, uint256, address));
        
        address vault = botVaults[botId];
        require(vault != address(0), "Vault not found");
        
        // Check if withdrawal is possible
        require(CrapsVault(vault).canWithdraw(amount), "Insufficient liquidity");
        
        // Remove liquidity from vault
        CrapsVault(vault).removeLiquidity(amount);
        
        // Update tracking
        spokeChainDeposits[srcChain][botId] -= amount;
        
        // Send approval message back to spoke chain
        _sendWithdrawalApproval(srcChain, botId, amount, recipient);
        
        emit CrossChainWithdrawal(srcChain, botId, amount, recipient);
    }
    
    /**
     * @notice Broadcast vault state to all spoke chains
     */
    function _broadcastVaultState(uint256 botId) internal {
        address vault = botVaults[botId];
        VaultState memory state = VaultState({
            totalAssets: CrapsVault(vault).totalAssets(),
            lockedAmount: CrapsVault(vault).totalLockedAmount(),
            profitLoss: CrapsVault(vault).totalProfit(),
            performanceFee: CrapsVault(vault).totalFees(),
            lastUpdateBlock: block.number
        });
        
        vaultStates[botId] = state;
        
        // Send to all authorized chains
        for (uint32 chainId = 1; chainId <= 100; chainId++) {
            if (authorizedChains[chainId]) {
                _sendVaultUpdate(chainId, botId, state);
            }
        }
        
        emit VaultStateUpdate(botId, state);
    }
    
    /**
     * @notice Send vault state update to spoke chain
     */
    function _sendVaultUpdate(uint32 dstChain, uint256 botId, VaultState memory state) internal {
        bytes memory payload = abi.encode(
            MessageType.VAULT_STATE_UPDATE,
            abi.encode(botId, state)
        );
        
        MessagingFee memory fee = _quote(dstChain, payload, "", false);
        _lzSend(dstChain, payload, "", fee, payable(msg.sender));
    }
    
    /**
     * @notice Send withdrawal approval to spoke chain
     */
    function _sendWithdrawalApproval(uint32 dstChain, uint256 botId, uint256 amount, address recipient) internal {
        bytes memory payload = abi.encode(
            MessageType.WITHDRAWAL_REQUEST,
            abi.encode(botId, amount, recipient, true) // true = approved
        );
        
        MessagingFee memory fee = _quote(dstChain, payload, "", false);
        _lzSend(dstChain, payload, "", fee, payable(address(this)));
    }
    
    /**
     * @notice Register a bot vault
     */
    function registerBotVault(uint256 botId, address vault) external onlyRole(VAULT_MANAGER_ROLE) {
        botVaults[botId] = vault;
        _broadcastVaultState(botId);
    }
    
    /**
     * @notice Authorize a spoke chain
     */
    function authorizeChain(uint32 chainId, bool authorized) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedChains[chainId] = authorized;
    }
}
```

### 2. Spoke Chain Contracts

#### 2.1 SpokeVaultProxy.sol
**Proxy vaults on spoke chains for LP deposits**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppReceiver.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

contract SpokeVaultProxy is ERC4626, OAppSender, OAppReceiver {
    uint32 public immutable HUB_CHAIN_ID;
    uint256 public immutable BOT_ID;
    
    // Mirrored state from hub chain
    struct HubVaultState {
        uint256 totalAssets;
        uint256 lockedAmount;
        uint256 profitLoss;
        uint256 performanceFee;
        uint256 lastUpdate;
        bool isValid;
    }
    
    HubVaultState public hubState;
    uint256 public localDeposits;
    mapping(address => bool) public pendingWithdrawals;
    
    event StateUpdated(HubVaultState state);
    event DepositBridged(address indexed user, uint256 amount);
    event WithdrawalRequested(address indexed user, uint256 amount);
    
    constructor(
        IERC20 _asset,
        uint256 _botId,
        uint32 _hubChainId,
        address _endpoint,
        address _owner
    ) 
        ERC4626(_asset) 
        ERC20("Spoke Vault Shares", "SVS")
        OAppSender(_endpoint, _owner)
        OAppReceiver(_endpoint, _owner)
    {
        BOT_ID = _botId;
        HUB_CHAIN_ID = _hubChainId;
    }
    
    /**
     * @notice Deposit with automatic bridging to hub
     */
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        returns (uint256 shares) 
    {
        shares = super.deposit(assets, receiver);
        localDeposits += assets;
        
        // Bridge deposit notification to hub
        _bridgeDeposit(receiver, assets);
        
        emit DepositBridged(receiver, assets);
    }
    
    /**
     * @notice Request withdrawal (async, requires hub approval)
     */
    function requestWithdrawal(uint256 shares) external {
        uint256 assets = previewRedeem(shares);
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");
        
        pendingWithdrawals[msg.sender] = true;
        
        // Send withdrawal request to hub
        _bridgeWithdrawalRequest(msg.sender, assets);
        
        emit WithdrawalRequested(msg.sender, assets);
    }
    
    /**
     * @notice Process hub chain messages
     */
    function _lzReceive(
        uint32 _srcEid,
        bytes32 _sender,
        uint64 _nonce,
        bytes calldata _payload
    ) internal override {
        require(_srcEid == HUB_CHAIN_ID, "Only hub chain");
        
        (uint8 msgType, bytes memory data) = abi.decode(_payload, (uint8, bytes));
        
        if (msgType == 1) { // VAULT_STATE_UPDATE
            _updateVaultState(data);
        } else if (msgType == 2) { // WITHDRAWAL_APPROVAL
            _processWithdrawalApproval(data);
        }
    }
    
    /**
     * @notice Update vault state from hub
     */
    function _updateVaultState(bytes memory data) internal {
        (uint256 botId, HubVaultState memory state) = abi.decode(data, (uint256, HubVaultState));
        
        if (botId == BOT_ID) {
            hubState = state;
            hubState.isValid = true;
            emit StateUpdated(state);
        }
    }
    
    /**
     * @notice Bridge deposit notification to hub
     */
    function _bridgeDeposit(address depositor, uint256 amount) internal {
        bytes memory payload = abi.encode(
            uint8(0), // DEPOSIT_NOTIFICATION
            abi.encode(BOT_ID, amount, depositor)
        );
        
        MessagingFee memory fee = _quote(HUB_CHAIN_ID, payload, "", false);
        _lzSend(HUB_CHAIN_ID, payload, "", fee, payable(msg.sender));
    }
    
    /**
     * @notice Bridge withdrawal request to hub
     */
    function _bridgeWithdrawalRequest(address recipient, uint256 amount) internal {
        bytes memory payload = abi.encode(
            uint8(1), // WITHDRAWAL_REQUEST
            abi.encode(BOT_ID, amount, recipient)
        );
        
        MessagingFee memory fee = _quote(HUB_CHAIN_ID, payload, "", false);
        _lzSend(HUB_CHAIN_ID, payload, "", fee, payable(msg.sender));
    }
    
    /**
     * @notice Get effective total assets (including hub state)
     */
    function totalAssets() public view override returns (uint256) {
        if (!hubState.isValid) {
            return IERC20(asset()).balanceOf(address(this));
        }
        
        // Calculate proportional share of hub vault
        uint256 totalHubDeposits = _calculateTotalSpokeDeposits();
        if (totalHubDeposits == 0) return localDeposits;
        
        uint256 hubTotalValue = hubState.totalAssets + hubState.profitLoss;
        return (localDeposits * hubTotalValue) / totalHubDeposits;
    }
    
    function _calculateTotalSpokeDeposits() internal view returns (uint256) {
        // This would need to track total deposits across all spoke chains
        // For now, simplified to local deposits
        return localDeposits;
    }
}
```

## Message Types and Packet Structure

### 3. Cross-Chain Message Protocol

#### 3.1 Message Type Definitions

```solidity
enum MessageType {
    DEPOSIT_NOTIFICATION = 0,    // LP deposited on spoke chain
    WITHDRAWAL_REQUEST = 1,      // LP requests withdrawal
    WITHDRAWAL_APPROVAL = 2,     // Hub approves withdrawal
    VAULT_STATE_UPDATE = 3,      // Hub broadcasts vault performance
    BET_SETTLEMENT_UPDATE = 4,   // Notify spoke chains of bet results
    LIQUIDITY_REBALANCE = 5,     // Cross-chain liquidity optimization
    EMERGENCY_PAUSE = 6,         // Emergency pause across all chains
    BOT_PERFORMANCE_UPDATE = 7   // Bot strategy performance metrics
}
```

#### 3.2 Packet Structures

```solidity
// Deposit notification from spoke to hub
struct DepositPacket {
    uint256 botId;
    uint256 amount;
    address depositor;
    uint256 timestamp;
    bytes32 txHash;
}

// Withdrawal request from spoke to hub  
struct WithdrawalPacket {
    uint256 botId;
    uint256 amount;
    address recipient;
    uint256 shares;
    bool isApproved;
}

// Vault state update from hub to spokes
struct VaultStatePacket {
    uint256 botId;
    uint256 totalAssets;
    uint256 lockedAmount;
    int256 profitLoss;
    uint256 performanceFee;
    uint256 blockNumber;
    bytes32 stateRoot;
}

// Bet settlement notification
struct BetSettlementPacket {
    uint256 seriesId;
    uint256 botId;
    uint256 betAmount;
    uint256 payout;
    bool won;
    uint8 diceResult1;
    uint8 diceResult2;
}
```

## State Synchronization Strategies

### 4. Synchronization Architecture

#### 4.1 Hub-Spoke Model with Event Sourcing

```solidity
contract StateManager {
    // Event log for state reconstruction
    struct StateEvent {
        uint256 eventId;
        uint256 timestamp;
        uint256 blockNumber;
        bytes32 eventHash;
        bytes eventData;
    }
    
    mapping(uint256 => StateEvent[]) public botEventLogs; // botId => events
    mapping(uint256 => bytes32) public stateRoots; // botId => merkle root
    
    /**
     * @notice Create state checkpoint with merkle proof
     */
    function createStateCheckpoint(uint256 botId) external {
        StateEvent[] memory events = botEventLogs[botId];
        bytes32[] memory leaves = new bytes32[](events.length);
        
        for (uint i = 0; i < events.length; i++) {
            leaves[i] = events[i].eventHash;
        }
        
        stateRoots[botId] = _computeMerkleRoot(leaves);
    }
    
    /**
     * @notice Verify state consistency across chains
     */
    function verifyStateConsistency(
        uint256 botId,
        bytes32 claimedRoot,
        bytes32[] calldata proof
    ) external view returns (bool) {
        return _verifyMerkleProof(stateRoots[botId], claimedRoot, proof);
    }
}
```

#### 4.2 Eventual Consistency Model

```typescript
// TypeScript state sync logic
interface SyncStrategy {
  syncInterval: number;
  maxRetries: number;
  conflictResolution: 'hub-wins' | 'timestamp' | 'vote';
}

class VaultStateSynchronizer {
  private hubState: VaultState;
  private spokeStates: Map<ChainId, VaultState>;
  
  async syncVaultState(botId: number): Promise<void> {
    // 1. Fetch latest state from hub
    const hubState = await this.fetchHubState(botId);
    
    // 2. Compare with spoke chain states
    const inconsistencies = this.detectInconsistencies(hubState);
    
    // 3. Resolve conflicts using hub-wins strategy
    if (inconsistencies.length > 0) {
      await this.resolveInconsistencies(inconsistencies);
    }
    
    // 4. Broadcast updates to spoke chains
    await this.broadcastStateUpdate(botId, hubState);
  }
  
  private async resolveInconsistencies(conflicts: StateConflict[]): Promise<void> {
    // Hub state always wins for simplicity
    for (const conflict of conflicts) {
      await this.updateSpokeChain(conflict.chainId, conflict.hubState);
    }
  }
}
```

## Security Considerations

### 5. Multi-Layer Security Framework

#### 5.1 Message Validation and Authentication

```solidity
contract SecurityManager {
    // Trusted endpoints mapping
    mapping(uint32 => bytes32) public trustedEndpoints;
    mapping(address => bool) public authorizedOperators;
    
    // Rate limiting
    mapping(uint32 => mapping(address => uint256)) public lastMessageTime;
    uint256 public constant MESSAGE_COOLDOWN = 10 seconds;
    
    // Message sequencing
    mapping(uint32 => uint256) public expectedNonce;
    
    modifier onlyTrustedEndpoint(uint32 chainId, bytes32 sender) {
        require(trustedEndpoints[chainId] == sender, "Untrusted endpoint");
        _;
    }
    
    modifier rateLimited(uint32 chainId) {
        require(
            block.timestamp >= lastMessageTime[chainId][msg.sender] + MESSAGE_COOLDOWN,
            "Rate limited"
        );
        lastMessageTime[chainId][msg.sender] = block.timestamp;
        _;
    }
    
    modifier sequentialNonce(uint32 chainId, uint256 nonce) {
        require(nonce == expectedNonce[chainId], "Invalid nonce");
        expectedNonce[chainId]++;
        _;
    }
    
    /**
     * @notice Validate cross-chain message integrity
     */
    function validateMessage(
        uint32 srcChain,
        bytes32 sender,
        uint256 nonce,
        bytes calldata payload
    ) external view returns (bool) {
        // 1. Check trusted endpoint
        if (trustedEndpoints[srcChain] != sender) return false;
        
        // 2. Verify nonce sequence
        if (nonce != expectedNonce[srcChain]) return false;
        
        // 3. Validate payload structure
        return _validatePayloadStructure(payload);
    }
}
```

#### 5.2 Circuit Breakers and Emergency Controls

```solidity
contract EmergencyControls {
    enum EmergencyLevel {
        NORMAL,
        WARNING,     // Slow down operations
        CRITICAL,    // Pause new operations
        EMERGENCY    // Halt all operations
    }
    
    EmergencyLevel public emergencyLevel = EmergencyLevel.NORMAL;
    mapping(uint32 => bool) public chainPaused;
    
    event EmergencyLevelChanged(EmergencyLevel newLevel);
    event ChainPaused(uint32 chainId);
    
    modifier notInEmergency() {
        require(emergencyLevel != EmergencyLevel.EMERGENCY, "Emergency mode");
        _;
    }
    
    modifier chainNotPaused(uint32 chainId) {
        require(!chainPaused[chainId], "Chain paused");
        _;
    }
    
    /**
     * @notice Trigger emergency pause across all chains
     */
    function triggerEmergencyPause() external onlyRole(EMERGENCY_ROLE) {
        emergencyLevel = EmergencyLevel.EMERGENCY;
        
        // Send emergency pause to all chains
        _broadcastEmergencyPause();
        
        emit EmergencyLevelChanged(EmergencyLevel.EMERGENCY);
    }
    
    /**
     * @notice Circuit breaker based on anomaly detection
     */
    function checkAndTriggerCircuitBreaker(
        uint256 botId,
        uint256 unusualActivityThreshold
    ) external {
        VaultMetrics memory metrics = _getVaultMetrics(botId);
        
        if (_detectAnomalies(metrics, unusualActivityThreshold)) {
            _pauseVault(botId);
            emergencyLevel = EmergencyLevel.CRITICAL;
        }
    }
}
```

## Gas Optimization Strategies

### 6. Gas-Efficient Cross-Chain Operations

#### 6.1 Batch Processing and Compression

```solidity
contract GasOptimizer {
    // Batch multiple operations in single message
    struct BatchOperation {
        uint8 opType;
        bytes data;
    }
    
    /**
     * @notice Process batched operations to reduce LayerZero fees
     */
    function processBatch(BatchOperation[] calldata operations) external {
        for (uint i = 0; i < operations.length; i++) {
            if (operations[i].opType == 0) {
                _processDeposit(operations[i].data);
            } else if (operations[i].opType == 1) {
                _processWithdrawal(operations[i].data);
            }
            // ... other operation types
        }
    }
    
    /**
     * @notice Compress state updates using delta encoding
     */
    function compressStateUpdate(
        VaultState calldata currentState,
        VaultState calldata previousState
    ) external pure returns (bytes memory) {
        // Only send changed fields to reduce payload size
        uint8 changedFields = 0;
        bytes memory deltaData;
        
        if (currentState.totalAssets != previousState.totalAssets) {
            changedFields |= 0x01;
            deltaData = abi.encodePacked(deltaData, currentState.totalAssets);
        }
        
        if (currentState.lockedAmount != previousState.lockedAmount) {
            changedFields |= 0x02;
            deltaData = abi.encodePacked(deltaData, currentState.lockedAmount);
        }
        
        return abi.encodePacked(changedFields, deltaData);
    }
    
    /**
     * @notice Estimate cross-chain operation costs
     */
    function estimateGasCosts(
        uint32[] calldata dstChains,
        bytes[] calldata payloads
    ) external view returns (uint256 totalCost) {
        for (uint i = 0; i < dstChains.length; i++) {
            MessagingFee memory fee = _quote(dstChains[i], payloads[i], "", false);
            totalCost += fee.nativeFee;
        }
    }
}
```

#### 6.2 Lazy State Synchronization

```solidity
contract LazySync {
    // Only sync when necessary
    mapping(uint256 => uint256) public lastSyncBlock;
    uint256 public constant SYNC_THRESHOLD = 100; // blocks
    
    /**
     * @notice Only sync if significant time has passed or threshold reached
     */
    function conditionalSync(uint256 botId) external {
        if (_shouldSync(botId)) {
            _performSync(botId);
            lastSyncBlock[botId] = block.number;
        }
    }
    
    function _shouldSync(uint256 botId) internal view returns (bool) {
        return (
            block.number >= lastSyncBlock[botId] + SYNC_THRESHOLD ||
            _hasSignificantChanges(botId)
        );
    }
}
```

## Error Handling and Recovery

### 7. Robust Error Management

#### 7.1 Automatic Retry Mechanism

```solidity
contract RetryManager {
    struct FailedMessage {
        uint32 dstChain;
        bytes payload;
        uint256 attempts;
        uint256 lastAttempt;
        bool resolved;
    }
    
    mapping(bytes32 => FailedMessage) public failedMessages;
    uint256 public constant MAX_RETRIES = 3;
    uint256 public constant RETRY_DELAY = 300; // 5 minutes
    
    /**
     * @notice Retry failed cross-chain message
     */
    function retryFailedMessage(bytes32 messageId) external {
        FailedMessage storage failed = failedMessages[messageId];
        
        require(!failed.resolved, "Already resolved");
        require(failed.attempts < MAX_RETRIES, "Max retries exceeded");
        require(
            block.timestamp >= failed.lastAttempt + RETRY_DELAY,
            "Retry too soon"
        );
        
        failed.attempts++;
        failed.lastAttempt = block.timestamp;
        
        try this.sendMessage(failed.dstChain, failed.payload) {
            failed.resolved = true;
        } catch {
            if (failed.attempts >= MAX_RETRIES) {
                _escalateToManualResolution(messageId);
            }
        }
    }
    
    /**
     * @notice Escalate to manual resolution after max retries
     */
    function _escalateToManualResolution(bytes32 messageId) internal {
        // Emit event for operator intervention
        emit ManualResolutionRequired(messageId);
        
        // Could also pause affected operations
        _pauseRelatedOperations(messageId);
    }
}
```

#### 7.2 State Recovery Mechanisms

```solidity
contract StateRecovery {
    /**
     * @notice Recover vault state from event log
     */
    function recoverVaultState(
        uint256 botId,
        uint256 fromBlock,
        uint256 toBlock
    ) external view returns (VaultState memory) {
        VaultState memory state;
        
        // Replay events to reconstruct state
        StateEvent[] memory events = _getEventsInRange(botId, fromBlock, toBlock);
        
        for (uint i = 0; i < events.length; i++) {
            state = _applyEvent(state, events[i]);
        }
        
        return state;
    }
    
    /**
     * @notice Verify state consistency using merkle proofs
     */
    function verifyStateIntegrity(
        uint256 botId,
        VaultState memory claimedState,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        bytes32 stateHash = keccak256(abi.encode(claimedState));
        return _verifyMerkleProof(stateRoots[botId], stateHash, merkleProof);
    }
}
```

## Implementation Roadmap

### Phase 1: Foundation (Days 1-7)
1. **Day 1-2**: Install LayerZero V2 packages and setup base configuration
2. **Day 3-4**: Implement `OmniVaultCoordinator` on Base Sepolia
3. **Day 5-6**: Deploy `SpokeVaultProxy` on Arbitrum Sepolia  
4. **Day 7**: Test basic deposit/withdrawal flow

### Phase 2: State Sync (Days 8-14)
1. **Day 8-9**: Implement state synchronization mechanisms
2. **Day 10-11**: Add security validations and rate limiting
3. **Day 12-13**: Gas optimization and batch processing
4. **Day 14**: Integration testing across chains

### Phase 3: Production Ready (Days 15-21)
1. **Day 15-16**: Error handling and retry mechanisms
2. **Day 17-18**: Emergency controls and circuit breakers
3. **Day 19-20**: Performance testing and optimization
4. **Day 21**: Documentation and deployment scripts

## Configuration Files

### LayerZero V2 Configuration

```typescript
// layerzero.config.ts
export const LAYERZERO_CONFIG = {
  endpoints: {
    baseSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    arbitrumSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    flowTestnet: "0x..." // TBD
  },
  
  chainIds: {
    baseSepolia: 40245,
    arbitrumSepolia: 40231,
    flowTestnet: 40999 // TBD
  },
  
  gasLimits: {
    deposit: 200000,
    withdrawal: 250000,
    stateUpdate: 150000,
    emergency: 100000
  },
  
  fees: {
    maxNativeFee: ethers.parseEther("0.01"), // 0.01 ETH max
    zroToken: ethers.ZeroAddress // Use native token
  }
};
```

### Security Parameters

```typescript
// security.config.ts
export const SECURITY_CONFIG = {
  rateLimiting: {
    messagesPerMinute: 60,
    cooldownPeriod: 10, // seconds
    burstLimit: 10
  },
  
  circuitBreakers: {
    maxVaultLoss: ethers.parseEther("1000"), // 1000 BOT
    maxDailyVolume: ethers.parseEther("100000"), // 100k BOT
    anomalyThreshold: 0.2 // 20% deviation
  },
  
  emergencyControls: {
    pauseThreshold: 0.1, // 10% vault loss
    emergencyThreshold: 0.25, // 25% vault loss
    recoveryTimelock: 86400 // 24 hours
  }
};
```

## Conclusion

This LayerZero V2 omnichain architecture enables Barely Human Casino to:

1. **Scale Liquidity**: Accept LP deposits from multiple chains
2. **Maintain Centralization**: Keep game logic simple on single chain
3. **Ensure Security**: Comprehensive validation and emergency controls
4. **Optimize Costs**: Batch operations and efficient message passing
5. **Handle Failures**: Robust error handling and recovery mechanisms

The hub-spoke model with Base Sepolia as the primary chain provides the optimal balance between decentralization and operational simplicity, while LayerZero V2's advanced features enable secure, efficient cross-chain communication.

**Total Implementation Time**: ~3 weeks
**Gas Budget**: ~0.5 ETH for testing across 3 chains
**Prize Qualification**: LayerZero V2, Circle USDC, Hyperlane, Dynamic, Flow