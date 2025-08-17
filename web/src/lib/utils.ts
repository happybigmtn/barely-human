import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits, parseUnits } from 'viem';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format large numbers with appropriate suffixes
export function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
}

// Format bigint token amounts
export function formatTokenAmount(amount: bigint, decimals: number = 18, precision: number = 4): string {
  const formatted = formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  
  if (num === 0) return '0';
  if (num < 0.0001) return '<0.0001';
  if (num >= 1e6) return formatNumber(num);
  
  return num.toFixed(precision);
}

// Format percentage with proper styling
export function formatPercentage(value: number, precision: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(precision)}%`;
}

// Format USD currency
export function formatCurrency(amount: number, precision: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(amount);
}

// Format time ago
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// Generate random ID
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Truncate address
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Calculate win rate
export function calculateWinRate(wins: bigint, losses: bigint): number {
  const total = wins + losses;
  if (total === BigInt(0)) return 0;
  return (Number(wins) / Number(total)) * 100;
}

// Calculate ROI
export function calculateROI(profit: bigint, invested: bigint): number {
  if (invested === BigInt(0)) return 0;
  return (Number(profit) / Number(invested)) * 100;
}

// Validate bet amount
export function validateBetAmount(amount: string, min: bigint, max: bigint, balance: bigint): {
  isValid: boolean;
  error?: string;
} {
  try {
    const parsedAmount = parseUnits(amount, 18);
    
    if (parsedAmount <= BigInt(0)) {
      return { isValid: false, error: 'Amount must be greater than 0' };
    }
    
    if (parsedAmount < min) {
      return { isValid: false, error: `Minimum bet is ${formatTokenAmount(min)} BOT` };
    }
    
    if (parsedAmount > max) {
      return { isValid: false, error: `Maximum bet is ${formatTokenAmount(max)} BOT` };
    }
    
    if (parsedAmount > balance) {
      return { isValid: false, error: 'Insufficient balance' };
    }
    
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid amount' };
  }
}

// Get bot color by ID
export function getBotColor(botId: number): string {
  const colors = [
    '#ff073a', '#00bfff', '#39ff14', '#00ffff', '#bf00ff',
    '#ffff00', '#ff8c00', '#ff1493', '#8b0000', '#9400d3'
  ];
  return colors[botId] || '#ffffff';
}

// Get bot emoji by ID
export function getBotEmoji(botId: number): string {
  const emojis = ['🎯', '🧮', '🍀', '❄️', '🎭', '⚡', '💎', '🔥', '👹', '🌀'];
  return emojis[botId] || '🤖';
}

// Calculate APY from performance
export function calculateAPY(performance30d: number): number {
  // Annualize the 30-day performance
  return (performance30d / 30) * 365;
}

// Format duration from seconds
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Check if number is positive
export function isPositive(value: number | bigint): boolean {
  if (typeof value === 'bigint') {
    return value > BigInt(0);
  }
  return value > 0;
}

// Get text color for performance
export function getPerformanceColor(value: number): string {
  if (value > 0) return 'text-neon-green';
  if (value < 0) return 'text-neon-red';
  return 'text-gray-400';
}

// Format bet type name
export function formatBetTypeName(betType: number): string {
  const betNames = [
    'Pass Line', "Don't Pass", 'Come', "Don't Come", 'Field',
    'Big 6', 'Big 8', 'Hard 4', 'Hard 6', 'Hard 8', 'Hard 10',
    'Any 7', 'Any Craps', 'Ace Deuce', 'Aces', 'Boxcars'
    // Add more bet types as needed
  ];
  return betNames[betType] || `Bet #${betType}`;
}

// Calculate house edge display
export function getHouseEdgeColor(houseEdge: number): string {
  if (houseEdge <= 2) return 'text-neon-green';
  if (houseEdge <= 5) return 'text-neon-yellow';
  if (houseEdge <= 10) return 'text-neon-orange';
  return 'text-neon-red';
}

// Debounce function for search/input
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Generate gradient for bot cards
export function generateBotGradient(botId: number): string {
  const color = getBotColor(botId);
  return `linear-gradient(135deg, ${color}20 0%, ${color}10 50%, transparent 100%)`;
}

// Format streak display
export function formatStreak(streak: number, isWinning: boolean = true): string {
  const type = isWinning ? 'W' : 'L';
  return `${streak}${type}`;
}

// Get rarity color
export function getRarityColor(rarity: string): string {
  switch (rarity.toLowerCase()) {
    case 'common':
      return '#9ca3af';
    case 'rare':
      return '#3b82f6';
    case 'epic':
      return '#a855f7';
    case 'legendary':
      return '#f59e0b';
    default:
      return '#ffffff';
  }
}

// Format block explorer URL
export function getBlockExplorerUrl(hash: string, chainId: number): string {
  switch (chainId) {
    case 8453: // Base
      return `https://basescan.org/tx/${hash}`;
    case 84532: // Base Sepolia
      return `https://sepolia.basescan.org/tx/${hash}`;
    case 31337: // Hardhat
      return `#${hash}`;
    default:
      return `#${hash}`;
  }
}