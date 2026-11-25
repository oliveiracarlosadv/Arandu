// Expressões regulares para entidades jurídicas brasileiras. Extração literal: nada é inferido.

const MONTHS = 'janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';

export const PATTERNS = {
  /** Numeração única CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO */
  cnj: /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g,
  money: /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?(?!\d)/g,
  dateNumeric: /\b(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}\b/g,
  dateLong: new RegExp(`\\b(?:[1-9]|[12]\\d|3[01])º?\\s+de\\s+(?:${MONTHS})\\s+de\\s+(?:19|20)\\d{2}\\b`, 'gi'),
  oab: /\bOAB\s*[/-]?\s*[A-Z]{2}\s*(?:n[º°o.]?\s*)?\d{1,3}(?:\.\d{3})*(?:-?[A-Z])?\b|\bOAB\s*(?:n[º°o.]?\s*)?\d{1,3}(?:\.\d{3})*\s*[/-]\s*[A-Z]{2}\b/g,
  article: /\barts?\.\s*\d{1,4}(?:[º°o]|-[A-Z])?(?:\s*,?\s*(?:§\s*\d{1,3}[º°o]?|par[áa]grafo [úu]nico|inc(?:iso|\.)\s*[IVXLC]+|al[íi]nea\s*["\u201C]?[a-z]["\u201D]?))*/gi,
  statuteRef: /\b(?:Lei(?:\s+Complementar)?|Decreto(?:-Lei)?|Medida Provis[óo]ria|Resolu[çc][ãa]o|Instru[çc][ãa]o Normativa|Portaria|Emenda Constitucional)\s+(?:n[º°o.]?\s*)?\d{1,3}(?:\.\d{3})*(?:\/\d{2,4})?(?:,\s*de\s+\d{1,2}(?:º)?\s+de\s+\w+\s+de\s+\d{4})?/gi,
  codes: /\b(?:CLT|CPC|CPC\/2015|CC|CC\/2002|CF|CF\/88|CDC|CTN|CP|CPP|ECA|LINDB|Constitui[çc][ãa]o Federal|C[óo]digo (?:Civil|Penal|de Processo Civil|de Processo Penal|de Defesa do Consumidor|Tribut[áa]rio Nacional))\b/g,
  sumula: /\bS[úu]mula(?:\s+Vinculante)?\s+(?:n[º°o.]?\s*)?\d{1,4}(?:\s+do\s+(?:STF|STJ|TST|TRF\s?\d|TJ[A-Z]{2}|TRT\s?\d{1,2}))?/gi,
  oj: /\b(?:OJ|Orienta[çc][ãa]o Jurisprudencial)\s+(?:n[º°o.]?\s*)?\d{1,4}(?:\s+da\s+SBDI-?[12I]+)?(?:\s+do\s+TST)?/gi,
  tema: /\bTema\s+(?:n[º°o.]?\s*)?\d{1,4}(?:\s+d[oa]\s+(?:STF|STJ|TST|repercuss[ãa]o geral|recursos repetitivos))?/gi,
  caseLaw: /\b(?:RE|REsp|AREsp|AgRg|AgInt|EDcl|HC|RHC|MS|RMS|ADI|ADC|ADPF|ARE|RR|AIRR|Ag-?RR|E-?RR|ROT|RO|AP|AI|Rcl|IRDR|IAC)\s+(?:n[º°o.]?\s*)?\d[\d./-]{2,}\d(?:\/[A-Z]{2})?/g,
  cpf: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  cnpj: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
};

export const MONTH_NAMES = MONTHS.split('|').map((m) => m.replace('[çc]', 'ç'));

export function monthIndex(name: string): number {
  return MONTH_NAMES.indexOf(name.toLowerCase().replace('marco', 'março'));
}
