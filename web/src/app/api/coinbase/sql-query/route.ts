import { NextRequest, NextResponse } from 'next/server';

interface SQLQueryRequest {
  query: string;
  parameters?: Record<string, any>;
}

interface SQLQueryResult {
  rows: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SQLQueryRequest = await request.json();
    const { query, parameters } = body;

    // Validate query
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Valid SQL query is required' },
        { status: 400 }
      );
    }

    // Security check - only allow SELECT queries
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select')) {
      return NextResponse.json(
        { error: 'Only SELECT queries are allowed' },
        { status: 400 }
      );
    }

    // Check for potentially dangerous operations
    const forbiddenKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create'];
    if (forbiddenKeywords.some(keyword => trimmedQuery.includes(keyword))) {
      return NextResponse.json(
        { error: 'Query contains forbidden operations' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // In production, this would execute the query against CDP's SQL API
    // For now, return mock data based on the query type
    const result = await executeMockQuery(query, parameters);
    
    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      ...result,
      executionTime,
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''), // Truncate for security
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('SQL query API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to execute SQL query',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function executeMockQuery(
  query: string, 
  parameters?: Record<string, any>
): Promise<SQLQueryResult> {
  const lowerQuery = query.toLowerCase();

  // Mock game statistics query
  if (lowerQuery.includes('base.events') && lowerQuery.includes('total_bets')) {
    return {
      rows: [{
        total_bets: 1547,
        total_volume: '125000000000000000000000', // 125,000 BOT
        unique_players: 89,
        win_rate: 47.3
      }],
      columns: ['total_bets', 'total_volume', 'unique_players', 'win_rate'],
      rowCount: 1
    };
  }

  // Mock bot performance query
  if (lowerQuery.includes('bot_id') && lowerQuery.includes('win_rate')) {
    return {
      rows: [
        {
          bot_id: 0,
          total_bets: 234,
          win_rate: 52.1,
          profit_loss: '15000000000000000000000', // 15,000 BOT profit
          volume_traded: '45000000000000000000000'
        },
        {
          bot_id: 1,
          total_bets: 189,
          win_rate: 48.7,
          profit_loss: '-2000000000000000000000', // -2,000 BOT loss
          volume_traded: '38000000000000000000000'
        },
        {
          bot_id: 2,
          total_bets: 156,
          win_rate: 49.4,
          profit_loss: '1200000000000000000000', // 1,200 BOT profit
          volume_traded: '31000000000000000000000'
        },
        {
          bot_id: 3,
          total_bets: 203,
          win_rate: 46.8,
          profit_loss: '-5000000000000000000000', // -5,000 BOT loss
          volume_traded: '42000000000000000000000'
        },
        {
          bot_id: 4,
          total_bets: 167,
          win_rate: 53.9,
          profit_loss: '8500000000000000000000', // 8,500 BOT profit
          volume_traded: '35000000000000000000000'
        }
      ],
      columns: ['bot_id', 'total_bets', 'win_rate', 'profit_loss', 'volume_traded'],
      rowCount: 5
    };
  }

  // Mock TVL history query
  if (lowerQuery.includes('total_tvl') && lowerQuery.includes('date')) {
    const dates = [];
    const rows = [];
    
    // Generate 30 days of mock TVL data
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const baseTVL = 1000000; // 1M base TVL
      const variance = Math.sin(i * 0.2) * 100000 + Math.random() * 50000;
      const totalTVL = Math.floor(baseTVL + variance);
      
      rows.push({
        date: dateStr,
        total_tvl: (totalTVL * 1e18).toString(),
        contract_address: `0x${Math.random().toString(16).substr(2, 40)}`,
        vault_tvl: (totalTVL * 0.1 * 1e18).toString()
      });
    }

    return {
      rows,
      columns: ['date', 'total_tvl', 'contract_address', 'vault_tvl'],
      rowCount: rows.length
    };
  }

  // Mock transaction analysis query
  if (lowerQuery.includes('base.transactions')) {
    return {
      rows: [
        {
          hour: '2024-01-16 14:00:00',
          transaction_count: 45,
          gas_used: '125000000',
          avg_gas_price: '0.05',
          success_rate: 98.2
        },
        {
          hour: '2024-01-16 15:00:00',
          transaction_count: 52,
          gas_used: '142000000',
          avg_gas_price: '0.048',
          success_rate: 96.8
        },
        {
          hour: '2024-01-16 16:00:00',
          transaction_count: 38,
          gas_used: '98000000',
          avg_gas_price: '0.052',
          success_rate: 97.4
        }
      ],
      columns: ['hour', 'transaction_count', 'gas_used', 'avg_gas_price', 'success_rate'],
      rowCount: 3
    };
  }

  // Mock user analysis query
  if (lowerQuery.includes('unique') && lowerQuery.includes('users')) {
    return {
      rows: [{
        daily_active_users: 234,
        new_users: 45,
        returning_users: 189,
        avg_session_duration: 1847, // seconds
        total_volume: '45000000000000000000000' // 45,000 BOT
      }],
      columns: ['daily_active_users', 'new_users', 'returning_users', 'avg_session_duration', 'total_volume'],
      rowCount: 1
    };
  }

  // Default mock response
  return {
    rows: [{
      result: 'Query executed successfully',
      timestamp: new Date().toISOString(),
      mock_data: true
    }],
    columns: ['result', 'timestamp', 'mock_data'],
    rowCount: 1
  };
}

export async function GET(request: NextRequest) {
  // Get available tables and schema information
  const searchParams = request.nextUrl.searchParams;
  const network = searchParams.get('network') || 'base';

  const schemaInfo = {
    base: {
      tables: [
        {
          name: 'base.events',
          description: 'Smart contract events on Base network',
          columns: [
            { name: 'block_number', type: 'BIGINT', description: 'Block number of the event' },
            { name: 'block_timestamp', type: 'TIMESTAMP', description: 'Timestamp of the block' },
            { name: 'transaction_hash', type: 'VARCHAR', description: 'Transaction hash' },
            { name: 'log_index', type: 'INTEGER', description: 'Log index within the transaction' },
            { name: 'contract_address', type: 'VARCHAR', description: 'Contract address that emitted the event' },
            { name: 'topics', type: 'ARRAY<VARCHAR>', description: 'Event topics array' },
            { name: 'data', type: 'VARCHAR', description: 'Event data' }
          ]
        },
        {
          name: 'base.transactions',
          description: 'Transactions on Base network',
          columns: [
            { name: 'block_number', type: 'BIGINT', description: 'Block number' },
            { name: 'block_timestamp', type: 'TIMESTAMP', description: 'Block timestamp' },
            { name: 'hash', type: 'VARCHAR', description: 'Transaction hash' },
            { name: 'from_address', type: 'VARCHAR', description: 'Sender address' },
            { name: 'to_address', type: 'VARCHAR', description: 'Recipient address' },
            { name: 'value', type: 'BIGINT', description: 'Transaction value in wei' },
            { name: 'gas_used', type: 'BIGINT', description: 'Gas used' },
            { name: 'gas_price', type: 'BIGINT', description: 'Gas price' },
            { name: 'status', type: 'INTEGER', description: 'Transaction status (1=success, 0=failed)' }
          ]
        },
        {
          name: 'base.blocks',
          description: 'Blocks on Base network',
          columns: [
            { name: 'number', type: 'BIGINT', description: 'Block number' },
            { name: 'timestamp', type: 'TIMESTAMP', description: 'Block timestamp' },
            { name: 'hash', type: 'VARCHAR', description: 'Block hash' },
            { name: 'parent_hash', type: 'VARCHAR', description: 'Parent block hash' },
            { name: 'gas_used', type: 'BIGINT', description: 'Total gas used in block' },
            { name: 'gas_limit', type: 'BIGINT', description: 'Block gas limit' },
            { name: 'transaction_count', type: 'INTEGER', description: 'Number of transactions in block' }
          ]
        },
        {
          name: 'base.transfers',
          description: 'Token transfers on Base network',
          columns: [
            { name: 'block_number', type: 'BIGINT', description: 'Block number' },
            { name: 'block_timestamp', type: 'TIMESTAMP', description: 'Block timestamp' },
            { name: 'transaction_hash', type: 'VARCHAR', description: 'Transaction hash' },
            { name: 'log_index', type: 'INTEGER', description: 'Log index' },
            { name: 'contract_address', type: 'VARCHAR', description: 'Token contract address' },
            { name: 'from_address', type: 'VARCHAR', description: 'From address' },
            { name: 'to_address', type: 'VARCHAR', description: 'To address' },
            { name: 'value', type: 'BIGINT', description: 'Transfer amount' }
          ]
        }
      ],
      examples: [
        {
          title: 'Get daily transaction count',
          query: `SELECT DATE(block_timestamp) as date, COUNT(*) as tx_count 
                  FROM base.transactions 
                  WHERE block_timestamp > NOW() - INTERVAL '7 days' 
                  GROUP BY date 
                  ORDER BY date DESC`
        },
        {
          title: 'Get contract events for specific address',
          query: `SELECT * FROM base.events 
                  WHERE contract_address = LOWER('0x...')
                  AND block_timestamp > NOW() - INTERVAL '24 hours'
                  ORDER BY block_number DESC 
                  LIMIT 100`
        },
        {
          title: 'Get token transfers',
          query: `SELECT from_address, to_address, value 
                  FROM base.transfers 
                  WHERE contract_address = LOWER('0x...')
                  ORDER BY block_number DESC 
                  LIMIT 50`
        }
      ]
    }
  };

  return NextResponse.json({
    schema: schemaInfo[network as keyof typeof schemaInfo] || schemaInfo.base,
    network,
    limits: {
      maxRows: 10000,
      timeoutSeconds: 30,
      maxJoins: 5
    },
    supportedOperations: [
      'SELECT',
      'WHERE',
      'GROUP BY',
      'ORDER BY',
      'LIMIT',
      'HAVING',
      'JOIN (max 5)',
      'Aggregate functions (COUNT, SUM, AVG, MIN, MAX)',
      'Date/time functions',
      'String functions'
    ]
  });
}