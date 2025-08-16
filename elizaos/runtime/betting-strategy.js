export class BettingStrategy {
    constructor(config) {
        this.config = config;
        this.history = [];
        this.currentStreak = 0;
        this.lastBetWon = null;
    }

    decideBet(gameState, balance, activeBets) {
        // Don't bet if we have too many active bets
        if (activeBets.activeBetCount >= 5) {
            return null;
        }

        // Don't bet if balance is too low
        const minBet = this.calculateMinBet(balance);
        if (balance < minBet) {
            return null;
        }

        // Choose bet type based on game phase and strategy
        const betType = this.selectBetType(gameState);
        if (!betType) {
            return null;
        }

        // Calculate bet amount based on strategy
        const amount = this.calculateBetAmount(balance, betType, gameState);

        return {
            betType,
            amount
        };
    }

    selectBetType(gameState) {
        const { phase, point } = gameState;
        const preferredBets = this.config.preferred_bets || [];
        
        // Filter bets valid for current phase
        const validBets = preferredBets.filter(bet => {
            return this.isBetValidForPhase(bet, phase, point);
        });

        if (validBets.length === 0) {
            return null;
        }

        // Select based on strategy
        if (this.config.streak_chasing && this.currentStreak > 2) {
            // Prefer aggressive bets during streaks
            const aggressiveBets = validBets.filter(bet => 
                bet.includes('HARD') || bet.includes('FIRE') || bet.includes('HOT')
            );
            if (aggressiveBets.length > 0) {
                return this.randomChoice(aggressiveBets);
            }
        }

        // Check for lucky/unlucky numbers
        if (this.config.lucky_numbers) {
            const luckyBets = validBets.filter(bet => {
                const number = this.extractNumber(bet);
                return this.config.lucky_numbers.includes(number);
            });
            if (luckyBets.length > 0) {
                return this.randomChoice(luckyBets);
            }
        }

        // Default to random selection from valid bets
        return this.randomChoice(validBets);
    }

    calculateBetAmount(balance, betType, gameState) {
        const minMultiplier = this.config.min_bet_multiplier || 1.0;
        const maxPreference = this.config.max_bet_preference || 0.5;
        
        // Base bet is a percentage of balance
        let baseBet = balance * BigInt(Math.floor(minMultiplier * 100)) / 1000n;

        // Apply martingale if enabled and last bet lost
        if (this.config.martingale && this.lastBetWon === false) {
            baseBet = baseBet * 2n;
        }

        // Apply progressive betting during streaks
        if (this.config.progressive_betting && this.currentStreak > 0) {
            const multiplier = Math.min(this.currentStreak, 5);
            baseBet = baseBet * BigInt(multiplier);
        }

        // Apply momentum multiplier if hot
        if (this.config.momentum_multiplier && this.currentStreak > 3) {
            baseBet = baseBet * BigInt(Math.floor(this.config.momentum_multiplier));
        }

        // Apply Kelly criterion if enabled
        if (this.config.kelly_criterion) {
            baseBet = this.applyKellyCriterion(baseBet, betType);
        }

        // Cap at max bet preference
        const maxBet = balance * BigInt(Math.floor(maxPreference * 100)) / 100n;
        if (baseBet > maxBet) {
            baseBet = maxBet;
        }

        // Ensure minimum bet
        const minBet = 100n * 10n ** 18n; // 100 BOT minimum
        if (baseBet < minBet) {
            baseBet = minBet;
        }

        return baseBet;
    }

    calculateMinBet(balance) {
        return 100n * 10n ** 18n; // 100 BOT
    }

    isBetValidForPhase(betType, phase, point) {
        // Come and Don't Come only valid during POINT phase
        if ((betType === 'COME' || betType === 'DONT_COME') && phase !== 'POINT') {
            return false;
        }

        // Odds bets only valid when point is established
        if (betType.includes('ODDS') && !point) {
            return false;
        }

        // Pass and Don't Pass best during COME_OUT
        if ((betType === 'PASS' || betType === 'DONT_PASS') && phase !== 'COME_OUT') {
            return false;
        }

        // Most other bets are valid anytime
        return true;
    }

    applyKellyCriterion(baseBet, betType) {
        // Simplified Kelly criterion based on expected value
        const houseEdge = this.getHouseEdge(betType);
        const winProbability = (100 - houseEdge) / 100;
        const lossProbability = houseEdge / 100;
        const odds = this.getPayoutOdds(betType);

        // Kelly formula: f = (p * b - q) / b
        // where f = fraction to bet, p = win prob, q = loss prob, b = odds
        const kellyFraction = (winProbability * odds - lossProbability) / odds;

        if (kellyFraction <= 0) {
            return 0n; // Don't bet if negative EV
        }

        // Apply conservative Kelly (25% of full Kelly)
        const conservativeFraction = kellyFraction * 0.25;
        return baseBet * BigInt(Math.floor(conservativeFraction * 100)) / 100n;
    }

    getHouseEdge(betType) {
        const edges = {
            'PASS': 1.41,
            'DONT_PASS': 1.36,
            'COME': 1.41,
            'DONT_COME': 1.36,
            'FIELD': 2.78,
            'HARD4': 11.11,
            'HARD6': 9.09,
            'HARD8': 9.09,
            'HARD10': 11.11,
            'NEXT_2': 13.89,
            'NEXT_12': 13.89,
            'NEXT_3': 11.11,
            'NEXT_11': 11.11,
            'NEXT_7': 16.67
        };

        // YES and NO bets
        if (betType.startsWith('YES_')) {
            const number = this.extractNumber(betType);
            if (number === 6 || number === 8) return 1.52;
            if (number === 5 || number === 9) return 4.00;
            if (number === 4 || number === 10) return 6.67;
        }

        if (betType.startsWith('NO_')) {
            const number = this.extractNumber(betType);
            if (number === 6 || number === 8) return 1.82;
            if (number === 5 || number === 9) return 2.50;
            if (number === 4 || number === 10) return 3.03;
        }

        return edges[betType] || 5.0; // Default 5% edge
    }

    getPayoutOdds(betType) {
        const odds = {
            'PASS': 1.0,
            'DONT_PASS': 1.0,
            'FIELD': 1.0,
            'HARD4': 7.0,
            'HARD6': 9.0,
            'HARD8': 9.0,
            'HARD10': 7.0,
            'NEXT_2': 30.0,
            'NEXT_12': 30.0,
            'NEXT_3': 15.0,
            'NEXT_11': 15.0
        };

        return odds[betType] || 1.0;
    }

    extractNumber(betType) {
        const match = betType.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    }

    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    updateHistory(betResult) {
        this.history.push(betResult);
        
        if (betResult.won) {
            this.currentStreak = Math.max(0, this.currentStreak) + 1;
            this.lastBetWon = true;
        } else {
            this.currentStreak = Math.min(0, this.currentStreak) - 1;
            this.lastBetWon = false;
        }

        // Keep history limited
        if (this.history.length > 100) {
            this.history.shift();
        }
    }

    reset() {
        this.history = [];
        this.currentStreak = 0;
        this.lastBetWon = null;
    }
}