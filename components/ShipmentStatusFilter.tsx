
import React, { useMemo } from 'react';
import { ShipmentStatus, UserProfile } from '../types';
import type { Shipment, User } from '../types';

interface ShipmentStatusFilterProps {
  shipments: Shipment[];
  activeStatus: ShipmentStatus | 'all';
  onStatusChange: (status: ShipmentStatus | 'all') => void;
  currentUser: User;
}

const ShipmentStatusFilter: React.FC<ShipmentStatusFilterProps> = ({ shipments, activeStatus, onStatusChange, currentUser }) => {
  const getStatusCount = (status: ShipmentStatus | 'all') => {
    if (status === 'all') {
      return shipments.filter(s => 
        s.status !== ShipmentStatus.Cancelado && 
        s.status !== ShipmentStatus.Finalizado
      ).length;
    }
    return shipments.filter(s => s.status === status).length;
  };

  const statusOrder = useMemo(() => {
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
  }, [currentUser]);

  const getStatusLabel = (status: ShipmentStatus | 'all') => {
    if (status === 'all') return 'Todos';
    return status;
  };

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
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
  );
};

export default ShipmentStatusFilter;