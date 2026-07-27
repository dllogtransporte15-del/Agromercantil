
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from '../components/Header';
import NewShipmentModal from '../components/NewShipmentModal';
import type { Cargo, Shipment, Client, Product, User, Driver, Vehicle, VehicleSetType, VehicleBodyType } from '../types';
import { CargoStatus } from '../types';
import { CopyIcon } from '../components/icons/CopyIcon';

import { BRAZILIAN_CITIES } from '../brazilianCities';
import { geocodeCity, getCoordsSync } from '../utils/geocoding';
import { upsertManyCargos } from '../services/api/db';

// Declare Leaflet globally since it's loaded via script tag in index.html
declare const L: any;

interface OperationalMapPageProps {
  cargos: Cargo[];
  shipments: Shipment[];
  clients: Client[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  onCreateShipment: (data: Omit<Shipment, 'id' | 'orderId' | 'status' | 'documents' | 'history' | 'createdAt' | 'createdById' | 'statusHistory'>) => void;
  currentUser: User | null;
  users: User[];
  onModalStateChange: (isOpen: boolean) => void;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
}

const formatAllowedVehicleTypes = (allowed?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]): string => {
    if (!allowed || allowed.length === 0) return 'N/A';
    const allBodyTypes = allowed.flatMap(type => type.bodyTypes || []);
    const uniqueBodyTypes = [...new Set(allBodyTypes)];
    return uniqueBodyTypes.join(', ');
};

const P180 = Math.PI / 180;

// Simple Haversine formula to calculate distance in KM
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * P180;
  const dLon = (lon2 - lon1) * P180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * P180) * Math.cos(lat2 * P180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

// Haversine formula (alias, same as getDistance)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  return getDistance(lat1, lon1, lat2, lon2);
};

// Quick filter by bounding box (lighter than full Haversine for pre-selection)
const isInBoundingBox = (lat: number, lon: number, centerLat: number, centerLon: number, radiusKm: number): boolean => {
  const latDegree = radiusKm / 111.32;
  const lonDegree = radiusKm / (111.32 * Math.cos(centerLat * P180));
  return Math.abs(lat - centerLat) <= latDegree && Math.abs(lon - centerLon) <= lonDegree;
};

const OperationalMapPage: React.FC<OperationalMapPageProps> = ({ cargos, shipments, clients, products, drivers, vehicles, onCreateShipment, currentUser, users, onModalStateChange, onDeleteAttachment }) => {
  const [originQuery, setOriginQuery] = useState('Catalão');
  const [originRadius, setOriginRadius] = useState(200);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationRadius, setDestinationRadius] = useState(200);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [filteredLoads, setFilteredLoads] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [copyButtonText, setCopyButtonText] = useState('Divulgar');
  
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [selectedCargoForShipment, setSelectedCargoForShipment] = useState<Cargo | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    onModalStateChange(isShipmentModalOpen);
  }, [isShipmentModalOpen, onModalStateChange]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const circleLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const loadsWithCoordsRef = useRef<(Cargo & { originCoords?: { lat: number, lng: number }, destinationCoords?: { lat: number, lng: number }})[]>([]);

  const handleOpenNewShipmentModal = (cargo: Cargo) => {
    setSelectedCargoForShipment(cargo);
    setIsShipmentModalOpen(true);
  };

  const handleCloseShipmentModal = () => {
    setIsShipmentModalOpen(false);
    setSelectedCargoForShipment(null);
  };

  const handleSaveShipment = (shipmentData: Omit<Shipment, 'id' | 'orderId' | 'cargoId' | 'status' | 'documents' | 'history' | 'createdAt' | 'createdById' | 'statusHistory'>) => {
    if (selectedCargoForShipment) {
      onCreateShipment({
        cargoId: selectedCargoForShipment.id,
        ...shipmentData,
      });
    }
    handleCloseShipmentModal();
  };

  const loadsWithCoords = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return cargos
      .filter(c => {
        if (c.status !== CargoStatus.EmAndamento) return false;
        return c.dailySchedule?.some(ds => ds.date >= today);
      })
      .map(c => {
        // Use coordinates stored in DB, otherwise try synchronous fallback (for old loads), or skip
        const originCoords = c.originCoords || getCoordsSync(c.origin);
        const destinationCoords = c.destinationCoords || getCoordsSync(c.destination);

        return { 
            ...c, 
            originCoords: originCoords || undefined,
            destinationCoords: destinationCoords || undefined
        };
      });
  }, [cargos]);
  
  useEffect(() => {
    loadsWithCoordsRef.current = loadsWithCoords;
  }, [loadsWithCoords]);


  const memoizedFilteredLoads = useMemo(() => {
    if (!originCoords && !destinationCoords) return [];

    const allLoads = loadsWithCoords; // Use the pre-processed loads

    if (!originCoords || !destinationCoords) {
      // If only one is set, fall back to previous logic or handle specifically
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

    // Filtragem Otimizada: Bounding Box primeiro (rápido), Haversine depois (preciso)
    const loadsInRange = allLoads.filter(load => {
        const lat = load.originCoords?.lat;
        const lon = load.originCoords?.lng;
        const destLat = load.destinationCoords?.lat;
        const destLon = load.destinationCoords?.lng;

        if (lat === undefined || lon === undefined || destLat === undefined || destLon === undefined) return false;

        // Passo 1: Bounding Box na Origem
        if (!isInBoundingBox(lat, lon, oCoords[0], oCoords[1], originRadius)) return false;

        // Passo 2: Bounding Box no Destino
        if (!isInBoundingBox(destLat, destLon, dCoords[0], dCoords[1], destinationRadius)) return false;

        // Passo 3: Cálculo Haversine preciso apenas para o que passou nas "caixas"
        const distO = calculateDistance(oCoords[0], oCoords[1], lat, lon);
        const distD = calculateDistance(dCoords[0], dCoords[1], destLat, destLon);

        return distO <= originRadius && distD <= destinationRadius;
    });
    return loadsInRange;
  }, [loadsWithCoords, originCoords, originRadius, destinationCoords, destinationRadius]);

  useEffect(() => {
    setFilteredLoads(memoizedFilteredLoads);
  }, [memoizedFilteredLoads]);

  // Initial search on mount if default query exists
  useEffect(() => {
    if (originQuery && !originCoords && !loading) {
       handleSearch(null);
    }
  }, []);

  const handleSyncAllCargos = async () => {
    if (!window.confirm('Deseja atualizar as coordenadas de TODAS as cargas cadastradas? Isso pode levar algum tempo.')) return;
    
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
                
                // Pequeno delay para não sobrecarregar a API Nominatim (rate limit 1s)
                // Usamos 1.1s se for uma requisição real para o servidor externo
                if (updatedCount % 2 === 0) {
                     await new Promise(resolve => setTimeout(resolve, 1100));
                }
            }
        }
        
        if (cargosToUpdate.length > 0) {
            await upsertManyCargos(cargosToUpdate);
            alert(`${updatedCount} cargas atualizadas com sucesso! Recarregando página...`);
            window.location.reload();
        } else {
            alert('Todas as cargas já possuem coordenadas ou não foi possível geocodificar as restantes.');
        }
    } catch (err) {
        console.error('Erro ao sincronizar coordenadas:', err);
        alert('Ocorreu um erro durante a sincronização. Verifique o console.');
    } finally {
        setSyncingAll(false);
    }
  };

  const initMap = () => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = L.map(mapContainerRef.current).setView([-15.78, -47.92], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstanceRef.current);
    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    circleLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    mapInstanceRef.current.on('popupopen', (e: any) => {
        const popupNode = e.popup.getElement();
        const buttons = popupNode.querySelectorAll('[id^="create-shipment-btn-"]');
        buttons.forEach((btn: any) => {
            const rawId = btn.id.replace('create-shipment-btn-', '');
            const idParts = rawId.split('_idx_');
            const loadId = idParts[0];
            const destIndexStr = idParts[1];
            
            const cargoToShip = loadsWithCoordsRef.current.find(l => l.id === loadId);
            if (cargoToShip) {
                L.DomEvent.disableClickPropagation(btn);
                btn.onclick = () => {
                    let finalCargo = cargoToShip;
                    if (destIndexStr !== undefined && cargoToShip.destinations && cargoToShip.destinations.length > parseInt(destIndexStr)) {
                         const dest = cargoToShip.destinations[parseInt(destIndexStr)];
                         const leg = dest.freightLegs?.[0] || { driverFreightValuePerTonPJ: undefined, driverFreightValuePerTonPF: undefined, driverFreightValuePerTon: 0, companyFreightValuePerTon: 0 };
                         finalCargo = {
                             ...cargoToShip,
                             destination: dest.city,
                             destinationMapLink: dest.mapLink || cargoToShip.destinationMapLink,
                             driverFreightValuePerTon: leg?.driverFreightValuePerTon ?? cargoToShip.driverFreightValuePerTon,
                             driverFreightValuePerTonPJ: leg?.driverFreightValuePerTonPJ ?? cargoToShip.driverFreightValuePerTonPJ,
                             driverFreightValuePerTonPF: leg?.driverFreightValuePerTonPF ?? cargoToShip.driverFreightValuePerTonPF,
                             disableDriverFreightPF: leg?.disableDriverFreightPF ?? cargoToShip.disableDriverFreightPF,
                             companyFreightValuePerTon: leg?.companyFreightValuePerTon ?? cargoToShip.companyFreightValuePerTon,
                         };
                    }
                    handleOpenNewShipmentModal(finalCargo);
                };
            }
        });
    });
    
    // Forçar re-cálculo do tamanho após o mount para evitar partes cinzas em layouts dinâmicos
    setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 400);
  };

  const updateMapLayers = () => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !circleLayerRef.current) return;
    
    // Garantir que o mapa reconheça o tamanho atual do container de 500px
    mapInstanceRef.current.invalidateSize();

    markersRef.current.clear();
    markersLayerRef.current.clearLayers();
    circleLayerRef.current.clearLayers();

    const bounds = L.latLngBounds();

    if (originCoords) {
      const circle = L.circle([originCoords.lat, originCoords.lng], {
        color: '#1E40AF',
        fillColor: '#1E40AF',
        fillOpacity: 0.1,
        radius: originRadius * 1000
      });
      circle.addTo(circleLayerRef.current);
      bounds.extend(circle.getBounds());
    }

    if (destinationCoords) {
      const circle = L.circle([destinationCoords.lat, destinationCoords.lng], {
        color: '#DC2626',
        fillColor: '#DC2626',
        fillOpacity: 0.1,
        radius: destinationRadius * 1000
      });
      circle.addTo(circleLayerRef.current);
      bounds.extend(circle.getBounds());
    }

    filteredLoads.forEach(load => {
      if (load.originCoords) {
        const client = clients.find(cl => cl.id === load.clientId);
        const product = products.find(p => p.id === load.productId);
        const remainingVolume = load.totalVolume - load.loadedVolume;
        const destinationsList = load.destinations && load.destinations.length > 0 
            ? load.destinations.map(d => {
                const leg = d.freightLegs?.[0] || { driverFreightValuePerTonPJ: undefined, driverFreightValuePerTonPF: undefined, driverFreightValuePerTon: load.driverFreightValuePerTon };
                const pj = leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon;
                return `<li>${d.city} (R$ ${pj.toFixed(2)})</li>`;
              }).join('')
            : `<li>${load.destination} (R$ ${load.driverFreightValuePerTon.toFixed(2)})</li>`;

        const actionButtons = load.destinations && load.destinations.length > 0 
            ? `<div class="mt-2 space-y-1">
                 <p class="text-[10px] font-bold text-gray-500 uppercase">Criar Embarque para:</p>
                 <div class="grid grid-cols-2 gap-1">
                 ${load.destinations.map((d, i) => `<button id="create-shipment-btn-${load.id}_idx_${i}" class="w-full py-1 bg-primary text-white text-[9px] font-semibold rounded hover:bg-primary-dark truncate px-1">${d.city}</button>`).join('')}
                 </div>
               </div>`
            : `<button id="create-shipment-btn-${load.id}" class="w-full mt-3 py-1.5 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark">Criar Embarque</button>`;

        const popupContent = `
            <div class="p-1" style="min-width: 240px;">
                <h4 class="font-bold text-md text-primary">Carga ${load.sequenceId}</h4>
                <p class="text-xs text-gray-500 mb-2">${client?.nomeFantasia || 'N/A'} - ${product?.name || 'N/A'}</p>
                <p class="text-sm"><b>Origem:</b> ${load.origin}</p>
                <p class="text-sm font-bold mt-1">Destinos:</p>
                <ul class="text-xs ml-3 list-disc list-outside mb-1 text-gray-700">
                    ${destinationsList}
                </ul>
                <p class="text-sm mt-1"><b>Volume Disp.:</b> ${remainingVolume.toFixed(1)} ton</p>
                ${actionButtons}
            </div>
        `;
        const marker = L.marker([load.originCoords.lat, load.originCoords.lng]);
        marker.bindPopup(popupContent);
        marker.addTo(markersLayerRef.current);
        markersRef.current.set(load.id, marker);
      }
    });

    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  useEffect(() => {
    initMap();
    handleSearch(null);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateMapLayers();
  }, [filteredLoads, originCoords, destinationCoords]); // Dependencies ensure map updates correctly

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
    if (!allowed || allowed.length === 0) return 'N/A';
    const allBodyTypes = allowed.flatMap(type => type.bodyTypes || []);
    const uniqueBodyTypes = [...new Set(allBodyTypes)];
    return uniqueBodyTypes.join(';');
  };

  const handleShareFilteredLoads = () => {
    if (filteredLoads.length === 0) {
      alert('Nenhuma carga no resultado para divulgar.');
      return;
    }
    const header = '🌽 *LIBERADOS AGROMERCANTIL* 🌽\n';
    const loadsText = filteredLoads.map(load => {
      const product = products.find(p => p.id === load.productId)?.name || 'N/A';
      const origin = load.origin;
      const bodyTypes = formatAllowedVehicleTypes(load.allowedVehicleTypes);
      
      let text = `📍*${origin}*`;
      if (load.originLocation) text += `\n📍Coleta - ${load.originLocation}`;
      if (load.originMapLink && !load.originLocation) text += `\n📍Coleta - ${load.originMapLink}`;
      else if (load.originMapLink) text += `\n${load.originMapLink}`;

      text += `\n🌾 ${product}`;
      text += `\n🚩 *Destinos*`;
      
      if (load.destinations && load.destinations.length > 0) {
        load.destinations.forEach(dest => {
            const leg = dest.freightLegs?.[0] || { driverFreightValuePerTonPJ: undefined, driverFreightValuePerTonPF: undefined, driverFreightValuePerTon: load.driverFreightValuePerTon };
            const pj = (leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const pf = (leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const isPFDisabled = leg.disableDriverFreightPF || load.disableDriverFreightPF;
            const priceDisplay = isPFDisabled ? `_PJ ${pj}_` : `_PJ ${pj}/PF ${pf}_`;
            text += `\n* *${dest.city}* 💲 *${priceDisplay}*`;
            if (dest.mapLink) text += `\n${dest.mapLink}`;
        });
      } else {
        const pj = (load.driverFreightValuePerTonPJ ?? load.driverFreightValuePerTon).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pf = (load.driverFreightValuePerTonPF ?? load.driverFreightValuePerTon).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const isPFDisabled = load.disableDriverFreightPF;
        const priceDisplay = isPFDisabled ? `_PJ ${pj}_` : `_PJ ${pj}/PF ${pf}_`;
        text += `\n* *${load.destination}* 💲 *${priceDisplay}*`;
        if (load.destinationMapLink) text += `\n${load.destinationMapLink}`;
      }

      text += `\n🚛 ${bodyTypes} 🚛`;
      
      return text;
    }).join('\n\n');
    navigator.clipboard.writeText(header + '\n' + loadsText).then(() => {
      setCopyButtonText('Copiado!');
      setTimeout(() => setCopyButtonText('Divulgar'), 3000);
    }, (err) => {
      console.error('Falha ao copiar: ', err);
      alert('Não foi possível copiar as cargas.');
    });
  };

  const handleSidebarItemClick = (load: Cargo) => {
    const marker = markersRef.current.get(load.id);
    if (marker && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo(marker.getLatLng(), 12, {
            animate: true,
            duration: 1
        });
        marker.openPopup();
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 max-w-[1500px] mx-auto w-full">
      <Header title="Mapa Operacional Logístico" />
      
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
        {/* Coluna da Esquerda: Mapa com Destaque Máximo */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Mapa Ampliado - Altura de 500px (+50% em relação aos 330px anteriores) */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-blue-50 dark:border-gray-700 overflow-hidden h-[500px] flex-shrink-0">
            <div ref={mapContainerRef} className="w-full h-full z-0" />
            
            {/* Legenda Minimalista */}
            <div className="absolute top-4 right-4 z-[400] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
               <p className="text-[9px] font-bold text-gray-400 mb-2 uppercase tracking-widest border-b pb-1">Legenda</p>
              <div className="flex gap-4">
                <div className="flex items-center text-[10px]"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full mr-1.5"></div><span className="text-gray-600 dark:text-gray-300 font-bold">Carga</span></div>
                <div className="flex items-center text-[10px]"><div className="w-2.5 h-2.5 border-2 border-blue-600 rounded-full mr-1.5"></div><span className="text-gray-600 dark:text-gray-300 font-bold">Origem</span></div>
                <div className="flex items-center text-[10px]"><div className="w-2.5 h-2.5 border-2 border-red-500 rounded-full mr-1.5"></div><span className="text-gray-600 dark:text-gray-300 font-bold">Destino</span></div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-blue-50/30 dark:bg-blue-900/10 rounded-2xl border-2 border-dashed border-blue-100 dark:border-blue-900/30 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-blue-400 dark:text-blue-500 font-medium italic">Selecione uma carga no mapa ou na lista à direita para visualizar detalhes aqui.</p>
          </div>
        </div>

        {/* Coluna da Direita: Sidebar Consolidada (Filtros + Resultados) */}
        <aside className="w-full lg:w-[400px] flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar pb-6">
          {/* Card 1: Filtros */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Parâmetros de Busca</h3>
            <form onSubmit={handleSearch} className="space-y-6">
              {/* Origem */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Origem</label>
                  </div>
                  <span className="text-xs font-bold text-blue-600">{originRadius} km</span>
                </div>
                <input 
                  type="text" 
                  list="city-suggestions"
                  value={originQuery} 
                  onChange={(e) => setOriginQuery(e.target.value)} 
                  placeholder="Cidade de Origem" 
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                />
                <input type="range" min="50" max="1000" step="50" value={originRadius} onChange={(e) => setOriginRadius(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>

              {/* Destino */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Destino</label>
                  </div>
                  <span className="text-xs font-bold text-red-600">{destinationRadius} km</span>
                </div>
                <input 
                  type="text" 
                  list="city-suggestions"
                  value={destinationQuery} 
                  onChange={(e) => setDestinationQuery(e.target.value)} 
                  placeholder="Santos, SP" 
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" 
                />
                <input type="range" min="50" max="1000" step="50" value={destinationRadius} onChange={(e) => setDestinationRadius(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600" />
              </div>

              <datalist id="city-suggestions">
                {BRAZILIAN_CITIES.map((city, idx) => (
                  <option key={idx} value={city} />
                ))}
              </datalist>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Localizando...</span>
                  </>
                ) : (
                  <span>Localizar Fretes</span>
                )}
              </button>
            </form>
            {error && <p className="text-red-500 text-[10px] mt-3 font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-center">{error}</p>}
            
            <button 
                onClick={handleSyncAllCargos}
                disabled={syncingAll}
                className="w-full mt-4 py-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-[10px] items-center justify-center font-bold text-gray-400 hover:text-blue-500 hover:border-blue-500 transition-all flex gap-2"
            >
                {syncingAll ? (
                    <>
                        <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                        <span>Sincronizando Coordenadas...</span>
                    </>
                ) : (
                    <span>Sincronizar Todas as Cargas (Old)</span>
                )}
            </button>
          </div>

          {/* Card 2: Resultados - Centralizado agora na direita */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col min-h-[500px]">
            <div className="mb-4 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
              <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400">
                {originCoords ? `Fretes próximos a ${originQuery}` : 'Aguardando parâmetros'}
              </span>
            </div>

            <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 italic">Resultados <span className="text-blue-600 ml-1">{filteredLoads.length}</span></h4>
              {filteredLoads.length > 0 && (
                <button onClick={handleShareFilteredLoads} className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all font-bold shadow-sm">
                  <CopyIcon className="w-3 h-3" /> {copyButtonText}
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {filteredLoads.length > 0 ? (
                filteredLoads.map(load => {
                  const client = clients.find(c => c.id === load.clientId);
                  const product = products.find(p => p.id === load.productId);
                  return (
                    <div 
                      key={load.id} 
                      onClick={() => handleSidebarItemClick(load)}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate max-w-[150px] uppercase">{client?.nomeFantasia || 'Cliente'}</p>
                        <span className="text-[9px] font-black text-gray-400">#{load.sequenceId}</span>
                      </div>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-3">{product?.name}</p>
                      
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center text-[10px] font-bold text-gray-700 dark:text-gray-200">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></div>
                          <span>{load.origin}</span>
                        </div>
                        {load.destinations && load.destinations.length > 0 ? (
                            load.destinations.map((d, i) => {
                                const leg = d.freightLegs?.[0] || { driverFreightValuePerTonPJ: undefined, driverFreightValuePerTonPF: undefined, driverFreightValuePerTon: load.driverFreightValuePerTon };
                                const pj = leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon;
                                return (
                                    <div key={i} className="flex justify-between items-center text-[10px] font-bold text-gray-700 dark:text-gray-200 ml-1">
                                      <div className="flex items-center">
                                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></div>
                                          <span className="truncate max-w-[120px]">{d.city}</span>
                                      </div>
                                      <span className="text-[10px] text-green-600 dark:text-green-400">R$ {pj.toFixed(2)}</span>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-700 dark:text-gray-200">
                              <div className="flex items-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></div>
                                  <span>{load.destination}</span>
                              </div>
                              <span className="text-[10px] text-green-600 dark:text-green-400">R$ {load.driverFreightValuePerTon.toFixed(2)}</span>
                            </div>
                        )}
                      </div>

                      <div className="flex justify-between mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-600">
                        {load.destinations && load.destinations.length > 0 ? 
                           <span className="text-[10px] text-gray-500 italic">Múltiplos Destinos</span>
                           : 
                           <span className="text-[11px] font-black text-green-600 dark:text-green-400">R$ {load.driverFreightValuePerTon.toFixed(2)}</span>
                        }
                        <span className="text-[11px] font-black text-gray-700 dark:text-gray-200">{(load.totalVolume - load.loadedVolume).toFixed(1)} <span className="text-[9px] text-gray-400 font-normal">ton</span></span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
                  <p className="text-gray-400 dark:text-gray-500 text-[10px] leading-relaxed">Nenhuma carga encontrada para os filtros atuais.</p>
                </div>
              )}
            </div>
            {error && <p className="text-red-500 text-[10px] mt-3 font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-center">{error}</p>}
          </div>
        </aside>
      </div>

      <NewShipmentModal
        isOpen={isShipmentModalOpen}
        onClose={handleCloseShipmentModal}
        onSave={handleSaveShipment}
        cargo={selectedCargoForShipment}
        drivers={drivers}
        clients={clients}
        vehicles={vehicles}
        currentUser={currentUser}
        shipments={shipments}
        users={users}
      />
    </div>
  );
};

// Custom styles for the scrollbar to keep the UI clean
const style = document.createElement('style');
style.innerHTML = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
  }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #374151;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #d1d5db;
  }
`;
document.head.appendChild(style);

export default OperationalMapPage;
