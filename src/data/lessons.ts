// Sample lesson content — realistic placeholders, not real English-assessment material.
// Editable here without touching any component code. See docs/CONTENT-GUIDE.md.
export type SkillId = "writing" | "listening" | "speaking" | "reading";

export interface Skill {
  id: SkillId;
  label: string;
  description: string;
}

export const skills: Skill[] = [
  { id: "writing", label: "Writing", description: "Short, structured writing practice." },
  { id: "listening", label: "Listening", description: "Listen and check comprehension." },
  { id: "speaking", label: "Speaking", description: "Record and review short spoken answers." },
  { id: "reading", label: "Reading", description: "Read and summarize short texts." },
];

export interface Lesson {
  id: string;
  skill: SkillId;
  title: string;
  level: string; // CEFR-style label for this lesson, e.g. "B1+"
  minutes: number;
  summary: string;
  prompt: string; // the instruction shown on the lesson detail screen
  sample: string; // sample content/model answer the learner can compare against
}

export const lessons: Lesson[] = [
  {
    id: "speaking-interview-intro",
    skill: "speaking",
    title: "Interview: Tell me about yourself",
    level: "B1+",
    minutes: 10,
    summary: "Learn how to introduce yourself naturally in a job interview, with useful phrases and sample answers.",
    prompt:
      "Record a 60-90 second self-introduction for a frontend developer interview. Cover: your background, what you focus on now, and one project you're proud of.",
    sample:
      "\"I'm a frontend developer with a few years of experience building with React and TypeScript. Recently I've been focused on performance and accessibility — for example, on a personal project called Atlas, I rebuilt the data layer to cut load time significantly. I'm looking for a team where I can keep growing on both the engineering and the product side.\"",
  },
  {
    id: "listening-standup",
    skill: "listening",
    title: "Listening: Team stand-up",
    level: "B1-B2",
    minutes: 8,
    summary: "Listen to a short team stand-up and answer comprehension questions.",
    prompt:
      "Listen to (imagine) a 2-minute team stand-up where a teammate describes a blocked ticket. Note: what is blocked, who owns the next step, and by when.",
    sample:
      "Model notes: \"Blocked: API rate-limit issue on the search endpoint. Owner: backend team (Mai). Next step: Mai will confirm a fix by Thursday; frontend will retry integration once confirmed.\"",
  },
  {
    id: "reading-ai-article",
    skill: "reading",
    title: "Reading: Tech article",
    level: "B2",
    minutes: 12,
    summary: "Read a short article about AI in daily life and practice summarizing the key points.",
    prompt:
      "Read a short article about how AI coding assistants change day-to-day engineering work. Write a 3-sentence summary of the main argument.",
    sample:
      "Model summary: \"AI coding assistants speed up repetitive work like boilerplate and refactors, but they shift more of the engineer's time toward reviewing, testing, and system design. The article argues this raises the value of judgment and communication skills relative to raw typing speed. It cautions that over-reliance without review can quietly introduce bugs.\"",
  },
  {
    id: "writing-day-in-my-life",
    skill: "writing",
    title: "Writing: A day in my life",
    level: "B1+",
    minutes: 10,
    summary: "Write a short paragraph about your daily routine and get suggestions for natural phrases.",
    prompt: "Write 120-150 words describing a typical workday, from morning to evening.",
    sample:
      "\"I usually start my day by checking overnight build failures before anything else. After coffee, I block off my sharpest hours for the hardest problem I'm facing that week — right now that's a caching bug in Atlas. Afternoons are for reviews, meetings, and smaller fixes. In the evening I try to spend 20-30 minutes on English practice, usually reading or shadowing a short audio clip, before winding down.\"",
  },
  {
    id: "writing-reflection",
    skill: "writing",
    title: "Writing: Reflect on a recent challenge",
    level: "B2",
    minutes: 10,
    summary: "Write a 150-word reflection about a recent challenge and how you handled it.",
    prompt: "Write about a recent technical or communication challenge: what happened, what you tried, and what you'd do differently.",
    sample:
      "\"Last month a migration I ran silently corrupted a handful of records because I didn't add a dry-run step first. I caught it during manual QA, but it cost half a day to fix properly. Next time, I'll always write a reversible dry-run mode before touching production data, and I'll ask a teammate to review the migration plan, not just the code.\"",
  },
  {
    id: "speaking-daily-standup",
    skill: "speaking",
    title: "Speaking: Record a 1-minute self-introduction",
    level: "B1-B2",
    minutes: 6,
    summary: "Record a 1-minute self-introduction and review it for clarity and pacing.",
    prompt: "Record yourself introducing your current project (Atlas) to a new teammate in under 60 seconds.",
    sample:
      "\"Atlas is a personal project I'm building to organize what I'm learning and shipping. It started as a simple notes app and has grown into something closer to a personal knowledge system. The main technical challenge right now is search — making it fast and relevant without over-engineering it.\"",
  },
];

export function lessonsBySkill(skill: SkillId | "all"): Lesson[] {
  if (skill === "all") return lessons;
  return lessons.filter((l) => l.skill === skill);
}

export function getLessonById(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}
