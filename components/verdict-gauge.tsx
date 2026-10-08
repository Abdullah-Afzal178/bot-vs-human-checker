import { styleFor } from "@/lib/verdict-style";
import type { Verdict } from "@/lib/scoring";

const SIZE = 168;
const STROKE = 13;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Three quarters of a circle, so the dial reads as a gauge and not a pie. */
const SWEEP = 0.75;

/** The score as a dial: 0 is a person on the left, 100 is a machine on the right. */
export function VerdictGauge({ score, verdict }: { score: number; verdict: Verdict }) {
  const style = styleFor(verdict);
  const track = CIRCUMFERENCE * SWEEP;
  const filled = track * (score / 100);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-40 w-40 shrink-0"
      role="img"
      aria-label={`Bot score ${score} out of 100: ${style.headline}`}
    >
      {/* Rotated so the gap sits at the bottom. */}
      <g transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${track} ${CIRCUMFERENCE}`}
        />
        <circle
          className="gauge-arc"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={style.stroke}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          style={{ ["--gauge-empty" as string]: `${filled}` }}
          strokeDashoffset={0}
        />
      </g>

      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        className="fill-slate-950 text-[2.6rem] font-semibold tabular-nums"
        style={{ fontSize: "2.6rem" }}
      >
        {score}
      </text>
      <text
        x="50%"
        y="63%"
        textAnchor="middle"
        className="fill-slate-400"
        style={{ fontSize: "0.72rem", letterSpacing: "0.1em" }}
      >
        BOT SCORE
      </text>
    </svg>
  );
}
