import React from 'react';
import type { Owner, Vehicle, Driver } from '../types';
import { Truck, User, CreditCard, Edit3, Trash2, Copy, Check } from 'lucide-react';

interface OwnerTableProps {
  owners: Owner[];
  vehicles?: Vehicle[];
  drivers?: Driver[];
  onEdit?: (owner: Owner) => void;
  onDelete?: (ownerId: string) => void;
}

const OwnerTable: React.FC<OwnerTableProps> = ({ owners, vehicles = [], drivers = [], onEdit, onDelete }) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtrar registros inválidos ou vazios
  const validOwners = (owners || []).filter(o => o && (o.id || o.name || o.cpfCnpj));

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/60">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/70">
            <tr>
              <th scope="col" className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider w-32">
                ID
              </th>
              <th scope="col" className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Nome / Razão Social
              </th>
              <th scope="col" className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                CPF / CNPJ
              </th>
              <th scope="col" className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Tipo
              </th>
              <th scope="col" className="px-5 py-3.5 text-center text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Resumo de Vínculos
              </th>
              {(onEdit || onDelete) && (
                <th scope="col" className="px-5 py-3.5 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider w-36">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {validOwners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Nenhum proprietário cadastrado.</p>
                </td>
              </tr>
            ) : (
              validOwners.map((owner) => {
                const ownerId = owner.id || '';
                const linkedVehiclesCount = ownerId 
                  ? (vehicles || []).filter(v => v.ownerId === ownerId).length 
                  : 0;
                const linkedDriversCount = ownerId 
                  ? (drivers || []).filter(d => 
                      d.ownerId === ownerId || 
                      (vehicles || []).filter(v => v.ownerId === ownerId).some(v => v.driverId === d.id)
                    ).length 
                  : 0;

                return (
                  <tr 
                    key={owner.id || Math.random().toString()} 
                    onClick={() => onEdit && onEdit(owner)}
                    className="hover:bg-amber-50/40 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    {/* ID */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm">
                        <span>{owner.id || 'N/A'}</span>
                        {owner.id && (
                          <button 
                            type="button"
                            onClick={(e) => handleCopy(owner.id, e)} 
                            title="Copiar ID"
                            className="text-amber-500 hover:text-amber-800 dark:text-amber-300 dark:hover:text-white transition-colors"
                          >
                            {copiedId === owner.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Nome / Razão Social */}
                    <td className="px-5 py-4">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{owner.name || 'Sem nome'}</div>
                      {owner.phone && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                          <span>📞</span> {owner.phone}
                        </div>
                      )}
                    </td>

                    {/* CPF / CNPJ */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-semibold text-gray-700 dark:text-gray-200">
                        {owner.cpfCnpj || 'Não informado'}
                      </span>
                    </td>

                    {/* Tipo */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-full border ${
                        owner.type === 'Pessoa Jurídica' 
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                      }`}>
                        {owner.type || 'Pessoa Física'}
                      </span>
                    </td>

                    {/* Resumo de Vínculos */}
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center gap-2">
                        <span 
                          title={`${linkedVehiclesCount} veículo(s) vinculado(s)`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600"
                        >
                          <Truck className="w-3.5 h-3.5 text-gray-500" />
                          <span>{linkedVehiclesCount} veíc.</span>
                        </span>
                        <span 
                          title={`${linkedDriversCount} motorista(s) vinculado(s)`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                        >
                          <User className="w-3.5 h-3.5 text-amber-500" />
                          <span>{linkedDriversCount} mot.</span>
                        </span>
                      </div>
                    </td>

                    {/* Ações */}
                    {(onEdit || onDelete) && (
                      <td className="px-5 py-4 whitespace-nowrap text-right text-xs font-bold space-x-2" onClick={(e) => e.stopPropagation()}>
                        {onEdit && (
                          <button 
                            type="button"
                            onClick={() => onEdit(owner)} 
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/60 dark:text-amber-300 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Abrir Cadastro</span>
                          </button>
                        )}
                        {onDelete && (
                          <button 
                            type="button"
                            onClick={() => onDelete(owner.id)} 
                            className="inline-flex items-center p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Excluir proprietário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OwnerTable;
