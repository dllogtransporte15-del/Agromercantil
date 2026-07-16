
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
  FileCode, Clock, Search, Package, History, ExternalLink
} from 'lucide-react';
import Header from '../components/Header';
import { saveToolQuote, getToolQuotes, getToolClients, saveToolClient, ToolClient, QuoteRecord } from '../services/api/toolsApi';
import type { User as AppUser } from '../types';

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
  productName: string;
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

export default function FreightQuotePage({ currentUser }: FreightQuotePageProps) {
  const [clients, setClients] = useState<ToolClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [originCoords, setOriginCoords] = useState<Location | null>(null);
  const [destCoords, setDestCoords] = useState<Location | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentQuotes, setRecentQuotes] = useState<QuoteRecord[]>([]);

  const loadClients = useCallback(async () => {
    if (!currentUser) return;
    const data = await getToolClients(currentUser.authId || currentUser.id);
    setClients(data);
  }, [currentUser]);

  const loadRecentQuotes = useCallback(async () => {
    if (!currentUser) return;
    const data = await getToolQuotes(currentUser.authId || currentUser.id);
    setRecentQuotes(data.slice(0, 10));
  }, [currentUser]);

  useEffect(() => {
    loadClients();
    loadRecentQuotes();
  }, [loadClients, loadRecentQuotes]);

  const initialData: QuoteData = {
    clientName: '',
    productName: '',
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
    margin: '10',
    icms: '0',
    dieselPrice: '0',
    averageConsumption: '0',
    driverCommissionPercent: '0'
  };

  const [formData, setFormData] = useState<QuoteData>(initialData);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSaveSuccess(false);
  };

  const fetchCoordinates = async (address: string) => {
    try {
      const cleanAddress = address.trim().replace(/\s+-\s+Brasil$/i, '').replace(/,\s*Brasil$/i, '');
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress + ', Brasil')}&limit=1&accept-language=pt-br&countrycodes=br`);
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          label: data[0].display_name
        };
      }
      return null;
    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  };

  const calculateRoute = async () => {
    if (!formData.origin || !formData.destination) {
      setError('Informe a origem e o destino para calcular a rota.');
      return;
    }

    setLoading(true);
    setError(null);
    setRouteInfo(null);

    try {
      const origin = await fetchCoordinates(formData.origin);
      const dest = await fetchCoordinates(formData.destination);

      if (!origin || !dest) {
        setError('Não foi possível localizar um dos endereços.');
        setLoading(false);
        return;
      }

      setOriginCoords(origin);
      setDestCoords(dest);

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

        // Cálculo Estimado (Mock) dos sites para a distância e número de eixos informados
        // Em um ambiente de produção sem CORS, deve-se integrar APIs como API Routes, Aptrack, Tarifa de Pedágios.
        const eixos = parseInt(formData.axes) || 6;
        const baseAnttEstimate = distanceKm * eixos * 1.458; // Base aproximada Mínimo ANTT
        const baseTollEstimate = distanceKm * eixos * 0.198; // Base aproximada de pedágio (1/2 centavos por KM/Eixo)

        setFormData(prev => ({
          ...prev,
          anttValue: baseAnttEstimate.toFixed(2),
          tollValue: baseTollEstimate.toFixed(2)
        }));

      } else {
        setError('Não foi possível calcular a rota.');
      }
    } catch (err) {
      setError('Erro ao conectar com o serviço de mapas.');
    } finally {
      setLoading(false);
    }
  };

  const results = useMemo(() => {
    if (!routeInfo) return null;

    const distance = routeInfo.distance;
    const weight = parseFloat(formData.weight) || 0;
    const toll = parseFloat(formData.tollValue) || 0;
    const antt = parseFloat(formData.anttValue) || 0;
    const baseCost = antt + toll;
    const driverValueInput = parseFloat(formData.driverValue) || 0;
    const marginInput = parseFloat(formData.margin) || 0;

    let driverTotalValue = 0;
    let driverFreightPerTon = 0;

    if (formData.inputMode === 'PER_TON') {
      driverFreightPerTon = driverValueInput;
      driverTotalValue = driverValueInput * weight;
    } else if (formData.inputMode === 'PER_KM') {
      driverTotalValue = driverValueInput * distance;
      driverFreightPerTon = weight > 0 ? driverTotalValue / weight : 0;
    }

    let companyFreightPerTon = 0;
    if (marginInput >= 100) {
      companyFreightPerTon = driverFreightPerTon;
    } else {
      companyFreightPerTon = driverFreightPerTon / (1 - (marginInput / 100));
    }

    const companyTotalFreight = companyFreightPerTon * weight;
    
    const differenceFromBase = driverTotalValue - baseCost;
    const isValid = differenceFromBase >= 0;

    return {
      distance,
      baseCost,
      driverTotalValue,
      driverFreightPerTon,
      companyTotalFreight,
      companyFreightPerTon,
      marginPercent: marginInput,
      differenceFromBase,
      isValid,
      // Default zero compat
      dieselCost: 0,
      commissionValue: 0,
      carrierNetProfit: companyTotalFreight - driverTotalValue,
      carrierProfitMargin: marginInput
    };
  }, [formData, routeInfo]);

  const handleSave = async () => {
    if (!results || !routeInfo || isSaving) return;

    setIsSaving(true);
    try {
      if (!currentUser) throw new Error('Usuário não autenticado');

      if (formData.clientName) {
        await saveToolClient(currentUser.authId || currentUser.id, formData.clientName);
        await loadClients();
      }

      const saved = await saveToolQuote(currentUser.authId || currentUser.id, {
        clientName: formData.clientName || 'Não Informado',
        productName: formData.productName || undefined,
        userName: currentUser.name || undefined,
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
        loadRecentQuotes(); // Atualiza o painel de cotações recentes
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

  const exportToPDF = () => {
    if (!results || !routeInfo) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Cotação de Frete', 14, 22);

    autoTable(doc, {
      startY: 35,
      head: [['Especificação', 'Detalhes']],
      body: [
        ['Data da Cotação', format(new Date(), 'dd/MM/yyyy HH:mm')],
        ['Usuário', currentUser?.name || 'Não Identificado'],
        ['Cliente', formData.clientName || 'Não Informado'],
        ['Produto', formData.productName || 'Não Informado'],
        ['Origem', formData.origin],
        ['Destino', formData.destination],
        ['Nº de Eixos', `${formData.axes} Eixos`],
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

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <Package className="w-4 h-4 mr-1.5 text-slate-400" /> Produto
                </label>
                <input type="text" name="productName" value={formData.productName} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" placeholder="Ex: Soja, Milho (opcional)" />
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                    <MapPin className="w-4 h-4 mr-1.5 text-emerald-500" /> Origem
                  </label>
                  <input type="text" name="origin" value={formData.origin} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" placeholder="Ex: Cuiabá, MT" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                    <MapPin className="w-4 h-4 mr-1.5 text-red-500" /> Destino
                  </label>
                  <input type="text" name="destination" value={formData.destination} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" placeholder="Ex: Santos, SP" />
                </div>

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

              <button onClick={calculateRoute} disabled={loading} className="w-full flex items-center justify-center px-4 py-2.5 bg-slate-900 dark:bg-gray-700 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm disabled:opacity-50 mt-4">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} BUSCAR ROTA
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
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Margem de Lucro Prevista (%)</label>
                  <div className="relative">
                    <input type="number" step="0.1" name="margin" value={formData.margin} onChange={handleInputChange} className="w-full pr-8 px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm font-semibold text-right focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Frete Empresa (R$/Ton)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                    <input type="text" readOnly title="O Frete Empresa é calculado automaticamente." value={results ? results.companyFreightPerTon.toFixed(2) : '0.00'} className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm font-bold text-slate-500 outline-none cursor-not-allowed" />
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
        <div className="xl:col-span-3 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden flex flex-col ring-1 ring-slate-100 dark:ring-gray-700">
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
                    <button onClick={handleSave} disabled={isSaving} className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold shadow-md shadow-red-200 dark:shadow-none hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:translate-y-0">
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      {isSaving ? 'Salvando...' : 'Salvar no Histórico'}
                    </button>
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

          {/* Painel: Últimas Cotações Salvas */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden ring-1 ring-slate-100 dark:ring-gray-700">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/50 flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center text-slate-700 dark:text-white">
                <History className="w-4 h-4 mr-2 text-indigo-500" /> Últimas Cotações
              </h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {recentQuotes.length} registros
              </span>
            </div>

            <div className="divide-y divide-slate-50 dark:divide-gray-700/50 max-h-[520px] overflow-y-auto">
              {recentQuotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <History className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">Nenhuma cotação salva ainda.</p>
                </div>
              ) : (
                recentQuotes.map((q) => {
                  const d = new Date(q.date);
                  const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const formatCurr = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

                  return (
                    <div
                      key={q.id}
                      className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors group"
                    >
                      {/* Linha 1: Rota + Valor */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-gray-200 truncate">
                          <span className="truncate max-w-[80px]" title={q.origin}>{q.origin.split(',')[0]}</span>
                          <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                          <span className="truncate max-w-[80px]" title={q.destination}>{q.destination.split(',')[0]}</span>
                        </div>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                          {formatCurr(q.companyFreightPerTon)}
                        </span>
                      </div>

                      {/* Linha 2: Cliente + Produto */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 truncate">
                        {q.clientName && (
                          <span className="flex items-center gap-1 truncate">
                            <Building2 className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{q.clientName}</span>
                          </span>
                        )}
                        {q.productName && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Package className="w-2.5 h-2.5" />
                            {q.productName}
                          </span>
                        )}
                      </div>

                      {/* Linha 3: Meta-info */}
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-medium">{q.axes}ei</span>
                          <span className="bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-medium">{q.distance.toFixed(0)} km</span>
                          <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">{q.margin.toFixed(1)}%</span>
                        </div>
                        <span className="text-[10px] text-slate-300 dark:text-gray-600">{dateStr} {timeStr}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
