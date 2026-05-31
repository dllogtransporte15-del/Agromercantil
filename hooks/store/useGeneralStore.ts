import { create } from 'zustand';
import type { Driver, Vehicle, Client, Product, User, Branch } from '../../types';
import { 
  fetchDrivers, fetchVehicles, fetchClients, 
  fetchProducts, fetchUsers, fetchBranches 
} from '../../services/api/db';

interface GeneralState {
  drivers: Driver[];
  vehicles: Vehicle[];
  clients: Client[];
  products: Product[];
  users: User[];
  branches: Branch[];
  loading: boolean;
  loadAll: () => Promise<void>;
  setDrivers: (d: Driver[] | ((prev: Driver[]) => Driver[])) => void;
  setVehicles: (v: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
  setClients: (c: Client[] | ((prev: Client[]) => Client[])) => void;
  setProducts: (p: Product[] | ((prev: Product[]) => Product[])) => void;
  setUsers: (u: User[] | ((prev: User[]) => User[])) => void;
  setBranches: (b: Branch[] | ((prev: Branch[]) => Branch[])) => void;
}

export const useGeneralStore = create<GeneralState>((set) => ({
  drivers: [],
  vehicles: [],
  clients: [],
  products: [],
  users: [],
  branches: [],
  loading: false,
  loadAll: async () => {
    set({ loading: true });
    try {
      const [dr, ve, cl, pr, us, br] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        fetchClients(),
        fetchProducts(),
        fetchUsers(),
        fetchBranches()
      ]);
      set({ 
        drivers: dr, 
        vehicles: ve, 
        clients: cl, 
        products: pr, 
        users: us, 
        branches: br,
        loading: false 
      });
    } catch (err) {
      console.error('Erro ao carregar dados gerais:', err);
      set({ loading: false });
    }
  },
  setDrivers: (d) => set((state) => ({ drivers: typeof d === 'function' ? d(state.drivers) : d })),
  setVehicles: (v) => set((state) => ({ vehicles: typeof v === 'function' ? v(state.vehicles) : v })),
  setClients: (c) => set((state) => ({ clients: typeof c === 'function' ? c(state.clients) : c })),
  setProducts: (p) => set((state) => ({ products: typeof p === 'function' ? p(state.products) : p })),
  setUsers: (u) => set((state) => ({ users: typeof u === 'function' ? u(state.users) : u })),
  setBranches: (b) => set((state) => ({ branches: typeof b === 'function' ? b(state.branches) : b })),
}));
