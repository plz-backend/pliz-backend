/*
  Warnings:

  - You are about to drop the column `bvn` on the `user_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `bvn_verified` on the `user_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `bvn_verified_at` on the `user_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `phone_otp_expires_at` on the `user_verifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "begs" ADD COLUMN     "is_anonymous" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_verifications" DROP COLUMN "bvn",
DROP COLUMN "bvn_verified",
DROP COLUMN "bvn_verified_at",
DROP COLUMN "phone_otp_expires_at",
ADD COLUMN     "document_verified_at" TIMESTAMP(6),
ADD COLUMN     "face_liveness_passed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "face_liveness_passed_at" TIMESTAMP(6),
ADD COLUMN     "face_liveness_score" DOUBLE PRECISION,
ADD COLUMN     "face_liveness_url" TEXT,
ADD COLUMN     "nin_enrollment_date" TIMESTAMP(6),
ADD COLUMN     "nin_lga" VARCHAR(100),
ADD COLUMN     "nin_middle_name" VARCHAR(100),
ADD COLUMN     "nin_state_of_origin" VARCHAR(100),
ADD COLUMN     "passport_issue_date" TIMESTAMP(6),
ADD COLUMN     "passport_middle_name" VARCHAR(100),
ADD COLUMN     "passport_place_of_birth" VARCHAR(100),
ADD COLUMN     "passport_place_of_issue" VARCHAR(100),
ADD COLUMN     "phone_otp_sent_at" TIMESTAMP(6),
ADD COLUMN     "phone_verification_channel" VARCHAR(20),
ALTER COLUMN "passport_expiry" SET DATA TYPE TIMESTAMP(6),
ALTER COLUMN "phone_otp" SET DATA TYPE VARCHAR(255);

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

-- CreateIndex
CREATE INDEX "user_verifications_user_id_idx" ON "user_verifications"("user_id");

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
