BEGIN;
ALTER TABLE "Offer" ADD COLUMN "totalKg" integer;
UPDATE "Offer" o SET "totalKg" = o."remainingKg" + COALESCE((
  SELECT SUM(p.kg) FROM "Preorder" p WHERE p."batchId" = o."batchId"
    AND p.status IN ('PENDING','CONFIRMED')
),0);
ALTER TABLE "Offer" ALTER COLUMN "totalKg" SET NOT NULL,
  ADD CONSTRAINT offer_capacity_check CHECK ("totalKg" >= "remainingKg");
COMMIT;
