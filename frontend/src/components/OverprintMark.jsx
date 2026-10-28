/** Three overlapping "riso ink" circles. Multiply blending makes the overlaps darker, like overprinted ink. */
export default function OverprintMark({ className = '' }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true" role="presentation">
      <g className="drift-a">
        <circle cx="150" cy="165" r="118" fill="#2F3CF0" className="mix-blend-multiply" />
      </g>
      <g className="drift-b">
        <circle cx="255" cy="165" r="118" fill="#FF4F9A" className="mix-blend-multiply" />
      </g>
      <g className="drift-c">
        <circle cx="203" cy="255" r="118" fill="#FFD93D" className="mix-blend-multiply" />
      </g>
    </svg>
  );
}