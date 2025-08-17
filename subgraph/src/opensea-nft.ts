import { BigInt } from "@graphprotocol/graph-ts"
import {
  NFTListed,
  NFTSold
} from "../generated/OpenSeaNFT/OpenSeaNFT"
import { NFT, NFTListing, NFTSale, GlobalStats } from "../generated/schema"

export function handleNFTListed(event: NFTListed): void {
  let listingId = event.params.tokenId.toString() + "-" + event.block.timestamp.toString()
  let listing = new NFTListing(listingId)
  
  listing.nft = event.params.tokenId.toString()
  listing.seller = event.params.seller
  listing.price = event.params.price
  listing.currency = event.params.currency
  listing.isActive = true
  listing.isAuction = false
  listing.startTime = event.block.timestamp
  
  listing.save()
  
  // Create or update NFT if needed
  let nft = NFT.load(event.params.tokenId.toString())
  if (!nft) {
    nft = new NFT(event.params.tokenId.toString())
    nft.tokenId = event.params.tokenId
    nft.owner = event.params.seller
    nft.creator = event.params.seller
    nft.generatedAt = event.block.timestamp
    nft.vrfSeed = BigInt.fromI32(0)
    nft.rarity = BigInt.fromI32(0)
    nft.metadataURI = ""
    nft.gameId = BigInt.fromI32(0)
    nft.bot = "0" // Default to bot 0
    nft.save()
  }
}

export function handleNFTSold(event: NFTSold): void {
  let saleId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let sale = new NFTSale(saleId)
  
  sale.nft = event.params.tokenId.toString()
  sale.buyer = event.params.buyer
  sale.seller = event.params.seller
  sale.price = event.params.price
  sale.currency = event.params.currency
  sale.royaltyPaid = BigInt.fromI32(0) // Would need to calculate from contract
  sale.timestamp = event.block.timestamp
  sale.txHash = event.transaction.hash
  
  sale.save()
  
  // Update NFT owner
  let nft = NFT.load(event.params.tokenId.toString())
  if (nft) {
    nft.owner = event.params.buyer
    nft.save()
  }
  
  // Deactivate listing
  // Note: In production, we'd need to track which listing was used
  
  // Update global stats
  updateGlobalStatsNFT("SALE", event.params.price)
}

function updateGlobalStatsNFT(action: string, amount: BigInt): void {
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
  
  if (action == "SALE") {
    stats.totalNFTVolume = stats.totalNFTVolume.plus(amount)
  } else if (action == "MINT") {
    stats.totalNFTsMinted = stats.totalNFTsMinted.plus(BigInt.fromI32(1))
  }
  
  stats.save()
}