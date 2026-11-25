import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** Renderiza Markdown com sanitização (o conteúdo vem de documentos de terceiros). */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
    return DOMPurify.sanitize(raw, { FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'img'], FORBID_ATTR: ['style', 'onerror', 'onclick'] });
  }, [markdown]);
  return <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}
