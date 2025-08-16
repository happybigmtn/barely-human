import {
  RoundCreated,
  BetPlaced,
  RoundSettled,
  WinningsWithdrawn,
  RoundCanceled
} from "../../generated/BotBettingEscrow/BotBettingEscrow";

import {
  BettingRound,
  BotBet,
  BotPerformance,
  User,
  DailyMetric,
  Protocol
} from "../../generated/schema";

import {
  getOrCreateUser,
  getOrCreateBotPerformance,
  getOrCreateDailyMetric,
  getOrCreateProtocol,
  ZERO_BD,
  ZERO_BI
} from "../utils/helpers";

import { BigInt, BigDecimal, log, dataSource, Address } from "@graphprotocol/graph-ts";

export function handleRoundCreated(event: RoundCreated): void {
  log.info("Betting round created: roundId={}, duration={}", [
    event.params.roundId.toString(),
    event.params.duration.toString()
  ]);

  let roundId = event.params.roundId.toString();
  let round = new BettingRound(roundId);
  
  round.roundId = event.params.roundId;
  round.startTime = event.block.timestamp;
  round.endTime = event.block.timestamp.plus(event.params.duration);
  round.duration = event.params.duration;
  round.totalPool = ZERO_BD;
  round.betCount = ZERO_BI;
  round.isActive = true;
  round.isSettled = false;
  round.isCanceled = false;
  round.houseFee = ZERO_BD;
  round.createdBlock = event.block.number;
  round.createdTransaction = event.transaction.hash;
  round.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalBettingRounds = protocol.totalBettingRounds.plus(BigInt.fromI32(1));
  protocol.activeBettingRounds = protocol.activeBettingRounds.plus(BigInt.fromI32(1));
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.bettingRoundsCreated = dailyMetric.bettingRoundsCreated.plus(BigInt.fromI32(1));
  dailyMetric.save();
}

export function handleBetPlaced(event: BetPlaced): void {
  log.info("Bet placed: roundId={}, bettor={}, botId={}, amount={}", [
    event.params.roundId.toString(),
    event.params.bettor.toHexString(),
    event.params.botId.toString(),
    event.params.amount.toString()
  ]);

  let roundId = event.params.roundId.toString();
  let round = BettingRound.load(roundId);
  
  if (round == null) {
    log.error("Betting round not found: {}", [roundId]);
    return;
  }

  let user = getOrCreateUser(event.params.bettor);

  // Create bot bet record
  let betId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let bet = new BotBet(betId);
  bet.round = round.id;
  bet.bettor = user.id;
  bet.botId = event.params.botId;
  bet.amount = event.params.amount.toBigDecimal();
  bet.timestamp = event.block.timestamp;
  bet.blockNumber = event.block.number;
  bet.transactionHash = event.transaction.hash;
  bet.isWinner = false;
  bet.winnings = ZERO_BD;
  bet.isWithdrawn = false;
  bet.save();

  // Update round stats
  round.totalPool = round.totalPool.plus(event.params.amount.toBigDecimal());
  round.betCount = round.betCount.plus(BigInt.fromI32(1));
  round.save();

  // Update user stats
  user.totalBotBets = user.totalBotBets.plus(BigInt.fromI32(1));
  user.totalBotBetAmount = user.totalBotBetAmount.plus(event.params.amount.toBigDecimal());
  user.lastActiveBlock = event.block.number;
  user.save();

  // Update bot performance tracking
  let botPerformance = getOrCreateBotPerformance(event.params.botId);
  botPerformance.totalBetsReceived = botPerformance.totalBetsReceived.plus(BigInt.fromI32(1));
  botPerformance.totalAmountBacked = botPerformance.totalAmountBacked.plus(event.params.amount.toBigDecimal());
  botPerformance.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalBotBets = protocol.totalBotBets.plus(BigInt.fromI32(1));
  protocol.totalBotBetVolume = protocol.totalBotBetVolume.plus(event.params.amount.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.botBetsPlaced = dailyMetric.botBetsPlaced.plus(BigInt.fromI32(1));
  dailyMetric.botBetVolume = dailyMetric.botBetVolume.plus(event.params.amount.toBigDecimal());
  dailyMetric.save();
}

export function handleRoundSettled(event: RoundSettled): void {
  log.info("Round settled: roundId={}, winningBot={}, totalPayout={}, houseFee={}", [
    event.params.roundId.toString(),
    event.params.winningBot.toString(),
    event.params.totalPayout.toString(),
    event.params.houseFee.toString()
  ]);

  let roundId = event.params.roundId.toString();
  let round = BettingRound.load(roundId);
  
  if (round == null) {
    log.error("Betting round not found: {}", [roundId]);
    return;
  }

  // Update round with settlement data
  round.isActive = false;
  round.isSettled = true;
  round.winningBot = event.params.winningBot;
  round.totalPayout = event.params.totalPayout.toBigDecimal();
  round.houseFee = event.params.houseFee.toBigDecimal();
  round.settledTime = event.block.timestamp;
  round.settledBlock = event.block.number;
  round.settledTransaction = event.transaction.hash;
  round.save();

  // Update winning bot performance
  let winningBotPerformance = getOrCreateBotPerformance(event.params.winningBot);
  winningBotPerformance.roundsWon = winningBotPerformance.roundsWon.plus(BigInt.fromI32(1));
  winningBotPerformance.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.activeBettingRounds = protocol.activeBettingRounds.minus(BigInt.fromI32(1));
  protocol.settledBettingRounds = protocol.settledBettingRounds.plus(BigInt.fromI32(1));
  protocol.totalBotBetPayouts = protocol.totalBotBetPayouts.plus(event.params.totalPayout.toBigDecimal());
  protocol.totalHouseFees = protocol.totalHouseFees.plus(event.params.houseFee.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.bettingRoundsSettled = dailyMetric.bettingRoundsSettled.plus(BigInt.fromI32(1));
  dailyMetric.botBetPayouts = dailyMetric.botBetPayouts.plus(event.params.totalPayout.toBigDecimal());
  dailyMetric.botBetHouseFees = dailyMetric.botBetHouseFees.plus(event.params.houseFee.toBigDecimal());
  dailyMetric.save();
}

export function handleWinningsWithdrawn(event: WinningsWithdrawn): void {
  log.info("Winnings withdrawn: user={}, amount={}", [
    event.params.user.toHexString(),
    event.params.amount.toString()
  ]);

  let user = getOrCreateUser(event.params.user);

  // Update user stats
  user.totalBotBetWinnings = user.totalBotBetWinnings.plus(event.params.amount.toBigDecimal());
  user.lastActiveBlock = event.block.number;
  user.save();

  // Note: We don't have the specific bet ID in this event, so we can't update
  // individual BotBet entities. This would need to be tracked differently
  // if more granular tracking is needed.

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalBotBetWithdrawals = protocol.totalBotBetWithdrawals.plus(event.params.amount.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.botBetWithdrawals = dailyMetric.botBetWithdrawals.plus(event.params.amount.toBigDecimal());
  dailyMetric.save();
}

export function handleRoundCanceled(event: RoundCanceled): void {
  log.info("Round canceled: roundId={}", [
    event.params.roundId.toString()
  ]);

  let roundId = event.params.roundId.toString();
  let round = BettingRound.load(roundId);
  
  if (round == null) {
    log.error("Betting round not found: {}", [roundId]);
    return;
  }

  // Update round status
  round.isActive = false;
  round.isCanceled = true;
  round.canceledTime = event.block.timestamp;
  round.canceledBlock = event.block.number;
  round.canceledTransaction = event.transaction.hash;
  round.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.activeBettingRounds = protocol.activeBettingRounds.minus(BigInt.fromI32(1));
  protocol.canceledBettingRounds = protocol.canceledBettingRounds.plus(BigInt.fromI32(1));
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.bettingRoundsCanceled = dailyMetric.bettingRoundsCanceled.plus(BigInt.fromI32(1));
  dailyMetric.save();
}