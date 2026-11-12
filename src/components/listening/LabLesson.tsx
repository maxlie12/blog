"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PronounceButton } from "@/components/PronounceButton";
import { dateInLearningTimezone, getLocalCompletionSummary, recordLocalCompletion } from "@/lib/localLearningProgress";
import {
  PART_EVIDENCE, PART_WEIGHTS, WRITING_CHECKLIST, drillLines, gradeLabel, isComplete, labTotal, withLessonResult, writeScore, writingCheck,
  writingRubric, type LabLesson as Lesson, type LabParts,
} from "@/lib/listeningLab";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import { DictationLine, LAB_CHANGED, LabPlayer, QuizBlock, SpeakLine, loadLab, percent, saveLab, stopSpeech } from "./labShared";

const STEPS = ["Từ vựng", "Nghe", "Đọc", "Viết", "Nói", "Kết quả"] as const;
const PART_OF_STEP: (keyof LabParts | null)[] = [null, "listen", "read", "write", "speak", null];
const PART_NAMES: Record<keyof LabParts, string> = { listen: "Nghe", read: "Đọc", write: "Viết", speak: "Nói" };
const EMPTY: LabParts = { listen: null, read: null, write: null, speak: null };

export function LabLesson({ lesson, levelName, next }: { lesson: Lesson; levelName: string; next: { id: string; title: string } | null }) {
  const learner = useLearnerProfile();
  const completionId = `listening:${lesson.id}`;
  const [step, setStep] = useState(0);
  const [parts, setParts] = useState<LabParts>(EMPTY);
  const [saved, setSaved] = useState<LabParts>(EMPTY);
  const [rate, setRate] = useState(0.9);
  const [dict, setDict] = useState<(number | null)[]>(() => lesson.dictation.map(() => null));
  const [essay, setEssay] = useState("");
  const [rubricOpen, setRubricOpen] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => WRITING_CHECKLIST.map(() => false));
  const [ratings, setRatings] = useState<(number | null)[]>(() => lesson.speaking.map(() => null));
  const [doneOn, setDoneOn] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Điểm lần trước của hồ sơ đang chọn; bắt đầu ở phần đầu tiên chưa làm.
  useEffect(() => {
    const restore = () => {
      const record = loadLab().lessons[lesson.id];
      const previous = record?.parts ?? EMPTY;
      setSaved(previous);
      setParts(previous);
      const first = PART_OF_STEP.findIndex((part) => part !== null && previous[part] === null);
      setStep(record ? (first === -1 ? STEPS.length - 1 : first) : 0);
      setDoneOn(getLocalCompletionSummary(completionId, "en").completedOn);
    };
    restore();
  }, [completionId, learner.id, lesson.id]);

  useEffect(() => stopSpeech, []);

  // Trên điện thoại hàng bước cuộn ngang: giữ bước hiện tại trong tầm nhìn.
  useEffect(() => {
    const row = document.querySelector<HTMLElement>(".ll-steps ol");
    const current = row?.querySelector<HTMLElement>("[aria-current=step]")?.parentElement;
    if (row && current) row.scrollLeft = Math.max(0, current.offsetLeft - 16);
  }, [step]);

  function score(part: keyof LabParts, value: number | null) {
    const nextParts = { ...parts, [part]: value };
    setParts(nextParts);
    if (!saveLab(withLessonResult(loadLab(), lesson.id, nextParts, dateInLearningTimezone()))) setMessage("Trình duyệt không cho lưu điểm trên máy; điểm chỉ còn trong trang đang mở.");
  }

  function go(index: number) {
    stopSpeech();
    setStep(index);
    document.getElementById("ll-step-title")?.focus();
  }

  function markDone() {
    const result = recordLocalCompletion({ id: completionId, lessonId: `listening-${lesson.id}`, language: "en", skill: "listening", minutes: lesson.minutes });
    setDoneOn(result.completedOn);
    setMessage(result.newlyCompleted ? "Đã lưu Done cho hôm nay. Điểm bài vẫn lưu riêng ở Phòng nghe." : "Bài này đã Done trước đó; điểm mới vẫn được lưu.");
    window.dispatchEvent(new Event(LAB_CHANGED));
  }

  const total = labTotal(parts);
  const complete = isComplete(parts);
  const dictDone = dict.every((value) => value !== null);
  const dictScore = dictDone ? dict.reduce<number>((sum, value) => sum + (value ?? 0), 0) / dict.length : null;
  const check = writingCheck(lesson, essay);
  const rubric = rubricOpen && essay.trim() ? writingRubric(lesson, essay) : null;

  return (
    <article className="ll-lesson" aria-labelledby="ll-title">
      <header className="ll-lesson__head">
        <p className="eyebrow">PHÒNG NGHE · {levelName.toUpperCase()} · KHOẢNG {lesson.minutes} PHÚT</p>
        <h1 id="ll-title">{lesson.title}</h1>
        <p>{lesson.titleVi}. {lesson.intro}</p>
      </header>

      <nav className="ll-steps" aria-label="Các bước của bài">
        <ol>
          {STEPS.map((name, index) => {
            const part = PART_OF_STEP[index];
            const state = part && parts[part] !== null ? `xong ${percent(parts[part])}` : null;
            return (
              <li key={name}>
                <button type="button" aria-current={step === index ? "step" : undefined} onClick={() => go(index)}>
                  <span className="ll-steps__n">{index + 1}</span> {name}
                  {state && <small>{state}</small>}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="ll-panel" aria-labelledby="ll-step-title">
        <h2 id="ll-step-title" tabIndex={-1}>{step + 1}. {STEPS[step]}</h2>

        {step === 0 && (
          <>
            <p className="ll-how">Đọc nghĩa, bấm loa nghe từ và câu ví dụ, đọc to theo. Phần này không chấm điểm.</p>
            <ul className="ll-vocab">
              {lesson.vocab.map((item) => (
                <li key={item.w}>
                  <div className="ll-vocab__word"><strong>{item.w}</strong> <em>{item.pos}</em> <PronounceButton text={item.w} /></div>
                  <p>{item.vi}</p>
                  <p className="ll-vocab__ex">{item.ex} <PronounceButton text={item.ex} /></p>
                </li>
              ))}
            </ul>
          </>
        )}

        {step === 1 && (
          <>
            <p className="ll-how">Nghe cả bài 1–2 lần, <strong>chưa xem lời thoại</strong>. Rồi trả lời; không chắc thì nghe lại.</p>
            <LabPlayer lesson={lesson} rate={rate} onRate={setRate} />
            <QuizBlock id={`${lesson.id}-listen`} items={lesson.listening} previous={saved.listen} onScore={(value) => score("listen", value)} />
          </>
        )}

        {step === 2 && (
          <>
            {lesson.textKind === "summary" ? (
              <p className="ll-how">Bài đọc dưới đây là bản tóm tắt bài nghe bằng tiếng Anh đơn giản (Phòng nghe viết lại). Đọc rồi trả lời câu hỏi đọc hiểu.
                {lesson.sourceUrl && <> Lời gốc đầy đủ: <a href={lesson.sourceUrl} target="_blank" rel="noopener noreferrer">mở bài trên VOA</a>.</>}</p>
            ) : (
              <p className="ll-how">Đọc lời thoại (bấm loa để nghe từng câu), rồi trả lời câu hỏi đọc hiểu. Câu nào ở bước Nghe bạn trả lời sai, tìm lại trong lời thoại.</p>
            )}
            <ol className="ll-transcript">
              {lesson.transcript.map((line, index) => (
                <li key={index}>{line.s && <strong>{line.s}:</strong>} {line.t} <PronounceButton text={line.t} /></li>
              ))}
            </ol>
            <QuizBlock id={`${lesson.id}-read`} items={lesson.reading} previous={saved.read} onScore={(value) => score("read", value)} />
          </>
        )}

        {step === 3 && (
          <>
            <h3>A. Chính tả ({lesson.dictation.length} câu, máy chấm)</h3>
            <p className="ll-how">Nghe một câu trong bài và gõ lại. Không cần viết hoa hay dấu câu.</p>
            {lesson.dictation.map((line, index) => (
              <DictationLine key={line} n={index + 1} line={drillLines(lesson)[line]} rate={rate}
                onScore={(value) => setDict((old) => old.map((item, i) => (i === index ? value : item)))} />
            ))}
            <h3>B. Viết ngắn (tự chấm)</h3>
            <p className="ll-prompt">{lesson.write.prompt}</p>
            <label htmlFor="ll-essay">Bài viết của bạn (chỉ ở trang này, không lưu hay gửi đi)</label>
            <textarea id="ll-essay" className="ll-input" rows={4} value={essay} onChange={(event) => setEssay(event.target.value)} />
            <p className="ll-note" aria-live="polite">{check.sentences} câu · từ vựng đã dùng: {check.used.length ? check.used.join(", ") : "chưa có"}</p>
            <div className="ll-actions">
              <button type="button" className="button button--ghost" disabled={!essay.trim()} onClick={() => setRubricOpen(true)}>
                Xem rubric &amp; gợi ý sửa
              </button>
            </div>
            {rubric && (
              <section className="ll-note" aria-label="Rubric bản nháp" aria-live="polite">
                <p><strong>Đối chiếu bản nháp</strong> — quy tắc gợi ý về hình thức, không chấm ngữ pháp hoặc mức CEFR.</p>
                <ul>
                  {rubric.checks.map((item) => (
                    <li key={item.id}>
                      <strong>{item.passed === null ? "Tự kiểm tra" : item.passed ? "Đạt mục tiêu" : "Cần sửa"} — {item.label}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
                <p><strong>Sửa một điểm trước:</strong> {rubric.nextStep}</p>
                <button type="button" className="button button--ghost" onClick={() => document.getElementById("ll-essay")?.focus()}>
                  Sửa bài và thử lại
                </button>
              </section>
            )}
            <details className="ll-model"><summary>Xem bài mẫu</summary><p>{lesson.write.model}</p></details>
            <fieldset className="ll-checklist">
              <legend>Tự kiểm tra sau khi so với bài mẫu</legend>
              {WRITING_CHECKLIST.map((item, index) => (
                <label key={item} className="ll-option">
                  <input type="checkbox" checked={checked[index]} disabled={!essay.trim()} onChange={() => setChecked((old) => old.map((v, i) => (i === index ? !v : v)))} />
                  <span>{item}</span>
                </label>
              ))}
            </fieldset>
            <div className="ll-actions" aria-live="polite">
              <button type="button" className="button button--primary" disabled={!dictDone}
                onClick={() => score("write", writeScore(dictScore, essay.trim() ? checked.filter(Boolean).length : null))}>
                Lưu điểm phần viết
              </button>
              <small>{dictDone ? `Chính tả ${percent(dictScore)}${essay.trim() ? ` · tự kiểm tra ${checked.filter(Boolean).length}/${WRITING_CHECKLIST.length}` : " · chưa viết phần B (không bắt buộc)"}.` : "Kiểm tra đủ các câu chính tả trước."}
                {parts.write !== null && ` Đã lưu: ${percent(parts.write)}.`}</small>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p className="ll-how">Nghe mẫu, nói theo (bắt chước nhịp và chỗ nhấn), ghi âm rồi nghe lại và tự chấm từng câu.</p>
            {lesson.speaking.map((line, index) => (
              <SpeakLine key={line} n={index + 1} line={drillLines(lesson)[line]} rate={rate} rating={ratings[index]}
                onRate={(value) => {
                  const next = ratings.map((item, i) => (i === index ? value : item));
                  setRatings(next);
                  if (next.every((item) => item !== null)) score("speak", next.reduce<number>((sum, item) => sum + (item ?? 0), 0) / next.length);
                }} />
            ))}
            <p className="ll-note" aria-live="polite">{ratings.every((item) => item !== null) ? `Đã lưu điểm nói: ${percent(parts.speak)}.` : `Tự chấm đủ ${lesson.speaking.length} câu để lưu điểm nói.`}</p>
          </>
        )}

        {step === 5 && (
          <>
            <table className="ll-results">
              <caption className="sr-only">Điểm luyện tập theo 4 kỹ năng và nguồn đánh giá</caption>
              <thead><tr><th scope="col">Phần</th><th scope="col">Điểm</th><th scope="col">Tỉ trọng</th><th scope="col">Nguồn đánh giá</th></tr></thead>
              <tbody>
                {(Object.keys(PART_NAMES) as (keyof LabParts)[]).map((part) => (
                  <tr key={part}><th scope="row">{PART_NAMES[part]}</th><td>{parts[part] === null ? "chưa làm" : percent(parts[part])}</td><td>{PART_WEIGHTS[part]}%</td><td>{PART_EVIDENCE[part].source}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><th scope="row">Tổng</th><td colSpan={3}>{total === null ? "Chưa có điểm" : complete ? `${total}% · ${gradeLabel(total)} (điểm tự luyện)` : `${total}% tạm tính trên các phần đã làm · chưa đủ 4 phần`}</td></tr></tfoot>
            </table>
            <div className="ll-note">
              <p><strong>Cách đánh giá từng kỹ năng</strong></p>
              <ul>{(Object.keys(PART_NAMES) as (keyof LabParts)[]).map((part) => (
                <li key={part}><strong>{PART_NAMES[part]}:</strong> {PART_EVIDENCE[part].criterion}</li>
              ))}</ul>
              <p><strong>Điều kiện Done:</strong> đã lưu điểm ở cả 4 phần; không yêu cầu mức điểm tối thiểu. Viết ngắn vẫn tùy chọn, nói vẫn tự chấm. Đây là hoàn thành vòng luyện, không phải bài thi xác nhận trình độ.</p>
              <p>Điểm và ngày làm lưu trên máy này (hồ sơ {learner.name}); không lưu bài viết hay bản ghi âm.</p>
            </div>
            <div className="ll-actions" aria-live="polite">
              {doneOn ? <p className="ll-score"><strong>Đã Done</strong> ngày {doneOn}.</p> : (
                <button type="button" className="button button--primary" disabled={!complete} onClick={markDone}>Lưu &amp; Done</button>
              )}
              {!complete && !doneOn && <small>Làm đủ 4 phần (Nghe, Đọc, Viết, Nói) để Done.</small>}
              {message && <p>{message}</p>}
            </div>
            <div className="ll-actions">
              {next && <Link className="button button--primary" href={`/learning/listening/${next.id}`}>Bài tiếp: {next.title} →</Link>}
              <Link className="button button--ghost" href={`/learning/listening/test?level=${lesson.level}`}>Luyện đề mức {levelName}</Link>
              <Link className="button button--ghost" href="/learning/listening">Danh sách bài</Link>
              <Link className="button button--ghost" href="/learning/speaking">Luyện nói theo tình huống</Link>
            </div>
          </>
        )}

        {step < STEPS.length - 1 && (
          <div className="ll-nav">
            {step > 0 && <button type="button" className="button button--ghost" onClick={() => go(step - 1)}>← {STEPS[step - 1]}</button>}
            <button type="button" className="button button--primary" onClick={() => go(step + 1)}>Tiếp: {STEPS[step + 1]} →</button>
          </div>
        )}
      </section>
    </article>
  );
}
