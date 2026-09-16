import React, { useState, useMemo } from 'react';
import type { Shipment, Cargo, Client, User } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { StayRecord } from '../../utils/toolStorage';
import { calculateShipmentExpenses } from '../../utils/operationalExpensesCalculator';
import { isStayForShipment } from '../../utils';
import { Download, List, X, Filter, Building2, ChevronDown, ChevronUp, MapPin, CheckCircle2, TrendingUp } from 'lucide-react';
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

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactElement; formatAsCurrency?: boolean }> = ({ title, value, icon, formatAsCurrency = false }) => {
  const displayValue = formatAsCurrency && typeof value === 'number'
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : value;

  return (
    <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/60 rounded-xl border border-gray-100 dark:border-gray-600/50 shadow-xs">
      <div className="flex-shrink-0">{icon}</div>
      <div className="ml-3 min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-300 truncate">{title}</p>
        <p className="text-lg font-black text-gray-900 dark:text-white truncate">{displayValue}</p>
      </div>
    </div>
  );
};

const ClientReport: React.FC<ClientReportProps> = ({ shipments, cargos, clients, stays = [], companyLogo, currentUser }) => {
  const isClientUser = currentUser?.profile === UserProfile.Cliente;
  const [showListModal, setShowListModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | 'ALL'>('ALL');
  const [expandedClientBranches, setExpandedClientBranches] = useState<Record<string, boolean>>({});

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

    // Mesma regra do Fat. Bruto global: apenas embarques com CT-e emitido
    // Inclui também estadias com CT-e complementar (approvedValue > 0)
    const countableStatuses = [
      ShipmentStatus.AguardandoSeguradora,
      ShipmentStatus.PreCadastro,
      ShipmentStatus.AguardandoCarregamento,
      ShipmentStatus.AguardandoNota,
      ShipmentStatus.AguardandoFiscal,
      ShipmentStatus.AguardandoAdiantamento,
      ShipmentStatus.AguardandoAgendamento,
      ShipmentStatus.AguardandoDescarga,
      ShipmentStatus.AguardandoPagamentoSaldo,
      ShipmentStatus.Finalizado
    ];

    shipments.filter(s => countableStatuses.includes(s.status)).forEach(shipment => {
      const cargo = cargoMap.get(shipment.cargoId);
      if (!cargo) return;

      const clientEntry = statsMap.get(cargo.clientId);
      if (!clientEntry) return;

      // Verificar se possui CT-e (embarque principal) OU CT-e de estadia (complementar)
      const hasShipmentCte = Boolean(
        shipment.cteNumber ||
        shipment.documents?.cte_number ||
        shipment.documents?.['CT-e'] ||
        shipment.documents?.['CTE']
      );

      // CT-e de estadia: estadias aprovadas vinculadas a este embarque
      const shipmentStays = stays.filter(stay => isStayForShipment(stay, shipment) && (stay.approvedValue || 0) > 0);
      const hasStayCte = shipmentStays.some(stay => stay.cteUrl);

      // Contar apenas se tiver CT-e do embarque ou CT-e complementar de estadia
      if (!hasShipmentCte && !hasStayCte) return;

      const client = clients.find(c => c.id === cargo.clientId);
      const ton = shipment.loadedTonnage || shipment.shipmentTonnage || 0;
      const expenses = calculateShipmentExpenses(shipment, cargo);
      const grossValue = expenses.companyFreight;

      // Estadia aprovada: faturamento bruto inclui o valor cobrado ao cliente (approvedValue)
      const demurrageRevenue = shipmentStays
        .reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);

      const demurrageProfit = shipmentStays
        .reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);

      // Faturamento bruto = frete + estadias aprovadas
      const totalGrossValue = hasShipmentCte ? grossValue + demurrageRevenue : demurrageRevenue;

      const profit = hasShipmentCte
        ? (expenses.netProfit + demurrageProfit)
        : demurrageProfit;

      const isCompleted = shipment.status === ShipmentStatus.Finalizado;
      const isCanceled = shipment.status === ShipmentStatus.Cancelado;

      // Add to overall client
      if (hasShipmentCte && !isCanceled) {
        clientEntry.totalTonnage += ton;
        clientEntry.totalShipments += 1;
        if (isCompleted) clientEntry.completedShipments += 1;
      }
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

      if (hasShipmentCte && !isCanceled) {
        branchStat.totalTonnage += ton;
        branchStat.totalShipments += 1;
        if (isCompleted) branchStat.completedShipments += 1;
      }
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

  const toggleBranchExpand = (clientId: string) => {
    setExpandedClientBranches(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  const getShipmentsForPdfAndList = (clientId?: string, specificCnpj?: string) => {
    let result = shipments.filter(s => s.status !== ShipmentStatus.Cancelado);
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
    const nonCanceled = shipments.filter(s => s.status !== ShipmentStatus.Cancelado);
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
    const targetShipments = getShipmentsForPdfAndList(clientId, specificCnpj).filter(s => s.status === ShipmentStatus.Finalizado);
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
      ? ["ID", "Início", "Fim", "Cliente / Filial", "CNPJ", "Motorista", "Placa", "Origem", "Destino", "Frete Contratado (/Ton)", "Peso Origem", "Peso Destino", "Quebra"]
      : ["ID", "Início", "Fim", "Cliente / Filial", "CNPJ", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Origem", "Peso Destino", "Quebra"];
    
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
        "TOTAIS", "-", "-", "-", "-", "-", `Embarques: ${targetShipments.length}`, "-", "-",
        formatCurrency(totalFreteEmpresa),
        totalPesoCarregado.toFixed(2) + ' t',
        totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
        "-"
      ]);
    } else {
      tableRows.push([
        "TOTAIS", "-", "-", "-", "-", "-", `Embarques: ${targetShipments.length}`, "-", "-",
        formatCurrency(totalFreteEmpresa),
        formatCurrency(totalFreteMotorista),
        totalPesoCarregado.toFixed(2) + ' t',
        totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
        "-"
      ]);

      tableRows.push([
        "LÍQUIDO", "-", "-", "-", "-", "-", "-", "-", "-",
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
      headStyles: { fillColor: [29, 59, 141], textColor: 255 },
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
      ? ["ID", "Início", "Fim", "Cliente / Filial", "CNPJ", "Motorista", "Placa", "Origem", "Destino", "Frete Contratado (/Ton)", "Peso Origem", "Peso Destino", "Quebra", "Status"]
      : ["ID", "Início", "Fim", "Cliente / Filial", "CNPJ", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Origem", "Peso Destino", "Quebra", "Status"];
    
    const tableRows: any[] = [];

    let totalFreteEmpresa = 0;
    let totalFreteMotorista = 0;
    let totalPesoCarregado = 0;
    let totalPesoDestino = 0;

    const shipmentsForPdf = filteredModalShipments.filter(s => s.status === ShipmentStatus.Finalizado);

    shipmentsForPdf.forEach(shipment => {
      const cargo = cargoMap.get(shipment.cargoId);
      const origem = cargo?.origin || 'N/A';
      const destino = cargo?.destination || 'N/A';
      const info = cargo ? getCargoBranchInfo(cargo) : { cnpj: '-', name: 'Matriz', cityState: '-' };
      const clienteNome = clients.find(c => c.id === cargo?.clientId)?.nomeFantasia || 'N/A';

      const dataInicio = new Date(shipment.createdAt).toLocaleDateString('pt-BR');
      const statusFinalizado = shipment.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);
      const dataFim = statusFinalizado ? new Date(statusFinalizado.timestamp).toLocaleDateString('pt-BR') : '-';

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
        "TOTAIS", "-", "-", "-", "-", "-", `Embarques: ${shipmentsForPdf.length}`, "-", "-",
        fmt(totalFreteEmpresa),
        totalPesoCarregado.toFixed(2) + ' t',
        totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
        "-", "-"
      ]);
    } else {
      tableRows.push([
        "TOTAIS", "-", "-", "-", "-", "-", `Embarques: ${shipmentsForPdf.length}`, "-", "-",
        fmt(totalFreteEmpresa),
        fmt(totalFreteMotorista),
        totalPesoCarregado.toFixed(2) + ' t',
        totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
        "-", "-"
      ]);

      tableRows.push([
        "LÍQUIDO", "-", "-", "-", "-", "-", "-", "-", "-",
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
      headStyles: { fillColor: [29, 59, 141], textColor: 255 },
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

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
            {isClientUser ? 'Histórico e Desempenho da Minha Empresa' : 'Desempenho por Cliente'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isClientUser
              ? 'Consulte o histórico consolidado de transporte e o detalhamento por cada filial e CNPJ da sua empresa.'
              : 'Visualize o desempenho consolidado da empresa e o relatório detalhado por cada CNPJ e filial.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generatePDF('ALL')}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-xs text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" /> Baixar PDF Consolidado
          </button>
          <button
            onClick={() => openListModal('ALL')}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-xs text-sm cursor-pointer"
          >
            <List className="w-4 h-4" /> Listagem Completa
          </button>
        </div>
      </div>

      {clientStats.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400 shadow-xs border border-gray-100 dark:border-gray-700">
          Nenhum dado encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="space-y-6">
          {clientStats.map(stats => {
            const hasMultipleBranches = stats.branches && stats.branches.length > 1;
            const isBranchesExpanded = !!expandedClientBranches[stats.id] || (isClientUser && hasMultipleBranches);

            return (
              <div key={stats.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4">
                
                {/* Client Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{stats.name}</h3>
                        {hasMultipleBranches && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                            {stats.branches.length} CNPJs Vinculados
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        CNPJ Matriz: {stats.cnpj}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {hasMultipleBranches && (
                      <button
                        onClick={() => toggleBranchExpand(stats.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border cursor-pointer ${
                          isBranchesExpanded
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            : 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Ver Relatório por CNPJ ({stats.branches.length})</span>
                        {isBranchesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => generatePDF(stats.id)}
                      className="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-lg font-bold transition-colors text-xs border border-red-200 dark:border-red-800 cursor-pointer"
                      title="Baixar PDF consolidado"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF Consolidado
                    </button>
                    <button
                      onClick={() => openListModal(stats.id)}
                      className="flex items-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg font-bold transition-colors text-xs border border-blue-200 dark:border-blue-800 cursor-pointer"
                      title="Ver todos os embarques"
                    >
                      <List className="w-3.5 h-3.5" /> Listagem Geral
                    </button>
                  </div>
                </div>

                {/* Stat Cards */}
                {isClientUser ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                    <StatCard title="Total de Embarques" value={stats.totalShipments} icon={<PackageIcon className="w-7 h-7 text-blue-500 dark:text-blue-400"/>} />
                    <StatCard title="Volume Transportado" value={`${stats.totalTonnage.toLocaleString('pt-BR')} ton`} icon={<PackageIcon className="w-7 h-7 text-indigo-500 dark:text-indigo-400"/>} />
                    <StatCard title="Total em Frete Contratado" value={stats.grossBilled} icon={<DollarSignIcon className="w-7 h-7 text-green-500 dark:text-green-400"/>} formatAsCurrency />
                    <StatCard title="Frete Médio / Ton" value={stats.totalTonnage > 0 ? (stats.grossBilled / stats.totalTonnage) : 0} icon={<TrendingUp className="w-7 h-7 text-teal-500 dark:text-teal-400"/>} formatAsCurrency />
                    <StatCard title="Embarques Concluídos" value={stats.completedShipments} icon={<CheckCircle2 className="w-7 h-7 text-purple-500 dark:text-purple-400"/>} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                    <StatCard title="Total de Embarques" value={stats.totalShipments} icon={<PackageIcon className="w-7 h-7 text-blue-500 dark:text-blue-400"/>} />
                    <StatCard title="Volume Total" value={`${stats.totalTonnage.toLocaleString('pt-BR')} ton`} icon={<PackageIcon className="w-7 h-7 text-indigo-500 dark:text-indigo-400"/>} />
                    <StatCard title="Faturamento Bruto" value={stats.grossBilled} icon={<DollarSignIcon className="w-7 h-7 text-green-500 dark:text-green-400"/>} formatAsCurrency />
                    <StatCard title="Lucro Operacional" value={stats.profitMargin} icon={<DollarSignIcon className="w-7 h-7 text-teal-500 dark:text-teal-400"/>} formatAsCurrency />
                    <StatCard title="Margem de Lucro" value={`${stats.profitMarginPercentage.toFixed(2)}%`} icon={<DollarSignIcon className="w-7 h-7 text-purple-500 dark:text-purple-400"/>} />
                  </div>
                )}

                {/* Breakdown by CNPJ / Filial */}
                {hasMultipleBranches && isBranchesExpanded && (
                  <div className="mt-4 p-4 bg-gray-50/70 dark:bg-gray-750/50 rounded-xl border border-gray-200 dark:border-gray-650 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        Detalhamento e Histórico Individual por CNPJ / Filial
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {stats.branches.length} unidades
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left text-xs bg-white dark:bg-gray-800">
                        <thead className="bg-gray-100/70 dark:bg-gray-700/70 font-bold text-gray-600 dark:text-gray-300">
                          <tr>
                            <th className="px-3.5 py-2.5">Unidade / Filial</th>
                            <th className="px-3.5 py-2.5">CNPJ</th>
                            <th className="px-3.5 py-2.5">Cidade/UF</th>
                            <th className="px-3.5 py-2.5 text-right">Embarques</th>
                            <th className="px-3.5 py-2.5 text-right">Volume (Ton)</th>
                            <th className="px-3.5 py-2.5 text-right">{isClientUser ? 'Total em Frete' : 'Faturamento Bruto'}</th>
                            {!isClientUser && <th className="px-3.5 py-2.5 text-right">Lucro Líquido</th>}
                            {!isClientUser && <th className="px-3.5 py-2.5 text-right">Margem</th>}
                            <th className="px-3.5 py-2.5 text-right">Ações por CNPJ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {stats.branches.map(branch => (
                            <tr key={branch.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-3.5 py-3 font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${branch.id === 'matriz' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                                {branch.name}
                              </td>
                              <td className="px-3.5 py-3 font-mono text-gray-600 dark:text-gray-300">
                                {branch.cnpj}
                              </td>
                              <td className="px-3.5 py-3 text-gray-500 dark:text-gray-400">
                                {branch.cityState}
                              </td>
                              <td className="px-3.5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                                {branch.totalShipments}
                              </td>
                              <td className="px-3.5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                                {branch.totalTonnage.toFixed(2)} t
                              </td>
                              <td className="px-3.5 py-3 text-right font-bold text-green-600 dark:text-green-400">
                                {branch.grossBilled.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              {!isClientUser && (
                                <td className="px-3.5 py-3 text-right font-bold text-teal-600 dark:text-teal-400">
                                  {branch.profitMargin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                              )}
                              {!isClientUser && (
                                <td className="px-3.5 py-3 text-right font-bold text-purple-600 dark:text-purple-400">
                                  {branch.profitMarginPercentage.toFixed(2)}%
                                </td>
                              )}
                              <td className="px-3.5 py-3 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => generatePDF(stats.id, branch.cnpj)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded font-bold transition-colors cursor-pointer text-[11px]"
                                  title={`Baixar PDF exclusivo do CNPJ ${branch.cnpj}`}
                                >
                                  <Download className="w-3 h-3" /> PDF
                                </button>
                                <button
                                  onClick={() => openListModal(stats.id, branch.cnpj)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 rounded font-bold transition-colors cursor-pointer text-[11px]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <List className="w-5 h-5 text-primary" />
                  Listagem de Embarques
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedClientId === 'ALL'
                    ? (isClientUser ? 'Todos os Embarques da Empresa' : 'Todos os Clientes')
                    : `Cliente: ${clients.find(c => c.id === selectedClientId)?.nomeFantasia || selectedClientId}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generatePDFFromModal}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 cursor-pointer"
                  title={activeModalFiltersCount > 0 ? 'Baixar PDF com filtros aplicados' : 'Baixar PDF completo'}
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF {activeModalFiltersCount > 0 && <span className="ml-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredModalShipments.length}</span>}
                </button>
                <button 
                  onClick={() => setShowModalFilters(!showModalFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold cursor-pointer ${showModalFilters || activeModalFiltersCount > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                >
                  <Filter className="w-3.5 h-3.5" /> Filtros {activeModalFiltersCount > 0 && `(${activeModalFiltersCount})`}
                </button>
                <button
                  onClick={() => setShowListModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {showModalFilters && (
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <MultiSelectDropdown label="CNPJ / Filial" options={modalCnpjOptions} selectedValues={filterModalCnpj} onChange={setFilterModalCnpj} placeholder="Todos os CNPJs..." />
                  <MultiSelectDropdown label="Status" options={modalStatusOptions} selectedValues={filterModalStatus} onChange={setFilterModalStatus} placeholder="Todos..." />
                  <MultiSelectDropdown label="Motorista" options={modalDriverOptions} selectedValues={filterModalDriver} onChange={setFilterModalDriver} placeholder="Todos..." />
                  <MultiSelectDropdown label="Origem" options={modalOriginOptions} selectedValues={filterModalOrigin} onChange={setFilterModalOrigin} placeholder="Todas..." />
                  <MultiSelectDropdown label="Destino" options={modalDestOptions} selectedValues={filterModalDest} onChange={setFilterModalDest} placeholder="Todos..." />
                </div>
                {activeModalFiltersCount > 0 && (
                  <div className="mt-2.5 flex justify-end">
                    <button onClick={clearModalFilters} className="text-xs font-bold flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 cursor-pointer">
                      <X className="w-3.5 h-3.5" /> Limpar Filtros
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="p-0 overflow-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 shadow-xs text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">ID / Motorista</th>
                    <th className="px-4 py-3 text-left">Datas (Início/Fim)</th>
                    <th className="px-4 py-3 text-left">Placa</th>
                    <th className="px-4 py-3 text-left">Cliente / CNPJ Pagador</th>
                    <th className="px-4 py-3 text-left">Rota (Origem → Destino)</th>
                    <th className="px-4 py-3 text-left">{isClientUser ? 'Frete (/Ton)' : 'Valores (/Ton)'}</th>
                    <th className="px-4 py-3 text-left">Pesos (Orig. / Dest.)</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-xs">
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

                    return (
                      <tr key={shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-bold text-gray-900 dark:text-white">{shipment.id}</div>
                          <div className="text-gray-500 dark:text-gray-400 mt-0.5">{shipment.driverName}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <div><span className="text-gray-500">Início:</span> <span className="font-medium text-gray-900 dark:text-gray-200">{dataInicio}</span></div>
                            <div><span className="text-gray-500">Fim:</span> <span className="font-medium text-gray-900 dark:text-gray-200">{dataFim}</span></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 font-mono text-[11px]">
                            {shipment.horsePlate || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-bold text-gray-800 dark:text-gray-200">{clienteNome}</div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                            <span className="px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-900/40 rounded border border-emerald-200 dark:border-emerald-800">
                              {info.name} ({info.cnpj})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col text-[11px]">
                            <span className="font-medium text-gray-900 dark:text-white">{origem}</span>
                            <span className="text-gray-400 text-[10px]">para</span>
                            <span className="font-medium text-gray-900 dark:text-white">{destino}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-500">{isClientUser ? 'Frete:' : 'Empresa:'}</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(freteEmpresa)}
                              </span>
                            </div>
                            {!isClientUser && (
                              <div className="flex justify-between gap-2">
                                <span className="text-gray-500">Motorista:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-200">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(freteMotorista)}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col text-[11px]">
                            <div><span className="text-gray-500">Origem:</span> <span className="font-medium">{pesoOrigem.toFixed(2)} t</span></div>
                            <div><span className="text-gray-500">Destino:</span> <span className="font-medium">{pesoDestino !== undefined ? `${pesoDestino.toFixed(2)} t` : '-'}</span></div>
                            {quebra && (
                              <div className="text-red-600 dark:text-red-400 font-bold mt-0.5">
                                Quebra: {quebra} t
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 inline-flex text-[11px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            {shipment.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredModalShipments.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  Nenhum embarque encontrado com os filtros atuais.
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
