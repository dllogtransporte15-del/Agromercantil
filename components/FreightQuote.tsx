import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, Calculator, Download, Save, Trash2, CheckCircle2, Truck, Building2, Navigation, Layers, DollarSign, Percent, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { saveQuote, getClients, saveClient, Client } from '../utils/storage';
import { useToast } from '../hooks/useToast';
import { autoFormatInput } from '../utils/formatters';
import { geocodeCity } from '../utils/geocoding';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import { addPdfLogo } from '../utils/pdfGenerator';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DEFAULT_CENTER: [number, number] = [-15.7801, -47.9292];

interface RouteData {
  distance: number;
  duration: number;
  coordinates: [number, number][];
  bounds: L.LatLngBounds | null;
}

interface QuoteData {
  clientName: string;
  origin: string;
  destination: string;
  distance: string;
  axes: string;
  cargoType: string;
  inputMode: 'PER_KM' | 'TOTAL' | 'PER_TON';
  valuePerKm: string;
  driverTotalValue: string;
  tollValue: string;
  anttValue: string;
  weight: string;
  margin: string;
  icms: string;
  dieselPrice: string;
  averageConsumption: string;
  driverCommissionPercent: string;
}

function MapUpdater({ routeData }: { routeData: RouteData | null }) {
  const map = useMap();
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    if (routeData?.bounds) {
      map.fitBounds(routeData.bounds, { padding: [50, 50] });
    }
    return () => clearTimeout(timeoutId);
  }, [map, routeData]);
  return null;
}

interface FreightQuoteProps {
  companyId: string;
}

export default function FreightQuote({ companyId }: FreightQuoteProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    setClients(getClients(companyId));
  }, [companyId]);

  const initialData: QuoteData = {
    clientName: '',
    origin: '',
    destination: '',
    distance: '',
    axes: '4',
    cargoType: 'Geral',
    inputMode: 'PER_KM',
    valuePerKm: '6.50',
    driverTotalValue: '',
    tollValue: '',
    anttValue: '',
    weight: '32',
    margin: '15',
    icms: '12',
    dieselPrice: '6.15',
    averageConsumption: '2.5',
    driverCommissionPercent: '10'
  };

  const [formData, setFormData] = useState<QuoteData>(initialData);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const calculateRoute = async () => {
    if (!formData.origin.trim() || !formData.destination.trim()) {
      setRouteError("Por favor, preencha origem e destino para calcular a rota.");
      return;
    }

    setIsCalculatingRoute(true);
    setRouteError(null);

    try {
      const [originCoords, destCoords] = await Promise.all([
        geocodeCity(formData.origin),
        geocodeCity(formData.destination)
      ]);

      if (!originCoords || !destCoords) {
        if (!originCoords && !destCoords) {
          throw new Error(`Não foi possível localizar a origem ("${formData.origin}") nem o destino ("${formData.destination}").`);
        } else if (!originCoords) {
          throw new Error(`Não foi possível localizar a cidade de origem: "${formData.origin}".`);
        } else {
          throw new Error(`Não foi possível localizar a cidade de destino: "${formData.destination}".`);
        }
      }

      let distanceKm = 0;
      let durationMin = 0;
      let coordinates: [number, number][] = [];

      try {
        const routeResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?overview=simplified&geometries=geojson`);
        const routeJson = await routeResponse.json();

        if (routeJson.code === 'Ok' && routeJson.routes?.length > 0) {
          const route = routeJson.routes[0];
          distanceKm = route.distance / 1000;
          durationMin = route.duration / 60;
          coordinates = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
        } else {
          throw new Error("Erro na rota OSRM");
        }
      } catch (e) {
        const R = 6371;
        const dLat = ((destCoords.lat - originCoords.lat) * Math.PI) / 180;
        const dLon = ((destCoords.lng - originCoords.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((originCoords.lat * Math.PI) / 180) * Math.cos((destCoords.lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = Math.round(R * c * 1.25);
        durationMin = (distanceKm / 70) * 60;
        coordinates = [[originCoords.lat, originCoords.lng], [destCoords.lat, destCoords.lng]];
      }

      const bounds = L.latLngBounds(coordinates);

      setRouteData({
        distance: distanceKm,
        duration: durationMin,
        coordinates,
        bounds
      });

      // Cálculo aproximado do Pedágio e Piso Mínimo ANTT
      const axesNum = parseInt(formData.axes || '6', 10);
      const mockToll = distanceKm * 0.16 * axesNum; // Média de R$ 0.16 por KM por eixo
      
      let cargoMultiplier = 1.0;
      if (formData.cargoType === 'Frigorificada') cargoMultiplier = 1.25;
      if (formData.cargoType === 'Perigosa') cargoMultiplier = 1.30;
      if (formData.cargoType === 'Granel') cargoMultiplier = 0.95;
      if (formData.cargoType === 'Container') cargoMultiplier = 1.15;
      
      const baseCostPerKm = 5.20; // R$/km base para 6 eixos (aproximado Tabela ANTT Lotação Carga Geral)
      const costPerKm = (baseCostPerKm / 6) * axesNum * cargoMultiplier;
      const loadUnloadCost = 350 * (axesNum / 6); // Taxa de Carga e Descarga
      const mockAntt = (distanceKm * costPerKm) + loadUnloadCost;

      setFormData(prev => ({
        ...prev,
        distance: distanceKm.toFixed(1),
        tollValue: mockToll.toFixed(2),
        anttValue: mockAntt.toFixed(2)
      }));

    } catch (error: any) {
      setRouteError(error.message || "Erro ao calcular a rota. Verifique os endereços informados.");
      setRouteData(null);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const formattedValue = autoFormatInput(name, value);
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    setSaveSuccess(false);
  };

  const clearFields = () => {
    setFormData(initialData);
    setRouteData(null);
    setRouteError(null);
    setSaveSuccess(false);
  };

  const result = useMemo(() => {
    const distance = parseFloat(formData.distance) || 0;
    const isPerKm = formData.inputMode === 'PER_KM';
    const isTotal = formData.inputMode === 'TOTAL';
    const isPerTon = formData.inputMode === 'PER_TON';
    
    let valuePerKm = parseFloat(formData.valuePerKm) || 0;
    let driverTotalValue = parseFloat(formData.driverTotalValue) || 0;
    
    const tollValue = parseFloat(formData.tollValue) || 0;
    const anttValue = parseFloat(formData.anttValue) || 0;
    const weight = parseFloat(formData.weight) || 1;
    const margin = parseFloat(formData.margin) || 0;
    const icms = parseFloat(formData.icms) || 0;
    
    const dieselPrice = parseFloat(formData.dieselPrice) || 0;
    const averageConsumption = parseFloat(formData.averageConsumption) || 1;
    const driverCommissionPercent = parseFloat(formData.driverCommissionPercent) || 0;

    if (!distance || (!isTotal && !valuePerKm) || (isTotal && !driverTotalValue)) return null;

    if (isTotal) {
      valuePerKm = driverTotalValue / distance;
    } else if (isPerTon) {
      driverTotalValue = valuePerKm * weight;
      valuePerKm = driverTotalValue / distance;
    } else {
      driverTotalValue = distance * valuePerKm;
    }

    const initialTotal = driverTotalValue + tollValue + anttValue;
    
    const marginMultiplier = 1 / (1 - (margin / 100));
    const valueWithMargin = initialTotal * marginMultiplier;
    
    const icmsMultiplier = 1 / (1 - (icms / 100));
    const finalTotalFreight = valueWithMargin * icmsMultiplier;

    const companyTotalFreight = finalTotalFreight;

    const driverFreightPerTon = driverTotalValue / weight;
    const companyFreightPerTon = companyTotalFreight / weight;
    
    const differenceValue = companyTotalFreight - driverTotalValue;
    const differencePercent = ((companyTotalFreight / driverTotalValue) - 1) * 100;

    const dieselCost = (distance / averageConsumption) * dieselPrice;
    const commissionValue = driverTotalValue * (driverCommissionPercent / 100);
    const driverNetProfit = driverTotalValue - dieselCost - commissionValue - tollValue;

    const carrierGrossProfit = companyTotalFreight - driverTotalValue;
    const icmsValue = companyTotalFreight * (icms / 100);
    const carrierNetProfit = carrierGrossProfit - icmsValue;
    const carrierProfitMargin = (carrierNetProfit / companyTotalFreight) * 100;

    return {
      driverTotalValue,
      valuePerKm,
      companyTotalFreight,
      driverFreightPerTon,
      companyFreightPerTon,
      differenceValue,
      differencePercent,
      taxes: {
        icmsValue,
        icmsPercent: icms
      },
      driverAnalysis: {
        dieselCost,
        commissionValue,
        netProfit: driverNetProfit
      },
      carrierAnalysis: {
        grossProfit: carrierGrossProfit,
        netProfit: carrierNetProfit,
        profitMargin: carrierProfitMargin
      }
    };
  }, [formData]);

  const handleSave = () => {
    if (!result) return;
    saveQuote({
      companyId,
      clientName: formData.clientName || 'Cliente Balcão',
      origin: formData.origin,
      destination: formData.destination,
      distance: parseFloat(formData.distance) || 0,
      axes: parseInt(formData.axes) || 4,
      cargoType: formData.cargoType,
      inputMode: formData.inputMode,
      valuePerKm: parseFloat(formData.valuePerKm) || 0,
      driverTotalValue: result.driverTotalValue,
      tollValue: parseFloat(formData.tollValue) || 0,
      anttValue: parseFloat(formData.anttValue) || 0,
      weight: parseFloat(formData.weight) || 0,
      margin: parseFloat(formData.margin) || 0,
      icms: parseFloat(formData.icms) || 0,
      dieselPrice: parseFloat(formData.dieselPrice) || 0,
      averageConsumption: parseFloat(formData.averageConsumption) || 0,
      driverCommissionPercent: parseFloat(formData.driverCommissionPercent) || 0,
      companyTotalFreight: result.companyTotalFreight,
      driverFreightPerTon: result.driverFreightPerTon,
      companyFreightPerTon: result.companyFreightPerTon,
      dieselCost: result.driverAnalysis.dieselCost,
      commissionValue: result.driverAnalysis.commissionValue,
      carrierNetProfit: result.carrierAnalysis.netProfit,
      carrierProfitMargin: result.carrierAnalysis.profitMargin
    });
    if (formData.clientName && !clients.some(c => c.name.toLowerCase() === formData.clientName.toLowerCase())) {
      saveClient(companyId, formData.clientName);
      setClients(getClients(companyId));
    }
    setSaveSuccess(true);
    showToast('Cotação salva com sucesso!', 'success');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(val);
  };

  const exportToCSV = () => {
    if (!result) return;
    const headers = ['Origem', 'Destino', 'Distancia (KM)', 'Frete Motorista', 'Frete Empresa', 'Lucro Transportadora', 'Margem (%)'];
    const row = [
      formData.origin,
      formData.destination,
      formData.distance,
      result.driverTotalValue.toFixed(2),
      result.companyTotalFreight.toFixed(2),
      result.carrierAnalysis.netProfit.toFixed(2),
      result.carrierAnalysis.profitMargin.toFixed(2)
    ];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), row.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cotacao_${formData.origin}_${formData.destination}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    addPdfLogo(doc, undefined, { align: 'right', y: 8, width: 35, height: 15 });
    doc.setFontSize(16);
    doc.text("Cotação de Frete", 14, 20);
    doc.setFontSize(10);
    doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [['Item', 'Detalhe']],
      body: [
        ['Cliente', formData.clientName || 'Não informado'],
        ['Origem', formData.origin],
        ['Destino', formData.destination],
        ['Distância', `${formData.distance} km`],
        ['Eixos / Tipo de Carga', `${formData.axes} Eixos / ${formData.cargoType}`],
        ['Peso da Carga', `${formData.weight} Toneladas`],
        ['Frete Motorista (Total)', formatCurrency(result.driverTotalValue)],
        ['Frete Motorista / Ton', formatCurrency(result.driverFreightPerTon)],
        ['Frete Empresa (Total)', formatCurrency(result.companyTotalFreight)],
        ['Frete Empresa / Ton', formatCurrency(result.companyFreightPerTon)],
        ['Lucro Líquido Transportadora', formatCurrency(result.carrierAnalysis.netProfit)],
        ['Margem Líquida Transportadora', `${formatNumber(result.carrierAnalysis.profitMargin)}%`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`cotacao_${formData.origin}_${formData.destination}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-base font-semibold flex items-center text-slate-800 mb-4">
              <MapPin className="w-4 h-4 mr-2 text-indigo-500" /> Rota e Carga
            </h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center">
                  <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Cliente
                </label>
                <input
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleInputChange}
                  list="clients-list"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Nome do cliente (opcional)"
                />
                <datalist id="clients-list">
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> Origem *
                </label>
                <input
                  type="text"
                  name="origin"
                  value={formData.origin}
                  onChange={handleInputChange}
                  list="brazilian-cities-origin"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Cidade - UF"
                />
                <datalist id="brazilian-cities-origin">
                  {BRAZILIAN_CITIES.map((c, i) => <option key={i} value={c} />)}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1.5 text-red-500" /> Destino *
                </label>
                <input
                  type="text"
                  name="destination"
                  value={formData.destination}
                  onChange={handleInputChange}
                  list="brazilian-cities-dest"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Cidade - UF"
                />
                <datalist id="brazilian-cities-dest">
                  {BRAZILIAN_CITIES.map((c, i) => <option key={i} value={c} />)}
                </datalist>
              </div>

              <button 
                onClick={calculateRoute}
                disabled={isCalculatingRoute || !formData.origin || !formData.destination}
                className="w-full mt-2 flex items-center justify-center px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {isCalculatingRoute ? 'Calculando...' : 'Traçar Rota no Mapa'}
              </button>
              
              {routeError && <div className="text-xs text-red-500 mt-2">{routeError}</div>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 flex items-center"><Navigation className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Distância (km) *</label>
              <input type="number" name="distance" value={formData.distance} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50/30" placeholder="0.00" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center"><Layers className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Eixos</label>
                <select name="axes" value={formData.axes} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="2">2 Eixos</option>
                  <option value="3">3 Eixos</option>
                  <option value="4">4 Eixos</option>
                  <option value="5">5 Eixos</option>
                  <option value="6">6 Eixos</option>
                  <option value="7">7 Eixos</option>
                  <option value="8">8 Eixos</option>
                  <option value="9">9 Eixos</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center"><Truck className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Tipo Carga</label>
                <select name="cargoType" value={formData.cargoType} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="Geral">Geral</option>
                  <option value="Frigorificada">Frigorificada</option>
                  <option value="Perigosa">Perigosa</option>
                  <option value="Granel">Granel</option>
                  <option value="Container">Container</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 flex items-center">Peso da Carga (Toneladas) *</label>
              <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 32" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-base font-semibold flex items-center text-slate-800 mb-4">
            <DollarSign className="w-4 h-4 mr-2 text-emerald-500" /> Custos Motorista (Custo Base)
          </h2>

          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="text-xs font-medium text-slate-700 mb-2 block">Modo de Inserção de Valor</label>
              <div className="flex bg-white rounded-md p-1 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, inputMode: 'PER_KM' }))}
                  className={`flex-1 py-1.5 px-2 rounded-sm text-center transition-colors ${formData.inputMode === 'PER_KM' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Por KM
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, inputMode: 'PER_TON' }))}
                  className={`flex-1 py-1.5 px-2 rounded-sm text-center transition-colors ${formData.inputMode === 'PER_TON' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Por Ton
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, inputMode: 'TOTAL' }))}
                  className={`flex-1 py-1.5 px-2 rounded-sm text-center transition-colors ${formData.inputMode === 'TOTAL' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Valor Fechado
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {formData.inputMode === 'TOTAL' ? (
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium text-slate-700">Valor Fechado Motorista (R$)</label>
                  <input type="number" step="0.01" name="driverTotalValue" value={formData.driverTotalValue} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-emerald-300 bg-emerald-50 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: 5000.00" />
                </div>
              ) : formData.inputMode === 'PER_TON' ? (
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium text-slate-700">Valor por Ton Motorista (R$)</label>
                  <input type="number" step="0.01" name="valuePerKm" value={formData.valuePerKm} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-emerald-300 bg-emerald-50 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: 150.00" />
                </div>
              ) : (
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium text-slate-700">Valor Motorista por Km (R$)</label>
                  <input type="number" step="0.01" name="valuePerKm" value={formData.valuePerKm} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-emerald-300 bg-emerald-50 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: 6.50" />
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Pedágio Estimado R$</label>
                <input type="number" step="0.01" name="tollValue" value={formData.tollValue} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Taxa ANTT R$</label>
                <input type="number" step="0.01" name="anttValue" value={formData.anttValue} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-lg">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Preço Diesel (R$)</label>
                <input type="number" step="0.01" name="dieselPrice" value={formData.dieselPrice} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 6.15" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Média Consumo (km/l)</label>
                <input type="number" step="0.1" name="averageConsumption" value={formData.averageConsumption} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 2.5" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-medium text-slate-700">Comissão Motorista (% do Frete Líquido)</label>
                <input type="number" step="0.1" name="driverCommissionPercent" value={formData.driverCommissionPercent} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 10" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-base font-semibold flex items-center text-slate-800 mb-4">
            <Percent className="w-4 h-4 mr-2 text-indigo-500" /> Margens p/ Cliente Final
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Margem Desejada (%)</label>
              <div className="relative">
                <input type="number" step="0.1" name="margin" value={formData.margin} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-indigo-300 bg-indigo-50 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-8" placeholder="Ex: 15" />
                <Percent className="w-3.5 h-3.5 text-indigo-400 absolute right-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Aliquota ICMS (%)</label>
              <div className="relative">
                <input type="number" step="0.1" name="icms" value={formData.icms} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-8" placeholder="Ex: 12" />
                <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="xl:col-span-8 flex flex-col gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-72 lg:h-96 relative z-0">
          <MapContainer center={DEFAULT_CENTER} zoom={4} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
            {routeData && (
              <>
                <Polyline positions={routeData.coordinates} color="#4F46E5" weight={4} opacity={0.7} />
                <Marker position={routeData.coordinates[0]}>
                  <Popup><strong>Origem:</strong> {formData.origin}</Popup>
                </Marker>
                <Marker position={routeData.coordinates[routeData.coordinates.length - 1]}>
                  <Popup><strong>Destino:</strong> {formData.destination}</Popup>
                </Marker>
                <MapUpdater routeData={routeData} />
              </>
            )}
          </MapContainer>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-base font-semibold flex items-center text-slate-800">
              <Calculator className="w-4 h-4 mr-2 text-indigo-500" /> Resultados da Cotação
            </h2>
          </div>
          
          <div className="p-5 flex-1 flex flex-col">
            {result ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border text-center border-slate-200 rounded-xl p-4 shadow-sm h-full flex flex-col justify-center">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-center">
                      <Truck className="w-3.5 h-3.5 mr-1" /> Frete Empresa (P/ o Cliente)
                    </div>
                    <div className="text-3xl font-bold text-slate-900 my-2">
                      {formatCurrency(result.companyTotalFreight)}
                    </div>
                    <div className="text-sm font-medium text-indigo-600 bg-indigo-50 py-1.5 px-3 rounded-md mx-auto inline-block mt-2">
                      {formatCurrency(result.companyFreightPerTon)} / Tonelada
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm flex flex-col justify-center text-center">
                    <div className="text-xs font-semibold text-emerald-700 uppercase tracking-widest mb-1 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 mr-1" /> Lucro Líquido Transportadora
                    </div>
                    <div className="text-3xl font-bold text-emerald-600 my-2">
                      {formatCurrency(result.carrierAnalysis.netProfit)}
                    </div>
                    <div className="text-sm font-medium text-emerald-700">
                      Margem Final: {formatNumber(result.carrierAnalysis.profitMargin)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-700">Detalhamento Motorista (Custo)</div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">Valor Bruto Motorista</span>
                        <span className="font-medium">{formatCurrency(result.driverTotalValue)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-red-600">
                        <span>Custo Diesel (Est.)</span>
                        <span>-{formatCurrency(result.driverAnalysis.dieselCost)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-red-600">
                        <span>Pedágio</span>
                        <span>-{formatCurrency(parseFloat(formData.tollValue) || 0)}</span>
                      </div>
                       <div className="flex justify-between items-center text-sm text-red-600">
                        <span>Comissão (Motorista)</span>
                        <span>-{formatCurrency(result.driverAnalysis.commissionValue)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center">
                        <span className="font-semibold text-slate-800">Sobra Líquida Estimada</span>
                        <span className="font-bold text-emerald-600">{formatCurrency(result.driverAnalysis.netProfit)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-700">Detalhamento Transportadora (Cliente)</div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">Frete Bruto Fechado</span>
                        <span className="font-medium">{formatCurrency(result.companyTotalFreight)}</span>
                      </div>
                       <div className="flex justify-between items-center text-sm text-red-600">
                        <span>Repasse Motorista total</span>
                        <span>-{formatCurrency(result.driverTotalValue + parseFloat(formData.tollValue||'0') + parseFloat(formData.anttValue||'0'))}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-red-600">
                        <span>Imposto ICMS ({(result.taxes.icmsPercent)}%)</span>
                        <span>-{formatCurrency(result.taxes.icmsValue)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t flex justify-between items-center text-slate-800">
                        <span className="font-semibold text-slate-800">Lucro Líquido Real</span>
                        <span className="font-bold text-emerald-600">{formatCurrency(result.carrierAnalysis.netProfit)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mt-6 pt-6 border-t border-slate-100">
                  {saveSuccess && (
                    <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg flex items-center text-sm font-medium border border-emerald-100 mb-4">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                      Cotação salva com sucesso no histórico!
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={handleSave} className="flex-1 flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm">
                      <Save className="w-4 h-4 mr-2" /> Salvar Cotação
                    </button>
                    <button onClick={exportToCSV} className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm">
                      <FileText className="w-4 h-4 mr-2" /> CSV
                    </button>
                    <button onClick={exportToPDF} className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm">
                      <Download className="w-4 h-4 mr-2" /> PDF
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-4 py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                  <Calculator className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm max-w-[250px]">Preencha todos os campos obrigatórios para visualizar a análise completa de viabilidade.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
