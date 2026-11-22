import { supabase } from '../supabase';
import type { User } from '../types';
import { UserProfile } from '../types';

export const SUPABASE_ACCESS_MONITOR_RECORD_ID = 891;
const LOCAL_STORAGE_KEY = 'dllog_operator_access_logs_v1';
const MAX_ACCESS_LOGS = 500;

export type AccessEventType = 'login' | 'session_start' | 'logout';

export interface UserAccessLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userProfile: UserProfile | string;
  eventType: AccessEventType;
  timestamp: string;
  device: string;
  branchId?: string;
}

export interface OnlineOperatorPresence {
  userId: string;
  name: string;
  email: string;
  profile: string;
  onlineAt: string;
  currentPage?: string;
  device?: string;
}

export interface AccessMonitorStore {
  logs: UserAccessLog[];
  lastAccessByUser: Record<string, string>;
  updatedAt: string;
}

export function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const platform = isMobile ? 'Mobile' : 'Desktop';
  let browser = 'Navegador';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  return `${platform} (${browser})`;
}

function getLocalStore(): AccessMonitorStore {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        lastAccessByUser: parsed.lastAccessByUser && typeof parsed.lastAccessByUser === 'object' ? parsed.lastAccessByUser : {},
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
    }
  } catch {}
  return { logs: [], lastAccessByUser: {}, updatedAt: new Date().toISOString() };
}

function setLocalStore(store: AccessMonitorStore): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export async function fetchAccessMonitorData(): Promise<AccessMonitorStore> {
  try {
    const { data, error } = await supabase
      .from('profile_permissions')
      .select('permissions')
      .eq('id', SUPABASE_ACCESS_MONITOR_RECORD_ID)
      .maybeSingle();

    if (!error && data?.permissions) {
      const p = data.permissions as Partial<AccessMonitorStore>;
      const store: AccessMonitorStore = {
        logs: Array.isArray(p.logs) ? p.logs : [],
        lastAccessByUser: p.lastAccessByUser && typeof p.lastAccessByUser === 'object' ? p.lastAccessByUser : {},
        updatedAt: p.updatedAt || new Date().toISOString()
      };
      setLocalStore(store);
      return store;
    }

    if (!error && !data) {
      const emptyStore: AccessMonitorStore = {
        logs: [],
        lastAccessByUser: {},
        updatedAt: new Date().toISOString()
      };
      await supabase.from('profile_permissions').upsert({
        id: SUPABASE_ACCESS_MONITOR_RECORD_ID,
        permissions: emptyStore
      });
      return emptyStore;
    }
  } catch (err) {
    console.warn('[AccessMonitor] Erro ao buscar histórico no Supabase:', err);
  }
  return getLocalStore();
}

export async function recordUserAccessEvent(
  user: User,
  eventType: AccessEventType
): Promise<void> {
  if (!user || !user.id) return;

  const nowIso = new Date().toISOString();

  // Evita spam de session_start em recarregamentos rápidos (< 5 min na mesma aba)
  if (eventType === 'session_start' && typeof sessionStorage !== 'undefined') {
    const throttleKey = `dllog_last_session_log_${user.id}`;
    const lastLogged = Number(sessionStorage.getItem(throttleKey) || 0);
    if (Date.now() - lastLogged < 5 * 60 * 1000) {
      return;
    }
    sessionStorage.setItem(throttleKey, String(Date.now()));
  }

  const newEntry: UserAccessLog = {
    id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userProfile: user.profile,
    eventType,
    timestamp: nowIso,
    device: detectDeviceLabel(),
    branchId: user.branchId
  };

  try {
    const current = await fetchAccessMonitorData();
    const updatedLogs = [newEntry, ...current.logs].slice(0, MAX_ACCESS_LOGS);
    const updatedStore: AccessMonitorStore = {
      logs: updatedLogs,
      lastAccessByUser: {
        ...current.lastAccessByUser,
        [user.id]: nowIso
      },
      updatedAt: nowIso
    };

    setLocalStore(updatedStore);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('operator_access_logs_updated', { detail: updatedStore }));
    }

    await supabase.from('profile_permissions').upsert({
      id: SUPABASE_ACCESS_MONITOR_RECORD_ID,
      permissions: updatedStore
    });
  } catch (err) {
    console.warn('[AccessMonitor] Erro ao registrar evento de acesso:', err);
  }
}
