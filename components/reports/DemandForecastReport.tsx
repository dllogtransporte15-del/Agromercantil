import React, { useState, useMemo } from "react";
import type { Cargo, Client, Shipment } from "../../types";
import { ShipmentStatus } from "../../types";
import { Download, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addPdfLogo } from "../../utils/pdfGenerator";
import { getShipmentEffectiveDate } from "../../utils";

interface DemandForecastReportProps {
  cargos: Cargo[];
  clients: Client[];
  shipments: Shipment[];
  companyLogo?: string | null;
}

interface ClientDemandRow {
  clientId: string;
  clientName: string;
  dailyTonnage: Record<string, number>;
  scheduledDays: Record<string, boolean>;
  previsto: number;
  atendido: number;
  saldo: number;
}

const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (cur <= endDate) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function getWeekdayLabel(dateStr: string): string {
  return WEEKDAY_LABELS[new Date(dateStr + "T00:00:00").getDay()];
}

const DemandForecastReport: React.FC<DemandForecastReportProps> = ({ cargos, clients, shipments, companyLogo }) => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const [startDate, setStartDate] = useState(monday.toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(sunday.toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState<"resumo" | "detalhado">("detalhado");

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const datesInRange = useMemo(() => getDatesInRange(startDate, endDate), [startDate, endDate]);

  const weekdayColumns = useMemo(() => {
    const cols: { label: string; dates: string[] }[] = [];
    datesInRange.forEach((d) => {
      const label = getWeekdayLabel(d);
      const existing = cols.find((c) => c.label === label);
      if (existing) {
        existing.dates.push(d);
      } else {
        cols.push({ label, dates: [d] });
      }
    });
    return cols;
  }, [datesInRange]);

  const attendedTonnageByCargoAndDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    shipments.forEach((s) => {
      const effDate = getShipmentEffectiveDate(s) ?? s.scheduledDate;
      if (!effDate || effDate < startDate || effDate > endDate) return;
      if (!map.has(s.cargoId)) map.set(s.cargoId, new Map());
      const dateMap = map.get(s.cargoId)!;
      dateMap.set(effDate, (dateMap.get(effDate) ?? 0) + (s.shipmentTonnage ?? 0));
    });
    return map;
  }, [shipments, startDate, endDate]);

  const rows = useMemo<ClientDemandRow[]>(() => {
    const rowMap = new Map<string, ClientDemandRow>();

    cargos.forEach((cargo) => {
      if (!cargo.dailySchedule || cargo.dailySchedule.length === 0) return;
      const client = clientMap.get(cargo.clientId);
      if (!client) return;

      cargo.dailySchedule.forEach((entry) => {
        if (entry.date < startDate || entry.date > endDate) return;
        // Accept all entries in range, even those without explicit tonnage
        const ton = entry.tonnage ?? 0;

        if (!rowMap.has(cargo.clientId)) {
          rowMap.set(cargo.clientId, {
            clientId: cargo.clientId,
            clientName: client.nomeFantasia,
            dailyTonnage: {},
            scheduledDays: {},
            previsto: 0,
            atendido: 0,
            saldo: 0,
          });
        }
        const row = rowMap.get(cargo.clientId)!;
        row.dailyTonnage[entry.date] = (row.dailyTonnage[entry.date] ?? 0) + ton;
        // Track scheduled days separately so we can show "-" vs "0"
        row.scheduledDays[entry.date] = true;
        row.previsto += ton;
      });
    });

    rowMap.forEach((row, clientId) => {
      const clientCargos = cargos.filter((c) => c.clientId === clientId);
      let atendido = 0;
      clientCargos.forEach((cargo) => {
        const dateMap = attendedTonnageByCargoAndDate.get(cargo.id);
        if (!dateMap) return;
        dateMap.forEach((ton, date) => {
          if (date >= startDate && date <= endDate) atendido += ton;
        });
      });
      row.atendido = atendido;
      row.saldo = row.previsto - atendido;
    });

    return Array.from(rowMap.values()).sort((a, b) => b.previsto - a.previsto);
  }, [cargos, clientMap, startDate, endDate, attendedTonnageByCargoAndDate]);

  const weekdayTotals = useMemo(() => {
    return weekdayColumns.map((col) =>
      rows.reduce((sum, row) => sum + col.dates.reduce((s, d) => s + (row.dailyTonnage[d] ?? 0), 0), 0)
    );
  }, [weekdayColumns, rows]);

  const totalPrevisto = rows.reduce((s, r) => s + r.previsto, 0);
  const totalAtendido = rows.reduce((s, r) => s + r.atendido, 0);
  const totalSaldo = totalPrevisto - totalAtendido;

  const fmtSaldo = (n: number) => {
    if (n === 0) return "0";
    return (n > 0 ? "+" : "") + n.toLocaleString("pt-BR");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF("landscape");
    addPdfLogo(doc, companyLogo, { align: 'right', y: 5, width: 35, height: 15 });
    doc.setFontSize(14);
    doc.text("Previsao de Demandas", 14, 14);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      `Periodo: ${new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")} ate ${new Date(endDate + "T00:00:00").toLocaleDateString("pt-BR")} - Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      14,
      20
    );
    doc.setTextColor(0);

    if (viewMode === "resumo") {
      autoTable(doc, {
        startY: 26,
        head: [["CLIENTE", "PREVISTO (TON)", "ATENDIDO (TON)", "SALDO PENDENTE"]],
        body: [
          ...rows.map((r) => [r.clientName, r.previsto.toLocaleString("pt-BR"), r.atendido.toLocaleString("pt-BR"), fmtSaldo(r.saldo)]),
          ["TOTAL", totalPrevisto.toLocaleString("pt-BR"), totalAtendido.toLocaleString("pt-BR"), fmtSaldo(totalSaldo)],
        ],
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [29, 59, 141], textColor: 255 },
        didParseCell: (data) => {
          if (data.cell.section === 'body') {
            const rawRow = data.row.raw;
            if (Array.isArray(rawRow)) {
              if (rawRow[0] === 'TOTAL' || rawRow[0] === 'TOTAIS') {
                data.cell.styles.fillColor = [240, 240, 240];
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [0, 0, 0];
              }
            }
          }
        }
      });
    } else {
      autoTable(doc, {
        startY: 26,
        head: [["CLIENTE", ...weekdayColumns.map((c) => c.label), "PREVISTO", "ATENDIDO", "SALDO"]],
        body: [
          ...rows.map((r) => [
            r.clientName,
            ...weekdayColumns.map((col) => {
              const t = col.dates.reduce((s, d) => s + (r.dailyTonnage[d] ?? 0), 0);
              return t > 0 ? t.toLocaleString("pt-BR") : "-";
            }),
            r.previsto.toLocaleString("pt-BR"),
            r.atendido.toLocaleString("pt-BR"),
            fmtSaldo(r.saldo),
          ]),
          ["TOTAL", ...weekdayTotals.map((t) => (t > 0 ? t.toLocaleString("pt-BR") : "-")), totalPrevisto.toLocaleString("pt-BR"), totalAtendido.toLocaleString("pt-BR"), fmtSaldo(totalSaldo)],
        ],
        theme: "grid",
        styles: { fontSize: 7 },
        headStyles: { fillColor: [29, 59, 141], textColor: 255 },
        didParseCell: (data) => {
          if (data.cell.section === 'body') {
            const rawRow = data.row.raw;
            if (Array.isArray(rawRow)) {
              if (rawRow[0] === 'TOTAL' || rawRow[0] === 'TOTAIS') {
                data.cell.styles.fillColor = [240, 240, 240];
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [0, 0, 0];
              }
            }
          }
        }
      });
    }

    doc.save(`Previsao_Demandas_${startDate}_${endDate}.pdf`);
  };

  const handleExportExcel = () => {
    const sep = ";";
    const lines: string[] = [];

    if (viewMode === "resumo") {
      lines.push(["CLIENTE", "PREVISTO (TON)", "ATENDIDO (TON)", "SALDO PENDENTE"].join(sep));
      rows.forEach((r) => lines.push([r.clientName, r.previsto, r.atendido, r.saldo].join(sep)));
      lines.push(["TOTAL", totalPrevisto, totalAtendido, totalSaldo].join(sep));
    } else {
      lines.push(["CLIENTE", ...weekdayColumns.map((c) => c.label), "PREVISTO", "ATENDIDO", "SALDO"].join(sep));
      rows.forEach((r) => {
        const cols = weekdayColumns.map((col) => col.dates.reduce((s, d) => s + (r.dailyTonnage[d] ?? 0), 0));
        lines.push([r.clientName, ...cols, r.previsto, r.atendido, r.saldo].join(sep));
      });
      lines.push(["TOTAL", ...weekdayTotals, totalPrevisto, totalAtendido, totalSaldo].join(sep));
    }

    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Previsao_Demandas_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Previsao de Demandas</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Planejado (Tons) vs Atendido na Semana</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode("resumo")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === "resumo" ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
            >
              Resumo
            </button>
            <button
              onClick={() => setViewMode("detalhado")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === "detalhado" ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
            >
              Detalhado
            </button>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800/90 border border-gray-200/80 dark:border-gray-700/80 rounded-xl px-3 py-1.5 text-sm shadow-xs">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-100 font-medium" />
            <span className="text-gray-400 dark:text-gray-500 mx-1">até</span>
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-100 font-medium" />
          </div>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 text-sm font-medium transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800 text-sm font-medium transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800/90 rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-700/80 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-300 font-medium">
            <p className="text-lg font-bold">Nenhuma programação encontrada no período</p>
            <p className="text-sm mt-1 text-gray-400 dark:text-gray-400">Adicione programações nas cargas para visualizar a previsão de demandas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200/60 dark:border-gray-700/60">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-48">Cliente</th>
                  {viewMode === "detalhado" &&
                    weekdayColumns.map((col) => (
                      <th key={col.label} className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        {col.label}
                      </th>
                    ))}
                  <th className="px-4 py-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Previsto<br />(Ton)</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Atendido<br />(Ton)</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Saldo<br />Pendente</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800/90 divide-y divide-gray-100 dark:divide-gray-700/60">
                {rows.map((row) => (
                  <tr key={row.clientId} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white">{row.clientName}</td>
                    {viewMode === "detalhado" &&
                      weekdayColumns.map((col) => {
                        const ton = col.dates.reduce((s, d) => s + (row.dailyTonnage[d] ?? 0), 0);
                        const hasSchedule = col.dates.some((d) => row.scheduledDays[d]);
                        return (
                          <td key={col.label} className="px-4 py-4 text-center text-sm">
                            {!hasSchedule ? (
                              <span className="text-gray-300 dark:text-gray-600">-</span>
                            ) : ton > 0 ? (
                              <span className="font-semibold text-blue-600 dark:text-blue-400">{ton.toLocaleString("pt-BR")}</span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">prog.</span>
                            )}
                          </td>
                        );
                      })}
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{row.previsto.toLocaleString("pt-BR")}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-sm font-bold ${row.atendido > 0 ? "text-teal-600 dark:text-teal-400" : "text-gray-400 dark:text-gray-500"}`}>
                        {row.atendido > 0 ? row.atendido.toLocaleString("pt-BR") : "0"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`text-sm font-bold px-2 py-0.5 rounded-md ${
                          row.saldo === 0
                            ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                            : row.saldo > 0
                            ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
                            : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
                        }`}
                      >
                        {fmtSaldo(row.saldo)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-900/60 border-t-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <td className="px-5 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">Total</td>
                  {viewMode === "detalhado" &&
                    weekdayTotals.map((tot, i) => (
                      <td key={i} className="px-4 py-3 text-center text-sm font-bold text-gray-700 dark:text-gray-300">
                        {tot > 0 ? tot.toLocaleString("pt-BR") : "-"}
                      </td>
                    ))}
                  <td className="px-4 py-3 text-center text-sm font-bold text-blue-600 dark:text-blue-400">{totalPrevisto.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-center text-sm font-bold text-teal-600 dark:text-teal-400">{totalAtendido.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-sm font-bold px-2 py-0.5 rounded-md ${
                        totalSaldo === 0
                          ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                          : totalSaldo > 0
                          ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
                          : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
                      }`}
                    >
                      {fmtSaldo(totalSaldo)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemandForecastReport;
