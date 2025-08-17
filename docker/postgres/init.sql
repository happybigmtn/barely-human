-- Barely Human - PostgreSQL Initialization Script

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS barely_human;

-- Use the database
\c barely_human;

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create extension for performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id BIGINT NOT NULL,
    start_block BIGINT NOT NULL,
    end_block BIGINT,
    total_bets INTEGER DEFAULT 0,
    total_volume DECIMAL(78, 18) DEFAULT 0,
    house_edge DECIMAL(10, 8) DEFAULT 0.02,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bot performance tracking
CREATE TABLE IF NOT EXISTS bot_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id INTEGER NOT NULL,
    vault_address VARCHAR(42) NOT NULL,
    session_id UUID REFERENCES game_sessions(id),
    bets_placed INTEGER DEFAULT 0,
    total_wagered DECIMAL(78, 18) DEFAULT 0,
    total_won DECIMAL(78, 18) DEFAULT 0,
    net_profit DECIMAL(78, 18) DEFAULT 0,
    win_rate DECIMAL(5, 4) DEFAULT 0,
    largest_win DECIMAL(78, 18) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player statistics
CREATE TABLE IF NOT EXISTS player_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_address VARCHAR(42) NOT NULL,
    session_id UUID REFERENCES game_sessions(id),
    bets_placed INTEGER DEFAULT 0,
    total_wagered DECIMAL(78, 18) DEFAULT 0,
    total_won DECIMAL(78, 18) DEFAULT 0,
    net_profit DECIMAL(78, 18) DEFAULT 0,
    favorite_bet_type INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NFT redemption tracking
CREATE TABLE IF NOT EXISTS nft_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id BIGINT NOT NULL,
    mint_pass_id BIGINT NOT NULL,
    player_address VARCHAR(42) NOT NULL,
    bot_id INTEGER NOT NULL,
    rarity INTEGER NOT NULL,
    vrf_seed DECIMAL(78, 0) NOT NULL,
    art_token_id BIGINT,
    status VARCHAR(20) DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System metrics
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(78, 18) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    response_status INTEGER,
    response_time_ms INTEGER,
    request_size BIGINT,
    response_size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_series_id ON game_sessions(series_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_bot_performance_bot_id ON bot_performance(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_performance_session_id ON bot_performance(session_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_address ON player_stats(player_address);
CREATE INDEX IF NOT EXISTS idx_player_stats_session_id ON player_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_nft_redemptions_status ON nft_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_nft_redemptions_player ON nft_redemptions(player_address);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bot_performance_updated_at BEFORE UPDATE ON bot_performance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_stats_updated_at BEFORE UPDATE ON player_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;