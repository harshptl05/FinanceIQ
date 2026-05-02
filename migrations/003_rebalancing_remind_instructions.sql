-- Rebalancing reminders + cached Claude trade instructions
-- Idempotent: safe to re-run.

ALTER TABLE rebalancing_recommendations
  ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trade_instructions JSONB;
