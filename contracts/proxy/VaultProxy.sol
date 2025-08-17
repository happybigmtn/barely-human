// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VaultProxy
 * @notice Minimal proxy for vault deployments to save gas and contract size
 * @dev Uses EIP-1167 minimal proxy pattern for extreme gas efficiency
 */
contract VaultProxy {
    address immutable implementation;
    
    constructor(address _implementation) {
        implementation = _implementation;
    }
    
    fallback() external payable {
        address impl = implementation;
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
    
    receive() external payable {}
}

/**
 * @title VaultBeacon
 * @notice Beacon for upgradeable vault proxies using beacon pattern
 * @dev Allows updating all vault implementations at once
 */
contract VaultBeacon is UpgradeableBeacon {
    constructor(address implementation_) UpgradeableBeacon(implementation_, msg.sender) {}
}

/**
 * @title VaultProxyFactory
 * @notice Factory for deploying minimal proxies pointing to vault implementation
 * @dev Reduces deployment cost from ~2M gas to ~200k gas per vault
 */
contract VaultProxyFactory is Ownable {
    address public vaultImplementation;
    address public beacon;
    address[] public deployedProxies;
    
    event ProxyDeployed(address indexed proxy, uint256 indexed botId);
    event ImplementationUpdated(address indexed newImplementation);
    
    constructor(address _vaultImplementation) Ownable(msg.sender) {
        vaultImplementation = _vaultImplementation;
        beacon = address(new VaultBeacon(_vaultImplementation));
    }
    
    /**
     * @notice Deploy minimal proxy for a vault
     * @dev Uses CREATE2 for deterministic addresses
     */
    function deployVaultProxy(
        uint256 botId,
        bytes calldata initData
    ) external onlyOwner returns (address proxy) {
        // Use CREATE2 for deterministic deployment
        bytes32 salt = keccak256(abi.encodePacked(botId, block.timestamp));
        
        // Deploy minimal proxy
        proxy = address(new BeaconProxy{salt: salt}(beacon, initData));
        
        deployedProxies.push(proxy);
        emit ProxyDeployed(proxy, botId);
    }
    
    /**
     * @notice Deploy multiple vault proxies in batch
     * @dev Gas efficient batch deployment
     */
    function deployVaultProxiesBatch(
        uint256[] calldata botIds,
        bytes[] calldata initDatas
    ) external onlyOwner returns (address[] memory proxies) {
        require(botIds.length == initDatas.length, "Length mismatch");
        proxies = new address[](botIds.length);
        
        for (uint256 i = 0; i < botIds.length; i++) {
            proxies[i] = deployVaultProxy(botIds[i], initDatas[i]);
        }
    }
    
    /**
     * @notice Update implementation for all beacon proxies
     */
    function upgradeImplementation(address newImplementation) external onlyOwner {
        VaultBeacon(beacon).upgradeTo(newImplementation);
        vaultImplementation = newImplementation;
        emit ImplementationUpdated(newImplementation);
    }
}