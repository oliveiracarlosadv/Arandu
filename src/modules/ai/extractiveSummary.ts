// Resumo extrativo determinístico (sem IA generativa): seleciona frases do próprio documento
// por relevância (TF-IDF simplificado + posição + presença de entidades jurídicas).
// Nunca reescreve: cada frase é literal.

import type { Block } from '../../types';

const STOP = new Set(
  'a o e é de do da dos das em no na nos nas um uma uns umas para por com sem que se não ao à às aos ou como mais mas foi ser são há pelo pela pelos pelas este esta isso isto esse essa seu sua seus suas lhe já também quando onde qual quais sobre entre até após ante sob tal tais nº art'.split(' '),
);

const tokenize = (s: string) => s.toLowerCase().match(/[\p{L}]{3,}/gu)?.filter((w) => !STOP.has(w)) ?? [];

export function extractiveSummary(blocks: Block[], maxSentences = 8): string {
  const sentences: { text: string; page?: number; pos: number }[] = [];
  let page: number | undefined;
  for (const b of blocks) {
    if (b.kind === 'pagebreak') { page = b.page; continue; }
    if (b.kind !== 'paragraph' && b.kind !== 'quote') continue;
    for (const s of b.text.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú"\u201C])/)) {
      const t = s.trim();
      if (t.length >= 50 && t.length <= 600) sentences.push({ text: t, page: b.page ?? page, pos: sentences.length });
    }
  }
  if (!sentences.length) return 'Não há texto corrido suficiente para gerar um resumo extrativo.';

  const df = new Map<string, number>();
  const toks = sentences.map((s) => tokenize(s.text));
  toks.forEach((ts) => new Set(ts).forEach((w) => df.set(w, (df.get(w) ?? 0) + 1)));
  const N = sentences.length;
  const tf = new Map<string, number>();
  toks.flat().forEach((w) => tf.set(w, (tf.get(w) ?? 0) + 1));

  const scored = sentences.map((s, i) => {
    const ts = toks[i];
    if (!ts.length) return { ...s, score: 0 };
    let score = 0;
    for (const w of ts) score += (tf.get(w) ?? 0) * Math.log(1 + N / (df.get(w) ?? 1));
    score /= Math.sqrt(ts.length);
    const rel = i / N;
    if (rel < 0.1) score *= 1.3;
    if (rel > 0.85) score *= 1.25; // conclusões/dispositivo
    if (/julgo|condeno|requer|pede|ante o exposto|diante do exposto|acordam|defiro|indefiro|homologo|R\$|\d{7}-\d{2}\./i.test(s.text)) score *= 1.5;
    return { ...s, score };
  });
  const chosen = [...scored].sort((a, b) => b.score - a.score).slice(0, maxSentences).sort((a, b) => a.pos - b.pos);
  return chosen.map((s) => `- ${s.text}${s.page ? ` _(p. ${s.page})_` : ''}`).join('\n');
}
