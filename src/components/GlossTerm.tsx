"use client";

import { useId, useState, type ReactNode } from "react";

/** A bold study word: hover, focus or tap shows its part of speech and meaning; Escape hides it. */
export function GlossTerm({ children, pos, ipa, meaning }: { children: ReactNode; pos: string; ipa?: string; meaning: string }) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  return (
    <span className="gloss" data-dismissed={dismissed || undefined} onMouseLeave={() => setDismissed(false)}>
      <button
        type="button"
        className="gloss__term"
        aria-describedby={id}
        onFocus={() => setDismissed(false)}
        onKeyDown={(event) => { if (event.key === "Escape") setDismissed(true); }}
      >
        <strong>{children}</strong>
      </button>
      <span role="tooltip" id={id} className="gloss__tip" lang="vi">
        <span className="gloss__pos">{pos}{ipa && ` · ${ipa}`}</span> {meaning}
      </span>
    </span>
  );
}
