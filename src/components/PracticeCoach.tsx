"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SkillId } from "@/lib/lessonTypes";
import { getLocalCompletionSummary, recordLocalCompletion, type LocalCompletionSummary } from "@/lib/localLearningProgress";

type Gap = "meaning" | "reasoning" | "language" | "delivery";
type Saved = { version: 1; lessonId: string; response: string; minutes: number; support: string; focus: string; gap: Gap; revision: string; savedAt: string };
const drills: Record<Gap, string> = {
  meaning: "2 phút: đóng nguồn, viết ý chính bằng một câu và một chi tiết làm bằng chứng. Mở lại đúng đoạn chưa hiểu để kiểm tra, rồi đóng nguồn và nói lại.",
  reasoning: "3 phút: đổi từ công việc sang một tình huống đời sống. Nói ba câu: lựa chọn → vì sao → cách kiểm tra. Thêm một bất tiện nếu có thời gian.",
  language: "3 phút: chọn đúng một câu bạn chưa chắc. Gửi câu đó để nhận sửa, rồi tự viết hai câu mới dùng cùng cấu trúc. Không chép toàn bộ bài mẫu.",
  delivery: "3 phút: chọn một câu từ audio người bản ngữ, nghe và nhại hai lượt. Che chữ, nói lại, rồi thay một chi tiết. Muốn đánh giá phát âm cần gửi audio thực tế.",
};
const keys: Record<SkillId, string[]> = {
  listening: ["Main idea — ý chính", "Supporting detail — chi tiết nghe được", "Uncertainty — đánh dấu chỗ chưa rõ, không đoán thành chắc chắn"],
  reading: ["Evidence — chi tiết trong nguồn", "Paraphrase — diễn đạt bằng lời mình", "Correction — đối chiếu điều đã nghe với điều đọc được"],
  speaking: ["Choice — lựa chọn rõ", "Reason — lý do hoặc ví dụ", "Trade-off — bất tiện có thể có", "Verification — cách kiểm tra kết quả"],
  writing: ["Purpose — mục đích", "Context — bối cảnh đủ hiểu", "Reason/example — lý do hoặc ví dụ", "Next step — hành động hoặc cách kiểm tra"],
};

export function PracticeCoach({ lessonId, skill, language }: { lessonId: string; skill: SkillId; language: string }) {
  const [response, setResponse] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [support, setSupport] = useState("Không dùng");
  const [focus, setFocus] = useState("Vừa");
  const [gap, setGap] = useState<Gap>("meaning");
  const [revision, setRevision] = useState("");
  const [attempt, setAttempt] = useState<Saved | null>(null);
  const [message, setMessage] = useState("");
  const [completion, setCompletion] = useState<LocalCompletionSummary | null>(null);
  const storageKey = "learning-practice-v1:" + lessonId;
  const completionId = "lesson:" + lessonId;
  useEffect(() => {
    setCompletion(getLocalCompletionSummary(completionId, language));
  }, [completionId, language]);
  function save(event?: FormEvent) {
    event?.preventDefault();
    if (!response.trim()) return;
    const value: Saved = { version: 1, lessonId, response: response.trim(), minutes, support, focus, gap, revision, savedAt: new Date().toISOString() };
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
      setMessage(result.newlyCompleted ? "Đã hoàn thành và ghi streak trên thiết bị này." : "Bài này đã hoàn thành trước đó; streak không bị cộng trùng.");
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
      setResponse(value.response); setMinutes(value.minutes); setSupport(value.support); setFocus(value.focus); setGap(value.gap); setRevision(value.revision || ""); setAttempt(value);
      setMessage("Đã mở bài lưu trên thiết bị. Đây là bài tự làm, chưa được chấm.");
    } catch { setMessage("Không đọc được bản lưu. M có thể làm lại hoặc gửi bản đã giữ về ChatGPT."); }
  }
  const exportText = attempt ? "Bài: " + lessonId + "\nThời gian: " + attempt.minutes + " phút\nHỗ trợ: " + attempt.support + "\nTập trung tự báo: " + attempt.focus + "\nBản đầu:\n" + attempt.response + "\nĐiểm muốn sửa: " + gap + "\nBản làm lại:\n" + revision : "";
  return <section className="lesson-detail__section">
    <h2>Làm trước → tự kiểm tra → luyện lại</h2>
    <p>Bài tập và hướng dẫn do trợ lý soạn. Bản viết, trạng thái Done và streak được lưu trên trình duyệt này; chưa đồng bộ thiết bị hoặc chấm điểm. Không nhập thông tin công việc nhạy cảm.</p>
    <button type="button" className="button button--ghost" onClick={restore}>Mở bài đã lưu trên thiết bị</button>
    <form onSubmit={save}>
      <p><label htmlFor={lessonId + "-response"}>Câu trả lời đầu tiên{skill === "speaking" ? " / transcript thật đã nói" : ""}</label></p>
      <textarea id={lessonId + "-response"} rows={6} maxLength={10000} required value={response} onChange={e => setResponse(e.target.value)} style={{ width: "100%" }} />
      <p><label>Thời gian thực tế (phút) <input type="number" min={1} max={60} required value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label></p>
      <p><label>Hỗ trợ đã dùng <select value={support} onChange={e => setSupport(e.target.value)}><option>Không dùng</option><option>Transcript / từ điển</option><option>Dịch / AI sửa</option></select></label></p>
      <p><label>Mức tập trung tự báo <select value={focus} onChange={e => setFocus(e.target.value)}><option>Thấp</option><option>Vừa</option><option>Cao</option></select></label></p>
      <button className="button" type="submit">Lưu bài và mở key tự kiểm tra</button>
    </form>
    <p role="status">{message}</p>
    {attempt && <div>
      <h3>Key để tự kiểm tra · chưa phải feedback cá nhân</h3>
      <p>Đối chiếu với bản đã lưu; đây là tiêu chí, không phải đáp án mẫu hoặc kết luận rằng m đã đúng.</p>
      <ul>{(language === "zh" ? ["Mẫu câu — đúng đồ vật và số lượng", "Thanh điệu — đối chiếu audio bản ngữ", "Đổi tình huống — nói lại khi che chữ"] : keys[skill]).map(k => <li key={k}>{k}</li>)}</ul>
      <p><label>Chọn điểm m muốn sửa <select value={gap} onChange={e => setGap(e.target.value as Gap)}><option value="meaning">Chưa hiểu / chưa nhớ ý</option><option value="reasoning">Lập luận chưa rõ</option><option value="language">Từ vựng / cấu trúc</option><option value="delivery">Nói / phát âm</option></select></label></p>
      <p>{language === "zh" ? "2–3 phút: giữ mẫu của bài đang học, đổi đúng một chi tiết như đồ uống hoặc số lượng. Nghe audio, che chữ và nói hai câu mới. Gửi audio nếu muốn sửa thanh điệu." : drills[gap]}</p>
      <label htmlFor={lessonId + "-revision"}>Bản luyện lại / điều m đã đổi</label>
      <textarea id={lessonId + "-revision"} rows={4} maxLength={10000} value={revision} onChange={e => setRevision(e.target.value)} style={{ width: "100%" }} />
      <p><button type="button" className="button button--ghost" onClick={() => save()}>Lưu bản luyện lại</button></p>
      <div className="lesson-completion" data-complete={completion?.completed ? "true" : "false"}>
        <p className="lesson-completion__label">{completion?.completed ? "ĐÃ GHI NHẬN" : "BƯỚC CUỐI"}</p>
        <button type="button" className="button lesson-completion__button" disabled={Boolean(completion?.completed) || !revision.trim()} onClick={finishLesson}>{completion?.completed ? "Đã hoàn thành · streak đã ghi" : "Hoàn thành bài & ghi streak"}</button>
        {completion && <div className="lesson-completion__stats" aria-live="polite">
          <div><strong>{completion.currentStreak}</strong><span>Chuỗi {language === "zh" ? "中文" : "English"}</span></div>
          <div><strong>{completion.longestStreak}</strong><span>Dài nhất</span></div>
          <div><strong>{completion.totalCompleted}</strong><span>Bài đã Done</span></div>
        </div>}
        {!revision.trim() && <p className="lesson-completion__note">Viết ít nhất một thay đổi ở “Bản luyện lại” để mở nút hoàn thành.</p>}
        <p className="lesson-completion__note">Dữ liệu Done nằm trên trình duyệt này; điểm CEFR và review vẫn là luồng riêng.</p>
      </div>
      <p>Ngày mai: che bài và nhớ lại 60 giây; sau 3 và 7 ngày đổi tình huống. Mốc này là lịch thử, sẽ điều chỉnh theo bài làm. Nếu khó, giảm đoạn nguồn thay vì tăng thời gian.</p>
      <h3>Tùy chọn · gửi về ChatGPT để được sửa cá nhân</h3>
      <textarea aria-label="Bài làm để sao chép gửi về ChatGPT" readOnly rows={8} value={exportText} style={{ width: "100%" }} />
      <p><button type="button" className="button" onClick={async () => { try { await navigator.clipboard.writeText(exportText); setMessage("Đã sao chép. Dán vào cuộc trò chuyện ChatGPT để nhận phản hồi."); } catch { setMessage("Hãy chọn và sao chép nội dung trong ô trên."); } }}>Sao chép bài để gửi ChatGPT</button></p>
    </div>}
  </section>;
}
