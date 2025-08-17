import { ethers } from 'ethers';
import fs from 'fs';

const CONTRACT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

async function testContractMethods() {
  try {
    // Load deployment config
    const config = JSON.parse(fs.readFileSync('./deployments/localhost.json', 'utf8'));
    
    // Connect to local network
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const signer = new ethers.Wallet(privateKey, provider);
    
    // Create contract instance
    const botToken = new ethers.Contract(
      config.contracts.BOTToken,
      CONTRACT_ABI,
      signer
    );
    
    console.log('Testing contract methods...');
    console.log('Contract address:', botToken.target);
    console.log('Available methods:', Object.getOwnPropertyNames(botToken));
    
    // Test if methods exist
    console.log('balanceOf method exists:', typeof botToken.balanceOf);
    console.log('totalSupply method exists:', typeof botToken.totalSupply);
    
    // Try calling methods
    const totalSupply = await botToken.totalSupply();
    console.log('Total Supply:', ethers.formatEther(totalSupply));
    
    const balance = await botToken.balanceOf(signer.address);
    console.log('Balance:', ethers.formatEther(balance));
    
    const name = await botToken.name();
    console.log('Token Name:', name);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testContractMethods();