// Registro do Service Worker (vite-plugin-pwa) e instalação do PWA.

import { useSyncExternalStore } from 'react';

interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  canInstall: boolean;
  installed: boolean;
  swActive: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let state: PwaState = {
  needRefresh: false,
  offlineReady: false,
  canInstall: false,
  installed: matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  swActive: false,
};
const subs = new Set<() => void>();
const set = (p: Partial<PwaState>) => { state = { ...state, ...p }; subs.forEach((s) => s()); };

let deferred: BeforeInstallPromptEvent | null = null;
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export async function initPwa() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });
  addEventListener('appinstalled', () => set({ installed: true, canInstall: false }));
  if (import.meta.env.DEV) return; // SW apenas no build de produção
  try {
    const { registerSW } = await import('virtual:pwa-register');
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => set({ needRefresh: true }),
      onOfflineReady: () => set({ offlineReady: true, swActive: true }),
      onRegisteredSW: (_url, reg) => set({ swActive: !!reg?.active || !!navigator.serviceWorker.controller }),
    });
    if (navigator.serviceWorker?.controller) set({ swActive: true });
    navigator.serviceWorker?.ready.then(() => set({ swActive: true })).catch(() => undefined);
  } catch (e) {
    console.warn('[pwa] Service Worker indisponível', e);
  }
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  set({ canInstall: false });
  return outcome === 'accepted';
}

export const applyUpdate = () => updateSW?.(true);

export function usePwa(): PwaState {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);
}
