CREATE TABLE "SimulatedDay" (
  "zoneId" TEXT NOT NULL REFERENCES "Zone"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  "scenario" TEXT NOT NULL, "simulatedDate" DATE NOT NULL,
  "moisturePct" INTEGER NOT NULL CHECK ("moisturePct" BETWEEN 0 AND 100),
  "needsWater" BOOLEAN NOT NULL,
  PRIMARY KEY ("zoneId","scenario","simulatedDate")
);
