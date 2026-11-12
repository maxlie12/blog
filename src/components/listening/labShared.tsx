"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { SpeakingRecorder } from "@/components/SpeakingRecorder";
import { readProfileStorage, writeProfileStorage } from "@/lib/learnerProfiles";
import {
  LAB_STORE_KEY, SPEAK_RATINGS, compareDictation, parseLabStore, type DictationResult, type LabChoice, type LabLesson,
  type LabLine, type LabStore,
} from "@/lib/listeningLab";

/* ───────────── lưu trên máy (theo hồ sơ học đang chọn) ───────────── */

export const LAB_CHANGED = "listening-lab-changed";

export function loadLab(): LabStore {
  try {
    return parseLabStore(readProfileStorage(LAB_STORE_KEY));
  } catch {
    return parseLabStore(null);
  }
}

/** Trả về false khi trình duyệt không cho lưu (chế độ ẩn danh, hết chỗ). */
export function saveLab(store: LabStore): boolean {
  try {
    writeProfileStorage(LAB_STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(LAB_CHANGED));
    return true;
  } catch {
    return false;
  }
}

export function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/* ───────────── giọng đọc của máy ───────────── */

const noop = () => () => {};
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(noop, () => "speechSynthesis" in window, () => false);
}

function englishVoices(): SpeechSynthesisVoice[] {
  const all = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const us = all.filter((voice) => voice.lang.toLowerCase().startsWith("en-us"));
  return (us.length ? us : all).sort((a, b) => Number(/google|natural|premium/i.test(b.name)) - Number(/google|natural|premium/i.test(a.name)));
}

/** Đọc lần lượt từng câu; mỗi người nói một giọng (hoặc một độ cao giọng nếu máy chỉ có một giọng). */
export function speakLines(lines: LabLine[], rate: number, handlers: { onLine?: (index: number) => void; onEnd?: () => void } = {}) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = englishVoices();
  const speakers = [...new Set(lines.map((line) => line.s ?? ""))];
  lines.forEach((line, index) => {
    const who = speakers.indexOf(line.s ?? "");
    const utterance = new SpeechSynthesisUtterance(line.t);
    utterance.lang = "en-US";
    utterance.rate = rate;
    if (voices.length) utterance.voice = voices[who % voices.length];
    utterance.pitch = voices.length > 1 ? 1 : [1, 0.8, 1.2][who % 3];
    utterance.onstart = () => handlers.onLine?.(index);
    if (index === lines.length - 1) {
      utterance.onend = () => handlers.onEnd?.();
      utterance.onerror = () => handlers.onEnd?.();
    }
    synth.speak(utterance);
  });
}

export function stopSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

const RATES = [
  { value: 0.7, label: "Chậm" },
  { value: 0.9, label: "Vừa" },
  { value: 1, label: "Thường" },
] as const;

export function RatePicker({ rate, onRate }: { rate: number; onRate: (rate: number) => void }) {
  return (
    <div className="ll-rate" role="group" aria-label="Tốc độ đọc">
      <span>Tốc độ</span>
      {RATES.map((item) => (
        <button key={item.value} type="button" className="ll-chip" aria-pressed={rate === item.value} onClick={() => onRate(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Nghe cả bài: mp3 thật nếu bài có, không thì giọng máy đọc từng câu. */
export function LabPlayer({ lesson, rate, onRate }: { lesson: LabLesson; rate: number; onRate: (rate: number) => void }) {
  const supported = useSpeechSupported();
  const [line, setLine] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  useEffect(() => stopSpeech, []);

  if (lesson.audioUrl) {
    return (
      <div className="ll-player">
        <audio controls preload="none" src={lesson.audioUrl} onPlay={() => setPlays((n) => n + 1)} />
        {lesson.source && <small>Nguồn: {lesson.source}</small>}
      </div>
    );
  }
  if (!supported) return <p className="ll-note">Trình duyệt này không có giọng đọc. Hãy mở bằng Chrome, Safari hoặc Edge.</p>;

  const playing = line !== null;
  return (
    <div className="ll-player">
      <div className="ll-player__row">
        {playing ? (
          <button type="button" className="button button--primary" onClick={() => { stopSpeech(); setLine(null); }}>Dừng</button>
        ) : (
          <button type="button" className="button button--primary" onClick={() => {
            setPlays((n) => n + 1);
            setLine(0);
            speakLines(lesson.transcript, rate, { onLine: setLine, onEnd: () => setLine(null) });
          }}>{plays ? "Nghe lại cả bài" : "Nghe cả bài"}</button>
        )}
        <RatePicker rate={rate} onRate={onRate} />
      </div>
      <p className="ll-note" aria-live="polite">
        {playing ? `Đang đọc câu ${line + 1}/${lesson.transcript.length}…` : plays ? `Đã nghe ${plays} lần.` : `${lesson.transcript.length} câu · giọng đọc của máy (en-US).`}
      </p>
    </div>
  );
}

/* ───────────── trắc nghiệm ───────────── */

export function ChoiceQuestion({ item, n, name, picked, revealed, onPick }: {
  item: LabChoice; n: number; name: string; picked: number | null; revealed: boolean; onPick: (choice: number) => void;
}) {
  const right = picked === item.c;
  return (
    <fieldset className="ll-q" data-state={revealed ? (right ? "right" : "wrong") : undefined}>
      <legend><span className="ll-q__n">{n}.</span> {item.q}</legend>
      {item.a.map((answer, index) => {
        const mark = revealed && index === item.c ? "Đáp án đúng" : revealed && index === picked ? "Bạn chọn" : null;
        return (
          <label key={index} className="ll-option" data-mark={revealed ? (index === item.c ? "right" : index === picked ? "wrong" : undefined) : undefined}>
            <input type="radio" name={name} checked={picked === index} disabled={revealed} onChange={() => onPick(index)} />
            <span>{answer}</span>
            {mark && <em>{mark}</em>}
          </label>
        );
      })}
      {revealed && <p className="ll-q__why"><strong>{right ? "Đúng." : picked === null ? "Chưa chọn." : "Chưa đúng."}</strong> {item.why}</p>}
    </fieldset>
  );
}

/** Một nhóm câu hỏi chấm ngay; `onScore` nhận tỉ lệ đúng 0..1. */
export function QuizBlock({ id, items, previous, onScore }: { id: string; items: LabChoice[]; previous: number | null; onScore: (score: number) => void }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => items.map(() => null));
  const [revealed, setRevealed] = useState(false);
  const answered = picked.filter((value) => value !== null).length;
  const right = items.filter((item, index) => picked[index] === item.c).length;
  return (
    <div className="ll-quiz">
      {items.map((item, index) => (
        <ChoiceQuestion key={index} item={item} n={index + 1} name={`${id}-${index}`} picked={picked[index]} revealed={revealed}
          onPick={(choice) => setPicked((old) => old.map((value, i) => (i === index ? choice : value)))} />
      ))}
      <div className="ll-actions" aria-live="polite">
        {revealed ? (
          <>
            <p className="ll-score"><strong>{right}/{items.length} câu đúng</strong> — đã lưu điểm phần này.</p>
            <button type="button" className="button button--ghost" onClick={() => { setPicked(items.map(() => null)); setRevealed(false); }}>Làm lại</button>
          </>
        ) : (
          <>
            <button type="button" className="button button--primary" disabled={answered < items.length} onClick={() => { setRevealed(true); onScore(right / items.length); }}>
              Chấm điểm
            </button>
            <small>{answered < items.length ? `Đã chọn ${answered}/${items.length} câu.` : "Đã chọn đủ."}{previous !== null && ` Lần trước: ${percent(previous)}.`}</small>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────── chính tả ───────────── */

export function DictationLine({ n, line, rate, onScore }: { n: number; line: LabLine; rate: number; onScore: (score: number) => void }) {
  const supported = useSpeechSupported();
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<DictationResult | null>(null);
  const inputId = useId();
  return (
    <div className="ll-dict">
      <div className="ll-player__row">
        <button type="button" className="button button--ghost" disabled={!supported} onClick={() => speakLines([line], rate)}>Nghe câu {n}</button>
        <button type="button" className="button button--ghost" disabled={!supported} onClick={() => speakLines([line], 0.6)}>Nghe thật chậm</button>
      </div>
      <label htmlFor={inputId}>Gõ lại câu {n} bạn nghe được</label>
      <input id={inputId} className="ll-input" value={typed} autoComplete="off" autoCapitalize="off" spellCheck={false}
        onChange={(event) => { setTyped(event.target.value); setResult(null); }}
        onKeyDown={(event) => { if (event.key === "Enter" && typed.trim()) { const r = compareDictation(line.t, typed); setResult(r); onScore(r.score); } }} />
      <div className="ll-actions">
        <button type="button" className="button button--primary" disabled={!typed.trim()} onClick={() => { const r = compareDictation(line.t, typed); setResult(r); onScore(r.score); }}>Kiểm tra</button>
      </div>
      {result && (
        <div className="ll-dict__result" aria-live="polite">
          <p><strong>{Math.round(result.score * 100)}% số từ đúng.</strong> Từ gạch dưới là từ bạn thiếu hoặc sai:</p>
          <p className="ll-dict__words">{result.words.map((word, index) => (
            <span key={index} data-ok={word.ok}>{word.ok ? word.w : <u>{word.w}</u>}</span>
          ))}</p>
          <p className="ll-note">Câu gốc: {line.t}</p>
        </div>
      )}
    </div>
  );
}

/* ───────────── nói theo ───────────── */

export function SpeakLine({ n, line, rate, rating, onRate }: { n: number; line: LabLine; rate: number; rating: number | null; onRate: (value: number) => void }) {
  const supported = useSpeechSupported();
  const [heard, setHeard] = useState<string | null>(null);
  const match = heard ? compareDictation(line.t, heard) : null;
  return (
    <div className="ll-speak">
      <p className="ll-speak__line"><span className="ll-q__n">{n}.</span> {line.t}</p>
      <div className="ll-player__row">
        <button type="button" className="button button--ghost" disabled={!supported} onClick={() => speakLines([line], rate)}>Nghe mẫu</button>
      </div>
      <SpeakingRecorder language="en" onTranscript={setHeard}
        hint="Ghi âm rồi nghe lại, so với câu mẫu. Bản ghi chỉ ở máy này. Nếu muốn, bấm Chép lời để máy nghe thử bạn nói gì (lần đầu tải khoảng 100MB)." />
      {match && <p className="ll-note">Máy nghe được: &ldquo;{heard}&rdquo; — khớp {Math.round(match.score * 100)}% số từ. Chỉ để tham khảo.</p>}
      <div className="ll-rate" role="radiogroup" aria-label={`Tự chấm câu ${n}`}>
        <span>Tự chấm</span>
        {SPEAK_RATINGS.map((item) => (
          <button key={item.value} type="button" role="radio" className="ll-chip" aria-checked={rating === item.value} onClick={() => onRate(item.value)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
