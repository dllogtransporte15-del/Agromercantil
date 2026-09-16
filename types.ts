// FIX: Moved Page type definition from App.tsx to here so it can be shared across modules.
// FIX: Added 'embarcadores' and 'operational-map' to the page list to resolve type errors.
export type Page = 'dashboard' | 'clients' | 'owners' | 'embarcadores' | 'drivers' | 'vehicles' | 'loads' | 'products' | 'shipments' | 'financial' | 'reports' | 'operational-loads' | 'operational-map' | 'users-register' | 'commissions' | 'appearance' | 'shipment-history' | 'load-history' | 'layover-calculator' | 'freight-quote' | 'ai-assistant' | 'tools-history' | 'branches' | 'system-monitor' | 'freight-offers-history' | 'risk-management' | 'risk-query-types';

export enum UserProfile {
  Embarcador = "Embarcador",
  Agenciador = "Agenciador",
  Supervisor = "Supervisor",
  Comercial = "Comercial",
  GerenteComercial = "Gerente Comercial",
  Diretor = "Diretor",
  Fiscal = "Fiscal",
  Financeiro = "Financeiro",
  Cliente = "Cliente",
  Admin = "Administrador do Sistema",
  Motorista = "Motorista",
  Demonstracao = "Demonstração",
  GerenciadoraDeRisco = "Gerenciadora de Risco",
}

export const INTERNAL_PROFILES: UserProfile[] = [
  UserProfile.Admin,
  UserProfile.Diretor,
  UserProfile.Supervisor,
  UserProfile.GerenteComercial,
  UserProfile.Comercial,
  UserProfile.Financeiro,
  UserProfile.Fiscal,
  UserProfile.GerenciadoraDeRisco,
  UserProfile.Embarcador,
  UserProfile.Agenciador,
  UserProfile.Demonstracao,
];


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
  phone?: string;
  password?: string;
  clientId?: string;
  requirePasswordChange?: boolean;
  isFirstSetup?: boolean;
  authId?: string;
  passwordUpdatedAt?: string;
  branchId?: string;
  hasCommercialCommission?: boolean;
  commercialFixedSalary?: number;
  commercialMatrizRate?: number;
  commercialFiliaisRate?: number;
  commercialSelectedBranchIds?: string[];
  commercialCalculationMode?: 'bruto' | 'liquido';
  commercialIsAgencyMode?: boolean;
  commercialAgencySharePercent?: number;
  availableForDriverRequests?: boolean;
  shipperCommissionRatePerTon?: number;
  agencyCommissionPercentage?: number;
  agencyRole?: 'lider' | 'embarque';
  agencyLeaderId?: string;
  customPermissions?: { [key in Page]?: CrudPermissions };
}

export enum PaymentMethod {
  Boleto = "Boleto",
  Pix = "PIX",
  Prazo = "Prazo",
}

export enum DriverPaymentMethod {
  PixEFrete = "PIX - E-FRETE",
  DepositoConta = "DEPOSITO EM CONTA",
  SmsCartaFrete = "SMS CARTA FRETE",
}

export interface ClientBranchCnpj {
  id: string;
  cnpj: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
  email?: string;
  paymentMethod?: PaymentMethod;
  paymentTerm?: number;
  requiresExternalOrder?: boolean;
  requiresScheduling?: boolean;
  salespersonName?: string;
  salespersonCommissionPerTon?: number;
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
  secondaryCnpjs?: ClientBranchCnpj[];
  salespersonName?: string;
  salespersonCommissionPerTon?: number;
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
  has_app?: boolean;
}

export interface DriverLocation {
  driverId: string;
  driverName: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
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
  Sider = "Sider",
  GradeBaixa = "Grade baixa",
  Tanque = "Tanque",
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
  /** Se true (padrão), o embarque exige fluxo completo de Gerenciamento de Risco (código + tipo de consulta).
   *  Se false, basta o envio do documento de liberação (Liberação Simplificada). */
  requiresRiskManagement?: boolean;
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

export enum FreightCalculationType {
  PerTon = "per_ton",                 // Por Tonelada (R$/ton)
  Fixed = "fixed",                   // Frete Fechado (Valor Fixo R$)
  PerTonPlusIcms = "per_ton_plus_icms" // VLR P/ton + ICMS
}

export interface FreightLeg {
  companyFreightValuePerTon: number;
  companyFreightHasToll?: boolean;
  driverFreightValuePerTon: number;
  driverFreightHasToll?: boolean;
  driverFreightValuePerTonPf?: number;
  driverFreightPfHasToll?: boolean;
  disablePfFreight?: boolean;
  hasIcms: boolean;
  icmsPercentage: number;
  freightCalculationType?: FreightCalculationType;
  icmsValue?: number;
  companyFreightTotalFixed?: number;
  driverFreightTotalFixedPj?: number;
  driverFreightTotalFixedPf?: number;
}

export enum DailyScheduleType {
  Livre = "Demanda Livre",
  Fixo = "Demanda Fixa",
  Verificar = "Demanda a Verificar",
}

export interface DailyScheduleEntry {
  date: string; // YYYY-MM-DD
  type: DailyScheduleType;
  tonnage?: number; // Previsto por dia (obrigatório para todos os tipos)
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
  companyFreightHasToll?: boolean;
  driverFreightValuePerTon: number;
  driverFreightHasToll?: boolean;
  driverFreightPfHasToll?: boolean;
  hasIcms: boolean;
  icmsPercentage: number;
  freightCalculationType?: FreightCalculationType;
  icmsValue?: number;
  companyFreightTotalFixed?: number;
  driverFreightTotalFixedPj?: number;
  driverFreightTotalFixedPf?: number;
  requiresScheduling: boolean;
  type: CargoType;
  status: CargoStatus;
  createdAt: string;
  createdById: string;
  history: HistoryLog[];
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
  schedulingSystemUrl?: string;
  schedulingUser?: string;
  schedulingPassword?: string;
  allowedProfiles?: UserProfile[];
  allowedUserIds?: string[];
  tmsLoteNumber?: string;
  clientCnpj?: string;
  clientBranchId?: string;
  isExport?: boolean;
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
  PreCadastro = "Ag. Cadastro",
  AguardandoSeguradora = "Ag. Seguradora",
  AguardandoCarregamento = "Ag. Carregamento",
  AguardandoNota = "Ag. Nota",
  AguardandoFiscal = "Ag. Fiscal",
  AguardandoAdiantamento = "Ag. Adiantamento",
  AguardandoAgendamento = "Ag. Agendamento",
  AguardandoDescarga = "Ag. Descarga",
  AguardandoPagamentoSaldo = "Ag. Saldo",
  Finalizado = "Finalizado",
  Cancelado = "Cancelado",
}

export enum RiskQueryType {
  Consulta = 'Consulta',
  Siga = 'SIGA',
  ConsultaBiometria = 'Consulta + Biometria',
  CadastroGeralBiometria = 'Cadastro Geral + Biometria',
  CadastroConsultaGeral = 'Cadastro + Consulta Geral',
  Vitimologia = 'Vitimologia',
  LiberacaoSimplificada = 'Liberação Simplificada',
}

export interface RiskQueryOption {
  id: string;
  name: string;
  cost: number;
  active: boolean;
  orderIndex?: number;
  description?: string;
  createdAt?: string;
}

export const DEFAULT_RISK_QUERY_OPTIONS: RiskQueryOption[] = [
  { id: 'consulta', name: 'Consulta', cost: 6.50, active: true, orderIndex: 1, description: 'Consulta padrão SIGA / Consulta' },
  { id: 'consulta_biometria', name: 'Consulta + Biometria', cost: 14.00, active: true, orderIndex: 2, description: 'Consulta com validação biométrica' },
  { id: 'cadastro_geral_biometria', name: 'Cadastro Geral + Biometria', cost: 32.50, active: true, orderIndex: 3, description: 'Cadastro completo e consulta geral com biometria' },
  { id: 'vitimologia', name: 'Vitimologia', cost: 70.00, active: true, orderIndex: 4, description: 'Análise aprofundada de vitimologia' },
  { id: 'liberacao_simplificada', name: 'Liberação Simplificada', cost: 0.00, active: true, orderIndex: 5, description: 'Liberação sem custo / simplificada' },
];

export const RISK_QUERY_COST_MAP: Record<string, number> = {
  [RiskQueryType.Consulta]: 6.50,
  [RiskQueryType.Siga]: 6.50,
  'siga': 6.50,
  'consulta': 6.50,
  [RiskQueryType.ConsultaBiometria]: 14.00,
  'CONSULTA + BIOMETRIA': 14.00,
  'consulta + biometria': 14.00,
  [RiskQueryType.CadastroGeralBiometria]: 32.50,
  [RiskQueryType.CadastroConsultaGeral]: 32.50,
  'CADASTRO GERAL + BIOMETRIA': 32.50,
  'CADASTRO GERAL + BIOMETRIA FACIAL': 32.50,
  'CADASTRO + CONSULTA GERAL': 32.50,
  'Cadastro Geral': 32.50,
  'CADASTRO GERAL': 32.50,
  [RiskQueryType.Vitimologia]: 70.00,
  'VITIMOLOGIA': 70.00,
  'vitimologia': 70.00,
  [RiskQueryType.LiberacaoSimplificada]: 0.00,
  'Liberacao Simplificada': 0.00,
  'LIBERAÇÃO SIMPLIFICADA': 0.00,
  'liberação simplificada': 0.00,
  'liberacao simplificada': 0.00,
};

export const REQUIRED_DOCUMENT_MAP: Partial<Record<ShipmentStatus, string>> = {
    [ShipmentStatus.PreCadastro]: 'Comprovante de Cadastro',
    [ShipmentStatus.AguardandoSeguradora]: 'Comprovação da Liberação da Seguradora',
    [ShipmentStatus.AguardandoCarregamento]: 'Ticket de Carregamento',
    [ShipmentStatus.AguardandoNota]: 'Nota Fiscal (NF-e)',
    [ShipmentStatus.AguardandoFiscal]: 'Documentos de Viagem (CT-e, MDF-e, Contrato)',
    [ShipmentStatus.AguardandoAdiantamento]: 'Comprovante de Adiantamento',
    [ShipmentStatus.AguardandoAgendamento]: 'Comprovante de Agendamento',
    [ShipmentStatus.AguardandoDescarga]: 'Comprovante de Descarga',
    [ShipmentStatus.AguardandoPagamentoSaldo]: 'Comprovante de Pagamento de Saldo',
};

export interface OperationalExpenseItem {
  name: string;
  value: number;
  type?: 'positive' | 'negative' | 'neutral'; // (+) or (-)
}

export interface RealProfitData {
  companyFreight: number;
  driverFreight: number;
  freightDifference: number;
  freightDifferenceMarginPercent: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
  expenseItems: OperationalExpenseItem[];
  complementCharged?: number;
  complementPaid?: number;
  driverSurcharge?: number;
  toll?: number;
  icmsDifference?: number;
  federalTax?: number;
  isFederalTaxManual?: boolean;
  inssPatronal?: number;
  insuranceDifference?: number;
  insuranceAcidente?: number; // 0,0125% do valor da NF
  insuranceRoubo?: number;    // 0,0125% do valor da NF
  insuranceRcv?: number;      // R$ 5,00 por carga
  invoiceValue?: number;      // Valor da NF averbada
  commission?: number;
  brokerFee?: number;
  otherCosts?: number;
  dailyRateDifference?: number;
  generatedCredit?: number;
  isGeneratedCreditManual?: boolean;
  processedAt?: string;
  attachmentUrl?: string;
  rawOcrText?: string;
  additionalCost?: number;
  additionalCostCategory?: string;
  additionalCostDescription?: string;
  agencyCommission?: number;
  agencyCommissionEnabled?: boolean;
  shipperCommission?: number;
  shipperCommissionRatePerTon?: number;
  shipperCommissionEnabled?: boolean;
}

export interface Shipment {
  id: string;
  orderId: string;
  cargoId: string;
  riskReleaseCode?: string;
  riskQueryType?: RiskQueryType | string;
  riskQueryCost?: number;
  driverName: string;
  driverContact?: string;
  driverCpf?: string;
  driverCnpj?: string;
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
  documents?: { [key: string]: any };
  history: HistoryLog[];
  createdAt: string;
  createdById: string;
  statusHistory: {
      status: ShipmentStatus;
      timestamp: string;
      userId: string;
  }[];
  anttOwnerIdentifier?: string;
  anttModality?: AnttModality | string;
  etcTaxRegime?: EtcTaxRegime | string;
  paymentMethod?: DriverPaymentMethod | string;
  pixKey?: string;
  advancePercentage?: number;
  advanceValue?: number;
  tollValue?: number;
  bankDetails?: string;
  vehicleTag?: string;
  companyFreightRateSnapshot?: number;
  driverFreightRateSnapshot?: number;
  freightCalculationType?: FreightCalculationType;
  icmsValue?: number;
  federalTax?: number;
  isFederalTaxManual?: boolean;
  generatedCredit?: number;
  isGeneratedCreditManual?: boolean;
  driverFreightType?: 'PJ' | 'PF';
  route?: string;
  isExport?: boolean;
  commercialCommission?: number;
  cancellationReason?: string;
  driverReferences?: string;
  ownerContact?: string;
  balanceToReceiveValue?: number;
  discountValue?: number;
  isBreakageWaived?: boolean;
  netBalanceValue?: number;
  loadedTonnage?: number;
  unloadedTonnage?: number;
  vehicleSetType?: VehicleSetType;
  vehicleBodyType?: VehicleBodyType;
  branchId?: string;
  cteNumber?: string;   // Número do CT-e extraído automaticamente do XML/PDF
  cteEmissionDate?: string; // Data e Hora da Emissão do CT-e (ex: 13/08/2026 11:40)
  nfeNumber?: string;   // Número da Nota Fiscal (NF-e) extraído automaticamente
  nfeValue?: number;    // Valor da Nota Fiscal / Mercadoria averbada
  mdfeNumber?: string;  // Número do MDF-e extraído automaticamente
  realProfitData?: RealProfitData; // Resumo e detalhamento de despesas extraídos via OCR/IA
  additionalCost?: {
    value: number;
    category: string;
    description: string;
    createdAt?: string;
    createdBy?: string;
  };
  additionalCostValue?: number;
  additionalCostCategory?: string;
  additionalCostDescription?: string;
  agencyCommissionEnabled?: boolean;
  agencyCommissionPercentage?: number;
  agencyCommissionValue?: number;
  agencyCommissionAgencyName?: string;
  shipperCommissionEnabled?: boolean;
  shipperCommissionRatePerTon?: number;
  shipperCommissionValue?: number;
}



export type ProfilePermissions = {
  [profile in UserProfile]?: {
    [page in Page]?: CrudPermissions;
  };
} & {
  system_settings?: {
    driver_portal_enabled?: boolean;
    pwa_enabled?: boolean;
  };
};

export interface CrudPermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface Embarcador {
  id: string;
  name: string;
  shipperCommissionRatePerTon?: number;
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
  cargoId?: string;
  shipmentId?: string;
}

export interface ShipmentLock {
  id: string;
  shipmentId: string;
  userId: string;
  userName: string;
  createdAt: string;
  expiresAt: string;
}

export enum FreightOfferStatus {
  AguardandoPreco = "Aguardando Preço",
  AnaliseCliente = "Em Análise",
  Pendente = "Pendente", // Mantido para retrocompatibilidade
  Aceita = "Aceita",
  Recusada = "Recusada",
  Contraproposta = "Contraproposta",
  ContrapropostaAceita = "Contraproposta Aceita", // Mantido para retrocompatibilidade
  AguardandoFechamento = "Aguardando Fechamento",
  SolicitadoExclusao = "Exclusão Solicitada"
}

export interface FreightOffer {
  id: string;
  displayId?: string;
  clientId: string;
  origin: string;
  originLocation?: string;
  destination: string;
  destinationLocation?: string;
  totalTonnage: number;
  dailySchedule?: string;
  freightValuePerTon?: number;
  productId: string;
  driverId?: string;
  cargoId?: string;
  status: FreightOfferStatus;
  previousStatus?: FreightOfferStatus;
  counterOfferValue?: number;
  createdAt: string;
  history?: HistoryLog[];
  observations?: string;
  additionalDestinations?: { city: string; location?: string }[];
  attachments?: string[];
  requestedEmbarcadorId?: string;
  requestTimestamp?: string;
  freightType?: 'CIF' | 'FOB';
  hasIcms?: boolean;
  icmsPercentage?: number;
  clientCnpj?: string;
  clientBranchId?: string;
  isExport?: boolean;
}

export enum AnttModality {
  TAC = 'TAC',
  ETC = 'ETC',
  CTC = 'CTC',
}

export enum EtcTaxRegime {
  MEI = 'MEI',
  SimplesNacional = 'Simples Nacional',
  LucroPresumido = 'Lucro Presumido',
  LucroReal = 'Lucro Real',
}
