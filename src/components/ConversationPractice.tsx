"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SpeakingRecorder } from "./SpeakingRecorder";
import { CONVERSATION_SCENARIOS, canFinishConversation, conversationBrief, conversationScenario, freshConversation, readConversationSessions, saveConversationSession, type ConversationSession, type ConversationScenario } from "@/lib/conversationPractice";
import styles from "./ConversationPractice.module.css";

function ScenarioCard({ scenario }: { scenario: ConversationScenario }) {
  const [history, setHistory] = useState<ConversationSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try { setHistory(readConversationSessions(scenario.id)); }
      catch { setFailed(true); }
    });
    return () => { cancelled = true; };
  }, [scenario.id]);
  const draft = history?.find(s => !s.completedAt);
  const finished = history?.filter(s => s.completedAt) ?? [];
  const latest = finished[0];
  return <article className={styles.card}>
    <span>{scenario.language === "en" ? "Tiếng Anh · giữ mức đầu vào B1+ tự đánh giá" : "Tiếng Trung · câu ngắn đời sống"}</span>
    <h3>{scenario.title}</h3><p>{scenario.goal}</p>
    {history && <p>{finished.length} phiên đã luyện xong{draft ? ` · Đang dở phần ${draft.stage + 1}/5` : ""} · lưu trên máy này</p>}
    {latest?.phrase && <p><strong>Cụm đã giữ lại:</strong> {latest.phrase}</p>}
    {failed && <p>Chưa đọc được lịch sử trên máy này. Mở tình huống để kiểm tra; dữ liệu cũ được giữ nguyên.</p>}
    <Link className="button" href={`/learning/conversation?scenario=${scenario.id}`}>
      {draft ? "Tiếp tục phiên đang dở →" : latest ? "Mở lại bài đã luyện →" : "Thử nói ngay →"}
    </Link>
  </article>;
}

export function ConversationLaunch() {
  return <section className={styles.shell}><p className={styles.eyebrow}>Giao tiếp trước · bản thử nghiệm</p><h2>Hôm nay bạn muốn nói được điều gì?</h2><p>Không cần học bù. Chọn một tình huống, thử nói trước rồi mới xem hỗ trợ. Bạn có thể dừng sau 5 phút hoặc luyện sâu hơn.</p><div className={styles.grid}>{CONVERSATION_SCENARIOS.map(s => <ScenarioCard key={s.id} scenario={s} />)}</div><p>Phiên hội thoại lưu riêng trên trình duyệt, không cộng vào Done của Daily bên dưới. Luyện theo kịch bản, chưa phải AI đối thoại trực tiếp; không tự chấm phát âm hay trình độ.</p></section>;
}

const stages = ["Thử nói", "Nghe và đọc", "Đổi tình huống", "Viết ngắn", "Giữ lại một điều"];

export function ConversationPractice({ scenarioId }: { scenarioId: string }) {
  const scenario = conversationScenario(scenarioId)!;
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [history, setHistory] = useState<ConversationSession[]>([]);
  const [status, setStatus] = useState("");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  function open() {
    try {
      const saved = readConversationSessions(scenario.id);
      setHistory(saved);
      const selected = saved.find(s => !s.completedAt) ?? saved[0];
      setSession(selected ? { ...selected, stage: selected.completedAt ? 4 : selected.stage } : freshConversation(scenario.id));
      setStatus(selected ? selected.completedAt ? "Đã mở bài đã luyện. Xem lại câu của bạn hoặc tạo phiên mới; bài cũ vẫn được giữ." : "Đã mở lại bản nháp trên trình duyệt này." : "Phiên mới: bắt đầu bằng câu trả lời của bạn.");
    } catch { setBlocked(true); setStatus("Không đọc được lịch sử. Chưa ghi đè dữ liệu; hãy giữ trang cũ và sao lưu dữ liệu trình duyệt trước."); }
  }
  function update(patch: Partial<ConversationSession>) {
    if (!session) return;
    const next = { ...session, ...patch, savedAt: new Date().toISOString() };
    setSession(next);
    try { saveConversationSession(next); setHistory(readConversationSessions(scenario.id)); setStatus("Đã lưu chữ và tiến trình trên trình duyệt này. Audio không được lưu."); }
    catch { setStatus("Chưa lưu được. Đừng đóng trang; hãy sao chép phần chữ của bạn ra nơi khác."); }
  }
  function speak(text: string) {
    document.dispatchEvent(new Event("study-voice-start"));
    if (!("speechSynthesis" in window)) { setStatus("Thiết bị chưa hỗ trợ đọc máy. Bạn vẫn có thể đọc chữ."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = scenario.language === "en" ? "en-GB" : "zh-CN";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }
  const stage = session?.stage ?? 0;
  const turn = session?.turn ?? 0;
  const retrying = stage === 2;
  const lines = retrying ? scenario.retry : scenario.turns;
  const line = lines[turn];
  const answers = retrying ? session?.retry : session?.first;
  const spoken = retrying ? session?.spokeRetry : session?.spokeFirst;

  return <div className={styles.shell}><Link href="/learning">← Learning</Link><p className={styles.eyebrow}>Phòng tập giao tiếp · không phải bài thi</p><h1>{scenario.title}</h1><p>{scenario.context}</p><p><strong>Đích hôm nay:</strong> {scenario.goal}</p><p>5 phút: thử ba lượt nói rồi tạm dừng. Khi rảnh thêm, tiếp tục các phần còn lại (khoảng 20–30 phút cả phiên). Lưu chỉ giữ bản nháp trên trình duyệt này; hoàn thành và tự nhìn lại nằm ở phần 5.</p>
    {!session ? <button className="button" disabled={blocked} onClick={open}>Bắt đầu / tiếp tục trên máy này</button> : <>
      {session.completedAt && <button onClick={() => { const next = freshConversation(scenario.id); setSession(next); setStatus("Phiên mới chưa lưu; bài cũ vẫn được giữ. Bắt đầu nói rồi ghi lại ý của bạn."); }}>Tạo phiên luyện lại mới</button>}
      <nav className={styles.steps} aria-label="Các phần luyện tập">{stages.map((name, i) => <button key={name} aria-current={stage === i ? "step" : undefined} onClick={() => { update({ stage: i, turn: 0 }); }}>{i + 1}. {name}</button>)}</nav>
      <section className={styles.card} aria-label={stages[stage]}>
        <h2>{stage + 1}. {stages[stage]}</h2>
        {(stage === 0 || stage === 2) && <>
          <p>{retrying ? "Điều kiện mới: dùng ý của bạn, không học thuộc câu cũ." : "Nói thành tiếng trước, không cần nói hoàn hảo. Mỗi lượt 10–30 giây."}</p>
          <p>Lượt {turn + 1}/3 · {scenario.role}</p><blockquote lang={scenario.language}>{line.line}</blockquote>
          <button onClick={() => speak(line.line)}>Nghe câu hỏi · giọng máy</button>
          <details><summary>Xem nghĩa và gợi ý khi bí</summary><p>{line.meaning}</p>{"pinyin" in line && typeof line.pinyin === "string" && <p>{line.pinyin}</p>}<p>{line.hint}</p></details>
          <p><strong>Việc của bạn:</strong> {line.task}</p>
          <SpeakingRecorder key={`${stage}-${turn}`} language={scenario.language} onTranscript={text => { const next = [...answers!]; next[turn] = text; update(retrying ? { retry: next } : { first: next }); }} />
          <label className={styles.field}>Ghi ngắn điều bạn đã nói (hoặc chép lời rồi tự sửa)<textarea value={answers?.[turn] ?? ""} maxLength={5000} onChange={e => { const next = [...answers!]; next[turn] = e.target.value; update(retrying ? { retry: next } : { first: next }); }} /></label>
          <label><input type="checkbox" checked={spoken?.[turn] ?? false} onChange={e => { const next = [...spoken!]; next[turn] = e.target.checked; update(retrying ? { spokeRetry: next } : { spokeFirst: next }); }} /> Tôi đã thực sự nói thành tiếng lượt này</label>
          <div className={styles.actions}><button disabled={turn === 0} onClick={() => update({ turn: turn - 1 })}>Lượt trước</button><button disabled={turn === 2} onClick={() => update({ turn: turn + 1 })}>Lượt sau →</button></div>
          <p>Nhân vật đi theo kịch bản, không hiểu hay đánh giá câu trả lời. Dừng ghi âm trước khi đổi lượt; tải bản ghi nếu muốn giữ.</p>
        </>}
        {stage === 1 && <><p>Mẫu tự soạn của trợ lý, không phải transcript hoặc bài chính thức của nguồn bên dưới. Sau lần thử đầu, xem cách hỏi rõ và xác nhận để dùng lại.</p><button onClick={() => speak(scenario.model)}>Nghe mẫu · giọng tổng hợp của thiết bị</button><pre className={styles.model} lang={scenario.language}>{scenario.model}</pre><p className={styles.model}>{scenario.modelMeaning}</p><p><strong>Cụm dùng lại:</strong> {scenario.pattern}</p><p>{scenario.soundFocus}</p><label className={styles.field}><span><input type="checkbox" checked={session.listened} onChange={e => update({ listened: e.target.checked })} /> Tôi đã nghe mẫu hoặc nghe nguồn liên quan</span></label><label className={styles.field}><span><input type="checkbox" checked={session.read} onChange={e => update({ read: e.target.checked })} /> Tôi đã đọc và hiểu mẫu</span></label><a className="button button--ghost" href={scenario.source} target="_blank" rel="noreferrer">{scenario.sourceLabel} ↗</a><p>Nguồn là bài luyện thêm liên quan, không phải audio khớp với mẫu tự soạn này.</p></>}
        {stage === 3 && <><p>{scenario.writingTask}</p><p>Dựa trên câu bạn vừa nói: ý định → chi tiết → câu xác nhận. Không cần dùng đủ công thức nếu câu ngắn đã rõ.</p><label className={styles.field}>Bản đầu của tôi<textarea maxLength={5000} value={session.writing} onChange={e => update({ writing: e.target.value })} /></label></>}
        {stage === 4 && <><p>Đây là tự nhìn lại, chưa có người hay AI chấm. Chỉ chọn một điều để thử tốt hơn; không sửa tất cả.</p><label className={styles.field}>Chỗ tôi bị bí / chưa chắc<input value={session.gap} maxLength={300} onChange={e => update({ gap: e.target.value })} /></label><label className={styles.field}>Một cụm muốn dùng lại<input value={session.phrase} maxLength={300} onChange={e => update({ phrase: e.target.value })} /></label><label className={styles.field}>Một câu mới của tôi dùng cụm đó<textarea value={session.repaired} maxLength={1000} onChange={e => update({ repaired: e.target.value })} /></label><button className="button" disabled={!canFinishConversation(session)} onClick={() => update({ completedAt: session.completedAt ?? new Date().toISOString() })}>{session.completedAt ? "Đã luyện xong · lưu chỉnh sửa" : "Ghi nhận đã luyện phiên này"}</button><p>Cần ba lượt nói ở mỗi vòng, phần chữ, nghe/đọc và câu mới. Đây là hoàn thành tự khai của phiên, không phải chứng nhận năng lực hay điểm phát âm.</p></>}
      </section>
      <div className={styles.actions}><button disabled={stage === 0} onClick={() => { update({ stage: stage - 1, turn: 0 }); }}>← Phần trước</button><button onClick={() => update({})}>{session.completedAt ? "Lưu chỉnh sửa phiên đã xong" : "Lưu nháp · học tiếp sau"}</button><button disabled={stage === 4} onClick={() => { update({ stage: stage + 1, turn: 0 }); }}>Phần tiếp →</button></div>
      <details><summary>Muốn hội thoại phản hồi linh hoạt thay vì kịch bản?</summary><p>Sao chép mô tả này sang ứng dụng hội thoại bạn chọn. Website không gửi dữ liệu đi; không cần chia sẻ thông tin riêng. Dịch vụ ngoài có thể thu phí và có chính sách dữ liệu riêng.</p><button onClick={async () => { try { await navigator.clipboard.writeText(conversationBrief(scenario)); setStatus("Đã chép mô tả, chưa gửi tới dịch vụ nào."); } catch { setStatus("Không chép được; bạn có thể chọn phần chữ bên dưới."); } }}>Chép yêu cầu luyện vai</button><pre className={styles.model}>{conversationBrief(scenario)}</pre></details>
      <details><summary>Lịch sử trên máy này · {history.length} phiên</summary>{history.map(s => <button className={styles.history} key={s.id} onClick={() => { setSession(s); setStatus("Đã mở lại phiên đã lưu trên máy này."); }}>{new Date(s.startedAt).toLocaleDateString("vi-VN")} · {s.completedAt ? "Đã luyện xong" : "Bản nháp"} · mở lại</button>)}</details>
    </>}
    <p role="status">{status}</p><p>Muốn hoàn thành: đến phần 5, ghi một chỗ còn bí, một cụm muốn dùng lại và câu mới; sau đó bấm “Ghi nhận đã luyện phiên này”. Hiện chưa có lịch ôn thích ứng cho hội thoại hoặc tự chấm câu trả lời.</p><p>Phần chữ lưu riêng trong hồ sơ trình duyệt hiện tại, không đồng bộ đáp án giữa các máy. Xóa dữ liệu web có thể mất lịch sử. Chưa suy ra trình độ từ số phiên.</p>
  </div>;
}
