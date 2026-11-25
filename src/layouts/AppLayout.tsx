import type { ReactNode } from 'react';
import { Logo } from '../components/Logo';
import { Button, Icon, cx } from '../components/ui';
import { navigate, type Route } from '../hooks/useAppState';
import { updateSettings, useSettings } from '../services/settings';
import { applyUpdate, promptInstall, usePwa } from '../services/pwa';
import { useJobs } from '../modules/batch/queue';

const NAV: { page: Route['page']; path: string; label: string; icon: string }[] = [
  { page: 'home', path: '/', label: 'Converter', icon: 'upload' },
  { page: 'workspace', path: '/workspace', label: 'Workspace Jurídico', icon: 'scale' },
  { page: 'models', path: '/modelos', label: 'Central de Modelos', icon: 'cpu' },
  { page: 'settings', path: '/configuracoes', label: 'Configurações', icon: 'settings' },
  { page: 'privacy', path: '/privacidade', label: 'Privacidade', icon: 'shield' },
  { page: 'about', path: '/sobre', label: 'Sobre', icon: 'info' },
];

export function AppLayout({ route, children }: { route: Route; children: ReactNode }) {
  const s = useSettings();
  const pwa = usePwa();
  const jobs = useJobs();
  const active = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
  const current = route.page === 'result' ? 'home' : route.page;
  const dark = document.documentElement.classList.contains('dark');

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barra lateral (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-ink-200/70 bg-white/60 px-3 py-5 backdrop-blur lg:flex dark:border-white/[0.06] dark:bg-ink-950/60">
        <button type="button" onClick={() => navigate('/')} className="mb-7 px-2 text-left" aria-label="ARANDU — início">
          <Logo />
        </button>
        <nav className="flex flex-col gap-0.5" aria-label="Navegação principal">
          {NAV.map((n) => (
            <a
              key={n.page}
              href={`#${n.path}`}
              aria-current={current === n.page ? 'page' : undefined}
              className={cx(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                current === n.page ? 'bg-ink-100 text-ink-950 dark:bg-white/[0.07] dark:text-white' : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/[0.04] dark:hover:text-ink-100',
              )}
            >
              <Icon name={n.icon} size={16} />
              {n.label}
              {n.page === 'home' && active > 0 && <span className="ml-auto rounded-full bg-brand-600 px-1.5 text-[11px] text-white">{active}</span>}
            </a>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-1">
          {pwa.needRefresh && (
            <Button size="sm" variant="primary" className="w-full" onClick={() => applyUpdate()}>Atualizar aplicativo</Button>
          )}
          {pwa.canInstall && !pwa.installed && (
            <Button size="sm" className="w-full" onClick={() => promptInstall()}><Icon name="download" size={14} /> Instalar ARANDU</Button>
          )}
          <div className="flex items-center justify-between rounded-lg px-1.5 py-1 text-[12px] text-ink-500 dark:text-ink-400">
            <span className="flex items-center gap-1.5"><Icon name="shield" size={13} /> 100% local</span>
            <button
              type="button"
              className="rounded-md p-1.5 hover:bg-ink-100 dark:hover:bg-white/[0.06]"
              aria-label="Alternar tema claro/escuro"
              onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
            >
              <Icon name={dark ? 'sun' : 'moon'} size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Barra superior (mobile/tablet) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-200/70 bg-white/80 px-4 py-3 backdrop-blur pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden dark:border-white/[0.06] dark:bg-ink-950/80">
        <button type="button" onClick={() => navigate('/')} aria-label="ARANDU — início"><Logo size={26} /></button>
        <div className="flex items-center gap-1">
          {pwa.canInstall && !pwa.installed && <Button size="sm" onClick={() => promptInstall()}>Instalar</Button>}
          <button type="button" className="rounded-md p-2" aria-label="Alternar tema" onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}>
            <Icon name={dark ? 'sun' : 'moon'} size={17} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
        {pwa.needRefresh && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm lg:hidden dark:border-brand-500/20 dark:bg-brand-500/10">
            Nova versão disponível. <Button size="sm" variant="primary" onClick={() => applyUpdate()}>Atualizar</Button>
          </div>
        )}
        {children}
      </main>

      {/* Navegação inferior (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-ink-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-white/[0.06] dark:bg-ink-950/90" aria-label="Navegação">
        {NAV.slice(0, 5).map((n) => (
          <a key={n.page} href={`#${n.path}`} aria-current={current === n.page ? 'page' : undefined} className={cx('flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium', current === n.page ? 'text-brand-700 dark:text-brand-300' : 'text-ink-500')}>
            <Icon name={n.icon} size={19} />
            {n.label.split(' ')[0]}
          </a>
        ))}
      </nav>
      <span className="sr-only" aria-live="polite">{s.theme}</span>
    </div>
  );
}
