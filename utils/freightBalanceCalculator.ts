import { calculateTacTaxDeductions, TacTaxDeductions } from './freightCalculation';

export interface FreightBalanceCalculation {
  tipoPessoa: 'PF' | 'PJ';
  freteBruto: number;
  adiantamento: number;
  saldoOriginal: number; // 3.5.1
  baseCalculoFiscal: number; // 20% do frete bruto para PF (TAC)
  inssRetido: number; // 3.5.2 (11% sobre Base Fiscal)
  sestSenat: number; // 3.5.3 (2.5% sobre Base Fiscal: 1,5% SEST + 1,0% SENAT)
  irrf: number; // 3.5.4 (IRRF tabela progressiva)
  outrosDescontos: number; // 3.5.5
  seguroCarga: number; // 3.5.6
  outrosAcrescimos: number; // 3.5.7
  diferencaPedagio: number; // 3.5.8
  taxaAdm: number; // 3.5.9
  subtotal: number; // 3.5.10 (Subtotal Líquido Pré-Descarga)
  
  // Pesos e quebras (3.5.11 a 3.5.13)
  pesoSaidaKg?: number; // 3.5.11
  pesoChegadaKg?: number; // 3.5.11
  diferencaPesoKg?: number; // Quebra (Saída - Chegada)
  valorKgMercadoria?: number; // Valor Unitário da Mercadoria para Ressarcimento (R$/kg)
  valorKgQuebra?: number; // alias para compatibilidade
  descontoMercadoriaQuebra?: number; // Desconto 1: Quebra kg * Valor Mercadoria
  descontoQuebra?: number; // alias para compatibilidade
  valorKgFreteUnitario?: number; // Frete por kg
  valorKgFreteFaltante?: number; // alias para compatibilidade
  descontoEstornoFrete?: number; // Desconto 2: Quebra kg * Frete Unitário
  descontoFreteFaltante?: number; // alias para compatibilidade
  totalDescontoQuebra: number; // Desconto 1 + Desconto 2
  saldoFinalLiquido: number; // Subtotal Líquido - Descontos de Quebra
  valorARessarcirMotorista: number; // Se saldoFinalLiquido < 0 (valor a ressarcir)
  tacTaxes?: TacTaxDeductions;
}

/**
 * Realiza o cálculo passo a passo do saldo do frete conforme regras de PF (TAC) e PJ:
 * 
 * 1. Frete Bruto: Peso saída * Frete unitário
 * 2. Partição Contratual: Adiantamento e Saldo Original
 * 3. Retenções Previdenciárias e Fiscais (Regra TAC Autônomo - PF):
 *    - Base Fiscal: 20% do Frete Bruto
 *    - INSS: 11% sobre Base Fiscal (teto previdenciário)
 *    - SEST/SENAT: 2,5% sobre Base Fiscal (1,5% SEST + 1,0% SENAT)
 *    - IRRF: Tabela progressiva mensal
 * 4. Subtotal Líquido Pré-Descarga = Saldo Original - Retenções
 * 5. Ajuste de Quebra na Balança de Destino:
 *    - Desconto 1: Mercadoria faltante (Quebra em kg * Valor Unitário Mercadoria)
 *    - Desconto 2: Estorno de frete proporcional (Quebra em kg * Frete Unitário por kg)
 * 6. Resultado Final: Saldo Líquido a Pagar (ou valor a ressarcir se negativo)
 */
export function calculateFreightBalance(params: {
  tipoPessoa?: 'PF' | 'PJ';
  freteBruto?: number;
  tollValue?: number;
  adiantamento?: number;
  saldoOriginal?: number;
  inssRetido?: number;
  sestSenat?: number;
  irrf?: number;
  outrosDescontos?: number;
  seguroCarga?: number;
  outrosAcrescimos?: number;
  diferencaPedagio?: number;
  taxaAdm?: number;
  pesoSaidaKg?: number;
  pesoChegadaKg?: number;
  valorKgQuebra?: number;
  valorKgMercadoria?: number;
  valorKgFreteFaltante?: number;
  valorKgFreteUnitario?: number;
}): FreightBalanceCalculation {
  const tipoPessoa = params.tipoPessoa || 'PF';
  const freteBruto = params.freteBruto || 0;
  const tagVal = params.tollValue || 0;
  const adiantamento = params.adiantamento || 0;

  // 1 & 2. Saldo Original Contratual
  const saldoOriginal = params.saldoOriginal !== undefined 
    ? params.saldoOriginal 
    : Math.max(0, freteBruto - adiantamento);

  let baseCalculoFiscal = 0;
  let inssRetido = 0;
  let sestSenat = 0;
  let irrf = 0;
  let tacTaxes: TacTaxDeductions | undefined = undefined;

  // 3. Retenções Previdenciárias e Fiscais (Regra TAC Autônomo)
  if (tipoPessoa === 'PF') {
    tacTaxes = calculateTacTaxDeductions(freteBruto, tagVal);
    baseCalculoFiscal = tacTaxes.fiscalBase;
    inssRetido = params.inssRetido !== undefined ? params.inssRetido : tacTaxes.inss;
    sestSenat = params.sestSenat !== undefined ? params.sestSenat : tacTaxes.sestSenat;
    irrf = params.irrf !== undefined ? params.irrf : tacTaxes.irrf;
  } else {
    baseCalculoFiscal = 0;
    inssRetido = 0;
    sestSenat = 0;
    irrf = 0;
  }

  const outrosDescontos = params.outrosDescontos || 0;
  const seguroCarga = params.seguroCarga || 0;
  const outrosAcrescimos = params.outrosAcrescimos || 0;
  const diferencaPedagio = params.diferencaPedagio || 0;
  const taxaAdm = params.taxaAdm || 0;

  // 4. Subtotal Líquido Pré-Descarga
  const subtotal = Number((
    saldoOriginal - 
    inssRetido - 
    sestSenat - 
    irrf - 
    outrosDescontos - 
    seguroCarga + 
    outrosAcrescimos + 
    diferencaPedagio - 
    taxaAdm
  ).toFixed(2));

  // 5. Ajuste de Quebra/Falta na Balança de Destino
  const pesoSaidaKg = params.pesoSaidaKg || 0;
  const pesoChegadaKg = params.pesoChegadaKg || 0;
  const diferencaPesoKg = (pesoSaidaKg > 0 && pesoChegadaKg > 0) 
    ? Math.max(0, Number((pesoSaidaKg - pesoChegadaKg).toFixed(2))) 
    : 0;

  // Desconto 1: Valor da mercadoria faltante (Quebra em kg × Valor Unitário da Mercadoria)
  const valorKgMercadoria = params.valorKgMercadoria !== undefined 
    ? params.valorKgMercadoria 
    : (params.valorKgQuebra !== undefined ? params.valorKgQuebra : (tipoPessoa === 'PF' ? 0.1170 : 0.3736));
  const descontoMercadoriaQuebra = diferencaPesoKg > 0 
    ? Number((diferencaPesoKg * valorKgMercadoria).toFixed(2)) 
    : 0;

  // Desconto 2: Estorno do frete proporcional não transportado (Quebra em kg × Frete por kg)
  const fretePorKgPadrao = (pesoSaidaKg > 0 && freteBruto > 0) ? (freteBruto / pesoSaidaKg) : (tipoPessoa === 'PF' ? 0.130 : 0.114);
  const valorKgFreteUnitario = params.valorKgFreteUnitario !== undefined 
    ? params.valorKgFreteUnitario 
    : (params.valorKgFreteFaltante !== undefined ? params.valorKgFreteFaltante : fretePorKgPadrao);
  const descontoEstornoFrete = diferencaPesoKg > 0 
    ? Number((diferencaPesoKg * valorKgFreteUnitario).toFixed(2)) 
    : 0;

  const totalDescontoQuebra = Number((descontoMercadoriaQuebra + descontoEstornoFrete).toFixed(2));

  // 6. Resultado Final: Saldo Líquido a Pagar
  const saldoFinalLiquido = Number((subtotal - totalDescontoQuebra).toFixed(2));
  const valorARessarcirMotorista = saldoFinalLiquido < 0 ? Math.abs(saldoFinalLiquido) : 0;

  return {
    tipoPessoa,
    freteBruto,
    adiantamento,
    saldoOriginal,
    baseCalculoFiscal,
    inssRetido,
    sestSenat,
    irrf,
    outrosDescontos,
    seguroCarga,
    outrosAcrescimos,
    diferencaPedagio,
    taxaAdm,
    subtotal,
    pesoSaidaKg,
    pesoChegadaKg,
    diferencaPesoKg,
    valorKgMercadoria,
    valorKgQuebra: valorKgMercadoria,
    descontoMercadoriaQuebra,
    descontoQuebra: descontoMercadoriaQuebra,
    valorKgFreteUnitario,
    valorKgFreteFaltante: valorKgFreteUnitario,
    descontoEstornoFrete,
    descontoFreteFaltante: descontoEstornoFrete,
    totalDescontoQuebra,
    saldoFinalLiquido,
    valorARessarcirMotorista,
    tacTaxes,
  };
}
