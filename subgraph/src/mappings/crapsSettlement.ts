import {
  BetSettled,
  BetPushed,
  BatchSettlement,
  FieldBetResolved,
  HardwayResolved
} from "../../generated/CrapsSettlement/CrapsSettlement";

import {
  BetSettlement,
  Bet,
  DiceRoll,
  User,
  Protocol,
  GameSeries
} from "../../generated/schema";

import {
  getOrCreateUser,
  getOrCreateProtocol,
  updateUserStats,
  updateBotStats
} from "../utils/helpers";

import { BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";

export function handleBetSettled(event: BetSettled): void {
  log.info("Bet settled: player={}, seriesId={}, betType={}, amount={}, payout={}, won={}", [
    event.params.player.toHexString(),
    event.params.seriesId.toString(),
    event.params.betType.toString(),
    event.params.amount.toString(),
    event.params.payout.toString(),
    event.params.won.toString()
  ]);

  // Find the corresponding bet
  let betId = event.params.player.toHexString() + 
             "-" + event.params.seriesId.toString() + 
             "-" + event.params.betType.toString();
  
  let bet = Bet.load(betId);
  if (!bet) {
    log.error("Bet not found for settlement: {}", [betId]);
    return;
  }

  // Create settlement record
  let settlementId = betId + "-" + event.transaction.hash.toHexString();
  let settlement = new BetSettlement(settlementId);
  
  settlement.bet = betId;
  settlement.roll = ""; // Would need to be linked to the specific roll that triggered settlement
  settlement.won = event.params.won;
  settlement.payout = event.params.payout.toBigDecimal();
  settlement.pushAmount = BigDecimal.fromString("0"); // No push in this event
  settlement.timestamp = event.block.timestamp;
  settlement.blockNumber = event.block.number;
  settlement.transactionHash = event.transaction.hash;
  
  // Calculate settlement details
  let betAmount = event.params.amount.toBigDecimal();
  let payoutAmount = event.params.payout.toBigDecimal();
  
  if (event.params.won && payoutAmount.gt(BigDecimal.fromString("0"))) {
    settlement.payoutMultiplier = payoutAmount.div(betAmount);
    
    // Calculate house edge (simplified calculation)
    let profit = payoutAmount.minus(betAmount);
    let houseEdge = profit.div(betAmount).times(BigDecimal.fromString("100"));
    settlement.houseEdge = houseEdge;
  } else {
    settlement.payoutMultiplier = BigDecimal.fromString("0");
    settlement.houseEdge = BigDecimal.fromString("100"); // 100% house edge on losses
  }
  
  settlement.save();

  // Link settlement to bet
  bet.settlement = settlementId;
  bet.isResolved = true;
  bet.isActive = false;
  bet.save();

  // Update user stats
  let user = getOrCreateUser(event.params.player);
  updateUserStats(user, event.params.won, betAmount, payoutAmount);
  user.save();

  // Update bot stats if this is a bot bet
  if (bet.bot) {
    let bot = Bot.load(bet.bot!);
    if (bot) {
      updateBotStats(bot, event.params.won, betAmount, payoutAmount);
      bot.save();
    }
  }

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalPayouts = protocol.totalPayouts.plus(payoutAmount);
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update series stats
  let series = GameSeries.load(event.params.seriesId.toString());
  if (series) {
    series.totalPayouts = series.totalPayouts.plus(payoutAmount);
    series.save();
  }
}

export function handleBetPushed(event: BetPushed): void {
  log.info("Bet pushed: player={}, seriesId={}, betType={}, amount={}", [
    event.params.player.toHexString(),
    event.params.seriesId.toString(),
    event.params.betType.toString(),
    event.params.amount.toString()
  ]);

  // Find the corresponding bet
  let betId = event.params.player.toHexString() + 
             "-" + event.params.seriesId.toString() + 
             "-" + event.params.betType.toString();
  
  let bet = Bet.load(betId);
  if (!bet) {
    log.error("Bet not found for push: {}", [betId]);
    return;
  }

  // Create settlement record for push
  let settlementId = betId + "-" + event.transaction.hash.toHexString();
  let settlement = new BetSettlement(settlementId);
  
  settlement.bet = betId;
  settlement.roll = ""; // Would need to be linked to the specific roll
  settlement.won = false; // Push is neither win nor loss, but we'll mark as false
  settlement.payout = BigDecimal.fromString("0");
  settlement.pushAmount = event.params.amount.toBigDecimal();
  settlement.timestamp = event.block.timestamp;
  settlement.blockNumber = event.block.number;
  settlement.transactionHash = event.transaction.hash;
  settlement.payoutMultiplier = BigDecimal.fromString("1"); // Return original amount
  settlement.houseEdge = BigDecimal.fromString("0"); // No house edge on pushes
  
  settlement.save();

  // Update bet status
  bet.settlement = settlementId;
  bet.isResolved = true;
  bet.isActive = false;
  bet.save();

  // For pushes, we don't update win/loss stats, just activity
  let user = getOrCreateUser(event.params.player);
  user.lastActiveBlock = event.block.number;
  user.save();
}

export function handleBatchSettlement(event: BatchSettlement): void {
  log.info("Batch settlement: seriesId={}, rollNumber={}, diceTotal={}, totalPayout={}", [
    event.params.seriesId.toString(),
    event.params.rollNumber.toString(),
    event.params.diceTotal.toString(),
    event.params.totalPayout.toString()
  ]);

  // Find the corresponding dice roll
  let series = GameSeries.load(event.params.seriesId.toString());
  if (series) {
    // Find the roll by matching the roll number
    // This is a simplified approach - in practice you might need a different strategy
    let rollId = event.transaction.hash.toHexString() + "-batch";
    let roll = DiceRoll.load(rollId);
    
    if (!roll) {
      // Create a batch settlement record
      roll = new DiceRoll(rollId);
      roll.series = series.id;
      roll.rollNumber = event.params.rollNumber;
      roll.die1 = 0; // Unknown individual dice
      roll.die2 = 0;
      roll.total = event.params.diceTotal;
      roll.timestamp = event.block.timestamp;
      roll.blockNumber = event.block.number;
      roll.transactionHash = event.transaction.hash;
      roll.betsSettled = BigInt.fromI32(0); // Will be updated
      roll.totalPayout = event.params.totalPayout.toBigDecimal();
      roll.save();
    } else {
      // Update existing roll with settlement info
      roll.totalPayout = event.params.totalPayout.toBigDecimal();
      roll.save();
    }
  }

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalPayouts = protocol.totalPayouts.plus(event.params.totalPayout.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleFieldBetResolved(event: FieldBetResolved): void {
  log.info("Field bet resolved: player={}, diceTotal={}, payout={}", [
    event.params.player.toHexString(),
    event.params.diceTotal.toString(),
    event.params.payout.toString()
  ]);

  // Field bets are special cases with specific payout rules
  // This gives us more granular data about field bet outcomes
  
  let user = getOrCreateUser(event.params.player);
  user.lastActiveBlock = event.block.number;
  
  // Update user stats based on field bet outcome
  let payout = event.params.payout.toBigDecimal();
  let won = payout.gt(BigDecimal.fromString("0"));
  
  if (won) {
    user.totalWinnings = user.totalWinnings.plus(payout);
  }
  // Note: We don't have the original bet amount here, so we can't update losses accurately
  
  user.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalPayouts = protocol.totalPayouts.plus(payout);
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleHardwayResolved(event: HardwayResolved): void {
  log.info("Hardway resolved: player={}, hardwayType={}, wonHard={}, payout={}", [
    event.params.player.toHexString(),
    event.params.hardwayType.toString(),
    event.params.wonHard.toString(),
    event.params.payout.toString()
  ]);

  // Hardway bets are another special case
  // wonHard indicates if the player won by rolling the hard way (doubles)
  
  let user = getOrCreateUser(event.params.player);
  user.lastActiveBlock = event.block.number;
  
  let payout = event.params.payout.toBigDecimal();
  let won = payout.gt(BigDecimal.fromString("0"));
  
  if (won) {
    user.totalWinnings = user.totalWinnings.plus(payout);
  }
  
  user.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalPayouts = protocol.totalPayouts.plus(payout);
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}