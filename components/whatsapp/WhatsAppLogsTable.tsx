import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  CheckCheck, 
  Check, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Paperclip, 
  Eye, 
  PhoneCall,
  User,
  ArrowUpRight,
  ShieldAlert,
  Calendar,
  Trash2
} from 'lucide-react';
import type { WhatsAppQueueItem, WhatsAppQueueStatus } from '../../types/whatsapp';
import { 
  formatDisplayPhone, 
  retryFailedQueueItem, 
  processQueueItemImmediately, 
  deleteQueueItem, 
  clearWhatsAppQueue 
} from '../../services/whatsappService';

interface WhatsAppLogsTableProps {
  queue: WhatsAppQueueItem[];
  onReload: () => void;
}

export const WhatsAppLogsTable: React.FC<WhatsAppLogsTableProps> = ({
  queue,
  onReload
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppQueueItem | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const filteredQueue = queue.filter(item => {
    const matchesSearch = 
      item.recipient_phone.includes(searchTerm) ||
      (item.recipient_name && item.recipient_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.rendered_body.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await retryFailedQueueItem(id);
      await processQueueItemImmediately(id);
      onReload();
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja excluir este registro de mensagem?')) return;
    setDeletingId(id);
    try {
      await deleteQueueItem(id);
      onReload();
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Deseja realmente limpar todo o histórico de mensagens e fila do WhatsApp?')) return;
    setClearing(true);
    try {
      await clearWhatsAppQueue();
      onReload();
    } finally {
      setClearing(false);
    }
  };

  const getStatusBadge = (status: WhatsAppQueueStatus) => {
    switch (status) {
      case 'read':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
            Lida
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
            Entregue
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Check className="w-3.5 h-3.5 text-slate-500" />
            Enviada
          </span>
        );
      case 'pending':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
            Na Fila
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Falha
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* BARRA DE FILTROS E BUSCA */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por telefone, motorista ou conteúdo..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Na Fila (Pendente)</option>
            <option value="sent">Enviadas</option>
            <option value="delivered">Entregues</option>
            <option value="read">Lidas (Azul)</option>
            <option value="failed">Falhas</option>
          </select>

          <button
            type="button"
            onClick={onReload}
            className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
            title="Atualizar Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {queue.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={clearing}
              className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Excluir todas as mensagens da fila"
            >
              <Trash2 className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
              <span>{clearing ? 'Limpando...' : 'Limpar Logs'}</span>
            </button>
          )}
        </div>
      </div>

      {/* TABELA DE REGISTROS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Data / Horário</th>
                <th className="py-3.5 px-4">Destinatário</th>
                <th className="py-3.5 px-4">Mensagem & Anexo</th>
                <th className="py-3.5 px-4">Status de Entrega</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Nenhuma mensagem localizada nos logs.
                  </td>
                </tr>
              ) : (
                filteredQueue.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-500" />
                        <span>{item.recipient_name || 'Destinatário'}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {formatDisplayPhone(item.recipient_phone)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate">
                      <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                        {item.rendered_body.replace(/\n/g, ' ')}
                      </p>
                      {item.media_filename && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                          <Paperclip className="w-3 h-3" />
                          {item.media_filename}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(item.status)}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedMessage(item)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                          title="Visualizar Mensagem Completa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {item.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetry(item.id)}
                            disabled={retryingId === item.id}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900 text-[10px] font-black border border-rose-200 dark:border-rose-800 flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${retryingId === item.id ? 'animate-spin' : ''}`} />
                            <span>Reenviar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALHAMENTO DA MENSAGEM */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Detalhes do Disparo de WhatsApp
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID: <span className="font-mono">{selectedMessage.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-bold text-slate-500 uppercase">Destinatário:</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {selectedMessage.recipient_name} ({formatDisplayPhone(selectedMessage.recipient_phone)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-500 uppercase">Status:</span>
                <span>{getStatusBadge(selectedMessage.status)}</span>
              </div>
              {selectedMessage.external_message_id && (
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500 uppercase">WhatsApp WAMID:</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-xs">
                    {selectedMessage.external_message_id}
                  </span>
                </div>
              )}
            </div>

            <div>
              <span className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                Conteúdo Transmitido:
              </span>
              <div className="p-4 rounded-2xl bg-[#0b141a] text-white text-xs font-mono whitespace-pre-wrap leading-relaxed border border-slate-800">
                {selectedMessage.rendered_body}
              </div>
            </div>

            {selectedMessage.media_filename && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                <Paperclip className="w-4 h-4 text-emerald-500" />
                <span>Arquivo Anexado: <strong>{selectedMessage.media_filename}</strong></span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
