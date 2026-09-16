import * as pdfjsLib from 'pdfjs-dist';
import { FreightBalanceCalculation, calculateFreightBalance } from './freightBalanceCalculator';

export type { FreightBalanceCalculation };
export { calculateFreightBalance };

// Configuração do Worker do PDF.js para ambiente de navegador/Vite
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface DetailedDocumentData {
  documentType: 'CT-e' | 'MDF-e' | 'Carta Frete' | 'Nota Fiscal' | 'CIOT' | 'Outro';
  rawText?: string;
  sourceType: 'xml' | 'pdf' | 'text';
  
  // Identificação
  docNumber?: string;
  series?: string;
  accessKey?: string;
  emissionDate?: string;
  cfop?: string;
  naturezaOperacao?: string;
  ciot?: string;
  protocoloAutorizacao?: string;

  // Cláusula 3.5: Base de Cálculo do Saldo de Frete (PF / PJ)
  calculoSaldoFrete?: FreightBalanceCalculation;

  // Envolvidos
  emitente?: {
    razaoSocial?: string;
    nomeFantasia?: string;
    cnpjCpf?: string;
    inscricaoEstadual?: string;
    municipio?: string;
    uf?: string;
  };
  remetente?: {
    razaoSocial?: string;
    cnpjCpf?: string;
    inscricaoEstadual?: string;
    municipio?: string;
    uf?: string;
  };
  destinatario?: {
    razaoSocial?: string;
    cnpjCpf?: string;
    inscricaoEstadual?: string;
    municipio?: string;
    uf?: string;
  };
  tomador?: {
    razaoSocial?: string;
    cnpjCpf?: string;
    papel?: string; // Remetente, Destinatário, Expedidor, etc.
  };
  motorista?: {
    nome?: string;
    cpf?: string;
    cnh?: string;
  };

  // Trajeto e Transporte
  origem?: {
    municipio?: string;
    uf?: string;
  };
  destino?: {
    municipio?: string;
    uf?: string;
  };
  veiculo?: {
    placaTrator?: string;
    placasReboque?: string[];
    rntrc?: string;
    tipo?: string;
    ufPlaca?: string;
  };

  // Carga e Pesos
  carga?: {
    produtoPredominante?: string;
    valorMercadoria?: number;
    pesoBrutoKg?: number;
    pesoLiquidoKg?: number;
    pesoAferidoKg?: number;
    quantidadeVolumes?: number;
    especie?: string;
    cubagem?: number;
  };

  // Valores Financeiros do Frete / Contrato
  financeiro?: {
    valorTotalFrete?: number;
    valorLiquido?: number;
    valorReceber?: number;
    valorAdiantamento?: number;
    porcentagemAdiantamento?: number;
    valorSaldo?: number;
    valorPedagio?: number;
    valorCombustivel?: number;
    descontos?: number;
    baseCalculoIcms?: number;
    valorIcms?: number;
    aliquotaIcms?: number;
    valorPis?: number;
    aliquotaPis?: number;
    valorCofins?: number;
    aliquotaCofins?: number;
    valorPisCofinsFederal?: number;
    valorTributosFederais?: number;
    formaPagamento?: string;
    dadosBancarios?: string;
    chavePix?: string;
  };

  // Seguro
  seguro?: {
    nomeSeguradora?: string;
    numeroApolice?: string;
    numeroAverbacao?: string;
    responsavelSeguro?: string;
  };

  // Observações e Informações Fiscais Adicionais (ex: infAdFisco, infCpl)
  observacoesFiscais?: string;
  suspensaoPercentual?: number;

  // Documentos vinculados
  documentosVinculados?: Array<{
    tipo: string;
    chaveAcesso?: string;
    numero?: string;
    serie?: string;
  }>;
}

export function parseAccessKey44(accessKey: string | undefined | null) {
  if (!accessKey) return null;
  const clean = accessKey.replace(/[\s.-]/g, '');
  if (clean.length !== 44) return null;

  const cUF = clean.substring(0, 2);
  const aamm = clean.substring(2, 6);
  const cnpj = clean.substring(6, 20);
  const modelo = clean.substring(20, 22);
  const serieRaw = clean.substring(22, 25);
  const serie = String(parseInt(serieRaw, 10) || serieRaw);
  const docNumberRaw = clean.substring(25, 34);
  const docNumber = String(parseInt(docNumberRaw, 10) || docNumberRaw);

  let docType: 'CT-e' | 'MDF-e' | 'Nota Fiscal' = 'CT-e';
  if (modelo === '58') docType = 'MDF-e';
  else if (modelo === '55' || modelo === '65') docType = 'Nota Fiscal';
  else if (modelo === '57' || modelo === '67') docType = 'CT-e';

  return { cUF, aamm, cnpj, modelo, serie, docNumber, docType };
}

export function isCartaFreteDocType(docType: string): boolean {
  if (!docType) return false;
  const lower = docType.toLowerCase().trim();
  return lower.includes('carta') || lower.includes('frete') || lower.includes('contrato') || lower.includes('efrete') || lower.includes('e-frete') || lower.includes('pamcard') || lower.includes('repom');
}

export function isMdfeDocType(docType: string): boolean {
  if (!docType) return false;
  const lower = docType.toLowerCase().trim();
  return lower.includes('mdfe') || lower.includes('mdf-e') || lower.includes('damdfe') || lower.includes('damfe') || lower.includes('manifesto');
}

export function isNfeDocType(docType: string): boolean {
  if (!docType) return false;
  const lower = docType.toLowerCase().trim();
  if (isCartaFreteDocType(lower) || isMdfeDocType(lower) || isCteDocType(lower)) {
    return false;
  }
  return lower === 'nfe' || lower === 'nf-e' || lower.includes('danfe') || lower.includes('nota fiscal') || lower.includes('nnota') || lower === 'nota';
}

export function isCteDocType(docType: string): boolean {
  if (!docType) return false;
  const lower = docType.toLowerCase().trim();
  if (isCartaFreteDocType(lower) || isMdfeDocType(lower)) {
    return false;
  }
  return lower === 'cte' || lower === 'ct-e' || lower.includes('dacte') || lower.includes('conhecimento');
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}

export async function extractTextFromPdfBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (err) {
    console.warn('[fiscalDocParser] Erro na extração PDF.js:', err);
    try {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(arrayBuffer);
    } catch {
      return '';
    }
  }
}

function getXmlTagValue(doc: Document | Element, ...tagNames: string[]): string | undefined {
  for (const tag of tagNames) {
    const els = doc.getElementsByTagName(tag);
    if (els.length > 0 && els[0].textContent) {
      return els[0].textContent.trim();
    }
  }
  return undefined;
}

export function formatFiscalDateTime(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const matchIso = val.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (matchIso) {
    return `${matchIso[3]}/${matchIso[2]}/${matchIso[1]} ${matchIso[4]}:${matchIso[5]}`;
  }
  const matchPt = val.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}:\d{2})?/);
  if (matchPt) {
    return matchPt[4] ? `${matchPt[1]}/${matchPt[2]}/${matchPt[3]} ${matchPt[4]}` : `${matchPt[1]}/${matchPt[2]}/${matchPt[3]}`;
  }
  return val;
}

export function parseCurrencyPtBr(str: string | undefined | null): number | undefined {
  if (!str) return undefined;
  const clean = String(str).replace(/[^\d.,]/g, '').trim();
  if (!clean) return undefined;

  if (clean.includes(',') && clean.includes('.')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? undefined : num;
  } else if (clean.includes(',')) {
    const normalized = clean.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? undefined : num;
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 2 && parts[1].length === 2) {
      const num = parseFloat(clean);
      return isNaN(num) ? undefined : num;
    } else {
      const normalized = clean.replace(/\./g, '');
      const num = parseFloat(normalized);
      return isNaN(num) ? undefined : num;
    }
  } else {
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
  }
}

export function parseWeightKg(str: string | undefined | null): number | undefined {
  if (!str) return undefined;
  const val = parseCurrencyPtBr(str);
  return val;
}

function cleanLegalEntityName(str: string | undefined | null): string | undefined {
  if (!str) return undefined;
  let clean = str
    .replace(/^(?:NOME\s*\/|RAZ[ÃA]O\s+SOCIAL\s*\/|NOME\s+EMPRESARIAL\s*:?|RAZ[ÃA]O\s+SOCIAL\s*:?|EMITENTE\s*:?|DESTINAT[ÁA]RIO\s*:?|REMETENTE\s*:?|EXPEDIDOR\s*:?|RECEBEDOR\s*:?|TRANSPORTADOR\s*:?)+/i, '')
    .replace(/(?:CNPJ|CPF|INSCRI[ÇC][ÃA]O|IE|FONE|TELEFONE|ENDERE[ÇC]O|LOGRADOURO|BAIRRO|CEP|MUNIC[ÍI]PIO|CIDADE|UF)[\s\S]*/i, '')
    .replace(/[\n\r]+/g, ' ')
    .trim();

  const invalidPrefixes = ['MENCIONADO', 'CONFORME', 'SENDO QUE', 'E AO', 'DE ACORDO', 'ITEM', 'CL[ÁA]USULA', 'OBJETO', 'PRESENTE'];
  const upper = clean.toUpperCase();
  for (const prefix of invalidPrefixes) {
    if (upper.startsWith(prefix)) return undefined;
  }

  return clean.length >= 3 ? clean : undefined;
}

function cleanPersonName(str: string | undefined | null): string | undefined {
  if (!str) return undefined;
  let clean = str
    .replace(/^(?:NOME\s*\/|NOME\s+DO\s+CONDUTOR\s*:?|CONDUTOR\s*:?|MOTORISTA\s*:?|CONTRATADO\s*:?|PROP\.\s*\/|PROP[.\s]+)+/i, '')
    .replace(/(?:CPF|CNH|RG|RENAVAM|RNTRC|PLACA|VEICULO|ENDERE[ÇC]O)[\s\S]*/i, '')
    .replace(/[\n\r]+/g, ' ')
    .trim();

  const invalidTokens = ['PLACA', 'RENAVAM', 'RNTRC', 'CONDUTOR', 'MOTORISTA', 'VEICULO', 'TRACAO', 'CARRETA', 'MDF-E', 'DAMDFE', 'DOCUMENTO'];
  const upper = clean.toUpperCase();
  for (const token of invalidTokens) {
    if (upper.includes(token)) return undefined;
  }

  return clean.length >= 3 ? clean : undefined;
}

export function extractAllChavesAcesso(text: string): string[] {
  if (!text) return [];
  const chavesFound: string[] = [];

  // 1. Procura explícita perto do rótulo CHAVE DE ACESSO / DACTE / DAMDFE / DANFE
  const mLabel = text.match(/(?:CHAVE\s+(?:DE\s+)?ACESSO|CHAVE\s+DO\s+CT-?E|CHAVE\s+DACTE|CHAVE\s+DAMDFE|CHAVE\s+DANFE|CHAVE)[\s\S]{0,40}?((?:\d[\s.-]*){44})/i);
  if (mLabel && mLabel[1]) {
    const clean = mLabel[1].replace(/[\s.-]/g, '');
    if (clean.length === 44) {
      chavesFound.push(clean);
    }
  }

  // 2. Procura blocos formatados no texto (ex: 5226 0849 3837 0900 0100 5700 1000 0000 3010 0000 0000)
  const patternBlocos = /\b(?:\d{4}[\s.-]+){10}\d{4}\b/g;
  const matchBlocos = text.match(patternBlocos);
  if (matchBlocos) {
    matchBlocos.forEach(b => {
      const c = b.replace(/[\s.-]/g, '');
      if (c.length === 44) chavesFound.push(c);
    });
  }

  // 3. Procura padrão de 44 dígitos no texto corrido
  const cleanGlobal = text.replace(/[\s.-]/g, '');
  const all44 = cleanGlobal.match(/\d{44}/g);
  if (all44) {
    for (const ch of all44) {
      const modelo = ch.substring(20, 22);
      if (['57', '67', '55', '65', '58'].includes(modelo)) {
        chavesFound.push(ch);
      }
    }
  }

  return Array.from(new Set(chavesFound));
}

const CTE_PATTERNS = [
  /(?:DACTE|Conhecimento\s+de\s+Transporte\s+Eletr[ôo]nico|CT[- ]?e)\s*(?:[Nn][oOº°ú]|N[úu]mero|Número|NÚMERO)\.?\s*:?\s*([\d.]+)/i,
  /(?:DACTE|Conhecimento\s+de\s+Transporte\s+Eletr[ôo]nico)[^\d\n]{1,40}(?:N[º°ú]|N[úu]mero)\.?\s*:?\s*([\d.]+)/i,
  /\bCT[- ]?e\s*(?:Nº|N°|n[º°.]?)\s*([\d.]+)/i,
  /\bDACTE\b[^\d\n]{1,30}(?:Nº|N°|N[º°.]?)\s*([\d.]+)/i,
];

const NFE_PATTERNS = [
  /(?:DANFE|Nota\s+Fiscal\s+Eletr[ôo]nica|NF[- ]?e)\s*(?:[Nn][oOº°ú]|N[úu]mero|Número|NÚMERO)\.?\s*:?\s*([\d.]+)/i,
  /(?:DANFE|Documento\s+Auxiliar\s+da\s+Nota\s+Fiscal)[^\d\n]{1,40}(?:N[º°ú]|N[úu]mero)\.?\s*:?\s*([\d.]+)/i,
  /\bNF[- ]?e\s*(?:Nº|N°|n[º°.]?)\s*([\d.]+)/i,
  /\bDANFE\b[^\d\n]{1,30}(?:Nº|N°|N[º°.]?)\s*([\d.]+)/i,
];

const MDFE_PATTERNS = [
  /(?:DAMDFE|DAMFE|Manifesto\s+Eletr[ôo]nico\s+de\s+Documentos\s+Fiscais|MDF[- ]?e)\s*(?:[Nn][oOº°ú]|N[úu]mero|Número|NÚMERO)\.?\s*:?\s*([\d.]+)/i,
  /\bMDF[- ]?e\s*(?:Nº|N°|n[º°.]?)\s*([\d.]+)/i,
  /\bDAMDFE\b[^\d\n]{1,30}(?:Nº|N°|N[º°.]?)\s*([\d.]+)/i,
];

function matchPatterns(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].replace(/\./g, '').trim();
  }
  return undefined;
}

function extractCteEmissionDateFromText(text: string): string | undefined {
  const patterns = [
    /DATA\s*(?:E|\/)?\s*HORA\s*(?:DA|DE)?\s*EMISS[ÃA]O[^\d]*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/i,
    /EMISS[ÃA]O[^\d]*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/i,
    /DATA\s*(?:DA|DE)?\s*EMISS[ÃA]O[^\d]*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/i,
    /EMISS[ÃA]O[^\d]*(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?)/i,
    /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const formatted = formatFiscalDateTime(m[1].trim());
      if (formatted) return formatted;
    }
  }
  return undefined;
}

export function extractFreightContractValues(text: string): {
  tollValue?: number;
  advanceValue?: number;
  totalFreightValue?: number;
  advancePercentage?: number;
} {
  const res: {
    tollValue?: number;
    advanceValue?: number;
    totalFreightValue?: number;
    advancePercentage?: number;
  } = {};

  if (!text) return res;

  // 1. Vale-Pedágio / Pedágio (Prefixo e Sufixo, ex: 'R$ 358,20 pedágio')
  const tollPatterns = [
    /VALE[- ]?PED[ÁA]GIO[^\d\n]*R?\$\s*([\d.,]+)/i,
    /VALOR\s+(?:DO\s+)?VALE[- ]?PED[ÁA]GIO[^\d\n]*R?\$\s*([\d.,]+)/i,
    /PED[ÁA]GIO[^\d\n]*R?\$\s*([\d.,]+)/i,
    /R?\$\s*([\d.,]+)\s*(?:referente\s+(?:a[o]?\s+)?)?ped[áa]gio/i,
    /(?:[\d.]+\s+)?R?\$\s*([\d.,]+)\s*ped[áa]gio/i,
    /R?\$\s*([\d.,]+)[^\n]*?(?:tag|vale[- ]?ped[áa]gio)/i,
  ];
  for (const re of tollPatterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const val = parseCurrencyPtBr(m[1]);
      if (val !== undefined && val >= 0) {
        res.tollValue = val;
        break;
      }
    }
  }

  // 2. Adiantamento (Prefixo e Sufixo, ex: 'R$ 4.326,84 referente Adiantamento')
  const advancePatterns = [
    /(?:efete:|efrete:|e-frete:)?\s*Adiantamento[^\d\n]*R?\$\s*([\d.,]+)/i,
    /Valor\s+(?:do\s+)?Adiantamento[^\d\n]*R?\$\s*([\d.,]+)/i,
    /1[ªa]\s*Parcela[^\d\n]*R?\$\s*([\d.,]+)/i,
    /ADIANTAMENTO[^\d\n]*R?\$\s*([\d.,]+)/i,
    /R?\$\s*([\d.,]+)\s*(?:referente\s+(?:a[o]?\s+)?)?adiantamento/i,
    /(?:[\d.]+\s+)?R?\$\s*([\d.,]+)\s*(?:referente\s+(?:a[o]?\s+)?)?adiantamento/i,
  ];
  for (const re of advancePatterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const val = parseCurrencyPtBr(m[1]);
      if (val !== undefined && val > 0) {
        res.advanceValue = val;
        break;
      }
    }
  }

  // 3. Valor Total do Frete / Prestação
  const totalFreightPatterns = [
    /(?:VALOR\s+TOTAL\s+DA\s+PRESTA[ÇC][ÃA]O|VALOR\s+TOTAL\s+DO\s+SERVI[ÇC]O|VALOR\s+A\s+RECEBER|VLR\s+TOTAL\s+PRESTA[ÇC][ÃA]O|VALOR\s+DA\s+PRESTA[ÇC][ÃA]O|TOTAL\s+DA\s+PRESTA[ÇC][ÃA]O|TOTAL\s+DO\s+SERVI[ÇC]O)[\s\S]{0,35}?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\b/i,
    /(?:VALOR\s+TOTAL\s+DA\s+PRESTA[ÇC][ÃA]O|VALOR\s+TOTAL\s+DO\s+SERVI[ÇC]O|VALOR\s+A\s+RECEBER|VALOR\s+DA\s+PRESTA[ÇC][ÃA]O)[^\d\n]*R?\$\s*([\d.,]+)/i,
    /VALOR\s+TOTAL[^\d\n]*R?\$\s*([\d.,]+)/i,
    /VALOR\s+L[ÍI]QUIDO[^\d\n]*R?\$\s*([\d.,]+)/i,
    /FRETE\s+TOTAL[^\d\n]*R?\$\s*([\d.,]+)/i,
    /TOTAL\s+DO\s+FRETE[^\d\n]*R?\$\s*([\d.,]+)/i,
  ];
  for (const re of totalFreightPatterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const val = parseCurrencyPtBr(m[1]);
      if (val !== undefined && val > 0) {
        res.totalFreightValue = val;
        break;
      }
    }
  }

  // 4. Porcentagem do Adiantamento
  const pctPatterns = [
    /Adiantamento[^\n%]*?(\d{1,2}(?:[.,]\d+)?)\s*%/i,
    /(\d{1,2}(?:[.,]\d+)?)\s*%\s*(?:de\s*)?Adiantamento/i,
    /%\s*(?:de\s*)?Adiantamento[^\d\n]*(\d{1,2}(?:[.,]\d+)?)/i,
  ];
  for (const re of pctPatterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const pct = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        res.advancePercentage = Math.round(pct);
        break;
      }
    }
  }

  if (!res.advancePercentage && res.advanceValue && res.totalFreightValue && res.totalFreightValue > 0) {
    const pct = Math.round((res.advanceValue / res.totalFreightValue) * 100);
    if (pct > 0 && pct <= 100) {
      res.advancePercentage = pct;
    }
  }

  return res;
}

// -------------------------------------------------------------
// EXTRAÇÃO DETALHADA DE TEXTO / PDF
// -------------------------------------------------------------

function parseDetailedText(text: string, declaredDocType: string = ''): DetailedDocumentData {
  const upper = text.toUpperCase();
  const res: DetailedDocumentData = {
    documentType: 'Outro',
    sourceType: 'pdf',
    rawText: text
  };

  // 1. Chaves de Acesso
  const chaves = extractAllChavesAcesso(text);
  if (chaves.length > 0) {
    res.accessKey = chaves[0];
  }

  const keyMeta = parseAccessKey44(res.accessKey);

  // 2. Determinação Precisa do Tipo de Documento
  if (isCartaFreteDocType(declaredDocType) || (!keyMeta && (upper.includes('CARTA FRETE') || upper.includes('CONTRATO DE TRANSPORTE') || upper.includes('E-FRETE') || upper.includes('PAMCARD') || upper.includes('REPOM')))) {
    res.documentType = 'Carta Frete';
  } else if (isMdfeDocType(declaredDocType) || keyMeta?.docType === 'MDF-e' || upper.includes('DAMDFE') || upper.includes('DAMFE') || upper.includes('MANIFESTO ELETRÔNICO')) {
    res.documentType = 'MDF-e';
  } else if (isNfeDocType(declaredDocType) || keyMeta?.docType === 'Nota Fiscal' || upper.includes('DANFE') || upper.includes('NOTA FISCAL ELETRÔNICA') || upper.includes('DOCUMENTO AUXILIAR DA NOTA')) {
    res.documentType = 'Nota Fiscal';
  } else if (isCteDocType(declaredDocType) || keyMeta?.docType === 'CT-e' || upper.includes('DACTE') || upper.includes('CONHECIMENTO DE TRANSPORTE')) {
    res.documentType = 'CT-e';
  } else if (declaredDocType && declaredDocType.toUpperCase().includes('CIOT')) {
    res.documentType = 'CIOT';
  } else if (keyMeta) {
    res.documentType = keyMeta.docType;
  }

  // 3. Extração de Números Sequenciais & Séries (priorizando a chave de 44 dígitos oficial)
  if (keyMeta) {
    res.docNumber = keyMeta.docNumber;
    res.series = keyMeta.serie;
  } else {
    if (res.documentType === 'CT-e') {
      res.docNumber = matchPatterns(text, CTE_PATTERNS);
    } else if (res.documentType === 'MDF-e') {
      res.docNumber = matchPatterns(text, MDFE_PATTERNS);
    } else if (res.documentType === 'Nota Fiscal') {
      res.docNumber = matchPatterns(text, NFE_PATTERNS);
    } else {
      const mNum = text.match(/(?:CONTRATO|CARTA\s+FRETE|N[º°ú]|N[úu]mero|VIAGEM)[^\d\n]*?(\d{4,12})/i);
      if (mNum && mNum[1]) res.docNumber = mNum[1];
    }

    const mSerie = text.match(/S[ée]rie[^\d\n]*?(\d{1,3})/i);
    if (mSerie && mSerie[1]) res.series = mSerie[1];
  }

  // 4. Data de Emissão
  res.emissionDate = extractCteEmissionDateFromText(text);

  // 5. CIOT
  const mCiot = text.match(/\bCIOT[^\d\n]*?([\d.\-\/]{8,20})/i);
  if (mCiot && mCiot[1]) res.ciot = mCiot[1].trim();

  // 6. CFOP e Natureza da Operação
  const mCfop = text.match(/\bCFOP[^\d\n]*?(\d{4})/i) || text.match(/\b(\d{4})\s*-\s*SERV/i);
  if (mCfop && mCfop[1] && mCfop[1] !== '0000') {
    res.cfop = mCfop[1];
  }

  const mNatOp = text.match(/NATUREZA\s+DA\s+OPERA[ÇC][ÃA]O[:\s]+([^\n\r]{3,60})/i) ||
                  text.match(/(?:CFOP\s*[-–]\s*)?NATUREZA\s+DA\s+OPERA[ÇC][ÃA]O[:\s]*([^\n\r]+)/i);
  if (mNatOp && mNatOp[1]) {
    res.naturezaOperacao = mNatOp[1].replace(/DACTE|DAMDFE|DANFE|Documento\s+Auxil.*|PROTOCOLO\s+DE\s+AUTORIZA[ÇC][ÃA]O.*/i, '').trim();
  }

  // 7. Placas e RNTRC
  const mPlacas = text.match(/\b([A-Z]{3}[0-9][0-9A-Z][0-9]{2}|[A-Z]{3}-\d{4})\b/g);
  if (mPlacas && mPlacas.length > 0) {
    const normalizedPlacas = Array.from(new Set(mPlacas.map(p => p.replace('-', '').toUpperCase())));
    res.veiculo = res.veiculo || {};
    res.veiculo.placaTrator = normalizedPlacas[0];
    if (normalizedPlacas.length > 1) {
      res.veiculo.placasReboque = normalizedPlacas.slice(1);
    }
  }

  const mRntrc = text.match(/RNTRC[^\d\n]*?(\d{6,10})/i);
  if (mRntrc && mRntrc[1]) {
    res.veiculo = res.veiculo || {};
    res.veiculo.rntrc = mRntrc[1];
  }

  // 8. Motorista / Condutor
  const mMotorista = text.match(/(?:NOME\s+DO\s+CONDUTOR|MOTORISTA|CONDUTOR|CONTRATADO)[:\s]+([A-ZÀ-Ú\s]{4,40})(?:\s+CPF|\s+CNH|\s+RG|\n|$)/i);
  const mCpf = text.match(/(?:CPF|CNPJ)[^\d\n]*?(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i) || text.match(/\b(\d{11})\b/);
  const mCnh = text.match(/CNH[^\d\n]*?(\d{8,12})/i);
  const cleanMotoristaName = cleanPersonName(mMotorista?.[1]);
  if (cleanMotoristaName || mCpf || mCnh) {
    res.motorista = {
      nome: cleanMotoristaName,
      cpf: mCpf?.[1]?.trim(),
      cnh: mCnh?.[1]?.trim(),
    };
  }

  // 9. Origem e Destino
  const mOrigem = text.match(/(?:IN[ÍI]CIO\s+(?:DA\s+)?PRESTA[ÇC][ÃA]O|ORIGEM|UF\s+DE\s+CARREGAMENTO|UF\s+CARREGAMENTO)[\s\S]{0,40}?([A-ZÀ-Ú\s]{3,30})\s*[-/]\s*([A-Z]{2})/i) ||
                  text.match(/(?:IN[ÍI]CIO\s+DA\s+PRESTA[ÇC][ÃA]O|ORIGEM|UF\s+DE\s+CARREGAMENTO)[^\w\n]*([A-Z\s]{3,30})(?:-|\/|\s)([A-Z]{2})/i);
  if (mOrigem) {
    res.origem = { municipio: mOrigem[1].trim(), uf: mOrigem[2].trim() };
  }
  const mDestino = text.match(/(?:FIM\s+(?:DA\s+)?PRESTA[ÇC][ÃA]O|DESTINO|UF\s+DE\s+DESCARREGAMENTO|UF\s+DESCARREGAMENTO)[\s\S]{0,40}?([A-ZÀ-Ú\s]{3,30})\s*[-/]\s*([A-Z]{2})/i) ||
                   text.match(/(?:FIM\s+DA\s+PRESTA[ÇC][ÃA]O|DESTINO|UF\s+DE\s+DESCARREGAMENTO)[^\w\n]*([A-Z\s]{3,30})(?:-|\/|\s)([A-Z]{2})/i);
  if (mDestino) {
    res.destino = { municipio: mDestino[1].trim(), uf: mDestino[2].trim() };
  }

  // 10. Pesos e Cargas
  let extractedPesoBruto: number | undefined;
  let extractedPesoLiquido: number | undefined;

  // 10.1 Padrão Prioritário MDF-e (DAMDFE): "Peso total (Kg)"
  const mPesoMdfe = text.match(/(?:Peso\s+total\s*\(\s*Kg\s*\)|PESO\s+TOTAL\s*\(KG\)|PESO\s+TOTAL\s+KG)[\s\S]{0,35}?\b([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]+)?|[\d]{3,}(?:,[\d]+)?|[\d.,]+)\b/i) ||
                    text.match(/(?:Peso\s+total\s*\(\s*Kg\s*\)|PESO\s+TOTAL\s*\(KG\))[^\d\n]*?([\d.,]+)/i);
  if (mPesoMdfe && mPesoMdfe[1]) {
    const val = parseCurrencyPtBr(mPesoMdfe[1]);
    if (val !== undefined && val > 0) {
      extractedPesoBruto = val;
    }
  }

  // 10.2 Padrões para CT-e e NF-e
  if (extractedPesoBruto === undefined) {
    const pesoBrutoPatterns = [
      /PESO\s+BRUTO\s*\(?\s*KG\s*\)?[\s\S]{0,25}?\b([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]+)?|[\d]+(?:,[\d]+)?)\b/i,
      /PESO\s+BRUTO[^\d\n]*?([\d.,]+)\s*(?:KG|TON|T)?/i,
      /PESO\s+AFERIDO[^\d\n]*?([\d.,]+)\s*(?:KG|TON|T)?/i,
      /PESO\s+DECLARADO[^\d\n]*?([\d.,]+)\s*(?:KG|TON|T)?/i,
      /PESO\s+BASE\s+DE\s+C[ÁA]LCULO[^\d\n]*?([\d.,]+)/i,
    ];

    for (const re of pesoBrutoPatterns) {
      const m = text.match(re);
      if (m && m[1]) {
        const val = parseCurrencyPtBr(m[1]);
        if (val !== undefined && val > 0) {
          extractedPesoBruto = val;
          break;
        }
      }
    }
  }

  // 10.3 Peso Líquido
  const mPesoLiquido = text.match(/PESO\s+L[ÍI]QUIDO[\s\S]{0,25}?([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]+)?)\s*(?:KG|TON|T)?/i);
  if (mPesoLiquido && mPesoLiquido[1]) {
    extractedPesoLiquido = parseWeightKg(mPesoLiquido[1]);
  }

  // 10.4 Quantidade de Volumes / Qtd CT-e
  const mVolumes = text.match(/(?:QTD\.?\s*TOTAL\s*DE\s*CT-?E|QTD\.?\s*CT-?E)[^\d\n]*?(\d+)/i) ||
                   text.match(/(?:VOLUMES|QUANTIDADE\s+VOLUMES|QTD\s+VOL)[^\d\n]*?([\d.,]+)/i);

  // 10.5 Valor da Carga / Mercadorias
  const mValCarga = text.match(/(?:VALOR\s+(?:TOTAL\s+)?(?:DA\s+)?CARGA|VALOR\s+(?:TOTAL\s+)?(?:DAS\s+)?MERCADORIAS?|VALOR\s+DECLARADO|VALOR\s+P\/\s*AVERBA[ÇC][ÃA]O|VLR\s+CARGA|VALOR\s+DOS\s+PRODUTOS|VALOR\s+TOTAL\s+DA\s+NOTA)[\s\S]{0,35}?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\b/i) ||
                    text.match(/(?:VALOR\s+(?:DA\s+)?CARGA|VALOR\s+(?:DOS\s+)?PRODUTOS|TOTAL\s+(?:DOS\s+)?PRODUTOS)[^\d\n]*R?\$\s*([\d.,]+)/i);
  const mEspecie = text.match(/(?:ESP[ÉE]CIE|ESPECIE)[^\w\n]*([A-Z\s]{3,20})/i);
  const mProdPred = text.match(/(?:PRODUTO\s+PREDOMINANTE|CARGA\s+PREDOMINANTE|DESCRIC[ÃA]O\s+DO\s+PRODUTO)[:\s]*([A-ZÀ-Ú0-9\s.,-]{3,40})/i);

  if (extractedPesoBruto || extractedPesoLiquido || mVolumes || mValCarga || mEspecie || mProdPred) {
    res.carga = {
      pesoBrutoKg: extractedPesoBruto,
      pesoLiquidoKg: extractedPesoLiquido,
      quantidadeVolumes: parseCurrencyPtBr(mVolumes?.[1]),
      valorMercadoria: parseCurrencyPtBr(mValCarga?.[1]),
      especie: mEspecie?.[1]?.trim(),
      produtoPredominante: mProdPred?.[1]?.trim(),
    };
  }

  // 11. Valores Financeiros e Frete
  const contractVals = extractFreightContractValues(text);
  const mFreteLiq = text.match(/(?:VALOR\s+L[ÍI]QUIDO|L[ÍI]QUIDO\s+A\s+RECEBER|FRETE\s+L[ÍI]QUIDO)[\s\S]{0,35}?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\b/i);
  const mSaldo = text.match(/(?:SALDO|VALOR\s+DO\s+SALDO|2[ªa]\s*Parcela)[\s\S]{0,35}?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\b/i);
  const mCombustivel = text.match(/(?:COMBUST[ÍI]VEL|ABASTECIMENTO|POSTO)[\s\S]{0,35}?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\b/i);
  const mIcms = text.match(/(?:VALOR\s+(?:DO\s+)?ICMS|VLR\s+ICMS)[\s\S]{0,35}?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\b/i);
  const mBcIcms = text.match(/(?:BASE\s+DE\s+C[ÁA]LCULO\s+(?:DO\s+)?ICMS|BC\s+ICMS)[\s\S]{0,35}?(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\b/i);
  const mAliqIcms = text.match(/(?:AL[ÍI]QUOTA\s+(?:DO\s+)?ICMS|AL[ÍI]Q\s+ICMS)[\s\S]{0,20}?([\d.,]+)\s*%/i);
  const mPix = text.match(/(?:PIX|CHAVE\s+PIX)[:\s]+([^\s\n\r]{4,50})/i);

  res.financeiro = {
    valorTotalFrete: contractVals.totalFreightValue,
    valorLiquido: parseCurrencyPtBr(mFreteLiq?.[1]),
    valorAdiantamento: contractVals.advanceValue,
    porcentagemAdiantamento: contractVals.advancePercentage,
    valorSaldo: parseCurrencyPtBr(mSaldo?.[1]),
    valorPedagio: contractVals.tollValue,
    valorCombustivel: parseCurrencyPtBr(mCombustivel?.[1]),
    baseCalculoIcms: parseCurrencyPtBr(mBcIcms?.[1]),
    valorIcms: parseCurrencyPtBr(mIcms?.[1]),
    aliquotaIcms: parseCurrencyPtBr(mAliqIcms?.[1]),
    chavePix: mPix?.[1]?.trim(),
  };

  // 12. Seguro
  const mSeg = text.match(/(?:SEGURADORA|NOME\s+DA\s+SEGURADORA)[:\s]+([A-ZÀ-Ú\s]{3,35})/i);
  const mApol = text.match(/(?:AP[ÓO]LICE|N[º°ú]\s+AP[ÓO]LICE)[:\s]+([A-Z0-9.\-\/]{4,30})/i);
  const mAver = text.match(/(?:AVERBA[ÇC][ÃA]O|N[º°ú]\s+AVERBA[ÇC][ÃA]O)[:\s]+([A-Z0-9.\-\/]{4,40})/i);
  if (mSeg || mApol || mAver) {
    res.seguro = {
      nomeSeguradora: mSeg?.[1]?.trim(),
      numeroApolice: mApol?.[1]?.trim(),
      numeroAverbacao: mAver?.[1]?.trim(),
    };
  }

  // 13. Partes Envolvidas (Emitente, Destinatário, Remetente, Tomador)
  const mEmit = text.match(/(?:EMITENTE|TRANSPORTADOR|EMITIDO\s+POR)[:\s]*([A-ZÀ-Ú0-9\s.,&/-]{4,50})(?:\s+CNPJ|\s+CPF|\n|$)/i);
  const mEmitCnpj = text.match(/(?:EMITENTE|TRANSPORTADOR)[\s\S]{0,80}?(?:CNPJ|CPF)[:\s]*([\d./-]{14,18})/i);
  const cleanEmit = cleanLegalEntityName(mEmit?.[1]);
  if (cleanEmit || mEmitCnpj) {
    res.emitente = { 
      razaoSocial: cleanEmit,
      cnpjCpf: mEmitCnpj?.[1]?.trim()
    };
  }

  const mRem = text.match(/REMETENTE[:\s]*([A-ZÀ-Ú0-9\s.,&/-]{4,50})/i);
  const mRemCnpj = text.match(/REMETENTE[\s\S]{0,80}?(?:CNPJ|CPF)[:\s]*([\d./-]{14,18})/i);
  const cleanRem = cleanLegalEntityName(mRem?.[1]);
  if (cleanRem || mRemCnpj) {
    res.remetente = { 
      razaoSocial: cleanRem,
      cnpjCpf: mRemCnpj?.[1]?.trim()
    };
  }

  const mDest = text.match(/DESTINAT[ÁA]RIO[:\s]*([A-ZÀ-Ú0-9\s.,&/-]{4,50})/i);
  const mDestCnpj = text.match(/DESTINAT[ÁA]RIO[\s\S]{0,80}?(?:CNPJ|CPF)[:\s]*([\d./-]{14,18})/i);
  const cleanDest = cleanLegalEntityName(mDest?.[1]);
  if (cleanDest || mDestCnpj) {
    res.destinatario = { 
      razaoSocial: cleanDest,
      cnpjCpf: mDestCnpj?.[1]?.trim()
    };
  }

  const mTomador = text.match(/TOMADOR\s+(?:DO\s+)?SERVI[ÇC]O[:\s]*([A-ZÀ-Ú0-9\s.,&/-]{4,50})/i);
  const cleanTomador = cleanLegalEntityName(mTomador?.[1]);
  if (cleanTomador) {
    res.tomador = {
      razaoSocial: cleanTomador
    };
  }

  // 14. Cláusula 3.5: Cálculo do Saldo de Frete (PF vs PJ)
  if (res.documentType === 'Carta Frete') {
    // 3.5.1 Saldo Original
    const m351 = text.match(/(?:3\.5\.1|3\.5\s+C[ÁA]LCULO[^\n]*?3\.5\.1|Saldo\s+Original)[^\d\n]*?R?\$\s*([\d.,]+)/i);
    const val351 = parseCurrencyPtBr(m351?.[1]);

    // 3.5.2 INSS Retido
    const m352 = text.match(/(?:3\.5\.2|INSS\s+retido)[^\d\n]*?R?\$\s*([\d.,]+)/i);
    const val352 = parseCurrencyPtBr(m352?.[1]);

    // 3.5.3 SEST/SENAT
    const m353 = text.match(/(?:3\.5\.3|SEST\s*[\/-]?\s*SENAT)[^\d\n]*?R?\$\s*([\d.,]+)/i);
    const val353 = parseCurrencyPtBr(m353?.[1]);

    // 3.5.4 IRRF
    const m354 = text.match(/(?:3\.5\.4|Imposto\s+de\s+Renda|IRRF)[^\d\n]*?R?\$\s*([\d.,]+)/i);
    const val354 = parseCurrencyPtBr(m354?.[1]);

    // 3.5.10 Subtotal
    const m3510 = text.match(/(?:3\.5\.10|Subtotal)[^\d\n]*?R?\$\s*([\d.,]+)/i);
    const val3510 = parseCurrencyPtBr(m3510?.[1]);

    // 3.5.11 Pesos
    const m3511Saida = text.match(/(?:3\.5\.11[^\n]*?Peso\s+Sa[íi]da|Peso\s+Sa[íi]da)[:\s]*([\d.,]+)/i);
    const m3511Chegada = text.match(/Peso\s+Chegada[:\s]*([\d.,]+)/i);

    // 3.5.12 Valor Quebra por Kg
    const m3512Kg = text.match(/(?:3\.5\.12|Quebra\s*\/?\s*Avaria)[^\n]*?x\s*R?\$\s*([\d.,]+)/i);
    const val3512Kg = parseCurrencyPtBr(m3512Kg?.[1]);

    // 3.5.13 Valor Frete Faltante por Kg
    const m3513Kg = text.match(/(?:3\.5\.13|Diferen[çc]a\s+do\s+Frete)[^\n]*?x\s*R?\$\s*([\d.,]+)/i);
    const val3513Kg = parseCurrencyPtBr(m3513Kg?.[1]);

    // Detecta se é PJ (CNPJ contratado ou indicação de ETC / PJ) ou PF
    const isPj = upper.includes('PESSOA JURÍDICA') || upper.includes('PESSOA JURIDICA') || upper.includes('TIPO: PJ') || !!text.match(/(?:CONTRATADO|MOTORISTA)[\s\S]{0,40}?CNPJ[:\s]*\d{2}\.\d{3}\.\d{3}/i);

    const tipoPessoa = isPj ? 'PJ' : 'PF';

    res.calculoSaldoFrete = calculateFreightBalance({
      tipoPessoa,
      freteBruto: res.financeiro?.valorTotalFrete,
      tollValue: res.financeiro?.valorPedagio,
      adiantamento: res.financeiro?.valorAdiantamento,
      saldoOriginal: val351 || res.financeiro?.valorSaldo,
      inssRetido: val352,
      sestSenat: val353,
      irrf: val354,
      pesoSaidaKg: parseWeightKg(m3511Saida?.[1]) || res.carga?.pesoBrutoKg,
      pesoChegadaKg: parseWeightKg(m3511Chegada?.[1]),
      valorKgQuebra: val3512Kg,
      valorKgFreteFaltante: val3513Kg,
    });
  }

  return res;
}

// -------------------------------------------------------------
// EXTRAÇÃO DETALHADA DE XML
// -------------------------------------------------------------

function parseDetailedXml(xmlText: string): DetailedDocumentData | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) return null;

    const rootTag = doc.documentElement?.tagName?.toLowerCase() || '';

    // ================= CT-e =================
    if (rootTag.includes('cte') || rootTag === 'cteproc') {
      const res: DetailedDocumentData = {
        documentType: 'CT-e',
        sourceType: 'xml',
        docNumber: getXmlTagValue(doc, 'nCT'),
        series: getXmlTagValue(doc, 'serie'),
        emissionDate: formatFiscalDateTime(getXmlTagValue(doc, 'dhEmi', 'dEmi')),
        cfop: getXmlTagValue(doc, 'CFOP', 'cfop'),
        naturezaOperacao: getXmlTagValue(doc, 'natOp'),
        protocoloAutorizacao: getXmlTagValue(doc, 'nProt'),
        accessKey: getXmlTagValue(doc, 'chCTe') || doc.getElementsByTagName('infCte')[0]?.getAttribute('Id')?.replace('CTe', '') || undefined,
        emitente: {
          razaoSocial: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'xNome'),
          nomeFantasia: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'xFant'),
          cnpjCpf: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'CNPJ', 'CPF'),
          inscricaoEstadual: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'IE'),
          municipio: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'xMun'),
          uf: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'UF'),
        },
        remetente: {
          razaoSocial: getXmlTagValue(doc.getElementsByTagName('rem')[0] || doc, 'xNome'),
          cnpjCpf: getXmlTagValue(doc.getElementsByTagName('rem')[0] || doc, 'CNPJ', 'CPF'),
          inscricaoEstadual: getXmlTagValue(doc.getElementsByTagName('rem')[0] || doc, 'IE'),
          municipio: getXmlTagValue(doc.getElementsByTagName('rem')[0] || doc, 'xMun'),
          uf: getXmlTagValue(doc.getElementsByTagName('rem')[0] || doc, 'UF'),
        },
        destinatario: {
          razaoSocial: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'xNome'),
          cnpjCpf: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'CNPJ', 'CPF'),
          inscricaoEstadual: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'IE'),
          municipio: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'xMun'),
          uf: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'UF'),
        },
        origem: {
          municipio: getXmlTagValue(doc, 'xMunIni'),
          uf: getXmlTagValue(doc, 'UFIni'),
        },
        destino: {
          municipio: getXmlTagValue(doc, 'xMunFim'),
          uf: getXmlTagValue(doc, 'UFFim'),
        },
        veiculo: {
          rntrc: getXmlTagValue(doc, 'RNTRC', 'rntrc'),
          placaTrator: getXmlTagValue(doc, 'placa'),
          ufPlaca: getXmlTagValue(doc.getElementsByTagName('veic')[0] || doc, 'UF'),
        },
        motorista: {
          nome: getXmlTagValue(doc.getElementsByTagName('moto')[0] || doc, 'xNome'),
          cpf: getXmlTagValue(doc.getElementsByTagName('moto')[0] || doc, 'CPF'),
        },
        carga: {
          produtoPredominante: getXmlTagValue(doc, 'proPred', 'xOutCat'),
          valorMercadoria: parseCurrencyPtBr(getXmlTagValue(doc, 'vCarga')),
          pesoBrutoKg: parseWeightKg(getXmlTagValue(doc, 'qCarga', 'pesoB')),
          quantidadeVolumes: parseCurrencyPtBr(getXmlTagValue(doc, 'qVol')),
        },
        financeiro: {
          valorTotalFrete: parseCurrencyPtBr(getXmlTagValue(doc, 'vTPrest', 'vRec')),
          valorReceber: parseCurrencyPtBr(getXmlTagValue(doc, 'vRec')),
          baseCalculoIcms: parseCurrencyPtBr(getXmlTagValue(doc, 'vBC')),
          valorIcms: parseCurrencyPtBr(getXmlTagValue(doc, 'vICMS', 'vIcms')),
          aliquotaIcms: parseCurrencyPtBr(getXmlTagValue(doc, 'pICMS', 'pIcms')),
          valorPis: parseCurrencyPtBr(getXmlTagValue(doc, 'vPIS', 'vPis')),
          aliquotaPis: parseCurrencyPtBr(getXmlTagValue(doc, 'pPIS', 'pPis')),
          valorCofins: parseCurrencyPtBr(getXmlTagValue(doc, 'vCOFINS', 'vCofins')),
          aliquotaCofins: parseCurrencyPtBr(getXmlTagValue(doc, 'pCOFINS', 'pCofins')),
          valorPisCofinsFederal: (
            (parseCurrencyPtBr(getXmlTagValue(doc, 'vPIS', 'vPis')) || 0) +
            (parseCurrencyPtBr(getXmlTagValue(doc, 'vCOFINS', 'vCofins')) || 0)
          ) || undefined,
          valorTributosFederais: parseCurrencyPtBr(getXmlTagValue(doc, 'vTotTrib', 'vTribFed')),
          valorPedagio: parseCurrencyPtBr(getXmlTagValue(doc, 'vPed', 'vValePed')),
        },
        seguro: {
          nomeSeguradora: getXmlTagValue(doc, 'xSeg'),
          numeroApolice: getXmlTagValue(doc, 'nApol'),
          numeroAverbacao: getXmlTagValue(doc, 'nAver'),
          responsavelSeguro: getXmlTagValue(doc, 'respSeg'),
        },
        observacoesFiscais: [
          getXmlTagValue(doc, 'infAdFisco'),
          getXmlTagValue(doc, 'infCpl'),
          getXmlTagValue(doc, 'xObs')
        ].filter(Boolean).join(' | ') || undefined,
      };

      const allObsText = res.observacoesFiscais || '';
      const matchSusp = allObsText.match(/(?:impostos?\s+suspensos?|suspens[aã]o(?:\s+tribut[aá]ria)?)\s*:\s*(\d+(?:[.,]\d+)?)\s*%/i);
      if (matchSusp) {
        res.suspensaoPercentual = parseFloat(matchSusp[1].replace(',', '.'));
      }

      // Documentos vinculados (ex: NFe vinculada ao CTe)
      const chNFeEls = doc.getElementsByTagName('chNFe');
      if (chNFeEls.length > 0) {
        res.documentosVinculados = [];
        for (let i = 0; i < chNFeEls.length; i++) {
          const ch = chNFeEls[i].textContent?.trim();
          if (ch) {
            res.documentosVinculados.push({ tipo: 'NF-e', chaveAcesso: ch });
          }
        }
      }

      return res;
    }

    // ================= MDF-e =================
    if (rootTag.includes('mdfe') || rootTag.includes('mdfeproc')) {
      const res: DetailedDocumentData = {
        documentType: 'MDF-e',
        sourceType: 'xml',
        docNumber: getXmlTagValue(doc, 'nMDF'),
        series: getXmlTagValue(doc, 'serie'),
        emissionDate: formatFiscalDateTime(getXmlTagValue(doc, 'dhEmi', 'dEmi')),
        protocoloAutorizacao: getXmlTagValue(doc, 'nProt'),
        accessKey: getXmlTagValue(doc, 'chMDFe') || doc.getElementsByTagName('infMDFe')[0]?.getAttribute('Id')?.replace('MDFe', '') || undefined,
        origem: {
          uf: getXmlTagValue(doc, 'UFIni', 'ufIni'),
        },
        destino: {
          uf: getXmlTagValue(doc, 'UFFim', 'ufFim'),
        },
        emitente: {
          razaoSocial: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'xNome'),
          nomeFantasia: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'xFant'),
          cnpjCpf: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'CNPJ', 'CPF'),
          inscricaoEstadual: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'IE'),
          municipio: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'xMun'),
          uf: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'UF'),
        },
        veiculo: {
          placaTrator: getXmlTagValue(doc.getElementsByTagName('veicTracao')[0] || doc, 'placa'),
          rntrc: getXmlTagValue(doc, 'RNTRC', 'rntrc'),
          ufPlaca: getXmlTagValue(doc.getElementsByTagName('veicTracao')[0] || doc, 'UF'),
        },
        motorista: {
          nome: getXmlTagValue(doc.getElementsByTagName('condutor')[0] || doc, 'xNome'),
          cpf: getXmlTagValue(doc.getElementsByTagName('condutor')[0] || doc, 'CPF'),
        },
        carga: {
          valorMercadoria: parseCurrencyPtBr(getXmlTagValue(doc, 'vCarga')),
          pesoBrutoKg: parseWeightKg(getXmlTagValue(doc, 'qCarga')),
          quantidadeVolumes: parseCurrencyPtBr(getXmlTagValue(doc, 'qCTe', 'qNFe', 'qMDFe')),
        },
        seguro: {
          nomeSeguradora: getXmlTagValue(doc, 'xSeg'),
          numeroApolice: getXmlTagValue(doc, 'nApol'),
          numeroAverbacao: getXmlTagValue(doc, 'nAver'),
        },
        ciot: getXmlTagValue(doc, 'CIOT', 'ciot'),
      };

      // Placas de reboque
      const veicReboqueEls = doc.getElementsByTagName('veicReboque');
      if (veicReboqueEls.length > 0) {
        res.veiculo = res.veiculo || {};
        res.veiculo.placasReboque = [];
        for (let i = 0; i < veicReboqueEls.length; i++) {
          const placa = getXmlTagValue(veicReboqueEls[i], 'placa');
          if (placa) res.veiculo.placasReboque.push(placa);
        }
      }

      return res;
    }

    // ================= NF-e =================
    if (rootTag.includes('nfe') || rootTag.includes('nfproc')) {
      const res: DetailedDocumentData = {
        documentType: 'Nota Fiscal',
        sourceType: 'xml',
        docNumber: getXmlTagValue(doc, 'nNF'),
        series: getXmlTagValue(doc, 'serie'),
        emissionDate: formatFiscalDateTime(getXmlTagValue(doc, 'dhEmi', 'dEmi')),
        naturezaOperacao: getXmlTagValue(doc, 'natOp'),
        protocoloAutorizacao: getXmlTagValue(doc, 'nProt'),
        accessKey: getXmlTagValue(doc, 'chNFe') || doc.getElementsByTagName('infNFe')[0]?.getAttribute('Id')?.replace('NFe', '') || undefined,
        emitente: {
          razaoSocial: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'xNome'),
          nomeFantasia: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'xFant'),
          cnpjCpf: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'CNPJ', 'CPF'),
          inscricaoEstadual: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'IE'),
          municipio: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'xMun'),
          uf: getXmlTagValue(doc.getElementsByTagName('emit')[0] || doc, 'UF'),
        },
        destinatario: {
          razaoSocial: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'xNome'),
          cnpjCpf: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'CNPJ', 'CPF'),
          inscricaoEstadual: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'IE'),
          municipio: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'xMun'),
          uf: getXmlTagValue(doc.getElementsByTagName('dest')[0] || doc, 'UF'),
        },
        carga: {
          valorMercadoria: parseCurrencyPtBr(getXmlTagValue(doc, 'vProd', 'vNF')),
          pesoBrutoKg: parseWeightKg(getXmlTagValue(doc, 'pesoB')),
          pesoLiquidoKg: parseWeightKg(getXmlTagValue(doc, 'pesoL')),
          quantidadeVolumes: parseCurrencyPtBr(getXmlTagValue(doc, 'qVol')),
          especie: getXmlTagValue(doc, 'esp'),
        },
        financeiro: {
          valorTotalFrete: parseCurrencyPtBr(getXmlTagValue(doc, 'vFrete')),
          baseCalculoIcms: parseCurrencyPtBr(getXmlTagValue(doc, 'vBC')),
          valorIcms: parseCurrencyPtBr(getXmlTagValue(doc, 'vICMS')),
        },
        veiculo: {
          placaTrator: getXmlTagValue(doc.getElementsByTagName('transporta')[0] || doc, 'placa'),
          rntrc: getXmlTagValue(doc.getElementsByTagName('transporta')[0] || doc, 'RNTRC'),
        }
      };

      return res;
    }
  } catch (e) {
    console.warn('[fiscalDocParser] Error in parseDetailedXml:', e);
  }
  return null;
}

/**
 * Função principal para extrair todos os dados estruturados de um arquivo ou URL.
 */
export async function extractDetailedDocData(
  input: File | string,
  declaredDocType: string = ''
): Promise<DetailedDocumentData> {
  try {
    let text = '';
    let isXml = false;
    let fileName = '';

    if (typeof input === 'string') {
      // É uma URL
      fileName = input.split('/').pop()?.split('?')[0] || '';
      const response = await fetch(input);
      if (!response.ok) {
        throw new Error(`Falha ao carregar documento da URL (HTTP ${response.status})`);
      }
      const buffer = await response.arrayBuffer();
      const urlLower = input.toLowerCase();
      const isPdf = urlLower.includes('.pdf');

      const decoder = new TextDecoder('utf-8');
      const rawHead = decoder.decode(buffer.slice(0, 100));
      isXml = urlLower.endsWith('.xml') || rawHead.trimStart().startsWith('<');

      if (isPdf || rawHead.includes('%PDF')) {
        text = await extractTextFromPdfBuffer(buffer);
      } else {
        text = decoder.decode(buffer);
      }
    } else {
      // É um File do navegador
      fileName = input.name;
      const fileNameLower = input.name.toLowerCase();
      const isPdf = fileNameLower.endsWith('.pdf') || input.type.includes('pdf');
      isXml = fileNameLower.endsWith('.xml') || input.type.includes('xml');

      if (isPdf) {
        const buffer = await input.arrayBuffer();
        text = await extractTextFromPdfBuffer(buffer);
      } else {
        text = await readFileAsText(input);
      }
    }

    const isXmlText = isXml || text.trimStart().startsWith('<');
    if (isXmlText) {
      const xmlResult = parseDetailedXml(text);
      if (xmlResult) {
        xmlResult.rawText = text;
        return xmlResult;
      }
    }

    const detailed = parseDetailedText(text, declaredDocType || fileName);
    return detailed;
  } catch (error: any) {
    console.warn('[fiscalDocParser] Erro em extractDetailedDocData:', error);
    return {
      documentType: 'Outro',
      sourceType: 'text',
      rawText: `Não foi possível extrair dados automaticamente: ${error?.message || error}`
    };
  }
}

// -------------------------------------------------------------
// COMPATIBILIDADE COM CÓDIGO EXISTENTE
// -------------------------------------------------------------

export interface FiscalDocNumbers {
  cteNumber?: string;
  cteEmissionDate?: string;
  nfeNumber?: string;
  nfeValue?: number;
  mdfeNumber?: string;
  advancePercentage?: number;
  advanceValue?: number;
  tollValue?: number;
  totalFreightValue?: number;
}

export async function extractFiscalDocNumbers(
  filesToAttach: { [docType: string]: File[] }
): Promise<FiscalDocNumbers> {
  const result: FiscalDocNumbers = {};

  const docTypes = Object.keys(filesToAttach);
  for (const docType of docTypes) {
    const files = filesToAttach[docType];
    if (!Array.isArray(files) || files.length === 0) continue;

    for (const file of files) {
      try {
        const detailed = await extractDetailedDocData(file, docType);
        
        if (detailed.documentType === 'CT-e' || isCteDocType(docType)) {
          if (detailed.docNumber && !result.cteNumber) result.cteNumber = detailed.docNumber;
          if (detailed.emissionDate && !result.cteEmissionDate) result.cteEmissionDate = detailed.emissionDate;
        }
        if (detailed.documentType === 'Nota Fiscal' || isNfeDocType(docType)) {
          if (detailed.docNumber && !result.nfeNumber) result.nfeNumber = detailed.docNumber;
        }
        if (detailed.documentType === 'MDF-e' || isMdfeDocType(docType)) {
          if (detailed.docNumber && !result.mdfeNumber) result.mdfeNumber = detailed.docNumber;
        }
        if (detailed.carga?.valorMercadoria !== undefined && result.nfeValue === undefined) {
          result.nfeValue = detailed.carga.valorMercadoria;
        }
        if (detailed.financeiro?.valorPedagio !== undefined && result.tollValue === undefined) {
          result.tollValue = detailed.financeiro.valorPedagio;
        }
        if (detailed.financeiro?.valorAdiantamento !== undefined && result.advanceValue === undefined) {
          result.advanceValue = detailed.financeiro.valorAdiantamento;
        }
        if (detailed.financeiro?.valorTotalFrete !== undefined && result.totalFreightValue === undefined) {
          result.totalFreightValue = detailed.financeiro.valorTotalFrete;
        }
        if (detailed.financeiro?.porcentagemAdiantamento !== undefined && result.advancePercentage === undefined) {
          result.advancePercentage = detailed.financeiro.porcentagemAdiantamento;
        }
      } catch (e) {
        console.warn(`[fiscalDocParser] Could not read file "${file.name}":`, e);
      }
    }
  }

  console.log('[fiscalDocParser] Extracted fiscal and contract numbers:', result);
  return result;
}

export async function extractFiscalDocNumbersFromUrls(
  docsByType: { [docType: string]: string[] }
): Promise<FiscalDocNumbers> {
  const result: FiscalDocNumbers = {};

  for (const [docType, urls] of Object.entries(docsByType)) {
    if (!Array.isArray(urls) || urls.length === 0) continue;

    for (const url of urls) {
      try {
        const detailed = await extractDetailedDocData(url, docType);
        if (detailed.documentType === 'CT-e' || isCteDocType(docType)) {
          if (detailed.docNumber && !result.cteNumber) result.cteNumber = detailed.docNumber;
          if (detailed.emissionDate && !result.cteEmissionDate) result.cteEmissionDate = detailed.emissionDate;
        }
        if (detailed.documentType === 'Nota Fiscal' || isNfeDocType(docType)) {
          if (detailed.docNumber && !result.nfeNumber) result.nfeNumber = detailed.docNumber;
        }
        if (detailed.documentType === 'MDF-e' || isMdfeDocType(docType)) {
          if (detailed.docNumber && !result.mdfeNumber) result.mdfeNumber = detailed.docNumber;
        }
        if (detailed.carga?.valorMercadoria !== undefined && result.nfeValue === undefined) {
          result.nfeValue = detailed.carga.valorMercadoria;
        }
        if (detailed.financeiro?.valorPedagio !== undefined && result.tollValue === undefined) {
          result.tollValue = detailed.financeiro.valorPedagio;
        }
        if (detailed.financeiro?.valorAdiantamento !== undefined && result.advanceValue === undefined) {
          result.advanceValue = detailed.financeiro.valorAdiantamento;
        }
        if (detailed.financeiro?.valorTotalFrete !== undefined && result.totalFreightValue === undefined) {
          result.totalFreightValue = detailed.financeiro.valorTotalFrete;
        }
        if (detailed.financeiro?.porcentagemAdiantamento !== undefined && result.advancePercentage === undefined) {
          result.advancePercentage = detailed.financeiro.porcentagemAdiantamento;
        }
      } catch (e) {
        console.warn(`[fiscalDocParser] Could not fetch URL "${url}":`, e);
      }
    }
  }

  return result;
}

