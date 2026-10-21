"use client";

import { LANGUAGES, getLanguageLevels, type LanguageId } from "@/lib/languages";
import Link from "next/link";
import { useMemo } from "react";
import { SKILLS, type SkillId, type LessonSummary } from "@/lib/lessonTypes";
import { useLessonFilter, type ReviewFilter } from "@/lib/lessonFilter";
import { lessonLevel, levelRank, lessonRank } from "@/lib/lessonLevels";

const SKILL_ICON: Record<SkillId, string> = {
  writing: "✎",
  listening: "◐",
  speaking: "◔",
  reading: "▤",
};

/** Selecting a skill card filters the lesson list — state lives in LessonFilterProvider so
 * these two components can sit in different layout regions (e.g. separate grid columns on
 * the homepage) while staying in sync. Lessons/progress come from the database via props,
 * not a static import — see src/lib/lessonsData.ts. */
export function SkillCards({
  lessons,
}: {
  lessons: LessonSummary[];
}) {
  const { filter, setFilter, language, level } = useLessonFilter();

  return (
    <div className="skill-cards" role="group" aria-label="Filter lessons by skill">
      {SKILLS.map((skill) => {
        const selected = lessons.filter((l) => l.language === language && l.skill === skill.id && (level === "all" || lessonLevel(l.level, l.language) === level));
        const total = selected.length;
        const completed = selected.filter((l) => l.reviewedCount > 0).length;
        const active = filter === skill.id;
        return (
          <button
            key={skill.id}
            type="button"
            className="skill-card"
            data-active={active || undefined}
            aria-pressed={active}
            onClick={() => setFilter(active ? "all" : skill.id)}
          >
            <span className="skill-card__icon" aria-hidden="true">
              {SKILL_ICON[skill.id]}
            </span>
            <span className="skill-card__body">
              <span className="skill-card__title-row">
                <span className="skill-card__title">{skill.label}</span>
                <span className="skill-card__count">
                  {completed}/{total}
                </span>
              </span>
              <span className="skill-card__progress" aria-hidden="true">
                <span
                  className="skill-card__progress-fill"
                  style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
                />
              </span>
              <span className="skill-card__desc">{skill.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LessonPicker({
  lessons,
  compact = false,
}: {
  lessons: LessonSummary[];
  compact?: boolean;
}) {
  const { filter, setFilter, language, setLanguage, level, setLevel, query, setQuery, review, setReview } = useLessonFilter();
  const visible = useMemo(
    () => lessons.filter((l) => l.language === language && (filter === "all" || l.skill === filter) && (level === "all" || lessonLevel(l.level, l.language) === level) && (review === "all" || (review === "reviewed" ? l.reviewedCount > 0 : review === "pending" ? l.attemptCount > 0 && l.reviewedCount === 0 : l.reviewedCount === 0)) && (l.title + " " + l.instructions).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => levelRank(a.level, a.language) - levelRank(b.level, b.language) || lessonRank(a.skill) - lessonRank(b.skill)),
    [lessons, filter, language, level, query, review]
  );

  return (
    <div className="lesson-picker">
      {!compact && (
        <div className="lesson-picker__header">
          <h2>Choose a lesson</h2>
          <p>Practice with real-world content, step by step.</p>
        </div>
      )}

      <label className="field">
        <span>Ngôn ngữ</span>
        <select value={language} onChange={(e) => setLanguage(e.target.value as LanguageId)}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>

      <label className="field"><span>Cấp độ bài học</span>
        <select value={level} onChange={e => setLevel(e.target.value)}>
          <option value="all">Tất cả cấp độ</option>
          {getLanguageLevels(language).filter(v => lessons.some(l => l.language === language && lessonLevel(l.level, l.language) === v)).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="field"><span>Tìm bài</span><input type="search" placeholder="Chủ đề hoặc tên bài…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="field"><span>Trạng thái review trên server</span>
        <select value={review} onChange={e => setReview(e.target.value as ReviewFilter)}>
          <option value="all">Tất cả</option><option value="unreviewed">Chưa được review</option><option value="pending">Đã nộp, chưa review</option><option value="reviewed">Đã review</option>
        </select>
      </label>
      <p>Cấp độ là độ khó của nhiệm vụ; nguồn nghe có thể ở mức khác, ghi trong nhãn bài. Bài tự soạn không phải đề đánh giá CEFR. Bản lưu trên thiết bị chưa nằm trong bộ lọc review.</p>
      <p role="status">{visible.length} bài phù hợp · xếp cấp độ từ dễ đến khó, rồi Nghe → Đọc → Nói → Viết.</p>
      <button type="button" className="button button--ghost" onClick={() => { setLevel("all"); setFilter("all"); setQuery(""); setReview("all"); }}>Xóa bộ lọc</button>
      <div className="lesson-picker__filters" role="group" aria-label="Filter by skill">
        <button
          type="button"
                    aria-pressed={filter === "all"}
          data-active={filter === "all" || undefined}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        {SKILLS.map((skill) => (
          <button
            key={skill.id}
            type="button"
                        aria-pressed={filter === skill.id}
            data-active={filter === skill.id || undefined}
            onClick={() => setFilter(skill.id)}
          >
            {skill.label}
          </button>
        ))}
      </div>

      <ul className="lesson-picker__list">
        {visible.map((lesson) => (
          <li key={lesson.id}>
            <Link href={`/learning/${lesson.id}`} className="lesson-item">
              <span className="lesson-item__icon" aria-hidden="true">
                {SKILL_ICON[lesson.skill]}
              </span>
              <span className="lesson-item__body">
                <span className="lesson-item__title-row">
                  <span className="lesson-item__title">{lesson.title}</span>
                  {lesson.reviewedCount > 0 && (
                    <span className="lesson-item__done" title="Completed">
                      ✓
                    </span>
                  )}
                </span>
                <span className="lesson-item__meta">
                  <span className="tag">{SKILLS.find((s) => s.id === lesson.skill)?.label}</span>
                  <span className="tag tag--level">{lesson.level}</span>
                  {lesson.attemptCount > 0 && (
                    <span className="lesson-item__minutes">
                      {lesson.attemptCount} attempt{lesson.attemptCount === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
                <span className="lesson-item__summary">{lesson.completionCriteria}</span>
              </span>
              <span className="lesson-item__chevron" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="lesson-picker__empty">Không có bài khớp bộ lọc. Thử bỏ cấp độ, từ khóa hoặc trạng thái review.</li>
        )}
      </ul>
    </div>
  );
}
