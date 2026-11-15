import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI } from '@google/genai';
import { parseAccessKey44, parseCurrencyPtBr } from './fiscalDocParser';
import type { InvoiceCostNature } from '../types';

// Configura worker do PDF.js se necessário
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface ExtractedInvoiceData {
  invoiceNumber?: string;
  series?: string;
  totalAmount?: number;
  payableAmount?: number;
  supplierName?: string;
  supplierCnpjCpf?: string;
  issueDate?: string; // YYYY-MM-DD
  dueDate?: string;   // YYYY-MM-DD
  accessKey?: string;
  paymentMethod?: 'Boleto' | 'Pix' | 'Transferência' | 'Cartão' | 'Dinheiro' | 'Outro';
  paymentDetails?: string;
  description?: string;
  natureSuggestion?: InvoiceCostNature;
}

/**
 * Converte data DD/MM/AAAA ou variações para formato aceito por input[type="date"] (AAAA-MM-DD)
 */
export function convertBrDateToIso(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/AAAA ou DD.MM.AAAA ou DD-MM-AAAA (com possíveis espaços extras)
  const match4 = trimmed.match(/(\d{1,2})\s*[\/\.-]\s*(\d{1,2})\s*[\/\.-]\s*(\d{4})/);
  if (match4) {
    const day = parseInt(match4[1], 10);
    const month = parseInt(match4[2], 10);
    const year = parseInt(match4[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1990 && year <= 2099) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // DD/MM/AA (ano com 2 dígitos, ex: 15/10/26 -> 2026-10-15)
  const match2 = trimmed.match(/(\d{1,2})\s*[\/\.-]\s*(\d{1,2})\s*[\/\.-]\s*(\d{2})\b/);
  if (match2) {
    const day = parseInt(match2[1], 10);
    const month = parseInt(match2[2], 10);
    let year = parseInt(match2[3], 10);
    year = year < 50 ? 2000 + year : 1900 + year;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Formato extenso simples: "25 de Outubro de 2026"
  const monthMap: Record<string, string> = {
    janeiro: '01', jan: '01',
    fevereiro: '02', fev: '02',
    março: '03', marco: '03', mar: '03',
    abril: '04', abr: '04',
    maio: '05', mai: '05',
    junho: '06', jun: '06',
    julho: '07', jul: '07',
    agosto: '08', ago: '08',
    setembro: '09', set: '09',
    outubro: '10', out: '10',
    novembro: '11', nov: '11',
    dezembro: '12', dez: '12'
  };
  const matchExtenso = trimmed.match(/(\d{1,2})\s+de\s+([a-zçãé]+)\s+de\s+(\d{4})/i);
  if (matchExtenso) {
    const day = parseInt(matchExtenso[1], 10);
    const mName = matchExtenso[2].toLowerCase();
    const year = parseInt(matchExtenso[3], 10);
    const mNum = monthMap[mName];
    if (mNum && day >= 1 && day <= 31) {
      return `${year}-${mNum}-${String(day).padStart(2, '0')}`;
    }
  }

  return undefined;
}

/**
 * Formata CNPJ ou CPF para exibição padrão
 */
function formatCnpjCpf(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  } else if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return raw.trim();
}

/**
 * Converte Data URL (Base64) em ArrayBuffer
 */
function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Helper para extrair texto de elementos XML
 */
function getXmlTagValue(doc: Document | Element, ...tagNames: string[]): string | undefined {
  for (const tag of tagNames) {
    const els = doc.getElementsByTagName(tag);
    if (els.length > 0 && els[0].textContent) {
      return els[0].textContent.trim();
    }
  }
  return undefined;
}

/**
 * Extração de dados de arquivo XML (DANFE / NF-e / NFS-e)
 */
function parseXmlInvoice(xmlText: string): ExtractedInvoiceData | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return null;
    }

    const res: ExtractedInvoiceData = {};

    // 1. Número e Série
    const nNF = getXmlTagValue(doc, 'nNF', 'numero', 'Numero', 'NumeroNf');
    if (nNF) res.invoiceNumber = String(parseInt(nNF, 10) || nNF);

    const serie = getXmlTagValue(doc, 'serie', 'Serie');
    if (serie) res.series = String(parseInt(serie, 10) || serie);

    // 2. Chave de acesso
    const chNFe = getXmlTagValue(doc, 'chNFe', 'chaveAcesso', 'ChaveAcesso');
    if (chNFe) {
      res.accessKey = chNFe.replace(/\D/g, '');
    } else {
      const infNFe = doc.getElementsByTagName('infNFe')[0];
      if (infNFe) {
        const idAttr = infNFe.getAttribute('Id') || '';
        const cleanId = idAttr.replace(/\D/g, '');
        if (cleanId.length === 44) res.accessKey = cleanId;
      }
    }

    // Se tiver chave de acesso e não tiver número/série, extrai da chave
    if (res.accessKey && res.accessKey.length === 44) {
      const meta = parseAccessKey44(res.accessKey);
      if (meta) {
        if (!res.invoiceNumber) res.invoiceNumber = meta.docNumber;
        if (!res.series) res.series = meta.serie;
        if (!res.supplierCnpjCpf && meta.cnpj) res.supplierCnpjCpf = formatCnpjCpf(meta.cnpj);
      }
    }

    // 3. Fornecedor / Prestador (Emitente)
    const emit = doc.getElementsByTagName('emit')[0] || doc.getElementsByTagName('prestador')[0] || doc;
    const razaoSocial = getXmlTagValue(emit, 'xNome', 'razaoSocial', 'RazaoSocial', 'NomeFantasia', 'xFant');
    if (razaoSocial) res.supplierName = razaoSocial;

    const cnpjEmit = getXmlTagValue(emit, 'CNPJ', 'Cnpj', 'CPF', 'Cpf');
    if (cnpjEmit) res.supplierCnpjCpf = formatCnpjCpf(cnpjEmit);

    // 4. Valor Total
    const vNF = getXmlTagValue(doc, 'vNF', 'valorTotal', 'ValorTotal', 'vProd', 'ValorLiquido');
    if (vNF) {
      const parsedAmount = parseFloat(vNF.replace(',', '.'));
      if (!isNaN(parsedAmount)) res.totalAmount = parsedAmount;
    }

    // 5. Datas
    const dhEmi = getXmlTagValue(doc, 'dhEmi', 'dEmi', 'dataEmissao', 'DataEmissao');
    if (dhEmi) {
      const iso = convertBrDateToIso(dhEmi.split('T')[0]);
      if (iso) res.issueDate = iso;
    }

    const dVenc = getXmlTagValue(doc, 'dVenc', 'dataVencimento', 'DataVencimento');
    if (dVenc) {
      const iso = convertBrDateToIso(dVenc.split('T')[0]);
      if (iso) res.dueDate = iso;
    }

    // 6. Pagamento
    const tPag = getXmlTagValue(doc, 'tPag');
    if (tPag) {
      if (tPag === '01') res.paymentMethod = 'Dinheiro';
      else if (tPag === '03' || tPag === '04') res.paymentMethod = 'Cartão';
      else if (tPag === '15') res.paymentMethod = 'Boleto';
      else if (tPag === '17' || tPag === '20') res.paymentMethod = 'Pix';
      else if (tPag === '18') res.paymentMethod = 'Transferência';
      else res.paymentMethod = 'Outro';
    }

    return res;
  } catch (err) {
    console.warn('[invoiceExtractionService] Falha ao processar XML:', err);
    return null;
  }
}

/**
 * Sanitiza e valida o nome / Razão Social do Fornecedor / Prestador de Serviço
 * Remove rótulos técnicos de cabeçalho de NFS-e e NF-e (ex: "DA NFS-e Prestador", "PRESTADOR DE SERVIÇOS")
 * e rejeita a própria DLLOG Transportes (que é a tomadora/compradora).
 */
export function sanitizeSupplierName(raw?: string): string | undefined {
  if (!raw) return undefined;
  let clean = raw.trim();

  // Remove quebras de linha e múltiplos espaços
  clean = clean.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

  // Remove prefixos comuns de cabeçalhos fiscais no início
  clean = clean.replace(/^(?:IDENTIFICA[ÇC][ÃA]O\s+(?:DO\s+EMITENTE|DA\s+NFS-?E)?|DADOS\s+DO\s+PRESTADOR(?:\s+DE\s+SERVI[ÇC]OS?)?|PRESTADOR\s+(?:DE\s+SERVI[ÇC]OS?)?|EMITENTE|RAZ[ÃA]O\s+SOCIAL\s*\/?\s*NOME|NOME\s*\/?\s*RAZ[ÃA]O\s+SOCIAL|NOME\s+EMPRESARIAL|NOME\s+FANTASIA|DA\s+NFS-?E\s+PRESTADOR|DA\s+NFS-?E|DADOS\s+DA\s+NFS-?E)[:\s-]+/i, '');

  // Remove sufixos que foram engolidos por regex de captura (CNPJ, Inscrição, Endereço, Situação, Tomador)
  clean = clean.replace(/(?:CNPJ|CPF|INSCRI[ÇC][ÃA]O|ENDERE[ÇC]O|FONE|TELEFONE|BAIRRO|CEP|MUNIC[ÍI]PIO|UF|SITUA[ÇC][ÃA]O|TOMADOR)[\s\S]*/i, '');

  // Remove artefatos residuais no início ou no fim
  clean = clean.replace(/^(?:DA\s+NFS-?E|PRESTADOR|SITUA|SITUAÇÃO|EMITENTE)[:\s-]+/i, '');
  clean = clean.replace(/[:\s-]+(?:DA\s+NFS-?E|PRESTADOR|SITUA|SITUAÇÃO|EMITENTE)$/i, '');

  clean = clean.trim();

  const lower = clean.toLowerCase();
  const invalidExact = [
    'da nfs-e', 'nfs-e', 'nf-e', 'danfe', 'prestador', 'prestador de servicos',
    'prestador de serviços', 'tomador', 'tomador de servicos', 'tomador de serviços',
    'emitente', 'destinatario', 'destinatário', 'situacao', 'situação', 'situa',
    'da nfs-e prestador', 'da nfs-e prestador situa', 'razao social', 'razão social',
    'nome fantasia', 'nome empresarial', 'dados do prestador', 'identificacao do emitente',
    'prefeitura', 'secretaria', 'secretaria municipal', 'prefeitura municipal',
    'documento auxiliar', 'chave de acesso', 'nota fiscal', 'nota fiscal de servicos',
    'nota fiscal eletronica', 'tributacao', 'dados da nfs-e'
  ];

  if (clean.length < 3 || invalidExact.includes(lower)) {
    return undefined;
  }

  // Se o nome capturado for a própria DLLOG Transportes, descarta pois DLLOG Transportes é o Tomador (comprador)
  if (lower.includes('dllog') || lower.includes('transcunha')) {
    return undefined;
  }

  return clean;
}

/**
 * Detecta e sugere a categoria/natureza de custo a partir de termos da nota fiscal
 */
export function detectInvoiceNature(
  description?: string,
  supplierName?: string,
  fullText?: string
): InvoiceCostNature {
  const combined = `${description || ''} ${supplierName || ''} ${fullText || ''}`.toLowerCase();

  // 1. Bens e Ativos Permanentes
  if (/(?:caminh[ãa]o|carreta|cavalo\s+mec[âa]nico|ve[íi]culo|maquin[áa]rio|equipamento|computador|servidor|notebook|implemento)/i.test(combined)) {
    return 'bem';
  }
  // 2. Produtos, Combustíveis e Insumos Físicos
  if (/(?:diesel|combust[ií]vel|gasolina|etanol|arla|lubrificante|posto\b|auto\s+posto|abastecimento|shell|ipiranga|vibra|petrobras|pe[çc]a|pneu|filtro|material|suprimento|epi\b|ferramenta|almoxarifado)/i.test(combined)) {
    return 'produto';
  }
  // 3. Prestação de Serviços (inclui oficinas, mão de obra, pedágios, TI, etc.)
  if (/(?:servi[çc]o|oficina|mec[âa]nica|tornearia|auto\s+el[ée]trica|revis[ãa]o|borracharia|alinhamento|ped[áa]gio|consultoria|software|licen[çc]a|hospedagem|sistema|ti\b|assessoria|despachante|monitoramento|rastreamento|gerenciamento\s+de\s+risco|seguran[çc]a|cont[áa]bil|advocacia|honor[áa]rios|loca[çc][ãa]o)/i.test(combined)) {
    return 'servico';
  }
  return 'outros';
}

/**
 * Extração de dados via expressões regulares sobre o texto extraído de PDF/Documento
 */
function parseTextInvoice(text: string): ExtractedInvoiceData {
  const res: ExtractedInvoiceData = {};
  if (!text) return res;

  // 1. Chave de acesso de 44 dígitos (padrão NF-e / DANFE)
  const textNoSpaces = text.replace(/[\s.-]/g, '');
  const match44 = textNoSpaces.match(/\b\d{44}\b/);
  if (match44) {
    res.accessKey = match44[0];
    const meta = parseAccessKey44(res.accessKey);
    if (meta) {
      res.invoiceNumber = meta.docNumber;
      res.series = meta.serie;
      res.supplierCnpjCpf = formatCnpjCpf(meta.cnpj);
    }
  }

  // 2. Número da NF (DANFE ou NFS-e)
  if (!res.invoiceNumber) {
    const numPatterns = [
      /(?:N[úu]mero\s+(?:da\s+)?NFS-?e|N[úu]mero\s+(?:da\s+)?Nota|N[º°]\s*(?:da\s+)?NFS-?e|NFS-?e\s+N[º°]?)\s*[:.\s]*(\d+)/i,
      /(?:NOTA\s+FISCAL\s+(?:DE\s+SERVI[ÇC]OS\s+)?ELETR[ÔO]NICA[^\d\n]*?N[º°ú]?)\s*(\d+)/i,
      /(?:N[º°ú]|N[úu]mero|NF-?e|DANFE)[^\d\n]{0,20}?N[º°ú]?[^\d\n]{0,10}?(\d{1,9})\b/i,
      /\bN[º°]\s*(\d{1,9})\b/i,
      /(?:NOTA\s+FISCAL.*?N[º°ú]|DANFE.*?N[º°ú])\s*(\d{1,9})/is,
      /\bNF\s*(\d{1,9})\b/i,
      /\bNFS-e\s*(\d{1,9})\b/i,
      /DOCUMENTO\s+AUXILIAR[^\d\n]*?N[º°ú]?[^\d\n]*?(\d{1,9})/i
    ];
    for (const p of numPatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        res.invoiceNumber = String(parseInt(m[1], 10) || m[1]);
        break;
      }
    }
  }

  // 3. Série
  if (!res.series) {
    const mSerie = text.match(/\bS[ée]rie[^\d\n\r]{0,10}?([A-Z0-9]{1,4})\b/i);
    if (mSerie && mSerie[1]) {
      res.series = String(parseInt(mSerie[1], 10) || mSerie[1]);
    } else {
      res.series = '1';
    }
  }

  // 4. Valor Total Bruto e Valor a Pagar Líquido
  const amountPatterns = [
    /(?:VALOR\s+TOTAL\s+DA\s+NOTA|V\.?\s*TOTAL\s+DA\s+NOTA|VALOR\s+DOS\s+SERVI[ÇC]OS|VALOR\s+TOTAL\s+DOS\s+SERVI[ÇC]OS|VALOR\s+TOTAL\s+DOS\s+PRODUTOS|VALOR\s+TOTAL|TOTAL\s+DA\s+NOTA|TOTAL\s+GERAL|TOTAL\s+R\$)[^\d\n,.]*?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
    /(?:VALOR\s+DO\s+DOCUMENTO|VALOR\s+A\s+RECEBER|VALOR\s+COBRADO)[^\d\n,.]*?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
    /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i
  ];
  for (const p of amountPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const val = parseCurrencyPtBr(m[1]);
      if (val !== undefined && val > 0) {
        res.totalAmount = val;
        break;
      }
    }
  }

  const payablePatterns = [
    /(?:VALOR\s+L[ÍI]QUIDO(?:\s+DA\s+NFS-?E)?|TOTAL\s+L[ÍI]QUIDO|VALOR\s+L[ÍI]QUIDO|TOTAL\s+A\s+PAGAR|VALOR\s+A\s+PAGAR|VALOR\s+L[ÍI]QUIDO\s+A\s+RECEBER)[^\d\n,.]*?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i
  ];
  for (const p of payablePatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const val = parseCurrencyPtBr(m[1]);
      if (val !== undefined && val > 0) {
        res.payableAmount = val;
        break;
      }
    }
  }
  if (!res.payableAmount && res.totalAmount) {
    res.payableAmount = res.totalAmount;
  }

  // 5. Bloco Especializado de Prestador / Emitente (evita confundir com Tomador/DLLOG Transportes)
  const prestadorMatch = text.match(/(?:PRESTADOR\s+(?:DE\s+SERVI[ÇC]OS?)?|DADOS\s+DO\s+PRESTADOR|IDENTIFICA[ÇC][ÃA]O\s+DO\s+EMITENTE)[\s\S]*?(?=(?:TOMADOR|DESTINAT[ÁA]RIO|DISCRIMINA[ÇC][ÃA]O|DADOS\s+DO\s+TOMADOR|DADOS\s+DOS\s+PRODUTOS|$))/i);
  const prestadorBlock = prestadorMatch ? prestadorMatch[0] : '';

  // 5.1 CNPJ ou CPF do Prestador / Emitente
  if (!res.supplierCnpjCpf && prestadorBlock) {
    const cnpjMatch = prestadorBlock.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
    if (cnpjMatch && !cnpjMatch[0].includes('14.279.236')) {
      res.supplierCnpjCpf = cnpjMatch[0];
    } else {
      const cpfMatch = prestadorBlock.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
      if (cpfMatch) {
        res.supplierCnpjCpf = cpfMatch[0];
      }
    }
  }

  // Se não achou no bloco do prestador, busca no texto geral ignorando CNPJ da DLLOG Transportes
  if (!res.supplierCnpjCpf) {
    const allCnpjs = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g) || [];
    for (const cnpj of allCnpjs) {
      if (!cnpj.includes('14.279.236')) {
        res.supplierCnpjCpf = cnpj;
        break;
      }
    }
    if (!res.supplierCnpjCpf) {
      const cpfMatch = text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
      if (cpfMatch) res.supplierCnpjCpf = cpfMatch[0];
    }
  }

  // 5.2 Fornecedor / Razão Social / Nome Fantasia
  if (prestadorBlock) {
    const labelPatterns = [
      /(?:RAZ[ÃA]O\s+SOCIAL(?:\s*\/\s*NOME)?|NOME\s*\/\s*RAZ[ÃA]O\s+SOCIAL|NOME\s+EMPRESARIAL|NOME\s+FANTASIA)\s*[:.\s]+([^\n\r]+)/i
    ];
    for (const p of labelPatterns) {
      const m = prestadorBlock.match(p);
      if (m && m[1]) {
        const sanitized = sanitizeSupplierName(m[1]);
        if (sanitized) {
          res.supplierName = sanitized;
          break;
        }
      }
    }

    // Se não achou com rótulo no bloco do prestador, verifica as linhas do bloco
    if (!res.supplierName) {
      const lines = prestadorBlock.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (
          line.length >= 4 &&
          !line.includes('PRESTADOR') &&
          !line.includes('CNPJ') &&
          !line.includes('CPF') &&
          !line.includes('INSCRI') &&
          !line.includes('ENDERE') &&
          !line.includes('TELEFONE') &&
          !line.includes('CEP') &&
          !line.includes('MUNIC') &&
          !line.includes('PREFEITURA')
        ) {
          const sanitized = sanitizeSupplierName(line);
          if (sanitized) {
            res.supplierName = sanitized;
            break;
          }
        }
      }
    }
  }

  // Se ainda não encontrou, busca no texto completo com padrões refinados
  if (!res.supplierName) {
    const supplierPatterns = [
      /(?:RAZ[ÃA]O\s+SOCIAL(?:\s*\/\s*NOME)?|NOME\s*\/\s*RAZ[ÃA]O\s+SOCIAL|NOME\s+EMPRESARIAL)\s*[:.\s]+([A-Z0-9\s.,&'-]{3,80})/i,
      /(?:IDENTIFICA[ÇC][ÃA]O\s+DO\s+EMITENTE)\s*[:.\s\n]+([A-Z0-9\s.,&'-]{3,80})/i
    ];
    for (const p of supplierPatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const sanitized = sanitizeSupplierName(m[1]);
        if (sanitized) {
          res.supplierName = sanitized;
          break;
        }
      }
    }
  }

  // Fallback para linhas do cabeçalho de DANFE
  if (!res.supplierName) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 10)) {
      if (
        line.length >= 4 &&
        !line.includes('DANFE') &&
        !line.includes('DOCUMENTO AUXILIAR') &&
        !line.includes('NOTA FISCAL') &&
        !line.includes('CHAVE DE ACESSO') &&
        !line.includes('MINISTÉRIO') &&
        !line.includes('RECEITA FEDERAL') &&
        !line.includes('PREFEITURA') &&
        !line.includes('SECRETARIA')
      ) {
        const sanitized = sanitizeSupplierName(line);
        if (sanitized) {
          res.supplierName = sanitized;
          break;
        }
      }
    }
  }

  // 6. Data de Emissão
  const emissionPatterns = [
    /(?:DATA\s+(?:DA\s+|DE\s+)?EMISS[ÃA]O|DATA\s+EMISS[ÃA]O|DT\.?\s*EMISS[ÃA]O|EMISS[ÃA]O|EMITID[AO]\s+EM|DATA\s+E\s+HORA\s+DA\s+EMISS[ÃA]O)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:DATA\s+(?:DO\s+)?DOCUMENTO|DATA\s+DOCUMENTO|DT\.?\s*DOC\.?|DATA\s+DOC)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:DATA\s+(?:DE\s+)?PROCESSAMENTO|DATA\s+PROCESSAMENTO|PROCESSAMENTO)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:DATA\s+(?:DA\s+)?FATURA|DATA\s+FATURA|FATURA\s+EMITIDA\s+EM)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:PER[ÍI]ODO\s+DE\s+FATURAMENTO|M[ÊE]S\s+DE\s+REFER[ÊE]NCIA)[^\n\d]*?(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i
  ];
  for (const p of emissionPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const iso = convertBrDateToIso(m[1]);
      if (iso) {
        res.issueDate = iso;
        break;
      }
    }
  }

  // 7. Data de Vencimento
  const duePatterns = [
    /(?:DATA\s+(?:DO\s+|DE\s+)?VENCIMENTO|DATA\s+VENCIMENTO|VENCIMENTO|VENC\.?|DT\.?\s*VENC\.?)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:VENCER\s+EM|PAGAR\s+AT[ÉE]|PAG[ÁA]VEL\s+AT[ÉE]|DATA\s+LIMITE\s+(?:PARA\s+|DE\s+)?PAGAMENTO)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:VENCIMENTO\s+DA\s+FATURA|VENCIMENTO\s+DO\s+BOLETO|VENCIMENTO\s+PAGAMENTO)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i
  ];
  for (const p of duePatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const iso = convertBrDateToIso(m[1]);
      if (iso) {
        res.dueDate = iso;
        break;
      }
    }
  }

  // 8. Descrição dos Serviços / Produtos
  const descPatterns = [
    /(?:DISCRIMINA[ÇC][ÃA]O\s+DOS\s+SERVI[ÇC]OS|DESCRI[ÇC][ÃA]O\s+DOS\s+SERVI[ÇC]OS)\s*[:.\s\n]+([\s\S]{10,400}?)(?=(?:VALOR|RETEN|TRIBUT|INFORMA|DADOS|$))/i,
    /(?:DADOS\s+DOS\s+PRODUTOS\s*\/\s*SERVI[ÇC]OS|INFORMA[ÇC][ÕO]ES\s+COMPLEMENTARES)\s*[:.\s\n]+([\s\S]{10,400}?)(?=(?:DADOS\s+ADICIONAIS|C[ÁA]LCULO|TRANSPORTE|$))/i
  ];
  for (const p of descPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const cleanDesc = m[1].replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      if (cleanDesc.length >= 5) {
        res.description = cleanDesc.slice(0, 250);
        break;
      }
    }
  }

  // 9. Dados de Pagamento (Linha digitável de boleto ou PIX)
  const boletoMatch = text.match(/\b(\d{5}[\.\s]?\d{5}\s+\d{5}[\.\s]?\d{6}\s+\d{5}[\.\s]?\d{6}\s+\d\s+\d{14})\b/) ||
                      text.match(/\b\d{47}\b/) ||
                      text.match(/\b\d{11,12}[-\s.]?\d\s+\d{11,12}[-\s.]?\d\s+\d{11,12}[-\s.]?\d\s+\d{11,12}[-\s.]?\d\b/) ||
                      text.match(/\b\d{48}\b/);
  if (boletoMatch) {
    const decoded = parseBoletoDigitableLine(boletoMatch[0]);
    res.paymentDetails = decoded.digitableLine || boletoMatch[0].trim();
    res.paymentMethod = 'Boleto';
    if (!res.dueDate && decoded.dueDate) {
      res.dueDate = decoded.dueDate;
    }
    if ((!res.payableAmount || res.payableAmount <= 0) && decoded.payableAmount) {
      res.payableAmount = decoded.payableAmount;
    }
  } else {
    const pixMatch = text.match(/(?:Chave\s+PIX|PIX)\s*[:.\s]+([a-zA-Z0-9_\-\.\@\+]{8,60})/i);
    if (pixMatch) {
      res.paymentDetails = `Pix: ${pixMatch[1].trim()}`;
      res.paymentMethod = 'Pix';
    }
  }

  // 10. Sugestão da Natureza de Custo
  res.natureSuggestion = detectInvoiceNature(res.description, res.supplierName, text);

  return res;
}

/**
 * Chamada à API Gemini Multimodal para documentos digitalizados, imagens ou PDFs fiscais
 * Utiliza visão computacional e OCR estruturado especializado no fisco brasileiro.
 */
async function parseWithGemini(
  base64Data: string,
  mimeType: string,
  extractedText?: string
): Promise<ExtractedInvoiceData | null> {
  const apiKey =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('gemini_api_key') ||
    '';

  if (!apiKey) {
    console.warn('[invoiceExtractionService] VITE_GEMINI_API_KEY não configurada para OCR multimodal.');
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é um auditor contábil e fiscal de alta precisão especializado em documentos fiscais brasileiros (DANFE, NF-e Modelo 55, NFS-e Municipal e Padrão Nacional, NFC-e Modelo 65, Faturas e Contratos de Serviço).
Analise o documento fiscal anexado e extraia os dados com total rigor:

REGRAS ESSENCIAIS PARA O FORNECEDOR / EMITENTE:
1. O Fornecedor é QUEM EMITIU a nota (o Prestador de Serviços na NFS-e ou Emitente no DANFE).
2. NUNCA use o Tomador/Destinatário (como DLLOG Transportes e Logística) como fornecedor!
3. NUNCA extraia rótulos de colunas ou cabeçalhos fiscais como "DA NFS-e Prestador", "PRESTADOR DE SERVIÇOS", "PREFEITURA", "SITUAÇÃO DA NOTA". Extraia a RAZÃO SOCIAL REAL ou NOME FANTASIA REAL da empresa prestadora/emitente (ex: "SITUA TECNOLOGIA LTDA", "AUTO POSTO GRAAL LTDA").
4. Extraia o CNPJ ou CPF do Emitente/Prestador formatado (XX.XXX.XXX/XXXX-XX).

CAMPOS OBRIGATÓRIOS:
1. "numeroNf": Número oficial da Nota Fiscal ou NFS-e (somente dígitos, sem zeros à esquerda, ex: "16", "89240").
2. "serie": Série da nota (ex: "1", "U").
3. "valorTotal": Valor total bruto da nota em formato decimal (ex: 1114.85).
4. "valorAPagar": Valor líquido a pagar após deduções/retenções de impostos (PIS, COFINS, INSS, IR, ISS) ou igual ao valor total se não houver retenções.
5. "fornecedor": Razão Social ou Nome Fantasia completo e limpo do Fornecedor / Prestador emitente.
6. "cnpjCpfFornecedor": CNPJ ou CPF do Fornecedor / Prestador formatado.
7. "dataEmissao": Data de Emissão em "AAAA-MM-DD" (ex: "2026-09-07").
8. "dataVencimento": Data de Vencimento em "AAAA-MM-DD" (se presente em fatura, duplicata ou boleto).
9. "formaPagamento": Sugestão entre "Boleto", "Pix", "Transferência", "Cartão", "Dinheiro" ou "Outro".
10. "dadosPagamento": Linha digitável de boleto, chave Pix ou dados bancários se informados.
11. "chaveAcesso": Chave de acesso oficial de 44 dígitos se for NF-e/DANFE.
12. "descricao": Resumo conciso e claro do que foi adquirido ou dos serviços prestados (ex: "Prestação de serviços de tecnologia e rastreamento", "Abastecimento diesel S10").
13. "natureza": Uma entre "servico", "produto", "bem", "outros".

${extractedText ? `Texto das camadas digitais do documento para auditoria cruzada:\n${extractedText.slice(0, 12000)}\n` : ''}

Retorne ESTRITAMENTE um JSON válido no formato cru (sem blocos markdown \`\`\`json):
{
  "numeroNf": "16",
  "serie": "1",
  "valorTotal": 1114.85,
  "valorAPagar": 1114.85,
  "fornecedor": "Situa Tecnologia e Soluções Ltda",
  "cnpjCpfFornecedor": "12.345.678/0001-99",
  "dataEmissao": "2026-09-07",
  "dataVencimento": "2026-09-20",
  "formaPagamento": "Boleto",
  "dadosPagamento": "",
  "chaveAcesso": "",
  "descricao": "Prestação de serviços de tecnologia",
  "natureza": "servico"
}`;

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ];

    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const cleanMime = mimeType.includes('pdf') ? 'application/pdf' : (mimeType || 'image/jpeg');

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: cleanBase64
                  }
                },
                {
                  text: prompt
                }
              ]
            }
          ]
        });

        const textOutput = response.text || '';
        const cleanJson = textOutput.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        const sanitizedSupplier = sanitizeSupplierName(parsed.fornecedor);

        return {
          invoiceNumber: parsed.numeroNf ? String(parsed.numeroNf).trim() : undefined,
          series: parsed.serie ? String(parsed.serie).trim() : undefined,
          totalAmount: typeof parsed.valorTotal === 'number' ? parsed.valorTotal : parseFloat(String(parsed.valorTotal || '').replace(',', '.')) || undefined,
          payableAmount: typeof parsed.valorAPagar === 'number' ? parsed.valorAPagar : parseFloat(String(parsed.valorAPagar || '').replace(',', '.')) || undefined,
          supplierName: sanitizedSupplier,
          supplierCnpjCpf: parsed.cnpjCpfFornecedor ? formatCnpjCpf(String(parsed.cnpjCpfFornecedor)) : undefined,
          issueDate: convertBrDateToIso(parsed.dataEmissao),
          dueDate: convertBrDateToIso(parsed.dataVencimento),
          paymentMethod: parsed.formaPagamento as any,
          paymentDetails: parsed.dadosPagamento ? String(parsed.dadosPagamento).trim() : undefined,
          accessKey: parsed.chaveAcesso ? String(parsed.chaveAcesso).replace(/\D/g, '') : undefined,
          description: parsed.descricao ? String(parsed.descricao).trim() : undefined,
          natureSuggestion: (['servico', 'produto', 'bem', 'outros'] as InvoiceCostNature[]).includes(parsed.natureza)
            ? (parsed.natureza as InvoiceCostNature)
            : undefined
        };
      } catch (e) {
        console.warn(`[invoiceExtractionService] Modelo ${model} falhou:`, e);
      }
    }
  } catch (err) {
    console.error('[invoiceExtractionService] Erro ao chamar Gemini:', err);
  }
  return null;
}

/**
 * Função pública principal para extração automática e inteligente de dados de Nota Fiscal
 */
export async function extractDataFromInvoiceFile(
  fileOrBase64: File | string,
  fileName?: string
): Promise<ExtractedInvoiceData> {
  const isFile = typeof fileOrBase64 !== 'string';
  const name = isFile ? fileOrBase64.name : (fileName || 'documento');
  const lowerName = name.toLowerCase();

  let mimeType = isFile ? fileOrBase64.type : '';
  let base64String = '';

  if (isFile) {
    base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    });
  } else {
    base64String = fileOrBase64;
    const matchMime = base64String.match(/^data:(.*?);base64,/);
    if (matchMime) mimeType = matchMime[1];
  }

  // 1. Tenta extrair como XML se for arquivo .xml ou texto XML
  if (lowerName.endsWith('.xml') || mimeType.includes('xml')) {
    try {
      let xmlText = '';
      if (isFile) {
        xmlText = await fileOrBase64.text();
      } else {
        const rawBase64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;
        xmlText = atob(rawBase64);
      }
      const xmlResult = parseXmlInvoice(xmlText);
      if (xmlResult && (xmlResult.invoiceNumber || xmlResult.supplierName || xmlResult.totalAmount)) {
        console.log('[invoiceExtractionService] Dados extraídos com sucesso do XML:', xmlResult);
        return xmlResult;
      }
    } catch (e) {
      console.warn('[invoiceExtractionService] Falha ao ler XML:', e);
    }
  }

  // 2. Extrai texto das camadas de PDF via PDF.js
  let localPdfResult: ExtractedInvoiceData | null = null;
  let fullPdfText = '';
  const isPdf = lowerName.endsWith('.pdf') || mimeType.includes('pdf') || base64String.startsWith('data:application/pdf');

  if (isPdf) {
    try {
      const buffer = isFile ? await fileOrBase64.arrayBuffer() : dataUrlToArrayBuffer(base64String);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullPdfText += textContent.items.map((it: any) => it.str || '').join(' ') + '\n';
      }

      if (fullPdfText.trim().length > 10) {
        localPdfResult = parseTextInvoice(fullPdfText);

        // Enriquecimento cruzado com parseTextBoleto para faturas com boleto em anexo
        const boletoInfo = parseTextBoleto(fullPdfText);
        if (boletoInfo) {
          if (!localPdfResult.dueDate && boletoInfo.dueDate) localPdfResult.dueDate = boletoInfo.dueDate;
          if (!localPdfResult.issueDate && boletoInfo.issueDate) localPdfResult.issueDate = boletoInfo.issueDate;
          if ((!localPdfResult.totalAmount || localPdfResult.totalAmount <= 0) && boletoInfo.payableAmount) {
            localPdfResult.totalAmount = boletoInfo.payableAmount;
          }
          if ((!localPdfResult.payableAmount || localPdfResult.payableAmount <= 0) && boletoInfo.payableAmount) {
            localPdfResult.payableAmount = boletoInfo.payableAmount;
          }
          if (!localPdfResult.paymentDetails && boletoInfo.digitableLine) {
            localPdfResult.paymentDetails = boletoInfo.digitableLine;
            localPdfResult.paymentMethod = 'Boleto';
          }
          if (!localPdfResult.supplierName && boletoInfo.beneficiaryName) {
            localPdfResult.supplierName = sanitizeSupplierName(boletoInfo.beneficiaryName);
          }
          if (!localPdfResult.supplierCnpjCpf && boletoInfo.beneficiaryCnpjCpf) {
            localPdfResult.supplierCnpjCpf = boletoInfo.beneficiaryCnpjCpf;
          }
          if (!localPdfResult.invoiceNumber && boletoInfo.documentNumber) {
            localPdfResult.invoiceNumber = boletoInfo.documentNumber;
          }
        }
      }
    } catch (e) {
      console.warn('[invoiceExtractionService] Falha ao extrair texto do PDF via PDF.js:', e);
    }
  }

  // 3. IA Gemini Multimodal com Visão Computacional Direta (para máxima exatidão)
  try {
    const geminiResult = await parseWithGemini(
      base64String,
      mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
      fullPdfText || undefined
    );

    if (geminiResult) {
      // Mescla priorizando o Gemini para fornecedor (evita pegar cabeçalhos como "DA NFS-e Prestador")
      const mergedSupplier = sanitizeSupplierName(geminiResult.supplierName) || sanitizeSupplierName(localPdfResult?.supplierName);
      const mergedTotal = geminiResult.totalAmount !== undefined && geminiResult.totalAmount > 0
        ? geminiResult.totalAmount
        : localPdfResult?.totalAmount;
      const mergedPayable = geminiResult.payableAmount !== undefined && geminiResult.payableAmount > 0
        ? geminiResult.payableAmount
        : localPdfResult?.payableAmount || mergedTotal;

      const merged: ExtractedInvoiceData = {
        invoiceNumber: geminiResult.invoiceNumber || localPdfResult?.invoiceNumber,
        series: geminiResult.series || localPdfResult?.series,
        totalAmount: mergedTotal,
        payableAmount: mergedPayable,
        supplierName: mergedSupplier,
        supplierCnpjCpf: geminiResult.supplierCnpjCpf || localPdfResult?.supplierCnpjCpf,
        issueDate: geminiResult.issueDate || localPdfResult?.issueDate,
        dueDate: geminiResult.dueDate || localPdfResult?.dueDate,
        paymentMethod: geminiResult.paymentMethod || localPdfResult?.paymentMethod,
        paymentDetails: geminiResult.paymentDetails || localPdfResult?.paymentDetails,
        accessKey: geminiResult.accessKey || localPdfResult?.accessKey,
        description: geminiResult.description || localPdfResult?.description,
        natureSuggestion: geminiResult.natureSuggestion || localPdfResult?.natureSuggestion
      };

      console.log('[invoiceExtractionService] Dados fiscais extraídos com sucesso via Gemini Multimodal:', merged);
      return merged;
    }
  } catch (e) {
    console.warn('[invoiceExtractionService] Falha no Gemini Multimodal:', e);
  }

  // 4. Se o Gemini falhou ou não estava configurado, sanitiza e retorna o resultado local
  if (localPdfResult) {
    localPdfResult.supplierName = sanitizeSupplierName(localPdfResult.supplierName);
    console.log('[invoiceExtractionService] Dados extraídos via parser local estruturado:', localPdfResult);
    return localPdfResult;
  }

  return {};
}

// ====================================================================
// EXTRAÇÃO E LEITURA INTELIGENTE DE BOLETOS BANCÁRIOS PARA PAGAMENTO
// ====================================================================

export const BRAZILIAN_BANKS: Record<string, string> = {
  '001': 'Banco do Brasil',
  '003': 'Banco da Amazônia',
  '004': 'Banco do Nordeste',
  '021': 'Banestes',
  '029': 'Banco Itaú Consignado / BMG',
  '033': 'Santander',
  '041': 'Banrisul',
  '070': 'BRB - Banco de Brasília',
  '077': 'Banco Inter',
  '104': 'Caixa Econômica Federal',
  '197': 'Stone Pagamentos',
  '208': 'BTG Pactual',
  '212': 'Banco Original',
  '237': 'Bradesco',
  '260': 'Nu Pagamentos (Nubank)',
  '336': 'C6 Bank',
  '341': 'Itaú Unibanco',
  '389': 'Banco Mercantil do Brasil',
  '422': 'Banco Safra',
  '655': 'Banco Votorantim (BV)',
  '748': 'Sicredi',
  '756': 'Sicoob',
};

export interface BoletoLateFeesResult {
  isOverdue: boolean;
  overdueDays: number;
  finePercent: number;
  fineAmount: number;
  monthlyInterestPercent: number;
  dailyInterestPercent: number;
  dailyInterestAmount: number;
  interestAmount: number;
  totalLateFees: number;
  totalWithLateFees: number;
  projected30DaysTotal: number;
  explanation: string;
}

/**
 * Calcula juros de mora, multas e valor total atualizado em caso de atraso
 */
export function calculateBoletoLateFees(params: {
  nominalAmount: number;
  dueDateStr?: string;
  referenceDateStr?: string; // default: data de hoje (YYYY-MM-DD)
  finePercent?: number;
  fineAmount?: number;
  monthlyInterestPercent?: number;
  dailyInterestPercent?: number;
  dailyInterestAmount?: number;
}): BoletoLateFeesResult {
  const nominal = Number(params.nominalAmount) || 0;
  const today = params.referenceDateStr || new Date().toISOString().split('T')[0];
  const dueDate = params.dueDateStr || today;

  const dueD = new Date(dueDate + 'T00:00:00');
  const refD = new Date(today + 'T00:00:00');
  const diffTime = refD.getTime() - dueD.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  const isOverdue = diffDays > 0;

  // 1. Multa por Atraso
  let finePercent = params.finePercent !== undefined ? params.finePercent : 2; // Padrão comercial brasileiro 2%
  let fineAmount = 0;
  if (params.fineAmount !== undefined && params.fineAmount > 0) {
    fineAmount = params.fineAmount;
    finePercent = nominal > 0 ? Number(((fineAmount / nominal) * 100).toFixed(2)) : 0;
  } else if (nominal > 0 && finePercent > 0) {
    fineAmount = Number(((nominal * finePercent) / 100).toFixed(2));
  }

  // 2. Juros de Mora Diários
  const monthlyInterestPercent = params.monthlyInterestPercent !== undefined ? params.monthlyInterestPercent : 1; // Padrão 1% a.m.
  const dailyInterestPercent = params.dailyInterestPercent !== undefined
    ? params.dailyInterestPercent
    : Number((monthlyInterestPercent / 30).toFixed(4)); // ~0.0333% ao dia

  let dailyInterestAmount = 0;
  if (params.dailyInterestAmount !== undefined && params.dailyInterestAmount > 0) {
    dailyInterestAmount = params.dailyInterestAmount;
  } else if (nominal > 0 && dailyInterestPercent > 0) {
    dailyInterestAmount = Number(((nominal * (dailyInterestPercent / 100))).toFixed(2));
  }

  // 3. Juros acumulados pelos dias de atraso decorridos
  let interestAmount = 0;
  if (isOverdue && diffDays > 0) {
    if (params.dailyInterestAmount !== undefined && params.dailyInterestAmount > 0) {
      interestAmount = Number((params.dailyInterestAmount * diffDays).toFixed(2));
    } else {
      interestAmount = Number(((nominal * (dailyInterestPercent / 100)) * diffDays).toFixed(2));
    }
  }

  // Se não estiver em atraso, para pagamento hoje não incidem multa e juros
  const actualFineToday = isOverdue ? fineAmount : 0;
  const actualInterestToday = isOverdue ? interestAmount : 0;
  const totalLateFees = Number((actualFineToday + actualInterestToday).toFixed(2));
  const totalWithLateFees = Number((nominal + totalLateFees).toFixed(2));

  // Projeção simulação para 30 dias de atraso
  const projectedInterest30 = Number((dailyInterestAmount * 30).toFixed(2));
  const projected30DaysTotal = Number((nominal + fineAmount + projectedInterest30).toFixed(2));

  let explanation = '';
  if (isOverdue) {
    const [y, m, d] = dueDate.split('-');
    explanation = `Vencido há ${diffDays} dia(s) (desde ${d}/${m}/${y}). Multa: R$ ${fineAmount.toFixed(2)} (${finePercent}%) + Juros: R$ ${interestAmount.toFixed(2)} (${dailyInterestPercent}%/dia × ${diffDays}d). Total atualizado: R$ ${totalWithLateFees.toFixed(2)}.`;
  } else {
    explanation = `Boleto em dia. Regra para atraso: Multa de ${finePercent}% (R$ ${fineAmount.toFixed(2)}) + Juros de ${monthlyInterestPercent}% a.m. (R$ ${dailyInterestAmount.toFixed(2)}/dia).`;
  }

  return {
    isOverdue,
    overdueDays: diffDays,
    finePercent,
    fineAmount,
    monthlyInterestPercent,
    dailyInterestPercent,
    dailyInterestAmount,
    interestAmount,
    totalLateFees,
    totalWithLateFees,
    projected30DaysTotal,
    explanation
  };
}

export interface ExtractedBoletoData {
  payableAmount?: number;
  dueDate?: string; // YYYY-MM-DD
  issueDate?: string; // YYYY-MM-DD (Data do Documento / Emissão / Processamento)
  documentNumber?: string;
  digitableLine?: string;
  beneficiaryName?: string;
  beneficiaryCnpjCpf?: string;
  bankName?: string;
  bankCode?: string;
  finePercent?: number;
  fineAmount?: number;
  monthlyInterestPercent?: number;
  dailyInterestPercent?: number;
  dailyInterestAmount?: number;
  instructions?: string;
  lateFeesResult?: BoletoLateFeesResult;
}

/**
 * Decodifica linha digitável de boleto bancário (47 dígitos), arrecadação (48 dígitos) ou código de barras bruto (44 dígitos)
 * Extrai valor e data de vencimento (fator Febraban) e identifica banco emissor
 */
export function parseBoletoDigitableLine(raw: string): {
  digitableLine?: string;
  payableAmount?: number;
  dueDate?: string;
  bankCode?: string;
  bankName?: string;
} {
  const clean = raw.replace(/\D/g, '');

  // 1. Boleto Bancário de Cobrança Tradicional (47 dígitos)
  if (clean.length === 47) {
    const formatted = `${clean.slice(0, 5)}.${clean.slice(5, 10)} ${clean.slice(10, 15)}.${clean.slice(15, 21)} ${clean.slice(21, 26)}.${clean.slice(26, 32)} ${clean.slice(32, 33)} ${clean.slice(33, 47)}`;

    const bankCode = clean.slice(0, 3);
    const bankName = BRAZILIAN_BANKS[bankCode];

    // Campo 5 (14 dígitos): 4 dígitos do fator de vencimento + 10 dígitos de valor
    const factorStr = clean.slice(33, 37);
    const amountStr = clean.slice(37, 47);

    const factor = parseInt(factorStr, 10);
    const rawAmount = parseInt(amountStr, 10);
    const payableAmount = rawAmount > 0 ? Number((rawAmount / 100).toFixed(2)) : undefined;

    let dueDate: string | undefined = undefined;
    if (factor > 0) {
      // Regra Febraban:
      // Ciclo 2: A partir de 22/02/2025, o fator 1000 corresponde a 22/02/2025
      const baseCiclo2 = new Date(Date.UTC(2025, 1, 22));
      const days = factor - 1000;
      const targetDate = new Date(baseCiclo2.getTime() + days * 86400000);

      const y = targetDate.getUTCFullYear();
      const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(targetDate.getUTCDate()).padStart(2, '0');
      dueDate = `${y}-${m}-${d}`;
    }

    return {
      digitableLine: formatted,
      payableAmount,
      dueDate,
      bankCode,
      bankName
    };
  }

  // 2. Boleto de Concessionária / Tributos / Arrecadação (48 dígitos)
  if (clean.length === 48 && clean.startsWith('8')) {
    const formatted = `${clean.slice(0, 11)}-${clean.slice(11, 12)} ${clean.slice(12, 23)}-${clean.slice(23, 24)} ${clean.slice(24, 35)}-${clean.slice(35, 36)} ${clean.slice(36, 47)}-${clean.slice(47, 48)}`;
    const rawValStr = clean.slice(4, 15);
    const rawAmount = parseInt(rawValStr, 10);
    const payableAmount = rawAmount > 0 ? Number((rawAmount / 100).toFixed(2)) : undefined;

    return {
      digitableLine: formatted,
      payableAmount,
      bankName: 'Concessionária / Tributos'
    };
  }

  // 3. Código de Barras Bruto (44 dígitos numéricos)
  if (clean.length === 44) {
    const bankCode = clean.slice(0, 3);
    const bankName = BRAZILIAN_BANKS[bankCode];
    const factorStr = clean.slice(5, 9);
    const amountStr = clean.slice(9, 19);

    const factor = parseInt(factorStr, 10);
    const rawAmount = parseInt(amountStr, 10);
    const payableAmount = rawAmount > 0 ? Number((rawAmount / 100).toFixed(2)) : undefined;

    let dueDate: string | undefined = undefined;
    if (factor > 0) {
      const baseCiclo2 = new Date(Date.UTC(2025, 1, 22));
      const days = factor - 1000;
      const targetDate = new Date(baseCiclo2.getTime() + days * 86400000);

      const y = targetDate.getUTCFullYear();
      const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(targetDate.getUTCDate()).padStart(2, '0');
      dueDate = `${y}-${m}-${d}`;
    }

    return {
      digitableLine: clean,
      payableAmount,
      dueDate,
      bankCode,
      bankName
    };
  }

  return {};
}

/**
 * Extração de dados de boleto bancário via expressões regulares sobre o texto
 */
function parseTextBoleto(text: string): ExtractedBoletoData {
  const res: ExtractedBoletoData = {};
  if (!text) return res;

  // 1. Linha Digitável
  const matchLinha = text.match(/\b\d{5}[\.\s]?\d{5}\s+\d{5}[\.\s]?\d{6}\s+\d{5}[\.\s]?\d{6}\s+\d\s+\d{14}\b/) ||
                     text.match(/\b\d{47}\b/) ||
                     text.match(/\b\d{11,12}[-\s.]?\d\s+\d{11,12}[-\s.]?\d\s+\d{11,12}[-\s.]?\d\s+\d{11,12}[-\s.]?\d\b/) ||
                     text.match(/\b\d{48}\b/) ||
                     text.match(/\b\d{44}\b/);

  if (matchLinha) {
    const decoded = parseBoletoDigitableLine(matchLinha[0]);
    if (decoded.digitableLine) res.digitableLine = decoded.digitableLine;
    if (decoded.payableAmount !== undefined && decoded.payableAmount > 0) res.payableAmount = decoded.payableAmount;
    if (decoded.dueDate) res.dueDate = decoded.dueDate;
    if (decoded.bankCode) res.bankCode = decoded.bankCode;
    if (decoded.bankName) res.bankName = decoded.bankName;
  }

  // 2. Data de Vencimento explícita no texto
  const duePatterns = [
    /(?:(?:Data\s+(?:do\s+)?)?Vencimento|Data\s+Venc\.|Vencimento|Venc\.|Vencer\s+em|Pagar\s+at[ée]|Data\s+Limite\s+(?:para\s+)?Pagamento|Vencimento\s+do\s+Boleto|Vencimento\s+da\s+Fatura)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:Vencimento|Data\s+do\s+Vencimento)[\s\r\n]+(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i
  ];
  for (const p of duePatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const iso = convertBrDateToIso(m[1]);
      if (iso) {
        res.dueDate = iso; // Data textual do boleto tem prioridade máxima
        break;
      }
    }
  }

  // 3. Data de Emissão / Data do Documento / Data de Processamento
  const issuePatterns = [
    /(?:Data\s+(?:do\s+)?Documento|Data\s+Documento|Dt\.?\s*Doc\.?|Data\s+(?:de\s+)?Emiss[ãa]o|Data\s+Emiss[ãa]o|Dt\.?\s*Emiss[ãa]o|Emiss[ãa]o|Emitido\s+em)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:Data\s+(?:de\s+)?Processamento|Data\s+Processamento|Processamento)\s*[:.\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:Data\s+(?:do\s+)?Documento|Data\s+de\s+Processamento|Data\s+de\s+Emiss[ãa]o)[\s\r\n]+(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i
  ];
  for (const p of issuePatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const iso = convertBrDateToIso(m[1]);
      if (iso) {
        res.issueDate = iso;
        break;
      }
    }
  }

  // 4. Número do Documento / Seu Número / Nosso Número
  const docNumPatterns = [
    /(?:N[úu]mero\s+(?:do\s+)?Documento|N[º°]\s+(?:do\s+)?Documento|No\s+Documento|Seu\s+N[úu]mero|Nosso\s+N[úu]mero)\s*[:.\s]*([A-Z0-9\/-]{3,30})/i,
    /(?:N[úu]mero\s+do\s+Documento)[\s\r\n]+([A-Z0-9\/-]{3,30})/i
  ];
  for (const p of docNumPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const clean = m[1].trim();
      if (clean && !res.documentNumber) {
        res.documentNumber = clean;
        break;
      }
    }
  }

  // 5. Valor a Pagar explícito no texto
  const valPatterns = [
    /(?:(?:\(=\)\s*)?Valor\s+(?:do\s+)?Documento|Valor\s+Cobrado|Valor\s+a\s+Pagar|Valor\s+Documento|Valor\s+Nominal|Valor\s+L[íi]quido|Total\s+a\s+Pagar)\s*[:.\s]*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
    /(?:Valor\s+do\s+Boleto|Total\s+do\s+Boleto)\s*[:.\s]*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
    /(?:\(=\)\s*VALOR\s+DO\s+DOCUMENTO)[^\d\n,.]*?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i
  ];
  for (const p of valPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const parsed = parseCurrencyPtBr(m[1]);
      if (parsed !== undefined && parsed > 0) {
        res.payableAmount = parsed; // Valor explícito do boleto tem prioridade
        break;
      }
    }
  }

  // 6. Beneficiário / Cedente
  const benPatterns = [
    /(?:Benefici[áa]rio|Cedente|Nome\s+do\s+Benefici[áa]rio|Raz[ãa]o\s+Social)\s*[:.\s]+([A-Z0-9\s.,&'-]{3,80})/i,
    /(?:Pagador\s*\/)?Benefici[áa]rio\s*[:.\s\n]+([A-Z0-9\s.,&'-]{3,80})/i
  ];
  for (const p of benPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const clean = m[1].replace(/(?:CNPJ|CPF|ENDERE|AG[ÊE]NCIA|CONTA|DATA)[\s\S]*/i, '').trim();
      if (clean.length >= 3) {
        res.beneficiaryName = clean;
        break;
      }
    }
  }

  // 7. CNPJ / CPF do Beneficiário
  const cnpjCpfMatch = text.match(/(?:CNPJ|CPF)(?:\s+(?:do\s+)?Benefici[áa]rio)?\s*[:.\s]*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i);
  if (cnpjCpfMatch && cnpjCpfMatch[1]) {
    res.beneficiaryCnpjCpf = formatCnpjCpf(cnpjCpfMatch[1]);
  }

  // 8. MULTAS E JUROS POR ATRASO (Instruções e Regras Financeiras)
  // A. Multa por Atraso (%)
  const finePercentPatterns = [
    /(?:cobrar\s+)?multa\s+(?:de\s+)?(?:ap[óo]s\s+(?:o\s+)?vencimento\s+(?:de\s+)?)?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i,
    /(?:ap[óo]s\s+(?:o\s+)?vencimento\s+(?:cobrar\s+)?multa\s+(?:de\s+)?)(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i,
    /(?:multa\s+ap[óo]s\s+vencimento|multa\s+por\s+atraso|multa\s+rescis[óo]ria)\s*[:.\s]*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i,
    /(?:multa)\s*[:.\s]*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i
  ];
  for (const p of finePercentPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(val) && val > 0 && val <= 30) {
        res.finePercent = val;
        break;
      }
    }
  }

  // B. Multa por Atraso em valor fixo R$
  const fineAmountPatterns = [
    /(?:cobrar\s+)?multa\s+(?:de\s+)?(?:ap[óo]s\s+(?:o\s+)?vencimento\s+(?:de\s+)?)?(?:R\$\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
    /(?:ap[óo]s\s+(?:o\s+)?vencimento\s+(?:cobrar\s+)?multa\s+(?:de\s+)?)(?:R\$\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
    /(?:multa\s+ap[óo]s\s+vencimento|multa\s+por\s+atraso)\s*[:.\s]*(?:R\$\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i
  ];
  for (const p of fineAmountPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const val = parseCurrencyPtBr(m[1]);
      if (val !== undefined && val > 0) {
        res.fineAmount = val;
        break;
      }
    }
  }

  // C. Juros em R$ por dia de atraso
  const dailyAmountPatterns = [
    /(?:juros\s+(?:de\s+mora\s+)?(?:de\s+)?|mora\s+di[áa]ria\s+(?:de\s+)?|cobrar\s+)(?:R\$\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(?:por\s+dia|ao\s+dia|di[áa]rios?|p\/\s*dia)/i,
    /(?:cobrar\s+juros\s+de\s+)(?:R\$\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+por\s+dia\s+de\s+atraso/i,
    /(?:mora\s+di[áa]ria\s*[:.\s]+)(?:R\$\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
    /(?:ap[óo]s\s+(?:o\s+)?vencimento\s+cobrar\s+)(?:R\$\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(?:por\s+dia|ao\s+dia)/i
  ];
  for (const p of dailyAmountPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const val = parseCurrencyPtBr(m[1]);
      if (val !== undefined && val > 0) {
        res.dailyInterestAmount = val;
        break;
      }
    }
  }

  // D. Juros em % ao dia
  const dailyPercentPatterns = [
    /(?:juros\s+(?:de\s+mora\s+)?(?:de\s+)?|mora\s+(?:de\s+)?)(\d{1,2}(?:[.,]\d{1,3})?)\s*%\s*(?:ao\s+dia|a\.?d\.?|por\s+dia|di[áa]rios?)/i,
    /(?:mora\s+di[áa]ria\s*[:.\s]*)(\d{1,2}(?:[.,]\d{1,3})?)\s*%/i
  ];
  for (const p of dailyPercentPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(val) && val > 0 && val <= 5) {
        res.dailyInterestPercent = val;
        break;
      }
    }
  }

  // E. Juros em % ao mês
  const monthlyPercentPatterns = [
    /(?:juros\s+(?:de\s+mora\s+)?(?:de\s+)?|mora\s+(?:de\s+)?)(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:ao\s+m[êe]s|a\.?m\.?|mensais?)/i,
    /(?:juros\s+mensais\s*[:.\s]*)(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i
  ];
  for (const p of monthlyPercentPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(val) && val > 0 && val <= 20) {
        res.monthlyInterestPercent = val;
        break;
      }
    }
  }

  // F. Instruções literais do boleto
  const instMatch = text.match(/(?:instru[çc][õo]es(?:\s+de\s+cobran[çc]a)?|texto\s+de\s+responsabilidade\s+do\s+benefici[áa]rio|informa[çc][õo]es\s+de\s+responsabilidade\s+do\s+cedente)\s*[:.\s\n]+([\s\S]{10,400}?)(?=(?:autentica|recibo|dados\s+do\s+pagador|c[óo]digo\s+de\s+barras|ficha\s+de\s+compensa|linha\s+digit|sac\s+|ouvidoria|$))/i);
  if (instMatch && instMatch[1]) {
    res.instructions = instMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 9. Cálculo Imediato dos Encargos por Atraso
  if (res.payableAmount && res.dueDate) {
    res.lateFeesResult = calculateBoletoLateFees({
      nominalAmount: res.payableAmount,
      dueDateStr: res.dueDate,
      finePercent: res.finePercent,
      fineAmount: res.fineAmount,
      monthlyInterestPercent: res.monthlyInterestPercent,
      dailyInterestPercent: res.dailyInterestPercent,
      dailyInterestAmount: res.dailyInterestAmount
    });
  }

  return res;
}

/**
 * Chamada à API Gemini Multimodal para reconhecimento visual de Boleto Bancário
 */
async function parseBoletoWithGemini(
  base64Data: string,
  mimeType: string
): Promise<ExtractedBoletoData | null> {
  const apiKey =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('gemini_api_key') ||
    '';

  if (!apiKey) {
    console.warn('[invoiceExtractionService] VITE_GEMINI_API_KEY não configurada para OCR de boleto.');
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é um auditor financeiro especialista em conferência de Boletos Bancários e Títulos de Cobrança brasileiros (Febraban / Concessionárias).
Analise com extrema atenção a imagem/PDF do boleto bancário anexado e extraia com precisão máxima:
1. "valorAPagar": Valor nominal/cobrado do boleto em decimal (ex: 1250.00, sem R$)
2. "dataVencimento": Data de vencimento no formato "AAAA-MM-DD" (ex: "2026-10-25")
3. "dataEmissao": Data do documento, data de emissão ou data de processamento no formato "AAAA-MM-DD" (ex: "2026-10-10")
4. "numeroDocumento": Número do documento, número da fatura, seu número ou nosso número se visível (ex: "89240")
5. "linhaDigitavel": Linha digitável completa com pontuações (ex: "34191.09008 00000.282119 00818.989004 5 98760000150000")
6. "beneficiario": Razão Social ou Nome do Beneficiário / Cedente
7. "cnpjCpfBeneficiario": CNPJ ou CPF do Beneficiário formatado
8. "banco": Nome do banco emissor se visível (ex: Itaú, Bradesco, Santander, Banco do Brasil, Caixa, Sicredi, etc.)
9. "multaPercentual": Percentual de multa por atraso após o vencimento em decimal (ex: 2.0 se disser "multa de 2%")
10. "multaValor": Valor em R$ fixo de multa se especificado
11. "jurosPercentualMes": Percentual de juros ao mês em decimal (ex: 1.0 se disser "1% ao mês")
12. "jurosValorDia": Valor de juros de mora diário em R$ por dia de atraso se informado (ex: 0.83)
13. "instrucoesCobranca": Texto literal das instruções de cobrança de multas e juros por atraso

Retorne ESTRITAMENTE um JSON válido no formato cru (sem markdown ou blocos de código \`\`\`json):
{
  "valorAPagar": 1250.00,
  "dataVencimento": "2026-10-25",
  "dataEmissao": "2026-10-10",
  "numeroDocumento": "89240",
  "linhaDigitavel": "34191.09008 00000.282119 00818.989004 5 98760000150000",
  "beneficiario": "Posto Graal Parada Real",
  "cnpjCpfBeneficiario": "12.345.678/0001-99",
  "banco": "Itaú",
  "multaPercentual": 2.0,
  "multaValor": 25.00,
  "jurosPercentualMes": 1.0,
  "jurosValorDia": 0.83,
  "instrucoesCobranca": "Após o vencimento cobrar multa de 2% e juros de 1% ao mês."
}`;

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ];

    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const cleanMime = mimeType.includes('pdf') ? 'application/pdf' : (mimeType || 'image/jpeg');

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: cleanBase64
                  }
                },
                {
                  text: prompt
                }
              ]
            }
          ]
        });

        const textOutput = response.text || '';
        const cleanJson = textOutput.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        const valNominal = typeof parsed.valorAPagar === 'number' ? parsed.valorAPagar : parseFloat(String(parsed.valorAPagar || '').replace(',', '.')) || undefined;
        const due = convertBrDateToIso(parsed.dataVencimento);
        const fPercent = typeof parsed.multaPercentual === 'number' ? parsed.multaPercentual : parseFloat(String(parsed.multaPercentual || '').replace(',', '.')) || undefined;
        const fAmount = typeof parsed.multaValor === 'number' ? parsed.multaValor : parseFloat(String(parsed.multaValor || '').replace(',', '.')) || undefined;
        const mInterest = typeof parsed.jurosPercentualMes === 'number' ? parsed.jurosPercentualMes : parseFloat(String(parsed.jurosPercentualMes || '').replace(',', '.')) || undefined;
        const dInterest = typeof parsed.jurosValorDia === 'number' ? parsed.jurosValorDia : parseFloat(String(parsed.jurosValorDia || '').replace(',', '.')) || undefined;

        let lateFeesResult: BoletoLateFeesResult | undefined = undefined;
        if (valNominal && due) {
          lateFeesResult = calculateBoletoLateFees({
            nominalAmount: valNominal,
            dueDateStr: due,
            finePercent: fPercent,
            fineAmount: fAmount,
            monthlyInterestPercent: mInterest,
            dailyInterestAmount: dInterest
          });
        }

        return {
          payableAmount: valNominal,
          dueDate: due,
          issueDate: convertBrDateToIso(parsed.dataEmissao),
          documentNumber: parsed.numeroDocumento ? String(parsed.numeroDocumento).trim() : undefined,
          digitableLine: parsed.linhaDigitavel ? String(parsed.linhaDigitavel).trim() : undefined,
          beneficiaryName: parsed.beneficiario ? String(parsed.beneficiario).trim() : undefined,
          beneficiaryCnpjCpf: parsed.cnpjCpfBeneficiario ? formatCnpjCpf(String(parsed.cnpjCpfBeneficiario)) : undefined,
          bankName: parsed.banco ? String(parsed.banco).trim() : undefined,
          finePercent: fPercent,
          fineAmount: fAmount,
          monthlyInterestPercent: mInterest,
          dailyInterestAmount: dInterest,
          instructions: parsed.instrucoesCobranca ? String(parsed.instrucoesCobranca).trim() : undefined,
          lateFeesResult
        };
      } catch (e) {
        console.warn(`[invoiceExtractionService] Modelo ${model} para boleto falhou:`, e);
      }
    }
  } catch (err) {
    console.error('[invoiceExtractionService] Erro ao chamar Gemini para boleto:', err);
  }
  return null;
}

/**
 * Função pública principal para extração automática de dados de Boleto Bancário para Pagamento
 */
export async function extractDataFromBoletoFile(
  fileOrBase64: File | string,
  fileName?: string
): Promise<ExtractedBoletoData> {
  const isFile = typeof fileOrBase64 !== 'string';
  const name = isFile ? fileOrBase64.name : (fileName || 'boleto');
  const lowerName = name.toLowerCase();

  let mimeType = isFile ? fileOrBase64.type : '';
  let base64String = '';

  if (isFile) {
    base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    });
  } else {
    base64String = fileOrBase64;
    const matchMime = base64String.match(/^data:(.*?);base64,/);
    if (matchMime) mimeType = matchMime[1];
  }

  let localPdfResult: ExtractedBoletoData | null = null;
  const isPdf = lowerName.endsWith('.pdf') || mimeType.includes('pdf') || base64String.startsWith('data:application/pdf');

  // 1. Tenta extrair texto de PDF via PDF.js
  if (isPdf) {
    try {
      const buffer = isFile ? await fileOrBase64.arrayBuffer() : dataUrlToArrayBuffer(base64String);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((it: any) => it.str || '').join(' ') + '\n';
      }

      if (fullText.trim().length > 10) {
        localPdfResult = parseTextBoleto(fullText);
        // Enriquecimento cruzado com parseTextInvoice caso tenha dados da fatura/cabeçalho
        const invoiceComplement = parseTextInvoice(fullText);
        if (invoiceComplement) {
          if (!localPdfResult.issueDate && invoiceComplement.issueDate) {
            localPdfResult.issueDate = invoiceComplement.issueDate;
          }
          if (!localPdfResult.dueDate && invoiceComplement.dueDate) {
            localPdfResult.dueDate = invoiceComplement.dueDate;
          }
          if (!localPdfResult.documentNumber && invoiceComplement.invoiceNumber) {
            localPdfResult.documentNumber = invoiceComplement.invoiceNumber;
          }
          if (!localPdfResult.beneficiaryName && invoiceComplement.supplierName) {
            localPdfResult.beneficiaryName = invoiceComplement.supplierName;
          }
          if (!localPdfResult.beneficiaryCnpjCpf && invoiceComplement.supplierCnpjCpf) {
            localPdfResult.beneficiaryCnpjCpf = invoiceComplement.supplierCnpjCpf;
          }
        }

        // Recalcula lateFeesResult com dados enriquecidos se necessário
        if (localPdfResult.payableAmount && localPdfResult.dueDate) {
          localPdfResult.lateFeesResult = calculateBoletoLateFees({
            nominalAmount: localPdfResult.payableAmount,
            dueDateStr: localPdfResult.dueDate,
            finePercent: localPdfResult.finePercent,
            fineAmount: localPdfResult.fineAmount,
            monthlyInterestPercent: localPdfResult.monthlyInterestPercent,
            dailyInterestPercent: localPdfResult.dailyInterestPercent,
            dailyInterestAmount: localPdfResult.dailyInterestAmount
          });
        }
      }
    } catch (e) {
      console.warn('[invoiceExtractionService] Falha ao extrair texto do PDF do boleto:', e);
    }
  }

  // Se o parser local já obteve o vencimento e o valor (ou emissão), retorna imediatamente
  if (
    localPdfResult &&
    (localPdfResult.dueDate || localPdfResult.issueDate) &&
    (localPdfResult.payableAmount !== undefined || localPdfResult.digitableLine)
  ) {
    console.log('[invoiceExtractionService] Dados do boleto extraídos com sucesso do PDF local:', localPdfResult);
    return localPdfResult;
  }

  // 2. Fallback inteligente com IA Gemini Multimodal (para scans, fotos ou PDFs rasterizados)
  try {
    const geminiResult = await parseBoletoWithGemini(base64String, mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'));
    if (geminiResult) {
      const mergedPayable = geminiResult.payableAmount !== undefined ? geminiResult.payableAmount : localPdfResult?.payableAmount;
      const mergedDue = geminiResult.dueDate || localPdfResult?.dueDate;
      const mergedFinePercent = geminiResult.finePercent !== undefined ? geminiResult.finePercent : localPdfResult?.finePercent;
      const mergedFineAmount = geminiResult.fineAmount !== undefined ? geminiResult.fineAmount : localPdfResult?.fineAmount;
      const mergedMonthlyInterest = geminiResult.monthlyInterestPercent !== undefined ? geminiResult.monthlyInterestPercent : localPdfResult?.monthlyInterestPercent;
      const mergedDailyInterest = geminiResult.dailyInterestAmount !== undefined ? geminiResult.dailyInterestAmount : localPdfResult?.dailyInterestAmount;

      let mergedLateFees: BoletoLateFeesResult | undefined = undefined;
      if (mergedPayable && mergedDue) {
        mergedLateFees = calculateBoletoLateFees({
          nominalAmount: mergedPayable,
          dueDateStr: mergedDue,
          finePercent: mergedFinePercent,
          fineAmount: mergedFineAmount,
          monthlyInterestPercent: mergedMonthlyInterest,
          dailyInterestAmount: mergedDailyInterest
        });
      }

      const merged: ExtractedBoletoData = {
        payableAmount: mergedPayable,
        dueDate: mergedDue,
        issueDate: geminiResult.issueDate || localPdfResult?.issueDate,
        documentNumber: geminiResult.documentNumber || localPdfResult?.documentNumber,
        digitableLine: geminiResult.digitableLine || localPdfResult?.digitableLine,
        beneficiaryName: geminiResult.beneficiaryName || localPdfResult?.beneficiaryName,
        beneficiaryCnpjCpf: geminiResult.beneficiaryCnpjCpf || localPdfResult?.beneficiaryCnpjCpf,
        bankName: geminiResult.bankName || localPdfResult?.bankName,
        bankCode: geminiResult.bankCode || localPdfResult?.bankCode,
        finePercent: mergedFinePercent,
        fineAmount: mergedFineAmount,
        monthlyInterestPercent: mergedMonthlyInterest,
        dailyInterestAmount: mergedDailyInterest,
        instructions: geminiResult.instructions || localPdfResult?.instructions,
        lateFeesResult: mergedLateFees || geminiResult.lateFeesResult || localPdfResult?.lateFeesResult
      };

      console.log('[invoiceExtractionService] Dados do boleto extraídos com sucesso via Gemini Multimodal:', merged);
      return merged;
    }
  } catch (e) {
    console.warn('[invoiceExtractionService] Falha no Gemini Multimodal para boleto:', e);
  }

  if (localPdfResult) {
    return localPdfResult;
  }

  return {};
}

