/**
 * Phòng nghe (Listening Lab): bài nghe tiếng Anh có cấu trúc cố định kiểu ESL Lab, học đủ
 * 4 kĩ năng trên một trang: từ vựng → nghe (trắc nghiệm) → đọc (đọc hiểu) → viết (chính tả +
 * viết ngắn) → nói theo. 12 bài hội thoại do dự án tự soạn, đọc bằng giọng máy của trình duyệt;
 * 6 bài VOA Learning English (public domain) phát mp3 thật của VOA, bài đọc là bản tóm tắt
 * viết lại, câu chính tả/nói theo trích nguyên văn. Câu hỏi và lời giải đều do dự án soạn.
 *
 * Kết quả lưu ngay trên máy (localStorage của hồ sơ học đang chọn, không gửi đi đâu); Done/streak
 * ghi qua `recordLocalCompletion` ở trang bài. Điểm ở đây là tự luyện, không chứng nhận CEFR.
 * File này không đụng tới trình duyệt: đọc/ghi localStorage nằm ở `components/listening`.
 */

export type LabLevel = "easy" | "medium" | "hard";

export interface LabChoice {
  /** Câu hỏi tiếng Anh kiểu ESL; lời giải tiếng Việt ngắn. */
  q: string;
  a: [string, string, string, string];
  c: 0 | 1 | 2 | 3;
  why: string;
}

export interface LabLine {
  /** Người nói (bỏ trống với bài đọc một giọng). */
  s?: string;
  t: string;
}

export interface LabVocab {
  w: string;
  pos: string;
  vi: string;
  ex: string;
}

export interface LabLesson {
  id: string;
  level: LabLevel;
  title: string;
  titleVi: string;
  /** Thời lượng ước tính của cả 5 bước, phút. */
  minutes: number;
  intro: string;
  vocab: LabVocab[];
  transcript: LabLine[];
  listening: LabChoice[];
  reading: LabChoice[];
  /** "summary": bài đọc là bản tóm tắt viết lại của audio thật (lời gốc ở `sourceUrl`). */
  textKind?: "dialogue" | "summary";
  /** Câu trích nguyên văn từ audio, dùng cho chính tả và nói theo; mặc định là `transcript`. */
  drill?: LabLine[];
  /** Chỉ số dòng trong `drillLines(bài)` dùng cho chính tả và nói theo. */
  dictation: number[];
  speaking: number[];
  /** Viết tự do: đề tiếng Anh và một bài mẫu để so. */
  write: { prompt: string; model: string };
  audioUrl?: string;
  source?: string;
  sourceUrl?: string;
}

export const LEVELS: { id: LabLevel; name: string; cefr: string; blurb: string }[] = [
  { id: "easy", name: "Dễ", cefr: "A2", blurb: "Hội thoại ngắn hằng ngày, nói chậm, câu đơn; 2 bài VOA Let's Learn English giọng thật." },
  { id: "medium", name: "Vừa", cefr: "B1", blurb: "Hội thoại dài hơn và bản tin ngắn, có chi tiết cần dò; 2 bài VOA (lịch sử, thiên văn)." },
  { id: "hard", name: "Khó", cefr: "B2", blurb: "Chuyện kể, họp nhóm nhiều người nói; 2 bản tin khoa học VOA tốc độ gần tự nhiên." },
];

/* ───────────────────────────── bài học ───────────────────────────── */

const RAW_LESSONS: Omit<LabLesson, "write">[] = [
  {
    id: "e1-coffee-shop",
    level: "easy",
    title: "At the Coffee Shop",
    titleVi: "Gọi đồ ở quán cà phê",
    minutes: 10,
    intro: "Anna gọi đồ uống và đồ ăn sáng ở một quán cà phê.",
    vocab: [
      { w: "medium", pos: "adj", vi: "cỡ vừa", ex: "A medium coffee, please." },
      { w: "to go", pos: "phrase", vi: "mang đi (không ngồi tại quán)", ex: "Is that for here or to go?" },
      { w: "muffin", pos: "n", vi: "bánh muffin", ex: "The blueberry muffins are fresh." },
      { w: "total", pos: "n", vi: "tổng tiền", ex: "Your total is six fifty." },
      { w: "receipt", pos: "n", vi: "hoá đơn", ex: "Would you like a receipt?" },
    ],
    transcript: [
      { s: "Barista", t: "Good morning! What can I get for you?" },
      { s: "Anna", t: "Hi. Can I have a medium coffee with milk, please?" },
      { s: "Barista", t: "Sure. Anything to eat?" },
      { s: "Anna", t: "Do you have any blueberry muffins?" },
      { s: "Barista", t: "We do, and they are still warm." },
      { s: "Anna", t: "Great. One muffin, please." },
      { s: "Barista", t: "Is that for here or to go?" },
      { s: "Anna", t: "To go, please. I'm on my way to work." },
      { s: "Barista", t: "No problem. Your total is six fifty." },
      { s: "Anna", t: "Here you are. Keep the receipt, thanks!" },
    ],
    listening: [
      { q: "What drink does Anna order?", a: ["A large tea", "A medium coffee with milk", "A small black coffee", "Hot chocolate"], c: 1, why: "Cô ấy nói: a medium coffee with milk." },
      { q: "What food does she buy?", a: ["A sandwich", "A bagel", "A blueberry muffin", "Nothing"], c: 2, why: "Muffin việt quất còn ấm." },
      { q: "Where will Anna eat?", a: ["At the shop", "At home", "On the bus", "She takes it to go"], c: 3, why: "'To go' = mang đi; cô đang trên đường đi làm." },
      { q: "How much is the total?", a: ["$6.50", "$6.15", "$7.50", "$5.60"], c: 0, why: "'Six fifty' nghĩa là 6 đô 50 xu." },
    ],
    reading: [
      { q: "Why does Anna take her order to go?", a: ["The shop is full", "She is going to work", "She dislikes the music", "Her friend is waiting"], c: 1, why: "I'm on my way to work." },
      { q: "Which word shows the muffins were made recently?", a: ["medium", "warm", "total", "morning"], c: 1, why: "still warm = mới nướng xong." },
      { q: "\"Here you are\" is used when Anna…", a: ["asks a question", "says goodbye", "hands over the money", "orders again"], c: 2, why: "Nói khi đưa tiền/đồ cho người khác." },
    ],
    dictation: [1, 8],
    speaking: [1, 3, 7],
  },
  {
    id: "e2-directions",
    level: "easy",
    title: "Finding the Bookstore",
    titleVi: "Hỏi đường tới hiệu sách",
    minutes: 10,
    intro: "Minh hỏi đường một người qua đường để tìm hiệu sách cũ.",
    vocab: [
      { w: "excuse me", pos: "phrase", vi: "xin lỗi (mở lời hỏi)", ex: "Excuse me, is there a bank near here?" },
      { w: "straight", pos: "adv", vi: "thẳng", ex: "Go straight for two blocks." },
      { w: "block", pos: "n", vi: "dãy nhà, khu phố", ex: "The store is three blocks away." },
      { w: "turn left", pos: "phrase", vi: "rẽ trái", ex: "Turn left at the traffic light." },
      { w: "next to", pos: "prep", vi: "bên cạnh", ex: "It's next to the pharmacy." },
      { w: "miss", pos: "v", vi: "bỏ lỡ, đi quá", ex: "You can't miss it." },
    ],
    transcript: [
      { s: "Minh", t: "Excuse me, do you know the old bookstore on River Street?" },
      { s: "Woman", t: "Yes, it's not far. Go straight for two blocks." },
      { s: "Minh", t: "Straight for two blocks, okay." },
      { s: "Woman", t: "Then turn left at the traffic light." },
      { s: "Minh", t: "Left at the light. And then?" },
      { s: "Woman", t: "The bookstore is on your right, next to a small pharmacy." },
      { s: "Minh", t: "Is it a green building?" },
      { s: "Woman", t: "That's the one. There's a big clock above the door. You can't miss it." },
      { s: "Minh", t: "Thank you so much for your help!" },
      { s: "Woman", t: "You're welcome. Enjoy your books!" },
    ],
    listening: [
      { q: "What is Minh looking for?", a: ["A pharmacy", "An old bookstore", "A clock shop", "A bank"], c: 1, why: "Hiệu sách cũ trên River Street." },
      { q: "How far does he walk straight?", a: ["One block", "Two blocks", "Three blocks", "Four blocks"], c: 1, why: "Go straight for two blocks." },
      { q: "Where does he turn left?", a: ["At the pharmacy", "At the bridge", "At the traffic light", "At the clock"], c: 2, why: "Turn left at the traffic light." },
      { q: "What is above the bookstore's door?", a: ["A flag", "A big clock", "A green sign", "A lamp"], c: 1, why: "There's a big clock above the door." },
    ],
    reading: [
      { q: "The bookstore is next to…", a: ["a bank", "a school", "a small pharmacy", "a cafe"], c: 2, why: "next to a small pharmacy." },
      { q: "\"You can't miss it\" means…", a: ["it is closed", "it is easy to find", "you must hurry", "it is far away"], c: 1, why: "Dễ thấy tới mức không thể đi quá." },
      { q: "Which side is the bookstore on after the turn?", a: ["The left", "The right", "Behind Minh", "Across the river"], c: 1, why: "on your right." },
    ],
    dictation: [1, 3],
    speaking: [0, 3, 8],
  },
  {
    id: "e3-doctor-appointment",
    level: "easy",
    title: "Making a Doctor's Appointment",
    titleVi: "Đặt lịch khám qua điện thoại",
    minutes: 10,
    intro: "Ben gọi điện cho phòng khám để đặt lịch vì bị đau họng.",
    vocab: [
      { w: "appointment", pos: "n", vi: "lịch hẹn", ex: "I'd like to make an appointment." },
      { w: "sore throat", pos: "n", vi: "đau họng", ex: "I've had a sore throat since Monday." },
      { w: "available", pos: "adj", vi: "còn trống, rảnh", ex: "Doctor Lee is available at ten." },
      { w: "insurance", pos: "n", vi: "bảo hiểm", ex: "Please bring your insurance card." },
      { w: "confirm", pos: "v", vi: "xác nhận", ex: "I'm calling to confirm your visit." },
    ],
    transcript: [
      { s: "Receptionist", t: "Green Clinic, good afternoon. How can I help you?" },
      { s: "Ben", t: "Hello. I'd like to make an appointment with Doctor Lee." },
      { s: "Receptionist", t: "Of course. What seems to be the problem?" },
      { s: "Ben", t: "I've had a sore throat since Monday, and it's getting worse." },
      { s: "Receptionist", t: "I'm sorry to hear that. Doctor Lee is available tomorrow at ten in the morning." },
      { s: "Ben", t: "Tomorrow at ten works for me." },
      { s: "Receptionist", t: "May I have your name and date of birth?" },
      { s: "Ben", t: "Ben Carter, March twelfth, nineteen ninety-eight." },
      { s: "Receptionist", t: "Thank you. Please arrive ten minutes early and bring your insurance card." },
      { s: "Ben", t: "I will. Thanks a lot. See you tomorrow." },
    ],
    listening: [
      { q: "Why does Ben call the clinic?", a: ["To cancel a visit", "To ask for test results", "To make an appointment", "To change his doctor"], c: 2, why: "I'd like to make an appointment." },
      { q: "What is Ben's problem?", a: ["A headache", "A sore throat", "A broken arm", "A fever"], c: 1, why: "Đau họng từ thứ Hai, đang nặng hơn." },
      { q: "When is the appointment?", a: ["Today at ten", "Tomorrow at ten in the morning", "Monday at nine", "Tomorrow afternoon"], c: 1, why: "tomorrow at ten in the morning." },
      { q: "What must Ben bring?", a: ["His passport", "His insurance card", "His medicine", "A friend"], c: 1, why: "bring your insurance card." },
    ],
    reading: [
      { q: "How early should Ben arrive?", a: ["Five minutes", "Ten minutes", "Thirty minutes", "He can be late"], c: 1, why: "arrive ten minutes early." },
      { q: "\"It's getting worse\" tells us the throat…", a: ["is better now", "stays the same", "hurts more than before", "stopped hurting"], c: 2, why: "Càng ngày càng đau hơn." },
      { q: "What two things does the receptionist ask for?", a: ["Name and address", "Name and date of birth", "Phone and email", "Insurance and payment"], c: 1, why: "your name and date of birth." },
    ],
    dictation: [1, 3],
    speaking: [1, 3, 5],
  },
  {
    id: "e4-weekend-plans",
    level: "easy",
    title: "Weekend Plans",
    titleVi: "Kế hoạch cuối tuần",
    minutes: 10,
    intro: "Lisa và Tom bàn xem cuối tuần làm gì nếu trời mưa.",
    vocab: [
      { w: "forecast", pos: "n", vi: "dự báo thời tiết", ex: "The forecast says rain on Saturday." },
      { w: "instead", pos: "adv", vi: "thay vào đó", ex: "Let's watch a movie instead." },
      { w: "hiking", pos: "n", vi: "đi bộ đường dài", ex: "We love hiking in the hills." },
      { w: "museum", pos: "n", vi: "bảo tàng", ex: "The science museum is free on Sundays." },
      { w: "pick up", pos: "phr v", vi: "đón (ai đó)", ex: "I'll pick you up at nine." },
    ],
    transcript: [
      { s: "Lisa", t: "Tom, are we still going hiking this Saturday?" },
      { s: "Tom", t: "I'm not sure. The forecast says rain all morning." },
      { s: "Lisa", t: "Oh no. I really wanted to be outside." },
      { s: "Tom", t: "Me too. How about the science museum instead?" },
      { s: "Lisa", t: "That could be fun. Is it expensive?" },
      { s: "Tom", t: "Tickets are ten dollars, but students pay five." },
      { s: "Lisa", t: "Perfect, I still have my student card." },
      { s: "Tom", t: "Then it's a plan. I'll pick you up at nine thirty." },
      { s: "Lisa", t: "Great. If the sun comes out, we can hike on Sunday." },
      { s: "Tom", t: "Deal. Let's hope for good weather." },
    ],
    listening: [
      { q: "What was the original plan?", a: ["Going hiking", "Visiting a museum", "Watching a movie", "Staying home"], c: 0, why: "are we still going hiking this Saturday?" },
      { q: "Why might they change the plan?", a: ["Tom is busy", "Rain is forecast", "The museum closes", "Lisa is sick"], c: 1, why: "The forecast says rain all morning." },
      { q: "How much will Lisa pay at the museum?", a: ["Ten dollars", "Five dollars", "Nothing", "Nine thirty"], c: 1, why: "Students pay five, Lisa có thẻ sinh viên." },
      { q: "What time will Tom pick Lisa up?", a: ["At nine", "At nine thirty", "At ten", "On Sunday"], c: 1, why: "I'll pick you up at nine thirty." },
    ],
    reading: [
      { q: "When could they still go hiking?", a: ["Saturday morning", "Saturday night", "Sunday, if it's sunny", "Next month"], c: 2, why: "If the sun comes out, we can hike on Sunday." },
      { q: "\"Then it's a plan\" means…", a: ["they agree", "they cancel", "they are lost", "they disagree"], c: 0, why: "Chốt kế hoạch, đồng ý với nhau." },
      { q: "Why does Lisa pay less?", a: ["She is a child", "She has a student card", "It is free day", "Tom pays for her"], c: 1, why: "I still have my student card." },
    ],
    dictation: [1, 7],
    speaking: [0, 3, 9],
  },
  {
    id: "m1-job-interview",
    level: "medium",
    title: "The Job Interview",
    titleVi: "Phỏng vấn xin việc",
    minutes: 12,
    intro: "Sara phỏng vấn vị trí nhân viên chăm sóc khách hàng ở một công ty du lịch.",
    vocab: [
      { w: "position", pos: "n", vi: "vị trí, chức vụ", ex: "She applied for a customer service position." },
      { w: "experience", pos: "n", vi: "kinh nghiệm", ex: "Two years of experience in sales." },
      { w: "handle", pos: "v", vi: "xử lý", ex: "How do you handle angry customers?" },
      { w: "strength", pos: "n", vi: "điểm mạnh", ex: "Patience is my biggest strength." },
      { w: "shift", pos: "n", vi: "ca làm việc", ex: "Weekend shifts pay more." },
      { w: "notice", pos: "n", vi: "thông báo trước (khi nghỉ việc)", ex: "I must give two weeks' notice." },
    ],
    transcript: [
      { s: "Manager", t: "Thanks for coming in, Sara. Tell me a little about yourself." },
      { s: "Sara", t: "I've worked in customer service for three years, mostly at a hotel front desk." },
      { s: "Manager", t: "Why do you want to leave the hotel?" },
      { s: "Sara", t: "I enjoy helping people, but I'd like to grow, and your company offers real training." },
      { s: "Manager", t: "How do you handle an angry customer?" },
      { s: "Sara", t: "First I listen without interrupting, then I apologize and offer a clear solution." },
      { s: "Manager", t: "Good answer. This position includes some weekend shifts. Is that a problem?" },
      { s: "Sara", t: "Not at all. I worked most weekends at the hotel." },
      { s: "Manager", t: "And when could you start?" },
      { s: "Sara", t: "I need to give two weeks' notice, so the first of next month." },
      { s: "Manager", t: "Perfect. We'll call you by Friday with our decision." },
      { s: "Sara", t: "Thank you. I look forward to hearing from you." },
    ],
    listening: [
      { q: "How long has Sara worked in customer service?", a: ["Two years", "Three years", "Five years", "Six months"], c: 1, why: "for three years, mostly at a hotel." },
      { q: "Why does she want to change jobs?", a: ["The pay is low", "She wants to grow and get training", "The hotel is closing", "She dislikes customers"], c: 1, why: "I'd like to grow… real training." },
      { q: "What does she do FIRST with an angry customer?", a: ["Apologize", "Offer a refund", "Listen without interrupting", "Call the manager"], c: 2, why: "First I listen without interrupting." },
      { q: "When can Sara start?", a: ["Tomorrow", "By Friday", "The first of next month", "In two days"], c: 2, why: "Phải báo trước hai tuần → đầu tháng sau." },
    ],
    reading: [
      { q: "What will happen by Friday?", a: ["Sara starts work", "The company calls with a decision", "Sara quits the hotel", "A second interview"], c: 1, why: "We'll call you by Friday with our decision." },
      { q: "\"Two weeks' notice\" means Sara must…", a: ["work two more weeks after telling her boss", "take two weeks off", "wait two weeks for pay", "train for two weeks"], c: 0, why: "Báo nghỉ trước hai tuần và làm nốt thời gian đó." },
      { q: "Which sentence shows weekend work is fine for her?", a: ["I enjoy helping people", "Not at all. I worked most weekends", "I listen without interrupting", "Thanks for coming in"], c: 1, why: "Cô từng làm hầu hết cuối tuần ở khách sạn." },
    ],
    dictation: [5, 9],
    speaking: [1, 5, 11],
  },
  {
    id: "m2-renting-apartment",
    level: "medium",
    title: "Renting an Apartment",
    titleVi: "Đi thuê căn hộ",
    minutes: 12,
    intro: "Nam xem một căn hộ một phòng ngủ và hỏi chủ nhà về giá và điều kiện.",
    vocab: [
      { w: "landlord", pos: "n", vi: "chủ nhà cho thuê", ex: "The landlord lives on the first floor." },
      { w: "deposit", pos: "n", vi: "tiền đặt cọc", ex: "The deposit is one month's rent." },
      { w: "utilities", pos: "n", vi: "điện nước (chi phí tiện ích)", ex: "Rent includes utilities." },
      { w: "lease", pos: "n", vi: "hợp đồng thuê", ex: "It's a one-year lease." },
      { w: "furnished", pos: "adj", vi: "có sẵn nội thất", ex: "The room comes furnished." },
      { w: "laundry", pos: "n", vi: "giặt giũ, phòng giặt", ex: "There's a laundry room downstairs." },
    ],
    transcript: [
      { s: "Nam", t: "The living room is brighter than I expected. How much is the rent?" },
      { s: "Landlord", t: "Nine hundred a month, and that includes water and electricity." },
      { s: "Nam", t: "So utilities are included. What about the internet?" },
      { s: "Landlord", t: "Internet is separate, about forty dollars a month." },
      { s: "Nam", t: "Is the apartment furnished?" },
      { s: "Landlord", t: "Partly. You get a bed, a desk, and the kitchen table, but no sofa." },
      { s: "Nam", t: "That's enough for me. How long is the lease?" },
      { s: "Landlord", t: "One year, with a deposit of one month's rent." },
      { s: "Nam", t: "Is there anywhere to wash clothes?" },
      { s: "Landlord", t: "There's a shared laundry room downstairs, open until ten at night." },
      { s: "Nam", t: "Great. Can I think about it and call you tomorrow morning?" },
      { s: "Landlord", t: "Of course, but another couple is seeing it this afternoon, so don't wait too long." },
    ],
    listening: [
      { q: "How much is the rent?", a: ["$940", "$900 including utilities", "$900 plus utilities", "$400"], c: 1, why: "Nine hundred… includes water and electricity." },
      { q: "What costs extra?", a: ["Water", "Electricity", "Internet", "The desk"], c: 2, why: "Internet is separate, about forty dollars." },
      { q: "Which furniture is NOT included?", a: ["A bed", "A desk", "A kitchen table", "A sofa"], c: 3, why: "…but no sofa." },
      { q: "How big is the deposit?", a: ["Two months' rent", "One month's rent", "Forty dollars", "No deposit"], c: 1, why: "a deposit of one month's rent." },
    ],
    reading: [
      { q: "Until when is the laundry room open?", a: ["Nine at night", "Ten at night", "Midnight", "All day"], c: 1, why: "open until ten at night." },
      { q: "Why should Nam decide quickly?", a: ["The rent rises tomorrow", "Another couple is viewing it today", "The lease ends soon", "The landlord is leaving"], c: 1, why: "another couple is seeing it this afternoon." },
      { q: "\"Partly furnished\" here means…", a: ["everything is new", "some furniture is included", "no furniture at all", "furniture costs extra"], c: 1, why: "Có giường, bàn làm việc, bàn bếp — nhưng thiếu sofa." },
    ],
    dictation: [1, 7],
    speaking: [0, 6, 10],
  },
  {
    id: "m3-why-sleep-matters",
    level: "medium",
    title: "Why Sleep Matters",
    titleVi: "Vì sao giấc ngủ quan trọng",
    minutes: 12,
    intro: "Một bản tin ngắn về giấc ngủ và ba thói quen giúp ngủ ngon hơn.",
    vocab: [
      { w: "adult", pos: "n", vi: "người trưởng thành", ex: "Most adults need seven hours of sleep." },
      { w: "memory", pos: "n", vi: "trí nhớ", ex: "Sleep helps the brain store memory." },
      { w: "screen", pos: "n", vi: "màn hình", ex: "Turn off screens before bed." },
      { w: "caffeine", pos: "n", vi: "chất cà phê in", ex: "Avoid caffeine after lunch." },
      { w: "routine", pos: "n", vi: "nếp sinh hoạt đều đặn", ex: "A simple routine tells your body it's time to rest." },
    ],
    transcript: [
      { t: "How much did you sleep last night? Doctors say most adults need at least seven hours, but many of us get much less." },
      { t: "Sleep is not wasted time. While you rest, your brain cleans itself and stores new memory from the day." },
      { t: "People who sleep well learn faster, drive more safely, and get sick less often." },
      { t: "So how can you sleep better? Researchers suggest three simple habits." },
      { t: "First, go to bed and wake up at the same time every day, even on weekends." },
      { t: "Second, avoid caffeine after lunch, because it can stay in your body for eight hours." },
      { t: "Third, turn off bright screens at least thirty minutes before bed and read or stretch instead." },
      { t: "A quiet routine every night tells your body that it is time to rest." },
      { t: "Tonight, try just one of these habits. Your brain will thank you in the morning." },
    ],
    listening: [
      { q: "How much sleep do most adults need?", a: ["At least five hours", "At least six hours", "At least seven hours", "Ten hours"], c: 2, why: "at least seven hours." },
      { q: "What does the brain do during sleep?", a: ["It stops working", "It cleans itself and stores memory", "It grows larger", "It burns fat"], c: 1, why: "cleans itself and stores new memory." },
      { q: "How many habits does the report suggest?", a: ["One", "Two", "Three", "Four"], c: 2, why: "three simple habits." },
      { q: "How long can caffeine stay in the body?", a: ["Thirty minutes", "Two hours", "Eight hours", "One day"], c: 2, why: "it can stay in your body for eight hours." },
    ],
    reading: [
      { q: "What should you do 30 minutes before bed?", a: ["Drink coffee", "Turn off bright screens", "Do hard exercise", "Eat dinner"], c: 1, why: "turn off bright screens… read or stretch instead." },
      { q: "Which is a benefit of good sleep in the report?", a: ["Taller body", "Safer driving", "Better eyesight", "More money"], c: 1, why: "drive more safely." },
      { q: "The report asks you to start with…", a: ["all three habits", "just one habit", "a new bed", "less sleep"], c: 1, why: "try just one of these habits." },
    ],
    dictation: [4, 7],
    speaking: [2, 4, 8],
  },
  {
    id: "m4-changing-flight",
    level: "medium",
    title: "Changing a Flight",
    titleVi: "Đổi chuyến bay qua điện thoại",
    minutes: 12,
    intro: "Hoa gọi hãng bay để đổi chuyến vì cuộc họp bị dời ngày.",
    vocab: [
      { w: "book", pos: "v", vi: "đặt (vé, phòng)", ex: "I booked a flight to Chicago." },
      { w: "fee", pos: "n", vi: "phí", ex: "There is a change fee of fifty dollars." },
      { w: "difference", pos: "n", vi: "phần chênh lệch", ex: "You pay the difference in price." },
      { w: "aisle seat", pos: "n", vi: "ghế gần lối đi", ex: "An aisle seat, please." },
      { w: "confirmation", pos: "n", vi: "xác nhận (mã đặt chỗ)", ex: "I'll email your new confirmation." },
    ],
    transcript: [
      { s: "Agent", t: "Blue Air customer service, this is Mark. How can I help?" },
      { s: "Hoa", t: "Hi Mark. I booked a flight to Chicago on Thursday, but my meeting moved to Monday." },
      { s: "Agent", t: "Let me check. Yes, I see your booking. You'd like to fly on Sunday instead?" },
      { s: "Hoa", t: "Yes, Sunday afternoon if possible." },
      { s: "Agent", t: "There's a flight at two fifteen and another at six forty." },
      { s: "Hoa", t: "The two fifteen, please. What will it cost to change?" },
      { s: "Agent", t: "The change fee is fifty dollars, and the new ticket is thirty dollars more, so eighty in total." },
      { s: "Hoa", t: "That's fine. Can I also ask for an aisle seat?" },
      { s: "Agent", t: "Done. Seat fourteen C, on the aisle." },
      { s: "Hoa", t: "Perfect, thank you." },
      { s: "Agent", t: "You're all set. I'll email your new confirmation in a few minutes." },
    ],
    listening: [
      { q: "Why does Hoa change her flight?", a: ["She is sick", "Her meeting moved to Monday", "The flight was cancelled", "Tickets got cheaper"], c: 1, why: "my meeting moved to Monday." },
      { q: "Which flight does she choose?", a: ["Thursday morning", "Sunday at 2:15", "Sunday at 6:40", "Monday at 2:15"], c: 1, why: "The two fifteen, please." },
      { q: "How much does she pay in total to change?", a: ["$50", "$30", "$80", "$15"], c: 2, why: "50 phí đổi + 30 chênh giá = 80." },
      { q: "What seat does she get?", a: ["14C on the aisle", "14A by the window", "40C at the back", "No seat yet"], c: 0, why: "Seat fourteen C, on the aisle." },
    ],
    reading: [
      { q: "What will the agent send by email?", a: ["A refund", "The new confirmation", "A meal voucher", "A boarding pass"], c: 1, why: "I'll email your new confirmation." },
      { q: "The $30 in the total is…", a: ["a seat fee", "the price difference of the new ticket", "a tax", "a tip"], c: 1, why: "the new ticket is thirty dollars more." },
      { q: "\"You're all set\" means…", a: ["everything is done", "the seat is broken", "the flight is full", "please wait"], c: 0, why: "Mọi thứ đã xong xuôi." },
    ],
    dictation: [1, 6],
    speaking: [1, 5, 7],
  },
  {
    id: "h1-lost-wallet",
    level: "hard",
    title: "The Lost Wallet",
    titleVi: "Chiếc ví bỏ quên",
    minutes: 15,
    intro: "Một câu chuyện ngắn: David mất ví trên tàu và nhận lại nó theo cách bất ngờ.",
    vocab: [
      { w: "platform", pos: "n", vi: "sân ga", ex: "He ran back to the platform." },
      { w: "realize", pos: "v", vi: "nhận ra", ex: "He realized his wallet was gone." },
      { w: "stranger", pos: "n", vi: "người lạ", ex: "A stranger had left a note." },
      { w: "relieved", pos: "adj", vi: "nhẹ nhõm", ex: "He felt relieved and grateful." },
      { w: "honesty", pos: "n", vi: "sự trung thực", ex: "Her honesty surprised him." },
      { w: "reward", pos: "n", vi: "phần thưởng, tiền cảm ơn", ex: "She refused any reward." },
    ],
    transcript: [
      { t: "David only realized his wallet was gone when he reached the ticket gate." },
      { t: "He searched every pocket twice, then ran back to the platform, but the train had already left." },
      { t: "Inside the wallet were his cards, eighty dollars, and a photo of his grandmother that could not be replaced." },
      { t: "At the lost and found office, a tired officer took his name and told him not to hope for much." },
      { t: "Three days later, an envelope arrived at his apartment with no return address." },
      { t: "Inside was his wallet, the money untouched, and a short note written in careful handwriting." },
      { t: "It said: I found this on seat twelve. Your library card showed your address. Please check on your grandmother; the photo looks old." },
      { t: "David laughed out loud, relieved and a little ashamed, because he had not visited her in months." },
      { t: "He never learned the stranger's name, and the note was not signed." },
      { t: "That weekend he took the early train to his grandmother's town, with the photo back in its place and a cake on his lap." },
      { t: "Later he told friends that losing the wallet cost him nothing, but returned something he had almost forgotten." },
    ],
    listening: [
      { q: "Where did David notice the wallet was missing?", a: ["On the train", "At the ticket gate", "At home", "At work"], c: 1, why: "when he reached the ticket gate." },
      { q: "What could NOT be replaced?", a: ["His cards", "The eighty dollars", "The photo of his grandmother", "The wallet itself"], c: 2, why: "a photo… that could not be replaced." },
      { q: "How did the wallet come back?", a: ["The police found it", "A friend returned it", "An envelope arrived with no return address", "He found it on the platform"], c: 2, why: "an envelope… no return address." },
      { q: "What did the stranger ask David to do?", a: ["Send a reward", "Check on his grandmother", "Buy a new wallet", "Call the office"], c: 1, why: "Please check on your grandmother." },
    ],
    reading: [
      { q: "Why did David feel \"a little ashamed\"?", a: ["He lost money", "He had not visited his grandmother for months", "He cried at the office", "He missed his train"], c: 1, why: "he had not visited her in months." },
      { q: "How did the stranger learn David's address?", a: ["From his ID card", "From his library card", "From the police", "From a neighbor"], c: 1, why: "Your library card showed your address." },
      { q: "The last sentence means the lost wallet…", a: ["cost him a lot", "reminded him of something important", "was never found", "made him rich"], c: 1, why: "'Trả lại thứ anh gần như đã quên' — tình thân." },
    ],
    dictation: [0, 4],
    speaking: [0, 7, 10],
  },
  {
    id: "h2-coffee-health",
    level: "hard",
    title: "Coffee and Your Health",
    titleVi: "Cà phê và sức khoẻ",
    minutes: 15,
    intro: "Bản tin khoa học: nghiên cứu mới về lợi và hại của cà phê.",
    vocab: [
      { w: "researcher", pos: "n", vi: "nhà nghiên cứu", ex: "Researchers followed ten thousand adults." },
      { w: "moderate", pos: "adj", vi: "vừa phải", ex: "Moderate drinkers had fewer heart problems." },
      { w: "risk", pos: "n", vi: "nguy cơ", ex: "Smoking raises the risk of disease." },
      { w: "anxious", pos: "adj", vi: "bồn chồn, lo âu", ex: "Too much caffeine can make you anxious." },
      { w: "on average", pos: "phrase", vi: "tính trung bình", ex: "On average, they slept seven hours." },
      { w: "conclusion", pos: "n", vi: "kết luận", ex: "The study's conclusion was careful." },
    ],
    transcript: [
      { t: "Is your morning coffee helping you or hurting you? A large new study offers a careful answer: it depends on how much you drink." },
      { t: "Researchers at a university hospital followed ten thousand adults for twelve years, recording their coffee habits and their health." },
      { t: "People who drank two to three cups a day had, on average, a fifteen percent lower risk of heart disease than people who drank none." },
      { t: "They also reported better focus at work, especially in the first hours of the morning." },
      { t: "But the curve turns after that. Above five cups a day, the benefits disappeared." },
      { t: "Heavy drinkers slept almost an hour less and were twice as likely to feel anxious in the afternoon." },
      { t: "The researchers also warn that sugar changes the picture: drinks loaded with syrup erased most of the measured benefits." },
      { t: "Their conclusion is modest: coffee in moderate amounts fits a healthy life, but it is not a medicine." },
      { t: "If you enjoy it, keep it to a few cups, keep it mostly black, and keep it out of your evenings." },
    ],
    listening: [
      { q: "How long did the study follow people?", a: ["Two years", "Ten years", "Twelve years", "Fifteen years"], c: 2, why: "followed ten thousand adults for twelve years." },
      { q: "Which group had a 15% lower risk of heart disease?", a: ["People who drank none", "Two to three cups a day", "Five or more cups", "Tea drinkers"], c: 1, why: "two to three cups a day." },
      { q: "What happened above five cups a day?", a: ["Benefits grew", "Benefits disappeared", "Risk fell further", "Nothing changed"], c: 1, why: "the benefits disappeared." },
      { q: "Heavy drinkers were twice as likely to…", a: ["sleep more", "feel anxious in the afternoon", "exercise", "drink tea"], c: 1, why: "twice as likely to feel anxious." },
    ],
    reading: [
      { q: "What erased most of the benefits?", a: ["Milk", "Drinks loaded with syrup", "Decaf", "Cold coffee"], c: 1, why: "sugar… syrup erased most benefits." },
      { q: "\"The curve turns\" here means…", a: ["the road bends", "the effect reverses after a point", "the study ended", "prices rose"], c: 1, why: "Qua một ngưỡng thì lợi thành hại." },
      { q: "The final advice is to drink coffee…", a: ["only at night", "as medicine", "a few cups, mostly black, not in the evening", "with syrup"], c: 2, why: "keep it to a few cups, mostly black, out of your evenings." },
    ],
    dictation: [2, 7],
    speaking: [0, 4, 8],
  },
  {
    id: "h3-team-meeting",
    level: "hard",
    title: "The Team Meeting",
    titleVi: "Cuộc họp nhóm: chọn phương án",
    minutes: 15,
    intro: "Ba đồng nghiệp tranh luận nên sửa ứng dụng cũ hay xây bản mới.",
    vocab: [
      { w: "budget", pos: "n", vi: "ngân sách", ex: "The budget is tight this quarter." },
      { w: "complaint", pos: "n", vi: "lời phàn nàn", ex: "We get complaints about the slow app." },
      { w: "from scratch", pos: "phrase", vi: "làm lại từ đầu", ex: "Rebuilding from scratch takes months." },
      { w: "compromise", pos: "n", vi: "phương án dung hoà", ex: "They agreed on a compromise." },
      { w: "deadline", pos: "n", vi: "hạn chót", ex: "The deadline is the end of March." },
      { w: "measure", pos: "v", vi: "đo lường", ex: "We will measure the results in April." },
    ],
    transcript: [
      { s: "Chair", t: "We have thirty minutes to decide what to do about the mobile app. Quan, you first." },
      { s: "Quan", t: "Half of our customer complaints are about speed. I say we rebuild it from scratch with modern tools." },
      { s: "Mai", t: "A full rebuild would take six months and most of our budget. Who answers the complaints while we wait?" },
      { s: "Quan", t: "Patching the old code is just buying time. We'll pay twice in the end." },
      { s: "Mai", t: "Maybe, but a faster login and smaller images could cut loading time in half within three weeks." },
      { s: "Chair", t: "Is that number real or hopeful?" },
      { s: "Mai", t: "It's from last month's test on two hundred users, so real enough to try." },
      { s: "Quan", t: "Fine, but only if we also plan the rebuild now, not after the patch fails." },
      { s: "Chair", t: "Then here's the compromise: Mai ships the quick fixes by the end of March, and Quan writes the rebuild plan with real costs." },
      { s: "Mai", t: "Agreed, as long as we measure the results in April before spending more." },
      { s: "Chair", t: "Agreed. Same room, first Monday of April. Bring numbers, not opinions." },
    ],
    listening: [
      { q: "What is the meeting about?", a: ["Hiring a designer", "What to do about the mobile app", "Moving offices", "A new logo"], c: 1, why: "decide what to do about the mobile app." },
      { q: "What does Quan want?", a: ["To patch the old code", "To rebuild the app from scratch", "To close the app", "To hire more staff"], c: 1, why: "rebuild it from scratch with modern tools." },
      { q: "Why does Mai object to a full rebuild?", a: ["It is boring", "It takes six months and most of the budget", "Quan is new", "Users like the old app"], c: 1, why: "six months and most of our budget." },
      { q: "Where does Mai's \"three weeks\" number come from?", a: ["A guess", "Last month's test on two hundred users", "A customer email", "The chair"], c: 1, why: "from last month's test on two hundred users." },
    ],
    reading: [
      { q: "What is the final compromise?", a: ["Do nothing until April", "Quick fixes by end of March, plus a rebuild plan with costs", "Rebuild now", "Outsource the app"], c: 1, why: "Mai ships quick fixes, Quan writes the rebuild plan." },
      { q: "Mai agrees on one condition: that they…", a: ["hire more people", "measure the results in April before spending more", "cancel the deadline", "skip the test"], c: 1, why: "measure the results in April." },
      { q: "\"Bring numbers, not opinions\" asks people to come with…", a: ["evidence and data", "more colleagues", "coffee", "louder voices"], c: 0, why: "Dựa trên số liệu đo được, không cảm tính." },
    ],
    dictation: [4, 8],
    speaking: [1, 4, 10],
  },
  {
    id: "h4-working-anywhere",
    level: "hard",
    title: "Working from Anywhere",
    titleVi: "Làm việc từ xa",
    minutes: 15,
    intro: "Một đoạn podcast về mặt sáng và mặt tối của làm việc từ xa.",
    vocab: [
      { w: "commute", pos: "n", vi: "quãng đường đi làm", ex: "Her commute took ninety minutes a day." },
      { w: "productive", pos: "adj", vi: "làm việc hiệu quả", ex: "Quiet mornings make me productive." },
      { w: "isolated", pos: "adj", vi: "bị cô lập, cô đơn", ex: "New workers can feel isolated at home." },
      { w: "boundary", pos: "n", vi: "ranh giới", ex: "Set a boundary between work and rest." },
      { w: "in person", pos: "phrase", vi: "gặp trực tiếp", ex: "Hard talks are better in person." },
    ],
    transcript: [
      { t: "Five years ago, my office was a forty-minute train ride away. Today it is the table next to my kitchen." },
      { t: "Remote work gave me back my commute: almost four hundred hours a year, enough to learn a language or watch a child grow up." },
      { t: "On quiet mornings I finish deep work before my old self would have reached the office." },
      { t: "But the same walls that protect your focus can slowly close in on you." },
      { t: "A survey last year found that one remote worker in three felt isolated, and new employees felt it most." },
      { t: "Small questions that once took a minute at a desk now wait hours in a chat window." },
      { t: "And without a train to catch, many people simply never stop working; the laptop glows on the kitchen table all evening." },
      { t: "The teams that do this well treat remote work as a skill, not a location." },
      { t: "They write things down, they meet in person a few times a year, and they agree on hours when everyone is reachable." },
      { t: "Above all, they respect the boundary: when the working day ends, the laptop closes, and the kitchen becomes a kitchen again." },
    ],
    listening: [
      { q: "How long was the speaker's old commute?", a: ["Forty minutes by train", "Four hours", "Ninety minutes by bus", "Ten minutes"], c: 0, why: "a forty-minute train ride." },
      { q: "How many remote workers felt isolated in the survey?", a: ["One in ten", "One in three", "Half", "Almost all"], c: 1, why: "one remote worker in three felt isolated." },
      { q: "Who felt isolation most?", a: ["Managers", "New employees", "Parents", "Designers"], c: 1, why: "new employees felt it most." },
      { q: "What happens to small questions in remote teams?", a: ["They are answered faster", "They wait hours in a chat window", "They are forgotten", "They go to managers"], c: 1, why: "now wait hours in a chat window." },
    ],
    reading: [
      { q: "\"Remote work gave me back my commute\" means the speaker…", a: ["lost his job", "saved the travel time for himself", "moved closer to the office", "bought a car"], c: 1, why: "~400 giờ một năm dùng cho việc khác." },
      { q: "Good remote teams treat remote work as…", a: ["a holiday", "a skill, not a location", "a punishment", "a trend"], c: 1, why: "as a skill, not a location." },
      { q: "Which is one habit of teams that do it well?", a: ["They never meet", "They write things down", "They work all evening", "They ban chat"], c: 1, why: "write things down, meet in person, agree on reachable hours." },
    ],
    dictation: [0, 7],
    speaking: [2, 7, 9],
  },
  /* ── Bài VOA Learning English: audio thật (public domain), bài đọc là bản tóm tắt viết lại,
        câu chính tả/nói theo trích nguyên văn (`drill`). ── */
  {
    id: "e5-voa-hello-anna",
    level: "easy",
    title: "Hello! I'm Anna",
    titleVi: "Chào hàng xóm mới",
    minutes: 10,
    intro: "VOA Let's Learn English, bài 2: Anna mới đến Washington, D.C. và gặp hàng xóm ở toà chung cư.",
    vocab: [
      { w: "new", pos: "adj", vi: "mới (vừa đến)", ex: "She is new to the city." },
      { w: "small town", pos: "n", vi: "thị trấn nhỏ", ex: "I am from a small town." },
      { w: "apartment", pos: "n", vi: "căn hộ", ex: "I live in apartment C2." },
      { w: "roommate", pos: "n", vi: "bạn ở cùng phòng/căn hộ", ex: "Marsha is my roommate." },
      { w: "welcome", pos: "v", vi: "chào đón", ex: "Welcome to our building!" },
    ],
    textKind: "summary",
    transcript: [
      { t: "Anna is new to Washington, D.C." },
      { t: "Her friend Pete introduces her to Jonathan, a neighbor in their apartment building." },
      { t: "Jonathan asks Anna where she is from. She is from a small town." },
      { t: "Jonathan lives in apartment B4." },
      { t: "Anna lives in apartment C2 with her roommate, Marsha." },
      { t: "Jonathan knows Marsha. He says she is nice." },
      { t: "Pete lives in apartment D7. He has to go." },
      { t: "Before he leaves, Pete tells Anna to call Marsha at work." },
      { t: "Anna thanks Pete and goes to her apartment." },
    ],
    drill: [
      { s: "Jonathan", t: "Hey, Pete! Who’s your friend?" },
      { s: "Pete", t: "She is Anna. She is new to D.C." },
      { s: "Jonathan", t: "Where are you from?" },
      { s: "Anna", t: "I am from a small town." },
      { s: "Jonathan", t: "Well, welcome to D.C." },
    ],
    listening: [
      { q: "Who is new to Washington, D.C.?", a: ["Pete", "Jonathan", "Anna", "Marsha"], c: 2, why: "Pete giới thiệu: She is Anna. She is new to D.C." },
      { q: "Where is Anna from?", a: ["A big city", "A small town", "Another country", "New York"], c: 1, why: "I am from a small town." },
      { q: "Which apartment does Anna live in?", a: ["B4", "D7", "C2", "A1"], c: 2, why: "Jonathan ở B4, Pete ở D7, Anna ở C2." },
      { q: "What does Pete tell Anna to do?", a: ["Call Marsha at work", "Go to the store", "Meet him later", "Find a new apartment"], c: 0, why: "Pete nhắc Anna gọi cho Marsha ở chỗ làm." },
    ],
    reading: [
      { q: "Who is Marsha?", a: ["Anna's boss", "Anna's roommate", "Pete's sister", "Jonathan's coworker"], c: 1, why: "Anna lives in apartment C2 with her roommate, Marsha." },
      { q: "What does Jonathan say about Marsha?", a: ["She is busy", "She is new", "She is nice", "She is from a small town"], c: 2, why: "He says she is nice." },
      { q: "Who lives in apartment B4?", a: ["Jonathan", "Pete", "Anna", "Marsha"], c: 0, why: "Jonathan lives in apartment B4." },
    ],
    dictation: [1, 3],
    speaking: [0, 2, 4],
    audioUrl: "https://voa-audio.voanews.eu/vle/2016/02/10/56246d7b-5fa4-42d2-90b0-d403e6b46227.mp3",
    source: "VOA Learning English — Let's Learn English, Lesson 2",
    sourceUrl: "https://learningenglish.voanews.com/a/lets-learn-english-lesson-2-hello/3113733.html",
  },
  {
    id: "e6-voa-people-watching",
    level: "easy",
    title: "I Love People Watching",
    titleVi: "Ngắm người qua lại",
    minutes: 12,
    intro: "VOA Let's Learn English, bài 15: giờ nghỉ trưa, Anna và bạn bè tả ngoại hình của nhau và của sếp.",
    vocab: [
      { w: "tall", pos: "adj", vi: "cao", ex: "Anna is tall." },
      { w: "short", pos: "adj", vi: "thấp", ex: "Ashley and Keyana are short." },
      { w: "straight hair", pos: "n", vi: "tóc thẳng", ex: "Ashley has straight hair." },
      { w: "curly hair", pos: "n", vi: "tóc xoăn", ex: "Keyana has curly hair." },
      { w: "glasses", pos: "n", vi: "kính (đeo mắt)", ex: "My boss wears glasses." },
      { w: "hurry", pos: "v", vi: "vội, làm gấp", ex: "No need to hurry." },
    ],
    textKind: "summary",
    transcript: [
      { t: "It is a sunny day in Washington, D.C." },
      { t: "Anna and her friend Ashley eat lunch outside and watch people walk by." },
      { t: "Keyana, who works with Anna, joins them." },
      { t: "They talk about how they look. Anna is tall, but Ashley and Keyana are short." },
      { t: "Ashley has straight hair. Keyana and Anna have curly hair." },
      { t: "Then Keyana goes back to work." },
      { t: "Ashley asks about Anna's boss. Anna says her boss is short, has straight, light hair and wears glasses." },
      { t: "Then the boss, Ms. Weaver, walks toward them, and Anna hides behind a bench!" },
      { t: "Ms. Weaver finds her. She says there is no need to hurry, and she sits down to people-watch too." },
    ],
    drill: [
      { s: "Anna", t: "Hello! People from all over the world come to Washington, D.C." },
      { s: "Keyana", t: "For example, Anna, you are tall. But Ashley and I are short." },
      { s: "Anna", t: "Ashley, you have straight hair. Keyana and I have curly hair." },
      { s: "Ms. Weaver", t: "No need to hurry. I love people-watching too!" },
    ],
    listening: [
      { q: "Where do Anna and Ashley have lunch?", a: ["In the office", "Outside", "At a restaurant", "At home"], c: 1, why: "Hai người ăn trưa ngoài trời và ngắm người đi qua." },
      { q: "Who is tall?", a: ["Ashley", "Keyana", "Anna", "Ms. Weaver"], c: 2, why: "Anna, you are tall. But Ashley and I are short." },
      { q: "What does Anna's boss wear?", a: ["A hat", "Glasses", "A red coat", "A uniform"], c: 1, why: "Sếp của Anna đeo kính." },
      { q: "What does Anna do when her boss comes?", a: ["She says hello", "She hides", "She goes back to work", "She calls Ashley"], c: 1, why: "Anna trốn sau ghế băng." },
    ],
    reading: [
      { q: "Who has curly hair?", a: ["Ashley and Keyana", "Anna and Ashley", "Keyana and Anna", "Only Ms. Weaver"], c: 2, why: "Keyana and Anna have curly hair." },
      { q: "What is the boss's hair like?", a: ["Curly and dark", "Straight and light", "Short and curly", "Long and red"], c: 1, why: "...has straight, light hair." },
      { q: "What does Ms. Weaver do at the end?", a: ["She tells Anna to hurry", "She goes back to the office", "She sits down to people-watch", "She eats lunch with Keyana"], c: 2, why: "She sits down to people-watch too." },
    ],
    dictation: [1, 2],
    speaking: [0, 2, 3],
    audioUrl: "https://voa-audio.voanews.eu/vle/2016/05/31/b08ceeac-8274-4e2d-b678-2cd30ba31f4f.mp3",
    source: "VOA Learning English — Let's Learn English, Lesson 15",
    sourceUrl: "https://learningenglish.voanews.com/a/lets-learn-english-lesson-15-i-love-people-watching/3343720.html",
  },
  {
    id: "m5-voa-wright-brothers",
    level: "medium",
    title: "Wilbur and Orville Wright: The First Airplane",
    titleVi: "Anh em nhà Wright và chiếc máy bay đầu tiên",
    minutes: 15,
    intro: "VOA Learning English (All About America): hai anh em người Mỹ làm ra chiếc máy bay có động cơ đầu tiên.",
    vocab: [
      { w: "glider", pos: "n", vi: "tàu lượn (máy bay không động cơ)", ex: "A glider has no engine." },
      { w: "flight", pos: "n", vi: "chuyến bay", ex: "The first flight lasted 12 seconds." },
      { w: "wing", pos: "n", vi: "cánh (máy bay, chim)", ex: "The plane had wings 12 meters across." },
      { w: "demonstration", pos: "n", vi: "buổi trình diễn", ex: "Wilbur gave flying demonstrations in France." },
      { w: "modest", pos: "adj", vi: "khiêm tốn", ex: "They became famous but stayed modest." },
    ],
    textKind: "summary",
    transcript: [
      { t: "Wilbur and Orville Wright were American brothers." },
      { t: "Wilbur was born in 1867 in Indiana. Orville was born four years later in Ohio." },
      { t: "They wanted to show that a machine heavier than air could fly." },
      { t: "First, they tested their ideas with gliders at Kitty Hawk, North Carolina." },
      { t: "On December 17, 1903, Orville made the first powered flight. He was in the air for 12 seconds." },
      { t: "In 1908, Wilbur flew for crowds in France, and the United States military bought a Wright plane." },
      { t: "The brothers became famous, but they stayed modest and kept improving their planes." },
      { t: "They also taught other people to fly." },
      { t: "Wilbur died in 1912. Orville died in 1948." },
      { t: "Their first airplane is now in the Air and Space Museum in Washington, D.C." },
    ],
    drill: [
      { t: "Wilbur Wright was born in 1867 near Melville, Indiana." },
      { t: "His brother Orville was born four years later in Dayton, Ohio." },
      { t: "The plane had wings 12 meters across." },
      { t: "Orville flew the plane 36 meters." },
      { t: "He was in the air for 12 seconds." },
    ],
    listening: [
      { q: "Where did the brothers test their gliders?", a: ["Dayton, Ohio", "Kitty Hawk, North Carolina", "Washington, D.C.", "Paris, France"], c: 1, why: "Họ thử tàu lượn ở Kitty Hawk, North Carolina." },
      { q: "Who made the first powered flight?", a: ["Wilbur", "Orville", "Both brothers together", "A French pilot"], c: 1, why: "Orville bay chuyến có động cơ đầu tiên ngày 17/12/1903." },
      { q: "How long was the first flight?", a: ["12 minutes", "36 seconds", "12 seconds", "One hour"], c: 2, why: "He was in the air for 12 seconds. (36 là số mét bay được.)" },
      { q: "Where is the first Wright airplane today?", a: ["In a museum in Ohio", "At Kitty Hawk", "In France", "In the Air and Space Museum in Washington, D.C."], c: 3, why: "Chiếc máy bay đầu tiên đang ở Bảo tàng Hàng không và Vũ trụ, Washington." },
    ],
    reading: [
      { q: "How much older was Wilbur than Orville?", a: ["One year", "Two years", "Four years", "Twelve years"], c: 2, why: "Orville was born four years later." },
      { q: "What happened in 1908?", a: ["Orville was born", "Wilbur flew for crowds in France", "They built their first glider", "Wilbur died"], c: 1, why: "In 1908, Wilbur flew for crowds in France." },
      { q: "\"They stayed modest\" means they…", a: ["did not act proud", "stopped flying", "became very rich", "moved to France"], c: 0, why: "modest = khiêm tốn, không khoe khoang." },
    ],
    dictation: [1, 3],
    speaking: [0, 2, 4],
    audioUrl: "https://voa-audio.voanews.eu/vle/2025/03/05/e897fcf6-3ce1-4da9-a5cf-08dd5afe0892.mp3",
    source: "VOA Learning English — Marilyn Rice Christiano, adapted by John Russell",
    sourceUrl: "https://learningenglish.voanews.com/a/wilbur-and-orville-wright-the-first-airplane/7998765.html",
  },
  {
    id: "m6-voa-lunar-eclipse",
    level: "medium",
    title: "Total Lunar Eclipse to Turn Moon Red",
    titleVi: "Nguyệt thực toàn phần làm Mặt Trăng đỏ",
    minutes: 15,
    intro: "VOA Learning English (Science & Technology): nguyệt thực là gì, vì sao gọi là “trăng máu”, ở đâu nhìn thấy được.",
    vocab: [
      { w: "eclipse", pos: "n", vi: "hiện tượng thực (nhật thực, nguyệt thực)", ex: "A lunar eclipse happens at night." },
      { w: "lunar", pos: "adj", vi: "thuộc Mặt Trăng", ex: "A lunar eclipse is called nguyệt thực." },
      { w: "shadow", pos: "n", vi: "cái bóng", ex: "Earth's shadow falls on the Moon." },
      { w: "atmosphere", pos: "n", vi: "khí quyển", ex: "Some sunlight passes through Earth's atmosphere." },
      { w: "curved", pos: "adj", vi: "cong", ex: "The shadow always looked curved." },
      { w: "equipment", pos: "n", vi: "thiết bị", ex: "You need no special equipment." },
    ],
    textKind: "summary",
    transcript: [
      { t: "A total lunar eclipse will make the Moon look red over North and South America." },
      { t: "A lunar eclipse happens when Earth is between the Sun and the Moon, and Earth's shadow falls on the Moon." },
      { t: "In a total lunar eclipse, the shadow covers the whole Moon." },
      { t: "A solar eclipse is different: the Moon blocks sunlight from reaching Earth." },
      { t: "People also call a total lunar eclipse a \"blood moon\" because of its red-orange color." },
      { t: "The color comes from a little sunlight that passes through Earth's atmosphere." },
      { t: "This eclipse can be seen for about one hour. You need a clear sky, but no special equipment." },
      { t: "It is harder to see in Europe and Africa because the Moon is close to setting there." },
      { t: "Long ago, the Greek thinker Aristotle saw that Earth's shadow on the Moon was always curved. This supported the idea that Earth is round." },
      { t: "Lunar and solar eclipses happen four to seven times a year." },
    ],
    drill: [
      { t: "A total lunar eclipse is about to make the moon appear a reddish color across the Western Hemisphere." },
      { t: "A total lunar eclipse can also be called a blood moon." },
      { t: "The American space agency NASA says lunar and solar eclipses happen between four and seven times a year." },
      { t: "As long as the sky is clear, you should be able to see it." },
      { t: "The total lunar eclipse may be harder to see in Europe and Africa because the moon will be close to setting." },
    ],
    listening: [
      { q: "Where will the eclipse be easiest to see?", a: ["Asia and Australia", "North and South America", "Europe and Africa", "Only in Texas"], c: 1, why: "Rõ nhất ở Bắc và Nam Mỹ (Tây bán cầu)." },
      { q: "What is another name for a total lunar eclipse?", a: ["A blue moon", "A blood moon", "A new moon", "A sun shadow"], c: 1, why: "It can also be called a blood moon." },
      { q: "About how long can this eclipse be seen?", a: ["Ten minutes", "One hour", "All night", "Three days"], c: 1, why: "Nhìn thấy trong khoảng một giờ." },
      { q: "What do you need to see it?", a: ["A telescope", "Special glasses", "A clear sky", "A camera"], c: 2, why: "As long as the sky is clear… không cần thiết bị đặc biệt." },
    ],
    reading: [
      { q: "During a lunar eclipse, what is between the Sun and the Moon?", a: ["Earth", "Mars", "A cloud", "Another moon"], c: 0, why: "Earth is between the Sun and the Moon." },
      { q: "Why does the Moon look red?", a: ["It gets very hot", "Some sunlight passes through Earth's atmosphere", "It reflects red rocks on Earth", "The Sun turns red"], c: 1, why: "The color comes from a little sunlight that passes through Earth's atmosphere." },
      { q: "What did Aristotle's observation support?", a: ["The Moon is made of rock", "Earth is round", "The Sun moves around Earth", "Eclipses happen every week"], c: 1, why: "Bóng Trái Đất luôn cong → Trái Đất tròn." },
    ],
    dictation: [1, 3],
    speaking: [0, 2, 4],
    audioUrl: "https://voa-audio.voanews.eu/vle/2025/03/10/ab869609-867b-4773-048b-08dd5c8b1668.mp3",
    source: "VOA Learning English — Adithi Ramakrishnan (AP), adapted by Andrew Smith",
    sourceUrl: "https://learningenglish.voanews.com/a/total-lunar-eclipse-to-turn-moon-red/8005741.html",
  },
  {
    id: "h5-voa-ice-ages",
    level: "hard",
    title: "Study Shows How Earth's Orbit Affects Ice Ages",
    titleVi: "Quỹ đạo Trái Đất và các kỷ băng hà",
    minutes: 18,
    intro: "VOA Learning English (Science & Technology): một nghiên cứu dự đoán khi nào kỷ băng hà tiếp theo bắt đầu.",
    vocab: [
      { w: "cycle", pos: "n", vi: "chu kỳ", ex: "Warm and cold periods come in cycles." },
      { w: "tilt", pos: "n", vi: "độ nghiêng", ex: "The tilt of Earth's axis changes slowly." },
      { w: "axis", pos: "n", vi: "trục (Trái Đất quay quanh nó)", ex: "Earth turns around its axis once a day." },
      { w: "wobble", pos: "n", vi: "sự lắc lư, chao đảo", ex: "A spinning top has a small wobble." },
      { w: "glaciation", pos: "n", vi: "thời kỳ băng phủ rộng", ex: "The next glaciation may start in 11,000 years." },
      { w: "emissions", pos: "n", vi: "khí thải", ex: "Car emissions warm the planet." },
    ],
    textKind: "summary",
    transcript: [
      { t: "A new study says the next ice age will probably begin in about 11,000 years, unless human emissions change Earth's natural climate cycles." },
      { t: "In an ice age, ice covers large parts of the north and south of the planet for a long time." },
      { t: "The researchers studied three movements: the shape of Earth's orbit around the Sun, the tilt of its axis, and the wobble of that axis." },
      { t: "About 100 years ago, the Serbian scientist Milutin Milankovitch said these cycles shape Earth's long-term climate." },
      { t: "The team compared a million-year climate record from ice sheets and deep ocean temperatures with small, regular changes in Earth's orbit." },
      { t: "They found cycles of warming and cooling of about 100,000 years." },
      { t: "The last ice age ended about 11,700 years ago." },
      { t: "Lead author Stephen Barker of Cardiff University says the next glaciation should come within 11,000 years and end about 66,000 years later." },
      { t: "Co-author Lorraine Lisiecki says these climate changes follow patterns; they are not random." },
      { t: "Next, the team wants to study the long-term effects of human activity on climate." },
    ],
    drill: [
      { t: "Earth is believed to go through cycles of ice ages and warm periods." },
      { t: "However, researchers have struggled to precisely date when each of the climate changes happened." },
      { t: "They then compared this data with small but regular changes in Earth’s orbit over time." },
      { t: "The group published its findings in Science on February 27." },
      { t: "The team aims to expand its findings to investigate the long-term effects of human activity on climate." },
    ],
    listening: [
      { q: "When will the next ice age probably begin, according to the study?", a: ["In about 1,100 years", "In about 11,000 years", "In about 66,000 years", "In about 100,000 years"], c: 1, why: "Khoảng 11.000 năm nữa (nếu khí thải không làm lệch chu kỳ)." },
      { q: "Which is NOT one of the three movements the team studied?", a: ["The shape of Earth's orbit", "The tilt of Earth's axis", "The wobble of the axis", "The speed of the Moon"], c: 3, why: "Ba chuyển động: hình dạng quỹ đạo, độ nghiêng trục, độ lắc của trục." },
      { q: "Who said about 100 years ago that these cycles shape climate?", a: ["Stephen Barker", "Milutin Milankovitch", "Lorraine Lisiecki", "Andrew Smith"], c: 1, why: "Nhà khoa học Serbia Milutin Milankovitch." },
      { q: "Where does the lead author work?", a: ["University of California", "Cardiff University in Britain", "NASA", "Brown University"], c: 1, why: "Stephen Barker, Đại học Cardiff (Anh)." },
    ],
    reading: [
      { q: "How long ago did the last ice age end?", a: ["About 1,170 years", "About 11,700 years", "About 100,000 years", "About 900,000 years"], c: 1, why: "The last ice age ended about 11,700 years ago." },
      { q: "What could change the natural cycles, according to the first sentence?", a: ["The Moon", "Human emissions", "Ocean animals", "Earthquakes"], c: 1, why: "...unless human emissions change Earth's natural climate cycles." },
      { q: "\"These changes are not random\" means they…", a: ["happen in a pattern", "are very fast", "are dangerous", "cannot be studied"], c: 0, why: "random = ngẫu nhiên; not random = có quy luật." },
    ],
    dictation: [0, 3],
    speaking: [1, 2, 4],
    audioUrl: "https://voa-audio.voanews.eu/vle/2025/03/05/f9ea33c3-b1e6-41e4-a601-08dd5afe0892.mp3",
    source: "VOA Learning English — Issam Ahmed (AFP), adapted by Andrew Smith",
    sourceUrl: "https://learningenglish.voanews.com/a/study-shows-how-earth-s-orbit-affects-ice-ages/7997495.html",
  },
  {
    id: "h6-voa-mars-red",
    level: "hard",
    title: "New Discovery Could Explain What Gives Mars its Red Color",
    titleVi: "Vì sao Sao Hoả màu đỏ?",
    minutes: 18,
    intro: "VOA Learning English (Science & Technology): khoáng chất có thể làm Sao Hoả đỏ, và nó gợi ý điều gì về nước trên Sao Hoả.",
    vocab: [
      { w: "mineral", pos: "n", vi: "khoáng chất", ex: "Ferrihydrite is a mineral that contains iron." },
      { w: "spacecraft", pos: "n", vi: "tàu vũ trụ", ex: "Several spacecraft collected data about Mars." },
      { w: "sample", pos: "n", vi: "mẫu vật", ex: "The rover is collecting rock samples." },
      { w: "verify", pos: "v", vi: "kiểm chứng", ex: "Scientists need samples to verify the idea." },
      { w: "opportunity", pos: "n", vi: "cơ hội", ex: "The findings are an opportunity for new research." },
    ],
    textKind: "summary",
    transcript: [
      { t: "Scientists think they have found the mineral that makes Mars look red." },
      { t: "The mineral is called ferrihydrite. It is a kind of iron oxide, and it can form where there is a lot of water." },
      { t: "Earlier studies suggested a different mineral, hematite." },
      { t: "An international team led by Brown University in the United States and the University of Bern in Switzerland did the research." },
      { t: "They used data from several spacecraft and rovers, and they also made man-made Martian dust in a laboratory." },
      { t: "Ferrihydrite needs oxygen and water to form, so Mars may once have had liquid water, and perhaps some kind of life." },
      { t: "Today Mars is dry and cold, very different from those conditions." },
      { t: "To be sure, scientists need real samples from Mars. NASA's Perseverance rover is collecting them now." },
      { t: "The study was published in the journal Nature Communications." },
    ],
    drill: [
      { t: "Scientists say they might have identified the mineral on Mars that is responsible for making the planet appear red." },
      { t: "The mineral appears reddish in color and can form in water-rich environments." },
      { t: "The study is based on Martian data collected by several spacecraft." },
      { t: "Past studies had suggested a mineral called hematite might be the cause." },
      { t: "These conditions were very different from the dry, cold environment of Mars today." },
    ],
    listening: [
      { q: "What is the mineral in the new study called?", a: ["Hematite", "Ferrihydrite", "Quartz", "Copper"], c: 1, why: "Ferrihydrite, một loại ôxít sắt." },
      { q: "What does this mineral suggest about Mars's past?", a: ["It was very hot", "It may have had liquid water", "It had no air", "It was blue"], c: 1, why: "Nó hình thành khi có nhiều nước → Sao Hoả từng có nước lỏng." },
      { q: "Which two universities led the research?", a: ["Brown and Bern", "Yale and Cardiff", "Harvard and Oxford", "Bern and Cardiff"], c: 0, why: "Brown University (Mỹ) và University of Bern (Thuỵ Sĩ)." },
      { q: "How can scientists finally check the idea?", a: ["With better telescopes", "With samples from Mars", "With a new computer game", "By visiting the Moon"], c: 1, why: "Cần mẫu vật thật từ Sao Hoả (rover Perseverance đang thu thập)." },
    ],
    reading: [
      { q: "Which mineral did earlier studies point to?", a: ["Ferrihydrite", "Hematite", "Iron", "Oxygen"], c: 1, why: "Earlier studies suggested a different mineral, hematite." },
      { q: "What two things are needed for ferrihydrite to form?", a: ["Heat and dust", "Oxygen and water", "Ice and rock", "Sunlight and wind"], c: 1, why: "Ferrihydrite needs oxygen and water to form." },
      { q: "Which rover is collecting samples now?", a: ["Curiosity", "Perseverance", "Opportunity", "Spirit"], c: 1, why: "NASA's Perseverance rover is collecting them now." },
    ],
    dictation: [1, 3],
    speaking: [0, 2, 4],
    audioUrl: "https://voa-audio.voanews.eu/vle/2025/02/27/58e7f806-65ba-4432-0363-08dd4a817621.mp3",
    source: "VOA Learning English — Bryan Lynn",
    sourceUrl: "https://learningenglish.voanews.com/a/new-discovery-could-explain-what-gives-mars-its-red-color/7990107.html",
  },
];

const WRITING: Record<string, LabLesson["write"]> = {
  "e1-coffee-shop": {
    prompt: "You are at a café. Write 2–3 sentences to order a drink and something to eat.",
    model: "Hi, can I have a small tea with lemon, please? I'd also like a banana muffin. It's to go, thanks.",
  },
  "e2-directions": {
    prompt: "A visitor asks you the way to a shop near your home. Write 2–3 sentences of directions.",
    model: "Go out of the building and turn left. Walk straight for two blocks. The shop is on your right, next to the bank.",
  },
  "e3-doctor-appointment": {
    prompt: "Write a short message to book an appointment with a doctor. Say what the problem is and when you are free.",
    model: "Hello, I'd like to make an appointment with Dr. Lee. I have had a sore throat for three days. Is Thursday morning free?",
  },
  "e4-weekend-plans": {
    prompt: "Write 2–3 sentences about your plans for this weekend.",
    model: "On Saturday morning I'm going to clean my room. In the afternoon I want to meet my friends for coffee. On Sunday I'll stay home and study English.",
  },
  "m1-job-interview": {
    prompt: "Answer the interview question \"Why do you want this job?\" in 3 sentences.",
    model: "I want this job because I enjoy working with people. In my last job I learned to solve problems quickly. I think I can help your team and keep learning here.",
  },
  "m2-renting-apartment": {
    prompt: "Write a short email to a landlord with three questions about an apartment.",
    model: "Hello, I saw your ad for the two-bedroom apartment. How much is the rent each month, and are bills included? Can I visit it this weekend?",
  },
  "m3-why-sleep-matters": {
    prompt: "What helps you sleep better? Write 3 sentences.",
    model: "I sleep better when I put my phone away an hour before bed. I also try to go to bed at the same time every night. A cool, dark room helps me fall asleep faster.",
  },
  "m4-changing-flight": {
    prompt: "Write a short message to an airline: you need to change your flight. Give the reason and ask one question.",
    model: "Hello, my booking number is AB123. I need to change my flight from Friday to Sunday because of a family event. Is there a fee, and is there a seat on Sunday morning?",
  },
  "h1-lost-wallet": {
    prompt: "Write 3–4 sentences about a time you lost something. What happened in the end?",
    model: "Last year I left my phone on a bus. I called my number from a friend's phone, and the driver answered. He kept it at the station, so I picked it up the next morning. Since then I always check my seat before I get off.",
  },
  "h2-coffee-health": {
    prompt: "Is coffee good or bad for people? Give your opinion with one reason and one example (3–4 sentences).",
    model: "I think coffee is fine for most people if they drink it in moderation. One or two cups can help you focus in the morning. However, coffee late in the day can make it hard to sleep, so I stop after lunch.",
  },
  "h3-team-meeting": {
    prompt: "Your team must choose: fix the old app or build a new one. Give your opinion with two reasons (3–4 sentences).",
    model: "I think we should fix the old app first. Users are complaining now, and a fix can be ready in weeks, not months. Building from scratch would use most of the budget. We can plan a new version next year.",
  },
  "e5-voa-hello-anna": {
    prompt: "Introduce yourself to a new neighbor in 2–3 sentences: your name, where you are from, and where you live.",
    model: "Hi, I'm Minh. I'm from a small town near Hue. I live in apartment 5B, next to the stairs.",
  },
  "e6-voa-people-watching": {
    prompt: "Describe a friend or family member in 2–3 sentences: height, hair, and one more detail.",
    model: "My brother is tall and thin. He has short, curly black hair. He wears glasses when he reads.",
  },
  "m5-voa-wright-brothers": {
    prompt: "Which invention is the most important in your life? Write 3 sentences: what it is, how you use it, and why.",
    model: "For me, the most important invention is the smartphone. I use it to talk to my family, pay for things and study English. Without it, my day would be much slower.",
  },
  "m6-voa-lunar-eclipse": {
    prompt: "Describe something you saw in the sky (a sunset, the Moon, a storm…). Write 3 sentences: when, where, and how it looked.",
    model: "Last summer I watched the sunset from the beach in Vung Tau. The sky turned orange and then deep red. It was so beautiful that everyone stopped talking.",
  },
  "h5-voa-ice-ages": {
    prompt: "Write 3–4 sentences: one change in the weather or climate you notice where you live, and one thing people can do about it.",
    model: "In my city, summers are getting hotter every year, and the rain comes at strange times. Many streets flood after heavy storms. People can plant more trees and use public transport instead of motorbikes. Small changes from many people can make a difference.",
  },
  "h6-voa-mars-red": {
    prompt: "If you could ask a scientist one question about space, what would it be? Write 3–4 sentences and explain why.",
    model: "I would ask whether there was ever life on Mars. The planet once had water, so tiny living things might have lived there. If the answer is yes, it would change how we see our place in the universe. I would also like to know when people will travel there.",
  },
  "h4-working-anywhere": {
    prompt: "Would you rather work from home or in an office? Give two reasons (4 sentences).",
    model: "I would rather work from home for most of the week. First, I save an hour every day because I don't commute. Second, it's quieter, so I can focus on difficult tasks. Still, I'd like to go to the office once a week to see my team.",
  },
};

const LEVEL_ORDER: LabLevel[] = ["easy", "medium", "hard"];
const LESSONS: LabLesson[] = RAW_LESSONS
  .map((lesson) => ({ ...lesson, write: WRITING[lesson.id] }))
  .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));

/** Các câu dùng cho chính tả và nói theo của một bài. */
export function drillLines(lesson: LabLesson): LabLine[] {
  return lesson.drill ?? lesson.transcript;
}

export function labLessons(level?: LabLevel): LabLesson[] {
  return level ? LESSONS.filter((lesson) => lesson.level === level) : LESSONS;
}

export function labLesson(id: string): LabLesson | null {
  return LESSONS.find((lesson) => lesson.id === id) ?? null;
}

/* ───────────────────────────── chấm điểm ───────────────────────────── */

/** Điểm một phần, 0..1 (null khi chưa làm). */
export interface LabParts {
  listen: number | null;
  read: number | null;
  write: number | null;
  speak: number | null;
}

export const PART_WEIGHTS = { listen: 35, read: 25, write: 25, speak: 15 } as const;

/** Nguồn của từng điểm, không đồng nhất với một bài đánh giá năng lực CEFR. */
export const PART_EVIDENCE: Record<keyof LabParts, { source: string; criterion: string }> = {
  listen: { source: "Máy chấm đáp án", criterion: "Trả lời câu hỏi nghe, so với đáp án." },
  read: { source: "Máy chấm đáp án", criterion: "Trả lời câu hỏi đọc, so với đáp án." },
  write: { source: "Chính tả máy chấm + tự kiểm tra", criterion: "Làm chính tả; bài viết ngắn và checklist là tùy chọn, không được máy chấm ngữ pháp." },
  speak: { source: "Người học tự chấm", criterion: "Nói theo các câu mẫu và tự chọn mức giống; chưa kiểm chứng phát âm." },
};

/** Tổng điểm phần trăm trên các phần ĐÃ làm (null khi chưa làm gì). */
export function labTotal(parts: LabParts): number | null {
  let got = 0;
  let max = 0;
  for (const key of Object.keys(PART_WEIGHTS) as (keyof LabParts)[]) {
    const value = parts[key];
    if (value === null) continue;
    got += Math.min(1, Math.max(0, value)) * PART_WEIGHTS[key];
    max += PART_WEIGHTS[key];
  }
  return max === 0 ? null : Math.round((got / max) * 100);
}

export function gradeLabel(percent: number): string {
  if (percent >= 90) return "Xuất sắc";
  if (percent >= 75) return "Tốt";
  if (percent >= 60) return "Khá";
  return "Cần nghe lại";
}

/** Tách câu thành từ để so chính tả: thường hoá, bỏ dấu câu, giữ số. */
export function dictationWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

export interface DictationResult {
  /** Từng từ của câu gốc, kèm việc người học gõ đúng (theo thứ tự). */
  words: { w: string; ok: boolean }[];
  /** 0..1 — số từ đúng trên tổng số từ của câu gốc. */
  score: number;
}

/** So bài chính tả với câu gốc, khớp theo thứ tự (bỏ qua từ gõ thừa). */
export function compareDictation(expected: string, typed: string): DictationResult {
  const target = dictationWords(expected);
  const given = dictationWords(typed);
  const words: { w: string; ok: boolean }[] = [];
  let j = 0;
  let correct = 0;
  for (const w of target) {
    // Tìm từ này trong phần còn lại của câu đã gõ (cho phép thiếu/thừa một vài từ).
    let found = -1;
    for (let k = j; k < Math.min(given.length, j + 3); k += 1) {
      if (given[k] === w) {
        found = k;
        break;
      }
    }
    if (found >= 0) {
      correct += 1;
      j = found + 1;
      words.push({ w, ok: true });
    } else words.push({ w, ok: false });
  }
  return { words, score: target.length === 0 ? 0 : correct / target.length };
}

/** Viết tự do: số câu và những từ của phần Từ vựng đã dùng (gợi ý, không phải điểm). */
export function writingCheck(lesson: LabLesson, text: string): { sentences: number; used: string[] } {
  const clean = text.trim();
  const sentences = clean ? clean.split(/[.!?]+/).filter((part) => part.trim().split(/\s+/).length >= 2).length : 0;
  const words = ` ${dictationWords(clean).join(" ")} `;
  const used = lesson.vocab.map((item) => item.w).filter((w) => words.includes(` ${dictationWords(w).join(" ")} `));
  return { sentences, used };
}

/** Observable writing practice feedback. These rules cannot judge meaning, grammar or proficiency. */
export function writingRubric(lesson: LabLesson, draft: string): {
  checks: { id: string; label: string; passed: boolean | null; detail: string; retry: string }[];
  nextStep: string;
} {
  const clean = draft.trim();
  const text = writingCheck(lesson, clean);
  const requested = lesson.write.prompt.match(/(\d+)(?:[–-]\d+)? sentences?/i);
  const minimum = requested ? Number(requested[1]) : 2;
  const checks = [
    {
      id: "sentences",
      label: "Độ dài theo đề",
      passed: text.sentences >= minimum,
      detail: `${text.sentences}/${minimum} câu có ít nhất hai từ (mục tiêu tối thiểu).`,
      retry: `Viết thêm cho đủ ít nhất ${minimum} câu có ý hoàn chỉnh.`,
    },
    {
      id: "vocabulary",
      label: "Từ vựng trong bài",
      passed: text.used.length >= 2,
      detail: `${text.used.length}/2 từ hoặc cụm từ trong bài: ${text.used.join(", ") || "chưa có"}.`,
      retry: "Thử dùng tự nhiên thêm một từ hoặc cụm từ của bài; đừng nhồi từ làm sai nghĩa.",
    },
    {
      id: "ending",
      label: "Dấu kết câu",
      passed: /[.!?]$/.test(clean),
      detail: /[.!?]$/.test(clean) ? "Đã có dấu kết câu ở cuối đoạn." : "Chưa thấy dấu chấm, chấm hỏi hoặc chấm than ở cuối đoạn.",
      retry: "Đọc lại câu cuối và thêm dấu kết câu phù hợp.",
    },
    {
      id: "meaning",
      label: "Đúng đề và ngữ pháp",
      passed: null,
      detail: "Không tự chấm được nội dung, lập luận, ngữ pháp và tính tự nhiên.",
      retry: "Tự đối chiếu với đề và bài mẫu; chọn một chỗ chưa đúng ý hoặc ngữ pháp để viết lại.",
    },
  ];
  return { checks, nextStep: checks.find((item) => item.passed === false)?.retry ?? checks[3].retry };
}

/** Câu tự kiểm tra cho bài viết; điểm viết = trung bình chính tả và tỉ lệ câu đã tích. */
export const WRITING_CHECKLIST = [
  "Trả lời đúng điều đề hỏi",
  "Dùng ít nhất 2 từ trong phần Từ vựng",
  "Đã so với bài mẫu và tự sửa lỗi (ngữ pháp, chính tả, dấu câu)",
] as const;

export function writeScore(dictation: number | null, checked: number | null): number | null {
  if (dictation === null && checked === null) return null;
  if (checked === null) return dictation;
  const ratio = checked / WRITING_CHECKLIST.length;
  return dictation === null ? ratio : (dictation + ratio) / 2;
}

/** ASR only highlights possible missing words; it cannot prove pronunciation quality. */
export function speakingRetryFeedback(expected: string, transcript: string | null): {
  source: "self" | "asr";
  missing: string[];
  nextStep: string;
} {
  if (!transcript?.trim()) {
    return {
      source: "self",
      missing: [],
      nextStep: "Nghe câu mẫu một lần, nói lại chậm theo từng cụm, rồi nghe bản ghi của mình.",
    };
  }
  const missing = compareDictation(expected, transcript).words.filter((word) => !word.ok).map((word) => word.w);
  return missing.length
    ? {
        source: "asr",
        missing,
        nextStep: `Thử nói lại cụm chứa “${missing[0]}”, rồi nghe so với câu mẫu. Máy có thể nhận dạng sai.`,
      }
    : {
        source: "asr",
        missing: [],
        nextStep: "Bản chép lời nhận ra đủ từ theo thứ tự. Nghe lại nhịp, trọng âm và độ rõ; điều này chưa chứng minh phát âm chuẩn.",
      };
}

/** Tự chấm phần nói, mỗi câu: 0 chưa giống, 0.5 gần giống, 1 giống bản mẫu. */
export const SPEAK_RATINGS = [
  { value: 0, label: "Chưa giống" },
  { value: 0.5, label: "Gần giống" },
  { value: 1, label: "Giống" },
] as const;

/* ───────────────────────────── luyện đề ───────────────────────────── */

export interface LabTestQuestion {
  lessonId: string;
  kind: "listening" | "reading";
  index: number;
}

export interface LabTest {
  /** Các bài nghe trong đề, theo thứ tự nghe. */
  lessonIds: string[];
  questions: LabTestQuestion[];
  dictations: { lessonId: string; line: number }[];
  /** Một câu nói theo, tự chấm, tính riêng (không vào điểm tự động). */
  speaking: { lessonId: string; line: number };
  /** Mục tiêu thời gian, phút. */
  minutes: number;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Dựng một đề cố định theo `seed` (thường là ngày): 2 bài nghe khác nhau, 8 trắc nghiệm (nghe +
 * đọc của chính 2 bài đó), 2 câu chính tả và 1 câu nói. Cùng seed và cùng mức luôn ra cùng đề.
 */
export function buildTest(seed: string, level?: LabLevel): LabTest {
  const pool = labLessons(level);
  const h = hashSeed(seed + (level ?? "all"));
  const firstIndex = h % pool.length;
  const picked = [pool[firstIndex], pool[(firstIndex + 1 + ((h >>> 8) % (pool.length - 1))) % pool.length]];
  const questions: LabTestQuestion[] = [];
  const dictations: { lessonId: string; line: number }[] = [];
  picked.forEach((lesson, i) => {
    const qs: LabTestQuestion[] = [
      ...lesson.listening.map((_, index) => ({ lessonId: lesson.id, kind: "listening" as const, index })),
      ...lesson.reading.map((_, index) => ({ lessonId: lesson.id, kind: "reading" as const, index })),
    ];
    // 4 câu mỗi bài, chọn lệch theo seed để các ngày khác nhau.
    for (let k = 0; k < 4; k += 1) questions.push(qs[(h + i * 5 + k * 2) % qs.length]);
    dictations.push({ lessonId: lesson.id, line: lesson.dictation[(h + i) % lesson.dictation.length] });
  });
  // Bỏ câu trùng (có thể xảy ra khi bước nhảy chia hết), giữ thứ tự.
  const seen = new Set<string>();
  const unique = questions.filter((item) => {
    const key = `${item.lessonId}:${item.kind}:${item.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const speaker = picked[h % 2];
  const speaking = { lessonId: speaker.id, line: speaker.speaking[(h >>> 4) % speaker.speaking.length] };
  // Chỉ số chính tả/nói trỏ vào drillLines(bài).
  return { lessonIds: picked.map((lesson) => lesson.id), questions: unique, dictations, speaking, minutes: 15 };
}

/* ───────────────────────────── lưu kết quả ───────────────────────────── */

export interface LabLessonRecord {
  /** Điểm cao nhất của những lần làm đủ 4 phần (0 khi chưa lần nào đủ). */
  best: number;
  /** Tổng điểm hiện tại trên các phần đã làm. */
  last: number;
  date: string;
  parts: LabParts;
}

export interface LabTestRecord {
  date: string;
  score: number;
  total: number;
  minutes: number;
  level?: LabLevel;
  /** Tự chấm câu nói, 0..1 (không cộng vào `score`). */
  speak?: number | null;
}

export interface LabStore {
  version: 1;
  lessons: Record<string, LabLessonRecord>;
  tests: LabTestRecord[];
}

export const LAB_STORE_KEY = "listening-lab-v1";
const MAX_TESTS = 50;

export function emptyLabStore(): LabStore {
  return { version: 1, lessons: {}, tests: [] };
}

export function parseLabStore(raw: string | null): LabStore {
  if (!raw) return emptyLabStore();
  try {
    const parsed = JSON.parse(raw) as Partial<LabStore> | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.lessons !== "object" || parsed.lessons === null) return emptyLabStore();
    return { version: 1, lessons: parsed.lessons, tests: Array.isArray(parsed.tests) ? parsed.tests.slice(0, MAX_TESTS) : [] };
  } catch {
    return emptyLabStore();
  }
}

export function isComplete(parts: LabParts): boolean {
  return parts.listen !== null && parts.read !== null && parts.write !== null && parts.speak !== null;
}

/** Ghi kết quả một bài (trả bản mới, không sửa bản cũ). */
export function withLessonResult(store: LabStore, id: string, parts: LabParts, date: string): LabStore {
  const total = labTotal(parts) ?? 0;
  const before = store.lessons[id];
  const best = Math.max(before?.best ?? 0, isComplete(parts) ? total : 0);
  return { ...store, lessons: { ...store.lessons, [id]: { best, last: total, date, parts } } };
}

export function withTestResult(store: LabStore, record: LabTestRecord): LabStore {
  return { ...store, tests: [record, ...store.tests].slice(0, MAX_TESTS) };
}

/** Bài nên học tiếp: bài đầu tiên (Dễ → Khó) chưa làm đủ 4 phần; hết thì bài điểm thấp nhất. */
export function nextLabLesson(store: LabStore): LabLesson {
  const open = LESSONS.find((lesson) => !store.lessons[lesson.id] || !isComplete(store.lessons[lesson.id].parts));
  if (open) return open;
  return [...LESSONS].sort((a, b) => store.lessons[a.id].best - store.lessons[b.id].best)[0];
}
