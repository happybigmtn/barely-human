// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ICrapsGame.sol";
import "./CrapsBetTypes.sol";
import "../libraries/SettlementLib.sol";
import "../libraries/BonusSettlementLib.sol";

/**
 * @title CrapsSettlementOptimized
 * @notice Optimized settlement contract using libraries
 */
contract CrapsSettlementOptimized is ICrapsSettlement, AccessControl, ReentrancyGuard {
    using CrapsBetTypes for uint8;
    using BonusSettlementLib for ICrapsGame.ShooterState;

    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    event BetSettled(
        address indexed player,
        uint256 indexed seriesId,
        uint256 rollNumber,
        uint8 betType,
        uint256 amount,
        uint256 payout,
        bool won
    );
    
    event BetPushed(
        address indexed player,
        uint256 indexed seriesId,
        uint256 rollNumber,
        uint8 betType,
        uint256 amount
    );

    ICrapsGame public gameContract;
    ICrapsBets public betsContract;
    ICrapsVault public vaultContract;

    uint256 public currentSeriesId;
    uint256 public currentRollNumber;
    uint8 public lastDie1;
    uint8 public lastDie2;
    uint8 public lastTotal;

    mapping(uint256 => uint256) public seriesTotalPayouts;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    function setContracts(
        address _gameContract,
        address _betsContract,
        address _vaultContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_gameContract != address(0), "Invalid game");
        require(_betsContract != address(0), "Invalid bets");
        require(_vaultContract != address(0), "Invalid vault");

        gameContract = ICrapsGame(_gameContract);
        betsContract = ICrapsBets(_betsContract);
        vaultContract = ICrapsVault(_vaultContract);

        _grantRole(GAME_ROLE, _gameContract);
    }

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

        totalPayout += _settleOneRollBets(lastTotal);

        uint256 seriesId = gameContract.getSeriesId();
        seriesTotalPayouts[seriesId] += totalPayout;

        emit BatchSettlement(seriesId, currentRollNumber, lastTotal, totalPayout);

        return totalPayout;
    }

    function settleComeOutRoll(
        uint8 total
    ) public override onlyRole(GAME_ROLE) returns (uint256) {
        uint256 totalPayout = 0;

        if (total == 7 || total == 11) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, true, 100);
            totalPayout += _settleBetType(CrapsBetTypes.BET_DONT_PASS, false, 0);
        } else if (total == 2 || total == 3) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, false, 0);
            totalPayout += _settleBetType(CrapsBetTypes.BET_DONT_PASS, true, 100);
        } else if (total == 12) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, false, 0);
            totalPayout += _pushBetType(CrapsBetTypes.BET_DONT_PASS);
        }

        return totalPayout;
    }

    function settlePointRoll(
        uint8 total,
        uint8 point
    ) public override onlyRole(GAME_ROLE) returns (uint256) {
        uint256 totalPayout = 0;

        if (total == point) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, true, 100);
            totalPayout += _settleBetType(CrapsBetTypes.BET_DONT_PASS, false, 0);
            totalPayout += _settleOddsBet(CrapsBetTypes.BET_ODDS_PASS, true, point);
            totalPayout += _settleOddsBet(CrapsBetTypes.BET_ODDS_DONT_PASS, false, point);
        } else if (total == 7) {
            return 0; // Handled by settleSevenOut
        } else {
            totalPayout += _settlePlaceBets(total);
            totalPayout += _settleHardways(lastDie1, lastDie2, total);
        }

        return totalPayout;
    }

    function settleSevenOut() external override onlyRole(GAME_ROLE) returns (uint256) {
        uint256 totalPayout = 0;
        ICrapsGame.ShooterState memory shooter = gameContract.getCurrentShooter();

        totalPayout += _settleBetType(CrapsBetTypes.BET_PASS, false, 0);
        totalPayout += _settleBetType(CrapsBetTypes.BET_DONT_PASS, true, 100);
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

        // Settle bonus bets
        totalPayout += _settleBonusBets(shooter);

        return totalPayout;
    }

    function _settleOneRollBets(uint8 total) private returns (uint256) {
        uint256 totalPayout = 0;

        // Field bet
        if (SettlementLib.isFieldWinner(total)) {
            uint256 fieldMultiplier = SettlementLib.getFieldMultiplier(total);
            totalPayout += _settleBetType(CrapsBetTypes.BET_FIELD, true, fieldMultiplier);
        } else {
            totalPayout += _settleBetType(CrapsBetTypes.BET_FIELD, false, 0);
        }

        // NEXT bets
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

    function _settlePlaceBets(uint8 total) private returns (uint256) {
        uint256 totalPayout = 0;

        uint8 yesBetType = SettlementLib.getYesBetType(total);
        if (yesBetType != 0) {
            uint256 multiplier = CrapsBetTypes.getPayoutMultiplier(yesBetType, 0);
            totalPayout += _settleBetType(yesBetType, true, multiplier);
        }

        uint8 noBetType = SettlementLib.getNoBetType(total);
        if (noBetType != 0) {
            totalPayout += _settleBetType(noBetType, false, 0);
        }

        return totalPayout;
    }

    function _settleHardways(uint8 die1, uint8 die2, uint8 total) private returns (uint256) {
        uint256 totalPayout = 0;
        bool isHard = (die1 == die2);

        if (total == 4) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_HARD4, isHard, isHard ? 700 : 0);
        } else if (total == 6) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_HARD6, isHard, isHard ? 900 : 0);
        } else if (total == 8) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_HARD8, isHard, isHard ? 900 : 0);
        } else if (total == 10) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_HARD10, isHard, isHard ? 700 : 0);
        }

        return totalPayout;
    }

    function _settleBonusBets(ICrapsGame.ShooterState memory shooter) private returns (uint256) {
        uint256 totalPayout = 0;

        // Fire bet
        (bool fireWon, uint256 fireMultiplier) = shooter.processFireBet();
        totalPayout += _settleBetType(CrapsBetTypes.BET_FIRE, fireWon, fireMultiplier);

        // Ride the Line
        (bool rideWon, uint256 rideMultiplier) = shooter.processRideBet();
        totalPayout += _settleBetType(CrapsBetTypes.BET_RIDE_LINE, rideWon, rideMultiplier);

        // Hot Roller
        (bool hotWon, uint256 hotMultiplier) = shooter.processHotRollerBet();
        totalPayout += _settleBetType(CrapsBetTypes.BET_HOT_ROLLER, hotWon, hotMultiplier);

        // Different Doubles
        (bool doublesWon, uint256 doublesMultiplier) = shooter.processDoublesBet();
        totalPayout += _settleBetType(CrapsBetTypes.BET_DIFFERENT_DOUBLES, doublesWon, doublesMultiplier);

        // Small/Tall/All
        (bool smallWon, bool tallWon, bool allWon) = shooter.processSmallTallBets();
        if (smallWon) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_BONUS_SMALL, true, 3000);
        }
        if (tallWon) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_BONUS_TALL, true, 3000);
        }
        if (allWon) {
            totalPayout += _settleBetType(CrapsBetTypes.BET_BONUS_ALL, true, 15000);
        }

        return totalPayout;
    }

    function _settleBetType(uint8 betType, bool won, uint256 multiplier) internal returns (uint256) {
        uint256 totalPayout;
        address[] memory vaults = vaultContract.getActiveBotVaults();
        
        for (uint256 i; i < vaults.length && i < 10; ++i) {
            if (vaults[i] == address(0)) continue;
            
            if (betsContract.hasActiveBet(vaults[i], betType)) {
                ICrapsBets.Bet memory bet = betsContract.getBet(vaults[i], betType);
                uint256 payout;
                
                if (won) {
                    payout = bet.amount + (bet.amount * multiplier) / 100;
                    totalPayout += payout;
                    vaultContract.processPayout(vaults[i], payout);
                }
                
                emit BetSettled(vaults[i], currentSeriesId, currentRollNumber, 
                               betType, bet.amount, payout, won);
                
                betsContract.clearBet(vaults[i], betType);
            }
        }
        
        return totalPayout;
    }

    function _settleOddsBet(uint8 oddsBetType, bool won, uint8 point) private returns (uint256) {
        if (!won) {
            return _settleBetType(oddsBetType, false, 0);
        }
        uint256 multiplier = CrapsBetTypes.getPayoutMultiplier(oddsBetType, point);
        return _settleBetType(oddsBetType, true, multiplier);
    }

    function _pushBetType(uint8 betType) internal returns (uint256) {
        uint256 totalReturned;
        address[] memory vaults = vaultContract.getActiveBotVaults();
        
        for (uint256 i; i < vaults.length && i < 10; ++i) {
            if (vaults[i] == address(0)) continue;
            
            if (betsContract.hasActiveBet(vaults[i], betType)) {
                ICrapsBets.Bet memory bet = betsContract.getBet(vaults[i], betType);
                totalReturned += bet.amount;
                vaultContract.processPayout(vaults[i], bet.amount);
                
                emit BetPushed(vaults[i], currentSeriesId, currentRollNumber, 
                              betType, bet.amount);
                
                betsContract.clearBet(vaults[i], betType);
            }
        }
        
        return totalReturned;
    }

    function calculatePayout(uint8 betType, uint256 amount, uint8 point) external pure override returns (uint256) {
        uint256 multiplier = CrapsBetTypes.getPayoutMultiplier(betType, point);
        if (multiplier == 0) return 0;
        uint256 winAmount = (amount * multiplier) / 100;
        return amount + winAmount;
    }

    function getFieldPayout(uint8 total) external pure override returns (uint256) {
        return SettlementLib.getFieldMultiplier(total);
    }

    function isHardway(uint8 die1, uint8 die2, uint8 total) external pure override returns (bool) {
        return die1 == die2 && (total == 4 || total == 6 || total == 8 || total == 10);
    }
}