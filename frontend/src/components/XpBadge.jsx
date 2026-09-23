import { toRoman } from '../lib/roman';

/**
 * Level badge: the level number sits inside a squared border whose outline
 * fills with the current level's XP progress. Square corners match the pixel
 * theme (every radius is zeroed in tailwind.config.js except spinners).
 *
 * The prestige numeral, when present, is shown to the LEFT of the square.
 *
 * The progress starts at the top-left corner and runs clockwise, which is how
 * an SVG <rect> outline is drawn.
 */
export default function XpBadge({ level, prestige = 0, pct = 0, size = 34, stroke = 3 }) {
  const side = size - stroke;
  const perimeter = 4 * side;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = perimeter * (1 - clamped / 100);

  return (
    <div
      className="flex items-center gap-1 shrink-0"
      title={prestige > 0 ? `Prestige ${toRoman(prestige)} · Level ${level}` : `Level ${level}`}
    >
      {prestige > 0 && (
        <span className="font-pixel text-xs font-bold text-amber-400 leading-none">
          {toRoman(prestige)}
        </span>
      )}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <rect
            x={stroke / 2}
            y={stroke / 2}
            width={side}
            height={side}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-slate-700"
          />
          <rect
            x={stroke / 2}
            y={stroke / 2}
            width={side}
            height={side}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeDasharray={perimeter}
            strokeDashoffset={offset}
            className="text-amber-400 transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center leading-none">
          <span className="text-[11px] font-bold theme-text tabular-nums">{level}</span>
        </div>
      </div>
    </div>
  );
}
