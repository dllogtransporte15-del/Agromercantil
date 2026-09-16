
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  History as HistoryIcon, Search, Filter, Download, FileText, 
  Truck, Calendar, MapPin, User, Trash2, ChevronRight, 
  ArrowRight, DollarSign, Clock, FileDigit, Building2,
  ChevronDown, ChevronUp, X, FileCode, Scale, Fuel, Route, Paperclip
} from 'lucide-react';
import Header from '../components/Header';
import { 
  getToolStays, getToolQuotes, StayRecord, QuoteRecord, 
  getToolClients, ToolClient, deleteToolStay, deleteToolQuote, updateToolStay, uploadStayAttachment,
  getAllToolStays, getAllToolQuotes, getAllToolClients
} from '../utils/toolStorage';
import { getShipmentAttachmentUrl } from '../lib/db';
import type { User as AppUser, Shipment, Cargo, Client as AppClient } from '../types';
import { UserProfile, ShipmentStatus } from '../types';
import { isDemoUser } from '../auth';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { openDocumentInNewTab } from '../utils/documentViewer';
import { addPdfLogo } from '../utils/pdfGenerator';

interface ToolsHistoryPageProps {
  currentUser: AppUser | null;
  shipments?: Shipment[];
  cargos?: Cargo[];
  clients?: AppClient[];
}

export default function ToolsHistoryPage({ currentUser, shipments = [], cargos = [], clients: propsClients = [] }: ToolsHistoryPageProps) {
  const isDemo = isDemoUser(currentUser);
  const [activeView, setActiveView] = useState<'estadias' | 'cotacoes'>('estadias');
  const [stays, setStays] = useState<StayRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [clients, setClients] = useState<ToolClient[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; name?: string; category?: string } | null>(null);

  const [editValues, setEditValues] = useState<{
    id: string, 
    approved: string, 
    paid: string, 
    cteFile?: File | null, 
    paymentFile?: File | null,
    clientName: string,
    driver: string,
    plate: string,
    weight: string,
    origin: string,
    destination: string,
    shipmentId: string,
    invoice: string
  } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
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

  const [searchTerm, setSearchTerm] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    
    // Check if user is an administrator/manager who should see everything
    const isAdmin = !isDemo && [UserProfile.Admin, UserProfile.Diretor, UserProfile.Supervisor].includes(currentUser.profile);
    
    const [staysData, quotesData, clientsData] = await Promise.all([
      isAdmin ? getAllToolStays() : getToolStays(currentUser.id),
      isAdmin ? getAllToolQuotes() : getToolQuotes(currentUser.id),
      isAdmin ? getAllToolClients() : getToolClients(currentUser.id),
    ]);
    
    setStays(staysData);
    setQuotes(quotesData);
    setClients(clientsData);
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredStays = useMemo(() => {
    return stays.filter(stay => {
      const matchesSearch = 
        stay.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stay.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stay.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stay.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stay.clientName && stay.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesClient = !filterClient || stay.clientName === filterClient;

      let matchesDate = true;
      if (dateStart || dateEnd) {
        const stayDate = parseISO(stay.date);
        const start = dateStart ? startOfDay(parseISO(dateStart)) : new Date(0);
        const end = dateEnd ? endOfDay(parseISO(dateEnd)) : new Date();
        matchesDate = isWithinInterval(stayDate, { start, end });
      }

      return matchesSearch && matchesClient && matchesDate;
    });
  }, [stays, searchTerm, filterClient, dateStart, dateEnd]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = 
        quote.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (quote.clientName && quote.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesClient = !filterClient || quote.clientName === filterClient;

      let matchesDate = true;
      if (dateStart || dateEnd) {
        const quoteDate = parseISO(quote.date);
        const start = dateStart ? startOfDay(parseISO(dateStart)) : new Date(0);
        const end = dateEnd ? endOfDay(parseISO(dateEnd)) : new Date();
        matchesDate = isWithinInterval(quoteDate, { start, end });
      }

      return matchesSearch && matchesClient && matchesDate;
    });
  }, [quotes, searchTerm, filterClient, dateStart, dateEnd]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditValues(null);
      setShipmentSearchTerm('');
      setIsShipmentDropdownOpen(false);
    } else {
      setExpandedId(id);
      const stay = stays.find(s => s.id === id);
      if (stay && activeView === 'estadias') {
        setEditValues({
          id,
          approved: stay.approvedValue != null ? stay.approvedValue.toString() : '',
          paid: stay.driverPaidValue != null ? stay.driverPaidValue.toString() : '',
          clientName: stay.clientName || '',
          driver: stay.driver || '',
          plate: stay.plate || '',
          weight: stay.weight != null ? stay.weight.toString() : '',
          origin: stay.origin || '',
          destination: stay.destination || '',
          shipmentId: stay.shipmentId || '',
          invoice: stay.invoice || ''
        });
        
        if (stay.shipmentId && (shipments || []).length > 0) {
          const s = (shipments || []).find(sh => sh.id === stay.shipmentId);
          if (s) {
            setShipmentSearchTerm(`${s.horsePlate} - ${s.driverName} - ID: ${s.id}`);
          } else {
            setShipmentSearchTerm(`ID: ${stay.shipmentId}`);
          }
        } else {
          setShipmentSearchTerm('');
        }
      } else {
        setEditValues(null);
        setShipmentSearchTerm('');
      }
      setIsShipmentDropdownOpen(false);
    }
  };

  const handleShipmentSelect = (shipmentId: string) => {
    if (!editValues) return;

    if (!shipmentId) {
      setEditValues(prev => prev ? { ...prev, shipmentId: '' } : null);
      setShipmentSearchTerm('');
      setIsShipmentDropdownOpen(false);
      return;
    }

    const shipment = (shipments || []).find(s => s.id === shipmentId);
    if (!shipment) return;

    const cargo = (cargos || []).find(c => c.id === shipment.cargoId);
    const client = cargo ? (propsClients || []).find(c => c.id === cargo.clientId) : null;

    setEditValues(prev => prev ? ({
      ...prev,
      shipmentId,
      driver: shipment.driverName || prev.driver,
      plate: shipment.horsePlate || prev.plate,
      weight: shipment.shipmentTonnage ? shipment.shipmentTonnage.toString() : prev.weight,
      origin: cargo?.origin || prev.origin,
      destination: cargo?.destination || prev.destination,
      clientName: client?.nomeFantasia || client?.razaoSocial || prev.clientName,
    }) : null);
    
    setShipmentSearchTerm(`${shipment.horsePlate} - ${shipment.driverName} - ID: ${shipment.id}`);
    setIsShipmentDropdownOpen(false);
  };

  const parseFlexibleNumber = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (str.includes('.') && str.includes(',')) {
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        return parseFloat(str.replace(/,/g, '')) || 0;
      }
    }
    if (str.includes(',')) {
      return parseFloat(str.replace(',', '.')) || 0;
    }
    return parseFloat(str) || 0;
  };

  const handleSaveStayFinancials = async () => {
    if (!editValues || isSavingEdit || isDemo) return;
    setIsSavingEdit(true);
    try {
      let cteUrl: string | undefined = undefined;
      let paymentProofUrl: string | undefined = undefined;

      if (editValues.cteFile) {
        cteUrl = (await uploadStayAttachment(editValues.id, 'cte_complementar', editValues.cteFile)) || undefined;
      }
      if (editValues.paymentFile) {
        paymentProofUrl = (await uploadStayAttachment(editValues.id, 'comprovante_pagamento', editValues.paymentFile)) || undefined;
      }

      const approvedVal = editValues.approved !== '' ? parseFlexibleNumber(editValues.approved) : undefined;
      const paidVal = editValues.paid !== '' ? parseFlexibleNumber(editValues.paid) : undefined;
      const weightVal = editValues.weight !== '' ? parseFlexibleNumber(editValues.weight) : 0;

      const updates: Partial<StayRecord> = {
        approvedValue: approvedVal,
        driverPaidValue: paidVal,
        clientName: editValues.clientName || undefined,
        driver: editValues.driver || undefined,
        plate: editValues.plate || undefined,
        weight: weightVal,
        origin: editValues.origin || undefined,
        destination: editValues.destination || undefined,
        shipmentId: editValues.shipmentId || undefined,
        invoice: editValues.invoice || undefined,
        ...(cteUrl && { cteUrl }),
        ...(paymentProofUrl && { paymentProofUrl })
      };
      
      const result = await updateToolStay(editValues.id, updates);
      if (result) {
        setStays(prev => prev.map(s => s.id === editValues.id ? { ...s, ...updates, ...result } : s));
      }
      await loadData();
      setExpandedId(null);
      setEditValues(null);
    } catch (err) {
      console.error('Erro ao salvar alterações da estadia:', err);
      alert('Erro ao salvar alterações. Por favor, tente novamente.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string, type: 'estadias' | 'cotacoes') => {
    if (isDemo) {
      alert("Usuário em modo demonstração possui acesso apenas de visualização.");
      return;
    }
    if (!confirm('Deseja realmente excluir este registro?')) return;
    
    if (type === 'estadias') {
      await deleteToolStay(id);
    } else {
      await deleteToolQuote(id);
    }
    await loadData();
  };

  const exportToXML = (record: any, type: string) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<${type}Record>\n`;
    Object.entries(record).forEach(([key, value]) => {
      xml += `  <${key}>${value}</${key}>\n`;
    });
    xml += `</${type}Record>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}_${record.id || 'export'}.xml`);
    link.click();
  };

  const exportToPDF = () => {
    const isStays = activeView === 'estadias';
    const data = isStays ? filteredStays : filteredQuotes;
    if (data.length === 0) return;

    const doc = new jsPDF('l', 'mm', 'a4');
    addPdfLogo(doc, undefined, { align: 'right', y: 8, width: 35, height: 15 });
    doc.setFontSize(18);
    doc.text(`Histórico de ${isStays ? 'Estadias' : 'Cotações de Frete'}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);


    let head: string[][] = [];
    let body: any[][] = [];

    if (isStays) {
      head = [['Data', 'Cliente', 'Motorista', 'Placa', 'Origem', 'Destino', 'Tempo HT', 'Valor']];
      body = (data as StayRecord[]).map(s => [
        format(parseISO(s.date), 'dd/MM/yyyy'),
        s.clientName || '-',
        s.driver,
        s.plate,
        s.origin,
        s.destination,
        `${s.totalHours.toFixed(1)}h`,
        formatCurrency(s.totalValue)
      ]);
    } else {
      head = [['Data da Cotação', 'Cliente', 'Origem', 'Destino', 'Valor do Frete Empresa (por Tonelada)']];
      body = (data as QuoteRecord[]).map(q => [
        format(parseISO(q.date), 'dd/MM/yyyy HH:mm'),
        q.clientName || '-',
        q.origin,
        q.destination,
        formatCurrency(q.companyFreightPerTon || 0)
      ]);
    }

    autoTable(doc, {
      startY: 35,
      head,
      body,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 }
    });

    doc.save(`historico_${activeView}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <>
      <Header title="Histórico Operacional" />
      <div className="space-y-6 font-sans">
        {/* Barra de Ferramentas */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="flex bg-slate-100 dark:bg-gray-900 p-1 rounded-xl w-fit shrink-0">
              <button onClick={() => { setActiveView('estadias'); setExpandedId(null); }} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeView === 'estadias' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Estadias</button>
              <button onClick={() => { setActiveView('cotacoes'); setExpandedId(null); }} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeView === 'cotacoes' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Cotações</button>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Pesquise por motorista, placa, cidade ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${showFilters ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm' : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-600'}`}>
                  <Filter className="w-4 h-4 mr-2" /> {showFilters ? 'Esconder Filtros' : 'Filtros Avançados'}
                </button>
                <button onClick={exportToPDF} className="flex items-center px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md">
                  <Download className="w-4 h-4 mr-2" /> PDF
                </button>
              </div>
            </div>
          </div>

          {/* Filtros Expandidos */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Início</label>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-full px-4 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-600 rounded-xl text-sm outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fim</label>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-full px-4 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-600 rounded-xl text-sm outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</label>
                <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="w-full px-4 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-600 rounded-xl text-sm outline-none">
                  <option value="">Todos os Clientes</option>
                  {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Registros */}
        <div className="grid grid-cols-1 gap-4">
          {(activeView === 'estadias' ? filteredStays : filteredQuotes).length > 0 ? (
            (activeView === 'estadias' ? filteredStays : filteredQuotes).map((item: any) => (
              <div key={item.id} className={`bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-300 overflow-hidden ${expandedId === item.id ? 'border-indigo-400 ring-4 ring-indigo-50 dark:ring-indigo-900/10 shadow-lg' : 'border-slate-200 dark:border-gray-700 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer'}`} onClick={() => expandedId !== item.id && toggleExpand(item.id)}>
                
                {/* Cabeçalho do Card */}
                <div className="p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start space-x-4">
                       <div className={`p-4 rounded-2xl shrink-0 ${activeView === 'estadias' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {activeView === 'estadias' ? <Truck className="w-6 h-6" /> : <ArrowRight className="w-6 h-6" />}
                       </div>
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 rounded-md tracking-wider uppercase">{item.id}</span>
                            {activeView === 'estadias' && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wider uppercase ${item.calculationType === 'DAILY_FIXED' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200/50' : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200/50'}`}>
                                {item.calculationType === 'DAILY_FIXED' ? 'Diária Fixa' : 'Ton / Hora'}
                              </span>
                            )}
                            <span className="text-xs text-slate-400 font-medium">{format(parseISO(item.date), 'dd/MM/yyyy')} às {format(parseISO(item.date), 'HH:mm')}</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">
                             {activeView === 'estadias' ? (
                               <span>Motorista: <span className="text-indigo-600">{item.driver}</span></span>
                             ) : (
                               <span>{item.origin} <ArrowRight className="inline w-4 h-4 mx-1 text-slate-300" /> {item.destination}</span>
                             )}
                          </h3>
                          <div className="flex flex-wrap items-center mt-2 gap-y-1 gap-x-4 text-sm text-slate-500 font-medium">
                             <div className="flex items-center"><Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> {item.clientName || 'Cliente Particular'}</div>
                             <div className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> {activeView === 'estadias' ? `${item.origin} → ${item.destination}` : `${item.distance.toFixed(0)} km`}</div>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
                       <div className={`text-xl font-black ${activeView === 'estadias' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                          {formatCurrency(activeView === 'estadias' ? item.totalValue : item.companyTotalFreight)}
                       </div>
                       <button onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                          {expandedId === item.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                       </button>
                    </div>
                  </div>
                </div>

                {/* Área Expandida (Detalhes) */}
                {expandedId === item.id && (
                  <div className="border-t border-slate-100 dark:border-gray-700 bg-slate-50/30 dark:bg-gray-900/10 p-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                      {activeView === 'estadias' ? (
                        <>
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><Truck className="w-3 h-3 mr-2" /> Equipamento e NF</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-gray-700">
                                <span className="text-slate-500">Placa do Veículo</span>
                                <span className="font-bold text-slate-700 dark:text-gray-300">{item.plate}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-gray-700">
                                <span className="text-slate-500">Nota Fiscal</span>
                                <span className="font-bold text-slate-700 dark:text-gray-300">{item.invoice || 'Não Informada'}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2">
                                <span className="text-slate-500">Peso Transportado</span>
                                <span className="font-bold text-slate-700 dark:text-gray-300">{item.weight} Toneladas</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><Clock className="w-3 h-3 mr-2" /> Cronologia e Prazos</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-gray-700">
                                <span className="text-slate-500">Entrada</span>
                                <span className="font-medium text-slate-700 dark:text-gray-300">{format(parseISO(item.entryDate), 'dd/MM/yyyy HH:mm')}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-gray-700">
                                <span className="text-slate-500">Saída</span>
                                <span className="font-medium text-slate-700 dark:text-gray-300">{format(parseISO(item.exitDate), 'dd/MM/yyyy HH:mm')}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2">
                                <span className="text-slate-500">Tempo Total</span>
                                <span className="font-bold text-indigo-600">{item.totalHours.toFixed(1)}h</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><DollarSign className="w-3 h-3 mr-2" /> Valores e Fechamento</h4>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-slate-100 dark:border-gray-700 space-y-4">
                               <div>
                                 <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Valor Calculado / Solicitado</div>
                                 <div className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(item.totalValue)}</div>
                                 <div className="text-[10px] text-slate-500 mt-1">
                                    {item.calculationType === 'DAILY_FIXED' 
                                      ? `(${formatCurrency(item.dailyRate || item.valuePerHour)} / Diária)` 
                                      : `(${formatCurrency(item.valuePerHour)} / Ton-Hora)`}
                                  </div>
                               </div>

                               <div className="pt-3 border-t border-slate-100 dark:border-gray-700 space-y-4">
                                 {/* Edit Core Data Section */}
                                 <div className="bg-slate-50 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-100 dark:border-gray-700 space-y-4">
                                   <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Editar Dados Gerais / Vínculo</h5>
                                   
                                   <div className="space-y-2">
                                     <label className="text-[10px] text-slate-400 font-bold uppercase block">Vincular a Embarque</label>
                                     <div className="relative" ref={dropdownRef}>
                                       <input
                                         type="text"
                                         placeholder="Pesquise por placa, motorista ou ID..."
                                         value={shipmentSearchTerm}
                                         onChange={(e) => {
                                           setShipmentSearchTerm(e.target.value);
                                           if (editValues?.shipmentId) setEditValues(prev => prev ? { ...prev, shipmentId: '' } : null);
                                           setIsShipmentDropdownOpen(true);
                                         }}
                                         onFocus={() => setIsShipmentDropdownOpen(true)}
                                         className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-gray-600 dark:text-white dark:bg-gray-700 rounded-lg outline-none focus:border-indigo-500"
                                       />
                                       
                                       {isShipmentDropdownOpen && (
                                         <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                           <div 
                                             className="px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-xs text-slate-600 dark:text-gray-400 border-b border-slate-100 dark:border-gray-700"
                                             onClick={() => handleShipmentSelect('')}
                                           >
                                             -- Remover vínculo --
                                           </div>
                                           {(shipments || []).filter(s => {
                                             const term = shipmentSearchTerm.toLowerCase();
                                             if (!term || (editValues && editValues.shipmentId)) return true;
                                             return s.id.toLowerCase().includes(term) ||
                                                    (s.horsePlate && s.horsePlate.toLowerCase().includes(term)) ||
                                                    (s.driverName && s.driverName.toLowerCase().includes(term));
                                           }).slice(0, 10).map(s => (
                                             <div 
                                               key={s.id} 
                                               onClick={() => handleShipmentSelect(s.id)}
                                               className={`px-3 py-2 cursor-pointer text-xs transition-colors ${editValues?.shipmentId === s.id ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-200' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-gray-300'}`}
                                             >
                                               <div className="font-bold">{s.horsePlate} - {s.driverName}</div>
                                               <div className="opacity-75 mt-0.5">ID: {s.id}</div>
                                             </div>
                                           ))}
                                         </div>
                                       )}
                                     </div>
                                   </div>

                                   <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Motorista</label>
                                        <input 
                                          type="text" 
                                          value={editValues?.id === item.id ? editValues?.driver : ''} 
                                          onChange={e => setEditValues(prev => prev ? {...prev, driver: e.target.value} : null)}
                                          className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-gray-600 dark:text-white dark:bg-gray-700 rounded-lg outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Placa</label>
                                        <input 
                                          type="text" 
                                          value={editValues?.id === item.id ? editValues?.plate : ''} 
                                          onChange={e => setEditValues(prev => prev ? {...prev, plate: e.target.value} : null)}
                                          className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-gray-600 dark:text-white dark:bg-gray-700 rounded-lg outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Peso (Ton)</label>
                                        <input 
                                          type="text" 
                                          inputMode="decimal"
                                          value={editValues?.id === item.id ? editValues?.weight : ''} 
                                          onChange={e => setEditValues(prev => prev ? {...prev, weight: e.target.value} : null)}
                                          className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-gray-600 dark:text-white dark:bg-gray-700 rounded-lg outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">NF</label>
                                        <input 
                                          type="text" 
                                          value={editValues?.id === item.id ? editValues?.invoice : ''} 
                                          onChange={e => setEditValues(prev => prev ? {...prev, invoice: e.target.value} : null)}
                                          className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-gray-600 dark:text-white dark:bg-gray-700 rounded-lg outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                   </div>
                                 </div>

                                 <div>
                                   <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Valor Aprovado (Receita)</label>
                                   <div className="flex gap-2 items-center">
                                     <input 
                                       type="text" 
                                       inputMode="decimal"
                                       value={editValues?.id === item.id ? editValues?.approved : ''} 
                                       onChange={e => setEditValues(prev => prev ? {...prev, approved: e.target.value} : null)}
                                       placeholder="R$ 0,00"
                                       className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-gray-600 dark:text-white dark:bg-gray-700 rounded-lg outline-none focus:border-indigo-500"
                                     />
                                     <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-1.5 rounded border border-slate-200 dark:border-gray-600 flex items-center justify-center whitespace-nowrap text-xs text-slate-600 dark:text-gray-300" title="Anexar CTe Complementar">
                                       <Paperclip className="w-4 h-4 mr-1" /> CTe
                                       <input 
                                         type="file" 
                                         className="hidden" 
                                         onChange={e => {
                                           const file = e.target.files?.[0];
                                           if (file) setEditValues(prev => prev ? {...prev, cteFile: file} : null);
                                         }} 
                                       />
                                     </label>
                                   </div>
                                   {editValues?.id === item.id && editValues?.cteFile && (
                                     <div className="text-[10px] text-indigo-500 mt-1 truncate">Anexo: {editValues.cteFile.name}</div>
                                   )}
                                   {item.cteUrl && !(editValues?.id === item.id && editValues?.cteFile) && (
                                     <button type="button" onClick={() => openDocumentInNewTab(getShipmentAttachmentUrl(item.cteUrl!), 'CTe Complementar')} className="text-[10px] text-indigo-500 hover:underline mt-1 block text-left font-semibold cursor-pointer">Ver CTe Anexado</button>
                                   )}
                                 </div>
                                 <div>
                                   <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Valor Pago Motorista (Custo)</label>
                                   <div className="flex gap-2 items-center">
                                     <input 
                                       type="text" 
                                       inputMode="decimal"
                                       value={editValues?.id === item.id ? editValues?.paid : ''} 
                                       onChange={e => setEditValues(prev => prev ? {...prev, paid: e.target.value} : null)}
                                       placeholder="R$ 0,00"
                                       className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-gray-600 dark:text-white dark:bg-gray-700 rounded-lg outline-none focus:border-indigo-500"
                                     />
                                     <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-1.5 rounded border border-slate-200 dark:border-gray-600 flex items-center justify-center whitespace-nowrap text-xs text-slate-600 dark:text-gray-300" title="Anexar Comprovante de Pagamento">
                                       <Paperclip className="w-4 h-4 mr-1" /> Comp.
                                       <input 
                                         type="file" 
                                         className="hidden" 
                                         onChange={e => {
                                           const file = e.target.files?.[0];
                                           if (file) setEditValues(prev => prev ? {...prev, paymentFile: file} : null);
                                         }} 
                                       />
                                     </label>
                                   </div>
                                   {editValues?.id === item.id && editValues?.paymentFile && (
                                     <div className="text-[10px] text-indigo-500 mt-1 truncate">Anexo: {editValues.paymentFile.name}</div>
                                   )}
                                   {item.paymentProofUrl && !(editValues?.id === item.id && editValues?.paymentFile) && (
                                     <button type="button" onClick={() => openDocumentInNewTab(getShipmentAttachmentUrl(item.paymentProofUrl!), 'Comprovante de Pagamento')} className="text-[10px] text-indigo-500 hover:underline mt-1 block text-left font-semibold cursor-pointer">Ver Comprovante Anexado</button>
                                   )}
                                 </div>
                                 <div className="flex items-center justify-between pt-2">
                                   <div>
                                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                                        {(parseFlexibleNumber(editValues?.approved) - parseFlexibleNumber(editValues?.paid)) >= 0 
                                          ? 'Lucro da Estadia' 
                                          : 'Déficit da Estadia'}
                                      </div>
                                      <div className={`text-lg font-bold ${(parseFlexibleNumber(editValues?.approved) - parseFlexibleNumber(editValues?.paid)) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                        {formatCurrency(parseFlexibleNumber(editValues?.approved) - parseFlexibleNumber(editValues?.paid))}
                                      </div>
                                   </div>
                                   {!isDemo && (
                                     <button 
                                       onClick={handleSaveStayFinancials} 
                                       disabled={isSavingEdit}
                                       className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                     >
                                       {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
                                     </button>
                                   )}
                                 </div>
                               </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><Route className="w-3 h-3 mr-2" /> Logística</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-gray-700">
                                <span className="text-slate-500">Distância Total</span>
                                <span className="font-bold text-slate-700 dark:text-gray-300">{item.distance.toFixed(0)} km</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-gray-700">
                                <span className="text-slate-500">Config. de Eixos</span>
                                <span className="font-bold text-slate-700 dark:text-gray-300">{item.axes} Eixos</span>
                              </div>
                              <div className="flex justify-between text-sm py-2">
                                <span className="text-slate-500">Tipo de Mercadoria</span>
                                <span className="font-bold text-slate-700 dark:text-gray-300">{item.cargoType}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><Fuel className="w-3 h-3 mr-2" /> Custos de Viagem</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-gray-700">
                                <span className="text-slate-500">Óleo Diesel</span>
                                <span className="font-medium text-slate-700 dark:text-gray-300">{formatCurrency(item.dieselCost)}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-gray-700">
                                <span className="text-slate-500">Pedágio Estimado</span>
                                <span className="font-medium text-slate-700 dark:text-gray-300">{formatCurrency(item.tollValue)}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2">
                                <span className="text-slate-500">Margem Pretendida</span>
                                <span className="font-bold text-indigo-600">{item.margin}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><Scale className="w-3 h-3 mr-2" /> Performance Financ.</h4>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-slate-100 dark:border-gray-700">
                               <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Lucro Operacional</div>
                               <div className="text-lg font-bold text-emerald-600 mb-3">{formatCurrency(item.carrierNetProfit)} ({item.carrierProfitMargin.toFixed(1)}%)</div>
                               <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Cotação p/ Cliente</div>
                               <div className="text-2xl font-black text-slate-800 dark:text-white">{formatCurrency(item.companyTotalFreight)}</div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Ações do Registro */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-100 dark:border-gray-700">
                       <div className="flex items-center gap-2">
                          <button onClick={() => exportToXML(item, activeView === 'estadias' ? 'Stay' : 'Freight')} className="flex items-center px-4 py-2 border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-gray-700 transition-all">
                             <FileCode className="w-3.5 h-3.5 mr-2 text-indigo-500" /> XML NFe
                          </button>
                          <button className="flex items-center px-4 py-2 border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-gray-700 transition-all">
                             <FileText className="w-3.5 h-3.5 mr-2 text-slate-400" /> Detalhes PDF
                          </button>
                       </div>
                       {!isDemo && (
                          <div className="flex items-center gap-2">
                             <button onClick={() => handleDelete(item.id, activeView)} className="flex items-center px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-xs font-bold transition-all">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir Registro
                             </button>
                          </div>
                       )}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-20 text-center border-2 border-dashed border-slate-200 dark:border-gray-700">
               <div className="w-20 h-20 bg-slate-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
                 <HistoryIcon className="w-10 h-10 text-slate-300" />
               </div>
               <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Nenhum registro encontrado</h3>
               <p className="text-slate-500 max-w-[300px] mx-auto text-sm">Altere os filtros ou realize novas operações nas ferramentas de cálculo.</p>
            </div>
          )}
        </div>
      </div>

      <DocumentPreviewModal
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        fileUrl={previewDocument?.url || null}
        fileName={previewDocument?.name}
        category={previewDocument?.category}
      />
    </>
  );
}
