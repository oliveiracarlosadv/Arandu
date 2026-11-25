// Exportações: Markdown, TXT, JSON estruturado e ZIP do lote com índice geral.

import JSZip from 'jszip';
import type { ProcessResult } from '../../types';
import { markdownToPlainText } from '../markdown/renderer';
import { downloadBlob, fmtDuration, fmtInt, outputName } from '../../utils/format';
import { methodLabel } from './pipeline';

export function toJson(r: ProcessResult) {
  return {
    schema: 'arandu.result/v1',
    gerador: 'ARANDU — processamento local',
    arquivo: { nome: r.fileName, tamanhoBytes: r.fileSize, formato: r.format },
    processadoEm: new Date(r.createdAt).toISOString(),
    modo: r.mode,
    tipoDocumento: r.documentType,
    paginas: r.pageCount,
    paginasOcr: r.ocrPageCount,
    metodoExtracao: methodLabel(r.method),
    duracaoMs: r.durationMs,
    metricas: { ...r.stats, observacao: 'Tokens estimados; variam conforme o modelo e seu tokenizer.' },
    integridade: r.integrity,
    avisos: r.warnings,
    analiseJuridica: r.legal
      ? {
          observacao: 'Extração automática e literal; itens ausentes não foram identificados no documento.',
          ...r.legal,
        }
      : null,
    resumo: r.summary ?? null,
    markdown: r.markdown,
  };
}

export const downloadMarkdown = (r: ProcessResult) => downloadBlob(new Blob([r.markdown], { type: 'text/markdown;charset=utf-8' }), outputName(r.fileName, 'md'));
export const downloadTxt = (r: ProcessResult) => downloadBlob(new Blob([markdownToPlainText(r.markdown)], { type: 'text/plain;charset=utf-8' }), outputName(r.fileName, 'txt'));
export const downloadJson = (r: ProcessResult) => downloadBlob(new Blob([JSON.stringify(toJson(r), null, 2)], { type: 'application/json' }), outputName(r.fileName, 'json'));

/** Garante nomes únicos dentro do ZIP preservando o nome original. */
function uniqueNames(results: ProcessResult[], ext: string): string[] {
  const used = new Map<string, number>();
  return results.map((r) => {
    const base = outputName(r.fileName, ext);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? base.replace(new RegExp(`\\.${ext}$`), ` (${n + 1}).${ext}`) : base;
  });
}

export function batchIndexMarkdown(results: ProcessResult[], names: string[]): string {
  const lines = [
    '# Índice geral — ARANDU',
    '',
    `> ${results.length} documento(s) processado(s) localmente em ${new Date().toLocaleString('pt-BR')}. Tokens são estimativas.`,
    '',
    '| # | Arquivo original | Resultado | Tipo | Páginas | Tokens (orig. → final) | Redução |',
    '|---|---|---|---|---|---|---|',
    ...results.map(
      (r, i) =>
        `| ${i + 1} | ${r.fileName.replace(/\|/g, '\\|')} | [${names[i]}](./${encodeURI(names[i])}) | ${r.documentType} | ${r.pageCount} | ${fmtInt(r.stats.originalTokens)} → ${fmtInt(r.stats.finalTokens)} | ${r.stats.reductionCounted ? `${r.stats.reductionPct}%` : 'não contabilizada'} |`,
    ),
    '',
    `Tempo total: ${fmtDuration(results.reduce((a, r) => a + r.durationMs, 0))}.`,
  ];
  return lines.join('\n') + '\n';
}

export async function downloadZip(results: ProcessResult[], name = 'arandu-resultados.zip', includeJson = true) {
  const zip = new JSZip();
  const names = uniqueNames(results, 'md');
  const jsonNames = uniqueNames(results, 'json');
  results.forEach((r, i) => {
    zip.file(names[i], r.markdown);
    if (includeJson) zip.file(`json/${jsonNames[i]}`, JSON.stringify(toJson(r), null, 2));
  });
  zip.file('INDICE.md', batchIndexMarkdown(results, names));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  downloadBlob(blob, name);
}
