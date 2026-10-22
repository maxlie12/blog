import type { SkillId } from "./lessonTypes";

export type LearningMethodId = "recall" | "shadow" | "retell" | "transform" | "learning-note";

export type LearningMethod = {
  id: LearningMethodId;
  label: string;
  minutes: string;
  summary: string;
  action: string;
  outputLabel: string;
  skills: SkillId[];
};

const METHODS: LearningMethod[] = [
  {
    id: "recall",
    label: "Nghe/đọc rồi nhớ lại",
    minutes: "3–5 phút",
    summary: "Đóng nguồn và lấy lại ý từ trí nhớ.",
    action: "Xem hoặc nghe một đoạn ngắn, đóng nguồn rồi ghi ý chính và một chi tiết bạn còn nhớ. Đánh dấu phần chưa chắc thay vì đoán.",
    outputLabel: "Ý chính + một chi tiết nhớ được",
    skills: ["listening", "reading"],
  },
  {
    id: "shadow",
    label: "Shadowing",
    minutes: "3–5 phút",
    summary: "Nghe, nhại theo rồi nói lại khi che chữ.",
    action: "Chọn một câu ngắn từ audio, nghe và nhại hai lượt. Sau đó che chữ và nói lại theo nhịp bạn vừa nghe.",
    outputLabel: "Câu đã shadow + từ/cụm khó nhất",
    skills: ["listening", "speaking"],
  },
  {
    id: "retell",
    label: "Kể lại",
    minutes: "5 phút",
    summary: "Dùng lời của bạn, không đọc lại script.",
    action: "Kể lại nội dung trong 30–45 giây hoặc 2–3 câu: chuyện gì xảy ra, chi tiết nào quan trọng và điều gì chưa chắc.",
    outputLabel: "Bản kể lại hoặc transcript thật đã nói",
    skills: ["listening", "reading", "speaking"],
  },
  {
    id: "transform",
    label: "Đổi tình huống",
    minutes: "5 phút",
    summary: "Giữ cấu trúc, thay người, vật hoặc mục đích.",
    action: "Lấy một cấu trúc trong bài và tạo hai câu mới cho hoàn cảnh của bạn. Chỉ đổi một chi tiết mỗi lần để thấy cấu trúc hoạt động ra sao.",
    outputLabel: "Hai câu mới dùng cùng cấu trúc",
    skills: ["speaking", "writing"],
  },
  {
    id: "learning-note",
    label: "Learning Note",
    minutes: "5–10 phút",
    summary: "Viết một ghi chú ngắn có thể giữ lại trên blog.",
    action: "Viết 40–80 từ: điều bạn học được, liên hệ thật của bạn và một câu hỏi hoặc bước tiếp theo. Không dùng AI sửa bản đầu.",
    outputLabel: "Learning Note 40–80 từ",
    skills: ["writing"],
  },
];

const DEFAULT_METHOD: Record<SkillId, LearningMethodId> = {
  listening: "recall",
  reading: "recall",
  speaking: "retell",
  writing: "learning-note",
};

export function getLearningMethods(skill: SkillId): LearningMethod[] {
  return METHODS.filter((method) => method.skills.includes(skill));
}

export function getDefaultLearningMethod(skill: SkillId): LearningMethodId {
  return DEFAULT_METHOD[skill];
}

export function isLearningMethodId(value: unknown): value is LearningMethodId {
  return typeof value === "string" && METHODS.some((method) => method.id === value);
}

export function getLearningMethod(id: LearningMethodId): LearningMethod {
  return METHODS.find((method) => method.id === id) ?? METHODS[0];
}
