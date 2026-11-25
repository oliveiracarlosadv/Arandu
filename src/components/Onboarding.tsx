// Apresentação de primeiro acesso: (1) o que é o ARANDU; (2) como instalá-lo como web app.
// Exibida somente no primeiro acesso — ou de novo se os dados do navegador forem apagados
// (a marcação fica no localStorage).

import { useEffect, useState, useSyncExternalStore } from 'react';
import { LogoMark } from './Logo';
import { Button, Icon, cx } from './ui';
import { promptInstall, usePwa } from '../services/pwa';

const KEY = 'arandu.onboarding.v1';
const subs = new Set<() => void>();

export function resetOnboarding() {
  localStorage.removeItem(KEY);
  subs.forEach((s) => s());
}
function finish() {
  localStorage.setItem(KEY, String(Date.now()));
  subs.forEach((s) => s());
}
const useDone = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => !!localStorage.getItem(KEY));

type Platform = 'ios' | 'android' | 'mac-safari' | 'desktop-chromium' | 'firefox' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'mac-safari';
  if (/Chrome|Chromium|Edg\//.test(ua)) return 'desktop-chromium';
  return 'other';
}

const GUIDES: Record<Platform, { title: string; steps: string[] }> = {
  ios: {
    title: 'iPhone e iPad (Safari)',
    steps: ['Toque no botão Compartilhar (quadrado com seta para cima).', 'Role e escolha “Adicionar à Tela de Início”.', 'Confirme em “Adicionar”. O ARANDU aparecerá como um app.'],
  },
  android: {
    title: 'Android (Chrome)',
    steps: ['Toque no menu ⋮ no canto superior direito.', 'Escolha “Instalar app” (ou “Adicionar à tela inicial”).', 'Confirme. O ARANDU abrirá em janela própria, como um app.'],
  },
  'mac-safari': {
    title: 'Mac (Safari)',
    steps: ['No menu Arquivo, escolha “Adicionar ao Dock…”.', 'Confirme o nome “ARANDU” e clique em “Adicionar”.', 'Abra o ARANDU pelo Dock ou pelo Launchpad.'],
  },
  'desktop-chromium': {
    title: 'Windows, Mac ou Linux (Chrome / Edge)',
    steps: ['Clique no ícone de instalação na barra de endereço (monitor com seta) ou no menu ⋮.', 'Escolha “Instalar ARANDU”.', 'O app ganha atalho no menu Iniciar, Dock ou área de trabalho.'],
  },
  firefox: {
    title: 'Firefox',
    steps: ['O Firefox para computador não instala web apps.', 'Use pelo navegador normalmente, ou abra no Chrome, Edge ou Safari para instalar.', 'No Android, o Firefox oferece “Instalar” no menu ⋮.'],
  },
  other: {
    title: 'Seu navegador',
    steps: ['Procure no menu do navegador a opção “Instalar app” ou “Adicionar à tela inicial”.', 'Confirme a instalação.', 'Abra o ARANDU pelo ícone criado.'],
  },
};

const FEATURES: { icon: string; title: string; text: string }[] = [
  { icon: 'file', title: 'Qualquer documento → Markdown', text: 'PDF (inclusive digitalizado), DOCX, ODT, RTF, TXT e imagens viram Markdown limpo e estruturado.' },
  { icon: 'sparkle', title: 'Menos tokens, mesma informação', text: 'Remove ruído de formatação sem perder números de processo, datas, valores e referências legais.' },
  { icon: 'scale', title: 'Inteligência jurídica', text: 'Identifica o tipo de peça e extrai partes, pedidos, prazos e dispositivos, sem inventar nada.' },
  { icon: 'shield', title: '100% no seu dispositivo', text: 'Nada é enviado a servidores. Funciona offline depois de instalado.' },
];

export function Onboarding() {
  const done = useDone();
  const [step, setStep] = useState(0);
  const pwa = usePwa();
  const [platform] = useState(detectPlatform);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { if (!done) setStep(0); }, [done]);
  // Já instalado e aberto como app: só a apresentação é necessária.
  if (done) return null;

  const guide = GUIDES[platform];
  const others = (Object.keys(GUIDES) as Platform[]).filter((p) => p !== platform && p !== 'other');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="scroll-thin relative max-h-full w-full max-w-2xl overflow-auto rounded-3xl bg-white shadow-2xl dark:bg-ink-900">
        {step === 0 ? (
          <>
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-7 pt-10 pb-9 text-white sm:px-10">
              <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
              <LogoMark size={72} className="relative rounded-[22px] shadow-xl ring-1 ring-white/20" />
              <h1 id="onb-title" className="relative mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Bem-vindo ao ARANDU</h1>
              <p className="relative mt-2 text-[15px] text-brand-100">Seus documentos. Menos tokens. Mais inteligência.</p>
              <p className="relative mt-4 max-w-lg text-[14px] leading-relaxed text-brand-50/90">
                <em>Arandu</em> significa conhecimento e sabedoria. Este app prepara seus documentos para serem lidos por inteligências artificiais (ChatGPT, Claude, Gemini e outras) de forma organizada, econômica e privada.
              </p>
            </div>
            <div className="grid gap-3 px-7 py-7 sm:grid-cols-2 sm:px-10">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><Icon name={f.icon} size={17} /></span>
                  <span>
                    <span className="block text-[14px] font-semibold text-ink-950 dark:text-white">{f.title}</span>
                    <span className="block text-[13px] leading-snug text-ink-500 dark:text-ink-400">{f.text}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-ink-100 px-7 py-5 sm:px-10 dark:border-white/[0.06]">
              <p className="mb-4 text-[13px] text-ink-500 dark:text-ink-400">
                <strong className="text-ink-700 dark:text-ink-200">Como usar:</strong> escolha o modo de conversão, arraste seus arquivos e baixe o Markdown. Para PDFs digitalizados e imagens, o app pede autorização uma única vez para preparar o OCR.
              </p>
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="text-[13px] text-ink-500 hover:text-ink-800 dark:hover:text-ink-200" onClick={finish}>Pular apresentação</button>
                <Button variant="primary" onClick={() => setStep(1)}>Próximo: instalar o app →</Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-7 pt-8 sm:px-10">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><Icon name="download" size={20} /></span>
                <div>
                  <h1 id="onb-title" className="text-xl font-semibold tracking-tight text-ink-950 dark:text-white">Instale o ARANDU como aplicativo</h1>
                  <p className="text-[13px] text-ink-500 dark:text-ink-400">Ícone próprio, janela dedicada e uso offline. Gratuito e sem loja de apps.</p>
                </div>
              </div>

              {pwa.installed ? (
                <p className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-[14px] text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">✓ O ARANDU já está instalado e aberto como aplicativo.</p>
              ) : (
                <>
                  {pwa.canInstall && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/10">
                      <span className="text-[14px] font-medium text-brand-900 dark:text-brand-100">Seu navegador permite instalar com um clique.</span>
                      <Button variant="primary" onClick={async () => { if (await promptInstall()) finish(); }}><Icon name="download" size={14} /> Instalar agora</Button>
                    </div>
                  )}
                  <div className="mt-5 rounded-2xl border border-ink-200 p-5 dark:border-white/[0.08]">
                    <div className="label">Detectado: {guide.title}</div>
                    <ol className="mt-3 space-y-2.5">
                      {guide.steps.map((s, i) => (
                        <li key={i} className="flex gap-3 text-[14px] text-ink-800 dark:text-ink-200">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[12px] font-semibold text-white dark:bg-brand-500 dark:text-brand-950">{i + 1}</span>
                          <span className="pt-0.5">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <button type="button" className="mt-3 text-[13px] text-brand-700 underline-offset-2 hover:underline dark:text-brand-300" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Ocultar outras plataformas' : 'Ver instruções para outras plataformas'}
                  </button>
                  {showAll && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {others.map((p) => (
                        <div key={p} className="rounded-xl bg-ink-50 p-4 dark:bg-white/[0.03]">
                          <div className="text-[13px] font-semibold text-ink-900 dark:text-ink-100">{GUIDES[p].title}</div>
                          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12.5px] text-ink-600 dark:text-ink-300">
                            {GUIDES[p].steps.map((s, i) => <li key={i}>{s}</li>)}
                          </ol>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={cx('mt-7 flex items-center justify-between gap-2 border-t border-ink-100 px-7 py-5 sm:px-10 dark:border-white/[0.06]')}>
              <button type="button" className="text-[13px] text-ink-500 hover:text-ink-800 dark:hover:text-ink-200" onClick={() => setStep(0)}>← Voltar</button>
              <Button variant="primary" onClick={finish}>Começar a usar</Button>
            </div>
          </>
        )}
        <div className="absolute top-3 right-3 flex gap-1.5" aria-hidden="true">
          {[0, 1].map((i) => {
            const active = step === i;
            const color = step === 0 ? (active ? 'bg-white/90' : 'bg-white/40') : active ? 'bg-brand-600' : 'bg-ink-300 dark:bg-white/20';
            return <span key={i} className={cx('h-1.5 rounded-full transition-all', active ? 'w-5' : 'w-1.5', color)} />;
          })}
        </div>
      </div>
    </div>
  );
}
