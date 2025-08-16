import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import Table from 'cli-table3';
import { parseEther, formatEther } from 'viem';

// Bet types mapping
const BET_TYPES = {
    'Pass Line': 0,
    "Don't Pass": 1,
    'Come': 2,
    "Don't Come": 3,
    'Field': 4,
    'Hard 4': 25,
    'Hard 6': 26,
    'Hard 8': 27,
    'Hard 10': 28,
    'Any 7': 43,
    'Any Craps': 44,
    'Snake Eyes (2)': 45,
    'Ace Deuce (3)': 46,
    'Yo (11)': 47,
    'Boxcars (12)': 48,
    'Horn': 49,
    'C&E': 50,
    'Big 6': 51,
    'Big 8': 52
};

// Dice display
const displayDice = (die1, die2) => {
    const dice = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    console.log('\n' + chalk.yellow('🎲 Roll Result:'));
    console.log(chalk.white.bgRed.bold(` ${dice[die1 - 1]}  ${dice[die2 - 1]} `));
    console.log(chalk.cyan(`Total: ${die1 + die2}\n`));
};

// Game state display
const displayGameState = (phase, point = null) => {
    const table = new Table({
        head: [chalk.cyan('Game Phase'), chalk.cyan('Point')],
        colWidths: [20, 15]
    });
    
    table.push([
        phase === 'COME_OUT' ? chalk.green('Come Out Roll') : chalk.yellow('Point Phase'),
        point ? chalk.yellow(point) : chalk.gray('None')
    ]);
    
    console.log(table.toString());
};

// Active bets display
const displayActiveBets = (bets) => {
    if (bets.length === 0) {
        console.log(chalk.gray('No active bets\n'));
        return;
    }
    
    const table = new Table({
        head: [chalk.cyan('Bet Type'), chalk.cyan('Amount'), chalk.cyan('Status')],
        colWidths: [20, 15, 15]
    });
    
    bets.forEach(bet => {
        table.push([
            bet.type,
            formatEther(bet.amount) + ' ETH',
            bet.active ? chalk.green('Active') : chalk.gray('Settled')
        ]);
    });
    
    console.log(table.toString());
};

// Bot players display
const displayBotPlayers = () => {
    const bots = [
        { name: 'Alice All-In', bet: 'Pass Line', amount: '10 ETH' },
        { name: 'Bob Calculator', bet: "Don't Pass", amount: '5 ETH' },
        { name: 'Charlie Lucky', bet: 'Field', amount: '2 ETH' },
        { name: 'Diana Ice Queen', bet: 'Hard 8', amount: '3 ETH' }
    ];
    
    console.log(chalk.magenta('\n🤖 Bot Players at Table:'));
    const table = new Table({
        head: [chalk.cyan('Bot'), chalk.cyan('Bet'), chalk.cyan('Amount')],
        colWidths: [20, 15, 10]
    });
    
    bots.forEach(bot => {
        table.push([bot.name, bot.bet, bot.amount]);
    });
    
    console.log(table.toString());
};

// Simulate dice roll
const rollDice = async () => {
    const spinner = ora('Rolling dice...').start();
    
    // Animate rolling
    for (let i = 0; i < 10; i++) {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        spinner.text = `Rolling dice... ${d1} + ${d2} = ${d1 + d2}`;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    
    spinner.succeed('Dice rolled!');
    return { die1, die2 };
};

// Main game function
export const playGame = async (publicClient, walletClient, account) => {
    console.clear();
    console.log(chalk.cyan.bold('\n🎲 CRAPS TABLE 🎲\n'));
    
    let gamePhase = 'COME_OUT';
    let point = null;
    let activeBets = [];
    let balance = parseEther('100'); // Simulated balance
    
    // Game loop
    let playing = true;
    while (playing) {
        // Display current state
        displayGameState(gamePhase, point);
        displayActiveBets(activeBets);
        displayBotPlayers();
        
        console.log(chalk.blue(`\nYour Balance: ${formatEther(balance)} ETH`));
        
        // Player action
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    'Place Bet',
                    'Roll Dice (Shooter)',
                    'Watch Bot Roll',
                    'View Bet Options',
                    'Cash Out'
                ]
            }
        ]);
        
        switch (action) {
            case 'Place Bet':
                const { betType } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'betType',
                        message: 'Select bet type:',
                        choices: Object.keys(BET_TYPES)
                    }
                ]);
                
                const { amount } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'amount',
                        message: 'Bet amount (ETH):',
                        default: '1',
                        validate: (input) => {
                            const val = parseFloat(input);
                            if (isNaN(val) || val <= 0) return 'Please enter a valid amount';
                            if (parseEther(input) > balance) return 'Insufficient balance';
                            return true;
                        }
                    }
                ]);
                
                activeBets.push({
                    type: betType,
                    amount: parseEther(amount),
                    active: true
                });
                
                balance -= parseEther(amount);
                console.log(chalk.green(`✅ Bet placed: ${amount} ETH on ${betType}`));
                break;
                
            case 'Roll Dice (Shooter)':
            case 'Watch Bot Roll':
                const isPlayer = action === 'Roll Dice (Shooter)';
                
                if (isPlayer) {
                    console.log(chalk.yellow('\n🎯 You are the shooter!'));
                } else {
                    const botShooter = ['Alice All-In', 'Bob Calculator', 'Charlie Lucky'][Math.floor(Math.random() * 3)];
                    console.log(chalk.magenta(`\n🤖 ${botShooter} is rolling!`));
                }
                
                const { die1, die2 } = await rollDice();
                const total = die1 + die2;
                
                displayDice(die1, die2);
                
                // Game logic
                if (gamePhase === 'COME_OUT') {
                    if (total === 7 || total === 11) {
                        console.log(chalk.green('🎉 Natural! Pass Line wins!'));
                        // Process wins
                        activeBets.forEach(bet => {
                            if (bet.type === 'Pass Line' && bet.active) {
                                const winAmount = bet.amount * 2n;
                                balance += winAmount;
                                console.log(chalk.green(`💰 You won ${formatEther(winAmount)} ETH!`));
                                bet.active = false;
                            }
                        });
                    } else if (total === 2 || total === 3 || total === 12) {
                        console.log(chalk.red('💀 Craps! Pass Line loses!'));
                        activeBets.forEach(bet => {
                            if (bet.type === 'Pass Line') bet.active = false;
                        });
                    } else {
                        point = total;
                        gamePhase = 'POINT';
                        console.log(chalk.yellow(`📍 Point established: ${point}`));
                    }
                } else {
                    // Point phase
                    if (total === point) {
                        console.log(chalk.green(`🎉 Point made! (${point}) Pass Line wins!`));
                        activeBets.forEach(bet => {
                            if (bet.type === 'Pass Line' && bet.active) {
                                const winAmount = bet.amount * 2n;
                                balance += winAmount;
                                console.log(chalk.green(`💰 You won ${formatEther(winAmount)} ETH!`));
                                bet.active = false;
                            }
                        });
                        gamePhase = 'COME_OUT';
                        point = null;
                    } else if (total === 7) {
                        console.log(chalk.red('💀 Seven out! Pass Line loses!'));
                        activeBets.forEach(bet => {
                            if (bet.type === 'Pass Line') bet.active = false;
                        });
                        gamePhase = 'COME_OUT';
                        point = null;
                    } else {
                        console.log(chalk.gray(`Rolled ${total}, point is still ${point}`));
                    }
                }
                
                // Clean up settled bets
                activeBets = activeBets.filter(bet => bet.active);
                break;
                
            case 'View Bet Options':
                console.log(chalk.cyan('\n📋 Available Bets:\n'));
                const betTable = new Table({
                    head: [chalk.cyan('Bet Type'), chalk.cyan('Payout'), chalk.cyan('House Edge')],
                    colWidths: [20, 15, 15]
                });
                
                betTable.push(
                    ['Pass Line', '1:1', '1.41%'],
                    ["Don't Pass", '1:1', '1.36%'],
                    ['Field', '1:1 or 2:1', '5.56%'],
                    ['Hard Ways', '7:1 or 9:1', '9-11%'],
                    ['Any 7', '4:1', '16.67%'],
                    ['Any Craps', '7:1', '11.11%']
                );
                
                console.log(betTable.toString());
                await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
                break;
                
            case 'Cash Out':
                console.log(chalk.cyan(`\n💰 Cashing out ${formatEther(balance)} ETH`));
                console.log(chalk.green('Thanks for playing!\n'));
                playing = false;
                break;
        }
        
        if (playing) {
            console.log('\n' + chalk.gray('─'.repeat(50)) + '\n');
        }
    }
};