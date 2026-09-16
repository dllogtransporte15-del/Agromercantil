import React, { useState, useMemo } from 'react';
import type { Shipment, User, Cargo, Client, Driver, Vehicle, Branch, Product } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Eye, 
  Layers, 
  X,
  Truck, 
  Sparkles,
  Calendar,
  Building2,
  Receipt,
  Percent,
  Info,
  CheckCircle2,
  Plus
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import MultiSelectDropdown from '../MultiSelectDropdown';
import { getShipmentCte, getShipmentEffectiveDate, isCteApplicableForStatus, isStayForShipment } from '../../utils';
import { calculateShipmentExpenses } from '../../utils/operationalExpensesCalculator';
import { addPdfLogo } from '../../utils/pdfGenerator';
import type { StayRecord } from '../../utils/toolStorage';

interface OthersReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  clients: Client[];
  users: User[];
  currentUser: User | null;
  drivers?: Driver[];
  vehicles?: Vehicle[];
  branches?: Branch[];
  products?: Product[];
  stays?: StayRecord[];
  companyLogo?: string | null;
  startDate?: string;
  endDate?: string;
}

export const OthersReport: React.FC<OthersReportProps> = ({
  shipments,
  cargos,
  clients,
  users,
  currentUser,
  drivers = [],
  vehicles = [],
  branches = [],
  products = [],
  stays = [],
  companyLogo,
  startDate: propStartDate,
  endDate: propEndDate,
}) => {
  // Filtros internos
  const [searchTerm, setSearchTerm] = useState('');
  const [cteFilter, setCteFilter] = useState('');
  const [startDate, setStartDate] = useState(propStartDate || '');
  const [endDate, setEndDate] = useState(propEndDate || '');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const isAgenciador = currentUser?.profile === UserProfile.Agenciador || (currentUser?.profile as string) === 'Agenciador';
  const [activeTab, setActiveTab] = useState<'todos' | 'creditos' | 'custos-adicionais'>(() => isAgenciador ? 'custos-adicionais' : 'todos');
  const [showFilters, setShowFilters] = useState(false);

  React.useEffect(() => {
    if (isAgenciador && activeTab !== 'custos-adicionais') {
      setActiveTab('custos-adicionais');
    }
  }, [isAgenciador]);

  // Modal para Visualizar Justificativa do Prejuízo / Custo Adicional
  const [selectedCostDetail, setSelectedCostDetail] = useState<{
    shipment: Shipment;
    category: string;
    description: string;
    value: number;
    effectiveDate: string | null;
    cteNumber?: string;
  } | null>(null);

  React.useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
  }, [propStartDate]);

  React.useEffect(() => {
    if (propEndDate) setEndDate(propEndDate);
  }, [propEndDate]);

  // Indexação rápida de entidades
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b])), [branches]);

  // Opções para filtros
  const branchOptions = useMemo(() => branches.map(b => b.name).sort(), [branches]);
  const clientOptions = useMemo(() => clients.map(c => c.nomeFantasia || c.razaoSocial).sort(), [clients]);
  const categoryOptions = useMemo(() => [
    'Prejuízo Operacional (Margem Negativa)',
    'Avaria / Sinistro',
    'Transbordo de Carga',
    'Estadia Operacional (Não repassada)',
    'Multa de Trânsito / Fiscal',
    'Taxa Portuária / Armazenagem Extra',
    'Pedágio Excedente',
    'Quebra / Diferença de Peso',
    'Outros Custos Imprevistos'
  ], []);

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    cteFilter.trim() ||
    startDate ||
    endDate ||
    selectedBranches.length > 0 ||
    selectedClients.length > 0 ||
    selectedCategories.length > 0
  );

  const handleSetPeriodPreset = (preset: 'today' | 'this_month' | 'last_month' | 'last_30_days' | 'this_year' | 'clear') => {
    const now = new Date();
    if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'last_30_days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(past);
      setEndDate(todayStr);
    } else if (preset === 'this_year') {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'clear') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setCteFilter('');
    setStartDate('');
    setEndDate('');
    setSelectedBranches([]);
    setSelectedClients([]);
    setSelectedCategories([]);
  };

  // Processamento e consolidação de cada embarque
  const processedData = useMemo(() => {
    return shipments.map(s => {
      const cargo = cargoMap.get(s.cargoId);
      const client = cargo ? clientMap.get(cargo.clientId) : undefined;
      const branch = s.branchId ? branchMap.get(s.branchId) : undefined;
      const driver = s.driverName || 'Motorista não identificado';
      
      const effectiveDate = getShipmentEffectiveDate(s);
      const cteVal = getShipmentCte(s);
      const cleanCte = (cteVal && cteVal !== '-' && cteVal.trim() !== '') ? cteVal.trim() : (s.cteNumber ? String(s.cteNumber).trim() : '');

      // 1. Apurar Despesas e Lucro Líquido Real (Conforme Automatização do CT-e e Estadias)
      const expenses = calculateShipmentExpenses(s, cargo);
      const shipmentStays = (stays || []).filter(stay => isStayForShipment(stay, s));
      const demurrageRevenue = shipmentStays.reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);
      const demurrageDriverPaid = shipmentStays.reduce((sum, stay) => sum + (stay.driverPaidValue || 0), 0);
      const demurrageProfit = demurrageRevenue - demurrageDriverPaid;

      const netProfit = Number((expenses.netProfit + demurrageProfit).toFixed(2));
      const hasCte = Boolean(cleanCte);
      const isEffective = (isCteApplicableForStatus(s.status) || s.status === ShipmentStatus.Finalizado) && hasCte && s.status !== ShipmentStatus.Cancelado && (s.status as string) !== 'Cancelado';
      const isNegativeNetProfit = isEffective && netProfit < -0.01;
      const lossFromNetProfit = isNegativeNetProfit ? Math.abs(netProfit) : 0;

      // 2. Apurar Crédito de Imposto (Exportação / Tributos) - estritamente de embarques efetivados com CT-e
      const isExport = (cargo as any)?.destinationType === 'Exportação' || (cargo as any)?.isExport === true || (s as any)?.destinationType === 'Exportação' || (s.documents as any)?.is_export === true;
      
      const autoOrRealCredit = s.realProfitData?.generatedCredit ?? (s.documents as any)?.generated_credit;
      const rawCredit = (autoOrRealCredit !== undefined && autoOrRealCredit > 0)
        ? Number(autoOrRealCredit)
        : Number(expenses.generatedCredit || 0);

      const creditValue = isEffective ? rawCredit : 0;
      const hasTaxCredit = creditValue > 0;

      // 3. Apurar Custo Adicional / Prejuízo (Manual ou Lucro Líquido Real Negativo)
      const explicitAddCostValue = s.additionalCostValue !== undefined 
        ? Number(s.additionalCostValue) 
        : (s.additionalCost?.value !== undefined ? Number(s.additionalCost.value) : (Number((s.documents as any)?.additional_cost?.value) || 0));

      const hasExplicitAddCost = explicitAddCostValue > 0;
      const hasAdditionalCost = hasExplicitAddCost || isNegativeNetProfit;

      let addCostValue = 0;
      let addCostCategory = 'Prejuízo Operacional';
      let addCostDesc = '';

      if (hasExplicitAddCost && isNegativeNetProfit) {
        addCostValue = Math.max(explicitAddCostValue, lossFromNetProfit);
        addCostCategory = s.additionalCostCategory || s.additionalCost?.category || (s.documents as any)?.additional_cost_category || 'Prejuízo Operacional';
        addCostDesc = s.additionalCostDescription || s.additionalCost?.description || `Embarque finalizado com Lucro Líquido Real negativo de ${netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;
      } else if (isNegativeNetProfit) {
        addCostValue = lossFromNetProfit;
        addCostCategory = 'Prejuízo Operacional (Margem Negativa)';
        addCostDesc = `Embarque efetivado com Lucro Líquido Real negativo de -${lossFromNetProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Frete Empresa: ${(expenses.companyFreight + demurrageRevenue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vs Custos e Despesas: ${(expenses.driverFreight + demurrageDriverPaid + expenses.totalExpenses).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`;
      } else if (hasExplicitAddCost) {
        addCostValue = explicitAddCostValue;
        addCostCategory = s.additionalCostCategory || s.additionalCost?.category || (s.documents as any)?.additional_cost_category || (s.documents as any)?.additional_cost?.category || 'Custo Adicional / Extra';
        addCostDesc = s.additionalCostDescription || s.additionalCost?.description || (s.documents as any)?.additional_cost_description || '';
      }

      return {
        shipment: s,
        cargo,
        client,
        branch,
        driver,
        effectiveDate,
        cteNumber: cleanCte || s.id,
        rawCte: cleanCte,
        isExport,
        hasTaxCredit,
        creditValue,
        hasAdditionalCost,
        addCostValue,
        addCostCategory,
        addCostDesc,
        netProfit,
        isNegativeNetProfit,
        hasAnyItem: hasTaxCredit || hasAdditionalCost,
      };
    });
  }, [shipments, cargoMap, clientMap, branchMap, stays]);

  // Filtragem conforme parâmetros selecionados
  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      // Pelo menos precisa ter crédito ou custo adicional
      if (!item.hasAnyItem) return false;

      // Filtro por Data
      if (startDate && (!item.effectiveDate || item.effectiveDate < startDate)) return false;
      if (endDate && (!item.effectiveDate || item.effectiveDate > endDate)) return false;

      // Filtro por CT-e
      if (cteFilter.trim()) {
        const termCte = cteFilter.trim().toLowerCase();
        const matchCte = String(item.cteNumber).toLowerCase().includes(termCte) ||
                         (item.rawCte && String(item.rawCte).toLowerCase().includes(termCte)) ||
                         (item.shipment.id && item.shipment.id.toLowerCase().includes(termCte));
        if (!matchCte) return false;
      }

      // Filtro por Filial
      if (selectedBranches.length > 0) {
        const branchName = item.branch?.name || 'Sem Filial';
        if (!selectedBranches.includes(branchName)) return false;
      }

      // Filtro por Cliente
      if (selectedClients.length > 0) {
        const clientName = item.client?.nomeFantasia || item.client?.razaoSocial || 'Cliente não identificado';
        if (!selectedClients.includes(clientName)) return false;
      }

      // Filtro por Categoria de Custo
      if (selectedCategories.length > 0 && item.hasAdditionalCost) {
        if (!selectedCategories.includes(item.addCostCategory)) return false;
      }

      // Filtro de Busca Geral Texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchId = item.shipment.id.toLowerCase().includes(term);
        const matchCte = String(item.cteNumber).toLowerCase().includes(term) ||
                         (item.rawCte && String(item.rawCte).toLowerCase().includes(term));
        const matchDriver = item.driver.toLowerCase().includes(term);
        const matchClient = (item.client?.nomeFantasia || item.client?.razaoSocial || '').toLowerCase().includes(term);
        const matchCategory = item.addCostCategory.toLowerCase().includes(term);
        const matchDesc = item.addCostDesc.toLowerCase().includes(term);
        const matchPlate = (item.shipment.horsePlate || '').toLowerCase().includes(term);

        if (!matchId && !matchCte && !matchDriver && !matchClient && !matchCategory && !matchDesc && !matchPlate) {
          return false;
        }
      }

      return true;
    });
  }, [processedData, startDate, endDate, cteFilter, selectedBranches, selectedClients, selectedCategories, searchTerm]);

  // Listas segmentadas
  const taxCreditItems = useMemo(() => filteredData.filter(d => d.hasTaxCredit), [filteredData]);
  const additionalCostItems = useMemo(() => filteredData.filter(d => d.hasAdditionalCost), [filteredData]);

  // Totais e KPIs do Período Filtrado
  const kpis = useMemo(() => {
    const totalCredit = taxCreditItems.reduce((sum, d) => sum + d.creditValue, 0);
    const totalCost = additionalCostItems.reduce((sum, d) => sum + d.addCostValue, 0);
    
    return {
      totalCredit,
      countCredit: taxCreditItems.length,
      avgCredit: taxCreditItems.length > 0 ? totalCredit / taxCreditItems.length : 0,
      totalCost,
      countCost: additionalCostItems.length,
      avgCost: additionalCostItems.length > 0 ? totalCost / additionalCostItems.length : 0,
    };
  }, [taxCreditItems, additionalCostItems]);

  // Totais Gerais Acumulados de Todos os Tempos (Independente de Filtros de Data)
  const { allTimeTotalCost, allTimeCountCost, allTimeTotalCredit, allTimeCountCredit } = useMemo(() => {
    let totalCost = 0;
    let countCost = 0;
    let totalCredit = 0;
    let countCredit = 0;

    processedData.forEach(d => {
      if (d.hasAdditionalCost) {
        totalCost += d.addCostValue;
        countCost += 1;
      }
      if (d.hasTaxCredit) {
        totalCredit += d.creditValue;
        countCredit += 1;
      }
    });

    return {
      allTimeTotalCost: totalCost,
      allTimeCountCost: countCost,
      allTimeTotalCredit: totalCredit,
      allTimeCountCredit: countCredit,
    };
  }, [processedData]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const [year, month, day] = dateStr.split('-');
      if (year && month && day) return `${day}/${month}/${year}`;
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Exportação para PDF
  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    addPdfLogo(doc, companyLogo);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório Outros - Créditos de Imposto & Custos Adicionais', 40, 45);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const periodText = (startDate || endDate) 
      ? `Período: ${formatDate(startDate)} até ${formatDate(endDate)}` 
      : 'Período: Completo';
    doc.text(`${periodText} | Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 40, 60);

    // Resumo dos Indicadores
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(40, 75, pageWidth - 80, 45, 6, 6, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo dos Demonstrativos:', 55, 93);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Créditos de Imposto: ${formatCurrency(kpis.totalCredit)} (${kpis.countCredit} embarques)`, 55, 108);
    doc.text(`Total Custos Adicionais / Prejuízos: ${formatCurrency(kpis.totalCost)} (${kpis.countCost} ocorrências)`, 380, 108);

    let startY = 135;

    // Seção 1: Créditos de Imposto
    if (activeTab === 'todos' || activeTab === 'creditos') {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`1. Créditos de Imposto Gerados (${taxCreditItems.length} registros)`, 40, startY);

      autoTable(doc, {
        startY: startY + 10,
        head: [['ID Frete', 'Nº CT-e', 'Data', 'Cliente', 'Origem / Destino', 'Modalidade', 'Crédito Gerado']],
        body: taxCreditItems.map(d => [
          d.shipment.id,
          d.rawCte || '-',
          formatDate(d.effectiveDate),
          d.client?.nomeFantasia || d.client?.razaoSocial || 'Cliente',
          `${d.cargo?.origin || '-'} -> ${d.cargo?.destination || '-'}`,
          d.isExport ? 'Exportação' : 'Mercado Interno',
          formatCurrency(d.creditValue)
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
        theme: 'striped',
        margin: { left: 40, right: 40 }
      });

      startY = (doc as any).lastAutoTable.finalY + 25;
    }

    // Seção 2: Custos Adicionais
    if (activeTab === 'todos' || activeTab === 'custos-adicionais') {
      if (startY > doc.internal.pageSize.getHeight() - 120) {
        doc.addPage();
        startY = 40;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`2. Custos Adicionais e Registro de Prejuízos (${additionalCostItems.length} ocorrências)`, 40, startY);

      autoTable(doc, {
        startY: startY + 10,
        head: [['ID Frete', 'Nº CT-e', 'Data', 'Motorista / Placa', 'Categoria do Custo', 'Justificativa', 'Valor Prejuízo']],
        body: additionalCostItems.map(d => [
          d.shipment.id,
          d.rawCte || '-',
          formatDate(d.effectiveDate),
          `${d.driver} (${d.shipment.horsePlate || '-'})`,
          d.addCostCategory,
          d.addCostDesc || 'Sem justificativa informada',
          formatCurrency(d.addCostValue)
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [192, 57, 43], textColor: [255, 255, 255] },
        theme: 'striped',
        margin: { left: 40, right: 40 }
      });
    }

    doc.save(`Relatorio_Outros_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* HEADER DE INDICADORES / KPIS PRINCIPAIS */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAgenciador ? '' : 'lg:grid-cols-4'} gap-3.5`}>
        {/* Card 1: Total Crédito de Imposto - Oculto para Agenciador */}
        {!isAgenciador && (
          <div className="p-4 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-blue-500/10 dark:from-blue-950/40 dark:to-indigo-950/30 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-0.5">
                  Crédito de Imposto Gerado
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-blue-950 dark:text-blue-100">
                  {formatCurrency(kpis.totalCredit)}
                </div>
                <span className="text-[11px] text-blue-700/80 dark:text-blue-300 font-medium">
                  {kpis.countCredit} {kpis.countCredit === 1 ? 'embarque gerador' : 'embarques geradores'}
                </span>
              </div>
              <div className="p-3 bg-blue-500 text-white rounded-xl shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>

            {/* Rodapé: Total Geral Acumulado */}
            <div className="mt-3 pt-2 border-t border-blue-200/60 dark:border-blue-800/60 flex items-center justify-between text-[10px]">
              <span className="text-blue-700/80 dark:text-blue-300/80 font-semibold uppercase tracking-tight">
                Total Geral Acumulado:
              </span>
              <span className="font-mono font-black text-blue-950 dark:text-blue-100" title={`Soma de todos os créditos fiscais gerados (${allTimeCountCredit} ${allTimeCountCredit === 1 ? 'embarque' : 'embarques'})`}>
                {formatCurrency(allTimeTotalCredit)}
              </span>
            </div>
          </div>
        )}

        {/* Card 2: Total Custos Adicionais / Prejuízos */}
        <div className="p-4 bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-rose-500/10 dark:from-rose-950/40 dark:to-amber-950/30 rounded-2xl border border-rose-200/80 dark:border-rose-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-0.5">
                Custos Extras / Prejuízos
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-950 dark:text-rose-100">
                {formatCurrency(kpis.totalCost)}
              </div>
              <span className="text-[11px] text-rose-700/80 dark:text-rose-300 font-medium">
                {kpis.countCost} {kpis.countCost === 1 ? 'ocorrência registrada' : 'ocorrências registradas'}
              </span>
            </div>
            <div className="p-3 bg-rose-500 text-white rounded-xl shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          {/* Rodapé: Total Geral de Prejuízos (Independente de Data) */}
          <div className="mt-3 pt-2 border-t border-rose-200/60 dark:border-rose-800/60 flex items-center justify-between text-[10px]">
            <span className="text-rose-700/80 dark:text-rose-300/80 font-semibold uppercase tracking-tight">
              Total Geral Acumulado:
            </span>
            <span className="font-mono font-black text-rose-950 dark:text-rose-100" title={`Soma de todos os prejuízos de todos os períodos (${allTimeCountCost} ${allTimeCountCost === 1 ? 'ocorrência' : 'ocorrências'})`}>
              {formatCurrency(allTimeTotalCost)}
            </span>
          </div>
        </div>

        {/* Card 3: Média de Crédito por Frete - Oculto para Agenciador */}
        {!isAgenciador && (
          <div className="p-4 bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-0.5">
                  Média Crédito / Frete
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-gray-900 dark:text-white">
                  {formatCurrency(kpis.avgCredit)}
                </div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Sobre embarques c/ crédito
                </span>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            {/* Rodapé: Total Embarques com Crédito */}
            <div className="mt-3 pt-2 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between text-[10px]">
              <span className="text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-tight">
                Embarques (Geral):
              </span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">
                {allTimeCountCredit} {allTimeCountCredit === 1 ? 'embarque' : 'embarques'}
              </span>
            </div>
          </div>
        )}

        {/* Card 4: Média de Custo por Ocorrência */}
        <div className="p-4 bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-0.5">
                Média Prejuízo / Ocorrência
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-gray-900 dark:text-white">
                {formatCurrency(kpis.avgCost)}
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Avarias, multas, transbordos
              </span>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-800/50">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Rodapé: Total de Ocorrências Geral */}
          <div className="mt-3 pt-2 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between text-[10px]">
            <span className="text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-tight">
              Ocorrências (Geral):
            </span>
            <span className="font-mono font-bold text-gray-900 dark:text-white">
              {allTimeCountCost} {allTimeCountCost === 1 ? 'ocorrência' : 'ocorrências'}
            </span>
          </div>
        </div>
      </div>

      {/* BARRA DE CONTROLES, ABAS E FILTROS */}
      <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Sub-Abas do Relatório - Oculto seletor se for Agenciador */}
          {!isAgenciador ? (
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-700/70 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('todos')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'todos'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Visão Geral ({filteredData.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('creditos')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'creditos'
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Créditos de Imposto ({taxCreditItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custos-adicionais')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'custos-adicionais'
                    ? 'bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Custos Extras / Prejuízos ({additionalCostItems.length})</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Custos Extras / Prejuízos ({additionalCostItems.length})</span>
            </div>
          )}

          {/* Ações de Busca, Filtros e Exportação */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por ID, placa, motorista..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                showFilters || hasActiveFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-300'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        {/* Painel Expansível de Filtros com Período, CT-e e Filtros Rápidos */}
        {showFilters && (
          <div className="pt-3.5 border-t border-gray-100 dark:border-gray-700/60 space-y-3.5">
            {/* Linha 1: Filtros de Período, CT-e e Seletores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Data Início */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Data Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Data Fim */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Data Final
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Filtrar por CT-e */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                  Filtrar por CT-e
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cteFilter}
                    onChange={e => setCteFilter(e.target.value)}
                    placeholder="Nº CT-e ou Frete..."
                    className="w-full pl-3 pr-7 py-1.5 text-xs border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                  {cteFilter && (
                    <button
                      type="button"
                      onClick={() => setCteFilter('')}
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filial */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Filial</label>
                <MultiSelectDropdown
                  options={branchOptions}
                  selectedValues={selectedBranches}
                  onChange={setSelectedBranches}
                  placeholder="Todas as Filiais"
                />
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                <MultiSelectDropdown
                  options={clientOptions}
                  selectedValues={selectedClients}
                  onChange={setSelectedClients}
                  placeholder="Todos os Clientes"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Categoria de Custo</label>
                <MultiSelectDropdown
                  options={categoryOptions}
                  selectedValues={selectedCategories}
                  onChange={setSelectedCategories}
                  placeholder="Todas as Categorias"
                />
              </div>
            </div>

            {/* Linha 2: Atalhos Rápidos de Período & Limpar Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100/80 dark:border-gray-700/40">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">Atalhos:</span>
                <button
                  type="button"
                  onClick={() => handleSetPeriodPreset('today')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPeriodPreset('this_month')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  Este Mês
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPeriodPreset('last_month')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  Mês Anterior
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPeriodPreset('last_30_days')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  Últimos 30 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPeriodPreset('this_year')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  Ano Atual
                </button>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpar Todos os Filtros
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO 1: CRÉDITOS DE IMPOSTO GERADOS - Oculto para Agenciador */}
      {!isAgenciador && (activeTab === 'todos' || activeTab === 'creditos') && (
        <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700/70 flex items-center justify-between bg-blue-50/40 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500 text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Créditos de Imposto Gerados ({taxCreditItems.length})
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Valores apurados para aproveitamento fiscal e manutenção de créditos de exportação
                </p>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs text-gray-500 font-bold block">Total de Créditos:</span>
              <span className="text-base font-black text-blue-600 dark:text-blue-400">
                {formatCurrency(kpis.totalCredit)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">ID Frete</th>
                  <th className="p-3.5">Nº CT-e</th>
                  <th className="p-3.5">Data</th>
                  <th className="p-3.5">Cliente / Beneficiário</th>
                  <th className="p-3.5">Origem / Destino</th>
                  <th className="p-3.5">Modalidade</th>
                  <th className="p-3.5 text-right">Crédito Gerado (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-900 dark:text-gray-100">
                {taxCreditItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400 dark:text-gray-500 italic">
                      Nenhum embarque com crédito de imposto encontrado no período selecionado.
                    </td>
                  </tr>
                ) : (
                  taxCreditItems.map(item => (
                    <tr key={item.shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.shipment.id}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.rawCte ? (
                          <span className="bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                            {item.rawCte}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-[11px] font-normal italic">Sem CT-e</span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                        {formatDate(item.effectiveDate)}
                      </td>
                      <td className="p-3.5 font-medium max-w-[200px] truncate" title={item.client?.nomeFantasia || item.client?.razaoSocial}>
                        {item.client?.nomeFantasia || item.client?.razaoSocial || 'Cliente não vinculado'}
                      </td>
                      <td className="p-3.5 text-gray-600 dark:text-gray-300">
                        <span className="font-semibold">{item.cargo?.origin || '-'}</span> ➔ <span className="font-semibold">{item.cargo?.destination || '-'}</span>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.isExport
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {item.isExport ? 'Exportação (Manutenção Crédito)' : 'Mercado Interno'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                        {formatCurrency(item.creditValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SEÇÃO 2: CUSTOS ADICIONAIS & REGISTRO DE PREJUÍZOS OPERACIONAIS */}
      {(activeTab === 'todos' || activeTab === 'custos-adicionais') && (
        <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700/70 flex items-center justify-between bg-rose-50/40 dark:bg-rose-950/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500 text-white">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Custos Extras e Registro de Prejuízos Operacionais ({additionalCostItems.length})
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Despesas imprevistas lançadas no frete (avarias, transbordos, multas, estadias não faturadas)
                </p>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs text-gray-500 font-bold block">Total Prejuízos:</span>
              <span className="text-base font-black text-rose-600 dark:text-rose-400">
                {formatCurrency(kpis.totalCost)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">ID Frete</th>
                  <th className="p-3.5">Nº CT-e</th>
                  <th className="p-3.5">Data</th>
                  <th className="p-3.5">Motorista / Veículo</th>
                  <th className="p-3.5">Categoria da Despesa</th>
                  <th className="p-3.5">Justificativa / Motivo</th>
                  <th className="p-3.5 text-right">Valor Prejuízo (R$)</th>
                  <th className="p-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-900 dark:text-gray-100">
                {additionalCostItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400 dark:text-gray-500 italic">
                      Nenhum custo adicional ou prejuízo registrado no período selecionado.
                    </td>
                  </tr>
                ) : (
                  additionalCostItems.map(item => (
                    <tr key={item.shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {item.shipment.id}
                      </td>
                      <td className="p-3.5 font-mono">
                        {item.rawCte ? (
                          <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                            {item.rawCte}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-[11px] italic">
                            Sem CT-e
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                        {formatDate(item.effectiveDate)}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-gray-900 dark:text-white">{item.driver}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                          Placa: {item.shipment.horsePlate || '-'}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          {item.addCostCategory}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-[280px]">
                        <p className="text-gray-700 dark:text-gray-300 truncate" title={item.addCostDesc}>
                          {item.addCostDesc || 'Sem justificativa informada'}
                        </p>
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                        {formatCurrency(item.addCostValue)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedCostDetail({
                            shipment: item.shipment,
                            category: item.addCostCategory,
                            description: item.addCostDesc,
                            value: item.addCostValue,
                            effectiveDate: item.effectiveDate,
                            cteNumber: item.rawCte || undefined
                          })}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DO CUSTO ADICIONAL / PREJUÍZO */}
      {selectedCostDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-800 dark:text-slate-100">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Detalhes do Custo Adicional / Prejuízo
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Embarque: {selectedCostDetail.shipment.id} {selectedCostDetail.cteNumber ? `• CT-e: ${selectedCostDetail.cteNumber}` : ''} • Data: {formatDate(selectedCostDetail.effectiveDate)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCostDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-0.5">
                    Categoria do Prejuízo
                  </span>
                  <span className="font-bold text-rose-700 dark:text-rose-300">
                    {selectedCostDetail.category}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-0.5">
                    Valor Lançado
                  </span>
                  <span className="font-black text-sm font-mono text-rose-600 dark:text-rose-400">
                    {formatCurrency(selectedCostDetail.value)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Justificativa / Descrição do Ocorrido:
                </label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl font-normal leading-relaxed text-slate-800 dark:text-slate-200 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {selectedCostDetail.description || 'Nenhuma justificativa detalhada foi inserida para este lançamento.'}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/30">
              <button
                type="button"
                onClick={() => setSelectedCostDetail(null)}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OthersReport;
