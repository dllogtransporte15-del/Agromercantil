import { extractTextFromPdfBuffer } from './fiscalDocParser';
import type { User } from '../types';

export interface ParsedHoleriteData {
  employeeName?: string;
  employeeCpf?: string;
  referenceMonth?: string;     // Formato 'YYYY-MM'
  referenceMonthLabel?: string;// Formato 'MM/YYYY'
  netSalary?: number;          // Valor Líquido a Receber (R$)
  grossSalary?: number;        // Total de Proventos / Vencimentos (R$)
  totalDiscounts?: number;     // Total de Descontos (R$)
  paymentDate?: string;        // YYYY-MM-DD
  matchedUserId?: string;      // ID do colaborador correspondente no sistema
  rawText?: string;
}

/**
 * Limpa e formata string de valor monetário brasileiro para número (ex: "R$ 3.500,00" -> 3500.00)
 */
function parseBrlMoney(text: string): number | undefined {
  if (!text) return undefined;
  const match = text.match(/R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*|\d+)(?:,([0-9]{2}))?/);
  if (!match) return undefined;
  const intPart = (match[1] || '0').replace(/\./g, '');
  const decPart = match[2] || '00';
  const val = parseFloat(`${intPart}.${decPart}`);
  return isNaN(val) ? undefined : val;
}

/**
 * Normaliza string removendo acentos e pontuações para comparação suave
 */
function normalizeStr(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Extrai dados estruturados de um arquivo de Holerite / Contracheque (PDF ou texto)
 */
export async function parseHoleriteFile(file: File, systemUsers: User[] = []): Promise<ParsedHoleriteData> {
  const result: ParsedHoleriteData = {};

  try {
    let fullText = '';

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const buffer = await file.arrayBuffer();
      fullText = await extractTextFromPdfBuffer(buffer);
    } else {
      fullText = await file.text();
    }

    result.rawText = fullText;

    if (!fullText || fullText.trim().length === 0) {
      return result;
    }

    // 1. Extração do Mês de Competência / Referência (ex: 10/2026, 11/2026, Outubro/2026)
    const compRegex = /(?:refer[eê]ncia|compet[eê]ncia|m[eê]s(?:\/ano)?|per[ií]odo)[\s\:\-]*([0-1]?[0-9])[\/\-](20[2-3][0-9])/i;
    const compMatch = fullText.match(compRegex);
    if (compMatch) {
      const mm = compMatch[1].padStart(2, '0');
      const yyyy = compMatch[2];
      result.referenceMonth = `${yyyy}-${mm}`;
      result.referenceMonthLabel = `${mm}/${yyyy}`;
    } else {
      // Procura formato MM/AAAA avulso
      const standaloneDateMatch = fullText.match(/\b(0[1-9]|1[0-2])\/(202[4-9]|203[0-5])\b/);
      if (standaloneDateMatch) {
        result.referenceMonth = `${standaloneDateMatch[2]}-${standaloneDateMatch[1]}`;
        result.referenceMonthLabel = `${standaloneDateMatch[1]}/${standaloneDateMatch[2]}`;
      }
    }

    // 2. Extração do CPF do Colaborador
    const cpfMatch = fullText.match(/\b(\d{3}\.\d{3}\.\d{3}\-\d{2}|\d{11})\b/);
    if (cpfMatch) {
      result.employeeCpf = cpfMatch[1].replace(/\D/g, '');
    }

    // 3. Extração do Valor Líquido a Receber
    // Exemplos: "Líquido a Receber: R$ 4.500,00", "Total Líquido: 3.200,50", "Valor Líquido R$ 5.120,00"
    const netPatterns = [
      /(?:l[ií]quido\s+a\s+receber|valor\s+l[ií]quido|total\s+l[ií]quido|l[ií]quido)[\s\:\$R\.\-]*([\d\.\,]+)/i,
      /(?:total\s+proventos|total\s+vencimentos)[\s\S]*?(?:total\s+descontos)[\s\S]*?(?:valor\s+l[ií]quido|l[ií]quido)[\s\:\$R\.\-]*([\d\.\,]+)/i
    ];

    for (const pat of netPatterns) {
      const match = fullText.match(pat);
      if (match && match[1]) {
        const val = parseBrlMoney(match[1]);
        if (val !== undefined && val > 0 && val < 500000) {
          result.netSalary = val;
          break;
        }
      }
    }

    // 4. Extração do Total de Vencimentos / Proventos
    const grossMatch = fullText.match(/(?:total\s+de\s+vencimentos|total\s+vencimentos|total\s+de\s+proventos|total\s+proventos|sal[aá]rio\s+base)[\s\:\$R\.\-]*([\d\.\,]+)/i);
    if (grossMatch && grossMatch[1]) {
      const val = parseBrlMoney(grossMatch[1]);
      if (val !== undefined && val > 0) result.grossSalary = val;
    }

    // 5. Extração do Total de Descontos
    const discMatch = fullText.match(/(?:total\s+de\s+descontos|total\s+descontos)[\s\:\$R\.\-]*([\d\.\,]+)/i);
    if (discMatch && discMatch[1]) {
      const val = parseBrlMoney(discMatch[1]);
      if (val !== undefined && val >= 0) result.totalDiscounts = val;
    }

    // Se achou proventos e descontos mas não achou líquido diretamente, calcula a diferença
    if (result.grossSalary !== undefined && result.totalDiscounts !== undefined && !result.netSalary) {
      result.netSalary = Number((result.grossSalary - result.totalDiscounts).toFixed(2));
    }

    // 6. Extração de Data de Pagamento / Vencimento
    const payDateMatch = fullText.match(/(?:data\s+de\s+pagamento|data\s+pagto|vencimento|pago\s+em)[\s\:\-]*([0-3]?[0-9])[\/\-]([0-1]?[0-9])[\/\-](20[2-3][0-9])/i);
    if (payDateMatch) {
      const dd = payDateMatch[1].padStart(2, '0');
      const mm = payDateMatch[2].padStart(2, '0');
      const yyyy = payDateMatch[3];
      result.paymentDate = `${yyyy}-${mm}-${dd}`;
    }

    // 7. Identificação e Vínculo Automático com Colaborador do Sistema
    const cleanFullTextNorm = normalizeStr(fullText);

    // Primeiro tenta pelo CPF
    if (result.employeeCpf) {
      const matchedByCpf = systemUsers.find(u => {
        const uCpf = (u as any).cpf ? (u as any).cpf.replace(/\D/g, '') : '';
        return uCpf && uCpf === result.employeeCpf;
      });
      if (matchedByCpf) {
        result.matchedUserId = matchedByCpf.id;
        result.employeeName = matchedByCpf.name;
      }
    }

    // Se não achou por CPF, busca por nome dos colaboradores
    if (!result.matchedUserId && systemUsers.length > 0) {
      // Ordena por comprimento do nome decrescente para priorizar nomes compostos
      const sortedUsers = [...systemUsers].sort((a, b) => (b.name || '').length - (a.name || '').length);

      for (const u of sortedUsers) {
        if (!u.name || u.name.length < 4) continue;
        const normName = normalizeStr(u.name);
        
        // Verifica se o nome completo aparece no texto
        if (cleanFullTextNorm.includes(normName)) {
          result.matchedUserId = u.id;
          result.employeeName = u.name;
          break;
        }

        // Se o nome tiver pelo menos 2 partes (primeiro e último)
        const parts = normName.split(/\s+/).filter(p => p.length >= 3);
        if (parts.length >= 2) {
          const firstAndLast = `${parts[0]} ${parts[parts.length - 1]}`;
          if (cleanFullTextNorm.includes(firstAndLast)) {
            result.matchedUserId = u.id;
            result.employeeName = u.name;
            break;
          }
        }
      }
    }

    // Extração fallback de nome após rótulo no texto
    if (!result.employeeName) {
      const nameMatch = fullText.match(/(?:nome\s+do\s+funcion[aá]rio|funcion[aá]rio|empregado|colaborador)[\s\:\-]*([A-ZÀ-Úa-zà-ú\s]{5,45})/i);
      if (nameMatch && nameMatch[1]) {
        result.employeeName = nameMatch[1].trim();
      }
    }

  } catch (err) {
    console.warn('[holeriteParser] Erro na leitura automática do holerite:', err);
  }

  return result;
}
