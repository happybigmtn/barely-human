import {
  SwapFeeCollected,
  FeeSent
} from "../../generated/BotSwapFeeHookV4/BotSwapFeeHookV4";

import {
  SwapFeeCollection,
  User,
  DailyMetric,
  Protocol
} from "../../generated/schema";

import {
  getOrCreateUser,
  getOrCreateDailyMetric,
  getOrCreateProtocol,
  ZERO_BD,
  ZERO_BI
} from "../utils/helpers";

import { BigInt, BigDecimal, log, dataSource, Address } from "@graphprotocol/graph-ts";

export function handleSwapFeeCollected(event: SwapFeeCollected): void {
  log.info("Swap fee collected: poolId={}, token0={}, token1={}, fee0={}, fee1={}", [
    event.params.poolId.toHexString(),
    event.params.token0.toHexString(),
    event.params.token1.toHexString(),
    event.params.fee0.toString(),
    event.params.fee1.toString()
  ]);

  // Create swap fee collection record
  let feeCollectionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let feeCollection = new SwapFeeCollection(feeCollectionId);
  
  feeCollection.poolId = event.params.poolId;
  feeCollection.token0 = event.params.token0;
  feeCollection.token1 = event.params.token1;
  feeCollection.fee0Amount = event.params.fee0.toBigDecimal();
  feeCollection.fee1Amount = event.params.fee1.toBigDecimal();
  feeCollection.timestamp = event.block.timestamp;
  feeCollection.blockNumber = event.block.number;
  feeCollection.transactionHash = event.transaction.hash;
  feeCollection.save();

  // Calculate total fee value (this is simplified - in reality you'd need price oracles)
  let totalFeeValue = event.params.fee0.plus(event.params.fee1).toBigDecimal();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalSwapFees = protocol.totalSwapFees.plus(totalFeeValue);
  protocol.swapFeeCollections = protocol.swapFeeCollections.plus(BigInt.fromI32(1));
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.swapFeesCollected = dailyMetric.swapFeesCollected.plus(totalFeeValue);
  dailyMetric.swapFeeCollections = dailyMetric.swapFeeCollections.plus(BigInt.fromI32(1));
  dailyMetric.save();
}

export function handleFeeSent(event: FeeSent): void {
  log.info("Fee sent to treasury: amount={}", [
    event.params.amount.toString()
  ]);

  // Update protocol stats for fees sent to treasury
  let protocol = getOrCreateProtocol();
  protocol.swapFeesSentToTreasury = protocol.swapFeesSentToTreasury.plus(event.params.amount.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.swapFeesSentToTreasury = dailyMetric.swapFeesSentToTreasury.plus(event.params.amount.toBigDecimal());
  dailyMetric.save();
}