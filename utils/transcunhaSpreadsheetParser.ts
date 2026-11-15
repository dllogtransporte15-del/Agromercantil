import * as XLSX from 'xlsx';
import { calculateTacTaxDeductions } from './freightCalculation';

export interface TranscunhaSpreadsheetRow {
  id: string;
  orderIndex?: number;
  // 0. Embarques do Sistema (Primeira Coluna no Canto Esquerdo)
  idEmbarqueSistema?: string;
  // A - F: Faturamento & Financeiro Empresa
  cteHoras: string;
  dataHoraEmissao?: string;
  jaFaturado: string;
  dataVencimento: string;
  formaPagamento: string;
  dataPagamento: string;
  statusRecebimento: string;
  
  // G - L: Identificação Operacional & Motorista
  dataEmbarque: string;
  placa: string;
  obsCavaloAntt: string;
  codigoAtua: string;
  motorista: string;
  cpfMotorista: string;
  
  // M - U: Logística, Carga & Contratante
  proprietario: string;
  anttContratoPix: string;
  telefone: string;
  solicitante: string;
  carregarEmpresa: string;
  numeroPedido: string;
  saldoOriginalPedido: string;
  produto: string;
  tipoCarga: string;
  
  // V - AA: Cadastros & Controles
  transportadora: string;
  cadastro: string;
  matrizFilial: string;
  liberacao: string;
  gr: string;
  ordemCarregamento: string;
  
  // AB - AI: Tomador, Rota & Pesagem
  clienteTomadorPagador: string;
  freteEmpresaUnitario: number;
  origem: string;
  kmDistancia: string;
  destino: string;
  eixo: string;
  pedagio: number;
  peso: number;
  
  // AJ - AO: Impostos & Deduções
  freteBrutoEmpresa: number;
  icms: number;
  debitoPisCofins: number;
  creditoPisCofins: number;
  patronal4: number;
  inssSestSenat: number;
  valorTaxaCiot?: number;
  custoFinanceiro?: number;
  
  // AP - AU: Custos de Frete do Motorista
  tarifaTonMotorista: number;
  valorFreteMotorista: number;
  nfCliente: string;
  valorNf: number;
  cte: string;
  controle: string;
  status: string;
  
  // AV - BB: Adiantamentos, Ticket & Saldo
  percentualAdiantamento: number;
  valorAdiantamento: number;
  horaDataLiberacaoAdiantamento: string;
  ticketDescarga: string;
  pesoChegada: number;
  saldo: number;
  
  // BC - BH: Fechamento, CIOT & Quebra
  horaDataLiberacaoSaldo: string;
  tipoPagamentoSaldo: string;
  statusSaldo: string;
  ciot: number | string;
  totalQuebra: number;
  valorQuebraCiot: number;

  // Metadata para atalhos e links diretos
  shipmentId?: string;
  cteFileUrl?: string | null;
  ticketDescargaUrl?: string | null;
  ordemCarregamentoUrl?: string | null;
  advanceProofUrl?: string | null;
  balanceProofUrl?: string | null;
}

export interface ParseResult {
  sheetNames: string[];
  activeSheet: string;
  rows: TranscunhaSpreadsheetRow[];
  totalRows: number;
}

/**
 * Converte valor em formato string/número brasileiro para número válido
 */
export function parseNumberPtBr(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();
  // Remove R$, espaços, etc
  str = str.replace(/[R$\s]/g, '');
  if (!str) return 0;
  
  // Se contiver tanto ponto quanto vírgula (ex: 1.200,50 ou 1,200.50)
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Padrão brasileiro: 1.250,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Padrão americano: 1,250.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Apenas vírgula: 1250,50
    str = str.replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

/**
 * Converte data do Excel/Serial ou string para formato legível DD/MM/AAAA
 */
export function formatDatePtBr(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toLocaleDateString('pt-BR');
  }
  if (typeof val === 'number') {
    // Excel date serial
    try {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('pt-BR');
      }
    } catch {
      return String(val);
    }
  }
  const str = String(val).trim();
  // Se for ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.slice(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
}

/**
 * Converte qualquer valor de data (string BR, ISO, Date ou timestamp) para timestamp numérico para ordenação
 */
export function parseShipmentDate(val: any): number {
  if (!val) return 0;
  if (val instanceof Date) return isNaN(val.getTime()) ? 0 : val.getTime();
  if (typeof val === 'number') {
    if (val > 10000000000) return val;
    // Serial do Excel
    return new Date(Math.round((val - 25569) * 86400 * 1000)).getTime() || 0;
  }
  const str = String(val).trim();
  if (!str || str === '-' || str === '0') return 0;

  // DD/MM/YYYY ou DD/MM/YY ou DD/MM/YYYY HH:mm ou DD/MM/YY HH:mm:ss
  const brMatch = str.match(/(?:^|\s|-)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (brMatch) {
    const d = parseInt(brMatch[1], 10);
    const m = parseInt(brMatch[2], 10) - 1;
    let y = parseInt(brMatch[3], 10);
    if (y < 100) {
      y = y > 50 ? 1900 + y : 2000 + y;
    }
    const h = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
    const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    const s = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
    return new Date(y, m, d, h, min, s).getTime();
  }

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2}))?/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const h = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const min = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    return new Date(y, m, d, h, min).getTime();
  }

  const d = new Date(str).getTime();
  return isNaN(d) ? 0 : d;
}

/**
 * Formata a informação da coluna "CTE E HORAS" exatamente no modelo padrão solicitado:
 * [NUMERO_CTE] - [DD/MM/AA] - [HH:mm]
 * Exemplo: 1999 - 29/09/26 - 08:00
 */
export function formatCteAndHours(
  rawCte?: string | null,
  rawDateHour?: string | null,
  fallbackDate?: string | null,
  fallbackId?: string | null
): string {
  const fullStr = String(rawCte || '').trim();

  // Se o valor já estiver rigorosamente no formato padrão "XXXX - DD/MM/AA - HH:mm"
  if (/^[A-Za-z0-9\-_\.\/]+\s*-\s*\d{2}\/\d{2}\/\d{2}\s*-\s*\d{2}:\d{2}$/.test(fullStr)) {
    return fullStr;
  }
  // Se estiver no formato com ano de 4 dígitos "XXXX - DD/MM/AAAA - HH:mm"
  if (/^[A-Za-z0-9\-_\.\/]+\s*-\s*\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}:\d{2}$/.test(fullStr)) {
    return fullStr.replace(/(\d{2}\/\d{2}\/)20(\d{2})/, '$1$2');
  }

  // 1. Identificar o número do CT-e
  let cteNumber = '';
  if (rawCte && !/^\d{2}\/\d{2}\/\d{2,4}/.test(fullStr)) {
    if (fullStr.includes(' - ')) {
      cteNumber = fullStr.split(' - ')[0].trim();
    } else {
      cteNumber = fullStr;
    }
  }
  if (!cteNumber && fallbackId) {
    cteNumber = String(fallbackId).trim();
  }

  // 2. Identificar data e horário
  let sourceDateStr = '';
  if (rawDateHour && rawDateHour !== '-' && rawDateHour.trim() !== '') {
    sourceDateStr = String(rawDateHour).trim();
  } else if (rawCte && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(fullStr)) {
    sourceDateStr = fullStr;
  } else if (fallbackDate && fallbackDate !== '-' && fallbackDate.trim() !== '') {
    sourceDateStr = String(fallbackDate).trim();
  }

  let datePart = '';
  let timePart = '08:00';

  if (sourceDateStr) {
    // DD/MM/YYYY ou DD/MM/YY com HH:mm opcional
    const brMatch = sourceDateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[,\sT]+(\d{1,2}):(\d{1,2}))?/);
    if (brMatch) {
      const d = brMatch[1].padStart(2, '0');
      const m = brMatch[2].padStart(2, '0');
      let y = brMatch[3];
      if (y.length === 4) y = y.slice(-2);
      datePart = `${d}/${m}/${y}`;
      if (brMatch[4] && brMatch[5]) {
        timePart = `${brMatch[4].padStart(2, '0')}:${brMatch[5].padStart(2, '0')}`;
      }
    } else {
      // ISO YYYY-MM-DD
      const isoMatch = sourceDateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[,\sT]+(\d{1,2}):(\d{1,2}))?/);
      if (isoMatch) {
        const y = isoMatch[1].slice(-2);
        const m = isoMatch[2].padStart(2, '0');
        const d = isoMatch[3].padStart(2, '0');
        datePart = `${d}/${m}/${y}`;
        if (isoMatch[4] && isoMatch[5]) {
          timePart = `${isoMatch[4].padStart(2, '0')}:${isoMatch[5].padStart(2, '0')}`;
        }
      }
    }
  }

  if (!datePart) {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = String(today.getFullYear()).slice(-2);
    datePart = `${d}/${m}/${y}`;
  }

  const finalCte = cteNumber || (fallbackId ? String(fallbackId).trim() : 'CTE');
  return `${finalCte} - ${datePart} - ${timePart}`;
}

/**
 * Lê e analisa a planilha do Excel (XLSX, XLSM ou CSV)
 */
export function parseTranscunhaWorkbook(buffer: ArrayBuffer | Uint8Array, sheetNamePreference?: string): ParseResult {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    return { sheetNames: [], activeSheet: '', rows: [], totalRows: 0 };
  }

  // 1. Identificar métricas de cada aba (número de linhas estimadas via !ref)
  let bestSheetName = '';
  let maxRowCount = 0;
  for (const name of sheetNames) {
    const s = workbook.Sheets[name];
    if (s && s['!ref']) {
      const range = XLSX.utils.decode_range(s['!ref']);
      const count = Math.max(0, range.e.r - range.s.r + 1);
      if (count > maxRowCount) {
        maxRowCount = count;
        bestSheetName = name;
      }
    }
  }

  // 2. Encontrar melhor aba (com suporte a trim e seleção por maior volume)
  let activeSheet = '';
  if (sheetNamePreference) {
    const match = sheetNames.find(s => s === sheetNamePreference || s.trim().toLowerCase() === sheetNamePreference.trim().toLowerCase());
    if (match) activeSheet = match;
  }

  if (!activeSheet) {
    activeSheet = bestSheetName || sheetNames[0];
  }

  const sheet = workbook.Sheets[activeSheet];
  if (!sheet) {
    return { sheetNames, activeSheet, rows: [], totalRows: 0 };
  }

  // Converter para matriz de dados (raw array of arrays)
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (data.length === 0) {
    return { sheetNames, activeSheet, rows: [], totalRows: 0 };
  }

  // Localizar a linha de cabeçalho
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(10, data.length); r++) {
    const rowStr = data[r].map(c => String(c).toUpperCase()).join(' ');
    if (rowStr.includes('PLACA') || rowStr.includes('MOTORISTA') || rowStr.includes('CTE') || rowStr.includes('EMBARQUE')) {
      headerRowIndex = r;
      break;
    }
  }

  const headers = data[headerRowIndex].map(h => String(h || '').trim());
  const headerMap: { [key: string]: number } = {};

  headers.forEach((h, idx) => {
    if (!h) return;
    const clean = h.toUpperCase().replace(/\s+/g, ' ');
    headerMap[clean] = idx;
  });

  const getColIdx = (aliases: string[]): number => {
    for (const alias of aliases) {
      const upper = alias.toUpperCase();
      // Match exato
      if (headerMap[upper] !== undefined) return headerMap[upper];
      // Match parcial
      for (const [key, idx] of Object.entries(headerMap)) {
        if (key.includes(upper)) return idx;
      }
    }
    return -1;
  };

  // Mapeamento dos índices das 60 colunas
  const colIdx = {
    cteHoras: getColIdx(['CTE', 'CTE E HORAS', 'CTE HORAS', 'CTE/HORAS']),
    dataHoraEmissao: getColIdx(['DATA/HORA DE EMISSÃO', 'DATA/HORA DE EMISSAO', 'DATA HORA DE EMISSÃO', 'DATA HORA EMISSAO', 'DATA/HORA EMISSAO', 'DATA EMISSAO']),
    jaFaturado: getColIdx(['JÁ FATURADO', 'JA FATURADO', 'FATURADO']),
    dataVencimento: getColIdx(['DATA VENCIM', 'DATA VENCIMENTO', 'VENCIMENTO']),
    formaPagamento: getColIdx(['FORMA DE PAGAMENTO', 'FORMA PAGAMENTO']),
    dataPagamento: getColIdx(['DATA DO PAGAMENTO', 'DATA PAGAMENTO']),
    statusRecebimento: getColIdx(['A RECEBER OU RECEBIDO', 'STATUS RECEBIMENTO', 'RECEBIDO']),
    dataEmbarque: getColIdx(['DATA DO EMBARQUE', 'DATA EMBARQUE']),
    placa: getColIdx(['PLACA', 'PLACA CAVALO']),
    obsCavaloAntt: getColIdx(['PF/PJ OBS CAVALO ANTT', 'PF/PJ', 'OBS CAVALO']),
    codigoAtua: getColIdx(['CODIG ATUA', 'CODIGO ATUA', 'COD ATUA']),
    motorista: getColIdx(['MOTORISTA A CARREGAR', 'MOTORISTA', 'NOME MOTORISTA']),
    cpfMotorista: getColIdx(['CPF MOTORISTA', 'CPF', 'CPF CONDUTOR', 'CPF DO MOTORISTA']),
    proprietario: getColIdx(['PROPRIETARIO VEICULO', 'PROPRIETARIO', 'TRANSPORTADORA PROPRIETARIA']),
    anttContratoPix: getColIdx(['ANTT / PIX', 'ANTT/PIX', 'ANTT + CONTRATO/////PIX PAGO PRA ESSA ANTT', 'ANTT + CONTRATO', 'PIX PAGO PRA ESSA ANTT', 'PIX PAGO', 'CHAVE PIX', 'PIX', 'ANTT']),
    telefone: getColIdx(['TELEFONE', 'FONE', 'CELULAR', 'TEL', 'CONTATO']),
    solicitante: getColIdx(['SOLICITANTE', 'AGENCIADOR', 'RESPONSAVEL']),
    carregarEmpresa: getColIdx(['REMETENTE', 'CARREGAR EMPRESA', 'EMPRESA CARREGAR', 'COLETA', 'REMETENTE CTE']),
    numeroPedido: getColIdx(['NºPEDIDO', 'Nº DO PEDIDO', 'NUMERO DO PEDIDO', 'N PEDIDO', 'PEDIDO', 'Nº PEDIDO']),
    saldoOriginalPedido: getColIdx(['SALDO ORIGINAL DO PEDIDO', 'SALDO ORIGINAL']),
    produto: getColIdx(['PRODUTO', 'MERCADORIA']),
    tipoCarga: getColIdx(['TIPO', 'TIPO CARGA', 'EMBALAGEM']),
    transportadora: getColIdx(['TRANSPORTADORA']),
    cadastro: getColIdx(['CADASTRO', 'STATUS CADASTRO']),
    matrizFilial: getColIdx(['MATRIZ FILIAL', 'MATRIZ / FILIAL', 'FILIAL']),
    liberacao: getColIdx(['LIBERAÇÃO', 'LIBERACAO']),
    gr: getColIdx(['GR', 'GERENCIAMENTO DE RISCO']),
    ordemCarregamento: getColIdx(['ORDEM DE CARREG', 'ORDEM CARREGAMENTO', 'OC']),
    clienteTomadorPagador: getColIdx(['CLIENTE TOMADOR PAGADOR', 'CLIENTE PAGADOR', 'TOMADOR', 'CLIENTE']),
    freteEmpresaUnitario: getColIdx(['FRETE EMPRESA', 'VALOR FRETE EMPRESA']),
    origem: getColIdx(['ORIGEM', 'CIDADE ORIGEM']),
    kmDistancia: getColIdx(['KM DE DISTANCIA', 'KM DISTANCIA', 'KM']),
    destino: getColIdx(['DESTINO', 'CIDADE DESTINO']),
    eixo: getColIdx(['EIXO', 'EIXOS']),
    pedagio: getColIdx(['PEDAGIO', 'VALOR PEDAGIO']),
    peso: getColIdx(['PESO', 'TONELADAS', 'PESO CARGA']),
    freteBrutoEmpresa: getColIdx(['FRETE BRUTO', 'FRETE TOTAL EMPRESA']),
    icms: getColIdx(['ICMS', 'VALOR ICMS', 'VL ICMS', 'ICMS R$', 'ICMS DESTACADO', 'ICMS DESTAC']),
    debitoPisCofins: getColIdx(['DÉBITO PIS/COFINS', 'DEBITO PIS COFINS', 'DEBITO PIS/COFINS', 'DÉBITO PIS COFINS', 'PIS COFINS DEB', 'VALPR TOTAL', 'DEB PIS COFINS', 'IMPOSTO FEDERAL', 'IMP FEDERAL']),
    creditoPisCofins: getColIdx(['CRÉDITO PIS/COFINS', 'CREDITO PIS COFINS', 'CREDITO PIS/COFINS', 'CRÉDITO PIS COFINS', 'PIS COFINS CRED', 'CRED PIS COFINS', 'CRÉDITO GERADO', 'CREDITO GERADO', 'CRED GERADO']),
    patronal4: getColIdx(['PATRONAL 4%', 'PATRONAL 4', 'PATRONAL', 'INSS PATRONAL', 'PATRONAL4%', 'INSS PATRONAL / CPRB', 'INSS PATRONAL/CPRB', 'CPRB', 'INSS PATRONAL (4%)']),
    inssSestSenat: getColIdx(['INSS SEST/SENAT', 'INSS SEST SENAT', 'INSS SET SENAT', 'SEST SENAT', 'INSS/SEST/SENAT', 'SEST/SENAT', 'INSS', 'DESCONTO SEST/SENAT', 'DESCONTO SEST SENAT', 'SEST/SENAT:']),
    tarifaTonMotorista: getColIdx(['TON MOT', 'TARIFA MOTORISTA']),
    valorFreteMotorista: getColIdx(['VL PG MOT', 'VALOR PAGO MOTORISTA', 'FRETE MOTORISTA']),
    nfCliente: getColIdx(['NF CLIENTE', 'NF', 'NOTA FISCAL', 'NUMERO NF', 'Nº NF', 'NFE']),
    valorNf: getColIdx(['VALOR NF', 'VALOR NOTA']),
    cte: getColIdx(['CTE', 'NUMERO CTE']),
    controle: getColIdx(['CONTROLE', 'CONT']),
    status: getColIdx(['STATUS', 'STATUS VIAGEM']),
    percentualAdiantamento: getColIdx(['% ADIANT', 'PERC ADIANTAMENTO']),
    valorAdiantamento: getColIdx(['ADIANTAMENT', 'ADIANTAMENTO', 'VALOR ADIANTAMENTO']),
    horaDataLiberacaoAdiantamento: getColIdx(['HORA/DATA LIBER. ADIANTA', 'HORA/DATA LIBER. ADIANT', 'HORA-DATA LIBER ADIANT', 'HORA DATA LIBER ADIANT', 'DATA LIBER ADIANT', 'LIBERACAO ADIANTAMENTO', 'LIBER ADIANT']),
    ticketDescarga: getColIdx(['TIKIT DESCARGA', 'TICKET DESCARGA', 'TIQUET']),
    pesoChegada: getColIdx(['PESO CHEGADA', 'PESO DESCARGA']),
    saldo: getColIdx(['SALDO RESTANTE', 'SALDO', 'VALOR SALDO']),
    horaDataLiberacaoSaldo: getColIdx(['HORA-DATA LIBER SALD', 'HORA DATA LIBER SALD', 'DATA LIBER SALDO', 'LIBERACAO SALDO', 'LIBER SALD']),
    tipoPagamentoSaldo: getColIdx(['TIPO DE PAGAMENTO', 'TIPO PAGAMENTO']),
    statusSaldo: getColIdx(['STATUS DO SALDC', 'STATUS DO SALDO', 'STATUS SALDO']),
    ciot: getColIdx(['CIOT', 'NUMERO CIOT']),
    totalQuebra: getColIdx(['QUEBRA (TON)', 'TOTAL QUEBRA', 'QUEBRA', 'DIF PESO', 'QUEBRA PESO']),
    valorQuebraCiot: getColIdx(['VALOR TOTAL', 'VAL-CIO', 'VAL-CIOT', 'VALOR CIOT', 'VALOR QUEBRA', 'TOTAL VALOR']),
  };

  const rows: TranscunhaSpreadsheetRow[] = [];

  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;

    // Helper de extração por índice ou posição padrão
    const getVal = (idx: number, fallbackIdx?: number): any => {
      if (idx >= 0 && row[idx] !== undefined) return row[idx];
      if (fallbackIdx !== undefined && row[fallbackIdx] !== undefined) return row[fallbackIdx];
      return '';
    };

    const placa = String(getVal(colIdx.placa, 7)).trim();
    const motorista = String(getVal(colIdx.motorista, 10)).trim();
    const rawCteHoras = String(getVal(colIdx.cteHoras, 0)).trim();
    const cteVal = String(getVal(colIdx.cte, 45) || '').trim();
    const dataEmbarqueVal = formatDatePtBr(getVal(colIdx.dataEmbarque, 6));

    // Linha vazia ou sem informações cruciais
    if (!placa && !motorista && !rawCteHoras && !cteVal) continue;

    const cteHoras = formatCteAndHours(rawCteHoras || cteVal, null, dataEmbarqueVal, cteVal || placa);

    const peso = parseNumberPtBr(getVal(colIdx.peso, 34));
    const freteEmpresaUnitario = parseNumberPtBr(getVal(colIdx.freteEmpresaUnitario, 28));
    let freteBruto = parseNumberPtBr(getVal(colIdx.freteBrutoEmpresa, 35));
    if (freteBruto === 0 && freteEmpresaUnitario > 0 && peso > 0) {
      freteBruto = freteEmpresaUnitario * peso;
    }

    const tarifaTonMotorista = parseNumberPtBr(getVal(colIdx.tarifaTonMotorista, 41));
    const pedagioVal = parseNumberPtBr(getVal(colIdx.pedagio, 33));
    let valorFreteMotorista = parseNumberPtBr(getVal(colIdx.valorFreteMotorista, 42));
    if (valorFreteMotorista === 0 && tarifaTonMotorista > 0 && peso > 0) {
      valorFreteMotorista = Math.max(0, Number(((tarifaTonMotorista * peso) - pedagioVal).toFixed(2)));
    }

    const valorAdiantamento = parseNumberPtBr(getVal(colIdx.valorAdiantamento, 49));
    const saldo = parseNumberPtBr(getVal(colIdx.saldo, 53));

    rows.push({
      id: `row_${r}_${cteHoras || placa || r}`,
      orderIndex: r,
      cteHoras,
      dataHoraEmissao: String(getVal(colIdx.dataHoraEmissao) || '').trim() || (dataEmbarqueVal ? `${dataEmbarqueVal} 08:00` : ''),
      jaFaturado: String(getVal(colIdx.jaFaturado, 1) || '').trim().toUpperCase(),
      dataVencimento: formatDatePtBr(getVal(colIdx.dataVencimento, 2)),
      formaPagamento: String(getVal(colIdx.formaPagamento, 3) || '').trim(),
      dataPagamento: formatDatePtBr(getVal(colIdx.dataPagamento, 4)),
      statusRecebimento: String(getVal(colIdx.statusRecebimento, 5) || '').trim().toUpperCase(),

      dataEmbarque: formatDatePtBr(getVal(colIdx.dataEmbarque, 6)),
      placa: placa.toUpperCase(),
      obsCavaloAntt: String(getVal(colIdx.obsCavaloAntt, 8) || '').trim(),
      codigoAtua: String(getVal(colIdx.codigoAtua, 9) || '').trim(),
      motorista,
      cpfMotorista: String(getVal(colIdx.cpfMotorista, 11) || '').trim(),

      proprietario: String(getVal(colIdx.proprietario, 12) || '').trim(),
      anttContratoPix: String(getVal(colIdx.anttContratoPix, 13) || '').trim(),
      telefone: String(getVal(colIdx.telefone, 14) || '').trim(),
      solicitante: String(getVal(colIdx.solicitante, 15) || '').trim(),
      carregarEmpresa: String(getVal(colIdx.carregarEmpresa, 16) || '').trim(),
      numeroPedido: String(getVal(colIdx.numeroPedido, 17) || '').trim(),
      saldoOriginalPedido: String(getVal(colIdx.saldoOriginalPedido, 18) || '').trim(),
      produto: String(getVal(colIdx.produto, 19) || '').trim(),
      tipoCarga: String(getVal(colIdx.tipoCarga, 20) || '').trim(),

      transportadora: String(getVal(colIdx.transportadora, 21) || '').trim(),
      cadastro: String(getVal(colIdx.cadastro, 22) || '').trim(),
      matrizFilial: String(getVal(colIdx.matrizFilial, 23) || '').trim(),
      liberacao: String(getVal(colIdx.liberacao, 24) || '').trim(),
      gr: String(getVal(colIdx.gr, 25) || '').trim(),
      ordemCarregamento: String(getVal(colIdx.ordemCarregamento, 26) || '').trim(),

      clienteTomadorPagador: String(getVal(colIdx.clienteTomadorPagador, 27) || '').trim(),
      freteEmpresaUnitario,
      origem: String(getVal(colIdx.origem, 29) || '').trim(),
      kmDistancia: String(getVal(colIdx.kmDistancia, 30) || '').trim(),
      destino: String(getVal(colIdx.destino, 31) || '').trim(),
      eixo: String(getVal(colIdx.eixo, 32) || '').trim(),
      pedagio: parseNumberPtBr(getVal(colIdx.pedagio, 33)),
      peso,

      freteBrutoEmpresa: freteBruto,
      icms: parseNumberPtBr(getVal(colIdx.icms, 36)),
      debitoPisCofins: parseNumberPtBr(getVal(colIdx.debitoPisCofins, 37)),
      creditoPisCofins: parseNumberPtBr(getVal(colIdx.creditoPisCofins, 38)),
      patronal4: parseNumberPtBr(getVal(colIdx.patronal4, 39)),
      inssSestSenat: parseNumberPtBr(getVal(colIdx.inssSestSenat, 40)),

      tarifaTonMotorista,
      valorFreteMotorista,
      nfCliente: String(getVal(colIdx.nfCliente, 43) || '').trim(),
      valorNf: parseNumberPtBr(getVal(colIdx.valorNf, 44)),
      cte: String(getVal(colIdx.cte, 45) || '').trim(),
      controle: String(getVal(colIdx.controle, 46) || '').trim(),
      status: String(getVal(colIdx.status, 47) || 'CARREGADO').trim(),

      percentualAdiantamento: parseNumberPtBr(getVal(colIdx.percentualAdiantamento, 48)),
      valorAdiantamento,
      horaDataLiberacaoAdiantamento: String(getVal(colIdx.horaDataLiberacaoAdiantamento, 50) || '').trim(),
      ticketDescarga: String(getVal(colIdx.ticketDescarga, 51) || '').trim().toUpperCase(),
      pesoChegada: parseNumberPtBr(getVal(colIdx.pesoChegada, 52)),
      saldo,

      horaDataLiberacaoSaldo: String(getVal(colIdx.horaDataLiberacaoSaldo, 54) || '').trim(),
      tipoPagamentoSaldo: String(getVal(colIdx.tipoPagamentoSaldo, 55) || '').trim(),
      statusSaldo: String(getVal(colIdx.statusSaldo, 56) || 'PENDENTE').trim().toUpperCase(),
      ciot: String(getVal(colIdx.ciot, 57) || '').trim(),
      totalQuebra: parseNumberPtBr(getVal(colIdx.totalQuebra, 58)),
      valorQuebraCiot: parseNumberPtBr(getVal(colIdx.valorQuebraCiot, 59)),
    });
  }

  // Ordena os registros por data de embarque decrescente (o mais recente emitido sempre no topo)
  rows.sort((a, b) => {
    const dateA = parseShipmentDate(a.dataEmbarque);
    const dateB = parseShipmentDate(b.dataEmbarque);
    if (dateA !== dateB) return dateB - dateA;
    return (b.orderIndex ?? 0) - (a.orderIndex ?? 0);
  });

  return {
    sheetNames,
    activeSheet,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Registros reais capturados diretamente da planilha operacional da DLLOG Transportes
 */
export const SAMPLE_TRANSCUNHA_SHEET_ROWS: TranscunhaSpreadsheetRow[] = [
  {
    id: 'row_1874',
    cteHoras: '1822 - 01/09/26 - 08:00',
    jaFaturado: 'SIM',
    dataVencimento: '15/09/2026',
    formaPagamento: 'FATURAS 14 DIAS',
    dataPagamento: '15/09/2026',
    statusRecebimento: 'RECEBIDO',
    dataEmbarque: '01/09/2026',
    placa: 'BTO4B57',
    obsCavaloAntt: 'PJ-SN',
    codigoAtua: '4309',
    motorista: 'LUCIANO MARCOS DE OLIVEIRA',
    cpfMotorista: '031.860.816-29',
    proprietario: '54.712.206 LUCIANO MARCOS DE OLIVEIRA',
    anttContratoPix: '54.712.206 LUCIANO MARCOS DE OLIVEIRA',
    telefone: '(35)99710-0964',
    solicitante: 'EXENPLO MAURILIO TESTE',
    carregarEmpresa: 'USINA MONTE ALEGRE',
    numeroPedido: 'PED-4412',
    saldoOriginalPedido: '150.00',
    produto: 'AÇUCAR 50KG',
    tipoCarga: 'SACOS',
    transportadora: 'DLLOG TRANSPORTES',
    cadastro: 'LIBERADO',
    matrizFilial: 'MATRIZ',
    liberacao: 'LIB-9941',
    gr: 'BUONNY OK',
    ordemCarregamento: 'OC-1822',
    clienteTomadorPagador: 'USINA MONTE ALEGRE - MONTE BELO MG',
    freteEmpresaUnitario: 1200.00,
    origem: 'MONTE BELO-MG',
    kmDistancia: 'DIARIAS',
    destino: 'CUBATAO-SP',
    eixo: '7-EIXO',
    pedagio: 0.00,
    peso: 45.29,
    freteBrutoEmpresa: 1200.00,
    icms: 0.00,
    debitoPisCofins: 0.00,
    creditoPisCofins: 0.00,
    patronal4: 0.00,
    inssSestSenat: 0.00,
    tarifaTonMotorista: 0.00,
    valorFreteMotorista: 0.00,
    nfCliente: '0',
    valorNf: 1200.00,
    cte: '1822',
    controle: '1822',
    status: 'CARREGADO',
    percentualAdiantamento: 100,
    valorAdiantamento: 1200.00,
    horaDataLiberacaoAdiantamento: '01/09/2026 14:30',
    ticketDescarga: 'SIM',
    pesoChegada: 45.29,
    saldo: 0.00,
    horaDataLiberacaoSaldo: '02/09/2026 10:15',
    tipoPagamentoSaldo: 'EFRETE/PRAZO',
    statusSaldo: 'PAGO',
    ciot: '5698552365,00',
    totalQuebra: 0.00,
    valorQuebraCiot: 0.00,
  },
  {
    id: 'row_1876',
    cteHoras: '1824',
    jaFaturado: 'SIM',
    dataVencimento: '15/09/2026',
    formaPagamento: 'BOLETO',
    dataPagamento: '15/09/2026',
    statusRecebimento: 'A RECEBER',
    dataEmbarque: '01/09/2026',
    placa: 'RSS-0F66',
    obsCavaloAntt: 'PJ-R',
    codigoAtua: '2386',
    motorista: 'ROGERIO FRANCISCO DA SILVA',
    cpfMotorista: '887.236.581-34',
    proprietario: 'TRANSPORTADORA BETIM LTDA ME',
    anttContratoPix: 'TRANSPORTADORA BETIM LTDA ME',
    telefone: '(64)99289-7572',
    solicitante: 'EXENPLO MAURILIO TESTE',
    carregarEmpresa: 'YARA BRASIL',
    numeroPedido: 'PED-9081',
    saldoOriginalPedido: '240.00',
    produto: 'FOSFATO',
    tipoCarga: 'GRANEL',
    transportadora: 'DLLOG TRANSPORTES',
    cadastro: 'LIBERADO',
    matrizFilial: 'MATRIZ',
    liberacao: 'LIB-8841',
    gr: 'BRK OK',
    ordemCarregamento: 'OC-1824',
    clienteTomadorPagador: 'ORGANICS NAZARIO-GO',
    freteEmpresaUnitario: 190.00,
    origem: 'LAGAMAR-MG',
    kmDistancia: '580',
    destino: 'NAZARIO-GOIAS',
    eixo: '9-EIXO',
    pedagio: 0.00,
    peso: 47.76,
    freteBrutoEmpresa: 9074.40,
    icms: 635.21,
    debitoPisCofins: 140.04,
    creditoPisCofins: 0.00,
    patronal4: 0.00,
    inssSestSenat: 0.00,
    tarifaTonMotorista: 145.00,
    valorFreteMotorista: 6925.20,
    nfCliente: '2868',
    valorNf: 5587.44,
    cte: '1824',
    controle: '1824',
    status: 'CARREGADO',
    percentualAdiantamento: 0,
    valorAdiantamento: 0.00,
    horaDataLiberacaoAdiantamento: '-',
    ticketDescarga: 'SIM',
    pesoChegada: 47.76,
    saldo: 6855.30,
    horaDataLiberacaoSaldo: '03/09/2026 16:40',
    tipoPagamentoSaldo: 'EFRETE/PRAZO',
    statusSaldo: 'PAGO',
    ciot: '5698552365,00',
    totalQuebra: -0.22,
    valorQuebraCiot: 13.71,
  },
  {
    id: 'row_1877',
    cteHoras: '1825',
    jaFaturado: 'SIM',
    dataVencimento: '16/09/2026',
    formaPagamento: 'BOLETO',
    dataPagamento: '16/09/2026',
    statusRecebimento: 'A RECEBER',
    dataEmbarque: '01/09/2026',
    placa: 'QUH6A34',
    obsCavaloAntt: 'PJ-R',
    codigoAtua: '4946',
    motorista: 'JHONATA CARDOSO AIRES',
    cpfMotorista: '017.745.392-33',
    proprietario: 'TRANSPORTADORA BETIM LTDA ME',
    anttContratoPix: 'TRANSPORTADORA BETIM LTDA ME',
    telefone: '(63)99203-6183',
    solicitante: 'EXENPLO MAURILIO TESTE',
    carregarEmpresa: 'YARA BRASIL',
    numeroPedido: 'PED-9082',
    saldoOriginalPedido: '190.00',
    produto: 'FOSFATO',
    tipoCarga: 'GRANEL',
    transportadora: 'DLLOG TRANSPORTES',
    cadastro: 'LIBERADO',
    matrizFilial: 'MATRIZ',
    liberacao: 'LIB-8842',
    gr: 'BRK OK',
    ordemCarregamento: 'OC-1825',
    clienteTomadorPagador: 'ORGANICS NAZARIO-GO',
    freteEmpresaUnitario: 190.00,
    origem: 'LAGAMAR-MG',
    kmDistancia: '580',
    destino: 'NAZARIO-GOIAS',
    eixo: '9-EIXO',
    pedagio: 0.00,
    peso: 46.98,
    freteBrutoEmpresa: 8926.20,
    icms: 624.83,
    debitoPisCofins: 137.75,
    creditoPisCofins: 0.00,
    patronal4: 0.00,
    inssSestSenat: 0.00,
    tarifaTonMotorista: 145.00,
    valorFreteMotorista: 6812.10,
    nfCliente: '2869',
    valorNf: 5496.19,
    cte: '1825',
    controle: '1825',
    status: 'CARREGADO',
    percentualAdiantamento: 0,
    valorAdiantamento: 0.00,
    horaDataLiberacaoAdiantamento: '-',
    ticketDescarga: 'SIM',
    pesoChegada: 46.98,
    saldo: 6812.10,
    horaDataLiberacaoSaldo: '03/09/2026 17:00',
    tipoPagamentoSaldo: 'EFRETE/PRAZO',
    statusSaldo: 'PAGO',
    ciot: '5698552365,00',
    totalQuebra: 0.00,
    valorQuebraCiot: 13.62,
  },
  {
    id: 'row_1882',
    cteHoras: '1830',
    jaFaturado: 'SIM',
    dataVencimento: '16/09/2026',
    formaPagamento: 'FATURAS 14 DIAS',
    dataPagamento: '16/09/2026',
    statusRecebimento: 'A RECEBER',
    dataEmbarque: '02/09/2026',
    placa: 'BWL1A00',
    obsCavaloAntt: 'PJ-R',
    codigoAtua: '4280',
    motorista: 'RAFAEL CARNEIRO BORGES',
    cpfMotorista: '438.203.828-60',
    proprietario: 'RAFAEL CARNEIRO BORGES',
    anttContratoPix: 'RAFAEL CARNEIRO BORGES',
    telefone: '(35)99983-1692',
    solicitante: 'EXENPLO MAURILIO TESTE',
    carregarEmpresa: 'USINA MONTE ALEGRE',
    numeroPedido: 'PED-7712',
    saldoOriginalPedido: '420.00',
    produto: 'AÇUCAR 50KG',
    tipoCarga: 'SACOS',
    transportadora: 'DLLOG TRANSPORTES',
    cadastro: 'LIBERADO',
    matrizFilial: 'MATRIZ',
    liberacao: 'LIB-7712',
    gr: 'BUONNY OK',
    ordemCarregamento: 'OC-1830',
    clienteTomadorPagador: 'USINA MONTE ALEGRE - MONTE BELO MG',
    freteEmpresaUnitario: 175.00,
    origem: 'MONTE BELO-MG',
    kmDistancia: '430',
    destino: 'CUBATAO-SP',
    eixo: '6-EIXO',
    pedagio: 401.67,
    peso: 32.37,
    freteBrutoEmpresa: 5664.75,
    icms: 0.00,
    debitoPisCofins: 0.00,
    creditoPisCofins: -342.66,
    patronal4: 0.00,
    inssSestSenat: 0.00,
    tarifaTonMotorista: 165.00,
    valorFreteMotorista: 4939.38,
    nfCliente: '39396',
    valorNf: 65450.52,
    cte: '1830',
    controle: '1830',
    status: 'CARREGADO',
    percentualAdiantamento: 70,
    valorAdiantamento: 4445.44,
    horaDataLiberacaoAdiantamento: '02/09/2026 11:20',
    ticketDescarga: 'SIM',
    pesoChegada: 32.37,
    saldo: 356.83,
    horaDataLiberacaoSaldo: '04/09/2026 09:30',
    tipoPagamentoSaldo: 'EFRETE/PRAZO',
    statusSaldo: 'PAGO',
    ciot: '5698552365,00',
    totalQuebra: 0.00,
    valorQuebraCiot: 9.60,
  },
  {
    id: 'row_1887',
    cteHoras: '1786',
    jaFaturado: 'SIM',
    dataVencimento: '18/09/2026',
    formaPagamento: 'BOLETO 02-10',
    dataPagamento: '18/09/2026',
    statusRecebimento: 'A RECEBER',
    dataEmbarque: '02/09/2026',
    placa: 'RBP7D09',
    obsCavaloAntt: 'PJ-SN',
    codigoAtua: '4970',
    motorista: 'WILSON APARECIDO FAURA',
    cpfMotorista: '020.068.519-85',
    proprietario: 'JM SERVICOS AGRICOLAS E TRANSPORTES LTDA',
    anttContratoPix: 'JM SERVICOS AGRICOLAS E TRANSPORTES LTDA',
    telefone: '(64)99998-3907',
    solicitante: 'EXENPLO MAURILIO TESTE',
    carregarEmpresa: 'YARA BRASIL',
    numeroPedido: 'PED-5591',
    saldoOriginalPedido: '300.00',
    produto: 'FOSFATO',
    tipoCarga: 'GRANEL',
    transportadora: 'FILIAL SP',
    cadastro: 'LIBERADO',
    matrizFilial: 'FILIAL',
    liberacao: 'LIB-5591',
    gr: 'BRK OK',
    ordemCarregamento: 'OC-1786',
    clienteTomadorPagador: 'ORGANICS MINEIROS-GO',
    freteEmpresaUnitario: 235.00,
    origem: 'LAGAMAR-MG',
    kmDistancia: '690',
    destino: 'MINEIROS-GO',
    eixo: '9-EIXO',
    pedagio: 0.00,
    peso: 47.92,
    freteBrutoEmpresa: 11261.20,
    icms: 788.28,
    debitoPisCofins: 303.85,
    creditoPisCofins: 0.00,
    patronal4: 0.00,
    inssSestSenat: 0.00,
    tarifaTonMotorista: 200.00,
    valorFreteMotorista: 9584.00,
    nfCliente: '3018',
    valorNf: 5606.16,
    cte: '1786',
    controle: '1786',
    status: 'CARREGADO',
    percentualAdiantamento: 80,
    valorAdiantamento: 7667.20,
    horaDataLiberacaoAdiantamento: '02/09/2026 15:45',
    ticketDescarga: 'SIM',
    pesoChegada: 47.92,
    saldo: 1916.80,
    horaDataLiberacaoSaldo: '05/09/2026 11:00',
    tipoPagamentoSaldo: 'EFRETE/PRAZO',
    statusSaldo: 'PAGO',
    ciot: '5698552365,00',
    totalQuebra: 0.00,
    valorQuebraCiot: 19.16,
  }
];

export const STORAGE_KEY_SPREADSHEET_ROWS = 'transcunha_control_spreadsheet_rows_v2';
export const STORAGE_KEY_SPREADSHEET_SHEETS = 'transcunha_control_spreadsheet_sheets_v2';
export const STORAGE_KEY_ACTIVE_SHEET = 'transcunha_control_spreadsheet_active_sheet_v2';

/**
 * Recalcula campos dependentes seguindo fórmulas e funções idênticas ao Excel
 */
export function recalculateSpreadsheetRow(row: TranscunhaSpreadsheetRow): TranscunhaSpreadsheetRow {
  const updated = { ...row };

  // 1. Frete Bruto Empresa = Frete Empresa Unitário * Peso
  if (updated.freteEmpresaUnitario > 0 && updated.peso > 0) {
    updated.freteBrutoEmpresa = Number((updated.freteEmpresaUnitario * updated.peso).toFixed(2));
  }

  // 2. Valor Frete Motorista = (Tarifa Ton Motorista * Peso) - Pedágio (somente conta bancária)
  if (updated.tarifaTonMotorista > 0 && updated.peso > 0) {
    const bruto = Number((updated.tarifaTonMotorista * updated.peso).toFixed(2));
    updated.valorFreteMotorista = Math.max(0, Number((bruto - (updated.pedagio || 0)).toFixed(2)));
  }

  // 3. Valor Adiantamento = Valor Frete Motorista * (% Adiantamento / 100)
  if (updated.valorFreteMotorista > 0 && updated.percentualAdiantamento > 0) {
    updated.valorAdiantamento = Number((updated.valorFreteMotorista * (updated.percentualAdiantamento / 100)).toFixed(2));
  }

  // 4. Total Quebra (Ton) = Peso Carregamento - Peso Chegada
  if (updated.peso > 0 && updated.pesoChegada > 0) {
    const diff = updated.peso - updated.pesoChegada;
    updated.totalQuebra = Number((diff > 0 ? diff : 0).toFixed(2));
  }

  // 5. Saldo = Frete Motorista - Adiantamento - Desconto/Quebra
  const baseFreteMot = updated.valorFreteMotorista || 0;
  const adiant = updated.valorAdiantamento || 0;
  const quebraDesc = updated.valorQuebraCiot || 0;
  const calculatedSaldo = Math.max(0, baseFreteMot - adiant - quebraDesc);
  updated.saldo = Number(calculatedSaldo.toFixed(2));

  // 6. Status do Saldo automático
  if (updated.saldo <= 0) {
    updated.statusSaldo = 'PAGO';
  } else if (!updated.statusSaldo || updated.statusSaldo === 'PAGO') {
    updated.statusSaldo = 'PENDENTE';
  }

  // 7. Impostos estimados caso ainda não preenchidos
  if (updated.freteBrutoEmpresa > 0 && updated.debitoPisCofins === 0) {
    updated.debitoPisCofins = Number((updated.freteBrutoEmpresa * 0.0925).toFixed(2));
  }
  const isPf = updated.obsCavaloAntt?.includes('PF') || updated.obsCavaloAntt?.includes('TAC');
  if (updated.valorFreteMotorista > 0 && updated.patronal4 === 0 && isPf) {
    const baseInss = Math.max(0, updated.valorFreteMotorista - (updated.pedagio || 0));
    updated.patronal4 = Number((baseInss * 0.04).toFixed(2));
  }
  if (updated.valorFreteMotorista > 0 && updated.inssSestSenat === 0) {
    if (isPf) {
      const tacTaxes = calculateTacTaxDeductions(updated.valorFreteMotorista, updated.pedagio || 0);
      updated.inssSestSenat = tacTaxes.sestSenat;
    } else {
      updated.inssSestSenat = 0;
    }
  }

  return updated;
}

/**
 * Cria uma nova linha vazia com formatação padrão pronta para edição
 */
export function createNewEmptyRow(index: number = 1, idEmbarqueSistema?: string): TranscunhaSpreadsheetRow {
  const today = new Date().toLocaleDateString('pt-BR');
  const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const randomCte = String(2000 + Math.floor(Math.random() * 8000));

  return {
    id: `row_manual_${Date.now()}_${index}`,
    orderIndex: Date.now() + index,
    idEmbarqueSistema: idEmbarqueSistema || '',
    cteHoras: formatCteAndHours(randomCte, `${today} ${nowTime}`),
    jaFaturado: 'NÃO',
    dataVencimento: today,
    formaPagamento: 'FATURAS 14 DIAS',
    dataPagamento: today,
    statusRecebimento: 'A RECEBER',
    dataEmbarque: today,
    placa: '',
    obsCavaloAntt: 'PJ-SN',
    codigoAtua: String(4300 + index),
    motorista: '',
    cpfMotorista: '',
    proprietario: '',
    anttContratoPix: '',
    telefone: '',
    solicitante: 'Controladoria DLLOG Transportes',
    carregarEmpresa: '',
    numeroPedido: `PED-${randomCte}`,
    saldoOriginalPedido: '0.00',
    produto: 'SOJA EM GRÃOS',
    tipoCarga: 'GRANEL',
    transportadora: 'DLLOG TRANSPORTES',
    cadastro: 'LIBERADO',
    matrizFilial: 'MATRIZ',
    liberacao: 'LIB-OK',
    gr: 'BUONNY OK',
    ordemCarregamento: `OC-${randomCte}`,
    clienteTomadorPagador: '',
    freteEmpresaUnitario: 0,
    origem: '',
    kmDistancia: '',
    destino: '',
    eixo: '7-EIXO',
    pedagio: 0,
    peso: 0,
    freteBrutoEmpresa: 0,
    icms: 0,
    debitoPisCofins: 0,
    creditoPisCofins: 0,
    patronal4: 0,
    inssSestSenat: 0,
    tarifaTonMotorista: 0,
    valorFreteMotorista: 0,
    nfCliente: '',
    valorNf: 0,
    cte: randomCte,
    controle: randomCte,
    status: 'CARREGADO',
    percentualAdiantamento: 70,
    valorAdiantamento: 0,
    horaDataLiberacaoAdiantamento: `${today} ${nowTime}`,
    ticketDescarga: 'SIM',
    pesoChegada: 0,
    saldo: 0,
    horaDataLiberacaoSaldo: '',
    tipoPagamentoSaldo: 'PIX - E-FRETE',
    statusSaldo: 'PENDENTE',
    ciot: '5698552365,00',
    totalQuebra: 0,
    valorQuebraCiot: 0,
  };
}

import {
  saveSpreadsheetRowsToIndexedDB,
  clearSpreadsheetStorage,
  getSpreadsheetRowsMemoryCache
} from './transcunhaSpreadsheetStorage';

/**
 * Carrega as linhas persistidas (verificando cache em memória e localStorage como fallback síncrono)
 */
export function loadPersistedSpreadsheetRows(): TranscunhaSpreadsheetRow[] | null {
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('transcunha_spreadsheet_user_deleted') === 'true') {
        return null;
      }
    } catch {}
  }
  const memory = getSpreadsheetRowsMemoryCache();
  if (memory && memory.length >= 1000) return memory;
  return null;
}

/**
 * Salva as linhas com persistência permanente no IndexedDB (sem limite de 5MB)
 */
export function savePersistedSpreadsheetRows(rows: TranscunhaSpreadsheetRow[], sheetName?: string): boolean {
  if (typeof window === 'undefined') return false;
  // Dispara salvamento permanente assíncrono no IndexedDB
  saveSpreadsheetRowsToIndexedDB(rows, sheetName).catch(err => {
    console.error('Falha ao salvar no IndexedDB:', err);
  });
  return true;
}

/**
 * Remove os dados persistidos para restaurar dados padrão
 */
export function clearPersistedSpreadsheetRows(): void {
  clearSpreadsheetStorage().catch(() => {});
}
