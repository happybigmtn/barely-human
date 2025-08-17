/**
 * Contract ABIs for Barely Human Casino
 * Simplified function signatures for CLI interaction
 */

export const CONTRACT_ABIS = {
  BOTToken: [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)"
  ],
  
  CrapsGame: [
    "function currentSeriesId() view returns (uint256)",
    "function gamePhase() view returns (uint8)",
    "function currentPoint() view returns (uint256)",
    "function rollDice()",
    "function getSeriesInfo(uint256) view returns (tuple(uint256,uint256,uint8,uint256,uint256,uint256))"
  ],
  
  CrapsBets: [
    "function placeBet(uint256 betType, uint256 amount)",
    "function getBetInfo(uint256 betId) view returns (tuple(address,uint256,uint256,uint256,bool,bool))",
    "function playerBets(address player, uint256 index) view returns (uint256)"
  ],
  
  CrapsVault: [
    "function deposit(uint256 assets, address receiver) returns (uint256)",
    "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
    "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function totalAssets() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function convertToShares(uint256 assets) view returns (uint256)",
    "function convertToAssets(uint256 shares) view returns (uint256)",
    "function previewDeposit(uint256 assets) view returns (uint256)",
    "function previewWithdraw(uint256 assets) view returns (uint256)"
  ],
  
  StakingPool: [
    "function stake(uint256 amount)",
    "function withdraw(uint256 amount)",
    "function claimRewards()",
    "function getStakedBalance(address) view returns (uint256)",
    "function getRewardBalance(address) view returns (uint256)",
    "function totalStaked() view returns (uint256)"
  ],
  
  Treasury: [
    "function getBalance() view returns (uint256)",
    "function distributeFees()",
    "function withdrawEmergency()",
    "function getTreasuryStats() view returns (tuple(uint256,uint256,uint256,uint256))"
  ],
  
  BotManager: [
    "function getBotInfo(uint256 botId) view returns (tuple(string,uint256,uint256,uint256,uint256))",
    "function activeBots() view returns (uint256)",
    "function getBotPerformance(uint256 botId) view returns (tuple(uint256,uint256,uint256,uint256))"
  ]
};