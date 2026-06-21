
import React, { useState, useRef, useMemo } from 'react';
import Header from '../components/Header';
import ClientTable from '../components/ClientTable';
import ClientFormModal from '../components/ClientFormModal';
import ClientFilter, { ClientFilters } from '../components/ClientFilter';
import type { Client, User, ProfilePermissions } from '../types';
import { PaymentMethod } from '../types';
import Pagination from '../components/Pagination';
import { can } from '../auth';

interface ClientsPageProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onSaveClient: (clientData: Client | Omit<Client, 'id'>) => void;
  currentUser: User;
  profilePermissions: ProfilePermissions;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ clients, setClients, onSaveClient, currentUser, profilePermissions }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [filters, setFilters] = useState<ClientFilters>({
    nomeFantasia: '',
    cnpj: '',
    cityState: '',
    contact: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const canCreate = can('create', currentUser, 'clients', profilePermissions);
  const canUpdate = can('update', currentUser, 'clients', profilePermissions);
  const canDelete = can('delete', currentUser, 'clients', profilePermissions);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const nomeFantasiaMatch = !filters.nomeFantasia || client.nomeFantasia.toLowerCase().includes(filters.nomeFantasia.toLowerCase());
      const cnpjMatch = !filters.cnpj || client.cnpj.includes(filters.cnpj);
      
      const cityStateLower = filters.cityState.toLowerCase();
      const cityStateMatch = !filters.cityState || 
        client.city.toLowerCase().includes(cityStateLower) || 
        client.state.toLowerCase().includes(cityStateLower);
        
      const contactLower = filters.contact.toLowerCase();
      const contactMatch = !filters.contact || 
        client.phone.toLowerCase().includes(contactLower) || 
        client.email.toLowerCase().includes(contactLower);

      return nomeFantasiaMatch && cnpjMatch && cityStateMatch && contactMatch;
    });
  }, [clients, filters]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenModal = () => {
    setClientToEdit(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleEditClient = (client: Client) => {
    setClientToEdit(client);
    setIsModalOpen(true);
  };
  
  const handleDeleteClient = (clientId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
        setClients(prevClients => prevClients.filter(c => c.id !== clientId));
    }
  };

  const handleSaveClient = (client: Client | Omit<Client, 'id'>) => {
    onSaveClient(client);
    handleCloseModal();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleExport = () => {
    const headers = [
      'razaoSocial', 'nomeFantasia', 'cnpj', 'phone', 'email', 'address', 'city', 'state',
      'paymentMethod', 'paymentTerm', 'requiresExternalOrder', 'requiresScheduling'
    ];
    const csvRows = [
      headers.join(','),
      ...clients.map(client =>
        headers.map(header => `"${client[header as keyof Client]}"`).join(',')
      )
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'clientes.csv');
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
        
        const newClients: Omit<Client, 'id'>[] = lines.map((line, index) => {
          const columns = line.split(',').map(col => col.trim());
          const [
            razaoSocial, nomeFantasia, cnpj, phone, email, 
            address, city, state, paymentMethod, paymentTerm, 
            requiresExternalOrder, requiresScheduling
          ] = columns;

          if (!razaoSocial || !cnpj) {
            throw new Error(`Linha ${index + 1}: Razão Social e CNPJ são obrigatórios.`);
          }

          return {
            razaoSocial,
            nomeFantasia,
            cnpj,
            phone,
            email,
            address,
            city,
            state,
            paymentMethod: paymentMethod as PaymentMethod,
            paymentTerm: parseInt(paymentTerm, 10) || 0,
            requiresExternalOrder: requiresExternalOrder?.toLowerCase() === 'true',
            requiresScheduling: requiresScheduling?.toLowerCase() === 'true',
          };
        });

        newClients.forEach(onSaveClient);
        alert(`${newClients.length} clientes importados com sucesso!`);
      } catch (error) {
        alert(`Erro ao importar o arquivo: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        // Reset file input
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
      <Header title="Cadastro de Clientes">
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
              Adicionar Cliente
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

      <ClientFilter 
        filters={filters} 
        onFilterChange={setFilters} 
      />

      <ClientTable 
        clients={paginatedClients} 
        onEdit={canUpdate ? handleEditClient : undefined} 
        onDelete={canDelete ? handleDeleteClient : undefined} 
      />

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredClients.length}
          itemsPerPage={itemsPerPage}
        />
      )}

      <ClientFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveClient}
        clientToEdit={clientToEdit}
      />
    </>
  );
};

export default ClientsPage;
