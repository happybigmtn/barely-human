// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VolumeTracker
 * @notice Tracks betting volumes for LPs across all bots and games
 * @dev Integrates with CrapsGame and HouseEdgeRebate for volume-based rebates
 */
contract VolumeTracker is AccessControl {
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    
    struct VolumeData {
        uint256 totalVolume;
        uint256 weeklyVolume;
        uint256 lastUpdateWeek;
        uint256 totalBets;
        uint256 totalWins;
        uint256 totalLosses;
    }
    
    struct BotVolumeData {
        uint256 totalVolume;
        uint256 totalHouseEdgePaid;
        uint256 gamesPlayed;
        uint256 currentBankroll;
    }
    
    // LP address => VolumeData
    mapping(address => VolumeData) public lpVolumes;
    
    // Bot ID => BotVolumeData
    mapping(uint256 => BotVolumeData) public botVolumes;
    
    // LP => Bot ID => Volume
    mapping(address => mapping(uint256 => uint256)) public lpBotVolumes;
    
    // Week => LP => Volume
    mapping(uint256 => mapping(address => uint256)) public weeklyLPVolumes;
    
    // Week => Total Volume
    mapping(uint256 => uint256) public weeklyTotalVolumes;
    
    // Global statistics
    uint256 public globalTotalVolume;
    uint256 public globalTotalBets;
    uint256 public globalHouseEdgeCollected;
    
    uint256 public deploymentTimestamp;
    uint256 public constant WEEK_DURATION = 7 days;
    
    event VolumeRecorded(
        address indexed lp,
        uint256 indexed botId,
        uint256 amount,
        uint256 week,
        bool isWin
    );
    
    event BotVolumeUpdated(
        uint256 indexed botId,
        uint256 newVolume,
        uint256 houseEdge
    );
    
    event WeeklyVolumeReset(uint256 week);
    
    error InvalidAmount();
    error InvalidBotId();
    
    constructor() {
        deploymentTimestamp = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Records a bet volume for an LP
     * @param lp Address of the liquidity provider
     * @param botId ID of the bot
     * @param amount Bet amount
     * @param isWin Whether the bet was a win
     * @param houseEdge House edge amount (if loss)
     */
    function recordBetVolume(
        address lp,
        uint256 botId,
        uint256 amount,
        bool isWin,
        uint256 houseEdge
    ) external onlyRole(GAME_ROLE) {
        if (amount == 0) revert InvalidAmount();
        if (botId >= 10) revert InvalidBotId();
        
        uint256 currentWeek = getCurrentWeek();
        
        // Update LP volume data
        VolumeData storage lpData = lpVolumes[lp];
        lpData.totalVolume += amount;
        lpData.totalBets++;
        
        if (lpData.lastUpdateWeek != currentWeek) {
            lpData.weeklyVolume = 0;
            lpData.lastUpdateWeek = currentWeek;
        }
        lpData.weeklyVolume += amount;
        
        if (isWin) {
            lpData.totalWins++;
        } else {
            lpData.totalLosses++;
        }
        
        // Update LP-Bot specific volume
        lpBotVolumes[lp][botId] += amount;
        
        // Update weekly LP volume
        weeklyLPVolumes[currentWeek][lp] += amount;
        
        // Update bot volume data
        BotVolumeData storage botData = botVolumes[botId];
        botData.totalVolume += amount;
        botData.gamesPlayed++;
        
        if (!isWin && houseEdge > 0) {
            botData.totalHouseEdgePaid += houseEdge;
            globalHouseEdgeCollected += houseEdge;
        }
        
        // Update weekly total volume
        weeklyTotalVolumes[currentWeek] += amount;
        
        // Update global statistics
        globalTotalVolume += amount;
        globalTotalBets++;
        
        emit VolumeRecorded(lp, botId, amount, currentWeek, isWin);
        
        if (houseEdge > 0) {
            emit BotVolumeUpdated(botId, botData.totalVolume, houseEdge);
        }
    }
    
    /**
     * @notice Updates bot bankroll information
     * @param botId ID of the bot
     * @param newBankroll Current bankroll amount
     */
    function updateBotBankroll(uint256 botId, uint256 newBankroll) external onlyRole(VAULT_ROLE) {
        if (botId >= 10) revert InvalidBotId();
        
        botVolumes[botId].currentBankroll = newBankroll;
    }
    
    /**
     * @notice Gets current week number
     */
    function getCurrentWeek() public view returns (uint256) {
        return (block.timestamp - deploymentTimestamp) / WEEK_DURATION;
    }
    
    /**
     * @notice Gets LP statistics
     * @param lp Address of the LP
     * @return totalVolume Total betting volume
     * @return weeklyVolume Current week volume
     * @return winRate Win percentage (scaled by 100)
     * @return totalBets Number of bets placed
     */
    function getLPStats(address lp) external view returns (
        uint256 totalVolume,
        uint256 weeklyVolume,
        uint256 winRate,
        uint256 totalBets
    ) {
        VolumeData memory data = lpVolumes[lp];
        
        uint256 currentWeek = getCurrentWeek();
        weeklyVolume = (data.lastUpdateWeek == currentWeek) ? data.weeklyVolume : 0;
        
        winRate = 0;
        if (data.totalBets > 0) {
            winRate = (data.totalWins * 100) / data.totalBets;
        }
        
        return (data.totalVolume, weeklyVolume, winRate, data.totalBets);
    }
    
    /**
     * @notice Gets bot statistics
     * @param botId ID of the bot
     * @return totalVolume Total betting volume through this bot
     * @return houseEdgePaid Total house edge paid by this bot
     * @return gamesPlayed Number of games played
     * @return currentBankroll Current bankroll size
     * @return profitability Bot's profitability (negative means losing)
     */
    function getBotStats(uint256 botId) external view returns (
        uint256 totalVolume,
        uint256 houseEdgePaid,
        uint256 gamesPlayed,
        uint256 currentBankroll,
        int256 profitability
    ) {
        if (botId >= 10) revert InvalidBotId();
        
        BotVolumeData memory data = botVolumes[botId];
        
        // Calculate profitability (negative if bot is losing money to LPs)
        profitability = int256(data.currentBankroll) - int256(20_000_000 * 10**18); // Initial 2% allocation
        
        return (
            data.totalVolume,
            data.totalHouseEdgePaid,
            data.gamesPlayed,
            data.currentBankroll,
            profitability
        );
    }
    
    /**
     * @notice Gets weekly statistics
     * @param week Week number
     * @return totalVolume Total volume for the week
     * @return topLP Address of top LP by volume
     * @return topLPVolume Volume of the top LP
     */
    function getWeeklyStats(uint256 week) external view returns (
        uint256 totalVolume,
        address topLP,
        uint256 topLPVolume
    ) {
        totalVolume = weeklyTotalVolumes[week];
        
        // Note: Finding top LP requires off-chain processing or maintaining sorted list
        // This is a simplified version
        return (totalVolume, address(0), 0);
    }
    
    /**
     * @notice Gets LP volume for a specific bot
     * @param lp Address of the LP
     * @param botId ID of the bot
     * @return volume Total volume LP has bet on this bot
     */
    function getLPBotVolume(address lp, uint256 botId) external view returns (uint256) {
        if (botId >= 10) revert InvalidBotId();
        return lpBotVolumes[lp][botId];
    }
    
    /**
     * @notice Gets global platform statistics
     */
    function getGlobalStats() external view returns (
        uint256 totalVolume,
        uint256 totalBets,
        uint256 houseEdgeCollected,
        uint256 currentWeek,
        uint256 averageVolumePerWeek
    ) {
        currentWeek = getCurrentWeek();
        
        averageVolumePerWeek = 0;
        if (currentWeek > 0) {
            averageVolumePerWeek = globalTotalVolume / currentWeek;
        }
        
        return (
            globalTotalVolume,
            globalTotalBets,
            globalHouseEdgeCollected,
            currentWeek,
            averageVolumePerWeek
        );
    }
}