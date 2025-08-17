import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  GameStarted,
  DiceRolled,
  BetPlaced,
  BetSettled,
  PointEstablished
} from "../generated/CrapsGame/CrapsGame"
import { Game, DiceRoll, Bet, Player, Bot, GlobalStats } from "../generated/schema"

export function handleGameStarted(event: GameStarted): void {
  let game = new Game(event.params.gameId.toString())
  game.gameId = event.params.gameId
  game.timestamp = event.block.timestamp
  game.status = "ACTIVE"
  game.totalWagered = BigInt.fromI32(0)
  game.totalWon = BigInt.fromI32(0)
  game.netResult = BigInt.fromI32(0)
  
  // Get or create player
  let player = Player.load(event.params.player.toHexString())
  if (!player) {
    player = new Player(event.params.player.toHexString())
    player.address = event.params.player
    player.totalBets = BigInt.fromI32(0)
    player.totalWagered = BigInt.fromI32(0)
    player.totalWon = BigInt.fromI32(0)
    player.totalLost = BigInt.fromI32(0)
    player.winRate = BigInt.fromI32(0).toBigDecimal()
    player.rebatesClaimed = BigInt.fromI32(0)
    player.volumeGenerated = BigInt.fromI32(0)
  }
  
  game.player = player.id
  game.save()
  player.save()
  
  // Update global stats
  updateGlobalStats("GAME_STARTED", event.params.amount)
}

export function handleDiceRolled(event: DiceRolled): void {
  let rollId = event.params.gameId.toString() + "-" + event.block.timestamp.toString()
  let roll = new DiceRoll(rollId)
  
  roll.game = event.params.gameId.toString()
  roll.die1 = event.params.die1
  roll.die2 = event.params.die2
  roll.sum = event.params.die1 + event.params.die2
  roll.timestamp = event.block.timestamp
  roll.vrfRequestId = event.params.requestId
  
  roll.save()
}

export function handleBetPlaced(event: BetPlaced): void {
  let betId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let bet = new Bet(betId)
  
  bet.game = event.params.gameId.toString()
  bet.player = event.params.player.toHexString()
  bet.betType = getBetType(event.params.betType)
  bet.amount = event.params.amount
  bet.timestamp = event.block.timestamp
  bet.txHash = event.transaction.hash
  
  bet.save()
  
  // Update player stats
  let player = Player.load(event.params.player.toHexString())
  if (player) {
    player.totalBets = player.totalBets.plus(BigInt.fromI32(1))
    player.totalWagered = player.totalWagered.plus(event.params.amount)
    player.volumeGenerated = player.volumeGenerated.plus(event.params.amount)
    player.save()
  }
  
  // Update game stats
  let game = Game.load(event.params.gameId.toString())
  if (game) {
    game.totalWagered = game.totalWagered.plus(event.params.amount)
    game.save()
  }
}

export function handleBetSettled(event: BetSettled): void {
  let betId = event.params.betId.toString()
  let bet = Bet.load(betId)
  
  if (bet) {
    bet.won = event.params.won
    bet.payout = event.params.payout
    bet.save()
    
    // Update player stats
    let player = Player.load(bet.player)
    if (player) {
      if (event.params.won) {
        player.totalWon = player.totalWon.plus(event.params.payout)
      } else {
        player.totalLost = player.totalLost.plus(bet.amount)
      }
      
      // Calculate win rate
      if (player.totalBets.gt(BigInt.fromI32(0))) {
        let wins = player.totalWon.toBigDecimal()
        let total = player.totalBets.toBigDecimal()
        player.winRate = wins.div(total)
      }
      
      player.save()
    }
    
    // Update game stats
    let game = Game.load(bet.game)
    if (game) {
      if (event.params.won) {
        game.totalWon = game.totalWon.plus(event.params.payout)
      }
      game.netResult = game.totalWon.minus(game.totalWagered)
      game.save()
    }
  }
}

export function handlePointEstablished(event: PointEstablished): void {
  let game = Game.load(event.params.gameId.toString())
  if (game) {
    game.point = event.params.point
    game.save()
  }
}

function getBetType(typeId: BigInt): string {
  let betTypes = [
    "PASS", "DONT_PASS", "FIELD", "COME", "DONT_COME",
    "PLACE", "HARDWAYS", "ANY_SEVEN", "ANY_CRAPS", "HORN",
    "WORLD", "HOP", "BIG_6", "BIG_8", "YES", "NO", "NEXT", "BONUS"
  ]
  
  let index = typeId.toI32()
  if (index < betTypes.length) {
    return betTypes[index]
  }
  return "UNKNOWN"
}

function updateGlobalStats(action: string, amount: BigInt): void {
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
  
  if (action == "GAME_STARTED") {
    stats.totalGamesPlayed = stats.totalGamesPlayed.plus(BigInt.fromI32(1))
    stats.totalVolume = stats.totalVolume.plus(amount)
  }
  
  stats.save()
}