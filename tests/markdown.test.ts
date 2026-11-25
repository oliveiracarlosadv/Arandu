import { describe, expect, it } from 'vitest';
import { optimizeBlocks } from '../src/modules/markdown/optimizer';
import { renderMarkdown, markdownToPlainText } from '../src/modules/markdown/renderer';
import { checkIntegrity } from '../src/modules/markdown/integrity';
import { textToBlocks, decodeText } from '../src/modules/txt/txtExtractor';
import { parseRtf } from '../src/modules/rtf/rtfParser';
import { joinWrappedLines, removeInvisible, isPageNumberLine } from '../src/utils/text';
import { heuristicTokens, countTokens } from '../src/modules/tokens/tokenEstimator';
import { extractiveSummary } from '../src/modules/ai/extractiveSummary';
import type { Block } from '../src/types';
import { SENTENCA_TXT } from './fixtures/sentenca';

describe('Normalização', () => {
  it('une hifenização e linhas quebradas', () => {
    expect(joinWrappedLines(['a contra-', 'tação foi feita', 'ontem.'])).toBe('a contratação foi feita ontem.');
  });
  it('remove invisíveis', () => {
    expect(removeInvisible('a​b﻿c­d')).toBe('abcd');
  });
  it('detecta numeração de página', () => {
    expect(isPageNumberLine('Página 3 de 10')).toBe(true);
    expect(isPageNumberLine('- 12 -')).toBe(true);
    expect(isPageNumberLine('Art. 3')).toBe(false);
  });
});

describe('Otimização', () => {
  const blocks: Block[] = [
    { kind: 'pagebreak', page: 1 },
    { kind: 'paragraph', text: 'O contrato   foi celebrado em 10/01/2025 pelo valor de R$ 1.000,00 entre as partes e', page: 1 },
    { kind: 'pagebreak', page: 2 },
    { kind: 'paragraph', text: 'continuou vigente até a rescisão.', page: 2 },
    { kind: 'paragraph', text: 'Parágrafo repetido idêntico com mais de sessenta caracteres para teste de duplicação.', page: 2 },
    { kind: 'paragraph', text: 'Parágrafo repetido idêntico com mais de sessenta caracteres para teste de duplicação.', page: 2 },
    { kind: 'table', rows: [['Nome', 'Valor', ''], ['Salário', 'R$ 3.000,00', ''], ['', '', '']], page: 2 },
  ];
  it('modo IA: une parágrafos entre páginas, remove duplicação comprovada e colunas vazias', () => {
    const { blocks: out, report } = optimizeBlocks(blocks, 'ai');
    expect(report.duplicatesRemoved).toBe(1);
    const md = renderMarkdown(out, { mode: 'ai', includePageMarkers: false });
    expect(md).toContain('entre as partes e continuou vigente');
    expect(md).toContain('- Nome: Valor');
    expect(md).toContain('- Salário: R$ 3.000,00');
  });
  it('modo fidelidade: preserva tudo', () => {
    const { blocks: out, report } = optimizeBlocks(blocks, 'fidelity');
    expect(report.duplicatesRemoved).toBe(0);
    const md = renderMarkdown(out, { mode: 'fidelity', includePageMarkers: true });
    expect(md).toContain('<!-- página 2 -->');
    expect(md.match(/Parágrafo repetido/g)?.length).toBe(2);
    expect(md).toContain('| Nome | Valor |  |');
  });
  it('texto plano remove marcação', () => {
    expect(markdownToPlainText('## Título\n\n**negrito** e *it*\n\n<!-- página 1 -->\n')).toBe('Título\n\nnegrito e it\n');
  });
});

describe('Integridade', () => {
  it('detecta perda de entidades críticas', () => {
    const src = 'Processo 0000123-45.2026.5.08.0002, valor R$ 1.234,56, em 10/02/2026, art. 5º da CF.';
    expect(checkIntegrity(src, src).ok).toBe(true);
    const r = checkIntegrity(src, 'Processo 0000123-45.2026.5.08.0002, em 10/02/2026, art. 5º da CF.');
    expect(r.ok).toBe(false);
    expect(r.missing[0].value).toBe('R$ 1.234,56');
  });
});

describe('TXT', () => {
  it('decodifica Windows-1252 e reconstrói blocos', () => {
    const bytes = new Uint8Array([0x41, 0xe7, 0xe3, 0x6f]); // "Ação" em cp1252
    expect(decodeText(bytes.buffer).text).toBe('Ação');
    const blocks = textToBlocks(SENTENCA_TXT);
    expect(blocks.some((b) => b.kind === 'heading' && b.text === 'FUNDAMENTAÇÃO')).toBe(true);
  });
});

describe('RTF', () => {
  it('extrai texto com acentos, unicode e tabelas, ignorando tabelas de fonte', () => {
    const rtf =
      "{\\rtf1\\ansi\\ansicpg1252{\\fonttbl\\f0\\fswiss Helvetica;}{\\colortbl;\\red255\\green0\\blue0;}\\f0\\fs24 Contrata\\'e7\\'e3o de servi\\'e7os\\par Valor: R\\$ 1.000,00 \\u8212? fim\\par\n" +
      "\\trowd\\intbl Nome\\cell Valor\\cell\\row\\trowd\\intbl Jo\\'e3o\\cell 10\\cell\\row\n" +
      "{\\*\\generator Teste;}Depois da tabela\\par}";
    const r = parseRtf(rtf);
    expect(r.text).toContain('Contratação de serviços');
    expect(r.text).toContain('—');
    expect(r.text).not.toContain('Helvetica');
    expect(r.text).not.toContain('Teste');
    const table = r.blocks.find((b) => b.kind === 'table');
    expect(table && table.kind === 'table' && table.rows).toEqual([['Nome', 'Valor'], ['João', '10']]);
    expect(r.text).toContain('Depois da tabela');
  });
});

describe('Tokens e resumo', () => {
  it('conta tokens com tokenizer real e heurística', async () => {
    const n = await countTokens(SENTENCA_TXT);
    expect(n).toBeGreaterThan(100);
    const h = heuristicTokens(SENTENCA_TXT);
    expect(Math.abs(h - n) / n).toBeLessThan(0.6);
  });
  it('resumo extrativo usa apenas frases literais', () => {
    const blocks = textToBlocks(SENTENCA_TXT);
    const s = extractiveSummary(blocks, 3);
    const flat = SENTENCA_TXT.replace(/\s+/g, ' ');
    for (const line of s.split('\n')) expect(flat).toContain(line.replace(/^- /, '').replace(/ _\(p\. \d+\)_$/, ''));
  });
});
