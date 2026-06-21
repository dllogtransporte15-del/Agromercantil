
import React, { useState, useRef, useMemo } from 'react';
import Header from '../components/Header';
import VehicleTable from '../components/VehicleTable';
import VehicleFormModal from '../components/VehicleFormModal';
import VehicleFilter, { VehicleFilters } from '../components/VehicleFilter';
import ShipmentHistoryModal from '../components/ShipmentHistoryModal';
import type { Vehicle, Owner, User, ProfilePermissions, Shipment, Cargo } from '../types';
import { VehicleSetType, VehicleBodyType, DriverClassification } from '../types';
import { can } from '../auth';
import Pagination from '../components/Pagination';

interface VehiclesPageProps {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  onSaveVehicle: (vehicleData: Vehicle | Omit<Vehicle, 'id'>) => void;
  owners: Owner[];
  currentUser: User;
  profilePermissions: ProfilePermissions;
  shipments: Shipment[];
  cargos: Cargo[];
}

const VehiclesPage: React.FC<VehiclesPageProps> = ({ 
  vehicles, 
  setVehicles, 
  onSaveVehicle, 
  owners, 
  currentUser, 
  profilePermissions,
  shipments,
  cargos
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);
  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState<Vehicle | null>(null);
  
  const [filters, setFilters] = useState<VehicleFilters>({
    plate: '',
    setType: '',
    bodyType: '',
    classification: '',
    ownerId: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const canCreate = can('create', currentUser, 'vehicles', profilePermissions);
  const canUpdate = can('update', currentUser, 'vehicles', profilePermissions);
  const canDelete = can('delete', currentUser, 'vehicles', profilePermissions);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      const plateMatch = !filters.plate || vehicle.plate.toLowerCase().includes(filters.plate.toLowerCase());
      const setTypeMatch = !filters.setType || vehicle.setType === filters.setType;
      const bodyTypeMatch = !filters.bodyType || vehicle.bodyType === filters.bodyType;
      const classificationMatch = !filters.classification || vehicle.classification === filters.classification;
      const ownerMatch = !filters.ownerId || vehicle.ownerId === filters.ownerId;

      return plateMatch && setTypeMatch && bodyTypeMatch && classificationMatch && ownerMatch;
    });
  }, [vehicles, filters]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);
  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenModal = () => {
    setVehicleToEdit(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setVehicleToEdit(vehicle);
    setIsModalOpen(true);
  };
  
  const handleShowHistory = (vehicle: Vehicle) => {
    setSelectedVehicleForHistory(vehicle);
    setIsHistoryModalOpen(true);
  };

  const vehicleShipmentHistory = useMemo(() => {
    if (!selectedVehicleForHistory) return [];
    return shipments.filter(s => s.horsePlate === selectedVehicleForHistory.plate);
  }, [selectedVehicleForHistory, shipments]);
  
  const handleDeleteVehicle = (vehicleId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este veículo?')) {
        setVehicles(prev => prev.filter(v => v.id !== vehicleId));
    }
  };

  const handleSaveVehicle = (vehicle: Vehicle | Omit<Vehicle, 'id'>) => {
    onSaveVehicle(vehicle);
    handleCloseModal();
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExport = () => {
    const headers = ['plate', 'setType', 'bodyType', 'axles', 'classification', 'ownerId', 'driverId'];
    const csvRows = [
      headers.join(','),
      ...vehicles.map(vehicle =>
        headers.map(header => `"${vehicle[header as keyof Vehicle] || ''}"`).join(',')
      )
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'veiculos.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').slice(1).filter(line => line.trim() !== '');
        
        const newVehicles: Omit<Vehicle, 'id'>[] = lines.map((line, index) => {
          const [plate, setType, bodyType, axles, classification, ownerId, driverId] = line.split(',').map(col => col.trim());
          if (!plate || !ownerId) {
            throw new Error(`Linha ${index + 2}: Placa e Proprietário são obrigatórios.`);
          }
          return {
            plate,
            setType: setType as VehicleSetType,
            bodyType: bodyType as VehicleBodyType,
            axles: parseInt(axles, 10),
            classification: classification as DriverClassification,
            ownerId,
            driverId: driverId || undefined,
          };
        });
        
        newVehicles.forEach(onSaveVehicle);
        alert(`${newVehicles.length} veículos importados com sucesso!`);
      } catch (error: any) {
        alert(`Erro ao importar o arquivo: ${error.message}`);
      } finally {
        if(event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Header title="Cadastro de Veículos">
        {canCreate && (
          <>
            <button onClick={handleImportClick} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Importar</button>
            <button onClick={handleExport} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Exportar</button>
            <button onClick={handleOpenModal} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">Adicionar Veículo</button>
          </>
        )}
      </Header>
      
      <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".csv"/>

      <div style={{ zoom: 0.8 }}>
        <VehicleFilter 
          owners={owners} 
          filters={filters} 
          onFilterChange={setFilters} 
        />

        <VehicleTable 
          vehicles={paginatedVehicles} 
          owners={owners} 
          onEdit={canUpdate ? handleEditVehicle : undefined} 
          onDelete={canDelete ? handleDeleteVehicle : undefined} 
          onShowHistory={handleShowHistory}
        />

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredVehicles.length}
            itemsPerPage={itemsPerPage}
          />
        )}
      </div>

      <VehicleFormModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSave={handleSaveVehicle} 
        vehicleToEdit={vehicleToEdit} 
        owners={owners} 
        onShowHistory={handleShowHistory}
      />

      <ShipmentHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        shipments={vehicleShipmentHistory}
        cargos={cargos}
        title={`Histórico de Embarques - Placa ${selectedVehicleForHistory?.plate}`}
      />
    </>
  );
};

export default VehiclesPage;
