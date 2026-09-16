export interface User {
  id: string;
  companyName: string;
  email: string;
  passwordHash: string; // In a real app, never store plain text. We'll simulate here.
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
}

export interface StayRecord {
  id: string;
  companyId: string;
  clientName?: string;
  date: string;
  driver: string;
  plate: string;
  invoice: string;
  origin: string;
  destination: string;
  location: 'Origem' | 'Destino';
  entryDate: string;
  exitDate: string;
  totalHours: number;
  weight: number;
  valuePerHour: number;
  tolerance: number;
  totalValue: number;
  calculationType?: 'TON_HOUR' | 'DAILY_FIXED';
  dailyRate?: number;
  daysCount?: number;
}

export interface QuoteRecord {
  id: string;
  companyId: string;
  clientName?: string;
  date: string;
  origin: string;
  destination: string;
  distance: number;
  axes: number;
  cargoType: string;
  inputMode: 'PER_KM' | 'TOTAL' | 'PER_TON';
  valuePerKm: number; // Can be derived if TOTAL
  driverTotalValue: number; // The manually entered or calculated total for driver
  tollValue: number;
  anttValue: number;
  weight: number;
  margin: number;
  icms: number;
  driverFreightPerTon: number;
  companyFreightPerTon: number;
  companyTotalFreight: number;
  dieselPrice: number;
  averageConsumption: number;
  driverCommissionPercent: number;
  dieselCost: number;
  commissionValue: number;
  carrierNetProfit: number;
  carrierProfitMargin: number;
}

// User Management
export const getUsers = (): User[] => {
  try {
    return JSON.parse(localStorage.getItem('dllog_users') || '[]');
  } catch {
    return [];
  }
};

export const saveUser = (user: Omit<User, 'id'>): User => {
  try {
    const users = getUsers();
    const id = `EMP-${String(users.length + 1).padStart(3, '0')}`;
    const newUser: User = { ...user, id };
    localStorage.setItem('dllog_users', JSON.stringify([...users, newUser]));
    return newUser;
  } catch (e) {
    console.error('Error saving user:', e);
    throw new Error('Não foi possível salvar o usuário. Verifique se o seu navegador permite o uso de armazenamento local.');
  }
};

export const getLoggedInUser = (): User | null => {
  try {
    const userStr = localStorage.getItem('dllog_logged_in_user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

export const setLoggedInUser = (user: User | null) => {
  try {
    if (user) {
      localStorage.setItem('dllog_logged_in_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('dllog_logged_in_user');
    }
  } catch (e) {
    console.error('Error setting logged in user:', e);
  }
};

// Client Management
export const getClients = (companyId: string): Client[] => {
  try {
    const allClients: Client[] = JSON.parse(localStorage.getItem('dllog_clients') || '[]');
    return allClients.filter(c => c.companyId === companyId);
  } catch {
    return [];
  }
};

export const saveClient = (companyId: string, name: string): Client => {
  try {
    const allClients: Client[] = JSON.parse(localStorage.getItem('dllog_clients') || '[]');
    const existing = allClients.find(c => c.companyId === companyId && c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const id = `CLI-${String(allClients.length + 1).padStart(3, '0')}`;
    const newClient: Client = { id, companyId, name };
    localStorage.setItem('dllog_clients', JSON.stringify([...allClients, newClient]));
    return newClient;
  } catch (e) {
    console.error('Error saving client:', e);
    return { id: 'TEMP', companyId, name }; // Fallback for UI
  }
};

// Records Management
export const getStays = (companyId: string): StayRecord[] => {
  try {
    const allStays: StayRecord[] = JSON.parse(localStorage.getItem('dllog_stays') || '[]');
    return allStays.filter(stay => stay.companyId === companyId);
  } catch {
    return [];
  }
};

export const saveStay = (stay: Omit<StayRecord, 'id' | 'date'>): StayRecord => {
  try {
    const allStays: StayRecord[] = JSON.parse(localStorage.getItem('dllog_stays') || '[]');
    const id = `EST-${String(allStays.length + 1).padStart(3, '0')}`;
    const newStay: StayRecord = { ...stay, id, date: new Date().toISOString() };
    localStorage.setItem('dllog_stays', JSON.stringify([newStay, ...allStays]));
    return newStay;
  } catch {
    const id = `EST-001`;
    const newStay: StayRecord = { ...stay, id, date: new Date().toISOString() };
    localStorage.setItem('dllog_stays', JSON.stringify([newStay]));
    return newStay;
  }
};

export const getQuotes = (companyId: string): QuoteRecord[] => {
  try {
    const allQuotes: QuoteRecord[] = JSON.parse(localStorage.getItem('dllog_quotes') || '[]');
    return allQuotes.filter(quote => quote.companyId === companyId);
  } catch {
    return [];
  }
};

export const saveQuote = (quote: Omit<QuoteRecord, 'id' | 'date'>): QuoteRecord => {
  try {
    const allQuotes: QuoteRecord[] = JSON.parse(localStorage.getItem('dllog_quotes') || '[]');
    const id = `COT-${String(allQuotes.length + 1).padStart(3, '0')}`;
    const newQuote: QuoteRecord = { ...quote, id, date: new Date().toISOString() };
    localStorage.setItem('dllog_quotes', JSON.stringify([newQuote, ...allQuotes]));
    return newQuote;
  } catch {
    const id = `COT-001`;
    const newQuote: QuoteRecord = { ...quote, id, date: new Date().toISOString() };
    localStorage.setItem('dllog_quotes', JSON.stringify([newQuote]));
    return newQuote;
  }
};
