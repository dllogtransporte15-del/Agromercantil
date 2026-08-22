
import React from 'react';
import { ShipmentStatus } from '../types';
import type { Shipment, Cargo } from '../types';
import { getShipmentStatusLabel } from '../utils';

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
  onMarginValueChange
}) => {
  const cargoMap = React.useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

  const calculateMargin = (s: Shipment) => {
    const cargo = cargoMap.get(s.cargoId);
    if (!cargo) return 0;
    const grossRate = s.companyFreightRateSnapshot || cargo.companyFreightValuePerTon || 0;
    const driverRate = s.driverFreightRateSnapshot || (s.driverFreightValue / (s.shipmentTonnage || 1));
    return (grossRate - driverRate) * s.shipmentTonnage;
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
            onStartDateChange('');
            onEndDateChange('');
            onMarginOperatorChange('');
            onMarginValueChange('');
          }}
          className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase ml-auto"
        >
          Limpar Filtros
        </button>
      </div>

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
              {getShipmentStatusLabel(status)}
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