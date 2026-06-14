
import React, { useState } from 'react';
import Header from '../components/Header';
import LoadTable from '../components/LoadTable';
import LoadFormModal from '../components/LoadFormModal';
import HistoryModal from '../components/HistoryModal';
import CargoDetailsModal from '../components/CargoDetailsModal';
import CargoShipmentsSidePanel from '../components/CargoShipmentsSidePanel';
import type { Cargo, Client, Product, User, ProfilePermissions, Shipment, DailyScheduleEntry, Vehicle, Branch } from '../types';
import { CargoStatus, UserProfile } from '../types';
import { can } from '../auth';

interface LoadsPageProps {
  loads: Cargo[];
  setLoads: React.Dispatch<React.SetStateAction<Cargo[]>>;
  clients: Client[];
  products: Product[];
  shipments: Shipment[];
  vehicles: Vehicle[];
  // FIX: Changed Omit to use a union type for the keys to be omitted.
  onSaveLoad: (loadData: Cargo | Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'>) => void;
  currentUser: User;
  profilePermissions: ProfilePermissions;
  users: User[];
  onDeleteLoad: (cargoId: string) => void;
  onReactivateLoad?: (cargo: Cargo) => void;
  onSuspendLoad?: (cargo: Cargo) => void;
  onUpdateTmsBatch?: (cargoId: string, tmsBatchNumber: string, destId?: string) => void;
  onUpdatePrice: (shipmentId: string, data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  onModalStateChange: (isOpen: boolean) => void;
  companyLogo?: string | null;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
  branches: Branch[];
}


const LoadsPage: React.FC<LoadsPageProps> = ({ loads, setLoads, clients, products, shipments, onSaveLoad, onReactivateLoad, onSuspendLoad, onUpdateTmsBatch, onUpdatePrice, currentUser, profilePermissions, users, onDeleteLoad, onModalStateChange, companyLogo, vehicles, onDeleteAttachment, branches }) => {

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadToEdit, setLoadToEdit] = useState<Cargo | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedLoadForHistory, setSelectedLoadForHistory] = useState<Cargo | null>(null);
  const [dailyBalanceDate, setDailyBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialModalStep, setInitialModalStep] = useState(1);
  const [detailsModalCargo, setDetailsModalCargo] = useState<Cargo | null>(null);
  const [isShipmentsPanelOpen, setIsShipmentsPanelOpen] = useState(false);
  const [selectedCargoForShipments, setSelectedCargoForShipments] = useState<Cargo | null>(null);

  React.useEffect(() => {
    const isAnyOpen = isModalOpen || isHistoryModalOpen || !!detailsModalCargo || isShipmentsPanelOpen;
    onModalStateChange(isAnyOpen);
  }, [isModalOpen, isHistoryModalOpen, detailsModalCargo, isShipmentsPanelOpen, onModalStateChange]);

  const handleShowDetails = (cargo: Cargo) => {
    setDetailsModalCargo(cargo);
  };

  const handleShowShipments = (cargo: Cargo) => {
    setSelectedCargoForShipments(cargo);
    setIsShipmentsPanelOpen(true);
  };


  const canCreate = can('create', currentUser, 'loads', profilePermissions);
  const canUpdate = can('update', currentUser, 'loads', profilePermissions);
  const canDelete = can('delete', currentUser, 'loads', profilePermissions);
  const canCloseLoad = [UserProfile.Diretor, UserProfile.Coordenador, UserProfile.Comercial].includes(currentUser.profile as UserProfile) || canDelete;

  const handleOpenModal = () => {
    setLoadToEdit(null);
    setInitialModalStep(1);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleEditLoad = (load: Cargo) => {
    setLoadToEdit(load);
    setInitialModalStep(1);
    setIsModalOpen(true);
  };
  
  // FIX: Changed Omit to use a union type for the keys to be omitted.
  const handleSaveLoad = (load: Cargo | Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'>) => {
    onSaveLoad(load);
    handleCloseModal();
  };

  const handleCloseLoad = (cargoToClose: Cargo) => {
    const reason = window.prompt(`Tem certeza que deseja fechar a carga ${cargoToClose.sequenceId}? Essa ação mudará o status para "Fechada". Por favor, informe o motivo:`);
    if (reason === null) return;
    if (!reason.trim()) {
        alert("É obrigatório informar o motivo para fechar a carga.");
        return;
    }
    
    // We need to pass the history. But App.tsx handleSaveLoad needs to be able to use it.
    // Wait, I will edit App.tsx to prioritize loadData.history if provided.
    // For now, let's pass it. If I don't change App.tsx, the history will be overridden.
    onSaveLoad({ 
        ...cargoToClose, 
        status: CargoStatus.Fechada,
        history: [...cargoToClose.history, { date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString('pt-BR', { hour12: false }), description: `Carga fechada. Motivo: ${reason}` }] 
    } as Cargo);
  };

  const handleShowHistory = (load: Cargo) => {
    setSelectedLoadForHistory(load);
    setIsHistoryModalOpen(true);
  };

  const handleEditSchedule = (load: Cargo) => {
    setLoadToEdit(load);
    setInitialModalStep(2); // Step 2 is the scheduling timeline
    setIsModalOpen(true);
  };

  return (
    <>
      <Header title="Cadastro de Cargas">
        {canCreate && (
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Adicionar Carga
          </button>
        )}
      </Header>
      
      <div className="mt-6">
        <LoadTable 
            loads={loads} 
            clients={clients} 
            products={products}
            shipments={shipments}
            dailyBalanceDate={dailyBalanceDate}
            onDailyBalanceDateChange={setDailyBalanceDate}
            onEdit={canUpdate ? handleEditLoad : undefined}
            onClose={canCloseLoad ? handleCloseLoad : undefined}
            onShowHistory={handleShowHistory}
            onReactivate={currentUser.profile !== UserProfile.Embarcador ? onReactivateLoad : undefined}
            onSuspend={currentUser.profile !== UserProfile.Embarcador ? onSuspendLoad : undefined}
            onUpdateTmsBatch={onUpdateTmsBatch}
            onEditSchedule={canUpdate ? handleEditSchedule : undefined}
            onShowDetails={handleShowDetails}
            onShowShipments={handleShowShipments}
            onDelete={onDeleteLoad}
            currentUser={currentUser}
            profilePermissions={profilePermissions}
        />
      </div>


      <LoadFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveLoad}
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
            title={`Histórico da Carga ${selectedLoadForHistory.id}`}
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
        companyLogo={companyLogo}
        vehicles={vehicles}
        onDeleteAttachment={onDeleteAttachment}
      />

    </>
  );
};

export default LoadsPage;
