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
  L.push('### Partes');
  L.push(a.parties.length ? a.parties.map((p) => `- ${p.role}: ${p.name}${p.page ? ` _(p. ${p.page})_` : ''}`).join('\n') : `- ${NOT_FOUND}`);
  L.push('### Advogados');
  L.push(a.lawyers.length ? a.lawyers.map((l) => `- ${l.name ?? 'Nome não identificado'} \u2014 ${l.oab}${l.page ? ` _(p. ${l.page})_` : ''}`).join('\n') : `- ${NOT_FOUND}`);

  const isDecision = /Senten|Acórd|Decisão/.test(a.documentType);
  L.push('### Pedidos formulados');
  L.push('> Pedidos são requerimentos/alegações da parte \u2014 não constituem decisão judicial.');
  L.push(list(a.requests, 40));
  L.push('### Fundamentos jurídicos (títulos das seções)');
  L.push(list(a.legalGrounds));
  L.push('### Dispositivos legais citados');
  L.push(list(a.statutes, 60));
  L.push('### Jurisprudência e precedentes citados');
  L.push(list(a.caseLaw, 40));
  L.push('### Valores mencionados');
  L.push(list(a.monetaryValues, 25));
  L.push('### Obrigações estabelecidas');
  L.push(list(a.obligations, 15));
  L.push('### Prazos expressamente indicados');
  L.push(list(a.deadlines, 15));
  if (isDecision) {
    L.push('### Resultado da decisão (trechos do dispositivo)');
    L.push(list(a.decisionResult, 8));
  }
  if (a.signatures.length) {
    L.push('### Elementos visuais de assinatura');
    L.push('> Indicados apenas como elementos visuais; a autoria não é atribuída automaticamente.');
    L.push(list(a.signatures, 10));
  }
  return L.join('\n\n');
}

export function summaryMarkdown(s: SummaryResult, n: number): string {
  const label =
    s.method === 'ia-local'
      ? `> Resumo produzido por IA local (${s.model}). É uma síntese interpretativa: pode conter imprecisões e não substitui o conteúdo original abaixo.`
      : '> Resumo extrativo: frases selecionadas automaticamente do próprio documento, sem reescrita por IA. Não substitui o conteúdo original abaixo.';
  return `## ${n}. Resumo\n\n${label}\n\n${s.text.trim()}`;
}
