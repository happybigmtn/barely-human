// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../game/ICrapsGame.sol";
import "../game/CrapsBetTypes.sol";

/**
 * @title SettlementLib
 * @notice Library for settlement calculations to reduce contract size
 */
library SettlementLib {
    /**
     * @notice Count bits set in a uint8
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
     * @notice Get YES bet type for a total
     */
    function getYesBetType(uint8 total) internal pure returns (uint8) {
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
    function getNoBetType(uint8 total) internal pure returns (uint8) {
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
     * @notice Calculate small/tall bits for bonus bets
     */
    function calculateSmallTallBits(uint16 mask) internal pure returns (uint8 smallBits, uint8 tallBits) {
        smallBits = countBits(uint8(mask & 0x1F)); // bits 0-4 for 2-6
        tallBits = countBits(uint8(mask >> 11)); // bits 11-15 for 8-12
    }
    
    /**
     * @notice Determine field bet multiplier
     */
    function getFieldMultiplier(uint8 total) internal pure returns (uint256) {
        if (total == 2) return 200; // 2:1
        if (total == 12) return 300; // 3:1
        if (total == 3 || total == 4 || total == 9 || total == 10 || total == 11) {
            return 100; // 1:1
        }
        return 0; // Loss
    }
    
    /**
     * @notice Check if field bet wins
     */
    function isFieldWinner(uint8 total) internal pure returns (bool) {
        return total == 2 || total == 3 || total == 4 || 
               total == 9 || total == 10 || total == 11 || total == 12;
    }
    
    /**
     * @notice Get hardway payout multiplier
     */
    function getHardwayMultiplier(uint8 total) internal pure returns (uint256) {
        if (total == 4 || total == 10) return 700; // 7:1
        if (total == 6 || total == 8) return 900; // 9:1
        return 0;
    }
}