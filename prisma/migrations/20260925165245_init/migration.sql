-- CreateTable
CREATE TABLE "LearningLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "minutes" INTEGER,
    "note" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "articleSlug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InterviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleTitle" TEXT NOT NULL,
    "companyLabel" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "prepMethod" TEXT,
    "questions" TEXT,
    "lessons" TEXT,
    "improvements" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "LearningLog_date_idx" ON "LearningLog"("date");

-- CreateIndex
CREATE INDEX "LearningLog_area_idx" ON "LearningLog"("area");
