import { supabase } from '../../supabase';


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
  approvedValue?: number;
  driverPaidValue?: number;
  cteUrl?: string;
  paymentProofUrl?: string;
  status?: string;
  shipmentId?: string;
  date: string; // = created_at, para compatibilidade com o histórico
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

  return (data ?? []).map((row: any) => ({ id: row.id, name: row.name }));
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

  // Remove duplicates by name if multiple users saved the same client name
  const uniqueNames = new Set<string>();
  const uniqueClients: ToolClient[] = [];
  
  (data ?? []).forEach((row: any) => {
    if (!uniqueNames.has(row.name.toLowerCase())) {
      uniqueNames.add(row.name.toLowerCase());
      uniqueClients.push({ id: row.id, name: row.name });
    }
  });

  return uniqueClients;
}

export async function saveToolClient(userId: string, name: string): Promise<ToolClient | null> {
  if (!userId || !name.trim()) return null;

  const { data, error } = await supabase
    .from('tool_clients')
    .upsert({ user_id: userId, name: name.trim() }, { onConflict: 'user_id,name' })
    .select('id, name')
    .single();

  if (error) {
    console.error('Erro ao salvar cliente:', error);
    return null;
  }

  return data ? { id: data.id, name: data.name } : null;
}

// =============================================
// Stays Management
// =============================================

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

  return (data ?? []).map((row: any) => ({
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
    approvedValue: row.approved_value != null ? Number(row.approved_value) : undefined,
    driverPaidValue: row.driver_paid_value != null ? Number(row.driver_paid_value) : undefined,
    cteUrl: row.cte_url ?? undefined,
    paymentProofUrl: row.payment_proof_url ?? undefined,
    status: row.status ?? undefined,
    shipmentId: row.shipment_id ?? undefined,
    date: row.created_at,
  }));
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

  return (data ?? []).map((row: any) => ({
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
    approvedValue: row.approved_value != null ? Number(row.approved_value) : undefined,
    driverPaidValue: row.driver_paid_value != null ? Number(row.driver_paid_value) : undefined,
    cteUrl: row.cte_url ?? undefined,
    paymentProofUrl: row.payment_proof_url ?? undefined,
    status: row.status ?? undefined,
    shipmentId: row.shipment_id ?? undefined,
    date: row.created_at,
  }));
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

  return (data ?? []).map((row: any) => ({
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
    approvedValue: row.approved_value != null ? Number(row.approved_value) : undefined,
    driverPaidValue: row.driver_paid_value != null ? Number(row.driver_paid_value) : undefined,
    status: row.status ?? undefined,
    shipmentId: row.shipment_id ?? undefined,
    cteUrl: row.cte_url ?? undefined,
    paymentProofUrl: row.payment_proof_url ?? undefined,
    date: row.created_at,
  }));
}

export async function saveToolStay(
  userId: string,
  stay: Omit<StayRecord, 'id' | 'date'>
): Promise<StayRecord | null> {
  if (!userId) return null;

  const payload: any = {
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
    status: stay.status ?? null,
    shipment_id: stay.shipmentId ?? null,
  };

  let { data, error } = await supabase
    .from('tool_stays')
    .insert(payload)
    .select('*')
    .single();

  let retryCount = 0;
  while (error && error.code === '42703' && retryCount < 5) {
    const match = error.message.match(/column "(.*?)" of relation/);
    if (match && match[1]) {
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
    if (typeof window !== 'undefined') {
      alert(`Erro no banco de dados (Estadia): ${error.message || JSON.stringify(error)}`);
    }
    return null;
  }

  return data
    ? {
        id: data.id,
        clientName: data.client_name ?? undefined,
        driver: data.driver,
        plate: data.plate,
        invoice: data.invoice ?? '',
        origin: data.origin,
        destination: data.destination,
        location: data.location as 'Origem' | 'Destino',
        entryDate: data.entry_date,
        exitDate: data.exit_date,
        totalHours: Number(data.total_hours),
        weight: Number(data.weight),
        valuePerHour: Number(data.value_per_hour),
        tolerance: Number(data.tolerance),
        totalValue: Number(data.total_value),
        approvedValue: data.approved_value != null ? Number(data.approved_value) : undefined,
        driverPaidValue: data.driver_paid_value != null ? Number(data.driver_paid_value) : undefined,
        status: data.status ?? undefined,
        shipmentId: data.shipment_id ?? undefined,
        cteUrl: data.cte_url ?? undefined,
        paymentProofUrl: data.payment_proof_url ?? undefined,
        date: data.created_at,
      }
    : null;
}

export async function deleteToolStay(id: string): Promise<void> {
  const { error } = await supabase.from('tool_stays').delete().eq('id', id);
  if (error) console.error('Erro ao excluir estadia:', error);
}

export async function uploadStayAttachment(stayId: string, type: 'cte_complementar' | 'comprovante_pagamento', file: File): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${stayId}_${type}_${Math.random().toString(36).substring(2)}.${fileExt}`;
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

  if (Object.keys(payload).length === 0) return null;

  const { data, error } = await supabase
    .from('tool_stays')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Erro ao atualizar estadia:', error);
    return null;
  }

  return data
    ? {
        id: data.id,
        clientName: data.client_name ?? undefined,
        driver: data.driver,
        plate: data.plate,
        invoice: data.invoice ?? '',
        origin: data.origin,
        destination: data.destination,
        location: data.location as 'Origem' | 'Destino',
        entryDate: data.entry_date,
        exitDate: data.exit_date,
        totalHours: Number(data.total_hours),
        weight: Number(data.weight),
        valuePerHour: Number(data.value_per_hour),
        tolerance: Number(data.tolerance),
        totalValue: Number(data.total_value),
        approvedValue: data.approved_value != null ? Number(data.approved_value) : undefined,
        driverPaidValue: data.driver_paid_value != null ? Number(data.driver_paid_value) : undefined,
        status: data.status ?? undefined,
        shipmentId: data.shipment_id ?? undefined,
        cteUrl: data.cte_url ?? undefined,
        paymentProofUrl: data.payment_proof_url ?? undefined,
        date: data.created_at,
      }
    : null;
}

// =============================================
// Quotes Management
// =============================================

export async function getToolQuotes(userId: string): Promise<QuoteRecord[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('tool_quotes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar cotações:', error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
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
  }));
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

  return (data ?? []).map((row: any) => ({
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
  }));
}

export async function saveToolQuote(
  userId: string,
  quote: Omit<QuoteRecord, 'id' | 'date'>
): Promise<QuoteRecord | null> {
  if (!userId) return null;

  const payload: any = {
    user_id: userId,
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
  while (error && error.code === '42703' && retryCount < 5) {
    const match = error.message.match(/column "(.*?)" of relation/);
    if (match && match[1]) {
      delete payload[match[1]];
      const retry = await supabase.from('tool_quotes').insert(payload).select('*').single();
      data = retry.data;
      error = retry.error;
      retryCount++;
    } else {
      break;
    }
  }

  if (error) {
    console.error('Erro ao salvar cotação:', error);
    if (typeof window !== 'undefined') {
      alert(`Erro no banco de dados (Cotação): ${error.message || JSON.stringify(error)}`);
    }
    return null;
  }

  return data
    ? {
        id: data.id,
        clientName: data.client_name ?? undefined,
        productName: data.product_name ?? undefined,
        userName: data.user_name ?? undefined,
        date: data.created_at,
        origin: data.origin,
        destination: data.destination,
        distance: Number(data.distance),
        axes: Number(data.axes),
        cargoType: data.cargo_type,
        inputMode: data.input_mode as 'PER_KM' | 'PER_TON',
        valuePerKm: Number(data.value_per_km),
        driverTotalValue: Number(data.driver_total_value),
        tollValue: Number(data.toll_value),
        anttValue: Number(data.antt_value),
        weight: Number(data.weight),
        margin: Number(data.margin),
        driverFreightPerTon: Number(data.driver_freight_per_ton),
        companyFreightPerTon: Number(data.company_freight_per_ton),
        companyTotalFreight: Number(data.company_total_freight),
        carrierNetProfit: Number(data.carrier_net_profit),
        carrierProfitMargin: Number(data.carrier_profit_margin),
      }
    : null;
}

export async function deleteToolQuote(id: string): Promise<void> {
  const { error } = await supabase.from('tool_quotes').delete().eq('id', id);
  if (error) console.error('Erro ao excluir cotação:', error);
}

export async function updateToolQuote(
  id: string,
  updates: Partial<Omit<QuoteRecord, 'id' | 'date'>>
): Promise<QuoteRecord | null> {
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

  const { data, error } = await supabase
    .from('tool_quotes')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Erro ao atualizar cotação:', error);
    return null;
  }

  return data
    ? {
        id: data.id,
        clientName: data.client_name ?? undefined,
        productName: data.product_name ?? undefined,
        userName: data.user_name ?? undefined,
        date: data.created_at,
        origin: data.origin,
        destination: data.destination,
        distance: Number(data.distance),
        axes: Number(data.axes),
        cargoType: data.cargo_type,
        inputMode: data.input_mode as 'PER_KM' | 'PER_TON',
        valuePerKm: Number(data.value_per_km),
        driverTotalValue: Number(data.driver_total_value),
        tollValue: Number(data.toll_value),
        anttValue: Number(data.antt_value),
        weight: Number(data.weight),
        margin: Number(data.margin),
        driverFreightPerTon: Number(data.driver_freight_per_ton),
        companyFreightPerTon: Number(data.company_freight_per_ton),
        companyTotalFreight: Number(data.company_total_freight),
        carrierNetProfit: Number(data.carrier_net_profit),
        carrierProfitMargin: Number(data.carrier_profit_margin),
      }
    : null;
}
