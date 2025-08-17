import { NextRequest, NextResponse } from 'next/server';

interface OnrampRequest {
  destinationWallet: string;
  asset: string;
  amount?: string;
  chain: string;
  blockchain: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: OnrampRequest = await request.json();
    
    const {
      destinationWallet,
      asset = 'ETH',
      amount,
      chain,
      blockchain
    } = body;

    // Validate required fields
    if (!destinationWallet) {
      return NextResponse.json(
        { error: 'Destination wallet address is required' },
        { status: 400 }
      );
    }

    // Base Coinbase Onramp URL
    const baseUrl = 'https://pay.coinbase.com/buy/select-asset';
    
    // Create URL parameters
    const params = new URLSearchParams({
      appId: process.env.NEXT_PUBLIC_CDP_ONRAMP_APP_ID || 'barely-human-casino',
      destinationWallet,
      blockchain: blockchain || 'base',
      asset: asset.toUpperCase(),
      ...(amount && { amount }),
      // Additional parameters for better UX
      theme: 'dark',
      presetCryptoAmount: amount || '',
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/onramp/success`
    });

    const onrampUrl = `${baseUrl}?${params.toString()}`;

    // In production, you might want to store this request for tracking
    // await trackOnrampRequest(destinationWallet, asset, amount);

    return NextResponse.json({
      url: onrampUrl,
      parameters: {
        asset,
        amount,
        blockchain,
        destinationWallet
      },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    });

  } catch (error) {
    console.error('Onramp URL generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate onramp URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Get onramp configuration
  const searchParams = request.nextUrl.searchParams;
  const wallet = searchParams.get('wallet');
  
  if (!wallet) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }

  try {
    // Return supported assets and limits
    const config = {
      supportedAssets: [
        {
          symbol: 'ETH',
          name: 'Ethereum',
          minAmount: '0.001',
          maxAmount: '50',
          network: 'base'
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          minAmount: '1',
          maxAmount: '50000',
          network: 'base'
        }
      ],
      supportedPaymentMethods: [
        'credit_card',
        'debit_card',
        'bank_transfer',
        'apple_pay',
        'google_pay'
      ],
      supportedCountries: [
        'US', 'CA', 'GB', 'EU', 'AU', 'JP'
      ],
      fees: {
        credit_card: '3.99%',
        bank_transfer: '1.49%',
        apple_pay: '3.99%'
      }
    };

    return NextResponse.json(config);
    
  } catch (error) {
    console.error('Config fetch error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}