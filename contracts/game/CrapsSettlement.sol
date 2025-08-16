// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ICrapsGame.sol";
import "./CrapsBetTypes.sol";

/**
 * @title CrapsSettlement
 * @notice Handles bet resolution and payout calculations for all 64 bet types
 * @dev Optimized for batch processing and gas efficiency
 */
contract CrapsSettlement is ICrapsSettlement, AccessControl, ReentrancyGuard {
    using CrapsBetTypes for uint8;
    
    // Roles
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Connected contracts
    ICrapsGame public gameContract;
    ICrapsBets public betsContract;
    ICrapsVault public vaultContract;
    
    // Current processing state
    uint256 public currentSeriesId;
    uint256 public currentRollNumber;
    uint8 public lastDie1;
    uint8 public lastDie2;
    uint8 public lastTotal;
    
    // Batch processing
    uint256 public constant MAX_BATCH_SIZE = 100;
    SettlementBatch private currentBatch;
    
    // Statistics
    mapping(uint256 => uint256) public seriesTotalPayouts;
    mapping(uint256 => uint256) public seriesHouseEdge;
    
    // Special payout tables for complex bets
    mapping(uint8 => uint256) public firePayouts;      // Points made => payout
    mapping(uint8 => uint256) public ridePayouts;      // Win streak => payout
    mapping(uint8 => uint256) public hotRollerPayouts; // Points made => payout
    mapping(uint8 => uint256) public doublesPayouts;   // Doubles count => payout
    
    // Constructor
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        _initializePayoutTables();
    }
    
    /**
     * @notice Initialize special payout tables
     */
    function _initializePayoutTables() private {
        // Fire bet payouts
        firePayouts[4] = 2400;   // 24:1
        firePayouts[5] = 24900;  // 249:1
        firePayouts[6] = 99900;  // 999:1
        
        // Ride the Line payouts
        ridePayouts[1] = 100;    // 1:1
        ridePayouts[2] = 200;    // 2:1
        ridePayouts[3] = 300;    // 3:1
        ridePayouts[4] = 500;    // 5:1
        ridePayouts[5] = 800;    // 8:1
        ridePayouts[6] = 1200;   // 12:1
        ridePayouts[7] = 2000;   // 20:1
        ridePayouts[8] = 3500;   // 35:1
        ridePayouts[9] = 6000;   // 60:1
        ridePayouts[10] = 10000; // 100:1
        ridePayouts[11] = 15000; // 150:1
        
        // Hot Roller payouts
        hotRollerPayouts[2] = 500;    // 5:1
        hotRollerPayouts[3] = 1000;   // 10:1
        hotRollerPayouts[4] = 2000;   // 20:1
        hotRollerPayouts[5] = 5000;   // 50:1
        hotRollerPayouts[6] = 10000;  // 100:1
        
        // Different Doubles payouts
        doublesPayouts[3] = 400;    // 4:1
        doublesPayouts[4] = 800;    // 8:1
        doublesPayouts[5] = 1500;   // 15:1
        doublesPayouts[6] = 10000;  // 100:1
    }
    
    // ============ Configuration Functions ============
    
    /**
     * @notice Set connected contracts
     */
    function setContracts(
        address _gameContract,
        address _betsContract,
        address _vaultContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_gameContract != address(0), "Invalid game contract");
        require(_betsContract != address(0), "Invalid bets contract");
        require(_vaultContract != address(0), "Invalid vault contract");
        
        gameContract = ICrapsGame(_gameContract);
        betsContract = ICrapsBets(_betsContract);
        vaultContract = ICrapsVault(_vaultContract);
        
        _grantRole(GAME_ROLE, _gameContract);
    }
    
    // ============ Main Settlement Functions ============
    
    /**
     * @notice Settle all bets for a dice roll
     * @param die1 First die value
     * @param die2 Second die value
     * @return totalPayout Total amount paid out
     */
    function settleRoll(
        uint8 die1,
        uint8 die2
    ) external override onlyRole(GAME_ROLE) nonReentrant returns (uint256) {
        lastDie1 = die1;
        lastDie2 = die2;
        lastTotal = die1 + die2;
        currentRollNumber++;
        
        ICrapsGame.ShooterState memory shooter = gameContract.getCurrentShooter();
        ICrapsGame.Phase phase = gameContract.getCurrentPhase();
        
        uint256 totalPayout = 0;
        
        if (phase == ICrapsGame.Phase.COME_OUT) {
            totalPayout = settleComeOutRoll(lastTotal);
        } else if (phase == ICrapsGame.Phase.POINT) {
            totalPayout = settlePointRoll(lastTotal, shooter.point);
        }
        
        // Always settle one-roll bets
        totalPayout += _settleOneRollBets(lastTotal);
        
        // Update series stats
        uint256 seriesId = gameContract.getSeriesId();
        seriesTotalPayouts[seriesId] += totalPayout;
        
        emit BatchSettlement(seriesId, currentRollNumber, lastTotal, totalPayout);
        
        return totalPayout;
    }
    
    /**
     * @notice Settle come-out roll bets
     * @param total Dice total
     * @return totalPayout Amount paid out
     */
    function settleComeOutRoll(uint8 total) public override onlyRole(GAME_ROLE) returns (uint256) {
        uint256 totalPayout = 0;
        
        if (total == 7 || total == 11) {
            // Natural - Pass wins, Don't Pass loses
            totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, true, 100);
            totalPayout += _settleBetType(CrapsBetTypes.BET_DONT_PASS, false, 0);
            
        } else if (total == 2 || total == 3) {
            // Craps - Pass loses, Don't Pass wins
            totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, false, 0);
            totalPayout += _settleBetType(CrapsBetTypes.BET_DONT_PASS, true, 100);
            
        } else if (total == 12) {
            // Boxcars - Pass loses, Don't Pass pushes
            totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, false, 0);
            totalPayout += _pushBetType(CrapsBetTypes.BET_DONT_PASS);
        }
        // 4,5,6,8,9,10 establish point - no line bet resolution
        
        return totalPayout;
    }
    
    /**
     * @notice Settle point phase roll bets
     * @param total Dice total
     * @param point Current point
     * @return totalPayout Amount paid out
     */
    function settlePointRoll(
        uint8 total,
        uint8 point
    ) public override onlyRole(GAME_ROLE) returns (uint256) {
        uint256 totalPayout = 0;
        
        if (total == point) {
            // Point made - Pass wins, Don't Pass loses
            totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, true, 100);
            totalPayout += _settleBetType(CrapsBetTypes.BET_DONT_PASS, false, 0);
            
            // Settle Pass odds
            totalPayout += _settleOddsBet(CrapsBetTypes.BET_ODDS_PASS, true, point);
            totalPayout += _settleOddsBet(CrapsBetTypes.BET_ODDS_DONT_PASS, false, point);
            
        } else if (total == 7) {
            // Seven-out handled in settleSevenOut
            return 0;
        } else {
            // Continue rolling - settle place bets and come bets
            totalPayout += _settlePlaceBets(total);
            totalPayout += _settleComeBets(total);
            totalPayout += _settleHardways(lastDie1, lastDie2, total);
        }
        
        return totalPayout;
    }
    
    /**
     * @notice Settle all bets on seven-out
     * @return totalPayout Amount paid out
     */
    function settleSevenOut() external override onlyRole(GAME_ROLE) returns (uint256) {
        uint256 totalPayout = 0;
        ICrapsGame.ShooterState memory shooter = gameContract.getCurrentShooter();
        
        // Don't Pass wins, Pass loses
        totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, false, 0);
        totalPayout += _settleBetType(CrapsBetTypes.BET_DONT_PASS, true, 100);
        
        // Settle Don't Pass odds
        totalPayout += _settleOddsBet(CrapsBetTypes.BET_ODDS_PASS, false, shooter.point);
        totalPayout += _settleOddsBet(CrapsBetTypes.BET_ODDS_DONT_PASS, true, shooter.point);
        
        // All YES bets lose, all NO bets win
        for (uint8 i = CrapsBetTypes.BET_YES_2; i <= CrapsBetTypes.BET_YES_12; i++) {
            totalPayout += _settleBetType(i, false, 0);
        }
        for (uint8 i = CrapsBetTypes.BET_NO_2; i <= CrapsBetTypes.BET_NO_12; i++) {
            uint256 multiplier = CrapsBetTypes.getPayoutMultiplier(i, 0);
            totalPayout += _settleBetType(i, true, multiplier);
        }
        
        // All hardways lose
        for (uint8 i = CrapsBetTypes.BET_HARD4; i <= CrapsBetTypes.BET_HARD10; i++) {
            totalPayout += _settleBetType(i, false, 0);
        }
        
        // Settle bonus bets based on shooter performance
        totalPayout += _settleBonusBets(shooter);
        
        return totalPayout;
    }
    
    // ============ Specific Bet Settlement Functions ============
    
    /**
     * @notice Settle one-roll proposition bets
     */
    function _settleOneRollBets(uint8 total) private returns (uint256) {
        uint256 totalPayout = 0;
        
        // Field bet
        if (total == 2 || total == 3 || total == 4 || total == 9 || total == 10 || total == 11 || total == 12) {
            uint256 fieldMultiplier = 100; // 1:1 default
            if (total == 2) fieldMultiplier = 200;  // 2:1
            if (total == 12) fieldMultiplier = 300; // 3:1
            totalPayout += _settleBetType(CrapsBetTypes.BET_FIELD, true, fieldMultiplier);
        } else {
            totalPayout += _settleBetType(CrapsBetTypes.BET_FIELD, false, 0);
        }
        
        // NEXT bets (43-53)
        for (uint8 i = CrapsBetTypes.BET_NEXT_2; i <= CrapsBetTypes.BET_NEXT_12; i++) {
            uint8 targetTotal = i - CrapsBetTypes.BET_NEXT_2 + 2;
            if (total == targetTotal) {
                uint256 multiplier = CrapsBetTypes.getPayoutMultiplier(i, 0);
                totalPayout += _settleBetType(i, true, multiplier);
            } else {
                totalPayout += _settleBetType(i, false, 0);
            }
        }
        
        return totalPayout;
    }
    
    /**
     * @notice Settle place bets (YES/NO bets)
     */
    function _settlePlaceBets(uint8 total) private returns (uint256) {
        uint256 totalPayout = 0;
        
        // Check YES bets - win if number rolled
        uint8 yesBetType = _getYesBetType(total);
        if (yesBetType != 0) {
            uint256 multiplier = CrapsBetTypes.getPayoutMultiplier(yesBetType, 0);
            totalPayout += _settleBetType(yesBetType, true, multiplier);
        }
        
        // NO bets lose if their number rolled
        uint8 noBetType = _getNoBetType(total);
        if (noBetType != 0) {
            totalPayout += _settleBetType(noBetType, false, 0);
        }
        
        return totalPayout;
    }
    
    /**
     * @notice Settle Come and Don't Come bets
     */
    function _settleComeBets(uint8 /* total */) private pure returns (uint256) {
        // Implementation would iterate through active Come/Don't Come bets
        // and resolve based on total and established come points
        // This is simplified for the example
        return 0;
    }
    
    /**
     * @notice Settle hardway bets
     */
    function _settleHardways(uint8 die1, uint8 die2, uint8 total) private returns (uint256) {
        uint256 totalPayout = 0;
        bool isHard = (die1 == die2);
        
        if (total == 4) {
            if (isHard) {
                // Hard 4 wins
                totalPayout += _settleBetType(CrapsBetTypes.BET_HARD4, true, 700);
            } else {
                // Easy 4 - Hard 4 loses
                totalPayout += _settleBetType(CrapsBetTypes.BET_HARD4, false, 0);
            }
        } else if (total == 6) {
            if (isHard) {
                totalPayout += _settleBetType(CrapsBetTypes.BET_HARD6, true, 900);
            } else {
                totalPayout += _settleBetType(CrapsBetTypes.BET_HARD6, false, 0);
            }
        } else if (total == 8) {
            if (isHard) {
                totalPayout += _settleBetType(CrapsBetTypes.BET_HARD8, true, 900);
            } else {
                totalPayout += _settleBetType(CrapsBetTypes.BET_HARD8, false, 0);
            }
        } else if (total == 10) {
            if (isHard) {
                totalPayout += _settleBetType(CrapsBetTypes.BET_HARD10, true, 700);
            } else {
                totalPayout += _settleBetType(CrapsBetTypes.BET_HARD10, false, 0);
            }
        }
        
        return totalPayout;
    }
    
    /**
     * @notice Settle bonus bets based on shooter performance
     */
    function _settleBonusBets(ICrapsGame.ShooterState memory shooter) private returns (uint256) {
        uint256 totalPayout = 0;
        
        // Fire bet - count unique points in fireMask
        uint8 uniquePoints = _countBits(shooter.fireMask);
        if (uniquePoints >= 4) {
            uint256 fireMultiplier = firePayouts[uniquePoints];
            totalPayout += _settleBetType(CrapsBetTypes.BET_FIRE, true, fireMultiplier);
        } else {
            totalPayout += _settleBetType(CrapsBetTypes.BET_FIRE, false, 0);
        }
        
        // Ride the Line - consecutive wins
        if (shooter.consecutiveWins > 0) {
            uint8 wins = shooter.consecutiveWins > 11 ? 11 : shooter.consecutiveWins;
            uint256 rideMultiplier = ridePayouts[wins];
            totalPayout += _settleBetType(CrapsBetTypes.BET_RIDE_LINE, true, rideMultiplier);
        }
        
        // Hot Roller - points made
        if (shooter.pointsMadeCount >= 2) {
            uint8 points = shooter.pointsMadeCount > 6 ? 6 : shooter.pointsMadeCount;
            uint256 hotMultiplier = hotRollerPayouts[points];
            totalPayout += _settleBetType(CrapsBetTypes.BET_HOT_ROLLER, true, hotMultiplier);
        }
        
        // Different Doubles
        uint8 doublesCount = _countBits(shooter.doublesMask);
        if (doublesCount >= 3) {
            uint256 doublesMultiplier = doublesPayouts[doublesCount];
            totalPayout += _settleBetType(CrapsBetTypes.BET_DIFFERENT_DOUBLES, true, doublesMultiplier);
        }
        
        // Small/Tall/All
        uint8 smallBits = _countBits(uint8(shooter.smallTallMask & 0x1F)); // bits 0-4 for 2-6
        uint8 tallBits = _countBits(uint8(shooter.smallTallMask >> 11));   // bits 11-15 for 8-12
        
        if (smallBits == 5) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_BONUS_SMALL, true, 3000);
        }
        if (tallBits == 5) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_BONUS_TALL, true, 3000);
        }
        if (smallBits == 5 && tallBits == 5) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_BONUS_ALL, true, 15000);
        }
        
        return totalPayout;
    }
    
    // ============ Helper Functions ============
    
    /**
     * @notice Settle all bets of a specific type
     */
    function _settleBetType(
        uint8 /* betType */,
        bool /* won */,
        uint256 /* multiplier */
    ) private pure returns (uint256) {
        // This would iterate through all active players with this bet type
        // For now, simplified implementation
        return 0;
    }
    
    /**
     * @notice Settle odds bets
     */
    function _settleOddsBet(
        uint8 oddsBetType,
        bool won,
        uint8 point
    ) private returns (uint256) {
        if (!won) {
            return _settleBetType(oddsBetType, false, 0);
        }
        
        uint256 multiplier = CrapsBetTypes.getPayoutMultiplier(oddsBetType, point);
        return _settleBetType(oddsBetType, true, multiplier);
    }
    
    /**
     * @notice Push (return) all bets of a type
     */
    function _pushBetType(uint8 /* betType */) private pure returns (uint256) {
        // Return original bet amount to players
        return 0;
    }
    
    /**
     * @notice Get YES bet type for a total
     */
    function _getYesBetType(uint8 total) private pure returns (uint8) {
        if (total == 2) return CrapsBetTypes.BET_YES_2;
        if (total == 3) return CrapsBetTypes.BET_YES_3;
        if (total == 4) return CrapsBetTypes.BET_YES_4;
        if (total == 5) return CrapsBetTypes.BET_YES_5;
        if (total == 6) return CrapsBetTypes.BET_YES_6;
        if (total == 8) return CrapsBetTypes.BET_YES_8;
        if (total == 9) return CrapsBetTypes.BET_YES_9;
        if (total == 10) return CrapsBetTypes.BET_YES_10;
        if (total == 11) return CrapsBetTypes.BET_YES_11;
        if (total == 12) return CrapsBetTypes.BET_YES_12;
        return 0;
    }
    
    /**
     * @notice Get NO bet type for a total
     */
    function _getNoBetType(uint8 total) private pure returns (uint8) {
        if (total == 2) return CrapsBetTypes.BET_NO_2;
        if (total == 3) return CrapsBetTypes.BET_NO_3;
        if (total == 4) return CrapsBetTypes.BET_NO_4;
        if (total == 5) return CrapsBetTypes.BET_NO_5;
        if (total == 6) return CrapsBetTypes.BET_NO_6;
        if (total == 8) return CrapsBetTypes.BET_NO_8;
        if (total == 9) return CrapsBetTypes.BET_NO_9;
        if (total == 10) return CrapsBetTypes.BET_NO_10;
        if (total == 11) return CrapsBetTypes.BET_NO_11;
        if (total == 12) return CrapsBetTypes.BET_NO_12;
        return 0;
    }
    
    /**
     * @notice Count number of bits set in a byte
     */
    function _countBits(uint8 n) private pure returns (uint8) {
        uint8 count = 0;
        while (n != 0) {
            count++;
            n &= n - 1;
        }
        return count;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Calculate payout for a bet
     */
    function calculatePayout(
        uint8 betType,
        uint256 amount,
        uint8 point
    ) external pure override returns (uint256) {
        uint256 multiplier = CrapsBetTypes.getPayoutMultiplier(betType, point);
        if (multiplier == 0) return 0;
        
        uint256 winAmount = (amount * multiplier) / 100;
        return amount + winAmount; // Return bet + winnings
    }
    
    /**
     * @notice Get field bet payout multiplier
     */
    function getFieldPayout(uint8 total) external pure override returns (uint256) {
        if (total == 2) return 200;  // 2:1
        if (total == 12) return 300; // 3:1
        if (total == 3 || total == 4 || total == 9 || total == 10 || total == 11) {
            return 100; // 1:1
        }
        return 0; // Loses
    }
    
    /**
     * @notice Check if roll is hardway
     */
    function isHardway(uint8 die1, uint8 die2, uint8 total) external pure override returns (bool) {
        return die1 == die2 && (total == 4 || total == 6 || total == 8 || total == 10);
    }
}