"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SpeakingRecorder } from "@/components/SpeakingRecorder";
import { readProfileStorage, writeProfileStorage } from "@/lib/learnerProfiles";
import { LEVELS } from "@/lib/listeningLab";
import { dateInLearningTimezone, getLocalCompletionSummary, recordLocalCompletion } from "@/lib/localLearningProgress";
import {
  FLUENCY_ROUNDS, READINESS_LABEL, RESCUE, SITUATIONS, SPEAK_STORE_KEY, TURN_RATINGS, dueSituations, emptySpeakRecord,
  nextSituation, parseSpeakStore, readiness, withSpeakResult, type SpeakCase, type SpeakChunk, type SpeakRecord,
  type SpeakSituation, type SpeakStore,
} from "@/lib/speakingRoom";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import { percent, speakLines, stopSpeech, useSpeechSupported } from "./labShared";

const SPEAK_CHANGED = "speaking-room-changed";

function loadSpeak(): SpeakStore {
  try { return parseSpeakStore(readProfileStorage(SPEAK_STORE_KEY)); } catch { return parseSpeakStore(null); }
}

function saveSpeak(store: SpeakStore): boolean {
  try {
    writeProfileStorage(SPEAK_STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(SPEAK_CHANGED));
    return true;
  } catch {
    return false;
  }
}

function useSpeakStore(): SpeakStore | null {
  const learner = useLearnerProfile();
  const [store, setStore] = useState<SpeakStore | null>(null);
  useEffect(() => {
    const read = () => setStore(loadSpeak());
    read();
    window.addEventListener(SPEAK_CHANGED, read);
    return () => window.removeEventListener(SPEAK_CHANGED, read);
  }, [learner.id]);
  return store;
}

const say = (text: string, rate = 0.9) => speakLines([{ t: text }], rate);
const levelName = (situation: SpeakSituation) => LEVELS.find((level) => level.id === situation.level)!.name;

function SayButton({ text, label = "Nghe" }: { text: string; label?: string }) {
  const supported = useSpeechSupported();
  return <button type="button" className="ll-chip" disabled={!supported} aria-label={`${label}: ${text}`} onClick={() => say(text)}>{label}</button>;
}

function RescueList() {
  return (
    <ul className="sr-rescue">
      {RESCUE.map((item) => (
        <li key={item.en}><span><strong>{item.en}</strong><small>{item.vi} · {item.use}</small></span><SayButton text={item.en.replace(/…/g, "")} /></li>
      ))}
    </ul>
  );
}

/* ───────────────────────────── trang danh sách ───────────────────────────── */

export function SpeakIndex() {
  const store = useSpeakStore();
  const today = dateInLearningTimezone();
  const next = nextSituation(store ?? parseSpeakStore(null), today);
  const due = store ? dueSituations(store, today) : [];
  return (
    <>
      <section className="ll-guide" aria-labelledby="sr-how">
        <h2 id="sr-how">Luyện thế nào để chắc chắn nói được</h2>
        <ol>
          <li><strong>Câu khung + nói đuổi:</strong> học sẵn cụm câu dùng ngay, nghe và nói theo 3 lần. Cụm có sẵn giúp nói trôi vì không phải ghép từng từ.</li>
          <li><strong>Nhớ lại chủ động:</strong> chỉ nhìn tiếng Việt, tự nói ra tiếng Anh rồi mới xem đáp án. Tự nhớ lại giữ câu lâu hơn đọc lại nhiều lần.</li>
          <li><strong>Nhập vai có giờ:</strong> máy đọc lời người kia, bạn trả lời trong khoảng 10 giây, rồi so với câu mẫu và tự chấm.</li>
          <li><strong>Đổi trường hợp:</strong> cùng tình huống nhưng có trục trặc (món hết, người nói nhanh, bị từ chối) để không chỉ thuộc một kịch bản.</li>
          <li><strong>Nói liền 4/3/2:</strong> nói cùng một nội dung trong 60 → 45 → 30 giây, không dừng sửa lỗi. Lặp lại dưới áp lực thời gian làm câu nói tự động hơn.</li>
          <li><strong>Ôn giãn cách:</strong> chưa vững ôn lại sau 1 ngày, gần vững sau 3 ngày, vững sau 7 ngày rồi giãn dần.</li>
        </ol>
        <p><strong>Tiêu chí &ldquo;Nói được&rdquo;:</strong> nhớ lại ≥ 80% câu khung và nói ngay ≥ 80% lượt nhập vai ở <em>cả hai</em> trường hợp. Đây là tự chấm, không phải chứng nhận trình độ. Bản ghi âm chỉ ở máy này.</p>
        <p><strong>Nếu run khi nói:</strong> luyện một mình trước (ghi âm là riêng tư), dùng kế hoạch &ldquo;nếu… thì nói…&rdquo; của từng trường hợp, và nhớ rằng nói chậm mà rõ tốt hơn nói nhanh mà bí.</p>
        <div className="ll-actions">
          <Link className="button button--primary" href={`/learning/speaking/${next.situation.id}`}>
            {next.reason === "due" ? "Ôn đến hạn" : next.reason === "new" ? "Bắt đầu" : "Luyện tiếp"}: {next.situation.titleVi} →
          </Link>
        </div>
      </section>

      <section className="ll-guide" aria-labelledby="sr-rescue">
        <h2 id="sr-rescue">Câu cứu nguy (dùng trong mọi tình huống)</h2>
        <p>Thuộc 7 câu này trước: khi không hiểu hoặc bí từ, bạn vẫn giữ được cuộc nói chuyện.</p>
        <RescueList />
      </section>

      {due.length > 0 && (
        <section className="ll-guide" aria-labelledby="sr-due">
          <h2 id="sr-due">Đến hạn ôn</h2>
          <ul className="sr-due">{due.map((item) => <li key={item.id}><Link href={`/learning/speaking/${item.id}`}>{item.titleVi}</Link></li>)}</ul>
        </section>
      )}

      {LEVELS.map((level) => (
        <section key={level.id} className="ll-level" aria-labelledby={`sr-level-${level.id}`}>
          <header><h2 id={`sr-level-${level.id}`}>{level.name}</h2></header>
          <ol className="ll-list">
            {SITUATIONS.filter((item) => item.level === level.id).map((item) => {
              const record = store?.situations[item.id];
              const state = record?.ready === "ready" ? "done" : record ? "started" : "new";
              return (
                <li key={item.id}>
                  <Link href={`/learning/speaking/${item.id}`} className="ll-card" data-state={state}>
                    <span className="ll-card__n">{SITUATIONS.indexOf(item) + 1}</span>
                    <span className="ll-card__body">
                      <strong>{item.titleVi}</strong>
                      <span>{item.cases.map((c) => c.name).join(" · ")}</span>
                      <small>{!store ? "…" : !record ? "Chưa luyện" : `${record.ready ? READINESS_LABEL[record.ready] : "Đang luyện"} · ${record.date}${record.due ? ` · ôn ${record.due}` : ""}`}</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}

/* ───────────────────────────── luyện một tình huống ───────────────────────────── */

const STEPS = ["Câu khung", "Nhớ lại", "Nhập vai", "Nói liền", "Kết quả"] as const;

function useCountdown(seconds: number, running: boolean): number {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const timer = window.setInterval(() => setLeft(Math.max(0, seconds - Math.floor((Date.now() - start) / 1000))), 250);
    return () => { window.clearInterval(timer); setLeft(seconds); };
  }, [running, seconds]);
  return running ? left : seconds;
}

function RecallStep({ chunks, previous, onScore }: { chunks: SpeakChunk[]; previous: number | null; onScore: (score: number) => void }) {
  const [queue, setQueue] = useState<number[]>(() => chunks.map((_, index) => index));
  const [shown, setShown] = useState(false);
  const [first, setFirst] = useState<Record<number, boolean>>({});
  const [scored, setScored] = useState(false);
  const current = queue[0];
  const done = current === undefined;
  const firstScore = Object.values(first).filter(Boolean).length / chunks.length;

  function rate(remembered: boolean) {
    stopSpeech();
    const nextFirst = current in first ? first : { ...first, [current]: remembered };
    setFirst(nextFirst);
    // Câu chưa nhớ quay lại cuối hàng: lặp tới khi nói được một lần. Điểm tính theo lần thử đầu.
    setQueue(remembered ? queue.slice(1) : [...queue.slice(1), current]);
    setShown(false);
    if (!scored && Object.keys(nextFirst).length === chunks.length) {
      setScored(true);
      onScore(Object.values(nextFirst).filter(Boolean).length / chunks.length);
    }
  }

  if (done) {
    return (
      <div className="ll-actions" aria-live="polite">
        <p className="ll-score"><strong>Lần đầu nhớ được {Math.round(firstScore * 100)}%</strong> — đã lưu. Mọi câu đã được nói đúng ít nhất một lần.</p>
        <button type="button" className="button button--ghost" onClick={() => { setQueue(chunks.map((_, index) => index)); setFirst({}); setScored(false); }}>Làm lại từ đầu</button>
      </div>
    );
  }
  const chunk = chunks[current];
  return (
    <div className="sr-card" aria-live="polite">
      <p className="ll-note">Còn {queue.length} câu{previous !== null ? ` · lần trước ${percent(previous)}` : ""}{current in first ? " · đang ôn lại câu chưa nhớ" : ""}</p>
      <p className="sr-card__vi">{chunk.vi}</p>
      {shown ? (
        <>
          <p className="sr-card__en">{chunk.en} <SayButton text={chunk.en.replace(/…/g, "")} /></p>
          <div className="ll-rate" role="group" aria-label="Bạn có nhớ được không?">
            <button type="button" className="button button--primary" onClick={() => rate(true)}>Nhớ được</button>
            <button type="button" className="button button--ghost" onClick={() => rate(false)}>Chưa nhớ</button>
          </div>
        </>
      ) : (
        <button type="button" className="button button--primary" onClick={() => { setShown(true); say(chunk.en.replace(/…/g, "")); }}>Đã nói to — xem đáp án</button>
      )}
    </div>
  );
}

function RolePlay({ item, previous, onScore }: { item: SpeakCase; previous: number | undefined; onScore: (score: number) => void }) {
  const supported = useSpeechSupported();
  const [turn, setTurn] = useState(-1);
  const [showText, setShowText] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [ratings, setRatings] = useState<number[]>([]);
  const left = useCountdown(10, turn >= 0 && turn < item.turns.length && !showModel);

  function start(index: number) {
    setTurn(index);
    setShowText(!supported);
    setShowModel(false);
    if (index < item.turns.length) say(item.turns[index].partner);
  }

  function rate(value: number) {
    const next = [...ratings, value];
    setRatings(next);
    if (next.length === item.turns.length) {
      stopSpeech();
      onScore(next.reduce((sum, v) => sum + v, 0) / next.length);
      setTurn(item.turns.length);
    } else start(turn + 1);
  }

  if (turn === -1) {
    return (
      <div className="ll-actions">
        <button type="button" className="button button--primary" onClick={() => { setRatings([]); start(0); }}>Bắt đầu nhập vai ({item.turns.length} lượt)</button>
        {previous !== undefined && <small>Lần trước: {percent(previous)}</small>}
      </div>
    );
  }
  if (turn >= item.turns.length) {
    const score = ratings.reduce((sum, v) => sum + v, 0) / ratings.length;
    return (
      <div className="ll-actions" aria-live="polite">
        <p className="ll-score"><strong>{percent(score)}</strong> — {ratings.filter((v) => v === 1).length}/{ratings.length} lượt nói được ngay. Đã lưu.</p>
        <button type="button" className="button button--ghost" onClick={() => { setRatings([]); start(0); }}>Nhập vai lại</button>
      </div>
    );
  }
  const current = item.turns[turn];
  return (
    <div className="sr-turn">
      <p className="ll-note">Lượt {turn + 1}/{item.turns.length}</p>
      <div className="sr-turn__partner">
        <p><strong>Người kia nói:</strong> {showText ? current.partner : "(nghe trước, chưa xem chữ)"}</p>
        <div className="ll-player__row">
          <button type="button" className="ll-chip" disabled={!supported} onClick={() => say(current.partner)}>Nghe lại</button>
          <button type="button" className="ll-chip" onClick={() => say(current.partner, 0.7)} disabled={!supported}>Nghe chậm</button>
          {!showText && <button type="button" className="ll-chip" onClick={() => setShowText(true)}>Hiện chữ</button>}
        </div>
      </div>
      <p className="sr-turn__cue"><strong>Bạn:</strong> {current.cue}</p>
      {!showModel ? (
        <div className="ll-actions">
          <span className="sr-timer" role="timer" aria-live="off" data-over={left === 0}>{left > 0 ? `Nói to trong ${left} giây` : "Hết giờ — cứ nói tiếp, rồi xem câu mẫu"}</span>
          <button type="button" className="button button--primary" onClick={() => setShowModel(true)}>Đã nói — xem câu mẫu</button>
        </div>
      ) : (
        <>
          <p className="sr-card__en">{current.model} <SayButton text={current.model} /></p>
          <p className="ll-note">Câu của bạn không cần giống hệt — chỉ cần đúng ý và người kia hiểu.</p>
          <div className="ll-rate" role="group" aria-label={`Tự chấm lượt ${turn + 1}`}>
            {TURN_RATINGS.map((rating) => (
              <button key={rating.value} type="button" className="ll-chip" onClick={() => rate(rating.value)}>{rating.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FluencyStep({ prompt, done, onRound }: { prompt: string; done: number; onRound: (rounds: number) => void }) {
  const [running, setRunning] = useState<number | null>(null);
  const seconds = running === null ? FLUENCY_ROUNDS[0] : FLUENCY_ROUNDS[running];
  const left = useCountdown(seconds, running !== null);
  useEffect(() => {
    if (running !== null && left === 0) {
      const finished = running;
      const timer = window.setTimeout(() => { setRunning(null); onRound(Math.max(done, finished + 1)); }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [done, left, onRound, running]);
  return (
    <>
      <p className="ll-prompt">{prompt}</p>
      <p className="ll-how">Nói cùng một nội dung ba lần: 60 giây → 45 giây → 30 giây. Không dừng lại sửa lỗi; lần sau nói gọn và nhanh hơn lần trước. Muốn nghe lại thì ghi âm.</p>
      <ol className="sr-rounds">
        {FLUENCY_ROUNDS.map((s, index) => (
          <li key={s} data-done={index < done}>
            <span>Lượt {index + 1}: {s} giây{index < done ? " · xong" : ""}</span>
            {running === index ? (
              <button type="button" className="button button--ghost" onClick={() => { setRunning(null); onRound(Math.max(done, index + 1)); }}>Xong sớm ({left}s)</button>
            ) : (
              <button type="button" className="button button--primary" disabled={running !== null || index > done} onClick={() => setRunning(index)}>Bắt đầu</button>
            )}
          </li>
        ))}
      </ol>
      {running !== null && <p className="sr-timer" role="timer">Còn {left} giây</p>}
      <SpeakingRecorder language="en" onTranscript={() => {}} hint="Ghi âm lượt nói để nghe lại; chỉ lưu trên máy này cho tới khi bạn tải lại trang." />
    </>
  );
}

export function SpeakPractice({ situation, next }: { situation: SpeakSituation; next: { id: string; title: string } | null }) {
  const learner = useLearnerProfile();
  const store = useSpeakStore();
  const [step, setStep] = useState(0);
  const [record, setRecord] = useState<SpeakRecord>(() => emptySpeakRecord(""));
  const [previous, setPrevious] = useState<SpeakRecord | null>(null);
  const [caseIndex, setCaseIndex] = useState(0);
  const [doneOn, setDoneOn] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const today = dateInLearningTimezone();
  const completionId = `speaking:${situation.id}:${today}`;

  useEffect(() => {
    const restore = () => {
      const saved = loadSpeak().situations[situation.id] ?? null;
      setPrevious(saved);
      // Mỗi ngày là một buổi luyện mới; buổi hôm nay (nếu có) được giữ lại.
      setRecord(saved?.date === today ? saved : emptySpeakRecord(today));
      setDoneOn(getLocalCompletionSummary(completionId, "en").completedOn);
    };
    restore();
  }, [completionId, learner.id, situation.id, today]);
  useEffect(() => stopSpeech, []);
  useEffect(() => {
    const row = document.querySelector<HTMLElement>(".ll-steps ol");
    const current = row?.querySelector<HTMLElement>("[aria-current=step]")?.parentElement;
    if (row && current) row.scrollLeft = Math.max(0, current.offsetLeft - 16);
  }, [step]);

  function update(change: Partial<SpeakRecord>) {
    const nextRecord = { ...record, ...change, date: today, cases: { ...record.cases, ...(change.cases ?? {}) } };
    setRecord(nextRecord);
    if (!saveSpeak(withSpeakResult(loadSpeak(), situation, nextRecord))) setMessage("Trình duyệt không cho lưu trên máy; kết quả chỉ còn trong trang đang mở.");
  }

  function go(index: number) {
    stopSpeech();
    setStep(index);
    document.getElementById("sr-step-title")?.focus();
  }

  const ready = readiness(situation, record);
  const saved = store?.situations[situation.id];
  const stepState = [
    null,
    record.chunks === null ? null : percent(record.chunks),
    situation.cases.every((c) => record.cases[c.id] !== undefined) ? "xong" : Object.keys(record.cases).length ? `${Object.keys(record.cases).length}/2` : null,
    record.fluency ? `${record.fluency}/3` : null,
    ready ? READINESS_LABEL[ready] : null,
  ];
  const sayAll = () => speakLines(situation.chunks.map((chunk) => ({ t: chunk.en.replace(/…/g, "") })), 0.85);

  return (
    <article className="ll-lesson" aria-labelledby="sr-title">
      <header className="ll-lesson__head">
        <p className="eyebrow">PHÒNG NÓI · {levelName(situation).toUpperCase()} · KHOẢNG 15 PHÚT</p>
        <h1 id="sr-title">{situation.titleVi}</h1>
        <p><em>{situation.title}.</em> {situation.goal}</p>
        {previous?.date && previous.date !== today && <p className="ll-note">Lần trước {previous.date}: {previous.ready ? READINESS_LABEL[previous.ready] : "chưa xong"}{previous.due ? ` · hẹn ôn ${previous.due}` : ""}.</p>}
      </header>

      <nav className="ll-steps" aria-label="Các bước luyện">
        <ol>
          {STEPS.map((name, index) => (
            <li key={name}>
              <button type="button" aria-current={step === index ? "step" : undefined} onClick={() => go(index)}>
                <span className="ll-steps__n">{index + 1}</span> {name}{stepState[index] && <small>{stepState[index]}</small>}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="ll-panel" aria-labelledby="sr-step-title">
        <h2 id="sr-step-title" tabIndex={-1}>{step + 1}. {STEPS[step]}</h2>

        {step === 0 && (
          <>
            <p className="ll-how">Nghe từng câu và nói đuổi 3 lần: lần 1 nhìn chữ, lần 2 nói cùng lúc với máy, lần 3 không nhìn. Chú ý chỗ nhấn và nối âm. Dấu &ldquo;…&rdquo; là chỗ bạn tự điền.</p>
            <ul className="ll-vocab">
              {situation.chunks.map((chunk) => (
                <li key={chunk.en}>
                  <div className="ll-vocab__word"><strong>{chunk.en}</strong> <SayButton text={chunk.en.replace(/…/g, "")} /></div>
                  <p>{chunk.vi}</p>
                </li>
              ))}
            </ul>
            <div className="ll-actions"><button type="button" className="button button--ghost" onClick={sayAll}>Nghe tất cả câu khung</button></div>
            <details className="ll-model"><summary>Câu cứu nguy (dùng mọi lúc)</summary><RescueList /></details>
          </>
        )}

        {step === 1 && (
          <>
            <p className="ll-how">Nhìn câu tiếng Việt, <strong>nói to</strong> câu tiếng Anh trước khi xem đáp án. Câu chưa nhớ sẽ quay lại cuối hàng cho tới khi bạn nói được. Điểm tính theo lần thử đầu.</p>
            <RecallStep key={`${situation.id}-${record.date}`} chunks={situation.chunks} previous={previous?.chunks ?? null} onScore={(value) => update({ chunks: value })} />
          </>
        )}

        {step === 2 && (
          <>
            <div className="ll-rate" role="group" aria-label="Chọn trường hợp">
              {situation.cases.map((item, index) => (
                <button key={item.id} type="button" className="ll-chip" aria-pressed={caseIndex === index} onClick={() => { stopSpeech(); setCaseIndex(index); }}>
                  {index + 1}. {item.name}{record.cases[item.id] !== undefined ? ` · ${percent(record.cases[item.id])}` : ""}
                </button>
              ))}
            </div>
            <p className="ll-how"><strong>Kế hoạch:</strong> {situation.cases[caseIndex].plan}</p>
            <RolePlay key={situation.cases[caseIndex].id} item={situation.cases[caseIndex]} previous={saved?.cases[situation.cases[caseIndex].id]}
              onScore={(value) => update({ cases: { [situation.cases[caseIndex].id]: value } })} />
            <details className="ll-model"><summary>Ghi âm cả lượt nhập vai (tuỳ chọn)</summary>
              <SpeakingRecorder language="en" onTranscript={() => {}} hint="Bấm Ghi âm trước khi bắt đầu, Dừng khi xong, rồi nghe lại xem mình có ngập ngừng ở đâu. Bản ghi chỉ ở máy này." />
            </details>
          </>
        )}

        {step === 3 && <FluencyStep prompt={situation.retell} done={record.fluency} onRound={(rounds) => update({ fluency: rounds })} />}

        {step === 4 && (
          <>
            <table className="ll-results">
              <caption className="sr-only">Kết quả buổi luyện hôm nay</caption>
              <tbody>
                <tr><th scope="row">Nhớ lại câu khung</th><td>{record.chunks === null ? "chưa làm" : percent(record.chunks)}</td></tr>
                {situation.cases.map((item) => (
                  <tr key={item.id}><th scope="row">Nhập vai: {item.name}</th><td>{record.cases[item.id] === undefined ? "chưa làm" : percent(record.cases[item.id])}</td></tr>
                ))}
                <tr><th scope="row">Nói liền 4/3/2</th><td>{record.fluency}/3 lượt</td></tr>
              </tbody>
              <tfoot><tr><th scope="row">Mức sẵn sàng</th><td>{ready ? READINESS_LABEL[ready] : "chưa đủ phần để đánh giá"}</td></tr></tfoot>
            </table>
            <p className="ll-note">
              {ready === "ready" ? "Bạn đạt tiêu chí: nhớ ≥ 80% câu khung và nói ngay ≥ 80% lượt ở cả hai trường hợp." : "Nói được = nhớ ≥ 80% câu khung và nói ngay ≥ 80% lượt ở cả hai trường hợp."}
              {saved?.due && ` Lịch ôn: ${saved.due} (sau ${saved.interval} ngày).`} Lưu trên máy này (hồ sơ {learner.name}); tự chấm, không phải chứng nhận trình độ.
            </p>
            <div className="ll-actions" aria-live="polite">
              {doneOn ? <p className="ll-score"><strong>Đã Done</strong> hôm nay.</p> : (
                <button type="button" className="button button--primary" disabled={!ready} onClick={() => {
                  const result = recordLocalCompletion({ id: completionId, lessonId: `speaking-${situation.id}`, language: "en", skill: "speaking", minutes: 15 });
                  setDoneOn(result.completedOn);
                }}>Lưu &amp; Done</button>
              )}
              {!ready && !doneOn && <small>Làm Nhớ lại và cả hai trường hợp nhập vai để Done.</small>}
              {message && <p>{message}</p>}
            </div>
            <div className="ll-actions">
              {next && <Link className="button button--primary" href={`/learning/speaking/${next.id}`}>Tình huống tiếp: {next.title} →</Link>}
              <Link className="button button--ghost" href="/learning/speaking">Danh sách tình huống</Link>
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
