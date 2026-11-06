export function parseStudyMusicSettings(raw: string | null) {
  try {
    const saved = JSON.parse(raw ?? "null");
    return {
      mood: saved && Number.isInteger(saved.mood) && saved.mood >= 0 && saved.mood < 3 ? saved.mood as number : 0,
      volume: saved && typeof saved.volume === "number" && Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : .2,
    };
  } catch { return { mood: 0, volume: .2 }; }
}
