# LEARN-015 — Phòng nghe (Listening Lab): English có cấu trúc kiểu ESL Lab, 4 kĩ năng, luyện đề

## Identity

- **Issue:** `LEARN-015` (owner request, 2026-11-11: English hiện tại rối — không hiểu học thế
  nào, không biết lưu ra sao; muốn như ESL Lab: bài nghe rõ ràng để nghe, đọc và làm bài; thêm
  luyện đề/kiểm tra và học đủ 4 kĩ năng. Owner chốt: phòng nghe kiểu ESL Lab, nguồn ưu tiên VOA,
  lưu điểm + Done như hệ hiện tại)
- **Status:** done (deployed `469453b`); real-phone check by owner pending
- **Owner:** Claude
- **Date:** 2026-11-11
- **Builds on:** `docs/DAILY-LEARNING.md`, `docs/MAX-LEARNING-CONTEXT.md`

## User-visible problem

Bài English hiện tại là thẻ chữ dài, phần làm bài là link sang trang ngoài; không có audio ngay
trên trang, không có câu hỏi chấm điểm, không rõ tiến độ lưu ở đâu.

## Completion evidence

- `/learning/listening`: danh sách bài chia 3 mức (Dễ A2 · Vừa B1 · Khó B2), mỗi bài hiện điểm
  và ngày làm gần nhất; có nút Luyện đề.
- Mỗi bài một trang, 6 bước cố định, đi theo thứ tự nhưng xem lại được: **1 Từ vựng → 2 Nghe
  (trắc nghiệm chấm ngay) → 3 Đọc transcript (câu hỏi đọc hiểu) → 4 Viết (chính tả so từng từ +
  viết ngắn theo đề, có bài mẫu và 3 câu tự kiểm tra) → 5 Nói theo (ghi âm tại máy, tự chấm từng
  câu) → 6 Kết quả** (điểm từng phần theo tỉ trọng, tổng, Lưu & Done khi đủ 4 phần). Audio đọc bằng giọng máy en-US của trình duyệt,
  chỉnh được tốc độ; dữ liệu bài có chỗ `audioUrl` để gắn mp3 thật (VOA) sau.
- Luyện đề: theo mức hoặc tổng hợp, đề cố định theo ngày (đổi được), 4 phần làm lần lượt: Nghe
  (không xem lời thoại) → Đọc → Chính tả 2 câu → Nói 1 câu (tự chấm, ghi riêng). Có đồng hồ,
  chấm khi nộp, xem lại lời giải, lịch sử 5 lần gần nhất. Luyện đề không tính Done.
- Kết quả từng bài lưu ngay trên máy (localStorage theo hồ sơ học đang chọn, khoá
  `listening-lab-v1`); nút "Lưu & Done" ghi Done/streak qua `recordLocalCompletion` như các bài
  hiện tại. Không gửi gì lên mạng; bài viết và bản ghi âm không được lưu.
- Trang `/learning` mở đầu bằng thẻ Phòng nghe: một nút "Học tiếp bài N" (bài đầu tiên chưa đủ 4
  phần, Dễ → Khó) và một nút "Tất cả bài · luyện đề"; StartLearning (Daily, tiếng Trung) ở ngay
  dưới. Trang danh sách có mục "Học thế nào" và "Lưu ở đâu".

## Scope

### May edit

- new `src/lib/listeningLab.ts` (+ `src/lib/listeningLab.test.ts`): kiểu dữ liệu, 12 bài tự
  soạn (không chép nguồn có bản quyền), đề viết ngắn + bài mẫu, chấm điểm, so chính tả, dựng
  đề, đọc/ghi kết quả dạng hàm thuần (đọc/ghi localStorage nằm ở component)
- new `src/components/listening/*` (list + thẻ /learning, bài học, đề, phần dùng chung), new
  pages `src/app/learning/listening/*` (danh sách, `[lessonId]`, `test`)
- `src/app/learning/page.tsx` (thẻ Phòng nghe ở đầu, câu giới thiệu), `src/app/globals.css`
  (khối `ll-`)
- `docs/STATUS.md`, brief này

### Must not edit

- Done/streak logic, `localLearningProgress.ts`, Daily/packets, lesson picker, Prisma, Studio,
  games, Làng Rêu.

## Constraints

- Done là tự khai luyện tập, không chứng nhận CEFR; điểm bài nghe cũng vậy (ghi rõ trên trang).
- Không dependency mới; không upload audio/bài làm; ghi âm chỉ ở máy.
- Mobile trước, 44px, bàn phím, nhãn rõ; tiếng Việt cho hướng dẫn, câu hỏi tiếng Anh kiểu ESL.
- VOA bị chặn từ máy build nên chưa nhúng mp3 thật; schema sẵn `audioUrl`/`source` để thêm sau.

## Verification

- [x] `npm test`: `listeningLab.test.ts` 6 pass (dữ liệu bài hợp lệ: id duy nhất, 4 đáp án, đáp
      án và dòng chính tả/nói trong phạm vi, đủ đề viết; tổng điểm theo phần đã làm; chính tả bỏ
      qua hoa/thường, dấu câu, từ thừa; kiểm tra bài viết; đề cố định theo ngày, 2 bài khác nhau
      đúng mức; lưu: điểm cao nhất chỉ tính lần đủ 4 phần, dữ liệu hỏng đọc ra rỗng, bài tiếp
      theo). 134 pass toàn bộ (2 lỗi cần `@neondatabase/serverless`, không cài ở đây). ESLint
      sạch; `tsc` không có lỗi ở file mới.
- [x] Trình duyệt (Chromium, 390 px, giọng đọc giả lập): 41/41 — danh sách 12 bài và thẻ học
      tiếp; cả 6 bước của một bài (nghe cả bài đọc đủ 10 câu, chấm 4/4 và 2/3 có lời giải, chính
      tả đánh dấu đúng từ sai, gợi ý từ vựng khi viết, lưu điểm viết/nói, bảng kết quả, Done);
      tải lại trang quay về Kết quả với điểm cũ; lưu theo hồ sơ; thẻ chuyển sang bài 2; một đề
      trọn 4 phần, chấm, xem lại, lịch sử; không cuộn ngang; mọi nút/ô chọn ≥ 44 px; không lỗi
      trang.
- [x] Vercel build + production deploy (`469453b`).

## Result

- **Files changed:** `src/lib/listeningLab.ts` (+ test), `src/components/listening/labShared.tsx`,
  `LabLesson.tsx`, `LabTest.tsx`, `LabIndex.tsx`, `src/app/learning/listening/page.tsx`,
  `[lessonId]/page.tsx`, `test/page.tsx`, `src/app/learning/page.tsx`, `globals.css`,
  `docs/STATUS.md`.
- **Found while checking:** hàng bước cuộn ngang trên điện thoại giấu mất bước đang làm (bước 6
  nằm ngoài màn hình): giờ tự cuộn tới bước hiện tại.
- **Not checked / remaining risk:** chưa có mp3 VOA thật — máy build không mở được trang VOA, nên
  audio là giọng đọc của trình duyệt (chất lượng tuỳ máy; iPhone/Chrome có giọng en-US tốt).
  Chưa thử giọng thật, micro và chép lời trên điện thoại thật. Điểm Phòng nghe chưa nằm trong
  file sao lưu JSON của tiến độ (Done thì có). Mức Dễ/Vừa/Khó ghi "khoảng A2/B1/B2" là độ khó
  của bài, không phải đánh giá người học.
