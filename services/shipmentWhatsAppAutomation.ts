import { Shipment, Cargo, Client, Driver, User, ShipmentStatus } from '../types';
import { WhatsAppTemplate, WhatsAppTriggerEvent } from '../types/whatsapp';
import { 
  getWhatsAppTemplates, 
  enqueueAndDispatchMessage, 
  sanitizePhoneNumber 
} from './whatsappService';

export type ShipmentWhatsAppTriggerType = 
  | 'risk_pending'      // Gatilho 1: Aguardando Cadastro e Seguradora (Homologação)
  | 'risk_approved'     // Gatilho 2: Aguardando Carregamento (Cadastro e Risco Liberados)
  | 'fiscal_emitted'    // Gatilho 3: Saída de Aguardando Fiscal para Aguardando Adiantamento (Envio de Documentação)
  | 'advance_paid'      // Gatilho 4: Avanço do Aguardando Adiantamento (Comprovante de Adiantamento)
  | 'in_transit'        // Gatilho 5A: Aguardando Agendamento / Troca de NF-e
  | 'awaiting_discharge'// Gatilho 5B: Aguardando Descarga
  | 'balance_paid';     // Gatilho 6: Aguardando Saldo -> Finalizado (Comprovante de Saldo e Agradecimento)

export interface ShipmentAutomationContext {
  shipment: Shipment;
  cargo?: Cargo | null;
  client?: Client | null;
  driver?: Driver | null;
  drivers?: Driver[];
  user?: User | null;
  previousStatus?: ShipmentStatus;
  targetStatus?: ShipmentStatus;
  newUploadedDocuments?: Record<string, string[]>;
}

export interface TriggerAttachment {
  url: string;
  filename: string;
  label: string;
  documentType: string;
}

/**
 * Templates padrão oficiais dos 6 gatilhos operacionais do WhatsApp
 */
export const SHIPMENT_TRIGGER_TEMPLATES: Record<ShipmentWhatsAppTriggerType, {
  name: string;
  triggerEvent: WhatsAppTriggerEvent;
  bodyText: string;
}> = {
  risk_pending: {
    name: 'Gatilho 1 - Aguardando Cadastro e Seguradora',
    triggerEvent: 'shipment.risk_pending',
    bodyText: 
`Olá, {{nome_motorista}}! Tudo bem? 🚛

Seu cadastro para a viagem de {{origem}} com destino a {{destino}} foi iniciado com sucesso!

Neste momento, seus dados e os do veículo estão em processo de validação cadastral e homologação junto à gerenciadora de risco / seguradora.

Assim que obtivermos o retorno e a liberação, você receberá a confirmação por aqui. Qualquer dúvida ou documento pendente, entraremos em contato.`
  },
  risk_approved: {
    name: 'Gatilho 2 - Aguardando Carregamento (Liberado)',
    triggerEvent: 'shipment.risk_approved',
    bodyText: 
`Boas notícias, {{nome_motorista}}! ✅

Seu cadastro e liberação de risco foram APROVADOS! Você já está liberado para seguir ao local de carregamento.

📍 Dados do Carregamento:
• Local / Embarcador: {{nome_embarcador}}
• Endereço: {{endereco_carregamento}}
• Contato no local: {{contato_embarcador}}
• Data / Janela: {{data_horario_carregamento}}

Por favor, faça contato com o responsável no local assim que se aproximar e nos mantenha informados sobre o início do carregamento. Boa viagem até o ponto de coleta!`
  },
  fiscal_emitted: {
    name: 'Gatilho 3 - Emissão Fiscal e Documentos de Viagem',
    triggerEvent: 'shipment.fiscal_emitted',
    bodyText: 
`{{nome_motorista}}, seu embarque foi faturado e emitido fiscalmente! 📄📦

Seguem em anexo todos os documentos oficiais da sua viagem:
• CT-e (Conhecimento de Transporte)
• MDF-e (Manifesto)
• NF-e (Nota Fiscal)
• Carta Frete
{{#if agendamento}}• Comprovante de Agendamento{{/if}}

Por favor, baixe e confira os arquivos anexados acima. O processo de pagamento do seu adiantamento já está em andamento no setor financeiro.`
  },
  advance_paid: {
    name: 'Gatilho 4 - Comprovante de Adiantamento de Frete',
    triggerEvent: 'shipment.advance_paid',
    bodyText: 
`Adiantamento realizado com sucesso, {{nome_motorista}}! 💵✨

O valor referente ao adiantamento do frete já foi creditado na sua conta. O comprovante de pagamento segue em anexo nesta mensagem.

Seu embarque agora está atualizado e pronto para seguir viagem. Dirija com cuidado e mantenha a equipe informada sobre seu trajeto!`
  },
  in_transit: {
    name: 'Gatilho 5A - Em Trânsito / Agendamento / Troca de NF-e',
    triggerEvent: 'shipment.in_transit',
    bodyText: 
`Olá, {{nome_motorista}}! 📋

Sua viagem está em andamento. Estamos acompanhando a programação:
• Status atual: {{status_atual}}
• Previsão: Nossa equipe está alinhando os detalhes operacionais e enviaremos qualquer atualização imediatamente por aqui.

Se precisar de algum suporte durante a rota, estamos à disposição.`
  },
  awaiting_discharge: {
    name: 'Gatilho 5B - Aguardando Descarga & Canhoto',
    triggerEvent: 'shipment.awaiting_discharge',
    bodyText: 
`Olá, {{nome_motorista}}! 🏁

Você está na etapa de entrega/descarga:
📍 Local de Descarga: {{local_descarga}}
• Destinatário: {{destinatario}}

⚠️ Lembrete importante: Assim que a descarga for concluída, não se esqueça de colher o canhoto/ticket de pesagem assinado e carimbado e enviar a foto pelo nosso aplicativo para liberação do saldo.`
  },
  balance_paid: {
    name: 'Gatilho 6 - Conclusão de Viagem e Saldo Quitado',
    triggerEvent: 'shipment.balance_paid',
    bodyText: 
`Tudo certo, {{nome_motorista}}! Viagem concluída com sucesso! 🏁🎉

O pagamento do SALDO final do seu frete já foi creditado na sua conta cadastrada. O comprovante bancário segue em anexo.

Agradecemos imensamente pela parceria, profissionalismo e dedicação durante todo o transporte. É um prazer rodar com você!

Assim que estiver disponível para novos carregamentos, entre em contato com a nossa equipe de logística para conferirmos as melhores ofertas de frete para o seu retorno.

Até a próxima e boa viagem! 🚛🤝`
  }
};

/**
 * Extrai o primeiro nome do motorista de forma elegante
 */
export function extractFirstName(fullName?: string): string {
  if (!fullName) return 'Motorista';
  const trimmed = fullName.trim();
  const first = trimmed.split(/\s+/)[0];
  if (!first) return 'Motorista';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Formata a data e horário de carregamento para exibição
 */
export function formatLoadingWindow(scheduledDate?: string, scheduledTime?: string): string {
  if (!scheduledDate) return 'A combinar';
  const parts = scheduledDate.split('-');
  const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : scheduledDate;
  if (scheduledTime && scheduledTime.trim()) {
    return `${dateStr} às ${scheduledTime.trim()}`;
  }
  return dateStr;
}

/**
 * Localiza o número de telefone válido do motorista
 */
export function resolveDriverWhatsApp(
  shipment: Shipment, 
  driver?: Driver | null, 
  driversList?: Driver[]
): { rawPhone: string; cleanPhone: string; driverName: string } | null {
  let rawPhone = '';

  // 1. Tenta pegar direto do objeto driver fornecido
  if (driver && (driver.phone || (driver as any).whatsapp)) {
    rawPhone = (driver as any).whatsapp || driver.phone;
  }

  // 2. Se não achou, procura na lista de motoristas por CPF ou Nome
  if (!rawPhone && driversList && driversList.length > 0) {
    const cleanCpf = (shipment.driverCpf || '').replace(/\D/g, '');
    const cleanName = (shipment.driverName || '').trim().toLowerCase();
    
    const matched = driversList.find(d => {
      const dCpf = (d.cpf || '').replace(/\D/g, '');
      const dName = (d.name || '').trim().toLowerCase();
      if (cleanCpf && dCpf && cleanCpf === dCpf) return true;
      if (cleanName && dName && cleanName === dName) return true;
      return false;
    });

    if (matched && (matched.phone || (matched as any).whatsapp)) {
      rawPhone = (matched as any).whatsapp || matched.phone;
    }
  }

  // 3. Fallback para driverContact do shipment
  if (!rawPhone && shipment.driverContact) {
    rawPhone = shipment.driverContact;
  }

  const cleanPhone = sanitizePhoneNumber(rawPhone);
  // Requer ao menos DDI + DDD + número (12 a 13 dígitos no Brasil)
  if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
    return null;
  }

  return {
    rawPhone,
    cleanPhone,
    driverName: shipment.driverName || driver?.name || 'Motorista'
  };
}

/**
 * Extrai URLs limpas de um valor salvo em shipment.documents
 */
function extractDocUrls(val: any): string[] {
  if (!val) return [];
  if (typeof val === 'string') {
    if (val.startsWith('http') || val.startsWith('data:') || val.startsWith('blob:')) {
      return [val];
    }
    return [];
  }
  if (Array.isArray(val)) {
    const urls: string[] = [];
    for (const item of val) {
      if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('data:') || item.startsWith('blob:'))) {
        urls.push(item);
      } else if (item && typeof item === 'object' && item.url) {
        urls.push(String(item.url));
      }
    }
    return urls;
  }
  return [];
}

/**
 * Localiza os arquivos anexados correspondentes a cada gatilho
 */
export function resolveTriggerAttachments(
  trigger: ShipmentWhatsAppTriggerType, 
  context: ShipmentAutomationContext
): TriggerAttachment[] {
  const { shipment, newUploadedDocuments } = context;
  const docs = { ...(shipment.documents || {}), ...(newUploadedDocuments || {}) };
  const attachments: TriggerAttachment[] = [];

  const findUrlsByKeys = (possibleKeys: string[]): string[] => {
    const urls: string[] = [];
    for (const key of Object.keys(docs)) {
      const lowerKey = key.toLowerCase().trim();
      const match = possibleKeys.some(pk => lowerKey.includes(pk.toLowerCase().trim()));
      if (match) {
        urls.push(...extractDocUrls(docs[key]));
      }
    }
    return Array.from(new Set(urls));
  };

  if (trigger === 'fiscal_emitted') {
    // 1. CT-e
    const cteUrls = findUrlsByKeys(['ct-e', 'cte', 'dacte', 'conhecimento']);
    if (cteUrls.length > 0) {
      cteUrls.forEach((url, i) => {
        attachments.push({
          url,
          filename: `CTE_${shipment.cteNumber || shipment.id}${i > 0 ? `_${i + 1}` : ''}.pdf`,
          label: 'CT-e (Conhecimento de Transporte)',
          documentType: 'CT-e'
        });
      });
    }

    // 2. MDF-e
    const mdfeUrls = findUrlsByKeys(['mdf-e', 'mdfe', 'manifesto']);
    if (mdfeUrls.length > 0) {
      mdfeUrls.forEach((url, i) => {
        attachments.push({
          url,
          filename: `MDFE_${shipment.mdfeNumber || shipment.id}${i > 0 ? `_${i + 1}` : ''}.pdf`,
          label: 'MDF-e (Manifesto Eletrônico)',
          documentType: 'MDF-e'
        });
      });
    }

    // 3. NF-e
    const nfeUrls = findUrlsByKeys(['nota fiscal', 'nf-e', 'nfe', 'danfe']);
    if (nfeUrls.length > 0) {
      nfeUrls.forEach((url, i) => {
        attachments.push({
          url,
          filename: `NFE_${shipment.nfeNumber || shipment.id}${i > 0 ? `_${i + 1}` : ''}.pdf`,
          label: 'NF-e (Nota Fiscal Eletrônica)',
          documentType: 'NF-e'
        });
      });
    }

    // 4. Carta Frete / Contrato
    const cartaFreteUrls = findUrlsByKeys(['carta frete', 'cartafrete', 'contrato de transporte', 'contrato']);
    if (cartaFreteUrls.length > 0) {
      cartaFreteUrls.forEach((url, i) => {
        attachments.push({
          url,
          filename: `Carta_Frete_${shipment.id}${i > 0 ? `_${i + 1}` : ''}.pdf`,
          label: 'Carta Frete',
          documentType: 'Carta Frete'
        });
      });
    }

    // 5. Comprovante de Agendamento (se existir)
    const agendamentoUrls = findUrlsByKeys(['agendamento', 'comprovante de agendamento', 'troca de nf-e']);
    if (agendamentoUrls.length > 0) {
      agendamentoUrls.forEach((url, i) => {
        attachments.push({
          url,
          filename: `Comprovante_Agendamento_${shipment.id}${i > 0 ? `_${i + 1}` : ''}.pdf`,
          label: 'Comprovante de Agendamento',
          documentType: 'Comprovante de Agendamento'
        });
      });
    }
  } else if (trigger === 'advance_paid') {
    // Comprovante de Pagamento de Adiantamento
    const advUrls = findUrlsByKeys(['comprovante de adiantamento', 'adiantamento', 'comprovante_adiantamento']);
    if (advUrls.length > 0) {
      advUrls.forEach((url, i) => {
        const isPdf = url.toLowerCase().includes('.pdf');
        attachments.push({
          url,
          filename: `Comprovante_Adiantamento_${shipment.id}${i > 0 ? `_${i + 1}` : ''}.${isPdf ? 'pdf' : 'png'}`,
          label: 'Comprovante de Adiantamento',
          documentType: 'Comprovante de Adiantamento'
        });
      });
    }
  } else if (trigger === 'balance_paid') {
    // Comprovante de Saldo
    const balanceUrls = findUrlsByKeys(['comprovante de pagamento de saldo', 'comprovante de saldo', 'saldo', 'comprovante_saldo']);
    if (balanceUrls.length > 0) {
      balanceUrls.forEach((url, i) => {
        const isPdf = url.toLowerCase().includes('.pdf');
        attachments.push({
          url,
          filename: `Comprovante_Saldo_${shipment.id}${i > 0 ? `_${i + 1}` : ''}.${isPdf ? 'pdf' : 'png'}`,
          label: 'Comprovante de Pagamento de Saldo',
          documentType: 'Comprovante de Pagamento de Saldo'
        });
      });
    }
  }

  return attachments;
}

/**
 * Constrói o dicionário de variáveis e substitui no template
 */
export function buildInterpolatedMessage(
  templateText: string, 
  context: ShipmentAutomationContext,
  hasAgendamentoDoc: boolean
): string {
  const { shipment, cargo, client, driver } = context;

  const nomeMotorista = extractFirstName(shipment.driverName || driver?.name);
  const origem = cargo?.origin || 'Origem';
  const destino = cargo?.destination || 'Destino';
  const nomeEmbarcador = client?.nomeFantasia || client?.razaoSocial || 'DLLOG Transportes';
  const enderecoCarregamento = cargo?.originLocation || client?.address || cargo?.origin || 'Pátio de Carregamento';
  const contatoEmbarcador = client?.phone || cargo?.originLocation || '(35) 9872-1970';
  const dataHorarioCarregamento = formatLoadingWindow(shipment.scheduledDate, shipment.scheduledTime);
  const localDescarga = cargo?.destinationLocation || cargo?.destination || 'Local de Descarga';
  const destinatario = cargo?.destinationLocation 
    ? cargo.destinationLocation.split('-')[0].trim() 
    : (client?.nomeFantasia || 'Destinatário Final');
  const statusAtual = context.targetStatus || shipment.status || 'Em andamento';

  let rendered = templateText;

  // Processa blocos condicionais {{#if agendamento}}...{{/if}}
  const includeAgendamento = hasAgendamentoDoc || (cargo?.requiresScheduling ?? false);
  if (includeAgendamento) {
    rendered = rendered.replace(/\{\{#if agendamento\}\}([\s\S]*?)\{\{\/if\}\}/gi, '$1');
  } else {
    rendered = rendered.replace(/\{\{#if agendamento\}\}([\s\S]*?)\{\{\/if\}\}/gi, '');
  }

  // Mapa de substituição das tags
  const tags: Record<string, string> = {
    nome_motorista: nomeMotorista,
    motorista_nome: nomeMotorista,
    origem: origem,
    destino: destino,
    nome_embarcador: nomeEmbarcador,
    embarcador_nome: nomeEmbarcador,
    endereco_carregamento: enderecoCarregamento,
    local_coleta: enderecoCarregamento,
    contato_embarcador: contatoEmbarcador,
    contato_coleta: contatoEmbarcador,
    data_horario_carregamento: dataHorarioCarregamento,
    data_coleta: dataHorarioCarregamento,
    local_descarga: localDescarga,
    destinatario: destinatario,
    status_atual: statusAtual,
    numero_carga: shipment.id,
    placa_veiculo: shipment.horsePlate || '',
    valor_frete: shipment.driverFreightValue ? shipment.driverFreightValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00',
    valor_adiantamento: shipment.advanceValue ? shipment.advanceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00',
    valor_saldo: shipment.netBalanceValue ? shipment.netBalanceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'
  };

  return rendered.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return tags[key] !== undefined ? tags[key] : match;
  });
}

/**
 * Função principal para disparar automaticamente as mensagens e anexos do WhatsApp
 */
export async function dispatchShipmentWhatsAppTrigger(
  trigger: ShipmentWhatsAppTriggerType, 
  context: ShipmentAutomationContext
): Promise<{
  success: boolean;
  phone?: string;
  message?: string;
  dispatchedItems: number;
  error?: string;
}> {
  try {
    const { shipment, driver, drivers } = context;

    // 1. Busca número válido do motorista
    const resolved = resolveDriverWhatsApp(shipment, driver, drivers);
    if (!resolved) {
      console.warn(`[WhatsApp Automation] Motorista sem telefone válido cadastrado para o embarque ${shipment.id} (${shipment.driverName})`);
      return {
        success: false,
        dispatchedItems: 0,
        error: `Motorista "${shipment.driverName}" sem número de WhatsApp válido cadastrado.`
      };
    }

    const { cleanPhone, driverName } = resolved;
    const triggerDef = SHIPMENT_TRIGGER_TEMPLATES[trigger];
    if (!triggerDef) {
      return { success: false, dispatchedItems: 0, error: `Gatilho "${trigger}" não reconhecido.` };
    }

    // 2. Busca templates customizados do usuário ou usa padrão
    let templateText = triggerDef.bodyText;
    let templateId: string | undefined = undefined;

    try {
      const activeTemplates = await getWhatsAppTemplates();
      const customMatch = activeTemplates.find(t => t.trigger_event === triggerDef.triggerEvent && t.is_active);
      if (customMatch && customMatch.body_text && customMatch.body_text.trim()) {
        templateText = customMatch.body_text;
        templateId = customMatch.id;
      }
    } catch {
      // Usa template padrão do código
    }

    // 3. Resolve anexos pertinentes para esse gatilho
    const attachments = resolveTriggerAttachments(trigger, context);
    const hasAgendamento = attachments.some(a => a.documentType.toLowerCase().includes('agendamento'));

    // 4. Renderiza corpo da mensagem
    const renderedBody = buildInterpolatedMessage(templateText, context, hasAgendamento);

    let dispatchedCount = 0;

    // 5. Envia texto principal
    await enqueueAndDispatchMessage({
      phone: cleanPhone,
      renderedBody: renderedBody,
      templateId: templateId,
      driverId: shipment.driverCpf || shipment.driverName,
      shipmentId: shipment.id,
      mediaType: 'text',
      metadata: {
        trigger,
        triggerEvent: triggerDef.triggerEvent,
        shipmentId: shipment.id,
        driverName: driverName,
        attachmentCount: attachments.length
      }
    });
    dispatchedCount++;

    // 6. Se houver anexos (CT-e, MDF-e, NF-e, Comprovantes de Adiantamento/Saldo), envia individualmente
    if (attachments.length > 0) {
      for (const att of attachments) {
        // Pausa entre envios para preservar ordenação e evitar bloqueio da API
        await new Promise(r => setTimeout(r, 1200));

        try {
          await enqueueAndDispatchMessage({
            phone: cleanPhone,
            renderedBody: `📎 ${att.label} - Embarque #${shipment.id}`,
            driverId: shipment.driverCpf || shipment.driverName,
            shipmentId: shipment.id,
            mediaType: 'document',
            mediaUrl: att.url,
            mediaFilename: att.filename,
            metadata: {
              trigger,
              triggerEvent: triggerDef.triggerEvent,
              documentType: att.documentType,
              shipmentId: shipment.id,
              driverName: driverName
            }
          });
          dispatchedCount++;
        } catch (attErr) {
          console.warn(`[WhatsApp Automation] Falha ao enviar anexo ${att.filename}:`, attErr);
        }
      }
    }

    return {
      success: true,
      phone: cleanPhone,
      dispatchedItems: dispatchedCount,
      message: `WhatsApp enviado com sucesso para ${driverName} (${dispatchedCount} mensagem/anexos).`
    };
  } catch (err: any) {
    console.error(`[WhatsApp Automation] Erro no gatilho ${trigger}:`, err);
    return {
      success: false,
      dispatchedItems: 0,
      error: err?.message || 'Erro inesperado no envio automático do WhatsApp.'
    };
  }
}
