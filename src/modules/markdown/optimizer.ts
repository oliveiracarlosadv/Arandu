// Otimização determinística dos blocos antes da renderização em Markdown.
// Regra de ouro: nunca remover conteúdo substantivo. Só normaliza ruído de formatação
// e remove duplicações COMPROVADAS (texto idêntico após normalização).

import type { Block, ConversionMode } from '../../types';
import { cleanInline, normalizePunctuation, removeInvisible } from '../../utils/text';

export interface OptimizeReport {
  duplicatesRemoved: number;
  emptyRemoved: number;
}

function normText(s: string, mode: ConversionMode): string {
  let t = removeInvisible(s);
  if (mode !== 'fidelity') t = normalizePunctuation(t);
  return cleanInline(t);
}

const dupKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').trim();

export function optimizeBlocks(input: Block[], mode: ConversionMode): { blocks: Block[]; report: OptimizeReport } {
  const report: OptimizeReport = { duplicatesRemoved: 0, emptyRemoved: 0 };
  const out: Block[] = [];
  const seenLong = new Set<string>();

  for (const b of input) {
    let blk: Block = b;
    switch (b.kind) {
      case 'heading':
      case 'paragraph':
      case 'quote':
      case 'footnote':
        blk = { ...b, text: normText(b.text, mode) };
        if (!blk.text) { report.emptyRemoved++; continue; }
        break;
      case 'list': {
        const items = b.items.map((i) => {
          const indent = /^\s*/.exec(i)?.[0] ?? '';
          return indent + normText(i, mode);
        }).filter((i) => i.trim());
        if (!items.length) { report.emptyRemoved++; continue; }
        blk = { ...b, items };
        break;
      }
      case 'table': {
        let rows = b.rows.map((r) => r.map((c) => normText(c, mode)));
        if (mode !== 'fidelity') {
          rows = rows.filter((r) => r.some(Boolean));
          const width = Math.max(0, ...rows.map((r) => r.length));
          const keepCols = Array.from({ length: width }, (_, c) => rows.some((r) => r[c]));
          rows = rows.map((r) => r.filter((_, c) => keepCols[c]));
        }
        if (!rows.length || !rows[0].length) { report.emptyRemoved++; continue; }
        blk = { ...b, rows };
        break;
      }
      default:
        break;
    }

    if (mode !== 'fidelity') {
      // Duplicação comprovada: parágrafo longo idêntico já emitido (ex.: bloco repetido por erro de digitalização).
      if (blk.kind === 'paragraph' && blk.text.length >= 60) {
        const k = dupKey(blk.text);
        if (seenLong.has(k)) { report.duplicatesRemoved++; continue; }
        seenLong.add(k);
      }
      // Título idêntico e consecutivo (comum em quebras de página)
      const prev = out[out.length - 1];
      if (blk.kind === 'heading' && prev?.kind === 'heading' && dupKey(prev.text) === dupKey(blk.text)) {
        report.duplicatesRemoved++;
        continue;
      }
      // Parágrafo partido pela quebra de página: une se o anterior não termina em pontuação final
      // e o atual começa em minúscula.
      if (blk.kind === 'paragraph') {
        let j = out.length - 1;
        while (j >= 0 && out[j].kind === 'pagebreak') j--;
        const before = out[j];
        if (before?.kind === 'paragraph' && j < out.length - 1 && !/[.!?:;"\u201D)]$/.test(before.text) && /^[a-zà-ÿ]/.test(blk.text)) {
          before.text = /[A-Za-zÀ-ÿ]-$/.test(before.text) ? before.text.slice(0, -1) + blk.text : `${before.text} ${blk.text}`;
          continue;
        }
      }
    }
    out.push(blk);
  }

  // Remove quebras de página consecutivas/sem conteúdo entre elas no modo otimizado
  const cleaned = mode === 'fidelity' ? out : out.filter((b, i) => !(b.kind === 'pagebreak' && out[i + 1]?.kind === 'pagebreak'));
  return { blocks: cleaned, report };
}
