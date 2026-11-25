// Hooks de estado global: rota (hash), hardware, OCR, IA e PWA.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { detectHardware, type HardwareInfo } from '../modules/ai/hardware';
import { aiState, subscribeAi, type AiState } from '../modules/ai/aiService';
import { ocrAssetsStatus } from '../modules/ocr/ocrAssets';

// ---------- Rota ----------
export type Route = { page: 'home' | 'result' | 'workspace' | 'models' | 'settings' | 'privacy' | 'about'; param?: string };

function parseHash(): Route {
  const [, page = '', param] = location.hash.replace(/^#/, '').split('/');
  const map: Record<string, Route['page']> = { '': 'home', resultado: 'result', workspace: 'workspace', modelos: 'models', configuracoes: 'settings', privacidade: 'privacy', sobre: 'about' };
  return { page: map[page] ?? 'home', param: param ? decodeURIComponent(param) : undefined };
}

export function navigate(path: string) {
  location.hash = path;
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (cb) => {
      addEventListener('hashchange', cb);
      return () => removeEventListener('hashchange', cb);
    },
    () => location.hash,
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemoRoute(hash);
}
const routeCache = new Map<string, Route>();
function useMemoRoute(hash: string): Route {
  if (!routeCache.has(hash)) routeCache.set(hash, parseHash());
  return routeCache.get(hash)!;
}

// ---------- Hardware ----------
let hwPromise: Promise<HardwareInfo> | null = null;
export function useHardware(): HardwareInfo | null {
  const [hw, setHw] = useState<HardwareInfo | null>(null);
  useEffect(() => {
    hwPromise ??= detectHardware();
    hwPromise.then(setHw);
  }, []);
  return hw;
}

// ---------- OCR ----------
type OcrStatus = { ready: boolean; cached: number; total: number; checked: boolean };
let ocr: OcrStatus = { ready: false, cached: 0, total: 0, checked: false };
const ocrSubs = new Set<() => void>();
export async function refreshOcrStatus() {
  ocr = { ...(await ocrAssetsStatus()), checked: true };
  ocrSubs.forEach((s) => s());
}
export function useOcrStatus(): OcrStatus {
  useEffect(() => { if (!ocr.checked) void refreshOcrStatus(); }, []);
  return useSyncExternalStore((cb) => { ocrSubs.add(cb); return () => ocrSubs.delete(cb); }, () => ocr);
}

// ---------- IA ----------
export function useAiState(): AiState {
  return useSyncExternalStore((cb) => { const u = subscribeAi(cb); return () => { u(); }; }, aiState);
}

// ---------- Online/offline ----------
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => { addEventListener('online', cb); addEventListener('offline', cb); return () => { removeEventListener('online', cb); removeEventListener('offline', cb); }; },
    () => navigator.onLine,
  );
}
