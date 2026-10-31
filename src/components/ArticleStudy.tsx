import Link from "next/link";
import type { ArticleStudy, StudyTerm } from "@/lib/content";

const anchor = (term: string) => "word-" + term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function TermList({ items }: { items: StudyTerm[] }) {
  return (
    <ul className="study-aside__list">
      {items.map((item) => (
        <li key={item.term}>
          <strong>{item.term}</strong>
          <span>{item.meaning}</span>
          {item.example && <em>{item.example}</em>}
        </li>
      ))}
    </ul>
  );
}

/** Right-hand panel: verbs and structures in full; words as links to the end-of-article list. */
export function StudyAside({ study }: { study: ArticleStudy }) {
  return (
    <aside className="study-aside" aria-label="Học tiếng Anh từ bài viết">
      {study.lessonId && (
        <div className="study-aside__practice">
          <p className="eyebrow">LUYỆN VỚI BÀI NÀY</p>
          <p>Một bài đọc 5–10 phút trên Learning dùng lại các từ và cấu trúc dưới đây.</p>
          <Link href={`/learning/${study.lessonId}`} className="button button--primary">Mở bài luyện →</Link>
        </div>
      )}
      <section className="study-aside__words">
        <h2>Từ mới · {study.words.length}</h2>
        <ul className="study-aside__chips">
          {study.words.map((word) => (
            <li key={word.term}><a href={`#${anchor(word.term)}`}>{word.term}</a></li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Động từ &amp; cụm động từ</h2>
        <TermList items={study.verbs} />
      </section>
      <section>
        <h2>Cấu trúc câu</h2>
        <TermList items={study.structures} />
      </section>
    </aside>
  );
}

/** End-of-article glossary: every bold word with its meaning and an example from the text. */
export function StudyWordList({ study }: { study: ArticleStudy }) {
  return (
    <section className="study-words" aria-labelledby="study-words-title">
      <h2 id="study-words-title">Từ mới cần biết</h2>
      <dl>
        {study.words.map((word) => (
          <div key={word.term} id={anchor(word.term)}>
            <dt>{word.term}</dt>
            <dd>{word.meaning}{word.example && <em>{word.example}</em>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
