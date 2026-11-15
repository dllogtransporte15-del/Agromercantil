import type { 
  RdoSolicitacaoPayload, 
  RdoSolicitacaoResponse, 
  RdoRequestRecord, 
  RdoExtensaoArquivo, 
  RdoConfig 
} from '../types';
import { fetchRdoConfig, upsertRdoRequest, fetchRdoRequests } from '../lib/db';

/**
 * Utilitário: Remove qualquer caractere não numérico de CPFs e CNPJs
 */
export function cleanDocumentNumber(doc?: string): string {
  if (!doc) return '';
  return doc.replace(/\D/g, '').trim();
}

/**
 * Utilitário: Sanitiza a placa do veículo
 */
export function cleanPlate(plate?: string): string {
  if (!plate) return '';
  return plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
}

/**
 * Utilitário: Extrai a extensão e converte um File ou Blob para Base64 puro
 */
export async function fileToBase64(fileOrBlob: File | Blob): Promise<{ base64: string; extension: RdoExtensaoArquivo }> {
  return new Promise((resolve, reject) => {
    let extension: RdoExtensaoArquivo = 'pdf';
    
    if ('name' in fileOrBlob && typeof (fileOrBlob as File).name === 'string') {
      const ext = (fileOrBlob as File).name.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') extension = 'jpg';
      else if (ext === 'png') extension = 'png';
      else if (ext === 'pdf') extension = 'pdf';
    } else if (fileOrBlob.type) {
      if (fileOrBlob.type.includes('png')) extension = 'png';
      else if (fileOrBlob.type.includes('jpeg') || fileOrBlob.type.includes('jpg')) extension = 'jpg';
      else if (fileOrBlob.type.includes('pdf')) extension = 'pdf';
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove prefixo data:...;base64, para enviar apenas o payload base64 puro
      const pureBase64 = result.includes('base64,') ? result.split('base64,')[1] : result;
      resolve({ base64: pureBase64, extension });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Utilitário: Converte uma URL de arquivo remoto (ex: Supabase Storage) para Base64
 */
export async function urlToBase64(fileUrl: string): Promise<{ base64: string; extension: RdoExtensaoArquivo }> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo da URL (${response.statusText})`);
  }
  const blob = await response.blob();
  return fileToBase64(blob);
}

/**
 * Envia uma solicitação de análise cadastral para o RDO Nacional
 * (Post para /api/rdo-nacional/solicitacoes ou direto para o host se ambiente backend)
 */
export async function submitRdoSolicitacao(
  payload: RdoSolicitacaoPayload,
  extraMeta?: {
    shipmentId?: string;
    driverId?: string;
    createdById?: string;
    createdByName?: string;
    cnhUrl?: string;
  }
): Promise<{ success: boolean; data?: RdoSolicitacaoResponse; record?: RdoRequestRecord; error?: string }> {
  try {
    const config = await fetchRdoConfig();

    if (!config.apiToken || !config.apiToken.trim()) {
      return {
        success: false,
        error: 'Token de Integração do RDO Nacional não configurado. Por favor, configure a chave nas configurações do sistema.'
      };
    }

    const cleanCpf = cleanDocumentNumber(payload.cpf);
    if (!cleanCpf || cleanCpf.length !== 11) {
      return {
        success: false,
        error: 'CPF do motorista inválido ou não informado. É obrigatório ter 11 dígitos.'
      };
    }

    if (!payload.nome || !payload.nome.trim()) {
      return {
        success: false,
        error: 'Nome do motorista é obrigatório.'
      };
    }

    // Monta o payload final conforme documentação oficial
    const requestBody: RdoSolicitacaoPayload = {
      nomeDoCliente: payload.nomeDoCliente || config.clientName || 'DLLOG TRANSPORTES',
      cpf: cleanCpf,
      nome: payload.nome.trim().toUpperCase(),
      nomeDaMae: payload.nomeDaMae?.trim() ? payload.nomeDaMae.trim().toUpperCase() : undefined,
      dataDeNascimento: payload.dataDeNascimento || undefined,
      documentoDoProprietario: payload.documentoDoProprietario ? cleanDocumentNumber(payload.documentoDoProprietario) : undefined,
      nomeDoProprietario: payload.nomeDoProprietario?.trim() ? payload.nomeDoProprietario.trim().toUpperCase() : undefined,
      placaDoCavalo: payload.placaDoCavalo ? cleanPlate(payload.placaDoCavalo) : undefined,
      cnhBase64: payload.cnhBase64 || undefined,
      cnhExtensao: payload.cnhExtensao || undefined,
    };

    // Chamada através do proxy local / serverless para evitar problemas de CORS no navegador
    // Se estiver no browser, enviamos via endpoint interno '/api/rdo-nacional/solicitacoes'
    const endpoint = '/api/rdo-nacional/solicitacoes';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': config.apiToken.trim(),
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = responseData?.message || responseData?.error || `Erro ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: errMsg
      };
    }

    if (!responseData.id) {
      return {
        success: false,
        error: 'Resposta da API do Rdo Nacional não conteve o identificador único (id).'
      };
    }

    const rdoResponse: RdoSolicitacaoResponse = {
      id: responseData.id,
      codigo: Number(responseData.codigo || 0),
    };

    // Registra a solicitação na base de dados
    const newRecord: RdoRequestRecord = {
      id: rdoResponse.id,
      codigo: rdoResponse.codigo,
      shipmentId: extraMeta?.shipmentId,
      driverId: extraMeta?.driverId,
      cpf: requestBody.cpf,
      nome: requestBody.nome,
      nomeDaMae: requestBody.nomeDaMae,
      dataDeNascimento: requestBody.dataDeNascimento,
      documentoDoProprietario: requestBody.documentoDoProprietario,
      nomeDoProprietario: requestBody.nomeDoProprietario,
      placaDoCavalo: requestBody.placaDoCavalo,
      status: 'pendente',
      cnhUrl: extraMeta?.cnhUrl,
      createdAt: new Date().toISOString(),
      createdById: extraMeta?.createdById,
      createdByName: extraMeta?.createdByName,
      rawResponse: responseData,
    };

    await upsertRdoRequest(newRecord);

    return {
      success: true,
      data: rdoResponse,
      record: newRecord,
    };
  } catch (err: any) {
    console.error('[RDO Service] Erro ao enviar solicitação:', err);
    return {
      success: false,
      error: err?.message || 'Falha de conexão com a API do RDO Nacional.'
    };
  }
}

/**
 * Consulta a lista de solicitações gravadas
 */
export async function getRdoHistory(): Promise<RdoRequestRecord[]> {
  return fetchRdoRequests();
}
