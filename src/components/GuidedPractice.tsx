"use client";

import Link from "next/link";
import { useState } from "react";

type Language = "en" | "zh";
type Gap = "understanding" | "reasoning" | "language" | "pronunciation";
type Draft = {
  version: 1; language: Language; budget: number; step: number; startedAt: string;
  inputMode: string; comprehension: string; response: string; spoke: boolean;
  gap: Gap; revision: string; takeaway: string; feedback: string; actualMinutes: number;
};
const SOURCE = "https://learnenglish.britishcouncil.org/free-resources/listening/b2/digital-detox-podcast";
const AUDIO = "https://learnenglish.britishcouncil.org/sites/podcasts/files/LE_listening_B2_Digital_detox_podcast.mp3";
const STAGES = ["Chọn phiên", "Nghe / đọc", "Hiểu ý", "Nói → viết", "Tự kiểm tra", "Luyện lại", "Tổng kết"];
const DRILLS: Record<Gap, string> = {
  understanding: "Nghe lại đúng đoạn chưa rõ, tối đa hai lượt. Ghi một ý chính và một chi tiết; sau đó đóng nguồn và diễn đạt lại.",
  reasoning: "Đổi sang tình huống bạn cần tập trung đọc sách ở quán cà phê. Nói ba câu: bạn chọn gì, vì sao, và kiểm tra hiệu quả thế nào. Thêm một bất tiện nếu còn thời gian.",
  language: "Chọn một câu bạn chưa chắc về từ hoặc cấu trúc. Gửi câu đó về ChatGPT để sửa; sau đó dùng cấu trúc đã sửa trong hai câu mới, không chép bài mẫu.",
  pronunciation: "Chọn một câu ngắn trong audio người bản ngữ, nhại hai lượt rồi che chữ và nói lại. Muốn biết lỗi phát âm cụ thể, hãy gửi audio của bạn.",
};
function fresh(language: Language, budget: number): Draft {
  return { version: 1, language, budget, step: 1, startedAt: new Date().toISOString(), inputMode: "listening", comprehension: "", response: "", spoke: false, gap: language === "zh" ? "pronunciation" : "reasoning", revision: "", takeaway: "", feedback: "", actualMinutes: budget };
}
function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const d = value as Draft;
  return d.version === 1 && (d.language === "en" || d.language === "zh") && [5, 10].includes(d.budget) && Number.isInteger(d.step) && d.step >= 1 && d.step <= 6 && typeof d.startedAt === "string" && !Number.isNaN(Date.parse(d.startedAt)) && [d.inputMode,d.comprehension,d.response,d.revision,d.takeaway,d.feedback].every(v => typeof v === "string") && typeof d.spoke === "boolean" && Object.hasOwn(DRILLS, d.gap) && Number.isFinite(d.actualMinutes) && d.actualMinutes >= 1 && d.actualMinutes <= 60 && (d.step < 3 || !!d.comprehension.trim()) && (d.step < 4 || !!d.response.trim()) && (d.step < 6 || !!d.revision.trim());
}
function nextDay(): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0,10);
}
export function GuidedPractice() {
  const [language, setLanguage] = useState<Language>("en");
  const [budget, setBudget] = useState(10);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [speechNotice, setSpeechNotice] = useState("");
  const [showText, setShowText] = useState(false);
  function persist(next: Draft) {
    setDraft(next);
    try { localStorage.setItem("guided-practice-v1:" + next.language, JSON.stringify(next)); setNotice("Đã lưu bước hiện tại trên trình duyệt này."); }
    catch { setNotice("Không lưu được trên thiết bị. Hãy sao chép nội dung trước khi đóng trang."); }
  }
  function update(patch: Partial<Draft>) { if (draft) persist({ ...draft, ...patch }); }
  function resume() {
    try {
      const raw = localStorage.getItem("guided-practice-v1:" + language);
      if (!raw) { setNotice("Chưa có phiên lưu cho ngôn ngữ này. Bấm bắt đầu."); return; }
      const value: unknown = JSON.parse(raw);
      if (!validDraft(value)) throw new Error("Invalid draft");
      setDraft(value); setBudget(value.budget); setNotice("Đã mở lại bước đang học. Phiên này chưa được chấm."); setShowText(false);
    } catch { setNotice("Không đọc được bản lưu. Có thể bắt đầu phiên mới; dữ liệu không được gửi lên server."); }
  }
  function go(step: number) { if (draft) { update({ step }); setShowText(false); if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); } }
  function speakChinese() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) { setSpeechNotice("Thiết bị không hỗ trợ giọng máy; mở nguồn người bản ngữ hoặc chọn đọc thay."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("你好，我叫小林。我想要一杯茶，不要糖。");
    utterance.lang = "zh-CN"; utterance.rate = 0.8;
    utterance.onerror = () => setSpeechNotice("Không phát được giọng máy. Dùng nguồn HelloChinese hoặc chọn đọc thay.");
    window.speechSynthesis.speak(utterance); setSpeechNotice("Đang dùng giọng máy của thiết bị; đây không phải audio người bản ngữ.");
  }
  const english = (draft?.language ?? language) === "en";
  const step = draft?.step ?? 0;
  const summary = draft ? [
    "Phiên hướng dẫn — " + (english ? "English B1+ practice / B2 source" : "Chinese Beginner"),
    "Mốc bắt đầu: " + draft.startedAt,
    "Thời gian tự báo: " + draft.actualMinutes + " phút; đầu vào: " + draft.inputMode,
    "Hiểu ý: " + draft.comprehension,
    "Đã tự nói: " + (draft.spoke ? "Có" : "Chưa xác nhận"),
    "Bản đầu: " + draft.response,
    "Điểm muốn sửa tự chọn: " + draft.gap,
    "Phản hồi đã nhận (nếu có): " + draft.feedback,
    "Bản luyện lại: " + draft.revision,
    "Điều tự rút ra: " + draft.takeaway,
    "Trạng thái: tự làm, chưa được chấm; không tính streak hoặc CEFR.",
  ].join("\n\n") : "";
  return <article className="lesson-detail">
    <Link href="/learning">← Kho bài và bộ lọc</Link>
    <header className="lesson-detail__header"><h1>Buổi học có hướng dẫn</h1><p>Một mục tiêu, một nhiệm vụ ở mỗi bước. Học lúc rảnh; có thể dừng rồi tiếp tục trên cùng trình duyệt.</p></header>
    <p className="tag">{english ? "English · B1+ tự báo" : "中文 · Beginner"} · {draft?.budget ?? budget} phút dự kiến</p>
    <p>Bài tập do trợ lý soạn. Bản viết lưu trên thiết bị; audio của bạn chưa được lưu ở màn này. Chưa có chấm AI hoặc đồng bộ server.</p>
    <ol aria-label="Các bước buổi học">{STAGES.map((name,index) => <li key={name} aria-current={step === index ? "step" : undefined}>{step === index ? "→ " : ""}{name}</li>)}</ol>
    {step === 0 ? <section className="lesson-detail__section">
      <h2>Bắt đầu hoặc tiếp tục</h2>
      <label>Ngôn ngữ <select value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="en">Tiếng Anh chính</option><option value="zh">Tiếng Trung phụ</option></select></label>
      <p><label>Phiên rảnh <select value={budget} onChange={e => setBudget(Number(e.target.value))}><option value={5}>5 phút · nhiệm vụ ngắn</option><option value={10}>10 phút · thêm ví dụ</option></select></label></p>
      <p>{english ? "Mục tiêu: hiểu một ý về thói quen dùng điện thoại và giải thích một thay đổi bạn muốn thử." : "Mục tiêu: hiểu và đổi một yêu cầu gọi đồ uống bằng hai câu."}</p>
      <p>Đây là thời lượng gợi ý, không có đồng hồ ép làm nhanh. Nếu quá khó, dùng phiên 5 phút hoặc bài mức thấp hơn trong kho.</p>
      <button className="button" onClick={() => persist(fresh(language,budget))}>Bắt đầu phiên mới</button>{" "}
      <button className="button button--ghost" onClick={resume}>Tiếp tục phiên đã lưu</button>
      <p>Bắt đầu mới thay bản nháp gần nhất của ngôn ngữ này; hãy sao chép tổng kết nếu muốn giữ lịch sử.</p>
    </section> : draft && <>
      <section className="lesson-detail__section">
        <h2>{step}. {STAGES[step]}</h2>
        {step === 1 && <>
          <p>{english ? "Nghe 60–90 giây đầu, tối đa hai lượt, chưa mở transcript. Ghi ý chính ở bước tiếp theo." : "Nghe một câu giới thiệu/gọi món trong bài HelloChinese đang mở được. Nếu chưa có nguồn phù hợp, dùng mẫu tự soạn bằng giọng máy hoặc đọc thay."}</p>
          {english ? <><audio aria-label="Audio British Council — Digital detox" controls preload="none" src={AUDIO} style={{width:"100%"}} /><p><a href={SOURCE} target="_blank" rel="noopener noreferrer">Nguồn British Council · miễn phí, audio và transcript ↗</a></p></> :
            <><a href="https://www.hellochinese.cc/" target="_blank" rel="noopener noreferrer">HelloChinese · audio/video bản ngữ, miễn phí giới hạn và Premium ↗</a><p><button type="button" className="button button--ghost" onClick={speakChinese}>Nghe mẫu tự soạn bằng giọng máy</button></p><p role="status">{speechNotice}</p></>}
          <label>Đầu vào thực tế <select value={draft.inputMode} onChange={e => update({inputMode:e.target.value})}><option value="listening">Đã nghe</option><option value="reading">Đọc thay · chưa luyện nghe</option><option value="synthetic">Giọng máy · không phải bản ngữ</option></select></label>
          <p><button className="button button--ghost" onClick={() => setShowText(!showText)}>{showText ? "Ẩn chữ" : "Cần đọc thay / mở nguồn transcript"}</button></p>
          {showText && (english ? <p>Transcript nằm ở nguồn British Council bên trên. Đánh dấu “Đọc thay” nếu chưa nghe; câu trả lời sẽ được xem theo điều kiện thực tế.</p> : <p>你好，我叫小林。我想要一杯茶，不要糖。<br/>Nǐ hǎo, wǒ jiào Xiǎolín. Wǒ xiǎng yào yì bēi chá, bú yào táng.<br/>Đoạn này do trợ lý tự soạn.</p>)}
        </>}
        {step === 2 && <><p>{english ? "Bài nói về chủ đề gì? Ghi một chi tiết nghe được và đánh dấu điều chưa chắc. Nếu dùng đọc thay, ghi ý đã đọc." : "Bạn nghe/đọc được tên, đồ uống hoặc yêu cầu gì? Ghi đúng điều nguồn bạn dùng có nói; chưa rõ thì đánh dấu."}</p><label htmlFor="guided-understanding">Ý hiểu được bằng lời của bạn</label><textarea id="guided-understanding" rows={4} maxLength={5000} value={draft.comprehension} onChange={e => update({comprehension:e.target.value})} style={{width:"100%"}} /></>}
        {step === 3 && <>
          <p>{english ? "Bạn có 30 phút làm việc và điện thoại liên tục báo tin nhắn. Bạn sẽ thay đổi gì, giữ liên lạc khẩn cấp thế nào, và kiểm tra hiệu quả ra sao?" : "Giới thiệu tên rồi gọi một đồ uống với một yêu cầu. Nếu đã học mẫu, đổi đồ uống hoặc số lượng. Dùng từ bạn đã biết."}</p>
          <p>Nói trước khi viết: {english ? "30–45 giây" : "15–20 giây"}. Sau đó {english ? draft.budget === 5 ? "viết ba câu" : "viết 40–60 từ, thêm một ví dụ hoặc bất tiện" : "viết hai câu hoặc pinyin"}. Không dùng AI sửa bản đầu.</p>
          <p><label><input type="checkbox" checked={draft.spoke} onChange={e => update({spoke:e.target.checked})} /> Tôi đã tự nói trước khi viết</label></p>
          <label htmlFor="guided-response">Bản đầu / transcript thật đã nói</label><textarea id="guided-response" rows={5} maxLength={5000} value={draft.response} onChange={e => update({response:e.target.value})} style={{width:"100%"}} />
        </>}
        {step === 4 && <>
          <p>Key dưới đây là tiêu chí tự kiểm tra; chưa có ai chấm câu trả lời của bạn.</p>
          {english ? <ul><li>Ý chính của nguồn đầu: thói quen dùng thiết bị và digital detox; chi tiết cần khớp đoạn bạn thực sự nghe.</li><li>Bản nói/viết: nêu lựa chọn → lý do → giới hạn/bất tiện → cách kiểm tra.</li><li>Chỉ chọn một điểm chưa rõ để sửa, không sửa tất cả cùng lúc.</li></ul> : <ul><li>Tên, đồ uống và yêu cầu có khớp nguồn bạn nghe không?</li><li>Khi đổi tình huống, bạn có đổi được đúng một chi tiết mà không nhìn mẫu?</li><li>Đánh giá thanh điệu cần audio thật của bạn; văn bản không đủ để chấm phát âm.</li></ul>}
          <label>Điểm muốn sửa <select value={draft.gap} onChange={e => update({gap:e.target.value as Gap})}><option value="understanding">Hiểu / nhớ ý</option><option value="reasoning">Lập luận</option><option value="language">Từ vựng / cấu trúc</option><option value="pronunciation">Phát âm / diễn đạt</option></select></label>
          <p>Để nhận sửa cá nhân: gửi bản đầu về ChatGPT. Có thể quay lại dán phản hồi vào ô này.</p>
          <label htmlFor="guided-feedback">Phản hồi đã nhận · tùy chọn</label><textarea id="guided-feedback" rows={3} maxLength={5000} value={draft.feedback} onChange={e => update({feedback:e.target.value})} style={{width:"100%"}} />
        </>}
        {step === 5 && <>
          <p>{english ? DRILLS[draft.gap] : "Giữ mẫu trong bài đã học, đổi đồ uống hoặc số lượng. Che chữ, nói hai câu mới rồi ghi lại. Nếu cần sửa thanh điệu, gửi audio về ChatGPT."}</p>
          <label htmlFor="guided-revision">Bản luyện lại / điều đã sửa</label><textarea id="guided-revision" rows={4} maxLength={5000} value={draft.revision} onChange={e => update({revision:e.target.value})} style={{width:"100%"}} />
          <p><label>Thời gian thực tế tự báo (phút) <input type="number" min={1} max={60} value={draft.actualMinutes} onChange={e => update({actualMinutes:Number(e.target.value)})} /></label></p>
          <label htmlFor="guided-takeaway">Một điều bạn tự rút ra · tùy chọn</label><textarea id="guided-takeaway" rows={2} maxLength={2000} value={draft.takeaway} onChange={e => update({takeaway:e.target.value})} style={{width:"100%"}} />
        </>}
        {step === 6 && <>
          <h3>Đã kết thúc phiên tự làm · chờ review</h3><p>{draft.actualMinutes} phút tự báo · {draft.spoke ? "có bước nói tự báo" : "chưa xác nhận bước nói"} · {draft.inputMode === "reading" ? "đọc thay, chưa có bằng chứng luyện nghe" : "điều kiện nghe cần ghi rõ khi gửi bài"}.</p>
          <p>Điều tự rút ra: {draft.takeaway || "Chưa ghi; xem bản đầu và bản luyện lại bên dưới."}</p>
          <p>Gợi ý ôn {nextDay()}: che bài và nhớ lại một ý trong 60 giây. Nếu vẫn khó, ôn lại đúng điểm đã chọn. Sau 3 và 7 ngày, đổi tình huống. Mốc ôn này là gợi ý, chưa có thông báo tự động.</p>
          <p>Chưa có điểm CEFR hoặc streak từ phiên này. Bản tự làm không đồng nghĩa đã được review.</p>
        </>}
      </section>
      <nav aria-label="Điều hướng buổi học">
        {step > 1 && <button className="button button--ghost" onClick={() => go(step-1)}>← Bước trước</button>}{" "}
        {step < 6 && <button className="button" disabled={(step === 2 && !draft.comprehension.trim()) || (step === 3 && !draft.response.trim()) || (step === 5 && (!draft.revision.trim() || draft.actualMinutes < 1 || draft.actualMinutes > 60))} onClick={() => go(step+1)}>{step === 5 ? "Kết thúc và xem tổng kết" : "Bước tiếp →"}</button>}{" "}
        <button className="button button--ghost" onClick={() => { setDraft(null); setNotice("Đã tạm dừng. Bấm Tiếp tục phiên đã lưu để quay lại."); }}>Tạm dừng</button>
      </nav>
      {step >= 4 && <section className="lesson-detail__section"><h2>Gửi bài để được sửa</h2><textarea aria-label="Nội dung phiên để gửi ChatGPT" readOnly rows={8} value={summary} style={{width:"100%"}} /><button className="button" onClick={async () => { try { await navigator.clipboard.writeText(summary); setNotice("Đã sao chép. Dán vào ChatGPT; chưa tự gửi đi."); } catch { setNotice("Không sao chép tự động được. Hãy chọn nội dung trong ô trên."); } }}>Sao chép gửi ChatGPT</button></section>}
    </>}
    <p role="status">{notice}</p>
  </article>;
}
