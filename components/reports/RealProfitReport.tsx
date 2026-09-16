import React, { useState, useMemo } from 'react';
import type { Shipment, User, Cargo, Client, Driver, Vehicle, Branch, Product } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Eye, 
  Paperclip, 
  Receipt, 
  X,
  Truck, 
  Sparkles,
  Upload,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import MultiSelectDropdown from '../MultiSelectDropdown';
import AttachmentModal from '../AttachmentModal';
import { openDocumentInNewTab } from '../../utils/documentViewer';
import { getShipmentCte, getShipmentEffectiveDate, isCteApplicableForStatus, isStayForShipment } from '../../utils';
import CteCostAutomationPanel from '../CteCostAutomationPanel';
import { calculateShipmentExpenses } from '../../utils/operationalExpensesCalculator';
import { addPdfLogo } from '../../utils/pdfGenerator';
import type { StayRecord } from '../../utils/toolStorage';

interface RealProfitReportProps {
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
  onUpdateAttachment?: (shipmentId: string, data: any) => Promise<void>;
  onBatchUpdateShipments?: (updatedShipments: Shipment[]) => Promise<void> | void;
  onUpdateShipmentData?: (shipmentId: string, data: Partial<Shipment>) => Promise<void>;
}

export const RealProfitReport: React.FC<RealProfitReportProps> = ({
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
  onUpdateAttachment,
  onBatchUpdateShipments,
  onUpdateShipmentData
}) => {
  // Filtros internos
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(propStartDate || '');
  const [endDate, setEndDate] = useState(propEndDate || '');
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const isAgenciador = currentUser?.profile === UserProfile.Agenciador || (currentUser?.profile as string) === 'Agenciador';
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedExport, setSelectedExport] = useState<string[]>([]);
  const [selectedDriverRegimes, setSelectedDriverRegimes] = useState<string[]>([]);
  const [onlyWithOcr, setOnlyWithOcr] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  React.useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
  }, [propStartDate]);

  React.useEffect(() => {
    if (propEndDate) setEndDate(propEndDate);
  }, [propEndDate]);

  // Modal de Detalhes de Despesas
  const [selectedShipmentForDetail, setSelectedShipmentForDetail] = useState<Shipment | null>(null);
  
  // Modal de Edição / Anexo de Resumo Financeiro
  const [editingShipmentForAttachment, setEditingShipmentForAttachment] = useState<Shipment | null>(null);

  // Mapeamentos rápidos
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);
  const clientMap = useMemo(() => new Map(clients.map(cl => [cl.id, cl])), [clients]);
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const userBranchMap = useMemo(() => new Map(users.map(u => [u.id, u.branchId])), [users]);

  // Função auxiliar para identificar a filial do embarque (considerando o usuário responsável pelo embarque/carga)
  const getShipmentBranchName = (s: Shipment, cargo?: Cargo): string => {
    const bId = s.branchId || 
                userBranchMap.get(s.embarcadorId) || 
                userBranchMap.get(s.createdById) || 
                cargo?.branchId || 
                (cargo ? userBranchMap.get(cargo.createdById) : undefined);

    if (bId) {
      const branch = branches.find(b => b.id === bId);
      if (branch) return branch.name;
    }
    return 'Matriz';
  };

  // Opções para MultiSelect
  const statusOptions = Object.values(ShipmentStatus);
  const exportOptions = ['Exportação', 'Mercado Interno'];
  const driverRegimeOptions = ['PF', 'PJ Simples', 'PJ Real/Presumido'];
  const clientOptions = Array.from(new Set(cargos.map(c => {
    const cl = clientMap.get(c.clientId);
    return cl?.nomeFantasia || cl?.razaoSocial || c.clientId;
  }))).filter(Boolean).sort();

  const driverOptions = Array.from(new Set(shipments.map(s => s.driverName))).filter(Boolean).sort();
  
  const branchOptions = useMemo(() => {
    const names = new Set(branches.map(b => b.name));
    names.add('Matriz');
    return Array.from(names).filter(Boolean).sort();
  }, [branches]);

  // Filtragem dos embarques
  const filteredData = useMemo(() => {
    return shipments.filter(s => {
      const cargo = cargoMap.get(s.cargoId);
      const client = cargo ? clientMap.get(cargo.clientId) : undefined;
      const clientName = client?.nomeFantasia || client?.razaoSocial || '';

      // Filtro de texto (ID, CT-e, NF-e, Motorista, Placa)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesId = s.id.toLowerCase().includes(term);
        const matchesCte = s.cteNumber?.toLowerCase().includes(term);
        const matchesNfe = s.nfeNumber?.toLowerCase().includes(term);
        const matchesDriver = s.driverName.toLowerCase().includes(term);
        const matchesPlate = s.horsePlate.toLowerCase().includes(term);
        const matchesClient = clientName.toLowerCase().includes(term);
        const matchesOrigin = cargo?.origin?.toLowerCase().includes(term);
        const matchesDest = cargo?.destination?.toLowerCase().includes(term);

        if (!matchesId && !matchesCte && !matchesNfe && !matchesDriver && !matchesPlate && !matchesClient && !matchesOrigin && !matchesDest) {
          return false;
        }
      }

      // Filtro por Data de Início e Fim (Data de Emissão CT-e, Data Efetivada ou Data Programada)
      if (startDate || endDate) {
        const shipDate = getShipmentEffectiveDate(s) || s.scheduledDate || (s.createdAt ? s.createdAt.substring(0, 10) : '');

        if (!shipDate) {
          return false;
        }
        if (startDate && shipDate < startDate) {
          return false;
        }
        if (endDate && shipDate > endDate) {
          return false;
        }
      }

      // Filtro de Status
      if (selectedStatus.length > 0 && !selectedStatus.includes(s.status)) {
        return false;
      }

      // Filtro Destinação da Carga (Exportação / Mercado Interno)
      if (selectedExport.length > 0) {
        const isExp = Boolean(
          cargo?.isExport ||
          (s as any)?.isExport ||
          (cargo?.observations && /export/i.test(cargo.observations)) ||
          (cargo?.destination && /(porto|terminal|embarque portu[aá]rio|santos|paranagu[aá]|itaqui|rio grande|barcarena|suape|vit[oó]ria)/i.test(cargo.destination)) ||
          ((s as any)?.observations && /export/i.test((s as any).observations)) ||
          ((s as any)?.destination && /(porto|terminal|embarque portu[aá]rio|santos|paranagu[aá]|itaqui|rio grande|barcarena|suape|vit[oó]ria)/i.test((s as any).destination))
        );
        const expLabel = isExp ? 'Exportação' : 'Mercado Interno';
        if (!selectedExport.includes(expLabel)) {
          return false;
        }
      }

      // Filtro Regime Tributário do Motorista (PF / PJ Simples / PJ Real/Presumido)
      if (selectedDriverRegimes.length > 0) {
        const isPf = s.driverFreightType === 'PF' || s.anttModality === 'TAC';
        let regimeLabel: 'PF' | 'PJ Simples' | 'PJ Real/Presumido' = 'PF';
        if (isPf) {
          regimeLabel = 'PF';
        } else {
          const isSimples = Boolean(
            s.etcTaxRegime === 'Simples Nacional' ||
            s.etcTaxRegime === 'MEI' ||
            (s as any)?.isSimplesNacional ||
            (s.documents as any)?.etc_tax_regime === 'Simples Nacional' ||
            (s.documents as any)?.etc_tax_regime === 'MEI' ||
            (s.documents as any)?.crt === '1' ||
            (s.documents as any)?.crt === '2'
          );
          regimeLabel = isSimples ? 'PJ Simples' : 'PJ Real/Presumido';
        }
        if (!selectedDriverRegimes.includes(regimeLabel)) {
          return false;
        }
      }

      // Filtro de Cliente
      if (selectedClients.length > 0 && !selectedClients.includes(clientName)) {
        return false;
      }

      // Filtro de Motorista
      if (selectedDrivers.length > 0 && !selectedDrivers.includes(s.driverName)) {
        return false;
      }

      // Filtro de Filial / Matriz (verificando filial do embarque e filial dos usuários vinculados)
      if (selectedBranches.length > 0) {
        const branchName = getShipmentBranchName(s, cargo);
        if (!selectedBranches.includes(branchName)) {
          return false;
        }
      }

      // REGRA OBRIGATÓRIA: Contabilizar apenas embarques efetivados que possuem CT-e emitido
      if (s.status === ShipmentStatus.Cancelado || (s.status as string) === 'Cancelado') {
        return false;
      }

      if (!isCteApplicableForStatus(s.status)) {
        return false;
      }

      const cte = getShipmentCte(s);
      const hasCte = Boolean(cte && cte !== '-' && cte.trim() !== '');
      if (!hasCte) {
        return false;
      }

      // Filtro "Apenas com OCR / Demonstrativo"
      if (onlyWithOcr && !s.realProfitData) {
        return false;
      }

      return true;
    });
  }, [shipments, cargoMap, clientMap, branches, userBranchMap, searchTerm, startDate, endDate, selectedStatus, selectedExport, selectedDriverRegimes, selectedClients, selectedDrivers, selectedBranches, onlyWithOcr]);

  const canViewFinalNetProfit = useMemo(() => {
    if (!currentUser) return false;
    return [
      UserProfile.Comercial,
      UserProfile.GerenteComercial,
      UserProfile.Admin,
      UserProfile.Diretor,
      UserProfile.Financeiro,
      UserProfile.Demonstracao
    ].includes(currentUser.profile) ||
    ['Comercial', 'Admin', 'Administrador', 'Diretor', 'Financeiro', 'Demonstração', 'Demo'].includes(currentUser.profile as string);
  }, [currentUser]);

  // Cálculos consolidados para cada embarque (Conforme Automatização do CT-e e Estadias)
  const enrichedRows = useMemo(() => {
    return filteredData.map(s => {
      const cargo = cargoMap.get(s.cargoId);
      const client = cargo ? clientMap.get(cargo.clientId) : undefined;
      const clientName = client?.nomeFantasia || client?.razaoSocial || 'Cliente N/A';
      
      // Apuração Completa e Parametrizada idêntica à "Automatização do CT-e"
      const calculatedExpenses = calculateShipmentExpenses(s, cargo);
      const {
        companyFreight: baseCompanyFreight,
        driverFreight: baseDriverFreight,
        totalExpenses,
        expenseItems: rawExpenseItems,
        riskCost,
        generatedCredit,
      } = calculatedExpenses;

      // Estadias vinculadas a este embarque
      const shipmentStays = stays.filter(stay => isStayForShipment(stay, s));
      const demurrageRevenue = shipmentStays.reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);
      const demurrageDriverPaid = shipmentStays.reduce((sum, stay) => sum + (stay.driverPaidValue || 0), 0);
      const demurrageProfit = demurrageRevenue - demurrageDriverPaid;

      const companyFreight = baseCompanyFreight + demurrageRevenue;
      const driverFreight = baseDriverFreight + demurrageDriverPaid;
      const freightDifference = companyFreight - driverFreight;
      const freightDifferenceMarginPercent = companyFreight > 0 ? (freightDifference / companyFreight) * 100 : 0;
      const netProfit = Number((calculatedExpenses.netProfit + demurrageProfit).toFixed(2));
      const profitMarginPercent = companyFreight > 0 ? (netProfit / companyFreight) * 100 : 0;

      // Apuração de Comissões de Agência e Embarcador
      const requesterUser = users.find(u => u.id === s.embarcadorId || u.id === s.createdById);
      const isAgenciadorRequester = requesterUser?.profile === UserProfile.Agenciador || (requesterUser?.profile as string) === 'Agenciador';

      // 1. Comissão do Embarcador (R$/t)
      const isShipperCommEnabled = Boolean(
        s.shipperCommissionEnabled === true ||
        (s.documents as any)?.shipper_commission_enabled === true ||
        s.realProfitData?.shipperCommissionEnabled === true
      );
      const shipperCommRate = s.shipperCommissionRatePerTon !== undefined && s.shipperCommissionRatePerTon !== null
        ? Number(s.shipperCommissionRatePerTon)
        : ((s.documents as any)?.shipper_commission_rate_per_ton !== undefined && (s.documents as any)?.shipper_commission_rate_per_ton !== null
            ? Number((s.documents as any).shipper_commission_rate_per_ton)
            : (s.realProfitData?.shipperCommissionRatePerTon !== undefined && s.realProfitData?.shipperCommissionRatePerTon !== null
                ? Number(s.realProfitData.shipperCommissionRatePerTon)
                : (requesterUser?.shipperCommissionRatePerTon || 0)));

      const tonnage = s.shipmentTonnage || cargo?.totalVolume || 0;
      const shipperCommission = (isShipperCommEnabled && shipperCommRate > 0 && tonnage > 0)
        ? Number((shipperCommRate * tonnage).toFixed(2))
        : (isShipperCommEnabled && s.shipperCommissionValue !== undefined && s.shipperCommissionValue !== null
            ? Number(s.shipperCommissionValue)
            : (isShipperCommEnabled && s.realProfitData?.shipperCommission !== undefined && s.realProfitData?.shipperCommission !== null
                ? Number(s.realProfitData.shipperCommission)
                : 0));

      // 2. Comissão de Agência (% sobre lucro líquido antes da comissão de agência)
      const isAgencyCommEnabled = Boolean(
        s.agencyCommissionEnabled !== undefined
          ? s.agencyCommissionEnabled
          : ((s.documents as any)?.agency_commission_enabled !== undefined
              ? Boolean((s.documents as any).agency_commission_enabled)
              : (isAgenciadorRequester ? true : false))
      );

      const effectiveAgencyPercentage = s.agencyCommissionPercentage ?? requesterUser?.agencyCommissionPercentage ?? 30;
      const opProfitBeforeAgency = Math.max(0, netProfit - shipperCommission);
      const agencyCommission = (isAgencyCommEnabled && opProfitBeforeAgency > 0)
        ? Number((opProfitBeforeAgency * (effectiveAgencyPercentage / 100)).toFixed(2))
        : (isAgencyCommEnabled && s.agencyCommissionValue !== undefined && s.agencyCommissionValue !== null
            ? Number(s.agencyCommissionValue)
            : 0);

      const totalCommissions = Number((shipperCommission + agencyCommission).toFixed(2));
      const netProfitWithCommissions = Number((netProfit - totalCommissions).toFixed(2));
      const marginWithCommissionsPercent = companyFreight > 0 ? (netProfitWithCommissions / companyFreight) * 100 : 0;

      // Comprovante / Anexo de saldo ou despesas
      const saldoDoc = s.documents?.['Comprovante de Pagamento de Saldo'] || 
                       s.documents?.['Comprovante de Saldo'] || 
                       s.documents?.['Resumo de Custos'] ||
                       (s.documents ? Object.values(s.documents).flat().find(f => typeof f === 'string' && (f.includes('saldo') || f.includes('comprovante') || f.includes('resumo'))) : undefined);

      const attachmentUrl = Array.isArray(saldoDoc) ? saldoDoc[0] : (typeof saldoDoc === 'string' ? saldoDoc : undefined);
      const toll = s.tollValue || s.realProfitData?.toll || 0;
      const driverFreightNetToll = Math.max(0, driverFreight - toll);

      return {
        shipment: s,
        cargo,
        clientName,
        cte: getShipmentCte(s),
        companyFreight,
        driverFreight,
        toll,
        driverFreightNetToll,
        freightDifference,
        freightDifferenceMarginPercent,
        totalExpenses,
        netProfit,
        profitMarginPercent,
        shipperCommission,
        agencyCommission,
        totalCommissions,
        netProfitWithCommissions,
        marginWithCommissionsPercent,
        expenseItems: rawExpenseItems,
        riskCost,
        generatedCredit,
        hasOcr: Boolean(s.realProfitData),
        attachmentUrl,
        calculatedExpenses,
        demurrageRevenue,
        demurrageDriverPaid,
        demurrageProfit,
      };
    });
  }, [filteredData, cargoMap, clientMap, stays, users]);

  // Totais Gerais
  const totals = useMemo(() => {
    const totalShipments = enrichedRows.length;
    const sumCompanyFreight = enrichedRows.reduce((acc, r) => acc + r.companyFreight, 0);
    const sumDriverFreight = enrichedRows.reduce((acc, r) => acc + r.driverFreight, 0);
    const sumToll = enrichedRows.reduce((acc, r) => acc + r.toll, 0);
    const sumDriverFreightNetToll = enrichedRows.reduce((acc, r) => acc + r.driverFreightNetToll, 0);
    const sumFreightDiff = enrichedRows.reduce((acc, r) => acc + r.freightDifference, 0);
    const sumExpenses = enrichedRows.reduce((acc, r) => acc + r.totalExpenses, 0);
    const sumGeneratedCredit = enrichedRows.reduce((acc, r) => acc + r.generatedCredit, 0);
    const sumNetProfit = enrichedRows.reduce((acc, r) => acc + r.netProfit, 0);
    const sumShipperCommission = enrichedRows.reduce((acc, r) => acc + r.shipperCommission, 0);
    const sumAgencyCommission = enrichedRows.reduce((acc, r) => acc + r.agencyCommission, 0);
    const sumCommissions = enrichedRows.reduce((acc, r) => acc + r.totalCommissions, 0);
    const sumNetProfitWithCommissions = enrichedRows.reduce((acc, r) => acc + r.netProfitWithCommissions, 0);
    const countOcr = enrichedRows.filter(r => r.hasOcr).length;

    const consolidatedMargin = sumCompanyFreight > 0 ? (sumNetProfit / sumCompanyFreight) * 100 : 0;
    const consolidatedMarginWithCommissions = sumCompanyFreight > 0 ? (sumNetProfitWithCommissions / sumCompanyFreight) * 100 : 0;
    const consolidatedFreightMargin = sumCompanyFreight > 0 ? (sumFreightDiff / sumCompanyFreight) * 100 : 0;

    return {
      totalShipments,
      sumCompanyFreight,
      sumDriverFreight,
      sumToll,
      sumDriverFreightNetToll,
      sumFreightDiff,
      sumExpenses,
      sumGeneratedCredit,
      sumNetProfit,
      sumShipperCommission,
      sumAgencyCommission,
      sumCommissions,
      sumNetProfitWithCommissions,
      consolidatedMargin,
      consolidatedMarginWithCommissions,
      consolidatedFreightMargin,
      consolidatedFreightDiffMargin: consolidatedFreightMargin,
      countOcr,
    };
  }, [enrichedRows]);

  // Exportação para PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // Logo
    addPdfLogo(doc, companyLogo, { align: 'right', y: 5, width: 35, height: 14 });

    // Cabeçalho
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório: Lucro Real da Operação de Embarque', 14, 15);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const periodText = startDate && endDate 
      ? `Período: ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
      : (startDate 
          ? `A partir de: ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')}` 
          : (endDate 
              ? `Até: ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}` 
              : 'Todos os períodos'));
    doc.text(`${periodText} | Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 21);

    // Tabela
    const tableData = enrichedRows.map(r => {
      const rowArr = [
        r.shipment.id,
        r.cte || '---',
        r.shipment.scheduledDate || '---',
        r.clientName,
        `${r.shipment.driverName} (${r.shipment.horsePlate})`,
        `R$ ${r.companyFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${r.driverFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${r.freightDifference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${r.freightDifferenceMarginPercent.toFixed(1)}%)`,
        `R$ ${r.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        r.generatedCredit > 0 ? `R$ ${r.generatedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '---',
        `R$ ${r.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${r.profitMarginPercent.toFixed(1)}%)`,
      ];
      if (canViewFinalNetProfit) {
        rowArr.push(`R$ ${r.netProfitWithCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${r.marginWithCommissionsPercent.toFixed(1)}%)`);
      }
      rowArr.push(r.hasOcr ? 'Sim (IA)' : 'Estimado');
      return rowArr;
    });

    const headRow = [
      'ID Embarque', 
      'CT-e',
      'Data', 
      'Cliente', 
      'Motorista / Placa', 
      'Frete Empresa (+)', 
      'Frete Motorista (-)', 
      'Dif. Frete', 
      'Despesas (-)', 
      'Créd. Exp. (Info)',
      'Lucro Real (=)', 
    ];
    if (canViewFinalNetProfit) {
      headRow.push('Líq. Final (- Com.)');
    }
    headRow.push('OCR');

    const footRow = [
      'TOTAL CONSOLIDADO',
      '---',
      `${totals.totalShipments} emb.`,
      '---',
      '---',
      `R$ ${totals.sumCompanyFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${totals.sumDriverFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${totals.sumFreightDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${totals.sumExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${totals.sumGeneratedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${totals.sumNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${totals.consolidatedMargin.toFixed(1)}%)`,
    ];
    if (canViewFinalNetProfit) {
      footRow.push(`R$ ${totals.sumNetProfitWithCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${totals.consolidatedMarginWithCommissions.toFixed(1)}%)`);
    }
    footRow.push(`${totals.countOcr} lidos`);

    autoTable(doc, {
      head: [headRow],
      body: tableData,
      startY: 26,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      foot: [footRow],
      footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    doc.save(`relatorio_lucro_real_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Exportação para CSV / Excel
  const handleExportCSV = () => {
    const headers = [
      'ID Embarque',
      'CT-e',
      'Data',
      'Status',
      'Cliente',
      'Origem',
      'Destino',
      'Motorista',
      'Placa',
      'Frete Empresa (R$)',
      'Frete Motorista (R$)',
      'Diferenca de Frete (R$)',
      'Margem Frete (%)',
      'Despesas Operacionais (R$)',
      'Credito Gerado Exportacao (R$)',
      'Lucro Real Operacional (R$)',
      'Margem Real Operacional (%)',
      ...(canViewFinalNetProfit ? [
        'Comissao Embarcador (R$)',
        'Comissao Agencia (R$)',
        'Total Comissoes (R$)',
        'Lucro Liquido Real Apos Comissoes (R$)',
        'Margem Liquida Real Apos Comissoes (%)'
      ] : []),
      'Despesas Detalhadas',
      'Processado via OCR'
    ];

    const rows = enrichedRows.map(r => {
      const expenseDesc = r.expenseItems.map(e => `${e.name}: R$ ${e.value}`).join(' | ');
      const rowData = [
        r.shipment.id,
        r.cte || '',
        r.shipment.scheduledDate || '',
        r.shipment.status,
        `"${r.clientName.replace(/"/g, '""')}"`,
        `"${(r.cargo?.origin || '').replace(/"/g, '""')}"`,
        `"${(r.cargo?.destination || '').replace(/"/g, '""')}"`,
        `"${r.shipment.driverName.replace(/"/g, '""')}"`,
        r.shipment.horsePlate,
        r.companyFreight.toFixed(2),
        r.driverFreight.toFixed(2),
        r.freightDifference.toFixed(2),
        r.freightDifferenceMarginPercent.toFixed(2),
        r.totalExpenses.toFixed(2),
        r.generatedCredit.toFixed(2),
        r.netProfit.toFixed(2),
        r.profitMarginPercent.toFixed(2),
        ...(canViewFinalNetProfit ? [
          r.shipperCommission.toFixed(2),
          r.agencyCommission.toFixed(2),
          r.totalCommissions.toFixed(2),
          r.netProfitWithCommissions.toFixed(2),
          r.marginWithCommissionsPercent.toFixed(2)
        ] : []),
        `"${expenseDesc.replace(/"/g, '""')}"`,
        r.hasOcr ? 'SIM' : 'NAO'
      ];
      return rowData.join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateSuffix = startDate && endDate ? `_${startDate}_a_${endDate}` : `_${new Date().toISOString().split('T')[0]}`;
    link.setAttribute('download', `lucro_real_embarques${dateSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    startDate ||
    endDate ||
    selectedStatus.length > 0 ||
    selectedClients.length > 0 ||
    selectedDrivers.length > 0 ||
    selectedBranches.length > 0 ||
    selectedExport.length > 0 ||
    selectedDriverRegimes.length > 0 ||
    onlyWithOcr
  );

  return (
    <div className="space-y-6 w-full">
      {/* BANNER DE REGRAS DE DESPESAS OPERACIONAIS E TRIBUTÁRIAS */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 rounded-2xl border border-indigo-800/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs w-full">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-100">
              Automatização Completa & Conformidade Tributária Integrada
            </p>
            <p className="text-indigo-200/80 text-[11px] mt-0.5">
              Cálculo exato de Diferença de Frete, Despesas Operacionais, Consultas de Risco, Comissões e Lucro Real apurado individualmente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[10px] font-mono font-semibold">
            Apuração Inteligente
          </span>
        </div>
      </div>

      {/* CARDS DE RESUMO CONSOLIDADO (KPIs) */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${canViewFinalNetProfit ? 'lg:grid-cols-4 xl:grid-cols-7' : 'lg:grid-cols-3 xl:grid-cols-6'} gap-3 w-full`}>
        {/* Frete Bruto Empresa */}
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Frete Empresa
            </span>
            <div className="p-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-mono font-black text-gray-900 dark:text-white truncate" title={`R$ ${totals.sumCompanyFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
            R$ {totals.sumCompanyFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Receita total a faturar</p>
        </div>

        {/* Frete Motorista / Carreteiro */}
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Frete Motorista
            </span>
            <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Truck className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-mono font-black text-gray-900 dark:text-white truncate" title={`R$ ${totals.sumDriverFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
            R$ {totals.sumDriverFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 font-medium truncate" title={totals.sumToll > 0 ? `Líquido de Pedágio: R$ ${totals.sumDriverFreightNetToll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Custo do frete contratado'}>
            {totals.sumToll > 0 ? `Líq. Ped: R$ ${totals.sumDriverFreightNetToll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Custo do frete contratado'}
          </p>
        </div>

        {/* Diferença de Frete */}
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Dif. Frete Bruta
            </span>
            <div className="p-1 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-mono font-black text-purple-600 dark:text-purple-400 truncate" title={`R$ ${totals.sumFreightDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
            R$ {totals.sumFreightDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-0.5 font-semibold">
            {totals.consolidatedFreightMargin.toFixed(1)}% do frete bruto
          </p>
        </div>

        {/* Total de Despesas Operacionais */}
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Despesas Operac.
            </span>
            <div className="p-1 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-mono font-black text-rose-600 dark:text-rose-400 truncate" title={`R$ ${totals.sumExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
            R$ {totals.sumExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-medium">Impostos + Taxas + Risco</p>
        </div>

        {/* Lucro Real Consolidado */}
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border-2 border-emerald-500/50 dark:border-emerald-500/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Lucro Real
            </span>
            <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className={`text-base sm:text-lg font-mono font-black truncate ${totals.sumNetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} title={`R$ ${totals.sumNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
            R$ {totals.sumNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold">
            Margem Real: {totals.consolidatedMargin.toFixed(1)}%
          </p>
        </div>

        {/* NOVO CARD: Lucro Líquido Real Pós Comissões (Visível para Comercial, Admin, Diretor e Financeiro) */}
        {canViewFinalNetProfit && (
          <div className="p-3 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-cyan-500/10 dark:from-teal-950/40 dark:to-emerald-950/30 rounded-xl border-2 border-teal-500/60 dark:border-teal-400/50 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                Líquido Real Final
              </span>
              <div className="p-1 rounded-md bg-teal-500 text-white shadow-2xs">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className={`text-base sm:text-lg font-mono font-black truncate ${totals.sumNetProfitWithCommissions >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-rose-600 dark:text-rose-400'}`} title={`R$ ${totals.sumNetProfitWithCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
              R$ {totals.sumNetProfitWithCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-teal-700/90 dark:text-teal-300/90 mt-0.5 font-bold truncate" title={`Margem: ${totals.consolidatedMarginWithCommissions.toFixed(1)}% | Comissões abatidas: R$ ${totals.sumCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}>
              Margem: {totals.consolidatedMarginWithCommissions.toFixed(1)}% {totals.sumCommissions > 0 ? `(- R$ ${totals.sumCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com.)` : ''}
            </p>
          </div>
        )}

        {/* Total de Embarques & OCR */}
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Embarques Filtrados
            </span>
            <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-mono font-black text-gray-900 dark:text-white">
            {totals.totalShipments} <span className="text-[11px] font-normal text-gray-500">emb.</span>
          </p>
          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-semibold">
            {totals.countOcr} com comprovante OCR
          </p>
        </div>
      </div>

      {/* CABEÇALHO DO RELATÓRIO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs w-full">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
            Relatório de Lucro Real
          </h2>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Acompanhe o desempenho financeiro real das operações de transporte.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
              showFilters || hasActiveFilters
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                : 'bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros Avançados
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </button>



          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gray-900 hover:bg-gray-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors shadow-xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* PAINEL DE FILTROS */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4 animate-in fade-in duration-200 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-9 gap-3">
            {/* Busca textual */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Busca Rápida
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="ID, CT-e, Motorista, Placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            {/* Data Início */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Data Início
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                />
              </div>
            </div>

            {/* Data Fim */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Data Fim
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                />
              </div>
            </div>

            {/* Filtro Destinação Carga (Exportação / Interno) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Destinação da Carga
              </label>
              <MultiSelectDropdown
                options={exportOptions}
                selectedValues={selectedExport}
                onChange={setSelectedExport}
                placeholder="Todas..."
              />
            </div>

            {/* Filtro Regime Tributário Motorista (PF / PJ) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Regime Motorista (PF/PJ)
              </label>
              <MultiSelectDropdown
                options={driverRegimeOptions}
                selectedValues={selectedDriverRegimes}
                onChange={setSelectedDriverRegimes}
                placeholder="Todos os regimes"
              />
            </div>

            {/* Filtro Status */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Status do Embarque
              </label>
              <MultiSelectDropdown
                options={statusOptions}
                selectedValues={selectedStatus}
                onChange={setSelectedStatus}
                placeholder="Todos os status"
              />
            </div>

            {/* Filtro Cliente */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Cliente
              </label>
              <MultiSelectDropdown
                options={clientOptions}
                selectedValues={selectedClients}
                onChange={setSelectedClients}
                placeholder="Todos os clientes"
              />
            </div>

            {/* Filtro Motorista */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Motorista
              </label>
              <MultiSelectDropdown
                options={driverOptions}
                selectedValues={selectedDrivers}
                onChange={setSelectedDrivers}
                placeholder="Todos os motoristas"
              />
            </div>

            {/* Filtro Filial / Matriz */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Filial / Matriz
              </label>
              <MultiSelectDropdown
                options={branchOptions}
                selectedValues={selectedBranches}
                onChange={setSelectedBranches}
                placeholder="Todas as filiais"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t dark:border-gray-700">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={onlyWithOcr}
                onChange={(e) => setOnlyWithOcr(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded dark:bg-gray-700 dark:border-gray-600"
              />
              Exibir apenas embarques com comprovante OCR processado
            </label>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
                setSelectedExport([]);
                setSelectedDriverRegimes([]);
                setSelectedStatus([]);
                setSelectedClients([]);
                setSelectedDrivers([]);
                setSelectedBranches([]);
                setOnlyWithOcr(false);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      )}

      {/* TABELA DETALHADA DE LUCRO REAL */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-600 dark:text-gray-400 font-bold border-b dark:border-gray-700 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-2">ID / Data</th>
                <th className="py-2.5 px-2">Cliente / Trajeto</th>
                <th className="py-2.5 px-2">Motorista / Placa</th>
                <th className="py-2.5 px-2 text-right">Frete Empresa (+)</th>
                <th className="py-2.5 px-2 text-right">Frete Motorista (-)</th>
                <th className="py-2.5 px-2 text-right">Dif. Frete</th>
                <th className="py-2.5 px-2 text-center">Despesas Operac.</th>
                {!isAgenciador && <th className="py-2.5 px-2 text-right">Créd. Exp.</th>}
                <th className="py-2.5 px-2 text-right">Resultado (=)</th>
                {canViewFinalNetProfit && (
                  <th className="py-2.5 px-2 text-right text-teal-700 dark:text-teal-300 font-black">
                    Líquido Real (- Com.)
                  </th>
                )}
                <th className="py-2.5 px-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {enrichedRows.length > 0 ? (
                enrichedRows.map((row) => (
                  <tr key={row.shipment.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition-colors">
                    {/* ID / Data */}
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {row.shipment.id}
                        </span>
                        {row.hasOcr && (
                          <span title="Processado via IA Multimodal" className="inline-flex items-center px-1 py-0.2 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-[8px] font-extrabold">
                            IA
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {row.shipment.scheduledDate ? new Date(row.shipment.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR') : '---'}
                      </p>
                      <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {row.shipment.status}
                      </span>
                    </td>

                    {/* Cliente / Trajeto */}
                    <td className="py-2.5 px-2 max-w-[140px] xl:max-w-[180px]">
                      <p className="font-semibold text-gray-900 dark:text-white truncate" title={row.clientName}>
                        {row.clientName}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={`${row.cargo?.origin || ''} → ${row.cargo?.destination || ''}`}>
                        {row.cargo?.origin || '---'} → {row.cargo?.destination || '---'}
                      </p>
                      {row.cte ? (
                        <span className="inline-block mt-0.5 text-[9px] font-mono text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-1 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                          CT-e nº {row.cte}
                        </span>
                      ) : null}
                    </td>

                    {/* Motorista / Placa */}
                    <td className="py-2.5 px-2 max-w-[130px] xl:max-w-[160px]">
                      <p className="font-semibold text-gray-900 dark:text-white truncate" title={row.shipment.driverName}>
                        {row.shipment.driverName}
                      </p>
                      <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">
                        Placa: {row.shipment.horsePlate}
                      </p>
                    </td>

                    {/* Frete Empresa */}
                    <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap">
                      <span className="font-bold text-gray-900 dark:text-white text-xs">
                        R$ {row.companyFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {row.shipment.realProfitData?.complementCharged ? (
                        <p className="text-[9px] text-blue-600 dark:text-blue-400">
                          + R$ {row.shipment.realProfitData.complementCharged.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      ) : null}
                    </td>

                    {/* Frete Motorista */}
                    <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap">
                      <span className="font-bold text-gray-800 dark:text-gray-200 text-xs">
                        R$ {row.driverFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {row.toll > 0 && (
                        <p className="text-[9px] text-gray-400 dark:text-gray-500" title={`Líquido de Pedágio (R$ ${row.driverFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - R$ ${row.toll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}>
                          Líq. Ped: R$ {row.driverFreightNetToll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </td>

                    {/* Diferença de Frete */}
                    <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap">
                      <p className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                        R$ {row.freightDifference.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">
                        {row.freightDifferenceMarginPercent.toFixed(1)}%
                      </span>
                    </td>

                    {/* Despesas Operacionais */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      {row.totalExpenses > 0 || row.expenseItems.length > 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="font-mono font-bold text-red-600 dark:text-red-400 text-xs">
                            - R$ {row.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedShipmentForDetail(row.shipment)}
                            className="mt-0.5 text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold inline-flex items-center gap-0.5"
                          >
                            <Receipt className="w-2.5 h-2.5" />
                            Ver {row.expenseItems.length} despesa(s)
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[10px]">R$ 0,00</span>
                      )}
                    </td>

                    {/* Crédito Fiscal Gerado (Exportação) - Informativo - Oculto para Agenciador */}
                    {!isAgenciador && (
                      <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap">
                        {row.generatedCredit > 0 ? (
                          <div>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                              R$ {row.generatedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <p className="text-[8px] text-gray-500 dark:text-gray-400 font-medium">
                              Informativo
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-[10px]">---</span>
                        )}
                      </td>
                    )}

                    {/* Resultado Final (Lucro Real da Operação) */}
                    <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap">
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-black ${
                          row.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          R$ {row.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-[9px] font-extrabold px-1 py-0.2 rounded mt-0.5 ${
                          row.netProfit >= 0 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                        }`}>
                          {row.profitMarginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    {/* NOVO: Líquido Real Final Pós Comissões (Visível para Comercial, Admin, Diretor e Financeiro) */}
                    {canViewFinalNetProfit && (
                      <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap bg-teal-50/30 dark:bg-teal-950/20">
                        <div className="flex flex-col items-end">
                          <span className={`text-xs font-black ${
                            row.netProfitWithCommissions >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            R$ {row.netProfitWithCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[9px] font-extrabold px-1 py-0.2 rounded mt-0.5 ${
                            row.netProfitWithCommissions >= 0 
                              ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300' 
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                          }`}>
                            {row.marginWithCommissionsPercent.toFixed(1)}%
                          </span>
                          {row.totalCommissions > 0 ? (
                            <span 
                              className="text-[8px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5 truncate max-w-[120px]"
                              title={`Comissões abatidas: R$ ${row.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Agência: R$ ${row.agencyCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Embarcador: R$ ${row.shipperCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}
                            >
                              - R$ {row.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com.
                            </span>
                          ) : (
                            <span className="text-[8px] text-gray-400 dark:text-gray-500 mt-0.5">
                              Sem comissão
                            </span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Acesso ao Anexo e Ação de Correção */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {row.attachmentUrl ? (
                          <button
                            type="button"
                            onClick={() => openDocumentInNewTab(row.attachmentUrl!, `Resumo Custos - ${row.shipment.id}`)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-[10px] font-semibold transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800"
                            title="Visualizar Comprovante / Imagem Original"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditingShipmentForAttachment(row.shipment)}
                          className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[10px] font-semibold transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
                          title="Anexar ou corrigir imagem do resumo de custos e recalcular o Lucro Real"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{row.hasOcr ? 'Editar' : 'Anexar'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAgenciador ? (canViewFinalNetProfit ? 10 : 9) : (canViewFinalNetProfit ? 11 : 10)} className="py-10 text-center text-gray-500 dark:text-gray-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhum embarque encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>

            {/* RODAPÉ COM TOTALIZADORES */}
            {enrichedRows.length > 0 && (
              <tfoot className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white font-bold border-t-2 border-gray-300 dark:border-gray-600">
                <tr>
                  <td className="py-2.5 px-2 font-mono font-black uppercase text-[11px]" colSpan={3}>
                    TOTAL CONSOLIDADO ({totals.totalShipments} EMB.)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs text-blue-700 dark:text-blue-300">
                    R$ {totals.sumCompanyFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs text-amber-700 dark:text-amber-300">
                    R$ {totals.sumDriverFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs text-indigo-700 dark:text-indigo-300">
                    R$ {totals.sumFreightDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <p className="text-[9px] font-normal">{totals.consolidatedFreightDiffMargin.toFixed(1)}%</p>
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-xs text-red-600 dark:text-red-400">
                    - R$ {totals.sumExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {!isAgenciador && (
                    <td className="py-2.5 px-2 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      R$ {totals.sumGeneratedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <p className="text-[8px] font-normal text-gray-500 dark:text-gray-400">Informativo</p>
                    </td>
                  )}
                  <td className="py-2.5 px-2 text-right font-mono text-xs">
                    <span className={`text-xs font-black ${
                      totals.sumNetProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      R$ {totals.sumNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <p className={`text-[9px] font-extrabold ${
                      totals.sumNetProfit >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'
                    }`}>
                      Margem: {totals.consolidatedMargin.toFixed(2)}%
                    </p>
                  </td>
                  {canViewFinalNetProfit && (
                    <td className="py-2.5 px-2 text-right font-mono text-xs bg-teal-100/40 dark:bg-teal-900/30">
                      <span className={`text-xs font-black ${
                        totals.sumNetProfitWithCommissions >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-red-700 dark:text-red-300'
                      }`}>
                        R$ {totals.sumNetProfitWithCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <p className={`text-[9px] font-extrabold ${
                        totals.sumNetProfitWithCommissions >= 0 ? 'text-teal-800 dark:text-teal-400' : 'text-red-800 dark:text-red-400'
                      }`}>
                        Margem: {totals.consolidatedMarginWithCommissions.toFixed(2)}%
                      </p>
                      {totals.sumCommissions > 0 && (
                        <p className="text-[8px] text-purple-700 dark:text-purple-300 font-semibold" title={`Comissões totais abatidas: R$ ${totals.sumCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Agência: R$ ${totals.sumAgencyCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Embarcador: R$ ${totals.sumShipperCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}>
                          - R$ {totals.sumCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com.
                        </p>
                      )}
                    </td>
                  )}
                  <td className="py-2.5 px-2 text-center text-[10px] text-gray-500">
                    {totals.countOcr} IA
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MODAL DE DETALHAMENTO DE DESPESAS DA OPERAÇÃO - AUTOMATIZAÇÃO DO CT-E */}
      {selectedShipmentForDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/60 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Automatização do CT-e & Lucro Real - Embarque {selectedShipmentForDetail.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShipmentForDetail(null)}
                className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const currentShipment = shipments.find(s => s.id === selectedShipmentForDetail.id) || selectedShipmentForDetail;
              const detailRow = enrichedRows.find(r => r.shipment.id === currentShipment.id);
              const cargo = detailRow?.cargo || cargoMap.get(currentShipment.cargoId);
              const tonnage = currentShipment.shipmentTonnage || cargo?.totalVolume || 0;

              return (
                <div className="p-4 sm:p-5 overflow-y-auto">
                  <CteCostAutomationPanel
                    shipment={currentShipment}
                    cargo={cargo}
                    loadedTonnage={tonnage}
                    stays={stays}
                    users={users}
                    clients={clients}
                    currentUser={currentUser}
                    onUpdateShipmentData={async (shipmentId, data) => {
                      if (onUpdateShipmentData) {
                        await onUpdateShipmentData(shipmentId, data);
                      } else if (onBatchUpdateShipments) {
                        const target = shipments.find(s => s.id === shipmentId) || currentShipment;
                        const updated = { ...target, ...data } as Shipment;
                        await onBatchUpdateShipments([updated]);
                      }
                    }}
                  />
                </div>
              );
            })()}

            <div className="p-4 bg-gray-50 dark:bg-gray-900/60 border-t dark:border-gray-700 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedShipmentForDetail(null)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ATUALIZAÇÃO / ANEXO DE RESUMO DE CUSTOS */}
      {editingShipmentForAttachment && currentUser && (
        <AttachmentModal
          isOpen={Boolean(editingShipmentForAttachment)}
          onClose={() => setEditingShipmentForAttachment(null)}
          onSave={async (data) => {
            if (onUpdateAttachment && editingShipmentForAttachment) {
              await onUpdateAttachment(editingShipmentForAttachment.id, data);
            }
            setEditingShipmentForAttachment(null);
          }}
          onUpdateShipmentData={onUpdateShipmentData}
          shipment={shipments.find(s => s.id === editingShipmentForAttachment.id) || editingShipmentForAttachment}
          cargo={cargoMap.get(editingShipmentForAttachment.cargoId)}
          documentName="Comprovante de Pagamento de Saldo"
          currentUser={currentUser}
          products={products}
          clients={clients}
          users={users}
        />
      )}


    </div>
  );
};

export default RealProfitReport;
