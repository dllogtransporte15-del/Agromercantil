
import React from 'react';
import { X, Calendar, Package, MapPin, TrendingUp, Info } from 'lucide-react';
import type { Shipment, Cargo, ShipmentStatus } from '../types';

interface ShipmentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: Shipment[];
  cargos: Cargo[];
  title: string;
}

const ShipmentHistoryModal: React.FC<ShipmentHistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  shipments, 
  cargos, 
  title 
}) => {
  if (!isOpen) return null;

  const getCargoInfo = (cargoId: string) => {
    return cargos.find(c => c.id === cargoId);
  };

  const getStatusColor = (status: ShipmentStatus) => {
    switch (status) {
      case 'Finalizado': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Cancelado': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const totalTonnage = shipments.reduce((acc, s) => acc + (s.shipmentTonnage || 0), 0);
  const totalValue = shipments.reduce((acc, s) => acc + (s.driverFreightValue || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              {title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Visualizando histórico consolidado de embarques no sistema.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 p-6 bg-gray-50/30 dark:bg-gray-800/20 border-b dark:border-gray-700">
          <div className="bg-white dark:bg-gray-700 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total de Embarques</span>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{shipments.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-700 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tonnagem Total</span>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{totalTonnage.toFixed(2)} <span className="text-sm font-normal text-gray-400">ton</span></p>
          </div>
          <div className="bg-white dark:bg-gray-700 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor Total (Motorista)</span>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {shipments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <Info className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum registro de embarque encontrado para este cadastro.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b dark:border-gray-700">
                  <th className="pb-4 pt-2 px-2">Data</th>
                  <th className="pb-4 pt-2 px-2">Seq. Carga</th>
                  <th className="pb-4 pt-2 px-2">Rota (Origem x Destino)</th>
                  <th className="pb-4 pt-2 px-2">Tonnagem</th>
                  <th className="pb-4 pt-2 px-2">Status</th>
                  <th className="pb-4 pt-2 px-2 text-right">Frete Total</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {shipments.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map(shipment => {
                  const cargo = getCargoInfo(shipment.cargoId);
                  return (
                    <tr key={shipment.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(shipment.scheduledDate).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">#{cargo?.sequenceId || '---'}</span>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300">
                            <MapPin className="w-3 h-3 text-red-500" />
                            {cargo?.origin || '---'}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300">
                            <MapPin className="w-3 h-3 text-green-500" />
                            {cargo?.destination || '---'}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-200">
                          <Package className="w-4 h-4 text-gray-400" />
                          {shipment.shipmentTonnage?.toFixed(2)} ton
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${getStatusColor(shipment.status)}`}>
                          {shipment.status}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-right">
                        <span className="text-sm font-black text-gray-800 dark:text-white">
                          R$ {shipment.driverFreightValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            Fechar Histórico
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipmentHistoryModal;
