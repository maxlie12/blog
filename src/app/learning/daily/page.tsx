import Link from "next/link";
import { notFound } from "next/navigation";
import { getDailyPackets } from "@/lib/dailyLessons";
import { todayInTz } from "@/lib/streak";
import { DailyLessonLibrary } from "@/components/DailyLessonLibrary";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily · Bài học theo ngày" };

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const [packets, query] = await Promise.all([getDailyPackets(), searchParams]);
  const available = packets.filter(p => p.date <= todayInTz());
  if (query.date && !available.some(p => p.date === query.date)) notFound();
  return <article className="lesson-detail">
    <Link href="/learning">← Quay lại Learning và lộ trình</Link>
    <header className="lesson-detail__header"><h1>Bài học mỗi ngày</h1><p>Học ngay dưới dạng khách. Chọn theo ngày hoặc từng bài; mở đúng bài để xem nguồn, làm và lưu đầu ra.</p></header>
    {available.length ? <DailyLessonLibrary key={query.date ?? "auto"} packets={available} initialDate={query.date} /> : <p>Chưa có gói bài đã xuất bản.</p>}
    <p><Link href="/learning/session">Phiên 7 bước Digital detox cũ và lịch sử phiên →</Link></p>
  </article>;
}
