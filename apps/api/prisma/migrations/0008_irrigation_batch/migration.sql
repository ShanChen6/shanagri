ALTER TABLE "Irrigation" ADD COLUMN "batchId" TEXT REFERENCES "Batch"(id) ON DELETE RESTRICT, ADD COLUMN "requestDay" DATE;
CREATE INDEX irrigation_batch_status ON "Irrigation" ("batchId",status);
