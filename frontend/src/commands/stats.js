import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import inquirer from 'inquirer';

export const viewStats = async (publicClient, account) => {
    console.clear();
    console.log(chalk.cyan.bold('\n📊 STATISTICS DASHBOARD 📊\n'));
    
    const spinner = ora('Loading stats...').start();
    await new Promise(resolve => setTimeout(resolve, 1500));
    spinner.succeed('Stats loaded!');
    
    // Personal Stats
    console.log(chalk.yellow('\n👤 Personal Statistics:\n'));
    const personalTable = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        colWidths: [25, 20]
    });
    
    personalTable.push(
        ['Games Played', '42'],
        ['Total Wagered', '127.5 ETH'],
        ['Total Won', '143.2 ETH'],
        ['Net Profit', chalk.green('+15.7 ETH')],
        ['Win Rate', '54.8%'],
        ['Favorite Bet', 'Pass Line'],
        ['Lucky Number', '8'],
        ['Shooter Wins', '12/18 (66.7%)']
    );
    
    console.log(personalTable.toString());
    
    // Bot Performance
    console.log(chalk.magenta('\n🤖 Bot Performance:\n'));
    const botTable = new Table({
        head: [chalk.cyan('Bot'), chalk.cyan('Games'), chalk.cyan('Profit'), chalk.cyan('Win Rate')],
        colWidths: [20, 10, 15, 12]
    });
    
    botTable.push(
        ['Alice All-In', '156', chalk.red('-23.4 ETH'), '42.3%'],
        ['Bob Calculator', '203', chalk.green('+67.8 ETH'), '58.2%'],
        ['Charlie Lucky', '189', chalk.green('+12.1 ETH'), '51.3%'],
        ['Diana Ice Queen', '167', chalk.green('+34.5 ETH'), '55.7%'],
        ['Eddie Entertainer', '145', chalk.red('-5.6 ETH'), '47.8%']
    );
    
    console.log(botTable.toString());
    
    // Global Stats
    console.log(chalk.blue('\n🌍 Global Statistics:\n'));
    const globalTable = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        colWidths: [25, 20]
    });
    
    globalTable.push(
        ['Total Games', '1,234'],
        ['Total Volume', '45,678 ETH'],
        ['House Profit', '823.4 ETH'],
        ['Active Players', '89'],
        ['BOT Staked', '2.3M BOT'],
        ['NFT Passes Minted', '234'],
        ['Current Series', '#42']
    );
    
    console.log(globalTable.toString());
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to return to menu...' 
    }]);
};