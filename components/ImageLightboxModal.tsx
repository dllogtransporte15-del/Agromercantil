import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, RefreshCw, X, Maximize2, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Visualizador de Documento / Roteiro'
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset transform state when modal opens or image changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen, imageUrl]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((prev) => Math.min(prev + 0.25, 4));
      } else if (e.key === '-') {
        setZoom((prev) => Math.max(prev - 0.25, 0.5));
      } else if (e.key.toLowerCase() === 'r') {
        setRotation((prev) => (prev + 90) % 360);
      } else if (e.key === '0') {
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((prev) => Math.min(prev + 0.25, 4));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black/90 backdrop-blur-md transition-opacity duration-200 select-none animate-fadeIn"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Bar */}
      <div
        className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg text-emerald-400">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">{title}</h3>
            <p className="text-xs text-gray-400">
              Visualização no navegador (Zoom: {Math.round(zoom * 100)}% | Rotação: {rotation}°)
            </p>
          </div>
        </div>

        {/* Floating Action Controls */}
        <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-2xl backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-slate-700 text-gray-200 hover:text-white rounded-xl transition-all active:scale-95"
            title="Aumentar Zoom (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-slate-700 text-gray-200 hover:text-white rounded-xl transition-all active:scale-95"
            title="Diminuir Zoom (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-700 my-auto" />
          <button
            onClick={handleRotate}
            className="p-2 hover:bg-slate-700 text-gray-200 hover:text-white rounded-xl transition-all active:scale-95"
            title="Girar 90° (R)"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 hover:bg-slate-700 text-gray-200 hover:text-white rounded-xl transition-all active:scale-95 text-xs font-semibold flex items-center gap-1"
            title="Resetar Zoom e Rotação (0)"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 100%
          </button>
          <div className="w-[1px] h-4 bg-slate-700 my-auto" />
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all active:scale-95"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        className="flex-1 w-full flex items-center justify-center overflow-hidden p-4 relative"
        onMouseDown={handleMouseDown}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          src={imageUrl}
          alt={title}
          draggable={false}
          className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg shadow-2xl transition-transform duration-100 ease-out"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Footer Info */}
      <div
        className="w-full py-2.5 text-center text-xs text-gray-400 bg-gradient-to-t from-black/80 to-transparent z-10 flex justify-center items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <span>🔍 Role ou use os botões para zoom</span>
        <span>•</span>
        <span>🖱️ Arraste para mover quando com zoom</span>
        <span>•</span>
        <span>⌨️ Tecla <strong>Esc</strong> para sair</span>
      </div>
    </div>
  );
};

/**
 * Componente Reutilizável de Card de Anexo para substituir Strings Base64 brutas
 * por um cartão elegante com thumbnail, ícone de foto e botão de visualização em Lightbox.
 */
interface DocumentAttachmentCardProps {
  attachment: string;
  index?: number;
  label?: string;
}

export const DocumentAttachmentCard: React.FC<DocumentAttachmentCardProps> = ({
  attachment,
  index = 0,
  label = '📸 Roteiro / Imagem da Carga'
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isDataUrl = attachment.startsWith('data:image/') || attachment.startsWith('data:application/pdf');
  const isImageUrl = isDataUrl || /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(attachment);
  const isPdf = attachment.startsWith('data:application/pdf') || /\.pdf($|\?)/i.test(attachment);

  if (isImageUrl) {
    return (
      <>
        <div className="group relative flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-500/50 hover:shadow-md transition-all">
          <div
            className="w-14 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-300 dark:border-slate-600 flex-shrink-0 cursor-pointer relative"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={attachment}
              alt="Thumbnail"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span className="truncate">{label} #{index + 1}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Digitalização do documento / comprovante
            </p>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:underline"
            >
              Ver imagem ampliada <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        <ImageLightboxModal
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          imageUrl={attachment}
          title={`${label} #${index + 1}`}
        />
      </>
    );
  }

  // Fallback para outros tipos de arquivo
  return (
    <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
      <div className="flex items-center gap-2 truncate">
        <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
          {attachment.length > 50 ? `${attachment.substring(0, 45)}...` : attachment}
        </span>
      </div>
      {attachment.startsWith('http') && (
        <a
          href={attachment}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
        >
          Abrir <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};

export default ImageLightboxModal;
