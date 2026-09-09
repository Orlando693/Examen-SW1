CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" UUID,
    "revision" INTEGER NOT NULL,
    "storageVersion" INTEGER NOT NULL DEFAULT 0,
    "documentSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "model" JSONB NOT NULL,
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
