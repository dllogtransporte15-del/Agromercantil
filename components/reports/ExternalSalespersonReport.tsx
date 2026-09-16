
import React, { useMemo } from 'react';
import type { Shipment, Cargo, Client } from '../../types';
import { ShipmentStatus } from '../../types';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { UsersIcon } from '../icons/UsersIcon';

interface ExternalSalespersonReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  clients?: Client[];
}

interface ExternalSalespersonStats {
  name: string;
  totalCommission: number;
  totalTonnage: number;
  shipmentCount: number;
  cargoCount: number;
}

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactElement, formatAsCurrency?: boolean }> = ({ title, value, icon, formatAsCurrency=false }) => {
    const displayValue = formatAsCurrency && typeof value === 'number'
        ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : value;

    return (
        <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/60 rounded-xl shadow-xs border border-gray-100 dark:border-gray-600/50">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-100 dark:border-gray-700/50 flex-shrink-0">
                {icon}
            </div>
            <div className="ml-3 min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-300 truncate">{title}</p>
                <p className="text-lg font-black text-gray-900 dark:text-white truncate">{displayValue}</p>
            </div>
        </div>
    );
};

const ExternalSalespersonReport: React.FC<ExternalSalespersonReportProps> = ({ shipments, cargos, clients = [] }) => {
  
  const statsList = useMemo<ExternalSalespersonStats[]>(() => {
    const cargoMap: Map<string, Cargo> = new Map(cargos.map(c => [c.id, c]));
    const clientMap: Map<string, Client> = new Map(clients.map(cl => [cl.id, cl]));
    const loadedStatuses = [
        ShipmentStatus.AguardandoNota,
        ShipmentStatus.AguardandoAdiantamento,
        ShipmentStatus.AguardandoAgendamento,
        ShipmentStatus.AguardandoDescarga,
        ShipmentStatus.AguardandoPagamentoSaldo,
        ShipmentStatus.Finalizado
    ];

    const statsMap = new Map<string, ExternalSalespersonStats>();

    shipments.forEach(shipment => {
        if (!loadedStatuses.includes(shipment.status)) return;
        
        const cargo = cargoMap.get(shipment.cargoId);
        if (!cargo) return;

        const parentClient = clientMap.get(cargo.clientId);
        const name = cargo.salespersonName || parentClient?.salespersonName;
        const rate = (cargo.salespersonCommissionPerTon !== undefined && cargo.salespersonCommissionPerTon > 0)
          ? cargo.salespersonCommissionPerTon
          : (parentClient?.salespersonCommissionPerTon || 0);

        if (!name || !rate || rate <= 0) return;

        const commission = shipment.shipmentTonnage * rate;

        const current = statsMap.get(name) || {
            name,
            totalCommission: 0,
            totalTonnage: 0,
            shipmentCount: 0,
            cargoCount: 0
        };

        const uniqueCargosForThisPerson = new Set(
            shipments
                .filter(s => {
                    const c = cargoMap.get(s.cargoId);
                    const cl = c ? clientMap.get(c.clientId) : undefined;
                    const cName = c?.salespersonName || cl?.salespersonName;
                    return cName === name;
                })
                .map(s => s.cargoId)
        );

        statsMap.set(name, {
            ...current,
            totalCommission: current.totalCommission + commission,
            totalTonnage: current.totalTonnage + shipment.shipmentTonnage,
            shipmentCount: current.shipmentCount + 1,
            cargoCount: uniqueCargosForThisPerson.size
        });
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalCommission - a.totalCommission);
  }, [shipments, cargos, clients]);

  const totals = useMemo(() => {
      return statsList.reduce((acc, curr) => ({
          commission: acc.commission + curr.totalCommission,
          tonnage: acc.tonnage + curr.totalTonnage,
          people: acc.people + 1
      }), { commission: 0, tonnage: 0, people: 0 });
  }, [statsList]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-lg border border-primary/20">
              <p className="text-xs font-bold text-primary dark:text-blue-400 uppercase tracking-wider mb-1">Total em Comissões</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{totals.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Volume Total Carregado</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{totals.tonnage.toLocaleString('pt-BR')} <span className="text-sm font-normal">ton</span></p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total de Vendedores</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{totals.people}</p>
          </div>
      </div>

      {statsList.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
            <UsersIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">Nenhuma comissão de vendedor externo para exibir.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">As comissões aparecem aqui quando uma carga possui vendedor vinculado e seus embarques são carregados.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {statsList.map(stats => (
            <div key={stats.name} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-l-4 border-primary pl-4">{stats.name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Total a Pagar" 
                    value={stats.totalCommission} 
                    icon={<DollarSignIcon className="w-6 h-6 text-green-500"/>} 
                    formatAsCurrency 
                />
                <StatCard 
                    title="Volume Carregado" 
                    value={`${stats.totalTonnage.toLocaleString('pt-BR')} ton`} 
                    icon={<PackageIcon className="w-6 h-6 text-blue-500"/>} 
                />
                <StatCard 
                    title="Embarques" 
                    value={stats.shipmentCount} 
                    icon={<PackageIcon className="w-6 h-6 text-gray-400"/>} 
                />
                <StatCard 
                    title="Cargas Atendidas" 
                    value={stats.cargoCount} 
                    icon={<UsersIcon className="w-6 h-6 text-gray-400"/>} 
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExternalSalespersonReport;
