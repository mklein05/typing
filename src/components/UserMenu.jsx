import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Subtle user indicator: avatar + name + sign-out dropdown.
 */
export default function UserMenu() {
  const { user, username, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const displayName = username || user.user_metadata?.full_name || user.user_metadata?.name || user.email;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-xs">
          {displayName?.[0]?.toUpperCase() || '?'}
        </div>
        <span className="text-slate-300 text-sm hidden sm:inline max-w-[120px] truncate">
          {displayName}
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]">
            <div className="px-3 py-2 text-sm text-slate-300 border-b border-slate-700 truncate">
              {user.email}
            </div>
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
