import { BigInt, BigDecimal, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  User,
  Protocol,
  DailyMetric,
  HourlyMetric,
  Bot,
  Vault,
  StakingPool,
  StakingPosition,
  Treasury,
  BOTToken,
  TokenHolder,
  BotPerformance
} from "../../generated/schema";

// Constants
export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ZERO_BD = BigDecimal.fromString("0");
export const ONE_BD = BigDecimal.fromString("1");
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_HOUR = 3600;
export const ADDRESS_ZERO = Address.fromString("0x0000000000000000000000000000000000000000");

// Protocol helpers
export function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load("protocol");
  if (!protocol) {
    protocol = new Protocol("protocol");
    protocol.totalGamesPlayed = ZERO_BI;
    protocol.totalAmountWagered = ZERO_BD;
    protocol.totalPayouts = ZERO_BD;
    protocol.totalPlayers = ZERO_BI;
    protocol.totalBots = BigInt.fromI32(10); // We have 10 bots
    protocol.totalVaultTVL = ZERO_BD;
    protocol.totalStaked = ZERO_BD;
    protocol.totalTreasuryFees = ZERO_BD;
    protocol.totalDistributed = ZERO_BD;
    protocol.totalBuybacks = ZERO_BI;
    protocol.totalTokensBoughtBack = ZERO_BD;
    protocol.totalRaffles = ZERO_BI;
    protocol.activeRaffles = ZERO_BI;
    protocol.totalWinners = ZERO_BI;
    protocol.totalMintPasses = ZERO_BI;
    protocol.mintPassesRedeemed = ZERO_BI;
    protocol.totalGenerativeArt = ZERO_BI;
    protocol.totalBettingRounds = ZERO_BI;
    protocol.activeBettingRounds = ZERO_BI;
    protocol.settledBettingRounds = ZERO_BI;
    protocol.canceledBettingRounds = ZERO_BI;
    protocol.totalBotBets = ZERO_BI;
    protocol.totalBotBetVolume = ZERO_BD;
    protocol.totalBotBetPayouts = ZERO_BD;
    protocol.totalBotBetWithdrawals = ZERO_BD;
    protocol.totalHouseFees = ZERO_BD;
    protocol.totalSwapFees = ZERO_BD;
    protocol.swapFeeCollections = ZERO_BI;
    protocol.swapFeesSentToTreasury = ZERO_BD;
    protocol.totalTokenSupply = BigDecimal.fromString("1000000000"); // 1B tokens
    protocol.tokenHolders = ZERO_BI;
    protocol.totalTokenTransfers = ZERO_BI;
    protocol.totalTokenVolume = ZERO_BD;
    protocol.totalTokenApprovals = ZERO_BI;
    protocol.tokenPaused = false;
    protocol.lastUpdated = ZERO_BI;
    protocol.save();
  }
  return protocol;
}

// User helpers
export function getOrCreateUser(address: Address): User {
  let user = User.load(address.toHexString());
  if (!user) {
    user = new User(address.toHexString());
    user.totalBetsPlaced = ZERO_BI;
    user.totalAmountWagered = ZERO_BD;
    user.totalWinnings = ZERO_BD;
    user.totalLosses = ZERO_BD;
    user.netPnL = ZERO_BD;
    user.gamesPlayed = ZERO_BI;
    user.winRate = ZERO_BD;
    user.favoriteGame = null;
    user.firstSeenBlock = ZERO_BI;
    user.lastActiveBlock = ZERO_BI;
    user.raffleEntriesCount = ZERO_BI;
    user.mintPassesOwned = ZERO_BI;
    user.mintPassesRedeemed = ZERO_BI;
    user.generativeArtOwned = ZERO_BI;
    user.totalBotBets = ZERO_BI;
    user.totalBotBetAmount = ZERO_BD;
    user.totalBotBetWinnings = ZERO_BD;
    
    // Update protocol player count
    let protocol = getOrCreateProtocol();
    protocol.totalPlayers = protocol.totalPlayers.plus(ONE_BI);
    protocol.save();
    
    user.save();
  }
  return user;
}

export function updateUserStats(user: User, won: boolean, amount: BigDecimal, payout: BigDecimal): void {
  if (won) {
    user.totalWinnings = user.totalWinnings.plus(payout);
  } else {
    user.totalLosses = user.totalLosses.plus(amount);
  }
  
  let pnl = won ? payout.minus(amount) : amount.times(BigDecimal.fromString("-1"));
  user.netPnL = user.netPnL.plus(pnl);
  
  // Update win rate
  if (user.totalBetsPlaced.gt(ZERO_BI)) {
    let winnings = user.totalWinnings;
    let totalWagered = user.totalAmountWagered;
    if (totalWagered.gt(ZERO_BD)) {
      user.winRate = winnings.div(totalWagered).times(BigDecimal.fromString("100"));
    }
  }
}

// Bot helpers
export function getOrCreateBot(botId: BigInt): Bot {
  let bot = Bot.load(botId.toString());
  if (!bot) {
    bot = new Bot(botId.toString());
    bot.name = getBotName(botId);
    bot.personality = getBotPersonality(botId);
    bot.bettingStrategy = getBotStrategy(botId);
    bot.vault = ""; // Will be set when vault is created
    
    // Performance stats
    bot.gamesPlayed = ZERO_BI;
    bot.totalBetsPlaced = ZERO_BI;
    bot.totalAmountWagered = ZERO_BD;
    bot.totalWinnings = ZERO_BD;
    bot.totalLosses = ZERO_BD;
    bot.netPnL = ZERO_BD;
    bot.winRate = ZERO_BD;
    bot.currentBankroll = ZERO_BD;
    
    // Strategy stats
    bot.avgBetSize = ZERO_BD;
    bot.maxBetSize = ZERO_BD;
    bot.riskLevel = ZERO_BD;
    
    // Activity
    bot.isActive = true;
    bot.lastActiveBlock = ZERO_BI;
    
    bot.save();
  }
  return bot;
}

export function updateBotStats(bot: Bot, won: boolean, amount: BigDecimal, payout: BigDecimal): void {
  if (won) {
    bot.totalWinnings = bot.totalWinnings.plus(payout);
  } else {
    bot.totalLosses = bot.totalLosses.plus(amount);
  }
  
  let pnl = won ? payout.minus(amount) : amount.times(BigDecimal.fromString("-1"));
  bot.netPnL = bot.netPnL.plus(pnl);
  
  // Update average bet size
  let totalBets = bot.totalBetsPlaced;
  if (totalBets.gt(ZERO_BI)) {
    bot.avgBetSize = bot.totalAmountWagered.div(totalBets.toBigDecimal());
  }
  
  // Update max bet size
  if (amount.gt(bot.maxBetSize)) {
    bot.maxBetSize = amount;
  }
  
  // Update win rate
  if (bot.totalBetsPlaced.gt(ZERO_BI)) {
    let winnings = bot.totalWinnings;
    let totalWagered = bot.totalAmountWagered;
    if (totalWagered.gt(ZERO_BD)) {
      bot.winRate = winnings.div(totalWagered).times(BigDecimal.fromString("100"));
    }
  }
}

// Vault helpers
export function getOrCreateVault(vaultAddress: Address): Vault {
  let vault = Vault.load(vaultAddress.toHexString());
  if (!vault) {
    vault = new Vault(vaultAddress.toHexString());
    vault.bot = null;
    vault.name = "";
    vault.totalAssets = ZERO_BD;
    vault.totalShares = ZERO_BD;
    vault.sharePrice = ONE_BD;
    vault.totalDeposits = ZERO_BD;
    vault.totalWithdrawals = ZERO_BD;
    vault.totalPerformanceFees = ZERO_BD;
    
    // Performance metrics
    vault.totalPnL = ZERO_BD;
    vault.allTimeHigh = ZERO_BD;
    vault.allTimeLow = ZERO_BD;
    vault.maxDrawdown = ZERO_BD;
    
    // Activity
    vault.isActive = true;
    vault.lpCount = ZERO_BI;
    
    vault.save();
  }
  return vault;
}

// Daily metrics helpers
export function getOrCreateDailyMetric(timestamp: BigInt): DailyMetric {
  let dayStart = timestamp.toI32() / SECONDS_PER_DAY * SECONDS_PER_DAY;
  let dayId = dayStart.toString();
  
  let metric = DailyMetric.load(dayId);
  if (!metric) {
    metric = new DailyMetric(dayId);
    metric.date = dayStart;
    metric.totalVolume = ZERO_BD;
    metric.totalBets = ZERO_BI;
    metric.uniquePlayers = ZERO_BI;
    metric.totalGames = ZERO_BI;
    metric.avgGameDuration = ZERO_BD;
    metric.totalVaultDeposits = ZERO_BD;
    metric.totalVaultWithdrawals = ZERO_BD;
    metric.netVaultFlow = ZERO_BD;
    metric.totalStaked = ZERO_BD;
    metric.totalUnstaked = ZERO_BD;
    metric.netStakeFlow = ZERO_BD;
    metric.topPerformingBot = null;
    metric.avgBotPnL = ZERO_BD;
    metric.totalFees = ZERO_BD;
    metric.protocolRevenue = ZERO_BD;
    metric.treasuryFeesCollected = ZERO_BD;
    metric.treasuryDistributed = ZERO_BD;
    metric.buybacksExecuted = ZERO_BI;
    metric.tokensBoughtBack = ZERO_BD;
    metric.rafflesStarted = ZERO_BI;
    metric.raffleEntries = ZERO_BI;
    metric.raffleWinners = ZERO_BI;
    metric.mintPassesMinted = ZERO_BI;
    metric.mintPassesRedeemed = ZERO_BI;
    metric.generativeArtMinted = ZERO_BI;
    metric.bettingRoundsCreated = ZERO_BI;
    metric.bettingRoundsSettled = ZERO_BI;
    metric.bettingRoundsCanceled = ZERO_BI;
    metric.botBetsPlaced = ZERO_BI;
    metric.botBetVolume = ZERO_BD;
    metric.botBetPayouts = ZERO_BD;
    metric.botBetWithdrawals = ZERO_BD;
    metric.botBetHouseFees = ZERO_BD;
    metric.swapFeesCollected = ZERO_BD;
    metric.swapFeeCollections = ZERO_BI;
    metric.swapFeesSentToTreasury = ZERO_BD;
    metric.tokenTransfers = ZERO_BI;
    metric.tokenVolume = ZERO_BD;
    metric.tokenApprovals = ZERO_BI;
    metric.tokensMinted = ZERO_BD;
    metric.tokensBurned = ZERO_BD;
    metric.save();
  }
  return metric;
}

// Hourly metrics helpers
export function getOrCreateHourlyMetric(timestamp: BigInt): HourlyMetric {
  let hourStart = timestamp.toI32() / SECONDS_PER_HOUR * SECONDS_PER_HOUR;
  let hourId = hourStart.toString();
  
  let metric = HourlyMetric.load(hourId);
  if (!metric) {
    metric = new HourlyMetric(hourId);
    metric.timestamp = BigInt.fromI32(hourStart);
    metric.hour = (hourStart / SECONDS_PER_HOUR) % 24;
    metric.activeUsers = ZERO_BI;
    metric.totalBets = ZERO_BI;
    metric.totalVolume = ZERO_BD;
    metric.gamesStarted = ZERO_BI;
    metric.gamesCompleted = ZERO_BI;
    metric.avgGameLength = ZERO_BD;
    metric.activeBots = ZERO_BI;
    metric.totalBotBets = ZERO_BI;
    metric.totalBotVolume = ZERO_BD;
    metric.save();
  }
  return metric;
}

// Staking helpers
export function getOrCreateStakingPool(poolAddress: Address): StakingPool {
  let pool = StakingPool.load(poolAddress.toHexString());
  if (!pool) {
    pool = new StakingPool(poolAddress.toHexString());
    pool.totalStaked = ZERO_BD;
    pool.totalRewards = ZERO_BD;
    pool.rewardRate = ZERO_BD;
    pool.rewardsDuration = BigInt.fromI32(604800); // 7 days default
    pool.lastUpdateTime = ZERO_BI;
    pool.currentEpoch = ZERO_BI;
    pool.stakerCount = ZERO_BI;
    pool.save();
  }
  return pool;
}

export function getOrCreateStakingPosition(poolAddress: Address, userAddress: Address): StakingPosition {
  let positionId = poolAddress.toHexString() + "-" + userAddress.toHexString();
  let position = StakingPosition.load(positionId);
  if (!position) {
    position = new StakingPosition(positionId);
    position.pool = poolAddress.toHexString();
    position.user = userAddress.toHexString();
    position.stakedAmount = ZERO_BD;
    position.rewardsPaid = ZERO_BD;
    position.pendingRewards = ZERO_BD;
    position.firstStakeBlock = ZERO_BI;
    position.lastActionBlock = ZERO_BI;
    position.save();
  }
  return position;
}

// Treasury helpers
export function getOrCreateTreasury(treasuryAddress: Address): Treasury {
  let treasury = Treasury.load(treasuryAddress.toHexString());
  if (!treasury) {
    treasury = new Treasury(treasuryAddress.toHexString());
    treasury.totalFeesCollected = ZERO_BD;
    treasury.totalDistributed = ZERO_BD;
    treasury.totalBuybacks = ZERO_BD;
    treasury.stakingAllocation = BigDecimal.fromString("50"); // 50%
    treasury.buybackAllocation = BigDecimal.fromString("20"); // 20%
    treasury.devAllocation = BigDecimal.fromString("15"); // 15%
    treasury.insuranceAllocation = BigDecimal.fromString("15"); // 15%
    treasury.save();
  }
  return treasury;
}

// Token helpers
export function getOrCreateBOTToken(tokenAddress: Address): BOTToken {
  let token = BOTToken.load(tokenAddress.toHexString());
  if (!token) {
    token = new BOTToken(tokenAddress.toHexString());
    token.name = "Barely Human Token";
    token.symbol = "BOT";
    token.decimals = 18;
    token.totalSupply = BigDecimal.fromString("1000000000"); // 1B tokens
    token.circulatingSupply = BigDecimal.fromString("1000000000");
    
    // Allocations (percentages of total supply)
    token.treasuryAllocation = BigDecimal.fromString("200000000"); // 20%
    token.liquidityAllocation = BigDecimal.fromString("300000000"); // 30%
    token.stakingAllocation = BigDecimal.fromString("250000000"); // 25%
    token.teamAllocation = BigDecimal.fromString("150000000"); // 15%
    token.communityAllocation = BigDecimal.fromString("100000000"); // 10%
    
    // Activity
    token.totalTransfers = ZERO_BI;
    token.totalHolders = ZERO_BI;
    
    token.save();
  }
  return token;
}

// Bet type conversion
export function convertBetTypeToEnum(betType: i32): string {
  let betTypes = [
    "PASS_LINE", "DONT_PASS_LINE", "COME", "DONT_COME", "FIELD",
    "PLACE_4", "PLACE_5", "PLACE_6", "PLACE_8", "PLACE_9", "PLACE_10",
    "DONT_PLACE_4", "DONT_PLACE_5", "DONT_PLACE_6", "DONT_PLACE_8", "DONT_PLACE_9", "DONT_PLACE_10",
    "BUY_4", "BUY_5", "BUY_6", "BUY_8", "BUY_9", "BUY_10",
    "LAY_4", "LAY_5", "LAY_6", "LAY_8", "LAY_9", "LAY_10",
    "HARD_4", "HARD_6", "HARD_8", "HARD_10",
    "PASS_ODDS", "DONT_PASS_ODDS", "COME_ODDS", "DONT_COME_ODDS",
    "FIRE", "SMALL", "TALL", "ALL", "ANY_CRAPS", "ANY_SEVEN", "ACE_DEUCE", "ACES", "BOXCARS", "HORN",
    "NEXT_2", "NEXT_3", "NEXT_4", "NEXT_5", "NEXT_6", "NEXT_7", "NEXT_8", "NEXT_9", "NEXT_10", "NEXT_11", "NEXT_12",
    "REP_4", "REP_5", "REP_6", "REP_8", "REP_9", "REP_10", "REP_2", "REP_3", "REP_11", "REP_12"
  ];
  
  if (betType >= 0 && betType < betTypes.length) {
    return betTypes[betType];
  }
  return "PASS_LINE"; // Default
}

// Bot name mapping
export function getBotName(botId: BigInt): string {
  let names = [
    "Alice \"All-In\"",
    "Bob \"The Calculator\"", 
    "Charlie \"Lucky Charm\"",
    "Diana \"Ice Queen\"",
    "Eddie \"The Entertainer\"",
    "Fiona \"Fearless\"",
    "Greg \"The Grinder\"",
    "Helen \"Hot Streak\"",
    "Ivan \"The Intimidator\"",
    "Julia \"Jinx\""
  ];
  
  let index = botId.toI32();
  if (index >= 0 && index < names.length) {
    return names[index];
  }
  return "Unknown Bot";
}

// Bot personality mapping
export function getBotPersonality(botId: BigInt): string {
  let personalities = [
    "Aggressive high-roller who goes all-in",
    "Statistical analyzer who calculates every move",
    "Superstitious player who believes in lucky charms",
    "Cold and methodical with no emotions",
    "Theatrical showman who entertains the table",
    "Fearless player who never backs down",
    "Patient grinder with steady consistency",
    "Momentum believer who rides hot streaks",
    "Psychological warfare expert",
    "Claims to control luck itself"
  ];
  
  let index = botId.toI32();
  if (index >= 0 && index < personalities.length) {
    return personalities[index];
  }
  return "Unknown personality";
}

// Bot strategy mapping
export function getBotStrategy(botId: BigInt): string {
  let strategies = [
    "High-risk, high-reward betting",
    "Data-driven optimal play",
    "Pattern-based superstitious betting",
    "Minimalist mathematical approach",
    "Crowd-pleasing flashy bets",
    "Maximum aggression strategy",
    "Conservative bankroll management",
    "Streak-following momentum play",
    "Intimidation and mind games",
    "Chaos theory random betting"
  ];
  
  let index = botId.toI32();
  if (index >= 0 && index < strategies.length) {
    return strategies[index];
  }
  return "Unknown strategy";
}

// Token holder helpers
export function getOrCreateTokenHolder(tokenAddress: Address, holderAddress: Address): TokenHolder {
  let holderId = tokenAddress.toHexString() + "-" + holderAddress.toHexString();
  let holder = TokenHolder.load(holderId);
  if (!holder) {
    holder = new TokenHolder(holderId);
    holder.token = tokenAddress.toHexString();
    holder.user = holderAddress.toHexString();
    holder.balance = ZERO_BD;
    holder.firstTransferTime = ZERO_BI;
    holder.firstTransferBlock = ZERO_BI;
    holder.lastTransferTime = ZERO_BI;
    holder.save();
  }
  return holder;
}

// Bot performance helpers
export function getOrCreateBotPerformance(botId: BigInt): BotPerformance {
  let performanceId = "bot-" + botId.toString();
  let performance = BotPerformance.load(performanceId);
  if (!performance) {
    performance = new BotPerformance(performanceId);
    performance.bot = botId.toString();
    performance.totalBetsReceived = ZERO_BI;
    performance.totalAmountBacked = ZERO_BD;
    performance.roundsWon = ZERO_BI;
    performance.roundsLost = ZERO_BI;
    performance.winRate = ZERO_BD;
    performance.averageBackingAmount = ZERO_BD;
    performance.totalWinnings = ZERO_BD;
    performance.save();
  }
  return performance;
}

// Update treasury helper with missing fields
export function getOrCreateTreasury(treasuryAddress: Address): Treasury {
  let treasury = Treasury.load(treasuryAddress.toHexString());
  if (!treasury) {
    treasury = new Treasury(treasuryAddress.toHexString());
    treasury.totalFeesCollected = ZERO_BD;
    treasury.totalFeesDistributed = ZERO_BD;
    treasury.stakingDistributed = ZERO_BD;
    treasury.buybackDistributed = ZERO_BD;
    treasury.devDistributed = ZERO_BD;
    treasury.insuranceDistributed = ZERO_BD;
    treasury.totalBuybacks = ZERO_BI;
    treasury.totalEthSpentOnBuybacks = ZERO_BD;
    treasury.totalTokensBoughtBack = ZERO_BD;
    treasury.stakingPercent = BigInt.fromI32(50);
    treasury.buybackPercent = BigInt.fromI32(20);
    treasury.devPercent = BigInt.fromI32(15);
    treasury.insurancePercent = BigInt.fromI32(15);
    treasury.authorizedVaults = [];
    treasury.authorizedHooks = [];
    treasury.lastUpdateTime = ZERO_BI;
    treasury.save();
  }
  return treasury;
}

// Protocol stats updater
export function updateProtocolStats(): void {
  let protocol = getOrCreateProtocol();
  // This would aggregate stats from all entities
  // Implementation depends on specific requirements
  protocol.save();
}