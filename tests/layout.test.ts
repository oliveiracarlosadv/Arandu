import { describe, expect, it } from 'vitest';
import { buildLines, detectRepeatedMarginals, linesToBlocks, type PageLayout, type TextItem } from '../src/modules/layout/layoutEngine';

// Gera itens de uma linha (palavras separadas por espaço de 0,3em), fonte 12, a partir de x=72.
function line(text: string, y: number, opts: { x?: number; h?: number; bold?: boolean } = {}): TextItem[] {
  const h = opts.h ?? 12;
  let x = opts.x ?? 72;
  return text.split(' ').map((w) => {
    const it = { text: w, x, y, width: w.length * h * 0.5, height: h, bold: opts.bold };
    x += it.width + h * 0.3;
    return it;
  });
}
const page = (n: number, items: TextItem[]): PageLayout => ({ page: n, width: 612, height: 792, lines: buildLines(items) });
const opts = { marginals: new Set<string>(), bodyHeight: 12, keepMarginals: true, seenMarginals: new Set<string>() };
const LONG = 'texto corrido que ocupa a largura inteira da linha do documento para simular um parágrafo justificado longo';

describe('Motor de layout', () => {
  it('separa linhas curtas de identificação e une linhas de parágrafo', () => {
    const items = [
      ...line('Processo nº 0000123-45.2026.5.08.0002', 100),
      ...line('RECLAMANTE: MARIA DAS GRAÇAS', 116),
      ...line('RECLAMADA: EMPRESA EXEMPLO LTDA', 132),
      ...line(LONG, 160),
      ...line('continuação do mesmo parágrafo até o ponto final.', 176),
    ];
    const { blocks } = linesToBlocks(page(1, items), opts);
    const paras = blocks.filter((b) => b.kind === 'paragraph').map((b) => (b as { text: string }).text);
    expect(paras).toContain('RECLAMANTE: MARIA DAS GRAÇAS');
    expect(paras).toContain('RECLAMADA: EMPRESA EXEMPLO LTDA');
    expect(paras.some((p) => p.startsWith('texto corrido') && p.endsWith('ponto final.'))).toBe(true);
  });

  it('não funde títulos consecutivos e detecta título por tamanho', () => {
    const items = [...line('SENTENÇA', 100, { h: 18 }), ...line('RELATÓRIO', 130), ...line('FUNDAMENTAÇÃO', 144), ...line(LONG, 160)];
    const { blocks } = linesToBlocks(page(1, items), opts);
    const heads = blocks.filter((b) => b.kind === 'heading').map((b) => (b as { text: string; level: number }));
    expect(heads.map((h) => h.text)).toEqual(['SENTENÇA', 'RELATÓRIO', 'FUNDAMENTAÇÃO']);
    expect(heads[0].level).toBe(1);
  });

  it('marcador "•" separado vira lista, não tabela', () => {
    const items = [
      { text: '•', x: 72, y: 100, width: 6, height: 12 },
      ...line('Custas pela reclamada.', 100, { x: 108 }),
      { text: '•', x: 72, y: 116, width: 6, height: 12 },
      ...line('Intimem-se as partes.', 116, { x: 108 }),
    ];
    const { blocks } = linesToBlocks(page(1, items), opts);
    expect(blocks[0]).toMatchObject({ kind: 'list', ordered: false, items: ['Custas pela reclamada.', 'Intimem-se as partes.'] });
  });

  it('detecta tabela com colunas alinhadas', () => {
    const items = [
      ...line('Parcela', 100), ...line('Valor', 100, { x: 360 }),
      ...line('Horas extras', 116), ...line('R$ 10.000,00', 116, { x: 360 }),
      ...line('Reflexos', 132), ...line('R$ 2.345,67', 132, { x: 360 }),
    ];
    const { blocks } = linesToBlocks(page(1, items), opts);
    expect(blocks[0]).toEqual({ kind: 'table', page: 1, rows: [['Parcela', 'Valor'], ['Horas extras', 'R$ 10.000,00'], ['Reflexos', 'R$ 2.345,67']] });
  });

  it('remove cabeçalho repetido e numeração de página, preservando a 1ª ocorrência', () => {
    const pages = [1, 2, 3].map((n) => page(n, [...line('TRIBUNAL REGIONAL DO TRABALHO', 30), ...line(LONG + ` página ${n}.`, 300), ...line(`Página ${n} de 3`, 770)]));
    const marg = detectRepeatedMarginals(pages);
    expect(marg.size).toBeGreaterThan(0);
    const seen = new Set<string>();
    const all = pages.flatMap((p) => linesToBlocks(p, { marginals: marg, bodyHeight: 12, keepMarginals: false, seenMarginals: seen }).blocks);
    const txt = all.map((b) => ('text' in b ? b.text : '')).join('\n');
    expect(txt.match(/TRIBUNAL REGIONAL/g)?.length).toBe(1);
    expect(txt).not.toMatch(/Página \d de 3/);
  });
});
