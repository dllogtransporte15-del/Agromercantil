
import React from 'react';
import type { Embarcador } from '../types';

interface ArmadorTableProps {
  armadores: Embarcador[];
  onEdit: (armador: Embarcador) => void;
  onDelete: (armadorId: string) => void;
}

const ArmadorTable: React.FC<ArmadorTableProps> = ({ armadores, onEdit, onDelete }) => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
                Nome
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {armadores.map((armador) => (
              <tr key={armador.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{armador.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => onEdit(armador)} className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300">
                    Editar
                  </button>
                  <button onClick={() => onDelete(armador.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-4">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArmadorTable;
