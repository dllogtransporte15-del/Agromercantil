
import React from 'react';
import type { Embarcador } from '../types';

interface EmbarcadorTableProps {
  embarcadores: Embarcador[];
  onEdit?: (embarcador: Embarcador) => void;
  onDelete?: (embarcadorId: string) => void;
}

const EmbarcadorTable: React.FC<EmbarcadorTableProps> = ({ embarcadores, onEdit, onDelete }) => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
                Nome
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
                Comissão (R$/ton)
              </th>
              {(onEdit || onDelete) && (
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {embarcadores.map((embarcador) => (
              <tr key={embarcador.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{embarcador.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {embarcador.shipperCommissionRatePerTon ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-mono">
                      R$ {embarcador.shipperCommissionRatePerTon.toFixed(2)}/t
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Padrão (R$ 0,00)</span>
                  )}
                </td>
                {(onEdit || onDelete) && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {onEdit && (
                      <button onClick={() => onEdit(embarcador)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                        Editar
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(embarcador.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-4">
                        Excluir
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmbarcadorTable;
