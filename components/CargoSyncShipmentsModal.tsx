import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Check, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  RefreshCw, 
  X, 
  Coins, 
  Truck, 
  FileText,
  ShieldCheck,
  Search
} from 'lucide-react';
import type { Cargo, Shipment } from '../types';
import { ShipmentStatus } from '../types';

export interface CargoChangedField {
  key: string;
  label: string;
  oldValue: any;
  newValue: any;
  category: 'icms' | 'company_freight' | 'driver_freight' | 'financial_cost' | 'toll' | 'other';
}

export interface CargoSyncShipmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldCargo: Cargo;
  newCargo: Cargo;
  changedFields: CargoChangedField[];
  linkedShipments: Shipment[];
  onConfirmSync: (selectedShipmentIds: string[]) => Promise<void>;
  onSaveCargoOnly: () => Promise<void>;
}

const formatCurrency = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const getStatusBadge = (status: ShipmentStatus) => {
  switch (status) {
    case ShipmentStatus.AguardandoCarregamento:
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300">Ag. Carregamento</span>;
    case ShipmentStatus.AguardandoNota:
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300">Ag. Nota</span>;
    case ShipmentStatus.AguardandoFiscal:
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300">Ag. Fiscal</span>;
    case ShipmentStatus.AguardandoAdiantamento:
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300">Ag. Adiantamento</span>;
    case ShipmentStatus.AguardandoDescarga:
    case ShipmentStatus.ValidacaoTicket:
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300">Descarga/Ticket</span>;
    case ShipmentStatus.AguardandoPagamentoSaldo:
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300">Ag. Saldo</span>;
    case ShipmentStatus.Finalizado:
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300">Finalizado</span>;
    default:
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-300">{status}</span>;
  }
};

export const CargoSyncShipmentsModal: React.FC<CargoSyncShipmentsModalProps> = ({
  isOpen,
  onClose,
  oldCargo,
  newCargo,
  changedFields,
  linkedShipments,
  onConfirmSync,
  onSaveCargoOnly,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(linkedShipments.map(s => s.id)));
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionType, setActionType] = useState<'sync' | 'cargo_only' | null>(null);

  // Keep all selected by default when opened
  React.useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(linkedShipments.map(s => s.id)));
      setSearchTerm('');
      setIsSubmitting(false);
      setActionType(null);
    }
  }, [isOpen, linkedShipments]);

  if (!isOpen) return null;

  const filteredShipments = linkedShipments.filter(s => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.id.toLowerCase().includes(q) ||
      (s.driverName && s.driverName.toLowerCase().includes(q)) ||
      (s.horsePlate && s.horsePlate.toLowerCase().includes(q)) ||
      (s.cteNumber && s.cteNumber.toLowerCase().includes(q))
    );
  });

  const isAllSelected = filteredShipments.length > 0 && filteredShipments.every(s => selectedIds.has(s.id));
  const isNoneSelected = selectedIds.size === 0;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredShipments.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredShipments.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmSyncClick = async () => {
    if (selectedIds.size === 0) {
      alert('Selecione pelo menos um embarque para sincronizar ou escolha "Salvar Carga Apenas".');
      return;
    }
    setIsSubmitting(true);
    setActionType('sync');
    try {
      await onConfirmSync(Array.from(selectedIds));
      onClose();
    } catch (err) {
      console.error('[CargoSyncShipmentsModal] Erro ao sincronizar embarques:', err);
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
  };

  const handleSaveCargoOnlyClick = async () => {
    setIsSubmitting(true);
    setActionType('cargo_only');
    try {
      await onSaveCargoOnly();
      onClose();
    } catch (err) {
      console.error('[CargoSyncShipmentsModal] Erro ao salvar apenas carga:', err);
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
  };

  const hasIcmsChange = changedFields.some(c => c.category === 'icms');
  const hasCompanyRateChange = changedFields.some(c => c.category === 'company_freight');
  const hasDriverRateChange = changedFields.some(c => c.category === 'driver_freight');
  const hasFinancialCostChange = changedFields.some(c => c.category === 'financial_cost');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 mt-0.5">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Sincronização em Massa de Embarques
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                  Carga #{newCargo.sequenceId || newCargo.id}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Foram detectadas alterações fiscais ou de frete nesta carga. Selecione quais viagens existentes devem receber os novos valores atualizados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo das Alterações da Carga */}
        <div className="px-6 py-3.5 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900/40">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Campos Alterados na Carga:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {changedFields.map((field) => (
              <div key={field.key} className="p-2.5 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-amber-200/50 dark:border-amber-800/40 shadow-sm text-xs">
                <div className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{field.label}</div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <span className="line-through text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
                    {String(field.oldValue)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                    {String(field.newValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Barra de Ações da Lista */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 text-primary" />
                  Desmarcar Todos
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-gray-400" />
                  Selecionar Todos
                </>
              )}
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">{selectedIds.size}</strong> de <strong className="text-gray-900 dark:text-white">{linkedShipments.length}</strong> embarque(s) selecionado(s)
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por ID, placa, motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Tabela de Embarques */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/90 dark:bg-gray-800/90 sticky top-0 z-10 backdrop-blur-sm text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Sel.</th>
                <th className="py-3 px-4">Embarque / Placa</th>
                <th className="py-3 px-4">Motorista / Status</th>
                <th className="py-3 px-4">Toneladas</th>
                {hasIcmsChange && <th className="py-3 px-4">Impacto ICMS</th>}
                {hasCompanyRateChange && <th className="py-3 px-4">Impacto Frete Empresa</th>}
                {hasDriverRateChange && <th className="py-3 px-4">Impacto Frete Motorista</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-800 dark:text-gray-200">
              {filteredShipments.map((s) => {
                const isSelected = selectedIds.has(s.id);
                const ton = Number(s.loadedTonnage || s.shipmentTonnage || s.unloadedTonnage || 0);

                // Cálculo Comparativo ICMS
                const oldIcmsVal = (s.isIcmsExempt || (s.documents as any)?.is_icms_exempt || s.icmsValue === 0)
                  ? 0
                  : (s.icmsValue || (s.documents as any)?.icms_value || 0);

                const newIcmsRate = (newCargo.hasIcms && newCargo.icmsPercentage) ? Number(newCargo.icmsPercentage) : 0;
                const compRate = Number(newCargo.companyFreightValuePerTon || s.companyFreightRateSnapshot || 0);
                const projectedCompanyFreight = ton > 0 ? (compRate * ton) : (s.realProfitData?.companyFreight || s.driverFreightValue || 0);
                const projectedNewIcms = (newIcmsRate > 0 && projectedCompanyFreight > 0)
                  ? Number(((projectedCompanyFreight * newIcmsRate) / 100).toFixed(2))
                  : 0;

                // Frete Empresa Comparativo
                const oldCompRate = s.companyFreightRateSnapshot || oldCargo.companyFreightValuePerTon || 0;
                const newCompRate = newCargo.companyFreightValuePerTon || 0;

                // Frete Motorista Comparativo
                const oldDriverRate = s.driverFreightRateSnapshot || oldCargo.driverFreightValuePerTon || 0;
                const newDriverRate = newCargo.driverFreightValuePerTon || 0;
                const projectedDriverFreight = (newDriverRate > 0 && ton > 0) ? Number((newDriverRate * ton).toFixed(2)) : s.driverFreightValue;

                return (
                  <tr 
                    key={s.id} 
                    onClick={() => toggleSelectOne(s.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 opacity-60'
                    }`}
                  >
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(s.id)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        {s.id}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 font-mono text-[11px] mt-0.5">
                        {s.horsePlate || 'Sem placa'} {s.cteNumber ? `• CT-e ${s.cteNumber}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
                        {s.driverName || 'Motorista não informado'}
                      </div>
                      <div className="mt-1">
                        {getStatusBadge(s.status)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {ton.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {s.loadedTonnage ? 'Peso Ticket' : 'Peso Carga'}
                      </div>
                    </td>

                    {/* Impacto ICMS */}
                    {hasIcmsChange && (
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className={`px-1.5 py-0.5 rounded font-mono ${oldIcmsVal > 0 ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 line-through' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                            {oldIcmsVal > 0 ? formatCurrency(oldIcmsVal) : 'Isento'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className={`px-1.5 py-0.5 rounded font-bold font-mono ${projectedNewIcms > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>
                            {projectedNewIcms > 0 ? `${formatCurrency(projectedNewIcms)} (${newIcmsRate}%)` : 'R$ 0,00 (Isento)'}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Impacto Frete Empresa */}
                    {hasCompanyRateChange && (
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono text-gray-500 line-through">
                            {formatCurrency(oldCompRate)}/t
                          </span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(newCompRate)}/t
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Impacto Frete Motorista */}
                    {hasDriverRateChange && (
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono text-gray-500 line-through">
                            {formatCurrency(s.driverFreightValue)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                            {formatCurrency(projectedDriverFreight)}
                          </span>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredShipments.length === 0 && (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
              Nenhum embarque encontrado com o filtro "{searchTerm}".
            </div>
          )}
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white bg-transparent rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
          >
            Cancelar Edição
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSaveCargoOnlyClick}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
              title="Salva as alterações na carga mas mantém os embarques já criados com os valores antigos"
            >
              {isSubmitting && actionType === 'cargo_only' ? (
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Salvando...
                </div>
              ) : (
                'Salvar Carga Apenas (Manter Embarques)'
              )}
            </button>

            <button
              onClick={handleConfirmSyncClick}
              disabled={isSubmitting || selectedIds.size === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-all shadow-md hover:shadow-lg focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && actionType === 'sync' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sincronizando {selectedIds.size} embarque(s)...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Atualizar Carga e Sincronizar ({selectedIds.size}) Embarque(s)
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CargoSyncShipmentsModal;
