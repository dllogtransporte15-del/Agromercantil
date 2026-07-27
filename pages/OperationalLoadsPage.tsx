
import React, { useState } from 'react';
import Header from '../components/Header';
import LoadTable from '../components/LoadTable';
import NewShipmentModal from '../components/NewShipmentModal';
import LoadFormModal from '../components/LoadFormModal';
import HistoryModal from '../components/HistoryModal';
import CargoDetailsModal from '../components/CargoDetailsModal';
import CargoShipmentsSidePanel from '../components/CargoShipmentsSidePanel';
import IndicatedDriversModal from '../components/IndicatedDriversModal';
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
  onUpdateTmsBatch?: (cargoId: string, tmsBatchNumber: string, destId?: string) => void;
  onUpdatePrice: (shipmentId: string, data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  onModalStateChange: (isOpen: boolean) => void;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
  branches: Branch[];
}

const formatAllowedVehicleTypes = (allowed?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]): string => {
    if (!allowed || allowed.length === 0) return 'N/A';
    const allBodyTypes = allowed.flatMap(type => type.bodyTypes || []);
    const uniqueBodyTypes = [...new Set(allBodyTypes)];
    return uniqueBodyTypes.join(', ');
};

const FRETEBRAS_VEHICLE_MAP: Record<string, string | null> = {
  'Rodotrem (3x3)': 'Bitrem 9 eixos',
  'Carreta 4e': 'Carreta 4º eixo',
  'Cavalo 4e': null,
  'LS Simples': null,
  'Bitrem 8e': null,
  'Bitrem 7e': 'Bitrem 7 eixos',
  'LS Trucada': 'Carreta LS',
  'Vanderleia': 'Vanderléia',
  'Caminhão Truck': 'Truck',
};

const formatAllowedSetTypes = (allowed?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]): string => {
    if (!allowed || allowed.length === 0) return '';
    const allSetTypes = allowed.map(type => type.setType);
    const uniqueSetTypes = [...new Set(allSetTypes)];
    return uniqueSetTypes.join(', ');
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
  onUpdateTmsBatch,
  onUpdatePrice,
  onModalStateChange,
  onDeleteAttachment,
  branches,
}) => {
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [copyButtonText, setCopyButtonText] = useState('Divulgar Cargas');
  const [fretebrasButtonText, setFretebrasButtonText] = useState('Prompt Fretebras');
  const [visibleLoads, setVisibleLoads] = useState<Cargo[]>([]);
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
  const [selectedCargoForIndicatedDrivers, setSelectedCargoForIndicatedDrivers] = useState<Cargo | null>(null);

  React.useEffect(() => {
    const isAnyOpen = isShipmentModalOpen || isLoadFormModalOpen || isHistoryModalOpen || !!detailsModalCargo || isShipmentsPanelOpen || !!selectedCargoForIndicatedDrivers;
    onModalStateChange(isAnyOpen);
  }, [isShipmentModalOpen, isLoadFormModalOpen, isHistoryModalOpen, detailsModalCargo, isShipmentsPanelOpen, selectedCargoForIndicatedDrivers, onModalStateChange]);

  const handleShowIndicatedDrivers = (cargo: Cargo) => {
    setSelectedCargoForIndicatedDrivers(cargo);
  };

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

  const handleCloseLoad = (cargoToClose: Cargo) => {
    const reason = window.prompt(`Tem certeza que deseja fechar a carga ${cargoToClose.sequenceId}? Essa ação mudará o status para "Fechada". Por favor, informe o motivo:`);
    if (reason === null) return;
    if (!reason.trim()) {
        alert("É obrigatório informar o motivo para fechar a carga.");
        return;
    }
    
    onSaveLoad({ 
        ...cargoToClose, 
        status: CargoStatus.Fechada,
        history: [...cargoToClose.history, { date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString('pt-BR', { hour12: false }), description: `Carga fechada. Motivo: ${reason}` }] 
    } as Cargo);
  };

  const canCloseLoad = [UserProfile.Diretor, UserProfile.Coordenador, UserProfile.Comercial].includes(currentUser.profile as UserProfile) || can('delete', currentUser, 'loads', profilePermissions);

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
    // Usa as cargas visíveis (com filtros aplicados), excluindo Suspensas
    const loadsToShare = visibleLoads.filter(load => load.status !== CargoStatus.Suspensa);
    if (loadsToShare.length === 0) {
      alert('Nenhuma carga disponível para divulgar (verifique os filtros e se há cargas suspensas).');
      return;
    }

    const header = '🌽 LIBERADOS AGROMERCANTIL 🌽\n';

    const loadsText = loadsToShare.map(load => {
      const product = products.find(p => p.id === load.productId)?.name || 'Produto Não Informado';
      const origin = load.origin;
      const bodyTypes = formatAllowedVehicleTypes(load.allowedVehicleTypes);

      let text = `📍*${origin}*`;
      if (load.originMapLink) {
        text += `\n📍Coleta - ${load.originMapLink}`;
      }
      text += `\n🌾 ${product}`;
      text += `\n🚩 *Destinos*`;
      
      const dests = (load.destinations && load.destinations.length > 0) 
        ? load.destinations 
        : [{ city: load.destination, mapLink: load.destinationMapLink, freightLegs: load.freightLegs }];

      dests.forEach(dest => {
          const legs = (dest.freightLegs && dest.freightLegs.length > 0) 
            ? dest.freightLegs 
            : [{ driverFreightValuePerTon: load.driverFreightValuePerTon, driverFreightValuePerTonPJ: load.driverFreightValuePerTonPJ, driverFreightValuePerTonPF: load.driverFreightValuePerTonPF, disableDriverFreightPF: load.disableDriverFreightPF }];
          
          const totalPJ = legs.reduce((sum, leg) => sum + (leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon), 0);
          const totalPF = legs.reduce((sum, leg) => sum + (leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon), 0);
          const isPFDisabled = legs.some(leg => leg.disableDriverFreightPF) || load.disableDriverFreightPF;

          const pricePJ = totalPJ === 0 ? 'A Combinar' : totalPJ.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const pricePF = totalPF === 0 ? 'A Combinar' : totalPF.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          
          let priceDisplay = '';
          if (totalPJ === 0 && (isPFDisabled || totalPF === 0)) {
              priceDisplay = 'Valor a Combinar';
          } else if (isPFDisabled) {
              priceDisplay = `_PJ ${pricePJ}_`;
          } else {
              priceDisplay = `_PJ ${pricePJ} / PF ${pricePF}_`;
          }

          text += `\n* *${dest.city}* 💲 *${priceDisplay}*`;
          if (dest.mapLink) {
             text += `\n${dest.mapLink}`;
          }
          text += `\n🚛 ${bodyTypes} 🚛`;
      });

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

  const handleShareFretebras = () => {
    const loadsToShare = visibleLoads.filter(load => load.status === CargoStatus.EmAndamento);
    if (loadsToShare.length === 0) {
      alert('Nenhuma carga em andamento para divulgar.');
      return;
    }

    const entriesText = loadsToShare.flatMap(load => {
      const product = products.find(p => p.id === load.productId)?.name || '';
      const origin = load.origin;
      const allowed = load.allowedVehicleTypes || [];
      const mappedVehicles = allowed
        .map(t => FRETEBRAS_VEHICLE_MAP[t.setType] !== undefined ? FRETEBRAS_VEHICLE_MAP[t.setType] : t.setType)
        .filter((t): t is string => Boolean(t));
      const vehicleTypes = mappedVehicles.length > 0
        ? [...new Set(mappedVehicles)].join(', ')
        : '';
      const bodyTypes = allowed.length > 0
        ? [...new Set(allowed.flatMap(t => t.bodyTypes || []))].join(', ')
        : '';
      const rastreada = load.requiresTracker ? 'Sim' : 'Não';

      const destinationsList = (load.destinations && load.destinations.length > 0)
        ? load.destinations.map(d => d.city).filter(Boolean)
        : [load.destination];

      return destinationsList.map(destination => [
        `ORIGEM: ${origin}`,
        `DESTINO: ${destination}`,
        `PRODUTO: ${product}`,
        `VALOR: A combinar`,
        `VEÍCULO: ${vehicleTypes}`,
        `CARROCERIA: ${bodyTypes}`,
        `RASTREADA: ${rastreada}`,
        `LONA: Sim`,
        `FORMA DE PAGAMENTO:`,
        `OBSERVAÇÕES:`,
      ].join('\n'));
    }).join('\n\n');

    navigator.clipboard.writeText(entriesText).then(() => {
      setFretebrasButtonText('Copiado!');
      setTimeout(() => setFretebrasButtonText('Prompt Fretebras'), 3000);
    }, (err) => {
      console.error('Falha ao copiar: ', err);
      alert('Não foi possível copiar as cargas. Verifique as permissões do navegador.');
    });
  };

  return (
    <>
      <Header title="Cargas em Operação">
        {currentUser.profile !== UserProfile.Cliente && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareLoads}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200"
            >
              <CopyIcon className="w-5 h-5 mr-2" />
              {copyButtonText}
            </button>
            <button
              onClick={handleShareFretebras}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
            >
              <CopyIcon className="w-5 h-5 mr-2" />
              {fretebrasButtonText}
            </button>
          </div>
        )}
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
        onClose={canCloseLoad ? handleCloseLoad : undefined}
        onReactivate={currentUser.profile !== UserProfile.Embarcador ? onReactivateLoad : undefined}
        onSuspend={currentUser.profile !== UserProfile.Embarcador ? onSuspendLoad : undefined}
        onUpdateTmsBatch={onUpdateTmsBatch}
        onShowDetails={handleShowCargoDetails}
        onShowShipments={handleShowShipments}
        onShowIndicatedDrivers={handleShowIndicatedDrivers}
        onDelete={onDeleteLoad}
        currentUser={currentUser}
        profilePermissions={profilePermissions}
        onFilteredLoadsChange={setVisibleLoads}
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

      <IndicatedDriversModal
        isOpen={!!selectedCargoForIndicatedDrivers}
        onClose={() => setSelectedCargoForIndicatedDrivers(null)}
        cargo={selectedCargoForIndicatedDrivers}
        drivers={drivers}
        shipments={shipments}
        loads={loads}
      />
    </>
  );
};

export default OperationalLoadsPage;
