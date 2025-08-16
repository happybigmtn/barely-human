import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import ora from 'ora';
import { parseEther, formatEther } from 'viem';

export const stakingMenu = async (publicClient, walletClient, account) => {
    console.clear();
    console.log(chalk.green.bold('\n🪙 BOT TOKEN STAKING 🪙\n'));
    
    // Simulated staking data
    const stakingData = {
        totalStaked: parseEther('2345678'),
        userStaked: parseEther('1000'),
        pendingRewards: parseEther('23.45'),
        apy: 8.7,
        rewardRate: parseEther('100'), // per day
        nextRewardIn: '2h 34m'
    };
    
    // Display staking overview
    const overviewTable = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        colWidths: [25, 25]
    });
    
    overviewTable.push(
        ['Total BOT Staked', `${formatEther(stakingData.totalStaked)} BOT`],
        ['Your Staked Balance', chalk.green(`${formatEther(stakingData.userStaked)} BOT`)],
        ['Pending Rewards', chalk.yellow(`${formatEther(stakingData.pendingRewards)} BOT`)],
        ['Current APY', `${stakingData.apy}%`],
        ['Daily Rewards', `${formatEther(stakingData.rewardRate)} BOT`],
        ['Next Distribution', stakingData.nextRewardIn]
    );
    
    console.log(overviewTable.toString());
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: '\nWhat would you like to do?',
            choices: [
                'Stake BOT Tokens',
                'Unstake BOT Tokens',
                'Claim Rewards',
                'View Staking History',
                'Calculate Returns',
                'Back to Main Menu'
            ]
        }
    ]);
    
    switch (action) {
        case 'Stake BOT Tokens':
            await stakeTokens(walletClient);
            break;
            
        case 'Unstake BOT Tokens':
            await unstakeTokens(walletClient, stakingData.userStaked);
            break;
            
        case 'Claim Rewards':
            await claimRewards(walletClient, stakingData.pendingRewards);
            break;
            
        case 'View Staking History':
            await viewStakingHistory();
            break;
            
        case 'Calculate Returns':
            await calculateReturns(stakingData.apy);
            break;
    }
    
    if (action !== 'Back to Main Menu') {
        await stakingMenu(publicClient, walletClient, account);
    }
};

const stakeTokens = async (walletClient) => {
    const { amount } = await inquirer.prompt([
        {
            type: 'input',
            name: 'amount',
            message: 'Amount of BOT to stake:',
            validate: (input) => {
                const val = parseFloat(input);
                if (isNaN(val) || val <= 0) return 'Please enter a valid amount';
                if (val < 1) return 'Minimum stake is 1 BOT';
                return true;
            }
        }
    ]);
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Stake ${amount} BOT tokens?`,
            default: true
        }
    ]);
    
    if (confirm) {
        const spinner = ora('Staking BOT tokens...').start();
        await new Promise(resolve => setTimeout(resolve, 2000));
        spinner.succeed(`Successfully staked ${amount} BOT!`);
        
        console.log(chalk.green('\n✅ Transaction Details:'));
        console.log(`• Amount: ${amount} BOT`);
        console.log(`• Est. Daily Rewards: ${(parseFloat(amount) * 0.087 / 365).toFixed(4)} BOT`);
        console.log(`• Lock Period: None (flexible staking)`);
    }
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const unstakeTokens = async (walletClient, currentStake) => {
    const maxUnstake = formatEther(currentStake);
    
    const { amount } = await inquirer.prompt([
        {
            type: 'input',
            name: 'amount',
            message: `Amount to unstake (max: ${maxUnstake} BOT):`,
            validate: (input) => {
                const val = parseFloat(input);
                if (isNaN(val) || val <= 0) return 'Please enter a valid amount';
                if (val > parseFloat(maxUnstake)) return 'Exceeds staked balance';
                return true;
            }
        }
    ]);
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Unstake ${amount} BOT tokens?`,
            default: true
        }
    ]);
    
    if (confirm) {
        const spinner = ora('Unstaking BOT tokens...').start();
        await new Promise(resolve => setTimeout(resolve, 2000));
        spinner.succeed(`Successfully unstaked ${amount} BOT!`);
        
        console.log(chalk.green('\n✅ Unstaking Complete:'));
        console.log(`• Amount: ${amount} BOT`);
        console.log(`• Returned to wallet: ${amount} BOT`);
        console.log(`• Remaining staked: ${parseFloat(maxUnstake) - parseFloat(amount)} BOT`);
    }
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const claimRewards = async (walletClient, pendingRewards) => {
    const rewardAmount = formatEther(pendingRewards);
    
    if (parseFloat(rewardAmount) === 0) {
        console.log(chalk.yellow('\n⚠️  No rewards to claim yet'));
        await inquirer.prompt([{ 
            type: 'input', 
            name: 'continue', 
            message: 'Press Enter to continue...' 
        }]);
        return;
    }
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Claim ${rewardAmount} BOT in rewards?`,
            default: true
        }
    ]);
    
    if (confirm) {
        const spinner = ora('Claiming rewards...').start();
        await new Promise(resolve => setTimeout(resolve, 2000));
        spinner.succeed(`Successfully claimed ${rewardAmount} BOT!`);
        
        console.log(chalk.green('\n✅ Rewards Claimed:'));
        console.log(`• Amount: ${rewardAmount} BOT`);
        console.log(`• Added to wallet balance`);
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do with rewards?',
                choices: ['Restake', 'Keep in wallet']
            }
        ]);
        
        if (action === 'Restake') {
            console.log(chalk.green(`\n✅ Automatically restaking ${rewardAmount} BOT...`));
        }
    }
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const viewStakingHistory = async () => {
    console.log(chalk.cyan('\n📜 Staking History:\n'));
    
    const historyTable = new Table({
        head: [
            chalk.cyan('Date'),
            chalk.cyan('Action'),
            chalk.cyan('Amount'),
            chalk.cyan('Status')
        ],
        colWidths: [20, 15, 15, 12]
    });
    
    historyTable.push(
        ['2024-01-15 14:23', 'Stake', '500 BOT', chalk.green('✓')],
        ['2024-01-14 09:15', 'Claim', '12.3 BOT', chalk.green('✓')],
        ['2024-01-13 16:45', 'Stake', '500 BOT', chalk.green('✓')],
        ['2024-01-10 11:30', 'Unstake', '100 BOT', chalk.green('✓')],
        ['2024-01-07 13:20', 'Claim', '8.7 BOT', chalk.green('✓')]
    );
    
    console.log(historyTable.toString());
    
    console.log(chalk.gray('\n📊 Summary:'));
    console.log(`• Total Staked: 1,000 BOT`);
    console.log(`• Total Claimed: 21.0 BOT`);
    console.log(`• Average APY: 8.4%`);
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};

const calculateReturns = async (currentAPY) => {
    const { amount, days } = await inquirer.prompt([
        {
            type: 'input',
            name: 'amount',
            message: 'Amount to stake (BOT):',
            default: '1000'
        },
        {
            type: 'input',
            name: 'days',
            message: 'Staking period (days):',
            default: '365'
        }
    ]);
    
    const principal = parseFloat(amount);
    const periods = parseFloat(days);
    const dailyRate = currentAPY / 365 / 100;
    
    // Calculate compound interest
    const finalAmount = principal * Math.pow(1 + dailyRate, periods);
    const rewards = finalAmount - principal;
    
    console.log(chalk.cyan('\n📈 Staking Returns Calculator:\n'));
    
    const calcTable = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        colWidths: [25, 20]
    });
    
    calcTable.push(
        ['Initial Stake', `${amount} BOT`],
        ['Staking Period', `${days} days`],
        ['Current APY', `${currentAPY}%`],
        [''],
        ['Expected Rewards', chalk.green(`${rewards.toFixed(2)} BOT`)],
        ['Final Balance', chalk.green(`${finalAmount.toFixed(2)} BOT`)],
        ['ROI', chalk.green(`${((rewards / principal) * 100).toFixed(2)}%`)]
    );
    
    console.log(calcTable.toString());
    
    await inquirer.prompt([{ 
        type: 'input', 
        name: 'continue', 
        message: '\nPress Enter to continue...' 
    }]);
};