import { useEffect, useMemo, useState } from 'react';
import type { Evidence, ProcessResult } from '../types';
import { getJobs, updateJobMarkdown, useJobs } from '../modules/batch/queue';
import { downloadJson, downloadMarkdown, downloadTxt } from '../modules/batch/exporters';
import { methodLabel } from '../modules/batch/pipeline';
import { listHistory } from '../services/history';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { Badge, Button, Icon, Modal, Segmented, Stat, cx } from '../components/ui';
import { navigate } from '../hooks/useAppState';
import { fmtBytes, fmtDateTime, fmtDuration, fmtInt } from '../utils/format';
import { addDocToCase, AREAS, listCases, saveCase, suggestedProcess, type LegalCase } from '../modules/workspace/workspace';
import { NOT_FOUND } from '../modules/legal/legalMarkdown';
import { processSummary } from '../modules/legal/extractor';

type Tab = 'preview' | 'edit' | 'compare' | 'legal';

function useResult(id?: string): ProcessResult | null | undefined {
  const jobs = useJobs();
  const [fromHistory, setFromHistory] = useState<ProcessResult | null | undefined>(undefined);
  const job = id && !id.startsWith('h:') ? jobs.find((j) => j.id === id) : undefined;
  useEffect(() => {
    if (id?.startsWith('h:')) listHistory().then((h) => setFromHistory(h.find((x) => x.id === id.slice(2))?.result ?? null));
  }, [id]);
  if (!id) return null;
  if (id.startsWith('h:')) return fromHistory;
  return job?.result ?? null;
}

function EvidenceList({ title, items, note }: { title: string; items: Evidence[]; note?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{title}</div>
      {note && <p className="mt-1 text-[11.5px] text-ink-500">{note}</p>}
      {items.length ? (
        <ul className="mt-2 space-y-1.5 text-[13px] text-ink-800 dark:text-ink-200">
          {items.slice(0, 40).map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-500" />
              <span>{e.value}{e.page && <span className="ml-1 text-[11px] text-ink-400">p. {e.page}</span>}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-ink-400">{NOT_FOUND}</p>
      )}
    </div>
  );
}

function LegalPanel({ r }: { r: ProcessResult }) {
  const a = r.legal;
  if (!a) return <p className="text-sm text-ink-500">A análise jurídica estava desativada neste processamento.</p>;
  const id: Evidence[] = [
    ...a.processNumbers,
    ...(a.tribunalFromCnj ? [{ value: `Decodificado do número CNJ: ${a.tribunalFromCnj}` }] : []),
  ];
  return (
    <div>
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
        Informações identificadas automaticamente, por extração literal com regras locais. Nada foi inventado: o que não aparece no documento consta como “{NOT_FOUND}”. Confira antes de usar.
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Tipo:</span> <Badge tone="brand">{a.documentType}</Badge>
        {a.typeConfidence > 0 && <span className="text-ink-500">confiança estimada {Math.round(a.typeConfidence * 100)}% · {a.classificationSource === 'regras+ia' ? 'regras + IA local' : 'regras'}</span>}
        {a.typeEvidence.length > 0 && <span className="text-[12px] text-ink-400">evidências: {a.typeEvidence.join(' · ')}</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <EvidenceList title="Número do processo" items={id} />
        <EvidenceList title="Tribunal / órgão julgador / comarca" items={[...a.tribunal, ...a.orgao, ...a.comarca]} />
        <EvidenceList title="Partes" items={a.parties.map((p) => ({ value: `${p.role}: ${p.name}`, page: p.page }))} />
        <EvidenceList title="Advogados (OAB)" items={a.lawyers.map((l) => ({ value: `${l.name ?? 'Nome não identificado'} — ${l.oab}`, page: l.page }))} />
        <EvidenceList title="Datas" items={[...(a.documentDate ? [{ ...a.documentDate, value: `Data do documento: ${a.documentDate.value}` }] : []), ...(a.publicationDate ? [{ ...a.publicationDate, value: `Publicação: ${a.publicationDate.value}` }] : []), ...a.dates.slice(0, 12)]} />
        <EvidenceList title="Valores" items={a.monetaryValues} />
        <EvidenceList title="Pedidos formulados" items={a.requests} note="Requerimentos da parte — não são decisão judicial." />
        <EvidenceList title="Fundamentos (títulos das seções)" items={a.legalGrounds} />
        <EvidenceList title="Dispositivos legais citados" items={a.statutes} />
        <EvidenceList title="Jurisprudência e precedentes citados" items={a.caseLaw} />
        <EvidenceList title="Obrigações" items={a.obligations} />
        <EvidenceList title="Prazos expressos" items={a.deadlines} />
        {/Senten|Acórd|Decisão/.test(a.documentType) && <EvidenceList title="Resultado da decisão" items={a.decisionResult} />}
        {a.signatures.length > 0 && <EvidenceList title="Elementos visuais de assinatura" items={a.signatures} note="Apenas indicados como elementos visuais; autoria não atribuída." />}
      </div>
    </div>
  );
}

function AddToWorkspace({ r, open, onClose }: { r: ProcessResult; open: boolean; onClose: () => void }) {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [caseId, setCaseId] = useState<string>('new');
  const proc = suggestedProcess(r);
  const [title, setTitle] = useState(proc ?? '');
  const [client, setClient] = useState('');
  const [area, setArea] = useState('');
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setDone(null);
    listCases().then((cs) => {
      setCases(cs);
      const match = proc && cs.find((c) => c.processNumber === proc);
      setCaseId(match ? match.id : cs[0] && !proc ? cs[0].id : 'new');
    });
  }, [open, proc]);
  const submit = async () => {
    let id = caseId;
    if (id === 'new') {
      const c = await saveCase({ title: title || r.fileName, processNumber: /^\d{7}-\d{2}\./.test(title) ? title : proc, client: client || undefined, area: area || undefined, tribunal: r.legal ? processSummary(r.legal)?.tribunal : undefined });
      id = c.id;
    }
    await addDocToCase(id, r);
    setDone(id);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar ao Workspace Jurídico"
      footer={done ? (
        <><Button onClick={onClose}>Fechar</Button><Button variant="primary" onClick={() => navigate(`/workspace/${done}`)}>Abrir processo</Button></>
      ) : (
        <><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={submit} disabled={caseId === 'new' && !title.trim()}>Adicionar</Button></>
      )}
    >
      {done ? (
        <p>Documento adicionado. Ele fica salvo apenas neste dispositivo (IndexedDB) até você removê-lo.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px]">O Markdown deste documento será salvo neste dispositivo para organização por processo. Você pode removê-lo a qualquer momento.</p>
          <label className="block">
            <span className="label">Processo / caso</span>
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-850">
              <option value="new">+ Novo processo</option>
              {cases.map((c) => <option key={c.id} value={c.id}>{c.processNumber ?? c.title}{c.client ? ` — ${c.client}` : ''}</option>)}
            </select>
          </label>
          {caseId === 'new' && (
            <>
              <label className="block"><span className="label">Número do processo ou título</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="0000000-00.0000.0.00.0000" className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-850" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="label">Cliente</span>
                  <input value={client} onChange={(e) => setClient(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-850" />
                </label>
                <label className="block"><span className="label">Área do Direito</span>
                  <select value={area} onChange={(e) => setArea(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-850">
                    <option value="">—</option>{AREAS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function ResultPage({ id }: { id?: string }) {
  const result = useResult(id);
  const [tab, setTab] = useState<Tab>('preview');
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);

  useEffect(() => { setDraft(null); }, [id]);
  const r = useMemo(() => (result && draft !== null ? { ...result, markdown: draft } : result), [result, draft]);

  if (result === undefined) return <p className="py-20 text-center text-sm text-ink-500">Carregando…</p>;
  if (!r) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-ink-500">Resultado não encontrado. Resultados ficam em memória até você fechar o app (ou no histórico, se autorizado).</p>
        <Button className="mt-4" variant="primary" onClick={() => navigate('/')}>Processar documento</Button>
      </div>
    );
  }
  const s = r.stats;
  const commitDraft = (v: string) => {
    setDraft(v);
    if (id && !id.startsWith('h:') && getJobs().some((j) => j.id === id)) updateJobMarkdown(id, v);
  };

  return (
    <div>
      <button type="button" onClick={() => navigate('/')} className="mb-4 text-[13px] text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">← Voltar</button>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink-950 dark:text-white">{r.fileName}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-500">
            <Badge tone="brand">{r.documentType}</Badge>
            <span>{fmtBytes(r.fileSize)}</span>·<span>{methodLabel(r.method)}</span>
          </div>
          <div className="mt-1 text-[12px] text-ink-500">
            {r.attachedAt && <>Anexado em {fmtDateTime(r.attachedAt)} · </>}Processado em {fmtDateTime(r.createdAt)}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="primary" onClick={() => downloadMarkdown(r)}><Icon name="download" size={14} /> Baixar Markdown</Button>
          <Button onClick={async () => { await navigator.clipboard.writeText(r.markdown); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            <Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copiado' : 'Copiar Markdown'}
          </Button>
          <Button onClick={() => downloadTxt(r)}>TXT</Button>
          <Button onClick={() => downloadJson(r)}>JSON estruturado</Button>
          <Button onClick={() => setWsOpen(true)}><Icon name="scale" size={14} /> Workspace</Button>
          <Button variant="ghost" onClick={() => navigate('/')}><Icon name="plus" size={14} /> Processar outro</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Páginas" value={r.pageCount} hint={r.ocrPageCount ? `${r.ocrPageCount} via OCR` : 'sem OCR'} />
        <Stat label="Tempo" value={fmtDuration(r.durationMs)} />
        <Stat label="Caracteres" value={fmtInt(s.finalChars)} hint={`original: ${fmtInt(s.originalChars)}`} />
        <Stat label="Tokens originais*" value={fmtInt(s.originalTokens)} />
        <Stat label="Tokens finais*" value={fmtInt(s.finalTokens)} />
        <Stat
          label="Redução estimada"
          accent={s.reductionCounted}
          value={s.reductionCounted ? `${s.reductionPct}%` : s.reductionPct <= 0 ? `${s.reductionPct}%` : '—'}
          hint={!r.integrity.ok ? 'não contabilizada (integridade)' : s.reductionPct <= 0 ? 'resultado inclui seções extras' : 'sem perda detectada'}
        />
      </div>
      <p className="mt-2 text-[11.5px] text-ink-400">
        * Estimativa com tokenizer {s.tokenizer}. A contagem real varia conforme o modelo de IA. Integridade: {r.integrity.checked} entidade(s) crítica(s) verificada(s){r.integrity.ok ? ', todas preservadas.' : `, ${r.integrity.missing.length} ausente(s).`}
      </p>

      {(r.warnings.length > 0 || !r.integrity.ok) && (
        <div className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {r.warnings.map((w, i) => <p key={i}>• {w}</p>)}
          {!r.integrity.ok && <p className="text-[12px]">Ausentes: {r.integrity.missing.slice(0, 8).map((m) => `${m.kind} “${m.value}”`).join('; ')}</p>}
        </div>
      )}

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented<Tab>
          ariaLabel="Visualização"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'preview', label: 'Pré-visualização' },
            { value: 'edit', label: 'Editar Markdown' },
            { value: 'compare', label: 'Comparar' },
            { value: 'legal', label: 'Análise jurídica' },
          ]}
        />
        {draft !== null && <Badge tone="info">Editado — downloads usam a versão editada</Badge>}
      </div>

      {tab === 'preview' && <div className="card px-5 py-6 sm:px-8"><MarkdownPreview markdown={r.markdown} /></div>}
      {tab === 'edit' && (
        <textarea
          value={r.markdown}
          onChange={(e) => commitDraft(e.target.value)}
          spellCheck={false}
          aria-label="Editor de Markdown"
          className="card h-[70vh] w-full resize-y p-4 font-mono text-[13px] leading-relaxed text-ink-900 outline-none focus:ring-2 focus:ring-brand-500 dark:text-ink-100"
        />
      )}
      {tab === 'compare' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {[
            { title: 'Texto extraído (bruto)', body: r.rawText, meta: `${fmtInt(s.originalChars)} caracteres · ${fmtInt(s.originalTokens)} tokens*` },
            { title: 'Resultado otimizado (Markdown)', body: r.markdown, meta: `${fmtInt(s.finalChars)} caracteres · ${fmtInt(s.finalTokens)} tokens*` },
          ].map((p) => (
            <div key={p.title} className="card flex min-w-0 flex-col">
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5 dark:border-white/[0.05]">
                <span className="text-[13px] font-medium">{p.title}</span>
                <span className="text-[11.5px] text-ink-500">{p.meta}</span>
              </div>
              <pre className={cx('scroll-thin h-[65vh] overflow-auto px-4 py-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-700 dark:text-ink-300')}>{p.body}</pre>
            </div>
          ))}
        </div>
      )}
      {tab === 'legal' && <LegalPanel r={r} />}
      <AddToWorkspace r={r} open={wsOpen} onClose={() => setWsOpen(false)} />
    </div>
  );
}
