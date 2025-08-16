import {
  FeeCollected,
  FeesDistributed,
  VaultAdded,
  VaultRemoved,
  HookAdded,
  HookRemoved,
  DistributionUpdated,
  BuybackExecuted,
  Recovered
} from "../../generated/Treasury/Treasury";

import {
  Treasury,
  TreasuryFeeCollection,
  TreasuryDistribution,
  TreasuryBuyback,
  DailyMetric,
  Protocol,
  User
} from "../../generated/schema";

import {
  getOrCreateTreasury,
  getOrCreateUser,
  getOrCreateDailyMetric,
  getOrCreateProtocol,
  ZERO_BD,
  ZERO_BI
} from "../utils/helpers";

import { BigInt, BigDecimal, log, dataSource, Address } from "@graphprotocol/graph-ts";

export function handleFeeCollected(event: FeeCollected): void {
  log.info("Fee collected: from={}, amount={}", [
    event.params.from.toHexString(),
    event.params.amount.toString()
  ]);

  let treasuryAddress = dataSource.address();
  let treasury = getOrCreateTreasury(treasuryAddress);

  // Update treasury stats
  treasury.totalFeesCollected = treasury.totalFeesCollected.plus(event.params.amount.toBigDecimal());
  treasury.lastUpdateTime = event.block.timestamp;
  treasury.save();

  // Create fee collection record
  let feeCollectionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let feeCollection = new TreasuryFeeCollection(feeCollectionId);
  feeCollection.treasury = treasury.id;
  feeCollection.from = event.params.from;
  feeCollection.amount = event.params.amount.toBigDecimal();
  feeCollection.timestamp = event.block.timestamp;
  feeCollection.blockNumber = event.block.number;
  feeCollection.transactionHash = event.transaction.hash;
  feeCollection.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalTreasuryFees = protocol.totalTreasuryFees.plus(event.params.amount.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.treasuryFeesCollected = dailyMetric.treasuryFeesCollected.plus(event.params.amount.toBigDecimal());
  dailyMetric.save();
}

export function handleFeesDistributed(event: FeesDistributed): void {
  log.info("Fees distributed: staking={}, buyback={}, dev={}, insurance={}", [
    event.params.stakingAmount.toString(),
    event.params.buybackAmount.toString(),
    event.params.devAmount.toString(),
    event.params.insuranceAmount.toString()
  ]);

  let treasuryAddress = dataSource.address();
  let treasury = getOrCreateTreasury(treasuryAddress);

  // Calculate total distributed
  let totalDistributed = event.params.stakingAmount
    .plus(event.params.buybackAmount)
    .plus(event.params.devAmount)
    .plus(event.params.insuranceAmount);

  // Update treasury stats
  treasury.totalFeesDistributed = treasury.totalFeesDistributed.plus(totalDistributed.toBigDecimal());
  treasury.stakingDistributed = treasury.stakingDistributed.plus(event.params.stakingAmount.toBigDecimal());
  treasury.buybackDistributed = treasury.buybackDistributed.plus(event.params.buybackAmount.toBigDecimal());
  treasury.devDistributed = treasury.devDistributed.plus(event.params.devAmount.toBigDecimal());
  treasury.insuranceDistributed = treasury.insuranceDistributed.plus(event.params.insuranceAmount.toBigDecimal());
  treasury.lastUpdateTime = event.block.timestamp;
  treasury.save();

  // Create distribution record
  let distributionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let distribution = new TreasuryDistribution(distributionId);
  distribution.treasury = treasury.id;
  distribution.stakingAmount = event.params.stakingAmount.toBigDecimal();
  distribution.buybackAmount = event.params.buybackAmount.toBigDecimal();
  distribution.devAmount = event.params.devAmount.toBigDecimal();
  distribution.insuranceAmount = event.params.insuranceAmount.toBigDecimal();
  distribution.totalAmount = totalDistributed.toBigDecimal();
  distribution.timestamp = event.block.timestamp;
  distribution.blockNumber = event.block.number;
  distribution.transactionHash = event.transaction.hash;
  distribution.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalDistributed = protocol.totalDistributed.plus(totalDistributed.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.treasuryDistributed = dailyMetric.treasuryDistributed.plus(totalDistributed.toBigDecimal());
  dailyMetric.save();
}

export function handleVaultAdded(event: VaultAdded): void {
  log.info("Vault added: vault={}", [
    event.params.vault.toHexString()
  ]);

  let treasuryAddress = dataSource.address();
  let treasury = getOrCreateTreasury(treasuryAddress);

  // Add vault to treasury's authorized vaults
  let vaults = treasury.authorizedVaults;
  vaults.push(event.params.vault);
  treasury.authorizedVaults = vaults;
  treasury.lastUpdateTime = event.block.timestamp;
  treasury.save();
}

export function handleVaultRemoved(event: VaultRemoved): void {
  log.info("Vault removed: vault={}", [
    event.params.vault.toHexString()
  ]);

  let treasuryAddress = dataSource.address();
  let treasury = getOrCreateTreasury(treasuryAddress);

  // Remove vault from treasury's authorized vaults
  let vaults = treasury.authorizedVaults;
  let index = vaults.indexOf(event.params.vault);
  if (index > -1) {
    vaults.splice(index, 1);
    treasury.authorizedVaults = vaults;
  }
  treasury.lastUpdateTime = event.block.timestamp;
  treasury.save();
}

export function handleHookAdded(event: HookAdded): void {
  log.info("Hook added: hook={}", [
    event.params.hook.toHexString()
  ]);

  let treasuryAddress = dataSource.address();
  let treasury = getOrCreateTreasury(treasuryAddress);

  // Add hook to treasury's authorized hooks
  let hooks = treasury.authorizedHooks;
  hooks.push(event.params.hook);
  treasury.authorizedHooks = hooks;
  treasury.lastUpdateTime = event.block.timestamp;
  treasury.save();
}

export function handleHookRemoved(event: HookRemoved): void {
  log.info("Hook removed: hook={}", [
    event.params.hook.toHexString()
  ]);

  let treasuryAddress = dataSource.address();
  let treasury = getOrCreateTreasury(treasuryAddress);

  // Remove hook from treasury's authorized hooks
  let hooks = treasury.authorizedHooks;
  let index = hooks.indexOf(event.params.hook);
  if (index > -1) {
    hooks.splice(index, 1);
    treasury.authorizedHooks = hooks;
  }
  treasury.lastUpdateTime = event.block.timestamp;
  treasury.save();
}

export function handleDistributionUpdated(event: DistributionUpdated): void {
  log.info("Distribution updated: staking={}, buyback={}, dev={}, insurance={}", [
    event.params.stakingPercent.toString(),
    event.params.buybackPercent.toString(),
    event.params.devPercent.toString(),
    event.params.insurancePercent.toString()
  ]);

  let treasuryAddress = dataSource.address();
  let treasury = getOrCreateTreasury(treasuryAddress);

  // Update distribution percentages
  treasury.stakingPercent = event.params.stakingPercent;
  treasury.buybackPercent = event.params.buybackPercent;
  treasury.devPercent = event.params.devPercent;
  treasury.insurancePercent = event.params.insurancePercent;
  treasury.lastUpdateTime = event.block.timestamp;
  treasury.save();
}

export function handleBuybackExecuted(event: BuybackExecuted): void {
  log.info("Buyback executed: ethSpent={}, tokensReceived={}", [
    event.params.ethSpent.toString(),
    event.params.tokensReceived.toString()
  ]);

  let treasuryAddress = dataSource.address();
  let treasury = getOrCreateTreasury(treasuryAddress);

  // Update treasury buyback stats
  treasury.totalBuybacks = treasury.totalBuybacks.plus(BigInt.fromI32(1));
  treasury.totalEthSpentOnBuybacks = treasury.totalEthSpentOnBuybacks.plus(event.params.ethSpent.toBigDecimal());
  treasury.totalTokensBoughtBack = treasury.totalTokensBoughtBack.plus(event.params.tokensReceived.toBigDecimal());
  treasury.lastUpdateTime = event.block.timestamp;
  treasury.save();

  // Create buyback record
  let buybackId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let buyback = new TreasuryBuyback(buybackId);
  buyback.treasury = treasury.id;
  buyback.ethSpent = event.params.ethSpent.toBigDecimal();
  buyback.tokensReceived = event.params.tokensReceived.toBigDecimal();
  buyback.timestamp = event.block.timestamp;
  buyback.blockNumber = event.block.number;
  buyback.transactionHash = event.transaction.hash;
  buyback.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalBuybacks = protocol.totalBuybacks.plus(BigInt.fromI32(1));
  protocol.totalTokensBoughtBack = protocol.totalTokensBoughtBack.plus(event.params.tokensReceived.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.buybacksExecuted = dailyMetric.buybacksExecuted.plus(BigInt.fromI32(1));
  dailyMetric.tokensBoughtBack = dailyMetric.tokensBoughtBack.plus(event.params.tokensReceived.toBigDecimal());
  dailyMetric.save();
}

export function handleRecovered(event: Recovered): void {
  log.info("Recovered: token={}, amount={}", [
    event.params.token.toHexString(),
    event.params.amount.toString()
  ]);

  // This is an admin function for emergency token recovery
  // We don't need to update any specific entities, just log it
}