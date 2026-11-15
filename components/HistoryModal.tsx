
import React from 'react';
import type { HistoryLog, User } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryLog[];
  users: User[];
  title: string;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, users, title }) => {
  if (!isOpen) return null;

  const getUserName = (userId: string) => {
    if (userId === 'system' || userId === 'sistema') return 'Sistema';
    return users.find(u => u.id === userId)?.name || 'Usuário Desconhecido';
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const visibleHistory = (history || []).filter((log) => !String(log?.id || '').startsWith('meta_'));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">{title}</h2>
        
        <div className="flex-1 overflow-y-auto pr-2">
          {visibleHistory.length > 0 ? (
            <ol className="relative border-l border-gray-200 dark:border-gray-700">
              {visibleHistory.map((log) => (
                <li key={log.id} className="mb-6 ml-4">
                  <div className="absolute w-3 h-3 bg-gray-200 rounded-full mt-1.5 -left-1.5 border border-white dark:border-gray-900 dark:bg-gray-700"></div>
                  <time className="mb-1 text-sm font-normal leading-none text-gray-400 dark:text-gray-500">
                    {formatDate(log.timestamp)} por {getUserName(log.userId)}
                  </time>
                  <p className="text-base font-normal text-gray-700 dark:text-gray-300">{log.description}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Nenhum histórico de alterações encontrado.</p>
          )}
        </div>
        
        <div className="mt-6 flex justify-end border-t dark:border-gray-700 pt-4">
          <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;