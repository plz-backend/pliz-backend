/*
  Warnings:

  - You are about to drop the column `title` on the `begs` table. All the data in the column will be lost.
  - You are about to alter the column `description` on the `begs` table. The data in that column could be lost. The data in that column will be cast from `VarChar(500)` to `VarChar(300)`.
  - A unique constraint covering the columns `[google_id]` on the table `app_users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[apple_id]` on the table `app_users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `city` to the `user_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date_of_birth` to the `user_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `user_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "app_users" ADD COLUMN     "apple_id" VARCHAR(255),
ADD COLUMN     "auth_provider" VARCHAR(20) NOT NULL DEFAULT 'email',
ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "google_id" VARCHAR(255);

-- AlterTable
ALTER TABLE "begs" DROP COLUMN "title",
ADD COLUMN     "expiry_hours" INTEGER NOT NULL DEFAULT 24,
ALTER COLUMN "description" SET DATA TYPE VARCHAR(300);

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "address" VARCHAR(255),
ADD COLUMN     "city" VARCHAR(100) NOT NULL,
ADD COLUMN     "date_of_birth" DATE NOT NULL,
ADD COLUMN     "gender" VARCHAR(10),
ADD COLUMN     "state" VARCHAR(50) NOT NULL;

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

-- CreateIndex
CREATE INDEX "stories_user_id_idx" ON "stories"("user_id");

-- CreateIndex
CREATE INDEX "stories_is_approved_idx" ON "stories"("is_approved");

-- CreateIndex
CREATE INDEX "stories_is_visible_idx" ON "stories"("is_visible");

-- CreateIndex
CREATE INDEX "stories_created_at_idx" ON "stories"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_google_id_key" ON "app_users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_apple_id_key" ON "app_users"("apple_id");

-- CreateIndex
CREATE INDEX "app_users_google_id_idx" ON "app_users"("google_id");

-- CreateIndex
CREATE INDEX "app_users_apple_id_idx" ON "app_users"("apple_id");

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
