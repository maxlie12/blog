"use client";

import { useEffect, useState } from "react";
import { PronounceButton } from "@/components/PronounceButton";
import { SpeakingRecorder } from "@/components/SpeakingRecorder";
import type { StudyTerm } from "@/lib/content";
import { readProfileStorage, writeProfileStorage } from "@/lib/learnerProfiles";
import { compareReading } from "@/lib/studyText";

export interface PracticeTopic {
  slug: string;
  title: string;
  words: StudyTerm[];
  paragraphs: string[];
}

const KNOWN_KEY = "study-words-known-v1";

function readKnown(): string[] {
  try {
    const stored: unknown = JSON.parse(readProfileStorage(KNOWN_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function WordCards({ topic, known, setKnown }: { topic: PracticeTopic; known: string[]; setKnown: (next: string[]) => void }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const remaining = topic.words.filter((word) => !known.includes(word.term));
  // "Chưa nhớ" sends a word to the back of this session's queue.
  const queue = [
    ...remaining.filter((word) => !skipped.includes(word.term)),
    ...skipped.flatMap((term) => remaining.filter((word) => word.term === term)),
  ];
  const word = queue[0];

  function answer(remembered: boolean) {
    setRevealed(false);
    setSkipped((list) => [...list.filter((term) => term !== word.term), ...(remembered ? [] : [word.term])]);
    if (remembered) setKnown([...known, word.term]);
  }

  if (!word) {
    return (
      <div className="free-card">
        <p>Bạn đã đánh dấu nhớ hết {topic.words.length} từ của chủ đề này.</p>
        <div className="free-card__actions">
          <button type="button" className="button button--ghost" onClick={() => setKnown(known.filter((term) => !topic.words.some((item) => item.term === term)))}>
            Ôn lại từ đầu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="free-card">
      <p className="free-card__count">Đã nhớ {topic.words.length - remaining.length}/{topic.words.length}</p>
      <div className="free-card__word">
        <strong lang="en">{word.term}</strong>
        <PronounceButton text={word.term} />
      </div>
      <p className="free-card__meta">{word.pos}{word.ipa && <span lang="en"> · {word.ipa}</span>}</p>
      {revealed ? (
        <>
          <p>{word.meaning}</p>
          {word.example && <p className="free-card__example" lang="en">{word.example}</p>}
          <div className="free-card__actions">
            <button type="button" className="button button--ghost" onClick={() => answer(false)}>Chưa nhớ</button>
            <button type="button" className="button button--primary" onClick={() => answer(true)}>Đã nhớ</button>
          </div>
        </>
      ) : (
        <div className="free-card__actions">
          <button type="button" className="button button--primary" onClick={() => setRevealed(true)}>Tự nhớ nghĩa rồi bấm để xem</button>
        </div>
      )}
    </div>
  );
}

function ReadAloud({ topic }: { topic: PracticeTopic }) {
  const [index, setIndex] = useState(0);
  const [spoken, setSpoken] = useState<string | null>(null);
  const paragraph = topic.paragraphs[index];
  const result = spoken === null ? null : compareReading(paragraph, spoken);

  function go(next: number) {
    setIndex(next);
    setSpoken(null);
  }

  return (
    <div className="free-card">
      <p className="free-card__count">Đoạn {index + 1}/{topic.paragraphs.length}</p>
      <p className="free-read" lang="en">
        {result
          ? result.map((word, i) => <span key={i} className={word.matched ? undefined : "free-read__missed"}>{word.text} </span>)
          : paragraph}
      </p>
      {result && (
        <p role="status">
          Khớp {result.filter((word) => word.matched).length}/{result.length} từ. Từ gạch chân là từ chưa thấy trong bản chép lời.
          Đây là so sánh chữ, không phải điểm phát âm.
        </p>
      )}
      <div className="free-card__actions">
        <PronounceButton text={paragraph} label="Nghe mẫu" />
        <button type="button" className="button button--ghost" disabled={index === 0} onClick={() => go(index - 1)}>Đoạn trước</button>
        <button type="button" className="button button--ghost" disabled={index === topic.paragraphs.length - 1} onClick={() => go(index + 1)}>Đoạn sau</button>
      </div>
      <SpeakingRecorder
        key={`${topic.slug}-${index}`}
        language="en"
        onTranscript={setSpoken}
        hint="Bản ghi ở lại trên máy này. Lần chép lời đầu tiên tải khoảng 100MB, sau đó được lưu sẵn."
      />
    </div>
  );
}

/** Practice for days without a lesson. It writes no Done, streak or attempt. */
export function FreePractice({ topics, initialSlug }: { topics: PracticeTopic[]; initialSlug?: string }) {
  const [slug, setSlug] = useState(topics.some((topic) => topic.slug === initialSlug) ? initialSlug : topics[0].slug);
  const [mode, setMode] = useState<"words" | "read">("words");
  const [known, setKnownState] = useState<string[]>([]);
  const topic = topics.find((item) => item.slug === slug) ?? topics[0];

  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage exists only after hydration
  useEffect(() => setKnownState(readKnown()), []);

  function setKnown(next: string[]) {
    setKnownState(next);
    try {
      writeProfileStorage(KNOWN_KEY, JSON.stringify(next));
    } catch {
      // Blocked storage only means the marks last for this visit.
    }
  }

  function switchTopic() {
    const others = topics.filter((item) => item.slug !== topic.slug);
    if (others.length) setSlug(others[Math.floor(Math.random() * others.length)].slug);
  }

  return (
    <div className="free-practice">
      <fieldset className="free-topics">
        <legend>Chủ đề</legend>
        {topics.map((item) => (
          <label key={item.slug}>
            <input type="radio" name="topic" checked={item.slug === topic.slug} onChange={() => setSlug(item.slug)} />
            <span lang="en">{item.title}</span>
          </label>
        ))}
        {topics.length > 1 && <button type="button" className="button button--ghost" onClick={switchTopic}>Đổi chủ đề ngẫu nhiên</button>}
      </fieldset>

      <div className="free-modes" role="group" aria-label="Cách luyện">
        <button type="button" className="button button--ghost" aria-pressed={mode === "words"} onClick={() => setMode("words")}>Từ mới</button>
        <button type="button" className="button button--ghost" aria-pressed={mode === "read"} onClick={() => setMode("read")}>Đọc to</button>
      </div>

      {mode === "words"
        ? <WordCards key={topic.slug} topic={topic} known={known} setKnown={setKnown} />
        : <ReadAloud key={topic.slug} topic={topic} />}
    </div>
  );
}
