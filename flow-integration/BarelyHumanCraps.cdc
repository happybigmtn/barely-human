// BarelyHumanCraps.cdc
// Flow smart contract for Barely Human DeFi Casino Craps Game
// Integrates with the main Base network contracts for cross-chain gameplay

access(all) contract BarelyHumanCraps {
    
    // Events
    access(all) event GamePlaced(gameId: UInt64, player: Address, betAmount: UFix64, betType: String)
    access(all) event GameResolved(gameId: UInt64, player: Address, result: String, payout: UFix64)
    access(all) event BotGamePlaced(gameId: UInt64, botId: UInt8, betAmount: UFix64, personality: String)
    
    // Game state
    access(all) var nextGameId: UInt64
    access(all) var totalGamesPlayed: UInt64
    access(all) var totalVolume: UFix64
    
    // Game storage
    access(all) let games: {UInt64: GameRecord}
    
    // Bot personalities (matching main contract)
    access(all) let botPersonalities: {UInt8: String}
    
    // Game record structure
    access(all) struct GameRecord {
        access(all) let gameId: UInt64
        access(all) let player: Address
        access(all) let betAmount: UFix64
        access(all) let betType: String
        access(all) let dice1: UInt8
        access(all) let dice2: UInt8
        access(all) let result: String
        access(all) let payout: UFix64
        access(all) let timestamp: UFix64
        access(all) let isBot: Bool
        access(all) let botPersonality: String?
        
        init(
            gameId: UInt64,
            player: Address,
            betAmount: UFix64,
            betType: String,
            dice1: UInt8,
            dice2: UInt8,
            result: String,
            payout: UFix64,
            isBot: Bool,
            botPersonality: String?
        ) {
            self.gameId = gameId
            self.player = player
            self.betAmount = betAmount
            self.betType = betType
            self.dice1 = dice1
            self.dice2 = dice2
            self.result = result
            self.payout = payout
            self.timestamp = getCurrentBlock().timestamp
            self.isBot = isBot
            self.botPersonality = botPersonality
        }
    }
    
    // Cross-chain bridge event for Base network synchronization
    access(all) event CrossChainGameSync(
        gameId: UInt64,
        baseNetworkTxHash: String,
        player: Address,
        result: String
    )
    
    init() {
        self.nextGameId = 1
        self.totalGamesPlayed = 0
        self.totalVolume = 0.0
        self.games = {}
        
        // Initialize bot personalities (matching main Base contract)
        self.botPersonalities = {
            0: "Alice All-In",
            1: "Bob Calculator", 
            2: "Charlie Lucky",
            3: "Diana Ice Queen",
            4: "Eddie Entertainer",
            5: "Fiona Fearless",
            6: "Greg Grinder",
            7: "Helen Hot Streak",
            8: "Ivan Intimidator",
            9: "Julia Jinx"
        }
    }
    
    // Simulate a craps game with deterministic outcome
    access(all) fun simulateGame(
        player: Address,
        betAmount: UFix64,
        betType: String,
        seed: UInt64
    ): GameRecord {
        
        // Simple deterministic dice roll based on seed
        let dice1 = UInt8((seed % 6) + 1)
        let dice2 = UInt8(((seed / 6) % 6) + 1)
        let total = dice1 + dice2
        
        // Basic craps rules for come out roll
        var result = ""
        var payout = 0.0
        
        if betType == "PASS_LINE" {
            if total == 7 || total == 11 {
                result = "WIN"
                payout = betAmount * 2.0 // 1:1 payout
            } else if total == 2 || total == 3 || total == 12 {
                result = "LOSE"
                payout = 0.0
            } else {
                result = "POINT_SET"
                payout = betAmount // Return bet, point phase begins
            }
        } else if betType == "DONT_PASS" {
            if total == 2 || total == 3 {
                result = "WIN"
                payout = betAmount * 2.0
            } else if total == 7 || total == 11 {
                result = "LOSE"
                payout = 0.0
            } else if total == 12 {
                result = "PUSH"
                payout = betAmount // Return bet
            } else {
                result = "POINT_SET"
                payout = betAmount
            }
        } else {
            // Default to pass line
            result = "UNKNOWN_BET"
            payout = betAmount
        }
        
        let gameId = self.nextGameId
        self.nextGameId = gameId + 1
        
        let gameRecord = GameRecord(
            gameId: gameId,
            player: player,
            betAmount: betAmount,
            betType: betType,
            dice1: dice1,
            dice2: dice2,
            result: result,
            payout: payout,
            isBot: false,
            botPersonality: nil
        )
        
        self.games[gameId] = gameRecord
        self.totalGamesPlayed = self.totalGamesPlayed + 1
        self.totalVolume = self.totalVolume + betAmount
        
        emit GamePlaced(gameId: gameId, player: player, betAmount: betAmount, betType: betType)
        emit GameResolved(gameId: gameId, player: player, result: result, payout: payout)
        
        return gameRecord
    }
    
    // Bot game simulation
    access(all) fun simulateBotGame(
        botId: UInt8,
        betAmount: UFix64,
        seed: UInt64
    ): GameRecord {
        
        let personality = self.botPersonalities[botId] ?? "Unknown Bot"
        
        // Bot-specific betting patterns
        var betType = "PASS_LINE"
        if botId == 1 { // Bob Calculator prefers Don't Pass
            betType = "DONT_PASS"
        }
        
        let dice1 = UInt8((seed % 6) + 1)
        let dice2 = UInt8(((seed / 6) % 6) + 1)
        let total = dice1 + dice2
        
        var result = ""
        var payout = 0.0
        
        if betType == "PASS_LINE" {
            if total == 7 || total == 11 {
                result = "WIN"
                payout = betAmount * 2.0
            } else if total == 2 || total == 3 || total == 12 {
                result = "LOSE"
                payout = 0.0
            } else {
                result = "POINT_SET"
                payout = betAmount
            }
        } else if betType == "DONT_PASS" {
            if total == 2 || total == 3 {
                result = "WIN"
                payout = betAmount * 2.0
            } else if total == 7 || total == 11 {
                result = "LOSE"
                payout = 0.0
            } else {
                result = "PUSH"
                payout = betAmount
            }
        }
        
        let gameId = self.nextGameId
        self.nextGameId = gameId + 1
        
        let gameRecord = GameRecord(
            gameId: gameId,
            player: 0x0000000000000000, // Bot address placeholder
            betAmount: betAmount,
            betType: betType,
            dice1: dice1,
            dice2: dice2,
            result: result,
            payout: payout,
            isBot: true,
            botPersonality: personality
        )
        
        self.games[gameId] = gameRecord
        self.totalGamesPlayed = self.totalGamesPlayed + 1
        self.totalVolume = self.totalVolume + betAmount
        
        emit BotGamePlaced(gameId: gameId, botId: botId, betAmount: betAmount, personality: personality)
        emit GameResolved(gameId: gameId, player: 0x0000000000000000, result: result, payout: payout)
        
        return gameRecord
    }
    
    // Get game by ID
    access(all) view fun getGame(gameId: UInt64): GameRecord? {
        return self.games[gameId]
    }
    
    // Get recent games
    access(all) view fun getRecentGames(limit: Int): [GameRecord] {
        var recentGames: [GameRecord] = []
        var count = 0
        var currentId = self.nextGameId
        
        while count < limit && currentId > 1 {
            currentId = currentId - 1
            if let game = self.games[currentId] {
                recentGames.append(game)
                count = count + 1
            }
        }
        
        return recentGames
    }
    
    // Get statistics
    access(all) view fun getGameStats(): {String: AnyStruct} {
        return {
            "totalGames": self.totalGamesPlayed,
            "totalVolume": self.totalVolume,
            "nextGameId": self.nextGameId,
            "activeBots": UInt8(self.botPersonalities.length)
        }
    }
    
    // Cross-chain sync function for Base network integration
    access(all) fun syncWithBaseNetwork(
        gameId: UInt64,
        baseNetworkTxHash: String,
        player: Address,
        result: String
    ) {
        emit CrossChainGameSync(
            gameId: gameId,
            baseNetworkTxHash: baseNetworkTxHash,
            player: player,
            result: result
        )
    }
    
    // Get bot personalities
    access(all) view fun getBotPersonalities(): {UInt8: String} {
        return self.botPersonalities
    }
}