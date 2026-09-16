
import React, { useState, useRef, useMemo } from 'react';
import Header from '../components/Header';
import OwnerTable from '../components/OwnerTable';
import OwnerFormModal from '../components/OwnerFormModal';
import OwnerFilter, { OwnerFilters } from '../components/OwnerFilter';
import type { Owner, User, ProfilePermissions } from '../types';
import { OwnerType } from '../types';
import { can } from '../auth';

interface OwnersPageProps {
  owners: Owner[];
  setOwners: React.Dispatch<React.SetStateAction<Owner[]>>;
  onSaveOwner: (ownerData: Owner | Omit<Owner, 'id'>) => void;
  currentUser: User;
  profilePermissions: ProfilePermissions;
}

const OwnersPage: React.FC<OwnersPageProps> = ({ owners, setOwners, onSaveOwner, currentUser, profilePermissions }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ownerToEdit, setOwnerToEdit] = useState<Owner | null>(null);
  const [filters, setFilters] = useState<OwnerFilters>({
    id: '',
    name: '',
    cpfCnpj: '',
    phone: '',
    type: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canCreate = can('create', currentUser, 'owners', profilePermissions);
  const canUpdate = can('update', currentUser, 'owners', profilePermissions);
  const canDelete = can('delete', currentUser, 'owners', profilePermissions);

  const filteredOwners = useMemo(() => {
    return owners.filter(owner => {
      const idMatch = !filters.id || (owner.id && owner.id.toLowerCase().includes(filters.id.toLowerCase()));
      const nameMatch = !filters.name || owner.name.toLowerCase().includes(filters.name.toLowerCase());
      const cpfCnpjMatch = !filters.cpfCnpj || owner.cpfCnpj.includes(filters.cpfCnpj);
      const phoneMatch = !filters.phone || owner.phone.includes(filters.phone);
      const typeMatch = !filters.type || owner.type === filters.type;

      return idMatch && nameMatch && cpfCnpjMatch && phoneMatch && typeMatch;
    });
  }, [owners, filters]);

  const handleOpenModal = () => {
    setOwnerToEdit(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleEditOwner = (owner: Owner) => {
    setOwnerToEdit(owner);
    setIsModalOpen(true);
  };
  
  const handleDeleteOwner = (ownerId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este proprietário?')) {
        setOwners(prev => prev.filter(o => o.id !== ownerId));
    }
  };

  const handleSaveOwner = (owner: Owner | Omit<Owner, 'id'>) => {
    onSaveOwner(owner);
    handleCloseModal();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExport = () => {
    const headers = ['name', 'cpfCnpj', 'phone', 'type', 'bankDetails'];
    const csvRows = [
      headers.join(','),
      ...owners.map(owner =>
        headers.map(header => `"${owner[header as keyof Owner]}"`).join(',')
      )
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'proprietarios.csv');
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
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        const newOwners: Omit<Owner, 'id'>[] = lines.map((line, index) => {
          const columns = line.split(',').map(col => col.trim());
          const [name, cpfCnpj, phone, type, bankDetails] = columns;

          if (!name || !cpfCnpj) {
            throw new Error(`Linha ${index + 1}: Nome e CPF/CNPJ são obrigatórios.`);
          }

          return {
            name,
            cpfCnpj,
            phone,
            type: type as OwnerType,
            bankDetails,
          };
        });
        
        newOwners.forEach(onSaveOwner);
        alert(`${newOwners.length} proprietários importados com sucesso!`);
      } catch (error) {
        alert(`Erro ao importar o arquivo: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if(event.target) event.target.value = '';
      }
    };
    reader.onerror = () => {
        alert('Erro ao ler o arquivo.');
        if(event.target) event.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Header title="Cadastro de Proprietários">
        {canCreate && (
          <>
            <button
              onClick={handleImportClick}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Importar
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Exportar
            </button>
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Adicionar Proprietário
            </button>
          </>
        )}
      </Header>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileImport} 
        className="hidden" 
        accept=".csv"
      />

      <OwnerFilter 
        filters={filters} 
        onFilterChange={setFilters} 
      />

      <OwnerTable 
        owners={filteredOwners} 
        onEdit={canUpdate ? handleEditOwner : undefined} 
        onDelete={canDelete ? handleDeleteOwner : undefined} 
      />

      <OwnerFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveOwner}
        ownerToEdit={ownerToEdit}
      />
    </>
  );
};

export default OwnersPage;
