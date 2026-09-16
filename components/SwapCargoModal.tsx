
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Trocar Carga do Embarque</h2>
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

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {availableCargos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Info className="w-12 h-12 mb-2 opacity-20" />
                <p>Nenhuma carga disponível encontrada.</p>
              </div>
            ) : (
              availableCargos.map((cargo) => {
                const client = clients.find(cl => cl.id === cargo.clientId);
                const product = products.find(p => p.id === cargo.productId);
                const isSelected = selectedCargoId === cargo.id;
                const remainingVol = cargo.totalVolume - cargo.scheduledVolume;

                return (
                  <div 
                    key={cargo.id}
                    onClick={() => setSelectedCargoId(cargo.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                      isSelected 
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary' 
                        : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-900/30'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-400 border dark:border-gray-700'}`}>
                          <Package size={16} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm">#{cargo.sequenceId} - {client?.nomeFantasia}</h4>
                          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{product?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${remainingVol > shipment.shipmentTonnage ? 'bg-green-100 text-green-700 dark:bg-green-900/40' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40'}`}>
                            {remainingVol.toLocaleString('pt-BR')} ton livres
                         </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 mt-3 text-xs">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin size={14} className="text-gray-400" />
                        <span>{cargo.origin} → {cargo.destination}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 justify-end">
                        <DollarSign size={14} className="text-gray-400" />
                        <span className="font-semibold text-gray-900 dark:text-gray-200">
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
            Confirmar Troca
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapCargoModal;
