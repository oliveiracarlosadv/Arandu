/// <reference lib="webworker" />
// Worker de IA local: executa modelos de linguagem via Transformers.js (ONNX Runtime Web)
// isolado da interface. Nenhum texto sai do dispositivo: o único tráfego de rede é o download
// dos arquivos do modelo (autorizado pelo usuário) a partir do Hugging Face.

import { env, pipeline, TextStreamer, type TextGenerationPipeline } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
// Runtime ONNX servido pela própria aplicação (sem CDN de terceiros)
const ortPaths = (suffix: string) => ({
  mjs: new URL(`/vendor/ort/ort-wasm-simd-threaded${suffix}.mjs`, self.location.origin).href,
  wasm: new URL(`/vendor/ort/ort-wasm-simd-threaded${suffix}.wasm`, self.location.origin).href,
});

type InMsg =
  | { type: 'load'; modelId: string; device: 'webgpu' | 'wasm'; dtype: string }
  | { type: 'generate'; id: number; messages: { role: string; content: string }[]; maxNewTokens: number }
  | { type: 'unload' };

let generator: TextGenerationPipeline | null = null;
let loadedKey = '';

const post = (m: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'load') {
      const key = `${msg.modelId}|${msg.device}|${msg.dtype}`;
      if (generator && loadedKey === key) return post({ type: 'ready', modelId: msg.modelId });
      await generator?.dispose();
      generator = null;
      const onnx = (env.backends as { onnx?: { wasm?: { wasmPaths?: unknown; numThreads?: number } } }).onnx;
      if (onnx?.wasm) {
        // Build asyncify (suporta WebGPU e WASM). Sem isolamento de origem não há threads.
        onnx.wasm.wasmPaths = ortPaths('.asyncify');
        if (!self.crossOriginIsolated) onnx.wasm.numThreads = 1;
      }
      generator = (await pipeline('text-generation', msg.modelId, {
        device: msg.device,
        dtype: msg.dtype as 'q4f16',
        progress_callback: (p: { status: string; progress?: number; loaded?: number; total?: number; file?: string }) => {
          if (p.status === 'progress_total' || p.status === 'progress') {
            post({ type: 'progress', status: p.status, file: p.file, progress: p.progress, loaded: p.loaded, total: p.total });
          }
        },
      })) as TextGenerationPipeline;
      loadedKey = key;
      post({ type: 'ready', modelId: msg.modelId });
    } else if (msg.type === 'generate') {
      if (!generator) throw new Error('Nenhum modelo carregado.');
      let produced = 0;
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (t: string) => {
          produced++;
          post({ type: 'token', id: msg.id, text: t, produced, max: msg.maxNewTokens });
        },
      });
      const out = await generator(msg.messages as never, {
        max_new_tokens: msg.maxNewTokens,
        do_sample: false,
        repetition_penalty: 1.1,
        streamer,
      });
      const first = (Array.isArray(out) ? out[0] : out) as { generated_text: string | { role: string; content: string }[] };
      const gen = first.generated_text;
      const text = Array.isArray(gen) ? gen[gen.length - 1]?.content ?? '' : gen;
      post({ type: 'result', id: msg.id, text });
    } else if (msg.type === 'unload') {
      await generator?.dispose();
      generator = null;
      loadedKey = '';
      post({ type: 'unloaded' });
    }
  } catch (e) {
    post({ type: 'error', id: 'id' in msg ? msg.id : undefined, message: e instanceof Error ? e.message : String(e) });
  }
};
