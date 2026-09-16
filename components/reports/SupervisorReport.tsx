import React, { useMemo } from 'react';
import type { Shipment, User, Cargo, Branch } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { UsersIcon } from '../icons/UsersIcon';
import { StayRecord } from '../../utils/toolStorage';
import { calculateShipmentExpenses } from '../../utils/operationalExpensesCalculator';
import { getShipmentCte, isCteApplicableForStatus, isStayForShipment } from '../../utils';
import { Building2, CheckCircle2, XCircle, TrendingUp, ShieldCheck, Briefcase, Percent, Users, UserCheck } from 'lucide-react';

interface CommercialReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
  branches?: Branch[];
  stays?: StayRecord[];
  onSaveUser?: (user: User) => void;
  currentUser?: User | null;
}

const StatCard: React.FC<{ 
  title: string; 
  value: number; 
  subtitle?: string; 
  icon: React.ReactElement; 
  subtitleColor?: string;
  isCurrency?: boolean;
}> = ({ 
  title, 
  value, 
  subtitle, 
  icon,
  subtitleColor = "text-blue-600 dark:text-blue-400",
  isCurrency = true
}) => {
  return (
    <div className="flex flex-col justify-between p-5 bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider leading-snug">{title}</p>
          <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1.5">
            {isCurrency ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : `${value} ${value === 1 ? 'embarque' : 'embarques'}`}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/50 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      {subtitle && (
        <div className={`mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs font-semibold ${subtitleColor}`}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

const SupervisorReport: React.FC<CommercialReportProps> = ({ 
  shipments, 
  cargos, 
  users, 
  branches = [], 
  stays = [],
  currentUser
}) => {
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);
  const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b])), [branches]);
  const userBranchMap = useMemo(() => new Map(users.map(u => [u.id, u.branchId])), [users]);
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  // Contexto do Usuário Logado
  const isCurrentUserAgenciador = currentUser?.profile === UserProfile.Agenciador;

  // Se o usuário logado for agenciador de embarque, ele tem um líder; se for líder, ele é o próprio líder
  const effectiveLeaderId = useMemo(() => {
    if (!currentUser) return undefined;
    if (currentUser.profile === UserProfile.Agenciador && currentUser.agencyRole === 'embarque' && currentUser.agencyLeaderId) {
      return currentUser.agencyLeaderId;
    }
    return currentUser.id;
  }, [currentUser]);

  const leaderUser = useMemo(() => {
    if (!effectiveLeaderId) return currentUser;
    return userMap.get(effectiveLeaderId) || currentUser;
  }, [effectiveLeaderId, userMap, currentUser]);

  // Operadores de embarque vinculados a este líder
  const teamOperators = useMemo(() => {
    if (!effectiveLeaderId) return [];
    return users.filter(u => 
      u.profile === UserProfile.Agenciador && 
      u.agencyRole === 'embarque' && 
      u.agencyLeaderId === effectiveLeaderId
    );
  }, [effectiveLeaderId, users]);

  // Identificar filial Matriz e demais filiais
  const matrizBranch = useMemo(() => {
    return branches.find(b => b.name.toLowerCase().includes('matriz')) || branches[0];
  }, [branches]);

  const nonMatrizBranches = useMemo(() => {
    return branches.filter(b => !b.name.toLowerCase().includes('matriz'));
  }, [branches]);

  // Mapear faturamento bruto e líquido (margem) por filial
  const { 
    fatBrutoMatriz, 
    fatLiquidoMatriz, 
    branchGrossMap, 
    branchNetMap, 
    totalFiliaisGross
  } = useMemo(() => {
    let grossMatriz = 0;
    let netMatriz = 0;

    const grossMap = new Map<string, number>();
    const netMap = new Map<string, number>();

    const countableStatuses = [
      ShipmentStatus.AguardandoSeguradora,
      ShipmentStatus.PreCadastro,
      ShipmentStatus.AguardandoCarregamento,
      ShipmentStatus.AguardandoNota,
      ShipmentStatus.AguardandoFiscal,
      ShipmentStatus.AguardandoAdiantamento,
      ShipmentStatus.AguardandoAgendamento,
      ShipmentStatus.AguardandoDescarga,
      ShipmentStatus.AguardandoPagamentoSaldo,
      ShipmentStatus.Finalizado
    ];

    shipments.forEach(s => {
      if (!countableStatuses.includes(s.status) || s.status === ShipmentStatus.Cancelado || !isCteApplicableForStatus(s.status)) return;

      const cteVal = getShipmentCte(s);
      const hasCte = cteVal !== '-' && cteVal.trim() !== '';

      if (!hasCte) return;
      
      const cargo = cargoMap.get(s.cargoId);

      const expenses = calculateShipmentExpenses(s, cargo);

      const shipmentStays = stays.filter(stay => isStayForShipment(stay, s));
      const demurrageRevenue = shipmentStays.reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);
      const demurrageProfit = shipmentStays.reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
        
      const shipmentGrossRevenue = expenses.companyFreight + demurrageRevenue;
      const shipmentNetRevenue = expenses.netProfit + demurrageProfit;

      // Resolução de Filial em cascata
      const effectiveBranchId = s.branchId || (s.createdById ? userBranchMap.get(s.createdById) : undefined) || cargo?.branchId || (cargo?.createdById ? userBranchMap.get(cargo.createdById) : undefined);

      const branchObj = effectiveBranchId ? branchMap.get(effectiveBranchId) : null;
      const isMatriz = branchObj 
        ? branchObj.name.toLowerCase().includes('matriz') 
        : (matrizBranch && effectiveBranchId === matrizBranch.id);

      if (isMatriz) {
        grossMatriz += shipmentGrossRevenue;
        netMatriz += shipmentNetRevenue;
      } else if (effectiveBranchId) {
        grossMap.set(effectiveBranchId, (grossMap.get(effectiveBranchId) || 0) + shipmentGrossRevenue);
        netMap.set(effectiveBranchId, (netMap.get(effectiveBranchId) || 0) + shipmentNetRevenue);
      } else {
        grossMatriz += shipmentGrossRevenue;
        netMatriz += shipmentNetRevenue;
      }
    });

    let totalFilGross = 0;
    grossMap.forEach(val => { totalFilGross += val; });

    let totalFilNet = 0;
    netMap.forEach(val => { totalFilNet += val; });

    return {
      fatBrutoMatriz: grossMatriz,
      fatLiquidoMatriz: netMatriz,
      branchGrossMap: grossMap,
      branchNetMap: netMap,
      totalFiliaisGross: totalFilGross,
      totalFiliaisNet: totalFilNet
    };
  }, [shipments, cargoMap, stays, branchMap, matrizBranch, userBranchMap]);

  // Default rates
  const DEFAULT_FIXED = 5000;
  const DEFAULT_MATRIZ_RATE = 0.20; // 0.20%
  const DEFAULT_FILIAIS_RATE = 0.10; // 0.10%

  const comissaoMatrizDefault = fatBrutoMatriz * (DEFAULT_MATRIZ_RATE / 100);
  const comissaoFiliaisDefault = totalFiliaisGross * (DEFAULT_FILIAIS_RATE / 100);
  const comissaoTotalCalculadaDefault = DEFAULT_FIXED + comissaoMatrizDefault + comissaoFiliaisDefault;

  // Função auxiliar para obter o ID do Agenciador Líder / Agência responsável por um usuário
  const getLeaderIdForUser = (userId?: string): string | undefined => {
    if (!userId) return undefined;
    const user = userMap.get(userId);
    if (!user) {
      const userByName = users.find(u => 
        u.name.toLowerCase() === userId.toLowerCase() || 
        u.email?.toLowerCase() === userId.toLowerCase()
      );
      if (userByName) {
        if (userByName.agencyRole === 'embarque' && userByName.agencyLeaderId) {
          return userByName.agencyLeaderId;
        }
        if (userByName.agencyLeaderId) {
          return userByName.agencyLeaderId;
        }
        return userByName.id;
      }
      return undefined;
    }
    if (user.agencyRole === 'embarque' && user.agencyLeaderId) {
      return user.agencyLeaderId;
    }
    if (user.agencyLeaderId) {
      return user.agencyLeaderId;
    }
    return user.id;
  };

  // Filtrar usuários comerciais e agenciadores líderes
  const commercialUsers = useMemo(() => {
    return users.filter(u => {
      if (u.profile === UserProfile.Demonstracao || (u.profile as string) === 'Demo' || u.name?.toUpperCase().includes('DEMO')) {
        return false;
      }
      // Agenciador de Embarque não aparece como linha individual na tabela principal de agências
      if (u.profile === UserProfile.Agenciador && u.agencyRole === 'embarque') {
        return false;
      }
      return (
        u.hasCommercialCommission === true || 
        u.profile === UserProfile.GerenteComercial || 
        u.profile === UserProfile.Comercial ||
        u.profile === UserProfile.Supervisor ||
        u.profile === UserProfile.Agenciador
      );
    });
  }, [users]);

  const activeCommissionUsers = useMemo(() => {
    return commercialUsers.filter(u => 
      u.hasCommercialCommission === true || 
      u.profile === UserProfile.GerenteComercial ||
      u.profile === UserProfile.Agenciador
    );
  }, [commercialUsers]);

  // Lista de usuários comerciais visíveis na tabela principal
  const displayedCommercialUsers = useMemo(() => {
    if (isCurrentUserAgenciador) {
      // Agenciador vê apenas o seu próprio registro (líder) consolidado com sua agência
      return commercialUsers.filter(u => u.id === effectiveLeaderId || u.id === currentUser?.id);
    }
    return commercialUsers;
  }, [commercialUsers, isCurrentUserAgenciador, effectiveLeaderId, currentUser]);

  // Mapear contagem de usuários por agência / filial para divisão da comissão no modo Agência
  const agencyMemberCountsMap = useMemo(() => {
    const counts = new Map<string, number>();

    activeCommissionUsers.forEach(u => {
      if (!u.commercialIsAgencyMode) return;
      const selectedBranches = u.commercialSelectedBranchIds || nonMatrizBranches.map(b => b.id);
      
      // Chave baseada no grupo de filiais da agência
      const agencyKey = selectedBranches.sort().join('|') || (u.branchId || 'default');
      counts.set(agencyKey, (counts.get(agencyKey) || 0) + 1);
    });

    return counts;
  }, [activeCommissionUsers, nonMatrizBranches]);

  // Mapear Lucro Real Total, Comissão de Agenciamento e Contagem de Embarques por Agência/Agenciador Líder e por Operador Individual
  const { 
    userAgencyProfitMap, 
    userAgencyCommissionMap, 
    userAgencyShipmentCountMap,
    memberProfitMap,
    memberCommissionMap,
    memberShipmentCountMap
  } = useMemo(() => {
    const commMap = new Map<string, number>();
    const profitMap = new Map<string, number>();
    const countMap = new Map<string, number>();

    const memProfit = new Map<string, number>();
    const memComm = new Map<string, number>();
    const memCount = new Map<string, number>();
    
    shipments.forEach(s => {
      if (s.status === ShipmentStatus.Cancelado || !isCteApplicableForStatus(s.status)) return;
      
      const cteVal = getShipmentCte(s);
      const hasCte = Boolean(cteVal && cteVal !== '-' && cteVal.trim() !== '');
      if (!hasCte) return;

      const cargo = cargoMap.get(s.cargoId);
      const expenses = calculateShipmentExpenses(s, cargo);
      const shipmentStays = stays.filter(stay => isStayForShipment(stay, s));
      const demurrageProfit = shipmentStays.reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
      const opProfit = expenses.netProfit + demurrageProfit;

      // Identificar o Agenciador Líder / Agência responsável por este frete (direto ou via operador vinculado)
      let targetLeaderId = getLeaderIdForUser(s.embarcadorId) || 
                           getLeaderIdForUser(s.createdById) || 
                           (cargo?.createdById ? getLeaderIdForUser(cargo.createdById) : undefined);

      if (!targetLeaderId && s.agencyCommissionAgencyName) {
        const matchedUser = users.find(u => 
          u.name.toLowerCase() === s.agencyCommissionAgencyName?.toLowerCase() ||
          s.agencyCommissionAgencyName?.toLowerCase().includes(u.name.toLowerCase()) ||
          u.email?.toLowerCase() === s.agencyCommissionAgencyName?.toLowerCase()
        );
        if (matchedUser) {
          targetLeaderId = getLeaderIdForUser(matchedUser.id);
        }
      }

      if (!targetLeaderId && s.branchId) {
        const matchedLeaderByBranch = users.find(u => 
          u.profile === UserProfile.Agenciador && 
          u.agencyRole !== 'embarque' && 
          u.branchId === s.branchId
        );
        if (matchedLeaderByBranch) {
          targetLeaderId = matchedLeaderByBranch.id;
        }
      }

      if (!targetLeaderId) return;

      const leader = userMap.get(targetLeaderId);

      // Soma do Lucro Real e Contagem da Agência Líder
      profitMap.set(targetLeaderId, (profitMap.get(targetLeaderId) || 0) + opProfit);
      countMap.set(targetLeaderId, (countMap.get(targetLeaderId) || 0) + 1);

      // Comissão de agenciamento
      const isAgencyEnabled = s.agencyCommissionEnabled !== false && (s.agencyCommissionEnabled === true || Boolean(leader?.profile === UserProfile.Agenciador));
      let calculatedCommVal = 0;
      if (isAgencyEnabled) {
        const pct = s.agencyCommissionPercentage !== undefined 
          ? s.agencyCommissionPercentage 
          : (leader?.agencyCommissionPercentage ?? 30);
        calculatedCommVal = opProfit > 0 ? Number((opProfit * (pct / 100)).toFixed(2)) : 0;
        commMap.set(targetLeaderId, (commMap.get(targetLeaderId) || 0) + calculatedCommVal);
      }

      // Registro individual para o membro/operador que fez o embarque
      const directOperatorId = s.embarcadorId || s.createdById || cargo?.createdById;
      if (directOperatorId) {
        memProfit.set(directOperatorId, (memProfit.get(directOperatorId) || 0) + opProfit);
        memCount.set(directOperatorId, (memCount.get(directOperatorId) || 0) + 1);
        if (calculatedCommVal > 0) {
          memComm.set(directOperatorId, (memComm.get(directOperatorId) || 0) + calculatedCommVal);
        }
      }
    });

    return { 
      userAgencyCommissionMap: commMap, 
      userAgencyProfitMap: profitMap, 
      userAgencyShipmentCountMap: countMap,
      memberProfitMap: memProfit,
      memberCommissionMap: memComm,
      memberShipmentCountMap: memCount
    };
  }, [shipments, cargoMap, stays, users, userMap]);

  // Total geral de comissões de agenciamento em todos os fretes (para visão executiva)
  const totalGlobalAgencyCommission = useMemo(() => {
    let sum = 0;
    userAgencyCommissionMap.forEach(val => { sum += val; });
    return sum;
  }, [userAgencyCommissionMap]);

  // Valores consolidados para o Agenciador logado
  const currentAgencyShipmentCount = effectiveLeaderId ? (userAgencyShipmentCountMap.get(effectiveLeaderId) || 0) : 0;
  const currentAgencyProfit = effectiveLeaderId ? (userAgencyProfitMap.get(effectiveLeaderId) || 0) : 0;
  const currentAgencyCommission = effectiveLeaderId ? (userAgencyCommissionMap.get(effectiveLeaderId) || 0) : 0;

  return (
    <div className="space-y-6">
      {/* HEADER TITLE */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border shadow-sm ${
        isCurrentUserAgenciador 
          ? 'bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 border-purple-800/40'
          : 'bg-gradient-to-r from-blue-900/40 via-slate-900 to-slate-900 border-blue-800/40'
      }`}>
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Briefcase className={`w-7 h-7 ${isCurrentUserAgenciador ? 'text-purple-400' : 'text-blue-400'}`} />
            {isCurrentUserAgenciador ? 'Meu Relatório Comercial & Agenciamento' : 'Relatório Comercial & Agenciamento'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {isCurrentUserAgenciador 
              ? `Visualização restrita ao resultado da sua agência e equipe vinculada (${leaderUser?.name || currentUser?.name}).`
              : 'Desempenho consolidado de faturamento, comissões ativas e lucro real por membro comercial e agenciador.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isCurrentUserAgenciador ? (
            <div className="flex items-center gap-2 bg-purple-950/80 px-4 py-2 rounded-xl border border-purple-700/50 text-xs font-semibold text-purple-200">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Agência: <b>{leaderUser?.name}</b> ({leaderUser?.agencyCommissionPercentage ?? 30}%)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-blue-950/80 px-4 py-2 rounded-xl border border-blue-700/50 text-xs font-semibold text-blue-200">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Matriz Principal: <b>{matrizBranch?.name || 'MATRIZ'}</b></span>
            </div>
          )}
        </div>
      </div>

      {/* STAT CARDS KPI */}
      {isCurrentUserAgenciador ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            title="Embarques da Agência / Equipe" 
            subtitle={teamOperators.length > 0 ? `Consolidando Líder + ${teamOperators.length} operador(es)` : 'Total de embarques com CTE'}
            value={currentAgencyShipmentCount} 
            isCurrency={false}
            icon={<Briefcase className="w-6 h-6 text-purple-500 dark:text-purple-400"/>} 
            subtitleColor="text-purple-600 dark:text-purple-300 font-bold"
          />

          <StatCard 
            title="Lucro Real Total Gerado" 
            subtitle="Base de cálculo da comissão de agenciamento"
            value={currentAgencyProfit} 
            icon={<TrendingUp className="w-6 h-6 text-emerald-500 dark:text-emerald-400"/>} 
            subtitleColor="text-emerald-600 dark:text-emerald-300 font-bold"
          />

          <StatCard 
            title="Comissão a Receber" 
            subtitle={`Taxa de comissão: ${leaderUser?.agencyCommissionPercentage ?? 30}% sobre o lucro real`}
            value={currentAgencyCommission} 
            icon={<ShieldCheck className="w-6 h-6 text-emerald-500 dark:text-emerald-400"/>} 
            subtitleColor="text-emerald-600 dark:text-emerald-300 font-bold"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            title="Faturamento Matriz" 
            subtitle={`Comissão (0,20%): ${comissaoMatrizDefault.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            value={fatBrutoMatriz} 
            icon={<Building2 className="w-6 h-6 text-blue-500 dark:text-blue-400"/>} 
            subtitleColor="text-blue-600 dark:text-blue-300 font-bold"
          />

          <StatCard 
            title="Faturamento Filiais" 
            subtitle={`Comissão (0,10%): ${comissaoFiliaisDefault.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            value={totalFiliaisGross} 
            icon={<TrendingUp className="w-6 h-6 text-indigo-500 dark:text-indigo-400"/>} 
            subtitleColor="text-indigo-600 dark:text-indigo-300 font-bold"
          />

          <StatCard 
            title="Comissão Total Comercial & Agências" 
            subtitle={`Comissões Gerência + Agenciamentos (${totalGlobalAgencyCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`}
            value={comissaoTotalCalculadaDefault + totalGlobalAgencyCommission} 
            icon={<ShieldCheck className="w-6 h-6 text-emerald-500 dark:text-emerald-400"/>} 
            subtitleColor="text-emerald-600 dark:text-emerald-300 font-bold"
          />
        </div>
      )}

      {/* TABELA DE RESULTADOS DO COMERCIAL / AGENCIADOR */}
      <div className="bg-white dark:bg-gray-800/90 rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-700/80 overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700/80 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {isCurrentUserAgenciador ? 'Resultado Consolidado da Agência' : 'Equipe Comercial, Agenciadores e Gerentes'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isCurrentUserAgenciador
                ? 'Desempenho consolidado de faturamento, lucro real e comissão da agência.'
                : 'Desempenho consolidado de faturamento, comissões ativas e lucro real por membro comercial e agenciador.'}
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-full">
            {isCurrentUserAgenciador ? '1 agência ativa' : `${activeCommissionUsers.length} comissão(ões) ativa(s)`}
          </span>
        </div>

        {displayedCommercialUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 font-medium">
            Nenhum resultado de agenciamento ou comissão encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 uppercase font-semibold">
                <tr>
                  <th className="p-4">Usuário / Perfil</th>
                  <th className="p-4">Modalidade / Base</th>
                  <th className="p-4">Status Comissão</th>
                  <th className="p-4">Fixo (R$)</th>
                  <th className="p-4">Comissões (%)</th>
                  <th className="p-4 text-right">Valor a Receber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                {displayedCommercialUsers.map(user => {
                  const isAgenciador = user.profile === UserProfile.Agenciador;
                  const isActive = user.hasCommercialCommission === true || user.profile === UserProfile.GerenteComercial || isAgenciador;

                  const totalAgencyShipmentComm = userAgencyCommissionMap.get(user.id) || 0;
                  const totalAgencyShipmentProfit = userAgencyProfitMap.get(user.id) || 0;
                  const agencyShipmentCount = userAgencyShipmentCountMap.get(user.id) || 0;

                  const userFixed = user.commercialFixedSalary !== undefined 
                    ? user.commercialFixedSalary 
                    : (isAgenciador ? 0 : DEFAULT_FIXED);

                  const userMatrizRate = user.commercialMatrizRate !== undefined 
                    ? user.commercialMatrizRate 
                    : (isAgenciador ? 0 : DEFAULT_MATRIZ_RATE);

                  const userFiliaisRate = user.commercialFiliaisRate !== undefined 
                    ? user.commercialFiliaisRate 
                    : (isAgenciador ? 0 : DEFAULT_FILIAIS_RATE);

                  const calcMode = user.commercialCalculationMode || 'bruto';
                  const isAgencyMode = user.commercialIsAgencyMode || isAgenciador;

                  // Filiais selecionadas para este usuário
                  const userSelectedBranchIds = user.commercialSelectedBranchIds || nonMatrizBranches.map(b => b.id);

                  // Calcular membros da agência para divisão da comissão
                  const agencyKey = userSelectedBranchIds.sort().join('|') || (user.branchId || 'default');
                  const agencyMembersCount = agencyMemberCountsMap.get(agencyKey) || 1;

                  // Fator de divisão da agência
                  let shareFactor = 1;
                  if (isAgencyMode && !isAgenciador) {
                    if (user.commercialAgencySharePercent !== undefined && user.commercialAgencySharePercent > 0) {
                      shareFactor = user.commercialAgencySharePercent / 100;
                    } else {
                      shareFactor = 1 / Math.max(1, agencyMembersCount);
                    }
                  }

                  // Escolher entre Bruto e Líquido (Margem)
                  const targetMatrizRevenue = calcMode === 'liquido' ? fatLiquidoMatriz : fatBrutoMatriz;
                  const targetBranchRevenueMap = calcMode === 'liquido' ? branchNetMap : branchGrossMap;

                  // Calcular faturamento das filiais selecionadas
                  const userFiliaisRevenue = userSelectedBranchIds.reduce((sum, bId) => sum + (targetBranchRevenueMap.get(bId) || 0), 0);

                  // Taxas efetivas após divisão da agência
                  const effectiveMatrizRate = userMatrizRate * (isAgencyMode ? shareFactor : 1);
                  const effectiveFiliaisRate = userFiliaisRate * (isAgencyMode ? shareFactor : 1);

                  const matrizForUser = (isActive && effectiveMatrizRate > 0) ? targetMatrizRevenue * (effectiveMatrizRate / 100) : 0;
                  const filiaisForUser = (isActive && effectiveFiliaisRate > 0) ? userFiliaisRevenue * (effectiveFiliaisRate / 100) : 0;
                  const totalCommissionsForUser = isAgenciador 
                    ? (totalAgencyShipmentComm + (user.hasCommercialCommission ? matrizForUser : 0))
                    : (matrizForUser + filiaisForUser);
                  const totalForUser = isActive ? (userFixed + totalCommissionsForUser) : 0;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${
                            isAgenciador 
                              ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                              : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                          }`}>
                            <UsersIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white text-sm">{user.name}</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 flex-wrap">
                              <span>{user.email} •</span>
                              <span className={`font-semibold ${isAgenciador ? 'text-purple-600 dark:text-purple-400' : 'text-blue-500'}`}>
                                {isAgenciador ? 'Agenciador Líder' : user.profile}
                              </span>
                              {isAgenciador && (() => {
                                const teamCount = users.filter(u => u.profile === UserProfile.Agenciador && u.agencyRole === 'embarque' && u.agencyLeaderId === user.id).length;
                                return teamCount > 0 ? (
                                  <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 rounded font-bold" title={`Equipe com ${teamCount} agenciador(es) de embarque vinculados`}>
                                    +{teamCount} {teamCount === 1 ? 'operador' : 'operadores'}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* MODALIDADE E TIPO DE BASE */}
                      <td className="p-4 font-bold space-y-1">
                        <div className="flex flex-col gap-1 items-start">
                          {isAgenciador ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 text-[10px] uppercase font-extrabold border border-purple-300 dark:border-purple-800">
                              <Users className="w-3 h-3" /> Agenciador ({user.agencyCommissionPercentage ?? 30}%)
                            </span>
                          ) : isAgencyMode ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 text-[10px] uppercase font-extrabold border border-purple-300 dark:border-purple-800">
                              <Users className="w-3 h-3" /> Agência ({ (shareFactor * 100).toFixed(0) }% pool)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-[10px] uppercase font-bold">
                              Individual
                            </span>
                          )}

                          {calcMode === 'liquido' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 text-[10px] uppercase font-bold border border-indigo-200 dark:border-indigo-800">
                              <Percent className="w-3 h-3" /> Líquido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 text-[10px] uppercase font-bold border border-blue-200 dark:border-blue-800">
                              Bruto
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Comissão Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-[11px] font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            Sem Comissão
                          </span>
                        )}
                      </td>

                      {/* FIXO (R$) */}
                      <td className="p-4 font-mono font-medium">
                        {isActive ? (
                          <span>{userFixed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        ) : (
                          <span className="text-gray-400">R$ 0,00</span>
                        )}
                      </td>

                      {/* COMISSÕES (%) */}
                      <td className="p-4 font-mono">
                        {isAgenciador ? (
                          <div>
                            <span className="font-bold text-purple-600 dark:text-purple-400">
                              Agenciamento ({user.agencyCommissionPercentage ?? 30}%)
                            </span>
                            <div className="text-[11px] text-gray-900 dark:text-gray-100 font-bold">
                              {totalAgencyShipmentComm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            <div className="text-[10px] text-gray-400 font-sans">
                              Comissão s/ Lucro Real ({totalAgencyShipmentProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                            </div>
                            {effectiveMatrizRate > 0 && (
                              <div className="text-[10px] text-blue-500 font-sans">
                                + Matriz ({effectiveMatrizRate.toFixed(2)}%): {matrizForUser.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </div>
                            )}
                          </div>
                        ) : isActive ? (
                          <div>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              Total: {totalCommissionsForUser.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <div className="text-[10px] text-gray-500 font-sans mt-0.5">
                              Matriz ({effectiveMatrizRate.toFixed(2)}%): {matrizForUser.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            {effectiveFiliaisRate > 0 && (
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-sans">
                                + Filiais ({effectiveFiliaisRate.toFixed(2)}%): {filiaisForUser.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </div>
                            )}
                          </div>
                        ) : 'R$ 0,00'}
                      </td>

                      {/* VALOR A RECEBER */}
                      <td className="p-4 text-right font-mono font-black text-sm">
                        {isActive ? (
                          <div className="flex flex-col items-end">
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              {totalForUser.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            {isAgenciador ? (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-sans font-medium">
                                {agencyShipmentCount} {agencyShipmentCount === 1 ? 'embarque' : 'embarques'}
                                {(() => {
                                  const teamCount = users.filter(u => u.profile === UserProfile.Agenciador && u.agencyRole === 'embarque' && u.agencyLeaderId === user.id).length;
                                  return teamCount > 0 ? ` (+${teamCount} op.)` : '';
                                })()}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-sans font-medium">
                                Fixo + Comissões Matriz e Filiais
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">R$ 0,00</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TABELA DE OPERADORES DA EQUIPE (SE HOUVER) */}
      {isCurrentUserAgenciador && teamOperators.length > 0 && (
        <div className="bg-white dark:bg-gray-800/90 rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-700/80 overflow-hidden animate-fade-in">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700/80 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Operadores Vinculados à Agência ({teamOperators.length})
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Detalhamento dos operadores de embarque que integram sua equipe e cujos resultados consolidam na sua agência.
              </p>
            </div>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold text-xs rounded-full border border-purple-300 dark:border-purple-800">
              {teamOperators.length} operador(es) ativo(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 uppercase font-semibold">
                <tr>
                  <th className="p-4">Operador</th>
                  <th className="p-4">Papel / Função</th>
                  <th className="p-4 text-center">Embarques com CTE</th>
                  <th className="p-4 text-right">Lucro Real Gerado</th>
                  <th className="p-4 text-right">Comissão Gerada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                {teamOperators.map(op => {
                  const opCount = memberShipmentCountMap.get(op.id) || 0;
                  const opProfit = memberProfitMap.get(op.id) || 0;
                  const opComm = memberCommissionMap.get(op.id) || 0;

                  return (
                    <tr key={op.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-900 dark:text-white text-sm">{op.name}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{op.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 text-[10px] uppercase font-bold border border-purple-300 dark:border-purple-800">
                          Agenciador de Embarque
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold text-sm">
                        {opCount} {opCount === 1 ? 'embarque' : 'embarques'}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {opProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                        {opComm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorReport;
