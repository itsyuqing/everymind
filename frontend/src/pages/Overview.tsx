import { useMemo, useState } from 'react';
import { Dumbbell, Histogram, KpiCard, TrendLine } from '../components/charts';
import { FilterChips } from '../components/FilterPanel';
import { Badge, Card, Select, cx } from '../components/ui';
import { D, S, monthLabel, type Row } from '../lib/data';
import { callIntent, delivery, distribution, fmt, groupBy, knowledge, nps, signed, sizeFlag, type Filters } from '../lib/metrics';

const monthly = (rows: Row[], fn: (rs: Row[]) => number) =>
  [...groupBy(rows, (r) => r.month)].sort(([a], [b]) => a.localeCompare(b))
    .filter(([, rs]) => rs.length >= S.small_group_hide_n).map(([m, rs]) => ({ label: monthLabel(m), n: rs.length, v: fn(rs) }))
    .filter((p) => !Number.isNaN(p.v));

function Insights({ rows }: { rows: Row[] }) {
  const out: { k: string; text: React.ReactNode; warn?: boolean }[] = [];
  if (rows.length >= S.small_group_warn_n) {
    const ks = D.knowledge.map((l, i) => ({ l, ...knowledge(rows, i) })).filter((k) => k.n >= S.small_group_warn_n).sort((a, b) => b.gain - a.gain);
    if (ks[0]) out.push({ k: 'Biggest learning gain', text: <><b className="text-ink dark:text-white">{ks[0].l.replace(/^I (can|know) /, '').replace(/^./, (c) => c.toUpperCase())}</b>: {fmt(ks[0].pre)}% → {fmt(ks[0].post)}% agree (+{fmt(ks[0].gain)} pts).</> });
    const kc = rows.filter((r) => r.post[2] != null && r.post[2]! >= S.agree_threshold && r.call != null);
    if (kc.length >= S.small_group_warn_n) { const hi = (100 * kc.filter((r) => r.call! >= 9).length) / kc.length;
      out.push({ k: 'Knowing vs. calling', warn: hi < 70, text: <>Of people who know when to use 988, only <b className="text-ink dark:text-white">{fmt(hi)}%</b> are very likely to call it (n = {kc.length}).</> }); }
    const stu = rows.filter((r) => r.roleBits === 1), ad = rows.filter((r) => (r.roleBits & 0b1110) && !(r.roleBits & 1));
    if (stu.length >= S.small_group_warn_n && ad.length >= S.small_group_warn_n)
      out.push({ k: 'Audience matters', warn: true, text: <>Students rate the training NPS <b className="text-ink dark:text-white">{signed(nps(stu).nps)}</b> vs. adults <b className="text-ink dark:text-white">{signed(nps(ad).nps)}</b> (n = {stu.length} vs. {ad.length}).</> });
    const ia = rows.filter((r) => r.it.length);
    if (ia.length >= S.small_group_warn_n) out.push({ k: 'What people still ask', text: <><b className="text-ink dark:text-white">{fmt((100 * ia.filter((r) => r.isQ).length) / ia.length)}%</b> of “how can we improve?” answers are questions people still have about 988.</> });
  }
  if (!out.length) return null;
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {out.map((o) => (
        <div key={o.k} className="rise rounded-lg border border-slate-200 bg-brand-50/50 p-3.5 text-[13px] leading-snug text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <div className={cx('mb-1 text-[10.5px] font-semibold uppercase tracking-wide', o.warn ? 'text-amber-600 dark:text-amber-400' : 'text-brand-600 dark:text-brand-300')}>{o.k}</div>
          {o.text}
        </div>
      ))}
    </div>
  );
}

const COMPARE = { county: 'County', roleGroup: 'Participant role', lang: 'Survey language', quarter: 'Quarter' } as const;
type CompareKey = keyof typeof COMPARE;

function CompareTable({ rows }: { rows: Row[] }) {
  const [by, setBy] = useState<CompareKey>('county');
  const data = useMemo(() => [...groupBy(rows, (r) => r[by])].map(([g, rs]) => {
    const w = knowledge(rs, 2), d = knowledge(rs, 1), e = delivery(rs, 0), c = callIntent(rs);
    return { g, n: rs.length, when: w.post, gain: w.gain, dgain: d.gain, nps: nps(rs).nps, eng: e.pct, c };
  }).sort((a, b) => (by === 'quarter' ? a.g.localeCompare(b.g) : b.n - a.n)), [rows, by]);
  const th0 = 'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap';
  const th = `${th0} text-right`;
  const td = 'px-3 py-2.5 text-right tabular whitespace-nowrap';
  return (
    <Card title="Where results differ" subtitle={`Groups under ${S.small_group_warn_n} responses are marked small; under ${S.small_group_hide_n} are hidden for privacy.`}
      action={<Select value={by} onChange={(e) => setBy(e.target.value as CompareKey)} className="w-[180px]" aria-label="Compare by">{Object.entries(COMPARE).map(([k, v]) => <option key={k} value={k}>Compare by {v.toLowerCase()}</option>)}</Select>}
      className="mb-5">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-slate-200 dark:border-slate-800">
            <th className={cx(th0, 'text-left')}>Group</th><th className={th}>Responses</th><th className={th}>Know when (after)</th><th className={th}>Know-when gain</th><th className={th}>Describe gain</th><th className={th}>NPS</th><th className={th}>Presenter engaged</th><th className={th}>Very likely to call</th>
          </tr></thead>
          <tbody>
            {data.map((d) => { const f = sizeFlag(d.n); const h = f === 'hidden'; return (
              <tr key={d.g} className={cx('border-b border-slate-100 dark:border-slate-800', h && 'text-slate-400')}>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium">{d.g} {f === 'small' && <Badge tone="amber">small sample</Badge>}{h && <Badge tone="gray">hidden</Badge>}</td>
                <td className={td}>{d.n}</td>
                <td className={td}>{h ? '—' : `${fmt(d.when)}%`}</td>
                <td className={cx(td, 'text-emerald-700 dark:text-emerald-400')}>{h ? '—' : signed(d.gain)}</td>
                <td className={cx(td, 'text-emerald-700 dark:text-emerald-400')}>{h ? '—' : signed(d.dgain)}</td>
                <td className={cx(td, !h && d.nps < 0 && 'text-rose-600 dark:text-rose-400')}>{h ? '—' : signed(d.nps)}</td>
                <td className={td}>{h || Number.isNaN(d.eng) ? '—' : `${fmt(d.eng)}%`}</td>
                <td className={td}>{h ? '—' : d.c.n ? <>{fmt(d.c.high)}% <span className="text-[11px] text-slate-400">n={d.c.n}</span></> : <span className="text-[11px] text-slate-400">not asked</span>}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">NPS = % rating 9–10 minus % rating 0–6 on “How likely are you to recommend this training?” (−100 to +100).</p>
    </Card>
  );
}

export function Overview({ rows, filters, setFilters }: { rows: Row[]; filters: Filters; setFilters: (f: Filters) => void }) {
  const [metric, setMetric] = useState<'nps' | 'when' | 'engaged' | 'n'>('nps');
  const few = rows.length < S.small_group_hide_n;
  const w = knowledge(rows, 2), ds = knowledge(rows, 1), np = nps(rows), c = callIntent(rows);
  const sessions = new Set(rows.map((r) => r.session)).size;
  const trend = metric === 'nps' ? monthly(rows, (rs) => nps(rs).nps) : metric === 'when' ? monthly(rows, (rs) => knowledge(rs, 2).post)
    : metric === 'engaged' ? monthly(rows, (rs) => delivery(rs, 0).pct) : monthly(rows, (rs) => rs.length);
  const intentVals = rows.filter((r) => r.post[2] != null && r.post[2]! >= S.agree_threshold && r.call != null).map((r) => r.call!);

  return (
    <div className="min-w-0">
      <FilterChips f={filters} onChange={setFilters} />
      {rows.length < S.small_group_warn_n && (
        <div className="mb-4 rounded-md bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Only {rows.length} responses match. {few ? 'That is too few to show results; widen the filters.' : 'Treat percentages as rough indications.'}
        </div>
      )}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Responses" value={rows.length.toLocaleString()} detail={`${sessions} training sessions`} spark={few ? undefined : monthly(rows, (rs) => rs.length).map((p) => p.v)} />
        <KpiCard label="Know when to use 988" value={few ? '—' : `${fmt(w.post)}%`} detail={few ? 'too few' : <><span className="font-semibold text-emerald-600 dark:text-emerald-400">{signed(w.gain)} pts</span> vs. before</>} spark={few ? undefined : monthly(rows, (rs) => knowledge(rs, 2).post).map((p) => p.v)} />
        <KpiCard label="Can describe 988" value={few ? '—' : `${fmt(ds.post)}%`} detail={few ? 'too few' : <><span className="font-semibold text-emerald-600 dark:text-emerald-400">{signed(ds.gain)} pts</span> vs. before</>} spark={few ? undefined : monthly(rows, (rs) => knowledge(rs, 1).post).map((p) => p.v)} />
        <KpiCard label="Would recommend (NPS)" value={few ? '—' : signed(np.nps)} detail={few ? 'too few' : `${fmt(np.promoters)}% rated 9–10`} spark={few ? undefined : monthly(rows, (rs) => nps(rs).nps).map((p) => p.v)} />
        <KpiCard label="Very likely to call 988" accent value={few || !c.n ? '—' : `${fmt(c.high)}%`} detail={c.n ? `rated 9–10 · n = ${c.n}` : 'not asked in this selection'} />
      </div>

      {!few && <>
        <Insights rows={rows} />
        <div className="mb-5 grid gap-5 xl:grid-cols-2">
          <Card title="What participants learned" subtitle="% who agree, before vs. after (same people). “Before” was rated after the session, looking back.">
            <Dumbbell items={D.knowledge.map((label, i) => ({ label, ...knowledge(rows, i) }))} />
          </Card>
          <Card title="Knowing vs. intending to call" subtitle="Among people who know when to use 988: how likely they are to call (0–10). Asked on some survey versions only.">
            <Histogram counts={distribution(intentVals)} label="Likelihood to call 988" />
          </Card>
        </div>
        <CompareTable rows={rows} />
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Trend over time" subtitle={`By training month. Hollow points = under ${S.small_group_warn_n} responses.`}
            action={<Select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} className="w-[200px]" aria-label="Trend metric">
              <option value="nps">Would recommend (NPS)</option><option value="when">Know when to use 988 (%)</option><option value="engaged">Presenter engaged (%)</option><option value="n">Responses</option>
            </Select>}>
            <TrendLine points={trend} kind={metric === 'nps' ? 'nps' : metric === 'n' ? 'count' : 'pct'} />
          </Card>
          <Card title="How likely to recommend" subtitle="0–10 ratings. A cluster at 5–8 means lukewarm rather than negative.">
            <Histogram counts={distribution(rows.map((r) => r.rec).filter((x): x is number => x != null))} label="Likelihood to recommend" />
          </Card>
        </div>
      </>}
    </div>
  );
}