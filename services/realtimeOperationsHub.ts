import { supabase } from '../supabase';
import type { Shipment, Cargo, Ticket } from '../types';

export const OPERATIONS_REALTIME_CHANNEL = 'transcunha_operations_hub';

export interface ShipmentBroadcastPayload {
  action: 'create' | 'update' | 'delete' | 'status_change';
  shipmentId: string;
  status?: string;
  shipment?: Shipment;
  timestamp?: number;
}

export interface CargoBroadcastPayload {
  action: 'create' | 'update' | 'delete';
  cargoId: string;
  cargo?: Cargo;
  timestamp?: number;
}

export interface TicketBroadcastPayload {
  action: 'create' | 'update' | 'delete' | 'status_change' | 'attend';
  ticketId: string;
  status?: string;
  ticket?: Ticket;
  timestamp?: number;
}

let operationsChannelInstance: ReturnType<typeof supabase.channel> | null = null;

// Canal local no mesmo navegador (entre diferentes abas)
const localBroadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('transcunha_operations_sync') 
  : null;

/**
 * Obtém ou inicializa o canal central de operações no Supabase Realtime.
 */
export function getOperationsRealtimeChannel(): ReturnType<typeof supabase.channel> {
  if (!operationsChannelInstance) {
    operationsChannelInstance = supabase.channel(OPERATIONS_REALTIME_CHANNEL, {
      config: {
        broadcast: { ack: false, self: false },
      }
    });

    operationsChannelInstance.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Operations Realtime Hub] ✅ Conectado ao canal central de embarques.');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`[Operations Realtime Hub] ⚠️ Status do canal: ${status}`);
      }
    });
  }
  return operationsChannelInstance;
}

/**
 * Transmite uma notificação de mudança de embarque para TODOS os outros usuários conectados via WebSocket.
 */
export function broadcastShipmentChange(data: ShipmentBroadcastPayload): void {
  try {
    const payloadWithTs = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };

    // 1. WebSocket central do Supabase Realtime (entre diferentes computadores e usuários)
    const channel = getOperationsRealtimeChannel();
    channel.send({
      type: 'broadcast',
      event: 'shipment_changed',
      payload: payloadWithTs
    }).catch(err => {
      console.warn('[Operations Realtime Hub] Falha ao enviar broadcast de embarque:', err);
    });

    // 2. BroadcastChannel para abas abertas no mesmo navegador
    if (localBroadcast) {
      localBroadcast.postMessage({
        type: 'shipment_changed',
        payload: payloadWithTs
      });
    }

    // 3. Evento customizado DOM para a própria janela
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transcunha:shipment_changed', { detail: payloadWithTs }));
    }
  } catch (err) {
    console.warn('[Operations Realtime Hub] Erro ao disparar broadcast de embarque:', err);
  }
}

/**
 * Transmite uma notificação de mudança de carga para TODOS os outros usuários conectados via WebSocket.
 */
export function broadcastCargoChange(data: CargoBroadcastPayload): void {
  try {
    const payloadWithTs = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };

    const channel = getOperationsRealtimeChannel();
    channel.send({
      type: 'broadcast',
      event: 'cargo_changed',
      payload: payloadWithTs
    }).catch(err => {
      console.warn('[Operations Realtime Hub] Falha ao enviar broadcast de carga:', err);
    });

    if (localBroadcast) {
      localBroadcast.postMessage({
        type: 'cargo_changed',
        payload: payloadWithTs
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transcunha:cargo_changed', { detail: payloadWithTs }));
    }
  } catch (err) {
    console.warn('[Operations Realtime Hub] Erro ao disparar broadcast de carga:', err);
  }
}

/**
 * Transmite uma notificação de mudança de chamado para TODOS os outros usuários conectados via WebSocket.
 */
export function broadcastTicketChange(data: TicketBroadcastPayload): void {
  try {
    const payloadWithTs = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };

    const channel = getOperationsRealtimeChannel();
    channel.send({
      type: 'broadcast',
      event: 'ticket_changed',
      payload: payloadWithTs
    }).catch(err => {
      console.warn('[Operations Realtime Hub] Falha ao enviar broadcast de chamado:', err);
    });

    if (localBroadcast) {
      localBroadcast.postMessage({
        type: 'ticket_changed',
        payload: payloadWithTs
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transcunha:ticket_changed', { detail: payloadWithTs }));
    }
  } catch (err) {
    console.warn('[Operations Realtime Hub] Erro ao disparar broadcast de chamado:', err);
  }
}

export interface RdoBroadcastPayload {
  action: 'create' | 'update' | 'parecer_received';
  idSolicitacao: string;
  codigo?: number;
  cpf?: string;
  status?: string;
  parecer?: number;
  observacao?: string;
  shipmentId?: string;
  timestamp?: number;
}

/**
 * Transmite uma notificação de mudança ou retorno de parecer do RDO Nacional para os usuários conectados.
 */
export function broadcastRdoChange(data: RdoBroadcastPayload): void {
  try {
    const payloadWithTs = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };

    const channel = getOperationsRealtimeChannel();
    channel.send({
      type: 'broadcast',
      event: 'rdo_changed',
      payload: payloadWithTs
    }).catch(err => {
      console.warn('[Operations Realtime Hub] Falha ao enviar broadcast de RDO:', err);
    });

    if (localBroadcast) {
      localBroadcast.postMessage({
        type: 'rdo_changed',
        payload: payloadWithTs
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transcunha:rdo_changed', { detail: payloadWithTs }));
    }
  } catch (err) {
    console.warn('[Operations Realtime Hub] Erro ao disparar broadcast de RDO:', err);
  }
}

export interface SigaBroadcastPayload {
  action: 'create' | 'update' | 'status_change' | 'delete';
  processNumber: string;
  state?: string;
  driverCpf?: string;
  truckPlate?: string;
  shipmentId?: string;
  driverId?: string;
  timestamp?: number;
}

/**
 * Transmite uma notificação de atualização da análise SIGA GR para os usuários conectados.
 */
export function broadcastSigaChange(data: SigaBroadcastPayload): void {
  try {
    const payloadWithTs = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };

    const channel = getOperationsRealtimeChannel();
    channel.send({
      type: 'broadcast',
      event: 'siga_changed',
      payload: payloadWithTs
    }).catch(err => {
      console.warn('[Operations Realtime Hub] Falha ao enviar broadcast de SIGA GR:', err);
    });

    if (localBroadcast) {
      localBroadcast.postMessage({
        type: 'siga_changed',
        payload: payloadWithTs
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transcunha:siga_changed', { detail: payloadWithTs }));
    }
  } catch (err) {
    console.warn('[Operations Realtime Hub] Erro ao disparar broadcast de SIGA GR:', err);
  }
}

