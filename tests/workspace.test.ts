import { describe, expect, it } from 'vitest';
import { buildChronology, caseIndexMarkdown, docDateLabel, fileNames, type WorkspaceDoc } from '../src/modules/workspace/workspace';
import { analyzeLegal } from '../src/modules/legal/extractor';
import { legalHeaderMarkdown, NOT_FOUND } from '../src/modules/legal/legalMarkdown';
import { textToBlocks } from '../src/modules/txt/txtExtractor';
import { safeFileName } from '../src/utils/format';
import type { ProcessResult } from '../src/types';

const result = (rawText: string, fileName: string): ProcessResult => ({
  id: fileName, fileName, fileSize: rawText.length, format: 'txt', createdAt: 0, mode: 'legal', markdown: rawText, rawText,
  documentType: 'x', pageCount: 1, ocrPageCount: 0, method: 'texto-simples', durationMs: 1,
  stats: { originalChars: 0, finalChars: 0, originalTokens: 0, finalTokens: 0, reductionPct: 0, reductionCounted: false, tokenizer: '' },
  integrity: { ok: true, checked: 0, missing: [] }, warnings: [],
});

const PETICAO = 'A reclamante foi admitida em 01/02/2022 e dispensada em 30/06/2025.\n\nBelém, 10 de julho de 2025.';
const docs: WorkspaceDoc[] = [
  { id: '1', caseId: 'c', addedAt: 0, displayName: 'Petição inicial', documentType: 'Petição inicial', documentDate: 'Belém, 10 de julho de 2025', documentDateTs: Date.UTC(2025, 6, 10), result: result(PETICAO, 'Petição inicial.txt') },
];

describe('Workspace', () => {
  it('cronologia: um evento por data, inclusive várias datas na mesma frase', () => {
    const md = buildChronology(docs, fileNames(docs));
    expect(md).toContain('**01/02/2022**');
    expect(md).toContain('**30/06/2025**');
  });
  it('cronologia: não repete a frase da data do documento', () => {
    const md = buildChronology(docs, fileNames(docs));
    expect(md.match(/\*\*10\/07\/2025\*\*/g)?.length).toBe(1);
    expect(md).toContain('Petição inicial** (data do documento)');
  });
  it('índice mostra a data normalizada', () => {
    expect(docDateLabel(docs[0])).toBe('10/07/2025');
    expect(caseIndexMarkdown({ id: 'c', title: 'Caso', createdAt: 0 }, docs, fileNames(docs))).toContain('| 10/07/2025 |');
  });
  it('nomes de arquivo preservam pontos do número CNJ', () => {
    expect(safeFileName('0000123-45.2026.5.08.0002')).toBe('0000123-45.2026.5.08.0002');
    expect(safeFileName('a/b:c')).toBe('a_b_c');
  });
});

describe('Extração — data do documento', () => {
  it('reconhece "Aos DD/MM/AAAA" em atas', () => {
    const t = 'ATA DE AUDIÊNCIA\n\nAos 15/09/2026, aberta a audiência, presentes as partes.';
    expect(analyzeLegal(textToBlocks(t), t).documentDate?.value).toMatch(/15\/09\/2026/);
  });
});

describe('Cabeçalho jurídico compacto', () => {
  it('agrupa seções vazias numa única linha', () => {
    const t = 'SENTENÇA\n\nAnte o exposto, julgo procedente o pedido.\n\nBelém, 25 de novembro de 2026.';
    const md = legalHeaderMarkdown(analyzeLegal(textToBlocks(t), t));
    expect(md).not.toContain('### Jurisprudência');
    expect(md).toMatch(new RegExp(`_${NOT_FOUND.replace(/\.$/, '')}: .*jurisprudência`));
    expect(md).toContain('### Resultado da decisão');
  });
});
