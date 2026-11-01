"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { getLanguageLabel } from "@/lib/languages";
import { getLocalCompletedLessonIds } from "@/lib/localLearningProgress";
import { addPathMark, pathSteps, readKnownWords, readPathMarks, todaySteps, type PathStepId, type PathTopic, type TodayLesson } from "@/lib/studyPath";
import type { SkillId } from "@/lib/lessonTypes";

const WINDING = [0, 3.5, 5, 3.5, 0, -3.5, -5, -3.5];

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const CHECK = <Icon><path d="m5 12 5 5 9-10" /></Icon>;
const BOOK = <Icon><path d="M12 6c-2-1.5-5-2-8-2v15c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2Z" /><path d="M12 6v15" /></Icon>;
const MIC = <Icon><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></Icon>;
const PENCIL = <Icon><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13 7 4 4" /></Icon>;
const HEADPHONES = <Icon><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="7" rx="2" /><rect x="17" y="14" width="4" height="7" rx="2" /></Icon>;

const STEPS: Record<PathStepId, { label: string; icon: ReactNode }> = {
  read: { label: "Đọc bài", icon: BOOK },
  words: { label: "Từ mới", icon: <Icon><rect x="4" y="7" width="13" height="13" rx="2" /><path d="M8 3h10a2 2 0 0 1 2 2v10" /></Icon> },
  speak: { label: "Đọc to", icon: MIC },
  lesson: { label: "Bài luyện", icon: PENCIL },
};

const SKILLS: Record<SkillId, { label: string; icon: ReactNode }> = {
  listening: { label: "Nghe", icon: HEADPHONES },
  reading: { label: "Đọc", icon: BOOK },
  speaking: { label: "Nói", icon: MIC },
  writing: { label: "Viết", icon: PENCIL },
};

// Stages are short, so alternate sides to keep the line winding both ways.
const winding = (index: number, side = 1) => ({ "--path-x": side * WINDING[index % WINDING.length] }) as CSSProperties;

function stepHref(topic: PathTopic, id: PathStepId): string {
  if (id === "read") return `/blog/${topic.slug}`;
  if (id === "lesson") return `/learning/${topic.lessonId}`;
  return `/learning/practice?topic=${topic.slug}${id === "speak" ? "&mode=read" : ""}`;
}

function PathNode({ href, icon, label, state, done, next, ariaLabel, onClick }: {
  href: string;
  icon: ReactNode;
  label: string;
  state: string;
  done: boolean;
  next: boolean;
  ariaLabel?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      className={`path-node${done ? " path-node--done" : ""}${next ? " path-node--next" : ""}`}
      aria-current={next ? "step" : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className="path-node__circle">{done ? CHECK : icon}</span>
      <span className="path-node__label">{label}</span>
      <span className="path-node__state">{state}</span>
    </Link>
  );
}

/** Today's lessons, then stages from study articles. Nothing is locked; marks are habit data on this device. */
export function LearningPath({ topics, today }: { topics: PathTopic[]; today: { date: string; title: string; lessons: TodayLesson[] } | null }) {
  const [progress, setProgress] = useState<{ known: string[]; marks: string[]; completed: Set<string> } | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    const refresh = () => setProgress({ known: readKnownWords(), marks: readPathMarks(), completed: getLocalCompletedLessonIds() });
    refresh();
    window.addEventListener("learning-progress-changed", refresh);
    return () => window.removeEventListener("learning-progress-changed", refresh);
  }, []);

  const completed = progress?.completed ?? new Set<string>();
  const units = topics.map((topic) => ({ topic, steps: pathSteps(topic, progress?.known ?? [], progress?.marks ?? [], completed) }));
  const lessons = today ? todaySteps(today.lessons, completed) : [];
  const nextLesson = progress ? lessons.find((lesson) => !lesson.done && !lesson.optional) : undefined;
  const nextUnit = progress && !nextLesson ? units.find((unit) => unit.steps.some((step) => !step.done)) : undefined;
  const nextStep = nextUnit?.steps.find((step) => !step.done);

  useEffect(() => {
    if (!progress || scrolled.current) return;
    scrolled.current = true;
    document.querySelector(".path-node--next")?.scrollIntoView({ block: "center" });
  }, [progress]);

  return (
    <div className="learning-path">
      {today && lessons.length > 0 && (
        <section aria-labelledby="stage-today">
          <header className="path-stage path-stage--today">
            <p>Hôm nay · {today.date}</p>
            <h2 id="stage-today">{today.title}</h2>
          </header>
          <ol className="path-steps">
            {lessons.map((lesson, index) => {
              const next = nextLesson?.id === lesson.id;
              const state = lesson.done ? "Đã xong" : next ? "Tiếp theo" : lesson.optional ? "Tùy chọn" : "Nhiệm vụ chính";
              const label = `${SKILLS[lesson.skill].label} · ${getLanguageLabel(lesson.language, true)}`;
              return (
                <li key={lesson.id} style={winding(index)}>
                  <PathNode
                    href={`/learning/${lesson.id}`}
                    icon={SKILLS[lesson.skill].icon}
                    label={label}
                    state={state}
                    done={lesson.done}
                    next={next}
                    ariaLabel={`${label}, ${state}: ${lesson.title}`}
                  />
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {units.map(({ topic, steps }, unitIndex) => {
        const finished = steps.every((step) => step.done);
        return (
          <section key={topic.slug} aria-labelledby={`stage-${topic.slug}`}>
            <header className="path-stage">
              <p>Chặng {unitIndex + 1}</p>
              <h2 id={`stage-${topic.slug}`} lang="en">{topic.title}</h2>
            </header>
            <ol className="path-steps">
              {steps.map((step, index) => {
                const next = nextUnit?.topic.slug === topic.slug && nextStep?.id === step.id;
                return (
                  <li key={step.id} style={winding(index, unitIndex % 2 ? 1 : -1)}>
                    <PathNode
                      href={stepHref(topic, step.id)}
                      icon={STEPS[step.id].icon}
                      label={STEPS[step.id].label}
                      state={step.done ? "Đã xong" : next ? "Tiếp theo" : "Chưa làm"}
                      done={step.done}
                      next={next}
                      onClick={step.id === "read" ? () => addPathMark(topic.slug, "read") : undefined}
                    />
                  </li>
                );
              })}
              <li style={winding(steps.length, unitIndex % 2 ? 1 : -1)}>
                <div className={`path-node path-node--marker${finished ? " path-node--done" : ""}`}>
                  <span className="path-node__circle"><Icon><path d="M6 21V4" /><path d="M6 4h12l-3 4 3 4H6" /></Icon></span>
                  <span className="path-node__label">Xong chặng {unitIndex + 1}</span>
                  <span className="path-node__state">{finished ? "Đã đủ các bước" : `${steps.filter((step) => step.done).length}/${steps.length} bước`}</span>
                </div>
              </li>
            </ol>
          </section>
        );
      })}
    </div>
  );
}
