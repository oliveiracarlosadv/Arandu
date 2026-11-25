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
  L.push('> Extração automática e literal, feita por regras locais. Cada item é um trecho que consta no documento, com a página quando disponível. Confira as informações antes de usá-las.');
  L.push('### Identificação');
  L.push(
    [
      `- Tipo de documento: ${a.documentType}${a.typeConfidence ? ` (confiança estimada ${Math.round(a.typeConfidence * 100)}%)` : ''}`,
      `- Número do processo: ${a.processNumbers.length ? a.processNumbers.map((e) => e.value + ref(e)).join('; ') : NOT_FOUND}`,
      `- Tribunal (conforme o texto): ${a.tribunal.length ? a.tribunal.map((e) => e.value + ref(e)).join('; ') : NOT_FOUND}`,
      ...(a.tribunalFromCnj ? [`- Tribunal (decodificado do número CNJ): ${a.tribunalFromCnj}`] : []),
      `- Vara / órgão julgador: ${a.orgao.length ? a.orgao.map((e) => e.value + ref(e)).join('; ') : NOT_FOUND}`,
      `- Comarca: ${a.comarca.length ? a.comarca.map((e) => e.value.replace(/^Comarca de /i, '') + ref(e)).join('; ') : NOT_FOUND}`,
      `- Data do documento: ${one(a.documentDate)}`,
      `- Data de publicação: ${one(a.publicationDate)}`,
    ].join('\n'),
  );

  const isDecision = /Senten|Acórd|Decisão/.test(a.documentType);
  // Seções com conteúdo são listadas; as vazias são agrupadas numa única linha (economiza tokens
  // sem omitir a informação de que não constam do documento).
  const sections: { title: string; items: Evidence[]; note?: string; max?: number }[] = [
    { title: 'Partes', items: a.parties.map((p) => ({ value: `${p.role}: ${p.name}`, page: p.page })) },
    { title: 'Advogados', items: a.lawyers.map((l) => ({ value: `${l.name ?? 'Nome não identificado'} \u2014 ${l.oab}`, page: l.page })) },
    { title: 'Pedidos formulados', items: a.requests, note: 'Pedidos são requerimentos/alegações da parte \u2014 não constituem decisão judicial.', max: 40 },
    { title: 'Fundamentos jurídicos (títulos das seções)', items: a.legalGrounds },
    { title: 'Dispositivos legais citados', items: a.statutes, max: 60 },
    { title: 'Jurisprudência e precedentes citados', items: a.caseLaw, max: 40 },
    { title: 'Valores mencionados', items: a.monetaryValues, max: 25 },
    { title: 'Obrigações estabelecidas', items: a.obligations, max: 15 },
    { title: 'Prazos expressamente indicados', items: a.deadlines, max: 15 },
    ...(isDecision ? [{ title: 'Resultado da decisão (trechos do dispositivo)', items: a.decisionResult, max: 8 }] : []),
    ...(a.signatures.length ? [{ title: 'Elementos visuais de assinatura', items: a.signatures, note: 'Indicados apenas como elementos visuais; a autoria não é atribuída automaticamente.', max: 10 }] : []),
  ];
  const empty: string[] = [];
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
      ? `> Resumo produzido por IA local (${s.model}). É uma síntese interpretativa: pode conter imprecisões e não substitui o conteúdo original abaixo.`
      : '> Resumo extrativo: frases selecionadas automaticamente do próprio documento, sem reescrita por IA. Não substitui o conteúdo original abaixo.';
  return `## ${n}. Resumo\n\n${label}\n\n${s.text.trim()}`;
}
