/**
 * bulkCargoParser.ts
 *
 * Motor de parsing multimodal (WhatsApp e OCR de Roteiros/Documentos),
 * normalizador de cidades brasileiras, cálculos financeiros com ICMS e margens,
 * e gerador de agendamento diário com regra de corte das 16:00.
 */

import { BRAZILIAN_CITIES } from '../brazilianCities';
import {
  Cargo,
  CargoStatus,
  CargoType,
  Client,
  DailyScheduleEntry,
  DailyScheduleType,
  FreightLeg,
  Product,
  VehicleBodyType,
  VehicleSetType
} from '../types';
import { GoogleGenAI } from '@google/genai';

export interface ParsedBulkCargo {
  tempId: string;
  clientId: string;
  productId: string;
  origin: string;
  originLocation?: string;
  originMapLink?: string;
  destination: string;
  destinationLocation?: string;
  destinationMapLink?: string;
  totalVolume: number;
  // Financeiro
  companyFreightValuePerTon: number;
  hasIcms: boolean;
  icmsPercentage: number;
  driverFreightValuePerTon: number; // PJ (-8%)
  driverFreightValuePerTonPf: number; // PF (-12%)
  // Conjuntos Permitidos
  allowedVehicleTypes: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[];
  // Roteiro e Anexos
  observations: string;
  attachments?: string[];
  rawText?: string;
  // Validação
  status: 'ready' | 'warning' | 'error';
  validationErrors: string[];
  validationWarnings: string[];
}

/**
 * Remove acentuação e caracteres especiais para comparação fonética/textual.
 */
export function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Normaliza uma string de cidade para o padrão oficial brasileiro "Cidade, UF".
 * Ex: "PEROLANDIA-GO" -> "Perolândia, GO"
 * Ex: "DESCALVADO SP" -> "Descalvado, SP"
 */
export function normalizeCity(rawText: string, defaultUf: string = 'GO'): string {
  if (!rawText) return '';

  let cleaned = rawText.trim();

  // Remove parênteses com locais (ex: "(MILHÃO)", "(ROYAL CANIN)")
  cleaned = cleaned.replace(/\([^)]*\)/g, '').trim();

  // Trata separadores comuns como "-", "/", " - ", " / "
  const parts = cleaned.split(/[\-\/]/);
  let cityName = parts[0]?.trim() || '';
  let uf = parts[1]?.trim()?.toUpperCase() || '';

  // Se a UF veio grudada no final (ex: "GOIANIRAGO" ou "GOIANIRA GO")
  if (!uf) {
    const spaceMatch = cityName.match(/^(.+?)\s+([A-Za-z]{2})$/);
    if (spaceMatch) {
      cityName = spaceMatch[1].trim();
      uf = spaceMatch[2].toUpperCase();
    } else {
      uf = defaultUf;
    }
  }

  const cleanCityNorm = removeAccents(cityName);
  const cleanUfNorm = uf.toUpperCase();

  // 1. Busca exata em BRAZILIAN_CITIES
  const exactMatch = BRAZILIAN_CITIES.find((c) => {
    const [cName, cUf] = c.split(', ');
    return removeAccents(cName) === cleanCityNorm && cUf?.toUpperCase() === cleanUfNorm;
  });
  if (exactMatch) return exactMatch;

  // 2. Busca aproximada pelo nome da cidade
  const nameMatch = BRAZILIAN_CITIES.find((c) => {
    const [cName] = c.split(', ');
    return removeAccents(cName) === cleanCityNorm;
  });
  if (nameMatch) return nameMatch;

  // 3. Fallback: Capitaliza as palavras e retorna "Cidade, UF"
  const formattedCityName = cityName
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

  return `${formattedCityName}, ${cleanUfNorm || defaultUf}`;
}

/**
 * Extrai o local/fazenda de dentro de parênteses ou delimitadores.
 * Ex: "GOIANIRA-GO (MILHÃO)" -> "MILHÃO"
 */
export function extractLocationFromCityString(str: string): { cityText: string; location: string } {
  const match = str.match(/\(([^)]+)\)/);
  const location = match ? match[1].trim() : '';
  const cityText = str.replace(/\([^)]+\)/g, '').trim();
  return { cityText, location };
}

/**
 * Retorna os conjuntos padrão mais comuns no transporte de grãos/fertilizantes:
 * LS Simples, Carreta 4º Eixo, Bitrem 7e, Bitrem 8e, Rodotrem (Graneleiro e Basculante).
 */
export function getDefaultAllowedVehicles(): { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[] {
  return [
    {
      setType: VehicleSetType.LSSimples,
      bodyTypes: [VehicleBodyType.Graneleiro, VehicleBodyType.Basculante]
    },
    {
      setType: VehicleSetType.Carreta4e,
      bodyTypes: [VehicleBodyType.Graneleiro, VehicleBodyType.Basculante]
    },
    {
      setType: VehicleSetType.Bitrem7e,
      bodyTypes: [VehicleBodyType.Graneleiro, VehicleBodyType.Basculante]
    },
    {
      setType: VehicleSetType.Bitrem8e,
      bodyTypes: [VehicleBodyType.Graneleiro, VehicleBodyType.Basculante]
    },
    {
      setType: VehicleSetType.Rodotrem,
      bodyTypes: [VehicleBodyType.Graneleiro, VehicleBodyType.Basculante]
    }
  ];
}

/**
 * Calcula os valores financeiros aplicando a regra de ICMS e margens:
 * Base Líquida = Frete Empresa - (Frete Empresa * ICMS%)
 * Motorista PJ (-8%) = Base Líquida * (1 - 0.08)
 * Motorista PF (-12%) = Base Líquida * (1 - 0.12)
 */
export function calculateFinancials(
  companyFreight: number,
  hasIcms: boolean,
  icmsPercentage: number
): {
  icmsDeduction: number;
  netBase: number;
  driverFreightPj: number;
  driverFreightPf: number;
} {
  const base = Number(companyFreight) || 0;
  const icmsPct = hasIcms ? Number(icmsPercentage) || 0 : 0;
  const icmsDeduction = base * (icmsPct / 100);
  const netBase = base - icmsDeduction;

  const driverFreightPj = Number((netBase * 0.92).toFixed(2)); // -8%
  const driverFreightPf = Number((netBase * 0.88).toFixed(2)); // -12%

  return {
    icmsDeduction: Number(icmsDeduction.toFixed(2)),
    netBase: Number(netBase.toFixed(2)),
    driverFreightPj,
    driverFreightPf
  };
}

/**
 * Automação da Programação Diária:
 * Cria 1 entrada de 40 toneladas com "Demanda a Verificar".
 * Se a hora atual < 16h00: Data de Hoje.
 * Se a hora atual >= 16h00: Data de Amanhã.
 */
export function generateDailySchedule(tonnage: number = 40): DailyScheduleEntry[] {
  const now = new Date();
  const currentHour = now.getHours();

  const targetDate = new Date(now);
  if (currentHour >= 16) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return [
    {
      date: dateStr,
      type: DailyScheduleType.Verificar,
      tonnage: tonnage || 40
    }
  ];
}

/**
 * Valida os dados de uma carga antes de gravar no banco.
 */
export function validateBulkCargo(cargo: Partial<ParsedBulkCargo>): {
  status: 'ready' | 'warning' | 'error';
  validationErrors: string[];
  validationWarnings: string[];
} {
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  if (!cargo.clientId) validationErrors.push('Cliente não selecionado');
  if (!cargo.productId) validationErrors.push('Produto não informado');
  if (!cargo.origin || cargo.origin.trim() === '') validationErrors.push('Origem obrigatória');
  if (!cargo.destination || cargo.destination.trim() === '') validationErrors.push('Destino obrigatório');
  if (!cargo.totalVolume || cargo.totalVolume <= 0) validationErrors.push('Volume total deve ser maior que 0');
  if (!cargo.companyFreightValuePerTon || cargo.companyFreightValuePerTon <= 0)
    validationErrors.push('Frete Empresa deve ser maior que 0');

  if (cargo.hasIcms && (!cargo.icmsPercentage || cargo.icmsPercentage <= 0)) {
    validationWarnings.push('ICMS marcado mas sem alíquota definida (usando 0%)');
  }

  if (!cargo.allowedVehicleTypes || cargo.allowedVehicleTypes.length === 0) {
    validationWarnings.push('Nenhum conjunto de veículo selecionado (recomenda-se adicionar o padrão)');
  }

  let status: 'ready' | 'warning' | 'error' = 'ready';
  if (validationErrors.length > 0) {
    status = 'error';
  } else if (validationWarnings.length > 0) {
    status = 'warning';
  }

  return { status, validationErrors, validationWarnings };
}

/**
 * PARSER DE TEXTO DO WHATSAPP (com regras específicas para Milhão Ingredients e Genérico)
 */
export function parseWhatsAppTextBlock(
  rawText: string,
  client: Client | undefined,
  products: Product[]
): ParsedBulkCargo[] {
  if (!rawText || !rawText.trim()) return [];

  // Divide o texto em blocos de cargas (separados por 2 quebras de linha ou divisores como --- ou 📍 repetidos)
  const lines = rawText.split('\n');
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Se encontrar um novo marcador de rota 📍 ou linha divisória e já temos conteúdo, fecha o bloco anterior
    if (
      (line.includes('📍') && line.includes('X')) ||
      line.trim().startsWith('---') ||
      line.trim().startsWith('===')
    ) {
      if (currentBlock.length > 0 && currentBlock.some((l) => l.includes('X') || l.includes('VALOR'))) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
    }
    if (line.trim()) {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  // Se não conseguiu dividir por blocos, trata todo o texto como 1 bloco
  const blocksToProcess = blocks.length > 0 ? blocks : [rawText];

  const parsedCargos: ParsedBulkCargo[] = [];

  // Identifica produto padrão "Milho" para a Milhão Ingredients
  const isMilhao = client?.razaoSocial?.toLowerCase().includes('milh') ||
    client?.nomeFantasia?.toLowerCase().includes('milh') ||
    false;

  const defaultMilhoProduct = products.find((p) =>
    removeAccents(p.name).includes('milho')
  ) || products[0];

  const defaultFertilizanteProduct = products.find((p) =>
    removeAccents(p.name).includes('fertiliz')
  ) || products[0];

  for (let bIdx = 0; bIdx < blocksToProcess.length; bIdx++) {
    const block = blocksToProcess[bIdx].trim();
    if (!block) continue;

    const blockLines = block.split('\n').map((l) => l.trim()).filter(Boolean);

    let origin = '';
    let originLocation = '';
    let destination = '';
    let destinationLocation = '';
    let originMapLink = '';
    let baseFreight = 0;
    let productName = '';
    let totalVolume = 40; // Default 40 ton
    const observationsLines: string[] = [];

    for (const line of blockLines) {
      // 1. Linha de ROTA: 📍 GOIANIRA-GO (MILHÃO) X DESCALVADO-SP (ROYAL CANIN) 🏁
      if (line.includes('📍') || line.toUpperCase().includes(' X ') || line.includes(' 🏁')) {
        const cleanRouteLine = line.replace(/[📍🏁]/g, '').trim();
        const routeParts = cleanRouteLine.split(/\s+[xX]\s+/);
        if (routeParts.length >= 2) {
          const rawOrig = routeParts[0].trim();
          const rawDest = routeParts[1].trim();

          const origExtracted = extractLocationFromCityString(rawOrig);
          origin = normalizeCity(origExtracted.cityText, 'GO');
          originLocation = origExtracted.location || (isMilhao ? 'MILHÃO' : '');

          const destExtracted = extractLocationFromCityString(rawDest);
          destination = normalizeCity(destExtracted.cityText, 'SP');
          destinationLocation = destExtracted.location;
          continue;
        }
      }

      // 2. Linha de VALOR: 💰 VALOR: R$ 230 A TON ou 💰 VALOR: 230
      if (line.includes('💰') || line.toUpperCase().includes('VALOR')) {
        const valMatch = line.match(/(?:R\$\s*)?(\d+(?:[.,]\d+)?)/i);
        if (valMatch) {
          baseFreight = parseFloat(valMatch[1].replace(',', '.'));
          continue;
        }
      }

      // 3. Linha de PRODUTO: 🧾 PRODUTO: ...
      if (line.includes('🧾') || line.toUpperCase().includes('PRODUTO:')) {
        const prodMatch = line.replace(/[🧾]/g, '').replace(/PRODUTO\s*:?/i, '').trim();
        if (prodMatch) {
          productName = prodMatch;
          continue;
        }
      }

      // 4. Linha de LOCALIZAÇÃO / MAPS: 📌 LOCALIZAÇÃO: https://maps.app.goo.gl/...
      if (line.includes('📌') || line.toUpperCase().includes('LOCALIZAÇÃO') || line.includes('maps.google') || line.includes('goo.gl')) {
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          originMapLink = urlMatch[1];
          continue;
        }
      }

      // 5. Linha de PESO / VOLUME: ⚖️ PESO: 50 TON
      if (line.includes('⚖️') || line.toUpperCase().includes('PESO')) {
        const weightMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:TON|TO|T|KG)/i);
        if (weightMatch) {
          totalVolume = parseFloat(weightMatch[1].replace(',', '.'));
        }
        observationsLines.push(line);
        continue;
      }

      // Outras linhas (🚨 LINK DA CARGA, 🤑 DESCARGA, alertas de veículos, etc.)
      observationsLines.push(line);
    }

    // Regra de Produto: Se Milhão e não informado ou divergente, seleciona Milho
    let selectedProduct = defaultMilhoProduct;
    if (productName) {
      const matched = products.find((p) =>
        removeAccents(p.name).includes(removeAccents(productName))
      );
      if (matched) selectedProduct = matched;
    } else if (!isMilhao && defaultFertilizanteProduct) {
      selectedProduct = defaultFertilizanteProduct;
    }

    // Regra Financeira Milhão:
    // Frete Empresa = Base Informada (mantém o valor informado sem acréscimo de 5%)
    // Frete Motorista PJ (-8%) = Frete Empresa * 0.92
    // Frete Motorista PF (-12%) = Frete Empresa * 0.88
    const companyFreight = baseFreight;
    const fin = calculateFinancials(companyFreight, false, 0);

    const tempId = `TEMP-BULK-${Date.now()}-${bIdx + 1}`;

    const newCargo: ParsedBulkCargo = {
      tempId,
      clientId: client?.id || '',
      productId: selectedProduct?.id || '',
      origin: origin || (isMilhao ? 'Goianira, GO' : ''),
      originLocation: originLocation || (isMilhao ? 'MILHÃO' : ''),
      originMapLink,
      destination: destination || '',
      destinationLocation,
      destinationMapLink: '',
      totalVolume: totalVolume || 40,
      companyFreightValuePerTon: companyFreight,
      hasIcms: false,
      icmsPercentage: 0,
      driverFreightValuePerTon: fin.driverFreightPj,
      driverFreightValuePerTonPf: fin.driverFreightPf,
      allowedVehicleTypes: getDefaultAllowedVehicles(),
      observations: observationsLines.join('\n').trim(),
      rawText: block,
      status: 'ready',
      validationErrors: [],
      validationWarnings: []
    };

    const val = validateBulkCargo(newCargo);
    newCargo.status = val.status;
    newCargo.validationErrors = val.validationErrors;
    newCargo.validationWarnings = val.validationWarnings;

    parsedCargos.push(newCargo);
  }

  return parsedCargos;
}

/**
 * PARSER / OCR PARA CLIENTE "COMIGO" (Roteiros de Fertilizantes e Digitalizações)
 * Extrai campos via Gemini Multimodal ou regex estruturado.
 */
export async function processComigoDocumentOcr(
  imageBase64OrUrl: string,
  client: Client | undefined,
  products: Product[],
  apiKeyOverride?: string
): Promise<ParsedBulkCargo> {
  const isComigo = client?.razaoSocial?.toLowerCase().includes('comigo') ||
    client?.nomeFantasia?.toLowerCase().includes('comigo') ||
    false;

  const defaultFertilizante = products.find((p) =>
    removeAccents(p.name).includes('fertiliz')
  ) || products[0];

  // Configura Gemini
  const apiKey = apiKeyOverride || (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';

  let ocrData: any = null;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const cleanBase64 = imageBase64OrUrl.includes(',')
        ? imageBase64OrUrl.split(',')[1]
        : imageBase64OrUrl;

      const prompt = `Você é um assistente especialista em logística e transporte agrícola.
Analise com atenção a imagem deste ROTEIRO / AUTORIZAÇÃO DE CARREGAMENTO / ROMANEIO da cooperativa COMIGO.
Extraia com precisão os dados para o seguinte formato JSON rigoroso:
{
  "clienteCooperado": "Nome do cooperado/cliente ou fazendeiro",
  "fazenda": "Nome da fazenda ou sede de entrega (ex: Fazenda Paraíso do Rio Preto)",
  "cidadeDestino": "Cidade de Goiás de destino da entrega (ex: Aparecida do Rio Doce, Jataí, Montividiu, Rio Verde, Acreúna, Santa Helena de Goiás)",
  "ufDestino": "GO",
  "pedidos": "Número(s) do(s) pedido(s) ou ordens de entrega",
  "contatoTelefone": "Telefone ou nome do contato na fazenda",
  "quantidadeTon": 40.0,
  "dataEntrega": "Data informada de entrega/carregamento ou DD/MM/AAAA",
  "observacoesExtras": "Outras anotações importantes no documento",
  "roteiroCompleto": "Transcrição completa do trajeto/roteiro descrito no documento"
}
Retorne APENAS o JSON válido sem blocos de markdown adicionais.`;

      const modelsToTry = [
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-flash-latest'
      ];

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
                      mimeType: 'image/jpeg',
                      data: cleanBase64
                    }
                  },
                  { text: prompt }
                ]
              }
            ]
          });

          const textResponse = response.text || '';
          const cleanJsonStr = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
          ocrData = JSON.parse(cleanJsonStr);
          if (ocrData) break;
        } catch (err) {
          console.warn(`[bulkCargoParser] Erro na chamada Gemini com modelo ${model}:`, err);
        }
      }
    } catch (err) {
      console.error('[bulkCargoParser] Erro geral:', err);
    }
  }

  // Se OCR retornou dados ou fallback
  const rawCity = ocrData?.cidadeDestino || 'Rio Verde';
  const destCity = normalizeCity(rawCity, 'GO');
  const fazenda = ocrData?.fazenda || '';
  const cooperado = ocrData?.clienteCooperado || '';
  const pedidos = ocrData?.pedidos || '';
  const telefone = ocrData?.contatoTelefone || '';
  const obsExtra = ocrData?.observacoesExtras || '';
  const qtdTon = Number(ocrData?.quantidadeTon) || 40;
  const dataEntrega = ocrData?.dataEntrega || '';
  const roteiro = ocrData?.roteiroCompleto || '';

  // Estrutura das Observações COMIGO conforme especificação:
  const observationsFormatted = `CLIENTE: ${cooperado || 'COMIGO'}
FAZENDA: ${fazenda || 'Não especificada'}
PEDIDOS: ${pedidos || 'N/A'}
CONTATO/TELEFONE: ${telefone || 'N/A'}
OBS: ${obsExtra || 'Roteiro digitalizado anexado'}
QUANTIDADE DOC: ${qtdTon} TO
DATA ENTREGA: ${dataEntrega || new Date().toLocaleDateString('pt-BR')}
ROTEIRO: ${roteiro || 'Ver imagem anexa da autorização'}`;

  const tempId = `TEMP-COMIGO-${Date.now()}`;

  const defaultFrete = 120; // Valor padrão sugerido para frete interno COMIGO
  const fin = calculateFinancials(defaultFrete, false, 0);

  const parsedCargo: ParsedBulkCargo = {
    tempId,
    clientId: client?.id || '',
    productId: defaultFertilizante?.id || '',
    origin: 'Rio Verde, GO',
    originLocation: 'COMIGO - Rio Verde',
    originMapLink: '',
    destination: destCity,
    destinationLocation: fazenda,
    destinationMapLink: '',
    totalVolume: qtdTon || 40,
    companyFreightValuePerTon: defaultFrete,
    hasIcms: false,
    icmsPercentage: 0,
    driverFreightValuePerTon: fin.driverFreightPj,
    driverFreightValuePerTonPf: fin.driverFreightPf,
    allowedVehicleTypes: getDefaultAllowedVehicles(),
    observations: observationsFormatted,
    attachments: [imageBase64OrUrl],
    status: 'ready',
    validationErrors: [],
    validationWarnings: []
  };

  const val = validateBulkCargo(parsedCargo);
  parsedCargo.status = val.status;
  parsedCargo.validationErrors = val.validationErrors;
  parsedCargo.validationWarnings = val.validationWarnings;

  return parsedCargo;
}

/**
 * Converte valores numéricos ou monetários pt-BR ("R$ 180,00", "0,00", 205) para number.
 */
function parsePtBrNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (val === null || val === undefined) return 0;
  const str = String(val)
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!str) return 0;
  // Se contém vírgula, assume formato pt-BR (ex: 1.234,56 ou 180,00)
  if (str.includes(',')) {
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return Number.isFinite(num) ? num : 0;
  }
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Interpreta restrições da coluna TIPO DE VEÍCULO da planilha Agromercantil.
 * Ex: "APENAS RODO PJ", "RODOTREM PJ", "CARRETA 4E E (RODO 3x3)", "RESTRIÇÃO - CARRETA 4E GRAN."
 */
function parseVehicleTypesFromText(raw: string): { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[] {
  const norm = removeAccents(raw || '');
  if (!norm) return getDefaultAllowedVehicles();

  const bodyTypes: VehicleBodyType[] = norm.includes('bascul')
    ? [VehicleBodyType.Basculante]
    : norm.includes('gran')
    ? [VehicleBodyType.Graneleiro]
    : [VehicleBodyBodyDefault(), VehicleBodyType.Basculante];

  function VehicleBodyBodyDefault(): VehicleBodyType {
    return VehicleBodyType.Graneleiro;
  }

  const sets: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[] = [];
  if (norm.includes('carreta 4e') || norm.includes('4e') || norm.includes('4 eixo')) {
    sets.push({ setType: VehicleSetType.Carreta4e, bodyTypes });
  }
  if (norm.includes('bitrem 7') || norm.includes('7e')) {
    sets.push({ setType: VehicleSetType.Bitrem7e, bodyTypes });
  }
  if (norm.includes('bitrem 8') || norm.includes('8e')) {
    sets.push({ setType: VehicleSetType.Bitrem8e, bodyTypes });
  }
  if (norm.includes('rodo') || norm.includes('rodotrem') || norm.includes('3x3')) {
    sets.push({ setType: VehicleSetType.Rodotrem, bodyTypes });
  }
  if (norm.includes('ls simples') || norm.includes('ls')) {
    sets.push({ setType: VehicleSetType.LSSimples, bodyTypes });
  }

  return sets.length > 0 ? sets : getDefaultAllowedVehicles();
}

/**
 * PARSER DA PLANILHA PADRÃO AGROMERCANTIL
 * Colunas esperadas:
 * ATUA | STATUS | FRETE-E | RESPONSÁVEL | PRODUTO | CIDADE DE ORIGEM | UF ORIGEM |
 * LOCAL DE COLETA | CIDADE DE DESTINO | LOCAL DE ENTREGA | TIPO DE VEÍCULO | ICMS | FRETE PJ | FRETE PF | EMPRESA
 */
export function parseAgromercantilSpreadsheetRows(
  rows: unknown[][],
  client: Client | undefined,
  products: Product[]
): ParsedBulkCargo[] {
  if (!rows || rows.length === 0) return [];

  // Procura linha de cabeçalho
  let headerIdx = -1;
  const colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] || [];
    const normCells = row.map((c) => removeAccents(String(c ?? '')).replace(/\s+/g, ' '));
    const hasOrigem = normCells.some((c) => c.includes('cidade de origem') || c === 'origem');
    const hasDestino = normCells.some((c) => c.includes('cidade de destino') || c === 'destino');
    const hasProduto = normCells.some((c) => c.includes('produto'));
    if ((hasOrigem && hasDestino) || (hasProduto && (hasOrigem || hasDestino))) {
      headerIdx = i;
      normCells.forEach((cell, idx) => {
        const isMarginOrPercentCol =
          cell.includes('margem') ||
          cell.includes('lucro') ||
          cell.includes('dif') ||
          cell.includes('%') ||
          cell.includes('comissao');

        if (colMap.atua === undefined && (cell === 'atua' || cell.includes('atua'))) colMap.atua = idx;
        else if (colMap.status === undefined && cell.includes('status')) colMap.status = idx;
        else if (colMap.freteE === undefined && (cell.includes('frete-e') || cell === 'frete e')) colMap.freteE = idx;
        else if (colMap.responsavel === undefined && cell.includes('responsavel')) colMap.responsavel = idx;
        else if (colMap.produto === undefined && cell.includes('produto')) colMap.produto = idx;
        else if (colMap.cidadeOrigem === undefined && (cell.includes('cidade de origem') || cell === 'origem')) colMap.cidadeOrigem = idx;
        else if (colMap.ufOrigem === undefined && (cell.includes('uf origem') || cell === 'uf')) colMap.ufOrigem = idx;
        else if (colMap.localColeta === undefined && (cell.includes('local de coleta') || cell.includes('coleta'))) colMap.localColeta = idx;
        else if (colMap.cidadeDestino === undefined && (cell.includes('cidade de destino') || cell === 'destino')) colMap.cidadeDestino = idx;
        else if (colMap.localEntrega === undefined && (cell.includes('local de entrega') || cell.includes('entrega'))) colMap.localEntrega = idx;
        else if (colMap.tipoVeiculo === undefined && (cell.includes('tipo de veiculo') || cell.includes('veiculo'))) colMap.tipoVeiculo = idx;
        else if (colMap.icms === undefined && cell.includes('icms') && !isMarginOrPercentCol) colMap.icms = idx;
        else if (colMap.fretePj === undefined && !isMarginOrPercentCol && (cell === 'frete pj' || cell.includes('frete pj') || cell === 'pj')) colMap.fretePj = idx;
        else if (colMap.fretePf === undefined && !isMarginOrPercentCol && (cell === 'frete pf' || cell.includes('frete pf') || cell === 'pf')) colMap.fretePf = idx;
        else if (colMap.empresa === undefined && !isMarginOrPercentCol && (cell === 'empresa' || cell === 'frete empresa')) colMap.empresa = idx;
      });
      // Garante fallback exato para colunas M (12) e N (13) caso o cabeçalho esteja abreviado
      if (colMap.fretePj === undefined && row.length > 12) colMap.fretePj = 12;
      if (colMap.fretePf === undefined && row.length > 13) colMap.fretePf = 13;
      if (colMap.empresa === undefined && row.length > 14) colMap.empresa = 14;
      break;
    }
  }

  // Fallback para ordem padrão das 15 colunas caso usuário cole apenas as linhas de dados sem cabeçalho
  const getCol = (key: string, fallbackIdx: number) =>
    colMap[key] !== undefined ? colMap[key] : fallbackIdx;

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
  const results: ParsedBulkCargo[] = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const cellStr = (key: string, fallbackIdx: number) =>
      String(row[getCol(key, fallbackIdx)] ?? '').trim();

    const atua = cellStr('atua', 0);
    const statusText = removeAccents(cellStr('status', 1));
    const freteE = cellStr('freteE', 2);
    const responsavel = cellStr('responsavel', 3);
    const produtoRaw = cellStr('produto', 4);
    const cidadeOrigemRaw = cellStr('cidadeOrigem', 5);
    const ufOrigemRaw = cellStr('ufOrigem', 6).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'MG';
    const localColeta = cellStr('localColeta', 7);
    const cidadeDestinoRaw = cellStr('cidadeDestino', 8);
    const localEntrega = cellStr('localEntrega', 9);
    const tipoVeiculoRaw = cellStr('tipoVeiculo', 10);
    const icmsVal = parsePtBrNumber(row[getCol('icms', 11)]);
    const fretePjVal = parsePtBrNumber(row[getCol('fretePj', 12)]);
    const fretePfVal = parsePtBrNumber(row[getCol('fretePf', 13)]);
    const freteEmpresaVal = parsePtBrNumber(row[getCol('empresa', 14)]);

    // Ignora linhas vazias ou linhas explicitamente inativas/canceladas/fechadas
    if (!cidadeOrigemRaw && !cidadeDestinoRaw && !produtoRaw) continue;
    if (
      statusText &&
      (statusText.includes('inativo') ||
        statusText.includes('cancelad') ||
        statusText.includes('fechad') ||
        statusText.includes('encerrad'))
    ) {
      continue;
    }

    const origin = normalizeCity(
      cidadeOrigemRaw.includes('/') || cidadeOrigemRaw.includes('-')
        ? cidadeOrigemRaw
        : `${cidadeOrigemRaw}-${ufOrigemRaw}`,
      ufOrigemRaw
    );
    const destination = normalizeCity(cidadeDestinoRaw, ufOrigemRaw);

    // Match produto
    const prodNorm = removeAccents(produtoRaw);
    let matchedProd = products.find((p) => removeAccents(p.name) === prodNorm);
    if (!matchedProd && prodNorm) {
      matchedProd = products.find(
        (p) => removeAccents(p.name).includes(prodNorm) || prodNorm.includes(removeAccents(p.name))
      );
    }

    const hasIcms = icmsVal > 0;
    const companyFreight = freteEmpresaVal > 0 ? freteEmpresaVal : fretePjVal;
    const fin = calculateFinancials(companyFreight, hasIcms, icmsVal);

    const driverFreightPj = fretePjVal > 0 ? fretePjVal : fin.driverFreightPj;
    const driverFreightPf = fretePfVal > 0 ? fretePfVal : (fretePjVal > 0 ? fretePjVal : fin.driverFreightPf);

    const obsParts: string[] = [];
    if (atua) obsParts.push(`ATUA: ${atua}`);
    if (freteE) obsParts.push(`FRETE-E: ${freteE}`);
    if (responsavel) obsParts.push(`Responsável: ${responsavel}`);
    if (localColeta) obsParts.push(`Coleta: ${localColeta}`);
    if (localEntrega) obsParts.push(`Entrega: ${localEntrega}`);
    if (tipoVeiculoRaw) obsParts.push(`Veículo/Restrição: ${tipoVeiculoRaw}`);

    const parsed: ParsedBulkCargo = {
      tempId: `TEMP-AGRO-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 5)}`,
      clientId: client?.id || '',
      productId: matchedProd?.id || '',
      origin,
      originLocation: localColeta,
      destination,
      destinationLocation: localEntrega,
      totalVolume: 40, // Lote padrão inicial (editável na revisão)
      companyFreightValuePerTon: companyFreight,
      hasIcms,
      icmsPercentage: icmsVal,
      driverFreightValuePerTon: driverFreightPj,
      driverFreightValuePerTonPf: driverFreightPf,
      allowedVehicleTypes: parseVehicleTypesFromText(tipoVeiculoRaw),
      observations: obsParts.join(' | '),
      rawText: row.map((c) => String(c ?? '')).join(' | '),
      status: 'ready',
      validationErrors: [],
      validationWarnings: []
    };

    const val = validateBulkCargo(parsed);
    parsed.status = val.status;
    parsed.validationErrors = val.validationErrors;
    parsed.validationWarnings = val.validationWarnings;

    results.push(parsed);
  }

  return results;
}

/**
 * Converte texto tabular colado diretamente do Excel (separado por TAB ou ponto e vírgula)
 * utilizando o layout padrão Agromercantil.
 */
export function parseAgromercantilPastedTable(
  rawText: string,
  client: Client | undefined,
  products: Product[]
): ParsedBulkCargo[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  const rows: string[][] = lines.map((line) => {
    if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
    if (line.includes(';')) return line.split(';').map((c) => c.trim());
    return line.split(',').map((c) => c.trim());
  });

  return parseAgromercantilSpreadsheetRows(rows, client, products);
}
