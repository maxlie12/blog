# LEARN-018 — Thẻ "Tiếp tục từ việc quan trọng nhất" rõ ràng + Phiếu học hôm nay cho ChatGPT

## Identity

- **Issue:** `LEARN-018` (owner request, 2026-11-12: bên trong thẻ "Tiếp tục từ việc quan trọng
  nhất" chưa rõ ràng; muốn luồng để ChatGPT đọc và cập nhật mỗi ngày. Owner chốt qua câu hỏi:
  phiếu yêu cầu ChatGPT huấn luyện + giao kế hoạch, không soạn JSON)
- **Status:** PR open; release after CI + preview
- **Owner:** Claude
- **Date:** 2026-11-12
- **Builds on:** `LEARN-015-listening-lab.md`, `LEARN-017-speaking-room.md`

## User-visible problem

Bên trong thẻ StartLearning dồn 6–7 dòng chữ nhỏ (trạng thái, lý do, mục tiêu, mốc ôn) không
theo thứ tự đọc; không có cách nào đưa tiến độ sang ChatGPT để được nhận xét và giao bài mỗi
ngày (app không được nhúng AI).

## Completion evidence

- Thẻ StartLearning đọc theo một mạch: tên bài + một dòng thông tin (ngôn ngữ · trình độ · kỹ
  năng · nguồn) + một câu lý do; "Mục tiêu bài" và mốc ôn thu vào `<details>`. Nút hành động
  giữ nguyên logic chọn bài.
- "Phiếu học hôm nay": một nút sao chép phiếu văn bản gồm streak và số bài Done tiếng Anh, số
  bài ôn Daily đến hạn, tiến độ Phòng nghe (số bài xong, điểm trung bình từng phần, phần yếu
  nhất, bài và đề gần nhất), tiến độ Phòng nói (đếm theo mức sẵn sàng, đến hạn ôn, nên luyện
  tiếp) — kèm phần "VIỆC CỦA BẠN (ChatGPT)": nhận xét mạnh/yếu, giao kế hoạch 20–30 phút theo
  các mục của app, ra 5 câu kiểm tra nhanh, chữa bài viết/bản chép lời dán kèm. Có ô xem trước.
- Phiếu chỉ chứa số liệu luyện tập; không tên thật, không email, không bài làm (trừ phần người
  học tự dán thêm). Dữ liệu đọc tại chỗ từ localStorage, không gửi đi đâu.
- Luồng mỗi ngày (owner, 16:20: "tạo các luồng để ChatGPT đọc và update mỗi ngày"): (1) một lần —
  sao chép "Hướng dẫn cho ChatGPT" dán vào Project/Instructions; (2) mỗi ngày — sao chép phiếu,
  dán vào ChatGPT; (3) dán kế hoạch ChatGPT trả về vào ô "Kế hoạch hôm nay" → lưu tại máy, hiện
  ngay trên trang; phiếu ngày sau kèm "Kế hoạch lần trước" để ChatGPT so và cập nhật kế hoạch.

## Acceptance (BA)

- **Start:** Given /learning, when progress loads, then the card shows a status label (Đang làm
  dở / Đến hạn ôn / Bài mới / Ôn lại — text, not colour only), the lesson title, one meta line
  (ngôn ngữ · trình độ · kỹ năng tiếng Việt · Daily ngày/chủ đề) and one reason sentence; goal,
  review date and the Done note sit in "Bài này gồm gì?". Buttons and lesson choice unchanged.
- **Copy brief:** when "Sao chép phiếu hôm nay" is pressed, the clipboard gets the brief (date,
  7-day activity by skill, streak/total Done, Daily due + next, Phòng nghe, Phòng nói, previous
  plan if any, the 4 tasks). If the clipboard is refused, the preview opens with the text
  selected and a message says to copy by hand. The same for "Sao chép hướng dẫn cho ChatGPT".
- **Save plan:** when a pasted plan is saved, it shows as "Kế hoạch hôm nay (từ ChatGPT)" and
  survives reload; saving again the same day replaces it; "Xoá" removes it. Saved per profile in
  this browser only (`chatgpt-plan-v1`, last 7 days, ≤ 4000 chars each), not synced, not sent.
  Storage refusal shows an error and keeps the text in the box.
- **Next day:** the brief carries the latest plan dated before today, cut to 1200 chars.
- **Credit:** nothing here records Done; ChatGPT feedback is outside advice, not assessment.

## Release path (seven-stage contract)

Branch `claude/learn-018-chatgpt-brief` → PR → CI (`Max Learning quality gates`: build + mobile
smoke Chromium/WebKit) → Vercel preview → merge to `master`. Rollback: revert the merge commit
(previous production `5e9cdc9`).

## Scope

### May edit

- new `src/lib/studyBrief.ts` (+ `src/lib/studyBrief.test.ts`): gom số liệu thuần → văn bản phiếu
- new `src/components/StudyBrief.tsx`: đọc store tại máy, nút sao chép, xem trước
- `src/components/StartLearning.tsx` (sắp xếp lại nội dung trong thẻ, thêm StudyBrief),
  `src/app/globals.css` (khối `sb-` + chữ trong thẻ `learning-start`), `docs/STATUS.md`, brief này
- `scripts/learning-mobile-smoke.mjs`: thêm một kiểm tra CI cho luồng phiếu/kế hoạch (lý do: hợp
  đồng giao hàng yêu cầu E2E cho luồng mới; script là cổng CI hiện có)

### Must not edit

- Logic chọn bài (`nextLesson.ts`), Done/streak, Phòng nghe/nói, Daily, Studio, games.

## Constraints

- Không AI trong app, không dependency mới, không gửi dữ liệu đi đâu; sao chép là hành động của
  người học. 44 px, bàn phím, nhãn rõ; phiếu ghi rõ điểm là tự luyện.

## Verification

- [x] `npm test`: `studyBrief.test.ts` 6 pass (phần yếu nhất; phiếu đủ mục, kèm kế hoạch lần trước,
      không tên/email; chưa có dữ liệu thì ghi "chưa có"; tóm tắt đọc đúng store Phòng nghe/nói;
      kế hoạch: mỗi ngày một bản, giữ 7 ngày, cắt 4000 ký tự, xoá được, dữ liệu hỏng đọc rỗng,
      phiếu cắt kế hoạch cũ ở 1200 ký tự; hướng dẫn ChatGPT nêu đúng các mục và cấm suy CEFR).
      Toàn bộ 149 pass; 2 lỗi có sẵn cần `@neondatabase/serverless` (không cài ở máy này).
      ESLint, `tsc` sạch ở file đổi.
- [x] Trình duyệt (harness Chromium, giọng/clipboard giả lập) 26/26: 390 px — nhãn trạng thái,
      một dòng thông tin, chi tiết thu gọn; sao chép phiếu (số liệu Phòng nghe, Daily tiếp theo,
      kế hoạch hôm qua, không tên hồ sơ); sao chép hướng dẫn; lưu kế hoạch → tải lại vẫn còn →
      sửa → xoá. 320 px — clipboard bị chặn: mở ô xem trước, chọn sẵn đúng đoạn, báo cách sao
      chép tay. Cả hai: không cuộn ngang, không tràn khung, nút ≥ 44 px, không lỗi trang.
- [x] CI smoke (`scripts/learning-mobile-smoke.mjs`): thêm `studyBriefFlow` (Chromium + WebKit,
      320 px, bản build thật).
- QA: thực hiện tuần tự bởi cùng một agent (không có reviewer độc lập); iPhone thật / Safari
      clipboard: NOT VERIFIED.

## Result

- **Files changed:** `src/lib/studyBrief.ts` (+ test), `src/components/StudyBrief.tsx`,
  `src/components/StartLearning.tsx`, `src/app/globals.css`, `scripts/learning-mobile-smoke.mjs`,
  `docs/STATUS.md`, this brief.
- **Found while checking:** danh sách bước mất số thứ tự (li dạng grid) và ô dán kế hoạch tràn
  khung ở 320–390 px: đã đánh số bằng CSS counter và giới hạn chiều rộng ô.
- **Not checked / remaining risk:** clipboard trên iPhone thật; ChatGPT có làm đúng định dạng
  "danh sách đánh số" hay không là ngoài app — người học dán bất kỳ chữ nào cũng lưu được.
