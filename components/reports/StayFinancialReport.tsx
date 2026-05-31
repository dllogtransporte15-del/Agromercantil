import React, { useMemo } from 'react';
import type { StayRecord } from '../../services/api/toolsApi';
import { DollarSign, TrendingUp, TrendingDown, Scale, FileText, CheckCircle } from 'lucide-react';

interface StayFinancialReportProps {
  stays: StayRecord[];
}

const StayFinancialReport: React.FC<StayFinancialReportProps> = ({ stays }) => {
  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const stats = useMemo(() => {
    let totalRequested = 0;
    let totalApproved = 0;
    let totalPaid = 0;
    let totalProfit = 0;

    stays.forEach(stay => {
      totalRequested += stay.totalValue || 0;
      totalApproved += stay.approvedValue || 0;
      totalPaid += stay.driverPaidValue || 0;
      totalProfit += (stay.approvedValue || 0) - (stay.driverPaidValue || 0);
    });

    const marginPercent = totalApproved > 0 ? (totalProfit / totalApproved) * 100 : 0;

    return { totalRequested, totalApproved, totalPaid, totalProfit, marginPercent, count: stays.length };
  }, [stays]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-5 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
          <p className="text-[10px] uppercase font-bold opacity-80 mb-1 tracking-wider">Receita Total (Aprovado)</p>
          <h3 className="text-2xl font-black">{formatCurrency(stats.totalApproved)}</h3>
          <div className="mt-2 flex items-center gap-2 text-xs opacity-90">
            <DollarSign className="w-3 h-3" />
            <span>Solicitado: {formatCurrency(stats.totalRequested)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Custo Total (Pago Motorista)</p>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">{formatCurrency(stats.totalPaid)}</h3>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span>Baseado em {stats.count} estadias</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Lucro das Estadias</p>
          <h3 className={`text-2xl font-black ${stats.totalProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {formatCurrency(stats.totalProfit)}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span>Margem: {stats.marginPercent.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Média por Estadia</p>
            <h3 className="text-xl font-bold text-indigo-600">
              {formatCurrency(stats.count > 0 ? stats.totalProfit / stats.count : 0)}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Scale className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Detalhamento Financeiro de Estadias
            </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/20 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="px-6 py-4">Data / Cliente</th>
                <th className="px-6 py-4 text-center">Motorista / Placa</th>
                <th className="px-6 py-4 text-right">Solicitado</th>
                <th className="px-6 py-4 text-right">Aprovado</th>
                <th className="px-6 py-4 text-right">Pago</th>
                <th className="px-6 py-4 text-right">Lucro</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {stays.map((stay) => {
                const profit = (stay.approvedValue || 0) - (stay.driverPaidValue || 0);
                return (
                  <tr key={stay.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800 dark:text-gray-200">{new Date(stay.date).toLocaleDateString('pt-BR')}</p>
                      <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{stay.clientName || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="font-medium text-gray-700 dark:text-gray-300">{stay.driver}</p>
                      <p className="text-[10px] font-bold text-primary">{stay.plate}</p>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">{formatCurrency(stay.totalValue)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(stay.approvedValue || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-red-500">
                      {formatCurrency(stay.driverPaidValue || 0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-black ${profit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600'}`}>
                        {formatCurrency(profit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {(stay.approvedValue !== undefined && stay.approvedValue > 0) && (stay.driverPaidValue !== undefined && stay.driverPaidValue > 0) ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full uppercase">
                            <CheckCircle className="w-3 h-3" /> Finalizado
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-1 rounded-full uppercase">
                            Pendente
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {stays.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                    Nenhuma estadia encontrada para o período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StayFinancialReport;
