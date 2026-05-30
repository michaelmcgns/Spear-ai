-- Add promo_code column to subscriptions table
-- Used by /api/promo/redeem to track which promo was applied and prevent double-redemption

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS promo_code TEXT DEFAULT NULL;
