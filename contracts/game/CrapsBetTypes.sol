// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title CrapsBetTypes
 * @notice Defines all 64 bet types supported in the Barely Human craps game
 * @dev Based on ton-craps implementation with complete casino bet coverage
 */
library CrapsBetTypes {
    // Core Line Bets (0-3)
    uint8 constant BET_PASS = 0;           // Pass Line
    uint8 constant BET_DONT_PASS = 1;      // Don't Pass
    uint8 constant BET_COME = 2;           // Come
    uint8 constant BET_DONT_COME = 3;      // Don't Come
    
    // Field Bet (4)
    uint8 constant BET_FIELD = 4;          // Field (2,3,4,9,10,11,12)
    
    // YES Bets - Number Before 7 (5-14)
    uint8 constant BET_YES_2 = 5;
    uint8 constant BET_YES_3 = 6;
    uint8 constant BET_YES_4 = 7;
    uint8 constant BET_YES_5 = 8;
    uint8 constant BET_YES_6 = 9;
    uint8 constant BET_YES_8 = 10;
    uint8 constant BET_YES_9 = 11;
    uint8 constant BET_YES_10 = 12;
    uint8 constant BET_YES_11 = 13;
    uint8 constant BET_YES_12 = 14;
    
    // NO Bets - 7 Before Number (15-24)
    uint8 constant BET_NO_2 = 15;
    uint8 constant BET_NO_3 = 16;
    uint8 constant BET_NO_4 = 17;
    uint8 constant BET_NO_5 = 18;
    uint8 constant BET_NO_6 = 19;
    uint8 constant BET_NO_8 = 20;
    uint8 constant BET_NO_9 = 21;
    uint8 constant BET_NO_10 = 22;
    uint8 constant BET_NO_11 = 23;
    uint8 constant BET_NO_12 = 24;
    
    // Hardways Bets (25-28)
    uint8 constant BET_HARD4 = 25;         // Hard 4 (2+2)
    uint8 constant BET_HARD6 = 26;         // Hard 6 (3+3)
    uint8 constant BET_HARD8 = 27;         // Hard 8 (4+4)
    uint8 constant BET_HARD10 = 28;        // Hard 10 (5+5)
    
    // Odds Bets (29-32)
    uint8 constant BET_ODDS_PASS = 29;
    uint8 constant BET_ODDS_DONT_PASS = 30;
    uint8 constant BET_ODDS_COME = 31;
    uint8 constant BET_ODDS_DONT_COME = 32;
    
    // Special/Bonus Bets (33-42)
    uint8 constant BET_HOT_ROLLER = 33;         // Progressive streak
    uint8 constant BET_FIRE = 34;               // 4-6 unique points
    uint8 constant BET_TWICE_HARD = 35;         // Same hardway twice
    uint8 constant BET_RIDE_LINE = 36;          // Pass line win streak
    uint8 constant BET_MUGGSY = 37;             // 7 on comeout or point-7
    uint8 constant BET_BONUS_SMALL = 38;        // All 2-6 before 7
    uint8 constant BET_BONUS_TALL = 39;         // All 8-12 before 7
    uint8 constant BET_BONUS_ALL = 40;          // All numbers except 7
    uint8 constant BET_REPLAY = 41;             // Same point 3+ times
    uint8 constant BET_DIFFERENT_DOUBLES = 42;  // Unique doubles before 7
    
    // NEXT Bets - One-Roll Proposition (43-53)
    uint8 constant BET_NEXT_2 = 43;
    uint8 constant BET_NEXT_3 = 44;
    uint8 constant BET_NEXT_4 = 45;
    uint8 constant BET_NEXT_5 = 46;
    uint8 constant BET_NEXT_6 = 47;
    uint8 constant BET_NEXT_7 = 48;
    uint8 constant BET_NEXT_8 = 49;
    uint8 constant BET_NEXT_9 = 50;
    uint8 constant BET_NEXT_10 = 51;
    uint8 constant BET_NEXT_11 = 52;
    uint8 constant BET_NEXT_12 = 53;
    
    // Repeater Bets (54-63)
    uint8 constant BET_REPEATER_2 = 54;     // 2 must appear 2 times
    uint8 constant BET_REPEATER_3 = 55;     // 3 must appear 3 times
    uint8 constant BET_REPEATER_4 = 56;     // 4 must appear 4 times
    uint8 constant BET_REPEATER_5 = 57;     // 5 must appear 5 times
    uint8 constant BET_REPEATER_6 = 58;     // 6 must appear 6 times
    uint8 constant BET_REPEATER_8 = 59;     // 8 must appear 6 times
    uint8 constant BET_REPEATER_9 = 60;     // 9 must appear 5 times
    uint8 constant BET_REPEATER_10 = 61;    // 10 must appear 4 times
    uint8 constant BET_REPEATER_11 = 62;    // 11 must appear 3 times
    uint8 constant BET_REPEATER_12 = 63;    // 12 must appear 2 times
    
    /**
     * @notice Get payout multiplier for a bet type
     * @param betType The type of bet
     * @param point Current point (for odds bets)
     * @return multiplier Payout multiplier in basis points (100 = 1:1)
     */
    function getPayoutMultiplier(uint8 betType, uint8 point) internal pure returns (uint256) {
        // Pass/Don't Pass/Come/Don't Come
        if (betType <= 3) return 100; // 1:1
        
        // Field bet
        if (betType == BET_FIELD) return 100; // 1:1 (except 2 and 12)
        
        // YES bets (2% house edge from true odds)
        if (betType == BET_YES_2) return 588;  // 5.88:1
        if (betType == BET_YES_3) return 294;  // 2.94:1
        if (betType == BET_YES_4) return 196;  // 1.96:1
        if (betType == BET_YES_5) return 147;  // 1.47:1
        if (betType == BET_YES_6) return 118;  // 1.18:1
        if (betType == BET_YES_8) return 118;  // 1.18:1
        if (betType == BET_YES_9) return 147;  // 1.47:1
        if (betType == BET_YES_10) return 196; // 1.96:1
        if (betType == BET_YES_11) return 294; // 2.94:1
        if (betType == BET_YES_12) return 588; // 5.88:1
        
        // NO bets (2% house edge from true odds)
        if (betType == BET_NO_2) return 16;   // 0.16:1
        if (betType == BET_NO_3) return 33;   // 0.33:1
        if (betType == BET_NO_4) return 49;   // 0.49:1
        if (betType == BET_NO_5) return 65;   // 0.65:1
        if (betType == BET_NO_6) return 82;   // 0.82:1
        if (betType == BET_NO_8) return 82;   // 0.82:1
        if (betType == BET_NO_9) return 65;   // 0.65:1
        if (betType == BET_NO_10) return 49;  // 0.49:1
        if (betType == BET_NO_11) return 33;  // 0.33:1
        if (betType == BET_NO_12) return 16;  // 0.16:1
        
        // Hardways
        if (betType == BET_HARD4 || betType == BET_HARD10) return 700;  // 7:1
        if (betType == BET_HARD6 || betType == BET_HARD8) return 900;   // 9:1
        
        // Odds bets (true odds, no house edge)
        if (betType == BET_ODDS_PASS || betType == BET_ODDS_COME) {
            if (point == 4 || point == 10) return 200;  // 2:1
            if (point == 5 || point == 9) return 150;   // 3:2
            if (point == 6 || point == 8) return 120;   // 6:5
        }
        if (betType == BET_ODDS_DONT_PASS || betType == BET_ODDS_DONT_COME) {
            if (point == 4 || point == 10) return 50;   // 1:2
            if (point == 5 || point == 9) return 67;    // 2:3
            if (point == 6 || point == 8) return 83;    // 5:6
        }
        
        // Bonus bets
        if (betType == BET_FIRE) return 0; // Variable based on points made
        if (betType == BET_TWICE_HARD) return 600;          // 6:1
        if (betType == BET_RIDE_LINE) return 0;             // Variable based on streak
        if (betType == BET_MUGGSY) return 200;              // 2:1 or 3:1
        if (betType == BET_BONUS_SMALL) return 3000;        // 30:1
        if (betType == BET_BONUS_TALL) return 3000;         // 30:1
        if (betType == BET_BONUS_ALL) return 15000;         // 150:1
        if (betType == BET_REPLAY) return 0;                // Variable
        if (betType == BET_DIFFERENT_DOUBLES) return 0;     // Variable
        
        // NEXT bets (98% of true odds)
        if (betType == BET_NEXT_2) return 3430;   // 34.3:1
        if (betType == BET_NEXT_3) return 1666;   // 16.66:1
        if (betType == BET_NEXT_4) return 1078;   // 10.78:1
        if (betType == BET_NEXT_5) return 784;    // 7.84:1
        if (betType == BET_NEXT_6) return 608;    // 6.08:1
        if (betType == BET_NEXT_7) return 490;    // 4.9:1
        if (betType == BET_NEXT_8) return 608;    // 6.08:1
        if (betType == BET_NEXT_9) return 784;    // 7.84:1
        if (betType == BET_NEXT_10) return 1078;  // 10.78:1
        if (betType == BET_NEXT_11) return 1666;  // 16.66:1
        if (betType == BET_NEXT_12) return 3430;  // 34.3:1
        
        // Repeater bets
        if (betType == BET_REPEATER_2 || betType == BET_REPEATER_12) return 4000;  // 40:1
        if (betType == BET_REPEATER_3 || betType == BET_REPEATER_11) return 5000;  // 50:1
        if (betType == BET_REPEATER_4 || betType == BET_REPEATER_10) return 6500;  // 65:1
        if (betType == BET_REPEATER_5 || betType == BET_REPEATER_9) return 8000;   // 80:1
        if (betType == BET_REPEATER_6 || betType == BET_REPEATER_8) return 9000;   // 90:1
        
        return 0; // Invalid bet type
    }
}