// Extração de ODT (OpenDocument Text): lê content.xml com DOMParser (XML puro, sem scripts).

import type { Block, ExtractedDocument } from '../../types';
import { cleanInline } from '../../utils/text';
import { openZipSafely } from '../docx/zipGuard';

const NS_TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const NS_TABLE = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';

function textOf(node: Node, notes: string[]): string {
  let out = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.nodeValue ?? '';
    else if (n.nodeType === 1) {
      const el = n as Element;
      const local = el.localName;
      if (el.namespaceURI === NS_TEXT) {
        if (local === 's') out += ' '.repeat(Math.min(Number(el.getAttributeNS(NS_TEXT, 'c') || 1), 4));
        else if (local === 'tab') out += ' ';
        else if (local === 'line-break') out += '\n';
        else if (local === 'note') {
          const citation = el.getElementsByTagNameNS(NS_TEXT, 'note-citation')[0]?.textContent ?? String(notes.length + 1);
          const body = el.getElementsByTagNameNS(NS_TEXT, 'note-body')[0];
          notes.push(`[^${citation}]: ${cleanInline(body ? textOf(body, notes) : '')}`);
          out += `[^${citation}]`;
        } else if (local === 'tracked-changes' || local === 'bookmark-ref') {
          /* ignora marcações de revisão */
        } else out += textOf(el, notes);
      } else out += textOf(el, notes);
    }
  });
  return out;
}

export function odtXmlToBlocks(xml: string): { blocks: Block[]; raw: string } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('ODT inválido: content.xml malformado.');
  const bodyText = doc.getElementsByTagNameNS(NS_TEXT, 'p')[0]?.ownerDocument ? doc.documentElement : null;
  const office = doc.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'text')[0] ?? bodyText;
  if (!office) throw new Error('ODT sem corpo de texto.');
  const blocks: Block[] = [];
  const notes: string[] = [];
  const rawParts: string[] = [];

  const walk = (parent: Element, listDepth = 0) => {
    for (const el of Array.from(parent.children)) {
      const ns = el.namespaceURI, local = el.localName;
      if (ns === NS_TEXT && local === 'h') {
        const text = cleanInline(textOf(el, notes));
        const lvl = Math.min(6, Math.max(1, Number(el.getAttributeNS(NS_TEXT, 'outline-level') || 1))) as 1;
        if (text) { blocks.push({ kind: 'heading', level: lvl, text }); rawParts.push(text); }
      } else if (ns === NS_TEXT && local === 'p') {
        const text = textOf(el, notes).split('\n').map(cleanInline).filter(Boolean).join(' ');
        if (text) { blocks.push({ kind: 'paragraph', text }); rawParts.push(text); }
      } else if (ns === NS_TEXT && local === 'list') {
        const items: string[] = [];
        const collect = (list: Element, depth: number) => {
          for (const item of Array.from(list.children)) {
            if (item.localName !== 'list-item') continue;
            for (const c of Array.from(item.children)) {
              if (c.localName === 'list') collect(c, depth + 1);
              else {
                const t = cleanInline(textOf(c, notes));
                if (t) items.push('  '.repeat(depth) + t);
              }
            }
          }
        };
        collect(el, listDepth);
        if (items.length) { blocks.push({ kind: 'list', ordered: false, items }); rawParts.push(items.join('\n')); }
      } else if (ns === NS_TABLE && local === 'table') {
        const rows: string[][] = [];
        for (const row of Array.from(el.getElementsByTagNameNS(NS_TABLE, 'table-row'))) {
          const cells: string[] = [];
          for (const cell of Array.from(row.children)) {
            if (cell.localName !== 'table-cell' && cell.localName !== 'covered-table-cell') continue;
            const rep = Math.min(50, Number(cell.getAttributeNS(NS_TABLE, 'number-columns-repeated') || 1));
            const t = cleanInline(textOf(cell, notes));
            for (let i = 0; i < rep; i++) cells.push(t);
          }
          while (cells.length && !cells[cells.length - 1]) cells.pop();
          if (cells.some(Boolean)) rows.push(cells);
        }
        if (rows.length) {
          const w = Math.max(...rows.map((r) => r.length));
          blocks.push({ kind: 'table', rows: rows.map((r) => [...r, ...Array(w - r.length).fill('')]) });
          rawParts.push(rows.map((r) => r.join('\t')).join('\n'));
        }
      } else if (ns === NS_TEXT && (local === 'section' || local === 'index-body' || local === 'table-of-content')) {
        walk(el, listDepth);
      }
    }
  };
  walk(office);
  for (const n of notes) blocks.push({ kind: 'footnote', text: n });
  return { blocks, raw: rawParts.join('\n\n') };
}

export async function extractOdt(data: ArrayBuffer): Promise<ExtractedDocument> {
  const { zip, hasMacros } = await openZipSafely(data);
  const mime = await zip.file('mimetype')?.async('string');
  if (mime && !mime.includes('opendocument.text')) throw new Error(`ODT inválido (mimetype: ${mime}).`);
  const content = await zip.file('content.xml')?.async('string');
  if (!content) throw new Error('ODT inválido: content.xml ausente.');
  const { blocks, raw } = odtXmlToBlocks(content);
  return {
    blocks,
    rawText: raw,
    pages: [],
    pageCount: Math.max(1, Math.round(raw.length / 3000)),
    method: 'estrutura-odt',
    ocrPageCount: 0,
    repeatedMarginals: [],
    warnings: hasMacros ? ['Macros embutidas foram ignoradas e não foram executadas.'] : [],
  };
}
