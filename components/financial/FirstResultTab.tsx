import React, { useState, useMemo } from 'react';
import type { Shipment, Cargo, Client, User, Branch } from '../../types';
import { ShipmentStatus } from '../../types';
import type { FirstLevelFinancialResult } from '../../utils/financialCalculations';
import { 
  TrendingUp, 
  FileText, 
  Filter, 
  Calendar, 
  Truck, 
  Users, 
  User as UserIcon, 
  UserCheck, 
  Building2, 
  BadgePercent, 
  ShieldCheck, 
  Receipt, 
  Shield, 
  AlertTriangle, 
  Database, 
  Sprout, 
  MoreHorizontal, 
  Target, 
  CheckCircle2, 
  Info, 
  Coins, 
  ChevronDown, 
  ChevronUp,
  FlaskConical,
  CreditCard
} from 'lucide-react';
import { calculateShipmentExpenses } from '../../utils/operationalExpensesCalculator';
import { 
  getShipmentEffectiveDate, 
  parseDateToYmd, 
  getFinancialPeriodRange, 
  toLocalYmd, 
  FinancialPeriodFilter, 
  getShipmentCte, 
  isCteApplicableForStatus 
} from '../../utils';

export interface FirstResultTabProps {
  data: FirstLevelFinancialResult;
  shipments?: Shipment[];
  cargos?: Cargo[];
  clients?: Client[];
  users?: User[];
  branches?: Branch[];
}

export const FirstResultTab: React.FC<FirstResultTabProps> = ({
  data: initialData,
  shipments = [],
  cargos = [],
  clients = [],
  users = [],
  branches = []
}) => {
  // Controles de Período e Data conforme o layout da imagem
  const [periodMode, setPeriodMode] = useState<'diario' | 'mensal' | 'anual'>('diario');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [quickFilter, setQuickFilter] = useState<FinancialPeriodFilter>('mes');
  const [taxQuickFilter, setTaxQuickFilter] = useState<FinancialPeriodFilter>('mes');
  const [showDetailedDre, setShowDetailedDre] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  // Formatação de valores monetários e percentuais
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const formatPercent = (val: number) => {
    return `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  // Mapeamentos para performance
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const userBranchMap = useMemo(() => new Map(users.map(u => [u.id, u.branchId])), [users]);

  // Helper para resolução de liderança de agência (ex: operador Murilo USR-1007 -> líder Maurício USR-294)
  const getLeaderIdForUser = (userId?: string) => {
    if (!userId) return undefined;
    const user = userMap.get(userId);
    if (!user) return undefined;
    if (user.agencyRole === 'embarque' && user.agencyLeaderId) {
      return user.agencyLeaderId;
    }
    if (user.agencyLeaderId) {
      return user.agencyLeaderId;
    }
    return user.id;
  };

  // Função para identificar a filial do embarque e agrupar nas 4 frentes do dashboard:
  // "Ag GO" = Agência Goiás (Filial TRANSCUNHA-GOAIS / Catalão - GO / Operações do Maurício e Murilo)
  // "Ag SP" = Agência do "RAFAEL PINHEIRO" + "RAFAEL TARANTELLI" / Filial SP
  // "Ag PR" = Agência Paraná / Cambará
  // "Matriz" = Demais operações / Sede
  const classifyBranch = (s: Shipment, cargo?: Cargo): 'matriz' | 'ag_sp' | 'ag_go' | 'ag_pr' => {
    // 1. Identificação direta por prefixo do embarque
    // Prefixo RAF-xxx -> Agência SP (Rafael Pinheiro / Rafael Tarantelli)
    // Prefixo MAU-xxx / MUR-xxx -> Agência GO (Maurício / Murilo Rodrigues)
    const sid = (s.id || '').toUpperCase();
    if (sid.startsWith('RAF-')) return 'ag_sp';
    if (sid.startsWith('MAU-') || sid.startsWith('MUR-')) return 'ag_go';

    // 2. Identificação direta por Agência Líder ou Operador da Agência
    const checkUser = (userId?: string) => {
      if (!userId) return null;
      const leaderId = getLeaderIdForUser(userId);
      const u = userMap.get(userId);
      const leader = leaderId ? userMap.get(leaderId) : null;

      const name = ((u?.name || '') + ' ' + (leader?.name || '')).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const email = ((u?.email || '') + ' ' + (leader?.email || '')).toUpperCase();
      const id = userId.toUpperCase();
      const lid = (leaderId || '').toUpperCase();

      // "Ag GO" = Agência do "Maurício" (USR-294) / Murilo Rodrigues (USR-1007)
      if (
        id === 'USR-294' ||
        lid === 'USR-294' ||
        id === 'USR-1007' ||
        name.includes('MAURICIO') ||
        name.includes('MURILO') ||
        email.includes('MAURICIO') ||
        email.includes('MURILO')
      ) {
        return 'ag_go';
      }

      // "Ag SP" = Agência do "RAFAEL PINHEIRO" (USR-107) + "RAFAEL TARANTELLI" (USR-106)
      if (
        id === 'USR-106' ||
        id === 'USR-107' ||
        lid === 'USR-106' ||
        lid === 'USR-107' ||
        name.includes('RAFAEL PINHEIRO') ||
        name.includes('RAFAEL TARANTELLI') ||
        email.includes('PINHEIRO') ||
        email.includes('TARANTELLI')
      ) {
        return 'ag_sp';
      }

      return null;
    };

    // Prioridade por Agenciador / Embarcador / Criador
    const byEmbarcador = checkUser(s.embarcadorId);
    if (byEmbarcador) return byEmbarcador;

    const byCreator = checkUser(s.createdById);
    if (byCreator) return byCreator;

    // 3. Filial cadastrada (a filial do operador tem precedência sobre a filial de carga Matriz)
    const operatorBranchId = userBranchMap.get(s.embarcadorId) || userBranchMap.get(s.createdById);
    const effectiveBranchId = s.branchId || 
                              operatorBranchId || 
                              cargo?.branchId || 
                              (cargo ? userBranchMap.get(cargo.createdById) : undefined);

    if (effectiveBranchId) {
      const bObj = branches.find(b => b.id === effectiveBranchId);
      if (bObj) {
        const bName = (bObj.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const bCity = (bObj.city || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const bState = (bObj.state || '').toLowerCase();

        // Filial Goiás (TRANSCUNHA-GOAIS / Catalão - GO)
        if (
          bName.includes('go') ||
          bName.includes('goias') ||
          bCity.includes('catalao') ||
          bState === 'go'
        ) {
          return 'ag_go';
        }

        // Filial São Paulo
        if (
          bName.includes('sp') ||
          bName.includes('sao paulo') ||
          bState === 'sp'
        ) {
          return 'ag_sp';
        }

        // Filial Paraná
        if (
          bName.includes('pr') ||
          bName.includes('parana') ||
          bName.includes('cambara') ||
          bCity.includes('maringa') ||
          bCity.includes('londrina') ||
          bState === 'pr'
        ) {
          return 'ag_pr';
        }
      }
    }

    // Criador da carga original vinculada
    if (cargo?.createdById) {
      const byCargoCreator = checkUser(cargo.createdById);
      if (byCargoCreator) return byCargoCreator;
    }

    // Rota e Localidade
    const route = ((s.route || '') + ' ' + (cargo?.origin || '') + ' ' + (cargo?.destination || '')).toUpperCase();
    if (route.includes('/GO') || route.includes('- GO') || route.includes('GOIAS') || route.includes('GOIÁS') || route.includes('CATALAO') || route.includes('CATALÃO')) {
      return 'ag_go';
    }
    if (route.includes('/PR') || route.includes('- PR') || route.includes('PARANA') || route.includes('PARANÁ') || route.includes('CAMBARA') || route.includes('CAMBARÁ')) {
      return 'ag_pr';
    }
    if (route.includes('/SP') || route.includes('- SP') || route.includes('SAO PAULO') || route.includes('SÃO PAULO')) {
      return 'ag_sp';
    }

    // Padrão: Matriz
    return 'matriz';
  };

  // Filtragem dos embarques conforme o período selecionado
  const filteredShipments = useMemo(() => {
    const valid = shipments.filter(s => s.status !== ShipmentStatus.Cancelado);
    if (!valid.length) return [];

    let refDate = new Date();
    if (selectedDate) {
      const [year, month, day] = selectedDate.split('-').map(Number);
      if (year && month && day) {
        refDate = new Date(year, month - 1, day);
      }
    }

    const { startDate, endDate } = getFinancialPeriodRange(quickFilter, refDate);

    return valid.filter(s => {
      const sDate = getShipmentEffectiveDate(s) || (s.scheduledDate ? parseDateToYmd(s.scheduledDate) : null) || s.createdAt?.split('T')[0];
      if (!sDate) return false;
      return sDate >= startDate && sDate <= endDate;
    });
  }, [shipments, selectedDate, quickFilter]);

  // Filtragem específica para a seção de Impostos / Custos / Descontos
  const taxFilteredShipments = useMemo(() => {
    const valid = shipments.filter(s => s.status !== ShipmentStatus.Cancelado);
    if (!valid.length) return [];

    let refDate = new Date();
    if (selectedDate) {
      const [year, month, day] = selectedDate.split('-').map(Number);
      if (year && month && day) {
        refDate = new Date(year, month - 1, day);
      }
    }

    const { startDate, endDate } = getFinancialPeriodRange(taxQuickFilter, refDate);

    return valid.filter(s => {
      const sDate = getShipmentEffectiveDate(s) || (s.scheduledDate ? parseDateToYmd(s.scheduledDate) : null) || s.createdAt?.split('T')[0];
      if (!sDate) return false;
      return sDate >= startDate && sDate <= endDate;
    });
  }, [shipments, selectedDate, taxQuickFilter]);

  // Agregações financeiras completas
  const calculated = useMemo(() => {
    let faturamentoMatriz = 0;
    let faturamentoAgSP = 0;
    let faturamentoAgGO = 0;
    let faturamentoAgPR = 0;

    let loadedVehiclesMatriz = 0;
    let loadedVehiclesAgSP = 0;
    let loadedVehiclesAgGO = 0;
    let loadedVehiclesAgPR = 0;

    let totalVehiclesMatriz = 0;
    let totalVehiclesAgSP = 0;
    let totalVehiclesAgGO = 0;
    let totalVehiclesAgPR = 0;

    let totalNfValor = 0;
    let icmsTotal = 0;
    let pisCofinsTotal = 0;
    let pedagioTotal = 0;
    let inssTotal = 0;
    let irTotal = 0;
    let seguroRcfTotal = 0;
    let seguroAcidenteTotal = 0;
    let custiTotal = 0;
    let funruralTotal = 0;
    let in2277Total = 0;
    let outrosCustosTotal = 0;

    let comissaoAgSP = 0;
    let comissaoAgGO = 0;
    let comissaoAgPR = 0;
    let comissaoComercial = 0;
    let comissaoUnidade = 0;
    let comissaoEmbarcador = 0;
    let comissaoCliente = 0;
    let comissaoVendedor = 0;

    let totalDriverFreights = 0;
    let totalPgAdiantamento = 0;
    let totalPgSaldo = 0;
    let vehicleCount = 0;

    const list = filteredShipments;

    for (const s of list) {
      const cargo = cargoMap.get(s.cargoId);
      const exp = calculateShipmentExpenses(s, cargo);
      vehicleCount += 1;

      // Faturamento e filiais
      const branchKey = classifyBranch(s, cargo);
      const freightBruto = exp.companyFreight || (s.companyFreightRateSnapshot ? s.companyFreightRateSnapshot * (s.shipmentTonnage || 0) : s.driverFreightValue * 1.15);

      // Critério de Faturamento Efetivo: apurado mediante emissão do CT-e (conforme Relatório Comercial e de Filiais)
      const cteVal = getShipmentCte(s);
      const hasCte = Boolean(cteVal && cteVal !== '-' && cteVal.trim() !== '' && isCteApplicableForStatus(s.status));

      if (branchKey === 'ag_sp') {
        if (hasCte) {
          faturamentoAgSP += freightBruto;
          loadedVehiclesAgSP += 1;
        }
        totalVehiclesAgSP += 1;
      } else if (branchKey === 'ag_go') {
        if (hasCte) {
          faturamentoAgGO += freightBruto;
          loadedVehiclesAgGO += 1;
        }
        totalVehiclesAgGO += 1;
      } else if (branchKey === 'ag_pr') {
        if (hasCte) {
          faturamentoAgPR += freightBruto;
          loadedVehiclesAgPR += 1;
        }
        totalVehiclesAgPR += 1;
      } else {
        if (hasCte) {
          faturamentoMatriz += freightBruto;
          loadedVehiclesMatriz += 1;
        }
        totalVehiclesMatriz += 1;
      }

      // Demonstrativo de Notas Fiscais (apenas documentos reais)
      const nfVal = s.nfeValue || s.realProfitData?.invoiceValue || exp.invoiceValue || 0;
      if (hasCte) {
        totalNfValor += nfVal;
      }

      // Pedágio sanitizado (limite de R$ 25.000 para frete rodoviário unitário)
      const rawToll = Number(s.tollValue);
      const safeToll = (!isNaN(rawToll) && rawToll >= 0 && rawToll <= 25000) ? rawToll : 0;
      if (hasCte) {
        pedagioTotal += safeToll;
      }

      // Comissões por canal e despesas diretas apuradas para fretes efetivamente faturados
      if (hasCte) {
        if (branchKey === 'ag_sp') comissaoAgSP += (exp.agencyCommission || (freightBruto * 0.015));
        if (branchKey === 'ag_go') comissaoAgGO += (exp.agencyCommission || (freightBruto * 0.015));
        if (branchKey === 'ag_pr') comissaoAgPR += (exp.agencyCommission || (freightBruto * 0.015));

        comissaoComercial += exp.comissaoComercial || (s.commercialCommission || (freightBruto * 0.002));
        comissaoUnidade += (freightBruto * 0.0035);
        comissaoEmbarcador += exp.shipperCommission || (s.shipperCommissionValue || 0);
        comissaoCliente += (s.realProfitData?.commission || 0);
        comissaoVendedor += exp.salespersonCommission || 0;

        const driverVal = exp.driverFreight || (s.driverFreightValue || 0);
        totalDriverFreights += driverVal;

        // Adiantamento e Saldo aos motoristas
        const advVal = s.advanceValue !== undefined && s.advanceValue !== null
          ? Number(s.advanceValue)
          : (s.advancePercentage ? (driverVal * s.advancePercentage / 100) : (driverVal * 0.7));

        const balVal = s.netBalanceValue !== undefined && s.netBalanceValue !== null
          ? Number(s.netBalanceValue)
          : (s.balanceToReceiveValue !== undefined && s.balanceToReceiveValue !== null
              ? Number(s.balanceToReceiveValue)
              : Math.max(0, driverVal - advVal));

        totalPgAdiantamento += advVal;
        totalPgSaldo += balVal;
      }
    }

    // Seção de Impostos e Deduções apurada dinamicamente a partir do taxFilteredShipments
    let taxPedagioTotal = 0;
    for (const s of taxFilteredShipments) {
      const cteVal = getShipmentCte(s);
      const hasCte = Boolean(cteVal && cteVal !== '-' && cteVal.trim() !== '' && isCteApplicableForStatus(s.status));
      if (!hasCte) continue;

      const cargo = cargoMap.get(s.cargoId);
      const exp = calculateShipmentExpenses(s, cargo);
      const freightBruto = exp.companyFreight || (s.companyFreightRateSnapshot ? s.companyFreightRateSnapshot * (s.shipmentTonnage || 0) : s.driverFreightValue * 1.15);
      const nfVal = s.nfeValue || s.realProfitData?.invoiceValue || exp.invoiceValue || 0;

      const rawToll = Number(s.tollValue);
      const safeToll = (!isNaN(rawToll) && rawToll >= 0 && rawToll <= 25000) ? rawToll : 0;
      taxPedagioTotal += safeToll;

      icmsTotal += exp.icms || (s.icmsValue || 0);
      pisCofinsTotal += exp.impostoFederal || (freightBruto * 0.0365);
      inssTotal += exp.inssPatronal || 0;
      irTotal += (s.driverFreightType === 'PF' ? (s.driverFreightValue * 0.015) : 0);
      seguroRcfTotal += exp.insuranceRcv || 5.0;
      seguroAcidenteTotal += (exp.insuranceAcidente + exp.insuranceRoubo) || (nfVal * 0.00025);
      custiTotal += (exp.riskCost + exp.ciot) || 12.5;
      funruralTotal += (s.driverFreightType === 'PF' ? (s.driverFreightValue * 0.012) : 0);
      in2277Total += (freightBruto * 0.0065); // Retenções Federais IN 2277
      outrosCustosTotal += (s.additionalCost?.value || s.realProfitData?.otherCosts || 0);
    }

    const somaFaturamento = faturamentoMatriz + faturamentoAgSP + faturamentoAgGO + faturamentoAgPR;

    // Demonstrativo
    const nfValorFinal = totalNfValor;
    const nfValorPlus18 = nfValorFinal * 1.18;

    // Custos e Deduções
    const somaImpostosCustos = icmsTotal + pisCofinsTotal + taxPedagioTotal + inssTotal + irTotal + 
                               seguroRcfTotal + seguroAcidenteTotal + custiTotal + funruralTotal + 
                               in2277Total + outrosCustosTotal;

    // Comissões
    const totalComissoes = comissaoAgSP + comissaoAgGO + comissaoAgPR + comissaoComercial + 
                           comissaoUnidade + comissaoEmbarcador + comissaoCliente + comissaoVendedor;

    const percentComissoesSobreFat = somaFaturamento > 0 ? (totalComissoes / somaFaturamento) * 100 : 0;
    const countVehicles = vehicleCount;
    const valorComissaoPorVeiculo = countVehicles > 0 ? totalComissoes / countVehicles : 0;

    // Margem Bruta
    const margemBrutaValor = somaFaturamento - totalDriverFreights - pedagioTotal;
    const rawMargemBrutaPercent = somaFaturamento > 0 ? (margemBrutaValor / somaFaturamento) * 100 : 0;
    const margemBrutaPercent = Math.max(-100, Math.min(100, rawMargemBrutaPercent));

    // Resultados de Adiantamento e Saldo
    const totalAdiantamentoESaldo = totalPgAdiantamento + totalPgSaldo;
    const percPgAdiantamento = somaFaturamento > 0 ? (totalPgAdiantamento / somaFaturamento) * 100 : 0;
    const percPgSaldo = somaFaturamento > 0 ? (totalPgSaldo / somaFaturamento) * 100 : 0;
    const percAdiantamentoESaldo = somaFaturamento > 0 ? (totalAdiantamentoESaldo / somaFaturamento) * 100 : 0;

    return {
      faturamento: {
        matriz: faturamentoMatriz,
        agSp: faturamentoAgSP,
        agGo: faturamentoAgGO,
        agPr: faturamentoAgPR,
        total: somaFaturamento,
        vehiclesMatriz: loadedVehiclesMatriz,
        vehiclesAgSP: loadedVehiclesAgSP,
        vehiclesAgGO: loadedVehiclesAgGO,
        vehiclesAgPR: loadedVehiclesAgPR,
        vehiclesTotal: loadedVehiclesMatriz + loadedVehiclesAgSP + loadedVehiclesAgGO + loadedVehiclesAgPR,
        totalVehiclesMatriz,
        totalVehiclesAgSP,
        totalVehiclesAgGO,
        totalVehiclesAgPR,
        totalVehiclesAll: totalVehiclesMatriz + totalVehiclesAgSP + totalVehiclesAgGO + totalVehiclesAgPR
      },
      margemBruta: {
        percent: margemBrutaPercent,
        value: margemBrutaValor
      },
      demonstrativo: {
        nfValor: nfValorFinal,
        nfValorPlus18: nfValorPlus18
      },
      impostosCustos: {
        icms: icmsTotal,
        pisCofins: pisCofinsTotal,
        pedagio: taxPedagioTotal,
        inss: inssTotal,
        ir: irTotal,
        seguroRcf: seguroRcfTotal,
        acidente: seguroAcidenteTotal,
        custi: custiTotal,
        funrural: funruralTotal,
        in2277: in2277Total,
        outros: outrosCustosTotal,
        total: somaImpostosCustos
      },
      comissoes: {
        agSp: comissaoAgSP,
        agGo: comissaoAgGO,
        agPr: comissaoAgPR,
        comercial: comissaoComercial,
        unidade: comissaoUnidade,
        embarcador: comissaoEmbarcador,
        cliente: comissaoCliente,
        vendedor: comissaoVendedor,
        total: totalComissoes,
        percentSobreFat: percentComissoesSobreFat,
        vehicleCount: countVehicles,
        valorPorVeiculo: valorComissaoPorVeiculo
      },
      resultado: {
        pgAdiantamento: totalPgAdiantamento,
        percAdiantamento: percPgAdiantamento,
        pgSaldo: totalPgSaldo,
        percSaldo: percPgSaldo,
        adiantamentoESaldo: totalAdiantamentoESaldo,
        percTotal: percAdiantamentoESaldo,
        adicionalRodoviario: totalPgAdiantamento,
        percAdicional: percPgAdiantamento,
        saldoRodoviario: totalPgSaldo,
        adicionalMaisSaldo: totalAdiantamentoESaldo,
      }
    };
  }, [filteredShipments, taxFilteredShipments, cargoMap, branches, users]);

  const handleApplyFilter = () => {
    setIsFiltering(true);
    setTimeout(() => {
      setIsFiltering(false);
    }, 300);
  };

  return (
    <div className="space-y-4 text-slate-800 dark:text-slate-100 font-sans">
      {/* ========================================================= */}
      {/* 1. HEADER SUPERIOR COM CONTROLES DE FILTRO E DATA        */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Lado Esquerdo: Ícone + Título + Subtítulo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-600 dark:bg-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-600/30 shrink-0">
              <TrendingUp className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Resultado Financeiro
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Resumo Financeiro — Mensal / Diário
              </p>
            </div>
          </div>

          {/* Lado Direito: Período, Data e Botão Filtrar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Período */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Periodo:</span>
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                {(['diario', 'mensal', 'anual'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriodMode(p)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 capitalize cursor-pointer ${
                      periodMode === p
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {p === 'diario' ? 'Diário' : p === 'mensal' ? 'Mensal' : 'Anual'}
                  </button>
                ))}
              </div>
            </div>

            {/* Input de Data */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Data:</span>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm cursor-pointer"
                />
              </div>
            </div>

            {/* Botão Filtrar */}
            <button
              onClick={handleApplyFilter}
              disabled={isFiltering}
              className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Filter className={`w-3.5 h-3.5 ${isFiltering ? 'animate-spin' : ''}`} />
              <span>{isFiltering ? 'Filtrando...' : 'Filtrar'}</span>
            </button>
          </div>
        </div>

        {/* Linha de Subfiltros Rápidos: Hoje, Semana Atual, Mês Atual, Ano Atual */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Filtros:</span>
          {[
            { id: 'hoje', label: 'Hoje' },
            { id: 'semana', label: 'Semana Atual' },
            { id: 'mes', label: 'Mês Atual' },
            { id: 'ano', label: 'Ano Atual' },
          ].map(q => (
            <button
              key={q.id}
              onClick={() => {
                setQuickFilter(q.id as FinancialPeriodFilter);
                if (q.id === 'hoje') {
                  setSelectedDate(toLocalYmd(new Date()));
                }
              }}
              className={`px-4 py-1 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer ${
                quickFilter === q.id
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. SEÇÃO 1: FATURAMENTO + MARGEM BRUTA + DEMONSTRATIVO    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        
        {/* Card 1: Faturamento (Filiais) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                  Faturamento
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Referente aos CT-es emitidos
                </p>
              </div>
            </div>

            {/* Grid com 5 Filiais: Matriz, Ag. SP, Ag GO, Ag PR, Total */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
              {/* Matriz */}
              <div className="flex flex-col text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Matriz</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2.5 min-h-[46px] flex items-center justify-center text-xs font-black text-slate-800 dark:text-white">
                  {formatCurrency(calculated.faturamento.matriz)}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold block">
                  {calculated.faturamento.vehiclesMatriz} {calculated.faturamento.vehiclesMatriz === 1 ? 'veículo carregado' : 'veículos carregados'}
                </span>
              </div>

              {/* Ag. SP */}
              <div className="flex flex-col text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-0.5" title="Agência SP: RAFAEL PINHEIRO + RAFAEL TARANTELLI">
                  <Truck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Ag. SP</span>
                </div>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mb-1 truncate block">
                  Rafael P. & Tarantelli
                </span>
                <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2.5 min-h-[46px] flex items-center justify-center text-xs font-black text-slate-800 dark:text-white">
                  {formatCurrency(calculated.faturamento.agSp)}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold block">
                  {calculated.faturamento.vehiclesAgSP} {calculated.faturamento.vehiclesAgSP === 1 ? 'veículo carregado' : 'veículos carregados'}
                </span>
              </div>

              {/* Ag GO */}
              <div className="flex flex-col text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-0.5" title="Agência GO: Maurício">
                  <Truck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Ag GO</span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-1 truncate block">
                  Maurício
                </span>
                <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2.5 min-h-[46px] flex items-center justify-center text-xs font-black text-slate-800 dark:text-white">
                  {formatCurrency(calculated.faturamento.agGo)}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold block">
                  {calculated.faturamento.vehiclesAgGO} {calculated.faturamento.vehiclesAgGO === 1 ? 'veículo carregado' : 'veículos carregados'}
                </span>
              </div>

              {/* Ag PR */}
              <div className="flex flex-col text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ag PR</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2.5 min-h-[46px] flex items-center justify-center text-xs font-black text-slate-800 dark:text-white">
                  {formatCurrency(calculated.faturamento.agPr)}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold block">
                  {calculated.faturamento.vehiclesAgPR} {calculated.faturamento.vehiclesAgPR === 1 ? 'veículo carregado' : 'veículos carregados'}
                </span>
              </div>

              {/* Total Geral com Destaque Azul */}
              <div className="col-span-2 sm:col-span-1 flex flex-col text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-1">
                  <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Total</span>
                </div>
                <div className="bg-amber-50/90 border border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-800 rounded-xl p-2.5 min-h-[46px] flex items-center justify-center text-xs font-black text-amber-950 dark:text-amber-100">
                  {formatCurrency(calculated.faturamento.total)}
                </div>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-bold block">
                  {calculated.faturamento.vehiclesTotal} {calculated.faturamento.vehiclesTotal === 1 ? 'veículo carregado' : 'veículos carregados'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Margem Bruta */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-black text-xs shrink-0 ${calculated.margemBruta.value >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
              %
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
              Margem Bruta
            </h2>
          </div>

          <div className={`rounded-xl p-3 my-auto flex flex-col items-center justify-center text-center border ${
            calculated.margemBruta.value >= 0
              ? 'bg-emerald-50/70 border-emerald-200/70 dark:bg-emerald-950/30 dark:border-emerald-800/50'
              : 'bg-rose-50/70 border-rose-200/70 dark:bg-rose-950/30 dark:border-rose-800/50'
          }`}>
            <span className={`text-2xl font-black ${calculated.margemBruta.value >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {formatPercent(calculated.margemBruta.percent)}
            </span>
            <span className={`text-[11px] font-bold mt-0.5 ${calculated.margemBruta.value >= 0 ? 'text-emerald-600/90 dark:text-emerald-400' : 'text-rose-600/90 dark:text-rose-400'}`}>
              {formatCurrency(calculated.margemBruta.value)}
            </span>
          </div>

          <span className="text-[10px] text-slate-400 text-center block mt-1">Margem Operacional</span>
        </div>

        {/* Card 3: Demonstrativo */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                Demonstrativo
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              {/* NF Valor */}
              <div className="flex flex-col text-center">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
                  NF Valor
                </span>
                <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2.5 min-h-[46px] flex items-center justify-center text-xs font-black text-slate-800 dark:text-white">
                  {formatCurrency(calculated.demonstrativo.nfValor)}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
              </div>

              {/* NF Valor + 18% */}
              <div className="flex flex-col text-center">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
                  NF Valor + 18%
                </span>
                <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2.5 min-h-[46px] flex items-center justify-center text-xs font-black text-slate-800 dark:text-white">
                  {formatCurrency(calculated.demonstrativo.nfValorPlus18)}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. SEÇÃO 2: IMPOSTOS / CUSTOS / DESCONTOS (11 CARDS)       */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
              Impostos / Custos / Descontos
            </h2>
          </div>

          {/* Subfiltro de impostos: Hoje, Semana Atual, Mês Atual, Ano Atual */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: 'semana', label: 'Semana Atual' },
              { id: 'mes', label: 'Mês Atual' },
              { id: 'ano', label: 'Ano Atual' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setTaxQuickFilter(f.id as FinancialPeriodFilter)}
                className={`px-3 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  taxQuickFilter === f.id
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 11 Caixas de Custos/Impostos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2 mt-2">
          {/* 1. ICMS */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>ICMS</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.icms)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 2. PIS/COFINS */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <Receipt className="w-3.5 h-3.5 text-amber-500" />
              <span>PIS/COFINS</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.pisCofins)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 3. Pedágio */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <span className="w-3.5 h-3.5 flex items-center justify-center font-black text-[10px] bg-slate-200 dark:bg-slate-700 rounded-sm">A</span>
              <span>Pedágio</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.pedagio)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 4. INSS */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              <span>INSS</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.inss)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 5. IR */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <span className="w-3.5 h-3.5 flex items-center justify-center font-black text-[10px] text-purple-600">■</span>
              <span>IR</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.ir)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 6. Seguro RCF */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span>Seguro RCF</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.seguroRcf)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 7. Acidente + ... */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Acidente + ...</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.acidente)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 8. CUSTI */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span>CUSTI</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.custi)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 9. FUN... */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <Sprout className="w-3.5 h-3.5 text-teal-500" />
              <span>FUN...</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.funrural)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 10. IN 22... */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>IN 22...</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.in2277)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* 11. Outros */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Outros</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.impostosCustos.outros)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. SEÇÃO 3: COMISSÕES (8 CANAIS + MEMÓRIA DE CÁLCULO)      */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
              Comissões
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Agenciadores • Embarcadores • Cliente • Vendedores
            </p>
          </div>
        </div>

        {/* 8 Caixas de Comissões */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mt-3">
          {/* Comissão Ag. SP */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate" title="Agência SP: RAFAEL PINHEIRO + RAFAEL TARANTELLI">
              <Users className="w-3 h-3 text-amber-500" />
              <span>Comissão Ag. SP</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.comissoes.agSp)}
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium truncate">Rafael & Tarantelli</span>
          </div>

          {/* Comissão Ag GO */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate" title="Agência GO: Maurício">
              <Users className="w-3 h-3 text-emerald-500" />
              <span>Comissão Ag GO</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.comissoes.agGo)}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium truncate">Maurício</span>
          </div>

          {/* Comissão Ag PR */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <Users className="w-3 h-3 text-slate-400" />
              <span>Comissão Ag PR</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.comissoes.agPr)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* Comissão Comercial */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <UserCheck className="w-3 h-3 text-slate-400" />
              <span>Comissão Comercial</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.comissoes.comercial)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* Comissão Unidade */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <Building2 className="w-3 h-3 text-slate-400" />
              <span>Comissão Unidade</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.comissoes.unidade)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* Comissão Embarcador */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <UserCheck className="w-3 h-3 text-slate-400" />
              <span>Comissão Embarcador</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.comissoes.embarcador)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* Comissão Cliente */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <UserIcon className="w-3 h-3 text-slate-400" />
              <span>Comissão Cliente</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.comissoes.cliente)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>

          {/* Comissão Vendedor */}
          <div className="flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
              <BadgePercent className="w-3 h-3 text-slate-400" />
              <span>Comissão Vendedor</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2 min-h-[42px] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
              {formatCurrency(calculated.comissoes.vendedor)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">Total</span>
          </div>
        </div>

        {/* Linha Inferior da Seção Comissões: Total de Comissões + Memória de Cálculo + Fórmula */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mt-4 items-stretch">
          
          {/* Card Esquerdo: Total de Comissões */}
          <div className="lg:col-span-5 bg-amber-50/70 border border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-800/70 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Total de Comissões
                </span>
                <div className="bg-white dark:bg-slate-800 px-3.5 py-1.5 rounded-xl font-black text-lg text-amber-950 dark:text-amber-100 shadow-sm mt-1 inline-block">
                  {formatCurrency(calculated.comissoes.total)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-base font-black text-amber-700 dark:text-amber-300 block">
                {formatPercent(calculated.comissoes.percentSobreFat)}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                sobre faturamento
              </span>
            </div>
          </div>

          {/* Card Central: Memória de Cálculo (Exemplo) */}
          <div className="lg:col-span-4 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              <Info className="w-4 h-4 text-amber-600" />
              <span>Memória de Cálculo (Exemplo)</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col text-center">
                <span className="text-[10px] font-semibold text-slate-500 mb-1 truncate">Base de comissão</span>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center text-[11px] font-bold text-slate-800 dark:text-white shadow-xs">
                  {formatCurrency(calculated.faturamento.total)}
                </div>
              </div>

              <div className="flex flex-col text-center">
                <span className="text-[10px] font-semibold text-slate-500 mb-1 truncate">Valor por veículo</span>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center text-[11px] font-bold text-slate-800 dark:text-white shadow-xs">
                  {formatCurrency(calculated.comissoes.valorPorVeiculo)}
                </div>
              </div>

              <div className="flex flex-col text-center">
                <span className="text-[10px] font-semibold text-slate-500 mb-1 truncate">Total comissão</span>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center text-[11px] font-bold text-slate-800 dark:text-white shadow-xs">
                  {formatCurrency(calculated.comissoes.total)}
                </div>
              </div>
            </div>
          </div>

          {/* Card Direito: Caixa com Borda Tracejada da Fórmula */}
          <div className="lg:col-span-3 border border-dashed border-amber-300 dark:border-amber-700/60 rounded-2xl p-3.5 bg-amber-50/30 dark:bg-amber-950/20 flex flex-col justify-center text-xs text-slate-600 dark:text-slate-300">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Na base da comissão:
            </span>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              {calculated.comissoes.vehicleCount} veículos × {formatCurrency(calculated.comissoes.valorPorVeiculo)}
            </div>
            <div className="font-black text-amber-700 dark:text-amber-300 mt-1">
              = {formatCurrency(calculated.comissoes.total)}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. SEÇÃO 4: RESULTADO (3 CARDS DESTACADOS)                 */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
            Resultado
          </h2>
        </div>

        {/* 3 Grandes Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-2">
          
          {/* Card 1: Total pg Adiantamento */}
          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                A
              </div>
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Total pg Adiantamento
                </span>
                <div className="bg-white dark:bg-slate-800 px-3.5 py-1.5 rounded-xl font-black text-base text-slate-900 dark:text-white shadow-xs mt-1 inline-block">
                  {formatCurrency(calculated.resultado.pgAdiantamento)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                {formatPercent(calculated.resultado.percAdiantamento)}
              </span>
            </div>
          </div>

          {/* Card 2: Total pg Saldo */}
          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Total pg Saldo
                </span>
                <div className="bg-white dark:bg-slate-800 px-3.5 py-1.5 rounded-xl font-black text-base text-slate-900 dark:text-white shadow-xs mt-1 inline-block">
                  {formatCurrency(calculated.resultado.pgSaldo)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                {formatPercent(calculated.resultado.percSaldo)}
              </span>
            </div>
          </div>

          {/* Card 3: Total Adiantamento e Saldo */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 block">
                  Total Adiantamento e Saldo
                </span>
                <div className="bg-white dark:bg-slate-800 px-3.5 py-1.5 rounded-xl font-black text-base text-emerald-800 dark:text-emerald-300 shadow-xs mt-1 inline-block">
                  {formatCurrency(calculated.resultado.adiantamentoESaldo)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                {formatPercent(calculated.resultado.percTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 6. EXPANSÍVEL: DEMONSTRAÇÃO ANALÍTICA DRE VERTICAL         */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm">
        <button
          onClick={() => setShowDetailedDre(!showDetailedDre)}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Demonstração Analítica da Margem de Contribuição (DRE Vertical Detalhada)
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {filteredShipments.length} embarques no período
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
            <span>{showDetailedDre ? 'Ocultar' : 'Expandir'}</span>
            {showDetailedDre ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showDetailedDre && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {/* 1. Faturamento Bruto */}
            <div className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                <span className="font-bold text-slate-900 dark:text-white">(+) Faturamento Bruto de Fretes (Empresa)</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400">100.0%</span>
                <span className="font-black text-slate-900 dark:text-white w-32 text-right">
                  {formatCurrency(calculated.faturamento.total)}
                </span>
              </div>
            </div>

            {/* 2. Impostos Diretos */}
            <div className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 pl-3">
                <span className="text-rose-500 font-bold">(-)</span>
                <span className="text-slate-600 dark:text-slate-300">Impostos Diretos (ICMS, PIS/COFINS, Retenções)</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-rose-500 font-semibold">
                  {formatPercent(calculated.faturamento.total > 0 ? (calculated.impostosCustos.total / calculated.faturamento.total) * 100 : 0)}
                </span>
                <span className="font-bold text-rose-600 w-32 text-right">
                  - {formatCurrency(calculated.impostosCustos.total)}
                </span>
              </div>
            </div>

            {/* 3. Fretes Pagos aos Motoristas */}
            <div className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 pl-3">
                <span className="text-rose-500 font-bold">(-)</span>
                <span className="text-slate-600 dark:text-slate-300">Frete Pago aos Motoristas (Adiantamento + Saldo)</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-rose-500 font-semibold">
                  {formatPercent(calculated.faturamento.total > 0 ? (calculated.resultado.adiantamentoESaldo / calculated.faturamento.total) * 100 : 0)}
                </span>
                <span className="font-bold text-rose-600 w-32 text-right">
                  - {formatCurrency(calculated.resultado.adiantamentoESaldo)}
                </span>
              </div>
            </div>

            {/* 4. Pedágios */}
            <div className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 pl-3">
                <span className="text-rose-500 font-bold">(-)</span>
                <span className="text-slate-600 dark:text-slate-300">Pedágios Pagos na Operação</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-rose-500 font-semibold">
                  {formatPercent(calculated.faturamento.total > 0 ? (calculated.impostosCustos.pedagio / calculated.faturamento.total) * 100 : 0)}
                </span>
                <span className="font-bold text-rose-600 w-32 text-right">
                  - {formatCurrency(calculated.impostosCustos.pedagio)}
                </span>
              </div>
            </div>

            {/* 5. Comissões Operacionais */}
            <div className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 pl-3">
                <span className="text-rose-500 font-bold">(-)</span>
                <span className="text-slate-600 dark:text-slate-300">Total de Comissões e Representações</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-rose-500 font-semibold">
                  {formatPercent(calculated.comissoes.percentSobreFat)}
                </span>
                <span className="font-bold text-rose-600 w-32 text-right">
                  - {formatCurrency(calculated.comissoes.total)}
                </span>
              </div>
            </div>

            {/* 6. Margem de Contribuição Final */}
            <div className="py-3 flex items-center justify-between text-xs bg-emerald-50/60 dark:bg-emerald-950/20 px-2 rounded-xl mt-1">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">✓</div>
                <span className="font-black text-emerald-950 dark:text-emerald-100">
                  (=) 1º RESULTADO: Margem de Contribuição Operacional
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-full">
                  {formatPercent(calculated.margemBruta.percent)}
                </span>
                <span className="font-black text-emerald-800 dark:text-emerald-200 text-sm w-32 text-right">
                  {formatCurrency(calculated.margemBruta.value)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
