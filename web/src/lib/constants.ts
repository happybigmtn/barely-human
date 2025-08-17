import { BotPersonality, BotStrategy, ContractAddresses } from '@/types/contracts';

// Bot Personalities with unique themes
export const BOT_PERSONALITIES: BotPersonality[] = [
  {
    id: 0,
    name: 'Alice',
    nickname: 'All-In',
    emoji: '🎯',
    description: 'The aggressive high-roller who believes fortune favors the bold',
    traits: ['Aggressive', 'Confident', 'Risk-taker', 'Decisive'],
    color: '#ff073a', // Neon red
    strategy: BotStrategy.AGGRESSIVE,
    riskProfile: 'aggressive',
  },
  {
    id: 1,
    name: 'Bob',
    nickname: 'The Calculator',
    emoji: '🧮',
    description: 'Statistical mastermind who turns probability into profit',
    traits: ['Analytical', 'Precise', 'Mathematical', 'Patient'],
    color: '#00bfff', // Neon blue
    strategy: BotStrategy.CONSERVATIVE,
    riskProfile: 'conservative',
  },
  {
    id: 2,
    name: 'Charlie',
    nickname: 'Lucky Charm',
    emoji: '🍀',
    description: 'Superstitious believer in signs, omens, and lucky streaks',
    traits: ['Superstitious', 'Optimistic', 'Intuitive', 'Mystical'],
    color: '#39ff14', // Neon green
    strategy: BotStrategy.RANDOM,
    riskProfile: 'moderate',
  },
  {
    id: 3,
    name: 'Diana',
    nickname: 'Ice Queen',
    emoji: '❄️',
    description: 'Cold and calculating, emotion is weakness in her world',
    traits: ['Emotionless', 'Logical', 'Ruthless', 'Disciplined'],
    color: '#00ffff', // Neon cyan
    strategy: BotStrategy.OSCAR_GRIND,
    riskProfile: 'conservative',
  },
  {
    id: 4,
    name: 'Eddie',
    nickname: 'The Entertainer',
    emoji: '🎭',
    description: 'Theatrical showman who makes every game a performance',
    traits: ['Charismatic', 'Dramatic', 'Entertaining', 'Bold'],
    color: '#bf00ff', // Neon purple
    strategy: BotStrategy.PAROLI,
    riskProfile: 'moderate',
  },
  {
    id: 5,
    name: 'Fiona',
    nickname: 'Fearless',
    emoji: '⚡',
    description: 'Adrenaline junkie who lives for the thrill of high stakes',
    traits: ['Fearless', 'Thrill-seeker', 'Impulsive', 'Energetic'],
    color: '#ffff00', // Neon yellow
    strategy: BotStrategy.MARTINGALE,
    riskProfile: 'aggressive',
  },
  {
    id: 6,
    name: 'Greg',
    nickname: 'The Grinder',
    emoji: '💎',
    description: 'Patient strategist who believes slow and steady wins the race',
    traits: ['Patient', 'Persistent', 'Methodical', 'Reliable'],
    color: '#ff8c00', // Neon orange
    strategy: BotStrategy.FIBONACCI,
    riskProfile: 'conservative',
  },
  {
    id: 7,
    name: 'Helen',
    nickname: 'Hot Streak',
    emoji: '🔥',
    description: 'Momentum player who rides winning streaks to victory',
    traits: ['Momentum-driven', 'Optimistic', 'Streaky', 'Intuitive'],
    color: '#ff1493', // Neon pink
    strategy: BotStrategy.ADAPTIVE,
    riskProfile: 'moderate',
  },
  {
    id: 8,
    name: 'Ivan',
    nickname: 'The Intimidator',
    emoji: '👹',
    description: 'Psychological warfare expert who wins through mind games',
    traits: ['Intimidating', 'Strategic', 'Psychological', 'Cunning'],
    color: '#8b0000', // Dark red
    strategy: BotStrategy.DALEMBERT,
    riskProfile: 'aggressive',
  },
  {
    id: 9,
    name: 'Julia',
    nickname: 'Jinx',
    emoji: '🌀',
    description: 'Chaos controller who claims to bend luck to her will',
    traits: ['Unpredictable', 'Mystical', 'Chaotic', 'Mysterious'],
    color: '#9400d3', // Dark violet
    strategy: BotStrategy.MIXED,
    riskProfile: 'moderate',
  },
];

// Craps Bet Types (All 64 types)
export const BET_TYPES = [
  // Line Bets (0-3)
  { id: 0, name: 'Pass Line', category: 'line', houseEdge: 1.36 },
  { id: 1, name: "Don't Pass", category: 'line', houseEdge: 1.36 },
  { id: 2, name: 'Come', category: 'line', houseEdge: 1.36 },
  { id: 3, name: "Don't Come", category: 'line', houseEdge: 1.36 },
  
  // Field Bet (4)
  { id: 4, name: 'Field', category: 'field', houseEdge: 2.78 },
  
  // YES/NO Bets (5-24)
  { id: 5, name: 'Big 6', category: 'proposition', houseEdge: 9.09 },
  { id: 6, name: 'Big 8', category: 'proposition', houseEdge: 9.09 },
  { id: 7, name: 'Hard 4', category: 'hardway', houseEdge: 11.11 },
  { id: 8, name: 'Hard 6', category: 'hardway', houseEdge: 9.09 },
  { id: 9, name: 'Hard 8', category: 'hardway', houseEdge: 9.09 },
  { id: 10, name: 'Hard 10', category: 'hardway', houseEdge: 11.11 },
  
  // More bet types...
  { id: 11, name: 'Any 7', category: 'proposition', houseEdge: 16.67 },
  { id: 12, name: 'Any Craps', category: 'proposition', houseEdge: 11.11 },
  { id: 13, name: 'Ace Deuce', category: 'proposition', houseEdge: 11.11 },
  { id: 14, name: 'Aces', category: 'proposition', houseEdge: 13.89 },
  { id: 15, name: 'Boxcars', category: 'proposition', houseEdge: 13.89 },
];

// Network Configuration
export const NETWORKS = {
  hardhat: {
    id: 31337,
    name: 'Hardhat Local',
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorer: 'http://localhost:3000',
  },
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
  },
  base: {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
  },
};

// Contract Addresses (will be populated from deployment)
export const CONTRACT_ADDRESSES: Partial<ContractAddresses> = {
  // These will be filled in during deployment or from environment variables
};

// Token Configuration
export const TOKEN_CONFIG = {
  BOT: {
    symbol: 'BOT',
    decimals: 18,
    name: 'Barely Human Token',
  },
};

// Game Configuration
export const GAME_CONFIG = {
  MIN_BET: BigInt('1000000000000000000'), // 1 BOT
  MAX_BET: BigInt('10000000000000000000000'), // 10,000 BOT
  BOT_BASE_BET: BigInt('100000000000000000000'), // 100 BOT
  
  ROLL_DELAY: 3000, // 3 seconds
  ANIMATION_DURATION: 600, // 0.6 seconds
  
  HOUSE_EDGES: {
    PASS_LINE: 1.36,
    FIELD: 2.78,
    ANY_SEVEN: 16.67,
    HARDWAYS: 9.09,
  },
};

// UI Configuration
export const UI_CONFIG = {
  ANIMATIONS: {
    DICE_ROLL: 600,
    CARD_FLIP: 300,
    GLOW_PULSE: 2000,
    TYPING_SPEED: 50,
  },
  
  COLORS: {
    NEON_RED: '#ff073a',
    NEON_GREEN: '#39ff14',
    NEON_BLUE: '#00bfff',
    NEON_PURPLE: '#bf00ff',
    NEON_YELLOW: '#ffff00',
    NEON_PINK: '#ff1493',
    NEON_CYAN: '#00ffff',
    NEON_ORANGE: '#ff8c00',
    CASINO_DARK: '#0a0a0a',
    CASINO_DARKER: '#050505',
  },
  
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    '2XL': 1536,
  },
};

// Leaderboard Metrics
export const LEADERBOARD_METRICS = [
  { key: 'winRate', label: 'Win Rate', format: 'percentage' },
  { key: 'totalProfit', label: 'Total Profit', format: 'currency' },
  { key: 'roi', label: 'ROI', format: 'percentage' },
  { key: 'gamesPlayed', label: 'Games Played', format: 'number' },
  { key: 'currentStreak', label: 'Current Streak', format: 'number' },
  { key: 'biggestWin', label: 'Biggest Win', format: 'currency' },
];

// NFT Rarities
export const NFT_RARITIES = {
  common: { weight: 60, color: '#9ca3af', glow: '#d1d5db' },
  rare: { weight: 25, color: '#3b82f6', glow: '#60a5fa' },
  epic: { weight: 12, color: '#a855f7', glow: '#c084fc' },
  legendary: { weight: 3, color: '#f59e0b', glow: '#fbbf24' },
};

// Chat Configuration
export const CHAT_CONFIG = {
  MAX_MESSAGES: 100,
  TYPING_DELAY: 1000,
  MESSAGE_FADE_TIME: 10000,
  
  PERSONALITY_PROMPTS: {
    [BotStrategy.AGGRESSIVE]: "You're a bold, confident gambler who takes big risks.",
    [BotStrategy.CONSERVATIVE]: "You're analytical and careful, preferring calculated moves.",
    [BotStrategy.RANDOM]: "You're unpredictable and believe in following your instincts.",
    // Add more prompts for each strategy
  },
};

// API Endpoints
export const API_ENDPOINTS = {
  GAME_STATE: '/api/game/state',
  BOT_PERFORMANCE: '/api/bots/performance',
  VAULT_DATA: '/api/vaults/data',
  LEADERBOARD: '/api/leaderboard',
  CHAT: '/api/chat',
  NFT_METADATA: '/api/nft/metadata',
};