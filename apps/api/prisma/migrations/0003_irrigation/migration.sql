CREATE TABLE "Irrigation" (
 id SERIAL PRIMARY KEY, "pumpId" TEXT NOT NULL REFERENCES "Pump"(id),
 "zoneId" TEXT NOT NULL REFERENCES "Zone"(id), source TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','DONE')),
 "finishAt" TIMESTAMPTZ
);
CREATE UNIQUE INDEX irrigation_running ON "Irrigation" ("pumpId") WHERE status='RUNNING';
CREATE UNIQUE INDEX irrigation_open ON "Irrigation" ("zoneId") WHERE status IN ('PENDING','RUNNING');
CREATE INDEX irrigation_fifo ON "Irrigation" ("pumpId",status,id);
