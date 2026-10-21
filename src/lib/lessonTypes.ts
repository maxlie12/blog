export type SkillId = "writing" | "listening" | "speaking" | "reading";

export const SKILLS: { id: SkillId; label: string; description: string }[] = [
  { id: "writing", label: "Writing", description: "Short, structured writing practice." },
  { id: "listening", label: "Listening", description: "Listen and check comprehension." },
  { id: "speaking", label: "Speaking", description: "Record and review short spoken answers." },
  { id: "reading", label: "Reading", description: "Read and summarize short texts." },
];

export interface LessonSummary {
  id: string;
  skill: SkillId;
  language: string;
  title: string;
  level: string;
  instructions: string;
  material: string | null;
  exercises: string | null;
  completionCriteria: string;
  attemptCount: number;
  reviewedCount: number;
}

export interface AttemptRecord {
  id: string;
  lessonId: string;
  date: string;
  response: string | null;
  feedback: string | null;
  learnerId: string | null;
  isPublic: boolean;
  reviewStatus: string;
  createdAt: string;
}

