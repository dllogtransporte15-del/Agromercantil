import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

interface DownloadAppPageProps {
  companyLogo: string | null;
}

const DownloadAppPage: React.FC<DownloadAppPageProps> = ({ companyLogo }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if it's already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If we don't have the prompt, they might be on iOS or unsupported browser
      alert("Para instalar neste dispositivo, use a opção 'Adicionar à Tela Inicial' no menu do seu navegador (geralmente ícone de compartilhamento no Safari ou três pontos no Chrome).");
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center p-8">
        
        {companyLogo ? (
          <img src={companyLogo} alt="Logo" className="h-24 mx-auto mb-6 object-contain" />
        ) : (
          <div className="h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl text-blue-600 font-bold">AM</span>
          </div>
        )}
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Aplicativo AGROMERCANTIL
        </h1>
        
        <p className="text-gray-600 mb-8">
          Instale nosso aplicativo para ter acesso rápido às suas cargas, histórico e muito mais, diretamente da tela inicial do seu celular.
        </p>
        
        {isInstalled ? (
          <div className="bg-green-50 text-green-700 p-4 rounded-xl font-medium border border-green-200">
            ✅ O aplicativo já está instalado neste dispositivo!
          </div>
        ) : (
          <div className="space-y-6">
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold py-4 px-8 rounded-xl shadow-lg transition-transform transform hover:scale-105"
            >
              <Download className="w-6 h-6" />
              Instalar Aplicativo
            </button>
            
            <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="font-semibold mb-2">Não conseguiu instalar?</p>
              <ul className="text-left list-disc list-inside space-y-1">
                <li><strong>No Android (Chrome):</strong> Toque nos três pontos (⋮) e escolha "Adicionar à tela inicial".</li>
                <li><strong>No iPhone (Safari):</strong> Toque no ícone de compartilhar (quadrado com seta para cima) e depois em "Adicionar à Tela de Início".</li>
              </ul>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-8 text-center">
        <a href="/" className="text-blue-600 hover:underline font-medium">
          Voltar para a tela inicial
        </a>
      </div>
    </div>
  );
};

export default DownloadAppPage;
