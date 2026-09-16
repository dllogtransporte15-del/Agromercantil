
import type { User, Page, ProfilePermissions, CrudPermissions } from './types';
import { UserProfile } from './types';

const allPages: Page[] = ['dashboard', 'clients', 'owners', 'embarcadores', 'drivers', 'vehicles', 'loads', 'products', 'shipments', 'financial', 'reports', 'operational-loads', 'operational-map', 'users-register', 'commissions', 'appearance', 'shipment-history', 'load-history', 'layover-calculator', 'freight-quote', 'ai-assistant', 'tools-history', 'branches', 'system-monitor', 'freight-offers-history', 'risk-management', 'risk-query-types'];

const createPermissions = (pages: Page[], readOnly = false): { [key in Page]?: CrudPermissions } => {
  const permissions: { [key in Page]?: CrudPermissions } = {};
  for (const page of allPages) {
    const canAccess = pages.includes(page);
    permissions[page] = {
      read: canAccess,
      create: canAccess && !readOnly,
      update: canAccess && !readOnly,
      delete: canAccess && !readOnly,
    };
  }
  return permissions;
};

const supervisorAndDiretorPages = allPages.filter(p => p !== 'appearance');
export const INITIAL_PERMISSIONS: ProfilePermissions = {
  [UserProfile.Comercial]: createPermissions(['dashboard', 'clients', 'owners', 'drivers', 'vehicles', 'loads', 'shipments', 'reports', 'operational-loads', 'financial', 'operational-map', 'commissions', 'shipment-history', 'load-history', 'layover-calculator', 'freight-quote', 'freight-offers-history', 'risk-management', 'risk-query-types']),
  [UserProfile.Fiscal]: createPermissions(['dashboard', 'shipments', 'shipment-history', 'load-history', 'risk-management', 'risk-query-types'], true),
  [UserProfile.Financeiro]: createPermissions(['dashboard', 'shipments', 'reports', 'financial', 'commissions', 'shipment-history', 'load-history', 'risk-management', 'risk-query-types'], true),
  [UserProfile.Embarcador]: createPermissions(['dashboard', 'reports', 'operational-loads', 'shipments', 'operational-map', 'shipment-history', 'load-history', 'layover-calculator', 'risk-management'], true),
  [UserProfile.Agenciador]: createPermissions(['dashboard', 'reports', 'operational-loads', 'shipments', 'operational-map', 'shipment-history', 'load-history', 'layover-calculator', 'risk-management', 'clients', 'loads', 'products', 'vehicles', 'drivers', 'embarcadores', 'freight-quote']),
  [UserProfile.Cliente]: createPermissions(['dashboard', 'loads', 'shipments', 'shipment-history', 'load-history', 'operational-loads', 'freight-offers-history', 'reports'], true),
  [UserProfile.Supervisor]: createPermissions(supervisorAndDiretorPages),
  [UserProfile.Diretor]: createPermissions(supervisorAndDiretorPages, true),
  [UserProfile.Motorista]: createPermissions(['operational-loads', 'shipment-history'], true),
  [UserProfile.GerenciadoraDeRisco]: createPermissions(['dashboard', 'shipments', 'shipment-history', 'load-history', 'operational-loads', 'operational-map', 'reports', 'drivers', 'vehicles', 'loads', 'clients', 'products', 'owners', 'embarcadores', 'risk-management', 'risk-query-types']),
  [UserProfile.Demonstracao]: createPermissions(allPages, true),
};

if (INITIAL_PERMISSIONS[UserProfile.Fiscal] && INITIAL_PERMISSIONS[UserProfile.Fiscal]!['shipments']) {
    INITIAL_PERMISSIONS[UserProfile.Fiscal]!['shipments']!.delete = true;
}

// Specifically grant 'create' permission for 'shipments' to 'Embarcador' profile
if (INITIAL_PERMISSIONS[UserProfile.Embarcador] && INITIAL_PERMISSIONS[UserProfile.Embarcador]!['shipments']) {
    INITIAL_PERMISSIONS[UserProfile.Embarcador]!['shipments']!.create = true;
}

// Specifically ensure 'update' and 'create' permissions for 'GerenciadoraDeRisco' profile
if (INITIAL_PERMISSIONS[UserProfile.GerenciadoraDeRisco]) {
    if (INITIAL_PERMISSIONS[UserProfile.GerenciadoraDeRisco]!['risk-management']) {
        INITIAL_PERMISSIONS[UserProfile.GerenciadoraDeRisco]!['risk-management']!.update = true;
        INITIAL_PERMISSIONS[UserProfile.GerenciadoraDeRisco]!['risk-management']!.create = true;
    }
    if (INITIAL_PERMISSIONS[UserProfile.GerenciadoraDeRisco]!['risk-query-types']) {
        INITIAL_PERMISSIONS[UserProfile.GerenciadoraDeRisco]!['risk-query-types']!.update = true;
        INITIAL_PERMISSIONS[UserProfile.GerenciadoraDeRisco]!['risk-query-types']!.create = true;
    }
    if (INITIAL_PERMISSIONS[UserProfile.GerenciadoraDeRisco]!['shipments']) {
        INITIAL_PERMISSIONS[UserProfile.GerenciadoraDeRisco]!['shipments']!.update = true;
    }
}


export const isDemoUser = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return (
    user.profile === UserProfile.Demonstracao ||
    (user.profile as string) === 'Demo' ||
    (user.profile as string) === 'Demonstração' ||
    Boolean(user.name && user.name.toUpperCase().includes('DEMONSTRA'))
  );
};

export const can = (
  action: keyof CrudPermissions,
  user: User | null,
  page: Page,
  permissions: ProfilePermissions
): boolean => {
  if (!user) return false;
  
  // Demonstracao / Demo user can ONLY read (all pages), never create, update or delete
  if (isDemoUser(user)) {
    return action === 'read';
  }

  // Admin can do everything, always.
  if (user.profile === UserProfile.Admin) return true;

  // Explicitly block 'reports' for 'Fiscal' profile as requested, overriding DB
  if (user.profile === UserProfile.Fiscal && page === 'reports') return false;

  // Check User-specific custom permissions first
  if (user.customPermissions && user.customPermissions[page]) {
    return user.customPermissions[page]![action];
  }

  const userProfilePermissions = permissions[user.profile];
  const pagePermissions = userProfilePermissions?.[page] ?? INITIAL_PERMISSIONS[user.profile]?.[page];
  if (!pagePermissions) return false;

  return pagePermissions[action];
};

