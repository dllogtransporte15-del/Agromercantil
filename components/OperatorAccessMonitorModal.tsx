import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Activity,
  Users,
  Clock,
  RefreshCw,
  Search,
  LogIn,
  LogOut,
  Monitor,
  Wifi,
  WifiOff,
  Calendar
} from 'lucide-react';
import type { User } from '../types';
import { UserProfile } from '../types';
import {
  fetchAccessMonitorData,
  OnlineOperatorPresence,
  UserAccessLog
} from '../services/accessMonitorService';

interface OperatorAccessMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onlineOperators: Record<string, OnlineOperatorPresence>;
}

const EVENT_LABELS: Record<UserAccessLog['eventType'], { label: string; colorClass: string; icon: React.ElementType }> = {
  login: {
    label: 'Login Realizado',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
    icon: LogIn
  },
  session_start: {
    label: 'Sessão Ativa',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
    icon: Monitor
  },
  logout: {
    label: 'Logout / Saída',
    colorClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
    icon: LogOut
  }
};

function formatDateTime(iso?: string): string {
  if (!iso) return 'Sem registro';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return iso;
  }
}

export const OperatorAccessMonitorModal: React.FC<OperatorAccessMonitorModalProps> = ({
  isOpen,
  onClose,
  users,
  onlineOperators
}) => {
  const [activeTab, setActiveTab] = useState<'online' | 'history'>('online');
  const [logs, setLogs] = useState<UserAccessLog[]>([]);
  const [lastAccessByUser, setLastAccessByUser] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | UserAccessLog['eventType']>('all');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const store = await fetchAccessMonitorData();
      setLogs(store.logs);
      setLastAccessByUser(store.lastAccessByUser);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadData();
    const handler = (e: any) => {
      if (e?.detail) {
        setLogs(e.detail.logs || []);
        setLastAccessByUser(e.detail.lastAccessByUser || {});
      }
    };
    window.addEventListener('operator_access_logs_updated', handler);
    return () => window.removeEventListener('operator_access_logs_updated', handler);
  }, [isOpen]);

  const internalOperators = useMemo(() => {
    return users.filter(
      (u) =>
        u.profile !== UserProfile.Cliente &&
        u.profile !== UserProfile.Motorista &&
        u.profile !== UserProfile.Aluno
    );
  }, [users]);

  const sortedOperators = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return internalOperators
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          String(u.profile).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aOnline = Boolean(onlineOperators[a.id]);
        const bOnline = Boolean(onlineOperators[b.id]);
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        const aLast = lastAccessByUser[a.id] ? new Date(lastAccessByUser[a.id]).getTime() : 0;
        const bLast = lastAccessByUser[b.id] ? new Date(lastAccessByUser[b.id]).getTime() : 0;
        return bLast - aLast;
      });
  }, [internalOperators, onlineOperators, lastAccessByUser, searchTerm]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      if (eventFilter !== 'all' && log.eventType !== eventFilter) return false;
      if (!q) return true;
      return (
        log.userName.toLowerCase().includes(q) ||
        log.userEmail.toLowerCase().includes(q) ||
        String(log.userProfile).toLowerCase().includes(q) ||
        log.device.toLowerCase().includes(q)
      );
    });
  }, [logs, eventFilter, searchTerm]);

  const onlineCount = useMemo(
    () => internalOperators.filter((u) => Boolean(onlineOperators[u.id])).length,
    [internalOperators, onlineOperators]
  );

  const todayCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return logs.filter((l) => l.timestamp.startsWith(todayStr)).length;
  }, [logs]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Monitor de Acessos dos Operadores
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Presença em tempo real (Online / Offline) e histórico detalhado de acessos com data e hora
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
          <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800/50">
            <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Online Agora
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {onlineCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              Operadores Internos
            </div>
            <div className="text-2xl font-black text-gray-800 dark:text-white mt-1">
              {internalOperators.length}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              Eventos Hoje
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {todayCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Registros Salvos
            </div>
            <div className="text-2xl font-black text-gray-800 dark:text-white mt-1">
              {logs.length}
            </div>
          </div>
        </div>

        {/* Tabs & Search */}
        <div className="px-5 pt-3 pb-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('online')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'online'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Status em Tempo Real ({onlineCount} online)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Histórico de Acessos ({logs.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'history' && (
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200"
              >
                <option value="all">Todos os eventos</option>
                <option value="login">Login Realizado</option>
                <option value="session_start">Sessão Ativa</option>
                <option value="logout">Logout / Saída</option>
              </select>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar operador, e-mail ou perfil..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-100 w-56 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'online' ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/90 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Operador</th>
                    <th className="px-4 py-3">Perfil</th>
                    <th className="px-4 py-3">Tela / Dispositivo</th>
                    <th className="px-4 py-3">Último Acesso (Data e Hora)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                  {sortedOperators.map((op) => {
                    const presence = onlineOperators[op.id];
                    const isOnline = Boolean(presence);
                    const lastAccess = presence?.onlineAt || lastAccessByUser[op.id];
                    return (
                      <tr key={op.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                              <WifiOff className="w-3 h-3" />
                              Offline
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900 dark:text-white">{op.name}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">{op.email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                          {op.profile}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {isOnline ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                                {presence.currentPage || 'Sistema Ativo'}
                              </div>
                              <div className="text-[10px] text-gray-400">{presence.device || 'Web'}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-gray-700 dark:text-gray-300">
                          {formatDateTime(lastAccess)}
                        </td>
                      </tr>
                    );
                  })}
                  {sortedOperators.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                        Nenhum operador encontrado para o filtro informado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/90 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Data e Hora</th>
                    <th className="px-4 py-3">Operador</th>
                    <th className="px-4 py-3">Perfil</th>
                    <th className="px-4 py-3">Evento</th>
                    <th className="px-4 py-3">Dispositivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                  {filteredLogs.map((log) => {
                    const meta = EVENT_LABELS[log.eventType] || EVENT_LABELS.session_start;
                    const IconComp = meta.icon;
                    return (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900 dark:text-white">{log.userName}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">{log.userEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                          {log.userProfile}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${meta.colorClass}`}>
                            <IconComp className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-[11px]">
                          {log.device}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                        Nenhum registro de acesso encontrado ainda. Novos logins e sessões serão registrados automaticamente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OperatorAccessMonitorModal;
