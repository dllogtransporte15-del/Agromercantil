
import React, { useRef, useState } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { XIcon } from './icons/XIcon';
import { compressImage } from '../utils/imageCompressor';

interface ImageUploaderProps {
  title: string;
  description: string;
  currentImage: string | null;
  onSave: (base64: string) => void;
  onRemove?: () => void;
  maxSizeMB?: number;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ title, description, currentImage, onSave, onRemove, maxSizeMB = 10 }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp'].includes(file.type)) {
      setError(`Tipo de arquivo inválido. Use JPG, PNG, WEBP, GIF ou SVG.`);
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`O arquivo é muito grande. O limite é ${maxSizeMB}MB.`);
      return;
    }
    setError('');
    setIsProcessing(true);

    try {
      const isLogo = title.toLowerCase().includes('logo');
      const compressed = await compressImage(
        file,
        isLogo ? 600 : 1920,
        isLogo ? 600 : 1080,
        0.82
      );
      onSave(compressed);
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      setError('Falha ao otimizar a imagem. Tente outro arquivo.');
    } finally {
      setIsProcessing(false);
      event.target.value = ''; // Reset file input
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">{title}</h3>
      <div className="flex items-center gap-6">
        <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center overflow-hidden border dark:border-gray-200 dark:dark:border-gray-600 relative group">
          {currentImage ? (
            <img src={currentImage} alt="Preview" className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="text-center text-gray-400 p-2">
              <UploadIcon className="w-10 h-10 mx-auto" />
              <span className="text-xs mt-1 block">Sem Imagem</span>
            </div>
          )}
          {currentImage && onRemove && !isProcessing && (
            <button
              onClick={onRemove}
              className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remover imagem"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-medium">
              Otimizando...
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {description}
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/gif, image/svg+xml, image/webp"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleButtonClick}
              disabled={isProcessing}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Processando...' : currentImage ? 'Alterar Imagem' : 'Carregar Imagem'}
            </button>
            {currentImage && onRemove && (
              <button
                onClick={onRemove}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Remover Imagem
              </button>
            )}
          </div>
          {error && <p className="text-red-500 text-xs mt-2 font-medium">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default ImageUploader;