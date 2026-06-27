import React, { useMemo, useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, List, X, Filter } from 'lucide-react';
import type { Shipment, User, Cargo, Client } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { TruckIcon } from '../icons/TruckIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { PackageIcon } from '../icons/PackageIcon';
import MultiSelectDropdown from '../MultiSelectDropdown';
import {
  buildPdfHeader,
  fmtCurrency,
  fmtNumber,
  PDF_COLORS,
  type FilterDescriptor,
} from '../../utils/pdfUtils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShipperReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
  currentUser: User | null;
  clients: Client[];
}

// ─── Aggregated stats ─────────────────────────────────────────────────────────

interface OperatorStats {
  id: string;
  name: string;
  total: number;
  finalizado: number;
  emAndamento: number;
  cancelado: number;
  effectiveTonnage: number;
  grossBilled: number;
}

// ─── Row for the listing modal ─────────────────────────────────────────────────

interface ShipmentRow {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  clientName: string;
  driverName: string;
  horsePlate: string;
  origin: string;
  destination: string;
  companyFreight: number;
  driverFreight: number;
  loadedWeight: number;
  arrivedWeight: number;
  weightBreak: number;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactElement;
}> = ({ title, value, icon }) => (
  <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
    {icon}
    <div className="ml-4">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);

// ─── Table header cell ─────────────────────────────────────────────────────────

const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <th
    className={`px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap ${className}`}
  >
    {children}
  </th>
);

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let colors = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  if (status === ShipmentStatus.Finalizado)
    colors = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  else if (status === ShipmentStatus.Cancelado)
    colors = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${colors}`}>
      {status}
    </span>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ShipperReport: React.FC<ShipperReportProps> = ({
  shipments,
  cargos,
  users,
  currentUser,
  clients,
}) => {
  // ── Permission ──────────────────────────────────────────────────────────────
  const canViewCommission = useMemo(() => {
    if (!currentUser) return false;
    return [UserProfile.Diretor, UserProfile.Comercial, UserProfile.Admin].includes(
      currentUser.profile,
    );
  }, [currentUser]);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterOrigin, setFilterOrigin] = useState<string[]>([]);
  const [filterDest, setFilterDest] = useState<string[]>([]);

  // ── Maps ────────────────────────────────────────────────────────────────────
  const cargoMap = useMemo<Map<string, Cargo>>(
    () => new Map(cargos.map(c => [c.id, c])),
    [cargos],
  );

  const clientMap = useMemo<Map<string, Client>>(
    () => new Map(clients.map(c => [c.id, c])),
    [clients],
  );

  // ── Aggregated stats per operator ───────────────────────────────────────────
  const operatorStats = useMemo<OperatorStats[]>(() => {
    const creatorIds = [...new Set(shipments.map(s => s.createdById))];

    return creatorIds
      .map(creatorId => {
        const creator = users.find(u => u.id === creatorId);
        const creatorShipments = shipments.filter(s => s.createdById === creatorId);

        const stats = creatorShipments.reduce(
          (acc, shipment) => {
            if (shipment.status === ShipmentStatus.Finalizado) {
              acc.finalizado += 1;
            } else if (shipment.status === ShipmentStatus.Cancelado) {
              acc.cancelado += 1;
            } else {
              acc.emAndamento += 1;
            }

            const isEffective = [
              ShipmentStatus.AguardandoNota,
              ShipmentStatus.AguardandoAdiantamento,
              ShipmentStatus.AguardandoAgendamento,
              ShipmentStatus.AguardandoDescarga,
              ShipmentStatus.AguardandoPagamentoSaldo,
              ShipmentStatus.Finalizado,
            ].includes(shipment.status);

            if (isEffective) {
              acc.effectiveTonnage += shipment.shipmentTonnage ?? 0;
              const cargo = cargos.find(c => c.id === shipment.cargoId);
              if (cargo) {
                const grossRate =
                  shipment.companyFreightRateSnapshot ?? cargo.companyFreightValuePerTon ?? 0;
                acc.grossBilled += grossRate * (shipment.shipmentTonnage ?? 0);
              }
            }

            return acc;
          },
          { finalizado: 0, cancelado: 0, emAndamento: 0, effectiveTonnage: 0, grossBilled: 0 },
        );

        return {
          id: creatorId,
          name: creator?.name ?? `Usuário (${creatorId})`,
          total: creatorShipments.length,
          ...stats,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [shipments, users, cargos]);

  // ── All rows for selected operator ──────────────────────────────────────────
  const allRowsForOperator = useMemo<ShipmentRow[]>(() => {
    if (!selectedOperatorId) return [];

    return shipments
      .filter(s => s.createdById === selectedOperatorId)
      .map(s => {
        const cargo = cargoMap.get(s.cargoId);
        const client = cargo ? clientMap.get(cargo.clientId) : undefined;
        const grossRate =
          s.companyFreightRateSnapshot ?? cargo?.companyFreightValuePerTon ?? 0;
        const loadedWeight = s.shipmentTonnage;
        const arrivedWeight = s.unloadedTonnage ?? s.shipmentTonnage;
        const weightBreak = loadedWeight - arrivedWeight;

        const startEntry = s.statusHistory?.find(
          h => h.status === ShipmentStatus.AguardandoNota,
        );
        const endEntry = s.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);

        return {
          id: s.id.substring(0, 8).toUpperCase(),
          startDate: startEntry
            ? new Date(startEntry.timestamp).toLocaleDateString('pt-BR')
            : s.scheduledDate
              ? new Date(s.scheduledDate).toLocaleDateString('pt-BR')
              : '—',
          endDate: endEntry
            ? new Date(endEntry.timestamp).toLocaleDateString('pt-BR')
            : s.status === ShipmentStatus.Finalizado
              ? '—'
              : 'Em andamento',
          status: s.status,
          clientName: client?.nomeFantasia ?? '—',
          driverName: s.driverName,
          horsePlate: s.horsePlate,
          origin: cargo?.origin ?? '—',
          destination: cargo?.destination ?? '—',
          companyFreight: grossRate * s.shipmentTonnage,
          driverFreight: s.driverFreightValue,
          loadedWeight,
          arrivedWeight,
          weightBreak,
        };
      });
  }, [selectedOperatorId, shipments, cargoMap, clientMap]);

  // ── Filter option lists ─────────────────────────────────────────────────────
  const statusOptions = Object.values(ShipmentStatus);
  const originOptions = useMemo(
    () => [...new Set(allRowsForOperator.map(r => r.origin).filter(v => v !== '—'))].sort(),
    [allRowsForOperator],
  );
  const destOptions = useMemo(
    () =>
      [...new Set(allRowsForOperator.map(r => r.destination).filter(v => v !== '—'))].sort(),
    [allRowsForOperator],
  );

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filteredRows = useMemo<ShipmentRow[]>(() => {
    return allRowsForOperator.filter(row => {
      if (filterStatus.length > 0 && !filterStatus.includes(row.status)) return false;
      if (filterOrigin.length > 0 && !filterOrigin.includes(row.origin)) return false;
      if (filterDest.length > 0 && !filterDest.includes(row.destination)) return false;
      return true;
    });
  }, [allRowsForOperator, filterStatus, filterOrigin, filterDest]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        companyFreight: acc.companyFreight + row.companyFreight,
        driverFreight: acc.driverFreight + row.driverFreight,
        loadedWeight: acc.loadedWeight + row.loadedWeight,
        arrivedWeight: acc.arrivedWeight + row.arrivedWeight,
        weightBreak: acc.weightBreak + row.weightBreak,
      }),
      { companyFreight: 0, driverFreight: 0, loadedWeight: 0, arrivedWeight: 0, weightBreak: 0 },
    );
  }, [filteredRows]);

  const activeFilterCount =
    (filterStatus.length > 0 ? 1 : 0) +
    (filterOrigin.length > 0 ? 1 : 0) +
    (filterDest.length > 0 ? 1 : 0);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const selectedOperatorName = useMemo(
    () => users.find(u => u.id === selectedOperatorId)?.name ?? '',
    [users, selectedOperatorId],
  );

  const clearFilters = useCallback(() => {
    setFilterStatus([]);
    setFilterOrigin([]);
    setFilterDest([]);
  }, []);

  const openModal = useCallback(
    (operatorId: string) => {
      setSelectedOperatorId(operatorId);
      setIsListModalOpen(true);
      setShowFiltersPanel(false);
      clearFilters();
    },
    [clearFilters],
  );

  const closeModal = useCallback(() => {
    setIsListModalOpen(false);
    setSelectedOperatorId(null);
    clearFilters();
  }, [clearFilters]);

  // ─── generatePDFFromModal ─────────────────────────────────────────────────
  const generatePDFFromModal = useCallback(() => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const appliedFilters: FilterDescriptor[] = [
      { label: 'Status', values: filterStatus },
      { label: 'Origem', values: filterOrigin },
      { label: 'Destino', values: filterDest },
    ];

    const startY = buildPdfHeader(
      doc,
      `Listagem de Embarques — Embarcador: ${selectedOperatorName}`,
      appliedFilters,
    );

    const tableBody = filteredRows.map(row => [
      row.id,
      row.startDate,
      row.endDate,
      row.status,
      row.clientName,
      row.driverName,
      row.horsePlate,
      row.origin,
      row.destination,
      fmtCurrency(row.companyFreight),
      fmtCurrency(row.driverFreight),
      fmtNumber(row.loadedWeight),
      fmtNumber(row.arrivedWeight),
      fmtNumber(row.weightBreak),
    ]);

    tableBody.push([
      'TOTAL', '', '', '', '', '', '', '', '',
      fmtCurrency(totals.companyFreight),
      fmtCurrency(totals.driverFreight),
      fmtNumber(totals.loadedWeight),
      fmtNumber(totals.arrivedWeight),
      fmtNumber(totals.weightBreak),
    ]);

    autoTable(doc, {
      startY,
      head: [[
        'ID', 'Início', 'Fim', 'Status', 'Cliente', 'Motorista', 'Placa',
        'Origem', 'Destino', 'Frete Empresa (R$)',
        'Frete Motorista (R$)', 'Peso Carregado (t)',
        'Peso Destino (t)', 'Quebra (t)',
      ]],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, textColor: PDF_COLORS.bodyText },
      headStyles: {
        fillColor: PDF_COLORS.headerBg,
        textColor: PDF_COLORS.headerText,
        fontStyle: 'bold',
        fontSize: 6.5,
      },
      alternateRowStyles: { fillColor: PDF_COLORS.bodyAlt },
      didParseCell: (data) => {
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fillColor = PDF_COLORS.totalsBg;
          data.cell.styles.textColor = PDF_COLORS.totalsText;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 18 },
        2: { cellWidth: 20 },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
        12: { halign: 'right' },
        13: { halign: 'right' },
      },
    });

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  }, [filteredRows, totals, filterStatus, filterOrigin, filterDest, selectedOperatorName]);

  // ─── generatePDF — consolidated PDF of Finalizados only ──────────────────
  const generatePDF = useCallback(
    (operatorId: string, operatorName: string) => {
      const finalizedRows = shipments
        .filter(s => s.createdById === operatorId && s.status === ShipmentStatus.Finalizado)
        .map(s => {
          const cargo = cargoMap.get(s.cargoId);
          const client = cargo ? clientMap.get(cargo.clientId) : undefined;
          const grossRate =
            s.companyFreightRateSnapshot ?? cargo?.companyFreightValuePerTon ?? 0;
          const loadedWeight = s.shipmentTonnage;
          const arrivedWeight = s.unloadedTonnage ?? s.shipmentTonnage;

          const startEntry = s.statusHistory?.find(
            h => h.status === ShipmentStatus.AguardandoNota,
          );
          const endEntry = s.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);

          return {
            id: s.id.substring(0, 8).toUpperCase(),
            startDate: startEntry
              ? new Date(startEntry.timestamp).toLocaleDateString('pt-BR')
              : s.scheduledDate
                ? new Date(s.scheduledDate).toLocaleDateString('pt-BR')
                : '—',
            endDate: endEntry
              ? new Date(endEntry.timestamp).toLocaleDateString('pt-BR')
              : '—',
            clientName: client?.nomeFantasia ?? '—',
            driverName: s.driverName,
            horsePlate: s.horsePlate,
            origin: cargo?.origin ?? '—',
            destination: cargo?.destination ?? '—',
            companyFreight: grossRate * s.shipmentTonnage,
            driverFreight: s.driverFreightValue,
            loadedWeight,
            arrivedWeight,
            weightBreak: loadedWeight - arrivedWeight,
          };
        });

      const pdfTotals = finalizedRows.reduce(
        (acc, row) => ({
          companyFreight: acc.companyFreight + row.companyFreight,
          driverFreight: acc.driverFreight + row.driverFreight,
          loadedWeight: acc.loadedWeight + row.loadedWeight,
          arrivedWeight: acc.arrivedWeight + row.arrivedWeight,
          weightBreak: acc.weightBreak + row.weightBreak,
        }),
        {
          companyFreight: 0,
          driverFreight: 0,
          loadedWeight: 0,
          arrivedWeight: 0,
          weightBreak: 0,
        },
      );

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const startY = buildPdfHeader(
        doc,
        `Relatório de Fechamento — Embarcador: ${operatorName}`,
        [{ label: 'Status', values: ['Finalizado'] }],
      );

      const tableBody = finalizedRows.map(row => [
        row.id,
        row.startDate,
        row.endDate,
        row.clientName,
        row.driverName,
        row.horsePlate,
        row.origin,
        row.destination,
        fmtCurrency(row.companyFreight),
        fmtCurrency(row.driverFreight),
        fmtNumber(row.loadedWeight),
        fmtNumber(row.arrivedWeight),
        fmtNumber(row.weightBreak),
      ]);

      tableBody.push([
        'TOTAL', '', '', '', '', '', '', '',
        fmtCurrency(pdfTotals.companyFreight),
        fmtCurrency(pdfTotals.driverFreight),
        fmtNumber(pdfTotals.loadedWeight),
        fmtNumber(pdfTotals.arrivedWeight),
        fmtNumber(pdfTotals.weightBreak),
      ]);

      autoTable(doc, {
        startY,
        head: [[
          'ID', 'Início', 'Fim', 'Cliente', 'Motorista', 'Placa',
          'Origem', 'Destino', 'Frete Empresa (R$)',
          'Frete Motorista (R$)', 'Peso Carregado (t)',
          'Peso Destino (t)', 'Quebra (t)',
        ]],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, textColor: PDF_COLORS.bodyText },
        headStyles: {
          fillColor: PDF_COLORS.headerBg,
          textColor: PDF_COLORS.headerText,
          fontStyle: 'bold',
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: PDF_COLORS.bodyAlt },
        didParseCell: (data) => {
          if (data.row.index === tableBody.length - 1) {
            data.cell.styles.fillColor = PDF_COLORS.totalsBg;
            data.cell.styles.textColor = PDF_COLORS.totalsText;
            data.cell.styles.fontStyle = 'bold';
          }
        },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 20 },
          2: { cellWidth: 22 },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' },
          11: { halign: 'right' },
          12: { halign: 'right' },
        },
      });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    },
    [shipments, cargoMap, clientMap],
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Operator cards ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
          Desempenho por Embarcador
        </h2>
        {operatorStats.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhum embarque encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-6">
            {operatorStats.map(stats => (
              <div
                key={stats.id}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-xl font-bold text-primary dark:text-blue-400">
                    {stats.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal(stats.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                    >
                      <List className="w-4 h-4" />
                      Ver Embarques
                    </button>
                    <button
                      onClick={() => generatePDF(stats.id, stats.name)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
                      title="Exportar PDF apenas com embarques Finalizados"
                    >
                      <Download className="w-4 h-4" />
                      Fechamento PDF
                    </button>
                  </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                  <StatCard
                    title="Total Embarques"
                    value={stats.total}
                    icon={<TruckIcon className="w-8 h-8 text-blue-500" />}
                  />
                  <StatCard
                    title="Faturamento Bruto"
                    value={stats.grossBilled.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                    icon={<DollarSignIcon className="w-8 h-8 text-green-600" />}
                  />
                  <StatCard
                    title="Finalizados"
                    value={stats.finalizado}
                    icon={<CheckCircleIcon className="w-8 h-8 text-gray-500" />}
                  />
                  <StatCard
                    title="Em Andamento"
                    value={stats.emAndamento}
                    icon={<ClockIcon className="w-8 h-8 text-blue-400" />}
                  />
                  <StatCard
                    title="Cancelados"
                    value={stats.cancelado}
                    icon={<XCircleIcon className="w-8 h-8 text-black" />}
                  />
                  <StatCard
                    title="Toneladas Efetivadas"
                    value={`${stats.effectiveTonnage.toLocaleString('pt-BR')} t`}
                    icon={<TruckIcon className="w-8 h-8 text-green-500" />}
                  />
                </div>

                {/* Suppress unused variable warning */}
                {canViewCommission && false && <span />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Listing Modal ─────────────────────────────────────────────────── */}
      {isListModalOpen && selectedOperatorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 overflow-hidden">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-7xl max-h-full flex flex-col overflow-hidden ring-1 ring-black/5">
            {/* Modal header bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex-shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Listagem de Embarques
                </p>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  Embarcador: {selectedOperatorName}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {filteredRows.length} registro(s) exibido(s)
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => setShowFiltersPanel(prev => !prev)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                    showFiltersPanel || activeFilterCount > 0
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                      : 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filtrar
                  {activeFilterCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={generatePDFFromModal}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </button>

                <button
                  onClick={closeModal}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Fechar
                </button>
              </div>
            </div>

            {/* Filters panel */}
            {showFiltersPanel && (
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex-shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <MultiSelectDropdown
                    label="Status"
                    options={statusOptions}
                    selectedValues={filterStatus}
                    onChange={setFilterStatus}
                    placeholder="Todos os status..."
                  />
                  <MultiSelectDropdown
                    label="Origem"
                    options={originOptions}
                    selectedValues={filterOrigin}
                    onChange={setFilterOrigin}
                    placeholder="Todas as origens..."
                  />
                  <MultiSelectDropdown
                    label="Destino"
                    options={destOptions}
                    selectedValues={filterDest}
                    onChange={setFilterDest}
                    placeholder="Todos os destinos..."
                  />
                </div>
                {activeFilterCount > 0 && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                    >
                      <X className="w-4 h-4" />
                      Limpar Filtros
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Scrollable table area */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-gray-500">
                  <PackageIcon className="w-16 h-16 opacity-30" />
                  <p className="text-lg font-medium">Nenhum embarque encontrado.</p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-primary hover:underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <Th>ID</Th>
                          <Th>Início</Th>
                          <Th>Fim</Th>
                          <Th>Status</Th>
                          <Th>Cliente</Th>
                          <Th>Motorista</Th>
                          <Th>Placa</Th>
                          <Th>Origem</Th>
                          <Th>Destino</Th>
                          <Th className="text-right">Frete Empresa</Th>
                          <Th className="text-right">Frete Motorista</Th>
                          <Th className="text-right">Peso Carregado</Th>
                          <Th className="text-right">Peso Destino</Th>
                          <Th className="text-right">Quebra</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                          >
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {row.id}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">
                              {row.startDate}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">
                              {row.endDate}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <StatusBadge status={row.status} />
                            </td>
                            <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {row.clientName}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                              {row.driverName}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {row.horsePlate}
                            </td>
                            <td
                              className="px-3 py-2.5 text-gray-700 dark:text-gray-300 max-w-[130px] truncate"
                              title={row.origin}
                            >
                              {row.origin}
                            </td>
                            <td
                              className="px-3 py-2.5 text-gray-700 dark:text-gray-300 max-w-[130px] truncate"
                              title={row.destination}
                            >
                              {row.destination}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
                              {fmtCurrency(row.companyFreight)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {fmtCurrency(row.driverFreight)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {fmtNumber(row.loadedWeight)} t
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {fmtNumber(row.arrivedWeight)} t
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${
                                row.weightBreak > 0
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              {fmtNumber(row.weightBreak)} t
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {/* Totals footer */}
                      <tfoot>
                        <tr className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 dark:border-blue-800">
                          <td
                            colSpan={9}
                            className="px-3 py-3 text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider"
                          >
                            Totais ({filteredRows.length} embarque
                            {filteredRows.length !== 1 ? 's' : ''})
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-blue-900 dark:text-blue-200 whitespace-nowrap text-sm">
                            {fmtCurrency(totals.companyFreight)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-blue-900 dark:text-blue-200 whitespace-nowrap text-sm">
                            {fmtCurrency(totals.driverFreight)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-blue-900 dark:text-blue-200 whitespace-nowrap text-sm">
                            {fmtNumber(totals.loadedWeight)} t
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-blue-900 dark:text-blue-200 whitespace-nowrap text-sm">
                            {fmtNumber(totals.arrivedWeight)} t
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-orange-700 dark:text-orange-400 whitespace-nowrap text-sm">
                            {fmtNumber(totals.weightBreak)} t
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShipperReport;
