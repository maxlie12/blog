const clean = (block: string) => block
  .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, "") // a citation in brackets is noise when read aloud
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/[*`]/g, "")
  .replace(/\s+/g, " ")
  .trim();

/** The article's prose paragraphs, without headings, lists, notes or the source list. */
export function articleParagraphs(mdx: string): string[] {
  return mdx
    .split(/^## Sources\s*$/m)[0]
    .split(/\r?\n\s*\r?\n/)
    .filter((block) => !/^\s*(#|>|-|\d+\.)/.test(block))
    .map(clean)
    .filter((paragraph) => paragraph.split(" ").length >= 12);
}

const normalize = (word: string) => word.toLowerCase().replace(/’/g, "'").replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

/** Marks each target word found, in order, in the spoken text (longest common subsequence). */
export function compareReading(target: string, spoken: string): { text: string; matched: boolean }[] {
  const words = target.split(/\s+/).filter(Boolean);
  const a = words.map(normalize);
  const b = spoken.split(/\s+/).map(normalize).filter(Boolean);
  const best = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      best[i][j] = a[i] === b[j] ? best[i + 1][j + 1] + 1 : Math.max(best[i + 1][j], best[i][j + 1]);
    }
  }
  const result = words.map((text) => ({ text, matched: false }));
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) { result[i].matched = true; i++; j++; }
    else if (best[i + 1][j] >= best[i][j + 1]) i++;
    else j++;
  }
  return result;
}
