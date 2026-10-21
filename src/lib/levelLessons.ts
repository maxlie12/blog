import type { SkillId } from "@/lib/lessonTypes";
export interface LevelLesson { id: string; language: string; skill: SkillId; title: string; level: string; instructions: string; material: string | null; exercises: string; completionCriteria: string; }
export const LEVEL_LESSONS: LevelLesson[] = [
  {
    "id": "level-en-a2-listening",
    "language": "en",
    "skill": "listening",
    "title": "A2 · Đổi lịch hẹn · listening",
    "level": "A2",
    "instructions": "Nguồn British Council miễn phí, có audio và transcript; link được kiểm tra 14/10/2026. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": "https://learnenglish.britishcouncil.org/free-resources/listening/a2/changing-plans",
    "exercises": "Listen once or twice without the transcript. What plan is changing? Note one time or activity you hear.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-a2-reading",
    "language": "en",
    "skill": "reading",
    "title": "A2 · Đổi lịch hẹn · reading",
    "level": "A2",
    "instructions": "Nguồn British Council miễn phí, có audio và transcript; link được kiểm tra 14/10/2026. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": "https://learnenglish.britishcouncil.org/free-resources/listening/a2/changing-plans",
    "exercises": "Read the matching transcript. Identify the proposed new plan and explain it in two simple sentences.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-a2-speaking",
    "language": "en",
    "skill": "speaking",
    "title": "A2 · Đổi lịch hẹn · speaking",
    "level": "A2",
    "instructions": "Tình huống trợ lý tự soạn. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": null,
    "exercises": "A friend wants to meet tonight, but you are busy. Suggest another day and give one simple reason. Speak for 20–30 seconds.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-a2-writing",
    "language": "en",
    "skill": "writing",
    "title": "A2 · Đổi lịch hẹn · writing",
    "level": "A2",
    "instructions": "Tình huống trợ lý tự soạn. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": null,
    "exercises": "Write a 25–40-word message to change a meeting: say you cannot come, give a reason, and suggest a new time.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-b1-listening",
    "language": "en",
    "skill": "listening",
    "title": "B1 · Kể lại một thay đổi · listening",
    "level": "B1",
    "instructions": "Nguồn British Council miễn phí, có audio và transcript; link được kiểm tra 14/10/2026. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": "https://learnenglish.britishcouncil.org/free-resources/listening/b1/meeting-old-friend",
    "exercises": "Listen once or twice without text. Summarise how the speakers' lives have changed. Include two details you heard.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-b1-reading",
    "language": "en",
    "skill": "reading",
    "title": "B1 · Kể lại một thay đổi · reading",
    "level": "B1",
    "instructions": "Nguồn British Council miễn phí, có audio và transcript; link được kiểm tra 14/10/2026. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": "https://learnenglish.britishcouncil.org/free-resources/listening/b1/meeting-old-friend",
    "exercises": "Read the transcript after listening. Explain one reason for a change and support it with a detail, using your own words.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-b1-speaking",
    "language": "en",
    "skill": "speaking",
    "title": "B1 · Kể lại một thay đổi · speaking",
    "level": "B1",
    "instructions": "Tình huống trợ lý tự soạn. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": null,
    "exercises": "Tell a friend about a change in your routine: before, what changed, why, and how you feel now. Speak for 45 seconds.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-b1-writing",
    "language": "en",
    "skill": "writing",
    "title": "B1 · Kể lại một thay đổi · writing",
    "level": "B1",
    "instructions": "Tình huống trợ lý tự soạn. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": null,
    "exercises": "Write 50–70 words about a change in your routine. Connect events with because, but or so where they fit.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-b2-listening",
    "language": "en",
    "skill": "listening",
    "title": "B2 · Cân nhắc một giải pháp · listening",
    "level": "B2",
    "instructions": "Nguồn British Council miễn phí, có audio và transcript; link được kiểm tra 14/10/2026. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": "https://learnenglish.britishcouncil.org/free-resources/listening/b2/digital-detox-podcast",
    "exercises": "Listen to 60–90 seconds without text. Summarise the argument, one supporting example, and one qualification. Mark uncertainty instead of guessing.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-b2-reading",
    "language": "en",
    "skill": "reading",
    "title": "B2 · Cân nhắc một giải pháp · reading",
    "level": "B2",
    "instructions": "Nguồn British Council miễn phí, có audio và transcript; link được kiểm tra 14/10/2026. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": "https://learnenglish.britishcouncil.org/free-resources/listening/b2/digital-detox-podcast",
    "exercises": "Read the matching transcript. Distinguish advice from personal experience. Paraphrase one of each and explain their relationship.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-b2-speaking",
    "language": "en",
    "skill": "speaking",
    "title": "B2 · Cân nhắc một giải pháp · speaking",
    "level": "B2",
    "instructions": "Tình huống trợ lý tự soạn. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": null,
    "exercises": "Should a team limit work notifications? Compare two approaches, explain a trade-off, and propose a way to check the result. Speak for 60 seconds.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-b2-writing",
    "language": "en",
    "skill": "writing",
    "title": "B2 · Cân nhắc một giải pháp · writing",
    "level": "B2",
    "instructions": "Tình huống trợ lý tự soạn. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": null,
    "exercises": "Write 80–100 words recommending a notification policy. Include a reason, an alternative, a drawback and a way to evaluate it.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-c1-listening",
    "language": "en",
    "skill": "listening",
    "title": "C1 · Hiểu sắc thái và giới hạn · listening",
    "level": "C1",
    "instructions": "Nguồn British Council miễn phí, có audio và transcript; link được kiểm tra 14/10/2026. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": "https://learnenglish.britishcouncil.org/free-resources/listening/c1/catching-after-trip",
    "exercises": "Listen to 60–90 seconds without text. Identify one attitude suggested by wording or tone. Separate explicit facts from your inference and explain the cue.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-c1-reading",
    "language": "en",
    "skill": "reading",
    "title": "C1 · Hiểu sắc thái và giới hạn · reading",
    "level": "C1",
    "instructions": "Nguồn British Council miễn phí, có audio và transcript; link được kiểm tra 14/10/2026. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": "https://learnenglish.britishcouncil.org/free-resources/listening/c1/catching-after-trip",
    "exercises": "Read that transcript section. Explain how an expression conveys attitude beyond its literal meaning; identify a possible alternative interpretation.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-c1-speaking",
    "language": "en",
    "skill": "speaking",
    "title": "C1 · Hiểu sắc thái và giới hạn · speaking",
    "level": "C1",
    "instructions": "Tình huống trợ lý tự soạn. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": null,
    "exercises": "A team wants stricter communication rules. Make a qualified recommendation, acknowledge a counterargument, and explain what evidence could change your view. Speak for 75–90 seconds.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-en-c1-writing",
    "language": "en",
    "skill": "writing",
    "title": "C1 · Hiểu sắc thái và giới hạn · writing",
    "level": "C1",
    "instructions": "Tình huống trợ lý tự soạn. Phiên 5–10 phút; có thể chia bài dài thành hai phiên. Câu hỏi do trợ lý soạn, không phải bài thi chính thức. Không dùng AI sửa trước khi lưu bản đầu.",
    "material": null,
    "exercises": "In 100–130 words, recommend a communication policy for a mixed team. Qualify your claims, address a counterargument, and state one uncertainty.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-zh-beginner-listening",
    "language": "zh",
    "skill": "listening",
    "title": "Beginner · Giới thiệu và gọi đồ uống · listening",
    "level": "Beginner",
    "instructions": "5 phút. Mức sơ cấp nội bộ, không phải chứng nhận HSK/CEFR. Mẫu và câu hỏi do trợ lý soạn. HelloChinese có nội dung miễn phí giới hạn và Premium trả phí; dùng audio người bản ngữ đang mở được, không cần mua gói cho nhiệm vụ này.",
    "material": "https://www.hellochinese.cc/",
    "exercises": "Mở audio giới thiệu/gọi đồ uống đang truy cập được trong HelloChinese. Nghe một câu không nhìn chữ; ghi tên hoặc đồ uống nghe được và số lượt nghe.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-zh-beginner-reading",
    "language": "zh",
    "skill": "reading",
    "title": "Beginner · Giới thiệu và gọi đồ uống · reading",
    "level": "Beginner",
    "instructions": "5 phút. Mức sơ cấp nội bộ, không phải chứng nhận HSK/CEFR. Mẫu và câu hỏi do trợ lý soạn. HelloChinese có nội dung miễn phí giới hạn và Premium trả phí; dùng audio người bản ngữ đang mở được, không cần mua gói cho nhiệm vụ này.",
    "material": "你好，我叫小林。我是程序员。我想喝茶。\nNǐ hǎo, wǒ jiào Xiǎolín. Wǒ shì chéngxùyuán. Wǒ xiǎng hē chá.",
    "exercises": "Người nói tên gì, làm nghề gì và muốn uống gì? Trả lời tiếng Việt, rồi nói một câu giới thiệu chính mình.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-zh-beginner-speaking",
    "language": "zh",
    "skill": "speaking",
    "title": "Beginner · Giới thiệu và gọi đồ uống · speaking",
    "level": "Beginner",
    "instructions": "5 phút. Mức sơ cấp nội bộ, không phải chứng nhận HSK/CEFR. Mẫu và câu hỏi do trợ lý soạn. HelloChinese có nội dung miễn phí giới hạn và Premium trả phí; dùng audio người bản ngữ đang mở được, không cần mua gói cho nhiệm vụ này.",
    "material": null,
    "exercises": "Giới thiệu tên và nói đồ uống m muốn bằng hai câu ngắn. Có thể dùng mẫu trong bài đã học; nói lại khi che chữ.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-zh-beginner-writing",
    "language": "zh",
    "skill": "writing",
    "title": "Beginner · Giới thiệu và gọi đồ uống · writing",
    "level": "Beginner",
    "instructions": "5 phút. Mức sơ cấp nội bộ, không phải chứng nhận HSK/CEFR. Mẫu và câu hỏi do trợ lý soạn. HelloChinese có nội dung miễn phí giới hạn và Premium trả phí; dùng audio người bản ngữ đang mở được, không cần mua gói cho nhiệm vụ này.",
    "material": null,
    "exercises": "Viết hai câu giới thiệu tên và đồ uống m muốn. Có thể dùng pinyin nếu chưa biết gõ chữ Hán.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-zh-elementary-listening",
    "language": "zh",
    "skill": "listening",
    "title": "Elementary · Đổi lựa chọn và yêu cầu · listening",
    "level": "Elementary",
    "instructions": "5 phút. Mức sơ cấp nội bộ, không phải chứng nhận HSK/CEFR. Mẫu và câu hỏi do trợ lý soạn. HelloChinese có nội dung miễn phí giới hạn và Premium trả phí; dùng audio người bản ngữ đang mở được, không cần mua gói cho nhiệm vụ này.",
    "material": "https://www.hellochinese.cc/",
    "exercises": "Chọn audio gọi món trong HelloChinese phù hợp bài đã mở được. Nghe không nhìn chữ, ghi lại số lượng và một yêu cầu của người nói. Nếu audio không có các chi tiết đó, ghi rõ và chọn bài ôn quen thuộc.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-zh-elementary-reading",
    "language": "zh",
    "skill": "reading",
    "title": "Elementary · Đổi lựa chọn và yêu cầu · reading",
    "level": "Elementary",
    "instructions": "5 phút. Mức sơ cấp nội bộ, không phải chứng nhận HSK/CEFR. Mẫu và câu hỏi do trợ lý soạn. HelloChinese có nội dung miễn phí giới hạn và Premium trả phí; dùng audio người bản ngữ đang mở được, không cần mua gói cho nhiệm vụ này.",
    "material": "我想要两杯茶，一杯热的，一杯冰的。不要糖。\nWǒ xiǎng yào liǎng bēi chá, yì bēi rè de, yì bēi bīng de. Bú yào táng.",
    "exercises": "Xác định số lượng, lựa chọn nóng/lạnh và yêu cầu về đường. Trả lời ngắn tiếng Việt; không nhìn chữ rồi nhắc lại một ý.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-zh-elementary-speaking",
    "language": "zh",
    "skill": "speaking",
    "title": "Elementary · Đổi lựa chọn và yêu cầu · speaking",
    "level": "Elementary",
    "instructions": "5 phút. Mức sơ cấp nội bộ, không phải chứng nhận HSK/CEFR. Mẫu và câu hỏi do trợ lý soạn. HelloChinese có nội dung miễn phí giới hạn và Premium trả phí; dùng audio người bản ngữ đang mở được, không cần mua gói cho nhiệm vụ này.",
    "material": null,
    "exercises": "Gọi đồ uống cho hai người có lựa chọn khác nhau, rồi thêm một yêu cầu. Dùng từ m đã biết; nói 20–30 giây.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-zh-elementary-writing",
    "language": "zh",
    "skill": "writing",
    "title": "Elementary · Đổi lựa chọn và yêu cầu · writing",
    "level": "Elementary",
    "instructions": "5 phút. Mức sơ cấp nội bộ, không phải chứng nhận HSK/CEFR. Mẫu và câu hỏi do trợ lý soạn. HelloChinese có nội dung miễn phí giới hạn và Premium trả phí; dùng audio người bản ngữ đang mở được, không cần mua gói cho nhiệm vụ này.",
    "material": null,
    "exercises": "Viết đơn gọi đồ uống hai câu với số lượng và một yêu cầu; đổi ít nhất một chi tiết so với đoạn đọc. Pinyin được chấp nhận.",
    "completionCriteria": "Làm trong 5–10 phút; lưu bản đầu, mở key tự kiểm tra và sửa một điểm. Gửi bài hoặc audio về ChatGPT để được review. Cấp độ nhiệm vụ do trợ lý thiết kế, không chứng nhận trình độ."
  },
  {
    "id": "level-ja-starter-listening",
    "language": "ja",
    "skill": "listening",
    "title": "Starter · Chào hỏi và tự giới thiệu · listening",
    "level": "Starter / A1",
    "instructions": "5 phút. Bài do trợ lý soạn theo mục tiêu Can-do Starter của Japan Foundation; không phải đề JLPT. Irodori là nguồn công khai có audio người bản ngữ. Không chép transcript của nguồn vào đây.",
    "material": "https://www.irodori.jpf.go.jp/en/starter/audio/lesson01.html",
    "exercises": "Mở một audio chào hỏi trong Lesson 1. Nghe tối đa hai lượt, chưa nhìn chữ. Ghi lời chào nghe được, thời điểm hoặc tình huống bạn đoán, rồi đánh dấu điều chưa chắc.",
    "completionCriteria": "Nghe một mẫu, lưu điều nghe chắc và chưa chắc, rồi bấm Done. Đây là luyện tập Starter/A1, không chứng nhận JLPT hoặc JF Standard."
  },
  {
    "id": "level-ja-starter-reading",
    "language": "ja",
    "skill": "reading",
    "title": "Starter · Chào hỏi và tự giới thiệu · reading",
    "level": "Starter / A1",
    "instructions": "5 phút. Bài và đoạn đọc ngắn do trợ lý soạn theo mục tiêu Can-do Starter của Japan Foundation; không phải nội dung sao chép từ giáo trình hay đề JLPT.",
    "material": "はじめまして。フィーです。ベトナムから来ました。よろしくお願いします。\nHajimemashite. Fii desu. Betonamu kara kimashita. Yoroshiku onegaishimasu.",
    "exercises": "Xác định tên và quốc gia. Sau đó che romaji, đọc phần kana một lượt; nếu chưa học kana, đánh dấu đọc bằng romaji thay vì tự nhận đã đọc chữ Nhật.",
    "completionCriteria": "Trả lời được hai ý và đọc lại một lượt bằng hệ chữ thực tế đã dùng. Done không tự chứng minh A1/N5."
  },
  {
    "id": "level-ja-starter-speaking",
    "language": "ja",
    "skill": "speaking",
    "title": "Starter · Chào hỏi và tự giới thiệu · speaking",
    "level": "Starter / A1",
    "instructions": "5 phút. Tình huống do trợ lý soạn theo Can-do giao tiếp đầu vào. Dùng audio Irodori để đối chiếu nhịp và âm; văn bản không đủ để chấm phát âm.",
    "material": "https://www.irodori.jpf.go.jp/en/starter/audio/lesson01.html",
    "exercises": "Nói lời chào, tên và quốc gia trong 15–20 giây. Lượt một được nhìn mẫu; lượt hai che chữ và đổi tên thành tên của bạn. Ghi rõ lượt nào không nhìn mẫu.",
    "completionCriteria": "Nói hai lượt, trong đó có một lượt đổi thông tin cá nhân. Muốn sửa phát âm cần gửi audio; Done chỉ ghi nhận luyện tập."
  },
  {
    "id": "level-ja-starter-writing",
    "language": "ja",
    "skill": "writing",
    "title": "Starter · Chào hỏi và tự giới thiệu · writing",
    "level": "Starter / A1",
    "instructions": "5 phút. Bài do trợ lý soạn. Có thể dùng kana kèm romaji khi mới bắt đầu; hãy ghi rõ hệ chữ đã dùng để lần ôn sau so sánh đúng năng lực.",
    "material": null,
    "exercises": "Viết 2–3 câu: lời chào, tên và nơi đến. Sau đó đổi đúng một chi tiết để tạo bản thứ hai. Không dùng AI sửa bản đầu.",
    "completionCriteria": "Có bản đầu và một biến thể đổi thông tin; giữ lại đúng một mẫu câu muốn ôn sau 1–3–7 ngày. Không tự quy đổi sang JLPT."
  }
];
export function getLevelLesson(id: string): LevelLesson | null { return LEVEL_LESSONS.find(l => l.id === id) ?? null; }
