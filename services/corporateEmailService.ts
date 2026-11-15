import type { 
  CorporateEmailAccount, 
  CorporateEmailServerConfig, 
  CorporateEmailDepartment,
  CorporateEmailStatus,
  User 
} from '../types';
import { isDeveloperUser, isDemoUser } from '../auth';

const STORAGE_EMAILS_KEY = 'transcunha_corporate_emails';
const STORAGE_CONFIG_KEY = 'transcunha_corporate_email_config';

export const DEFAULT_EMAIL_SERVER_CONFIG: CorporateEmailServerConfig = {
  domain: 'transcunhaoficial.com.br',
  webmailUrl: 'https://outlook.office.com',
  smtpHost: 'smtp.office365.com',
  smtpPort: 587,
  smtpSecure: 'tls',
  imapHost: 'outlook.office365.com',
  imapPort: 993,
  imapSecure: 'ssl',
  popHost: 'outlook.office365.com',
  popPort: 995,
  defaultQuotaMb: 51200, // 50 GB (Padrão Microsoft 365 / Exchange)
  providerPreset: 'microsoft_365',
};

export const PROVIDER_PRESETS: Record<CorporateEmailServerConfig['providerPreset'], {
  label: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: 'ssl' | 'tls' | 'none';
  imapHost: string;
  imapPort: number;
  imapSecure: 'ssl' | 'tls' | 'none';
  webmailUrl: string;
}> = {
  cpanel: {
    label: 'cPanel / Hospedagem Própria (Padrão DLLOG Transportes)',
    smtpHost: 'mail.transcunhaoficial.com.br',
    smtpPort: 465,
    smtpSecure: 'ssl',
    imapHost: 'mail.transcunhaoficial.com.br',
    imapPort: 993,
    imapSecure: 'ssl',
    webmailUrl: 'https://webmail.transcunhaoficial.com.br',
  },
  google_workspace: {
    label: 'Google Workspace (Gmail Corporativo)',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: 'tls',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: 'ssl',
    webmailUrl: 'https://mail.google.com/a/transcunhaoficial.com.br',
  },
  microsoft_365: {
    label: 'Microsoft 365 / Outlook Corporativo',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: 'tls',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: 'ssl',
    webmailUrl: 'https://outlook.office.com',
  },
  zoho: {
    label: 'Zoho Mail Corporativo',
    smtpHost: 'smtppro.zoho.com',
    smtpPort: 465,
    smtpSecure: 'ssl',
    imapHost: 'imappro.zoho.com',
    imapPort: 993,
    imapSecure: 'ssl',
    webmailUrl: 'https://mail.zoho.com',
  },
  titan: {
    label: 'Titan Mail (Hostinger / Registro.br)',
    smtpHost: 'smtp.titan.email',
    smtpPort: 465,
    smtpSecure: 'ssl',
    imapHost: 'imap.titan.email',
    imapPort: 993,
    imapSecure: 'ssl',
    webmailUrl: 'https://webmail.titan.email',
  },
  custom: {
    label: 'Configuração Personalizada (Servidor Dedicado)',
    smtpHost: 'mail.transcunhaoficial.com.br',
    smtpPort: 465,
    smtpSecure: 'ssl',
    imapHost: 'mail.transcunhaoficial.com.br',
    imapPort: 993,
    imapSecure: 'ssl',
    webmailUrl: 'https://webmail.transcunhaoficial.com.br',
  }
};

const INITIAL_ACCOUNTS: CorporateEmailAccount[] = [
  {
    id: 'email_diretoria',
    email: 'diretoria@transcunhaoficial.com.br',
    displayName: 'Diretoria Executiva',
    department: 'Diretoria',
    password: 'Tc#Diretoria*2026',
    status: 'Ativo',
    quotaMb: 20480, // 20 GB
    usedMb: 4890,
    aliases: ['admin@transcunhaoficial.com.br', 'ceo@transcunhaoficial.com.br'],
    signature: 'Diretoria Executiva — DLLOG Transportes e Logística',
    notes: 'Caixa postal master da diretoria.',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
  },
  {
    id: 'email_financeiro',
    email: 'financeiro@transcunhaoficial.com.br',
    displayName: 'Financeiro & Controladoria',
    department: 'Financeiro',
    password: 'Tc#Finan$2026!',
    status: 'Ativo',
    quotaMb: 10240, // 10 GB
    usedMb: 3410,
    aliases: ['cobranca@transcunhaoficial.com.br', 'pagamentos@transcunhaoficial.com.br', 'fiscal@transcunhaoficial.com.br'],
    signature: 'Setor Financeiro — DLLOG Transportes\nTel: (66) 3544-0000 | financeiro@transcunhaoficial.com.br',
    notes: 'Recepção de NFs, boletos e conciliação bancária.',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
  },
  {
    id: 'email_operacional',
    email: 'operacional@transcunhaoficial.com.br',
    displayName: 'Central Operacional & Logística',
    department: 'Operacional',
    password: 'Tc#Operac@2026',
    status: 'Ativo',
    quotaMb: 10240,
    usedMb: 2950,
    aliases: ['logistica@transcunhaoficial.com.br', 'cargas@transcunhaoficial.com.br', 'embarques@transcunhaoficial.com.br'],
    signature: 'Central de Cargas & Rastreamento — DLLOG Transportes',
    notes: 'Ordens de carregamento, romaneios e envio de comprovantes de entrega.',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
  },
  {
    id: 'email_comercial',
    email: 'comercial@transcunhaoficial.com.br',
    displayName: 'Equipe Comercial & Cotações',
    department: 'Comercial',
    password: 'Tc#Comercial2026$',
    status: 'Ativo',
    quotaMb: 10240,
    usedMb: 1820,
    aliases: ['vendas@transcunhaoficial.com.br', 'cotacao@transcunhaoficial.com.br'],
    signature: 'Departamento Comercial — DLLOG Transportes\nCotações rápidas de fretes pesados e agronegócio.',
    notes: 'Atendimento a embarcadores e clientes.',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
  },
  {
    id: 'email_contato',
    email: 'contato@transcunhaoficial.com.br',
    displayName: 'Atendimento Geral & SAC',
    department: 'Geral',
    password: 'Tc#Contato2026&',
    status: 'Ativo',
    quotaMb: 5120,
    usedMb: 920,
    aliases: ['sac@transcunhaoficial.com.br', 'suporte@transcunhaoficial.com.br'],
    signature: 'DLLOG Transportes e Logística Ltda.\nExcelência em Logística Rodoviária.',
    notes: 'E-mail institucional principal.',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
  }
];

class CorporateEmailService {
  /**
   * Obtém a configuração do servidor de e-mail corporativo (SMTP, IMAP, Webmail).
   */
  getServerConfig(): CorporateEmailServerConfig {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Atualiza automaticamente o domínio legado transcunha.com.br para transcunhaoficial.com.br
        if (!parsed.domain || parsed.domain === 'transcunha.com.br') {
          parsed.domain = 'transcunhaoficial.com.br';
        }
        if (parsed.webmailUrl && parsed.webmailUrl.includes('transcunha.com.br')) {
          parsed.webmailUrl = parsed.webmailUrl.replace('transcunha.com.br', 'transcunhaoficial.com.br');
        }
        if (parsed.smtpHost && parsed.smtpHost.includes('transcunha.com.br')) {
          parsed.smtpHost = parsed.smtpHost.replace('transcunha.com.br', 'transcunhaoficial.com.br');
        }
        if (parsed.imapHost && parsed.imapHost.includes('transcunha.com.br')) {
          parsed.imapHost = parsed.imapHost.replace('transcunha.com.br', 'transcunhaoficial.com.br');
        }

        if (parsed.providerPreset === 'cpanel' || parsed.providerPreset === 'google_workspace' || parsed.smtpHost === 'mail.transcunha.com.br' || parsed.smtpHost === 'smtp.gmail.com') {
          return { ...DEFAULT_EMAIL_SERVER_CONFIG, domain: 'transcunhaoficial.com.br' };
        }
        return { ...DEFAULT_EMAIL_SERVER_CONFIG, ...parsed, domain: parsed.domain || 'transcunhaoficial.com.br' };
      }
    } catch (e) {
      console.error('[CorporateEmailService] Erro ao ler configuração:', e);
    }
    return { ...DEFAULT_EMAIL_SERVER_CONFIG };
  }

  /**
   * Salva a configuração do servidor de e-mail corporativo.
   */
  saveServerConfig(config: CorporateEmailServerConfig): CorporateEmailServerConfig {
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('corporate_email_config_updated', { detail: config }));
    } catch (e) {
      console.error('[CorporateEmailService] Erro ao salvar configuração:', e);
    }
    return config;
  }

  /**
   * Lista todas as contas de e-mail corporativo cadastradas.
   */
  getEmailAccounts(users: User[] = []): CorporateEmailAccount[] {
    let accounts: CorporateEmailAccount[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_EMAILS_KEY);
      if (saved) {
        accounts = JSON.parse(saved);
        // Migra contas salvas no localStorage que ainda contenham @transcunha.com.br
        let migrated = false;
        accounts = accounts.map(a => {
          let email = a.email;
          if (email && email.toLowerCase().endsWith('@transcunha.com.br')) {
            email = email.replace(/@transcunha\.com\.br$/i, '@transcunhaoficial.com.br');
            migrated = true;
          }
          const aliases = (a.aliases || []).map(al => {
            if (al.toLowerCase().endsWith('@transcunha.com.br')) {
              migrated = true;
              return al.replace(/@transcunha\.com\.br$/i, '@transcunhaoficial.com.br');
            }
            return al;
          });
          const signature = a.signature ? a.signature.replace(/transcunha\.com\.br/g, 'transcunhaoficial.com.br') : a.signature;
          if (signature !== a.signature) migrated = true;

          return { ...a, email, aliases, signature };
        });
        if (migrated) {
          this.saveAccountsToStorage(accounts);
        }
      } else {
        accounts = [...INITIAL_ACCOUNTS];
        this.saveAccountsToStorage(accounts);
      }
    } catch (e) {
      console.error('[CorporateEmailService] Erro ao ler contas:', e);
      accounts = [...INITIAL_ACCOUNTS];
    }

    // Se houver usuários do sistema com e-mails corporativos (@transcunhaoficial.com.br) ou corporateEmail definido,
    // sincroniza automaticamente seus nomes e vínculos.
    if (users && users.length > 0) {
      let changed = false;
      users.forEach(u => {
        if (isDeveloperUser(u) || isDemoUser(u)) return;
        const corpEmail = (u.corporateEmail || (u.email && (u.email.toLowerCase().endsWith('@transcunhaoficial.com.br') || u.email.toLowerCase().endsWith('@transcunha.com.br')) ? u.email.replace(/@transcunha\.com\.br$/i, '@transcunhaoficial.com.br') : '')).trim().toLowerCase();
        if (corpEmail) {
          const existing = accounts.find(a => a.email.toLowerCase() === corpEmail || a.userId === u.id);
          if (existing) {
            if (existing.userId !== u.id || existing.userName !== u.name) {
              existing.userId = u.id;
              existing.userName = u.name;
              changed = true;
            }
          } else {
            // Cria conta automática para usuário que possui e-mail corporativo
            accounts.push({
              id: `email_user_${u.id}`,
              email: corpEmail,
              displayName: u.name,
              userId: u.id,
              userName: u.name,
              department: this.mapProfileToDepartment(u.profile),
              password: u.corporateEmailPassword || this.generateSecurePassword(12),
              status: (u.corporateEmailStatus as CorporateEmailStatus) || (u.active ? 'Ativo' : 'Inativo'),
              quotaMb: u.corporateEmailQuotaMb || 5120,
              usedMb: 250,
              aliases: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            changed = true;
          }
        }
      });

      if (changed) {
        this.saveAccountsToStorage(accounts);
      }
    }

    return accounts;
  }

  /**
   * Salva ou atualiza uma conta de e-mail corporativo.
   */
  saveEmailAccount(
    accountData: Partial<CorporateEmailAccount> & { email: string; displayName: string },
    users: User[] = []
  ): CorporateEmailAccount {
    const accounts = this.getEmailAccounts(users);
    const now = new Date().toISOString();
    const cleanEmail = accountData.email.trim().toLowerCase();

    const existingIndex = accounts.findIndex(
      a => (accountData.id && a.id === accountData.id) || a.email.toLowerCase() === cleanEmail
    );

    let savedAccount: CorporateEmailAccount;

    if (existingIndex >= 0) {
      savedAccount = {
        ...accounts[existingIndex],
        ...accountData,
        email: cleanEmail,
        updatedAt: now,
      };
      accounts[existingIndex] = savedAccount;
    } else {
      savedAccount = {
        id: accountData.id || `corp_email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: cleanEmail,
        displayName: accountData.displayName.trim(),
        userId: accountData.userId,
        userName: accountData.userName,
        department: accountData.department || 'Geral',
        password: accountData.password || this.generateSecurePassword(12),
        status: accountData.status || 'Ativo',
        quotaMb: accountData.quotaMb || 5120,
        usedMb: accountData.usedMb || 0,
        aliases: accountData.aliases || [],
        forwardTo: accountData.forwardTo,
        signature: accountData.signature,
        notes: accountData.notes,
        createdAt: now,
        updatedAt: now,
      };
      accounts.unshift(savedAccount);
    }

    this.saveAccountsToStorage(accounts);
    window.dispatchEvent(new CustomEvent('corporate_emails_updated', { detail: savedAccount }));
    return savedAccount;
  }

  /**
   * Remove uma conta de e-mail corporativo.
   */
  deleteEmailAccount(id: string): void {
    const accounts = this.getEmailAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    this.saveAccountsToStorage(filtered);
    window.dispatchEvent(new CustomEvent('corporate_emails_updated', { detail: { deletedId: id } }));
  }

  /**
   * Gera uma senha forte e segura para a conta de e-mail.
   */
  generateSecurePassword(length = 12): string {
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const specials = '!@#$%&*';
    const all = lower + upper + numbers + specials;

    let pwd = 'Tc#';
    for (let i = 0; i < length - 4; i++) {
      pwd += all.charAt(Math.floor(Math.random() * all.length));
    }
    pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
    return pwd;
  }

  /**
   * Mapeia o perfil do usuário para um departamento padrão.
   */
  mapProfileToDepartment(profile?: string): CorporateEmailDepartment {
    if (!profile) return 'Geral';
    const p = String(profile).toLowerCase();
    if (p.includes('diretor') || p.includes('admin')) return 'Diretoria';
    if (p.includes('finan') || p.includes('fiscal')) return 'Financeiro';
    if (p.includes('comercial')) return 'Comercial';
    if (p.includes('operac') || p.includes('supervisor') || p.includes('agenciador')) return 'Operacional';
    return 'Geral';
  }

  /**
   * Gera o código HTML padronizado para assinatura de e-mail da DLLOG Transportes.
   */
  generateSignatureHtml(
    account: CorporateEmailAccount, 
    companyLogo?: string | null,
    extraPhone = '(66) 3544-0000'
  ): string {
    const logoUrl = companyLogo || 'https://transcunhaoficial.com.br/logo.png';
    return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #292624; line-height: 1.4; border-left: 4px solid #A67142; padding-left: 14px; margin-top: 16px;">
  <div style="font-size: 15px; font-weight: bold; color: #1C1A18;">${account.displayName}</div>
  <div style="font-size: 12px; color: #6F6A67; font-weight: 600; text-transform: uppercase;">${account.department} — DLLOG Transportes</div>
  <div style="margin-top: 6px; font-size: 12px; color: #3F3B39;">
    <strong>E-mail:</strong> <a href="mailto:${account.email}" style="color: #A67142; text-decoration: none;">${account.email}</a><br/>
    <strong>Telefone / WhatsApp:</strong> ${extraPhone}<br/>
    <strong>Website:</strong> <a href="https://transcunhaoficial.com.br" target="_blank" style="color: #A67142; text-decoration: none;">www.transcunhaoficial.com.br</a>
  </div>
  <div style="margin-top: 8px; font-size: 11px; color: #9E9791; font-style: italic;">
    DLLOG Transportes e Logística — Excelência, Segurança e Eficiência no Transporte Rodoviário.
  </div>
</div>`;
  }

  private saveAccountsToStorage(accounts: CorporateEmailAccount[]): void {
    try {
      localStorage.setItem(STORAGE_EMAILS_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.error('[CorporateEmailService] Erro ao salvar contas no localStorage:', e);
    }
  }
}

export const corporateEmailService = new CorporateEmailService();
