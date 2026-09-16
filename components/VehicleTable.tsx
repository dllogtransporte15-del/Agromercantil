
import React, { useState, useEffect, useMemo } from 'react';
import { History, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import type { Vehicle, Owner } from '../types';

interface VehicleTableProps {
  vehicles: Vehicle[];
  owners: Owner[];
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (vehicleId: string) => void;
  onShowHistory?: (vehicle: Vehicle) => void;
}

const VehicleTable: React.FC<VehicleTableProps> = ({ vehicles, owners, onEdit, onDelete, onShowHistory }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [sortKey, setSortKey] = useState<string>('plate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      let valA = '';
      let valB = '';
      if (sortKey === 'id') { valA = a.id || ''; valB = b.id || ''; }
      else if (sortKey === 'plate') { valA = a.plate; valB = b.plate; }
      else if (sortKey === 'type') { valA = a.setType || ''; valB = b.setType || ''; }
      else if (sortKey === 'classification') { valA = a.classification || ''; valB = b.classification || ''; }
      else if (sortKey === 'owner') { valA = getOwnerName(a.ownerId); valB = getOwnerName(b.ownerId); }
      const cmp = valA.localeCompare(valB, 'pt-BR', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [vehicles, sortKey, sortDir, owners]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortedVehicles]);

  const totalPages = Math.ceil(sortedVehicles.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedVehicles = sortedVehicles.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  const getOwnerName = (ownerId: string) => {
    return owners.find(o => o.id === ownerId)?.name || 'Desconhecido';
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      {/* Sort controls */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <ArrowUpDown className="w-4 h-4 text-gray-400" />
          <span className="font-medium">Ordenar por:</span>
        </div>
        <select
          value={sortKey}
          onChange={e => { setSortKey(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="id">ID de Registro</option>
          <option value="plate">Placa</option>
          <option value="type">Tipo</option>
          <option value="classification">Classificação</option>
          <option value="owner">Proprietário</option>
        </select>
        <select
          value={sortDir}
          onChange={e => { setSortDir(e.target.value as 'asc' | 'desc'); setCurrentPage(1); }}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="asc">Crescente (A → Z)</option>
          <option value="desc">Decrescente (Z → A)</option>
        </select>
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{sortedVehicles.length} veículos</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Placa</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Conjunto / Carroceria</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Classificação</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Proprietário</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Histórico</th>
              {(onEdit || onDelete) && <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedVehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {vehicle.id}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{vehicle.plate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="text-gray-900 dark:text-white">{vehicle.setType}</div>
                  <div className="text-gray-500 dark:text-gray-400">{vehicle.bodyType}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{vehicle.classification}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{getOwnerName(vehicle.ownerId)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  <button 
                    onClick={() => onShowHistory?.(vehicle)}
                    className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                    title="Ver Histórico"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </td>
                {(onEdit || onDelete) && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {onEdit && <button onClick={() => onEdit(vehicle)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Editar</button>}
                    {onDelete && <button onClick={() => onDelete(vehicle.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-4">Excluir</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Mostrando <span className="font-medium">{(safeCurrentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(safeCurrentPage * itemsPerPage, vehicles.length)}</span> de <span className="font-medium">{vehicles.length}</span> veículos
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={safeCurrentPage === 1}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Página {safeCurrentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={safeCurrentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleTable;
