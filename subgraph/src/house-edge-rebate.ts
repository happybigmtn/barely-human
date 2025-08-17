import { BigInt } from "@graphprotocol/graph-ts"
import {
  TokensCollected,
  TokensIssued,
  WeeklySettlementFinalized,
  RebateClaimed
} from "../generated/HouseEdgeRebate/HouseEdgeRebate"
import { WeeklySettlement, RebateClaim, VolumeRecord, Player, GlobalStats } from "../generated/schema"

export function handleTokensCollected(event: TokensCollected): void {
  let week = event.params.week
  let amount = event.params.amount
  let player = event.params.from
  
  // Update or create weekly settlement
  let settlement = WeeklySettlement.load(week.toString())
  if (!settlement) {
    settlement = new WeeklySettlement(week.toString())
    settlement.week = week
    settlement.totalCollected = BigInt.fromI32(0)
    settlement.totalIssued = BigInt.fromI32(0)
    settlement.netPosition = BigInt.fromI32(0)
    settlement.totalVolume = BigInt.fromI32(0)
    settlement.rebatePerVolume = BigInt.fromI32(0)
    settlement.totalClaimed = BigInt.fromI32(0)
    settlement.finalized = false
    settlement.expirationTimestamp = BigInt.fromI32(0)
  }
  
  settlement.totalCollected = settlement.totalCollected.plus(amount)
  settlement.netPosition = settlement.totalCollected.minus(settlement.totalIssued)
  settlement.save()
  
  // Update global stats
  updateGlobalStatsRebate("COLLECTED", amount)
}

export function handleTokensIssued(event: TokensIssued): void {
  let week = event.params.week
  let amount = event.params.amount
  let player = event.params.to
  
  // Update weekly settlement
  let settlement = WeeklySettlement.load(week.toString())
  if (!settlement) {
    settlement = new WeeklySettlement(week.toString())
    settlement.week = week
    settlement.totalCollected = BigInt.fromI32(0)
    settlement.totalIssued = BigInt.fromI32(0)
    settlement.netPosition = BigInt.fromI32(0)
    settlement.totalVolume = BigInt.fromI32(0)
    settlement.rebatePerVolume = BigInt.fromI32(0)
    settlement.totalClaimed = BigInt.fromI32(0)
    settlement.finalized = false
    settlement.expirationTimestamp = BigInt.fromI32(0)
  }
  
  settlement.totalIssued = settlement.totalIssued.plus(amount)
  settlement.netPosition = settlement.totalCollected.minus(settlement.totalIssued)
  settlement.save()
  
  // Update global stats
  updateGlobalStatsRebate("ISSUED", amount)
}

export function handleWeeklySettlement(event: WeeklySettlementFinalized): void {
  let week = event.params.week
  let netPosition = event.params.netPosition
  let totalVolume = event.params.totalVolume
  
  let settlement = WeeklySettlement.load(week.toString())
  if (!settlement) {
    settlement = new WeeklySettlement(week.toString())
    settlement.week = week
    settlement.totalCollected = BigInt.fromI32(0)
    settlement.totalIssued = BigInt.fromI32(0)
  }
  
  settlement.netPosition = netPosition
  settlement.totalVolume = totalVolume
  settlement.finalized = true
  settlement.expirationTimestamp = event.block.timestamp.plus(BigInt.fromI32(604800)) // 1 week
  
  // Calculate rebate per volume if positive net position
  if (netPosition.gt(BigInt.fromI32(0)) && totalVolume.gt(BigInt.fromI32(0))) {
    settlement.rebatePerVolume = netPosition.times(BigInt.fromI32(10).pow(18)).div(totalVolume)
  }
  
  settlement.save()
}

export function handleRebateClaimed(event: RebateClaimed): void {
  let claimId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let claim = new RebateClaim(claimId)
  
  claim.player = event.params.player.toHexString()
  claim.week = event.params.week
  claim.amount = event.params.amount
  claim.timestamp = event.block.timestamp
  claim.txHash = event.transaction.hash
  
  claim.save()
  
  // Update player stats
  let player = Player.load(event.params.player.toHexString())
  if (player) {
    player.rebatesClaimed = player.rebatesClaimed.plus(event.params.amount)
    player.save()
  }
  
  // Update weekly settlement
  let settlement = WeeklySettlement.load(event.params.week.toString())
  if (settlement) {
    settlement.totalClaimed = settlement.totalClaimed.plus(event.params.amount)
    settlement.save()
  }
  
  // Update global stats
  updateGlobalStatsRebate("REBATE_CLAIMED", event.params.amount)
}

function updateGlobalStatsRebate(action: string, amount: BigInt): void {
  let stats = GlobalStats.load("global")
  if (!stats) {
    stats = new GlobalStats("global")
    stats.totalGamesPlayed = BigInt.fromI32(0)
    stats.totalVolume = BigInt.fromI32(0)
    stats.totalHouseEdgeCollected = BigInt.fromI32(0)
    stats.totalRebatesDistributed = BigInt.fromI32(0)
    stats.totalNFTsMinted = BigInt.fromI32(0)
    stats.totalNFTVolume = BigInt.fromI32(0)
    stats.uniquePlayers = BigInt.fromI32(0)
    stats.activeBots = BigInt.fromI32(10)
  }
  
  if (action == "COLLECTED") {
    stats.totalHouseEdgeCollected = stats.totalHouseEdgeCollected.plus(amount)
  } else if (action == "REBATE_CLAIMED") {
    stats.totalRebatesDistributed = stats.totalRebatesDistributed.plus(amount)
  }
  
  stats.save()
}