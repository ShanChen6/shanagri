ALTER TABLE "Offer" ADD COLUMN "harvestDate" date, ADD COLUMN "actualKg" integer,
ADD CONSTRAINT harvest_closed CHECK (("harvestDate" IS NULL AND "actualKg" IS NULL) OR
 ("harvestDate" IS NOT NULL AND "actualKg" IS NOT NULL AND "actualKg">=0 AND NOT open));
