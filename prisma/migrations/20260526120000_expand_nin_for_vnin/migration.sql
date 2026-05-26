-- Allow storing Virtual NIN (16 chars) as well as standard 11-digit NIN
ALTER TABLE "user_verifications" ALTER COLUMN "nin" TYPE VARCHAR(20);
