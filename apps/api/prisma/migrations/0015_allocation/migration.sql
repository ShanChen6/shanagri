ALTER TABLE "Offer" ADD COLUMN "allocatedAt" timestamptz;
ALTER TABLE "Preorder" ADD COLUMN "allocatedKg" integer CHECK ("allocatedKg" BETWEEN 0 AND kg);
