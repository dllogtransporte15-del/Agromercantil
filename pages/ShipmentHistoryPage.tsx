
import React, { useState, useMemo, useEffect } from 'react';
import Header from '../components/Header';
import ShipmentTable from '../components/ShipmentTable';
import ShipmentHistoryFilter from '../components/ShipmentHistoryFilter';
import HistoryModal from '../components/HistoryModal';
import AttachmentModal from '../components/AttachmentModal';
import CargoDetailsModal from '../components/CargoDetailsModal';
import CancellationReasonChart from '../components/CancellationReasonChart';
import type { Shipment, Cargo, User, Product, Client, Vehicle, Driver, RiskQueryOption } from '../types';
import { ShipmentStatus } from '../types';
import { isCteApplicableForStatus, getShipmentCte, isStayForShipment } from '../utils';
import { StayRecord } from '../utils/toolStorage';
import { calculateShipmentExpenses } from '../utils/operationalExpensesCalculator';

interface ShipmentHistoryPageProps {
  shipments: Shipment[];
  cargos: Cargo[];
  drivers: Driver[];
  users: User[];
  currentUser: User;
  clients: Client[];
  products: Product[];
  vehicles: Vehicle[];
  onDeleteShipment: (shipmentId: string) => void;
  onRevertStatus?: (shipmentId: string) => void;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
  onUpdatePrice?: (shipmentId: string, data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  onUpdateShipmentData?: (shipmentId: string, data: Partial<Shipment>) => void;
  onUpdateAttachment?: (shipmentId: string, data: any) => Promise<void>;
  stays?: StayRecord[];
  riskQueryOptions?: RiskQueryOption[];
}

const ShipmentHistoryPage: React.FC<ShipmentHistoryPageProps> = ({ shipments, cargos, drivers, users, currentUser, clients, products, vehicles, onDeleteShipment, onRevertStatus, onDeleteAttachment, onUpdatePrice, onUpdateShipmentData, onUpdateAttachment, stays = [], riskQueryOptions }) => {
  const [activeStatus, setActiveStatus] = useState<ShipmentStatus>(ShipmentStatus.Finalizado);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAttachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [detailsModalCargo, setDetailsModalCargo] = useState<Cargo | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [marginOperator, setMarginOperator] = useState<'>' | '<' | ''>('');
  const [marginValue, setMarginValue] = useState<string>('');
  const [filterCte, setFilterCte] = useState('');
  const [filterNfe, setFilterNfe] = useState('');
  const [filterMdfe, setFilterMdfe] = useState('');
  const [filterId, setFilterId] = useState('');
  const [filterSolicitante, setFilterSolicitante] = useState('');

  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

  const calculateMargin = (s: Shipment) => {
    const cargo = cargoMap.get(s.cargoId);
    if (!cargo) return 0;
    const expenses = calculateShipmentExpenses(s, cargo);
    
    const demurrageProfit = stays
        .filter(stay => isStayForShipment(stay, s))
        .reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
        
    return expenses.netProfit + demurrageProfit;
  };

  // Sync selected shipment with latest data from props
  useEffect(() => {
    if (selectedShipment) {
      const updated = shipments.find(s => s.id === selectedShipment.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedShipment)) {
        setSelectedShipment(updated);
      }
    }
  }, [shipments, selectedShipment]);

  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
        const matchesStatus = shipment.status === activeStatus;
        let matchesDate = true;
        
        if (startDate) {
            matchesDate = matchesDate && shipment.scheduledDate >= startDate;
        }
        if (endDate) {
            matchesDate = matchesDate && shipment.scheduledDate <= endDate;
        }

        let matchesMargin = true;
        if (marginOperator && marginValue !== '') {
            const margin = calculateMargin(shipment);
            const val = parseFloat(marginValue);
            if (marginOperator === '>') matchesMargin = margin > val;
            else if (marginOperator === '<') matchesMargin = margin < val;
        }

        let matchesId = true;
        if (filterId.trim()) {
          const q = filterId.trim().toLowerCase();
          const idMatch = shipment.id.toLowerCase().includes(q);
          const cargo = cargoMap.get(shipment.cargoId);
          const cargoSeqMatch = cargo?.sequenceId ? String(cargo.sequenceId).toLowerCase().includes(q) : false;
          matchesId = idMatch || cargoSeqMatch;
        }

        let matchesSolicitante = true;
        if (filterSolicitante.trim()) {
          const embarcadorUser = users.find(u => u.id === shipment.embarcadorId);
          const embarcadorName = embarcadorUser?.name || '';
          matchesSolicitante = shipment.embarcadorId === filterSolicitante || embarcadorName.toLowerCase().includes(filterSolicitante.trim().toLowerCase());
        }

        let matchesCte = true;
        if (filterCte.trim()) {
          const cteVal = getShipmentCte(shipment);
          matchesCte = isCteApplicableForStatus(shipment.status) && (
            (cteVal !== '-' && cteVal.toLowerCase().includes(filterCte.trim().toLowerCase())) ||
            !!(shipment.cteNumber?.toLowerCase().includes(filterCte.trim().toLowerCase()))
          );
        }
        let matchesNfe = true;
        if (filterNfe.trim()) matchesNfe = !!(shipment.nfeNumber?.toLowerCase().includes(filterNfe.trim().toLowerCase()));
        let matchesMdfe = true;
        if (filterMdfe.trim()) matchesMdfe = !!(shipment.mdfeNumber?.toLowerCase().includes(filterMdfe.trim().toLowerCase()));
        
        return matchesStatus && matchesDate && matchesMargin && matchesId && matchesSolicitante && matchesCte && matchesNfe && matchesMdfe;
    });
  }, [shipments, activeStatus, startDate, endDate, marginOperator, marginValue, cargoMap, filterId, filterSolicitante, filterCte, filterNfe, filterMdfe, users]);

  const cancellationReasonData = useMemo(() => {
    const cancelledShipments = shipments.filter(s => s.status === ShipmentStatus.Cancelado);
    const counts: Record<string, number> = {};
    
    cancelledShipments.forEach(s => {
      const reason = s.cancellationReason || 'Não informado';
      counts[reason] = (counts[reason] || 0) + 1;
    });

    const colors = [
      'bg-red-500', 
      'bg-orange-500', 
      'bg-yellow-500', 
      'bg-blue-500', 
      'bg-emerald-500', 
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500'
    ];

    const sorted = Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // Limit to top 5 and group others
    if (sorted.length > 5) {
      const top5 = sorted.slice(0, 5);
      const othersValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
      top5.push({ label: 'Outros', value: othersValue });
      return top5.map((item, i) => ({ ...item, color: colors[i % colors.length] }));
    }

    return sorted.map((item, i) => ({ ...item, color: colors[i % colors.length] }));
  }, [shipments]);

  const handleShowHistory = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsHistoryModalOpen(true);
  };
  
  const handleOpenAttachmentModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setAttachmentModalOpen(true);
  };
  
  const handleSaveAttachment = async (data: any) => {
    if (!selectedShipment) return;
    if (onUpdateAttachment) {
      await onUpdateAttachment(selectedShipment.id, data);
    }
    setAttachmentModalOpen(false);
    setSelectedShipment(null);
  };

  const handleShowCargoDetails = (cargo: Cargo) => {
    setDetailsModalCargo(cargo);
  };

  return (
    <>
      <Header title="Histórico de Embarques">
        <CancellationReasonChart data={cancellationReasonData} />
      </Header>
      <ShipmentHistoryFilter 
        shipments={shipments} 
        cargos={cargos}
        activeStatus={activeStatus} 
        onStatusChange={setActiveStatus}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        marginOperator={marginOperator}
        onMarginOperatorChange={setMarginOperator}
        marginValue={marginValue}
        onMarginValueChange={setMarginValue}
        stays={stays}
        filterCte={filterCte}
        onFilterCteChange={setFilterCte}
        filterNfe={filterNfe}
        onFilterNfeChange={setFilterNfe}
        filterMdfe={filterMdfe}
        onFilterMdfeChange={setFilterMdfe}
        filterId={filterId}
        onFilterIdChange={setFilterId}
        filterSolicitante={filterSolicitante}
        onFilterSolicitanteChange={setFilterSolicitante}
        users={users}
      />
      <ShipmentTable 
        shipments={filteredShipments} 
        cargos={cargos}
        drivers={drivers}
        users={users}
        vehicles={vehicles}
        onShowHistory={handleShowHistory}
        onAttach={handleOpenAttachmentModal} // Allow viewing attachments
        onShowCargoDetails={handleShowCargoDetails}
        onDelete={onDeleteShipment}
        onRevertStatus={onRevertStatus}
        currentUser={currentUser}
        activeStatus={activeStatus}
        clients={clients}
        products={products}
        companyLogo={null} // History doesn't typically need PDF generation but the prop is required
        onDeleteAttachment={onDeleteAttachment}
        onUpdatePrice={onUpdatePrice}
        onUpdateShipmentData={onUpdateShipmentData}
      />
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
        <AttachmentModal
            isOpen={isAttachmentModalOpen}
            onClose={() => setAttachmentModalOpen(false)}
            onSave={handleSaveAttachment}
            shipment={shipments.find(s => s.id === selectedShipment.id) || selectedShipment}
            cargo={cargos.find(c => c.id === selectedShipment.cargoId)}
            documentName="Documento"
            currentUser={currentUser}
            requiresRiskManagement={
              products.find(p => p.id === cargos.find(c => c.id === selectedShipment.cargoId)?.productId)
                ?.requiresRiskManagement !== false
            }
            products={products}
            clients={clients}
            users={users}
            riskQueryOptions={riskQueryOptions}
            onUpdateShipmentData={onUpdateShipmentData}
        />
      )}

       {detailsModalCargo && (
          <CargoDetailsModal
            isOpen={!!detailsModalCargo}
            onClose={() => setDetailsModalCargo(null)}
            cargo={detailsModalCargo}
            client={clients.find(c => c.id === detailsModalCargo.clientId)}
            product={products.find(p => p.id === detailsModalCargo.productId)}
            commercialUser={users.find(u => u.id === detailsModalCargo?.createdById)}
            stays={stays}
            shipments={shipments}
            currentUser={currentUser}
          />
      )}
    </>
  );
};

export default ShipmentHistoryPage;
