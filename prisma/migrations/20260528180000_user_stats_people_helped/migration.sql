-- Precomputed donor impact stats (avoid scanning donations on GET /me).

ALTER TABLE "user_stats"
  ADD COLUMN IF NOT EXISTS "people_helped" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "people_helped_this_week" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "people_helped_week_anchor" TIMESTAMP(6);

-- Backfill lifetime people helped (unique recipients per donor).
UPDATE "user_stats" us
SET "people_helped" = COALESCE(sub.c, 0)
FROM (
  SELECT d."donor_id" AS donor_id, COUNT(DISTINCT b."user_id")::INTEGER AS c
  FROM "donations" d
  INNER JOIN "begs" b ON b."id" = d."request_id"
  WHERE d."status" = 'success' AND d."donor_id" IS NOT NULL
  GROUP BY d."donor_id"
) sub
WHERE us."user_id" = sub.donor_id;

-- Backfill weekly people helped (rolling 7 days).
UPDATE "user_stats" us
SET
  "people_helped_this_week" = COALESCE(sub.c, 0),
  "people_helped_week_anchor" = NOW()
FROM (
  SELECT d."donor_id" AS donor_id, COUNT(DISTINCT b."user_id")::INTEGER AS c
  FROM "donations" d
  INNER JOIN "begs" b ON b."id" = d."request_id"
  WHERE d."status" = 'success'
    AND d."donor_id" IS NOT NULL
    AND d."created_at" >= NOW() - INTERVAL '7 days'
  GROUP BY d."donor_id"
) sub
WHERE us."user_id" = sub.donor_id;
