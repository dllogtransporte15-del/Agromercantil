import React, { useState, useMemo } from 'react';
import type { ThirdLevelFinancialResult } from '../../utils/financialCalculations';
import { calculateFirstResult, calculateSecondResult, calculateThirdResult } from '../../utils/financialCalculations';
import type { Shipment, Cargo, FinancialTransaction } from '../../types';
import { ShipmentStatus } from '../../types';
import { getFinancialPeriodRange, getShipmentEffectiveDate, parseDateToYmd, FinancialPeriodFilter } from '../../utils';
import { Target, TrendingUp, BarChart3, ArrowUpRight, ArrowDownLeft, ShieldCheck, CalendarClock } from 'lucide-react';

interface ThirdResultTabProps {
  data: ThirdLevelFinancialResult;
  shipments?: Shipment[];
  cargos?: Cargo[];
  transactions?: FinancialTransaction[];
}

export const ThirdResultTab: React.FC<ThirdResultTabProps> = ({ 
  data,
  shipments = [],
  cargos = [],
  transactions = []
}) => {
  const [periodFilter, setPeriodFilter] = useState<FinancialPeriodFilter>('mes');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Recalcula dinamicamente com base no período selecionado caso embarques estejam disponíveis
  const currentResult = useMemo(() => {
    if (!shipments || shipments.length === 0) return data;
    const { startDate, endDate } = getFinancialPeriodRange(periodFilter);

    const validShipments = shipments.filter(s => {
      if (s.status === ShipmentStatus.Cancelado) return false;
      const sDate = getShipmentEffectiveDate(s) || (s.scheduledDate ? parseDateToYmd(s.scheduledDate) : null) || s.createdAt?.split('T')[0];
      if (!sDate) return false;
      return sDate >= startDate && sDate <= endDate;
    });

    const validTransactions = (transactions || []).filter(t => {
      if (t.status === 'Cancelado') return false;
      const tDate = t.paymentDate || t.dueDate || t.createdAt?.split('T')[0];
      if (!tDate) return false;
      return tDate >= startDate && tDate <= endDate;
    });

    const first = calculateFirstResult(validShipments, cargos || []);
    const second = calculateSecondResult(first, validTransactions);
    return calculateThirdResult(second, validTransactions);
  }, [data, shipments, cargos, transactions, periodFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-400">
              Visão Estratégica, EBITDA & Projeções
            </span>
            <h2 className="text-2xl font-black mt-1">3º Resultado Financeiro</h2>
            <p className="text-sm text-emerald-200/90 mt-1 max-w-2xl">
              Resultado Líquido Final da empresa após receitas e despesas financeiras, margens estratégicas de lucro e projeções de fluxo de caixa futuro.
            </p>
          </div>
          <div className="text-right bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10 shrink-0">
            <span className="text-xs text-emerald-200 font-semibold block">Margem Líquida</span>
            <span className="text-3xl font-black text-emerald-300">{currentResult.netMarginPercent.toFixed(1)}%</span>
            <span className="text-xs text-white/70 block mt-0.5">{formatCurrency(currentResult.netResult)}</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros de Período: Hoje, Semana Atual, Mês Atual, Ano Atual */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Filtros:</span>
        {[
          { id: 'hoje', label: 'Hoje' },
          { id: 'semana', label: 'Semana Atual' },
          { id: 'mes', label: 'Mês Atual' },
          { id: 'ano', label: 'Ano Atual' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setPeriodFilter(f.id as FinancialPeriodFilter)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer ${
              periodFilter === f.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Top Strategic KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase">EBITDA Gerencial</span>
          <div className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 mt-1">
            {formatCurrency(currentResult.ebitda)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Geração de caixa operacional
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase">Despesas Financeiras / Juros</span>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            {formatCurrency(currentResult.financialExpenses)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Tarifas bancárias e taxas de antecipação
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase">3º Resultado (Líquido)</span>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(currentResult.netResult)}
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
            Margem Líquida de {currentResult.netMarginPercent.toFixed(1)}%
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase">Projeção Caixa (30 dias)</span>
          <div className={`text-2xl font-extrabold mt-1 ${currentResult.projectedCashFlow30d >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(currentResult.projectedCashFlow30d)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Recebíveis (-) Pagáveis programados
          </span>
        </div>
      </div>

      {/* DRE Estruturada 3º Nível */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Demonstração do 3º Resultado (Estratégico / Final)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidação do resultado líquido final após despesas financeiras bancárias e fiscais.
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {/* Base: 2º Resultado */}
          <div className="p-4 flex items-center justify-between bg-amber-50/40 dark:bg-amber-950/20">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              <span className="font-bold text-amber-950 dark:text-amber-200 text-sm">
                (+) Resultado Operacional Gerencial (2º Resultado)
              </span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs text-amber-700 font-semibold">{currentResult.operatingMarginPercent.toFixed(1)}%</span>
              <span className="font-black text-amber-700 dark:text-amber-300 text-base w-36 text-right">
                {formatCurrency(currentResult.operatingResult)}
              </span>
            </div>
          </div>

          {/* Despesas Financeiras */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 pl-4">
              <span className="text-rose-500 font-bold text-sm">(-)</span>
              <div>
                <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">Despesas Financeiras & Bancárias</span>
                <span className="block text-xs text-slate-400">Tarifas de cobrança, juros bancários, taxas de antecipação e IOF</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs text-rose-500 font-medium">
                {currentResult.totalGrossRevenue > 0 ? ((currentResult.financialExpenses / currentResult.totalGrossRevenue) * 100).toFixed(1) : 0}%
              </span>
              <span className="font-bold text-rose-600 text-sm w-36 text-right">
                - {formatCurrency(currentResult.financialExpenses)}
              </span>
            </div>
          </div>

          {/* Receitas Financeiras */}
          {currentResult.financialIncomes > 0 && (
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 pl-4">
                <span className="text-emerald-500 font-bold text-sm">(+)</span>
                <div>
                  <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">Receitas Financeiras & Outras Receitas</span>
                  <span className="block text-xs text-slate-400">Rendimentos de aplicações e descontos obtidos</span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="font-bold text-emerald-600 text-sm w-36 text-right">
                  + {formatCurrency(currentResult.financialIncomes)}
                </span>
              </div>
            </div>
          )}

          {/* 3º Resultado Final */}
          <div className="p-5 flex items-center justify-between bg-emerald-50/90 dark:bg-emerald-950/50">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[9px] font-bold">★</div>
              <div>
                <span className="font-black text-emerald-950 dark:text-emerald-100 text-base">(=) 3º RESULTADO: Resultado Líquido Final da Empresa</span>
                <span className="block text-xs text-emerald-700 dark:text-amber-300 mt-0.5">Resultado líquido consolidado à disposição dos sócios e reinvestimento</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 px-3.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 rounded-full">
                {currentResult.netMarginPercent.toFixed(1)}% Líquido
              </span>
              <span className="font-black text-emerald-700 dark:text-emerald-300 text-2xl w-36 text-right">
                {formatCurrency(currentResult.netResult)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Projeção de Fluxo de Caixa Futuro */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-base">Projeção de Fluxo de Caixa (Próximos 30 Dias)</h4>
            <p className="text-xs text-slate-500">Estimativa baseada nos vencimentos de recebíveis e despesas em aberto.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-500 uppercase">Recebimentos Previstos (30d)</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {formatCurrency(currentResult.projectedReceivables30d)}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-500 uppercase">Pagamentos Previstos (30d)</span>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {formatCurrency(currentResult.projectedPayables30d)}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-500 uppercase">Saldo Líquido Previsto (30d)</span>
            <div className={`text-xl font-bold mt-1 ${currentResult.projectedCashFlow30d >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
              {formatCurrency(currentResult.projectedCashFlow30d)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
