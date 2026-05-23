
import React, { useState } from 'react';
import type { Cargo, Client, Product, Shipment, User, ProfilePermissions } from '../types';
import { DailyScheduleType, CargoStatus, UserProfile } from '../types';
import { can, INITIAL_PERMISSIONS } from '../auth';
import VolumeBar from './VolumeBar';
import { Trash2 } from 'lucide-react';
import { PlusIcon } from './icons/PlusIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { Search, Filter, X } from 'lucide-react';
import MultiSelectDropdown from './MultiSelectDropdown';

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
  onDelete?: (cargoId: string) => void;
  currentUser: User;
  profilePermissions?: ProfilePermissions;
}

const LoadTable: React.FC<LoadTableProps> = ({ loads, clients, products, shipments, dailyBalanceDate, onDailyBalanceDateChange, onCreateShipment, onSuspend, onReactivate, onFinalize, onEdit, onClose, onShowHistory, onShowDetails, onEditSchedule,  onShowShipments,
  onDelete,
  currentUser,
  profilePermissions
}) => {
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filterId, setFilterId] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string[]>([]);
  const [filterOrigin, setFilterOrigin] = useState<string[]>([]);
  const [filterDest, setFilterDest] = useState<string[]>([]);

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.nomeFantasia || 'N/A';
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'N/A';

  // Opções únicas baseadas nas cargas listadas
  const idOptions = Array.from(new Set(loads.map(l => l.sequenceId?.toString() || ''))).filter(Boolean).sort();
  const clientOptions = Array.from(new Set(loads.map(l => getClientName(l.clientId)))).filter(Boolean).sort();
  const productOptions = Array.from(new Set(loads.map(l => getProductName(l.productId)))).filter(Boolean).sort();
  const originOptions = Array.from(new Set(loads.map(l => l.origin))).filter(Boolean).sort();
  const destOptions = Array.from(new Set(loads.map(l => l.destination))).filter(Boolean).sort();

  const filteredLoads = loads.filter(load => {
    if (filterId.length > 0 && !filterId.includes(load.sequenceId?.toString() || '')) return false;
    if (filterClient.length > 0 && !filterClient.includes(getClientName(load.clientId))) return false;
    if (filterProduct.length > 0 && !filterProduct.includes(getProductName(load.productId))) return false;
    if (filterOrigin.length > 0 && !filterOrigin.includes(load.origin)) return false;
    if (filterDest.length > 0 && !filterDest.includes(load.destination)) return false;
    return true;
  });

  const activeFiltersCount = (filterId.length > 0 ? 1 : 0) + (filterClient.length > 0 ? 1 : 0) + (filterProduct.length > 0 ? 1 : 0) + (filterOrigin.length > 0 ? 1 : 0) + (filterDest.length > 0 ? 1 : 0);

  const clearFilters = () => {
      setFilterId([]);
      setFilterClient([]);
      setFilterProduct([]);
      setFilterOrigin([]);
      setFilterDest([]);
  };
  
  const formatCurrency = (value: number) => {
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
        {filteredLoads.map((load) => {
          const scheduledButNotLoaded = Math.max(0, load.scheduledVolume - load.loadedVolume);
          const dailyScheduledTonnage = shipments
            .filter(s => s.cargoId === load.id && s.scheduledDate === dailyBalanceDate)
            .reduce((sum, s) => sum + s.shipmentTonnage, 0);
          const dailyScheduleInfo = load.dailySchedule?.find(ds => ds.date === dailyBalanceDate);

          const freightLegsToDisplay = (load.freightLegs && load.freightLegs.length > 0)
            ? load.freightLegs
            : [{
                companyFreightValuePerTon: load.companyFreightValuePerTon,
                driverFreightValuePerTon: load.driverFreightValuePerTon,
                hasIcms: load.hasIcms,
                icmsPercentage: load.icmsPercentage,
              }];
              
          const totalDriverFreight = freightLegsToDisplay.reduce((sum, leg) => sum + leg.driverFreightValuePerTon, 0);
          const totalNetCompanyValue = freightLegsToDisplay.reduce((sum, leg) => {
              const icmsRate = leg.hasIcms ? leg.icmsPercentage / 100 : 0;
              return sum + (leg.companyFreightValuePerTon * (1 - icmsRate));
          }, 0);

          const netProfit = totalNetCompanyValue - totalDriverFreight;
          const margin = (totalNetCompanyValue > 0) ? (netProfit / totalNetCompanyValue) * 100 : 0;
          const netMarginPercentage = isNaN(margin) || !isFinite(margin) ? '0,00%' : `${margin.toFixed(2).replace('.', ',')}%`;

          let marginColorClass = 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
          if (!isNaN(margin) && isFinite(margin)) {
            if (margin < 5) marginColorClass = 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
            else if (margin < 6) marginColorClass = 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
            else if (margin < 7) marginColorClass = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
            else marginColorClass = 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
          }

          return (
            <div key={load.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/30 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center p-4 gap-4">
                {/* ID and Status */}
                <div className="flex items-center gap-3 min-w-[120px]">
                  <div className="flex flex-col">
                    <button 
                      onClick={() => onShowDetails?.(load)}
                      className="text-sm font-bold text-primary dark:text-blue-400 hover:underline text-left"
                    >
                      #{load.sequenceId}
                    </button>
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
                             const typeDisplay = ds.type === DailyScheduleType.Fixo ? `F ${ds.tonnage || 0}t` : (statusSymbols[ds.type as DailyScheduleType] || ds.type);
                             
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
                    <div className="font-medium text-gray-700 dark:text-gray-300 truncate">{load.origin}</div>
                  </div>
                  <div className="text-gray-300">→</div>
                  <div className="flex-1">
                    <div className="text-gray-400 text-[9px] uppercase font-bold">Destino</div>
                    <div className="font-medium text-gray-700 dark:text-gray-300 truncate">{load.destination}</div>
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
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-primary dark:text-blue-400">{formatCurrency(load.driverFreightValuePerTon)}</div>
                      <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${marginColorClass}`} title="Margem de Lucro">
                        {netMarginPercentage}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LoadTable;
