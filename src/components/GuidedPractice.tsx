"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocalCompletionSummary, recordLocalCompletion, syncLocalProgress, type LocalCompletionSummary } from "@/lib/localLearningProgress";
import { readProfileStorage, writeProfileStorage } from "@/lib/learnerProfiles";
import { useLearnerProfile } from "@/lib/useLearnerProfile";

type Language = "en" | "zh";
type Gap = "understanding" | "reasoning" | "language" | "pronunciation";
type CheckId = "choice" | "reason" | "emergency" | "verification" | "tradeoff";
type Draft = {
  version: 1; language: Language; budget: number; step: number; startedAt: string;
  inputMode: string; comprehension: string; response: string; spoke: boolean;
  gap: Gap; revision: string; takeaway: string; feedback: string; actualMinutes: number;
  checks?: CheckId[]; pattern?: string; sourceResult?: string;
};
const SOURCE = "https://learnenglish.britishcouncil.org/free-resources/listening/b2/digital-detox-podcast";
const AUDIO = "https://learnenglish.britishcouncil.org/sites/podcasts/files/LE_listening_B2_Digital_detox_podcast.mp3";
const STAGES = ["Chọn phiên", "Nghe / đọc", "Hiểu ý", "Áp dụng: nói → viết", "Đối chiếu bản đầu", "Sửa & chuyển giao", "Tổng kết"];
const SELF_CHECKS: { id: CheckId; label: string }[] = [
  { id: "choice", label: "Choice — tôi nói rõ thay đổi sẽ làm" },
  { id: "reason", label: "Reason — tôi giải thích vì sao thay đổi đó hữu ích" },
  { id: "emergency", label: "Emergency — tôi giữ một kênh liên lạc khẩn cấp" },
  { id: "verification", label: "Verification — tôi nêu cách kiểm tra hiệu quả" },
  { id: "tradeoff", label: "Trade-off — tôi nêu một bất tiện hoặc giới hạn" },
];
const DRILLS: Record<Gap, string> = {
  understanding: "Quay lại đúng 60–90 giây đã nghe. Ghi một ý chính + một chi tiết làm bằng chứng; đóng nguồn rồi nói lại trong 20 giây.",
  reasoning: "Giữ khung Choice → Reason → Trade-off → Check, nhưng đổi sang tình huống đọc sách ở quán cà phê. Không chép câu cũ.",
  language: "Chọn đúng một câu chưa chắc. Sửa câu đó, ghi lại cấu trúc dùng được, rồi tạo một câu mới về tình huống khác.",
  pronunciation: "Chọn một câu ngắn từ audio bản ngữ, shadow hai lượt, che chữ rồi nói lại. Chỉ audio thật mới đủ để nhận xét phát âm.",
};
function fresh(language: Language, budget: number): Draft {
  return { version: 1, language, budget, step: 1, startedAt: new Date().toISOString(), inputMode: "listening", comprehension: "", response: "", spoke: false, gap: language === "zh" ? "pronunciation" : "reasoning", revision: "", takeaway: "", feedback: "", actualMinutes: budget, checks: [], pattern: "", sourceResult: "" };
}
function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const d = value as Draft;
  return d.version === 1 && (d.language === "en" || d.language === "zh") && [5, 10].includes(d.budget) && Number.isInteger(d.step) && d.step >= 1 && d.step <= 6 && typeof d.startedAt === "string" && !Number.isNaN(Date.parse(d.startedAt)) && [d.inputMode,d.comprehension,d.response,d.revision,d.takeaway,d.feedback].every(v => typeof v === "string") && typeof d.spoke === "boolean" && Object.hasOwn(DRILLS, d.gap) && Number.isFinite(d.actualMinutes) && d.actualMinutes >= 1 && d.actualMinutes <= 60 && (d.step < 3 || !!d.comprehension.trim()) && (d.step < 4 || !!d.response.trim()) && (d.checks === undefined || (Array.isArray(d.checks) && d.checks.every(v => SELF_CHECKS.some(item => item.id === v)))) && (d.pattern === undefined || typeof d.pattern === "string") && (d.sourceResult === undefined || typeof d.sourceResult === "string") && (d.step < 6 || !!d.revision.trim());
}
function nextDay(): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0,10);
}
export function GuidedPractice() {
  const learner = useLearnerProfile();
  const [language, setLanguage] = useState<Language>("en");
  const [budget, setBudget] = useState(10);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [speechNotice, setSpeechNotice] = useState("");
  const [showText, setShowText] = useState(false);
  const [completion, setCompletion] = useState<LocalCompletionSummary | null>(null);
  const activeLanguage = draft?.language ?? language;
  const completionId = draft ? "guided:" + draft.language + ":" + draft.startedAt : "";
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setCompletion(completionId ? getLocalCompletionSummary(completionId, activeLanguage) : null);
    });
    return () => { cancelled = true; };
  }, [completionId, activeLanguage]);
  function persist(next: Draft) {
    setDraft(next);
    try { writeProfileStorage("guided-practice-v1:" + next.language, JSON.stringify(next)); setNotice(`Đã lưu bước hiện tại cho ${learner.name}.`); }
    catch { setNotice("Không lưu được trên thiết bị. Hãy sao chép nội dung trước khi đóng trang."); }
  }
  function update(patch: Partial<Draft>) { if (draft) persist({ ...draft, ...patch }); }
  function toggleCheck(id: CheckId) {
    if (!draft) return;
    const current = draft.checks ?? [];
    update({ checks: current.includes(id) ? current.filter(item => item !== id) : [...current, id] });
  }
  function resume() {
    try {
      const raw = readProfileStorage("guided-practice-v1:" + language);
      if (!raw) { setNotice("Chưa có phiên lưu cho ngôn ngữ này. Bấm bắt đầu."); return; }
      const value: unknown = JSON.parse(raw);
      if (!validDraft(value)) throw new Error("Invalid draft");
      setDraft(value); setBudget(value.budget); setNotice("Đã mở lại bước đang học. Phiên này chưa được chấm."); setShowText(false);
    } catch { setNotice("Không đọc được bản lưu. Có thể bắt đầu phiên mới; dữ liệu không được gửi lên server."); }
  }
  function go(step: number) { if (draft) { update({ step }); setShowText(false); if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); } }
  function finishLesson() {
    if (!draft || draft.step !== 6 || !completionId) return;
    try {
      const result = recordLocalCompletion({ id: completionId, lessonId: "guided-practice", language: draft.language, skill: "mixed", minutes: draft.actualMinutes });
      setCompletion(result);
      setNotice(result.newlyCompleted ? "Đã hoàn thành và ghi streak; đang đồng bộ…" : "Bài này đã được ghi hoàn thành trước đó; streak không bị cộng trùng.");
      if (result.newlyCompleted) void syncLocalProgress()
        .then(() => setNotice("Đã hoàn thành, ghi streak và đồng bộ với máy chủ."))
        .catch(() => setNotice("Đã hoàn thành trên thiết bị; máy chủ chưa kết nối, có thể đồng bộ lại sau."));
    } catch {
      setNotice("Không ghi được tiến độ trên thiết bị. Bài làm vẫn còn trong bản nháp hiện tại.");
    }
  }
  function speakChinese() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) { setSpeechNotice("Thiết bị không hỗ trợ giọng máy; mở nguồn người bản ngữ hoặc chọn đọc thay."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("你好，我叫小林。我想要一杯茶，不要糖。");
    utterance.lang = "zh-CN"; utterance.rate = 0.8;
    utterance.onerror = () => setSpeechNotice("Không phát được giọng máy. Dùng nguồn HelloChinese hoặc chọn đọc thay.");
    window.speechSynthesis.speak(utterance); setSpeechNotice("Đang dùng giọng máy của thiết bị; đây không phải audio người bản ngữ.");
  }
  const english = activeLanguage === "en";
  const step = draft?.step ?? 0;
  const summary = draft ? [
    "Phiên hướng dẫn — " + (english ? "English B1+ practice / B2 source" : "Chinese Beginner"),
    "Mốc bắt đầu: " + draft.startedAt,
    "Thời gian tự báo: " + draft.actualMinutes + " phút; đầu vào: " + draft.inputMode,
    "Hiểu ý: " + draft.comprehension,
    "Đã tự nói: " + (draft.spoke ? "Có" : "Chưa xác nhận"),
    "Bản đầu: " + draft.response,
    "Tự kiểm tra đã đánh dấu: " + (draft.checks?.join(", ") || "chưa đánh dấu"),
    "Cấu trúc muốn giữ lại: " + (draft.pattern || "chưa chọn"),
    "Kết quả bài tập ở nguồn (tự báo): " + (draft.sourceResult || "chưa ghi"),
    "Điểm muốn sửa tự chọn: " + draft.gap,
    "Phản hồi đã nhận (nếu có): " + draft.feedback,
    "Bản sửa + câu chuyển giao: " + draft.revision,
    "Điều đã học và muốn ôn lại: " + draft.takeaway,
    "Trạng thái: " + (completion?.completed ? "đã tự hoàn thành và ghi streak trên thiết bị; chưa được chấm." : "tự làm, chưa bấm hoàn thành; chưa được chấm.") + " Không suy ra CEFR.",
  ].join("\n\n") : "";
  return <article className="lesson-detail">
    <Link href="/learning">← Kho bài và bộ lọc</Link>
    <header className="lesson-detail__header"><h1>Buổi học có hướng dẫn</h1><p>Một mục tiêu, một nhiệm vụ ở mỗi bước. Học lúc rảnh; có thể dừng rồi tiếp tục trên cùng trình duyệt.</p></header>
    <p className="tag">{english ? "English · B1+ tự báo" : "中文 · Beginner"} · {draft?.budget ?? budget} phút dự kiến</p>
    <p><strong>Đang học: {learner.name}.</strong> Bài tập do trợ lý soạn. Bản viết chỉ lưu trong profile này; máy chủ chỉ đồng bộ metadata Done/streak, không lưu câu trả lời hoặc audio.</p>
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
          <p className="lesson-detail__actions">
            <button type="button" className="button button--ghost" aria-expanded={showText} onClick={() => setShowText(!showText)}>{showText ? "Ẩn script luyện đọc" : "Hiện script luyện đọc"}</button>{" "}
            {english && <a className="button button--ghost" href={SOURCE} target="_blank" rel="noopener noreferrer">Mở transcript chính thức ↗</a>}
          </p>
          {showText && (english ? <div>
            <p><strong>Script luyện đọc · bản tóm lược do trợ lý soạn</strong></p>
            <p>Online work and personal messages can blend together. A digital detox means deliberately changing when and how you use devices.</p>
            <p><small>Đây là paraphrase ngắn do trợ lý soạn, không phải transcript. Muốn shadowing khớp audio, hãy mở transcript chính thức ở British Council.</small></p>
          </div> : <p><strong>Script luyện đọc · do trợ lý soạn</strong><br/>你好，我叫小林。我想要一杯茶，不要糖。<br/>Nǐ hǎo, wǒ jiào Xiǎolín. Wǒ xiǎng yào yì bēi chá, bú yào táng.</p>)}
        </>}
        {step === 2 && <><p>{english ? "Bài nói về chủ đề gì? Ghi một chi tiết nghe được và đánh dấu điều chưa chắc. Nếu dùng đọc thay, ghi ý đã đọc." : "Bạn nghe/đọc được tên, đồ uống hoặc yêu cầu gì? Ghi đúng điều nguồn bạn dùng có nói; chưa rõ thì đánh dấu."}</p><label htmlFor="guided-understanding">Ý hiểu được bằng lời của bạn</label><textarea id="guided-understanding" rows={4} maxLength={5000} value={draft.comprehension} onChange={e => update({comprehension:e.target.value})} style={{width:"100%"}} /></>}
        {step === 3 && <>
          {english ? <div className="learning-transfer">
            <p><strong>Vì sao có tình huống này?</strong> Đây không phải yêu cầu tóm tắt lại podcast. Bạn đang chuyển ý “digital habits có thể được điều chỉnh” sang một tình huống thật để biến phần đã hiểu thành ngôn ngữ có thể dùng.</p>
            <p><strong>Nhiệm vụ:</strong> Bạn có 30 phút làm việc và điện thoại liên tục báo tin nhắn. Hãy đề xuất một cách tập trung mà vẫn không bỏ lỡ việc khẩn cấp.</p>
            <ol>
              <li><strong>Choice:</strong> bạn sẽ thay đổi điều gì?</li>
              <li><strong>Reason:</strong> vì sao lựa chọn đó giúp ích?</li>
              <li><strong>Emergency:</strong> kênh nào vẫn được phép liên lạc?</li>
              <li><strong>Check:</strong> sau 30 phút, dùng dấu hiệu nào để biết cách đó hiệu quả?</li>
              {draft.budget === 10 ? <li><strong>Trade-off:</strong> thêm một bất tiện hoặc giới hạn.</li> : null}
            </ol>
            <p><strong>Khung gợi ý, không phải đáp án:</strong> I would … because … . However, … . To check whether it works, I would … .</p>
          </div> : <p>Giới thiệu tên rồi gọi một đồ uống với một yêu cầu. Nếu đã học mẫu, đổi đồ uống hoặc số lượng. Dùng từ bạn đã biết.</p>}
          <p>Nói trước khi viết: {english ? "30–45 giây, chỉ nhìn 4 từ khóa Choice / Reason / Emergency / Check" : "15–20 giây"}. Sau đó {english ? draft.budget === 5 ? "viết 3–4 câu theo đúng bốn ô trên" : "viết 40–60 từ và thêm một trade-off" : "viết hai câu hoặc pinyin"}. Không dùng AI sửa bản đầu.</p>
          <p><label><input type="checkbox" checked={draft.spoke} onChange={e => update({spoke:e.target.checked})} /> Tôi đã tự nói trước khi viết</label></p>
          <label htmlFor="guided-response">Bản đầu — ghi đúng điều bạn vừa nói, chưa sửa</label><textarea id="guided-response" rows={6} maxLength={5000} value={draft.response} onChange={e => update({response:e.target.value})} style={{width:"100%"}} />
        </>}
        {step === 4 && <>
          <p><strong>Tự kiểm tra nghĩa là đối chiếu bản đầu vừa lưu, không phải đoán đáp án.</strong> Key cho biết mỗi phần phải làm công việc gì. Đánh dấu “có” chỉ khi bạn chỉ được đúng câu trong bản mình.</p>
          {english ? <>
            <div className="self-check-grid">
              {SELF_CHECKS.map(item => <label key={item.id}><input type="checkbox" checked={(draft.checks ?? []).includes(item.id)} onChange={() => toggleCheck(item.id)} /> {item.label}</label>)}
            </div>
            <p><strong>Liên kết với nguồn:</strong> phần “Hiểu ý” phải có một ý chính và một chi tiết đúng với 60–90 giây đã nghe. Phần viết không cần kể lại podcast; nó dùng ý từ nguồn để giải quyết tình huống mới.</p>
            <label>Cấu trúc muốn giữ lại <select value={draft.pattern ?? ""} onChange={e => update({pattern:e.target.value})}><option value="">Chọn sau khi xem bản đầu</option><option value="I would ... because ...">I would … because …</option><option value="However, ...">However, …</option><option value="To make sure ..., I would ...">To make sure …, I would …</option><option value="One drawback is ...">One drawback is …</option></select></label>
            <p><label htmlFor="guided-source-result">Kết quả bài tập ở nguồn · tùy chọn, tự báo</label><br/><input id="guided-source-result" value={draft.sourceResult ?? ""} onChange={e => update({sourceResult:e.target.value})} placeholder="Ví dụ: 4/6; sai câu về main idea" /></p>
            <p>Website không đọc được kết quả bên British Council/Cambridge. Ghi kết quả ở đây giúp nối bài chính thức với lỗi bạn sẽ sửa; nó không tự trở thành điểm CEFR.</p>
          </> : <ul><li>Tên, đồ uống và yêu cầu có khớp nguồn bạn nghe không?</li><li>Khi đổi tình huống, bạn có đổi được đúng một chi tiết mà không nhìn mẫu?</li><li>Đánh giá thanh điệu cần audio thật của bạn; văn bản không đủ để chấm phát âm.</li></ul>}
          <p><strong>Chọn đúng một lỗi ưu tiên:</strong></p>
          <label>Điểm muốn sửa <select value={draft.gap} onChange={e => update({gap:e.target.value as Gap})}><option value="understanding">Hiểu / nhớ ý nguồn</option><option value="reasoning">Thiếu một mắt xích lập luận</option><option value="language">Từ vựng / cấu trúc chưa chắc</option><option value="pronunciation">Phát âm / diễn đạt khi nói</option></select></label>
          <p>Muốn nhận sửa cá nhân, sao chép bản đầu sang ChatGPT rồi dán phản hồi vào ô dưới. Nếu chưa gửi, vẫn có thể tự sửa theo drill ở bước sau.</p>
          <label htmlFor="guided-feedback">Phản hồi đã nhận · tùy chọn</label><textarea id="guided-feedback" rows={3} maxLength={5000} value={draft.feedback} onChange={e => update({feedback:e.target.value})} style={{width:"100%"}} />
        </>}
        {step === 5 && <>
          <p><strong>Drill theo lỗi đã chọn:</strong> {english ? DRILLS[draft.gap] : "Giữ mẫu trong bài đã học, đổi đồ uống hoặc số lượng. Che chữ, nói hai câu mới rồi ghi lại. Nếu cần sửa thanh điệu, gửi audio về ChatGPT."}</p>
          {english ? <ol><li><strong>Fixed:</strong> chỉ viết lại câu hoặc phần đang thiếu trong bản đầu.</li><li><strong>New situation:</strong> dùng cùng cấu trúc cho một tình huống khác, ví dụ đọc sách ở quán cà phê.</li><li><strong>Recall:</strong> che cả hai bản và nói lại một lần.</li></ol> : null}
          <label htmlFor="guided-revision">Bản sửa + câu chuyển giao</label><textarea id="guided-revision" rows={5} maxLength={5000} value={draft.revision} onChange={e => update({revision:e.target.value})} placeholder={english ? "Fixed: …\nNew situation: …" : "Bản luyện lại của bạn"} style={{width:"100%"}} />
          <p><label>Thời gian thực tế tự báo (phút) <input type="number" min={1} max={60} value={draft.actualMinutes} onChange={e => update({actualMinutes:Number(e.target.value)})} /></label></p>
          <label htmlFor="guided-takeaway">Chốt điều đã học: ý chính + từ/cụm hoặc cấu trúc + lỗi cần tránh</label><textarea id="guided-takeaway" rows={3} maxLength={2000} value={draft.takeaway} onChange={e => update({takeaway:e.target.value})} placeholder={english ? "I learned … / Useful pattern … / Next time I will …" : "Hôm nay tôi giữ lại mẫu …"} style={{width:"100%"}} />
        </>}
        {step === 6 && <>
          <h3>Tổng kết · hôm nay đã học được gì?</h3><p>{draft.actualMinutes} phút tự báo · {draft.spoke ? "đã nói trước khi viết" : "chưa xác nhận bước nói"} · {draft.inputMode === "reading" ? "đọc thay, chưa có bằng chứng luyện nghe" : "đã ghi điều kiện đầu vào"}.</p>
          <ul><li><strong>Ý nguồn:</strong> {draft.comprehension}</li><li><strong>Cấu trúc giữ lại:</strong> {draft.pattern || "chưa chọn"}</li><li><strong>Lỗi đã tập trung sửa:</strong> {draft.gap}</li><li><strong>Điều chuyển sang tình huống mới:</strong> {draft.takeaway || "xem ô Bản sửa + câu chuyển giao"}</li></ul>
          <p>Ôn {nextDay()}: che bài, nói lại ý nguồn và một câu mới trong 60 giây. Sau 3 ngày đổi bối cảnh; sau 7 ngày làm mini-test không nhìn bài cũ.</p>
          <div className="lesson-completion" data-complete={completion?.completed ? "true" : "false"}>
            <p className="lesson-completion__label">{completion?.completed ? "ĐÃ GHI NHẬN" : "BƯỚC CUỐI"}</p>
            <button type="button" className="button lesson-completion__button" disabled={Boolean(completion?.completed)} onClick={finishLesson}>{completion?.completed ? "Đã hoàn thành · streak đã ghi" : "Hoàn thành bài & ghi streak"}</button>
            {completion && <div className="lesson-completion__stats" aria-live="polite">
              <div><strong>{completion.currentStreak}</strong><span>Chuỗi {english ? "English" : "中文"}</span></div>
              <div><strong>{completion.longestStreak}</strong><span>Dài nhất</span></div>
              <div><strong>{completion.totalCompleted}</strong><span>Bài đã Done</span></div>
            </div>}
            <p className="lesson-completion__note">Done ghi nhận thói quen trên thiết bị này; không tự suy ra CEFR hoặc trạng thái đã review.</p>
          </div>
        </>}
      </section>
      <nav aria-label="Điều hướng buổi học">
        {step > 1 && <button className="button button--ghost" onClick={() => go(step-1)}>← Bước trước</button>}{" "}
        {step < 6 && <button className="button" disabled={(step === 2 && !draft.comprehension.trim()) || (step === 3 && !draft.response.trim()) || (step === 5 && (!draft.revision.trim() || draft.actualMinutes < 1 || draft.actualMinutes > 60))} onClick={() => go(step+1)}>{step === 5 ? "Kết thúc và xem tổng kết" : "Bước tiếp →"}</button>}{" "}
        <button className="button button--ghost" onClick={() => { setDraft(null); setNotice("Đã tạm dừng. Bấm Tiếp tục phiên đã lưu để quay lại."); }}>Tạm dừng</button>
      </nav>
      {step >= 4 && <section className="lesson-detail__section"><h2>Tùy chọn · gửi bài để được sửa sâu</h2><textarea aria-label="Nội dung phiên để gửi ChatGPT" readOnly rows={8} value={summary} style={{width:"100%"}} /><button className="button" onClick={async () => { try { await navigator.clipboard.writeText(summary); setNotice("Đã sao chép. Dán vào ChatGPT; chưa tự gửi đi."); } catch { setNotice("Không sao chép tự động được. Hãy chọn nội dung trong ô trên."); } }}>Sao chép gửi ChatGPT</button></section>}
    </>}
    <p role="status">{notice}</p>
  </article>;
}
