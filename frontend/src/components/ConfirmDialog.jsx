import { useEffect, useRef } from 'react';

/**
 * Themed confirmation dialog, used in place of window.confirm (which cannot be
 * styled and looks nothing like the rest of the site). Squared corners, pixel
 * font and the gold accent all come from the shared theme classes.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    confirmRef.current?.focus();
    function handleKey(event) {
      if (event.key === 'Escape') onCancel?.();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm theme-panel border border-slate-700 p-6 shadow-xl"
      >
        <h2 className="font-pixel theme-text text-lg font-bold mb-3">{title}</h2>
        <p className="theme-text-soft text-sm leading-relaxed mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="font-pixel px-4 py-2 border border-slate-700 theme-text-soft text-sm font-bold transition-colors hover:border-amber-500/60 hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={onConfirm}
            className="font-pixel px-4 py-2 bg-amber-500 text-slate-900 text-sm font-bold transition-colors hover:bg-amber-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
