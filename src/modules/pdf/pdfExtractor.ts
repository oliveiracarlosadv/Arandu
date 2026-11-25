// Extração de PDF com PDF.js: camada de texto nativa por página e OCR automático
// para páginas digitalizadas (sem texto selecionável). Suporta PDFs híbridos.

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Block, ExtractedDocument, OcrQuality, PageInfo } from '../../types';
import {
  buildLines,
  detectRepeatedMarginals,
  linesToBlocks,
  medianHeight,
  pageRawText,
  type PageLayout,
  type TextItem,
} from '../layout/layoutEngine';
import { createCanvas, ctx2d } from '../image/imageTools';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfHooks {
  onPage?: (done: number, total: number) => void;
  /** Solicitado antes do 1º OCR \u2014 permite pedir autorização/preparar recursos. */
  ensureOcr?: (pagesNeeded: number) => Promise<boolean>;
  ocrPage?: (canvas: ReturnType<typeof createCanvas>, pageIndex: number, total: number) => Promise<{ items: TextItem[]; width: number; height: number; confidence: number; rotation: number }>;
  signal?: AbortSignal;
  keepMarginals: boolean;
  ocrQuality: OcrQuality;
}

const OCR_RENDER_SCALE: Record<OcrQuality, number> = { fast: 1.6, balanced: 2.2, high: 2.6 };

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Processamento cancelado', 'AbortError');
}

/** Página sem texto útil (ou com texto ilegível/corrompido) → candidata a OCR. */
function needsOcr(text: string): boolean {
  const t = text.replace(/\s+/g, '');
  if (t.length < 25) return true;
  const bad = (t.match(/[\uFFFD\uE000-\uF8FF]/g) ?? []).length;
  return bad / t.length > 0.3;
}

export async function extractPdf(data: ArrayBuffer, hooks: PdfHooks): Promise<ExtractedDocument> {
  // PDF.js v6 não avalia código do documento (sem eval) e não executa JavaScript embutido.
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    enableXfa: false,
    disableAutoFetch: true,
    maxImageSize: 64 * 1024 * 1024,
    useSystemFonts: false,
  });
  const doc = await task.promise;
  const warnings: string[] = [];
  try {
    const total = doc.numPages;
    const layouts: PageLayout[] = [];
    const pages: PageInfo[] = [];
    const ocrQueue: number[] = [];
    let title: string | undefined;
    try {
      const meta = await doc.getMetadata();
      const t = (meta.info as Record<string, unknown>)?.Title;
      if (typeof t === 'string' && t.trim()) title = t.trim();
    } catch { /* metadados opcionais */ }

    for (let i = 1; i <= total; i++) {
      aborted(hooks.signal);
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const ops = await page.getOperatorList();
      const hasImage = ops.fnArray.some(
        (f) => f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject || f === pdfjs.OPS.paintImageMaskXObject,
      );
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const raw of content.items) {
        if (!('str' in raw) || !raw.str) continue;
        const [, , c, d, e, f] = raw.transform as number[];
        const h = raw.height || Math.hypot(c, d) || 10;
        const [vx, vy] = viewport.convertToViewportPoint(e, f);
        let bold = false;
        try {
          const font = page.commonObjs.has(raw.fontName) ? page.commonObjs.get(raw.fontName) : null;
          bold = !!font && (/bold|black|heavy|semibold/i.test(font.name ?? '') || font.bold === true);
        } catch { /* fonte não carregada */ }
        items.push({ text: raw.str, x: vx, y: vy - h, width: raw.width, height: h, bold });
      }
      const pageText = items.map((it) => it.text).join(' ');
      const layout: PageLayout = { page: i, width: viewport.width, height: viewport.height, lines: buildLines(items) };
      layouts.push(layout);
      if (needsOcr(pageText) && hasImage) {
        ocrQueue.push(i);
        pages.push({ number: i, method: 'ocr' });
      } else {
        pages.push({ number: i, method: pageText.trim() ? 'texto' : 'vazia' });
      }
      page.cleanup();
      hooks.onPage?.(i, total);
    }

    let ocrDone = 0;
    if (ocrQueue.length) {
      const allowed = hooks.ensureOcr ? await hooks.ensureOcr(ocrQueue.length) : false;
      if (!allowed || !hooks.ocrPage) {
        warnings.push(`${ocrQueue.length} página(s) digitalizada(s) não foram processadas: OCR não autorizado ou indisponível.`);
        for (const n of ocrQueue) pages[n - 1].method = 'vazia';
      } else {
        for (const n of ocrQueue) {
          aborted(hooks.signal);
          const page = await doc.getPage(n);
          const vp = page.getViewport({ scale: OCR_RENDER_SCALE[hooks.ocrQuality] });
          const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
          const ctx = ctx2d(canvas);
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas: canvas as HTMLCanvasElement, canvasContext: ctx as CanvasRenderingContext2D, viewport: vp }).promise;
          page.cleanup();
          const r = await hooks.ocrPage(canvas, ocrDone, ocrQueue.length);
          canvas.width = 0; // libera a memória da página renderizada
          canvas.height = 0;
          layouts[n - 1] = { page: n, width: r.width, height: r.height, lines: buildLines(r.items) };
          pages[n - 1] = { number: n, method: 'ocr', ocrConfidence: Math.round(r.confidence), rotation: r.rotation };
          if (r.confidence < 60) warnings.push(`Página ${n}: OCR com baixa confiança (${Math.round(r.confidence)}%). Revise o resultado.`);
          ocrDone++;
        }
      }
    }

    const marginals = detectRepeatedMarginals(layouts);
    const bodyHeight = medianHeight(layouts);
    const seen = new Set<string>();
    const blocks: Block[] = [];
    const rawParts: string[] = [];
    for (const layout of layouts) {
      blocks.push({ kind: 'pagebreak', page: layout.page });
      // Alturas do OCR estão em outra escala: usar mediana da própria página.
      const isOcr = pages[layout.page - 1].method === 'ocr';
      const { blocks: b } = linesToBlocks(layout, {
        marginals,
        bodyHeight: isOcr ? 0 : bodyHeight,
        keepMarginals: hooks.keepMarginals,
        seenMarginals: seen,
      });
      blocks.push(...b);
      rawParts.push(pageRawText(layout));
    }

    const ocrCount = pages.filter((p) => p.method === 'ocr').length;
    const textCount = pages.filter((p) => p.method === 'texto').length;
    return {
      blocks,
      rawText: rawParts.join('\n\n'),
      pages,
      pageCount: total,
      method: ocrCount && textCount ? 'hibrido' : ocrCount ? 'ocr' : 'texto-nativo',
      ocrPageCount: ocrCount,
      repeatedMarginals: [...marginals],
      warnings,
      title,
    };
  } finally {
    await task.destroy();
  }
}
