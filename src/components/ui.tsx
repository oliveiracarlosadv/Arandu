// Componentes de interface base (acessíveis, sem dependências).

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap';
  const sizes = { sm: 'h-8 px-2.5 text-[13px]', md: 'h-9 px-3.5 text-sm' };
  const variants: Record<Variant, string> = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400 shadow-sm',
    secondary: 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-ink-100 dark:hover:bg-white/[0.08]',
    ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/[0.06] dark:hover:text-white',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10',
  };
  return (
    <button type="button" className={cx(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'brand' | 'warn' | 'error' | 'info'; children: ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700 dark:bg-white/[0.07] dark:text-ink-300',
    brand: 'bg-brand-50 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20',
    warn: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
    error: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20',
    info: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', tones[tone], className)}>{children}</span>;
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('flex items-start justify-between gap-4 py-2', disabled && 'opacity-50')}>
      <span>
        <span className="block text-sm font-medium text-ink-900 dark:text-ink-100">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-500 dark:text-ink-400">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-600 dark:bg-brand-500' : 'bg-ink-300 dark:bg-white/15')}
      >
        <span className={cx('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel, size = 'md' }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; ariaLabel: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap gap-0.5 rounded-xl bg-ink-100 p-1 dark:bg-white/[0.05]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg font-medium transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-[12.5px]' : 'px-3 py-1.5 text-[13px]',
            value === o.value ? 'bg-white text-ink-950 shadow-sm dark:bg-ink-800 dark:text-white' : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, indeterminate, className }: { value?: number; indeterminate?: boolean; className?: string }) {
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.06]', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value !== undefined ? Math.round(value * 100) : undefined}>
      <div
        className={cx('h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[width] duration-300', indeterminate && 'animate-soft-pulse')}
        style={{ width: indeterminate ? '100%' : `${Math.max(2, Math.min(100, (value ?? 0) * 100))}%` }}
      />
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-ink-200 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px] dark:border-white/10 dark:bg-ink-900 dark:text-ink-100"
    >
      {open && (
        <div className="p-6">
          <h2 className="text-base font-semibold">{title}</h2>
          <div className="mt-3 text-sm text-ink-600 dark:text-ink-300">{children}</div>
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-3.5 py-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
      <div className="label">{label}</div>
      <div className={cx('mt-1 text-xl font-semibold tabular-nums tracking-tight', accent ? 'text-brand-700 dark:text-brand-300' : 'text-ink-950 dark:text-white')}>{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-ink-500 dark:text-ink-400">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-950 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Ícones de traço (24px, stroke) — conjunto mínimo próprio. */
const paths: Record<string, string> = {
  upload: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5',
  home: 'M3 11 12 4l9 7M5 10v10h14V10',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  cpu: 'M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 5h4v4h-4z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-3 9 2 2 4-4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-4m0-4h.01',
  download: 'M12 4v12m0 0-4-4m4 4 4-4M4 20h16',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'm5 12 5 5L20 7',
  x: 'M6 6l12 12M18 6 6 18',
  stop: 'M7 7h10v10H7z',
  retry: 'M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.6 2M18.5 9A7 7 0 0 0 5.9 7',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7a4 4 0 0 0 6 0L5 7Zm14 0-3 7a4 4 0 0 0 6 0l-3-7Z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  columns: 'M4 5h16v14H4zM12 5v14',
  plus: 'M12 5v14M5 12h14',
  zip: 'M6 3h9l4 4v14H6V3Zm4 0v2m0 2v2m0 2v2m-1 2h2v3h-2z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.7m4 0a10 10 0 0 1 5 2.7M12 20h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2',
  menu: 'M4 7h16M4 12h16M4 17h16',
};
export function Icon({ name, size = 16, className }: { name: keyof typeof paths | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name] ?? paths.file} />
    </svg>
  );
}
