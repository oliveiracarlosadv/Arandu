// Antes de converter, pergunta o modo de conversão (o último usado vem marcado).

import { useEffect, useState } from 'react';
import { Button, Modal, Toggle, cx } from './ui';
import { MODES } from '../modules/batch/modes';
import { enqueue } from '../modules/batch/queue';
import { getSettings, updateSettings } from '../services/settings';
import type { ConversionMode } from '../types';
import { fmtBytes } from '../utils/format';

type Request = { files: File[]; resolve: (ids: string[]) => void };
let open: ((r: Request) => void) | null = null;

/** Mostra o diálogo de modo e, ao confirmar, enfileira os arquivos. Retorna os ids (vazio se cancelado). */
export function chooseModeAndEnqueue(files: File[]): Promise<string[]> {
  if (!files.length) return Promise.resolve([]);
  return new Promise((resolve) => {
    if (!open) return resolve(enqueue(files));
    open({ files, resolve });
  });
}

export function ModeDialogHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [mode, setMode] = useState<ConversionMode>(getSettings().mode);
  const [legal, setLegal] = useState(getSettings().legalAnalysis);

  useEffect(() => {
    open = (r) => {
      const s = getSettings();
      setMode(s.mode);
      setLegal(s.legalAnalysis);
      setReq(r);
    };
    return () => { open = null; };
  }, []);

  if (!req) return null;
  const close = (ids: string[]) => { req.resolve(ids); setReq(null); };
  const confirm = () => {
    updateSettings({ mode, legalAnalysis: legal }); // lembra a escolha para a próxima vez
    close(enqueue(req.files, { mode, legalAnalysis: legal }));
  };
  const total = req.files.reduce((a, f) => a + f.size, 0);

  return (
    <Modal
      open
      onClose={() => close([])}
      title="Como deseja converter?"
      footer={
        <>
          <Button variant="ghost" onClick={() => close([])}>Cancelar</Button>
          <Button variant="primary" onClick={confirm} autoFocus>
            Converter {req.files.length > 1 ? `${req.files.length} arquivos` : 'arquivo'}
          </Button>
        </>
      }
    >
      <p className="text-[13px]">
        {req.files.length === 1 ? <strong className="text-ink-800 dark:text-ink-100">{req.files[0].name}</strong> : <><strong className="text-ink-800 dark:text-ink-100">{req.files.length} arquivos</strong> ({req.files.slice(0, 3).map((f) => f.name).join(', ')}{req.files.length > 3 ? '…' : ''})</>}
        {' '}· {fmtBytes(total)}
      </p>
      <div role="radiogroup" aria-label="Modo de conversão" className="mt-4 grid gap-2 sm:grid-cols-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            onClick={() => setMode(m.value)}
            className={cx(
              'rounded-xl border p-3 text-left transition',
              mode === m.value
                ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500 dark:border-brand-400 dark:bg-brand-500/10 dark:ring-brand-400'
                : 'border-ink-200 hover:border-ink-300 dark:border-white/[0.08] dark:hover:border-white/20',
            )}
          >
            <div className="text-[13.5px] font-semibold text-ink-950 dark:text-white">{m.label}</div>
            <div className="mt-1 text-[12px] leading-snug text-ink-500 dark:text-ink-400">{m.desc}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 border-t border-ink-100 pt-2 dark:border-white/[0.06]">
        <Toggle checked={legal || mode === 'legal'} disabled={mode === 'legal'} onChange={setLegal} label="Análise jurídica" description="Classifica o documento e extrai processo, partes, pedidos e prazos." />
      </div>
    </Modal>
  );
}
