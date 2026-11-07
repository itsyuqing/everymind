import { D, ROWS, S, type Row } from './data';

export interface Filters {
  counties: string[];
  roles: number[];
  langs: string[];
  from: string;
  to: string;
  includeReversed: boolean;
  statuses: SessionStatus[];
}

export function applyFilters(rows: Row[], f: Filters): Row[] {
  return rows.filter((r) =>
    r.month >= f.from && r.month <= f.to &&
    (!f.counties.length || f.counties.includes(r.county)) &&
    (!f.roles.length || f.roles.some((i) => (r.roleBits >> i) & 1)) &&
    (!f.langs.length || f.langs.includes(r.lang)) &&
    (f.includeReversed || !r.rev));
}

const agree = (v: number | null) => v != null && v >= S.agree_threshold;

export function knowledge(rows: Row[], i: number) {
  const p = rows.filter((r) => r.pre[i] != null && r.post[i] != null);
  const n = p.length;
  if (!n) return { n: 0, pre: NaN, post: NaN, gain: NaN };
  const pre = (100 * p.filter((r) => agree(r.pre[i])).length) / n;
  const post = (100 * p.filter((r) => agree(r.post[i])).length) / n;
  return { n, pre, post, gain: post - pre };
}

export function nps(rows: Row[]) {
  const v = rows.map((r) => r.rec).filter((x): x is number => x != null);
  const n = v.length;
  if (!n) return { n: 0, nps: NaN, promoters: NaN };
  const p = v.filter((x) => x >= S.promoter_min).length;
  const d = v.filter((x) => x <= S.detractor_max).length;
  return { n, nps: (100 * (p - d)) / n, promoters: (100 * p) / n };
}

export function delivery(rows: Row[], i: number) {
  const v = rows.map((r) => r.del[i]).filter((x): x is number => x != null);
  return v.length ? { n: v.length, pct: (100 * v.filter((x) => x >= S.agree_threshold).length) / v.length } : { n: 0, pct: NaN };
}

export function callIntent(rows: Row[]) {
  const v = rows.map((r) => r.call).filter((x): x is number => x != null);
  return v.length ? { n: v.length, high: (100 * v.filter((x) => x >= 9).length) / v.length } : { n: 0, high: NaN };
}

export function distribution(values: number[]) {
  const c = Array(11).fill(0) as number[];
  values.forEach((v) => c[Math.round(v)]++);
  return c;
}

export function themeShares(rows: Row[], key: 'vt' | 'it', names: string[]) {
  const answered = rows.filter((r) => r[key].length);
  const counts = Array(names.length).fill(0) as number[];
  answered.forEach((r) => r[key].forEach((i) => counts[i]++));
  return {
    n: answered.length,
    items: names.map((name, i) => ({ name, count: counts[i], pct: answered.length ? (100 * counts[i]) / answered.length : 0 }))
      .filter((d) => d.count > 0)
      .sort((a, b) => Number(a.name === 'Other') - Number(b.name === 'Other') || b.count - a.count),
  };
}

export function groupBy<K extends string>(rows: Row[], key: (r: Row) => K) {
  const m = new Map<K, Row[]>();
  rows.forEach((r) => { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
  return m;
}

export const sizeFlag = (n: number) => (n < S.small_group_hide_n ? 'hidden' : n < S.small_group_warn_n ? 'small' : 'ok');

export type SessionStatus = 'Strong' | 'Mixed' | 'Needs attention' | 'Small sample';
export const STATUSES: SessionStatus[] = ['Strong', 'Mixed', 'Needs attention', 'Small sample'];

export interface Session {
  id: string; date: string; county: string; n: number; studentShare: number;
  whenPost: number; whenGain: number; describeGain: number; nps: number; engaged: number; engagedN: number;
  callHigh: number; callN: number; status: SessionStatus; code: string;
}

const COUNTY_CODES: Record<string, string> = { 'Anne Arundel': 'AA', "Prince George's": 'PG', Montgomery: 'MO', "Queen Anne's": 'QA', 'Fairfax (VA)': 'FX' };

export function sessions(rows: Row[]): Session[] {
  return [...groupBy(rows, (r) => r.session)].map(([id, rs]) => {
    const [date, county] = id.split(' | ');
    const w = knowledge(rs, 2), d = knowledge(rs, 1), np = nps(rs), e = delivery(rs, 0), c = callIntent(rs);
    const status: SessionStatus = rs.length < S.small_group_warn_n ? 'Small sample'
      : np.nps >= 30 ? 'Strong' : np.nps >= 0 ? 'Mixed' : 'Needs attention';
    return {
      id, date, county, n: rs.length, studentShare: (100 * rs.filter((r) => r.roleBits & 1).length) / rs.length,
      whenPost: w.post, whenGain: w.gain, describeGain: d.gain, nps: np.nps, engaged: e.pct, engagedN: e.n,
      callHigh: c.high, callN: c.n, status,
      code: `${COUNTY_CODES[county] ?? county.slice(0, 2).toUpperCase()}-${date.slice(2).replace(/-/g, '')}`,
    };
  });
}

export const ALL_ROWS = ROWS;
export const defaultFilters = (): Filters => {
  const months = [...new Set(ROWS.map((r) => r.month))].sort();
  return { counties: [], roles: [], langs: [], from: months[0], to: months[months.length - 1], includeReversed: false, statuses: [] };
};
export const fmt = (v: number, d = 0) => (v == null || Number.isNaN(v) ? '—' : v.toFixed(d));
export const signed = (v: number, d = 0) => (Number.isNaN(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}`);
export { D, S };
