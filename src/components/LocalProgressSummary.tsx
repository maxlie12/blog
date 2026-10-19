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

export function LocalProgressSummary() {
  const [progress, setProgress] = useState<DashboardState | null>(null);
  const [message, setMessage] = useState("");
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "offline">("idle");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setProgress(readDashboard());
    refresh();
    window.addEventListener("learning-progress-changed", refresh);
    setSyncState("syncing");
    void syncLocalProgress().then((result) => {
      refresh();
      setSyncState("synced");
      if (result.addedFromServer > 0) setMessage(`Đã lấy thêm ${result.addedFromServer} bài từ bản đồng bộ.`);
    }).catch(() => setSyncState("offline"));
    return () => window.removeEventListener("learning-progress-changed", refresh);
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

  return <section className={styles.summary} aria-labelledby="local-progress-title">
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
