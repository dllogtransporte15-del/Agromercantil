
import React, { useState, useMemo } from 'react';
import type { Cargo, Client, Product, Shipment, User, ProfilePermissions } from '../types';
import { DailyScheduleType, CargoStatus, UserProfile, ShipmentStatus } from '../types';
import { can, INITIAL_PERMISSIONS } from '../auth';
import VolumeBar from './VolumeBar';
import { Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { PlusIcon } from './icons/PlusIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { Search, Filter, X } from 'lucide-react';
import MultiSelectDropdown from './MultiSelectDropdown';
import Pagination from './Pagination';

interface LoadTableProps {
  loads: Cargo[];
  clients: Client[];
  products: Product[];
  shipments: Shipment[];
  dailyBalanceDate: string;
  onDailyBalanceDateChange: (date: string) => void;
  onCreateShipment?: (load: Cargo) => void;
  onSuspend?: (load: Cargo) => void;
  onReactivate?: (load: Cargo) => void;
  onFinalize?: (load: Cargo) => void;
  onEdit?: (load: Cargo) => void;
  onClose?: (load: Cargo) => void;
  onShowHistory?: (load: Cargo) => void;
  onShowDetails?: (load: Cargo) => void;
  onEditSchedule?: (load: Cargo) => void;
  onShowShipments?: (load: Cargo) => void;
  onShowIndicatedDrivers?: (load: Cargo) => void;
  onDelete?: (cargoId: string) => void;
  currentUser: User;
  profilePermissions?: ProfilePermissions;
  onFilteredLoadsChange?: (loads: Cargo[]) => void;
  onUpdateTmsBatch?: (cargoId: string, tmsBatchNumber: string, destId?: string) => void;
}

const LoadTable: React.FC<LoadTableProps> = ({ loads, clients, products, shipments, dailyBalanceDate, onDailyBalanceDateChange, onCreateShipment, onSuspend, onReactivate, onFinalize, onEdit, onClose, onShowHistory, onShowDetails, onEditSchedule,  onShowShipments,
  onShowIndicatedDrivers,
  onDelete,
  currentUser,
  profilePermissions,
  onFilteredLoadsChange,
  onUpdateTmsBatch
}) => {
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filterId, setFilterId] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string[]>([]);
  const [filterOrigin, setFilterOrigin] = useState<string[]>([]);
  const [filterDest, setFilterDest] = useState<string[]>([]);

  type SortKey = 'id' | 'client' | 'product' | 'origin' | 'destination' | 'volume' | 'available';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.nomeFantasia || 'N/A';
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'N/A';

  // Opções únicas baseadas nas cargas listadas
  const idOptions = Array.from(new Set(loads.map(l => l.sequenceId?.toString() || ''))).filter(Boolean).sort();
  const clientOptions = Array.from(new Set(loads.map(l => getClientName(l.clientId)))).filter(Boolean).sort();
  const productOptions = Array.from(new Set(loads.map(l => getProductName(l.productId)))).filter(Boolean).sort();
  const originOptions = Array.from(new Set(loads.map(l => l.origin))).filter(Boolean).sort();
  const destOptions = Array.from(new Set(loads.flatMap(l => (l.destinations || []).map(d => d.city).concat(l.destination)))).filter(Boolean).sort();

  const filteredLoads = useMemo(() => {
    const base = loads.filter(load => {
      if (filterId.length > 0 && !filterId.includes(load.sequenceId?.toString() || '')) return false;
      if (filterClient.length > 0 && !filterClient.includes(getClientName(load.clientId))) return false;
      if (filterProduct.length > 0 && !filterProduct.includes(getProductName(load.productId))) return false;
      if (filterOrigin.length > 0 && !filterOrigin.includes(load.origin)) return false;
      if (filterDest.length > 0) {
        const loadDests = (load.destinations || []).map(d => d.city).concat(load.destination);
        if (!filterDest.some(fd => loadDests.includes(fd))) return false;
      }
      return true;
    });

    if (!sortKey) return base;

    return [...base].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortKey) {
        case 'id':
          valA = a.sequenceId ?? 0;
          valB = b.sequenceId ?? 0;
          break;
        case 'client':
          valA = getClientName(a.clientId).toLowerCase();
          valB = getClientName(b.clientId).toLowerCase();
          break;
        case 'product':
          valA = getProductName(a.productId).toLowerCase();
          valB = getProductName(b.productId).toLowerCase();
          break;
        case 'origin':
          valA = (a.origin || '').toLowerCase();
          valB = (b.origin || '').toLowerCase();
          break;
        case 'destination': {
          const destA = (a.destinations && a.destinations.length > 0) ? a.destinations[0].city : a.destination;
          const destB = (b.destinations && b.destinations.length > 0) ? b.destinations[0].city : b.destination;
          valA = (destA || '').toLowerCase();
          valB = (destB || '').toLowerCase();
          break;
        }
        case 'volume':
          valA = a.totalVolume ?? 0;
          valB = b.totalVolume ?? 0;
          break;
        case 'available':
          valA = Math.max(0, (a.totalVolume ?? 0) - (a.scheduledVolume ?? 0));
          valB = Math.max(0, (b.totalVolume ?? 0) - (b.scheduledVolume ?? 0));
          break;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [loads, filterId, filterClient, filterProduct, filterOrigin, filterDest, sortKey, sortDir]);

  React.useEffect(() => {
    onFilteredLoadsChange?.(filteredLoads);
  }, [filteredLoads, onFilteredLoadsChange]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterId, filterClient, filterProduct, filterOrigin, filterDest]);

  const totalPages = Math.ceil(filteredLoads.length / itemsPerPage);
  const paginatedLoads = filteredLoads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeFiltersCount = (filterId.length > 0 ? 1 : 0) + (filterClient.length > 0 ? 1 : 0) + (filterProduct.length > 0 ? 1 : 0) + (filterOrigin.length > 0 ? 1 : 0) + (filterDest.length > 0 ? 1 : 0);

  const clearFilters = () => {
      setFilterId([]);
      setFilterClient([]);
      setFilterProduct([]);
      setFilterOrigin([]);
      setFilterDest([]);
  };
  
  const formatCurrency = (value: number) => {
    if (value === 0) return 'Valor a Combinar';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  }

  const statusSymbols: { [key in DailyScheduleType]: string } = {
    [DailyScheduleType.Livre]: 'L',
    [DailyScheduleType.Fixo]: 'F',
    [DailyScheduleType.Verificar]: 'V',
  };

  const statusSymbolColors: { [key in DailyScheduleType]: string } = {
    [DailyScheduleType.Livre]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    [DailyScheduleType.Fixo]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    [DailyScheduleType.Verificar]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row items-center justify-between p-4 gap-4">
          {/* Toggle Filters Button */}
          <div className="w-full md:w-auto">
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${showFilters || activeFiltersCount > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
            >
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filtros Avançados {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
            </button>
          </div>

          {/* Existing Controls */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Balanço Diário para:</span>
              <input
                type="date"
                value={dailyBalanceDate}
                onChange={(e) => onDailyBalanceDateChange(e.target.value)}
                className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap hidden sm:block">
              {filteredLoads.length !== loads.length ? `${filteredLoads.length} de ` : ''}{loads.length} cargas cadastradas
            </div>
          </div>
        </div>

        {/* Sort Bar — always visible */}
        <div className="px-4 pb-2 pt-1 border-t border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Ordenar por:</span>
            {([
              { key: 'id' as const, label: 'ID' },
              { key: 'client' as const, label: 'Cliente' },
              { key: 'product' as const, label: 'Produto' },
              { key: 'origin' as const, label: 'Origem' },
              { key: 'destination' as const, label: 'Destino' },
              { key: 'volume' as const, label: 'Volume Total' },
              { key: 'available' as const, label: 'Disponível' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className={`flex items-center text-xs font-semibold px-2.5 py-1 rounded-md transition-all border ${
                  sortKey === key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                {label}
                <SortIcon col={key} />
              </button>
            ))}
            {sortKey && (
              <button
                onClick={() => { setSortKey(null); setSortDir('asc'); }}
                className="flex items-center text-xs text-red-500 hover:text-red-700 dark:text-red-400 ml-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                title="Remover ordenação"
              >
                <X className="w-3 h-3 mr-1" /> Limpar ordem
              </button>
            )}
          </div>
        </div>

        {/* Expandable Filters Section */}
        {showFilters && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <MultiSelectDropdown label="ID da Carga" options={idOptions} selectedValues={filterId} onChange={setFilterId} placeholder="Todos os IDs..." />
                    <MultiSelectDropdown label="Nome do Cliente" options={clientOptions} selectedValues={filterClient} onChange={setFilterClient} placeholder="Todos os Clientes..." />
                    <MultiSelectDropdown label="Nome do Produto" options={productOptions} selectedValues={filterProduct} onChange={setFilterProduct} placeholder="Todos os Produtos..." />
                    <MultiSelectDropdown label="Cidade de Origem" options={originOptions} selectedValues={filterOrigin} onChange={setFilterOrigin} placeholder="Todas as Origens..." />
                    <MultiSelectDropdown label="Cidade de Destino" options={destOptions} selectedValues={filterDest} onChange={setFilterDest} placeholder="Todos os Destinos..." />
                </div>
                {activeFiltersCount > 0 && (
                    <div className="mt-4 flex justify-end">
                        <button onClick={clearFilters} className="text-sm flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                            <X className="w-4 h-4" /> Limpar Filtros
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="space-y-3">
        {paginatedLoads.map((load) => {
          const scheduledButNotLoaded = Math.max(0, load.scheduledVolume - load.loadedVolume);
          const dailyScheduledTonnage = shipments
            .filter(s => s.cargoId === load.id && s.scheduledDate === dailyBalanceDate)
            .reduce((sum, s) => sum + s.shipmentTonnage, 0);
          const dailyScheduleInfo = load.dailySchedule?.find(ds => ds.date === dailyBalanceDate);

          const freightLegsToDisplay = (load.destinations && load.destinations.length > 0 && load.destinations[0].freightLegs.length > 0)
            ? load.destinations[0].freightLegs
            : (load.freightLegs && load.freightLegs.length > 0)
              ? load.freightLegs
              : [{
                  companyFreightValuePerTon: load.companyFreightValuePerTon,
                  driverFreightValuePerTon: load.driverFreightValuePerTon,
                  hasIcms: load.hasIcms,
                  icmsPercentage: load.icmsPercentage,
                }];
              
          const totalDriverFreightPJ = freightLegsToDisplay.reduce((sum, leg) => sum + (leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon), 0);
          const totalDriverFreightPF = freightLegsToDisplay.reduce((sum, leg) => sum + (leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon), 0);
          const totalNetCompanyValue = freightLegsToDisplay.reduce((sum, leg) => {
              const icmsRate = leg.hasIcms ? leg.icmsPercentage / 100 : 0;
              return sum + (leg.companyFreightValuePerTon * (1 - icmsRate));
          }, 0);

          const commission = load.salespersonCommissionPerTon || 0;

          const calcMarginVal = (driverCost: number) =>
            (totalNetCompanyValue > 0)
              ? ((totalNetCompanyValue - driverCost - commission) / totalNetCompanyValue) * 100
              : 0;
          const marginPJ = calcMarginVal(totalDriverFreightPJ);
          const marginPF = calcMarginVal(totalDriverFreightPF);
          const netMarginPercentagePJ = isNaN(marginPJ) || !isFinite(marginPJ) ? '0,00%' : `${marginPJ.toFixed(2).replace('.', ',')}%`;
          const netMarginPercentagePF = isNaN(marginPF) || !isFinite(marginPF) ? '0,00%' : `${marginPF.toFixed(2).replace('.', ',')}%`;
          const getMarginColorClass = (m: number) => {
            if (isNaN(m) || !isFinite(m)) return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
            if (m < 5) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
            if (m < 6) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
            if (m < 7) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
            return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
          };
          
          const marginColorClassPJ = getMarginColorClass(marginPJ);
          const marginColorClassPF = getMarginColorClass(marginPF);

          return (
            <div key={load.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/30 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center p-4 gap-4">
                {/* ID and Status */}
                <div className="flex items-center gap-3 min-w-[120px]">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => onShowDetails?.(load)}
                        className="text-sm font-bold text-primary dark:text-blue-400 hover:underline text-left"
                      >
                        #{load.sequenceId}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const canEditTmsBatch = currentUser.profile === UserProfile.Fiscal || currentUser.profile === UserProfile.Admin;
                          if (!canEditTmsBatch || !onUpdateTmsBatch) return;

                          if (load.destinations && load.destinations.length > 1) {
                            for (const dest of load.destinations) {
                              const batchNumber = window.prompt(`Informe o número do lote criado no TMS para o destino ${dest.city}:`, dest.tmsBatchNumber || "");
                              if (batchNumber !== null && batchNumber.trim() !== (dest.tmsBatchNumber || "")) {
                                onUpdateTmsBatch(load.id, batchNumber.trim(), dest.id);
                              }
                            }
                          } else {
                            const batchNumber = window.prompt("Informe o número do lote criado no TMS:", load.tmsBatchNumber || "");
                            if (batchNumber !== null && batchNumber.trim() !== (load.tmsBatchNumber || "")) {
                              onUpdateTmsBatch(load.id, batchNumber.trim());
                            }
                          }
                        }}
                        className={`text-xs focus:outline-none ${
                          (currentUser.profile === UserProfile.Fiscal || currentUser.profile === UserProfile.Admin) 
                            ? 'cursor-pointer hover:scale-125 transition-transform' 
                            : 'cursor-default'
                        }`}
                        title={
                          load.destinations && load.destinations.length > 1 
                            ? `Lotes TMS: ${load.destinations.map(d => d.tmsBatchNumber ? `${d.city}: ${d.tmsBatchNumber}` : `${d.city}: Pendente`).join(' | ')}`
                            : load.tmsBatchNumber ? `Lote TMS: ${load.tmsBatchNumber}` : "Criação de Lote TMS Pendente"
                        }
                      >
                        {load.destinations && load.destinations.length > 1
                          ? (load.destinations.every(d => d.tmsBatchNumber) ? "✅" : "⚠️")
                          : (load.tmsBatchNumber ? "✅" : "⚠️")}
                      </button>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono truncate w-20" title={load.id}>{load.id.substring(0, 8)}...</span>
                  </div>
                  <span 
                    className={`inline-flex items-center justify-center h-6 w-6 text-[11px] font-bold rounded-full shadow-sm transition-colors ${
                      load.status === CargoStatus.Suspensa ? 'bg-yellow-100 text-yellow-800' :
                      load.status === CargoStatus.Fechada ? 'bg-gray-100 text-gray-800' :
                      (() => {
                        const today = new Date().toISOString().split('T')[0];
                        const hasCurrentOrFutureSchedule = load.dailySchedule?.some(ds => ds.date >= today);
                        if (load.status === CargoStatus.EmAndamento && !hasCurrentOrFutureSchedule) {
                          return 'bg-red-100 text-red-800 border border-red-200';
                        }
                        return dailyScheduleInfo ? statusSymbolColors[dailyScheduleInfo.type] : 'bg-gray-100 text-gray-400';
                      })()
                    }`}
                    title={
                      load.status === CargoStatus.Suspensa ? 'Carga Suspensa' :
                      load.status === CargoStatus.Fechada ? 'Carga Fechada' :
                      (() => {
                        const today = new Date().toISOString().split('T')[0];
                        const hasCurrentOrFutureSchedule = load.dailySchedule?.some(ds => ds.date >= today);
                        if (load.status === CargoStatus.EmAndamento && !hasCurrentOrFutureSchedule) {
                          return 'Sem Programação (Lançar programação para liberar)';
                        }
                        if (dailyScheduleInfo) {
                          const meanings: Record<string, string> = { 'L': 'Livre', 'F': 'Fixo', 'V': 'Verificar' };
                          return `Programação: ${meanings[statusSymbols[dailyScheduleInfo.type]] || statusSymbols[dailyScheduleInfo.type]}`;
                        }
                        return 'Sem programação para esta data';
                      })()
                    }
                  >
                    {(() => {
                      const today = new Date().toISOString().split('T')[0];
                      const hasCurrentOrFutureSchedule = load.dailySchedule?.some(ds => ds.date >= today);
                      if (load.status === CargoStatus.Suspensa) return 'S';
                      if (load.status === CargoStatus.Fechada) return 'F';
                      if (load.status === CargoStatus.EmAndamento && !hasCurrentOrFutureSchedule) return 'SP';
                      return dailyScheduleInfo ? statusSymbols[dailyScheduleInfo.type] : '-';
                    })()}
                  </span>

                </div>

                {/* Client and Product */}
                <div className="flex-1 xl:flex-none xl:w-[260px] min-w-[200px]">
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate" title={getClientName(load.clientId)}>{getClientName(load.clientId)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={getProductName(load.productId)}>{getProductName(load.productId)}</div>
                </div>

                {/* Programação Futura (Calendário) */}
                <div 
                  className={`flex flex-col flex-1 min-w-[170px] gap-1 pt-3 xl:pt-0 mt-1 xl:mt-0 xl:px-4 border-t xl:border-t-0 xl:border-l xl:border-r border-gray-100 dark:border-gray-700/50 ${onEditSchedule ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer group py-1 xl:rounded-md xl:-my-1 relative xl:top-1 xl:bottom-1' : ''}`}
                  onClick={onEditSchedule ? () => onEditSchedule(load) : undefined}
                  role={onEditSchedule ? "button" : undefined}
                  title={onEditSchedule ? "Editar Programação da Carga" : undefined}
                >
                  <span className={`text-[9px] uppercase font-bold text-gray-400 w-full text-left ${onEditSchedule ? 'group-hover:text-primary dark:group-hover:text-blue-400 transition-colors' : ''}`}>Programação</span>
                  <div className="flex flex-wrap gap-1.5 w-full justify-start">
                    {(() => {
                      const today = new Date().toISOString().split('T')[0];
                      const upcoming = (load.dailySchedule || [])
                        .filter(ds => ds.date >= today)
                        .sort((a, b) => a.date.localeCompare(b.date));
                        
                      const toShow = upcoming.slice(0, 3);
                      if (upcoming.length === 0) {
                         return <span className={`text-[11px] text-gray-400 font-medium italic mt-1 pb-1 ${onEditSchedule ? 'group-hover:text-gray-500 dark:group-hover:text-gray-300' : ''}`}>Sem lançamentos</span>;
                      }

                      return (
                        <>
                          {toShow.map((ds, idx) => {
                             const d = new Date(ds.date + 'T12:00:00Z');
                             const dayStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                             const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
                             const typeDisplay = `${statusSymbols[ds.type as DailyScheduleType] || ds.type.charAt(0)} ${ds.tonnage || 0}t`;
                             
                             return (
                               <div key={idx} className="flex flex-col items-center overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-sm w-[46px] h-[36px] shrink-0" title={`Data: ${ds.date} | Tipo: ${ds.type} | Vol: ${ds.tonnage || 'Livre'}`}>
                                  <div className="bg-indigo-50 dark:bg-indigo-900/40 border-b border-indigo-100 dark:border-indigo-800 w-full text-center h-[13px] flex items-center justify-center">
                                    <span className="text-[8px] text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">{weekday}</span>
                                  </div>
                                  <div className="w-full flex-1 flex flex-col items-center justify-center bg-white dark:bg-gray-800">
                                    <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100 leading-none tracking-tighter">{dayStr}</span>
                                    <span className="text-[7px] font-bold text-gray-500 dark:text-gray-400 leading-none mt-[2px]">{typeDisplay}</span>
                                  </div>
                               </div>
                             );
                          })}
                          {upcoming.length > 3 && (
                             <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md w-[32px] h-[36px] shrink-0" title={`Mais ${upcoming.length - 3} lançamentos`}>
                               <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">+{upcoming.length - 3}</span>
                             </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Route */}
                <div className="flex items-center gap-2 min-w-[180px] text-xs py-2 lg:py-0 border-t border-gray-50 lg:border-t-0 dark:border-gray-700/50">
                  <div className="text-left lg:text-right flex-1">
                    <div className="text-gray-400 text-[9px] uppercase font-bold">Origem</div>
                    <div className="font-medium text-gray-700 dark:text-gray-300 truncate" title={load.origin}>{load.origin}</div>
                  </div>
                  <div className="text-gray-300">→</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <div className="text-gray-400 text-[9px] uppercase font-bold">Destino</div>
                      {(load.destinations && load.destinations.length > 1) && (
                        <button 
                          onClick={() => setExpandedLoadId(expandedLoadId === load.id ? null : load.id)}
                          className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-500 p-0.5 cursor-pointer"
                          title="Ver outros destinos"
                        >
                          <span className={`text-[10px] transform transition-transform ${expandedLoadId === load.id ? 'rotate-180' : ''}`}>⬇️</span>
                        </button>
                      )}
                    </div>
                    <div className="font-medium text-gray-700 dark:text-gray-300 line-clamp-2" title={(load.destinations || []).map(d => d.city).join(', ') || load.destination}>
                      {(load.destinations && load.destinations.length > 1) 
                        ? `${load.destinations[0].city} (+${load.destinations.length - 1})` 
                        : ((load.destinations && load.destinations.length === 1) ? load.destinations[0].city : load.destination)}
                    </div>
                  </div>
                </div>


                {/* Balanço Geral */}
                <div className="min-w-[180px] space-y-1">
                  <div className="flex justify-between items-start text-[10px] font-bold text-gray-500 uppercase">
                    <span>Geral</span>
                    <div className="text-right">
                      <div className="text-gray-700 dark:text-gray-300">{formatNumber(load.loadedVolume)} / {formatNumber(load.totalVolume)}</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Disp: {formatNumber(Math.max(0, load.totalVolume - load.scheduledVolume))} ton</div>
                    </div>
                  </div>
                  <VolumeBar
                    loaded={load.loadedVolume}
                    scheduled={scheduledButNotLoaded}
                    total={load.totalVolume}
                    onClick={onShowShipments ? () => onShowShipments(load) : undefined}
                  />
                </div>

                {/* Balanço Diário */}
                <div className="min-w-[180px] space-y-1 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-md border border-gray-100 dark:border-gray-600">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                    <span>Diário {dailyScheduleInfo?.type ? `(${dailyScheduleInfo.type})` : ''}</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatNumber(dailyScheduledTonnage)} ton</span>
                  </div>
                  <VolumeBar
                    loaded={dailyScheduledTonnage}
                    total={dailyScheduleInfo?.type === DailyScheduleType.Fixo && dailyScheduleInfo.tonnage ? dailyScheduleInfo.tonnage : (dailyScheduledTonnage > 0 ? dailyScheduledTonnage : 1)}
                    scheduled={0}
                    loadedColor="bg-blue-500"
                    onClick={onShowShipments ? () => onShowShipments(load) : undefined}
                  />
                </div>

                {/* Freight and Actions */}
                <div className="flex items-center justify-between lg:justify-end gap-4 min-w-[150px]">
                  <div className="text-right flex flex-col items-end">
                    <div className="text-[9px] text-gray-400 uppercase font-bold">Frete</div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-bold text-emerald-500 uppercase">PJ</span>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300" title={(load.destinations && load.destinations.length > 1) ? 'Valor do primeiro destino' : ''}>{formatCurrency(totalDriverFreightPJ)}{(load.destinations && load.destinations.length > 1) ? '*' : ''}</span>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${marginColorClassPJ}`}
                            title={commission > 0 ? `Margem PJ (inclui comissão de ${formatCurrency(commission)}/ton)` : 'Margem PJ'}
                          >{netMarginPercentagePJ}</span>
                        </div>
                        {!freightLegsToDisplay.some(leg => leg.disableDriverFreightPF) ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-bold text-orange-500 uppercase">PF</span>
                            <span className="text-xs font-bold text-orange-700 dark:text-orange-300" title={(load.destinations && load.destinations.length > 1) ? 'Valor do primeiro destino' : ''}>{formatCurrency(totalDriverFreightPF)}{(load.destinations && load.destinations.length > 1) ? '*' : ''}</span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${marginColorClassPF}`}
                              title={commission > 0 ? `Margem PF (inclui comissão de ${formatCurrency(commission)}/ton)` : 'Margem PF'}
                            >{netMarginPercentagePF}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 opacity-50">
                            <span className="text-[8px] font-bold text-gray-500 uppercase">PF</span>
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Desabilitado</span>
                          </div>
                        )}
                        {commission > 0 && (
                          <div className="flex items-center gap-1 mt-0.5" title={`Comissão Vendedor: ${formatCurrency(commission)}/ton deduzida da margem`}>
                            <span className="text-[8px] font-bold text-purple-500 uppercase">Com.</span>
                            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">- {formatCurrency(commission)}/ton</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setOpenActionMenu(openActionMenu === load.id ? null : load.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors border border-gray-200 dark:border-gray-600"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                    
                    {openActionMenu === load.id && (
                      <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-xl bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-20 overflow-hidden border border-gray-100 dark:border-gray-700">
                        <div className="py-1">
                          {onShowHistory && (
                            <button onClick={() => { onShowHistory(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                              <HistoryIcon className="h-4 w-4" /> Histórico
                            </button>
                          )}
                          {onEdit && (
                            <button onClick={() => { onEdit(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Editar Carga
                            </button>
                          )}
                          {onEditSchedule && (
                            <button onClick={() => { onEditSchedule(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Editar Programação
                            </button>
                          )}
                          {onCreateShipment && load.status === CargoStatus.EmAndamento && (
                            <button onClick={() => { onCreateShipment(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-primary dark:text-blue-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
                              Novo Embarque
                            </button>
                          )}
                          {onShowIndicatedDrivers && load.status === CargoStatus.EmAndamento && (
                            <button onClick={() => { onShowIndicatedDrivers(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
                              Motoristas Indicados
                            </button>
                          )}
                          {onSuspend && load.status === CargoStatus.EmAndamento && (
                            <button onClick={() => { onSuspend(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Suspender Carga
                            </button>
                          )}
                          {onReactivate && (load.status === CargoStatus.Suspensa || load.status === CargoStatus.Fechada) && (
                            <button onClick={() => { onReactivate(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Reativar Carga
                            </button>
                          )}
                          {onFinalize && (
                            <button onClick={() => { onFinalize(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Finalizar Carga
                            </button>
                          )}
                          {onClose && (
                            <button onClick={() => { onClose(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Fechar Carga
                            </button>
                          )}
                          {onDelete && can('delete', currentUser, 'loads', profilePermissions || INITIAL_PERMISSIONS) && (
                            <button onClick={() => { onDelete(load.id); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2">
                              <Trash2 className="h-4 w-4" /> Excluir Carga
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {expandedLoadId === load.id && load.destinations && load.destinations.length > 1 && (
                 <div className="p-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-lg">
                    <h4 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">Outros Destinos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {load.destinations.map((dest, idx) => {
                             const leg = dest.freightLegs?.[0] || { driverFreightValuePerTonPJ: undefined, driverFreightValuePerTonPF: undefined, driverFreightValuePerTon: 0, companyFreightValuePerTon: 0 };
                             const pj = leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon;
                             const pf = leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon;
                             
                             const destShipments = shipments.filter(s => s.cargoId === load.id && s.route === dest.city && s.status !== ShipmentStatus.Cancelado);
                             const scheduledDest = destShipments.filter(s => [ShipmentStatus.PreCadastro, ShipmentStatus.AguardandoAgendamento, ShipmentStatus.AguardandoSeguradora, ShipmentStatus.AguardandoCarregamento].includes(s.status)).reduce((sum, s) => sum + (s.shipmentTonnage || 0), 0);
                             const actuallyLoadedDest = destShipments.reduce((sum, s) => sum + (s.unloadedTonnage || s.shipmentTonnage || 0), 0) - scheduledDest;

                             const destNetCompanyValue = (leg.companyFreightValuePerTon || 0) * (1 - (leg.hasIcms ? (leg.icmsPercentage || 0) / 100 : 0));
                             const destMarginPJVal = destNetCompanyValue > 0 ? ((destNetCompanyValue - pj - commission) / destNetCompanyValue) * 100 : 0;
                             const destMarginPFVal = destNetCompanyValue > 0 ? ((destNetCompanyValue - pf - commission) / destNetCompanyValue) * 100 : 0;
                             
                             const destMarginColorPJ = getMarginColorClass(destMarginPJVal);
                             const destMarginColorPF = getMarginColorClass(destMarginPFVal);
                             const destMarginStrPJ = isNaN(destMarginPJVal) || !isFinite(destMarginPJVal) ? '0,00%' : `${destMarginPJVal.toFixed(2).replace('.', ',')}%`;
                             const destMarginStrPF = isNaN(destMarginPFVal) || !isFinite(destMarginPFVal) ? '0,00%' : `${destMarginPFVal.toFixed(2).replace('.', ',')}%`;

                             return (
                                 <div key={dest.id || idx} className="p-1.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 rounded flex flex-col shadow-sm gap-1.5">
                                     <div className="flex justify-between items-start">
                                         <div>
                                             <p className="font-bold text-xs text-gray-800 dark:text-gray-200">{dest.city}</p>
                                             <div className="flex flex-col gap-0.5 mt-0.5">
                                                 <div className="flex items-center gap-1">
                                                     <span className="text-[7px] font-bold text-emerald-500 uppercase">PJ</span>
                                                     <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(pj)}</span>
                                                     <span className={`text-[8px] font-medium px-1 py-0.5 rounded ${destMarginColorPJ}`}>{destMarginStrPJ}</span>
                                                 </div>
                                                 {!leg.disableDriverFreightPF ? (
                                                     <div className="flex items-center gap-1">
                                                         <span className="text-[7px] font-bold text-orange-500 uppercase">PF</span>
                                                         <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300">{formatCurrency(pf)}</span>
                                                         <span className={`text-[8px] font-medium px-1 py-0.5 rounded ${destMarginColorPF}`}>{destMarginStrPF}</span>
                                                     </div>
                                                 ) : (
                                                     <div className="flex items-center gap-1 opacity-50">
                                                         <span className="text-[7px] font-bold text-gray-500 uppercase">PF</span>
                                                         <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">Desabilitado</span>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                         <div>
                                             {onCreateShipment && load.status === CargoStatus.EmAndamento && (
                                                <button 
                                                    onClick={() => {
                                                        const modifiedCargo = {
                                                            ...load,
                                                            destination: dest.city,
                                                            destinationMapLink: dest.mapLink || load.destinationMapLink,
                                                            driverFreightValuePerTon: leg?.driverFreightValuePerTon ?? load.driverFreightValuePerTon,
                                                            driverFreightValuePerTonPJ: leg?.driverFreightValuePerTonPJ ?? load.driverFreightValuePerTonPJ,
                                                            driverFreightValuePerTonPF: leg?.driverFreightValuePerTonPF ?? load.driverFreightValuePerTonPF,
                                                            disableDriverFreightPF: leg?.disableDriverFreightPF ?? load.disableDriverFreightPF,
                                                            companyFreightValuePerTon: leg?.companyFreightValuePerTon ?? load.companyFreightValuePerTon,
                                                        };
                                                        onCreateShipment(modifiedCargo);
                                                    }} 
                                                    className="p-1.5 bg-primary text-white hover:bg-primary-dark rounded transition-colors shadow-sm"
                                                    title="Novo Embarque para este destino"
                                                >
                                                    <PlusIcon className="w-3 h-3" />
                                                </button>
                                             )}
                                         </div>
                                     </div>
                                     
                                     {dest.targetTonnage && dest.targetTonnage > 0 && (
                                         <div className="mt-0.5">
                                             <div className="flex justify-between text-[8px] font-bold text-gray-500 mb-0.5">
                                                 <span>Saldo</span>
                                                 <span>{formatNumber(actuallyLoadedDest + scheduledDest)} / {formatNumber(dest.targetTonnage)} t</span>
                                             </div>
                                             <VolumeBar
                                                loaded={actuallyLoadedDest}
                                                scheduled={scheduledDest}
                                                total={dest.targetTonnage}
                                             />
                                         </div>
                                     )}
                                 </div>
                             );
                        })}
                    </div>
                 </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredLoads.length}
          itemsPerPage={itemsPerPage}
        />
      )}
    </div>
  );
};

export default LoadTable;
