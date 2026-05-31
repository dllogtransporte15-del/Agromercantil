
import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import ShipmentTable from '../components/ShipmentTable';
import ShipmentStatusFilter from '../components/ShipmentStatusFilter';
import AttachmentModal from '../components/AttachmentModal';
import EditPriceModal from '../components/EditPriceModal';
import CancelShipmentModal from '../components/CancelShipmentModal';
import HistoryModal from '../components/HistoryModal';
import CadastroAnttModal from '../components/CadastroAnttModal';
import CargoDetailsModal from '../components/CargoDetailsModal';
import TransferShipmentModal from '../components/TransferShipmentModal';
import EditScheduledDateTimeModal from '../components/EditScheduledDateTimeModal';
import SwapCargoModal from '../components/SwapCargoModal';
import type { Shipment, Cargo, Client, Driver, User, ProfilePermissions, Product, Vehicle, ShipmentLock } from '../types';

import { ShipmentStatus, UserProfile, REQUIRED_DOCUMENT_MAP } from '../types';
import { can } from '../auth';
import { tryAcquireShipmentLock, releaseShipmentLock } from '../services/api/db';
import { useEffect, useRef } from 'react';

interface ShipmentsPageProps {
  shipments: Shipment[];
  cargos: Cargo[];
  clients: Client[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  currentUser: User;
  profilePermissions: ProfilePermissions;
  users: User[];
  onUpdateAttachment: (shipmentId: string, data: { 
    filesToAttach: { [key: string]: File[] }, 
    bankDetails?: string, 
    loadedTonnage?: number, 
    advancePercentage?: number, 
    advanceValue?: number,
    tollValue?: number, 
    balanceToReceiveValue?: number,
    discountValue?: number,
    netBalanceValue?: number,
    unloadedTonnage?: number,
    route?: string 
  }) => Promise<void>;
  onAddAttachments?: (shipmentId: string, files: File[]) => Promise<void>;
  onUpdatePrice: (shipmentId: string, data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  onConfirmCancel: (shipmentId: string, reason: string) => void;
  onUpdateAnttAndBankDetails: (shipmentId: string, data: { anttOwnerIdentifier: string; bankDetails?: string }) => void;
  onTransferShipment: (shipmentId: string, newEmbarcadorId: string) => void;
  onMarkArrival: (shipmentId: string) => void;
  onDeleteShipment: (shipmentId: string) => void;
  onRevertStatus: (shipmentId: string) => void;
  onUpdateScheduledDateTime: (shipmentId: string, data: { scheduledDate: string, scheduledTime?: string }) => void;
  onUpdateShipmentData: (shipmentId: string, data: Partial<Shipment>) => void;
  activeLocks: ShipmentLock[];
  onModalStateChange: (isOpen: boolean) => void;
  companyLogo?: string | null;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
  onSwapCargo: (shipmentId: string, newCargoId: string) => void;
}


// Removed local requiredDocumentMap as it is now in types.ts (REQUIRED_DOCUMENT_MAP)


const ShipmentsPage: React.FC<ShipmentsPageProps> = ({ 
  shipments, cargos, clients, products, drivers, vehicles, currentUser, 
  profilePermissions, users, onUpdateAttachment, onAddAttachments, onUpdatePrice, onConfirmCancel, 
  onUpdateAnttAndBankDetails, onTransferShipment, onMarkArrival, onDeleteShipment,
  onRevertStatus, onUpdateScheduledDateTime, onUpdateShipmentData, activeLocks, onModalStateChange,
  companyLogo, onDeleteAttachment, onSwapCargo
}) => {

  const [activeStatus, setActiveStatus] = useState<ShipmentStatus | 'all'>(ShipmentStatus.PreCadastro);
  const [isAttachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [isEditPriceModalOpen, setEditPriceModalOpen] = useState(false);
  const [isCancelModalOpen, setCancelModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCadastroAnttModalOpen, setCadastroAnttModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditScheduledDateTimeModalOpen, setEditScheduledDateTimeModalOpen] = useState(false);
  const [isSwapCargoModalOpen, setSwapCargoModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  const [detailsModalCargo, setDetailsModalCargo] = useState<Cargo | null>(null);

  // Sync selected shipment with latest data from props
  useEffect(() => {
    if (selectedShipment) {
      const updated = shipments.find(s => s.id === selectedShipment.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedShipment)) {
        setSelectedShipment(updated);
      }
    }
  }, [shipments, selectedShipment]);

  useEffect(() => {
    // Locking heartbeat and beforeunload logic removed per user request
  }, []);

  useEffect(() => {
    const isAnyOpen = isAttachmentModalOpen || isEditPriceModalOpen || isCancelModalOpen || 
                      isHistoryModalOpen || isCadastroAnttModalOpen || isTransferModalOpen || 
                      isEditScheduledDateTimeModalOpen || isSwapCargoModalOpen || !!detailsModalCargo;
    onModalStateChange(isAnyOpen);
  }, [isAttachmentModalOpen, isEditPriceModalOpen, isCancelModalOpen, isHistoryModalOpen, 
      isCadastroAnttModalOpen, isTransferModalOpen, isEditScheduledDateTimeModalOpen, isSwapCargoModalOpen, detailsModalCargo, onModalStateChange]);



  const canUpdate = can('update', currentUser, 'shipments', profilePermissions);
  const canDelete = can('delete', currentUser, 'shipments', profilePermissions);

  const allowedProfilesForActions = [UserProfile.Comercial, UserProfile.Coordenador, UserProfile.Admin, UserProfile.Diretor, UserProfile.Fiscal];
  const canPerformSpecialActions = currentUser && allowedProfilesForActions.includes(currentUser.profile);
  
  const canEditPrice = canUpdate && canPerformSpecialActions;
  const canCancelShipment = canPerformSpecialActions && (canDelete || currentUser.profile === UserProfile.Fiscal);
  const canTransferShipment = canUpdate && canPerformSpecialActions;
  const isClient = currentUser.profile === UserProfile.Cliente;

  const filteredShipments = useMemo(() => {
    if (activeStatus === 'all') {
      return shipments.filter(s => 
        s.status !== ShipmentStatus.Cancelado && 
        s.status !== ShipmentStatus.Finalizado
      );
    }
    return shipments.filter(shipment => shipment.status === activeStatus);
  }, [shipments, activeStatus]);
  
  const handleOpenAttachmentModal = async (shipment: Shipment) => {
    // Locking logic removed per user request
    setSelectedShipment(shipment);
    setAttachmentModalOpen(true);
  };
  
  const handleOpenCadastroAnttModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setCadastroAnttModalOpen(true);
  };

  const handleCloseAttachmentModal = () => {
    // Locking logic removed per user request
    setAttachmentModalOpen(false);
    setSelectedShipment(null);
  };

  const handleSaveAttachment = async (data: { 
    filesToAttach: { [key: string]: File[] }, 
    bankDetails?: string, 
    loadedTonnage?: number, 
    advancePercentage?: number, 
    advanceValue?: number,
    tollValue?: number, 
    balanceToReceiveValue?: number,
    discountValue?: number,
    netBalanceValue?: number,
    unloadedTonnage?: number,
    route?: string 
  }) => {
    if (!selectedShipment) return;
    
    // We await here so that if it throws, the modal doesn't close
    await onUpdateAttachment(selectedShipment.id, data);
    handleCloseAttachmentModal();
  };
  
  const handleSaveAnttData = (data: { anttOwnerIdentifier: string; bankDetails?: string }) => {
    if (!selectedShipment) return;
    onUpdateAnttAndBankDetails(selectedShipment.id, data);
    setCadastroAnttModalOpen(false);
    setSelectedShipment(null);
  };

  const handleEditPrice = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setEditPriceModalOpen(true);
  };

  const handleCancelShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setCancelModalOpen(true);
  };
  
  const handleOpenTransferModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsTransferModalOpen(true);
  };

  const handleSavePrice = (data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => {
    if (!selectedShipment) return;
    onUpdatePrice(selectedShipment.id, data);
    setEditPriceModalOpen(false);
    setSelectedShipment(null);
  };

  const handleConfirmCancel = (reason: string) => {
    if (!selectedShipment) return;
    onConfirmCancel(selectedShipment.id, reason);
    setCancelModalOpen(false);
    setSelectedShipment(null);
  };
  
  const handleSaveTransfer = (newEmbarcadorId: string) => {
    if (selectedShipment) {
      onTransferShipment(selectedShipment.id, newEmbarcadorId);
    }
    setIsTransferModalOpen(false);
    setSelectedShipment(null);
  };

  const handleShowHistory = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsHistoryModalOpen(true);
  };

  const handleShowCargoDetails = (cargo: Cargo) => {
    setDetailsModalCargo(cargo);
  };

  const handleOpenSwapCargoModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setSwapCargoModalOpen(true);
  };

  const handleSwapCargo = (shipmentId: string, newCargoId: string) => {
    onSwapCargo(shipmentId, newCargoId);
    setSwapCargoModalOpen(false);
    setSelectedShipment(null);
  };

  const canUserAdvanceStatus = (shipment: Shipment): { allowed: boolean; reason: string } => {
    const defaultResponse = { allowed: true, reason: '' };
    if (!currentUser) return { allowed: false, reason: 'Usuário não autenticado.' };

    const currentStatus = shipment.status;
    const userProfile = currentUser.profile;

    if (userProfile === UserProfile.Admin) return defaultResponse;

    if (currentStatus === ShipmentStatus.PreCadastro || currentStatus === ShipmentStatus.AguardandoSeguradora) {
        if ([UserProfile.Fiscal, UserProfile.Diretor, UserProfile.Coordenador].includes(userProfile)) return defaultResponse;
        return { allowed: false, reason: 'Apenas Fiscal, Diretor, Coordenador ou Admin podem avançar este status.' };
    }

    if (currentStatus === ShipmentStatus.AguardandoAdiantamento || currentStatus === ShipmentStatus.AguardandoPagamentoSaldo) {
        if ([UserProfile.Financeiro, UserProfile.Diretor, UserProfile.Coordenador].includes(userProfile)) return defaultResponse;
        return { allowed: false, reason: 'Apenas Financeiro, Diretor, Coordenador ou Admin podem avançar.' };
    }


    return defaultResponse;
  };

  return (
    <>
      <Header title="Embarques" />
      <ShipmentStatusFilter 
        shipments={shipments} 
        activeStatus={activeStatus} 
        onStatusChange={setActiveStatus}
        currentUser={currentUser}
      />

      <ShipmentTable 
        shipments={filteredShipments} 
        cargos={cargos}
        users={users}
        vehicles={vehicles}
        onAttach={(canUpdate || isClient) ? handleOpenAttachmentModal : undefined}
        onAddAttachments={onAddAttachments}
        onEditPrice={canEditPrice ? handleEditPrice : undefined}
        onCancel={canCancelShipment ? handleCancelShipment : undefined}
        onTransfer={canTransferShipment ? handleOpenTransferModal : undefined}
        onShowHistory={handleShowHistory}
        onShowCargoDetails={handleShowCargoDetails}
        canUserAdvanceStatus={canUserAdvanceStatus}
        onMarkArrival={onMarkArrival}
        onDelete={onDeleteShipment}
        onRevertStatus={onRevertStatus}
        onOpenCadastroAntt={handleOpenCadastroAnttModal}
        onOpenEditScheduledDateTime={(shipment) => {
          setSelectedShipment(shipment);
          setEditScheduledDateTimeModalOpen(true);
        }}
        onUpdatePrice={onUpdatePrice}
        onUpdateShipmentData={onUpdateShipmentData}
        currentUser={currentUser}
        profilePermissions={profilePermissions}
        activeStatus={activeStatus}
        clients={clients}
        products={products}
        companyLogo={companyLogo}
        onDeleteAttachment={onDeleteAttachment}
        onSwapCargo={handleOpenSwapCargoModal}
        activeLocks={activeLocks}
      />

      {selectedShipment && (
        <AttachmentModal
          isOpen={isAttachmentModalOpen}
          onClose={handleCloseAttachmentModal}
          onSave={handleSaveAttachment}
          shipment={selectedShipment}
          cargo={cargos.find(c => c.id === selectedShipment.cargoId)}
          documentName={REQUIRED_DOCUMENT_MAP[selectedShipment.status] || 'Documento'}
          currentUser={currentUser}
          canSave={canUserAdvanceStatus(selectedShipment).allowed}
        />
      )}
      {selectedShipment && (
        <CadastroAnttModal
          isOpen={isCadastroAnttModalOpen}
          onClose={() => setCadastroAnttModalOpen(false)}
          onSave={handleSaveAnttData}
          shipment={selectedShipment}
        />
      )}
      {selectedShipment && (
        <EditPriceModal
            isOpen={isEditPriceModalOpen}
            onClose={() => setEditPriceModalOpen(false)}
            onSave={handleSavePrice}
            shipment={selectedShipment}
            currentUser={currentUser}
        />
      )}
      {selectedShipment && (
        <CancelShipmentModal
            isOpen={isCancelModalOpen}
            onClose={() => setCancelModalOpen(false)}
            onConfirm={handleConfirmCancel}
            shipmentId={selectedShipment.id}
        />
      )}
      {selectedShipment && (
        <HistoryModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            history={selectedShipment.history}
            users={users}
            title={`Histórico do Embarque ${selectedShipment.id}`}
        />
      )}
      {selectedShipment && (
        <TransferShipmentModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onSave={handleSaveTransfer}
          shipment={selectedShipment}
          users={users}
        />
      )}

      {selectedShipment && (
        <EditScheduledDateTimeModal
          isOpen={isEditScheduledDateTimeModalOpen}
          onClose={() => {
            setEditScheduledDateTimeModalOpen(false);
            setSelectedShipment(null);
          }}
          onSave={(data) => {
            onUpdateScheduledDateTime(selectedShipment.id, data);
            setEditScheduledDateTimeModalOpen(false);
            setSelectedShipment(null);
          }}
          shipment={selectedShipment}
        />
      )}

      {detailsModalCargo && (
          <CargoDetailsModal
            isOpen={!!detailsModalCargo}
            onClose={() => setDetailsModalCargo(null)}
            cargo={detailsModalCargo}
            client={clients.find(c => c.id === detailsModalCargo.clientId)}
            product={products.find(p => p.id === detailsModalCargo.productId)}
            commercialUser={users.find(u => u.id === detailsModalCargo.createdById)}
          />
      )}

      {selectedShipment && (
        <SwapCargoModal
          isOpen={isSwapCargoModalOpen}
          onClose={() => {
            setSwapCargoModalOpen(false);
            setSelectedShipment(null);
          }}
          onConfirm={handleSwapCargo}
          shipment={selectedShipment}
          cargos={cargos}
          clients={clients}
          products={products}
        />
      )}
    </>
  );
};

export default ShipmentsPage;
