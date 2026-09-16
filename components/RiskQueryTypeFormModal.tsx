import React, { useState, useEffect } from 'react';
import type { RiskQueryOption } from '../types';
import { X, ShieldCheck, DollarSign, ListOrdered, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface RiskQueryTypeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (option: RiskQueryOption | Omit<RiskQueryOption, 'id'>) => Promise<void> | void;
  optionToEdit: RiskQueryOption | null;
  existingCount?: number;
}

const RiskQueryTypeFormModal: React.FC<RiskQueryTypeFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  optionToEdit,
  existingCount = 0
}) => {
  const [name, setName] = useState('');
  const [cost, setCost] = useState<number | ''>(0);
  const [orderIndex, setOrderIndex] = useState<number | ''>(1);
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (optionToEdit) {
        setName(optionToEdit.name || '');
        setCost(optionToEdit.cost !== undefined ? optionToEdit.cost : 0);
        setOrderIndex(optionToEdit.orderIndex !== undefined ? optionToEdit.orderIndex : 1);
        setActive(optionToEdit.active !== false);
        setDescription(optionToEdit.description || '');
      } else {
        setName('');
        setCost(0);
        setOrderIndex(existingCount + 1);
        setActive(true);
        setDescription('');
      }
    }
  }, [isOpen, optionToEdit, existingCount]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('O nome da modalidade de consulta é obrigatório.');
      return;
    }
    if (cost === '' || Number(cost) < 0) {
      setError('O valor do custo deve ser um número maior ou igual a zero.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      if (optionToEdit) {
        await onSave({
          ...optionToEdit,
          name: name.trim(),
          cost: Number(cost),
          orderIndex: orderIndex === '' ? 1 : Number(orderIndex),
          active,
          description: description.trim() || undefined,
        });
      } else {
        await onSave({
          name: name.trim(),
          cost: Number(cost),
          orderIndex: orderIndex === '' ? existingCount + 1 : Number(orderIndex),
          active,
          description: description.trim() || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving risk query option:', err);
      setError(err?.message || 'Ocorreu um erro ao salvar a modalidade de consulta.');
    } finally {
      setIsSaving(false);
    }
  };

  const formattedPreviewCost = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cost || 0));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700 relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-transparent dark:from-gray-800 dark:to-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {optionToEdit ? 'Editar Modalidade de Consulta' : 'Nova Modalidade de Consulta'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configure os tipos de consulta de Gerenciamento de Risco e seus custos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome da Modalidade */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Nome da Modalidade / Tipo de Consulta <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: SIGA, Consulta + Biometria, Vitimologia..."
              className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm transition-all"
              required
              autoFocus
            />
          </div>

          {/* Grid: Custo e Ordem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor / Custo */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                Valor da Consulta (R$) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500 dark:text-gray-400">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={e => setCost(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0,00"
                  className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-sm"
                  required
                />
              </div>
            </div>

            {/* Ordem de Exibição */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ListOrdered className="w-3.5 h-3.5 text-blue-500" />
                Ordem no Dropdown
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={orderIndex}
                onChange={e => setOrderIndex(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="1"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-sm"
              />
            </div>
          </div>

          {/* Descrição / Observação */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              Descrição / Observações (Opcional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva quando utilizar esta modalidade ou critérios de contratação..."
              rows={2}
              className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          {/* Status Ativo Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40">
            <div>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                Disponível para Seleção nos Embarques
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {active ? 'Esta modalidade aparecerá no formulário de liberação de GR.' : 'Modalidade inativa (não aparecerá em novos embarques).'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActive(prev => !prev)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Preview Box */}
          <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800 rounded-xl">
            <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-widest mb-1.5">
              Pré-visualização no Select de Embarque:
            </p>
            <div className="p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 font-medium text-xs text-gray-800 dark:text-gray-200 flex items-center justify-between">
              <span>
                {orderIndex || 1} - {name.trim() || 'Nome da Modalidade'} (Valor: {formattedPreviewCost})
              </span>
              {active ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Ativo
                </span>
              ) : (
                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  Inativo
                </span>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl shadow-md transition-all text-xs font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{optionToEdit ? 'Salvar Alterações' : 'Cadastrar Modalidade'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RiskQueryTypeFormModal;
