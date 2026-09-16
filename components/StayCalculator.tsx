import React, { useState, useMemo, useEffect } from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Calculator, Download, FileText, Truck, Clock, MapPin, FileDigit, User, Weight, DollarSign, Save, Trash2, CheckCircle2, Building2, Calendar } from 'lucide-react';
import { saveStay, getClients, saveClient, Client } from '../utils/storage';
import { useToast } from '../hooks/useToast';
import { autoFormatInput } from '../utils/formatters';
import { addPdfLogo } from '../utils/pdfGenerator';

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
  dailyRate: string;
  daysCount: string;
  tolerance: string;
  entryDate: string;
  exitDate: string;
  calculationType: 'TON_HOUR' | 'DAILY_FIXED';
}

interface StayCalculatorProps {
  companyId: string;
}

export default function StayCalculator({ companyId }: StayCalculatorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    setClients(getClients(companyId));
  }, [companyId]);

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
    dailyRate: '',
    daysCount: '',
    tolerance: '12',
    entryDate: '',
    exitDate: '',
    calculationType: 'TON_HOUR'
  };

  const [formData, setFormData] = useState<StayData>(initialData);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const formattedValue = autoFormatInput(name, value);
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    setSaveSuccess(false);
  };

  const clearFields = () => {
    setFormData(initialData);
    setSaveSuccess(false);
  };

  const result = useMemo(() => {
    if (!formData.entryDate || !formData.exitDate) return null;

    const entry = parseISO(formData.entryDate);
    const exit = parseISO(formData.exitDate);
    
    const totalMinutes = differenceInMinutes(exit, entry);
    if (totalMinutes < 0) return null;

    const totalHours = totalMinutes / 60;
    const tolerance = parseFloat(formData.tolerance) || 0;
    const chargeableHours = Math.max(0, totalHours - tolerance);

    if (formData.calculationType === 'TON_HOUR') {
      const weight = parseFloat(formData.weight) || 0;
      const valuePerHour = parseFloat(formData.valuePerHour) || 0;
      if (!weight || !valuePerHour) return null;

      const totalValue = chargeableHours * weight * valuePerHour;

      return { 
        mode: 'TON_HOUR' as const,
        totalMinutes, 
        totalHours, 
        chargeableHours, 
        totalValue, 
        tolerance,
        weight,
        valuePerHour,
        daysCount: 0 
      };
    } else {
      const dailyRate = parseFloat(formData.dailyRate) || 0;
      if (!dailyRate) return null;

      const autoDays = chargeableHours > 0 ? Math.max(1, Math.ceil(chargeableHours / 24)) : 0;
      const effectiveDays = formData.daysCount !== '' && parseFloat(formData.daysCount) > 0
        ? parseFloat(formData.daysCount)
        : autoDays;

      const totalValue = effectiveDays * dailyRate;

      return {
        mode: 'DAILY_FIXED' as const,
        totalMinutes,
        totalHours,
        chargeableHours,
        totalValue,
        tolerance,
        weight: parseFloat(formData.weight) || 0,
        valuePerHour: dailyRate,
        daysCount: effectiveDays,
        autoDays
      };
    }
  }, [formData]);

  const handleSave = () => {
    if (!result) return;
    
    if (!formData.driver || !formData.plate || !formData.origin || !formData.destination) {
      showToast("Por favor, preencha os campos obrigatórios (Motorista, Placa, Origem, Destino).", 'warning');
      return;
    }

    if (formData.clientName) {
      saveClient(companyId, formData.clientName);
      setClients(getClients(companyId));
    }

    saveStay({
      companyId,
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
      valuePerHour: formData.calculationType === 'DAILY_FIXED' 
        ? (parseFloat(formData.dailyRate) || 0) 
        : (parseFloat(formData.valuePerHour) || 0),
      tolerance: parseFloat(formData.tolerance) || 0,
      totalValue: result.totalValue,
      calculationType: formData.calculationType,
      dailyRate: formData.calculationType === 'DAILY_FIXED' ? (parseFloat(formData.dailyRate) || 0) : undefined,
      daysCount: formData.calculationType === 'DAILY_FIXED' ? result.daysCount : undefined,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
    
    const isDaily = formData.calculationType === 'DAILY_FIXED';
    const headers = [
      'Tipo de Cálculo', 'Cliente', 'Motorista', 'Placa', 'Nota Fiscal', 'Origem', 'Destino', 'Local', 
      'Entrada', 'Saída', 'Peso (Ton)', isDaily ? 'Valor Diária (R$)' : 'Valor Ton/Hora (R$)', 
      'Tolerância (h)', 'Tempo Total (h)', isDaily ? 'Qtd Diárias' : 'Horas Cobráveis', 'Valor Total'
    ];
    
    const row = [
      isDaily ? 'Valor Fixo por Dia (Diária)' : 'Por Tonelada/Hora',
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
      isDaily ? formData.dailyRate : formData.valuePerHour,
      formData.tolerance,
      result.totalHours.toFixed(2),
      isDaily ? result.daysCount.toString() : result.chargeableHours.toFixed(2),
      result.totalValue.toFixed(2)
    ];

    const csvContent = [
      headers.join(','),
      row.map(v => `"${v}"`).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `estadia_${formData.plate || 'relatorio'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (!result) return;

    const isDaily = formData.calculationType === 'DAILY_FIXED';
    const doc = new jsPDF();
    addPdfLogo(doc, undefined, { align: 'right', y: 8, width: 35, height: 15 });
    doc.setFontSize(18);
    doc.text('Relatório de Cálculo de Estadia', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

    const bodyRows = [
      ['Tipo de Cálculo', isDaily ? 'Valor Fixo por Dia (Diária)' : 'Por Tonelada/Hora'],
      ['Cliente', formData.clientName || 'Não Informado'],
      ['Motorista', formData.driver || '-'],
      ['Placa do Veículo', formData.plate || '-'],
      ['Nota Fiscal', formData.invoice || '-'],
      ['Origem', formData.origin || '-'],
      ['Destino', formData.destination || '-'],
      ['Local do Evento', formData.location],
      ['Data/Hora de Entrada', formData.entryDate ? format(parseISO(formData.entryDate), 'dd/MM/yyyy HH:mm') : '-'],
      ['Data/Hora de Saída', formData.exitDate ? format(parseISO(formData.exitDate), 'dd/MM/yyyy HH:mm') : '-'],
      ['Tolerância', `${parseFloat(formData.tolerance) || 0} horas`],
    ];

    if (!isDaily) {
      bodyRows.push(
        ['Peso', `${formatNumber(parseFloat(formData.weight) || 0)} Toneladas`],
        ['Valor Tonelada/Hora', formatCurrency(parseFloat(formData.valuePerHour) || 0)]
      );
    } else {
      if (formData.weight) {
        bodyRows.push(['Peso Informado', `${formatNumber(parseFloat(formData.weight) || 0)} Toneladas`]);
      }
      bodyRows.push(
        ['Valor da Diária', formatCurrency(parseFloat(formData.dailyRate) || 0)],
        ['Qtd. de Diárias', `${result.daysCount} diária(s)`]
      );
    }

    autoTable(doc, {
      startY: 40,
      head: [['Campo', 'Valor']],
      body: bodyRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 40;

    const formulaText = isDaily 
      ? `${result.daysCount} diária(s) × ${formatCurrency(parseFloat(formData.dailyRate) || 0)}`
      : `${formatNumber(result.chargeableHours, 1)} × ${formatNumber(parseFloat(formData.weight) || 0)} × ${formatNumber(parseFloat(formData.valuePerHour) || 0)}`;

    const calcSummary = [
      ['Tempo Total Decorrido', `${formatNumber(result.totalHours, 1)} horas (${formatDuration(result.totalMinutes)})`],
      ['Horas Cobráveis', `${formatNumber(result.chargeableHours, 1)} horas`],
    ];

    if (isDaily) {
      calcSummary.push(['Diárias Cobráveis', `${result.daysCount} diária(s)`]);
    }

    calcSummary.push(
      ['Fórmula Aplicada', formulaText],
      ['Valor Total a Pagar', formatCurrency(result.totalValue)]
    );

    autoTable(doc, {
      startY: finalY + 10,
      head: [['Resumo do Cálculo', '']],
      body: calcSummary,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 12 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80 },
        1: { halign: 'right' }
      },
      didParseCell: function(data) {
        if (data.row.index === (isDaily ? 4 : 3) && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [5, 150, 105];
        }
      }
    });

    doc.save(`estadia_${formData.plate || 'relatorio'}.pdf`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans">
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium flex items-center text-slate-800">
              <FileText className="w-5 h-5 mr-2 text-indigo-500" />
              Dados da Estadia
            </h2>
            <button 
              onClick={clearFields}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Limpar Campos
            </button>
          </div>

          {/* Segmented Control para Tipo de Cálculo */}
          <div className="mb-6">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Modo de Cobrança da Estadia
            </label>
            <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, calculationType: 'TON_HOUR' }));
                  setSaveSuccess(false);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs md:text-sm font-bold transition-all ${
                  formData.calculationType === 'TON_HOUR'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Weight className="w-4 h-4" />
                <span>Por Tonelada / Hora</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, calculationType: 'DAILY_FIXED' }));
                  setSaveSuccess(false);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs md:text-sm font-bold transition-all ${
                  formData.calculationType === 'DAILY_FIXED'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Valor Fixo por Dia (Diária)</span>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 flex items-center">
                <Building2 className="w-4 h-4 mr-1.5 text-slate-400" /> Cliente (Opcional)
              </label>
              <input 
                type="text" name="clientName" value={formData.clientName} onChange={handleInputChange} list="clients-list"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                placeholder="Clique para selecionar ou digite um novo" 
              />
              <datalist id="clients-list">
                {clients.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center"><User className="w-4 h-4 mr-1.5 text-slate-400" /> Motorista *</label>
              <input type="text" name="driver" value={formData.driver} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center"><Truck className="w-4 h-4 mr-1.5 text-slate-400" /> Placa do Veículo *</label>
              <input type="text" name="plate" value={formData.plate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="ABC-1234" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 flex items-center"><FileDigit className="w-4 h-4 mr-1.5 text-slate-400" /> Nota Fiscal</label>
              <input type="text" name="invoice" value={formData.invoice} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Número da NF" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-slate-400" /> Origem *</label>
              <input type="text" name="origin" value={formData.origin} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Cidade - Estado" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-slate-400" /> Destino *</label>
              <input type="text" name="destination" value={formData.destination} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Cidade - Estado" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-slate-400" /> Local do Evento</label>
              <select name="location" value={formData.location} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white">
                <option value="Origem">Origem (Carregamento)</option>
                <option value="Destino">Destino (Descarregamento)</option>
              </select>
            </div>

            {formData.calculationType === 'TON_HOUR' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center"><Weight className="w-4 h-4 mr-1.5 text-slate-400" /> Peso (Toneladas) *</label>
                  <input type="number" step="0.01" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Ex: 57.94" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center"><DollarSign className="w-4 h-4 mr-1.5 text-slate-400" /> Valor Ton/Hora (R$) *</label>
                  <input type="number" step="0.01" name="valuePerHour" value={formData.valuePerHour} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Ex: 0.80" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center"><DollarSign className="w-4 h-4 mr-1.5 text-emerald-500" /> Valor da Diária (R$) *</label>
                  <input type="number" step="0.01" name="dailyRate" value={formData.dailyRate} onChange={handleInputChange} className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/30 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-semibold" placeholder="Ex: 1200.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                    <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5 text-indigo-400" /> Qtd. de Diárias</span>
                    {result?.autoDays !== undefined && (
                      <span className="text-[10px] text-slate-400">Calculado: {result.autoDays} d</span>
                    )}
                  </label>
                  <input 
                    type="number" 
                    step="1" 
                    min="0"
                    name="daysCount" 
                    value={formData.daysCount} 
                    onChange={handleInputChange} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    placeholder={result?.autoDays ? `${result.autoDays} (automático)` : 'Ex: 1'} 
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center"><Weight className="w-4 h-4 mr-1.5 text-slate-400" /> Peso da Carga (Opcional p/ Diária)</label>
                  <input type="number" step="0.01" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Ex: 57.94 (informativo)" />
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 flex items-center"><Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Tolerância (Horas)</label>
              <input type="number" step="0.5" name="tolerance" value={formData.tolerance} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Ex: 12" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center"><Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Data/Hora Entrada *</label>
              <input type="datetime-local" name="entryDate" value={formData.entryDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center"><Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Data/Hora Saída *</label>
              <input type="datetime-local" name="exitDate" value={formData.exitDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-lg font-medium flex items-center text-slate-800">
              <Calculator className="w-5 h-5 mr-2 text-indigo-500" /> Resumo do Cálculo
            </h2>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${formData.calculationType === 'DAILY_FIXED' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {formData.calculationType === 'DAILY_FIXED' ? 'Diária Fixa' : 'Ton / Hora'}
            </span>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            {result ? (
              <div className="space-y-6 flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tempo Total</div>
                    <div className="text-xl font-semibold text-slate-900">{formatNumber(result.totalHours, 1)}h</div>
                    <div className="text-xs text-slate-400 mt-1">{formatDuration(result.totalMinutes)}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Horas Cobráveis</div>
                    <div className="text-xl font-semibold text-indigo-600">{formatNumber(result.chargeableHours, 1)}h</div>
                    <div className="text-xs text-slate-400 mt-1">Desconto de {result.tolerance}h</div>
                  </div>
                </div>
                <div className="space-y-3 py-4 border-y border-slate-100">
                  {result.mode === 'TON_HOUR' ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Peso da Carga</span>
                        <span className="font-medium text-slate-900">{formatNumber(parseFloat(formData.weight) || 0)} Ton</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Valor por Ton/Hora</span>
                        <span className="font-medium text-slate-900">{formatCurrency(parseFloat(formData.valuePerHour) || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-slate-500">Fórmula</span>
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {formatNumber(result.chargeableHours, 1)} × {formatNumber(parseFloat(formData.weight) || 0)} × {formatNumber(parseFloat(formData.valuePerHour) || 0)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Qtd. de Diárias</span>
                        <span className="font-bold text-indigo-600">{result.daysCount} diária(s)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Valor por Diária</span>
                        <span className="font-medium text-slate-900">{formatCurrency(parseFloat(formData.dailyRate) || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-slate-500">Fórmula</span>
                        <span className="font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                          {result.daysCount} diária(s) × {formatCurrency(parseFloat(formData.dailyRate) || 0)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="pt-2 pb-6">
                  <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Valor Total a Pagar / Solicitado</div>
                  <div className="text-4xl font-bold text-emerald-600 tracking-tight">{formatCurrency(result.totalValue)}</div>
                </div>
                <div className="space-y-3 mt-auto">
                  {saveSuccess && (
                    <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl flex items-center text-sm font-medium border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-500" /> Dados salvos com sucesso no histórico!
                    </div>
                  )}
                  <button onClick={handleSave} className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm">
                    <Save className="w-4 h-4 mr-2" /> Salvar Estadia
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={exportToCSV} className="flex items-center justify-center px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium text-sm"><FileText className="w-4 h-4 mr-2" /> CSV</button>
                    <button onClick={exportToPDF} className="flex items-center justify-center px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium text-sm"><Download className="w-4 h-4 mr-2" /> PDF</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-4 py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center"><Calculator className="w-8 h-8 text-slate-300" /></div>
                <p className="text-sm max-w-[250px]">
                  {formData.calculationType === 'DAILY_FIXED'
                    ? 'Preencha as datas e o valor da diária para visualizar o cálculo.'
                    : 'Preencha as datas, peso e valor para visualizar o cálculo da estadia.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
