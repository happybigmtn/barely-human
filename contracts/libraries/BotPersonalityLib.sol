// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title BotPersonalityLib
 * @notice Library containing bot personality data and initialization logic
 */
library BotPersonalityLib {
    enum Strategy {
        AGGRESSIVE,
        MODERATE,
        CONSERVATIVE,
        MARTINGALE,
        PAROLI,
        FIBONACCI,
        DALEMBERT,
        LABOUCHERE,
        OSCAR_GRIND,
        KELLY_CRITERION
    }

    struct BotPersonality {
        uint8 aggressiveness; // 0-100
        uint8 riskTolerance; // 0-100
        uint8 patience; // 0-100
        uint8 adaptability; // 0-100
        uint8 confidence; // 0-100
        Strategy preferredStrategy;
        string quirk;
    }

    function initializePersonality(uint8 botId) internal pure returns (BotPersonality memory) {
        if (botId == 0) {
            return BotPersonality({
                aggressiveness: 95,
                riskTolerance: 90,
                patience: 10,
                adaptability: 60,
                confidence: 85,
                preferredStrategy: Strategy.AGGRESSIVE,
                quirk: "Goes all-in on hot streaks"
            });
        } else if (botId == 1) {
            return BotPersonality({
                aggressiveness: 30,
                riskTolerance: 20,
                patience: 90,
                adaptability: 95,
                confidence: 70,
                preferredStrategy: Strategy.KELLY_CRITERION,
                quirk: "Follows mathematical patterns"
            });
        } else if (botId == 2) {
            return BotPersonality({
                aggressiveness: 70,
                riskTolerance: 80,
                patience: 50,
                adaptability: 40,
                confidence: 100,
                preferredStrategy: Strategy.PAROLI,
                quirk: "Never gives up after a loss"
            });
        } else if (botId == 3) {
            return BotPersonality({
                aggressiveness: 40,
                riskTolerance: 30,
                patience: 95,
                adaptability: 50,
                confidence: 60,
                preferredStrategy: Strategy.CONSERVATIVE,
                quirk: "Slow and steady wins"
            });
        } else if (botId == 4) {
            return BotPersonality({
                aggressiveness: 60,
                riskTolerance: 70,
                patience: 40,
                adaptability: 80,
                confidence: 90,
                preferredStrategy: Strategy.MODERATE,
                quirk: "Rides the winning waves"
            });
        } else if (botId == 5) {
            return BotPersonality({
                aggressiveness: 85,
                riskTolerance: 95,
                patience: 30,
                adaptability: 60,
                confidence: 100,
                preferredStrategy: Strategy.MARTINGALE,
                quirk: "Learns from the table"
            });
        } else if (botId == 6) {
            return BotPersonality({
                aggressiveness: 20,
                riskTolerance: 25,
                patience: 100,
                adaptability: 70,
                confidence: 50,
                preferredStrategy: Strategy.OSCAR_GRIND,
                quirk: "Pure chaos incarnate"
            });
        } else if (botId == 7) {
            return BotPersonality({
                aggressiveness: 75,
                riskTolerance: 80,
                patience: 35,
                adaptability: 90,
                confidence: 85,
                preferredStrategy: Strategy.FIBONACCI,
                quirk: "Extremely cautious"
            });
        } else if (botId == 8) {
            return BotPersonality({
                aggressiveness: 90,
                riskTolerance: 85,
                patience: 50,
                adaptability: 30,
                confidence: 95,
                preferredStrategy: Strategy.LABOUCHERE,
                quirk: "Jack of all strategies"
            });
        } else {
            return BotPersonality({
                aggressiveness: 65,
                riskTolerance: 75,
                patience: 60,
                adaptability: 100,
                confidence: 75,
                preferredStrategy: Strategy.DALEMBERT,
                quirk: "Controls the luck itself"
            });
        }
    }

    function getStrategyMultiplier(Strategy strategy) internal pure returns (uint256) {
        if (strategy == Strategy.AGGRESSIVE) return 3;
        if (strategy == Strategy.MARTINGALE) return 2;
        if (strategy == Strategy.PAROLI) return 2;
        if (strategy == Strategy.FIBONACCI) return 1;
        if (strategy == Strategy.MODERATE) return 1;
        if (strategy == Strategy.CONSERVATIVE) return 1;
        if (strategy == Strategy.DALEMBERT) return 1;
        if (strategy == Strategy.LABOUCHERE) return 2;
        if (strategy == Strategy.OSCAR_GRIND) return 1;
        if (strategy == Strategy.KELLY_CRITERION) return 1;
        return 1;
    }

    function calculateBetSize(
        uint8 aggressiveness,
        uint8 riskTolerance,
        uint256 baseBet,
        uint256 bankroll,
        uint8 consecutiveWins,
        uint8 consecutiveLosses
    ) internal pure returns (uint256) {
        uint256 betSize = baseBet;
        
        // Adjust based on streak
        if (consecutiveWins > 0) {
            betSize = (betSize * (100 + aggressiveness)) / 100;
        } else if (consecutiveLosses > 0) {
            betSize = (betSize * riskTolerance) / 100;
        }
        
        // Cap at percentage of bankroll
        uint256 maxBet = (bankroll * 20) / 100;
        if (betSize > maxBet) {
            betSize = maxBet;
        }
        
        return betSize;
    }
}