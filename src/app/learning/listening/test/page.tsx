import type { Metadata } from "next";
import Link from "next/link";
import { LabTest } from "@/components/listening/LabTest";
import { LEVELS } from "@/lib/listeningLab";
import { dateInLearningTimezone } from "@/lib/localLearningProgress";

export const metadata: Metadata = { title: "Luyện đề · Phòng nghe" };

export default async function ListeningTestPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const { level: raw } = await searchParams;
  const level = LEVELS.find((item) => item.id === raw);
  const date = dateInLearningTimezone();
  return (
    <div className="learning-page ll-page">
      <Link href="/learning/listening" className="lesson-detail__back">← Phòng nghe</Link>
      <header className="section-page__header">
        <h1>Luyện đề{level ? ` · mức ${level.name}` : " tổng hợp"}</h1>
        <p>Đề {date}: nghe, đọc, chính tả và nói, lấy từ các bài {level ? `mức ${level.name}` : "của cả 3 mức"}.</p>
        <nav className="ll-actions" aria-label="Chọn mức đề">
          {[undefined, ...LEVELS].map((item) => (
            <Link key={item?.id ?? "all"} className="ll-chip" aria-current={item?.id === level?.id ? "page" : undefined}
              href={item ? `/learning/listening/test?level=${item.id}` : "/learning/listening/test"}>
              {item ? item.name : "Tổng hợp"}
            </Link>
          ))}
        </nav>
      </header>
      <LabTest key={level?.id ?? "all"} date={date} level={level?.id} levelName={level ? `mức ${level.name}` : "tổng hợp"} />
    </div>
  );
}
