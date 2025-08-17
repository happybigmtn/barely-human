import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  GameState, 
  BotPerformance, 
  PlacedBet, 
  ChatMessage, 
  BotChatState,
  GamePhase 
} from '@/types/contracts';
import { BOT_PERSONALITIES } from '@/lib/constants';

interface GameStore {
  // Game State
  gameState: GameState | null;
  isGameLoading: boolean;
  lastRollAnimation: boolean;
  
  // Bot Data
  botPerformances: Record<number, BotPerformance>;
  botChatStates: Record<number, BotChatState>;
  
  // User Data
  userBets: PlacedBet[];
  userBalance: bigint;
  isConnected: boolean;
  
  // Chat System
  chatMessages: ChatMessage[];
  activeChatBot: number | null;
  
  // UI State
  selectedView: 'dashboard' | 'bots' | 'vaults' | 'nft' | 'leaderboard';
  sidebarOpen: boolean;
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    timestamp: number;
  }>;
  
  // Actions
  setGameState: (state: GameState) => void;
  setGameLoading: (loading: boolean) => void;
  triggerRollAnimation: () => void;
  
  updateBotPerformance: (botId: number, performance: BotPerformance) => void;
  updateBotChatState: (botId: number, chatState: Partial<BotChatState>) => void;
  
  setUserBets: (bets: PlacedBet[]) => void;
  addUserBet: (bet: PlacedBet) => void;
  setUserBalance: (balance: bigint) => void;
  setConnected: (connected: boolean) => void;
  
  addChatMessage: (message: ChatMessage) => void;
  clearChatMessages: () => void;
  setActiveChatBot: (botId: number | null) => void;
  
  setSelectedView: (view: 'dashboard' | 'bots' | 'vaults' | 'nft' | 'leaderboard') => void;
  toggleSidebar: () => void;
  addNotification: (notification: Omit<GameStore['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  
  // Computed/Derived State
  getActiveBots: () => number[];
  getBotByPerformance: (metric: keyof BotPerformance) => BotPerformance[];
  getTotalTVL: () => bigint;
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    gameState: null,
    isGameLoading: false,
    lastRollAnimation: false,
    
    botPerformances: {},
    botChatStates: Object.fromEntries(
      BOT_PERSONALITIES.map(bot => [
        bot.id,
        {
          botId: bot.id,
          isTyping: false,
          lastMessage: '',
          mood: 'focused' as const,
          energy: 75,
        }
      ])
    ),
    
    userBets: [],
    userBalance: BigInt(0),
    isConnected: false,
    
    chatMessages: [],
    activeChatBot: null,
    
    selectedView: 'dashboard',
    sidebarOpen: false,
    notifications: [],
    
    // Actions
    setGameState: (state) => set({ gameState: state }),
    
    setGameLoading: (loading) => set({ isGameLoading: loading }),
    
    triggerRollAnimation: () => {
      set({ lastRollAnimation: true });
      setTimeout(() => set({ lastRollAnimation: false }), 600);
    },
    
    updateBotPerformance: (botId, performance) => set((state) => ({
      botPerformances: {
        ...state.botPerformances,
        [botId]: performance,
      },
    })),
    
    updateBotChatState: (botId, chatState) => set((state) => ({
      botChatStates: {
        ...state.botChatStates,
        [botId]: {
          ...state.botChatStates[botId],
          ...chatState,
        },
      },
    })),
    
    setUserBets: (bets) => set({ userBets: bets }),
    
    addUserBet: (bet) => set((state) => ({
      userBets: [...state.userBets, bet],
    })),
    
    setUserBalance: (balance) => set({ userBalance: balance }),
    
    setConnected: (connected) => set({ isConnected: connected }),
    
    addChatMessage: (message) => set((state) => {
      const newMessages = [...state.chatMessages, message];
      // Keep only last 100 messages
      if (newMessages.length > 100) {
        newMessages.splice(0, newMessages.length - 100);
      }
      return { chatMessages: newMessages };
    }),
    
    clearChatMessages: () => set({ chatMessages: [] }),
    
    setActiveChatBot: (botId) => set({ activeChatBot: botId }),
    
    setSelectedView: (view) => set({ selectedView: view }),
    
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    
    addNotification: (notification) => {
      const id = Math.random().toString(36).substr(2, 9);
      const timestamp = Date.now();
      
      set((state) => ({
        notifications: [
          ...state.notifications,
          { ...notification, id, timestamp },
        ],
      }));
      
      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id),
        }));
      }, 5000);
    },
    
    removeNotification: (id) => set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id),
    })),
    
    // Computed/Derived State
    getActiveBots: () => {
      const { botPerformances } = get();
      return Object.keys(botPerformances)
        .map(Number)
        .filter(botId => botPerformances[botId]?.totalGames > 0);
    },
    
    getBotByPerformance: (metric) => {
      const { botPerformances } = get();
      return Object.values(botPerformances)
        .sort((a, b) => {
          const aValue = a[metric];
          const bValue = b[metric];
          
          if (typeof aValue === 'bigint' && typeof bValue === 'bigint') {
            return bValue > aValue ? 1 : -1;
          }
          
          return (bValue as number) - (aValue as number);
        });
    },
    
    getTotalTVL: () => {
      const { botPerformances } = get();
      return Object.values(botPerformances).reduce(
        (total, bot) => total + (bot.totalWagered || BigInt(0)),
        BigInt(0)
      );
    },
  }))
);

// Selectors for optimized re-renders
export const useGameState = () => useGameStore((state) => state.gameState);
export const useBotPerformances = () => useGameStore((state) => state.botPerformances);
export const useUserBets = () => useGameStore((state) => state.userBets);
export const useChatMessages = () => useGameStore((state) => state.chatMessages);
export const useActiveChatBot = () => useGameStore((state) => state.activeChatBot);
export const useSelectedView = () => useGameStore((state) => state.selectedView);
export const useNotifications = () => useGameStore((state) => state.notifications);

// Subscription helpers for real-time updates
export const subscribeToGameChanges = (callback: (state: GameState | null) => void) => {
  return useGameStore.subscribe(
    (state) => state.gameState,
    callback
  );
};

export const subscribeToBotPerformance = (botId: number, callback: (performance: BotPerformance | undefined) => void) => {
  return useGameStore.subscribe(
    (state) => state.botPerformances[botId],
    callback
  );
};