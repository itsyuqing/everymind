import { BarList } from '../components/charts';
import { FilterChips } from '../components/FilterPanel';
import { Card } from '../components/ui';
import { D, S, type Row } from '../lib/data';
import { fmt, themeShares, type Filters } from '../lib/metrics';

export function Comments({ rows, filters, setFilters }: { rows: Row[]; filters: Filters; setFilters: (f: Filters) => void }) {
  const v = themeShares(rows, 'vt', D.valuableThemes);
  const im = themeShares(rows, 'it', D.improveThemes);
  const answered = rows.filter((r) => r.it.length);
  const q = answered.length ? (100 * answered.filter((r) => r.isQ).length) / answered.length : NaN;
  return (
    <div className="min-w-0">
      <FilterChips f={filters} onChange={setFilters} />
      {answered.length >= S.small_group_warn_n && (
        <div className="mb-5 rounded-lg border border-brand-100 bg-brand-50/60 p-4 text-[13.5px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <b className="text-ink dark:text-white">{fmt(q)}%</b> of answers to “How can we improve this training?” were actually questions people still had about 988, such as whether calls are confidential, what a call is like, and who answers. That is a ready-made FAQ for future sessions.
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Most valuable thing learned" subtitle="Open-ended comments coded into themes by keyword rules. A comment can have several themes.">
          <BarList items={v.items} n={v.n} />
        </Card>
        <Card title="How to improve / what people still ask" subtitle="Same coding. Edit config/themes.json to add or adjust themes.">
          <BarList items={im.items} n={im.n} />
        </Card>
      </div>
    </div>
  );
}

export function Quality() {
  return (
    <div className="min-w-0 max-w-4xl">
      <Card title="Cleaning log" subtitle="Every decision the pipeline made, and how many rows it affected. Nothing is silently deleted." className="mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-800"><th className="px-3 py-2">Step</th><th className="px-3 py-2">What was done</th><th className="px-3 py-2 text-right">Rows</th></tr></thead>
            <tbody>{D.quality.map((q, i) => (
              <tr key={i} className="border-b border-slate-100 align-top dark:border-slate-800">
                <td className="whitespace-nowrap px-3 py-2.5 font-medium">{q.step}</td><td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{q.detail}</td><td className="tabular px-3 py-2.5 text-right">{q.rows_affected.toLocaleString()}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Card>
      <Card title="Method & limitations">
        <ul className="list-disc space-y-2 pl-5 text-[13px] text-slate-600 dark:text-slate-300">
          <li><b>% agree</b> = Agree or Strongly agree. <b>Gain</b> = after minus before, using the same respondents.</li>
          <li>“Before” ratings are retrospective (asked after the training), which tends to overstate gains.</li>
          <li><b>NPS</b> = % rating 9–10 minus % rating 0–6 on “likely to recommend.”</li>
          <li>“Very likely to call 988” = 9–10. This question was only on some survey versions, so its sample is smaller.</li>
          <li>Responses answering “Strongly disagree” on every knowledge item while rating the training 7–10 are treated as likely reversed-scale and excluded by default (a filter includes them).</li>
          <li>Groups under {S.small_group_warn_n} responses are marked small; under {S.small_group_hide_n} are hidden. A session = one training date in one county.</li>
          <li>Survey is voluntary and anonymous; most responses are Anne Arundel and Prince George’s students. No demographic fields are collected.</li>
        </ul>
        <p className="mt-4 text-[11px] text-slate-400">Data: {D.sources.join(', ')} · built {D.generated}</p>
      </Card>
    </div>
  );
}