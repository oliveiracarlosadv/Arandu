import { useState } from 'react';
import { STEP_LABELS, type Job } from '../types';
import { cancelJob, clearFinished, removeJob, retryJob, stopAll, useJobs } from '../modules/batch/queue';
import { downloadMarkdown, downloadZip } from '../modules/batch/exporters';
import { navigate } from '../hooks/useAppState';
import { fmtBytes, fmtDateTime, fmtDuration, fmtInt } from '../utils/format';
import { Badge, Button, Icon, ProgressBar, cx } from './ui';

function jobProgress(j: Job): number {
  const weights = [0.03, 0.02, 0.15, 0.15, 0.35, 0.15, 0.08, 0.05, 0.02];
  let p = 0;
  j.steps.forEach((s, i) => {
    if (s.status === 'done' || s.status === 'skipped') p += weights[i];
    else if (s.status === 'running') p += weights[i] * (s.progress ?? 0.3);
  });
  return Math.min(1, p);
}

function StepIcon({ status }: { status: Job['steps'][number]['status'] }) {
  if (status === 'done') return <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white dark:bg-brand-500 dark:text-brand-950"><Icon name="check" size={11} /></span>;
  if (status === 'running') return <span className="h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />;
  if (status === 'error') return <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"><Icon name="x" size={10} /></span>;
  if (status === 'skipped') return <span className="h-4 w-4 rounded-full border border-dashed border-ink-300 dark:border-white/20" />;
  return <span className="h-4 w-4 rounded-full border border-ink-300 dark:border-white/15" />;
}

function JobCard({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);
  const running = job.status === 'running';
  const showSteps = running || expanded;
  const r = job.result;
  const currentStep = job.steps.findIndex((s) => s.status === 'running');

  return (
    <li className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600 dark:bg-white/[0.06] dark:text-ink-300">
          <Icon name="file" size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-ink-950 dark:text-white" title={job.file.name}>{job.file.name}</span>
            {job.status === 'done' && r && <Badge tone="brand">{r.documentType}</Badge>}
            {job.status === 'queued' && <Badge>Na fila</Badge>}
            {job.status === 'error' && <Badge tone="error">Falhou</Badge>}
            {job.status === 'cancelled' && <Badge tone="warn">Cancelado</Badge>}
          </div>
          <div className="mt-0.5 text-[12px] text-ink-500 dark:text-ink-400">
            {fmtBytes(job.file.size)}
            {running && currentStep >= 0 && <> · {STEP_LABELS[currentStep]}{job.steps[currentStep].detail ? ` — ${job.steps[currentStep].detail}` : ''}</>}
            {r && <> · {r.pageCount} p. · {fmtDuration(r.durationMs)} · {fmtInt(r.stats.originalTokens)} → {fmtInt(r.stats.finalTokens)} tokens{r.stats.reductionCounted && <span className="font-medium text-brand-700 dark:text-brand-300"> (−{r.stats.reductionPct}%)</span>}</>}
            {job.error && <span className="text-red-600 dark:text-red-400"> · {job.error}</span>}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-400 dark:text-ink-500">
            Anexado em {fmtDateTime(job.addedAt)}
            {job.finishedAt && <> · {job.status === 'done' ? 'Processado' : job.status === 'cancelled' ? 'Cancelado' : 'Falhou'} em {fmtDateTime(job.finishedAt)}</>}
            {job.status === 'running' && job.startedAt && <> · Processando desde {fmtDateTime(job.startedAt)}</>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {r && (
            <>
              <Button size="sm" variant="primary" onClick={() => navigate(`/resultado/${job.id}`)}><Icon name="eye" size={14} /> Abrir</Button>
              <Button size="sm" onClick={() => downloadMarkdown(r)} aria-label={`Baixar Markdown de ${job.file.name}`}><Icon name="download" size={14} /> .md</Button>
            </>
          )}
          {(running || job.status === 'queued') && <Button size="sm" variant="ghost" onClick={() => cancelJob(job.id)}><Icon name="stop" size={13} /> Cancelar</Button>}
          {(job.status === 'error' || job.status === 'cancelled') && <Button size="sm" onClick={() => retryJob(job.id)}><Icon name="retry" size={14} /> Tentar de novo</Button>}
          {!running && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="rounded-md px-2 py-1 text-[12px] text-ink-500 hover:bg-ink-100 dark:hover:bg-white/[0.06]">
              {expanded ? 'Ocultar etapas' : 'Etapas'}
            </button>
          )}
          {!running && <button type="button" onClick={() => removeJob(job.id)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-white/[0.06]" aria-label="Remover da lista"><Icon name="x" size={14} /></button>}
        </div>
      </div>
      {running && <ProgressBar value={jobProgress(job)} className="rounded-none" />}
      {showSteps && (
        <ol className="grid gap-x-6 gap-y-1.5 border-t border-ink-100 px-4 py-3 sm:grid-cols-2 dark:border-white/[0.05]">
          {STEP_LABELS.map((label, i) => {
            const s = job.steps[i];
            return (
              <li key={label} className={cx('flex items-start gap-2 text-[12.5px]', s.status === 'pending' ? 'text-ink-400 dark:text-ink-500' : 'text-ink-700 dark:text-ink-300')}>
                <span className="mt-0.5"><StepIcon status={s.status} /></span>
                <span className="min-w-0">
                  <span className={cx(s.status === 'running' && 'font-medium text-ink-950 dark:text-white')}>{i + 1}. {label}</span>
                  {s.detail && <span className="block truncate text-[11.5px] text-ink-500 dark:text-ink-400">{s.status === 'skipped' ? 'Ignorada — ' : ''}{s.detail}</span>}
                  {s.status === 'running' && s.progress !== undefined && <ProgressBar value={s.progress} className="mt-1 h-1 w-40" />}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

/** Lista da fila. `onlyIds` restringe aos trabalhos enviados por uma tela (ex.: um processo do Workspace). */
export function JobList({ onlyIds }: { onlyIds?: Set<string> } = {}) {
  const all = useJobs();
  const jobs = onlyIds ? all.filter((j) => onlyIds.has(j.id)) : all;
  if (!jobs.length) return null;
  const done = jobs.filter((j) => j.status === 'done' && j.result);
  const active = jobs.some((j) => j.status === 'running' || j.status === 'queued');
  return (
    <section aria-label="Fila de processamento" className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-950 dark:text-white">
          Processamento <span className="font-normal text-ink-500">· {done.length}/{jobs.length} concluído(s)</span>
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {active && <Button size="sm" variant="danger" onClick={stopAll}><Icon name="stop" size={13} /> Interromper fila</Button>}
          {done.length > 1 && <Button size="sm" onClick={() => downloadZip(done.map((j) => j.result!))}><Icon name="zip" size={14} /> Baixar todos (ZIP + índice)</Button>}
          {!active && <Button size="sm" variant="ghost" onClick={clearFinished}>Limpar lista</Button>}
        </div>
      </div>
      <ul className="space-y-2">
        {jobs.map((j) => <JobCard key={j.id} job={j} />)}
      </ul>
    </section>
  );
}
