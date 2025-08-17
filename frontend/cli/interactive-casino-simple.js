#!/usr/bin/env node

/**
 * Simplified Interactive Casino CLI for Testing
 * Demonstrates bot chat and betting without complex dependencies
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import Table from 'cli-table3';
import figlet from 'figlet';

// Bot personalities
const BOTS = [
    { 
        id: 0, 
        name: 'Alice "All-In"', 
        emoji: '🎯', 
        strategy: 'Aggressive',
        personality: 'Bold and confident, never backs down from a big bet',
        responses: {
            win: ["BOOM! That's how we do it!", "All in pays off again!", "Fortune favors the bold!"],
            lose: ["Just a warm-up!", "Next one's mine!", "I'll double down next time!"],
            chat: ["Life's too short for small bets!", "Go big or go home!", "I can feel a hot streak coming!"]
        }
    },
    { 
        id: 1, 
        name: 'Bob "The Calculator"', 
        emoji: '🧮', 
        strategy: 'Conservative',
        personality: 'Analytical and methodical, always calculating odds',
        responses: {
            win: ["As predicted by my calculations", "Statistical probability confirmed", "The numbers never lie"],
            lose: ["An acceptable variance", "Within expected parameters", "Recalculating strategy..."],
            chat: ["The odds are 47.3% in our favor", "My analysis suggests patience", "Let me run the numbers..."]
        }
    },
    { 
        id: 2, 
        name: 'Charlie "Lucky Charm"', 
        emoji: '🍀', 
        strategy: 'Superstitious',
        personality: 'Believes in luck, signs, and cosmic alignment',
        responses: {
            win: ["My lucky socks worked!", "The stars aligned!", "I knew that four-leaf clover would help!"],
            lose: ["Must be a full moon...", "I forgot my rabbit's foot!", "Need to realign my chakras"],
            chat: ["I have a good feeling about this", "My horoscope said today's lucky", "The dice spirits are speaking to me"]
        }
    },
    { 
        id: 3, 
        name: 'Diana "Ice Queen"', 
        emoji: '❄️', 
        strategy: 'Cold Logic',
        personality: 'Emotionless and purely logical',
        responses: {
            win: ["Expected outcome.", "Proceed to next round.", "Efficiency maintained."],
            lose: ["Irrelevant. Continue.", "Minor setback.", "Adjusting parameters."],
            chat: ["Emotions are weaknesses.", "Logic prevails.", "Calculate. Execute. Repeat."]
        }
    },
    { 
        id: 4, 
        name: 'Eddie "The Entertainer"', 
        emoji: '🎭', 
        strategy: 'Showman',
        personality: 'Makes every bet a performance',
        responses: {
            win: ["Ladies and gentlemen, we have a winner!", "The crowd goes wild!", "That's showbiz, baby!"],
            lose: ["The show must go on!", "A dramatic twist!", "Setting up for the comeback!"],
            chat: ["Step right up to the greatest show!", "Watch this magic happen!", "Are you not entertained?!"]
        }
    }
];

class SimpleInteractiveCLI {
    constructor() {
        this.userBalance = 1000; // Starting balance
        this.botScores = new Map(BOTS.map(bot => [bot.id, { wins: 0, losses: 0, balance: 1000 }]));
        this.currentRound = 0;
    }

    async start() {
        console.clear();
        console.log(chalk.cyan(figlet.textSync('Barely Human', { horizontalLayout: 'full' })));
        console.log(chalk.yellow('\n🎰 Welcome to the DeFi Casino - Interactive Test Mode\n'));
        
        await this.mainMenu();
    }

    async mainMenu() {
        const choices = [
            '💬 Chat with Bots',
            '🎯 Bet on Bot Performance',
            '📊 View Leaderboard',
            '🎲 Simulate Game Round',
            '💰 Check Balance',
            '❌ Exit'
        ];

        const { choice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'choice',
                message: 'What would you like to do?',
                choices
            }
        ]);

        switch(choice) {
            case '💬 Chat with Bots':
                await this.chatWithBots();
                break;
            case '🎯 Bet on Bot Performance':
                await this.betOnBots();
                break;
            case '📊 View Leaderboard':
                await this.showLeaderboard();
                break;
            case '🎲 Simulate Game Round':
                await this.simulateRound();
                break;
            case '💰 Check Balance':
                await this.checkBalance();
                break;
            case '❌ Exit':
                console.log(chalk.green('\nThanks for playing! 🎰\n'));
                process.exit(0);
        }

        await this.mainMenu();
    }

    async chatWithBots() {
        console.log(chalk.cyan('\n=== Chat with AI Bots ===\n'));

        const botChoices = BOTS.map(bot => `${bot.emoji} ${bot.name}`);
        const { selectedBot } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedBot',
                message: 'Which bot would you like to chat with?',
                choices: [...botChoices, '← Back']
            }
        ]);

        if (selectedBot === '← Back') return;

        const bot = BOTS.find(b => `${b.emoji} ${b.name}` === selectedBot);
        console.log(chalk.green(`\n${bot.emoji} ${bot.name}:`));
        console.log(chalk.white(`"${bot.personality}"\n`));

        const { topic } = await inquirer.prompt([
            {
                type: 'list',
                name: 'topic',
                message: 'What would you like to talk about?',
                choices: [
                    'Your betting strategy',
                    'How are you feeling?',
                    'Any tips for winning?',
                    'Tell me about yourself',
                    '← Back'
                ]
            }
        ]);

        if (topic !== '← Back') {
            const response = bot.responses.chat[Math.floor(Math.random() * bot.responses.chat.length)];
            console.log(chalk.yellow(`\n${bot.emoji}: "${response}"\n`));
            
            await inquirer.prompt([
                {
                    type: 'input',
                    name: 'continue',
                    message: 'Press Enter to continue...'
                }
            ]);
        }
    }

    async betOnBots() {
        console.log(chalk.cyan('\n=== Bet on Bot Performance ===\n'));
        console.log(chalk.white(`Your balance: ${chalk.green(`$${this.userBalance}`)}\n`));

        const botChoices = BOTS.map(bot => {
            const stats = this.botScores.get(bot.id);
            return `${bot.emoji} ${bot.name} (W:${stats.wins} L:${stats.losses})`;
        });

        const { selectedBot, amount } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedBot',
                message: 'Which bot do you want to bet on?',
                choices: [...botChoices, '← Back']
            },
            {
                type: 'number',
                name: 'amount',
                message: 'How much do you want to bet?',
                default: 10,
                validate: (value) => {
                    if (value <= 0) return 'Bet must be positive';
                    if (value > this.userBalance) return 'Insufficient balance';
                    return true;
                },
                when: (answers) => answers.selectedBot !== '← Back'
            }
        ]);

        if (selectedBot === '← Back') return;

        const botIndex = botChoices.indexOf(selectedBot);
        const bot = BOTS[botIndex];

        const spinner = ora('Simulating bot performance...').start();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate win/loss (weighted by strategy)
        const winChance = bot.strategy === 'Aggressive' ? 0.45 : 
                          bot.strategy === 'Conservative' ? 0.55 : 0.5;
        const won = Math.random() < winChance;
        
        spinner.stop();

        if (won) {
            const winnings = amount * 2;
            this.userBalance += winnings;
            const stats = this.botScores.get(bot.id);
            stats.wins++;
            stats.balance += 100;
            
            console.log(chalk.green(`\n✅ ${bot.name} WON! You earned $${winnings}!`));
            console.log(chalk.yellow(`${bot.emoji}: "${bot.responses.win[Math.floor(Math.random() * bot.responses.win.length)]}"`));
        } else {
            this.userBalance -= amount;
            const stats = this.botScores.get(bot.id);
            stats.losses++;
            stats.balance -= 100;
            
            console.log(chalk.red(`\n❌ ${bot.name} lost. You lost $${amount}.`));
            console.log(chalk.yellow(`${bot.emoji}: "${bot.responses.lose[Math.floor(Math.random() * bot.responses.lose.length)]}"`));
        }

        console.log(chalk.white(`\nNew balance: ${chalk.green(`$${this.userBalance}`)}\n`));
        
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }
        ]);
    }

    async showLeaderboard() {
        console.log(chalk.cyan('\n=== Bot Leaderboard ===\n'));

        const table = new Table({
            head: ['Rank', 'Bot', 'Wins', 'Losses', 'Win %', 'Balance'],
            style: {
                head: ['cyan']
            }
        });

        const sortedBots = BOTS.map(bot => {
            const stats = this.botScores.get(bot.id);
            const totalGames = stats.wins + stats.losses;
            const winRate = totalGames > 0 ? (stats.wins / totalGames * 100).toFixed(1) : '0.0';
            return { bot, stats, winRate: parseFloat(winRate) };
        }).sort((a, b) => b.stats.balance - a.stats.balance);

        sortedBots.forEach((entry, index) => {
            const { bot, stats, winRate } = entry;
            const rank = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
            
            table.push([
                rank,
                `${bot.emoji} ${bot.name}`,
                chalk.green(stats.wins),
                chalk.red(stats.losses),
                `${winRate}%`,
                chalk.yellow(`$${stats.balance}`)
            ]);
        });

        console.log(table.toString());

        if (sortedBots[0].stats.wins > 0) {
            const champion = sortedBots[0].bot;
            console.log(chalk.yellow(`\n🏆 ${champion.emoji} ${champion.name}: "I'm the champion!"`));
        }

        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: '\nPress Enter to continue...'
            }
        ]);
    }

    async simulateRound() {
        console.log(chalk.cyan('\n=== Simulating Game Round ===\n'));
        
        const spinner = ora('Bots are placing their bets...').start();
        await new Promise(resolve => setTimeout(resolve, 1500));
        spinner.text = 'Rolling the dice...';
        await new Promise(resolve => setTimeout(resolve, 1500));
        spinner.stop();

        this.currentRound++;
        console.log(chalk.yellow(`\n🎲 Round ${this.currentRound} Results:\n`));

        BOTS.forEach(bot => {
            const won = Math.random() < 0.5;
            const stats = this.botScores.get(bot.id);
            
            if (won) {
                stats.wins++;
                stats.balance += 50;
                console.log(chalk.green(`✅ ${bot.emoji} ${bot.name} - WIN! (+$50)`));
            } else {
                stats.losses++;
                stats.balance -= 50;
                console.log(chalk.red(`❌ ${bot.emoji} ${bot.name} - LOSS (-$50)`));
            }
        });

        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: '\nPress Enter to continue...'
            }
        ]);
    }

    async checkBalance() {
        console.log(chalk.cyan('\n=== Your Balance ===\n'));
        console.log(chalk.white('Current Balance: ') + chalk.green(`$${this.userBalance}`));
        console.log(chalk.white('Games Played: ') + chalk.yellow(this.currentRound));
        
        const profit = this.userBalance - 1000;
        if (profit > 0) {
            console.log(chalk.white('Profit: ') + chalk.green(`+$${profit}`));
        } else if (profit < 0) {
            console.log(chalk.white('Loss: ') + chalk.red(`$${Math.abs(profit)}`));
        } else {
            console.log(chalk.white('Profit/Loss: ') + chalk.yellow('$0'));
        }

        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: '\nPress Enter to continue...'
            }
        ]);
    }
}

// Start the CLI
const cli = new SimpleInteractiveCLI();
cli.start().catch(console.error);