/**
 * Phòng nói: luyện nói theo tình huống, mỗi tình huống 2 trường hợp, một quy trình cố định dựa
 * trên các kết quả nghiên cứu về học tập: câu khung (formulaic chunks) + nói đuổi (shadowing) →
 * nhớ lại chủ động từ gợi ý tiếng Việt (testing effect) → nhập vai có giới hạn thời gian →
 * đổi trường hợp (interleaving) → nói liền 4/3/2 (Nation) → lịch ôn giãn cách (spacing).
 * Kịch bản do dự án soạn; không có AI chấm. Điểm là tự chấm, không chứng nhận trình độ.
 * File này không đụng tới trình duyệt: đọc/ghi localStorage nằm ở component.
 */
import type { LabLevel } from "./listeningLab.ts";

export interface SpeakChunk { en: string; vi: string }
/** Một lượt: người kia nói `partner`, bạn đáp theo gợi ý `cue`; `model` là một câu đáp mẫu. */
export interface SpeakTurn { partner: string; cue: string; model: string }
export interface SpeakCase {
  id: string;
  name: string;
  /** Điều khác của trường hợp này và kế hoạch "nếu… thì nói…". */
  plan: string;
  turns: SpeakTurn[];
}
export interface SpeakSituation {
  id: string;
  level: LabLevel;
  title: string;
  titleVi: string;
  goal: string;
  chunks: SpeakChunk[];
  cases: SpeakCase[];
  /** Đề nói liền 4/3/2 (tiếng Việt). */
  retell: string;
}

/** Câu cứu nguy: dùng được trong mọi tình huống khi không hiểu, bí từ hoặc cần thời gian nghĩ. */
export const RESCUE: (SpeakChunk & { use: string })[] = [
  { en: "Sorry, could you say that again?", vi: "Xin lỗi, bạn nói lại được không?", use: "Không nghe kịp" },
  { en: "Could you speak a bit more slowly, please?", vi: "Bạn nói chậm hơn một chút được không?", use: "Người kia nói nhanh" },
  { en: "Sorry, what does that word mean?", vi: "Xin lỗi, từ đó nghĩa là gì?", use: "Gặp từ lạ" },
  { en: "Do you mean…?", vi: "Ý bạn là… phải không?", use: "Kiểm tra mình hiểu đúng" },
  { en: "Let me think for a second.", vi: "Để tôi nghĩ một chút.", use: "Cần thời gian" },
  { en: "It's a kind of… / It's like…", vi: "Nó là một loại… / Nó giống như…", use: "Quên từ: nói vòng" },
  { en: "What I mean is…", vi: "Ý tôi là…", use: "Nói lại cho rõ" },
];

export const SITUATIONS: SpeakSituation[] = [
  {
    id: "cafe-order", level: "easy", title: "Ordering at a café", titleVi: "Gọi đồ ở quán cà phê",
    goal: "Gọi đồ uống, hỏi giá, chọn mang đi hay ngồi lại, và xử lý khi món đã hết.",
    chunks: [
      { en: "Can I have a…, please?", vi: "Cho tôi một…, nhé?" },
      { en: "How much is it?", vi: "Bao nhiêu tiền vậy?" },
      { en: "For here, please. / To go, please.", vi: "Uống ở đây. / Mang đi." },
      { en: "Do you have anything without sugar?", vi: "Có món nào không đường không?" },
      { en: "That's fine, I'll have that instead.", vi: "Được, vậy cho tôi món đó thay." },
      { en: "Can I pay by card?", vi: "Tôi trả bằng thẻ được không?" },
    ],
    cases: [
      { id: "normal", name: "Gọi món bình thường", plan: "Nếu không nghe rõ giá → \"Sorry, how much was that?\"", turns: [
        { partner: "Hi! What can I get for you?", cue: "Gọi một ly cà phê sữa cỡ vừa.", model: "Can I have a medium coffee with milk, please?" },
        { partner: "Sure. For here or to go?", cue: "Nói là mang đi.", model: "To go, please." },
        { partner: "Anything else?", cue: "Không, hỏi bao nhiêu tiền.", model: "No, thanks. How much is it?" },
        { partner: "That's four fifty.", cue: "Hỏi có trả bằng thẻ được không.", model: "Can I pay by card?" },
      ] },
      { id: "sold-out", name: "Món bạn muốn đã hết", plan: "Nếu món hết → hỏi món gần giống: \"What do you recommend instead?\"", turns: [
        { partner: "Hello! What would you like?", cue: "Gọi một trà đào.", model: "Hi, can I have a peach tea, please?" },
        { partner: "Sorry, we're out of peach tea today.", cue: "Hỏi họ gợi ý món gì thay.", model: "Oh, OK. What do you recommend instead?" },
        { partner: "Our lemon tea is very popular. It's a bit sweet.", cue: "Hỏi có loại không đường không.", model: "Do you have it without sugar?" },
        { partner: "Yes, we can make it without sugar.", cue: "Đồng ý lấy món đó, uống tại quán.", model: "That's fine, I'll have that. For here, please." },
      ] },
    ],
    retell: "Kể lại lần gần nhất bạn đi cà phê: đi đâu, gọi gì, có gì đặc biệt.",
  },
  {
    id: "directions", level: "easy", title: "Asking for directions", titleVi: "Hỏi đường",
    goal: "Hỏi đường, nhắc lại để kiểm tra, và xin nói chậm khi người kia nói quá nhanh.",
    chunks: [
      { en: "Excuse me, how do I get to…?", vi: "Xin lỗi, đi đến… thế nào ạ?" },
      { en: "Is it far from here?", vi: "Có xa đây không?" },
      { en: "So I turn left at the bank, right?", vi: "Vậy tôi rẽ trái ở ngân hàng, đúng không?" },
      { en: "Can I walk there?", vi: "Đi bộ tới đó được không?" },
      { en: "Thanks for your help!", vi: "Cảm ơn bạn đã giúp!" },
    ],
    cases: [
      { id: "clear", name: "Người chỉ đường rõ ràng", plan: "Luôn nhắc lại đường đi để kiểm tra: \"So I…, right?\"", turns: [
        { partner: "Hi, can I help you?", cue: "Hỏi đường đến ga tàu.", model: "Yes, please. How do I get to the train station?" },
        { partner: "Go straight and turn left at the bank. It's on your right.", cue: "Nhắc lại để kiểm tra.", model: "So I go straight and turn left at the bank, right?" },
        { partner: "That's right.", cue: "Hỏi có xa không, đi bộ được không.", model: "Is it far? Can I walk there?" },
        { partner: "It's about ten minutes on foot.", cue: "Cảm ơn.", model: "Great, thanks for your help!" },
      ] },
      { id: "fast", name: "Người kia nói rất nhanh", plan: "Nếu không theo kịp → \"Could you speak a bit more slowly, please?\" rồi hỏi từng đoạn.", turns: [
        { partner: "Oh the museum? Yeah you just go down here past the lights hang a right then it's the second left after the park you can't miss it.", cue: "Xin họ nói chậm lại.", model: "Sorry, could you speak a bit more slowly, please?" },
        { partner: "Sure. Go past the traffic lights, then turn right.", cue: "Nhắc lại phần vừa nghe.", model: "OK, past the traffic lights, then turn right." },
        { partner: "Yes. Then take the second left after the park.", cue: "Hỏi lại cho chắc: rẽ trái thứ hai à?", model: "The second left after the park?" },
        { partner: "Exactly. The museum is right there.", cue: "Cảm ơn và nói bạn hiểu rồi.", model: "Got it. Thank you so much!" },
      ] },
    ],
    retell: "Chỉ đường từ nhà bạn đến chỗ mua đồ ăn gần nhất, như đang nói với một người nước ngoài.",
  },
  {
    id: "small-talk", level: "easy", title: "Meeting someone new", titleVi: "Làm quen, nói chuyện xã giao",
    goal: "Giới thiệu bản thân, hỏi lại người kia, giữ câu chuyện bằng câu hỏi mở.",
    chunks: [
      { en: "Nice to meet you. I'm…", vi: "Rất vui được gặp bạn. Tôi là…" },
      { en: "What do you do?", vi: "Bạn làm nghề gì?" },
      { en: "How about you?", vi: "Còn bạn thì sao?" },
      { en: "How long have you been here?", vi: "Bạn ở đây bao lâu rồi?" },
      { en: "That sounds interesting! Tell me more.", vi: "Nghe hay quá! Kể thêm đi." },
    ],
    cases: [
      { id: "coworker", name: "Đồng nghiệp mới", plan: "Mỗi câu trả lời xong → hỏi lại \"How about you?\" để câu chuyện không tắt.", turns: [
        { partner: "Hi, I'm Sam. I just joined the marketing team.", cue: "Chào, giới thiệu tên bạn.", model: "Nice to meet you, Sam. I'm Max." },
        { partner: "Which team are you on?", cue: "Nói bạn làm ở phòng nào, hỏi lại.", model: "I work in accounting. How about you, how's your first week?" },
        { partner: "Busy, but good! Everyone is friendly.", cue: "Hỏi Sam trước đây làm ở đâu.", model: "That's great. Where did you work before?" },
        { partner: "At a small travel company.", cue: "Tỏ ra quan tâm, xin kể thêm.", model: "That sounds interesting! Tell me more." },
      ] },
      { id: "stranger", name: "Người lạ ở một sự kiện", plan: "Nếu im lặng khó xử → bình luận về sự kiện: \"This is a great event, isn't it?\"", turns: [
        { partner: "Hi there. Is this seat free?", cue: "Nói ghế trống, mời ngồi.", model: "Yes, it's free. Please sit down." },
        { partner: "Thanks. So, how do you know the host?", cue: "Nói bạn là bạn đại học của chủ nhà.", model: "We were at university together. How about you?" },
        { partner: "We work together. I'm Lena, by the way.", cue: "Chào và giới thiệu tên.", model: "Nice to meet you, Lena. I'm Max." },
        { partner: "Are you from around here?", cue: "Nói bạn ở Sài Gòn, hỏi lại Lena.", model: "Yes, I live in Saigon. How long have you been here?" },
      ] },
    ],
    retell: "Giới thiệu bản thân với một người mới: tên, công việc, một sở thích, một điều bạn đang học.",
  },
  {
    id: "doctor", level: "medium", title: "At the doctor's", titleVi: "Đi khám bệnh",
    goal: "Đặt lịch qua điện thoại, mô tả triệu chứng, hỏi lại hướng dẫn dùng thuốc.",
    chunks: [
      { en: "I'd like to make an appointment.", vi: "Tôi muốn đặt lịch khám." },
      { en: "I've had a … for three days.", vi: "Tôi bị… ba ngày rồi." },
      { en: "It hurts when I…", vi: "Tôi bị đau khi…" },
      { en: "Is it serious?", vi: "Có nghiêm trọng không?" },
      { en: "How often should I take it?", vi: "Tôi nên uống bao lâu một lần?" },
      { en: "Could you write that down for me?", vi: "Bạn viết ra giúp tôi được không?" },
    ],
    cases: [
      { id: "phone", name: "Đặt lịch qua điện thoại", plan: "Gọi điện khó nghe hơn gặp mặt → nhắc lại ngày giờ: \"So that's Thursday at nine?\"", turns: [
        { partner: "Good morning, City Clinic. How can I help?", cue: "Nói muốn đặt lịch khám.", model: "Hi, I'd like to make an appointment, please." },
        { partner: "Sure. What's the problem?", cue: "Nói bị đau họng ba ngày rồi.", model: "I've had a sore throat for three days." },
        { partner: "We have Thursday at nine or Friday at two.", cue: "Chọn thứ Năm và nhắc lại để kiểm tra.", model: "Thursday is good. So that's Thursday at nine?" },
        { partner: "Yes. Can I have your name, please?", cue: "Nói tên và đánh vần.", model: "It's Max, M-A-X." },
      ] },
      { id: "clinic", name: "Mô tả triệu chứng tại phòng khám", plan: "Không biết tên bệnh → mô tả bằng câu đơn: \"It hurts when I…\"", turns: [
        { partner: "So, what brings you in today?", cue: "Nói bị đau lưng một tuần rồi.", model: "I've had back pain for a week." },
        { partner: "When does it hurt the most?", cue: "Nói đau khi ngồi lâu ở bàn làm việc.", model: "It hurts when I sit at my desk for a long time." },
        { partner: "It's probably a muscle problem. Take this twice a day after meals.", cue: "Hỏi có nghiêm trọng không.", model: "Is it serious?" },
        { partner: "No, but stretch every hour and come back if it doesn't get better.", cue: "Xin bác sĩ viết hướng dẫn ra giấy.", model: "OK. Could you write that down for me, please?" },
      ] },
    ],
    retell: "Kể lần gần nhất bạn bị ốm: bị gì, làm gì để khỏi, mất bao lâu.",
  },
  {
    id: "interview", level: "medium", title: "Job interview", titleVi: "Phỏng vấn xin việc",
    goal: "Trả lời câu hỏi quen thuộc theo khung: ý chính → ví dụ → kết nối với công việc; xử lý câu hỏi khó.",
    chunks: [
      { en: "I have … years of experience in…", vi: "Tôi có … năm kinh nghiệm về…" },
      { en: "For example, in my last job I…", vi: "Ví dụ, ở công việc trước tôi đã…" },
      { en: "I'm good at…", vi: "Tôi giỏi về…" },
      { en: "One thing I'm working on is…", vi: "Một điều tôi đang cải thiện là…" },
      { en: "That's a good question. Let me think.", vi: "Câu hỏi hay. Để tôi nghĩ một chút." },
      { en: "Could you tell me more about the team?", vi: "Anh/chị kể thêm về nhóm được không?" },
    ],
    cases: [
      { id: "basic", name: "Câu hỏi cơ bản", plan: "Mỗi câu trả lời theo khung: ý chính → ví dụ → vì sao hợp với việc này.", turns: [
        { partner: "Tell me a little about yourself.", cue: "Nói kinh nghiệm và lĩnh vực của bạn.", model: "I have five years of experience in accounting, mostly with international suppliers." },
        { partner: "What are you good at?", cue: "Nói một điểm mạnh và một ví dụ.", model: "I'm good at finding errors. For example, in my last job I fixed our payment records." },
        { partner: "Why do you want this job?", cue: "Nói vì muốn học thêm và đóng góp cho nhóm.", model: "I want to grow in a bigger team, and I think my experience can help you." },
        { partner: "Do you have any questions for us?", cue: "Hỏi thêm về nhóm.", model: "Yes. Could you tell me more about the team?" },
      ] },
      { id: "hard", name: "Câu hỏi khó", plan: "Bị hỏi bất ngờ → câu giữ lượt \"That's a good question. Let me think.\" rồi trả lời theo khung.", turns: [
        { partner: "What is your biggest weakness?", cue: "Nêu một điểm yếu thật và cách bạn đang cải thiện.", model: "That's a good question. I'm not confident speaking English in meetings, so I practice every day." },
        { partner: "Tell me about a mistake you made at work.", cue: "Kể ngắn một lỗi và bạn đã học được gì.", model: "Once I sent a report late. Since then I plan my week every Monday." },
        { partner: "Why should we hire you and not someone else?", cue: "Nêu hai điểm mạnh liên quan đến công việc.", model: "I'm careful with details, and I learn new tools quickly." },
        { partner: "What salary are you expecting?", cue: "Hỏi lại mức lương của vị trí trước khi trả lời.", model: "Could you tell me the salary range for this position first?" },
      ] },
    ],
    retell: "Giới thiệu bản thân như ở đầu buổi phỏng vấn: kinh nghiệm, điểm mạnh, vì sao muốn công việc này.",
  },
  {
    id: "guide-place", level: "medium", title: "Showing a visitor around", titleVi: "Giới thiệu một điểm đến cho khách nước ngoài",
    goal: "Giới thiệu một nơi ở Việt Nam, gợi ý món ăn, trả lời câu hỏi về giá và giờ mở cửa.",
    chunks: [
      { en: "This place is famous for…", vi: "Nơi này nổi tiếng về…" },
      { en: "It was built in…", vi: "Nó được xây vào năm…" },
      { en: "You should try…", vi: "Bạn nên thử…" },
      { en: "The best time to visit is…", vi: "Thời điểm đẹp nhất để đến là…" },
      { en: "It costs about … dong.", vi: "Giá khoảng … đồng." },
      { en: "I'm not sure, but I can check for you.", vi: "Tôi không chắc, nhưng tôi kiểm tra giúp bạn được." },
    ],
    cases: [
      { id: "tour", name: "Dẫn khách tham quan", plan: "Mỗi điểm nói 3 ý: nó là gì → điều đặc biệt → bạn gợi ý làm gì.", turns: [
        { partner: "Wow, what is this building?", cue: "Nói đây là chợ Bến Thành, nổi tiếng về đồ ăn và quà lưu niệm.", model: "This is Ben Thanh Market. It's famous for street food and souvenirs." },
        { partner: "Is it very old?", cue: "Nói nó được xây khoảng hơn 100 năm trước.", model: "Yes, it was built more than a hundred years ago." },
        { partner: "What should I eat here?", cue: "Gợi ý thử bánh xèo.", model: "You should try banh xeo. It's a crispy pancake with shrimp and herbs." },
        { partner: "How much does it cost?", cue: "Nói khoảng 60 nghìn đồng.", model: "It costs about sixty thousand dong." },
      ] },
      { id: "unknown", name: "Bị hỏi điều bạn không biết", plan: "Không biết thì nói thật → \"I'm not sure, but I can check for you.\" Không đoán bừa.", turns: [
        { partner: "What time does the museum close?", cue: "Nói không chắc nhưng sẽ kiểm tra giúp.", model: "I'm not sure, but I can check for you." },
        { partner: "Thanks. And do I need to book tickets?", cue: "Nói thường không cần, mua tại cửa được.", model: "Usually not. You can buy them at the door." },
        { partner: "Is it safe to walk there at night?", cue: "Nói khá an toàn, nhưng nên giữ kỹ điện thoại.", model: "It's quite safe, but keep your phone in your bag." },
        { partner: "What's a word I should learn in Vietnamese?", cue: "Dạy họ nói \"cảm ơn\" và giải thích nghĩa.", model: "Try \"cảm ơn\". It means thank you." },
      ] },
    ],
    retell: "Giới thiệu thành phố hoặc quê bạn cho một khách nước ngoài: nổi tiếng về gì, nên ăn gì, nên đi lúc nào.",
  },
  {
    id: "complaint", level: "hard", title: "Making a complaint", titleVi: "Khiếu nại và thương lượng",
    goal: "Nêu vấn đề lịch sự nhưng rõ ràng, đưa ra yêu cầu cụ thể, thương lượng khi bị từ chối.",
    chunks: [
      { en: "I'm afraid there's a problem with…", vi: "Tôi e là có vấn đề với…" },
      { en: "I'd like a refund / a replacement.", vi: "Tôi muốn được hoàn tiền / đổi cái khác." },
      { en: "I understand, but…", vi: "Tôi hiểu, nhưng…" },
      { en: "Would it be possible to…?", vi: "Liệu có thể… được không?" },
      { en: "What can you offer instead?", vi: "Vậy bên bạn có thể đề xuất gì?" },
      { en: "Could I speak to the manager, please?", vi: "Cho tôi nói chuyện với quản lý được không?" },
    ],
    cases: [
      { id: "polite", name: "Khách sạn: phòng có vấn đề", plan: "Nêu vấn đề → ảnh hưởng → yêu cầu cụ thể (một câu cho mỗi ý).", turns: [
        { partner: "Front desk, how can I help you?", cue: "Nói máy lạnh phòng 305 không chạy.", model: "Hi, I'm afraid there's a problem with the air conditioner in room 305. It isn't working." },
        { partner: "I'm sorry about that. I'll send someone tomorrow morning.", cue: "Nói bạn không ngủ được, xin đổi phòng tối nay.", model: "I understand, but it's very hot and I can't sleep. Would it be possible to change rooms tonight?" },
        { partner: "Let me check… We only have a smaller room available.", cue: "Hỏi có giảm giá không nếu đổi sang phòng nhỏ.", model: "That's OK. Could you give me a discount for the smaller room?" },
        { partner: "We can take 20 percent off tonight.", cue: "Đồng ý và cảm ơn.", model: "That sounds fair. Thank you for your help." },
      ] },
      { id: "refused", name: "Cửa hàng: bị từ chối đổi trả", plan: "Bị nói \"không\" → đừng lặp lại yêu cầu; hỏi phương án khác hoặc gặp quản lý.", turns: [
        { partner: "Hi, can I help you?", cue: "Nói tai nghe mua tuần trước bị hỏng, muốn hoàn tiền.", model: "Yes. I bought these headphones last week and they stopped working. I'd like a refund." },
        { partner: "Sorry, we don't give refunds on electronics.", cue: "Nói bạn hiểu, hỏi họ đề xuất gì thay.", model: "I understand, but they're broken. What can you offer instead?" },
        { partner: "We can only send them for repair. It takes three weeks.", cue: "Nói ba tuần quá lâu, xin gặp quản lý.", model: "Three weeks is too long for me. Could I speak to the manager, please?" },
        { partner: "I'm the manager. I can give you a replacement today.", cue: "Đồng ý đổi cái mới.", model: "A replacement is fine. Thank you." },
      ] },
    ],
    retell: "Kể một lần bạn gặp dịch vụ tệ: chuyện gì xảy ra, bạn đã nói gì, kết quả ra sao, giờ bạn sẽ nói khác thế nào.",
  },
  {
    id: "meeting", level: "hard", title: "Giving your opinion in a meeting", titleVi: "Đưa ý kiến trong cuộc họp",
    goal: "Đồng ý và bổ sung, không đồng ý một cách lịch sự, chen lời và đề xuất bước tiếp theo.",
    chunks: [
      { en: "I agree, and I'd like to add that…", vi: "Tôi đồng ý, và muốn bổ sung rằng…" },
      { en: "I see your point, but…", vi: "Tôi hiểu ý bạn, nhưng…" },
      { en: "Sorry to interrupt, but…", vi: "Xin lỗi chen ngang, nhưng…" },
      { en: "What if we…?", vi: "Hay là chúng ta…?" },
      { en: "So, to sum up…", vi: "Vậy, tóm lại…" },
      { en: "Who will take care of…?", vi: "Ai sẽ phụ trách…?" },
    ],
    cases: [
      { id: "agree", name: "Đồng ý và bổ sung", plan: "Đồng ý → thêm một lý do mới, không lặp lại ý người trước.", turns: [
        { partner: "I think we should post on social media every day this month.", cue: "Đồng ý và bổ sung: dùng nhiều video ngắn.", model: "I agree, and I'd like to add that short videos work best for us." },
        { partner: "Good idea. Who can make the videos?", cue: "Nói bạn làm được hai video mỗi tuần.", model: "I can make two videos a week." },
        { partner: "Great. Anything else?", cue: "Đề xuất xem số liệu sau hai tuần.", model: "What if we check the numbers after two weeks?" },
        { partner: "Sounds good.", cue: "Tóm tắt kế hoạch.", model: "So, to sum up: daily posts, two videos a week, and a check in two weeks." },
      ] },
      { id: "disagree", name: "Không đồng ý lịch sự", plan: "Không đồng ý = công nhận ý họ + lý do + phương án khác. Tránh nói \"You're wrong\".", turns: [
        { partner: "Let's cut the training budget to save money.", cue: "Công nhận ý, nhưng nói nhân viên mới cần đào tạo.", model: "I see your point, but our new staff really need training." },
        { partner: "But the budget is very tight this quarter.", cue: "Đề xuất đào tạo online để rẻ hơn.", model: "What if we use online training? It costs much less." },
        { partner: "Hmm, I'm not sure the quality is good.", cue: "Đề xuất thử một tháng rồi đánh giá.", model: "Why don't we try it for one month and then decide?" },
        { partner: "OK, let's try that.", cue: "Hỏi ai sẽ phụ trách việc này.", model: "Great. Who will take care of choosing the course?" },
      ] },
    ],
    retell: "Nêu ý kiến của bạn: nên làm việc ở nhà hay ở văn phòng? Một lý do, một ví dụ, một đề xuất.",
  },
  {
    id: "presenting", level: "hard", title: "Presenting and handling questions", titleVi: "Trình bày ngắn và trả lời câu hỏi bất ngờ",
    goal: "Mở đầu rõ ràng, chuyển ý, và trả lời khi bị hỏi điều chưa chuẩn bị.",
    chunks: [
      { en: "Today I'd like to talk about…", vi: "Hôm nay tôi muốn nói về…" },
      { en: "First… Then… Finally…", vi: "Đầu tiên… Sau đó… Cuối cùng…" },
      { en: "As you can see,…", vi: "Như các bạn thấy,…" },
      { en: "Thank you, that's a great question.", vi: "Cảm ơn, câu hỏi rất hay." },
      { en: "I don't have the exact number, but I'll send it to you.", vi: "Tôi chưa có số chính xác, nhưng tôi sẽ gửi bạn sau." },
      { en: "Does that answer your question?", vi: "Như vậy đã trả lời câu hỏi của bạn chưa?" },
    ],
    cases: [
      { id: "opening", name: "Mở đầu và chuyển ý", plan: "Nói trước bố cục 3 phần, rồi đi đúng thứ tự đó.", turns: [
        { partner: "OK everyone, Max, you can start.", cue: "Chào và nói hôm nay bạn trình bày kết quả quý 3.", model: "Thank you. Today I'd like to talk about our results in the third quarter." },
        { partner: "(The room is listening.)", cue: "Nói bố cục: doanh thu, chi phí, kế hoạch.", model: "First, sales. Then, costs. Finally, our plan for next quarter." },
        { partner: "(You show a chart.)", cue: "Nói doanh thu tăng 12%.", model: "As you can see, sales went up twelve percent." },
        { partner: "(You finish the last slide.)", cue: "Kết thúc và mời đặt câu hỏi.", model: "That's all from me. Any questions?" },
      ] },
      { id: "questions", name: "Câu hỏi bất ngờ", plan: "Không biết → cảm ơn câu hỏi, nói thật, hẹn gửi sau, rồi kiểm tra người hỏi đã hài lòng.", turns: [
        { partner: "How much did we spend on advertising?", cue: "Nói chưa có số chính xác, sẽ gửi sau.", model: "I don't have the exact number, but I'll send it to you today." },
        { partner: "Why did costs go up in September?", cue: "Cảm ơn câu hỏi, nói do giá vận chuyển tăng.", model: "Thank you, that's a great question. Shipping prices went up in September." },
        { partner: "Sorry, I didn't catch that. Shipping?", cue: "Nhắc lại chậm và rõ hơn bằng câu khác.", model: "Yes. What I mean is, it cost more to send goods by sea." },
        { partner: "Ah, I see.", cue: "Hỏi như vậy đã trả lời được chưa.", model: "Does that answer your question?" },
      ] },
    ],
    retell: "Trình bày ngắn về một dự án bạn đang làm: mục tiêu, việc đã xong, bước tiếp theo.",
  },
];

export function speakSituation(id: string): SpeakSituation | null {
  return SITUATIONS.find((item) => item.id === id) ?? null;
}

/* ───────────────────────────── đánh giá và lịch ôn ───────────────────────────── */

/** Tự chấm một lượt nhập vai. */
export const TURN_RATINGS = [
  { value: 1, label: "Nói được ngay" },
  { value: 0.5, label: "Phải nghĩ / nhìn gợi ý" },
  { value: 0, label: "Chưa nói được" },
] as const;

/** Nói liền 4/3/2: ba lượt cùng một nội dung, mỗi lượt ngắn hơn. */
export const FLUENCY_ROUNDS = [60, 45, 30] as const;

export type Readiness = "ready" | "almost" | "practice";
export const READINESS_LABEL: Record<Readiness, string> = { ready: "Nói được", almost: "Gần được", practice: "Cần luyện thêm" };
const REVIEW_DAYS: Record<Readiness, number> = { ready: 7, almost: 3, practice: 1 };
const READY_THRESHOLD = 0.8;

export interface SpeakRecord {
  date: string;
  /** Tỉ lệ câu khung nhớ lại được, 0..1. */
  chunks: number | null;
  /** Điểm trung bình các lượt của từng trường hợp, 0..1. */
  cases: Record<string, number>;
  /** Số lượt 4/3/2 đã nói (0..3). */
  fluency: number;
  ready: Readiness | null;
  interval: number;
  due: string | null;
}

export interface SpeakStore { version: 1; situations: Record<string, SpeakRecord> }
export const SPEAK_STORE_KEY = "speaking-room-v1";

export function emptySpeakRecord(date: string): SpeakRecord {
  return { date, chunks: null, cases: {}, fluency: 0, ready: null, interval: 0, due: null };
}

/** "Nói được" chỉ khi nhớ ≥ 80% câu khung và mỗi trường hợp đạt ≥ 80% (nói ngay). */
export function readiness(situation: SpeakSituation, record: SpeakRecord): Readiness | null {
  const scores = situation.cases.map((item) => record.cases[item.id]);
  if (record.chunks === null || scores.some((value) => value === undefined)) return null;
  if (record.chunks >= READY_THRESHOLD && scores.every((value) => value >= READY_THRESHOLD)) return "ready";
  const all = [record.chunks, ...scores];
  return all.reduce((sum, value) => sum + value, 0) / all.length >= 0.5 ? "almost" : "practice";
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Lịch ôn giãn cách: vững thì giãn gấp đôi (7 → 14 → 28, tối đa 30 ngày), chưa vững thì ôn sớm. */
export function scheduleReview(previous: SpeakRecord | undefined, ready: Readiness, date: string): { interval: number; due: string } {
  const interval = ready === "ready" && previous?.ready === "ready" && previous.interval >= REVIEW_DAYS.ready
    ? Math.min(30, previous.interval * 2)
    : REVIEW_DAYS[ready];
  return { interval, due: addDays(date, interval) };
}

export function parseSpeakStore(raw: string | null): SpeakStore {
  const empty: SpeakStore = { version: 1, situations: {} };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<SpeakStore> | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.situations !== "object" || parsed.situations === null) return empty;
    return { version: 1, situations: parsed.situations };
  } catch {
    return empty;
  }
}

/** Ghi kết quả buổi luyện; khi đủ phần để đánh giá thì đặt lịch ôn. */
export function withSpeakResult(store: SpeakStore, situation: SpeakSituation, record: SpeakRecord): SpeakStore {
  const ready = readiness(situation, record);
  const previous = store.situations[situation.id];
  const next: SpeakRecord = { ...record, ready };
  if (ready) Object.assign(next, scheduleReview(previous?.date === record.date ? undefined : previous, ready, record.date));
  else { next.interval = previous?.interval ?? 0; next.due = previous?.due ?? null; }
  return { ...store, situations: { ...store.situations, [situation.id]: next } };
}

export function dueSituations(store: SpeakStore, today: string): SpeakSituation[] {
  return SITUATIONS.filter((item) => {
    const due = store.situations[item.id]?.due;
    return due !== null && due !== undefined && due <= today;
  });
}

/** Nên luyện gì: tình huống đến hạn ôn trước, rồi tình huống đầu tiên (Dễ → Khó) chưa "Nói được". */
export function nextSituation(store: SpeakStore, today: string): { situation: SpeakSituation; reason: "due" | "new" | "practice" } {
  const due = dueSituations(store, today)[0];
  if (due) return { situation: due, reason: "due" };
  const open = SITUATIONS.find((item) => store.situations[item.id]?.ready !== "ready");
  if (open) return { situation: open, reason: store.situations[open.id] ? "practice" : "new" };
  return { situation: SITUATIONS[0], reason: "practice" };
}
