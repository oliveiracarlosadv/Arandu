// Validação de integridade: garante que entidades críticas presentes no texto extraído
// (números de processo, datas, valores, OAB, dispositivos legais) continuam no resultado final.
// Se algo se perdeu, a redução de tokens NÃO é contabilizada como ganho.

import type { IntegrityReport } from '../../types';
import { PATTERNS } from '../legal/patterns';

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u00A0\s]+/g, '')
    .replace(/[º°ª]/g, 'o')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\\*]/g, '');

const CHECKS: { kind: string; re: RegExp }[] = [
  { kind: 'Número de processo', re: PATTERNS.cnj },
  { kind: 'Valor monetário', re: PATTERNS.money },
  { kind: 'Data', re: PATTERNS.dateNumeric },
  { kind: 'Data por extenso', re: PATTERNS.dateLong },
  { kind: 'OAB', re: PATTERNS.oab },
  { kind: 'Dispositivo legal', re: PATTERNS.article },
];

export function checkIntegrity(source: string, result: string): IntegrityReport {
  const target = norm(result);
  const missing: IntegrityReport['missing'] = [];
  let checked = 0;
  for (const { kind, re } of CHECKS) {
    const seen = new Set<string>();
    for (const m of source.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      const v = m[0].trim();
      const k = norm(v);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      checked++;
      if (!target.includes(k)) missing.push({ kind, value: v });
    }
  }
  return { ok: missing.length === 0, checked, missing: missing.slice(0, 50) };
}
