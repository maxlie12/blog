"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEVELS, emptyLabStore, isComplete, labLessons, nextLabLesson, type LabLesson, type LabStore } from "@/lib/listeningLab";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import { LAB_CHANGED, loadLab, percent } from "./labShared";

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

function status(store: LabStore | null, lesson: LabLesson): { label: string; state: "new" | "started" | "done" } {
  const record = store?.lessons[lesson.id];
  if (!record) return { label: "Chưa học", state: "new" };
  if (!isComplete(record.parts)) {
    const done = Object.values(record.parts).filter((value) => value !== null).length;
    return { label: `Đang làm ${done}/4 phần · ${record.date}`, state: "started" };
  }
  return { label: `Xong · ${record.last}%${record.best > record.last ? ` (cao nhất ${record.best}%)` : ""} · ${record.date}`, state: "done" };
}

const levelName = (lesson: LabLesson) => LEVELS.find((level) => level.id === lesson.level)!.name;

/** Thẻ trên /learning: một nút học tiếp bài tiếp theo của Phòng nghe. */
export function LabEntry() {
  const store = useLabStore();
  const next = nextLabLesson(store ?? emptyLabStore());
  const done = store ? ALL.filter((lesson) => store.lessons[lesson.id] && isComplete(store.lessons[lesson.id].parts)).length : 0;
  const lastTest = store?.tests[0];
  return (
    <section className="ll-entry" aria-labelledby="ll-entry-title">
      <div>
        <p className="eyebrow">TIẾNG ANH · PHÒNG NGHE · 10–15 PHÚT</p>
        <h2 id="ll-entry-title">Bài {ALL.indexOf(next) + 1}: {next.title}</h2>
        <p>{levelName(next)} · {next.titleVi}. Mỗi bài: từ vựng → nghe → đọc → viết → nói, có chấm điểm.</p>
        <small aria-live="polite">{store ? `${done}/${ALL.length} bài đã xong${lastTest ? ` · đề gần nhất ${percent(lastTest.score / lastTest.total)}` : ""}` : "Đang đọc tiến độ trên máy…"}</small>
      </div>
      <div className="ll-entry__actions">
        <Link className="button button--primary" href={`/learning/listening/${next.id}`}>Học tiếp bài {ALL.indexOf(next) + 1} →</Link>
        <Link className="button button--ghost" href="/learning/listening">Tất cả bài · luyện đề</Link>
      </div>
    </section>
  );
}

/** Trang /learning/listening: cách học, nơi lưu, danh sách theo mức và luyện đề. */
export function LabIndex() {
  const store = useLabStore();
  const next = nextLabLesson(store ?? emptyLabStore());
  return (
    <>
      <section className="ll-guide" aria-labelledby="ll-guide-title">
        <h2 id="ll-guide-title">Học thế nào</h2>
        <ol>
          <li>Bắt đầu từ mức <strong>Dễ</strong>, làm bài theo thứ tự. Mỗi bài 10–15 phút.</li>
          <li>Mỗi bài có 6 bước cố định: <strong>Từ vựng → Nghe → Đọc → Viết → Nói → Kết quả</strong>. Nghe, Đọc và chính tả máy chấm; viết ngắn và nói bạn tự chấm theo bài mẫu.</li>
          <li>Làm đủ 4 phần thì bấm <strong>Lưu &amp; Done</strong>. Điểm dưới 60% thì nên học lại bài đó hôm sau.</li>
          <li>Xong 3–4 bài của một mức thì làm <strong>Luyện đề</strong> mức đó; đề đổi theo ngày.</li>
        </ol>
        <h3>Lưu ở đâu</h3>
        <p>Điểm từng phần, ngày làm và lịch sử đề lưu ngay trên trình duyệt này, theo hồ sơ học đang chọn; không gửi lên mạng. Bản ghi âm và bài viết không được lưu. Done ghi chung chỗ với Done của các bài khác. Điểm là tự luyện, không phải chứng nhận trình độ.</p>
        <div className="ll-actions">
          <Link className="button button--primary" href={`/learning/listening/${next.id}`}>Học tiếp: {next.title} →</Link>
          <Link className="button button--ghost" href="/learning/listening/test">Luyện đề tổng hợp</Link>
        </div>
      </section>

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
                        <span>{lesson.titleVi} · {lesson.minutes} phút</span>
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
