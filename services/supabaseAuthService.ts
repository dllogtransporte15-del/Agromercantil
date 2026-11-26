import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { fetchUserExtraConfig, toUser } from '../lib/db';
import { formatCPF } from '../utils/formatters';
import type { User } from '../types';

export interface HybridSignInResult {
  user: User | null;
  authMode: 'supabase_auth' | 'hybrid_linked' | 'legacy_fallback' | null;
  error?: string;
}

const hydrateAppUser = async (dbUser: any): Promise<User> => {
  let extraMap: Record<string, any> = {};
  try {
    extraMap = await fetchUserExtraConfig();
  } catch {
    extraMap = {};
  }
  const userExtra = extraMap[dbUser.id] || {};
  const mergedPerms = {
    ...(userExtra.permissions || {}),
    ...(typeof dbUser.permissions === 'object' && dbUser.permissions ? dbUser.permissions : {}),
  };

  const userProfile = toUser({
    ...dbUser,
    phone: dbUser.phone || userExtra.phone || mergedPerms.phone || undefined,
    permissions: Object.keys(mergedPerms).length > 0 ? mergedPerms : undefined,
  });

  if (userProfile.passwordUpdatedAt) {
    const lastUpdate = new Date(userProfile.passwordUpdatedAt).getTime();
    const daysSinceUpdate = (Date.now() - lastUpdate) / (1000 * 3600 * 24);
    if (daysSinceUpdate >= 30) {
      userProfile.requirePasswordChange = true;
    }
  }

  return userProfile;
};

const linkAuthIdIfNeeded = async (userId: string, currentAuthId: string | null | undefined, authId: string) => {
  if (!authId || currentAuthId === authId) return;
  try {
    await supabase.from('app_users').update({ auth_id: authId }).eq('id', userId);
  } catch (err) {
    console.warn('[SupabaseAuth] Não foi possível vincular auth_id em app_users:', err);
  }
};

/**
 * Restaura o perfil do usuário em `app_users` a partir de uma sessão ativa do Supabase Auth.
 */
export const resolveAppUserFromSupabaseSession = async (session: Session | null): Promise<User | null> => {
  if (!session?.user) return null;

  const authUser = session.user;

  // 1. Tenta localizar pelo auth_id vinculado
  const { data: byAuthId } = await supabase
    .from('app_users')
    .select('*')
    .eq('auth_id', authUser.id)
    .maybeSingle();

  if (byAuthId) {
    const hydrated = await hydrateAppUser(byAuthId);
    return hydrated.active ? hydrated : null;
  }

  // 2. Fallback pelo e-mail autenticado no Supabase Auth
  if (authUser.email) {
    const { data: byEmail } = await supabase
      .from('app_users')
      .select('*')
      .ilike('email', authUser.email.trim().toLowerCase())
      .maybeSingle();

    if (byEmail) {
      await linkAuthIdIfNeeded(byEmail.id, byEmail.auth_id, authUser.id);
      const hydrated = await hydrateAppUser({ ...byEmail, auth_id: authUser.id });
      return hydrated.active ? hydrated : null;
    }
  }

  return null;
};

/**
 * Login híbrido/progressivo:
 * 1. Tenta autenticar via `supabase.auth.signInWithPassword` quando o identificador é um e-mail.
 * 2. Caso o usuário ainda exista apenas na tabela legada `app_users`, valida a senha lá e tenta
 *    provisionar/vincular a conta em `auth.users` automaticamente sem bloquear o acesso.
 */
export const signInWithSupabaseHybrid = async (
  inputLogin: string,
  password: string
): Promise<HybridSignInResult> => {
  const trimmedLogin = inputLogin.trim();
  const cleanEmail = trimmedLogin.toLowerCase();
  const cleanPassword = password.trim();
  const isEmailInput = trimmedLogin.includes('@');

  // 1. Tentativa primária via Supabase Auth (para e-mail)
  if (isEmailInput) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (!authError && authData.user) {
      const { data: dbUser } = await supabase
        .from('app_users')
        .select('*')
        .or(`auth_id.eq.${authData.user.id},email.ilike.${cleanEmail}`)
        .maybeSingle();

      if (dbUser) {
        if (!dbUser.active) {
          await supabase.auth.signOut();
          return { user: null, authMode: null, error: 'Este usuário está inativo.' };
        }
        await linkAuthIdIfNeeded(dbUser.id, dbUser.auth_id, authData.user.id);
        const hydrated = await hydrateAppUser({ ...dbUser, auth_id: authData.user.id });
        return { user: hydrated, authMode: 'supabase_auth' };
      }
    }
  }

  // 2. Fallback / migração progressiva via tabela app_users (suporta e-mail, usuário ou CPF)
  const cleanDigits = trimmedLogin.replace(/\D/g, '');
  const formattedCpf = cleanDigits.length === 11 ? formatCPF(cleanDigits) : '';

  let query = supabase.from('app_users').select('*').eq('password', cleanPassword);
  if (formattedCpf) {
    query = query.or(
      `email.ilike.${cleanEmail},email.eq.${trimmedLogin},email.eq.${formattedCpf},email.eq.${cleanDigits}`
    );
  } else {
    query = query.or(`email.ilike.${cleanEmail},email.eq.${trimmedLogin}`);
  }

  const { data: dbUserList, error: dbError } = await query;
  const dbUser = dbUserList && dbUserList.length > 0 ? dbUserList[0] : null;

  if (dbError || !dbUser) {
    return { user: null, authMode: null, error: 'Usuário, e-mail ou senha inválidos.' };
  }

  if (!dbUser.active) {
    return { user: null, authMode: null, error: 'Este usuário está inativo.' };
  }

  // 3. Migração automática para Supabase Auth se o usuário tiver e-mail válido e ainda não tiver auth_id
  let authMode: HybridSignInResult['authMode'] = 'legacy_fallback';
  let resolvedAuthId: string | undefined = dbUser.auth_id || undefined;
  const dbEmail = typeof dbUser.email === 'string' ? dbUser.email.trim().toLowerCase() : '';

  if (dbEmail.includes('@') && cleanPassword.length >= 6 && !dbUser.auth_id) {
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: dbEmail,
        password: cleanPassword,
        options: {
          data: {
            name: dbUser.name,
            app_user_id: dbUser.id,
            profile: dbUser.profile,
          },
        },
      });

      if (!signUpError && signUpData.user) {
        resolvedAuthId = signUpData.user.id;
        await linkAuthIdIfNeeded(dbUser.id, dbUser.auth_id, signUpData.user.id);
        authMode = 'hybrid_linked';
      }
    } catch (err) {
      console.warn('[SupabaseAuth] Migração automática ignorada (fallback legado ativo):', err);
    }
  }

  const hydrated = await hydrateAppUser({ ...dbUser, auth_id: resolvedAuthId });
  return { user: hydrated, authMode };
};

export const signOutSupabase = async (): Promise<void> => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[SupabaseAuth] Erro ao encerrar sessão no Supabase Auth:', err);
  }
  try {
    sessionStorage.removeItem('trancunha_user_email');
    sessionStorage.removeItem('trancunha_currentUser');
    localStorage.removeItem('trancunha_user_email');
    localStorage.removeItem('trancunha_currentUser');
  } catch {}
};
