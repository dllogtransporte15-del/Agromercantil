import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Client, Product, FreightOffer } from '../types';
import { FreightOfferStatus } from '../types';
import { 
  XIcon, PackageIcon, MapPinIcon, CalendarIcon, ScaleIcon, PaperclipIcon, 
  Navigation, Route as RouteIcon, Loader2, AlertCircle, CheckCircle2, Clock, Building2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabase';

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

interface FreightOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  products: Product[];
  currentClient?: Client;
  onSave: (offer: Omit<FreightOffer, 'id' | 'createdAt'> | FreightOffer) => Promise<void>;
  editingOffer?: FreightOffer | null;
}

// React Error Boundary to isolate Leaflet map rendering errors
class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error('Leaflet Map error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center h-full bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500">
          <Navigation className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-xs font-semibold">Ocorreu um problema ao carregar a visualização do mapa.</p>
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

const FreightOfferModal: React.FC<FreightOfferModalProps> = ({
  isOpen, onClose, clients, products, currentClient, onSave, editingOffer
}) => {
  const [formData, setFormData] = useState({
    origin: '',
    originLocation: '',
    destination: '',
    destinationLocation: '',
    totalTonnage: '',
    dailySchedule: '',
    productId: '',
    freightType: 'CIF' as 'CIF' | 'FOB',
    hasIcms: false,
    icmsPercentage: '',
    observations: '',
  });

  const [additionalDestinations, setAdditionalDestinations] = useState<{city: string, location: string}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Routing states
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [selectedBranchKey, setSelectedBranchKey] = useState<string>('matriz');
  const [selectedClientCnpj, setSelectedClientCnpj] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Reset modal state when opening/closing or when editingOffer changes
  useEffect(() => {
    if (isOpen) {
      const activeClient = currentClient || (editingOffer ? clients.find(c => c.id === editingOffer.clientId) : undefined) || clients[0];
      
      if (editingOffer) {
        setFormData({
          origin: editingOffer.origin || '',
          originLocation: editingOffer.originLocation || '',
          destination: editingOffer.destination || '',
          destinationLocation: editingOffer.destinationLocation || '',
          totalTonnage: editingOffer.totalTonnage ? editingOffer.totalTonnage.toString() : '',
          dailySchedule: editingOffer.dailySchedule || '',
          productId: editingOffer.productId || '',
          freightType: editingOffer.freightType || 'CIF',
          hasIcms: editingOffer.hasIcms || false,
          icmsPercentage: editingOffer.icmsPercentage !== undefined ? editingOffer.icmsPercentage.toString() : '',
          observations: editingOffer.observations || '',
        });
        setAdditionalDestinations(
          editingOffer.additionalDestinations
            ? editingOffer.additionalDestinations.map(d => ({ city: d.city, location: d.location || '' }))
            : []
        );
        setSelectedBranchKey(editingOffer.clientBranchId ? `branch_${editingOffer.clientBranchId}` : (editingOffer.clientCnpj || 'matriz'));
        setSelectedClientCnpj(editingOffer.clientCnpj || activeClient?.cnpj || '');
        setSelectedBranchId(editingOffer.clientBranchId || '');
      } else {
        setFormData({
          origin: '',
          originLocation: '',
          destination: '',
          destinationLocation: '',
          totalTonnage: '',
          dailySchedule: '',
          productId: '',
          freightType: 'CIF',
          hasIcms: false,
          icmsPercentage: '',
          observations: '',
        });
        setAdditionalDestinations([]);
        setSelectedBranchKey('matriz');
        setSelectedClientCnpj(activeClient?.cnpj || '');
        setSelectedBranchId('');
      }
      setAttachments([]);
      setRouteData(null);
      setRouteError(null);
    }
  }, [isOpen, editingOffer, currentClient, clients]);

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

  // Route calculation callback
  const calculateRoute = useCallback(async () => {
    const originCity = formData.origin.trim();
    const destCity = formData.destination.trim();

    if (!originCity || !destCity || originCity.length < 3 || destCity.length < 3) {
      setRouteData(null);
      setRouteError(null);
      return;
    }

    setIsCalculatingRoute(true);
    setRouteError(null);

    try {
      // Resolve Origin
      const originRes = await resolveLocationToWaypoint(formData.originLocation, formData.origin, 'origin');
      if (!originRes) {
        setRouteError(`Não foi possível localizar a Origem "${formData.origin}".`);
        setIsCalculatingRoute(false);
        return;
      }

      // Resolve Additional Destinations
      const resolvedVias: Waypoint[] = [];
      for (const addDest of additionalDestinations) {
        if (addDest.city && addDest.city.trim().length >= 3) {
          const viaRes = await resolveLocationToWaypoint(addDest.location, addDest.city, 'via');
          if (viaRes) resolvedVias.push(viaRes);
        }
      }

      // Resolve Main Destination
      const destRes = await resolveLocationToWaypoint(formData.destinationLocation, formData.destination, 'destination');
      if (!destRes) {
        setRouteError(`Não foi possível localizar o Destino "${formData.destination}".`);
        setIsCalculatingRoute(false);
        return;
      }

      const allWaypoints = [originRes, ...resolvedVias, destRes];

      // Fetch OSRM Route
      const waypointsParam = allWaypoints.map(w => `${w.lng},${w.lat}`).join(';');
      const osrmResp = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${waypointsParam}?overview=full&geometries=geojson`
      );

      if (!osrmResp.ok) {
        throw new Error('Falha no serviço de rotas.');
      }

      const osrmData = await osrmResp.json();
      if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
        throw new Error('Rota não encontrada entre as localizações.');
      }

      const route = osrmData.routes[0];
      const distanceKm = route.distance / 1000;
      const durationMin = Math.round(route.duration / 60);

      const coordinates: [number, number][] = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]]
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
      console.error('Error calculating route:', err);
      setRouteError(err?.message || 'Erro ao roteirizar a viagem.');
    } finally {
      setIsCalculatingRoute(false);
    }
  }, [formData.origin, formData.originLocation, formData.destination, formData.destinationLocation, additionalDestinations]);

  // Automatic routing effect (debounced 700ms)
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (formData.origin.trim().length >= 3 && formData.destination.trim().length >= 3) {
        calculateRoute();
      } else {
        setRouteData(null);
        setRouteError(null);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [isOpen, formData.origin, formData.originLocation, formData.destination, formData.destinationLocation, additionalDestinations, calculateRoute]);

  // EARLY RETURN FOR CLOSED MODAL MUST BE AFTER ALL HOOKS!
  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddDestination = () => {
    setAdditionalDestinations([...additionalDestinations, { city: '', location: '' }]);
  };

  const handleAdditionalDestinationChange = (index: number, field: 'city' | 'location', value: string) => {
    const newDests = [...additionalDestinations];
    newDests[index][field] = value;
    setAdditionalDestinations(newDests);
  };

  const handleRemoveDestination = (index: number) => {
    setAdditionalDestinations(additionalDestinations.filter((_, i) => i !== index));
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setAttachments(prev => {
        const existingNames = prev.map(f => f.name);
        const filesToAdd = newFiles.filter(f => !existingNames.includes(f.name));
        return [...prev, ...filesToAdd];
      });
    }
    e.target.value = '';
  };

  const handleRemoveAttachment = (fileName: string) => {
    setAttachments(prev => prev.filter(file => file.name !== fileName));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClient = currentClient || (editingOffer ? clients.find(c => c.id === editingOffer.clientId) : undefined);
    if (!targetClient) return;

    setIsSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `freight_offer_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `freight_offers/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('shipment_attachments')
          .upload(filePath, file);
          
        if (uploadError) {
          throw new Error('Falha ao fazer upload de anexo: ' + file.name);
        }
        
        const { data } = supabase.storage
          .from('shipment_attachments')
          .getPublicUrl(filePath);
          
        uploadedUrls.push(`${data.publicUrl}?name=${encodeURIComponent(file.name)}`);
      }

      const mergedAttachments = [...(editingOffer?.attachments || []), ...uploadedUrls];

      const finalClientCnpj = selectedClientCnpj || targetClient.cnpj;
      const finalBranchId = selectedBranchId || undefined;

      if (editingOffer) {
        const updatedOffer: FreightOffer = {
          ...editingOffer,
          clientId: targetClient.id,
          clientCnpj: finalClientCnpj,
          clientBranchId: finalBranchId,
          origin: formData.origin,
          originLocation: formData.originLocation,
          destination: formData.destination,
          destinationLocation: formData.destinationLocation,
          totalTonnage: Number(formData.totalTonnage),
          dailySchedule: formData.dailySchedule,
          productId: formData.productId,
          freightType: formData.freightType,
          hasIcms: formData.hasIcms,
          icmsPercentage: formData.hasIcms ? Number(formData.icmsPercentage) || 0 : undefined,
          observations: formData.observations,
          additionalDestinations: additionalDestinations.filter(d => d.city.trim() !== ''),
          attachments: mergedAttachments,
          history: [
            ...(editingOffer.history || []),
            {
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              userId: targetClient.id,
              timestamp: new Date().toISOString(),
              description: `Oferta editada pelo cliente. CNPJ Solicitante: ${finalClientCnpj || 'Matriz'}`
            }
          ]
        };
        await onSave(updatedOffer);
      } else {
        await onSave({
          clientId: targetClient.id,
          clientCnpj: finalClientCnpj,
          clientBranchId: finalBranchId,
          origin: formData.origin,
          originLocation: formData.originLocation,
          destination: formData.destination,
          destinationLocation: formData.destinationLocation,
          totalTonnage: Number(formData.totalTonnage),
          dailySchedule: formData.dailySchedule,
          productId: formData.productId,
          freightType: formData.freightType,
          hasIcms: formData.hasIcms,
          icmsPercentage: formData.hasIcms ? Number(formData.icmsPercentage) || 0 : undefined,
          status: FreightOfferStatus.AguardandoPreco,
          observations: formData.observations,
          additionalDestinations: additionalDestinations.filter(d => d.city.trim() !== ''),
          attachments: uploadedUrls,
        });
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving freight offer:', error);
      alert(`Erro ao salvar a oferta de frete. ${error?.message || ''} ${error?.details || ''}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDurationText = (mins: number) => {
    const hrs = (mins / 60).toFixed(1);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hrs}h (${h > 0 ? `${h}h ` : ''}${m}min)`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <PackageIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingOffer ? `Editar Oferta de Frete ${editingOffer.displayId ? '#' + editingOffer.displayId : ''}` : 'Gerar Oferta de Frete'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {editingOffer ? 'Altere as informações da oferta e salve as alterações' : 'Preencha os dados e o percurso será roteirizado automaticamente'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Modal Content - 2 Column Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Column (6/12) */}
            <div className="lg:col-span-6 space-y-5">
              <form id="freight-offer-form" onSubmit={handleSubmit} className="space-y-4">
                
                {/* CNPJ / Filial Solicitante Selection (se houver filiais ou múltiplos CNPJs) */}
                {(() => {
                  const targetClient = currentClient || (editingOffer ? clients.find(c => c.id === editingOffer.clientId) : undefined) || clients[0];
                  const branches = targetClient?.secondaryCnpjs || [];
                  
                  if (!targetClient || branches.length === 0) return null;

                  return (
                    <div className="p-4 bg-indigo-50/70 dark:bg-indigo-900/25 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-2">
                      <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        CNPJ / Filial Solicitante da Cotação <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedBranchKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedBranchKey(val);
                          if (val.startsWith('branch_')) {
                            const bId = val.replace('branch_', '');
                            const b = branches.find(item => item.id === bId);
                            setSelectedBranchId(bId);
                            setSelectedClientCnpj(b?.cnpj || '');
                          } else {
                            setSelectedBranchId('');
                            setSelectedClientCnpj(targetClient.cnpj || '');
                          }
                        }}
                        className="w-full px-3 py-2 text-sm border border-indigo-300 dark:border-indigo-600 rounded-lg dark:bg-gray-700 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      >
                        <option value="matriz">
                          Matriz — CNPJ: {targetClient.cnpj} {targetClient.city ? `(${targetClient.city}/${targetClient.state})` : ''}
                        </option>
                        {branches.map(b => (
                          <option key={b.id} value={`branch_${b.id}`}>
                            {b.nomeFantasia || b.razaoSocial || 'Filial'} — CNPJ: {b.cnpj} {b.city ? `(${b.city}/${b.state})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        Selecione para qual CNPJ ou unidade filial esta cotação de frete pertence.
                      </p>
                    </div>
                  );
                })()}

                <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-200/80 dark:border-gray-600 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-indigo-500" />
                    Origem & Destino
                  </h3>

                  {/* Origem & Local */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Origem (Cidade/UF) *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPinIcon className="h-4 w-4 text-emerald-500" />
                        </div>
                        <input required type="text" name="origin" value={formData.origin} onChange={handleChange} className="pl-9 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Serra do Salitre - MG" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Local da Origem (Exato)</label>
                      <input type="text" name="originLocation" value={formData.originLocation} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Eurochem / Fazenda Saia Velha" />
                    </div>
                  </div>

                  {/* Destino & Local */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Destino (Cidade/UF) *</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MapPinIcon className="h-4 w-4 text-red-500" />
                          </div>
                          <input required type="text" name="destination" value={formData.destination} onChange={handleChange} className="pl-9 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Luziânia - GO" />
                        </div>
                        <button type="button" onClick={handleAddDestination} className="p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex-shrink-0 text-xs font-bold" title="Adicionar outro destino">
                          + Via
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Local do Destino (Exato)</label>
                      <input type="text" name="destinationLocation" value={formData.destinationLocation} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Rodovia GO 010 km193" />
                    </div>
                  </div>

                  {/* Additional Destinations */}
                  {additionalDestinations.map((dest, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Via / Destino {idx + 1} (Cidade/UF)</label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <MapPinIcon className="h-4 w-4 text-indigo-500" />
                            </div>
                            <input required type="text" value={dest.city} onChange={e => handleAdditionalDestinationChange(idx, 'city', e.target.value)} className="pl-9 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Cristalina - GO" />
                          </div>
                          <button type="button" onClick={() => handleRemoveDestination(idx)} className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex-shrink-0 text-xs font-bold" title="Remover destino">
                            -
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Local do Destino Via {idx + 1}</label>
                        <input type="text" value={dest.location} onChange={e => handleAdditionalDestinationChange(idx, 'location', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Silo Central" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cargo Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Volume Total (Ton) *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ScaleIcon className="h-4 w-4 text-gray-400" />
                      </div>
                      <input required type="number" min="0" step="0.01" name="totalTonnage" value={formData.totalTonnage} onChange={handleChange} className="pl-9 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: 500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Cadência Diária</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CalendarIcon className="h-4 w-4 text-gray-400" />
                      </div>
                      <input type="text" name="dailySchedule" value={formData.dailySchedule} onChange={handleChange} className="pl-9 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: 50 ton/dia, ou Livre" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Produto *</label>
                    <select required name="productId" value={formData.productId} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500">
                      <option value="">Selecione um produto</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Tipo de Frete</label>
                    <select name="freightType" value={formData.freightType} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500">
                      <option value="CIF">CIF (Pago pelo Remetente)</option>
                      <option value="FOB">FOB (Pago pelo Destinatário)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Incidência de ICMS</label>
                    <div className="flex gap-2">
                      <select
                        name="hasIcms"
                        value={formData.hasIcms ? 'true' : 'false'}
                        onChange={(e) => {
                          const val = e.target.value === 'true';
                          setFormData(prev => ({
                            ...prev,
                            hasIcms: val,
                            icmsPercentage: val ? prev.icmsPercentage : ''
                          }));
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="false">Não (Sem ICMS / Isento)</option>
                        <option value="true">Sim (Com ICMS)</option>
                      </select>
                      {formData.hasIcms && (
                        <div className="w-1/2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            name="icmsPercentage"
                            value={formData.icmsPercentage}
                            onChange={handleChange}
                            placeholder="% ICMS"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Anexos</label>
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={handleAttachmentClick}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 justify-center transition-colors font-medium"
                      >
                        <PaperclipIcon className="w-4 h-4" />
                        Anexar Arquivos
                      </button>
                    </div>
                    {attachments.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {attachments.map((file, index) => (
                          <li key={index} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/50 px-2 py-1.5 rounded-md">
                            <span className="truncate max-w-[85%]">{file.name}</span>
                            <button type="button" onClick={() => handleRemoveAttachment(file.name)} className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Observações / Informações Adicionais</label>
                  <textarea name="observations" value={formData.observations} onChange={handleChange} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Necessário agendamento prévio, veículo sider..." />
                </div>
              </form>
            </div>

            {/* Map & Auto-Routing Column (6/12) */}
            <div className="lg:col-span-6 flex flex-col space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-200/80 dark:border-gray-600 flex-1 flex flex-col space-y-3">
                {/* Route Header Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2">
                    <RouteIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Roteirização da Oferta</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={calculateRoute}
                      disabled={isCalculatingRoute}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                      title="Calcular rota de acordo com as coordenadas ou localizações informadas"
                    >
                      <Navigation className="w-3.5 h-3.5 text-white" />
                      Calcular Rota
                    </button>

                    {isCalculatingRoute && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-full text-xs font-semibold animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                        Calculando...
                      </div>
                    )}

                    {routeData && !isCalculatingRoute && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 rounded-full text-xs font-bold shadow-sm">
                          <RouteIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          {routeData.distanceKm.toFixed(0)} km
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full text-xs font-bold shadow-sm">
                          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          {formatDurationText(routeData.durationMin)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Banner if routing failed */}
                {routeError && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>{routeError}</span>
                  </div>
                )}

                {/* Leaflet Map Display with MapErrorBoundary */}
                <div className="relative h-[360px] w-full rounded-xl overflow-hidden shadow-inner border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                  <MapErrorBoundary>
                    <MapContainer
                      key={isOpen ? 'map-open' : 'map-closed'}
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

                  {!routeData && !isCalculatingRoute && !routeError && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-[1000]">
                      <Navigation className="w-10 h-10 text-indigo-400 mb-2 animate-bounce" />
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Digite a Origem e Destino</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                        A rota será calculada e desenhada automaticamente no mapa assim que os campos forem preenchidos.
                      </p>
                    </div>
                  )}
                </div>

                {/* Waypoints Summary */}
                {routeData && (
                  <div className="space-y-1.5 pt-1">
                    <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Pontos Mapeados:</h4>
                    <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
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
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {routeData ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Rota mapeada: {routeData.distanceKm.toFixed(0)} km em {formatDurationText(routeData.durationMin)}
              </span>
            ) : (
              <span>Preencha os campos obrigatórios para criar a oferta</span>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" form="freight-offer-form" disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 shadow-md">
              {isSubmitting ? 'Salvando...' : 'Criar Oferta de Frete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreightOfferModal;
