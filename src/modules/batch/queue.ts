// Fila de processamento em lote: um documento por vez (controle de memória), progresso individual,
// cancelamento por item ou da fila toda, e falhas isoladas (não interrompem os demais).

import { useSyncExternalStore } from 'react';
import { STEP_LABELS, type Job, type ProcessOptions, type StepState } from '../../types';
import { uid } from '../../utils/format';
import { processFile } from './pipeline';
import { addToHistory } from '../../services/history';

type EnsureOcr = (pages: number) => Promise<boolean>;

let jobs: Job[] = [];
const subs = new Set<() => void>();
const controllers = new Map<string, AbortController>();
let running = false;
let ensureOcrHook: EnsureOcr = async () => false;
let optionsProvider: () => ProcessOptions;

const emit = () => {
  jobs = [...jobs];
  subs.forEach((s) => s());
};

export function configureQueue(cfg: { ensureOcr: EnsureOcr; options: () => ProcessOptions }) {
  ensureOcrHook = cfg.ensureOcr;
  optionsProvider = cfg.options;
}

const freshSteps = (): StepState[] => STEP_LABELS.map(() => ({ status: 'pending' }));

/** Enfileira arquivos com as opções vigentes (ou as informadas), fixadas por arquivo. */
export function enqueue(files: File[], options?: Partial<ProcessOptions>): string[] {
  const now = Date.now();
  const opts: ProcessOptions = { ...optionsProvider(), ...options };
  const added = files.map<Job>((file) => ({ id: uid(), file, status: 'queued', steps: freshSteps(), addedAt: now, options: opts }));
  jobs = [...jobs, ...added];
  emit();
  void run();
  return added.map((j) => j.id);
}

function patch(id: string, fn: (j: Job) => Job) {
  jobs = jobs.map((j) => (j.id === id ? fn(j) : j));
  emit();
}

async function run() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = jobs.find((j) => j.status === 'queued');
      if (!next) break;
      const ctrl = new AbortController();
      controllers.set(next.id, ctrl);
      patch(next.id, (j) => ({ ...j, status: 'running', startedAt: Date.now() }));
      try {
        const result = await processFile(next.file, next.options ?? optionsProvider(), {
          signal: ctrl.signal,
          ensureOcr: ensureOcrHook,
          onStep: (i, st) => patch(next.id, (j) => ({ ...j, steps: j.steps.map((s, k) => (k === i ? st : s)) })),
        });
        const done = { ...result, attachedAt: next.addedAt };
        patch(next.id, (j) => ({ ...j, status: 'done', result: done, finishedAt: done.createdAt }));
        addToHistory(done).catch(() => undefined);
      } catch (e) {
        const cancelled = e instanceof DOMException && e.name === 'AbortError';
        patch(next.id, (j) => ({
          ...j,
          status: cancelled ? 'cancelled' : 'error',
          finishedAt: Date.now(),
          error: cancelled ? 'Cancelado pelo usuário' : e instanceof Error ? e.message : String(e),
          steps: j.steps.map((s) => (s.status === 'running' ? { ...s, status: cancelled ? 'skipped' : 'error' } : s)),
        }));
      } finally {
        controllers.delete(next.id);
      }
    }
  } finally {
    running = false;
  }
}

export function cancelJob(id: string) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  if (job.status === 'queued') patch(id, (j) => ({ ...j, status: 'cancelled', error: 'Cancelado pelo usuário' }));
  controllers.get(id)?.abort();
}

export function stopAll() {
  jobs.filter((j) => j.status === 'queued').forEach((j) => patch(j.id, (x) => ({ ...x, status: 'cancelled', error: 'Fila interrompida' })));
  controllers.forEach((c) => c.abort());
}

export function retryJob(id: string) {
  patch(id, (j) => ({ ...j, status: 'queued', error: undefined, result: undefined, finishedAt: undefined, steps: freshSteps() }));
  void run();
}

export function removeJob(id: string) {
  cancelJob(id);
  jobs = jobs.filter((j) => j.id !== id);
  emit();
}

export function clearFinished() {
  jobs = jobs.filter((j) => j.status === 'running' || j.status === 'queued');
  emit();
}

export function updateJobMarkdown(id: string, markdown: string) {
  patch(id, (j) => (j.result ? { ...j, result: { ...j.result, markdown } } : j));
}

export const getJobs = () => jobs;

export function useJobs(): Job[] {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => jobs,
  );
}
