"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocalLanguageSummary, type LocalProgressSummary } from "@/lib/localLearningProgress";

type DashboardState = {
  en: LocalProgressSummary;
  zh: LocalProgressSummary;
};

function ProgressRow({ label, value }: { label: string; value: LocalProgressSummary }) {
  return <div className="local-progress__row">
    <div><strong>{label}</strong><span>{value.totalCompleted} bài đã Done</span></div>
    <div className="local-progress__numbers">
      <span><strong>{value.currentStreak}</strong> hiện tại</span>
      <span><strong>{value.longestStreak}</strong> dài nhất</span>
    </div>
  </div>;
}

export function LocalProgressSummary() {
  const [progress, setProgress] = useState<DashboardState | null>(null);
  useEffect(() => {
    setProgress({
      en: getLocalLanguageSummary("en"),
      zh: getLocalLanguageSummary("zh"),
    });
  }, []);

  return <section className="local-progress" aria-labelledby="local-progress-title">
    <div>
      <p className="eyebrow">TIẾN ĐỘ TRÊN THIẾT BỊ NÀY</p>
      <h2 id="local-progress-title">Done và streak cá nhân</h2>
      <p>Học bù vẫn ghi vào ngày bạn thực sự hoàn thành. Nhiều bài trong một ngày chỉ kéo dài streak một ngày.</p>
    </div>
    {progress ? <div className="local-progress__list" aria-live="polite">
      <ProgressRow label="English" value={progress.en} />
      <ProgressRow label="中文" value={progress.zh} />
    </div> : <p className="local-progress__loading">Đang đọc tiến độ trên trình duyệt…</p>}
    <Link href="/learning/session" className="button">Tiếp tục một buổi học →</Link>
    <p className="local-progress__note">Chưa đồng bộ qua thiết bị. Done/streak không phải điểm CEFR hoặc xác nhận của giáo viên.</p>
  </section>;
}
