import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Route, MapPin, Navigation, Truck, DollarSign, 
  Percent, Scale, Fuel, Info, Save, Download, 
  FileText, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, Settings2, Building2, Calculator,
  FileCode, Clock, Search, Sparkles, History, Check, Zap
} from 'lucide-react';
import Header from '../components/Header';
import { saveToolQuote, getToolClients, saveToolClient, ToolClient } from '../utils/toolStorage';
import type { User as AppUser, Cargo } from '../types';
import { isDemoUser } from '../auth';
import { autoFormatInput } from '../utils/formatters';
import { findRouteHistorySuggestion, RouteHistorySuggestion } from '../utils/routeHistorySuggester';
import { geocodeCity } from '../utils/geocoding';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import { addPdfLogo } from '../utils/pdfGenerator';

// Fix Leaflet icon issue by using CDN directly to prevent webpack/vite breaking the image paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Location {
  lat: number;
  lng: number;
  label: string;
}

interface QuoteData {
  clientName: string;
  origin: string;
  destination: string;
  weight: string;
  cargoType: string;
  axes: string;
  inputMode: 'PER_KM' | 'PER_TON';
  driverValue: string; // Valor por Tonelada ou Valor por KM
  companyFreightPerTon: string; // Frete Empresa (R$/Ton)
  tollValue: string;
  anttValue: string;
  // Campos obsoletos, mantidos apenas por compatibilidade
  valuePerKm: string;
  driverTotalValue: string;
  margin: string;
  icms: string;
  dieselPrice: string;
  averageConsumption: string;
  driverCommissionPercent: string;
}

interface RouteInfo {
  distance: number;
  duration: number;
  coordinates: [number, number][];
}

interface FreightQuotePageProps {
  currentUser: AppUser | null;
  cargos?: Cargo[];
}

function MapUpdater({ origin, dest, routeCoords }: { origin?: Location | null, dest?: Location | null, routeCoords?: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    if (routeCoords && routeCoords.length > 0) {
      const bounds = L.latLngBounds(routeCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (origin && dest) {
      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [dest.lat, dest.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (origin) {
      map.setView([origin.lat, origin.lng], 12);
    }
    return () => clearTimeout(timeoutId);
  }, [map, origin, dest, routeCoords]);
  return null;
}

export default function FreightQuotePage({ currentUser, cargos = [] }: FreightQuotePageProps) {
  const [clients, setClients] = useState<ToolClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [originCoords, setOriginCoords] = useState<Location | null>(null);
  const [destCoords, setDestCoords] = useState<Location | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sugestão Inteligente de Rota (Histórico de Cargas ou Cotações em até 150km)
  const [routeSuggestion, setRouteSuggestion] = useState<RouteHistorySuggestion | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [appliedSuggestion, setAppliedSuggestion] = useState(false);

  const loadClients = useCallback(async () => {
    if (!currentUser) return;
    const data = await getToolClients(currentUser.id);
    setClients(data);
  }, [currentUser]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const initialData: QuoteData = {
    clientName: '',
    origin: '',
    destination: '',
    weight: '32',
    cargoType: 'Granel Sólido',
    axes: '6',
    inputMode: 'PER_TON',
    driverValue: '270',
    companyFreightPerTon: '300.00',
    tollValue: '950',
    anttValue: '7000',
    valuePerKm: '0',
    driverTotalValue: '0',
    margin: '0',
    icms: '0',
    dieselPrice: '0',
    averageConsumption: '0',
    driverCommissionPercent: '0'
  };

  const [formData, setFormData] = useState<QuoteData>(initialData);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const formattedValue = autoFormatInput(name, value);
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    setSaveSuccess(false);
    setAppliedSuggestion(false);
  };

  // Busca sugestão de valores com base no histórico de cargas (1ª prioridade) ou cotações (2ª prioridade)
  const searchRouteHistory = useCallback(async (originStr: string, destStr: string) => {
    if (!originStr.trim() || !destStr.trim()) {
      setRouteSuggestion(null);
      return;
    }

    setLoadingSuggestion(true);
    try {
      const suggestion = await findRouteHistorySuggestion(originStr, destStr, cargos);
      setRouteSuggestion(suggestion);
    } catch (err) {
      console.error('Erro ao buscar histórico de rota:', err);
      setRouteSuggestion(null);
    } finally {
      setLoadingSuggestion(false);
    }
  }, [cargos]);

  const calculateRoute = async () => {
    if (!formData.origin.trim() || !formData.destination.trim()) {
      setError('Informe a origem e o destino para calcular a rota.');
      return;
    }

    setLoading(true);
    setError(null);
    setRouteInfo(null);

    // Dispara busca no histórico simultaneamente
    searchRouteHistory(formData.origin, formData.destination);

    try {
      const [origin, dest] = await Promise.all([
        geocodeCity(formData.origin),
        geocodeCity(formData.destination)
      ]);

      if (!origin || !dest) {
        if (!origin && !dest) {
          setError(`Não foi possível localizar a origem ("${formData.origin}") nem o destino ("${formData.destination}").`);
        } else if (!origin) {
          setError(`Não foi possível localizar a cidade de origem: "${formData.origin}". Verifique o nome ou selecione da lista.`);
        } else {
          setError(`Não foi possível localizar a cidade de destino: "${formData.destination}". Verifique o nome ou selecione da lista.`);
        }
        setLoading(false);
        return;
      }

      setOriginCoords({ lat: origin.lat, lng: origin.lng, label: origin.label || formData.origin });
      setDestCoords({ lat: dest.lat, lng: dest.lng, label: dest.label || formData.destination });

      try {
        const routeResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=simplified&geometries=geojson`);
        const routeData = await routeResponse.json();

        if (routeData.code === 'Ok' && routeData.routes.length > 0) {
          const route = routeData.routes[0];
          const distanceKm = route.distance / 1000;
          
          setRouteInfo({
            distance: distanceKm,
            duration: route.duration / 60,
            coordinates: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])
          });

          const eixos = parseInt(formData.axes) || 6;
          const baseAnttEstimate = distanceKm * eixos * 1.458; // Base aproximada Mínimo ANTT
          const baseTollEstimate = distanceKm * eixos * 0.198; // Base aproximada de pedágio

          setFormData(prev => ({
            ...prev,
            anttValue: baseAnttEstimate.toFixed(2),
            tollValue: baseTollEstimate.toFixed(2)
          }));
        } else {
          throw new Error('OSRM retornou sem rotas');
        }
      } catch (osrmErr) {
        // Fallback de cálculo de distância caso o serviço OSRM esteja temporariamente instável
        const R = 6371;
        const dLat = ((dest.lat - origin.lat) * Math.PI) / 180;
        const dLon = ((dest.lng - origin.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((origin.lat * Math.PI) / 180) * Math.cos((dest.lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const directKm = R * c;
        const estimatedRoadKm = Math.round(directKm * 1.25); // Fator de sinuosidade rodoviária estimada

        setRouteInfo({
          distance: estimatedRoadKm,
          duration: (estimatedRoadKm / 70) * 60,
          coordinates: [[origin.lat, origin.lng], [dest.lat, dest.lng]]
        });

        const eixos = parseInt(formData.axes) || 6;
        setFormData(prev => ({
          ...prev,
          anttValue: (estimatedRoadKm * eixos * 1.458).toFixed(2),
          tollValue: (estimatedRoadKm * eixos * 0.198).toFixed(2)
        }));
      }
    } catch (err: any) {
      console.error('Erro ao calcular rota:', err);
      setError('Erro ao conectar com o serviço de mapas ou calcular rota.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = (sug: RouteHistorySuggestion) => {
    setFormData(prev => ({
      ...prev,
      inputMode: 'PER_TON',
      companyFreightPerTon: sug.companyFreightRate.toFixed(2),
      driverValue: sug.driverFreightRate.toFixed(2),
      ...(sug.tollValue ? { tollValue: sug.tollValue.toFixed(2) } : {})
    }));
    setAppliedSuggestion(true);
  };

  const results = useMemo(() => {
    if (!routeInfo) return null;

    const distance = routeInfo.distance;
    const weight = parseFloat(formData.weight) || 0;
    const toll = parseFloat(formData.tollValue) || 0;
    const antt = parseFloat(formData.anttValue) || 0;
    const baseCost = antt + toll;
    const driverValueInput = parseFloat(formData.driverValue) || 0;
    const companyFreightInput = parseFloat(formData.companyFreightPerTon) || 0;

    let driverTotalValue = 0;
    let driverFreightPerTon = 0;

    if (formData.inputMode === 'PER_TON') {
      driverFreightPerTon = driverValueInput;
      driverTotalValue = driverValueInput * weight;
    } else if (formData.inputMode === 'PER_KM') {
      driverTotalValue = driverValueInput * distance;
      driverFreightPerTon = weight > 0 ? driverTotalValue / weight : 0;
    }

    const companyTotalFreight = companyFreightInput * weight;
    const marginPercent = companyFreightInput > 0 ? ((companyFreightInput - driverFreightPerTon) / companyFreightInput) * 100 : 0;
    
    const differenceFromBase = driverTotalValue - baseCost;
    const isValid = differenceFromBase >= 0;

    return {
      distance,
      baseCost,
      driverTotalValue,
      driverFreightPerTon,
      companyTotalFreight,
      companyFreightPerTon: companyFreightInput,
      marginPercent,
      differenceFromBase,
      isValid,
      dieselCost: 0,
      commissionValue: 0,
      carrierNetProfit: companyTotalFreight - driverTotalValue,
      carrierProfitMargin: marginPercent
    };
  }, [formData, routeInfo]);

  const handleSave = async () => {
    if (!results || !routeInfo || isSaving) return;
    if (isDemoUser(currentUser)) {
      alert("Usuário em modo demonstração possui acesso apenas de visualização.");
      return;
    }

    setIsSaving(true);
    try {
      if (!currentUser) throw new Error('Usuário não autenticado');

      if (formData.clientName) {
        await saveToolClient(currentUser.id, formData.clientName);
        await loadClients();
      }

      const saved = await saveToolQuote(currentUser.id, {
        clientName: formData.clientName || 'Não Informado',
        origin: formData.origin,
        destination: formData.destination,
        distance: routeInfo.distance,
        axes: parseInt(formData.axes),
        cargoType: formData.cargoType,
        inputMode: formData.inputMode as any,
        valuePerKm: parseFloat(formData.driverValue) || 0,
        driverTotalValue: results.driverTotalValue,
        tollValue: parseFloat(formData.tollValue) || 0,
        anttValue: parseFloat(formData.anttValue) || 0,
        weight: parseFloat(formData.weight) || 0,
        margin: results.marginPercent,
        driverFreightPerTon: results.driverFreightPerTon,
        companyFreightPerTon: results.companyFreightPerTon,
        companyTotalFreight: results.companyTotalFreight,
        carrierNetProfit: results.carrierNetProfit,
        carrierProfitMargin: results.carrierProfitMargin
      });

      if (saved) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Erro ao salvar cotação. Verifique sua conexão.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const exportToPDF = () => {
    if (!results || !routeInfo) return;

    const doc = new jsPDF();
    addPdfLogo(doc, undefined, { align: 'right', y: 8, width: 35, height: 15 });
    doc.setFontSize(18);
    doc.text('Cotação de Frete', 14, 22);

    autoTable(doc, {
      startY: 35,
      head: [['Especificação', 'Detalhes']],
      body: [
        ['Data da Cotação', format(new Date(), 'dd/MM/yyyy HH:mm')],
        ['Cliente', formData.clientName || 'Não Informado'],
        ['Origem', formData.origin],
        ['Destino', formData.destination],
        ['Valor do Frete Empresa', `${formatCurrency(results.companyFreightPerTon)} / Tonelada`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
    });

    doc.save(`cotacao_${formData.origin}_${formData.destination}.pdf`);
  };

  return (
    <>
      <Header title="Cotação de Frete" />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 font-sans">
        {/* Painel de Configurações */}
        <div className="xl:col-span-4 space-y-6">
          {/* Sessão Rota */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-medium flex items-center text-slate-800 dark:text-white mb-6">
              <Settings2 className="w-5 h-5 mr-2 text-indigo-500" /> Parâmetros da Rota
            </h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <Building2 className="w-4 h-4 mr-1.5 text-slate-400" /> Cliente
                </label>
                <input type="text" name="clientName" value={formData.clientName} onChange={handleInputChange} list="clients-list-q" className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" placeholder="Nome do cliente (opcional)" />
                <datalist id="clients-list-q">
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                    <MapPin className="w-4 h-4 mr-1.5 text-emerald-500" /> Origem
                  </label>
                  <input type="text" name="origin" value={formData.origin} onChange={handleInputChange} list="city-suggestions-quote" className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" placeholder="Ex: Uberaba, MG" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                    <MapPin className="w-4 h-4 mr-1.5 text-red-500" /> Destino
                  </label>
                  <input type="text" name="destination" value={formData.destination} onChange={handleInputChange} list="city-suggestions-quote" className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" placeholder="Ex: Sacramento, MG" />
                </div>
                <datalist id="city-suggestions-quote">
                  {BRAZILIAN_CITIES.map((city, idx) => (
                    <option key={idx} value={city} />
                  ))}
                </datalist>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nº de Eixos</label>
                    <select name="axes" value={formData.axes} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm appearance-none outline-none focus:ring-2 focus:ring-indigo-500">
                      {[2,3,4,5,6,7,9].map(n => <option key={n} value={n}>{n} Eixos</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo de Carga</label>
                    <select name="cargoType" value={formData.cargoType} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm appearance-none outline-none focus:ring-2 focus:ring-indigo-500">
                      {['Granel Sólido', 'Granel Líquido', 'Frigorificada', 'Conteinerizada', 'Carga Geral', 'Neogranel', 'Perigosa'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button onClick={calculateRoute} disabled={loading} className="w-full flex items-center justify-center px-4 py-2.5 bg-slate-900 dark:bg-gray-700 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm disabled:opacity-50 mt-4 shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} BUSCAR ROTA E HISTÓRICO
              </button>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-lg flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 shrink-0" /> {error}
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-gray-700 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tonelada Estimada (Ton)</label>
                <div className="relative">
                  <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm transition-all focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {routeInfo && (
                <div className="bg-slate-50 dark:bg-gray-700 p-4 rounded-xl border border-slate-200 dark:border-gray-600 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-white flex items-center">
                    <Settings2 className="w-4 h-4 mr-2 text-indigo-500" /> Custos Base da Rota
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">Piso Mínimo ANTT (R$)</label>
                        <a href="https://calculadorafrete.antt.gov.br" target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 hover:underline">Consultar</a>
                      </div>
                      <input type="number" step="0.01" name="anttValue" value={formData.anttValue} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 shadow-sm rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500" />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">Valor do Pedágio (R$)</label>
                        <a href="https://rotasbrasil.com.br" target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 hover:underline">Consultar</a>
                      </div>
                      <input type="number" step="0.01" name="tollValue" value={formData.tollValue} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 shadow-sm rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500" />
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-gray-600 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg mt-2">
                       <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Piso Mínimo + Pedágio</span>
                       <span className="text-sm font-black text-indigo-700 dark:text-white">{results ? formatCurrency(results.baseCost) : 'R$ 0,00'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-xs font-medium uppercase tracking-widest mb-1">Dica Operacional</p>
                <p className="text-sm font-medium leading-relaxed max-w-[200px]">A margem de lucro sugerida para escoamento de safra é de 15% a 22%.</p>
              </div>
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                <Info className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
          </div>
        </div>

        {/* Painel Central: Mapa e Pedágio */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden h-[400px] relative z-0 group">
            <MapContainer center={[-15.78, -47.92]} zoom={4} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <ZoomControl position="bottomright" />
              {originCoords && <Marker position={[originCoords.lat, originCoords.lng]} />}
              {destCoords && <Marker position={[destCoords.lat, destCoords.lng]} />}
              {routeInfo && <Polyline positions={routeInfo.coordinates} color="#4f46e5" weight={4} opacity={0.7} />}
              <MapUpdater origin={originCoords} dest={destCoords} routeCoords={routeInfo?.coordinates} />
            </MapContainer>

            {routeInfo && (
              <div className="absolute top-4 left-4 right-4 flex gap-4 z-[1000]">
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow-md rounded-xl p-3 border border-slate-200 dark:border-gray-700 flex items-center space-x-4 flex-1">
                  <div className="flex items-center text-sm font-semibold text-slate-800 dark:text-white">
                    <Route className="w-4 h-4 mr-2 text-indigo-500" /> {routeInfo.distance.toFixed(0)} km
                  </div>
                  <div className="h-4 w-[1px] bg-slate-200 dark:bg-gray-600"></div>
                  <div className="flex items-center text-sm font-semibold text-slate-800 dark:text-white">
                    <Clock className="w-4 h-4 mr-2 text-indigo-500" /> {(routeInfo.duration / 60).toFixed(1)}h
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Banner de Sugestão Inteligente Baseado em Histórico de Cargas ou Cotações */}
          {loadingSuggestion && (
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Consultando histórico de cargas e cotações na região (raio de 150km)...</span>
            </div>
          )}

          {routeSuggestion && (
            <div className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-purple-50/40 dark:from-indigo-950/40 dark:via-gray-800 dark:to-purple-950/30 dark:border-indigo-800/60 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    {routeSuggestion.source === 'cargo'
                      ? 'Última Carga Realizada na Região'
                      : 'Última Cotação Salva na Região'}
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                  {routeSuggestion.originDistanceKm === 0 && routeSuggestion.destinationDistanceKm === 0
                    ? 'Rota Exata'
                    : `Raio até ${Math.max(routeSuggestion.originDistanceKm, routeSuggestion.destinationDistanceKm)}km`}
                </span>
              </div>

              <div className="text-xs text-slate-700 dark:text-gray-300 space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-gray-400">
                  <History className="w-3.5 h-3.5" />
                  <span>
                    {routeSuggestion.matchedOrigin} → {routeSuggestion.matchedDestination} • {formatDate(routeSuggestion.date)}
                    {routeSuggestion.clientName ? ` • ${routeSuggestion.clientName}` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border border-indigo-100 dark:border-gray-700">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Frete Empresa</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {formatCurrency(routeSuggestion.companyFreightRate)}
                      <span className="text-[10px] font-normal text-slate-400">/ton</span>
                    </div>
                  </div>
                  <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border border-indigo-100 dark:border-gray-700">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Frete Motorista</div>
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(routeSuggestion.driverFreightRate)}
                      <span className="text-[10px] font-normal text-slate-400">/ton</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleApplySuggestion(routeSuggestion)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                  appliedSuggestion
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {appliedSuggestion ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Valores Aplicados!
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" /> Aplicar Valores Desta {routeSuggestion.source === 'cargo' ? 'Carga' : 'Cotação'}
                  </>
                )}
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-medium flex items-center text-slate-800 dark:text-white mb-6">
              <DollarSign className="w-5 h-5 mr-2 text-emerald-500" /> Configuração do Frete
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Opção de Cálculo</label>
                  <div className="flex bg-slate-100 dark:bg-gray-900 p-1 rounded-lg">
                    {['PER_TON', 'PER_KM'].map((mode) => (
                      <button key={mode} onClick={() => setFormData(p => ({ ...p, inputMode: mode as any }))} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${formData.inputMode === mode ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                        {mode === 'PER_TON' ? 'POR TONELADA' : 'POR KM RODADO'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {formData.inputMode === 'PER_KM' ? 'Valor por KM (R$)' : 'Valor por Tonelada (R$)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                    <input type="number" step="0.01" name="driverValue" value={formData.driverValue} onChange={handleInputChange} className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Frete Empresa (R$/Ton)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                    <input type="number" step="0.01" name="companyFreightPerTon" value={formData.companyFreightPerTon} onChange={handleInputChange} className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Margem de Lucro Prevista (%)</label>
                  <div className="relative">
                    <input type="text" readOnly title="A margem de lucro é calculada automaticamente baseada no Frete Empresa e o frete do motorista." value={results ? results.marginPercent.toFixed(2) : '0.00'} className="w-full pr-8 px-3 py-2 bg-slate-50 border border-slate-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm font-bold text-slate-500 text-right outline-none cursor-not-allowed" />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>

            {results && (
              <div className={`mt-6 p-4 rounded-xl border flex items-start ${results.isValid ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800'}`}>
                {results.isValid ? <CheckCircle2 className="w-5 h-5 mr-3 shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 mr-3 shrink-0 text-red-600" />}
                <div>
                  <h4 className={`text-sm font-bold ${results.isValid ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'}`}>
                    {results.isValid ? 'Acima do Piso Mínimo - Tudo Certo' : 'Alerta: Abaixo do Piso Mínimo Legal!'}
                  </h4>
                  <p className={`text-xs mt-1 ${results.isValid ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
                    O valor total do motorista (R$ {results.driverTotalValue.toFixed(2)}) está {results.isValid ? 'acima' : 'abaixo'} do custo base de pedágio + piso ANTT em R$ {Math.abs(results.differenceFromBase).toFixed(2)}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Painel Lateral Direito: Resultados */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden flex flex-col h-full ring-1 ring-slate-100 dark:ring-gray-700">
            <div className="p-6 border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/50">
              <h2 className="text-lg font-medium flex items-center text-slate-800 dark:text-white">
                <Calculator className="w-5 h-5 mr-2 text-indigo-500" /> Fechamento
              </h2>
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              {results ? (
                <div className="space-y-6 flex-1 flex flex-col">
                  {/* Bloco Destaque */}
                  <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-inner">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cotação p/ Cliente</div>
                    <div className="text-3xl font-bold tracking-tight text-white mb-1">
                      {formatCurrency(results.companyTotalFreight)}
                    </div>
                    <div className="flex items-center text-[10px] text-slate-400 font-medium">
                      <Truck className="w-3 h-3 mr-1" /> {formatCurrency(results.companyFreightPerTon)} / Tonelada
                    </div>
                  </div>

                  {/* Detalhamento de Custos */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Frete Repassado (Motorista)</span>
                      <span className="font-semibold text-slate-800 dark:text-white">{formatCurrency(results.driverTotalValue)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Piso Mínimo + Pedágio</span>
                      <span className="font-semibold text-slate-800 dark:text-white">{formatCurrency(results.baseCost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100 dark:border-gray-700">
                      <span className="text-indigo-600 font-bold">Lucro Bruto Previsto</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(results.carrierNetProfit)}</span>
                    </div>
                  </div>

                  {/* Margem e Performance */}
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Margem Real</span>
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{results.carrierProfitMargin.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-emerald-200 dark:bg-emerald-800 rounded-full h-1.5">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(results.carrierProfitMargin * 2, 100)}%` }}></div>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="space-y-3 mt-auto pt-6">
                    {saveSuccess && (
                      <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl flex items-center text-xs font-medium border border-emerald-100 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Cotação salva no histórico!
                      </div>
                    )}
                    {!isDemoUser(currentUser) && (
                      <button onClick={handleSave} disabled={isSaving} className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold shadow-md shadow-red-200 dark:shadow-none hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:translate-y-0">
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {isSaving ? 'Salvando...' : 'Salvar no Histórico'}
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={exportToPDF} className="flex items-center justify-center px-4 py-2 border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs">
                        <Download className="w-4 h-4 mr-2" /> PDF
                      </button>
                      <button className="flex items-center justify-center px-4 py-2 border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs">
                        <FileCode className="w-4 h-4 mr-2" /> XML
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-4 py-12">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <Calculator className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-xs leading-relaxed max-w-[150px]">Preencha a origem e destino para ver os cálculos de frete.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
