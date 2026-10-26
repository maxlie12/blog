"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LANGUAGES, type LanguageId } from "@/lib/languages";
import {
  exportLocalProgressBackup,
  getLocalLanguageActivity,
  getLocalLanguageSummary,
  importLocalProgressBackup,
  syncLocalProgress,
  type LocalActivityDay,
  type LocalProgressSummary,
} from "@/lib/localLearningProgress";
import styles from "./LocalProgressSummary.module.css";

type DashboardState = Record<LanguageId, {
  summary: LocalProgressSummary;
  days: LocalActivityDay[];
}>;

export type TestPacket = { date: string; title: string; kind: "weekly-test" | "monthly-test" };

function readDashboard(): DashboardState {
  return Object.fromEntries(LANGUAGES.map((language) => [language.id, {
    summary: getLocalLanguageSummary(language.id),
    days: getLocalLanguageActivity(language.id),
  }])) as DashboardState;
}

function combineActivity(progress: DashboardState): LocalActivityDay[] {
  return progress.en.days.map((day, index) => ({
    date: day.date,
    count: LANGUAGES.reduce((total, language) => total + progress[language.id].days[index].count, 0),
  }));
}

function rhythmMessage(activeDays: number): string {
  if (activeDays >= 7) return "Tuần mở rộng đã đủ 7 ngày. Nghỉ hoặc ôn nhẹ đều hợp lệ.";
  if (activeDays >= 5) return "Đã đạt mức khuyến nghị. Không cần học thêm chỉ để giữ chuỗi.";
  if (activeDays >= 3) return "Đã đạt mức tối thiểu. Nếu còn sức, hướng tới 5 ngày.";
  return `Còn ${3 - activeDays} ngày có hoạt động để đạt nhịp tối thiểu; ngày nghỉ không tạo bài nợ.`;
}

function ActivityGrid({ days }: { days: LocalActivityDay[] }) {
  const completedDays = days.filter((day) => day.count > 0).length;
  return <div className={styles.activity}>
    <div><strong>Lịch hoạt động 28 ngày</strong><span>{completedDays}/28 ngày có học · mọi ngôn ngữ dùng chung một lịch</span></div>
    <ol className={styles.activityGrid} aria-label={`Hoạt động học trong 28 ngày: ${completedDays} ngày có học`}>
      {days.map((day) => <li
        key={day.date}
        className={styles.activityCell}
        data-complete={day.count > 0}
        aria-label={`${day.date}: ${day.count} hoạt động`}
        title={`${day.date}: ${day.count} hoạt động`}
      />)}
    </ol>
    <p className={styles.note}>Ô trống chỉ là lịch sử trung tính, không phải thất bại hay bài phải học bù.</p>
  </div>;
}

export function LocalProgressSummary({ testPackets = [] }: { testPackets?: TestPacket[] }) {
  const [progress, setProgress] = useState<DashboardState | null>(null);
  const [message, setMessage] = useState("");
  const [syncState, setSyncState] = useState<"syncing" | "synced" | "offline">("syncing");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => setProgress(readDashboard());
    queueMicrotask(() => { if (!cancelled) refresh(); });
    window.addEventListener("learning-progress-changed", refresh);
    void syncLocalProgress().then((result) => {
      if (cancelled) return;
      refresh();
      setSyncState("synced");
      if (result.addedFromServer > 0) setMessage(`Đã lấy thêm ${result.addedFromServer} hoạt động từ bản đồng bộ.`);
    }).catch(() => { if (!cancelled) setSyncState("offline"); });
    return () => {
      cancelled = true;
      window.removeEventListener("learning-progress-changed", refresh);
    };
  }, []);

  async function syncNow() {
    setSyncState("syncing");
    try {
      const result = await syncLocalProgress();
      setProgress(readDashboard());
      setSyncState("synced");
      setMessage(result.addedFromServer > 0
        ? `Đã đồng bộ và lấy thêm ${result.addedFromServer} hoạt động.`
        : "Đã đồng bộ tiến độ mới nhất.");
    } catch {
      setSyncState("offline");
      setMessage("Chưa kết nối được máy chủ; Done trên thiết bị vẫn được giữ.");
    }
  }

  function downloadBackup() {
    const blob = new Blob([exportLocalProgressBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `maxlie-learning-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage("Đã tạo file sao lưu trên thiết bị của bạn.");
  }

  async function restoreBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const result = importLocalProgressBackup(await file.text());
      setProgress(readDashboard());
      setMessage(result.added > 0
        ? `Đã khôi phục ${result.added} hoạt động; bỏ qua ${result.skipped} mục đã có.`
        : "Không có hoạt động mới để khôi phục; tiến độ hiện tại được giữ nguyên.");
      void syncNow();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đọc file sao lưu.");
    }
  }

  const combinedDays = progress ? combineActivity(progress) : [];
  const activeDays = combinedDays.slice(-7).filter((day) => day.count > 0).length;
  const publishedTests = [...testPackets].sort((a, b) => a.date.localeCompare(b.date));

  return <section className={styles.summary} aria-labelledby="local-progress-title">
    <div>
      <p className="eyebrow">NHỊP HỌC LINH HOẠT</p>
      <h2 id="local-progress-title">{activeDays}/7 ngày gần nhất có hoạt động</h2>
      <p>{rhythmMessage(activeDays)}</p>
    </div>

    {progress ? <>
      <div className={styles.rhythm} aria-label="Mục tiêu nhịp học 7 ngày">
        {[3, 5, 7].map((target) => <div key={target} data-reached={activeDays >= target}>
          <strong>{target}</strong><span>{target === 3 ? "Tối thiểu" : target === 5 ? "Khuyến nghị" : "Mở rộng"}</span>
        </div>)}
      </div>
      <div className={styles.list}>
        {LANGUAGES.map((language) => <div className={styles.row} key={language.id}>
          <strong>{language.shortLabel}</strong>
          <span>{progress[language.id].summary.totalCompleted} bài đã Done</span>
        </div>)}
      </div>
      <ActivityGrid days={combinedDays} />
      <div className={styles.checkpoint}>
        <div><strong>Mốc kiểm tra năng lực</strong><span>Không khóa theo streak</span></div>
        <p>Mini-test được đề xuất sau một chu kỳ có đầu ra mới và ôn lại. Chỉ kết quả bài chưa luyện mới dùng để điều chỉnh độ khó; số ngày học không tự nâng trình độ.</p>
        {publishedTests.length > 0
          ? <div className={styles.testArchive}>{publishedTests.map((packet) => <Link key={packet.date + packet.title} href={`/learning/daily?date=${packet.date}`}>{packet.date} · {packet.title} →</Link>)}</div>
          : <Link href="/learning/daily">Xem bài học và bài kiểm tra đã có →</Link>}
      </div>
    </> : <p>Đang đọc tiến độ trên trình duyệt…</p>}

    <details className={styles.dataTools}>
      <summary>Dữ liệu trên thiết bị · tùy chọn</summary>
      <div className={styles.actions}>
        <button type="button" className="button button--ghost" onClick={downloadBackup}>Xuất bản sao</button>
        <button type="button" className="button button--ghost" onClick={() => fileInput.current?.click()}>Nhập bản sao</button>
        <button type="button" className="button button--ghost" disabled={syncState === "syncing"} onClick={syncNow}>
          {syncState === "syncing" ? "Đang đồng bộ…" : "Đồng bộ ngay"}
        </button>
        <input ref={fileInput} className={styles.fileInput} type="file" accept="application/json,.json" onChange={restoreBackup} />
      </div>
      <div className={styles.liveStatus} role="status" aria-live="polite" aria-atomic="true">
        <p className={styles.syncStatus} data-state={syncState}>
          <span aria-hidden="true" />{syncState === "synced" ? "Đã đồng bộ với máy chủ" : syncState === "syncing" ? "Đang đồng bộ tiến độ" : "Đang dùng bản lưu trên thiết bị"}
        </p>
        {message && <p className={styles.message}>{message}</p>}
      </div>
      <p className={styles.note}>Máy chủ chỉ lưu mã bài, kỹ năng, ngày và số phút; không lưu câu trả lời hay audio. File sao lưu có khóa đồng bộ nên hãy giữ riêng.</p>
    </details>
  </section>;
}
