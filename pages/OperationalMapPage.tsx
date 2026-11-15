import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from '../components/Header';
import NewShipmentModal from '../components/NewShipmentModal';
import type { Cargo, Shipment, Client, Product, User, Driver, Vehicle, VehicleSetType, VehicleBodyType, Owner } from '../types';
import { CargoStatus } from '../types';
import { 
  MapPin, Truck, Navigation, Layers, Search, Maximize2, Minimize2, 
  DollarSign, Package, Calendar, Share2, Copy, PlusCircle, CheckCircle2, 
  RotateCcw, Sliders, Eye, ExternalLink, ArrowRight, Sparkles, Filter, 
  Check, Compass, Info, X, ChevronDown
} from 'lucide-react';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import { geocodeCity, getCoordsSync } from '../utils/geocoding';
import { upsertManyCargos } from '../lib/db';
import { isDemoUser } from '../auth';
import { useToast } from '../hooks/useToast';

// Declare Leaflet globally since it's loaded via script tag in index.html
declare const L: any;

interface OperationalMapPageProps {
  cargos: Cargo[];
  shipments: Shipment[];
  clients: Client[];
  products: Product[];
  drivers: Driver[];
  owners?: Owner[];
  vehicles: Vehicle[];
  onCreateShipment: (data: Omit<Shipment, 'id' | 'orderId' | 'status' | 'documents' | 'history' | 'createdAt' | 'createdById' | 'statusHistory'>) => void;
  currentUser: User | null;
  users: User[];
  onModalStateChange: (isOpen: boolean) => void;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
}

const P180 = Math.PI / 180;

// Fórmula de Haversine para cálculo de distância em km
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * P180;
  const dLon = (lon2 - lon1) * P180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * P180) * Math.cos(lat2 * P180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

const isInBoundingBox = (lat: number, lon: number, centerLat: number, centerLon: number, radiusKm: number): boolean => {
  const latDegree = radiusKm / 111.32;
  const lonDegree = radiusKm / (111.32 * Math.cos(centerLat * P180));
  return Math.abs(lat - centerLat) <= latDegree && Math.abs(lon - centerLon) <= lonDegree;
};

type MapLayerType = 'streets' | 'satellite' | 'dark';

const OperationalMapPage: React.FC<OperationalMapPageProps> = ({ 
  cargos, 
  shipments, 
  clients, 
  products, 
  drivers, 
  owners = [], 
  vehicles, 
  onCreateShipment, 
  currentUser, 
  users, 
  onModalStateChange, 
  onDeleteAttachment 
}) => {
  const isDemo = isDemoUser(currentUser);
  const { showToast } = useToast();

  // Filtros de Raio
  const [originQuery, setOriginQuery] = useState('Catalão');
  const [originRadius, setOriginRadius] = useState(250);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationRadius, setDestinationRadius] = useState(250);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [filteredLoads, setFilteredLoads] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estado da Carga Selecionada
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);

  // Interface & Filtros
  const [showDestinationFilter, setShowDestinationFilter] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('Divulgar');
  const [activeTileLayer, setActiveTileLayer] = useState<MapLayerType>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Modal de Lançamento de Embarque
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [selectedCargoForShipment, setSelectedCargoForShipment] = useState<Cargo | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    onModalStateChange(isShipmentModalOpen);
  }, [isShipmentModalOpen, onModalStateChange]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const circleLayerRef = useRef<any>(null);
  const routeLineLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const loadsWithCoordsRef = useRef<(Cargo & { originCoords?: { lat: number, lng: number }, destinationCoords?: { lat: number, lng: number }})[]>([]);

  const handleOpenNewShipmentModal = (cargo: Cargo) => {
    if (isDemo) return;
    setSelectedCargoForShipment(cargo);
    setIsShipmentModalOpen(true);
  };

  const handleCloseShipmentModal = () => {
    setIsShipmentModalOpen(false);
    setSelectedCargoForShipment(null);
  };

  const handleSaveShipment = async (shipmentData: Omit<Shipment, 'id' | 'orderId' | 'cargoId' | 'status' | 'documents' | 'history' | 'createdAt' | 'createdById' | 'statusHistory'>) => {
    if (isDemo) return;
    const cargoId = selectedCargoForShipment?.id || (shipmentData as any).cargoId;
    if (cargoId && onCreateShipment) {
      await onCreateShipment({
        ...shipmentData,
        cargoId,
      });
      showToast('Embarque lançado com sucesso a partir do Mapa Operacional!', 'success');
    }
  };

  // Cargas ativas com coordenadas pré-carregadas
  const loadsWithCoords = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return cargos
      .filter(c => {
        if (c.status !== CargoStatus.EmAndamento) return false;
        return c.dailySchedule?.some(ds => ds.date >= today);
      })
      .map(c => {
        const oCoords = c.originCoords || getCoordsSync(c.origin);
        const dCoords = c.destinationCoords || getCoordsSync(c.destination);

        return { 
          ...c, 
          originCoords: oCoords || undefined,
          destinationCoords: dCoords || undefined
        };
      });
  }, [cargos]);
  
  useEffect(() => {
    loadsWithCoordsRef.current = loadsWithCoords;
  }, [loadsWithCoords]);

  // Filtragem memoizada inteligente
  const memoizedFilteredLoads = useMemo(() => {
    if (!originCoords && !destinationCoords) return [];

    const allLoads = loadsWithCoords;

    if (!originCoords || !destinationCoords) {
      const uniqueLoads = new Map<string, Cargo>();
      allLoads.forEach(load => {
        let originMatch = false;
        if (originCoords && load.originCoords) {
          const dist = getDistance(originCoords.lat, originCoords.lng, load.originCoords.lat, load.originCoords.lng);
          originMatch = dist <= originRadius;
        }
        
        let destinationMatch = false;
        if (destinationCoords && load.destinationCoords) {
          const dist = getDistance(destinationCoords.lat, destinationCoords.lng, load.destinationCoords.lat, load.destinationCoords.lng);
          destinationMatch = dist <= destinationRadius;
        }

        if (originMatch || destinationMatch) {
          uniqueLoads.set(load.id, load);
        }
      });
      return Array.from(uniqueLoads.values());
    }

    const oCoords = [originCoords.lat, originCoords.lng];
    const dCoords = [destinationCoords.lat, destinationCoords.lng];

    return allLoads.filter(load => {
      const lat = load.originCoords?.lat;
      const lon = load.originCoords?.lng;
      const destLat = load.destinationCoords?.lat;
      const destLon = load.destinationCoords?.lng;

      if (lat === undefined || lon === undefined || destLat === undefined || destLon === undefined) return false;

      if (!isInBoundingBox(lat, lon, oCoords[0], oCoords[1], originRadius)) return false;
      if (!isInBoundingBox(destLat, destLon, dCoords[0], dCoords[1], destinationRadius)) return false;

      const distO = getDistance(oCoords[0], oCoords[1], lat, lon);
      const distD = getDistance(dCoords[0], dCoords[1], destLat, destLon);

      return distO <= originRadius && distD <= destinationRadius;
    });
  }, [loadsWithCoords, originCoords, originRadius, destinationCoords, destinationRadius]);

  useEffect(() => {
    setFilteredLoads(memoizedFilteredLoads);
    if (memoizedFilteredLoads.length > 0 && !selectedCargo) {
      setSelectedCargo(memoizedFilteredLoads[0]);
    }
  }, [memoizedFilteredLoads]);

  // Busca inicial automática
  useEffect(() => {
    if (originQuery && !originCoords && !loading) {
      handleSearch(null);
    }
  }, []);

  // Inicialização do Leaflet Map
  const initMap = () => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    
    // Coordenadas centrais do Brasil
    mapInstanceRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([-15.78, -47.92], 5);

    // Zoom no canto inferior direito
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);

    // Layer de Ruas padrão
    tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    circleLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    routeLineLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
  };

  // Alternador de Camada do Mapa
  const handleSwitchLayer = (type: MapLayerType) => {
    setActiveTileLayer(type);
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attr = '&copy; OpenStreetMap contributors';

    if (type === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else if (type === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      attr = '&copy; OpenStreetMap &copy; CARTO';
    }

    tileLayerRef.current = L.tileLayer(url, { attribution: attr }).addTo(mapInstanceRef.current);
  };

  // Centralizar visão geral do Brasil
  const handleResetViewBrazil = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([-15.78, -47.92], 5, { duration: 1.2 });
    }
  };

  // Atualização das Camadas, Círculos de Raio e Marcadores
  const updateMapLayers = () => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersRef.current.clear();
    markersLayerRef.current.clearLayers();
    circleLayerRef.current.clearLayers();
    routeLineLayerRef.current.clearLayers();

    const bounds = L.latLngBounds();

    // Raio de Origem (Azul)
    if (originCoords) {
      const circle = L.circle([originCoords.lat, originCoords.lng], {
        color: '#A67142',
        fillColor: '#A67142',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '4, 4',
        radius: originRadius * 1000
      });
      circle.addTo(circleLayerRef.current);
      bounds.extend(circle.getBounds());
    }

    // Raio de Destino (Vermelho/Rosa)
    if (destinationCoords) {
      const circle = L.circle([destinationCoords.lat, destinationCoords.lng], {
        color: '#DC2626',
        fillColor: '#EF4444',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '4, 4',
        radius: destinationRadius * 1000
      });
      circle.addTo(circleLayerRef.current);
      bounds.extend(circle.getBounds());
    }

    // Plotagem das Cargas
    filteredLoads.forEach(load => {
      if (load.originCoords) {
        const client = clients.find(cl => cl.id === load.clientId);
        const product = products.find(p => p.id === load.productId);
        const remainingVolume = load.totalVolume - load.loadedVolume;
        const hasToll = load.driverFreightHasToll || load.freightLegs?.some(l => l.driverFreightHasToll);
        const tollText = hasToll ? ' + Ped' : '';
        const priceDisplay = (load.driverFreightValuePerTon && load.driverFreightValuePerTon > 0)
          ? `R$ ${load.driverFreightValuePerTon.toFixed(2)}${tollText}/ton`
          : 'A combinar';

        const isCurrentSelected = selectedCargo?.id === load.id;

        // Custom HTML Icon para um visual deslumbrante
        const customHtmlIcon = L.divIcon({
          className: 'custom-map-pin',
          html: `
            <div style="
              width: 34px; 
              height: 34px; 
              background: ${isCurrentSelected ? '#A67142' : '#1C1A18'}; 
              border: 3px solid #ffffff; 
              border-radius: 50%; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              color: white; 
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              cursor: pointer;
              transition: transform 0.2s;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
                <path d="M15 18H9"/>
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
                <circle cx="17" cy="18" r="2"/>
                <circle cx="7" cy="18" r="2"/>
              </svg>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([load.originCoords.lat, load.originCoords.lng], { icon: customHtmlIcon });
        
        marker.on('click', () => {
          setSelectedCargo(load);
        });

        marker.addTo(markersLayerRef.current);
        markersRef.current.set(load.id, marker);
        bounds.extend([load.originCoords.lat, load.originCoords.lng]);
      }
    });

    // Se houver carga selecionada com origem e destino, desenha a linha de rota
    if (selectedCargo?.originCoords && selectedCargo?.destinationCoords) {
      const latlngs = [
        [selectedCargo.originCoords.lat, selectedCargo.originCoords.lng],
        [selectedCargo.destinationCoords.lat, selectedCargo.destinationCoords.lng]
      ];

      const polyline = L.polyline(latlngs, {
        color: '#A67142',
        weight: 3,
        opacity: 0.8,
        dashArray: '6, 8',
      }).addTo(routeLineLayerRef.current);

      bounds.extend(latlngs[0]);
      bounds.extend(latlngs[1]);
    }

    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  };

  useEffect(() => {
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateMapLayers();
  }, [filteredLoads, originCoords, destinationCoords, selectedCargo, originRadius, destinationRadius]);

  // Ação de Pesquisa por Raio
  const handleSearch = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();
    if (!originQuery.trim() && !destinationQuery.trim()) {
      setOriginCoords(null);
      setDestinationCoords(null);
      setFilteredLoads([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [originResult, destinationResult] = await Promise.all([
        geocodeCity(originQuery),
        geocodeCity(destinationQuery)
      ]);
      
      setOriginCoords(originResult || null);
      setDestinationCoords(destinationResult || null);
      
      if (!originResult && originQuery.trim()) {
        setError(prev => (prev ? prev + ` Origem não encontrada.` : `Origem não encontrada.`));
      }
      if (!destinationResult && destinationQuery.trim()) {
        setError(prev => (prev ? prev + ` Destino não encontrado.` : `Destino não encontrado.`));
      }
    } finally {
      setLoading(false);
    }
  };
  
  const formatAllowedVehicleTypes = (allowed?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]): string => {
    if (!allowed || allowed.length === 0) return 'Qualquer Conjunto';
    const allBodyTypes = allowed.flatMap(type => type.bodyTypes);
    const uniqueBodyTypes = [...new Set(allBodyTypes)];
    return uniqueBodyTypes.join(', ');
  };

  // Compartilhar Cargas via WhatsApp
  const handleShareFilteredLoads = () => {
    if (filteredLoads.length === 0) {
      showToast('Nenhuma carga no resultado para divulgar.', 'warning');
      return;
    }
    const header = '🌐 *DLLOG TRANSPORTES — CARGAS DISPONÍVEIS* 🌐\n';
    const loadsText = filteredLoads.map(load => {
      const product = products.find(p => p.id === load.productId)?.name?.toUpperCase() || 'DIVERSOS';
      const origin = load.origin.toUpperCase();
      const destination = load.destination.toUpperCase();
      const hasToll = load.driverFreightHasToll || load.freightLegs?.some(l => l.driverFreightHasToll);
      const tollText = hasToll ? ' + Pedágio' : '';
      const price = (load.driverFreightValuePerTon && load.driverFreightValuePerTon > 0)
        ? `R$ ${load.driverFreightValuePerTon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${tollText}`
        : 'A combinar';
      const bodyTypes = formatAllowedVehicleTypes(load.allowedVehicleTypes);
      const rem = (load.totalVolume - load.loadedVolume).toFixed(1);
      
      let text = `📍 *${origin}* ➔ *${destination}*\n🌾 Produto: ${product}\n💰 Frete Motorista: ${price}\n⚖️ Volume Disponível: ${rem} ton\n🚛 Conjuntos: ${bodyTypes}`;
      return text;
    }).join('\n\n────────────────\n\n');

    navigator.clipboard.writeText(header + '\n' + loadsText).then(() => {
      setCopyButtonText('Copiado!');
      showToast('Texto de divulgação copiado para a área de transferência!', 'success');
      setTimeout(() => setCopyButtonText('Divulgar'), 3000);
    }).catch(() => {
      showToast('Não foi possível copiar o texto.', 'error');
    });
  };

  const handleSidebarItemClick = (load: Cargo) => {
    setSelectedCargo(load);
    const marker = markersRef.current.get(load.id);
    if (marker && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(marker.getLatLng(), 9, {
        animate: true,
        duration: 1
      });
    }
  };

  // KPIs Globais das Cargas do Mapa
  const mapKpis = useMemo(() => {
    const totalCargas = filteredLoads.length;
    const totalVolume = filteredLoads.reduce((acc, c) => acc + (c.totalVolume - c.loadedVolume), 0);
    const validFreights = filteredLoads.filter(c => c.driverFreightValuePerTon > 0);
    const avgFreight = validFreights.length > 0
      ? validFreights.reduce((acc, c) => acc + c.driverFreightValuePerTon, 0) / validFreights.length
      : 0;
    const uniqueCities = new Set(filteredLoads.map(c => c.origin)).size;

    return { totalCargas, totalVolume, avgFreight, uniqueCities };
  }, [filteredLoads]);

  // Sincronização de Coordenadas
  const handleSyncAllCargos = async () => {
    if (isDemo) return;
    if (!window.confirm('Deseja buscar coordenadas para todas as cargas que ainda não possuem?')) return;
    
    setSyncingAll(true);
    let updatedCount = 0;
    
    try {
      const cargosToUpdate: Cargo[] = [];
      
      for (const cargo of cargos) {
        if (!cargo.originCoords || !cargo.destinationCoords) {
          const [origin, destination] = await Promise.all([
            geocodeCity(cargo.origin),
            geocodeCity(cargo.destination)
          ]);
          
          if (origin || destination) {
            cargosToUpdate.push({
              ...cargo,
              originCoords: origin || cargo.originCoords,
              destinationCoords: destination || cargo.destinationCoords
            });
            updatedCount++;
          }
          if (updatedCount % 2 === 0) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
      }
      
      if (cargosToUpdate.length > 0) {
        await upsertManyCargos(cargosToUpdate);
        showToast(`${updatedCount} cargas atualizadas com coordenadas no mapa!`, 'success');
        updateMapLayers();
      } else {
        showToast('Todas as cargas já possuem coordenadas registradas.', 'info');
      }
    } catch (err) {
      showToast('Erro ao sincronizar coordenadas.', 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 max-w-[1700px] mx-auto w-full px-2 sm:px-4 pb-6">
      <style>{`
        .custom-cargo-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-cargo-scrollbar::-webkit-scrollbar-track {
          background: rgba(156, 163, 175, 0.15);
          border-radius: 9999px;
          margin: 4px 0;
        }
        .custom-cargo-scrollbar::-webkit-scrollbar-thumb {
          background-color: #A67142;
          border-radius: 9999px;
        }
        .custom-cargo-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #A67142;
        }
        .dark .custom-cargo-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.7);
        }
        .dark .custom-cargo-scrollbar::-webkit-scrollbar-thumb {
          background-color: #C08957;
        }
      `}</style>
      <Header title="Mapa Operacional Logístico" />
      
      {/* BARRA DE KPIS OPERACIONAIS SUPERIORES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Cargas no Raio</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{mapKpis.totalCargas}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Volume Restante</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {mapKpis.totalVolume.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <span className="text-xs font-normal">ton</span>
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Frete Médio / Ton</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400">
              {mapKpis.avgFreight > 0 ? `R$ ${mapKpis.avgFreight.toFixed(2)}` : 'A combinar'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Origens Conectadas</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{mapKpis.uniqueCities} cidades</p>
          </div>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: MAPA + SIDEBAR CONSOLIDADA */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
        
        {/* COLUNA ESQUERDA: MAPA INTERATIVO AMPLIADO */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          <div className={`relative bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 transition-all ${
            isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-32px)]' : 'h-[520px]'
          }`}>
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* CONTROLES FLUTUANTES SUPERIORES ESQUERDOS: CAMADAS & VISÃO */}
            <div className="absolute top-4 left-4 z-[400] flex items-center gap-2">
              <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-1 rounded-2xl shadow-md border border-gray-200/80 dark:border-gray-700 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSwitchLayer('streets')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTileLayer === 'streets'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title="Visualização Mapa de Ruas"
                >
                  🗺️ Ruas
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchLayer('satellite')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTileLayer === 'satellite'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title="Visualização Satélite"
                >
                  🛰️ Satélite
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchLayer('dark')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTileLayer === 'dark'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title="Visualização Noturna / Dark"
                >
                  🌙 Escuro
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetViewBrazil}
                className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-md border border-gray-200/80 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-amber-600 flex items-center gap-1.5 transition-all"
                title="Enquadrar Visão do Brasil"
              >
                <Compass className="w-4 h-4 text-amber-600" />
                <span className="hidden sm:inline">Visão Brasil</span>
              </button>
            </div>

            {/* BOTÃO EXPANDIR / TELA CHEIA */}
            <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullscreen(prev => !prev)}
                className="p-2.5 rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md border border-gray-200/80 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:text-amber-600 transition-all"
                title={isFullscreen ? "Restaurar tamanho" : "Expandir mapa"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {/* LEGENDA FLUTUANTE INFERIOR ESQUERDA */}
            <div className="absolute bottom-4 left-4 z-[400] bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-md border border-gray-200/80 dark:border-gray-700 flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="w-3 h-3 rounded-full bg-amber-600 ring-2 ring-amber-300" />
                Carga / Origem
              </span>
              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <span className="w-3 h-3 rounded-full bg-red-600 ring-2 ring-red-300" />
                Destino
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <span className="w-4 h-0.5 border-b-2 border-dashed border-amber-500" />
                Trajeto
              </span>
            </div>
          </div>

          {/* PAINEL INFERIOR: INSPETOR DE CARGA E ROTA SELECIONADA */}
          {selectedCargo ? (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-amber-200 dark:border-amber-800/80 shadow-md relative overflow-hidden animate-in fade-in">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                      Carga #{selectedCargo.sequenceId}
                    </span>
                    <h3 className="text-base font-black text-gray-900 dark:text-white uppercase">
                      {clients.find(c => c.id === selectedCargo.clientId)?.nomeFantasia || 'Cliente'} — {products.find(p => p.id === selectedCargo.productId)?.name || 'Carga Agrícola/Industrial'}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Detalhes operacionais completos e parâmetros para fechamento de frete
                  </p>
                </div>

                {/* Ações Rápidas em Destaque */}
                <div className="flex items-center gap-2">
                  {!isDemo && (
                    <button
                      type="button"
                      onClick={() => handleOpenNewShipmentModal(selectedCargo)}
                      className="btn-premium px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Lançar Embarque Nesta Carga
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const text = `📍 ${selectedCargo.origin} x ${selectedCargo.destination}\n🌾 ${products.find(p => p.id === selectedCargo.productId)?.name || ''}\n💰 Frete: R$ ${selectedCargo.driverFreightValuePerTon?.toFixed(2) || '0.00'}/ton\n⚖️ Volume: ${(selectedCargo.totalVolume - selectedCargo.loadedVolume).toFixed(1)} ton`;
                      navigator.clipboard.writeText(text);
                      showToast('Dados da carga copiados para o WhatsApp!', 'success');
                    }}
                    className="p-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                    title="Copiar texto para WhatsApp"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCargo(null)}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Limpar seleção"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid de Detalhes da Carga Selecionada */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                
                {/* ROTA */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/60 to-amber-50/40 dark:from-amber-950/20 dark:to-amber-950/10 border border-amber-200/70 dark:border-amber-900/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5" />
                    Rota Operacional
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      {selectedCargo.origin}
                    </p>
                    <p className="text-[11px] text-gray-400 pl-3.5">➔ ➔ ➔</p>
                    <p className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-600" />
                      {selectedCargo.destination}
                    </p>
                  </div>
                </div>

                {/* VOLUME & SALDO */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/60 to-teal-50/40 dark:from-emerald-950/20 dark:to-teal-950/10 border border-emerald-200/70 dark:border-emerald-900/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    Progresso de Volume
                  </p>
                  <div className="flex justify-between text-xs font-black text-gray-900 dark:text-white">
                    <span>Saldo: {(selectedCargo.totalVolume - selectedCargo.loadedVolume).toFixed(1)} ton</span>
                    <span className="text-gray-400 text-[10px]">Total: {selectedCargo.totalVolume} t</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (selectedCargo.loadedVolume / (selectedCargo.totalVolume || 1)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Carregado: {selectedCargo.loadedVolume.toFixed(1)} ton ({((selectedCargo.loadedVolume / (selectedCargo.totalVolume || 1)) * 100).toFixed(0)}%)
                  </p>
                </div>

                {/* VALORES DO FRETE */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/60 to-purple-50/40 dark:from-amber-950/20 dark:to-purple-950/10 border border-amber-200/70 dark:border-amber-900/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Valores Unitários
                  </p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">
                    {selectedCargo.driverFreightValuePerTon > 0 
                      ? `R$ ${selectedCargo.driverFreightValuePerTon.toFixed(2)}` 
                      : 'A combinar'}
                    <span className="text-xs font-normal text-gray-500"> /ton</span>
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Pedágio: {selectedCargo.driverFreightHasToll ? '🟢 Incluso / Pago' : '⚪ Sem pedágio'}
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-300 font-bold mt-1">
                    ~R$ {((selectedCargo.driverFreightValuePerTon || 0) * 37).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} (Truck 37t)
                  </p>
                </div>

                {/* VEÍCULOS & EXIGÊNCIAS */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-gray-50 to-slate-100/60 dark:from-gray-800 dark:to-gray-800/60 border border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    Conjuntos e Carrocerias
                  </p>
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200 line-clamp-2">
                    {formatAllowedVehicleTypes(selectedCargo.allowedVehicleTypes)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {selectedCargo.requiresScheduling && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                        Agendamento
                      </span>
                    )}
                    {selectedCargo.requiresTracker && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                        Rastreador
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-amber-50/40 dark:bg-amber-950/20 rounded-3xl border-2 border-dashed border-amber-200 dark:border-amber-900/50 p-6 flex flex-col items-center justify-center text-center gap-2">
              <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300">
                <Compass className="w-6 h-6 animate-spin-slow" />
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                Nenhuma carga selecionada no mapa
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
                Clique em qualquer marcador no mapa ou em um item da lista à direita para inspecionar rotas, volumes, valores de frete e lançar novos embarques.
              </p>
            </div>
          )}

        </div>

        {/* COLUNA DIREITA: SIDEBAR CONSOLIDADA (FILTRO POR RAIO FIXO NO TOPO + LISTA ROLÁVEL DE CARGAS) */}
        <aside className="w-full lg:w-[420px] flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 h-full max-h-[calc(100vh-180px)] lg:max-h-none">
          
          {/* JANELA SUPERIOR FIXA: FILTRO POR RAIO (PERMANECE SEMPRE VISÍVEL) */}
          <div className="p-3.5 border-b border-gray-200/80 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 flex-shrink-0 space-y-2.5">
            
            {/* Título do Filtro e Raio Atual */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                  <Sliders className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Filtro por Raio
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Origem e abrangência das cargas
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                {!isDemo && (
                  <button 
                    type="button"
                    onClick={handleSyncAllCargos}
                    disabled={syncingAll}
                    title="Sincronizar Coordenadas das Cargas"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin text-amber-600' : ''}`} />
                  </button>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 font-mono">
                  {originRadius} km
                </span>
              </div>
            </div>

            {/* Input da Cidade de Origem */}
            <form onSubmit={handleSearch} className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
                  <input 
                    type="text" 
                    list="city-suggestions"
                    value={originQuery} 
                    onChange={(e) => setOriginQuery(e.target.value)} 
                    placeholder="Cidade de Origem (Ex: Catalão)" 
                    className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 outline-none text-gray-900 dark:text-white" 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 active:scale-95" 
                  title="Pesquisar cargas no raio desta cidade"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Buscar</span>
                </button>
              </div>

              {/* Slider de Raio + Presets */}
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <span>Alcance do Raio</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">{originRadius} km</span>
                </div>

                <input 
                  type="range" 
                  min="50" 
                  max="1000" 
                  step="25" 
                  value={originRadius} 
                  onChange={(e) => setOriginRadius(parseInt(e.target.value))} 
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-600" 
                />

                <div className="flex items-center justify-between gap-1 pt-0.5">
                  {[50, 150, 250, 500].map(km => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => setOriginRadius(km)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all text-center cursor-pointer ${
                        originRadius === km 
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle de Destino Opcional (Colapsável) */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowDestinationFilter(prev => !prev)}
                  className="text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showDestinationFilter ? 'rotate-180' : ''}`} />
                  <span>{showDestinationFilter ? 'Ocultar Filtro de Destino' : '+ Filtro de Destino (Opcional)'}</span>
                  {destinationQuery && <span className="text-red-500 font-mono">({destinationQuery})</span>}
                </button>

                {showDestinationFilter && (
                  <div className="mt-2 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2 animate-in fade-in">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-600" />
                        Destino da Carga
                      </label>
                      <span className="text-[10px] font-bold text-red-600 font-mono">{destinationRadius} km</span>
                    </div>

                    <input 
                      type="text" 
                      list="city-suggestions"
                      value={destinationQuery} 
                      onChange={(e) => setDestinationQuery(e.target.value)} 
                      placeholder="Cidade de Destino (Ex: Santos, SP)" 
                      className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-red-500/20 outline-none text-gray-900 dark:text-white" 
                    />

                    <input 
                      type="range" 
                      min="50" 
                      max="1000" 
                      step="25" 
                      value={destinationRadius} 
                      onChange={(e) => setDestinationRadius(parseInt(e.target.value))} 
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600" 
                    />
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* SUB-HEADER: CARGAS LOCALIZADAS & BOTÃO DIVULGAR */}
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700/80 bg-white dark:bg-gray-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                {filteredLoads.length} carga(s) localizada(s)
              </span>
            </div>

            {filteredLoads.length > 0 && (
              <button 
                type="button"
                onClick={handleShareFilteredLoads} 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Copiar texto formatado de todas as cargas no raio para o WhatsApp"
              >
                <Copy className="w-3.5 h-3.5" />
                {copyButtonText}
              </button>
            )}
          </div>

          {/* CAMPO DAS CARGAS DISPONÍVEIS: CONTAINER ROLÁVEL COM BARRA DE ROLAGEM DEDICADA */}
          <div 
            className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 custom-cargo-scrollbar pr-2"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#A67142 rgba(156, 163, 175, 0.2)'
            }}
          >
            {filteredLoads.length > 0 ? (
                  filteredLoads.map(load => {
                    const client = clients.find(c => c.id === load.clientId);
                    const product = products.find(p => p.id === load.productId);
                    const remainingVolume = load.totalVolume - load.loadedVolume;
                    const hasToll = load.driverFreightHasToll || load.freightLegs?.some(l => l.driverFreightHasToll);
                    const tollText = hasToll ? ' + Pedágio' : '';
                    const isSelected = selectedCargo?.id === load.id;

                    return (
                      <div 
                        key={load.id} 
                        onClick={() => handleSidebarItemClick(load)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-500 shadow-sm'
                            : 'bg-gray-50/70 dark:bg-gray-900/40 border-gray-200/80 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700'
                        }`}
                      >
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${isSelected ? 'bg-amber-600' : 'bg-gray-300 dark:bg-gray-700'}`} />

                        <div className="flex justify-between items-start mb-1 pl-1">
                          <p className="text-xs font-black text-amber-700 dark:text-amber-300 truncate max-w-[190px] uppercase">
                            {client?.nomeFantasia || 'Cliente'}
                          </p>
                          <span className="text-[10px] font-black text-gray-400">#{load.sequenceId}</span>
                        </div>

                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 pl-1 truncate">
                          {product?.name || 'Carga Diversa'}
                        </p>
                        
                        <div className="flex flex-col gap-1 pl-1 text-xs font-bold text-gray-800 dark:text-gray-200">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
                            <span className="truncate">{load.origin}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                            <span className="truncate">{load.destination}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-dashed border-gray-200 dark:border-gray-700 pl-1">
                          <span className={`text-xs font-black ${load.driverFreightValuePerTon > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {load.driverFreightValuePerTon > 0 ? `R$ ${load.driverFreightValuePerTon.toFixed(2)}${tollText}` : 'A combinar'}
                          </span>
                          <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                            {remainingVolume.toFixed(1)} <span className="text-[10px] text-gray-400 font-normal">ton</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 px-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                    <MapPin className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-400">Nenhuma carga no raio</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Aumente o raio em km ou altere a cidade de origem acima.</p>
                  </div>
                )}
          </div>
        </aside>

      </div>

      {/* MODAL DE CRIAÇÃO DE EMBARQUE */}
      <NewShipmentModal
        isOpen={isShipmentModalOpen}
        onClose={handleCloseShipmentModal}
        onSave={handleSaveShipment}
        cargo={selectedCargoForShipment}
        drivers={drivers}
        owners={owners}
        clients={clients}
        vehicles={vehicles}
        currentUser={currentUser}
        shipments={shipments}
        users={users}
      />
    </div>
  );
};

export default OperationalMapPage;
