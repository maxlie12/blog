"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { getLanguageLabel } from "@/lib/languages";
import { getLocalCompletedLessonIds, getLocalDueReviews } from "@/lib/localLearningProgress";
import { addPathMark, pathSteps, readKnownWords, readPathMarks, todaySteps, type PathStepId, type PathTopic, type TodayLesson } from "@/lib/studyPath";
import type { SkillId } from "@/lib/lessonTypes";
import type { ScheduledReview } from "@/lib/reviewSchedule";

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

type PathProgress = { known: string[]; marks: string[]; completed: Set<string>; due: ScheduledReview[] };

/** The route on /learning: today, due reviews, blog stages, then finished lessons. Nothing is locked. */
export function LearningPath({ topics, today, lessons }: {
  topics: PathTopic[];
  today: { date: string; title: string; lessons: TodayLesson[] } | null;
  lessons: (TodayLesson & { date: string })[];
}) {
  const [progress, setProgress] = useState<PathProgress | null>(null);

  useEffect(() => {
    const refresh = () => setProgress({ known: readKnownWords(), marks: readPathMarks(), completed: getLocalCompletedLessonIds(), due: getLocalDueReviews() });
    refresh();
    window.addEventListener("learning-progress-changed", refresh);
    return () => window.removeEventListener("learning-progress-changed", refresh);
  }, []);

  const completed = progress?.completed ?? new Set<string>();
  const units = topics.map((topic) => ({ topic, steps: pathSteps(topic, progress?.known ?? [], progress?.marks ?? [], completed) }));
  const todayLessons = today ? todaySteps(today.lessons, completed) : [];
  const reviews = (progress?.due ?? []).flatMap((review) => {
    const lesson = lessons.find((item) => item.id === review.lessonId);
    return lesson ? [{ review, lesson }] : [];
  });
  const finished = lessons.filter((lesson) => completed.has(lesson.id));
  const nextLesson = progress ? todayLessons.find((lesson) => !lesson.done && !lesson.optional) : undefined;
  const mainDone = todayLessons.some((lesson) => !lesson.optional) && !nextLesson;
  const nextReview = progress && !nextLesson ? reviews[0] : undefined;
  const nextUnit = progress && !nextLesson && !nextReview ? units.find((unit) => unit.steps.some((step) => !step.done)) : undefined;
  const nextStep = nextUnit?.steps.find((step) => !step.done);

  return (
    <section id="learning-path" className="learning-path" aria-labelledby="learning-path-title">
      <header className="learning-path__header">
        <h2 id="learning-path-title">Lộ trình học</h2>
        <p>Bước nào cũng mở sẵn. Đây là dấu thói quen trên thiết bị này, không phải trình độ.</p>
      </header>

      {today && todayLessons.length > 0 && (
        <section aria-labelledby="stage-today">
          <header className="path-stage path-stage--today">
            <p>Hôm nay · {today.date}</p>
            <h3 id="stage-today">{today.title}</h3>
          </header>
          <ol className="path-steps">
            {todayLessons.map((lesson, index) => {
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
          {mainDone && <p className="path-note" role="status">Xong nhiệm vụ chính hôm nay. Bạn có thể dừng ở đây, làm bài tùy chọn hoặc đi tiếp bước kế bên dưới.</p>}
        </section>
      )}

      {reviews.length > 0 && (
        <section aria-labelledby="stage-reviews">
          <header className="path-stage path-stage--today">
            <p>Ôn lại</p>
            <h3 id="stage-reviews">{reviews.length} bài đến hạn ôn</h3>
          </header>
          <ol className="path-steps">
            {reviews.map(({ review, lesson }, index) => {
              const next = nextReview?.review === review;
              const label = `Ôn · ${getLanguageLabel(lesson.language, true)}`;
              const state = next ? "Tiếp theo" : `Sau ${review.interval} ngày`;
              return (
                <li key={review.lessonId} style={winding(index, -1)}>
                  <PathNode
                    href={`/learning/${lesson.id}`}
                    icon={SKILLS[lesson.skill].icon}
                    label={label}
                    state={state}
                    done={false}
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
        const stageDone = steps.every((step) => step.done);
        const side = unitIndex % 2 ? 1 : -1;
        return (
          <section key={topic.slug} aria-labelledby={`stage-${topic.slug}`}>
            <header className="path-stage">
              <p>Chặng {unitIndex + 1}</p>
              <h3 id={`stage-${topic.slug}`} lang="en">{topic.title}</h3>
            </header>
            <ol className="path-steps">
              {steps.map((step, index) => {
                const next = nextUnit?.topic.slug === topic.slug && nextStep?.id === step.id;
                return (
                  <li key={step.id} style={winding(index, side)}>
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
              <li style={winding(steps.length, side)}>
                <div className={`path-node path-node--marker${stageDone ? " path-node--done" : ""}`}>
                  <span className="path-node__circle"><Icon><path d="M6 21V4" /><path d="M6 4h12l-3 4 3 4H6" /></Icon></span>
                  <span className="path-node__label">Xong chặng {unitIndex + 1}</span>
                  <span className="path-node__state">{stageDone ? "Đã đủ các bước" : `${steps.filter((step) => step.done).length}/${steps.length} bước`}</span>
                </div>
              </li>
            </ol>
          </section>
        );
      })}

      {finished.length > 0 && (
        <details className="path-finished">
          <summary>Bài đã xong · {finished.length}</summary>
          <ul>
            {finished.map((lesson) => (
              <li key={lesson.id}>
                <Link href={`/learning/${lesson.id}`}>
                  <span>{lesson.title}</span>
                  <small>{lesson.date}</small>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
