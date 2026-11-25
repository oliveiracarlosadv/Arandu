import { useEffect, useState } from 'react';
import { Button, Icon, PageHeader, Segmented, Toggle } from '../components/ui';
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '../services/settings';
import { clearHistory } from '../services/history';
import { db } from '../services/db';
import { usePwa, promptInstall } from '../services/pwa';
import { useHardware, refreshOcrStatus } from '../hooks/useAppState';
import { removeOcrAssets } from '../modules/ocr/ocrAssets';
import { fmtBytes } from '../utils/format';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const s = useSettings();
  const pwa = usePwa();
  const hw = useHardware();
  const [usage, setUsage] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);

  const refreshUsage = async () => {
    const est = await navigator.storage?.estimate?.();
    if (est) setUsage(`${fmtBytes(est.usage ?? 0)} usados${est.quota ? ` de ${fmtBytes(est.quota)}` : ''}`);
  };
  useEffect(() => { void refreshUsage(); }, []);

  const wipeAll = async () => {
    if (!confirm('Apagar TODOS os dados do ARANDU neste dispositivo (histórico, Workspace, modelos, OCR e preferências)? Esta ação não pode ser desfeita.')) return;
    await Promise.all([db.clear('history'), db.clear('workspace'), db.clear('cases')]);
    if (typeof caches !== 'undefined') for (const k of await caches.keys()) if (/arandu|transformers/.test(k)) await caches.delete(k);
    await removeOcrAssets();
    localStorage.removeItem('arandu.settings');
    updateSettings({ ...DEFAULT_SETTINGS });
    void refreshOcrStatus();
    void refreshUsage();
    setMsg('Todos os dados locais foram apagados.');
  };

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Preferências, armazenamento local e instalação." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Aparência">
          <Segmented ariaLabel="Tema" value={s.theme} onChange={(v) => updateSettings({ theme: v })} options={[{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }]} />
        </Section>

        <Section title="Instalação (PWA)">
          <p className="text-[13px] text-ink-600 dark:text-ink-300">
            {pwa.installed ? 'O ARANDU está instalado neste dispositivo.' : pwa.canInstall ? 'Este navegador permite instalar o ARANDU como aplicativo.' : 'Para instalar: no Chrome/Edge use o ícone de instalação na barra de endereço; no Safari (macOS) use Arquivo › Adicionar ao Dock; no iPhone/iPad use Compartilhar › Adicionar à Tela de Início; no Android use o menu › Instalar app.'}
          </p>
          <p className="mt-2 text-[13px] text-ink-500">Offline: {pwa.swActive ? 'aplicativo em cache — abre sem internet.' : import.meta.env.DEV ? 'indisponível no modo desenvolvimento (use o build de produção).' : 'aguardando o service worker.'}</p>
          {pwa.canInstall && !pwa.installed && <Button className="mt-3" variant="primary" onClick={() => promptInstall()}><Icon name="download" size={14} /> Instalar ARANDU</Button>}
        </Section>

        <Section title="Processamento">
          <label className="flex items-center justify-between gap-4 py-2">
            <span>
              <span className="block text-sm font-medium">Tamanho máximo por arquivo</span>
              <span className="block text-[13px] text-ink-500">Protege contra arquivos excessivos ou malformados.</span>
            </span>
            <select className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-ink-850" value={s.maxFileSizeMb} onChange={(e) => updateSettings({ maxFileSizeMb: Number(e.target.value) })}>
              {[10, 25, 50, 100, 200, 500].map((n) => <option key={n} value={n}>{n} MB</option>)}
            </select>
          </label>
          <Toggle checked={s.includePageMarkers} onChange={(v) => updateSettings({ includePageMarkers: v })} label="Marcadores de página no Markdown" description="Permitem citar a página de origem." />
          <Toggle checked={s.legalAnalysis} onChange={(v) => updateSettings({ legalAnalysis: v })} label="Análise jurídica" />
        </Section>

        <Section title="Privacidade e armazenamento">
          <Toggle
            checked={s.storeResultContent}
            onChange={(v) => updateSettings({ storeResultContent: v })}
            label="Guardar conteúdo dos resultados no histórico"
            description="Desativado por padrão: o histórico guarda só nome, data e estatísticas. Ative para reabrir documentos depois."
          />
          <label className="flex items-center justify-between gap-4 py-2">
            <span>
              <span className="block text-sm font-medium">Exclusão automática do histórico</span>
              <span className="block text-[13px] text-ink-500">Remove entradas antigas a cada abertura do app.</span>
            </span>
            <select className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-ink-850" value={s.autoDeleteHours} onChange={(e) => updateSettings({ autoDeleteHours: Number(e.target.value) })}>
              <option value={1}>após 1 hora</option><option value={24}>após 24 horas</option><option value={168}>após 7 dias</option><option value={720}>após 30 dias</option><option value={0}>nunca</option>
            </select>
          </label>
          <p className="mt-2 text-[13px] text-ink-500">Armazenamento do navegador: {usage || '—'}{hw?.storageQuotaMb === null ? ' (cota não informada)' : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={async () => { await clearHistory(); setMsg('Histórico apagado.'); void refreshUsage(); }}><Icon name="trash" size={14} /> Apagar histórico</Button>
            <Button variant="danger" onClick={wipeAll}><Icon name="trash" size={14} /> Apagar todos os dados locais</Button>
          </div>
          {msg && <p className="mt-2 text-[13px] text-brand-700 dark:text-brand-300">{msg}</p>}
        </Section>
      </div>
    </div>
  );
}
