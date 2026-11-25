import { describe, expect, it } from 'vitest';
import { validateGeneratedText } from '../src/modules/ai/quality';

// Saída real produzida pelo Qwen2.5 0.5B (q4f16/WebGPU) em teste no navegador (25/11/2026).
const GARBAGE = ['Démoise', ...Array(9).fill('Démoise'), 'Rédeome', 'Réminues', ...Array(40).fill('Réminées')].join('\n');

describe('Trava de qualidade da IA', () => {
  it('rejeita a saída corrompida observada em produção', () => {
    const r = validateGeneratedText(GARBAGE);
    expect(r.ok).toBe(false);
  });
  it('rejeita repetição e texto que não é português', () => {
    expect(validateGeneratedText('horas horas horas horas horas horas horas horas horas horas horas horas horas').ok).toBe(false);
    expect(validateGeneratedText('Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore').ok).toBe(false);
    expect(validateGeneratedText('curto').ok).toBe(false);
  });
  it('aceita um resumo coerente em português', () => {
    const ok = `- A reclamante pediu horas extras, reflexos e indenização por danos morais.
- O juiz reconheceu a jornada das 8h às 19h com base na Súmula nº 338 do TST.
- O pedido de danos morais foi julgado improcedente.
- A reclamada foi condenada ao pagamento de R$ 12.345,67 no prazo de 8 dias.`;
    expect(validateGeneratedText(ok)).toEqual({ ok: true });
  });
});
