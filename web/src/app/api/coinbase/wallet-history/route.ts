import { NextRequest, NextResponse } from 'next/server';

interface WalletHistoryRequest {
  address: string;
  limit?: number;
  offset?: number;
  contractAddress?: string;
}

interface Transaction {
  hash: string;
  blockNumber: number;
  timestamp: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: string;
  type: string;
  methodId?: string;
  contractInteraction?: {
    contractAddress: string;
    methodName?: string;
    decodedInput?: any;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: WalletHistoryRequest = await request.json();
    const { address, limit = 50, offset = 0, contractAddress } = body;

    // Validate address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Validate pagination parameters
    if (limit > 100 || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // In production, this would query the actual CDP Wallet History API
    const mockTransactions = generateMockTransactions(address, contractAddress, limit, offset);

    const totalCount = contractAddress ? 45 : 287; // Mock total count

    return NextResponse.json({
      transactions: mockTransactions,
      totalCount,
      address,
      limit,
      offset,
      hasMore: (offset + limit) < totalCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Wallet history API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch wallet history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateMockTransactions(
  address: string,
  contractAddress?: string,
  limit: number = 50,
  offset: number = 0
): Transaction[] {
  const transactions: Transaction[] = [];
  const currentBlock = 15000000;
  
  // Contract addresses for our casino system
  const casinoContracts = {
    botToken: process.env.NEXT_PUBLIC_BOT_TOKEN_ADDRESS || '0x1234567890123456789012345678901234567890',
    crapsGame: process.env.NEXT_PUBLIC_CRAPS_GAME_ADDRESS || '0x2345678901234567890123456789012345678901',
    botManager: process.env.NEXT_PUBLIC_BOT_MANAGER_ADDRESS || '0x3456789012345678901234567890123456789012',
    staking: process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS || '0x4567890123456789012345678901234567890123',
    vault: process.env.NEXT_PUBLIC_VAULT_FACTORY_ADDRESS || '0x5678901234567890123456789012345678901234'
  };

  for (let i = offset; i < offset + limit; i++) {
    const blockNumber = currentBlock - Math.floor(Math.random() * 10000);
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const isIncoming = Math.random() > 0.6;
    const txType = getRandomTransactionType();
    
    let transaction: Transaction;

    if (contractAddress) {
      // Generate contract-specific transactions
      transaction = generateContractTransaction(
        address,
        contractAddress,
        blockNumber,
        timestamp,
        isIncoming,
        i
      );
    } else {
      // Generate mixed transactions
      const targetContract = Object.values(casinoContracts)[Math.floor(Math.random() * 5)];
      transaction = generateMixedTransaction(
        address,
        targetContract,
        blockNumber,
        timestamp,
        isIncoming,
        txType,
        i
      );
    }

    transactions.push(transaction);
  }

  return transactions.sort((a, b) => b.blockNumber - a.blockNumber);
}

function generateContractTransaction(
  userAddress: string,
  contractAddress: string,
  blockNumber: number,
  timestamp: Date,
  isIncoming: boolean,
  index: number
): Transaction {
  const methodNames = {
    'bet': ['placeBet', 'increaseBet'],
    'vault': ['deposit', 'withdraw'],
    'staking': ['stake', 'unstake', 'claimRewards'],
    'token': ['transfer', 'approve']
  };

  const contractType = getContractType(contractAddress);
  const methods = methodNames[contractType] || ['transfer'];
  const methodName = methods[Math.floor(Math.random() * methods.length)];
  
  return {
    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
    blockNumber,
    timestamp: timestamp.toISOString(),
    from: isIncoming ? `0x${Math.random().toString(16).substr(2, 40)}` : userAddress,
    to: isIncoming ? userAddress : contractAddress,
    value: methodName === 'transfer' ? (Math.random() * 10 * 1e18).toString() : '0',
    gasUsed: (Math.random() * 200000 + 50000).toString(),
    gasPrice: (Math.random() * 0.1 * 1e9).toString(),
    status: Math.random() > 0.05 ? 'success' : 'failed',
    type: 'contract_interaction',
    methodId: `0x${Math.random().toString(16).substr(2, 8)}`,
    contractInteraction: {
      contractAddress,
      methodName,
      decodedInput: generateMethodInput(methodName)
    }
  };
}

function generateMixedTransaction(
  userAddress: string,
  targetAddress: string,
  blockNumber: number,
  timestamp: Date,
  isIncoming: boolean,
  type: string,
  index: number
): Transaction {
  return {
    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
    blockNumber,
    timestamp: timestamp.toISOString(),
    from: isIncoming ? `0x${Math.random().toString(16).substr(2, 40)}` : userAddress,
    to: isIncoming ? userAddress : targetAddress,
    value: type === 'transfer' ? (Math.random() * 5 * 1e18).toString() : '0',
    gasUsed: (Math.random() * 150000 + 21000).toString(),
    gasPrice: (Math.random() * 0.08 * 1e9).toString(),
    status: Math.random() > 0.03 ? 'success' : 'failed',
    type,
    ...(type === 'contract_interaction' && {
      methodId: `0x${Math.random().toString(16).substr(2, 8)}`,
      contractInteraction: {
        contractAddress: targetAddress,
        methodName: getRandomMethodName(),
        decodedInput: {}
      }
    })
  };
}

function getContractType(address: string): string {
  const addressLower = address.toLowerCase();
  if (addressLower.includes('bot') || addressLower.includes('token')) return 'token';
  if (addressLower.includes('craps') || addressLower.includes('game')) return 'bet';
  if (addressLower.includes('vault')) return 'vault';
  if (addressLower.includes('stak')) return 'staking';
  return 'token';
}

function getRandomTransactionType(): string {
  const types = ['transfer', 'contract_interaction', 'approval'];
  return types[Math.floor(Math.random() * types.length)];
}

function getRandomMethodName(): string {
  const methods = [
    'placeBet', 'deposit', 'withdraw', 'stake', 'transfer', 
    'approve', 'claimRewards', 'rollDice', 'settleBet'
  ];
  return methods[Math.floor(Math.random() * methods.length)];
}

function generateMethodInput(methodName: string): any {
  switch (methodName) {
    case 'placeBet':
      return {
        betType: Math.floor(Math.random() * 64),
        amount: (Math.random() * 100 * 1e18).toString()
      };
    case 'deposit':
      return {
        assets: (Math.random() * 1000 * 1e18).toString(),
        receiver: `0x${Math.random().toString(16).substr(2, 40)}`
      };
    case 'stake':
      return {
        amount: (Math.random() * 500 * 1e18).toString()
      };
    case 'transfer':
      return {
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        amount: (Math.random() * 50 * 1e18).toString()
      };
    case 'approve':
      return {
        spender: `0x${Math.random().toString(16).substr(2, 40)}`,
        amount: (Math.random() * 1000 * 1e18).toString()
      };
    default:
      return {};
  }
}

export async function GET(request: NextRequest) {
  // Get wallet activity summary
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const timeframe = searchParams.get('timeframe') || '7d';

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Valid wallet address is required' },
      { status: 400 }
    );
  }

  // Generate mock activity summary
  const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
  
  const summary = {
    address,
    timeframe,
    totalTransactions: Math.floor(Math.random() * days * 10 + days * 2),
    successfulTransactions: 0,
    failedTransactions: 0,
    totalValueTransferred: '0',
    totalGasUsed: '0',
    uniqueContracts: Math.floor(Math.random() * 8 + 3),
    activityByDay: [] as any[],
    topContracts: [
      {
        address: process.env.NEXT_PUBLIC_CRAPS_GAME_ADDRESS || '0x...',
        name: 'Craps Game',
        transactionCount: Math.floor(Math.random() * 50 + 10),
        volume: (Math.random() * 5000 * 1e18).toString()
      },
      {
        address: process.env.NEXT_PUBLIC_BOT_TOKEN_ADDRESS || '0x...',
        name: 'BOT Token',
        transactionCount: Math.floor(Math.random() * 30 + 5),
        volume: (Math.random() * 2000 * 1e18).toString()
      },
      {
        address: process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS || '0x...',
        name: 'Staking Pool',
        transactionCount: Math.floor(Math.random() * 20 + 2),
        volume: (Math.random() * 1000 * 1e18).toString()
      }
    ]
  };

  // Calculate derived values
  summary.successfulTransactions = Math.floor(summary.totalTransactions * 0.97);
  summary.failedTransactions = summary.totalTransactions - summary.successfulTransactions;
  summary.totalValueTransferred = (Math.random() * 10000 * 1e18).toString();
  summary.totalGasUsed = (summary.totalTransactions * 65000).toString();

  // Generate daily activity
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    summary.activityByDay.push({
      date: date.toISOString().split('T')[0],
      transactions: Math.floor(Math.random() * 15 + 2),
      volume: (Math.random() * 500 * 1e18).toString(),
      gasUsed: (Math.random() * 1000000 + 100000).toString()
    });
  }

  return NextResponse.json(summary);
}