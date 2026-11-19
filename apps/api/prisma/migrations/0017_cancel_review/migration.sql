ALTER TABLE "Preorder" ADD COLUMN "cancelDecision" text CHECK ("cancelDecision" IN ('APPROVED','DECLINED'));
