import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toRoman } from '../lib/roman';
import XpBadge from './XpBadge';
import ConfirmDialog from './ConfirmDialog';

/**
 * User profile button — also acts as the entry point to the Dashboard.
 * Highlighted while on /dashboard. Dropdown holds level/XP, the Prestige button
 * when eligible, Dashboard, and sign-out.
 */
export default function UserMenu({ entitlements, profile, onPrestige }) {
  const { user, username, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [prestigeOpen, setPrestigeOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const displayName = username || user.user_metadata?.full_name || user.user_metadata?.name || user.email;
  const onDashboard = location.pathname === '/dashboard';
  const quota = entitlements?.usage?.llm_practice;
  const isPremium = entitlements?.premium === true;

  const level = profile?.level ?? null;
  const prestige = profile?.prestige ?? 0;
  const xpForNext = profile?.xp_for_next_level ?? null;
  const xpIntoLevel = profile?.xp_into_level ?? 0;
  const xpPct = xpForNext ? Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100)) : 100;

  function handlePrestige() {
    // Close the dropdown, then confirm in the themed dialog — window.confirm
    // looks nothing like the rest of the site.
    setOpen(false);
    setPrestigeOpen(true);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        title={onDashboard ? 'Account — dashboard' : 'Account'}
        className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg border transition-colors ${
          onDashboard
            ? 'border-amber-500 bg-slate-700/70'
            : 'border-slate-700 hover:border-amber-500/60 hover:bg-slate-800'
        }`}
      >
        {profile ? (
          <XpBadge level={level} prestige={prestige} pct={xpPct} />
        ) : (
          // Fallback until the profile loads (and for any error): the initial.
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
              onDashboard ? 'bg-amber-500 text-slate-900' : 'theme-accent'
            }`}
          >
            {displayName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <span
          className={`text-sm hidden sm:inline max-w-[120px] truncate transition-colors ${
            onDashboard ? 'text-amber-400' : 'theme-text-soft'
          }`}
        >
          {displayName}
        </span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''} ${
            onDashboard ? 'text-amber-400' : 'theme-text-subtle'
          }`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[200px]">
            <div className="px-3 py-2 text-sm text-slate-300 border-b border-slate-700 truncate">
              {user.email}
            </div>

            {profile && (
              <div className="px-3 py-2 border-b border-slate-700">
                <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                  <span className="text-slate-300 font-bold">
                    {prestige > 0 ? `${toRoman(prestige)} · ` : ''}Level {level}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {xpForNext == null ? 'Max' : `${xpIntoLevel}/${xpForNext} XP`}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full theme-accent transition-all duration-500"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
                {profile.lifetime_xp > 0 && (
                  <div className="text-[10px] text-slate-500 mt-1.5">
                    {profile.lifetime_xp.toLocaleString()} lifetime XP
                  </div>
                )}
              </div>
            )}

            {/* Hidden until loaded, so a premium user never sees "Free plan" flash. */}
            {entitlements && (
              <div
                className="px-3 py-2 border-b border-slate-700"
                title={
                  quota?.resets_at
                    ? `Resets ${new Date(quota.resets_at).toUTCString()}`
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className={isPremium ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                    {isPremium ? 'Premium' : 'Free plan'}
                  </span>
                  {quota && !isPremium && (
                    <span className="text-slate-500">
                      {quota.remaining}/{quota.limit} today
                    </span>
                  )}
                </div>
              </div>
            )}

            {profile?.can_prestige && (
              <button
                onClick={handlePrestige}
                className="w-full text-left px-3 py-2 text-sm font-bold text-amber-400 hover:bg-slate-700 transition-colors"
              >
                Prestige to {toRoman(prestige + 1)}
              </button>
            )}

            <button
              onClick={() => {
                setOpen(false);
                navigate('/dashboard');
              }}
              className={`w-full text-left px-3 py-2 text-sm font-bold transition-colors ${
                onDashboard
                  ? 'text-amber-400'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={prestigeOpen}
        title="Prestige?"
        message={`This resets you to level 1 and discards the XP earned at level 100. You'll be Prestige ${toRoman(prestige + 1)}.`}
        confirmLabel={`Prestige to ${toRoman(prestige + 1)}`}
        cancelLabel="Not yet"
        onConfirm={() => {
          setPrestigeOpen(false);
          onPrestige?.();
        }}
        onCancel={() => setPrestigeOpen(false)}
      />
    </div>
  );
}
