-- Remove Flutterwave PSA wallet artifacts (safe, additive rollback only).
-- Reverts 20260612000000_add_payout_wallets without touching unrelated schema.

DROP TABLE IF EXISTS "payout_wallets";

DROP INDEX IF EXISTS "donations_wallet_credit_reference_key";
DROP INDEX IF EXISTS "donations_wallet_credit_status_idx";

ALTER TABLE "donations"
  DROP COLUMN IF EXISTS "platform_fee",
  DROP COLUMN IF EXISTS "beneficiary_amount",
  DROP COLUMN IF EXISTS "wallet_credit_status",
  DROP COLUMN IF EXISTS "wallet_credit_reference",
  DROP COLUMN IF EXISTS "wallet_credited_at";

ALTER TABLE "withdrawals"
  DROP COLUMN IF EXISTS "debit_wallet_reference";
