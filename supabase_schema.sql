-- Run this in your Supabase SQL editor

CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  risk_capacity TEXT CHECK (risk_capacity IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  goal_type TEXT CHECK (goal_type IN ('retirement', 'house', 'college', 'emergency', 'other')),
  goal_name TEXT NOT NULL,
  target_date DATE NOT NULL,
  target_amount DECIMAL(12,2),
  current_amount DECIMAL(12,2) DEFAULT 0,
  target_allocation JSONB,
  rebalancing_strategy TEXT CHECK (rebalancing_strategy IN ('calendar', 'threshold', 'hybrid', 'cashflow')),
  rebalancing_threshold DECIMAL(4,2) DEFAULT 0.05,
  rebalancing_frequency TEXT DEFAULT 'quarterly',
  account_type TEXT CHECK (account_type IN ('401k', 'ira', 'roth_ira', 'taxable', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  goal_id UUID REFERENCES goals,
  ticker TEXT NOT NULL,
  name TEXT,
  asset_class TEXT CHECK (asset_class IN ('us_stocks', 'intl_stocks', 'bonds', 'cash', 'real_estate', 'commodities', 'other')),
  shares DECIMAL(12,4),
  avg_cost_basis DECIMAL(12,4),
  current_price DECIMAL(12,4),
  current_value DECIMAL(12,2),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolio_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  total_value DECIMAL(12,2),
  allocation JSONB,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rebalancing_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  goal_id UUID REFERENCES goals,
  trigger_type TEXT CHECK (trigger_type IN ('drift', 'news_event', 'goal_timeline', 'scheduled')),
  trigger_description TEXT,
  current_allocation JSONB,
  target_allocation JSONB,
  recommended_trades JSONB,
  urgency TEXT CHECK (urgency IN ('act_now', 'act_soon', 'monitor')),
  plain_english_explanation TEXT,
  tax_loss_harvesting_opportunity BOOLEAN DEFAULT FALSE,
  tax_notes TEXT,
  status TEXT CHECK (status IN ('pending', 'acknowledged', 'acted', 'dismissed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE news_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  source TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  affected_tickers TEXT[],
  affected_asset_classes TEXT[],
  classification TEXT CHECK (classification IN ('positive', 'negative', 'neutral')),
  materiality DECIMAL(3,2),
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolio_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  news_event_id UUID REFERENCES news_events,
  impact_classification TEXT CHECK (impact_classification IN ('positive', 'negative', 'neutral')),
  affected_holdings TEXT[],
  estimated_dollar_impact DECIMAL(12,2),
  plain_english_explanation TEXT,
  action_required BOOLEAN DEFAULT FALSE,
  urgency TEXT CHECK (urgency IN ('act_now', 'act_soon', 'monitor', 'info_only')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recommendation_calibration (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID REFERENCES rebalancing_recommendations,
  user_id UUID REFERENCES auth.users NOT NULL,
  recommended_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ,
  portfolio_value_at_recommendation DECIMAL(12,2),
  portfolio_value_30_days_later DECIMAL(12,2),
  recommendation_was_correct BOOLEAN,
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebalancing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_calibration ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users own data" ON user_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own data" ON goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON holdings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON portfolio_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON chat_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON rebalancing_recommendations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON portfolio_alerts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON recommendation_calibration FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "News events readable" ON news_events FOR SELECT USING (true);

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE portfolio_alerts;
