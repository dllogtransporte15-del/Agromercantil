import React, { useMemo, useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, List, X, Filter } from 'lucide-react';
import type { Shipment, Cargo, Client } from '../../types';
import { ShipmentStatus } from '../../types';
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

interface ClientReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  clients: Client[];
}

// ─── Internal shape ───────────────────────────────────────────────────────────

interface ClientStats {
  id: string;
  name: string;
  totalTonnage: number;
  grossBilled: number;
  profitMargin: number; // Monetary profit
  totalShipments: number;
  marginPercent: number;
}

// ─── Row data for the listing modal ──────────────────────────────────────────

interface ShipmentRow {
  id: string;
  startDate: string;
  endDate: string;
  driverName: string;
  horsePlate: string;
  origin: string;
  destination: string;
  companyFreight: number;
  driverFreight: number;
  loadedWeight: number;   // shipmentTonnage
  arrivedWeight: number;  // unloadedTonnage ?? shipmentTonnage
  weightBreak: number;    // loadedWeight - arrivedWeight
}

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactElement;
  formatAsCurrency?: boolean;
}> = ({ title, value, icon, formatAsCurrency = false }) => {
  const displayValue =
    formatAsCurrency && typeof value === 'number'
      ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : value;

  return (
    <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      {icon}
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{displayValue}</p>
      </div>
    </div>
  );
};

// ─── Table header cell ────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

const ClientReport: React.FC<ClientReportProps> = ({ shipments, cargos, clients }) => {
  // ── Modal open state ────────────────────────────────────────────────────────
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // ── Filter states ───────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterDriver, setFilterDriver] = useState<string[]>([]);
  const [filterOrigin, setFilterOrigin] = useState<string[]>([]);
  const [filterDest, setFilterDest] = useState<string[]>([]);

  // ── Maps ────────────────────────────────────────────────────────────────────
  const cargoMap = useMemo<Map<string, Cargo>>(
    () => new Map(cargos.map(c => [c.id, c])),
    [cargos],
  );

  // ── Aggregated stats per client ─────────────────────────────────────────────
  const effectiveStatuses = [
    ShipmentStatus.AguardandoNota,
    ShipmentStatus.AguardandoAdiantamento,
    ShipmentStatus.AguardandoAgendamento,
    ShipmentStatus.AguardandoDescarga,
    ShipmentStatus.AguardandoPagamentoSaldo,
    ShipmentStatus.Finalizado,
  ];

  const clientStats = useMemo<ClientStats[]>(() => {
    const statsMap = new Map<
      string,
      { totalTonnage: number; grossBilled: number; profitMargin: number; totalShipments: number }
    >();

    clients.forEach(client => {
      statsMap.set(client.id, {
        totalTonnage: 0,
        grossBilled: 0,
        profitMargin: 0,
        totalShipments: 0,
      });
    });

    shipments
      .filter(s => effectiveStatuses.includes(s.status))
      .forEach(shipment => {
        const cargo = cargoMap.get(shipment.cargoId);
        if (!cargo) return;

        const clientStat = statsMap.get(cargo.clientId);
        if (!clientStat) return;

        clientStat.totalTonnage += shipment.shipmentTonnage;
        clientStat.totalShipments += 1;

        const grossRate = shipment.companyFreightRateSnapshot ?? cargo.companyFreightValuePerTon;
        const grossValue = grossRate * shipment.shipmentTonnage;
        clientStat.grossBilled += grossValue;

        const icmsValue = cargo.hasIcms ? grossValue * (cargo.icmsPercentage / 100) : 0;
        const netValue = grossValue - icmsValue;
        const profit = netValue - shipment.driverFreightValue;
        clientStat.profitMargin += profit;
      });

    return Array.from(statsMap.entries())
      .map(([clientId, stats]) => ({
        id: clientId,
        name: clients.find(c => c.id === clientId)?.nomeFantasia ?? 'N/A',
        ...stats,
        marginPercent: stats.grossBilled > 0 ? (stats.profitMargin / stats.grossBilled) * 100 : 0,
      }))
      .filter(stat => stat.grossBilled > 0)
      .sort((a, b) => b.grossBilled - a.grossBilled);
  }, [shipments, cargos, clients, cargoMap]);

  // ── Rows for the selected client's shipments ────────────────────────────────
  const allRowsForClient = useMemo<ShipmentRow[]>(() => {
    if (!selectedClientId) return [];

    return shipments
      .filter(s => {
        const cargo = cargoMap.get(s.cargoId);
        return cargo?.clientId === selectedClientId;
      })
      .map(s => {
        const cargo = cargoMap.get(s.cargoId)!;
        const grossRate = s.companyFreightRateSnapshot ?? cargo.companyFreightValuePerTon;
        const loadedWeight = s.shipmentTonnage;
        const arrivedWeight = s.unloadedTonnage ?? s.shipmentTonnage;
        const weightBreak = loadedWeight - arrivedWeight;

        // Resolve effective start/end dates from statusHistory
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
          driverName: s.driverName,
          horsePlate: s.horsePlate,
          origin: cargo.origin,
          destination: cargo.destination,
          companyFreight: grossRate * s.shipmentTonnage,
          driverFreight: s.driverFreightValue,
          loadedWeight,
          arrivedWeight,
          weightBreak,
        };
      });
  }, [selectedClientId, shipments, cargoMap]);

  // ── Filter option lists ─────────────────────────────────────────────────────
  const statusOptions = Object.values(ShipmentStatus);

  const driverOptions = useMemo(
    () => [...new Set(allRowsForClient.map(r => r.driverName))].sort(),
    [allRowsForClient],
  );
  const originOptions = useMemo(
    () => [...new Set(allRowsForClient.map(r => r.origin))].sort(),
    [allRowsForClient],
  );
  const destOptions = useMemo(
    () => [...new Set(allRowsForClient.map(r => r.destination))].sort(),
    [allRowsForClient],
  );

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filteredRows = useMemo<ShipmentRow[]>(() => {
    return allRowsForClient.filter(row => {
      // We need the original shipment to check status
      const shipment = shipments.find(s => s.id.startsWith(row.id.toLowerCase()));
      if (filterStatus.length > 0) {
        if (!shipment || !filterStatus.includes(shipment.status)) return false;
      }
      if (filterDriver.length > 0 && !filterDriver.includes(row.driverName)) return false;
      if (filterOrigin.length > 0 && !filterOrigin.includes(row.origin)) return false;
      if (filterDest.length > 0 && !filterDest.includes(row.destination)) return false;
      return true;
    });
  }, [allRowsForClient, filterStatus, filterDriver, filterOrigin, filterDest, shipments]);

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

  // ── Active filter count ────────────────────────────────────────────────────
  const activeFilterCount =
    (filterStatus.length > 0 ? 1 : 0) +
    (filterDriver.length > 0 ? 1 : 0) +
    (filterOrigin.length > 0 ? 1 : 0) +
    (filterDest.length > 0 ? 1 : 0);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const selectedClientName = useMemo(
    () => clients.find(c => c.id === selectedClientId)?.nomeFantasia ?? '',
    [clients, selectedClientId],
  );

  const clearFilters = useCallback(() => {
    setFilterStatus([]);
    setFilterDriver([]);
    setFilterOrigin([]);
    setFilterDest([]);
  }, []);

  const openModal = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setIsListModalOpen(true);
    setShowFiltersPanel(false);
    clearFilters();
  }, [clearFilters]);

  const closeModal = useCallback(() => {
    setIsListModalOpen(false);
    setSelectedClientId(null);
    clearFilters();
  }, [clearFilters]);

  // ─── generatePDFFromModal — landscape PDF of current filtered view ──────────
  const generatePDFFromModal = useCallback(() => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const appliedFilters: FilterDescriptor[] = [
      { label: 'Status', values: filterStatus },
      { label: 'Motorista', values: filterDriver },
      { label: 'Origem', values: filterOrigin },
      { label: 'Destino', values: filterDest },
    ];

    const startY = buildPdfHeader(
      doc,
      `Listagem de Embarques — Cliente: ${selectedClientName}`,
      appliedFilters,
    );

    const tableBody = filteredRows.map(row => [
      row.id,
      row.startDate,
      row.endDate,
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

    // Totals row
    tableBody.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      fmtCurrency(totals.companyFreight),
      fmtCurrency(totals.driverFreight),
      fmtNumber(totals.loadedWeight),
      fmtNumber(totals.arrivedWeight),
      fmtNumber(totals.weightBreak),
    ]);

    autoTable(doc, {
      startY,
      head: [[
        'ID', 'Início', 'Fim', 'Motorista', 'Placa',
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
      // Style the last row (totals) differently
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
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
      },
    });

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  }, [filteredRows, totals, filterStatus, filterDriver, filterOrigin, filterDest, selectedClientName]);

  // ─── generatePDF — consolidated PDF of Finalizados only ────────────────────
  const generatePDF = useCallback((clientId: string, clientName: string) => {
    const finalizedRows = shipments
      .filter(s => {
        const cargo = cargoMap.get(s.cargoId);
        return cargo?.clientId === clientId && s.status === ShipmentStatus.Finalizado;
      })
      .map(s => {
        const cargo = cargoMap.get(s.cargoId)!;
        const grossRate = s.companyFreightRateSnapshot ?? cargo.companyFreightValuePerTon;
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
          driverName: s.driverName,
          horsePlate: s.horsePlate,
          origin: cargo.origin,
          destination: cargo.destination,
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
      { companyFreight: 0, driverFreight: 0, loadedWeight: 0, arrivedWeight: 0, weightBreak: 0 },
    );

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const startY = buildPdfHeader(
      doc,
      `Relatório de Fechamento — Cliente: ${clientName}`,
      [{ label: 'Status', values: ['Finalizado'] }],
    );

    const tableBody = finalizedRows.map(row => [
      row.id,
      row.startDate,
      row.endDate,
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
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      fmtCurrency(pdfTotals.companyFreight),
      fmtCurrency(pdfTotals.driverFreight),
      fmtNumber(pdfTotals.loadedWeight),
      fmtNumber(pdfTotals.arrivedWeight),
      fmtNumber(pdfTotals.weightBreak),
    ]);

    autoTable(doc, {
      startY,
      head: [[
        'ID', 'Início', 'Fim', 'Motorista', 'Placa',
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
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
      },
    });

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  }, [shipments, cargoMap]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Client cards ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
          Desempenho por Cliente
        </h2>
        {clientStats.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhum dado de cliente encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-6">
            {clientStats.map(stats => (
              <div key={stats.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-xl font-bold text-primary dark:text-blue-400">
                    {stats.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* Open listing modal */}
                    <button
                      onClick={() => openModal(stats.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                    >
                      <List className="w-4 h-4" />
                      Ver Embarques
                    </button>
                    {/* Consolidated PDF */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard
                    title="Total de Embarques"
                    value={stats.totalShipments}
                    icon={<PackageIcon className="w-8 h-8 text-blue-500" />}
                  />
                  <StatCard
                    title="Volume Total"
                    value={`${stats.totalTonnage.toLocaleString('pt-BR')} ton`}
                    icon={<PackageIcon className="w-8 h-8 text-gray-500" />}
                  />
                  <StatCard
                    title="Faturamento Bruto"
                    value={stats.grossBilled}
                    icon={<DollarSignIcon className="w-8 h-8 text-blue-500" />}
                    formatAsCurrency
                  />
                  <StatCard
                    title="Lucro Operacional Efetivado"
                    value={stats.profitMargin}
                    icon={<DollarSignIcon className="w-8 h-8 text-blue-400" />}
                    formatAsCurrency
                  />
                  <StatCard
                    title="Margem de Lucro"
                    value={`${stats.marginPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}
                    icon={<DollarSignIcon className="w-8 h-8 text-green-500" />}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Listing Modal ─────────────────────────────────────────────────── */}
      {isListModalOpen && selectedClientId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 overflow-hidden">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-7xl max-h-full flex flex-col overflow-hidden ring-1 ring-black/5">
            {/* Modal header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex-shrink-0">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Listagem de Embarques
              </p>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                Cliente: {selectedClientName}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MultiSelectDropdown
                  label="Status"
                  options={statusOptions}
                  selectedValues={filterStatus}
                  onChange={setFilterStatus}
                  placeholder="Todos os status..."
                />
                <MultiSelectDropdown
                  label="Motorista"
                  options={driverOptions}
                  selectedValues={filterDriver}
                  onChange={setFilterDriver}
                  placeholder="Todos os motoristas..."
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
                          <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {row.driverName}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {row.horsePlate}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 max-w-[140px] truncate" title={row.origin}>
                            {row.origin}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 max-w-[140px] truncate" title={row.destination}>
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
                          <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${
                            row.weightBreak > 0
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {fmtNumber(row.weightBreak)} t
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Totals footer */}
                    <tfoot>
                      <tr className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 dark:border-blue-800">
                        <td
                          colSpan={7}
                          className="px-3 py-3 text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider"
                        >
                          Totais ({filteredRows.length} embarque{filteredRows.length !== 1 ? 's' : ''})
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

export default ClientReport;
