import {
  journeyCheckpoints,
  currentCheckpointId,
  journeyDisclaimer,
  type JourneyCheckpoint,
} from "@/data/journey";

// Fixed layout positions (percent) along a simple ascending path, left-to-right.
const POSITIONS = [
  { x: 12, y: 82 },
  { x: 38, y: 58 },
  { x: 64, y: 34 },
  { x: 88, y: 14 },
];

export function MountainJourney() {
  const points = journeyCheckpoints.map((cp, i) => ({ ...cp, ...POSITIONS[i] }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

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
              r={p.id === currentCheckpointId ? 2.6 : 1.8}
              className={
                p.id === currentCheckpointId ? "journey__dot journey__dot--current" : "journey__dot"
              }
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
            data-current={p.id === currentCheckpointId || undefined}
          >
            <span className="journey__label-level">{p.label}</span>
            <span className="journey__label-title">{p.title}</span>
            {p.id === currentCheckpointId && (
              <span className="journey__here">You are here</span>
            )}
            {p.optional && <span className="journey__optional">Optional</span>}
          </li>
        ))}
      </ul>

      <figcaption className="journey__disclaimer">{journeyDisclaimer}</figcaption>
    </figure>
  );
}

export type { JourneyCheckpoint };
