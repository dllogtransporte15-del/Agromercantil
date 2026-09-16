import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { User, Cargo, Shipment, Product, Driver, Vehicle } from '../types';
import { CargoStatus, ShipmentStatus } from '../types';
import { supabase } from '../supabase';
import { upsertDriver } from '../lib/db';
import { saveDriverLastLocationToDb } from '../hooks/useDriverLocations';
import { 
  Package, 
  FileText, 
  Map as MapIcon, 
  User as UserIcon, 
  Search, 
  Compass, 
  MapPin, 
  Truck, 
  LogOut, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  Key, 
  Phone, 
  CreditCard,
  Layers,
  ArrowRight
} from 'lucide-react';
import { getCoordsSync, geocodeCity } from '../utils/geocoding';

declare const L: any;

interface DriverPortalProps {
  currentUser: User;
  onLogout: () => void;
  cargos: Cargo[];
  shipments: Shipment[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  onRequestLoadOrder: (cargo: Cargo) => void;
  onUpdateShipmentAttachment?: (shipmentId: string, data: any) => Promise<void>;
  companyLogo: string | null;
  onOpenPasswordChange?: () => void;
}

// Haversine formula for distance in km
const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const p180 = Math.PI / 180;
  const dLat = (lat2 - lat1) * p180;
  const dLon = (lon2 - lon1) * p180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * p180) * Math.cos(lat2 * p180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

// Filter driver documents to ONLY allowed categories:
// - Nota fiscal
// - Cte
// - Mdfe
// - Carta Frete
// - Agendamento (Se houver)
interface DriverDocItem {
  key: string;
  label: string;
  url: string;
}

const getDriverVisibleDocuments = (documents?: Record<string, any>): DriverDocItem[] => {
  if (!documents) return [];

  const allowedCategories: { label: string; matchers: string[] }[] = [
    { label: 'Nota Fiscal', matchers: ['nota fiscal', 'nf-e', 'nfe'] },
    { label: 'CT-e', matchers: ['ct-e', 'cte', 'documentos de viagem'] },
    { label: 'MDF-e', matchers: ['mdf-e', 'mdfe'] },
    { label: 'Carta Frete', matchers: ['carta frete', 'carta_frete', 'contrato de frete'] },
    { label: 'Agendamento', matchers: ['agendamento', 'comprovante de agendamento'] },
  ];

  const result: DriverDocItem[] = [];

  Object.entries(documents).forEach(([key, val]) => {
    if (!val) return;
    const keyLower = key.toLowerCase().trim();

    // Ignore internal metadata fields
    if (
      keyLower.includes('number') ||
      keyLower.includes('date') ||
      keyLower.includes('cost') ||
      keyLower.includes('type') ||
      keyLower.includes('code') ||
      keyLower.includes('key') ||
      keyLower.includes('method') ||
      keyLower.includes('percentage') ||
      keyLower.includes('value')
    ) {
      return;
    }

    const category = allowedCategories.find(cat =>
      cat.matchers.some(m => keyLower === m || keyLower.includes(m))
    );

    if (!category) return;

    let url: string | null = null;
    if (typeof val === 'string') {
      if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:') || val.startsWith('/')) {
        url = val;
      }
    } else if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === 'string' && (first.startsWith('http://') || first.startsWith('https://') || first.startsWith('data:') || first.startsWith('/'))) {
        url = first;
      } else if (first && typeof first === 'object' && first.url) {
        url = first.url;
      }
    } else if (typeof val === 'object' && val.url) {
      url = val.url;
    }

    if (url) {
      result.push({
        key,
        label: category.label,
        url,
      });
    }
  });

  return result;
};

const DriverPortal: React.FC<DriverPortalProps> = ({
  currentUser,
  onLogout,
  cargos,
  shipments,
  products,
  drivers,
  vehicles,
  onRequestLoadOrder,
  onUpdateShipmentAttachment,
  companyLogo,
  onOpenPasswordChange
}) => {
  const [activeNavTab, setActiveNavTab] = useState<'cargas' | 'fretes' | 'mapa' | 'perfil'>('cargas');

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [originCity, setOriginCity] = useState('Catalão, GOIÁS');
  const [originRadius, setOriginRadius] = useState(200);
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationRadius, setDestinationRadius] = useState(750);
  
  // Driver current coords
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number }>({ lat: -18.1658, lng: -47.9463 });
  const [isGpsActive, setIsGpsActive] = useState(false);

  // AUTOMATIC REALTIME GPS TRACKING & PRESENCE BROADCAST
  useEffect(() => {
    if (!currentUser) return;

    let watchId: number | null = null;
    let fallbackInterval: any = null;

    const channel = supabase.channel('driver_locations_monitor');

    const sendLocationPayload = async (lat: number, lng: number, speed: number | null = null, heading: number | null = null) => {
      setDriverCoords({ lat, lng });
      setIsGpsActive(true);

      const locationPayload = {
        driverId: currentUser.id,
        driverName: currentUser.name,
        lat,
        lng,
        speed,
        heading,
        timestamp: new Date().toISOString(),
        isAppActive: true,
      };

      console.log('[DriverPortal] Transmitindo localização GPS:', lat, lng);
      await channel.track({ location: locationPayload, ...locationPayload });
      saveDriverLastLocationToDb(locationPayload);
    };

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Enviar sinal inicial de presença online
        await channel.track({
          driverId: currentUser.id,
          driverName: currentUser.name,
          isAppActive: true,
          timestamp: new Date().toISOString(),
        });

        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => sendLocationPayload(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.heading),
            (err) => console.warn('[DriverPortal] GPS inicial aviso:', err),
            { enableHighAccuracy: true, timeout: 10000 }
          );

          watchId = navigator.geolocation.watchPosition(
            (pos) => sendLocationPayload(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.heading),
            (err) => console.warn('[DriverPortal] GPS watch aviso:', err),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
          );

          // Fallback interval (a cada 10 segundos)
          fallbackInterval = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
              (pos) => sendLocationPayload(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.heading),
              () => {},
              { enableHighAccuracy: true, timeout: 8000 }
            );
          }, 10000);
        }
      }
    });

    return () => {
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [currentUser]);
  
  // Expanded document drawers in History
  const [expandedShipments, setExpandedShipments] = useState<Record<string, boolean>>({});

  // Leaflet Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  // Driver details
  const currentDriver = useMemo(() => {
    return drivers.find(d => d.cpf === currentUser.email || d.id === currentUser.id || d.name.toLowerCase() === currentUser.name.toLowerCase());
  }, [drivers, currentUser]);

  // Mark driver as having the app in database
  useEffect(() => {
    if (currentDriver && !currentDriver.has_app) {
      upsertDriver({ ...currentDriver, has_app: true })
        .catch(err => console.warn('[DriverPortal] Erro ao marcar has_app:', err));
    }
  }, [currentDriver]);

  const currentVehicle = useMemo(() => {
    if (!currentDriver) return vehicles[0] || null;
    return vehicles.find(v => v.driverId === currentDriver.id) || vehicles[0] || null;
  }, [vehicles, currentDriver]);

  // Product map for quick lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Available open cargos: todas as cargas que não estiverem Suspensas/Fechadas e tiverem Programação lançada
  const availableCargos = useMemo(() => {
    return cargos.filter(c => {
      const isNotSuspended = c.status !== CargoStatus.Suspensa && c.status !== CargoStatus.Fechada;
      const hasSchedule = Array.isArray(c.dailySchedule) && c.dailySchedule.length > 0;
      return isNotSuspended && hasSchedule;
    });
  }, [cargos]);

  // Filtered cargos by search query
  const filteredCargos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return availableCargos;
    return availableCargos.filter(c => {
      const prod = productMap.get(c.productId)?.name || '';
      return (
        c.origin.toLowerCase().includes(q) ||
        c.destination.toLowerCase().includes(q) ||
        prod.toLowerCase().includes(q) ||
        (c.observations && c.observations.toLowerCase().includes(q))
      );
    });
  }, [availableCargos, searchQuery, productMap]);

  // Driver shipments
  const myShipments = useMemo(() => {
    const cpf = (currentUser.email || '').replace(/\D/g, '');
    const driverName = (currentUser.name || '').toLowerCase();
    return shipments.filter(s => {
      const sCpf = (s.driverCpf || '').replace(/\D/g, '');
      const sName = (s.driverName || '').toLowerCase();
      return (cpf && sCpf === cpf) || (sName && sName.includes(driverName)) || (currentDriver && s.driverName === currentDriver.name);
    });
  }, [shipments, currentUser, currentDriver]);

  // Active vs Completed shipments
  const activeShipments = useMemo(() => {
    return myShipments.filter(s => s.status !== ShipmentStatus.Finalizado && s.status !== ShipmentStatus.Cancelado);
  }, [myShipments]);

  const completedShipments = useMemo(() => {
    return myShipments.filter(s => s.status === ShipmentStatus.Finalizado);
  }, [myShipments]);

  // Geocode origin & destination for Map view
  const originCoordsObj = useMemo(() => {
    if (!originCity) return driverCoords;
    const clean = originCity.split(',')[0].trim();
    return getCoordsSync(clean) || driverCoords;
  }, [originCity, driverCoords]);

  const destinationCoordsObj = useMemo(() => {
    if (!destinationCity) return null;
    const clean = destinationCity.split(',')[0].trim();
    return getCoordsSync(clean);
  }, [destinationCity]);

  // Map Filtered Opportunities
  const mapFilteredOpportunities = useMemo(() => {
    return availableCargos.filter(c => {
      const cOriginCoords = c.originCoords || getCoordsSync(c.origin) || driverCoords;
      const distFromOrigin = getDistanceKm(originCoordsObj.lat, originCoordsObj.lng, cOriginCoords.lat, cOriginCoords.lng);
      
      let matchDest = true;
      if (destinationCoordsObj) {
        const cDestCoords = c.destinationCoords || getCoordsSync(c.destination) || driverCoords;
        const distFromDest = getDistanceKm(destinationCoordsObj.lat, destinationCoordsObj.lng, cDestCoords.lat, cDestCoords.lng);
        matchDest = distFromDest <= destinationRadius;
      }

      return distFromOrigin <= originRadius && matchDest;
    });
  }, [availableCargos, originCoordsObj, originRadius, destinationCoordsObj, destinationRadius, driverCoords]);

  // Initialize/Update Leaflet Map when Map tab is active
  useEffect(() => {
    if (activeNavTab !== 'mapa') return;

    // Small delay to ensure container DOM is ready
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;
      if (typeof L === 'undefined') return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false
        }).setView([originCoordsObj.lat, originCoordsObj.lng], 9);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: 'topleft' }).addTo(map);

        mapInstanceRef.current = map;
        markersGroupRef.current = L.layerGroup().addTo(map);
      } else {
        mapInstanceRef.current.setView([originCoordsObj.lat, originCoordsObj.lng], 9);
      }

      // Render markers
      if (markersGroupRef.current) {
        markersGroupRef.current.clearLayers();

        // 1. Driver Location Marker (Cyan/Blue dot)
        const driverIcon = L.divIcon({
          className: 'custom-driver-pin',
          html: `<div style="background:#0284c7; width:22px; height:22px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 0 12px rgba(2,132,199,0.8);"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        L.marker([driverCoords.lat, driverCoords.lng], { icon: driverIcon })
          .addTo(markersGroupRef.current)
          .bindPopup(`<b>Sua Localização</b><br/>${originCity}`);

        // 2. Load Opportunity Markers
        mapFilteredOpportunities.forEach(cargo => {
          const coords = cargo.originCoords || getCoordsSync(cargo.origin) || driverCoords;
          const prodName = productMap.get(cargo.productId)?.name || 'Carga';
          const loadIcon = L.divIcon({
            className: 'custom-load-pin',
            html: `<div style="background:#2563eb; color:#fff; font-size:10px; font-weight:bold; padding:4px 8px; border-radius:12px; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.4); text-align:center; whitespace:nowrap;">📍 ${cargo.origin} (${prodName})</div>`,
            iconSize: [120, 28],
            iconAnchor: [60, 14]
          });

          L.marker([coords.lat, coords.lng], { icon: loadIcon })
            .addTo(markersGroupRef.current)
            .bindPopup(`
              <div style="font-family:sans-serif; padding:4px;">
                <h4 style="margin:0 0 4px 0; color:#0f172a; font-weight:bold;">${cargo.origin} → ${cargo.destination}</h4>
                <p style="margin:2px 0; font-size:12px; color:#475569;">Produto: <b>${prodName}</b></p>
                <p style="margin:2px 0; font-size:12px; color:#16a34a; font-weight:bold;">R$ ${cargo.driverFreightValuePerTon.toFixed(2)} / ton</p>
              </div>
            `);
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [activeNavTab, originCoordsObj, driverCoords, mapFilteredOpportunities, productMap, originCity]);

  const toggleExpandShipment = (id: string) => {
    setExpandedShipments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#04150e] text-slate-100 font-sans pb-24">
      
      {/* TOP HEADER */}
      <header className="sticky top-0 z-30 bg-[#061e13]/95 backdrop-blur border-b border-emerald-900/60 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          {companyLogo ? (
            <img src={companyLogo} alt="Agromercantil" className="h-8 max-w-[130px] object-contain filter drop-shadow-[0_2px_10px_rgba(22,163,74,0.3)]" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-amber-500 flex items-center justify-center font-black text-white text-lg shadow-md">
                A
              </div>
              <span className="font-bold tracking-tight text-white text-lg">AGROMERCANTIL</span>
            </div>
          )}

          {/* ONLINE STATUS BADGE */}
          <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-500/40 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
            <span className="text-xs font-semibold text-emerald-300 tracking-wide">Motorista Online</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeNavTab === 'mapa' && (
            <button
              onClick={() => setActiveNavTab('cargas')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-sm"
            >
              ← Oportunidades
            </button>
          )}
          <button
            onClick={() => setActiveNavTab('mapa')}
            title="Abrir Mapa Operacional"
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-emerald-400 border border-slate-700/60 transition-colors shadow-sm"
          >
            <Compass className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* MAIN VIEW CONTENT */}
      <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
        
        {/* ========================================================= */}
        {/* TAB 1: CARGAS (LOAD OPPORTUNITIES & SEARCH) */}
        {/* ========================================================= */}
        {activeNavTab === 'cargas' && (
          <div className="space-y-4">
            
            {/* SEARCH INPUT BAR */}
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Pesquisar Carga (Origem, Destino, Produto...)"
                className="w-full bg-[#061e13] text-slate-100 placeholder-slate-400 pl-11 pr-4 py-3 rounded-2xl border border-emerald-900/60 focus:outline-none focus:border-emerald-500 text-sm shadow-inner transition-all"
              />
            </div>

            {/* ORDER & GPS BANNER */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Compass className="w-4 h-4 text-emerald-400" />
                Cargas ordenadas pela mais próxima da sua localização
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 font-semibold text-[10px]">
                GPS Ativo
              </span>
            </div>

            {/* CARGO CARDS LIST */}
            <div className="space-y-3 pt-1">
              {filteredCargos.length === 0 ? (
                <div className="bg-[#061e13] rounded-2xl p-8 text-center border border-emerald-900/60">
                  <Package className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
                  <p className="text-slate-300 font-medium">Nenhuma carga disponível no momento</p>
                  <p className="text-xs text-slate-500 mt-1">Tente ajustar a busca ou confira novamente mais tarde.</p>
                </div>
              ) : (
                filteredCargos.map(cargo => {
                  const prod = productMap.get(cargo.productId);
                  const prodName = prod?.name || 'Carga Geral';
                  
                  // Compute distance approximations
                  const cOriginCoords = cargo.originCoords || getCoordsSync(cargo.origin) || driverCoords;
                  const cDestCoords = cargo.destinationCoords || getCoordsSync(cargo.destination) || driverCoords;
                  
                  const routeDistance = getDistanceKm(cOriginCoords.lat, cOriginCoords.lng, cDestCoords.lat, cDestCoords.lng);
                  const distFromDriver = getDistanceKm(driverCoords.lat, driverCoords.lng, cOriginCoords.lat, cOriginCoords.lng);

                  return (
                    <div 
                      key={cargo.id}
                      className="bg-[#061e13] rounded-2xl p-4 border border-emerald-900/60 shadow-md hover:border-emerald-600/60 transition-all space-y-3"
                    >
                      {/* ROUTE & PRODUCT BADGE */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2 flex-1">
                          {/* ORIGIN */}
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 text-xs shrink-0">
                              📍
                            </div>
                            <span className="font-bold text-slate-100 text-base">{cargo.origin}</span>
                          </div>
                          
                          {/* ROUTE LINE DECORATION */}
                          <div className="ml-3 pl-3 border-l-2 border-dashed border-emerald-900/60 h-2"></div>

                          {/* DESTINATION */}
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xs shrink-0">
                              📍
                            </div>
                            <span className="font-bold text-slate-100 text-base">{cargo.destination}</span>
                          </div>
                        </div>

                        {/* PRODUCT BADGE */}
                        <div className="shrink-0">
                          <span className="uppercase tracking-wider text-[11px] font-bold px-3 py-1 rounded-lg bg-[#03130b] text-emerald-300 border border-emerald-800/60">
                            {prodName}
                          </span>
                        </div>
                      </div>

                      {/* DISTANCE & METRICS */}
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-emerald-900/40">
                        <div>
                          <span className="text-slate-300">Rota: </span>
                          <span className="font-semibold text-emerald-400">{routeDistance > 0 ? `${routeDistance} km` : 'Consulte'}</span>
                          <span className="mx-2 text-slate-600">|</span>
                          <span className="text-slate-400">Está a </span>
                          <span className="font-semibold text-amber-400">{distFromDriver} km</span>
                          <span className="text-slate-400"> de você</span>
                        </div>
                      </div>

                      {/* RATE & ACTION BUTTON */}
                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <span className="text-2xl font-black text-emerald-400">
                            R$ {cargo.driverFreightValuePerTon.toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">/ ton</span>
                        </div>

                        <button
                          onClick={() => onRequestLoadOrder(cargo)}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 transition-all transform active:scale-95"
                        >
                          Solicitar Embarque
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: FRETES (MEUS FRETES E EMBARQUES) */}
        {/* ========================================================= */}
        {activeNavTab === 'fretes' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-emerald-400" />
              Meus Fretes e Embarques
            </h2>

            {/* SECTION 1: EMBARQUES ATIVOS */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                EMBARQUES ATIVOS
              </h3>

              {activeShipments.length === 0 ? (
                <div className="bg-[#061e13] rounded-2xl p-8 text-center border border-emerald-900/60 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-[#03130b] border border-emerald-800/60 flex items-center justify-center mx-auto text-slate-400">
                    <Truck className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-slate-200 font-bold text-base">Nenhum frete em andamento no momento</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Solicite uma carga na aba <span className="text-emerald-400 font-semibold cursor-pointer" onClick={() => setActiveNavTab('cargas')}>"Cargas"</span> para iniciar seu embarque.
                    </p>
                  </div>
                </div>
              ) : (
                activeShipments.map(s => {
                  const cargo = cargos.find(c => c.id === s.cargoId);
                  const isExpanded = !!expandedShipments[s.id];
                  const visibleDocs = getDriverVisibleDocuments(s.documents);

                  return (
                    <div key={s.id} className="bg-[#061e13] rounded-2xl p-4 border border-emerald-900/60 shadow-lg space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                          #{s.id}
                        </span>
                        <span className="px-3 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold text-xs">
                          {s.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-white">
                          {cargo?.origin || 'Origem'} → {cargo?.destination || 'Destino'}
                        </h4>
                        <div className="flex justify-between text-xs text-slate-400 pt-1">
                          <span>Tonelagem: <b className="text-slate-200">{s.shipmentTonnage} ton</b></span>
                          <span>Frete/ton: <b className="text-emerald-400">R$ {s.driverFreightValue.toFixed(2)}</b></span>
                        </div>
                      </div>

                      {/* ACCORDION DROPDOWN FOR DOCUMENTS */}
                      <div className="pt-1 border-t border-emerald-900/40">
                        <button
                          onClick={() => toggleExpandShipment(s.id)}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#03130b] hover:bg-[#04170e] text-slate-300 font-semibold text-xs border border-emerald-900/60 transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-400" />
                            Documentos do Embarque ({visibleDocs.length})
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 rounded-xl bg-[#03130b] border border-emerald-900/60 space-y-2 text-xs">
                            {visibleDocs.length > 0 ? (
                              visibleDocs.map(doc => (
                                <div key={doc.key} className="flex items-center justify-between p-2.5 rounded-lg bg-[#061e13] border border-emerald-900/40">
                                  <span className="text-slate-200 font-bold">{doc.label}</span>
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold text-xs flex items-center gap-1"
                                  >
                                    Ver Documento
                                  </a>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-500 italic text-center py-1">Nenhum documento disponível no momento.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* SECTION 2: HISTÓRICO DE CONCLUÍDOS */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                HISTÓRICO DE CONCLUÍDOS ({completedShipments.length})
              </h3>

              {completedShipments.length === 0 ? (
                <div className="bg-[#061e13] rounded-2xl p-6 text-center border border-emerald-900/60 text-xs text-slate-400">
                  Nenhum frete concluído registrado ainda.
                </div>
              ) : (
                completedShipments.map(s => {
                  const cargo = cargos.find(c => c.id === s.cargoId);
                  const origin = cargo?.origin || 'Origem';
                  const destination = cargo?.destination || 'Destino';
                  const totalValue = s.shipmentTonnage * s.driverFreightValue;
                  const isExpanded = !!expandedShipments[s.id];
                  const visibleDocs = getDriverVisibleDocuments(s.documents);

                  return (
                    <div key={s.id} className="bg-[#061e13] rounded-2xl p-4 border border-emerald-900/60 space-y-3 shadow-md">
                      
                      {/* HEADER */}
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-white">
                          {origin} → {destination}
                        </h4>
                        <span className="px-3 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold text-xs">
                          Concluído
                        </span>
                      </div>

                      {/* METRICS GRID */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-400 block">Valor total:</span>
                          <span className="text-base font-black text-emerald-400">
                            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block">Frete/ton:</span>
                          <span className="text-base font-bold text-amber-400">
                            R$ {s.driverFreightValue.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-emerald-900/40">
                        <span>Tonelagem: <b className="text-slate-200">{s.shipmentTonnage} ton</b></span>
                        <span className="font-mono text-slate-500">#{s.id}</span>
                      </div>

                      {/* ACCORDION DROPDOWN FOR DOCUMENTS */}
                      <div className="pt-1">
                        <button
                          onClick={() => toggleExpandShipment(s.id)}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#03130b] hover:bg-[#04170e] text-slate-300 font-semibold text-xs border border-emerald-900/60 transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-400" />
                            Documentos do Embarque ({visibleDocs.length})
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 rounded-xl bg-[#03130b] border border-emerald-900/60 space-y-2 text-xs">
                            {visibleDocs.length > 0 ? (
                              visibleDocs.map(doc => (
                                <div key={doc.key} className="flex items-center justify-between p-2.5 rounded-lg bg-[#061e13] border border-emerald-900/40">
                                  <span className="text-slate-200 font-bold">{doc.label}</span>
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold text-xs flex items-center gap-1"
                                  >
                                    Ver Documento
                                  </a>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-500 italic text-center py-1">Nenhum documento disponível no momento.</p>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: MAPA OPERACIONAL DE CARGAS */}
        {/* ========================================================= */}
        {activeNavTab === 'mapa' && (
          <div className="space-y-4">
            
            {/* MAP HEADER */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Compass className="w-6 h-6 text-emerald-400" />
                  Mapa Operacional de Cargas
                </h2>
                <p className="text-xs text-slate-400">Explore cargas pelo raio de proximidade no mapa</p>
              </div>
            </div>

            {/* MAP CONTAINER */}
            <div className="relative rounded-2xl overflow-hidden border border-emerald-900/60 shadow-2xl h-72 bg-[#03130b]">
              <div ref={mapContainerRef} className="w-full h-full"></div>

              {/* MAP LEGEND OVERLAY */}
              <div className="absolute top-3 right-3 z-10 bg-[#061e13]/90 backdrop-blur border border-emerald-900/60 rounded-xl px-3 py-2 text-[11px] flex items-center gap-3 shadow-lg">
                <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Você
                </span>
                <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Carga
                </span>
                <span className="flex items-center gap-1.5 text-rose-300 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Origem
                </span>
              </div>
            </div>

            {/* FREIGHT LOCATOR FILTER CARD */}
            <div className="bg-[#061e13] rounded-2xl p-4 border border-emerald-900/60 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Search className="w-4 h-4" />
                  LOCALIZADOR DE FRETES
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold text-[10px]">
                  GPS Ativo
                </span>
              </div>

              {/* ORIGIN CITY & RADIUS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-slate-300 font-medium flex items-center gap-1.5">
                    📍 Sua Localização / Cidade de Origem
                  </label>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold text-[11px] border border-emerald-800/60">
                    {originRadius} km
                  </span>
                </div>
                <input
                  type="text"
                  value={originCity}
                  onChange={e => setOriginCity(e.target.value)}
                  placeholder="Ex: Catalão, GOIÁS"
                  className="w-full bg-[#03130b] text-slate-100 placeholder-slate-500 px-3.5 py-2.5 rounded-xl border border-emerald-900/60 text-sm focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="10"
                  value={originRadius}
                  onChange={e => setOriginRadius(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* DESTINATION CITY & RADIUS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-slate-300 font-medium flex items-center gap-1.5">
                    📍 Cidade de Destino (Opcional)
                  </label>
                  <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-bold text-[11px] border border-rose-800/60">
                    {destinationRadius} km
                  </span>
                </div>
                <input
                  type="text"
                  value={destinationCity}
                  onChange={e => setDestinationCity(e.target.value)}
                  placeholder="Ex: Santos, SP (deixe vazio para todas)"
                  className="w-full bg-[#03130b] text-slate-100 placeholder-slate-500 px-3.5 py-2.5 rounded-xl border border-emerald-900/60 text-sm focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="range"
                  min="50"
                  max="1500"
                  step="50"
                  value={destinationRadius}
                  onChange={e => setDestinationRadius(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* SEARCH RADIUS BUTTON */}
              <button
                onClick={() => {}}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.99]"
              >
                Buscar Oportunidades no Raio
              </button>
            </div>

            {/* OPPORTUNITIES FOUND LIST */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                OPORTUNIDADES ENCONTRADAS ({mapFilteredOpportunities.length})
              </h3>

              {mapFilteredOpportunities.map(cargo => {
                const prodName = productMap.get(cargo.productId)?.name || 'SORGO';
                return (
                  <div key={cargo.id} className="bg-[#061e13] rounded-xl p-3.5 border border-emerald-900/60 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="font-bold text-slate-100 text-sm">{cargo.origin} → {cargo.destination}</span>
                      </div>
                      <div className="text-xs text-emerald-400 font-bold">
                        R$ {cargo.driverFreightValuePerTon.toFixed(2)} / ton
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded bg-[#03130b] text-slate-300 border border-emerald-900/60">
                        {prodName}
                      </span>
                      <button
                        onClick={() => onRequestLoadOrder(cargo)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                      >
                        Solicitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: PERFIL DO MOTORISTA */}
        {/* ========================================================= */}
        {activeNavTab === 'perfil' && (
          <div className="space-y-5">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <UserIcon className="w-6 h-6 text-emerald-400" />
              Meu Perfil
            </h2>

            {/* PROFILE CARD */}
            <div className="bg-[#061e13] rounded-2xl p-5 border border-emerald-900/60 space-y-4 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-600 to-amber-600 flex items-center justify-center font-black text-2xl text-white shadow-md border-2 border-emerald-400/40">
                  {currentUser.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{currentUser.name}</h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {currentDriver?.classification || 'Motorista'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-emerald-900/60">
                <div className="p-3 rounded-xl bg-[#03130b] border border-emerald-900/60 space-y-1">
                  <span className="text-slate-400 font-medium block">CPF / Login:</span>
                  <span className="text-slate-100 font-mono font-bold text-sm">{currentUser.email}</span>
                </div>

                <div className="p-3 rounded-xl bg-[#03130b] border border-emerald-900/60 space-y-1">
                  <span className="text-slate-400 font-medium block">CNH:</span>
                  <span className="text-slate-100 font-mono font-bold text-sm">{currentDriver?.cnh || 'Não cadastrada'}</span>
                </div>

                <div className="p-3 rounded-xl bg-[#03130b] border border-emerald-900/60 space-y-1">
                  <span className="text-slate-400 font-medium block">Telefone:</span>
                  <span className="text-slate-100 font-bold text-sm">{currentUser.phone || currentDriver?.phone || 'Não informado'}</span>
                </div>

                <div className="p-3 rounded-xl bg-[#03130b] border border-emerald-900/60 space-y-1">
                  <span className="text-slate-400 font-medium block">Veículo Ativo:</span>
                  <span className="text-slate-100 font-bold text-sm">{currentVehicle ? `${currentVehicle.plate} (${currentVehicle.setType})` : 'Nenhum'}</span>
                </div>
              </div>
            </div>

            {/* ACTIONS CARD */}
            <div className="space-y-3">
              {onOpenPasswordChange && (
                <button
                  onClick={onOpenPasswordChange}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#061e13] hover:bg-[#08281a] border border-emerald-900/60 text-slate-200 font-bold text-sm transition-all"
                >
                  <span className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-emerald-400" />
                    Alterar Minha Senha
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-500" />
                </button>
              )}

              <button
                onClick={onLogout}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/50 text-rose-300 font-bold text-sm transition-all"
              >
                <span className="flex items-center gap-3">
                  <LogOut className="w-5 h-5 text-rose-400" />
                  Sair do Aplicativo
                </span>
                <ChevronRight className="w-5 h-5 text-rose-500" />
              </button>
            </div>

          </div>
        )}

      </main>

      {/* ========================================================= */}
      {/* FIXED BOTTOM NAVIGATION BAR */}
      {/* ========================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#061e13]/95 backdrop-blur-lg border-t border-emerald-900/60 px-4 py-2 flex items-center justify-around shadow-2xl">
        
        {/* 1. CARGAS */}
        <button
          onClick={() => setActiveNavTab('cargas')}
          className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-all relative ${
            activeNavTab === 'cargas' 
              ? 'text-emerald-400 font-bold scale-105' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Package className="w-6 h-6" />
            {availableCargos.length > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-emerald-500 text-slate-950 font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#061e13]">
                {availableCargos.length}
              </span>
            )}
          </div>
          <span className="text-[11px]">Cargas</span>
        </button>

        {/* 2. FRETES */}
        <button
          onClick={() => setActiveNavTab('fretes')}
          className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-all ${
            activeNavTab === 'fretes' 
              ? 'text-emerald-400 font-bold scale-105' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-6 h-6" />
          <span className="text-[11px]">Fretes</span>
        </button>

        {/* 3. MAPA */}
        <button
          onClick={() => setActiveNavTab('mapa')}
          className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-all ${
            activeNavTab === 'mapa' 
              ? 'text-emerald-400 font-bold scale-105' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-6 h-6" />
          <span className="text-[11px]">Mapa</span>
        </button>

        {/* 4. PERFIL */}
        <button
          onClick={() => setActiveNavTab('perfil')}
          className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-all ${
            activeNavTab === 'perfil' 
              ? 'text-emerald-400 font-bold scale-105' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserIcon className="w-6 h-6" />
          <span className="text-[11px]">Perfil</span>
        </button>

      </nav>

    </div>
  );
};

export default DriverPortal;
