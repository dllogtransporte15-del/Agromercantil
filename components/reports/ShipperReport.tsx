import React, { useState, useMemo } from 'react';
import type { Shipment, User, Cargo, Client } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { isDeveloperUser, isDemoUser } from '../../auth';
import { TruckIcon } from '../icons/TruckIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { 
    Download, 
    List, 
    X, 
    Filter, 
    Search, 
    UserCheck, 
    ShieldAlert, 
    TrendingUp, 
    Layers, 
    Calendar, 
    ArrowRight, 
    Scale,
    FileSpreadsheet,
    Building2,
    Eye
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfLogo } from '../../utils/pdfGenerator';
import MultiSelectDropdown from '../MultiSelectDropdown';
import { 
  hasCteAttached, 
  isCteApplicableForStatus, 
  getShipmentCte, 
  isShipmentEligibleForCommission,
  canViewPredictedCommission,
  isShipmentPredictedForCommission
} from '../../utils';

interface ShipperReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  clients: Client[];
  users: User[];
  currentUser: User | null;
  companyLogo?: string | null;
}

interface OperatorStats {
  id: string;
  name: string;
  ratePerTon: number;
  total: number;
  finalizado: number;
  emAndamento: number;
  cancelado: number;
  effectiveTonnage: number;
  commission: number;
  predictedCommission: number;
  efetivadosCount: number;
  predictedCount: number;
  completionRate: number;
}

const StatCard: React.FC<{ 
    title: string; 
    value: string | number; 
    icon: React.ReactElement; 
    accentColor?: string;
    subtext?: string;
}> = ({ title, value, icon, accentColor = 'blue', subtext }) => {
    return (
        <div className="relative overflow-hidden p-4 bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-100 dark:border-gray-700/80 shadow-xs hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate mb-1">
                        {title}
                    </p>
                    <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                        {value}
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

const ShipperReport: React.FC<ShipperReportProps> = ({ shipments, cargos, clients, users, currentUser, companyLogo }) => {
    const [showListModal, setShowListModal] = useState(false);
    const [selectedEmbarcadorId, setSelectedEmbarcadorId] = useState<string | 'ALL'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal filters
    const [filterModalStatus, setFilterModalStatus] = useState<string[]>([]);
    const [filterModalOrigin, setFilterModalOrigin] = useState<string[]>([]);
    const [filterModalDest, setFilterModalDest] = useState<string[]>([]);
    const [filterModalDriver, setFilterModalDriver] = useState<string[]>([]);
    const [showModalFilters, setShowModalFilters] = useState(false);

    const canViewCommission = useMemo(() => {
        if (!currentUser) return false;
        return [UserProfile.Desenvolvedor, UserProfile.Diretor, UserProfile.Comercial, UserProfile.Admin, UserProfile.Demonstracao, UserProfile.Supervisor, UserProfile.GerenteComercial].includes(currentUser.profile);
    }, [currentUser]);

    const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

    const operatorStats = useMemo<OperatorStats[]>(() => {
        const embarcadorUsers = users.filter(u => u.profile === UserProfile.Embarcador);
        const creatorIds = [...new Set([
            ...embarcadorUsers.map(u => u.id),
            ...shipments.map(s => s.embarcadorId).filter(Boolean) as string[],
            ...shipments.map(s => s.createdById).filter(Boolean) as string[]
        ])];

        return creatorIds.map(creatorId => {
            const creator = users.find(u => u.id === creatorId);
            const creatorRate = Number(creator?.shipperCommissionRatePerTon) || 0;
            const operatorCteShipments = shipments.filter(s => 
                (s.embarcadorId === creatorId || s.createdById === creatorId) &&
                s.status !== ShipmentStatus.Cancelado &&
                hasCteAttached(s)
            );
          
            let finalizadoCount = 0;
            let canceladoCount = 0;
            let emAndamentoCount = 0;
            let effectiveTonnage = 0;
            let commissionEfetivada = 0;
            let predictedCommission = 0;
            let efetivadosCount = 0;
            let predictedCount = 0;

            operatorCteShipments.forEach(shipment => {
                if (shipment.status === ShipmentStatus.Finalizado) {
                    finalizadoCount += 1;
                } else if (shipment.status === ShipmentStatus.Cancelado) {
                    canceladoCount += 1;
                } else {
                    emAndamentoCount += 1;
                }

                const tons = Number(shipment.shipmentTonnage) || 0;
                const rateToUse = shipment.shipperCommissionRatePerTon !== undefined 
                    ? Number(shipment.shipperCommissionRatePerTon) 
                    : creatorRate;
                const commValue = tons * rateToUse;

                // Efetivado: Descarregado a partir de Aguardando Saldo ou Finalizado
                if (isShipmentEligibleForCommission(shipment)) {
                    efetivadosCount += 1;
                    effectiveTonnage += tons;
                    commissionEfetivada += commValue;
                } else if (isShipmentPredictedForCommission(shipment)) {
                    // Previsto: Em trânsito antes da descarga
                    predictedCount += 1;
                    predictedCommission += commValue;
                }
            });
    
            const total = finalizadoCount + emAndamentoCount;
            const completionRate = total > 0 ? (finalizadoCount / total) * 100 : 0;

            return {
                id: creatorId,
                name: creator?.name || `Usuário (${creatorId})`,
                ratePerTon: creatorRate,
                total,
                completionRate,
                finalizado: finalizadoCount,
                cancelado: canceladoCount,
                emAndamento: emAndamentoCount,
                effectiveTonnage,
                commission: commissionEfetivada,
                predictedCommission,
                efetivadosCount,
                predictedCount,
            };
        }).filter(item => {
            if (!isDeveloperUser(currentUser) && (item.id === 'USR-001' || item.id === 'USR-292')) return false;
            const matchedUser = users.find(u => u.id === item.id);
            if (!isDeveloperUser(currentUser) && matchedUser && (isDeveloperUser(matchedUser) || isDemoUser(matchedUser))) return false;
            return item.total > 0 || (matchedUser?.profile === UserProfile.Embarcador);
        })
          .sort((a, b) => b.total - a.total);
    }, [shipments, users]);

    // Global summary aggregations
    const globalSummary = useMemo(() => {
        return operatorStats.reduce((acc, op) => {
            acc.totalOperators += 1;
            acc.totalShipments += op.total;
            acc.finalizedShipments += op.finalizado;
            acc.inProgressShipments += op.emAndamento;
            acc.effectiveTonnage += op.effectiveTonnage;
            acc.totalCommission += op.commission;
            acc.totalPredictedCommission += op.predictedCommission;
            acc.totalEfetivados += op.efetivadosCount;
            acc.totalPredictedShipments += op.predictedCount;
            return acc;
        }, {
            totalOperators: 0,
            totalShipments: 0,
            finalizedShipments: 0,
            inProgressShipments: 0,
            effectiveTonnage: 0,
            totalCommission: 0,
            totalPredictedCommission: 0,
            totalEfetivados: 0,
            totalPredictedShipments: 0
        });
    }, [operatorStats]);

    const globalCompletionRate = globalSummary.totalShipments > 0
        ? (globalSummary.finalizedShipments / globalSummary.totalShipments) * 100
        : 0;

    const filteredOperators = useMemo(() => {
        if (!searchQuery.trim()) return operatorStats;
        const q = searchQuery.toLowerCase();
        return operatorStats.filter(op => op.name.toLowerCase().includes(q));
    }, [operatorStats, searchQuery]);

    const getShipmentsForPdfAndList = (embarcadorId?: string) => {
        const nonCanceled = shipments.filter(s => s.status !== ShipmentStatus.Cancelado && isCteApplicableForStatus(s.status) && hasCteAttached(s));
        if (embarcadorId && embarcadorId !== 'ALL') {
            return nonCanceled.filter(s => s.embarcadorId === embarcadorId || s.createdById === embarcadorId);
        }
        return nonCanceled;
    };

    const baseModalShipments = useMemo(() => {
        const nonCanceled = shipments.filter(s => s.status !== ShipmentStatus.Cancelado && isCteApplicableForStatus(s.status) && hasCteAttached(s));
        if (selectedEmbarcadorId && selectedEmbarcadorId !== 'ALL') {
            return nonCanceled.filter(s => s.embarcadorId === selectedEmbarcadorId || s.createdById === selectedEmbarcadorId);
        }
        return nonCanceled;
    }, [shipments, selectedEmbarcadorId]);

    const modalStatusOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => s.status))).filter(Boolean).sort(), [baseModalShipments]);
    const modalOriginOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => cargoMap.get(s.cargoId)?.origin || ''))).filter(Boolean).sort(), [baseModalShipments, cargoMap]);
    const modalDestOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => cargoMap.get(s.cargoId)?.destination || ''))).filter(Boolean).sort(), [baseModalShipments, cargoMap]);
    const modalDriverOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => s.driverName))).filter(Boolean).sort(), [baseModalShipments]);

    const filteredModalShipments = useMemo(() => {
        return baseModalShipments.filter(shipment => {
            const cargo = cargoMap.get(shipment.cargoId);
            if (filterModalStatus.length > 0 && !filterModalStatus.includes(shipment.status)) return false;
            if (filterModalOrigin.length > 0 && !filterModalOrigin.includes(cargo?.origin || '')) return false;
            if (filterModalDest.length > 0 && !filterModalDest.includes(cargo?.destination || '')) return false;
            if (filterModalDriver.length > 0 && !filterModalDriver.includes(shipment.driverName)) return false;
            return true;
        });
    }, [baseModalShipments, filterModalStatus, filterModalOrigin, filterModalDest, filterModalDriver, cargoMap]);

    // Financial totals for the active modal view
    const modalFinancialTotals = useMemo(() => {
        return filteredModalShipments.reduce((acc, s) => {
            const cargo = cargoMap.get(s.cargoId);
            const tons = s.shipmentTonnage || 0;
            const unloaded = s.unloadedTonnage !== undefined ? s.unloadedTonnage : tons;
            const empRate = s.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
            const motTotal = s.driverFreightValue || 0;
            const empTotal = empRate * tons;

            acc.totalTons += tons;
            acc.totalUnloaded += unloaded;
            acc.totalCompanyFreight += empTotal;
            acc.totalDriverFreight += motTotal;
            acc.netMargin += (empTotal - motTotal);
            return acc;
        }, {
            totalTons: 0,
            totalUnloaded: 0,
            totalCompanyFreight: 0,
            totalDriverFreight: 0,
            netMargin: 0
        });
    }, [filteredModalShipments, cargoMap]);

    const activeModalFiltersCount = filterModalStatus.length + filterModalOrigin.length + filterModalDest.length + filterModalDriver.length;

    const clearModalFilters = () => {
        setFilterModalStatus([]);
        setFilterModalOrigin([]);
        setFilterModalDest([]);
        setFilterModalDriver([]);
    };

    const generatePDFFromModal = () => {
        const embarcadorName = selectedEmbarcadorId === 'ALL'
            ? 'Geral'
            : operatorStats.find(o => o.id === selectedEmbarcadorId)?.name || 'Embarcador';

        const filterDesc: string[] = [];
        if (filterModalStatus.length > 0) filterDesc.push(`Status: ${filterModalStatus.join(', ')}`);
        if (filterModalDriver.length > 0) filterDesc.push(`Motorista: ${filterModalDriver.join(', ')}`);
        if (filterModalOrigin.length > 0) filterDesc.push(`Origem: ${filterModalOrigin.join(', ')}`);
        if (filterModalDest.length > 0) filterDesc.push(`Destino: ${filterModalDest.join(', ')}`);

        const doc = new jsPDF('landscape');
        addPdfLogo(doc, companyLogo, { align: 'right', y: 5, width: 35, height: 15 });

        doc.setFontSize(16);
        doc.text(`Listagem de Embarques - ${embarcadorName}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);
        if (filterDesc.length > 0) {
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`Filtros: ${filterDesc.join(' | ')}`, 14, 28);
            doc.setTextColor(0);
        }

        const startY = filterDesc.length > 0 ? 34 : 28;
        const tableColumn = ["ID", "CT-e", "Início", "Fim", "Cliente", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Carregado", "Peso Destino", "Quebra", "Status"];
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
            const cliente = clients.find(c => c.id === cargo?.clientId)?.nomeFantasia || 'N/A';

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

            tableRows.push([
                shipment.id,
                cteNumber,
                dataInicio,
                dataFim,
                cliente,
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
        });

        const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        
        tableRows.push([
            "TOTAIS", "-", "-", "-", "-", `Embarques: ${shipmentsForPdf.length}`, "-", "-", "-",
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

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY,
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

        const suffix = activeModalFiltersCount > 0 ? '_filtrado' : '';
        doc.save(`Listagem_${embarcadorName.replace(/\s+/g, '_')}${suffix}_${new Date().getTime()}.pdf`);
    };

    const generatePDF = (embarcadorId?: string) => {
        const targetShipments = getShipmentsForPdfAndList(embarcadorId).filter(s => s.status === ShipmentStatus.Finalizado && hasCteAttached(s));
        const embarcadorName = embarcadorId && embarcadorId !== 'ALL' 
            ? operatorStats.find(o => o.id === embarcadorId)?.name 
            : 'Geral';

        const doc = new jsPDF('landscape');
        addPdfLogo(doc, companyLogo, { align: 'right', y: 5, width: 35, height: 15 });
        
        doc.setFontSize(16);
        doc.text(`Relatório de Embarques Finalizados - Embarcador: ${embarcadorName || 'Todos'}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);

        const tableColumn = ["ID", "CT-e", "Início", "Fim", "Cliente", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Carregado", "Peso Destino", "Quebra"];
        const tableRows: any[] = [];

        let totalFreteEmpresa = 0;
        let totalFreteMotorista = 0;
        let totalPesoCarregado = 0;
        let totalPesoDestino = 0;

        targetShipments.forEach(shipment => {
            const cargo = cargoMap.get(shipment.cargoId);
            const origem = cargo?.origin || 'N/A';
            const destino = cargo?.destination || 'N/A';
            const cliente = clients.find(c => c.id === cargo?.clientId)?.nomeFantasia || 'N/A';
            
            const dataInicio = new Date(shipment.createdAt).toLocaleDateString('pt-BR');
            const statusFinalizado = shipment.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);
            const dataFim = statusFinalizado ? new Date(statusFinalizado.timestamp).toLocaleDateString('pt-BR') : '-';

            const cteNumber = getShipmentCte(shipment) || shipment.cteNumber || '-';
            
            const freteEmpresa = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
            const freteMotorista = shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1));
            
            const pesoOrigem = shipment.shipmentTonnage || 0;
            const pesoDestino = shipment.unloadedTonnage;
            
            let quebra = 'Não';
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

            const rowData = [
                shipment.id,
                cteNumber,
                dataInicio,
                dataFim,
                cliente,
                shipment.driverName,
                shipment.horsePlate || '-',
                origem,
                destino,
                formatCurrency(freteEmpresa),
                formatCurrency(freteMotorista),
                pesoOrigem.toFixed(2) + ' t',
                pesoDestino !== undefined ? pesoDestino.toFixed(2) + ' t' : '-',
                quebra
            ];
            tableRows.push(rowData);
        });

        const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        tableRows.push([
            "TOTAIS", "-", "-", "-", "-", `Embarques: ${targetShipments.length}`, "-", "-", "-",
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

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            theme: 'grid',
            styles: { fontSize: 8 },
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

        doc.save(`Relatorio_Embarques_${embarcadorName?.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    };

    const openListModal = (embarcadorId: string) => {
        setSelectedEmbarcadorId(embarcadorId);
        clearModalFilters();
        setShowModalFilters(false);
        setShowListModal(true);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header / Actions Bar */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                Desempenho por Embarcador
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Gestão analítica de embarques, tonelagem faturada e apuração de comissões por operador.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => generatePDF('ALL')}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-xs hover:shadow-md text-xs sm:text-sm cursor-pointer"
                    >
                        <Download className="w-4 h-4" /> Exportar PDF Geral
                    </button>
                    <button 
                        onClick={() => openListModal('ALL')}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-xs hover:shadow-md text-xs sm:text-sm cursor-pointer"
                    >
                        <List className="w-4 h-4" /> Listagem Completa
                    </button>
                </div>
            </div>

            {/* Consolidated Executive KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="p-4 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between opacity-90 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Embarcadores</span>
                        <UserCheck className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-black">{globalSummary.totalOperators}</p>
                    <p className="text-[11px] text-amber-100 mt-0.5">Operadores com movimentação</p>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Embarques Auditados</span>
                        <TruckIcon className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{globalSummary.totalShipments}</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                        <span>{globalSummary.finalizedShipments} finalizados</span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span className="text-amber-500">{globalSummary.inProgressShipments} em trânsito</span>
                    </p>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Volume Efetivado</span>
                        <Scale className="w-4 h-4 text-teal-500" />
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {globalSummary.effectiveTonnage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm font-semibold text-gray-400">t</span>
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Cargas com CT-e emitido</p>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Taxa de Conclusão</span>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {globalCompletionRate.toFixed(1)}%
                    </p>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(globalCompletionRate, 100)}%` }}
                        />
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Comissão Total</span>
                        <DollarSignIcon className="w-4 h-4 text-emerald-500" />
                    </div>
                    {canViewCommission ? (
                        <>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(globalSummary.totalCommission)}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Apuração sobre toneladas</p>
                        </>
                    ) : (
                        <>
                            <p className="text-base font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1.5 mt-1">
                                <ShieldAlert className="w-4 h-4 text-amber-500" /> Confidencial
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">Perfil sem permissão</p>
                        </>
                    )}
                </div>
            </div>

            {/* Search Filter Strip */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome do embarcador..."
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
                    Exibindo <span className="font-bold text-gray-900 dark:text-white">{filteredOperators.length}</span> de {operatorStats.length} embarcadores
                </div>
            </div>
            
            {/* Operator Cards List */}
            {filteredOperators.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center text-gray-500 dark:text-gray-400 shadow-xs border border-gray-100 dark:border-gray-700">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                        <UserCheck className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-gray-700 dark:text-gray-300">Nenhum embarcador encontrado</p>
                    <p className="text-xs mt-1">Verifique o termo pesquisado ou altere os filtros.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOperators.map(stats => {
                        return (
                            <div 
                                key={stats.id} 
                                className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700 hover:border-amber-200 dark:hover:border-amber-800/60 transition-all duration-200"
                            >
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 mb-4 border-b border-gray-100 dark:border-gray-700/80 gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-600 text-white flex items-center justify-center font-black text-sm shadow-xs flex-shrink-0">
                                            {getInitials(stats.name)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                                                    {stats.name}
                                                </h3>
                                                {stats.ratePerTon > 0 && canViewCommission && (
                                                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/80">
                                                        Taxa: {formatCurrency(stats.ratePerTon)} / ton
                                                    </span>
                                                )}
                                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/80">
                                                    {stats.completionRate.toFixed(0)}% concluído
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                                                ID: {stats.id}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                        <button 
                                            onClick={() => generatePDF(stats.id)}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/40 px-3.5 py-2 rounded-xl font-bold transition-colors text-xs border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                                            title="Exportar PDF exclusivo deste embarcador"
                                        >
                                            <Download className="w-3.5 h-3.5" /> PDF
                                        </button>
                                        <button 
                                            onClick={() => openListModal(stats.id)}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-900/40 px-3.5 py-2 rounded-xl font-bold transition-colors text-xs border border-amber-200 dark:border-amber-900/50 cursor-pointer"
                                            title="Abrir listagem detalhada de embarques"
                                        >
                                            <List className="w-3.5 h-3.5" /> Listagem ({stats.total})
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                                    <StatCard 
                                        title="Total Embarques" 
                                        value={stats.total} 
                                        icon={<TruckIcon className="w-6 h-6 text-amber-500"/>} 
                                    />
                                    <StatCard 
                                        title="Finalizados" 
                                        value={stats.finalizado} 
                                        icon={<CheckCircleIcon className="w-6 h-6 text-emerald-500"/>} 
                                    />
                                    <StatCard 
                                        title="Em Trânsito" 
                                        value={stats.emAndamento} 
                                        icon={<ClockIcon className="w-6 h-6 text-amber-500"/>} 
                                    />
                                    <StatCard 
                                        title="Cancelados" 
                                        value={stats.cancelado} 
                                        icon={<XCircleIcon className="w-6 h-6 text-rose-500"/>} 
                                    />
                                    <StatCard 
                                        title="Toneladas Efetivadas" 
                                        value={`${stats.effectiveTonnage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} t`} 
                                        icon={<Scale className="w-6 h-6 text-teal-500"/>} 
                                    />
                                    <StatCard 
                                        title="Comissão Total" 
                                        value={canViewCommission ? formatCurrency(stats.commission) : '***'} 
                                        icon={<DollarSignIcon className="w-6 h-6 text-emerald-500"/>} 
                                        subtext={!canViewCommission ? 'Sem permissão' : undefined}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detailed Shipments Modal */}
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
                                    {selectedEmbarcadorId === 'ALL' 
                                        ? 'Visão Consolidada de Todos os Embarcadores' 
                                        : `Embarcador: ${operatorStats.find(o => o.id === selectedEmbarcadorId)?.name}`}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <button
                                    onClick={generatePDFFromModal}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                                    title={activeModalFiltersCount > 0 ? 'Exportar PDF com os filtros aplicados' : 'Exportar PDF de todos'}
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
                                    <span className="text-gray-400 font-semibold mr-1">Frete Empresa Total:</span>
                                    <span className="font-black text-primary dark:text-amber-400">{formatCurrency(modalFinancialTotals.totalCompanyFreight)}</span>
                                </div>
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
                            </div>
                        </div>

                        {/* Collapsible Filter Toolbar */}
                        {showModalFilters && (
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <MultiSelectDropdown label="Status" options={modalStatusOptions} selectedValues={filterModalStatus} onChange={setFilterModalStatus} placeholder="Todos os status..." />
                                    <MultiSelectDropdown label="Motorista" options={modalDriverOptions} selectedValues={filterModalDriver} onChange={setFilterModalDriver} placeholder="Todos motoristas..." />
                                    <MultiSelectDropdown label="Origem" options={modalOriginOptions} selectedValues={filterModalOrigin} onChange={setFilterModalOrigin} placeholder="Todas origens..." />
                                    <MultiSelectDropdown label="Destino" options={modalDestOptions} selectedValues={filterModalDest} onChange={setFilterModalDest} placeholder="Todos destinos..." />
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
                                        <th scope="col" className="px-4 py-3">Cliente</th>
                                        <th scope="col" className="px-4 py-3">Rota (Origem → Destino)</th>
                                        <th scope="col" className="px-4 py-3">Valores (/Ton)</th>
                                        <th scope="col" className="px-4 py-3">Pesos (Orig. / Dest.)</th>
                                        <th scope="col" className="px-4 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredModalShipments.map((shipment) => {
                                        const cargo = cargoMap.get(shipment.cargoId);
                                        const origem = cargo?.origin || 'N/A';
                                        const destino = cargo?.destination || 'N/A';
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
                                                            <span className="text-gray-400">Emp:</span>
                                                            <span className="font-bold text-primary dark:text-amber-400">{formatCurrency(freteEmpresa)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-gray-400">Mot:</span>
                                                            <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(freteMotorista)}</span>
                                                        </div>
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

export default ShipperReport;
