// Catálogo da Central de Modelos. A IA generativa é OPCIONAL e EXPERIMENTAL no ARANDU: o núcleo
// (extração, OCR, análise jurídica, otimização) não depende dela. Para não pesar no computador,
// o catálogo traz apenas o menor modelo útil em português; modelos maiores foram retirados.
// Apenas modelos com licença permissiva (Apache-2.0),
// em formato ONNX quantizado, executáveis no navegador via Transformers.js (WebGPU ou WASM).
// Tamanhos aferidos nos arquivos publicados no Hugging Face (podem mudar com novas revisões).

export type Backend = 'webgpu' | 'wasm';

export interface ModelSpec {
  id: string;
  name: string;
  developer: string;
  parameters: string;
  license: string;
  languages: string;
  purpose: string;
  hardware: string;
  /** dtype e tamanho aproximado do download por backend (MB). */
  variants: Record<Backend, { dtype: 'q4f16' | 'q4' | 'q8'; sizeMb: number }>;
  recommendedFor: ('economy' | 'balanced' | 'high')[];
  contextTokens: number;
}

export const MODELS: ModelSpec[] = [
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    name: 'Qwen2.5 0.5B Instruct',
    developer: 'Alibaba Cloud (Qwen) — conversão ONNX: onnx-community',
    parameters: '0,5 bilhão',
    license: 'Apache-2.0',
    languages: 'Multilíngue (29+ idiomas, inclui português)',
    purpose: 'Experimental: resumos curtos e verificação de classificações duvidosas. A saída passa por uma trava de qualidade; se for inválida, é descartada e o resumo extrativo é usado.',
    hardware: 'Ocupa cerca de 1 GB de memória enquanto ativo e é descarregado após 90 s sem uso. WebGPU recomendado; em CPU (WASM) é mais lento.',
    variants: { webgpu: { dtype: 'q4f16', sizeMb: 483 }, wasm: { dtype: 'q8', sizeMb: 512 } },
    recommendedFor: [], // não recomendado por padrão: produziu saída corrompida em WebGPU nos testes (25/11/2026)
    contextTokens: 32768,
  },
];

export const findModel = (id: string) => MODELS.find((m) => m.id === id);

export const ORT_RUNTIME_MB = 27; // ONNX Runtime Web (asyncify), servido localmente
