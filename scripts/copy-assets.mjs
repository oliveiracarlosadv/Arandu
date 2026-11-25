// Copia para public/vendor os binários que o ARANDU precisa servir da própria origem,
// para que OCR e IA local funcionem sem CDN de terceiros (privacidade + offline).
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'vendor');

const copies = [
  // Tesseract.js: worker + núcleos LSTM (com e sem SIMD) + idioma português (best_int)
  ['tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract/core/tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract/core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz', 'tesseract/lang/por.traineddata.gz'],
  // ONNX Runtime Web (usado pelo Transformers.js) — build asyncify (WASM/WebGPU) e build simples (Safari < 26)
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs', 'ort/ort-wasm-simd-threaded.asyncify.mjs'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm', 'ort/ort-wasm-simd-threaded.asyncify.wasm'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'ort/ort-wasm-simd-threaded.mjs'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'ort/ort-wasm-simd-threaded.wasm'],
];

let ok = 0;
for (const [from, to] of copies) {
  const src = join(nm, from);
  if (!existsSync(src)) {
    console.warn(`[arandu] asset ausente: ${from}`);
    continue;
  }
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  ok++;
}
console.log(`[arandu] ${ok}/${copies.length} assets locais copiados para public/vendor`);
