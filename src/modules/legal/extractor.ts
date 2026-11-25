// Extração jurídica estruturada \u2014 100% literal e rastreável.
// Todo dado retornado é um trecho que EXISTE no documento, com a página de origem quando conhecida.
// Nada é inferido ou completado; o que não for encontrado fica vazio e é exibido como
// "Não identificado no documento."

import type { Block, Evidence, LegalAnalysis, LegalLawyer, LegalParty } from '../../types';
import { classifyLegal } from './classifier';
import { decodeCnj } from './cnj';
import { PATTERNS, monthIndex } from './patterns';

interface Segment {
  text: string;
  page?: number;
  blockIndex: number;
}

function segmentsOf(blocks: Block[]): Segment[] {
  const segs: Segment[] = [];
  let page: number | undefined;
  blocks.forEach((b, i) => {
    if (b.kind === 'pagebreak') { page = b.page; return; }
    const p = ('page' in b && b.page) || page;
    if (b.kind === 'list') b.items.forEach((t) => segs.push({ text: t.trim(), page: p, blockIndex: i }));
    else if (b.kind === 'table') b.rows.forEach((r) => segs.push({ text: r.join(' | '), page: p, blockIndex: i }));
    else if (b.kind === 'visual') segs.push({ text: `[${b.description}]`, page: p, blockIndex: i });
    else segs.push({ text: b.text, page: p, blockIndex: i });
  });
  return segs;
}

function findAll(re: RegExp, segs: Segment[], max = 50): Evidence[] {
  const out: Evidence[] = [];
  const seen = new Set<string>();
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (const s of segs) {
    for (const m of s.text.matchAll(g)) {
      const v = m[0].replace(/\s+/g, ' ').trim();
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ value: v, page: s.page });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Frase completa que contém a correspondência (para dar contexto literal). */
function sentenceAround(text: string, index: number, len: number, maxLen = 320): string {
  const startCandidates = [text.lastIndexOf('. ', index), text.lastIndexOf('; ', index), text.lastIndexOf('\n', index)];
  const start = Math.max(0, Math.max(...startCandidates) + 1);
  const endRel = text.slice(index + len).search(/[.;](\s|$)/);
  const end = endRel === -1 ? text.length : index + len + endRel + 1;
  let s = text.slice(start, end).trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/\s+\S*$/, '') + ' [\u2026]';
  return s;
}

function findSentences(re: RegExp, segs: Segment[], max = 15): Evidence[] {
  const out: Evidence[] = [];
  const seen = new Set<string>();
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (const s of segs) {
    for (const m of s.text.matchAll(g)) {
      const sent = sentenceAround(s.text, m.index ?? 0, m[0].length);
      const k = sent.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ value: sent, page: s.page });
      if (out.length >= max) return out;
    }
  }
  return out;
}

const HEADING_TEXT = (b: Block) => (b.kind === 'heading' ? b.text : b.kind === 'paragraph' && b.text.length < 80 && /^[A-ZÀ-Ú0-9 .,\u2013\-ºª()]+$/.test(b.text) ? b.text : null);

/** Conteúdo literal de uma seção identificada pelo título (até o próximo título). */
function sectionItems(blocks: Block[], titleRe: RegExp, max = 30): Evidence[] {
  const out: Evidence[] = [];
  let page: number | undefined;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === 'pagebreak') { page = b.page; continue; }
    const h = HEADING_TEXT(b);
    if (!h || !titleRe.test(h)) continue;
    for (let j = i + 1; j < blocks.length && out.length < max; j++) {
      const c = blocks[j];
      if (c.kind === 'pagebreak') { page = c.page; continue; }
      if (HEADING_TEXT(c)) break;
      const p = ('page' in c && c.page) || page;
      if (c.kind === 'list') c.items.forEach((t) => out.push({ value: t.trim(), page: p }));
      else if (c.kind === 'paragraph' || c.kind === 'quote') out.push({ value: c.text, page: p });
    }
    if (out.length) break;
  }
  return out;
}

function headingsUnder(blocks: Block[], titleRe: RegExp): Evidence[] {
  const out: Evidence[] = [];
  let inside = false;
  let level = 0;
  let page: number | undefined;
  for (const b of blocks) {
    if (b.kind === 'pagebreak') { page = b.page; continue; }
    if (b.kind !== 'heading') continue;
    if (titleRe.test(b.text)) { inside = true; level = b.level; continue; }
    if (inside) {
      if (b.level <= level && !/^(d[aoe]s?|II|III|IV|V|VI|\d)/i.test(b.text)) break;
      if (/pedido|requerimento|conclus/i.test(b.text)) break;
      out.push({ value: b.text, page: b.page ?? page });
    }
  }
  return out.slice(0, 30);
}

const ROLE_RE = /\b(Reclamante|Reclamad[oa]|Autor(?:a|es|as)?|R[ée]u|R[ée]|Requerente|Requerid[oa]|Apelante|Apelad[oa]|Agravante|Agravad[oa]|Recorrente|Recorrid[oa]|Impetrante|Impetrad[oa]|Exequente|Executad[oa]|Embargante|Embargad[oa]|Contratante|Contratad[oa]|Outorgante|Outorgad[oa]|Notificante|Notificad[oa]|Paciente|Interessad[oa]|Segurad[oa]|Litisconsorte)s?\s*(?:\(s\)|\(a\)|\(es\))?\s*:\s*([^\n|;]{3,120}?)(?=\s+[A-Za-zÀ-ú()]{3,25}(?:\s+[A-Za-zÀ-ú()]{2,15})?\s*:|[\n|;]|$)/gi;

function extractParties(segs: Segment[]): LegalParty[] {
  const out: LegalParty[] = [];
  const seen = new Set<string>();
  for (const s of segs.slice(0, 400)) {
    for (const m of s.text.matchAll(ROLE_RE)) {
      let name = m[2].replace(/\s+(CPF|CNPJ|RG|portador|inscrit|brasileir|residente|domiciliad|ADVOGAD|Advogad).*$/i, '').trim();
      name = name.replace(/[,.]$/, '').trim();
      if (name.length < 3) continue;
      const role = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
      const k = role + '|' + name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ role, name, page: s.page });
      if (out.length >= 20) return out;
    }
  }
  return out;
}

function extractLawyers(segs: Segment[]): LegalLawyer[] {
  const out: LegalLawyer[] = [];
  const seen = new Set<string>();
  const re = new RegExp(PATTERNS.oab.source, 'g');
  for (const s of segs) {
    for (const m of s.text.matchAll(re)) {
      const oab = m[0].replace(/\s+/g, ' ').trim();
      const key = oab.replace(/\D/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      // Nome: sequência de palavras capitalizadas imediatamente antes de "OAB" (ou "Advogado(a):").
      const before = s.text.slice(Math.max(0, (m.index ?? 0) - 90), m.index).replace(/[,\u2013\-\u2013(]\s*$/, '').trim();
      const nm = /((?:[A-ZÀ-Ú][a-zà-ú]+|[A-ZÀ-Ú]{2,}|d[aeo]s?)(?:\s+(?:[A-ZÀ-Ú][a-zà-ú]+|[A-ZÀ-Ú]{2,}|d[aeo]s?|e)){1,7})\s*[,\u2013\-(]?\s*$/.exec(before);
      let name = nm?.[1]?.replace(/^(?:Advogad[oa]|Dr[a]?\.?)\s+/i, '').trim();
      if (name && (name.split(' ').length < 2 || /^(d[aeo]s?|e)$/i.test(name))) name = undefined;
      out.push({ name, oab, page: s.page });
      if (out.length >= 20) return out;
    }
  }
  return out;
}

function parseDate(v: string): number | null {
  const n = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if (n) return Date.UTC(+n[3], +n[2] - 1, +n[1]);
  const l = /(\d{1,2})º?\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i.exec(v);
  if (l) {
    const mi = monthIndex(l[2]);
    if (mi >= 0) return Date.UTC(+l[3], mi, +l[1]);
  }
  return null;
}

export { parseDate };

export function analyzeLegal(blocks: Block[], fullText: string): LegalAnalysis {
  const segs = segmentsOf(blocks);
  const cls = classifyLegal(fullText);

  const processNumbers = findAll(PATTERNS.cnj, segs, 20);
  const firstCnj = processNumbers[0] ? decodeCnj(processNumbers[0].value) : null;

  const tribunal = findAll(/\b(?:Supremo Tribunal Federal|Superior Tribunal de Justi[çc]a|Tribunal Superior do Trabalho|Tribunal Regional (?:do Trabalho|Federal|Eleitoral) d[ao] \d{1,2}[ªa]\s*Regi[ãa]o|Tribunal de Justi[çc]a d[oe]s?(?: Estado d[oe])? [A-ZÀ-Ú][\wÀ-ú ]{2,30}?(?=[\n,.;\u2013-]|$)|\bTRT\s?-?\s?\d{1,2}(?:[ªa] Regi[ãa]o)?|\bTJ[A-Z]{2}\b|\bTRF\s?-?\s?\d\b|\bSTF\b|\bSTJ\b|\bTST\b)/gi, segs, 5);
  const orgao = findAll(/\b(?:\d{1,2}[ªa]\s+)?(?:Vara(?: do Trabalho| C[íi]vel| Criminal| Federal| de Fam[íi]lia| da Fazenda P[úu]blica| [ÚU]nica)?(?: de [A-ZÀ-Ú][\wÀ-ú]+(?: [\wÀ-ú]+){0,3})?|Juizado Especial(?: C[íi]vel| Criminal| Federal)?(?: de [A-ZÀ-Ú][\wÀ-ú]+)?|\d{1,2}[ªa] Turma(?: Recursal)?|\d{1,2}[ªa] C[âa]mara(?: C[íi]vel| Criminal| de Direito \w+)?|Se[çc][ãa]o (?:Especializada|de Diss[íi]dios)[\wÀ-ú ]{0,30}|Tribunal Pleno|[ÓO]rg[ãa]o Especial)/g, segs, 5);
  const comarca = findAll(/\bComarca de [A-ZÀ-Ú][\wÀ-ú]+(?:[ -][A-ZÀ-Ú\wÀ-ú]+){0,3}/g, segs, 3);

  const dates = [...findAll(PATTERNS.dateNumeric, segs, 60), ...findAll(PATTERNS.dateLong, segs, 60)];

  // Data do documento: fecho "Cidade, DD de mês de AAAA" (último no documento) ou "Data:" explícita.
  const closings = findAll(new RegExp(`[A-ZÀ-Ú][\\wÀ-ú ]{2,30}(?:\\s*[/-]\\s*[A-Z]{2})?,\\s*${PATTERNS.dateLong.source.replace(/^\\b/, '')}`, 'gi'), segs, 50);
  const explicitDate = findAll(/\bData(?: do documento| de emiss[ãa]o| da assinatura)?\s*:\s*\d{1,2}\/\d{1,2}\/\d{4}/gi, segs, 3);
  const opening = findAll(new RegExp(`\\b(?:Aos|Em|No dia)\\s+(?:${PATTERNS.dateNumeric.source.replace(/^\\b/, '')}|${PATTERNS.dateLong.source.replace(/^\\b/, '')})`, 'gi'), segs.slice(0, 30), 1);
  const documentDate = closings.length ? closings[closings.length - 1] : explicitDate[0] ?? opening[0];
  const publication = findAll(/(?:publicad[oa]|disponibilizad[oa]|data de publica[çc][ãa]o|DEJT|DJE?N?)[^\n.]{0,60}?\d{1,2}\/\d{1,2}\/\d{4}/gi, segs, 3);

  const statutes = [
    ...findAll(PATTERNS.article, segs, 80).map((e) => {
      const seg = segs.find((s) => s.text.includes(e.value));
      if (seg) {
        const idx = seg.text.indexOf(e.value);
        const tail = seg.text.slice(idx + e.value.length, idx + e.value.length + 70);
        const ref = /^\s*,?\s*(?:d[ao]s?|da referida)\s+((?:Lei(?: Complementar)?|Decreto(?:-Lei)?)\s+(?:n[º°o.]?\s*)?[\d.]+(?:\/\d{2,4})?|CLT|CPC|CF(?:\/88)?|CDC|CTN|CPP|CP|C[óo]digo (?:Civil|Penal|de Processo Civil|de Processo Penal|de Defesa do Consumidor|Tribut[áa]rio Nacional)|Constitui[çc][ãa]o(?: Federal| da Rep[úu]blica)?)/i.exec(tail);
        if (ref) return { value: `${e.value} ${tail.slice(0, ref.index + ref[0].length).trim()}`.replace(/\s+/g, ' '), page: e.page };
      }
      return e;
    }),
    ...findAll(PATTERNS.statuteRef, segs, 40),
  ];
  const caseLaw = [
    ...findAll(PATTERNS.sumula, segs, 30),
    ...findAll(PATTERNS.oj, segs, 30),
    ...findAll(PATTERNS.tema, segs, 30),
    ...findAll(PATTERNS.caseLaw, segs, 30),
  ];

  const monetaryValues = findSentences(PATTERNS.money, segs, 25).map((e) => e);
  const deadlines = findSentences(/\b(?:no )?prazo (?:de|m[áa]ximo de|legal de)\s+(?:\d{1,3}|[a-zç]+)\s*(?:\([a-zç ]+\)\s*)?(?:dias?|horas?|meses|anos)(?:\s+[úu]teis|\s+corridos)?|\bem at[ée]\s+\d{1,3}\s*(?:\([a-zç ]+\)\s*)?dias(?:\s+[úu]teis)?/gi, segs, 15);
  const obligations = findSentences(/\b(?:obriga-se|obrigam-se|compromete-se|comprometem-se|fica(?:m)? obrigad[oa]s?|dever[áã]o?\s+(?:pagar|entregar|efetuar|cumprir|restituir|indenizar|reintegrar|anotar|recolher)|condeno|condenar a reclamada a|condenar o r[ée]u a)\b/gi, segs, 15);

  const requests = sectionItems(blocks, /^(?:[IVX\d]+[.)\s\u2013-]*)?\s*D[OA]S?\s+(PEDIDOS?|REQUERIMENTOS?)\b|^PEDIDOS?$|^REQUERIMENTOS?$/i, 40);
  if (!requests.length) {
    requests.push(...findSentences(/\b(?:requer(?:-se)?|pede(?:-se)?|postula)\b(?: a| o| seja| sejam| que)/gi, segs, 10));
  }
  const legalGrounds = headingsUnder(blocks, /D[OA]S?\s+(?:DIREITO|FUNDAMENTOS?(?: JUR[ÍI]DICOS?)?)|FUNDAMENTA[ÇC][ÃA]O|DO M[ÉE]RITO|M[ÉE]RITO/i);

  const isDecision = cls.type === 'Sentença' || cls.type === 'Acórdão' || cls.type === 'Decisão interlocutória';
  const decisionResult = isDecision
    ? findSentences(/\b(?:julgo (?:totalmente |parcialmente )?(?:im)?procedentes?|julgo extint[oa]|extingo o processo|homologo|(?:dar|dou|deu|negar|nego|negou)(?:-lhe)? (?:parcial )?provimento|n[ãa]o conhe(?:[çc]o|cer)|acordam[^.]{0,80}|defiro|indefiro|concedo|denego)\b/gi, segs, 8)
    : [];
  const signatures = findAll(/\[Elemento visual: possível assinatura[^\]]*\]|assinado (?:digital|eletronica)mente[^\n.]{0,80}/gi, segs, 10);

  return {
    documentType: cls.type ?? 'Não identificado no documento.',
    typeConfidence: cls.confidence,
    typeEvidence: cls.evidence,
    classificationSource: 'regras',
    isLegal: cls.isLegal,
    processNumbers,
    tribunal,
    tribunalFromCnj: firstCnj ? `${firstCnj.tribunal} \u2014 ${firstCnj.segment}${firstCnj.checkDigitValid ? '' : ' (atenção: dígito verificador inválido)'}` : undefined,
    orgao,
    comarca,
    parties: extractParties(segs),
    lawyers: extractLawyers(segs),
    documentDate,
    publicationDate: publication[0],
    dates,
    requests,
    legalGrounds,
    statutes: dedupe(statutes).slice(0, 80),
    caseLaw: dedupe(caseLaw).slice(0, 60),
    monetaryValues,
    obligations,
    deadlines,
    decisionResult,
    signatures,
  };
}

function dedupe(list: Evidence[]): Evidence[] {
  const out: Evidence[] = [];
  const keys: string[] = [];
  for (const e of list) {
    const k = e.value.toLowerCase().replace(/\s+/g, ' ');
    // Remove itens contidos em outro mais completo (ex.: "art. 7º" dentro de "art. 7º da CF")
    if (keys.some((x) => x.includes(k))) continue;
    for (let i = keys.length - 1; i >= 0; i--) if (k.includes(keys[i])) { keys.splice(i, 1); out.splice(i, 1); }
    keys.push(k);
    out.push(e);
  }
  return out;
}
