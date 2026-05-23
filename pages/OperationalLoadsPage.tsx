
import React, { useState } from 'react';
import Header from '../components/Header';
import LoadTable from '../components/LoadTable';
import NewShipmentModal from '../components/NewShipmentModal';
import LoadFormModal from '../components/LoadFormModal';
import HistoryModal from '../components/HistoryModal';
import CargoDetailsModal from '../components/CargoDetailsModal';
import CargoShipmentsSidePanel from '../components/CargoShipmentsSidePanel';
import type { Cargo, Client, Product, Driver, Shipment, Vehicle, User, ProfilePermissions, VehicleSetType, VehicleBodyType, Branch } from '../types';
import { can } from '../auth';
import { CopyIcon } from '../components/icons/CopyIcon';
import { CargoStatus, UserProfile } from '../types';

interface OperationalLoadsPageProps {
  loads: Cargo[];
  clients: Client[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  shipments: Shipment[];
  onCreateShipment: (data: any) => void;
  onSaveLoad: (loadData: Cargo | Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'>) => void;
  currentUser: User;
  profilePermissions: ProfilePermissions;
  users: User[];
  onDeleteLoad: (cargoId: string) => void;
  onReactivateLoad?: (cargo: Cargo) => void;
  onSuspendLoad?: (cargo: Cargo) => void;
  onUpdatePrice: (shipmentId: string, data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  onModalStateChange: (isOpen: boolean) => void;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
  branches: Branch[];
}

const formatAllowedVehicleTypes = (allowed?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]): string => {
    if (!allowed || allowed.length === 0) return 'N/A';
    const allBodyTypes = allowed.flatMap(type => type.bodyTypes || []);
    const uniqueBodyTypes = [...new Set(allBodyTypes)];
    return uniqueBodyTypes.join(';');
};

const OperationalLoadsPage: React.FC<OperationalLoadsPageProps> = ({
  loads,
  clients,
  products,
  drivers,
  vehicles,
  shipments,
  onCreateShipment,
  onSaveLoad,
  currentUser,
  profilePermissions,
  users,
  onDeleteLoad,
  onReactivateLoad,
  onSuspendLoad,
  onUpdatePrice,
  onModalStateChange,
  onDeleteAttachment,
  branches,
}) => {
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [copyButtonText, setCopyButtonText] = useState('Divulgar Cargas');
  const [dailyBalanceDate, setDailyBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const canCreateShipment = can('create', currentUser, 'shipments', profilePermissions);

  const [isLoadFormModalOpen, setIsLoadFormModalOpen] = useState(false);
  const [loadToEdit, setLoadToEdit] = useState<Cargo | null>(null);
  const [initialModalStep, setInitialModalStep] = useState(1);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedLoadForHistory, setSelectedLoadForHistory] = useState<Cargo | null>(null);
  const [detailsModalCargo, setDetailsModalCargo] = useState<Cargo | null>(null);
  const [isShipmentsPanelOpen, setIsShipmentsPanelOpen] = useState(false);
  const [selectedCargoForShipments, setSelectedCargoForShipments] = useState<Cargo | null>(null);

  React.useEffect(() => {
    const isAnyOpen = isShipmentModalOpen || isLoadFormModalOpen || isHistoryModalOpen || !!detailsModalCargo || isShipmentsPanelOpen;
    onModalStateChange(isAnyOpen);
  }, [isShipmentModalOpen, isLoadFormModalOpen, isHistoryModalOpen, detailsModalCargo, isShipmentsPanelOpen, onModalStateChange]);

  const handleShowCargoDetails = (cargo: Cargo) => {
    setDetailsModalCargo(cargo);
  };

  const handleShowShipments = (cargo: Cargo) => {
    setSelectedCargoForShipments(cargo);
    setIsShipmentsPanelOpen(true);
  };

  const handleOpenNewShipmentModal = (cargo: Cargo) => {
    setSelectedCargo(cargo);
    setIsShipmentModalOpen(true);
  };

  const handleCloseShipmentModal = () => {
    setIsShipmentModalOpen(false);
    setSelectedCargo(null);
  };

  const handleCloseLoadFormModal = () => {
    setIsLoadFormModalOpen(false);
    setLoadToEdit(null);
  };

  const handleShowHistory = (load: Cargo) => {
    setSelectedLoadForHistory(load);
    setIsHistoryModalOpen(true);
  };

  const handleSaveAndCloseModal = (load: Cargo | Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'>) => {
    onSaveLoad(load);
    handleCloseLoadFormModal();
  };

  const handleSaveShipment = (shipmentData: any) => {
    if (selectedCargo) {
      onCreateShipment({
        cargoId: selectedCargo.id,
        ...shipmentData,
      });
    }
    handleCloseShipmentModal();
  };
  
  const handleShareLoads = () => {
    const activeLoads = loads.filter(load => load.status === CargoStatus.EmAndamento);
    if (activeLoads.length === 0) {
      alert('Nenhuma carga em andamento para divulgar.');
      return;
    }

    const header = '🌐 *LIBERADOS AGROMARCANTIL* 🌐\n';

    const loadsText = activeLoads.map(load => {
      const product = products.find(p => p.id === load.productId)?.name?.toUpperCase() || 'N/A';
      const origin = load.origin.toUpperCase();
      const destination = load.destination.toUpperCase();
      const price = load.driverFreightValuePerTon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const bodyTypes = formatAllowedVehicleTypes(load.allowedVehicleTypes);

      let text = `📍 ${origin} x ${destination} \n🌾 ${product} - 💲 R$ ${price}\t\n🚛 ${bodyTypes} 🚛`;
      
      if (load.originMapLink) {
        text += `\n📍Coleta - ${load.originMapLink}`;
      }
      if (load.destinationMapLink) {
        text += `\n📍Entrega - ${load.destinationMapLink}`;
      }
      return text;
    }).join('\n\n');

    const textToCopy = header + '\n' + loadsText;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyButtonText('Copiado!');
      setTimeout(() => setCopyButtonText('Divulgar Cargas'), 3000);
    }, (err) => {
      console.error('Falha ao copiar: ', err);
      alert('Não foi possível copiar as cargas. Verifique as permissões do navegador.');
    });
  };

  return (
    <>
      <Header title="Cargas em Operação">
        <button
          onClick={handleShareLoads}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200"
        >
          <CopyIcon className="w-5 h-5 mr-2" />
          {copyButtonText}
        </button>
      </Header>
      
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Lista de Cargas em Andamento</h2>
      <LoadTable 
        loads={loads} 
        clients={clients} 
        products={products}
        shipments={shipments}
        dailyBalanceDate={dailyBalanceDate}
        onDailyBalanceDateChange={setDailyBalanceDate}
        onCreateShipment={canCreateShipment ? handleOpenNewShipmentModal : undefined} 
        onShowHistory={handleShowHistory}
        onReactivate={currentUser.profile !== UserProfile.Embarcador ? onReactivateLoad : undefined}
        onSuspend={currentUser.profile !== UserProfile.Embarcador ? onSuspendLoad : undefined}
        onShowDetails={handleShowCargoDetails}
        onShowShipments={handleShowShipments}
        onDelete={onDeleteLoad}
        currentUser={currentUser}
        profilePermissions={profilePermissions}
      />

      <NewShipmentModal
        isOpen={isShipmentModalOpen}
        onClose={handleCloseShipmentModal}
        onSave={handleSaveShipment}
        cargo={selectedCargo}
        drivers={drivers}
        clients={clients}
        vehicles={vehicles}
        currentUser={currentUser}
        shipments={shipments}
        users={users}
      />

      <LoadFormModal
        isOpen={isLoadFormModalOpen}
        onClose={handleCloseLoadFormModal}
        onSave={handleSaveAndCloseModal}
        loadToEdit={loadToEdit}
        clients={clients}
        products={products}
        currentUser={currentUser}
        users={users}
        loads={loads}
        branches={branches}
        initialStep={initialModalStep}
      />
      
      {selectedLoadForHistory && (
          <HistoryModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            history={selectedLoadForHistory.history}
            users={users}
            title={`Histórico da Carga ${selectedLoadForHistory.sequenceId}`}
          />
      )}

      <CargoDetailsModal
        isOpen={!!detailsModalCargo}
        onClose={() => setDetailsModalCargo(null)}
        cargo={detailsModalCargo}
        client={detailsModalCargo ? clients.find(c => c.id === detailsModalCargo.clientId) : undefined}
        product={detailsModalCargo ? products.find(p => p.id === detailsModalCargo.productId) : undefined}
        commercialUser={detailsModalCargo ? users.find(u => u.id === detailsModalCargo.createdById) : undefined}
      />

      <CargoShipmentsSidePanel
        isOpen={isShipmentsPanelOpen}
        onClose={() => setIsShipmentsPanelOpen(false)}
        cargo={selectedCargoForShipments}
        shipments={shipments}
        users={users}
        currentUser={currentUser}
        onUpdatePrice={onUpdatePrice}
        clients={clients}
        products={products}
        vehicles={vehicles}
        onDeleteAttachment={onDeleteAttachment}
      />
    </>
  );
};

export default OperationalLoadsPage;
