"use client";

import { useEffect, useRef, useState } from "react";
import { readProfileStorage, writeProfileStorage } from "@/lib/learnerProfiles";
import { labLessons } from "@/lib/listeningLab";
import {
  dateInLearningTimezone, getLocalDueReviews, getLocalLanguageSummary, getLocalProgressReview,
} from "@/lib/localLearningProgress";
import { SPEAK_STORE_KEY, parseSpeakStore } from "@/lib/speakingRoom";
import {
  COACH_INSTRUCTIONS, PLAN_MAX_CHARS, PLAN_STORE_KEY, buildStudyBrief, parsePlans, planFor, previousPlan,
  summarizeListening, summarizeSpeaking, withPlan, type PlanEntry,
} from "@/lib/studyBrief";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import { loadLab } from "./listening/labShared";

function readPlans(): PlanEntry[] {
  try { return parsePlans(readProfileStorage(PLAN_STORE_KEY)); } catch { return []; }
}

/** Đọc số liệu trên máy ngay lúc bấm, để phiếu luôn mới nhất. */
function currentBrief(lessonIds: Set<string>, nextDaily: string | null): string {
  const today = dateInLearningTimezone();
  const summary = getLocalLanguageSummary("en");
  const week = getLocalProgressReview("en", 7);
  let speak = parseSpeakStore(null);
  try { speak = parseSpeakStore(readProfileStorage(SPEAK_STORE_KEY)); } catch { /* đọc như chưa có dữ liệu */ }
  return buildStudyBrief({
    date: today,
    streak: summary.currentStreak,
    totalDone: summary.totalCompleted,
    week: { activeDays: week.activeDays, doneCount: week.doneCount, reviewCount: week.reviewCount, skills: week.skills },
    dueDailyReviews: getLocalDueReviews().filter((item) => lessonIds.has(item.lessonId)).length,
    nextDaily,
    listening: summarizeListening(loadLab(), labLessons().length),
    speaking: summarizeSpeaking(speak, today),
    previousPlan: previousPlan(readPlans(), today),
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Học cùng ChatGPT mỗi ngày: hướng dẫn một lần, phiếu mỗi ngày, dán kế hoạch về lại app. */
export function StudyBrief({ lessonIds, nextDaily }: { lessonIds: Set<string>; nextDaily: string | null }) {
  const learner = useLearnerProfile();
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const previewRef = useRef<HTMLDetailsElement>(null);
  const previewText = useRef<HTMLTextAreaElement>(null);
  const keepPreview = useRef(false);
  const today = dateInLearningTimezone();
  const todayPlan = planFor(plans, today);

  useEffect(() => {
    const restore = () => { setPlans(readPlans()); setEditing(false); setDraft(""); };
    restore();
  }, [learner.id]);

  async function copy(kind: "brief" | "coach") {
    const text = kind === "brief" ? currentBrief(lessonIds, nextDaily) : COACH_INSTRUCTIONS;
    setPreview(text);
    if (await copyText(text)) {
      setMessage(kind === "brief" ? "Đã sao chép phiếu hôm nay. Mở ChatGPT và dán vào (giữ máy bấm Dán)." : "Đã sao chép hướng dẫn. Dán vào phần Instructions của Project trong ChatGPT, hoặc gửi làm tin nhắn đầu tiên.");
      return;
    }
    // Trình duyệt chặn sao chép: mở ô xem trước, chọn sẵn chữ để người học tự sao chép.
    setMessage("Trình duyệt không cho sao chép tự động. Đoạn chữ đã được chọn trong ô bên dưới — bấm Sao chép của máy.");
    keepPreview.current = true;
    if (previewRef.current) previewRef.current.open = true;
    window.setTimeout(() => { previewText.current?.focus(); previewText.current?.select(); }, 0);
  }

  function save(text: string) {
    const next = withPlan(readPlans(), today, text);
    try {
      writeProfileStorage(PLAN_STORE_KEY, JSON.stringify(next));
    } catch {
      setMessage("Trình duyệt không cho lưu trên máy (chế độ ẩn danh hoặc hết chỗ). Kế hoạch vẫn còn trong ô để bạn sao chép.");
      return;
    }
    setPlans(next);
    setEditing(false);
    setDraft("");
    setMessage(text.trim() ? "Đã lưu kế hoạch hôm nay. Phiếu ngày mai sẽ kèm kế hoạch này để ChatGPT so và cập nhật." : "Đã xoá kế hoạch hôm nay.");
  }

  const showForm = !todayPlan || editing;
  return (
    <section className="sb" aria-labelledby="sb-title">
      <p className="eyebrow">TIẾNG ANH · HỌC CÙNG CHATGPT</p>
      <h2 id="sb-title">Kế hoạch mỗi ngày với ChatGPT</h2>
      <p className="sb-lead">App không gắn AI. Mỗi ngày bạn mang <strong>phiếu số liệu</strong> sang ChatGPT, nhận nhận xét và kế hoạch, rồi dán kế hoạch về đây. Hôm sau phiếu tự kèm kế hoạch cũ để ChatGPT so và cập nhật.</p>

      {todayPlan && !editing && (
        <div className="sb-plan" role="region" aria-label="Kế hoạch hôm nay từ ChatGPT">
          <h3>Kế hoạch hôm nay (từ ChatGPT)</h3>
          <p className="sb-plan__text">{todayPlan.text}</p>
          <div className="sb-row">
            <button type="button" className="button button--ghost" onClick={() => { setDraft(todayPlan.text); setEditing(true); }}>Sửa kế hoạch</button>
            <button type="button" className="button button--ghost" onClick={() => save("")}>Xoá</button>
          </div>
        </div>
      )}

      <ol className="sb-steps">
        <li>
          <h3>Một lần: cài ChatGPT làm huấn luyện viên</h3>
          <p>Trong ChatGPT, tạo một Project (ví dụ &ldquo;English coach&rdquo;) và dán hướng dẫn vào phần Instructions. Không dùng Project thì gửi hướng dẫn làm tin nhắn đầu tiên, rồi luôn dùng lại cuộc trò chuyện đó.</p>
          <div className="sb-row"><button type="button" className="button button--ghost" onClick={() => copy("coach")}>Sao chép hướng dẫn cho ChatGPT</button></div>
        </li>
        <li>
          <h3>Mỗi ngày: gửi phiếu học</h3>
          <p>Phiếu gồm số liệu 7 ngày, Daily, Phòng nghe, Phòng nói và kế hoạch lần trước. Không có tên, email hay bài làm của bạn.</p>
          <div className="sb-row">
            <button type="button" className="button button--primary" onClick={() => copy("brief")}>Sao chép phiếu hôm nay</button>
            <a className="button button--ghost" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Mở ChatGPT <span aria-hidden="true">↗</span></a>
          </div>
          <details ref={previewRef} className="sb-preview" onToggle={(event) => {
            // Mở tay: luôn hiện phiếu mới nhất. Mở do sao chép thất bại: giữ đúng đoạn vừa định sao chép.
            if (event.currentTarget.open && !keepPreview.current) setPreview(currentBrief(lessonIds, nextDaily));
            keepPreview.current = false;
          }}>
            <summary>Xem trước nội dung sẽ sao chép</summary>
            <label htmlFor="sb-preview-text" className="sr-only">Nội dung phiếu</label>
            <textarea id="sb-preview-text" ref={previewText} readOnly rows={10} value={preview} />
          </details>
        </li>
        <li>
          <h3>Dán kế hoạch về đây</h3>
          {showForm ? (
            <>
              <label htmlFor="sb-plan-input">Kế hoạch ChatGPT giao hôm nay</label>
              <textarea id="sb-plan-input" rows={5} maxLength={PLAN_MAX_CHARS} value={draft} onChange={(event) => setDraft(event.target.value)}
                placeholder="Dán phần KẾ HOẠCH HÔM NAY mà ChatGPT trả lời…" />
              <div className="sb-row">
                <button type="button" className="button button--primary" disabled={!draft.trim()} onClick={() => save(draft)}>Lưu kế hoạch hôm nay</button>
                {editing && <button type="button" className="button button--ghost" onClick={() => { setEditing(false); setDraft(""); }}>Huỷ</button>}
              </div>
            </>
          ) : <p>Đã lưu kế hoạch hôm nay ở trên. Ngày mai phiếu sẽ kèm kế hoạch này.</p>}
          <small>Lưu trên trình duyệt này theo hồ sơ học, giữ 7 ngày gần nhất, không gửi đi đâu và không tính Done.</small>
        </li>
      </ol>
      <p className="sb-message" aria-live="polite">{message}</p>
    </section>
  );
}
