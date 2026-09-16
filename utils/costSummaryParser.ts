import { GoogleGenAI } from '@google/genai';
import { RealProfitData, OperationalExpenseItem } from '../types';

/**
 * Normaliza valores numéricos que podem vir em formato brasileiro (ex: 2.131,20) ou float (2131.2)
 */
export function parseBrlNumber(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Number(val.toFixed(2));
  }
  if (!val) return 0;
  let str = String(val).trim().replace(/R\$\s?/gi, '').replace(/%/g, '').trim();
  // Se contiver vírgula e ponto (ex: 2.131,20)
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
}

/**
 * Converte File em base64 e mimeType
 */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const mimeType = file.type || 'image/jpeg';
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve({ base64, mimeType });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Converte URL ou Blob em base64
 */
export async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
  return fileToBase64(file);
}

/**
 * Extrai e estrutura dados de custos e fretes a partir de uma imagem de Resumo Financeiro
 */
export async function parseCostSummaryDocument(
  source: File | string,
  apiKeyOverride?: string
): Promise<RealProfitData> {
  let base64 = '';
  let mimeType = 'image/jpeg';

  if (source instanceof File) {
    const converted = await fileToBase64(source);
    base64 = converted.base64;
    mimeType = converted.mimeType;
  } else if (typeof source === 'string') {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const converted = await urlToBase64(source);
      base64 = converted.base64;
      mimeType = converted.mimeType;
    } else {
      base64 = source.includes(',') ? source.split(',')[1] : source;
    }
  }

  if (!base64) {
    throw new Error('Nenhum dado de imagem fornecido para leitura.');
  }

  const apiKey = apiKeyOverride || (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';

  if (!apiKey) {
    throw new Error('Chave de API do Gemini não configurada. Configure em Assistente IA ou nas variáveis de ambiente.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Você é um auditor financeiro e especialista em logística de transportes.
Analise detalhadamente a imagem do comprovante/tabela de "Resumo Financeiro de Custos e Fretes de Embarque".
Extraia com 100% de precisão todos os campos numéricos e descritivos presentes no demonstrativo.

ATENÇÃO CRÍTICA PARA AS DUAS SEÇÕES DA IMAGEM:

1. Seção "Diferença de Frete 💡" (bloco destacado localizado logo ABAIXO de "Crédito Gerado"):
   - "Frete Empresa (=)": Este é o Frete Empresa da operação (ex: 4.771,60). EXTRAIA EXATAMENTE ESSE VALOR para "freteEmpresaDiferenca"!
   - "Frete Motorista (=)": Valor do Frete Motorista (ex: 4.515,60). EXTRAIA para "freteMotoristaDiferenca"!
   - "(Fr. Emp. - Fr. Mot.) / Fr. Emp. (=)": Percentual de margem (ex: 5,37%). EXTRAIA para "margemDiferencaFretePercent"!

2. Seção "Resumo" (tabela do topo):
   - Frete Empresa (+) (bruto, ex: 5.536,00)
   - Complemento Cobrado (+)
   - Frete Motorista (-) (ex: 4.515,60)
   - Complemento Pago (-)
   - Acréscimo Motorista (-)
   - Pedágio (-) (ex: 764,40)
   - Diferença de ICMS (-)
   - Imposto Federal (-)
   - INSS Patronal / CPRB (-)
   - Diferença Seguro (-)
   - Comissão (-)
   - Corretor (-)
   - Outros Custos (Custo Fx+Tx. Adm.) (-)
   - Diferença de Diária (-)
   - Resultado R$ (=)
   - Margem (Resultado / Fr. Emp.) (%)
   - Crédito Gerado (=)

Retorne APENAS um JSON rigoroso e válido no seguinte formato:
{
  "freteEmpresaDiferenca": 4771.60,
  "freteMotoristaDiferenca": 4515.60,
  "margemDiferencaFretePercent": 5.37,
  "freteEmpresaBruto": 5536.00,
  "complementoCobrado": 0.00,
  "freteMotorista": 4515.60,
  "complementoPago": 0.00,
  "acrescimoMotorista": 0.00,
  "pedagio": 764.40,
  "diferencaIcms": 0.00,
  "impostoFederal": 0.00,
  "inssPatronal": 0.00,
  "diferencaSeguro": 8.53,
  "comissao": 17.16,
  "corretor": 0.00,
  "outrosCustos": 9.03,
  "diferencaDiaria": 0.00,
  "creditoGerado": 313.27,
  "resultadoReais": 0.00,
  "margemResultadoPercent": 0.00,
  "despesasDetalhadas": [
    { "name": "Pedágio", "value": 764.40, "type": "negative" },
    { "name": "Diferença Seguro", "value": 8.53, "type": "negative" },
    { "name": "Comissão", "value": 17.16, "type": "negative" },
    { "name": "Outros Custos (Custo Fx+Tx. Adm.)", "value": 9.03, "type": "negative" }
  ]
}

Regras:
- Use números decimais no padrão internacional (ex: 4771.60, sem pontos de milhar, apenas ponto para decimal).
- Na seção "Diferença de Frete", capture obrigatoriamente o valor exato de "Frete Empresa", "Frete Motorista" e a margem percentual.
- Inclua em "despesasDetalhadas" todos os itens operacionais deduzidos que possuam valor maior que zero.
- NÃO inclua markdown (\`\`\`json), retorne apenas o texto cru do JSON.`;

  let parsedJson: any = null;

  // Tentativa com os modelos disponíveis e ativos da API Gemini
  const modelsToTry = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro'
  ];
  let lastError: any = null;

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
                  mimeType: mimeType.includes('pdf') ? 'application/pdf' : mimeType,
                  data: base64,
                },
              },
              { text: prompt },
            ],
          },
        ],
      });

      const textResponse = response.text || '';
      const cleanJsonStr = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedJson = JSON.parse(cleanJsonStr);
      if (parsedJson) break;
    } catch (err) {
      console.warn(`[costSummaryParser] Falha no modelo ${model}:`, err);
      lastError = err;
    }
  }

  if (!parsedJson) {
    let errorMsg = lastError?.message || 'Falha ao processar o comprovante com o Gemini.';
    try {
      const parsedErr = JSON.parse(errorMsg);
      if (parsedErr?.error?.message) {
        errorMsg = parsedErr.error.message;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  // Normalização: O Frete Empresa principal deve vir da seção 'Diferença de Frete' (abaixo de Crédito Gerado)
  const companyFreightDiferenca = parseBrlNumber(parsedJson.freteEmpresaDiferenca);
  const companyFreightBruto = parseBrlNumber(parsedJson.freteEmpresaBruto || parsedJson.freteEmpresa);
  const toll = parseBrlNumber(parsedJson.pedagio);

  // Se o campo específico de Diferença de Frete estiver presente, usa ele (ex: 4.771,60).
  // Caso contrário, se houver bruto e pedágio, calcula (5536 - 764.40 = 4771.60), senão usa o bruto.
  const companyFreight = companyFreightDiferenca > 0 
    ? companyFreightDiferenca 
    : (companyFreightBruto > 0 && toll > 0 ? Number((companyFreightBruto - toll).toFixed(2)) : companyFreightBruto);

  const driverFreight = parseBrlNumber(parsedJson.freteMotoristaDiferenca || parsedJson.freteMotorista);
  const complementCharged = parseBrlNumber(parsedJson.complementoCobrado);
  const complementPaid = parseBrlNumber(parsedJson.complementoPago);
  const driverSurcharge = parseBrlNumber(parsedJson.acrescimoMotorista);

  const icmsDifference = parseBrlNumber(parsedJson.diferencaIcms);
  const federalTax = parseBrlNumber(parsedJson.impostoFederal);
  const inssPatronal = parseBrlNumber(parsedJson.inssPatronal);
  const insuranceDifference = parseBrlNumber(parsedJson.diferencaSeguro);
  const commission = parseBrlNumber(parsedJson.comissao);
  const brokerFee = parseBrlNumber(parsedJson.corretor);
  const otherCosts = parseBrlNumber(parsedJson.outrosCustos);
  const dailyRateDifference = parseBrlNumber(parsedJson.diferencaDiaria);
  const generatedCredit = parseBrlNumber(parsedJson.creditoGerado);

  // Monta lista de itens de despesa operacionais detalhados
  const expenseItems: OperationalExpenseItem[] = [];

  if (Array.isArray(parsedJson.despesasDetalhadas) && parsedJson.despesasDetalhadas.length > 0) {
    parsedJson.despesasDetalhadas.forEach((item: any) => {
      const val = parseBrlNumber(item.value);
      if (val > 0) {
        expenseItems.push({
          name: String(item.name || 'Despesa Operacional').trim(),
          value: val,
          type: item.type || 'negative',
        });
      }
    });
  }

  // Fallback caso a IA não tenha preenchido o array mas tenha preenchido campos avulsos
  if (expenseItems.length === 0) {
    if (federalTax > 0) expenseItems.push({ name: 'Imposto Federal', value: federalTax, type: 'negative' });
    if (inssPatronal > 0) expenseItems.push({ name: 'INSS Patronal / CPRB', value: inssPatronal, type: 'negative' });
    if (insuranceDifference > 0) expenseItems.push({ name: 'Diferença Seguro', value: insuranceDifference, type: 'negative' });
    if (commission > 0) expenseItems.push({ name: 'Comissão', value: commission, type: 'negative' });
    if (toll > 0) expenseItems.push({ name: 'Pedágio', value: toll, type: 'negative' });
    if (icmsDifference > 0) expenseItems.push({ name: 'Diferença de ICMS', value: icmsDifference, type: 'negative' });
    if (brokerFee > 0) expenseItems.push({ name: 'Corretor', value: brokerFee, type: 'negative' });
    if (otherCosts > 0) expenseItems.push({ name: 'Outros Custos (Custo Fx+Tx. Adm.)', value: otherCosts, type: 'negative' });
    if (dailyRateDifference > 0) expenseItems.push({ name: 'Diferença de Diária', value: dailyRateDifference, type: 'negative' });
  }

  // Soma de todas as despesas operacionais deduzidas
  const totalExpenses = Number(
    (
      toll +
      icmsDifference +
      federalTax +
      inssPatronal +
      insuranceDifference +
      commission +
      brokerFee +
      otherCosts +
      dailyRateDifference
    ).toFixed(2)
  );

  // Total de receitas: Frete Empresa + Complemento Cobrado
  const totalRevenue = Number((companyFreight + complementCharged).toFixed(2));

  // Total de custos do motorista: Frete Motorista + Complemento Pago + Acréscimo Motorista
  const totalDriverCost = Number((driverFreight + complementPaid + driverSurcharge).toFixed(2));

  // Diferença direta de Frete / Lucro Real da Operação: Frete Empresa - Frete Motorista
  const freightDifference = Number((companyFreight - driverFreight).toFixed(2));
  const freightDifferenceMarginPercent = companyFreight > 0
    ? Number(((freightDifference / companyFreight) * 100).toFixed(2))
    : 0;

  // Lucro Real da Operação é a Diferença de Frete (Frete Empresa - Frete Motorista)
  const netProfit = freightDifference;
  const profitMarginPercent = freightDifferenceMarginPercent;

  const result: RealProfitData = {
    companyFreight,
    driverFreight,
    freightDifference,
    freightDifferenceMarginPercent,
    totalExpenses,
    netProfit,
    profitMarginPercent,
    expenseItems,
    complementCharged,
    complementPaid,
    driverSurcharge,
    toll,
    icmsDifference,
    federalTax,
    inssPatronal,
    insuranceDifference,
    commission,
    brokerFee,
    otherCosts,
    dailyRateDifference,
    generatedCredit,
    processedAt: new Date().toISOString(),
    rawOcrText: JSON.stringify(parsedJson, null, 2),
  };

  return result;
}
