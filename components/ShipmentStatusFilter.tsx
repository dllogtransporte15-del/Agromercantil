
import React, { useMemo } from 'react';
import { ShipmentStatus, UserProfile } from '../types';
import type { Shipment, User } from '../types';
import { Zap } from 'lucide-react';

interface ShipmentStatusFilterProps {
  shipments: Shipment[];
  activeStatus: ShipmentStatus | 'all';
  onStatusChange: (status: ShipmentStatus | 'all') => void;
  currentUser: User;
  isSimplifiedView?: boolean;
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
      {isSimplifiedView && (
        <div className="flex items-center justify-between bg-blue-50/80 dark:bg-blue-950/40 px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800/60 text-xs text-blue-700 dark:text-blue-300 font-medium">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span><strong>Modo Simplificado Ativo:</strong> Exibindo exclusivamente status do fluxo simplificado (Ag. Seguradora → Ag. Carregamento → Ag. Nota → Ag. Descarga).</span>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
            Monitoramento
          </span>
        </div>
      )}

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