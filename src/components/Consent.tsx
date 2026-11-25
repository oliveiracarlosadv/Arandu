// Diálogos de consentimento: nenhum recurso grande é baixado sem informar o tamanho e pedir autorização.

import { useEffect, useState } from 'react';
import { Button, Modal, ProgressBar } from './ui';
import { OCR_TOTAL_BYTES, prepareOcrAssets } from '../modules/ocr/ocrAssets';
import { refreshOcrStatus } from '../hooks/useAppState';
import { getSettings, updateSettings } from '../services/settings';
import { fmtBytes } from '../utils/format';

type Request = { kind: 'ocr'; pages: number; resolve: (ok: boolean) => void };

let open: ((r: Request) => void) | null = null;
let busy: Promise<boolean> | null = null;

/** Garante os recursos de OCR. Pede autorização uma vez (com tamanho) e baixa para uso offline. */
export function ensureOcrWithConsent(pages: number): Promise<boolean> {
  const s = getSettings();
  if (s.ocrAuthorized) {
    // Autorizado: prepara o cache em segundo plano (para offline); o OCR já pode rodar.
    void prepareOcrAssets().then(refreshOcrStatus).catch(() => undefined);
    return Promise.resolve(true);
  }
  if (busy) return busy;
  busy = new Promise<boolean>((resolve) => {
    if (!open) return resolve(false);
    open({ kind: 'ocr', pages, resolve });
  }).finally(() => { busy = null; });
  return busy;
}

export function ConsentHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    open = (r) => { setReq(r); setProgress(null); setError(null); };
    return () => { open = null; };
  }, []);

  if (!req) return null;
  const close = (ok: boolean) => { req.resolve(ok); setReq(null); };

  const accept = async () => {
    setProgress(0);
    try {
      await prepareOcrAssets((l, t) => setProgress(l / t));
      updateSettings({ ocrAuthorized: true });
      await refreshOcrStatus();
      close(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    }
  };

  return (
    <Modal
      open
      onClose={() => progress === null && close(false)}
      title="Preparar o OCR local?"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)} disabled={progress !== null}>Agora não</Button>
          <Button variant="primary" onClick={accept} disabled={progress !== null}>
            {progress !== null ? 'Preparando…' : `Preparar OCR (${fmtBytes(OCR_TOTAL_BYTES)})`}
          </Button>
        </>
      }
    >
      <p>
        {req.pages} página(s) não têm texto selecionável e precisam de reconhecimento óptico (OCR). O ARANDU usa o
        <strong> Tesseract.js</strong> com o idioma português, executado inteiramente no seu dispositivo.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>Download único de cerca de <strong>{fmtBytes(OCR_TOTAL_BYTES)}</strong>, servido pelo próprio ARANDU (sem serviços de terceiros).</li>
        <li>Depois de preparado, o OCR funciona offline.</li>
        <li>As imagens dos seus documentos nunca saem do dispositivo.</li>
      </ul>
      {progress !== null && <ProgressBar value={progress} className="mt-4" />}
      {error && <p className="mt-3 text-red-600 dark:text-red-400">Falha: {error}</p>}
    </Modal>
  );
}
