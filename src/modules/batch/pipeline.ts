// Pipeline de processamento de um documento: etapas reais, com progresso mensurável.
// Extração determinística → OCR quando necessário → análise jurídica → IA local (opcional)
// → otimização → Markdown → métricas e validação de integridade.

import type { Block, ExtractedDocument, LegalAnalysis, ProcessOptions, ProcessResult, ProgressFn, SourceFormat, SummaryResult } from '../../types';
import { validateFile, IMAGE_FORMATS, FORMAT_LABEL } from '../../utils/fileValidation';
import { uid } from '../../utils/format';
import { optimizeBlocks } from '../markdown/optimizer';
import { renderMarkdown } from '../markdown/renderer';
import { checkIntegrity } from '../markdown/integrity';
import { analyzeLegal } from '../legal/extractor';
import { classifyLegal } from '../legal/classifier';
import { legalHeaderMarkdown, summaryMarkdown } from '../legal/legalMarkdown';
import { countTokens, TOKENIZER_LABEL } from '../tokens/tokenEstimator';
import { extractiveSummary } from '../ai/extractiveSummary';
import { aiState, aiSummary, aiVerifyClassification } from '../ai/aiService';
import { buildLines, linesToBlocks, pageRawText, type PageLayout } from '../layout/layoutEngine';
import type { Canvas2D } from '../image/imageTools';

export interface PipelineHooks {
  onStep: ProgressFn;
  /** Garante recursos de OCR (pede autorização/baixa se preciso). Retorna false se o usuário recusar. */
  ensureOcr: (pages: number) => Promise<boolean>;
  signal?: AbortSignal;
}

const METHOD_LABEL: Record<ExtractedDocument['method'], string> = {
  'texto-nativo': 'Camada de texto nativa (PDF.js)',
  ocr: 'OCR local (Tesseract.js)',
  hibrido: 'Híbrido: texto nativo + OCR',
  'estrutura-docx': 'Estrutura DOCX (Mammoth.js)',
  'estrutura-odt': 'Estrutura ODT (OpenDocument XML)',
  rtf: 'Parser RTF local',
  'texto-simples': 'Texto simples',
};
export const methodLabel = (m: ExtractedDocument['method']) => METHOD_LABEL[m];

function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Processamento cancelado', 'AbortError');
}

async function extractImage(file: File, format: SourceFormat, opts: ProcessOptions, hooks: PipelineHooks): Promise<ExtractedDocument> {
  const { decodeImageFile } = await import('../image/imageTools');
  hooks.onStep(2, { status: 'running', detail: 'Decodificando imagem' });
  const canvases: Canvas2D[] = await decodeImageFile(file, format);
  hooks.onStep(2, { status: 'done', detail: `${canvases.length} página(s) de imagem` });
  hooks.onStep(3, { status: 'done', detail: 'Imagem sem camada de texto: OCR necessário' });
  const allowed = await hooks.ensureOcr(canvases.length);
  if (!allowed) throw new Error('OCR não autorizado. Imagens exigem OCR para extrair texto.');
  const { ocrCanvas } = await import('../ocr/ocrService');
  const blocks: Block[] = [];
  const raw: string[] = [];
  const pages: ExtractedDocument['pages'] = [];
  const warnings: string[] = [];
  for (let i = 0; i < canvases.length; i++) {
    check(hooks.signal);
    hooks.onStep(4, { status: 'running', detail: `Página ${i + 1} de ${canvases.length}`, progress: i / canvases.length });
    const r = await ocrCanvas(canvases[i], opts.ocrQuality, (p) => hooks.onStep(4, { status: 'running', detail: `Página ${i + 1} de ${canvases.length} — ${Math.round(p * 100)}%`, progress: (i + p) / canvases.length }), hooks.signal);
    const layout: PageLayout = { page: i + 1, width: r.width, height: r.height, lines: buildLines(r.items) };
    blocks.push({ kind: 'pagebreak', page: i + 1 }, ...linesToBlocks(layout, { marginals: new Set(), bodyHeight: 0, keepMarginals: true, seenMarginals: new Set() }).blocks);
    raw.push(pageRawText(layout));
    pages.push({ number: i + 1, method: 'ocr', ocrConfidence: Math.round(r.confidence), rotation: r.rotation });
    if (r.rotation) warnings.push(`Página ${i + 1}: orientação corrigida (${r.rotation}°).`);
    if (r.confidence < 60) warnings.push(`Página ${i + 1}: OCR com baixa confiança (${Math.round(r.confidence)}%). Revise o resultado.`);
  }
  hooks.onStep(4, { status: 'done', detail: `${canvases.length} página(s) reconhecidas` });
  return { blocks, rawText: raw.join('\n\n'), pages, pageCount: canvases.length, method: 'ocr', ocrPageCount: canvases.length, repeatedMarginals: [], warnings };
}

async function extract(file: File, format: SourceFormat, buf: ArrayBuffer, opts: ProcessOptions, hooks: PipelineHooks): Promise<ExtractedDocument> {
  const keepMarginals = opts.mode === 'fidelity';
  switch (format) {
    case 'pdf': {
      const { extractPdf } = await import('../pdf/pdfExtractor');
      const { ocrCanvas } = await import('../ocr/ocrService');
      let ocrStarted = false;
      const doc = await extractPdf(buf, {
        keepMarginals,
        ocrQuality: opts.ocrQuality,
        signal: hooks.signal,
        onPage: (done, total) => {
          hooks.onStep(2, { status: done === total ? 'done' : 'running', detail: `Página ${done} de ${total}`, progress: done / total });
          if (done === total) hooks.onStep(3, { status: 'running', detail: 'Reconstruindo parágrafos, títulos e tabelas' });
        },
        ensureOcr: async (n) => {
          hooks.onStep(3, { status: 'done', detail: `${n} página(s) sem texto selecionável` });
          return hooks.ensureOcr(n);
        },
        ocrPage: async (canvas, idx, total) => {
          ocrStarted = true;
          const r = await ocrCanvas(canvas, opts.ocrQuality, (p) => hooks.onStep(4, { status: 'running', detail: `Página digitalizada ${idx + 1} de ${total} — ${Math.round(p * 100)}%`, progress: (idx + p) / total }), hooks.signal);
          return r;
        },
      });
      hooks.onStep(3, { status: 'done', detail: `${doc.pageCount} página(s) · ${methodLabel(doc.method)}` });
      hooks.onStep(4, ocrStarted ? { status: 'done', detail: `${doc.ocrPageCount} página(s) via OCR` } : { status: 'skipped', detail: 'Não necessário: todas as páginas têm texto' });
      return doc;
    }
    case 'docx': {
      hooks.onStep(2, { status: 'running', detail: 'Validando contêiner DOCX' });
      const { extractDocx } = await import('../docx/docxExtractor');
      const doc = await extractDocx(buf);
      hooks.onStep(2, { status: 'done', detail: 'Estrutura Office Open XML válida' });
      hooks.onStep(3, { status: 'done', detail: `${doc.blocks.length} blocos estruturais` });
      hooks.onStep(4, { status: 'skipped', detail: 'Não necessário' });
      return doc;
    }
    case 'odt': {
      hooks.onStep(2, { status: 'running', detail: 'Validando contêiner ODT' });
      const { extractOdt } = await import('../odt/odtExtractor');
      const doc = await extractOdt(buf);
      hooks.onStep(2, { status: 'done', detail: 'Estrutura OpenDocument válida' });
      hooks.onStep(3, { status: 'done', detail: `${doc.blocks.length} blocos estruturais` });
      hooks.onStep(4, { status: 'skipped', detail: 'Não necessário' });
      return doc;
    }
    case 'rtf': {
      hooks.onStep(2, { status: 'done', detail: 'Assinatura RTF válida' });
      const { parseRtf } = await import('../rtf/rtfParser');
      const { decodeText } = await import('../txt/txtExtractor');
      const { text } = decodeText(buf);
      // RTF é ASCII com escapes; se veio como UTF-8 válido, usa; senão latin1
      const r = parseRtf(text.startsWith('{\\rtf') ? text : new TextDecoder('latin1').decode(buf));
      hooks.onStep(3, { status: 'done', detail: `${r.blocks.length} blocos` });
      hooks.onStep(4, { status: 'skipped', detail: 'Não necessário' });
      return { blocks: r.blocks, rawText: r.text, pages: [], pageCount: Math.max(1, Math.round(r.text.length / 3000)), method: 'rtf', ocrPageCount: 0, repeatedMarginals: [], warnings: [] };
    }
    case 'txt': {
      const { decodeText, textToBlocks } = await import('../txt/txtExtractor');
      const { text, encoding } = decodeText(buf);
      hooks.onStep(2, { status: 'done', detail: `Codificação: ${encoding}` });
      const blocks = textToBlocks(text);
      hooks.onStep(3, { status: 'done', detail: `${blocks.length} blocos` });
      hooks.onStep(4, { status: 'skipped', detail: 'Não necessário' });
      return { blocks, rawText: text, pages: [], pageCount: Math.max(1, Math.round(text.length / 3000)), method: 'texto-simples', ocrPageCount: 0, repeatedMarginals: [], warnings: [] };
    }
    default:
      if (IMAGE_FORMATS.includes(format)) return extractImage(file, format, opts, hooks);
      throw new Error('Formato não suportado.');
  }
}

function shiftHeadings(blocks: Block[], by: number): Block[] {
  return blocks.map((b) => (b.kind === 'heading' ? { ...b, level: Math.min(6, b.level + by) as 1 } : b));
}

export async function processFile(file: File, opts: ProcessOptions, hooks: PipelineHooks): Promise<ProcessResult> {
  const t0 = performance.now();
  const { onStep } = hooks;

  onStep(0, { status: 'running', detail: file.name });
  const buf = await file.arrayBuffer();
  onStep(0, { status: 'done', detail: `${(file.size / 1048576).toFixed(2)} MB lidos na memória local` });
  check(hooks.signal);

  onStep(1, { status: 'running' });
  const v = await validateFile(file, opts.maxFileSizeMb);
  if (!v.ok || !v.format) throw new Error(v.error ?? 'Arquivo inválido.');
  const format = v.format;
  onStep(1, { status: 'done', detail: `${FORMAT_LABEL[format]} (assinatura verificada)` });
  check(hooks.signal);

  onStep(2, { status: 'running' });
  const doc = await extract(file, format, buf, opts, hooks);
  check(hooks.signal);
  if (!doc.blocks.length && !doc.rawText.trim()) throw new Error('Nenhum texto pôde ser extraído do documento.');

  // ---- Processamento inteligente ----
  onStep(5, { status: 'running', detail: 'Análise jurídica por regras locais' });
  const plain = doc.rawText;
  let legal: LegalAnalysis | undefined;
  let documentType = 'Documento';
  if (opts.legalAnalysis) {
    legal = analyzeLegal(doc.blocks, plain);
    documentType = legal.isLegal ? legal.documentType : 'Documento não jurídico';
    const aiReady = opts.useAi && aiState().status === 'ready';
    if (aiReady && legal.isLegal && legal.typeConfidence < 0.6) {
      onStep(5, { status: 'running', detail: 'Verificando classificação com IA local' });
      const cands = classifyLegal(plain).ranking.filter((r) => r.score > 0).slice(0, 4).map((r) => r.type);
      try {
        const pick = await aiVerifyClassification(plain, cands);
        if (pick) {
          legal.documentType = pick;
          legal.classificationSource = 'regras+ia';
          documentType = pick;
        }
      } catch { /* IA opcional: mantém classificação por regras */ }
    }
  }
  check(hooks.signal);
  let summary: SummaryResult | undefined;
  const wantsSummary = opts.mode === 'summary' || (opts.mode === 'legal' && opts.useAi);
  if (wantsSummary) {
    if (opts.useAi && aiState().status === 'ready') {
      summary = await aiSummary(plain, doc.blocks, (p, label) => onStep(5, { status: 'running', detail: label, progress: p }));
    } else {
      summary = { text: extractiveSummary(doc.blocks), method: 'extrativo' };
    }
  }
  onStep(5, {
    status: opts.legalAnalysis || wantsSummary ? 'done' : 'skipped',
    detail: [legal ? `Tipo: ${documentType}` : null, summary ? (summary.method === 'ia-local' ? `Resumo por IA (${summary.model})` : 'Resumo extrativo') : null].filter(Boolean).join(' · ') || 'Desativado',
  });
  check(hooks.signal);

  // ---- Markdown ----
  onStep(6, { status: 'running' });
  const { blocks: optimized, report } = optimizeBlocks(doc.blocks, opts.mode);
  const sectioned = opts.mode === 'summary' || opts.mode === 'legal';
  const body = renderMarkdown(shiftHeadings(optimized, sectioned ? 1 : 0), { mode: opts.mode, includePageMarkers: opts.includePageMarkers });
  const title = doc.title && doc.title.length < 120 ? doc.title : file.name.replace(/\.[^.]+$/, '');
  const parts: string[] = [`# ${title}`];
  parts.push(
    opts.mode === 'ai'
      ? `> Fonte: ${file.name} · ${doc.pageCount} p. · ${documentType}`
      : `> Fonte: ${file.name} · ${doc.pageCount} página(s) · ${documentType} · extração: ${methodLabel(doc.method)} · processado localmente pelo ARANDU`,
  );
  if (opts.mode === 'legal' && legal) {
    parts.push(legalHeaderMarkdown(legal));
    if (summary) parts.push(summaryMarkdown(summary, 2));
    parts.push(`## ${summary ? 3 : 2}. Conteúdo original extraído\n\n> Texto do documento, apenas reorganizado e normalizado. Nenhuma informação foi acrescentada.`, body);
  } else if (opts.mode === 'summary' && summary) {
    parts.push(summaryMarkdown(summary, 1));
    parts.push('## 2. Conteúdo original extraído\n\n> Conteúdo integral (otimizado), preservado abaixo do resumo.', body);
  } else {
    parts.push(body);
  }
  const markdown = parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  onStep(6, { status: 'done', detail: `${report.duplicatesRemoved} duplicação(ões) comprovada(s) removida(s)` + (doc.repeatedMarginals.length ? ` · ${doc.repeatedMarginals.length} cabeçalho(s)/rodapé(s) repetido(s) tratados` : '') });
  check(hooks.signal);

  // ---- Métricas ----
  onStep(7, { status: 'running', detail: 'Contando tokens (tokenizer local)' });
  const [originalTokens, finalTokens] = [await countTokens(plain), await countTokens(markdown)];
  // A integridade compara o texto extraído com o resultado (resumo/cabeçalho não contam como conteúdo).
  const integrity = checkIntegrity(plain, body + '\n' + (legal && opts.mode === 'legal' ? legalHeaderMarkdown(legal) : ''));
  const reductionPct = originalTokens ? Math.round(((originalTokens - finalTokens) / originalTokens) * 1000) / 10 : 0;
  const stats = {
    originalChars: plain.length,
    finalChars: markdown.length,
    originalTokens,
    finalTokens,
    reductionPct,
    reductionCounted: integrity.ok && reductionPct > 0,
    tokenizer: TOKENIZER_LABEL,
  };
  onStep(7, { status: 'done', detail: `${originalTokens.toLocaleString('pt-BR')} → ${finalTokens.toLocaleString('pt-BR')} tokens (estimativa)` });

  onStep(8, { status: 'running' });
  const warnings = [...doc.warnings];
  if (!integrity.ok) warnings.push(`Validação de integridade: ${integrity.missing.length} entidade(s) do original não encontrada(s) no resultado. A redução de tokens não foi contabilizada como ganho.`);
  const result: ProcessResult = {
    id: uid(),
    fileName: file.name,
    fileSize: file.size,
    format,
    createdAt: Date.now(),
    mode: opts.mode,
    markdown,
    rawText: plain,
    documentType,
    pageCount: doc.pageCount,
    ocrPageCount: doc.ocrPageCount,
    method: doc.method,
    durationMs: Math.round(performance.now() - t0),
    stats,
    integrity,
    legal,
    summary,
    warnings,
  };
  onStep(8, { status: 'done', detail: 'Pronto para download' });
  return result;
}
