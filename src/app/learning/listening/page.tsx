import type { Metadata } from "next";
import Link from "next/link";
import { LabIndex } from "@/components/listening/LabIndex";

export const metadata: Metadata = { title: "Phòng nghe English" };

export default function ListeningLabPage() {
  return (
    <div className="learning-page ll-page">
      <Link href="/learning" className="lesson-detail__back">← Về Learning</Link>
      <header className="section-page__header">
        <h1>Phòng nghe English</h1>
        <p>Bài nghe ngắn chia 3 mức. Mỗi bài luyện đủ 4 kĩ năng trên một trang: nghe, đọc, viết, nói, có chấm điểm và luyện đề.</p>
      </header>
      <LabIndex />
    </div>
  );
}
