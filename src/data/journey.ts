// The mountain journey is a self-set, editable milestone map — not a CEFR assessment.
// `currentCheckpointId` is set by hand by the site owner (Luân) and must never be derived
// from lesson-completion counts or streak length. See docs/DECISIONS.md.
export interface JourneyCheckpoint {
  id: string;
  label: string; // CEFR-style label shown on the map, e.g. "B2"
  title: string; // what this stage means in plain language
  optional?: boolean;
}

export const journeyCheckpoints: JourneyCheckpoint[] = [
  { id: "base-camp", label: "B1+", title: "Base camp — comfortable with everyday conversation" },
  { id: "b2", label: "B2", title: "More natural, flexible conversations" },
  { id: "c1", label: "C1", title: "Confident and flexible use" },
  { id: "c2", label: "C2", title: "Optional peak — lifelong learning", optional: true },
];

// Manually set by the site owner. Not computed from any activity data.
export const currentCheckpointId = "base-camp";

export const journeyDisclaimer =
  "This map shows a self-set learning milestone, updated by hand — it is not a certified CEFR result and isn't calculated from streaks or lesson counts.";
