import { ShipmentStatus, type Cargo, type Shipment } from '../types';

export interface CargoBalance {
  /** Volume efetivamente carregado/em trânsito/finalizado (ton) */
  loadedVolume: number;
  /** Volume agendado aguardando carregamento (ton) */
  scheduledPendingVolume: number;
  /** Volume total empenhado (carregado + agendado pendente) */
  totalCommittedVolume: number;
  /** Saldo de volume disponível para novas alocações (ton) */
  availableVolume: number;
  /** Volume alocado além do limite total do lote (ton) */
  excessVolume: number;
  /** Contagem de embarques ativos (não cancelados) */
  activeShipmentsCount: number;
  /** Contagem de embarques já carregados / finalizados */
  loadedShipmentsCount: number;
  /** Contagem de embarques pendentes de carregamento */
  pendingShipmentsCount: number;
  /** Contagem de embarques cancelados */
  cancelledShipmentsCount: number;
}

/**
 * Status de embarque que estão agendados mas ainda NÃO iniciaram/concluíram o carregamento na origem.
 */
export const PENDING_LOADING_STATUSES: readonly ShipmentStatus[] = [
  ShipmentStatus.PreCadastro,            // "Ag. Cadastro"
  ShipmentStatus.AguardandoSeguradora,   // "Ag. Seguradora"
  ShipmentStatus.AguardandoCarregamento, // "Ag. Carregamento"
];

/**
 * Status de embarque onde o veículo já carregou na origem, está em trânsito, descarregando ou concluído.
 */
export const LOADED_OR_BEYOND_STATUSES: readonly ShipmentStatus[] = [
  ShipmentStatus.AguardandoNota,           // "Ag. Nota" (carregado, emitindo NF)
  ShipmentStatus.AguardandoFiscal,         // "Ag. Fiscal" (carregado, emitindo CT-e/MDF-e)
  ShipmentStatus.AguardandoAdiantamento,   // "Ag. Adiantamento"
  ShipmentStatus.AguardandoAgendamento,    // "Ag. Agend. ou Troca/nfe"
  ShipmentStatus.AguardandoDescarga,       // "Ag. Descarga" (em trânsito/chegada)
  ShipmentStatus.ValidacaoTicket,          // "Valid. de Ticket" (descarregado)
  ShipmentStatus.AguardandoPagamentoSaldo, // "Ag. Saldo"
  ShipmentStatus.Finalizado,               // "Finalizado"
];

/**
 * Verifica se o status do embarque é de pendência de carregamento.
 */
export function isShipmentPendingLoading(status: ShipmentStatus | string): boolean {
  return PENDING_LOADING_STATUSES.includes(status as ShipmentStatus) ||
    status === 'Ag. Cadastro' ||
    status === 'Ag. Seguradora' ||
    status === 'Ag. Carregamento';
}

/**
 * Verifica se o status do embarque já representa volume carregado/efetivado.
 */
export function isShipmentLoadedOrBeyond(status: ShipmentStatus | string): boolean {
  if (status === ShipmentStatus.Cancelado || status === 'Cancelado') return false;
  return LOADED_OR_BEYOND_STATUSES.includes(status as ShipmentStatus) ||
    status === 'Ag. Nota' ||
    status === 'Ag. Fiscal' ||
    status === 'Ag. Adiantamento' ||
    status === 'Ag. Agend. ou Troca/nfe' ||
    status === 'Ag. Descarga' ||
    status === 'Valid. de Ticket' ||
    status === 'Ag. Saldo' ||
    status === 'Finalizado';
}

/**
 * Normaliza chave de identificação de carga para conferência resiliente.
 */
function isShipmentForCargo(s: Shipment, cargo: Cargo): boolean {
  if (!s.cargoId) return false;
  if (s.cargoId === cargo.id) return true;
  if (cargo.sequenceId && (
    s.cargoId === String(cargo.sequenceId) ||
    s.cargoId === `CRG-${cargo.sequenceId}` ||
    s.cargoId.replace(/\D/g, '') === String(cargo.sequenceId)
  )) {
    return true;
  }
  return false;
}

/**
 * Calcula com precisão o saldo e volumes de uma carga (Lote).
 * Quando `shipments` é fornecido, calcula a verdade exata a partir dos embarques reais,
 * eliminando qualquer defasagem cumulativa ou erro de mutação manual.
 */
export function calculateCargoBalance(cargo: Cargo, shipments?: Shipment[]): CargoBalance {
  const totalVolume = Number(cargo.totalVolume) || 0;

  if (shipments && shipments.length > 0) {
    const relatedShipments = shipments.filter(s => isShipmentForCargo(s, cargo));
    
    let loadedVolume = 0;
    let scheduledPendingVolume = 0;
    let loadedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;

    for (const s of relatedShipments) {
      if (s.status === ShipmentStatus.Cancelado || (s.status as string) === 'Cancelado') {
        cancelledCount++;
        continue;
      }

      const ton = Number(s.shipmentTonnage) || 0;

      if (isShipmentPendingLoading(s.status)) {
        scheduledPendingVolume += ton;
        pendingCount++;
      } else {
        // Status carregado em diante
        loadedVolume += ton;
        loadedCount++;
      }
    }

    const roundedLoaded = Number(loadedVolume.toFixed(2));
    const roundedPending = Number(scheduledPendingVolume.toFixed(2));
    const totalCommitted = Number((roundedLoaded + roundedPending).toFixed(2));
    const available = Number(Math.max(0, totalVolume - totalCommitted).toFixed(2));
    const excess = Number(Math.max(0, totalCommitted - totalVolume).toFixed(2));

    return {
      loadedVolume: roundedLoaded,
      scheduledPendingVolume: roundedPending,
      totalCommittedVolume: totalCommitted,
      availableVolume: available,
      excessVolume: excess,
      activeShipmentsCount: loadedCount + pendingCount,
      loadedShipmentsCount: loadedCount,
      pendingShipmentsCount: pendingCount,
      cancelledShipmentsCount: cancelledCount,
    };
  }

  // Fallback baseado nos campos armazenados na carga (quando shipments não estiver disponível no escopo)
  const storedLoaded = Number(cargo.loadedVolume) || 0;
  const storedScheduled = Number(cargo.scheduledVolume) || 0;
  const scheduledPending = Math.max(0, Number((storedScheduled - storedLoaded).toFixed(2)));
  const totalCommitted = Math.max(storedLoaded, storedScheduled);
  const available = Number(Math.max(0, totalVolume - totalCommitted).toFixed(2));
  const excess = Number(Math.max(0, totalCommitted - totalVolume).toFixed(2));

  return {
    loadedVolume: Number(storedLoaded.toFixed(2)),
    scheduledPendingVolume: scheduledPending,
    totalCommittedVolume: Number(totalCommitted.toFixed(2)),
    availableVolume: available,
    excessVolume: excess,
    activeShipmentsCount: 0,
    loadedShipmentsCount: 0,
    pendingShipmentsCount: 0,
    cancelledShipmentsCount: 0,
  };
}

/**
 * Reconcilia um objeto Cargo com os embarques reais, retornando um Cargo com
 * `scheduledVolume` e `loadedVolume` perfeitamente alinhados à verdade dos embarques.
 */
export function reconcileCargoWithShipments(cargo: Cargo, shipments: Shipment[]): Cargo {
  const balance = calculateCargoBalance(cargo, shipments);
  if (
    Math.abs((cargo.scheduledVolume || 0) - balance.totalCommittedVolume) < 0.005 &&
    Math.abs((cargo.loadedVolume || 0) - balance.loadedVolume) < 0.005
  ) {
    return cargo;
  }

  return {
    ...cargo,
    scheduledVolume: balance.totalCommittedVolume,
    loadedVolume: balance.loadedVolume,
  };
}

/**
 * Reconcilia uma lista inteira de cargas com a lista de embarques.
 */
export function reconcileAllCargos(cargos: Cargo[], shipments: Shipment[]): {
  reconciledCargos: Cargo[];
  updatedCargoIds: string[];
} {
  const updatedCargoIds: string[] = [];
  const reconciledCargos = cargos.map(cargo => {
    const balance = calculateCargoBalance(cargo, shipments);
    const hasScheduledDiff = Math.abs((cargo.scheduledVolume || 0) - balance.totalCommittedVolume) >= 0.005;
    const hasLoadedDiff = Math.abs((cargo.loadedVolume || 0) - balance.loadedVolume) >= 0.005;

    if (hasScheduledDiff || hasLoadedDiff) {
      updatedCargoIds.push(cargo.id);
      return {
        ...cargo,
        scheduledVolume: balance.totalCommittedVolume,
        loadedVolume: balance.loadedVolume,
      };
    }
    return cargo;
  });

  return { reconciledCargos, updatedCargoIds };
}
