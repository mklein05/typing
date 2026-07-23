/**
 * PracticeBanner — shown above the typing test in practice mode.
 * Displays the targeted weak bigrams as pill tags and an explanation.
 */
export default function PracticeBanner({ targetedBigrams }) {
  if (!targetedBigrams || targetedBigrams.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mb-6 bg-slate-800 border-l-4 border-amber-500 rounded-lg px-5 py-4">
      <p className="text-amber-400 font-bold text-sm mb-2">
        🎯 Practising Your Weaknesses
      </p>
      <div className="flex flex-wrap gap-2 mb-2">
        {targetedBigrams.map((bg) => (
          <span
            key={bg.bigram}
            className="inline-flex items-center bg-slate-700 text-amber-300 rounded-full px-3 py-1 text-xs font-mono"
          >
            {bg.bigram[0]} → {bg.bigram[1]}
            <span className="text-slate-500 ml-1.5">{bg.error_rate}%</span>
          </span>
        ))}
      </div>
      <p className="text-slate-400 text-xs">
        This test contains words targeting the letter combinations you struggle with most.
      </p>
    </div>
  );
}
