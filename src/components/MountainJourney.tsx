import { journeyDisclaimer } from "@/lib/journeyData";
import type { CheckpointWithEvidence } from "@/lib/journeyData";

// Fixed layout positions (percent) along a simple ascending path, left-to-right, for up to 4
// checkpoints. Extra checkpoints beyond 4 fall back to evenly-spaced positions.
const POSITIONS = [
  { x: 12, y: 82 },
  { x: 38, y: 58 },
  { x: 64, y: 34 },
  { x: 88, y: 14 },
];

export function MountainJourney({ checkpoints }: { checkpoints: CheckpointWithEvidence[] }) {
  const points = checkpoints.map((cp, i) => ({
    ...cp,
    ...(POSITIONS[i] ?? { x: (i / Math.max(1, checkpoints.length - 1)) * 100, y: 50 }),
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const current = points.find((p) => p.isCurrent);

  return (
    <figure className="journey" aria-label="Learning journey map">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="journey__svg"
        role="presentation"
      >
        <path d={pathD} className="journey__path" fill="none" />
        {points.map((p) => (
          <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
            <circle
              r={p.isCurrent ? 2.6 : 1.8}
              className={p.isCurrent ? "journey__dot journey__dot--current" : "journey__dot"}
            />
          </g>
        ))}
      </svg>

      <ul className="journey__labels">
        {points.map((p) => (
          <li
            key={p.id}
            className="journey__label"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            data-current={p.isCurrent || undefined}
          >
            <span className="journey__label-level">{p.label}</span>
            <span className="journey__label-title">{p.title}</span>
            {p.isCurrent && <span className="journey__here">You are here</span>}
            {p.optional && <span className="journey__optional">Optional</span>}
          </li>
        ))}
      </ul>

      <figcaption className="journey__disclaimer">
        {journeyDisclaimer}
        {current && current.evidence.length > 0 && (
          <>
            {" "}
            {current.evidence.length} piece{current.evidence.length === 1 ? "" : "s"} of
            self-reported evidence attached to the current checkpoint.
          </>
        )}
      </figcaption>
    </figure>
  );
}
