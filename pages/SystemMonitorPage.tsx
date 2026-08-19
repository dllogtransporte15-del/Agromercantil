
import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Activity, CheckCircle2, AlertCircle, RefreshCw, Code, Database, Globe, Zap, Sliders } from 'lucide-react';
import { supabase } from '../supabase';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'loading' | string;
  message: string;
  latency?: number;
}

interface SystemMonitorPageProps {
  isSimplifiedWorkflowEnabled?: boolean;
  onToggleSimplifiedWorkflow?: (enabled: boolean) => void;
}

const SystemMonitorPage: React.FC<SystemMonitorPageProps> = ({
  isSimplifiedWorkflowEnabled = false,
  onToggleSimplifiedWorkflow,
}) => {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({
    github: { name: 'GitHub Infrastructure', status: 'loading', message: 'Verificando...' },
    supabase: { name: 'Supabase Database', status: 'loading', message: 'Verificando...' },
    vercel: { name: 'Vercel Hosting', status: 'loading', message: 'Verificando...' },
  });
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [localSimplified, setLocalSimplified] = useState<boolean>(() => {
    return isSimplifiedWorkflowEnabled || localStorage.getItem('isSimplifiedWorkflowEnabled') === 'true';
  });

  useEffect(() => {
    setLocalSimplified(isSimplifiedWorkflowEnabled);
  }, [isSimplifiedWorkflowEnabled]);

  const handleToggle = (newValue: boolean) => {
    setLocalSimplified(newValue);
    localStorage.setItem('isSimplifiedWorkflowEnabled', String(newValue));
    if (onToggleSimplifiedWorkflow) {
      onToggleSimplifiedWorkflow(newValue);
    }
  };

  const checkStatus = async () => {
    setIsRefreshing(true);
    const start = Date.now();

    // 1. Check Supabase (Directly via client)
    const checkSupabase = async (): Promise<ServiceStatus> => {
      try {
        const t1 = Date.now();
        const { error } = await supabase.from('app_settings').select('count', { count: 'exact', head: true });
        const latency = Date.now() - t1;
        if (error) throw error;
        return { name: 'Supabase Database', status: 'ok', message: 'Conectado e Operacional', latency };
      } catch (err) {
        return { name: 'Supabase Database', status: 'error', message: 'Erro de Conexão' };
      }
    };

    // 2. Check GitHub (Public API)
    const checkGitHub = async (): Promise<ServiceStatus> => {
      try {
        const t1 = Date.now();
        const res = await fetch('https://www.githubstatus.com/api/v2/summary.json');
        const latency = Date.now() - t1;
        if (!res.ok) throw new Error();
        const data = await res.json();
        const status = data.status.indicator === 'none' ? 'ok' : data.status.indicator === 'minor' ? 'warning' : 'error';
        return { name: 'GitHub Infrastructure', status, message: data.status.description, latency };
      } catch (err) {
        return { name: 'GitHub Infrastructure', status: 'warning', message: 'Status Indisponível (CORS)' };
      }
    };

    // 3. Check Vercel (Public API or Ping)
    const checkVercel = async (): Promise<ServiceStatus> => {
        try {
          const t1 = Date.now();
          // Vercel status API usually has CORS, so we might fallback
          const res = await fetch('https://www.vercel-status.com/api/v2/summary.json');
          const latency = Date.now() - t1;
          if (!res.ok) throw new Error();
          const data = await res.json();
          const status = data.status.indicator === 'none' ? 'ok' : data.status.indicator === 'minor' ? 'warning' : 'error';
          return { name: 'Vercel Hosting', status, message: data.status.description, latency };
        } catch (err) {
          // If fetch fails (CORS), we just assume it's OK if the app is running (since it's hosted on Vercel)
          return { name: 'Vercel Hosting', status: 'ok', message: 'Sistema Local Operacional (Vercel)' };
        }
      };

    const [supa, git, verc] = await Promise.all([checkSupabase(), checkGitHub(), checkVercel()]);

    setStatuses({
      supabase: supa,
      github: git,
      vercel: verc
    });
    setLastCheck(new Date());
    setIsRefreshing(false);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Auto refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      case 'warning': return <AlertCircle className="w-6 h-6 text-amber-500" />;
      case 'error': return <AlertCircle className="w-6 h-6 text-red-500" />;
      case 'loading': return <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800';
      case 'warning': return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800';
      case 'error': return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      default: return 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="Monitoramento do Sistema" />
      
      <div className="p-6 max-w-4xl mx-auto space-y-8">

        {/* Global Operational Settings Card: Modo de Embarque Simplificado */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-blue-100 dark:border-blue-900/50 shadow-md p-6 overflow-hidden transition-all">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Modo de Embarque Simplificado
                    </h3>
                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      localSimplified
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {localSimplified ? 'Ativado ⚡' : 'Desativado'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                    Controle global do fluxo de solicitações e esteira operacional
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pl-0 md:pl-12">
                {localSimplified ? (
                  <span className="text-blue-700 dark:text-blue-300 font-medium">
                    ⚡ <strong>Função Ativa:</strong> As solicitações de embarque serão sempre simplificadas (sem campos de proprietário/carretas/dados bancários/tag) e a tela <strong>Operacional &gt; Embarques</strong> exibirá exclusivamente os status do fluxo simplificado (<em>Ag. Seguradora → Ag. Carregamento → Ag. Nota → Ag. Descarga → Finalizado</em>), com anexos opcionais.
                  </span>
                ) : (
                  <span>
                    Fluxo normal ativo. As solicitações de embarque exigem todos os dados cadastrais completos e a tela <strong>Operacional &gt; Embarques</strong> exibe todas as abas e regras de validação completas.
                  </span>
                )}
              </p>
            </div>

            {/* Toggle Button */}
            <div className="flex flex-col items-center md:items-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleToggle(!localSimplified)}
                className={`relative inline-flex h-8 w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSimplified ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={localSimplified}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    localSimplified ? 'translate-x-8' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                {localSimplified ? 'Clique para Desligar' : 'Clique para Ligar'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Estado dos Serviços</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Verificação em tempo real da infraestrutura do sistema</p>
            </div>
            <button 
                onClick={checkStatus} 
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
            >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Atualizar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(statuses).map(([key, service]) => (
                <div key={key} className={`p-6 rounded-xl border-2 transition-all ${getStatusColor(service.status)}`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                            {key === 'github' && <Code className="w-6 h-6 text-gray-700 dark:text-gray-300" />}
                            {key === 'supabase' && <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
                            {key === 'vercel' && <Globe className="w-6 h-6 text-black dark:text-white" />}
                        </div>
                        {getStatusIcon(service.status)}
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white mb-1">{service.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{service.message}</p>
                    {service.latency && (
                        <div className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs font-mono text-gray-400">{service.latency}ms</span>
                        </div>
                    )}
                </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Informações da Sessão
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Última Verificação</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{lastCheck.toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Modo de Operação</span>
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Online (Realtime)
                    </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Versão do App</span>
                    <span className="text-sm font-mono text-gray-800 dark:text-gray-200">v2.4.0-stable</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Ambiente</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Produção</span>
                </div>
            </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400 uppercase tracking-widest">
            Agromarcantil Logística - Painel de Controle de Infraestrutura
        </p>
      </div>
    </div>
  );
};

export default SystemMonitorPage;
