import type { ReactNode } from 'react';
import { cx } from './ui';

export type Page = 'overview' | 'sessions' | 'comments' | 'quality';

const NAV: { id: Page; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z" /> },
  { id: 'sessions', label: 'Session Explorer', icon: <path d="M8 2h9a2 2 0 0 1 2 2v12M5 6h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /> },
  { id: 'comments', label: 'Comments', icon: <path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z" /> },
  { id: 'quality', label: 'Data Quality', icon: <path d="M3 3h18v18H3zM3 9h18M9 21V9" /> },
];

export function Sidebar({ page, onNav }: { page: Page; onNav: (p: Page) => void }) {
  return (
    <aside className="flex shrink-0 flex-col border-slate-200 bg-white md:w-[180px] md:border-r dark:border-slate-800 dark:bg-slate-950">
      <div className="px-4 pb-4 pt-4 md:pt-5">
        <div className="text-xl font-bold tracking-tight text-ink dark:text-white">988 Insights</div>
        <div className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">Training Feedback<br className="hidden md:block" /> Platform</div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-2 md:pb-0" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.id} type="button" onClick={() => onNav(n.id)} aria-current={page === n.id ? 'page' : undefined}
            className={cx('flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[13px] transition-colors',
              page === n.id ? 'bg-brand-50 font-medium text-brand-600 dark:bg-brand-600/15 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900')}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{n.icon}</svg>
            {n.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function TopBar() {
  return (
    <header className="flex h-[52px] items-center border-b border-slate-200 px-4 md:px-6">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-600">EveryMind</span>
    </header>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-white">{title}</h1>
      <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}