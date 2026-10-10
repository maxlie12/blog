ALTER TABLE "Lesson" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
CREATE INDEX "Lesson_language_skill_idx" ON "Lesson"("language", "skill");
