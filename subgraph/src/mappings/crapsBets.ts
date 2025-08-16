import {
  BetPlaced,
  BetResolved,
  OddsBetPlaced,
  BetRemoved,
  BatchProcessed
} from "../../generated/CrapsBets/CrapsBets";

import {
  Bet,
  User,
  GameSeries,
  Bot,
  Vault,
  DailyMetric,
  HourlyMetric,
  Protocol
} from "../../generated/schema";

import {
  getOrCreateUser,
  getOrCreateBot,
  getOrCreateVault,
  getOrCreateDailyMetric,
  getOrCreateHourlyMetric,
  getOrCreateProtocol,
  convertBetTypeToEnum,
  updateUserStats,
  updateBotStats
} from "../utils/helpers";

import { BigInt, BigDecimal, log, Address } from "@graphprotocol/graph-ts";

export function handleBetPlaced(event: BetPlaced): void {
  log.info("Bet placed: player={}, seriesId={}, betType={}, amount={}", [
    event.params.player.toHexString(),
    event.params.seriesId.toString(),
    event.params.betType.toString(),
    event.params.amount.toString()
  ]);

  let betId = event.params.player.toHexString() + 
             "-" + event.params.seriesId.toString() + 
             "-" + event.params.betType.toString();
  
  let bet = new Bet(betId);
  
  // Get or create user
  let user = getOrCreateUser(event.params.player);
  user.totalBetsPlaced = user.totalBetsPlaced.plus(BigInt.fromI32(1));
  user.totalAmountWagered = user.totalAmountWagered.plus(event.params.amount.toBigDecimal());
  user.lastActiveBlock = event.block.number;
  user.save();

  // Get series
  let seriesId = event.params.seriesId.toString();
  let series = GameSeries.load(seriesId);
  if (!series) {
    log.error("Series not found for bet: {}", [seriesId]);
    return;
  }

  // Update series stats
  series.totalBetsPlaced = series.totalBetsPlaced.plus(BigInt.fromI32(1));
  series.totalAmountWagered = series.totalAmountWagered.plus(event.params.amount.toBigDecimal());
  series.save();

  // Set bet properties
  bet.player = user.id;
  bet.series = seriesId;
  bet.betType = convertBetTypeToEnum(event.params.betType);
  bet.betTypeNumber = event.params.betType;
  bet.amount = event.params.amount.toBigDecimal();
  bet.point = 0; // Will be set for Come/Don't Come bets
  bet.timestamp = event.block.timestamp;
  bet.blockNumber = event.block.number;
  bet.transactionHash = event.transaction.hash;
  bet.isActive = true;
  bet.isResolved = false;

  // Check if this is a bot bet by looking at the caller
  // This would need to be determined by checking if the caller is a vault
  // For now, we'll leave vault and bot as null and set them in vault mappings

  bet.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalAmountWagered = protocol.totalAmountWagered.plus(event.params.amount.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.totalBets = dailyMetric.totalBets.plus(BigInt.fromI32(1));
  dailyMetric.totalVolume = dailyMetric.totalVolume.plus(event.params.amount.toBigDecimal());
  
  // Track unique players (this is simplified - in practice you'd need a more sophisticated approach)
  // For now, we'll increment if this is the user's first bet today
  dailyMetric.save();

  // Update hourly metrics
  let hourlyMetric = getOrCreateHourlyMetric(event.block.timestamp);
  hourlyMetric.totalBets = hourlyMetric.totalBets.plus(BigInt.fromI32(1));
  hourlyMetric.totalVolume = hourlyMetric.totalVolume.plus(event.params.amount.toBigDecimal());
  hourlyMetric.save();
}

export function handleBetResolved(event: BetResolved): void {
  log.info("Bet resolved: player={}, seriesId={}, betType={}, amount={}, payout={}, won={}", [
    event.params.player.toHexString(),
    event.params.seriesId.toString(),
    event.params.betType.toString(),
    event.params.amount.toString(),
    event.params.payout.toString(),
    event.params.won.toString()
  ]);

  let betId = event.params.player.toHexString() + 
             "-" + event.params.seriesId.toString() + 
             "-" + event.params.betType.toString();
  
  let bet = Bet.load(betId);
  if (!bet) {
    log.error("Bet not found for resolution: {}", [betId]);
    return;
  }

  // Update bet status
  bet.isResolved = true;
  bet.isActive = false;
  bet.save();

  // Update user stats
  let user = getOrCreateUser(event.params.player);
  if (event.params.won) {
    user.totalWinnings = user.totalWinnings.plus(event.params.payout.toBigDecimal());
  } else {
    user.totalLosses = user.totalLosses.plus(event.params.amount.toBigDecimal());
  }
  
  // Update net P&L
  let pnl = event.params.won ? 
    event.params.payout.toBigDecimal().minus(event.params.amount.toBigDecimal()) :
    event.params.amount.toBigDecimal().times(BigDecimal.fromString("-1"));
  user.netPnL = user.netPnL.plus(pnl);
  
  // Update win rate (simplified calculation)
  if (user.totalBetsPlaced.gt(BigInt.fromI32(0))) {
    let totalWon = user.totalWinnings.div(user.totalAmountWagered.gt(BigDecimal.fromString("0")) ? user.totalAmountWagered : BigDecimal.fromString("1"));
    user.winRate = totalWon.times(BigDecimal.fromString("100"));
  }
  
  user.save();

  // Update series stats
  let series = GameSeries.load(bet.series);
  if (series) {
    series.totalPayouts = series.totalPayouts.plus(event.params.payout.toBigDecimal());
    series.save();
  }

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalPayouts = protocol.totalPayouts.plus(event.params.payout.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update bot stats if this was a bot bet
  if (bet.bot) {
    let bot = Bot.load(bet.bot!);
    if (bot) {
      if (event.params.won) {
        bot.totalWinnings = bot.totalWinnings.plus(event.params.payout.toBigDecimal());
      } else {
        bot.totalLosses = bot.totalLosses.plus(event.params.amount.toBigDecimal());
      }
      
      bot.netPnL = bot.netPnL.plus(pnl);
      bot.lastActiveBlock = event.block.number;
      
      // Update win rate
      if (bot.totalBetsPlaced.gt(BigInt.fromI32(0))) {
        let botTotalWon = bot.totalWinnings.div(bot.totalAmountWagered.gt(BigDecimal.fromString("0")) ? bot.totalAmountWagered : BigDecimal.fromString("1"));
        bot.winRate = botTotalWon.times(BigDecimal.fromString("100"));
      }
      
      bot.save();
    }
  }
}

export function handleOddsBetPlaced(event: OddsBetPlaced): void {
  log.info("Odds bet placed: player={}, baseBetType={}, oddsAmount={}, point={}", [
    event.params.player.toHexString(),
    event.params.baseBetType.toString(),
    event.params.oddsAmount.toString(),
    event.params.point.toString()
  ]);

  // Odds bets are additional to the base bet
  // They should be tracked separately or as modifications to existing bets
  let user = getOrCreateUser(event.params.player);
  user.totalBetsPlaced = user.totalBetsPlaced.plus(BigInt.fromI32(1));
  user.totalAmountWagered = user.totalAmountWagered.plus(event.params.oddsAmount.toBigDecimal());
  user.lastActiveBlock = event.block.number;
  user.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalAmountWagered = protocol.totalAmountWagered.plus(event.params.oddsAmount.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.totalBets = dailyMetric.totalBets.plus(BigInt.fromI32(1));
  dailyMetric.totalVolume = dailyMetric.totalVolume.plus(event.params.oddsAmount.toBigDecimal());
  dailyMetric.save();
}

export function handleBetRemoved(event: BetRemoved): void {
  log.info("Bet removed: player={}, betType={}, amount={}", [
    event.params.player.toHexString(),
    event.params.betType.toString(),
    event.params.amount.toString()
  ]);

  // Find and deactivate the bet
  // This is challenging without a series ID, so we might need to find the active bet
  let user = getOrCreateUser(event.params.player);
  user.lastActiveBlock = event.block.number;
  user.save();
}

export function handleBatchProcessed(event: BatchProcessed): void {
  log.info("Batch processed: playersProcessed={}, totalPayouts={}", [
    event.params.playersProcessed.toString(),
    event.params.totalPayouts.toString()
  ]);

  // Update protocol stats with batch information
  let protocol = getOrCreateProtocol();
  protocol.totalPayouts = protocol.totalPayouts.plus(event.params.totalPayouts.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}