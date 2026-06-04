-- Security hardening: stop storing new plaintext refresh tokens, add
-- encrypted/hash fields for payment and bank secrets, and force old sessions
-- to re-authenticate because existing refresh tokens were stored plaintext.

ALTER TABLE "session_manager"
  ADD COLUMN IF NOT EXISTS "refresh_token_hash" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "session_manager_refresh_token_hash_idx"
  ON "session_manager"("refresh_token_hash");

UPDATE "session_manager"
SET "active" = false,
    "refresh_token" = NULL,
    "refresh_token_hash" = NULL
WHERE "active" = true;

ALTER TABLE "saved_cards"
  ADD COLUMN IF NOT EXISTS "authorization_code_hash" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "saved_cards_authorization_code_hash_key"
  ON "saved_cards"("authorization_code_hash");

ALTER TABLE "bank_accounts"
  ADD COLUMN IF NOT EXISTS "account_number_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "account_number_hash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "account_number_last4" VARCHAR(4);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_accounts_user_id_account_number_hash_key"
  ON "bank_accounts"("user_id", "account_number_hash");
