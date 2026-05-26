ALTER TABLE "public"."app_users"
ADD COLUMN "transaction_pin_hash" VARCHAR(255),
ADD COLUMN "transaction_pin_set_at" TIMESTAMP(6),
ADD COLUMN "transaction_pin_updated_at" TIMESTAMP(6),
ADD COLUMN "transaction_pin_failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "transaction_pin_locked_until" TIMESTAMP(6);
