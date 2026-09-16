
import React, { useState, useMemo } from 'react';
import type { Shipment, Cargo, Client, Product } from '../types';
import { CargoStatus } from '../types';
import { useToast } from '../hooks/useToast';
import { Search, Info, Package, MapPin, DollarSign, Weight } from 'lucide-react';

interface SwapCargoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (shipmentId: string, newCargoId: string) => void;
  shipment: Shipment | null;
  cargos: Cargo[];
  clients: Client[];
  products: Product[];
}

const SwapCargoModal: React.FC<SwapCargoModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  shipment, 
  cargos, 
  clients, 
  products 
}) => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargoId, setSelectedCargoId] = useState<string>('');

  const availableCargos = useMemo(() => {
    return (cargos || []).filter(c => {
      // Must not be closed
      if (c.status === CargoStatus.Fechada) return false;
      
      // Current cargo should be excluded
      if (shipment && (c.id === shipment.cargoId || (c.sequenceId && `CRG-${c.sequenceId}` === shipment.cargoId))) return false;

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const client = clients.find(cl => cl.id === c.clientId)?.nomeFantasia?.toLowerCase() || '';
        const product = products.find(p => p.id === c.productId)?.name?.toLowerCase() || '';
        return (
          (c.origin && c.origin.toLowerCase().includes(searchLower)) ||
          (c.destination && c.destination.toLowerCase().includes(searchLower)) ||
          client.includes(searchLower) ||
          product.includes(searchLower) ||
          (c.sequenceId && c.sequenceId.toString().includes(searchLower)) ||
          (c.id && c.id.toLowerCase().includes(searchLower))
        );
      }
      return true;
    }).sort((a, b) => b.sequenceId - a.sequenceId);
  }, [cargos, shipment, searchTerm, clients, products]);

  const handleConfirm = () => {
    if (!shipment) return;
    if (!selectedCargoId) {
      showToast('Por favor, selecione uma nova carga.', 'warning');
      return;
    }
    onConfirm(shipment.id, selectedCargoId);
    onClose();
  };

  if (!isOpen || !shipment) return null;

  const currentCargo = cargos.find(c => c.id === shipment.cargoId);
  const currentClient = clients.find(c => c.id === currentCargo?.clientId);
  const currentProduct = products.find(p => p.id === currentCargo?.productId);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Remanejar Carga do Embarque</h2>
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-1">Embarque Atual</p>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-white">{shipment.id} - {shipment.driverName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentClient?.nomeFantasia} | {currentProduct?.name} | {currentCargo?.origin} → {currentCargo?.destination}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{(Number(shipment.shipmentTonnage) || 0).toLocaleString('pt-BR')} ton</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Pesquisar por Cliente, Produto, Origem, Destino ou ID..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {availableCargos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma outra carga disponível no momento.
              </div>
            ) : (
              availableCargos.map((cargo) => {
                const client = clients.find(c => c.id === cargo.clientId);
                const product = products.find(p => p.id === cargo.productId);
                const isSelected = selectedCargoId === cargo.id;

                return (
                  <div 
                    key={cargo.id}
                    onClick={() => setSelectedCargoId(cargo.id)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary bg-blue-50/50 dark:bg-blue-900/20 shadow-md scale-[1.01]' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 dark:text-white">#{cargo.sequenceId}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {product?.name}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mt-1">
                          {client?.nomeFantasia}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <MapPin size={12} className="text-gray-400" />
                          <span>{cargo.origin} → {cargo.destination}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block">
                          Disp: {((cargo.totalVolume || 0) - (cargo.scheduledVolume || 0)).toLocaleString('pt-BR')} ton
                        </span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-1 block">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cargo.driverFreightValuePerTon)}/ton
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <button 
            type="button" 
            onClick={onClose} 
            className="py-2 px-6 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleConfirm}
            disabled={!selectedCargoId}
            className={`py-2 px-8 text-sm font-bold rounded-lg transition-all shadow-md ${
              selectedCargoId 
                ? 'bg-primary text-white hover:bg-primary-dark scale-100' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed scale-95 opacity-50'
            }`}
          >
            Confirmar Remanejamento
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapCargoModal;
