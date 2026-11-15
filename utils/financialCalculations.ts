import type { Shipment, Cargo, FinancialTransaction, Client, User } from '../types';
import { ShipmentStatus, UserProfile } from '../types';
import type { StayRecord } from './toolStorage';
import { isStayForShipment } from '../utils';

export interface FirstLevelFinancialResult {
  totalGrossRevenue: number;     // Faturamento Bruto (Frete Empresa)
  totalTaxes: number;            // Impostos (ICMS + Tributos)
  netRevenue: number;            // Receita Líquida
  totalDriverCosts: number;      // Custos Diretos com Motoristas
  totalTollCosts: number;        // Custos com Pedágio
  contributionMargin: number;    // 1º Resultado: Margem de Contribuição
  contributionMarginPercent: number; // % Margem de Contribuição
  totalTonnage: number;          // Toneladas Embarcadas
  shipmentCount: number;         // Total de Embarques Concluídos/Ativos
}

export interface SecondLevelFinancialResult extends FirstLevelFinancialResult {
  personnelExpenses: number;     // Despesas com Pessoal
  operationalExpenses: number;   // Despesas Operacionais Gerais
  administrativeExpenses: number;// Despesas Administrativas
  totalOperatingExpenses: number;// Total Despesas Fixas / Gerais
  operatingResult: number;       // 2º Resultado: Resultado Operacional
  operatingMarginPercent: number;// % Margem Operacional
}

export interface ThirdLevelFinancialResult extends SecondLevelFinancialResult {
  financialExpenses: number;     // Tarifas bancárias, juros
  financialIncomes: number;      // Rendimentos / Outras receitas
  ebitda: number;                // EBITDA
  netResult: number;             // 3º Resultado: Resultado Líquido Final
  netMarginPercent: number;      // % Margem Líquida
  projectedReceivables30d: number;
  projectedPayables30d: number;
  projectedCashFlow30d: number;
}

export interface ShipmentControlItem {
  shipmentId: string;
  orderId?: string;
  cteNumber?: string;
  scheduledDate: string;
  origin: string;
  destination: string;
  clientName: string;
  driverName: string;
  horsePlate: string;
  tonnage: number;
  companyFreightTotal: number;
  driverFreightTotal: number;
  tollValue: number;
  advanceValue: number;
  balanceValue: number;
  grossMargin: number;
  grossMarginPercent: number;
  status: ShipmentStatus;
}

/**
 * Calcula o 1º Resultado Financeiro a partir dos embarques reais do sistema
 */
export function calculateFirstResult(shipments: Shipment[], cargos: Cargo[], stays?: StayRecord[]): FirstLevelFinancialResult {
  const cargoMap = new Map(cargos.map(c => [c.id, c]));

  const validShipments = shipments.filter(s => 
    s.status !== ShipmentStatus.Cancelado
  );

  let totalGrossRevenue = 0;
  let totalTaxes = 0;
  let totalDriverCosts = 0;
  let totalTollCosts = 0;
  let totalTonnage = 0;

  for (const s of validShipments) {
    const cargo = cargoMap.get(s.cargoId);
    const ton = s.shipmentTonnage || 0;
    totalTonnage += ton;

    // Frete Empresa
    const companyRate = s.companyFreightRateSnapshot ?? cargo?.companyFreightValuePerTon ?? 0;
    const companyTotal = companyRate > 0 ? (companyRate * ton) : (s.driverFreightValue * 1.15); // Fallback saudável

    // Estadias / CT-e Complementar vinculados
    const sStays = stays ? stays.filter(st => isStayForShipment(st, s)) : [];
    const demurrageRevenue = sStays.reduce((sum: number, st: any) => sum + (Number(st.approvedValue ?? st.approved_value) || 0), 0);
    const demurrageDriverPaid = sStays.reduce((sum: number, st: any) => sum + (Number(st.driverPaidValue ?? st.driver_paid_value) || 0), 0);

    totalGrossRevenue += companyTotal + demurrageRevenue;

    // Impostos
    const icms = s.icmsValue ?? (cargo?.icmsPercentage ? (companyTotal * cargo.icmsPercentage / 100) : 0);
    totalTaxes += icms;

    // Frete Motorista + Acréscimos Avulsos (Diárias, Estadia, Bônus)
    const rawExtra = Array.isArray(s.driverExtraPayments) ? s.driverExtraPayments : [];
    let stayExtra = 0;
    let otherExtra = 0;
    if (rawExtra.length > 0) {
      for (const p of rawExtra) {
        const amt = Number(p.amount) || 0;
        if (/di[aá]ria|estadia/i.test(p.reason || '')) {
          stayExtra += amt;
        } else {
          otherExtra += amt;
        }
      }
    } else {
      const tot = Number(s.driverExtraPaymentsTotal || 0) || Number(s.realProfitData?.driverSurcharge || 0) || 0;
      if (demurrageDriverPaid > 0 && Math.abs(tot - demurrageDriverPaid) < 1.0) {
        stayExtra = tot;
      } else {
        otherExtra = tot;
      }
    }

    const stayAlreadyCounted = demurrageDriverPaid > 0
      ? Math.min(demurrageDriverPaid, stayExtra)
      : (demurrageRevenue > 0 ? Math.min(demurrageRevenue, stayExtra) : 0);
    const effectiveStayExtra = Math.max(0, stayExtra - stayAlreadyCounted);
    const effectiveDriverExtra = otherExtra + effectiveStayExtra;

    totalDriverCosts += (s.driverFreightValue || 0) + demurrageDriverPaid + effectiveDriverExtra;

    // Pedágio com limite de sanidade
    const rawToll = Number(s.tollValue);
    const safeToll = (!isNaN(rawToll) && rawToll >= 0 && rawToll <= 25000) ? rawToll : 0;
    totalTollCosts += safeToll;
  }

  const netRevenue = Math.max(0, totalGrossRevenue - totalTaxes);
  const contributionMargin = netRevenue - (totalDriverCosts + totalTollCosts);
  const contributionMarginPercent = totalGrossRevenue > 0 ? (contributionMargin / totalGrossRevenue) * 100 : 0;

  return {
    totalGrossRevenue,
    totalTaxes,
    netRevenue,
    totalDriverCosts,
    totalTollCosts,
    contributionMargin,
    contributionMarginPercent,
    totalTonnage,
    shipmentCount: validShipments.length,
  };
}

/**
 * Calcula o 2º Resultado Financeiro cruzando com despesas do Contas a Pagar
 */
export function calculateSecondResult(
  firstResult: FirstLevelFinancialResult, 
  transactions: FinancialTransaction[]
): SecondLevelFinancialResult {
  let personnelExpenses = 0;
  let operationalExpenses = 0;
  let administrativeExpenses = 0;

  for (const t of transactions) {
    if (t.type !== 'payable' || t.status === 'Cancelado') continue;
    const desc = (t.category + ' ' + t.description).toLowerCase();

    if (desc.includes('pessoal') || desc.includes('salário') || desc.includes('folha') || desc.includes('inss') || desc.includes('fgts')) {
      personnelExpenses += t.amount;
    } else if (desc.includes('combustível') || desc.includes('manutenção') || desc.includes('gr') || desc.includes('seguro') || desc.includes('diária')) {
      operationalExpenses += t.amount;
    } else {
      administrativeExpenses += t.amount;
    }
  }

  // Se não houver transações cadastradas, estipula estimativa proporcional gerencial padrão para demonstração inicial
  if (personnelExpenses === 0 && operationalExpenses === 0 && administrativeExpenses === 0 && firstResult.totalGrossRevenue > 0) {
    personnelExpenses = firstResult.totalGrossRevenue * 0.04;
    operationalExpenses = firstResult.totalGrossRevenue * 0.03;
    administrativeExpenses = firstResult.totalGrossRevenue * 0.02;
  }

  const totalOperatingExpenses = personnelExpenses + operationalExpenses + administrativeExpenses;
  const operatingResult = firstResult.contributionMargin - totalOperatingExpenses;
  const operatingMarginPercent = firstResult.totalGrossRevenue > 0 ? (operatingResult / firstResult.totalGrossRevenue) * 100 : 0;

  return {
    ...firstResult,
    personnelExpenses,
    operationalExpenses,
    administrativeExpenses,
    totalOperatingExpenses,
    operatingResult,
    operatingMarginPercent,
  };
}

/**
 * Calcula o 3º Resultado Financeiro e projeções de fluxo
 */
export function calculateThirdResult(
  secondResult: SecondLevelFinancialResult,
  transactions: FinancialTransaction[]
): ThirdLevelFinancialResult {
  let financialExpenses = 0;
  let financialIncomes = 0;
  let projectedReceivables30d = 0;
  let projectedPayables30d = 0;

  const now = new Date();
  const next30d = new Date();
  next30d.setDate(now.getDate() + 30);

  for (const t of transactions) {
    if (t.status === 'Cancelado') continue;

    if (t.type === 'payable') {
      const desc = (t.category + ' ' + t.description).toLowerCase();
      if (desc.includes('tarifa') || desc.includes('banco') || desc.includes('juros') || desc.includes('iof')) {
        financialExpenses += t.amount;
      }
      if (t.status === 'Pendente' || t.status === 'Atrasado') {
        const due = new Date(t.dueDate);
        if (due <= next30d) {
          projectedPayables30d += t.amount;
        }
      }
    } else if (t.type === 'receivable') {
      financialIncomes += t.amount;
      if (t.status === 'Pendente') {
        const due = new Date(t.dueDate);
        if (due <= next30d) {
          projectedReceivables30d += t.amount;
        }
      }
    }
  }

  if (financialExpenses === 0 && secondResult.totalGrossRevenue > 0) {
    financialExpenses = secondResult.totalGrossRevenue * 0.008; // 0.8%
  }

  const ebitda = secondResult.operatingResult;
  const netResult = secondResult.operatingResult - financialExpenses + financialIncomes;
  const netMarginPercent = secondResult.totalGrossRevenue > 0 ? (netResult / secondResult.totalGrossRevenue) * 100 : 0;
  const projectedCashFlow30d = projectedReceivables30d - projectedPayables30d;

  return {
    ...secondResult,
    financialExpenses,
    financialIncomes,
    ebitda,
    netResult,
    netMarginPercent,
    projectedReceivables30d,
    projectedPayables30d,
    projectedCashFlow30d,
  };
}

/**
 * Converte a lista de embarques na Planilha da Controladoria
 */
export function buildShipmentControlSheet(
  shipments: Shipment[], 
  cargos: Cargo[],
  clientsInput?: Map<string, string> | Client[]
): ShipmentControlItem[] {
  const cargoMap = new Map(cargos.map(c => [c.id, c]));
  const clientsMap: Map<string, string> = 
    clientsInput instanceof Map 
      ? clientsInput 
      : new Map(
          (clientsInput || []).map(c => [c.id, c.razaoSocial || c.nomeFantasia || c.id])
        );

  return shipments
    .filter(s => s.status !== ShipmentStatus.Cancelado)
    .map(s => {
      const cargo = cargoMap.get(s.cargoId);
      const ton = s.shipmentTonnage || 0;
      const companyRate = s.companyFreightRateSnapshot ?? cargo?.companyFreightValuePerTon ?? 0;
      const companyFreightTotal = companyRate > 0 ? (companyRate * ton) : (s.driverFreightValue * 1.15);
      const driverFreightTotal = s.driverFreightValue || 0;
      const rawToll = Number(s.tollValue);
      const tollValue = (!isNaN(rawToll) && rawToll >= 0 && rawToll <= 25000) ? rawToll : 0;
      const advanceValue = s.advanceValue || 0;
      const balanceValue = s.balanceToReceiveValue || Math.max(0, driverFreightTotal - advanceValue);
      const grossMargin = companyFreightTotal - driverFreightTotal - tollValue;
      const grossMarginPercent = companyFreightTotal > 0 ? (grossMargin / companyFreightTotal) * 100 : 0;

      const clientName = cargo?.clientId ? (clientsMap.get(cargo.clientId) || cargo.clientId) : 'Cliente Geral';

      return {
        shipmentId: s.id,
        orderId: s.orderId,
        cteNumber: s.cteNumber || (s.documents as any)?.cte_number || undefined,
        scheduledDate: s.scheduledDate,
        origin: cargo?.origin || 'Origem',
        destination: cargo?.destination || 'Destino',
        clientName,
        driverName: s.driverName || 'Motorista',
        horsePlate: s.horsePlate || '-',
        tonnage: ton,
        companyFreightTotal,
        driverFreightTotal,
        tollValue,
        advanceValue,
        balanceValue,
        grossMargin,
        grossMarginPercent,
        status: s.status,
      };
    })
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
}

/**
 * Converte com robustez strings monetárias no padrão brasileiro (ex: "6.000,00", "6.000", "R$ 6.000", "6000,50")
 * em números válidos sem truncar milhares para números inteiros minúsculos.
 */
export function parseBrazilianCurrency(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  let str = String(value).trim();
  if (!str) return 0;

  // Remove caracteres que não são números, ponto, vírgula ou hífen
  str = str.replace(/[^\d.,-]/g, '');
  if (!str) return 0;

  // Caso 1: Possui ponto e vírgula (ex: 6.000,00 ou 1.250.340,50)
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Padrão Brasil: 6.000,00 -> 6000.00
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Padrão EUA: 6,000.00 -> 6000.00
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Apenas vírgula decimal: 6000,50 -> 6000.50
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Apenas ponto(s)
    const parts = str.split('.');
    if (parts.length > 2) {
      // Vários pontos (ex: 1.000.000 -> 1000000)
      str = str.replace(/\./g, '');
    } else if (parts.length === 2) {
      // Um único ponto: se houver exatamente 3 dígitos após o ponto (ex: "6.000", "25.000"),
      // na digitação de valores no Brasil isso indica milhar! Evita que "6.000" vire 6.
      if (parts[1].length === 3) {
        str = parts[0] + parts[1];
      } else {
        str = parts[0] + '.' + parts[1];
      }
    }
  }

  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}

export function formatBrl(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

import { isDeveloperUser } from '../auth';

/**
 * Perfis autorizados a visualizar o campo e indicadores de "Comissão Prevista"
 * (Administrador do Sistema, Desenvolvedor, Comercial/Gerente Comercial e Diretor).
 * Os demais usuários (ex: Agenciadores, Embarcadores, etc.) visualizam estritamente
 * a comissão efetivada após o veículo estar descarregado (Ag. Saldo em diante).
 */
export function canViewPredictedCommission(user?: User | null): boolean {
  if (!user) return false;
  if (isDeveloperUser(user)) return true;
  const p = user.profile;
  return p === UserProfile.Admin || 
         p === UserProfile.Desenvolvedor || 
         p === UserProfile.Comercial || 
         p === UserProfile.GerenteComercial || 
         p === UserProfile.Diretor ||
         (typeof p === 'string' && (
           p.toLowerCase().includes('admin') || 
           p.toLowerCase().includes('desenvolvedor') || 
           p.toLowerCase().includes('developer') || 
           p.toLowerCase().includes('comercial') || 
           p.toLowerCase().includes('diretor')
         ));
}

/**
 * Status que comprovam que o veículo já descarregou e o frete está apto
 * para apuração e contabilização de comissão efetiva na Folha e no Financeiro:
 * Exclusivamente a partir do status "Aguardando Pagamento de Saldo" (após validação de ticket e descarga comprovada)
 * ou "Finalizado" (inclusive quando o frete foi 100% no adiantamento).
 */
export const COMMISSION_ELIGIBLE_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.AguardandoPagamentoSaldo, // "Ag. Saldo"
  ShipmentStatus.Finalizado                // "Finalizado"
];

/**
 * Status de trânsito após carregamento efetivado (veículo carregou e está em trânsito antes de descarregar e conferir saldo)
 */
export const END_OF_MONTH_TRANSIT_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.AguardandoFiscal,       // "Ag. Fiscal"
  ShipmentStatus.AguardandoAdiantamento, // "Ag. Adiantamento"
  ShipmentStatus.AguardandoAgendamento,   // "Ag. Agend. ou Troca/nfe"
  ShipmentStatus.AguardandoDescarga,     // "Ag. Descarga"
  ShipmentStatus.ValidacaoTicket         // "Valid. de Ticket" (etapa de conferência de balança antes da liberação do saldo)
];

/**
 * Extrai a data no formato YYYY-MM-DD com tolerância a formatos brasileiros e ISO
 */
function extractYmd(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-' || trimmed === '0') return null;
    const dmy = trimmed.match(/(?:^|\b)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    const ymd = trimmed.match(/(?:^|\b)(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * Retorna a data efetiva de carregamento/emissão do embarque no formato YYYY-MM-DD
 */
export function getShipmentEffectiveYmd(shipment?: any): string | null {
  if (!shipment) return null;

  // 1. Data do CT-e
  const cteDoc = shipment.documents?.cte || shipment.documents?.cteDocument;
  const cteEmission = shipment.cteEmissionDate || cteDoc?.emissionDate || cteDoc?.issueDate || shipment.documents?.cteEmissionDate;
  const cteYmd = extractYmd(cteEmission);
  if (cteYmd) return cteYmd;

  // 2. Aguardando Nota status history timestamp (efetivação do carregamento)
  const effectiveEntry = Array.isArray(shipment.statusHistory) 
    ? shipment.statusHistory.find((h: any) => 
        h.status === 'AguardandoNota' || 
        h.status === 'Ag. Nota' || 
        h.status === 'Aguardando Nota'
      )
    : null;
  if (effectiveEntry?.timestamp) {
    const histYmd = extractYmd(effectiveEntry.timestamp);
    if (histYmd) return histYmd;
  }

  // 3. scheduledDate
  if (shipment.scheduledDate) {
    const schedYmd = extractYmd(shipment.scheduledDate);
    if (schedYmd) return schedYmd;
  }

  // 4. createdAt
  if (shipment.createdAt) {
    const createdYmd = extractYmd(shipment.createdAt);
    if (createdYmd) return createdYmd;
  }

  return null;
}

/**
 * Verifica se a data efetiva de carregamento do embarque ocorreu no final do mês (dia >= 20).
 */
export function isShipmentLoadedAtEndOfMonth(shipmentOrDate: any): boolean {
  if (!shipmentOrDate) return false;
  let ymd: string | null = null;
  if (typeof shipmentOrDate === 'string') {
    ymd = extractYmd(shipmentOrDate);
  } else {
    ymd = getShipmentEffectiveYmd(shipmentOrDate);
  }
  if (!ymd) return false;
  const parts = ymd.split('-');
  if (parts.length < 3) return false;
  const day = parseInt(parts[2], 10);
  return !isNaN(day) && day >= 20;
}

export const DISCHARGE_STATUS_SET = new Set<string>([
  ShipmentStatus.AguardandoPagamentoSaldo,
  ShipmentStatus.Finalizado,
  'Ag. Saldo',
  'AguardandoPagamentoSaldo',
  'Finalizado'
]);

export const TRANSIT_STATUS_SET = new Set<string>([
  ShipmentStatus.AguardandoFiscal,
  ShipmentStatus.AguardandoAdiantamento,
  ShipmentStatus.AguardandoAgendamento,
  ShipmentStatus.AguardandoDescarga,
  ShipmentStatus.ValidacaoTicket,
  'Ag. Fiscal',
  'AguardandoFiscal',
  'Ag. Adiantamento',
  'AguardandoAdiantamento',
  'Ag. Agend. ou Troca/nfe',
  'AguardandoAgendamento',
  'Ag. Descarga',
  'AguardandoDescarga',
  'Valid. de Ticket',
  'ValidacaoTicket',
  'Validação de Ticket',
  'Validação de Ticket e Peso'
]);

/**
 * Retorna true se o embarque é previsto para apuração de comissão (em trânsito antes de descarregar e conferir saldo).
 * Exibido no campo "Comissão Prevista" para Administradores, Desenvolvedor, Comercial e Diretores.
 */
export function isShipmentPredictedForCommission(
  shipmentOrStatus: any,
  targetMonthKey?: string
): boolean {
  if (!shipmentOrStatus) return false;
  if (typeof shipmentOrStatus === 'object') {
    const s = shipmentOrStatus;
    const status = s.status;
    if (!status || status === ShipmentStatus.Cancelado || String(status) === 'Cancelado') return false;
    const statusStr = String(status);

    if (DISCHARGE_STATUS_SET.has(statusStr)) return false;

    if (TRANSIT_STATUS_SET.has(statusStr)) {
      if (targetMonthKey) {
        const effYmd = getShipmentEffectiveYmd(s);
        if (effYmd && !effYmd.startsWith(targetMonthKey)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }
  const statusStr = String(shipmentOrStatus);
  return TRANSIT_STATUS_SET.has(statusStr);
}

/**
 * Retorna true se o embarque se enquadra na Exceção de Virada de Mês:
 * Embarque efetivado no final do mês (dia >= 20) com CT-e emitido ou em trânsito
 * (Ag. Fiscal, Ag. Adiantamento, Ag. Agendamento, Ag. Descarga),
 * permitindo que sua comissão seja somada no mês em que foi efetivado o carregamento.
 */
export function isShipmentEligibleByEndOfMonthException(shipment: any): boolean {
  if (!shipment) return false;
  const status = typeof shipment === 'string' ? shipment : shipment.status;
  if (!status) return false;
  const statusStr = String(status);

  // Se já está nos status padrão pós-descarga, é elegível diretamente pela regra geral
  if (DISCHARGE_STATUS_SET.has(statusStr)) {
    return false;
  }

  // Verifica se o status é de trânsito pós-carregamento
  if (!TRANSIT_STATUS_SET.has(statusStr)) return false;

  // Se for o objeto do embarque, valida que o carregamento ocorreu a partir do dia 20
  if (typeof shipment === 'object') {
    return isShipmentLoadedAtEndOfMonth(shipment);
  }

  return true;
}

/**
 * Retorna true se o embarque está apto para ter sua comissão somada na folha / financeiro / relatórios.
 * 
 * Regra Geral: Veículo descarregou e comprovante foi anexado (a partir do status "Valid. de Ticket").
 * 
 * Exceção de Virada de Mês: Embarques efetivados no final do mês (dia >= 20) que descarregam após a virada do mês.
 * A comissão é somada no mês da competência em que foi efetivado o carregamento.
 */
export const isShipmentEligibleForCommission = (
  shipmentOrStatus: Shipment | ShipmentStatus | string | undefined | null,
  targetMonthKey?: string
): boolean => {
  if (!shipmentOrStatus) return false;

  // Se passado objeto Shipment
  if (typeof shipmentOrStatus === 'object') {
    const s = shipmentOrStatus;
    const status = s.status;
    if (!status) return false;
    const statusStr = String(status);
    if (status === ShipmentStatus.Cancelado || statusStr === 'Cancelado') return false;

    // 1. Regra Geral: Concluiu descarga e ticket validado (ou posterior)
    if (DISCHARGE_STATUS_SET.has(statusStr)) {
      return true;
    }

    // 2. Exceção de Virada de Mês: Efetivado no final do mês (dia >= 20) e em trânsito
    if (isShipmentEligibleByEndOfMonthException(s)) {
      if (targetMonthKey) {
        const effYmd = getShipmentEffectiveYmd(s);
        if (effYmd && !effYmd.startsWith(targetMonthKey)) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  // Se passada string/enum (retrocompatibilidade)
  const statusStr = String(shipmentOrStatus);
  return DISCHARGE_STATUS_SET.has(statusStr);
};
