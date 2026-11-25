// Indicadores honestos de disponibilidade do motor de IA local e do OCR.

import { useAiState, useHardware, useOcrStatus, useOnline, navigate } from '../hooks/useAppState';
import { useSettings } from '../services/settings';
import { usePwa } from '../services/pwa';
import { findModel } from '../modules/ai/models';
import { cx } from './ui';

function Pill({ tone, label, detail, onClick }: { tone: 'ok' | 'warn' | 'off' | 'busy'; label: string; detail: string; onClick?: () => void }) {
  const dot = { ok: 'bg-brand-500', warn: 'bg-amber-500', off: 'bg-ink-400', busy: 'bg-sky-500 animate-soft-pulse' }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-ink-200/80 bg-white px-3 py-2 text-left transition hover:border-ink-300 dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:border-white/15"
    >
      <span className={cx('h-2 w-2 shrink-0 rounded-full', dot)} />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink-900 dark:text-ink-100">{label}</span>
        <span className="block truncate text-[11.5px] text-ink-500 dark:text-ink-400">{detail}</span>
      </span>
    </button>
  );
}

export function StatusIndicators() {
  const ai = useAiState();
  const ocr = useOcrStatus();
  const hw = useHardware();
  const s = useSettings();
  const online = useOnline();
  const pwa = usePwa();

  const model = ai.modelId ? findModel(ai.modelId) : undefined;
  const aiPill =
    ai.status === 'ready' || ai.status === 'generating'
      ? { tone: 'ok' as const, label: 'IA local ativa', detail: `${model?.name ?? ai.modelId} · ${ai.backend === 'webgpu' ? 'WebGPU' : 'CPU/WASM'}` }
      : ai.status === 'loading'
        ? { tone: 'busy' as const, label: 'Carregando IA local', detail: ai.totalMb ? `${ai.loadedMb}/${ai.totalMb} MB · ${ai.progress ?? 0}%` : 'Preparando…' }
        : ai.status === 'error'
          ? { tone: 'warn' as const, label: 'IA local com erro', detail: ai.error ?? 'Verifique a Central de Modelos' }
          : { tone: 'off' as const, label: 'IA local inativa', detail: s.defaultModelId ? 'Modelo instalado — ativar na Central' : 'Opcional · nenhum modelo baixado' };

  const ocrPill = ocr.ready
    ? { tone: 'ok' as const, label: 'OCR disponível offline', detail: 'Tesseract.js · português' }
    : s.ocrAuthorized
      ? { tone: 'warn' as const, label: 'OCR autorizado', detail: `Recursos em cache: ${ocr.cached}/${ocr.total}` }
      : { tone: 'off' as const, label: 'OCR não preparado', detail: 'Será solicitado quando necessário' };

  const offlinePill = !online
    ? { tone: 'warn' as const, label: 'Sem conexão', detail: pwa.swActive ? 'Modo offline' : 'App não instalado para offline' }
    : pwa.swActive
      ? { tone: 'ok' as const, label: 'Pronto para offline', detail: 'Aplicativo em cache' }
      : { tone: 'off' as const, label: 'Offline indisponível', detail: import.meta.env.DEV ? 'Modo desenvolvimento' : 'Carregando service worker…' };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Pill {...aiPill} onClick={() => navigate('/modelos')} />
      <Pill {...ocrPill} onClick={() => navigate('/modelos')} />
      <Pill {...offlinePill} onClick={() => navigate('/configuracoes')} />
      {hw && !hw.wasm && <p className="text-xs text-red-600 sm:col-span-3">Este navegador não suporta WebAssembly: OCR e IA local não funcionarão.</p>}
    </div>
  );
}
