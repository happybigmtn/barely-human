// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ICrapsGame.sol";
import "./CrapsBetTypes.sol";

/**
 * @title CrapsBets
 * @notice Manages all bet placement and storage for the Craps game
 * @dev Optimized for gas efficiency with bitmap tracking and batch operations
 */
contract CrapsBets is ICrapsBets, AccessControl, ReentrancyGuard, Pausable {
    using CrapsBetTypes for uint8;
    
    // Roles
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Connected contracts
    ICrapsGame public gameContract;
    ICrapsVault public vaultContract;
    address public settlementContract;
    
    // Bet storage - optimized with nested mappings
    // player => betType => Bet
    mapping(address => mapping(uint8 => Bet)) public bets;
    
    // Player bet tracking
    mapping(address => PlayerBets) public playerBetSummary;
    
    // Active players for batch processing
    address[] public activePlayers;
    mapping(address => uint256) public playerIndex;
    mapping(address => bool) public isActivePlayer;
    
    // Series tracking
    uint256 public currentSeriesId;
    mapping(uint256 => uint256) public seriesTotalBets;
    mapping(uint256 => uint256) public seriesTotalVolume;
    
    // Bet limits
    uint256 public minBetAmount = 0.001 ether;
    uint256 public maxBetAmount = 10 ether;
    uint256 public maxOddsMultiple = 5; // 5x odds max
    
    // State tracking for Come/Don't Come bets
    mapping(address => mapping(uint8 => uint8)) public comePoints; // player => comeNumber => point
    
    // Events (from interface)
    // event BetPlaced(address indexed player, uint256 indexed seriesId, uint8 betType, uint256 amount);
    // event BetResolved(address indexed player, uint256 indexed seriesId, uint8 betType, uint256 amount, uint256 payout, bool won);
    // event OddsBetPlaced(address indexed player, uint8 baseBetType, uint256 oddsAmount, uint8 point);
    
    // Additional events
    event BetRemoved(address indexed player, uint8 betType, uint256 amount);
    event BatchProcessed(uint256 playersProcessed, uint256 totalPayouts);
    
    // Modifiers
    modifier onlyGame() {
        require(msg.sender == address(gameContract), "Only game contract");
        _;
    }
    
    modifier onlySettlement() {
        require(msg.sender == settlementContract, "Only settlement contract");
        _;
    }
    
    modifier validBetType(uint8 betType) {
        require(betType <= 63, "Invalid bet type");
        _;
    }
    
    modifier betAmountValid(uint256 amount) {
        require(amount >= minBetAmount && amount <= maxBetAmount, "Invalid bet amount");
        _;
    }
    
    /**
     * @notice Constructor
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    // ============ Configuration Functions ============
    
    /**
     * @notice Set connected contracts
     * @param _gameContract Address of the game contract
     * @param _vaultContract Address of the vault contract
     * @param _settlementContract Address of the settlement contract
     */
    function setContracts(
        address _gameContract,
        address _vaultContract,
        address _settlementContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_gameContract != address(0), "Invalid game contract");
        require(_vaultContract != address(0), "Invalid vault contract");
        require(_settlementContract != address(0), "Invalid settlement contract");
        
        gameContract = ICrapsGame(_gameContract);
        vaultContract = ICrapsVault(_vaultContract);
        settlementContract = _settlementContract;
        
        _grantRole(GAME_ROLE, _gameContract);
        _grantRole(SETTLEMENT_ROLE, _settlementContract);
    }
    
    /**
     * @notice Update bet limits
     * @param _minBet Minimum bet amount
     * @param _maxBet Maximum bet amount
     * @param _maxOdds Maximum odds multiple
     */
    function updateLimits(
        uint256 _minBet,
        uint256 _maxBet,
        uint256 _maxOdds
    ) external onlyRole(OPERATOR_ROLE) {
        require(_minBet > 0 && _minBet <= _maxBet, "Invalid bet limits");
        require(_maxOdds >= 1 && _maxOdds <= 10, "Invalid odds multiple");
        
        minBetAmount = _minBet;
        maxBetAmount = _maxBet;
        maxOddsMultiple = _maxOdds;
    }
    
    // ============ Betting Functions ============
    
    /**
     * @notice Place a bet
     * @param betType Type of bet to place
     * @param amount Amount to bet
     */
    function placeBet(
        uint8 betType,
        uint256 amount
    ) external override 
        nonReentrant 
        whenNotPaused 
        validBetType(betType) 
        betAmountValid(amount) 
    {
        require(gameContract.isGameActive(), "Game not active");
        require(gameContract.canPlaceBet(betType), "Cannot place this bet now");
        
        // Check if player has an active bet of this type
        require(!bets[msg.sender][betType].isActive, "Bet already exists");
        
        // Process payment through vault
        require(
            vaultContract.processBet(msg.sender, amount),
            "Payment failed"
        );
        
        // Get current series ID
        uint256 seriesId = gameContract.getSeriesId();
        if (seriesId != currentSeriesId) {
            currentSeriesId = seriesId;
        }
        
        // Store bet
        bets[msg.sender][betType] = Bet({
            amount: amount,
            betType: betType,
            point: 0,
            timestamp: block.timestamp,
            isActive: true
        });
        
        // Handle Come/Don't Come point tracking
        if (betType == CrapsBetTypes.BET_COME || betType == CrapsBetTypes.BET_DONT_COME) {
            // Point will be set on next roll
            comePoints[msg.sender][betType] = 0;
        }
        
        // Update player tracking
        _updatePlayerTracking(msg.sender, betType, amount, true);
        
        // Update series stats
        seriesTotalBets[seriesId]++;
        seriesTotalVolume[seriesId] += amount;
        
        emit BetPlaced(msg.sender, seriesId, betType, amount);
    }
    
    /**
     * @notice Place an odds bet on existing Pass/Come or Don't Pass/Don't Come bet
     * @param baseBetType The base bet type (Pass, Don't Pass, Come, Don't Come)
     * @param oddsAmount Amount for the odds bet
     */
    function placeOddsBet(
        uint8 baseBetType,
        uint256 oddsAmount
    ) external override 
        nonReentrant 
        whenNotPaused 
        betAmountValid(oddsAmount) 
    {
        // Validate base bet type
        require(
            baseBetType == CrapsBetTypes.BET_PASS ||
            baseBetType == CrapsBetTypes.BET_DONT_PASS ||
            baseBetType == CrapsBetTypes.BET_COME ||
            baseBetType == CrapsBetTypes.BET_DONT_COME,
            "Invalid base bet for odds"
        );
        
        // Check player has active base bet
        Bet memory baseBet = bets[msg.sender][baseBetType];
        require(baseBet.isActive, "No active base bet");
        
        // Get current point
        ICrapsGame.ShooterState memory shooter = gameContract.getCurrentShooter();
        uint8 point = shooter.point;
        
        // For Come/Don't Come, use the come point
        if (baseBetType == CrapsBetTypes.BET_COME || baseBetType == CrapsBetTypes.BET_DONT_COME) {
            point = comePoints[msg.sender][baseBetType];
        }
        
        require(point > 0, "No point established");
        
        // Check odds limit
        require(
            oddsAmount <= baseBet.amount * maxOddsMultiple,
            "Exceeds max odds multiple"
        );
        
        // Determine odds bet type
        uint8 oddsBetType;
        if (baseBetType == CrapsBetTypes.BET_PASS) {
            oddsBetType = CrapsBetTypes.BET_ODDS_PASS;
        } else if (baseBetType == CrapsBetTypes.BET_DONT_PASS) {
            oddsBetType = CrapsBetTypes.BET_ODDS_DONT_PASS;
        } else if (baseBetType == CrapsBetTypes.BET_COME) {
            oddsBetType = CrapsBetTypes.BET_ODDS_COME;
        } else {
            oddsBetType = CrapsBetTypes.BET_ODDS_DONT_COME;
        }
        
        // Check no existing odds bet
        require(!bets[msg.sender][oddsBetType].isActive, "Odds bet already exists");
        
        // Process payment
        require(
            vaultContract.processBet(msg.sender, oddsAmount),
            "Payment failed"
        );
        
        // Store odds bet
        bets[msg.sender][oddsBetType] = Bet({
            amount: oddsAmount,
            betType: oddsBetType,
            point: point,
            timestamp: block.timestamp,
            isActive: true
        });
        
        // Update tracking
        _updatePlayerTracking(msg.sender, oddsBetType, oddsAmount, true);
        
        emit OddsBetPlaced(msg.sender, baseBetType, oddsAmount, point);
    }
    
    /**
     * @notice Remove a bet (if allowed)
     * @param betType Type of bet to remove
     */
    function removeBet(uint8 betType) external override nonReentrant whenNotPaused {
        Bet memory bet = bets[msg.sender][betType];
        require(bet.isActive, "No active bet");
        
        // Some bets cannot be removed once placed
        require(_canRemoveBet(betType), "Cannot remove this bet");
        
        // Return funds to player through vault
        require(
            vaultContract.processPayout(msg.sender, bet.amount),
            "Refund failed"
        );
        
        // Clear bet
        delete bets[msg.sender][betType];
        
        // Update tracking
        _updatePlayerTracking(msg.sender, betType, bet.amount, false);
        
        emit BetRemoved(msg.sender, betType, bet.amount);
    }
    
    // ============ Settlement Functions ============
    
    /**
     * @notice Clear a resolved bet (called by settlement contract)
     * @param player Player address
     * @param betType Bet type to clear
     */
    function clearBet(
        address player,
        uint8 betType
    ) external onlyRole(SETTLEMENT_ROLE) {
        delete bets[player][betType];
        _updatePlayerTracking(player, betType, 0, false);
    }
    
    /**
     * @notice Update come point after roll (called by settlement)
     * @param player Player address
     * @param betType Come or Don't Come bet type
     * @param point New point value
     */
    function updateComePoint(
        address player,
        uint8 betType,
        uint8 point
    ) external onlyRole(SETTLEMENT_ROLE) {
        require(
            betType == CrapsBetTypes.BET_COME || 
            betType == CrapsBetTypes.BET_DONT_COME,
            "Not a come bet"
        );
        
        comePoints[player][betType] = point;
        
        // Update the bet's point value
        if (bets[player][betType].isActive) {
            bets[player][betType].point = point;
        }
    }
    
    /**
     * @notice Get all active players for batch processing
     * @param offset Start index
     * @param limit Max number to return
     * @return players Array of player addresses
     */
    function getActivePlayers(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory players) {
        uint256 length = activePlayers.length;
        if (offset >= length) {
            return new address[](0);
        }
        
        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }
        
        players = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            players[i - offset] = activePlayers[i];
        }
    }
    
    // ============ View Functions ============
    
    function getPlayerBets(address player) external view override returns (PlayerBets memory) {
        return playerBetSummary[player];
    }
    
    function getBet(address player, uint8 betType) external view override returns (Bet memory) {
        return bets[player][betType];
    }
    
    function hasActiveBet(address player, uint8 betType) external view override returns (bool) {
        return bets[player][betType].isActive;
    }
    
    function getTotalAtRisk(address player) external view override returns (uint256) {
        return playerBetSummary[player].totalAtRisk;
    }
    
    /**
     * @notice Get all active bet types for a player
     * @param player Player address
     * @return betTypes Array of active bet type IDs
     */
    function getActiveBetTypes(address player) external view returns (uint8[] memory) {
        uint64 bitmap = playerBetSummary[player].activeBetsBitmap;
        uint8 count = playerBetSummary[player].activeBetCount;
        
        uint8[] memory betTypes = new uint8[](count);
        uint8 index = 0;
        
        for (uint8 i = 0; i < 64 && index < count; i++) {
            if (bitmap & (1 << i) != 0) {
                betTypes[index++] = i;
            }
        }
        
        return betTypes;
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Update player tracking when bets change
     * @param player Player address
     * @param betType Bet type
     * @param amount Bet amount
     * @param isAdding True if adding bet, false if removing
     */
    function _updatePlayerTracking(
        address player,
        uint8 betType,
        uint256 amount,
        bool isAdding
    ) private {
        PlayerBets storage summary = playerBetSummary[player];
        
        if (isAdding) {
            // Add to bitmap
            if ((summary.activeBetsBitmap & (1 << betType)) == 0) {
                summary.activeBetsBitmap |= uint64(1 << betType);
                summary.activeBetCount++;
            }
            
            // Update totals
            summary.totalAtRisk += amount;
            
            // Add to active players if first bet
            if (!isActivePlayer[player]) {
                isActivePlayer[player] = true;
                playerIndex[player] = activePlayers.length;
                activePlayers.push(player);
            }
            
        } else {
            // Remove from bitmap
            if ((summary.activeBetsBitmap & (1 << betType)) != 0) {
                summary.activeBetsBitmap &= ~uint64(1 << betType);
                summary.activeBetCount--;
            }
            
            // Update totals
            if (amount > 0 && summary.totalAtRisk >= amount) {
                summary.totalAtRisk -= amount;
            }
            
            // Remove from active players if no more bets
            if (summary.activeBetCount == 0 && isActivePlayer[player]) {
                uint256 index = playerIndex[player];
                uint256 lastIndex = activePlayers.length - 1;
                
                if (index != lastIndex) {
                    address lastPlayer = activePlayers[lastIndex];
                    activePlayers[index] = lastPlayer;
                    playerIndex[lastPlayer] = index;
                }
                
                activePlayers.pop();
                delete playerIndex[player];
                isActivePlayer[player] = false;
            }
        }
    }
    
    /**
     * @notice Check if a bet type can be removed
     * @param betType Bet type to check
     * @return bool Whether the bet can be removed
     */
    function _canRemoveBet(uint8 betType) private pure returns (bool) {
        // Pass/Don't Pass cannot be removed after come-out
        if (betType == CrapsBetTypes.BET_PASS || betType == CrapsBetTypes.BET_DONT_PASS) {
            return false;
        }
        
        // Come/Don't Come cannot be removed once point is established
        if (betType == CrapsBetTypes.BET_COME || betType == CrapsBetTypes.BET_DONT_COME) {
            return false;
        }
        
        // Most other bets can be removed
        return true;
    }
    
    // ============ Emergency Functions ============
    
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }
}
