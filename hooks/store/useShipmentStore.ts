import { create } from 'zustand';
import type { Shipment } from '../../types';
import { fetchShipments, upsertShipment } from '../../services/api/db';

interface ShipmentState {
  shipments: Shipment[];
  loading: boolean;
  error: string | null;
  loadShipments: () => Promise<void>;
  setShipments: (shipments: Shipment[] | ((prev: Shipment[]) => Shipment[])) => void;
  addShipment: (shipment: Shipment) => void;
  updateShipmentInStore: (shipment: Shipment) => void;
}

export const useShipmentStore = create<ShipmentState>((set, get) => ({
  shipments: [],
  loading: false,
  error: null,
  loadShipments: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchShipments();
      set({ shipments: data, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao buscar embarques', loading: false });
    }
  },
  setShipments: (shipmentsOrUpdater) => set((state) => ({
    shipments: typeof shipmentsOrUpdater === 'function' ? shipmentsOrUpdater(state.shipments) : shipmentsOrUpdater
  })),
  addShipment: (shipment) => set((state) => ({ shipments: [shipment, ...state.shipments] })),
  updateShipmentInStore: (shipment) => set((state) => ({
    shipments: state.shipments.map(s => s.id === shipment.id ? shipment : s)
  })),
}));
