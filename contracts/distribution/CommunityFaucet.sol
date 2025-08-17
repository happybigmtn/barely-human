// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CommunityFaucet
 * @notice Distributes 5% of BOT supply to community members during first month
 * @dev Rate-limited faucet with anti-sybil measures
 */
contract CommunityFaucet is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    struct ClaimRecord {
        uint256 totalClaimed;
        uint256 lastClaimTime;
        uint256 claimCount;
        bool isBlacklisted;
    }
    
    IERC20 public immutable botToken;
    
    // Faucet configuration
    uint256 public constant FAUCET_ALLOCATION = 50_000_000 * 10**18; // 5% of total supply
    uint256 public constant DISTRIBUTION_DURATION = 30 days; // 1 month
    uint256 public constant CLAIM_AMOUNT = 1000 * 10**18; // 1000 BOT per claim
    uint256 public constant CLAIM_COOLDOWN = 24 hours; // Once per day
    uint256 public constant MAX_CLAIMS_PER_ADDRESS = 10; // Max 10 claims per address
    
    // Distribution tracking
    uint256 public deploymentTime;
    uint256 public totalDistributed;
    uint256 public uniqueClaimants;
    
    // Daily limits
    uint256 public dailyLimit = 500_000 * 10**18; // 500k BOT per day
    uint256 public currentDay;
    uint256 public dailyDistributed;
    
    // User tracking
    mapping(address => ClaimRecord) public claimRecords;
    mapping(bytes32 => bool) public usedProofs; // For merkle proof claims
    
    // Anti-sybil measures
    mapping(address => bool) public verifiedAddresses;
    uint256 public minAccountAge = 30 days; // Account must be 30 days old
    uint256 public minBalance = 0.01 ether; // Must have minimum ETH balance
    
    // Events
    event TokensClaimed(address indexed claimant, uint256 amount, uint256 claimNumber);
    event AddressVerified(address indexed account);
    event AddressBlacklisted(address indexed account);
    event DailyLimitUpdated(uint256 newLimit);
    event FaucetRefilled(uint256 amount);
    event DistributionEnded(uint256 totalDistributed, uint256 uniqueClaimants);
    
    // Errors
    error DistributionHasEndedError();
    error ClaimCooldownActive();
    error MaxClaimsReached();
    error DailyLimitReached();
    error InsufficientFaucetBalance();
    error AccountBlacklisted();
    error AccountNotVerified();
    error AccountTooNew();
    error InsufficientAccountBalance();
    
    constructor(address _botToken) {
        require(_botToken != address(0), "Invalid token");
        
        botToken = IERC20(_botToken);
        deploymentTime = block.timestamp;
        currentDay = 0;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Claims tokens from the faucet
     */
    function claim() external nonReentrant {
        // Check if distribution period has ended
        if (block.timestamp > deploymentTime + DISTRIBUTION_DURATION) {
            revert DistributionHasEndedError();
        }
        
        ClaimRecord storage record = claimRecords[msg.sender];
        
        // Check blacklist
        if (record.isBlacklisted) revert AccountBlacklisted();
        
        // Check verification (can be bypassed for verified addresses)
        if (!verifiedAddresses[msg.sender]) {
            _validateAccount(msg.sender);
        }
        
        // Check cooldown
        if (record.lastClaimTime + CLAIM_COOLDOWN > block.timestamp) {
            revert ClaimCooldownActive();
        }
        
        // Check max claims
        if (record.claimCount >= MAX_CLAIMS_PER_ADDRESS) {
            revert MaxClaimsReached();
        }
        
        // Update daily tracking
        uint256 daysSinceStart = (block.timestamp - deploymentTime) / 1 days;
        if (daysSinceStart > currentDay) {
            currentDay = daysSinceStart;
            dailyDistributed = 0;
        }
        
        // Check daily limit
        if (dailyDistributed + CLAIM_AMOUNT > dailyLimit) {
            revert DailyLimitReached();
        }
        
        // Check faucet balance
        uint256 faucetBalance = botToken.balanceOf(address(this));
        if (faucetBalance < CLAIM_AMOUNT) {
            revert InsufficientFaucetBalance();
        }
        
        // Check total distribution limit
        if (totalDistributed + CLAIM_AMOUNT > FAUCET_ALLOCATION) {
            revert InsufficientFaucetBalance();
        }
        
        // Update claim record
        if (record.claimCount == 0) {
            uniqueClaimants++;
        }
        
        record.totalClaimed += CLAIM_AMOUNT;
        record.lastClaimTime = block.timestamp;
        record.claimCount++;
        
        // Update global tracking
        totalDistributed += CLAIM_AMOUNT;
        dailyDistributed += CLAIM_AMOUNT;
        
        // Transfer tokens
        require(botToken.transfer(msg.sender, CLAIM_AMOUNT), "Transfer failed");
        
        emit TokensClaimed(msg.sender, CLAIM_AMOUNT, record.claimCount);
    }
    
    /**
     * @notice Validates an account for anti-sybil measures
     */
    function _validateAccount(address account) private view {
        // Check account age (simplified - would need oracle in production)
        // For hackathon, we'll check if account has some transaction history
        if (account.balance < minBalance) {
            revert InsufficientAccountBalance();
        }
        
        // Additional checks could include:
        // - ENS ownership
        // - NFT ownership
        // - Previous DeFi activity
        // - Social verification
    }
    
    /**
     * @notice Verifies addresses for claiming (batch)
     * @param addresses Array of addresses to verify
     */
    function verifyAddresses(address[] calldata addresses) external onlyRole(OPERATOR_ROLE) {
        for (uint256 i = 0; i < addresses.length; i++) {
            verifiedAddresses[addresses[i]] = true;
            emit AddressVerified(addresses[i]);
        }
    }
    
    /**
     * @notice Blacklists addresses from claiming
     * @param addresses Array of addresses to blacklist
     */
    function blacklistAddresses(address[] calldata addresses) external onlyRole(OPERATOR_ROLE) {
        for (uint256 i = 0; i < addresses.length; i++) {
            claimRecords[addresses[i]].isBlacklisted = true;
            emit AddressBlacklisted(addresses[i]);
        }
    }
    
    /**
     * @notice Updates daily distribution limit
     * @param newLimit New daily limit in tokens
     */
    function updateDailyLimit(uint256 newLimit) external onlyRole(OPERATOR_ROLE) {
        dailyLimit = newLimit;
        emit DailyLimitUpdated(newLimit);
    }
    
    /**
     * @notice Updates anti-sybil parameters
     * @param _minBalance Minimum ETH balance required
     * @param _minAge Minimum account age required
     */
    function updateAntiSybilParams(
        uint256 _minBalance,
        uint256 _minAge
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minBalance = _minBalance;
        minAccountAge = _minAge;
    }
    
    /**
     * @notice Gets claim information for an address
     * @param account Address to check
     * @return canClaim Whether the address can claim now
     * @return timeUntilNextClaim Seconds until next claim
     * @return claimsRemaining Number of claims remaining
     * @return totalClaimed Total amount claimed
     */
    function getClaimInfo(address account) external view returns (
        bool canClaim,
        uint256 timeUntilNextClaim,
        uint256 claimsRemaining,
        uint256 totalClaimed
    ) {
        ClaimRecord memory record = claimRecords[account];
        
        // Check if can claim
        canClaim = !record.isBlacklisted &&
                  record.claimCount < MAX_CLAIMS_PER_ADDRESS &&
                  record.lastClaimTime + CLAIM_COOLDOWN <= block.timestamp &&
                  block.timestamp <= deploymentTime + DISTRIBUTION_DURATION &&
                  dailyDistributed + CLAIM_AMOUNT <= dailyLimit;
        
        // Calculate time until next claim
        if (record.lastClaimTime + CLAIM_COOLDOWN > block.timestamp) {
            timeUntilNextClaim = (record.lastClaimTime + CLAIM_COOLDOWN) - block.timestamp;
        } else {
            timeUntilNextClaim = 0;
        }
        
        // Calculate claims remaining
        claimsRemaining = MAX_CLAIMS_PER_ADDRESS - record.claimCount;
        
        totalClaimed = record.totalClaimed;
    }
    
    /**
     * @notice Gets faucet statistics
     */
    function getFaucetStats() external view returns (
        uint256 totalSupply,
        uint256 distributed,
        uint256 remaining,
        uint256 daysRemaining,
        uint256 claimants,
        uint256 todayDistributed
    ) {
        totalSupply = FAUCET_ALLOCATION;
        distributed = totalDistributed;
        remaining = FAUCET_ALLOCATION - totalDistributed;
        
        uint256 endTime = deploymentTime + DISTRIBUTION_DURATION;
        if (block.timestamp < endTime) {
            daysRemaining = (endTime - block.timestamp) / 1 days;
        } else {
            daysRemaining = 0;
        }
        
        claimants = uniqueClaimants;
        todayDistributed = dailyDistributed;
    }
    
    /**
     * @notice Ends distribution and returns unused tokens
     */
    function endDistribution() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(block.timestamp > deploymentTime + DISTRIBUTION_DURATION, "Not ended");
        
        uint256 remaining = botToken.balanceOf(address(this));
        if (remaining > 0) {
            require(botToken.transfer(msg.sender, remaining), "Transfer failed");
        }
        
        emit DistributionEnded(totalDistributed, uniqueClaimants);
    }
    
    /**
     * @notice Emergency token recovery
     */
    function emergencyRecover(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(botToken) || block.timestamp > deploymentTime + DISTRIBUTION_DURATION, "Cannot recover during distribution");
        IERC20(token).transfer(msg.sender, amount);
    }
}