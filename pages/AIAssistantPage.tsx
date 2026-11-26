import React, { useState, useRef, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import { GoogleGenAI } from '@google/genai';
import {
  Bot,
  BookOpen,
  Settings,
  Plus,
  Search,
  Send,
  Trash2,
  Edit3,
  Check,
  X,
  Sparkles,
  Database,
  AlertTriangle,
  Copy,
  BookmarkPlus,
  Power,
  RefreshCw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
} from 'lucide-react';
import type { User, ProfilePermissions, Shipment, Cargo, Client, Driver } from '../types';
import { can, isAdminUser, isDeveloperUser } from '../auth';
import {
  AIKnowledgeItem,
  AIAgentSettings,
  DEFAULT_AGENT_SETTINGS,
  KNOWLEDGE_CATEGORIES,
  loadKnowledgeBase,
  saveKnowledgeItem,
  deleteKnowledgeItem,
  loadAgentSettings,
  saveAgentSettings,
  buildKnowledgePromptContext,
} from '../services/aiKnowledgeService';

interface AIAssistantPageProps {
  currentUser?: User | null;
  profilePermissions?: ProfilePermissions;
  shipments?: Shipment[];
  cargos?: Cargo[];
  clients?: Client[];
  drivers?: Driver[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

const MIGRATION_SQL_SNIPPET = `-- Execute no SQL Editor do Supabase (arquivo: supabase/migrations/20261126_ai_knowledge_base.sql)
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Geral',
    content TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT,
    created_by_name TEXT,
    updated_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura de ai_knowledge_base" ON public.ai_knowledge_base FOR SELECT USING (true);
CREATE POLICY "Permitir inserção em ai_knowledge_base" ON public.ai_knowledge_base FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização em ai_knowledge_base" ON public.ai_knowledge_base FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Permitir exclusão em ai_knowledge_base" ON public.ai_knowledge_base FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.ai_agent_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    agent_name TEXT NOT NULL DEFAULT 'Assessor IA DLLOG',
    system_instructions TEXT NOT NULL DEFAULT 'Você é o Assessor IA oficial da DLLOG Transportes.',
    include_live_context BOOLEAN NOT NULL DEFAULT true,
    updated_by_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura de ai_agent_settings" ON public.ai_agent_settings FOR SELECT USING (true);
CREATE POLICY "Permitir inserção em ai_agent_settings" ON public.ai_agent_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização em ai_agent_settings" ON public.ai_agent_settings FOR UPDATE USING (true) WITH CHECK (true);`;

const AIAssistantPage: React.FC<AIAssistantPageProps> = ({
  currentUser,
  profilePermissions,
  shipments = [],
  cargos = [],
  clients = [],
  drivers = [],
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge' | 'settings'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(
    (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || ''
  );

  // Knowledge Base State
  const [knowledgeItems, setKnowledgeItems] = useState<AIKnowledgeItem[]>([]);
  const [isLoadingKB, setIsLoadingKB] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [kbSearch, setKbSearch] = useState('');
  const [kbCategoryFilter, setKbCategoryFilter] = useState<string>('Todas');

  // Knowledge Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Geral');
  const [formTags, setFormTags] = useState('');
  const [formContent, setFormContent] = useState('');
  const [isSavingKB, setIsSavingKB] = useState(false);

  // Agent Settings State
  const [agentSettings, setAgentSettings] = useState<AIAgentSettings>(DEFAULT_AGENT_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Voice Interaction State
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  const speechSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }, []);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const canManageKnowledge = useMemo(() => {
    if (!currentUser) return false;
    if (isAdminUser(currentUser) || isDeveloperUser(currentUser)) return true;
    if (!profilePermissions) return false;
    return (
      can('create', currentUser, 'ai-assistant', profilePermissions) ||
      can('update', currentUser, 'ai-assistant', profilePermissions)
    );
  }, [currentUser, profilePermissions]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackBanner({ type, text });
    setTimeout(() => setFeedbackBanner(null), 4500);
  };

  const fetchAllData = async () => {
    setIsLoadingKB(true);
    try {
      const [kbRes, settingsRes] = await Promise.all([loadKnowledgeBase(), loadAgentSettings()]);
      setKnowledgeItems(kbRes.items);
      setAgentSettings(settingsRes.settings);
      setTableMissing(kbRes.tableMissing || settingsRes.tableMissing);
    } catch (err: any) {
      console.error('Erro ao carregar base de conhecimento:', err);
      showFeedback('error', 'Não foi possível carregar a base de conhecimento.');
    } finally {
      setIsLoadingKB(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const speakText = (rawText: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const cleanText = rawText
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[*_#`~>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.toLowerCase().startsWith('pt-br')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const liveContextSummary = useMemo(() => {
    if (!agentSettings.include_live_context) return undefined;
    const activeCargos = cargos.filter((c: any) => c.status !== 'Concluída' && c.status !== 'Cancelada');
    const recentClients = clients.slice(0, 15).map((c) => `${c.nomeFantasia || c.razaoSocial} (${c.city}/${c.state})`).join('; ');
    return [
      `Total de clientes cadastrados: ${clients.length}. Exemplos: ${recentClients || 'Nenhum'}.`,
      `Total de motoristas cadastrados: ${drivers.length} (ativos: ${drivers.filter((d) => d.active).length}).`,
      `Cargas totais: ${cargos.length} | Cargas em aberto/andamento: ${activeCargos.length}.`,
      `Embarques totais registrados: ${shipments.length}.`,
      `Usuário atual consultando: ${currentUser?.name || 'Operador'} (${currentUser?.profile || 'Sistema'}).`,
    ].join('\n');
  }, [agentSettings.include_live_context, cargos, clients, drivers, shipments, currentUser]);

  const activeKnowledgeCount = useMemo(
    () => knowledgeItems.filter((i) => i.is_active).length,
    [knowledgeItems]
  );

  const filteredKnowledge = useMemo(() => {
    const q = kbSearch.trim().toLowerCase();
    return knowledgeItems.filter((item) => {
      if (kbCategoryFilter !== 'Todas' && item.category !== kbCategoryFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [knowledgeItems, kbSearch, kbCategoryFilter]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? input).trim();
    if (!textToSend || !apiKey || isLoading) return;

    if (!customPrompt) setInput('');
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const knowledgeContext = buildKnowledgePromptContext(knowledgeItems, liveContextSummary);
      const systemInstruction = `${agentSettings.system_instructions}\n\nUtilize o contexto abaixo como fonte principal de verdade para responder ao usuário:\n\n${knowledgeContext}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...messages.map((m) => ({
            role: m.role as 'user' | 'model',
            parts: [{ text: m.content }],
          })),
          { role: 'user', parts: [{ text: textToSend }] },
        ],
        config: {
          systemInstruction,
        },
      });

      const modelText = response.text || 'Nenhuma resposta recebida.';
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'model',
          content: modelText,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      if (autoSpeak) {
        speakText(modelText);
      }
    } catch (error: any) {
      console.error('Erro na API Gemini:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'model',
          content: `Erro ao consultar o assessor: ${error.message || 'Verifique a chave de API ou conexão.'}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const toggleVoiceInput = () => {
    if (!speechSupported) {
      showFeedback('error', 'Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    stopSpeaking();

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      setInput((finalTranscript + interim).trim());
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        showFeedback('error', `Erro no microfone: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      const spoken = finalTranscript.trim();
      if (spoken && apiKey) {
        setInput('');
        handleSend(spoken);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const openNewForm = (prefillContent = '') => {
    setEditingId(undefined);
    setFormTitle('');
    setFormCategory('Geral');
    setFormTags('');
    setFormContent(prefillContent);
    setIsFormOpen(true);
    setActiveTab('knowledge');
  };

  const openEditForm = (item: AIKnowledgeItem) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormCategory(item.category);
    setFormTags((item.tags || []).join(', '));
    setFormContent(item.content);
    setIsFormOpen(true);
  };

  const handleSaveKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;
    setIsSavingKB(true);
    try {
      const tagsArray = formTags.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await saveKnowledgeItem(
        {
          id: editingId,
          title: formTitle,
          category: formCategory,
          content: formContent,
          tags: tagsArray,
          is_active: true,
        },
        currentUser ? { id: currentUser.id, name: currentUser.name } : null
      );
      setTableMissing(res.tableMissing);
      setIsFormOpen(false);
      await fetchAllData();
      showFeedback('success', editingId ? 'Informação atualizada na base!' : 'Informação adicionada à base do Assessor!');
    } catch (err: any) {
      console.error('Erro ao salvar conhecimento:', err);
      showFeedback('error', err?.message || 'Erro ao salvar informação.');
    } finally {
      setIsSavingKB(false);
    }
  };

  const handleToggleActive = async (item: AIKnowledgeItem) => {
    try {
      await saveKnowledgeItem(
        {
          id: item.id,
          title: item.title,
          category: item.category,
          content: item.content,
          tags: item.tags || [],
          is_active: !item.is_active,
        },
        currentUser ? { id: currentUser.id, name: currentUser.name } : null
      );
      await fetchAllData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erro ao alterar status.');
    }
  };

  const handleDeleteKB = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir esta informação da base de conhecimento?')) return;
    try {
      await deleteKnowledgeItem(id);
      await fetchAllData();
      showFeedback('success', 'Informação removida da base.');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erro ao excluir.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await saveAgentSettings(agentSettings, currentUser?.name);
      setAgentSettings(res.settings);
      setTableMissing(res.tableMissing);
      showFeedback('success', 'Configurações do Assessor salvas!');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_SNIPPET);
    showFeedback('success', 'SQL copiado! Cole e execute no SQL Editor do Supabase.');
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <Header title={agentSettings.agent_name || 'Assessor IA & Base de Conhecimento'} />

      {feedbackBanner && (
        <div
          className={`px-4 py-3 rounded-lg border text-sm font-medium flex items-center justify-between ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          <span>{feedbackBanner.text}</span>
          <button onClick={() => setFeedbackBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {tableMissing && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Tabela do Supabase ainda não aplicada (modo local ativo)</p>
              <p className="text-xs opacity-90 mt-0.5">
                Os dados estão sendo salvos localmente neste navegador. Para compartilhar entre todos os usuários, execute a migration{' '}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded">20261126_ai_knowledge_base.sql</code> no Supabase.
              </p>
            </div>
          </div>
          <button
            onClick={handleCopySQL}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar SQL
          </button>
        </div>
      )}

      {/* Navigation Tabs + Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-2 rounded-xl border dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('chat')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Bot className="w-4 h-4" />
            Assessor IA
          </button>

          {canManageKnowledge && (
            <>
              <button
                onClick={() => setActiveTab('knowledge')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'knowledge'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Base de Conhecimento
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-black/15 dark:bg-white/15">
                  {activeKnowledgeCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Settings className="w-4 h-4" />
                Configurações
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-2 text-xs text-gray-500 dark:text-gray-400">
          <Database className="w-3.5 h-3.5 text-primary" />
          <span>
            {activeKnowledgeCount} {activeKnowledgeCount === 1 ? 'informação ativa' : 'informações ativas'}
          </span>
          <button
            onClick={fetchAllData}
            title="Sincronizar base"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingKB ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* TAB 1: CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border dark:border-gray-700 flex flex-col h-[70vh]">
          {!apiKey && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-800 dark:text-yellow-200 text-sm">
              <p className="font-bold mb-1">Chave de API Gemini necessária</p>
              <p className="mb-2 text-xs">
                Insira sua chave do Google AI Studio abaixo (ou configure <code className="font-mono">VITE_GEMINI_API_KEY</code> no ambiente).
              </p>
              <input
                type="password"
                placeholder="Sua API Key do Gemini (AIzaSy...)"
                onChange={handleSaveKey}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white mt-1"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border dark:border-gray-700 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 px-4">
                <Sparkles className="w-14 h-14 mb-3 text-primary opacity-70" />
                <p className="text-lg font-semibold text-gray-800 dark:text-gray-100 text-center">
                  {agentSettings.agent_name}
                </p>
                <p className="text-sm mt-1 opacity-80 text-center max-w-md">
                  Pergunte sobre regras, clientes, procedimentos ou qualquer informação cadastrada na Base de Conhecimento da empresa.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-xl">
                  {[
                    'Quais informações você já possui cadastradas?',
                    'Me dê um resumo operacional atual do sistema',
                    'Quais são as principais regras e procedimentos da empresa?',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSend(prompt)}
                      disabled={!apiKey || isLoading}
                      className="text-xs px-3 py-1.5 rounded-full border dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-primary hover:text-primary transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] rounded-xl p-3.5 ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-none'
                        : 'bg-white dark:bg-gray-700 border dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-bl-none shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] opacity-70">
                      <span>{msg.timestamp}</span>
                      <div className="flex items-center gap-2">
                        {msg.role === 'model' && (
                          <button
                            onClick={() => speakText(msg.content)}
                            className="inline-flex items-center gap-1 hover:opacity-100"
                            title="Ouvir resposta"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            Ouvir
                          </button>
                        )}
                        {msg.role === 'user' && canManageKnowledge && (
                          <button
                            onClick={() => openNewForm(msg.content)}
                            className="inline-flex items-center gap-1 hover:underline"
                            title="Salvar esta informação na Base de Conhecimento"
                          >
                            <BookmarkPlus className="w-3 h-3" />
                            Salvar na Base
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-xl rounded-bl-none p-3.5 shadow-sm">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          <div className="flex items-center justify-between gap-2 mb-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !autoSpeak;
                  setAutoSpeak(next);
                  if (!next) stopSpeaking();
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${
                  autoSpeak
                    ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                    : 'dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                {autoSpeak ? 'Resposta falada ativada' : 'Resposta falada desativada'}
              </button>
              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 font-medium"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Parar áudio
                </button>
              )}
            </div>
            {isListening && (
              <span className="text-red-500 font-medium animate-pulse">
                Ouvindo sua voz... fale agora
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={!apiKey || isLoading}
                title={isListening ? 'Parar gravação' : 'Falar com o Assessor IA'}
                className={`px-3.5 rounded-lg border transition-colors flex items-center justify-center ${
                  isListening
                    ? 'bg-red-500 border-red-500 text-white animate-pulse'
                    : 'dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                } disabled:opacity-50`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isListening ? 'Ouvindo...' : 'Fale no microfone ou digite sua pergunta ao Assessor IA...'}
              className="flex-1 resize-none h-12 p-3 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary outline-none text-sm"
              disabled={!apiKey || isLoading}
            />
            {canManageKnowledge && input.trim() && (
              <button
                type="button"
                onClick={() => openNewForm(input)}
                title="Salvar este texto diretamente na Base de Conhecimento"
                className="px-3.5 rounded-lg border dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium flex items-center gap-1.5"
              >
                <BookmarkPlus className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">Ensinar IA</span>
              </button>
            )}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || !apiKey || isLoading}
              className="px-5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: KNOWLEDGE BASE */}
      {activeTab === 'knowledge' && canManageKnowledge && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex flex-1 gap-2 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={kbSearch}
                  onChange={(e) => setKbSearch(e.target.value)}
                  placeholder="Buscar por título, conteúdo ou tag..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <select
                value={kbCategoryFilter}
                onChange={(e) => setKbCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none"
              >
                <option value="Todas">Todas as Categorias</option>
                {KNOWLEDGE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => openNewForm()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Informação
            </button>
          </div>

          {isFormOpen && (
            <form
              onSubmit={handleSaveKB}
              className="bg-white dark:bg-gray-800 p-5 rounded-xl border-2 border-primary/40 shadow-md space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {editingId ? 'Editar Informação da Base' : 'Alimentar Base de Conhecimento'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Título / Assunto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Política de estadia do cliente X / Horário de descarga..."
                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none"
                  >
                    {KNOWLEDGE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="Ex: estadia, agromercantil, rota sul, financeiro"
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Informação / Conteúdo para a IA *
                </label>
                <textarea
                  required
                  rows={5}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Descreva em detalhes a informação, regra, procedimento, contato ou instrução que o Assessor IA deve saber responder..."
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-sm rounded-lg border dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingKB}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSavingKB ? 'Salvando...' : 'Salvar na Base'}
                </button>
              </div>
            </form>
          )}

          {filteredKnowledge.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-10 rounded-xl border dark:border-gray-700 text-center text-gray-500 dark:text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Nenhuma informação encontrada</p>
              <p className="text-xs mt-1">
                Clique em "Nova Informação" para alimentar o banco de conhecimento do Assessor IA.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredKnowledge.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-gray-800 p-4 rounded-xl border shadow-sm flex flex-col justify-between gap-3 ${
                    item.is_active
                      ? 'dark:border-gray-700'
                      : 'border-dashed opacity-60 dark:border-gray-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-primary/15 text-primary">
                        {item.category}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(item)}
                          title={item.is_active ? 'Desativar da IA' : 'Ativar na IA'}
                          className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            item.is_active ? 'text-emerald-600' : 'text-gray-400'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditForm(item)}
                          title="Editar"
                          className="p-1.5 rounded text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteKB(item.id)}
                          title="Excluir"
                          className="p-1.5 rounded text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1.5">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">
                      {item.content}
                    </p>
                  </div>

                  <div className="pt-2 border-t dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
                    <div className="flex flex-wrap gap-1">
                      {(item.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <span>
                      Por {item.updated_by_name || item.created_by_name || 'Operador'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SETTINGS */}
      {activeTab === 'settings' && canManageKnowledge && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-5 max-w-3xl"
        >
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Personalidade e Regras do Assessor IA
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Defina como o agente se apresenta e como deve responder aos usuários do projeto.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Nome do Agente
            </label>
            <input
              type="text"
              value={agentSettings.agent_name}
              onChange={(e) => setAgentSettings({ ...agentSettings, agent_name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Instruções de Comportamento (System Prompt)
            </label>
            <textarea
              rows={5}
              value={agentSettings.system_instructions}
              onChange={(e) =>
                setAgentSettings({ ...agentSettings, system_instructions: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              checked={agentSettings.include_live_context}
              onChange={(e) =>
                setAgentSettings({ ...agentSettings, include_live_context: e.target.checked })
              }
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>Incluir resumo operacional ao vivo do sistema (cargas, embarques, clientes e motoristas)</span>
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AIAssistantPage;
