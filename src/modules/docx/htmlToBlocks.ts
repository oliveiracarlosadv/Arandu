// Converte HTML semântico (gerado pelo Mammoth a partir de DOCX) em blocos da IR.
// Usa DOMParser (sem executar scripts) e ignora qualquer conteúdo ativo.

import type { Block } from '../../types';
import { cleanInline } from '../../utils/text';

function inlineText(el: Element): string {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? '';
    else if (n instanceof Element) {
      const tag = n.tagName.toLowerCase();
      if (tag === 'br') out += '\n';
      else if (tag === 'img') out += n.getAttribute('alt') ? ` [Imagem: ${n.getAttribute('alt')}] ` : ' [Imagem] ';
      else if (tag === 'sup' && n.querySelector('a[href^="#footnote"], a[href^="#endnote"]')) {
        out += `[^${cleanInline(n.textContent ?? '').replace(/[[\]]/g, '')}]`;
      } else if (tag === 'strong' || tag === 'b') {
        const t = inlineText(n);
        out += t.trim() ? `**${t.trim()}**` + (/\s$/.test(t) ? ' ' : '') : t;
      } else if (tag === 'em' || tag === 'i') {
        const t = inlineText(n);
        out += t.trim() ? `*${t.trim()}*` + (/\s$/.test(t) ? ' ' : '') : t;
      } else if (tag === 'script' || tag === 'style') {
        /* ignorado */
      } else out += inlineText(n);
    }
  });
  return out;
}

function clean(s: string): string {
  return s
    .split('\n')
    .map((l) => cleanInline(l))
    .filter(Boolean)
    .join(' ');
}

function listItems(list: Element, depth = 0): string[] {
  const items: string[] = [];
  for (const li of Array.from(list.children)) {
    if (li.tagName.toLowerCase() !== 'li') continue;
    const clone = li.cloneNode(true) as Element;
    clone.querySelectorAll('ul,ol').forEach((n) => n.remove());
    const text = clean(inlineText(clone));
    if (text) items.push('  '.repeat(depth) + text);
    for (const sub of Array.from(li.children)) {
      const t = sub.tagName.toLowerCase();
      if (t === 'ul' || t === 'ol') items.push(...listItems(sub, depth + 1));
    }
  }
  return items;
}

export function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks: Block[] = [];
  const walk = (parent: Element) => {
    for (const el of Array.from(parent.children)) {
      const tag = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const text = clean(inlineText(el)).replace(/^\*\*(.*)\*\*$/, '$1');
        if (text) blocks.push({ kind: 'heading', level: Number(tag[1]) as 1, text });
      } else if (tag === 'p') {
        const text = clean(inlineText(el));
        if (text) blocks.push({ kind: 'paragraph', text });
      } else if (tag === 'ul' || tag === 'ol') {
        const items = listItems(el);
        if (items.length) blocks.push({ kind: 'list', ordered: tag === 'ol', items });
      } else if (tag === 'table') {
        const rows: string[][] = [];
        el.querySelectorAll('tr').forEach((tr) => {
          const row: string[] = [];
          tr.querySelectorAll(':scope > td, :scope > th').forEach((td) => {
            row.push(clean(inlineText(td)));
            const span = Number(td.getAttribute('colspan') || 1);
            for (let i = 1; i < Math.min(span, 20); i++) row.push('');
          });
          if (row.some((c) => c)) rows.push(row);
        });
        if (rows.length) {
          const w = Math.max(...rows.map((r) => r.length));
          blocks.push({ kind: 'table', rows: rows.map((r) => [...r, ...Array(w - r.length).fill('')]) });
        }
      } else if (tag === 'blockquote') {
        const text = clean(inlineText(el));
        if (text) blocks.push({ kind: 'quote', text });
      } else if (tag === 'li' && el.id && /^(footnote|endnote)/.test(el.id)) {
        const n = el.id.replace(/\D+/g, '');
        const clone = el.cloneNode(true) as Element;
        clone.querySelectorAll('a[href^="#footnote-ref"], a[href^="#endnote-ref"]').forEach((a) => a.remove());
        const text = clean(inlineText(clone));
        if (text) blocks.push({ kind: 'footnote', text: `[^${n}]: ${text}` });
      } else if (tag === 'img') {
        blocks.push({ kind: 'visual', description: 'Imagem incorporada ao documento' });
      } else {
        walk(el);
      }
    }
  };
  // Notas de rodapé do Mammoth vêm em <ol> no fim, com <li id="footnote-N">
  doc.body.querySelectorAll('ol').forEach((ol) => {
    const lis = Array.from(ol.children);
    if (lis.length && lis.every((li) => /^(footnote|endnote)-/.test(li.id))) {
      const div = doc.createElement('div');
      lis.forEach((li) => div.appendChild(li));
      ol.replaceWith(div);
    }
  });
  walk(doc.body);
  return blocks;
}
