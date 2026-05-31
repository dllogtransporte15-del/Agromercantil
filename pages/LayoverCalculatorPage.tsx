
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Calculator, Download, FileText, Truck, Clock, 
  MapPin, FileDigit, User, Weight, DollarSign, 
  Save, Trash2, CheckCircle2, Building2, Loader2 
} from 'lucide-react';
import Header from '../components/Header';
import { saveToolStay, getToolClients, saveToolClient, ToolClient, getAllToolClients } from '../services/api/toolsApi';
import { User as AppUser, Shipment, Cargo, Client as AppClient, ShipmentStatus, UserProfile } from '../types';

interface StayData {
  clientName: string;
  driver: string;
  plate: string;
  invoice: string;
  origin: string;
  destination: string;
  location: 'Origem' | 'Destino';
  weight: string;
  valuePerHour: string;
  tolerance: string;
  entryDate: string;
  exitDate: string;
  shipmentId?: string;
}

interface LayoverCalculatorPageProps {
  currentUser: AppUser | null;
  shipments: Shipment[];
  cargos: Cargo[];
  clients: AppClient[];
}

export default function LayoverCalculatorPage({ currentUser, shipments, cargos, clients: appClients }: LayoverCalculatorPageProps) {
  const [clients, setClients] = useState<ToolClient[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadClients = useCallback(async () => {
    if (!currentUser) return;
    const isAdmin = [UserProfile.Admin, UserProfile.Diretor, UserProfile.Coordenador].includes(currentUser.profile);
    const data = await (isAdmin ? getAllToolClients() : getToolClients(currentUser.authId || currentUser.id));
    setClients(data);
  }, [currentUser]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const initialData: StayData = {
    clientName: '',
    driver: '',
    plate: '',
    invoice: '',
    origin: '',
    destination: '',
    location: 'Origem',
    weight: '',
    valuePerHour: '',
    tolerance: '',
    entryDate: '',
    exitDate: '',
    shipmentId: ''
  };

  const [formData, setFormData] = useState<StayData>(initialData);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [shipmentSearchTerm, setShipmentSearchTerm] = useState('');
  const [isShipmentDropdownOpen, setIsShipmentDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsShipmentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setSaveSuccess(false);
  };

  const clearFields = () => {
    setFormData(initialData);
    setSaveSuccess(false);
    setShipmentSearchTerm('');
  };

  const handleShipmentSelect = (shipmentId: string) => {
    if (!shipmentId) {
      setFormData(prev => ({ ...prev, shipmentId: '' }));
      setShipmentSearchTerm('');
      setIsShipmentDropdownOpen(false);
      return;
    }

    const shipment = shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    const cargo = cargos.find(c => c.id === shipment.cargoId);
    const client = cargo ? appClients.find(c => c.id === cargo.clientId) : null;

    setFormData(prev => ({
      ...prev,
      shipmentId,
      driver: shipment.driverName || '',
      plate: shipment.horsePlate || '',
      weight: shipment.shipmentTonnage ? shipment.shipmentTonnage.toString() : '',
      origin: cargo?.origin || '',
      destination: cargo?.destination || '',
      clientName: client?.nomeFantasia || client?.razaoSocial || prev.clientName,
    }));
    setShipmentSearchTerm(`${shipment.horsePlate} - ${shipment.driverName} - ID: ${shipment.id}`);
    setIsShipmentDropdownOpen(false);
    setSaveSuccess(false);
  };

  const availableShipments = shipments.filter(s => s.status !== ShipmentStatus.Cancelado);
  
  const filteredShipments = availableShipments.filter(s => {
    const term = shipmentSearchTerm.toLowerCase();
    // If empty term or if it is currently matching the selected shipment (which we set as the full string), show all.
    if (!term || formData.shipmentId) return true;
    return s.id.toLowerCase().includes(term) ||
           (s.horsePlate && s.horsePlate.toLowerCase().includes(term)) ||
           (s.driverName && s.driverName.toLowerCase().includes(term));
  });

  const result = useMemo(() => {
    const weight = parseFloat(formData.weight) || 0;
    const valuePerHour = parseFloat(formData.valuePerHour) || 0;
    const tolerance = parseFloat(formData.tolerance) || 0;

    if (!formData.entryDate || !formData.exitDate || !weight || !valuePerHour) return null;

    const entry = parseISO(formData.entryDate);
    const exit = parseISO(formData.exitDate);
    
    const totalMinutes = differenceInMinutes(exit, entry);
    if (totalMinutes < 0) return null;

    const totalHours = totalMinutes / 60;
    const chargeableHours = Math.max(0, totalHours - tolerance);
    const totalValue = chargeableHours * weight * valuePerHour;

    return {
      totalMinutes,
      totalHours,
      chargeableHours,
      totalValue,
      tolerance
    };
  }, [formData]);

  const handleSave = async () => {
    if (!result || isSaving || !currentUser) return;
    
    if (!formData.driver || !formData.plate || !formData.origin || !formData.destination) {
      alert("Por favor, preencha os campos obrigatórios (Motorista, Placa, Origem, Destino).");
      return;
    }

    setIsSaving(true);
    try {
      if (formData.clientName) {
        await saveToolClient(currentUser.authId || currentUser.id, formData.clientName);
        await loadClients();
      }

      const saved = await saveToolStay(currentUser.authId || currentUser.id, {
        clientName: formData.clientName || 'Não Informado',
        driver: formData.driver,
        plate: formData.plate,
        invoice: formData.invoice,
        origin: formData.origin,
        destination: formData.destination,
        location: formData.location,
        entryDate: formData.entryDate,
        exitDate: formData.exitDate,
        totalHours: result.totalHours,
        weight: parseFloat(formData.weight) || 0,
        valuePerHour: parseFloat(formData.valuePerHour) || 0,
        tolerance: parseFloat(formData.tolerance) || 0,
        totalValue: result.totalValue,
        shipmentId: formData.shipmentId || undefined
      });

      if (saved) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Erro ao salvar estadia. Verifique sua conexão.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  };

  const formatDuration = (minutes: number) => {
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
    
    return parts.join(' ');
  };

  const exportToCSV = () => {
    if (!result) return;
    
    const headers = [
      'Cliente', 'Motorista', 'Placa', 'Nota Fiscal', 'Origem', 'Destino', 'Local', 
      'Entrada', 'Saída', 'Peso (Ton)', 'Valor Ton/Hora', 
      'Tolerância (h)', 'Tempo Total (h)', 'Horas Cobráveis', 'Valor Total'
    ];
    
    const row = [
      formData.clientName || 'Não Informado',
      formData.driver,
      formData.plate,
      formData.invoice,
      formData.origin,
      formData.destination,
      formData.location,
      formData.entryDate ? format(parseISO(formData.entryDate), 'dd/MM/yyyy HH:mm') : '',
      formData.exitDate ? format(parseISO(formData.exitDate), 'dd/MM/yyyy HH:mm') : '',
      formData.weight,
      formData.valuePerHour,
      formData.tolerance,
      result.totalHours.toFixed(2),
      result.chargeableHours.toFixed(2),
      result.totalValue.toFixed(2)
    ];

    const csvContent = [headers.join(','), row.map(v => `"${v}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `estadia_${formData.plate || 'relatorio'}.csv`);
    link.click();
  };

  const exportToPDF = () => {
    if (!result) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Cálculo de Estadia', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['Campo', 'Valor']],
      body: [
        ['Cliente', formData.clientName || 'Não Informado'],
        ['Motorista', formData.driver || '-'],
        ['Placa do Veículo', formData.plate || '-'],
        ['Nota Fiscal', formData.invoice || '-'],
        ['Origem', formData.origin || '-'],
        ['Destino', formData.destination || '-'],
        ['Local do Evento', formData.location],
        ['Data/Hora de Entrada', formData.entryDate ? format(parseISO(formData.entryDate), 'dd/MM/yyyy HH:mm') : '-'],
        ['Data/Hora de Saída', formData.exitDate ? format(parseISO(formData.exitDate), 'dd/MM/yyyy HH:mm') : '-'],
        ['Peso', `${formatNumber(parseFloat(formData.weight) || 0)} Toneladas`],
        ['Valor Tonelada/Hora', formatCurrency(parseFloat(formData.valuePerHour) || 0)],
        ['Tolerância', `${parseFloat(formData.tolerance) || 0} horas`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 40;

    autoTable(doc, {
      startY: finalY + 10,
      head: [['Resumo do Cálculo', '']],
      body: [
        ['Tempo Total Decorrido', `${formatNumber(result.totalHours, 1)} horas (${formatDuration(result.totalMinutes)})`],
        ['Horas Cobráveis', `${formatNumber(result.chargeableHours, 1)} horas`],
        ['Fórmula Aplicada', `${formatNumber(result.chargeableHours, 1)} × ${formatNumber(parseFloat(formData.weight) || 0)} × ${formatNumber(parseFloat(formData.valuePerHour) || 0)}`],
        ['Valor Total a Pagar', formatCurrency(result.totalValue)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } }
    });

    doc.save(`estadia_${formData.plate || 'relatorio'}.pdf`);
  };

  return (
    <>
      <Header title="Cálculo de Estadias" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium flex items-center text-slate-800 dark:text-gray-200">
                <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                Dados da Estadia
              </h2>
              <button onClick={clearFields} className="text-sm text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center transition-colors">
                <Trash2 className="w-4 h-4 mr-1" /> Limpar Campos
              </button>
            </div>
            
            <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl">
              <label className="text-sm font-medium text-indigo-900 dark:text-indigo-300 flex items-center mb-2">
                Vincular a um Embarque (Opcional)
              </label>
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text"
                  placeholder="Pesquise por placa, motorista ou ID..."
                  value={shipmentSearchTerm}
                  onChange={(e) => {
                    setShipmentSearchTerm(e.target.value);
                    if (formData.shipmentId) setFormData(prev => ({ ...prev, shipmentId: '' }));
                    setIsShipmentDropdownOpen(true);
                  }}
                  onFocus={() => setIsShipmentDropdownOpen(true)}
                  className="w-full px-3 py-2 border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                
                {isShipmentDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div 
                      className="px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm text-slate-600 dark:text-gray-400 border-b border-indigo-50 dark:border-indigo-900/50"
                      onClick={() => handleShipmentSelect('')}
                    >
                      -- Não vincular (avulso) --
                    </div>
                    {filteredShipments.length > 0 ? (
                      filteredShipments.map(s => {
                        const cargo = cargos.find(c => c.id === s.cargoId);
                        const client = cargo ? appClients.find(c => c.id === cargo.clientId) : null;
                        const isSelected = formData.shipmentId === s.id;
                        return (
                          <div 
                            key={s.id} 
                            onClick={() => handleShipmentSelect(s.id)}
                            className={`px-3 py-2 cursor-pointer text-sm transition-colors ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-200' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-gray-300'}`}
                          >
                            <div className="font-medium">{s.horsePlate} - {s.driverName}</div>
                            <div className="text-xs opacity-75 mt-0.5">
                              ID: {s.id} | {client?.nomeFantasia || client?.razaoSocial || 'Sem cliente'} | {cargo?.origin} → {cargo?.destination}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-gray-400">
                        Nenhum embarque encontrado
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                Selecionar um embarque preencherá automaticamente os dados do Motorista, Placa, Peso, Origem e Destino.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <Building2 className="w-4 h-4 mr-1.5 text-slate-400" /> Cliente (Opcional)
                </label>
                <input type="text" name="clientName" value={formData.clientName} onChange={handleInputChange} list="clients-list" className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Clique para selecionar ou digite um novo" />
                <datalist id="clients-list">
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <User className="w-4 h-4 mr-1.5 text-slate-400" /> Motorista *
                </label>
                <input type="text" name="driver" value={formData.driver} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <Truck className="w-4 h-4 mr-1.5 text-slate-400" /> Placa *
                </label>
                <input type="text" name="plate" value={formData.plate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="ABC-1234" />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <FileDigit className="w-4 h-4 mr-1.5 text-slate-400" /> Nota Fiscal
                </label>
                <input type="text" name="invoice" value={formData.invoice} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <MapPin className="w-4 h-4 mr-1.5 text-slate-400" /> Origem *
                </label>
                <input type="text" name="origin" value={formData.origin} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <MapPin className="w-4 h-4 mr-1.5 text-slate-400" /> Destino *
                </label>
                <input type="text" name="destination" value={formData.destination} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <MapPin className="w-4 h-4 mr-1.5 text-slate-400" /> Local do Evento
                </label>
                <select name="location" value={formData.location} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white dark:bg-gray-700">
                  <option value="Origem">Origem (Carregamento)</option>
                  <option value="Destino">Destino (Descarregamento)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <Weight className="w-4 h-4 mr-1.5 text-slate-400" /> Peso (Toneladas) *
                </label>
                <input type="number" step="0.01" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="57.94" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <DollarSign className="w-4 h-4 mr-1.5 text-slate-400" /> Valor Ton/Hora (R$) *
                </label>
                <input type="number" step="0.01" name="valuePerHour" value={formData.valuePerHour} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Tolerância (Horas)
                </label>
                <input type="number" step="0.5" name="tolerance" value={formData.tolerance} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="12" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Entrada *
                </label>
                <input type="datetime-local" name="entryDate" value={formData.entryDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Saída *
                </label>
                <input type="datetime-local" name="exitDate" value={formData.exitDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/50">
              <h2 className="text-lg font-medium flex items-center text-slate-800 dark:text-gray-200">
                <Calculator className="w-5 h-5 mr-2 text-indigo-500" />
                Resumo do Cálculo
              </h2>
            </div>
            
            <div className="p-6 flex-1 flex flex-col font-sans">
              {result ? (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-100 dark:border-gray-700">
                      <div className="text-xs font-medium text-slate-500 dark:text-gray-400 uppercase mb-1">Tempo Total</div>
                      <div className="text-xl font-semibold text-slate-900 dark:text-white">{formatNumber(result.totalHours, 1)}h</div>
                      <div className="text-xs text-slate-400 mt-1">{formatDuration(result.totalMinutes)}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-100 dark:border-gray-700">
                      <div className="text-xs font-medium text-slate-500 dark:text-gray-400 uppercase mb-1">Horas Cobráveis</div>
                      <div className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">{formatNumber(result.chargeableHours, 1)}h</div>
                      <div className="text-xs text-slate-400 mt-1">Desconto de {result.tolerance}h</div>
                    </div>
                  </div>

                  <div className="space-y-3 py-4 border-y border-slate-100 dark:border-gray-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-gray-400">Peso da Carga</span>
                      <span className="font-medium text-slate-900 dark:text-white">{formatNumber(parseFloat(formData.weight) || 0)} Ton</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-gray-400">Valor p/ Ton/Hora</span>
                      <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(parseFloat(formData.valuePerHour) || 0)}</span>
                    </div>
                  </div>

                  <div className="pt-2 pb-6">
                    <div className="text-sm font-medium text-slate-500 dark:text-gray-400 uppercase mb-2">Valor Total a Pagar</div>
                    <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {formatCurrency(result.totalValue)}
                    </div>
                  </div>

                  <div className="space-y-3 mt-auto">
                    {saveSuccess && (
                      <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl flex items-center text-sm font-medium border border-emerald-100">
                        <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-500" />
                        Salvo com sucesso!
                      </div>
                    )}
                    <button onClick={handleSave} disabled={isSaving} className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-60">
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      {isSaving ? 'Salvando...' : 'Salvar Estadia'}
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={exportToCSV} className="flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 font-medium text-sm">
                        <FileText className="w-4 h-4 mr-2" /> CSV
                      </button>
                      <button onClick={exportToPDF} className="flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 font-medium text-sm">
                        <Download className="w-4 h-4 mr-2" /> PDF
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-4 py-12">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <Calculator className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm max-w-[250px]">Preencha os campos obrigatórios para visualizar o cálculo.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
