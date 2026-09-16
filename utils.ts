export const formatId = (num: number, prefix: string, pad: number = 3): string => {
  return `${prefix}-${String(num).padStart(pad, '0')}`;
};

const numberToWordsPtBr = (num: number, gender: 'm' | 'f' = 'm'): string => {
  if (num === 0) return 'zero';

  const unitsM = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const unitsF = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const units = gender === 'm' ? unitsM : unitsF;
  
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const convertThreeDigits = (n: number, currentGender: 'm' | 'f'): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    
    let res = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;

    if (h > 0) res += hundreds[h];
    if (h > 0 && remainder > 0) res += ' e ';

    if (t === 1) {
      res += teens[u];
    } else {
      if (t > 1) res += tens[t];
      if (t > 1 && u > 0) res += ' e ';
      if (u > 0 || (h === 0 && t === 0)) {
          if (!(h > 0 && t === 0 && u === 0)) {
              res += (currentGender === 'm' ? unitsM[u] : unitsF[u]);
          }
      }
    }
    return res;
  };

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  let result = '';
  if (millions > 0) {
      result += convertThreeDigits(millions, 'm') + (millions === 1 ? ' milhão' : ' milhões');
      if (thousands > 0 || rest > 0) result += ' e ';
  }

  if (thousands > 0) {
    if (thousands === 1) {
      result += 'mil';
    } else {
      result += convertThreeDigits(thousands, 'm') + ' mil';
    }
    if (rest > 0) result += ' e ';
  }

  if (rest > 0 || (millions === 0 && thousands === 0)) {
    result += convertThreeDigits(rest, gender);
  }

  return result.trim();
};

export const formatWeightPtBr = (num: number): string => {
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 1000);

  let result = '';
  
  if (integerPart > 0) {
    result += numberToWordsPtBr(integerPart, 'f') + (integerPart === 1 ? ' tonelada' : ' toneladas');
  }

  if (decimalPart > 0) {
    if (result) result += ' e ';
    result += numberToWordsPtBr(decimalPart, 'm') + (decimalPart === 1 ? ' quilo' : ' quilos');
  }

  return (result || 'zero toneladas').toUpperCase();
};

import type { FreightOffer, Cargo } from './types';
import { FreightOfferStatus } from './types';

export const getMatchedCargo = (offer: FreightOffer, cargosList?: Cargo[]): Cargo | null => {
  if (!cargosList || cargosList.length === 0) return null;

  // 1. Direct cargoId link on offer
  if (offer.cargoId) {
    const targetCargoId = offer.cargoId;
    const cleanNum = targetCargoId.replace(/\D/g, '');
    const cargoByDirectId = cargosList.find(c => 
      c.id === targetCargoId || 
      `CRG-${c.sequenceId}` === targetCargoId ||
      (cleanNum ? c.sequenceId?.toString() === cleanNum : false)
    );
    if (cargoByDirectId) return cargoByDirectId;
  }


  // 2. Extract cargo ID / sequenceId from history log description (e.g. "Carga #104 criada a partir da oferta.")
  if (offer.history && offer.history.length > 0) {
    for (const h of offer.history) {
      if (h.description && (h.description.includes('criada a partir da oferta') || h.description.includes('Carga #'))) {
        const match = h.description.match(/Carga\s+#?(CRG-\d+|\d+)/i);
        if (match) {
          const cargoIdOrNum = match[1];
          const cargoByHistory = cargosList.find(c => 
            c.id.toLowerCase() === cargoIdOrNum.toLowerCase() ||
            `CRG-${c.sequenceId}`.toLowerCase() === cargoIdOrNum.toLowerCase() ||
            c.sequenceId?.toString() === cargoIdOrNum.replace(/\D/g, '')
          );
          if (cargoByHistory) return cargoByHistory;
        }
      }
    }
  }

  // 3. Fallback matching by client, product, origin, destination
  const normalize = (str?: string) => str ? str.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  const offerOrigin = normalize(offer.origin);
  const offerDest = normalize(offer.destination);

  return cargosList.find(c => {
    const matchClient = c.clientId === offer.clientId;
    const matchProduct = c.productId === offer.productId;
    const cargoOrigin = normalize(c.origin);
    const cargoDest = normalize(c.destination);
    
    const matchOrigin = cargoOrigin === offerOrigin || (cargoOrigin && offerOrigin && (cargoOrigin.includes(offerOrigin) || offerOrigin.includes(cargoOrigin)));
    const matchDest = cargoDest === offerDest || (cargoDest && offerDest && (cargoDest.includes(offerDest) || offerDest.includes(cargoDest)));

    return matchClient && matchProduct && matchOrigin && matchDest;
  }) || null;
};

export function isCteApplicableForStatus(status?: string | null): boolean {
  if (!status) return true;
  const nonCteStatuses = [
    'Ag. Cadastro',
    'Ag. Seguradora',
    'Ag. Carregamento',
    'Ag. Nota',
    'PreCadastro',
    'AguardandoSeguradora',
    'AguardandoCarregamento',
    'AguardandoNota',
    'Cancelado'
  ];
  return !nonCteStatuses.includes(status);
}

export function getShipmentCte(shipment?: { status?: any; cteNumber?: string; documents?: any } | null): string {
  if (!shipment) return '-';
  if (shipment.status && !isCteApplicableForStatus(shipment.status)) return '-';

  if (shipment.cteNumber && typeof shipment.cteNumber === 'string' && shipment.cteNumber.trim() !== '') {
    return shipment.cteNumber.trim();
  }
  if (shipment.documents?.cte_number && String(shipment.documents.cte_number).trim() !== '') {
    return String(shipment.documents.cte_number).trim();
  }

  const cteDocs = shipment.documents?.['CT-e'] || shipment.documents?.['CT-E'] || shipment.documents?.['cte'] || shipment.documents?.['Cte'];
  if (Array.isArray(cteDocs) && cteDocs.length > 0) {
    const extractedList: string[] = [];
    for (const item of cteDocs) {
      if (typeof item === 'string') {
        const match = item.match(/DACTE_(\d+)/i) || 
                      item.match(/CT[-_]?e[^\d]*(\d{3,8})/i) || 
                      item.match(/_(\d{3,8})\.(?:pdf|xml)/i);
        if (match && match[1]) {
          if (!extractedList.includes(match[1])) extractedList.push(match[1]);
        }
      }
    }
    if (extractedList.length > 0) return extractedList.join(', ');
  } else if (typeof cteDocs === 'string' && cteDocs.trim() !== '') {
    const match = cteDocs.match(/DACTE_(\d+)/i) || 
                  cteDocs.match(/CT[-_]?e[^\d]*(\d{3,8})/i) || 
                  cteDocs.match(/_(\d{3,8})\.(?:pdf|xml)/i);
    if (match && match[1]) return match[1];
  }

  return '-';
}

export function getShipmentCteEmissionDate(shipment?: { status?: any; cteEmissionDate?: string; documents?: any } | null): string | null {
  if (!shipment) return null;
  if (shipment.status && !isCteApplicableForStatus(shipment.status)) return null;

  if (shipment.cteEmissionDate) return shipment.cteEmissionDate;
  if (shipment.documents?.cte_emission_date) return String(shipment.documents.cte_emission_date);

  const cteDocs = shipment.documents?.['CT-e'] || shipment.documents?.['CT-E'] || shipment.documents?.['cte'] || shipment.documents?.['Cte'];
  if (Array.isArray(cteDocs) && cteDocs.length > 0) {
    for (const item of cteDocs) {
      if (typeof item === 'string') {
        const matchPt = item.match(/(\d{2})[-_.](\d{2})[-_.](\d{4})(?:[-_.\s]*(\d{2})[:_.](\d{2}))?/);
        if (matchPt) {
          return matchPt[4] ? `${matchPt[1]}/${matchPt[2]}/${matchPt[3]} ${matchPt[4]}:${matchPt[5]}` : `${matchPt[1]}/${matchPt[2]}/${matchPt[3]}`;
        }
        const matchIso = item.match(/(\d{4})[-_.](\d{2})[-_.](\d{2})(?:[T\s_-]*(\d{2})[:_.](\d{2}))?/);
        if (matchIso) {
          return matchIso[4] ? `${matchIso[3]}/${matchIso[2]}/${matchIso[1]} ${matchIso[4]}:${matchIso[5]}` : `${matchIso[3]}/${matchIso[2]}/${matchIso[1]}`;
        }
      }
    }
  }

  return null;
}

export function parseDateToYmd(dateStr?: string | null): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Match DD/MM/YYYY or DD-MM-YYYY (with optional time)
  const dmy = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  // Match YYYY-MM-DD (with optional time)
  const ymd = trimmed.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

export function getShipmentEffectiveDate(shipment?: { status?: any; cteEmissionDate?: string; documents?: any; statusHistory?: any[]; scheduledDate?: string; createdAt?: string } | null): string | null {
  if (!shipment) return null;

  // 1. Prioritize CT-e Emission Date if CT-e exists and status is applicable
  const cteEmission = getShipmentCteEmissionDate(shipment);
  if (cteEmission) {
    const ymd = parseDateToYmd(cteEmission);
    if (ymd) return ymd;
  }

  // 2. Aguardando Nota status history timestamp (effective loading)
  const effectiveEntry = shipment.statusHistory?.find((h: any) => 
    h.status === 'AguardandoNota' || 
    h.status === 'Ag. Nota' || 
    h.status === 'Aguardando Nota'
  );
  if (effectiveEntry?.timestamp) {
    return effectiveEntry.timestamp.substring(0, 10);
  }

  // 3. Scheduled Date
  if (shipment.scheduledDate) {
    const ymd = parseDateToYmd(shipment.scheduledDate);
    if (ymd) return ymd;
    return shipment.scheduledDate.substring(0, 10);
  }

  // 4. Created At
  if (shipment.createdAt) {
    return shipment.createdAt.substring(0, 10);
  }

  return null;
}

export function isStayForShipment(
  stay?: { shipmentId?: string; plate?: string; driver?: string; invoice?: string; entryDate?: string; date?: string } | null,
  shipment?: { id?: string; orderId?: string; horsePlate?: string; driverName?: string; nfeNumber?: string; documents?: any; scheduledDate?: string; createdAt?: string } | null
): boolean {
  if (!stay || !shipment) return false;

  // 1. Direct match by shipmentId
  if (stay.shipmentId && typeof stay.shipmentId === 'string' && stay.shipmentId.trim() !== '') {
    const cleanStayId = stay.shipmentId.trim().toLowerCase();
    if (shipment.id && shipment.id.toLowerCase() === cleanStayId) return true;
    if (shipment.orderId && shipment.orderId.toLowerCase() === cleanStayId) return true;
    return false; // If stay has an explicit shipmentId assigned, it strictly belongs to that shipment
  }

  // 2. Match by Plate and Driver if available
  const stayPlate = stay.plate ? stay.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
  const sPlate = shipment.horsePlate ? shipment.horsePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

  if (stayPlate && sPlate && stayPlate === sPlate) {
    // If date is available, check month compatibility to avoid cross-month driver trip collisions
    const stayDateStr = stay.entryDate || stay.date;
    const stayYmd = parseDateToYmd(stayDateStr);
    const shipYmd = getShipmentEffectiveDate(shipment as any) || parseDateToYmd(shipment.scheduledDate) || parseDateToYmd(shipment.createdAt);
    if (stayYmd && shipYmd) {
      const stayMonth = stayYmd.substring(0, 7);
      const shipMonth = shipYmd.substring(0, 7);
      if (stayMonth !== shipMonth) {
        return false;
      }
    }

    if (stay.driver && shipment.driverName) {
      const d1 = stay.driver.toLowerCase().trim();
      const d2 = shipment.driverName.toLowerCase().trim();
      if (d1.includes(d2) || d2.includes(d1) || d1.split(' ')[0] === d2.split(' ')[0]) {
        return true;
      }
    } else {
      return true;
    }
  }

  return false;
}

export function findShipmentForStay<T extends { id?: string; orderId?: string; horsePlate?: string; driverName?: string; nfeNumber?: string; documents?: any; scheduledDate?: string; createdAt?: string }>(
  stay?: { shipmentId?: string; plate?: string; invoice?: string; driver?: string; date?: string } | null,
  shipments?: T[] | null
): T | null {
  if (!stay || !shipments || shipments.length === 0) return null;

  // 1. Direct match by shipmentId
  if (stay.shipmentId && typeof stay.shipmentId === 'string' && stay.shipmentId.trim() !== '') {
    const cleanId = stay.shipmentId.trim().toLowerCase();
    const directMatch = shipments.find(s => 
      (s.id && s.id.toLowerCase() === cleanId) || 
      (s.orderId && s.orderId.toLowerCase() === cleanId)
    );
    if (directMatch) return directMatch;
  }

  // 2. Match by Plate
  const stayPlate = stay.plate ? stay.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
  const stayInvoice = stay.invoice ? stay.invoice.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

  if (stayPlate) {
    const matchingPlateShipments = shipments.filter(s => {
      const sPlate = s.horsePlate ? s.horsePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
      return sPlate === stayPlate;
    });

    if (matchingPlateShipments.length === 1) {
      return matchingPlateShipments[0];
    }

    if (matchingPlateShipments.length > 1) {
      // Try NF-e match
      if (stayInvoice) {
        const invMatch = matchingPlateShipments.find(s => {
          const sNfe = (s.nfeNumber || s.documents?.nfe_number || s.documents?.['NF-e'] || '') + '';
          return sNfe.replace(/[^a-zA-Z0-9]/g, '').includes(stayInvoice);
        });
        if (invMatch) return invMatch;
      }

      // Try Driver match
      if (stay.driver) {
        const cleanDriver = stay.driver.toLowerCase().trim();
        const driverMatch = matchingPlateShipments.find(s => 
          s.driverName && (s.driverName.toLowerCase().includes(cleanDriver) || cleanDriver.includes(s.driverName.toLowerCase().trim()))
        );
        if (driverMatch) return driverMatch;
      }

      // Date proximity fallback
      if (stay.date) {
        const stayTime = new Date(stay.date).getTime();
        if (!isNaN(stayTime)) {
          let closest = matchingPlateShipments[0];
          let minDiff = Infinity;
          for (const s of matchingPlateShipments) {
            const sEffDate = getShipmentEffectiveDate(s as any) || s.scheduledDate || s.createdAt;
            if (sEffDate) {
              const diff = Math.abs(new Date(sEffDate).getTime() - stayTime);
              if (diff < minDiff) {
                minDiff = diff;
                closest = s;
              }
            }
          }
          return closest;
        }
      }

      return matchingPlateShipments[0];
    }
  }

  return null;
}

export function getStayEffectiveDate(
  stay?: { shipmentId?: string; plate?: string; invoice?: string; driver?: string; date?: string } | null,
  shipments?: any[] | null
): string | null {
  if (!stay) return null;

  if (shipments && shipments.length > 0) {
    const linkedShipment = findShipmentForStay(stay, shipments);
    if (linkedShipment) {
      const effDate = getShipmentEffectiveDate(linkedShipment);
      if (effDate) return effDate;
      if (linkedShipment.scheduledDate) {
        const ymd = parseDateToYmd(linkedShipment.scheduledDate);
        if (ymd) return ymd;
      }
    }
  }

  // Fallback to stay.date
  if (stay.date) {
    const ymd = parseDateToYmd(stay.date);
    if (ymd) return ymd;
    return String(stay.date).substring(0, 10);
  }

  return null;
}




