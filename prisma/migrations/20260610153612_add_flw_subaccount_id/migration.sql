-- Add Flutterwave subaccount ID to saved bank accounts (safe, additive only).
ALTER TABLE "bank_accounts"
  ADD COLUMN IF NOT EXISTS "flw_subaccount_id" VARCHAR(255);
