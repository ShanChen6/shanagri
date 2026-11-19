CREATE TABLE "Batch" (
 id TEXT PRIMARY KEY, "zoneId" TEXT NOT NULL REFERENCES "Zone"(id),
 name TEXT NOT NULL, scenario TEXT NOT NULL, "startDate" DATE NOT NULL,
 "expectedHarvestDate" DATE NOT NULL CHECK ("expectedHarvestDate">="startDate"),
 published BOOLEAN NOT NULL DEFAULT false
);
