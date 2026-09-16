import React from 'react';
import { X, Truck, Calendar, Weight, Info } from 'lucide-react';
import type { Cargo, Shipment, User, Client, Product, Vehicle } from '../types';
import ShipmentDetailsModal from './ShipmentDetailsModal';

interface CargoShipmentsSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  cargo: Cargo | null;
  shipments: Shipment[];
  users: User[];
  currentUser: User;
  onUpdatePrice: (shipmentId: string, data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  clients: Client[];
  products: Product[];
  companyLogo?: string | null;
  vehicles: Vehicle[];
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
  onSwapCargo?: (shipmentId: string, newCargoId: string) => void;
  cargos?: Cargo[];
}



const CargoShipmentsSidePanel: React.FC<CargoShipmentsSidePanelProps> = ({ 
  isOpen, 
  onClose, 
  cargo, 
  shipments,
  users,
  currentUser,
  onUpdatePrice,
  clients,
  products,
  companyLogo,
  vehicles,
  onDeleteAttachment,
  onSwapCargo,
  cargos = []
}) => {


  const [selectedShipment, setSelectedShipment] = React.useState<Shipment | null>(null);
  
  // Sync selected shipment with latest data from props
  React.useEffect(() => {
    if (selectedShipment) {
      const updated = shipments.find(s => s.id === selectedShipment.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedShipment)) {
        setSelectedShipment(updated);
      }
    }
  }, [shipments, selectedShipment]);

  if (!cargo) return null;

  const cargoShipments = shipments.filter(s => s.cargoId === cargo.id);

  const getEmbarcadorName = (id: string) => users.find(u => u.id === id)?.name || 'N/A';

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity z-[60] ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Embarques da Carga #{cargo.sequenceId}</h2>
                {cargo.tmsLoteNumber && (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700/60" title={`Lote TMS: ${cargo.tmsLoteNumber}`}>
                    Lote TMS: {cargo.tmsLoteNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total de {cargoShipments.length} embarques encontrados</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cargoShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Info className="w-12 h-12 mb-2 opacity-20" />
                <p>Nenhum embarque programado ainda.</p>
              </div>
            ) : (
              cargoShipments.map((shipment) => (
                <div 
                  key={shipment.id}
                  onClick={() => {
                    if (currentUser.profile !== 'Cliente') {
                      setSelectedShipment(shipment);
                    }
                  }}
                  className={`bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700 rounded-xl p-4 transition-shadow relative ${currentUser.profile !== 'Cliente' ? 'cursor-pointer hover:shadow-md' : ''}`}
                >
                  <div className="absolute top-4 right-4">
                    <Info className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{shipment.driverName}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{shipment.horsePlate}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                      shipment.status === 'Finalizado' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                      shipment.status === 'Cancelado' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    }`}>
                      {shipment.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-bold tracking-tight">
                        <Calendar className="w-3 h-3" /> Programação
                      </div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {new Date(shipment.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR')} {shipment.scheduledTime || ''}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-bold tracking-tight">
                        <Weight className="w-3 h-3" /> Tonelagem
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {(Number(shipment.shipmentTonnage) || 0).toLocaleString('pt-BR')} ton
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 text-[10px] text-gray-400 italic">
                    Solicitante: <span className="font-medium text-gray-500 dark:text-gray-300">{getEmbarcadorName(shipment.embarcadorId)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <ShipmentDetailsModal 
          isOpen={!!selectedShipment}
          onClose={() => setSelectedShipment(null)}
          shipment={selectedShipment}
          cargo={cargo || (selectedShipment ? cargos.find(c => c.id === selectedShipment.cargoId) : undefined)}
          currentUser={currentUser}
          onUpdatePrice={onUpdatePrice}
          clients={clients}
          products={products}
          companyLogo={companyLogo}
          vehicles={vehicles}
          users={users}
          onDeleteAttachment={onDeleteAttachment}
          onSwapCargo={onSwapCargo}
          cargos={cargos}
        />


      </div>
    </>
  );
};

export default CargoShipmentsSidePanel;
