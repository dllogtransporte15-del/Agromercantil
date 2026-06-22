import React, { useState, useMemo } from 'react';
import type { Cargo, Shipment, Client } from '../../types';
import { ShipmentStatus } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Download, Calendar } from 'lucide-react';

interface DemandForecastReportProps {
  cargos: Cargo[];
  shipments: Shipment[];
  clients: Client[];
}

const DemandForecastReport: React.FC<DemandForecastReportProps> = ({ cargos, shipments, clients }) => {
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  // Configurar semana atual como padrão (Domingo a Sábado)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day); // Domingo
    return d.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day)); // Sábado
    return d.toISOString().split('T')[0];
  });

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.nomeFantasia || 'Cliente Desconhecido';
  };

  const reportData = useMemo(() => {
    const dataByClient: Record<string, { summaryPlanned: number; detailedPlanned: number; actual: number; dailyPlanned: number[] }> = {};

    // Initialize ALL clients to ensure everyone appears in the list
    clients.forEach(client => {
      dataByClient[client.nomeFantasia] = { summaryPlanned: 0, detailedPlanned: 0, actual: 0, dailyPlanned: [0, 0, 0, 0, 0, 0, 0] };
    });

    const validStatuses = [
      ShipmentStatus.AguardandoCarregamento,
      ShipmentStatus.AguardandoNota,
      ShipmentStatus.AguardandoAdiantamento,
      ShipmentStatus.AguardandoAgendamento,
      ShipmentStatus.AguardandoDescarga,
      ShipmentStatus.AguardandoPagamentoSaldo,
      ShipmentStatus.Finalizado
    ];

    // 1. Calcular Demanda Prevista (Planejada)
    cargos.forEach(cargo => {
      const clientName = getClientName(cargo.clientId);
      if (!dataByClient[clientName]) {
        dataByClient[clientName] = { summaryPlanned: 0, detailedPlanned: 0, actual: 0, dailyPlanned: [0, 0, 0, 0, 0, 0, 0] };
      }

      let cargoWeeklyPlanned = 0;

      if (cargo.dailySchedule && Array.isArray(cargo.dailySchedule)) {
         cargo.dailySchedule.forEach(schedule => {
           if (schedule.date >= startDate && schedule.date <= endDate) {
             const [y, m, d] = schedule.date.split('-').map(Number);
             const dateObj = new Date(y, m - 1, d);
             const dayOfWeek = dateObj.getDay();
             const amount = schedule.tonnage || 0;
             
             dataByClient[clientName].dailyPlanned[dayOfWeek] += amount;
             cargoWeeklyPlanned += amount;
           }
         });
      }

      dataByClient[clientName].detailedPlanned += cargoWeeklyPlanned;
      dataByClient[clientName].summaryPlanned += cargoWeeklyPlanned;
    });

    // (validStatuses já definidos acima)

    shipments.forEach(shipment => {
      // Usar a scheduledDate (data em que o embarque foi planejado para carregar) para contar como "atendido" nesta semana.
      if (shipment.scheduledDate >= startDate && shipment.scheduledDate <= endDate) {
        if (validStatuses.includes(shipment.status)) {
          const cargo = cargos.find(c => c.id === shipment.cargoId);
          if (cargo) {
            const clientName = getClientName(cargo.clientId);
            if (!dataByClient[clientName]) {
              dataByClient[clientName] = { summaryPlanned: 0, detailedPlanned: 0, actual: 0, dailyPlanned: [0, 0, 0, 0, 0, 0, 0] };
            }
            dataByClient[clientName].actual += shipment.shipmentTonnage || 0;
          }
        }
      }
    });

    // Transformar em array para renderizar e ordenar
    return Object.entries(dataByClient)
      .map(([client, stats]) => {
        const planned = viewMode === 'summary' ? stats.summaryPlanned : stats.detailedPlanned;
        return {
          client,
          summaryPlanned: stats.summaryPlanned,
          detailedPlanned: stats.detailedPlanned,
          dailyPlanned: stats.dailyPlanned,
          planned: planned,
          actual: stats.actual,
          difference: planned - stats.actual
        };
      })
      .sort((a, b) => b.planned - a.planned);

  }, [cargos, shipments, clients, startDate, endDate, viewMode]);

  const totalPlanned = reportData.reduce((sum, item) => sum + item.planned, 0);
  const totalActual = reportData.reduce((sum, item) => sum + item.actual, 0);
  const totalDifference = totalPlanned - totalActual;

  const exportPDF = () => {
    const doc = new jsPDF(viewMode === 'detailed' ? 'landscape' : 'portrait');
    const title = `Relatório de Previsão de Demandas (${viewMode === 'summary' ? 'Resumo' : 'Detalhado'}) (${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')})`;
    
    doc.setFontSize(16);
    doc.text(title, 14, 20);

    let tableColumn = [];
    let tableRows = [];

    if (viewMode === 'summary') {
      tableColumn = ["Cliente", "Previsto (ton)", "Atendido (ton)", "Saldo Pendente (ton)"];
      tableRows = reportData.map(item => [
        item.client,
        item.planned.toLocaleString('pt-BR'),
        item.actual.toLocaleString('pt-BR'),
        item.difference.toLocaleString('pt-BR')
      ]);
      tableRows.push([
        "TOTAL GERAL",
        totalPlanned.toLocaleString('pt-BR'),
        totalActual.toLocaleString('pt-BR'),
        totalDifference.toLocaleString('pt-BR')
      ]);
    } else {
      tableColumn = ["Cliente", "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Previsto (ton)", "Atendido (ton)", "Saldo Pendente"];
      tableRows = reportData.map(item => [
        item.client,
        item.dailyPlanned[0].toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        item.dailyPlanned[1].toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        item.dailyPlanned[2].toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        item.dailyPlanned[3].toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        item.dailyPlanned[4].toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        item.dailyPlanned[5].toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        item.dailyPlanned[6].toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        item.planned.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        item.actual.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        item.difference.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
      ]);
      
      const totalSun = reportData.reduce((sum, item) => sum + item.dailyPlanned[0], 0);
      const totalMon = reportData.reduce((sum, item) => sum + item.dailyPlanned[1], 0);
      const totalTue = reportData.reduce((sum, item) => sum + item.dailyPlanned[2], 0);
      const totalWed = reportData.reduce((sum, item) => sum + item.dailyPlanned[3], 0);
      const totalThu = reportData.reduce((sum, item) => sum + item.dailyPlanned[4], 0);
      const totalFri = reportData.reduce((sum, item) => sum + item.dailyPlanned[5], 0);
      const totalSat = reportData.reduce((sum, item) => sum + item.dailyPlanned[6], 0);

      tableRows.push([
        "TOTAL GERAL",
        totalSun.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        totalMon.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        totalTue.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        totalWed.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        totalThu.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        totalFri.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        totalSat.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        totalPlanned.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        totalActual.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        totalDifference.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
      ]);
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
      styles: { fontSize: viewMode === 'detailed' ? 8 : 10 }
    });

    doc.save(`previsao_demandas_${viewMode}_${startDate}_a_${endDate}.pdf`);
  };

  const exportExcel = () => {
    const rows = [];
    
    if (viewMode === 'summary') {
      rows.push(["Cliente", "Previsto (ton)", "Atendido (ton)", "Saldo Pendente (ton)"]);
      reportData.forEach(item => {
        rows.push([item.client, item.planned, item.actual, item.difference]);
      });
      rows.push(["TOTAL GERAL", totalPlanned, totalActual, totalDifference]);
    } else {
      rows.push(["Cliente", "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Previsto (ton)", "Atendido (ton)", "Saldo Pendente (ton)"]);
      reportData.forEach(item => {
        rows.push([
          item.client,
          item.dailyPlanned[0].toFixed(1),
          item.dailyPlanned[1].toFixed(1),
          item.dailyPlanned[2].toFixed(1),
          item.dailyPlanned[3].toFixed(1),
          item.dailyPlanned[4].toFixed(1),
          item.dailyPlanned[5].toFixed(1),
          item.dailyPlanned[6].toFixed(1),
          item.planned.toFixed(1),
          item.actual.toFixed(1),
          item.difference.toFixed(1)
        ]);
      });
      
      const totalSun = reportData.reduce((sum, item) => sum + item.dailyPlanned[0], 0);
      const totalMon = reportData.reduce((sum, item) => sum + item.dailyPlanned[1], 0);
      const totalTue = reportData.reduce((sum, item) => sum + item.dailyPlanned[2], 0);
      const totalWed = reportData.reduce((sum, item) => sum + item.dailyPlanned[3], 0);
      const totalThu = reportData.reduce((sum, item) => sum + item.dailyPlanned[4], 0);
      const totalFri = reportData.reduce((sum, item) => sum + item.dailyPlanned[5], 0);
      const totalSat = reportData.reduce((sum, item) => sum + item.dailyPlanned[6], 0);

      rows.push([
        "TOTAL GERAL",
        totalSun.toFixed(1), totalMon.toFixed(1), totalTue.toFixed(1), totalWed.toFixed(1), totalThu.toFixed(1), totalFri.toFixed(1), totalSat.toFixed(1),
        totalPlanned.toFixed(1), totalActual.toFixed(1), totalDifference.toFixed(1)
      ]);
    }

    const csvContent = "\uFEFF" + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `previsao_demandas_${viewMode}_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Previsão de Demandas</h2>
          <p className="text-sm text-gray-500">Planejado (Tons) vs Atendido na Semana</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'summary' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Resumo
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'detailed' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Detalhado
            </button>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-sm font-medium outline-none text-gray-700 dark:text-gray-200" 
            />
            <span className="text-gray-400">até</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-sm font-medium outline-none text-gray-700 dark:text-gray-200" 
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={exportPDF}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-md transition-colors text-sm font-medium"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
            <button 
              onClick={exportExcel}
              className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 rounded-md transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-6 py-4 rounded-tl-lg">Cliente</th>
              {viewMode === 'detailed' && (
                <>
                  <th className="px-4 py-4 text-right">Dom</th>
                  <th className="px-4 py-4 text-right">Seg</th>
                  <th className="px-4 py-4 text-right">Ter</th>
                  <th className="px-4 py-4 text-right">Qua</th>
                  <th className="px-4 py-4 text-right">Qui</th>
                  <th className="px-4 py-4 text-right">Sex</th>
                  <th className="px-4 py-4 text-right">Sáb</th>
                </>
              )}
              <th className="px-6 py-4 text-right">Previsto (ton)</th>
              <th className="px-6 py-4 text-right">Atendido (ton)</th>
              <th className="px-6 py-4 text-right rounded-tr-lg">Saldo Pendente</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">{item.client}</td>
                {viewMode === 'detailed' && (
                  <>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{item.dailyPlanned[0] > 0 ? item.dailyPlanned[0].toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-'}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{item.dailyPlanned[1] > 0 ? item.dailyPlanned[1].toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-'}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{item.dailyPlanned[2] > 0 ? item.dailyPlanned[2].toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-'}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{item.dailyPlanned[3] > 0 ? item.dailyPlanned[3].toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-'}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{item.dailyPlanned[4] > 0 ? item.dailyPlanned[4].toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-'}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{item.dailyPlanned[5] > 0 ? item.dailyPlanned[5].toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-'}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{item.dailyPlanned[6] > 0 ? item.dailyPlanned[6].toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-'}</td>
                  </>
                )}
                <td className="px-6 py-4 text-right font-medium text-blue-600 dark:text-blue-400">{item.planned.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                <td className="px-6 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{item.actual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    item.difference > 0 
                      ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' 
                      : item.difference < 0 
                        ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {item.difference > 0 ? '+' : ''}{item.difference.toLocaleString('pt-BR')}
                  </span>
                </td>
              </tr>
            ))}
            
            {reportData.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 italic">
                  Nenhuma previsão ou embarque encontrado para esta semana.
                </td>
              </tr>
            )}
          </tbody>
          {reportData.length > 0 && (
            <tfoot className="bg-gray-50 dark:bg-gray-700/50 font-bold">
              <tr>
                <td className="px-6 py-4 text-gray-800 dark:text-gray-200">TOTAL GERAL</td>
                {viewMode === 'detailed' && (
                  <>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{reportData.reduce((sum, item) => sum + item.dailyPlanned[0], 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{reportData.reduce((sum, item) => sum + item.dailyPlanned[1], 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{reportData.reduce((sum, item) => sum + item.dailyPlanned[2], 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{reportData.reduce((sum, item) => sum + item.dailyPlanned[3], 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{reportData.reduce((sum, item) => sum + item.dailyPlanned[4], 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{reportData.reduce((sum, item) => sum + item.dailyPlanned[5], 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300">{reportData.reduce((sum, item) => sum + item.dailyPlanned[6], 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  </>
                )}
                <td className="px-6 py-4 text-right text-blue-700 dark:text-blue-300">{totalPlanned.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                <td className="px-6 py-4 text-right text-emerald-700 dark:text-emerald-300">{totalActual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`text-sm ${totalDifference > 0 ? 'text-yellow-600' : totalDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalDifference > 0 ? '+' : ''}{totalDifference.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default DemandForecastReport;
