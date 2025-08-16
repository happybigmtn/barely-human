import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import ora from 'ora';
import { parseEther, formatEther } from 'viem';

export const vaultMenu = async (publicClient, walletClient, account) => {
    console.clear();
    console.log(chalk.blue.bold('\n💰 VAULT MANAGEMENT 💰\n'));
    
    // Display vault overview
    const overviewTable = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        colWidths: [25, 25]
    });
    
    overviewTable.push(
        ['Total TVL', '1,471.4 ETH'],
        ['Your LP Shares', '523 shares'],
        ['Share Value', '2.34 ETH/share'],
        ['Your Position', chalk.green('1,223.82 ETH')],
        ['24h Performance', chalk.green('+2.3%')],
        ['Performance Fee', '2%']
    );
    
    console.log(overviewTable.toString());
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: '\nSelect action:',
            choices: [
                'Deposit to Vault',
                'Withdraw from Vault',
                'View Bot Vault Details',
                'LP Share Management',
                'Vault Performance',
                'Back to Main Menu'
            ]
        }
    ]);
    
    switch (action) {
        case 'Deposit to Vault':
            await depositToVault(walletClient);
            break;
            
        case 'Withdraw from Vault':
            await withdrawFromVault(walletClient);
            break;
            
        case 'View Bot Vault Details':
            await viewBotVaultDetails();
            break;
            
        case 'LP Share Management':
            await manageLPShares();
            break;
            
        case 'Vault Performance':
            await viewVaultPerformance();
            break;
    }
    
    if (action !== 'Back to Main Menu') {
        await vaultMenu(publicClient, walletClient, account);
    }
};

const depositToVault = async (walletClient) => {
    const { vault } = await inquirer.prompt([
        {
            type: 'list',
            name: 'vault',
            message: 'Select vault to deposit:',
            choices: [
                'Alice All-In Vault (High Risk/Reward)',
                'Bob Calculator Vault (Balanced)',
                'Diana Ice Queen Vault (Conservative)',
                'General Casino Vault (Mixed Strategy)'
            ]
        }
    ]);
    
    const { amount } = await inquirer.prompt([
        {
            type: 'input',
            name: 'amount',
            message: 'Deposit amount (ETH):',
            validate: (input) => {
                const val = parseFloat(input);
                if (isNaN(val) || val <= 0) return 'Please enter a valid amount';
                if (val < 0.1) return 'Minimum deposit is 0.1 ETH';
                return true;
            }
        }
    ]);
    
    // Calculate shares
    const sharePrice = 2.34; // ETH per share
    const shares = parseFloat(amount) / sharePrice;
    
    console.log(chalk.cyan('\n📊 Deposit Preview:'));
    console.log(`• Vault: ${vault}`);
    console.log(`• Amount: ${amount} ETH`);
    console.log(`• Est. Shares: ${shares.toFixed(2)}`);
    console.log(`• Share Price: ${sharePrice} ETH`);
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Confirm deposit?',
            default: true
        }
    ]);
    
    if (confirm) {
        const spinner = ora('Processing deposit...').start();
        await new Promise(resolve => setTimeout(resolve, 2000));
        spinner.succeed(`Deposited ${amount} ETH successfully!`);
        
        console.log(chalk.green('\n✅ Deposit Complete:'));
        console.log(`• Received: ${shares.toFixed(2)} LP shares`);
        console.log(`• Vault APY: 12.3%`);
        console.log(`• Est. Daily Earnings: ${(parseFloat(amount) * 0.123 / 365).toFixed(4)} ETH`);
    }
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const withdrawFromVault = async (walletClient) => {
    const userShares = 523;
    const sharePrice = 2.34;
    
    const { shares } = await inquirer.prompt([
        {
            type: 'input',
            name: 'shares',
            message: `Shares to withdraw (max: ${userShares}):`,
            validate: (input) => {
                const val = parseFloat(input);
                if (isNaN(val) || val <= 0) return 'Please enter a valid amount';
                if (val > userShares) return 'Exceeds your share balance';
                return true;
            }
        }
    ]);
    
    const ethAmount = parseFloat(shares) * sharePrice;
    const performanceFee = ethAmount * 0.02; // 2% fee
    const netAmount = ethAmount - performanceFee;
    
    console.log(chalk.cyan('\n📊 Withdrawal Preview:'));
    console.log(`• Shares: ${shares}`);
    console.log(`• Share Value: ${ethAmount.toFixed(4)} ETH`);
    console.log(`• Performance Fee (2%): ${performanceFee.toFixed(4)} ETH`);
    console.log(`• Net Withdrawal: ${chalk.green(netAmount.toFixed(4) + ' ETH')}`);
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Confirm withdrawal?',
            default: true
        }
    ]);
    
    if (confirm) {
        const spinner = ora('Processing withdrawal...').start();
        await new Promise(resolve => setTimeout(resolve, 2000));
        spinner.succeed(`Withdrawn ${netAmount.toFixed(4)} ETH successfully!`);
        
        console.log(chalk.green('\n✅ Withdrawal Complete'));
    }
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const viewBotVaultDetails = async () => {
    console.log(chalk.cyan('\n🤖 Bot Vault Details:\n'));
    
    const vaultTable = new Table({
        head: [
            chalk.cyan('Bot Vault'),
            chalk.cyan('TVL'),
            chalk.cyan('24h Vol'),
            chalk.cyan('Win Rate'),
            chalk.cyan('APY')
        ],
        colWidths: [20, 12, 12, 12, 10]
    });
    
    vaultTable.push(
        ['Alice All-In', '234.5 ETH', '45.6 ETH', '42.3%', '15.2%'],
        ['Bob Calculator', '567.8 ETH', '67.8 ETH', '58.2%', '12.3%'],
        ['Charlie Lucky', '123.4 ETH', '23.4 ETH', '51.3%', '10.8%'],
        ['Diana Ice Queen', '456.7 ETH', '34.5 ETH', '55.7%', '9.4%'],
        ['Eddie Show', '89.0 ETH', '12.3 ETH', '47.8%', '11.2%'],
        ['Fiona Fearless', '178.9 ETH', '28.9 ETH', '49.2%', '10.5%'],
        ['Greg Grinder', '234.5 ETH', '31.2 ETH', '52.1%', '11.8%'],
        ['Helen Hot', '156.7 ETH', '19.8 ETH', '46.3%', '13.1%'],
        ['Ivan Intimidator', '289.0 ETH', '42.1 ETH', '53.4%', '12.7%'],
        ['Julia Jinx', '141.4 ETH', '17.6 ETH', '44.8%', '14.3%']
    );
    
    console.log(vaultTable.toString());
    
    console.log(chalk.yellow('\n📈 Vault Strategies:'));
    console.log('• Alice: Maximum aggression, all-in on streaks');
    console.log('• Bob: Mathematical edge, conservative bankroll');
    console.log('• Diana: Strict stop-loss, disciplined betting');
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const manageLPShares = async () => {
    console.log(chalk.cyan('\n📊 LP Share Management:\n'));
    
    const sharesTable = new Table({
        head: [
            chalk.cyan('Vault'),
            chalk.cyan('Shares'),
            chalk.cyan('Value'),
            chalk.cyan('% of Pool')
        ],
        colWidths: [25, 12, 15, 12]
    });
    
    sharesTable.push(
        ['Bob Calculator Vault', '234', '547.56 ETH', '2.3%'],
        ['Diana Ice Queen Vault', '189', '442.26 ETH', '1.8%'],
        ['General Casino Vault', '100', '234.00 ETH', '0.9%']
    );
    
    console.log(sharesTable.toString());
    console.log(chalk.green('\nTotal Position: 1,223.82 ETH'));
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Share management:',
            choices: [
                'Transfer Shares',
                'Split Shares',
                'Merge Positions',
                'View Share History',
                'Back'
            ]
        }
    ]);
    
    if (action === 'View Share History') {
        console.log(chalk.gray('\n📜 Recent Activity:'));
        console.log('• 2024-01-15: +50 shares (Bob Vault) - Deposit');
        console.log('• 2024-01-14: -20 shares (Alice Vault) - Withdrawal');
        console.log('• 2024-01-13: +100 shares (General Vault) - Deposit');
    }
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const viewVaultPerformance = async () => {
    console.log(chalk.cyan('\n📈 Vault Performance Analysis:\n'));
    
    const perfTable = new Table({
        head: [
            chalk.cyan('Period'),
            chalk.cyan('P&L'),
            chalk.cyan('ROI'),
            chalk.cyan('Volume')
        ],
        colWidths: [15, 15, 12, 15]
    });
    
    perfTable.push(
        ['24 Hours', chalk.green('+28.3 ETH'), chalk.green('+2.3%'), '324.5 ETH'],
        ['7 Days', chalk.green('+156.7 ETH'), chalk.green('+12.8%'), '2,134 ETH'],
        ['30 Days', chalk.green('+423.1 ETH'), chalk.green('+34.5%'), '8,567 ETH'],
        ['All Time', chalk.green('+1,234 ETH'), chalk.green('+156%'), '45,678 ETH']
    );
    
    console.log(perfTable.toString());
    
    console.log(chalk.yellow('\n🏆 Top Performing Strategies:'));
    console.log('1. Bob Calculator: +67.8 ETH this month');
    console.log('2. Diana Ice Queen: +45.2 ETH this month');
    console.log('3. Ivan Intimidator: +38.9 ETH this month');
    
    console.log(chalk.gray('\n💡 Insight: Conservative strategies outperforming in current market'));
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};