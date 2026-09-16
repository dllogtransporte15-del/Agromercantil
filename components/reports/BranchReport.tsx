import React, { useMemo } from 'react';
import type { Shipment, Cargo, Branch, User } from '../../types';
import { ShipmentStatus } from '../../types';
import { Building2, TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';

import type { StayRecord } from '../../utils/toolStorage';
import { calculateShipmentExpenses } from '../../utils/operationalExpensesCalculator';
import { getShipmentCte, isCteApplicableForStatus, isStayForShipment } from '../../utils';

interface BranchReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  branches: Branch[];
  users: User[];
  stays?: StayRecord[];
}

const BranchReport: React.FC<BranchReportProps> = ({ shipments, cargos, branches, users, stays = [] }) => {
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);
  const userBranchMap = useMemo(() => new Map(users.map(u => [u.id, u.branchId])), [users]);

  const branchData = useMemo(() => {
    const statsMap = new Map(branches.map(b => [b.id, {
      ...b,
      shipmentCount: 0,
      totalWeight: 0,
      totalBilled: 0,
      totalMargin: 0,
      marginPercent: 0
    }]));

    shipments.forEach(s => {
      if (s.status === ShipmentStatus.Cancelado) return;

      const cteVal = getShipmentCte(s);
      const hasShipmentCte = Boolean(
        cteVal && cteVal !== '-' && cteVal.trim() !== '' && isCteApplicableForStatus(s.status)
      );

      const shipmentStays = stays.filter(stay => isStayForShipment(stay, s) && (stay.approvedValue || 0) > 0);
      const hasStayCte = shipmentStays.some(stay => stay.cteUrl);

      // Contabiliza apenas se tiver CT-e do embarque ou CT-e complementar de estadia
      if (!hasShipmentCte && !hasStayCte) return;

      const cargo = cargoMap.get(s.cargoId);
      if (!cargo) return;

      const effectiveBranchId = s.branchId || 
                                userBranchMap.get(s.embarcadorId) || 
                                userBranchMap.get(s.createdById) || 
                                cargo.branchId || 
                                userBranchMap.get(cargo.createdById);
      if (!effectiveBranchId) return;

      const stats = statsMap.get(effectiveBranchId);
      if (!stats) return;

      const expenses = calculateShipmentExpenses(s, cargo);
      
      const demurrageRevenue = shipmentStays
          .reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);
          
      const demurrageProfit = shipmentStays
          .reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
          
      const profit = hasShipmentCte ? (expenses.netProfit + demurrageProfit) : demurrageProfit;
      const revenue = hasShipmentCte ? (expenses.companyFreight + demurrageRevenue) : demurrageRevenue;

      if (hasShipmentCte) {
        stats.shipmentCount += 1;
        stats.totalWeight += s.shipmentTonnage || 0;
      }
      stats.totalBilled += revenue;
      stats.totalMargin += profit;
    });

    const result = Array.from(statsMap.values()).map(s => ({
      ...s,
      marginPercent: s.totalBilled > 0 ? (s.totalMargin / s.totalBilled) * 100 : 0
    }));

    return result.sort((a, b) => b.totalMargin - a.totalMargin);
  }, [shipments, branches, cargoMap]);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const totals = useMemo(() => {
    return branchData.reduce((acc, curr) => ({
      weight: acc.weight + curr.totalWeight,
      billed: acc.billed + curr.totalBilled,
      margin: acc.margin + curr.totalMargin,
      count: acc.count + curr.shipmentCount
    }), { weight: 0, billed: 0, margin: 0, count: 0 });
  }, [branchData]);

  const avgMargin = totals.billed > 0 ? (totals.margin / totals.billed) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary to-blue-700 p-5 rounded-2xl text-white shadow-lg shadow-primary/20">
          <p className="text-[10px] uppercase font-bold opacity-80 mb-1">Lucro Total Período</p>
          <h3 className="text-2xl font-black">{formatCurrency(totals.margin)}</h3>
          <div className="mt-2 flex items-center gap-2 text-xs opacity-90">
            <DollarSign className="w-3 h-3" />
            <span>Faturamento: {formatCurrency(totals.billed)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800/90 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-300 mb-1">Margem Média Geral</p>
          <h3 className={`text-2xl font-black ${avgMargin >= 10 ? 'text-emerald-500 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>{avgMargin.toFixed(1)}%</h3>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <TrendingUp className="w-3 h-3" />
            <span>Meta sugerida: 12.0%</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800/90 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-300 mb-1">Melhor Filial</p>
            <h3 className="text-lg font-bold text-primary dark:text-blue-400 truncate max-w-[120px]">{branchData[0]?.name || 'N/A'}</h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary dark:text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden transition-all duration-300">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700/80 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary dark:text-blue-400" />
                Desempenho por Filial
            </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200/60 dark:border-gray-700/60">
                <th className="px-6 py-4">Filial</th>
                <th className="px-6 py-4 text-center">Embarques</th>
                <th className="px-6 py-4 text-center">Peso Total</th>
                <th className="px-6 py-4 text-right">Faturamento Bruto</th>
                <th className="px-6 py-4 text-right">Margem Líquida</th>
                <th className="px-6 py-4 text-right">% Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {branchData.map((branch) => (
                <tr key={branch.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-primary dark:group-hover:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{branch.name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{branch.city} - {branch.state}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-semibold text-gray-800 dark:text-gray-200">{branch.shipmentCount}</td>
                  <td className="px-6 py-4 text-center font-semibold text-gray-800 dark:text-gray-200">
                    <div className="flex items-center justify-center gap-1">
                      <Package className="w-3.5 h-3.5 text-gray-400" />
                      {branch.totalWeight.toLocaleString('pt-BR')} <span className="text-[10px] font-normal text-gray-400">ton</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-700 dark:text-gray-300">{formatCurrency(branch.totalBilled)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-gray-900 dark:text-white">{formatCurrency(branch.totalMargin)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min(branch.marginPercent * 2.5, 100)}%` }}
                        />
                      </div>
                      <span className={`font-bold text-xs ${branch.marginPercent >= avgMargin ? 'text-emerald-500' : 'text-orange-500'}`}>
                        {branch.marginPercent.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[9px] text-right text-gray-400">
                      {branch.marginPercent >= avgMargin ? 'Acima da média' : 'Abaixo da média'}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BranchReport;
