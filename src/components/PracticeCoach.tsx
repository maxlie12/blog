"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SkillId } from "@/lib/lessonTypes";
import { getLanguageLabel } from "@/lib/languages";
import { getLocalCompletionSummary, recordLocalCompletion, syncLocalProgress, type LocalCompletionSummary } from "@/lib/localLearningProgress";

type Gap = "meaning" | "reasoning" | "language" | "delivery";
type Saved = { version: 1; lessonId: string; response: string; minutes: number; support: string; focus: string; gap: Gap; revision: string; sourceResult?: string; savedAt: string };
const drills: Record<Gap, string> = {
  meaning: "2 phút: đóng nguồn, viết ý chính bằng một câu và một chi tiết làm bằng chứng. Mở lại đúng đoạn chưa hiểu để kiểm tra, rồi đóng nguồn và nói lại.",
  reasoning: "3 phút: đổi từ công việc sang một tình huống đời sống. Nói ba câu: lựa chọn → vì sao → cách kiểm tra. Thêm một bất tiện nếu có thời gian.",
  language: "3 phút: chọn đúng một câu bạn chưa chắc. Gửi câu đó để nhận sửa, rồi tự viết hai câu mới dùng cùng cấu trúc. Không chép toàn bộ bài mẫu.",
  delivery: "3 phút: chọn một câu từ audio người bản ngữ, nghe và nhại hai lượt. Che chữ, nói lại, rồi thay một chi tiết. Muốn đánh giá phát âm cần gửi audio thực tế.",
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
  zh: "2–3 phút: giữ mẫu của bài đang học, đổi đúng một chi tiết như đồ uống hoặc số lượng. Nghe audio, che chữ và nói hai câu mới. Gửi audio nếu muốn sửa thanh điệu.",
  ja: "2–3 phút: giữ mẫu chào hỏi/tự giới thiệu, đổi tên hoặc quốc gia. Nghe audio, nhại hai lượt, che chữ rồi nói lại. Ghi rõ dùng kana hay romaji; gửi audio nếu muốn sửa phát âm.",
};

export function PracticeCoach({ lessonId, skill, language }: { lessonId: string; skill: SkillId; language: string }) {
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
  const storageKey = "learning-practice-v1:" + lessonId;
  const completionId = "lesson:" + lessonId;
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setCompletion(getLocalCompletionSummary(completionId, language));
    });
    return () => { cancelled = true; };
  }, [completionId, language]);
  function save(event?: FormEvent) {
    event?.preventDefault();
    if (!response.trim()) return;
    const value: Saved = { version: 1, lessonId, response: response.trim(), minutes, support, focus, gap, revision, sourceResult, savedAt: new Date().toISOString() };
    setAttempt(value);
    try { localStorage.setItem(storageKey, JSON.stringify(value)); setMessage("Đã lưu trên trình duyệt này; chưa được chấm và chưa tính streak."); }
    catch { setMessage("Trình duyệt không cho lưu. Hãy sao chép bài bên dưới để giữ lại."); }
  }
  function finishLesson() {
    if (!attempt || !revision.trim()) { setMessage("Hãy lưu bản đầu và viết bản luyện lại trước khi hoàn thành."); return; }
    save();
    try {
      const result = recordLocalCompletion({ id: completionId, lessonId, language, skill, minutes });
      setCompletion(result);
      setMessage(result.newlyCompleted ? "Đã hoàn thành và ghi streak; đang đồng bộ…" : "Bài này đã hoàn thành trước đó; streak không bị cộng trùng.");
      if (result.newlyCompleted) void syncLocalProgress()
        .then(() => setMessage("Đã hoàn thành, ghi streak và đồng bộ với máy chủ."))
        .catch(() => setMessage("Đã hoàn thành trên thiết bị; máy chủ chưa kết nối, có thể đồng bộ lại sau."));
    } catch {
      setMessage("Không ghi được tiến độ trên thiết bị. Bài viết vẫn có thể được lưu riêng.");
    }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) { setMessage("Chưa có bài lưu trên trình duyệt này."); return; }
      const value = JSON.parse(raw) as Saved;
      if (value.version !== 1 || value.lessonId !== lessonId || typeof value.response !== "string" || !value.response.trim() || !Number.isFinite(value.minutes) || !(value.gap in drills)) throw new Error("Invalid saved practice");
      setResponse(value.response); setMinutes(value.minutes); setSupport(value.support); setFocus(value.focus); setGap(value.gap); setRevision(value.revision || ""); setSourceResult(value.sourceResult || ""); setAttempt(value);
      setMessage("Đã mở bài lưu trên thiết bị. Đây là bài tự làm, chưa được chấm.");
    } catch { setMessage("Không đọc được bản lưu. M có thể làm lại hoặc gửi bản đã giữ về ChatGPT."); }
  }
  const exportText = attempt ? "Bài: " + lessonId + "\nThời gian: " + attempt.minutes + " phút\nHỗ trợ: " + attempt.support + "\nTập trung tự báo: " + attempt.focus + "\nBản đầu:\n" + attempt.response + "\nKết quả bài ở nguồn (tự báo): " + (sourceResult || "chưa ghi") + "\nĐiểm muốn sửa: " + gap + "\nBản làm lại:\n" + revision : "";
  return <section className="lesson-detail__section">
    <h2>Làm trước → tự kiểm tra → luyện lại</h2>
    <p>Bài tập và hướng dẫn do trợ lý soạn. Bản viết chỉ lưu trên trình duyệt; máy chủ chỉ đồng bộ metadata Done/streak, không lưu nội dung bài hoặc chấm điểm. Không nhập thông tin công việc nhạy cảm.</p>
    <button type="button" className="button button--ghost" onClick={restore}>Mở bài đã lưu trên thiết bị</button>
    <div className="learning-transfer"><h3>Trước khi làm: bài này dùng để làm gì?</h3><p>{purpose[skill]}</p><p><strong>Khung đầu ra:</strong> {frames[skill]}. Khung là bản đồ để bạn tự tạo câu, không phải đoạn mẫu để chép.</p></div>
    <form onSubmit={save}>
      <p><label htmlFor={lessonId + "-response"}>Câu trả lời đầu tiên{skill === "speaking" ? " / transcript thật đã nói" : ""}</label></p>
      <textarea id={lessonId + "-response"} rows={6} maxLength={10000} required value={response} onChange={e => setResponse(e.target.value)} style={{ width: "100%" }} />
      <p><label>Thời gian thực tế (phút) <input type="number" min={1} max={60} required value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label></p>
      <p><label>Hỗ trợ đã dùng <select value={support} onChange={e => setSupport(e.target.value)}><option>Không dùng</option><option>Transcript / từ điển</option><option>Dịch / AI sửa</option></select></label></p>
      <p><label>Mức tập trung tự báo <select value={focus} onChange={e => setFocus(e.target.value)}><option>Thấp</option><option>Vừa</option><option>Cao</option></select></label></p>
      <p><label>Kết quả bài tập ở nguồn · tùy chọn <input value={sourceResult} onChange={e => setSourceResult(e.target.value)} placeholder="Ví dụ 4/6; sai main idea" /></label></p>
      <p>Trang không tự đọc điểm British Council/Cambridge; trường này nối kết quả bạn tự báo với lỗi cần luyện.</p>
      <button className="button" type="submit">Lưu bản đầu và mở key đối chiếu</button>
    </form>
    <p role="status">{message}</p>
    {attempt && <div>
      <h3>Key để tự kiểm tra · chưa phải feedback cá nhân</h3>
      <p>Đối chiếu từng mục với bản đầu. Chỉ tick khi bạn chỉ được đúng phần tương ứng trong câu của mình; đây là tiêu chí, không phải đáp án mẫu.</p>
      <div className="self-check-grid">{(languageChecks[language] ?? keys[skill]).map(k => <label key={k}><input type="checkbox" /> {k}</label>)}</div>
      <p><label>Chọn điểm m muốn sửa <select value={gap} onChange={e => setGap(e.target.value as Gap)}><option value="meaning">Chưa hiểu / chưa nhớ ý</option><option value="reasoning">Lập luận chưa rõ</option><option value="language">Từ vựng / cấu trúc</option><option value="delivery">Nói / phát âm</option></select></label></p>
      <p>{languageDrill[language] ?? drills[gap]}</p>
      <p><strong>Cách luyện lại:</strong> sửa đúng một điểm trong bản đầu, rồi dùng cùng cấu trúc cho một câu mới ở bối cảnh khác.</p>
      <label htmlFor={lessonId + "-revision"}>Fixed: câu đã sửa · Transfer: câu mới</label>
      <textarea id={lessonId + "-revision"} rows={4} maxLength={10000} value={revision} onChange={e => setRevision(e.target.value)} style={{ width: "100%" }} />
      <p><button type="button" className="button button--ghost" onClick={() => save()}>Lưu bản luyện lại</button></p>
      <div className="lesson-completion" data-complete={completion?.completed ? "true" : "false"}>
        <p className="lesson-completion__label">{completion?.completed ? "ĐÃ GHI NHẬN" : "BƯỚC CUỐI"}</p>
        <button type="button" className="button lesson-completion__button" disabled={Boolean(completion?.completed) || !revision.trim()} onClick={finishLesson}>{completion?.completed ? "Đã hoàn thành · streak đã ghi" : "Hoàn thành bài & ghi streak"}</button>
        {completion && <div className="lesson-completion__stats" aria-live="polite">
          <div><strong>{completion.currentStreak}</strong><span>Chuỗi {getLanguageLabel(language, true)}</span></div>
          <div><strong>{completion.longestStreak}</strong><span>Dài nhất</span></div>
          <div><strong>{completion.totalCompleted}</strong><span>Bài đã Done</span></div>
        </div>}
        {!revision.trim() && <p className="lesson-completion__note">Viết ít nhất một thay đổi ở “Bản luyện lại” để mở nút hoàn thành.</p>}
        <p className="lesson-completion__note">Done được ghi trên thiết bị trước rồi đồng bộ metadata khi có mạng; điểm CEFR và review vẫn là luồng riêng.</p>
      </div>
      <p>Ngày mai: che bài và nhớ lại 60 giây; sau 3 và 7 ngày đổi tình huống. Mốc này là lịch thử, sẽ điều chỉnh theo bài làm. Nếu khó, giảm đoạn nguồn thay vì tăng thời gian.</p>
      <h3>Tùy chọn · gửi về ChatGPT để được sửa cá nhân</h3>
      <textarea aria-label="Bài làm để sao chép gửi về ChatGPT" readOnly rows={8} value={exportText} style={{ width: "100%" }} />
      <p><button type="button" className="button" onClick={async () => { try { await navigator.clipboard.writeText(exportText); setMessage("Đã sao chép. Dán vào cuộc trò chuyện ChatGPT để nhận phản hồi."); } catch { setMessage("Hãy chọn và sao chép nội dung trong ô trên."); } }}>Sao chép bài để gửi ChatGPT</button></p>
    </div>}
  </section>;
}
