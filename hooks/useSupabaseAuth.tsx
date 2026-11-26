import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { signOutSupabase } from '../services/supabaseAuthService';

interface SupabaseAuthContextValue {
  session: Session | null;
  authUser: SupabaseUser | null;
  isAuthReady: boolean;
  signOut: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextValue>({
  session: null,
  authUser: null,
  isAuthReady: false,
  signOut: async () => {},
});

export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session ?? null);
        setIsAuthReady(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setIsAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession ?? null);
      setIsAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await signOutSupabase();
    setSession(null);
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        session,
        authUser: session?.user ?? null,
        isAuthReady,
        signOut,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
};

export const useSupabaseAuth = (): SupabaseAuthContextValue => useContext(SupabaseAuthContext);
