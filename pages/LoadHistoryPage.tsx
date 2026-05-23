
import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import LoadTable from '../components/LoadTable';
import LoadHistoryFilter, { type LoadFilters } from '../components/LoadHistoryFilter';
import HistoryModal from '../components/HistoryModal';
import CargoDetailsModal from '../components/CargoDetailsModal';
import type { Cargo, Client, Product, User, Shipment, ProfilePermissions } from '../types';
import { UserProfile } from '../types';

interface LoadHistoryPageProps {
  loads: Cargo[];
  clients: Client[];
  products: Product[];
  users: User[];
  currentUser: User;
  shipments: Shipment[];
  onDeleteLoad: (cargoId: string) => void;
  onReactivateLoad?: (cargo: Cargo) => void;
  profilePermissions?: ProfilePermissions;
}

const LoadHistoryPage: React.FC<LoadHistoryPageProps> = ({ loads, clients, products, users, currentUser, shipments, onDeleteLoad, onReactivateLoad, profilePermissions }) => {
  const [filters, setFilters] = useState<LoadFilters>({
    startDate: '',
    endDate: '',
    origin: '',
    destination: '',
    clientId: '',
    productId: '',
    status: '',
  });

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedLoadForHistory, setSelectedLoadForHistory] = useState<Cargo | null>(null);
  const [detailsModalCargo, setDetailsModalCargo] = useState<Cargo | null>(null);
  const [dailyBalanceDate, setDailyBalanceDate] = useState(new Date().toISOString().split('T')[0]);


  const filteredLoads = useMemo(() => {
    return loads.filter(load => {
      const loadDate = new Date(load.createdAt);
      if (filters.startDate && loadDate < new Date(filters.startDate)) return false;
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the whole day
        if (loadDate > endDate) return false;
      }
      if (filters.origin && !load.origin.toLowerCase().includes(filters.origin.toLowerCase())) return false;
      if (filters.destination && !load.destination.toLowerCase().includes(filters.destination.toLowerCase())) return false;
      if (filters.clientId && load.clientId !== filters.clientId) return false;
      if (filters.productId && load.productId !== filters.productId) return false;
      if (filters.status && load.status !== filters.status) return false;
      return true;
    });
  }, [loads, filters]);

  const handleShowHistory = (load: Cargo) => {
    setSelectedLoadForHistory(load);
    setIsHistoryModalOpen(true);
  };

  const handleShowDetails = (cargo: Cargo) => {
    setDetailsModalCargo(cargo);
  };

  return (
    <>
      <Header title="Histórico de Cargas" />
      
      <LoadHistoryFilter
        clients={clients}
        products={products}
        filters={filters}
        onFilterChange={setFilters}
      />
      
      <LoadTable
        loads={filteredLoads}
        clients={clients}
        products={products}
        shipments={shipments}
        dailyBalanceDate={dailyBalanceDate}
        onDailyBalanceDateChange={setDailyBalanceDate}
        onShowHistory={handleShowHistory}
        onReactivate={onReactivateLoad}
        onShowDetails={handleShowDetails}
        onDelete={onDeleteLoad}
        currentUser={currentUser}
        profilePermissions={profilePermissions}
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
    </>
  );
};

export default LoadHistoryPage;
