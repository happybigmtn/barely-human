// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../game/ICrapsGame.sol";
import "../game/CrapsBetTypes.sol";

/**
 * @title CrapsSettlementLib
 * @notice Library for all craps settlement calculations
 * @dev Extracted from CrapsSettlement to reduce contract size
 */
library CrapsSettlementLib {
    using CrapsBetTypes for uint8;

    struct SettlementData {
        uint256 seriesId;
        uint256 rollNumber;
        uint8 die1;
        uint8 die2;
        uint8 total;
        ICrapsGame.Phase phase;
        uint8 point;
    }

    /**
     * @notice Calculate payout for a winning bet
     * @param betType The type of bet
     * @param amount The bet amount
     * @param data Settlement data including roll and game state
     * @return payout The amount to pay out (0 if loss)
     */
    function calculatePayout(
        uint8 betType,
        uint256 amount,
        SettlementData memory data
    ) internal pure returns (uint256) {
        // Pass Line (0)
        if (betType == 0) {
            if (data.phase == ICrapsGame.Phase.COME_OUT) {
                if (data.total == 7 || data.total == 11) return amount * 2;
                if (data.total == 2 || data.total == 3 || data.total == 12) return 0;
            } else if (data.phase == ICrapsGame.Phase.POINT) {
                if (data.total == data.point) return amount * 2;
                if (data.total == 7) return 0;
            }
            return amount; // Push
        }

        // Don't Pass Line (1)
        if (betType == 1) {
            if (data.phase == ICrapsGame.Phase.COME_OUT) {
                if (data.total == 2 || data.total == 3) return amount * 2;
                if (data.total == 7 || data.total == 11) return 0;
                if (data.total == 12) return amount; // Push
            } else if (data.phase == ICrapsGame.Phase.POINT) {
                if (data.total == 7) return amount * 2;
                if (data.total == data.point) return 0;
            }
            return amount; // Push
        }

        // Field bet (4)
        if (betType == 4) {
            if (data.total == 2) return amount * 3; // 2:1
            if (data.total == 12) return amount * 4; // 3:1
            if (data.total == 3 || data.total == 4 || data.total == 9 || data.total == 10 || data.total == 11) {
                return amount * 2; // 1:1
            }
            return 0;
        }

        // YES bets (5-24)
        if (betType >= 5 && betType <= 24) {
            uint8 yesNumber = betType - 4;
            if (data.total == yesNumber) {
                return amount + (amount * getYesPayout(yesNumber)) / 100;
            }
            return 0;
        }

        // NO bets (25-28) - Hardways
        if (betType >= 25 && betType <= 28) {
            return calculateHardwayPayout(betType, amount, data);
        }

        // True Odds bets (29-32)
        if (betType >= 29 && betType <= 32) {
            return calculateOddsPayout(betType, amount, data);
        }

        // Bonus bets (33-42)
        if (betType >= 33 && betType <= 42) {
            return calculateBonusPayout(betType, amount, data);
        }

        // NEXT bets (43-53) - One roll propositions
        if (betType >= 43 && betType <= 53) {
            return calculateNextPayout(betType, amount, data);
        }

        // Repeater bets (54-63)
        if (betType >= 54 && betType <= 63) {
            return calculateRepeaterPayout(betType, amount, data);
        }

        return 0;
    }

    function getYesPayout(uint8 number) private pure returns (uint256) {
        if (number == 2 || number == 12) return 3100; // 31:1
        if (number == 3 || number == 11) return 1600; // 16:1
        if (number == 4 || number == 10) return 800; // 8:1
        if (number == 5 || number == 9) return 500; // 5:1
        if (number == 6 || number == 8) return 600; // 6:1
        if (number == 7) return 450; // 4.5:1
        return 0;
    }

    function calculateHardwayPayout(
        uint8 betType,
        uint256 amount,
        SettlementData memory data
    ) private pure returns (uint256) {
        uint8 hardNumber = ((betType - 25) + 2) * 2; // 4, 6, 8, 10
        
        if (data.total == hardNumber && data.die1 == data.die2) {
            if (hardNumber == 4 || hardNumber == 10) {
                return amount * 8; // 7:1
            } else {
                return amount * 10; // 9:1
            }
        }
        
        if (data.total == 7 || (data.total == hardNumber && data.die1 != data.die2)) {
            return 0;
        }
        
        return amount; // Still active
    }

    function calculateOddsPayout(
        uint8 betType,
        uint256 amount,
        SettlementData memory data
    ) private pure returns (uint256) {
        if (betType == 29 || betType == 31) { // Pass/Come odds
            if (data.total == data.point) {
                if (data.point == 4 || data.point == 10) return amount + (amount * 2);
                if (data.point == 5 || data.point == 9) return amount + (amount * 3) / 2;
                if (data.point == 6 || data.point == 8) return amount + (amount * 6) / 5;
            }
            if (data.total == 7) return 0;
        }
        
        if (betType == 30 || betType == 32) { // Don't Pass/Don't Come odds
            if (data.total == 7) {
                if (data.point == 4 || data.point == 10) return amount + amount / 2;
                if (data.point == 5 || data.point == 9) return amount + (amount * 2) / 3;
                if (data.point == 6 || data.point == 8) return amount + (amount * 5) / 6;
            }
            if (data.total == data.point) return 0;
        }
        
        return amount; // Still active
    }

    function calculateBonusPayout(
        uint8 betType,
        uint256 amount,
        SettlementData memory data
    ) private pure returns (uint256) {
        // Simplified bonus calculation
        // In production, would track state across multiple rolls
        return amount; // Placeholder - needs state tracking
    }

    function calculateNextPayout(
        uint8 betType,
        uint256 amount,
        SettlementData memory data
    ) private pure returns (uint256) {
        uint8 nextType = betType - 43;
        
        // Any Seven (0)
        if (nextType == 0 && data.total == 7) return amount * 5;
        
        // Any Craps (1)
        if (nextType == 1 && (data.total == 2 || data.total == 3 || data.total == 12)) {
            return amount * 8;
        }
        
        // Specific numbers (2-10 map to 2,3,4,5,6,8,9,10,11,12)
        if (nextType >= 2) {
            uint8 targetNumber = nextType;
            if (nextType >= 7) targetNumber++; // Skip 7
            
            if (data.total == targetNumber) {
                return amount + (amount * getYesPayout(targetNumber)) / 100;
            }
        }
        
        return 0;
    }

    function calculateRepeaterPayout(
        uint8 betType,
        uint256 amount,
        SettlementData memory data
    ) private pure returns (uint256) {
        // Simplified repeater calculation
        // In production, would track hit counts
        return amount; // Placeholder - needs state tracking
    }
}