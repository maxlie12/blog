"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { SkillId } from "@/lib/lessonTypes";

import type { LanguageId } from "@/lib/languages";

type Filter = SkillId | "all";

const LessonFilterContext = createContext<{ filter: Filter; setFilter: (f: Filter) => void; language: LanguageId; setLanguage: (l: LanguageId) => void } | null>(
  null
);

export function LessonFilterProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageId>("en");
  const [filter, setFilter] = useState<Filter>("all");
  return (
    <LessonFilterContext.Provider value={{ filter, setFilter, language, setLanguage }}>
      {children}
    </LessonFilterContext.Provider>
  );
}

export function useLessonFilter() {
  const ctx = useContext(LessonFilterContext);
  if (!ctx) throw new Error("useLessonFilter must be used within LessonFilterProvider");
  return ctx;
}
