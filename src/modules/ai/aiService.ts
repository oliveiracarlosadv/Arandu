// Fachada da IA local: gerencia o worker, downloads autorizados, cache e tarefas (resumo, classificação).

import type { Block, SummaryResult } from '../../types';
import { findModel, type Backend, type ModelSpec } from './models';
import { extractiveSummary } from './extractiveSummary';
import { LEGAL_TYPES } from '../legal/classifier';
import { validateGeneratedText } from './quality';

const HF_CACHE = 'transformers-cache';
/** Libera o modelo da memória após este tempo sem uso (o modelo ocupa ~1 GB enquanto carregado). */
export const AI_IDLE_UNLOAD_MS = 90_000;

type Listener = (s: AiState) => void;

export interface AiState {
  status: 'idle' | 'loading' | 'ready' | 'generating' | 'error';
  modelId?: string;
  backend?: Backend;
  progress?: number; // 0..100 durante download/carregamento
  loadedMb?: number;
  totalMb?: number;
  error?: string;
  /** false quando o navegador não guardou o arquivo do modelo no cache (será baixado de novo). */
  persisted?: boolean;
  /** true quando o modelo foi descarregado automaticamente para liberar memória. */
  autoUnloaded?: boolean;
}

let idleTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleIdleUnload() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (state.status === 'ready') releaseWorker(true);
  }, AI_IDLE_UNLOAD_MS);
}

/** Encerra o worker inteiro: libera toda a memória (WASM, GPU) usada pelo modelo. */
function releaseWorker(auto: boolean) {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  worker?.terminate();
  worker = null;
  pending.forEach((p) => p.reject(new Error('Modelo descarregado.')));
  pending.clear();
  setState({ status: 'idle', modelId: undefined, progress: undefined, autoUnloaded: auto });
}

let worker: Worker | null = null;
let state: AiState = { status: 'idle' };
const listeners = new Set<Listener>();
let seq = 0;
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void; onToken?: (n: number, max: number) => void }>();
let loadWaiter: { resolve: () => void; reject: (e: Error) => void } | null = null;

function setState(s: Partial<AiState>) {
  state = { ...state, ...s };
  listeners.forEach((l) => l(state));
}

export const aiState = () => state;
export function subscribeAi(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../../workers/ai.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'progress') {
      if (m.status === 'progress_total' && m.total) {
        setState({ progress: Math.round(m.progress ?? 0), loadedMb: Math.round(m.loaded / 1048576), totalMb: Math.round(m.total / 1048576) });
      }
    } else if (m.type === 'ready') {
      setState({ status: 'ready', progress: 100, autoUnloaded: false });
      loadWaiter?.resolve();
      loadWaiter = null;
      scheduleIdleUnload();
      if (state.modelId) void isModelCached(state.modelId).then((persisted) => setState({ persisted }));
    } else if (m.type === 'token') {
      pending.get(m.id)?.onToken?.(m.produced, m.max);
    } else if (m.type === 'result') {
      pending.get(m.id)?.resolve(m.text);
      pending.delete(m.id);
      setState({ status: 'ready' });
      scheduleIdleUnload();
    } else if (m.type === 'unloaded') {
      setState({ status: 'idle', modelId: undefined, progress: undefined });
    } else if (m.type === 'error') {
      const err = new Error(m.message);
      if (m.id !== undefined && pending.has(m.id)) {
        pending.get(m.id)!.reject(err);
        pending.delete(m.id);
        setState({ status: 'ready' });
      } else {
        setState({ status: 'error', error: m.message });
        loadWaiter?.reject(err);
        loadWaiter = null;
      }
    }
  };
  worker.onerror = (e) => {
    setState({ status: 'error', error: e.message || 'Falha no worker de IA' });
    loadWaiter?.reject(new Error(e.message));
    loadWaiter = null;
  };
  return worker;
}

export function chooseBackend(webgpu: boolean): Backend {
  return webgpu ? 'webgpu' : 'wasm';
}

/** Carrega (e, se necessário, baixa) o modelo. Só deve ser chamado após autorização do usuário. */
export async function loadModel(spec: ModelSpec, backend: Backend, webgpuF16 = true): Promise<void> {
  // Pede armazenamento persistente para o navegador não descartar o modelo (ou recusar o cache).
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
  let { dtype } = spec.variants[backend];
  if (backend === 'webgpu' && dtype === 'q4f16' && !webgpuF16) dtype = 'q4';
  setState({ status: 'loading', modelId: spec.id, backend, progress: 0, error: undefined });
  return new Promise((resolve, reject) => {
    loadWaiter = { resolve, reject };
    getWorker().postMessage({ type: 'load', modelId: spec.id, device: backend, dtype });
  });
}

export function unloadModel() {
  releaseWorker(false);
}

export function generate(messages: { role: string; content: string }[], maxNewTokens: number, onToken?: (n: number, max: number) => void): Promise<string> {
  if (state.status !== 'ready' && state.status !== 'generating') return Promise.reject(new Error('Modelo de IA não carregado.'));
  if (idleTimer) clearTimeout(idleTimer);
  const id = ++seq;
  setState({ status: 'generating' });
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onToken });
    getWorker().postMessage({ type: 'generate', id, messages, maxNewTokens });
  });
}

// ---------- Cache dos modelos ----------

export async function modelCacheInfo(modelId: string): Promise<{ files: number; bytes: number }> {
  if (typeof caches === 'undefined') return { files: 0, bytes: 0 };
  const cache = await caches.open(HF_CACHE);
  let files = 0, bytes = 0;
  for (const req of await cache.keys()) {
    if (!req.url.includes(`/${modelId}/`)) continue;
    files++;
    const res = await cache.match(req);
    const len = Number(res?.headers.get('content-length') || 0);
    bytes += len || (await res?.clone().blob())?.size || 0;
  }
  return { files, bytes };
}

/** Considera instalado quando há um arquivo .onnx do modelo no cache. */
export async function isModelCached(modelId: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  const cache = await caches.open(HF_CACHE);
  return (await cache.keys()).some((r) => r.url.includes(`/${modelId}/`) && /\.onnx(_data)?$/.test(r.url));
}

export async function removeModel(modelId: string): Promise<void> {
  if (state.modelId === modelId) unloadModel();
  const cache = await caches.open(HF_CACHE);
  for (const req of await cache.keys()) if (req.url.includes(`/${modelId}/`)) await cache.delete(req);
}

// ---------- Tarefas ----------

const SYSTEM_PT =
  'Você é um assistente de análise documental. Responda sempre em português do Brasil. ' +
  'Use EXCLUSIVAMENTE as informações presentes no texto fornecido. Não invente fatos, datas, valores, nomes, ' +
  'artigos de lei, súmulas ou jurisprudência. Não confunda alegações das partes com decisões do juízo. ' +
  'Se algo não constar do texto, escreva "Não identificado no documento."';

function chunkText(text: string, size: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + size);
    if (end < text.length) {
      const cut = text.lastIndexOf('\n', end);
      if (cut > i + size * 0.6) end = cut;
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

/** Resumo por IA local (map-reduce) — sempre separado do conteúdo original. */
export async function aiSummary(fullText: string, blocks: Block[], onProgress?: (p: number, label: string) => void): Promise<SummaryResult> {
  const spec = state.modelId ? findModel(state.modelId) : undefined;
  if (!spec || (state.status !== 'ready' && state.status !== 'generating')) {
    return { text: extractiveSummary(blocks), method: 'extrativo' };
  }
  const CHUNK = state.backend === 'webgpu' ? 7000 : 4000;
  let source = fullText;
  const MAX_CHUNKS = state.backend === 'webgpu' ? 8 : 4;
  if (source.length > CHUNK * MAX_CHUNKS) {
    // Documento grande: pré-seleção extrativa (frases literais) para caber no orçamento local.
    source = extractiveSummary(blocks, 60).replace(/ _\(p\. \d+\)_/g, '');
  }
  const chunks = chunkText(source, CHUNK);
  const partials: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i / (chunks.length + 1), `Resumindo parte ${i + 1} de ${chunks.length}`);
    const r = await generate(
      [
        { role: 'system', content: SYSTEM_PT },
        { role: 'user', content: `Resuma objetivamente o trecho abaixo em até 6 tópicos curtos, mantendo números de processo, datas, valores e dispositivos legais exatamente como aparecem.\n\nTRECHO:\n"""\n${chunks[i]}\n"""` },
      ],
      220,
    );
    const q = validateGeneratedText(r);
    if (!q.ok) return rejected(blocks, spec.name, q.reason);
    partials.push(r.trim());
  }
  let text = partials[0] ?? '';
  if (partials.length > 1) {
    onProgress?.(chunks.length / (chunks.length + 1), 'Consolidando resumo');
    text = await generate(
      [
        { role: 'system', content: SYSTEM_PT },
        { role: 'user', content: `Consolide os resumos parciais abaixo (do mesmo documento) em um único resumo de até 10 tópicos, sem repetir informações e sem acrescentar nada que não esteja neles.\n\n${partials.map((p, i) => `PARTE ${i + 1}:\n${p}`).join('\n\n')}` },
      ],
      380,
    );
  }
  const q = validateGeneratedText(text);
  if (!q.ok) return rejected(blocks, spec.name, q.reason);
  onProgress?.(1, 'Resumo concluído');
  return { text: text.trim(), method: 'ia-local', model: spec.name };
}

/** Saída da IA reprovada na trava de qualidade: usa o resumo extrativo e registra o motivo. */
function rejected(blocks: Block[], model: string, reason?: string): SummaryResult {
  return {
    text: extractiveSummary(blocks),
    method: 'extrativo',
    note: `A IA local (${model}) produziu um texto inválido (${reason ?? 'qualidade insuficiente'}), que foi descartado. Foi usado o resumo extrativo, com frases literais do documento.`,
  };
}

/** Verificação de classificação: a IA só pode escolher entre os candidatos das regras. */
export async function aiVerifyClassification(text: string, candidates: string[]): Promise<string | null> {
  if (state.status !== 'ready' || !candidates.length) return null;
  const valid = candidates.filter((c) => (LEGAL_TYPES as readonly string[]).includes(c));
  const r = await generate(
    [
      { role: 'system', content: SYSTEM_PT },
      { role: 'user', content: `Qual é o tipo deste documento? Responda APENAS com uma das opções, exatamente como escrita: ${valid.join(' | ')} | Nenhum.\n\nINÍCIO DO DOCUMENTO:\n"""\n${text.slice(0, 2500)}\n"""` },
    ],
    12,
  );
  const ans = r.trim().replace(/[."']/g, '').toLowerCase();
  return valid.find((c) => ans === c.toLowerCase() || ans.startsWith(c.toLowerCase())) ?? null;
}
