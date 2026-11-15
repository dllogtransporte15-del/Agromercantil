import { createClient } from '@supabase/supabase-js';

/**
 * Webhook Oficial do Rdo Nacional para recebimento de pareceres concluídos
 * Rota: POST /api/rdo-nacional/parecer
 * 
 * Cabeçalho esperado: x-access-token: <token_de_callback>
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-access-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const incomingToken = req.headers['x-access-token'];

  // Dados do Supabase
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[RDO Webhook] Credenciais do Supabase ausentes no ambiente');
    return res.status(500).json({ error: 'Configuração interna do banco de dados ausente' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Validação opcional de token de callback se estiver configurado
  try {
    const { data: permData } = await supabase.from('profile_permissions').select('permissions').eq('id', 1).single();
    const rdoConfig = permData?.permissions?.rdo_config;
    const expectedCallbackToken = rdoConfig?.callbackToken || process.env.RDO_CALLBACK_TOKEN;

    if (expectedCallbackToken && expectedCallbackToken.trim()) {
      if (!incomingToken || incomingToken.trim() !== expectedCallbackToken.trim()) {
        console.warn('[RDO Webhook] Token de callback inválido:', incomingToken);
        return res.status(401).json({ error: 'Unauthorized: Token de callback inválido' });
      }
    }
  } catch (err) {
    console.warn('[RDO Webhook] Não foi possível validar token nas configurações:', err);
  }

  // Extrai o payload enviado pelo RDO Nacional
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const {
    idSolicitacao,
    parecer,
    observacao,
    cpf,
    nome,
    documentoDoProprietario,
    nomeDoProprietario,
    placa
  } = body || {};

  if (!idSolicitacao) {
    return res.status(400).json({ error: 'Campo idSolicitacao é obrigatório' });
  }

  const parecerInt = Number(parecer);
  const statusStr = parecerInt === 0 ? 'aprovado' : 'consta_informacao';
  const cleanCpf = cpf ? String(cpf).replace(/\D/g, '') : '';

  try {
    // 1. Atualiza ou insere o registro na tabela rdo_requests
    const { data: existingRecord } = await supabase
      .from('rdo_requests')
      .select('*')
      .eq('id', idSolicitacao)
      .maybeSingle();

    const recordPayload: any = {
      id: idSolicitacao,
      parecer: parecerInt,
      status: statusStr,
      observacao: observacao || null,
      concluded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      raw_webhook_payload: body,
    };

    if (cleanCpf) recordPayload.cpf = cleanCpf;
    if (nome) recordPayload.nome = nome;
    if (documentoDoProprietario) recordPayload.documento_proprietario = documentoDoProprietario;
    if (nomeDoProprietario) recordPayload.nome_proprietario = nomeDoProprietario;
    if (placa) recordPayload.placa_cavalo = placa;

    if (!existingRecord) {
      recordPayload.created_at = new Date().toISOString();
      recordPayload.codigo = 0;
    }

    await supabase.from('rdo_requests').upsert(recordPayload);

    // 2. Se houver um shipmentId vinculado, atualiza dados do embarque caso aprovado
    const targetShipmentId = existingRecord?.shipment_id;
    if (targetShipmentId && parecerInt === 0) {
      const releaseCode = existingRecord?.codigo 
        ? `RDO-${existingRecord.codigo}` 
        : `RDO-${idSolicitacao.slice(0, 8).toUpperCase()}`;

      await supabase
        .from('shipments')
        .update({
          risk_release_code: releaseCode,
          risk_query_type: 'RDO Nacional',
        })
        .eq('id', targetShipmentId);
    }

    // 3. Resposta de Sucesso conforme documentação (200 OK)
    return res.status(200).json({
      success: true,
      message: 'Parecer recebido e processado com sucesso pelo sistema DLLOG Transportes',
      idSolicitacao,
      status: statusStr
    });
  } catch (err: any) {
    console.error('[RDO Webhook] Erro ao gravar parecer no Supabase:', err);
    return res.status(500).json({
      error: 'Erro interno ao processar o parecer do webhook',
      details: err?.message || String(err)
    });
  }
}
