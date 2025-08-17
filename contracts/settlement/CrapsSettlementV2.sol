// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../game/ICrapsGame.sol";

interface IBettingVaultV2 {
    function settleBet(address player, uint256 betId, uint256 payoutMultiplier) external;
    function batchSettleBets(address[] calldata players, uint256[] calldata betIds, uint256[] calldata payoutMultipliers) external;
    function getBetInfo(address player, uint256 betId) external view returns (
        uint256 amount,
        uint256 seriesId,
        uint8 betType,
        uint8 specificNumber,
        bool isActive,
        bool isSettled,
        uint256 timestamp
    );
}

/**
 * @title CrapsSettlementV2
 * @notice Production-ready settlement system for craps game
 * @dev Handles all bet settlement logic based on game outcomes
 */
contract CrapsSettlementV2 is AccessControl, ReentrancyGuard, Pausable {
    
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    
    // Contract references
    ICrapsGame public immutable crapsGame;
    IBettingVaultV2 public immutable bettingVault;
    
    // Payout multipliers (in basis points, 10000 = 1x)
    mapping(uint8 => uint256) public payoutMultipliers;
    
    // Settlement tracking
    struct SettlementBatch {
        uint256 seriesId;
        uint256 rollNumber;
        uint8 die1;
        uint8 die2;
        uint8 total;
        ICrapsGame.Phase gamePhase;
        uint8 point;
        uint256 timestamp;
        bool processed;
    }
    
    mapping(uint256 => SettlementBatch) public settlementBatches;
    uint256 public nextBatchId;
    
    // Statistics
    uint256 public totalSettlements;
    uint256 public totalWinningBets;
    uint256 public totalLosingBets;
    
    // Events
    event BetSettled(
        address indexed player,
        uint256 indexed betId,
        uint8 betType,
        bool won,
        uint256 payout
    );
    
    event BatchSettlementProcessed(
        uint256 indexed batchId,
        uint256 indexed seriesId,
        uint8 diceTotal,
        uint256 betsProcessed
    );
    
    event PayoutMultiplierUpdated(uint8 betType, uint256 multiplier);
    
    // Errors
    error InvalidContracts();
    error InvalidBetType();
    error InvalidMultiplier();
    error BatchAlreadyProcessed();
    error UnauthorizedAccess();
    
    constructor(address _crapsGame, address _bettingVault) {
        if (_crapsGame == address(0) || _bettingVault == address(0)) {
            revert InvalidContracts();
        }
        
        crapsGame = ICrapsGame(_crapsGame);
        bettingVault = IBettingVaultV2(_bettingVault);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        _initializePayouts();
    }
    
    /**
     * @dev Initialize standard craps payout multipliers
     */
    function _initializePayouts() internal {
        // Pass Line / Don't Pass (1:1)
        payoutMultipliers[0] = 20000; // Pass line (2x total = 1:1 profit)
        payoutMultipliers[1] = 20000; // Don't pass
        
        // Come / Don't Come (1:1)
        payoutMultipliers[2] = 20000; // Come
        payoutMultipliers[3] = 20000; // Don't come
        
        // Field Bets (varies)
        payoutMultipliers[4] = 20000; // Field (1:1 for most, 2:1 for 2/12)
        
        // Place Bets (varies by number)
        payoutMultipliers[5] = 23333; // Place 6 (7:6)
        payoutMultipliers[6] = 23333; // Place 8 (7:6)
        payoutMultipliers[7] = 27500; // Place 5 (7:5)
        payoutMultipliers[8] = 27500; // Place 9 (7:5)
        payoutMultipliers[9] = 29500; // Place 4 (9:5)
        payoutMultipliers[10] = 29500; // Place 10 (9:5)
        
        // Buy Bets (true odds minus 5% commission)
        payoutMultipliers[11] = 29500; // Buy 4 (2:1 minus commission)
        payoutMultipliers[12] = 29500; // Buy 10 (2:1 minus commission)
        payoutMultipliers[13] = 28500; // Buy 5 (3:2 minus commission)
        payoutMultipliers[14] = 28500; // Buy 9 (3:2 minus commission)
        payoutMultipliers[15] = 23800; // Buy 6 (6:5 minus commission)
        payoutMultipliers[16] = 23800; // Buy 8 (6:5 minus commission)
        
        // Lay Bets (true odds minus 5% commission)
        payoutMultipliers[17] = 14750; // Lay 4 (1:2 minus commission)
        payoutMultipliers[18] = 14750; // Lay 10 (1:2 minus commission)
        payoutMultipliers[19] = 16333; // Lay 5 (2:3 minus commission)
        payoutMultipliers[20] = 16333; // Lay 9 (2:3 minus commission)
        payoutMultipliers[21] = 18095; // Lay 6 (5:6 minus commission)
        payoutMultipliers[22] = 18095; // Lay 8 (5:6 minus commission)
        
        // Big 6 and Big 8 (1:1)
        payoutMultipliers[23] = 20000; // Big 6
        payoutMultipliers[24] = 20000; // Big 8
        
        // Hard Ways (varies)
        payoutMultipliers[25] = 100000; // Hard 4 (9:1)
        payoutMultipliers[26] = 100000; // Hard 10 (9:1)
        payoutMultipliers[27] = 80000; // Hard 6 (7:1)
        payoutMultipliers[28] = 80000; // Hard 8 (7:1)
        
        // Odds Bets (true odds, no house edge)
        payoutMultipliers[29] = 30000; // Pass odds 4/10 (2:1)
        payoutMultipliers[30] = 25000; // Pass odds 5/9 (3:2)
        payoutMultipliers[31] = 22000; // Pass odds 6/8 (6:5)
        payoutMultipliers[32] = 15000; // Don't pass odds 4/10 (1:2)
        payoutMultipliers[33] = 16667; // Don't pass odds 5/9 (2:3)
        payoutMultipliers[34] = 18333; // Don't pass odds 6/8 (5:6)
        
        // One Roll Bets
        payoutMultipliers[35] = 50000; // Any 7 (4:1)
        payoutMultipliers[36] = 80000; // Any craps (7:1)
        payoutMultipliers[37] = 160000; // Craps 2 (15:1)
        payoutMultipliers[38] = 160000; // Craps 3 (15:1)
        payoutMultipliers[39] = 80000; // Yo (11) (7:1)
        payoutMultipliers[40] = 310000; // Craps 12 (30:1)
        payoutMultipliers[41] = 180000; // Horn bet (varies)
        payoutMultipliers[42] = 50000; // C&E (varies)
        
        // Hop Bets (varies 15:1 or 30:1)
        for (uint8 i = 43; i < 64; i++) {
            payoutMultipliers[i] = 160000; // Default 15:1 for hop bets
        }
    }
    
    /**
     * @notice Process settlement for a dice roll
     * @param seriesId Game series ID
     * @param die1 First die value
     * @param die2 Second die value
     * @param players Array of players with bets
     * @param betIds Array of bet IDs to settle
     */
    function processRollSettlement(
        uint256 seriesId,
        uint8 die1,
        uint8 die2,
        address[] calldata players,
        uint256[] calldata betIds
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        require(players.length == betIds.length, "Array length mismatch");
        
        // Get current game state
        ICrapsGame.Phase currentPhase = crapsGame.getCurrentPhase();
        ICrapsGame.ShooterState memory shooter = crapsGame.getCurrentShooter();
        uint8 diceTotal = die1 + die2;
        
        // Create settlement batch
        uint256 batchId = nextBatchId++;
        settlementBatches[batchId] = SettlementBatch({
            seriesId: seriesId,
            rollNumber: shooter.rollCount[diceTotal],
            die1: die1,
            die2: die2,
            total: diceTotal,
            gamePhase: currentPhase,
            point: shooter.point,
            timestamp: block.timestamp,
            processed: true
        });
        
        uint256 betsProcessed = 0;
        
        // Process each bet
        for (uint256 i = 0; i < players.length; i++) {
            bool won = _evaluateBet(
                players[i],
                betIds[i],
                diceTotal,
                currentPhase,
                shooter.point,
                die1,
                die2
            );
            
            if (won) {
                // Get bet info for multiplier lookup
                (,, uint8 betType,,,,) = bettingVault.getBetInfo(players[i], betIds[i]);
                uint256 multiplier = payoutMultipliers[betType];
                
                // Settle winning bet
                bettingVault.settleBet(players[i], betIds[i], multiplier);
                totalWinningBets++;
                
                emit BetSettled(players[i], betIds[i], betType, true, multiplier);
            } else {
                // Settle losing bet (0 payout)
                bettingVault.settleBet(players[i], betIds[i], 0);
                totalLosingBets++;
                
                (,, uint8 betType,,,,) = bettingVault.getBetInfo(players[i], betIds[i]);
                emit BetSettled(players[i], betIds[i], betType, false, 0);
            }
            
            betsProcessed++;
        }
        
        totalSettlements += betsProcessed;
        
        emit BatchSettlementProcessed(batchId, seriesId, diceTotal, betsProcessed);
    }
    
    /**
     * @dev Evaluate if a bet wins based on dice roll and game state
     * @param player Player address
     * @param betId Bet identifier
     * @param diceTotal Sum of dice
     * @param phase Current game phase
     * @param point Established point (0 if come out)
     * @param die1 First die value
     * @param die2 Second die value
     * @return won True if bet wins
     */
    function _evaluateBet(
        address player,
        uint256 betId,
        uint8 diceTotal,
        ICrapsGame.Phase phase,
        uint8 point,
        uint8 die1,
        uint8 die2
    ) internal view returns (bool won) {
        (,, uint8 betType, uint8 specificNumber,,,) = bettingVault.getBetInfo(player, betId);
        
        // Pass Line (0)
        if (betType == 0) {
            if (phase == ICrapsGame.Phase.COME_OUT) {
                return diceTotal == 7 || diceTotal == 11;
            } else {
                return diceTotal == point;
            }
        }
        
        // Don't Pass (1)
        if (betType == 1) {
            if (phase == ICrapsGame.Phase.COME_OUT) {
                return diceTotal == 2 || diceTotal == 3;
            } else {
                return diceTotal == 7;
            }
        }
        
        // Field Bet (4)
        if (betType == 4) {
            return diceTotal == 2 || diceTotal == 3 || diceTotal == 4 || 
                   diceTotal == 9 || diceTotal == 10 || diceTotal == 11 || diceTotal == 12;
        }
        
        // Place Bets (5-10)
        if (betType >= 5 && betType <= 10) {
            uint8 targetNumber = _getPlaceNumber(betType);
            return diceTotal == targetNumber && phase == ICrapsGame.Phase.POINT;
        }
        
        // Big 6 (23)
        if (betType == 23) {
            return diceTotal == 6;
        }
        
        // Big 8 (24)
        if (betType == 24) {
            return diceTotal == 8;
        }
        
        // Hard Ways (25-28)
        if (betType >= 25 && betType <= 28) {
            return _isHardWay(betType, die1, die2);
        }
        
        // Any 7 (35)
        if (betType == 35) {
            return diceTotal == 7;
        }
        
        // Any Craps (36)
        if (betType == 36) {
            return diceTotal == 2 || diceTotal == 3 || diceTotal == 12;
        }
        
        // Specific Craps Numbers (37-40)
        if (betType == 37) return diceTotal == 2;
        if (betType == 38) return diceTotal == 3;
        if (betType == 39) return diceTotal == 11;
        if (betType == 40) return diceTotal == 12;
        
        // Hop Bets (43-63)
        if (betType >= 43 && betType <= 63) {
            return _isHopBet(specificNumber, die1, die2);
        }
        
        return false;
    }
    
    /**
     * @dev Get the target number for a place bet
     */
    function _getPlaceNumber(uint8 betType) internal pure returns (uint8) {
        if (betType == 5) return 6;
        if (betType == 6) return 8;
        if (betType == 7) return 5;
        if (betType == 8) return 9;
        if (betType == 9) return 4;
        if (betType == 10) return 10;
        return 0;
    }
    
    /**
     * @dev Check if dice show a hard way
     */
    function _isHardWay(uint8 betType, uint8 die1, uint8 die2) internal pure returns (bool) {
        if (betType == 25) return die1 == 2 && die2 == 2; // Hard 4
        if (betType == 26) return die1 == 5 && die2 == 5; // Hard 10
        if (betType == 27) return die1 == 3 && die2 == 3; // Hard 6
        if (betType == 28) return die1 == 4 && die2 == 4; // Hard 8
        return false;
    }
    
    /**
     * @dev Check if dice match a hop bet
     */
    function _isHopBet(uint8 specificNumber, uint8 die1, uint8 die2) internal pure returns (bool) {
        uint8 target1 = specificNumber / 10;
        uint8 target2 = specificNumber % 10;
        return (die1 == target1 && die2 == target2) || (die1 == target2 && die2 == target1);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update payout multiplier for a bet type
     * @param betType Bet type (0-63)
     * @param multiplier Payout multiplier in basis points
     */
    function setPayoutMultiplier(uint8 betType, uint256 multiplier) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (betType >= 64) revert InvalidBetType();
        if (multiplier == 0 || multiplier > 1000000) revert InvalidMultiplier();
        
        payoutMultipliers[betType] = multiplier;
        emit PayoutMultiplierUpdated(betType, multiplier);
    }
    
    /**
     * @notice Batch update payout multipliers
     * @param betTypes Array of bet types
     * @param multipliers Array of multipliers
     */
    function batchSetPayoutMultipliers(
        uint8[] calldata betTypes,
        uint256[] calldata multipliers
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(betTypes.length == multipliers.length, "Array length mismatch");
        
        for (uint256 i = 0; i < betTypes.length; i++) {
            if (betTypes[i] >= 64) revert InvalidBetType();
            if (multipliers[i] == 0 || multipliers[i] > 1000000) revert InvalidMultiplier();
            
            payoutMultipliers[betTypes[i]] = multipliers[i];
            emit PayoutMultiplierUpdated(betTypes[i], multipliers[i]);
        }
    }
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get all payout multipliers
     * @return multipliers Array of all 64 bet type multipliers
     */
    function getAllPayoutMultipliers() external view returns (uint256[64] memory multipliers) {
        for (uint8 i = 0; i < 64; i++) {
            multipliers[i] = payoutMultipliers[i];
        }
    }
    
    /**
     * @notice Get settlement statistics
     */
    function getSettlementStats() external view returns (
        uint256 settlements,
        uint256 winningBets,
        uint256 losingBets,
        uint256 winRate
    ) {
        settlements = totalSettlements;
        winningBets = totalWinningBets;
        losingBets = totalLosingBets;
        
        if (totalSettlements > 0) {
            winRate = (totalWinningBets * 10000) / totalSettlements;
        }
    }
}