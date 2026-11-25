import { describe, expect, it } from 'vitest';
import { decodeCnj, validateCnjCheckDigit } from '../src/modules/legal/cnj';
import { classifyLegal } from '../src/modules/legal/classifier';
import { analyzeLegal } from '../src/modules/legal/extractor';
import { legalHeaderMarkdown, NOT_FOUND } from '../src/modules/legal/legalMarkdown';
import { textToBlocks } from '../src/modules/txt/txtExtractor';
import { SENTENCA_TXT } from './fixtures/sentenca';

describe('CNJ', () => {
  it('decodifica segmento e tribunal', () => {
    const i = decodeCnj('0000123-45.2026.5.08.0002')!;
    expect(i.segment).toBe('Justiça do Trabalho');
    expect(i.tribunal).toContain('8ª Região');
    const tj = decodeCnj('0801234-56.2025.8.14.0301')!;
    expect(tj.tribunal).toContain('Pará');
  });
  it('valida dígito verificador (mod 97)', () => {
    // 0000001-45.2026.8.26.0100 → calcula DV correto e compara
    const base = '0000001' + '2026' + '8' + '26' + '0100';
    const dv = 98 - Number((BigInt(base) * 100n) % 97n);
    const n = `0000001-${String(dv).padStart(2, '0')}.2026.8.26.0100`;
    expect(validateCnjCheckDigit(n)).toBe(true);
    expect(validateCnjCheckDigit(n.replace(/-\d{2}\./, '-00.'))).toBe(dv === 0);
  });
});

describe('Classificador', () => {
  it('identifica sentença', () => {
    const c = classifyLegal(SENTENCA_TXT);
    expect(c.type).toBe('Sentença');
    expect(c.isLegal).toBe(true);
  });
  it('não classifica texto não jurídico', () => {
    const c = classifyLegal('Receita de bolo de cenoura. Misture os ovos com a farinha e asse por 40 minutos.');
    expect(c.type).toBeNull();
  });
});

describe('Extração jurídica', () => {
  const blocks = textToBlocks(SENTENCA_TXT);
  const a = analyzeLegal(blocks, SENTENCA_TXT);
  it('extrai dados literais', () => {
    expect(a.processNumbers[0].value).toBe('0000123-45.2026.5.08.0002');
    expect(a.parties.map((p) => p.role)).toEqual(expect.arrayContaining(['Reclamante', 'Reclamada']));
    expect(a.parties.find((p) => p.role === 'Reclamante')?.name).toBe('MARIA DAS GRAÇAS SOUZA');
    expect(a.lawyers[0].oab).toContain('12.345');
    expect(a.lawyers[0].name).toBe('João Pereira Lima');
    expect(a.monetaryValues.map((v) => v.value).join(' ')).toContain('R$ 12.345,67');
    expect(a.statutes.map((s) => s.value).join(' | ')).toMatch(/art\. 59 da CLT/);
    expect(a.caseLaw.map((s) => s.value).join(' ')).toMatch(/Súmula nº 338 do TST/);
    expect(a.documentDate?.value).toContain('25 de novembro de 2026');
    expect(a.decisionResult[0].value).toMatch(/julgo parcialmente procedentes/);
    expect(a.deadlines[0].value).toMatch(/prazo de 8 \(oito\) dias/);
    expect(a.orgao[0].value).toMatch(/2ª Vara do Trabalho de Belém/);
  });
  it('marca ausentes como "Não identificado no documento."', () => {
    const md = legalHeaderMarkdown(a);
    // Campos ausentes (ex.: comarca, data de publicação) são agrupados numa única linha explícita
    const line = md.split('\n').find((l) => l.startsWith(`_${NOT_FOUND.replace(/\.$/, '')}:`)) ?? '';
    expect(line).toContain('comarca');
    expect(line).toContain('data de publicação');
  });
  it('nunca inventa: todo valor extraído existe no texto', () => {
    const flat = SENTENCA_TXT.replace(/\s+/g, ' ');
    for (const e of [...a.statutes, ...a.caseLaw, ...a.processNumbers, ...a.monetaryValues, ...a.deadlines]) {
      const core = e.value.replace(/ \[…\]$/, '').replace(/\s+/g, ' ');
      expect(flat).toContain(core);
    }
  });
});

describe('Classificador — falsos positivos', () => {
  it('biografia profissional de advogado não é peça processual', () => {
    const bio = 'Carlos é advogado e empreendedor jurídico, natural de Belém. Atua na advocacia contenciosa, com foco em inovação e eficiência na prestação de serviços jurídicos. Foi sócio de escritório, liderando estratégias processuais e equipes. Compartilha conhecimento sobre Direito e tecnologia.';
    expect(classifyLegal(bio).type).toBeNull();
  });
  it('petição inicial é reconhecida', () => {
    const p = 'EXCELENTÍSSIMO SENHOR JUIZ DA VARA DO TRABALHO DE BELÉM\n\nMARIA, já qualificada, vem, por seu advogado, propor RECLAMAÇÃO TRABALHISTA em face de EMPRESA LTDA, pelos fatos a seguir.\n\nDOS FATOS\n...\n\nDOS PEDIDOS\na) horas extras;\nb) reflexos.\n\nDá-se à causa o valor de R$ 10.000,00.';
    expect(classifyLegal(p).type).toBe('Petição inicial');
  });
});
