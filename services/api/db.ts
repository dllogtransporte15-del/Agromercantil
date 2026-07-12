import { supabase } from '../../supabase';
import type {
  Client, Owner, Driver, Vehicle, Product, Cargo, Shipment, User, Ticket, ProfilePermissions, ShipmentLock, Branch
} from '../../types';

// ─────────────────────────────────────────────
// HELPERS: Map DB rows (snake_case) ↔ App types (camelCase)
// ─────────────────────────────────────────────

const toClient = (row: any): Client => ({
  id: row.id,
  razaoSocial: row.razao_social,
  nomeFantasia: row.nome_fantasia,
  cnpj: row.cnpj,
  phone: row.phone,
  email: row.email,
  address: row.address,
  city: row.city,
  state: row.state,
  paymentMethod: row.payment_method,
  paymentTerm: row.payment_term,
  requiresExternalOrder: row.requires_external_order,
  requiresScheduling: row.requires_scheduling,
});

const fromClient = (c: Client | Omit<Client, 'id'>) => ({
  id: (c as Client).id,
  razao_social: c.razaoSocial,
  nome_fantasia: c.nomeFantasia,
  cnpj: c.cnpj,
  phone: c.phone,
  email: c.email,
  address: c.address,
  city: c.city,
  state: c.state,
  payment_method: c.paymentMethod,
  payment_term: c.paymentTerm,
  requires_external_order: c.requiresExternalOrder,
  requires_scheduling: c.requiresScheduling,
});

const toOwner = (row: any): Owner => ({
  id: row.id,
  name: row.name,
  cpfCnpj: row.cpf_cnpj,
  phone: row.phone,
  type: row.type,
  bankDetails: row.bank_details,
});

const fromOwner = (o: Owner | Omit<Owner, 'id'>) => ({
  id: (o as Owner).id,
  name: o.name,
  cpf_cnpj: o.cpfCnpj,
  phone: o.phone,
  type: o.type,
  bank_details: o.bankDetails,
});

const toDriver = (row: any): Driver => ({
  id: row.id,
  name: row.name,
  cpf: row.cpf,
  cnh: row.cnh,
  phone: row.phone,
  classification: row.classification,
  ownerId: row.owner_id,
  active: row.active ?? true,
  restrictionReason: row.restriction_reason,
});

const fromDriver = (d: Driver | Omit<Driver, 'id'>) => ({
  id: (d as Driver).id,
  name: d.name,
  cpf: d.cpf,
  cnh: d.cnh,
  phone: d.phone,
  classification: d.classification,
  owner_id: d.ownerId || null,
  active: d.active !== undefined ? d.active : true,
  restriction_reason: d.restrictionReason,
});

const toVehicle = (row: any): Vehicle => ({
  id: row.id,
  plate: row.plate,
  setType: row.set_type,
  bodyType: row.body_type,
  classification: row.classification,
  driverId: row.driver_id,
  ownerId: row.owner_id,
});

const fromVehicle = (v: Vehicle | Omit<Vehicle, 'id'>) => ({
  id: (v as Vehicle).id,
  plate: v.plate,
  set_type: v.setType,
  body_type: v.bodyType,
  classification: v.classification,
  driver_id: v.driverId || null,
  owner_id: v.ownerId || null,
});

const toProduct = (row: any): Product => ({
  id: row.id,
  name: row.name,
  unit: row.unit,
});

const toCargo = (row: any): Cargo => {
  const freightLegs = row.freight_legs || [];
  const disableDriverFreightPF = freightLegs.some((leg: any) => leg.disableDriverFreightPF);
  return {
    id: row.id,
    sequenceId: row.sequence_id,
    clientId: row.client_id,
    productId: row.product_id,
    origin: row.origin,
    originLocation: row.origin_location,
    originMapLink: row.origin_map_link,
    destination: row.destination,
    destinationLocation: row.destination_location,
    destinationMapLink: row.destination_map_link,
    totalVolume: Number(row.total_volume),
    scheduledVolume: Number(row.scheduled_volume),
    loadedVolume: Number(row.loaded_volume),
    companyFreightValuePerTon: Number(row.company_freight_value_per_ton),
    driverFreightValuePerTonPJ: Number(row.driver_freight_value_per_ton_pj || row.driver_freight_value_per_ton || 0),
    driverFreightValuePerTonPF: Number(row.driver_freight_value_per_ton_pf || row.driver_freight_value_per_ton || 0),
    driverFreightValuePerTon: Number(row.driver_freight_value_per_ton),
    hasIcms: row.has_icms,
    icmsPercentage: Number(row.icms_percentage),
    requiresScheduling: row.requires_scheduling,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    createdById: row.created_by_id,
    history: row.history || [],
    loadingStartDate: row.loading_start_date,
    loadingDeadline: row.loading_deadline,
    allowedVehicleTypes: row.allowed_vehicle_types,
    freightLegs,
    dailySchedule: row.daily_schedule,
    observations: row.observations,
    attachments: row.attachments || [],
    originCoords: row.origin_coords,
    destinationCoords: row.destination_coords,
    salespersonName: row.salesperson_name,
    salespersonCommissionPerTon: Number(row.salesperson_commission_per_ton),
    branchId: row.branch_id,
    destinations: row.destinations,
    externalOrder: row.external_order,
    disableDriverFreightPF,
  };
};

const fromCargo = (c: Cargo | Omit<Cargo, 'id'>) => ({
  id: (c as Cargo).id,
  sequence_id: c.sequenceId,
  client_id: c.clientId,
  product_id: c.productId,
  origin: c.origin,
  origin_location: c.originLocation,
  origin_map_link: c.originMapLink,
  destination: c.destination,
  destination_location: c.destinationLocation,
  destination_map_link: c.destinationMapLink,
  total_volume: c.totalVolume,
  scheduled_volume: c.scheduledVolume,
  loaded_volume: c.loadedVolume,
  company_freight_value_per_ton: c.companyFreightValuePerTon,
  driver_freight_value_per_ton: c.driverFreightValuePerTon,
  driver_freight_value_per_ton_pj: c.driverFreightValuePerTonPJ ?? c.driverFreightValuePerTon,
  driver_freight_value_per_ton_pf: c.driverFreightValuePerTonPF ?? c.driverFreightValuePerTon,
  has_icms: c.hasIcms,
  icms_percentage: c.icmsPercentage,
  requires_scheduling: c.requiresScheduling,
  type: c.type,
  status: c.status,
  created_at: c.createdAt,
  created_by_id: c.createdById,
  history: c.history,
  loading_start_date: c.loadingStartDate || null,
  loading_deadline: c.loadingDeadline || null,
  allowed_vehicle_types: c.allowedVehicleTypes,
  freight_legs: c.freightLegs,
  daily_schedule: c.dailySchedule,
  observations: c.observations,
  attachments: c.attachments || [],
  origin_coords: c.originCoords,
  destination_coords: c.destinationCoords,
  salesperson_name: c.salespersonName,
  salesperson_commission_per_ton: c.salespersonCommissionPerTon,
  branch_id: c.branchId || null,
  destinations: c.destinations || null,
  external_order: c.externalOrder || null,
});

const toShipment = (row: any): Shipment => ({
  id: row.id,
  orderId: row.order_id,
  cargoId: row.cargo_id,
  driverName: row.driver_name,
  driverContact: row.driver_contact,
  driverCpf: row.driver_cpf,
  embarcadorId: row.embarcador_id,
  horsePlate: row.horse_plate,
  trailer1Plate: row.trailer1_plate,
  trailer2Plate: row.trailer2_plate,
  trailer3Plate: row.trailer3_plate,
  shipmentTonnage: Number(row.shipment_tonnage),
  driverFreightValue: Number(row.driver_freight_value),
  status: row.status,
  scheduledDate: row.scheduled_date,
  scheduledTime: row.scheduled_time,
  arrivalTime: row.arrival_time,
  documents: row.documents || {},
  history: row.history || [],
  createdAt: row.created_at,
  createdById: row.created_by_id,
  statusHistory: row.status_history || [],
  anttOwnerIdentifier: row.antt_owner_identifier,
  bankDetails: row.bank_details,
  advancePercentage: row.advance_percentage !== null ? Number(row.advance_percentage) : undefined,
  advanceValue: row.advance_value !== null ? Number(row.advance_value) : undefined,
  tollValue: row.toll_value !== null ? Number(row.toll_value) : undefined,
  vehicleTag: row.vehicle_tag,
  companyFreightRateSnapshot: row.company_freight_rate_snapshot !== null ? Number(row.company_freight_rate_snapshot) : undefined,
  driverFreightRateSnapshot: row.driver_freight_rate_snapshot !== null ? Number(row.driver_freight_rate_snapshot) : undefined,
  route: row.route,
  cancellationReason: row.cancellation_reason,
  driverReferences: Array.isArray(row.driver_references) ? row.driver_references.join('\n') : (row.driver_references || ''),
  ownerContact: row.owner_contact,
  balanceToReceiveValue: row.balance_to_receive_value !== null ? Number(row.balance_to_receive_value) : undefined,
  discountValue: row.discount_value !== null ? Number(row.discount_value) : undefined,
  netBalanceValue: row.net_balance_value !== null ? Number(row.net_balance_value) : undefined,
  unloadedTonnage: row.unloaded_tonnage !== null ? Number(row.unloaded_tonnage) : undefined,
  branchId: row.branch_id,
  vehicleSetType: row.vehicle_set_type,
  vehicleBodyType: row.vehicle_body_type,
});

const fromShipment = (s: Shipment) => ({
  id: s.id,
  order_id: s.orderId,
  cargo_id: s.cargoId,
  driver_name: s.driverName,
  driver_contact: s.driverContact,
  driver_cpf: s.driverCpf,
  embarcador_id: s.embarcadorId,
  horse_plate: s.horsePlate,
  trailer1_plate: s.trailer1Plate,
  trailer2_plate: s.trailer2Plate,
  trailer3_plate: s.trailer3Plate,
  shipment_tonnage: s.shipmentTonnage,
  driver_freight_value: s.driverFreightValue,
  status: s.status,
  scheduled_date: s.scheduledDate,
  scheduled_time: s.scheduledTime,
  arrival_time: s.arrivalTime,
  documents: s.documents || {},
  history: s.history,
  created_at: s.createdAt,
  created_by_id: s.createdById,
  status_history: s.statusHistory,
  antt_owner_identifier: s.anttOwnerIdentifier,
  bank_details: s.bankDetails,
  advance_percentage: s.advancePercentage,
  advance_value: s.advanceValue,
  toll_value: s.tollValue,
  vehicle_tag: s.vehicleTag,
  company_freight_rate_snapshot: s.companyFreightRateSnapshot,
  driver_freight_rate_snapshot: s.driverFreightRateSnapshot,
  route: s.route,
  cancellation_reason: s.cancellationReason,
  driver_references: s.driverReferences ? s.driverReferences.split('\n').filter(Boolean) : [],
  owner_contact: s.ownerContact,
  balance_to_receive_value: s.balanceToReceiveValue,
  discount_value: s.discountValue,
  net_balance_value: s.netBalanceValue,
  unloaded_tonnage: s.unloadedTonnage,
  branch_id: s.branchId || null,
  vehicle_set_type: s.vehicleSetType,
  vehicle_body_type: s.vehicleBodyType,
});

export const toUser = (row: any): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  profile: row.profile,
  active: row.active,
  password: row.password,
  clientId: row.client_id,
  requirePasswordChange: row.require_password_change,
  authId: row.auth_id,
  passwordUpdatedAt: row.password_updated_at,
  branchId: row.branch_id,
});

export const fromUser = (u: User | Omit<User, 'id'>) => ({
  id: (u as User).id,
  name: u.name,
  email: u.email,
  profile: u.profile,
  active: u.active,
  password: u.password,
  client_id: u.clientId,
  require_password_change: u.requirePasswordChange,
  auth_id: u.authId,
  password_updated_at: u.passwordUpdatedAt,
  branch_id: u.branchId || null,
});

const toTicket = (row: any): Ticket => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  createdById: row.created_by_id,
  assignedToId: row.assigned_to_id,
  createdAt: row.created_at,
  history: row.history || [],
});

const fromTicket = (t: Ticket | Omit<Ticket, 'id' | 'history' | 'createdAt' | 'createdById'>) => ({
  id: (t as Ticket).id,
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
  created_by_id: (t as Ticket).createdById,
  assigned_to_id: t.assignedToId,
  created_at: (t as Ticket).createdAt,
  history: (t as Ticket).history || [],
});

const toBranch = (row: any): Branch => ({
  id: row.id,
  name: row.name,
  city: row.city,
  state: row.state,
  createdAt: row.created_at,
});

const fromBranch = (b: Branch | Omit<Branch, 'id' | 'createdAt'>) => ({
  id: (b as Branch).id,
  name: b.name,
  city: b.city,
  state: b.state,
});

// ─────────────────────────────────────────────
// FETCH HELPERS: Handle Auth Errors
// ─────────────────────────────────────────────

const handleAuthError = (error: any, defaultValue: any) => {
  if (error.code === 'PGRST116' || error.status === 406 || error.status === 401) {
    console.warn('[DB] Auth/RLS error or no data found:', error.message);
    return defaultValue;
  }
  throw error;
};

// ─────────────────────────────────────────────
// FETCH ALL
// ─────────────────────────────────────────────

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*').order('nome_fantasia');
  if (error) return handleAuthError(error, []);
  return (data || []).map(toClient);
}

export async function fetchOwners(): Promise<Owner[]> {
  const { data, error } = await supabase.from('owners').select('*').order('name');
  if (error) return handleAuthError(error, []);
  return (data || []).map(toOwner);
}

export async function fetchDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase.from('drivers').select('*').order('name');
  if (error) return handleAuthError(error, []);
  return (data || []).map(toDriver);
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase.from('vehicles').select('*').order('plate');
  if (error) return handleAuthError(error, []);
  return (data || []).map(toVehicle);
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) return handleAuthError(error, []);
  return (data || []).map(toProduct);
}

export async function fetchCargos(): Promise<Cargo[]> {
  const { data, error } = await supabase.from('cargos').select('*').order('created_at', { ascending: false });
  if (error) return handleAuthError(error, []);
  return (data || []).map(toCargo);
}

export async function fetchShipments(): Promise<Shipment[]> {
  const { data, error } = await supabase.from('shipments').select('*').order('created_at', { ascending: false });
  if (error) return handleAuthError(error, []);
  return (data || []).map(toShipment);
}

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('app_users').select('*').order('name');
  if (error) return handleAuthError(error, []);
  return (data || []).map(toUser);
}

export async function fetchTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
  if (error) return handleAuthError(error, []);
  return (data || []).map(toTicket);
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data, error } = await supabase.from('branches').select('*').order('name');
  if (error) return handleAuthError(error, []);
  return (data || []).map(toBranch);
}

export async function fetchShipmentLocks(): Promise<ShipmentLock[]> {
  const { data, error } = await supabase.from('shipment_locks').select('*');
  if (error) return handleAuthError(error, []);
  return (data || []).map((row: any) => ({
    id: row.id,
    shipmentId: row.shipment_id,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function fetchProfilePermissions(): Promise<ProfilePermissions | null> {
  const { data, error } = await supabase.from('profile_permissions').select('permissions').eq('id', 1).single();
  if (error) return null;
  return data?.permissions || null;
}

export async function fetchAppSettings(): Promise<{ company_logo: string | null; theme_image: string | null } | null> {
  const { data, error } = await supabase.from('app_settings').select('company_logo, theme_image').eq('id', 1).single();
  if (error) return null;
  return data || null;
}

// ─────────────────────────────────────────────
// UPSERT (insert or update)
// ─────────────────────────────────────────────

export async function upsertClient(client: Client): Promise<void> {
  const { error } = await supabase.from('clients').upsert(fromClient(client));
  if (error) throw error;
}

export async function upsertOwner(owner: Owner): Promise<void> {
  const { error } = await supabase.from('owners').upsert(fromOwner(owner));
  if (error) throw error;
}

export async function upsertDriver(driver: Driver): Promise<void> {
  const { error } = await supabase.from('drivers').upsert(fromDriver(driver));
  if (error) throw error;
}

export async function upsertVehicle(vehicle: Vehicle): Promise<void> {
  const { error } = await supabase.from('vehicles').upsert(fromVehicle(vehicle));
  if (error) throw error;
}

export async function upsertCargo(cargo: Cargo): Promise<void> {
  const payload = fromCargo(cargo);
  console.log('[upsertCargo] Saving cargo:', cargo.id, payload);
  let error;
  if (cargo.id) {
    // Existing record: use update to guarantee the row is written
    const result = await supabase.from('cargos').update(payload).eq('id', cargo.id);
    error = result.error;
  } else {
    const result = await supabase.from('cargos').insert(payload).select().single();
    error = result.error;
    if (!error && result.data) {
      // Update the input object with the generated ID if possible
      // (though this function returns void, so the caller might not see it)
      (cargo as any).id = result.data.id;
    }
  }
  if (error) {
    console.error('[upsertCargo] Error:', error);
    throw error;
  }
  console.log('[upsertCargo] Success for cargo:', cargo.id);
}

export async function upsertShipment(shipment: Shipment): Promise<void> {
  const payload = fromShipment(shipment);
  let error;
  if (shipment.id) {
    const result = await supabase.from('shipments').update(payload).eq('id', shipment.id);
    error = result.error;
  } else {
    const result = await supabase.from('shipments').insert(payload);
    error = result.error;
  }
  if (error) {
    console.error('[upsertShipment] Error:', error);
    throw error;
  }
}

export async function upsertUser(user: User): Promise<void> {
  const { error } = await supabase.from('app_users').upsert(fromUser(user));
  if (error) throw error;
}

export async function upsertBranch(branch: Branch): Promise<void> {
  const { error } = await supabase.from('branches').upsert(fromBranch(branch));
  if (error) throw error;
}

export async function upsertTicket(ticket: Ticket): Promise<void> {
  const payload = fromTicket(ticket);
  let error;
  if ((ticket as Ticket).id) {
    const result = await supabase.from('tickets').update(payload).eq('id', (ticket as Ticket).id);
    error = result.error;
  } else {
    const result = await supabase.from('tickets').insert(payload);
    error = result.error;
  }
  if (error) {
    console.error('[upsertTicket] Error:', error);
    throw error;
  }
}

export async function insertCargo(cargo: Cargo | Omit<Cargo, 'id'>): Promise<Cargo> {
  const payload = fromCargo(cargo);
  console.log('[insertCargo] Inserting new cargo:', (cargo as Cargo).id || 'NEW');
  const { data, error } = await supabase.from('cargos').insert(payload).select().single();
  if (error) {
    console.error('[insertCargo] Error:', error);
    throw error;
  }
  console.log('[insertCargo] Success for cargo:', data.id);
  return toCargo(data);
}

export async function insertShipment(shipment: Shipment): Promise<void> {
  const payload = fromShipment(shipment);
  const { error } = await supabase.from('shipments').insert(payload);
  if (error) {
    console.error('[insertShipment] Error:', error);
    throw error;
  }
}

export async function saveProfilePermissions(permissions: ProfilePermissions): Promise<void> {
  const { error } = await supabase.from('profile_permissions').upsert({ id: 1, permissions });
  if (error) throw error;
}

export async function saveAppSettings(settings: { company_logo?: string | null; theme_image?: string | null }): Promise<void> {
  const { error } = await supabase.from('app_settings').update(settings).eq('id', 1);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// BULK UPSERT (used during shipment creation)
// ─────────────────────────────────────────────

export async function upsertManyDrivers(drivers: Driver[]): Promise<void> {
  if (drivers.length === 0) return;
  const { error } = await supabase.from('drivers').upsert(drivers.map(fromDriver));
  if (error) throw error;
}

export async function upsertManyVehicles(vehicles: Vehicle[]): Promise<void> {
  if (vehicles.length === 0) return;
  const { error } = await supabase.from('vehicles').upsert(vehicles.map(fromVehicle));
  if (error) throw error;
}

export async function upsertManyShipments(shipments: Shipment[]): Promise<void> {
  if (shipments.length === 0) return;
  const { error } = await supabase.from('shipments').upsert(shipments.map(fromShipment));
  if (error) throw error;
}

export async function upsertManyCargos(cargos: Cargo[]): Promise<void> {
  if (cargos.length === 0) return;
  const { error } = await supabase.from('cargos').upsert(cargos.map(fromCargo));
  if (error) throw error;
}

// ─────────────────────────────────────────────
// STORAGE (Attachments)
// ─────────────────────────────────────────────

export async function uploadShipmentAttachment(shipmentId: string, docType: string, file: File): Promise<string> {
  // To avoid naming collisions and special character issues, we create a safe filename
  const safeDocType = docType.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const filePath = `${shipmentId}/${safeDocType}_${Date.now()}_${safeFileName}`;
  
  const { data, error } = await supabase.storage
    .from('shipment_attachments')
    .upload(filePath, file, { upsert: true });

  if (error) {
    console.error(`[uploadShipmentAttachment] Error uploading ${docType} for shipment ${shipmentId}:`, error);
    throw error;
  }
  
  return data.path;
}

export function getShipmentAttachmentUrl(path: string): string {
  const { data } = supabase.storage
    .from('shipment_attachments')
    .getPublicUrl(path);
    
  return data.publicUrl;
}

export async function deleteShipmentAttachmentFromStorage(url: string): Promise<void> {
  // Extract path from public URL
  // Example URL: https://[project].supabase.co/storage/v1/object/public/shipment_attachments/SHP-123/Arquivos_Iniciais_123456_file.pdf
  const parts = url.split('/shipment_attachments/');
  if (parts.length < 2) {
    console.error('[deleteShipmentAttachmentFromStorage] Could not parse path from URL:', url);
    return;
  }
  
  const path = decodeURIComponent(parts[1]);
  
  const { error } = await supabase.storage
    .from('shipment_attachments')
    .remove([path]);

  if (error) {
    console.error(`[deleteShipmentAttachmentFromStorage] Error deleting path ${path}:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

export async function deleteCargo(id: string): Promise<void> {
  const { error } = await supabase.from('cargos').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteShipment(id: string): Promise<void> {
  const { error } = await supabase.from('shipments').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from('app_users').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteBranch(id: string): Promise<void> {
  const { error } = await supabase.from('branches').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertProduct(product: Product): Promise<void> {
  const { error } = await supabase.from('products').upsert({ id: product.id, name: product.name, unit: product.unit });
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// LOCKING
// ─────────────────────────────────────────────

export async function tryAcquireShipmentLock(shipmentId: string, userId: string, userName: string): Promise<{ success: boolean; lockedBy?: string }> {
  const { data, error } = await supabase.rpc('acquire_shipment_lock', {
    p_shipment_id: shipmentId,
    p_user_id: userId,
    p_user_name: userName
  });

  if (error) {
    console.error('Error in acquire_shipment_lock:', error);
    throw error;
  }

  return {
    success: data.success,
    lockedBy: data.locked_by
  };
}

export async function releaseShipmentLock(shipmentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('shipment_locks')
    .delete()
    .eq('shipment_id', shipmentId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error in releaseShipmentLock:', error);
    throw error;
  }
}

