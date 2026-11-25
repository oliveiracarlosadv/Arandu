// Renderização da IR em Markdown (GFM), com conversão inteligente de tabelas.

import type { Block, ConversionMode } from '../../types';
import { escapeMarkdownInline, escapeTableCell } from '../../utils/text';

export interface RenderOptions {
  mode: ConversionMode;
  includePageMarkers: boolean;
}

function tableToMarkdown(rows: string[][], mode: ConversionMode): string {
  const width = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
  // Tabela de 2 colunas tipo "rótulo: valor" → lista compacta (economiza tokens sem perder dados).
  if (mode !== 'fidelity' && width === 2 && norm.length >= 2) {
    const labelLike = norm.filter(([k]) => k && k.length <= 60).length / norm.length > 0.8;
    if (labelLike) {
      return norm
        .filter(([k, v]) => k || v)
        .map(([k, v]) => (v ? `- ${escapeTableCell(k).replace(/:$/, '')}: ${escapeTableCell(v)}` : `- ${escapeTableCell(k)}`))
        .join('\n');
    }
  }
  if (width === 1) return norm.map((r) => `- ${escapeTableCell(r[0])}`).join('\n');
  const [head, ...body] = norm;
  const line = (r: string[]) => `| ${r.map(escapeTableCell).join(' | ')} |`;
  const sep = mode === 'fidelity' ? `| ${head.map(() => '---').join(' | ')} |` : `|${head.map(() => '-').join('|')}|`;
  return [line(head), sep, ...body.map(line)].join('\n');
}

export function renderMarkdown(blocks: Block[], opts: RenderOptions): string {
  const parts: string[] = [];
  const footnotes: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case 'pagebreak':
        if (opts.includePageMarkers) parts.push(`<!-- página ${b.page} -->`);
        break;
      case 'heading':
        parts.push(`${'#'.repeat(Math.min(6, b.level + 1))} ${b.text}`); // H1 reservado ao título do documento
        break;
      case 'paragraph':
        parts.push(escapeMarkdownInline(b.text));
        break;
      case 'quote':
        parts.push(b.text.split('\n').map((l) => `> ${l}`).join('\n'));
        break;
      case 'list':
        parts.push(
          b.items
            .map((it, idx) => {
              const indent = /^\s*/.exec(it)?.[0] ?? '';
              const text = it.trim();
              if (!b.ordered) return `${indent}- ${text}`;
              // Marcador original preservado (ex.: "a)", "IV -"); se não houver, numera.
              return /^(\(?[a-zA-Z]\)|\(?\d{1,3}[.)]|[IVXLC]{1,6}\s*[-\u2013.)])/.test(text) ? `${indent}- ${text}` : `${indent}${idx + 1}. ${text}`;
            })
            .join('\n'),
        );
        break;
      case 'table':
        parts.push(tableToMarkdown(b.rows, opts.mode));
        break;
      case 'footnote':
        footnotes.push(b.text.startsWith('[^') ? b.text : `[^${footnotes.length + 1}]: ${b.text}`);
        break;
      case 'visual':
        parts.push(`[${b.description}${b.page ? ` \u2014 p. ${b.page}` : ''}]`);
        break;
    }
  }
  if (footnotes.length) parts.push('---', ...footnotes);
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Texto plano equivalente (para exportação TXT). */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/<!--.*?-->\n?/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2')
    .replace(/^>\s?/gm, '')
    .replace(/^\|?[-:| ]+\|?$/gm, '')
    .replace(/\\([|#>*\-+.])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}
