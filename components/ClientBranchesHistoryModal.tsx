import React, { useMemo, useState } from 'react';
import { X, Building2, Truck, FileText, TrendingUp, Search } from 'lucide-react';
import type { Client, Shipment, Cargo, Product } from '../types';
import { ShipmentStatus } from '../types';
import { getShipmentEffectiveDate } from '../utils';

interface ClientBranchesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  shipments: Shipment[];
  cargos: Cargo[];
  products: Product[];
  onNavigateToReports?: () => void;
  onOpenShipmentDetails?: (shipment: Shipment) => void;
}

export const ClientBranchesHistoryModal: React.FC<ClientBranchesHistoryModalProps> = ({
  isOpen,
  onClose,
  client,
  shipments,
  cargos,
  products,
  onNavigateToReports,
  onOpenShipmentDetails,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // All branches belonging to this client (Matriz + secondaryCnpjs)
  const branchesList = useMemo(() => {
    if (!client) return [];
    const list: { id: string; name: string; cnpj: string; city?: string; state?: string; isMatriz: boolean }[] = [
      {
        id: 'matriz',
        name: 'Matriz',
        cnpj: client.cnpj,
        city: client.city,
        state: client.state,
        isMatriz: true,
      }
    ];

    (client.secondaryCnpjs || []).forEach((b) => {
      list.push({
        id: b.id,
        name: b.nomeFantasia || b.razaoSocial || `Filial (${b.city || 'Secundária'})`,
        cnpj: b.cnpj,
        city: b.city,
        state: b.state,
        isMatriz: false,
      });
    });

    return list;
  }, [client]);

  // Map shipments to this client and their respective branch
  const clientShipmentsWithBranch = useMemo(() => {
    if (!client) return [];

    const result: {
      shipment: Shipment;
      cargo: Cargo;
      product?: Product;
      branchId: string;
      branchName: string;
      branchCnpj: string;
      branchCityState: string;
      isEffectiveMonth: boolean;
      effectiveDateStr: string;
    }[] = [];

    shipments.forEach(s => {
      const cargo = cargos.find(c => c.id === s.cargoId);
      if (!cargo || cargo.clientId !== client.id) return;

      const product = products.find(p => p.id === cargo.productId);

      // Determine branch
      let branchId = 'matriz';
      let branchName = 'Matriz';
      let branchCnpj = client.cnpj;
      let branchCityState = client.city ? `${client.city}/${client.state || ''}` : '-';

      const branches = client.secondaryCnpjs || [];
      let matched = undefined;
      if (cargo.clientBranchId) {
        matched = branches.find(b => b.id === cargo.clientBranchId);
      }
      if (!matched && cargo.clientCnpj) {
        const cleanCnpj = cargo.clientCnpj.replace(/\D/g, '');
        matched = branches.find(b => b.cnpj.replace(/\D/g, '') === cleanCnpj);
      }

      if (matched) {
        branchId = matched.id;
        branchName = matched.nomeFantasia || matched.razaoSocial || 'Filial';
        branchCnpj = matched.cnpj;
        branchCityState = matched.city ? `${matched.city}/${matched.state || ''}` : '-';
      }

      const effDateStr = getShipmentEffectiveDate(s);
      let isEffectiveMonth = false;
      let effectiveDateStr = s.scheduledDate || '-';

      if (effDateStr) {
        const d = new Date(effDateStr + 'T00:00:00');
        effectiveDateStr = d.toLocaleDateString('pt-BR');
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          isEffectiveMonth = true;
        }
      } else if (s.scheduledDate) {
        const [y, m] = s.scheduledDate.split('-');
        if (parseInt(y) === currentYear && parseInt(m) === currentMonth + 1) {
          isEffectiveMonth = true;
        }
      }

      result.push({
        shipment: s,
        cargo,
        product,
        branchId,
        branchName,
        branchCnpj,
        branchCityState,
        isEffectiveMonth,
        effectiveDateStr,
      });
    });

    return result;
  }, [client, shipments, cargos, products, currentMonth, currentYear]);

  // Calculate statistics per branch
  const branchStats = useMemo(() => {
    const stats: Record<string, { monthVolume: number; totalVolume: number; monthShipments: number; totalShipments: number }> = {};
    
    branchesList.forEach(b => {
      stats[b.id] = { monthVolume: 0, totalVolume: 0, monthShipments: 0, totalShipments: 0 };
    });

    clientShipmentsWithBranch.forEach(item => {
      const bId = item.branchId;
      if (!stats[bId]) {
        stats[bId] = { monthVolume: 0, totalVolume: 0, monthShipments: 0, totalShipments: 0 };
      }
      const ton = Number(item.shipment.shipmentTonnage) || 0;
      stats[bId].totalVolume += ton;
      stats[bId].totalShipments += 1;

      if (item.isEffectiveMonth) {
        stats[bId].monthVolume += ton;
        stats[bId].monthShipments += 1;
      }
    });

    return stats;
  }, [branchesList, clientShipmentsWithBranch]);

  const totalClientMonthVolume = useMemo(() => {
    return Object.values(branchStats).reduce((acc, curr) => acc + curr.monthVolume, 0);
  }, [branchStats]);

  const filteredShipments = useMemo(() => {
    return clientShipmentsWithBranch.filter(item => {
      if (selectedBranchId !== 'all' && item.branchId !== selectedBranchId) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchPlate = item.shipment.horsePlate?.toLowerCase().includes(term);
        const matchDriver = item.shipment.driverName?.toLowerCase().includes(term);
        const matchProduct = item.product?.name?.toLowerCase().includes(term);
        const matchOrigin = item.cargo.origin.toLowerCase().includes(term);
        const matchDest = item.cargo.destination.toLowerCase().includes(term);
        const matchBranch = item.branchName.toLowerCase().includes(term);
        const matchCnpj = item.branchCnpj.toLowerCase().includes(term);
        if (!matchPlate && !matchDriver && !matchProduct && !matchOrigin && !matchDest && !matchBranch && !matchCnpj) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      // Prioritize effective month and recent date
      if (a.isEffectiveMonth && !b.isEffectiveMonth) return -1;
      if (!a.isEffectiveMonth && b.isEffectiveMonth) return 1;
      return (b.shipment.id || '').localeCompare(a.shipment.id || '');
    });
  }, [clientShipmentsWithBranch, selectedBranchId, searchTerm]);

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/80 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {client.nomeFantasia || client.razaoSocial}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {branchesList.length} {branchesList.length === 1 ? 'CNPJ (Matriz)' : 'Filiais & Matriz'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Histórico detalhado e balanço de volume carregado por cada filial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToReports && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToReports();
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Relatório Completo</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-xl shadow-md">
              <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase tracking-wider mb-1">
                <span>Volume no Mês</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold">
                {totalClientMonthVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal opacity-90">ton</span>
              </div>
              <p className="text-[11px] opacity-80 mt-1">Soma de todas as filiais no mês corrente</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-4 rounded-xl shadow-md">
              <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase tracking-wider mb-1">
                <span>Embarques no Mês</span>
                <Truck className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold">
                {clientShipmentsWithBranch.filter(s => s.isEffectiveMonth).length} <span className="text-sm font-normal opacity-90">viagens</span>
              </div>
              <p className="text-[11px] opacity-80 mt-1">Total de viagens efetivadas este mês</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-xl shadow-md">
              <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase tracking-wider mb-1">
                <span>Total de Filiais Ativas</span>
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold">
                {branchesList.length} <span className="text-sm font-normal opacity-90">unidades</span>
              </div>
              <p className="text-[11px] opacity-80 mt-1">Matriz + filiais cadastradas no sistema</p>
            </div>
          </div>

          {/* Filiais Breakdown Grid */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Detalhamento por Unidade / Filial
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {branchesList.map((branch) => {
                const stats = branchStats[branch.id] || { monthVolume: 0, totalVolume: 0, monthShipments: 0, totalShipments: 0 };
                const pct = totalClientMonthVolume > 0 ? (stats.monthVolume / totalClientMonthVolume) * 100 : 0;
                const isSelected = selectedBranchId === branch.id;

                return (
                  <div
                    key={branch.id}
                    onClick={() => setSelectedBranchId(isSelected ? 'all' : branch.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-900/30 ring-2 ring-blue-500/40 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-white dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${branch.isMatriz ? 'bg-indigo-500' : 'bg-blue-500'}`} />
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                            {branch.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                          CNPJ: {branch.cnpj}
                        </p>
                      </div>
                      {branch.isMatriz && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                          Matriz
                        </span>
                      )}
                    </div>

                    {branch.city && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        📍 {branch.city}{branch.state ? ` - ${branch.state}` : ''}
                      </p>
                    )}

                    <div className="space-y-1.5 pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Volume no Mês:</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {stats.monthVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold ml-1">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-0.5">
                        <span>Viagens no Mês: {stats.monthShipments}</span>
                        <span>Total Geral: {stats.totalVolume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} t</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shipments List by Branch */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Histórico de Viagens & Embarques {selectedBranchId !== 'all' ? `(${branchesList.find(b => b.id === selectedBranchId)?.name})` : '(Todas as Filiais)'}
                </h3>
                <span className="text-xs text-gray-400 font-medium">({filteredShipments.length})</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar por placa, motorista, rota..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none w-52 sm:w-64"
                  />
                </div>

                {selectedBranchId !== 'all' && (
                  <button
                    onClick={() => setSelectedBranchId('all')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    Ver Todas
                  </button>
                )}
              </div>
            </div>

            {filteredShipments.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 text-sm">
                Nenhum embarque encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase font-bold border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3">ID / Data</th>
                        <th className="px-4 py-3">Filial Pagadora</th>
                        <th className="px-4 py-3">Produto</th>
                        <th className="px-4 py-3">Origem ➔ Destino</th>
                        <th className="px-4 py-3">Motorista / Placa</th>
                        <th className="px-4 py-3 text-right">Volume (t)</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 bg-white dark:bg-gray-800">
                      {filteredShipments.map(({ shipment, cargo, product, branchName, branchCnpj, isEffectiveMonth, effectiveDateStr }) => (
                        <tr
                          key={shipment.id}
                          onClick={() => onOpenShipmentDetails && onOpenShipmentDetails(shipment)}
                          className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 font-mono">
                            <div className="font-bold text-blue-600 dark:text-blue-400">
                              #{shipment.id.substring(0, 8)}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              {effectiveDateStr}
                              {isEffectiveMonth && (
                                <span className="ml-1 text-emerald-600 font-bold">• Mês</span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {branchName}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {branchCnpj}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                            {product?.name || 'N/A'}
                          </td>

                          <td className="px-4 py-3">
                            <div className="text-gray-900 dark:text-white font-medium">
                              {cargo.origin} ➔ {cargo.destination}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                              {shipment.driverName || 'Motorista'}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {shipment.horsePlate || '-'}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                            {Number(shipment.shipmentTonnage).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {shipment.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Dica: Clique em qualquer viagem para abrir a ficha completa do embarque.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

export default ClientBranchesHistoryModal;
