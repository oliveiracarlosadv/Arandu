// Catálogo da Central de Modelos. Apenas modelos com licença permissiva (Apache-2.0),
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
    purpose: 'Resumos curtos e apoio à classificação. Leve e rápido; qualidade limitada em textos longos.',
    hardware: '≈ 2 GB de RAM livre. WebGPU recomendado; funciona em CPU (WASM), mais lento.',
    variants: { webgpu: { dtype: 'q4f16', sizeMb: 483 }, wasm: { dtype: 'q8', sizeMb: 512 } },
    recommendedFor: ['economy', 'balanced'],
    contextTokens: 32768,
  },
  {
    id: 'onnx-community/Qwen2.5-1.5B-Instruct',
    name: 'Qwen2.5 1.5B Instruct',
    developer: 'Alibaba Cloud (Qwen) — conversão ONNX: onnx-community',
    parameters: '1,5 bilhão',
    license: 'Apache-2.0',
    languages: 'Multilíngue (29+ idiomas, inclui português)',
    purpose: 'Resumos de maior qualidade e verificação de classificação jurídica.',
    hardware: '≈ 4 GB de RAM livre e WebGPU recomendados. Em CPU (WASM) é lento.',
    variants: { webgpu: { dtype: 'q4f16', sizeMb: 1222 }, wasm: { dtype: 'q8', sizeMb: 1579 } },
    recommendedFor: ['high'],
    contextTokens: 32768,
  },
];

export const findModel = (id: string) => MODELS.find((m) => m.id === id);

export const ORT_RUNTIME_MB = 27; // ONNX Runtime Web (asyncify), servido localmente
