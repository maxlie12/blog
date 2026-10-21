-- Learner submissions are private by default. Existing rows remain Studio-only through route
-- authorization and have no learner owner until the owner assigns/migrates them deliberately.
ALTER TABLE "Attempt" ADD COLUMN "learnerId" TEXT;
ALTER TABLE "Attempt" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Attempt_learnerId_idx" ON "Attempt"("learnerId");
