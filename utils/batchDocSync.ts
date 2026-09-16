import { Shipment } from '../types';
import { extractDetailedDocData, DetailedDocumentData } from './fiscalDocParser';
import { calculateShipmentExpenses } from './operationalExpensesCalculator';

export interface SyncProgressCallback {
  (current: number, total: number, shipmentId: string, statusText: string): void;
}

export interface SyncResult {
  totalProcessed: number;
  totalUpdated: number;
  updatedShipments: Shipment[];
  errors: Array<{ shipmentId: string; error: string }>;
}

/**
 * Sincroniza e extrai os detalhes dos documentos anexados de um único embarque.
 */
export async function syncSingleShipmentDocuments(
  shipment: Shipment
): Promise<{ updatedShipment: Shipment; hasChanges: boolean }> {
  if (!shipment.documents || Object.keys(shipment.documents).length === 0) {
    return { updatedShipment: shipment, hasChanges: false };
  }

  const updated: Partial<Shipment> = {};
  let hasChanges = false;

  for (const [docType, files] of Object.entries(shipment.documents)) {
    if (!files) continue;
    const fileList = Array.isArray(files) ? files : [files];

    for (const fileOrUrl of fileList) {
      if (!fileOrUrl) continue;
      // Aceita File ou URL string válida
      if (typeof fileOrUrl !== 'string' && !(fileOrUrl instanceof File)) continue;
      if (typeof fileOrUrl === 'string' && fileOrUrl.length < 5) continue;

      try {
        const extracted: DetailedDocumentData = await extractDetailedDocData(fileOrUrl, docType);

        // 1. Sincronização CT-e
        if (extracted.documentType === 'CT-e' || docType.toLowerCase().includes('ct-e') || docType.toLowerCase().includes('cte')) {
          if (extracted.docNumber && shipment.cteNumber !== extracted.docNumber) {
            updated.cteNumber = extracted.docNumber;
            hasChanges = true;
          }
          if (extracted.emissionDate && shipment.cteEmissionDate !== extracted.emissionDate) {
            updated.cteEmissionDate = extracted.emissionDate;
            hasChanges = true;
          }
        }

        // 2. Sincronização Nota Fiscal
        if (extracted.documentType === 'Nota Fiscal' || docType.toLowerCase().includes('nota fiscal') || docType.toLowerCase().includes('danfe') || docType.toLowerCase().includes('nfe')) {
          if (extracted.docNumber && shipment.nfeNumber !== extracted.docNumber) {
            updated.nfeNumber = extracted.docNumber;
            hasChanges = true;
          }
          if (extracted.carga?.valorMercadoria && shipment.nfeValue !== extracted.carga.valorMercadoria) {
            updated.nfeValue = extracted.carga.valorMercadoria;
            hasChanges = true;
          }
        }

        // 3. Sincronização MDF-e
        if (extracted.documentType === 'MDF-e' || docType.toLowerCase().includes('mdf-e') || docType.toLowerCase().includes('mdfe') || docType.toLowerCase().includes('damdfe')) {
          if (extracted.docNumber && shipment.mdfeNumber !== extracted.docNumber) {
            updated.mdfeNumber = extracted.docNumber;
            hasChanges = true;
          }
        }

        // 4. Sincronização Carta Frete / Contrato de Frete
        if (extracted.documentType === 'Carta Frete' || docType.toLowerCase().includes('carta frete') || docType.toLowerCase().includes('contrato') || docType.toLowerCase().includes('e-frete')) {
          if (extracted.financeiro?.porcentagemAdiantamento !== undefined && shipment.advancePercentage !== extracted.financeiro.porcentagemAdiantamento) {
            updated.advancePercentage = extracted.financeiro.porcentagemAdiantamento;
            hasChanges = true;
          }
          if (extracted.financeiro?.valorAdiantamento !== undefined && shipment.advanceValue !== extracted.financeiro.valorAdiantamento) {
            updated.advanceValue = extracted.financeiro.valorAdiantamento;
            hasChanges = true;
          }
          if (extracted.financeiro?.valorPedagio !== undefined && shipment.tollValue !== extracted.financeiro.valorPedagio) {
            updated.tollValue = extracted.financeiro.valorPedagio;
            hasChanges = true;
          }
          if (extracted.financeiro?.valorSaldo !== undefined && shipment.balanceToReceiveValue !== extracted.financeiro.valorSaldo) {
            updated.balanceToReceiveValue = extracted.financeiro.valorSaldo;
            hasChanges = true;
          }
          if (extracted.financeiro?.chavePix && !shipment.pixKey) {
            updated.pixKey = extracted.financeiro.chavePix;
            hasChanges = true;
          }
        }

        // 5. Sincronização Ticket de Carregamento
        if (docType.toLowerCase().includes('ticket') || docType.toLowerCase().includes('carregamento')) {
          if (extracted.carga?.pesoBrutoKg && !shipment.loadedTonnage) {
            const ton = extracted.carga.pesoBrutoKg >= 1000 
              ? Number((extracted.carga.pesoBrutoKg / 1000).toFixed(3)) 
              : extracted.carga.pesoBrutoKg;
            updated.loadedTonnage = ton;
            hasChanges = true;
          }
        }
      } catch (e) {
        // Erro silencioso em documento individual, continua com os demais
        console.warn(`[Sync] Falha ao extrair documento ${docType} do embarque ${shipment.id}:`, e);
      }
    }
  }

  if (!hasChanges) {
    return { updatedShipment: shipment, hasChanges: false };
  }

  const finalShipment: Shipment = {
    ...shipment,
    ...updated,
  };

  return { updatedShipment: finalShipment, hasChanges: true };
}

/**
 * Executa a sincronização em lote de todos os embarques que possuem documentos.
 */
export async function syncAllShipmentsDocuments(
  shipments: Shipment[],
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  const eligibleShipments = shipments.filter(s => s.documents && Object.keys(s.documents).length > 0);
  const total = eligibleShipments.length;

  let totalUpdated = 0;
  const updatedShipments: Shipment[] = [];
  const errors: Array<{ shipmentId: string; error: string }> = [];

  for (let i = 0; i < total; i++) {
    const s = eligibleShipments[i];
    if (onProgress) {
      onProgress(i + 1, total, s.id, `Lendo documentos do embarque ${s.id}...`);
    }

    try {
      const result = await syncSingleShipmentDocuments(s);
      if (result.hasChanges) {
        totalUpdated++;
        updatedShipments.push(result.updatedShipment);
      }
    } catch (err: any) {
      errors.push({ shipmentId: s.id, error: err?.message || 'Erro ao sincronizar' });
    }
  }

  if (onProgress) {
    onProgress(total, total, '', `Sincronização concluída! ${totalUpdated} embarque(s) atualizados.`);
  }

  return {
    totalProcessed: total,
    totalUpdated,
    updatedShipments,
    errors,
  };
}
