import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Icon, Modal, PageHeader, ProgressBar, Segmented } from '../components/ui';
import { refreshOcrStatus, useAiState, useHardware, useOcrStatus } from '../hooks/useAppState';
import { MODELS, ORT_RUNTIME_MB, type ModelSpec } from '../modules/ai/models';
import { chooseBackend, isModelCached, loadModel, modelCacheInfo, removeModel, unloadModel } from '../modules/ai/aiService';
import { PROFILE_LABEL } from '../modules/ai/hardware';
import { OCR_ASSETS, OCR_TOTAL_BYTES, prepareOcrAssets, removeOcrAssets } from '../modules/ocr/ocrAssets';
import { updateSettings, useSettings } from '../services/settings';
import { fmtBytes } from '../utils/format';
import type { HardwareProfile } from '../types';

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]">
      <span className="text-ink-500 dark:text-ink-400">{k}</span>
      <span className="text-right font-medium text-ink-900 dark:text-ink-100">{v}</span>
    </div>
  );
}

const yes = (b: boolean) => (b ? <span className="text-brand-700 dark:text-brand-300">Sim</span> : <span className="text-ink-400">Não</span>);

export default function ModelsPage() {
  const hw = useHardware();
  const ai = useAiState();
  const ocr = useOcrStatus();
  const s = useSettings();
  const [cache, setCache] = useState<Record<string, { installed: boolean; bytes: number }>>({});
  const [confirm, setConfirm] = useState<{ spec: ModelSpec; update?: boolean } | null>(null);
  const [ocrBusy, setOcrBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const backend = hw ? chooseBackend(hw.webgpu) : 'wasm';
  const profile: HardwareProfile = s.profile ?? hw?.recommendedProfile ?? 'balanced';

  const refresh = useCallback(async () => {
    const out: typeof cache = {};
    for (const m of MODELS) {
      const installed = await isModelCached(m.id);
      out[m.id] = { installed, bytes: installed ? (await modelCacheInfo(m.id)).bytes : 0 };
    }
    setCache(out);
  }, []);
  useEffect(() => { void refresh(); }, [refresh, ai.status]);

  const download = async (spec: ModelSpec, update = false) => {
    setConfirm(null);
    setErr(null);
    try {
      if (update) await removeModel(spec.id);
      await loadModel(spec, backend, hw?.webgpuF16 ?? false);
      updateSettings({ defaultModelId: spec.id, useAi: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    void refresh();
  };

  return (
    <div>
      <PageHeader title="Central de Modelos" subtitle="Recursos de IA e OCR executados no seu dispositivo. Nada é baixado sem a sua autorização." />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="card p-5" aria-label="Compatibilidade do dispositivo">
          <div className="label mb-2">Este dispositivo</div>
          {!hw ? <p className="text-sm text-ink-500">Detectando…</p> : (
            <div className="divide-y divide-ink-100 dark:divide-white/[0.05]">
              <Row k="WebAssembly" v={yes(hw.wasm)} />
              <Row k="WebAssembly SIMD" v={yes(hw.wasmSimd)} />
              <Row k="WebGPU" v={hw.webgpu ? <>Sim{hw.gpuDescription ? ` · ${hw.gpuDescription}` : ''}</> : <span className="text-ink-400">Não (IA usará CPU)</span>} />
              <Row k="WebGPU FP16" v={yes(hw.webgpuF16)} />
              <Row k="Memória (RAM)" v={hw.deviceMemoryGb !== null ? `≈ ${hw.deviceMemoryGb} GB (valor aproximado do navegador)` : <span className="text-ink-400">Não informada pelo navegador</span>} />
              <Row k="Núcleos lógicos" v={hw.cores ?? 'Não informado'} />
              <Row k="Armazenamento" v={hw.storageQuotaMb !== null ? `${fmtBytes((hw.storageUsageMb ?? 0) * 1048576)} usados de ${fmtBytes(hw.storageQuotaMb * 1048576)} disponíveis` : 'Não informado'} />
            </div>
          )}
          <div className="mt-4 border-t border-ink-100 pt-4 dark:border-white/[0.05]">
            <div className="label mb-2">Configuração de desempenho</div>
            <Segmented<HardwareProfile | 'auto'>
              ariaLabel="Configuração de desempenho"
              value={s.profile ?? 'auto'}
              onChange={(v) => updateSettings({ profile: v === 'auto' ? null : v, ocrQuality: v === 'economy' ? 'fast' : v === 'high' ? 'high' : 'balanced' })}
              options={[
                { value: 'auto', label: `Automática${hw ? ` (${PROFILE_LABEL[hw.recommendedProfile]})` : ''}` },
                { value: 'economy', label: 'Econômica' },
                { value: 'balanced', label: 'Equilibrada' },
                { value: 'high', label: 'Alta precisão' },
              ]}
              size="sm"
            />
            <p className="mt-2 text-[12px] text-ink-500">Define a qualidade padrão do OCR e o modelo recomendado. A detecção é aproximada: navegadores expõem informações limitadas de hardware.</p>
          </div>
        </section>

        <section className="card p-5" aria-label="OCR">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="label">Motor de OCR</div>
              <h2 className="mt-1 text-base font-semibold">Tesseract.js · Português (LSTM)</h2>
              <p className="mt-1 text-[13px] text-ink-500">Licença Apache-2.0 · {fmtBytes(OCR_TOTAL_BYTES)} · servido pelo próprio ARANDU</p>
            </div>
            {ocr.ready ? <Badge tone="brand">Disponível offline</Badge> : <Badge>{ocr.cached}/{ocr.total || OCR_ASSETS.length} arquivos em cache</Badge>}
          </div>
          <ul className="mt-3 space-y-1 text-[12.5px] text-ink-600 dark:text-ink-300">
            {OCR_ASSETS.map((a) => <li key={a.url} className="flex justify-between gap-3"><span>{a.label}</span><span className="text-ink-400">{fmtBytes(a.approxBytes)}</span></li>)}
          </ul>
          {ocrBusy !== null && <ProgressBar value={ocrBusy} className="mt-3" />}
          <div className="mt-4 flex flex-wrap gap-2">
            {!ocr.ready && (
              <Button variant="primary" disabled={ocrBusy !== null} onClick={async () => {
                setOcrBusy(0);
                try { await prepareOcrAssets((l, t) => setOcrBusy(l / t)); updateSettings({ ocrAuthorized: true }); } catch (e) { setErr(String(e)); }
                setOcrBusy(null); void refreshOcrStatus();
              }}>Baixar para uso offline ({fmtBytes(OCR_TOTAL_BYTES)})</Button>
            )}
            {(ocr.cached > 0 || s.ocrAuthorized) && (
              <Button variant="danger" onClick={async () => { await removeOcrAssets(); updateSettings({ ocrAuthorized: false }); void refreshOcrStatus(); }}>Remover OCR</Button>
            )}
          </div>
        </section>
      </div>

      {err && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">Erro: {err}</p>}

      <h2 className="mt-8 mb-3 flex items-center gap-2 text-sm font-semibold">Modelo de linguagem <Badge tone="warn">Experimental · opcional</Badge></h2>
      <div className="mb-4 rounded-xl border border-ink-200 bg-white px-4 py-3 text-[13px] text-ink-600 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-ink-300">
        <p><strong>Você não precisa de IA para usar o ARANDU.</strong> Extração, OCR, análise jurídica e otimização funcionam sem ela e são leves.</p>
        <p className="mt-1.5">A IA local serve apenas para resumos e para verificar classificações duvidosas. Para não deixar o computador lento, ela só fica na memória enquanto estiver em uso e é <strong>descarregada automaticamente após 90 segundos</strong> sem uso. Os arquivos do modelo vêm do Hugging Face (nenhum documento é enviado).</p>
        {hw && ((hw.deviceMemoryGb !== null && hw.deviceMemoryGb < 8) || !hw.webgpu) && (
          <p className="mt-1.5 text-amber-700 dark:text-amber-300">Neste dispositivo ({hw.deviceMemoryGb !== null ? `≈ ${hw.deviceMemoryGb} GB de RAM` : 'RAM não informada'}{hw.webgpu ? '' : ', sem WebGPU'}), recomendamos não ativar a IA: o resumo extrativo é instantâneo e não pesa.</p>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {MODELS.map((m) => {
          const c = cache[m.id];
          const isActive = ai.modelId === m.id && (ai.status === 'ready' || ai.status === 'generating');
          const isLoading = ai.modelId === m.id && ai.status === 'loading';
          const variant = m.variants[backend];
          const recommended = m.recommendedFor.includes(profile);
          const compatible = hw ? hw.wasm : true;
          return (
            <article key={m.id} className="card flex flex-col p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">{m.name}</h3>
                  <p className="text-[12.5px] text-ink-500">{m.developer}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {recommended && <Badge tone="info">Recomendado</Badge>}
                  {isActive ? <Badge tone="brand">Ativo</Badge> : c?.installed ? <Badge tone="brand">Instalado</Badge> : <Badge>Não instalado</Badge>}
                  {s.defaultModelId === m.id && <Badge>Padrão</Badge>}
                </div>
              </div>
              <div className="mt-3 divide-y divide-ink-100 dark:divide-white/[0.05]">
                <Row k="Parâmetros" v={m.parameters} />
                <Row k="Download neste dispositivo" v={`≈ ${variant.sizeMb} MB (${variant.dtype}, ${backend === 'webgpu' ? 'WebGPU' : 'CPU/WASM'}) + runtime ${ORT_RUNTIME_MB} MB`} />
                <Row k="Espaço ocupado" v={c?.installed ? fmtBytes(c.bytes) : '—'} />
                <Row k="Idiomas" v={m.languages} />
                <Row k="Licença" v={m.license} />
                <Row k="Compatibilidade" v={compatible ? (backend === 'webgpu' ? 'Compatível (GPU)' : 'Compatível (CPU, mais lento)') : 'Incompatível'} />
              </div>
              <p className="mt-3 text-[12.5px] text-ink-600 dark:text-ink-300"><strong>Finalidade:</strong> {m.purpose}</p>
              <p className="mt-1 text-[12.5px] text-ink-600 dark:text-ink-300"><strong>Requisitos:</strong> {m.hardware}</p>
              {isActive && ai.persisted === false && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  O navegador não guardou o arquivo do modelo no cache (limite de armazenamento). Ele funciona agora, mas será baixado de novo na próxima ativação e não estará disponível offline.
                </p>
              )}
              {!isActive && !isLoading && ai.autoUnloaded && s.defaultModelId === m.id && (
                <p className="mt-3 text-[12px] text-ink-500">Descarregado automaticamente para liberar memória. Clique em Ativar para usar de novo.</p>
              )}
              {isLoading && (
                <div className="mt-3">
                  <ProgressBar value={(ai.progress ?? 0) / 100} indeterminate={!ai.totalMb} />
                  <p className="mt-1 text-[12px] text-ink-500">{ai.totalMb ? `${ai.loadedMb} de ${ai.totalMb} MB (${ai.progress}%)` : 'Preparando…'}</p>
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {!c?.installed && !isLoading && <Button variant="primary" disabled={!compatible || ai.status === 'loading'} onClick={() => setConfirm({ spec: m })}><Icon name="download" size={14} /> Baixar ({variant.sizeMb} MB)</Button>}
                {c?.installed && !isActive && !isLoading && <Button variant="primary" disabled={ai.status === 'loading'} onClick={() => download(m)}>Ativar</Button>}
                {isActive && <Button onClick={() => { unloadModel(); updateSettings({ useAi: false }); }}>Desativar</Button>}
                {c?.installed && s.defaultModelId !== m.id && <Button onClick={() => updateSettings({ defaultModelId: m.id })}>Definir como padrão</Button>}
                {c?.installed && !isLoading && <Button onClick={() => setConfirm({ spec: m, update: true })}><Icon name="retry" size={14} /> Atualizar</Button>}
                {c?.installed && !isLoading && (
                  <Button variant="danger" onClick={async () => { await removeModel(m.id); if (s.defaultModelId === m.id) updateSettings({ defaultModelId: null, useAi: false }); void refresh(); }}>
                    <Icon name="trash" size={14} /> Remover
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.update ? `Atualizar ${confirm.spec.name}?` : `Baixar ${confirm?.spec.name}?`}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button><Button variant="primary" onClick={() => confirm && download(confirm.spec, confirm.update)}>Autorizar download</Button></>}
      >
        {confirm && (
          <>
            <p>Serão baixados cerca de <strong>{confirm.spec.variants[backend].sizeMb} MB</strong> do Hugging Face (arquivos do modelo, licença {confirm.spec.license}), além do runtime ONNX local (~{ORT_RUNTIME_MB} MB, servido pelo ARANDU).</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Somente arquivos do modelo são baixados. Nenhum conteúdo de documento é enviado.</li>
              <li>Os arquivos ficam no cache do navegador e permitem uso offline depois.</li>
              <li>Em conexões móveis, prefira Wi-Fi. Você pode remover o modelo a qualquer momento.</li>
              {backend === 'wasm' && <li>Sem WebGPU, a execução será na CPU e pode ser lenta.</li>}
            </ul>
          </>
        )}
      </Modal>
    </div>
  );
}
