import React, { useState, useMemo } from 'react';
import type { SecondLevelFinancialResult } from '../../utils/financialCalculations';
import { calculateFirstResult, calculateSecondResult } from '../../utils/financialCalculations';
import type { Shipment, Cargo, FinancialTransaction } from '../../types';
import { ShipmentStatus } from '../../types';
import { getFinancialPeriodRange, getShipmentEffectiveDate, parseDateToYmd, FinancialPeriodFilter } from '../../utils';
import { Briefcase, Building, PieChart, TrendingUp, Layers, Users } from 'lucide-react';

interface SecondResultTabProps {
  data: SecondLevelFinancialResult;
  shipments?: Shipment[];
  cargos?: Cargo[];
  transactions?: FinancialTransaction[];
}

export const SecondResultTab: React.FC<SecondResultTabProps> = ({ 
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
    return calculateSecondResult(first, validTransactions);
  }, [data, shipments, cargos, transactions, periodFilter]);

  const personnelPercent = currentResult.totalGrossRevenue > 0 ? (currentResult.personnelExpenses / currentResult.totalGrossRevenue) * 100 : 0;
  const operationalPercent = currentResult.totalGrossRevenue > 0 ? (currentResult.operationalExpenses / currentResult.totalGrossRevenue) * 100 : 0;
  const adminPercent = currentResult.totalGrossRevenue > 0 ? (currentResult.administrativeExpenses / currentResult.totalGrossRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-bold tracking-widest text-amber-300">
              Visão Gerencial & Centros de Custo
            </span>
            <h2 className="text-2xl font-black mt-1">2º Resultado Financeiro</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Resultado Operacional Gerencial obtido após a dedução dos custos fixos, folha de pessoal, encargos e despesas administrativas por centro de custo.
            </p>
          </div>
          <div className="text-right bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10 shrink-0">
            <span className="text-xs text-amber-200 font-semibold block">Margem Operacional</span>
            <span className="text-3xl font-black text-amber-300">{currentResult.operatingMarginPercent.toFixed(1)}%</span>
            <span className="text-xs text-white/70 block mt-0.5">{formatCurrency(currentResult.operatingResult)}</span>
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
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Centros de Custo Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase">Margem de Contribuição</span>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(currentResult.contributionMargin)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Base vinda do 1º Resultado
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase">Pessoal & Encargos</span>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            {formatCurrency(currentResult.personnelExpenses)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {personnelPercent.toFixed(1)}% da receita bruta
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase">Despesas Operacionais / Filiais</span>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(currentResult.operationalExpenses)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {operationalPercent.toFixed(1)}% da receita bruta
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase">Despesas Administrativas</span>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
            {formatCurrency(currentResult.administrativeExpenses)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {adminPercent.toFixed(1)}% da receita bruta
          </span>
        </div>
      </div>

      {/* DRE Gerencial Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Demonstração do 2º Resultado (Gerencial)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dedução dos custos e centros de custos da empresa a partir da margem operacional.
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {/* Base: 1º Resultado */}
          <div className="p-4 flex items-center justify-between bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">
                (+) Margem de Contribuição Operacional (1º Resultado)
              </span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs text-emerald-700 font-semibold">{currentResult.contributionMarginPercent.toFixed(1)}%</span>
              <span className="font-black text-emerald-700 dark:text-emerald-300 text-base w-36 text-right">
                {formatCurrency(currentResult.contributionMargin)}
              </span>
            </div>
          </div>

          {/* Despesas Pessoal */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 pl-4">
              <span className="text-rose-500 font-bold text-sm">(-)</span>
              <div>
                <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">Centro de Custo: Recursos Humanos e Pessoal</span>
                <span className="block text-xs text-slate-400">Salários de expedição, comercial, encargos trabalhistas, benefícios</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs text-rose-500 font-medium">{personnelPercent.toFixed(1)}%</span>
              <span className="font-bold text-rose-600 text-sm w-36 text-right">
                - {formatCurrency(currentResult.personnelExpenses)}
              </span>
            </div>
          </div>

          {/* Despesas Operacionais */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 pl-4">
              <span className="text-rose-500 font-bold text-sm">(-)</span>
              <div>
                <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">Centro de Custo: Operações, Filiais e Logística</span>
                <span className="block text-xs text-slate-400">Rastreamento, seguros de carga, vistorias, suprimentos</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs text-rose-500 font-medium">{operationalPercent.toFixed(1)}%</span>
              <span className="font-bold text-rose-600 text-sm w-36 text-right">
                - {formatCurrency(currentResult.operationalExpenses)}
              </span>
            </div>
          </div>

          {/* Despesas Administrativas */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 pl-4">
              <span className="text-rose-500 font-bold text-sm">(-)</span>
              <div>
                <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">Centro de Custo: Administrativo, TI e Geral</span>
                <span className="block text-xs text-slate-400">Aluguéis, internet, telecom, sistemas em nuvem, contabilidade</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs text-rose-500 font-medium">{adminPercent.toFixed(1)}%</span>
              <span className="font-bold text-rose-600 text-sm w-36 text-right">
                - {formatCurrency(currentResult.administrativeExpenses)}
              </span>
            </div>
          </div>

          {/* 2º Resultado Final */}
          <div className="p-5 flex items-center justify-between bg-amber-50/80 dark:bg-amber-950/40">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-amber-600 flex items-center justify-center text-white text-[9px] font-bold">✓</div>
              <div>
                <span className="font-black text-amber-950 dark:text-amber-100 text-base">(=) 2º RESULTADO: Resultado Operacional Gerencial</span>
                <span className="block text-xs text-amber-700 dark:text-amber-300 mt-0.5">Lucro operacional antes de impostos sobre o lucro e resultado financeiro</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-sm font-black text-amber-700 dark:text-amber-300 px-3 py-1 bg-amber-100 dark:bg-amber-900/60 rounded-full">
                {currentResult.operatingMarginPercent.toFixed(1)}%
              </span>
              <span className="font-black text-amber-700 dark:text-amber-300 text-xl w-36 text-right">
                {formatCurrency(currentResult.operatingResult)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
