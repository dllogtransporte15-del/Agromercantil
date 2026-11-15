import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { FreightOffer, Client, Product, Cargo, User } from '../types';
import { FreightOfferStatus, CargoStatus, UserProfile } from '../types';
import { PackageIcon, CheckIcon, XIcon, MessageCircleIcon, HistoryIcon, TrashIcon, MapPinIcon, EyeIcon, PaperclipIcon, DownloadIcon, UserIcon, Clock, Edit, Route as RouteIcon, Loader2, AlertCircle, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { WhatsAppIcon } from './icons';
import VolumeBar from './VolumeBar';
import { supabase } from '../supabase';
import { getMatchedCargo } from '../utils';
import FreightOfferModal from './FreightOfferModal';
import DocumentPreviewModal from './DocumentPreviewModal';
import { openDocumentInNewTab } from '../utils/documentViewer';
import { isDemoUser, isDeveloperUser } from '../auth';
import { calculateOfferRoute, type ResolvedWaypoint } from '../services/routeDistanceService';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type Waypoint = ResolvedWaypoint;

interface RouteData {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][];
  bounds: L.LatLngBounds | null;
  waypoints: Waypoint[];
  isExact?: boolean;
}

class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.error('Leaflet Map Error caught by boundary:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center h-full bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500">
          <Navigation className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-xs font-semibold">Visualização do mapa indisponível</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapUpdater({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
    return () => clearTimeout(timer);
  }, [map, bounds]);
  return null;
}

const DEFAULT_CENTER: [number, number] = [-15.7801, -47.9292];

const OfferRoutePreview: React.FC<{ offer: FreightOffer }> = ({ offer }) => {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const originCity = offer.origin?.trim();
    const destCity = offer.destination?.trim();

    if (!originCity || !destCity) {
      setError('Origem ou destino não informados.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await calculateOfferRoute({
        origin: offer.origin,
        originLocation: offer.originLocation,
        destination: offer.destination,
        destinationLocation: offer.destinationLocation,
        additionalDestinations: offer.additionalDestinations
      });

      if (!result) {
        throw new Error('Não foi possível calcular a rota para as localizações.');
      }

      const coordinates: [number, number][] = result.coordinates && result.coordinates.length > 0
        ? result.coordinates
        : [
            [result.originCoords.lat, result.originCoords.lng],
            [result.destinationCoords.lat, result.destinationCoords.lng]
          ];
      const bounds = L.latLngBounds(coordinates);

      setRouteData({
        distanceKm: result.distanceKm,
        durationMin: result.durationMin,
        coordinates,
        bounds,
        waypoints: [result.originWaypoint, result.destinationWaypoint],
        isExact: result.isExact
      });
    } catch (err: any) {
      console.error('Error fetching route in OfferRoutePreview:', err);
      setError(err?.message || 'Erro ao carregar o roteiro da oferta.');
    } finally {
      setIsLoading(false);
    }
  }, [offer]);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  const formatDurationText = (mins: number) => {
    const hrs = (mins / 60).toFixed(1);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hrs}h (${h > 0 ? `${h}h ` : ''}${m}min)`;
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-200/80 dark:border-gray-600 flex flex-col space-y-3 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2">
          <RouteIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h4 className="text-sm font-bold text-gray-800 dark:text-white">Roteiro da Oferta</h4>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRoute}
            disabled={isLoading}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
            title="Recalcular rota com base nas localizações"
          >
            <Navigation className="w-3 h-3 text-white" />
            Recalcular
          </button>

          {isLoading && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded-full text-xs font-semibold animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
              Carregando...
            </div>
          )}

          {routeData && !isLoading && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-full text-xs font-bold">
                <RouteIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                {routeData.distanceKm.toFixed(0)} km
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-full text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                {formatDurationText(routeData.durationMin)}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative h-[320px] w-full rounded-xl overflow-hidden shadow-inner border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
        <MapErrorBoundary>
          <MapContainer
            center={routeData?.coordinates[0] || DEFAULT_CENTER}
            zoom={6}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {routeData?.bounds && <MapUpdater bounds={routeData.bounds} />}

            {routeData?.coordinates && routeData.coordinates.length > 0 && (
              <Polyline
                positions={routeData.coordinates}
                color="#A67142"
                weight={5}
                opacity={0.85}
              />
            )}

            {routeData?.waypoints.map((wp, idx) => (
              <Marker key={idx} position={[wp.lat, wp.lng]}>
                <Popup>
                  <div className="text-xs">
                    <strong className="block text-amber-700 font-bold mb-1">
                      {wp.type === 'origin' ? '📍 Origem' : wp.type === 'destination' ? '🏁 Destino' : `Via ${idx}`}
                    </strong>
                    <div className="font-semibold text-gray-800">{wp.label}</div>
                    {wp.subLabel && <div className="text-gray-500 text-[11px] mt-0.5">{wp.subLabel}</div>}
                    <div className="mt-1 text-[10px] text-gray-400 font-mono">
                      {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                      {wp.isExact ? ' (Local Exato)' : ' (Cidade)'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </MapErrorBoundary>
      </div>

      {routeData && (
        <div className="space-y-1.5 pt-1">
          <h5 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pontos Mapeados:</h5>
          <div className="space-y-1 max-h-28 overflow-y-auto text-xs">
            {routeData.waypoints.map((wp, i) => (
              <div key={i} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200/80 dark:border-gray-700">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0 ${wp.type === 'origin' ? 'bg-emerald-600' : wp.type === 'destination' ? 'bg-red-600' : 'bg-amber-600'}`}>
                    {wp.type === 'origin' ? 'Origem' : wp.type === 'destination' ? 'Destino' : `Via ${i}`}
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{wp.label}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${wp.isExact ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {wp.isExact ? 'Local Exato' : 'Cidade'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const OfferPercursoCell: React.FC<{
  offer: FreightOffer;
  onUpdateOffer?: (updated: FreightOffer) => void;
}> = ({ offer, onUpdateOffer }) => {
  const [distanceKm, setDistanceKm] = useState<number | null>(offer.distanceKm ?? null);
  const [isExact, setIsExact] = useState<boolean>(offer.isExactDistance ?? Boolean(offer.originCoords && offer.destinationCoords));
  const [loading, setLoading] = useState<boolean>(!offer.distanceKm && Boolean(offer.origin && offer.destination));

  useEffect(() => {
    if (offer.distanceKm) {
      setDistanceKm(offer.distanceKm);
      setIsExact(offer.isExactDistance ?? Boolean(offer.originCoords && offer.destinationCoords));
      setLoading(false);
      return;
    }

    if (!offer.origin || !offer.destination) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    calculateOfferRoute({
      origin: offer.origin,
      originLocation: offer.originLocation,
      destination: offer.destination,
      destinationLocation: offer.destinationLocation,
      additionalDestinations: offer.additionalDestinations
    }).then(res => {
      if (!isMounted) return;
      if (res) {
        setDistanceKm(res.distanceKm);
        setIsExact(res.isExact);
        if (!offer.distanceKm && onUpdateOffer) {
          onUpdateOffer({
            ...offer,
            distanceKm: res.distanceKm,
            isExactDistance: res.isExact,
            originCoords: res.originCoords,
            destinationCoords: res.destinationCoords
          });
        }
      }
      setLoading(false);
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [offer.id, offer.distanceKm, offer.origin, offer.originLocation, offer.destination, offer.destinationLocation]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 animate-pulse">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
        <span>Calculando...</span>
      </div>
    );
  }

  if (distanceKm === null || distanceKm === 0) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
          isExact
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 shadow-xs'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
        }`}
        title={isExact ? 'Distância rodoviária calculada via link exato de localização' : 'Distância estimada entre cidades'}
      >
        <RouteIcon className={`w-3.5 h-3.5 ${isExact ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`} />
        {isExact ? `${distanceKm} km` : `~${distanceKm} km`}
      </span>
      <span className="text-[10px] font-medium flex items-center gap-1">
        {isExact ? (
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            Pontos exatos
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">Entre cidades</span>
        )}
      </span>
    </div>
  );
};

interface FreightOffersListProps {
  offers: FreightOffer[];
  clients: Client[];
  products: Product[];
  cargos?: Cargo[];
  isClientProfile: boolean;
  currentUser?: User;
  users?: User[];
  onAccept: (offer: FreightOffer) => void;
  onRefuse: (offer: FreightOffer) => void;
  onCounterOffer: (offer: FreightOffer, newValue: number) => void;
  onDelete?: (offer: FreightOffer) => void;
  onConvertToCargo?: (offer: FreightOffer) => void;
  onShowDriverHistory?: (driverId: string) => void;
  title?: string;
  onUpdateStatus?: (offer: FreightOffer, status: FreightOfferStatus) => void;
  onSaveFreightOffer?: (offer: FreightOffer | Omit<FreightOffer, 'id' | 'createdAt'>) => Promise<void>;
}

const FreightOffersList: React.FC<FreightOffersListProps> = ({
  offers, clients, products, cargos, isClientProfile, currentUser, users, onAccept, onRefuse, onCounterOffer, onDelete, onConvertToCargo, onShowDriverHistory, title, onUpdateStatus, onSaveFreightOffer
}) => {
  const isDemo = isDemoUser(currentUser);
  const [counterOfferModal, setCounterOfferModal] = useState<FreightOffer | null>(null);
  const [counterValue, setCounterValue] = useState<string>('');
  const [historyModal, setHistoryModal] = useState<FreightOffer | null>(null);
  const [detailsModal, setDetailsModal] = useState<FreightOffer | null>(null);
  const [editingOfferModal, setEditingOfferModal] = useState<FreightOffer | null>(null);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; name?: string; category?: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [confirmAcceptModal, setConfirmAcceptModal] = useState<FreightOffer | null>(null);
  const [acceptAttachments, setAcceptAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const acceptFileInputRef = useRef<HTMLInputElement>(null);

  const getOfferClientPhone = (offer: FreightOffer): string | null => {
    if (users && users.length > 0) {
      const clientUser = users.find(u => u.profile === UserProfile.Cliente && u.clientId === offer.clientId && u.phone);
      if (clientUser && clientUser.phone) {
        return clientUser.phone;
      }
      if (offer.history && offer.history.length > 0) {
        const firstLog = offer.history[0];
        const creator = users.find(u => u.id === firstLog.userId);
        if (creator && creator.phone) {
          return creator.phone;
        }
      }
    }
    const client = clients.find(c => c.id === offer.clientId);
    if (client && client.phone) {
      return client.phone;
    }
    return null;
  };

  const getWhatsAppUrl = (phone: string, offer?: FreightOffer) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '#';
    const finalDigits = (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
    
    let textParam = '';
    if (offer) {
      const productName = getProductName(offer.productId);
      const offerCode = offer.displayId || offer.id;
      const msg = `Olá! Gostaria de falar sobre a Oferta de Frete ${offerCode} (${productName} - ${offer.origin} para ${offer.destination}).`;
      textParam = `?text=${encodeURIComponent(msg)}`;
    }
    
    return `https://wa.me/${finalDigits}${textParam}`;
  };

  if (offers.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">Nenhuma oferta de frete no momento.</p>
      </div>
    );
  }

  const displayedOffers = isExpanded ? offers : offers.slice(0, 2);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.nomeFantasia || 'Cliente Desconhecido';
  
  const getOfferClientDisplayName = (offer: FreightOffer) => {
    const client = clients.find(c => c.id === offer.clientId);
    if (!client) return 'Cliente Desconhecido';

    if (offer.clientCnpj) {
      const cleanOfferCnpj = offer.clientCnpj.replace(/\D/g, '');
      const cleanMainCnpj = client.cnpj.replace(/\D/g, '');
      if (cleanOfferCnpj !== cleanMainCnpj && client.secondaryCnpjs) {
        const branch = client.secondaryCnpjs.find(b => b.cnpj.replace(/\D/g, '') === cleanOfferCnpj || b.id === offer.clientBranchId);
        if (branch) {
          return `${client.nomeFantasia || client.razaoSocial} (${branch.nomeFantasia || branch.city || branch.cnpj})`;
        }
      }
    }
    return client.nomeFantasia || client.razaoSocial;
  };

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'Produto Desconhecido';

  const renderLocationValue = (text: string | undefined, className: string, prefix?: React.ReactNode) => {
    if (!text) return null;

    const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
    const url = urlMatch ? urlMatch[0] : null;
    const cleanText = url ? text.replace(url, '').trim() : text.trim();

    if (url) {
      return (
        <div className="flex flex-col gap-1 items-start">
          {cleanText && <span className={className}>{prefix}{cleanText}</span>}
          {!cleanText && prefix && <span className={className}>{prefix}</span>}
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 hover:text-amber-800 transition-colors dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
            title={url}
          >
            <MapPinIcon className="w-3 h-3 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            Ver Localização
          </a>
        </div>
      );
    }

    return <span className={className}>{prefix}{text}</span>;
  };

  const getStatusColor = (status: FreightOfferStatus) => {
    switch (status) {
      case FreightOfferStatus.AguardandoPreco: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case FreightOfferStatus.AnaliseCliente: return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case FreightOfferStatus.Pendente: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case FreightOfferStatus.Aceita: return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case FreightOfferStatus.Recusada: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case FreightOfferStatus.Contraproposta: return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case FreightOfferStatus.ContrapropostaAceita: return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case FreightOfferStatus.AguardandoFechamento: return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case FreightOfferStatus.SolicitadoExclusao: return 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/40 dark:text-red-300 animate-pulse';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const handleCounterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (counterOfferModal && counterValue) {
      onCounterOffer(counterOfferModal, Number(counterValue));
      setCounterOfferModal(null);
      setCounterValue('');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-2">
        <PackageIcon className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-gray-800 dark:text-white">
          {title || (isClientProfile ? 'Minhas Ofertas de Frete' : 'Ofertas de Frete Pendentes')}
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              {!isClientProfile && <th className="px-4 py-3 font-medium">Cliente</th>}
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Destino</th>
              <th className="px-4 py-3 font-medium">Percurso</th>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Total (Ton)</th>
              <th className="px-4 py-3 font-medium">Valor (R$/Ton)</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {displayedOffers.map(offer => {
              const matchedCargo = getMatchedCargo(offer, cargos);
              const scheduledButNotLoaded = matchedCargo ? Math.max(0, matchedCargo.scheduledVolume - matchedCargo.loadedVolume) : 0;

              return (
              <tr key={offer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-3 text-xs font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  <span className="inline-block px-2 py-0.5 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-md">
                    {offer.displayId || offer.id}
                  </span>
                </td>
                {!isClientProfile && (
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-col">
                        <span>{getOfferClientDisplayName(offer)}</span>
                        {offer.clientCnpj && (
                          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                            CNPJ: {offer.clientCnpj}
                          </span>
                        )}
                      </div>
                      {(() => {
                        const clientPhone = getOfferClientPhone(offer);
                        if (!clientPhone) return null;
                        return (
                          <a
                            href={getWhatsAppUrl(clientPhone, offer)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center hover:scale-110 transition-transform text-green-600 ml-1"
                            title={`Conversar no WhatsApp (${clientPhone})`}
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                          </a>
                        );
                      })()}
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <div className="flex flex-col items-start gap-1.5">
                    {renderLocationValue(offer.origin, "")}
                    {renderLocationValue(offer.originLocation, "block text-xs text-gray-500 mt-1")}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <div className="flex flex-col items-start gap-1.5">
                    <div className="flex items-center gap-2">
                      {renderLocationValue(offer.destination, "")}
                      {offer.additionalDestinations && offer.additionalDestinations.length > 0 && (
                        <button 
                          onClick={() => setDetailsModal(offer)}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-200 rounded-full transition-colors flex items-center justify-center min-w-[20px]"
                          title="Ver oferta para mais destinos"
                        >
                          +{offer.additionalDestinations.length}
                        </button>
                      )}
                    </div>
                    {renderLocationValue(offer.destinationLocation, "block text-xs text-gray-500 mt-1")}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <OfferPercursoCell offer={offer} onUpdateOffer={onSaveFreightOffer} />
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <div>{getProductName(offer.productId)}</div>
                  {(offer.freightType || offer.hasIcms !== undefined) && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {offer.freightType && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded">
                          {offer.freightType}
                        </span>
                      )}
                      {offer.hasIcms !== undefined && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold border rounded ${offer.hasIcms ? 'text-amber-700 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' : 'text-gray-600 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                          {offer.hasIcms ? `ICMS ${offer.icmsPercentage ? offer.icmsPercentage + '%' : 'Sim'}` : 'Sem ICMS'}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {matchedCargo ? (
                    <div className="w-32 space-y-1">
                      <div className="flex justify-between items-start text-[10px] font-bold text-gray-500 uppercase">
                        <span>Progresso</span>
                        <div className="text-right">
                          <div className="text-gray-700 dark:text-gray-300">{matchedCargo.loadedVolume} / {matchedCargo.totalVolume}</div>
                        </div>
                      </div>
                      <VolumeBar
                        loaded={matchedCargo.loadedVolume}
                        scheduled={scheduledButNotLoaded}
                        total={matchedCargo.totalVolume}
                      />
                    </div>
                  ) : (
                    offer.totalTonnage
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {matchedCargo ? (
                    <div>R$ {(offer.counterOfferValue || offer.freightValuePerTon || 0).toFixed(2)}</div>
                  ) : (
                    <>
                      <div>{offer.freightValuePerTon ? `R$ ${offer.freightValuePerTon.toFixed(2)}` : 'Aguardando Preço'}</div>
                      {offer.counterOfferValue && (
                        <div className="text-xs text-amber-500 font-medium mt-0.5">
                          Contraproposta: R$ {offer.counterOfferValue.toFixed(2)}
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-center ${getStatusColor(offer.status)}`}>
                    {matchedCargo
                      ? (matchedCargo.status === CargoStatus.Fechada ? 'Carga concluída' : 'Carga em andamento')
                      : offer.status === FreightOfferStatus.SolicitadoExclusao
                        ? 'Exclusão Solicitada'
                        : isClientProfile && offer.status === FreightOfferStatus.AguardandoPreco
                          ? 'Aguardando preço da transportadora'
                          : isClientProfile && offer.status === FreightOfferStatus.AnaliseCliente
                            ? 'Aguardando sua análise'
                            : isClientProfile && offer.status === FreightOfferStatus.AguardandoFechamento
                              ? 'Aguardando fechamento'
                            : !isClientProfile && offer.status === FreightOfferStatus.AguardandoFechamento
                              ? 'Aguardando fechamento do cliente'
                            : !isClientProfile && offer.status === FreightOfferStatus.AnaliseCliente
                              ? 'Aguardando análise do cliente'
                            : !isClientProfile && offer.status === FreightOfferStatus.AguardandoPreco
                              ? 'Aguardando envio de preço'
                              : isClientProfile && offer.status === FreightOfferStatus.ContrapropostaAceita
                                ? 'Aceita'
                                : offer.status === FreightOfferStatus.Pendente && isClientProfile
                                  ? 'Oferta enviada, aguardando resposta'
                                  : offer.status === FreightOfferStatus.Contraproposta && !isClientProfile
                                    ? 'Contraproposta enviada, aguardando aprovação'
                                    : offer.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Ações da Transportadora */}
                    {!isClientProfile && !isDemo && (
                      <>
                        {offer.status === FreightOfferStatus.SolicitadoExclusao && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (window.confirm(`Confirmar exclusão permanente da oferta ${offer.displayId || offer.id}?`)) {
                                  if (onDelete) onDelete(offer);
                                }
                              }}
                              title="Confirmar Exclusão da Oferta"
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <CheckIcon className="w-3.5 h-3.5" />
                              Excluir
                            </button>
                            <button
                              onClick={async () => {
                                if (onSaveFreightOffer) {
                                  const restoredStatus = offer.previousStatus || FreightOfferStatus.AguardandoPreco;
                                  const history = [
                                    ...(offer.history || []),
                                    {
                                      id: `log_${Date.now()}_sys`,
                                      userId: currentUser?.id || 'system',
                                      timestamp: new Date().toISOString(),
                                      description: 'Solicitação de exclusão RECUSADA pela Transportadora.'
                                    }
                                  ];
                                  await onSaveFreightOffer({ ...offer, status: restoredStatus, history });
                                }
                              }}
                              title="Recusar Exclusão (Manter Oferta Ativa)"
                              className="px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <XIcon className="w-3.5 h-3.5" />
                              Recusar
                            </button>
                          </div>
                        )}
                        {offer.status === FreightOfferStatus.AguardandoPreco && (
                          <button onClick={() => {
                            setCounterOfferModal(offer);
                            setCounterValue('');
                          }} title="Enviar Preço" className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
                            <MessageCircleIcon className="w-4 h-4" />
                          </button>
                        )}
                        {(offer.status === FreightOfferStatus.AnaliseCliente || offer.status === FreightOfferStatus.AguardandoFechamento) && (
                          <button 
                            onClick={() => {
                              if (offer.status === FreightOfferStatus.AnaliseCliente) {
                                setCounterOfferModal(offer);
                                setCounterValue(offer.freightValuePerTon ? offer.freightValuePerTon.toString() : '');
                              }
                            }} 
                            disabled={offer.status === FreightOfferStatus.AguardandoFechamento}
                            title={offer.status === FreightOfferStatus.AguardandoFechamento ? "Edição desabilitada - Aguardando Fechamento" : "Editar Preço Enviado"} 
                            className={`p-1.5 rounded-lg transition-colors ${offer.status === FreightOfferStatus.AguardandoFechamento ? 'text-gray-400 bg-gray-100 cursor-not-allowed dark:bg-gray-700/50 dark:text-gray-500' : 'text-amber-600 bg-amber-50 hover:bg-amber-100'}`}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {offer.status === FreightOfferStatus.Contraproposta && (
                          <>
                            <button onClick={() => onAccept(offer)} title="Aceitar Contraproposta" className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                              <CheckIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => onRefuse(offer)} title="Recusar Contraproposta" className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                              <XIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(offer.status === FreightOfferStatus.Pendente || offer.status === FreightOfferStatus.ContrapropostaAceita) && (
                          <>
                            <button onClick={() => onAccept(offer)} title="Aceitar Oferta" className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                              <CheckIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCounterOfferModal(offer)} title="Fazer Contraproposta" className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
                              <MessageCircleIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => onRefuse(offer)} title="Recusar Oferta" className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                              <XIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {offer.status === FreightOfferStatus.Aceita && onConvertToCargo && !matchedCargo && (
                          <button onClick={() => onConvertToCargo(offer)} title="Gerar Carga a partir desta oferta" className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1">
                            <PackageIcon className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                    {/* Ações do Cliente */}
                    {isClientProfile && !isDemo && (
                      <>
                        {/* Botão de Editar Oferta (Disponível até o transportador enviar o preço) */}
                        {(() => {
                          const isPriceSent = !!offer.freightValuePerTon && offer.status !== FreightOfferStatus.AguardandoPreco;
                          const canEdit = !isPriceSent && offer.status !== FreightOfferStatus.SolicitadoExclusao && offer.status !== FreightOfferStatus.Aceita && offer.status !== FreightOfferStatus.Recusada;
                          
                          if (canEdit) {
                            return (
                              <button
                                onClick={() => setEditingOfferModal(offer)}
                                title="Editar Oferta de Frete"
                                className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            );
                          }
                          return (
                            <button
                              disabled
                              title="A oferta não pode ser editada após o envio de preço pela transportadora"
                              className="p-1.5 text-gray-300 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-not-allowed"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          );
                        })()}

                        {/* Botão de Solicitar Exclusão da Oferta */}
                        {offer.status !== FreightOfferStatus.SolicitadoExclusao ? (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Deseja solicitar a exclusão da Oferta ${offer.displayId || offer.id}? A transportadora precisará confirmar a exclusão.`)) {
                                if (onSaveFreightOffer) {
                                  const history = [
                                    ...(offer.history || []),
                                    {
                                      id: `log_${Date.now()}_sys`,
                                      userId: currentUser?.id || 'client',
                                      timestamp: new Date().toISOString(),
                                      description: 'Solicitação de exclusão efetuada pelo cliente.'
                                    }
                                  ];
                                  await onSaveFreightOffer({
                                    ...offer,
                                    status: FreightOfferStatus.SolicitadoExclusao,
                                    previousStatus: offer.status,
                                    history
                                  });
                                }
                              }
                            }}
                            title="Solicitar Exclusão da Oferta"
                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-md" title="Aguardando transportador confirmar a exclusão">
                            Exclusão Solicitada
                          </span>
                        )}

                        {(offer.status === FreightOfferStatus.AnaliseCliente || offer.status === FreightOfferStatus.AguardandoFechamento) && (
                          <>
                            <button onClick={() => {
                              setConfirmAcceptModal(offer);
                              setAcceptAttachments([]);
                            }} title="Aceitar Preço" className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                              <CheckIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCounterOfferModal(offer)} title="Fazer Contraproposta" className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
                              <MessageCircleIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => onRefuse(offer)} title="Recusar Preço" className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                              <XIcon className="w-4 h-4" />
                            </button>
                            {offer.status === FreightOfferStatus.AnaliseCliente && onUpdateStatus && (
                              <button onClick={() => onUpdateStatus(offer, FreightOfferStatus.AguardandoFechamento)} title="Mudar para Aguardando Fechamento" className="p-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
                                <Clock className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {/* Botão de WhatsApp do Cliente */}
                    {(() => {
                      const clientPhone = getOfferClientPhone(offer);
                      if (!clientPhone) return null;
                      const clientName = getClientName(offer.clientId);
                      return (
                        <a
                          href={getWhatsAppUrl(clientPhone, offer)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center justify-center dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 shrink-0"
                          title={`Conversar com ${clientName} no WhatsApp (${clientPhone})`}
                        >
                          <WhatsAppIcon className="w-4 h-4" />
                        </a>
                      );
                    })()}
                    {/* Botão Visualizar Solicitação */}
                    <button
                      onClick={() => setDetailsModal(offer)}
                      title="Visualizar Solicitação"
                      className={`transition-colors rounded-lg flex items-center gap-1.5 ${offer.driverId && !isClientProfile ? 'px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200' : 'p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100'}`}
                    >
                      <EyeIcon className="w-4 h-4" />
                      {offer.driverId && !isClientProfile && <span>Visualizar</span>}
                    </button>
                    <button onClick={() => setHistoryModal(offer)} title="Ver Histórico" className="p-1.5 text-gray-600 bg-gray-50 hover:bg-gray-200 rounded-lg transition-colors">
                      <HistoryIcon className="w-4 h-4" />
                    </button>
                    {/* Botão de Excluir (Apenas Admin) */}
                    {onDelete && (currentUser?.profile === UserProfile.Admin || isDeveloperUser(currentUser)) && !isDemo && (
                      <button onClick={() => onDelete(offer)} title="Excluir Oferta" className="p-1.5 text-red-600 bg-red-50 hover:bg-red-200 rounded-lg transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
      {offers.length > 2 && (
        <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-center">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
          >
            {isExpanded ? 'Exibir Menos' : `Exibir Mais (${offers.length - 2})`}
          </button>
        </div>
      )}

      {counterOfferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                {counterOfferModal.status === FreightOfferStatus.AguardandoPreco 
                  ? 'Enviar Preço da Oferta' 
                  : counterOfferModal.status === FreightOfferStatus.AnaliseCliente 
                    ? 'Editar Preço Enviado' 
                    : 'Fazer Contraproposta'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {counterOfferModal.status === FreightOfferStatus.AguardandoPreco 
                  ? `Informe o valor por tonelada (R$) para o frete do cliente ${getClientName(counterOfferModal.clientId)}.`
                  : counterOfferModal.status === FreightOfferStatus.AnaliseCliente 
                    ? `Informe o novo valor por tonelada (R$) para o frete do cliente ${getClientName(counterOfferModal.clientId)}.`
                    : isClientProfile 
                      ? 'Informe o novo valor por tonelada (R$) que deseja contrapropor para a transportadora.' 
                      : `Informe o novo valor por tonelada (R$) que deseja propor ao cliente ${getClientName(counterOfferModal.clientId)}.`}
              </p>
              <form onSubmit={handleCounterSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Novo Valor (R$/Ton)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={counterValue}
                    onChange={(e) => setCounterValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder={`Atual: R$ ${counterOfferModal.freightValuePerTon ? counterOfferModal.freightValuePerTon.toFixed(2) : '0.00'}`}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setCounterOfferModal(null)} className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors">
                    {counterOfferModal.status === FreightOfferStatus.AguardandoPreco 
                      ? 'Enviar Preço' 
                      : counterOfferModal.status === FreightOfferStatus.AnaliseCliente 
                        ? 'Salvar Preço' 
                        : 'Enviar Contraproposta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {historyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 text-amber-500" />
                Histórico da Negociação
              </h3>
              <button onClick={() => setHistoryModal(null)} className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {historyModal.history && historyModal.history.length > 0 ? (
                <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-gray-600 before:to-transparent">
                  {historyModal.history.map((log, i) => (
                    <div key={log.id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-4 last:mb-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-gray-800 bg-amber-50 dark:bg-amber-900/50 text-amber-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                        <HistoryIcon className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                        <div className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1">{log.description}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                           {new Date(log.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Nenhum histórico disponível para esta oferta.</p>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
              <button onClick={() => setHistoryModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <PackageIcon className="w-5 h-5 text-amber-500" />
                Detalhes da Oferta
                <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-md">
                  {detailsModal.displayId || detailsModal.id}
                </span>
              </h3>
              <button onClick={() => setDetailsModal(null)} className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-700 dark:text-gray-300">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Offer Info (6/12) */}
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Cliente Solicitante:</span>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{getOfferClientDisplayName(detailsModal)}</div>
                        {detailsModal.clientCnpj && (
                          <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                            CNPJ: {detailsModal.clientCnpj}
                          </div>
                        )}
                      </div>
                      {(() => {
                        const clientPhone = getOfferClientPhone(detailsModal);
                        if (!clientPhone) return null;
                        return (
                          <a
                            href={getWhatsAppUrl(clientPhone, detailsModal)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm"
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                            WhatsApp ({clientPhone})
                          </a>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Origem:</span>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 flex flex-col">
                      {renderLocationValue(detailsModal.origin, "font-medium text-gray-900 dark:text-gray-100")}
                      {renderLocationValue(detailsModal.originLocation, "text-xs text-gray-500 mt-1")}
                    </div>
                  </div>
                 
                  <div>
                    <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Destinos:</span>
                    <div className="flex flex-col gap-2">
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 flex flex-col">
                        {renderLocationValue(detailsModal.destination, "font-medium text-gray-900 dark:text-gray-100", "1. ")}
                        {renderLocationValue(detailsModal.destinationLocation, "block text-xs text-gray-500 mt-1")}
                      </div>
                      {detailsModal.additionalDestinations?.map((d, i) => (
                        <div key={i} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 flex flex-col">
                          {renderLocationValue(d.city, "font-medium text-gray-900 dark:text-gray-100", `${i + 2}. `)}
                          {renderLocationValue(d.location, "block text-xs text-gray-500 mt-1")}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Percurso Rodoviário:</span>
                    <div className="bg-amber-50/70 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-100 dark:border-amber-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RouteIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {detailsModal.distanceKm ? `${detailsModal.distanceKm} km` : 'Calculando...'}
                        </span>
                      </div>
                      {detailsModal.isExactDistance ? (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          ✓ Pontos exatos do link
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                          Entre cidades
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                      <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Produto:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{getProductName(detailsModal.productId)}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                      <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Volume Total:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{detailsModal.totalTonnage} Ton</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                      <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Tipo de Frete:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{detailsModal.freightType || 'CIF'}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                      <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Incidência de ICMS:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {detailsModal.hasIcms ? `Sim (${detailsModal.icmsPercentage || 0}%)` : 'Não (Sem ICMS)'}
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                      <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Valor (R$/Ton):</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{detailsModal.freightValuePerTon ? `R$ ${detailsModal.freightValuePerTon.toFixed(2)}` : 'Aguardando'}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                      <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Cadência:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{detailsModal.dailySchedule || 'Não informada'}</span>
                    </div>
                  </div>

                  {detailsModal.observations && (
                    <div>
                      <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Observações:</span>
                      <p className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-gray-100">{detailsModal.observations}</p>
                    </div>
                  )}

                  {detailsModal.attachments && detailsModal.attachments.length > 0 && (
                    <div>
                      <span className="font-semibold block text-gray-500 dark:text-gray-400 mb-1">Anexos:</span>
                      <ul className="space-y-2">
                        {detailsModal.attachments.map((fileUrlOrName, i) => {
                          const isUrl = fileUrlOrName.startsWith('http');
                          const displayName = fileUrlOrName.includes('?name=') ? decodeURIComponent(fileUrlOrName.split('?name=')[1]) : fileUrlOrName;
                          return (
                          <li key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-gray-100">
                            <div className="flex items-center gap-2 overflow-hidden truncate">
                              <PaperclipIcon className="w-4 h-4 text-amber-500 shrink-0" />
                              <span className="truncate">{displayName}</span>
                            </div>
                            {isUrl ? (
                              <button 
                                type="button"
                                onClick={() => openDocumentInNewTab(fileUrlOrName, displayName)}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 rounded-lg transition-colors ml-2 shrink-0 flex items-center gap-1.5 cursor-pointer"
                                title="Abrir documento em nova janela"
                              >
                                <EyeIcon className="w-3.5 h-3.5" />
                                <span>Visualizar</span>
                              </button>
                            ) : (
                              <button 
                                type="button" 
                                onClick={() => {
                                  alert(`O anexo ${displayName} é de uma versão antiga e o arquivo não foi salvo no servidor.`);
                                }}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ml-2 shrink-0"
                                title="Arquivo não disponível"
                              >
                                <EyeIcon className="w-4 h-4" />
                              </button>
                            )}
                          </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Right Column: Route Map (6/12) */}
                <div className="lg:col-span-6">
                  <OfferRoutePreview offer={detailsModal} />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end shrink-0">
              <button onClick={() => setDetailsModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAcceptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <CheckIcon className="w-5 h-5 text-green-500" />
                Confirmar Aceite de Preço
              </h3>
              <button 
                onClick={() => {
                  setConfirmAcceptModal(null);
                  setAcceptAttachments([]);
                }} 
                className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Tem certeza que deseja aceitar o preço de{' '}
                <strong className="text-gray-900 dark:text-white">
                  R$ {(confirmAcceptModal.counterOfferValue || confirmAcceptModal.freightValuePerTon || 0).toFixed(2)} / Ton
                </strong>{' '}
                para a oferta de <strong className="text-gray-900 dark:text-white">{confirmAcceptModal.origin}</strong> para{' '}
                <strong className="text-gray-900 dark:text-white">{confirmAcceptModal.destination}</strong>?
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anexos</label>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    ref={acceptFileInputRef}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        const newFiles = Array.from(files);
                        setAcceptAttachments(prev => {
                          const existingNames = prev.map(f => f.name);
                          const filesToAdd = newFiles.filter(f => !existingNames.includes(f.name));
                          return [...prev, ...filesToAdd];
                        });
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => acceptFileInputRef.current?.click()}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 justify-center transition-colors font-medium"
                  >
                    <PaperclipIcon className="w-4 h-4" />
                    Anexar Arquivos
                  </button>
                </div>
                {acceptAttachments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {acceptAttachments.map((file, index) => (
                      <li key={index} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/50 px-2 py-1.5 rounded-md">
                        <span className="truncate max-w-[85%]">{file.name}</span>
                        <button 
                          type="button" 
                          onClick={() => setAcceptAttachments(prev => prev.filter(f => f.name !== file.name))} 
                          className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setConfirmAcceptModal(null);
                  setAcceptAttachments([]);
                }} 
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                disabled={isUploading}
                onClick={async () => {
                  setIsUploading(true);
                  try {
                    const uploadedUrls: string[] = [];
                    for (const file of acceptAttachments) {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `freight_offer_accept_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                      const filePath = `freight_offers/${fileName}`;
                      
                      const { error: uploadError } = await supabase.storage
                        .from('shipment_attachments')
                        .upload(filePath, file);
                        
                      if (uploadError) throw new Error('Falha no upload: ' + file.name);
                      
                      const { data } = supabase.storage
                        .from('shipment_attachments')
                        .getPublicUrl(filePath);
                        
                      uploadedUrls.push(`${data.publicUrl}?name=${encodeURIComponent(file.name)}`);
                    }

                    const updatedOffer = {
                      ...confirmAcceptModal,
                      attachments: [...(confirmAcceptModal.attachments || []), ...uploadedUrls]
                    };
                    onAccept(updatedOffer);
                    setConfirmAcceptModal(null);
                    setAcceptAttachments([]);
                  } catch (error: any) {
                    console.error('Error uploading attachments:', error);
                    alert(`Erro ao salvar anexos: ${error.message}`);
                  } finally {
                    setIsUploading(false);
                  }
                }} 
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {isUploading ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingOfferModal && (
        <FreightOfferModal
          isOpen={!!editingOfferModal}
          onClose={() => setEditingOfferModal(null)}
          clients={clients}
          products={products}
          currentClient={clients.find(c => c.id === editingOfferModal.clientId)}
          onSave={async (updatedOffer) => {
            if (onSaveFreightOffer) {
              await onSaveFreightOffer(updatedOffer);
            }
            setEditingOfferModal(null);
          }}
          editingOffer={editingOfferModal}
          currentUser={currentUser}
        />
      )}

      <DocumentPreviewModal
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        fileUrl={previewDocument?.url || null}
        fileName={previewDocument?.name}
        category={previewDocument?.category}
      />
    </div>
  );
};

export default FreightOffersList;
