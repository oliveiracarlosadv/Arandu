import { useRef, useState } from 'react';
import { ACCEPT } from '../utils/fileValidation';
import { Button, Icon, cx } from './ui';

const FORMATS = ['PDF', 'DOCX', 'ODT', 'RTF', 'TXT', 'PNG', 'JPG', 'WEBP', 'TIFF'];

export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); depth.current++; setOver(true); }}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      className={cx(
        'relative overflow-hidden rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-all sm:py-16',
        over
          ? 'scale-[1.005] border-brand-500 bg-brand-50/80 dark:border-brand-400 dark:bg-brand-500/10'
          : 'border-ink-300/80 bg-white hover:border-brand-400/70 dark:border-white/12 dark:bg-white/[0.02] dark:hover:border-brand-500/40',
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,176,124,0.10),transparent_60%)]" />
      <div className="relative">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20">
          <Icon name="upload" size={22} />
        </div>
        <p className="text-base font-semibold text-ink-950 dark:text-white">{over ? 'Solte para processar localmente' : 'Arraste documentos para cá'}</p>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Um ou vários arquivos. Nada é enviado para servidores.</p>
        <div className="mt-5">
          <Button variant="primary" onClick={() => input.current?.click()}>
            <Icon name="file" size={15} /> Selecionar documentos
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-1.5" aria-label="Formatos suportados">
          {FORMATS.map((f) => (
            <span key={f} className="rounded-md border border-ink-200 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-500 dark:border-white/10 dark:text-ink-400">{f}</span>
          ))}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
