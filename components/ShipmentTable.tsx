import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Shipment, Cargo, User, Vehicle, Client, Product, ProfilePermissions, ShipmentLock } from '../types';
import { ShipmentStatus, UserProfile } from '../types';
import { can, INITIAL_PERMISSIONS } from '../auth';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { DollarSignIcon } from './icons/DollarSignIcon';
import { XIcon } from './icons/XIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';
import { InfoIcon } from './icons/InfoIcon';
import { TransferIcon } from './icons/TransferIcon';
import { MoreVerticalIcon } from './icons/MoreVerticalIcon';
import { Search, Filter, X, Trash2, RotateCcw, Clock, Package, Lock } from 'lucide-react';
import { tryAcquireShipmentLock } from '../services/api/db';

import MultiSelectDropdown from './MultiSelectDropdown';
import ShipmentDetailsModal from './ShipmentDetailsModal';

interface ShipmentTableProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
  vehicles: Vehicle[];
  clients: Client[];
  products: Product[];
  onAttach?: (shipment: Shipment) => void;
  onEditPrice?: (shipment: Shipment) => void;
  onCancel?: (shipment: Shipment) => void;
  onTransfer?: (shipment: Shipment) => void;
  onShowHistory?: (shipment: Shipment) => void;
  onOpenCadastroAntt?: (shipment: Shipment) => void;
  onShowCargoDetails?: (cargo: Cargo) => void;
  onMarkArrival?: (shipmentId: string) => void;
  onDelete?: (shipmentId: string) => void;
  onRevertStatus?: (shipmentId: string) => void;
  canUserAdvanceStatus?: (shipment: Shipment) => { allowed: boolean; reason: string };
  onUpdatePrice?: (shipmentId: string, data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  onUpdateShipmentData?: (shipmentId: string, data: Partial<Shipment>) => void;
  onAddAttachments?: (shipmentId: string, files: File[]) => Promise<void>;
  onOpenEditScheduledDateTime?: (shipment: Shipment) => void;
  currentUser: User;
  profilePermissions?: ProfilePermissions;

  activeStatus: ShipmentStatus | 'all';
  companyLogo?: string | null;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
  onSwapCargo?: (shipment: Shipment) => void;
  activeLocks: ShipmentLock[];
}

const ShipmentTable: React.FC<ShipmentTableProps> = ({ shipments, cargos, users, vehicles, onAttach, onEditPrice, onCancel, onTransfer, onShowHistory, onShowCargoDetails, canUserAdvanceStatus, onMarkArrival, onDelete, onRevertStatus, onOpenCadastroAntt, onUpdatePrice, onUpdateShipmentData, onAddAttachments, onOpenEditScheduledDateTime, currentUser, activeStatus, clients, products, companyLogo, onDeleteAttachment, onSwapCargo, profilePermissions, activeLocks }) => {


  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number, isUp: boolean } | null>(null);
  const [detailsModalShipment, setDetailsModalShipment] = useState<Shipment | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filterPlate, setFilterPlate] = useState<string[]>([]);
  const [filterName, setFilterName] = useState<string[]>([]);
  const [filterOrigin, setFilterOrigin] = useState<string[]>([]);
  const [filterDest, setFilterDest] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string[]>([]);
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'yesterday'>('all');
  
  // Sync modal shipment with latest data from props
  useEffect(() => {
    if (detailsModalShipment) {
      const updated = shipments.find(s => s.id === detailsModalShipment.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(detailsModalShipment)) {
        setDetailsModalShipment(updated);
      }
    }
  }, [shipments, detailsModalShipment]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenActionMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleActionMenu = (shipmentId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openActionMenu === shipmentId) {
      setOpenActionMenu(null);
      setMenuPosition(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const menuHeight = 250; // Estimated height
      const isUp = rect.bottom + menuHeight > window.innerHeight;
      
      setMenuPosition({
        top: isUp ? rect.top : rect.bottom,
        left: rect.right,
        isUp: isUp
      });
      setOpenActionMenu(shipmentId);
    }
  };

  const getCargoInfo = (cargoId: string): Cargo | null => {
    return cargos.find(c => c.id === cargoId) || null;
  };

  const getEmbarcadorName = (embarcadorId: string): string => {
    return users.find(u => u.id === embarcadorId)?.name || 'N/A';
  };

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.nomeFantasia || 'N/A';

  const handleFazerCadastroClick = async (shipment: Shipment) => {
    setOpenActionMenu(null);
    try {
      const res = await tryAcquireShipmentLock(shipment.id, currentUser.id, currentUser.name);
      if (res.success) {
        window.open("https://agromercantil.atua.com.br/adm/", "_blank");
      } else {
        alert(`Este embarque está bloqueado por ${res.lockedBy || 'outro usuário'} que está realizando o cadastro no momento.`);
      }
    } catch (err) {
      console.error('Erro ao adquirir bloqueio:', err);
      alert('Erro ao tentar bloquear o embarque para cadastro. Verifique sua conexão.');
    }
  };

  // Filter options
  const plateOptions = useMemo(() => Array.from(new Set(shipments.map(s => s.horsePlate))).filter(Boolean).sort(), [shipments]);
  const nameOptions = useMemo(() => Array.from(new Set(shipments.map(s => s.driverName))).filter(Boolean).sort(), [shipments]);
  const originOptions = useMemo(() => Array.from(new Set(shipments.map(s => getCargoInfo(s.cargoId)?.origin || ''))).filter(Boolean).sort(), [shipments, cargos]);
  const destOptions = useMemo(() => Array.from(new Set(shipments.map(s => getCargoInfo(s.cargoId)?.destination || ''))).filter(Boolean).sort(), [shipments, cargos]);
  const clientOptions = useMemo(() => Array.from(new Set(shipments.map(s => getClientName(getCargoInfo(s.cargoId)?.clientId || '')))).filter(Boolean).sort(), [shipments, cargos, clients]);

  const filteredShipments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return shipments.filter(shipment => {
        const cargo = getCargoInfo(shipment.cargoId);
        if (filterPlate.length > 0 && !filterPlate.includes(shipment.horsePlate)) return false;
        if (filterName.length > 0 && !filterName.includes(shipment.driverName)) return false;
        if (filterOrigin.length > 0 && !filterOrigin.includes(cargo?.origin || '')) return false;
        if (filterDest.length > 0 && !filterDest.includes(cargo?.destination || '')) return false;
        if (filterClient.length > 0 && !filterClient.includes(getClientName(cargo?.clientId || ''))) return false;
        
        if (filterDate === 'today') {
            const created = new Date(shipment.createdAt);
            if (created < today) return false;
        } else if (filterDate === 'yesterday') {
            const created = new Date(shipment.createdAt);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            // created yesterday: >= yesterday and < today
            if (created < yesterday || created >= today) return false;
        }

        return true;
    });
  }, [shipments, filterPlate, filterName, filterOrigin, filterDest, filterClient, filterDate, cargos, clients]);

  const activeFiltersCount = (filterPlate.length > 0 ? 1 : 0) + (filterName.length > 0 ? 1 : 0) + (filterOrigin.length > 0 ? 1 : 0) + (filterDest.length > 0 ? 1 : 0) + (filterClient.length > 0 ? 1 : 0) + (filterDate !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setFilterPlate([]);
    setFilterName([]);
    setFilterOrigin([]);
    setFilterDest([]);
    setFilterClient([]);
    setFilterDate('all');
  };

  const shipperSummary = useMemo(() => {
    const summary: Record<string, { count: number, revenue: number }> = {};
    filteredShipments.forEach(s => {
        const shipperId = s.embarcadorId;
        if (!shipperId) return;
        const cargo = getCargoInfo(s.cargoId);
        const rate = s.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
        const revenue = rate * (s.shipmentTonnage || 1);
        
        if (!summary[shipperId]) summary[shipperId] = { count: 0, revenue: 0 };
        summary[shipperId].count += 1;
        summary[shipperId].revenue += revenue;
    });
    return summary;
  }, [filteredShipments, cargos]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  
  const formatDate = (timestamp: string | undefined) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatWhatsAppLink = (phone: string) => {
    if (!phone) return null;
    const cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length >= 10) { 
        return `https://wa.me/55${cleanedPhone}`;
    }
    return null;
  };
  
  const isClient = currentUser.profile === UserProfile.Cliente;
  const showActionsColumnForClient = isClient && activeStatus === ShipmentStatus.Finalizado;

  const ActionMenuItem: React.FC<{
    icon: React.ElementType;
    text: string;
    onClick: () => void;
    disabled?: boolean;
    isDestructive?: boolean;
    title?: string;
  }> = ({ icon: Icon, text, onClick, disabled, isDestructive, title }) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) {
          onClick();
          setOpenActionMenu(null);
        }
      }}
      disabled={disabled}
      title={title}
      className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm ${
        disabled 
          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
          : isDestructive 
            ? 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50' 
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      role="menuitem"
    >
      <Icon className="w-4 h-4" />
      <span>{text}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row items-center justify-between p-4 gap-4">
          <div className="w-full md:w-auto">
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${showFilters || activeFiltersCount > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
            >
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filtros Avançados {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
            </button>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
            {filteredShipments.length !== shipments.length ? `${filteredShipments.length} de ` : ''}{shipments.length} embarques listados
          </div>
        </div>

        {showFilters && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex gap-2 mb-4">
                    <button onClick={() => setFilterDate('all')} className={`px-3 py-1 text-sm rounded-full ${filterDate === 'all' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>Qualquer Data</button>
                    <button onClick={() => setFilterDate('today')} className={`px-3 py-1 text-sm rounded-full ${filterDate === 'today' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>Hoje</button>
                    <button onClick={() => setFilterDate('yesterday')} className={`px-3 py-1 text-sm rounded-full ${filterDate === 'yesterday' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>Ontem</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <MultiSelectDropdown label="Placa" options={plateOptions} selectedValues={filterPlate} onChange={setFilterPlate} placeholder="Todas as Placas..." />
                    <MultiSelectDropdown label="Motorista" options={nameOptions} selectedValues={filterName} onChange={setFilterName} placeholder="Todos os Motoristas..." />
                    <MultiSelectDropdown label="Cidade de Origem" options={originOptions} selectedValues={filterOrigin} onChange={setFilterOrigin} placeholder="Todas as Origens..." />
                    <MultiSelectDropdown label="Cidade de Destino" options={destOptions} selectedValues={filterDest} onChange={setFilterDest} placeholder="Todos os Destinos..." />
                    <MultiSelectDropdown label="Cliente" options={clientOptions} selectedValues={filterClient} onChange={setFilterClient} placeholder="Todos os Clientes..." />
                </div>
                {activeFiltersCount > 0 && (
                    <div className="mt-4 flex justify-end">
                        <button onClick={clearFilters} className="text-sm flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                            <X className="w-4 h-4" /> Limpar Filtros
                        </button>
                    </div>
                )}
                
                <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Faturamento Bruto por Embarcador</h4>
                    <div className="flex flex-wrap gap-4">
                        {Object.entries(shipperSummary).length > 0 ? Object.entries(shipperSummary).map(([shipperId, data]) => (
                            <div key={shipperId} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600 min-w-[200px]">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{getEmbarcadorName(shipperId)}</p>
                                <div className="mt-1 flex justify-between items-end">
                                    <span className="text-lg font-bold text-gray-800 dark:text-white">{data.count} <span className="text-xs font-normal text-gray-500">emb.</span></span>
                                    <span className="text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(data.revenue)}</span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum dado encontrado para os filtros atuais.</p>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        {/* Mobile View - Cards */}
        <div className="grid grid-cols-1 divide-y divide-gray-100 dark:divide-gray-700 lg:hidden">
          {filteredShipments.map((shipment) => {
            const cargo = getCargoInfo(shipment.cargoId);
            const vehicle = vehicles.find(v => v.plate === shipment.horsePlate);
            const whatsappLink = shipment.driverContact ? formatWhatsAppLink(shipment.driverContact) : null;
            const advanceStatusCheck = canUserAdvanceStatus ? canUserAdvanceStatus(shipment) : { allowed: true, reason: '' };
            const canAdvance = advanceStatusCheck.allowed;
            const disabledReason = advanceStatusCheck.reason;
            const isActionable = shipment.status !== ShipmentStatus.Finalizado && shipment.status !== ShipmentStatus.Cancelado;

            return (
              <div key={shipment.id} className="p-3 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <button 
                      onClick={() => setDetailsModalShipment(shipment)} 
                      className="text-sm font-bold text-primary dark:text-blue-400 hover:underline"
                    >
                      {shipment.id}
                    </button>
                    {cargo && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Carga: <button onClick={() => onShowCargoDetails?.(cargo)} className="font-semibold text-primary/80">#{cargo.sequenceId}</button>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {shipment.status}
                    </span>
                    {shipment.status === ShipmentStatus.Cancelado && shipment.cancellationReason && (
                        <div className="text-[10px] text-red-500 font-semibold mt-1 max-w-[120px] break-words">
                          Motivo: {shipment.cancellationReason}
                        </div>
                    )}
                    {[ShipmentStatus.AguardandoNota, ShipmentStatus.AguardandoAdiantamento, ShipmentStatus.AguardandoAgendamento, ShipmentStatus.AguardandoDescarga, ShipmentStatus.AguardandoPagamentoSaldo, ShipmentStatus.Finalizado].includes(shipment.status) && (
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1">
                          {shipment.shipmentTonnage.toLocaleString('pt-BR')} ton
                        </div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">
                      {new Date(shipment.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Motorista</div>
                    <div className="font-medium dark:text-gray-200">{shipment.driverName}</div>
                    <div className="text-xs text-gray-500">{shipment.horsePlate}</div>
                    {(vehicle || shipment.vehicleSetType || shipment.vehicleBodyType) && (
                      <span className="mt-1 inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                        {shipment.vehicleSetType || vehicle?.setType} / {shipment.vehicleBodyType || vehicle?.bodyType}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Frete / Ton</div>
                    <div className="font-bold dark:text-gray-200">
                      {isClient 
                        ? formatCurrency(cargo?.companyFreightValuePerTon || 0)
                        : formatCurrency(shipment.driverFreightValue / (shipment.shipmentTonnage || 1))
                      }
                    </div>
                  </div>
                  {currentUser.profile !== UserProfile.Embarcador && (
                    <>
                      <div className="col-span-2 mt-1">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Detalhamento Financeiro</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded border dark:border-gray-600">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-gray-500 font-bold">MTR:</span>
                            <span className="text-xs font-bold dark:text-white">
                              {formatCurrency(shipment.driverFreightValue / (shipment.shipmentTonnage || 1))}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-gray-500 font-bold">EMP:</span>
                            <span className="text-xs font-bold text-primary dark:text-blue-400">
                              {formatCurrency(shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-gray-500 font-bold">MARGEM:</span>
                            {(() => {
                               const companyRate = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
                               const driverRate = shipment.driverFreightValue / (shipment.shipmentTonnage || 1);
                               const perTonProfit = companyRate - driverRate;
                               const marginPercent = companyRate > 0 ? (perTonProfit / companyRate) * 100 : 0;
                               
                               let colorClass = 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
                               if (marginPercent < 5) colorClass = 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
                               else if (marginPercent < 6) colorClass = 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
                               else if (marginPercent < 7) colorClass = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
                               else colorClass = 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';

                               return (
                                 <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colorClass}`}>
                                   {marginPercent.toFixed(1).replace('.', ',')}%
                                 </span>
                               );
                            })()}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Rota (Origem → Destino)</div>
                  {cargo ? (
                    <div className="text-xs dark:text-gray-300">
                      <span className="font-semibold">{cargo.origin}</span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="font-semibold">{shipment.route || cargo.destination}</span>
                    </div>
                  ) : (
                    <span className="text-red-500 font-bold text-[10px]">CARGA REMOVIDA</span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700">
                  <div className="flex gap-2">
                    {whatsappLink && (
                      <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="p-1 hover:opacity-80 transition-opacity">
                        <WhatsAppIcon className="w-7 h-7" />
                      </a>
                    )}
                    {onShowHistory && (
                      <button onClick={() => onShowHistory(shipment)} className="p-2 rounded-full bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        <HistoryIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {(!isClient || showActionsColumnForClient) && (
                      <button 
                        onClick={(e) => toggleActionMenu(shipment.id, e)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-xs rounded-md shadow-sm hover:bg-primary/90"
                      >
                        Ações <MoreVerticalIcon className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Embarque / Carga</th>
                <th scope="col" className="px-6 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Motorista / Solicitante</th>
                <th scope="col" className="px-6 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Origem / Destino</th>
                {currentUser.profile !== UserProfile.Embarcador && (
                  <th scope="col" className="px-6 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Margem</th>
                )}
                <th scope="col" className="px-6 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Frete / Ton</th>
                <th scope="col" className="px-6 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Status Atual</th>
                <th scope="col" className="px-6 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Data Programada</th>
                {(!isClient || showActionsColumnForClient) && (
                  <th scope="col" className="px-6 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredShipments.map((shipment) => {
                const cargo = getCargoInfo(shipment.cargoId);
                const vehicle = vehicles.find(v => v.plate === shipment.horsePlate);
                const isActionable = shipment.status !== ShipmentStatus.Finalizado && shipment.status !== ShipmentStatus.Cancelado;
                const whatsappLink = shipment.driverContact ? formatWhatsAppLink(shipment.driverContact) : null;
                const advanceStatusCheck = canUserAdvanceStatus ? canUserAdvanceStatus(shipment) : { allowed: true, reason: '' };
                const canAdvance = advanceStatusCheck.allowed;
                const disabledReason = advanceStatusCheck.reason;
                const statusHistoryCount = shipment.statusHistory?.length || 0;

                let isLate = false;
                if (shipment.scheduledTime && !shipment.arrivalTime) {
                  const scheduledDateTime = new Date(`${shipment.scheduledDate}T${shipment.scheduledTime}`);
                  if (new Date() > scheduledDateTime) {
                      isLate = true;
                  }
                }

                return (
                  <tr key={shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-[11px] whitespace-nowrap text-sm">
                      <button 
                          onClick={() => setDetailsModalShipment(shipment)} 
                          className="font-medium text-primary dark:text-blue-400 hover:underline text-left block"
                      >
                          {shipment.id}
                      </button>
                      {cargo && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Carga: 
                          {onShowCargoDetails ? (
                            <button onClick={() => onShowCargoDetails(cargo)} className="ml-1 font-semibold text-primary dark:text-blue-400 hover:underline">
                              {cargo.sequenceId}
                            </button>
                          ) : (
                            <span className="ml-1 font-semibold">{cargo.sequenceId}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-[11px] whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{shipment.driverName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{shipment.horsePlate}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Sol.: <span className="font-medium">{getEmbarcadorName(shipment.embarcadorId)}</span>
                      </div>
                      {(vehicle || shipment.vehicleSetType || shipment.vehicleBodyType) && (
                          <div className="mt-1">
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                              {shipment.vehicleSetType || vehicle?.setType} / {shipment.vehicleBodyType || vehicle?.bodyType}
                          </span>
                          </div>
                      )}
                    </td>
                    <td className="px-6 py-[11px] whitespace-nowrap text-sm text-gray-900 dark:text-white group relative">
                      {cargo ? (
                        <>
                          <div>{cargo.origin}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{shipment.route || cargo.destination}</div>
                        </>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-red-500 dark:text-red-400 font-bold text-[10px] uppercase">Carga Removida</span>
                          <span className="text-gray-400 text-xs italic">Origem/Destino indisponíveis</span>
                        </div>
                      )}
                       {cargo && onShowCargoDetails && (
                          <button 
                              onClick={() => onShowCargoDetails(cargo)} 
                              className="absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded-full text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-600"
                              title="Ver detalhes da Carga"
                          >
                              <InfoIcon className="w-4 h-4" />
                          </button>
                      )}
                    </td>
                    {currentUser.profile !== UserProfile.Embarcador && (
                      <td className="px-6 py-[11px] whitespace-nowrap text-sm">
                        {(() => {
                          const companyRate = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
                          const driverRate = shipment.driverFreightValue / (shipment.shipmentTonnage || 1);
                          const perTonProfit = companyRate - driverRate;
                          const marginPercent = companyRate > 0 ? (perTonProfit / companyRate) * 100 : 0;
                          
                          let colorClass = 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
                          if (marginPercent < 5) colorClass = 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
                          else if (marginPercent < 6) colorClass = 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
                          else if (marginPercent < 7) colorClass = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
                          else colorClass = 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';

                          return (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colorClass}`}>
                              {marginPercent.toFixed(1).replace('.', ',')}%
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    <td className="px-6 py-[11px] whitespace-nowrap text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">Mtr:</span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {formatCurrency(shipment.driverFreightValue / (shipment.shipmentTonnage || 1))}
                          </span>
                        </div>
                        {currentUser.profile !== UserProfile.Embarcador && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Emp:</span>
                            <span className="font-medium text-primary dark:text-blue-400">
                              {formatCurrency(shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0)}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-[11px] whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{shipment.status}</p>
                      {shipment.status === ShipmentStatus.Cancelado && shipment.cancellationReason && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-1 max-w-[150px] whitespace-normal italic">
                          Motivo: {shipment.cancellationReason}
                        </p>
                      )}
                      {[ShipmentStatus.AguardandoNota, ShipmentStatus.AguardandoAdiantamento, ShipmentStatus.AguardandoAgendamento, ShipmentStatus.AguardandoDescarga, ShipmentStatus.AguardandoPagamentoSaldo, ShipmentStatus.Finalizado].includes(shipment.status) && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-1">
                          Efetivado: {shipment.shipmentTonnage.toLocaleString('pt-BR')} ton
                        </p>
                      )}
                      {shipment.scheduledTime && (
                          <p 
                            className={`text-xs mt-1 ${isLate && !shipment.arrivalTime ? 'text-yellow-500' : 'text-gray-500'} cursor-pointer hover:underline flex items-center gap-1`}
                            onClick={() => onOpenEditScheduledDateTime && onOpenEditScheduledDateTime(shipment)}
                            title="Clique para alterar data/hora"
                          >
                            <Clock className="w-3 h-3" />
                            Previsto: {shipment.scheduledTime}
                          </p>
                      )}

                      {shipment.arrivalTime ? (
                          <div className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1">
                              Chegou: {new Date(shipment.arrivalTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                      ) : (
                          onMarkArrival && shipment.scheduledTime && (
                              <button onClick={() => onMarkArrival(shipment.id)} className="mt-2 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                                  Marcar Chegada
                              </button>
                          )
                      )}
                    </td>
                    <td 
                      className="px-6 py-[11px] whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary dark:hover:text-blue-400 transition-colors group/date"
                      onClick={() => onOpenEditScheduledDateTime && onOpenEditScheduledDateTime(shipment)}
                      title="Clique para alterar data/hora"
                    >
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 opacity-0 group-hover/date:opacity-100 transition-opacity" />
                        <span>{new Date(shipment.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    </td>

                    {(!isClient || showActionsColumnForClient) && (
                      <td className="px-6 py-[11px] whitespace-nowrap text-center text-sm font-medium">
                          {isClient ? (
                              <>
                                  {onAttach && (
                                      <button
                                      onClick={() => onAttach(shipment)}
                                      className="flex items-center gap-1.5 text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors whitespace-nowrap"
                                      title="Gerenciar Anexos"
                                      >
                                      <PaperclipIcon className="w-4 h-4" />
                                      <span>Gestor de Anexos</span>
                                      </button>
                                  )}
                              </>
                          ) : (
                              <div className="flex items-center justify-center space-x-1">
                                  {whatsappLink && (
                                      <a
                                          href={whatsappLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 hover:opacity-80 transition-opacity"
                                          title="Abrir WhatsApp"
                                      >
                                          <WhatsAppIcon className="w-6 h-6" />
                                      </a>
                                  )}
  
                                  {shipment.status === ShipmentStatus.Cancelado && currentUser.profile !== UserProfile.Admin && currentUser.profile !== UserProfile.Diretor ? (
                                      <span className="text-xs text-gray-400 dark:text-gray-500 italic px-2">Cancelado</span>
                                  ) : (
                                      <div className="relative">
                                          {(() => {
                                              const lock = activeLocks?.find(l => l.shipmentId === shipment.id);
                                              const isLockedByOther = lock && lock.userId !== currentUser.id;
                                              
                                              if (isLockedByOther) {
                                                  return (
                                                      <button
                                                          className="p-2 rounded-full text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 cursor-not-allowed border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 transition-colors"
                                                          title={`Bloqueado: ${lock.userName} está realizando o cadastro`}
                                                          disabled
                                                      >
                                                          <Lock className="h-5 w-5 animate-pulse" />
                                                      </button>
                                                  );
                                              }
                                              
                                              return (
                                                  <button
                                                      onClick={(e) => toggleActionMenu(shipment.id, e)}
                                                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
                                                      title="Mais ações"
                                                  >
                                                      <MoreVerticalIcon className="h-5 w-5" />
                                                  </button>
                                              );
                                          })()}
                                          
                                          {openActionMenu === shipment.id && menuPosition && createPortal(
                                              <div 
                                                ref={actionMenuRef}
                                                style={{
                                                  position: 'fixed',
                                                  top: menuPosition.isUp ? 'auto' : `${menuPosition.top + 8}px`,
                                                  bottom: menuPosition.isUp ? `${window.innerHeight - menuPosition.top + 8}px` : 'auto',
                                                  left: `${menuPosition.left - 224}px`, // 224 is w-56 (14rem * 16px)
                                                  zIndex: 9999
                                                }}
                                                className="w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in duration-100"
                                              >
                                                  <div className="py-1" role="menu" aria-orientation="vertical">
                                                      {onShowHistory && <ActionMenuItem icon={HistoryIcon} text="Ver Histórico" onClick={() => onShowHistory(shipment)} />}
                                                      {shipment.status !== ShipmentStatus.Cancelado && (
                                                          <>
                                                              {isActionable && onAttach && (
                                                                <ActionMenuItem 
                                                                    icon={PaperclipIcon} 
                                                                    text="Anexa e Avançar" 
                                                                    onClick={() => onAttach(shipment)} 
                                                                    disabled={!canAdvance && shipment.status !== ShipmentStatus.AguardandoAdiantamento} 
                                                                    title={(!canAdvance && shipment.status !== ShipmentStatus.AguardandoAdiantamento) ? disabledReason : undefined} 
                                                                />
                                                              )}
                                                              {shipment.status === ShipmentStatus.PreCadastro && <ActionMenuItem icon={ExternalLinkIcon} text="Fazer Cadastro" onClick={() => handleFazerCadastroClick(shipment)} />}
                                                              {isActionable && onEditPrice && <ActionMenuItem icon={DollarSignIcon} text="Alterar Preço" onClick={() => onEditPrice(shipment)} />}
                                                              {isActionable && onTransfer && <ActionMenuItem icon={TransferIcon} text="Transferir Embarque" onClick={() => onTransfer(shipment)} />}
                                                              {isActionable && (shipment.status === ShipmentStatus.PreCadastro || shipment.status === ShipmentStatus.AguardandoSeguradora) && onSwapCargo && <ActionMenuItem icon={Package} text="Trocar Carga" onClick={() => onSwapCargo(shipment)} />}
                                                              {onOpenEditScheduledDateTime && <ActionMenuItem icon={Clock} text="Alterar Data/Hora" onClick={() => onOpenEditScheduledDateTime(shipment)} />}
                                                              {shipment.status === ShipmentStatus.Finalizado && onAttach && <ActionMenuItem icon={PaperclipIcon} text="Gestor de Anexos" onClick={() => onAttach(shipment)} />}
                                                              {isActionable && onCancel && (currentUser.profile !== UserProfile.Fiscal || shipment.status === ShipmentStatus.AguardandoSeguradora) && <ActionMenuItem icon={XIcon} text="Cancelar Embarque" onClick={() => onCancel(shipment)} isDestructive />}
                                                          </>
                                                      )}
                                                      {onRevertStatus && statusHistoryCount > 1 && (currentUser.profile === UserProfile.Admin || currentUser.profile === UserProfile.Diretor) && (
                                                          <ActionMenuItem 
                                                              icon={RotateCcw} 
                                                              text="Voltar Status Anterior" 
                                                              onClick={() => {
                                                                  if (window.confirm("Atenção: Reverter o status removerá os anexos do último passo e ajustará os volumes da carga. Deseja continuar?")) {
                                                                      onRevertStatus(shipment.id);
                                                                  }
                                                              }} 
                                                          />
                                                      )}
                                                      {onDelete && can('delete', currentUser, 'shipments', profilePermissions || INITIAL_PERMISSIONS) && <ActionMenuItem icon={Trash2} text="Excluir Embarque" onClick={() => onDelete(shipment.id)} isDestructive />}
                                                  </div>
                                              </div>,
                                              document.body
                                          )}
                                      </div>
                                  )}
                              </div>
                          )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>


    <ShipmentDetailsModal
      isOpen={!!detailsModalShipment}
      onClose={() => setDetailsModalShipment(null)}
      shipment={detailsModalShipment}
      cargo={detailsModalShipment ? getCargoInfo(detailsModalShipment.cargoId) || undefined : undefined}
      currentUser={currentUser}
      onUpdatePrice={onUpdatePrice}
      onUpdateShipmentData={onUpdateShipmentData}
      onAddAttachments={onAddAttachments}
      clients={clients}
      products={products}
      companyLogo={companyLogo}
      vehicles={vehicles}
      users={users}
      onDeleteAttachment={onDeleteAttachment}
    />


  </div>
);
};

export default ShipmentTable;
