import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Icon, Modal, PageHeader } from '../components/ui';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { DropZone } from '../components/DropZone';
import { JobList } from '../components/JobList';
import { navigate } from '../hooks/useAppState';
import { useJobs } from '../modules/batch/queue';
import { chooseModeAndEnqueue } from '../components/ModeDialog';
import { downloadMarkdown } from '../modules/batch/exporters';
import {
  addDocToCase, AREAS, buildChronology, caseIndexMarkdown, deleteCase, docDateLabel, exportCaseZip, fileNames, listCases, listDocs, removeDoc, saveCase,
  type LegalCase, type WorkspaceDoc,
} from '../modules/workspace/workspace';
import { fmtDate } from '../utils/format';

const input = 'mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-850';

function CaseForm({ initial, onSave, onCancel }: { initial?: Partial<LegalCase>; onSave: (c: LegalCase) => void; onCancel: () => void }) {
  const [f, setF] = useState<Partial<LegalCase>>(initial ?? {});
  const set = (k: keyof LegalCase) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value || undefined }));
  return (
    <div className="space-y-3">
      <label className="block"><span className="label">Título ou número do processo *</span><input className={input} value={f.title ?? ''} onChange={set('title')} placeholder="Ex.: 0000000-00.2026.5.08.0000 ou Maria x Empresa" /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block"><span className="label">Número do processo (CNJ)</span><input className={input} value={f.processNumber ?? ''} onChange={set('processNumber')} /></label>
        <label className="block"><span className="label">Cliente</span><input className={input} value={f.client ?? ''} onChange={set('client')} /></label>
        <label className="block"><span className="label">Área do Direito</span>
          <select className={input} value={f.area ?? ''} onChange={set('area')}><option value="">—</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
        </label>
        <label className="block"><span className="label">Tribunal</span><input className={input} value={f.tribunal ?? ''} onChange={set('tribunal')} /></label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" disabled={!f.title?.trim()} onClick={async () => onSave(await saveCase({ ...f, title: f.title!.trim() } as LegalCase))}>Salvar</Button>
      </div>
    </div>
  );
}

function CaseList() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const load = useCallback(async () => {
    setCases(await listCases());
    const docs = await listDocs();
    setCounts(docs.reduce<Record<string, number>>((a, d) => ((a[d.caseId] = (a[d.caseId] ?? 0) + 1), a), {}));
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = cases.filter((c) => (!area || c.area === area) && (!q || [c.title, c.processNumber, c.client, c.tribunal].join(' ').toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <PageHeader
        title="Workspace Jurídico"
        subtitle="Organize os documentos convertidos por processo, cliente, área, tipo, data e tribunal. Tudo fica salvo apenas neste dispositivo."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Icon name="plus" size={14} /> Novo processo</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="h-9 min-w-56 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-ink-900" placeholder="Buscar por processo, cliente ou tribunal…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar processos" />
        <select className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-ink-900" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área">
          <option value="">Todas as áreas</option>{AREAS.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      {!filtered.length ? (
        <div className="card px-6 py-14 text-center">
          <Icon name="scale" size={28} className="mx-auto text-ink-300" />
          <p className="mt-3 text-sm text-ink-500">{cases.length ? 'Nenhum processo corresponde ao filtro.' : 'Nenhum processo ainda. Crie um ou use “Workspace” na tela de resultado de um documento.'}</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <button key={c.id} type="button" onClick={() => navigate(`/workspace/${c.id}`)} className="card p-4 text-left transition hover:border-brand-400/60">
              <div className="truncate font-mono text-[13px] font-medium text-ink-950 dark:text-white">{c.processNumber ?? c.title}</div>
              {c.processNumber && c.title !== c.processNumber && <div className="truncate text-[12.5px] text-ink-600 dark:text-ink-300">{c.title}</div>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.client && <Badge>{c.client}</Badge>}
                {c.area && <Badge tone="info">{c.area}</Badge>}
                <Badge tone="brand">{counts[c.id] ?? 0} doc(s)</Badge>
              </div>
              {c.tribunal && <div className="mt-2 truncate text-[11.5px] text-ink-500">{c.tribunal}</div>}
            </button>
          ))}
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Novo processo">
        <CaseForm onCancel={() => setCreating(false)} onSave={(c) => { setCreating(false); navigate(`/workspace/${c.id}`); }} />
      </Modal>
    </div>
  );
}

function CaseDetail({ caseId }: { caseId: string }) {
  const [c, setC] = useState<LegalCase | null | undefined>(undefined);
  const [docs, setDocs] = useState<WorkspaceDoc[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [view, setView] = useState<{ title: string; md: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const pending = useRef(new Set<string>());
  const [mine, setMine] = useState<Set<string>>(new Set()); // trabalhos enviados nesta página
  const jobs = useJobs();

  const load = useCallback(async () => {
    setC((await listCases()).find((x) => x.id === caseId) ?? null);
    setDocs(await listDocs(caseId));
  }, [caseId]);
  useEffect(() => { void load(); }, [load]);

  // Documentos enviados por esta página são adicionados ao processo ao terminar.
  useEffect(() => {
    for (const j of jobs) {
      if (pending.current.has(j.id) && j.status !== 'queued' && j.status !== 'running') {
        pending.current.delete(j.id);
        if (j.result) void addDocToCase(caseId, j.result).then(load);
      }
    }
  }, [jobs, caseId, load]);

  const names = useMemo(() => fileNames(docs), [docs]);
  if (c === undefined) return <p className="py-20 text-center text-sm text-ink-500">Carregando…</p>;
  if (!c) return <p className="py-20 text-center text-sm text-ink-500">Processo não encontrado. <a className="underline" href="#/workspace">Voltar</a></p>;
  const types = [...new Set(docs.map((d) => d.documentType))];
  const shown = docs.filter((d) => !typeFilter || d.documentType === typeFilter);

  return (
    <div>
      <button type="button" onClick={() => navigate('/workspace')} className="mb-4 text-[13px] text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">← Workspace</button>
      <PageHeader
        title={c.processNumber ? `PROCESSO ${c.processNumber}` : c.title}
        subtitle={[c.processNumber && c.title !== c.processNumber ? c.title : null, c.client, c.area, c.tribunal].filter(Boolean).join(' · ') || 'Sem metadados'}
        actions={
          <>
            <Button onClick={() => setEditing(true)}><Icon name="edit" size={14} /> Editar</Button>
            <Button onClick={() => setView({ title: 'Índice consolidado', md: caseIndexMarkdown(c, docs, names) })} disabled={!docs.length}>Índice</Button>
            <Button onClick={() => setView({ title: 'Resumo cronológico', md: buildChronology(docs, names) })} disabled={!docs.length}><Icon name="clock" size={14} /> Cronologia</Button>
            <Button variant="primary" onClick={() => exportCaseZip(c, docs)} disabled={!docs.length}><Icon name="zip" size={14} /> Exportar ZIP</Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="label">Tipo documental:</span>
        <button type="button" onClick={() => setTypeFilter('')} className={`rounded-md px-2 py-0.5 text-[12px] ${!typeFilter ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-500'}`}>Todos</button>
        {types.map((t) => <button key={t} type="button" onClick={() => setTypeFilter(t)} className={`rounded-md px-2 py-0.5 text-[12px] ${typeFilter === t ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-500'}`}>{t}</button>)}
      </div>
      <div className="card divide-y divide-ink-100 dark:divide-white/[0.05]">
        {!shown.length && <p className="px-4 py-8 text-center text-sm text-ink-500">Nenhum documento neste processo. Adicione abaixo.</p>}
        {shown.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
            <Icon name="file" size={15} className="text-ink-400" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-ink-950 dark:text-white">{d.displayName}</div>
              <div className="truncate text-[11.5px] text-ink-500">{d.result.fileName} · {d.documentDateTs !== undefined || d.documentDate ? docDateLabel(d) : 'data não identificada'}{d.tribunal ? ` · ${d.tribunal}` : ''}</div>
            </div>
            <Badge>{d.documentType}</Badge>
            <span className="text-[11.5px] text-ink-400">adicionado {fmtDate(d.addedAt)}</span>
            <Button size="sm" onClick={() => setView({ title: d.displayName, md: d.result.markdown })}><Icon name="eye" size={13} /> Ver</Button>
            <Button size="sm" onClick={() => downloadMarkdown(d.result)} aria-label="Baixar Markdown"><Icon name="download" size={13} /></Button>
            <button type="button" aria-label="Remover do processo" className="rounded p-1 text-ink-400 hover:text-red-600" onClick={async () => { if (confirm(`Remover “${d.displayName}” deste processo?`)) { await removeDoc(d.id); void load(); } }}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="label mb-2">Processar e adicionar documentos a este processo</div>
        <DropZone
          onFiles={async (files) => {
            const ids = await chooseModeAndEnqueue(files);
            ids.forEach((id) => pending.current.add(id));
            setMine((m) => new Set([...m, ...ids]));
          }}
        />
        <JobList onlyIds={mine} />
      </div>

      <div className="mt-10 flex justify-end">
        <Button variant="danger" size="sm" onClick={async () => { if (confirm('Excluir este processo e todos os seus documentos deste dispositivo? Esta ação não pode ser desfeita.')) { await deleteCase(c.id); navigate('/workspace'); } }}>
          <Icon name="trash" size={13} /> Excluir processo
        </Button>
      </div>

      <Modal open={!!view} onClose={() => setView(null)} title={view?.title ?? ''} footer={<Button onClick={() => setView(null)}>Fechar</Button>}>
        <div className="scroll-thin max-h-[65vh] overflow-auto pr-1"><MarkdownPreview markdown={(view?.md ?? '').replace(/^# .*\n+/, '')} /></div>
      </Modal>
      <Modal open={editing} onClose={() => setEditing(false)} title="Editar processo">
        <CaseForm initial={c} onCancel={() => setEditing(false)} onSave={() => { setEditing(false); void load(); }} />
      </Modal>
    </div>
  );
}

export default function WorkspacePage({ caseId }: { caseId?: string }) {
  return caseId ? <CaseDetail caseId={caseId} /> : <CaseList />;
}
