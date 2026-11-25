// Estimativa de tokens. Usa o tokenizer o200k_base (família GPT-4o) como referência, carregado
// localmente sob demanda. Outros modelos (Claude, Gemini, Llama\u2026) usam tokenizers distintos:
// os números são ESTIMATIVAS e podem variar tipicamente ±15%.

export const TOKENIZER_LABEL = 'o200k_base (referência; varia conforme o modelo)';

let counter: ((s: string) => number) | null = null;

export async function loadTokenizer(): Promise<(s: string) => number> {
  if (counter) return counter;
  try {
    const mod = await import('gpt-tokenizer/encoding/o200k_base');
    counter = (s: string) => mod.countTokens(s);
  } catch {
    counter = heuristicTokens;
  }
  return counter;
}

/** Heurística de reserva para português: ~1 token a cada 3,6 caracteres, ajustada por pontuação/números. */
export function heuristicTokens(s: string): number {
  if (!s) return 0;
  const words = s.match(/[\p{L}]+/gu)?.length ?? 0;
  const numbersAndPunct = s.match(/[\p{N}]+|[^\p{L}\p{N}\s]/gu)?.length ?? 0;
  return Math.round(Math.max(s.length / 3.6, words * 1.25 + numbersAndPunct * 0.8));
}

export async function countTokens(s: string): Promise<number> {
  const c = await loadTokenizer();
  // Para textos muito grandes, conta em blocos para não travar a interface por muito tempo.
  if (s.length < 200_000) return c(s);
  let total = 0;
  for (let i = 0; i < s.length; i += 100_000) {
    total += c(s.slice(i, i + 100_000));
    await new Promise((r) => setTimeout(r, 0));
  }
  return total;
}
