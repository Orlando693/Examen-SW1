ALTER TABLE "project_invitations" ADD COLUMN "inviterId" UUID;

UPDATE "project_invitations"
SET "inviterId" = "projects"."ownerId"
FROM "projects"
WHERE "project_invitations"."projectId" = "projects"."id";

ALTER TABLE "project_invitations" ALTER COLUMN "inviterId" SET NOT NULL;

CREATE INDEX "project_invitations_inviterId_idx" ON "project_invitations"("inviterId");

ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
