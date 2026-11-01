import type { Metadata } from "next";
import Link from "next/link";
import { FreePractice } from "@/components/FreePractice";
import { getAllArticles } from "@/lib/content";
import { articleParagraphs } from "@/lib/studyText";

export const metadata: Metadata = { title: "Tự luyện" };

export default async function FreePracticePage({ searchParams }: { searchParams: Promise<{ topic?: string; mode?: string }> }) {
  const { topic, mode } = await searchParams;
  const topics = getAllArticles().flatMap((article) => article.study
    ? [{ slug: article.slug, title: article.title, words: article.study.words, paragraphs: articleParagraphs(article.content) }]
    : []);

  return (
    <div className="learning-page">
      <Link href="/learning" className="lesson-detail__back">← Về Learning</Link>
      <header className="section-page__header">
        <h1>Tự luyện</h1>
        <p>Cho những hôm không làm được bài chính: ôn từ mới hoặc đọc to một đoạn, dừng lúc nào cũng được. Phần này không tính vào Done hay nhịp học.</p>
      </header>
      {topics.length > 0 ? <FreePractice topics={topics} initialSlug={topic} initialMode={mode} /> : <p>Chưa có bài viết nào có từ vựng để luyện.</p>}
    </div>
  );
}
