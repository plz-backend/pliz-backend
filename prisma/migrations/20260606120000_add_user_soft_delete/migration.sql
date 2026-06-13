-- Soft-delete metadata on app_users (account deletion feature)
ALTER TABLE "app_users"
  ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS "deleted_by" UUID,
  ADD COLUMN IF NOT EXISTS "delete_reason" TEXT;

CREATE INDEX IF NOT EXISTS "app_users_is_deleted_idx" ON "app_users"("is_deleted");
