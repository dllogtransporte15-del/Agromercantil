import { GoogleGenAI } from '@google/genai';
import { createWorker } from 'tesseract.js';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import { enhanceDocumentImage } from './imageEnhancer';

export interface ComigoExtractedData {
  cliente?: string;
  fazenda?: string;
  dataEntrega?: string;
  dataEnvio?: string;
  quantidadeTexto?: string;
  toneladas?: number;
  pedidos?: string;
  telefone?: string;
  obs?: string;
  roteiro?: string;
  destinoSugerido?: string;
  destinoLocal?: string;
  freteEmpresaSugerido?: number;
  rawText?: string;
  imageDataUrl?: string;
}

/**
 * Converte um arquivo em Base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Detecta a cidade de destino em Goiás a partir do texto do roteiro
 */
export function detectDestinationFromText(text: string): string {
  if (!text) return 'Aparecida do Rio Doce, GO';
  const clean = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  let bestMatch = '';
  let bestPos = -1;

  for (const cityStr of BRAZILIAN_CITIES) {
    const [city, uf] = cityStr.split(',').map(s => s.trim());
    if (city.length < 4) continue;
    if (city.toLowerCase() === 'rio verde') continue; // Rio Verde é origem

    const cityNorm = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const pos = clean.indexOf(cityNorm);
    if (pos !== -1) {
      if (bestPos === -1 || pos < bestPos) {
        bestPos = pos;
        bestMatch = cityStr;
      }
    }
  }

  return bestMatch || 'Aparecida do Rio Doce, GO';
}

/**
 * Parser baseado em Regex para texto bruto do OCR Tesseract
 */
export function parseComigoOcrText(text: string): ComigoExtractedData {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let cliente = '';
  let fazenda = '';
  let dataEntrega = '';
  let dataEnvio = '';
  let quantidadeTexto = '';
  let toneladas: number | undefined = undefined;
  let pedidos = '';
  let telefone = '';
  let obs = '';
  let roteiro = '';
  let freteEmpresaSugerido = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // Cliente
    if (upper.includes('CLIENTE:')) {
      cliente = line.replace(/.*CLIENTE:\s*/i, '').trim();
    }
    // Fazenda
    if (upper.includes('FAZENDA:')) {
      fazenda = line.replace(/.*FAZENDA:\s*/i, '').trim();
    }
    // Data da entrega
    if (upper.includes('DATA DA ENTREGA:') || upper.includes('ENTREGA:')) {
      const match = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (match) dataEntrega = match[1];
    }
    // Data de envio
    if (upper.includes('DATA DE ENVIO:') || upper.includes('ENVIO:')) {
      const match = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (match) dataEnvio = match[1];
    }
    // Quantidade
    if (upper.includes('QUANTIDADE:') || upper.includes('TO FERT') || upper.includes('FERT.')) {
      quantidadeTexto = line.replace(/.*QUANTIDADE:\s*/i, '').trim();
      const tonMatch = line.match(/(\d+[\d.,]*)\s*(?:TO|TON|T)\b/i);
      if (tonMatch) {
        toneladas = parseFloat(tonMatch[1].replace(',', '.'));
      }
    }
    // Pedidos
    if (upper.includes('PEDIDOS:') || upper.includes('PEDIDO:')) {
      pedidos = line.replace(/.*PEDIDOS?:\s*/i, '').trim();
    }
    // Telefone
    if (upper.includes('TELEFONE:') || upper.includes('TEL:')) {
      telefone = line.replace(/.*TELEFONE?:\s*/i, '').trim();
    }
    // OBS
    if (upper.includes('OBS :') || upper.includes('OBS:')) {
      obs = line.replace(/.*OBS\s*:\s*/i, '').trim();
    }
    // Roteiro
    if (upper.includes('ROTEIRO :') || upper.includes('ROTEIRO:') || upper.includes('SENTIDO RIO VERDE')) {
      roteiro = lines.slice(i).join(' ').replace(/.*ROTEIRO\s*:\s*/i, '').trim();
    }
    // Valor à mão (ex: 42,00 ou R$ 42)
    const valMatch = line.match(/\b(\d{2,3}[,.]\d{2})\b/);
    if (valMatch && !freteEmpresaSugerido && !line.includes('/') && !line.includes('-')) {
      freteEmpresaSugerido = parseFloat(valMatch[1].replace(',', '.'));
    }
  }

  const destinoSugerido = detectDestinationFromText(roteiro || text);

  return {
    cliente,
    fazenda,
    dataEntrega,
    dataEnvio,
    quantidadeTexto,
    toneladas,
    pedidos,
    telefone,
    obs,
    roteiro,
    destinoSugerido,
    destinoLocal: fazenda ? `Fazenda ${fazenda}` : undefined,
    freteEmpresaSugerido,
    rawText: text,
  };
}

/**
 * Processa a imagem usando Gemini Vision (se apiKey fornecida) ou Tesseract.js (fallback offline)
 */
export async function processComigoImage(
  imageInput: File | string,
  apiKey?: string
): Promise<ComigoExtractedData> {
  // Aprimora a imagem (melhora contraste, nitidez e clareia fundo)
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

  // 1. Tentar Gemini Vision se houver apiKey
  const key = apiKey || localStorage.getItem('gemini_api_key') || (import.meta as any).env?.VITE_GEMINI_API_KEY;

  if (key) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const prompt = `Analise este documento de Roteiro de Entrega de Fertilizantes da COMIGO e extraia com máxima precisão os dados estruturados em JSON estrito.
Retorne SOMENTE um JSON válido com a seguinte estrutura:
{
  "cliente": "Nome do cliente/produtor",
  "fazenda": "Nome da fazenda",
  "dataEntrega": "DD/MM/AAAA",
  "dataEnvio": "DD/MM/AAAA",
  "quantidadeTexto": "Texto completo do campo Quantidade (ex: 134 TO FERT.00-20-30 COMIGO BG)",
  "toneladas": 134,
  "pedidos": "Número dos pedidos (ex: 4002514 / 4005419)",
  "telefone": "Telefone ou contato (ex: 99675-8266)",
  "obs": "Texto do campo OBS se houver",
  "roteiro": "Transcrição do texto do roteiro de entrega",
  "destinoSugerido": "Cidade e UF sugerida para o destino em Goiás (ex: Aparecida do Rio Doce, GO)",
  "freteEmpresaSugerido": 42.00
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
        return {
          cliente: parsed.cliente || '',
          fazenda: parsed.fazenda || '',
          dataEntrega: parsed.dataEntrega || '',
          dataEnvio: parsed.dataEnvio || '',
          quantidadeTexto: parsed.quantidadeTexto || '',
          toneladas: typeof parsed.toneladas === 'number' ? parsed.toneladas : (parsed.toneladas ? parseFloat(parsed.toneladas) : undefined),
          pedidos: parsed.pedidos || '',
          telefone: parsed.telefone || '',
          obs: parsed.obs || '',
          roteiro: parsed.roteiro || '',
          destinoSugerido: parsed.destinoSugerido ? parsed.destinoSugerido : detectDestinationFromText(parsed.roteiro || ''),
          destinoLocal: parsed.fazenda ? `Fazenda ${parsed.fazenda}` : undefined,
          freteEmpresaSugerido: typeof parsed.freteEmpresaSugerido === 'number' ? parsed.freteEmpresaSugerido : 0,
          rawText: responseText,
          imageDataUrl: fullDataUrl,
        };
      }
    } catch (geminiErr) {
      console.warn('[COMIGO Parser] Gemini Vision falhou, utilizando Tesseract OCR fallback:', geminiErr);
    }
  }

  // 2. Fallback: Tesseract OCR no navegador
  try {
    const worker = await createWorker('por');
    const ret = await worker.recognize(fullDataUrl);
    await worker.terminate();

    const data = parseComigoOcrText(ret.data.text);
    data.imageDataUrl = fullDataUrl;
    return data;
  } catch (ocrErr) {
    console.error('[COMIGO Parser] Erro no Tesseract OCR:', ocrErr);
    return {
      cliente: '',
      fazenda: '',
      destinoSugerido: 'Aparecida do Rio Doce, GO',
      rawText: '',
      imageDataUrl: fullDataUrl,
    };
  }
}

/**
 * Formata o texto final para o campo "Observações" da carga COMIGO
 */
export function formatComigoObservations(data: ComigoExtractedData): string {
  const parts: string[] = [];

  if (data.cliente) parts.push(`CLIENTE: ${data.cliente}`);
  if (data.fazenda) parts.push(`FAZENDA: ${data.fazenda}`);
  if (data.pedidos) parts.push(`PEDIDOS: ${data.pedidos}`);
  if (data.telefone) parts.push(`CONTATO/TELEFONE: ${data.telefone}`);
  if (data.obs) parts.push(`OBS: ${data.obs}`);
  if (data.quantidadeTexto) parts.push(`QUANTIDADE DOC: ${data.quantidadeTexto}`);
  if (data.dataEntrega) parts.push(`DATA ENTREGA: ${data.dataEntrega}`);
  if (data.dataEnvio) parts.push(`DATA ENVIO: ${data.dataEnvio}`);
  if (data.roteiro) parts.push(`ROTEIRO: ${data.roteiro}`);

  return parts.join('\n');
}
