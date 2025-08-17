// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ChainConfig
 * @notice Chain-specific configuration for VRF, LayerZero, and other services
 * @dev Centralizes all chain-specific settings to avoid hardcoding
 */
contract ChainConfig is AccessControl {
    bytes32 public constant CONFIG_ADMIN = keccak256("CONFIG_ADMIN");
    
    // Chain IDs
    uint256 public constant ETHEREUM_MAINNET = 1;
    uint256 public constant BASE_MAINNET = 8453;
    uint256 public constant ARBITRUM_ONE = 42161;
    uint256 public constant OPTIMISM = 10;
    uint256 public constant POLYGON = 137;
    
    // Testnet Chain IDs
    uint256 public constant SEPOLIA = 11155111;
    uint256 public constant BASE_SEPOLIA = 84532;
    uint256 public constant ARBITRUM_SEPOLIA = 421614;
    uint256 public constant OPTIMISM_SEPOLIA = 11155420;
    uint256 public constant POLYGON_AMOY = 80002;
    
    // VRF Configuration
    struct VRFConfig {
        address coordinator;
        uint64 subscriptionId;
        bytes32 keyHash;
        uint32 callbackGasLimit;
        uint16 requestConfirmations;
        uint32 numWords;
        bool useNativePayment;
    }
    
    // LayerZero Configuration
    struct LayerZeroConfig {
        address endpoint;
        uint32 eid; // Endpoint ID
        uint128 defaultGasLimit;
        uint128 maxGasLimit;
        bool useCustomAdapterParams;
    }
    
    // Gas Configuration
    struct GasConfig {
        uint256 maxGasPrice;
        uint256 priorityFee;
        uint256 batchOperationLimit;
        uint256 loopIterationLimit;
    }
    
    // Mappings for configurations
    mapping(uint256 => VRFConfig) public vrfConfigs;
    mapping(uint256 => LayerZeroConfig) public layerZeroConfigs;
    mapping(uint256 => GasConfig) public gasConfigs;
    mapping(uint256 => bool) public supportedChains;
    
    // Events
    event VRFConfigUpdated(uint256 indexed chainId, VRFConfig config);
    event LayerZeroConfigUpdated(uint256 indexed chainId, LayerZeroConfig config);
    event GasConfigUpdated(uint256 indexed chainId, GasConfig config);
    event ChainSupportUpdated(uint256 indexed chainId, bool supported);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CONFIG_ADMIN, msg.sender);
        
        _initializeDefaultConfigs();
    }
    
    /**
     * @notice Initialize default configurations for supported chains
     */
    function _initializeDefaultConfigs() private {
        // Base Sepolia VRF Config
        vrfConfigs[BASE_SEPOLIA] = VRFConfig({
            coordinator: 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634,
            subscriptionId: 1,
            keyHash: 0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c,
            callbackGasLimit: 200000,
            requestConfirmations: 3,
            numWords: 2,
            useNativePayment: false
        });
        supportedChains[BASE_SEPOLIA] = true;
        
        // Arbitrum Sepolia VRF Config
        vrfConfigs[ARBITRUM_SEPOLIA] = VRFConfig({
            coordinator: 0x50d47e4142598E3411aA864e08a44284e471AC6f,
            subscriptionId: 1,
            keyHash: 0x027f94ff1465b3525f9fc03e9ff7d6d2c0953482246dd6ae07570c45d6631414,
            callbackGasLimit: 250000, // Higher for Arbitrum
            requestConfirmations: 1, // Faster on L2
            numWords: 2,
            useNativePayment: false
        });
        supportedChains[ARBITRUM_SEPOLIA] = true;
        
        // Base Sepolia LayerZero Config
        layerZeroConfigs[BASE_SEPOLIA] = LayerZeroConfig({
            endpoint: 0x6EDCE65403992e310A62460808c4b910D972f10f,
            eid: 40245, // Base Sepolia endpoint ID
            defaultGasLimit: 200000,
            maxGasLimit: 500000,
            useCustomAdapterParams: true
        });
        
        // Arbitrum Sepolia LayerZero Config
        layerZeroConfigs[ARBITRUM_SEPOLIA] = LayerZeroConfig({
            endpoint: 0x6EDCE65403992e310A62460808c4b910D972f10f,
            eid: 40231, // Arbitrum Sepolia endpoint ID
            defaultGasLimit: 250000,
            maxGasLimit: 600000,
            useCustomAdapterParams: true
        });
        
        // Gas configs for testnets (generous limits)
        gasConfigs[BASE_SEPOLIA] = GasConfig({
            maxGasPrice: 100 gwei,
            priorityFee: 2 gwei,
            batchOperationLimit: 20,
            loopIterationLimit: 100
        });
        
        gasConfigs[ARBITRUM_SEPOLIA] = GasConfig({
            maxGasPrice: 50 gwei,
            priorityFee: 1 gwei,
            batchOperationLimit: 30, // More efficient on L2
            loopIterationLimit: 150
        });
    }
    
    /**
     * @notice Update VRF configuration for a chain
     */
    function updateVRFConfig(
        uint256 chainId,
        VRFConfig calldata config
    ) external onlyRole(CONFIG_ADMIN) {
        vrfConfigs[chainId] = config;
        emit VRFConfigUpdated(chainId, config);
    }
    
    /**
     * @notice Update LayerZero configuration for a chain
     */
    function updateLayerZeroConfig(
        uint256 chainId,
        LayerZeroConfig calldata config
    ) external onlyRole(CONFIG_ADMIN) {
        layerZeroConfigs[chainId] = config;
        emit LayerZeroConfigUpdated(chainId, config);
    }
    
    /**
     * @notice Update gas configuration for a chain
     */
    function updateGasConfig(
        uint256 chainId,
        GasConfig calldata config
    ) external onlyRole(CONFIG_ADMIN) {
        gasConfigs[chainId] = config;
        emit GasConfigUpdated(chainId, config);
    }
    
    /**
     * @notice Add or remove chain support
     */
    function setChainSupport(
        uint256 chainId,
        bool supported
    ) external onlyRole(CONFIG_ADMIN) {
        supportedChains[chainId] = supported;
        emit ChainSupportUpdated(chainId, supported);
    }
    
    /**
     * @notice Get VRF config for current chain
     */
    function getCurrentVRFConfig() external view returns (VRFConfig memory) {
        return vrfConfigs[block.chainid];
    }
    
    /**
     * @notice Get LayerZero config for current chain
     */
    function getCurrentLayerZeroConfig() external view returns (LayerZeroConfig memory) {
        return layerZeroConfigs[block.chainid];
    }
    
    /**
     * @notice Get gas config for current chain
     */
    function getCurrentGasConfig() external view returns (GasConfig memory) {
        return gasConfigs[block.chainid];
    }
    
    /**
     * @notice Check if current chain is supported
     */
    function isCurrentChainSupported() external view returns (bool) {
        return supportedChains[block.chainid];
    }
    
    /**
     * @notice Get optimal batch size based on current gas limit
     */
    function getOptimalBatchSize() external view returns (uint256) {
        GasConfig memory config = gasConfigs[block.chainid];
        
        // If no config, use safe defaults
        if (config.batchOperationLimit == 0) {
            return 10;
        }
        
        // Adjust based on gas price if too high
        if (tx.gasprice > config.maxGasPrice) {
            return config.batchOperationLimit / 2; // Reduce batch size
        }
        
        return config.batchOperationLimit;
    }
    
    /**
     * @notice Validate if operation should proceed based on gas price
     */
    function shouldProceedWithOperation() external view returns (bool) {
        GasConfig memory config = gasConfigs[block.chainid];
        
        // Always proceed on testnets or if no config
        if (config.maxGasPrice == 0) {
            return true;
        }
        
        return tx.gasprice <= config.maxGasPrice;
    }
}