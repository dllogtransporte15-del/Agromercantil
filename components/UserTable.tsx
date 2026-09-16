
import React from 'react';
import type { User, Client } from '../types';
import { UserProfile } from '../types';
import { WhatsAppIcon } from './icons';
import { Building2, Smartphone, PhoneOff, Eye } from 'lucide-react';

interface UserTableProps {
  users: User[];
  allUsers?: User[];
  onEdit?: (user: User) => void;
  onDelete?: (userId: string) => void;
  onInspectUser?: (user: User) => void;
  clients?: Client[];
  showAppOptionColumn?: boolean;
  onToggleDriverRequests?: (user: User) => void;
}

const UserTable: React.FC<UserTableProps> = ({ users, allUsers, onEdit, onDelete, onInspectUser, clients, showAppOptionColumn = false, onToggleDriverRequests }) => {
  const getWhatsAppUrl = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const finalDigits = (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
    return `https://wa.me/${finalDigits}`;
  };

  const isInternal = (profile?: UserProfile | string) => {
    return profile !== UserProfile.Cliente && profile !== UserProfile.Motorista;
  };

  const fullUserList = allUsers || users;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-left">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="w-24 px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">ID</th>
              <th scope="col" className="px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Nome</th>
              <th scope="col" className="px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Email</th>
              <th scope="col" className="w-36 px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Telefone</th>
              <th scope="col" className="w-44 px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Perfil</th>
              <th scope="col" className="w-24 px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Status</th>
              {showAppOptionColumn && (
                <th scope="col" className="w-48 px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
                  Opção no App (Motoristas)
                </th>
              )}
              {(onEdit || onDelete || onInspectUser) && (
                <th scope="col" className="w-36 px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => {
              const agencyLeader = user.profile === UserProfile.Agenciador && user.agencyRole === 'embarque' && user.agencyLeaderId
                ? fullUserList.find(u => u.id === user.agencyLeaderId)
                : null;

              return (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {user.id}
                  </span>
                </td>
                <td className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {user.name}
                </td>
                <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px] lg:max-w-xs xl:max-w-none" title={user.email}>
                  {user.email}
                </td>
                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {user.phone ? (
                    <div className="flex items-center space-x-1.5">
                      <span>{user.phone}</span>
                      <a 
                        href={getWhatsAppUrl(user.phone)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center justify-center hover:scale-110 transition-transform text-emerald-600"
                        title="Conversar no WhatsApp"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                      </a>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600">-</span>
                  )}
                </td>
                <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white">{user.profile}</span>
                      {user.profile === UserProfile.Agenciador && (
                        user.agencyRole === 'embarque' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                            Agenciador Embarque
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                            Agenciador Líder ({user.agencyCommissionPercentage ?? 30}%)
                          </span>
                        )
                      )}
                      {user.shipperCommissionRatePerTon !== undefined && user.shipperCommissionRatePerTon > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300" title={`Comissão do Embarcador: R$ ${user.shipperCommissionRatePerTon.toFixed(2)} por tonelada`}>
                          R$ {user.shipperCommissionRatePerTon.toFixed(2)}/t
                        </span>
                      )}
                    </div>
                    {user.profile === UserProfile.Agenciador && user.agencyRole === 'embarque' && (
                      <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium truncate max-w-[170px]" title={agencyLeader ? `Vinculado ao Líder: ${agencyLeader.name}` : 'Sem líder vinculado'}>
                        ↳ Líder: {agencyLeader ? agencyLeader.name : 'Não vinculado'}
                      </span>
                    )}
                    {user.profile === UserProfile.Cliente && user.clientId && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium truncate max-w-[160px]" title={clients?.find(c => c.id === user.clientId)?.nomeFantasia || clients?.find(c => c.id === user.clientId)?.razaoSocial}>
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        {clients?.find(c => c.id === user.clientId)?.nomeFantasia || clients?.find(c => c.id === user.clientId)?.razaoSocial || `Cliente: ${user.clientId}`}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-center">
                  <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${user.active ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {user.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                {showAppOptionColumn && (
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-center">
                    {isInternal(user.profile) ? (
                      <button
                        type="button"
                        onClick={() => onToggleDriverRequests && onToggleDriverRequests(user)}
                        title={
                          user.availableForDriverRequests !== false 
                            ? 'Visível: Motoristas podem direcionar ordens a este usuário no App. Clique para desativar.' 
                            : 'Oculto: Não aparece para seleção de direcionamento no App. Clique para ativar.'
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all transform active:scale-95 shadow-sm border ${
                          user.availableForDriverRequests !== false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700'
                            : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${user.availableForDriverRequests !== false ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                        {user.availableForDriverRequests !== false ? (
                          <>
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Visível no App</span>
                          </>
                        ) : (
                          <>
                            <PhoneOff className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            <span>Oculto no App</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-600 italic">Externo</span>
                    )}
                  </td>
                )}
                {(onEdit || onDelete || onInspectUser) && (
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="inline-flex items-center justify-end gap-2.5">
                      {onInspectUser && (
                        <button
                          type="button"
                          onClick={() => onInspectUser(user)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-all shadow-sm active:scale-95"
                          title="Espelhar e Revisar Acessos do Usuário em Tempo Real"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Acessos</span>
                        </button>
                      )}
                      {onEdit && (
                        <button onClick={() => onEdit(user)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Editar</button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(user.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Excluir</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
            {users.length === 0 && (
              <tr>
                <td colSpan={((onEdit || onDelete || onInspectUser) ? 7 : 6) + (showAppOptionColumn ? 1 : 0)} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nenhum usuário encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserTable;
