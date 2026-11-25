// Extração de DOCX com Mammoth.js (estrutura semântica: títulos, listas, tabelas, notas).
// Macros e conteúdo ativo nunca são executados; imagens não são embutidas no resultado.

import mammoth from 'mammoth';
import type { ExtractedDocument } from '../../types';
import { htmlToBlocks } from './htmlToBlocks';
import { openZipSafely } from './zipGuard';

export async function extractDocx(data: ArrayBuffer): Promise<ExtractedDocument> {
  const { zip, hasMacros } = await openZipSafely(data);
  if (!zip.file('word/document.xml')) throw new Error('DOCX inválido: word/document.xml ausente.');
  const warnings: string[] = [];
  if (hasMacros) warnings.push('O arquivo contém macros/código embutido. Eles foram ignorados e não foram executados.');

  const result = await mammoth.convertToHtml(
    { arrayBuffer: data },
    {
      convertImage: mammoth.images.imgElement(async () => ({ src: '', alt: 'imagem' })),
      ignoreEmptyParagraphs: true,
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Título'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Citação'] => blockquote:fresh",
        "p[style-name='Intense Quote'] => blockquote:fresh",
      ],
    },
  );
  const raw = await mammoth.extractRawText({ arrayBuffer: data });
  const blocks = htmlToBlocks(result.value);
  if (!blocks.length && raw.value.trim()) {
    for (const p of raw.value.split(/\n{2,}/)) if (p.trim()) blocks.push({ kind: 'paragraph', text: p.trim() });
  }
  const chars = raw.value.length;
  return {
    blocks,
    rawText: raw.value,
    pages: [],
    pageCount: Math.max(1, Math.round(chars / 3000)),
    method: 'estrutura-docx',
    ocrPageCount: 0,
    repeatedMarginals: [],
    warnings,
  };
}
