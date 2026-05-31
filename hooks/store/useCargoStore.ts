import { create } from 'zustand';
import type { Cargo } from '../../types';
import { fetchCargos } from '../../services/api/db';

interface CargoState {
  cargos: Cargo[];
  loading: boolean;
  error: string | null;
  loadCargos: () => Promise<void>;
  setCargos: (cargos: Cargo[] | ((prev: Cargo[]) => Cargo[])) => void;
  addCargo: (cargo: Cargo) => void;
  updateCargoInStore: (cargo: Cargo) => void;
}

export const useCargoStore = create<CargoState>((set) => ({
  cargos: [],
  loading: false,
  error: null,
  loadCargos: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchCargos();
      set({ cargos: data, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao buscar cargas', loading: false });
    }
  },
  setCargos: (cargosOrUpdater) => set((state) => ({
    cargos: typeof cargosOrUpdater === 'function' ? cargosOrUpdater(state.cargos) : cargosOrUpdater
  })),
  addCargo: (cargo) => set((state) => ({ cargos: [cargo, ...state.cargos] })),
  updateCargoInStore: (cargo) => set((state) => ({
    cargos: state.cargos.map(c => c.id === cargo.id ? cargo : c)
  })),
}));
