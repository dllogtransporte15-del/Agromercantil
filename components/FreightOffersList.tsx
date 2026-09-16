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
import { isDemoUser } from '../auth';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Waypoint {
  label: string;
  subLabel?: string;
  lat: number;
  lng: number;
  isExact: boolean;
  type: 'origin' | 'destination' | 'via';
}

interface RouteData {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][];
  bounds: L.LatLngBounds | null;
  waypoints: Waypoint[];
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

const parseCoordinatesFromText = (str: string | undefined): { lat: number; lng: number } | null => {
  if (!str) return null;
  const trimmed = str.trim();
  
  // 1. Direct "lat, lng" e.g. -16.2341, -47.9123 or -16.2341 -47.9123
  const directCoordMatch = trimmed.match(/^(-?\d{1,2}\.\d+)\s*[\s,]\s*(-?\d{1,3}\.\d+)$/);
  if (directCoordMatch) {
    const lat = parseFloat(directCoordMatch[1]);
    const lng = parseFloat(directCoordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 2. Google Maps @lat,lng e.g. maps.google.com/maps/@-16.2341,-47.9123,17z
  const atCoordMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atCoordMatch) {
    const lat = parseFloat(atCoordMatch[1]);
    const lng = parseFloat(atCoordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 3. Google Maps 3d/4d params e.g. !3d-16.2341!4d-47.9123 or 3d-16.2341!4d-47.9123
  const d3d4Match = trimmed.match(/!?3d(-?\d+\.\d+)!?4d(-?\d+\.\d+)/);
  if (d3d4Match) {
    const lat = parseFloat(d3d4Match[1]);
    const lng = parseFloat(d3d4Match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 4. Google Maps query/ll params e.g. ?q=-16.2341,-47.9123 or &ll=-16.2341,-47.9123
  const paramMatch = trimmed.match(/[?&](?:q|ll|destination|origin|center)=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/i);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 5. Google Maps /place/lat,lng/ or /dir/lat,lng/
  const pathMatch = trimmed.match(/\/(?:place|dir|search)\/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/i);
  if (pathMatch) {
    const lat = parseFloat(pathMatch[1]);
    const lng = parseFloat(pathMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  return null;
};

const extractPlaceNameFromUrl = (url: string): string | null => {
  const match = url.match(/\/place\/([^\/@?]+)/);
  if (match && match[1]) {
    try {
      const decoded = decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
      if (decoded && !/^-?\d+\.\d+/.test(decoded)) {
        return decoded;
      }
    } catch (e) {
      return match[1].replace(/\+/g, ' ').trim();
    }
  }
  return null;
};

const resolveLocationToWaypoint = async (
  locationStr: string | undefined,
  cityStr: string,
  type: 'origin' | 'destination' | 'via'
): Promise<Waypoint | null> => {
  let targetLocation = locationStr?.trim() || '';
  let extractedCoords = parseCoordinatesFromText(targetLocation);
  let extractedPlaceName: string | null = null;

  const urlMatch = targetLocation.match(/(https?:\/\/[^\s]+)/i);
  const url = urlMatch ? urlMatch[0] : null;

  if (url && !extractedCoords) {
    extractedPlaceName = extractPlaceNameFromUrl(url);

    if (url.includes('goo.gl') || url.includes('maps.app') || url.includes('shorturl') || url.includes('bit.ly') || url.includes('t.co')) {
      try {
        const proxyResp = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        if (proxyResp.ok) {
          const data = await proxyResp.json();
          const finalUrl = data.status?.url || data.contents || '';
          extractedCoords = parseCoordinatesFromText(finalUrl);
          if (!extractedPlaceName) {
            extractedPlaceName = extractPlaceNameFromUrl(finalUrl);
          }
        }
      } catch (e) {
        console.warn('Could not unshorten URL via proxy:', e);
      }
    }
  }

  if (extractedCoords) {
    const cleanLabel = targetLocation.replace(/https?:\/\/[^\s]+/g, '').trim();
    const label = cleanLabel && cleanLabel.length > 2 && !cleanLabel.startsWith('-')
      ? cleanLabel 
      : (extractedPlaceName || (type === 'origin' ? 'Origem' : type === 'destination' ? 'Destino' : 'Ponto de Apoio'));

    return {
      label,
      subLabel: cityStr ? `Localização Exata (${cityStr})` : `Coordenadas: ${extractedCoords.lat.toFixed(4)}, ${extractedCoords.lng.toFixed(4)}`,
      lat: extractedCoords.lat,
      lng: extractedCoords.lng,
      isExact: true,
      type
    };
  }

  const cityCoords = parseCoordinatesFromText(cityStr);
  if (cityCoords) {
    return {
      label: `Coordenadas: ${cityCoords.lat.toFixed(4)}, ${cityCoords.lng.toFixed(4)}`,
      lat: cityCoords.lat,
      lng: cityCoords.lng,
      isExact: true,
      type
    };
  }

  const cleanStr = (s: string) => s.replace(/https?:\/\/[^\s]+/g, '').replace(/[\\/]/g, ' ').trim();
  const cleanLoc = cleanStr(targetLocation);
  const cleanCity = cleanStr(cityStr);

  if (extractedPlaceName && cleanCity) {
    try {
      const query = `${extractedPlaceName}, ${cleanCity}, Brasil`;
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=pt-br&countrycodes=br`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          return {
            label: extractedPlaceName,
            subLabel: cleanCity,
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            isExact: true,
            type
          };
        }
      }
    } catch (e) {
      console.warn('Geocoding extracted place name failed:', e);
    }
  }

  if (cleanLoc && cleanLoc.length > 2) {
    try {
      const query = `${cleanLoc}, ${cleanCity}, Brasil`;
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=pt-br&countrycodes=br`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          return {
            label: cleanLoc,
            subLabel: cleanCity,
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            isExact: true,
            type
          };
        }
      }
    } catch (e) {
      console.warn('Geocoding exact location text failed:', e);
    }
  }

  if (cleanCity && cleanCity.length > 2) {
    try {
      const query = `${cleanCity}, Brasil`;
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=pt-br&countrycodes=br`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          return {
            label: cleanCity,
            subLabel: (cleanLoc || extractedPlaceName) ? `Local: "${cleanLoc || extractedPlaceName}" (não mapeado exatamente)` : undefined,
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            isExact: false,
            type
          };
        }
      }
    } catch (e) {
      console.warn('Geocoding city failed:', e);
    }
  }

  return null;
};

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
      const originRes = await resolveLocationToWaypoint(offer.originLocation, offer.origin, 'origin');
      if (!originRes) {
        setError(`Não foi possível localizar a Origem "${offer.origin}".`);
        setIsLoading(false);
        return;
      }

      const resolvedVias: Waypoint[] = [];
      if (offer.additionalDestinations && offer.additionalDestinations.length > 0) {
        for (const via of offer.additionalDestinations) {
          if (via.city && via.city.trim().length >= 3) {
            const viaRes = await resolveLocationToWaypoint(via.location, via.city, 'via');
            if (viaRes) resolvedVias.push(viaRes);
          }
        }
      }

      const destRes = await resolveLocationToWaypoint(offer.destinationLocation, offer.destination, 'destination');
      if (!destRes) {
        setError(`Não foi possível localizar o Destino "${offer.destination}".`);
        setIsLoading(false);
        return;
      }

      const allWaypoints = [originRes, ...resolvedVias, destRes];

      const waypointsParam = allWaypoints.map(w => `${w.lng},${w.lat}`).join(';');
      const osrmResp = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${waypointsParam}?overview=full&geometries=geojson`
      );

      if (!osrmResp.ok) throw new Error('Falha no serviço de rotas OSRM.');

      const osrmData = await osrmResp.json();
      if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
        throw new Error('Rota não encontrada entre as localizações.');
      }

      const route = osrmData.routes[0];
      const distanceKm = route.distance / 1000;
      const durationMin = Math.round(route.duration / 60);
      const coordinates: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );
      const bounds = L.latLngBounds(coordinates);

      setRouteData({
        distanceKm,
        durationMin,
        coordinates,
        bounds,
        waypoints: allWaypoints
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
          <RouteIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-sm font-bold text-gray-800 dark:text-white">Roteiro da Oferta</h4>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRoute}
            disabled={isLoading}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
            title="Recalcular rota com base nas localizações"
          >
            <Navigation className="w-3 h-3 text-white" />
            Recalcular
          </button>

          {isLoading && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-full text-xs font-semibold animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
              Carregando...
            </div>
          )}

          {routeData && !isLoading && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 rounded-full text-xs font-bold">
                <RouteIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {routeData.distanceKm.toFixed(0)} km
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
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
                color="#4f46e5"
                weight={5}
                opacity={0.85}
              />
            )}

            {routeData?.waypoints.map((wp, idx) => (
              <Marker key={idx} position={[wp.lat, wp.lng]}>
                <Popup>
                  <div className="text-xs">
                    <strong className="block text-indigo-700 font-bold mb-1">
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
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0 ${wp.type === 'origin' ? 'bg-emerald-600' : wp.type === 'destination' ? 'bg-red-600' : 'bg-indigo-600'}`}>
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
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:text-blue-800 transition-colors dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50"
            title={url}
          >
            <MapPinIcon className="w-3 h-3 flex-shrink-0 text-blue-600 dark:text-blue-400" />
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
      case FreightOfferStatus.Contraproposta: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
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
        <PackageIcon className="w-5 h-5 text-indigo-500" />
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
                <td className="px-4 py-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                  <span className="inline-block px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-md">
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
                          className="px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 rounded-full transition-colors flex items-center justify-center min-w-[20px]"
                          title="Ver oferta para mais destinos"
                        >
                          +{offer.additionalDestinations.length}
                        </button>
                      )}
                    </div>
                    {renderLocationValue(offer.destinationLocation, "block text-xs text-gray-500 mt-1")}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <div>{getProductName(offer.productId)}</div>
                  {(offer.freightType || offer.hasIcms !== undefined) && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {offer.freightType && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded">
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
                        <div className="text-xs text-blue-500 font-medium mt-0.5">
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
                          }} title="Enviar Preço" className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
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
                            className={`p-1.5 rounded-lg transition-colors ${offer.status === FreightOfferStatus.AguardandoFechamento ? 'text-gray-400 bg-gray-100 cursor-not-allowed dark:bg-gray-700/50 dark:text-gray-500' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
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
                            <button onClick={() => setCounterOfferModal(offer)} title="Fazer Contraproposta" className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                              <MessageCircleIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => onRefuse(offer)} title="Recusar Oferta" className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                              <XIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {offer.status === FreightOfferStatus.Aceita && onConvertToCargo && !matchedCargo && (
                          <button onClick={() => onConvertToCargo(offer)} title="Gerar Carga a partir desta oferta" className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1">
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
                                className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
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
                            <button onClick={() => setCounterOfferModal(offer)} title="Fazer Contraproposta" className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
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
                      className={`transition-colors rounded-lg flex items-center gap-1.5 ${offer.driverId && !isClientProfile ? 'px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200' : 'p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                    >
                      <EyeIcon className="w-4 h-4" />
                      {offer.driverId && !isClientProfile && <span>Visualizar</span>}
                    </button>
                    <button onClick={() => setHistoryModal(offer)} title="Ver Histórico" className="p-1.5 text-gray-600 bg-gray-50 hover:bg-gray-200 rounded-lg transition-colors">
                      <HistoryIcon className="w-4 h-4" />
                    </button>
                    {/* Botão de Excluir (Apenas Admin) */}
                    {onDelete && currentUser?.profile === UserProfile.Admin && !isDemo && (
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
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
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
                  <button type="submit" className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
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
                <HistoryIcon className="w-5 h-5 text-indigo-500" />
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
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-gray-800 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
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
                <PackageIcon className="w-5 h-5 text-indigo-500" />
                Detalhes da Oferta
                <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-md">
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
                              <PaperclipIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                              <span className="truncate">{displayName}</span>
                            </div>
                            {isUrl ? (
                              <button 
                                type="button"
                                onClick={() => openDocumentInNewTab(fileUrlOrName, displayName)}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg transition-colors ml-2 shrink-0 flex items-center gap-1.5 cursor-pointer"
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
