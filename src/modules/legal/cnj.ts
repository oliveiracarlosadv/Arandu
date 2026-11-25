// Decodificação da Numeração Única do CNJ (Resolução CNJ nº 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO
// Inclui validação do dígito verificador (módulo 97, ISO 7064).

const UF_BY_TR = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SE', 'SP', 'TO'];
const UF_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal e Territórios',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

export interface CnjInfo {
  number: string;
  year: number;
  segment: string;
  tribunal: string;
  originCode: string;
  checkDigitValid: boolean;
}

function mod97(numStr: string): number {
  let rem = 0;
  for (const ch of numStr) rem = (rem * 10 + Number(ch)) % 97;
  return rem;
}

export function validateCnjCheckDigit(n: string): boolean {
  const m = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/.exec(n);
  if (!m) return false;
  const [, seq, dd, year, j, tr, origin] = m;
  return mod97(`${seq}${year}${j}${tr}${origin}${dd}`) === 1;
}

export function decodeCnj(n: string): CnjInfo | null {
  const m = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/.exec(n.trim());
  if (!m) return null;
  const [, , , year, j, trStr, origin] = m;
  const tr = Number(trStr);
  let segment = '';
  let tribunal = '';
  switch (j) {
    case '1': segment = 'Supremo Tribunal Federal'; tribunal = 'STF'; break;
    case '2': segment = 'Conselho Nacional de Justiça'; tribunal = 'CNJ'; break;
    case '3': segment = 'Superior Tribunal de Justiça'; tribunal = 'STJ'; break;
    case '4': segment = 'Justiça Federal'; tribunal = tr === 90 ? 'Conselho da Justiça Federal' : `Tribunal Regional Federal da ${tr}ª Região (TRF${tr})`; break;
    case '5': segment = 'Justiça do Trabalho'; tribunal = tr === 0 ? 'Tribunal Superior do Trabalho (TST)' : tr === 90 ? 'Conselho Superior da Justiça do Trabalho' : `Tribunal Regional do Trabalho da ${tr}ª Região (TRT${tr})`; break;
    case '6': {
      segment = 'Justiça Eleitoral';
      const uf = UF_BY_TR[tr - 1];
      tribunal = tr === 0 ? 'Tribunal Superior Eleitoral (TSE)' : uf ? `Tribunal Regional Eleitoral \u2014 ${UF_NAMES[uf]} (TRE-${uf})` : `TRE (código ${trStr})`;
      break;
    }
    case '7': segment = 'Justiça Militar da União'; tribunal = tr === 0 ? 'Superior Tribunal Militar (STM)' : `Circunscrição Judiciária Militar ${tr}`; break;
    case '8': {
      segment = 'Justiça Estadual';
      const uf = UF_BY_TR[tr - 1];
      tribunal = uf ? `Tribunal de Justiça \u2014 ${UF_NAMES[uf]} (TJ${uf === 'DF' ? 'DFT' : uf})` : `Tribunal de Justiça (código ${trStr})`;
      break;
    }
    case '9': {
      segment = 'Justiça Militar Estadual';
      tribunal = tr === 13 ? 'Tribunal de Justiça Militar de Minas Gerais' : tr === 21 ? 'Tribunal de Justiça Militar do Rio Grande do Sul' : tr === 26 ? 'Tribunal de Justiça Militar de São Paulo' : `Justiça Militar Estadual (código ${trStr})`;
      break;
    }
    default: return null;
  }
  return { number: n, year: Number(year), segment, tribunal, originCode: origin, checkDigitValid: validateCnjCheckDigit(n) };
}
