// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../rebate/HouseEdgeRebateV2.sol";

/**
 * @title TreasuryV3
 * @notice Treasury with net settlement and virtual debt management
 * @dev Tracks house edge as collections vs issuances with debt payoff
 */
contract TreasuryV3 is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    
    struct WeeklyPosition {
        uint256 tokensCollected;    // BOT collected from players
        uint256 tokensIssued;        // BOT issued to players
        int256 netPosition;          // Positive = profit, Negative = loss
        uint256 totalVolume;         // Total betting volume
        uint256 timestamp;
        bool settled;
    }
    
    struct BotPosition {
        uint256 startingBalance;     // Initial 2% allocation
        uint256 currentBalance;      // Current balance
        uint256 totalWon;           // Total BOT won from players
        uint256 totalLost;          // Total BOT lost to players
        int256 netPosition;         // Net profit/loss
        bool isDepleted;            // Whether bot has run out of funds
    }
    
    IERC20 public immutable botToken;
    HouseEdgeRebateV2 public houseEdgeRebate;
    address public stakingPool;
    
    // Position tracking
    mapping(uint256 => WeeklyPosition) public weeklyPositions;
    mapping(uint256 => BotPosition) public botPositions;
    
    uint256 public currentWeek;
    uint256 public constant WEEK_DURATION = 7 days;
    uint256 public deploymentTimestamp;
    
    // Global statistics
    uint256 public totalTokensCollected;
    uint256 public totalTokensIssued;
    int256 public globalNetPosition;
    uint256 public totalVolumeProcessed;
    
    // Fee configuration
    uint256 public swapFeePercent = 200;        // 2%
    uint256 public performanceFeePercent = 1000; // 10%
    
    // Events
    event TokensCollected(uint256 indexed botId, address indexed player, uint256 amount, uint256 volume);
    event TokensIssued(uint256 indexed botId, address indexed player, uint256 amount, uint256 volume);
    event WeeklySettlement(uint256 indexed week, int256 netPosition, uint256 volume);
    event BotPositionUpdated(uint256 indexed botId, int256 netPosition, bool isDepleted);
    event VirtualDebtRecorded(uint256 week, uint256 amount);
    event SwapFeesCollected(uint256 amount);
    event PerformanceFeesCollected(uint256 amount);
    
    // Errors
    error InvalidAddress();
    error InvalidBotId();
    error WeekNotEnded();
    error AlreadySettled();
    error InsufficientBotBalance();
    
    constructor(
        address _botToken,
        address _stakingPool
    ) {
        require(_botToken != address(0), "Invalid token");
        require(_stakingPool != address(0), "Invalid staking pool");
        
        botToken = IERC20(_botToken);
        stakingPool = _stakingPool;
        deploymentTimestamp = block.timestamp;
        currentWeek = 0;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        // Initialize first week
        weeklyPositions[0] = WeeklyPosition({
            tokensCollected: 0,
            tokensIssued: 0,
            netPosition: 0,
            totalVolume: 0,
            timestamp: block.timestamp,
            settled: false
        });
    }
    
    /**
     * @notice Sets the rebate contract
     */
    function setRebateContract(address _houseEdgeRebate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_houseEdgeRebate == address(0)) revert InvalidAddress();
        houseEdgeRebate = HouseEdgeRebateV2(_houseEdgeRebate);
    }
    
    /**
     * @notice Initializes bot positions with starting balances
     */
    function initializeBotPosition(uint256 botId, uint256 startingBalance) external onlyRole(OPERATOR_ROLE) {
        if (botId >= 10) revert InvalidBotId();
        
        botPositions[botId] = BotPosition({
            startingBalance: startingBalance,
            currentBalance: startingBalance,
            totalWon: 0,
            totalLost: 0,
            netPosition: 0,
            isDepleted: false
        });
    }
    
    /**
     * @notice Records tokens collected from a player (bot wins)
     * @param botId ID of the winning bot
     * @param player Address of the losing player
     * @param amount Amount of BOT collected
     * @param volume Total bet volume
     */
    function recordCollection(
        uint256 botId,
        address player,
        uint256 amount,
        uint256 volume
    ) external onlyRole(GAME_ROLE) {
        if (botId >= 10) revert InvalidBotId();
        
        uint256 week = getCurrentWeek();
        
        // Update weekly position
        weeklyPositions[week].tokensCollected += amount;
        weeklyPositions[week].totalVolume += volume;
        
        // Update bot position
        BotPosition storage bot = botPositions[botId];
        bot.totalWon += amount;
        bot.currentBalance += amount;
        bot.netPosition = int256(bot.totalWon) - int256(bot.totalLost);
        
        // Update global stats
        totalTokensCollected += amount;
        totalVolumeProcessed += volume;
        globalNetPosition = int256(totalTokensCollected) - int256(totalTokensIssued);
        
        // Record in rebate contract
        if (address(houseEdgeRebate) != address(0)) {
            houseEdgeRebate.recordCollection(player, amount, volume);
        }
        
        emit TokensCollected(botId, player, amount, volume);
        emit BotPositionUpdated(botId, bot.netPosition, bot.isDepleted);
    }
    
    /**
     * @notice Records tokens issued to a player (bot loses)
     * @param botId ID of the losing bot
     * @param player Address of the winning player  
     * @param amount Amount of BOT to issue
     * @param volume Total bet volume
     */
    function recordIssuance(
        uint256 botId,
        address player,
        uint256 amount,
        uint256 volume
    ) external onlyRole(GAME_ROLE) {
        if (botId >= 10) revert InvalidBotId();
        
        BotPosition storage bot = botPositions[botId];
        
        // Check if bot has sufficient balance
        if (bot.currentBalance < amount) {
            // Bot is depleted - record virtual debt
            uint256 shortfall = amount - bot.currentBalance;
            bot.currentBalance = 0;
            bot.isDepleted = true;
            
            // Record the full issuance even if bot can't cover it
            emit VirtualDebtRecorded(getCurrentWeek(), shortfall);
        } else {
            bot.currentBalance -= amount;
        }
        
        uint256 week = getCurrentWeek();
        
        // Update weekly position
        weeklyPositions[week].tokensIssued += amount;
        weeklyPositions[week].totalVolume += volume;
        
        // Update bot position
        bot.totalLost += amount;
        bot.netPosition = int256(bot.totalWon) - int256(bot.totalLost);
        
        if (bot.currentBalance == 0) {
            bot.isDepleted = true;
        }
        
        // Update global stats
        totalTokensIssued += amount;
        totalVolumeProcessed += volume;
        globalNetPosition = int256(totalTokensCollected) - int256(totalTokensIssued);
        
        // Record in rebate contract
        if (address(houseEdgeRebate) != address(0)) {
            houseEdgeRebate.recordIssuance(player, amount, volume);
        }
        
        emit TokensIssued(botId, player, amount, volume);
        emit BotPositionUpdated(botId, bot.netPosition, bot.isDepleted);
    }
    
    /**
     * @notice Settles the weekly position and triggers rebate calculation
     */
    function settleWeekly() external onlyRole(OPERATOR_ROLE) {
        uint256 week = getCurrentWeek();
        
        if (week == 0) revert InvalidAddress();
        
        uint256 previousWeek = week - 1;
        WeeklyPosition storage position = weeklyPositions[previousWeek];
        
        if (position.settled) revert AlreadySettled();
        if (block.timestamp < position.timestamp + WEEK_DURATION) revert WeekNotEnded();
        
        // Calculate net position
        position.netPosition = int256(position.tokensCollected) - int256(position.tokensIssued);
        position.settled = true;
        
        // Trigger rebate finalization
        if (address(houseEdgeRebate) != address(0)) {
            houseEdgeRebate.finalizeWeeklySettlement(previousWeek);
            
            // If we have a positive net position after debt, fund the rebate contract
            if (position.netPosition > 0) {
                (, , , int256 virtualDebt, , , ) = houseEdgeRebate.getHouseStats();
                
                if (virtualDebt == 0) {
                    // No debt, transfer full amount for rebates
                    uint256 rebateAmount = uint256(position.netPosition);
                    if (botToken.balanceOf(address(this)) >= rebateAmount) {
                        botToken.transfer(address(houseEdgeRebate), rebateAmount);
                    }
                }
            }
        }
        
        // Initialize next week
        advanceWeek();
        
        emit WeeklySettlement(previousWeek, position.netPosition, position.totalVolume);
    }
    
    /**
     * @notice Advances to the next week
     */
    function advanceWeek() public onlyRole(OPERATOR_ROLE) {
        uint256 nextWeek = currentWeek + 1;
        
        weeklyPositions[nextWeek] = WeeklyPosition({
            tokensCollected: 0,
            tokensIssued: 0,
            netPosition: 0,
            totalVolume: 0,
            timestamp: block.timestamp,
            settled: false
        });
        
        currentWeek = nextWeek;
        
        // Also advance rebate contract week
        if (address(houseEdgeRebate) != address(0)) {
            houseEdgeRebate.advanceWeek();
        }
    }
    
    /**
     * @notice Collects swap fees from Uniswap V4
     */
    function collectSwapFees(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        totalTokensCollected += amount;
        
        // Distribute to staking pool
        uint256 stakingReward = (amount * 50) / 100;
        if (stakingReward > 0 && stakingPool != address(0)) {
            botToken.transfer(stakingPool, stakingReward);
        }
        
        emit SwapFeesCollected(amount);
    }
    
    /**
     * @notice Collects performance fees from vaults
     */
    function collectPerformanceFees(uint256 amount) external onlyRole(VAULT_ROLE) {
        totalTokensCollected += amount;
        emit PerformanceFeesCollected(amount);
    }
    
    /**
     * @notice Gets current week number
     */
    function getCurrentWeek() public view returns (uint256) {
        return (block.timestamp - deploymentTimestamp) / WEEK_DURATION;
    }
    
    /**
     * @notice Gets bot statistics
     */
    function getBotStats(uint256 botId) external view returns (
        uint256 startingBalance,
        uint256 currentBalance,
        uint256 totalWon,
        uint256 totalLost,
        int256 netPosition,
        bool isDepleted
    ) {
        if (botId >= 10) revert InvalidBotId();
        BotPosition memory bot = botPositions[botId];
        
        return (
            bot.startingBalance,
            bot.currentBalance,
            bot.totalWon,
            bot.totalLost,
            bot.netPosition,
            bot.isDepleted
        );
    }
    
    /**
     * @notice Gets weekly position details
     */
    function getWeeklyPosition(uint256 week) external view returns (
        uint256 collected,
        uint256 issued,
        int256 netPosition,
        uint256 volume,
        bool settled
    ) {
        WeeklyPosition memory position = weeklyPositions[week];
        
        return (
            position.tokensCollected,
            position.tokensIssued,
            position.netPosition,
            position.totalVolume,
            position.settled
        );
    }
    
    /**
     * @notice Gets global treasury statistics
     */
    function getGlobalStats() external view returns (
        uint256 collected,
        uint256 issued,
        int256 netPosition,
        uint256 volume,
        uint256 currentWeekNum
    ) {
        return (
            totalTokensCollected,
            totalTokensIssued,
            globalNetPosition,
            totalVolumeProcessed,
            currentWeek
        );
    }
    
    /**
     * @notice Replenishes a depleted bot with tokens
     */
    function replenishBot(uint256 botId, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        if (botId >= 10) revert InvalidBotId();
        
        BotPosition storage bot = botPositions[botId];
        bot.currentBalance += amount;
        
        if (bot.currentBalance > 0) {
            bot.isDepleted = false;
        }
        
        emit BotPositionUpdated(botId, bot.netPosition, bot.isDepleted);
    }
    
    /**
     * @notice Emergency token recovery
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).transfer(msg.sender, amount);
    }
}