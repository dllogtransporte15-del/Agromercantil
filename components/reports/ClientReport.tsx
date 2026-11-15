import React, { useState, useMemo } from 'react';
import type { Shipment, Cargo, Client, User } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { StayRecord } from '../../utils/toolStorage';
import { calculateShipmentExpenses } from '../../utils/operationalExpensesCalculator';
import { isStayForShipment, hasCteAttached, isCteApplicableForStatus, getShipmentCte } from '../../utils';
import { 
  Download, 
  List, 
  X, 
  Filter, 
  Building2, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  CheckCircle2, 
  TrendingUp, 
  Search, 
  Scale, 
  FileSpreadsheet, 
  ArrowRight, 
  Layers,
  ShieldAlert,
  Truck
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfLogo } from '../../utils/pdfGenerator';
import MultiSelectDropdown from '../MultiSelectDropdown';

interface ClientReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  clients: Client[];
  stays?: StayRecord[];
  companyLogo?: string | null;
  currentUser?: User | null;
}

interface ClientBranchStats {
  id: string;
  name: string;
  cnpj: string;
  cityState: string;
  totalTonnage: number;
  grossBilled: number;
  profitMargin: number;
  totalShipments: number;
  completedShipments: number;
  profitMarginPercentage: number;
}

interface ClientStats {
  id: string;
  name: string;
  cnpj: string;
  totalTonnage: number;
  grossBilled: number;
  profitMargin: number;
  totalShipments: number;
  completedShipments: number;
  profitMarginPercentage: number;
  branches: ClientBranchStats[];
}

const StatCard: React.FC<{ 
  title: string; 
  value: string | number; 
  icon: React.ReactElement; 
  formatAsCurrency?: boolean;
  subtext?: string;
}> = ({ title, value, icon, formatAsCurrency = false, subtext }) => {
  const displayValue = formatAsCurrency && typeof value === 'number'
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : value;

  return (
    <div className="relative overflow-hidden p-4 bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-100 dark:border-gray-700/80 shadow-xs hover:shadow-md transition-all duration-200 group">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate mb-1">
            {title}
          </p>
          <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            {displayValue}
          </p>
          {subtext && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 truncate">
              {subtext}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/60 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
    </div>
  );
};

const ClientReport: React.FC<ClientReportProps> = ({ shipments, cargos, clients, stays = [], companyLogo, currentUser }) => {
  const isClientUser = currentUser?.profile === UserProfile.Cliente;
  const [showListModal, setShowListModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | 'ALL'>('ALL');
  const [expandedClientBranches, setExpandedClientBranches] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Modal filters
  const [filterModalStatus, setFilterModalStatus] = useState<string[]>([]);
  const [filterModalOrigin, setFilterModalOrigin] = useState<string[]>([]);
  const [filterModalDest, setFilterModalDest] = useState<string[]>([]);
  const [filterModalDriver, setFilterModalDriver] = useState<string[]>([]);
  const [filterModalCnpj, setFilterModalCnpj] = useState<string[]>([]);
  const [showModalFilters, setShowModalFilters] = useState(false);

  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

  // Helper to identify the branch/CNPJ info of a cargo
  const getCargoBranchInfo = (cargo: Cargo) => {
    const client = clients.find(c => c.id === cargo.clientId);
    if (!client) return { cnpj: cargo.clientCnpj || '', name: 'Matriz', cityState: '-' };

    const cleanCargoCnpj = cargo.clientCnpj?.replace(/\D/g, '') || '';
    const cleanMainCnpj = client.cnpj?.replace(/\D/g, '') || '';

    if (cleanCargoCnpj && cleanCargoCnpj !== cleanMainCnpj && client.secondaryCnpjs) {
      const branch = client.secondaryCnpjs.find(b => b.cnpj.replace(/\D/g, '') === cleanCargoCnpj || b.id === cargo.clientBranchId);
      if (branch) {
        return {
          cnpj: branch.cnpj,
          name: branch.nomeFantasia || branch.razaoSocial || `Filial (${branch.city || branch.state})`,
          cityState: branch.city ? `${branch.city}/${branch.state}` : '-'
        };
      }
    }

    return {
      cnpj: client.cnpj,
      name: 'Matriz (Principal)',
      cityState: client.city ? `${client.city}/${client.state}` : '-'
    };
  };

  const clientStats = useMemo<ClientStats[]>(() => {
    const statsMap = new Map<string, {
      totalTonnage: number;
      grossBilled: number;
      profitMargin: number;
      totalShipments: number;
      completedShipments: number;
      branchesMap: Map<string, ClientBranchStats>;
    }>();

    const allowedClients = isClientUser && currentUser?.clientId
      ? clients.filter(c => c.id === currentUser.clientId)
      : clients;

    allowedClients.forEach(client => {
      const branchesMap = new Map<string, ClientBranchStats>();
      
      // Initialize Matriz
      branchesMap.set(client.cnpj.replace(/\D/g, ''), {
        id: 'matriz',
        name: 'Matriz (Principal)',
        cnpj: client.cnpj,
        cityState: client.city ? `${client.city}/${client.state}` : '-',
        totalTonnage: 0,
        grossBilled: 0,
        profitMargin: 0,
        totalShipments: 0,
        completedShipments: 0,
        profitMarginPercentage: 0,
      });

      // Initialize Secondary Branches
      (client.secondaryCnpjs || []).forEach(b => {
        const cleanCnpj = b.cnpj.replace(/\D/g, '');
        if (cleanCnpj && !branchesMap.has(cleanCnpj)) {
          branchesMap.set(cleanCnpj, {
            id: b.id,
            name: b.nomeFantasia || b.razaoSocial || `Filial (${b.city || b.state})`,
            cnpj: b.cnpj,
            cityState: b.city ? `${b.city}/${b.state}` : '-',
            totalTonnage: 0,
            grossBilled: 0,
            profitMargin: 0,
            totalShipments: 0,
            completedShipments: 0,
            profitMarginPercentage: 0,
          });
        }
      });

      statsMap.set(client.id, {
        totalTonnage: 0,
        grossBilled: 0,
        profitMargin: 0,
        totalShipments: 0,
        completedShipments: 0,
        branchesMap
      });
    });

    // Regra: considerar exclusivamente embarques válidos com CT-e emitido
    shipments.forEach(shipment => {
      if (shipment.status === ShipmentStatus.Cancelado || !isCteApplicableForStatus(shipment.status)) return;
      if (!hasCteAttached(shipment)) return;

      const cargo = cargoMap.get(shipment.cargoId);
      if (!cargo) return;

      const clientEntry = statsMap.get(cargo.clientId);
      if (!clientEntry) return;

      const client = clients.find(c => c.id === cargo.clientId);
      const ton = shipment.loadedTonnage || shipment.shipmentTonnage || 0;
      const expenses = calculateShipmentExpenses(shipment, cargo, undefined, stays);
      const grossValue = expenses.companyFreight;

      // Estadias aprovadas vinculadas a este embarque com CT-e
      const shipmentStays = stays.filter(stay => isStayForShipment(stay, shipment) && (stay.approvedValue || 0) > 0);
      const demurrageRevenue = shipmentStays
        .reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);

      const demurrageProfit = shipmentStays
        .reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);

      // Faturamento bruto = frete + estadias aprovadas
      const totalGrossValue = grossValue + demurrageRevenue;
      const profit = expenses.netProfit + demurrageProfit;

      const isCompleted = shipment.status === ShipmentStatus.Finalizado;

      // Add to overall client
      clientEntry.totalTonnage += ton;
      clientEntry.totalShipments += 1;
      if (isCompleted) clientEntry.completedShipments += 1;
      clientEntry.grossBilled += totalGrossValue;
      clientEntry.profitMargin += profit;

      // Add to specific Branch/CNPJ
      const cleanCargoCnpj = (cargo.clientCnpj || client?.cnpj || '').replace(/\D/g, '');
      let branchStat = clientEntry.branchesMap.get(cleanCargoCnpj);
      if (!branchStat) {
        const defaultMatrizKey = (client?.cnpj || '').replace(/\D/g, '');
        branchStat = clientEntry.branchesMap.get(defaultMatrizKey);
        if (!branchStat) {
          branchStat = {
            id: `dyn_${cleanCargoCnpj}`,
            name: cargo.clientCnpj ? `CNPJ: ${cargo.clientCnpj}` : 'Matriz',
            cnpj: cargo.clientCnpj || client?.cnpj || '',
            cityState: '-',
            totalTonnage: 0,
            grossBilled: 0,
            profitMargin: 0,
            totalShipments: 0,
            completedShipments: 0,
            profitMarginPercentage: 0,
          };
          clientEntry.branchesMap.set(cleanCargoCnpj, branchStat);
        }
      }

      branchStat.totalTonnage += ton;
      branchStat.totalShipments += 1;
      if (isCompleted) branchStat.completedShipments += 1;
      branchStat.grossBilled += totalGrossValue;
      branchStat.profitMargin += profit;
    });

    return Array.from(statsMap.entries())
      .map(([clientId, stats]) => {
        const client = clients.find(c => c.id === clientId);
        const branches = Array.from(stats.branchesMap.values())
          .map(b => ({
            ...b,
            profitMarginPercentage: b.grossBilled > 0 ? (b.profitMargin / b.grossBilled) * 100 : 0
          }))
          .filter(b => b.grossBilled > 0 || (client?.secondaryCnpjs && client.secondaryCnpjs.length > 0))
          .sort((a, b) => b.grossBilled - a.grossBilled);

        return {
          id: clientId,
          name: client?.nomeFantasia || client?.razaoSocial || 'N/A',
          cnpj: client?.cnpj || '',
          totalTonnage: stats.totalTonnage,
          grossBilled: stats.grossBilled,
          profitMargin: stats.profitMargin,
          totalShipments: stats.totalShipments,
          completedShipments: stats.completedShipments,
          profitMarginPercentage: stats.grossBilled > 0 ? (stats.profitMargin / stats.grossBilled) * 100 : 0,
          branches
        };
      })
      .filter(stat => stat.grossBilled > 0 || (isClientUser && stat.id === currentUser?.clientId))
      .sort((a, b) => b.grossBilled - a.grossBilled);
  }, [shipments, cargos, clients, stays, cargoMap, isClientUser, currentUser]);

  // Global summary KPIs
  const globalSummary = useMemo(() => {
    return clientStats.reduce((acc, c) => {
      acc.totalClients += 1;
      acc.totalBranches += (c.branches?.length || 1);
      acc.totalShipments += c.totalShipments;
      acc.completedShipments += c.completedShipments;
      acc.totalTonnage += c.totalTonnage;
      acc.totalGrossBilled += c.grossBilled;
      acc.totalProfitMargin += c.profitMargin;
      return acc;
    }, {
      totalClients: 0,
      totalBranches: 0,
      totalShipments: 0,
      completedShipments: 0,
      totalTonnage: 0,
      totalGrossBilled: 0,
      totalProfitMargin: 0
    });
  }, [clientStats]);

  const globalMarginPercentage = globalSummary.totalGrossBilled > 0
    ? (globalSummary.totalProfitMargin / globalSummary.totalGrossBilled) * 100
    : 0;

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clientStats;
    const q = searchQuery.toLowerCase().replace(/[^\w]/g, '');
    return clientStats.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const cleanCnpj = c.cnpj.replace(/\D/g, '');
      const cnpjMatch = cleanCnpj.includes(q);
      const branchMatch = c.branches.some(b => 
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        b.cnpj.replace(/\D/g, '').includes(q)
      );
      return nameMatch || cnpjMatch || branchMatch;
    });
  }, [clientStats, searchQuery]);

  const toggleBranchExpand = (clientId: string) => {
    setExpandedClientBranches(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  const getShipmentsForPdfAndList = (clientId?: string, specificCnpj?: string) => {
    let result = shipments.filter(s => s.status !== ShipmentStatus.Cancelado && isCteApplicableForStatus(s.status) && hasCteAttached(s));
    if (clientId && clientId !== 'ALL') {
      result = result.filter(s => cargoMap.get(s.cargoId)?.clientId === clientId);
    }
    if (specificCnpj) {
      const cleanSpecific = specificCnpj.replace(/\D/g, '');
      result = result.filter(s => {
        const cargo = cargoMap.get(s.cargoId);
        if (!cargo) return false;
        const cl = clients.find(c => c.id === cargo.clientId);
        const cargoCnpj = (cargo.clientCnpj || cl?.cnpj || '').replace(/\D/g, '');
        return cargoCnpj === cleanSpecific;
      });
    }
    return result;
  };

  const baseModalShipments = useMemo(() => {
    const nonCanceled = shipments.filter(s => s.status !== ShipmentStatus.Cancelado && isCteApplicableForStatus(s.status) && hasCteAttached(s));
    if (selectedClientId && selectedClientId !== 'ALL') {
      return nonCanceled.filter(s => cargoMap.get(s.cargoId)?.clientId === selectedClientId);
    }
    if (isClientUser && currentUser?.clientId) {
      return nonCanceled.filter(s => cargoMap.get(s.cargoId)?.clientId === currentUser.clientId);
    }
    return nonCanceled;
  }, [shipments, selectedClientId, isClientUser, currentUser, cargoMap]);

  // Modal filter options
  const modalStatusOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => s.status))).filter(Boolean).sort(), [baseModalShipments]);
  const modalOriginOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => cargoMap.get(s.cargoId)?.origin || ''))).filter(Boolean).sort(), [baseModalShipments, cargoMap]);
  const modalDestOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => cargoMap.get(s.cargoId)?.destination || ''))).filter(Boolean).sort(), [baseModalShipments, cargoMap]);
  const modalDriverOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => s.driverName))).filter(Boolean).sort(), [baseModalShipments]);
  
  const modalCnpjOptions = useMemo(() => {
    const set = new Set<string>();
    baseModalShipments.forEach(s => {
      const cargo = cargoMap.get(s.cargoId);
      if (cargo) {
        const info = getCargoBranchInfo(cargo);
        set.add(`${info.name} — ${info.cnpj}`);
      }
    });
    return Array.from(set).sort();
  }, [baseModalShipments, cargoMap, clients]);

  const filteredModalShipments = useMemo(() => {
    return baseModalShipments.filter(shipment => {
      const cargo = cargoMap.get(shipment.cargoId);
      if (filterModalStatus.length > 0 && !filterModalStatus.includes(shipment.status)) return false;
      if (filterModalOrigin.length > 0 && !filterModalOrigin.includes(cargo?.origin || '')) return false;
      if (filterModalDest.length > 0 && !filterModalDest.includes(cargo?.destination || '')) return false;
      if (filterModalDriver.length > 0 && !filterModalDriver.includes(shipment.driverName)) return false;
      if (filterModalCnpj.length > 0 && cargo) {
        const info = getCargoBranchInfo(cargo);
        const label = `${info.name} — ${info.cnpj}`;
        if (!filterModalCnpj.includes(label)) return false;
      }
      return true;
    });
  }, [baseModalShipments, filterModalStatus, filterModalOrigin, filterModalDest, filterModalDriver, filterModalCnpj, cargoMap, clients]);

  // Financial totals for modal
  const modalFinancialTotals = useMemo(() => {
    return filteredModalShipments.reduce((acc, s) => {
      const cargo = cargoMap.get(s.cargoId);
      const tons = s.shipmentTonnage || 0;
      const empRate = s.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
      const motTotal = s.driverFreightValue || 0;
      const empTotal = empRate * tons;

      acc.totalTons += tons;
      acc.totalCompanyFreight += empTotal;
      acc.totalDriverFreight += motTotal;
      acc.netMargin += (empTotal - motTotal);
      return acc;
    }, {
      totalTons: 0,
      totalCompanyFreight: 0,
      totalDriverFreight: 0,
      netMargin: 0
    });
  }, [filteredModalShipments, cargoMap]);

  const activeModalFiltersCount = filterModalStatus.length + filterModalOrigin.length + filterModalDest.length + filterModalDriver.length + filterModalCnpj.length;

  const clearModalFilters = () => {
    setFilterModalStatus([]);
    setFilterModalOrigin([]);
    setFilterModalDest([]);
    setFilterModalDriver([]);
    setFilterModalCnpj([]);
  };

  const openListModal = (clientId: string, specificCnpj?: string) => {
    setSelectedClientId(clientId);
    clearModalFilters();
    if (specificCnpj) {
      const client = clients.find(c => c.id === clientId);
      const cleanSpecific = specificCnpj.replace(/\D/g, '');
      let label = `Matriz — ${client?.cnpj}`;
      if (client?.secondaryCnpjs) {
        const branch = client.secondaryCnpjs.find(b => b.cnpj.replace(/\D/g, '') === cleanSpecific);
        if (branch) {
          label = `${branch.nomeFantasia || branch.razaoSocial || 'Filial'} — ${branch.cnpj}`;
        }
      }
      setFilterModalCnpj([label]);
    }
    setShowModalFilters(false);
    setShowListModal(true);
  };

  const generatePDF = (clientId?: string, specificCnpj?: string) => {
    const targetShipments = getShipmentsForPdfAndList(clientId, specificCnpj).filter(s => s.status === ShipmentStatus.Finalizado && hasCteAttached(s));
    const client = clientId && clientId !== 'ALL' ? clients.find(c => c.id === clientId) : (isClientUser && currentUser?.clientId ? clients.find(c => c.id === currentUser.clientId) : undefined);
    
    let subTitleName = client?.nomeFantasia || client?.razaoSocial || 'Todos os Clientes';
    if (specificCnpj && client) {
      const cleanSpecific = specificCnpj.replace(/\D/g, '');
      const branch = client.secondaryCnpjs?.find(b => b.cnpj.replace(/\D/g, '') === cleanSpecific);
      const branchLabel = branch ? (branch.nomeFantasia || branch.city || 'Filial') : 'Matriz';
      subTitleName = `${subTitleName} - ${branchLabel} (CNPJ: ${specificCnpj})`;
    }

    const doc = new jsPDF('landscape');
    addPdfLogo(doc, companyLogo, { align: 'right', y: 5, width: 35, height: 15 });

    doc.setFontSize(15);
    doc.text(isClientUser ? `Relatório de Demandas e Embarques - ${subTitleName}` : `Relatório de Embarques Finalizados - Cliente: ${subTitleName}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);

    const tableColumn = isClientUser
      ? ["ID", "CT-e", "Início", "Fim", "Cliente / Filial", "CNPJ", "Motorista", "Placa", "Origem", "Destino", "Frete Contratado (/Ton)", "Peso Origem", "Peso Destino", "Quebra"]
      : ["ID", "CT-e", "Início", "Fim", "Cliente / Filial", "CNPJ", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Origem", "Peso Destino", "Quebra"];
    
    const tableRows: any[] = [];

    let totalFreteEmpresa = 0;
    let totalFreteMotorista = 0;
    let totalPesoCarregado = 0;
    let totalPesoDestino = 0;

    targetShipments.forEach(shipment => {
      const cargo = cargoMap.get(shipment.cargoId);
      const origem = cargo?.origin || 'N/A';
      const destino = cargo?.destination || 'N/A';
      const info = cargo ? getCargoBranchInfo(cargo) : { cnpj: '-', name: 'Matriz', cityState: '-' };
      const cliente = client ? `${client.nomeFantasia || client.razaoSocial} (${info.name})` : 'N/A';

      const dataInicio = new Date(shipment.createdAt).toLocaleDateString('pt-BR');
      const statusFinalizado = shipment.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);
      const dataFim = statusFinalizado ? new Date(statusFinalizado.timestamp).toLocaleDateString('pt-BR') : '-';

      const cteNumber = getShipmentCte(shipment) || shipment.cteNumber || '-';

      const freteEmpresa = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
      const freteMotorista = shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1));

      const pesoOrigem = shipment.shipmentTonnage || 0;
      const pesoDestino = shipment.unloadedTonnage;

      let quebra = '-';
      if (pesoDestino !== undefined && pesoDestino < pesoOrigem) {
        quebra = (pesoOrigem - pesoDestino).toFixed(2) + ' t';
      }

      totalFreteEmpresa += freteEmpresa * pesoOrigem;
      totalFreteMotorista += shipment.driverFreightValue;
      totalPesoCarregado += pesoOrigem;
      if (pesoDestino !== undefined) {
        totalPesoDestino += pesoDestino;
      }

      const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

      if (isClientUser) {
        tableRows.push([
          shipment.id,
          cteNumber,
          dataInicio,
          dataFim,
          cliente,
          info.cnpj,
          shipment.driverName,
          shipment.horsePlate || '-',
          origem,
          destino,
          formatCurrency(freteEmpresa),
          pesoOrigem.toFixed(2) + ' t',
          pesoDestino !== undefined ? pesoDestino.toFixed(2) + ' t' : '-',
          quebra
        ]);
      } else {
        tableRows.push([
          shipment.id,
          cteNumber,
          dataInicio,
          dataFim,
          cliente,
          info.cnpj,
          shipment.driverName,
          shipment.horsePlate || '-',
          origem,
          destino,
          formatCurrency(freteEmpresa),
          formatCurrency(freteMotorista),
          pesoOrigem.toFixed(2) + ' t',
          pesoDestino !== undefined ? pesoDestino.toFixed(2) + ' t' : '-',
          quebra
        ]);
      }
    });

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    if (isClientUser) {
      tableRows.push([
        "TOTAIS", "-", "-", "-", "-", "-", "-", `Embarques: ${targetShipments.length}`, "-", "-",
        formatCurrency(totalFreteEmpresa),
        totalPesoCarregado.toFixed(2) + ' t',
        totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
        "-"
      ]);
    } else {
      tableRows.push([
        "TOTAIS", "-", "-", "-", "-", "-", "-", `Embarques: ${targetShipments.length}`, "-", "-",
        formatCurrency(totalFreteEmpresa),
        formatCurrency(totalFreteMotorista),
        totalPesoCarregado.toFixed(2) + ' t',
        totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
        "-"
      ]);

      tableRows.push([
        "LÍQUIDO", "-", "-", "-", "-", "-", "-", "-", "-", "-",
        formatCurrency(totalFreteEmpresa - totalFreteMotorista),
        "-", "-", "-", "-"
      ]);
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 26,
      theme: 'grid',
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [166, 113, 66], textColor: 255 },
      didParseCell: (data) => {
        if (data.cell.section === 'body') {
          const rawRow = data.row.raw;
          if (Array.isArray(rawRow)) {
            if (rawRow[0] === 'TOTAIS' || rawRow[0] === 'TOTAL') {
              data.cell.styles.fillColor = [240, 240, 240];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 0, 0];
            } else if (rawRow[0] === 'LÍQUIDO') {
              data.cell.styles.fillColor = [220, 245, 220];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 102, 0];
            }
          }
        }
      }
    });

    const fileSuffix = specificCnpj ? `_${specificCnpj.replace(/\D/g, '')}` : '';
    doc.save(`Relatorio_Demandas_${subTitleName.replace(/[^a-zA-Z0-9]/g, '_')}${fileSuffix}_${Date.now()}.pdf`);
  };

  const generatePDFFromModal = () => {
    const client = selectedClientId !== 'ALL' ? clients.find(c => c.id === selectedClientId) : (isClientUser && currentUser?.clientId ? clients.find(c => c.id === currentUser.clientId) : undefined);
    const clientName = client?.nomeFantasia || client?.razaoSocial || 'Minha Empresa';

    const filterDesc: string[] = [];
    if (filterModalCnpj.length > 0) filterDesc.push(`CNPJ/Filial: ${filterModalCnpj.join(', ')}`);
    if (filterModalStatus.length > 0) filterDesc.push(`Status: ${filterModalStatus.join(', ')}`);
    if (filterModalDriver.length > 0) filterDesc.push(`Motorista: ${filterModalDriver.join(', ')}`);
    if (filterModalOrigin.length > 0) filterDesc.push(`Origem: ${filterModalOrigin.join(', ')}`);
    if (filterModalDest.length > 0) filterDesc.push(`Destino: ${filterModalDest.join(', ')}`);

    const doc = new jsPDF('landscape');
    addPdfLogo(doc, companyLogo, { align: 'right', y: 5, width: 35, height: 15 });

    doc.setFontSize(15);
    doc.text(`Listagem de Embarques - ${clientName}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);
    if (filterDesc.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Filtros: ${filterDesc.join(' | ')}`, 14, 27);
      doc.setTextColor(0);
    }

    const startY = filterDesc.length > 0 ? 32 : 27;
    const tableColumn = isClientUser
      ? ["ID", "CT-e", "Início", "Fim", "Cliente / Filial", "CNPJ", "Motorista", "Placa", "Origem", "Destino", "Frete Contratado (/Ton)", "Peso Origem", "Peso Destino", "Quebra", "Status"]
      : ["ID", "CT-e", "Início", "Fim", "Cliente / Filial", "CNPJ", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Origem", "Peso Destino", "Quebra", "Status"];
    
    const tableRows: any[] = [];

    let totalFreteEmpresa = 0;
    let totalFreteMotorista = 0;
    let totalPesoCarregado = 0;
    let totalPesoDestino = 0;

    const shipmentsForPdf = filteredModalShipments.filter(s => s.status === ShipmentStatus.Finalizado && hasCteAttached(s));

    shipmentsForPdf.forEach(shipment => {
      const cargo = cargoMap.get(shipment.cargoId);
      const origem = cargo?.origin || 'N/A';
      const destino = cargo?.destination || 'N/A';
      const info = cargo ? getCargoBranchInfo(cargo) : { cnpj: '-', name: 'Matriz', cityState: '-' };
      const clienteNome = clients.find(c => c.id === cargo?.clientId)?.nomeFantasia || 'N/A';

      const dataInicio = new Date(shipment.createdAt).toLocaleDateString('pt-BR');
      const statusFinalizado = shipment.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);
      const dataFim = statusFinalizado ? new Date(statusFinalizado.timestamp).toLocaleDateString('pt-BR') : '-';

      const cteNumber = getShipmentCte(shipment) || shipment.cteNumber || '-';

      const freteEmpresa = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
      const freteMotorista = shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1));

      const pesoOrigem = shipment.shipmentTonnage || 0;
      const pesoDestino = shipment.unloadedTonnage;

      let quebra = '-';
      if (pesoDestino !== undefined && pesoDestino < pesoOrigem) {
        quebra = (pesoOrigem - pesoDestino).toFixed(2) + ' t';
      }

      totalFreteEmpresa += freteEmpresa * pesoOrigem;
      totalFreteMotorista += shipment.driverFreightValue;
      totalPesoCarregado += pesoOrigem;
      if (pesoDestino !== undefined) {
        totalPesoDestino += pesoDestino;
      }

      const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

      if (isClientUser) {
        tableRows.push([
          shipment.id,
          cteNumber,
          dataInicio,
          dataFim,
          `${clienteNome} (${info.name})`,
          info.cnpj,
          shipment.driverName,
          shipment.horsePlate || '-',
          origem,
          destino,
          fmt(freteEmpresa),
          pesoOrigem.toFixed(2) + ' t',
          pesoDestino !== undefined ? pesoDestino.toFixed(2) + ' t' : '-',
          quebra,
          shipment.status
        ]);
      } else {
        tableRows.push([
          shipment.id,
          cteNumber,
          dataInicio,
          dataFim,
          `${clienteNome} (${info.name})`,
          info.cnpj,
          shipment.driverName,
          shipment.horsePlate || '-',
          origem,
          destino,
          fmt(freteEmpresa),
          fmt(freteMotorista),
          pesoOrigem.toFixed(2) + ' t',
          pesoDestino !== undefined ? pesoDestino.toFixed(2) + ' t' : '-',
          quebra,
          shipment.status
        ]);
      }
    });

    const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    if (isClientUser) {
      tableRows.push([
        "TOTAIS", "-", "-", "-", "-", "-", "-", `Embarques: ${shipmentsForPdf.length}`, "-", "-",
        fmt(totalFreteEmpresa),
        totalPesoCarregado.toFixed(2) + ' t',
        totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
        "-", "-"
      ]);
    } else {
      tableRows.push([
        "TOTAIS", "-", "-", "-", "-", "-", "-", `Embarques: ${shipmentsForPdf.length}`, "-", "-",
        fmt(totalFreteEmpresa),
        fmt(totalFreteMotorista),
        totalPesoCarregado.toFixed(2) + ' t',
        totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
        "-", "-"
      ]);

      tableRows.push([
        "LÍQUIDO", "-", "-", "-", "-", "-", "-", "-", "-", "-",
        fmt(totalFreteEmpresa - totalFreteMotorista),
        "-", "-", "-", "-", "-"
      ]);
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY,
      theme: 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [166, 113, 66], textColor: 255 },
      didParseCell: (data) => {
        if (data.cell.section === 'body') {
          const rawRow = data.row.raw;
          if (Array.isArray(rawRow)) {
            if (rawRow[0] === 'TOTAIS' || rawRow[0] === 'TOTAL') {
              data.cell.styles.fillColor = [240, 240, 240];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 0, 0];
            } else if (rawRow[0] === 'LÍQUIDO') {
              data.cell.styles.fillColor = [220, 245, 220];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 102, 0];
            }
          }
        }
      }
    });

    const suffix = activeModalFiltersCount > 0 ? '_filtrado' : '';
    doc.save(`Listagem_Demandas_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}${suffix}_${Date.now()}.pdf`);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header / Actions Bar */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                {isClientUser ? 'Histórico e Desempenho da Minha Empresa' : 'Desempenho por Cliente e Filial'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isClientUser
                  ? 'Consulte o histórico consolidado de transporte e o detalhamento por cada filial e CNPJ da sua empresa.'
                  : 'Demonstrativo executivo de faturamento, margens, volume transportado e desempenho por filial.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => generatePDF('ALL')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-xs hover:shadow-md text-xs sm:text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" /> Baixar PDF Consolidado
          </button>
          <button
            onClick={() => openListModal('ALL')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-xs hover:shadow-md text-xs sm:text-sm cursor-pointer"
          >
            <List className="w-4 h-4" /> Listagem Completa
          </button>
        </div>
      </div>

      {/* Executive Consolidated KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-gradient-to-br from-amber-600 to-amber-700 text-white rounded-2xl shadow-sm">
          <div className="flex items-center justify-between opacity-90 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isClientUser ? 'Minha Empresa' : 'Clientes Ativos'}</span>
            <Building2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black">{globalSummary.totalClients}</p>
          <p className="text-[11px] text-amber-100 mt-0.5">
            {globalSummary.totalBranches} CNPJs / filiais atendidas
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Volume Faturado</span>
            <Scale className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white">
            {globalSummary.totalTonnage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm font-semibold text-gray-400">ton</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Embarques com CT-e emitido</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isClientUser ? 'Total em Frete' : 'Faturamento Bruto'}</span>
            <DollarSignIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(globalSummary.totalGrossBilled)}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Inclui estadias e fretes</p>
        </div>

        {isClientUser ? (
          <>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Frete Médio / Ton</span>
                <TrendingUp className="w-4 h-4 text-teal-500" />
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {formatCurrency(globalSummary.totalTonnage > 0 ? (globalSummary.totalGrossBilled / globalSummary.totalTonnage) : 0)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Custo unitário por tonelada</p>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Viagens Concluídas</span>
                <CheckCircle2 className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {globalSummary.completedShipments} <span className="text-sm font-semibold text-gray-400">/ {globalSummary.totalShipments}</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {globalSummary.totalShipments > 0 ? ((globalSummary.completedShipments / globalSummary.totalShipments) * 100).toFixed(0) : 0}% entregas finalizadas
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Lucro Operacional</span>
                <TrendingUp className="w-4 h-4 text-teal-500" />
              </div>
              <p className="text-2xl font-black text-teal-600 dark:text-teal-400">
                {formatCurrency(globalSummary.totalProfitMargin)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Receita líquida após motoristas</p>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Margem Média</span>
                <PackageIcon className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {globalMarginPercentage.toFixed(2)}%
              </p>
              <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(globalMarginPercentage, 100)}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, filial ou CNPJ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium self-end sm:self-center">
          Exibindo <span className="font-bold text-gray-900 dark:text-white">{filteredClients.length}</span> de {clientStats.length} empresas
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center text-gray-500 dark:text-gray-400 shadow-xs border border-gray-100 dark:border-gray-700">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
            <Building2 className="w-6 h-6" />
          </div>
          <p className="font-bold text-gray-700 dark:text-gray-300">Nenhum cliente encontrado</p>
          <p className="text-xs mt-1">Verifique o termo digitado ou revise os filtros de data.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClients.map(stats => {
            const hasMultipleBranches = stats.branches && stats.branches.length > 1;
            const isBranchesExpanded = !!expandedClientBranches[stats.id] || (isClientUser && hasMultipleBranches);

            return (
              <div 
                key={stats.id} 
                className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 hover:border-amber-200 dark:hover:border-amber-800/60 transition-all duration-200 space-y-4"
              >
                {/* Client Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-700/80">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-600 text-white flex items-center justify-center font-black text-sm shadow-xs flex-shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                          {stats.name}
                        </h3>
                        {hasMultipleBranches && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {stats.branches.length} CNPJs Vinculados
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                        CNPJ Matriz: {stats.cnpj}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    {hasMultipleBranches && (
                      <button
                        onClick={() => toggleBranchExpand(stats.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          isBranchesExpanded
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-xs'
                            : 'bg-gray-50 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Ver por CNPJ ({stats.branches.length})</span>
                        {isBranchesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => generatePDF(stats.id)}
                      className="flex items-center gap-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/40 px-3.5 py-2 rounded-xl font-bold transition-colors text-xs border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                      title="Baixar PDF consolidado deste cliente"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF Consolidado
                    </button>
                    <button
                      onClick={() => openListModal(stats.id)}
                      className="flex items-center gap-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-900/40 px-3.5 py-2 rounded-xl font-bold transition-colors text-xs border border-amber-200 dark:border-amber-900/50 cursor-pointer"
                      title="Ver todos os embarques deste cliente"
                    >
                      <List className="w-3.5 h-3.5" /> Listagem ({stats.totalShipments})
                    </button>
                  </div>
                </div>

                {/* Stat Cards Grid */}
                {isClientUser ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard title="Total de Embarques" value={stats.totalShipments} icon={<Truck className="w-6 h-6 text-amber-500"/>} />
                    <StatCard title="Volume Transportado" value={`${stats.totalTonnage.toLocaleString('pt-BR')} ton`} icon={<Scale className="w-6 h-6 text-amber-500"/>} />
                    <StatCard title="Frete Contratado" value={stats.grossBilled} icon={<DollarSignIcon className="w-6 h-6 text-emerald-500"/>} formatAsCurrency />
                    <StatCard title="Frete Médio / Ton" value={stats.totalTonnage > 0 ? (stats.grossBilled / stats.totalTonnage) : 0} icon={<TrendingUp className="w-6 h-6 text-teal-500"/>} formatAsCurrency />
                    <StatCard title="Embarques Concluídos" value={stats.completedShipments} icon={<CheckCircle2 className="w-6 h-6 text-purple-500"/>} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard title="Total de Embarques" value={stats.totalShipments} icon={<Truck className="w-6 h-6 text-amber-500"/>} />
                    <StatCard title="Volume Total" value={`${stats.totalTonnage.toLocaleString('pt-BR')} ton`} icon={<Scale className="w-6 h-6 text-amber-500"/>} />
                    <StatCard title="Faturamento Bruto" value={stats.grossBilled} icon={<DollarSignIcon className="w-6 h-6 text-emerald-500"/>} formatAsCurrency />
                    <StatCard title="Lucro Operacional" value={stats.profitMargin} icon={<TrendingUp className="w-6 h-6 text-teal-500"/>} formatAsCurrency />
                    <StatCard title="Margem de Lucro" value={`${stats.profitMarginPercentage.toFixed(2)}%`} icon={<PackageIcon className="w-6 h-6 text-purple-500"/>} />
                  </div>
                )}

                {/* Breakdown by CNPJ / Filial */}
                {hasMultipleBranches && isBranchesExpanded && (
                  <div className="mt-4 p-4 bg-gray-50/80 dark:bg-gray-750/50 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        Detalhamento e Histórico por CNPJ / Filial
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                        {stats.branches.length} unidades registradas
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left text-xs bg-white dark:bg-gray-800">
                        <thead className="bg-gray-100/80 dark:bg-gray-700/80 font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="px-4 py-3">Unidade / Filial</th>
                            <th className="px-4 py-3">CNPJ</th>
                            <th className="px-4 py-3">Cidade/UF</th>
                            <th className="px-4 py-3 text-right">Embarques</th>
                            <th className="px-4 py-3 text-right">Volume (Ton)</th>
                            <th className="px-4 py-3 text-right">{isClientUser ? 'Total em Frete' : 'Faturamento Bruto'}</th>
                            {!isClientUser && <th className="px-4 py-3 text-right">Lucro Líquido</th>}
                            {!isClientUser && <th className="px-4 py-3 text-right">Margem</th>}
                            <th className="px-4 py-3 text-right">Ações por CNPJ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {stats.branches.map(branch => (
                            <tr key={branch.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                              <td className="px-4 py-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${branch.id === 'matriz' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                {branch.name}
                              </td>
                              <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">
                                {branch.cnpj}
                              </td>
                              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                {branch.cityState}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200">
                                {branch.totalShipments}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200">
                                {branch.totalTonnage.toFixed(2)} t
                              </td>
                              <td className="px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                {branch.grossBilled.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              {!isClientUser && (
                                <td className="px-4 py-3 text-right font-black text-teal-600 dark:text-teal-400">
                                  {branch.profitMargin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                              )}
                              {!isClientUser && (
                                <td className="px-4 py-3 text-right font-bold text-purple-600 dark:text-purple-400">
                                  {branch.profitMarginPercentage.toFixed(2)}%
                                </td>
                              )}
                              <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => generatePDF(stats.id, branch.cnpj)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 rounded-lg font-bold transition-colors cursor-pointer text-[11px] border border-rose-200 dark:border-rose-900/50"
                                  title={`Baixar PDF exclusivo do CNPJ ${branch.cnpj}`}
                                >
                                  <Download className="w-3 h-3" /> PDF
                                </button>
                                <button
                                  onClick={() => openListModal(stats.id, branch.cnpj)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 rounded-lg font-bold transition-colors cursor-pointer text-[11px] border border-amber-200 dark:border-amber-900/50"
                                  title={`Ver embarques exclusivos do CNPJ ${branch.cnpj}`}
                                >
                                  <List className="w-3 h-3" /> Listagem
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Shipments List Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">
                    Listagem de Embarques
                  </h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                    {filteredModalShipments.length} embarques
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedClientId === 'ALL'
                    ? (isClientUser ? 'Todos os Embarques da Empresa' : 'Todos os Clientes e Demandas')
                    : `Cliente: ${clients.find(c => c.id === selectedClientId)?.nomeFantasia || selectedClientId}`}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={generatePDFFromModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                  title={activeModalFiltersCount > 0 ? 'Exportar PDF com os filtros aplicados' : 'Exportar PDF completo'}
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                  {activeModalFiltersCount > 0 && (
                    <span className="ml-1 bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                      {filteredModalShipments.length}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => setShowModalFilters(!showModalFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors text-xs font-bold cursor-pointer ${
                    showModalFilters || activeModalFiltersCount > 0 
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800' 
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" /> Filtros {activeModalFiltersCount > 0 && `(${activeModalFiltersCount})`}
                </button>
                <button
                  onClick={() => setShowListModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Financial summary ticker strip */}
            <div className="bg-gray-50 dark:bg-gray-900/60 px-5 py-2.5 border-b border-gray-100 dark:border-gray-700 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <span className="text-gray-400 font-semibold mr-1">Volume Carregado:</span>
                  <span className="font-black text-gray-800 dark:text-gray-200">{modalFinancialTotals.totalTons.toFixed(2)} t</span>
                </div>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <div>
                  <span className="text-gray-400 font-semibold mr-1">{isClientUser ? 'Total em Frete:' : 'Frete Empresa Total:'}</span>
                  <span className="font-black text-primary dark:text-amber-400">{formatCurrency(modalFinancialTotals.totalCompanyFreight)}</span>
                </div>
                {!isClientUser && (
                  <>
                    <span className="text-gray-300 dark:text-gray-700">•</span>
                    <div>
                      <span className="text-gray-400 font-semibold mr-1">Frete Motoristas:</span>
                      <span className="font-black text-gray-800 dark:text-gray-200">{formatCurrency(modalFinancialTotals.totalDriverFreight)}</span>
                    </div>
                    <span className="text-gray-300 dark:text-gray-700">•</span>
                    <div>
                      <span className="text-gray-400 font-semibold mr-1">Margem Bruta Empresa:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(modalFinancialTotals.netMargin)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Collapsible Filter Toolbar */}
            {showModalFilters && (
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <MultiSelectDropdown label="CNPJ / Filial" options={modalCnpjOptions} selectedValues={filterModalCnpj} onChange={setFilterModalCnpj} placeholder="Todos os CNPJs..." />
                  <MultiSelectDropdown label="Status" options={modalStatusOptions} selectedValues={filterModalStatus} onChange={setFilterModalStatus} placeholder="Todos..." />
                  <MultiSelectDropdown label="Motorista" options={modalDriverOptions} selectedValues={filterModalDriver} onChange={setFilterModalDriver} placeholder="Todos..." />
                  <MultiSelectDropdown label="Origem" options={modalOriginOptions} selectedValues={filterModalOrigin} onChange={setFilterModalOrigin} placeholder="Todas..." />
                  <MultiSelectDropdown label="Destino" options={modalDestOptions} selectedValues={filterModalDest} onChange={setFilterModalDest} placeholder="Todos..." />
                </div>
                {activeModalFiltersCount > 0 && (
                  <div className="mt-3 flex justify-end">
                    <button onClick={clearModalFilters} className="text-xs font-bold flex items-center gap-1 text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer">
                      <X className="w-3.5 h-3.5" /> Limpar Filtros
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Shipments Table */}
            <div className="p-0 overflow-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/90 sticky top-0 shadow-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">ID / Motorista</th>
                    <th scope="col" className="px-4 py-3">Datas (Início/Fim)</th>
                    <th scope="col" className="px-4 py-3">Placa Cavalo</th>
                    <th scope="col" className="px-4 py-3">Cliente / CNPJ Pagador</th>
                    <th scope="col" className="px-4 py-3">Rota (Origem → Destino)</th>
                    <th scope="col" className="px-4 py-3">{isClientUser ? 'Frete (/Ton)' : 'Valores (/Ton)'}</th>
                    <th scope="col" className="px-4 py-3">Pesos (Orig. / Dest.)</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredModalShipments.map(shipment => {
                    const cargo = cargoMap.get(shipment.cargoId);
                    const origem = cargo?.origin || 'N/A';
                    const destino = cargo?.destination || 'N/A';
                    const info = cargo ? getCargoBranchInfo(cargo) : { cnpj: '-', name: 'Matriz', cityState: '-' };
                    const clienteNome = clients.find(c => c.id === cargo?.clientId)?.nomeFantasia || '-';

                    const dataInicio = new Date(shipment.createdAt).toLocaleDateString('pt-BR');
                    const statusFinalizado = shipment.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);
                    const dataFim = statusFinalizado ? new Date(statusFinalizado.timestamp).toLocaleDateString('pt-BR') : '-';

                    const freteEmpresa = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
                    const freteMotorista = shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1));

                    const pesoOrigem = shipment.shipmentTonnage || 0;
                    const pesoDestino = shipment.unloadedTonnage;
                    let quebra = null;
                    if (pesoDestino !== undefined && pesoDestino < pesoOrigem) {
                      quebra = (pesoOrigem - pesoDestino).toFixed(2);
                    }

                    const getStatusColor = (status: ShipmentStatus) => {
                      switch (status) {
                        case ShipmentStatus.Finalizado:
                          return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                        case ShipmentStatus.AguardandoDescarga:
                        case ShipmentStatus.ValidacaoTicket:
                        case ShipmentStatus.AguardandoPagamentoSaldo:
                          return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                        case ShipmentStatus.AguardandoCarregamento:
                        case ShipmentStatus.AguardandoNota:
                        case ShipmentStatus.AguardandoFiscal:
                        case ShipmentStatus.AguardandoAdiantamento:
                          return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                        case ShipmentStatus.Cancelado:
                          return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                        default:
                          return 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
                      }
                    };

                    return (
                      <tr key={shipment.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 rounded text-[11px]">
                            {shipment.id}
                          </span>
                          <div className="text-gray-700 dark:text-gray-300 font-semibold mt-1">
                            {shipment.driverName}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">Início:</span>
                              <span className="font-medium text-gray-800 dark:text-gray-200">{dataInicio}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">Fim:</span>
                              <span className="font-medium text-gray-800 dark:text-gray-200">{dataFim}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-[11px]">
                            {shipment.horsePlate || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            {clienteNome}
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                            <span className="px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950/40 rounded border border-emerald-200 dark:border-emerald-800">
                              {info.name} ({info.cnpj})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{origem}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{destino}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-gray-400">{isClientUser ? 'Frete:' : 'Emp:'}</span>
                              <span className="font-bold text-primary dark:text-amber-400">{formatCurrency(freteEmpresa)}</span>
                            </div>
                            {!isClientUser && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">Mot:</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(freteMotorista)}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-gray-400">Origem:</span>
                              <span className="font-medium text-gray-800 dark:text-gray-200">{pesoOrigem.toFixed(2)} t</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-gray-400">Destino:</span>
                              <span className="font-medium text-gray-800 dark:text-gray-200">{pesoDestino !== undefined ? `${pesoDestino.toFixed(2)} t` : '-'}</span>
                            </div>
                            {quebra && (
                              <div className="flex items-center justify-between gap-2 text-rose-600 dark:text-rose-400 font-bold">
                                <span>Quebra:</span>
                                <span>{quebra} t</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-[10px] font-bold rounded-full border ${getStatusColor(shipment.status)}`}>
                            {shipment.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredModalShipments.length === 0 && (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-xs">
                  Nenhum embarque corresponde aos filtros selecionados.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientReport;
