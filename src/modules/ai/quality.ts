// Trava de qualidade para textos gerados pela IA local.
// Modelos pequenos quantizados podem produzir saída corrompida (tokens repetidos, palavras
// inexistentes) por limitações numéricas de GPU/navegador. Esse texto NUNCA deve ser exibido
// como resumo: é descartado e substituído pelo resumo extrativo, com aviso ao usuário.

const PT_COMMON = new Set(
  'a o e é de do da dos das em no na nos nas um uma para por com que se não ao à os as foi ser são pelo pela mais como sobre entre também seu sua processo reclamante reclamada autor réu pedido pedidos sentença decisão valor prazo dias juiz parte partes horas extras danos morais condenação julgo procedente improcedente parcialmente lei art'.split(' '),
);

export interface QualityResult {
  ok: boolean;
  reason?: string;
}

export function validateGeneratedText(text: string): QualityResult {
  const t = text.trim();
  if (t.length < 40) return { ok: false, reason: 'texto muito curto' };
  const words = t.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  if (words.length < 8) return { ok: false, reason: 'poucas palavras' };

  // 1) Repetição: uma única palavra dominando o texto
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const top = Math.max(...freq.values());
  if (top / words.length > 0.25 && words.length > 12) return { ok: false, reason: 'repetição excessiva' };

  // 2) Diversidade lexical mínima
  if (freq.size / words.length < 0.3 && words.length > 20) return { ok: false, reason: 'baixa diversidade lexical' };

  // 3) Linhas repetidas
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 4 && new Set(lines).size / lines.length < 0.6) return { ok: false, reason: 'linhas repetidas' };

  // 4) Deve parecer português: proporção mínima de palavras comuns
  const common = words.filter((w) => PT_COMMON.has(w)).length;
  if (common / words.length < 0.12) return { ok: false, reason: 'não parece português coerente' };

  return { ok: true };
}
