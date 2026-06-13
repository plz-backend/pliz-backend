-- PSA wallet payout model (additive only).
-- Kept in repo for migration history integrity; removed by 20260612120000_remove_payout_wallets.

CREATE TABLE IF NOT EXISTS "payout_wallets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "account_reference" VARCHAR(64) NOT NULL,
  "barter_id" VARCHAR(32),
  "nuban" VARCHAR(20),
  "bank_name" VARCHAR(100),
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payout_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payout_wallets_user_id_key" ON "payout_wallets"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payout_wallets_account_reference_key" ON "payout_wallets"("account_reference");
CREATE INDEX IF NOT EXISTS "payout_wallets_account_reference_idx" ON "payout_wallets"("account_reference");

ALTER TABLE "payout_wallets"
  ADD CONSTRAINT "payout_wallets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "donations"
  ADD COLUMN IF NOT EXISTS "platform_fee" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "beneficiary_amount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "wallet_credit_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "wallet_credit_reference" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "wallet_credited_at" TIMESTAMP(6);

CREATE UNIQUE INDEX IF NOT EXISTS "donations_wallet_credit_reference_key" ON "donations"("wallet_credit_reference");
CREATE INDEX IF NOT EXISTS "donations_wallet_credit_status_idx" ON "donations"("wallet_credit_status");

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "debit_wallet_reference" VARCHAR(255);

UPDATE "donations"
SET "wallet_credit_status" = 'legacy'
WHERE "status" = 'success'
  AND "wallet_credit_status" = 'pending'
  AND "wallet_credited_at" IS NULL;
