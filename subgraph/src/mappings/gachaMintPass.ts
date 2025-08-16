import {
  RaffleStarted,
  PlayerEntered,
  WinnersSelected,
  MintPassesMinted,
  MintPassRedeemed,
  Transfer
} from "../../generated/GachaMintPass/GachaMintPass";

import {
  GachaRaffle,
  RaffleEntry,
  MintPass,
  GenerativeArt,
  User,
  DailyMetric,
  Protocol
} from "../../generated/schema";

import {
  getOrCreateUser,
  getOrCreateDailyMetric,
  getOrCreateProtocol,
  ZERO_BD,
  ZERO_BI,
  ADDRESS_ZERO
} from "../utils/helpers";

import { BigInt, BigDecimal, log, dataSource, Address, Bytes } from "@graphprotocol/graph-ts";

export function handleRaffleStarted(event: RaffleStarted): void {
  log.info("Raffle started: raffleId={}, endTime={}, mintPasses={}", [
    event.params.raffleId.toString(),
    event.params.endTime.toString(),
    event.params.mintPasses.toString()
  ]);

  let raffleId = event.params.raffleId.toString();
  let raffle = new GachaRaffle(raffleId);
  
  raffle.raffleId = event.params.raffleId;
  raffle.mintPassCount = event.params.mintPasses;
  raffle.startTime = event.block.timestamp;
  raffle.endTime = event.params.endTime;
  raffle.entryCount = ZERO_BI;
  raffle.totalTickets = ZERO_BI;
  raffle.isActive = true;
  raffle.winnersSelected = false;
  raffle.blockNumber = event.block.number;
  raffle.transactionHash = event.transaction.hash;
  raffle.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalRaffles = protocol.totalRaffles.plus(BigInt.fromI32(1));
  protocol.activeRaffles = protocol.activeRaffles.plus(BigInt.fromI32(1));
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.rafflesStarted = dailyMetric.rafflesStarted.plus(BigInt.fromI32(1));
  dailyMetric.save();
}

export function handlePlayerEntered(event: PlayerEntered): void {
  log.info("Player entered raffle: raffleId={}, player={}, tickets={}", [
    event.params.raffleId.toString(),
    event.params.player.toHexString(),
    event.params.tickets.toString()
  ]);

  let raffleId = event.params.raffleId.toString();
  let raffle = GachaRaffle.load(raffleId);
  
  if (raffle == null) {
    log.error("Raffle not found: {}", [raffleId]);
    return;
  }

  let user = getOrCreateUser(event.params.player);

  // Create or update raffle entry
  let entryId = raffleId + "-" + event.params.player.toHexString();
  let entry = RaffleEntry.load(entryId);
  
  if (entry == null) {
    entry = new RaffleEntry(entryId);
    entry.raffle = raffle.id;
    entry.player = user.id;
    entry.tickets = ZERO_BI;
    
    // Increment entry count for new players
    raffle.entryCount = raffle.entryCount.plus(BigInt.fromI32(1));
  }
  
  // Update ticket count
  entry.tickets = entry.tickets.plus(event.params.tickets);
  entry.lastEntryTime = event.block.timestamp;
  entry.save();

  // Update raffle total tickets
  raffle.totalTickets = raffle.totalTickets.plus(event.params.tickets);
  raffle.save();

  // Update user activity
  user.lastActiveBlock = event.block.number;
  user.raffleEntriesCount = user.raffleEntriesCount.plus(BigInt.fromI32(1));
  user.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.raffleEntries = dailyMetric.raffleEntries.plus(BigInt.fromI32(1));
  dailyMetric.save();
}

export function handleWinnersSelected(event: WinnersSelected): void {
  log.info("Winners selected: raffleId={}, winners={}", [
    event.params.raffleId.toString(),
    event.params.winners.length.toString()
  ]);

  let raffleId = event.params.raffleId.toString();
  let raffle = GachaRaffle.load(raffleId);
  
  if (raffle == null) {
    log.error("Raffle not found: {}", [raffleId]);
    return;
  }

  // Update raffle status
  raffle.winnersSelected = true;
  raffle.isActive = false;
  raffle.endTime = event.block.timestamp;
  raffle.winners = event.params.winners;
  raffle.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.activeRaffles = protocol.activeRaffles.minus(BigInt.fromI32(1));
  protocol.totalWinners = protocol.totalWinners.plus(BigInt.fromI32(event.params.winners.length));
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.raffleWinners = dailyMetric.raffleWinners.plus(BigInt.fromI32(event.params.winners.length));
  dailyMetric.save();
}

export function handleMintPassesMinted(event: MintPassesMinted): void {
  log.info("Mint passes minted: recipients={}, tokenIds={}", [
    event.params.recipients.length.toString(),
    event.params.tokenIds.length.toString()
  ]);

  for (let i = 0; i < event.params.recipients.length; i++) {
    let recipient = event.params.recipients[i];
    let tokenId = event.params.tokenIds[i];
    
    let user = getOrCreateUser(recipient);
    
    // Create mint pass
    let mintPassId = dataSource.address().toHexString() + "-" + tokenId.toString();
    let mintPass = new MintPass(mintPassId);
    mintPass.tokenId = tokenId;
    mintPass.owner = user.id;
    mintPass.isRedeemed = false;
    mintPass.mintTime = event.block.timestamp;
    mintPass.mintBlock = event.block.number;
    mintPass.mintTransactionHash = event.transaction.hash;
    mintPass.save();

    // Update user stats
    user.mintPassesOwned = user.mintPassesOwned.plus(BigInt.fromI32(1));
    user.lastActiveBlock = event.block.number;
    user.save();
  }

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalMintPasses = protocol.totalMintPasses.plus(BigInt.fromI32(event.params.recipients.length));
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.mintPassesMinted = dailyMetric.mintPassesMinted.plus(BigInt.fromI32(event.params.recipients.length));
  dailyMetric.save();
}

export function handleMintPassRedeemed(event: MintPassRedeemed): void {
  log.info("Mint pass redeemed: tokenId={}, artTokenId={}, owner={}", [
    event.params.tokenId.toString(),
    event.params.artTokenId.toString(),
    event.params.owner.toHexString()
  ]);

  let mintPassId = dataSource.address().toHexString() + "-" + event.params.tokenId.toString();
  let mintPass = MintPass.load(mintPassId);
  
  if (mintPass == null) {
    log.error("Mint pass not found: {}", [mintPassId]);
    return;
  }

  let user = getOrCreateUser(event.params.owner);

  // Update mint pass
  mintPass.isRedeemed = true;
  mintPass.redeemTime = event.block.timestamp;
  mintPass.redeemBlock = event.block.number;
  mintPass.redeemTransactionHash = event.transaction.hash;
  mintPass.artTokenId = event.params.artTokenId;
  mintPass.save();

  // Create generative art record
  let artId = dataSource.address().toHexString() + "-art-" + event.params.artTokenId.toString();
  let art = new GenerativeArt(artId);
  art.tokenId = event.params.artTokenId;
  art.owner = user.id;
  art.mintPass = mintPass.id;
  art.createdTime = event.block.timestamp;
  art.createdBlock = event.block.number;
  art.transactionHash = event.transaction.hash;
  art.save();

  // Update user stats
  user.mintPassesRedeemed = user.mintPassesRedeemed.plus(BigInt.fromI32(1));
  user.generativeArtOwned = user.generativeArtOwned.plus(BigInt.fromI32(1));
  user.lastActiveBlock = event.block.number;
  user.save();

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.mintPassesRedeemed = protocol.mintPassesRedeemed.plus(BigInt.fromI32(1));
  protocol.totalGenerativeArt = protocol.totalGenerativeArt.plus(BigInt.fromI32(1));
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();

  // Update daily metrics
  let dailyMetric = getOrCreateDailyMetric(event.block.timestamp);
  dailyMetric.mintPassesRedeemed = dailyMetric.mintPassesRedeemed.plus(BigInt.fromI32(1));
  dailyMetric.generativeArtMinted = dailyMetric.generativeArtMinted.plus(BigInt.fromI32(1));
  dailyMetric.save();
}

export function handleTransfer(event: Transfer): void {
  // Only track transfers that aren't mints (from address is not zero)
  if (event.params.from.equals(ADDRESS_ZERO)) {
    return; // This is a mint, already handled by MintPassesMinted
  }

  // Only track transfers that aren't burns (to address is not zero)
  if (event.params.to.equals(ADDRESS_ZERO)) {
    return; // This is a burn
  }

  log.info("NFT Transfer: from={}, to={}, tokenId={}", [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.tokenId.toString()
  ]);

  let mintPassId = dataSource.address().toHexString() + "-" + event.params.tokenId.toString();
  let mintPass = MintPass.load(mintPassId);
  
  if (mintPass != null) {
    // Update mint pass owner
    let newOwner = getOrCreateUser(event.params.to);
    let oldOwner = getOrCreateUser(event.params.from);
    
    mintPass.owner = newOwner.id;
    mintPass.save();

    // Update user stats
    newOwner.mintPassesOwned = newOwner.mintPassesOwned.plus(BigInt.fromI32(1));
    newOwner.lastActiveBlock = event.block.number;
    newOwner.save();

    oldOwner.mintPassesOwned = oldOwner.mintPassesOwned.minus(BigInt.fromI32(1));
    oldOwner.save();
  }

  // Check if this is a generative art transfer
  let artId = dataSource.address().toHexString() + "-art-" + event.params.tokenId.toString();
  let art = GenerativeArt.load(artId);
  
  if (art != null) {
    // Update generative art owner
    let newOwner = getOrCreateUser(event.params.to);
    let oldOwner = getOrCreateUser(event.params.from);
    
    art.owner = newOwner.id;
    art.save();

    // Update user stats
    newOwner.generativeArtOwned = newOwner.generativeArtOwned.plus(BigInt.fromI32(1));
    newOwner.lastActiveBlock = event.block.number;
    newOwner.save();

    oldOwner.generativeArtOwned = oldOwner.generativeArtOwned.minus(BigInt.fromI32(1));
    oldOwner.save();
  }
}