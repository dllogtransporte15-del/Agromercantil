import React, { useMemo } from 'react';
import type { Shipment, User, Cargo } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { UsersIcon } from '../icons/UsersIcon';

interface CoordenadorReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
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

const CoordenadorReport: React.FC<CoordenadorReportProps> = ({ shipments, cargos, users }) => {
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

  const totalProfitMargin = useMemo(() => {
    return shipments.reduce((acc, s) => {
      const countableStatuses = [
        ShipmentStatus.AguardandoNota,
        ShipmentStatus.AguardandoAdiantamento,
        ShipmentStatus.AguardandoAgendamento,
        ShipmentStatus.AguardandoDescarga,
        ShipmentStatus.AguardandoPagamentoSaldo,
        ShipmentStatus.Finalizado
      ];
      if (!countableStatuses.includes(s.status)) return acc;
      
      const cargo = cargoMap.get(s.cargoId);
      if (!cargo) return acc;

      const grossRate = s.companyFreightRateSnapshot || cargo.companyFreightValuePerTon;
      const driverRate = s.driverFreightRateSnapshot || cargo.driverFreightValuePerTon;
      const profit = (grossRate - driverRate) * s.shipmentTonnage;
      
      return acc + profit;
    }, 0);
  }, [shipments, cargoMap]);

  const coordenadores = useMemo(() => {
    return users.filter(u => u.profile === UserProfile.Coordenador);
  }, [users]);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Relatório Coordenação</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <StatCard 
            title="Margem de Lucro Total (Período)" 
            value={totalProfitMargin} 
            icon={<DollarSignIcon className="w-8 h-8 text-blue-500"/>} 
            formatAsCurrency 
          />
      </div>

      {coordenadores.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhum coordenador encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Comissões por Coordenador</h3>
          <div className="grid grid-cols-1 gap-4">
            {coordenadores.map(coordenador => (
              <div key={coordenador.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-4">
                        <UsersIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white">{coordenador.name}</p>
                        <p className="text-sm text-gray-500">Perfil: Coordenador</p>
                    </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordenadorReport;
