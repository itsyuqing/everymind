import { useEffect, useMemo, useState } from 'react';
import { FilterPanel } from './components/FilterPanel';
import { PageHeader, Sidebar, TopBar, type Page } from './components/Layout';
import { ROWS } from './lib/data';
import { applyFilters, defaultFilters, type Filters } from './lib/metrics';
import { Comments, Quality } from './pages/Other';
import { Overview } from './pages/Overview';
import { SessionExplorer } from './pages/SessionExplorer';

const HEADERS: Record<Page, [string, string]> = {
  overview: ['Overview', 'What participants learned, how the training landed, and where results differ.'],
  sessions: ['Session Explorer', 'Browse and compare individual training sessions across Maryland.'],
  comments: ['Comment Themes', 'What participants valued, and what they still want to know.'],
  quality: ['Data Quality', 'How the survey data was cleaned, and what it can and cannot tell us.'],
};

const pageFromHash = (): Page => {
  const h = window.location.hash.slice(1) as Page;
  return (['overview', 'sessions', 'comments', 'quality'] as Page[]).includes(h) ? h : 'sessions';
};

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [search, setSearch] = useState('');

  useEffect(() => { const f = () => setPage(pageFromHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const nav = (p: Page) => { window.location.hash = p; setPage(p); };

  const rows = useMemo(() => applyFilters(ROWS, filters), [filters]);
  const [title, subtitle] = HEADERS[page];
  const withFilters = page !== 'quality';

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar page={page} onNav={nav} />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="px-4 py-6 md:px-6">
          <PageHeader title={title} subtitle={subtitle} />
          {page === 'sessions' && (
            <label className="relative mb-5 block">
              <span className="sr-only">Search sessions</span>
              <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="9" r="6" /><path d="m14 14 3.5 3.5" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions by county, date, or ID…"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900" />
            </label>
          )}
          {withFilters ? (
            <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
              <div className="lg:sticky lg:top-4 lg:self-start"><FilterPanel applied={filters} onApply={setFilters} showStatus={page === 'sessions'} /></div>
              {page === 'overview' && <Overview rows={rows} filters={filters} setFilters={setFilters} />}
              {page === 'sessions' && <SessionExplorer rows={rows} filters={filters} setFilters={setFilters} search={search} />}
              {page === 'comments' && <Comments rows={rows} filters={filters} setFilters={setFilters} />}
            </div>
          ) : <Quality />}
        </main>
      </div>
    </div>
  );
}