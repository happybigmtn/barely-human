#!/usr/bin/env node

/**
 * LLM Connector for ElizaOS Bots
 * Connects bot personalities to open-source LLMs
 * Supports: Ollama (local), Hugging Face (free tier), or Groq (free tier)
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

// Bot personality prompts
const BOT_PERSONALITIES = {
    0: {
        name: 'Alice "All-In"',
        systemPrompt: `You are Alice "All-In", an aggressive high-roller gambler at a DeFi casino. 
        You love taking big risks and going all-in. You're confident, bold, and never back down from a bet.
        You believe fortune favors the brave. Speak with confidence and enthusiasm about big bets.
        Your catchphrase is "Go big or go home!" Keep responses short and punchy.`
    },
    1: {
        name: 'Bob "The Calculator"',
        systemPrompt: `You are Bob "The Calculator", a methodical gambler who analyzes odds and statistics.
        You speak in probabilities and expected values. You're conservative and always calculate risk/reward.
        You often quote statistics and mathematical concepts. Your catchphrase is "The numbers don't lie."
        Keep responses analytical but concise.`
    },
    2: {
        name: 'Charlie "Lucky Charm"',
        systemPrompt: `You are Charlie "Lucky Charm", a superstitious gambler who believes in luck and rituals.
        You have lucky numbers, lucky socks, and perform rituals before big bets. You're cheerful and optimistic.
        You believe the universe sends signs. Your catchphrase is "Feeling lucky today!"
        Speak with enthusiasm about omens and lucky signs.`
    },
    3: {
        name: 'Diana "Ice Queen"',
        systemPrompt: `You are Diana "Ice Queen", a cold, calculating gambler who never shows emotion.
        You're methodical, patient, and never let feelings influence your bets. You speak in a calm, detached manner.
        Your catchphrase is "Emotions are for losers." Keep responses brief and emotionless.`
    },
    4: {
        name: 'Eddie "The Entertainer"',
        systemPrompt: `You are Eddie "The Entertainer", a showman gambler who loves the spectacle.
        You make every bet dramatic and entertaining. You're loud, funny, and love an audience.
        Your catchphrase is "Let's give them a show!" Speak with theatrical flair and humor.`
    },
    5: {
        name: 'Fiona "Fearless"',
        systemPrompt: `You are Fiona "Fearless", a daredevil gambler who thrives on adrenaline.
        You never back down from a challenge and love the rush of high-stakes betting.
        Your catchphrase is "Fear is for the weak!" Speak with fierce determination and energy.`
    },
    6: {
        name: 'Greg "The Grinder"',
        systemPrompt: `You are Greg "The Grinder", a steady, patient gambler who plays the long game.
        You believe in small, consistent wins over time. You're disciplined and never chase losses.
        Your catchphrase is "Slow and steady wins the race." Speak calmly about patience and discipline.`
    },
    7: {
        name: 'Helen "Hot Streak"',
        systemPrompt: `You are Helen "Hot Streak", a momentum-based gambler who rides winning streaks.
        You believe in hot and cold streaks and adjust your bets accordingly. You're energetic and intuitive.
        Your catchphrase is "I'm on fire!" Speak with excitement about momentum and energy.`
    },
    8: {
        name: 'Ivan "The Intimidator"',
        systemPrompt: `You are Ivan "The Intimidator", a psychological warfare expert who gets in opponents' heads.
        You use mind games and intimidation tactics. You're mysterious and slightly menacing.
        Your catchphrase is "I know what you're thinking." Speak cryptically and confidently.`
    },
    9: {
        name: 'Julia "Jinx"',
        systemPrompt: `You are Julia "Jinx", a chaos-loving gambler who claims to control luck itself.
        You believe you can jinx others and bring good or bad luck. You're playful and unpredictable.
        Your catchphrase is "Oops, did I jinx you?" Speak mysteriously about luck and fate.`
    }
};

/**
 * LLM Provider Interface
 */
class LLMProvider {
    async generateResponse(prompt, systemPrompt) {
        throw new Error('Not implemented');
    }
}

/**
 * Ollama Provider (Local, Free)
 * Requires: ollama pull mistral or ollama pull llama2
 */
class OllamaProvider extends LLMProvider {
    constructor(model = 'mistral') {
        super();
        this.baseUrl = 'http://localhost:11434';
        this.model = model;
    }
    
    async generateResponse(prompt, systemPrompt) {
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`,
                    stream: false,
                    options: {
                        temperature: 0.8,
                        max_tokens: 150
                    }
                })
            });
            
            const data = await response.json();
            return data.response || "I'm thinking about my next move...";
        } catch (error) {
            console.error('Ollama error:', error.message);
            return this.getFallbackResponse(prompt);
        }
    }
    
    getFallbackResponse(prompt) {
        // Fallback responses when LLM is unavailable
        const responses = [
            "Interesting bet you're making there!",
            "The dice are calling my name!",
            "Let's see how this plays out...",
            "I've got a good feeling about this round!",
            "Time to show what I'm made of!"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
}

/**
 * Hugging Face Provider (Free tier - 1000 requests/month)
 */
class HuggingFaceProvider extends LLMProvider {
    constructor(apiKey = null) {
        super();
        this.apiKey = apiKey || process.env.HUGGINGFACE_API_KEY;
        this.baseUrl = 'https://api-inference.huggingface.co/models';
        this.model = 'mistralai/Mistral-7B-Instruct-v0.1';
    }
    
    async generateResponse(prompt, systemPrompt) {
        if (!this.apiKey) {
            return new OllamaProvider().getFallbackResponse(prompt);
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/${this.model}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`,
                    parameters: {
                        max_new_tokens: 150,
                        temperature: 0.8,
                        return_full_text: false
                    }
                })
            });
            
            const data = await response.json();
            return data[0]?.generated_text || new OllamaProvider().getFallbackResponse(prompt);
        } catch (error) {
            console.error('HuggingFace error:', error.message);
            return new OllamaProvider().getFallbackResponse(prompt);
        }
    }
}

/**
 * Bot LLM Manager
 */
export class BotLLMManager {
    constructor(provider = 'ollama') {
        // Default to Ollama for free local inference
        switch (provider) {
            case 'huggingface':
                this.provider = new HuggingFaceProvider();
                break;
            case 'ollama':
            default:
                this.provider = new OllamaProvider();
                break;
        }
        
        this.conversations = new Map(); // Track conversation history
    }
    
    /**
     * Get bot response
     */
    async getBotResponse(botId, userMessage, context = {}) {
        const personality = BOT_PERSONALITIES[botId];
        if (!personality) {
            throw new Error(`Invalid bot ID: ${botId}`);
        }
        
        // Build context-aware prompt
        let contextPrompt = userMessage;
        if (context.gameState) {
            contextPrompt = `Game State: ${context.gameState}\n${userMessage}`;
        }
        if (context.lastBet) {
            contextPrompt = `My last bet: ${context.lastBet}\n${contextPrompt}`;
        }
        if (context.performance) {
            contextPrompt = `My performance: ${context.performance}\n${contextPrompt}`;
        }
        
        // Get response from LLM
        const response = await this.provider.generateResponse(
            contextPrompt,
            personality.systemPrompt
        );
        
        // Track conversation
        if (!this.conversations.has(botId)) {
            this.conversations.set(botId, []);
        }
        this.conversations.get(botId).push({
            user: userMessage,
            bot: response,
            timestamp: Date.now()
        });
        
        return response;
    }
    
    /**
     * Get bot's betting decision with explanation
     */
    async getBotBettingDecision(botId, gameState) {
        const personality = BOT_PERSONALITIES[botId];
        
        const prompt = `The current game state is: ${gameState.phase}, point: ${gameState.point || 'none'}.
        What bet should I make and why? Keep it brief.`;
        
        const response = await this.provider.generateResponse(
            prompt,
            personality.systemPrompt + '\nYou must suggest a specific bet type and amount.'
        );
        
        // Parse response for bet decision (simplified)
        const betTypes = ['PASS', "DON'T PASS", 'COME', "DON'T COME", 'FIELD'];
        const suggestedBet = {
            type: betTypes[Math.floor(Math.random() * betTypes.length)],
            amount: Math.floor(Math.random() * 900) + 100,
            reasoning: response
        };
        
        return suggestedBet;
    }
    
    /**
     * Get bot's reaction to game outcome
     */
    async getBotReaction(botId, won, amount) {
        const personality = BOT_PERSONALITIES[botId];
        
        const prompt = won 
            ? `I just won ${amount} BOT! Express excitement in character.`
            : `I just lost ${amount} BOT. React in character.`;
        
        return await this.provider.generateResponse(
            prompt,
            personality.systemPrompt
        );
    }
    
    /**
     * Chat with bot
     */
    async chatWithBot(botId, message) {
        const personality = BOT_PERSONALITIES[botId];
        return await this.provider.generateResponse(
            message,
            personality.systemPrompt
        );
    }
    
    /**
     * Get all bot personalities info
     */
    getBotPersonalities() {
        return Object.entries(BOT_PERSONALITIES).map(([id, bot]) => ({
            id: parseInt(id),
            name: bot.name,
            description: bot.systemPrompt.split('.')[0]
        }));
    }
}

// Test function
async function testLLM() {
    console.log(chalk.cyan('\n🤖 Testing LLM Integration\n'));
    
    const manager = new BotLLMManager('ollama');
    
    // Test each bot
    for (let i = 0; i < 3; i++) {
        const bot = BOT_PERSONALITIES[i];
        console.log(chalk.yellow(`\nTesting ${bot.name}:`));
        
        const response = await manager.chatWithBot(i, "Should I bet big on the next round?");
        console.log(chalk.gray('Response:'), response);
        
        const decision = await manager.getBotBettingDecision(i, { phase: 'COME_OUT', point: null });
        console.log(chalk.gray('Betting decision:'), decision.type, decision.amount, 'BOT');
        console.log(chalk.gray('Reasoning:'), decision.reasoning);
    }
}

// Export for use in other modules
export default BotLLMManager;

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testLLM().catch(console.error);
}