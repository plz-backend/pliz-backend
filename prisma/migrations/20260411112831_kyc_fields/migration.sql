/*
  Warnings:

  - You are about to drop the column `address_proof_url` on the `user_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `address_verified` on the `user_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `id_document_number` on the `user_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `id_document_type` on the `user_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `id_document_url` on the `user_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `selfie_url` on the `user_verifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_verifications" DROP COLUMN "address_proof_url",
DROP COLUMN "address_verified",
DROP COLUMN "id_document_number",
DROP COLUMN "id_document_type",
DROP COLUMN "id_document_url",
DROP COLUMN "selfie_url",
ADD COLUMN     "attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bvn" VARCHAR(11),
ADD COLUMN     "bvn_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bvn_verified_at" TIMESTAMP(6),
ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_attempt_at" TIMESTAMP(6),
ADD COLUMN     "nin" VARCHAR(11),
ADD COLUMN     "nin_back_url" TEXT,
ADD COLUMN     "nin_document_type" VARCHAR(10),
ADD COLUMN     "nin_front_url" TEXT,
ADD COLUMN     "nin_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nin_verified_at" TIMESTAMP(6),
ADD COLUMN     "passport_biodata_url" TEXT,
ADD COLUMN     "passport_expiry" DATE,
ADD COLUMN     "passport_number" VARCHAR(20),
ADD COLUMN     "passport_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passport_verified_at" TIMESTAMP(6),
ADD COLUMN     "phone_otp" VARCHAR(6),
ADD COLUMN     "phone_otp_expires_at" TIMESTAMP(6),
ADD COLUMN     "phone_verified_at" TIMESTAMP(6),
ADD COLUMN     "provider_reference" VARCHAR(255),
ADD COLUMN     "provider_response" JSONB,
ADD COLUMN     "rejected_at" TIMESTAMP(6),
ADD COLUMN     "rejected_by" UUID,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
ADD COLUMN     "verification_type" VARCHAR(20);

-- CreateIndex
CREATE INDEX "user_verifications_status_idx" ON "user_verifications"("status");

-- CreateIndex
CREATE INDEX "user_verifications_is_verified_idx" ON "user_verifications"("is_verified");

-- CreateIndex
CREATE INDEX "user_verifications_verification_type_idx" ON "user_verifications"("verification_type");
