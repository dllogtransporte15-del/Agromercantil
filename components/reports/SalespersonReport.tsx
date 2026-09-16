
import React, { useMemo, useState } from 'react';
import type { Shipment, User, Cargo } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { StayRecord } from '../../utils/toolStorage';
import { calculateShipmentExpenses } from '../../utils/operationalExpensesCalculator';
import { isStayForShipment } from '../../utils';

interface SalespersonReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
  stays?: StayRecord[];
}

interface SalespersonStats {
  id: string;
  name: string;
  grossBilled: number;
  netBilled: number;
  profitMargin: number;
  totalTonnage: number;
}

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactElement, formatAsCurrency?: boolean }> = ({ title, value, icon, formatAsCurrency=false }) => {
    const displayValue = formatAsCurrency && typeof value === 'number'
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


const SalespersonReport: React.FC<SalespersonReportProps> = ({ shipments, cargos, users, stays = [] }) => {
  
  const salespersonStats = useMemo<SalespersonStats[]>(() => {
    const salespeople = users.filter(u => u.profile === UserProfile.Comercial);
    const cargoMap: Map<string, Cargo> = new Map(cargos.map(c => [c.id, c]));

    const loadedStatuses = [
        ShipmentStatus.AguardandoNota,
        ShipmentStatus.AguardandoAdiantamento,
        ShipmentStatus.AguardandoAgendamento,
        ShipmentStatus.AguardandoDescarga,
        ShipmentStatus.AguardandoPagamentoSaldo,
        ShipmentStatus.Finalizado
    ];

    return salespeople.map(salesperson => {
      const salespersonCargoIds = new Set(
          cargos.filter(c => c.createdById === salesperson.id).map(c => c.id)
      );
      
      const relevantShipments = shipments.filter(s => {
          if (!salespersonCargoIds.has(s.cargoId) || !loadedStatuses.includes(s.status)) {
              return false;
          }
          return true;
      });

      const stats = relevantShipments.reduce((acc, shipment) => {
          const cargo = cargoMap.get(shipment.cargoId);
          if (!cargo) return acc;

          const expenses = calculateShipmentExpenses(shipment, cargo);
          
          const shipmentStays = stays.filter(stay => isStayForShipment(stay, shipment));
          const demurrageRevenue = shipmentStays.reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);
          const demurrageProfit = shipmentStays.reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
              
          const profit = expenses.netProfit + demurrageProfit;
          
          acc.grossBilled += expenses.companyFreight + demurrageRevenue;
          acc.netBilled += expenses.freteLiquidoIcms;
          acc.profitMargin += profit;
          acc.totalTonnage += shipment.shipmentTonnage || 0;
          
          return acc;
      }, { grossBilled: 0, netBilled: 0, profitMargin: 0, totalTonnage: 0 });

      return {
        id: salesperson.id,
        name: salesperson.name,
        ...stats,
      };
    });
  }, [shipments, cargos, users]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Demandas Comerciais</h2>
      </div>

      {salespersonStats.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhum dado comercial encontrado para o período selecionado.
        </div>
      ) : (
        <div className="space-y-6">
          {salespersonStats.map(stats => (
            <div key={stats.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold text-primary dark:text-blue-400 mb-4">{stats.name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Valor Bruto Faturado" value={stats.grossBilled} icon={<DollarSignIcon className="w-8 h-8 text-blue-500"/>} formatAsCurrency />
                <StatCard title="Valor Líquido Faturado (-ICMS)" value={stats.netBilled} icon={<DollarSignIcon className="w-8 h-8 text-gray-500"/>} formatAsCurrency />
                <StatCard title="Lucro Operacional Estimado" value={stats.profitMargin} icon={<DollarSignIcon className="w-8 h-8 text-blue-400"/>} formatAsCurrency />
                <StatCard title="Volume Transportado" value={`${stats.totalTonnage.toLocaleString('pt-BR')} ton`} icon={<PackageIcon className="w-8 h-8 text-gray-400"/>} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalespersonReport;
