import {
  Transfer,
  Approval,
  Paused,
  Unpaused,
  RoleGranted,
  RoleRevoked
} from "../../generated/BOTToken/BOTToken";

import {
  TokenTransfer,
  TokenApproval,
  TokenHolder,
  User,
  DailyMetric,
  Protocol
} from "../../generated/schema";

import {
  getOrCreateUser,
  getOrCreateTokenHolder,
  getOrCreateDailyMetric,
  getOrCreateProtocol,
  ZERO_BD,
  ZERO_BI,
  ADDRESS_ZERO
} from "../utils/helpers";

import { BigInt, BigDecimal, log, dataSource, Address } from "@graphprotocol/graph-ts";

export function handleTransfer(event: Transfer): void {
  log.info("Token transfer: from={}, to={}, value={}", [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.value.toString()
  ]);

  let tokenAddress = dataSource.address();
  let isMint = event.params.from.equals(ADDRESS_ZERO);
  let isBurn = event.params.to.equals(ADDRESS_ZERO);

  // Create transfer record
  let transferId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let transfer = new TokenTransfer(transferId);
  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.value = event.params.value.toBigDecimal();
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash;
  transfer.isMint = isMint;
  transfer.isBurn = isBurn;
  transfer.save();

  // Update sender balance (if not a mint)
  if (!isMint) {
    let fromUser = getOrCreateUser(event.params.from);
    let fromHolder = getOrCreateTokenHolder(tokenAddress, event.params.from);
    
    fromHolder.balance = fromHolder.balance.minus(event.params.value.toBigDecimal());
    fromHolder.lastTransferTime = event.block.timestamp;
    fromHolder.save();
    
    fromUser.lastActiveBlock = event.block.number;
    fromUser.save();
  }

  // Update receiver balance (if not a burn)
  if (!isBurn) {
    let toUser = getOrCreateUser(event.params.to);
    let toHolder = getOrCreateTokenHolder(tokenAddress, event.params.to);
    
    let previousBalance = toHolder.balance;
    toHolder.balance = toHolder.balance.plus(event.params.value.toBigDecimal());
    toHolder.lastTransferTime = event.block.timestamp;
    
    // Track if this is a new holder
    if (previousBalance.equals(ZERO_BD)) {
      toHolder.firstTransferTime = event.block.timestamp;
      toHolder.firstTransferBlock = event.block.number;
      
      // Increment holder count in protocol
      let protocol = getOrCreateProtocol();
      protocol.tokenHolders = protocol.tokenHolders.plus(BigInt.fromI32(1));
      protocol.lastUpdated = event.block.timestamp;
      protocol.save();
    }
    
    toHolder.save();
    
    toUser.lastActiveBlock = event.block.number;
    toUser.save();
  }

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  
  if (isMint) {
    dailyMetric.tokensMinted = dailyMetric.tokensMinted.plus(event.params.value.toBigDecimal());
  } else if (isBurn) {
    dailyMetric.tokensBurned = dailyMetric.tokensBurned.plus(event.params.value.toBigDecimal());
  } else {
    dailyMetric.tokenTransfers = dailyMetric.tokenTransfers.plus(BigInt.fromI32(1));
    dailyMetric.tokenVolume = dailyMetric.tokenVolume.plus(event.params.value.toBigDecimal());
  }
  
  dailyMetric.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  if (isMint) {
    protocol.totalTokenSupply = protocol.totalTokenSupply.plus(event.params.value.toBigDecimal());
  } else if (isBurn) {
    protocol.totalTokenSupply = protocol.totalTokenSupply.minus(event.params.value.toBigDecimal());
  }
  protocol.totalTokenTransfers = protocol.totalTokenTransfers.plus(BigInt.fromI32(1));
  protocol.totalTokenVolume = protocol.totalTokenVolume.plus(event.params.value.toBigDecimal());
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleApproval(event: Approval): void {
  log.info("Token approval: owner={}, spender={}, value={}", [
    event.params.owner.toHexString(),
    event.params.spender.toHexString(),
    event.params.value.toString()
  ]);

  // Create approval record
  let approvalId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let approval = new TokenApproval(approvalId);
  approval.owner = event.params.owner;
  approval.spender = event.params.spender;
  approval.value = event.params.value.toBigDecimal();
  approval.timestamp = event.block.timestamp;
  approval.blockNumber = event.block.number;
  approval.transactionHash = event.transaction.hash;
  approval.save();

  // Update user activity
  let user = getOrCreateUser(event.params.owner);
  user.lastActiveBlock = event.block.number;
  user.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.tokenApprovals = dailyMetric.tokenApprovals.plus(BigInt.fromI32(1));
  dailyMetric.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalTokenApprovals = protocol.totalTokenApprovals.plus(BigInt.fromI32(1));
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handlePaused(event: Paused): void {
  log.info("Token paused by: {}", [
    event.params.account.toHexString()
  ]);

  // Update protocol status
  let protocol = getOrCreateProtocol();
  protocol.tokenPaused = true;
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleUnpaused(event: Unpaused): void {
  log.info("Token unpaused by: {}", [
    event.params.account.toHexString()
  ]);

  // Update protocol status
  let protocol = getOrCreateProtocol();
  protocol.tokenPaused = false;
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleRoleGranted(event: RoleGranted): void {
  log.info("Role granted: role={}, account={}, sender={}", [
    event.params.role.toHexString(),
    event.params.account.toHexString(),
    event.params.sender.toHexString()
  ]);

  // Update user activity for role recipient
  let user = getOrCreateUser(event.params.account);
  user.lastActiveBlock = event.block.number;
  user.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleRoleRevoked(event: RoleRevoked): void {
  log.info("Role revoked: role={}, account={}, sender={}", [
    event.params.role.toHexString(),
    event.params.account.toHexString(),
    event.params.sender.toHexString()
  ]);

  // Update user activity for affected account
  let user = getOrCreateUser(event.params.account);
  user.lastActiveBlock = event.block.number;
  user.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}