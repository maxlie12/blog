export const LEARNER_PROFILES = [
  { id: "luan", name: "Luân", role: "Chủ trang", focus: "English · 中文" },
  { id: "phi", name: "Phi", role: "Người học", focus: "日本語" },
] as const;

export type LearnerProfileId = (typeof LEARNER_PROFILES)[number]["id"];
export type LearnerProfile = (typeof LEARNER_PROFILES)[number];

const ACTIVE_PROFILE_KEY = "learning-active-profile-v1";
const PROFILE_PREFIX = "learning-profile";

export function isLearnerProfileId(value: unknown): value is LearnerProfileId {
  return LEARNER_PROFILES.some((profile) => profile.id === value);
}

export function getActiveLearnerProfileId(): LearnerProfileId {
  try {
    const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return isLearnerProfileId(stored) ? stored : "luan";
  } catch {
    return "luan";
  }
}

export function getLearnerProfile(id = getActiveLearnerProfileId()) {
  return LEARNER_PROFILES.find((profile) => profile.id === id) ?? LEARNER_PROFILES[0];
}

export function setActiveLearnerProfile(id: LearnerProfileId): void {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
}

export function profileStorageKey(baseKey: string, profileId = getActiveLearnerProfileId()): string {
  return `${PROFILE_PREFIX}:${profileId}:${baseKey}`;
}

export function profileStoragePrefix(basePrefix: string, profileId = getActiveLearnerProfileId()): string {
  return profileStorageKey(basePrefix, profileId);
}

export function readProfileStorage(baseKey: string, profileId = getActiveLearnerProfileId()): string | null {
  const scopedKey = profileStorageKey(baseKey, profileId);
  const scoped = localStorage.getItem(scopedKey);
  if (scoped !== null) return scoped;

  // Preserve the original single-profile browser data as Luân's profile.
  if (profileId === "luan") {
    const legacy = localStorage.getItem(baseKey);
    if (legacy !== null) {
      localStorage.setItem(scopedKey, legacy);
      return legacy;
    }
  }
  return null;
}

export function writeProfileStorage(baseKey: string, value: string, profileId = getActiveLearnerProfileId()): void {
  localStorage.setItem(profileStorageKey(baseKey, profileId), value);
}
