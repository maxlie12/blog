"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { PronounceButton } from "@/components/PronounceButton";
import { getActiveLearnerProfileId, readProfileStorage, writeProfileStorage, type LearnerProfileId } from "@/lib/learnerProfiles";
import {
  CATEGORIES, PROGRESS_KEY, SCENE_KEY, STARTER, TOOL, TOOLS, WORDS, WORD_ORDER, isAnswer, parseProgress, parseSavedScene, toolOfWord, wordsIn,
  type Category, type ToolId, type VillageProgress, type WordId,
} from "@/lib/village/data";
import type { InspectInfo, Thumbs, VillageController } from "@/lib/village/scene";
import { choicesFor, dueItems, nextReview, type ReviewItem } from "@/lib/village/review";
import { PARTS, RESIDENTS, VERBS, vocabKey, type PartId, type ResidentId, type VerbId } from "@/lib/village/vocab";

type IconName = "orbit" | "look" | "hand" | "erase" | "undo" | "book" | "reset" | "sun" | "moon" | "close" | "lock" | "cards";
const ICONS: Record<IconName, ReactNode> = {
  cards: <><rect x="4" y="7" width="12" height="13" rx="2" /><path d="M8 4h10a2 2 0 0 1 2 2v12" /><path d="m7.5 13.5 2 2 3.5-4" /></>,
  look: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /><path d="M8 10.5a2.5 2.5 0 0 1 2.5-2.5" /></>,
  orbit: <><path d="M4.5 12a7.5 7.5 0 0 1 13.1-5" /><path d="M19.5 12a7.5 7.5 0 0 1-13.1 5" /><path d="M18 3.5v3.8h-3.8" /><path d="M6 20.5v-3.8h3.8" /></>,
  hand: <><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11.5V4a1.5 1.5 0 0 1 3 0v7.5" /><path d="M14 11.5V5.5a1.5 1.5 0 0 1 3 0V13" /><path d="M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.4 15a1.6 1.6 0 0 1 2.4-2.1L8 14" /></>,
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

/** A tool's picture: a line icon for the pinned tools, otherwise the small 3D preview the scene rendered. */
function ToolPic({ id, thumbs }: { id: ToolId; thumbs: Thumbs }) {
  if (id === "orbit" || id === "look" || id === "hand" || id === "erase") return <Icon name={id} />;
  const src = thumbs[id];
  // eslint-disable-next-line @next/next/no-img-element -- generated data URL, nothing for next/image to optimise
  return src ? <img src={src} alt="" width={40} height={40} draggable={false} /> : <span className="vg-pic-wait" aria-hidden="true" />;
}

type LessonMode = "unlock" | "review";
interface Question { item: ReviewItem; choices: ReviewItem[] }
type Sheet =
  | { kind: "book" } | { kind: "reset" }
  | { kind: "lesson"; word: WordId; mode: LessonMode; options: WordId[] }
  | { kind: "review"; queue: Question[] };

function shuffle<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Vocabulary keys a Look card shows, so the word book can list what was found. */
function seenKeys(info: InspectInfo) {
  const keys = info.parts.map((id) => vocabKey.part(id));
  if (info.sentence) keys.push(vocabKey.verb(info.sentence.verb));
  if ("resident" in info.title) keys.push(vocabKey.resident(info.title.resident));
  if ("part" in info.title) keys.push(vocabKey.part(info.title.part));
  return keys;
}

/** English, IPA and Vietnamese for whatever the Look card is about. */
function titleOf(info: InspectInfo): { en: string; ipa: string; vi: string; word: WordId | null } {
  if ("word" in info.title) return { en: info.title.word, ipa: WORDS[info.title.word].ipa, vi: WORDS[info.title.word].vi, word: info.title.word };
  if ("resident" in info.title) return { ...RESIDENTS[info.title.resident], word: null };
  return { ...PARTS[info.title.part], word: null };
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
  const [cat, setCat] = useState<Category>("build");
  const [thumbs, setThumbs] = useState<Thumbs>({});
  const [inspect, setInspect] = useState<InspectInfo | null>(null);
  // Review due dates are compared with this clock, refreshed every minute and when a sheet opens.
  const [now, setNow] = useState(() => Date.now());
  const due = useMemo(() => dueItems(progress, now, 99), [progress, now]);
  const [announce, setAnnounce] = useState("");
  const inspectIdRef = useRef<string | null>(null);

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
            onThumbs: setThumbs,
            onInspect: (info) => {
              setInspect(info);
              // Words met with the Look tool go into the word book.
              if (info) {
                const keys = seenKeys(info);
                setProgress((current) => {
                  const fresh = keys.filter((key) => !(key in current.seen));
                  if (!fresh.length) return current;
                  const at = Date.now();
                  return { ...current, seen: { ...current.seen, ...Object.fromEntries(fresh.map((key) => [key, at])) } };
                });
              }
              // Screen readers hear a new selection once, not every change of what someone is doing.
              if (info && info.id !== inspectIdRef.current) {
                const t = titleOf(info);
                setAnnounce(`${t.en}, ${t.vi}. ${info.sentence ? `${info.sentence.en} ${info.sentence.vi}` : ""}`);
              }
              inspectIdRef.current = info?.id ?? null;
            },
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
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
    // Distractors come from the same group (animals with animals…), which makes the choice meaningful.
    const group = wordsIn(TOOL[word].cat ?? "build").filter((w) => w !== word);
    const others = shuffle(group.length >= 3 ? group : WORD_ORDER.filter((w) => w !== word)).slice(0, 3);
    setSheet({ kind: "lesson", word, mode, options: shuffle([word, ...others]) });
  }, []);

  /** Today's review: up to ten due words, each with four choices from its own group. */
  const openReview = () => {
    const at = Date.now();
    setNow(at);
    const queue = dueItems(progress, at).map((item) => ({ item, choices: choicesFor(item) }));
    if (queue.length) setSheet({ kind: "review", queue });
  };
  const recordReview = (key: string, right: boolean) => {
    const at = Date.now();
    setProgress((current) => ({ ...current, review: { ...current.review, [key]: nextReview(current.review[key], right, at) } }));
  };

  const selectTool = (id: ToolId) => {
    if (!progress.unlocked.includes(id) && TOOL[id].cat !== null) {
      openLesson(id as WordId, "unlock");
      return;
    }
    const group = TOOL[id].cat;
    if (group) setCat(group);
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
      const prev = current.learned[word], key = `word:${word}`;
      return {
        ...current,
        learned: { ...current.learned, [word]: { at: prev?.at ?? at, reviewed: (prev?.reviewed ?? 0) + 1 } },
        // A finished practice card counts as a right answer for the daily review too.
        review: prev ? { ...current.review, [key]: nextReview(current.review[key], true, at) } : current.review,
      };
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

  const known = WORD_ORDER.filter((w) => progress.unlocked.includes(w)).length;
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
            {inspect ? (
              <InspectCard
                info={inspect}
                progress={progress}
                onClose={() => { setInspect(null); inspectIdRef.current = null; controllerRef.current?.clearInspect(); }}
                onLearn={(word) => openLesson(word, "unlock")}
              />
            ) : (
              <div className="vg-brand vg-panel">
                <h2>Làng <em>Rêu</em></h2>
                <p>{TOOL[tool].hint}</p>
              </div>
            )}
            <div className="vg-actions">
              {due.length ? (
                <button className="vg-icon" type="button" aria-label={`Ôn từ hôm nay: ${due.length} từ đến hạn`} onClick={openReview}>
                  <Icon name="cards" />
                  <span className="vg-count" aria-hidden="true">{due.length > 9 ? "9+" : due.length}</span>
                </button>
              ) : null}
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
              <div className="vg-palette vg-panel">
                <div className="vg-cats" role="group" aria-label="Nhóm đồ">
                  {CATEGORIES.map((c) => {
                    const words = wordsIn(c.id);
                    const have = words.filter((w) => progress.unlocked.includes(w)).length;
                    return (
                      <button key={c.id} type="button" className="vg-cat" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                        {c.label} <small>{have}/{words.length}</small>
                      </button>
                    );
                  })}
                </div>
                <nav className="vg-tools" aria-label={`Công cụ: ${CATEGORIES.find((c) => c.id === cat)?.label}`}>
                  {TOOLS.filter((t) => t.cat === null || t.cat === cat).map((t) => {
                    const locked = !progress.unlocked.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="vg-tool"
                        aria-pressed={tool === t.id}
                        aria-label={locked ? `${t.label}: đang khóa. Học từ “${t.id}” để mở.` : undefined}
                        data-locked={locked || undefined}
                        data-pinned={t.cat === null || undefined}
                        onClick={() => selectTool(t.id)}
                      >
                        <ToolPic id={t.id} thumbs={thumbs} />
                        <span>{t.label}</span>
                        {locked ? <i className="vg-lock"><Icon name="lock" /></i> : null}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </footer>
          ) : null}
        </div>
        <p className="vg-toast" role="status">{toast?.text}</p>
        <p className="sr-only" aria-live="polite">{announce}</p>

        <dialog
          ref={dialogRef}
          className="vg-dialog"
          aria-labelledby="vg-dialog-title"
          onClose={() => setSheet(null)}
          onClick={(event) => { if (event.target === event.currentTarget) setSheet(null); }}
        >
          {sheet?.kind === "book" ? (
            <WordBook progress={progress} thumbs={thumbs} due={due.length} onClose={() => setSheet(null)} onLearn={openLesson} onReview={openReview} />
          ) : sheet?.kind === "review" ? (
            <ReviewSession key={sheet.queue.map((q) => q.item.key).join()} queue={sheet.queue} onAnswer={recordReview} onClose={() => setSheet(null)} />
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
              thumbs={thumbs}
            />
          ) : null}
        </dialog>
      </div>
      <p className="vg-foot">
        Kéo bằng chuột hoặc một ngón tay để xây; hai ngón tay hoặc con lăn để xoay và phóng to. Công cụ Xem cho biết người và con vật đang làm gì (bằng câu tiếng Anh) và gắn nhãn tên từng bộ phận. Công cụ Tay kéo và ném bóng, thùng, bí ngô, thuyền; chạm vào người thì họ vẫy tay chào. Bàn phím: chọn khung đảo bằng Tab, mũi tên để xoay, Enter để đặt đồ (với Tay là thổi gió, với Xem là lần lượt xem người và con vật gần giữa khung nhìn), Ctrl + Z để hoàn tác.
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

function WordBook({ progress, thumbs, due, onClose, onLearn, onReview }: {
  progress: VillageProgress;
  thumbs: Thumbs;
  due: number;
  onClose: () => void;
  onLearn: (word: WordId, mode: LessonMode) => void;
  onReview: () => void;
}) {
  const known = WORD_ORDER.filter((w) => progress.unlocked.includes(w)).length;
  return (
    <SheetFrame title="Sổ từ" eyebrow="Học để mở khóa" onClose={onClose}>
      <p className="vg-muted">Đã có <b>{known}/{WORD_ORDER.length}</b> từ. Mỗi từ mới mở một món đồ để xây.</p>
      <div className="vg-review-row">
        <p className="vg-muted">
          {due ? <>Hôm nay có <b>{due}</b> từ đến hạn ôn.</> : "Hôm nay chưa có từ nào đến hạn ôn."} Từ đã học quay lại sau 1, 3, 7 rồi 14 ngày; trả lời sai thì gặp lại ngày mai.
        </p>
        {due ? <button type="button" className="button button--primary" onClick={onReview}>Ôn ngay</button> : null}
      </div>
      {CATEGORIES.map((c) => {
        const words = wordsIn(c.id);
        return (
          <section key={c.id} className="vg-words-group" aria-labelledby={`vg-words-${c.id}`}>
            <h4 id={`vg-words-${c.id}`}>{c.label} <small>{words.filter((w) => progress.unlocked.includes(w)).length}/{words.length}</small></h4>
            <ul className="vg-words">
              {words.map((word) => {
                const t = toolOfWord(word);
                const status = STARTER.includes(t.id) ? "starter" : progress.unlocked.includes(t.id) ? "learned" : "locked";
                return (
                  <li key={word} data-status={status}>
                    <span className="vg-words__icon"><ToolPic id={t.id} thumbs={thumbs} /></span>
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
          </section>
        );
      })}
      <Discovered title="Dân làng" id="residents" note="Chạm vào người trong làng bằng công cụ Xem." entries={Object.entries(RESIDENTS).map(([id, e]) => ({ key: vocabKey.resident(id as ResidentId), ...e }))} seen={progress.seen} />
      <Discovered title="Động từ" id="verbs" note="Xem người và con vật đang làm gì để gặp thêm động từ." entries={Object.entries(VERBS).map(([id, e]) => ({ key: vocabKey.verb(id as VerbId), ...e, extra: e.ing }))} seen={progress.seen} />
      <Discovered title="Bộ phận" id="parts" note="Chạm vào nhà, cối xay, con bò… để thấy tên từng bộ phận." entries={Object.entries(PARTS).map(([id, e]) => ({ key: vocabKey.part(id as PartId), ...e }))} seen={progress.seen} />
      <p className="vg-note">
        Đây là ôn từ vựng nhanh để mở đồ chơi, không phải bài kiểm tra trình độ. Không tính vào Done, nhịp học hay bài nộp. Tiến độ lưu trên trình duyệt này, theo hồ sơ học đang chọn.
      </p>
    </SheetFrame>
  );
}

/** Today's review: pick the English for each Vietnamese meaning; a miss is asked again at the end. */
function ReviewSession({ queue, onAnswer, onClose }: { queue: Question[]; onAnswer: (key: string, right: boolean) => void; onClose: () => void }) {
  const [order, setOrder] = useState(queue);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const firstRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (picked ? nextRef.current : firstRef.current)?.focus();
  }, [index, picked]);

  const q = order[index];
  if (!q) {
    const keys = Object.keys(answered), right = keys.filter((key) => answered[key]).length;
    const missed = queue.filter((x) => answered[x.item.key] === false).map((x) => x.item);
    return (
      <SheetFrame title="Ôn xong!" eyebrow="Ôn từ hôm nay" onClose={onClose}>
        <p className="vg-q">Đúng ngay lần đầu <b>{right}/{keys.length}</b> từ.</p>
        {missed.length ? (
          <ul className="vg-words vg-words--found">
            {missed.map((item) => (
              <li key={item.key}>
                <span className="vg-words__text"><strong lang="en">{item.en}</strong> <span className="vg-ipa">{item.ipa}</span><small>{item.vi}</small></span>
                <span className="vg-words__acts"><PronounceButton text={item.en} /></span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="vg-muted">Từ trả lời đúng sẽ quay lại sau 3, 7 rồi 14 ngày; từ sai gặp lại ngày mai. Phần ôn này không tính vào Done hay nhịp học.</p>
        <div className="vg-row"><button ref={nextRef} type="button" className="button button--primary" onClick={onClose}>Xong</button></div>
      </SheetFrame>
    );
  }

  const correct = q.item.key;
  const choose = (key: string) => {
    if (picked) return;
    setPicked(key);
    if (correct in answered) return;
    const right = key === correct;
    onAnswer(correct, right);
    setAnswered({ ...answered, [correct]: right });
    if (!right) setOrder([...order, q]);
  };
  return (
    <SheetFrame title="Ôn từ hôm nay" eyebrow={`Câu ${index + 1}/${order.length} · ${q.item.groupLabel}`} onClose={onClose}>
      <p className="vg-q">Từ nào nghĩa là “{q.item.vi}”?</p>
      <div className="vg-options">
        {q.choices.map((c, i) => (
          <button
            key={c.key}
            ref={i === 0 ? firstRef : undefined}
            type="button"
            className="vg-option"
            lang="en"
            data-state={picked && c.key === correct ? "right" : picked === c.key ? "wrong" : undefined}
            disabled={picked !== null}
            onClick={() => choose(c.key)}
          >
            {c.en}
          </button>
        ))}
      </div>
      <p className="vg-feedback" data-tone={picked ? (picked === correct ? "right" : "wrong") : undefined} aria-live="polite">
        {picked ? (picked === correct ? "Đúng rồi!" : `Chưa đúng. “${q.item.vi}” là “${q.item.en}”; từ này sẽ hỏi lại cuối lượt.`) : ""}
      </p>
      {picked ? (
        <div className="vg-row">
          <span lang="en"><b>{q.item.en}</b> <span className="vg-ipa">{q.item.ipa}</span></span>
          <PronounceButton text={q.item.en} />
          <button ref={nextRef} type="button" className="button button--primary" onClick={() => { setPicked(null); setIndex(index + 1); }}>Tiếp</button>
        </div>
      ) : null}
    </SheetFrame>
  );
}

/** Words found with the Look tool: listed once seen, the rest only counted. */
function Discovered({ title, id, note, entries, seen }: {
  title: string;
  id: string;
  note: string;
  entries: { key: string; en: string; ipa: string; vi: string; extra?: string }[];
  seen: Record<string, number>;
}) {
  const found = entries.filter((e) => e.key in seen);
  return (
    <section className="vg-words-group" aria-labelledby={`vg-words-${id}`}>
      <h4 id={`vg-words-${id}`}>{title} <small>{found.length}/{entries.length}</small></h4>
      {found.length ? (
        <ul className="vg-words vg-words--found">
          {found.map((e) => (
            <li key={e.key}>
              <span className="vg-words__text">
                <strong lang="en">{e.en}</strong> <span className="vg-ipa">{e.ipa}</span>
                <small>{e.vi}{e.extra ? <> · <span lang="en">{e.extra}</span></> : null}</small>
              </span>
              <span className="vg-words__acts"><PronounceButton text={e.en} /></span>
            </li>
          ))}
        </ul>
      ) : null}
      {found.length < entries.length ? <p className="vg-muted vg-small">{note} Còn {entries.length - found.length} từ chưa gặp.</p> : null}
    </section>
  );
}

/** “The farmer is watering the vegetables.” with the -ing verb marked. */
function Highlighted({ text, word }: { text: string; word: string }) {
  const at = text.indexOf(` ${word}`);
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at + 1)}<mark>{word}</mark>{text.slice(at + 1 + word.length)}</>;
}

/** The Look tool's card: the name, what they are doing, and the parts labelled on the model. */
function InspectCard({ info, progress, onClose, onLearn }: {
  info: InspectInfo;
  progress: VillageProgress;
  onClose: () => void;
  onLearn: (word: WordId) => void;
}) {
  const title = titleOf(info);
  const locked = title.word !== null && !progress.unlocked.includes(title.word);
  const verb = info.sentence ? VERBS[info.sentence.verb] : null;
  return (
    <section className="vg-inspect vg-panel" aria-labelledby="vg-inspect-title">
      <div className="vg-inspect__head">
        <h3 id="vg-inspect-title"><span lang="en">{title.en}</span> <span className="vg-ipa">{title.ipa}</span></h3>
        <PronounceButton text={title.en} />
        <button type="button" className="vg-close" aria-label="Đóng thẻ xem" onClick={onClose}><Icon name="close" /></button>
      </div>
      <p className="vg-inspect__vi">{title.vi}</p>
      {locked && title.word ? (
        <button type="button" className="vg-mini vg-mini--go" onClick={() => onLearn(title.word as WordId)}>Học từ này để mở {TOOL[title.word].label.toLowerCase()}</button>
      ) : null}
      {info.sentence && verb ? (
        <div className="vg-inspect__say">
          <p lang="en"><Highlighted text={info.sentence.en} word={info.sentence.highlight} /></p>
          <p className="vg-muted">{info.sentence.vi}</p>
          <div className="vg-inspect__verb">
            <PronounceButton text={info.sentence.en} label="Nghe câu" />
            <span><span lang="en"><b>{verb.en}</b> → {verb.ing}</span> <span className="vg-ipa">{verb.ipa}</span> · {verb.vi}</span>
          </div>
        </div>
      ) : null}
      {info.parts.length ? (
        <ul className="vg-inspect__parts" aria-label="Bộ phận có nhãn trên mô hình">
          {info.parts.map((id) => (
            <li key={id}>
              <PronounceButton text={id} />
              <span><span lang="en">{id}</span> <small>{PARTS[id].vi}</small></span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Lesson({
  word, mode, options, canUse, thumbs, onClose, onComplete, onBook, onUse,
}: {
  word: WordId;
  mode: LessonMode;
  options: WordId[];
  canUse: boolean;
  thumbs: Thumbs;
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
      <div className="vg-done"><ToolPic id={tool.id} thumbs={thumbs} /></div>
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
