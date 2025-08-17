import { ethers } from 'ethers';
import fs from 'fs';

async function testAllContracts() {
  try {
    const config = JSON.parse(fs.readFileSync('./deployments/localhost.json', 'utf8'));
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const signer = new ethers.Wallet(privateKey, provider);
    
    console.log('Testing all deployed contracts...\n');
    
    // Test BOTToken (this worked before)
    console.log('=== BOTToken ===');
    const botToken = new ethers.Contract(
      config.contracts.BOTToken,
      [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)"
      ],
      signer
    );
    
    try {
      const name = await botToken.name();
      const symbol = await botToken.symbol();
      const totalSupply = await botToken.totalSupply();
      const balance = await botToken.balanceOf(signer.address);
      console.log(`✅ Name: ${name}, Symbol: ${symbol}`);
      console.log(`✅ Total Supply: ${ethers.formatEther(totalSupply)}`);
      console.log(`✅ Balance: ${ethers.formatEther(balance)}`);
    } catch (error) {
      console.log(`❌ BOTToken error: ${error.message}`);
    }
    
    // Test StakingPool
    console.log('\n=== StakingPool ===');
    const stakingPool = new ethers.Contract(
      config.contracts.StakingPool,
      [
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)"
      ],
      signer
    );
    
    try {
      const totalSupply = await stakingPool.totalSupply();
      const balance = await stakingPool.balanceOf(signer.address);
      console.log(`✅ Total Supply: ${totalSupply}`);
      console.log(`✅ Balance: ${balance}`);
    } catch (error) {
      console.log(`❌ StakingPool error: ${error.message}`);
    }
    
    // Test BotManagerV2Plus
    console.log('\n=== BotManagerV2Plus ===');
    const botManager = new ethers.Contract(
      config.contracts.BotManagerV2Plus,
      [
        "function getBotCount() view returns (uint256)"
      ],
      signer
    );
    
    try {
      const botCount = await botManager.getBotCount();
      console.log(`✅ Bot Count: ${botCount}`);
    } catch (error) {
      console.log(`❌ BotManagerV2Plus error: ${error.message}`);
    }
    
    // Test Treasury
    console.log('\n=== Treasury ===');
    const treasury = new ethers.Contract(
      config.contracts.Treasury,
      [
        "function totalFeesCollected() view returns (uint256)"
      ],
      signer
    );
    
    try {
      const totalFees = await treasury.totalFeesCollected();
      console.log(`✅ Total Fees: ${totalFees}`);
    } catch (error) {
      console.log(`❌ Treasury error: ${error.message}`);
    }
    
    // Check if contracts have code deployed
    console.log('\n=== Contract Code Check ===');
    for (const [name, address] of Object.entries(config.contracts)) {
      const code = await provider.getCode(address);
      console.log(`${name}: ${code === '0x' ? '❌ No code' : '✅ Has code'} (${code.length} bytes)`);
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testAllContracts();