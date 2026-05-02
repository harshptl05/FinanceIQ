-- Mutual fund support
--
-- Adds the fields the rest of the stack expects when a holding is a
-- mutual fund. Idempotent: safe to re-run, doesn't touch existing data.
--
-- Run in Supabase SQL editor.

ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS is_mutual_fund BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expense_ratio  DECIMAL(7,5),
  ADD COLUMN IF NOT EXISTS nav_date       DATE;

-- Optional: persist fetched fund metadata so we don't re-call yfinance
-- on every render. Curated tickers go straight from JSON, but anything
-- yfinance returns we can stash here for reuse.
CREATE TABLE IF NOT EXISTS fund_metadata (
  ticker          TEXT PRIMARY KEY,
  name            TEXT,
  category        TEXT,
  fund_family     TEXT,
  expense_ratio   DECIMAL(7,5),
  is_index_fund   BOOLEAN,
  is_mutual_fund  BOOLEAN,
  total_assets    DECIMAL(18,2),
  inception_date  DATE,
  ytd_return      DECIMAL(8,4),
  three_year_return DECIMAL(8,4),
  five_year_return  DECIMAL(8,4),
  top_holdings    JSONB,
  sector_weights  JSONB,
  source          TEXT,
  last_updated    TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS on fund_metadata: it's reference data, not user-scoped.
