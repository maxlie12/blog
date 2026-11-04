"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DailyPacket } from "@/lib/dailyLessons";
import { getLanguageLabel } from "@/lib/languages";
import { getLocalCompletedLessonIds } from "@/lib/localLearningProgress";
import { chooseDailyDate, hasLessonDraft, localLessonStatus } from "@/lib/localLessonState";
import { orderPractice } from "@/lib/practiceOrder";
import { SKILLS } from "@/lib/lessonTypes";

const labels = { new: "Chưa học", draft: "Đang học · có bản nháp", done: "Đã Done · tự báo" };

export function DailyLessonLibrary({ packets, initialDate }: { packets: DailyPacket[]; initialDate?: string }) {
  const [view, setView] = useState<"date" | "lesson">("date");
  const [date, setDate] = useState(initialDate ?? "");
  const [language, setLanguage] = useState("");
  const [skill, setSkill] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<{ completed: Set<string>; drafts: Set<string> } | null>(null);
  const all = [...packets].reverse().flatMap(packet => orderPractice(packet.lessons).map(lesson => ({ ...lesson, date: packet.date })));

  useEffect(() => {
    const refresh = () => {
      const completed = getLocalCompletedLessonIds();
      const drafts = new Set(packets.flatMap(p => p.lessons).filter(l => hasLessonDraft(l.id)).map(l => l.id));
      setProgress({ completed, drafts });
      setDate(current => current || chooseDailyDate(packets, completed, drafts));
    };
    refresh();
    window.addEventListener("learning-progress-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("learning-progress-changed", refresh); window.removeEventListener("storage", refresh); };
  }, [packets]);

  const packet = packets.find(p => p.date === date);
  const visible = all.filter(l => (view !== "date" || l.date === date) && (!language || l.language === language) && (!skill || l.skill === skill) &&
    (!status || (progress && localLessonStatus(l.id, progress.completed, progress.drafts) === status)));

  return <section aria-labelledby="daily-library-title">
    <h2 id="daily-library-title">Chọn bài Daily</h2>
    <p>Không cần làm bù mọi ngày. Chọn một bài phù hợp rồi học lúc rảnh. Done và bản nháp dưới đây lưu trên trình duyệt này, không phải điểm trình độ.</p>
    <div className="lesson-detail__actions" role="group" aria-label="Cách xem bài Daily">
      <button className="button button--ghost" aria-pressed={view === "date"} onClick={() => setView("date")}>Theo ngày</button>
      <button className="button button--ghost" aria-pressed={view === "lesson"} onClick={() => setView("lesson")}>Từng bài học</button>
    </div>
    <div className="daily-lessons-grid">
      {view === "date" && <label>Ngày của gói bài <select value={date} onChange={e => setDate(e.target.value)}>
        {!date && <option value="">Đang chọn ngày…</option>}
        {[...packets].reverse().map(p => <option key={p.date} value={p.date}>{p.date} · {p.title}</option>)}
      </select></label>}
      <label>Ngôn ngữ <select value={language} onChange={e => setLanguage(e.target.value)}><option value="">Tất cả ngôn ngữ</option>
        {[...new Set(all.map(l => l.language))].map(id => <option key={id} value={id}>{getLanguageLabel(id, true)}</option>)}
      </select></label>
      <label>Kỹ năng <select value={skill} onChange={e => setSkill(e.target.value)}><option value="">Tất cả kỹ năng</option>{SKILLS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label>Trạng thái <select disabled={!progress} value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    {!progress && <p role="status">Đang đọc bản nháp và Done trên thiết bị…</p>}
    {view === "date" && packet && <header className="lesson-detail__section"><span className="tag">Gói {packet.date}</span><h3>{packet.title}</h3><p>{packet.note}</p></header>}
    <p aria-live="polite">{visible.length} bài phù hợp.</p>
    <div className="daily-lessons-grid">{visible.map(lesson => {
      const state = progress ? localLessonStatus(lesson.id, progress.completed, progress.drafts) : null;
      let source = "Nhiệm vụ tại Learning";
      if (lesson.material?.startsWith("/blog/")) source = "Blog bổ trợ";
      else if (lesson.material?.startsWith("https://")) { try { source = new URL(lesson.material).hostname; } catch { source = "Nguồn bài học"; } }
      return <section key={lesson.id} className="lesson-detail__section">
        <p className="tag">{getLanguageLabel(lesson.language, true)} · {SKILLS.find(s => s.id === lesson.skill)?.label} · {lesson.level}</p>
        <h3>{lesson.title}</h3>
        <p>Daily <time dateTime={lesson.date}>{lesson.date}</time> · Phiên 5–10 phút<br/>Nguồn: {source}</p>
        <p><strong>{state ? labels[state] : "Đang đọc trạng thái…"}</strong></p>
        <p>{lesson.exercises}</p>
        {lesson.takeaway && <p><strong>Giữ lại và dùng lại:</strong> {lesson.takeaway.pattern}</p>}
        <Link className="button" href={`/learning/${lesson.id}`}>{state === "done" ? "Mở lại và ôn" : state === "draft" ? "Tiếp tục bài này" : "Bắt đầu bài này"} →</Link>
        {lesson.material?.startsWith("/blog/") && <p><Link href={lesson.material}>Đọc blog bổ trợ ↗</Link> · Bài luyện vẫn làm tại Learning.</p>}
      </section>;
    })}</div>
    {progress && visible.length === 0 && <p>Không có bài khớp bộ lọc. Hãy đổi ngày, ngôn ngữ, kỹ năng hoặc trạng thái.</p>}
  </section>;
}
