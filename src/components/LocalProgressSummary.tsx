"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

type DashboardState = {
  en: LocalProgressSummary;
  zh: LocalProgressSummary;
  enDays: LocalActivityDay[];
  zhDays: LocalActivityDay[];
};

export type TestPacket = { date: string; title: string; kind: "weekly-test" | "monthly-test" };

const TEST_MILESTONES = [
  { days: 7, title: "Mini-test 1", note: "Nghe + một đầu ra ngắn" },
  { days: 14, title: "Mini-test 2", note: "Đổi tình huống, không nhìn bài cũ" },
  { days: 21, title: "Mini-test 3", note: "Lập luận và độ chính xác" },
  { days: 28, title: "Đánh giá chặng", note: "Bốn kỹ năng, nội dung chưa luyện" },
];

function TestRoadmap({ streak, packets }: { streak: number; packets: TestPacket[] }) {
  const published = [...packets].sort((a, b) => a.date.localeCompare(b.date));
  const nextIndex = TEST_MILESTONES.findIndex((item) => streak < item.days);
  const nextMilestone = nextIndex >= 0 ? TEST_MILESTONES[nextIndex] : null;

  return <div className={styles.roadmap}>
    <div><strong>Mốc kiểm tra nhìn thấy trước</strong><span>Tiến độ dựa trên streak English hiện tại; bài test không tự nâng CEFR.</span></div>
    <ol className={styles.milestones}>
      {TEST_MILESTONES.map((item, index) => {
        const reached = streak >= item.days;
        const isNext = index === nextIndex;
        return <li key={item.days} data-state={reached ? "reached" : isNext ? "next" : "locked"}>
          <span className={styles.marker}>{reached ? "✓" : item.days}</span>
          <strong>{item.title}</strong><small>{item.note}</small>
          <span>{reached ? "Đã mở mốc" : `Cần streak ${item.days} ngày`}</span>
        </li>;
      })}
    </ol>
    <p>{nextMilestone ? <>Chuỗi hiện tại: {streak} ngày · còn {nextMilestone.days - streak} ngày tới {nextMilestone.title}.</> : <>Đã đạt mốc 28 ngày; dùng bài đánh giá chặng để quyết định bước tiếp theo.</>} Nếu đứt streak, bài đã Done vẫn còn trong lịch sử; chỉ chuỗi liên tục bắt đầu lại.</p>
    {published.length > 0 ? <div className={styles.testArchive}><strong>Bài test đã phát hành</strong>{published.map((packet) => <Link key={packet.date + packet.title} href={`/learning/daily?date=${packet.date}`}>{packet.date} · {packet.title} →</Link>)}</div> : null}
  </div>;
}

function ProgressRow({ label, value }: { label: string; value: LocalProgressSummary }) {
  return <div className={styles.row}>
    <div><strong>{label}</strong><span>{value.totalCompleted} bài đã Done</span></div>
    <div className={styles.numbers}>
      <span><strong>{value.currentStreak}</strong> hiện tại</span>
      <span><strong>{value.longestStreak}</strong> dài nhất</span>
    </div>
  </div>;
}

function ActivityRow({ label, days }: { label: string; days: LocalActivityDay[] }) {
  const completedDays = days.filter((day) => day.count > 0).length;
  return <div className={styles.activityRow}>
    <div className={styles.activityLabel}>
      <strong>{label}</strong><span>{completedDays}/28 ngày có học</span>
    </div>
    <ol className={styles.activityGrid} aria-label={`${label}: hoạt động 28 ngày gần nhất`}>
      {days.map((day) => <li
        key={day.date}
        className={styles.activityCell}
        data-complete={day.count > 0}
        aria-label={`${day.date}: ${day.count} bài Done`}
        title={`${day.date}: ${day.count} bài Done`}
      />)}
    </ol>
  </div>;
}

function readDashboard(): DashboardState {
  return {
    en: getLocalLanguageSummary("en"),
    zh: getLocalLanguageSummary("zh"),
    enDays: getLocalLanguageActivity("en"),
    zhDays: getLocalLanguageActivity("zh"),
  };
}

export function LocalProgressSummary({ testPackets = [] }: { testPackets?: TestPacket[] }) {
  const [progress, setProgress] = useState<DashboardState | null>(null);
  const [message, setMessage] = useState("");
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "offline">("syncing");
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
      if (result.addedFromServer > 0) setMessage(`Đã lấy thêm ${result.addedFromServer} bài từ bản đồng bộ.`);
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
        ? `Đã đồng bộ và lấy thêm ${result.addedFromServer} bài.`
        : "Đã đồng bộ tiến độ mới nhất.");
    } catch {
      setSyncState("offline");
      setMessage("Chưa kết nối được máy chủ; Done trên thiết bị vẫn được giữ và có thể thử lại.");
    }
  }

  function downloadBackup() {
    const blob = new Blob([exportLocalProgressBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `maxlie-learning-progress-${new Date().toISOString().slice(0, 10)}.json`;
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
        ? `Đã khôi phục ${result.added} bài; bỏ qua ${result.skipped} bài đã có.${result.syncProfileImported ? " Hồ sơ đồng bộ cũng đã được nối lại." : ""}`
        : "Không có bài mới để khôi phục; tiến độ hiện tại được giữ nguyên.");
      void syncNow();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đọc file sao lưu.");
    }
  }

  return <section id="streak-checkpoints" className={styles.summary} aria-labelledby="local-progress-title">
    <div>
      <p className="eyebrow">TIẾN ĐỘ CÁ NHÂN</p>
      <h2 id="local-progress-title">Done và streak cá nhân</h2>
      <p>Học bù vẫn ghi vào ngày bạn thực sự hoàn thành. Nhiều bài trong một ngày chỉ kéo dài streak một ngày.</p>
    </div>

    {progress ? <>
      <div className={styles.list}>
        <ProgressRow label="English" value={progress.en} />
        <ProgressRow label="中文" value={progress.zh} />
      </div>
      <div className={styles.activity}>
        <div><strong>Lịch học 28 ngày</strong><span>Ô có chấm là ngày đã Done ít nhất một bài.</span></div>
        <ActivityRow label="English" days={progress.enDays} />
        <ActivityRow label="中文" days={progress.zhDays} />
      </div>
      <TestRoadmap streak={progress.en.currentStreak} packets={testPackets} />
      <p className={styles.chineseCheckpoint}><strong>中文:</strong> {progress.zh.currentStreak}/7 ngày liên tục tới mini-test hội thoại ngắn. Mốc Trung tách khỏi English để không biến phần phụ thành áp lực.</p>
    </> : <p>Đang đọc tiến độ trên trình duyệt…</p>}

    <div className={styles.actions}>
      <Link href="/learning/session" className="button">Tiếp tục một buổi học →</Link>
      <button type="button" className="button button--ghost" onClick={downloadBackup}>Xuất bản sao</button>
      <button type="button" className="button button--ghost" onClick={() => fileInput.current?.click()}>Nhập bản sao</button>
      <button type="button" className="button button--ghost" disabled={syncState === "syncing"} onClick={syncNow}>
        {syncState === "syncing" ? "Đang đồng bộ…" : "Đồng bộ ngay"}
      </button>
      <input ref={fileInput} className={styles.fileInput} type="file" accept="application/json,.json" onChange={restoreBackup} />
    </div>
    <div className={styles.liveStatus} role="status" aria-live="polite" aria-atomic="true">
      <p className={styles.syncStatus} data-state={syncState}>
        <span aria-hidden="true" />{syncState === "synced" ? "Đã đồng bộ với máy chủ" : syncState === "syncing" ? "Đang đồng bộ tiến độ" : syncState === "offline" ? "Đang dùng bản lưu trên thiết bị" : "Sẵn sàng đồng bộ"}
      </p>
      {message && <p className={styles.message}>{message}</p>}
    </div>
    <p className={styles.note}>Máy chủ chỉ lưu mã bài, kỹ năng, ngày và số phút; không lưu câu trả lời hay audio. File sao lưu có khóa đồng bộ nên hãy giữ riêng. Done/streak không phải điểm CEFR hoặc xác nhận của giáo viên.</p>
  </section>;
}
