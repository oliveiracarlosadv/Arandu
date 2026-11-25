// Histórico local de processamentos. Por padrão guarda apenas metadados e estatísticas;
// o conteúdo convertido só é salvo se o usuário ativar essa opção nas Configurações.

import type { ProcessResult } from '../types';
import { db } from './db';
import { getSettings } from './settings';

export interface HistoryEntry {
  id: string;
  fileName: string;
  createdAt: number;
  documentType: string;
  pageCount: number;
  mode: ProcessResult['mode'];
  stats: ProcessResult['stats'];
  durationMs: number;
  method: ProcessResult['method'];
  /** Presente apenas com autorização (storeResultContent). */
  result?: ProcessResult;
}

export async function addToHistory(r: ProcessResult): Promise<void> {
  const s = getSettings();
  const entry: HistoryEntry = {
    id: r.id,
    fileName: r.fileName,
    createdAt: r.createdAt,
    documentType: r.documentType,
    pageCount: r.pageCount,
    mode: r.mode,
    stats: r.stats,
    durationMs: r.durationMs,
    method: r.method,
    result: s.storeResultContent ? r : undefined,
  };
  await db.put('history', entry);
}

export async function listHistory(): Promise<HistoryEntry[]> {
  await purgeExpired();
  const all = await db.all<HistoryEntry>('history');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function purgeExpired(): Promise<number> {
  const hours = getSettings().autoDeleteHours;
  if (!hours) return 0;
  const limit = Date.now() - hours * 3600_000;
  const all = await db.all<HistoryEntry>('history');
  let n = 0;
  for (const e of all) if (e.createdAt < limit) { await db.delete('history', e.id); n++; }
  return n;
}

export const deleteHistoryEntry = (id: string) => db.delete('history', id);
export const clearHistory = () => db.clear('history');
