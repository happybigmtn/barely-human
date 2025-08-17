// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BOTTokenV2
 * @notice BOT token with proper distribution allocations for the Barely Human ecosystem
 * @dev Fixed supply with specific allocations for bots, liquidity, rewards, and team
 */
contract BOTTokenV2 is ERC20, AccessControl {
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion BOT
    
    // Distribution allocations
    uint256 public constant BOT_ALLOCATION = 200_000_000 * 10**18;       // 20% (2% per bot x 10 bots)
    uint256 public constant LIQUIDITY_ALLOCATION = 150_000_000 * 10**18; // 15% for Uniswap V4 pools
    uint256 public constant AIRDROP_ALLOCATION = 100_000_000 * 10**18;   // 10% testnet leaderboard rewards
    uint256 public constant FAUCET_ALLOCATION = 50_000_000 * 10**18;     // 5% community faucet (1 month)
    uint256 public constant ARTIST_ALLOCATION = 500_000_000 * 10**18;    // 50% artist retention
    
    // Further breakdown of artist allocation
    uint256 public constant ARTIST_GIVEAWAY = 333_333_333 * 10**18;      // 2/3 of artist portion (33.33% total)
    uint256 public constant ARTIST_RETAINED = 166_666_667 * 10**18;      // 1/3 of artist portion (16.67% total)
    
    // Individual bot allocations (2% each)
    uint256 public constant BOT_INDIVIDUAL_ALLOCATION = 20_000_000 * 10**18;
    
    // Distribution tracking
    mapping(uint256 => address) public botWallets;
    mapping(uint256 => uint256) public botBalances;
    mapping(address => bool) public isLiquidityPool;
    
    address public liquidityManager;
    address public airdropDistributor;
    address public communityFaucet;
    address public artistWallet;
    address public artistGiveawayWallet;
    
    bool public distributionComplete;
    
    event BotWalletSet(uint256 indexed botId, address wallet);
    event LiquidityPoolRegistered(address indexed pool);
    event InitialDistributionComplete();
    event BotTokensTransferred(uint256 indexed botId, address to, uint256 amount);
    
    error DistributionAlreadyComplete();
    error InvalidBotId();
    error InvalidAddress();
    error UnauthorizedTransfer();
    
    constructor(
        address _liquidityManager,
        address _airdropDistributor,
        address _communityFaucet,
        address _artistWallet,
        address _artistGiveawayWallet
    ) ERC20("Barely Human Bot Token", "BOT") {
        require(_liquidityManager != address(0), "Invalid liquidity manager");
        require(_airdropDistributor != address(0), "Invalid airdrop distributor");
        require(_communityFaucet != address(0), "Invalid faucet");
        require(_artistWallet != address(0), "Invalid artist wallet");
        require(_artistGiveawayWallet != address(0), "Invalid giveaway wallet");
        
        liquidityManager = _liquidityManager;
        airdropDistributor = _airdropDistributor;
        communityFaucet = _communityFaucet;
        artistWallet = _artistWallet;
        artistGiveawayWallet = _artistGiveawayWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        
        // Mint total supply to contract for distribution
        _mint(address(this), TOTAL_SUPPLY);
    }
    
    /**
     * @notice Sets the wallet address for a specific bot
     * @param botId ID of the bot (0-9)
     * @param wallet Address of the bot's wallet
     */
    function setBotWallet(uint256 botId, address wallet) external onlyRole(DISTRIBUTOR_ROLE) {
        if (botId >= 10) revert InvalidBotId();
        if (wallet == address(0)) revert InvalidAddress();
        
        botWallets[botId] = wallet;
        emit BotWalletSet(botId, wallet);
    }
    
    /**
     * @notice Executes initial token distribution
     * @dev Can only be called once after all bot wallets are set
     */
    function executeInitialDistribution() external onlyRole(DISTRIBUTOR_ROLE) {
        if (distributionComplete) revert DistributionAlreadyComplete();
        
        // Verify all bot wallets are set
        for (uint256 i = 0; i < 10; i++) {
            require(botWallets[i] != address(0), "Bot wallet not set");
        }
        
        // Distribute to bots (2% each)
        for (uint256 i = 0; i < 10; i++) {
            _transfer(address(this), botWallets[i], BOT_INDIVIDUAL_ALLOCATION);
            botBalances[i] = BOT_INDIVIDUAL_ALLOCATION;
        }
        
        // Distribute to liquidity manager (15%)
        _transfer(address(this), liquidityManager, LIQUIDITY_ALLOCATION);
        
        // Distribute to airdrop distributor (10%)
        _transfer(address(this), airdropDistributor, AIRDROP_ALLOCATION);
        
        // Distribute to community faucet (5%)
        _transfer(address(this), communityFaucet, FAUCET_ALLOCATION);
        
        // Distribute artist allocation
        _transfer(address(this), artistWallet, ARTIST_RETAINED);
        _transfer(address(this), artistGiveawayWallet, ARTIST_GIVEAWAY);
        
        distributionComplete = true;
        emit InitialDistributionComplete();
    }
    
    /**
     * @notice Registers a Uniswap V4 pool for liquidity provision
     * @param pool Address of the liquidity pool
     */
    function registerLiquidityPool(address pool) external onlyRole(DISTRIBUTOR_ROLE) {
        if (pool == address(0)) revert InvalidAddress();
        
        isLiquidityPool[pool] = true;
        emit LiquidityPoolRegistered(pool);
    }
    
    /**
     * @notice Gets the remaining balance for a specific bot
     * @param botId ID of the bot
     * @return balance Current balance of the bot
     */
    function getBotBalance(uint256 botId) external view returns (uint256) {
        if (botId >= 10) revert InvalidBotId();
        
        address wallet = botWallets[botId];
        if (wallet == address(0)) return 0;
        
        return balanceOf(wallet);
    }
    
    /**
     * @notice Checks if distribution is properly configured
     * @return ready True if all wallets are set and ready for distribution
     */
    function isDistributionReady() external view returns (bool ready) {
        for (uint256 i = 0; i < 10; i++) {
            if (botWallets[i] == address(0)) return false;
        }
        return true;
    }
    
    /**
     * @notice Gets distribution statistics
     * @return stats Array of distribution amounts for each category
     */
    function getDistributionStats() external pure returns (uint256[6] memory stats) {
        stats[0] = BOT_ALLOCATION;
        stats[1] = LIQUIDITY_ALLOCATION;
        stats[2] = AIRDROP_ALLOCATION;
        stats[3] = FAUCET_ALLOCATION;
        stats[4] = ARTIST_RETAINED;
        stats[5] = ARTIST_GIVEAWAY;
    }
    
    /**
     * @notice Emergency function to recover stuck tokens
     * @param token Address of the token to recover
     * @param amount Amount to recover
     */
    function emergencyRecover(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(this)) {
            require(!distributionComplete, "Distribution complete");
        }
        IERC20(token).transfer(msg.sender, amount);
    }
}