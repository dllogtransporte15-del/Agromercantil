import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, Loader2, Printer } from 'lucide-react';
import { openDocumentInNewTab } from '../utils/documentViewer';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName?: string;
  category?: string;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  category
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | 'other'>('other');

  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    if (isOpen && fileUrl) {
      setIsLoading(true);
      setError(null);

      // Clean display name
      const cleanUrlName = (() => {
        try {
          const urlObj = new URL(fileUrl);
          const nameParam = urlObj.searchParams.get('name');
          if (nameParam) return nameParam;
        } catch (e) {}
        const parts = fileUrl.split('/');
        const lastPart = decodeURIComponent(parts[parts.length - 1].split('?')[0]);
        return lastPart.includes('_') ? lastPart.split('_').slice(2).join('_') : lastPart;
      })();

      const displayName = fileName || cleanUrlName || 'Documento';
      const ext = displayName.split('.').pop()?.toLowerCase() || '';

      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        setFileType('image');
      } else if (ext === 'pdf') {
        setFileType('pdf');
      } else {
        setFileType('other');
      }

      // Fetch file and convert to Blob URL to bypass forced download headers
      fetch(fileUrl)
        .then(res => {
          if (!res.ok) throw new Error('Não foi possível carregar a visualização do arquivo.');
          return res.blob();
        })
        .then(blob => {
          if (!isMounted) return;
          let mimeType = blob.type;
          if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
          else if (['png'].includes(ext)) mimeType = 'image/png';
          else if (['webp'].includes(ext)) mimeType = 'image/webp';
          else if (['gif'].includes(ext)) mimeType = 'image/gif';
          else if (['pdf'].includes(ext)) mimeType = 'application/pdf';

          const inlineBlob = new Blob([blob], { type: mimeType });
          createdUrl = URL.createObjectURL(inlineBlob);
          setBlobUrl(createdUrl);
          setIsLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.warn('Direct fetch failed, falling back to direct URL:', err);
          setBlobUrl(fileUrl);
          setIsLoading(false);
        });
    } else {
      setBlobUrl(null);
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
      if (createdUrl && createdUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, fileUrl, fileName]);

  if (!isOpen || !fileUrl) return null;

  const displayTitle = fileName || (() => {
    try {
      const urlObj = new URL(fileUrl);
      const nameParam = urlObj.searchParams.get('name');
      if (nameParam) return nameParam;
    } catch (e) {}
    const parts = fileUrl.split('/');
    const lastPart = decodeURIComponent(parts[parts.length - 1].split('?')[0]);
    return lastPart.includes('_') ? lastPart.split('_').slice(2).join('_') : lastPart;
  })();

  const handleDownload = () => {
    const targetUrl = blobUrl || fileUrl;
    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = displayTitle;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    openDocumentInNewTab(fileUrl, displayTitle);
  };

  const handlePrint = () => {
    const targetUrl = blobUrl || fileUrl;
    if (!targetUrl) return;

    const printWin = window.open('', '_blank');
    if (printWin) {
      if (fileType === 'image') {
        printWin.document.write(`
          <html>
            <head><title>Imprimir ${displayTitle}</title></head>
            <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh;">
              <img src="${targetUrl}" style="max-width:100%; max-height:100vh;" onload="window.print(); window.close();" />
            </body>
          </html>
        `);
        printWin.document.close();
      } else {
        printWin.document.write(`
          <html>
            <head><title>Imprimir ${displayTitle}</title></head>
            <body style="margin:0; height:100vh;">
              <iframe src="${targetUrl}" style="width:100%; height:100vh; border:none;" onload="this.contentWindow.focus(); this.contentWindow.print();"></iframe>
            </body>
          </html>
        `);
        printWin.document.close();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999] p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[90vh] max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
          <div className="flex items-center gap-3 truncate pr-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
              {fileType === 'image' ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <h3 className="text-base font-bold text-gray-800 dark:text-white truncate" title={displayTitle}>
                {displayTitle}
              </h3>
              {category && (
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Categoria: {category}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              title="Imprimir Arquivo"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={handleOpenNewTab}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1.5"
              title="Abrir em Nova Aba do Navegador"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Aba</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              title="Baixar Arquivo para o Computador"
            >
              <Download className="w-4 h-4" />
              <span>Baixar</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors ml-1"
              title="Fechar Visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 bg-gray-900/95 p-4 overflow-auto flex items-center justify-center relative">
          {isLoading && (
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-sm font-medium">Carregando visualização...</span>
            </div>
          )}

          {!isLoading && error && (
            <div className="text-center p-6 bg-red-900/30 border border-red-700/50 rounded-2xl text-red-200">
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={handleDownload}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition"
              >
                Baixar Arquivo Diretamente
              </button>
            </div>
          )}

          {!isLoading && blobUrl && (
            <>
              {fileType === 'image' ? (
                <div className="max-w-full max-h-full flex items-center justify-center overflow-auto">
                  <img
                    src={blobUrl}
                    alt={displayTitle}
                    className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
              ) : fileType === 'pdf' ? (
                <iframe
                  src={blobUrl}
                  title={displayTitle}
                  className="w-full h-full min-h-[75vh] rounded-xl bg-white shadow-2xl border-0"
                />
              ) : (
                <iframe
                  src={blobUrl}
                  title={displayTitle}
                  className="w-full h-full min-h-[75vh] rounded-xl bg-white shadow-2xl border-0"
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
