// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BotBettingEscrow
 * @notice Allows users to bet on bot performance in the casino
 * @dev Escrow contract for managing bets on AI bot gamblers
 */
contract BotBettingEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // Structs
    struct BotRound {
        uint256 startTime;
        uint256 endTime;
        uint256 totalPot;
        mapping(uint256 => uint256) botBets; // botId => total bets on bot
        mapping(address => mapping(uint256 => uint256)) userBets; // user => botId => amount
        uint256 winningBot;
        bool settled;
        uint256 roundNumber;
    }

    struct BotStats {
        uint256 totalWins;
        uint256 totalRounds;
        uint256 totalEarnings;
        uint256 currentStreak;
        bool isActive;
    }

    // State variables
    IERC20 public immutable botToken;
    uint256 public currentRound;
    uint256 public constant ROUND_DURATION = 1 hours;
    uint256 public constant FEE_PERCENTAGE = 500; // 5% house fee
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_BET = 10 * 10**18; // 10 BOT minimum
    uint256 public constant MAX_BET = 10000 * 10**18; // 10,000 BOT maximum
    
    mapping(uint256 => BotRound) public rounds;
    mapping(uint256 => BotStats) public botStats; // botId => stats
    mapping(address => uint256) public userTotalWinnings;
    mapping(address => uint256) public userTotalBets;
    
    uint256 public treasuryFees;
    address public treasury;
    
    // Events
    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime);
    event BetPlaced(uint256 indexed roundId, address indexed user, uint256 indexed botId, uint256 amount);
    event RoundSettled(uint256 indexed roundId, uint256 indexed winningBot, uint256 totalPot);
    event WinningsClaimed(address indexed user, uint256 amount);
    event BotPerformanceUpdated(uint256 indexed botId, uint256 wins, uint256 rounds);
    
    constructor(address _botToken, address _treasury) {
        require(_botToken != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        
        botToken = IERC20(_botToken);
        treasury = _treasury;
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);
        
        // Initialize 10 bots
        for (uint256 i = 0; i < 10; i++) {
            botStats[i].isActive = true;
        }
    }
    
    /**
     * @notice Start a new betting round
     */
    function startNewRound() external onlyRole(OPERATOR_ROLE) {
        require(currentRound == 0 || rounds[currentRound].settled, "Previous round not settled");
        
        currentRound++;
        BotRound storage round = rounds[currentRound];
        round.startTime = block.timestamp;
        round.endTime = block.timestamp + ROUND_DURATION;
        round.roundNumber = currentRound;
        
        emit RoundStarted(currentRound, round.startTime, round.endTime);
    }
    
    /**
     * @notice Place a bet on a bot
     * @param botId The ID of the bot to bet on (0-9)
     * @param amount The amount to bet
     */
    function placeBet(uint256 botId, uint256 amount) external nonReentrant whenNotPaused {
        require(botId < 10, "Invalid bot ID");
        require(botStats[botId].isActive, "Bot not active");
        require(amount >= MIN_BET && amount <= MAX_BET, "Invalid bet amount");
        
        BotRound storage round = rounds[currentRound];
        require(block.timestamp >= round.startTime && block.timestamp < round.endTime, "Round not active");
        require(!round.settled, "Round already settled");
        
        // Transfer tokens to escrow
        botToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update round data
        round.totalPot += amount;
        round.botBets[botId] += amount;
        round.userBets[msg.sender][botId] += amount;
        
        // Update user stats
        userTotalBets[msg.sender] += amount;
        
        emit BetPlaced(currentRound, msg.sender, botId, amount);
    }
    
    /**
     * @notice Get user's bet on a specific bot in current round
     */
    function getUserBet(address user, uint256 botId) external view returns (uint256) {
        return rounds[currentRound].userBets[user][botId];
    }
    
    /**
     * @notice Get total bets on a bot in current round
     */
    function getBotBets(uint256 botId) external view returns (uint256) {
        return rounds[currentRound].botBets[botId];
    }
    
    /**
     * @notice Settle a round with the winning bot
     * @param roundId The round to settle
     * @param winningBotId The bot that won
     */
    function settleRound(uint256 roundId, uint256 winningBotId) external onlyRole(ORACLE_ROLE) {
        require(winningBotId < 10, "Invalid bot ID");
        BotRound storage round = rounds[roundId];
        require(block.timestamp >= round.endTime, "Round not ended");
        require(!round.settled, "Already settled");
        
        round.winningBot = winningBotId;
        round.settled = true;
        
        // Calculate house fee
        uint256 fee = (round.totalPot * FEE_PERCENTAGE) / BASIS_POINTS;
        treasuryFees += fee;
        
        // Update bot stats
        botStats[winningBotId].totalWins++;
        botStats[winningBotId].currentStreak++;
        
        for (uint256 i = 0; i < 10; i++) {
            botStats[i].totalRounds++;
            if (i != winningBotId) {
                botStats[i].currentStreak = 0;
            }
        }
        
        emit RoundSettled(roundId, winningBotId, round.totalPot);
        emit BotPerformanceUpdated(winningBotId, botStats[winningBotId].totalWins, botStats[winningBotId].totalRounds);
    }
    
    /**
     * @notice Claim winnings from a settled round
     * @param roundId The round to claim from
     */
    function claimWinnings(uint256 roundId) external nonReentrant {
        BotRound storage round = rounds[roundId];
        require(round.settled, "Round not settled");
        
        uint256 userBetOnWinner = round.userBets[msg.sender][round.winningBot];
        require(userBetOnWinner > 0, "No winning bet");
        
        // Calculate winnings
        uint256 totalBetsOnWinner = round.botBets[round.winningBot];
        uint256 potAfterFee = round.totalPot - ((round.totalPot * FEE_PERCENTAGE) / BASIS_POINTS);
        uint256 winnings = (userBetOnWinner * potAfterFee) / totalBetsOnWinner;
        
        // Clear the bet to prevent double claiming
        round.userBets[msg.sender][round.winningBot] = 0;
        
        // Update user winnings
        userTotalWinnings[msg.sender] += winnings;
        
        // Transfer winnings
        botToken.safeTransfer(msg.sender, winnings);
        
        emit WinningsClaimed(msg.sender, winnings);
    }
    
    /**
     * @notice Get bot statistics
     */
    function getBotStats(uint256 botId) external view returns (
        uint256 wins,
        uint256 rounds,
        uint256 earnings,
        uint256 streak,
        bool active,
        uint256 winRate
    ) {
        BotStats memory stats = botStats[botId];
        wins = stats.totalWins;
        rounds = stats.totalRounds;
        earnings = stats.totalEarnings;
        streak = stats.currentStreak;
        active = stats.isActive;
        winRate = rounds > 0 ? (wins * 100) / rounds : 0;
    }
    
    /**
     * @notice Get current round info
     */
    function getCurrentRoundInfo() external view returns (
        uint256 roundId,
        uint256 startTime,
        uint256 endTime,
        uint256 totalPot,
        bool isActive
    ) {
        BotRound storage round = rounds[currentRound];
        roundId = currentRound;
        startTime = round.startTime;
        endTime = round.endTime;
        totalPot = round.totalPot;
        isActive = block.timestamp >= startTime && block.timestamp < endTime && !round.settled;
    }
    
    /**
     * @notice Withdraw treasury fees
     */
    function withdrawTreasuryFees() external onlyRole(OPERATOR_ROLE) {
        uint256 amount = treasuryFees;
        require(amount > 0, "No fees to withdraw");
        treasuryFees = 0;
        botToken.safeTransfer(treasury, amount);
    }
    
    /**
     * @notice Emergency pause
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Update bot active status
     */
    function setBotActive(uint256 botId, bool active) external onlyRole(OPERATOR_ROLE) {
        require(botId < 10, "Invalid bot ID");
        botStats[botId].isActive = active;
    }
}