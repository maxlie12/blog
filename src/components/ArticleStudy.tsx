import Link from "next/link";
import type { ReactNode } from "react";
import type { MDXComponents } from "next-mdx-remote-client/rsc";
import { GlossTerm } from "@/components/GlossTerm";
import { PronounceButton } from "@/components/PronounceButton";
import type { ArticleStudy, StudyTerm } from "@/lib/content";

const anchor = (term: string) => "word-" + term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function TermList({ items }: { items: StudyTerm[] }) {
  return (
    <ul className="study-aside__list">
      {items.map((item) => (
        <li key={item.term}>
          <strong lang="en">{item.term}{item.pos && <span className="study-pos">{item.pos}</span>}</strong>
          <span>{item.meaning}</span>
          {item.example && <em className="study-listen" lang="en">{item.example}<PronounceButton text={item.example} /></em>}
        </li>
      ))}
    </ul>
  );
}

const normalize = (text: string) => text.toLowerCase().replace(/[.,;:!?]+$/, "").trim();

/** MDX override: a bold run that matches a study term (or one of its `forms`) gets a hover card. */
export function studyComponents(study: ArticleStudy): MDXComponents {
  const glossary = new Map<string, { pos: string; ipa?: string; meaning: string }>();
  const add = (items: StudyTerm[], fallbackPos: string) => {
    for (const item of items) {
      const entry = { pos: item.pos ?? fallbackPos, ipa: item.ipa, meaning: item.meaning };
      for (const key of [item.term, ...(item.forms ?? [])]) glossary.set(normalize(key), entry);
    }
  };
  add(study.words, "từ mới");
  add(study.verbs, "động từ");
  add(study.structures, "cấu trúc");

  return {
    // The reading note above each English article is in Vietnamese.
    blockquote: ({ children }: { children?: ReactNode }) => <blockquote lang="vi">{children}</blockquote>,
    strong: ({ children }: { children?: ReactNode }) => {
      const entry = typeof children === "string" ? glossary.get(normalize(children)) : undefined;
      return entry ? <GlossTerm pos={entry.pos} ipa={entry.ipa} meaning={entry.meaning}>{children}</GlossTerm> : <strong>{children}</strong>;
    },
  };
}

/** Right-hand panel: verbs and structures in full; words as links to the end-of-article list. */
export function StudyAside({ study, slug }: { study: ArticleStudy; slug: string }) {
  return (
    <aside className="study-aside" aria-label="Học tiếng Anh từ bài viết">
      {study.lessonId && (
        <div className="study-aside__practice">
          <p className="eyebrow">LUYỆN VỚI BÀI NÀY</p>
          <p>Một bài đọc 5–10 phút trên Learning dùng lại các từ và cấu trúc dưới đây.</p>
          <Link href={`/learning/${study.lessonId}`} className="button button--primary">Mở bài luyện →</Link>
          <Link href={`/learning/practice?topic=${slug}`} className="study-aside__free">Tự luyện từ mới và đọc to →</Link>
        </div>
      )}
      <section className="study-aside__words">
        <h2>Từ mới · {study.words.length}</h2>
        <ul className="study-aside__chips">
          {study.words.map((word) => (
            <li key={word.term}><a href={`#${anchor(word.term)}`} lang="en">{word.term}</a></li>
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
            <dt>
              <span lang="en">{word.term}{word.pos && <span className="study-pos">{word.pos}</span>}{word.ipa && <span className="study-ipa">{word.ipa}</span>}</span>
              <PronounceButton text={word.term} />
            </dt>
            <dd>{word.meaning}{word.example && <em lang="en">{word.example}</em>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
