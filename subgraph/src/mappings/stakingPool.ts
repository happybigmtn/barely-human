import {
  Staked,
  Withdrawn,
  RewardPaid,
  RewardsAdded,
  RewardsDurationUpdated,
  Recovered
} from "../../generated/StakingPool/StakingPool";

import {
  StakingPool,
  StakingPosition,
  StakeEvent,
  StakingReward,
  User,
  DailyMetric,
  Protocol
} from "../../generated/schema";

import {
  getOrCreateUser,
  getOrCreateStakingPool,
  getOrCreateStakingPosition,
  getOrCreateDailyMetric,
  getOrCreateProtocol,
  ZERO_BD,
  ZERO_BI
} from "../utils/helpers";

import { BigInt, BigDecimal, log, dataSource } from "@graphprotocol/graph-ts";

export function handleStaked(event: Staked): void {
  log.info("Staked: user={}, amount={}", [
    event.params.user.toHexString(),
    event.params.amount.toString()
  ]);

  let poolAddress = dataSource.address();
  let pool = getOrCreateStakingPool(poolAddress);
  let user = getOrCreateUser(event.params.user);
  let position = getOrCreateStakingPosition(poolAddress, event.params.user);

  // Update pool stats
  pool.totalStaked = pool.totalStaked.plus(event.params.amount.toBigDecimal());
  pool.lastUpdateTime = event.block.timestamp;
  
  // If this is a new staker, increment count
  if (position.stakedAmount.equals(ZERO_BD)) {
    pool.stakerCount = pool.stakerCount.plus(BigInt.fromI32(1));
  }
  pool.save();

  // Update position
  position.stakedAmount = position.stakedAmount.plus(event.params.amount.toBigDecimal());
  if (position.firstStakeBlock.equals(ZERO_BI)) {
    position.firstStakeBlock = event.block.number;
  }
  position.lastActionBlock = event.block.number;
  position.save();

  // Create stake event
  let stakeEventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let stakeEvent = new StakeEvent(stakeEventId);
  stakeEvent.position = position.id;
  stakeEvent.type = "STAKE";
  stakeEvent.amount = event.params.amount.toBigDecimal();
  stakeEvent.timestamp = event.block.timestamp;
  stakeEvent.blockNumber = event.block.number;
  stakeEvent.transactionHash = event.transaction.hash;
  stakeEvent.save();

  // Update user activity
  user.lastActiveBlock = event.block.number;
  user.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalStaked = protocol.totalStaked.plus(event.params.amount.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.totalStaked = dailyMetric.totalStaked.plus(event.params.amount.toBigDecimal());
  dailyMetric.netStakeFlow = dailyMetric.netStakeFlow.plus(event.params.amount.toBigDecimal());
  dailyMetric.save();
}

export function handleWithdrawn(event: Withdrawn): void {
  log.info("Withdrawn: user={}, amount={}", [
    event.params.user.toHexString(),
    event.params.amount.toString()
  ]);

  let poolAddress = dataSource.address();
  let pool = getOrCreateStakingPool(poolAddress);
  let user = getOrCreateUser(event.params.user);
  let position = getOrCreateStakingPosition(poolAddress, event.params.user);

  // Update pool stats
  pool.totalStaked = pool.totalStaked.minus(event.params.amount.toBigDecimal());
  pool.lastUpdateTime = event.block.timestamp;
  
  // Check if user fully withdrew
  let newStakedAmount = position.stakedAmount.minus(event.params.amount.toBigDecimal());
  if (newStakedAmount.equals(ZERO_BD)) {
    pool.stakerCount = pool.stakerCount.minus(BigInt.fromI32(1));
  }
  pool.save();

  // Update position
  position.stakedAmount = newStakedAmount;
  position.lastActionBlock = event.block.number;
  position.save();

  // Create stake event
  let stakeEventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let stakeEvent = new StakeEvent(stakeEventId);
  stakeEvent.position = position.id;
  stakeEvent.type = "UNSTAKE";
  stakeEvent.amount = event.params.amount.toBigDecimal();
  stakeEvent.timestamp = event.block.timestamp;
  stakeEvent.blockNumber = event.block.number;
  stakeEvent.transactionHash = event.transaction.hash;
  stakeEvent.save();

  // Update user activity
  user.lastActiveBlock = event.block.number;
  user.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalStaked = protocol.totalStaked.minus(event.params.amount.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.totalUnstaked = dailyMetric.totalUnstaked.plus(event.params.amount.toBigDecimal());
  dailyMetric.netStakeFlow = dailyMetric.netStakeFlow.minus(event.params.amount.toBigDecimal());
  dailyMetric.save();
}

export function handleRewardPaid(event: RewardPaid): void {
  log.info("Reward paid: user={}, reward={}", [
    event.params.user.toHexString(),
    event.params.reward.toString()
  ]);

  let poolAddress = dataSource.address();
  let pool = getOrCreateStakingPool(poolAddress);
  let user = getOrCreateUser(event.params.user);
  let position = getOrCreateStakingPosition(poolAddress, event.params.user);

  // Update position
  position.rewardsPaid = position.rewardsPaid.plus(event.params.reward.toBigDecimal());
  position.lastActionBlock = event.block.number;
  position.save();

  // Create reward record
  let rewardId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let reward = new StakingReward(rewardId);
  reward.pool = pool.id;
  reward.position = position.id;
  reward.amount = event.params.reward.toBigDecimal();
  reward.timestamp = event.block.timestamp;
  reward.blockNumber = event.block.number;
  reward.transactionHash = event.transaction.hash;
  reward.save();

  // Update user activity
  user.lastActiveBlock = event.block.number;
  user.save();

  // Update pool stats
  pool.totalRewards = pool.totalRewards.plus(event.params.reward.toBigDecimal());
  pool.lastUpdateTime = event.block.timestamp;
  pool.save();
}

export function handleRewardsAdded(event: RewardsAdded): void {
  log.info("Rewards added: reward={}", [
    event.params.reward.toString()
  ]);

  let poolAddress = dataSource.address();
  let pool = getOrCreateStakingPool(poolAddress);

  // Update pool reward stats
  pool.totalRewards = pool.totalRewards.plus(event.params.reward.toBigDecimal());
  pool.lastUpdateTime = event.block.timestamp;
  pool.save();
}

export function handleRewardsDurationUpdated(event: RewardsDurationUpdated): void {
  log.info("Rewards duration updated: newDuration={}", [
    event.params.newDuration.toString()
  ]);

  let poolAddress = dataSource.address();
  let pool = getOrCreateStakingPool(poolAddress);

  // Update pool duration
  pool.rewardsDuration = event.params.newDuration;
  pool.lastUpdateTime = event.block.timestamp;
  pool.save();
}

export function handleRecovered(event: Recovered): void {
  log.info("Recovered: token={}, amount={}", [
    event.params.token.toHexString(),
    event.params.amount.toString()
  ]);

  // This is an admin function for emergency token recovery
  // We don't need to update any specific entities, just log it
}