import { supabase } from '../supabase';

// =============================================
// Types
// =============================================

export interface ToolClient {
  id: string;
  name: string;
}

export interface StayRecord {
  id: string;
  clientName?: string;
  driver: string;
  plate: string;
  invoice: string;
  origin: string;
  destination: string;
  location: 'Origem' | 'Destino';
  entryDate: string;
  exitDate: string;
  totalHours: number;
  weight: number;
  valuePerHour: number;
  tolerance: number;
  totalValue: number;
  calculationType?: 'TON_HOUR' | 'DAILY_FIXED';
  dailyRate?: number;
  daysCount?: number;
  approvedValue?: number;
  driverPaidValue?: number;
  cteUrl?: string;
  cteNumber?: string;
  paymentProofUrl?: string;
  status?: string;
  shipmentId?: string;
  icmsValue?: number;        // Valor do ICMS do CT-e complementar de estadia (R$)
  icmsPercentage?: number;   // Alíquota de ICMS aplicada (%)
  federalTaxValue?: number;  // Valor do Imposto Federal informado manualmente (R$)
  date: string; // = created_at, para compatibilidade com o histórico
}

const STAY_TAXES_STORAGE_KEY = 'transcunha_stay_taxes';

export interface StayTaxesData {
  icmsValue?: number;
  icmsPercentage?: number;
  federalTaxValue?: number;
}

export function getStoredStayTaxes(): Record<string, StayTaxesData> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(STAY_TAXES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveStayTaxes(stayId: string, taxes: Partial<StayTaxesData>): void {
  if (typeof window === 'undefined' || !stayId) return;
  try {
    const current = getStoredStayTaxes();
    current[stayId] = {
      ...(current[stayId] || {}),
      ...taxes
    };
    localStorage.setItem(STAY_TAXES_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Erro ao salvar tributos da estadia no storage local:', err);
  }
}

const STAY_CTE_STORAGE_KEY = 'transcunha_stay_cte_numbers';

export function getStoredStayCteNumbers(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(STAY_CTE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveStayCteNumber(stayId: string, cteNumber: string): void {
  if (typeof window === 'undefined' || !stayId || !cteNumber) return;
  try {
    const current = getStoredStayCteNumbers();
    current[stayId] = cteNumber.trim();
    localStorage.setItem(STAY_CTE_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Erro ao salvar cteNumber no storage local:', err);
  }
}

export function extractCteNumberFromStay(stay?: Partial<StayRecord> | null): string | undefined {
  if (!stay) return undefined;
  if (stay.cteNumber && stay.cteNumber.trim()) return stay.cteNumber.trim();

  // 1. Tentar ler do localStorage
  if (stay.id) {
    const stored = getStoredStayCteNumbers();
    if (stored[stay.id]) return stored[stay.id];
  }

  // 2. Tentar ler do cteUrl (se o arquivo foi salvo com padrão _CTE_12345_)
  if (stay.cteUrl) {
    const match = stay.cteUrl.match(/_CTE_([0-9]+)/i);
    if (match && match[1]) return match[1];

    const fileName = decodeURIComponent(stay.cteUrl.split('/').pop() || '');
    const cteMatch = fileName.match(/cte[-_\s]*([0-9]{3,9})/i);
    if (cteMatch && cteMatch[1]) return cteMatch[1];
  }

  return undefined;
}

export interface QuoteRecord {
  id: string;
  clientName?: string;
  productName?: string;
  userName?: string;
  date: string;
  origin: string;
  destination: string;
  distance: number;
  axes: number;
  cargoType: string;
  inputMode: 'PER_KM' | 'PER_TON';
  valuePerKm: number;
  driverTotalValue: number;
  tollValue: number;
  anttValue: number;
  weight: number;
  margin: number;
  driverFreightPerTon: number;
  companyFreightPerTon: number;
  companyTotalFreight: number;
  carrierNetProfit: number;
  carrierProfitMargin: number;
  hasIcms?: boolean;
  icmsPercentage?: number;
  icmsValue?: number;
}

const QUOTE_TAXES_STORAGE_KEY = 'transcunha_quote_taxes';

interface QuoteTaxesData {
  hasIcms?: boolean;
  icmsPercentage?: number;
  icmsValue?: number;
}

function getStoredQuoteTaxes(): Record<string, QuoteTaxesData> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(QUOTE_TAXES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveQuoteTaxes(quoteId: string, taxes: QuoteTaxesData): void {
  if (typeof window === 'undefined' || !quoteId) return;
  try {
    const current = getStoredQuoteTaxes();
    current[quoteId] = { ...(current[quoteId] || {}), ...taxes };
    localStorage.setItem(QUOTE_TAXES_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

export function toValidUuid(id: string): string {
  if (!id) return '00000000-0000-0000-0000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;

  let hex = '';
  for (let i = 0; i < id.length; i++) {
    const code = id.charCodeAt(i).toString(16);
    hex += code.length < 2 ? '0' + code : code;
  }
  const padded = (hex + '00000000000000000000000000000000').slice(0, 32);
  return `${padded.slice(0, 8)}-${padded.slice(8, 12)}-4${padded.slice(13, 16)}-a${padded.slice(17, 20)}-${padded.slice(20, 32)}`;
}

// =============================================
// Client Management
// =============================================

export async function getToolClients(userId: string): Promise<ToolClient[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('tool_clients')
    .select('id, name')
    .eq('user_id', userId)
    .order('name');

  if (error) {
    console.error('Erro ao buscar clientes:', error);
    return [];
  }

  return (data ?? []).map(row => ({ id: row.id, name: row.name }));
}

export async function getAllToolClients(): Promise<ToolClient[]> {
  const { data, error } = await supabase
    .from('tool_clients')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('Erro ao buscar todos os clientes:', error);
    return [];
  }

  const uniqueNames = new Set<string>();
  const uniqueClients: ToolClient[] = [];
  
  (data ?? []).forEach(row => {
    if (!uniqueNames.has(row.name.toLowerCase())) {
      uniqueNames.add(row.name.toLowerCase());
      uniqueClients.push({ id: row.id, name: row.name });
    }
  });

  return uniqueClients;
}

export async function saveToolClient(userId: string, name: string): Promise<ToolClient | null> {
  if (!userId || !name.trim()) return null;
  const trimmedName = name.trim();

  try {
    const { data: existing } = await supabase
      .from('tool_clients')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return { id: existing.id, name: existing.name };
    }

    const { data, error } = await supabase
      .from('tool_clients')
      .insert({ user_id: userId, name: trimmedName })
      .select('id, name')
      .maybeSingle();

    if (error) {
      console.error('Erro ao salvar cliente:', error);
      return null;
    }

    return data ? { id: data.id, name: data.name } : null;
  } catch (err) {
    console.error('Erro inesperado ao salvar cliente:', err);
    return null;
  }
}

// =============================================
// Stays Management
// =============================================

function mapRowToStayRecord(row: any, storedTaxes: Record<string, StayTaxesData>): StayRecord {
  const taxInfo = storedTaxes[row.id] || {};
  return {
    id: row.id,
    clientName: row.client_name ?? undefined,
    driver: row.driver,
    plate: row.plate,
    invoice: row.invoice ?? '',
    origin: row.origin,
    destination: row.destination,
    location: row.location as 'Origem' | 'Destino',
    entryDate: row.entry_date,
    exitDate: row.exit_date,
    totalHours: Number(row.total_hours),
    weight: Number(row.weight),
    valuePerHour: Number(row.value_per_hour),
    tolerance: Number(row.tolerance),
    totalValue: Number(row.total_value),
    calculationType: (row.status === 'DAILY_FIXED' ? 'DAILY_FIXED' : 'TON_HOUR') as 'TON_HOUR' | 'DAILY_FIXED',
    dailyRate: row.status === 'DAILY_FIXED' ? Number(row.value_per_hour) : undefined,
    approvedValue: row.approved_value != null ? Number(row.approved_value) : undefined,
    driverPaidValue: row.driver_paid_value != null ? Number(row.driver_paid_value) : undefined,
    cteUrl: row.cte_url ?? undefined,
    cteNumber: row.cte_number || extractCteNumberFromStay({ id: row.id, cteUrl: row.cte_url }),
    paymentProofUrl: row.payment_proof_url ?? undefined,
    status: row.status ?? undefined,
    shipmentId: row.shipment_id ?? undefined,
    icmsValue: row.icms_value != null ? Number(row.icms_value) : taxInfo.icmsValue,
    icmsPercentage: row.icms_percentage != null ? Number(row.icms_percentage) : taxInfo.icmsPercentage,
    federalTaxValue: row.federal_tax_value != null ? Number(row.federal_tax_value) : taxInfo.federalTaxValue,
    date: row.created_at,
  };
}

export async function getToolStays(userId: string): Promise<StayRecord[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('tool_stays')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar estadias:', error);
    return [];
  }

  const storedTaxes = getStoredStayTaxes();
  return (data ?? []).map(row => mapRowToStayRecord(row, storedTaxes));
}

export async function getAllToolStays(): Promise<StayRecord[]> {
  const { data, error } = await supabase
    .from('tool_stays')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar todas as estadias:', error);
    return [];
  }

  const storedTaxes = getStoredStayTaxes();
  return (data ?? []).map(row => mapRowToStayRecord(row, storedTaxes));
}

export async function getToolStaysByShipment(shipmentId: string): Promise<StayRecord[]> {
  if (!shipmentId) return [];

  const { data, error } = await supabase
    .from('tool_stays')
    .select('*')
    .eq('shipment_id', shipmentId);

  if (error) {
    console.error('Erro ao buscar estadias pelo embarque:', error);
    return [];
  }

  const storedTaxes = getStoredStayTaxes();
  return (data ?? []).map(row => mapRowToStayRecord(row, storedTaxes));
}

export async function saveToolStay(
  userId: string,
  stay: Omit<StayRecord, 'id' | 'date'>
): Promise<StayRecord | null> {
  if (!userId) return null;

  const stayStatus = stay.calculationType || stay.status || 'TON_HOUR';
  const payload: Record<string, any> = {
    user_id: userId,
    client_name: stay.clientName ?? null,
    driver: stay.driver,
    plate: stay.plate,
    invoice: stay.invoice ?? null,
    origin: stay.origin,
    destination: stay.destination,
    location: stay.location,
    entry_date: stay.entryDate,
    exit_date: stay.exitDate,
    total_hours: stay.totalHours,
    weight: stay.weight,
    value_per_hour: stay.valuePerHour,
    tolerance: stay.tolerance,
    total_value: stay.totalValue,
    approved_value: stay.approvedValue ?? null,
    driver_paid_value: stay.driverPaidValue ?? null,
    cte_url: stay.cteUrl ?? null,
    payment_proof_url: stay.paymentProofUrl ?? null,
    status: stayStatus,
    shipment_id: stay.shipmentId ?? null,
  };

  let { data, error } = await supabase
    .from('tool_stays')
    .insert(payload)
    .select('*')
    .single();

  let retryCount = 0;
  while (error && retryCount < 6) {
    const msg = error.message || '';
    const match =
      msg.match(/Could not find the '([^']+)' column/i) ||
      msg.match(/column "?([^"'\s]+)"? of relation/i);
    if (match && match[1] && match[1] in payload) {
      delete payload[match[1]];
      const retry = await supabase.from('tool_stays').insert(payload).select('*').single();
      data = retry.data;
      error = retry.error;
      retryCount++;
    } else {
      break;
    }
  }

  if (error) {
    console.error('Erro ao salvar estadia:', error);
    return null;
  }

  if (data && stay.cteNumber) {
    saveStayCteNumber(data.id, stay.cteNumber);
  }

  if (data && (stay.icmsValue !== undefined || stay.icmsPercentage !== undefined || stay.federalTaxValue !== undefined)) {
    saveStayTaxes(data.id, {
      icmsValue: stay.icmsValue,
      icmsPercentage: stay.icmsPercentage,
      federalTaxValue: stay.federalTaxValue
    });
  }

  return data ? mapRowToStayRecord(data, getStoredStayTaxes()) : null;
}

export async function deleteToolStay(id: string): Promise<void> {
  const { error } = await supabase.from('tool_stays').delete().eq('id', id);
  if (error) console.error('Erro ao excluir estadia:', error);
}

export async function uploadStayAttachment(
  stayId: string, 
  type: 'cte_complementar' | 'comprovante_pagamento', 
  file: File,
  cteNumber?: string
): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const cleanCte = cteNumber ? `_CTE_${cteNumber.replace(/\D/g, '')}` : '';
  const fileName = `${stayId}_${type}${cleanCte}_${Date.now()}.${fileExt}`;
  const filePath = `stays/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('shipment_attachments')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Erro ao fazer upload do anexo da estadia:', uploadError);
    return null;
  }

  return filePath;
}

export async function updateToolStay(
  id: string,
  updates: Partial<StayRecord>
): Promise<StayRecord | null> {
  // Se foi fornecido cteNumber, persistir no storage local
  if (updates.cteNumber !== undefined) {
    saveStayCteNumber(id, updates.cteNumber);
  }

  // Persistir tributos da estadia no storage local garantindo persistência imediata
  if (updates.icmsValue !== undefined || updates.icmsPercentage !== undefined || updates.federalTaxValue !== undefined) {
    saveStayTaxes(id, {
      icmsValue: updates.icmsValue,
      icmsPercentage: updates.icmsPercentage,
      federalTaxValue: updates.federalTaxValue
    });
  }

  const payload: any = {};
  if (updates.clientName !== undefined) payload.client_name = updates.clientName;
  if (updates.driver !== undefined) payload.driver = updates.driver;
  if (updates.plate !== undefined) payload.plate = updates.plate;
  if (updates.invoice !== undefined) payload.invoice = updates.invoice;
  if (updates.origin !== undefined) payload.origin = updates.origin;
  if (updates.destination !== undefined) payload.destination = updates.destination;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.entryDate !== undefined) payload.entry_date = updates.entryDate;
  if (updates.exitDate !== undefined) payload.exit_date = updates.exitDate;
  if (updates.totalHours !== undefined) payload.total_hours = updates.totalHours;
  if (updates.weight !== undefined) payload.weight = updates.weight;
  if (updates.valuePerHour !== undefined) payload.value_per_hour = updates.valuePerHour;
  if (updates.tolerance !== undefined) payload.tolerance = updates.tolerance;
  if (updates.totalValue !== undefined) payload.total_value = updates.totalValue;
  if (updates.approvedValue !== undefined) payload.approved_value = updates.approvedValue;
  if (updates.driverPaidValue !== undefined) payload.driver_paid_value = updates.driverPaidValue;
  if (updates.cteUrl !== undefined) payload.cte_url = updates.cteUrl;
  if (updates.paymentProofUrl !== undefined) payload.payment_proof_url = updates.paymentProofUrl;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.shipmentId !== undefined) payload.shipment_id = updates.shipmentId;

  if (Object.keys(payload).length === 0) {
    const storedTaxes = getStoredStayTaxes()[id] || {};
    const { data: currentRow } = await supabase.from('tool_stays').select('*').eq('id', id).maybeSingle();
    if (currentRow) {
      return mapRowToStayRecord(currentRow, getStoredStayTaxes());
    }
    return {
      id,
      driver: '',
      plate: '',
      invoice: '',
      origin: '',
      destination: '',
      location: 'Origem',
      entryDate: '',
      exitDate: '',
      totalHours: 0,
      weight: 0,
      valuePerHour: 0,
      tolerance: 0,
      totalValue: 0,
      cteNumber: updates.cteNumber || extractCteNumberFromStay({ id }),
      icmsValue: updates.icmsValue ?? storedTaxes.icmsValue,
      icmsPercentage: updates.icmsPercentage ?? storedTaxes.icmsPercentage,
      federalTaxValue: updates.federalTaxValue ?? storedTaxes.federalTaxValue,
      date: new Date().toISOString()
    };
  }

  let { data, error } = await supabase
    .from('tool_stays')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  let retryCount = 0;
  while (error && retryCount < 6) {
    const msg = error.message || '';
    const match =
      msg.match(/Could not find the '([^']+)' column/i) ||
      msg.match(/column "?([^"'\s]+)"? of relation/i);
    if (match && match[1] && match[1] in payload) {
      delete payload[match[1]];
      if (Object.keys(payload).length === 0) {
        error = null;
        break;
      }
      const retry = await supabase.from('tool_stays').update(payload).eq('id', id).select('*').single();
      data = retry.data;
      error = retry.error;
      retryCount++;
    } else {
      break;
    }
  }

  if (error) {
    console.error('Erro ao atualizar estadia:', error);
    return null;
  }

  return data ? mapRowToStayRecord(data, getStoredStayTaxes()) : null;
}

// =============================================
// Quotes Management
// =============================================

function mapRowToQuoteRecord(row: any, storedTaxes: Record<string, QuoteTaxesData>): QuoteRecord {
  const taxInfo = storedTaxes[row.id] || {};
  const icmsPct = row.icms_percentage != null ? Number(row.icms_percentage) : taxInfo.icmsPercentage;
  const icmsVal = row.icms_value != null ? Number(row.icms_value) : taxInfo.icmsValue;
  const hasIcms = row.has_icms !== undefined ? !!row.has_icms : (taxInfo.hasIcms ?? (Number(icmsPct) > 0 || Number(icmsVal) > 0));

  return {
    id: row.id,
    clientName: row.client_name ?? undefined,
    productName: row.product_name ?? undefined,
    userName: row.user_name ?? undefined,
    date: row.created_at,
    origin: row.origin,
    destination: row.destination,
    distance: Number(row.distance),
    axes: Number(row.axes),
    cargoType: row.cargo_type,
    inputMode: row.input_mode as 'PER_KM' | 'PER_TON',
    valuePerKm: Number(row.value_per_km),
    driverTotalValue: Number(row.driver_total_value),
    tollValue: Number(row.toll_value),
    anttValue: Number(row.antt_value),
    weight: Number(row.weight),
    margin: Number(row.margin),
    driverFreightPerTon: Number(row.driver_freight_per_ton),
    companyFreightPerTon: Number(row.company_freight_per_ton),
    companyTotalFreight: Number(row.company_total_freight),
    carrierNetProfit: Number(row.carrier_net_profit),
    carrierProfitMargin: Number(row.carrier_profit_margin),
    hasIcms,
    icmsPercentage: icmsPct,
    icmsValue: icmsVal,
  };
}

export async function getToolQuotes(userId: string): Promise<QuoteRecord[]> {
  if (!userId) return [];
  const validUserId = toValidUuid(userId);

  const { data, error } = await supabase
    .from('tool_quotes')
    .select('*')
    .eq('user_id', validUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar cotações:', error);
    return [];
  }

  const storedTaxes = getStoredQuoteTaxes();
  return (data ?? []).map(row => mapRowToQuoteRecord(row, storedTaxes));
}

export async function getAllToolQuotes(): Promise<QuoteRecord[]> {
  const { data, error } = await supabase
    .from('tool_quotes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar todas as cotações:', error);
    return [];
  }

  const storedTaxes = getStoredQuoteTaxes();
  return (data ?? []).map(row => mapRowToQuoteRecord(row, storedTaxes));
}

export async function saveToolQuote(
  userId: string,
  quote: Omit<QuoteRecord, 'id' | 'date'>
): Promise<QuoteRecord | null> {
  if (!userId) return null;
  const validUserId = toValidUuid(userId);

  const payload: Record<string, any> = {
    user_id: validUserId,
    client_name: quote.clientName ?? null,
    product_name: quote.productName ?? null,
    user_name: quote.userName ?? null,
    origin: quote.origin,
    destination: quote.destination,
    distance: quote.distance,
    axes: quote.axes,
    cargo_type: quote.cargoType,
    input_mode: quote.inputMode,
    value_per_km: quote.valuePerKm,
    driver_total_value: quote.driverTotalValue,
    toll_value: quote.tollValue,
    antt_value: quote.anttValue,
    weight: quote.weight,
    margin: quote.margin,
    driver_freight_per_ton: quote.driverFreightPerTon,
    company_freight_per_ton: quote.companyFreightPerTon,
    company_total_freight: quote.companyTotalFreight,
    carrier_net_profit: quote.carrierNetProfit,
    carrier_profit_margin: quote.carrierProfitMargin,
  };

  let { data, error } = await supabase
    .from('tool_quotes')
    .insert(payload)
    .select('*')
    .single();

  let retryCount = 0;
  while (error && retryCount < 6) {
    const msg = error.message || '';
    const match =
      msg.match(/Could not find the '([^']+)' column/i) ||
      msg.match(/column "?([^"'\s]+)"? of relation/i) ||
      msg.match(/column "?([^"'\s]+)"? does not exist/i);

    if (match && match[1] && payload[match[1]] !== undefined) {
      delete payload[match[1]];
      const retry = await supabase.from('tool_quotes').insert(payload).select('*').single();
      data = retry.data;
      error = retry.error;
      retryCount++;
    } else if (error.code === '22P02') {
      payload.user_id = userId;
      const retry = await supabase.from('tool_quotes').insert(payload).select('*').single();
      data = retry.data;
      error = retry.error;
      break;
    } else {
      break;
    }
  }

  if (error) {
    console.error('Erro ao salvar cotação:', error);
    return null;
  }

  if (data && (quote.hasIcms !== undefined || quote.icmsPercentage !== undefined || quote.icmsValue !== undefined)) {
    saveQuoteTaxes(data.id, {
      hasIcms: quote.hasIcms,
      icmsPercentage: quote.icmsPercentage,
      icmsValue: quote.icmsValue,
    });
  }

  return data ? mapRowToQuoteRecord(data, getStoredQuoteTaxes()) : null;
}

export async function deleteToolQuote(id: string): Promise<void> {
  const { error } = await supabase.from('tool_quotes').delete().eq('id', id);
  if (error) console.error('Erro ao excluir cotação:', error);
}

export async function updateToolQuote(
  id: string,
  updates: Partial<Omit<QuoteRecord, 'id' | 'date'>>
): Promise<QuoteRecord | null> {
  if (updates.hasIcms !== undefined || updates.icmsPercentage !== undefined || updates.icmsValue !== undefined) {
    saveQuoteTaxes(id, {
      hasIcms: updates.hasIcms,
      icmsPercentage: updates.icmsPercentage,
      icmsValue: updates.icmsValue,
    });
  }

  const payload: any = {};
  if (updates.clientName !== undefined) payload.client_name = updates.clientName;
  if (updates.productName !== undefined) payload.product_name = updates.productName;
  if (updates.origin !== undefined) payload.origin = updates.origin;
  if (updates.destination !== undefined) payload.destination = updates.destination;
  if (updates.axes !== undefined) payload.axes = updates.axes;
  if (updates.cargoType !== undefined) payload.cargo_type = updates.cargoType;
  if (updates.weight !== undefined) payload.weight = updates.weight;
  if (updates.tollValue !== undefined) payload.toll_value = updates.tollValue;
  if (updates.margin !== undefined) payload.margin = updates.margin;
  if (updates.valuePerKm !== undefined) payload.value_per_km = updates.valuePerKm;
  if (updates.driverTotalValue !== undefined) payload.driver_total_value = updates.driverTotalValue;
  if (updates.anttValue !== undefined) payload.antt_value = updates.anttValue;
  if (updates.driverFreightPerTon !== undefined) payload.driver_freight_per_ton = updates.driverFreightPerTon;
  if (updates.companyFreightPerTon !== undefined) payload.company_freight_per_ton = updates.companyFreightPerTon;
  if (updates.companyTotalFreight !== undefined) payload.company_total_freight = updates.companyTotalFreight;
  if (updates.carrierNetProfit !== undefined) payload.carrier_net_profit = updates.carrierNetProfit;
  if (updates.carrierProfitMargin !== undefined) payload.carrier_profit_margin = updates.carrierProfitMargin;

  if (Object.keys(payload).length === 0) return null;

  let { data, error } = await supabase
    .from('tool_quotes')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  let retryCount = 0;
  while (error && retryCount < 6) {
    const msg = error.message || '';
    const match =
      msg.match(/Could not find the '([^']+)' column/i) ||
      msg.match(/column "?([^"'\s]+)"? of relation/i);
    if (match && match[1] && match[1] in payload) {
      delete payload[match[1]];
      if (Object.keys(payload).length === 0) {
        error = null;
        break;
      }
      const retry = await supabase.from('tool_quotes').update(payload).eq('id', id).select('*').single();
      data = retry.data;
      error = retry.error;
      retryCount++;
    } else {
      break;
    }
  }

  if (error) {
    console.error('Erro ao atualizar cotação:', error);
    return null;
  }

  return data ? mapRowToQuoteRecord(data, getStoredQuoteTaxes()) : null;
}
