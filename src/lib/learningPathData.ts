import { getAllArticles } from "@/lib/content";
import { getDailyPackets } from "@/lib/dailyLessons";
import { orderPractice } from "@/lib/practiceOrder";
import { todayInTz } from "@/lib/streak";

export async function getLearningPathData() {
  const date = todayInTz();
  const packets = (await getDailyPackets()).filter((packet) => packet.date <= date);
  const packet = packets.find((item) => item.date === date);
  const today = packet
    ? {
        date,
        title: packet.title,
        // A lesson built on a blog article already has its own stage.
        lessons: orderPractice(packet.lessons)
          .filter((lesson) => !lesson.material?.startsWith("/blog/"))
          .map(({ id, title, skill, language }) => ({ id, title, skill, language })),
      }
    : null;
  const lessons = packets.toReversed().flatMap((item) => item.lessons.map(({ id, title, skill, language }) => (
    { id, title, skill, language, date: item.date }
  )));
  const topics = getAllArticles().reverse().flatMap((article) => article.study
    ? [{ slug: article.slug, title: article.title, lessonId: article.study.lessonId, words: article.study.words.map((word) => word.term) }]
    : []);
  return { today, lessons, topics };
}
