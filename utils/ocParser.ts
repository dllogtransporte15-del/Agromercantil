import { KNOWN_OC_NUMBERS } from './knownOcNumbers';
import { Shipment } from '../types';

/**
 * Extrai o número sequencial da Ordem de Carregamento (ex: 1593) a partir do texto de uma OC / Autorização de Carregamento.
 */
export function extractOcNumberFromText(text: string): string | null {
  if (!text) return null;

  // Pattern 1: Td (N...) Tj ... Td (1593) Tj (comum em streams do PDF)
  const regexStream = /Td\s*\(([^\)]*N[ºo\\?°][^\)]*)\)\s*Tj[\s\S]{1,150}?Td\s*\(([0-9]{2,10})\)\s*Tj/i;
  const mStream = text.match(regexStream);
  if (mStream && mStream[2]) return mStream[2];

  // Pattern 2: AUTORIZAÇÃO DE CARREGAMENTO / ORDEM DE CARREGAMENTO ... Nº 1593
  const directMatch = text.match(/(?:AUTORIZA[ÇC][ÃA]O\s+DE\s+CARREGAMENTO|ORDEM\s+DE\s+CARREGAMENTO)[\s\S]{0,150}?N[ºo\\?°\.\s:]+([0-9]{2,10})/i);
  if (directMatch && directMatch[1]) return directMatch[1].trim();

  // Pattern 3: SÉRIE ÚNICA ... Nº 1593
  const serieMatch = text.match(/S[ÉE]RIE\s+[ÚU]NICA[\s\S]{0,100}?N[ºo\\?°\.\s:]+([0-9]{2,10})/i);
  if (serieMatch && serieMatch[1]) return serieMatch[1].trim();

  // Pattern 4: OC Nº: 1593
  const ocMatch = text.match(/OC\s*N[ºo\\?°\.\s:]+([0-9]{2,10})/i);
  if (ocMatch && ocMatch[1]) return ocMatch[1].trim();

  // Pattern 5: N° 1593 ou Nº 1593 solto
  const nMatch = text.match(/\bN[ºo°\?][\s\.:]+([0-9]{3,6})\b/i);
  if (nMatch && nMatch[1]) return nMatch[1].trim();

  return null;
}

/**
 * Retorna o número da Ordem de Carregamento para um embarque, priorizando:
 * 1. Documentos salvos no embarque (ordem_carregamento_numero / oc_number / numero_ordem_carregamento)
 * 2. Mapeamento histórico direto (KNOWN_OC_NUMBERS)
 * 3. Fallback com o formato OC-{orderId}
 */
export function getShipmentOcNumber(shipment?: Shipment | { id: string; orderId?: string; documents?: any } | null): string {
  if (!shipment) return '-';

  const docs = shipment.documents as any;
  if (docs && typeof docs === 'object') {
    const docNum = docs.ordem_carregamento_numero || 
                   docs.oc_number || 
                   docs.numero_ordem_carregamento || 
                   docs.ocNumber || 
                   docs.numero_oc;
    if (docNum && String(docNum).trim() && String(docNum).trim() !== '-') {
      return String(docNum).trim();
    }
  }

  const directNum = (shipment as any).ocNumber || (shipment as any).ordemCarregamentoNumero;
  if (directNum && String(directNum).trim() && String(directNum).trim() !== '-') {
    return String(directNum).trim();
  }

  if (shipment.id && KNOWN_OC_NUMBERS[shipment.id]) {
    return KNOWN_OC_NUMBERS[shipment.id];
  }

  // Fallback: identificador do pedido/ordem
  const orderId = (shipment as any).orderId;
  if (orderId && typeof orderId === 'string' && orderId.trim()) {
    // Se orderId for puramente numérico (ex: "1593"), usa direto
    const digitsOnly = orderId.replace(/\D/g, '');
    if (digitsOnly.length >= 3 && digitsOnly.length <= 6 && !orderId.startsWith('ord_')) {
      return digitsOnly;
    }
    return `OC-${orderId}`;
  }

  return shipment.id ? `OC-${shipment.id.slice(0, 6)}` : '-';
}

export { KNOWN_OC_NUMBERS };
