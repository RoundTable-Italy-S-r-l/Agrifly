-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('ORGANIZATION', 'OPERATOR_PROFILE');

-- CreateTable
CREATE TABLE "response_events" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "requester_org_id" TEXT NOT NULL,
    "requester_user_id" TEXT,
    "request_message_id" TEXT NOT NULL,
    "responder_org_id" TEXT NOT NULL,
    "responder_user_id" TEXT,
    "response_message_id" TEXT NOT NULL,
    "response_seconds" INTEGER NOT NULL,
    "response_minutes" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_metrics" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "avg_response_minutes" DOUBLE PRECISION NOT NULL,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "last_response_at" TIMESTAMP(3),
    "calculation_window_days" INTEGER NOT NULL DEFAULT 90,
    "last_calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "response_events_conversation_id_created_at_idx" ON "response_events"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "response_events_responder_org_id_created_at_idx" ON "response_events"("responder_org_id", "created_at");

-- CreateIndex
CREATE INDEX "response_events_responder_user_id_created_at_idx" ON "response_events"("responder_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "response_metrics_entity_type_entity_id_key" ON "response_metrics"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "response_metrics_entity_type_avg_response_minutes_idx" ON "response_metrics"("entity_type", "avg_response_minutes");

-- AddForeignKey
ALTER TABLE "response_events" ADD CONSTRAINT "response_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_events" ADD CONSTRAINT "response_events_requester_org_id_fkey" FOREIGN KEY ("requester_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_events" ADD CONSTRAINT "response_events_responder_org_id_fkey" FOREIGN KEY ("responder_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

