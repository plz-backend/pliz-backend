-- Remove collection subaccount split column from bank accounts.

ALTER TABLE "bank_accounts"
  DROP COLUMN IF EXISTS "flw_subaccount_id";
