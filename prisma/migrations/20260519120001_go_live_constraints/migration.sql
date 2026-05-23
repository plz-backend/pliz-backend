-- Go-live constraints for databases already provisioned via db push.
-- Safe to run on fresh databases (uses IF NOT EXISTS).

CREATE UNIQUE INDEX IF NOT EXISTS "donations_payment_reference_key"
  ON "donations"("payment_reference");

CREATE UNIQUE INDEX IF NOT EXISTS "withdrawals_active_beg_id_key"
  ON "withdrawals"("beg_id")
  WHERE "status" IN ('pending', 'processing', 'completed', 'on_hold');
