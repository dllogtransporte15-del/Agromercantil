/**
 * Utility to open attached files in a new browser tab/window for preview.
 * Converts the remote URL to an inline Blob URL so the browser does NOT 
 * automatically trigger a download, allowing the user to view the file 
 * first and decide whether to download or print it.
 */
export async function openDocumentInNewTab(urlOrFile: string | File, rawFileName?: string) {
  if (!urlOrFile) return;

  const isFile = typeof urlOrFile !== 'string';
  const url = isFile ? URL.createObjectURL(urlOrFile) : urlOrFile;
  const originalFileName = isFile ? urlOrFile.name : rawFileName;

  // Clean filename display
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

  const displayName = cleanName || 'Documento';
  const ext = displayName.split('.').pop()?.split('?')[0]?.toLowerCase() || '';

  // Open the window immediately so popup blockers don't block it
  const newWin = window.open('', '_blank');
  if (newWin) {
    newWin.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${displayName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
          .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background-color: #1e293b; border-bottom: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 10; flex-shrink: 0; }
          .doc-info { display: flex; align-items: center; gap: 12px; overflow: hidden; }
          .doc-icon { color: #38bdf8; display: flex; align-items: center; }
          .doc-title { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 450px; }
          .actions { display: flex; align-items: center; gap: 12px; }
          .btn-print { display: inline-flex; align-items: center; gap: 8px; background-color: #2563eb; color: #ffffff; padding: 8px 18px; font-size: 13px; font-weight: 600; border-radius: 8px; border: none; cursor: pointer; transition: background-color 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
          .btn-print:hover { background-color: #1d4ed8; }
          .btn-download { display: inline-flex; align-items: center; gap: 8px; background-color: #16a34a; color: #ffffff; padding: 8px 18px; font-size: 13px; font-weight: 600; border-radius: 8px; text-decoration: none; border: none; cursor: pointer; transition: background-color 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
          .btn-download:hover { background-color: #15803d; }
          .viewer-container { flex: 1; display: flex; align-items: center; justify-content: center; background-color: #020617; padding: 16px; overflow: auto; position: relative; }
          .loading { display: flex; flex-direction: column; align-items: center; gap: 12px; color: #94a3b8; font-size: 14px; }
          .spinner { width: 32px; height: 32px; border: 3px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
          img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          iframe { width: 100%; height: 100%; border: none; border-radius: 8px; background-color: #ffffff; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          
          @media print {
            .toolbar { display: none !important; }
            body { background-color: #ffffff !important; color: #000000 !important; }
            .viewer-container { padding: 0 !important; background-color: #ffffff !important; }
            img { max-width: 100% !important; max-height: 100% !important; box-shadow: none !important; }
            iframe { width: 100% !important; height: 100vh !important; box-shadow: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <div class="doc-info">
            <span class="doc-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            <div class="doc-title">${displayName}</div>
          </div>
          <div class="actions">
            <button id="print-btn" class="btn-print" style="display: none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir
            </button>
            <a id="download-btn" href="#" download="${displayName}" class="btn-download" style="display: none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Baixar Arquivo
            </a>
          </div>
        </div>
        <div class="viewer-container" id="viewer">
          <div class="loading" id="loader">
            <div class="spinner"></div>
            <span>Carregando documento...</span>
          </div>
        </div>
      </body>
      </html>
    `);
    newWin.document.close();
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Falha no carregamento');
    const blob = await response.blob();

    let mimeType = blob.type;
    if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
    else if (['png'].includes(ext)) mimeType = 'image/png';
    else if (['webp'].includes(ext)) mimeType = 'image/webp';
    else if (['gif'].includes(ext)) mimeType = 'image/gif';
    else if (['pdf'].includes(ext)) mimeType = 'application/pdf';

    const inlineBlob = new Blob([blob], { type: mimeType });
    const blobUrl = URL.createObjectURL(inlineBlob);

    if (newWin && !newWin.closed) {
      const loader = newWin.document.getElementById('loader');
      const viewer = newWin.document.getElementById('viewer');
      const printBtn = newWin.document.getElementById('print-btn') as HTMLButtonElement;
      const downloadBtn = newWin.document.getElementById('download-btn') as HTMLAnchorElement;

      if (loader) loader.style.display = 'none';
      if (downloadBtn) {
        downloadBtn.href = blobUrl;
        downloadBtn.style.display = 'inline-flex';
      }
      if (printBtn) {
        printBtn.style.display = 'inline-flex';
        printBtn.onclick = () => {
          if (mimeType.startsWith('image/')) {
            newWin.print();
          } else {
            const iframe = newWin.document.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
              try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
              } catch (e) {
                newWin.print();
              }
            } else {
              newWin.print();
            }
          }
        };
      }

      if (viewer) {
        if (mimeType.startsWith('image/')) {
          const img = newWin.document.createElement('img');
          img.src = blobUrl;
          img.alt = displayName;
          viewer.appendChild(img);
        } else {
          const iframe = newWin.document.createElement('iframe');
          iframe.src = blobUrl;
          viewer.appendChild(iframe);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to fetch blob, redirecting directly to URL:', error);
    if (newWin && !newWin.closed) {
      newWin.location.href = url;
    }
  }
}
