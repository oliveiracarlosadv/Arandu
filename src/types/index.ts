// Tipos centrais do ARANDU.

export type SourceFormat = 'pdf' | 'docx' | 'txt' | 'rtf' | 'odt' | 'png' | 'jpg' | 'webp' | 'tiff';

/** Representação intermediária (IR) comum a todos os extratores. */
export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string; page?: number }
  | { kind: 'paragraph'; text: string; page?: number }
  | { kind: 'list'; ordered: boolean; items: string[]; page?: number }
  | { kind: 'table'; rows: string[][]; page?: number }
  | { kind: 'quote'; text: string; page?: number }
  | { kind: 'footnote'; text: string; page?: number }
  | { kind: 'visual'; description: string; page?: number }
  | { kind: 'pagebreak'; page: number };

export type ExtractionMethod = 'texto-nativo' | 'ocr' | 'hibrido' | 'estrutura-docx' | 'estrutura-odt' | 'rtf' | 'texto-simples';

export interface PageInfo {
  number: number;
  method: 'texto' | 'ocr' | 'vazia';
  ocrConfidence?: number;
  rotation?: number;
}

export interface ExtractedDocument {
  blocks: Block[];
  /** Texto bruto como extraído (antes de qualquer otimização) \u2014 base das métricas. */
  rawText: string;
  pages: PageInfo[];
  pageCount: number;
  method: ExtractionMethod;
  ocrPageCount: number;
  /** Cabeçalhos/rodapés repetidos detectados (texto normalizado). */
  repeatedMarginals: string[];
  warnings: string[];
  title?: string;
}

export type ConversionMode = 'fidelity' | 'ai' | 'summary' | 'legal';
export type OcrQuality = 'fast' | 'balanced' | 'high';
export type HardwareProfile = 'economy' | 'balanced' | 'high';

export interface ProcessOptions {
  mode: ConversionMode;
  ocrQuality: OcrQuality;
  legalAnalysis: boolean;
  includePageMarkers: boolean;
  useAi: boolean;
  maxFileSizeMb: number;
}

export interface TokenStats {
  originalChars: number;
  finalChars: number;
  originalTokens: number;
  finalTokens: number;
  reductionPct: number;
  /** false quando a validação de integridade detectou perda \u2014 redução não contabilizada. */
  reductionCounted: boolean;
  tokenizer: string;
}

export interface IntegrityReport {
  ok: boolean;
  checked: number;
  missing: { kind: string; value: string }[];
}

export interface Evidence {
  value: string;
  page?: number;
}

export interface LegalParty {
  role: string;
  name: string;
  page?: number;
}

export interface LegalLawyer {
  name?: string;
  oab: string;
  page?: number;
}

export interface LegalAnalysis {
  documentType: string;
  typeConfidence: number;
  typeEvidence: string[];
  classificationSource: 'regras' | 'regras+ia';
  isLegal: boolean;
  processNumbers: Evidence[];
  tribunal: Evidence[];
  tribunalFromCnj?: string;
  orgao: Evidence[];
  comarca: Evidence[];
  parties: LegalParty[];
  lawyers: LegalLawyer[];
  documentDate?: Evidence;
  publicationDate?: Evidence;
  dates: Evidence[];
  requests: Evidence[];
  legalGrounds: Evidence[];
  statutes: Evidence[];
  caseLaw: Evidence[];
  monetaryValues: Evidence[];
  obligations: Evidence[];
  deadlines: Evidence[];
  decisionResult: Evidence[];
  signatures: Evidence[];
}

export interface SummaryResult {
  text: string;
  method: 'ia-local' | 'extrativo';
  model?: string;
  /** Observação exibida ao usuário (ex.: saída da IA descartada pela trava de qualidade). */
  note?: string;
}

export interface ProcessResult {
  id: string;
  fileName: string;
  fileSize: number;
  format: SourceFormat;
  /** Data/hora em que o processamento terminou. */
  createdAt: number;
  /** Data/hora em que o arquivo foi anexado (entrou na fila). */
  attachedAt?: number;
  mode: ConversionMode;
  markdown: string;
  rawText: string;
  documentType: string;
  pageCount: number;
  ocrPageCount: number;
  method: ExtractionMethod;
  durationMs: number;
  stats: TokenStats;
  integrity: IntegrityReport;
  legal?: LegalAnalysis;
  summary?: SummaryResult;
  warnings: string[];
}

export const STEP_LABELS = [
  'Recebendo arquivo',
  'Identificando formato',
  'Analisando estrutura',
  'Extraindo conteúdo',
  'Executando OCR',
  'Aplicando processamento inteligente',
  'Otimizando Markdown',
  'Calculando economia estimada',
  'Finalizando documento',
] as const;

export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

export interface StepState {
  status: StepStatus;
  detail?: string;
  /** 0..1 quando há progresso mensurável. */
  progress?: number;
}

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface Job {
  id: string;
  file: File;
  status: JobStatus;
  steps: StepState[];
  result?: ProcessResult;
  error?: string;
  /** Data/hora em que o arquivo foi anexado. */
  addedAt: number;
  startedAt?: number;
  /** Data/hora em que o processamento terminou (com sucesso, erro ou cancelamento). */
  finishedAt?: number;
}

export type ProgressFn = (step: number, state: StepState) => void;
