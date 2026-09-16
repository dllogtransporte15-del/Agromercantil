
import React from 'react';
import { ShipmentStatus } from '../types';
import type { Shipment, Cargo, User } from '../types';
import { FileText, X, Search, UserCheck } from 'lucide-react';
import { StayRecord } from '../utils/toolStorage';
import { isStayForShipment } from '../utils';

interface ShipmentHistoryFilterProps {
  shipments: Shipment[];
  cargos: Cargo[];
  activeStatus: ShipmentStatus;
  onStatusChange: (status: ShipmentStatus) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  marginOperator: '>' | '<' | '';
  onMarginOperatorChange: (op: '>' | '<' | '') => void;
  marginValue: string;
  onMarginValueChange: (val: string) => void;
  stays?: StayRecord[];
  filterCte?: string;
  onFilterCteChange?: (val: string) => void;
  filterNfe?: string;
  onFilterNfeChange?: (val: string) => void;
  filterMdfe?: string;
  onFilterMdfeChange?: (val: string) => void;
  filterId?: string;
  onFilterIdChange?: (val: string) => void;
  filterSolicitante?: string;
  onFilterSolicitanteChange?: (val: string) => void;
  users?: User[];
}

const ShipmentHistoryFilter: React.FC<ShipmentHistoryFilterProps> = ({ 
  shipments, 
  cargos,
  activeStatus, 
  onStatusChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  marginOperator,
  onMarginOperatorChange,
  marginValue,
  onMarginValueChange,
  stays = [],
  filterCte = '',
  onFilterCteChange,
  filterNfe = '',
  onFilterNfeChange,
  filterMdfe = '',
  onFilterMdfeChange,
  filterId = '',
  onFilterIdChange,
  filterSolicitante = '',
  onFilterSolicitanteChange,
  users = [],
}) => {
  const cargoMap = React.useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

  const getEmbarcadorName = (embarcadorId: string): string => {
    return users.find(u => u.id === embarcadorId)?.name || 'N/A';
  };

  const solicitantesList = React.useMemo(() => {
    const list = Array.from(new Set(shipments.map(s => {
      const u = users.find(usr => usr.id === s.embarcadorId);
      return u ? { id: u.id, name: u.name } : null;
    }))).filter((item): item is { id: string; name: string } => !!item && !!item.name);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [shipments, users]);

  const calculateMargin = (s: Shipment) => {
    const cargo = cargoMap.get(s.cargoId);
    if (!cargo) return 0;
    const grossRate = s.companyFreightRateSnapshot || cargo.companyFreightValuePerTon || 0;
    const driverRate = s.driverFreightRateSnapshot || (s.driverFreightValue / (s.shipmentTonnage || 1));
    const commissionRate = cargo.salespersonCommissionPerTon || 0;
    
    const demurrageProfit = stays
        .filter(stay => isStayForShipment(stay, s))
        .reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
        
    return ((grossRate - driverRate - commissionRate) * s.shipmentTonnage) + demurrageProfit;
  };

  const getStatusCount = (status: ShipmentStatus) => {
    return shipments.filter(s => {
      const matchesStatus = s.status === status;
      let matchesDate = true;
      if (startDate) matchesDate = matchesDate && s.scheduledDate >= startDate;
      if (endDate) matchesDate = matchesDate && s.scheduledDate <= endDate;
      
      let matchesMargin = true;
      if (marginOperator && marginValue !== '') {
        const margin = calculateMargin(s);
        const val = parseFloat(marginValue);
        if (marginOperator === '>') matchesMargin = margin > val;
        else if (marginOperator === '<') matchesMargin = margin < val;
      }
      
      return matchesStatus && matchesDate && matchesMargin;
    }).length;
  };

  const statusOrder = [ShipmentStatus.Finalizado, ShipmentStatus.Cancelado];

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
        {/* Filtro por ID */}
        {onFilterIdChange && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">ID:</label>
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Buscar ID..."
                value={filterId} 
                onChange={(e) => onFilterIdChange(e.target.value)}
                className="pl-8 pr-7 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white w-32 sm:w-36"
              />
              {filterId && (
                <button
                  onClick={() => onFilterIdChange('')}
                  className="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  title="Limpar filtro de ID"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filtro por Solicitante */}
        {onFilterSolicitanteChange && (
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-500" />
              Solicitante:
            </label>
            <select
              value={filterSolicitante}
              onChange={(e) => onFilterSolicitanteChange(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
            >
              <option value="">Todos os Solicitantes</option>
              {solicitantesList.map(sol => (
                <option key={sol.id} value={sol.id}>{sol.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">De:</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => onStartDateChange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Até:</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => onEndDateChange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
          />
        </div>
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Margem (Total):</label>
          <div className="flex items-center gap-1">
            <select 
              value={marginOperator}
              onChange={(e) => onMarginOperatorChange(e.target.value as '>' | '<' | '')}
              className="px-2 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
            >
              <option value="">Operador</option>
              <option value=">">Maior que (&gt;)</option>
              <option value="<">Menor que (&lt;)</option>
            </select>
            <input 
              type="number" 
              placeholder="Valor R$"
              value={marginValue} 
              onChange={(e) => onMarginValueChange(e.target.value)}
              className="w-24 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
            />
          </div>
        </div>

        <button 
          onClick={() => {
            if (onFilterIdChange) onFilterIdChange('');
            if (onFilterSolicitanteChange) onFilterSolicitanteChange('');
            onStartDateChange('');
            onEndDateChange('');
            onMarginOperatorChange('');
            onMarginValueChange('');
            if (onFilterCteChange) onFilterCteChange('');
            if (onFilterNfeChange) onFilterNfeChange('');
            if (onFilterMdfeChange) onFilterMdfeChange('');
          }}
          className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase ml-auto"
        >
          Limpar Filtros
        </button>
      </div>

      {/* Filtro compacto por CT-e */}
      {onFilterCteChange && (
        <div className="flex items-center gap-2 px-1 mb-2">
          <div className="relative flex items-center">
            <FileText className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filtrar por CT-e..."
              value={filterCte || ''}
              onChange={e => onFilterCteChange(e.target.value)}
              className="pl-8 pr-7 py-1 text-xs font-semibold border border-blue-200 dark:border-blue-800/60 rounded-lg bg-blue-50/40 dark:bg-blue-900/20 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-36 transition-all shadow-sm"
            />
            {filterCte && (
              <button
                onClick={() => onFilterCteChange('')}
                className="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Limpar filtro"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
          {statusOrder.map((status) => (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeStatus === status
                  ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
              }`}
            >
              {status}
              <span className={`ml-2 inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${
                 activeStatus === status
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
              }`}>
                {getStatusCount(status)}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default ShipmentHistoryFilter;