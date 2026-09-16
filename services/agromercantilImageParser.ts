import { GoogleGenAI } from '@google/genai';
import { createWorker } from 'tesseract.js';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import { DailyScheduleEntry, DailyScheduleType } from '../types';
import { enhanceDocumentImage } from './imageEnhancer';

export interface AgromercantilExtractedRow {
  produto: string;
  tipoCotacao?: string;
  precoNegociado?: number;
  volNegociado?: number;
  status: string; // e.g. "Proposta Final" ou "Negociação em Curso"
  cidadeOrigem?: string;
  origem?: string;
  cidadeDestino?: string;
  destino?: string;
  inicioEmbarque?: string; // YYYY-MM-DD
  fimEmbarque?: string; // YYYY-MM-DD
  volumeDisponivel?: number;
  cadenciaDia?: number;
  rawText?: string;
}

export interface AgromercantilExtractedData {
  rows: AgromercantilExtractedRow[];
  totalRowsFound: number;
  propostaFinalCount: number;
  ignoredCount: number;
  rawText?: string;
  imageDataUrl?: string;
  errorMessage?: string;
  warningMessage?: string;
}

/**
 * Converte um arquivo em Base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Converte data em vários formatos (DD/MM/AAAA, DD/MM/YY, YYYY-MM-DD) para YYYY-MM-DD
 */
export function parseDateToISO(dateStrRaw?: string): string | undefined {
  if (!dateStrRaw) return undefined;
  const clean = String(dateStrRaw).trim();
  if (!clean || clean === '-' || clean === '—') return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  const matchBR = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (matchBR) {
    const day = matchBR[1].padStart(2, '0');
    const month = matchBR[2].padStart(2, '0');
    let year = matchBR[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  return undefined;
}

/**
 * Converte data ISO (YYYY-MM-DD) para formato brasileiro DD/MM/AAAA
 */
export function formatDateBR(dateStrISO?: string): string {
  if (!dateStrISO) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrISO)) {
    const [y, m, d] = dateStrISO.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStrISO;
}

/**
 * Extrai número float de strings como "892,34 (ton)", "R$ 112,00", "120 ton", "200,00"
 */
export function parseNumberField(val: any): number | undefined {
  if (typeof val === 'number') {
    return isNaN(val) ? undefined : val;
  }
  if (!val || typeof val !== 'string') return undefined;
  const clean = val.replace(/R\$/gi, '').replace(/\(ton\)/gi, '').replace(/ton/gi, '').replace(/[^\d.,-]/g, '').trim();
  if (!clean || clean === '-' || clean === '—') return undefined;

  let numStr = clean;
  if (clean.includes(',') && clean.includes('.')) {
    numStr = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    numStr = clean.replace(',', '.');
  }

  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Gera a Programação Diária a partir do Volume Total e da Cadência / Dia
 * Ex: Volume Total = 600t e cadência / dia = 120t -> 5 dias com cota fixa de 120t
 * Ex: Volume Total = 892.34t e cadência / dia = 200t -> 4 dias de 200t e 1 dia de 92.34t
 */
export function generateAgromercantilDailySchedule(
  volNegociado: number,
  cadenciaDia?: number,
  startDateStr?: string
): DailyScheduleEntry[] {
  let baseDate = new Date();
  const yNow = baseDate.getFullYear();
  const mNow = String(baseDate.getMonth() + 1).padStart(2, '0');
  const dNow = String(baseDate.getDate()).padStart(2, '0');
  const todayISO = `${yNow}-${mNow}-${dNow}`;

  let parsedStartDate: string | undefined = undefined;

  if (startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    parsedStartDate = startDateStr;
  } else if (startDateStr && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(startDateStr)) {
    const [d, m, y] = startDateStr.split('/').map(Number);
    const fullYear = y < 100 ? 2000 + y : y;
    parsedStartDate = `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // REGRA AGROMERCANTIL: Programar para os próximos dias.
  // Se a data informada na planilha for futura ou hoje, utiliza ela como início.
  // Se a data na planilha for passada, inicia a partir de HOJE (ou amanhã se for após 16h).
  if (parsedStartDate && parsedStartDate >= todayISO) {
    const [y, m, d] = parsedStartDate.split('-').map(Number);
    baseDate = new Date(y, m - 1, d);
  } else {
    baseDate = new Date();
    if (baseDate.getHours() >= 16) {
      baseDate.setDate(baseDate.getDate() + 1);
    }
  }

  const entries: DailyScheduleEntry[] = [];
  const cadencia = cadenciaDia && cadenciaDia > 0 ? cadenciaDia : 120;
  const total = volNegociado && volNegociado > 0 ? volNegociado : 0;

  if (total > 0 && cadencia > 0) {
    let remaining = total;
    let currDate = new Date(baseDate);
    let dayCount = 0;
    const maxDays = 60; // limite de segurança

    while (remaining > 0.001 && dayCount < maxDays) {
      const dayTonnage = Math.min(remaining, cadencia);
      const y = currDate.getFullYear();
      const m = String(currDate.getMonth() + 1).padStart(2, '0');
      const d = String(currDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      entries.push({
        date: dateStr,
        type: DailyScheduleType.Fixo,
        tonnage: parseFloat(dayTonnage.toFixed(2)),
      });

      remaining -= dayTonnage;
      currDate.setDate(currDate.getDate() + 1);
      dayCount++;
    }
  } else {
    // Caso padrão: 1 dia com cota total
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const d = String(baseDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    entries.push({
      date: dateStr,
      type: total > 0 ? DailyScheduleType.Fixo : DailyScheduleType.Verificar,
      tonnage: total > 0 ? total : 40,
    });
  }

  return entries;
}

/**
 * Parser de Fallback baseado em Tesseract OCR para tabelas da Agromercantil
 */
export function parseAgromercantilOcrText(text: string): AgromercantilExtractedRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: AgromercantilExtractedRow[] = [];

  for (const line of lines) {
    const upper = line.toUpperCase();
    // Detecta linhas com indício de frete, lote, produto ou proposta
    const isPropostaFinal = upper.includes('PROPOSTA FINAL') || upper.includes('PROPOSTA') || upper.includes('FINAL');
    const isNegociacao = upper.includes('NEGOCIACAO') || upper.includes('NEGOCIAÇÃO') || upper.includes('CURSO');

    if (!isPropostaFinal && !isNegociacao && !upper.includes('MILHO') && !upper.includes('SOJA') && !upper.includes('GRÃOS') && !upper.includes('GRAOS')) {
      continue;
    }

    const row: AgromercantilExtractedRow = {
      produto: upper.includes('SOJA') ? 'SOJA EM GRÃOS' : 'MILHO EM GRÃOS',
      status: isNegociacao && !isPropostaFinal ? 'Negociação em Curso' : 'Proposta Final',
      rawText: line,
    };

    // Extrai valores monetários (ex: R$ 112,00 ou 112,00)
    const valMatch = line.match(/R\$\s*([\d.,]+)/i) || line.match(/\b(\d{2,3}[,.]\d{2})\b/);
    if (valMatch) {
      row.precoNegociado = parseNumberField(valMatch[1]);
    }

    // Extrai datas (DD/MM/AAAA)
    const dateMatches = Array.from(line.matchAll(/(\d{1,2}\/\d{1,2}\/\d{2,4})/g));
    if (dateMatches.length >= 1) {
      row.inicioEmbarque = parseDateToISO(dateMatches[0][1]);
    }
    if (dateMatches.length >= 2) {
      row.fimEmbarque = parseDateToISO(dateMatches[1][1]);
    }

    // Extrai tonnages (ex: 892,34 ou 600,00)
    const tonMatches = Array.from(line.matchAll(/\b(\d{2,4}[,.]\d{2})\b/g));
    if (tonMatches.length > 0) {
      for (const tm of tonMatches) {
        const val = parseNumberField(tm[1]);
        if (val && val > 20 && !row.volNegociado) {
          row.volNegociado = val;
        } else if (val && val > 0 && !row.cadenciaDia && row.volNegociado && val <= row.volNegociado) {
          row.cadenciaDia = val;
        }
      }
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Processa a imagem da tabela/lotes da AGROMERCANTIL usando Gemini Vision (ou fallback Tesseract OCR)
 */
export async function processAgromercantilImage(
  imageInput: File | string,
  apiKey?: string
): Promise<AgromercantilExtractedData> {
  let fullDataUrl = '';
  try {
    fullDataUrl = await enhanceDocumentImage(imageInput);
  } catch {
    if (typeof imageInput === 'string') {
      fullDataUrl = imageInput;
    } else {
      fullDataUrl = await fileToBase64(imageInput);
    }
  }

  const base64Data = fullDataUrl.includes(',') ? fullDataUrl.split(',')[1] : fullDataUrl;
  let mimeType = 'image/jpeg';
  if (fullDataUrl.startsWith('data:image/png')) mimeType = 'image/png';
  else if (fullDataUrl.startsWith('data:image/webp')) mimeType = 'image/webp';

  const key = (apiKey || localStorage.getItem('gemini_api_key') || (import.meta as any).env?.VITE_GEMINI_API_KEY || 'AIzaSyD9WTYJJcBcswabE3cAE3gX6fAz3FLZGyA').trim();

  let geminiErrorMessage = '';

  if (key) {
    const modelsToTry = ['gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];

    for (const modelName of modelsToTry) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const prompt = `Você é um assistente especialista em logística e OCR de transportes de grãos para o cliente AGROMERCANTIL.
Analise com máxima acuidade a imagem desta tabela/planilha de ofertas e lotes de frete.

ESTRUTURA DAS COLUNAS DA TABELA:
1. "Produto": (ex: "MILHO EM GRÃOS", "SOJA EM GRÃOS", "FARELO DE SOJA", etc.)
2. "Tipo de Cotação": (ex: "Preço Fixo R$ 112,00 / ton", "Preço Livre -")
3. "Preço Negociado": (ex: "R$ 112,00", "-", "R$ 165,00", "R$ 90,00"). Se for "-" ou vazio, tente extrair o valor de "Tipo de Cotação" se houver.
4. "Vol. Negociado": Volume total contratado em toneladas (ex: "892,34 (ton)" -> 892.34, "600,00 (ton)" -> 600.00).
5. "Status": Status do lote (ex: "Proposta Final", "Negociação em Curso", "Cancelado", etc.).
6. "Cidade Origem": Cidade e UF de origem (ex: "MACHADO, MG", "SÃO GOTARDO, MG", "UNAÍ, MG", "GUARAPUAVA, PR", "ALFENAS, MG").
7. "Origem": Local detalhado de coleta / armazém / fazenda / endereço (ex: "FRANCISCO CARVALHO DIAS, 233, CENTRO", "MG 235 KM 89,443, GUARDA DOS FERREIROS", "FAZENDA VERDE PRADO").
8. "Cidade Destino": Cidade e UF de destino (ex: "IGARATINGA, MG", "VÁRZEA DA PALMA, MG", "IRATI, PR", "FORMIGA, MG", "PASSOS, MG", "ITANHANDU, MG", "SANTOS, SP").
9. "Destino": Local detalhado de entrega / armazém / fazenda / endereço (ex: "BR 262, ZONA RURAL", "BR 262 - KM 424,1, ZONA RURAL", "XAVIER DA SILVEIRA, PAQUETÁ").
10. "Inicio Embarque": Data de Início do Carregamento no formato ISO "YYYY-MM-DD" (ex: "14/08/2026" -> "2026-08-14").
11. "Fim Embarque": Prazo final de Carregamento no formato ISO "YYYY-MM-DD" (ex: "28/08/2026" -> "2026-08-28").
12. "Volume Disponível": Volume disponível em toneladas (ex: "892,34 (ton)" -> 892.34).
13. "Cadencia / Dia": Demanda de carregamento por dia em toneladas (ex: "200,00 (ton)" -> 200.00, "120,00 (ton)" -> 120.00, "0,20 (ton)" -> 0.20).

REGRAS:
- Identifique e extraia TODAS as linhas visíveis na imagem.
- Extraia os números decimais como números float puros (sem 'R$', sem 'ton', sem parênteses).
- Converta todas as datas para "YYYY-MM-DD".
- Retorne estritamente um JSON no formato:
{
  "lotes": [
    {
      "produto": "MILHO EM GRÃOS",
      "tipoCotacao": "Preço Fixo R$ 112,00 / ton",
      "precoNegociado": 112.0,
      "volNegociado": 892.34,
      "status": "Proposta Final",
      "cidadeOrigem": "MACHADO, MG",
      "origem": "FRANCISCO CARVALHO DIAS, 233, CENTRO",
      "cidadeDestino": "IGARATINGA, MG",
      "destino": "BR 262, ZONA RURAL",
      "inicioEmbarque": "2026-08-14",
      "fimEmbarque": "2026-08-28",
      "volumeDisponivel": 892.34,
      "cadenciaDia": 200.0
    }
  ]
}`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        });

        const responseText = response.text || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const rawRows: any[] = Array.isArray(parsed.lotes) ? parsed.lotes : (Array.isArray(parsed.rows) ? parsed.rows : (Array.isArray(parsed) ? parsed : []));

          const rows: AgromercantilExtractedRow[] = rawRows.map(r => {
            let preco = parseNumberField(r.precoNegociado);
            if ((!preco || preco === 0) && r.tipoCotacao) {
              const cotMatch = String(r.tipoCotacao).match(/R\$\s*([\d.,]+)/i);
              if (cotMatch) {
                preco = parseNumberField(cotMatch[1]);
              }
            }

            return {
              produto: r.produto || 'MILHO EM GRÃOS',
              tipoCotacao: r.tipoCotacao || '',
              precoNegociado: preco,
              volNegociado: parseNumberField(r.volNegociado),
              status: r.status || 'Proposta Final',
              cidadeOrigem: r.cidadeOrigem || '',
              origem: r.origem || '',
              cidadeDestino: r.cidadeDestino || '',
              destino: r.destino || '',
              inicioEmbarque: parseDateToISO(r.inicioEmbarque),
              fimEmbarque: parseDateToISO(r.fimEmbarque),
              volumeDisponivel: parseNumberField(r.volumeDisponivel),
              cadenciaDia: parseNumberField(r.cadenciaDia),
              rawText: JSON.stringify(r),
            };
          });

          const propostaFinalRows = rows.filter(r => (r.status || '').toLowerCase().includes('proposta final'));
          const ignoredCount = rows.length - propostaFinalRows.length;

          return {
            rows,
            totalRowsFound: rows.length,
            propostaFinalCount: propostaFinalRows.length,
            ignoredCount,
            rawText: responseText,
            imageDataUrl: fullDataUrl,
          };
        }
      } catch (geminiErr: any) {
        console.warn(`[Agromercantil Parser] Tentativa com modelo ${modelName} falhou:`, geminiErr);
        geminiErrorMessage = geminiErr?.message || String(geminiErr);
      }
    }
  } else {
    geminiErrorMessage = 'Chave da API Gemini não informada.';
  }

  // 2. Fallback: Tesseract OCR
  try {
    const worker = await createWorker('por');
    const ret = await worker.recognize(fullDataUrl);
    await worker.terminate();

    const rows = parseAgromercantilOcrText(ret.data.text);
    const propostaFinalRows = rows.filter(r => (r.status || '').toLowerCase().includes('proposta final'));

    return {
      rows,
      totalRowsFound: rows.length,
      propostaFinalCount: propostaFinalRows.length,
      ignoredCount: rows.length - propostaFinalRows.length,
      rawText: ret.data.text,
      imageDataUrl: fullDataUrl,
      warningMessage: rows.length === 0 && !key ? 'Chave de API do Gemini não configurada. Para ler prints de tabelas com máxima precisão, insira sua chave Gemini.' : undefined,
    };
  } catch (ocrErr: any) {
    console.error('[Agromercantil Parser] Erro no Tesseract OCR:', ocrErr);
    return {
      rows: [],
      totalRowsFound: 0,
      propostaFinalCount: 0,
      ignoredCount: 0,
      rawText: '',
      imageDataUrl: fullDataUrl,
      errorMessage: `Erro ao processar imagem: ${geminiErrorMessage || ocrErr?.message || 'Falha no reconhecimento da imagem'}. Configure uma chave do Gemini para digitalização assistida por IA.`,
    };
  }
}

/**
 * Formata o texto final para o campo "Observações" da carga AGROMERCANTIL
 */
export function formatAgromercantilObservations(row: AgromercantilExtractedRow): string {
  const parts: string[] = [];
  parts.push(`CLIENTE: AGROMERCANTIL`);
  if (row.status) parts.push(`STATUS LOTE: ${row.status}`);
  if (row.cadenciaDia) parts.push(`CADÊNCIA/DIA: ${row.cadenciaDia} ton/dia`);
  if (row.inicioEmbarque) parts.push(`INÍCIO EMBARQUE: ${formatDateBR(row.inicioEmbarque)}`);
  if (row.fimEmbarque) parts.push(`PRAZO EMBARQUE: ${formatDateBR(row.fimEmbarque)}`);
  if (row.tipoCotacao) parts.push(`COTAÇÃO: ${row.tipoCotacao}`);
  if (row.origem) parts.push(`LOCAL ORIGEM: ${row.origem}`);
  if (row.destino) parts.push(`LOCAL DESTINO: ${row.destino}`);
  return parts.join('\n');
}
