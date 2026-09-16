import { Shipment, Cargo, ShipmentStatus } from '../types';

export interface TacTaxDeductions {
  fiscalBase: number;       // 20% do Frete Bruto
  inss: number;             // 11% sobre Fiscal Base (respeitando o teto previdenciário)
  sestSenat: number;        // 2,5% sobre Fiscal Base (1,5% SEST + 1,0% SENAT)
  irrfBase: number;         // Base Fiscal - INSS
  irrf: number;             // IRRF tabela progressiva mensal
  totalDeductions: number;  // INSS + SEST/SENAT + IRRF
}

export interface AdvanceAndBalanceResult {
  totalFreight: number;
  baseFreight: number;
  tollValue: number;
  advancePercentage: number;
  grossAdvanceInAccountValue: number; // Adiantamento Bruto Contratual na Conta
  advanceInAccountValue: number;      // Valor Líquido pago na conta (Adiantamento Bruto - INSS - SEST/SENAT se PF)
  totalAdvanceValue: number;          // Total do adiantamento entregue (Conta Líquida + Tag)
  inssRetido: number;                 // INSS retido sobre contribuição autônomo (PF)
  sestSenat: number;                  // SEST/SENAT retido (PF)
  advanceTaxDeductions: number;       // Total deduzido no adiantamento (INSS + SEST/SENAT)
  originalBalanceValue: number;       // Saldo Original da Base de Frete
  irrf: number;                       // IRRF retido no saldo
  balanceToReceiveValue: number;      // Saldo Líquido Restante a Receber (Saldo Original - IRRF)
  driverFreightType?: 'PF' | 'PJ';
  tacTaxes?: TacTaxDeductions;
}

export const ADVANCE_ELIGIBLE_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.PreCadastro,            // "Ag. Cadastro"
  ShipmentStatus.AguardandoSeguradora,   // "Ag. Seguradora"
  ShipmentStatus.AguardandoCarregamento, // "Ag. Carregamento"
  ShipmentStatus.AguardandoNota,         // "Ag. Nota"
  ShipmentStatus.AguardandoFiscal,       // "Ag. Fiscal"
  ShipmentStatus.AguardandoAdiantamento, // "Ag. Adiantamento"
];

/**
 * 3. Retenções Previdenciárias e Fiscais (Regra TAC Autônomo - Pessoa Física):
 * - Base de Cálculo Fiscal = 20% sobre (Frete do Motorista - Vale-Pedágio)
 *   (Conforme Lei nº 10.209/2001 e legislação da Carta Frete, o vale-pedágio obrigatório não integra base de tributos)
 * - INSS = 11% sobre a Base Fiscal (limitado ao teto)
 * - SEST/SENAT = 2,5% sobre a Base Fiscal (1,5% SEST + 1,0% SENAT)
 * - IRRF = Tabela progressiva mensal sobre (Base Fiscal - INSS)
 */
export function calculateTacTaxDeductions(freteBruto: number, tollValue: number = 0): TacTaxDeductions {
  if (!freteBruto || freteBruto <= 0) {
    return {
      fiscalBase: 0,
      inss: 0,
      sestSenat: 0,
      irrfBase: 0,
      irrf: 0,
      totalDeductions: 0,
    };
  }

  // 1. Base de Cálculo Fiscal: 20% sobre o Frete Líquido de Pedágio
  const baseLiquidaPedagio = Math.max(0, freteBruto - (tollValue || 0));
  const fiscalBase = Number((baseLiquidaPedagio * 0.20).toFixed(2));

  // 2. INSS: 11% sobre a Base Fiscal (teto da base previdenciária ~R$ 8.157,41 => teto contribuição R$ 897,32)
  const inssTetoMax = 897.32;
  const inssCalculado = Number((fiscalBase * 0.11).toFixed(2));
  const inss = Math.min(inssCalculado, inssTetoMax);

  // 3. SEST/SENAT: 2,5% sobre a Base Fiscal (1,5% SEST + 1,0% SENAT)
  const sestSenat = Number((fiscalBase * 0.025).toFixed(2));

  // 4. IRRF: Tabela progressiva mensal sobre (Base Fiscal - INSS)
  const irrfBaseLegal = Math.max(0, fiscalBase - inss);
  
  let irrfTradicional = 0;
  if (irrfBaseLegal <= 2259.20) {
    irrfTradicional = 0;
  } else if (irrfBaseLegal <= 2826.65) {
    irrfTradicional = (irrfBaseLegal * 0.075) - 169.44;
  } else if (irrfBaseLegal <= 3751.05) {
    irrfTradicional = (irrfBaseLegal * 0.15) - 381.44;
  } else if (irrfBaseLegal <= 4664.68) {
    irrfTradicional = (irrfBaseLegal * 0.225) - 662.77;
  } else {
    irrfTradicional = (irrfBaseLegal * 0.275) - 896.00;
  }

  // Desconto simplificado opcional (R$ 564,80)
  const irrfBaseSimplificada = Math.max(0, fiscalBase - 564.80);
  let irrfSimplificado = 0;
  if (irrfBaseSimplificada <= 2259.20) {
    irrfSimplificado = 0;
  } else if (irrfBaseSimplificada <= 2826.65) {
    irrfSimplificado = (irrfBaseSimplificada * 0.075) - 169.44;
  } else if (irrfBaseSimplificada <= 3751.05) {
    irrfSimplificado = (irrfBaseSimplificada * 0.15) - 381.44;
  } else if (irrfBaseSimplificada <= 4664.68) {
    irrfSimplificado = (irrfBaseSimplificada * 0.225) - 662.77;
  } else {
    irrfSimplificado = (irrfBaseSimplificada * 0.275) - 896.00;
  }

  const irrfBruto = Math.min(Math.max(0, irrfTradicional), Math.max(0, irrfSimplificado));
  const irrf = Number(irrfBruto.toFixed(2));

  const totalDeductions = Number((inss + sestSenat + irrf).toFixed(2));

  return {
    fiscalBase,
    inss,
    sestSenat,
    irrfBase: Number(irrfBaseLegal.toFixed(2)),
    irrf,
    totalDeductions,
  };
}

/**
 * Realiza o cálculo padronizado de adiantamento e saldo do frete motorista:
 * 
 * Regra Padronizada (Padrão Carta Frete / Operadoras ANTT):
 * 1. Frete Bruto = (Frete Motorista / Ton) * Tonelagem (ou valor fixado do frete motorista)
 * 2. Base do Frete Líquida de Pedágio = Frete Bruto - Vale Pedágio
 * 3. Partição Contratual:
 *    - Adiantamento Bruto na Conta = Base do Frete * (% Adiantamento / 100)
 *    - Total Adiantamento Entregue = Adiantamento na Conta + Vale-Pedágio Tag
 *    - Saldo Original (Item 3.5.1) = Base do Frete * ((100 - % Adiantamento) / 100)
 * 4. Deduções Fiscais no Saldo Restante (se PF / TAC / Autônomo):
 *    - Base Fiscal: 20% sobre (Frete Bruto - Pedágio)
 *    - INSS Retido (Item 3.5.2): 11% sobre Base Fiscal
 *    - SEST/SENAT (Item 3.5.3): 2,5% sobre Base Fiscal (1,5% SEST + 1,0% SENAT)
 *    - IRRF Retido (Item 3.5.4): Tabela progressiva sobre (Base Fiscal - INSS)
 *    -> Saldo Líquido Restante (Item 3.5.10 Subtotal) = Saldo Original - INSS - SEST/SENAT - IRRF
 */
export function calculateAdvanceAndBalance({
  driverFreightValue,
  driverFreightRate,
  tonnage,
  tollValue = 0,
  advancePercentage = 70,
  driverFreightType,
}: {
  driverFreightValue?: number;
  driverFreightRate?: number;
  tonnage?: number;
  tollValue?: number;
  advancePercentage?: number;
  driverFreightType?: 'PF' | 'PJ';
}): AdvanceAndBalanceResult {
  const totalFreight = driverFreightValue !== undefined && driverFreightValue > 0
    ? driverFreightValue
    : (driverFreightRate && tonnage ? driverFreightRate * tonnage : 0);

  const tagVal = Number(tollValue || 0);
  const advPct = advancePercentage !== undefined && !isNaN(advancePercentage) ? Number(advancePercentage) : 70;

  // Base do frete líquida de pedágio
  const baseFreight = Math.max(0, totalFreight - tagVal);

  // Valor do Adiantamento na Conta (antes de qualquer desconto de saldo)
  const grossAdvanceInAccountValue = Number((baseFreight * (advPct / 100)).toFixed(2));

  const is100Pct = advPct >= 100;

  // Deduções fiscais de PF (TAC / Autônomo) - calculadas com base líquida de pedágio
  const isPf = driverFreightType === 'PF';
  const tacTaxes = isPf ? calculateTacTaxDeductions(totalFreight, tagVal) : undefined;
  
  // Retenções: INSS + SEST/SENAT + IRRF
  const inssRetido = tacTaxes ? tacTaxes.inss : 0;
  const sestSenat = tacTaxes ? tacTaxes.sestSenat : 0;
  const irrf = tacTaxes ? tacTaxes.irrf : 0;
  const totalTaxDeductions = Number((inssRetido + sestSenat + irrf).toFixed(2));

  // Quando o adiantamento é de 100%, as deduções de PF são feitas no próprio adiantamento (valor líquido pago na conta).
  // Quando < 100%, o adiantamento em conta é pago pelo valor contratual (ex: 70%), e as retenções são deduzidas no saldo.
  const advanceTaxDeductions = (isPf && is100Pct) ? totalTaxDeductions : 0;
  const advanceInAccountValue = (isPf && is100Pct)
    ? Math.max(0, Number((grossAdvanceInAccountValue - totalTaxDeductions).toFixed(2)))
    : grossAdvanceInAccountValue;

  // Total do adiantamento entregue (Conta + Tag Pedágio)
  const totalAdvanceValue = Number((advanceInAccountValue + tagVal).toFixed(2));

  // Saldo Original Contratual (Item 3.5.1 da Carta Frete)
  const originalBalanceValue = is100Pct ? 0 : Number((baseFreight * ((100 - advPct) / 100)).toFixed(2));

  // Saldo Líquido Restante a Receber: Saldo Original - INSS - SEST/SENAT - IRRF (se < 100%), ou 0 se 100%
  const balanceToReceiveValue = is100Pct
    ? 0
    : (isPf ? Math.max(0, Number((originalBalanceValue - totalTaxDeductions).toFixed(2))) : originalBalanceValue);

  return {
    totalFreight: Number(totalFreight.toFixed(2)),
    baseFreight: Number(baseFreight.toFixed(2)),
    tollValue: tagVal,
    advancePercentage: advPct,
    grossAdvanceInAccountValue,
    advanceInAccountValue,
    totalAdvanceValue,
    inssRetido,
    sestSenat,
    advanceTaxDeductions,
    originalBalanceValue,
    irrf,
    balanceToReceiveValue,
    driverFreightType,
    tacTaxes,
  };
}

/**
 * Aplica o cálculo padronizado de adiantamento e saldo a um embarque
 */
export function applyAdvanceCalculationToShipment(shipment: Shipment, cargo?: Cargo): Shipment {
  const rate = shipment.driverFreightRateSnapshot || cargo?.driverFreightValuePerTon || 0;
  const tonnage = shipment.shipmentTonnage || cargo?.totalVolume || 0;
  const totalFreight = shipment.driverFreightValue || (rate * tonnage);
  const advPct = shipment.advancePercentage !== undefined ? shipment.advancePercentage : 70;
  const toll = shipment.tollValue || 0;
  const freightType = shipment.driverFreightType || (shipment.anttModality === 'TAC' ? 'PF' : 'PJ');

  const result = calculateAdvanceAndBalance({
    driverFreightValue: totalFreight,
    driverFreightRate: rate,
    tonnage,
    tollValue: toll,
    advancePercentage: advPct,
    driverFreightType: freightType,
  });

  return {
    ...shipment,
    advancePercentage: result.advancePercentage,
    advanceValue: result.advanceInAccountValue,
    tollValue: result.tollValue,
    balanceToReceiveValue: result.balanceToReceiveValue,
  };
}
