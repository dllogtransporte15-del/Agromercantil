
import React, { useState } from 'react';
import { supabase } from '../supabase';
import type { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
  users: User[];
  companyLogo: string | null;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, users, companyLogo }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError('');
    setIsLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    console.log('[LoginPage] Iniciando login interno para:', cleanEmail);
    
    try {
      // Clear any existing Supabase Auth session before starting a new internal login
      await supabase.auth.signOut();
      // Direct query to app_users instead of Supabase Auth
      const { data: dbUser, error: dbError } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', cleanEmail)
        .eq('password', cleanPassword)
        .single();

      if (dbError || !dbUser) {
        console.error('[LoginPage] Erro de login:', dbError);
        setError('Email ou senha inválidos no sistema interno.');
        setIsLoading(false);
        return;
      }

      const userProfile: User = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        profile: dbUser.profile,
        active: dbUser.active,
        password: dbUser.password,
        clientId: dbUser.client_id,
        requirePasswordChange: dbUser.require_password_change,
        authId: dbUser.auth_id
      };

      if (!userProfile.active) {
        setError('Este usuário está inativo.');
        setIsLoading(false);
        return;
      }

      console.log('[LoginPage] Login bem-sucedido:', userProfile.name);
      onLogin(userProfile);
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Ocorreu um erro interno ao tentar entrar.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-primary overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[80%] h-full bg-accent opacity-10 skew-x-[-25deg] origin-top-right"></div>
        <div className="absolute bottom-0 left-0 w-[40%] h-[50%] bg-accent opacity-5 skew-x-[-15deg] origin-bottom-left"></div>
      </div>

      <div className="relative z-10 w-full max-w-[360px] p-8 space-y-4 bg-white dark:bg-dark-card rounded-2xl shadow-2xl border-t-8 border-accent">
        <div className="text-center">
          {companyLogo ? (
            <img src={companyLogo} alt="Logo da Empresa" className="h-16 mx-auto filter drop-shadow-md" />
          ) : (
            <h1 className="text-4xl font-black text-primary dark:text-white tracking-tighter">
              AGRO<span className="text-accent">MERCANTIL</span>
            </h1>
          )}
          <div className="mt-2 flex flex-col items-center">
            <p className="text-lg font-bold text-primary dark:text-blue-400">Sistema de Gestão Logística</p>
            <div className="h-1 w-12 bg-accent mt-1 rounded-full"></div>
          </div>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="relative">
              <input
                id="email-address"
                name="email"
                type="email"
                required
                disabled={isLoading}
                className="appearance-none block w-full px-4 py-3 border border-gray-200 dark:border-gray-700 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent sm:text-sm dark:bg-gray-800 dark:text-white transition-all disabled:opacity-50"
                placeholder="Seu email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
                className="appearance-none block w-full px-4 py-3 border border-gray-200 dark:border-gray-700 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent sm:text-sm dark:bg-gray-800 dark:text-white transition-all disabled:opacity-50"
                placeholder="Sua senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
               <p className="text-center text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-3 px-4 border border-transparent text-base font-black rounded-xl text-white shadow-lg transition-all transform active:scale-[0.98] ${
                isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-accent hover:bg-accent-dark hover:-translate-y-1 shadow-accent/20'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  PROCESSANDO...
                </span>
              ) : 'ENTRAR NO SISTEMA'}
            </button>
          </div>
        </form>
        
        <div className="text-center pt-2">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">
                Transparência | Cuidado | Prazo
            </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
