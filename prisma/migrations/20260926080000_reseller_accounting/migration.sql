-- AlterEnum
BEGIN;
CREATE TYPE "LedgerType_new" AS ENUM ('EARNING', 'WITHDRAWAL', 'ADJUSTMENT');
ALTER TABLE "SupplierLedger" ALTER COLUMN "type" TYPE "LedgerType_new" USING ("type"::text::"LedgerType_new");
ALTER TYPE "LedgerType" RENAME TO "LedgerType_old";
ALTER TYPE "LedgerType_new" RENAME TO "LedgerType";
DROP TYPE "public"."LedgerType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PayoutStatus_new" AS ENUM ('REQUESTED', 'APPROVED', 'RECEIVED', 'REJECTED');
ALTER TABLE "public"."SupplierPayout" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SupplierPayout" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING ("status"::text::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "public"."PayoutStatus_old";
ALTER TABLE "SupplierPayout" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;

