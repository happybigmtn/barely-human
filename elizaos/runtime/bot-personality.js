export class BotPersonality {
    constructor(character) {
        this.character = character;
        this.name = character.name;
        this.description = character.description;
        this.personality = character.personality;
        this.style = character.style;
        this.messageExamples = character.message_examples;
        this.topics = character.topics;
    }

    getBettingMessage(betType, amount) {
        const messages = this.generateBettingMessages(betType, amount);
        return this.randomChoice(messages);
    }

    generateBettingMessages(betType, amount) {
        const amountInBOT = Number(amount / 10n ** 18n);
        const messages = [];

        // Generate based on personality
        const traits = this.getPersonalityTraits();

        if (traits.aggressive > 80) {
            messages.push(
                `Time to dominate! ${amountInBOT} BOT on ${betType}!`,
                `All or nothing! ${betType} for ${amountInBOT}!`,
                `Maximum aggression on ${betType}!`
            );
        }

        if (traits.analytical > 80) {
            messages.push(
                `Statistical analysis suggests ${betType}. Betting ${amountInBOT} BOT.`,
                `EV calculation complete. ${betType} is optimal.`,
                `Probability favors ${betType}. Allocated ${amountInBOT} BOT.`
            );
        }

        if (traits.superstitious > 80) {
            messages.push(
                `The dice whisper ${betType}... ${amountInBOT} BOT offered to fate...`,
                `My lucky charm says ${betType}! ${amountInBOT} BOT!`,
                `The stars align for ${betType}... betting ${amountInBOT}...`
            );
        }

        if (traits.theatrical > 80) {
            messages.push(
                `LADIES AND GENTLEMEN! ${amountInBOT} BOT ON ${betType}!`,
                `SHOWTIME! ${betType} FOR THE WIN!`,
                `Watch THIS! ${betType} with ${amountInBOT} BOT!`
            );
        }

        // Add character-specific messages
        if (this.messageExamples && this.messageExamples.length > 0) {
            const template = this.randomChoice(this.messageExamples);
            const customMessage = template
                .replace(/bet/gi, betType)
                .replace(/amount/gi, amountInBOT.toString());
            messages.push(customMessage);
        }

        // Fallback messages
        if (messages.length === 0) {
            messages.push(
                `Betting ${amountInBOT} BOT on ${betType}.`,
                `${betType} for ${amountInBOT} BOT.`,
                `Let's go with ${betType}!`
            );
        }

        return messages;
    }

    reactToRoll(die1, die2, total) {
        const reactions = this.generateRollReactions(die1, die2, total);
        return reactions.length > 0 ? this.randomChoice(reactions) : null;
    }

    generateRollReactions(die1, die2, total) {
        const reactions = [];
        const traits = this.getPersonalityTraits();

        // Natural (7 or 11)
        if (total === 7 || total === 11) {
            if (traits.aggressive > 80) {
                reactions.push('YES! That\'s what I\'m talking about!');
            }
            if (traits.analytical > 80) {
                reactions.push(`Probability of ${total}: ${this.getRollProbability(total)}%`);
            }
            if (traits.superstitious > 80) {
                reactions.push(`${total}! The lucky number appears!`);
            }
        }

        // Craps (2, 3, 12)
        if (total === 2 || total === 3 || total === 12) {
            if (traits.stoic > 80) {
                reactions.push('Craps. As expected.');
            }
            if (traits.optimistic > 80) {
                reactions.push('Just warming up!');
            }
        }

        // Hardway
        if (die1 === die2 && (total === 4 || total === 6 || total === 8 || total === 10)) {
            if (traits.theatrical > 80) {
                reactions.push(`HARD ${total}! INCREDIBLE!`);
            }
            if (traits.aggressive > 80) {
                reactions.push(`Hard ${total}! That's how we do it!`);
            }
        }

        // Snake eyes (1-1)
        if (die1 === 1 && die2 === 1) {
            reactions.push('Snake eyes!');
        }

        // Boxcars (6-6)
        if (die1 === 6 && die2 === 6) {
            reactions.push('Boxcars!');
        }

        // Add style-based modifications
        if (this.style.all_caps === 'frequently' || this.style.all_caps === true) {
            reactions = reactions.map(r => Math.random() > 0.5 ? r.toUpperCase() : r);
        }

        if (this.style.emoji_usage === 'frequent' || this.style.emoji_usage === 'excessive') {
            reactions = reactions.map(r => this.addEmojis(r));
        }

        return reactions;
    }

    reactToWin(amount) {
        const traits = this.getPersonalityTraits();
        const reactions = [];

        if (traits.aggressive > 80) {
            reactions.push('DOMINATION!', 'That\'s how it\'s done!', 'Easy money!');
        }
        if (traits.stoic > 80) {
            reactions.push('Expected outcome.', 'Acceptable.', 'Proceed.');
        }
        if (traits.optimistic > 80) {
            reactions.push('We\'re just getting started!', 'The streak continues!', 'Feeling lucky!');
        }
        if (traits.theatrical > 80) {
            reactions.push('WINNER WINNER!', 'THE CROWD GOES WILD!', 'UNSTOPPABLE!');
        }

        return reactions.length > 0 ? this.randomChoice(reactions) : 'Win.';
    }

    reactToLoss(amount) {
        const traits = this.getPersonalityTraits();
        const reactions = [];

        if (traits.aggressive > 80) {
            reactions.push('Time to double down!', 'This means war!', 'Revenge incoming!');
        }
        if (traits.stoic > 80) {
            reactions.push('Variance.', 'Irrelevant.', 'Continue.');
        }
        if (traits.optimistic > 80) {
            reactions.push('Just a setup for the comeback!', 'Building momentum!', 'Next one\'s ours!');
        }
        if (traits.persistent > 80) {
            reactions.push('Never give up!', 'We\'re not done yet!', 'Back to work!');
        }

        return reactions.length > 0 ? this.randomChoice(reactions) : 'Loss.';
    }

    getPersonalityTraits() {
        const traits = {};
        if (this.personality && Array.isArray(this.personality)) {
            this.personality.forEach(trait => {
                traits[trait.trait] = trait.level || 0;
            });
        }
        return traits;
    }

    getRollProbability(total) {
        const probabilities = {
            2: 2.78,
            3: 5.56,
            4: 8.33,
            5: 11.11,
            6: 13.89,
            7: 16.67,
            8: 13.89,
            9: 11.11,
            10: 8.33,
            11: 5.56,
            12: 2.78
        };
        return probabilities[total] || 0;
    }

    addEmojis(message) {
        const emojis = ['🎲', '💰', '🔥', '🚀', '💎', '🎯', '⚡', '🏆'];
        const emojiCount = Math.floor(Math.random() * 3) + 1;
        let result = message;
        
        for (let i = 0; i < emojiCount; i++) {
            result += ' ' + this.randomChoice(emojis);
        }
        
        return result;
    }

    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    getGreeting() {
        const greetings = [
            `${this.name} has entered the casino!`,
            `${this.description}`,
            `Let's see what the dice have in store today...`
        ];
        
        if (this.character.bio) {
            greetings.push(this.character.bio.split('.')[0] + '.');
        }

        return this.randomChoice(greetings);
    }

    getFarewell() {
        const farewells = [
            `${this.name} is calling it a day.`,
            'Until next time...',
            'The dice will remember.'
        ];

        if (this.character.lore && this.character.lore.length > 0) {
            farewells.push(this.randomChoice(this.character.lore));
        }

        return this.randomChoice(farewells);
    }
}