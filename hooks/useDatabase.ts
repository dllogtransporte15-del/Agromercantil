
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import type { 
  User, Client, Owner, Driver, Vehicle, Product, Cargo, Shipment, Ticket,
  ProfilePermissions, ShipmentLock, Branch, FreightOffer, RiskQueryOption
} from '../types';
import { INITIAL_PERMISSIONS } from '../auth';
import { DEFAULT_RISK_QUERY_OPTIONS } from '../types';
import { 
  fetchClients, fetchOwners, fetchDrivers, fetchVehicles, fetchProducts,
  fetchCargos, fetchShipments, fetchUsers, fetchTickets, fetchProfilePermissions,
  fetchAppSettings, fetchShipmentLocks, fetchBranches, fetchFreightOffers,
  fetchRiskQueryOptions,
  backfillShipmentFiscalNumbers,
  backfillAdvanceAndBalanceCalculations
} from '../lib/db';
import { getAllToolStays, StayRecord } from '../utils/toolStorage';

// ─── Module-level helpers (accessible from both loadAllData and realtime handler) ───

function getMaxId(items: any[], startOffset: number): number {
  if (!items || items.length === 0) {
    console.log(`[getMaxId] No items found, returning startOffset: ${startOffset}`);
    return startOffset;
  }
  let maxNum = startOffset - 1;
  for (const item of items) {
    if (item?.id && typeof item.id === 'string') {
      // Ignora IDs temporários, logs, anexos, etc.
      if (item.id.startsWith('TEMP') || item.id.startsWith('log_') || item.id.startsWith('branch_') || item.id.startsWith('img_')) {
        continue;
      }
      const match = item.id.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        // IDs sequenciais normais são < 1.000.000 (valores maiores são timestamps Date.now())
        if (!isNaN(num) && num < 1000000 && num > maxNum) maxNum = num;
      }
    }
    // Também valida sequence_id / sequenceId numérico
    if (item?.sequence_id && typeof item.sequence_id === 'number' && item.sequence_id < 1000000 && item.sequence_id > maxNum) {
      maxNum = item.sequence_id;
    }
    if (item?.sequenceId && typeof item.sequenceId === 'number' && item.sequenceId < 1000000 && item.sequenceId > maxNum) {
      maxNum = item.sequenceId;
    }
  }
  const nextId = maxNum + 1;
  console.log(`[getMaxId] Items count: ${items.length}, Max found: ${maxNum}, Next ID: ${nextId}`);
  return nextId;
}

function calculateNextIds(
  dbClients: any[], dbOwners: any[], dbDrivers: any[], dbVehicles: any[], 
  dbProducts: any[], dbShipments: any[], dbCargos: any[], dbUsers: any[], dbTickets: any[],
  dbBranches: any[], dbOffers: any[] = []
) {
  const result = {
    client: getMaxId(dbClients, 100),
    owner: getMaxId(dbOwners, 100),
    driver: getMaxId(dbDrivers, 100),
    vehicle: getMaxId(dbVehicles, 100),
    product: getMaxId(dbProducts, 100),
    shipment: getMaxId(dbShipments, 100),
    cargo: getMaxId(dbCargos, 100),
    user: getMaxId(dbUsers, 100),
    ticket: getMaxId(dbTickets, 1),
    branch: getMaxId(dbBranches, 10),
    freightOffer: getMaxId(dbOffers, 1),
    history: 9999,
  };
  console.log('[DB] Next IDs calculated:', result);
  return result;
}

// ─────────────────────────────────────────────

export function useDatabase(currentUser: User | null) {
  const [clients, setClients] = useState<Client[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [freightOffers, setFreightOffers] = useState<FreightOffer[]>([]);
  const [stays, setStays] = useState<StayRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [riskQueryOptions, setRiskQueryOptions] = useState<RiskQueryOption[]>(() => {
    try {
      const saved = localStorage.getItem('agromercantil_risk_query_options') || localStorage.getItem('transcunha_risk_query_options');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_RISK_QUERY_OPTIONS;
  });
  const [activeLocks, setActiveLocks] = useState<ShipmentLock[]>([]);
  const [profilePermissions, setProfilePermissions] = useState<ProfilePermissions>(INITIAL_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [companyLogo, setCompanyLogo] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem('agromercantil_companyLogo') ||
        localStorage.getItem('transcunha_companyLogo') ||
        localStorage.getItem('trancunha_companyLogo')
      );
    } catch { return null; }
  });
  const [themeImage, setThemeImage] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem('agromercantil_themeImage') ||
        localStorage.getItem('transcunha_themeImage') ||
        localStorage.getItem('trancunha_themeImage')
      );
    } catch { return null; }
  });

  const [nextIds, setNextIds] = useState(() => {
    try {
      const saved = (
        localStorage.getItem('agromercantil_nextIds') ||
        localStorage.getItem('transcunha_nextIds') ||
        localStorage.getItem('trancunha_nextIds')
      );
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cargo && parsed.cargo > 1000000) parsed.cargo = 100;
        if (parsed.shipment && parsed.shipment > 1000000) parsed.shipment = 100;
        return parsed;
      }
    } catch {}
    return { client: 100, owner: 100, driver: 100, vehicle: 100, product: 100, shipment: 100, cargo: 100, user: 100, ticket: 1, branch: 10, freightOffer: 1, history: 1000 };
  });

  const isAnyModalActiveRef = useRef(false);
  const backfillRanRef = useRef(false);

  const loadAllData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setLoadError(null);
    
    // Safety net: if loading takes more than 15 seconds, force it to stop
    const timeoutId = setTimeout(() => {
      console.error('[useDatabase] loadAllData timed out after 15s. Forcing isLoading=false.');
      setIsLoading(false);
    }, 15000);

    try {
      // Note: We now rely on the local session/user state from App.tsx 
      // instead of checking Supabase Auth every time.
      if (!currentUser) {
        console.warn('[DB] Tentativa de carga sem usuário logado.');
        setIsLoading(false);
        return;
      }

      console.log('[DB] Carregando dados para:', currentUser.email);

      const isMotorista = currentUser.profile === 'Motorista';

      if (isMotorista) {
        // Motorista only needs: cargos, shipments (filtered), settings, products, clients
        // Skip heavy tables: drivers (914), vehicles (1000), users, locks, branches, etc.
        const [
          dbCargos, dbShipments, dbSettings, dbPermissions,
          dbProducts, dbClients, dbFreightOffers, dbUsers, dbRiskOptions
        ] = await Promise.all([
          fetchCargos(), fetchShipments(), fetchAppSettings(), fetchProfilePermissions(),
          fetchProducts(), fetchClients(), fetchFreightOffers(), fetchUsers(), fetchRiskQueryOptions()
        ]);

        setCargos(dbCargos);
        setShipments(dbShipments);
        setProducts(dbProducts);
        setClients(dbClients);
        setFreightOffers(dbFreightOffers);
        setUsers(dbUsers);
        if (dbRiskOptions && dbRiskOptions.length > 0) setRiskQueryOptions(dbRiskOptions);

        if (dbPermissions) setProfilePermissions({ ...INITIAL_PERMISSIONS, ...dbPermissions });
        if (dbSettings) {
          setCompanyLogo(dbSettings.company_logo || null);
          setThemeImage(dbSettings.theme_image || null);
        }

      } else {
        const [
          dbClients, dbOwners, dbDrivers, dbVehicles, dbProducts, dbCargos, 
          dbShipments, dbUsers, dbTickets, dbPermissions, dbSettings, dbLocks, dbBranches,
          dbStays, dbFreightOffers, dbRiskOptions
        ] = await Promise.all([
          fetchClients(), fetchOwners(), fetchDrivers(), fetchVehicles(), fetchProducts(),
          fetchCargos(), fetchShipments(), fetchUsers(), fetchTickets(),
          fetchProfilePermissions(), fetchAppSettings(), fetchShipmentLocks(),
          fetchBranches(), getAllToolStays(), fetchFreightOffers(), fetchRiskQueryOptions()
        ]);

        setClients(dbClients);
        setOwners(dbOwners);
        setDrivers(dbDrivers);
        setVehicles(dbVehicles);
        setProducts(dbProducts);
        setCargos(dbCargos);
        setShipments(dbShipments);
        setUsers(dbUsers);
        setTickets(dbTickets);
        setFreightOffers(dbFreightOffers);
        setStays(dbStays);
        setBranches(dbBranches);
        setActiveLocks(dbLocks);
        if (dbRiskOptions && dbRiskOptions.length > 0) setRiskQueryOptions(dbRiskOptions);

        if (dbPermissions) setProfilePermissions({ ...INITIAL_PERMISSIONS, ...dbPermissions });
        if (dbSettings) {
          setCompanyLogo(dbSettings.company_logo || null);
          setThemeImage(dbSettings.theme_image || null);
        }

        setNextIds(calculateNextIds(
          dbClients, dbOwners, dbDrivers, dbVehicles,
          dbProducts, dbShipments, dbCargos, dbUsers, dbTickets, dbBranches, dbFreightOffers
        ));

        // Backfill silencioso: extrai CT-e/NF-e/MDF-e e aplica cálculos de adiantamento/saldo (roda 1x por sessão)
        if (!backfillRanRef.current) {
          backfillRanRef.current = true;
          backfillShipmentFiscalNumbers().then(({ updated }) => {
            if (updated > 0) {
              console.log(`[backfill] ${updated} embarque(s) atualizados — recarregando embarques.`);
              fetchShipments().then(setShipments).catch(() => {});
            }
          }).catch(() => {});

          backfillAdvanceAndBalanceCalculations().then(({ updated }) => {
            if (updated > 0) {
              console.log(`[advanceBackfill] ${updated} embarque(s) atualizados com regra de adiantamento/saldo.`);
              fetchShipments().then(setShipments).catch(() => {});
            }
          }).catch(() => {});
        }
      } // fim do else (não-Motorista)

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setLoadError('Erro ao conectar ao banco de dados.');
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false); // ALWAYS runs — no more eternal spinner
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    } else {
      setIsLoading(false);
      // Even without a user, try to load branding settings for the login page
      fetchAppSettings().then(settings => {
        if (settings) {
          setCompanyLogo(settings.company_logo || null);
          setThemeImage(settings.theme_image || null);
        }
      });
    }
  }, [currentUser, loadAllData]);

  // Real-time integration — with auto-reconnect and polling fallback
  useEffect(() => {
    if (!currentUser) return;

    // Track last known shipments/cargos hash to detect changes during polling
    let lastShipmentsHash = '';
    let lastCargosHash = '';
    let realtimeWorking = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    const handlePostgresChange = async (payload: any) => {
      const { table, eventType } = payload;
      realtimeWorking = true;
      console.log(`[Realtime] Mudança detectada em ${table} (${eventType}). Atualizando...`);

      // Permite atualizações em tempo real mesmo com modais abertos para fluxos principais
      const alwaysUpdateTables = ['tickets', 'cargos', 'shipments', 'freight_offers'];
      if (isAnyModalActiveRef.current && !alwaysUpdateTables.includes(table)) return;

      try {
        switch (table) {
          case 'clients': {
            const dbClients = await fetchClients();
            setClients(dbClients);
            setNextIds((prev: any) => ({ ...prev, client: getMaxId(dbClients, 100) }));
            break;
          }
          case 'owners': {
            const dbOwners = await fetchOwners();
            setOwners(dbOwners);
            setNextIds((prev: any) => ({ ...prev, owner: getMaxId(dbOwners, 100) }));
            break;
          }
          case 'drivers': {
            const dbDrivers = await fetchDrivers();
            setDrivers(dbDrivers);
            setNextIds((prev: any) => ({ ...prev, driver: getMaxId(dbDrivers, 100) }));
            break;
          }
          case 'vehicles': {
            const dbVehicles = await fetchVehicles();
            setVehicles(dbVehicles);
            setNextIds((prev: any) => ({ ...prev, vehicle: getMaxId(dbVehicles, 100) }));
            break;
          }
          case 'products': {
            const dbProducts = await fetchProducts();
            setProducts(dbProducts);
            setNextIds((prev: any) => ({ ...prev, product: getMaxId(dbProducts, 100) }));
            break;
          }
          case 'cargos': {
            const dbCargos = await fetchCargos();
            lastCargosHash = JSON.stringify(dbCargos.map(c => `${c.id}:${(c as any).status}:${(c as any).updatedAt}`));
            setCargos(dbCargos);
            setNextIds((prev: any) => ({ ...prev, cargo: getMaxId(dbCargos, 100) }));
            break;
          }
          case 'shipments': {
            const dbShipments = await fetchShipments();
            lastShipmentsHash = JSON.stringify(dbShipments.map(s => `${s.id}:${s.status}:${(s as any).updatedAt}`));
            setShipments(dbShipments);
            setNextIds((prev: any) => ({ ...prev, shipment: getMaxId(dbShipments, 100) }));
            break;
          }
          case 'app_users': {
            const dbUsers = await fetchUsers();
            setUsers(dbUsers);
            setNextIds((prev: any) => ({ ...prev, user: getMaxId(dbUsers, 100) }));
            break;
          }
          case 'tickets': {
            const dbTickets = await fetchTickets();
            setTickets(dbTickets);
            setNextIds((prev: any) => ({ ...prev, ticket: getMaxId(dbTickets, 1) }));
            break;
          }
          case 'freight_offers': {
            const dbOffers = await fetchFreightOffers();
            setFreightOffers(dbOffers);
            setNextIds((prev: any) => ({ ...prev, freightOffer: getMaxId(dbOffers, 1) }));
            break;
          }
          case 'branches': {
            const dbBranches = await fetchBranches();
            setBranches(dbBranches);
            setNextIds((prev: any) => ({ ...prev, branch: getMaxId(dbBranches, 10) }));
            break;
          }
          case 'tool_stays': {
            const dbStays = await getAllToolStays();
            setStays(dbStays);
            break;
          }
          case 'shipment_locks': {
            const dbLocks = await fetchShipmentLocks();
            setActiveLocks(dbLocks);
            break;
          }
          case 'profile_permissions': {
            const dbPermissions = await fetchProfilePermissions();
            if (dbPermissions) setProfilePermissions(dbPermissions);
            const dbRiskOptions = await fetchRiskQueryOptions();
            if (dbRiskOptions && dbRiskOptions.length > 0) {
              setRiskQueryOptions(dbRiskOptions);
            }
            if (dbPermissions && (dbPermissions as any).client_branches) {
              const bMap = (dbPermissions as any).client_branches;
              setClients(prev => prev.map(c => ({
                ...c,
                secondaryCnpjs: bMap[c.id] !== undefined ? bMap[c.id] : (c.secondaryCnpjs || [])
              })));
            }
            break;
          }
          case 'app_settings': {
            const dbSettings = await fetchAppSettings();
            if (dbSettings) {
              setCompanyLogo(dbSettings.company_logo || null);
              setThemeImage(dbSettings.theme_image || null);
            }
            break;
          }
          case 'risk_query_options': {
            const dbRiskOptions = await fetchRiskQueryOptions();
            if (dbRiskOptions && dbRiskOptions.length > 0) {
              setRiskQueryOptions(dbRiskOptions);
            }
            break;
          }
          default:
            // If unknown table, fallback to background reload
            loadAllData(true);
        }
      } catch (err) {
        console.error(`[Realtime] Erro ao atualizar ${table}:`, err);
        loadAllData(true); // Fallback to full reload
      }
    };

    const subscribeChannel = () => {
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
      channelRef = supabase
        .channel('db_changes_' + Date.now())
        .on('postgres_changes', { event: '*', schema: 'public' }, handlePostgresChange)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] ✅ Canal conectado — atualizações automáticas ativas');
            realtimeWorking = true;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn(`[Realtime] ⚠️ Canal ${status} — tentando reconectar em 5s...`);
            realtimeWorking = false;
            setTimeout(() => {
              subscribeChannel();
            }, 5000);
          }
        });
    };

    subscribeChannel();

    // ── Polling fallback (30s): garante atualização mesmo se Realtime não estiver
    //    com replicação habilitada nas tabelas do Supabase ─────────────────────────
    const POLL_INTERVAL_MS = 30_000;
    const pollInterval = setInterval(async () => {
      try {
        // Poll shipments
        const dbShipments = await fetchShipments();
        const newShipmentsHash = JSON.stringify(dbShipments.map(s => `${s.id}:${s.status}:${(s as any).updatedAt}`));
        if (newShipmentsHash !== lastShipmentsHash) {
          console.log('[Polling] 🔄 Embarques alterados — atualizando...');
          lastShipmentsHash = newShipmentsHash;
          setShipments(dbShipments);
          setNextIds((prev: any) => ({ ...prev, shipment: getMaxId(dbShipments, 100) }));
        }

        // Poll cargos
        const dbCargos = await fetchCargos();
        const newCargosHash = JSON.stringify(dbCargos.map(c => `${c.id}:${(c as any).status}:${(c as any).updatedAt}`));
        if (newCargosHash !== lastCargosHash) {
          console.log('[Polling] 🔄 Cargas alteradas — atualizando...');
          lastCargosHash = newCargosHash;
          setCargos(dbCargos);
          setNextIds((prev: any) => ({ ...prev, cargo: getMaxId(dbCargos, 100) }));
        }
      } catch (err) {
        console.warn('[Polling] Erro ao verificar atualizações:', err);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollInterval);
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [currentUser, loadAllData]);

  return {
    clients, setClients,
    owners, setOwners,
    drivers, setDrivers,
    vehicles, setVehicles,
    products, setProducts,
    cargos, setCargos,
    shipments, setShipments,
    users, setUsers,
    tickets, setTickets,
    freightOffers, setFreightOffers,
    stays, setStays,
    branches, setBranches,
    riskQueryOptions, setRiskQueryOptions,
    activeLocks, setActiveLocks,
    profilePermissions, setProfilePermissions,
    isLoading, loadError,
    companyLogo, setCompanyLogo,
    themeImage, setThemeImage,
    nextIds, setNextIds,
    loadAllData,
    isAnyModalActiveRef
  };
}
