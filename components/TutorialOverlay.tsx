import React, { useState, useEffect } from 'react';
import type { Page, User } from '../types';
import { UserProfile } from '../types';

interface TutorialOverlayProps {
  user: User | null;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ user, currentPage, setCurrentPage }) => {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (user?.profile === UserProfile.Demonstracao) {
      // Check if tutorial was already finished in this session
      const finished = sessionStorage.getItem('dllog_tutorial_finished');
      if (!finished) {
        setIsVisible(true);
      }
    } else {
      setIsVisible(false);
    }
  }, [user]);

  if (!isVisible) return null;

  const steps = [
    {
      title: "Bem-vindo ao DLLOG!",
      content: "Este é o seu guia passo a passo para começar a operar no sistema. Vamos aprender o fluxo básico de um embarque?",
      targetPage: 'dashboard',
      actionLabel: "Começar Tutorial"
    },
    {
      title: "1. Cadastrar o Cliente",
      content: "O primeiro passo é cadastrar o Tomador da Carga (Cliente). Vá para a página de Clientes e utilize o botão 'Novo Cliente'. Sem um cliente, não há para quem cobrar o frete!",
      targetPage: 'clients',
      actionLabel: "Ir para Clientes"
    },
    {
      title: "2. Cadastrar o Produto",
      content: "Com o cliente cadastrado, agora precisamos cadastrar o que será transportado (Soja, Milho, Fertilizante, etc). Isso define a unidade de medida do transporte.",
      targetPage: 'products',
      actionLabel: "Ir para Produtos"
    },
    {
      title: "3. Cadastrar a Carga",
      content: "Agora vamos criar a oferta de carga! Aqui você define a origem, destino, volume total e os valores de frete negociados.",
      targetPage: 'loads',
      actionLabel: "Ir para Cargas"
    },
    {
      title: "4. Solicitar Embarque",
      content: "Na visão operacional, você vincula um motorista e um veículo a uma carga disponível. É aqui que a viagem começa a ganhar vida!",
      targetPage: 'operational-loads',
      actionLabel: "Ir para Operacional"
    },
    {
      title: "5. Fluxo de Status",
      content: "Por fim, gerencie o progresso de cada embarque. Siga etapa por etapa: desde a liberação da seguradora, carregamento, emissão de nota, até o pagamento do saldo final.",
      targetPage: 'shipments',
      actionLabel: "Ir para Embarques"
    },
    {
      title: "Tutorial Concluído!",
      content: "Você agora conhece o caminho fundamental do sistema. Sinta-se à vontade para explorar os mapas, relatórios e ferramentas financeiras!",
      targetPage: 'dashboard',
      actionLabel: "Finalizar e Explorar"
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      setCurrentPage(steps[nextStep].targetPage as Page);
    } else {
      setIsVisible(false);
      sessionStorage.setItem('dllog_tutorial_finished', 'true');
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem('dllog_tutorial_finished', 'true');
  };

  const currentStep = steps[step];

  return (
    <div className="fixed bottom-8 left-8 z-[9999] p-0 w-full max-w-sm pointer-events-none">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 border-t-8 border-primary animate-in slide-in-from-left-full duration-500 pointer-events-auto relative overflow-hidden ring-1 ring-black/5">
        
        {/* Background Accent */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-gray-200 dark:bg-gray-700'}`}
              />
            ))}
          </div>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="relative">
          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 tracking-tight">
            {currentStep.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed font-medium">
            {currentStep.content}
          </p>
        </div>
        
        <div className="flex flex-col gap-2">
          <button 
            onClick={handleNext}
            className="w-full py-3 px-4 bg-primary text-black font-black rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all active:scale-95 uppercase tracking-wider text-xs"
            style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #F1D279 100%)' }}
          >
            {currentStep.actionLabel}
          </button>
          
          {step > 0 && (
            <button 
              onClick={() => {
                const prevStep = step - 1;
                setStep(prevStep);
                setCurrentPage(steps[prevStep].targetPage as Page);
              }}
              className="w-full py-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest transition-colors"
            >
              Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
