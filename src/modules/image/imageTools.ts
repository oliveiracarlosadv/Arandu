// Carregamento e pré-processamento de imagens para OCR (tudo no navegador, via Canvas).

import type { OcrQuality } from '../../types';

export type Canvas2D = HTMLCanvasElement | OffscreenCanvas;

export function createCanvas(w: number, h: number): Canvas2D {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: Canvas2D): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
  return ctx;
}

/** Limite de pixels para evitar estouro de memória com imagens gigantes (≈ 40 MP). */
const MAX_PIXELS = 40_000_000;

/** Decodifica PNG/JPG/WEBP via createImageBitmap e TIFF (multipágina) via UTIF. */
export async function decodeImageFile(file: File, format: string): Promise<Canvas2D[]> {
  if (format === 'tiff') return decodeTiff(await file.arrayBuffer());
  const bmp = await createImageBitmap(file);
  try {
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (bmp.width * bmp.height)));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const c = createCanvas(w, h);
    const ctx = ctx2d(c);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    return [c];
  } finally {
    bmp.close();
  }
}

async function decodeTiff(buf: ArrayBuffer): Promise<Canvas2D[]> {
  const UTIF = (await import('utif')).default;
  const ifds = UTIF.decode(buf);
  const pages: Canvas2D[] = [];
  for (const ifd of ifds.slice(0, 500)) {
    const w = ifd.width as number, h = ifd.height as number;
    if (!w || !h) continue;
    if (w * h > MAX_PIXELS) throw new Error(`Página TIFF muito grande (${w}×${h}).`);
    UTIF.decodeImage(buf, ifd);
    const rgba = UTIF.toRGBA8(ifd);
    const c = createCanvas(w, h);
    const ctx = ctx2d(c);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength), w, h), 0, 0);
    pages.push(c);
  }
  if (!pages.length) throw new Error('Nenhuma página válida encontrada no TIFF.');
  return pages;
}

/** Escala-alvo do lado maior conforme a qualidade de OCR. */
export function targetLongSide(q: OcrQuality): number {
  return q === 'fast' ? 1800 : q === 'balanced' ? 2600 : 3400;
}

/**
 * Pré-processamento: redimensiona para resolução adequada, converte para tons de cinza,
 * estica o contraste (percentis 2\u201398%) e, em alta precisão, binariza com Otsu.
 */
export function preprocessForOcr(src: Canvas2D, q: OcrQuality): Canvas2D {
  const long = Math.max(src.width, src.height);
  const target = targetLongSide(q);
  const scale = long < target * 0.7 ? Math.min(2.5, target / long) : long > target * 1.4 ? target / long : 1;
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);
  const out = createCanvas(w, h);
  const ctx = ctx2d(out);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  if (q === 'fast') return out;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    gray[p] = g;
    hist[g | 0]++;
  }
  const total = w * h;
  let lo = 0, hi = 255, acc = 0;
  // O texto costuma ocupar < 2% dos pixels: o ponto escuro vem dos 0,2% mais escuros e o claro
  // dos 5% mais claros (fundo). Assim o ruído do papel não é amplificado.
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * 0.002) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * 0.05) { hi = i; break; } }
  // Contraste já suficiente ou faixa degenerada: não estica (evita realçar ruído).
  if (hi - lo < 40 || (lo < 40 && hi > 215)) { lo = 0; hi = 255; }
  const range = Math.max(1, hi - lo);

  let threshold = -1;
  if (q === 'high') {
    // Otsu sobre o histograma já esticado
    const h2 = new Uint32Array(256);
    for (let p = 0; p < total; p++) h2[Math.max(0, Math.min(255, ((gray[p] - lo) * 255) / range)) | 0]++;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * h2[i];
    let sumB = 0, wB = 0, best = 0;
    for (let i = 0; i < 256; i++) {
      wB += h2[i];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += i * h2[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) ** 2;
      if (between > best) { best = between; threshold = i; }
    }
  }
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let v = Math.max(0, Math.min(255, ((gray[p] - lo) * 255) / range));
    if (threshold >= 0) v = v > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export function rotateCanvas(src: Canvas2D, deg: 90 | 180 | 270): Canvas2D {
  const swap = deg !== 180;
  const out = createCanvas(swap ? src.height : src.width, swap ? src.width : src.height);
  const ctx = ctx2d(out);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src as CanvasImageSource, -src.width / 2, -src.height / 2);
  return out;
}

export function downscale(src: Canvas2D, maxSide: number): Canvas2D {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  if (s === 1) return src;
  const out = createCanvas(Math.round(src.width * s), Math.round(src.height * s));
  ctx2d(out).drawImage(src as CanvasImageSource, 0, 0, out.width, out.height);
  return out;
}
