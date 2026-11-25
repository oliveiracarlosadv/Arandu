// Proteção contra arquivos ZIP malformados/maliciosos (DOCX e ODT são contêineres ZIP):
// limita número de entradas e tamanho descompactado (zip bomb) e rejeita macros.

import JSZip from 'jszip';

export interface ZipLimits {
  maxEntries: number;
  maxUncompressedBytes: number;
}

const DEFAULT_LIMITS: ZipLimits = { maxEntries: 5000, maxUncompressedBytes: 300 * 1024 * 1024 };

export async function openZipSafely(data: ArrayBuffer, limits: ZipLimits = DEFAULT_LIMITS): Promise<{ zip: JSZip; hasMacros: boolean }> {
  const zip = await JSZip.loadAsync(data, { checkCRC32: false });
  const files = Object.values(zip.files);
  if (files.length > limits.maxEntries) throw new Error(`Arquivo compactado com entradas demais (${files.length}).`);
  let total = 0;
  let hasMacros = false;
  for (const f of files) {
    const size = (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    total += size;
    if (/vbaProject\.bin$|\/Basic\/|\.(bin|exe|dll|js|vbs)$/i.test(f.name) && !/^(word|xl|ppt)\/(media|embeddings)\//.test(f.name)) {
      hasMacros = true;
    }
    if (f.name.includes('..')) throw new Error('Entrada com caminho inválido no arquivo compactado.');
  }
  if (total > limits.maxUncompressedBytes) {
    throw new Error(`Conteúdo descompactado excede o limite de segurança (${Math.round(total / 1048576)} MB).`);
  }
  return { zip, hasMacros };
}
