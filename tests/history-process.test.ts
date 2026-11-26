import { describe, expect, it } from 'vitest';
import { analyzeLegal, processSummary } from '../src/modules/legal/extractor';
import { textToBlocks } from '../src/modules/txt/txtExtractor';

const run = (t: string) => processSummary(analyzeLegal(textToBlocks(t), t));

describe('Resumo do processo para o histórico', () => {
  it('peça com rótulos: autor, réu, número e tribunal', () => {
    const t = 'TRIBUNAL REGIONAL DO TRABALHO DA 8ª REGIÃO\n\nProcesso nº 0000123-45.2026.5.08.0002\nRECLAMANTE: MARIA DAS GRAÇAS SOUZA\nRECLAMADA: EMPRESA EXEMPLO LTDA\n\nSENTENÇA\n\nAnte o exposto, julgo procedente o pedido.';
    expect(run(t)).toEqual({
      numero: '0000123-45.2026.5.08.0002',
      autor: 'MARIA DAS GRAÇAS SOUZA',
      reu: 'EMPRESA EXEMPLO LTDA',
      tribunal: 'TRIBUNAL REGIONAL DO TRABALHO DA 8ª REGIÃO',
    });
  });
  it('petição sem rótulos: "FULANO, ..., vem propor ... em face de BELTRANO"', () => {
    const t = 'EXCELENTÍSSIMO SENHOR JUIZ DA VARA DO TRABALHO DE BELÉM\n\nMARIA DAS GRAÇAS SOUZA, brasileira, auxiliar administrativa, vem, por seu advogado, propor RECLAMAÇÃO TRABALHISTA em face de EMPRESA EXEMPLO LTDA, pelos fatos a seguir.\n\nDOS PEDIDOS\n\na) horas extras.';
    const p = run(t)!;
    expect(p.autor).toBe('MARIA DAS GRAÇAS SOUZA');
    expect(p.reu).toBe('EMPRESA EXEMPLO LTDA');
  });
  it('preserva abreviações societárias no nome da parte', () => {
    const t = 'EXCELENTÍSSIMO SENHOR JUIZ\n\nANA PEREIRA, brasileira, vem propor RECLAMAÇÃO TRABALHISTA em face de LOJAS MODELO S.A., pelos fatos a seguir.';
    expect(run(t)!.reu).toBe('LOJAS MODELO S.A.');
    const t2 = 'Processo nº 0801234-56.2025.8.14.0301\nAUTOR: JOÃO\nRÉU: COMÉRCIO BOM PREÇO LTDA.\n\nSENTENÇA\n\nJulgo procedente o pedido.';
    expect(run(t2)!.reu).toBe('COMÉRCIO BOM PREÇO LTDA.');
  });
  it('tribunal pelo número CNJ quando o texto não o nomeia', () => {
    const t = 'Processo nº 0801234-56.2025.8.14.0301\nAUTOR: JOSÉ DA SILVA\nRÉU: BANCO EXEMPLO S.A.\n\nSENTENÇA\n\nJulgo procedente o pedido.';
    const p = run(t)!;
    expect(p.tribunal).toMatch(/Pará/);
    expect(p.autor).toBe('JOSÉ DA SILVA');
    expect(p.reu).toBe('BANCO EXEMPLO S.A.');
  });
  it('documento não jurídico não gera resumo de processo', () => {
    expect(run('Receita de bolo. Misture os ovos e asse por 40 minutos.')).toBeUndefined();
  });
});
