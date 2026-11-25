// Montagem do Markdown jurídico com separação explícita entre:
// (1) informações identificadas automaticamente, (2) resumo produzido por IA/extrativo,
// (3) estruturação e (4) conteúdo original extraído.

import type { Evidence, LegalAnalysis, SummaryResult } from '../../types';

export const NOT_FOUND = 'Não identificado no documento.';

const ref = (e: Evidence) => (e.page ? ` _(p. ${e.page})_` : '');
const one = (e?: Evidence) => (e ? `${e.value}${ref(e)}` : NOT_FOUND);
const list = (items: Evidence[], max = 30) =>
  items.length ? items.slice(0, max).map((e) => `- ${e.value}${ref(e)}`).join('\n') + (items.length > max ? `\n- \u2026 (+${items.length - max})` : '') : `- ${NOT_FOUND}`;

export function legalHeaderMarkdown(a: LegalAnalysis): string {
  const L: string[] = [];
  L.push('## 1. Informações identificadas automaticamente');
  L.push('> Extração literal por regras locais, com página quando disponível. Confira antes de usar.');
  // Identificação: só os campos encontrados; os ausentes vão para a linha "Não identificado".
  const join = (items: Evidence[], strip?: RegExp) => items.map((e) => (strip ? e.value.replace(strip, '') : e.value) + ref(e)).join('; ');
  const idFields: [string, string | null][] = [
    ['Tipo', a.documentType && a.documentType !== NOT_FOUND ? `${a.documentType}${a.typeConfidence ? ` (confiança ${Math.round(a.typeConfidence * 100)}%)` : ''}` : null],
    ['Processo', a.processNumbers.length ? join(a.processNumbers) : null],
    ['Tribunal', a.tribunal.length ? join(a.tribunal) : null],
    ['Tribunal pelo número CNJ', a.tribunalFromCnj ?? null],
    ['Vara/órgão julgador', a.orgao.length ? join(a.orgao) : null],
    ['Comarca', a.comarca.length ? join(a.comarca, /^Comarca de /i) : null],
    ['Data do documento', a.documentDate ? one(a.documentDate) : null],
    ['Data de publicação', a.publicationDate ? one(a.publicationDate) : null],
  ];
  const found = idFields.filter(([, v]) => v);
  if (found.length) L.push(found.map(([k, v]) => `- ${k}: ${v}`).join('\n'));
  const missingId = idFields.filter(([k, v]) => !v && k !== 'Tribunal pelo número CNJ').map(([k]) => k.toLowerCase());

  const isDecision = /Senten|Acórd|Decisão/.test(a.documentType);
  // Seções com conteúdo são listadas; as vazias são agrupadas numa única linha (economiza tokens
  // sem omitir a informação de que não constam do documento).
  const sections: { title: string; items: Evidence[]; note?: string; max?: number }[] = [
    { title: 'Partes', items: a.parties.map((p) => ({ value: `${p.role}: ${p.name}`, page: p.page })) },
    { title: 'Advogados', items: a.lawyers.map((l) => ({ value: `${l.name ?? 'Nome não identificado'} \u2014 ${l.oab}`, page: l.page })) },
    { title: 'Pedidos formulados', items: a.requests, note: 'Alegações da parte, não decisão judicial.', max: 40 },
    { title: 'Fundamentos jurídicos (títulos das seções)', items: a.legalGrounds },
    { title: 'Dispositivos legais citados', items: a.statutes, max: 60 },
    { title: 'Jurisprudência e precedentes citados', items: a.caseLaw, max: 40 },
    { title: 'Valores mencionados', items: a.monetaryValues, max: 25 },
    { title: 'Obrigações estabelecidas', items: a.obligations, max: 15 },
    { title: 'Prazos expressamente indicados', items: a.deadlines, max: 15 },
    ...(isDecision ? [{ title: 'Resultado da decisão (trechos do dispositivo)', items: a.decisionResult, max: 8 }] : []),
    ...(a.signatures.length ? [{ title: 'Elementos visuais de assinatura', items: a.signatures, note: 'Apenas elementos visuais; autoria não atribuída.', max: 10 }] : []),
  ];
  const empty: string[] = [...missingId];
  for (const sec of sections) {
    if (!sec.items.length) { empty.push(sec.title.replace(/ \(.*\)$/, '').toLowerCase()); continue; }
    L.push(`### ${sec.title}`);
    if (sec.note) L.push(`> ${sec.note}`);
    L.push(list(sec.items, sec.max ?? 30));
  }
  if (empty.length) L.push(`_${NOT_FOUND.replace(/\.$/, '')}: ${empty.join('; ')}._`);
  return L.join('\n\n');
}

export function summaryMarkdown(s: SummaryResult, n: number): string {
  const label =
    s.method === 'ia-local'
      ? `> Síntese da IA local (${s.model}); pode conter imprecisões. Não substitui o original.`
      : '> Frases literais selecionadas do documento (sem IA). Não substitui o original.';
  return `## ${n}. Resumo\n\n${label}\n\n${s.text.trim()}`;
}
