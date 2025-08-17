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
  
  CrapsGameV2Plus: [
    "function currentSeriesId() view returns (uint256)",
    "function getCurrentPhase() view returns (uint8)",
    "function getCurrentPoint() view returns (uint256)",
    "function rollDice() returns (uint256)",
    "function getSeriesInfo(uint256) view returns (tuple(uint256,uint256,uint8,uint256,uint256,uint256))",
    "function isGameActive() view returns (bool)",
    "function canPlaceBet(uint8) view returns (bool)",
    "function initializeGame()",
    "function getGameState() view returns (tuple(uint8,uint256,bool,uint256))"
  ],
  
  CrapsBets: [
    "function placeBet(uint8 betType, uint256 amount)",
    "function getBetInfo(address player, uint8 betType) view returns (tuple(uint256,uint256,bool,bool))",
    "function playerBets(address player, uint8 betType) view returns (tuple(uint256,uint256,bool,bool))",
    "function getPlayerActiveBets(address player) view returns (uint8[])"
  ],
  
  // Alias for backwards compatibility
  CrapsGame: [
    "function currentSeriesId() view returns (uint256)",
    "function getCurrentPhase() view returns (uint8)",
    "function getCurrentPoint() view returns (uint256)",
    "function rollDice() returns (uint256)",
    "function getSeriesInfo(uint256) view returns (tuple(uint256,uint256,uint8,uint256,uint256,uint256))",
    "function isGameActive() view returns (bool)",
    "function canPlaceBet(uint8) view returns (bool)"
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
    "function getReward()",
    "function balanceOf(address) view returns (uint256)",
    "function earned(address) view returns (uint256)",
    "function totalStaked() view returns (uint256)",
    "function rewardRate() view returns (uint256)",
    "function rewardPerToken() view returns (uint256)",
    "function getRewardForDuration() view returns (uint256)"
  ],
  
  Treasury: [
    "function accumulatedFees(address) view returns (uint256)",
    "function distributeBotFees()",
    "function totalFeesCollected() view returns (uint256)",
    "function totalFeesDistributed() view returns (uint256)",
    "function stakingRewardsPct() view returns (uint256)",
    "function getAccumulatedFees(address) view returns (uint256)",
    "function getTotalStats() view returns (tuple(uint256,uint256,uint256,uint256))"
  ],
  
  BotManagerV2Plus: [
    "function getBotCount() view returns (uint256)",
    "function getBotPersonality(uint256 botId) view returns (tuple(string,uint8,uint8,uint8,address))",
    "function getBettingStrategy(uint256 botId) view returns (tuple(uint8,uint256,uint256,uint8))",
    "function getBotVault(uint256 botId) view returns (address)",
    "function isDecisionPending(uint256 requestId) view returns (bool)"
  ],
  
  // Alias for backwards compatibility
  BotManager: [
    "function getBotCount() view returns (uint256)",
    "function getBotPersonality(uint256 botId) view returns (tuple(string,uint8,uint8,uint8,address))",
    "function getBettingStrategy(uint256 botId) view returns (tuple(uint8,uint256,uint256,uint8))",
    "function getBotVault(uint256 botId) view returns (address)",
    "function isDecisionPending(uint256 requestId) view returns (bool)"
  ]
};