import { useMemo, useState } from 'react';
import map from '../data/md-dots.json';
import type { Row } from '../lib/data';
import { fmt, nps, signed } from '../lib/metrics';
import { cx } from './ui';

const BUCKETS = [
  { min: 500, label: '500+ responses', cls: 'fill-brand-700 dark:fill-brand-400', sw: 'bg-brand-700 dark:bg-brand-400' },
  { min: 100, label: '100–499', cls: 'fill-brand-500', sw: 'bg-brand-500' },
  { min: 30, label: '30–99', cls: 'fill-brand-400 dark:fill-brand-600', sw: 'bg-brand-400 dark:bg-brand-600' },
  { min: 1, label: '1–29', cls: 'fill-brand-200 dark:fill-brand-700/70', sw: 'bg-brand-200 dark:bg-brand-700/70' },
];
const bucket = (n: number) => BUCKETS.find((b) => n >= b.min);

/** Dot-matrix map of Maryland jurisdictions, shaded by responses in the current selection. */
export function CountyMap({ rows, selected, onToggle }: { rows: Row[]; selected: string[]; onToggle: (county: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const stats = useMemo(() => map.counties.map((c) => {
    const rs = rows.filter((r) => r.county === c.name);
    return { ...c, n: rs.length, nps: nps(rs).nps };
  }), [rows]);
  const offMap = useMemo(() => {
    const names = new Set(map.counties.map((c) => c.name));
    const m = new Map<string, number>();
    rows.forEach((r) => { if (!names.has(r.county)) m.set(r.county, (m.get(r.county) ?? 0) + 1); });
    return [...m];
  }, [rows]);
  const focus = hover ?? (selected.length === 1 ? stats.findIndex((s) => s.name === selected[0]) : -1);
  const fs = focus >= 0 ? stats[focus] : null;

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${map.w} ${map.h}`} className="h-auto w-full" role="img" aria-label="Map of Maryland counties shaded by number of survey responses">
          {map.dots.map(([x, y, i], k) => {
            const s = stats[i]; const b = bucket(s.n); const sel = selected.includes(s.name);
            return <circle key={k} cx={x} cy={y} r={sel || hover === i ? 2.7 : 2.2}
              className={cx(b ? b.cls : 'fill-slate-200 dark:fill-slate-700', 'cursor-pointer transition-[r]', selected.length > 0 && !sel && b && 'opacity-40')}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onToggle(s.name)} />;
          })}
          {stats.filter((s) => s.n > 0).map((s) => (
            <text key={s.name} x={s.c[0]} y={s.c[1] - 12} textAnchor="middle" className="pointer-events-none fill-ink stroke-white text-[11px] font-medium dark:fill-slate-200 dark:stroke-slate-900" style={{ paintOrder: 'stroke' }} strokeWidth={4} strokeLinejoin="round">{s.name}</text>
          ))}
        </svg>
        {fs && (
          <div className="pointer-events-none absolute rounded-md border border-brand-200 bg-white/95 px-3 py-2 text-[11px] shadow-sm dark:border-slate-700 dark:bg-slate-900/95"
            style={{ left: `${Math.min(80, (fs.c[0] / map.w) * 100)}%`, top: `${(fs.c[1] / map.h) * 100}%`, transform: 'translate(-50%, 14px)' }}>
            <div className="font-semibold text-ink dark:text-white">{fs.name}{selected.includes(fs.name) && <span className="font-normal text-slate-500"> · Selected</span>}</div>
            <div className="text-slate-500 dark:text-slate-400">{fs.n ? `${fs.n.toLocaleString()} responses${fs.n >= 10 ? ` · NPS ${signed(fs.nps)}` : ''}` : 'No responses in this selection'}</div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {[...BUCKETS].reverse().map((b) => <span key={b.label} className="inline-flex items-center gap-1.5"><span className={cx('size-2 rounded-full', b.sw)} />{b.label}</span>)}
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-200 dark:bg-slate-700" />No responses</span>
        </div>
        {offMap.length > 0 && <span>Not on map: {offMap.map(([c, n]) => `${c} (${n})`).join(' · ')}</span>}
      </div>
      <p className="sr-only">{stats.filter((s) => s.n).map((s) => `${s.name}: ${s.n} responses, NPS ${fmt(s.nps)}`).join('; ')}</p>
    </div>
  );
}