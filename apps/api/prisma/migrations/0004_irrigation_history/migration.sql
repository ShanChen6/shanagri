ALTER TABLE "Pump" ADD COLUMN "flowMlPerSecond" INTEGER NOT NULL DEFAULT 100 CHECK ("flowMlPerSecond">0);
ALTER TABLE "Irrigation" ADD COLUMN "startedAt" TIMESTAMPTZ,
 ADD COLUMN "flowMlPerSecond" INTEGER,
 ADD COLUMN "estimatedMl" BIGINT;
CREATE INDEX irrigation_history ON "Irrigation" ("zoneId",status,"finishAt");
