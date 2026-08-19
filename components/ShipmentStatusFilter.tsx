
import React, { useMemo } from 'react';
import { ShipmentStatus, UserProfile } from '../types';
import type { Shipment, User } from '../types';
import { Zap, Layers } from 'lucide-react';

interface ShipmentStatusFilterProps {
  shipments: Shipment[];
  activeStatus: ShipmentStatus | 'all';
  onStatusChange: (status: ShipmentStatus | 'all') => void;
  currentUser: User;
  isSimplifiedView?: boolean;
  onToggleSimplifiedView?: (isSimplified: boolean) => void;
}

const SIMPLIFIED_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.AguardandoSeguradora,
  ShipmentStatus.AguardandoCarregamento,
  ShipmentStatus.AguardandoNota,
  ShipmentStatus.AguardandoDescarga,
];

const ShipmentStatusFilter: React.FC<ShipmentStatusFilterProps> = ({ 
  shipments, 
  activeStatus, 
  onStatusChange, 
  currentUser,
  isSimplifiedView = false,
  onToggleSimplifiedView,
}) => {
  const getStatusCount = (status: ShipmentStatus | 'all') => {
    const relevantShipments = isSimplifiedView 
      ? shipments.filter(s => s.isSimplified)
      : shipments;

    if (status === 'all') {
      return relevantShipments.filter(s => 
        s.status !== ShipmentStatus.Cancelado && 
        s.status !== ShipmentStatus.Finalizado
      ).length;
    }
    return relevantShipments.filter(s => s.status === status).length;
  };

  const statusOrder = useMemo(() => {
    if (isSimplifiedView) {
      return [...SIMPLIFIED_STATUSES, 'all' as const];
    }

    let statuses: (ShipmentStatus | 'all')[] = Object.values(ShipmentStatus).filter(
      status => status !== ShipmentStatus.Finalizado && status !== ShipmentStatus.Cancelado
    );

    if (currentUser.profile === UserProfile.Cliente) {
      statuses = statuses.filter(status => 
        status !== ShipmentStatus.AguardandoAdiantamento && 
        status !== ShipmentStatus.AguardandoPagamentoSaldo
      );
    }
    
    // Add "Todos" as the last tab
    statuses.push('all');
    
    return statuses;
  }, [currentUser, isSimplifiedView]);

  const getStatusLabel = (status: ShipmentStatus | 'all') => {
    if (status === 'all') return 'Todos';
    return status;
  };

  return (
    <div className="mb-6 space-y-3">
      {/* Top View Selector: Modo Completo vs Modo Simplificado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner">
          <button
            type="button"
            onClick={() => onToggleSimplifiedView?.(false)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !isSimplifiedView
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Fluxo Completo</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleSimplifiedView?.(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isSimplifiedView
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'text-gray-500 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Modo Simplificado</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              isSimplifiedView ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
            }`}>
              {shipments.filter(s => s.isSimplified && s.status !== ShipmentStatus.Finalizado && s.status !== ShipmentStatus.Cancelado).length}
            </span>
          </button>
        </div>

        {isSimplifiedView && (
          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/60">
            <span>⚡ Exibindo apenas status do fluxo simplificado (Ag. Seguradora → Ag. Carregamento → Ag. Nota → Ag. Descarga)</span>
          </div>
        )}
      </div>

      {/* Tabs list */}
      <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <nav className="flex space-x-2 overflow-x-auto pb-1 custom-scrollbar" aria-label="Tabs">
          {statusOrder.map((status) => (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              className={`whitespace-nowrap py-2.5 px-5 rounded-xl font-bold text-[13px] transition-all duration-300 flex items-center gap-2 flex-shrink-0 border border-transparent ${
                activeStatus === status
                  ? 'bg-primary text-white shadow-md shadow-blue-500/20 transform scale-[1.02] border-blue-400 dark:border-blue-500'
                  : 'bg-gray-50/50 dark:bg-gray-900/20 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50 hover:text-primary dark:hover:text-blue-400 border-gray-100 dark:border-gray-800'
              }`}
            >
              <span>{getStatusLabel(status)}</span>
              <span className={`inline-block py-0.5 px-2 rounded-lg text-xs font-black shadow-inner transition-colors duration-300 ${
                 activeStatus === status
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200/80 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
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

export default ShipmentStatusFilter;