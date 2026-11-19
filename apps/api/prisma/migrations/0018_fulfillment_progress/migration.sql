ALTER TABLE "Preorder"
  ADD COLUMN "packedAt" timestamptz,
  ADD COLUMN "deliveredAt" timestamptz,
  ADD CONSTRAINT "preorder_can_be_packed" CHECK (
    "packedAt" IS NULL OR ("allocatedKg" IS NOT NULL AND "allocatedKg" > 0 AND status = 'CONFIRMED')
  ),
  ADD CONSTRAINT "preorder_delivery_after_packing" CHECK (
    "deliveredAt" IS NULL OR ("packedAt" IS NOT NULL AND "deliveredAt" >= "packedAt")
  );
