// Preferências do usuário (localStorage — não contém conteúdo de documentos).

import { useSyncExternalStore } from 'react';
import type { ConversionMode, HardwareProfile, OcrQuality } from '../types';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  mode: ConversionMode;
  ocrQuality: OcrQuality;
  legalAnalysis: boolean;
  includePageMarkers: boolean;
  useAi: boolean;
  defaultModelId: string | null;
  profile: HardwareProfile | null; // null = automático
  maxFileSizeMb: number;
  /** Guardar o Markdown resultante no histórico (desativado por padrão — privacidade). */
  storeResultContent: boolean;
  /** Exclusão automática do histórico após N horas (0 = nunca). */
  autoDeleteHours: number;
  ocrAuthorized: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  mode: 'ai',
  ocrQuality: 'balanced',
  legalAnalysis: true,
  includePageMarkers: true,
  useAi: false,
  defaultModelId: null,
  profile: null,
  maxFileSizeMb: 100,
  storeResultContent: false,
  autoDeleteHours: 24,
  ocrAuthorized: false,
};

const KEY = 'arandu.settings';
let current: Settings = load();
const subs = new Set<() => void>();

function load(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  applyTheme();
  subs.forEach((s) => s());
}

export function applyTheme() {
  const t = current.theme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#04140f' : '#064e3b');
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => current,
  );
}
