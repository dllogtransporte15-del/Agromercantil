import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Wrench, 
  Rocket, 
  Calendar, 
  Layers, 
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { getReleasesForUser, markUpdateAsSeen, SystemRelease } from '../utils/systemUpdates';
import type { User } from '../types';
import { UserProfile } from '../types';

interface SystemUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
}

export const SystemUpdateModal: React.FC<SystemUpdateModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const visibleReleases = React.useMemo(() => getReleasesForUser(currentUser), [currentUser]);
  const latestRelease = visibleReleases[0];
  const [selectedRelease, setSelectedRelease] = useState<SystemRelease | null>(latestRelease || null);
  const [activeTab, setActiveTab] = useState<'latest' | 'history'>('latest');

  React.useEffect(() => {
    if (latestRelease) {
      setSelectedRelease(latestRelease);
    }
  }, [latestRelease?.id]);

  if (!isOpen || currentUser?.profile === UserProfile.Cliente || !latestRelease) return null;

  const currentDisplayRelease = selectedRelease || latestRelease;

  const handleDismiss = () => {
    if (currentUser?.id && latestRelease?.id) {
      markUpdateAsSeen(currentUser.id, latestRelease.id);
    }
    onClose();
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'feature':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <Rocket className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Novo Recurso
          </span>
        );
      case 'improvement':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Melhoria
          </span>
        );
      case 'security':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Conformidade & Regras
          </span>
        );
      case 'fix':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            <Wrench className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            Ajuste
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-[#1C1917] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP GLOW & HEADER */}
        <div className="relative bg-gradient-to-br from-amber-700 via-amber-800 to-slate-950 p-6 sm:p-8 text-white">
          <div className="absolute top-0 right-0 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-amber-200 mb-3 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>Atualização do Sistema</span>
                <span className="opacity-40">•</span>
                <span className="font-mono text-white font-extrabold">{latestRelease.version}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                O que há de novo no DLLOG Transportes?
              </h2>
              <p className="text-xs sm:text-sm text-amber-100/80 mt-1.5 leading-relaxed max-w-lg">
                Confira o resumo das atualizações e melhorias implementadas no sistema.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* TABS (Última vs Histórico) */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab('latest');
                setSelectedRelease(latestRelease);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'latest'
                  ? 'bg-white text-amber-900 shadow-md'
                  : 'bg-white/10 text-white/80 hover:bg-white/15'
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Versão Atual ({latestRelease.version})</span>
            </button>

            {visibleReleases.length > 1 && (
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-white text-amber-900 shadow-md'
                    : 'bg-white/10 text-white/80 hover:bg-white/15'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Histórico de Atualizações</span>
              </button>
            )}
          </div>
        </div>

        {/* CONTENT BODY */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {activeTab === 'history' ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Selecione uma atualização anterior para visualizar os detalhes:
              </p>
              <div className="grid grid-cols-1 gap-3">
                {visibleReleases.map(release => (
                  <button
                    key={release.id}
                    type="button"
                    onClick={() => {
                      setSelectedRelease(release);
                      setActiveTab('latest');
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      currentDisplayRelease.id === release.id
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-400">
                          {release.version}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {release.date}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                        {release.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                        {release.summary}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* RELEASE BANNER */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-600/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-sm text-gray-900 dark:text-white">
                      {currentDisplayRelease.title}
                    </h3>
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                      • {currentDisplayRelease.date}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                    {currentDisplayRelease.summary}
                  </p>
                </div>
              </div>

              {/* LIST OF UPDATE HIGHLIGHTS */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Destaques desta atualização ({currentDisplayRelease.items.length})
                </p>

                <div className="space-y-3">
                  {currentDisplayRelease.items.map((item, index) => (
                    <div 
                      key={index} 
                      className="p-4 rounded-2xl bg-white dark:bg-gray-900/80 border border-gray-200/90 dark:border-gray-800 shadow-sm space-y-2 hover:border-gray-300 dark:hover:border-gray-700 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                            {item.title}
                          </h4>
                        </div>
                        {getCategoryBadge(item.category)}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed pl-6">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:block">
            Esta notificação é exibida apenas no primeiro acesso após cada atualização.
          </p>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 via-primary to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-sm shadow-md shadow-amber-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer ml-auto"
          >
            <span>Entendi, vamos começar!</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemUpdateModal;
