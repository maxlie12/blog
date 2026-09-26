"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { SkillId } from "@/data/lessons";

type Filter = SkillId | "all";

const LessonFilterContext = createContext<{ filter: Filter; setFilter: (f: Filter) => void } | null>(
  null
);

export function LessonFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<Filter>("all");
  return (
    <LessonFilterContext.Provider value={{ filter, setFilter }}>
      {children}
    </LessonFilterContext.Provider>
  );
}

export function useLessonFilter() {
  const ctx = useContext(LessonFilterContext);
  if (!ctx) throw new Error("useLessonFilter must be used within LessonFilterProvider");
  return ctx;
}
