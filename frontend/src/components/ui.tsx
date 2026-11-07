import type { ReactNode, SelectHTMLAttributes } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className, title, subtitle, action, id }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <section id={id} className={cx('rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900', className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink dark:text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const badgeTone = {
  blue: 'bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  gray: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};
export function Badge({ children, tone = 'blue', title }: { children: ReactNode; tone?: keyof typeof badgeTone; title?: string }) {
  return <span title={title} className={cx('inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium', badgeTone[tone])}>{children}</span>;
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-start gap-1.5 text-[13px] leading-snug', checked ? 'text-brand-600 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300')}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] size-3.5 shrink-0 rounded-sm border-slate-400 accent-brand-600" />
      {label}
    </label>
  );
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx('relative', className)}>
      <select {...p} className="h-9 w-full cursor-pointer appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-8 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        {children}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
    </div>
  );
}

export function Button({ children, variant = 'primary', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'border border-slate-200 bg-white text-ink hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    ghost: 'text-brand-600 hover:underline dark:text-brand-300',
  }[variant];
  return <button type="button" {...p} className={cx('inline-flex h-9 items-center justify-center rounded-md px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500', v, className)}>{children}</button>;
}

export function SizeNote({ n }: { n: number }) {
  return <span className="text-[11px] text-slate-500 dark:text-slate-400">n = {n.toLocaleString()}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{children}</div>;
}