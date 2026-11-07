import { useMemo, useState } from 'react';
import { CountyMap } from '../components/CountyMap';
import { FilterChips } from '../components/FilterPanel';
import { Badge, Button, Card, Select, cx } from '../components/ui';
import type { Row } from '../lib/data';
import { dateLabel } from '../lib/data';
import { fmt, sessions, signed, type Filters, type Session } from '../lib/metrics';

const PAGE = 15;
const SORTS = {
  recent: { label: 'Most recent', fn: (a: Session, b: Session) => b.date.localeCompare(a.date) },
  responses: { label: 'Most responses', fn: (a: Session, b: Session) => b.n - a.n },
  npsLow: { label: 'Lowest NPS first', fn: (a: Session, b: Session) => (a.nps || 0) - (b.nps || 0) },
  npsHigh: { label: 'Highest NPS first', fn: (a: Session, b: Session) => (b.nps || 0) - (a.nps || 0) },
  gain: { label: 'Biggest learning gain', fn: (a: Session, b: Session) => (b.whenGain || 0) - (a.whenGain || 0) },
};
type SortKey = keyof typeof SORTS;
const tone = { Strong: 'green', Mixed: 'blue', 'Needs attention': 'red', 'Small sample': 'gray' } as const;
const hidden = (s: Session) => s.n < 10;

function SessionTable({ list }: { list: Session[] }) {
  const th = 'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap';
  const thr = `${th} text-right`;
  const td = 'px-3 py-2.5 text-right tabular whitespace-nowrap';
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 dark:bg-slate-900"><tr>
          <th className={cx(th, 'text-left')}>Session</th><th className={thr}>Status</th><th className={thr}>Responses</th><th className={thr}>Know when</th><th className={thr}>Gain</th><th className={thr}>NPS</th><th className={thr}>Engaged</th><th className={thr}>Very likely to call</th>
        </tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
              <td className="px-3 py-2.5"><div className="font-medium text-ink dark:text-white">{s.county}</div><div className="text-[11px] text-slate-500">{s.code} · {dateLabel(s.date)}</div></td>
              <td className={td}><Badge tone={tone[s.status]}>{s.status}</Badge></td>
              <td className={td}>{s.n}</td>
              <td className={td}>{hidden(s) ? '—' : `${fmt(s.whenPost)}%`}</td>
              <td className={td}>{hidden(s) ? '—' : signed(s.whenGain)}</td>
              <td className={cx(td, !hidden(s) && s.nps < 0 && 'text-rose-600 dark:text-rose-400')}>{hidden(s) ? '—' : signed(s.nps)}</td>
              <td className={td}>{hidden(s) || !s.engagedN ? '—' : `${fmt(s.engaged)}%`}</td>
              <td className={td}>{hidden(s) ? '—' : s.callN >= 10 ? `${fmt(s.callHigh)}%` : <span className="text-[11px] text-slate-400">{s.callN ? `n=${s.callN}` : 'not asked'}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SessionExplorer({ rows, filters, setFilters, search }: { rows: Row[]; filters: Filters; setFilters: (f: Filters) => void; search: string }) {
  const [sort, setSort] = useState<SortKey>('recent');
  const [shown, setShown] = useState(PAGE);
  const all = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions(rows)
      .filter((s) => !filters.statuses.length || filters.statuses.includes(s.status))
      .filter((s) => !q || `${s.county} ${s.code} ${s.date} ${dateLabel(s.date)}`.toLowerCase().includes(q))
      .sort((a, b) => (sort === 'recent' || sort === 'responses' ? 0 : Number(hidden(a)) - Number(hidden(b))) || SORTS[sort].fn(a, b));
  }, [rows, filters.statuses, search, sort]);
  const list = all.slice(0, shown);
  const toggleCounty = (c: string) => setFilters({ ...filters, counties: filters.counties.includes(c) ? filters.counties.filter((x) => x !== c) : [...filters.counties, c] });

  return (
    <div className="min-w-0">
      <FilterChips f={filters} onChange={setFilters} />
      <Card title="Responses by County" subtitle="Map reflects current filters. Click a county to filter by it." className="mb-5">
        <CountyMap rows={rows} selected={filters.counties} onToggle={toggleCounty} />
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-ink dark:text-white">{all.length} training sessions found</h2>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-slate-500">Sort</span>
          <Select value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setShown(PAGE); }} className="w-[170px]" aria-label="Sort sessions">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
      </div>

      {list.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700">No sessions match these filters.</div>
        : <SessionTable list={list} />}

      <div className="mt-5 flex items-center justify-between">
        <span className="text-[12px] text-slate-500">Showing {list.length} of {all.length} sessions</span>
        {shown < all.length && <Button variant="secondary" onClick={() => setShown(shown + PAGE)}>Load More</Button>}
      </div>
    </div>
  );
}