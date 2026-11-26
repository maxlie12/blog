"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LEVELS, emptyLabStore, isComplete, labLessons, nextLabLesson, todayDaily, type DailyLabSummary, type LabLesson, type LabStore,
} from "@/lib/listeningLab";
import { dateInLearningTimezone } from "@/lib/localLearningProgress";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import { AccentPicker, LAB_CHANGED, loadLab, percent } from "./labShared";

const ALL = labLessons();

function useLabStore(): LabStore | null {
  const learner = useLearnerProfile();
  const [store, setStore] = useState<LabStore | null>(null);
  useEffect(() => {
    const read = () => setStore(loadLab());
    read();
    window.addEventListener(LAB_CHANGED, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(LAB_CHANGED, read); window.removeEventListener("storage", read); };
  }, [learner.id]);
  return store;
}

function status(store: LabStore | null, lesson: { id: string }): { label: string; state: "new" | "started" | "done" } {
  const record = store?.lessons[lesson.id];
  if (!record) return { label: "Chưa học", state: "new" };
  if (!isComplete(record.parts)) {
    const done = Object.values(record.parts).filter((value) => value !== null).length;
    return { label: `Đang làm ${done}/4 phần · ${record.date}`, state: "started" };
  }
  return { label: `Xong · ${record.last}%${record.best > record.last ? ` (cao nhất ${record.best}%)` : ""} · ${record.date}`, state: "done" };
}

const levelName = (lesson: { level: LabLesson["level"] }) => LEVELS.find((level) => level.id === lesson.level)!.name;
const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** Thẻ trên /learning: bài mới hôm nay (nếu chưa xong) rồi tới bài tiếp theo của Phòng nghe. */
export function LabEntry({ daily = [] }: { daily?: DailyLabSummary[] }) {
  const store = useLabStore();
  const next = nextLabLesson(store ?? emptyLabStore());
  const done = store ? ALL.filter((lesson) => store.lessons[lesson.id] && isComplete(store.lessons[lesson.id].parts)).length : 0;
  const lastTest = store?.tests[0];
  const todayDate = dateInLearningTimezone();
  const today = todayDaily(daily, todayDate);
  // ChatGPT có thể lỡ một ngày: khi đó gọi đúng là "bài mới nhất", không gọi là bài hôm nay.
  const fresh = today?.date === todayDate;
  const todayRecord = today ? store?.lessons[today.id] : undefined;
  const todayDone = Boolean(todayRecord && isComplete(todayRecord.parts));
  const showToday = today && !todayDone ? today : null;
  return (
    <section className="ll-entry" aria-labelledby="ll-entry-title">
      <div>
        {showToday ? (
          <>
            <p className="eyebrow">TIẾNG ANH · {fresh ? "BÀI MỚI HÔM NAY" : "BÀI MỚI NHẤT"} {dayLabel(showToday.date)} · {showToday.minutes} PHÚT</p>
            <h2 id="ll-entry-title">{fresh ? "Bài hôm nay" : "Bài mới nhất"}: {showToday.title}</h2>
            <p>{levelName(showToday)} · {showToday.titleVi}. Cùng 6 bước như mọi bài: từ vựng → nghe → đọc → viết → nói → kết quả.</p>
          </>
        ) : (
          <>
            <p className="eyebrow">TIẾNG ANH · PHÒNG NGHE · 10–20 PHÚT</p>
            <h2 id="ll-entry-title">Bài {ALL.indexOf(next) + 1}: {next.title}</h2>
            <p>{levelName(next)} · {next.titleVi}. Mỗi bài: từ vựng → nghe → đọc → viết → nói, có chấm điểm.</p>
          </>
        )}
        <small aria-live="polite">
          {store ? `${today ? (todayDone ? `Bài ${dayLabel(today.date)}: đã xong ${todayRecord!.last}% · ` : todayRecord ? `Bài ${dayLabel(today.date)}: đang làm dở · ` : "") : ""}${done}/${ALL.length} bài cố định đã xong${lastTest ? ` · đề gần nhất ${percent(lastTest.score / lastTest.total)}` : ""}` : "Đang đọc tiến độ trên máy…"}
        </small>
      </div>
      <div className="ll-entry__actions">
        {showToday && <Link className="button button--primary" href={`/learning/listening/${showToday.id}`}>{fresh ? "Học bài hôm nay" : "Học bài mới nhất"} →</Link>}
        <Link className={showToday ? "button button--ghost" : "button button--primary"} href={`/learning/listening/${next.id}`}>Học tiếp bài {ALL.indexOf(next) + 1}{showToday ? `: ${next.title}` : ""} →</Link>
        <Link className="button button--ghost" href="/learning/listening">Tất cả bài · luyện đề</Link>
        <Link className="button button--ghost" href="/learning/speaking">Phòng nói · luyện nói theo tình huống</Link>
      </div>
    </section>
  );
}

/** Trang /learning/listening: cách học, nơi lưu, bài mới mỗi ngày, danh sách theo mức và luyện đề. */
export function LabIndex({ daily = [] }: { daily?: DailyLabSummary[] }) {
  const store = useLabStore();
  const next = nextLabLesson(store ?? emptyLabStore());
  const today = dateInLearningTimezone();
  const recent = daily.filter((item) => item.date <= today).slice(0, 14);
  return (
    <>
      <section className="ll-guide" aria-labelledby="ll-guide-title">
        <h2 id="ll-guide-title">Học thế nào</h2>
        <ol>
          <li>Mỗi ngày có <strong>một bài mới</strong> (mục &ldquo;Bài mới mỗi ngày&rdquo;): làm bài đó trước. Còn thời gian thì học tiếp 18 bài cố định từ mức <strong>Dễ</strong>. Mỗi bài 10–20 phút; bài có nhãn VOA là giọng thật.</li>
          <li>Mỗi bài có 6 bước cố định: <strong>Từ vựng → Nghe → Đọc → Viết → Nói → Kết quả</strong>. Nghe, Đọc và chính tả máy chấm; viết ngắn và nói bạn tự chấm theo bài mẫu.</li>
          <li>Làm đủ 4 phần thì bấm <strong>Lưu &amp; Done</strong>. Điểm dưới 60% thì nên học lại bài đó hôm sau.</li>
          <li>Xong 3–4 bài của một mức thì làm <strong>Luyện đề</strong> mức đó; đề đổi theo ngày.</li>
        </ol>
        <AccentPicker />
        <h3>Lưu ở đâu</h3>
        <p>Điểm từng phần, ngày làm và lịch sử đề lưu ngay trên trình duyệt này, theo hồ sơ học đang chọn; không gửi lên mạng. Bản ghi âm và bài viết không được lưu. Done ghi chung chỗ với Done của các bài khác. Điểm là tự luyện, không phải chứng nhận trình độ.</p>
        <div className="ll-actions">
          <Link className="button button--primary" href={`/learning/listening/${next.id}`}>Học tiếp: {next.title} →</Link>
          <Link className="button button--ghost" href="/learning/listening/test">Luyện đề tổng hợp</Link>
          <Link className="button button--ghost" href="/learning/speaking">Muốn nói được: Phòng nói</Link>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="ll-level" aria-labelledby="ll-daily-title">
          <header>
            <h2 id="ll-daily-title">Bài mới mỗi ngày</h2>
            <p>Mỗi ngày một bài mới, cùng 6 bước và cách chấm như các bài dưới. Bài hôm nay ở đầu; bài cũ vẫn làm lại được.</p>
          </header>
          <ol className="ll-list">
            {recent.map((lesson) => {
              const s = status(store, lesson);
              return (
                <li key={lesson.id}>
                  <Link href={`/learning/listening/${lesson.id}`} className="ll-card" data-state={s.state}>
                    <span className="ll-card__n ll-card__n--date">{dayLabel(lesson.date)}</span>
                    <span className="ll-card__body">
                      <strong>{lesson.date === today ? "Hôm nay · " : ""}{lesson.title}</strong>
                      <span>{lesson.titleVi} · {levelName(lesson)} · {lesson.minutes} phút</span>
                      <small>{store ? s.label : "…"}</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {LEVELS.map((level) => {
        const lessons = labLessons(level.id);
        const lastTest = store?.tests.find((item) => item.level === level.id);
        return (
          <section key={level.id} className="ll-level" aria-labelledby={`ll-level-${level.id}`}>
            <header>
              <h2 id={`ll-level-${level.id}`}>{level.name} <small>khoảng {level.cefr}</small></h2>
              <p>{level.blurb}</p>
            </header>
            <ol className="ll-list">
              {lessons.map((lesson) => {
                const s = status(store, lesson);
                return (
                  <li key={lesson.id}>
                    <Link href={`/learning/listening/${lesson.id}`} className="ll-card" data-state={s.state}>
                      <span className="ll-card__n">{ALL.indexOf(lesson) + 1}</span>
                      <span className="ll-card__body">
                        <strong>{lesson.title}</strong>
                        <span>{lesson.titleVi} · {lesson.minutes} phút{lesson.audioUrl ? " · VOA giọng thật" : ""}</span>
                        <small>{store ? s.label : "…"}</small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <div className="ll-actions">
              <Link className="button button--ghost" href={`/learning/listening/test?level=${level.id}`}>Luyện đề mức {level.name}</Link>
              {lastTest && <small>Lần gần nhất: {percent(lastTest.score / lastTest.total)} · {lastTest.date}</small>}
            </div>
          </section>
        );
      })}
    </>
  );
}
