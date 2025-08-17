/**
 * Game Constants for Barely Human Casino CLI
 * Bot personalities, bet types, and game configuration
 */

export const BOT_PERSONALITIES = [
  { id: 0, name: "Alice All-In", emoji: "🎯" },
  { id: 1, name: "Bob Calculator", emoji: "🧮" },
  { id: 2, name: "Charlie Lucky", emoji: "🍀" },
  { id: 3, name: "Diana Ice Queen", emoji: "❄️" },
  { id: 4, name: "Eddie Entertainer", emoji: "🎭" },
  { id: 5, name: "Fiona Fearless", emoji: "⚡" },
  { id: 6, name: "Greg Grinder", emoji: "💎" },
  { id: 7, name: "Helen Hot Streak", emoji: "🔥" },
  { id: 8, name: "Ivan Intimidator", emoji: "👹" },
  { id: 9, name: "Julia Jinx", emoji: "🌀" }
];

export const BET_TYPES = {
  0: "Pass Line",
  1: "Don't Pass",
  2: "Come",
  3: "Don't Come",
  4: "Field",
  5: "Big 6",
  6: "Big 8",
  7: "Place 4",
  8: "Place 5",
  9: "Place 6",
  10: "Place 8",
  11: "Place 9",
  12: "Place 10",
  13: "Buy 4",
  14: "Buy 5",
  15: "Buy 6",
  16: "Buy 8",
  17: "Buy 9",
  18: "Buy 10",
  19: "Lay 4",
  20: "Lay 5",
  21: "Lay 6",
  22: "Lay 8",
  23: "Lay 9",
  24: "Lay 10",
  25: "Hard 4",
  26: "Hard 6",
  27: "Hard 8",
  28: "Hard 10",
  29: "Any Seven",
  30: "Any Craps",
  31: "Ace Deuce",
  32: "Aces",
  33: "Boxcars",
  34: "Horn High 2",
  35: "Horn High 3",
  36: "Horn High 11",
  37: "Horn High 12",
  38: "World",
  39: "C&E",
  40: "Three Way Craps",
  41: "Hop 1-1",
  42: "Hop 2-2",
  43: "Hop 3-3",
  44: "Hop 4-4",
  45: "Hop 5-5",
  46: "Hop 6-6",
  47: "Hop 1-2",
  48: "Hop 1-3",
  49: "Hop 1-4",
  50: "Hop 1-5",
  51: "Hop 1-6",
  52: "Hop 2-3",
  53: "Hop 2-4",
  54: "Hop 2-5",
  55: "Hop 2-6",
  56: "Hop 3-4",
  57: "Hop 3-5",
  58: "Hop 3-6",
  59: "Hop 4-5",
  60: "Hop 4-6",
  61: "Hop 5-6",
  62: "Fire Bet",
  63: "Repeater Bet"
};

export const GAME_PHASES = {
  0: 'IDLE',
  1: 'COME_OUT', 
  2: 'POINT'
};

export const CLI_CONFIG = {
  MAX_BET_AMOUNT: "1000",
  MIN_BET_AMOUNT: "1",
  DEFAULT_FUNDING_AMOUNT: "10000",
  VAULT_DEPOSIT_AMOUNT: "1000"
};