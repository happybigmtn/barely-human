import { network } from "hardhat";
import { formatEther } from "viem";
import fs from 'fs';

async function main() {
    const connection = await network.connect();
    const { viem } = connection;
    
    const config = JSON.parse(fs.readFileSync('./deployments/localhost.json', 'utf8'));
    const [deployer] = await viem.getWalletClients();
    
    console.log('Checking account balances...');
    console.log('Deployer address:', deployer.account.address);
    
    // Get BOT token contract
    const botToken = await viem.getContractAt("BOTToken", config.contracts.BOTToken);
    
    const balance = await botToken.read.balanceOf([deployer.account.address]);
    const totalSupply = await botToken.read.totalSupply();
    
    console.log('BOT Balance:', formatEther(balance), 'BOT');
    console.log('Total Supply:', formatEther(totalSupply), 'BOT');
    
    // Check treasury balance
    const treasuryBalance = await botToken.read.balanceOf([config.accounts.treasury]);
    console.log('Treasury Balance:', formatEther(treasuryBalance), 'BOT');
    
    await connection.close();
}

main().catch(console.error);