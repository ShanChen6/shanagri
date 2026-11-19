ALTER TABLE "Preorder" DROP CONSTRAINT "Preorder_status_check",
 ADD CONSTRAINT "Preorder_status_check" CHECK(status IN ('HOLD','EXPIRED','PENDING','CONFIRMED','CANCELLED')),
 ADD COLUMN "expiresAt" timestamptz, ADD COLUMN "phoneHash" text,
 ADD COLUMN "otpHash" text, ADD COLUMN attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN "sentAt" timestamptz, ADD COLUMN sends integer NOT NULL DEFAULT 0,
 ADD COLUMN "cancelRequested" boolean NOT NULL DEFAULT false;
CREATE INDEX hold_expiry ON "Preorder"(status,"expiresAt");
CREATE INDEX phone_orders ON "Preorder"("phoneHash","createdAt");
