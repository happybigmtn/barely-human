import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { VaultInfo, UserPosition, TokenPrice, StakingInfo } from '@/types/contracts';
import { Address } from 'viem';

interface VaultStore {
  // Vault Data
  vaults: Record<number, VaultInfo>; // botId -> VaultInfo
  userPositions: UserPosition[];
  stakingInfo: StakingInfo | null;
  
  // Token Data
  botTokenPrice: TokenPrice | null;
  totalValueLocked: bigint;
  
  // UI State
  selectedVault: number | null;
  isDepositing: boolean;
  isWithdrawing: boolean;
  isStaking: boolean;
  
  // Transaction States
  pendingTransactions: Set<string>;
  lastTransactionHash: string | null;
  
  // Actions
  setVaults: (vaults: Record<number, VaultInfo>) => void;
  updateVault: (botId: number, vault: VaultInfo) => void;
  
  setUserPositions: (positions: UserPosition[]) => void;
  updateUserPosition: (vaultAddress: Address, position: Partial<UserPosition>) => void;
  
  setStakingInfo: (info: StakingInfo) => void;
  setBotTokenPrice: (price: TokenPrice) => void;
  setTotalValueLocked: (tvl: bigint) => void;
  
  setSelectedVault: (botId: number | null) => void;
  setDepositing: (depositing: boolean) => void;
  setWithdrawing: (withdrawing: boolean) => void;
  setStaking: (staking: boolean) => void;
  
  addPendingTransaction: (hash: string) => void;
  removePendingTransaction: (hash: string) => void;
  setLastTransactionHash: (hash: string) => void;
  
  // Computed/Derived State
  getVaultByBotId: (botId: number) => VaultInfo | undefined;
  getUserPositionByVault: (vaultAddress: Address) => UserPosition | undefined;
  getTotalUserValue: () => bigint;
  getTotalUserEarnings: () => bigint;
  getBestPerformingVault: () => VaultInfo | null;
  getWorstPerformingVault: () => VaultInfo | null;
  getUserPortfolioAllocation: () => Array<{ botId: number; percentage: number; value: bigint }>;
}

export const useVaultStore = create<VaultStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    vaults: {},
    userPositions: [],
    stakingInfo: null,
    
    botTokenPrice: null,
    totalValueLocked: BigInt(0),
    
    selectedVault: null,
    isDepositing: false,
    isWithdrawing: false,
    isStaking: false,
    
    pendingTransactions: new Set(),
    lastTransactionHash: null,
    
    // Actions
    setVaults: (vaults) => set({ vaults }),
    
    updateVault: (botId, vault) => set((state) => ({
      vaults: {
        ...state.vaults,
        [botId]: vault,
      },
    })),
    
    setUserPositions: (positions) => set({ userPositions: positions }),
    
    updateUserPosition: (vaultAddress, positionUpdate) => set((state) => {
      const positions = state.userPositions.map(pos =>
        pos.vault === vaultAddress
          ? { ...pos, ...positionUpdate }
          : pos
      );
      return { userPositions: positions };
    }),
    
    setStakingInfo: (info) => set({ stakingInfo: info }),
    
    setBotTokenPrice: (price) => set({ botTokenPrice: price }),
    
    setTotalValueLocked: (tvl) => set({ totalValueLocked: tvl }),
    
    setSelectedVault: (botId) => set({ selectedVault: botId }),
    
    setDepositing: (depositing) => set({ isDepositing: depositing }),
    
    setWithdrawing: (withdrawing) => set({ isWithdrawing: withdrawing }),
    
    setStaking: (staking) => set({ isStaking: staking }),
    
    addPendingTransaction: (hash) => set((state) => ({
      pendingTransactions: new Set(state.pendingTransactions).add(hash),
    })),
    
    removePendingTransaction: (hash) => set((state) => {
      const newSet = new Set(state.pendingTransactions);
      newSet.delete(hash);
      return { pendingTransactions: newSet };
    }),
    
    setLastTransactionHash: (hash) => set({ lastTransactionHash: hash }),
    
    // Computed/Derived State
    getVaultByBotId: (botId) => {
      const { vaults } = get();
      return vaults[botId];
    },
    
    getUserPositionByVault: (vaultAddress) => {
      const { userPositions } = get();
      return userPositions.find(pos => pos.vault === vaultAddress);
    },
    
    getTotalUserValue: () => {
      const { userPositions } = get();
      return userPositions.reduce((total, pos) => total + pos.assets, BigInt(0));
    },
    
    getTotalUserEarnings: () => {
      const { userPositions } = get();
      return userPositions.reduce((total, pos) => total + pos.earnings, BigInt(0));
    },
    
    getBestPerformingVault: () => {
      const { vaults } = get();
      const vaultList = Object.values(vaults);
      
      if (vaultList.length === 0) return null;
      
      return vaultList.reduce((best, current) =>
        current.performance24h > best.performance24h ? current : best
      );
    },
    
    getWorstPerformingVault: () => {
      const { vaults } = get();
      const vaultList = Object.values(vaults);
      
      if (vaultList.length === 0) return null;
      
      return vaultList.reduce((worst, current) =>
        current.performance24h < worst.performance24h ? current : worst
      );
    },
    
    getUserPortfolioAllocation: () => {
      const { userPositions } = get();
      const totalValue = get().getTotalUserValue();
      
      if (totalValue === BigInt(0)) return [];
      
      return userPositions.map(pos => {
        // Find botId from vault address (would need vault mapping)
        const botId = 0; // TODO: Implement vault -> botId mapping
        const percentage = Number((pos.assets * BigInt(10000)) / totalValue) / 100;
        
        return {
          botId,
          percentage,
          value: pos.assets,
        };
      });
    },
  }))
);

// Selectors for optimized re-renders
export const useVaults = () => useVaultStore((state) => state.vaults);
export const useUserPositions = () => useVaultStore((state) => state.userPositions);
export const useStakingInfo = () => useVaultStore((state) => state.stakingInfo);
export const useBotTokenPrice = () => useVaultStore((state) => state.botTokenPrice);
export const useSelectedVault = () => useVaultStore((state) => state.selectedVault);
export const usePendingTransactions = () => useVaultStore((state) => state.pendingTransactions);

// Subscription helpers for real-time updates
export const subscribeToVaultChanges = (botId: number, callback: (vault: VaultInfo | undefined) => void) => {
  return useVaultStore.subscribe(
    (state) => state.vaults[botId],
    callback
  );
};

export const subscribeToUserPositions = (callback: (positions: UserPosition[]) => void) => {
  return useVaultStore.subscribe(
    (state) => state.userPositions,
    callback
  );
};