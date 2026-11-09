import { z } from "zod";
import { readProfileStorage, writeProfileStorage } from "./learnerProfiles.ts";

export const CONVERSATION_SCENARIOS = [
  {
    id: "en-clarify" as const, language: "en" as const, title: "Hỏi rõ trước khi nhận lời", role: "Đồng nghiệp mới",
    goal: "Làm rõ yêu cầu, thương lượng thời gian và xác nhận việc sẽ làm.",
    context: "Một đồng nghiệp muốn bạn gửi một tài liệu, nhưng chưa nói rõ cần bản nào. Không dùng dữ liệu công việc thật.",
    turns: [
      { line: "Can you send me the update today?", meaning: "Bạn có thể gửi bản cập nhật hôm nay không?", task: "Chưa rõ họ cần bản nào: hãy hỏi làm rõ.", hint: "Do you mean …?" },
      { line: "I mean a short summary, not the full report. When can you send it?", meaning: "Tôi cần bản tóm tắt ngắn, không phải báo cáo đầy đủ. Khi nào bạn gửi được?", task: "Đề xuất thời gian và giải thích ngắn.", hint: "I can … by …, but …" },
      { line: "Could you send it an hour earlier?", meaning: "Bạn có thể gửi sớm hơn một giờ không?", task: "Chấp nhận hoặc đề xuất phương án khác; xác nhận lại.", hint: "Would … work instead?" },
    ],
    retry: [
      { line: "Can you help me prepare something for tomorrow?", meaning: "Bạn có thể giúp tôi chuẩn bị một thứ cho ngày mai không?", task: "Hỏi rõ cần chuẩn bị gì.", hint: "What exactly …?" },
      { line: "Just three slides. I need them before ten.", meaning: "Chỉ ba slide. Tôi cần trước mười giờ.", task: "Đề nghị thời gian bạn thực sự có thể làm được.", hint: "I could …" },
      { line: "The meeting has moved to nine. What could we do?", meaning: "Cuộc họp chuyển lên chín giờ. Chúng ta có thể làm gì?", task: "Đưa ra lựa chọn thay thế và hỏi họ đồng ý không.", hint: "One option is …" },
    ],
    model: "A: Could you send me the update?\nB: Do you mean the short summary or the full report?\nA: Just the summary.\nB: I can send a draft by three. Would that work?",
    modelMeaning: "Hỏi rõ sản phẩm cần gửi → đề xuất bản nháp và thời gian → xác nhận. Đây là mẫu khác, không phải đáp án các lượt tập.",
    pattern: "Do you mean …, or …?", soundFocus: "Nghe và so sánh trọng âm ở các từ mang ý chính; ưu tiên người nghe hiểu được, không bắt chước giọng hoàn hảo.",
    writingTask: "Viết 30–50 từ xác nhận việc bạn vừa thống nhất: cần gửi gì, lúc nào, còn giới hạn gì. Dùng chi tiết do bạn tự chọn.",
    source: "https://www.cambridgeenglish.org/learning-english/activities-for-learners/b1l054-listening-to-dialogues", sourceLabel: "Cambridge · bài nghe hội thoại B1–B2 miễn phí",
  },
  {
    id: "zh-drinks" as const, language: "zh" as const, title: "Gọi đồ uống khi món đã hết", role: "Nhân viên quán",
    goal: "Gọi món, trả lời nóng/lạnh, chọn món khác và xác nhận.",
    context: "Bạn đang mua đồ uống. Dùng câu ngắn; có thể hỏi lại hoặc xem pinyin khi bí.",
    turns: [
      { line: "你好，你想喝什么？", meaning: "Xin chào, bạn muốn uống gì?", pinyin: "Nǐ hǎo, nǐ xiǎng hē shénme?", task: "Gọi một đồ uống bạn biết.", hint: "我想要…… · Wǒ xiǎng yào …" },
      { line: "要热的还是冰的？", meaning: "Bạn muốn nóng hay lạnh?", pinyin: "Yào rè de háishi bīng de?", task: "Chọn nóng hoặc lạnh.", hint: "热的 / 冰的 · rè de / bīng de" },
      { line: "不好意思，这个没有了。喝水可以吗？", meaning: "Xin lỗi, món này hết rồi. Uống nước được không?", pinyin: "Bù hǎoyìsi, zhège méiyǒu le. Hē shuǐ kěyǐ ma?", task: "Đồng ý hoặc đề nghị một món khác, rồi cảm ơn.", hint: "可以 / 那我要…… · Kěyǐ / Nà wǒ yào …" },
    ],
    retry: [
      { line: "你好，喝点什么？", meaning: "Xin chào, bạn uống gì?", pinyin: "Nǐ hǎo, hē diǎn shénme?", task: "Gọi đồ uống khác lượt đầu.", hint: "我要…… · Wǒ yào …" },
      { line: "一杯还是两杯？", meaning: "Một cốc hay hai cốc?", pinyin: "Yì bēi háishi liǎng bēi?", task: "Chọn số lượng cho bạn hoặc bạn bè.", hint: "一杯 / 两杯 · yì bēi / liǎng bēi" },
      { line: "现在只有热的，可以吗？", meaning: "Bây giờ chỉ có loại nóng, được không?", pinyin: "Xiànzài zhǐ yǒu rè de, kěyǐ ma?", task: "Đồng ý hoặc hỏi xem có nước không.", hint: "有水吗？ · Yǒu shuǐ ma?" },
    ],
    model: "A: 你想喝什么？\nB: 我想要一杯茶。\nA: 热的还是冰的？\nB: 热的，谢谢。",
    modelMeaning: "Nǐ xiǎng hē shénme? / Wǒ xiǎng yào yì bēi chá. / Rè de háishi bīng de? / Rè de, xièxie.\nBạn muốn uống gì? / Tôi muốn một cốc trà. / Nóng hay lạnh? / Nóng, cảm ơn.",
    pattern: "我想要…… / ……可以吗？", soundFocus: "Chọn một cụm như 一杯茶 để nghe lại âm và thanh điệu trong cả cụm. Chữ nhận dạng đúng không chứng minh phát âm chuẩn.",
    writingTask: "Gõ một tin nhắn gọi đồ uống cho hai người: món, số lượng và nóng/lạnh. Chữ Hán hoặc pinyin đều được; tự đổi ít nhất một chi tiết so với mẫu.",
    source: "https://mandarinbean.com/im-thirsty/", sourceLabel: "Mandarin Bean · hội thoại và audio miễn phí; bài tập/bản dịch đầy đủ cần Premium",
  },
];

export type ConversationScenario = (typeof CONVERSATION_SCENARIOS)[number];
export const conversationScenario = (id: string) => CONVERSATION_SCENARIOS.find(s => s.id === id);
const sessionSchema = z.object({
  version: z.literal(1), id: z.string().min(1).max(100), scenarioId: z.enum(["en-clarify", "zh-drinks"]),
  startedAt: z.iso.datetime(), savedAt: z.iso.datetime(), stage: z.number().int().min(0).max(4),
  turn: z.number().int().min(0).max(2).default(0),
  first: z.array(z.string().max(5000)).length(3), retry: z.array(z.string().max(5000)).length(3),
  spokeFirst: z.array(z.boolean()).length(3), spokeRetry: z.array(z.boolean()).length(3),
  listened: z.boolean(), read: z.boolean(), writing: z.string().max(5000),
  gap: z.string().max(300), phrase: z.string().max(300), repaired: z.string().max(1000),
  completedAt: z.iso.datetime().nullable(),
});
export type ConversationSession = z.infer<typeof sessionSchema>;

export function freshConversation(scenarioId: ConversationSession["scenarioId"], now = new Date().toISOString()): ConversationSession {
  return { version: 1, id: crypto.randomUUID(), scenarioId, startedAt: now, savedAt: now, stage: 0, turn: 0,
    first: ["", "", ""], retry: ["", "", ""], spokeFirst: [false, false, false], spokeRetry: [false, false, false],
    listened: false, read: false, writing: "", gap: "", phrase: "", repaired: "", completedAt: null };
}

export function readConversationSessions(scenarioId: string): ConversationSession[] {
  const raw = readProfileStorage("conversation-practice-v1:" + scenarioId);
  if (!raw) return [];
  const sessions = z.array(sessionSchema).parse(JSON.parse(raw));
  if (sessions.some(s => s.scenarioId !== scenarioId)) throw new Error("Lịch sử không khớp tình huống.");
  return sessions.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function saveConversationSession(session: ConversationSession) {
  const next = sessionSchema.parse(session);
  const history = readConversationSessions(next.scenarioId);
  const index = history.findIndex(s => s.id === next.id);
  if (index < 0) history.unshift(next); else history[index] = next;
  writeProfileStorage("conversation-practice-v1:" + next.scenarioId, JSON.stringify(history));
}

export function canFinishConversation(s: ConversationSession): boolean {
  return s.first.every(v => !!v.trim()) && s.retry.every(v => !!v.trim()) && s.spokeFirst.every(Boolean) && s.spokeRetry.every(Boolean) &&
    s.listened && s.read && !!s.writing.trim() && !!s.gap.trim() && !!s.phrase.trim() && !!s.repaired.trim();
}

export function conversationBrief(s: ConversationScenario): string {
  return `Hãy đóng vai ${s.role} để tôi luyện ${s.language === "en" ? "tiếng Anh khoảng B1" : "tiếng Trung sơ cấp"}. Tình huống: ${s.context}\nMục tiêu: ${s.goal}\nHỏi từng câu ngắn, đợi tôi trả lời rồi hỏi tiếp dựa vào ý tôi. Sau vài lượt đổi một điều kiện để tôi xử lý. Chưa hiện câu trả lời mẫu; chỉ gợi ý một cụm nếu tôi yêu cầu. Nếu tôi không hiểu, diễn đạt đơn giản hơn. Không ngắt lời sửa liên tục. Cuối buổi nêu một điểm mạnh, một lỗi ngôn ngữ và một câu để thử lại; không suy ra điểm thi hoặc CEFR. Chỉ nhận xét phát âm khi thật sự nghe được audio và nêu rõ giới hạn.`;
}
