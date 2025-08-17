import { ethers } from 'ethers';
import fs from 'fs';

async function testGameState() {
  try {
    const config = JSON.parse(fs.readFileSync('./deployments/localhost.json', 'utf8'));
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const signer = new ethers.Wallet(privateKey, provider);
    
    const gameContract = new ethers.Contract(
      config.contracts.CrapsGameV2Plus,
      [
        "function getCurrentPhase() view returns (uint8)",
        "function isGameActive() view returns (bool)",  
        "function currentSeriesId() view returns (uint256)",
        "function getCurrentPoint() view returns (uint256)",
        "function initializeGame()",
        "function startNewSeries()"
      ],
      signer
    );
    
    console.log('Testing CrapsGameV2Plus state...');
    
    // Check current state
    try {
      const currentPhase = await gameContract.getCurrentPhase();
      console.log('Current Phase:', currentPhase);
    } catch (error) {
      console.log('getCurrentPhase error:', error.message);
    }
    
    try {
      const isActive = await gameContract.isGameActive();
      console.log('Is Game Active:', isActive);
    } catch (error) {
      console.log('isGameActive error:', error.message);
    }
    
    try {
      const seriesId = await gameContract.currentSeriesId();
      console.log('Current Series ID:', seriesId);
    } catch (error) {
      console.log('currentSeriesId error:', error.message);
    }
    
    // Try to initialize the game
    try {
      console.log('Attempting to initialize game...');
      const tx = await gameContract.initializeGame();
      await tx.wait();
      console.log('Game initialized successfully');
      
      // Check state again
      const phase = await gameContract.getCurrentPhase();
      console.log('Phase after init:', phase);
    } catch (error) {
      console.log('Initialize error:', error.message);
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testGameState();