import { useNavigate } from 'react-router-dom';

/** A titled block within a legal page. */
export function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-pixel theme-text text-lg font-bold mb-3">{title}</h2>
      <div className="theme-text-soft text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

/** Shared shell for the privacy policy and terms of service. */
export default function LegalPage({ title, updated, children }) {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-pixel theme-text text-3xl font-bold">{title}</h1>
        <p className="theme-text-muted text-sm mt-2">Last updated {updated}</p>
        {children}
        <button
          onClick={() => navigate('/')}
          className="mt-10 font-pixel px-4 py-2 border border-slate-700 theme-text-soft text-sm font-bold transition-colors hover:border-amber-500/60 hover:bg-slate-800"
        >
          ← Back to typingSeal
        </button>
      </div>
    </div>
  );
}
