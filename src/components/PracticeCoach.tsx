"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { SkillId } from "@/lib/lessonTypes";
import type { ChinesePractice, LessonTakeaway } from "@/lib/dailyLessons";
import { announceResponseStarted } from "@/components/LessonFlowGuide";
import { ChineseWritingPractice } from "@/components/ChineseWritingPractice";
import { SpeakingRecorder } from "@/components/SpeakingRecorder";
import { getDefaultLearningMethod, getLearningMethod, type LearningMethodId } from "@/lib/learningMethods";
import { getLocalCompletionSummary, recordLocalCompletion, syncLocalProgress, type LocalCompletionSummary } from "@/lib/localLearningProgress";
import { readProfileStorage, writeProfileStorage } from "@/lib/learnerProfiles";

type Gap = "meaning" | "reasoning" | "language" | "delivery";
type Saved = { version: 1; lessonId: string; response: string; minutes: number; support: string; focus: string; gap: Gap; revision: string; sourceResult?: string; method?: LearningMethodId; savedAt: string };
const drills: Record<Gap, string> = {
  meaning: "2 phút: đóng nguồn, viết ý chính bằng một câu và một chi tiết làm bằng chứng. Mở lại đúng đoạn chưa hiểu để kiểm tra, rồi đóng nguồn và nói lại.",
  reasoning: "3 phút: đổi từ công việc sang một tình huống đời sống. Nói ba câu: lựa chọn → vì sao → cách kiểm tra. Thêm một bất tiện nếu có thời gian.",
  language: "3 phút: chọn đúng một câu bạn chưa chắc. Gửi câu đó cho ChatGPT để nhận sửa, rồi tự viết hai câu mới dùng cùng cấu trúc. Không chép toàn bộ bài mẫu.",
  delivery: "3 phút: chọn một câu từ audio người bản ngữ, nghe và nhại hai lượt. Che chữ, nói lại, rồi thay một chi tiết. Muốn được sửa phát âm, gửi ChatGPT audio thật (app không nhận audio).",
};
const purpose: Record<SkillId, string> = {
  listening: "Mục tiêu là bắt ý chính và bằng chứng từ âm thanh, chưa cần hiểu mọi từ.",
  reading: "Mục tiêu là kiểm chứng điều đã nghe và diễn đạt lại bằng lời của bạn.",
  speaking: "Mục tiêu là dùng ý vừa học để nói trong một tình huống mới, không đọc lại script.",
  writing: "Mục tiêu là biến ý vừa học thành một thông điệp có mục đích, lý do và bước tiếp theo.",
};
const frames: Record<SkillId, string> = {
  listening: "Main idea → supporting detail → uncertainty",
  reading: "Evidence → paraphrase → correction",
  speaking: "Choice → reason → trade-off → verification",
  writing: "Purpose → context → reason/example → next step",
};
const keys: Record<SkillId, string[]> = {
  listening: ["Main idea — ý chính", "Supporting detail — chi tiết nghe được", "Uncertainty — đánh dấu chỗ chưa rõ, không đoán thành chắc chắn"],
  reading: ["Evidence — chi tiết trong nguồn", "Paraphrase — diễn đạt bằng lời mình", "Correction — đối chiếu điều đã nghe với điều đọc được"],
  speaking: ["Choice — lựa chọn rõ", "Reason — lý do hoặc ví dụ", "Trade-off — bất tiện có thể có", "Verification — cách kiểm tra kết quả"],
  writing: ["Purpose — mục đích", "Context — bối cảnh đủ hiểu", "Reason/example — lý do hoặc ví dụ", "Next step — hành động hoặc cách kiểm tra"],
};
const languageChecks: Partial<Record<string, string[]>> = {
  zh: ["Mẫu câu — đúng đồ vật và số lượng", "Thanh điệu — đối chiếu audio bản ngữ", "Đổi tình huống — nói lại khi che chữ"],
  ja: ["Can-do — hoàn thành đúng việc giao tiếp", "Âm và nhịp — đối chiếu audio bản ngữ", "Kana/romaji — ghi đúng hệ chữ thực tế đã dùng", "Đổi tình huống — thay một chi tiết khi che mẫu"],
};
const languageDrill: Partial<Record<string, string>> = {
  zh: "2–3 phút: giữ mẫu của bài đang học, đổi đúng một chi tiết như đồ uống hoặc số lượng. Nghe audio, che chữ và nói hai câu mới. Gửi ChatGPT audio nếu muốn sửa thanh điệu.",
  ja: "2–3 phút: giữ mẫu chào hỏi/tự giới thiệu, đổi tên hoặc quốc gia. Nghe audio, nhại hai lượt, che chữ rồi nói lại. Ghi rõ dùng kana hay romaji; gửi ChatGPT audio nếu muốn sửa phát âm.",
};

export function PracticeCoach({ lessonId, skill, language, takeaway, chinesePractice }: { lessonId: string; skill: SkillId; language: string; takeaway?: LessonTakeaway; chinesePractice?: ChinesePractice }) {
  const [response, setResponse] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [support, setSupport] = useState("Không dùng");
  const [focus, setFocus] = useState("Vừa");
  const [gap, setGap] = useState<Gap>("meaning");
  const [revision, setRevision] = useState("");
  const [sourceResult, setSourceResult] = useState("");
  const [attempt, setAttempt] = useState<Saved | null>(null);
  const [message, setMessage] = useState("");
  const [completion, setCompletion] = useState<LocalCompletionSummary | null>(null);
  const restored = useRef(false);
  const storageKey = "learning-practice-v1:" + lessonId;
  const completionId = "lesson:" + lessonId;
  const method = getLearningMethod(getDefaultLearningMethod(skill));

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setCompletion(getLocalCompletionSummary(completionId, language));
      try {
        const raw = readProfileStorage(storageKey);
        if (!raw) return;
        const value = JSON.parse(raw) as Saved;
        if (value.version !== 1 || value.lessonId !== lessonId || typeof value.response !== "string" || !value.response.trim() || !Number.isFinite(value.minutes) || !(value.gap in drills)) return;
        setResponse(value.response);
        setMinutes(value.minutes);
        setSupport(value.support);
        setFocus(value.focus);
        setGap(value.gap);
        setRevision(value.revision || "");
        setSourceResult(value.sourceResult || "");
        setAttempt(value);
        setMessage("Đã tự mở bản nháp trên thiết bị này.");
      } finally {
        restored.current = true;
      }
    });
    return () => { cancelled = true; };
  }, [completionId, language, lessonId, storageKey]);

  useEffect(() => {
    if (!restored.current || !response.trim()) return;
    const timer = window.setTimeout(() => {
      const value: Saved = { version: 1, lessonId, response: response.trim(), minutes, support, focus, gap, revision, sourceResult, method: method.id, savedAt: new Date().toISOString() };
      try {
        writeProfileStorage(storageKey, JSON.stringify(value));
        setAttempt(value);
      } catch {
        setMessage("Trình duyệt không cho lưu nháp. Hãy sao chép câu trả lời để giữ lại.");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [focus, gap, lessonId, method.id, minutes, response, revision, sourceResult, storageKey, support]);

  function appendTranscript(text: string) {
    if (!text) return;
    // Append so an answer the learner already typed is never overwritten.
    setResponse((current) => current.trim() ? `${current.trimEnd()}
${text}` : text);
    announceResponseStarted(lessonId);
    document.getElementById(lessonId + "-response")?.focus();
  }

  function finishLesson(event: FormEvent) {
    event.preventDefault();
    if (!response.trim()) { setMessage("Hãy viết hoặc ghi lại một đầu ra ngắn trước khi hoàn thành."); return; }
    const value: Saved = { version: 1, lessonId, response: response.trim(), minutes, support, focus, gap, revision, sourceResult, method: method.id, savedAt: new Date().toISOString() };
    try {
      writeProfileStorage(storageKey, JSON.stringify(value));
      setAttempt(value);
    } catch {
      setMessage("Không lưu được câu trả lời trên thiết bị. Hãy sao chép lại trước khi rời trang.");
      return;
    }
    try {
      const result = recordLocalCompletion({ id: completionId, lessonId, language, skill, minutes });
      setCompletion(result);
      setMessage(result.newlyCompleted ? "Đã ghi Done trên thiết bị; đang thử đồng bộ…" : "Bài này đã được ghi Done trước đó; tiến độ không bị cộng trùng.");
      if (result.newlyCompleted) void syncLocalProgress()
        .then(() => setMessage("Đã lưu câu trả lời trên thiết bị và đồng bộ trạng thái Done."))
        .catch(() => setMessage("Đã hoàn thành trên thiết bị; máy chủ chưa kết nối, có thể đồng bộ lại sau."));
    } catch {
      setMessage("Không ghi được tiến độ trên thiết bị. Bài viết vẫn có thể được lưu riêng.");
    }
  }
  const exportText = attempt ? "Bài: " + lessonId + "\nPhương pháp: " + getLearningMethod(attempt.method ?? getDefaultLearningMethod(skill)).label + "\nThời gian: " + attempt.minutes + " phút\nHỗ trợ: " + attempt.support + "\nTập trung tự báo: " + attempt.focus + "\nBản đầu:\n" + attempt.response + "\nKết quả bài ở nguồn (tự báo): " + (sourceResult || "chưa ghi") + "\nĐiểm muốn sửa: " + gap + "\nBản làm lại:\n" + revision : "";
  function reviewLesson() {
    document.getElementById("lesson-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <section className="lesson-detail__section" id="lesson-step-output">
    <p className="lesson-step-kicker">BƯỚC 3 · TẠO ĐẦU RA</p>
    <h2>Làm một đầu ra ngắn rồi ghi Done</h2>
    <p>Câu trả lời chỉ lưu trên trình duyệt này, không gửi lên máy chủ. Đừng nhập thông tin công việc nhạy cảm.</p>
    <div className="learning-transfer"><h3>Trước khi làm: bài này dùng để làm gì?</h3><p>{purpose[skill]}</p><p><strong>Khung đầu ra:</strong> {frames[skill]}. Khung là bản đồ để bạn tự tạo câu, không phải đoạn mẫu để chép.</p></div>
    <div className="learning-method-action"><strong>Cách làm được đề xuất:</strong> {method.action}</div>
    {chinesePractice && <ChineseWritingPractice practice={chinesePractice} />}
    <form onSubmit={finishLesson}>
      {skill === "speaking" && <SpeakingRecorder language={language} onTranscript={appendTranscript} />}
      <p><label htmlFor={lessonId + "-response"}>{chinesePractice?.outputPrompt ?? method.outputLabel}</label></p>
      <textarea id={lessonId + "-response"} rows={6} maxLength={10000} required value={response} onFocus={() => announceResponseStarted(lessonId)} onChange={e => setResponse(e.target.value)} style={{ width: "100%" }} />
      <p className="lesson-detail__note">Bản nháp tự lưu khi bạn gõ. Khi đã có đầu ra thật, bấm nút dưới để ghi Done.</p>
      <p><label>Thời gian thực tế (phút) <input type="number" min={1} max={60} required value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label></p>
      <details className="practice-options">
        <summary>Thông tin thêm · tùy chọn</summary>
        <p><label>Hỗ trợ đã dùng <select value={support} onChange={e => setSupport(e.target.value)}><option>Không dùng</option><option>Transcript / từ điển</option><option>Dịch / AI sửa</option></select></label></p>
        <p><label>Mức tập trung tự báo <select value={focus} onChange={e => setFocus(e.target.value)}><option>Thấp</option><option>Vừa</option><option>Cao</option></select></label></p>
        <p><label>Kết quả bài tập ở nguồn <input value={sourceResult} onChange={e => setSourceResult(e.target.value)} placeholder="Ví dụ 4/6; sai main idea" /></label></p>
        <p>Trang không tự đọc điểm British Council/Cambridge; đây là kết quả bạn tự báo.</p>
      </details>
      <button className="button lesson-completion__button" type="submit" disabled={Boolean(completion?.completed)}>{completion?.completed ? "Đã hoàn thành · Done đã ghi" : "Lưu câu trả lời & ghi Done"}</button>
    </form>
    <p role="status">{message}</p>
    {attempt && <div>
      <div className="lesson-completion" data-complete={completion?.completed ? "true" : "false"}>
        <p className="lesson-completion__label">{completion?.completed ? "ĐÃ GHI NHẬN" : "BẢN NHÁP ĐÃ LƯU"}</p>
        {completion?.completed && <div className="lesson-completion__closure" aria-live="polite">
          <h3>Hoàn thành phiên học</h3>
          <p><strong>{completion.totalCompleted} bài đã Done.</strong> Bạn có thể dừng ở đây — không cần làm thêm để giữ chuỗi.</p>
          {takeaway && <div className="lesson-completion__takeaway">
            <p><span>Cụm nên giữ</span><strong>{takeaway.phrase}</strong></p>
            <p><span>Khung tái sử dụng</span><strong>{takeaway.pattern}</strong></p>
          </div>}
          <div className="lesson-completion__actions">
            <Link className="button lesson-completion__button" href="/learning">Về Learning</Link>
            <button className="button button--ghost" type="button" onClick={reviewLesson}>Xem lại bài</button>
          </div>
        </div>}
      </div>
      <details className="practice-review">
        <summary>Tự kiểm tra hoặc luyện lại · tùy chọn</summary>
        <p>Chỉ chọn một điểm đáng sửa. Đây là tiêu chí tự kiểm tra, chưa phải feedback cá nhân.</p>
        <div className="self-check-grid">{(languageChecks[language] ?? keys[skill]).map(k => <label key={k}><input type="checkbox" /> {k}</label>)}</div>
        <p><label>Điểm muốn sửa <select value={gap} onChange={e => setGap(e.target.value as Gap)}><option value="meaning">Chưa hiểu / chưa nhớ ý</option><option value="reasoning">Lập luận chưa rõ</option><option value="language">Từ vựng / cấu trúc</option><option value="delivery">Nói / phát âm</option></select></label></p>
        <p>{languageDrill[language] ?? drills[gap]}</p>
        <label htmlFor={lessonId + "-revision"}>Một câu đã sửa + một câu mới cùng cấu trúc</label>
        <textarea id={lessonId + "-revision"} rows={4} maxLength={10000} value={revision} onChange={e => setRevision(e.target.value)} style={{ width: "100%" }} />
        <p className="lesson-detail__note">Bản luyện lại cũng tự lưu trên thiết bị khi bạn gõ.</p>
        <p>Ngày mai: che bài và nhớ lại 60 giây; sau 3 và 7 ngày đổi tình huống. Nếu khó, giảm đoạn nguồn thay vì tăng thời gian.</p>
      </details>
      <details className="practice-review">
        <summary>Gửi ChatGPT để nhận sửa cá nhân · tùy chọn</summary>
        <textarea aria-label="Bài làm để sao chép gửi về ChatGPT" readOnly rows={8} value={exportText} style={{ width: "100%" }} />
        <p><button type="button" className="button" onClick={async () => { try { await navigator.clipboard.writeText(exportText); setMessage("Đã sao chép. Dán vào cuộc trò chuyện ChatGPT để nhận phản hồi."); } catch { setMessage("Hãy chọn và sao chép nội dung trong ô trên."); } }}>Sao chép bài để gửi ChatGPT</button></p>
      </details>
    </div>}
  </section>;
}
