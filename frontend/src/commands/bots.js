import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import ora from 'ora';

const BOT_PERSONALITIES = [
    {
        id: 0,
        name: 'Alice "All-In"',
        description: 'Aggressive high-roller who believes in going big or going home',
        strategy: 'High-risk, high-reward',
        favoriteBot: 'Pass Line with max odds',
        catchphrase: '"Fortune favors the bold!"'
    },
    {
        id: 1,
        name: 'Bob "The Calculator"',
        description: 'Statistical genius who calculates every probability',
        strategy: 'Mathematical optimization',
        favoriteBot: "Don't Pass with calculated hedges",
        catchphrase: '"The numbers never lie."'
    },
    {
        id: 2,
        name: 'Charlie "Lucky Charm"',
        description: 'Superstitious player with elaborate rituals',
        strategy: 'Pattern-based betting',
        favoriteBot: 'Field bets on "lucky" numbers',
        catchphrase: '"My dice are blessed!"'
    },
    {
        id: 3,
        name: 'Diana "Ice Queen"',
        description: 'Cold, methodical player who never shows emotion',
        strategy: 'Disciplined bankroll management',
        favoriteBot: 'Conservative Place bets',
        catchphrase: '"Emotions are for losers."'
    },
    {
        id: 4,
        name: 'Eddie "The Entertainer"',
        description: 'Showman who makes every roll a spectacle',
        strategy: 'Crowd-pleasing bets',
        favoriteBot: 'Horn and Hardways',
        catchphrase: '"Let\'s make this interesting!"'
    }
];

export const manageBots = async (publicClient, walletClient, account) => {
    console.clear();
    console.log(chalk.magenta.bold('\n🤖 BOT PERSONALITY MANAGER 🤖\n'));
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                'View All Bot Personalities',
                'Bot Performance Analysis',
                'Follow a Bot Strategy',
                'Bot Vault Status',
                'Bot Chat Simulation',
                'Back to Main Menu'
            ]
        }
    ]);
    
    switch (action) {
        case 'View All Bot Personalities':
            await viewBotPersonalities();
            break;
            
        case 'Bot Performance Analysis':
            await analyzeBotPerformance();
            break;
            
        case 'Follow a Bot Strategy':
            await followBotStrategy();
            break;
            
        case 'Bot Vault Status':
            await checkBotVaults(publicClient);
            break;
            
        case 'Bot Chat Simulation':
            await botChatSimulation();
            break;
    }
    
    if (action !== 'Back to Main Menu') {
        await manageBots(publicClient, walletClient, account);
    }
};

const viewBotPersonalities = async () => {
    console.log(chalk.cyan('\n🎭 Bot Personalities:\n'));
    
    for (const bot of BOT_PERSONALITIES) {
        console.log(chalk.yellow(`\n${bot.name}`));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`📝 ${bot.description}`);
        console.log(`🎯 Strategy: ${chalk.cyan(bot.strategy)}`);
        console.log(`🎲 Favorite: ${chalk.green(bot.favoriteBot)}`);
        console.log(`💬 "${chalk.italic(bot.catchphrase)}"`);
    }
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const analyzeBotPerformance = async () => {
    console.log(chalk.cyan('\n📈 Bot Performance Analysis:\n'));
    
    const spinner = ora('Analyzing bot strategies...').start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    spinner.succeed('Analysis complete!');
    
    const table = new Table({
        head: [
            chalk.cyan('Bot'),
            chalk.cyan('30d ROI'),
            chalk.cyan('Avg Bet'),
            chalk.cyan('Risk Level'),
            chalk.cyan('Consistency')
        ],
        colWidths: [18, 12, 12, 12, 12]
    });
    
    table.push(
        ['Alice All-In', chalk.red('-12.3%'), '25 ETH', chalk.red('HIGH'), '⭐⭐'],
        ['Bob Calculator', chalk.green('+8.7%'), '5 ETH', chalk.yellow('MED'), '⭐⭐⭐⭐⭐'],
        ['Charlie Lucky', chalk.green('+3.2%'), '8 ETH', chalk.yellow('MED'), '⭐⭐⭐'],
        ['Diana Ice Queen', chalk.green('+5.4%'), '3 ETH', chalk.green('LOW'), '⭐⭐⭐⭐'],
        ['Eddie Show', chalk.red('-2.1%'), '10 ETH', chalk.red('HIGH'), '⭐']
    );
    
    console.log(table.toString());
    
    console.log(chalk.gray('\n💡 Tip: Bob Calculator has the best risk-adjusted returns'));
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const followBotStrategy = async () => {
    const { bot } = await inquirer.prompt([
        {
            type: 'list',
            name: 'bot',
            message: 'Which bot strategy would you like to follow?',
            choices: BOT_PERSONALITIES.map(b => b.name)
        }
    ]);
    
    const selectedBot = BOT_PERSONALITIES.find(b => b.name === bot);
    
    console.log(chalk.green(`\n✅ Now following ${selectedBot.name}'s strategy`));
    console.log(chalk.yellow('\nStrategy Details:'));
    console.log(`• ${selectedBot.strategy}`);
    console.log(`• Preferred bet: ${selectedBot.favoriteBot}`);
    console.log(`• Risk profile: ${selectedBot.id < 2 ? 'High' : selectedBot.id < 4 ? 'Medium' : 'Low'}`);
    
    console.log(chalk.cyan('\n📋 Recommended next bets:'));
    if (selectedBot.id === 0) {
        console.log('1. Pass Line: 10 ETH');
        console.log('2. Odds bet: 20 ETH (when point established)');
        console.log('3. Come bet: 10 ETH');
    } else if (selectedBot.id === 1) {
        console.log("1. Don't Pass: 5 ETH");
        console.log('2. Lay odds: 10 ETH (2x odds)');
        console.log('3. Place 6/8: 3 ETH each');
    }
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const checkBotVaults = async (publicClient) => {
    console.log(chalk.cyan('\n💰 Bot Vault Status:\n'));
    
    const spinner = ora('Fetching vault data...').start();
    await new Promise(resolve => setTimeout(resolve, 1500));
    spinner.succeed('Vault data loaded!');
    
    const vaultTable = new Table({
        head: [
            chalk.cyan('Bot'),
            chalk.cyan('Vault TVL'),
            chalk.cyan('LP Shares'),
            chalk.cyan('24h Volume'),
            chalk.cyan('APY')
        ],
        colWidths: [18, 15, 12, 12, 10]
    });
    
    vaultTable.push(
        ['Alice All-In', '234.5 ETH', '1,234', '45.6 ETH', '12.3%'],
        ['Bob Calculator', '567.8 ETH', '2,456', '67.8 ETH', '8.7%'],
        ['Charlie Lucky', '123.4 ETH', '890', '23.4 ETH', '10.2%'],
        ['Diana Ice Queen', '456.7 ETH', '1,789', '34.5 ETH', '9.4%'],
        ['Eddie Show', '89.0 ETH', '456', '12.3 ETH', '11.8%']
    );
    
    console.log(vaultTable.toString());
    console.log(chalk.yellow('\nTotal TVL: 1,471.4 ETH'));
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const botChatSimulation = async () => {
    console.log(chalk.magenta('\n💬 Bot Chat Room:\n'));
    
    const messages = [
        { bot: 'Alice All-In', message: "Who's ready to go ALL IN?! 🚀", color: chalk.red },
        { bot: 'Bob Calculator', message: 'Statistically, that\'s a terrible idea Alice.', color: chalk.blue },
        { bot: 'Charlie Lucky', message: 'My lucky socks say the next roll is a 7! 🍀', color: chalk.green },
        { bot: 'Diana Ice Queen', message: 'Luck is irrelevant. Only discipline matters.', color: chalk.cyan },
        { bot: 'Eddie Show', message: 'Ladies and gentlemen, watch THIS! *rolls dramatically*', color: chalk.yellow },
        { bot: 'Alice All-In', message: 'BOOM! Natural! Who doubted me?!', color: chalk.red },
        { bot: 'Bob Calculator', message: 'Even a broken clock is right twice a day...', color: chalk.blue }
    ];
    
    for (const msg of messages) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(msg.color(`${msg.bot}: ${msg.message}`));
    }
    
    console.log(chalk.gray('\n[Bots continue arguing about optimal strategies...]'));
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};