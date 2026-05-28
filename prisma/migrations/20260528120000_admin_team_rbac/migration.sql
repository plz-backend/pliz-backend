-- CreateEnum
CREATE TYPE "AdminStaffRole" AS ENUM ('super_admin', 'operations', 'support', 'finance', 'viewer');

-- AlterTable
ALTER TABLE "app_users" ADD COLUMN "admin_staff_role" "AdminStaffRole",
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "password_changed_at" TIMESTAMP(6),
ADD COLUMN "is_team_disabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing staff roles
UPDATE "app_users" SET "admin_staff_role" = 'super_admin' WHERE "role" = 'superadmin';
UPDATE "app_users" SET "admin_staff_role" = 'operations' WHERE "role" = 'admin' AND "admin_staff_role" IS NULL;

-- CreateTable
CREATE TABLE "admin_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "admin_staff_role" "AdminStaffRole" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "accepted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_invites_token_hash_key" ON "admin_invites"("token_hash");

-- CreateIndex
CREATE INDEX "admin_invites_email_idx" ON "admin_invites"("email");

-- CreateIndex
CREATE INDEX "admin_invites_expires_at_idx" ON "admin_invites"("expires_at");

-- AddForeignKey
ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
