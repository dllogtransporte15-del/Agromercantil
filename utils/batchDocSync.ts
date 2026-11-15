import { Shipment } from '../types';
import { extractDetailedDocData, DetailedDocumentData, isStrictNotaFiscalCategory } from './fiscalDocParser';
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
          if (extracted.remetente?.razaoSocial || extracted.tomador?.razaoSocial || extracted.tomador?.cnpjCpf) {
            const currentDocs = (updated.documents || shipment.documents || {}) as any;
            updated.documents = {
              ...currentDocs,
              ...(extracted.remetente?.razaoSocial ? { cte_remetente: extracted.remetente.razaoSocial } : {}),
              ...(extracted.tomador?.razaoSocial ? { cte_tomador: extracted.tomador.razaoSocial } : {}),
              ...(extracted.tomador?.cnpjCpf ? { cte_tomador_cnpj: extracted.tomador.cnpjCpf } : {}),
            };
            hasChanges = true;
          }
        }

        // 2. Sincronização Nota Fiscal (apenas campo estrito "Nota Fiscal")
        if (isStrictNotaFiscalCategory(docType)) {
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
          if (extracted.ciot && (shipment.ciotNumber !== extracted.ciot || shipment.ciot !== extracted.ciot)) {
            updated.ciotNumber = extracted.ciot;
            updated.ciot = extracted.ciot;
            const currentDocs = (updated.documents || shipment.documents || {}) as any;
            updated.documents = {
              ...currentDocs,
              ciot_number: extracted.ciot,
              ciot: extracted.ciot,
            };
            hasChanges = true;
          }
          if (extracted.financeiro?.porcentagemAdiantamento !== undefined && shipment.advancePercentage !== extracted.financeiro.porcentagemAdiantamento) {
            updated.advancePercentage = extracted.financeiro.porcentagemAdiantamento;
            hasChanges = true;
          }
          if (extracted.financeiro?.valorAdiantamento !== undefined && shipment.advanceValue !== extracted.financeiro.valorAdiantamento) {
            updated.advanceValue = extracted.financeiro.valorAdiantamento;
            hasChanges = true;
          }
          const tollExplicitlyZero = shipment.tollValue !== undefined && shipment.tollValue !== null && Number(shipment.tollValue) === 0;
          if (extracted.financeiro?.valorPedagio !== undefined && shipment.tollValue !== extracted.financeiro.valorPedagio && !(tollExplicitlyZero && extracted.financeiro.valorPedagio > 0)) {
            updated.tollValue = extracted.financeiro.valorPedagio;
            hasChanges = true;
          }
          const saldoFromDoc = extracted.calculoSaldoFrete?.subtotal !== undefined 
            ? extracted.calculoSaldoFrete.subtotal 
            : extracted.financeiro?.valorSaldo;
          if (saldoFromDoc !== undefined && shipment.balanceToReceiveValue !== saldoFromDoc) {
            updated.balanceToReceiveValue = saldoFromDoc;
            hasChanges = true;
          }
          if (extracted.financeiro?.chavePix && !shipment.pixKey) {
            updated.pixKey = extracted.financeiro.chavePix;
            hasChanges = true;
          }
          if (extracted.calculoSaldoFrete?.sestSenat !== undefined) {
            const currentRealProfit: any = { ...(shipment.realProfitData || {}), ...(updated.realProfitData || {}) };
            currentRealProfit.sestSenat = extracted.calculoSaldoFrete.sestSenat;
            if (extracted.calculoSaldoFrete.inssRetido !== undefined) {
              currentRealProfit.inssRetido = extracted.calculoSaldoFrete.inssRetido;
            }
            updated.realProfitData = currentRealProfit;
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
