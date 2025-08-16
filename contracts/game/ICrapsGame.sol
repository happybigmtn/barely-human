// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title ICrapsGame
 * @notice Interface for the main Craps game contract
 * @dev Defines the core game mechanics and state management
 */
interface ICrapsGame {
    // Game phases
    enum Phase {
        IDLE,       // No active game
        COME_OUT,   // Come-out roll phase
        POINT       // Point established phase
    }
    
    // Dice roll result
    struct DiceRoll {
        uint8 die1;
        uint8 die2;
        uint8 total;
        uint256 timestamp;
        uint256 requestId;
    }
    
    // Shooter state
    struct ShooterState {
        address shooter;
        uint8 point;
        Phase phase;
        uint8 pointsMadeCount;
        uint8 consecutiveWins;
        uint8 fireMask;          // Bit mask for unique points (Fire bet)
        uint8 doublesMask;       // Bit mask for doubles seen
        uint16 smallTallMask;    // Bit mask for Small/Tall/All
        uint8[13] rollCount;     // Count per total for repeater bets
        uint256 seriesStartBlock;
    }
    
    // Events
    event GameStarted(address indexed shooter, uint256 seriesId);
    event DiceRolled(uint256 indexed seriesId, uint8 die1, uint8 die2, uint8 total);
    event PointEstablished(uint256 indexed seriesId, uint8 point);
    event PointMade(uint256 indexed seriesId, uint8 point);
    event SevenOut(uint256 indexed seriesId, address shooter);
    event PhaseChanged(Phase from, Phase to);
    event RandomnessRequested(uint256 requestId);
    event RandomnessFulfilled(uint256 requestId, uint256 randomness);
    
    // Core game functions
    function requestDiceRoll() external returns (uint256 requestId);
    function getCurrentShooter() external view returns (ShooterState memory);
    function getCurrentPhase() external view returns (Phase);
    function getLastRoll() external view returns (DiceRoll memory);
    function getSeriesId() external view returns (uint256);
    
    // Game state management
    function startNewSeries(address shooter) external;
    function endCurrentSeries() external;
    function isGameActive() external view returns (bool);
    
    // Bet validation
    function canPlaceBet(uint8 betType) external view returns (bool);
    function isBetTypeValid(uint8 betType) external pure returns (bool);
}

/**
 * @title ICrapsBets
 * @notice Interface for bet management in Craps
 */
interface ICrapsBets {
    // Bet structure
    struct Bet {
        uint256 amount;
        uint8 betType;
        uint8 point;        // For Come/Don't Come bets
        uint256 timestamp;
        bool isActive;
    }
    
    // Player bet summary
    struct PlayerBets {
        uint256 totalAtRisk;
        uint256 potentialWin;
        uint64 activeBetsBitmap;  // Bit mask for active bet types
        uint8 activeBetCount;
    }
    
    // Events
    event BetPlaced(
        address indexed player,
        uint256 indexed seriesId,
        uint8 betType,
        uint256 amount
    );
    
    event BetResolved(
        address indexed player,
        uint256 indexed seriesId,
        uint8 betType,
        uint256 amount,
        uint256 payout,
        bool won
    );
    
    event OddsBetPlaced(
        address indexed player,
        uint8 baseBetType,
        uint256 oddsAmount,
        uint8 point
    );
    
    // Betting functions
    function placeBet(uint8 betType, uint256 amount) external;
    function placeOddsBet(uint8 baseBetType, uint256 oddsAmount) external;
    function removeBet(uint8 betType) external;
    function clearBet(address player, uint8 betType) external;
    
    // View functions
    function getPlayerBets(address player) external view returns (PlayerBets memory);
    function getBet(address player, uint8 betType) external view returns (Bet memory);
    function hasActiveBet(address player, uint8 betType) external view returns (bool);
    function getTotalAtRisk(address player) external view returns (uint256);
}

/**
 * @title ICrapsSettlement
 * @notice Interface for bet settlement and payout calculations
 */
interface ICrapsSettlement {
    // Settlement batch for gas optimization
    struct SettlementBatch {
        address[] players;
        uint8[] betTypes;
        uint256[] amounts;
        uint256[] payouts;
    }
    
    // Events
    event BatchSettlement(
        uint256 indexed seriesId,
        uint256 rollNumber,
        uint8 diceTotal,
        uint256 totalPayout
    );
    
    event FieldBetResolved(
        address indexed player,
        uint8 diceTotal,
        uint256 payout
    );
    
    event HardwayResolved(
        address indexed player,
        uint8 hardwayType,
        bool wonHard,
        uint256 payout
    );
    
    // Settlement functions
    function settleRoll(uint8 die1, uint8 die2) external returns (uint256 totalPayout);
    function settleComeOutRoll(uint8 total) external returns (uint256 totalPayout);
    function settlePointRoll(uint8 total, uint8 point) external returns (uint256 totalPayout);
    function settleSevenOut() external returns (uint256 totalPayout);
    
    // Payout calculations
    function calculatePayout(
        uint8 betType,
        uint256 amount,
        uint8 point
    ) external pure returns (uint256);
    
    function getFieldPayout(uint8 total) external pure returns (uint256 multiplier);
    function isHardway(uint8 die1, uint8 die2, uint8 total) external pure returns (bool);
}

/**
 * @title ICrapsVault
 * @notice Interface for vault integration with the Craps game
 */
interface ICrapsVault {
    function processBet(
        address player,
        uint256 amount
    ) external returns (bool);
    
    function processPayout(
        address player,
        uint256 amount
    ) external returns (bool);
    
    function getPlayerBalance(address player) external view returns (uint256);
    function getTotalLiquidity() external view returns (uint256);
    function getActiveBotVaults() external view returns (address[] memory);
}