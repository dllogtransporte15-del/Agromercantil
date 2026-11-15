import { supabase } from '../supabase';
import type { ExpedidorRecebedor, Cargo } from '../types';

const STORAGE_KEY = 'transcunha_expedidores_recebedores';

/**
 * Lê de forma síncrona os registros de Expedidor/Recebedor do localStorage.
 */
export function getExpedidoresRecebedores(): ExpedidorRecebedor[] {
  let localList: ExpedidorRecebedor[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        localList = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Erro ao ler expedidores do localStorage:', err);
    }
  }
  return localList.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Tenta buscar da tabela 'locations' do Supabase em segundo plano e sincroniza o localStorage.
 */
export async function fetchRemoteExpedidoresRecebedores(): Promise<ExpedidorRecebedor[]> {
  const localList = getExpedidoresRecebedores();
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const remoteList: ExpedidorRecebedor[] = data.map(row => ({
        id: row.id,
        name: row.name,
        documentType: row.document_type || (row.document_number?.length > 14 ? 'CNPJ' : 'CPF'),
        documentNumber: row.document_number || '',
        phone: row.phone || '',
        isWhatsapp: row.is_whatsapp ?? true,
        classification: 'Ambos',
        city: row.city || undefined,
        state: row.state || undefined,
        mapLink: row.map_link || undefined,
        notes: row.notes || undefined,
        createdAt: row.created_at || new Date().toISOString()
      }));

      const map = new Map<string, ExpedidorRecebedor>();
      localList.forEach(item => map.set(item.id || item.name.toLowerCase().trim(), item));
      remoteList.forEach(item => map.set(item.id || item.name.toLowerCase().trim(), item));

      const merged = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    }
  } catch {
    // Falha silenciosa se a tabela não existir
  }
  return localList;
}

/**
 * Salva ou atualiza um Expedidor/Recebedor (Local) e retorna a lista completa atualizada.
 */
export async function saveExpedidorRecebedor(
  data: Partial<ExpedidorRecebedor> & { name: string }
): Promise<ExpedidorRecebedor[]> {
  const current = getExpedidoresRecebedores();
  const isEditing = Boolean(data.id);
  const id = isEditing 
    ? (data.id as string)
    : `LOC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  
  const createdAt = data.createdAt || new Date().toISOString();

  const record: ExpedidorRecebedor = {
    id,
    name: data.name.trim(),
    documentType: data.documentType || 'CNPJ',
    documentNumber: (data.documentNumber || '').trim(),
    phone: (data.phone || '').trim(),
    isWhatsapp: data.isWhatsapp !== undefined ? Boolean(data.isWhatsapp) : true,
    classification: 'Ambos', // REGRA: Sempre fixo como "Ambos" (Expedidor/Recebedor)
    city: data.city?.trim() || undefined,
    state: data.state?.trim() || undefined,
    mapLink: data.mapLink?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    createdAt
  };

  const existingIdx = current.findIndex(i => i.id === record.id || i.name.toLowerCase().trim() === record.name.toLowerCase().trim());
  let updated: ExpedidorRecebedor[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...record };
  } else {
    updated = [record, ...current];
  }
  updated.sort((a, b) => a.name.localeCompare(b.name));

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Erro ao salvar no localStorage:', err);
    }
  }

  // Tentar persistir no Supabase
  try {
    await supabase.from('locations').upsert({
      id: record.id,
      name: record.name,
      document_type: record.documentType,
      document_number: record.documentNumber,
      phone: record.phone,
      is_whatsapp: record.isWhatsapp,
      classification: 'Ambos',
      city: record.city || null,
      state: record.state || null,
      map_link: record.mapLink || null,
      notes: record.notes || null,
      created_at: record.createdAt
    });
  } catch {
    // Falha silenciosa
  }

  return updated;
}

/**
 * Remove um Expedidor/Recebedor pelo ID e retorna a lista atualizada.
 */
export async function deleteExpedidorRecebedor(id: string): Promise<ExpedidorRecebedor[]> {
  const current = getExpedidoresRecebedores();
  const updated = current.filter(item => item.id !== id);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Erro ao excluir do localStorage:', err);
    }
  }

  try {
    await supabase.from('locations').delete().eq('id', id);
  } catch {
    // Silencioso se tabela não existir
  }

  return updated;
}

/**
 * Localiza um Expedidor/Recebedor pelo nome exato ou aproximado.
 */
export function findExpedidorRecebedorByName(
  name?: string,
  list?: ExpedidorRecebedor[]
): ExpedidorRecebedor | undefined {
  if (!name || !name.trim()) return undefined;
  const clean = name.trim().toLowerCase();
  const source = list || getExpedidoresRecebedores();
  return source.find(item => item.name.toLowerCase().trim() === clean);
}

/**
 * Sincroniza e cadastra os locais informados nas cargas
 * que ainda não possuem cadastro na lista de Expedidor/Recebedor.
 */
export function syncLocationsFromCargos(cargos: Cargo[]): ExpedidorRecebedor[] {
  const current = getExpedidoresRecebedores();
  const existingNames = new Set(current.map(c => c.name.toLowerCase().trim()));
  const newRecords: ExpedidorRecebedor[] = [];

  for (const cargo of cargos) {
    // Origem
    if (cargo.originLocation && cargo.originLocation.trim()) {
      const originName = cargo.originLocation.trim();
      if (!existingNames.has(originName.toLowerCase())) {
        existingNames.add(originName.toLowerCase());
        newRecords.push({
          id: `LOC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          name: originName,
          documentType: 'CNPJ',
          documentNumber: '',
          phone: '',
          isWhatsapp: true,
          classification: 'Ambos',
          city: cargo.origin || undefined,
          mapLink: cargo.originMapLink || undefined,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Destino
    if (cargo.destinationLocation && cargo.destinationLocation.trim()) {
      const destName = cargo.destinationLocation.trim();
      if (!existingNames.has(destName.toLowerCase())) {
        existingNames.add(destName.toLowerCase());
        newRecords.push({
          id: `LOC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          name: destName,
          documentType: 'CNPJ',
          documentNumber: '',
          phone: '',
          isWhatsapp: true,
          classification: 'Ambos',
          city: cargo.destination || undefined,
          mapLink: cargo.destinationMapLink || undefined,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Pernas extras de destino
    const extraLegs = (cargo as any).multiLegDestinations;
    if (extraLegs && Array.isArray(extraLegs)) {
      for (const leg of extraLegs) {
        if (leg && leg.location && leg.location.trim()) {
          const legName = leg.location.trim();
          if (!existingNames.has(legName.toLowerCase())) {
            existingNames.add(legName.toLowerCase());
            newRecords.push({
              id: `LOC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              name: legName,
              documentType: 'CNPJ',
              documentNumber: '',
              phone: '',
              isWhatsapp: true,
              classification: 'Ambos',
              city: leg.city || undefined,
              mapLink: leg.mapLink || undefined,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }
  }

  if (newRecords.length > 0) {
    const combined = [...newRecords, ...current].sort((a, b) => a.name.localeCompare(b.name));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
      } catch {}
    }
    return combined;
  }

  return current;
}
