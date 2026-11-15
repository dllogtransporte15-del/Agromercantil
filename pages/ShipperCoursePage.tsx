import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  CheckCircle2, 
  Truck, 
  ShieldCheck, 
  FileText, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  Calculator, 
  CheckSquare, 
  ChevronRight, 
  Search, 
  Award, 
  Clock, 
  ArrowRight, 
  ArrowLeft,
  HelpCircle, 
  Sparkles, 
  FileSpreadsheet,
  Layers,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Info,
  Printer,
  Check,
  Headphones,
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Volume2,
  Scale,
  Landmark,
  Download,
  WifiOff,
  Smartphone,
  ChevronUp,
  FileDown,
  HardDriveDownload,
  Link2,
  LogOut
} from 'lucide-react';
import { UserProfile } from '../types';
import type { User } from '../types';
import { 
  CourseChapter, 
  CoursePhaseNumber,
  COURSE_PHASES,
  COURSE_CHAPTERS, 
  QUIZ_QUESTIONS, 
  VEHICLE_CAPACITIES 
} from '../utils/shipperCourseData';
import {
  getSortedPortugueseVoices,
  pickBestMaleVoice,
  formatVoiceOptionLabel,
  getNaturalVoiceParams,
  splitIntoNaturalSpeechSegments
} from '../utils/courseVoiceEngine';
import {
  VehicleCombinationDiagram,
  VehicleCombinationsInteractiveAtlas,
  VehicleDiagramType
} from '../components/VehicleCombinationDiagram';
import {
  getCourseOfflineStatus,
  saveCourseToDeviceOfflineCache,
  downloadCourseOfflinePDF,
  downloadOfflineInteractiveCourseBundle
} from '../utils/courseOfflineBuilder';

interface ShipperCoursePageProps {
  currentUser?: User | null;
  onBackToApp?: () => void;
  onLogout?: () => void;
}

export const ShipperCoursePage: React.FC<ShipperCoursePageProps> = ({
  currentUser,
  onBackToApp,
  onLogout
}) => {
  const isStudentOnly = currentUser?.profile === UserProfile.Aluno;
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);

  const handleCopyDirectCourseLink = async () => {
    const directUrl = `${window.location.origin}/curso-embarcador`;
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopiedDirectLink(true);
      setTimeout(() => setCopiedDirectLink(false), 2500);
    } catch {
      window.prompt('Copie o link direto do curso:', directUrl);
    }
  };
  const [activeTab, setActiveTab] = useState<'conteudo' | 'audio' | 'calculadora' | 'tabela' | 'quiz'>('conteudo');
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<'all' | CoursePhaseNumber>('all');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('apresentacao');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Progresso salvo no localStorage
  const [completedChapters, setCompletedChapters] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('transcunha_course_completed_chapters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleChapterCompletion = (chapterId: string) => {
    setCompletedChapters(prev => {
      const next = prev.includes(chapterId)
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId];
      try {
        localStorage.setItem('transcunha_course_completed_chapters', JSON.stringify(next));
      } catch (err) {
        console.error('Erro ao salvar progresso do curso:', err);
      }
      return next;
    });
  };

  // ============================================================================
  // SISTEMA DE AULAS EM ÁUDIO NARRADAS (WEB SPEECH API SINCRONIZADA)
  // ============================================================================
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPausedAudio, setIsPausedAudio] = useState(false);
  const [audioMode, setAudioMode] = useState<'aula_professor' | 'leitura_completa'>('aula_professor');
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [autoAdvanceLesson, setAutoAdvanceLesson] = useState<boolean>(true);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const userChoseVoiceRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const pauseTimerRef = useRef<number | null>(null);

  const currentChapter = useMemo(() => {
    return COURSE_CHAPTERS.find(c => c.id === selectedChapterId) || COURSE_CHAPTERS[0];
  }, [selectedChapterId]);

  // Monta os blocos de narração do capítulo atual
  const narrationChunks = useMemo(() => {
    if (audioMode === 'aula_professor' && currentChapter.audioScript && currentChapter.audioScript.length > 0) {
      return currentChapter.audioScript.map((paragraph, idx) => ({
        id: `script-${idx}`,
        label: idx === 0 ? 'Introdução da Aula' : `Explicação do Professor • Parte ${idx + 1}`,
        text: paragraph
      }));
    }
    const chunks: { id: string; label: string; text: string }[] = [
      {
        id: 'intro',
        label: `Módulo ${currentChapter.number} — Resumo Executivo`,
        text: `Módulo ${currentChapter.number}: ${currentChapter.title}. ${currentChapter.subtitle}. Resumo executivo: ${currentChapter.summary}`
      }
    ];
    currentChapter.sections.forEach((sec, sIdx) => {
      sec.content.forEach((p, pIdx) => {
        chunks.push({
          id: `sec-${sIdx}-${pIdx}`,
          label: `${sec.title} (${pIdx + 1}/${sec.content.length})`,
          text: pIdx === 0 ? `${sec.title}. ${p}` : p
        });
      });
      if (sec.auditNote) {
        chunks.push({
          id: `sec-${sIdx}-audit`,
          label: `Auditoria Fiscal — ${sec.title}`,
          text: `Nota de Auditoria Técnica: ${sec.auditNote}`
        });
      }
      if (sec.tips && sec.tips.length > 0) {
        chunks.push({
          id: `sec-${sIdx}-tips`,
          label: `Dica de Ouro — ${sec.title}`,
          text: `Dica de Ouro: ${sec.tips.join(' ')}`
        });
      }
      if (sec.warning) {
        chunks.push({
          id: `sec-${sIdx}-warn`,
          label: `Alerta Importante — ${sec.title}`,
          text: `Atenção mandatória: ${sec.warning}`
        });
      }
    });
    return chunks;
  }, [currentChapter, audioMode]);

  // Carrega e prioriza automaticamente a melhor voz masculina e natural em PT-BR
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const sorted = getSortedPortugueseVoices();
      setAvailableVoices(sorted);
      if (!userChoseVoiceRef.current && sorted.length > 0) {
        const bestMale = pickBestMaleVoice(sorted);
        if (bestMale) setSelectedVoiceURI(bestMale.voiceURI);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      isStoppingRef.current = true;
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setIsPausedAudio(false);
  }, []);

  const speakChunkAtIndex = useCallback((index: number, chunksToSpeak = narrationChunks) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (index < 0 || index >= chunksToSpeak.length) {
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
      return;
    }

    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    isStoppingRef.current = true;
    window.speechSynthesis.cancel();

    setTimeout(() => {
      isStoppingRef.current = false;
      const chunk = chunksToSpeak[index];
      if (!chunk) return;

      const sortedVoices = availableVoices.length > 0 ? availableVoices : getSortedPortugueseVoices();
      const matchedVoice =
        sortedVoices.find(v => v.voiceURI === selectedVoiceURI) ||
        pickBestMaleVoice(sortedVoices);
      const { pitch, rate } = getNaturalVoiceParams(matchedVoice, audioSpeed);

      // Divide o trecho em frases naturais com pausa respiratória humana
      const sentences = splitIntoNaturalSpeechSegments(chunk.text);
      if (sentences.length === 0) return;

      setCurrentChunkIndex(index);
      setIsPlayingAudio(true);
      setIsPausedAudio(false);

      const speakSentence = (sIdx: number) => {
        if (isStoppingRef.current) return;
        const sentenceText = sentences[sIdx];
        if (!sentenceText) return;

        const utterance = new SpeechSynthesisUtterance(sentenceText);
        utterance.lang = matchedVoice?.lang || 'pt-BR';
        if (matchedVoice) utterance.voice = matchedVoice;
        utterance.pitch = pitch;
        utterance.rate = rate;

        utterance.onend = () => {
          if (isStoppingRef.current) return;
          if (sIdx + 1 < sentences.length) {
            pauseTimerRef.current = window.setTimeout(() => {
              speakSentence(sIdx + 1);
            }, 130);
          } else if (index + 1 < chunksToSpeak.length) {
            pauseTimerRef.current = window.setTimeout(() => {
              speakChunkAtIndex(index + 1, chunksToSpeak);
            }, 260);
          } else {
            setIsPlayingAudio(false);
            setIsPausedAudio(false);
            setCurrentChunkIndex(0);
            // Marca capítulo como concluído ao terminar de ouvir a aula!
            if (!completedChapters.includes(currentChapter.id)) {
              toggleChapterCompletion(currentChapter.id);
            }
            // Se auto-avançar estiver ativo, vai para o próximo capítulo
            if (autoAdvanceLesson) {
              const currIdx = COURSE_CHAPTERS.findIndex(c => c.id === currentChapter.id);
              if (currIdx >= 0 && currIdx < COURSE_CHAPTERS.length - 1) {
                const nextChapter = COURSE_CHAPTERS[currIdx + 1];
                setSelectedChapterId(nextChapter.id);
              }
            }
          }
        };

        utterance.onerror = () => {
          if (!isStoppingRef.current) {
            setIsPlayingAudio(false);
            setIsPausedAudio(false);
          }
        };

        window.speechSynthesis.speak(utterance);
      };

      speakSentence(0);
    }, 60);
  }, [narrationChunks, audioSpeed, selectedVoiceURI, availableVoices, completedChapters, currentChapter.id, autoAdvanceLesson]);

  // Para o áudio ao trocar de capítulo manualmente
  useEffect(() => {
    stopAudio();
    setCurrentChunkIndex(0);
  }, [selectedChapterId, audioMode, stopAudio]);

  const handleTogglePlayPause = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isPlayingAudio && !isPausedAudio) {
      window.speechSynthesis.pause();
      setIsPausedAudio(true);
    } else if (isPlayingAudio && isPausedAudio) {
      window.speechSynthesis.resume();
      setIsPausedAudio(false);
    } else {
      speakChunkAtIndex(currentChunkIndex);
    }
  };

  const handleChangeSpeed = (newSpeed: number) => {
    setAudioSpeed(newSpeed);
    if (isPlayingAudio) {
      setTimeout(() => speakChunkAtIndex(currentChunkIndex), 50);
    }
  };

  // ============================================================================
  // ESTADOS DOS SIMULADORES (FASE 1: FROTA & FASE 2: TRIBUTOS E CRÉDITOS)
  // ============================================================================
  const [simulatorMode, setSimulatorMode] = useState<'frota_fase1' | 'tributos_fase2'>('frota_fase1');

  // Simulador Fase 1: Dimensionamento de Cargas
  const [calcTotalTons, setCalcTotalTons] = useState<number>(240);
  const [calcVehicleType, setCalcVehicleType] = useState<string>('rodotrem');
  const [calcFreightRate, setCalcFreightRate] = useState<number>(195);
  const [calcDriverRate, setCalcDriverRate] = useState<number>(175);

  // Simulador Fase 2: Créditos Fiscais & Reforma Tributária na Transportadora
  const [taxGrossFreight, setTaxGrossFreight] = useState<number>(100000);
  const [taxOperationType, setTaxOperationType] = useState<'interno' | 'exportacao'>('interno');
  const [taxFleetModel, setTaxFleetModel] = useState<'frota_propria' | 'autonomo_tac'>('frota_propria');
  const [taxDieselTireSpend, setTaxDieselTireSpend] = useState<number>(45000);
  const [taxAdminTechSpend, setTaxAdminTechSpend] = useState<number>(8000);
  const [taxTruckPurchaseSpend, setTaxTruckPurchaseSpend] = useState<number>(20000);
  const [taxIcmsRate, setTaxIcmsRate] = useState<number>(12);
  const [taxIvaRate, setTaxIvaRate] = useState<number>(26.5);

  // Cálculos do Simulador Tributário (Fase 2)
  const taxSimResults = useMemo(() => {
    const isExport = taxOperationType === 'exportacao';
    // CENÁRIO ATUAL (HOJE - Lucro Real c/ Crédito Presumido 20% ICMS)
    const currentIcmsNominal = isExport ? 0 : taxGrossFreight * (taxIcmsRate / 100);
    const currentIcmsPresumedCredit = currentIcmsNominal * 0.20; // Convênio 106/96 (20%)
    const currentIcmsNet = currentIcmsNominal - currentIcmsPresumedCredit;
    // No CIAP atual, compra de caminhão só recupera 1/48 ao mês se não usar crédito presumido
    const currentPisCofinsDebit = isExport ? 0 : taxGrossFreight * 0.0925;
    const currentPisCofinsCredit =
      taxFleetModel === 'frota_propria'
        ? (taxDieselTireSpend + taxTruckPurchaseSpend / 48) * 0.0925
        : (taxGrossFreight * 0.80) * 0.069375; // 75% de 9,25% sobre frete pago ao TAC
    const currentPisCofinsNet = Math.max(0, currentPisCofinsDebit - currentPisCofinsCredit);
    const currentTotalTaxPaid = currentIcmsNet + currentPisCofinsNet;
    const currentTotalCreditsCaptured = currentIcmsPresumedCredit + currentPisCofinsCredit;
    // Créditos perdidos hoje (despesas admin/TI/GR + 47/48 do ativo imobilizado no mês)
    const currentLostAdminCredit = taxAdminTechSpend * 0.0925;

    // CENÁRIO PÓS-REFORMA (IVA DUAL: CBS + IBS c/ Não-Cumulatividade Plena)
    const rateFraction = taxIvaRate / 100;
    const reformIvaDebit = isExport ? 0 : taxGrossFreight * rateFraction;
    const reformCreditsInputsAndAdmin =
      taxFleetModel === 'frota_propria'
        ? (taxDieselTireSpend + taxAdminTechSpend + taxTruckPurchaseSpend) * rateFraction
        : (taxAdminTechSpend + taxTruckPurchaseSpend) * rateFraction + (taxGrossFreight * 0.80) * (rateFraction * 0.60); // Crédito amplo + crédito presumido sobre TAC
    const reformNetTaxOrRefund = reformIvaDebit - reformCreditsInputsAndAdmin;
    const reformClientFullCredit = reformIvaDebit; // Cliente B2B recupera 100% do IVA destacado por fora

    return {
      currentIcmsNominal,
      currentIcmsPresumedCredit,
      currentIcmsNet,
      currentPisCofinsDebit,
      currentPisCofinsCredit,
      currentPisCofinsNet,
      currentTotalTaxPaid,
      currentTotalCreditsCaptured,
      currentLostAdminCredit,
      reformIvaDebit,
      reformCreditsInputsAndAdmin,
      reformNetTaxOrRefund,
      reformClientFullCredit
    };
  }, [taxGrossFreight, taxOperationType, taxFleetModel, taxDieselTireSpend, taxAdminTechSpend, taxTruckPurchaseSpend, taxIcmsRate, taxIvaRate]);

  // Estado do Quiz
  const [quizPhaseFilter, setQuizPhaseFilter] = useState<'all' | CoursePhaseNumber>('all');
  const [quizAnswers, setQuizAnswers] = useState<{ [questionId: number]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const filteredQuizQuestions = useMemo(() => {
    if (quizPhaseFilter === 'all') return QUIZ_QUESTIONS;
    return QUIZ_QUESTIONS.filter(q => q.phase === quizPhaseFilter);
  }, [quizPhaseFilter]);

  const selectedVehicleData = VEHICLE_CAPACITIES[calcVehicleType] || VEHICLE_CAPACITIES.rodotrem;
  const trucksNeeded = Math.ceil(calcTotalTons / (selectedVehicleData.capacity || 1));
  const totalClientFreight = calcTotalTons * calcFreightRate;
  const totalDriverFreight = calcTotalTons * calcDriverRate;
  const totalProfitMargin = totalClientFreight - totalDriverFreight;
  const profitMarginPercent = totalClientFreight > 0 ? (totalProfitMargin / totalClientFreight) * 100 : 0;

  // Filtragem de capítulos por fase e busca
  const filteredChapters = useMemo(() => {
    return COURSE_CHAPTERS.filter(ch => {
      if (selectedPhaseFilter !== 'all' && ch.phase !== selectedPhaseFilter) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        ch.title.toLowerCase().includes(term) ||
        ch.subtitle.toLowerCase().includes(term) ||
        ch.summary.toLowerCase().includes(term) ||
        ch.sections.some(
          s =>
            s.title.toLowerCase().includes(term) ||
            s.content.some(c => c.toLowerCase().includes(term)) ||
            (s.auditNote && s.auditNote.toLowerCase().includes(term))
        )
      );
    });
  }, [searchTerm, selectedPhaseFilter]);

  const phase1Chapters = useMemo(() => filteredChapters.filter(c => c.phase === 1), [filteredChapters]);
  const phase2Chapters = useMemo(() => filteredChapters.filter(c => c.phase === 2), [filteredChapters]);

  const currentChapterIndex = useMemo(() => {
    return COURSE_CHAPTERS.findIndex(c => c.id === selectedChapterId);
  }, [selectedChapterId]);

  const progressPercentage = Math.round((completedChapters.length / COURSE_CHAPTERS.length) * 100);
  const phase1CompletedCount = COURSE_CHAPTERS.filter(c => c.phase === 1 && completedChapters.includes(c.id)).length;
  const phase2CompletedCount = COURSE_CHAPTERS.filter(c => c.phase === 2 && completedChapters.includes(c.id)).length;

  const handleSelectQuizOption = (questionId: number, optionIndex: number) => {
    if (quizSubmitted) return;
    setQuizAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const calculateScore = () => {
    let correct = 0;
    filteredQuizQuestions.forEach(q => {
      if (quizAnswers[q.id] === q.correctIndex) {
        correct++;
      }
    });
    return correct;
  };

  const handleNextChapter = () => {
    if (currentChapterIndex < COURSE_CHAPTERS.length - 1) {
      const nextId = COURSE_CHAPTERS[currentChapterIndex + 1].id;
      setSelectedChapterId(nextId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevChapter = () => {
    if (currentChapterIndex > 0) {
      const prevId = COURSE_CHAPTERS[currentChapterIndex - 1].id;
      setSelectedChapterId(prevId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCloseOrBack = () => {
    stopAudio();
    if (onBackToApp) {
      onBackToApp();
    } else if (window.opener) {
      window.close();
    } else {
      window.location.href = '/';
    }
  };

  const selectPhaseAndFirstChapter = (phase: 'all' | CoursePhaseNumber) => {
    setSelectedPhaseFilter(phase);
    if (phase === 1 && currentChapter.phase !== 1) {
      setSelectedChapterId('apresentacao');
    } else if (phase === 2 && currentChapter.phase !== 2) {
      setSelectedChapterId('tributos-iniciante');
    }
  };

  // ============================================================================
  // ESTUDO OFFLINE & OTIMIZAÇÃO MOBILE
  // ============================================================================
  const [isOfflinePanelOpen, setIsOfflinePanelOpen] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState(() => getCourseOfflineStatus());
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [isMobileModulesOpen, setIsMobileModulesOpen] = useState(false);
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsDeviceOnline(true);
    const handleOffline = () => setIsDeviceOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSaveOfflineToDevice = async () => {
    setIsSavingOffline(true);
    try {
      const status = await saveCourseToDeviceOfflineCache();
      setOfflineStatus(status);
    } finally {
      setIsSavingOffline(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-violet-500/30 pb-20 sm:pb-0">
      {/* Barra de Topo Fixa / Header Otimizada para Mobile & Desktop */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-xl px-3 sm:px-6 py-2.5 sm:py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo e Título */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-linear-to-tr from-violet-600 to-amber-600 text-white shadow-lg shadow-violet-600/30 shrink-0">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-sm sm:text-lg font-black text-white tracking-tight truncate">
                  Curso para Embarcador
                </h1>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-violet-950/80 text-violet-300 border border-violet-700/60 shadow-xs">
                  Fase 1 & 2
                </span>
                {!isDeviceOnline && (
                  <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-600/60 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> Modo Offline Ativo
                  </span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-700/60 hidden md:inline-block">
                  🎧 Aulas em Áudio + Reforma Tributária
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 hidden md:block truncate">
                Fase 1: Operação Logística & Embarque • Fase 2: Tributos do Zero, Créditos Fiscais & Reforma Tributária (CBS/IBS)
              </p>
            </div>
          </div>

          {/* Ações do Header */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Indicador de Progresso Desktop */}
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
                <div 
                  className="bg-linear-to-r from-violet-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">
                {completedChapters.length}/{COURSE_CHAPTERS.length} ({progressPercentage}%)
              </span>
            </div>

            {/* Botão Principal: Baixar Material & Áudio Offline (Mobile & Desktop) */}
            <button
              onClick={() => setIsOfflinePanelOpen(prev => !prev)}
              type="button"
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer border shadow-sm ${
                isOfflinePanelOpen
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/25'
                  : offlineStatus.saved
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900/60'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-amber-500/20'
              }`}
              title="Baixar Apostila PDF e Player de Áudio para Ler e Ouvir Offline"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden xs:inline sm:inline">
                {offlineStatus.saved ? 'Material Offline ✓' : 'Baixar Offline'}
              </span>
              <span className="xs:hidden sm:hidden">Offline</span>
            </button>

            {!isStudentOnly && (
              <button
                onClick={handleCopyDirectCourseLink}
                type="button"
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  copiedDirectLink
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-violet-300 hover:bg-slate-800'
                }`}
                title="Copiar Link Direto do Curso (/curso-embarcador)"
              >
                {copiedDirectLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5 text-violet-400" />}
                <span>{copiedDirectLink ? 'Link Copiado!' : 'Link Direto'}</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              type="button"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Imprimir ou Salvar em PDF"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Imprimir</span>
            </button>

            {isStudentOnly ? (
              <div className="flex items-center gap-2">
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-950/70 border border-violet-700/60 text-[11px] font-bold text-violet-200">
                  Aluno: {currentUser?.name}
                </span>
                {onLogout && (
                  <button
                    onClick={() => {
                      stopAudio();
                      onLogout();
                    }}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold text-rose-200 bg-rose-950/70 border border-rose-700/60 hover:bg-rose-900/70 transition-all cursor-pointer shadow-sm"
                  >
                    <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                    <span>Sair</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleCloseOrBack}
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400" />
                <span className="hidden sm:inline">Voltar ao Sistema</span>
                <span className="sm:hidden">Voltar</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Progresso Mobile Compacta */}
        <div className="mt-2 lg:hidden max-w-7xl mx-auto flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
          <span className="truncate">
            Progresso: {completedChapters.length}/{COURSE_CHAPTERS.length} módulos (F1: {phase1CompletedCount}/7 • F2: {phase2CompletedCount}/6)
          </span>
          <span className="font-bold text-violet-300 ml-2">{progressPercentage}%</span>
        </div>
        <div className="lg:hidden w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
          <div 
            className="bg-violet-500 h-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </header>

      {/* Navegação Secundária / Abas Responsivas */}
      <nav className="sticky top-[68px] sm:top-[73px] z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2">
        <div className="max-w-7xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar pb-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setActiveTab('conteudo')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'conteudo'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Módulos (F1 & F2)</span>
              </button>

              <button
                onClick={() => setActiveTab('audio')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'audio'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'text-amber-300/90 hover:text-amber-200 bg-amber-950/30 border border-amber-800/40 hover:bg-amber-900/40'
                }`}
              >
                <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Aulas em Áudio</span>
              </button>

              <button
                onClick={() => setActiveTab('tabela')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'tabela'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Conjuntos & Pesos</span>
              </button>

              <button
                onClick={() => setActiveTab('calculadora')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'calculadora'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Simuladores</span>
              </button>

              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'quiz'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Quiz ({QUIZ_QUESTIONS.length})</span>
              </button>
            </div>

            {/* Campo de Busca Rápida Desktop */}
            <div className="relative shrink-0 hidden md:block">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Pesquisar ICMS, CBS, IBS, veículos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:ring-2 focus:ring-violet-500 outline-none w-60"
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* CENTRAL DE DOWNLOAD E ESTUDO OFFLINE (LER E OUVIR SEM INTERNET NO CELULAR OU PC) */}
        {isOfflinePanelOpen && (
          <div className="p-4 sm:p-6 rounded-3xl bg-linear-to-br from-slate-950 via-emerald-950/30 to-slate-950 border-2 border-emerald-600/60 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shrink-0 mt-0.5">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-500 text-slate-950">
                      Estudo 100% Offline • Mobile & Desktop
                    </span>
                    {offlineStatus.saved && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700">
                        ✓ Salvo neste aparelho ({offlineStatus.chaptersCount} aulas)
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white mt-1">
                    Baixar Material Completo para Ler e Ouvir as Aulas Offline
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Escolha como deseja estudar sem internet no seu celular, tablet ou computador: baixe o <strong>App Portátil Interativo (com Leitura + Voz Masculina Offline)</strong>, a <strong>Apostila Completa em PDF</strong> ou ative o <strong>Cache Offline direto no navegador</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOfflinePanelOpen(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Fechar ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Opção 1: App Portátil HTML (Ler + Ouvir Offline no Celular/PC) */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/50 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                      🎧 Ler + Ouvir Aulas Offline
                    </span>
                    <Headphones className="w-4 h-4 text-amber-400" />
                  </div>
                  <h4 className="text-sm font-black text-white">
                    1. Baixar Player + Apostila Interativa (.HTML)
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Arquivo único que abre no celular (Android/iPhone) ou PC <strong>sem precisar de internet</strong>. Inclui os 13 módulos completos, busca e <strong>narração em voz masculina natural</strong> de todas as aulas!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadOfflineInteractiveCourseBundle()}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Curso + Áudio Offline</span>
                </button>
              </div>

              {/* Opção 2: E-Book PDF Completo */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-violet-500/50 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-violet-600 text-white">
                      📄 Apostila Oficial PDF
                    </span>
                    <FileDown className="w-4 h-4 text-violet-400" />
                  </div>
                  <h4 className="text-sm font-black text-white">
                    2. Baixar E-Book Completo em PDF
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Gera na hora o livro digital em PDF (<code className="text-violet-300">Apostila-Completa-Curso-Embarcador-DLLOG.pdf</code>) com todas as 13 aulas, tabela de conjuntos, roteiros de áudio e gabarito.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadCourseOfflinePDF()}
                  className="w-full py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-violet-600/20 cursor-pointer transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Baixar Apostila em PDF</span>
                </button>
              </div>

              {/* Opção 3: Salvar Cache no Dispositivo/PWA */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/50 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-600 text-white">
                      📲 Memória do Aparelho
                    </span>
                    <HardDriveDownload className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h4 className="text-sm font-black text-white">
                    3. Salvar no Cache Offline do App
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Guarda todos os capítulos, diagramas SVG e roteiros de voz na memória deste navegador para acessar o curso mesmo em viagens ou pátios sem sinal.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSavingOffline}
                  onClick={handleSaveOfflineToDevice}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  <HardDriveDownload className="w-4 h-4" />
                  <span>
                    {isSavingOffline
                      ? 'Salvando no Aparelho...'
                      : offlineStatus.saved
                      ? 'Atualizar Cópia Offline (✓ Salvo)'
                      : 'Ativar Modo Offline no App'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barra Rápida de Seletor de Módulo e Busca no Mobile (Evita rolagem longa no celular) */}
        <div className="lg:hidden p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Navegação Rápida Mobile
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => downloadOfflineInteractiveCourseBundle()}
                className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" /> Player Offline
              </button>
              <button
                type="button"
                onClick={() => downloadCourseOfflinePDF()}
                className="px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-300 text-[10px] font-black flex items-center gap-1 cursor-pointer"
              >
                <FileDown className="w-3 h-3" /> PDF
              </button>
            </div>
          </div>

          {(activeTab === 'conteudo' || activeTab === 'audio') && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={selectedChapterId}
                onChange={(e) => {
                  setSelectedChapterId(e.target.value);
                  setIsMobileModulesOpen(false);
                }}
                className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none"
              >
                <optgroup label="FASE 1 • Operação Logística & Embarque">
                  {COURSE_CHAPTERS.filter(c => c.phase === 1).map(ch => (
                    <option key={ch.id} value={ch.id}>
                      Mód. {ch.number} — {ch.title} ({ch.audioDuration})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="FASE 2 • Tributos, Créditos & Reforma (CBS/IBS)">
                  {COURSE_CHAPTERS.filter(c => c.phase === 2).map(ch => (
                    <option key={ch.id} value={ch.id}>
                      Mód. {ch.number} — {ch.title} ({ch.audioDuration})
                    </option>
                  ))}
                </optgroup>
              </select>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMobileModulesOpen(prev => !prev)}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isMobileModulesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>{isMobileModulesOpen ? 'Ocultar Lista' : 'Ver 13 Módulos'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Busca Rápida Mobile */}
          <div className="relative md:hidden">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar termo no curso (ex: Bitrem, ICMS, PGR)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none"
            />
          </div>
        </div>

        {/* Banner Seletor das 2 Fases do Curso (Visível em Conteúdo e Áudio) */}
        {(activeTab === 'conteudo' || activeTab === 'audio') && (
          <div className="hidden sm:grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card Fase 1 */}
            <button
              type="button"
              onClick={() => selectPhaseAndFirstChapter(selectedPhaseFilter === 1 ? 'all' : 1)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                selectedPhaseFilter === 1
                  ? 'bg-violet-950/60 border-violet-500 shadow-lg shadow-violet-950/50 ring-1 ring-violet-500/40'
                  : 'bg-slate-950/70 border-slate-800/80 hover:border-violet-700/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-violet-600 text-white">
                  FASE 1 • Módulos 00 a 06
                </span>
                <span className="text-[11px] font-bold text-violet-300">
                  {phase1CompletedCount}/7 concluídos
                </span>
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  {COURSE_PHASES[1].title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                  {COURSE_PHASES[1].subtitle}
                </p>
              </div>
            </button>

            {/* Card Fase 2 */}
            <button
              type="button"
              onClick={() => selectPhaseAndFirstChapter(selectedPhaseFilter === 2 ? 'all' : 2)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                selectedPhaseFilter === 2
                  ? 'bg-amber-950/60 border-amber-500 shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/40'
                  : 'bg-slate-950/70 border-slate-800/80 hover:border-amber-700/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950">
                  FASE 2 • Módulos 07 a 12 (NOVO)
                </span>
                <span className="text-[11px] font-bold text-amber-300">
                  {phase2CompletedCount}/6 concluídos
                </span>
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  {COURSE_PHASES[2].title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                  {COURSE_PHASES[2].subtitle}
                </p>
              </div>
            </button>

            {/* Card Visão Geral / Módulo 09 Destaque */}
            <div className="p-4 rounded-2xl border border-emerald-800/50 bg-emerald-950/25 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-600 text-white flex items-center gap-1">
                  <Landmark className="w-3 h-3" /> Destaque Especial Fase 2
                </span>
                {selectedPhaseFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedPhaseFilter('all')}
                    className="text-[11px] font-bold text-emerald-300 underline cursor-pointer"
                  >
                    Ver Ambas as Fases
                  </button>
                )}
              </div>
              <div>
                <h3 className="text-sm font-black text-emerald-200">
                  Módulo 09: Créditos e Benefícios de Transportadoras
                </h3>
                <p className="text-xs text-emerald-300/80 mt-0.5">
                  Estudo profundo do Crédito Presumido de 20% do ICMS, PIS/COFINS sobre diesel e TAC hoje vs. Crédito Amplo no IBS/CBS.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChapterId('creditos-beneficios-transportadoras');
                    setActiveTab('conteudo');
                  }}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black transition-colors cursor-pointer"
                >
                  Abrir Módulo 09 Agora →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChapterId('tributos-iniciante');
                    setActiveTab('conteudo');
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Começar Fase 2 (Mód. 07)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ABA 1: CAPÍTULOS DO MANUAL (SEPARADOS EM FASE 1 E FASE 2 + PLAYER DE ÁUDIO INTEGRADO) */}
        {activeTab === 'conteudo' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Menu Lateral de Capítulos Separado por Fases (Colapsável no Mobile e Sticky apenas no Desktop lg:) */}
            <aside className={`${isMobileModulesOpen ? 'block' : 'hidden'} lg:block lg:col-span-4 bg-slate-950/70 border border-slate-800/80 rounded-3xl p-4 shadow-xl space-y-3 lg:sticky lg:top-[140px]`}>
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Trilha do Curso ({filteredChapters.length} módulos)
                </span>
                <span className="text-[11px] text-violet-400 font-bold">
                  {completedChapters.length} concluídos
                </span>
              </div>

              <div className="space-y-4 max-h-[calc(100vh-230px)] overflow-y-auto pr-1 custom-scrollbar">
                {/* Grupo Fase 1 */}
                {phase1Chapters.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="px-2.5 py-1.5 rounded-xl bg-violet-950/50 border border-violet-800/50 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-violet-300">
                        Fase 1 • Operação & Embarque
                      </span>
                      <span className="text-[10px] font-bold text-violet-400">Mód. 00–06</span>
                    </div>
                    {phase1Chapters.map((ch) => {
                      const isSelected = ch.id === selectedChapterId;
                      const isDone = completedChapters.includes(ch.id);

                      return (
                        <button
                          key={ch.id}
                          onClick={() => setSelectedChapterId(ch.id)}
                          className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer flex items-start gap-3 border ${
                            isSelected 
                              ? 'bg-violet-600/20 border-violet-500 text-white shadow-lg shadow-violet-950/40 ring-1 ring-violet-500/30'
                              : 'bg-slate-900/50 border-slate-800/50 hover:bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                            <span className={`text-[11px] font-mono font-black px-2 py-0.5 rounded-md ${
                              isSelected ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {ch.number}
                            </span>
                            {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-bold leading-snug truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                              {ch.title}
                            </p>
                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                              {ch.subtitle}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-bold text-slate-500">{ch.readTime} leitura</span>
                              <span className="text-[9px] font-bold text-amber-400/90 flex items-center gap-0.5">
                                <Headphones className="w-2.5 h-2.5" /> {ch.audioDuration} áudio
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Grupo Fase 2 */}
                {phase2Chapters.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="px-2.5 py-1.5 rounded-xl bg-amber-950/50 border border-amber-800/50 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                        Fase 2 • Tributos, Créditos & Reforma
                      </span>
                      <span className="text-[10px] font-bold text-amber-400">Mód. 07–12</span>
                    </div>
                    {phase2Chapters.map((ch) => {
                      const isSelected = ch.id === selectedChapterId;
                      const isDone = completedChapters.includes(ch.id);
                      const isSpecialCredits = ch.id === 'creditos-beneficios-transportadoras';

                      return (
                        <button
                          key={ch.id}
                          onClick={() => setSelectedChapterId(ch.id)}
                          className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer flex items-start gap-3 border ${
                            isSelected 
                              ? 'bg-amber-600/20 border-amber-500 text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/30'
                              : isSpecialCredits
                              ? 'bg-emerald-950/30 border-emerald-700/50 hover:bg-emerald-900/30 text-emerald-100'
                              : 'bg-slate-900/50 border-slate-800/50 hover:bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                            <span className={`text-[11px] font-mono font-black px-2 py-0.5 rounded-md ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950'
                                : isSpecialCredits
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-amber-400'
                            }`}>
                              {ch.number}
                            </span>
                            {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-xs font-bold leading-snug truncate ${isSelected ? 'text-white' : 'text-slate-100'}`}>
                                {ch.title}
                              </p>
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                              {ch.subtitle}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[9px] font-bold text-slate-500">{ch.readTime} leitura</span>
                              <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
                                <Headphones className="w-2.5 h-2.5" /> {ch.audioDuration} áudio
                              </span>
                              {isSpecialCredits && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Módulo Profundo
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            {/* Painel de Leitura + Player de Áudio do Capítulo Selecionado */}
            <article className="lg:col-span-8 bg-slate-950/70 border border-slate-800/80 rounded-3xl p-4 sm:p-8 shadow-xl space-y-6 sm:space-y-7">
              {/* Topo do Capítulo */}
              <div className="pb-6 border-b border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                      currentChapter.phase === 1
                        ? 'bg-violet-950 text-violet-300 border border-violet-700/60'
                        : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                    }`}>
                      Fase {currentChapter.phase}
                    </span>
                    <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-violet-600 text-white shadow-sm">
                      Módulo {currentChapter.number}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-violet-400" /> {currentChapter.readTime} de leitura
                    </span>
                    <span className="text-xs text-amber-400 flex items-center gap-1.5 font-bold">
                      <Headphones className="w-3.5 h-3.5" /> {currentChapter.audioDuration} de aula narrada
                    </span>
                  </div>

                  {/* Botão de Marcar como Concluído */}
                  <button
                    onClick={() => toggleChapterCompletion(currentChapter.id)}
                    type="button"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      completedChapters.includes(currentChapter.id)
                        ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                        : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {completedChapters.includes(currentChapter.id) ? 'Módulo Concluído' : 'Marcar como Concluído'}
                    </span>
                  </button>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  {currentChapter.title}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  {currentChapter.subtitle}
                </p>

                {/* PLAYER DE AULA EM ÁUDIO NARRADA INTEGRADO NO CAPÍTULO */}
                <div className="p-4 sm:p-5 rounded-2xl bg-linear-to-r from-amber-950/50 via-violet-950/40 to-slate-900 border border-amber-700/50 shadow-lg space-y-3.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${isPlayingAudio && !isPausedAudio ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}`}>
                        <Headphones className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                            Aula em Áudio Narrada • Módulo {currentChapter.number}
                          </span>
                          {isPlayingAudio && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              {isPausedAudio ? 'Pausado' : 'Narrando ao vivo...'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Ouça a explicação didática do professor ou acompanhe a leitura completa narrada em português
                        </p>
                      </div>
                    </div>

                    {/* Seletor de Voz Masculina, Modo de Áudio e Velocidade */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {availableVoices.length > 0 && (
                        <select
                          value={selectedVoiceURI}
                          onChange={(e) => {
                            userChoseVoiceRef.current = true;
                            setSelectedVoiceURI(e.target.value);
                            if (isPlayingAudio) {
                              setTimeout(() => speakChunkAtIndex(currentChunkIndex), 50);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-bold text-amber-300 outline-none cursor-pointer max-w-[230px]"
                          title="Selecionar Voz do Professor (PT-BR)"
                        >
                          {availableVoices.map((v) => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                              {formatVoiceOptionLabel(v)}
                            </option>
                          ))}
                        </select>
                      )}

                      <select
                        value={audioMode}
                        onChange={(e) => setAudioMode(e.target.value as 'aula_professor' | 'leitura_completa')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-200 outline-none cursor-pointer"
                        title="Modo da Narração"
                      >
                        <option value="aula_professor">🎙️ Aula Explicativa do Professor</option>
                        <option value="leitura_completa">📖 Leitura Integral das Seções</option>
                      </select>

                      <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700 p-0.5">
                        {[1.0, 1.25, 1.5, 2.0].map(spd => (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => handleChangeSpeed(spd)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-colors cursor-pointer ${
                              audioSpeed === spd
                                ? 'bg-amber-500 text-slate-950'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Controles de Reprodução */}
                  <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTogglePlayPause}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                      >
                        {isPlayingAudio && !isPausedAudio ? (
                          <>
                            <Pause className="w-4 h-4 fill-current" />
                            <span>Pausar Aula</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>{isPausedAudio ? 'Continuar Aula' : 'Ouvir Aula em Áudio'}</span>
                          </>
                        )}
                      </button>

                      {isPlayingAudio && (
                        <button
                          type="button"
                          onClick={stopAudio}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Parar</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={currentChunkIndex <= 0}
                        onClick={() => speakChunkAtIndex(Math.max(0, currentChunkIndex - 1))}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                        title="Trecho Anterior"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={currentChunkIndex >= narrationChunks.length - 1}
                        onClick={() => speakChunkAtIndex(Math.min(narrationChunks.length - 1, currentChunkIndex + 1))}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                        title="Próximo Trecho"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>
                        Parte {currentChunkIndex + 1} de {narrationChunks.length}
                      </span>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoAdvanceLesson}
                          onChange={(e) => setAutoAdvanceLesson(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Auto-avançar módulo</span>
                      </label>
                    </div>
                  </div>

                  {/* Legenda Sincronizada do Trecho Atual */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs text-amber-100/90 leading-relaxed">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block mb-1">
                      {narrationChunks[currentChunkIndex]?.label || 'Roteiro da Aula'}:
                    </span>
                    <p className="italic">
                      "{narrationChunks[currentChunkIndex]?.text}"
                    </p>
                  </div>
                </div>

                {/* Resumo Executivo */}
                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-300 leading-relaxed space-y-1">
                  <span className="font-black text-violet-400 uppercase tracking-wider text-[11px] block">
                    Resumo Executivo do Módulo:
                  </span>
                  <p>{currentChapter.summary}</p>
                </div>
              </div>

              {/* Seções do Capítulo */}
              <div className="space-y-8">
                {currentChapter.sections.map((sec, idx) => (
                  <section key={idx} className="space-y-3.5">
                    <h3 className={`text-lg font-bold text-white flex items-center gap-2.5 border-l-4 pl-3 ${
                      currentChapter.phase === 2 ? 'border-amber-500' : 'border-violet-500'
                    }`}>
                      {sec.title}
                    </h3>

                    <div className="space-y-2.5 text-sm text-slate-300 leading-relaxed">
                      {sec.content.map((p, pIdx) => (
                        <p key={pIdx}>{p}</p>
                      ))}
                    </div>

                    {/* Tabela Comparativa (se houver) */}
                    {sec.table && (
                      <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-md my-4">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider border-b border-slate-800">
                            <tr>
                              {sec.table.headers.map((h, hIdx) => (
                                <th key={hIdx} className="py-3 px-4 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                            {sec.table.rows.map((r, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-900/50 transition-colors">
                                {r.map((cell, cIdx) => (
                                  <td key={cIdx} className={`py-3 px-4 ${cIdx === 0 ? 'font-bold text-white' : 'text-slate-300'}`}>
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Nota de Auditoria & Revisão Técnica (Verificação do E-book) */}
                    {sec.auditNote && (
                      <div className="p-4 bg-cyan-950/35 border border-cyan-700/60 rounded-2xl flex items-start gap-3 my-3">
                        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[11px] font-black text-cyan-300 uppercase tracking-wider block mb-0.5">
                            Auditoria Técnica & Verificação da Legislação (Conteúdo Revisado):
                          </span>
                          <p className="text-xs sm:text-sm text-cyan-100/90 leading-relaxed">
                            {sec.auditNote}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Dica de Ouro */}
                    {sec.tips && sec.tips.length > 0 && (
                      <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-2xl space-y-1.5 my-3">
                        <span className="text-[11px] font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          Dica de Ouro do Embarcador
                        </span>
                        {sec.tips.map((tip, tIdx) => (
                          <p key={tIdx} className="text-xs sm:text-sm text-emerald-300/90 leading-relaxed">{tip}</p>
                        ))}
                      </div>
                    )}

                    {/* Alerta Operacional / Warning */}
                    {sec.warning && (
                      <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-2xl flex items-start gap-3 my-3">
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider block mb-0.5">
                            Atenção Mandatória:
                          </span>
                          <p className="text-xs sm:text-sm font-semibold text-rose-200 leading-relaxed">
                            {sec.warning}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Demonstração Visual dos Conjuntos onde citados no Curso */}
                    {currentChapter.id === 'apresentacao' && idx === 2 && (
                      <div className="pt-2">
                        <VehicleCombinationDiagram type="rodotrem" />
                      </div>
                    )}

                    {currentChapter.id === 'veiculos' && idx === 1 && (
                      <VehicleCombinationsInteractiveAtlas />
                    )}

                    {currentChapter.id === 'risco' && idx === 0 && (
                      <div className="space-y-3 pt-2">
                        <p className="text-xs font-black uppercase tracking-wider text-amber-400">
                          Comparativo Visual de Placas e Acoplamentos para Cadastro no GR (Carreta LS vs. Bitrem vs. Rodotrem):
                        </p>
                        <VehicleCombinationDiagram type="carreta_simples" compact />
                        <VehicleCombinationDiagram type="bitrem" compact />
                        <VehicleCombinationDiagram type="rodotrem" compact />
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {/* Navegação Entre Capítulos (Anterior / Próximo) */}
              <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handlePrevChapter}
                  disabled={currentChapterIndex === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Módulo Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextChapter}
                  disabled={currentChapterIndex === COURSE_CHAPTERS.length - 1}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Próximo Módulo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          </div>
        )}

        {/* ABA 2: ESTÚDIO DE AULAS EM ÁUDIO NARRADAS (PODCAST / AUDIOBOOK DO EMBARCADOR) */}
        {activeTab === 'audio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Playlist de Episódios em Áudio */}
            <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                    DLLOG Audio Academy
                  </span>
                  <h3 className="text-lg font-black text-white">
                    Playlist de Aulas Narradas ({filteredChapters.length} Aulas)
                  </h3>
                </div>
                <Headphones className="w-6 h-6 text-amber-400" />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredChapters.map((ch) => {
                  const isCurrent = ch.id === selectedChapterId;
                  const isCurrentlySpeaking = isCurrent && isPlayingAudio && !isPausedAudio;

                  return (
                    <div
                      key={ch.id}
                      onClick={() => {
                        setSelectedChapterId(ch.id);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md'
                          : 'bg-slate-900/60 border-slate-800/70 hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isCurrent) {
                              handleTogglePlayPause();
                            } else {
                              setSelectedChapterId(ch.id);
                              setTimeout(() => speakChunkAtIndex(0), 120);
                            }
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            isCurrentlySpeaking
                              ? 'bg-amber-500 text-slate-950'
                              : isCurrent
                              ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {isCurrentlySpeaking ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              ch.phase === 1 ? 'bg-violet-950 text-violet-300' : 'bg-amber-950 text-amber-300'
                            }`}>
                              F{ch.phase} • Aula {ch.number}
                            </span>
                            <span className="text-[10px] font-bold text-amber-400">{ch.audioDuration}</span>
                          </div>
                          <p className="text-xs font-bold text-white truncate mt-0.5">{ch.title}</p>
                        </div>
                      </div>

                      {completedChapters.includes(ch.id) && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Painel Principal do Estúdio de Áudio e Roteiro Interativo */}
            <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="p-6 rounded-2xl bg-linear-to-br from-amber-950/50 via-slate-900 to-violet-950/40 border border-amber-700/50 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950">
                      Fase {currentChapter.phase} • Aula {currentChapter.number}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
                      {currentChapter.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1">
                      {currentChapter.subtitle}
                    </p>
                  </div>

                  {availableVoices.length > 0 && (
                    <div className="w-full sm:w-auto">
                      <label className="text-[10px] font-bold uppercase text-amber-400 block mb-1">
                        Voz Masculina do Professor (PT-BR):
                      </label>
                      <select
                        value={selectedVoiceURI}
                        onChange={(e) => {
                          userChoseVoiceRef.current = true;
                          setSelectedVoiceURI(e.target.value);
                          if (isPlayingAudio) {
                            setTimeout(() => speakChunkAtIndex(currentChunkIndex), 50);
                          }
                        }}
                        className="w-full sm:w-64 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-amber-300 outline-none cursor-pointer"
                      >
                        {availableVoices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {formatVoiceOptionLabel(v)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Controles Principais do Estúdio */}
                <div className="flex items-center justify-between gap-4 flex-wrap pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleTogglePlayPause}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                    >
                      {isPlayingAudio && !isPausedAudio ? (
                        <>
                          <Pause className="w-4 h-4 fill-current" />
                          <span>Pausar Narração</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>{isPausedAudio ? 'Continuar Narração' : 'Iniciar Aula em Áudio'}</span>
                        </>
                      )}
                    </button>

                    {isPlayingAudio && (
                      <button
                        type="button"
                        onClick={stopAudio}
                        className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        Parar
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold">Velocidade:</span>
                    {[1.0, 1.25, 1.5, 2.0].map(spd => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => handleChangeSpeed(spd)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                          audioSpeed === spd
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transcrição Interativa Sincronizada (Clique em qualquer parágrafo para ouvir daquele ponto) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Transcrição Sincronizada da Aula (Clique em um trecho para ouvir):
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAudioMode('aula_professor')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        audioMode === 'aula_professor' ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      Roteiro do Professor
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioMode('leitura_completa')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        audioMode === 'leitura_completa' ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      Texto Integral do Módulo
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                  {narrationChunks.map((chunk, idx) => {
                    const isActiveChunk = idx === currentChunkIndex && isPlayingAudio;
                    return (
                      <div
                        key={chunk.id}
                        onClick={() => speakChunkAtIndex(idx)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isActiveChunk
                            ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-500/30'
                            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            isActiveChunk ? 'text-amber-300' : 'text-slate-500'
                          }`}>
                            {chunk.label}
                          </span>
                          <span className="text-[10px] text-amber-400 font-bold">
                            {isActiveChunk ? '🔊 Narrando agora...' : 'Ouvir daqui ▶'}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm leading-relaxed">
                          {chunk.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: SIMULADORES PRÁTICOS (FASE 1: FROTA & MARGEM | FASE 2: CRÉDITOS FISCAIS & REFORMA) */}
        {activeTab === 'calculadora' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Seletor de Simulador */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setSimulatorMode('frota_fase1')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                  simulatorMode === 'frota_fase1'
                    ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/30'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Simulador Fase 1: Dimensionamento de Frota & Spread Comercial</span>
              </button>

              <button
                type="button"
                onClick={() => setSimulatorMode('tributos_fase2')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                  simulatorMode === 'tributos_fase2'
                    ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'bg-slate-950/70 border-slate-800 text-amber-300 hover:bg-slate-900'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>Simulador Fase 2: Créditos Fiscais da Transportadora (Hoje vs. Pós-Reforma)</span>
              </button>
            </div>

            {simulatorMode === 'frota_fase1' ? (
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-violet-950/60 border border-violet-800/60 text-violet-300 text-xs font-bold mb-2">
                    <Calculator className="w-4 h-4 text-violet-400" />
                    Ferramenta Prática • Fase 1
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Simulador de Frota, Viagens e Margem Comercial
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Exercício dinâmico: calcule a quantidade de caminhões, peso útil líquido e lucro operacional (spread) da sua carga.
                  </p>
                </div>

                {/* Inputs do Formulário */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Volume Total Contratado (Toneladas)
                    </label>
                    <input 
                      type="number"
                      min="1"
                      value={calcTotalTons}
                      onChange={(e) => setCalcTotalTons(Math.max(1, parseFloat(e.target.value) || 0))}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-base font-bold text-white focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Conjunto Veicular Escolhido
                    </label>
                    <select
                      value={calcVehicleType}
                      onChange={(e) => setCalcVehicleType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-violet-500 outline-none"
                    >
                      <option value="truck_3_eixos">Caminhão Truck 6x2 3 eixos (Líquido: 14,5 t | PBT 23 t)</option>
                      <option value="toco_carreta_2_eixos">Cavalo Toco + Carreta 2 eixos (Líquido: 20 t | PBT 33 t)</option>
                      <option value="toco_carreta_ls">Cavalo Toco + Carreta LS 3 eixos (Líquido: 26 t | PBT 41,5 t)</option>
                      <option value="toco_vanderleia">Cavalo Toco + Carreta Vanderleia (Líquido: 29,5 t | PBT 46 t)</option>
                      <option value="carreta_simples">Cavalo Trucado + Carreta LS 3 eixos (Líquido: 32 t | PBT 48,5 t)</option>
                      <option value="ls_4_eixos">Carreta 4 eixos LS (Líquido: 40 t | PBT 58,5 t)</option>
                      <option value="bitrem">Bitrem 7 eixos Quinta-Roda (Líquido: 37,5 t | PBT 57 t)</option>
                      <option value="bitrem_9_eixos">Bitrem 9 eixos Quinta-Roda (Líquido: 49,5 t | PBT 74 t)</option>
                      <option value="rodotrem">Rodotrem 9 eixos c/ Dolly (Líquido: 49,5 t | PBT 74 t)</option>
                      <option value="rodocacamba">Rodocaçamba 9 eixos c/ Dolly (Líquido: 47,5 t | PBT 74 t)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Frete Cliente (R$ por tonelada)
                    </label>
                    <input 
                      type="number"
                      step="0.50"
                      min="0"
                      value={calcFreightRate}
                      onChange={(e) => setCalcFreightRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-base font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Frete Motorista (R$ por tonelada)
                    </label>
                    <input 
                      type="number"
                      step="0.50"
                      min="0"
                      value={calcDriverRate}
                      onChange={(e) => setCalcDriverRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-base font-bold text-amber-400 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>

                {/* Demonstração Visual do Conjunto Selecionado no Simulador */}
                <VehicleCombinationDiagram type={calcVehicleType as VehicleDiagramType} />

                {/* Cards de Resultados */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Viagens / Carregamentos
                    </span>
                    <span className="text-3xl font-black text-violet-400 block">
                      {trucksNeeded} {trucksNeeded === 1 ? 'veículo' : 'veículos'}
                    </span>
                    <span className="text-xs text-slate-400 block">
                      Capacidade: {selectedVehicleData.capacity} t/viagem
                    </span>
                  </div>

                  <div className="p-5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Lucro Operacional (Spread)
                    </span>
                    <span className="text-3xl font-black text-emerald-400 block">
                      R$ {totalProfitMargin.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-slate-400 block">
                      Spread de R$ {(calcFreightRate - calcDriverRate).toFixed(2)}/t
                    </span>
                  </div>

                  <div className="p-5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Margem Percentual
                    </span>
                    <span className={`text-3xl font-black block ${profitMarginPercent >= 7 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {profitMarginPercent.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-400 block">
                      {profitMarginPercent >= 7 ? '✅ Margem excelente (meta 7-12%)' : '⚠️ Margem abaixo da média do agro'}
                    </span>
                  </div>
                </div>

                {/* Explicação da Balança ANTT */}
                <div className="p-5 bg-violet-950/30 border border-violet-800/60 rounded-2xl space-y-2 text-xs text-violet-200">
                  <div className="flex items-center gap-2 font-bold text-violet-300 text-sm">
                    <Info className="w-4 h-4 text-violet-400" />
                    <span>Auditoria de Balança: Regra de Tolerância de 5% da ANTT</span>
                  </div>
                  <p className="leading-relaxed">
                    Para o conjunto selecionado (<strong>{selectedVehicleData.name}</strong>), o PBT regulamentar é de <strong>{selectedVehicleData.pbt} t</strong>. A tolerância de 5% sobre o PBT permite passagem na pesagem rodoviária com até <strong>{(selectedVehicleData.pbt * 1.05).toFixed(3)} toneladas brutas</strong> sem autuação de excesso de peso.
                  </p>
                </div>
              </div>
            ) : (
              /* SIMULADOR FASE 2: TRIBUTOS E CRÉDITOS DA TRANSPORTADORA (HOJE VS PÓS-REFORMA) */
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-700/60 text-amber-300 text-xs font-bold mb-2">
                    <Landmark className="w-4 h-4 text-amber-400" />
                    Simulador Prático • Fase 2 (Módulos 07 a 12)
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Simulador de Créditos e Benefícios Fiscais: Hoje vs. Pós-Reforma (CBS/IBS)
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Compare na prática como funciona a apuração de ICMS (c/ Crédito Presumido de 20%) e PIS/COFINS hoje versus a Não-Cumulatividade Plena (CBS + IBS) pós-Reforma Tributária.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Receita Bruta de Frete (R$)
                    </label>
                    <input
                      type="number"
                      step="1000"
                      value={taxGrossFreight}
                      onChange={(e) => setTaxGrossFreight(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Natureza da Operação de Transporte
                    </label>
                    <select
                      value={taxOperationType}
                      onChange={(e) => setTaxOperationType(e.target.value as 'interno' | 'exportacao')}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none"
                    >
                      <option value="interno">Frete Mercado Interno (Tributado)</option>
                      <option value="exportacao">Frete de Exportação até o Porto (Desonerado)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Modelo de Execução da Viagem
                    </label>
                    <select
                      value={taxFleetModel}
                      onChange={(e) => setTaxFleetModel(e.target.value as 'frota_propria' | 'autonomo_tac')}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none"
                    >
                      <option value="frota_propria">Frota Própria (Compra Diesel e Peças c/ NF-e)</option>
                      <option value="autonomo_tac">Motorista Autônomo TAC (Crédito Presumido)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Gastos c/ Diesel, Arla e Pneus (R$)
                    </label>
                    <input
                      type="number"
                      step="1000"
                      value={taxDieselTireSpend}
                      onChange={(e) => setTaxDieselTireSpend(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-emerald-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Despesas TI (TMS), GR, Energia e Escritório (R$)
                    </label>
                    <input
                      type="number"
                      step="500"
                      value={taxAdminTechSpend}
                      onChange={(e) => setTaxAdminTechSpend(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-cyan-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Investimento em Frota / Caminhões no Mês (R$)
                    </label>
                    <input
                      type="number"
                      step="5000"
                      value={taxTruckPurchaseSpend}
                      onChange={(e) => setTaxTruckPurchaseSpend(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-amber-400 outline-none"
                    />
                  </div>
                </div>

                {/* Comparativo Lado a Lado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coluna 1: Sistema Atual */}
                  <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Cenário 1 • Legislação Atual</span>
                        <h3 className="text-base font-black text-white">HOJE: ICMS ({taxIcmsRate}%) + PIS/COFINS (9,25%)</h3>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                        Lucro Real
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>ICMS Destacado ({taxIcmsRate}%):</span>
                        <span className="font-bold">R$ {taxSimResults.currentIcmsNominal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>(-) Benefício Crédito Presumido 20% (Conv. 106/96):</span>
                        <span className="font-bold">- R$ {taxSimResults.currentIcmsPresumedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800/60">
                        <span>PIS/COFINS Débito (9,25%):</span>
                        <span className="font-bold">R$ {taxSimResults.currentPisCofinsDebit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>(-) Créditos PIS/COFINS ({taxFleetModel === 'frota_propria' ? 'Insumos + 1/48 Frota' : 'Presumido TAC 6,9375%'}):</span>
                        <span className="font-bold">- R$ {taxSimResults.currentPisCofinsCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-rose-400 pt-1 border-t border-slate-800/60">
                        <span>⚠️ Créditos Perdidos (TI, GR, Escritório vedados hoje):</span>
                        <span className="font-bold">R$ {taxSimResults.currentLostAdminCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Total Líquido a Recolher Hoje:</span>
                      <span className="text-lg font-black text-white">
                        R$ {taxSimResults.currentTotalTaxPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Coluna 2: Pós-Reforma */}
                  <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-700/50 space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-800/40 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-400 block">Cenário 2 • Pós-Reforma (2033)</span>
                        <h3 className="text-base font-black text-white">IVA DUAL: CBS + IBS ({taxIvaRate}% por fora)</h3>
                      </div>
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950">
                        Crédito Amplo
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-200">
                        <span>Débito de CBS + IBS sobre o Frete (Pago por fora):</span>
                        <span className="font-bold">R$ {taxSimResults.reformIvaDebit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>(-) Crédito Amplo (Diesel + TI/GR/Escritório + 100% Frota Imediato + TAC):</span>
                        <span className="font-bold">- R$ {taxSimResults.reformCreditsInputsAndAdmin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-cyan-300 pt-1 border-t border-amber-800/40">
                        <span>✅ Crédito Integral Transferido ao Cliente Embarcador:</span>
                        <span className="font-bold">R$ {taxSimResults.reformClientFullCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-emerald-300">
                        <span>✅ Recuperação de Frota (Caminhões):</span>
                        <span className="font-bold">Imediata (100% no mês, sem trava de 48x)</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-700/50 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-200">
                        {taxSimResults.reformNetTaxOrRefund >= 0 ? 'Saldo Líquido de IVA a Recolher:' : 'Saldo Credor Ressarcido em 30 dias:'}
                      </span>
                      <span className={`text-lg font-black ${taxSimResults.reformNetTaxOrRefund >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        R$ {Math.abs(taxSimResults.reformNetTaxOrRefund).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 4: TABELA RÁPIDA DE PESOS & CARRETAS */}
        {activeTab === 'tabela' && (
          <div className="max-w-5xl mx-auto bg-slate-950/70 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-violet-950/60 border border-violet-800/60 text-violet-300 text-xs font-bold mb-2">
                <Truck className="w-4 h-4 text-violet-400" />
                Referência Rápida de Implementos
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Guia Rápido de Veículos, Conjuntos e Aplicações
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Consulte a qualquer momento os diagramas visuais de cada conjunto, pesos por eixo, taras médias, capacidades e restrições para não errar no agendamento com os motoristas.
              </p>
            </div>

            {/* Atlas Visual Completo de Todos os 10 Conjuntos */}
            <VehicleCombinationsInteractiveAtlas />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-base">Carreta LS 3 Eixos (Trucada)</span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700/60">PBT 48,5 t</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-300">
                  <p>• <strong>Carga Líquida Útil:</strong> ≈ 32 toneladas (Graneleiro)</p>
                  <p>• <strong>Se for Caçamba:</strong> ≈ 28 a 30 toneladas (tara maior)</p>
                  <p>• <strong>Comprimento:</strong> Em torno de 16 a 18 metros</p>
                  <p>• <strong>Vantagem:</strong> Cabe em praticamente qualquer balança de armazém e porto.</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-base">Carreta LS 4 Eixos</span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700/60">PBT 58,5 t</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-300">
                  <p>• <strong>Carga Líquida Útil:</strong> ≈ 40 toneladas (Graneleiro)</p>
                  <p>• <strong>Se for Caçamba:</strong> ≈ 37 a 38 toneladas</p>
                  <p>• <strong>Tendência:</strong> Muito utilizada atualmente no agronegócio por não exigir cavalo com 6x4 obrigatório e levar quase a carga de um bitrem.</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-base">Bitrem / Bicaçamba (7 Eixos)</span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">PBT 57,0 t</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-300">
                  <p>• <strong>Carga Líquida Útil:</strong> ≈ 37 a 38 toneladas (Graneleiro)</p>
                  <p>• <strong>Bicaçamba:</strong> ≈ 35 a 36 toneladas (ideal para fertilizante)</p>
                  <p>• <strong>Comprimento:</strong> ≈ 19,80 metros</p>
                  <p>• <strong>Atenção:</strong> Duas carretas acopladas diretamente no pino rei.</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-base">Rodotrem / Rodocaçamba (9 Eixos)</span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/60">PBT 74,0 t</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-300">
                  <p>• <strong>Carga Líquida Útil:</strong> ≈ 48,5 a 50 toneladas</p>
                  <p>• <strong>Rodocaçamba:</strong> ≈ 47 a 49 toneladas</p>
                  <p>• <strong>Comprimento:</strong> Curto (19m) ou Alongado (25m a 30m)</p>
                  <p>• <strong>Alerta de Balança:</strong> Se o destino tiver balança menor que 25 metros, o rodotrem precisará desengatar para pesar cada carreta!</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 5: TESTE DE FIXAÇÃO (QUIZ COM FILTRO POR FASE 1, FASE 2 OU COMPLETO) */}
        {activeTab === 'quiz' && (
          <div className="max-w-3xl mx-auto bg-slate-950/70 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs font-bold mb-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Capacitação Profissional • Fase 1 & Fase 2
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Teste de Fixação do Embarcador
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Avalie seu domínio operacional (Fase 1) e seu conhecimento sobre tributos, créditos fiscais e Reforma Tributária (Fase 2).
                </p>
              </div>

              {quizSubmitted && (
                <div className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-right">
                  <span className="text-xs text-slate-400 block font-bold">Sua Pontuação:</span>
                  <span className="text-2xl font-black text-violet-400">
                    {calculateScore()} / {filteredQuizQuestions.length} acertos ({Math.round((calculateScore() / (filteredQuizQuestions.length || 1)) * 100)}%)
                  </span>
                </div>
              )}
            </div>

            {/* Filtro de Fase do Quiz */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => { setQuizPhaseFilter('all'); setQuizSubmitted(false); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  quizPhaseFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Curso Completo ({QUIZ_QUESTIONS.length} questões)
              </button>
              <button
                type="button"
                onClick={() => { setQuizPhaseFilter(1); setQuizSubmitted(false); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  quizPhaseFilter === 1 ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Fase 1 • Operacional (5 questões)
              </button>
              <button
                type="button"
                onClick={() => { setQuizPhaseFilter(2); setQuizSubmitted(false); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  quizPhaseFilter === 2 ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 text-amber-400 hover:text-amber-300'
                }`}
              >
                Fase 2 • Tributos, Créditos & Reforma (7 questões)
              </button>
            </div>

            <div className="space-y-5">
              {filteredQuizQuestions.map((q, idx) => {
                const selectedOpt = quizAnswers[q.id];
                const isAnswered = selectedOpt !== undefined;
                const isCorrect = isAnswered && selectedOpt === q.correctIndex;

                return (
                  <div key={q.id} className="p-5 bg-slate-900/70 rounded-2xl border border-slate-800 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        q.phase === 1 ? 'bg-violet-950 text-violet-300' : 'bg-amber-950 text-amber-300'
                      }`}>
                        Fase {q.phase}
                      </span>
                    </div>
                    <p className="font-bold text-sm sm:text-base text-white">
                      {idx + 1}. {q.question}
                    </p>

                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => {
                        const isThisSelected = selectedOpt === optIdx;
                        let btnStyle = 'border-slate-800 hover:bg-slate-800/60 text-slate-300';
                        
                        if (quizSubmitted) {
                          if (optIdx === q.correctIndex) {
                            btnStyle = 'bg-emerald-950/40 border-emerald-500 text-emerald-200 font-bold';
                          } else if (isThisSelected && optIdx !== q.correctIndex) {
                            btnStyle = 'bg-rose-950/40 border-rose-500 text-rose-200 font-bold';
                          }
                        } else if (isThisSelected) {
                          btnStyle = 'bg-violet-950/60 border-violet-500 text-violet-200 font-bold';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={quizSubmitted}
                            onClick={() => handleSelectQuizOption(q.id, optIdx)}
                            className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-between ${btnStyle}`}
                          >
                            <span>{opt}</span>
                            {quizSubmitted && optIdx === q.correctIndex && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className={`p-3 rounded-xl text-xs sm:text-sm mt-2 leading-relaxed ${isCorrect ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/40' : 'bg-amber-950/30 text-amber-300 border border-amber-800/40'}`}>
                        <strong>Explicação Oficial: </strong>{q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              {quizSubmitted ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuizSubmitted(false);
                    setQuizAnswers({});
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refazer Teste</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={filteredQuizQuestions.some(q => quizAnswers[q.id] === undefined)}
                  onClick={() => setQuizSubmitted(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-black bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finalizar e Ver Resultados</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Mini Player Flutuante de Áudio no Rodapé (Mobile & Desktop) quando a Aula está Tocando */}
      {isPlayingAudio && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-slate-950/95 backdrop-blur-lg border-t-2 border-amber-500/80 px-3 sm:px-6 py-2.5 shadow-2xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={handleTogglePlayPause}
                className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md cursor-pointer"
                title={isPausedAudio ? 'Continuar Aula' : 'Pausar Aula'}
              >
                {isPausedAudio ? <Play className="w-4 h-4 fill-current ml-0.5" /> : <Pause className="w-4 h-4 fill-current" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-amber-400 truncate">
                    Mód. {currentChapter.number} • Parte {currentChunkIndex + 1}/{narrationChunks.length}
                  </span>
                </div>
                <p className="text-xs text-slate-200 truncate font-medium">
                  {narrationChunks[currentChunkIndex]?.text || currentChapter.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={currentChunkIndex <= 0}
                onClick={() => speakChunkAtIndex(Math.max(0, currentChunkIndex - 1))}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer"
                title="Trecho Anterior"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={currentChunkIndex >= narrationChunks.length - 1}
                onClick={() => speakChunkAtIndex(Math.min(narrationChunks.length - 1, currentChunkIndex + 1))}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer"
                title="Próximo Trecho"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const speeds = [1.0, 1.25, 1.5, 2.0];
                  const nextIdx = (speeds.indexOf(audioSpeed) + 1) % speeds.length;
                  handleChangeSpeed(speeds[nextIdx]);
                }}
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-amber-500/50 text-amber-300 text-[10px] font-black cursor-pointer"
                title="Alternar Velocidade"
              >
                {audioSpeed}x
              </button>
              <button
                type="button"
                onClick={stopAudio}
                className="p-2 rounded-lg bg-rose-950/60 border border-rose-700/60 text-rose-300 hover:bg-rose-900/60 cursor-pointer"
                title="Parar Narração"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé Fixo */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-4 sm:px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">Material Oficial Auditado:</span>
            <span>Curso para Embarcador (Fase 1 Operacional + Fase 2 Tributos & Reforma Tributária EC 132/2023 e LC 214/2025) • DLLOG Transportes</span>
          </div>

          <div className="flex items-center gap-3">
            {isStudentOnly && onLogout ? (
              <button
                onClick={() => {
                  stopAudio();
                  onLogout();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-950/60 transition-colors cursor-pointer"
              >
                Sair da Conta
              </button>
            ) : (
              <button
                onClick={handleCloseOrBack}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Concluir e Voltar
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ShipperCoursePage;
