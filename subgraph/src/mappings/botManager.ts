import {
  BotDecisionMade,
  BotBetPlaced,
  BotBetSettled,
  BotStrategyChanged,
  BotSessionStarted,
  BotSessionEnded
} from "../../generated/BotManager/BotManager";

import {
  Bot,
  BotDecision,
  BotSession,
  User,
  GameSeries,
  DailyMetric,
  HourlyMetric
} from "../../generated/schema";

import {
  getOrCreateBot,
  getOrCreateDailyMetric,
  getOrCreateHourlyMetric,
  convertBetTypeToEnum,
  updateBotStats
} from "../utils/helpers";

import { BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";

export function handleBotDecisionMade(event: BotDecisionMade): void {
  log.info("Bot decision made: botId={}, decisionType={}, betType={}, amount={}", [
    event.params.botId.toString(),
    event.params.decisionType.toString(),
    event.params.betType.toString(),
    event.params.amount.toString()
  ]);

  let bot = getOrCreateBot(event.params.botId);
  bot.lastActiveBlock = event.block.number;
  
  // Update current bankroll
  bot.currentBankroll = event.params.bankrollAfter.toBigDecimal();
  bot.save();

  // Create decision record
  let decisionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let decision = new BotDecision(decisionId);
  
  decision.bot = bot.id;
  decision.series = ""; // Will be set if we can determine current series
  decision.decisionType = getDecisionTypeName(event.params.decisionType);
  decision.betType = convertBetTypeToEnum(event.params.betType);
  decision.amount = event.params.amount.toBigDecimal();
  decision.reasoning = event.params.reasoning;
  decision.bankrollBefore = event.params.bankrollBefore.toBigDecimal();
  decision.bankrollAfter = event.params.bankrollAfter.toBigDecimal();
  decision.timestamp = event.block.timestamp;
  decision.blockNumber = event.block.number;
  decision.transactionHash = event.transaction.hash;
  
  decision.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  if (event.params.decisionType == 1) { // Assuming 1 = BET
    dailyMetric.totalBotBets = dailyMetric.totalBotBets.plus(BigInt.fromI32(1));
    dailyMetric.totalBotVolume = dailyMetric.totalBotVolume.plus(event.params.amount.toBigDecimal());
  }
  dailyMetric.save();

  // Update hourly metrics
  let hourlyMetric = getOrCreateHourlyMetric(event.block.timestamp);
  if (event.params.decisionType == 1) { // BET
    hourlyMetric.totalBotBets = hourlyMetric.totalBotBets.plus(BigInt.fromI32(1));
    hourlyMetric.totalBotVolume = hourlyMetric.totalBotVolume.plus(event.params.amount.toBigDecimal());
  }
  hourlyMetric.save();
}

export function handleBotBetPlaced(event: BotBetPlaced): void {
  log.info("Bot bet placed: botId={}, seriesId={}, betType={}, amount={}", [
    event.params.botId.toString(),
    event.params.seriesId.toString(),
    event.params.betType.toString(),
    event.params.amount.toString()
  ]);

  let bot = getOrCreateBot(event.params.botId);
  
  // Update bot betting stats
  bot.totalBetsPlaced = bot.totalBetsPlaced.plus(BigInt.fromI32(1));
  bot.totalAmountWagered = bot.totalAmountWagered.plus(event.params.amount.toBigDecimal());
  bot.lastActiveBlock = event.block.number;
  
  // Update average bet size
  if (bot.totalBetsPlaced.gt(BigInt.fromI32(0))) {
    bot.avgBetSize = bot.totalAmountWagered.div(bot.totalBetsPlaced.toBigDecimal());
  }
  
  // Update max bet size
  let betAmount = event.params.amount.toBigDecimal();
  if (betAmount.gt(bot.maxBetSize)) {
    bot.maxBetSize = betAmount;
  }
  
  bot.save();

  // Update series if it exists
  let series = GameSeries.load(event.params.seriesId.toString());
  if (series) {
    series.totalBetsPlaced = series.totalBetsPlaced.plus(BigInt.fromI32(1));
    series.totalAmountWagered = series.totalAmountWagered.plus(event.params.amount.toBigDecimal());
    series.save();
  }

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.totalBotBets = dailyMetric.totalBotBets.plus(BigInt.fromI32(1));
  dailyMetric.totalBotVolume = dailyMetric.totalBotVolume.plus(event.params.amount.toBigDecimal());
  dailyMetric.save();

  // Update hourly metrics
  let hourlyMetric = getOrCreateHourlyMetric(event.block.timestamp);
  hourlyMetric.totalBotBets = hourlyMetric.totalBotBets.plus(BigInt.fromI32(1));
  hourlyMetric.totalBotVolume = hourlyMetric.totalBotVolume.plus(event.params.amount.toBigDecimal());
  hourlyMetric.save();
}

export function handleBotBetSettled(event: BotBetSettled): void {
  log.info("Bot bet settled: botId={}, seriesId={}, payout={}, won={}", [
    event.params.botId.toString(),
    event.params.seriesId.toString(),
    event.params.payout.toString(),
    event.params.won.toString()
  ]);

  let bot = getOrCreateBot(event.params.botId);
  
  // Update bot performance stats
  if (event.params.won) {
    bot.totalWinnings = bot.totalWinnings.plus(event.params.payout.toBigDecimal());
  } else {
    // For losses, we need to get the original bet amount
    // This is a limitation - we might need to track this differently
    // For now, we'll estimate based on payout (assuming the bet lost completely)
    let estimatedBetAmount = event.params.payout.toBigDecimal(); // This might not be accurate
    bot.totalLosses = bot.totalLosses.plus(estimatedBetAmount);
  }
  
  // Update net P&L
  let pnl = event.params.won ? 
    event.params.payout.toBigDecimal() : // This should be payout - bet amount for accurate P&L
    event.params.payout.toBigDecimal().times(BigDecimal.fromString("-1"));
  bot.netPnL = bot.netPnL.plus(pnl);
  
  // Update win rate
  if (bot.totalBetsPlaced.gt(BigInt.fromI32(0))) {
    let winnings = bot.totalWinnings;
    let totalWagered = bot.totalAmountWagered;
    if (totalWagered.gt(BigDecimal.fromString("0"))) {
      bot.winRate = winnings.div(totalWagered).times(BigDecimal.fromString("100"));
    }
  }
  
  bot.lastActiveBlock = event.block.number;
  bot.save();

  // Update series payouts
  let series = GameSeries.load(event.params.seriesId.toString());
  if (series) {
    series.totalPayouts = series.totalPayouts.plus(event.params.payout.toBigDecimal());
    series.save();
  }

  // Update daily metrics for bot performance
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  
  // Update average bot P&L (this is a simplified calculation)
  // In practice, you'd want to track this more precisely
  let avgPnL = dailyMetric.avgBotPnL;
  let botCount = BigDecimal.fromString("10"); // We have 10 bots
  dailyMetric.avgBotPnL = avgPnL.plus(pnl.div(botCount));
  
  // Update top performing bot (simplified - just check if this bot has highest P&L)
  if (!dailyMetric.topPerformingBot || bot.netPnL.gt(BigDecimal.fromString("0"))) {
    // This is a simplified check - in practice you'd compare all bots
    dailyMetric.topPerformingBot = bot.id;
  }
  
  dailyMetric.save();
}

export function handleBotStrategyChanged(event: BotStrategyChanged): void {
  log.info("Bot strategy changed: botId={}, oldStrategy={}, newStrategy={}", [
    event.params.botId.toString(),
    event.params.oldStrategy,
    event.params.newStrategy
  ]);

  let bot = getOrCreateBot(event.params.botId);
  bot.bettingStrategy = event.params.newStrategy;
  bot.lastActiveBlock = event.block.number;
  bot.save();
}

export function handleBotSessionStarted(event: BotSessionStarted): void {
  log.info("Bot session started: botId={}, sessionNumber={}", [
    event.params.botId.toString(),
    event.params.sessionNumber.toString()
  ]);

  let sessionId = event.params.botId.toString() + "-" + event.params.sessionNumber.toString();
  let session = new BotSession(sessionId);
  
  let bot = getOrCreateBot(event.params.botId);
  
  session.bot = bot.id;
  session.sessionNumber = event.params.sessionNumber;
  session.startTime = event.block.timestamp;
  session.endTime = null;
  session.startingBankroll = bot.currentBankroll;
  session.endingBankroll = BigDecimal.fromString("0");
  session.netPnL = BigDecimal.fromString("0");
  session.betsPlaced = BigInt.fromI32(0);
  session.gamesPlayed = BigInt.fromI32(0);
  session.winRate = BigDecimal.fromString("0");
  
  session.save();

  // Update bot activity
  bot.lastActiveBlock = event.block.number;
  bot.save();
}

export function handleBotSessionEnded(event: BotSessionEnded): void {
  log.info("Bot session ended: botId={}, sessionNumber={}, startingBankroll={}, endingBankroll={}, netPnL={}", [
    event.params.botId.toString(),
    event.params.sessionNumber.toString(),
    event.params.startingBankroll.toString(),
    event.params.endingBankroll.toString(),
    event.params.netPnL.toString()
  ]);

  let sessionId = event.params.botId.toString() + "-" + event.params.sessionNumber.toString();
  let session = BotSession.load(sessionId);
  
  if (!session) {
    log.error("Session not found: {}", [sessionId]);
    return;
  }

  // Update session end data
  session.endTime = event.block.timestamp;
  session.endingBankroll = event.params.endingBankroll.toBigDecimal();
  session.netPnL = event.params.netPnL.toBigDecimal();
  
  // Calculate session duration and other metrics
  let duration = session.endTime!.minus(session.startTime);
  
  // Update session stats (these would need to be calculated from bet events during the session)
  // For now, we'll leave them as initialized
  
  session.save();

  // Update bot
  let bot = getOrCreateBot(event.params.botId);
  bot.currentBankroll = event.params.endingBankroll.toBigDecimal();
  bot.lastActiveBlock = event.block.number;
  bot.save();
}

// Helper function to convert decision type number to string
function getDecisionTypeName(decisionType: i32): string {
  let types = ["HOLD", "BET", "INCREASE", "DECREASE", "WITHDRAW"];
  
  if (decisionType >= 0 && decisionType < types.length) {
    return types[decisionType];
  }
  return "UNKNOWN";
}