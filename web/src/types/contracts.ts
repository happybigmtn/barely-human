import { Address } from 'viem';

// Bot Personalities
export interface BotPersonality {
  id: number;
  name: string;
  nickname: string;
  emoji: string;
  description: string;
  traits: string[];
  color: string;
  strategy: BotStrategy;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
}

export enum BotStrategy {
  CONSERVATIVE = 0,
  AGGRESSIVE = 1,
  MARTINGALE = 2,
  FIBONACCI = 3,
  PAROLI = 4,
  DALEMBERT = 5,
  OSCAR_GRIND = 6,
  RANDOM = 7,
  ADAPTIVE = 8,
  MIXED = 9,
}

// Game Types
export interface GameState {
  gameId: bigint;
  phase: GamePhase;
  point: number;
  totalBets: bigint;
  activePlayers: number;
  lastRoll: [number, number];
  currentSeries: bigint;
}

export enum GamePhase {
  IDLE = 0,
  COME_OUT = 1,
  POINT = 2,
}

export interface BetType {
  id: number;
  name: string;
  description: string;
  minOdds: number;
  maxOdds: number;
  category: 'line' | 'field' | 'hardway' | 'proposition' | 'bonus';
}

export interface PlacedBet {
  betId: bigint;
  player: Address;
  betType: number;
  amount: bigint;
  odds: number;
  timestamp: bigint;
  settled: boolean;
}

// Vault Types
export interface VaultInfo {
  address: Address;
  botId: number;
  totalAssets: bigint;
  totalShares: bigint;
  sharePrice: bigint;
  performance24h: number;
  performance7d: number;
  performance30d: number;
  totalDepositors: number;
  apy: number;
}

export interface UserPosition {
  vault: Address;
  shares: bigint;
  assets: bigint;
  depositTime: bigint;
  earnings: bigint;
  earningsPercent: number;
}

// Staking Types
export interface StakingInfo {
  totalStaked: bigint;
  userStaked: bigint;
  userRewards: bigint;
  apy: number;
  nextEpoch: bigint;
  currentEpoch: bigint;
}

// NFT Types
export interface NFTMintPass {
  tokenId: bigint;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  botId: number;
  metadata: NFTMetadata;
  redeemed: boolean;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

// Bot Performance
export interface BotPerformance {
  botId: number;
  totalGames: bigint;
  wins: bigint;
  losses: bigint;
  winRate: number;
  totalWagered: bigint;
  netProfit: bigint;
  roi: number;
  currentStreak: number;
  longestWinStreak: number;
  averageBet: bigint;
  biggestWin: bigint;
  biggestLoss: bigint;
  lastActive: bigint;
  favoriteStrategy: BotStrategy;
}

// Market Data
export interface TokenPrice {
  usd: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

export interface LiquidityPool {
  address: Address;
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  fee: number;
}

// Chat & AI
export interface ChatMessage {
  id: string;
  botId: number;
  message: string;
  timestamp: number;
  type: 'bot' | 'user' | 'system';
  context?: {
    gameState?: Partial<GameState>;
    recentBets?: PlacedBet[];
    performance?: Partial<BotPerformance>;
  };
}

export interface BotChatState {
  botId: number;
  isTyping: boolean;
  lastMessage: string;
  mood: 'happy' | 'frustrated' | 'excited' | 'focused' | 'concerned';
  energy: number; // 0-100
}

// Contract Addresses
export interface ContractAddresses {
  botToken: Address;
  crapsGame: Address;
  botManager: Address;
  vaultFactory: Address;
  stakingPool: Address;
  treasury: Address;
  gachaMintPass: Address;
  botBettingEscrow: Address;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

// Events
export interface GameEvent {
  type: 'roll' | 'bet_placed' | 'bet_settled' | 'series_started' | 'series_ended';
  data: any;
  timestamp: number;
  blockNumber: bigint;
  transactionHash: string;
}

export interface BotEvent {
  botId: number;
  type: 'strategy_change' | 'big_win' | 'big_loss' | 'streak_started' | 'streak_ended';
  data: any;
  timestamp: number;
}

// Leaderboard
export interface LeaderboardEntry {
  rank: number;
  botId: number;
  metric: 'winRate' | 'totalProfit' | 'roi' | 'gamesPlayed';
  value: number | bigint;
  change: number; // Position change from last period
}

// Tournament/Competition
export interface Tournament {
  id: bigint;
  name: string;
  startTime: bigint;
  endTime: bigint;
  participants: number[];
  prizePool: bigint;
  status: 'upcoming' | 'active' | 'completed';
  rules: {
    maxGames: number;
    entryFee: bigint;
    metric: 'winRate' | 'totalProfit' | 'roi';
  };
}