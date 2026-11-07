import { useEffect, useState } from 'react';
import { D, MONTHS, monthLabel } from '../lib/data';
import { STATUSES, defaultFilters, type Filters } from '../lib/metrics';
import { Button, Checkbox, Select } from './ui';

const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-[12px] font-semibold text-ink dark:text-slate-200">{label}</legend>
      {children}
    </fieldset>
  );
}

export function FilterPanel({ applied, onApply, showStatus }: { applied: Filters; onApply: (f: Filters) => void; showStatus: boolean }) {
  const [f, setF] = useState<Filters>(applied);
  useEffect(() => setF(applied), [applied]);
  const counties = D.counties.filter((c) => c !== 'Not answered');
  const dirty = JSON.stringify(f) !== JSON.stringify(applied);

  return (
    <div className="rounded-lg bg-brand-50/70 p-4 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink dark:text-white">Filter responses</h2>
        <svg viewBox="0 0 24 24" className="size-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
      </div>

      <Group label="County">
        <div className="grid grid-cols-1 gap-y-2">
          {counties.map((c) => <Checkbox key={c} label={c} checked={f.counties.includes(c)} onChange={(on) => setF({ ...f, counties: toggle(f.counties, c, on) })} />)}
        </div>
      </Group>

      <Group label="Participant role">
        <div className="grid grid-cols-1 gap-y-2">
          {D.roles.map((r, i) => <Checkbox key={r} label={r} checked={f.roles.includes(i)} onChange={(on) => setF({ ...f, roles: toggle(f.roles, i, on) })} />)}
        </div>
      </Group>

      <Group label="Survey language">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {['English', 'Spanish'].map((l) => <Checkbox key={l} label={l} checked={f.langs.includes(l)} onChange={(on) => setF({ ...f, langs: toggle(f.langs, l, on) })} />)}
        </div>
      </Group>

      {showStatus && (
        <Group label="Session status">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {STATUSES.map((s) => <Checkbox key={s} label={s} checked={f.statuses.includes(s)} onChange={(on) => setF({ ...f, statuses: toggle(f.statuses, s, on) })} />)}
          </div>
        </Group>
      )}

      <Group label="Training date from">
        <Select value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From month">
          {MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </Select>
      </Group>
      <Group label="Training date to">
        <Select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To month">
          {MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </Select>
      </Group>

      <Group label="Response quality">
        <Checkbox label="Include likely reversed-scale responses" checked={f.includeReversed} onChange={(on) => setF({ ...f, includeReversed: on })} />
      </Group>

      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <Button className="w-full" onClick={() => onApply(f.from > f.to ? { ...f, from: f.to, to: f.from } : f)}>
          Apply Filters{dirty && <span className="ml-1.5 size-1.5 rounded-full bg-white" aria-label="unapplied changes" />}
        </Button>
        <Button variant="secondary" className="mt-2 w-full" onClick={() => { const d = defaultFilters(); setF(d); onApply(d); }}>Clear Filters</Button>
      </div>
    </div>
  );
}

export function FilterChips({ f, onChange }: { f: Filters; onChange: (f: Filters) => void }) {
  const d = defaultFilters();
  const chips: { label: string; remove: () => void }[] = [
    ...f.counties.map((c) => ({ label: c, remove: () => onChange({ ...f, counties: f.counties.filter((x) => x !== c) }) })),
    ...f.roles.map((i) => ({ label: D.roles[i], remove: () => onChange({ ...f, roles: f.roles.filter((x) => x !== i) }) })),
    ...f.langs.map((l) => ({ label: l, remove: () => onChange({ ...f, langs: f.langs.filter((x) => x !== l) }) })),
    ...f.statuses.map((s) => ({ label: s, remove: () => onChange({ ...f, statuses: f.statuses.filter((x) => x !== s) }) })),
    ...(f.from !== d.from || f.to !== d.to ? [{ label: `${monthLabel(f.from)} – ${monthLabel(f.to)}`, remove: () => onChange({ ...f, from: d.from, to: d.to }) }] : []),
    ...(f.includeReversed ? [{ label: 'Incl. reversed-scale', remove: () => onChange({ ...f, includeReversed: false }) }] : []),
  ];
  if (!chips.length) return <div className="mb-3 h-7 text-[12px] leading-7 text-slate-500 dark:text-slate-400">Showing all responses</div>;
  return (
    <div className="mb-3 flex min-h-7 flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span key={c.label} className="inline-flex h-7 items-center gap-1.5 rounded bg-brand-50 pl-2 pr-1 text-[12px] font-medium text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
          {c.label}
          <button type="button" onClick={c.remove} aria-label={`Remove ${c.label}`} className="grid size-5 place-items-center rounded hover:bg-brand-100 dark:hover:bg-brand-600/30">
            <svg viewBox="0 0 20 20" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </span>
      ))}
      <button type="button" onClick={() => onChange(d)} className="text-[12px] font-medium text-brand-600 hover:underline dark:text-brand-300">Clear All</button>
    </div>
  );
}