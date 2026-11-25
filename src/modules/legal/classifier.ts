// Classificação determinística do tipo documental jurídico por evidências textuais ponderadas.
// Cada tipo tem padrões fortes (título/cabeçalho) e fracos (vocabulário típico).

export const LEGAL_TYPES = [
  'Petição inicial', 'Contestação', 'Réplica', 'Recurso', 'Sentença', 'Acórdão', 'Decisão interlocutória', 'Despacho',
  'Contrato', 'Procuração', 'Notificação extrajudicial', 'Convenção coletiva', 'Acordo trabalhista', 'Termo de rescisão',
  'Documento previdenciário', 'Laudo pericial', 'Ata de audiência', 'Certidão', 'Comprovante', 'Processo administrativo',
  'Documento societário', 'Documento fiscal',
] as const;

export type LegalType = (typeof LEGAL_TYPES)[number];

interface Rule {
  type: LegalType;
  strong: RegExp[]; // peso 6 se no início do documento, 3 no corpo
  weak: RegExp[]; // peso 1 cada (máx. 3 ocorrências)
}

const RULES: Rule[] = [
  { type: 'Petição inicial', strong: [/peti[çc][ãa]o inicial/i, /\ba[çc][ãa]o (?:trabalhista|ordin[áa]ria|declarat[óo]ria|indenizat[óo]ria|de cobran[çc]a|revisional|de indeniza[çc][ãa]o|de despejo|de alimentos|monit[óo]ria|anulat[óo]ria|civil p[úu]blica|popular|de obriga[çc][ãa]o de fazer|de usucapi[ãa]o|de div[óo]rcio|de repara[çc][ãa]o)\b/i, /reclama[çc][ãa]o trabalhista/i, /\bvem.{0,60}\b(?:propor|ajuizar)\b/i], weak: [/dos fatos/i, /dos pedidos/i, /requer a cita[çc][ãa]o/i, /d[áa]-se [àa] causa o valor/i, /em face de/i, /valor da causa/i] },
  { type: 'Contestação', strong: [/\bcontesta[çc][ãa]o\b/i, /vem.{0,60}apresentar\s+(sua\s+)?contesta[çc][ãa]o/i, /defesa\b.{0,40}reclamad[ao]/i], weak: [/preliminarmente/i, /impugna/i, /improced[êe]ncia/i, /no m[ée]rito/i, /prescri[çc][ãa]o/i] },
  { type: 'Réplica', strong: [/\br[ée]plica\b/i, /impugna[çc][ãa]o [àa] contesta[çc][ãa]o/i, /manifesta[çc][ãa]o sobre a (contesta[çc][ãa]o|defesa)/i], weak: [/contesta[çc][ãa]o apresentada/i, /reitera/i] },
  { type: 'Recurso', strong: [/recurso (ordin[áa]rio|de revista|especial|extraordin[áa]rio|inominado)/i, /\bapela[çc][ãa]o\b/i, /agravo (de instrumento|interno|de peti[çc][ãa]o|regimental)/i, /embargos (de declara[çc][ãa]o|[àa] execu[çc][ãa]o)/i, /raz[õo]es (recursais|de recurso)/i, /contrarraz[õo]es/i], weak: [/recorrente/i, /recorrid[oa]/i, /reforma da (r\.\s*)?(senten[çc]a|decis[ãa]o)/i, /tempestividade/i, /preparo/i] },
  { type: 'Sentença', strong: [/\bsenten[çc]a\b/i, /julgo (totalmente |parcialmente )?(im)?procedente/i, /resolvo o m[ée]rito/i], weak: [/relat[óo]rio/i, /fundamenta[çc][ãa]o/i, /dispositivo/i, /ante o exposto/i, /custas pel[oa]/i, /publique-se|p\.\s*r\.\s*i\./i] },
  { type: 'Acórdão', strong: [/\bac[óo]rd[ãa]o\b/i, /\bacordam\b/i, /\bementa\b/i], weak: [/relator(a)?/i, /turma/i, /c[âa]mara/i, /por unanimidade/i, /dar provimento|negar provimento/i, /votos?/i] },
  { type: 'Decisão interlocutória', strong: [/decis[ãa]o interlocut[óo]ria/i, /tutela (de urg[êe]ncia|antecipada|provis[óo]ria)/i, /\b(defiro|indefiro)\b/i], weak: [/liminar/i, /intime-se/i, /decido/i] },
  { type: 'Despacho', strong: [/\bdespacho\b/i, /\bvistos\b/i, /conclusos/i], weak: [/intime(m)?-se/i, /cumpra-se/i, /vista [àa]s partes/i, /prazo de \d+ dias/i] },
  { type: 'Contrato', strong: [/\bcontrato de\b/i, /instrumento particular/i, /cl[áa]usula (primeira|1[ªa])/i, /contratante/i], weak: [/contratad[ao]/i, /cl[áa]usula/i, /foro/i, /rescis[ãa]o/i, /vig[êe]ncia/i, /obriga-se/i] },
  { type: 'Procuração', strong: [/\bprocura[çc][ãa]o\b/i, /outorgante/i, /poderes (para o foro em geral|da cl[áa]usula ad judicia)/i, /ad judicia/i], weak: [/outorgad[oa]/i, /substabelecer/i, /poderes especiais/i] },
  { type: 'Notificação extrajudicial', strong: [/notifica[çc][ãa]o extrajudicial/i, /\bnotificante\b/i], weak: [/notificad[oa]/i, /prazo de \d+/i, /sob pena de/i] },
  { type: 'Convenção coletiva', strong: [/conven[çc][ãa]o coletiva/i, /acordo coletivo de trabalho/i], weak: [/sindicato/i, /categoria profissional/i, /data-base/i, /piso salarial/i] },
  { type: 'Acordo trabalhista', strong: [/acordo (trabalhista|judicial)/i, /termo de acordo/i, /homologa[çc][ãa]o (de|do) acordo/i, /concilia[çc][ãa]o/i], weak: [/parcelas?/i, /quita[çc][ãa]o/i, /reclamante/i] },
  { type: 'Termo de rescisão', strong: [/termo de rescis[ãa]o/i, /\btrct\b/i, /rescis[ãa]o do contrato de trabalho/i], weak: [/aviso pr[ée]vio/i, /verbas rescis[óo]rias/i, /fgts/i, /13[ºo°]? sal[áa]rio/i] },
  { type: 'Documento previdenciário', strong: [/\binss\b/i, /\bcnis\b/i, /benef[íi]cio previdenci[áa]rio/i, /aposentadoria/i, /aux[íi]lio(-|\s)(doen[çc]a|acidente)/i, /\bppp\b|perfil profissiogr[áa]fico/i], weak: [/segurad[oa]/i, /\bnb\b|n[úu]mero do benef[íi]cio/i, /car[êe]ncia/i, /contribui[çc][õo]es/i] },
  { type: 'Laudo pericial', strong: [/laudo (pericial|t[ée]cnico|m[ée]dico)/i, /\bperito\b/i, /\bper[íi]cia\b/i], weak: [/quesitos/i, /metodologia/i, /conclus[ãa]o/i, /vistoria/i, /insalubridade|periculosidade/i] },
  { type: 'Ata de audiência', strong: [/ata de audi[êe]ncia/i, /termo de audi[êe]ncia/i, /aberta a audi[êe]ncia/i], weak: [/presentes/i, /preg[ãa]o/i, /depoimento/i, /encerrou-se/i] },
  { type: 'Certidão', strong: [/\bcertid[ãa]o\b/i, /\bcertifico\b/i], weak: [/dou f[ée]/i, /para os devidos fins/i] },
  { type: 'Comprovante', strong: [/\bcomprovante\b/i, /\brecibo\b/i, /\bguia (de|da)\b/i, /\bgru\b|\bdarf\b|\bgps\b/i], weak: [/pagamento/i, /autentica[çc][ãa]o/i, /valor pago/i] },
  { type: 'Processo administrativo', strong: [/processo administrativo/i, /\bpad\b/i, /sindic[âa]ncia/i, /auto de infra[çc][ãa]o/i], weak: [/administra[çc][ãa]o p[úu]blica/i, /servidor/i, /comiss[ãa]o processante/i] },
  { type: 'Documento societário', strong: [/contrato social/i, /altera[çc][ãa]o contratual/i, /ata de (assembleia|reuni[ãa]o)/i, /estatuto social/i], weak: [/s[óo]ci[oa]s?/i, /capital social/i, /quotas/i, /junta comercial/i] },
  { type: 'Documento fiscal', strong: [/nota fiscal/i, /\bnf-?e\b/i, /\bdanfe\b/i, /imposto de renda/i, /certid[ãa]o (negativa|positiva) de d[ée]bitos/i], weak: [/\bicms\b|\biss\b|\bipi\b/i, /tribut/i, /cfop/i, /base de c[áa]lculo/i] },
];

const JURIDICAL_MARKERS = /\b(processo|tribunal|vara|ju[íi]z|advogad|OAB|reclamante|reclamad|autor|r[ée]u|requerente|requerid|contrato|cl[áa]usula|lei|art\.)\b/gi;

export interface Classification {
  type: LegalType | null;
  confidence: number; // 0..1
  evidence: string[];
  isLegal: boolean;
  ranking: { type: LegalType; score: number }[];
}

export function classifyLegal(text: string): Classification {
  const head = text.slice(0, 1500);
  const body = text.slice(0, 60000);
  const ranking: { type: LegalType; score: number; ev: string[]; strong: number }[] = [];
  for (const r of RULES) {
    let score = 0;
    let strong = 0;
    const ev: string[] = [];
    for (const re of r.strong) {
      const mh = head.match(re);
      if (mh) { score += 6; strong++; ev.push(mh[0].trim().slice(0, 60)); continue; }
      const mb = body.match(re);
      if (mb) { score += 2.5; strong++; ev.push(mb[0].trim().slice(0, 60)); }
    }
    for (const re of r.weak) {
      const all = body.match(new RegExp(re.source, 'gi'));
      if (all) { score += Math.min(3, all.length); if (ev.length < 6) ev.push(all[0].trim().slice(0, 40)); }
    }
    // Sem nenhuma evidência forte, vocabulário genérico não basta para atribuir o tipo.
    ranking.push({ type: r.type, score: strong ? score : Math.min(score, 3), ev, strong });
  }
  ranking.sort((a, b) => b.score - a.score);
  const markers = new Set((body.match(JURIDICAL_MARKERS) ?? []).map((m) => m.toLowerCase())).size;
  const top = ranking[0];
  const second = ranking[1]?.score ?? 0;
  const isLegal = (markers >= 4 && top.strong > 0) || top.score >= 8;
  if (!isLegal || top.score < 4 || !top.strong) {
    return { type: null, confidence: 0, evidence: [], isLegal, ranking: ranking.slice(0, 5).map(({ type, score }) => ({ type, score })) };
  }
  // Confiança: margem sobre o 2º colocado e força absoluta
  const confidence = Math.max(0.2, Math.min(0.97, (top.score - second) / (top.score + 1) + Math.min(0.5, top.score / 30)));
  return {
    type: top.type,
    confidence: Math.round(confidence * 100) / 100,
    evidence: [...new Set(top.ev)].slice(0, 6),
    isLegal,
    ranking: ranking.slice(0, 5).map(({ type, score }) => ({ type, score })),
  };
}
