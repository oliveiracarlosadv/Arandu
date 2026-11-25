// Utilitários de normalização textual \u2014 determinísticos e sem perda de conteúdo substantivo.

/** Caracteres invisíveis/controle que não carregam informação (zero-width, BOM, soft hyphen, etc.). */
const INVISIBLE = /[\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\u0000-\u0008\u000B\u000E-\u001F\u007F]/g;

export function removeInvisible(s: string): string {
  return s.replace(INVISIBLE, '');
}

/** Normaliza variantes de espaço (NBSP, thin space, etc.) para espaço comum e colapsa repetições. */
export function normalizeSpaces(s: string): string {
  return s
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t]/g, ' ')
    .replace(/ {2,}/g, ' ');
}

/** Normaliza aspas/hífens tipográficos que geram tokens extras sem alterar sentido. */
export function normalizePunctuation(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2010\u2011]/g, '-');
}

export function cleanInline(s: string): string {
  return normalizeSpaces(removeInvisible(s)).trim();
}

/**
 * Une linhas quebradas artificialmente (quebra de linha do layout, não do conteúdo),
 * inclusive palavras hifenizadas no fim da linha ("contra-\ntação" → "contratação").
 */
export function joinWrappedLines(lines: string[]): string {
  let out = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!out) {
      out = line;
      continue;
    }
    if (/[A-Za-zÀ-ÿ]-$/.test(out) && /^[a-zà-ÿ]/.test(line)) {
      out = out.slice(0, -1) + line;
    } else {
      out += ' ' + line;
    }
  }
  return out;
}

/** Chave para comparar linhas repetidas (cabeçalhos/rodapés) ignorando números de página. */
export function marginalKey(s: string): string {
  return cleanInline(s)
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ');
}

export function isPageNumberLine(s: string): boolean {
  const t = cleanInline(s).toLowerCase();
  return (
    /^-?\s*\d{1,4}\s*-?$/.test(t) ||
    /^(p[áa]g(ina)?\.?|fl(s|\.)?\.?|folha)\s*\d{1,4}(\s*(de|\/)\s*\d{1,4})?$/.test(t) ||
    /^\d{1,4}\s*(de|\/)\s*\d{1,4}$/.test(t)
  );
}

export function isMostlyUppercase(s: string): boolean {
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, '').length;
  return upper / letters.length > 0.85;
}

export function escapeMarkdownInline(s: string): string {
  // Escapa apenas o que alteraria a estrutura quando no início da linha.
  return s.replace(/^(#{1,6}\s|>\s|[-*+]\s|\d+[.)]\s)/, (m) => '\\' + m);
}

export function escapeTableCell(s: string): string {
  return cleanInline(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

export function wordCount(s: string): number {
  const m = s.match(/\S+/g);
  return m ? m.length : 0;
}
