import { NextRequest, NextResponse } from 'next/server';

interface ContractEventRequest {
  contractAddress: string;
  eventName: string;
  fromBlock?: number;
  toBlock?: number;
  network: 'base' | 'base-sepolia';
}

interface TransactionEvent {
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  contractAddress: string;
  eventName: string;
  eventSignature: string;
  decodedLog: any;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContractEventRequest = await request.json();
    const { 
      contractAddress, 
      eventName, 
      fromBlock, 
      toBlock, 
      network = 'base' 
    } = body;

    // Validate contract address
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    // In production, this would query the actual CDP Events API
    // For now, return mock events that demonstrate the structure
    const mockEvents: TransactionEvent[] = generateMockEvents(
      contractAddress,
      eventName,
      fromBlock,
      toBlock
    );

    return NextResponse.json({
      events: mockEvents,
      contractAddress,
      eventName,
      network,
      fromBlock,
      toBlock,
      totalCount: mockEvents.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Contract events API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch contract events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateMockEvents(
  contractAddress: string,
  eventName: string,
  fromBlock?: number,
  toBlock?: number
): TransactionEvent[] {
  const currentBlock = 15000000; // Mock current block
  const startBlock = fromBlock || currentBlock - 1000;
  const endBlock = toBlock || currentBlock;

  const events: TransactionEvent[] = [];
  
  // Generate different types of events based on event name
  switch (eventName) {
    case 'BetPlaced':
      for (let i = 0; i < 10; i++) {
        events.push({
          transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
          blockNumber: startBlock + Math.floor(Math.random() * (endBlock - startBlock)),
          logIndex: i,
          contractAddress,
          eventName: 'BetPlaced',
          eventSignature: '0xbet_placed_signature',
          decodedLog: {
            player: `0x${Math.random().toString(16).substr(2, 40)}`,
            betType: Math.floor(Math.random() * 64),
            amount: (Math.random() * 1000 * 1e18).toString(),
            betId: i + 1000,
            odds: Math.floor(Math.random() * 35) + 1
          },
          timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
        });
      }
      break;

    case 'DiceRolled':
      for (let i = 0; i < 5; i++) {
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        events.push({
          transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
          blockNumber: startBlock + Math.floor(Math.random() * (endBlock - startBlock)),
          logIndex: i,
          contractAddress,
          eventName: 'DiceRolled',
          eventSignature: '0xdice_rolled_signature',
          decodedLog: {
            gameId: Math.floor(Math.random() * 1000),
            die1,
            die2,
            total: die1 + die2,
            roller: `0x${Math.random().toString(16).substr(2, 40)}`
          },
          timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
        });
      }
      break;

    case 'BetSettled':
      for (let i = 0; i < 15; i++) {
        const won = Math.random() > 0.5;
        const amount = Math.random() * 500 * 1e18;
        events.push({
          transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
          blockNumber: startBlock + Math.floor(Math.random() * (endBlock - startBlock)),
          logIndex: i,
          contractAddress,
          eventName: 'BetSettled',
          eventSignature: '0xbet_settled_signature',
          decodedLog: {
            betId: i + 1000,
            player: `0x${Math.random().toString(16).substr(2, 40)}`,
            won,
            payout: won ? (amount * (Math.random() * 2 + 1)).toString() : '0',
            betAmount: amount.toString()
          },
          timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
        });
      }
      break;

    case 'BotActionTriggered':
      for (let i = 0; i < 8; i++) {
        events.push({
          transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
          blockNumber: startBlock + Math.floor(Math.random() * (endBlock - startBlock)),
          logIndex: i,
          contractAddress,
          eventName: 'BotActionTriggered',
          eventSignature: '0xbot_action_signature',
          decodedLog: {
            botId: Math.floor(Math.random() * 10),
            action: Math.floor(Math.random() * 4), // 0=bet, 1=withdraw, 2=deposit, 3=strategy_change
            amount: (Math.random() * 200 * 1e18).toString(),
            reason: 'automated_strategy'
          },
          timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
        });
      }
      break;

    case 'Deposit':
      for (let i = 0; i < 6; i++) {
        events.push({
          transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
          blockNumber: startBlock + Math.floor(Math.random() * (endBlock - startBlock)),
          logIndex: i,
          contractAddress,
          eventName: 'Deposit',
          eventSignature: '0xdeposit_signature',
          decodedLog: {
            caller: `0x${Math.random().toString(16).substr(2, 40)}`,
            owner: `0x${Math.random().toString(16).substr(2, 40)}`,
            assets: (Math.random() * 1000 * 1e18).toString(),
            shares: (Math.random() * 800 * 1e18).toString()
          },
          timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
        });
      }
      break;

    default:
      // Generic event
      events.push({
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        blockNumber: startBlock + Math.floor(Math.random() * (endBlock - startBlock)),
        logIndex: 0,
        contractAddress,
        eventName: eventName || 'UnknownEvent',
        eventSignature: '0xgeneric_signature',
        decodedLog: {
          data: 'generic_event_data'
        },
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
      });
  }

  // Sort by block number descending (most recent first)
  return events.sort((a, b) => b.blockNumber - a.blockNumber);
}

export async function GET(request: NextRequest) {
  // Get available events for a contract
  const searchParams = request.nextUrl.searchParams;
  const contractType = searchParams.get('contractType') || 'generic';

  const eventTypes = {
    craps_game: [
      'BetPlaced',
      'DiceRolled', 
      'BetSettled',
      'GameStateChanged',
      'SeriesStarted',
      'SeriesEnded'
    ],
    bot_manager: [
      'BotActionTriggered',
      'BotCreated',
      'BotUpdated',
      'StrategyChanged'
    ],
    vault: [
      'Deposit',
      'Withdraw',
      'FeesCollected',
      'SharesIssued'
    ],
    staking: [
      'Staked',
      'Withdrawn',
      'RewardPaid',
      'EpochStarted'
    ],
    generic: [
      'Transfer',
      'Approval',
      'OwnershipTransferred'
    ]
  };

  return NextResponse.json({
    eventTypes: eventTypes[contractType as keyof typeof eventTypes] || eventTypes.generic,
    contractType
  });
}