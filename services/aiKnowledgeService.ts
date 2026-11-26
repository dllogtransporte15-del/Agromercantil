import { supabase } from '../supabase';

export interface AIKnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  is_active: boolean;
  created_by?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIAgentSettings {
  id: string;
  agent_name: string;
  system_instructions: string;
  include_live_context: boolean;
  updated_by_name?: string | null;
  updated_at?: string;
}

export const KNOWLEDGE_CATEGORIES = [
  'Geral',
  'Operacional',
  'Clientes & Embarcadores',
  'Motoristas & Frota',
  'Financeiro & Tributos',
  'Rotas & Fretes',
  'Regras & Procedimentos',
] as const;

export const DEFAULT_AGENT_SETTINGS: AIAgentSettings = {
  id: 'default',
  agent_name: 'Assessor IA DLLOG',
  system_instructions:
    'Você é o Assessor IA oficial da DLLOG Transportes. Converse de forma natural, acolhedora, direta e objetiva em português — como um colega experiente e parceiro de trabalho, sem linguagem robótica ou rodeios. Priorize sempre os fatos cadastrados na Base de Conhecimento da empresa e o contexto operacional quando disponível. Se algo não estiver cadastrado, diga com transparência o que faltou e sugira cadastrar na base.',
  include_live_context: true,
};

const LOCAL_KB_KEY = 'dllog_ai_knowledge_base_fallback';
const LOCAL_SETTINGS_KEY = 'dllog_ai_agent_settings_fallback';

function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

function readLocalKB(): AIKnowledgeItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalKB(items: AIKnowledgeItem[]): void {
  try {
    localStorage.setItem(LOCAL_KB_KEY, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
}

export async function loadKnowledgeBase(): Promise<{ items: AIKnowledgeItem[]; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from('ai_knowledge_base')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      return { items: readLocalKB(), tableMissing: true };
    }
    throw error;
  }

  const items = (data || []) as AIKnowledgeItem[];
  writeLocalKB(items);
  return { items, tableMissing: false };
}

export async function saveKnowledgeItem(
  payload: {
    id?: string;
    title: string;
    category: string;
    content: string;
    tags: string[];
    is_active?: boolean;
  },
  user?: { id?: string; name?: string } | null
): Promise<{ item: AIKnowledgeItem; tableMissing: boolean }> {
  const now = new Date().toISOString();
  const cleanTags = payload.tags
    .map((t) => t.trim())
    .filter(Boolean);

  if (payload.id) {
    const updateData = {
      title: payload.title.trim(),
      category: payload.category || 'Geral',
      content: payload.content.trim(),
      tags: cleanTags,
      is_active: payload.is_active ?? true,
      updated_by_name: user?.name || 'Operador',
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('ai_knowledge_base')
      .update(updateData)
      .eq('id', payload.id)
      .select()
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        const current = readLocalKB();
        const updated = current.map((i) => (i.id === payload.id ? { ...i, ...updateData } : i));
        writeLocalKB(updated);
        const found = updated.find((i) => i.id === payload.id)!;
        return { item: found, tableMissing: true };
      }
      throw error;
    }

    return { item: data as AIKnowledgeItem, tableMissing: false };
  }

  const insertData = {
    title: payload.title.trim(),
    category: payload.category || 'Geral',
    content: payload.content.trim(),
    tags: cleanTags,
    is_active: payload.is_active ?? true,
    created_by: user?.id || null,
    created_by_name: user?.name || 'Operador',
    updated_by_name: user?.name || 'Operador',
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('ai_knowledge_base')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      const localItem: AIKnowledgeItem = {
        id: crypto.randomUUID(),
        ...insertData,
      };
      const current = readLocalKB();
      writeLocalKB([localItem, ...current]);
      return { item: localItem, tableMissing: true };
    }
    throw error;
  }

  return { item: data as AIKnowledgeItem, tableMissing: false };
}

export async function deleteKnowledgeItem(id: string): Promise<{ tableMissing: boolean }> {
  const { error } = await supabase
    .from('ai_knowledge_base')
    .delete()
    .eq('id', id);

  if (error) {
    if (isMissingTableError(error)) {
      const current = readLocalKB().filter((i) => i.id !== id);
      writeLocalKB(current);
      return { tableMissing: true };
    }
    throw error;
  }

  return { tableMissing: false };
}

export async function loadAgentSettings(): Promise<{ settings: AIAgentSettings; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from('ai_agent_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      try {
        const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
        return {
          settings: raw ? { ...DEFAULT_AGENT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_AGENT_SETTINGS,
          tableMissing: true,
        };
      } catch {
        return { settings: DEFAULT_AGENT_SETTINGS, tableMissing: true };
      }
    }
    throw error;
  }

  return {
    settings: (data as AIAgentSettings) || DEFAULT_AGENT_SETTINGS,
    tableMissing: false,
  };
}

export async function saveAgentSettings(
  settings: Partial<AIAgentSettings>,
  userName?: string
): Promise<{ settings: AIAgentSettings; tableMissing: boolean }> {
  const payload: AIAgentSettings = {
    id: 'default',
    agent_name: (settings.agent_name || DEFAULT_AGENT_SETTINGS.agent_name).trim(),
    system_instructions: (settings.system_instructions || DEFAULT_AGENT_SETTINGS.system_instructions).trim(),
    include_live_context: settings.include_live_context ?? true,
    updated_by_name: userName || 'Operador',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ai_agent_settings')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      try {
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(payload));
      } catch {
        // ignore
      }
      return { settings: payload, tableMissing: true };
    }
    throw error;
  }

  return { settings: data as AIAgentSettings, tableMissing: false };
}

export function buildKnowledgePromptContext(
  items: AIKnowledgeItem[],
  liveContextText?: string
): string {
  const activeItems = items.filter((i) => i.is_active);

  const kbSection =
    activeItems.length === 0
      ? 'Nenhum registro ativo cadastrado na Base de Conhecimento até o momento.'
      : activeItems
          .map((item, idx) => {
            const tags = item.tags?.length ? ` | Tags: ${item.tags.join(', ')}` : '';
            return `[#${idx + 1}] (${item.category}${tags}) ${item.title}\n${item.content}`;
          })
          .join('\n\n---\n\n');

  if (liveContextText) {
    return `=== BASE DE CONHECIMENTO DA EMPRESA ===\n${kbSection}\n\n=== RESUMO OPERACIONAL AO VIVO DO SISTEMA ===\n${liveContextText}`;
  }

  return `=== BASE DE CONHECIMENTO DA EMPRESA ===\n${kbSection}`;
}
