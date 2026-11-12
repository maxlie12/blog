"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildTest, compareDictation, drillLines, gradeLabel, labLesson, withTestResult, type LabLevel, type LabTestRecord,
} from "@/lib/listeningLab";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import { ChoiceQuestion, LabPlayer, LAB_CHANGED, SpeakLine, loadLab, percent, saveLab, speakLines, stopSpeech, useSpeechSupported } from "./labShared";

const SECTIONS = ["Nghe", "Đọc", "Chính tả", "Nói"] as const;

function minutesSince(start: number) {
  return Math.max(1, Math.round((Date.now() - start) / 60000));
}

export function LabTest({ date, level, levelName }: { date: string; level?: LabLevel; levelName: string }) {
  const learner = useLearnerProfile();
  const supported = useSpeechSupported();
  const [variant, setVariant] = useState(0);
  const test = useMemo(() => buildTest(variant ? `${date}#${variant}` : date, level), [date, level, variant]);
  const lessons = test.lessonIds.map((id) => labLesson(id)!);
  const listenQs = test.questions.filter((q) => q.kind === "listening");
  const readQs = test.questions.filter((q) => q.kind === "reading");
  const ordered = [...listenQs, ...readQs];

  const [section, setSection] = useState(-1);
  const [started, setStarted] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [rate, setRate] = useState(0.9);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [typed, setTyped] = useState<string[]>(["", ""]);
  const [rating, setRating] = useState<number | null>(null);
  const [result, setResult] = useState<LabTestRecord | null>(null);
  const [history, setHistory] = useState<LabTestRecord[]>([]);

  useEffect(() => {
    const read = () => setHistory(loadLab().tests.filter((item) => (item.level ?? null) === (level ?? null)).slice(0, 5));
    read();
    window.addEventListener(LAB_CHANGED, read);
    return () => window.removeEventListener(LAB_CHANGED, read);
  }, [learner.id, level]);
  useEffect(() => stopSpeech, []);
  useEffect(() => {
    if (!started || result) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [started, result]);

  function begin(nextVariant = variant) {
    stopSpeech();
    setVariant(nextVariant);
    setPicked({});
    setTyped(["", ""]);
    setRating(null);
    setResult(null);
    setSection(0);
    setStarted(Date.now());
    setElapsed(0);
  }

  function go(index: number) {
    stopSpeech();
    setSection(index);
    document.getElementById("ll-test-section")?.focus();
  }

  function submit() {
    stopSpeech();
    const right = ordered.filter((q, index) => picked[index] === labLesson(q.lessonId)![q.kind][q.index].c).length;
    const dictation = test.dictations.reduce((sum, item, index) => sum + compareDictation(drillLines(labLesson(item.lessonId)!)[item.line].t, typed[index] ?? "").score, 0);
    const record: LabTestRecord = {
      date, level, minutes: minutesSince(started), speak: rating,
      score: Math.round((right + dictation) * 10) / 10, total: ordered.length + test.dictations.length,
    };
    setResult(record);
    saveLab(withTestResult(loadLab(), record));
    setSection(SECTIONS.length);
  }

  const question = (index: number) => {
    const q = ordered[index];
    const item = labLesson(q.lessonId)![q.kind][q.index];
    return (
      <ChoiceQuestion key={`${q.lessonId}-${q.kind}-${q.index}`} item={item} n={index + 1} name={`test-${index}`} picked={picked[index] ?? null}
        revealed={Boolean(result)} onPick={(choice) => setPicked((old) => ({ ...old, [index]: choice }))} />
    );
  };
  const lessonOf = (index: number) => lessons.findIndex((lesson) => lesson.id === ordered[index].lessonId);
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  if (section === -1) {
    return (
      <section className="ll-panel" aria-labelledby="ll-test-intro">
        <h2 id="ll-test-intro">Đề hôm nay · {levelName}</h2>
        <p className="ll-how">Làm theo thứ tự, mỗi phần xong mới sang phần sau; điểm hiện khi nộp bài. Mục tiêu khoảng {test.minutes} phút, không bị khoá giờ.</p>
        <ol className="ll-outline">
          <li><strong>Nghe</strong> — 2 bài, {listenQs.length} câu trắc nghiệm (không xem lời thoại).</li>
          <li><strong>Đọc</strong> — lời thoại của 2 bài, {readQs.length} câu đọc hiểu.</li>
          <li><strong>Chính tả</strong> — nghe và gõ lại {test.dictations.length} câu.</li>
          <li><strong>Nói</strong> — nói theo 1 câu, ghi âm và tự chấm (ghi riêng, không cộng vào điểm).</li>
        </ol>
        <div className="ll-actions">
          <button type="button" className="button button--primary" onClick={() => begin()}>Bắt đầu làm đề</button>
          <button type="button" className="button button--ghost" onClick={() => setVariant((n) => n + 1)}>Đổi đề khác</button>
        </div>
        <TestHistory history={history} />
      </section>
    );
  }

  return (
    <section className="ll-panel" aria-labelledby="ll-test-section">
      <div className="ll-test-bar">
        <ol className="ll-test-bar__parts" aria-label="Các phần của đề">
          {SECTIONS.map((name, index) => (
            <li key={name} aria-current={section === index ? "step" : undefined} data-done={section > index}>{index + 1}. {name}</li>
          ))}
        </ol>
        <span className="ll-test-bar__clock" role="timer" aria-label={`Thời gian đã làm ${clock}`}>{clock}</span>
      </div>
      <h2 id="ll-test-section" tabIndex={-1}>{section < SECTIONS.length ? `Phần ${section + 1}: ${SECTIONS[section]}` : "Kết quả"}</h2>

      {section === 0 && lessons.map((lesson, li) => (
        <div key={lesson.id} className="ll-test-part">
          <h3>Bài {li === 0 ? "A" : "B"}: {lesson.title}</h3>
          <LabPlayer lesson={lesson} rate={rate} onRate={setRate} />
          {ordered.map((q, index) => (q.kind === "listening" && lessonOf(index) === li ? question(index) : null))}
        </div>
      ))}

      {section === 1 && lessons.map((lesson, li) => (
        <div key={lesson.id} className="ll-test-part">
          <h3>Bài {li === 0 ? "A" : "B"}: {lesson.title}</h3>
          {lesson.textKind === "summary" && <p className="ll-note">Bản tóm tắt bài nghe bằng tiếng Anh đơn giản.</p>}
          <ol className="ll-transcript">
            {lesson.transcript.map((line, index) => <li key={index}>{line.s && <strong>{line.s}:</strong>} {line.t}</li>)}
          </ol>
          {ordered.map((q, index) => (q.kind === "reading" && lessonOf(index) === li ? question(index) : null))}
        </div>
      ))}

      {section === 2 && test.dictations.map((item, index) => {
        const line = drillLines(labLesson(item.lessonId)!)[item.line];
        return (
          <div key={index} className="ll-dict">
            <div className="ll-player__row">
              <button type="button" className="button button--ghost" disabled={!supported} onClick={() => speakLines([line], rate)}>Nghe câu {index + 1}</button>
              <button type="button" className="button button--ghost" disabled={!supported} onClick={() => speakLines([line], 0.6)}>Nghe thật chậm</button>
            </div>
            <label htmlFor={`ll-test-dict-${index}`}>Gõ lại câu {index + 1}</label>
            <input id={`ll-test-dict-${index}`} className="ll-input" autoComplete="off" autoCapitalize="off" spellCheck={false} value={typed[index]}
              onChange={(event) => setTyped((old) => old.map((value, i) => (i === index ? event.target.value : value)))} />
          </div>
        );
      })}

      {section === 3 && (() => {
        const line = drillLines(labLesson(test.speaking.lessonId)!)[test.speaking.line];
        return <SpeakLine n={1} line={line} rate={rate} rating={rating} onRate={setRating} />;
      })()}

      {section < SECTIONS.length && (
        <div className="ll-nav">
          {section < SECTIONS.length - 1 ? (
            <button type="button" className="button button--primary" onClick={() => go(section + 1)}>Xong phần {SECTIONS[section]} → {SECTIONS[section + 1]}</button>
          ) : (
            <button type="button" className="button button--primary" onClick={submit}>Nộp bài</button>
          )}
          <small>{section === 0 ? "Sang phần Đọc thì không nghe lại phần Nghe nữa." : `Đã chọn ${Object.keys(picked).length}/${ordered.length} câu trắc nghiệm.`}</small>
        </div>
      )}

      {result && (
        <>
          <p className="ll-score ll-score--big">
            <strong>{percent(result.score / result.total)}</strong> · {gradeLabel(Math.round((result.score / result.total) * 100))} · {result.score}/{result.total} điểm · {result.minutes} phút
            {result.speak !== null && result.speak !== undefined && ` · nói tự chấm ${percent(result.speak)}`}
          </p>
          <p className="ll-note">Đã lưu vào lịch sử đề trên máy này (hồ sơ {learner.name}). Điểm tự luyện, không phải chứng nhận trình độ; luyện đề không tính Done.</p>
          <h3>Xem lại câu hỏi</h3>
          {ordered.map((_, index) => question(index))}
          <h3>Chính tả</h3>
          {test.dictations.map((item, index) => {
            const line = drillLines(labLesson(item.lessonId)!)[item.line].t;
            const check = compareDictation(line, typed[index] ?? "");
            return (
              <div key={index} className="ll-dict__result">
                <p><strong>Câu {index + 1}: {Math.round(check.score * 100)}% số từ đúng.</strong></p>
                <p className="ll-dict__words">{check.words.map((word, i) => <span key={i} data-ok={word.ok}>{word.ok ? word.w : <u>{word.w}</u>}</span>)}</p>
              </div>
            );
          })}
          <div className="ll-actions">
            <button type="button" className="button button--primary" onClick={() => begin(variant + 1)}>Làm đề khác</button>
            {lessons.map((lesson) => <Link key={lesson.id} className="button button--ghost" href={`/learning/listening/${lesson.id}`}>Học lại bài {lesson.title}</Link>)}
          </div>
          <TestHistory history={history} />
        </>
      )}
    </section>
  );
}

function TestHistory({ history }: { history: LabTestRecord[] }) {
  if (!history.length) return null;
  return (
    <div className="ll-history">
      <h3>Các lần làm gần đây</h3>
      <ul>
        {history.map((item, index) => (
          <li key={index}>{item.date} · <strong>{percent(item.score / item.total)}</strong> ({item.score}/{item.total}) · {item.minutes} phút</li>
        ))}
      </ul>
    </div>
  );
}
