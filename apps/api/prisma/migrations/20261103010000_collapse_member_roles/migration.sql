-- Collapse CAPTAIN/PARTICIPANT into a single MEMBER role.
-- Teams are operated by a single member, so the captain/participant split is gone.

-- AlterEnum. Existing CAPTAIN/PARTICIPANT rows are mapped to MEMBER in the cast,
-- so no value is referenced before the new enum type exists.
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'INSTRUCTOR', 'MEMBER', 'AUDIENCE');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE
      WHEN "role"::text IN ('CAPTAIN', 'PARTICIPANT') THEN 'MEMBER'
      ELSE "role"::text
    END
  )::"UserRole_new";
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'INSTRUCTOR';
COMMIT;

-- Team membership no longer distinguishes roles.
ALTER TABLE "TeamMembership" DROP COLUMN "role";

-- DropEnum
DROP TYPE "MemberRole";
