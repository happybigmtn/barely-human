/**
 * Uniswap V4 Contract Addresses on Base Sepolia (Chain ID: 84532)
 * Source: https://docs.uniswap.org/contracts/v4/deployments
 */

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const UNISWAP_V4_BASE_SEPOLIA = {
  // Core Contracts
  PoolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as const,
  
  // Router Contracts
  UniversalRouter: "0x492e6456d9528771018deb9e87ef7750ef184104" as const,
  
  // Position Management
  PositionManager: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80" as const,
  
  // View & Query Contracts
  StateView: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4" as const,
  Quoter: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba" as const,
  
  // Test Contracts (for testing only, not for production)
  PoolSwapTest: "0x8b5bcc363dde2614281ad875bad385e0a785d3b9" as const,
  PoolModifyLiquidityTest: "0x37429cd17cb1454c34e7f50b09725202fd533039" as const,
  
  // Permit2 (for token approvals)
  Permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const,
} as const;

// Hook addresses pattern for Uniswap V4
// Hooks must have specific address patterns to indicate which hooks they implement
// The address must have specific flags set in the address bits
export const HOOK_FLAGS = {
  BEFORE_INITIALIZE: 1 << 159,
  AFTER_INITIALIZE: 1 << 158,
  BEFORE_ADD_LIQUIDITY: 1 << 157,
  AFTER_ADD_LIQUIDITY: 1 << 156,
  BEFORE_REMOVE_LIQUIDITY: 1 << 155,
  AFTER_REMOVE_LIQUIDITY: 1 << 154,
  BEFORE_SWAP: 1 << 153,
  AFTER_SWAP: 1 << 152,
  BEFORE_DONATE: 1 << 151,
  AFTER_DONATE: 1 << 150,
  BEFORE_SWAP_RETURN_DELTA: 1 << 149,
  AFTER_SWAP_RETURN_DELTA: 1 << 148,
  AFTER_ADD_LIQUIDITY_RETURN_DELTA: 1 << 147,
  AFTER_REMOVE_LIQUIDITY_RETURN_DELTA: 1 << 146,
} as const;

// ABI snippets for common interactions
export const POOL_MANAGER_ABI = [
  {
    name: "initialize",
    type: "function",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" }
        ]
      },
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "hookData", type: "bytes" }
    ],
    outputs: [{ name: "tick", type: "int24" }]
  },
  {
    name: "swap",
    type: "function",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" }
        ]
      },
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "zeroForOne", type: "bool" },
          { name: "amountSpecified", type: "int256" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ]
      },
      { name: "hookData", type: "bytes" }
    ],
    outputs: [{ name: "delta", type: "int256" }]
  },
  {
    name: "take",
    type: "function",
    inputs: [
      { name: "currency", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "settle",
    type: "function",
    inputs: [{ name: "currency", type: "address" }],
    outputs: [{ name: "paid", type: "uint256" }]
  },
  {
    name: "mint",
    type: "function",
    inputs: [
      { name: "currency", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  }
] as const;

// Helper function to calculate hook address with required flags
export function calculateHookAddress(
  deployer: string,
  nonce: number,
  requiredFlags: number[]
): string {
  // This is a simplified version - in production you'd use CREATE2
  // to ensure the deployed address has the correct flags
  let flags = 0;
  for (const flag of requiredFlags) {
    flags |= flag;
  }
  
  // The actual address calculation would involve CREATE2
  // This is just a placeholder
  return "0x" + flags.toString(16).padStart(40, "0");
}

// Fee tiers available in Uniswap V4
export const FEE_TIERS = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 3000,   // 0.30%
  HIGH: 10000,    // 1.00%
} as const;

// Tick spacings for different fee tiers
export const TICK_SPACINGS = {
  [FEE_TIERS.LOWEST]: 1,
  [FEE_TIERS.LOW]: 10,
  [FEE_TIERS.MEDIUM]: 60,
  [FEE_TIERS.HIGH]: 200,
} as const;

// Export types for TypeScript
export type PoolKey = {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
};

export type SwapParams = {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
};

// Base Sepolia network configuration
export const BASE_SEPOLIA_CONFIG = {
  chainId: BASE_SEPOLIA_CHAIN_ID,
  name: "Base Sepolia",
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  blockExplorer: "https://sepolia.basescan.org",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
} as const;