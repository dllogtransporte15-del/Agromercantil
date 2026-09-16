
import React from 'react';
import Header from '../components/Header';
import ImageUploader from '../components/ImageUploader';
import { Moon, Sun, CheckCircle2, Sparkles, Monitor } from 'lucide-react';

interface AppearancePageProps {
  currentLogo: string | null;
  onSaveLogo: (logoBase64: string) => void;
  currentTheme: string | null;
  onSaveTheme: (themeBase64: string) => void;
  themeMode?: 'dark' | 'light';
  onThemeModeChange?: (mode: 'dark' | 'light') => void;
}

const AppearancePage: React.FC<AppearancePageProps> = ({ 
  currentLogo, 
  onSaveLogo, 
  currentTheme, 
  onSaveTheme,
  themeMode = 'dark',
  onThemeModeChange
}) => {
  return (
    <>
      <Header title="Gestão de Aparência" />
      <div className="space-y-8">
        {/* Escolha do Fundo: Escuro ou Claro */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0b1328]/85 border border-slate-200 dark:border-slate-700/60 shadow-xl backdrop-blur-xl transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-primary dark:text-sky-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Estilo Visual e Fundo do Sistema</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione o esquema de cores para o painel operacional e navegação interna.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {/* Opção Fundo Escuro */}
            <button
              type="button"
              onClick={() => onThemeModeChange && onThemeModeChange('dark')}
              className={`relative p-5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between overflow-hidden group ${
                themeMode === 'dark'
                  ? 'border-sky-500 bg-[#070c18] text-white shadow-xl shadow-blue-950/60 ring-2 ring-sky-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-[#070c18]/90 text-slate-300 hover:border-slate-400'
              }`}
            >
              <div 
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '24px 24px'
                }}
              />
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      Fundo Escuro
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-950 border border-sky-600 text-sky-300">
                        Padrão Login
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">Visual moderno Cyber Logistics com alto contraste e descanso visual</p>
                  </div>
                </div>
                {themeMode === 'dark' && (
                  <CheckCircle2 className="w-6 h-6 text-sky-400 shrink-0" />
                )}
              </div>

              {/* Preview UI Bar */}
              <div className="relative z-10 w-full p-2.5 rounded-lg bg-[#0b1328] border border-slate-700/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div className="h-2 w-16 bg-slate-700 rounded-full" />
                </div>
                <div className="h-2 w-8 bg-sky-500 rounded-full" />
              </div>
            </button>

            {/* Opção Fundo Claro */}
            <button
              type="button"
              onClick={() => onThemeModeChange && onThemeModeChange('light')}
              className={`relative p-5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between overflow-hidden group ${
                themeMode === 'light'
                  ? 'border-blue-600 bg-slate-50 text-slate-900 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-100 text-slate-700 hover:border-slate-400'
              }`}
            >
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                      Fundo Claro
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 border border-slate-300 text-slate-700">
                        Clássico
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">Interface clean, fundo branco/slate e máxima luminosidade para o dia a dia</p>
                  </div>
                </div>
                {themeMode === 'light' && (
                  <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0" />
                )}
              </div>

              {/* Preview UI Bar */}
              <div className="relative z-10 w-full p-2.5 rounded-lg bg-white border border-slate-300 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                  <div className="h-2 w-16 bg-slate-200 rounded-full" />
                </div>
                <div className="h-2 w-8 bg-blue-500 rounded-full" />
              </div>
            </button>
          </div>
        </div>

        {/* Uploads de Imagens */}
        <ImageUploader
          title="Logo da Empresa"
          description="Faça o upload do logo que será exibido na barra superior e na tela de login (limite de 2MB)."
          currentImage={currentLogo}
          onSave={onSaveLogo}
          onRemove={() => onSaveLogo('')}
        />
        <ImageUploader
          title="Tema de Fundo Personalizado"
          description="Imagem de fundo opcional para o sistema. Se configurada, será aplicada sobre o fundo base (limite de 5MB)."
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