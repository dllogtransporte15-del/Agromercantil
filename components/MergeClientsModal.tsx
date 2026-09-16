import React, { useState } from 'react';
import type { Client } from '../types';
import { Building2, ArrowRight, Merge, AlertTriangle, Check, X, Search, CheckSquare, Square } from 'lucide-react';

interface MergeClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onMerge: (targetClientId: string, sourceClientIds: string[]) => Promise<void>;
}

const MergeClientsModal: React.FC<MergeClientsModalProps> = ({ isOpen, onClose, clients, onMerge }) => {
  const [targetClientId, setTargetClientId] = useState<string>('');
  const [sourceClientIds, setSourceClientIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.nomeFantasia.toLowerCase().includes(term) ||
      c.razaoSocial.toLowerCase().includes(term) ||
      c.cnpj.includes(term) ||
      c.id.toLowerCase().includes(term)
    );
  });

  const targetClient = clients.find(c => c.id === targetClientId);

  const handleToggleSource = (id: string) => {
    if (id === targetClientId) return;
    setSourceClientIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllSources = () => {
    const available = filteredClients
      .filter(c => c.id !== targetClientId)
      .map(c => c.id);
    setSourceClientIds(available);
  };

  const handleClearSources = () => {
    setSourceClientIds([]);
  };

  const handleExecuteMerge = async () => {
    if (!targetClientId) {
      alert('Selecione o cliente principal (Matriz) que receberá os outros cadastros.');
      return;
    }
    if (sourceClientIds.length === 0) {
      alert('Selecione ao menos um cliente de origem para unir ao cliente principal.');
      return;
    }

    const confirmMsg = `Tem certeza que deseja unir ${sourceClientIds.length} cadastro(s) ao cliente principal "${targetClient?.nomeFantasia || targetClient?.razaoSocial}"?\n\n` +
      `• Os CNPJs dos clientes selecionados se tornarão filiais do cliente principal.\n` +
      `• Todas as cargas, embarques, cotações e usuários vinculados serão migrados automaticamente.\n` +
      `• Esta operação unificará os históricos e não poderá ser desfeita automaticamente.`;

    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      await onMerge(targetClientId, sourceClientIds);
      onClose();
    } catch (error: any) {
      console.error('Error merging clients:', error);
      alert(`Erro ao unir clientes: ${error?.message || 'Falha desconhecida'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl dark:bg-indigo-900/40 dark:text-indigo-400">
              <Merge className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Unir Cadastros de Clientes
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Agrupe filiais e múltiplos CNPJs dispersos em um único cadastro de cliente empresarial.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Warning banner */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Como funciona a unificação de clientes:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-700 dark:text-amber-400">
                <li>O <strong>Cliente Principal (Destino)</strong> será mantido como a empresa matriz.</li>
                <li>Os CNPJs dos clientes selecionados serão transferidos como <strong>Filiais / CNPJs Secundários</strong>.</li>
                <li>Todas as cargas, embarques e cotações dos clientes de origem serão unificados no histórico do cliente principal.</li>
              </ul>
            </div>
          </div>

          {/* STEP 1: Select Target Client */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              1. Selecione o Cliente Principal (Matriz / Destino) <span className="text-red-500">*</span>
            </label>
            <select
              value={targetClientId}
              onChange={(e) => {
                const newTarget = e.target.value;
                setTargetClientId(newTarget);
                setSourceClientIds(prev => prev.filter(id => id !== newTarget));
              }}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-600 shadow-xs"
            >
              <option value="">-- Selecione o cliente principal que receberá as filiais --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia || c.razaoSocial} — CNPJ: {c.cnpj} ({c.city}/{c.state}) [{c.id}]
                </option>
              ))}
            </select>

            {targetClient && (
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200/60 dark:border-indigo-800/50 rounded-xl flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold">{targetClient.nomeFantasia || targetClient.razaoSocial}</span>
                  <span className="font-mono text-gray-500 dark:text-gray-400">({targetClient.cnpj})</span>
                </div>
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 font-bold rounded-md">
                  Cliente Principal
                </span>
              </div>
            )}
          </div>

          {/* STEP 2: Select Source Clients */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                2. Selecione os Cadastros a serem Unificados como Filiais <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllSources}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  Selecionar Todos
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  type="button"
                  onClick={handleClearSources}
                  className="text-gray-500 hover:underline"
                >
                  Limpar Seleção
                </button>
              </div>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, razão social ou CNPJ..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-600 shadow-xs"
              />
            </div>

            {/* Selection list */}
            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
              {filteredClients.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">Nenhum cliente encontrado.</div>
              ) : (
                filteredClients.map(c => {
                  const isTarget = c.id === targetClientId;
                  const isSelected = sourceClientIds.includes(c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => !isTarget && handleToggleSource(c.id)}
                      className={`p-3 flex items-center justify-between transition-colors ${
                        isTarget
                          ? 'bg-gray-100 dark:bg-gray-800/80 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-indigo-50/70 dark:bg-indigo-900/30 cursor-pointer'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-indigo-600">
                          {isTarget ? (
                            <Building2 className="w-4 h-4 text-gray-400" />
                          ) : isSelected ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {c.nomeFantasia || c.razaoSocial}
                            {isTarget && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded">
                                Destino
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono">{c.cnpj}</span>
                            <span>•</span>
                            <span>{c.city}/{c.state}</span>
                            <span>•</span>
                            <span>ID: {c.id}</span>
                          </div>
                        </div>
                      </div>

                      {isSelected && !isTarget && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-md">
                          Será unificado como filial
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between px-1">
              <span>{sourceClientIds.length} cadastro(s) selecionado(s) para unificação.</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecuteMerge}
            disabled={isSubmitting || !targetClientId || sourceClientIds.length === 0}
            className="flex items-center gap-2 py-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Merge className="w-4 h-4" />
            {isSubmitting ? 'Unificando Cadastros...' : `Unir ${sourceClientIds.length} Cadastro(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeClientsModal;
