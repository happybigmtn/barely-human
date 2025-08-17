// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../game/ICrapsGame.sol";

/**
 * @title BonusSettlementLib
 * @notice Library for settling bonus bets
 */
library BonusSettlementLib {
    
    /**
     * @notice Count number of bits set in a byte
     */
    function countBits(uint8 n) internal pure returns (uint8) {
        uint8 count = 0;
        while (n != 0) {
            count++;
            n &= n - 1;
        }
        return count;
    }
    
    /**
     * @notice Calculate Fire bet payout based on unique points
     */
    function getFirePayout(uint8 uniquePoints) internal pure returns (uint256) {
        if (uniquePoints == 4) return 3900; // 39:1
        if (uniquePoints == 5) return 24900; // 249:1
        if (uniquePoints == 6) return 99900; // 999:1
        return 0;
    }
    
    /**
     * @notice Calculate Ride the Line payout
     */
    function getRidePayout(uint8 wins) internal pure returns (uint256) {
        if (wins == 3) return 100; // 1:1
        if (wins == 4) return 200; // 2:1
        if (wins == 5) return 300; // 3:1
        if (wins == 6) return 400; // 4:1
        if (wins == 7) return 1000; // 10:1
        if (wins == 8) return 1500; // 15:1
        if (wins == 9) return 2000; // 20:1
        if (wins == 10) return 10000; // 100:1
        if (wins >= 11) return 15000; // 150:1
        return 0;
    }
    
    /**
     * @notice Calculate Hot Roller payout
     */
    function getHotRollerPayout(uint8 points) internal pure returns (uint256) {
        if (points == 2) return 500; // 5:1
        if (points == 3) return 1000; // 10:1
        if (points == 4) return 2000; // 20:1
        if (points == 5) return 5000; // 50:1
        if (points >= 6) return 30000; // 300:1
        return 0;
    }
    
    /**
     * @notice Calculate Different Doubles payout
     */
    function getDoublesPayout(uint8 doublesCount) internal pure returns (uint256) {
        if (doublesCount == 3) return 400; // 4:1
        if (doublesCount == 4) return 800; // 8:1
        if (doublesCount == 5) return 3000; // 30:1
        if (doublesCount >= 6) return 25000; // 250:1
        return 0;
    }
    
    /**
     * @notice Process Fire bet
     */
    function processFireBet(ICrapsGame.ShooterState memory shooter) 
        internal 
        pure 
        returns (bool won, uint256 multiplier) 
    {
        uint8 uniquePoints = countBits(shooter.fireMask);
        if (uniquePoints >= 4) {
            return (true, getFirePayout(uniquePoints));
        }
        return (false, 0);
    }
    
    /**
     * @notice Process Ride the Line bet
     */
    function processRideBet(ICrapsGame.ShooterState memory shooter)
        internal
        pure
        returns (bool won, uint256 multiplier)
    {
        if (shooter.consecutiveWins > 0) {
            uint8 wins = shooter.consecutiveWins > 11 ? 11 : shooter.consecutiveWins;
            return (true, getRidePayout(wins));
        }
        return (false, 0);
    }
    
    /**
     * @notice Process Hot Roller bet
     */
    function processHotRollerBet(ICrapsGame.ShooterState memory shooter)
        internal
        pure
        returns (bool won, uint256 multiplier)
    {
        if (shooter.pointsMadeCount >= 2) {
            uint8 points = shooter.pointsMadeCount > 6 ? 6 : shooter.pointsMadeCount;
            return (true, getHotRollerPayout(points));
        }
        return (false, 0);
    }
    
    /**
     * @notice Process Different Doubles bet
     */
    function processDoublesBet(ICrapsGame.ShooterState memory shooter)
        internal
        pure
        returns (bool won, uint256 multiplier)
    {
        uint8 doublesCount = countBits(shooter.doublesMask);
        if (doublesCount >= 3) {
            return (true, getDoublesPayout(doublesCount));
        }
        return (false, 0);
    }
    
    /**
     * @notice Process Small/Tall/All bets
     */
    function processSmallTallBets(ICrapsGame.ShooterState memory shooter)
        internal
        pure
        returns (bool smallWon, bool tallWon, bool allWon)
    {
        uint8 smallBits = countBits(uint8(shooter.smallTallMask & 0x1F)); // bits 0-4 for 2-6
        uint8 tallBits = countBits(uint8(shooter.smallTallMask >> 11)); // bits 11-15 for 8-12
        
        smallWon = (smallBits == 5);
        tallWon = (tallBits == 5);
        allWon = (smallBits == 5 && tallBits == 5);
    }
}
