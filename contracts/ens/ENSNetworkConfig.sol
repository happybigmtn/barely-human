// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title ENSNetworkConfig
 * @notice Centralized configuration for ENS contracts across different networks
 * @dev Contains verified contract addresses for ENS deployments
 * Supports mainnet, testnets, and L2 networks for ETHGlobal NYC 2025
 */
library ENSNetworkConfig {
    
    struct NetworkAddresses {
        address ensRegistry;
        address publicResolver;
        address l2ReverseRegistrar;
        address ethRegistrarController;
        address nameWrapper;
        bool isSupported;
        bool isL2;
        string networkName;
    }
    
    // Chain IDs
    uint256 public constant ETHEREUM_MAINNET = 1;
    uint256 public constant SEPOLIA = 11155111;
    uint256 public constant HOLESKY = 17000;
    
    // L2 Networks
    uint256 public constant BASE_MAINNET = 8453;
    uint256 public constant BASE_SEPOLIA = 84532;
    uint256 public constant ARBITRUM_ONE = 42161;
    uint256 public constant ARBITRUM_SEPOLIA = 421614;
    uint256 public constant OPTIMISM = 10;
    uint256 public constant OPTIMISM_SEPOLIA = 11155420;
    
    /**
     * @notice Get ENS contract addresses for a specific network
     * @param chainId The chain ID to get addresses for
     * @return Network configuration struct
     */
    function getNetworkConfig(uint256 chainId) internal pure returns (NetworkAddresses memory) {
        
        // Ethereum Mainnet
        if (chainId == ETHEREUM_MAINNET) {
            return NetworkAddresses({
                ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e,
                publicResolver: 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63,
                l2ReverseRegistrar: 0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb,
                ethRegistrarController: 0x253553366Da8546fC250F225fe3d25d0C782303b,
                nameWrapper: 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401,
                isSupported: true,
                isL2: false,
                networkName: "Ethereum Mainnet"
            });
        }
        
        // Sepolia Testnet  
        else if (chainId == SEPOLIA) {
            return NetworkAddresses({
                ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e,
                publicResolver: 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD,
                l2ReverseRegistrar: 0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6,
                ethRegistrarController: 0xFED6a969AaA60E4961FCD3EBF1A2e8913ac65B72,
                nameWrapper: 0x0635513f179D50A207757E05759CbD106d7dFcE8,
                isSupported: true,
                isL2: false,
                networkName: "Sepolia Testnet"
            });
        }
        
        // Holesky Testnet
        else if (chainId == HOLESKY) {
            return NetworkAddresses({
                ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e,
                publicResolver: 0x9010A27463717360cAD99CEA8bD39b8705CCA238,
                l2ReverseRegistrar: 0x132AC0B116a73add4225029D1951A9A707Ef673f,
                ethRegistrarController: 0x179Be112b24Ad4cFC392eF8924DfA08C20Ad8583,
                nameWrapper: 0xab50971078225D365994dc1Edcb9b7FD72Bb4862,
                isSupported: true,
                isL2: false,
                networkName: "Holesky Testnet"
            });
        }
        
        // Base Sepolia (L2 Testnet)
        else if (chainId == BASE_SEPOLIA) {
            return NetworkAddresses({
                ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e, // Same as mainnet
                publicResolver: 0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA, // Base-specific resolver
                l2ReverseRegistrar: 0x08CEd32a7f3eeC915Ba84415e9C07a7286977956, // Base L2 reverse registrar
                ethRegistrarController: address(0), // Not available on L2
                nameWrapper: address(0), // Not available on L2
                isSupported: true,
                isL2: true,
                networkName: "Base Sepolia"
            });
        }
        
        // Base Mainnet (L2)
        else if (chainId == BASE_MAINNET) {
            return NetworkAddresses({
                ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e, // Same as mainnet
                publicResolver: 0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA, // Base-specific resolver
                l2ReverseRegistrar: 0x79EA96012eEa67A83431F1701B3dFf7e37F9E282, // Base L2 reverse registrar
                ethRegistrarController: address(0), // Not available on L2
                nameWrapper: address(0), // Not available on L2
                isSupported: true,
                isL2: true,
                networkName: "Base"
            });
        }
        
        // Arbitrum Sepolia (L2 Testnet)
        else if (chainId == ARBITRUM_SEPOLIA) {
            return NetworkAddresses({
                ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e, // Same as mainnet
                publicResolver: 0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA, // Arbitrum-specific resolver
                l2ReverseRegistrar: 0x08CEd32a7f3eeC915Ba84415e9C07a7286977956, // Arbitrum L2 reverse registrar
                ethRegistrarController: address(0), // Not available on L2
                nameWrapper: address(0), // Not available on L2
                isSupported: true,
                isL2: true,
                networkName: "Arbitrum Sepolia"
            });
        }
        
        // Arbitrum One (L2 Mainnet)
        else if (chainId == ARBITRUM_ONE) {
            return NetworkAddresses({
                ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e, // Same as mainnet
                publicResolver: 0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA, // Arbitrum-specific resolver
                l2ReverseRegistrar: 0x79EA96012eEa67A83431F1701B3dFf7e37F9E282, // Arbitrum L2 reverse registrar
                ethRegistrarController: address(0), // Not available on L2
                nameWrapper: address(0), // Not available on L2
                isSupported: true,
                isL2: true,
                networkName: "Arbitrum One"
            });
        }
        
        // Optimism Sepolia (L2 Testnet)
        else if (chainId == OPTIMISM_SEPOLIA) {
            return NetworkAddresses({
                ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e, // Same as mainnet
                publicResolver: 0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA, // OP-specific resolver
                l2ReverseRegistrar: 0x08CEd32a7f3eeC915Ba84415e9C07a7286977956, // OP L2 reverse registrar
                ethRegistrarController: address(0), // Not available on L2
                nameWrapper: address(0), // Not available on L2
                isSupported: true,
                isL2: true,
                networkName: "OP Sepolia"
            });
        }
        
        // Optimism (L2 Mainnet)
        else if (chainId == OPTIMISM) {
            return NetworkAddresses({
                ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e, // Same as mainnet
                publicResolver: 0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA, // OP-specific resolver
                l2ReverseRegistrar: 0x79EA96012eEa67A83431F1701B3dFf7e37F9E282, // OP L2 reverse registrar
                ethRegistrarController: address(0), // Not available on L2
                nameWrapper: address(0), // Not available on L2
                isSupported: true,
                isL2: true,
                networkName: "Optimism"
            });
        }
        
        // Unsupported network
        else {
            return NetworkAddresses({
                ensRegistry: address(0),
                publicResolver: address(0),
                l2ReverseRegistrar: address(0),
                ethRegistrarController: address(0),
                nameWrapper: address(0),
                isSupported: false,
                isL2: false,
                networkName: "Unsupported"
            });
        }
    }
    
    /**
     * @notice Check if a network supports ENS
     */
    function isNetworkSupported(uint256 chainId) internal pure returns (bool) {
        return getNetworkConfig(chainId).isSupported;
    }
    
    /**
     * @notice Check if a network is L2
     */
    function isL2Network(uint256 chainId) internal pure returns (bool) {
        return getNetworkConfig(chainId).isL2;
    }
    
    /**
     * @notice Get all supported chain IDs
     */
    function getSupportedChainIds() internal pure returns (uint256[] memory) {
        uint256[] memory chainIds = new uint256[](8);
        chainIds[0] = ETHEREUM_MAINNET;
        chainIds[1] = SEPOLIA;
        chainIds[2] = HOLESKY;
        chainIds[3] = BASE_MAINNET;
        chainIds[4] = BASE_SEPOLIA;
        chainIds[5] = ARBITRUM_ONE;
        chainIds[6] = ARBITRUM_SEPOLIA;
        chainIds[7] = OPTIMISM;
        return chainIds;
    }
}

/**
 * @title ENSConfigurable
 * @notice Base contract for ENS-integrated contracts with automatic network detection
 */
abstract contract ENSConfigurable {
    using ENSNetworkConfig for uint256;
    
    ENSNetworkConfig.NetworkAddresses public networkConfig;
    
    modifier onlySupported() {
        require(networkConfig.isSupported, "Network not supported for ENS");
        _;
    }
    
    modifier onlyL2() {
        require(networkConfig.isL2, "L2 Primary Names only available on L2");
        _;
    }
    
    /**
     * @notice Initialize network configuration
     */
    function _initializeNetworkConfig() internal {
        networkConfig = ENSNetworkConfig.getNetworkConfig(block.chainid);
        require(networkConfig.isSupported, "Unsupported network for ENS");
    }
    
    /**
     * @notice Get current network configuration
     */
    function getENSNetworkConfig() public view returns (ENSNetworkConfig.NetworkAddresses memory) {
        return networkConfig;
    }
}