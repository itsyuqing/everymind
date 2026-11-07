import raw from '../data/dashboard_data.json';

type RawRow = [string, number, number, number, number, (number | null)[], (number | null)[], (number | null)[],
  number | null, number | null, number[], number[], number, number, number];

export interface Payload {
  generated: string;
  sources: string[];
  settings: { small_group_warn_n: number; small_group_hide_n: number; agree_threshold: number; promoter_min: number; detractor_max: number };
  counties: string[];
  maryland: string[];
  roles: string[];
  roleGroups: string[];
  knowledge: string[];
  delivery: string[];
  valuableThemes: string[];
  improveThemes: string[];
  quality: { step: string; detail: string; rows_affected: number }[];
  rows: RawRow[];
}

export interface Row {
  date: string;
  month: string;
  quarter: string;
  session: string;
  county: string;
  lang: 'English' | 'Spanish';
  roleBits: number;
  roleGroup: string;
  pre: (number | null)[];
  post: (number | null)[];
  del: (number | null)[];
  rec: number | null;
  call: number | null;
  vt: number[];
  it: number[];
  isQ: boolean;
  rev: boolean;
}

export const D = raw as unknown as Payload;
export const S = D.settings;

export const ROWS: Row[] = D.rows.map((r) => {
  const [y, m] = r[0].split('-').map(Number);
  const county = D.counties[r[1]];
  return {
    date: r[0], month: r[0].slice(0, 7), quarter: `${y} Q${Math.ceil(m / 3)}`, session: `${r[0]} | ${county}`,
    county, lang: r[2] ? 'Spanish' : 'English', roleBits: r[3], roleGroup: D.roleGroups[r[4]],
    pre: r[5], post: r[6], del: r[7], rec: r[8], call: r[9], vt: r[10], it: r[11], isQ: !!r[12], rev: !!r[13],
  };
});

export const MONTHS = [...new Set(ROWS.map((r) => r.month))].sort();
export const monthLabel = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  return new Date(y, mm - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
};
export const dateLabel = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};