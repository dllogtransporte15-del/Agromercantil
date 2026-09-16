import React, { useState, useMemo, useEffect } from 'react';
import Header from '../components/Header';
import FreightOffersList from '../components/FreightOffersList';
import type { FreightOffer, Client, Product, Cargo, User } from '../types';
import { FreightOfferStatus, UserProfile } from '../types';
import { HistoryIcon, FilterIcon, SearchIcon, RefreshCwIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface FreightOffersHistoryPageProps {
  freightOffers: FreightOffer[];
  clients: Client[];
  products: Product[];
  cargos: Cargo[];
  users?: User[];
  currentUser?: User | null;
  onSaveFreightOffer?: (offer: Omit<FreightOffer, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteFreightOffer?: (offer: FreightOffer) => void;
  onConvertToCargo?: (offer: FreightOffer) => void;
}

const FreightOffersHistoryPage: React.FC<FreightOffersHistoryPageProps> = ({ 
  freightOffers, 
  clients, 
  products, 
  cargos,
  users,
  currentUser,
  onSaveFreightOffer,
  onDeleteFreightOffer,
  onConvertToCargo
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClientId, setFilterClientId] = useState<string>('all');
  const [filterCnpj, setFilterCnpj] = useState<string>('all');
  const [filterOrigin, setFilterOrigin] = useState<string>('');
  const [filterDestination, setFilterDestination] = useState<string>('');

  const relevantClient = useMemo(() => {
    if (currentUser?.profile === UserProfile.Cliente && currentUser?.clientId) {
      return clients.find(c => c.id === currentUser.clientId);
    }
    if (filterClientId !== 'all') {
      return clients.find(c => c.id === filterClientId);
    }
    return null;
  }, [currentUser, filterClientId, clients]);

  const availableCnpjs = useMemo(() => {
    if (relevantClient) {
      const list = [{ cnpj: relevantClient.cnpj, label: `Matriz (${relevantClient.cnpj})` }];
      (relevantClient.secondaryCnpjs || []).forEach(b => {
        list.push({ cnpj: b.cnpj, label: `${b.nomeFantasia || b.razaoSocial || 'Filial'} (${b.cnpj})` });
      });
      return list;
    }
    // All CNPJs from freightOffers (exclusively client offers)
    const set = new Map<string, string>();
    freightOffers.forEach(o => {
      if (!o.driverId && o.clientCnpj) {
        set.set(o.clientCnpj.replace(/\D/g, ''), o.clientCnpj);
      }
    });
    return Array.from(set.values()).map(cnpj => ({ cnpj, label: cnpj }));
  }, [relevantClient, freightOffers]);

  const filteredOffers = useMemo(() => {
    return freightOffers.filter(offer => {
      // Ofertas de frete são EXCLUSIVAMENTE de clientes (não solicitações de motoristas / ordens do app)
      if (offer.driverId) return false;

      if (currentUser?.profile === UserProfile.Cliente && currentUser?.clientId) {
        if (offer.clientId !== currentUser.clientId) return false;
      }
      if (filterStatus !== 'all' && offer.status !== filterStatus) return false;
      if (filterClientId !== 'all' && offer.clientId !== filterClientId) return false;
      if (filterCnpj !== 'all') {
        const cleanFilter = filterCnpj.replace(/\D/g, '');
        const client = clients.find(c => c.id === offer.clientId);
        const offerCnpj = (offer.clientCnpj || client?.cnpj || '').replace(/\D/g, '');
        if (offerCnpj !== cleanFilter) return false;
      }
      if (filterOrigin && !offer.origin.toLowerCase().includes(filterOrigin.toLowerCase())) return false;
      if (filterDestination && !offer.destination.toLowerCase().includes(filterDestination.toLowerCase())) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [freightOffers, filterStatus, filterClientId, filterCnpj, filterOrigin, filterDestination, currentUser, clients]);

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterClientId('all');
    setFilterCnpj('all');
    setFilterOrigin('');
    setFilterDestination('');
  };

  const itemsPerPage = 40;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredOffers]);

  const totalPages = Math.ceil(filteredOffers.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedOffers = filteredOffers.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Header title="Histórico de Ofertas de Frete" />
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
            <FilterIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Filtros de Busca</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Encontre ofertas específicas utilizando os filtros abaixo</p>
          </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6`}>
          {currentUser?.profile !== UserProfile.Cliente && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
              <select
                value={filterClientId}
                onChange={(e) => {
                  setFilterClientId(e.target.value);
                  setFilterCnpj('all');
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="all">Todos os Clientes</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.nomeFantasia || client.razaoSocial}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableCnpjs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNPJ / Filial</label>
              <select
                value={filterCnpj}
                onChange={(e) => setFilterCnpj(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="all">Todos os CNPJs</option>
                {availableCnpjs.map(item => (
                  <option key={item.cnpj} value={item.cnpj}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm"
            >
              <option value="all">Todos os Status</option>
              {Object.values(FreightOfferStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origem</label>
            <div className="relative">
              <input
                type="text"
                value={filterOrigin}
                onChange={(e) => setFilterOrigin(e.target.value)}
                placeholder="Buscar por origem..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              />
              <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destino</label>
            <div className="relative">
              <input
                type="text"
                value={filterDestination}
                onChange={(e) => setFilterDestination(e.target.value)}
                placeholder="Buscar por destino..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              />
              <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCwIcon className="w-4 h-4" />
            Limpar Filtros
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <FreightOffersList
          offers={paginatedOffers}
          clients={clients}
          products={products}
          cargos={cargos}
          users={users}
          isClientProfile={currentUser?.profile === UserProfile.Cliente}
          currentUser={currentUser || undefined}
          onAccept={async () => {}} // Disabled actions for history
          onRefuse={async () => {}} // Disabled actions for history
          onCounterOffer={async () => {}} // Disabled actions for history
          onDelete={onDeleteFreightOffer}
          onConvertToCargo={onConvertToCargo}
          onSaveFreightOffer={onSaveFreightOffer}
        />


        {totalPages > 1 && (
          <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando <span className="font-medium">{(safeCurrentPage - 1) * itemsPerPage + 1}</span> a{' '}
              <span className="font-medium">{Math.min(safeCurrentPage * itemsPerPage, filteredOffers.length)}</span> de{' '}
              <span className="font-medium">{filteredOffers.length}</span> ofertas
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={safeCurrentPage === 1}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Página {safeCurrentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={safeCurrentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FreightOffersHistoryPage;
