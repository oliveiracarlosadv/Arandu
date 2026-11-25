import { LogoMark } from '../components/Logo';
import { Icon } from '../components/ui';

// Texto biográfico fornecido pelo autor (Texto Release).
const BIO = [
  'Carlos Alexandre Albuquerque Oliveira é advogado, empreendedor jurídico e pesquisador permanente do Direito, reconhecendo na aprendizagem contínua um dos pilares de sua atuação profissional. Natural de Belém do Pará, desenvolve seu trabalho junto a pessoas físicas e jurídicas, aliando sólida experiência na advocacia contenciosa à constante busca por inovação e eficiência na prestação de serviços jurídicos.',
  'Ao longo de sua trajetória, consolidou-se como profissional comprometido com a excelência técnica e com a transformação digital do setor jurídico. Entre 2020 e 2026, foi sócio-fundador do escritório Sampaio & Oliveira Advogados, onde exerceu a função de Diretor do Setor de Demandas Contenciosas, liderando estratégias processuais, equipes e soluções voltadas à defesa dos interesses de clientes em diferentes áreas do Direito.',
  'Apaixonado por música, tecnologia e conhecimento, Carlos dedica parte significativa de sua atuação ao desenvolvimento de soluções tecnológicas para advogados, acreditando que a inovação é um instrumento essencial para tornar a advocacia mais eficiente, acessível e conectada às necessidades da sociedade contemporânea.',
  'Na internet, compartilha conhecimento, reflexões e experiências práticas sobre advocacia, tecnologia jurídica e transformação digital, ao mesmo tempo em que mantém uma postura aberta ao aprendizado colaborativo com profissionais do Direito, desenvolvedores e entusiastas da tecnologia aplicada ao setor jurídico.',
  'Sua visão combina tradição jurídica e inovação, buscando criar pontes entre o conhecimento técnico, a inteligência digital e os desafios enfrentados pelos profissionais do Direito. Essa atuação multidisciplinar o posiciona como um agente ativo na construção de uma advocacia mais moderna, estratégica e preparada para o futuro.',
  'Carlos Alexandre Albuquerque Oliveira acredita que o Direito evolui quando conhecimento, tecnologia e pessoas caminham juntos, transformando desafios em oportunidades e promovendo soluções capazes de gerar impacto real para profissionais, empresas e cidadãos.',
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-6 py-10 text-white sm:px-10">
          <LogoMark size={64} className="rounded-2xl ring-1 ring-white/20" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">ARANDU</h1>
          <p className="mt-1 text-brand-100">Seus documentos. Menos tokens. Mais inteligência.</p>
        </div>
        <div className="space-y-3 px-6 py-6 text-[14px] leading-relaxed text-ink-700 sm:px-10 dark:text-ink-300">
          <p>
            <strong>Arandu</strong>, palavra de origem tupi-guarani, remete a <em>conhecimento</em> e <em>sabedoria</em>. O símbolo do aplicativo é um “A”
            desenhado como uma oca: a casa onde o saber é guardado e compartilhado.
          </p>
          <p>
            O ARANDU transforma documentos (PDF, DOCX, ODT, RTF, TXT e imagens) em Markdown organizado e otimizado para leitura por inteligências
            artificiais. Ele reduz ruídos de formatação e o consumo estimado de tokens sem sacrificar a fidelidade das informações. Tudo roda no seu dispositivo, de graça e sem
            enviar documentos a terceiros.
          </p>
          <p className="text-[13px] text-ink-500">Prioridades: privacidade, processamento local, fidelidade documental e otimização para IA.</p>
        </div>
      </section>

      <section className="card mt-4 px-6 py-6 sm:px-10">
        <div className="label">Idealizador</div>
        <div className="mt-3 flex items-center gap-4">
          <img
            src={`${import.meta.env.BASE_URL}criador-avatar.jpg`}
            width={80}
            height={80}
            alt="Carlos Alexandre Albuquerque Oliveira"
            className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-brand-500/40"
          />
          <div>
            <h2 className="text-lg font-semibold text-ink-950 dark:text-white">Carlos Alexandre Albuquerque Oliveira</h2>
            <p className="text-[13px] text-ink-500">Advogado · Empreendedor jurídico · Belém do Pará</p>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-ink-700 dark:text-ink-300">
          {BIO.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="mt-6 border-t border-ink-100 pt-4 dark:border-white/[0.06]">
          <div className="label mb-2">Contato</div>
          <ul className="space-y-1.5 text-[14px]">
            <li className="flex items-center gap-2"><Icon name="info" size={15} className="text-brand-600" /> @oliveiracarlosadv</li>
            <li className="flex items-center gap-2"><Icon name="file" size={15} className="text-brand-600" /> <a className="underline decoration-brand-300 underline-offset-2" href="mailto:carlos.0109adv@gmail.com">carlos.0109adv@gmail.com</a></li>
            <li className="flex items-center gap-2"><Icon name="info" size={15} className="text-brand-600" /> <a className="underline decoration-brand-300 underline-offset-2" href="tel:+5591986061300">(91) 9 8606-1300</a></li>
          </ul>
        </div>
      </section>

      <section className="card mt-4 px-6 py-5 text-[13px] text-ink-600 sm:px-10 dark:text-ink-300">
        <div className="label mb-2">Tecnologias de código aberto</div>
        <p>React, TypeScript, Vite, Tailwind CSS, PDF.js, Mammoth.js, JSZip, Tesseract.js, Transformers.js, ONNX Runtime Web, gpt-tokenizer, marked, DOMPurify, UTIF.js e Workbox. Modelos de linguagem Qwen2.5 (Apache-2.0).</p>
      </section>
    </div>
  );
}
