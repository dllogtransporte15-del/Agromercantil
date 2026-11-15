import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Smartphone, 
  Settings2, 
  History, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  FileText, 
  Zap, 
  ShieldCheck,
  RefreshCw,
  Plus
} from 'lucide-react';
import type { WhatsAppInstance, WhatsAppTemplate, WhatsAppQueueItem } from '../../types/whatsapp';
import { 
  getWhatsAppInstance, 
  syncWhatsAppInstanceFromGateway,
  getWhatsAppTemplates, 
  getWhatsAppQueue, 
  saveWhatsAppTemplate, 
  deleteWhatsAppTemplate 
} from '../../services/whatsappService';
import type { User } from '../../types';
import { WhatsAppConnectionCard } from './WhatsAppConnectionCard';
import { WhatsAppTemplateEditor } from './WhatsAppTemplateEditor';
import { WhatsAppLogsTable } from './WhatsAppLogsTable';
import { WhatsAppLiveTestModal } from './WhatsAppLiveTestModal';
import { WhatsAppChatPanel } from './WhatsAppChatPanel';

interface WhatsAppDashboardProps {
  currentUser?: User | null;
}

export const WhatsAppDashboard: React.FC<WhatsAppDashboardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'templates' | 'connection' | 'logs'>('chats');
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [queue, setQueue] = useState<WhatsAppQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [selectedTemplateForTest, setSelectedTemplateForTest] = useState<WhatsAppTemplate | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [instData, tplData, queueData] = await Promise.all([
        getWhatsAppInstance(),
        getWhatsAppTemplates(),
        getWhatsAppQueue()
      ]);
      setInstance(instData);
      setTemplates(tplData);
      setQueue(queueData);

      // Sincroniza em segundo plano sem travar a interface
      syncWhatsAppInstanceFromGateway().then(updated => {
        if (updated) setInstance(updated);
      }).catch(() => null);
    } catch (err) {
      console.error('Erro ao carregar dados do WhatsApp:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleSaveTemplate = async (template: WhatsAppTemplate) => {
    const saved = await saveWhatsAppTemplate(template);
    const updated = templates.map(t => t.id === saved.id ? saved : t);
    if (!templates.some(t => t.id === saved.id)) updated.push(saved);
    setTemplates(updated);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteWhatsAppTemplate(templateId);
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const handleOpenTestModal = (template?: WhatsAppTemplate) => {
    setSelectedTemplateForTest(template || templates[0] || null);
    setTestModalOpen(true);
  };

  // Métricas rápidas
  const totalSent = queue.filter(q => q.status === 'sent' || q.status === 'delivered' || q.status === 'read').length;
  const totalRead = queue.filter(q => q.status === 'read').length;
  const activeTemplatesCount = templates.filter(t => t.is_active).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* BANNER PRINCIPAL COM GLOW */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C1917] via-slate-900 to-emerald-950 p-6 sm:p-8 text-white border border-emerald-900/40 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-black text-emerald-300 mb-3">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Canal Integrado de Comunicação</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Automação & Disparos de WhatsApp
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Gerencie a conexão do número corporativo, configure réguas automáticas de mensagens com tags dinâmicas e monitore a entrega de comprovantes, ordens e CT-e em PDF.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('transcunha:open_whatsapp_chat'))}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer transition-all border border-emerald-400/30"
              title="Abrir Janela Flutuante Global de Conversas"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Abrir Janela de Chat</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenTestModal()}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-xs border border-white/10 flex items-center gap-2 cursor-pointer transition-all"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>Disparo de Teste</span>
            </button>
            <button
              type="button"
              onClick={loadAllData}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white border border-white/10 transition-all cursor-pointer"
              title="Atualizar Dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Status do Canal</span>
            <p className="text-sm sm:text-base font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {instance?.status === 'connected' ? 'Online / Ativo' : 'Aguardando'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Réguas Ativas</span>
            <p className="text-sm sm:text-base font-black text-white mt-0.5">
              {activeTemplatesCount} <span className="text-xs text-slate-400 font-normal">de {templates.length}</span>
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Disparado</span>
            <p className="text-sm sm:text-base font-black text-amber-400 mt-0.5">
              {totalSent} msgs
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Lidas pelo Motorista</span>
            <p className="text-sm sm:text-base font-black text-[#53bdeb] mt-0.5">
              {totalRead} confirmadas
            </p>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'chats'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'templates'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-900/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Modelos & Réguas de Disparo</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white">
            {templates.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('connection')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'connection'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-900/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Conexão & Aparelho (QR Code)</span>
          {instance?.status === 'connected' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-900/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Fila de Envios & Logs de Entrega</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white">
            {queue.length}
          </span>
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'chats' && (
        <WhatsAppChatPanel 
          mode="embedded" 
          currentUser={currentUser}
          onOpenFloating={() => window.dispatchEvent(new CustomEvent('transcunha:open_whatsapp_chat'))}
        />
      )}

      {activeTab === 'templates' && (
        <WhatsAppTemplateEditor
          templates={templates}
          onSaveTemplate={handleSaveTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onOpenTestModal={handleOpenTestModal}
        />
      )}

      {activeTab === 'connection' && instance && (
        <WhatsAppConnectionCard
          instance={instance}
          currentUser={currentUser}
          onInstanceUpdated={(updated) => setInstance(updated)}
        />
      )}

      {activeTab === 'logs' && (
        <WhatsAppLogsTable
          queue={queue}
          onReload={loadAllData}
        />
      )}

      {/* MODAL DE DISPARO DE TESTE */}
      <WhatsAppLiveTestModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        template={selectedTemplateForTest}
        onSuccess={loadAllData}
      />
    </div>
  );
};
