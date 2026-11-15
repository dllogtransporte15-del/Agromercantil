
import React from 'react';

interface VolumeBarProps {
  loaded: number;
  scheduled: number;
  total: number;
  loadedColor?: string;
  scheduledColor?: string;
  onClick?: () => void;
}

const VolumeBar: React.FC<VolumeBarProps> = ({ 
    loaded, 
    scheduled, 
    total, 
    loadedColor = 'bg-green-500', 
    scheduledColor = 'bg-orange-400',
    onClick
}) => {
  const loadedPercentage = total > 0 ? (loaded / total) * 100 : 0;
  const scheduledPercentage = total > 0 ? (scheduled / total) * 100 : 0;
  
  return (
    <div 
      className={`w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 flex overflow-hidden ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      onClick={onClick}
    >
      <div
        className={`${loadedColor} h-2.5 transition-all duration-300`}
        style={{ width: `${loadedPercentage}%` }}
        title={`Volume Carregado: ${loaded.toLocaleString('pt-BR')} ton`}
      ></div>
      <div
        className={`${scheduledColor} h-2.5 transition-all duration-300`}
        style={{ width: `${scheduledPercentage}%` }}
        title={`Volume Programado: ${scheduled.toLocaleString('pt-BR')} ton`}
      ></div>
    </div>
  );
};

export default VolumeBar;
