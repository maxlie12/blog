import type { Metadata } from "next";
import Link from "next/link";
import { LearningPath } from "@/components/LearningPath";
import { getAllArticles } from "@/lib/content";
import { getDailyPackets } from "@/lib/dailyLessons";
import { orderPractice } from "@/lib/practiceOrder";
import { todayInTz } from "@/lib/streak";

export const metadata: Metadata = { title: "Lộ trình" };
export const dynamic = "force-dynamic";

export default async function LearningPathPage() {
  const date = todayInTz();
  const packet = (await getDailyPackets()).find((item) => item.date === date);
  const today = packet
    ? {
        date,
        title: packet.title,
        // A lesson built on a blog article already has its own stage below.
        lessons: orderPractice(packet.lessons)
          .filter((lesson) => !lesson.material?.startsWith("/blog/"))
          .map(({ id, title, skill, language }) => ({ id, title, skill, language })),
      }
    : null;
  const topics = getAllArticles().reverse().flatMap((article) => article.study
    ? [{ slug: article.slug, title: article.title, lessonId: article.study.lessonId, words: article.study.words.map((word) => word.term) }]
    : []);

  return (
    <div className="learning-page">
      <Link href="/learning" className="lesson-detail__back">← Về Learning</Link>
      <header className="section-page__header">
        <h1>Lộ trình theo chủ đề</h1>
        <p>Bắt đầu từ bài hôm nay, rồi đi tiếp qua các chủ đề blog: đọc, học từ, đọc to và làm bài luyện. Bước nào cũng mở sẵn, và nghỉ một ngày không để lại nợ. Đây là dấu thói quen trên thiết bị này, không phải trình độ.</p>
      </header>
      {today || topics.length > 0 ? <LearningPath topics={topics} today={today} /> : <p>Chưa có bài nào để hiển thị.</p>}
    </div>
  );
}
