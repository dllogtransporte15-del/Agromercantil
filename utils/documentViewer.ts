import { supabase } from '../supabase';

/**
 * Normaliza qualquer formato de URL ou caminho de anexo para uma URL navegável válida.
 * Suporta strings HTTP, data URLs (base64), blob URLs, objetos { url, path } e caminhos do Supabase Storage.
 */
export function normalizeDocumentUrl(rawVal: any): string | null {
  if (!rawVal) return null;

  if (typeof rawVal === 'string') {
    const trimmed = rawVal.trim();
    if (!trimmed) return null;

    const lower = trimmed.toLowerCase();
    // Rejeita explicitamente valores booleanos ou marcadores de texto da planilha que não são URLs ou arquivos
    if (
      lower === 'sim' || lower === 'não' || lower === 'nao' || 
      lower === 's' || lower === 'n' || lower === '-' || lower === '--' ||
      lower === 'true' || lower === 'false' || lower === 'null' || lower === 'undefined' ||
      lower === 'pendente' || lower === 'pago' || lower === 'ok' || lower === 'sem anexo' ||
      lower === 'sem documento'
    ) {
      return null;
    }

    if (
      trimmed.startsWith('http://') || 
      trimmed.startsWith('https://') || 
      trimmed.startsWith('data:') || 
      trimmed.startsWith('blob:')
    ) {
      return trimmed;
    }

    // Se for caminho relativo de bucket do Supabase (ex: "SHP-1234/Comprovante_de_Descarga_...jpg")
    if (trimmed.includes('/') && !trimmed.startsWith('C:') && !trimmed.startsWith('/')) {
      try {
        const { data } = supabase.storage.from('shipment_attachments').getPublicUrl(trimmed);
        if (data?.publicUrl) return data.publicUrl;
      } catch (e) {
        // fallback
      }
    }

    // Se tiver extensão típica de arquivo ou foto
    const fileExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.heic', '.gif', '.bmp', '.xml', '.txt', '.csv', '.xlsx'];
    if (fileExts.some(ext => lower.endsWith(ext) || lower.includes(ext + '?'))) {
      try {
        const { data } = supabase.storage.from('shipment_attachments').getPublicUrl(trimmed);
        if (data?.publicUrl) return data.publicUrl;
      } catch (e) {}
      return trimmed;
    }

    return null;
  }

  if (typeof rawVal === 'object') {
    if (typeof rawVal.url === 'string') return normalizeDocumentUrl(rawVal.url);
    if (typeof rawVal.path === 'string') return normalizeDocumentUrl(rawVal.path);
    if (typeof rawVal.fileUrl === 'string') return normalizeDocumentUrl(rawVal.fileUrl);
    if (typeof rawVal.publicUrl === 'string') return normalizeDocumentUrl(rawVal.publicUrl);
    if (Array.isArray(rawVal) && rawVal.length > 0) {
      for (const item of rawVal) {
        const u = normalizeDocumentUrl(item);
        if (u) return u;
      }
    }
  }

  return null;
}

export const DOCUMENT_METADATA_KEYS_SET = new Set([
  'pix_key', 'chave_pix', 'cte_number', 'payment_method', 'risk_query_cost', 
  'risk_query_type', 'cte_emission_date', 'risk_release_code', 
  'advance_percentage', 'toll_value', 'advance_value', 'balance_value', 
  'balance_to_receive_value', 'discount_value', 'net_balance_value', 
  'unloaded_tonnage', 'loaded_tonnage', 'codg_atua', 'codigo_atua', 'codigoatua',
  'nfe_number', 'nfe_numbers', 'owner_name', 'owner_contact', 'ciot_number',
  'mdfe_number', 'antt_modality', 'etc_tax_regime', 'driver_freight_type',
  'cte_tomador', 'cte_tomador_cnpj', 'tomador_nome', 'tomador_cnpj',
  'ordem_carregamento_numero', 'oc_number', 'chave_nfe', 'chave_cte', 'chave_mdfe',
  'valor_pedagio', 'valor_adiantamento', 'valor_saldo'
]);

/**
 * Retorna verdadeiro se a chave de shipment.documents for apenas um campo de metadado (e não um tipo de anexo)
 */
export function isDocumentMetadataKey(key: string): boolean {
  if (!key) return true;
  const clean = key.toLowerCase().trim();
  if (clean.startsWith('_') || clean.startsWith('val_') || clean.startsWith('num_') || clean.startsWith('cod_')) return true;
  return DOCUMENT_METADATA_KEYS_SET.has(clean);
}

/**
 * Retorna verdadeiro se o valor informado for uma URL ou arquivo navegável real
 */
export function isActualDocumentUrl(val: any): boolean {
  if (!val) return false;
  return normalizeDocumentUrl(val) !== null;
}

/**
 * Identifica se a fonte ou arquivo é uma imagem (foto de ticket, comprovante, recibo)
 */
export function isImageSource(urlOrFile: string | File, fileName?: string): boolean {
  if (!urlOrFile) return false;

  if (typeof urlOrFile !== 'string') {
    return urlOrFile.type.startsWith('image/');
  }

  const lowerUrl = urlOrFile.toLowerCase();
  if (lowerUrl.startsWith('data:image/')) return true;

  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.heic', '.tif', '.tiff'];
  const cleanUrl = lowerUrl.split('?')[0].split('#')[0];

  // Se a URL contém explicitamente extensão de imagem
  if (imageExts.some(ext => cleanUrl.endsWith(ext) || lowerUrl.includes(ext + '?') || lowerUrl.includes(ext + '&'))) {
    return true;
  }

  // Se for explicitamente PDF
  if (cleanUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?') || lowerUrl.includes('.pdf&')) {
    return false;
  }

  // Se o nome do arquivo foi fornecido
  if (fileName) {
    const lowerName = fileName.toLowerCase();
    if (imageExts.some(ext => lowerName.endsWith(ext))) return true;
    if (lowerName.endsWith('.pdf')) return false;
  }

  // Se não tem extensão definida e contém termos de foto/ticket/descarga ou não é pdf, trata preferencialmente como imagem
  return true;
}

/**
 * Abre comprovantes, fotos de tickets de descarga e PDFs em nova aba para visualização imediata.
 * - Para FOTOS / IMAGENS: carrega via tag <img> instantaneamente, sem bloqueio de CORS ou download forçado.
 *   Inclui ferramentas interativas de GIRAR 90° (fotos tiradas de lado por motoristas), ZOOM e IMPRESSÃO.
 * - Para PDFs: exibe visualizador de alta resolução sem disparar download involuntário.
 */
export async function openDocumentInNewTab(urlOrFile?: string | File | null, rawFileName?: string) {
  if (!urlOrFile) return;

  const isFile = typeof urlOrFile !== 'string' && typeof File !== 'undefined' && urlOrFile instanceof File;
  const url = isFile ? URL.createObjectURL(urlOrFile) : (normalizeDocumentUrl(urlOrFile) || (typeof urlOrFile === 'string' ? urlOrFile : ''));
  if (!url || typeof url !== 'string') return;
  const originalFileName = isFile ? urlOrFile.name : (rawFileName || (urlOrFile && typeof urlOrFile === 'object' && ((urlOrFile as any).name || (urlOrFile as any).fileName)));

  // Extrai nome limpo do documento
  const cleanName = (() => {
    if (originalFileName) return originalFileName;
    try {
      const urlObj = new URL(url);
      const nameParam = urlObj.searchParams.get('name');
      if (nameParam) return decodeURIComponent(nameParam);
    } catch (e) {}
    const parts = url.split('/');
    const lastPart = decodeURIComponent(parts[parts.length - 1].split('?')[0]);
    return lastPart.includes('_') ? lastPart.split('_').slice(2).join('_') : lastPart;
  })();

  const isImg = isImageSource(url, originalFileName);
  const displayName = cleanName || (isImg ? 'Foto do Ticket de Descarga' : 'Documento');

  // Abre a janela imediatamente para evitar bloqueador de pop-ups
  const newWin = window.open('', '_blank');
  if (!newWin) {
    // Se o popup for bloqueado, tenta navegar diretamente
    window.location.href = url;
    return;
  }

  newWin.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${displayName} - DLLOG Transportes</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: #12100F;
          color: #FAF8F6;
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          user-select: none;
        }
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 20px;
          background-color: #1C1A18;
          border-bottom: 1px solid #292624;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 20;
          flex-shrink: 0;
          gap: 12px;
          flex-wrap: wrap;
        }
        .doc-info {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
          min-width: 0;
        }
        .doc-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          background: ${isImg ? '#059669' : '#C08957'};
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }
        .doc-title {
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 380px;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .btn-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 13px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          color: #ffffff;
          background-color: #292624;
        }
        .btn-action:hover {
          background-color: #3F3B39;
          transform: translateY(-1px);
        }
        .btn-rotate {
          background-color: #A67142;
        }
        .btn-rotate:hover {
          background-color: #A67142;
        }
        .btn-print {
          background-color: #A67142;
        }
        .btn-print:hover {
          background-color: #8B5B32;
        }
        .btn-download {
          background-color: #16a34a;
        }
        .btn-download:hover {
          background-color: #15803d;
        }
        .viewer-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #020617;
          padding: 16px;
          overflow: auto;
          position: relative;
        }
        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #9E9791;
          font-size: 14px;
          position: absolute;
          z-index: 10;
        }
        .spinner {
          width: 38px;
          height: 38px;
          border: 3px solid #292624;
          border-top-color: #C08957;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .img-viewport {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 100%;
          min-height: 100%;
        }
        img.doc-image {
          max-width: 92vw;
          max-height: 84vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 20px 35px -5px rgba(0,0,0,0.7);
          transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
          cursor: grab;
        }
        iframe.doc-iframe {
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 8px;
          background-color: #ffffff;
          box-shadow: 0 20px 35px -5px rgba(0,0,0,0.6);
        }
        .error-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
          max-width: 420px;
          padding: 24px;
          background: #292624;
          border-radius: 12px;
          border: 1px solid #3F3B39;
        }
        
        @media print {
          .toolbar { display: none !important; }
          body { background-color: #ffffff !important; color: #000000 !important; }
          .viewer-container { padding: 0 !important; background-color: #ffffff !important; overflow: visible !important; }
          img.doc-image { max-width: 100% !important; max-height: 100vh !important; box-shadow: none !important; border-radius: 0 !important; }
          iframe.doc-iframe { width: 100% !important; height: 100vh !important; box-shadow: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <div class="doc-info">
          <span class="doc-badge">
            ${isImg ? '📷 Foto de Ticket' : '📄 PDF'}
          </span>
          <div class="doc-title">${displayName}</div>
        </div>

        <div class="actions">
          ${isImg ? `
            <button id="rotate-btn" class="btn-action btn-rotate" title="Girar Foto 90° no sentido horário">
              🔄 Girar 90°
            </button>
            <button id="zoom-in-btn" class="btn-action" title="Aumentar zoom">
              🔍 Zoom +
            </button>
            <button id="zoom-out-btn" class="btn-action" title="Diminuir zoom">
              🔍 Zoom -
            </button>
            <button id="zoom-reset-btn" class="btn-action" title="Tamanho original">
              ↺ 100%
            </button>
          ` : ''}

          <button id="print-btn" class="btn-action btn-print" title="Imprimir documento">
            🖨️ Imprimir
          </button>
          <a id="download-btn" href="${url}" download="${displayName}" class="btn-action btn-download" title="Baixar arquivo">
            📥 Baixar
          </a>
        </div>
      </div>

      <div class="viewer-container" id="viewer">
        <div class="loading" id="loader">
          <div class="spinner"></div>
          <span>Carregando visualização...</span>
        </div>

        ${isImg ? `
          <div class="img-viewport" id="img-wrapper">
            <img 
              id="main-image" 
              src="${url}" 
              alt="${displayName}" 
              class="doc-image" 
              style="display: none;"
            />
          </div>
        ` : `
          <iframe 
            id="main-iframe" 
            class="doc-iframe" 
            style="display: none;"
          ></iframe>
        `}
      </div>

      <script>
        const loader = document.getElementById('loader');
        const img = document.getElementById('main-image');
        const iframe = document.getElementById('main-iframe');
        const viewer = document.getElementById('viewer');

        let rotation = 0;
        let zoom = 1;

        function applyTransform() {
          if (img) {
            img.style.transform = 'rotate(' + rotation + 'deg) scale(' + zoom + ')';
          }
        }

        if (img) {
          img.onload = function() {
            if (loader) loader.style.display = 'none';
            img.style.display = 'block';
          };
          img.onerror = function() {
            console.warn('Erro ao carregar imagem direta, testando como iframe...');
            if (loader) loader.style.display = 'none';
            if (img) img.style.display = 'none';
            
            const fallbackIframe = document.createElement('iframe');
            fallbackIframe.className = 'doc-iframe';
            fallbackIframe.src = '${url}';
            viewer.appendChild(fallbackIframe);
          };
          // Se já carregou pelo cache
          if (img.complete && img.naturalWidth > 0) {
            if (loader) loader.style.display = 'none';
            img.style.display = 'block';
          }
        }

        if (iframe) {
          iframe.onload = function() {
            if (loader) loader.style.display = 'none';
            iframe.style.display = 'block';
          };
        }

        // Girar 90 graus
        document.getElementById('rotate-btn')?.addEventListener('click', function() {
          rotation = (rotation + 90) % 360;
          applyTransform();
        });

        // Zoom +
        document.getElementById('zoom-in-btn')?.addEventListener('click', function() {
          zoom = Math.min(3.5, zoom + 0.25);
          applyTransform();
        });

        // Zoom -
        document.getElementById('zoom-out-btn')?.addEventListener('click', function() {
          zoom = Math.max(0.5, zoom - 0.25);
          applyTransform();
        });

        // Resetar Zoom
        document.getElementById('zoom-reset-btn')?.addEventListener('click', function() {
          zoom = 1;
          rotation = 0;
          applyTransform();
        });

        // Imprimir
        document.getElementById('print-btn')?.addEventListener('click', function() {
          window.print();
        });
      </script>
    </body>
    </html>
  `);

  newWin.document.close();

  // Para PDFs, tenta carregar como Blob URL para evitar cabeçalho de download involuntário
  if (!isImg) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const inlineBlob = new Blob([blob], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(inlineBlob);

        if (newWin && !newWin.closed) {
          const iframeEl = newWin.document.getElementById('main-iframe') as HTMLIFrameElement;
          const downloadBtn = newWin.document.getElementById('download-btn') as HTMLAnchorElement;
          const loader = newWin.document.getElementById('loader');

          if (downloadBtn) downloadBtn.href = blobUrl;
          if (iframeEl) {
            iframeEl.src = blobUrl;
            iframeEl.style.display = 'block';
          }
          if (loader) loader.style.display = 'none';
        }
        return;
      }
    } catch (e) {
      console.warn('Fetch blob PDF falhou, usando URL direta:', e);
    }

    // Fallback: atribui a URL direta no iframe
    if (newWin && !newWin.closed) {
      const iframeEl = newWin.document.getElementById('main-iframe') as HTMLIFrameElement;
      if (iframeEl) {
        iframeEl.src = url;
        iframeEl.style.display = 'block';
      }
      const loader = newWin.document.getElementById('loader');
      if (loader) loader.style.display = 'none';
    }
  }
}

/**
 * Retorna a URL do arquivo/PDF do CT-e anexado ao embarque, se disponível.
 */
export function getShipmentCteFileUrl(shipment?: { documents?: any; cteUrl?: string } | null): string | null {
  if (!shipment) return null;
  if (shipment.documents?.active_cte_url) {
    const activeU = normalizeDocumentUrl(shipment.documents.active_cte_url);
    if (activeU) return activeU;
  }
  if (shipment.cteUrl && typeof shipment.cteUrl === 'string' && shipment.cteUrl.trim()) {
    return normalizeDocumentUrl(shipment.cteUrl.trim());
  }
  const docs = shipment.documents;
  if (!docs || typeof docs !== 'object') return null;

  const cancelledUrls = Array.isArray(docs.cancelled_ctes)
    ? docs.cancelled_ctes.map((c: any) => c.fileUrl).filter(Boolean)
    : [];

  const keysToCheck = [
    'CT-e',
    'CT-E',
    'cte',
    'Cte',
    'Documentos de Viagem (CT-e, MDF-e, Contrato)',
    'Documentos de Viagem',
    'cte_url',
    'cte_pdf',
    'ctePdf',
    'DACTE',
    'dacte'
  ];

  for (const k of keysToCheck) {
    const val = docs[k];
    if (Array.isArray(val) && val.length > 0) {
      for (const item of val) {
        const u = normalizeDocumentUrl(item);
        if (u) return u;
      }
    } else {
      const u = normalizeDocumentUrl(val);
      if (u) return u;
    }
  }

  for (const [k, val] of Object.entries(docs)) {
    const kl = k.toLowerCase();
    if (kl.includes('cte') || kl.includes('ct-e') || kl.includes('dacte')) {
      if (Array.isArray(val) && val.length > 0) {
        for (const item of val) {
          const u = normalizeDocumentUrl(item);
          if (u) return u;
        }
      } else {
        const u = normalizeDocumentUrl(val);
        if (u) return u;
      }
    }
  }

  return null;
}

/**
 * Retorna a URL do documento/ticket/comprovante de descarga anexado ao embarque, se disponível.
 * Suporta fotos (JPEG/PNG/WEBP/HEIC), PDFs, arrays de URLs, caminhos de storage e campos diretos.
 * Prioriza com máxima exatidão o "Comprovante de Descarga" anexado na etapa de Descarga,
 * evitando absolutamente documentos de carregamento, adiantamento ou saldo.
 */
export function getShipmentDischargeTicketUrl(shipment?: { documents?: any; [key: string]: any } | null): string | null {
  if (!shipment) return null;

  // Função auxiliar para verificar se a chave pertence a outras etapas e deve ser ignorada
  const isForbiddenKey = (k: string) => {
    const kl = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return (
      kl.includes('carregamento') ||
      kl.includes('carreg') ||
      kl.includes('adiantamento') ||
      kl.includes('adiant') ||
      kl.includes('saldo') ||
      kl.includes('quitacao') ||
      kl.includes('pix') ||
      kl.includes('bancario') ||
      kl.includes('cte') ||
      kl.includes('ct-e') ||
      kl.includes('dacte') ||
      kl.includes('nfe') ||
      kl.includes('nf-e') ||
      kl.includes('danfe') ||
      kl.includes('mdfe') ||
      kl.includes('mdf-e') ||
      kl.includes('ordem') ||
      kl.includes('tms') ||
      kl.includes('seguradora') ||
      kl.includes('gerenciadora') ||
      kl.includes('consulta') ||
      kl.includes('cnh') ||
      kl.includes('contrato')
    );
  };

  // Helper para extrair URL válida de um valor (seja string, array ou objeto)
  const extractUrlFromVal = (val: any): string | null => {
    if (!val) return null;
    if (Array.isArray(val)) {
      if (val.length === 0) return null;
      // Se houver múltiplos arquivos, prioriza aquele cujo nome ou URL contenha 'descarga'
      for (const item of val) {
        const str = typeof item === 'string' ? item : (item?.url || item?.path || '');
        if (typeof str === 'string' && str.toLowerCase().includes('descarga')) {
          const u = normalizeDocumentUrl(item);
          if (u) return u;
        }
      }
      // Caso contrário, busca do mais recente (último) para o primeiro
      for (let i = val.length - 1; i >= 0; i--) {
        const u = normalizeDocumentUrl(val[i]);
        if (u) return u;
      }
      return null;
    }
    return normalizeDocumentUrl(val);
  };

  const docs = shipment.documents;
  const hasDocs = docs && typeof docs === 'object';

  // 1. PRIORIDADE MÁXIMA: "Comprovante de Descarga" (exato e variações de escrita)
  if (hasDocs) {
    const comprovanteDescargaExactKeys = [
      'Comprovante de Descarga',
      'comprovante de descarga',
      'Comprovante de descarga',
      'comprovante_descarga',
      'comprovantedescarga',
      'comprovante_de_descarga'
    ];
    for (const k of comprovanteDescargaExactKeys) {
      if (docs[k] !== undefined && docs[k] !== null) {
        const u = extractUrlFromVal(docs[k]);
        if (u) return u;
      }
    }

    // Busca por qualquer chave em docs que contenha 'descarga' e ('comprovante' ou 'recibo' ou 'foto' ou 'ticket')
    for (const [k, val] of Object.entries(docs)) {
      if (isForbiddenKey(k)) continue;
      const kl = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (kl.includes('descarga') && (kl.includes('comprovante') || kl.includes('recibo') || kl.includes('foto') || kl.includes('ticket'))) {
        const u = extractUrlFromVal(val);
        if (u) return u;
      }
    }
  }

  // 2. Propriedades diretas no objeto do embarque
  const directFields = [
    (shipment as any).ticketDescargaUrl,
    (shipment as any).comprovanteDescargaUrl,
    (shipment as any).dischargeTicketUrl,
    (shipment as any).dischargeUrl,
    (shipment as any).unloadedTonnageTicketUrl,
  ];
  for (const f of directFields) {
    const u = extractUrlFromVal(f);
    if (u) return u;
  }

  // 3. Etapa de Validação de Ticket e Ticket de Balança
  if (hasDocs) {
    const ticketBalancaKeys = [
      'Validação de Ticket e Peso',
      'Validacao de Ticket e Peso',
      'Valid. de Ticket',
      'Validação de Ticket',
      'Ticket de Descarga',
      'ticket de descarga',
      'Ticket de Balança',
      'Ticket de Balanca',
      'ticket de balança',
      'ticket de balanca',
      'ticket_descarga',
      'ticket_balanca',
      'foto_ticket_descarga',
      'foto_descarga'
    ];
    for (const k of ticketBalancaKeys) {
      if (docs[k] !== undefined && docs[k] !== null) {
        const u = extractUrlFromVal(docs[k]);
        if (u) return u;
      }
    }

    // 4. Varredura ampla em docs: se algum anexo tiver a palavra 'descarga' no nome do arquivo ou URL
    for (const [k, val] of Object.entries(docs)) {
      if (isForbiddenKey(k)) continue;
      const u = extractUrlFromVal(val);
      if (u && u.toLowerCase().includes('descarga')) {
        return u;
      }
    }

    // 5. Fallback final controlado em docs para 'descarga' ou 'balança'
    for (const [k, val] of Object.entries(docs)) {
      if (isForbiddenKey(k)) continue;
      const kl = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (kl.includes('descarga') || kl.includes('balanca')) {
        const u = extractUrlFromVal(val);
        if (u) return u;
      }
    }
  }

  return null;
}

/**
 * Retorna a URL do PDF da Ordem de Carregamento TMS (OC TMS), se disponível.
 */
export function getShipmentTmsOrderUrl(shipment?: { documents?: any; tmsOrderUrl?: string; orderUrl?: string } | null): string | null {
  if (!shipment) return null;
  if (shipment.tmsOrderUrl && typeof shipment.tmsOrderUrl === 'string' && shipment.tmsOrderUrl.trim()) {
    return normalizeDocumentUrl(shipment.tmsOrderUrl.trim());
  }
  if (shipment.orderUrl && typeof shipment.orderUrl === 'string' && shipment.orderUrl.trim()) {
    return normalizeDocumentUrl(shipment.orderUrl.trim());
  }
  const docs = shipment.documents;
  if (!docs || typeof docs !== 'object') return null;

  const possibleKeys = [
    'Ordem de Carregamento TMS',
    'Ordem de Carregamento',
    'Ordem de Carregamento (TMS)',
    'Ordem Carregamento',
    'Ordem TMS',
    'ordem_carregamento_tms',
    'ordem_carregamento',
    'OC TMS',
    'OC',
    'oc_tms',
    'oc_tms_url',
    'oc'
  ];

  for (const k of possibleKeys) {
    const val = docs[k];
    if (Array.isArray(val) && val.length > 0) {
      for (const item of val) {
        const u = normalizeDocumentUrl(item);
        if (u) return u;
      }
    } else {
      const u = normalizeDocumentUrl(val);
      if (u) return u;
    }
  }

  for (const [k, val] of Object.entries(docs)) {
    const kLower = k.toLowerCase();
    if (kLower.includes('ordem') && (kLower.includes('carregamento') || kLower.includes('tms') || kLower.includes('oc'))) {
      if (Array.isArray(val) && val.length > 0) {
        for (const item of val) {
          const u = normalizeDocumentUrl(item);
          if (u) return u;
        }
      } else {
        const u = normalizeDocumentUrl(val);
        if (u) return u;
      }
    }
  }

  return null;
}

/**
 * Retorna a URL do arquivo de Comprovante de Adiantamento anexado ao embarque, se disponível.
 */
export function getShipmentAdvanceProofUrl(shipment?: { documents?: any; [key: string]: any } | null): string | null {
  if (!shipment) return null;

  // 1. Campos diretos no objeto do embarque
  const directFields = [
    (shipment as any).advanceProofUrl,
    (shipment as any).comprovanteAdiantamentoUrl,
    (shipment as any).advanceUrl,
    (shipment as any).comprovante_adiantamento_url,
  ];
  for (const f of directFields) {
    if (typeof f === 'string' && f.trim()) {
      const u = normalizeDocumentUrl(f.trim());
      if (u) return u;
    }
  }

  const docs = shipment.documents;
  if (!docs || typeof docs !== 'object') return null;

  // 2. Chaves exatas do sistema para Comprovante de Adiantamento
  const exactKeys = [
    'Comprovante de Adiantamento',
    'comprovante de adiantamento',
    'Comprovante de adiantamento',
    'comprovante_adiantamento',
    'comprovante_de_adiantamento',
    'comprovanteAdiantamento',
    'adiantamento',
    'Adiantamento',
  ];

  for (const k of exactKeys) {
    const val = docs[k];
    if (Array.isArray(val) && val.length > 0) {
      for (let i = val.length - 1; i >= 0; i--) {
        const u = normalizeDocumentUrl(val[i]);
        if (u) return u;
      }
    } else if (val) {
      const u = normalizeDocumentUrl(val);
      if (u) return u;
    }
  }

  // 3. Varredura ampla em docs: qualquer anexo cujo nome da chave ou URL contenha 'adiant'
  for (const [k, val] of Object.entries(docs)) {
    const kl = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (kl.includes('adiant')) {
      if (Array.isArray(val) && val.length > 0) {
        for (let i = val.length - 1; i >= 0; i--) {
          const u = normalizeDocumentUrl(val[i]);
          if (u) return u;
        }
      } else if (val) {
        const u = normalizeDocumentUrl(val);
        if (u) return u;
      }
    }
  }

  return null;
}

/**
 * Retorna a URL do arquivo de Comprovante de Pagamento de Saldo anexado ao embarque, se disponível.
 */
export function getShipmentBalanceProofUrl(shipment?: { documents?: any; [key: string]: any } | null): string | null {
  if (!shipment) return null;

  // 1. Campos diretos no objeto do embarque
  const directFields = [
    (shipment as any).balanceProofUrl,
    (shipment as any).comprovanteSaldoUrl,
    (shipment as any).comprovantePagamentoSaldoUrl,
    (shipment as any).balanceUrl,
    (shipment as any).comprovante_saldo_url,
  ];
  for (const f of directFields) {
    if (typeof f === 'string' && f.trim()) {
      const u = normalizeDocumentUrl(f.trim());
      if (u) return u;
    }
  }

  const docs = shipment.documents;
  if (!docs || typeof docs !== 'object') return null;

  // 2. Chaves exatas do sistema para Comprovante de Saldo
  const exactKeys = [
    'Comprovante de Pagamento de Saldo',
    'comprovante de pagamento de saldo',
    'Comprovante de Pagamento de saldo',
    'Comprovante de Saldo',
    'comprovante de saldo',
    'comprovante_saldo',
    'comprovante_pagamento_saldo',
    'comprovante_de_saldo',
    'comprovanteSaldo',
    'saldo',
    'Saldo',
    'quitacao',
    'Quitacao',
    'recibo_saldo',
  ];

  for (const k of exactKeys) {
    const val = docs[k];
    if (Array.isArray(val) && val.length > 0) {
      for (let i = val.length - 1; i >= 0; i--) {
        const u = normalizeDocumentUrl(val[i]);
        if (u) return u;
      }
    } else if (val) {
      const u = normalizeDocumentUrl(val);
      if (u) return u;
    }
  }

  // 3. Varredura ampla em docs: qualquer anexo cujo nome da chave ou URL contenha 'saldo' ou 'quitacao'
  for (const [k, val] of Object.entries(docs)) {
    const kl = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (kl.includes('saldo') || kl.includes('quitacao')) {
      if (Array.isArray(val) && val.length > 0) {
        for (let i = val.length - 1; i >= 0; i--) {
          const u = normalizeDocumentUrl(val[i]);
          if (u) return u;
        }
      } else if (val) {
        const u = normalizeDocumentUrl(val);
        if (u) return u;
      }
    }
  }

  return null;
}

