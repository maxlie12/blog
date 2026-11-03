import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getArticleBySlug, type Article } from "@/lib/content";

export const metadata: Metadata = {
  title: "Nghỉ dưỡng & vui chơi",
  description: "Góc thư giãn: xây Làng Rêu trên đảo bay, chăm nông trại, đọc vài bài về game ấm cúng.",
};

const GAMES = [
  {
    href: "/learning/village",
    title: "Làng Rêu",
    image: { src: "/images/play-village.jpg", width: 960, height: 565 },
    text: "Vẽ đường, xây tường, đặt nhà trên một hòn đảo bay. Ném bóng, thả thuyền xuống suối, ngắm chó đuổi gà. Học một từ tiếng Anh để mở thêm đồ.",
    facts: ["54 món đồ", "Học từ để mở khóa", "Vật lý và con vật"],
    cta: "Vào Làng Rêu",
  },
  {
    href: "/learning/world",
    title: "Nông trại",
    image: { src: "/images/play-farm.jpg", width: 960, height: 560 },
    text: "Gieo hạt, nuôi cá, chăn gà vịt cừu bò, chế biến ở xưởng rồi chở hàng lên phố bán. Mọi thứ lớn theo thời gian thật, kể cả khi bạn đóng trang.",
    facts: ["Ruộng, ao cá, trang trại", "Chạy theo thời gian thật"],
    cta: "Vào nông trại",
  },
];

/** Cozy-game articles to read while resting; missing ones are skipped. */
const READING = ["why-cozy-games-calm-us-down", "start-with-one-wall", "building-a-stone-house-from-a-line"];

export default function PlayPage() {
  const reading = READING.map(getArticleBySlug).filter((a): a is Article => Boolean(a));

  return (
    <div className="play-page">
      <header className="section-page__header">
        <p className="eyebrow">GÓC THƯ GIÃN</p>
        <h1>Nghỉ dưỡng &amp; vui chơi</h1>
        <p>
          Những lúc cần nghỉ tay: xây một ngôi làng nhỏ, chăm nông trại, hoặc đọc vài bài về game ấm cúng.
          Phần này không tính vào Done, nhịp học hay trình độ, và tiến độ game chỉ lưu trên trình duyệt này.
        </p>
      </header>

      <ul className="play-games">
        {GAMES.map((game, i) => (
          <li key={game.href}>
            <Link href={game.href} className="play-card">
              <Image
                src={game.image.src}
                width={game.image.width}
                height={game.image.height}
                alt=""
                sizes="(min-width: 960px) 540px, 100vw"
                priority={i === 0}
                className="play-card__image"
              />
              <div className="play-card__body">
                <h2>{game.title}</h2>
                <p>{game.text}</p>
                <ul className="play-card__facts">
                  {game.facts.map((fact) => <li key={fact}>{fact}</li>)}
                </ul>
                <span className="button button--primary play-card__cta">{game.cta} →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {reading.length > 0 && (
        <section className="play-reading" aria-labelledby="play-reading-title">
          <h2 id="play-reading-title">Đọc khi nghỉ</h2>
          <ul>
            {reading.map((article) => (
              <li key={article.slug}>
                <Link href={`/blog/${article.slug}`}>
                  <strong>{article.title}</strong>
                  <span>{article.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
