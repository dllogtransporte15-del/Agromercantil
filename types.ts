
// FIX: Moved Page type definition from App.tsx to here so it can be shared across modules.
// FIX: Added 'embarcadores' and 'operational-map' to the page list to resolve type errors.
export type Page = 'dashboard' | 'clients' | 'owners' | 'embarcadores' | 'drivers' | 'vehicles' | 'loads' | 'products' | 'shipments' | 'financial' | 'reports' | 'operational-loads' | 'operational-map' | 'users-register' | 'commissions' | 'appearance' | 'shipment-history' | 'load-history' | 'layover-calculator' | 'freight-quote' | 'ai-assistant' | 'tools-history' | 'branches' | 'system-monitor';

export enum UserProfile {
  Embarcador = "Embarcador",
  Coordenador = "Coordenador",
  Comercial = "Comercial",
  Diretor = "Diretor",
  Fiscal = "Fiscal",
  Financeiro = "Financeiro",
  Cliente = "Cliente",
  Admin = "Administrador do Sistema",
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  state: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  profile: UserProfile;
  active: boolean;
  password?: string;
  clientId?: string;
  requirePasswordChange?: boolean;
  authId?: string;
  passwordUpdatedAt?: string;
  branchId?: string;
  phone?: string;
}

export enum PaymentMethod {
  Boleto = "Boleto",
  Pix = "PIX",
  Prazo = "Prazo",
}

export interface Client {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  paymentMethod: PaymentMethod;
  paymentTerm: number; // e.g., 15, 30, 45 days
  requiresExternalOrder: boolean;
  requiresScheduling: boolean;
}

export enum OwnerType {
  PessoaFisica = "Pessoa Física",
  PessoaJuridica = "Pessoa Jurídica",
}

export interface Owner {
  id: string;
  name: string;
  cpfCnpj: string;
  phone: string;
  type: OwnerType;
  bankDetails: string;
}

export enum DriverClassification {
  Frota = "Frota",
  Agregado = "Agregado",
  Terceiro = "Terceiro",
  Proprio = "Próprio",
}

export interface Driver {
  id: string;
  name: string;
  cpf: string;
  cnh: string;
  phone: string;
  classification: DriverClassification;
  ownerId?: string;
  active: boolean;
  restrictionReason?: string;
}

export enum VehicleSetType {
  LSSimples = "LS Simples",
  LSTrucada = "LS Trucada",
  Vanderleia = "Vanderleia",
  Bitrem7e = "Bitrem 7e",
  Bitrem8e = "Bitrem 8e",
  Cavalo4e = "Cavalo 4e",
  Carreta4e = "Carreta 4e",
  Rodotrem3x3 = "Rodotrem (3x3)",
  Rodotrem = "Rodotrem",
  Truck = "Caminhão Truck",
  Bitruck = "Bitruck",
}

export enum VehicleBodyType {
  Basculante = "Basculante",
  Graneleiro = "Graneleiro",
}

export interface Vehicle {
  id: string;
  plate: string;
  setType: VehicleSetType;
  bodyType: VehicleBodyType;
  classification: DriverClassification;
  driverId?: string;
  ownerId: string;
}

export enum ProductUnit {
  Tonelada = "ton",
  MetroCubico = "m³",
  Sacas = "sc",
}

export interface Product {
  id: string;
  name: string;
  unit: ProductUnit;
}

export enum CargoType {
  Fixa = "Fixa",
  Spot = "Spot",
}

export enum CargoStatus {
  EmAndamento = "Em andamento",
  Suspensa = "Suspensa",
  Fechada = "Fechada",
}

export interface HistoryLog {
    id: string;
    userId: string;
    timestamp: string;
    description: string;
}

export interface FreightLeg {
  companyFreightValuePerTon: number;
  driverFreightValuePerTonPJ?: number;
  driverFreightValuePerTonPF?: number;
  driverFreightValuePerTon: number;
  hasIcms: boolean;
  icmsPercentage: number;
  disableDriverFreightPF?: boolean;
}

export interface CargoDestination {
  id: string;
  city: string;
  location?: string;
  mapLink?: string;
  targetTonnage?: number;
  freightLegs: FreightLeg[];
  tmsBatchNumber?: string;
}

export enum DailyScheduleType {
  Livre = "Demanda Livre",
  Fixo = "Demanda Fixa",
  Verificar = "Demanda a Verificar",
}

export interface DailyScheduleEntry {
  date: string; // YYYY-MM-DD
  type: DailyScheduleType;
  tonnage?: number; // Only for 'Fixo'
}

export interface Cargo {
  id: string;
  sequenceId: number;
  clientId: string;
  productId: string;
  origin: string;
  originLocation?: string;
  originMapLink?: string;
  destination: string;
  destinationLocation?: string;
  destinationMapLink?: string;
  totalVolume: number; 
  scheduledVolume: number; 
  loadedVolume: number; 
  companyFreightValuePerTon: number;
  driverFreightValuePerTonPJ?: number;
  driverFreightValuePerTonPF?: number;
  driverFreightValuePerTon: number;
  hasIcms: boolean;
  icmsPercentage: number;
  requiresScheduling: boolean;
  type: CargoType;
  status: CargoStatus;
  createdAt: string;
  createdById: string;
  history: HistoryLog[];
  loadingStartDate?: string;
  loadingDeadline?: string;
  allowedVehicleTypes?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[];
  freightLegs?: FreightLeg[];
  dailySchedule?: DailyScheduleEntry[];
  observations?: string;
  attachments?: string[];
  salespersonName?: string;
  salespersonCommissionPerTon?: number;
  // Location simulation for map
  originCoords?: { lat: number; lng: number };
  destinationCoords?: { lat: number; lng: number };
  branchId?: string;
  requiresTracker?: boolean;
  destinations?: CargoDestination[];
  externalOrder?: {
    required: boolean;
    link?: string;
    user?: string;
    password?: string;
  };
  tmsBatchNumber?: string;
  disableDriverFreightPF?: boolean;
}


export enum OrderStatus {
  Solicitada = "Solicitada",
  Aprovada = "Aprovada",
  Rejeitada = "Rejeitada",
}

export interface LoadingOrder {
  id: string;
  cargoId: string;
  driverId: string;
  vehicleId: string;
  ownerId: string;
  requestDate: Date;
  status: OrderStatus;
}

export enum ShipmentStatus {
  PreCadastro = "Pré-cadastro",
  AguardandoSeguradora = "Ag. Seguradora",
  AguardandoCarregamento = "Ag. Carregamento",
  AguardandoNota = "Ag. Nota",
  AguardandoAdiantamento = "Ag. Adiantamento",
  AguardandoAgendamento = "Ag. Agendamento",
  AguardandoDescarga = "Ag. Descarga",
  AguardandoPagamentoSaldo = "Ag. Saldo",
  Finalizado = "Finalizado",
  Cancelado = "Cancelado",
}

export const REQUIRED_DOCUMENT_MAP: Partial<Record<ShipmentStatus, string>> = {
    [ShipmentStatus.PreCadastro]: 'Comprovante de Cadastro',
    [ShipmentStatus.AguardandoSeguradora]: 'Comprovação da Liberação da Seguradora',
    [ShipmentStatus.AguardandoCarregamento]: 'Ticket de Carregamento',
    [ShipmentStatus.AguardandoNota]: 'Documentação Fiscal',
    [ShipmentStatus.AguardandoAdiantamento]: 'Comprovante de Adiantamento',
    [ShipmentStatus.AguardandoAgendamento]: 'Comprovante de Agendamento',
    [ShipmentStatus.AguardandoDescarga]: 'Comprovante de Descarga',
    [ShipmentStatus.AguardandoPagamentoSaldo]: 'Comprovante de Pagamento de Saldo',
};

export interface Shipment {
  id: string;
  orderId: string;
  cargoId: string;
  driverName: string;
  driverContact?: string;
  driverCpf?: string;
  embarcadorId: string;
  horsePlate: string;
  trailer1Plate?: string;
  trailer2Plate?: string;
  trailer3Plate?: string;
  shipmentTonnage: number;
  driverFreightValue: number;
  status: ShipmentStatus;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:MM
  arrivalTime?: string; // ISO String
  documents?: { [key: string]: string[] };
  history: HistoryLog[];
  createdAt: string;
  createdById: string;
  statusHistory: {
      status: ShipmentStatus;
      timestamp: string;
      userId: string;
  }[];
  anttOwnerIdentifier?: string;
  advancePercentage?: number;
  advanceValue?: number;
  tollValue?: number;
  bankDetails?: string;
  vehicleTag?: string;
  companyFreightRateSnapshot?: number;
  driverFreightRateSnapshot?: number;
  route?: string;
  cancellationReason?: string;
  driverReferences?: string;
  ownerContact?: string;
  balanceToReceiveValue?: number;
  discountValue?: number;
  netBalanceValue?: number;
  unloadedTonnage?: number;
  vehicleSetType?: VehicleSetType;
  vehicleBodyType?: VehicleBodyType;
  branchId?: string;
}



export interface ProfilePermissions {
  [profile: string]: {
    [page in Page]?: CrudPermissions;
  };
}

export interface CrudPermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface Embarcador {
  id: string;
  name: string;
}

// Ticket System Types
export enum TicketStatus {
  Aberto = "Aberto",
  EmAndamento = "Em Andamento",
  Resolvido = "Resolvido",
  Fechado = "Fechado",
}

export enum TicketPriority {
  Baixa = "Baixa",
  Media = "Média",
  Alta = "Alta",
  Urgente = "Urgente",
}

export interface TicketHistory {
  userId: string;
  timestamp: string;
  comment: string;
  oldStatus?: TicketStatus;
  newStatus?: TicketStatus;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdById: string;
  assignedToId: string;
  createdAt: string;
  history: TicketHistory[];
}

export interface ShipmentLock {
  id: string;
  shipmentId: string;
  userId: string;
  userName: string;
  createdAt: string;
  expiresAt: string;
}
