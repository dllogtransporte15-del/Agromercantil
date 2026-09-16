import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import type { RiskQueryOption, User, ProfilePermissions } from '../types';
import { DEFAULT_RISK_QUERY_OPTIONS } from '../types';
import { can, isDemoUser } from '../auth';
import { 
  ShieldCheck, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  DollarSign, 
  ListOrdered, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  Sparkles,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import RiskQueryTypeFormModal from '../components/RiskQueryTypeFormModal';

interface RiskQueryTypesPageProps {
  riskQueryOptions: RiskQueryOption[];
  onSaveOption: (option: RiskQueryOption | Omit<RiskQueryOption, 'id'>) => Promise<void> | void;
  onDeleteOption: (optionId: string) => Promise<void> | void;
  onRestoreDefaults?: () => Promise<void> | void;
  currentUser: User;
  profilePermissions: ProfilePermissions;
}

const RiskQueryTypesPage: React.FC<RiskQueryTypesPageProps> = ({
  riskQueryOptions = [],
  onSaveOption,
  onDeleteOption,
  onRestoreDefaults,
  currentUser,
  profilePermissions,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [optionToEdit, setOptionToEdit] = useState<RiskQueryOption | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const isDemo = isDemoUser(currentUser);
  const canCreate = !isDemo && can('create', currentUser, 'risk-query-types', profilePermissions);
  const canUpdate = !isDemo && can('update', currentUser, 'risk-query-types', profilePermissions);
  const canDelete = !isDemo && can('delete', currentUser, 'risk-query-types', profilePermissions);

  const handleOpenModal = () => {
    if (isDemo) return;
    setOptionToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (option: RiskQueryOption) => {
    if (isDemo) return;
    setOptionToEdit(option);
    setIsModalOpen(true);
  };

  const handleDelete = async (option: RiskQueryOption) => {
    if (isDemo) return;
    if (window.confirm(`Tem certeza que deseja excluir a modalidade de consulta "${option.name}"?`)) {
      await onDeleteOption(option.id);
    }
  };

  const handleToggleActive = async (option: RiskQueryOption) => {
    if (!canUpdate || isDemo) return;
    await onSaveOption({
      ...option,
      active: !option.active
    });
  };

  const handleResetToDefaults = async () => {
    if (isDemo) return;
    if (window.confirm('Deseja restaurar as modalidades padrão do sistema (Consulta, Consulta + Biometria, Cadastro Geral + Biometria, Vitimologia, Liberação Simplificada)?')) {
      if (onRestoreDefaults) {
        await onRestoreDefaults();
      } else {
        for (const defOpt of DEFAULT_RISK_QUERY_OPTIONS) {
          await onSaveOption(defOpt);
        }
      }
    }
  };

  const filteredOptions = useMemo(() => {
    return riskQueryOptions
      .filter(opt => {
        if (filterStatus === 'active' && !opt.active) return false;
        if (filterStatus === 'inactive' && opt.active) return false;
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchName = opt.name.toLowerCase().includes(term);
          const matchDesc = (opt.description || '').toLowerCase().includes(term);
          const matchCost = opt.cost.toString().includes(term);
          if (!matchName && !matchDesc && !matchCost) return false;
        }
        return true;
      })
      .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));
  }, [riskQueryOptions, filterStatus, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = riskQueryOptions.length;
    const activeCount = riskQueryOptions.filter(o => o.active).length;
    const inactiveCount = total - activeCount;
    const costs = riskQueryOptions.map(o => o.cost);
    const avgCost = total > 0 ? (costs.reduce((a, b) => a + b, 0) / total) : 0;
    const maxCost = total > 0 ? Math.max(...costs) : 0;
    const minCost = total > 0 ? Math.min(...costs) : 0;
    return { total, activeCount, inactiveCount, avgCost, maxCost, minCost };
  }, [riskQueryOptions]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Modalidades de Consulta (Gerenciadora de Risco)">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-md shadow-primary/20 transition-all flex items-center gap-2 text-xs active:scale-95"
            >
              <Plus className="w-4 h-4" /> Nova Modalidade
            </button>
          )}
          {canCreate && (
            <button
              onClick={handleResetToDefaults}
              className="px-3.5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs"
              title="Restaurar modalidades de consulta padrão do sistema"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões
            </button>
          )}
        </div>
      </Header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" /> Total de Modalidades
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {stats.total}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Modalidades Ativas
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.activeCount} <span className="text-xs font-semibold text-gray-400">({stats.inactiveCount} inativas)</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-indigo-500" /> Custo Médio
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {formatCurrency(stats.avgCost)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Faixa de Valores
          </div>
          <div className="text-sm font-black text-gray-900 dark:text-white font-mono mt-1">
            {formatCurrency(stats.minCost)} <span className="text-xs text-gray-400 font-sans font-normal">a</span> {formatCurrency(stats.maxCost)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar modalidade ou valor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Filtrar:</span>
          <div className="bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl flex items-center text-xs font-bold">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg transition-all ${filterStatus === 'all' ? 'bg-white dark:bg-gray-800 text-primary shadow-xs' : 'text-gray-600 dark:text-gray-300'}`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-1 rounded-lg transition-all ${filterStatus === 'active' ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-xs' : 'text-gray-600 dark:text-gray-300'}`}
            >
              Ativos ({stats.activeCount})
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={`px-3 py-1 rounded-lg transition-all ${filterStatus === 'inactive' ? 'bg-white dark:bg-gray-800 text-gray-800 shadow-xs' : 'text-gray-600 dark:text-gray-300'}`}
            >
              Inativos ({stats.inactiveCount})
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {filteredOptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ShieldCheck className="w-16 h-16 mb-3 opacity-20" />
            <p className="text-base font-bold text-gray-600 dark:text-gray-300">Nenhuma modalidade encontrada</p>
            <p className="text-xs text-gray-400 mt-1">Cadastre novas modalidades de consulta ou restaure os padrões do sistema.</p>
            {canCreate && (
              <button
                onClick={handleOpenModal}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors"
              >
                Cadastrar Primeira Modalidade
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[11px] font-bold border-b dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3.5 text-left">Ordem</th>
                  <th className="px-6 py-3.5 text-left">Nome da Modalidade</th>
                  <th className="px-6 py-3.5 text-left">Custo / Valor Unitário</th>
                  <th className="px-6 py-3.5 text-left">Exibição no Select</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredOptions.map((option, idx) => (
                  <tr key={option.id || idx} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    {/* Ordem */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono font-bold text-xs border border-blue-200 dark:border-blue-800">
                        {option.orderIndex ?? (idx + 1)}
                      </span>
                    </td>

                    {/* Nome & Descrição */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 dark:text-white text-sm">
                        {option.name}
                      </div>
                      {option.description && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 max-w-md">
                          {option.description}
                        </div>
                      )}
                    </td>

                    {/* Custo */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold ${
                        option.cost > 0
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                      }`}>
                        {formatCurrency(option.cost)}
                      </span>
                    </td>

                    {/* Exibição no Select */}
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/60 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700">
                        {option.orderIndex ?? (idx + 1)} - {option.name} (Valor: {formatCurrency(option.cost)})
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(option)}
                        disabled={!canUpdate}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                          option.active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 cursor-pointer'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 cursor-pointer'
                        } ${!canUpdate ? 'cursor-default opacity-80' : ''}`}
                        title={option.active ? 'Clique para desativar' : 'Clique para ativar'}
                      >
                        {option.active ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Ativo
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                            Inativo
                          </>
                        )}
                      </button>
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {canUpdate && (
                          <button
                            onClick={() => handleEdit(option)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Editar Modalidade"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(option)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Excluir Modalidade"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <RiskQueryTypeFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSaveOption}
        optionToEdit={optionToEdit}
        existingCount={riskQueryOptions.length}
      />
    </div>
  );
};

export default RiskQueryTypesPage;
