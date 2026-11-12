# LEARN-017 — Phòng nói: luyện nói theo tình huống để chắc chắn nói được

## Identity

- **Issue:** `LEARN-017` (owner request, 2026-11-12: làm sao để chắc chắn nói được; thêm tình
  huống để nói, các phương pháp theo tâm lý học và các trường hợp khác nhau)
- **Status:** done locally; deploy below
- **Owner:** Claude
- **Date:** 2026-11-12
- **Builds on:** `LEARN-015-listening-lab.md` (Phòng nghe), `SpeakingRecorder` (ghi âm tại máy)

## User-visible problem

Phần nói trong Phòng nghe chỉ là nói theo một câu rồi tự chấm; không có tình huống thật, không
luyện nhớ lại hay phản xạ, không có tiêu chí "nói được", không có lịch ôn.

## Completion evidence

- `/learning/speaking`: 9 tình huống (3 mỗi mức), mỗi tình huống 2 trường hợp (bình thường và có
  trục trặc: món hết, người nói nhanh, bị từ chối, bị hỏi điều không biết…), mỗi trường hợp 4
  lượt và một kế hoạch "nếu… thì nói…". 7 câu cứu nguy dùng chung.
- Mỗi tình huống 5 bước: **Câu khung** (nghe + nói đuổi 3 lần) → **Nhớ lại** (nhìn tiếng Việt,
  nói tiếng Anh, câu chưa nhớ quay lại cuối hàng; điểm theo lần thử đầu) → **Nhập vai** (máy đọc
  lời người kia, chữ ẩn trước, đếm ngược 10 giây, xem câu mẫu, tự chấm 3 mức) → **Nói liền
  4/3/2** (60 → 45 → 30 giây) → **Kết quả**.
- Tiêu chí "Nói được": nhớ lại ≥ 80% câu khung và ≥ 80% lượt nói được ngay ở cả hai trường hợp.
  Lịch ôn giãn cách: cần luyện +1 ngày, gần được +3, nói được +7 rồi gấp đôi (tối đa 30). Danh
  sách hiện mục "Đến hạn ôn" và gợi ý tình huống nên luyện.
- Lưu trên máy theo hồ sơ (`speaking-room-v1`); "Lưu & Done" ghi Done mỗi ngày luyện qua
  `recordLocalCompletion`. Bản ghi âm không lưu, không gửi đi.
- Phòng nghe: nút "Che câu" ở bước Nói để nói lại không nhìn; link sang Phòng nói từ thẻ
  /learning, trang danh sách và kết quả bài.

## Method basis (shown in plain words on the page)

Formulaic chunks and shadowing; retrieval practice / testing effect (Roediger & Karpicke 2006);
interleaving and desirable difficulties (Bjork); 4/3/2 fluency task (Nation 1989); spacing effect
(Cepeda et al. 2006); implementation intentions "if… then…" (Gollwitzer 1999); foreign language
anxiety (Horwitz, Horwitz & Cope 1986) — private rehearsal and rescue phrases.

## Scope

### May edit

- new `src/lib/speakingRoom.ts` (+ `src/lib/speakingRoom.test.ts`), new
  `src/components/listening/SpeakRoom.tsx`, new pages `src/app/learning/speaking/*`
- `src/components/listening/labShared.tsx` (che câu), `LabIndex.tsx`, `LabLesson.tsx` (links),
  `src/app/globals.css` (khối `sr-`), `docs/STATUS.md`, this brief

### Must not edit

- Done/streak logic, `localLearningProgress.ts`, Daily, conversation pilot, Studio, games.

## Constraints

- No AI grading, no upload, no new dependency. Self-rating is practice evidence, not a level.
- 44 px targets, keyboard, labels; timers are text only (no motion).

## Verification

- [x] `npm test`: `speakingRoom.test.ts` 4 pass (dữ liệu đủ; tiêu chí nói được; lịch ôn 1/3/7,
      gấp đôi, tối đa 30; lưu, đến hạn, gợi ý, lưu lại cùng ngày không nhân đôi khoảng ôn).
      ESLint, `tsc` sạch ở file mới.
- [x] Trình duyệt 390 px (giọng đọc giả lập): Phòng nói 25/25 — 9 tình huống, 7 câu cứu nguy;
      nghe tất cả câu khung; nhớ lại với câu chưa nhớ quay lại, điểm 83%; nhập vai ẩn chữ, đếm
      ngược, câu mẫu, 100% và 88%; 4/3/2 đủ 3 lượt; "Nói được", lịch ôn +7 ngày, Done; tải lại
      giữ buổi hôm nay; danh sách cập nhật; che câu ở Phòng nghe; không cuộn ngang, nút ≥ 44 px.
      Phòng nghe chạy lại 47/47.
- [ ] Vercel build + production deploy.

## Result

- **Not checked / remaining risk:** micro và giọng đọc trên điện thoại thật; tự chấm có thể dễ
  dãi — tiêu chí chỉ đáng tin khi trả lời trung thực "Nói được ngay" là không nhìn câu mẫu.
