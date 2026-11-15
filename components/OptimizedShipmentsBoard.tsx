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
  Radio,
  Wallet,
  Banknote,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  CreditCard
} from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { Shipment, Cargo, Client, Product, Driver, Vehicle, User, ShipmentStatus, REQUIRED_DOCUMENT_MAP } from '../types';
import { useToast } from '../hooks/useToast';
import { openDocumentInNewTab, getShipmentTmsOrderUrl, getShipmentCteFileUrl } from '../utils/documentViewer';
import { getShipmentCte } from '../utils';

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
  realtimeStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastSyncTime?: Date;
  onRefreshData?: (isBackground?: boolean) => Promise<void>;
}

type SlaUrgencyFilter = 'all' | 'normal' | 'warning' | 'critical';
type DensityMode = 'expanded' | 'compact';

export interface ShipmentPaymentDetails {
  rawMethod: string;
  type: 'pix' | 'carta_frete' | 'deposito' | 'outro';
  label: string;
  pixKey?: string;
  bankDetails?: string;
}

export const resolveShipmentPaymentInfo = (shipment: Shipment): ShipmentPaymentDetails => {
  const docs = (shipment.documents || {}) as any;
  const rawMethod = (
    shipment.paymentMethod ||
    docs?.payment_method ||
    docs?.forma_pagamento ||
    docs?.tipoPagamentoSaldo ||
    docs?.formaPagamento ||
    docs?.driver_payment_method ||
    ''
  ).toString().trim();

  const pixKey = (
    shipment.pixKey ||
    docs?.pix_key ||
    docs?.chave_pix ||
    docs?.pixKey ||
    docs?.chavePix ||
    ''
  ).toString().trim();

  const bankDetails = (
    shipment.bankDetails ||
    docs?.bank_details ||
    docs?.dados_bancarios ||
    docs?.dadosBancarios ||
    docs?.bankDetails ||
    ''
  ).toString().trim();

  const upper = rawMethod.toUpperCase();
  let type: 'pix' | 'carta_frete' | 'deposito' | 'outro' = 'pix';
  let label = 'PIX - E-FRETE';

  if (upper.includes('LIVRE')) {
    type = 'outro';
    label = 'PAGAMENTO LIVRE';
  } else if (upper.includes('CARTA') || upper.includes('SMS')) {
    type = 'carta_frete';
    label = 'SMS CARTA FRETE';
  } else if (
    upper.includes('DEPOSITO') ||
    upper.includes('DEPÓSITO') ||
    upper.includes('CONTA') ||
    upper.includes('TRANSFERENCIA') ||
    upper.includes('TRANSFERÊNCIA')
  ) {
    type = 'deposito';
    label = 'DEPÓSITO EM CONTA';
  } else if (upper.includes('PIX')) {
    type = 'pix';
    label = upper.includes('E-FRETE') ? 'PIX - E-FRETE' : 'PIX';
  } else if (rawMethod) {
    label = rawMethod;
    type = 'outro';
  } else {
    type = 'pix';
    label = 'PIX - E-FRETE';
  }

  return {
    rawMethod,
    type,
    label,
    pixKey: pixKey || undefined,
    bankDetails: bankDetails || undefined,
  };
};

const LiveClock: React.FC = () => {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('pt-BR'));
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return <span>{time}</span>;
};

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
  realtimeStatus = 'connected',
  lastSyncTime,
  onRefreshData,
}) => {
  const { showToast } = useToast();

  // 15 Minutos exatos (15 * 60 = 900 segundos) para reciclagem de memória do Modo TV e revalidação de dados
  const REFRESH_INTERVAL_SECONDS = 15 * 60;
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [slaFilter, setSlaFilter] = useState<SlaUrgencyFilter>('all');
  const [selectedEmbarcadorId, setSelectedEmbarcadorId] = useState<string>('all');
  const [densityMode, setDensityMode] = useState<DensityMode>('expanded');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPlate, setCopiedPlate] = useState<string | null>(null);
  const [copiedCte, setCopiedCte] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState<string | null>(null);
  const [isTvMode, setIsTvMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // TV Mode Auto-Scroll System
  const columnScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [hoveredColumnId, setHoveredColumnId] = useState<string | null>(null);

  // Auto-recuperação do Modo TV após recarga programada de 15 minutos (para monitores dedicados 24/7)
  useEffect(() => {
    try {
      const isSavedTv = sessionStorage.getItem('transcunha_auto_tv_mode') === 'true';
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const hasTvParam = urlParams?.get('tv') === 'true' || urlParams?.get('tv') === '1';

      if (isSavedTv || hasTvParam) {
        setIsTvMode(true);
        setSearchTerm('');
        setSlaFilter('all');
        setSelectedEmbarcadorId('all');
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }
    } catch {}
  }, []);

  const toggleTvMode = useCallback(() => {
    setIsTvMode(prev => {
      const next = !prev;
      if (next) {
        try { sessionStorage.setItem('transcunha_auto_tv_mode', 'true'); } catch {}
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
        try { sessionStorage.removeItem('transcunha_auto_tv_mode'); } catch {}
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Temporizador de 15 Minutos (Modo TV / Hard Refresh de Segurança 24/7 & Fallback de Dados)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (isTvMode) {
            // Em monitor dedicado de TV: Hard Refresh para liberar 100% de memória heap, WebGL e conexões
            try { sessionStorage.setItem('transcunha_auto_tv_mode', 'true'); } catch {}
            console.log('[Modo TV] 🔄 Executando recarga de segurança periódica de 15 minutos...');
            window.location.reload();
            return REFRESH_INTERVAL_SECONDS;
          } else {
            // Em uso convencional: revalidação silenciosa profunda via estado do banco de dados
            console.log('[Dashboard] 🔄 Revalidação completa de 15 minutos em segundo plano...');
            if (onRefreshData) {
              onRefreshData(true).catch(() => {});
            }
            return REFRESH_INTERVAL_SECONDS;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTvMode, onRefreshData]);

  // Função manual de sincronização sob demanda
  const handleManualSync = useCallback(async () => {
    if (isManualRefreshing) return;
    setIsManualRefreshing(true);
    try {
      if (onRefreshData) {
        await onRefreshData(false);
      }
      setCountdown(REFRESH_INTERVAL_SECONDS);
      showToast('Dados sincronizados em tempo real!', 'success', 2000);
    } catch {
      showToast('Erro ao sincronizar dados.', 'error', 2000);
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 500);
    }
  }, [isManualRefreshing, onRefreshData, showToast]);

  const formatCountdown = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

  // Normalization helper for statuses
  const normalizeStatusStr = useCallback((st?: string) => {
    if (!st) return '';
    return st.toLowerCase().replace(/[^a-z0-9]/g, '');
  }, []);

  const isStatusMatching = useCallback((colStatuses: (ShipmentStatus | string)[], shipmentStatus: ShipmentStatus | string) => {
    if (!shipmentStatus) return false;
    if (colStatuses.includes(shipmentStatus as ShipmentStatus)) return true;
    const normShipment = normalizeStatusStr(shipmentStatus);
    return colStatuses.some(st => normalizeStatusStr(st) === normShipment);
  }, [normalizeStatusStr]);

  // Column threshold lookup map
  const columnThresholdMap = useMemo(() => {
    const map = new Map<string, { yellow: number; red: number }>();
    columns.forEach(col => {
      if (col.thresholds) {
        col.statuses.forEach(st => {
          map.set(st, col.thresholds!);
          map.set(normalizeStatusStr(st), col.thresholds!);
        });
      }
    });
    return map;
  }, [columns, normalizeStatusStr]);

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
    const thresholds = columnThresholdMap.get(shipment.status) || columnThresholdMap.get(normalizeStatusStr(shipment.status));

    let urgency: 'normal' | 'warning' | 'critical' = 'normal';
    if (thresholds) {
      if (elapsedMinutes >= thresholds.red) {
        urgency = 'critical';
      } else if (elapsedMinutes >= thresholds.yellow) {
        urgency = 'warning';
      }
    }

    return { elapsedMinutes, urgency, startTime, thresholds };
  }, [getShipmentStatusStartTime, columnThresholdMap, normalizeStatusStr]);

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
  const handleCopyText = useCallback((text: string, type: 'id' | 'plate' | 'cte' | 'pix' | 'bank', itemKey: string) => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(itemKey);
      setTimeout(() => setCopiedId(null), 2000);
      showToast(`ID #${text} copiado!`, 'info', 2000);
    } else if (type === 'plate') {
      setCopiedPlate(itemKey);
      setTimeout(() => setCopiedPlate(null), 2000);
      showToast(`Placa ${text} copiada!`, 'info', 2000);
    } else if (type === 'cte') {
      setCopiedCte(itemKey);
      setTimeout(() => setCopiedCte(null), 2000);
      showToast(`CT-e nº ${text} copiado!`, 'info', 2000);
    } else if (type === 'pix') {
      setCopiedPix(itemKey);
      setTimeout(() => setCopiedPix(null), 2000);
      showToast(`Chave PIX copiada: ${text}`, 'info', 2000);
    } else if (type === 'bank') {
      showToast(`Dados bancários copiados!`, 'info', 2000);
    }
  }, [showToast]);

  const handleOpenTmsOrder = useCallback((e: React.MouseEvent, shipment: Shipment) => {
    e.stopPropagation();
    const ocUrl = getShipmentTmsOrderUrl(shipment);
    if (ocUrl) {
      openDocumentInNewTab(ocUrl, `OC_TMS_${shipment.id}`);
    } else {
      showToast(`Nenhuma Ordem de Carregamento (OC TMS) anexada para o embarque #${shipment.id}`, 'info', 3000);
    }
  }, [showToast]);

  const handleOpenCte = useCallback((e: React.MouseEvent, shipment: Shipment) => {
    e.stopPropagation();
    const cteUrl = getShipmentCteFileUrl(shipment);
    const cteNumber = getShipmentCte(shipment);
    if (cteUrl) {
      openDocumentInNewTab(cteUrl, `CTE_${cteNumber !== '-' ? cteNumber : shipment.id}`);
    } else if (cteNumber && cteNumber !== '-') {
      showToast(`CT-e nº ${cteNumber} registrado, mas o arquivo PDF/XML não foi anexado`, 'info', 3000);
    } else {
      showToast(`Nenhum CT-e emitido ou anexado para o embarque #${shipment.id}`, 'info', 3000);
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
    const cteNum = getShipmentCte(shipment);
    const payment = resolveShipmentPaymentInfo(shipment);
    const paymentExtra = payment.type === 'pix' && payment.pixKey
      ? ` (Chave: ${payment.pixKey})`
      : payment.type === 'deposito' && payment.bankDetails
      ? ` (Dados: ${payment.bankDetails})`
      : '';

    const summary = [
      `🚛 *DETALHES DO EMBARQUE #${shipment.id}*`,
      `👤 *Motorista:* ${shipment.driverName} ${shipment.driverCpf ? `(CPF: ${shipment.driverCpf})` : ''}`,
      `🚚 *Cavalo:* ${shipment.horsePlate} ${shipment.trailer1Plate ? `| Carreta: ${shipment.trailer1Plate}` : ''}`,
      `📍 *Rota:* ${origin} ➔ ${destination}`,
      `🏢 *Cliente:* ${clientName}`,
      `📦 *Produto:* ${productName} (${shipment.shipmentTonnage.toLocaleString('pt-BR')} t)`,
      `📄 *CT-e:* ${cteNum !== '-' ? cteNum : 'Pendente de emissão'}`,
      `💳 *Pagamento Motorista:* ${payment.label}${paymentExtra}`,
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
        const cte = getShipmentCte(shipment);
        const cteMatch = cte && cte !== '-' && cte.toLowerCase().includes(search);
        const payment = resolveShipmentPaymentInfo(shipment);
        const paymentMatch = (
          payment.label + ' ' + 
          (payment.pixKey || '') + ' ' + 
          (payment.bankDetails || '')
        ).toLowerCase().includes(search);

        if (!idMatch && !driverNameMatch && !driverCpfMatch && !horsePlateMatch && !trailer1Match && !embarcadorMatch && !clientMatch && !productMatch && !originMatch && !destMatch && !cteMatch && !paymentMatch) {
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

  // Statuses configurados entre "Ag. Cadastro" e "Ag. Adiantamento"
  const ADVANCE_PREVISION_STATUSES = useMemo(() => [
    ShipmentStatus.PreCadastro,
    'Ag. Cadastro',
    'PreCadastro',
    ShipmentStatus.AguardandoSeguradora,
    'Ag. Seguradora',
    'Aguardando Seguradora',
    ShipmentStatus.AguardandoCarregamento,
    'Ag. Carregamento',
    'Aguardando Carregamento',
    ShipmentStatus.AguardandoNota,
    'Ag. Nota',
    'Aguardando Nota',
    ShipmentStatus.AguardandoFiscal,
    'Ag. Fiscal',
    'Aguardando Fiscal',
    ShipmentStatus.AguardandoAdiantamento,
    'Ag. Adiantamento',
    'Aguardando Adiantamento',
    'Aguardando Pagamento de Adiantamento',
  ], []);

  // Cálculo da Previsão Total de Adiantamentos a Fazer (Etapas: Ag. Cadastro até Ag. Adiantamento)
  const advancePrevisionStats = useMemo(() => {
    const isFinancialBoard = (title || '').toLowerCase().includes('financeir') || columns.some(c => c.id.includes('adiantamento') || c.id.includes('saldo'));

    let totalValue = 0;
    let count = 0;
    const statusBreakdown: Record<string, { count: number; total: number }> = {
      'Ag. Cadastro': { count: 0, total: 0 },
      'Ag. Seguradora': { count: 0, total: 0 },
      'Ag. Carregamento': { count: 0, total: 0 },
      'Ag. Nota': { count: 0, total: 0 },
      'Ag. Fiscal': { count: 0, total: 0 },
      'Ag. Adiantamento': { count: 0, total: 0 },
    };

    const normalizeKey = (st: string) => {
      const s = (st || '').toLowerCase();
      if (s.includes('cadastro')) return 'Ag. Cadastro';
      if (s.includes('seguradora')) return 'Ag. Seguradora';
      if (s.includes('carregamento')) return 'Ag. Carregamento';
      if (s.includes('nota')) return 'Ag. Nota';
      if (s.includes('fiscal')) return 'Ag. Fiscal';
      if (s.includes('adiantamento')) return 'Ag. Adiantamento';
      return null;
    };

    // Considera os embarques da tela respeitando os filtros ativos se houver busca ou solicitante selecionado
    const pool = (searchTerm || selectedEmbarcadorId !== 'all' || slaFilter !== 'all')
      ? filteredShipments
      : shipments;

    pool.forEach(s => {
      if (s.status === ShipmentStatus.Cancelado || (s.status as string) === 'Cancelado' || s.status === ShipmentStatus.Finalizado) return;

      const isMatch = ADVANCE_PREVISION_STATUSES.some(st => 
        st === s.status || normalizeStatusStr(st) === normalizeStatusStr(s.status)
      );

      if (isMatch) {
        const cargo = cargoMap.get(s.cargoId);
        let advVal = 0;

        if (s.advanceValue !== undefined && !isNaN(Number(s.advanceValue)) && Number(s.advanceValue) > 0) {
          advVal = Number(s.advanceValue);
        } else {
          const rate = s.driverFreightRateSnapshot || cargo?.driverFreightValuePerTon || 0;
          const tonnage = s.shipmentTonnage || cargo?.totalVolume || 0;
          const totalFreight = s.driverFreightValue || (rate * tonnage);
          const toll = s.tollValue || 0;
          const advPct = (s.advancePercentage !== undefined && !isNaN(Number(s.advancePercentage)))
            ? Number(s.advancePercentage)
            : 70;

          if (advPct > 0) {
            const baseFreight = Math.max(0, totalFreight - toll);
            advVal = Number((baseFreight * (advPct / 100)).toFixed(2));
          }
        }

        totalValue += advVal;
        count++;

        const key = normalizeKey(s.status);
        if (key && statusBreakdown[key]) {
          statusBreakdown[key].count++;
          statusBreakdown[key].total += advVal;
        }
      }
    });

    return {
      isFinancialBoard,
      totalValue,
      count,
      statusBreakdown,
      formattedTotal: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    };
  }, [title, columns, shipments, filteredShipments, searchTerm, selectedEmbarcadorId, slaFilter, cargoMap, ADVANCE_PREVISION_STATUSES, normalizeStatusStr]);

  // Statuses configurados entre "Ag. Descarga" e "Ag. Saldo"
  const BALANCE_PREVISION_STATUSES = useMemo(() => [
    ShipmentStatus.AguardandoDescarga,
    'Ag. Descarga',
    'Aguardando Descarga',
    'Em Trânsito',
    'Em Transito',
    ShipmentStatus.ValidacaoTicket,
    'Valid. de Ticket',
    'Validação de Ticket',
    'Validacao de Ticket',
    ShipmentStatus.AguardandoPagamentoSaldo,
    'Ag. Saldo',
    'Aguardando Saldo',
    'Aguardando Pagamento de Saldo',
  ], []);

  // Cálculo da Previsão Total de Saldos a Pagar (Etapas: Ag. Descarga até Ag. Saldo)
  const balancePrevisionStats = useMemo(() => {
    const isFinancialBoard = (title || '').toLowerCase().includes('financeir') || columns.some(c => c.id.includes('adiantamento') || c.id.includes('saldo'));

    let totalValue = 0;
    let count = 0;
    const statusBreakdown: Record<string, { count: number; total: number }> = {
      'Ag. Descarga': { count: 0, total: 0 },
      'Valid. de Ticket': { count: 0, total: 0 },
      'Ag. Saldo': { count: 0, total: 0 },
    };

    const normalizeKey = (st: string) => {
      const s = (st || '').toLowerCase();
      if (s.includes('descarga') || s.includes('trânsito') || s.includes('transito')) return 'Ag. Descarga';
      if (s.includes('ticket') || s.includes('valida')) return 'Valid. de Ticket';
      if (s.includes('saldo')) return 'Ag. Saldo';
      return null;
    };

    const pool = (searchTerm || selectedEmbarcadorId !== 'all' || slaFilter !== 'all')
      ? filteredShipments
      : shipments;

    pool.forEach(s => {
      if (s.status === ShipmentStatus.Cancelado || (s.status as string) === 'Cancelado' || s.status === ShipmentStatus.Finalizado) return;

      const isMatch = BALANCE_PREVISION_STATUSES.some(st => 
        st === s.status || normalizeStatusStr(st) === normalizeStatusStr(s.status)
      );

      if (isMatch) {
        const cargo = cargoMap.get(s.cargoId);
        let balVal = 0;

        if (s.netBalanceValue !== undefined && !isNaN(Number(s.netBalanceValue)) && Number(s.netBalanceValue) > 0) {
          balVal = Number(s.netBalanceValue);
        } else if (s.balanceToReceiveValue !== undefined && !isNaN(Number(s.balanceToReceiveValue)) && Number(s.balanceToReceiveValue) > 0) {
          balVal = Number(s.balanceToReceiveValue);
        } else {
          const rate = s.driverFreightRateSnapshot || cargo?.driverFreightValuePerTon || 0;
          const tonnage = s.unloadedTonnage || s.shipmentTonnage || cargo?.totalVolume || 0;
          const totalFreight = s.driverFreightValue || (rate * tonnage);
          const toll = s.tollValue || 0;
          const advPct = (s.advancePercentage !== undefined && !isNaN(Number(s.advancePercentage)))
            ? Number(s.advancePercentage)
            : 70;

          if (advPct < 100) {
            const baseFreight = Math.max(0, totalFreight - toll);
            balVal = Number((baseFreight * ((100 - advPct) / 100)).toFixed(2));
          }
        }

        totalValue += balVal;
        count++;

        const key = normalizeKey(s.status);
        if (key && statusBreakdown[key]) {
          statusBreakdown[key].count++;
          statusBreakdown[key].total += balVal;
        }
      }
    });

    return {
      isFinancialBoard,
      totalValue,
      count,
      statusBreakdown,
      formattedTotal: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    };
  }, [title, columns, shipments, filteredShipments, searchTerm, selectedEmbarcadorId, slaFilter, cargoMap, BALANCE_PREVISION_STATUSES, normalizeStatusStr]);

  // Group and sort Shipments by Column (Standardized: most delayed on top)
  const shipmentsByColumn = useMemo(() => {
    const grouped: Record<string, Shipment[]> = {};
    columns.forEach(col => {
      grouped[col.id] = [];
    });

    filteredShipments.forEach(shipment => {
      for (const col of columns) {
        if (isStatusMatching(col.statuses, shipment.status)) {
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
    if (status === ShipmentStatus.ValidacaoTicket) return 'Validar Ticket / Peso';
    if (status === ShipmentStatus.AguardandoPagamentoSaldo) return 'Anexar Saldo';
    if (status === ShipmentStatus.AguardandoCarregamento) return 'Anexar Ticket / Rota';
    return `Anexar ${raw}`;
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* Aviso suave de reciclagem de segurança no Modo TV (últimos 12s dos 15 minutos) */}
      {isTvMode && countdown <= 12 && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-600 to-purple-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-md flex items-center justify-between gap-2 animate-pulse border border-amber-400/40">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Recarga de segurança do Modo TV em {countdown}s (limpeza periódica de memória para estabilidade 24/7)...</span>
          </div>
          <span className="text-[10px] opacity-80 uppercase tracking-widest font-mono">Monitor TV Ativo</span>
        </div>
      )}

      {/* Top Header & Metrics Bar */}
      <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm p-4 sm:p-5 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary dark:bg-primary/20 dark:text-amber-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {title || 'Painel de Gestão dos Embarques'}
                  </h2>
                  
                  {/* Status de Conexão Realtime & Tempo Real */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold shadow-xs transition-all ${
                      realtimeStatus === 'connected'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : realtimeStatus === 'connecting'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                        : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    }`}
                    title={`Supabase Realtime: ${
                      realtimeStatus === 'connected'
                        ? 'Conexão via WebSockets ativa e saudável'
                        : realtimeStatus === 'connecting'
                        ? 'Reconectando canal em tempo real...'
                        : 'Desconectado / Sem rede'
                    }\nÚltima sincronização: ${lastSyncTime ? lastSyncTime.toLocaleTimeString('pt-BR') : 'Agora'}\nPróxima recarga de segurança: ${formatCountdown(countdown)}`}
                  >
                    {realtimeStatus === 'connected' ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>TEMPO REAL • <LiveClock /></span>
                      </>
                    ) : realtimeStatus === 'connecting' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                        <span>RECONECTANDO... • <LiveClock /></span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-rose-500" />
                        <span className="cursor-pointer" onClick={handleManualSync}>OFFLINE • RECONECTAR</span>
                      </>
                    )}

                    {onRefreshData && (
                      <button
                        onClick={handleManualSync}
                        disabled={isManualRefreshing}
                        className="ml-1 p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-75 hover:opacity-100 disabled:opacity-40"
                        title="Sincronizar e revalidar agora"
                      >
                        <RefreshCw className={`w-3 h-3 ${isManualRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {description || 'Monitoramento contínuo em tempo real com visão total dos embarques'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick SLA KPI Pills, Advance Prevision KPI & TV Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Previsão Total de Adiantamentos a Fazer (Etapas: Ag. Cadastro até Ag. Adiantamento) */}
            {advancePrevisionStats.isFinancialBoard && (
              <div 
                className="relative group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 hover:from-emerald-100 hover:to-teal-100 dark:from-emerald-950/70 dark:via-teal-950/60 dark:to-emerald-900/60 dark:hover:from-emerald-900/80 dark:hover:to-teal-900/80 border border-emerald-300/80 dark:border-emerald-700/80 shadow-xs cursor-pointer transition-all hover:scale-[1.02]"
                title="Passe o mouse para ver o detalhamento por etapa"
              >
                <div className="p-1 rounded-lg bg-emerald-600 text-white shadow-xs">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                      Prev. Adiantamentos a Fazer
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-200/80 dark:bg-emerald-800 text-emerald-950 dark:text-emerald-100 text-[10px] font-extrabold font-mono">
                      {advancePrevisionStats.count} emb.
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-300 font-mono leading-tight">
                    {advancePrevisionStats.formattedTotal}
                  </div>
                </div>

                {/* Popover / Tooltip com Detalhamento por Etapa (Ag. Cadastro -> Ag. Adiantamento) */}
                <div className="hidden group-hover:block absolute top-full right-0 sm:left-0 sm:right-auto mt-2 z-50 w-72 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <div className="font-bold text-gray-900 dark:text-white pb-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Detalhamento por Etapa
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {advancePrevisionStats.formattedTotal}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {Object.entries(advancePrevisionStats.statusBreakdown).map(([stName, data]) => (
                      <div key={stName} className="flex justify-between items-center text-[11px] py-0.5 border-b border-gray-50 dark:border-gray-700/40 last:border-0">
                        <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-medium">{stName}:</span>
                        </span>
                        <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                          {data.count} <span className="text-[10px] font-normal text-gray-500">({data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 text-center font-medium">
                    Contabiliza embarques entre <strong className="text-gray-600 dark:text-gray-300">Ag. Cadastro</strong> e <strong className="text-gray-600 dark:text-gray-300">Ag. Adiantamento</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Previsão Total de Saldos a Pagar (Etapas: Ag. Descarga até Ag. Saldo) */}
            {balancePrevisionStats.isFinancialBoard && (
              <div 
                className="relative group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 hover:from-amber-100 hover:to-orange-100 dark:from-amber-950/70 dark:via-orange-950/60 dark:to-amber-900/60 dark:hover:from-amber-900/80 dark:hover:to-orange-900/80 border border-amber-300/80 dark:border-amber-700/80 shadow-xs cursor-pointer transition-all hover:scale-[1.02]"
                title="Passe o mouse para ver o detalhamento por etapa"
              >
                <div className="p-1 rounded-lg bg-amber-600 text-white shadow-xs">
                  <Banknote className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                      Prev. Saldos a Pagar
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-200/80 dark:bg-amber-800 text-amber-950 dark:text-amber-100 text-[10px] font-extrabold font-mono">
                      {balancePrevisionStats.count} emb.
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-amber-700 dark:text-amber-300 font-mono leading-tight">
                    {balancePrevisionStats.formattedTotal}
                  </div>
                </div>

                {/* Popover / Tooltip com Detalhamento por Etapa (Ag. Descarga -> Ag. Saldo) */}
                <div className="hidden group-hover:block absolute top-full right-0 sm:left-0 sm:right-auto mt-2 z-50 w-72 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <div className="font-bold text-gray-900 dark:text-white pb-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Detalhamento por Etapa
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">
                      {balancePrevisionStats.formattedTotal}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {Object.entries(balancePrevisionStats.statusBreakdown).map(([stName, data]) => (
                      <div key={stName} className="flex justify-between items-center text-[11px] py-0.5 border-b border-gray-50 dark:border-gray-700/40 last:border-0">
                        <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="font-medium">{stName}:</span>
                        </span>
                        <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                          {data.count} <span className="text-[10px] font-normal text-gray-500">({data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 text-center font-medium">
                    Contabiliza embarques entre <strong className="text-gray-600 dark:text-gray-300">Ag. Descarga</strong> e <strong className="text-gray-600 dark:text-gray-300">Ag. Saldo</strong>
                  </div>
                </div>
              </div>
            )}

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
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                  <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span>Rolagem Automática</span>
                  <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-md ml-1" title="Contagem regressiva para a recarga de segurança periódica de 15 minutos">
                    Refresh {formatCountdown(countdown)}
                  </span>
                </div>
              </div>
            )}

            {/* TV / Fullscreen Mode Toggle */}
            <button
              onClick={toggleTvMode}
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs flex-shrink-0 ${
                isTvMode
                  ? 'bg-amber-600 text-white hover:bg-amber-700 ring-2 ring-amber-500/40'
                  : 'bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
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
                  className="px-2.5 py-1.5 text-xs text-primary dark:text-amber-400 hover:underline font-medium"
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
                  <span className="px-2 py-0.2 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-amber-400 text-xs font-bold font-mono">
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

                    // Informações Fiscais (CT-e) & Forma de Pagamento do Motorista
                    const cteNumber = getShipmentCte(shipment);
                    const hasCte = cteNumber !== '-';
                    const cteFileUrl = getShipmentCteFileUrl(shipment);
                    const paymentInfo = resolveShipmentPaymentInfo(shipment);

                    let paymentBadgeClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60';
                    let paymentIcon = <Banknote className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />;

                    if (paymentInfo.type === 'carta_frete') {
                      paymentBadgeClass = 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60';
                      paymentIcon = <CreditCard className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />;
                    } else if (paymentInfo.type === 'deposito') {
                      paymentBadgeClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60';
                      paymentIcon = <Building2 className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />;
                    } else if (paymentInfo.type === 'outro') {
                      paymentBadgeClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60';
                      paymentIcon = <Wallet className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />;
                    }

                    const paymentTooltip = 
                      paymentInfo.type === 'pix' && paymentInfo.pixKey
                        ? `Forma: ${paymentInfo.label} • Chave Pix: ${paymentInfo.pixKey} (clique para copiar)`
                        : paymentInfo.type === 'deposito' && paymentInfo.bankDetails
                        ? `Forma: ${paymentInfo.label} • Dados Bancários: ${paymentInfo.bankDetails}`
                        : `Forma de pagamento informada para o motorista: ${paymentInfo.label}`;

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
                          {/* Compact Row 1: ID, CT-e, Time, SLA */}
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => handleOpenTmsOrder(e, shipment)}
                                className="group/oc inline-flex items-center gap-1 font-mono text-xs font-bold text-primary dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:underline truncate cursor-pointer"
                                title={getShipmentTmsOrderUrl(shipment) ? "Clique para abrir a Ordem de Carregamento (OC TMS)" : "Ordem de Carregamento (OC TMS) não anexada"}
                              >
                                <span>#{shipment.id}</span>
                                <FileText className="w-2.5 h-2.5 opacity-60 group-hover/oc:opacity-100 group-hover/oc:text-amber-500" />
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
                              {hasCte && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenCte(e, shipment)}
                                  className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-mono text-[9px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                                  title={cteFileUrl ? "Clique para abrir o CT-e" : `CT-e nº ${cteNumber}`}
                                >
                                  <span>CT-e {cteNumber}</span>
                                </button>
                              )}
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

                          {/* Compact Row 3.5: CT-e & Forma de Pagamento */}
                          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 gap-1 mb-1.5 pt-1 border-t border-dashed border-gray-100 dark:border-gray-700/60">
                            <div className="flex items-center gap-1 font-mono">
                              <span className="text-[9px] text-gray-400 dark:text-gray-500">CT-e:</span>
                              {hasCte ? (
                                <span className="font-bold text-gray-800 dark:text-gray-200 text-[10px]" title="Número do CT-e">
                                  {cteNumber}
                                </span>
                              ) : (
                                <span className="italic text-gray-400 dark:text-gray-500 text-[9px]">Pendente</span>
                              )}
                            </div>
                            <div
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border ${paymentBadgeClass}`}
                              title={paymentTooltip}
                            >
                              {paymentIcon}
                              <span>{paymentInfo.label}</span>
                            </div>
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
                                className="py-1 px-1.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-[11px] font-medium flex items-center gap-0.5 border border-amber-200 dark:border-amber-800"
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

                    // EXPANDED CARD (RICO OTIMIZADO COMPACTO)
                    return (
                      <div
                        key={shipment.id}
                        className={`bg-white dark:bg-gray-800 rounded-xl p-2.5 border border-gray-200/90 dark:border-gray-700/90 shadow-xs hover:shadow-md transition-all duration-150 ${cardBorderHighlight} space-y-1.5`}
                      >
                        {/* Linha 1: ID, OC TMS, Data, Ações Rápidas (Eye, WhatsApp) & SLA */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => handleOpenTmsOrder(e, shipment)}
                              className="group/oc inline-flex items-center gap-1 font-mono text-xs font-bold text-primary dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:underline cursor-pointer"
                              title={getShipmentTmsOrderUrl(shipment) ? "Clique para abrir a Ordem de Carregamento (OC TMS)" : "Ordem de Carregamento (OC TMS) não anexada"}
                            >
                              <span>#{shipment.id}</span>
                              <FileText className="w-2.5 h-2.5 opacity-60 group-hover/oc:opacity-100 group-hover/oc:text-amber-500" />
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

                            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5 ml-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {formatDate(startTime)}
                            </span>
                          </div>

                          {/* Ações Rápidas de Topo (Ver Detalhes, Copiar Ficha) & SLA Pill */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowDetails(shipment);
                              }}
                              className="p-1 rounded-md bg-gray-100 dark:bg-gray-700/70 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                              title="Ver detalhes completos do embarque"
                            >
                              <Eye className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySummary(shipment);
                              }}
                              className="p-1 rounded-md bg-gray-100 dark:bg-gray-700/70 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                              title="Copiar ficha resumida para WhatsApp"
                            >
                              <FileText className="w-3 h-3" />
                            </button>

                            <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs ${slaBadgeClass}`}>
                              {urgency === 'critical' && <Flame className="w-2.5 h-2.5 text-rose-500 animate-bounce" />}
                              {urgency === 'warning' && <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />}
                              {urgency === 'normal' && <Clock className="w-2.5 h-2.5 text-emerald-500" />}
                              <span className="font-semibold">{formattedElapsed}</span>
                            </span>
                          </div>
                        </div>

                        {/* Linha 2: Motorista, WhatsApp & Veículo */}
                        <div className="flex items-center justify-between gap-1.5 text-xs">
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
                                title="Conversar com o motorista no WhatsApp"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
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

                        {/* Linha 3: Rota, Cliente & Produto */}
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
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 text-[10px] font-medium truncate max-w-[140px]" title={clientDisplayName}>
                              <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{clientDisplayName}</span>
                            </span>

                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 text-[10px] font-medium truncate max-w-[120px]" title={productName}>
                              <Package className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{productName}</span>
                            </span>
                          </div>
                        </div>

                        {/* Linha 4: Fiscal (CT-e), Solicitante, Pagamento & Ação de Anexar */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] pt-1.5 border-t border-dashed border-gray-100 dark:border-gray-700/60">
                          {/* Lado Esquerdo: CT-e & Solicitante Compacto */}
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {/* CT-e */}
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                                <FileText className="w-2.5 h-2.5 text-amber-500" />
                                CT-e:
                              </span>
                              {hasCte ? (
                                <div className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                                  {cteFileUrl ? (
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenCte(e, shipment)}
                                      className="hover:underline flex items-center gap-0.5 cursor-pointer text-amber-700 dark:text-amber-300"
                                      title="Clique para visualizar o CT-e em tela cheia"
                                    >
                                      <span>{cteNumber}</span>
                                      <ExternalLink className="w-2 h-2 opacity-60 ml-0.5" />
                                    </button>
                                  ) : (
                                    <span title="Número do CT-e registrado no embarque">{cteNumber}</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyText(cteNumber, 'cte', shipment.id);
                                    }}
                                    className="text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 cursor-pointer p-0.5 transition-colors"
                                    title="Copiar número do CT-e"
                                  >
                                    {copiedCte === shipment.id ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5 opacity-70" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500 italic bg-gray-50 dark:bg-gray-800/80 px-1 py-0.2 rounded border border-dashed border-gray-200 dark:border-gray-700">
                                  Pendente
                                </span>
                              )}
                            </div>

                            {/* Solicitante compacto ao lado do CT-e e antes da forma de pagamento */}
                            {embarcador && (
                              <div className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 min-w-0" title={`Solicitante: ${embarcadorName}`}>
                                <span className="text-gray-400 dark:text-gray-500">Sol:</span>
                                <strong className="text-gray-700 dark:text-gray-300 font-semibold truncate max-w-[120px] sm:max-w-[150px]">{embarcadorName}</strong>
                                {embarcadorWhatsAppUrl && (
                                  <a
                                    href={embarcadorWhatsAppUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-500 hover:text-green-600 dark:text-green-400 transition-colors p-0.5 flex-shrink-0"
                                    title="WhatsApp do solicitante"
                                  >
                                    <WhatsAppIcon className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Lado Direito: Forma de Pagamento & Botões de Ação */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Forma de Pagamento do Motorista */}
                            <div
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shadow-2xs ${paymentBadgeClass}`}
                              title={paymentTooltip}
                            >
                              {paymentIcon}
                              <span className="tracking-tight">{paymentInfo.label}</span>
                              {paymentInfo.type === 'pix' && paymentInfo.pixKey && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyText(paymentInfo.pixKey!, 'pix', shipment.id);
                                  }}
                                  className="opacity-70 hover:opacity-100 cursor-pointer ml-0.5 p-0.5 transition-opacity"
                                  title={`Copiar Chave Pix: ${paymentInfo.pixKey}`}
                                >
                                  {copiedPix === shipment.id ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* ANTT Action if PreCadastro */}
                            {shipment.status === ShipmentStatus.PreCadastro && onOpenCadastroAntt && (
                              <button
                                onClick={() => onOpenCadastroAntt(shipment)}
                                className="py-1 px-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
                                title="Fazer Cadastro de Titular ANTT"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                <span>ANTT</span>
                              </button>
                            )}

                            {/* Primary Action Button: Anexar e Avançar */}
                            {onAttach && (
                              <button
                                onClick={() => onAttach(shipment)}
                                className="py-1 px-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-all shadow-xs active:scale-98 cursor-pointer"
                                title={`Avançar status: ${docActionName}`}
                              >
                                <Paperclip className="w-3 h-3" />
                                <span className="truncate">{docActionName}</span>
                              </button>
                            )}
                          </div>
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
