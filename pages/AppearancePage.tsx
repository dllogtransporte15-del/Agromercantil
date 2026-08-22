
import React from 'react';
import Header from '../components/Header';
import ImageUploader from '../components/ImageUploader';

interface AppearancePageProps {
  currentLogo: string | null;
  onSaveLogo: (logoBase64: string) => void;
  currentTheme: string | null;
  onSaveTheme: (themeBase64: string) => void;
}

const AppearancePage: React.FC<AppearancePageProps> = ({ currentLogo, onSaveLogo, currentTheme, onSaveTheme }) => {
  return (
    <>
      <Header title="Identidade Visual & Customização" />
      <div className="space-y-8">
        <ImageUploader
          title="Logo da Empresa"
          description="Faça o upload do logo que será exibido na barra lateral e na tela de login (limite de 2MB)."
          currentImage={currentLogo}
          onSave={onSaveLogo}
          onRemove={() => onSaveLogo('')}
        />
        <ImageUploader
          title="Tema de Fundo"
          description="Imagem de fundo para o sistema. Será aplicada em todas as páginas (limite de 5MB)."
          currentImage={currentTheme}
          onSave={onSaveTheme}
          onRemove={() => onSaveTheme('')}
          maxSizeMB={5}
        />
      </div>
    </>
  );
};

export default AppearancePage;