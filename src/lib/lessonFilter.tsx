"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { SkillId } from "@/lib/lessonTypes";

import type { LanguageId } from "@/lib/languages";

type Filter = SkillId | "all";
export type ReviewFilter = "all" | "unreviewed" | "pending" | "reviewed";

const LessonFilterContext = createContext<{ filter: Filter; setFilter: (f: Filter) => void; language: LanguageId; setLanguage: (l: LanguageId) => void; level: string; setLevel: (l: string) => void; query: string; setQuery: (q: string) => void; review: ReviewFilter; setReview: (r: ReviewFilter) => void } | null>(
  null
);

export function LessonFilterProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<LanguageId>("en");
  const [filter, setFilter] = useState<Filter>("all");
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");
  const [review, setReview] = useState<ReviewFilter>("all");
  function setLanguage(value: LanguageId) { updateLanguage(value); setLevel("all"); }
  return (
    <LessonFilterContext.Provider value={{ filter, setFilter, language, setLanguage, level, setLevel, query, setQuery, review, setReview }}>
      {children}
    </LessonFilterContext.Provider>
  );
}

export function useLessonFilter() {
  const ctx = useContext(LessonFilterContext);
  if (!ctx) throw new Error("useLessonFilter must be used within LessonFilterProvider");
  return ctx;
}
