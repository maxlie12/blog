"use client";

import { useSyncExternalStore } from "react";
import { getLearnerProfile, LEARNER_PROFILES } from "./learnerProfiles";

const subscribe = () => () => {};

export function useLearnerProfile() {
  return useSyncExternalStore(subscribe, getLearnerProfile, () => LEARNER_PROFILES[0]);
}
