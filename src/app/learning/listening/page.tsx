import type { Metadata } from "next";
import Link from "next/link";
import { LabIndex } from "@/components/listening/LabIndex";
import { dailySummaries, getDailyLabLessons } from "@/lib/labDaily";

export const metadata: Metadata = { title: "Phòng nghe English" };

export default async function ListeningLabPage() {
  const daily = dailySummaries(await getDailyLabLessons());
  return (
    <div className="learning-page ll-page">
      <Link href="/learning" className="lesson-detail__back">← Về Learning</Link>
      <header className="section-page__header">
        <h1>Phòng nghe English</h1>
        <p>Mỗi ngày một bài mới, cộng 18 bài cố định chia 3 mức. Mỗi bài luyện đủ 4 kĩ năng trên một trang: nghe, đọc, viết, nói, có chấm điểm và luyện đề.</p>
      </header>
      <LabIndex daily={daily} />
    </div>
  );
}
