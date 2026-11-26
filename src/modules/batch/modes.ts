import type { ConversionMode } from '../../types';

export const MODES: { value: ConversionMode; label: string; desc: string }[] = [
  { value: 'fidelity', label: 'Fidelidade máxima', desc: 'Preserva integralmente conteúdo e estrutura; só normaliza o necessário.' },
  { value: 'ai', label: 'Otimizado para IA', desc: 'Remove ruído de formatação, cabeçalhos repetidos e quebras artificiais, sem perder informação.' },
  { value: 'summary', label: 'Resumo inteligente', desc: 'Adiciona uma síntese separada, mantendo o conteúdo integral abaixo.' },
  { value: 'legal', label: 'Jurídico estruturado', desc: 'Destaca partes, pedidos, fundamentos, decisão, prazos e referências legais.' },
];

export const MODE_LABEL: Record<ConversionMode, string> = { fidelity: 'Fidelidade', ai: 'Otimizado', summary: 'Resumo', legal: 'Jurídico' };
