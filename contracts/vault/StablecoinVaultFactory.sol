// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./USDCBotVault.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title StablecoinVaultFactory
 * @notice Factory for deploying stablecoin vaults for all bot personalities
 * @dev Supports USDC, USDT, and DAI vaults for prize qualification
 */
contract StablecoinVaultFactory is AccessControl {
    // Stablecoin addresses by chain
    struct StablecoinAddresses {
        address usdc;
        address usdt; 
        address dai;
    }
    
    // Base Sepolia stablecoins
    StablecoinAddresses public baseSepolia = StablecoinAddresses({
        usdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e,
        usdt: address(0), // Deploy mock if needed
        dai: address(0)   // Deploy mock if needed
    });
    
    // Arbitrum Sepolia stablecoins
    StablecoinAddresses public arbitrumSepolia = StablecoinAddresses({
        usdc: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d,
        usdt: address(0),
        dai: address(0)
    });
    
    // Bot personalities
    string[10] public botNames = [
        "Alice All-In",
        "Bob Calculator",
        "Charlie Lucky",
        "Diana Ice Queen",
        "Eddie Entertainer",
        "Fiona Fearless",
        "Greg Grinder",
        "Helen Hot Streak",
        "Ivan Intimidator",
        "Julia Jinx"
    ];
    
    // Deployed vaults tracking
    mapping(address => mapping(uint8 => address)) public stablecoinVaults; // stablecoin => botId => vault
    mapping(address => bool) public isVault;
    address[] public allVaults;
    
    // State
    address public crapsGame;
    address public treasury;
    uint256 public currentChainId;
    
    // Events
    event VaultDeployed(
        address indexed vault,
        address indexed stablecoin,
        uint8 indexed botId,
        string botName
    );
    
    event AllVaultsDeployed(
        address stablecoin,
        uint256 count
    );
    
    constructor(
        address _crapsGame,
        address _treasury
    ) {
        require(_crapsGame != address(0), "Invalid game");
        require(_treasury != address(0), "Invalid treasury");
        
        crapsGame = _crapsGame;
        treasury = _treasury;
        currentChainId = block.chainid;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Deploy USDC vaults for all 10 bots (Circle prize qualification)
     */
    function deployAllUSDCVaults() external onlyRole(DEFAULT_ADMIN_ROLE) returns (address[] memory vaults) {
        address usdcAddress = _getUSDCAddress();
        require(usdcAddress != address(0), "USDC not configured for this chain");
        
        vaults = new address[](10);
        
        for (uint8 i = 0; i < 10; i++) {
            vaults[i] = deployVault(usdcAddress, i);
        }
        
        emit AllVaultsDeployed(usdcAddress, 10);
        return vaults;
    }
    
    /**
     * @notice Deploy a single stablecoin vault for a specific bot
     */
    function deployVault(
        address stablecoin,
        uint8 botId
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address vault) {
        require(botId < 10, "Invalid bot ID");
        require(stablecoin != address(0), "Invalid stablecoin");
        require(stablecoinVaults[stablecoin][botId] == address(0), "Vault already exists");
        
        // Deploy new vault
        USDCBotVault newVault = new USDCBotVault(
            stablecoin,
            crapsGame,
            treasury,
            botId,
            botNames[botId]
        );
        
        vault = address(newVault);
        
        // Track deployment
        stablecoinVaults[stablecoin][botId] = vault;
        isVault[vault] = true;
        allVaults.push(vault);
        
        emit VaultDeployed(vault, stablecoin, botId, botNames[botId]);
        
        return vault;
    }
    
    /**
     * @notice Deploy vaults for a custom stablecoin
     */
    function deployCustomStablecoinVaults(
        address stablecoin,
        string memory stablecoinName
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address[] memory vaults) {
        require(stablecoin != address(0), "Invalid stablecoin");
        
        vaults = new address[](10);
        
        for (uint8 i = 0; i < 10; i++) {
            if (stablecoinVaults[stablecoin][i] == address(0)) {
                vaults[i] = deployVault(stablecoin, i);
            } else {
                vaults[i] = stablecoinVaults[stablecoin][i];
            }
        }
        
        emit AllVaultsDeployed(stablecoin, 10);
        return vaults;
    }
    
    /**
     * @notice Get the appropriate USDC address for current chain
     */
    function _getUSDCAddress() internal view returns (address) {
        if (currentChainId == 84532) { // Base Sepolia
            return baseSepolia.usdc;
        } else if (currentChainId == 421614) { // Arbitrum Sepolia
            return arbitrumSepolia.usdc;
        } else if (currentChainId == 31337) { // Hardhat local
            return baseSepolia.usdc; // Use Base Sepolia for testing
        }
        return address(0);
    }
    
    /**
     * @notice Get all vaults for a specific stablecoin
     */
    function getStablecoinVaults(address stablecoin) 
        external 
        view 
        returns (address[] memory vaults) 
    {
        vaults = new address[](10);
        for (uint8 i = 0; i < 10; i++) {
            vaults[i] = stablecoinVaults[stablecoin][i];
        }
        return vaults;
    }
    
    /**
     * @notice Get vault statistics for a bot across all stablecoins
     */
    function getBotVaultStats(uint8 botId) 
        external 
        view 
        returns (
            address usdcVault,
            address usdtVault,
            address daiVault,
            uint256 totalUSDCBalance,
            uint256 totalShares
        ) 
    {
        address usdcAddress = _getUSDCAddress();
        
        usdcVault = stablecoinVaults[usdcAddress][botId];
        usdtVault = stablecoinVaults[address(0)][botId]; // Placeholder
        daiVault = stablecoinVaults[address(0)][botId];  // Placeholder
        
        if (usdcVault != address(0)) {
            USDCBotVault vault = USDCBotVault(usdcVault);
            (,,, , totalUSDCBalance, totalShares) = vault.getBotStats();
        }
        
        return (usdcVault, usdtVault, daiVault, totalUSDCBalance, totalShares);
    }
    
    /**
     * @notice Update game contract for all vaults
     */
    function updateGameForAllVaults(address newGame) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newGame != address(0), "Invalid game");
        crapsGame = newGame;
        
        for (uint256 i = 0; i < allVaults.length; i++) {
            if (allVaults[i] != address(0)) {
                USDCBotVault(allVaults[i]).setGame(newGame);
            }
        }
    }
    
    /**
     * @notice Update treasury for all vaults
     */
    function updateTreasuryForAllVaults(address newTreasury) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
        
        for (uint256 i = 0; i < allVaults.length; i++) {
            if (allVaults[i] != address(0)) {
                USDCBotVault(allVaults[i]).setTreasury(newTreasury);
            }
        }
    }
    
    /**
     * @notice Check if an address is a valid vault
     */
    function isValidVault(address vault) external view returns (bool) {
        return isVault[vault];
    }
    
    /**
     * @notice Get total number of deployed vaults
     */
    function totalVaults() external view returns (uint256) {
        return allVaults.length;
    }
}