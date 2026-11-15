import { supabase } from '../supabase';
import type { FinancialInvoice, FinancialDocumentType, CostCenter, CostType, InvoiceCostNature, InvoicePaymentStatus, User } from '../types';
import { isDeveloperUser, isDemoUser } from '../auth';

const STORAGE_INVOICES_KEY = 'transcunha_financial_invoices';
const STORAGE_COST_CENTERS_KEY = 'transcunha_financial_cost_centers';
const STORAGE_COST_TYPES_KEY = 'transcunha_financial_cost_types';

export const INITIAL_COST_CENTERS: CostCenter[] = [
  { id: 'cc-001', code: 'CC-001', name: 'Operacional', description: 'Custos diretos de transporte, pátio e logística', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cc-002', code: 'CC-002', name: 'Administrativo', description: 'Despesas administrativas e gerais da matriz', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cc-003', code: 'CC-003', name: 'Frota & Equipamentos', description: 'Manutenção preventiva/corretiva e suprimentos da frota', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cc-004', code: 'CC-004', name: 'Comercial & Vendas', description: 'Custos de agenciamento, prospecção e vendas', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cc-005', code: 'CC-005', name: 'TI & Sistemas', description: 'Sistemas TMS, licenças, servidores e infraestrutura', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cc-006', code: 'CC-006', name: 'Diretoria & Gestão', description: 'Custos estratégicos e gestão executiva', isDefault: true, createdAt: new Date().toISOString() },
];

export const INITIAL_COST_TYPES: CostType[] = [
  { id: 'ct-001', name: 'Manutenção Mecânica e Peças', nature: 'servico', description: 'Serviços mecânicos, elétricos e borracharia', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-002', name: 'Serviços de Tecnologia / TMS', nature: 'servico', description: 'Assinaturas de software, ERP e rastreamento', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-003', name: 'Honorários Jurídicos e Contábeis', nature: 'servico', description: 'Consultoria fiscal, contábil e advocatícia', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-004', name: 'Pedágio e Tags Eletrônicas', nature: 'servico', description: 'Recargas e faturamento Sem Parar/Veloe', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-005', name: 'Seguros e Rastreamento / GR', nature: 'servico', description: 'Gerenciamento de risco e apólices de transporte', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-006', name: 'Combustíveis e Lubrificantes', nature: 'produto', description: 'Abastecimento de diesel, arla e óleos', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-007', name: 'Pneus e Câmaras de Ar', nature: 'produto', description: 'Aquisição de pneumáticos e recapagens', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-008', name: 'Materiais de Escritório e Limpeza', nature: 'produto', description: 'Insumos do dia a dia administrativo', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-009', name: 'Veículos e Implementos', nature: 'bem', description: 'Aquisição e amortização de caminhões e carretas', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-010', name: 'Equipamentos de Informática', nature: 'bem', description: 'Computadores, monitores, servidores e roteadores', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-011', name: 'Móveis e Utensílios', nature: 'bem', description: 'Mobiliário de escritório e estações de trabalho', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'ct-012', name: 'Tarifas e Despesas Bancárias', nature: 'outros', description: 'Taxas de boletos, transferências e custódia', isDefault: true, createdAt: new Date().toISOString() },
];

export const getInitialInvoicesSeed = (users: User[]): FinancialInvoice[] => {
  const safeUsers = (users || []).filter(u => !isDeveloperUser(u) && !isDemoUser(u));
  const adminUser = safeUsers.find(u => u.profile?.includes('Administrador') || u.profile?.includes('Admin')) || safeUsers[0] || { id: 'usr_admin', name: 'Administrador DLLOG Transportes', profile: 'Administrador do Sistema' };
  const operUser = safeUsers.find(u => u.profile?.includes('Embarcador') || u.profile?.includes('Operador')) || safeUsers[1] || adminUser;
  const agencUser = safeUsers.find(u => u.profile?.includes('Agenciador') || u.profile?.includes('Comercial')) || safeUsers[2] || adminUser;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  return [
    {
      id: 'inv_001',
      invoiceNumber: '89240',
      series: '1',
      accessKey: '35261012345678000199550010000892401827364519',
      supplierName: 'Posto e Restaurante Graal Parada Real',
      supplierCnpjCpf: '12.345.678/0001-99',
      totalAmount: 14850.00,
      issueDate: new Date(y, m, 2).toISOString().split('T')[0],
      dueDate: new Date(y, m, 16).toISOString().split('T')[0],
      paymentDate: new Date(y, m, 16).toISOString().split('T')[0],
      status: 'Pago',
      paymentMethod: 'Boleto',
      costNature: 'produto',
      costTypeId: 'ct-006',
      costTypeName: 'Combustíveis e Lubrificantes',
      costCenterId: 'cc-003',
      costCenterName: 'Frota & Equipamentos',
      responsibleUserId: operUser.id,
      responsibleUserName: operUser.name,
      responsibleUserProfile: String(operUser.profile || 'Operacional'),
      description: 'Abastecimento quinzenal da frota própria de carretas granel',
      notes: 'NF vinculada aos trajetos da rota SP-PR.',
      createdAt: new Date(y, m, 2).toISOString()
    },
    {
      id: 'inv_002',
      invoiceNumber: '44102',
      series: '2',
      supplierName: 'Scania Caminhões & Peças Ltda',
      supplierCnpjCpf: '45.890.123/0002-10',
      totalAmount: 8920.50,
      issueDate: new Date(y, m, 5).toISOString().split('T')[0],
      dueDate: new Date(y, m, 25).toISOString().split('T')[0],
      status: 'Pendente',
      paymentMethod: 'Boleto',
      costNature: 'servico',
      costTypeId: 'ct-001',
      costTypeName: 'Manutenção Mecânica e Peças',
      costCenterId: 'cc-003',
      costCenterName: 'Frota & Equipamentos',
      responsibleUserId: operUser.id,
      responsibleUserName: operUser.name,
      responsibleUserProfile: String(operUser.profile || 'Operacional'),
      description: 'Revisão preventiva e substituição de discos de freio e filtros',
      notes: 'Ordem de serviço OS-7892 aprovada pela gerência.',
      createdAt: new Date(y, m, 5).toISOString()
    },
    {
      id: 'inv_003',
      invoiceNumber: '10982',
      series: '1',
      supplierName: 'TOTVS / Logística & TMS Cloud',
      supplierCnpjCpf: '53.117.047/0001-44',
      totalAmount: 4500.00,
      issueDate: new Date(y, m, 1).toISOString().split('T')[0],
      dueDate: new Date(y, m, 10).toISOString().split('T')[0],
      paymentDate: new Date(y, m, 10).toISOString().split('T')[0],
      status: 'Pago',
      paymentMethod: 'Pix',
      costNature: 'servico',
      costTypeId: 'ct-002',
      costTypeName: 'Serviços de Tecnologia / TMS',
      costCenterId: 'cc-005',
      costCenterName: 'TI & Sistemas',
      responsibleUserId: adminUser.id,
      responsibleUserName: adminUser.name,
      responsibleUserProfile: String(adminUser.profile || 'Administrador'),
      description: 'Mensalidade de licenças dos módulos TMS e integração fiscal',
      notes: 'Faturamento mensal recorrente.',
      createdAt: new Date(y, m, 1).toISOString()
    },
    {
      id: 'inv_004',
      invoiceNumber: '77319',
      series: '1',
      supplierName: 'Brasil Risk Gerenciamento de Risco',
      supplierCnpjCpf: '03.882.910/0001-88',
      totalAmount: 6400.00,
      issueDate: new Date(y, m, 8).toISOString().split('T')[0],
      dueDate: new Date(y, m, 22).toISOString().split('T')[0],
      status: 'Pendente',
      paymentMethod: 'Boleto',
      costNature: 'servico',
      costTypeId: 'ct-005',
      costTypeName: 'Seguros e Rastreamento / GR',
      costCenterId: 'cc-001',
      costCenterName: 'Operacional',
      responsibleUserId: agencUser.id,
      responsibleUserName: agencUser.name,
      responsibleUserProfile: String(agencUser.profile || 'Agenciador'),
      description: 'Consultas cadastrais de motoristas e monitoramento de viagens',
      notes: 'Período operacional do mês.',
      createdAt: new Date(y, m, 8).toISOString()
    },
    {
      id: 'inv_005',
      invoiceNumber: '55210',
      series: '1',
      supplierName: 'Dell Computadores do Brasil',
      supplierCnpjCpf: '72.381.189/0001-25',
      totalAmount: 12500.00,
      issueDate: new Date(y, m, 12).toISOString().split('T')[0],
      dueDate: new Date(y, m, 28).toISOString().split('T')[0],
      status: 'Pendente',
      paymentMethod: 'Transferência',
      costNature: 'bem',
      costTypeId: 'ct-010',
      costTypeName: 'Equipamentos de Informática',
      costCenterId: 'cc-005',
      costCenterName: 'TI & Sistemas',
      responsibleUserId: adminUser.id,
      responsibleUserName: adminUser.name,
      responsibleUserProfile: String(adminUser.profile || 'Administrador'),
      description: 'Aquisição de 3 notebooks Dell Inspiron para os novos agenciadores de carga',
      notes: 'Ativo imobilizado da filial.',
      createdAt: new Date(y, m, 12).toISOString()
    }
  ];
};

// ----------------------------------------------------
// NOTAS FISCAIS (SINCRONIZAÇÃO EM TEMPO REAL & IDs SEQUENCIAIS nf-1, nf-2...)
// ----------------------------------------------------

export const SUPABASE_INVOICES_RECORD_ID = 888;
export const INVOICES_REALTIME_CHANNEL = 'financial_invoices_realtime';

/**
 * Gera o próximo ID sequencial padronizado no formato 'nf-1', 'fat-1', etc.
 */
export function getNextInvoiceId(existingList: FinancialInvoice[], documentType: FinancialDocumentType = 'Nota Fiscal'): string {
  const prefix = documentType === 'Fatura' ? 'fat' : 'nf';
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let maxNum = 0;
  if (Array.isArray(existingList)) {
    for (const item of existingList) {
      if (!item || !item.id) continue;
      const m = String(item.id).match(regex);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }
  return `${prefix}-${maxNum + 1}`;
}

/**
 * Normaliza e migra a lista de notas para que todos os lançamentos possuam IDs sequenciais 'nf-1', 'fat-1'...
 */
export function normalizeInvoicesList(list: FinancialInvoice[]): FinancialInvoice[] {
  if (!Array.isArray(list)) return [];

  // Mantém todas as notas/faturas válidas (nunca descarta por prefixo!)
  const valid = list.filter(inv => inv && (inv.id || inv.invoiceNumber));

  const hasValidIdRegex = /^(nf|fat)-(\d+)$/i;

  // Descobre o maior ID nf- e fat- já existente
  let maxAssignedNf = 0;
  let maxAssignedFat = 0;
  for (const inv of valid) {
    if (!inv.id) continue;
    const mNf = String(inv.id).match(/^nf-(\d+)$/i);
    if (mNf && mNf[1]) {
      const num = parseInt(mNf[1], 10);
      if (!isNaN(num) && num > maxAssignedNf) maxAssignedNf = num;
    }
    const mFat = String(inv.id).match(/^fat-(\d+)$/i);
    if (mFat && mFat[1]) {
      const num = parseInt(mFat[1], 10);
      if (!isNaN(num) && num > maxAssignedFat) maxAssignedFat = num;
    }
  }

  let nextNfSeq = maxAssignedNf === 0 ? 1 : maxAssignedNf + 1;
  let nextFatSeq = maxAssignedFat === 0 ? 1 : maxAssignedFat + 1;

  const normalized = valid.map(inv => {
    let finalId = inv.id;
    const isFatura = inv.documentType === 'Fatura';
    if (!finalId || !hasValidIdRegex.test(finalId)) {
      if (isFatura) {
        finalId = `fat-${nextFatSeq}`;
        nextFatSeq++;
      } else {
        finalId = `nf-${nextNfSeq}`;
        nextNfSeq++;
      }
    }
    return {
      ...inv,
      id: finalId,
      documentType: inv.documentType || 'Nota Fiscal',
      totalAmount: typeof inv.totalAmount === 'number' && !isNaN(inv.totalAmount) ? inv.totalAmount : 0,
      payableAmount: typeof inv.payableAmount === 'number' && !isNaN(inv.payableAmount) ? inv.payableAmount : (inv.totalAmount || 0)
    };
  });

  return normalized;
}

/**
 * Salva com segurança a lista de notas no localStorage prevenindo estourar o limite de 5MB.
 * Remove temporariamente data URLs em base64 do cache local, pois os arquivos reais
 * residem no Supabase Storage via links públicos HTTPS.
 */
export function safeSetInvoicesLocalStorage(invoices: FinancialInvoice[]) {
  try {
    if (!Array.isArray(invoices)) return;
    const sanitized = invoices.map(inv => {
      if (!inv) return inv;
      let hasChanges = false;
      const copy = { ...inv };
      if (typeof copy.fileUrl === 'string' && copy.fileUrl.startsWith('data:')) {
        copy.fileUrl = undefined;
        hasChanges = true;
      }
      if (typeof copy.boletoFileUrl === 'string' && copy.boletoFileUrl.startsWith('data:')) {
        copy.boletoFileUrl = undefined;
        hasChanges = true;
      }
      if (typeof copy.receiptFileUrl === 'string' && copy.receiptFileUrl.startsWith('data:')) {
        copy.receiptFileUrl = undefined;
        hasChanges = true;
      }
      return hasChanges ? copy : inv;
    });
    localStorage.setItem(STORAGE_INVOICES_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('[financialInvoiceService] Aviso de cota/localStorage ao salvar cache local:', err);
  }
}

/**
 * Converte data URL base64 em Blob para upload no Supabase Storage.
 */
export function dataUrlToBlob(dataUrl: string, defaultMime = 'application/pdf'): { blob: Blob; mime: string } {
  try {
    const parts = dataUrl.split(',');
    const header = parts[0];
    const base64 = parts[1] || '';
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : defaultMime;
    const bstr = atob(base64);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return { blob: new Blob([u8arr], { type: mime }), mime };
  } catch (err) {
    console.warn('Erro ao converter dataUrl para Blob:', err);
    return { blob: new Blob([], { type: defaultMime }), mime: defaultMime };
  }
}

/**
 * Faz upload de anexo de nota fiscal ou boleto diretamente para o Supabase Storage
 * retornando a URL pública definitiva na nuvem, evitando acúmulo de base64 e garantindo
 * performance instantânea e compatibilidade universal.
 */
export async function uploadInvoiceAttachmentToStorage(
  fileOrDataUrl: File | string,
  invoiceId: string,
  kind: 'nf' | 'fatura' | 'boleto' | 'comprovante' | 'recibo' | string,
  originalFileName?: string,
  fileType?: string
): Promise<string> {
  if (typeof fileOrDataUrl === 'string') {
    // Se já for uma URL pública HTTPS ou HTTP, mantém sem re-upload
    if (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://')) {
      return fileOrDataUrl;
    }
  }

  try {
    let uploadBody: Blob | File;
    let contentType = fileType || 'application/pdf';
    let safeName = (originalFileName || `${kind}_${invoiceId}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');

    if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')) {
      const parsed = dataUrlToBlob(fileOrDataUrl, contentType);
      uploadBody = parsed.blob;
      contentType = parsed.mime;
    } else if (fileOrDataUrl instanceof File) {
      uploadBody = fileOrDataUrl;
      contentType = fileOrDataUrl.type || contentType;
      safeName = fileOrDataUrl.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    } else {
      return typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '';
    }

    const storagePath = `financial_invoices/${invoiceId}_${kind}_${Date.now()}_${safeName}`;
    const { data, error } = await supabase.storage
      .from('shipment_attachments')
      .upload(storagePath, uploadBody, {
        contentType,
        upsert: true
      });

    if (!error && data?.path) {
      const { data: pubData } = supabase.storage
        .from('shipment_attachments')
        .getPublicUrl(data.path);
      if (pubData?.publicUrl) {
        return pubData.publicUrl;
      }
    } else if (error) {
      console.warn('[Storage] Erro ao fazer upload de anexo no Supabase Storage:', error);
    }
  } catch (err) {
    console.warn('[Storage] Falha ao enviar anexo de nota para o storage:', err);
  }

  // Fallback seguro se storage falhar
  return typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '';
}

export interface RemoteInvoicesResponse {
  invoices: FinancialInvoice[];
  success: boolean;
  error?: any;
}

/**
 * Busca a lista remota compartilhada de notas fiscais no Supabase com indicador explícito de sucesso/falha de rede.
 */
export async function fetchRemoteInvoicesWithStatus(): Promise<RemoteInvoicesResponse> {
  try {
    const { data, error } = await supabase
      .from('profile_permissions')
      .select('permissions')
      .eq('id', SUPABASE_INVOICES_RECORD_ID)
      .maybeSingle();

    if (!error) {
      if (data?.permissions?.invoices && Array.isArray(data.permissions.invoices)) {
        return { invoices: data.permissions.invoices, success: true };
      }
      return { invoices: [], success: true };
    }
    console.warn('[DB] Supabase retornou erro ao consultar NFs:', error);
    return { invoices: [], success: false, error };
  } catch (err) {
    console.warn('[DB] Exceção ao consultar NFs remotas:', err);
    return { invoices: [], success: false, error: err };
  }
}

/**
 * Busca a lista remota compartilhada de notas fiscais no Supabase (row 888 de profile_permissions).
 */
export async function fetchRemoteInvoices(): Promise<FinancialInvoice[]> {
  const res = await fetchRemoteInvoicesWithStatus();
  return res.invoices;
}

/**
 * Normaliza número de nota fiscal (remove zeros à esquerda, prefixos como 'NF' e espaços).
 */
export function normalizeInvoiceNumber(num?: string): string {
  if (!num) return '';
  const clean = String(num)
    .replace(/^(nf|nfe|nfs|nfse|n°|nº|num)\s*/i, '')
    .trim()
    .toLowerCase();
  const noZeros = clean.replace(/^0+/, '');
  return noZeros || clean;
}

/**
 * Normaliza CNPJ ou CPF mantendo apenas dígitos numéricos.
 */
export function normalizeCnpjCpf(doc?: string): string {
  if (!doc) return '';
  return String(doc).replace(/\D/g, '');
}

/**
 * Normaliza nome do fornecedor (remove acentos, espaços extras e sufixos empresariais comuns).
 */
export function normalizeSupplierText(name?: string): string {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\b(da\s+nfs-?e|nfs-?e|nf-?e|danfe|prestador(?:\s+de\s+servicos?)?|tomador(?:\s+de\s+servicos?)?|emitente|destinatario|dados\s+do\s+prestador)\b/gi, '')
    .replace(/\b(ltda|s\/a|sa|eireli|me|epp)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export interface DuplicateInvoiceMatch {
  isDuplicate: boolean;
  matchedInvoice?: FinancialInvoice;
  reason?: 'access_key' | 'number_and_supplier';
  message?: string;
}

/**
 * Identifica rigorosamente se uma Nota Fiscal ou Fatura já existe no sistema com base na:
 * 1) Chave de Acesso da NFe (44 dígitos); OU
 * 2) Número do Documento + Tipo (NF ou Fatura) + Fornecedor (CNPJ/CPF ou Razão Social) + Série.
 */
export function findDuplicateInvoice(
  target: {
    documentType?: FinancialDocumentType;
    invoiceNumber?: string;
    series?: string;
    accessKey?: string;
    supplierName?: string;
    supplierCnpjCpf?: string;
  },
  existingList: FinancialInvoice[],
  excludeId?: string
): DuplicateInvoiceMatch {
  if (!existingList || !Array.isArray(existingList)) {
    return { isDuplicate: false };
  }

  const targetDocType = target.documentType || 'Nota Fiscal';
  const docLabel = targetDocType === 'Fatura' ? 'A Fatura' : 'A Nota Fiscal';

  const targetAccessKey = (target.accessKey || '').replace(/\D/g, '');
  const targetNormNum = normalizeInvoiceNumber(target.invoiceNumber);
  const targetNormCnpj = normalizeCnpjCpf(target.supplierCnpjCpf);
  const targetNormSupplier = normalizeSupplierText(target.supplierName);
  const targetSeries = (target.series || '').trim().toLowerCase();

  // Se não temos ao menos o número do documento ou chave de acesso válida, não há como analisar
  if (!targetNormNum && (!targetAccessKey || targetAccessKey.length < 20)) {
    return { isDuplicate: false };
  }

  for (const inv of existingList) {
    if (!inv) continue;
    // Ignora a própria nota quando estiver em modo de edição
    if (excludeId && inv.id === excludeId) continue;

    // Se os tipos de documento forem explicitamente diferentes (ex: Nota Fiscal vs Fatura), não conflita
    const invDocType = inv.documentType || 'Nota Fiscal';
    if (targetDocType !== invDocType) continue;

    // 1. Verificação por Chave de Acesso (44 dígitos)
    if (targetAccessKey && targetAccessKey.length >= 20) {
      const invAccessKey = (inv.accessKey || '').replace(/\D/g, '');
      if (invAccessKey && invAccessKey === targetAccessKey) {
        return {
          isDuplicate: true,
          matchedInvoice: inv,
          reason: 'access_key',
          message: `Este documento (${targetDocType}) já está cadastrado no sistema sob o ID [${inv.id}] com a mesma Chave de Acesso de 44 dígitos (Fornecedor: ${inv.supplierName || 'Identificado'}, Valor: R$ ${(inv.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
        };
      }
    }

    // 2. Verificação por Número do Documento + Fornecedor + Série
    if (targetNormNum && targetNormNum === normalizeInvoiceNumber(inv.invoiceNumber)) {
      // Se ambas as séries foram informadas e forem explicitamente diferentes (ex: Série 1 vs Série 2), não considera duplicata
      const invSeries = (inv.series || '').trim().toLowerCase();
      const seriesMatch = !targetSeries || !invSeries || targetSeries === invSeries;

      if (seriesMatch) {
        // A) Checagem prioritária e exata por CNPJ/CPF do Fornecedor
        const invNormCnpj = normalizeCnpjCpf(inv.supplierCnpjCpf);
        if (targetNormCnpj && invNormCnpj && targetNormCnpj === invNormCnpj) {
          return {
            isDuplicate: true,
            matchedInvoice: inv,
            reason: 'number_and_supplier',
            message: `${docLabel} nº "${inv.invoiceNumber}" do fornecedor "${inv.supplierName}" (CNPJ ${inv.supplierCnpjCpf || 'identificado'}) já está cadastrada no sistema sob o ID [${inv.id}]!`
          };
        }

        // B) Checagem por Nome/Razão Social do Fornecedor (normalizado)
        const invNormSupplier = normalizeSupplierText(inv.supplierName);
        if (targetNormSupplier && invNormSupplier) {
          if (
            targetNormSupplier === invNormSupplier ||
            (targetNormSupplier.length >= 5 && invNormSupplier.includes(targetNormSupplier)) ||
            (invNormSupplier.length >= 5 && targetNormSupplier.includes(invNormSupplier))
          ) {
            return {
              isDuplicate: true,
              matchedInvoice: inv,
              reason: 'number_and_supplier',
              message: `${docLabel} nº "${inv.invoiceNumber}" do fornecedor "${inv.supplierName}" já está cadastrada no sistema sob o ID [${inv.id}]!`
            };
          }
        }
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Mescla de forma inteligente notas remotas e locais sem perda de dados e prevenindo duplicações.
 */
export function mergeInvoicesList(remoteList: FinancialInvoice[], localList: FinancialInvoice[]): FinancialInvoice[] {
  const result: FinancialInvoice[] = Array.isArray(remoteList) ? [...remoteList] : [];
  const existingIds = new Set(result.map(r => r.id));

  if (Array.isArray(localList)) {
    for (const loc of localList) {
      if (!loc) continue;
      // Previne adicionar nota que já exista na lista remota
      const dup = findDuplicateInvoice(loc, result);
      if (!dup.isDuplicate && !existingIds.has(loc.id)) {
        let id = loc.id;
        if (!id || existingIds.has(id) || !/^nf-\d+$/i.test(id)) {
          id = getNextInvoiceId(result);
        }
        existingIds.add(id);
        result.push({ ...loc, id });
      }
    }
  }

  return normalizeInvoicesList(result);
}

let invoicesChannelInstance: ReturnType<typeof supabase.channel> | null = null;
const invoicesSubscribers = new Set<() => void>();

function ensureInvoicesRealtimeChannel() {
  if (!invoicesChannelInstance) {
    invoicesChannelInstance = supabase.channel(INVOICES_REALTIME_CHANNEL, {
      config: {
        broadcast: { ack: false, self: false },
      }
    });

    // 1. Broadcast Realtime WebSocket entre diferentes navegadores e usuários
    invoicesChannelInstance.on('broadcast', { event: 'invoices_changed' }, () => {
      invoicesSubscribers.forEach(cb => {
        try { cb(); } catch {}
      });
    });

    // 2. Postgres Changes no registro compartilhado no Supabase (row 888 em profile_permissions)
    invoicesChannelInstance.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profile_permissions' },
      (payload: any) => {
        const rowId = payload?.new?.id ?? payload?.old?.id;
        if (rowId === SUPABASE_INVOICES_RECORD_ID || rowId === 888 || !rowId) {
          invoicesSubscribers.forEach(cb => {
            try { cb(); } catch {}
          });
        }
      }
    );

    // 3. Postgres Changes na tabela dedicada financial_invoices (se criada)
    invoicesChannelInstance.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'financial_invoices' },
      () => {
        invoicesSubscribers.forEach(cb => {
          try { cb(); } catch {}
        });
      }
    );

    invoicesChannelInstance.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] ✅ Canal de Notas Fiscais conectado com sucesso');
      }
    });
  }
  return invoicesChannelInstance;
}

/**
 * Envia notificação via broadcast Realtime do Supabase para todos os clientes conectados.
 */
function broadcastInvoicesChange(action: 'create' | 'update' | 'delete', invoiceId?: string) {
  try {
    const channel = ensureInvoicesRealtimeChannel();
    channel.send({
      type: 'broadcast',
      event: 'invoices_changed',
      payload: { action, invoiceId, timestamp: Date.now() }
    });
  } catch (err) {
    console.warn('[Realtime] Falha ao enviar broadcast de notas fiscais:', err);
  }
}

/**
 * Subscreve a atualizações em tempo real das Notas Fiscais (WebSockets Supabase + Postgres + Local).
 */
export function subscribeToFinancialInvoices(onUpdate: () => void) {
  let isMounted = true;
  ensureInvoicesRealtimeChannel();
  invoicesSubscribers.add(onUpdate);

  // 4. Ouvintes de eventos no mesmo navegador (CustomEvent e storage entre abas)
  const handleLocal = () => {
    if (isMounted) onUpdate();
  };
  window.addEventListener('financial_invoices_updated', handleLocal);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_INVOICES_KEY && isMounted) {
      onUpdate();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    isMounted = false;
    invoicesSubscribers.delete(onUpdate);
    window.removeEventListener('financial_invoices_updated', handleLocal);
    window.removeEventListener('storage', handleStorage);
  };
}

export const financialInvoiceService = {
  subscribeInvoicesChange: subscribeToFinancialInvoices,
  // ----------------------------------------------------
  // CENTROS DE CUSTO
  // ----------------------------------------------------
  getCostCenters: async (): Promise<CostCenter[]> => {
    try {
      const { data, error } = await supabase
        .from('financial_cost_centers')
        .select('*')
        .order('name');
      
      if (!error && data && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          code: d.code,
          name: d.name,
          description: d.description,
          isDefault: d.is_default,
          createdAt: d.created_at
        }));
      }
    } catch {
      // Ignora erro e usa fallback
    }

    try {
      const local = localStorage.getItem(STORAGE_COST_CENTERS_KEY);
      if (local) return JSON.parse(local);
    } catch (e) {
      console.warn('Erro ao ler centros de custo locais:', e);
    }

    localStorage.setItem(STORAGE_COST_CENTERS_KEY, JSON.stringify(INITIAL_COST_CENTERS));
    return INITIAL_COST_CENTERS;
  },

  addCostCenter: async (item: Omit<CostCenter, 'id' | 'createdAt'>): Promise<CostCenter> => {
    const newId = `cc_${Date.now()}`;
    const newCenter: CostCenter = {
      ...item,
      id: newId,
      createdAt: new Date().toISOString()
    };

    try {
      await supabase.from('financial_cost_centers').insert({
        name: item.name,
        code: item.code,
        description: item.description,
        is_default: false
      });
    } catch {
      // Suprime erro caso tabela não esteja criada no Supabase ainda
    }

    try {
      const local = localStorage.getItem(STORAGE_COST_CENTERS_KEY);
      const list: CostCenter[] = local ? JSON.parse(local) : INITIAL_COST_CENTERS;
      list.push(newCenter);
      localStorage.setItem(STORAGE_COST_CENTERS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }

    return newCenter;
  },

  // ----------------------------------------------------
  // MODALIDADES / TIPOS DE CUSTO
  // ----------------------------------------------------
  getCostTypes: async (): Promise<CostType[]> => {
    try {
      const { data, error } = await supabase
        .from('financial_cost_types')
        .select('*')
        .order('name');
      
      if (!error && data && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          name: d.name,
          nature: d.nature as InvoiceCostNature,
          description: d.description,
          isDefault: d.is_default,
          createdAt: d.created_at
        }));
      }
    } catch {
      // Fallback
    }

    try {
      const local = localStorage.getItem(STORAGE_COST_TYPES_KEY);
      if (local) return JSON.parse(local);
    } catch (e) {
      console.warn('Erro ao ler tipos de custo locais:', e);
    }

    localStorage.setItem(STORAGE_COST_TYPES_KEY, JSON.stringify(INITIAL_COST_TYPES));
    return INITIAL_COST_TYPES;
  },

  addCostType: async (item: Omit<CostType, 'id' | 'createdAt'>): Promise<CostType> => {
    const newId = `ct_${Date.now()}`;
    const newType: CostType = {
      ...item,
      id: newId,
      createdAt: new Date().toISOString()
    };

    try {
      await supabase.from('financial_cost_types').insert({
        name: item.name,
        nature: item.nature,
        description: item.description,
        is_default: false
      });
    } catch {
      // Suprime erro caso tabela não esteja criada no Supabase ainda
    }

    try {
      const local = localStorage.getItem(STORAGE_COST_TYPES_KEY);
      const list: CostType[] = local ? JSON.parse(local) : INITIAL_COST_TYPES;
      list.push(newType);
      localStorage.setItem(STORAGE_COST_TYPES_KEY, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }

    return newType;
  },

  // ----------------------------------------------------
  // NOTAS FISCAIS
  // ----------------------------------------------------
  getInvoices: async (_users: User[] = []): Promise<FinancialInvoice[]> => {
    try {
      // 1. Tentar ler do Supabase (registro compartilhado 888 acessível a todos os usuários)
      const remoteRes = await fetchRemoteInvoicesWithStatus();
      let remoteInvoices = remoteRes.invoices;

      // 2. Se não encontrou na row 888 e a busca foi bem sucedida, tentar na tabela dedicada 'financial_invoices'
      let fallbackRemote: FinancialInvoice[] | null = null;
      if (remoteRes.success && (!remoteInvoices || remoteInvoices.length === 0)) {
        try {
          const { data, error } = await supabase
            .from('financial_invoices')
            .select('*')
            .order('issue_date', { ascending: false });

          if (!error && data && data.length > 0) {
            fallbackRemote = data.map(d => ({
              id: d.id,
              invoiceNumber: d.invoice_number,
              series: d.series,
              accessKey: d.access_key,
              supplierName: d.supplier_name,
              supplierCnpjCpf: d.supplier_cnpj_cpf,
              totalAmount: Number(d.total_amount) || 0,
              payableAmount: d.payable_amount !== undefined && d.payable_amount !== null ? Number(d.payable_amount) : (Number(d.total_amount) || 0),
              issueDate: d.issue_date,
              dueDate: d.due_date,
              paymentDate: d.payment_date,
              status: d.status as InvoicePaymentStatus,
              paymentMethod: d.payment_method,
              paymentDetails: d.payment_details || d.paymentDetails,
              costNature: d.cost_nature as InvoiceCostNature,
              costTypeId: d.cost_type_id,
              costTypeName: d.cost_type_name,
              costCenterId: d.cost_center_id,
              costCenterName: d.cost_center_name,
              responsibleUserId: d.responsible_user_id,
              responsibleUserName: d.responsible_user_name,
              responsibleUserProfile: d.responsible_user_profile,
              description: d.description,
              notes: d.notes,
              fileUrl: d.file_url,
              fileName: d.file_name,
              fileType: d.file_type,
              fileSize: d.file_size ? Number(d.file_size) : undefined,
              boletoFileUrl: d.boleto_file_url,
              boletoFileName: d.boleto_file_name,
              boletoFileType: d.boleto_file_type,
              boletoFileSize: d.boleto_file_size ? Number(d.boleto_file_size) : undefined,
              createdAt: d.created_at,
              updatedAt: d.updated_at
            }));
          }
        } catch {
          // Tabela ainda não criada
        }
      }

      const effectiveRemote = (remoteInvoices && remoteInvoices.length > 0) ? remoteInvoices : (fallbackRemote || []);

      // 3. Ler cópia local do localStorage
      let localInvoices: FinancialInvoice[] = [];
      try {
        const local = localStorage.getItem(STORAGE_INVOICES_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            localInvoices = parsed;
          }
        }
      } catch (e) {
        console.warn('Erro ao ler notas locais:', e);
      }

      // 4. Se a nuvem tiver dados, mescla com os locais preservando todos os lançamentos
      if (effectiveRemote.length > 0) {
        const merged = mergeInvoicesList(effectiveRemote, localInvoices);
        safeSetInvoicesLocalStorage(merged);
        return merged;
      }

      // 5. Se a nuvem estava vazia mas respondeu com sucesso, e o usuário local já possuir notas:
      if (remoteRes.success && localInvoices.length > 0) {
        const normalizedLocal = normalizeInvoicesList(localInvoices);
        safeSetInvoicesLocalStorage(normalizedLocal);
        
        (async () => {
          try {
            await supabase.from('profile_permissions').upsert({
              id: SUPABASE_INVOICES_RECORD_ID,
              permissions: {
                invoices: normalizedLocal,
                updatedAt: new Date().toISOString()
              }
            });
            broadcastInvoicesChange('update');
          } catch (err) {
            console.warn('[Sync] Falha no upload inicial para Supabase:', err);
          }
        })();

        return normalizedLocal;
      }

      // 6. Se houve falha ao consultar a nuvem (rede offline/timeout), preserva o cache local e não sobrescreve
      if (!remoteRes.success && localInvoices.length > 0) {
        console.warn('[DB] Supabase temporariamente inacessível. Usando cache local de notas fiscais.');
        return localInvoices;
      }

      safeSetInvoicesLocalStorage([]);
      return [];
    } catch (criticalErr) {
      console.error('[DB] Erro crítico em getInvoices, acionando fallback local:', criticalErr);
      try {
        const local = localStorage.getItem(STORAGE_INVOICES_KEY);
        if (local) return JSON.parse(local);
      } catch {}
      return [];
    }
  },

  saveInvoice: async (
    item: Omit<FinancialInvoice, 'id' | 'createdAt'>,
    existingId?: string
  ): Promise<FinancialInvoice> => {
    const isEdit = !!existingId;
    const nowIso = new Date().toISOString();

    // 1. Sempre busca dados atualizados da nuvem Supabase antes de mesclar e salvar
    const remoteList = await fetchRemoteInvoices();
    let localList: FinancialInvoice[] = [];
    try {
      const local = localStorage.getItem(STORAGE_INVOICES_KEY);
      if (local) localList = JSON.parse(local);
    } catch {}

    const currentList = mergeInvoicesList(remoteList, localList);

    // REGRA DE SEGURANÇA FISCAL: Bloqueia lançamento de Nota Fiscal repetida/duplicada
    const duplicateMatch = findDuplicateInvoice(item, currentList, existingId);
    if (duplicateMatch.isDuplicate && duplicateMatch.matchedInvoice) {
      const match = duplicateMatch.matchedInvoice;
      throw new Error(
        duplicateMatch.message ||
        `Lançamento recusado: A Nota Fiscal nº "${item.invoiceNumber}" do fornecedor "${item.supplierName}" já se encontra cadastrada no sistema sob o ID [${match.id}] (Valor: R$ ${(match.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). O sistema não permite lançamentos repetidos.`
      );
    }

    // REGRA DE OURO: Para novos lançamentos, gera ID sequencial no formato 'nf-1', 'fat-1', etc.
    const docType = item.documentType || 'Nota Fiscal';
    const invoiceId = existingId || getNextInvoiceId(currentList, docType);

    // Converte e envia anexos pesados para o Supabase Storage (se for data URL base64)
    let finalFileUrl = item.fileUrl;
    if (finalFileUrl && finalFileUrl.startsWith('data:')) {
      finalFileUrl = await uploadInvoiceAttachmentToStorage(
        finalFileUrl,
        invoiceId,
        docType === 'Fatura' ? 'fatura' : 'nf',
        item.fileName,
        item.fileType
      );
    }

    let finalBoletoFileUrl = item.boletoFileUrl;
    if (finalBoletoFileUrl && finalBoletoFileUrl.startsWith('data:')) {
      finalBoletoFileUrl = await uploadInvoiceAttachmentToStorage(
        finalBoletoFileUrl,
        invoiceId,
        'boleto',
        item.boletoFileName,
        item.boletoFileType
      );
    }

    let finalReceiptFileUrl = item.receiptFileUrl;
    if (finalReceiptFileUrl && finalReceiptFileUrl.startsWith('data:')) {
      finalReceiptFileUrl = await uploadInvoiceAttachmentToStorage(
        finalReceiptFileUrl,
        invoiceId,
        'comprovante',
        item.receiptFileName,
        item.receiptFileType
      );
    }

    const completeInvoice: FinancialInvoice = {
      ...item,
      id: invoiceId,
      documentType: docType,
      fileUrl: finalFileUrl,
      boletoFileUrl: finalBoletoFileUrl,
      receiptFileUrl: finalReceiptFileUrl,
      receiptFileName: item.receiptFileName,
      receiptFileType: item.receiptFileType,
      receiptFileSize: item.receiptFileSize,
      paymentAuthCode: item.paymentAuthCode,
      totalAmount: Number(item.totalAmount) || 0,
      payableAmount: item.payableAmount !== undefined && !isNaN(item.payableAmount) ? Number(item.payableAmount) : (Number(item.totalAmount) || 0),
      createdAt: isEdit ? (item as any).createdAt || nowIso : nowIso,
      updatedAt: nowIso
    };

    let updatedList: FinancialInvoice[];
    if (isEdit) {
      updatedList = currentList.map(inv => inv.id === existingId ? completeInvoice : inv);
    } else {
      updatedList = [completeInvoice, ...currentList.filter(inv => inv.id !== invoiceId)];
    }
    updatedList = normalizeInvoicesList(updatedList);

    // 2. Persistência na nuvem Supabase (Registro compartilhado para sincronização entre todos os usuários)
    try {
      await supabase.from('profile_permissions').upsert({
        id: SUPABASE_INVOICES_RECORD_ID,
        permissions: {
          invoices: updatedList,
          updatedAt: nowIso
        }
      });
    } catch (err) {
      console.warn('[Supabase] Erro ao sincronizar NFs na nuvem:', err);
    }

    // 3. Tentar persistir também na tabela dedicada 'financial_invoices' se existir
    try {
      const dbPayload = {
        document_type: completeInvoice.documentType,
        invoice_number: item.invoiceNumber,
        series: item.series,
        access_key: item.accessKey,
        supplier_name: item.supplierName,
        supplier_cnpj_cpf: item.supplierCnpjCpf,
        total_amount: completeInvoice.totalAmount,
        payable_amount: completeInvoice.payableAmount,
        issue_date: item.issueDate,
        due_date: item.dueDate,
        payment_date: item.paymentDate || null,
        status: item.status,
        payment_method: item.paymentMethod,
        payment_details: item.paymentDetails || null,
        cost_nature: item.costNature,
        cost_type_id: item.costTypeId || null,
        cost_type_name: item.costTypeName,
        cost_center_id: item.costCenterId || null,
        cost_center_name: item.costCenterName,
        responsible_user_id: item.responsibleUserId,
        responsible_user_name: item.responsibleUserName,
        responsible_user_profile: item.responsibleUserProfile,
        description: item.description,
        notes: item.notes,
        file_url: completeInvoice.fileUrl,
        file_name: item.fileName,
        file_type: item.fileType,
        file_size: item.fileSize,
        boleto_file_url: completeInvoice.boletoFileUrl,
        boleto_file_name: item.boletoFileName,
        boleto_file_type: item.boletoFileType,
        boleto_file_size: item.boletoFileSize,
        receipt_file_url: completeInvoice.receiptFileUrl,
        receipt_file_name: item.receiptFileName,
        receipt_file_type: item.receiptFileType,
        receipt_file_size: item.receiptFileSize,
        payment_auth_code: item.paymentAuthCode,
        updated_at: nowIso
      };

      if (isEdit) {
        await supabase.from('financial_invoices').update(dbPayload).eq('id', existingId);
      } else {
        await supabase.from('financial_invoices').insert(dbPayload);
      }
    } catch {
      // Tabela não criada
    }

    // 4. Persistência local garantida
    safeSetInvoicesLocalStorage(updatedList);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_invoices_updated', { detail: completeInvoice }));
    }

    // 5. Notificar todos os outros usuários conectados via WebSocket Realtime
    broadcastInvoicesChange(isEdit ? 'update' : 'create', invoiceId);

    return completeInvoice;
  },

  updateInvoicePayment: async (
    id: string,
    params: {
      status?: InvoicePaymentStatus;
      paymentDate?: string;
      receiptFileUrl?: string | null;
      receiptFileName?: string | null;
      receiptFileType?: string | null;
      receiptFileSize?: number | null;
      paymentMethod?: FinancialInvoice['paymentMethod'];
      paymentAuthCode?: string | null;
      interestAmount?: number;
      discountAmount?: number;
      paidAmount?: number;
      bankAccount?: string;
      notes?: string;
    }
  ): Promise<FinancialInvoice | null> => {
    const nowIso = new Date().toISOString();
    
    // Sempre busca da nuvem para mesclar antes de atualizar
    const remoteList = await fetchRemoteInvoices();
    let localList: FinancialInvoice[] = [];
    try {
      const local = localStorage.getItem(STORAGE_INVOICES_KEY);
      if (local) localList = JSON.parse(local);
    } catch {}

    const currentList = mergeInvoicesList(remoteList, localList);
    let targetInvoice: FinancialInvoice | null = null;

    const updatedList = currentList.map(inv => {
      if (inv.id === id) {
        const nextStatus = params.status !== undefined ? params.status : inv.status;
        const nextPaymentDate = params.paymentDate !== undefined 
          ? params.paymentDate 
          : (nextStatus === 'Pago' ? (inv.paymentDate || new Date().toISOString().split('T')[0]) : undefined);

        const updated: FinancialInvoice = {
          ...inv,
          status: nextStatus,
          paymentDate: nextPaymentDate,
          updatedAt: nowIso
        };

        if (params.receiptFileUrl !== undefined) updated.receiptFileUrl = params.receiptFileUrl || undefined;
        if (params.receiptFileName !== undefined) updated.receiptFileName = params.receiptFileName || undefined;
        if (params.receiptFileType !== undefined) updated.receiptFileType = params.receiptFileType || undefined;
        if (params.receiptFileSize !== undefined) updated.receiptFileSize = params.receiptFileSize || undefined;
        if (params.paymentMethod !== undefined) updated.paymentMethod = params.paymentMethod;
        if (params.paymentAuthCode !== undefined) updated.paymentAuthCode = params.paymentAuthCode || undefined;
        if (params.interestAmount !== undefined) updated.interestAmount = params.interestAmount;
        if (params.discountAmount !== undefined) updated.discountAmount = params.discountAmount;
        if (params.paidAmount !== undefined) {
          updated.paidAmount = params.paidAmount;
          updated.payableAmount = params.paidAmount;
        }
        if (params.bankAccount !== undefined) updated.bankAccount = params.bankAccount;
        if (params.notes !== undefined) updated.notes = params.notes;

        targetInvoice = updated;
        return updated;
      }
      return inv;
    });

    // Atualiza no Supabase row 888
    try {
      if (updatedList.length > 0) {
        await supabase.from('profile_permissions').upsert({
          id: SUPABASE_INVOICES_RECORD_ID,
          permissions: {
            invoices: updatedList,
            updatedAt: nowIso
          }
        });
      }
    } catch (err) {
      console.warn('[Supabase] Erro ao atualizar baixa de NF na nuvem:', err);
    }

    // Tenta atualizar na tabela dedicada
    try {
      const settledInvoice = updatedList.find(inv => inv.id === id);
      if (settledInvoice) {
        await supabase
          .from('financial_invoices')
          .update({
            status: settledInvoice.status,
            payment_date: settledInvoice.paymentDate || null,
            receipt_file_url: settledInvoice.receiptFileUrl || null,
            receipt_file_name: settledInvoice.receiptFileName || null,
            receipt_file_type: settledInvoice.receiptFileType || null,
            receipt_file_size: settledInvoice.receiptFileSize || null,
            payment_method: settledInvoice.paymentMethod || null,
            updated_at: nowIso
          })
          .eq('id', id);
      }
    } catch {}

    // Atualiza local com seguranca de cota
    safeSetInvoicesLocalStorage(updatedList);

    // Notifica abas e outros usuarios
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_invoices_updated', { detail: targetInvoice || { id, status: params.status } }));
    }
    broadcastInvoicesChange('update', id);
    return targetInvoice;
  },

  updateInvoiceStatus: async (
    id: string,
    status: InvoicePaymentStatus,
    paymentDate?: string
  ): Promise<void> => {
    const nowIso = new Date().toISOString();
    
    // Sempre busca da nuvem para mesclar antes de atualizar status
    const remoteList = await fetchRemoteInvoices();
    let localList: FinancialInvoice[] = [];
    try {
      const local = localStorage.getItem(STORAGE_INVOICES_KEY);
      if (local) localList = JSON.parse(local);
    } catch {}

    const currentList = mergeInvoicesList(remoteList, localList);
    const updatedList = currentList.map(inv => {
      if (inv.id === id) {
        return {
          ...inv,
          status,
          paymentDate: paymentDate || (status === 'Pago' ? (inv.paymentDate || new Date().toISOString().split('T')[0]) : undefined),
          updatedAt: nowIso
        };
      }
      return inv;
    });

    // Atualiza no Supabase row 888
    try {
      if (updatedList.length > 0) {
        await supabase.from('profile_permissions').upsert({
          id: SUPABASE_INVOICES_RECORD_ID,
          permissions: {
            invoices: updatedList,
            updatedAt: nowIso
          }
        });
      }
    } catch (err) {
      console.warn('[Supabase] Erro ao atualizar status de NF na nuvem:', err);
    }

    // Tenta atualizar na tabela dedicada
    try {
      await supabase
        .from('financial_invoices')
        .update({
          status,
          payment_date: paymentDate || (status === 'Pago' ? new Date().toISOString().split('T')[0] : null),
          updated_at: nowIso
        })
        .eq('id', id);
    } catch {}

    // Atualiza local com segurança de cota
    safeSetInvoicesLocalStorage(updatedList);

    // Notifica abas e outros usuários
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_invoices_updated', { detail: { id, status } }));
    }
    broadcastInvoicesChange('update', id);
  },

  reconcileInvoice: async (
    id: string,
    params: { ofxTransactionId?: string; checkNum?: string; userId?: string; userName?: string }
  ): Promise<void> => {
    const nowIso = new Date().toISOString();
    const remoteList = await fetchRemoteInvoices();
    let localList: FinancialInvoice[] = [];
    try {
      const local = localStorage.getItem(STORAGE_INVOICES_KEY);
      if (local) localList = JSON.parse(local);
    } catch {}

    const currentList = mergeInvoicesList(remoteList, localList);
    const updatedList = currentList.map(inv => {
      if (inv.id === id) {
        return {
          ...inv,
          isReconciled: true,
          reconciledAt: nowIso,
          ofxTransactionId: params.ofxTransactionId || inv.ofxTransactionId,
          ofxCheckNum: params.checkNum || inv.ofxCheckNum,
          reconciledByUserId: params.userId,
          reconciledByUserName: params.userName,
          updatedAt: nowIso
        };
      }
      return inv;
    });

    try {
      if (updatedList.length > 0) {
        await supabase.from('profile_permissions').upsert({
          id: SUPABASE_INVOICES_RECORD_ID,
          permissions: { invoices: updatedList, updatedAt: nowIso }
        });
      }
    } catch (err) {
      console.warn('[Supabase] Erro ao conciliar NF na nuvem:', err);
    }

    safeSetInvoicesLocalStorage(updatedList);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_invoices_updated', { detail: { id, isReconciled: true } }));
    }
    broadcastInvoicesChange('update', id);
  },

  unreconcileInvoice: async (
    id: string,
    params: { reason: string; userId?: string; userName?: string }
  ): Promise<void> => {
    const nowIso = new Date().toISOString();
    const remoteList = await fetchRemoteInvoices();
    let localList: FinancialInvoice[] = [];
    try {
      const local = localStorage.getItem(STORAGE_INVOICES_KEY);
      if (local) localList = JSON.parse(local);
    } catch {}

    const currentList = mergeInvoicesList(remoteList, localList);
    const updatedList = currentList.map(inv => {
      if (inv.id === id) {
        return {
          ...inv,
          isReconciled: false,
          unreconciledReason: params.reason,
          unreconciledAt: nowIso,
          unreconciledByUserName: params.userName,
          updatedAt: nowIso
        };
      }
      return inv;
    });

    try {
      if (updatedList.length > 0) {
        await supabase.from('profile_permissions').upsert({
          id: SUPABASE_INVOICES_RECORD_ID,
          permissions: { invoices: updatedList, updatedAt: nowIso }
        });
      }
    } catch (err) {
      console.warn('[Supabase] Erro ao desconciliar NF na nuvem:', err);
    }

    safeSetInvoicesLocalStorage(updatedList);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_invoices_updated', { detail: { id, isReconciled: false } }));
    }
    broadcastInvoicesChange('update', id);
  },

  deleteInvoice: async (id: string): Promise<void> => {
    const nowIso = new Date().toISOString();
    
    const remoteList = await fetchRemoteInvoices();
    let localList: FinancialInvoice[] = [];
    try {
      const local = localStorage.getItem(STORAGE_INVOICES_KEY);
      if (local) localList = JSON.parse(local);
    } catch {}

    const currentList = mergeInvoicesList(remoteList, localList);
    const updatedList = currentList.filter(inv => inv.id !== id);

    // Atualiza no Supabase row 888
    try {
      await supabase.from('profile_permissions').upsert({
        id: SUPABASE_INVOICES_RECORD_ID,
        permissions: {
          invoices: updatedList,
          updatedAt: nowIso
        }
      });
    } catch (err) {
      console.warn('[Supabase] Erro ao deletar NF na nuvem:', err);
    }

    // Tenta deletar na tabela dedicada
    try {
      await supabase.from('financial_invoices').delete().eq('id', id);
    } catch {}

    // Atualiza local com segurança de cota
    safeSetInvoicesLocalStorage(updatedList);

    // Notifica abas e outros usuários
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('financial_invoices_updated', { detail: { id, deleted: true } }));
    }
    broadcastInvoicesChange('delete', id);
  }
};

