"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { PronounceButton } from "@/components/PronounceButton";
import { getActiveLearnerProfileId, readProfileStorage, writeProfileStorage, type LearnerProfileId } from "@/lib/learnerProfiles";
import {
  PROGRESS_KEY, SCENE_KEY, STARTER, TOOL, TOOLS, WORDS, WORD_ORDER, isAnswer, parseProgress, parseSavedScene, toolOfWord,
  type ToolId, type VillageProgress, type WordId,
} from "@/lib/village/data";
import type { VillageController } from "@/lib/village/scene";

type IconName = ToolId | "undo" | "book" | "reset" | "sun" | "moon" | "close" | "lock";
const ICONS: Record<IconName, ReactNode> = {
  orbit: <><path d="M4.5 12a7.5 7.5 0 0 1 13.1-5" /><path d="M19.5 12a7.5 7.5 0 0 1-13.1 5" /><path d="M18 3.5v3.8h-3.8" /><path d="M6 20.5v-3.8h3.8" /></>,
  path: <path d="M6 21c1-3 4-4 6-5.5S15 12 13 9.5 10 6 13 3" strokeDasharray="2.2 2.6" />,
  wall: <><path d="M3 20V10h3V7h3v3h2V7h2v3h2V7h3v3h3v10z" /><path d="M3 15h18M8 15v5M16 15v5M12 10v5" /></>,
  house: <><path d="M3.5 11 12 4.5l8.5 6.5" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  tree: <><path d="M12 21v-5" /><path d="M12 3.5c-3.5 0-6 2.6-6 5.8 0 3.3 2.7 6.2 6 6.2s6-2.9 6-6.2c0-3.2-2.5-5.8-6-5.8z" /></>,
  tower: <><path d="M7 21V10H5.5V5.5H8V7h2V5.5h4V7h2V5.5h2.5V10H17v11z" /><path d="M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21" /></>,
  fence: <><path d="M5 21V7l1.5-2.5L8 7v14M11 21V7l1.5-2.5L14 7v14M17 21V7l1.5-2.5L20 7v14" /><path d="M3 11h18M3 16h18" /></>,
  well: <><path d="M4 8.5 12 4l8 4.5" /><path d="M6.5 7.2V13M17.5 7.2V13M12 6v5" /><path d="M5 13h14v7H5z" /></>,
  pond: <><ellipse cx="12" cy="14" rx="9" ry="5.5" /><path d="M7.5 14.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0" /></>,
  windmill: <><path d="M12 10 6 4M12 10l6-6M12 10l-6 6M12 10l6 6" /><path d="M10 21l1.2-8.5h1.6L14 21" /></>,
  lantern: <><path d="M12 2.5v3" /><path d="M8.5 7.5h7l.8 2.5v6l-.8 2.5h-7l-.8-2.5v-6z" /><path d="M10 21h4M12 10.5v4" /></>,
  sheep: <><path d="M6.5 16.5a3 3 0 0 1-.6-5.9 4 4 0 0 1 7.3-2 3.3 3.3 0 0 1 4.2 3.1 2.7 2.7 0 0 1-1.6 4.8z" /><path d="M9 16.5V20M14.5 16.5V20" /><circle cx="19" cy="10.5" r="1.6" /></>,
  erase: <><path d="M9 20h11" /><path d="m4.5 15.5 9-9.5 5.5 5.2-8.6 8.8H8.5z" /><path d="m9.5 10.8 5.2 5" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  book: <><path d="M5 4.5h10A2.5 2.5 0 0 1 17.5 7v13.5H7.5A2.5 2.5 0 0 1 5 18z" /><path d="M5 18a2.5 2.5 0 0 1 2.5-2.5h10" /><path d="M20 6.5v14" /><path d="M8.5 8h6" /></>,
  reset: <><path d="M4 4v5h5" /><path d="M5.3 14a7.5 7.5 0 1 0 1.5-7.8L4 9" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};
function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

type LessonMode = "unlock" | "review";
type Sheet = { kind: "book" } | { kind: "reset" } | { kind: "lesson"; word: WordId; mode: LessonMode; options: WordId[] };

function shuffle<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Renders a sentence with its blank replaced by `fill`. */
function Sentence({ text, fill }: { text: string; fill: ReactNode }) {
  const [before, after] = text.split("___");
  return <>{before}{fill}{after}</>;
}

export default function VillageGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const controllerRef = useRef<VillageController | null>(null);
  const profileRef = useRef<LearnerProfileId | null>(null);
  const storageWarned = useRef(false);
  const toolRef = useRef<ToolId>("wall");
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [progress, setProgress] = useState<VillageProgress>(() => parseProgress(null));
  const [tool, setToolState] = useState<ToolId>("wall");
  const [canUndo, setCanUndo] = useState(false);
  const [toast, setToast] = useState<{ text: string } | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const say = useCallback((text: string) => {
    setToast({ text });
  }, []);

  const store = useCallback((key: string, value: string) => {
    if (!profileRef.current) return;
    try {
      writeProfileStorage(key, value, profileRef.current);
    } catch {
      if (storageWarned.current) return;
      storageWarned.current = true;
      say("Trình duyệt đang chặn lưu trữ, nên làng chỉ giữ trong lần mở này.");
    }
  }, [say]);

  /* Load the profile's saves, then three.js and the scene, only on the client. */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let controller: VillageController | null = null;
    const frame = window.requestAnimationFrame(() => {
      const profileId = getActiveLearnerProfileId();
      let sceneRaw: string | null = null, progressRaw: string | null = null;
      try {
        sceneRaw = readProfileStorage(SCENE_KEY, profileId);
        progressRaw = readProfileStorage(PROGRESS_KEY, profileId);
      } catch {
        // Storage blocked: start fresh for this visit.
      }
      profileRef.current = profileId;
      const loaded = parseProgress(progressRaw);
      setProgress(loaded);
      const saved = parseSavedScene(sceneRaw);
      const probe = document.createElement("canvas");
      if (!(probe.getContext("webgl2") ?? probe.getContext("webgl"))) {
        setStatus("unavailable");
        return;
      }
      import("@/lib/village/scene")
        .then(({ createVillageScene }) => {
          if (cancelled) return;
          controller = createVillageScene(mount, {
            saved,
            time: loaded.time,
            onToast: say,
            onUndoChange: setCanUndo,
            onSave: (raw) => store(SCENE_KEY, raw),
            onReady: () => setStatus("ready"),
          });
          controller.setTool(toolRef.current);
          controllerRef.current = controller;
          say(saved ? "Chào mừng trở lại làng của bạn." : "Đây là làng mẫu. Kéo trên cỏ để xây tường, hoặc mở Sổ từ để mở khóa thêm đồ.");
        })
        .catch(() => {
          if (!cancelled) setStatus("unavailable");
        });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      controller?.dispose();
      controllerRef.current = null;
    };
  }, [say, store]);

  useEffect(() => {
    store(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress, store]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.text.length > 60 ? 4200 : 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (sheet && !dialog.open) dialog.showModal();
    if (!sheet && dialog.open) dialog.close();
  }, [sheet]);

  const openLesson = useCallback((word: WordId, mode: LessonMode) => {
    const others = shuffle(WORD_ORDER.filter((w) => w !== word)).slice(0, 3);
    setSheet({ kind: "lesson", word, mode, options: shuffle([word, ...others]) });
  }, []);

  const selectTool = (id: ToolId) => {
    const word = TOOL[id].word;
    if (!progress.unlocked.includes(id) && word) {
      openLesson(word, "unlock");
      return;
    }
    toolRef.current = id;
    setToolState(id);
    controllerRef.current?.setTool(id);
  };

  /** Records a finished lesson. Returns true when it unlocked a new piece. */
  const completeLesson = (word: WordId, mode: LessonMode) => {
    const id = toolOfWord(word).id;
    const at = Date.now();
    const firstTime = mode === "unlock" && !progress.unlocked.includes(id);
    setProgress((current) => {
      if (firstTime) return { ...current, unlocked: [...current.unlocked, id], learned: { ...current.learned, [word]: { at } } };
      const prev = current.learned[word];
      return { ...current, learned: { ...current.learned, [word]: { at: prev?.at ?? at, reviewed: (prev?.reviewed ?? 0) + 1 } } };
    });
    return firstTime;
  };

  const onStageKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (sheet || event.target instanceof HTMLInputElement) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      controllerRef.current?.undo();
    }
  };

  const known = WORD_ORDER.filter((w) => progress.unlocked.includes(toolOfWord(w).id)).length;
  const timeValue = Math.round(progress.time * 100);

  return (
    <div className="vg">
      <div className="vg-stage" onKeyDown={onStageKey}>
        <div ref={mountRef} className="vg-scene" data-mode={tool} />
        {status !== "ready" ? (
          <div className="vg-fallback" role="status">
            <p className="vg-fallback__name">Làng Rêu</p>
            <p>{status === "loading" ? "Đang dựng hòn đảo…" : "Thiết bị này không chạy được 3D (WebGL). Bạn vẫn có thể mở Sổ từ để học từ mới."}</p>
          </div>
        ) : null}

        <div className="vg-hud">
          <header className="vg-top">
            <div className="vg-brand vg-panel">
              <h2>Làng <em>Rêu</em></h2>
              <p>{TOOL[tool].hint}</p>
            </div>
            <div className="vg-actions">
              {status === "ready" ? (
                <button className="vg-icon" type="button" aria-label="Hoàn tác" disabled={!canUndo} onClick={() => controllerRef.current?.undo()}>
                  <Icon name="undo" />
                </button>
              ) : null}
              <button className="vg-icon" type="button" aria-label={`Sổ từ: đã có ${known} trên ${WORD_ORDER.length} từ`} onClick={() => setSheet({ kind: "book" })}>
                <Icon name="book" />
                <span className="vg-count" aria-hidden="true">{known}/{WORD_ORDER.length}</span>
              </button>
              {status === "ready" ? (
                <button className="vg-icon" type="button" aria-label="Làm mới làng" onClick={() => setSheet({ kind: "reset" })}>
                  <Icon name="reset" />
                </button>
              ) : null}
            </div>
          </header>

          {status === "ready" ? (
            <footer className="vg-dock">
              <div className="vg-time vg-panel">
                <Icon name="sun" />
                <label htmlFor="vg-time" className="sr-only">Giờ trong ngày</label>
                <input
                  id="vg-time"
                  type="range"
                  min={0}
                  max={100}
                  value={timeValue}
                  aria-valuetext={timeValue < 60 ? "Ban ngày" : timeValue < 85 ? "Hoàng hôn" : "Ban đêm"}
                  onChange={(event) => {
                    const time = Number(event.target.value) / 100;
                    controllerRef.current?.setTime(time);
                    setProgress((current) => ({ ...current, time }));
                  }}
                />
                <Icon name="moon" />
              </div>
              <nav className="vg-tools vg-panel" aria-label="Công cụ xây dựng">
                {TOOLS.map((t, i) => {
                  const locked = !progress.unlocked.includes(t.id);
                  const groupStart = i > 0 && (t.id === "tower" || t.id === "erase");
                  return (
                    <span key={t.id} className="vg-tool-slot">
                      {groupStart ? <span className="vg-sep" aria-hidden="true" /> : null}
                      <button
                        type="button"
                        className="vg-tool"
                        aria-pressed={tool === t.id}
                        aria-label={locked ? `${t.label}: đang khóa. Học từ “${t.word}” để mở.` : undefined}
                        data-locked={locked || undefined}
                        onClick={() => selectTool(t.id)}
                      >
                        <Icon name={t.id} />
                        <span>{t.label}</span>
                        {locked ? <i className="vg-lock"><Icon name="lock" /></i> : null}
                      </button>
                    </span>
                  );
                })}
              </nav>
            </footer>
          ) : null}
        </div>
        <p className="vg-toast" role="status">{toast?.text}</p>

        <dialog
          ref={dialogRef}
          className="vg-dialog"
          aria-labelledby="vg-dialog-title"
          onClose={() => setSheet(null)}
          onClick={(event) => { if (event.target === event.currentTarget) setSheet(null); }}
        >
          {sheet?.kind === "book" ? (
            <WordBook progress={progress} onClose={() => setSheet(null)} onLearn={openLesson} />
          ) : sheet?.kind === "reset" ? (
            <SheetFrame title="Làm mới làng" onClose={() => setSheet(null)}>
              <p className="vg-muted">Các món đồ đã mở khóa vẫn được giữ lại. Lỡ tay thì bấm Hoàn tác.</p>
              <div className="vg-row">
                <button type="button" className="button button--danger" onClick={() => { controllerRef.current?.reset("empty"); setSheet(null); }}>Xóa hết, bắt đầu đảo trống</button>
                <button type="button" className="button button--ghost" onClick={() => { controllerRef.current?.reset("sample"); setSheet(null); }}>Khôi phục làng mẫu</button>
                <button type="button" className="button button--ghost" onClick={() => setSheet(null)}>Hủy</button>
              </div>
            </SheetFrame>
          ) : sheet?.kind === "lesson" ? (
            <Lesson
              key={`${sheet.word}-${sheet.mode}-${sheet.options.join()}`}
              word={sheet.word}
              mode={sheet.mode}
              options={sheet.options}
              onClose={() => setSheet(null)}
              onComplete={completeLesson}
              onBook={() => setSheet({ kind: "book" })}
              onUse={(id) => {
                setSheet(null);
                selectTool(id);
                say(TOOL[id].hint);
              }}
              canUse={status === "ready"}
            />
          ) : null}
        </dialog>
      </div>
      <p className="vg-foot">
        Kéo bằng chuột hoặc một ngón tay để xây; hai ngón tay hoặc con lăn để xoay và phóng to. Bàn phím: chọn khung đảo bằng Tab, mũi tên để xoay, Enter để đặt đồ, Ctrl + Z để hoàn tác.
      </p>
    </div>
  );
}

function SheetFrame({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="vg-sheet">
      <div className="vg-sheet__head">
        <div>
          {eyebrow ? <p className="vg-eyebrow">{eyebrow}</p> : null}
          <h3 id="vg-dialog-title">{title}</h3>
        </div>
        <button type="button" className="vg-close" aria-label="Đóng" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="vg-sheet__body">{children}</div>
    </div>
  );
}

function WordBook({ progress, onClose, onLearn }: { progress: VillageProgress; onClose: () => void; onLearn: (word: WordId, mode: LessonMode) => void }) {
  const known = WORD_ORDER.filter((w) => progress.unlocked.includes(toolOfWord(w).id)).length;
  return (
    <SheetFrame title="Sổ từ" eyebrow="Học để mở khóa" onClose={onClose}>
      <p className="vg-muted">Đã có <b>{known}/{WORD_ORDER.length}</b> từ. Mỗi từ mới mở một món đồ để xây.</p>
      <ul className="vg-words">
        {WORD_ORDER.map((word) => {
          const t = toolOfWord(word);
          const status = STARTER.includes(t.id) ? "starter" : progress.unlocked.includes(t.id) ? "learned" : "locked";
          return (
            <li key={word} data-status={status}>
              <span className="vg-words__icon"><Icon name={t.id} /></span>
              <span className="vg-words__text">
                <strong lang="en">{word}</strong> <span className="vg-ipa">{WORDS[word].ipa}</span>
                <small>{WORDS[word].vi} · {t.label} · {status === "starter" ? "Có sẵn" : status === "learned" ? "Đã học" : "Khóa"}</small>
              </span>
              <span className="vg-words__acts">
                <PronounceButton text={word} />
                <button type="button" className={status === "locked" ? "vg-mini vg-mini--go" : "vg-mini"} aria-label={`${status === "locked" ? "Học" : "Ôn"} từ ${word}`} onClick={() => onLearn(word, status === "locked" ? "unlock" : "review")}>
                  {status === "locked" ? "Học" : "Ôn"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="vg-note">
        Đây là ôn từ vựng nhanh để mở đồ chơi, không phải bài kiểm tra trình độ. Không tính vào Done, nhịp học hay bài nộp. Tiến độ lưu trên trình duyệt này, theo hồ sơ học đang chọn.
      </p>
    </SheetFrame>
  );
}

function Lesson({
  word, mode, options, canUse, onClose, onComplete, onBook, onUse,
}: {
  word: WordId;
  mode: LessonMode;
  options: WordId[];
  canUse: boolean;
  onClose: () => void;
  onComplete: (word: WordId, mode: LessonMode) => boolean;
  onBook: () => void;
  onUse: (id: ToolId) => void;
}) {
  const data = WORDS[word];
  const tool = toolOfWord(word);
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState<WordId[]>([]);
  const [picked, setPicked] = useState(false);
  const [typed, setTyped] = useState("");
  const [misses, setMisses] = useState(0);
  const [unlockedNow, setUnlockedNow] = useState(false);
  const focusRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (inputRef.current ?? focusRef.current)?.focus();
  }, [step]);

  const title = mode === "unlock" ? `Mở khóa ${tool.label}` : `Ôn từ “${word}”`;
  const eyebrow = mode === "unlock" ? "Học từ để mở đồ" : "Ôn lại";
  const steps = (
    <div className="vg-steps" role="img" aria-label={`Bước ${Math.min(step + 1, 3)} trên 3`}>
      {[0, 1, 2].map((i) => <span key={i} data-on={i <= step || undefined} />)}
    </div>
  );

  const choose = (option: WordId) => {
    if (option !== word) {
      setWrong((list) => [...list, option]);
      return;
    }
    setPicked(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => setStep(2), reduce ? 300 : 750);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isAnswer(typed, word)) {
      setUnlockedNow(onComplete(word, mode));
      setStep(3);
      return;
    }
    setMisses((n) => n + 1);
    inputRef.current?.select();
  };

  if (step === 0) {
    return (
      <SheetFrame title={title} eyebrow={eyebrow} onClose={onClose}>
        {steps}
        <div className="vg-word">
          <div className="vg-word__row">
            <span className="vg-word__en" lang="en">{word}</span>
            <span className="vg-ipa">{data.ipa}</span>
            <PronounceButton text={word} />
          </div>
          <p className="vg-word__vi">{data.vi}</p>
        </div>
        <p className="vg-example" lang="en"><Sentence text={data.sentence} fill={<mark>{word}</mark>} /></p>
        <p className="vg-muted">{data.viS}</p>
        {data.tip ? <p className="vg-tip">{data.tip}</p> : null}
        <div className="vg-row">
          <PronounceButton text={data.sentence.replace("___", word)} label="Nghe câu" />
          <button ref={focusRef} type="button" className="button button--primary" onClick={() => setStep(1)}>Tôi nhớ rồi, kiểm tra nhanh</button>
        </div>
      </SheetFrame>
    );
  }

  if (step === 1) {
    const lastWrong = wrong.at(-1);
    return (
      <SheetFrame title={title} eyebrow={eyebrow} onClose={onClose}>
        {steps}
        <p className="vg-q">Từ nào nghĩa là “{data.vi}”?</p>
        <div className="vg-options">
          {options.map((option, i) => {
            const state = picked && option === word ? "right" : wrong.includes(option) ? "wrong" : undefined;
            return (
              <button
                key={option}
                ref={i === 0 ? focusRef : undefined}
                type="button"
                className="vg-option"
                lang="en"
                data-state={state}
                disabled={picked || wrong.includes(option)}
                onClick={() => choose(option)}
              >
                {option}
              </button>
            );
          })}
        </div>
        <p className="vg-feedback" data-tone={picked ? "right" : lastWrong ? "wrong" : undefined} aria-live="polite">
          {picked ? "Đúng rồi!" : lastWrong ? `Chưa đúng: “${lastWrong}” nghĩa là ${WORDS[lastWrong].vi}. Thử lại nhé.` : ""}
        </p>
      </SheetFrame>
    );
  }

  if (step === 2) {
    return (
      <SheetFrame title={title} eyebrow={eyebrow} onClose={onClose}>
        {steps}
        <p className="vg-q">Gõ từ còn thiếu vào câu:</p>
        <form id="vg-fill" className="vg-fill" lang="en" autoComplete="off" onSubmit={submit}>
          <Sentence
            text={data.sentence}
            fill={
              <input
                ref={inputRef}
                aria-label="Từ còn thiếu"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                style={{ width: `${Math.max(6, word.length + 2)}ch` }}
              />
            }
          />
        </form>
        <p className="vg-muted">{data.viS}</p>
        <p className="vg-feedback" data-tone={misses ? "wrong" : undefined} aria-live="polite">
          {misses === 1 ? `Chưa đúng. Gợi ý: bắt đầu bằng “${word[0]}”, có ${word.length} chữ cái.` : misses > 1 ? `Đáp án là “${word}”. Gõ lại một lần để nhớ nhé.` : ""}
        </p>
        <div className="vg-row"><button type="submit" form="vg-fill" className="button button--primary">Kiểm tra</button></div>
      </SheetFrame>
    );
  }

  return (
    <SheetFrame title={unlockedNow ? `Đã mở khóa ${tool.label}!` : "Ôn xong!"} eyebrow={word} onClose={onClose}>
      <div className="vg-done"><Icon name={tool.id} /></div>
      <p className="vg-example" lang="en"><Sentence text={data.sentence} fill={<mark>{word}</mark>} /></p>
      <p className="vg-muted">{data.viS}</p>
      <div className="vg-row">
        {mode === "unlock" && canUse ? (
          <button ref={focusRef} type="button" className="button button--primary" onClick={() => onUse(tool.id)}>Dùng {tool.label} ngay</button>
        ) : (
          <button ref={focusRef} type="button" className="button button--primary" onClick={onClose}>Xong</button>
        )}
        <PronounceButton text={data.sentence.replace("___", word)} label="Nghe câu" />
        <button type="button" className="button button--ghost" onClick={onBook}>Mở Sổ từ</button>
      </div>
    </SheetFrame>
  );
}
