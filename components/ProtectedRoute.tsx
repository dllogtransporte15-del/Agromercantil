import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { can } from '../auth';
import { useToast } from '../hooks/useToast';
import type { Page, ProfilePermissions, User, UserProfile } from '../types';

interface ProtectedRouteProps {
  currentUser: User | null;
  isAuthChecking?: boolean;
  requiredPage?: Page;
  profilePermissions?: ProfilePermissions;
  allowedProfiles?: UserProfile[];
  redirectTo?: string;
  unauthenticatedRedirectTo?: string;
  children: React.ReactNode;
}

/**
 * Guarda de rota protegida:
 * - Exige usuário autenticado (redireciona para /login caso não esteja logado).
 * - Valida permissões por página (`can('read', ...)`) e perfis permitidos,
 *   redirecionando para o Dashboard (/) com toast de aviso em caso de acesso não autorizado.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  currentUser,
  isAuthChecking = false,
  requiredPage,
  profilePermissions,
  allowedProfiles,
  redirectTo = '/',
  unauthenticatedRedirectTo = '/login',
  children,
}) => {
  const location = useLocation();
  const { showToast } = useToast();
  const lastDeniedPathRef = useRef<string | null>(null);

  const isAuthenticated = Boolean(currentUser && currentUser.active !== false);

  const hasProfileAccess =
    !allowedProfiles ||
    (currentUser ? allowedProfiles.includes(currentUser.profile) : false);

  const hasPageAccess =
    !requiredPage ||
    !profilePermissions ||
    can('read', currentUser, requiredPage, profilePermissions);

  const isAuthorized = isAuthenticated && hasProfileAccess && hasPageAccess;

  useEffect(() => {
    if (!isAuthChecking && isAuthenticated && !isAuthorized) {
      if (lastDeniedPathRef.current !== location.pathname) {
        lastDeniedPathRef.current = location.pathname;
        showToast('Você não tem permissão para acessar esta página.', 'warning');
      }
    } else if (isAuthorized) {
      lastDeniedPathRef.current = null;
    }
  }, [isAuthChecking, isAuthenticated, isAuthorized, location.pathname, showToast]);

  if (isAuthChecking) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to={unauthenticatedRedirectTo} state={{ from: location }} replace />;
  }

  if (!isAuthorized) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
