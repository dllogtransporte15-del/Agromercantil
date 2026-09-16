import React, { useState, useMemo } from 'react';
import type { Shipment, User, Cargo, Client } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { TruckIcon } from '../icons/TruckIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { Download, List, X, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfLogo } from '../../utils/pdfGenerator';
import MultiSelectDropdown from '../MultiSelectDropdown';

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
  total: number;
  finalizado: number;
  emAndamento: number;
  cancelado: number;
  effectiveTonnage: number;
  commission: number;
}

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactElement }> = ({ title, value, icon }) => {
    return (
        <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/60 rounded-xl border border-gray-100 dark:border-gray-600/50 shadow-xs">
            <div className="flex-shrink-0">{icon}</div>
            <div className="ml-3 min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-300 truncate">{title}</p>
                <p className="text-lg font-black text-gray-900 dark:text-white truncate">{value}</p>
            </div>
        </div>
    );
};

const ShipperReport: React.FC<ShipperReportProps> = ({ shipments, cargos, clients, users, currentUser, companyLogo }) => {
    const [showListModal, setShowListModal] = useState(false);
    const [selectedEmbarcadorId, setSelectedEmbarcadorId] = useState<string | 'ALL'>('ALL');
    const [filterModalStatus, setFilterModalStatus] = useState<string[]>([]);
    const [filterModalOrigin, setFilterModalOrigin] = useState<string[]>([]);
    const [filterModalDest, setFilterModalDest] = useState<string[]>([]);
    const [filterModalDriver, setFilterModalDriver] = useState<string[]>([]);
    const [showModalFilters, setShowModalFilters] = useState(false);

    const canViewCommission = useMemo(() => {
        if (!currentUser) return false;
        return [UserProfile.Diretor, UserProfile.Comercial, UserProfile.Admin, UserProfile.Demonstracao].includes(currentUser.profile);
    }, [currentUser]);

    const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

    const operatorStats = useMemo<OperatorStats[]>(() => {
        const creatorIds = [...new Set([
            ...shipments.map(s => s.embarcadorId).filter(Boolean) as string[],
            ...shipments.map(s => s.createdById).filter(Boolean) as string[]
        ])];

        return creatorIds.map(creatorId => {
            const creator = users.find(u => u.id === creatorId);
            const creatorShipments = shipments.filter(s => s.embarcadorId === creatorId || s.createdById === creatorId);
          
            const stats = creatorShipments.reduce((acc, shipment) => {
                if (shipment.status === ShipmentStatus.Finalizado) {
                  acc.finalizado += 1;
                } else if (shipment.status === ShipmentStatus.Cancelado) {
                  acc.cancelado += 1;
                } else {
                  acc.emAndamento += 1;
                }

                const isEffective = [
                    ShipmentStatus.PreCadastro,
                    ShipmentStatus.AguardandoSeguradora,
                    ShipmentStatus.AguardandoNota,
                    ShipmentStatus.AguardandoAdiantamento,
                    ShipmentStatus.AguardandoAgendamento,
                    ShipmentStatus.AguardandoDescarga,
                    ShipmentStatus.AguardandoPagamentoSaldo,
                    ShipmentStatus.Finalizado
                ].includes(shipment.status);
                if (isEffective) {
                    acc.effectiveTonnage += shipment.shipmentTonnage || 0;
                }

                return acc;
            }, { finalizado: 0, cancelado: 0, emAndamento: 0, effectiveTonnage: 0, commission: 0 });
            
            stats.commission = stats.effectiveTonnage * 2;
    
            return {
                id: creatorId,
                name: creator?.name || `Usuário (${creatorId})`,
                total: stats.finalizado + stats.emAndamento,
                ...stats,
            };
        }).sort((a, b) => b.total - a.total);
    }, [shipments, users]);

    const getShipmentsForPdfAndList = (embarcadorId?: string) => {
        const nonCanceled = shipments.filter(s => s.status !== ShipmentStatus.Cancelado);
        if (embarcadorId && embarcadorId !== 'ALL') {
            return nonCanceled.filter(s => s.embarcadorId === embarcadorId || s.createdById === embarcadorId);
        }
        return nonCanceled;
    };

    const baseModalShipments = useMemo(() => {
        const nonCanceled = shipments.filter(s => s.status !== ShipmentStatus.Cancelado);
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
        const tableColumn = ["ID", "Início", "Fim", "Cliente", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Carregado", "Peso Destino", "Quebra", "Status"];
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
            const cliente = clients.find(c => c.id === cargo?.clientId)?.nomeFantasia || 'N/A';

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

            tableRows.push([
                shipment.id,
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
            "TOTAIS", "-", "-", "-", "-", `Embarques: ${shipmentsForPdf.length}`, "-", "-",
            fmt(totalFreteEmpresa),
            fmt(totalFreteMotorista),
            totalPesoCarregado.toFixed(2) + ' t',
            totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
            "-", "-"
        ]);

        tableRows.push([
            "LÍQUIDO", "-", "-", "-", "-", "-", "-", "-",
            fmt(totalFreteEmpresa - totalFreteMotorista),
            "-", "-", "-", "-", "-"
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY,
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

        const suffix = activeModalFiltersCount > 0 ? '_filtrado' : '';
        doc.save(`Listagem_${embarcadorName.replace(/\s+/g, '_')}${suffix}_${new Date().getTime()}.pdf`);
    };

    const generatePDF = (embarcadorId?: string) => {
        // Filter to only export finalized shipments for the PDF
        const targetShipments = getShipmentsForPdfAndList(embarcadorId).filter(s => s.status === ShipmentStatus.Finalizado);
        const embarcadorName = embarcadorId && embarcadorId !== 'ALL' 
            ? operatorStats.find(o => o.id === embarcadorId)?.name 
            : 'Geral';

        const doc = new jsPDF('landscape');
        addPdfLogo(doc, companyLogo, { align: 'right', y: 5, width: 35, height: 15 });
        
        doc.setFontSize(16);
        doc.text(`Relatório de Embarques Finalizados - Embarcador: ${embarcadorName || 'Todos'}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);

        const tableColumn = ["ID", "Início", "Fim", "Cliente", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Carregado", "Peso Destino", "Quebra"];
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
            "TOTAIS", "-", "-", "-", "-", `Embarques: ${targetShipments.length}`, "-", "-",
            formatCurrency(totalFreteEmpresa),
            formatCurrency(totalFreteMotorista),
            totalPesoCarregado.toFixed(2) + ' t',
            totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
            "-"
        ]);

        tableRows.push([
            "LÍQUIDO", "-", "-", "-", "-", "-", "-", "-",
            formatCurrency(totalFreteEmpresa - totalFreteMotorista),
            "-", "-", "-", "-"
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            theme: 'grid',
            styles: { fontSize: 8 },
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

        doc.save(`Relatorio_Embarques_${embarcadorName?.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    };

    const openListModal = (embarcadorId: string) => {
        setSelectedEmbarcadorId(embarcadorId);
        clearModalFilters();
        setShowModalFilters(false);
        setShowListModal(true);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Desempenho por Embarcador</h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => generatePDF('ALL')}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
                    >
                        <Download className="w-4 h-4" /> Baixar PDF Geral
                    </button>
                    <button 
                        onClick={() => openListModal('ALL')}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
                    >
                        <List className="w-4 h-4" /> Listagem Geral
                    </button>
                </div>
            </div>
            
            {operatorStats.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-700">
                    Nenhum embarque encontrado para os filtros selecionados.
                </div>
            ) : (
                <div className="space-y-6">
                {operatorStats.map(stats => (
                    <div key={stats.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                            <h3 className="text-xl font-bold text-primary dark:text-blue-400">{stats.name}</h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => generatePDF(stats.id)}
                                    className="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-md font-medium transition-colors text-xs border border-red-200 dark:border-red-800"
                                >
                                    <Download className="w-3.5 h-3.5" /> PDF
                                </button>
                                <button 
                                    onClick={() => openListModal(stats.id)}
                                    className="flex items-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-md font-medium transition-colors text-xs border border-blue-200 dark:border-blue-800"
                                >
                                    <List className="w-3.5 h-3.5" /> Listagem
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            <StatCard title="Total Embarques" value={stats.total} icon={<TruckIcon className="w-8 h-8 text-blue-500 dark:text-blue-400"/>} />
                            <StatCard title="Finalizados" value={stats.finalizado} icon={<CheckCircleIcon className="w-8 h-8 text-emerald-500 dark:text-emerald-400"/>} />
                            <StatCard title="Em Andamento" value={stats.emAndamento} icon={<ClockIcon className="w-8 h-8 text-amber-500 dark:text-amber-400"/>} />
                            <StatCard title="Cancelados" value={stats.cancelado} icon={<XCircleIcon className="w-8 h-8 text-rose-500 dark:text-rose-400"/>} />
                            <StatCard title="Toneladas Efetivadas" value={`${stats.effectiveTonnage.toLocaleString('pt-BR')} t`} icon={<TruckIcon className="w-8 h-8 text-teal-500 dark:text-teal-400"/>} />
                        </div>
                    </div>
                ))}
                </div>
            )}

            {showListModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    Listagem de Embarques
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {selectedEmbarcadorId === 'ALL' ? 'Todos os Embarcadores' : `Embarcador: ${operatorStats.find(o => o.id === selectedEmbarcadorId)?.name}`}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={generatePDFFromModal}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
                                    title={activeModalFiltersCount > 0 ? 'Baixar PDF com filtros aplicados' : 'Baixar PDF completo'}
                                >
                                    <Download className="w-4 h-4" />
                                    PDF {activeModalFiltersCount > 0 && <span className="ml-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredModalShipments.length}</span>}
                                </button>
                                <button 
                                    onClick={() => setShowModalFilters(!showModalFilters)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${showModalFilters || activeModalFiltersCount > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                                >
                                    <Filter className="w-4 h-4" /> Filtros {activeModalFiltersCount > 0 && `(${activeModalFiltersCount})`}
                                </button>
                                <button
                                    onClick={() => setShowListModal(false)}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        {showModalFilters && (
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/20">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <MultiSelectDropdown label="Status" options={modalStatusOptions} selectedValues={filterModalStatus} onChange={setFilterModalStatus} placeholder="Todos..." />
                                    <MultiSelectDropdown label="Motorista" options={modalDriverOptions} selectedValues={filterModalDriver} onChange={setFilterModalDriver} placeholder="Todos..." />
                                    <MultiSelectDropdown label="Origem" options={modalOriginOptions} selectedValues={filterModalOrigin} onChange={setFilterModalOrigin} placeholder="Todas..." />
                                    <MultiSelectDropdown label="Destino" options={modalDestOptions} selectedValues={filterModalDest} onChange={setFilterModalDest} placeholder="Todos..." />
                                </div>
                                {activeModalFiltersCount > 0 && (
                                    <div className="mt-3 flex justify-end">
                                        <button onClick={clearModalFilters} className="text-xs flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400">
                                            <X className="w-3.5 h-3.5" /> Limpar Filtros
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="p-0 overflow-auto flex-1">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 shadow-sm">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID / Motorista</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Datas (Início/Fim)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rota (Origem → Destino)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valores (/Ton)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pesos (Orig. / Dest.)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
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

                                        return (
                                            <tr key={shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900 dark:text-white">{shipment.id}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{shipment.driverName}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-gray-500 dark:text-gray-400">Início:</span>
                                                            <span className="font-medium text-gray-900 dark:text-gray-200">{dataInicio}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-gray-500 dark:text-gray-400">Fim:</span>
                                                            <span className="font-medium text-gray-900 dark:text-gray-200">{dataFim}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                                                        {shipment.horsePlate || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{clienteNome}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <span className="font-medium text-gray-900 dark:text-white">{origem}</span>
                                                        <span className="text-gray-400 text-xs">para</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{destino}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-medium">Empresa:</span>
                                                            <span className="font-bold text-primary dark:text-blue-400">{formatCurrency(freteEmpresa)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-medium">Motorista:</span>
                                                            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(freteMotorista)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500">Origem:</span>
                                                            <span className="font-medium dark:text-gray-300">{pesoOrigem.toFixed(2)} t</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500">Destino:</span>
                                                            <span className="font-medium dark:text-gray-300">{pesoDestino !== undefined ? `${pesoDestino.toFixed(2)} t` : '-'}</span>
                                                        </div>
                                                        {quebra && (
                                                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
                                                                <span className="text-[10px] text-red-500 font-bold uppercase">Quebra:</span>
                                                                <span className="text-xs text-red-600 font-bold">{quebra} t</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                        {shipment.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShipperReport;
