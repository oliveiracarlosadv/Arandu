import { PageHeader } from '../components/ui';

const items: { t: string; d: string }[] = [
  { t: 'Processamento no seu dispositivo', d: 'Leitura de PDF (PDF.js), DOCX (Mammoth.js), ODT, RTF e TXT, OCR (Tesseract.js em WebAssembly), análise jurídica (regras locais) e IA (Transformers.js/ONNX Runtime Web) rodam dentro do navegador, em Web Workers. Os arquivos são lidos para a memória local e nunca são enviados a servidores.' },
  { t: 'Nenhum upload, nenhuma API externa', d: 'O ARANDU não possui backend de processamento e não usa APIs pagas (OpenAI, Anthropic, Gemini ou similares). Uma Política de Segurança de Conteúdo (CSP) limita as conexões de rede à própria aplicação e ao Hugging Face, usado apenas para baixar modelos que você autorizar.' },
  { t: 'Sem telemetria de documentos', d: 'Não há analytics, rastreadores ou registros contendo conteúdo, nomes de arquivos ou dados extraídos.' },
  { t: 'Downloads somente com autorização', d: 'O pacote de OCR (~13 MB, servido pelo próprio ARANDU) e os modelos de IA (centenas de MB, do Hugging Face) só são baixados após você ver o tamanho e autorizar. Durante o download de um modelo, apenas os arquivos do modelo trafegam: nenhum dado seu é enviado.' },
  { t: 'Armazenamento local e controlável', d: 'Por padrão o histórico guarda apenas metadados: nome do arquivo, data e hora de anexação e de processamento, estatísticas e, em documentos de processo, número, autor, réu e tribunal. O conteúdo convertido só é salvo se você ativar essa opção ou adicionar o documento ao Workspace Jurídico. Há exclusão automática configurável e botões para apagar histórico, Workspace, modelos e OCR.' },
  { t: 'Arquivos temporários', d: 'Documentos em processamento ficam apenas na memória da aba. Ao fechar o aplicativo, eles são descartados. Resultados não salvos não persistem.' },
  { t: 'Proteção contra arquivos maliciosos', d: 'Cada arquivo tem extensão e assinatura binária verificadas e respeita um limite de tamanho configurável. DOCX/ODT são inspecionados contra “zip bombs” (limite de entradas e de tamanho descompactado). Macros, scripts e conteúdo ativo nunca são executados; arquivos .docm são recusados. O Markdown exibido é sanitizado (DOMPurify).' },
  { t: 'Isolamento por tarefa', d: 'Cada documento é processado individualmente, com seus próprios recursos liberados ao final. Uma falha em um arquivo não afeta os demais da fila.' },
  { t: 'Limites honestos', d: 'Estimativas de tokens variam conforme o modelo. A detecção de hardware depende do que o navegador informa (memória RAM nem sempre está disponível). Resumos por IA são interpretativos e ficam sempre separados do conteúdo original.' },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Privacidade" subtitle="Como o ARANDU processa seus documentos — e o que ele nunca faz." />
      <div className="space-y-3">
        {items.map((i) => (
          <section key={i.t} className="card p-5">
            <h2 className="text-[14.5px] font-semibold text-ink-950 dark:text-white">{i.t}</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600 dark:text-ink-300">{i.d}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-[12.5px] text-ink-500">Código-fonte aberto: você pode auditar exatamente o que o aplicativo faz.</p>
    </div>
  );
}
