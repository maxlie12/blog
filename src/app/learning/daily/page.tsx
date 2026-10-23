import Link from "next/link";
import { orderPractice } from "@/lib/practiceOrder";
import { notFound } from "next/navigation";
import { getDailyPackets } from "@/lib/dailyLessons";
import { getAllLessons, SKILLS } from "@/lib/lessonsData";
import { todayInTz } from "@/lib/streak";
import { hasStudioSession } from "@/lib/studioSession";
import { getLanguageLabel } from "@/lib/languages";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily practice" };

export default async function DailyPage({ searchParams }: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = todayInTz();
  const [packets, studioSession, learnerId, query] = await Promise.all([
    getDailyPackets(), hasStudioSession(), getAuthenticatedLearnerId(), searchParams,
  ]);
  const lessons = await getAllLessons(studioSession ? { includeAll: true } : { learnerId });
  const signedIn = studioSession || Boolean(learnerId);
  const available = packets.filter((p) => p.date <= today);
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const unfinished = available.find((p) => p.lessons.some((l) =>
    l.language === "en" && (byId.get(l.id)?.reviewedCount ?? 0) === 0));
  const selected = query.date ? available.find((p) => p.date === query.date) : unfinished ?? available.at(-1);
  if (query.date && !selected) notFound();
  return <article className="lesson-detail">
    <Link href="/learning">← Quay lại Learning</Link>
    <header className="lesson-detail__header">
      <h1>Bài học mỗi ngày</h1>
      <Link className="button" href="/learning/session">Buổi học 5–10 phút có hướng dẫn →</Link>{" "}
      <Link className="button button--ghost" href="/learning#streak-checkpoints">Streak & mốc bài test →</Link>
      <p>Học lúc rảnh. Bắt đầu một phiên 5 phút, rồi quay lại bước tiếp theo.</p>
      <p>Tiếng Anh: Nghe → Đọc kiểm tra → Nói → Viết. Sau đó tiếng Trung 5 phút.</p>
    </header>
    {!signedIn && (process.env.BLOG_READ_ONLY_PREVIEW === "1"
      ? <p>Mở một bài bên dưới và làm trong 5 phút. Bản viết lưu trên trình duyệt; sau khi tự kiểm tra và luyện lại, bấm Done để ghi streak và đồng bộ metadata. Chỉ gửi câu trả lời hoặc audio về ChatGPT khi muốn nhận phản hồi.</p>
      : <p><Link href="/sign-in">Đăng nhập</Link> để nộp bài và xem tiến độ riêng của bạn.</p>)}
    {selected ? <>
      <section className="lesson-detail__section">
        <span className="tag">{selected.date}</span><h2>{selected.title}</h2>
        <p>{selected.note}</p>
        {selected.date !== today && <p>Tiếp tục gói này trước khi chuyển bài. Bài chưa làm không được tính hoàn thành.</p>}
      </section>
      <section className="lesson-detail__section"><h2>Chia phiên theo thời gian rảnh</h2><p>Chỉ 5 phút: làm một bài hoặc nhớ lại một ý. Có 10 phút: nghe 5 phút rồi đọc kiểm tra 5 phút. Phiên sau: nói trước khi viết. Tiếng Trung ở phiên riêng; bài thêm để tùy chọn. Trước ngủ: nhớ lại một ý trong 60 giây, không học thêm bài dài.</p><p>Ở mỗi bài: tự làm → lưu thời gian và hỗ trợ → mở key → chọn một điểm để luyện lại. Tiêu chí tự kiểm tra chưa phải đánh giá cá nhân.</p></section>
      <div className="daily-lessons-grid">
        {orderPractice(selected.lessons).map((l, index) => {
          const progress = byId.get(l.id);
          return <section key={l.id} className="lesson-detail__section">
            <span className="tag">{getLanguageLabel(l.language, true)} · {SKILLS.find((s) => s.id === l.skill)?.label}</span>
            <h2>{index + 1}. {l.title}</h2><p>{l.instructions}</p>
            {signedIn && <p>{progress?.reviewedCount ? "Đã review" : progress?.attemptCount ? "Đã nộp · chờ review" : "Chưa nộp"}</p>}
            <Link className="button button--ghost" href={`/learning/${l.id}`}>Mở và làm bài →</Link>
          </section>;
        })}
      </div>
    </> : <p>Chưa có gói bài đã xuất bản.</p>}
    <section className="lesson-detail__section">
      <h2>Lịch sử bài học</h2>
      <ul>{[...available].reverse().map((p) => <li key={p.date}>
        <Link href={`/learning/daily?date=${p.date}`}>{p.date} · {p.title}</Link>
      </li>)}</ul>
      <p>Review phản ánh bài đã được sửa; chưa phải chứng nhận CEFR. Ghi âm hiện chỉ phát lại trên thiết bị, chưa tải lên server.</p>
    </section>
  </article>;
}
