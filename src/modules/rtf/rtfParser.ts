// Parser RTF próprio (sem dependências): extrai texto, parágrafos e tabelas.
// Ignora destinos não textuais (fontes, cores, estilos, imagens, objetos embutidos, campos ocultos).

import type { Block } from '../../types';
import { cleanInline } from '../../utils/text';

// Tabela Windows-1252 para bytes 0x80\u20130x9F (o restante coincide com Latin-1).
const CP1252: Record<number, string> = {
  0x80: '€', 0x82: '\u201A', 0x83: 'ƒ', 0x84: '\u201E', 0x85: '\u2026', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰',
  0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201C', 0x94: '\u201D', 0x95: '•',
  0x96: '\u2013', 0x97: '\u2014', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};
const decodeByte = (b: number) => CP1252[b] ?? String.fromCharCode(b);

const SKIP_DESTINATIONS = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'headerl', 'headerr',
  'headerf', 'footerl', 'footerr', 'footerf', 'listtable', 'listoverridetable', 'rsidtbl', 'generator',
  'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'xmlnstbl', 'mmathPr', 'fldinst',
  'filetbl', 'revtbl', 'pgdsctbl', 'bkmkstart', 'bkmkend', 'nonshppict', 'shp', 'shpinst', 'objdata',
  'datafield', 'docvar', 'userprops', 'xe', 'tc', 'private', 'protusertbl', 'wgrffmtfilter', 'pnseclvl',
]);

export interface RtfParseResult {
  blocks: Block[];
  text: string;
}

export function parseRtf(input: string): RtfParseResult {
  if (!input.startsWith('{\\rtf')) throw new Error('Arquivo RTF inválido (assinatura {\\rtf ausente).');
  const blocks: Block[] = [];
  const textParts: string[] = [];
  let para = '';
  let row: string[] = [];
  let cell = '';
  let tableRows: string[][] = [];
  let inTable = false;

  type State = { skip: boolean; uc: number };
  const stack: State[] = [];
  let state: State = { skip: false, uc: 1 };
  let pendingSkip = 0; // caracteres a pular após \uN

  const emit = (s: string) => {
    if (state.skip) return;
    if (pendingSkip > 0) { pendingSkip -= s.length; return; }
    if (inTable) cell += s;
    else para += s;
  };
  const flushTable = () => {
    if (tableRows.length) {
      const w = Math.max(...tableRows.map((r) => r.length));
      blocks.push({ kind: 'table', rows: tableRows.map((r) => [...r, ...Array(w - r.length).fill('')]) });
      textParts.push(tableRows.map((r) => r.join('\t')).join('\n'));
    }
    tableRows = [];
  };
  const flushPara = () => {
    const t = cleanInline(para);
    if (t) {
      flushTable();
      blocks.push({ kind: 'paragraph', text: t });
      textParts.push(t);
    }
    para = '';
  };

  let i = 0;
  const n = input.length;
  let destinationCandidate = false;
  while (i < n) {
    const ch = input[i];
    if (ch === '{') {
      stack.push(state);
      state = { ...state };
      destinationCandidate = true;
      i++;
      continue;
    }
    if (ch === '}') {
      state = stack.pop() ?? { skip: false, uc: 1 };
      destinationCandidate = false;
      i++;
      continue;
    }
    if (ch === '\\') {
      const next = input[i + 1];
      if (next === '*') { state.skip = true; i += 2; continue; }
      if (next === "'") {
        const hex = input.substr(i + 2, 2);
        emit(decodeByte(parseInt(hex, 16)));
        i += 4;
        destinationCandidate = false;
        continue;
      }
      if (next === '\\' || next === '{' || next === '}') { emit(next); i += 2; destinationCandidate = false; continue; }
      if (next === '~') { emit(' '); i += 2; continue; }
      if (next === '-' || next === '_') { i += 2; continue; }
      if (next === '\n' || next === '\r') { if (!state.skip) flushPara(); i += 2; continue; }
      const m = /^([a-zA-Z]{1,32})(-?\d{1,10})? ?/.exec(input.slice(i + 1, i + 45));
      if (!m) { i++; continue; }
      const word = m[1];
      const param = m[2] !== undefined ? Number(m[2]) : undefined;
      i += 1 + m[0].length;
      const wasDest = destinationCandidate;
      destinationCandidate = false;
      if (wasDest && SKIP_DESTINATIONS.has(word)) { state.skip = true; continue; }
      if (state.skip) continue;
      switch (word) {
        case 'par': case 'sect': case 'page':
          if (inTable) cell += ' '; else flushPara();
          break;
        case 'line': emit(' '); break;
        case 'tab': emit(' '); break;
        case 'emdash': emit('\u2014'); break;
        case 'endash': emit('\u2013'); break;
        case 'bullet': emit('•'); break;
        case 'lquote': emit('\u2018'); break;
        case 'rquote': emit('\u2019'); break;
        case 'ldblquote': emit('\u201C'); break;
        case 'rdblquote': emit('\u201D'); break;
        case 'uc': state.uc = param ?? 1; break;
        case 'u': {
          let code = param ?? 0;
          if (code < 0) code += 65536;
          emit(String.fromCharCode(code));
          pendingSkip = state.uc;
          break;
        }
        case 'intbl': if (!inTable) { flushPara(); inTable = true; } break;
        case 'cell': row.push(cleanInline(cell)); cell = ''; break;
        case 'row': if (row.length) tableRows.push(row); row = []; cell = ''; inTable = false; break;
        case 'pard': if (inTable && !row.length && !cell) inTable = false; break;
        default: break;
      }
      continue;
    }
    if (ch === '\r' || ch === '\n') { i++; continue; }
    destinationCandidate = false;
    // Pula caracteres de substituição pendentes de \uN
    if (pendingSkip > 0 && !state.skip) { pendingSkip--; i++; continue; }
    emit(ch);
    i++;
  }
  flushPara();
  if (row.length) tableRows.push(row);
  flushTable();
  return { blocks, text: textParts.join('\n\n') };
}
