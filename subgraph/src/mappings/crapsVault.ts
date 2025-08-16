import {
  Deposit,
  Withdraw,
  BetPlaced,
  BetSettled,
  PerformanceFeeExtracted,
  BotManagerUpdated,
  LPAdded,
  LPRemoved
} from "../../generated/templates/CrapsVault/CrapsVault";

import {
  Vault,
  VaultDeposit,
  VaultWithdrawal,
  VaultLP,
  User,
  Bot,
  Bet,
  DailyMetric,
  Protocol
} from "../../generated/schema";

import {
  getOrCreateUser,
  getOrCreateVault,
  getOrCreateDailyMetric,
  getOrCreateProtocol,
  ZERO_BD,
  ONE_BD
} from "../utils/helpers";

import { BigInt, BigDecimal, log, Address, dataSource } from "@graphprotocol/graph-ts";

export function handleVaultDeposit(event: Deposit): void {
  log.info("Vault deposit: caller={}, owner={}, assets={}, shares={}", [
    event.params.caller.toHexString(),
    event.params.owner.toHexString(),
    event.params.assets.toString(),
    event.params.shares.toString()
  ]);

  let vaultAddress = dataSource.address();
  let vault = getOrCreateVault(vaultAddress);
  let user = getOrCreateUser(event.params.owner);

  // Create deposit record
  let depositId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let deposit = new VaultDeposit(depositId);
  
  deposit.vault = vault.id;
  deposit.user = user.id;
  deposit.assets = event.params.assets.toBigDecimal();
  deposit.shares = event.params.shares.toBigDecimal();
  
  // Calculate share price at time of deposit
  if (event.params.shares.gt(BigInt.fromI32(0))) {
    deposit.sharePrice = event.params.assets.toBigDecimal().div(event.params.shares.toBigDecimal());
  } else {
    deposit.sharePrice = ONE_BD;
  }
  
  deposit.timestamp = event.block.timestamp;
  deposit.blockNumber = event.block.number;
  deposit.transactionHash = event.transaction.hash;
  deposit.save();

  // Update vault stats
  vault.totalAssets = vault.totalAssets.plus(event.params.assets.toBigDecimal());
  vault.totalShares = vault.totalShares.plus(event.params.shares.toBigDecimal());
  vault.totalDeposits = vault.totalDeposits.plus(event.params.assets.toBigDecimal());
  
  // Update share price
  if (vault.totalShares.gt(ZERO_BD)) {
    vault.sharePrice = vault.totalAssets.div(vault.totalShares);
  }
  
  // Update all-time high
  if (vault.sharePrice.gt(vault.allTimeHigh)) {
    vault.allTimeHigh = vault.sharePrice;
  }
  
  vault.save();

  // Create or update LP position
  let lpId = vault.id + "-" + user.id;
  let lp = VaultLP.load(lpId);
  if (!lp) {
    lp = new VaultLP(lpId);
    lp.vault = vault.id;
    lp.user = user.id;
    lp.shares = ZERO_BD;
    lp.totalDeposited = ZERO_BD;
    lp.totalWithdrawn = ZERO_BD;
    lp.currentValue = ZERO_BD;
    lp.realizedPnL = ZERO_BD;
    lp.unrealizedPnL = ZERO_BD;
    lp.firstDepositBlock = event.block.number;
    lp.lastActionBlock = event.block.number;
    
    // Increment LP count
    vault.lpCount = vault.lpCount.plus(BigInt.fromI32(1));
  } else {
    lp.lastActionBlock = event.block.number;
  }
  
  // Update LP position
  lp.shares = lp.shares.plus(event.params.shares.toBigDecimal());
  lp.totalDeposited = lp.totalDeposited.plus(event.params.assets.toBigDecimal());
  lp.currentValue = lp.shares.times(vault.sharePrice);
  lp.unrealizedPnL = lp.currentValue.minus(lp.totalDeposited).plus(lp.totalWithdrawn);
  lp.save();

  vault.save(); // Save again after LP count update

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.totalVaultDeposits = dailyMetric.totalVaultDeposits.plus(event.params.assets.toBigDecimal());
  dailyMetric.netVaultFlow = dailyMetric.netVaultFlow.plus(event.params.assets.toBigDecimal());
  dailyMetric.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalVaultTVL = protocol.totalVaultTVL.plus(event.params.assets.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleVaultWithdraw(event: Withdraw): void {
  log.info("Vault withdraw: caller={}, receiver={}, owner={}, assets={}, shares={}", [
    event.params.caller.toHexString(),
    event.params.receiver.toHexString(),
    event.params.owner.toHexString(),
    event.params.assets.toString(),
    event.params.shares.toString()
  ]);

  let vaultAddress = dataSource.address();
  let vault = getOrCreateVault(vaultAddress);
  let user = getOrCreateUser(event.params.owner);

  // Create withdrawal record
  let withdrawalId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let withdrawal = new VaultWithdrawal(withdrawalId);
  
  withdrawal.vault = vault.id;
  withdrawal.user = user.id;
  withdrawal.assets = event.params.assets.toBigDecimal();
  withdrawal.shares = event.params.shares.toBigDecimal();
  
  // Calculate share price at time of withdrawal
  if (event.params.shares.gt(BigInt.fromI32(0))) {
    withdrawal.sharePrice = event.params.assets.toBigDecimal().div(event.params.shares.toBigDecimal());
  } else {
    withdrawal.sharePrice = vault.sharePrice;
  }
  
  withdrawal.timestamp = event.block.timestamp;
  withdrawal.blockNumber = event.block.number;
  withdrawal.transactionHash = event.transaction.hash;
  withdrawal.save();

  // Update vault stats
  vault.totalAssets = vault.totalAssets.minus(event.params.assets.toBigDecimal());
  vault.totalShares = vault.totalShares.minus(event.params.shares.toBigDecimal());
  vault.totalWithdrawals = vault.totalWithdrawals.plus(event.params.assets.toBigDecimal());
  
  // Update share price
  if (vault.totalShares.gt(ZERO_BD)) {
    vault.sharePrice = vault.totalAssets.div(vault.totalShares);
  }
  
  // Update all-time low
  if (vault.allTimeLow.equals(ZERO_BD) || vault.sharePrice.lt(vault.allTimeLow)) {
    vault.allTimeLow = vault.sharePrice;
  }
  
  // Calculate max drawdown
  if (vault.allTimeHigh.gt(ZERO_BD)) {
    let currentDrawdown = vault.allTimeHigh.minus(vault.sharePrice).div(vault.allTimeHigh);
    if (currentDrawdown.gt(vault.maxDrawdown)) {
      vault.maxDrawdown = currentDrawdown;
    }
  }
  
  vault.save();

  // Update LP position
  let lpId = vault.id + "-" + user.id;
  let lp = VaultLP.load(lpId);
  if (lp) {
    lp.shares = lp.shares.minus(event.params.shares.toBigDecimal());
    lp.totalWithdrawn = lp.totalWithdrawn.plus(event.params.assets.toBigDecimal());
    lp.currentValue = lp.shares.times(vault.sharePrice);
    lp.lastActionBlock = event.block.number;
    
    // Calculate realized P&L for this withdrawal
    let avgCostBasis = lp.totalDeposited.div(lp.shares.plus(event.params.shares.toBigDecimal()));
    let costOfWithdrawnShares = avgCostBasis.times(event.params.shares.toBigDecimal());
    let realizedPnL = event.params.assets.toBigDecimal().minus(costOfWithdrawnShares);
    lp.realizedPnL = lp.realizedPnL.plus(realizedPnL);
    
    // Update unrealized P&L
    lp.unrealizedPnL = lp.currentValue.minus(lp.totalDeposited).plus(lp.totalWithdrawn);
    
    // If shares are zero, this LP has fully withdrawn
    if (lp.shares.equals(ZERO_BD)) {
      vault.lpCount = vault.lpCount.minus(BigInt.fromI32(1));
      vault.save();
    }
    
    lp.save();
  }

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.totalVaultWithdrawals = dailyMetric.totalVaultWithdrawals.plus(event.params.assets.toBigDecimal());
  dailyMetric.netVaultFlow = dailyMetric.netVaultFlow.minus(event.params.assets.toBigDecimal());
  dailyMetric.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalVaultTVL = protocol.totalVaultTVL.minus(event.params.assets.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleVaultBetPlaced(event: BetPlaced): void {
  log.info("Vault bet placed: betId={}, amount={}, seriesId={}", [
    event.params.betId.toString(),
    event.params.amount.toString(),
    event.params.seriesId.toString()
  ]);

  let vaultAddress = dataSource.address();
  let vault = getOrCreateVault(vaultAddress);

  // This bet is placed by the vault's bot
  // We'll need to link it to the specific bet in the main betting system
  // For now, we'll just update vault stats
  
  vault.save();
}

export function handleVaultBetSettled(event: BetSettled): void {
  log.info("Vault bet settled: betId={}, payout={}, won={}", [
    event.params.betId.toString(),
    event.params.payout.toString(),
    event.params.won.toString()
  ]);

  let vaultAddress = dataSource.address();
  let vault = getOrCreateVault(vaultAddress);

  // Update vault P&L based on bet outcome
  let payout = event.params.payout.toBigDecimal();
  
  if (event.params.won) {
    vault.totalPnL = vault.totalPnL.plus(payout);
  } else {
    // For losses, we'd need the original bet amount
    // This is a limitation of the current event structure
  }
  
  vault.save();

  // Update bot if linked
  if (vault.bot) {
    let bot = Bot.load(vault.bot!);
    if (bot) {
      bot.currentBankroll = vault.totalAssets; // Simplified - vault assets represent bot bankroll
      bot.save();
    }
  }
}

export function handlePerformanceFeeExtracted(event: PerformanceFeeExtracted): void {
  log.info("Performance fee extracted: feeAmount={}, profit={}", [
    event.params.feeAmount.toString(),
    event.params.profit.toString()
  ]);

  let vaultAddress = dataSource.address();
  let vault = getOrCreateVault(vaultAddress);

  // Update vault performance fee tracking
  vault.totalPerformanceFees = vault.totalPerformanceFees.plus(event.params.feeAmount.toBigDecimal());
  vault.totalPnL = vault.totalPnL.plus(event.params.profit.toBigDecimal());
  vault.save();

  // Update protocol treasury fees
  let protocol = getOrCreateProtocol();
  protocol.totalTreasuryFees = protocol.totalTreasuryFees.plus(event.params.feeAmount.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleBotManagerUpdated(event: BotManagerUpdated): void {
  log.info("Bot manager updated: newManager={}", [
    event.params.newManager.toHexString()
  ]);

  // This is an administrative event - no specific entity updates needed
  // but we can log it for debugging purposes
}

export function handleLPAdded(event: LPAdded): void {
  log.info("LP added: lp={}, shares={}", [
    event.params.lp.toHexString(),
    event.params.shares.toString()
  ]);

  let vaultAddress = dataSource.address();
  let vault = getOrCreateVault(vaultAddress);
  let user = getOrCreateUser(event.params.lp);

  // This is typically called when an LP position is first created
  // Most of the logic is handled in the deposit event
  user.lastActiveBlock = event.block.number;
  user.save();
}

export function handleLPRemoved(event: LPRemoved): void {
  log.info("LP removed: lp={}", [
    event.params.lp.toHexString()
  ]);

  let vaultAddress = dataSource.address();
  let vault = getOrCreateVault(vaultAddress);
  let user = getOrCreateUser(event.params.lp);

  // Mark the LP position as fully withdrawn
  let lpId = vault.id + "-" + user.id;
  let lp = VaultLP.load(lpId);
  if (lp) {
    lp.shares = ZERO_BD;
    lp.currentValue = ZERO_BD;
    lp.lastActionBlock = event.block.number;
    lp.save();
  }

  user.lastActiveBlock = event.block.number;
  user.save();
}