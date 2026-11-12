/**
 * Học cùng ChatGPT mỗi ngày: gom số liệu luyện tập trên máy thành "phiếu học" để người học tự dán
 * vào ChatGPT (app không gọi AI), và lưu kế hoạch ChatGPT trả về để phiếu ngày sau kèm theo.
 * Phiếu chỉ chứa số liệu tự luyện — không tên, không email, không bài làm. Hàm thuần, không đụng
 * trình duyệt; đọc/ghi localStorage nằm ở `components/StudyBrief.tsx`.
 */
import { LEVELS, PART_WEIGHTS, isComplete, labLesson, type LabParts, type LabStore } from "./listeningLab.ts";
import { SITUATIONS, dueSituations, nextSituation, type SpeakStore } from "./speakingRoom.ts";

export interface BriefListening {
  done: number;
  total: number;
  /** Trung bình 0..1 của từng phần trên các bài đã có điểm phần đó. */
  parts: LabParts;
  lastLesson: { title: string; score: number; date: string } | null;
  lastTest: { score: number; total: number; date: string; level: string | null } | null;
}

export interface BriefSpeaking {
  ready: number;
  almost: number;
  practice: number;
  total: number;
  due: string[];
  next: string | null;
}

export interface BriefActivity {
  activeDays: number;
  doneCount: number;
  reviewCount: number;
  skills: { listening: number; reading: number; writing: number; speaking: number };
}

export interface StudyBriefData {
  date: string;
  streak: number;
  totalDone: number;
  week: BriefActivity;
  dueDailyReviews: number;
  nextDaily: string | null;
  listening: BriefListening;
  speaking: BriefSpeaking;
  previousPlan: PlanEntry | null;
}

export const PART_NAMES_VI: Record<keyof LabParts, string> = { listen: "Nghe", read: "Đọc", write: "Viết", speak: "Nói" };

const pc = (value: number) => `${Math.round(value * 100)}%`;

/** Phần có điểm trung bình thấp nhất (null khi chưa phần nào có điểm). */
export function weakestPart(parts: LabParts): keyof LabParts | null {
  let weakest: keyof LabParts | null = null;
  for (const key of Object.keys(PART_WEIGHTS) as (keyof LabParts)[]) {
    const value = parts[key];
    if (value === null) continue;
    if (weakest === null || value < (parts[weakest] as number)) weakest = key;
  }
  return weakest;
}

export function summarizeListening(store: LabStore, total: number): BriefListening {
  const records = Object.entries(store.lessons);
  const parts = {} as LabParts;
  for (const key of Object.keys(PART_WEIGHTS) as (keyof LabParts)[]) {
    const values = records.map(([, record]) => record.parts[key]).filter((value): value is number => value !== null);
    parts[key] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }
  const latest = records.filter(([id]) => labLesson(id)).sort((a, b) => b[1].date.localeCompare(a[1].date))[0];
  const test = store.tests[0];
  return {
    done: records.filter(([, record]) => isComplete(record.parts)).length,
    total,
    parts,
    lastLesson: latest ? { title: labLesson(latest[0])!.title, score: latest[1].last, date: latest[1].date } : null,
    lastTest: test ? { score: test.score, total: test.total, date: test.date, level: LEVELS.find((level) => level.id === test.level)?.name ?? null } : null,
  };
}

export function summarizeSpeaking(store: SpeakStore, today: string): BriefSpeaking {
  const records = SITUATIONS.map((item) => store.situations[item.id]).filter(Boolean);
  const next = nextSituation(store, today);
  return {
    ready: records.filter((record) => record.ready === "ready").length,
    almost: records.filter((record) => record.ready === "almost").length,
    practice: records.filter((record) => record.ready === "practice").length,
    total: SITUATIONS.length,
    due: dueSituations(store, today).map((item) => item.titleVi),
    next: next.reason === "due" ? null : next.situation.titleVi,
  };
}

/* ───────────────────────────── kế hoạch ChatGPT trả về ───────────────────────────── */

export interface PlanEntry { date: string; text: string }
export const PLAN_STORE_KEY = "chatgpt-plan-v1";
export const PLAN_MAX_CHARS = 4000;
const PLAN_KEEP = 7;
const PLAN_IN_BRIEF = 1200;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parsePlans(raw: string | null): PlanEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PlanEntry => typeof item?.date === "string" && DAY.test(item.date) && typeof item.text === "string" && item.text.trim() !== "")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, PLAN_KEEP);
  } catch {
    return [];
  }
}

/** Lưu kế hoạch của một ngày (thay bản cùng ngày); chữ rỗng là xoá ngày đó. */
export function withPlan(plans: PlanEntry[], date: string, text: string): PlanEntry[] {
  const clean = text.trim().slice(0, PLAN_MAX_CHARS);
  const others = plans.filter((item) => item.date !== date);
  return (clean ? [{ date, text: clean }, ...others] : others).sort((a, b) => b.date.localeCompare(a.date)).slice(0, PLAN_KEEP);
}

export function planFor(plans: PlanEntry[], date: string): PlanEntry | null {
  return plans.find((item) => item.date === date) ?? null;
}

/** Kế hoạch gần nhất trước hôm nay — phiếu kèm theo để ChatGPT so và cập nhật. */
export function previousPlan(plans: PlanEntry[], today: string): PlanEntry | null {
  return plans.find((item) => item.date < today) ?? null;
}

/* ───────────────────────────── văn bản ───────────────────────────── */

/** Dán một lần vào Project/Instructions của ChatGPT. */
export const COACH_INSTRUCTIONS = [
  "Bạn là huấn luyện viên tiếng Anh của tôi. Tôi là người Việt, tự học mỗi ngày bằng một app riêng. Mục tiêu: nghe và nói được trong công việc và cuộc sống.",
  "",
  "App của tôi có:",
  "- Daily: một bài ngắn mỗi ngày, có lịch ôn (nhớ lại rồi tự chấm).",
  "- Phòng nghe: 18 bài, 3 mức Dễ/Vừa/Khó; mỗi bài đi qua Từ vựng → Nghe → Đọc → Viết → Nói → Kết quả; có Luyện đề theo mức.",
  "- Phòng nói: 9 tình huống (gọi đồ, hỏi đường, làm quen, khám bệnh, phỏng vấn, giới thiệu điểm đến, khiếu nại, họp, trình bày), mỗi tình huống 2 trường hợp; đạt \"Nói được\" khi nhớ ≥80% câu khung và nói ngay ≥80% lượt nhập vai.",
  "",
  "Mỗi ngày tôi gửi một PHIẾU HỌC lấy từ app. Khi nhận phiếu:",
  "1) So với KẾ HOẠCH LẦN TRƯỚC (nếu có trong phiếu): tôi đã làm được gì, còn thiếu gì.",
  "2) Nhận xét ngắn: kỹ năng mạnh/yếu theo số liệu; điều đáng lo (bỏ học nhiều ngày, điểm tụt).",
  "3) KẾ HOẠCH HÔM NAY 20–30 phút, chỉ dùng các mục trong app, ghi tên bài/tình huống cụ thể và số phút, dạng danh sách đánh số ngắn để tôi dán lại vào app.",
  "4) 5 câu kiểm tra nhanh bằng tiếng Anh vừa sức tôi, đáp án để ở cuối.",
  "5) Nếu tôi dán bài viết hoặc lời nói đã chép: chữa từng câu và viết lại bản tốt hơn.",
  "",
  "Quy tắc: trả lời bằng tiếng Việt, ngắn gọn. Điểm trong phiếu là tự luyện/tự chấm — đừng kết luận trình độ CEFR từ đó. Nếu tôi nghỉ nhiều ngày, giao kế hoạch nhẹ để quay lại.",
].join("\n");

export function buildStudyBrief(data: StudyBriefData): string {
  const lines: string[] = [];
  lines.push(`PHIẾU HỌC TIẾNG ANH — ${data.date}`);
  lines.push("");
  lines.push("Số liệu từ app tự học của tôi (điểm tự luyện/tự chấm, không phải chứng chỉ):");
  const w = data.week;
  lines.push(`- 7 ngày qua: ${w.activeDays}/7 ngày có học · ${w.doneCount} lượt Done · ${w.reviewCount} lượt ôn · theo kỹ năng: Nghe ${w.skills.listening}, Đọc ${w.skills.reading}, Viết ${w.skills.writing}, Nói ${w.skills.speaking}`);
  lines.push(`- Chuỗi ngày học: ${data.streak} ngày liên tiếp · tổng ${data.totalDone} lần Done tiếng Anh`);
  lines.push(`- Daily: ${data.dueDailyReviews} bài đến hạn ôn${data.nextDaily ? ` · bài tiếp theo: ${data.nextDaily}` : ""}`);

  const listening = data.listening;
  const partBits = (Object.keys(PART_NAMES_VI) as (keyof LabParts)[])
    .map((key) => `${PART_NAMES_VI[key]} ${listening.parts[key] === null ? "chưa có" : pc(listening.parts[key] as number)}`)
    .join(" · ");
  const weak = weakestPart(listening.parts);
  lines.push(`- Phòng nghe: ${listening.done}/${listening.total} bài xong đủ 4 phần. Điểm trung bình: ${partBits}${weak ? ` (yếu nhất: ${PART_NAMES_VI[weak]})` : ""}`);
  lines.push(listening.lastLesson
    ? `  + Bài gần nhất: ${listening.lastLesson.title} — ${listening.lastLesson.score}% (${listening.lastLesson.date})`
    : "  + Chưa làm bài nào ở Phòng nghe.");
  lines.push(listening.lastTest
    ? `  + Đề luyện gần nhất: ${listening.lastTest.score}/${listening.lastTest.total} (${listening.lastTest.date}${listening.lastTest.level ? `, mức ${listening.lastTest.level}` : ", tổng hợp"})`
    : "  + Chưa làm đề luyện nào.");

  const speaking = data.speaking;
  const untouched = speaking.total - speaking.ready - speaking.almost - speaking.practice;
  lines.push(`- Phòng nói (${speaking.total} tình huống): Nói được ${speaking.ready} · Gần được ${speaking.almost} · Cần luyện ${speaking.practice} · Chưa luyện ${untouched}`);
  if (speaking.due.length) lines.push(`  + Đến hạn ôn: ${speaking.due.join(", ")}`);
  if (speaking.next) lines.push(`  + Tình huống nên luyện tiếp: ${speaking.next}`);

  lines.push("");
  if (data.previousPlan) {
    const text = data.previousPlan.text.length > PLAN_IN_BRIEF ? `${data.previousPlan.text.slice(0, PLAN_IN_BRIEF)}…` : data.previousPlan.text;
    lines.push(`KẾ HOẠCH LẦN TRƯỚC (bạn giao ngày ${data.previousPlan.date}):`);
    lines.push(text);
  } else {
    lines.push("KẾ HOẠCH LẦN TRƯỚC: chưa có (đây là phiếu đầu tiên hoặc tôi chưa lưu kế hoạch).");
  }

  lines.push("");
  lines.push("VIỆC CỦA BẠN (ChatGPT) — trả lời bằng tiếng Việt, ngắn gọn:");
  lines.push("1) So với kế hoạch lần trước: tôi làm được gì, còn thiếu gì? Kỹ năng nào mạnh/yếu theo số liệu?");
  lines.push("2) KẾ HOẠCH HÔM NAY 20–30 phút, chỉ chọn trong app (Daily, Phòng nghe: bài mới hay làm lại bài điểm thấp, Luyện đề, Phòng nói: tình huống cụ thể). Danh sách đánh số, ghi số phút từng mục.");
  lines.push("3) 5 câu kiểm tra nhanh bằng tiếng Anh vừa sức tôi (trắc nghiệm hoặc điền từ), đáp án ở cuối.");
  lines.push("4) Nếu bên dưới có bài viết hoặc lời nói tôi đã chép lại: chữa từng câu và viết lại bản tốt hơn.");
  lines.push("");
  lines.push("[Dán bài viết / lời nói đã chép của bạn vào đây nếu muốn được chữa]");
  return lines.join("\n");
}
