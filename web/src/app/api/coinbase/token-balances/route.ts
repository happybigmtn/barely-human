import { NextRequest, NextResponse } from 'next/server';

interface TokenBalanceRequest {
  address: string;
  network: 'base' | 'base-sepolia';
}

interface TokenBalance {
  asset: string;
  balance: string;
  decimals: number;
  name: string;
  symbol: string;
  contractAddress?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenBalanceRequest = await request.json();
    const { address, network = 'base' } = body;

    // Validate address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // CDP Token Balance API endpoint
    const cdpApiUrl = `https://api.coinbase.com/v2/accounts/${address}/balances`;
    
    // In a production environment, you would use the actual CDP API
    // For now, we'll return mock data that represents what the API would return
    const mockBalances: TokenBalance[] = [
      {
        asset: 'ETH',
        balance: '1250000000000000000', // 1.25 ETH
        decimals: 18,
        name: 'Ethereum',
        symbol: 'ETH'
      },
      {
        asset: 'USDC',
        balance: '50000000', // 50 USDC
        decimals: 6,
        name: 'USD Coin',
        symbol: 'USDC',
        contractAddress: network === 'base' 
          ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
          : '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
      },
      {
        asset: 'BOT',
        balance: '10000000000000000000000', // 10,000 BOT
        decimals: 18,
        name: 'Barely Human Token',
        symbol: 'BOT',
        contractAddress: process.env.NEXT_PUBLIC_BOT_TOKEN_ADDRESS || '0x...'
      }
    ];

    // In production, make actual API call:
    /*
    const response = await fetch(cdpApiUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.CDP_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch balances from CDP API');
    }
    
    const data = await response.json();
    const balances = data.data.map(transformCDPBalance);
    */

    return NextResponse.json({
      balances: mockBalances,
      address,
      network,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token balance API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch token balances',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Get supported tokens for the network
  const searchParams = request.nextUrl.searchParams;
  const network = searchParams.get('network') as 'base' | 'base-sepolia' || 'base';

  const supportedTokens = {
    base: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        contractAddress: null // Native token
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
      },
      {
        symbol: 'BOT',
        name: 'Barely Human Token',
        decimals: 18,
        contractAddress: process.env.NEXT_PUBLIC_BOT_TOKEN_ADDRESS
      }
    ],
    'base-sepolia': [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        contractAddress: null // Native token
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        contractAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
      },
      {
        symbol: 'BOT',
        name: 'Barely Human Token',
        decimals: 18,
        contractAddress: process.env.NEXT_PUBLIC_BOT_TOKEN_ADDRESS
      }
    ]
  };

  return NextResponse.json({
    supportedTokens: supportedTokens[network],
    network
  });
}