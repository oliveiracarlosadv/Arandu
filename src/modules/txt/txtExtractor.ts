// Texto simples: detecta codificação (UTF-8 com fallback Windows-1252) e reconstrói parágrafos.

import type { Block } from '../../types';
import { cleanInline, isMostlyUppercase, joinWrappedLines } from '../../utils/text';

export function decodeText(buf: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16LE' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16BE' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'Windows-1252' };
  }
}

const LIST_RE = /^\s*([-•*·]|\(?[a-zA-Z]\)|\(?\d{1,3}[.)]|[IVXLC]{1,6}\s*[-\u2013.)])\s+/;

/** Converte texto plano em blocos: parágrafos separados por linha em branco; linhas quebradas são unidas. */
export function textToBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const chunks = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => LIST_RE.test(l))) {
      const ordered = !/^\s*[-•*·]\s/.test(lines[0]);
      blocks.push({ kind: 'list', ordered, items: lines.map((l) => (ordered ? cleanInline(l) : cleanInline(l.replace(LIST_RE, '')))) });
      continue;
    }
    if (lines.length >= 2 && lines.every((l) => l.includes('\t') || /\S {3,}\S/.test(l))) {
      const rows = lines.map((l) => l.split(/\t| {3,}/).map(cleanInline));
      const w = Math.max(...rows.map((r) => r.length));
      if (w >= 2) {
        blocks.push({ kind: 'table', rows: rows.map((r) => [...r, ...Array(w - r.length).fill('')]) });
        continue;
      }
    }
    if (lines.length === 1 && lines[0].length < 90 && isMostlyUppercase(lines[0]) && !/[.;,]$/.test(lines[0])) {
      blocks.push({ kind: 'heading', level: 2, text: cleanInline(lines[0]) });
      continue;
    }
    const md = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
    if (md && lines.length === 1) {
      blocks.push({ kind: 'heading', level: md[1].length as 1, text: cleanInline(md[2]) });
      continue;
    }
    // Linhas dentro do bloco: se terminam em pontuação final e a seguinte começa com maiúscula, são parágrafos distintos.
    let group: string[] = [];
    const flush = () => {
      if (group.length) blocks.push({ kind: 'paragraph', text: cleanInline(joinWrappedLines(group)) });
      group = [];
    };
    for (const l of lines) {
      const prev = group[group.length - 1];
      const labelLine = /^[A-Za-zÀ-ú()º°ª./ ]{2,40}:\s+\S/.test(l.trim());
      if (prev && ((/[.!?:]$/.test(prev.trim()) && prev.trim().length < 60) || labelLine || /^[A-Za-zÀ-ú()º°ª./ ]{2,40}:\s+\S/.test(prev.trim()))) flush();
      group.push(l);
    }
    flush();
  }
  return blocks;
}
