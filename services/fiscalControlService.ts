import { supabase } from '../supabase';
import type { FiscalDocument, FiscalDocumentType, FiscalAlertLevel, FiscalDocumentAttachment } from '../types';

export const STORAGE_DOCUMENTS_KEY = 'transcunha_fiscal_documents_v1';
export const STORAGE_TYPES_KEY = 'transcunha_fiscal_document_types_v1';
export const FISCAL_DOCUMENTS_CHANGED_EVENT = 'transcunha:fiscal_documents_changed';
export const SUPABASE_FISCAL_RECORD_ID = 889;
export const FISCAL_REALTIME_CHANNEL = 'transcunha_fiscal_control';

// Canal local no mesmo navegador (entre diferentes abas)
const localFiscalBroadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('transcunha_fiscal_sync') 
  : null;

let fiscalChannelInstance: ReturnType<typeof supabase.channel> | null = null;
const fiscalSubscribers = new Set<(payload?: any) => void>();

function safeSetLocalStorage(key: string, data: any): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (e) {
    console.warn(`[fiscalControlService] Falha ao gravar no localStorage (${key}):`, e);
  }
}

/**
 * Obtém ou inicializa o canal central de Realtime para Controladoria Fiscal no Supabase.
 */
export function getFiscalRealtimeChannel(): ReturnType<typeof supabase.channel> {
  if (!fiscalChannelInstance) {
    fiscalChannelInstance = supabase.channel(FISCAL_REALTIME_CHANNEL, {
      config: {
        broadcast: { ack: false, self: false },
      }
    });

    // 1. WebSocket Broadcast Realtime (entre diferentes computadores e usuários)
    fiscalChannelInstance.on('broadcast', { event: 'fiscal_documents_changed' }, (msg: any) => {
      console.log('[Fiscal Realtime] ⚡ Broadcast recebido de outro usuário:', msg?.payload?.action);
      syncFiscalDataWithSupabase().then(() => {
        fiscalSubscribers.forEach(cb => {
          try { cb(msg?.payload); } catch {}
        });
      });
    });

    // 2. Postgres Changes no registro compartilhado no Supabase (row 889 em profile_permissions)
    fiscalChannelInstance.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profile_permissions' },
      (payload: any) => {
        const rowId = payload?.new?.id ?? payload?.old?.id;
        if (rowId === SUPABASE_FISCAL_RECORD_ID || !rowId) {
          console.log('[Fiscal Realtime] ⚡ Postgres CDC detectou alteração no row 889');
          syncFiscalDataWithSupabase().then(() => {
            fiscalSubscribers.forEach(cb => {
              try { cb(); } catch {}
            });
          });
        }
      }
    );

    fiscalChannelInstance.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Fiscal Realtime] ✅ Conectado ao canal de Controladoria Fiscal.');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`[Fiscal Realtime] ⚠️ Status do canal: ${status}`);
      }
    });
  }
  return fiscalChannelInstance;
}

/**
 * Dispara notificação via WebSocket Realtime e canais locais para TODOS os usuários conectados.
 */
export function broadcastFiscalChange(
  action: 'create' | 'update' | 'delete' | 'sync',
  documentId?: string,
  document?: FiscalDocument
): void {
  try {
    const payload = {
      action,
      documentId,
      document,
      timestamp: Date.now()
    };

    // 1. WebSocket central do Supabase Realtime (entre diferentes computadores / navegadores)
    const channel = getFiscalRealtimeChannel();
    channel.send({
      type: 'broadcast',
      event: 'fiscal_documents_changed',
      payload
    }).catch(err => {
      console.warn('[Fiscal Realtime Hub] Falha ao enviar broadcast:', err);
    });

    // 2. BroadcastChannel para outras abas abertas no mesmo navegador
    if (localFiscalBroadcast) {
      try {
        localFiscalBroadcast.postMessage({
          type: 'fiscal_documents_changed',
          payload
        });
      } catch {}
    }

    // 3. Evento customizado DOM para a própria janela
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FISCAL_DOCUMENTS_CHANGED_EVENT, { detail: payload }));
    }
  } catch (err) {
    console.warn('[Fiscal Realtime Hub] Erro ao disparar broadcast:', err);
  }
}

/**
 * Busca a lista remota compartilhada de documentos e tipos fiscais no Supabase (row 889 de profile_permissions).
 */
export async function fetchRemoteFiscalData(): Promise<{
  documents: FiscalDocument[];
  types: FiscalDocumentType[];
  success: boolean;
  updatedAt?: string;
  error?: any;
}> {
  try {
    const { data, error } = await supabase
      .from('profile_permissions')
      .select('permissions')
      .eq('id', SUPABASE_FISCAL_RECORD_ID)
      .maybeSingle();

    if (!error && data?.permissions) {
      const p = data.permissions;
      const docs = Array.isArray(p.fiscal_documents) ? p.fiscal_documents : [];
      const types = Array.isArray(p.fiscal_document_types) ? p.fiscal_document_types : [];
      return { 
        documents: docs, 
        types, 
        updatedAt: p.updatedAt,
        success: true 
      };
    }

    if (!error && !data) {
      // Row 889 ainda não existe na nuvem
      return { documents: [], types: [], success: true };
    }

    console.warn('[FiscalControl] Erro ao consultar Supabase row 889:', error);
    return { documents: [], types: [], success: false, error };
  } catch (err) {
    console.warn('[FiscalControl] Exceção ao consultar Supabase row 889:', err);
    return { documents: [], types: [], success: false, error: err };
  }
}

/**
 * Mescla de forma inteligente documentos fiscais remotos e locais sem perda de dados.
 * Se um documento foi criado localmente (ex: pela Samanta), ele é preservado e inserido.
 */
export function mergeFiscalDocuments(remoteDocs: FiscalDocument[], localDocs: FiscalDocument[]): FiscalDocument[] {
  const result: FiscalDocument[] = Array.isArray(remoteDocs) ? [...remoteDocs] : [];
  const existingMap = new Map<string, FiscalDocument>();

  for (const doc of result) {
    if (doc?.id) existingMap.set(doc.id, doc);
    const key = `${(doc.title || '').trim().toLowerCase()}_${(doc.documentNumber || '').trim().toLowerCase()}_${doc.branchId || ''}`;
    if (key.length > 5) existingMap.set(key, doc);
  }

  if (Array.isArray(localDocs)) {
    for (const loc of localDocs) {
      if (!loc || !loc.title) continue;

      const key = `${(loc.title || '').trim().toLowerCase()}_${(loc.documentNumber || '').trim().toLowerCase()}_${loc.branchId || ''}`;
      const existing = (loc.id && existingMap.get(loc.id)) || (key.length > 5 && existingMap.get(key));

      if (!existing) {
        // Documento novo cadastrado localmente (ex: Samanta): adiciona ao resultado
        result.push(loc);
        if (loc.id) existingMap.set(loc.id, loc);
      } else {
        // Documento já existe: atualiza se a versão local for mais recente
        const localUpdated = new Date(loc.updatedAt || loc.createdAt || 0).getTime();
        const existingUpdated = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (localUpdated > existingUpdated) {
          const idx = result.findIndex(d => d.id === existing.id);
          if (idx >= 0) {
            result[idx] = { ...existing, ...loc };
          }
        }
      }
    }
  }

  return result;
}

/**
 * Mescla tipos de documentos fiscais remotos e locais.
 */
export function mergeFiscalDocumentTypes(remoteTypes: FiscalDocumentType[], localTypes: FiscalDocumentType[]): FiscalDocumentType[] {
  const result: FiscalDocumentType[] = Array.isArray(remoteTypes) && remoteTypes.length > 0 
    ? [...remoteTypes] 
    : [...INITIAL_FISCAL_DOCUMENT_TYPES];
  const existingIds = new Set(result.map(t => t.id));
  const existingNames = new Set(result.map(t => t.name.trim().toLowerCase()));

  if (Array.isArray(localTypes)) {
    for (const loc of localTypes) {
      if (!loc || !loc.name) continue;
      const normName = loc.name.trim().toLowerCase();
      if (!existingIds.has(loc.id) && !existingNames.has(normName)) {
        result.push(loc);
        existingIds.add(loc.id);
        existingNames.add(normName);
      }
    }
  }

  return result;
}

/**
 * Sincroniza bidirecionalmente os documentos fiscais com a nuvem Supabase:
 * - Baixa do Supabase e mescla com os locais;
 * - Se houver novos itens locais (ex: cadastro recente de qualquer usuário), sobe para a nuvem;
 * - Garante que todos os usuários tenham exatamente os mesmos dados atualizados.
 */
export async function syncFiscalDataWithSupabase(): Promise<{
  documents: FiscalDocument[];
  types: FiscalDocumentType[];
}> {
  try {
    const remote = await fetchRemoteFiscalData();
    const localDocs = getFiscalDocuments();
    const localTypes = getFiscalDocumentTypes();

    if (remote.success) {
      if (remote.documents.length > 0) {
        const mergedDocs = mergeFiscalDocuments(remote.documents, localDocs);
        const mergedTypes = mergeFiscalDocumentTypes(remote.types, localTypes);

        safeSetLocalStorage(STORAGE_DOCUMENTS_KEY, mergedDocs);
        safeSetLocalStorage(STORAGE_TYPES_KEY, mergedTypes);

        // Se o merge local detectou documentos que ainda não estavam na nuvem, sobe para o Supabase
        if (mergedDocs.length > remote.documents.length || mergedTypes.length > remote.types.length) {
          try {
            await supabase.from('profile_permissions').upsert({
              id: SUPABASE_FISCAL_RECORD_ID,
              permissions: {
                fiscal_documents: mergedDocs,
                fiscal_document_types: mergedTypes,
                updatedAt: new Date().toISOString()
              }
            });
            broadcastFiscalChange('sync');
          } catch (upsertErr) {
            console.warn('[FiscalControl] Falha ao sincronizar merge com Supabase:', upsertErr);
          }
        }

        // Notifica componentes
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(FISCAL_DOCUMENTS_CHANGED_EVENT));
        }

        return { documents: mergedDocs, types: mergedTypes };
      } else {
        // Se a nuvem estava vazia, faz o primeiro upload dos dados locais/seed
        const docsToUpload = localDocs.length > 0 ? localDocs : getInitialFiscalDocumentsSeed();
        const typesToUpload = localTypes.length > 0 ? localTypes : INITIAL_FISCAL_DOCUMENT_TYPES;

        safeSetLocalStorage(STORAGE_DOCUMENTS_KEY, docsToUpload);
        safeSetLocalStorage(STORAGE_TYPES_KEY, typesToUpload);

        try {
          await supabase.from('profile_permissions').upsert({
            id: SUPABASE_FISCAL_RECORD_ID,
            permissions: {
              fiscal_documents: docsToUpload,
              fiscal_document_types: typesToUpload,
              updatedAt: new Date().toISOString()
            }
          });
          broadcastFiscalChange('sync');
        } catch (upsertErr) {
          console.warn('[FiscalControl] Falha ao inicializar row 889:', upsertErr);
        }

        return { documents: docsToUpload, types: typesToUpload };
      }
    } else {
      // Offline/erro de conexão: mantém dados locais
      return { documents: localDocs, types: localTypes };
    }
  } catch (err) {
    console.error('[FiscalControl] Erro ao sincronizar dados fiscais com Supabase:', err);
    return { documents: getFiscalDocuments(), types: getFiscalDocumentTypes() };
  }
}

/**
 * Subscreve a atualizações em tempo real da Controladoria Fiscal (WebSockets Supabase + Postgres CDC + Broadcast).
 */
export function subscribeToFiscalControl(onUpdate: (payload?: any) => void): () => void {
  let isMounted = true;
  getFiscalRealtimeChannel();
  fiscalSubscribers.add(onUpdate);

  // 3. BroadcastChannel local entre abas do mesmo navegador
  let localBc: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      localBc = new BroadcastChannel('transcunha_fiscal_sync');
      localBc.onmessage = (event) => {
        if (isMounted) {
          onUpdate(event.data);
        }
      };
    } catch {}
  }

  // 4. CustomEvent DOM na janela atual
  const handleLocal = (e: any) => {
    if (isMounted) onUpdate(e?.detail);
  };
  window.addEventListener(FISCAL_DOCUMENTS_CHANGED_EVENT, handleLocal);

  // 5. Storage Event
  const handleStorage = (e: StorageEvent) => {
    if ((e.key === STORAGE_DOCUMENTS_KEY || e.key === STORAGE_TYPES_KEY) && isMounted) {
      onUpdate();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    isMounted = false;
    fiscalSubscribers.delete(onUpdate);
    if (localBc) {
      try { localBc.close(); } catch {}
    }
    window.removeEventListener(FISCAL_DOCUMENTS_CHANGED_EVENT, handleLocal);
    window.removeEventListener('storage', handleStorage);
  };
}

export interface ExpirationStatusInfo {
  level: FiscalAlertLevel;
  daysRemaining: number;
  label: string; // 'Vencido', 'Crítico', 'Atenção', 'Em Dia'
  badgeClass: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  isUrgent: boolean;
  urgencyOrder: number; // 0: vencido, 1: critico, 2: atencao, 3: em dia
}

/**
 * Calcula o status de validade e alertas conforme regras:
 * - Faltando 10 dias ou menos: 'Crítico'
 * - Faltando 30 dias ou menos: 'Atenção'
 * - Menos de 0 dias: 'Vencido'
 * - Mais de 30 dias: 'Em Dia'
 */
export const calculateExpirationStatus = (expirationDateStr: string): ExpirationStatusInfo => {
  if (!expirationDateStr) {
    return {
      level: 'ok',
      daysRemaining: 9999,
      label: 'Sem Validade',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
      textColor: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-800',
      borderColor: 'border-slate-300 dark:border-slate-700',
      isUrgent: false,
      urgencyOrder: 3
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = expirationDateStr.split('-').map(Number);
  const expDate = new Date(y, (m || 1) - 1, d || 1);
  expDate.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      level: 'expired',
      daysRemaining,
      label: `Vencido há ${overdueDays} dia${overdueDays > 1 ? 's' : ''}`,
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40 font-bold',
      textColor: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'border-rose-300 dark:border-rose-800',
      isUrgent: true,
      urgencyOrder: 0
    };
  } else if (daysRemaining <= 10) {
    return {
      level: 'critical',
      daysRemaining,
      label: daysRemaining === 0 ? 'Vence Hoje!' : `Crítico (Vence em ${daysRemaining} dia${daysRemaining > 1 ? 's' : ''})`,
      badgeClass: 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/50 font-black animate-pulse',
      textColor: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/40',
      borderColor: 'border-red-300 dark:border-red-800',
      isUrgent: true,
      urgencyOrder: 1
    };
  } else if (daysRemaining <= 30) {
    return {
      level: 'warning',
      daysRemaining,
      label: `Atenção (Vence em ${daysRemaining} dia${daysRemaining > 1 ? 's' : ''})`,
      badgeClass: 'bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-500/40 font-bold',
      textColor: 'text-amber-700 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'border-amber-300 dark:border-amber-800',
      isUrgent: true,
      urgencyOrder: 2
    };
  } else {
    return {
      level: 'ok',
      daysRemaining,
      label: `Em Dia (${daysRemaining} dias)`,
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-medium',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderColor: 'border-emerald-300 dark:border-emerald-800',
      isUrgent: false,
      urgencyOrder: 3
    };
  }
};

export const INITIAL_FISCAL_DOCUMENT_TYPES: FiscalDocumentType[] = [
  { id: 'fdt_apolice_rctrc', name: 'Apólice de Seguro RCTR-C', category: 'seguro', color: 'indigo', isDefault: true, description: 'Responsabilidade Civil do Transportador Rodoviário de Carga (Obrigatório)', createdAt: new Date().toISOString() },
  { id: 'fdt_apolice_rcdc', name: 'Apólice de Seguro RC-DC', category: 'seguro', color: 'purple', isDefault: true, description: 'Responsabilidade Civil por Desaparecimento de Carga (Roubo/Desvio)', createdAt: new Date().toISOString() },
  { id: 'fdt_cnd_federal', name: 'Certidão Negativa Federal (Receita / PGFN)', category: 'certidao', color: 'blue', isDefault: true, description: 'Débitos Relativos a Tributos Federais e à Dívida Ativa da União', createdAt: new Date().toISOString() },
  { id: 'fdt_cnd_estadual', name: 'Certidão Negativa Estadual (SEFAZ)', category: 'certidao', color: 'sky', isDefault: true, description: 'Tributos Estaduais (ICMS, IPVA e Dívida Ativa Estadual)', createdAt: new Date().toISOString() },
  { id: 'fdt_cnd_municipal', name: 'Certidão Negativa Municipal (ISS / Taxas)', category: 'certidao', color: 'cyan', isDefault: true, description: 'Tributos Mobiliários e Imobiliários do Município', createdAt: new Date().toISOString() },
  { id: 'fdt_crf_fgts', name: 'Certificado de Regularidade FGTS (CRF Caixa)', category: 'certidao', color: 'emerald', isDefault: true, description: 'Situação de Regularidade do Empregador junto ao FGTS', createdAt: new Date().toISOString() },
  { id: 'fdt_cndt_trabalhista', name: 'Certidão Negativa Trabalhista (CNDT)', category: 'certidao', color: 'amber', isDefault: true, description: 'Justiça do Trabalho / Banco Nacional de Devedores Trabalhistas', createdAt: new Date().toISOString() },
  { id: 'fdt_rntrc_antt', name: 'Registro Nacional de Transportador (RNTRC / ANTT)', category: 'licenca', color: 'teal', isDefault: true, description: 'Habilitação da Empresa de Transporte de Cargas na ANTT', createdAt: new Date().toISOString() },
  { id: 'fdt_licenca_ambiental', name: 'Licença Ambiental / IBAMA', category: 'licenca', color: 'green', isDefault: true, description: 'Autorização Ambiental para Transporte Rodoviário de Cargas', createdAt: new Date().toISOString() },
  { id: 'fdt_alvara', name: 'Alvará de Funcionamento e Localização', category: 'fiscal', color: 'slate', isDefault: true, description: 'Licenciamento Municipal para Operações do Estabelecimento', createdAt: new Date().toISOString() },
  { id: 'fdt_sassmaq_iso', name: 'Certificação SASSMAQ / ISO', category: 'certidao', color: 'rose', isDefault: true, description: 'Sistema de Avaliação de Segurança, Saúde, Meio Ambiente e Qualidade', createdAt: new Date().toISOString() },
  { id: 'fdt_outros', name: 'Outros Documentos / Certificados', category: 'outros', color: 'gray', isDefault: true, description: 'Outros contratos, laudos, declarações e certidões auxiliares', createdAt: new Date().toISOString() },
];

const addDaysToDate = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const subDaysToDate = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

export const getInitialFiscalDocumentsSeed = (): FiscalDocument[] => {
  return [
    {
      id: 'fdoc_001',
      title: 'Apólice Seguro Carga RCTR-C - Porto Seguro 2026',
      typeId: 'fdt_apolice_rctrc',
      typeName: 'Apólice de Seguro RCTR-C',
      documentNumber: 'AP-RCTR-88910-2026',
      issuer: 'Porto Seguro Cia de Seguros',
      issueDate: subDaysToDate(120),
      expirationDate: addDaysToDate(145), // Em Dia
      branchId: 'Matriz',
      branchName: 'Matriz (MG)',
      notes: 'Cobertura Ampla RCTR-C para transporte nacional. Limite Máximo de Garantia (LMG) de R$ 3.000.000,00 por embarque. Corretora: Aliança Seguros.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'fdoc_002',
      title: 'Apólice Seguro Carga RC-DC - Porto Seguro 2026',
      typeId: 'fdt_apolice_rcdc',
      typeName: 'Apólice de Seguro RC-DC',
      documentNumber: 'AP-RCDC-88911-2026',
      issuer: 'Porto Seguro Cia de Seguros',
      issueDate: subDaysToDate(120),
      expirationDate: addDaysToDate(145), // Em Dia
      branchId: 'Matriz',
      branchName: 'Matriz (MG)',
      notes: 'Desaparecimento e Roubo de Carga. Regras de gerenciamento de risco e rastreamento obrigatório acima de R$ 150.000,00.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'fdoc_003',
      title: 'Certificado de Regularidade FGTS (CRF Caixa)',
      typeId: 'fdt_crf_fgts',
      typeName: 'Certificado de Regularidade FGTS (CRF Caixa)',
      documentNumber: 'CRF-2026-991283',
      issuer: 'Caixa Econômica Federal',
      issueDate: subDaysToDate(23),
      expirationDate: addDaysToDate(7), // <= 10 dias: CRÍTICO
      branchId: 'Matriz',
      branchName: 'Matriz (MG)',
      notes: 'Validade de 30 dias pela CEF. Renovação imediata requerida para emissão de fretes e concorrências públicas.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'fdoc_004',
      title: 'CND Federal Conjunta (Receita Federal & PGFN)',
      typeId: 'fdt_cnd_federal',
      typeName: 'Certidão Negativa Federal (Receita / PGFN)',
      documentNumber: 'CND-FED-7721-2026',
      issuer: 'Receita Federal do Brasil / PGFN',
      issueDate: subDaysToDate(160),
      expirationDate: addDaysToDate(20), // <= 30 dias: ATENÇÃO
      branchId: 'Matriz',
      branchName: 'Matriz (MG)',
      notes: 'Certidão conjunta de débitos previdenciários e tributos federais da matriz. Validade semestral.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'fdoc_005',
      title: 'Certificado RNTRC / ANTT - Frota Própria & Agenciados',
      typeId: 'fdt_rntrc_antt',
      typeName: 'Registro Nacional de Transportador (RNTRC / ANTT)',
      documentNumber: 'RNTRC-ETC-04891028',
      issuer: 'Agência Nacional de Transportes Terrestres (ANTT)',
      issueDate: subDaysToDate(300),
      expirationDate: addDaysToDate(280), // Em Dia
      branchId: 'Todas',
      branchName: 'Todas as Filiais',
      notes: 'Registro categoria ETC (Empresa de Transporte Rodoviário de Cargas). Revalidação ordinária qüinqüenal.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'fdoc_006',
      title: 'Licença Ambiental de Transporte de Resíduos e Químicos',
      typeId: 'fdt_licenca_ambiental',
      typeName: 'Licença Ambiental / IBAMA',
      documentNumber: 'LO-SEMAD-MG-2025/119',
      issuer: 'Secretaria Estadual de Meio Ambiente (SEMAD MG)',
      issueDate: subDaysToDate(320),
      expirationDate: addDaysToDate(45), // Em Dia (quase entrando em atenção)
      branchId: 'Matriz',
      branchName: 'Matriz (MG)',
      notes: 'Licença de Operação (LO) para transporte de cargas perigosas e produtos controlados em MG, GO e SP.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    }
  ];
};

export const getFiscalDocumentTypes = (): FiscalDocumentType[] => {
  try {
    const raw = localStorage.getItem(STORAGE_TYPES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('[fiscalControlService] Erro ao carregar tipos de documentos:', err);
  }
  // Inicializa com padrões
  try {
    localStorage.setItem(STORAGE_TYPES_KEY, JSON.stringify(INITIAL_FISCAL_DOCUMENT_TYPES));
  } catch {}
  return INITIAL_FISCAL_DOCUMENT_TYPES;
};

export const saveFiscalDocumentType = async (type: FiscalDocumentType): Promise<void> => {
  try {
    const current = getFiscalDocumentTypes();
    const existingIndex = current.findIndex(t => t.id === type.id);
    let updated: FiscalDocumentType[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...type };
    } else {
      updated = [...current, type];
    }
    safeSetLocalStorage(STORAGE_TYPES_KEY, updated);

    // Atualiza automaticamente o nome do tipo em todos os documentos que usam este tipo
    const currentDocs = getFiscalDocuments();
    let docsUpdated = false;
    const updatedDocs = currentDocs.map(d => {
      if (d.typeId === type.id && d.typeName !== type.name) {
        docsUpdated = true;
        return { ...d, typeName: type.name, updatedAt: new Date().toISOString() };
      }
      return d;
    });

    if (docsUpdated) {
      safeSetLocalStorage(STORAGE_DOCUMENTS_KEY, updatedDocs);
    }

    broadcastFiscalChange('update');

    // Persistência compartilhada no Supabase
    try {
      await supabase.from('profile_permissions').upsert({
        id: SUPABASE_FISCAL_RECORD_ID,
        permissions: {
          fiscal_documents: docsUpdated ? updatedDocs : currentDocs,
          fiscal_document_types: updated,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (cloudErr) {
      console.warn('[fiscalControlService] Falha ao sincronizar tipo com Supabase:', cloudErr);
    }
  } catch (err) {
    console.error('[fiscalControlService] Erro ao salvar tipo de documento:', err);
    throw err;
  }
};

export const deleteFiscalDocumentType = async (typeId: string): Promise<void> => {
  try {
    const current = getFiscalDocumentTypes();
    const updated = current.filter(t => t.id !== typeId);
    safeSetLocalStorage(STORAGE_TYPES_KEY, updated);
    broadcastFiscalChange('delete');

    try {
      const currentDocs = getFiscalDocuments();
      await supabase.from('profile_permissions').upsert({
        id: SUPABASE_FISCAL_RECORD_ID,
        permissions: {
          fiscal_documents: currentDocs,
          fiscal_document_types: updated,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (cloudErr) {
      console.warn('[fiscalControlService] Falha ao excluir tipo no Supabase:', cloudErr);
    }
  } catch (err) {
    console.error('[fiscalControlService] Erro ao excluir tipo de documento:', err);
  }
};

export const getFiscalDocuments = (): FiscalDocument[] => {
  try {
    const raw = localStorage.getItem(STORAGE_DOCUMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[fiscalControlService] Erro ao carregar documentos fiscais:', err);
  }

  // Inicializa seed com demonstrações
  const seed = getInitialFiscalDocumentsSeed();
  safeSetLocalStorage(STORAGE_DOCUMENTS_KEY, seed);
  return seed;
};

export const saveFiscalDocument = async (
  doc: FiscalDocument,
  author?: { id?: string; name?: string }
): Promise<void> => {
  try {
    const current = getFiscalDocuments();
    const existingIdx = current.findIndex(d => d.id === doc.id);
    let updated: FiscalDocument[];
    const nowIso = new Date().toISOString();

    const completeDoc: FiscalDocument = {
      ...doc,
      createdByUserId: doc.createdByUserId || author?.id,
      createdByName: doc.createdByName || author?.name,
      createdAt: doc.createdAt || nowIso,
      updatedAt: nowIso
    };

    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = completeDoc;
    } else {
      updated = [completeDoc, ...current];
    }

    // 1. Atualização imediata no cache local para resposta visual instantânea
    safeSetLocalStorage(STORAGE_DOCUMENTS_KEY, updated);

    // 2. Transmissão imediata via WebSocket e eventos de abas
    const action = existingIdx >= 0 ? 'update' : 'create';
    broadcastFiscalChange(action, completeDoc.id, completeDoc);

    // 3. Persistência compartilhada no Supabase (row 889 de profile_permissions)
    try {
      const currentTypes = getFiscalDocumentTypes();
      await supabase.from('profile_permissions').upsert({
        id: SUPABASE_FISCAL_RECORD_ID,
        permissions: {
          fiscal_documents: updated,
          fiscal_document_types: currentTypes,
          updatedAt: nowIso,
          updatedBy: author?.name || completeDoc.createdByName
        }
      });
    } catch (cloudErr) {
      console.warn('[fiscalControlService] Falha ao persistir documento no Supabase:', cloudErr);
    }
  } catch (err) {
    console.error('[fiscalControlService] Erro ao salvar documento fiscal:', err);
    throw err;
  }
};

export const updateFiscalDocumentTitle = async (
  docId: string,
  newTitle: string,
  author?: { id?: string; name?: string }
): Promise<FiscalDocument> => {
  const trimmed = newTitle.trim();
  if (!trimmed) {
    throw new Error('O título do documento não pode estar vazio.');
  }

  const current = getFiscalDocuments();
  const existingIdx = current.findIndex(d => d.id === docId);
  if (existingIdx === -1) {
    throw new Error('Documento fiscal não encontrado.');
  }

  const nowIso = new Date().toISOString();
  const updatedDoc: FiscalDocument = {
    ...current[existingIdx],
    title: trimmed,
    updatedAt: nowIso,
    ...(author?.id ? { createdByUserId: current[existingIdx].createdByUserId || author.id } : {}),
    ...(author?.name ? { createdByName: current[existingIdx].createdByName || author.name } : {})
  };

  const updatedList = [...current];
  updatedList[existingIdx] = updatedDoc;

  // 1. Atualização imediata no cache local para resposta visual instantânea
  safeSetLocalStorage(STORAGE_DOCUMENTS_KEY, updatedList);

  // 2. Transmissão imediata via WebSocket e eventos de abas
  broadcastFiscalChange('update', docId, updatedDoc);

  // 3. Persistência compartilhada no Supabase
  try {
    const currentTypes = getFiscalDocumentTypes();
    await supabase.from('profile_permissions').upsert({
      id: SUPABASE_FISCAL_RECORD_ID,
      permissions: {
        fiscal_documents: updatedList,
        fiscal_document_types: currentTypes,
        updatedAt: nowIso,
        updatedBy: author?.name || updatedDoc.createdByName
      }
    });
  } catch (cloudErr) {
    console.warn('[fiscalControlService] Falha ao persistir atualização de título no Supabase:', cloudErr);
  }

  return updatedDoc;
};

export const deleteFiscalDocument = async (docId: string): Promise<void> => {
  try {
    const current = getFiscalDocuments();
    const updated = current.filter(d => d.id !== docId);
    const nowIso = new Date().toISOString();

    safeSetLocalStorage(STORAGE_DOCUMENTS_KEY, updated);
    broadcastFiscalChange('delete', docId);

    try {
      const currentTypes = getFiscalDocumentTypes();
      await supabase.from('profile_permissions').upsert({
        id: SUPABASE_FISCAL_RECORD_ID,
        permissions: {
          fiscal_documents: updated,
          fiscal_document_types: currentTypes,
          updatedAt: nowIso
        }
      });
    } catch (cloudErr) {
      console.warn('[fiscalControlService] Falha ao excluir documento no Supabase:', cloudErr);
    }
  } catch (err) {
    console.error('[fiscalControlService] Erro ao excluir documento fiscal:', err);
    throw err;
  }
};

export interface FiscalKpisSummary {
  total: number;
  expired: number;
  critical: number;
  warning: number;
  ok: number;
  urgentCount: number; // expired + critical + warning
}

export const getFiscalKpisSummary = (docs: FiscalDocument[]): FiscalKpisSummary => {
  let expired = 0;
  let critical = 0;
  let warning = 0;
  let ok = 0;

  docs.forEach(doc => {
    const status = calculateExpirationStatus(doc.expirationDate);
    if (status.level === 'expired') expired++;
    else if (status.level === 'critical') critical++;
    else if (status.level === 'warning') warning++;
    else ok++;
  });

  return {
    total: docs.length,
    expired,
    critical,
    warning,
    ok,
    urgentCount: expired + critical + warning
  };
};
