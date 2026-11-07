import { useState, type ReactNode } from 'react';
import { S } from '../lib/data';
import { fmt } from '../lib/metrics';
import { Empty, cx } from './ui';

function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; html: ReactNode } | null>(null);
  const bind = (html: ReactNode) => ({
    onMouseMove: (e: React.MouseEvent) => { const b = (e.currentTarget as Element).closest('[data-chart]')!.getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, html }); },
    onMouseLeave: () => setTip(null),
  });
  const el = tip && (
    <div className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg dark:bg-white dark:text-ink" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.html}</div>
  );
  return { bind, el };
}

export function KpiCard({ label, value, detail, accent, spark }: { label: string; value: string; detail: ReactNode; accent?: boolean; spark?: number[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[12px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cx('tabular mt-1 text-[28px] font-bold leading-tight tracking-tight', accent ? 'text-brand-600 dark:text-brand-300' : 'text-ink dark:text-white')}>{value}</div>
      <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{detail}</div>
      {spark && spark.length > 2 && <Sparkline values={spark} />}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const W = 200, H = 28, lo = Math.min(...values), hi = Math.max(...values), r = hi - lo || 1;
  const pts = values.map((v, i) => `${2 + (W - 4) * (i / (values.length - 1))},${H - 2 - (H - 4) * ((v - lo) / r)}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-7 w-full" aria-hidden="true"><polyline points={pts} fill="none" className="stroke-brand-500" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>;
}

export function Dumbbell({ items }: { items: { label: string; n: number; pre: number; post: number }[] }) {
  const { bind, el } = useTip();
  const W = 520, L = 14, R = 44, rowH = 60, H = items.length * rowH + 28;
  const x = (v: number) => L + ((W - L - R) * v) / 100;
  return (
    <div data-chart className="relative">
      <div className="mb-2 flex gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-300 dark:bg-slate-600" />Before (looking back)</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand-600" />After training</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 25, 50, 75, 100].map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={6} y2={H - 22} className="stroke-slate-100 dark:stroke-slate-800" /><text x={x(t)} y={H - 6} textAnchor="middle" className="fill-slate-400 text-[11px]">{t}%</text></g>)}
        {items.map((k, i) => {
          const y = 40 + i * rowH;
          return (
            <g key={k.label}>
              <text x={L - 8} y={y - 18} className="fill-ink text-[12.5px] dark:fill-slate-200">{k.label}</text>
              {k.n < S.small_group_hide_n ? <text x={L - 8} y={y + 4} className="fill-slate-400 text-[12px]">Fewer than {S.small_group_hide_n} responses</text> : <>
                <line x1={x(k.pre)} x2={x(k.post)} y1={y} y2={y} className="stroke-brand-100 dark:stroke-brand-700/50" strokeWidth={6} strokeLinecap="round" />
                <circle cx={x(k.pre)} cy={y} r={7} className="fill-slate-300 stroke-white dark:fill-slate-600 dark:stroke-slate-900" strokeWidth={2} {...bind(<>Before: {fmt(k.pre, 1)}% · n = {k.n}</>)} />
                <circle cx={x(k.post)} cy={y} r={7} className="fill-brand-600 stroke-white dark:stroke-slate-900" strokeWidth={2} {...bind(<>After: {fmt(k.post, 1)}% · +{fmt(k.post - k.pre, 1)} pts</>)} />
                <text x={x(k.pre) - 12} y={y + 4} textAnchor="end" className="fill-slate-500 text-[12px]">{fmt(k.pre)}%</text>
                <text x={x(k.post) + 12} y={y + 4} className="fill-ink text-[12px] font-semibold dark:fill-white">{fmt(k.post)}%</text>
              </>}
            </g>
          );
        })}
      </svg>
      {el}
    </div>
  );
}

export function Histogram({ counts, label }: { counts: number[]; label: string }) {
  const { bind, el } = useTip();
  const n = counts.reduce((a, b) => a + b, 0);
  if (n < S.small_group_hide_n) return <Empty>Too few answers in this selection.</Empty>;
  const W = 520, H = 200, B = 22, T = 18, bw = W / 11, max = Math.max(...counts) / n;
  return (
    <div data-chart className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        <line x1={0} x2={W} y1={H - B} y2={H - B} className="stroke-slate-200 dark:stroke-slate-700" />
        {counts.map((c, i) => {
          const p = c / n, h = ((H - B - T) * p) / max, x0 = i * bw + 3;
          return (
            <g key={i} {...bind(<>Rated {i}: {c} people ({fmt(100 * p, 1)}%)</>)}>
              <rect x={x0} y={T - 14} width={bw - 6} height={H - B - T + 14} fill="transparent" />
              <rect x={x0} y={H - B - h} width={bw - 6} height={Math.max(h, 0)} rx={3} className={i >= 9 ? 'fill-brand-600' : i >= 7 ? 'fill-brand-400' : 'fill-brand-200 dark:fill-brand-700/70'} />
              {p > 0.04 && <text x={x0 + (bw - 6) / 2} y={H - B - h - 4} textAnchor="middle" className="fill-slate-500 text-[11px]">{fmt(100 * p)}%</text>}
              <text x={x0 + (bw - 6) / 2} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">{i}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">n = {n.toLocaleString()} · darkest = 9–10, lightest = 0–6</p>
      {el}
    </div>
  );
}

export function BarList({ items, n }: { items: { name: string; count: number; pct: number }[]; n: number }) {
  if (n < S.small_group_hide_n) return <Empty>Too few comments in this selection.</Empty>;
  const max = Math.max(...items.map((d) => d.pct));
  return (
    <div>
      <ul className="space-y-1.5">
        {items.map((d) => (
          <li key={d.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-3 text-[12.5px]" title={`${d.count} of ${n} comments`}>
            <span className={cx('truncate text-right', d.name === 'Other' ? 'text-slate-400' : 'text-ink dark:text-slate-200')}>{d.name}</span>
            <span className="flex items-center gap-2">
              <span className={cx('h-3 rounded-r', d.name === 'Other' ? 'bg-slate-300 dark:bg-slate-700' : 'bg-brand-500')} style={{ width: `${Math.max(2, (82 * d.pct) / max)}%` }} />
              <span className="tabular text-[11.5px] text-slate-500">{fmt(d.pct)}%</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">n = {n.toLocaleString()} people who wrote a comment · “Other” = no keyword rule matched</p>
    </div>
  );
}

export function TrendLine({ points, kind }: { points: { label: string; n: number; v: number }[]; kind: 'nps' | 'pct' | 'count' }) {
  const { bind, el } = useTip();
  if (points.length < 2) return <Empty>Not enough months with data.</Empty>;
  const W = 520, H = 220, L = 40, R = 16, T = 12, B = 30;
  let lo = kind === 'nps' ? -100 : 0; const hi = kind === 'count' ? Math.max(...points.map((p) => p.v)) * 1.1 : 100;
  if (kind === 'pct') lo = Math.max(0, Math.floor(Math.min(...points.map((p) => p.v)) / 10) * 10 - 10);
  const x = (i: number) => L + ((W - L - R) * i) / (points.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = kind === 'nps' ? [-100, -50, 0, 50, 100] : kind === 'count' ? [0, Math.round(hi / 2), Math.round(hi)] : [lo, Math.round((lo + 100) / 2), 100];
  return (
    <div data-chart className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={t === 0 && kind === 'nps' ? 'stroke-slate-300 dark:stroke-slate-600' : 'stroke-slate-100 dark:stroke-slate-800'} /><text x={L - 6} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{t}{kind === 'pct' ? '%' : ''}</text></g>)}
        <polyline points={points.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')} fill="none" className="stroke-brand-600" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => {
          const small = p.n < S.small_group_warn_n;
          return (
            <g key={p.label} {...bind(<>{p.label}: {kind === 'count' ? p.v : fmt(p.v, 1)}{kind === 'pct' ? '%' : ''} · n = {p.n}{small ? ' · small sample' : ''}</>)}>
              <rect x={x(i) - 14} y={T} width={28} height={H - T - B} fill="transparent" />
              <circle cx={x(i)} cy={y(p.v)} r={4.5} className={small ? 'fill-white stroke-brand-600 dark:fill-slate-900' : 'fill-brand-600 stroke-white dark:stroke-slate-900'} strokeWidth={2} />
              {points.length <= 14 && <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[10.5px]">{p.label.replace(' 20', " '")}</text>}
            </g>
          );
        })}
      </svg>
      {el}
    </div>
  );
}