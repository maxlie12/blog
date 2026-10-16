"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SkillId } from "@/lib/lessonTypes";
import type { WorldZone } from "@/components/ThreeFarmScene";

const ThreeFarmScene = dynamic(() => import("@/components/ThreeFarmScene"), {
  ssr: false,
  loading: () => <div className="farm-scene farm-scene--loading"><span>Đang dựng nông trại…</span></div>,
});

export interface WorldQuest {
  id: string;
  skill: SkillId;
  language: "en" | "zh";
  title: string;
  level: string;
  instructions: string;
  completionCriteria: string;
  date: string | null;
  attemptCount: number;
  reviewedCount: number;
}

type ActivityDay = { date: string; intensity: 0 | 1 | 2 };

const ZONES: { id: WorldZone; label: string; icon: string; note: string }[] = [
  { id: "listening", label: "Hồ Listening", icon: "◐", note: "Nghe để nhận chỉ dẫn" },
  { id: "reading", label: "Vườn Reading", icon: "▤", note: "Đọc để tìm manh mối" },
  { id: "speaking", label: "Đồi Speaking", icon: "◔", note: "Nói để trao đổi với NPC" },
  { id: "writing", label: "Nhà Writing", icon: "✎", note: "Viết nhật ký và kế hoạch" },
  { id: "zh", label: "Làng 中文", icon: "茶", note: "Nhiệm vụ phụ 3–5 phút" },
];

const DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function vietnamDate(value: Date) {
  return DATE_FORMAT.format(value);
}

function readLocalActivity(): ActivityDay[] {
  const byDate = new Map<string, 1 | 2>();
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("learning-practice-v1:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const value = JSON.parse(raw) as { savedAt?: unknown; response?: unknown; revision?: unknown };
      if (typeof value.savedAt !== "string" || typeof value.response !== "string" || !value.response.trim()) continue;
      const parsed = new Date(value.savedAt);
      if (Number.isNaN(parsed.getTime())) continue;
      const date = vietnamDate(parsed);
      const intensity: 1 | 2 = typeof value.revision === "string" && value.revision.trim() ? 2 : 1;
      byDate.set(date, Math.max(byDate.get(date) ?? 0, intensity) as 1 | 2);
    }
  } catch {
    return [];
  }
  return [...byDate].map(([date, intensity]) => ({ date, intensity }));
}

function last28Days(activity: ActivityDay[]) {
  const values = new Map(activity.map((item) => [item.date, item.intensity]));
  const today = new Date(vietnamDate(new Date()) + "T00:00:00Z");
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (27 - index));
    const key = date.toISOString().slice(0, 10);
    return { date: key, intensity: values.get(key) ?? 0 } as ActivityDay;
  });
}

export function LearningWorld({
  englishQuests,
  chineseQuest,
}: {
  englishQuests: WorldQuest[];
  chineseQuest: WorldQuest | null;
}) {
  const [entered, setEntered] = useState(false);
  const [selected, setSelected] = useState<WorldZone>("listening");
  const [activity, setActivity] = useState<ActivityDay[]>([]);

  const refreshActivity = useCallback(() => setActivity(readLocalActivity()), []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(refreshActivity);
    window.addEventListener("focus", refreshActivity);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("focus", refreshActivity);
    };
  }, [refreshActivity]);

  const quests = useMemo(() => {
    const map = new Map<WorldZone, WorldQuest>();
    englishQuests.forEach((quest) => map.set(quest.skill, quest));
    if (chineseQuest) map.set("zh", chineseQuest);
    return map;
  }, [englishQuests, chineseQuest]);
  const currentQuest = quests.get(selected) ?? englishQuests[0] ?? chineseQuest;
  const days = last28Days(activity);
  const activeDays = days.filter((day) => day.intensity > 0).length;
  const practicedSkills = new Set(
    englishQuests.filter((quest) => quest.reviewedCount > 0 || quest.attemptCount > 0).map((quest) => quest.skill),
  ).size;

  return (
    <main className="learning-world">
      <div className="world-breadcrumb"><Link href="/learning">← Kho bài</Link><span>Learning Farm · MVP</span></div>
      <header className="world-hero">
        <div>
          <p className="eyebrow">YOUR LIVING LANGUAGE WORLD</p>
          <h1>Học trong thế giới của bạn.</h1>
          <p>Mỗi khu vực mở một nhiệm vụ ngôn ngữ thật. Nông trại lớn lên từ bài đã lưu hoặc được review; mở trang không tự tạo streak hay nâng trình độ.</p>
        </div>
        <div className="world-hero__status" aria-label="Trạng thái hành trình">
          <span className="world-mascot" aria-hidden="true"><i /><b /></span>
          <strong>{activeDays > 0 ? "🌱 Đang gây dựng nhịp học" : "🧭 Sẵn sàng bắt đầu lại"}</strong>
          <small>B1+ tự báo · mục tiêu B2 vững</small>
        </div>
      </header>

      {!entered ? (
        <section className="world-gate">
          <div className="world-gate__landscape" aria-hidden="true"><span className="world-gate__sun" /><span className="world-gate__mountain world-gate__mountain--back" /><span className="world-gate__mountain" /><span className="world-gate__river" /><span className="world-gate__cabin">⌂</span></div>
          <div className="world-gate__copy">
            <p className="eyebrow">BASE CAMP · B1+</p>
            <h2>Nông trại dưới chân núi</h2>
            <p>Vào thế giới 3D để chọn hồ nghe, vườn đọc, đồi nói, nhà viết hoặc làng tiếng Trung. Three.js chỉ tải khi bạn vào khu vực này.</p>
            <button className="button button--primary" type="button" onClick={() => setEntered(true)}>Vào nông trại 3D →</button>
            <p className="world-gate__hint">Có thể dùng các nút khu vực thay cho thao tác trực tiếp trên cảnh 3D.</p>
          </div>
        </section>
      ) : (
        <section className="world-play" aria-label="Nông trại học ngôn ngữ">
          <div className="world-play__scene">
            <ThreeFarmScene selected={selected} onSelect={setSelected} />
            <div className="world-play__legend"><span>🌲 Rừng B1+</span><span>≈ Suối checkpoint</span><span>▲ Núi B2</span></div>
          </div>
          <aside className="world-quest" aria-live="polite">
            <p className="eyebrow">NHIỆM VỤ ĐANG CHỌN</p>
            <h2>{currentQuest?.title ?? "Chưa có nhiệm vụ"}</h2>
            {currentQuest ? <>
              <div className="world-quest__meta"><span>{currentQuest.language === "zh" ? "中文 · Phụ" : `English · ${currentQuest.skill}`}</span><span>{currentQuest.level}</span>{currentQuest.date ? <span>{currentQuest.date}</span> : null}</div>
              <p>{currentQuest.instructions}</p>
              <div className="world-quest__criterion"><strong>Đầu ra cần có</strong><span>{currentQuest.completionCriteria}</span></div>
              <p className="world-quest__truth">{currentQuest.reviewedCount > 0 ? "✓ Đã có bài được review trên server." : currentQuest.attemptCount > 0 ? "Đã có bài nộp, đang chờ review." : "Chưa có bài được xác minh. Bắt đầu bằng bản đầu 5 phút."}</p>
              <Link href={`/learning/${currentQuest.id}`} className="button button--primary">Nhận nhiệm vụ 5 phút ↗</Link>
            </> : <p>Kho bài chưa có nhiệm vụ phù hợp cho khu vực này.</p>}
          </aside>
        </section>
      )}

      <nav className="world-zones" aria-label="Chọn khu vực học">
        {ZONES.map((zone) => <button key={zone.id} type="button" aria-pressed={selected === zone.id} data-active={selected === zone.id || undefined} onClick={() => { setSelected(zone.id); setEntered(true); }}><span aria-hidden="true">{zone.icon}</span><strong>{zone.label}</strong><small>{zone.note}</small></button>)}
      </nav>

      <section className="world-dashboard">
        <div className="world-heatmap">
          <div><p className="eyebrow">28 NGÀY GẦN NHẤT</p><h2>Dấu vết học trên thiết bị</h2></div>
          <p>{activeDays} ngày có bản làm · ô đậm là đã lưu phần luyện lại.</p>
          <div className="world-heatmap__grid" aria-label={`${activeDays} ngày có bản làm lưu trên thiết bị trong 28 ngày gần nhất`}>
            {days.map((day) => <span key={day.date} data-level={day.intensity} title={`${day.date}: ${day.intensity === 2 ? "có luyện lại" : day.intensity === 1 ? "có bản đầu" : "chưa có bản lưu"}`} />)}
          </div>
          <small>Dữ liệu này đọc từ bản nháp trong trình duyệt, chưa đồng bộ thiết bị và chưa phải streak đã review.</small>
        </div>
        <div className="world-checkpoint">
          <p className="eyebrow">CHẶNG TIẾP THEO</p>
          <h2>Dựng cầu qua suối</h2>
          <div className="world-checkpoint__path" aria-hidden="true"><span style={{ width: `${Math.min(100, practicedSkills * 25)}%` }} /></div>
          <p>{practicedSkills}/4 kỹ năng có attempt hoặc review trên server.</p>
          <p>Mini-test chỉ mở khi có ít nhất bốn ngày học, đủ bốn kỹ năng và một lần luyện lại. Streak không tự chứng nhận B2.</p>
        </div>
      </section>

      <section className="world-rules">
        <div><span>1</span><h3>Làm nhiệm vụ</h3><p>Nghe, đọc, nói hoặc viết ngay từ tình huống trong thế giới.</p></div>
        <div><span>2</span><h3>Lưu bằng chứng</h3><p>Bản đầu làm cây nảy mầm; luyện lại giúp cây ra hoa.</p></div>
        <div><span>3</span><h3>Vượt checkpoint</h3><p>Bài mới hoàn toàn quyết định lúc băng rừng, qua suối và lên núi.</p></div>
      </section>
    </main>
  );
}
