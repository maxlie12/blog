"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  exportLocalProgressBackup,
  getLocalLanguageActivity,
  getLocalLanguageSummary,
  importLocalProgressBackup,
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
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setProgress(readDashboard()), []);

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
        ? `Đã khôi phục ${result.added} bài; bỏ qua ${result.skipped} bài đã có.`
        : "Không có bài mới để khôi phục; tiến độ hiện tại được giữ nguyên.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đọc file sao lưu.");
    }
  }

  return <section className={styles.summary} aria-labelledby="local-progress-title">
    <div>
      <p className="eyebrow">TIẾN ĐỘ TRÊN THIẾT BỊ NÀY</p>
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
      <input ref={fileInput} className={styles.fileInput} type="file" accept="application/json,.json" onChange={restoreBackup} />
    </div>
    {message && <p className={styles.message} role="status" aria-live="polite">{message}</p>}
    <p className={styles.note}>Chưa đồng bộ tự động qua thiết bị. File sao lưu chứa ngày học và mã bài; hãy giữ riêng. Done/streak không phải điểm CEFR hoặc xác nhận của giáo viên.</p>
  </section>;
}
