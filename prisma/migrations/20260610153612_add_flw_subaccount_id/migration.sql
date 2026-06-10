/*
  Warnings:

  - You are about to drop the column `admin_staff_role` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `apple_id` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `auth_provider` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `avatar` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `email_verified_at` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `google_id` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `investigation_reason` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `investigation_started_at` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `is_profile_complete` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `is_suspended` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `is_team_disabled` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `is_under_investigation` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `must_change_password` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `password_changed_at` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `suspended_at` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `suspended_by` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `suspension_reason` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `transaction_pin_failed_attempts` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `transaction_pin_hash` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `transaction_pin_locked_until` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `transaction_pin_set_at` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `transaction_pin_updated_at` on the `app_users` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token_hash` on the `session_manager` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `session_manager` table. All the data in the column will be lost.
  - You are about to drop the `admin_actions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `admin_invites` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bank_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `begs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cooldowns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `donations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `donor_ranks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gratitude_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `operational_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `saved_cards` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `support_chats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `support_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `support_tickets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_avatars` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_stats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_trust` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_verifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `withdrawals` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `refresh_token` on table `session_manager` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "admin_actions" DROP CONSTRAINT "admin_actions_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "admin_actions" DROP CONSTRAINT "admin_actions_target_id_fkey";

-- DropForeignKey
ALTER TABLE "admin_invites" DROP CONSTRAINT "admin_invites_invited_by_id_fkey";

-- DropForeignKey
ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "begs" DROP CONSTRAINT "begs_category_id_fkey";

-- DropForeignKey
ALTER TABLE "begs" DROP CONSTRAINT "begs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "cooldowns" DROP CONSTRAINT "cooldowns_user_id_fkey";

-- DropForeignKey
ALTER TABLE "donations" DROP CONSTRAINT "donations_donor_id_fkey";

-- DropForeignKey
ALTER TABLE "donations" DROP CONSTRAINT "donations_request_id_fkey";

-- DropForeignKey
ALTER TABLE "donor_ranks" DROP CONSTRAINT "donor_ranks_user_id_fkey";

-- DropForeignKey
ALTER TABLE "gratitude_messages" DROP CONSTRAINT "gratitude_messages_donation_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "operational_events" DROP CONSTRAINT "operational_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reactions" DROP CONSTRAINT "reactions_beg_id_fkey";

-- DropForeignKey
ALTER TABLE "reactions" DROP CONSTRAINT "reactions_donation_id_fkey";

-- DropForeignKey
ALTER TABLE "reactions" DROP CONSTRAINT "reactions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_reporter_id_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_request_id_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_target_user_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_cards" DROP CONSTRAINT "saved_cards_user_id_fkey";

-- DropForeignKey
ALTER TABLE "stories" DROP CONSTRAINT "stories_user_id_fkey";

-- DropForeignKey
ALTER TABLE "support_chats" DROP CONSTRAINT "support_chats_user_id_fkey";

-- DropForeignKey
ALTER TABLE "support_messages" DROP CONSTRAINT "support_messages_sender_id_fkey";

-- DropForeignKey
ALTER TABLE "support_messages" DROP CONSTRAINT "support_messages_ticket_id_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_assigned_to_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_avatars" DROP CONSTRAINT "user_avatars_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_stats" DROP CONSTRAINT "user_stats_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_trust" DROP CONSTRAINT "user_trust_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_verifications" DROP CONSTRAINT "user_verifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "withdrawals" DROP CONSTRAINT "withdrawals_bank_account_id_fkey";

-- DropForeignKey
ALTER TABLE "withdrawals" DROP CONSTRAINT "withdrawals_beg_id_fkey";

-- DropForeignKey
ALTER TABLE "withdrawals" DROP CONSTRAINT "withdrawals_user_id_fkey";

-- DropIndex
DROP INDEX "app_users_apple_id_idx";

-- DropIndex
DROP INDEX "app_users_apple_id_key";

-- DropIndex
DROP INDEX "app_users_email_idx";

-- DropIndex
DROP INDEX "app_users_google_id_idx";

-- DropIndex
DROP INDEX "app_users_google_id_key";

-- DropIndex
DROP INDEX "app_users_is_suspended_idx";

-- DropIndex
DROP INDEX "app_users_is_under_investigation_idx";

-- DropIndex
DROP INDEX "app_users_role_idx";

-- DropIndex
DROP INDEX "app_users_username_idx";

-- DropIndex
DROP INDEX "session_manager_refresh_token_hash_idx";

-- AlterTable
ALTER TABLE "app_users" DROP COLUMN "admin_staff_role",
DROP COLUMN "apple_id",
DROP COLUMN "auth_provider",
DROP COLUMN "avatar",
DROP COLUMN "email_verified_at",
DROP COLUMN "google_id",
DROP COLUMN "investigation_reason",
DROP COLUMN "investigation_started_at",
DROP COLUMN "is_profile_complete",
DROP COLUMN "is_suspended",
DROP COLUMN "is_team_disabled",
DROP COLUMN "is_under_investigation",
DROP COLUMN "must_change_password",
DROP COLUMN "password_changed_at",
DROP COLUMN "role",
DROP COLUMN "suspended_at",
DROP COLUMN "suspended_by",
DROP COLUMN "suspension_reason",
DROP COLUMN "transaction_pin_failed_attempts",
DROP COLUMN "transaction_pin_hash",
DROP COLUMN "transaction_pin_locked_until",
DROP COLUMN "transaction_pin_set_at",
DROP COLUMN "transaction_pin_updated_at",
ALTER COLUMN "password_hash" SET DATA TYPE TEXT,
ALTER COLUMN "is_email_verified" SET DEFAULT true,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "session_manager" DROP COLUMN "refresh_token_hash",
DROP COLUMN "updated_at",
ALTER COLUMN "refresh_token" SET NOT NULL;

-- DropTable
DROP TABLE "admin_actions";

-- DropTable
DROP TABLE "admin_invites";

-- DropTable
DROP TABLE "bank_accounts";

-- DropTable
DROP TABLE "begs";

-- DropTable
DROP TABLE "categories";

-- DropTable
DROP TABLE "cooldowns";

-- DropTable
DROP TABLE "donations";

-- DropTable
DROP TABLE "donor_ranks";

-- DropTable
DROP TABLE "gratitude_messages";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "operational_events";

-- DropTable
DROP TABLE "reactions";

-- DropTable
DROP TABLE "reports";

-- DropTable
DROP TABLE "saved_cards";

-- DropTable
DROP TABLE "stories";

-- DropTable
DROP TABLE "support_chats";

-- DropTable
DROP TABLE "support_messages";

-- DropTable
DROP TABLE "support_tickets";

-- DropTable
DROP TABLE "user_avatars";

-- DropTable
DROP TABLE "user_profiles";

-- DropTable
DROP TABLE "user_stats";

-- DropTable
DROP TABLE "user_trust";

-- DropTable
DROP TABLE "user_verifications";

-- DropTable
DROP TABLE "withdrawals";

-- DropEnum
DROP TYPE "AdminStaffRole";

-- DropEnum
DROP TYPE "UserRole";
