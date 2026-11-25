// Workspace Jurídico: organiza documentos convertidos por processo/cliente/área/tipo/data/tribunal.
// Os documentos só são gravados no dispositivo quando o usuário os adiciona explicitamente.

import JSZip from 'jszip';
import type { ProcessResult } from '../../types';
import { db } from '../../services/db';
import { downloadBlob, outputName, uid } from '../../utils/format';
import { parseDate } from '../legal/extractor';
import { PATTERNS } from '../legal/patterns';

export interface LegalCase {
  id: string;
  title: string; // ex.: número do processo ou nome do caso
  processNumber?: string;
  client?: string;
  area?: string; // Área do Direito
  tribunal?: string;
  createdAt: number;
  notes?: string;
}

export interface WorkspaceDoc {
  id: string;
  caseId: string;
  addedAt: number;
  displayName: string;
  documentType: string;
  documentDate?: string;
  documentDateTs?: number;
  tribunal?: string;
  result: ProcessResult;
}

export const AREAS = ['Trabalhista', 'Cível', 'Previdenciário', 'Tributário', 'Criminal', 'Família', 'Consumidor', 'Administrativo', 'Empresarial', 'Outra'];

export async function listCases(): Promise<LegalCase[]> {
  return (await db.all<LegalCase>('cases')).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveCase(c: Omit<LegalCase, 'id' | 'createdAt'> & Partial<Pick<LegalCase, 'id' | 'createdAt'>>): Promise<LegalCase> {
  const full: LegalCase = { id: c.id ?? uid(), createdAt: c.createdAt ?? Date.now(), ...c } as LegalCase;
  await db.put('cases', full);
  return full;
}

export async function deleteCase(id: string) {
  for (const d of await listDocs(id)) await db.delete('workspace', d.id);
  await db.delete('cases', id);
}

export async function listDocs(caseId?: string): Promise<WorkspaceDoc[]> {
  const all = await db.all<WorkspaceDoc>('workspace');
  return (caseId ? all.filter((d) => d.caseId === caseId) : all).sort((a, b) => (a.documentDateTs ?? a.addedAt) - (b.documentDateTs ?? b.addedAt));
}

export async function addDocToCase(caseId: string, result: ProcessResult): Promise<WorkspaceDoc> {
  const dd = result.legal?.documentDate?.value;
  const ts = dd ? parseDate(dd) ?? undefined : undefined;
  const doc: WorkspaceDoc = {
    id: uid(),
    caseId,
    addedAt: Date.now(),
    displayName: result.legal?.isLegal && result.legal.documentType !== 'Não identificado no documento.' ? result.legal.documentType : result.fileName.replace(/\.[^.]+$/, ''),
    documentType: result.documentType,
    documentDate: dd,
    documentDateTs: ts,
    tribunal: result.legal?.tribunal[0]?.value ?? result.legal?.tribunalFromCnj,
    result,
  };
  await db.put('workspace', doc);
  return doc;
}

export const removeDoc = (id: string) => db.delete('workspace', id);
export const updateDoc = (d: WorkspaceDoc) => db.put('workspace', d);

/** Sugere processo a partir do número CNJ encontrado no documento. */
export function suggestedProcess(r: ProcessResult): string | undefined {
  return r.legal?.processNumbers[0]?.value;
}

// ---------- Exportação ----------

function fileNames(docs: WorkspaceDoc[]): string[] {
  const used = new Map<string, number>();
  return docs.map((d, i) => {
    const base = outputName(`${String(i + 1).padStart(2, '0')} - ${d.displayName}`, 'md');
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? base.replace(/\.md$/, ` (${n + 1}).md`) : base;
  });
}

export function caseIndexMarkdown(c: LegalCase, docs: WorkspaceDoc[], names: string[]): string {
  const L = [
    `# ${c.processNumber ? `PROCESSO ${c.processNumber}` : c.title}`,
    '',
    [c.client && `- Cliente: ${c.client}`, c.area && `- Área do Direito: ${c.area}`, c.tribunal && `- Tribunal: ${c.tribunal}`, `- Documentos: ${docs.length}`].filter(Boolean).join('\n'),
    '',
    '## Documentos',
    '',
    '| # | Documento | Tipo | Data do documento | Arquivo original |',
    '|---|---|---|---|---|',
    ...docs.map((d, i) => `| ${i + 1} | [${d.displayName}](./${encodeURI(names[i])}) | ${d.documentType} | ${d.documentDate ?? 'Não identificado no documento.'} | ${d.result.fileName.replace(/\|/g, '\\|')} |`),
    '',
    '> Cada documento está em arquivo próprio. O conteúdo de documentos diferentes não foi misturado.',
  ];
  return L.join('\n') + '\n';
}

interface ChronoEvent {
  ts: number;
  date: string;
  text: string;
  file: string;
  page?: number;
}

/**
 * Cronologia do processo baseada EXCLUSIVAMENTE nos documentos fornecidos:
 * (a) data de cada documento; (b) frases que contêm datas explícitas. Cada evento cita arquivo e página.
 * Nenhum fato é inferido; as frases são literais.
 */
export function buildChronology(docs: WorkspaceDoc[], names: string[]): string {
  const events: ChronoEvent[] = [];
  docs.forEach((d, i) => {
    const file = names[i];
    if (d.documentDateTs && d.documentDate) {
      events.push({ ts: d.documentDateTs, date: d.documentDate, text: `**${d.displayName}** (data do documento)`, file, page: d.result.legal?.documentDate?.page });
    }
    // Frases com datas explícitas no texto extraído (máx. 25 por documento)
    const text = d.result.rawText;
    const re = new RegExp(`${PATTERNS.dateNumeric.source}|${PATTERNS.dateLong.source}`, 'gi');
    let count = 0;
    const seen = new Set<string>();
    for (const m of text.matchAll(re)) {
      if (count >= 25) break;
      const ts = parseDate(m[0]);
      if (ts === null) continue;
      const idx = m.index ?? 0;
      const start = Math.max(0, text.lastIndexOf('.', idx) + 1, text.lastIndexOf('\n', idx) + 1);
      const endRel = text.slice(idx).search(/[.\n]/);
      let sent = text.slice(start, endRel === -1 ? text.length : idx + endRel + 1).replace(/\s+/g, ' ').trim();
      if (sent.length > 260) sent = sent.slice(0, 260).replace(/\s+\S*$/, '') + ' […]';
      if (sent.length < 15 || seen.has(sent)) continue;
      seen.add(sent);
      const page = pageOf(d.result, sent);
      events.push({ ts, date: m[0], text: `"${sent}"`, file, page });
      count++;
    }
  });
  events.sort((a, b) => a.ts - b.ts);
  const L = [
    '# Resumo cronológico',
    '',
    '> Gerado exclusivamente a partir dos documentos fornecidos. Cada item cita o arquivo de origem e, quando possível, a página. As frases entre aspas são transcrições literais; nenhuma informação foi inferida.',
    '',
  ];
  if (!events.length) L.push('Não foram identificadas datas nos documentos.');
  for (const e of events) {
    const d = new Date(e.ts);
    const label = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    L.push(`- **${label}** — ${e.text} — fonte: [${e.file}](./${encodeURI(e.file)})${e.page ? `, p. ${e.page}` : ''}`);
  }
  return L.join('\n') + '\n';
}

function pageOf(r: ProcessResult, sentence: string): number | undefined {
  // Página a partir dos marcadores no Markdown (quando presentes)
  const probe = sentence.slice(0, 40).replace(/^"/, '');
  const idx = r.markdown.indexOf(probe);
  if (idx < 0) return undefined;
  const before = r.markdown.slice(0, idx);
  const m = [...before.matchAll(/<!-- página (\d+) -->/g)].pop();
  return m ? Number(m[1]) : undefined;
}

export async function exportCaseZip(c: LegalCase, docs: WorkspaceDoc[]) {
  const zip = new JSZip();
  const names = fileNames(docs);
  docs.forEach((d, i) => zip.file(names[i], d.result.markdown));
  zip.file('INDICE.md', caseIndexMarkdown(c, docs, names));
  zip.file('CRONOLOGIA.md', buildChronology(docs, names));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, outputName(c.processNumber ?? c.title, 'zip'));
}

