import React, { useState, useEffect } from 'react';
import type { Shipment, Cargo, Client, Driver, Vehicle, RiskQueryOption } from '../types';
import { ShipmentStatus, RISK_QUERY_COST_MAP, RiskQueryType, DEFAULT_RISK_QUERY_OPTIONS } from '../types';
import { 
  X, 
  ShieldCheck, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  Truck, 
  User as UserIcon, 
  Building2,
  FileCheck2,
  Info
} from 'lucide-react';

interface EditRiskQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  cargo?: Cargo;
  client?: Client;
  driver?: Driver;
  vehicle?: Vehicle;
  riskQueryOptions?: RiskQueryOption[];
  onSave: (shipmentId: string, data: { riskQueryType?: string; riskQueryCost?: number; riskReleaseCode?: string }) => Promise<void> | void;
}

const EditRiskQueryModal: React.FC<EditRiskQueryModalProps> = ({
  isOpen,
  onClose,
  shipment,
  cargo,
  client,
  driver,
  vehicle,
  riskQueryOptions = DEFAULT_RISK_QUERY_OPTIONS,
  onSave,
}) => {
  const [selectedType, setSelectedType] = useState<string>('');
  const [cost, setCost] = useState<number | ''>(0);
  const [releaseCode, setReleaseCode] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Cost map for quick auto-fill
  const costMap = React.useMemo(() => {
    const map = new Map<string, number>();
    riskQueryOptions.forEach(opt => map.set(opt.name, opt.cost));
    return map;
  }, [riskQueryOptions]);

  useEffect(() => {
    if (isOpen && shipment) {
      setError('');
      const currentType = shipment.riskQueryType || (shipment.status === ShipmentStatus.AguardandoSeguradora ? 'Pendente de Definição' : 'Consulta');
      setSelectedType(currentType);

      // Determine initial cost
      if (shipment.riskQueryCost !== undefined && shipment.riskQueryCost !== null) {
        setCost(Number(shipment.riskQueryCost));
      } else if (costMap.has(currentType)) {
        setCost(costMap.get(currentType)!);
      } else if (RISK_QUERY_COST_MAP[currentType] !== undefined) {
        setCost(RISK_QUERY_COST_MAP[currentType]);
      } else if (RISK_QUERY_COST_MAP[currentType.toLowerCase().trim()] !== undefined) {
        setCost(RISK_QUERY_COST_MAP[currentType.toLowerCase().trim()]);
      } else {
        setCost(0);
      }

      setReleaseCode(shipment.riskReleaseCode || '');
    }
  }, [isOpen, shipment, costMap]);

  if (!isOpen || !shipment) return null;

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    if (costMap.has(newType)) {
      setCost(costMap.get(newType)!);
    } else if (RISK_QUERY_COST_MAP[newType] !== undefined) {
      setCost(RISK_QUERY_COST_MAP[newType]);
    } else if (RISK_QUERY_COST_MAP[newType.toLowerCase().trim()] !== undefined) {
      setCost(RISK_QUERY_COST_MAP[newType.toLowerCase().trim()]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || selectedType.trim() === '') {
      setError('Por favor, selecione uma modalidade de consulta de risco.');
      return;
    }

    if (cost === '' || Number(cost) < 0) {
      setError('O custo da consulta deve ser um número válido maior ou igual a zero.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await onSave(shipment.id, {
        riskQueryType: selectedType.trim(),
        riskQueryCost: Number(cost),
        riskReleaseCode: releaseCode.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar tipo de consulta:', err);
      setError(err?.message || 'Ocorreu um erro ao salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const formattedCost = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cost || 0));

  // Options to show in select (ensure current type is included if custom)
  const availableOptions = [...riskQueryOptions];
  if (selectedType && !availableOptions.some(opt => opt.name === selectedType)) {
    availableOptions.push({
      id: 'custom-current',
      name: selectedType,
      cost: Number(cost || 0),
      active: true,
      orderIndex: 999
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-transparent dark:from-gray-800 dark:to-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Editar Modalidade de Consulta
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Embarque: <span className="font-bold text-primary dark:text-blue-400">{shipment.id}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shipment Info Badge */}
        <div className="p-4 bg-gray-50/80 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <UserIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-gray-400 block font-semibold">MOTORISTA</span>
              <span className="font-medium truncate">{driver?.name || shipment.driverName || 'N/A'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Truck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-gray-400 block font-semibold">PLACA</span>
              <span className="font-mono font-bold truncate">{shipment.horsePlate || vehicle?.plate || 'N/A'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-gray-400 block font-semibold">CLIENTE</span>
              <span className="font-medium truncate">{client?.nomeFantasia || 'N/A'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <FileCheck2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-gray-400 block font-semibold">STATUS EMBARQUE</span>
              <span className="font-medium truncate">{shipment.status}</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Modalidade / Tipo de Consulta */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
              <span>Tipo de Consulta / Modalidade <span className="text-red-500">*</span></span>
              <span className="text-[10px] font-normal text-gray-400">Define o valor base</span>
            </label>
            <div className="relative">
              <select
                value={selectedType}
                onChange={e => handleTypeChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                required
              >
                <option value="" disabled>Selecione a modalidade correta...</option>
                {availableOptions.map(opt => (
                  <option key={opt.id} value={opt.name}>
                    {opt.name} ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.cost)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Custo da Consulta */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
              <span>Custo da Consulta (R$) <span className="text-red-500">*</span></span>
              <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formattedCost}
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 font-bold text-xs">
                R$
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={e => setCost(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value)))}
                placeholder="0,00"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs font-mono font-semibold bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Valor financeiro atribuído a esta consulta (ajustado automaticamente pela modalidade).
            </p>
          </div>

          {/* 3. Código de Liberação da Seguradora */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Código de Liberação da Seguradora
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <KeyRound className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={releaseCode}
                onChange={e => setReleaseCode(e.target.value)}
                placeholder="Ex: 26881909864"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs font-mono font-semibold bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Código retornado pela seguradora/gerenciadora de risco (opcional).
            </p>
          </div>

          <div className="p-3 bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl flex items-start gap-2 text-[11px] text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <span>
              Ao salvar, a listagem operacional, os cálculos de custos e os relatórios de desperdício serão atualizados com os novos dados.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-blue-700 rounded-xl transition-colors shadow-md shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRiskQueryModal;
