-- CreateTable
CREATE TABLE "operational_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "event_type" VARCHAR(80) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "request_id" VARCHAR(64),
    "source" VARCHAR(50),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operational_events_user_id_idx" ON "operational_events"("user_id");

-- CreateIndex
CREATE INDEX "operational_events_event_type_idx" ON "operational_events"("event_type");

-- CreateIndex
CREATE INDEX "operational_events_severity_idx" ON "operational_events"("severity");

-- CreateIndex
CREATE INDEX "operational_events_request_id_idx" ON "operational_events"("request_id");

-- CreateIndex
CREATE INDEX "operational_events_created_at_idx" ON "operational_events"("created_at");

-- AddForeignKey
ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
