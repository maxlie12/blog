import Link from "next/link";
import { notFound } from "next/navigation";
import { getDailyPackets } from "@/lib/dailyLessons";
import { getAllLessons, SKILLS } from "@/lib/lessonsData";
import { todayInTz } from "@/lib/streak";
import { hasStudioSession } from "@/lib/studioSession";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily practice" };

export default async function DailyPage({ searchParams }: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = todayInTz();
  const [packets, lessons, signedIn, query] = await Promise.all([
    getDailyPackets(), getAllLessons(), hasStudioSession(), searchParams,
  ]);
  const available = packets.filter((p) => p.date <= today);
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const unfinished = available.find((p) => p.lessons.some((l) =>
    l.language === "en" && (byId.get(l.id)?.reviewedCount ?? 0) === 0));
  const selected = query.date ? available.find((p) => p.date === query.date) : unfinished ?? available.at(-1);
  if (query.date && !selected) notFound();
  return <article className="lesson-detail">
    <Link href="/learning">← Learning</Link>
    <header className="lesson-detail__header">
      <h1>Bài học mỗi ngày</h1>
      <p>Học lúc rảnh. Bắt đầu một phiên 5 phút, rồi quay lại bước tiếp theo.</p>
      <p>Nghe · Nói · Đọc · Viết — tiếng Anh chính, tiếng Trung phụ.</p>
    </header>
    {!signedIn && <p><Link href="/studio/login">Đăng nhập</Link> để nộp bài và xem tiến độ của bạn.</p>}
    {selected ? <>
      <section className="lesson-detail__section">
        <span className="tag">{selected.date}</span><h2>{selected.title}</h2>
        <p>{selected.note}</p>
        {selected.date !== today && <p>Tiếp tục gói này trước khi chuyển bài. Bài chưa làm không được tính hoàn thành.</p>}
      </section>
      <div className="daily-lessons-grid">
        {selected.lessons.map((l) => {
          const progress = byId.get(l.id);
          return <section key={l.id} className="lesson-detail__section">
            <span className="tag">{l.language === "en" ? "English" : "中文"} · {SKILLS.find((s) => s.id === l.skill)?.label}</span>
            <h2>{l.title}</h2><p>{l.instructions}</p>
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
