-- Remove the INSTRUCTOR role. All staff now share a single ADMIN role
-- (matches the older deployment, which ran an equivalent migration).
-- Backfill existing rows before swapping the enum type (the cast would fail otherwise).
UPDATE "User" SET "role" = 'ADMIN' WHERE "role" = 'INSTRUCTOR';

BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'MEMBER', 'AUDIENCE');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
COMMIT;
