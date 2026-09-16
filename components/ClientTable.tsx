import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, Building2, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import type { Client } from '../types';

interface ClientTableProps {
  clients: Client[];
  onEdit?: (client: Client) => void;
  onDelete?: (clientId: string) => void;
}

const ClientTable: React.FC<ClientTableProps> = ({ clients, onEdit, onDelete }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      let valA = '';
      let valB = '';
      if (sortKey === 'id') { valA = a.id || ''; valB = b.id || ''; }
      else if (sortKey === 'name') { valA = a.nomeFantasia || ''; valB = b.nomeFantasia || ''; }
      else if (sortKey === 'city') { valA = a.city || ''; valB = b.city || ''; }
      else if (sortKey === 'state') { valA = a.state || ''; valB = b.state || ''; }
      const cmp = valA.localeCompare(valB, 'pt-BR', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [clients, sortKey, sortDir]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortedClients]);

  const totalPages = Math.ceil(sortedClients.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedClients = sortedClients.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  const toggleExpand = (id: string) => {
    setExpandedClientId(prev => prev === id ? null : id);
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
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
          <option value="name">Nome Fantasia</option>
          <option value="city">Cidade</option>
          <option value="state">UF</option>
        </select>
        <select
          value={sortDir}
          onChange={e => { setSortDir(e.target.value as 'asc' | 'desc'); setCurrentPage(1); }}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="asc">Crescente (A → Z)</option>
          <option value="desc">Decrescente (Z → A)</option>
        </select>
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 font-medium">
          {sortedClients.length} cliente(s) cadastrado(s)
        </span>
      </div>

      <div className="w-full overflow-hidden">
        <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-left table-fixed">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="w-[10%] px-3 py-3 text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                ID
              </th>
              <th scope="col" className="w-[26%] px-3 py-3 text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Cliente / Razão Social
              </th>
              <th scope="col" className="w-[24%] px-3 py-3 text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                CNPJs
              </th>
              <th scope="col" className="w-[14%] px-3 py-3 text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Cidade/UF
              </th>
              <th scope="col" className="w-[16%] px-3 py-3 text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Contato
              </th>
              {(onEdit || onDelete) && (
                <th scope="col" className="w-[10%] px-3 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-xs">
            {paginatedClients.map((client) => {
              const secondaryCount = (client.secondaryCnpjs || []).length;
              const isExpanded = expandedClientId === client.id;

              return (
                <React.Fragment key={client.id}>
                  <tr className="hover:bg-gray-50/80 dark:hover:bg-gray-700/60 transition-colors">
                    <td className="px-3 py-3.5 align-middle">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px]">
                        {client.id}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <div className="font-bold text-gray-900 dark:text-white truncate" title={client.nomeFantasia || client.razaoSocial}>
                        {client.nomeFantasia || client.razaoSocial}
                      </div>
                      {client.nomeFantasia && client.razaoSocial !== client.nomeFantasia && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate" title={client.razaoSocial}>
                          {client.razaoSocial}
                        </div>
                      )}
                      {client.salespersonName && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            👤 {client.salespersonName} {client.salespersonCommissionPerTon ? `• R$ ${Number(client.salespersonCommissionPerTon).toFixed(2)}/t` : ''}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-gray-800 dark:text-gray-200 font-medium">
                          {client.cnpj}
                        </span>
                        {secondaryCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(client.id)}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 hover:bg-emerald-200 transition-colors cursor-pointer"
                            title="Ver filiais vinculadas"
                          >
                            <span>+{secondaryCount} {secondaryCount === 1 ? 'filial' : 'filiais'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-middle text-gray-600 dark:text-gray-300 truncate" title={client.city ? `${client.city}/${client.state}` : '-'}>
                      {client.city ? `${client.city}/${client.state}` : '-'}
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <div className="text-gray-900 dark:text-white font-medium truncate" title={client.phone || '-'}>
                        {client.phone || '-'}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-[11px] truncate" title={client.email || '-'}>
                        {client.email || '-'}
                      </div>
                    </td>
                    {(onEdit || onDelete) && (
                      <td className="px-3 py-3.5 align-middle text-right font-medium space-x-2 whitespace-nowrap">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(client)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold"
                          >
                            Editar
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(client.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-semibold"
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* Expanded Branches Details */}
                  {isExpanded && secondaryCount > 0 && (
                    <tr className="bg-gray-50/80 dark:bg-gray-850/70">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2 shadow-xs">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                            Filiais e Unidades Vinculadas a {client.nomeFantasia || client.razaoSocial}:
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                            {/* Matriz card */}
                            <div className="p-2.5 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg text-xs">
                              <div className="flex items-center justify-between font-bold text-blue-800 dark:text-blue-300 gap-1">
                                <span className="truncate">Matriz (Principal)</span>
                                <span className="font-mono text-[11px] shrink-0">{client.cnpj}</span>
                              </div>
                              <div className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1 text-[11px] truncate">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">{client.city}/{client.state} {client.address ? `— ${client.address}` : ''}</span>
                              </div>
                            </div>

                            {/* Secondary branches */}
                            {client.secondaryCnpjs?.map((b, bIdx) => (
                              <div key={b.id || bIdx} className="p-2.5 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-650 rounded-lg text-xs">
                                <div className="flex items-center justify-between font-bold text-gray-800 dark:text-gray-200 gap-1">
                                  <span className="truncate" title={b.nomeFantasia || b.razaoSocial || `Filial #${bIdx + 1}`}>
                                    {b.nomeFantasia || b.razaoSocial || `Filial #${bIdx + 1}`}
                                  </span>
                                  <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px] shrink-0">{b.cnpj}</span>
                                </div>
                                <div className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1 text-[11px] truncate">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate" title={`${b.city || '-'}/${b.state || '-'} ${b.address ? `— ${b.address}` : ''}`}>
                                    {b.city || '-'}/{b.state || '-'} {b.address ? `— ${b.address}` : ''}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Mostrando <span className="font-medium">{(safeCurrentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(safeCurrentPage * itemsPerPage, clients.length)}</span> de <span className="font-medium">{clients.length}</span> clientes
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={safeCurrentPage === 1}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Página {safeCurrentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientTable;
