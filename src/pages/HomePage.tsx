import { useEffect, useState } from 'react';
import { LogoMark } from '../components/Logo';
import { DropZone } from '../components/DropZone';
import { JobList } from '../components/JobList';
import { StatusIndicators } from '../components/StatusIndicators';
import { Badge, Button, Icon, Segmented, Toggle, cx } from '../components/ui';
import { enqueue } from '../modules/batch/queue';
import { clearHistory, deleteHistoryEntry, listHistory, type HistoryEntry } from '../services/history';
import { updateSettings, useSettings } from '../services/settings';
import { useAiState, navigate } from '../hooks/useAppState';
import type { ConversionMode } from '../types';
import { fmtDateTime, fmtInt } from '../utils/format';
import { useJobs } from '../modules/batch/queue';

const MODES: { value: ConversionMode; label: string; desc: string }[] = [
  { value: 'fidelity', label: 'Fidelidade máxima', desc: 'Preserva integralmente conteúdo e estrutura; só normaliza o necessário.' },
  { value: 'ai', label: 'Otimizado para IA', desc: 'Remove ruído de formatação, cabeçalhos repetidos e quebras artificiais, sem perder informação.' },
  { value: 'summary', label: 'Resumo inteligente', desc: 'Adiciona uma síntese separada, mantendo o conteúdo integral abaixo.' },
  { value: 'legal', label: 'Jurídico estruturado', desc: 'Destaca partes, pedidos, fundamentos, decisão, prazos e referências legais.' },
];

const MODE_LABEL: Record<ConversionMode, string> = { fidelity: 'Fidelidade', ai: 'Otimizado', summary: 'Resumo', legal: 'Jurídico' };

const NA = 'não identificado';

/** Linha do processo no histórico: autor, réu e tribunal (e número, quando houver). */
function ProcessLine({ p }: { p: NonNullable<HistoryEntry['processo']> }) {
  return (
    <dl className="flex w-full flex-wrap gap-x-4 gap-y-0.5 pl-[26px] text-[12px] text-ink-500 dark:text-ink-400">
      {p.numero && <div><dt className="inline font-medium text-ink-700 dark:text-ink-300">Processo:</dt> <dd className="inline font-mono">{p.numero}</dd></div>}
      <div><dt className="inline font-medium text-ink-700 dark:text-ink-300">Autor:</dt> <dd className="inline">{p.autor ?? NA}</dd></div>
      <div><dt className="inline font-medium text-ink-700 dark:text-ink-300">Réu:</dt> <dd className="inline">{p.reu ?? NA}</dd></div>
      <div><dt className="inline font-medium text-ink-700 dark:text-ink-300">Tribunal:</dt> <dd className="inline">{p.tribunal ?? NA}</dd></div>
    </dl>
  );
}

function History() {
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const jobs = useJobs();
  const doneCount = jobs.filter((j) => j.status === 'done').length;
  useEffect(() => { listHistory().then(setItems).catch(() => setItems([])); }, [doneCount]);
  if (!items?.length) return null;
  return (
    <section className="mt-10" aria-label="Histórico">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-950 dark:text-white">Histórico <span className="font-normal text-ink-500">· somente neste dispositivo</span></h2>
        <Button size="sm" variant="ghost" onClick={async () => { if (confirm('Apagar todo o histórico deste dispositivo?')) { await clearHistory(); setItems([]); } }}>
          <Icon name="trash" size={13} /> Apagar histórico
        </Button>
      </div>
      <div className="card divide-y divide-ink-100 dark:divide-white/[0.05]">
        {items.slice(0, 30).map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
            <Icon name="clock" size={14} className="text-ink-400" />
            <span className="min-w-0 flex-1 truncate font-medium text-ink-900 dark:text-ink-100">{h.fileName}</span>
            <Badge>{MODE_LABEL[h.mode]}</Badge>
            <span className="text-ink-500">{h.documentType}</span>
            <span className="tabular-nums text-ink-500">{fmtInt(h.stats.originalTokens)} → {fmtInt(h.stats.finalTokens)}</span>
            <span className="text-[12px] text-ink-400" title={h.attachedAt ? `Anexado em ${fmtDateTime(h.attachedAt)}` : undefined}>
              {h.attachedAt && <>Anexado {fmtDateTime(h.attachedAt)} · </>}Processado {fmtDateTime(h.createdAt)}
            </span>
            {h.result ? (
              <Button size="sm" onClick={() => navigate(`/resultado/h:${h.id}`)}>Abrir</Button>
            ) : (
              <span className="text-[11.5px] text-ink-400" title="Ative 'Guardar conteúdo dos resultados' nas Configurações para reabrir documentos">só metadados</span>
            )}
            <button type="button" aria-label="Remover do histórico" className="rounded p-1 text-ink-400 hover:text-ink-700" onClick={async () => { await deleteHistoryEntry(h.id); setItems((x) => x?.filter((i) => i.id !== h.id) ?? null); }}>
              <Icon name="x" size={13} />
            </button>
            {h.processo && <ProcessLine p={h.processo} />}
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const s = useSettings();
  const ai = useAiState();
  const aiReady = ai.status === 'ready' || ai.status === 'generating';

  return (
    <div>
      <section className="mb-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <LogoMark size={56} className="shrink-0 rounded-2xl shadow-lg shadow-brand-900/20" />
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink-950 sm:text-[32px] dark:text-white">ARANDU</h1>
          <p className="mt-1 text-[15px] text-ink-600 dark:text-ink-300">Seus documentos. Menos tokens. Mais inteligência.</p>
        </div>
      </section>

      <StatusIndicators />

      <section className="mt-6 card p-4 sm:p-5" aria-label="Opções de conversão">
        <div className="label mb-2.5">Modo de conversão</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Modo de conversão">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={s.mode === m.value}
              onClick={() => updateSettings({ mode: m.value })}
              className={cx(
                'rounded-xl border p-3 text-left transition',
                s.mode === m.value
                  ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500 dark:border-brand-400 dark:bg-brand-500/10 dark:ring-brand-400'
                  : 'border-ink-200 hover:border-ink-300 dark:border-white/[0.08] dark:hover:border-white/20',
              )}
            >
              <div className="text-[13.5px] font-semibold text-ink-950 dark:text-white">{m.label}</div>
              <div className="mt-1 text-[12px] leading-snug text-ink-500 dark:text-ink-400">{m.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-x-8 gap-y-1 border-t border-ink-100 pt-3 md:grid-cols-2 dark:border-white/[0.05]">
          <Toggle checked={s.legalAnalysis} onChange={(v) => updateSettings({ legalAnalysis: v })} label="Análise jurídica" description="Classifica o documento e extrai dados literais (processo, partes, pedidos, prazos…)." />
          <Toggle
            checked={s.useAi && aiReady}
            disabled={!aiReady}
            onChange={(v) => updateSettings({ useAi: v })}
            label="Usar IA local"
            description={aiReady ? 'Resumos e verificação de classificação com o modelo carregado.' : <>Nenhum modelo ativo. <a className="underline" href="#/modelos">Abrir Central de Modelos</a> — sem IA, o resumo é extrativo.</>}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="block text-sm font-medium text-ink-900 dark:text-ink-100">Qualidade do OCR</span>
              <span className="block text-[13px] text-ink-500 dark:text-ink-400">Usada em imagens e páginas digitalizadas.</span>
            </span>
            <Segmented
              size="sm"
              ariaLabel="Qualidade do OCR"
              value={s.ocrQuality}
              onChange={(v) => updateSettings({ ocrQuality: v })}
              options={[
                { value: 'fast', label: 'Rápida', hint: 'Menor resolução, sem correção de orientação' },
                { value: 'balanced', label: 'Equilibrada', hint: 'Contraste + correção de orientação' },
                { value: 'high', label: 'Alta precisão', hint: 'Maior resolução + binarização (Otsu)' },
              ]}
            />
          </div>
          <Toggle checked={s.includePageMarkers} onChange={(v) => updateSettings({ includePageMarkers: v })} label="Marcadores de página" description="Inclui <!-- página N --> para citar a origem (custa poucos tokens)." />
        </div>
      </section>

      <div className="mt-6">
        <DropZone onFiles={(files) => enqueue(files)} />
      </div>

      <JobList />
      <History />
    </div>
  );
}
