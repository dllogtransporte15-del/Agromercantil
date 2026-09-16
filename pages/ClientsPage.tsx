import React, { useState, useRef, useMemo } from 'react';
import Header from '../components/Header';
import ClientTable from '../components/ClientTable';
import ClientFormModal from '../components/ClientFormModal';
import MergeClientsModal from '../components/MergeClientsModal';
import ClientFilter, { ClientFilters } from '../components/ClientFilter';
import type { Client, User, ProfilePermissions } from '../types';
import { PaymentMethod } from '../types';
import { can } from '../auth';
import { Merge, Plus, Upload, Download } from 'lucide-react';

interface ClientsPageProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onSaveClient: (clientData: Client | Omit<Client, 'id'>) => void;
  onDeleteClient: (clientId: string) => void;
  onMergeClients?: (targetClientId: string, sourceClientIds: string[]) => Promise<void>;
  currentUser: User;
  profilePermissions: ProfilePermissions;
}

const ClientsPage: React.FC<ClientsPageProps> = ({
  clients,
  setClients,
  onSaveClient,
  onDeleteClient,
  onMergeClients,
  currentUser,
  profilePermissions,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [filters, setFilters] = useState<ClientFilters>({
    id: '',
    nomeFantasia: '',
    cnpj: '',
    cityState: '',
    contact: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canCreate = can('create', currentUser, 'clients', profilePermissions);
  const canUpdate = can('update', currentUser, 'clients', profilePermissions);
  const canDelete = can('delete', currentUser, 'clients', profilePermissions);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const idMatch = !filters.id || (client.id && client.id.toLowerCase().includes(filters.id.toLowerCase()));
      const nomeFantasiaMatch = !filters.nomeFantasia || client.nomeFantasia.toLowerCase().includes(filters.nomeFantasia.toLowerCase());
      
      // Also match in secondary CNPJs
      const allCnpjs = [client.cnpj, ...(client.secondaryCnpjs || []).map(b => b.cnpj)].filter(Boolean);
      const cnpjMatch = !filters.cnpj || allCnpjs.some(c => c.includes(filters.cnpj));
      
      const cityStateLower = filters.cityState.toLowerCase();
      const allCities = [
        `${client.city} ${client.state}`,
        ...(client.secondaryCnpjs || []).map(b => `${b.city} ${b.state}`)
      ].filter(Boolean);
      const cityStateMatch = !filters.cityState || allCities.some(cs => cs.toLowerCase().includes(cityStateLower));
        
      const contactLower = filters.contact.toLowerCase();
      const contactMatch = !filters.contact || 
        client.phone.toLowerCase().includes(contactLower) || 
        client.email.toLowerCase().includes(contactLower);

      return idMatch && nomeFantasiaMatch && cnpjMatch && cityStateMatch && contactMatch;
    });
  }, [clients, filters]);

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
      onDeleteClient(clientId);
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
        if (event.target) event.target.value = '';
      }
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo.');
      if (event.target) event.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Header title="Cadastro de Clientes">
        {canCreate && (
          <div className="flex flex-wrap items-center gap-2">
            {onMergeClients && (
              <button
                onClick={() => setIsMergeModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                title="Unir múltiplos cadastros de clientes em um só com filiais"
              >
                <Merge className="w-4 h-4" />
                Unir Cadastros
              </button>
            )}
            <button
              onClick={handleImportClick}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar
            </button>
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente
            </button>
          </div>
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
        clients={filteredClients} 
        onEdit={canUpdate ? handleEditClient : undefined} 
        onDelete={canDelete ? handleDeleteClient : undefined} 
      />

      <ClientFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveClient}
        clientToEdit={clientToEdit}
      />

      {onMergeClients && (
        <MergeClientsModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          clients={clients}
          onMerge={onMergeClients}
        />
      )}
    </>
  );
};

export default ClientsPage;
