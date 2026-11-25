// Motor de layout compartilhado: transforma itens de texto posicionados (PDF.js ou palavras do OCR)
// em linhas, parágrafos, títulos, listas e tabelas \u2014 de forma determinística.

import type { Block } from '../../types';
import { cleanInline, isMostlyUppercase, isPageNumberLine, joinWrappedLines, marginalKey } from '../../utils/text';

export interface TextItem {
  text: string;
  x: number; // esquerda
  y: number; // topo (cresce para baixo)
  width: number;
  height: number; // ≈ tamanho da fonte
  bold?: boolean;
}

export interface Line {
  text: string;
  x: number;
  y: number;
  right: number;
  height: number;
  bold: boolean;
  /** Segmentos separados por grandes lacunas horizontais (indício de colunas de tabela). */
  segments: { text: string; x: number; right: number }[];
}

export interface PageLayout {
  page: number;
  width: number;
  height: number;
  lines: Line[];
}

const median = (arr: number[]): number => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Agrupa itens em linhas pela coordenada vertical e detecta segmentos (colunas). */
export function buildLines(items: TextItem[]): Line[] {
  const valid = items.filter((i) => i.text.trim().length > 0 && i.height > 0);
  valid.sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const it of valid) {
    const cy = it.y + it.height / 2;
    const target = lines.find((l) => {
      const ref = l[0];
      const ry = ref.y + ref.height / 2;
      return Math.abs(ry - cy) < Math.max(ref.height, it.height) * 0.5;
    });
    if (target) target.push(it);
    else lines.push([it]);
  }
  const out: Line[] = lines.map((group) => {
    group.sort((a, b) => a.x - b.x);
    const h = median(group.map((g) => g.height));
    const charW = h * 0.5;
    const segments: Line['segments'] = [];
    let text = '';
    let prev: TextItem | null = null;
    for (const g of group) {
      const t = g.text;
      if (prev) {
        const gap = g.x - (prev.x + prev.width);
        if (gap > charW * 3) {
          segments.push({ text: t.trim(), x: g.x, right: g.x + g.width });
          text += '  ' + t;
        } else {
          const last = segments[segments.length - 1];
          const needsSpace = gap > charW * 0.15 && !text.endsWith(' ') && !t.startsWith(' ');
          last.text = (last.text + (needsSpace ? ' ' : '') + t).trim();
          last.right = g.x + g.width;
          text += (needsSpace ? ' ' : '') + t;
        }
      } else {
        segments.push({ text: t.trim(), x: g.x, right: g.x + g.width });
        text = t;
      }
      prev = g;
    }
    const boldCount = group.filter((g) => g.bold).length;
    return {
      text: cleanInline(text),
      x: group[0].x,
      y: Math.min(...group.map((g) => g.y)),
      right: Math.max(...group.map((g) => g.x + g.width)),
      height: h,
      bold: boldCount > group.length / 2,
      segments: segments.map((s) => ({ ...s, text: cleanInline(s.text) })).filter((s) => s.text),
    };
  });
  return out.filter((l) => l.text).sort((a, b) => a.y - b.y);
}

/**
 * Detecta cabeçalhos e rodapés repetidos: linhas nas faixas superior/inferior da página
 * que se repetem (ignorando números) em pelo menos metade das páginas (mín. 2).
 */
export function detectRepeatedMarginals(pages: PageLayout[]): Set<string> {
  const counts = new Map<string, number>();
  if (pages.length < 2) return new Set();
  for (const p of pages) {
    const seen = new Set<string>();
    for (const l of p.lines) {
      const inMargin = l.y < p.height * 0.1 || l.y + l.height > p.height * 0.9;
      if (!inMargin) continue;
      const k = marginalKey(l.text);
      if (k.length < 2 || seen.has(k)) continue;
      seen.add(k);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.5));
  return new Set([...counts].filter(([, c]) => c >= threshold).map(([k]) => k));
}

const LIST_RE = /^(\s*)([-•▪◦●*·]|\(?[a-zA-Z]\)|\(?\d{1,3}[.)]|[IVXLC]{1,6}\s*[-\u2013.)])\s+/;

function isListLine(t: string): boolean {
  return LIST_RE.test(t);
}

function stripListMarker(t: string): { ordered: boolean; text: string } {
  const m = t.match(LIST_RE);
  if (!m) return { ordered: false, text: t };
  const marker = m[2];
  const ordered = !/^[-•▪◦●*·]$/.test(marker);
  // Em listas ordenadas preservamos o marcador original (ex.: "a)", "IV -"), pois é referência jurídica.
  return { ordered, text: ordered ? t.trim() : t.slice(m[0].length).trim() };
}

interface LayoutOptions {
  marginals: Set<string>;
  bodyHeight: number;
  /** Mantém cabeçalhos/rodapés repetidos (modo fidelidade). */
  keepMarginals: boolean;
  /** Marginais já emitidas uma vez (compartilhado entre páginas): a 1ª ocorrência é preservada. */
  seenMarginals: Set<string>;
}

/** Tenta reconhecer uma sequência de linhas tabulares (≥2 linhas com ≥2 colunas alinhadas). */
const MARKER_ONLY = /^([-•▪◦●*·–]|\(?[a-zA-Z0-9]{1,3}[.)]|[IVXLC]{1,6}\s*[-–.)]?)$/;

function takeTable(lines: Line[], start: number): { rows: string[][]; next: number } | null {
  const first = lines[start];
  if (first.segments.length < 2) return null;
  if (MARKER_ONLY.test(first.segments[0].text)) return null;
  const cols = first.segments.length;
  const rows: string[][] = [];
  let i = start;
  while (i < lines.length) {
    const l = lines[i];
    if (l.segments.length < 2 || Math.abs(l.segments.length - cols) > 1 || MARKER_ONLY.test(l.segments[0].text)) break;
    if (rows.length) {
      const prevLine = lines[i - 1];
      if (l.y - (prevLine.y + prevLine.height) > prevLine.height * 2.2) break;
    }
    const row = l.segments.map((s) => s.text);
    while (row.length < cols) row.push('');
    rows.push(row.slice(0, Math.max(cols, row.length)));
    i++;
  }
  if (rows.length < 2) return null;
  const width = Math.max(...rows.map((r) => r.length));
  return { rows: rows.map((r) => [...r, ...Array(width - r.length).fill('')]), next: i };
}

/** Converte as linhas de uma página em blocos semânticos. */
export function linesToBlocks(page: PageLayout, opts: LayoutOptions): { blocks: Block[]; removedMarginals: number } {
  const blocks: Block[] = [];
  let removed = 0;
  const lines = page.lines.filter((l) => {
    const inMargin = l.y < page.height * 0.1 || l.y + l.height > page.height * 0.9;
    if (inMargin && isPageNumberLine(l.text)) {
      removed++;
      return false;
    }
    const key = marginalKey(l.text);
    if (!opts.keepMarginals && inMargin && opts.marginals.has(key)) {
      if (!opts.seenMarginals.has(key)) {
        opts.seenMarginals.add(key);
        return true;
      }
      removed++;
      return false;
    }
    return true;
  });

  const body = opts.bodyHeight || median(lines.map((l) => l.height)) || 10;
  const leftEdge = median(lines.map((l) => l.x));
  const rightEdge = Math.max(0, ...lines.map((l) => l.right));
  let para: Line[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushPara = () => {
    if (!para.length) return;
    const text = joinWrappedLines(para.map((l) => l.text));
    if (text) blocks.push({ kind: 'paragraph', text, page: page.page });
    para = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ kind: 'list', ordered: listOrdered, items: listItems, page: page.page });
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const prev = lines[i - 1];

    const table = takeTable(lines, i);
    if (table && table.rows[0].length >= 2 && table.rows.length >= 2) {
      flushPara();
      flushList();
      blocks.push({ kind: 'table', rows: table.rows, page: page.page });
      i = table.next - 1;
      continue;
    }

    if (/^_{6,}\s*$/.test(l.text) || /assinado (digital|eletronica)mente|assinatura digital/i.test(l.text)) {
      flushPara();
      flushList();
      blocks.push({ kind: 'visual', description: 'Elemento visual: possível assinatura ou campo de assinatura', page: page.page });
      if (!/^_{6,}\s*$/.test(l.text)) blocks.push({ kind: 'paragraph', text: l.text, page: page.page });
      continue;
    }

    const ratio = l.height / body;
    const short = l.text.length < 120;
    const styled = (l.bold || isMostlyUppercase(l.text)) && l.text.length < 90;
    const isHeading =
      short &&
      !/[,;]$/.test(l.text) &&
      !/:\s*\S/.test(l.text) &&
      (ratio > 1.25 || (styled && !/[.;]$/.test(l.text)));
    const gapBefore = prev ? l.y - (prev.y + prev.height) : Infinity;

    if (isHeading && !isListLine(l.text)) {
      flushPara();
      flushList();
      const level: 1 | 2 = ratio > 1.25 ? 1 : 2;
      // Título quebrado em duas linhas: só une se a linha anterior termina em conectivo/hífen
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock?.kind === 'heading' && gapBefore < l.height * 0.6 && lastBlock.level === level && /(?:\s(?:de|do|da|dos|das|e|em|para|por|com|ao|à|a|o)|[-–,])$/i.test(lastBlock.text)) {
        lastBlock.text += ' ' + l.text;
      } else {
        blocks.push({ kind: 'heading', level, text: l.text, page: page.page });
      }
      continue;
    }

    if (isListLine(l.text)) {
      flushPara();
      const { ordered, text } = stripListMarker(l.text);
      if (listItems.length && ordered !== listOrdered) flushList();
      listOrdered = ordered;
      listItems.push(text);
      continue;
    }

    // Continuação de item de lista (linha recuada logo após um item)
    if (listItems.length && gapBefore < l.height * 0.8 && l.x > leftEdge + body) {
      listItems[listItems.length - 1] = joinWrappedLines([listItems[listItems.length - 1], l.text]);
      continue;
    }
    flushList();

    // Novo parágrafo: lacuna vertical maior que o normal, recuo de primeira linha,
    // ou linha anterior terminando em ponto final bem antes da margem direita.
    const prevShort = prev ? prev.right < rightEdge - body * 8 || (prev.right < rightEdge - body * 3 && /[.:!?"\u201D]$/.test(prev.text)) : false;
    const labelLine = /^[A-ZÀ-Úa-zà-ú()º°ª./ ]{2,40}:\s+\S/.test(l.text) && l.text.length < 160;
    const indented = l.x > leftEdge + body * 1.5;
    const newPara = !para.length || gapBefore > l.height * 0.9 || indented || prevShort || labelLine;
    if (newPara) flushPara();
    para.push(l);
  }
  flushPara();
  flushList();
  return { blocks, removedMarginals: removed };
}

export function pageRawText(page: PageLayout): string {
  return page.lines.map((l) => l.text).join('\n');
}

export function medianHeight(pages: PageLayout[]): number {
  return median(pages.flatMap((p) => p.lines.map((l) => l.height)));
}
