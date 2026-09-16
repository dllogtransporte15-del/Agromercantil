import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check, 
  MapPin, 
  ArrowRight, 
  User as UserIcon, 
  Truck, 
  Paperclip, 
  Eye, 
  FileText, 
  LayoutGrid, 
  List, 
  Building2, 
  Package, 
  ExternalLink,
  Flame,
  Maximize2,
  Minimize2,
  Tv,
  Radio
} from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { Shipment, Cargo, Client, Product, Driver, Vehicle, User, ShipmentStatus, REQUIRED_DOCUMENT_MAP } from '../types';
import { useToast } from '../hooks/useToast';

export interface KanbanColumnConfig {
  id: string;
  title: string;
  statuses: ShipmentStatus[];
  thresholds?: { yellow: number; red: number }; // in minutes
  accentColor?: string;
  badgeBg?: string;
  icon?: React.ReactNode;
  emptyText?: string;
}

export interface OptimizedShipmentsBoardProps {
  title?: string;
  description?: string;
  columns: KanbanColumnConfig[];
  shipments: Shipment[];
  cargos: Cargo[];
  clients: Client[];
  products: Product[];
  users: User[];
  drivers?: Driver[];
  vehicles?: Vehicle[];
  currentUser: User | null;
  onShowDetails: (shipment: Shipment) => void;
  onAttach?: (shipment: Shipment) => void;
  onOpenCadastroAntt?: (shipment: Shipment) => void;
  onEditPrice?: (shipment: Shipment) => void;
}

type SlaUrgencyFilter = 'all' | 'normal' | 'warning' | 'critical';
type DensityMode = 'expanded' | 'compact';

export const OptimizedShipmentsBoard: React.FC<OptimizedShipmentsBoardProps> = ({
  title,
  description,
  columns,
  shipments,
  cargos,
  clients,
  products,
  users,
  drivers = [],
  vehicles = [],
  currentUser,
  onShowDetails,
  onAttach,
  onOpenCadastroAntt,
  onEditPrice,
}) => {
  const { showToast } = useToast();

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [slaFilter, setSlaFilter] = useState<SlaUrgencyFilter>('all');
  const [selectedEmbarcadorId, setSelectedEmbarcadorId] = useState<string>('all');
  const [densityMode, setDensityMode] = useState<DensityMode>('expanded');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPlate, setCopiedPlate] = useState<string | null>(null);
  const [isTvMode, setIsTvMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveTime, setLiveTime] = useState(() => new Date().toLocaleTimeString('pt-BR'));

  // TV Mode Auto-Scroll System
  const columnScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [hoveredColumnId, setHoveredColumnId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleTvMode = useCallback(() => {
    setIsTvMode(prev => {
      const next = !prev;
      if (next) {
        // Entering TV Mode: reset filters to ensure all shipments are shown
        setSearchTerm('');
        setSlaFilter('all');
        setSelectedEmbarcadorId('all');
        // Reset column scroll positions to top
        Object.values(columnScrollRefs.current).forEach(el => {
          if (el) el.scrollTop = 0;
        });
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs && isTvMode) {
        setIsTvMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isTvMode]);

  // TV Auto-Scroll Loop
  useEffect(() => {
    if (!isTvMode) {
      Object.values(columnScrollRefs.current).forEach(el => {
        if (el) el.scrollTop = 0;
      });
      return;
    }

    const scrollStates: Record<string, { state: 'top_pause' | 'scrolling' | 'bottom_pause'; timer: number }> = {};

    columns.forEach(col => {
      scrollStates[col.id] = { state: 'top_pause', timer: Date.now() + 3500 };
    });

    const scrollStep = 0.85; // smooth scrolling speed (~28px/second)

    const interval = setInterval(() => {
      const now = Date.now();

      columns.forEach(col => {
        // Pause scrolling if column is hovered by user mouse
        if (hoveredColumnId === col.id) return;

        const el = columnScrollRefs.current[col.id];
        if (!el) return;

        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll <= 5) return; // Column fits completely on screen

        const colState = scrollStates[col.id];
        if (!colState) return;

        if (colState.state === 'top_pause') {
          if (now >= colState.timer) {
            colState.state = 'scrolling';
          }
        } else if (colState.state === 'scrolling') {
          if (el.scrollTop + scrollStep >= maxScroll) {
            el.scrollTop = maxScroll;
            colState.state = 'bottom_pause';
            colState.timer = now + 4000; // Pause at bottom for 4s
          } else {
            el.scrollTop += scrollStep;
          }
        } else if (colState.state === 'bottom_pause') {
          if (now >= colState.timer) {
            el.scrollTo({ top: 0, behavior: 'smooth' });
            colState.state = 'top_pause';
            colState.timer = now + 3500; // Pause at top for 3.5s
          }
        }
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isTvMode, columns, hoveredColumnId]);

  // Helper Mappings
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  // Unique list of Embarcadores in current shipments
  const embarcadoresInShipments = useMemo(() => {
    const ids = new Set(shipments.map(s => s.embarcadorId).filter(Boolean));
    return users.filter(u => ids.has(u.id));
  }, [shipments, users]);

  // Column threshold lookup map
  const columnThresholdMap = useMemo(() => {
    const map = new Map<ShipmentStatus, { yellow: number; red: number }>();
    columns.forEach(col => {
      if (col.thresholds) {
        col.statuses.forEach(st => map.set(st, col.thresholds!));
      }
    });
    return map;
  }, [columns]);

  // SLA Calculation Helpers
  const getShipmentStatusStartTime = useCallback((shipment: Shipment): number => {
    const currentEntry = shipment.statusHistory?.[shipment.statusHistory.length - 1];
    const timestamp = currentEntry?.timestamp || shipment.createdAt;
    return new Date(timestamp).getTime();
  }, []);

  const getShipmentSlaInfo = useCallback((shipment: Shipment) => {
    const startTime = getShipmentStatusStartTime(shipment);
    const now = Date.now();
    const elapsedMinutes = Math.max(0, Math.floor((now - startTime) / (1000 * 60)));
    const thresholds = columnThresholdMap.get(shipment.status);

    let urgency: 'normal' | 'warning' | 'critical' = 'normal';
    if (thresholds) {
      if (elapsedMinutes >= thresholds.red) {
        urgency = 'critical';
      } else if (elapsedMinutes >= thresholds.yellow) {
        urgency = 'warning';
      }
    }

    return { elapsedMinutes, urgency, startTime, thresholds };
  }, [getShipmentStatusStartTime, columnThresholdMap]);

  const formatElapsedTime = useCallback((minutes: number): string => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }, []);

  const formatDate = useCallback((timeMs: number): string => {
    if (!timeMs) return '';
    return new Date(timeMs).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // WhatsApp Helpers
  const getWhatsAppLink = useCallback((phone?: string, text?: string): string | null => {
    if (!phone) return null;
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return null;
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${fullPhone}${encodedText}`;
  }, []);

  // Copy Helpers
  const handleCopyText = useCallback((text: string, type: 'id' | 'plate', itemKey: string) => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(itemKey);
      setTimeout(() => setCopiedId(null), 2000);
      showToast(`ID #${text} copiado!`, 'info', 2000);
    } else {
      setCopiedPlate(itemKey);
      setTimeout(() => setCopiedPlate(null), 2000);
      showToast(`Placa ${text} copiada!`, 'info', 2000);
    }
  }, [showToast]);

  const handleCopySummary = useCallback((shipment: Shipment) => {
    const cargo = cargoMap.get(shipment.cargoId);
    const client = cargo ? clientMap.get(cargo.clientId) : undefined;
    const product = cargo ? productMap.get(cargo.productId) : undefined;
    const embarcador = userMap.get(shipment.embarcadorId);
    const { elapsedMinutes } = getShipmentSlaInfo(shipment);
    const elapsedStr = formatElapsedTime(elapsedMinutes);
    const clientName = client ? (client.nomeFantasia || client.razaoSocial) : 'N/A';
    const productName = product ? product.name : 'N/A';
    const origin = cargo ? cargo.origin : 'N/A';
    const destination = cargo ? cargo.destination : 'N/A';
    const embarcadorName = embarcador ? embarcador.name : 'N/A';

    const summary = [
      `🚛 *DETALHES DO EMBARQUE #${shipment.id}*`,
      `👤 *Motorista:* ${shipment.driverName} ${shipment.driverCpf ? `(CPF: ${shipment.driverCpf})` : ''}`,
      `🚚 *Cavalo:* ${shipment.horsePlate} ${shipment.trailer1Plate ? `| Carreta: ${shipment.trailer1Plate}` : ''}`,
      `📍 *Rota:* ${origin} ➔ ${destination}`,
      `🏢 *Cliente:* ${clientName}`,
      `📦 *Produto:* ${productName} (${shipment.shipmentTonnage.toLocaleString('pt-BR')} t)`,
      `⏱️ *Status:* ${shipment.status} (Tempo no status: ${elapsedStr})`,
      `👤 *Solicitante:* ${embarcadorName}`,
    ].join('\n');

    navigator.clipboard.writeText(summary);
    showToast('Ficha resumida copiada para o WhatsApp!', 'success');
  }, [cargoMap, clientMap, productMap, userMap, getShipmentSlaInfo, formatElapsedTime, showToast]);

  // Filtered Shipments
  const filteredShipments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return shipments.filter(shipment => {
      const cargo = cargoMap.get(shipment.cargoId);
      const client = cargo ? clientMap.get(cargo.clientId) : undefined;
      const product = cargo ? productMap.get(cargo.productId) : undefined;
      const embarcador = userMap.get(shipment.embarcadorId);

      // 1. Solicitante Filter
      if (selectedEmbarcadorId !== 'all' && shipment.embarcadorId !== selectedEmbarcadorId) {
        return false;
      }

      // 2. SLA Filter
      if (slaFilter !== 'all') {
        const { urgency } = getShipmentSlaInfo(shipment);
        if (urgency !== slaFilter) return false;
      }

      // 3. Search Filter
      if (search) {
        const idMatch = (shipment.id || '').toLowerCase().includes(search);
        const driverNameMatch = (shipment.driverName || '').toLowerCase().includes(search);
        const driverCpfMatch = (shipment.driverCpf || '').replace(/\D/g, '').includes(search.replace(/\D/g, ''));
        const horsePlateMatch = (shipment.horsePlate || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(search.replace(/[^a-z0-9]/g, ''));
        const trailer1Match = (shipment.trailer1Plate || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(search.replace(/[^a-z0-9]/g, ''));
        const embarcadorMatch = (embarcador?.name || '').toLowerCase().includes(search);
        const clientMatch = (client?.nomeFantasia || client?.razaoSocial || '').toLowerCase().includes(search);
        const productMatch = (product?.name || '').toLowerCase().includes(search);
        const originMatch = (cargo?.origin || '').toLowerCase().includes(search);
        const destMatch = (cargo?.destination || '').toLowerCase().includes(search);

        if (!idMatch && !driverNameMatch && !driverCpfMatch && !horsePlateMatch && !trailer1Match && !embarcadorMatch && !clientMatch && !productMatch && !originMatch && !destMatch) {
          return false;
        }
      }

      return true;
    });
  }, [shipments, searchTerm, selectedEmbarcadorId, slaFilter, cargoMap, clientMap, productMap, userMap, getShipmentSlaInfo]);

  // SLA Stats Calculation for KPIs
  const slaStats = useMemo(() => {
    let normal = 0;
    let warning = 0;
    let critical = 0;

    shipments.forEach(s => {
      const { urgency } = getShipmentSlaInfo(s);
      if (urgency === 'critical') critical++;
      else if (urgency === 'warning') warning++;
      else normal++;
    });

    return { total: shipments.length, normal, warning, critical };
  }, [shipments, getShipmentSlaInfo]);

  // Group and sort Shipments by Column (Standardized: most delayed on top)
  const shipmentsByColumn = useMemo(() => {
    const grouped: Record<string, Shipment[]> = {};
    columns.forEach(col => {
      grouped[col.id] = [];
    });

    filteredShipments.forEach(shipment => {
      for (const col of columns) {
        if (col.statuses.includes(shipment.status)) {
          grouped[col.id].push(shipment);
          break;
        }
      }
    });

    // Urgency weight: Critical (3) > Warning (2) > Normal (1)
    const urgencyWeight: Record<string, number> = { critical: 3, warning: 2, normal: 1 };

    // Standardize sorting: most delayed on top for every column
    Object.keys(grouped).forEach(colId => {
      grouped[colId].sort((a, b) => {
        const slaA = getShipmentSlaInfo(a);
        const slaB = getShipmentSlaInfo(b);

        // 1. Priority by Urgency status (Critical on top, then Warning, then Normal)
        const weightDiff = (urgencyWeight[slaB.urgency] || 0) - (urgencyWeight[slaA.urgency] || 0);
        if (weightDiff !== 0) return weightDiff;

        // 2. Highest elapsed wait time in minutes (most delayed) on top
        if (slaB.elapsedMinutes !== slaA.elapsedMinutes) {
          return slaB.elapsedMinutes - slaA.elapsedMinutes;
        }

        // 3. Oldest start time
        return slaA.startTime - slaB.startTime;
      });
    });

    return grouped;
  }, [columns, filteredShipments, getShipmentSlaInfo]);

  // Document Name Helper
  const getDocumentActionName = useCallback((status: ShipmentStatus): string => {
    const raw = REQUIRED_DOCUMENT_MAP[status];
    if (!raw) return 'Anexar Documento';
    if (status === ShipmentStatus.AguardandoSeguradora) return 'Anexar Seguradora';
    if (status === ShipmentStatus.PreCadastro) return 'Anexar Cadastro';
    if (status === ShipmentStatus.AguardandoNota) return 'Anexar NF-e';
    if (status === ShipmentStatus.AguardandoFiscal) return 'Anexar CT-e / Docs';
    if (status === ShipmentStatus.AguardandoAdiantamento) return 'Anexar Adiantamento';
    if (status === ShipmentStatus.AguardandoDescarga) return 'Anexar Descarga';
    if (status === ShipmentStatus.AguardandoPagamentoSaldo) return 'Anexar Saldo';
    if (status === ShipmentStatus.AguardandoCarregamento) return 'Anexar Ticket / Rota';
    return `Anexar ${raw}`;
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm p-4 sm:p-5 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {title || 'Painel de Gestão dos Embarques'}
                  </h2>
                  <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-bold shadow-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>TEMPO REAL • {liveTime}</span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {description || 'Monitoramento contínuo em tempo real com visão total dos embarques'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick SLA KPI Pills & TV Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {!isTvMode ? (
              <>
                <button
                  onClick={() => setSlaFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                    slaFilter === 'all'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 ring-2 ring-gray-900/20 dark:ring-white/20'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                  title="Filtrar todos os embarques"
                >
                  <span>Todos</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/20 text-[11px]">
                    {slaStats.total}
                  </span>
                </button>

                <button
                  onClick={() => setSlaFilter(slaFilter === 'normal' ? 'all' : 'normal')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                    slaFilter === 'normal'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/30'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200/60 dark:border-emerald-800/40'
                  }`}
                  title="Filtrar embarques dentro do prazo"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>No Prazo</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-[11px]">
                    {slaStats.normal}
                  </span>
                </button>

                <button
                  onClick={() => setSlaFilter(slaFilter === 'warning' ? 'all' : 'warning')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                    slaFilter === 'warning'
                      ? 'bg-amber-600 text-white ring-2 ring-amber-500/30'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50 border border-amber-200/60 dark:border-amber-800/40'
                  }`}
                  title="Filtrar embarques que necessitam de atenção"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Atenção</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-[11px]">
                    {slaStats.warning}
                  </span>
                </button>

                <button
                  onClick={() => setSlaFilter(slaFilter === 'critical' ? 'all' : 'critical')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                    slaFilter === 'critical'
                      ? 'bg-rose-600 text-white ring-2 ring-rose-500/30 animate-pulse'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 border border-rose-200/60 dark:border-rose-800/40'
                  }`}
                  title="Filtrar embarques críticos / atrasados"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  <span>Crítico</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-[11px] font-bold">
                    {slaStats.critical}
                  </span>
                </button>

                <div className="h-6 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold font-mono">
                  {slaStats.total} Embarques
                </span>
                {slaStats.critical > 0 && (
                  <span className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold font-mono animate-pulse flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    {slaStats.critical} Críticos
                  </span>
                )}
                {slaStats.warning > 0 && (
                  <span className="px-2.5 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold font-mono flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {slaStats.warning} Atenção
                  </span>
                )}
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                  <Radio className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                  <span>Rolagem Automática</span>
                </div>
              </div>
            )}

            {/* TV / Fullscreen Mode Toggle */}
            <button
              onClick={toggleTvMode}
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs flex-shrink-0 ${
                isTvMode
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 ring-2 ring-indigo-500/40'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              }`}
              title={isTvMode ? "Sair do modo TV e restaurar filtros" : "Ativar Modo TV (Oculta filtros e maximiza visão da tela)"}
            >
              {isTvMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
              <span>{isTvMode ? "Sair TV" : "Modo TV"}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row - Ocultado no Modo TV */}
        {!isTvMode && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60 flex flex-col md:flex-row items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por placa, motorista, CPF, solicitante, rota, cliente..."
                className="w-full pl-9 pr-9 py-2 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Solicitante Filter & Density Switcher */}
            <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
              
              {/* Solicitante Dropdown */}
              {embarcadoresInShipments.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">Solicitante:</span>
                  <select
                    value={selectedEmbarcadorId}
                    onChange={(e) => setSelectedEmbarcadorId(e.target.value)}
                    className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="all">Todos os Solicitantes ({embarcadoresInShipments.length})</option>
                    {embarcadoresInShipments.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Density Toggle */}
              <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-900/80 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                <button
                  onClick={() => setDensityMode('expanded')}
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    densityMode === 'expanded'
                      ? 'bg-white dark:bg-gray-800 text-primary shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                  }`}
                  title="Visualização Expandida (Cards Ricos)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rico</span>
                </button>
                <button
                  onClick={() => setDensityMode('compact')}
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    densityMode === 'compact'
                      ? 'bg-white dark:bg-gray-800 text-primary shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                  }`}
                  title="Visualização Compacta (Alta Densidade)"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Compacto</span>
                </button>
              </div>

              {/* Reset Filters button if any active */}
              {(searchTerm || slaFilter !== 'all' || selectedEmbarcadorId !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSlaFilter('all');
                    setSelectedEmbarcadorId('all');
                  }}
                  className="px-2.5 py-1.5 text-xs text-primary dark:text-blue-400 hover:underline font-medium"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kanban Columns Grid */}
      <div className={`grid grid-cols-1 gap-3.5 ${
        columns.length === 1 ? 'grid-cols-1' :
        columns.length === 2 ? 'md:grid-cols-2' :
        columns.length === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
        'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      } ${isTvMode ? 'h-[calc(100vh-175px)] sm:h-[calc(100vh-185px)]' : ''}`}>
        {columns.map(column => {
          const columnShipments = shipmentsByColumn[column.id] || [];

          return (
            <div
              key={column.id}
              className={`flex flex-col bg-gray-50/70 dark:bg-gray-900/40 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-xs overflow-hidden ${
                isTvMode ? 'h-full' : ''
              }`}
              onMouseEnter={() => setHoveredColumnId(column.id)}
              onMouseLeave={() => setHoveredColumnId(null)}
            >
              {/* Column Header */}
              <div className="py-2.5 px-3 bg-white dark:bg-gray-800 border-b border-gray-200/70 dark:border-gray-700/70 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" style={{ backgroundColor: column.accentColor || undefined }} />
                  <h3 className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate" title={column.title}>
                    {column.title}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {column.thresholds && (
                    <span 
                      className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono"
                      title={`SLA: Atenção > ${column.thresholds.yellow >= 60 ? `${Math.floor(column.thresholds.yellow/60)}h` : `${column.thresholds.yellow}m`}, Crítico > ${column.thresholds.red >= 60 ? `${Math.floor(column.thresholds.red/60)}h` : `${column.thresholds.red}m`}`}
                    >
                      SLA {column.thresholds.yellow >= 60 ? `${Math.floor(column.thresholds.yellow/60)}h` : `${column.thresholds.yellow}m`}
                    </span>
                  )}
                  <span className="px-2 py-0.2 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-400 text-xs font-bold font-mono">
                    {columnShipments.length}
                  </span>
                </div>
              </div>

              {/* Column Cards Container - Expande e faz auto-scroll no modo TV */}
              <div 
                ref={el => { columnScrollRefs.current[column.id] = el; }}
                className={`p-2.5 space-y-2 flex-1 ${
                  isTvMode ? 'overflow-y-auto no-scrollbar scroll-smooth' : 'min-h-[140px]'
                }`}
                style={isTvMode ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : undefined}
              >
                {columnShipments.length > 0 ? (
                  columnShipments.map(shipment => {
                    const cargo = cargoMap.get(shipment.cargoId);
                    const client = cargo ? clientMap.get(cargo.clientId) : undefined;
                    const product = cargo ? productMap.get(cargo.productId) : undefined;
                    const embarcador = userMap.get(shipment.embarcadorId);
                    const { elapsedMinutes, urgency, startTime } = getShipmentSlaInfo(shipment);
                    const formattedElapsed = formatElapsedTime(elapsedMinutes);
                    const clientDisplayName = client ? (client.nomeFantasia || client.razaoSocial) : 'Cliente não informado';
                    const productName = product ? product.name : 'Carga geral';
                    const origin = cargo ? cargo.origin : 'Origem N/A';
                    const destination = cargo ? cargo.destination : 'Destino N/A';
                    const embarcadorName = embarcador ? embarcador.name : 'Não informado';
                    
                    const driverWhatsAppText = `Olá ${shipment.driverName}, aqui é da transportadora referente ao embarque #${shipment.id} (${origin} ➔ ${destination}). Tudo bem?`;
                    const driverWhatsAppUrl = getWhatsAppLink(shipment.driverContact, driverWhatsAppText);
                    const embarcadorWhatsAppUrl = getWhatsAppLink(embarcador?.phone, `Olá ${embarcadorName}, sobre o embarque #${shipment.id} (${shipment.driverName} - ${shipment.horsePlate})...`);
                    const docActionName = getDocumentActionName(shipment.status);

                    // Urgency Visual Styles
                    const slaBadgeClass = 
                      urgency === 'critical'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold'
                        : urgency === 'warning'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-semibold'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium';

                    const cardBorderHighlight = 
                      urgency === 'critical'
                        ? 'border-l-[3px] border-l-rose-500'
                        : urgency === 'warning'
                        ? 'border-l-[3px] border-l-amber-500'
                        : 'border-l-[3px] border-l-primary';

                    if (densityMode === 'compact') {
                      return (
                        <div
                          key={shipment.id}
                          className={`bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200/90 dark:border-gray-700 shadow-xs hover:shadow-sm transition-all duration-150 ${cardBorderHighlight}`}
                        >
                          {/* Compact Row 1: ID, Time, SLA */}
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onShowDetails(shipment);
                                }}
                                className="font-mono text-xs font-bold text-primary dark:text-blue-400 hover:underline truncate cursor-pointer"
                                title="Ver detalhes completos"
                              >
                                #{shipment.id}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(shipment.id, 'id', shipment.id);
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                                title="Copiar ID"
                              >
                                {copiedId === shipment.id ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                              </button>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className={`text-[9px] px-1.5 py-0.2 rounded flex items-center gap-1 ${slaBadgeClass}`}>
                                <Clock className="w-2.5 h-2.5" />
                                {formattedElapsed}
                              </span>
                            </div>
                          </div>

                          {/* Compact Row 2: Driver & Plate */}
                          <div className="flex items-center justify-between gap-1.5 mb-1.5 text-xs">
                            <div className="flex items-center gap-1 min-w-0">
                              <UserIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="font-semibold text-gray-900 dark:text-white truncate" title={shipment.driverName}>
                                {shipment.driverName}
                              </span>
                              {driverWhatsAppUrl && (
                                <a
                                  href={driverWhatsAppUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-500 hover:text-green-600 transition-colors p-0.5 flex-shrink-0"
                                  title="WhatsApp"
                                >
                                  <WhatsAppIcon className="w-3 h-3" />
                                </a>
                              )}
                            </div>

                            <button
                              onClick={() => handleCopyText(shipment.horsePlate, 'plate', shipment.id)}
                              className="px-1.5 py-0.2 bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 text-gray-800 dark:text-gray-200 rounded font-mono text-[10px] font-bold flex items-center gap-0.5 flex-shrink-0"
                              title="Copiar placa"
                            >
                              <span>{shipment.horsePlate}</span>
                              {copiedPlate === shipment.id ? <Check className="w-2 h-2 text-green-500" /> : <Copy className="w-2 h-2 opacity-50" />}
                            </button>
                          </div>

                          {/* Compact Row 3: Route & Tonnage */}
                          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 gap-1 mb-1.5">
                            <div className="flex items-center gap-1 truncate" title={`${origin} ➔ ${destination}`}>
                              <MapPin className="w-2.5 h-2.5 text-red-500/80 flex-shrink-0" />
                              <span className="truncate">{origin}</span>
                              <ArrowRight className="w-2 h-2 flex-shrink-0 text-gray-400" />
                              <span className="truncate">{destination}</span>
                            </div>
                            <span className="font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">
                              {shipment.shipmentTonnage}t
                            </span>
                          </div>

                          {/* Compact Row 4: Action Buttons */}
                          <div className="flex items-center gap-1 pt-1.5 border-t border-gray-100 dark:border-gray-700/60">
                            {onAttach && (
                              <button
                                onClick={() => onAttach(shipment)}
                                className="flex-1 py-1 px-2 rounded bg-primary hover:bg-primary-dark text-white text-[11px] font-medium flex items-center justify-center gap-1 transition-all shadow-xs"
                                title={`Avançar embarque: ${docActionName}`}
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                <span className="truncate">{docActionName}</span>
                              </button>
                            )}

                            {shipment.status === ShipmentStatus.PreCadastro && onOpenCadastroAntt && (
                              <button
                                onClick={() => onOpenCadastroAntt(shipment)}
                                className="py-1 px-1.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-[11px] font-medium flex items-center gap-0.5 border border-indigo-200 dark:border-indigo-800"
                                title="Fazer Cadastro ANTT"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                <span>ANTT</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowDetails(shipment);
                              }}
                              className="p-1 rounded bg-gray-100 dark:bg-gray-700/70 hover:bg-gray-200 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                              title="Ver detalhes completos"
                            >
                              <Eye className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySummary(shipment);
                              }}
                              className="p-1 rounded bg-gray-100 dark:bg-gray-700/70 hover:bg-gray-200 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                              title="Copiar resumo para WhatsApp"
                            >
                              <FileText className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // EXPANDED CARD (RICO OTIMIZADO)
                    return (
                      <div
                        key={shipment.id}
                        className={`bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200/90 dark:border-gray-700/90 shadow-xs hover:shadow-md transition-all duration-150 ${cardBorderHighlight} space-y-2`}
                      >
                        {/* Header: ID, Date, SLA Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowDetails(shipment);
                              }}
                              className="font-mono text-xs font-bold text-primary dark:text-blue-400 hover:underline cursor-pointer"
                              title="Ver detalhes do embarque"
                            >
                              #{shipment.id}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(shipment.id, 'id', shipment.id);
                              }}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded transition-colors cursor-pointer"
                              title="Copiar ID"
                            >
                              {copiedId === shipment.id ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5 ml-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatDate(startTime)}
                            </span>
                          </div>

                          {/* SLA Pill */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs ${slaBadgeClass}`}>
                              {urgency === 'critical' && <Flame className="w-2.5 h-2.5 text-rose-500 animate-bounce" />}
                              {urgency === 'warning' && <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />}
                              {urgency === 'normal' && <Clock className="w-2.5 h-2.5 text-emerald-500" />}
                              <span className="font-semibold">{formattedElapsed}</span>
                            </span>
                          </div>
                        </div>

                        {/* Motorista, WhatsApp & Veículo */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <UserIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="font-bold text-gray-900 dark:text-white truncate" title={shipment.driverName}>
                              {shipment.driverName}
                            </span>
                            {driverWhatsAppUrl && (
                              <a
                                href={driverWhatsAppUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-500 hover:text-green-600 transition-colors p-0.5 flex-shrink-0"
                                title="Conversar no WhatsApp"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Mercosul / Plate Badge */}
                            <button
                              onClick={() => handleCopyText(shipment.horsePlate, 'plate', shipment.id)}
                              className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded font-mono text-[11px] font-bold tracking-wider flex items-center gap-1 transition-colors"
                              title="Placa do cavalo (clique para copiar)"
                            >
                              <span>{shipment.horsePlate}</span>
                              {copiedPlate === shipment.id ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
                            </button>

                            {shipment.trailer1Plate && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 font-medium" title="Placa da Carreta">
                                Carreta: {shipment.trailer1Plate}
                              </span>
                            )}

                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 ml-0.5">
                              {shipment.shipmentTonnage.toLocaleString('pt-BR')}t
                            </span>
                          </div>
                        </div>

                        {/* Rota, Cliente & Produto */}
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] pt-0.5">
                          {/* Route */}
                          <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300 font-medium truncate max-w-full">
                            <MapPin className="w-3 h-3 text-rose-500 flex-shrink-0" />
                            <span className="truncate" title={origin}>{origin}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate" title={destination}>{destination}</span>
                          </div>

                          {/* Client & Product Badges */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 text-[10px] font-medium truncate max-w-[140px]" title={clientDisplayName}>
                              <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{clientDisplayName}</span>
                            </span>

                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 text-[10px] font-medium truncate max-w-[120px]" title={productName}>
                              <Package className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{productName}</span>
                            </span>
                          </div>
                        </div>

                        {/* Solicitante */}
                        {embarcador && (
                          <div className="pt-1 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                            <span className="truncate">
                              Solicitante: <strong className="text-gray-600 dark:text-gray-400 font-medium">{embarcadorName}</strong>
                            </span>
                            {embarcadorWhatsAppUrl && (
                              <a
                                href={embarcadorWhatsAppUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-500 hover:text-green-600 dark:text-green-400 transition-colors p-0.5 flex-shrink-0"
                                title="WhatsApp do solicitante"
                              >
                                <WhatsAppIcon className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Action Buttons Row */}
                        <div className="pt-1.5 flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-700/60">
                          {/* Primary Action Button: Anexar e Avançar */}
                          {onAttach && (
                            <button
                              onClick={() => onAttach(shipment)}
                              className="flex-1 py-1.5 px-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-xs active:scale-98"
                              title={`Avançar status: ${docActionName}`}
                            >
                              <Paperclip className="w-3 h-3" />
                              <span className="truncate">{docActionName}</span>
                            </button>
                          )}

                          {/* ANTT Action if PreCadastro */}
                          {shipment.status === ShipmentStatus.PreCadastro && onOpenCadastroAntt && (
                            <button
                              onClick={() => onOpenCadastroAntt(shipment)}
                              className="py-1.5 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-medium flex items-center gap-1 transition-colors"
                              title="Fazer Cadastro de Titular ANTT"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>ANTT</span>
                            </button>
                          )}

                          {/* Details Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onShowDetails(shipment);
                            }}
                            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-gray-200/60 dark:border-gray-700 cursor-pointer"
                            title="Ver detalhes completos do embarque"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy Summary Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySummary(shipment);
                            }}
                            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-gray-200/60 dark:border-gray-700 cursor-pointer"
                            title="Copiar resumo formatado para WhatsApp"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-36 flex flex-col items-center justify-center text-center p-3 bg-white/50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700/60">
                    <CheckCircle2 className="w-6 h-6 text-gray-300 dark:text-gray-600 mb-1.5" />
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {column.emptyText || 'Nenhum embarque nesta etapa'}
                    </p>
                    {(searchTerm || slaFilter !== 'all' || selectedEmbarcadorId !== 'all') && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        Tente ajustar os filtros acima.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OptimizedShipmentsBoard;
