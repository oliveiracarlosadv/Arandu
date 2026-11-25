// Recursos locais do OCR (servidos pela própria aplicação, nunca por CDN de terceiros).
// "Preparar o OCR" = baixar estes arquivos para o Cache Storage, com autorização do usuário,
// para que funcionem offline.

export const OCR_CACHE = 'arandu-ocr-v1';
export const OCR_BASE = '/vendor/tesseract';

export const OCR_ASSETS: { url: string; label: string; approxBytes: number }[] = [
  { url: `${OCR_BASE}/worker.min.js`, label: 'Worker do Tesseract', approxBytes: 111_000 },
  { url: `${OCR_BASE}/core/tesseract-core-simd-lstm.wasm.js`, label: 'Núcleo OCR (SIMD)', approxBytes: 3_900_000 },
  { url: `${OCR_BASE}/core/tesseract-core-lstm.wasm.js`, label: 'Núcleo OCR (compatível)', approxBytes: 3_900_000 },
  { url: `${OCR_BASE}/core/tesseract-core-relaxedsimd-lstm.wasm.js`, label: 'Núcleo OCR (Relaxed SIMD)', approxBytes: 3_900_000 },
  { url: `${OCR_BASE}/lang/por.traineddata.gz`, label: 'Idioma: português (LSTM best_int)', approxBytes: 1_392_000 },
];

export const OCR_TOTAL_BYTES = OCR_ASSETS.reduce((a, b) => a + b.approxBytes, 0);

export async function ocrAssetsStatus(): Promise<{ ready: boolean; cached: number; total: number }> {
  if (typeof caches === 'undefined') return { ready: false, cached: 0, total: OCR_ASSETS.length };
  const cache = await caches.open(OCR_CACHE);
  let cached = 0;
  for (const a of OCR_ASSETS) {
    if (await cache.match(new URL(a.url, location.origin).href)) cached++;
  }
  return { ready: cached === OCR_ASSETS.length, cached, total: OCR_ASSETS.length };
}

export async function prepareOcrAssets(onProgress?: (loaded: number, total: number) => void): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('Cache Storage indisponível neste navegador.');
  const cache = await caches.open(OCR_CACHE);
  let loaded = 0;
  for (const a of OCR_ASSETS) {
    const url = new URL(a.url, location.origin).href;
    if (!(await cache.match(url))) {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Falha ao obter ${a.label} (${res.status}).`);
      await cache.put(url, res);
    }
    loaded += a.approxBytes;
    onProgress?.(loaded, OCR_TOTAL_BYTES);
  }
}

export async function removeOcrAssets(): Promise<void> {
  if (typeof caches !== 'undefined') await caches.delete(OCR_CACHE);
}
