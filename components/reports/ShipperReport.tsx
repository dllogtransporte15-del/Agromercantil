
import React, { useMemo } from 'react';
import type { Shipment, User } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { TruckIcon } from '../icons/TruckIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { DollarSignIcon } from '../icons/DollarSignIcon';

interface ShipperReportProps {
  shipments: Shipment[];
  users: User[];
  currentUser: User | null;
}

interface OperatorStats {
  id: string;
  name: string;
  total: number;
  finalizado: number;
  emAndamento: number;
  cancelado: number;
  effectiveTonnage: number;
}

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactElement }> = ({ title, value, icon }) => {
    return (
        <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            {icon}
            <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
};

const ShipperReport: React.FC<ShipperReportProps> = ({ shipments, users, currentUser }) => {
    const canViewCommission = React.useMemo(() => {
        if (!currentUser) return false;
        return [UserProfile.Diretor, UserProfile.Comercial, UserProfile.Admin].includes(currentUser.profile);
    }, [currentUser]);

    const operatorStats = useMemo<OperatorStats[]>(() => {
        const creatorIds = [...new Set(shipments.map(s => s.createdById))];

        return creatorIds.map(creatorId => {
            const creator = users.find(u => u.id === creatorId);
            const creatorShipments = shipments.filter(s => s.createdById === creatorId);
          
            const stats = creatorShipments.reduce((acc, shipment) => {
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
                    ShipmentStatus.Finalizado
                ].includes(shipment.status);
                if (isEffective) {
                    acc.effectiveTonnage += shipment.shipmentTonnage || 0;
                }

                return acc;
            }, { finalizado: 0, cancelado: 0, emAndamento: 0, effectiveTonnage: 0 });
    
            return {
                id: creatorId,
                name: creator?.name || `Usuário (${creatorId})`,
                total: creatorShipments.length,
                ...stats,
            };
        }).sort((a, b) => b.total - a.total);
      }, [shipments, users]);

    return (
        <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Desempenho por Embarcador</h2>
            {operatorStats.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhum embarque encontrado para os filtros selecionados.
                </div>
            ) : (
                <div className="space-y-6">
                {operatorStats.map(stats => (
                    <div key={stats.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-bold text-primary dark:text-blue-400 mb-4">{stats.name}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatCard title="Total Embarques" value={stats.total} icon={<TruckIcon className="w-8 h-8 text-blue-500"/>} />
                        <StatCard title="Finalizados" value={stats.finalizado} icon={<CheckCircleIcon className="w-8 h-8 text-gray-500"/>} />
                        <StatCard title="Em Andamento" value={stats.emAndamento} icon={<ClockIcon className="w-8 h-8 text-blue-400"/>} />
                        <StatCard title="Cancelados" value={stats.cancelado} icon={<XCircleIcon className="w-8 h-8 text-black"/>} />
                        <StatCard title="Toneladas Efetivadas" value={`${stats.effectiveTonnage.toLocaleString('pt-BR')} t`} icon={<TruckIcon className="w-8 h-8 text-green-500"/>} />
                    </div>
                    </div>
                ))}
                </div>
            )}
        </div>
    );
};

export default ShipperReport;
