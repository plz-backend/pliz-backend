npm warn Unknown env config "devdir". This will stop working in the next major version of npm.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'superadmin');

-- CreateTable
CREATE TABLE "app_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(6),
    "is_profile_complete" BOOLEAN NOT NULL DEFAULT false,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspension_reason" TEXT,
    "suspended_at" TIMESTAMP(6),
    "suspended_by" UUID,
    "is_under_investigation" BOOLEAN NOT NULL DEFAULT false,
    "investigation_reason" TEXT,
    "investigation_started_at" TIMESTAMP(6),
    "google_id" VARCHAR(255),
    "apple_id" VARCHAR(255),
    "auth_provider" VARCHAR(20) NOT NULL DEFAULT 'email',
    "avatar" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "middle_name" VARCHAR(100),
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(150),
    "phone_number" VARCHAR(20) NOT NULL,
    "gender" VARCHAR(10),
    "date_of_birth" DATE NOT NULL,
    "address" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "agree_to_terms" BOOLEAN NOT NULL DEFAULT false,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_avatars" (
    "user_id" UUID NOT NULL,
    "avatar_type" VARCHAR(20) NOT NULL DEFAULT 'initials',
    "avatar_url" TEXT,
    "avatar_color" VARCHAR(7) DEFAULT '#FF5733',
    "avatar_library_id" VARCHAR(50),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "session_manager" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_active" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "user_agent" TEXT,
    "browser" VARCHAR(50),
    "os" VARCHAR(50),
    "device" VARCHAR(50),
    "ip_address" VARCHAR(45),
    "country" VARCHAR(100),
    "city" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_manager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "begs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "description" VARCHAR(300),
    "amount_requested" DECIMAL(12,2) NOT NULL,
    "amount_raised" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(6),
    "approved_by" UUID,
    "rejected_at" TIMESTAMP(6),
    "rejected_by" UUID,
    "rejection_reason" TEXT,
    "expiry_hours" INTEGER NOT NULL DEFAULT 24,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "payout_requested" BOOLEAN NOT NULL DEFAULT false,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "is_withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "withdrawn_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "media_type" VARCHAR(10) DEFAULT 'text',
    "media_url" TEXT,

    CONSTRAINT "begs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "donor_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "payment_method" VARCHAR(30),
    "payment_reference" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'success',
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" UUID,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID,
    "target_user_id" UUID,
    "request_id" UUID,
    "reason" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gratitude_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donation_id" UUID NOT NULL,
    "message_type" SMALLINT NOT NULL DEFAULT 1,
    "content" TEXT,
    "donor_reply_allowed" BOOLEAN NOT NULL DEFAULT true,
    "donor_replied" BOOLEAN NOT NULL DEFAULT false,
    "donor_reply" TEXT,
    "donor_replied_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gratitude_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "requests_count" INTEGER NOT NULL DEFAULT 0,
    "total_received" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_withdrawn" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "available_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_donated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "abuse_flags" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_trust" (
    "user_id" UUID NOT NULL,
    "trust_tier" SMALLINT NOT NULL DEFAULT 1,
    "last_request_at" TIMESTAMP(6),

    CONSTRAINT "user_trust_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "cooldowns" (
    "user_id" UUID NOT NULL,
    "next_request_allowed_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "cooldowns_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_verifications" (
    "user_id" UUID NOT NULL,
    "verification_type" VARCHAR(20),
    "nin" VARCHAR(11),
    "nin_document_type" VARCHAR(10),
    "nin_middle_name" VARCHAR(100),
    "nin_state_of_origin" VARCHAR(100),
    "nin_lga" VARCHAR(100),
    "nin_enrollment_date" TIMESTAMP(6),
    "nin_front_url" TEXT,
    "nin_back_url" TEXT,
    "nin_verified" BOOLEAN NOT NULL DEFAULT false,
    "nin_verified_at" TIMESTAMP(6),
    "passport_number" VARCHAR(20),
    "passport_middle_name" VARCHAR(100),
    "passport_place_of_birth" VARCHAR(100),
    "passport_issue_date" TIMESTAMP(6),
    "passport_expiry" TIMESTAMP(6),
    "passport_place_of_issue" VARCHAR(100),
    "passport_biodata_url" TEXT,
    "passport_verified" BOOLEAN NOT NULL DEFAULT false,
    "passport_verified_at" TIMESTAMP(6),
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified_at" TIMESTAMP(6),
    "phone_otp" VARCHAR(255),
    "phone_otp_sent_at" TIMESTAMP(6),
    "phone_verification_channel" VARCHAR(20),
    "face_liveness_url" TEXT,
    "face_liveness_passed" BOOLEAN NOT NULL DEFAULT false,
    "face_liveness_passed_at" TIMESTAMP(6),
    "face_liveness_score" DOUBLE PRECISION,
    "document_verified" BOOLEAN NOT NULL DEFAULT false,
    "document_verified_at" TIMESTAMP(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(6),
    "rejection_reason" TEXT,
    "rejected_at" TIMESTAMP(6),
    "rejected_by" UUID,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(6),
    "verification_provider" VARCHAR(100),
    "provider_reference" VARCHAR(255),
    "provider_response" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_verifications_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "donor_ranks" (
    "user_id" UUID NOT NULL,
    "rank_name" VARCHAR(50) NOT NULL DEFAULT 'Tryer',
    "total_donated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "donation_count" INTEGER NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "last_donated_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donor_ranks_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "authorization_code" VARCHAR(255) NOT NULL,
    "card_type" VARCHAR(20) NOT NULL,
    "last4" VARCHAR(4) NOT NULL,
    "exp_month" VARCHAR(2) NOT NULL,
    "exp_year" VARCHAR(4) NOT NULL,
    "bank" VARCHAR(100),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "account_number" VARCHAR(10) NOT NULL,
    "account_name" VARCHAR(255) NOT NULL,
    "bank_code" VARCHAR(10) NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "beg_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "amount_requested" DECIMAL(12,2) NOT NULL,
    "company_fee" DECIMAL(12,2) NOT NULL,
    "vat_fee" DECIMAL(12,2) NOT NULL,
    "total_fees" DECIMAL(12,2) NOT NULL,
    "amount_to_receive" DECIMAL(12,2) NOT NULL,
    "transfer_reference" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "failure_reason" TEXT,
    "auto_processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(6),
    "approved_by" UUID,
    "rejected_at" TIMESTAMP(6),
    "rejected_by" UUID,
    "rejection_reason" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "emoji" VARCHAR(10) NOT NULL,
    "beg_id" UUID,
    "donation_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "ticket_number" VARCHAR(20) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "assigned_to" UUID,
    "resolved_at" TIMESTAMP(6),
    "closed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "sender_id" UUID,
    "sender_type" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_chats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_id" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "ticket_id" UUID,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "support_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_users_email_key" ON "app_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_username_key" ON "app_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_google_id_key" ON "app_users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_apple_id_key" ON "app_users"("apple_id");

-- CreateIndex
CREATE INDEX "app_users_email_idx" ON "app_users"("email");

-- CreateIndex
CREATE INDEX "app_users_username_idx" ON "app_users"("username");

-- CreateIndex
CREATE INDEX "app_users_role_idx" ON "app_users"("role");

-- CreateIndex
CREATE INDEX "app_users_is_suspended_idx" ON "app_users"("is_suspended");

-- CreateIndex
CREATE INDEX "app_users_is_under_investigation_idx" ON "app_users"("is_under_investigation");

-- CreateIndex
CREATE INDEX "app_users_google_id_idx" ON "app_users"("google_id");

-- CreateIndex
CREATE INDEX "app_users_apple_id_idx" ON "app_users"("apple_id");

-- CreateIndex
CREATE INDEX "user_profiles_phone_number_idx" ON "user_profiles"("phone_number");

-- CreateIndex
CREATE INDEX "session_manager_user_id_active_idx" ON "session_manager"("user_id", "active");

-- CreateIndex
CREATE INDEX "session_manager_expires_at_idx" ON "session_manager"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

-- CreateIndex
CREATE INDEX "begs_user_id_idx" ON "begs"("user_id");

-- CreateIndex
CREATE INDEX "begs_category_id_idx" ON "begs"("category_id");

-- CreateIndex
CREATE INDEX "begs_status_idx" ON "begs"("status");

-- CreateIndex
CREATE INDEX "begs_approved_idx" ON "begs"("approved");

-- CreateIndex
CREATE INDEX "begs_expires_at_idx" ON "begs"("expires_at");

-- CreateIndex
CREATE INDEX "begs_is_withdrawn_idx" ON "begs"("is_withdrawn");

-- CreateIndex
CREATE UNIQUE INDEX "donations_payment_reference_key" ON "donations"("payment_reference");

-- CreateIndex
CREATE INDEX "donations_request_id_idx" ON "donations"("request_id");

-- CreateIndex
CREATE INDEX "donations_donor_id_idx" ON "donations"("donor_id");

-- CreateIndex
CREATE INDEX "donations_status_idx" ON "donations"("status");

-- CreateIndex
CREATE INDEX "donations_ip_address_created_at_idx" ON "donations"("ip_address", "created_at");

-- CreateIndex
CREATE INDEX "donations_created_at_idx" ON "donations"("created_at");

-- CreateIndex
CREATE INDEX "admin_actions_admin_id_idx" ON "admin_actions"("admin_id");

-- CreateIndex
CREATE INDEX "admin_actions_action_type_idx" ON "admin_actions"("action_type");

-- CreateIndex
CREATE INDEX "admin_actions_target_type_idx" ON "admin_actions"("target_type");

-- CreateIndex
CREATE INDEX "admin_actions_created_at_idx" ON "admin_actions"("created_at");

-- CreateIndex
CREATE INDEX "reports_reporter_id_idx" ON "reports"("reporter_id");

-- CreateIndex
CREATE INDEX "reports_target_user_id_idx" ON "reports"("target_user_id");

-- CreateIndex
CREATE INDEX "reports_request_id_idx" ON "reports"("request_id");

-- CreateIndex
CREATE INDEX "reports_resolved_idx" ON "reports"("resolved");

-- CreateIndex
CREATE UNIQUE INDEX "gratitude_messages_donation_id_key" ON "gratitude_messages"("donation_id");

-- CreateIndex
CREATE INDEX "gratitude_messages_donation_id_idx" ON "gratitude_messages"("donation_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_stats_user_id_key" ON "user_stats"("user_id");

-- CreateIndex
CREATE INDEX "user_stats_user_id_idx" ON "user_stats"("user_id");

-- CreateIndex
CREATE INDEX "cooldowns_next_request_allowed_at_idx" ON "cooldowns"("next_request_allowed_at");

-- CreateIndex
CREATE INDEX "user_verifications_user_id_idx" ON "user_verifications"("user_id");

-- CreateIndex
CREATE INDEX "user_verifications_status_idx" ON "user_verifications"("status");

-- CreateIndex
CREATE INDEX "user_verifications_is_verified_idx" ON "user_verifications"("is_verified");

-- CreateIndex
CREATE INDEX "user_verifications_verification_type_idx" ON "user_verifications"("verification_type");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "saved_cards_authorization_code_key" ON "saved_cards"("authorization_code");

-- CreateIndex
CREATE INDEX "saved_cards_user_id_idx" ON "saved_cards"("user_id");

-- CreateIndex
CREATE INDEX "saved_cards_is_default_idx" ON "saved_cards"("is_default");

-- CreateIndex
CREATE INDEX "bank_accounts_user_id_idx" ON "bank_accounts"("user_id");

-- CreateIndex
CREATE INDEX "bank_accounts_is_default_idx" ON "bank_accounts"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_user_id_account_number_key" ON "bank_accounts"("user_id", "account_number");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_transfer_reference_key" ON "withdrawals"("transfer_reference");

-- CreateIndex
CREATE INDEX "withdrawals_user_id_idx" ON "withdrawals"("user_id");

-- CreateIndex
CREATE INDEX "withdrawals_beg_id_idx" ON "withdrawals"("beg_id");

-- CreateIndex
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

-- CreateIndex
CREATE INDEX "withdrawals_created_at_idx" ON "withdrawals"("created_at");

-- CreateIndex
CREATE INDEX "stories_user_id_idx" ON "stories"("user_id");

-- CreateIndex
CREATE INDEX "stories_is_approved_idx" ON "stories"("is_approved");

-- CreateIndex
CREATE INDEX "stories_is_visible_idx" ON "stories"("is_visible");

-- CreateIndex
CREATE INDEX "stories_created_at_idx" ON "stories"("created_at");

-- CreateIndex
CREATE INDEX "reactions_beg_id_idx" ON "reactions"("beg_id");

-- CreateIndex
CREATE INDEX "reactions_donation_id_idx" ON "reactions"("donation_id");

-- CreateIndex
CREATE INDEX "reactions_user_id_idx" ON "reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_beg_id_key" ON "reactions"("user_id", "beg_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_donation_id_key" ON "reactions"("user_id", "donation_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets"("user_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_idx" ON "support_tickets"("assigned_to");

-- CreateIndex
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at");

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_idx" ON "support_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "support_messages_sender_id_idx" ON "support_messages"("sender_id");

-- CreateIndex
CREATE INDEX "support_messages_created_at_idx" ON "support_messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_chats_session_id_key" ON "support_chats"("session_id");

-- CreateIndex
CREATE INDEX "support_chats_user_id_idx" ON "support_chats"("user_id");

-- CreateIndex
CREATE INDEX "support_chats_status_idx" ON "support_chats"("status");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_manager" ADD CONSTRAINT "session_manager_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "begs" ADD CONSTRAINT "begs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "begs" ADD CONSTRAINT "begs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "begs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "begs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gratitude_messages" ADD CONSTRAINT "gratitude_messages_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_trust" ADD CONSTRAINT "user_trust_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooldowns" ADD CONSTRAINT "cooldowns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verifications" ADD CONSTRAINT "user_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_ranks" ADD CONSTRAINT "donor_ranks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_beg_id_fkey" FOREIGN KEY ("beg_id") REFERENCES "begs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_beg_id_fkey" FOREIGN KEY ("beg_id") REFERENCES "begs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_chats" ADD CONSTRAINT "support_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Prevent duplicate active withdrawals for the same beg
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawals_active_beg_id_key" ON "withdrawals"("beg_id") WHERE "status" IN ('pending', 'processing', 'completed', 'on_hold');
