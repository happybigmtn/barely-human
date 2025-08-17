'use client';

import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { configureChains, createConfig } from 'wagmi';
import { hardhat, base, baseSepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { alchemyProvider } from 'wagmi/providers/alchemy';

// Configure chains & providers
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [
    hardhat,
    baseSepolia,
    base,
  ],
  [
    alchemyProvider({ 
      apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'demo' 
    }),
    publicProvider(),
  ]
);

// Configure wallet connectors
const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      metaMaskWallet({ projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!, chains }),
      coinbaseWallet({ appName: 'Barely Human Casino', chains }),
      walletConnectWallet({ projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!, chains }),
    ],
  },
  {
    groupName: 'More',
    wallets: [
      rainbowWallet({ projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!, chains }),
      trustWallet({ projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!, chains }),
    ],
  },
]);

// Create wagmi config
export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
});

export { chains };

// Contract ABIs (simplified versions)
export const CONTRACT_ABIS = {
  BOTToken: [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
  ],
  
  CrapsGame: [
    'function currentGameState() view returns (tuple(uint256 gameId, uint8 phase, uint8 point, uint256 totalBets, uint256 activePlayers, uint8[2] lastRoll, uint256 currentSeries))',
    'function placeBet(uint8 betType, uint256 amount) payable',
    'function rollDice() returns (uint256)',
    'function getBetInfo(uint8 betType) view returns (tuple(string name, uint256 minOdds, uint256 maxOdds, bool isActive))',
    'function getUserBets(address user) view returns (tuple(uint256 betId, uint8 betType, uint256 amount, uint256 odds, bool settled)[])',
    'event DiceRolled(uint256 indexed gameId, uint8 die1, uint8 die2, uint8 total)',
    'event BetPlaced(address indexed player, uint8 betType, uint256 amount, uint256 betId)',
    'event BetSettled(uint256 indexed betId, address indexed player, bool won, uint256 payout)',
  ],
  
  BotManager: [
    'function getBotPersonality(uint256 botId) view returns (tuple(string name, string nickname, uint8 strategy, bool isActive, uint256 totalGames, uint256 wins, uint256 losses))',
    'function getBotPerformance(uint256 botId) view returns (tuple(uint256 totalWagered, int256 netProfit, uint256 currentStreak, uint256 longestWinStreak, uint256 averageBet, uint256 lastActive))',
    'function getAllBotsPerformance() view returns (tuple(uint256 botId, uint256 totalGames, uint256 wins, uint256 losses, int256 netProfit, uint256 currentStreak)[])',
    'function triggerBotAction(uint256 botId) external',
    'event BotActionTriggered(uint256 indexed botId, uint8 action, uint256 amount)',
  ],
  
  CrapsVault: [
    'function totalAssets() view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
    'function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)',
    'function previewDeposit(uint256 assets) view returns (uint256 shares)',
    'function previewWithdraw(uint256 assets) view returns (uint256 shares)',
    'function asset() view returns (address)',
    'function getBotId() view returns (uint256)',
    'function getPerformanceMetrics() view returns (tuple(uint256 totalDeposits, uint256 totalWithdrawals, uint256 totalFees, uint256 sharePrice, uint256 apy))',
    'event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares)',
    'event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  ],
  
  VaultFactory: [
    'function getVault(uint256 botId) view returns (address)',
    'function getAllVaults() view returns (address[])',
    'function getTotalValueLocked() view returns (uint256)',
    'function getBotVaultInfo(uint256 botId) view returns (tuple(address vault, uint256 totalAssets, uint256 totalShares, uint256 sharePrice, uint256 apy))',
  ],
  
  StakingPool: [
    'function totalStaked() view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function earned(address account) view returns (uint256)',
    'function stake(uint256 amount) external',
    'function withdraw(uint256 amount) external',
    'function getReward() external',
    'function getCurrentEpoch() view returns (uint256)',
    'function getEpochInfo(uint256 epoch) view returns (tuple(uint256 startTime, uint256 endTime, uint256 rewardAmount, uint256 totalStaked))',
    'event Staked(address indexed user, uint256 amount)',
    'event Withdrawn(address indexed user, uint256 amount)',
    'event RewardPaid(address indexed user, uint256 reward)',
  ],
  
  GachaMintPass: [
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'function getRarity(uint256 tokenId) view returns (uint8)',
    'function isRedeemed(uint256 tokenId) view returns (bool)',
    'function redeemMintPass(uint256 tokenId) external',
    'function getMetadata(uint256 tokenId) view returns (tuple(string name, string description, string image, uint8 rarity, uint256 botId, bool redeemed))',
    'event MintPassAwarded(address indexed winner, uint256 tokenId, uint8 rarity, uint256 botId)',
    'event MintPassRedeemed(address indexed owner, uint256 tokenId, string artTokenURI)',
  ],
  
  BotBettingEscrow: [
    'function getCurrentRound() view returns (tuple(uint256 roundId, uint256 startTime, uint256 endTime, uint256 totalPool, bool active))',
    'function getUserBets(address user, uint256 roundId) view returns (tuple(uint256 botId, uint256 amount, uint256 timestamp)[])',
    'function getBotPool(uint256 botId, uint256 roundId) view returns (uint256)',
    'function placeBet(uint256 botId) payable external',
    'function claimWinnings(uint256 roundId) external',
    'function getWinnings(address user, uint256 roundId) view returns (uint256)',
    'event BetPlaced(address indexed user, uint256 indexed roundId, uint256 indexed botId, uint256 amount)',
    'event RoundSettled(uint256 indexed roundId, uint256 indexed winnerBotId, uint256 totalPool)',
    'event WinningsClaimed(address indexed user, uint256 indexed roundId, uint256 amount)',
  ],
} as const;