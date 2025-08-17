// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../rebate/HouseEdgeRebate.sol";
import "../rebate/VolumeTracker.sol";

/**
 * @title TreasuryV2
 * @notice Enhanced treasury that manages house edge accumulation and weekly LP rebates
 * @dev Integrates with HouseEdgeRebate to create net-zero house edge steady state
 */
contract TreasuryV2 is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    
    struct FeeConfig {
        uint256 swapFeePercent;        // Uniswap V4 hook fee (2%)
        uint256 performanceFeePercent;  // Vault performance fee
        uint256 houseEdgePercent;       // Casino house edge
        uint256 rebatePercent;          // Percentage of house edge to rebate (100% eventually)
    }
    
    struct TreasuryStats {
        uint256 totalSwapFeesCollected;
        uint256 totalPerformanceFeesCollected;
        uint256 totalHouseEdgeCollected;
        uint256 totalRebatesDistributed;
        uint256 totalStakingRewardsDistributed;
        uint256 currentBalance;
    }
    
    IERC20 public immutable botToken;
    HouseEdgeRebate public houseEdgeRebate;
    VolumeTracker public volumeTracker;
    address public stakingPool;
    
    FeeConfig public feeConfig;
    TreasuryStats public stats;
    
    // Bot bankroll tracking
    mapping(uint256 => uint256) public botBankrolls;
    mapping(uint256 => uint256) public botHouseEdgePaid;
    mapping(uint256 => bool) public botFullyDepleted;
    
    // Weekly rebate tracking
    uint256 public currentRebateWeek;
    uint256 public lastRebateDistribution;
    uint256 public constant WEEK_DURATION = 7 days;
    
    // Progressive rebate schedule (starts at 50%, increases to 100% over time)
    uint256 public rebateStartPercent = 50; // Start with 50% rebate
    uint256 public rebateIncrementPerWeek = 5; // Increase by 5% per week
    uint256 public rebateMaxPercent = 100; // Eventually 100% rebate
    
    event SwapFeesCollected(uint256 amount);
    event PerformanceFeesCollected(uint256 botId, uint256 amount);
    event HouseEdgeCollected(uint256 botId, uint256 amount);
    event RebatesDistributed(uint256 week, uint256 totalAmount);
    event StakingRewardsDistributed(uint256 amount);
    event BotBankrollUpdated(uint256 botId, uint256 newBankroll);
    event BotDepleted(uint256 botId);
    event EmergencyWithdraw(address token, uint256 amount);
    
    error InvalidAddress();
    error InvalidPercent();
    error WeekNotEnded();
    error InsufficientBalance();
    
    constructor(
        address _botToken,
        address _stakingPool
    ) {
        require(_botToken != address(0), "Invalid token");
        require(_stakingPool != address(0), "Invalid staking pool");
        
        botToken = IERC20(_botToken);
        stakingPool = _stakingPool;
        
        // Initialize fee configuration
        feeConfig = FeeConfig({
            swapFeePercent: 200,       // 2%
            performanceFeePercent: 1000, // 10%
            houseEdgePercent: 250,      // 2.5% house edge
            rebatePercent: rebateStartPercent * 100 // Start at 50%
        });
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Sets the rebate contracts
     */
    function setRebateContracts(
        address _houseEdgeRebate,
        address _volumeTracker
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_houseEdgeRebate == address(0) || _volumeTracker == address(0)) {
            revert InvalidAddress();
        }
        
        houseEdgeRebate = HouseEdgeRebate(_houseEdgeRebate);
        volumeTracker = VolumeTracker(_volumeTracker);
    }
    
    /**
     * @notice Collects swap fees from Uniswap V4 hook
     */
    function collectSwapFees(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        stats.totalSwapFeesCollected += amount;
        stats.currentBalance += amount;
        
        // Distribute portion to staking rewards
        uint256 stakingReward = (amount * 50) / 100; // 50% to stakers
        if (stakingReward > 0) {
            _distributeStakingRewards(stakingReward);
        }
        
        emit SwapFeesCollected(amount);
    }
    
    /**
     * @notice Collects performance fees from vault profits
     */
    function collectPerformanceFees(uint256 botId, uint256 amount) external onlyRole(VAULT_ROLE) {
        stats.totalPerformanceFeesCollected += amount;
        stats.currentBalance += amount;
        
        emit PerformanceFeesCollected(botId, amount);
    }
    
    /**
     * @notice Collects house edge from bot losses
     * @param botId ID of the bot
     * @param amount House edge amount
     * @param volume Total bet volume
     */
    function collectHouseEdge(
        uint256 botId,
        uint256 amount,
        uint256 volume,
        address lp
    ) external onlyRole(GAME_ROLE) {
        stats.totalHouseEdgeCollected += amount;
        botHouseEdgePaid[botId] += amount;
        
        // Track in rebate contract
        if (address(houseEdgeRebate) != address(0)) {
            houseEdgeRebate.accumulateHouseEdge(botId, amount);
        }
        
        // Track volume
        if (address(volumeTracker) != address(0)) {
            volumeTracker.recordBetVolume(lp, botId, volume, false, amount);
        }
        
        // Check if bot is depleted
        if (botBankrolls[botId] <= amount) {
            botFullyDepleted[botId] = true;
            emit BotDepleted(botId);
        }
        
        emit HouseEdgeCollected(botId, amount);
    }
    
    /**
     * @notice Distributes weekly rebates to LPs
     */
    function distributeWeeklyRebates() external onlyRole(OPERATOR_ROLE) nonReentrant {
        uint256 currentWeek = getCurrentWeek();
        
        if (currentWeek == currentRebateWeek) revert WeekNotEnded();
        
        // Calculate current rebate percentage (increases over time)
        uint256 weeksElapsed = currentWeek - 0; // Since deployment
        uint256 currentRebatePercent = rebateStartPercent + (weeksElapsed * rebateIncrementPerWeek);
        if (currentRebatePercent > rebateMaxPercent) {
            currentRebatePercent = rebateMaxPercent;
        }
        
        // Get total house edge for the week
        (, , , , uint256 weeklyHouseEdge) = houseEdgeRebate.getWeeklyRebateInfo(currentRebateWeek);
        
        // Calculate rebate amount
        uint256 rebateAmount = (weeklyHouseEdge * currentRebatePercent) / 100;
        
        if (rebateAmount > stats.currentBalance) {
            rebateAmount = stats.currentBalance;
        }
        
        if (rebateAmount > 0) {
            // Transfer rebate amount to HouseEdgeRebate contract
            require(botToken.transfer(address(houseEdgeRebate), rebateAmount), "Transfer failed");
            
            stats.currentBalance -= rebateAmount;
            stats.totalRebatesDistributed += rebateAmount;
            
            // Finalize the week in rebate contract
            houseEdgeRebate.finalizeWeek(currentRebateWeek);
            
            emit RebatesDistributed(currentRebateWeek, rebateAmount);
        }
        
        // Advance to next week
        houseEdgeRebate.advanceWeek();
        currentRebateWeek = currentWeek;
        lastRebateDistribution = block.timestamp;
    }
    
    /**
     * @notice Updates bot bankroll information
     */
    function updateBotBankroll(uint256 botId, uint256 newBankroll) external onlyRole(VAULT_ROLE) {
        botBankrolls[botId] = newBankroll;
        
        // Update in volume tracker
        if (address(volumeTracker) != address(0)) {
            volumeTracker.updateBotBankroll(botId, newBankroll);
        }
        
        // Check if bot has recovered from depletion
        if (botFullyDepleted[botId] && newBankroll > 0) {
            botFullyDepleted[botId] = false;
        }
        
        emit BotBankrollUpdated(botId, newBankroll);
    }
    
    /**
     * @notice Distributes rewards to staking pool
     */
    function _distributeStakingRewards(uint256 amount) private {
        if (amount == 0 || stakingPool == address(0)) return;
        
        require(botToken.transfer(stakingPool, amount), "Transfer failed");
        
        stats.currentBalance -= amount;
        stats.totalStakingRewardsDistributed += amount;
        
        emit StakingRewardsDistributed(amount);
    }
    
    /**
     * @notice Gets current week number
     */
    function getCurrentWeek() public view returns (uint256) {
        return block.timestamp / WEEK_DURATION;
    }
    
    /**
     * @notice Gets current rebate percentage
     */
    function getCurrentRebatePercent() public view returns (uint256) {
        uint256 weeksElapsed = getCurrentWeek();
        uint256 percent = rebateStartPercent + (weeksElapsed * rebateIncrementPerWeek);
        
        return percent > rebateMaxPercent ? rebateMaxPercent : percent;
    }
    
    /**
     * @notice Gets treasury statistics
     */
    function getTreasuryStats() external view returns (
        uint256 swapFees,
        uint256 performanceFees,
        uint256 houseEdge,
        uint256 rebates,
        uint256 stakingRewards,
        uint256 balance,
        uint256 currentRebatePercent
    ) {
        return (
            stats.totalSwapFeesCollected,
            stats.totalPerformanceFeesCollected,
            stats.totalHouseEdgeCollected,
            stats.totalRebatesDistributed,
            stats.totalStakingRewardsDistributed,
            stats.currentBalance,
            getCurrentRebatePercent()
        );
    }
    
    /**
     * @notice Gets bot depletion status
     */
    function getBotStatus(uint256 botId) external view returns (
        uint256 bankroll,
        uint256 houseEdgePaid,
        bool isDepleted
    ) {
        return (
            botBankrolls[botId],
            botHouseEdgePaid[botId],
            botFullyDepleted[botId]
        );
    }
    
    /**
     * @notice Updates fee configuration
     */
    function updateFeeConfig(
        uint256 _swapFee,
        uint256 _performanceFee,
        uint256 _houseEdge
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_swapFee > 1000 || _performanceFee > 5000 || _houseEdge > 1000) {
            revert InvalidPercent();
        }
        
        feeConfig.swapFeePercent = _swapFee;
        feeConfig.performanceFeePercent = _performanceFee;
        feeConfig.houseEdgePercent = _houseEdge;
    }
    
    /**
     * @notice Emergency withdrawal
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).transfer(msg.sender, amount);
        emit EmergencyWithdraw(token, amount);
    }
}