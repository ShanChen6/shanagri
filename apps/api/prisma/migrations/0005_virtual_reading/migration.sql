CREATE TABLE "VirtualReading" (
 "sampleId" UUID PRIMARY KEY, "zoneId" TEXT NOT NULL REFERENCES "Zone"(id),
 "observedAt" TIMESTAMPTZ NOT NULL, "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "moisturePct" INTEGER NOT NULL CHECK ("moisturePct" BETWEEN 0 AND 100)
);
CREATE INDEX virtual_zone_time ON "VirtualReading" ("zoneId","observedAt");
