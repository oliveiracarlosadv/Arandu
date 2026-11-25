// Validação de arquivos recebidos: extensão + assinatura binária (magic bytes) + tamanho.
// Arquivos com macro (.docm), executáveis e formatos não suportados são recusados.

import type { SourceFormat } from '../types';

export const ACCEPT = '.pdf,.docx,.txt,.rtf,.odt,.png,.jpg,.jpeg,.webp,.tif,.tiff';

const EXT: Record<string, SourceFormat> = {
  pdf: 'pdf', docx: 'docx', txt: 'txt', md: 'txt', rtf: 'rtf', odt: 'odt',
  png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', tif: 'tiff', tiff: 'tiff',
};

export const FORMAT_LABEL: Record<SourceFormat, string> = {
  pdf: 'PDF', docx: 'DOCX', txt: 'TXT', rtf: 'RTF', odt: 'ODT', png: 'PNG', jpg: 'JPEG', webp: 'WEBP', tiff: 'TIFF',
};

export const IMAGE_FORMATS: SourceFormat[] = ['png', 'jpg', 'webp', 'tiff'];

function startsWith(b: Uint8Array, sig: number[], offset = 0) {
  return sig.every((v, i) => b[offset + i] === v);
}

export function sniffFormat(head: Uint8Array): SourceFormat | 'zip' | null {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return 'zip';
  if (startsWith(head, [0x7b, 0x5c, 0x72, 0x74, 0x66])) return 'rtf'; // {\rtf
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  if (startsWith(head, [0x49, 0x49, 0x2a, 0x00]) || startsWith(head, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff';
  return null;
}

/** Heurística de texto: sem bytes NUL (exceto UTF-16 com BOM) nos primeiros KB. */
function looksLikeText(head: Uint8Array): boolean {
  if ((head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff)) return true;
  let ctrl = 0;
  for (const b of head) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) ctrl++;
  }
  return ctrl / Math.max(1, head.length) < 0.02;
}

export interface ValidationResult {
  ok: boolean;
  format?: SourceFormat;
  error?: string;
}

export async function validateFile(file: File, maxSizeMb: number): Promise<ValidationResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'docm' || ext === 'dotm') return { ok: false, error: 'Documentos com macros (.docm) não são aceitos por segurança. Salve como .docx.' };
  const byExt = EXT[ext];
  if (!byExt) return { ok: false, error: `Formato não suportado (.${ext || '?'}). Aceitos: PDF, DOCX, TXT, RTF, ODT, PNG, JPG, WEBP, TIFF.` };
  if (file.size === 0) return { ok: false, error: 'Arquivo vazio.' };
  if (file.size > maxSizeMb * 1024 * 1024) return { ok: false, error: `Arquivo excede o limite configurado de ${maxSizeMb} MB.` };

  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const sniff = sniffFormat(head);
  if (byExt === 'txt') {
    if (sniff && sniff !== 'rtf') return { ok: false, error: 'O conteúdo não é texto simples (assinatura binária detectada).' };
    if (sniff === 'rtf') return { ok: true, format: 'rtf' };
    return looksLikeText(head) ? { ok: true, format: 'txt' } : { ok: false, error: 'O arquivo não parece conter texto simples.' };
  }
  if (byExt === 'docx' || byExt === 'odt') {
    return sniff === 'zip' ? { ok: true, format: byExt } : { ok: false, error: `Arquivo .${ext} inválido ou corrompido (não é um contêiner ZIP/Office).` };
  }
  if (sniff !== byExt) {
    // Imagens com extensão trocada (ex.: PNG salvo como .jpg) são aceitas pelo conteúdo real
    if (sniff && IMAGE_FORMATS.includes(sniff as SourceFormat) && IMAGE_FORMATS.includes(byExt)) return { ok: true, format: sniff as SourceFormat };
    return { ok: false, error: `O conteúdo do arquivo não corresponde à extensão .${ext}.` };
  }
  return { ok: true, format: byExt };
}
