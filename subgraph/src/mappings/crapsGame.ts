import { 
  GameStarted,
  DiceRolled,
  PointEstablished,
  PointMade,
  SevenOut,
  PhaseChanged,
  RandomnessRequested,
  RandomnessFulfilled
} from "../../generated/CrapsGame/CrapsGame";

import {
  GameSeries,
  DiceRoll,
  User,
  Protocol,
  DailyMetric,
  HourlyMetric
} from "../../generated/schema";

import { 
  getOrCreateUser,
  getOrCreateProtocol,
  getOrCreateDailyMetric,
  getOrCreateHourlyMetric,
  updateProtocolStats,
  convertBetTypeToEnum
} from "../utils/helpers";

import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";

export function handleGameStarted(event: GameStarted): void {
  log.info("Game started: shooter={}, seriesId={}", [
    event.params.indexed_address.toHexString(),
    event.params.uint256.toString()
  ]);

  let seriesId = event.params.uint256.toString();
  let series = new GameSeries(seriesId);
  
  // Get or create shooter user
  let shooter = getOrCreateUser(event.params.indexed_address);
  shooter.gamesPlayed = shooter.gamesPlayed.plus(BigInt.fromI32(1));
  shooter.lastActiveBlock = event.block.number;
  shooter.save();

  // Initialize series
  series.shooter = shooter.id;
  series.startBlock = event.block.number;
  series.endBlock = null;
  series.phase = "COME_OUT";
  series.point = 0;
  series.rollCount = BigInt.fromI32(0);
  series.pointsMade = BigInt.fromI32(0);
  series.consecutiveWins = BigInt.fromI32(0);
  series.isActive = true;
  
  // Initialize tracking masks
  series.fireMask = 0;
  series.doublesMask = 0;
  series.smallTallMask = 0;
  
  // Initialize aggregations
  series.totalBetsPlaced = BigInt.fromI32(0);
  series.totalAmountWagered = BigInt.fromI32(0).toBigDecimal();
  series.totalPayouts = BigInt.fromI32(0).toBigDecimal();
  
  series.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalGamesPlayed = protocol.totalGamesPlayed.plus(BigInt.fromI32(1));
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.totalGames = dailyMetric.totalGames.plus(BigInt.fromI32(1));
  dailyMetric.save();

  // Update hourly metrics
  let hourlyMetric = getOrCreateHourlyMetric(event.block.timestamp);
  hourlyMetric.gamesStarted = hourlyMetric.gamesStarted.plus(BigInt.fromI32(1));
  hourlyMetric.save();
}

export function handleDiceRolled(event: DiceRolled): void {
  log.info("Dice rolled: seriesId={}, die1={}, die2={}, total={}", [
    event.params.seriesId.toString(),
    event.params.die1.toString(),
    event.params.die2.toString(), 
    event.params.total.toString()
  ]);

  let seriesId = event.params.seriesId.toString();
  let series = GameSeries.load(seriesId);
  
  if (!series) {
    log.error("Series not found for dice roll: {}", [seriesId]);
    return;
  }

  // Create dice roll entity
  let rollId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let roll = new DiceRoll(rollId);
  
  roll.series = seriesId;
  roll.rollNumber = series.rollCount.plus(BigInt.fromI32(1));
  roll.die1 = event.params.die1;
  roll.die2 = event.params.die2;
  roll.total = event.params.total;
  roll.timestamp = event.block.timestamp;
  roll.blockNumber = event.block.number;
  roll.transactionHash = event.transaction.hash;
  
  // Initialize settlement data
  roll.betsSettled = BigInt.fromI32(0);
  roll.totalPayout = BigInt.fromI32(0).toBigDecimal();
  
  roll.save();

  // Update series
  series.rollCount = series.rollCount.plus(BigInt.fromI32(1));
  
  // Update tracking masks
  let total = event.params.total;
  let die1 = event.params.die1;
  let die2 = event.params.die2;
  
  // Fire bet tracking (unique points: 4,5,6,8,9,10)
  if (total >= 4 && total <= 10 && total != 7) {
    let pointBit = 1 << (total - 4);
    series.fireMask = series.fireMask | pointBit;
  }
  
  // Doubles tracking
  if (die1 == die2) {
    let doubleBit = 1 << (total / 2 - 1);
    series.doublesMask = series.doublesMask | doubleBit;
  }
  
  // Small/Tall/All tracking
  if (total >= 2 && total <= 6) {
    series.smallTallMask = series.smallTallMask | 1; // Small bit
  }
  if (total >= 8 && total <= 12) {
    series.smallTallMask = series.smallTallMask | 2; // Tall bit
  }
  
  series.save();
}

export function handlePointEstablished(event: PointEstablished): void {
  log.info("Point established: seriesId={}, point={}", [
    event.params.seriesId.toString(),
    event.params.point.toString()
  ]);

  let seriesId = event.params.seriesId.toString();
  let series = GameSeries.load(seriesId);
  
  if (!series) {
    log.error("Series not found for point established: {}", [seriesId]);
    return;
  }

  series.phase = "POINT";
  series.point = event.params.point;
  series.save();
}

export function handlePointMade(event: PointMade): void {
  log.info("Point made: seriesId={}, point={}", [
    event.params.seriesId.toString(),
    event.params.point.toString()
  ]);

  let seriesId = event.params.seriesId.toString();
  let series = GameSeries.load(seriesId);
  
  if (!series) {
    log.error("Series not found for point made: {}", [seriesId]);
    return;
  }

  series.phase = "COME_OUT";
  series.point = 0;
  series.pointsMade = series.pointsMade.plus(BigInt.fromI32(1));
  series.consecutiveWins = series.consecutiveWins.plus(BigInt.fromI32(1));
  series.save();
}

export function handleSevenOut(event: SevenOut): void {
  log.info("Seven out: seriesId={}, shooter={}", [
    event.params.seriesId.toString(),
    event.params.shooter.toHexString()
  ]);

  let seriesId = event.params.seriesId.toString();
  let series = GameSeries.load(seriesId);
  
  if (!series) {
    log.error("Series not found for seven out: {}", [seriesId]);
    return;
  }

  // End the series
  series.phase = "IDLE";
  series.isActive = false;
  series.endBlock = event.block.number;
  series.consecutiveWins = BigInt.fromI32(0); // Reset on seven out
  series.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.totalGames = dailyMetric.totalGames.plus(BigInt.fromI32(1));
  
  // Calculate average game duration
  let gameDuration = series.endBlock!.minus(series.startBlock);
  let totalGames = dailyMetric.totalGames.toBigDecimal();
  let currentAvg = dailyMetric.avgGameDuration;
  let newAvg = currentAvg.times(totalGames.minus(BigInt.fromI32(1).toBigDecimal()))
    .plus(gameDuration.toBigDecimal())
    .div(totalGames);
  dailyMetric.avgGameDuration = newAvg;
  dailyMetric.save();

  // Update hourly metrics
  let hourlyMetric = getOrCreateHourlyMetric(event.block.timestamp);
  hourlyMetric.gamesCompleted = hourlyMetric.gamesCompleted.plus(BigInt.fromI32(1));
  
  // Calculate average game length in blocks
  let avgLength = gameDuration.toBigDecimal();
  if (hourlyMetric.gamesCompleted.gt(BigInt.fromI32(1))) {
    avgLength = hourlyMetric.avgGameLength
      .times(hourlyMetric.gamesCompleted.minus(BigInt.fromI32(1)).toBigDecimal())
      .plus(gameDuration.toBigDecimal())
      .div(hourlyMetric.gamesCompleted.toBigDecimal());
  }
  hourlyMetric.avgGameLength = avgLength;
  hourlyMetric.save();
}

export function handlePhaseChanged(event: PhaseChanged): void {
  log.info("Phase changed: from={}, to={}", [
    event.params.from.toString(),
    event.params.to.toString()
  ]);
  
  // Phase changes are already handled in other events
  // This is mainly for logging and debugging
}

export function handleRandomnessRequested(event: RandomnessRequested): void {
  log.info("Randomness requested: requestId={}", [
    event.params.requestId.toString()
  ]);
  
  // Store VRF request for correlation with fulfillment
  // This will be used to link dice rolls with their VRF requests
}

export function handleRandomnessFulfilled(event: RandomnessFulfilled): void {
  log.info("Randomness fulfilled: requestId={}, randomness={}", [
    event.params.requestId.toString(),
    event.params.randomness.toString()
  ]);
  
  // Find the corresponding dice roll and update VRF data
  // This requires correlating the request ID with the dice roll
}