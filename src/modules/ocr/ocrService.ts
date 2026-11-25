// Serviço de OCR local com Tesseract.js (WebAssembly), idioma português.
// Recursos servidos de /vendor/tesseract (mesma origem) \u2014 nenhuma imagem sai do dispositivo.

import type { Worker as TWorker } from 'tesseract.js';
import type { OcrQuality } from '../../types';
import type { TextItem } from '../layout/layoutEngine';
import { downscale, preprocessForOcr, rotateCanvas, type Canvas2D } from '../image/imageTools';
import { OCR_BASE } from './ocrAssets';

export interface OcrPageResult {
  items: TextItem[];
  width: number;
  height: number;
  confidence: number;
  rotation: 0 | 90 | 180 | 270;
  text: string;
}

let workerPromise: Promise<TWorker> | null = null;
let currentProgress: ((p: number) => void) | null = null;

async function getWorker(): Promise<TWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import('tesseract.js');
      return createWorker('por', OEM.LSTM_ONLY, {
        workerPath: `${OCR_BASE}/worker.min.js`,
        corePath: `${OCR_BASE}/core`,
        langPath: `${OCR_BASE}/lang`,
        workerBlobURL: false,
        cacheMethod: 'none', // o cache é feito pelo Service Worker (Cache Storage)
        gzip: true,
        logger: (m) => {
          if (m.status === 'recognizing text') currentProgress?.(m.progress);
        },
        errorHandler: (e) => console.error('[ocr]', e),
      });
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise.catch(() => null);
    workerPromise = null;
    await w?.terminate();
  }
}

async function toBlob(c: Canvas2D): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type: 'image/png' });
  return new Promise((res, rej) => (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error('toBlob falhou'))), 'image/png'));
}

/** Estima a orientação testando 0/90/180/270° numa versão reduzida e escolhendo a maior confiança. */
async function detectRotation(worker: TWorker, img: Canvas2D): Promise<0 | 90 | 180 | 270> {
  const small = downscale(img, 1200);
  let best: { rot: 0 | 90 | 180 | 270; conf: number } = { rot: 0, conf: -1 };
  for (const rot of [0, 90, 180, 270] as const) {
    const c = rot === 0 ? small : rotateCanvas(small, rot);
    const { data } = await worker.recognize(await toBlob(c));
    const words = data.text.match(/[A-Za-zÀ-ÿ]{3,}/g)?.length ?? 0;
    const score = data.confidence * Math.log2(2 + words);
    if (score > best.conf) best = { rot, conf: score };
    if (rot === 0 && data.confidence > 70 && words > 15) break; // orientação normal com boa confiança
  }
  return best.rot;
}

export async function ocrCanvas(
  source: Canvas2D,
  quality: OcrQuality,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<OcrPageResult> {
  const worker = await getWorker();
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  let img = preprocessForOcr(source, quality);

  currentProgress = null;
  let rotation: 0 | 90 | 180 | 270 = 0;
  if (quality !== 'fast') {
    rotation = await detectRotation(worker, img);
    if (rotation) img = rotateCanvas(img, rotation);
  }
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');

  currentProgress = onProgress ?? null;
  await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' });
  const { data } = await worker.recognize(await toBlob(img), { rotateAuto: true }, { blocks: true, text: true });
  currentProgress = null;

  const items: TextItem[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const lh = Math.max(1, line.rowAttributes?.rowHeight || line.bbox.y1 - line.bbox.y0);
        for (const w of line.words) {
          if (!w.text.trim() || w.confidence < 15) continue;
          items.push({
            text: w.text,
            x: w.bbox.x0,
            y: line.bbox.y0,
            width: w.bbox.x1 - w.bbox.x0,
            height: lh,
            bold: /bold/i.test(w.font_name ?? ''),
          });
        }
      }
    }
  }
  return { items, width: img.width, height: img.height, confidence: data.confidence, rotation, text: data.text };
}
