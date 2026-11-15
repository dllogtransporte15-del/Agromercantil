import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, 
  Send, 
  Search, 
  Paperclip, 
  Phone, 
  User as UserIcon, 
  Check, 
  CheckCheck, 
  Clock, 
  ExternalLink, 
  FileText, 
  Image as ImageIcon, 
  Plus, 
  RefreshCw, 
  X, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  Trash2, 
  Copy, 
  FileCheck2,
  ChevronRight,
  UserPlus,
  Move,
  GripHorizontal,
  Layers,
  Minus,
  Play,
  Pause,
  Volume2,
  Mic,
  Download,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileSpreadsheet,
  FileArchive,
  File as FileGenericIcon,
  Smile
} from 'lucide-react';
import type { WhatsAppChat, WhatsAppChatMessage, WhatsAppTemplate } from '../../types/whatsapp';
import type { User as UserType } from '../../types';
import { 
  getWhatsAppChats, 
  getWhatsAppChatMessages, 
  sendDirectChatMessage, 
  createOrGetChat, 
  deleteWhatsAppChat, 
  getWhatsAppTemplates,
  syncAllWhatsAppConversationsAndHistory,
  clearWhatsAppHistoryData,
  getWhatsAppInstance,
  formatDisplayPhone,
  sanitizePhoneNumber,
  arePhoneNumbersEqual,
  subscribeToWhatsAppRealtime,
  broadcastWhatsAppEvent
} from '../../services/whatsappService';

// =========================================================================
// CATÁLOGO DE EMOJIS RÁPIDOS ESTILO WHATSAPP WEB
// =========================================================================
const EMOJI_CATEGORIES = [
  { name: 'Populares', emojis: ['👍', '🤝', '✅', '🚛', '📦', '📍', '💰', '📄', '📞', '⛽', '🙏', '😊'] },
  { name: 'Rostos & Expressões', emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '😎', '🤝', '🙌', '👍', '👏', '💪', '🙏'] },
  { name: 'Logística & Frota', emojis: ['🚛', '🚚', '🚜', '🚗', '📦', '📍', '🗺️', '⛽', '🛣️', '🏢', '🏗️', '🚢', '🧭', '🚨', '🛑', '⏳'] },
  { name: 'Documentos & Valores', emojis: ['📄', '📑', '🧾', '💰', '💵', '💳', '🏦', '✅', '❌', '⚠️', '🕒', '🔒', '🔑', '📊', '📈'] }
];
const ChatAudioPlayer: React.FC<{
  mediaUrl?: string;
  duration?: number;
  isMe: boolean;
}> = ({ mediaUrl, duration = 0, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 15);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (mediaUrl) {
      const audio = new Audio(mediaUrl);
      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setTotalDuration(Math.round(audio.duration));
        }
      };
      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      audioRef.current = audio;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mediaUrl]);

  const togglePlay = () => {
    if (audioRef.current && mediaUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          simulateToneFallback();
        });
      }
    } else {
      simulateToneFallback();
    }
  };

  const simulateToneFallback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setIsPlaying(true);
      const targetDuration = totalDuration || 15;
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= targetDuration) {
            clearInterval(intervalRef.current);
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.5 * playbackRate;
        });
      }, 500);
    }
  };

  const handleRateChange = () => {
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  return (
    <div className={`p-2.5 rounded-2xl flex flex-col gap-1.5 min-w-[240px] sm:min-w-[270px] ${
      isMe 
        ? 'bg-emerald-950/60 border border-emerald-500/30 text-white' 
        : 'bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
    }`}>
      <div className="flex items-center gap-3">
        {/* BOTÃO PLAY / PAUSE */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer flex-shrink-0"
          title={isPlaying ? 'Pausar áudio' : 'Ouvir áudio'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* BARRAS DE FREQUÊNCIA / PROGRESSO */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-0.5 h-5 cursor-pointer">
            {[35, 65, 25, 90, 60, 40, 80, 100, 70, 35, 75, 95, 50, 85, 30, 60, 90, 45, 70, 85].map((h, i) => {
              const barProgress = (i / 20) * 100;
              const isPassed = progressPercent >= barProgress;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-150 ${
                    isPassed
                      ? 'bg-emerald-400 h-full'
                      : isMe
                      ? 'bg-emerald-800/60'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] opacity-75 font-mono">
            <span className="flex items-center gap-1">
              <Mic className="w-2.5 h-2.5 text-emerald-400" />
              {formatTime(currentTime)}
            </span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* VELOCIDADE (1x, 1.5x, 2x) */}
        <button
          type="button"
          onClick={handleRateChange}
          className="px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-black/20 hover:bg-black/30 text-emerald-400 border border-emerald-500/20 cursor-pointer transition-colors"
          title="Alterar velocidade de reprodução"
        >
          {playbackRate}x
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-COMPONENTE: CARD DE DOCUMENTO DO CHAT
// =========================================================================
const ChatDocumentCard: React.FC<{
  filename: string;
  mediaUrl?: string;
  size?: string;
  isMe: boolean;
  onPreview: (url: string, filename: string) => void;
}> = ({ filename, mediaUrl, size, isMe, onPreview }) => {
  const ext = (filename.split('.').pop() || 'file').toLowerCase();
  
  const getIconAndColor = () => {
    if (ext === 'pdf') {
      return { icon: <FileText className="w-5 h-5 text-rose-400" />, bg: 'bg-rose-500/20 border-rose-500/30' };
    }
    if (ext === 'doc' || ext === 'docx') {
      return { icon: <FileText className="w-5 h-5 text-amber-400" />, bg: 'bg-amber-500/20 border-amber-500/30' };
    }
    if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
      return { icon: <FileSpreadsheet className="w-5 h-5 text-emerald-400" />, bg: 'bg-emerald-500/20 border-emerald-500/30' };
    }
    if (ext === 'zip' || ext === 'rar' || ext === '7z') {
      return { icon: <FileArchive className="w-5 h-5 text-amber-400" />, bg: 'bg-amber-500/20 border-amber-500/30' };
    }
    return { icon: <FileGenericIcon className="w-5 h-5 text-slate-300" />, bg: 'bg-slate-500/20 border-slate-500/30' };
  };

  const { icon, bg } = getIconAndColor();

  return (
    <div className={`p-3 rounded-2xl flex items-center gap-3 border transition-all ${
      isMe 
        ? 'bg-emerald-950/60 border-emerald-500/30 text-white' 
        : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${bg}`}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold block truncate" title={filename}>
          {filename}
        </span>
        <span className="text-[10px] opacity-75 font-mono">
          {ext.toUpperCase()} • {size || 'Documento'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {mediaUrl && (
          <>
            <button
              type="button"
              onClick={() => onPreview(mediaUrl, filename)}
              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors cursor-pointer"
              title="Visualizar documento"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <a
              href={mediaUrl}
              download={filename}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-slate-700/40 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Baixar arquivo"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SUB-COMPONENTE: MODAL LIGHTBOX PARA IMAGENS & FIGURINHAS
// =========================================================================
const ChatLightboxModal: React.FC<{
  isOpen: boolean;
  url: string;
  filename?: string;
  isSticker?: boolean;
  onClose: () => void;
}> = ({ isOpen, url, filename, isSticker, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen]);

  if (!isOpen || !url) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-fade-in">
      {/* BARRA SUPERIOR DO LIGHTBOX */}
      <div className="w-full flex items-center justify-between text-white z-10 px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200 truncate max-w-xs">
            {filename || (isSticker ? 'Figurinha WhatsApp' : 'Visualizador de Imagem')}
          </span>
          {isSticker && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              Figurinha
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="Diminuir zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setRotation(prev => (prev + 90) % 360)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="Girar imagem"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <a
            href={url}
            download={filename || 'imagem_chat.png'}
            className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="Baixar imagem original"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ÁREA CENTRAL DE VISUALIZAÇÃO */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden w-full max-h-[85vh] cursor-grab active:cursor-grabbing"
        onClick={onClose}
      >
        <img
          src={url}
          alt={filename || 'Mídia'}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s ease-out'
          }}
          className={`max-w-full max-h-[80vh] object-contain select-none shadow-2xl ${
            isSticker ? 'drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]' : 'rounded-2xl border border-slate-700'
          }`}
        />
      </div>

      {/* RODAPÉ DO LIGHTBOX */}
      <div className="text-[11px] text-slate-400 pb-2">
        Zoom: {Math.round(zoom * 100)}% • Rotação: {rotation}° • Clique fora para fechar
      </div>
    </div>
  );
};

interface WhatsAppChatPanelProps {
  mode?: 'embedded' | 'modal' | 'floating';
  onClose?: () => void;
  onOpenFloating?: () => void;
  initialPhone?: string;
  initialName?: string;
  currentUser?: UserType | null;
}

export const WhatsAppChatPanel: React.FC<WhatsAppChatPanelProps> = ({
  mode = 'embedded',
  onClose,
  onOpenFloating,
  initialPhone,
  initialName,
  currentUser
}) => {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppChatMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Estados estilo WhatsApp Web (Gravação de Voz, Emojis e Busca na Conversa)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Refs de estado para evitar closures desatualizadas nos listeners do Realtime
  const selectedChatRef = useRef<WhatsAppChat | null>(null);
  const chatsRef = useRef<WhatsAppChat[]>([]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // Gravação de Áudio ao vivo no microfone
  const startAudioRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Seu navegador não suporta gravação de áudio.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões do seu navegador.');
    }
  };

  const stopAndSendAudioRecording = async () => {
    if (!mediaRecorderRef.current || !selectedChat) return;
    const currentDuration = recordingSeconds || 1;

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        const senderDisplayName = currentUser?.name
          ? `${currentUser.name} (${currentUser.profile || 'Administrador do Sistema'})`
          : 'Administrador do Sistema';

        setSending(true);
        try {
          const newMsg = await sendDirectChatMessage({
            recipientPhone: selectedChat.phone_number,
            recipientName: selectedChat.name,
            senderName: senderDisplayName,
            text: 'Mensagem de voz 🎤',
            messageType: 'audio',
            mediaUrl: base64Audio,
            mediaDuration: currentDuration
          });

          setMessages(prev => [...prev, newMsg]);
          const updatedChats = await getWhatsAppChats();
          setChats(updatedChats);
        } catch (err) {
          console.error('Erro ao despachar áudio de voz:', err);
        } finally {
          setSending(false);
        }
      };

      mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorderRef.current.stop();
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current) {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
      audioChunksRef.current = [];
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  const handleCopyMessageText = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setSyncFeedback('Texto da mensagem copiado!');
    setTimeout(() => setSyncFeedback(null), 2000);
  };

  // Função auxiliar para tocar um chime de mensagem recebida em tempo real
  const playIncomingChime = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch { /* ignore */ }
  };

  // Estados de Manipulação da Janela Flutuante (Arrastar & Redimensionar)
  const [isFloatingActive, setIsFloatingActive] = useState(mode === 'floating' || mode === 'modal');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const startX = Math.max(20, Math.floor((window.innerWidth - 920) / 2));
      const startY = Math.max(40, Math.floor((window.innerHeight - 680) / 2));
      return { x: startX, y: startY };
    }
    return { x: 100, y: 80 };
  });

  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      const initialW = Math.min(960, Math.max(500, window.innerWidth - 80));
      const initialH = Math.min(720, Math.max(450, window.innerHeight - 100));
      return { width: initialW, height: initialH };
    }
    return { width: 920, height: 680 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number; posX: number; posY: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    posX: 0,
    posY: 0
  });

  const [isInstanceConnected, setIsInstanceConnected] = useState<boolean>(false);
  const [connectedPhoneNumber, setConnectedPhoneNumber] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string;
    filename?: string;
    isSticker?: boolean;
  } | null>(null);

  const handlePreviewDocument = (url: string, filename: string) => {
    if (url.startsWith('data:image') || filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      setLightboxMedia({ url, filename, isSticker: false });
    } else {
      window.open(url, '_blank');
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    setLoadingChats(true);
    try {
      const instance = await getWhatsAppInstance();
      const connected = instance.status === 'connected' && Boolean(instance.phone_number);
      setIsInstanceConnected(connected);
      setConnectedPhoneNumber(instance.phone_number || null);

      if (!connected) {
        setChats([]);
        setSelectedChat(null);
        setMessages([]);
        return;
      }

      const chatList = await getWhatsAppChats();
      setChats(chatList);

      if (initialPhone) {
        const clean = sanitizePhoneNumber(initialPhone);
        let found = chatList.find(c => sanitizePhoneNumber(c.phone_number) === clean);
        if (!found) {
          found = await createOrGetChat(clean, initialName);
          setChats(prev => [found!, ...prev]);
        }
        setSelectedChat(found);
      } else if (!selectedChat && chatList.length > 0) {
        setSelectedChat(chatList[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar conversas de WhatsApp:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleFullSync = async () => {
    const instance = await getWhatsAppInstance();
    const connected = instance.status === 'connected' && Boolean(instance.phone_number);
    setIsInstanceConnected(connected);
    setConnectedPhoneNumber(instance.phone_number || null);

    if (!connected) {
      setChats([]);
      setSelectedChat(null);
      setMessages([]);
      setSyncFeedback('WhatsApp Desconectado! Conecte um número via QR Code para sincronizar.');
      setTimeout(() => setSyncFeedback(null), 4000);
      return;
    }

    setSyncingHistory(true);
    setSyncFeedback(null);
    try {
      const result = await syncAllWhatsAppConversationsAndHistory({ limit: 150 });
      if (result.success && result.chatsCount > 0) {
        setChats(result.chats);
        if (result.chats.length > 0 && !selectedChat) {
          setSelectedChat(result.chats[0]);
        }
        setSyncFeedback(`Sincronizado! ${result.chatsCount} conversas atualizadas.`);
      } else {
        await loadChats();
        setSyncFeedback('Conversas atualizadas!');
      }
    } catch (err) {
      console.error('Erro ao sincronizar histórico completo:', err);
      await loadChats();
    } finally {
      setSyncingHistory(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleClearAllHistory = () => {
    if (chats.length === 0) return;
    if (window.confirm('Deseja realmente excluir todo o histórico de conversas da tela?')) {
      clearWhatsAppHistoryData();
      setChats([]);
      setSelectedChat(null);
      setMessages([]);
      setSyncFeedback('Histórico de conversas excluído da tela!');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  const loadTemplates = async () => {
    try {
      const tpls = await getWhatsAppTemplates();
      setTemplates(tpls.filter(t => t.is_active));
    } catch (err) {
      console.warn('Erro ao carregar templates:', err);
    }
  };

  // =========================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL (REALTIME HUB MULTI-USUÁRIOS)
  // =========================================================================
  useEffect(() => {
    loadChats();
    loadTemplates();

    // Inscrição no canal Realtime do Supabase (Broadcasts + Postgres Changes)
    const unsubscribeRealtime = subscribeToWhatsAppRealtime((event, payload) => {
      if (event === 'chat_message_sent' && payload?.message) {
        const incomingMsg = payload.message as WhatsAppChatMessage;
        const cleanMsgPhone = sanitizePhoneNumber(incomingMsg.remote_jid.replace(/@.+$/, '')) || incomingMsg.remote_jid;
        const currentActiveChat = selectedChatRef.current;

        // 1. Se a mensagem pertencer à conversa atualmente aberta na tela
        if (currentActiveChat && arePhoneNumbersEqual(currentActiveChat.phone_number, cleanMsgPhone)) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === incomingMsg.id || (m.from_me === incomingMsg.from_me && (m.text || '').trim() === (incomingMsg.text || '').trim() && Math.abs(new Date(m.timestamp).getTime() - new Date(incomingMsg.timestamp).getTime()) < 15000));
            if (exists) return prev;
            return [...prev, incomingMsg];
          });
          if (!incomingMsg.from_me) {
            playIncomingChime();
          }
          setTimeout(scrollToBottom, 50);
        }

        // 2. Atualiza a lista lateral de conversas em tempo real para todos
        setChats(prev => {
          const chatIdx = prev.findIndex(c => arePhoneNumbersEqual(c.phone_number, cleanMsgPhone));
          const isCurrentSelected = currentActiveChat && arePhoneNumbersEqual(currentActiveChat.phone_number, cleanMsgPhone);

          if (chatIdx >= 0) {
            const targetChat = prev[chatIdx];
            const updatedChat: WhatsAppChat = {
              ...targetChat,
              last_message: {
                id: incomingMsg.id,
                text: incomingMsg.text || (incomingMsg.media_filename ? `[Arquivo: ${incomingMsg.media_filename}]` : 'Mensagem enviada'),
                timestamp: incomingMsg.timestamp,
                from_me: incomingMsg.from_me,
                status: incomingMsg.status
              },
              unread_count: isCurrentSelected ? 0 : ((targetChat.unread_count || 0) + (incomingMsg.from_me ? 0 : 1)),
              updated_at: incomingMsg.timestamp
            };
            const copy = [...prev];
            copy.splice(chatIdx, 1);
            return [updatedChat, ...copy];
          } else if (payload?.chat) {
            return [payload.chat, ...prev];
          } else {
            const newChat: WhatsAppChat = {
              id: `chat_${cleanMsgPhone}`,
              remote_jid: incomingMsg.remote_jid,
              phone_number: cleanMsgPhone,
              name: incomingMsg.sender_name || `Contato (${formatDisplayPhone(cleanMsgPhone)})`,
              unread_count: isCurrentSelected ? 0 : (incomingMsg.from_me ? 0 : 1),
              last_message: {
                id: incomingMsg.id,
                text: incomingMsg.text,
                timestamp: incomingMsg.timestamp,
                from_me: incomingMsg.from_me,
                status: incomingMsg.status
              },
              updated_at: incomingMsg.timestamp
            };
            return [newChat, ...prev];
          }
        });
      } else if (event === 'chat_created' && payload?.chat) {
        const newChat = payload.chat as WhatsAppChat;
        setChats(prev => {
          const exists = prev.some(c => arePhoneNumbersEqual(c.phone_number, newChat.phone_number));
          return exists ? prev : [newChat, ...prev];
        });
      } else if (event === 'chat_deleted' && payload?.phoneNumber) {
        const deletedPhone = payload.phoneNumber;
        setChats(prev => prev.filter(c => !arePhoneNumbersEqual(c.phone_number, deletedPhone)));
        if (selectedChatRef.current && arePhoneNumbersEqual(selectedChatRef.current.phone_number, deletedPhone)) {
          setSelectedChat(null);
          setMessages([]);
        }
      } else if (event === 'instance_status_changed' && payload?.instance) {
        const inst = payload.instance;
        const connected = inst.status === 'connected' && Boolean(inst.phone_number);
        setIsInstanceConnected(connected);
        setConnectedPhoneNumber(inst.phone_number || null);
        if (!connected) {
          setChats([]);
          setSelectedChat(null);
          setMessages([]);
        } else {
          loadChats();
        }
      } else if (event === 'chat_history_synced') {
        if (payload?.chats && Array.isArray(payload.chats)) {
          setChats(payload.chats);
        } else {
          loadChats();
        }
        if (selectedChatRef.current) {
          getWhatsAppChatMessages(selectedChatRef.current.phone_number).then(setMessages).catch(() => {});
        }
      } else if (event === 'chats_cleared') {
        setChats([]);
        setSelectedChat(null);
        setMessages([]);
      }
    });

    const handleExternalSync = () => {
      loadChats();
    };

    const handleDisconnected = () => {
      setIsInstanceConnected(false);
      setConnectedPhoneNumber(null);
      setChats([]);
      setSelectedChat(null);
      setMessages([]);
      setLoadingChats(false);
    };

    window.addEventListener('transcunha:whatsapp_history_synced', handleExternalSync);
    window.addEventListener('transcunha:whatsapp_disconnected', handleDisconnected);

    return () => {
      unsubscribeRealtime();
      window.removeEventListener('transcunha:whatsapp_history_synced', handleExternalSync);
      window.removeEventListener('transcunha:whatsapp_disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      const loadMsgs = async () => {
        setLoadingMessages(true);
        try {
          const msgs = await getWhatsAppChatMessages(selectedChat.phone_number);
          setMessages(msgs);
        } catch (err) {
          console.error('Erro ao buscar mensagens do chat:', err);
        } finally {
          setLoadingMessages(false);
        }
      };
      loadMsgs();

      // Polling automático de mensagens em segundo plano enquanto a conversa está aberta (a cada 2s)
      const pollInterval = setInterval(async () => {
        try {
          const latestMsgs = await getWhatsAppChatMessages(selectedChat.phone_number);
          if (selectedChatRef.current && arePhoneNumbersEqual(selectedChatRef.current.phone_number, selectedChat.phone_number)) {
            setMessages(prev => {
              if (latestMsgs.length === prev.length) {
                const lastPrev = prev[prev.length - 1]?.id;
                const lastNew = latestMsgs[latestMsgs.length - 1]?.id;
                if (lastPrev === lastNew) return prev;
              }
              return latestMsgs;
            });
          }
        } catch { /* ignore background poll errors */ }
      }, 2000);

      return () => clearInterval(pollInterval);
    } else {
      setMessages([]);
    }
  }, [selectedChat?.phone_number]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingMessages]);

  // =========================================================================
  // LOGICA DE ARRASTAR (DRAG) & REDIMENSIONAR (RESIZE)
  // =========================================================================

  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if (isMaximized || mode === 'embedded') return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;

    setIsDragging(true);
    setDragStartOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseDownResize = (e: React.MouseEvent, direction: string) => {
    if (isMaximized || mode === 'embedded') return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(10, Math.min(window.innerWidth - 200, e.clientX - dragStartOffset.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragStartOffset.y));
      setPosition({ x: newX, y: newY });
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;

      if (isResizing.includes('e')) {
        newWidth = Math.max(480, Math.min(window.innerWidth - position.x - 20, resizeStart.width + deltaX));
      }
      if (isResizing.includes('s')) {
        newHeight = Math.max(420, Math.min(window.innerHeight - position.y - 20, resizeStart.height + deltaY));
      }

      setSize({ width: newWidth, height: newHeight });
    }
  }, [isDragging, isResizing, dragStartOffset, resizeStart, position.x, position.y]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // =========================================================================
  // ENVIO DE MENSAGENS & CRIAÇÃO DE CHATS
  // =========================================================================

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !selectedChat || sending) return;

    const messageText = inputText.trim();
    let mediaUrl: string | undefined = undefined;
    let mediaFilename: string | undefined = undefined;

    if (selectedFile) {
      mediaFilename = selectedFile.name;
      mediaUrl = URL.createObjectURL(selectedFile);
    }

    const senderDisplayName = currentUser?.name
      ? `${currentUser.name} (${currentUser.profile || 'Administrador do Sistema'})`
      : 'Administrador do Sistema';

    setSending(true);
    try {
      const newMsg = await sendDirectChatMessage({
        recipientPhone: selectedChat.phone_number,
        recipientName: selectedChat.name,
        senderName: senderDisplayName,
        text: messageText,
        mediaUrl,
        mediaFilename
      });

      setMessages(prev => {
        const exists = prev.some(m => m.id === newMsg.id || (m.from_me === newMsg.from_me && (m.text || '').trim() === (newMsg.text || '').trim() && Math.abs(new Date(m.timestamp).getTime() - new Date(newMsg.timestamp).getTime()) < 15000));
        return exists ? prev : [...prev, newMsg];
      });
      setInputText('');
      setSelectedFile(null);

      const updatedChats = await getWhatsAppChats();
      setChats(updatedChats);
    } catch (err) {
      console.error('Erro ao despachar mensagem no chat:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setInputText(prev => prev ? `${prev}\n\n${template.body_text}` : template.body_text);
    setShowTemplatesDropdown(false);
  };

  const handleCreateNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatPhone.trim()) return;

    const cleanPhone = sanitizePhoneNumber(newChatPhone);
    const created = await createOrGetChat(cleanPhone, newChatName.trim() || undefined);
    
    setChats(prev => {
      const exists = prev.some(c => sanitizePhoneNumber(c.phone_number) === cleanPhone);
      return exists ? prev : [created, ...prev];
    });

    setSelectedChat(created);
    setShowNewChatModal(false);
    setNewChatPhone('');
    setNewChatName('');
  };

  const handleDeleteCurrentChat = async () => {
    if (!selectedChat) return;
    if (window.confirm(`Deseja realmente excluir a conversa com ${selectedChat.name}?`)) {
      await deleteWhatsAppChat(selectedChat.phone_number);
      const remaining = chats.filter(c => c.phone_number !== selectedChat.phone_number);
      setChats(remaining);
      setSelectedChat(remaining.length > 0 ? remaining[0] : null);
      setMessages([]);
    }
  };

  const handleCopyPhone = () => {
    if (!selectedChat) return;
    navigator.clipboard.writeText(selectedChat.phone_number);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const filteredChats = chats.filter(chat => {
    const q = searchQuery.toLowerCase();
    return (
      chat.name.toLowerCase().includes(q) ||
      chat.phone_number.includes(q) ||
      (chat.last_message?.text && chat.last_message.text.toLowerCase().includes(q))
    );
  });

  // WIDGET MINIMIZADO FLUTUANTE
  if (isMinimized && mode !== 'embedded') {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-[999999] flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 text-white shadow-2xl border border-emerald-400/40 cursor-pointer hover:scale-105 transition-all animate-bounce-short select-none"
        title="Clique para restaurar a janela de WhatsApp"
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5 text-emerald-300" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
        </div>
        <div>
          <span className="text-xs font-black block">WhatsApp Ativo</span>
          <span className="text-[10px] text-emerald-200">{selectedChat ? selectedChat.name : `${chats.length} conversas`}</span>
        </div>
        <Maximize2 className="w-3.5 h-3.5 text-emerald-300 ml-1" />
      </div>
    );
  }

  // ESTILOS DINÂMICOS DA JANELA
  const isOverlayMode = mode === 'modal' || mode === 'floating';

  const windowStyle: React.CSSProperties = isOverlayMode
    ? isMaximized
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          zIndex: 999999,
          borderRadius: 0,
          margin: 0
        }
      : {
          position: 'fixed',
          top: `${position.y}px`,
          left: `${position.x}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: 999999,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.15)'
        }
    : {
        width: '100%',
        height: '720px'
      };

  return (
    <>
      {/* BACKDROP QUANDO MAXIMIZADO */}
      {isOverlayMode && isMaximized && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999998]" />
      )}

      <div 
        style={windowStyle}
        className={`flex flex-col bg-slate-50 dark:bg-slate-950 ${isMaximized ? 'rounded-none' : 'rounded-3xl'} overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl transition-shadow ${
          isDragging ? 'select-none opacity-95 ring-2 ring-emerald-500' : ''
        }`}
      >
        {/* BARRA DE TÍTULO SUPERIOR (COM SUPORTE A ARRASTAR / DRAG) */}
        <div 
          onMouseDown={handleMouseDownHeader}
          className={`px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between select-none ${
            isOverlayMode && !isMaximized ? 'cursor-move' : ''
          }`}
        >
          {/* LADO ESQUERDO: ÍCONE E TÍTULO */}
          <div className="flex items-center gap-2.5">
            {isOverlayMode && !isMaximized && (
              <div className="text-slate-400 hover:text-white p-1" title="Clique e arraste para mover a janela">
                <GripHorizontal className="w-4 h-4 text-emerald-400" />
              </div>
            )}
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                  Chat
                  <span 
                    className={`w-2 h-2 rounded-full ${isInstanceConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}
                    title={isInstanceConnected ? (connectedPhoneNumber ? `Conectado: ${formatDisplayPhone(connectedPhoneNumber)}` : 'Conectado') : 'Desconectado'}
                  ></span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs" title="Sincronização bidirecional em tempo real ativa entre Administrador do Sistema e todos os operadores">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Realtime Ativo
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                {selectedChat ? `Conversando com ${selectedChat.name}` : (isInstanceConnected ? 'Central de Atendimento & Mensagens em Tempo Real' : 'Sem aparelho conectado')}
              </span>
            </div>
          </div>

          {/* LADO DIREITO: CONTROLES DA JANELA (DESTACAR, MINIMIZAR, MAXIMIZAR, FECHAR) */}
          <div className="flex items-center gap-1.5">
            {/* SE ESTIVER EM MODO EMBEDDED, BOTÃO PARA DESTACAR JANELA FLUTUANTE */}
            {!isOverlayMode && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenFloating) onOpenFloating();
                  setIsFloatingActive(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Destacar esta conversa em uma Janela Flutuante que pode ser arrastada e redimensionada"
              >
                <Move className="w-3.5 h-3.5" />
                <span className="text-[11px]">Destacar Janela</span>
              </button>
            )}

            {isOverlayMode && (
              <>
                {/* BOTÃO MINIMIZAR */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Minimizar para canto da tela"
                >
                  <Minus className="w-4 h-4" />
                </button>

                {/* BOTÃO MAXIMIZAR / RESTAURAR */}
                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title={isMaximized ? 'Restaurar Janela Arrastável' : 'Maximizar Tela Inteira'}
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* BOTÃO FECHAR */}
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Fechar Janela"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* CORPO PRINCIPAL: 2 COLUNAS (LISTA DE CONVERSAS + ÁREA DO CHAT) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
          {/* COLUNA ESQUERDA: LISTA DE CONVERSAS */}
          <div className="w-full md:w-80 lg:w-88 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 flex-shrink-0">
            {/* CABEÇALHO DA LISTA */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  isInstanceConnected 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-xs font-black text-slate-800 dark:text-white leading-tight flex items-center gap-1.5">
                    Conversas
                    <span className={`w-1.5 h-1.5 rounded-full ${isInstanceConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                  </h2>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {isInstanceConnected
                      ? `${chats.length} chats • WhatsApp Web`
                      : 'Desconectado • Sem número'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleFullSync}
                  disabled={syncingHistory || !isInstanceConnected}
                  className="px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600/20 disabled:hover:text-emerald-600 dark:disabled:hover:text-emerald-300"
                  title={!isInstanceConnected ? "Conecte um número de WhatsApp via QR Code para sincronizar conversas" : "Sincronizar todo o histórico de conversas e mensagens com a nuvem do WhatsApp"}
                >
                  <RefreshCw className={`w-3 h-3 ${syncingHistory ? 'animate-spin' : ''}`} />
                  <span>{syncingHistory ? 'Sincronizando...' : 'Sincronizar'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAllHistory}
                  disabled={chats.length === 0}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800 transition-all flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Excluir / Limpar todo o histórico de conversas da tela"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  disabled={!isInstanceConnected}
                  className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!isInstanceConnected ? "Conecte o WhatsApp para abrir conversas" : "Nova Conversa"}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* FEEDBACK DE SINCRONIZAÇÃO */}
            {syncFeedback && (
              <div className="px-3 py-1.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium flex items-center justify-between animate-fade-in">
                <span>{syncFeedback}</span>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              </div>
            )}

            {/* BUSCA DE CONTATOS */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/40">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar conversa, grupo ou telefone..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* LISTA ROLÁVEL DE CONVERSAS */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
              {loadingChats ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                  <span className="text-xs">Carregando conversas do WhatsApp...</span>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {!isInstanceConnected ? 'WhatsApp Desconectado' : 'Nenhuma conversa encontrada'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {!isInstanceConnected 
                      ? 'Conecte um aparelho via QR Code no painel para carregar e sincronizar conversas.'
                      : 'Sincronize com a nuvem ou inicie um novo chat.'}
                  </p>
                  {isInstanceConnected && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={handleFullSync}
                        disabled={syncingHistory || !isInstanceConnected}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Sincronizar Histórico
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredChats.map(chat => {
                  const isSelected = selectedChat?.phone_number === chat.phone_number;
                  const initials = chat.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                  const timeFormatted = chat.last_message?.timestamp 
                    ? new Date(chat.last_message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <button
                      key={chat.id || chat.phone_number}
                      type="button"
                      onClick={() => setSelectedChat(chat)}
                      className={`w-full text-left p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-l-4 border-emerald-500' 
                          : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* AVATAR COM SUPORTE A FOTO REAL */}
                      <div className="relative flex-shrink-0">
                        {chat.profile_pic_url ? (
                          <img 
                            src={chat.profile_pic_url} 
                            alt={chat.name} 
                            className="w-9 h-9 rounded-full object-cover border border-slate-600/40 shadow-sm"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className={`w-9 h-9 rounded-full ${chat.is_group ? 'bg-gradient-to-br from-amber-700 to-slate-900' : 'bg-gradient-to-br from-slate-700 to-slate-900'} border border-slate-600/40 text-white flex items-center justify-center font-bold text-xs shadow-sm`}>
                            {initials || (chat.is_group ? <Layers className="w-4 h-4 text-amber-300" /> : <UserIcon className="w-4 h-4 text-slate-300" />)}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                      </div>

                      {/* DETALHES DA CONVERSA */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1">
                            {chat.name}
                            {chat.is_group && (
                              <span className="px-1 py-0.2 rounded text-[8px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Grupo
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">
                            {timeFormatted}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                          {chat.is_group ? 'Grupo do WhatsApp' : formatDisplayPhone(chat.phone_number)}
                        </span>

                        <div className="flex items-center justify-between gap-1 mt-1">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                            {chat.last_message?.from_me && (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            )}
                            <span className="truncate">{chat.last_message?.text || 'Sem mensagens'}</span>
                          </p>
                          {chat.unread_count && chat.unread_count > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white flex-shrink-0">
                              {chat.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: JANELA DO CHAT (MENSAGENS + ENVIADOR) */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-100/70 dark:bg-[#0b1120] relative">
            {selectedChat ? (
              <>
                {/* CABEÇALHO DO CHAT ATIVO */}
                <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm z-10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {selectedChat.profile_pic_url ? (
                      <img 
                        src={selectedChat.profile_pic_url} 
                        alt={selectedChat.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-600/40 shadow-sm flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={`w-9 h-9 rounded-full ${selectedChat.is_group ? 'bg-amber-600/20 border-amber-500/40 text-amber-400' : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'} border flex items-center justify-center font-black text-xs flex-shrink-0`}>
                        {selectedChat.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                          {selectedChat.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          WhatsApp Conectado
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{selectedChat.is_group ? 'Grupo' : formatDisplayPhone(selectedChat.phone_number)}</span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={handleCopyPhone}
                          className="hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Copiar número de telefone"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copyFeedback ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* AÇÕES RÁPIDAS NO TOPO DO CHAT */}
                  <div className="flex items-center gap-1.5">
                    {/* BUSCA NA CONVERSA */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchingInChat(!isSearchingInChat);
                        if (isSearchingInChat) setChatSearchQuery('');
                      }}
                      className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                        isSearchingInChat 
                          ? 'bg-emerald-600 text-white' 
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title="Pesquisar mensagens nesta conversa"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={`https://wa.me/${selectedChat.phone_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                      title="Abrir no WhatsApp Web Oficial"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="hidden sm:inline text-[11px]">WhatsApp Web</span>
                    </a>

                    <button
                      type="button"
                      onClick={async () => {
                        setLoadingMessages(true);
                        try {
                          await syncAllWhatsAppConversationsAndHistory({ limit: 150 });
                          loadChats();
                          const msgs = await getWhatsAppChatMessages(selectedChat.phone_number);
                          setMessages(msgs);
                        } catch (err) {
                          console.error('Erro ao recarregar mensagens:', err);
                        } finally {
                          setLoadingMessages(false);
                        }
                      }}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Sincronizar e atualizar mensagens do WhatsApp"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteCurrentChat}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Excluir histórico desta conversa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* BARRA DE BUSCA INTERNA DE MENSAGENS */}
                {isSearchingInChat && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 animate-fade-in">
                    <Search className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <input
                      type="text"
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      placeholder="Pesquisar texto, valores, placas ou comprovantes nesta conversa..."
                      className="flex-1 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      autoFocus
                    />
                    {chatSearchQuery && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {messages.filter(m => m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase())).length} resultados
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchingInChat(false);
                        setChatSearchQuery('');
                      }}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Fechar pesquisa"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* HISTÓRICO DE MENSAGENS */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 relative bg-[#efeae2]/40 dark:bg-[#0c1317]">
                  <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"></div>

                  {loadingMessages ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                      <span className="text-xs">Carregando histórico do WhatsApp...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Nenhuma mensagem nesta conversa ainda</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Envie uma mensagem abaixo ou utilize um modelo de disparo rápido.</p>
                      </div>
                    </div>
                  ) : (
                    messages
                      .filter(m => !chatSearchQuery || m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                      .map((msg, index) => {
                      const isMe = msg.from_me;
                      const timeString = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div
                          key={msg.id || index}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in group`}
                        >
                          <div
                            className={`max-w-[88%] sm:max-w-[75%] rounded-2xl p-3 shadow-md relative ${
                              isMe
                                ? 'bg-[#005c4b] text-white rounded-tr-none border border-emerald-600/30'
                                : 'bg-white dark:bg-[#202c33] text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700/60 shadow-xs'
                            }`}
                          >
                            {/* REMETENTE DA MENSAGEM */}
                            <div className="flex items-center justify-between gap-2 mb-1">
                              {!isMe ? (
                                <span className="text-[10px] font-bold text-emerald-400 block truncate">
                                  {msg.sender_name || selectedChat.name}
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold text-emerald-200/90 flex items-center gap-1">
                                  <UserIcon className="w-2.5 h-2.5" />
                                  <span className="truncate max-w-[180px]">{msg.sender_name || 'Administrador do Sistema'}</span>
                                </span>
                              )}

                              {/* BOTÃO COPIAR MENSAGEM */}
                              {msg.text && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyMessageText(msg.text)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-white transition-opacity"
                                  title="Copiar texto da mensagem"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>

                            {/* 1. MENSAGEM DE FIGURINHA (STICKER) */}
                            {msg.media_type === 'sticker' ? (
                              <div className="flex flex-col items-start gap-1">
                                {msg.media_url ? (
                                  <div 
                                    onClick={() => setLightboxMedia({ url: msg.media_url!, isSticker: true })}
                                    className="p-1 rounded-2xl cursor-pointer hover:scale-105 transition-transform duration-200"
                                    title="Figurinha WhatsApp - Clique para ampliar"
                                  >
                                    <img 
                                      src={msg.media_url} 
                                      alt="Figurinha" 
                                      className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-md" 
                                    />
                                  </div>
                                ) : (
                                  <div className="p-3 rounded-2xl bg-black/20 border border-white/10 flex items-center gap-2 text-xs">
                                    <Smile className="w-5 h-5 text-amber-400" />
                                    <span>Figurinha WhatsApp</span>
                                  </div>
                                )}
                              </div>
                            ) : msg.media_type === 'audio' || msg.text?.includes('Mensagem de voz') ? (
                              /* 2. MENSAGEM DE ÁUDIO / GRAVAÇÃO DE VOZ */
                              <div className="flex flex-col gap-1">
                                <ChatAudioPlayer 
                                  mediaUrl={msg.media_url} 
                                  duration={msg.media_duration} 
                                  isMe={isMe} 
                                />
                                {msg.text && !msg.text.includes('Mensagem de voz') && !msg.text.includes('🎤') && (
                                  <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words mt-1">
                                    {msg.text}
                                  </p>
                                )}
                              </div>
                            ) : msg.media_type === 'image' || (msg.media_url && (msg.media_url.startsWith('data:image') || msg.media_url.match(/\.(jpg|jpeg|png|webp|gif)$/i))) ? (
                              /* 3. MENSAGEM DE IMAGEM / FOTO */
                              <div className="flex flex-col gap-1.5">
                                {msg.media_url && (
                                  <div 
                                    onClick={() => setLightboxMedia({ 
                                      url: msg.media_url!, 
                                      filename: msg.media_filename || 'imagem.jpg', 
                                      isSticker: false 
                                    })}
                                    className="relative group rounded-xl overflow-hidden border border-white/10 cursor-pointer max-w-[280px] sm:max-w-[320px] bg-black/20"
                                    title="Clique para visualizar em tela cheia com zoom"
                                  >
                                    <img
                                      src={msg.media_url}
                                      alt={msg.text || 'Foto'}
                                      className="w-full max-h-64 object-cover group-hover:scale-105 transition-transform duration-200"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                      <span className="px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-xs shadow-lg">
                                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                        Visualizar
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {msg.text && !msg.text.startsWith('📷 Foto') && (
                                  <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words">
                                    {msg.text}
                                  </p>
                                )}
                              </div>
                            ) : msg.media_type === 'document' || msg.media_filename ? (
                              /* 4. MENSAGEM DE DOCUMENTO / ARQUIVO (PDF, DOCX, XLSX, ETC.) */
                              <div className="flex flex-col gap-1.5">
                                <ChatDocumentCard
                                  filename={msg.media_filename || msg.text || 'Documento.pdf'}
                                  mediaUrl={msg.media_url}
                                  size={msg.media_size}
                                  isMe={isMe}
                                  onPreview={handlePreviewDocument}
                                />
                                {msg.text && !msg.text.startsWith('📄') && msg.text !== msg.media_filename && (
                                  <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words mt-1">
                                    {msg.text}
                                  </p>
                                )}
                              </div>
                            ) : (
                              /* 5. MENSAGEM DE TEXTO PADRÃO */
                              <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words">
                                {msg.text}
                              </p>
                            )}

                            <div className="flex items-center justify-end gap-1 mt-1.5 -mb-0.5 text-[10px] opacity-75">
                              <span>{timeString}</span>
                              {isMe && (
                                <span>
                                  {msg.status === 'read' ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                                  ) : msg.status === 'delivered' || msg.status === 'sent' ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-slate-300" />
                                  ) : (
                                    <Clock className="w-3 h-3 text-amber-400" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* PAINEL DE ANEXO SELECIONADO */}
                {selectedFile && (
                  <div className="px-4 py-1.5 bg-emerald-950/40 border-t border-emerald-900/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-emerald-300">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-bold">Anexo:</span>
                      <span className="truncate max-w-xs">{selectedFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                      title="Remover anexo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* BARRA INFERIOR DE ENVIO DE MENSAGENS ESTILO WHATSAPP WEB */}
                <div className="p-2.5 sm:p-3 bg-white dark:bg-[#202c33] border-t border-slate-200 dark:border-slate-800 relative z-20">
                  {/* DROPDOWN DE TEMPLATES / RÉGUAS */}
                  {showTemplatesDropdown && (
                    <div className="absolute bottom-full left-3 right-3 sm:left-4 sm:right-auto sm:w-96 mb-2 p-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-30 max-h-64 overflow-y-auto space-y-1 animate-fade-in">
                      <div className="px-2 py-1 flex items-center justify-between border-b border-slate-800 text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          Modelos & Respostas Rápidas
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTemplatesDropdown(false)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {templates.map(tpl => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => handleSelectTemplate(tpl)}
                          className="w-full text-left p-2 rounded-xl hover:bg-slate-800/80 transition-colors flex items-start gap-2 text-white group cursor-pointer"
                        >
                          <FileCheck2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold block truncate group-hover:text-emerald-300">
                              {tpl.name}
                            </span>
                            <span className="text-[10px] text-slate-400 line-clamp-1">
                              {tpl.body_text}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* POPOVER DE EMOJIS */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-2 sm:left-4 mb-2 w-72 sm:w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-30 p-2 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1 text-xs font-bold text-slate-300">
                        <span>Selecione um Emoji</span>
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(false)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                        {EMOJI_CATEGORIES.map((cat, idx) => (
                          <div key={idx} className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider">{cat.name}</span>
                            <div className="grid grid-cols-7 gap-1">
                              {cat.emojis.map((em, eIdx) => (
                                <button
                                  key={eIdx}
                                  type="button"
                                  onClick={() => handleInsertEmoji(em)}
                                  className="w-8 h-8 rounded-lg hover:bg-slate-800 text-lg flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  {em}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* BARRA DE GRAVAÇÃO DE ÁUDIO ATIVA */}
                  {isRecordingAudio ? (
                    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-rose-950/40 border border-rose-500/40 animate-pulse">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
                        <Mic className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-mono font-bold text-rose-300">
                          Gravando áudio de voz... {Math.floor(recordingSeconds / 60)}:{recordingSeconds % 60 < 10 ? '0' : ''}{recordingSeconds % 60}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelAudioRecording}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                          title="Cancelar gravação"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={stopAndSendAudioRecording}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/40 flex items-center gap-1.5 cursor-pointer transition-all"
                          title="Enviar áudio de voz"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Áudio</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                      />

                      {/* BOTÃO EMOJI */}
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-2 rounded-xl transition-colors cursor-pointer flex-shrink-0 ${
                          showEmojiPicker 
                            ? 'bg-amber-500/20 text-amber-400' 
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                        title="Inserir Emoji"
                      >
                        <Smile className="w-4 h-4" />
                      </button>

                      {/* BOTÃO ANEXO */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex-shrink-0"
                        title="Anexar documento ou imagem"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      {/* BOTÃO MODELOS */}
                      <button
                        type="button"
                        onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
                        className={`p-2 rounded-xl transition-colors cursor-pointer flex-shrink-0 ${
                          showTemplatesDropdown 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                        title="Usar Modelo / Resposta Rápida"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>

                      {/* CAMPO DE TEXTO DA MENSAGEM */}
                      <div className="flex-1 relative">
                        <textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder="Digite uma mensagem... (Enter para enviar)"
                          rows={1}
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-[#2a3942] border border-slate-200 dark:border-slate-700/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none max-h-28 transition-all leading-normal shadow-inner"
                        />
                      </div>

                      {/* BOTÃO DINÂMICO: GRAVAR VOZ OU ENVIAR TEXTO */}
                      {(!inputText.trim() && !selectedFile) ? (
                        <button
                          type="button"
                          onClick={startAudioRecording}
                          className="p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center justify-center cursor-pointer flex-shrink-0"
                          title="Gravar mensagem de voz"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={sending}
                          className="p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center justify-center cursor-pointer flex-shrink-0"
                          title="Enviar Mensagem"
                        >
                          {sending ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </form>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/40 mb-3">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  Canal Integrado de Mensagens WhatsApp
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-relaxed">
                  Selecione uma conversa à esquerda para visualizar o histórico em tempo real ou inicie um novo chat.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="mt-3 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 inline-flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Conversa
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ALÇAS DE REDIMENSIONAMENTO (RESIZE HANDLES) */}
        {isOverlayMode && !isMaximized && (
          <>
            {/* BORDA DIREITA */}
            <div 
              onMouseDown={(e) => handleMouseDownResize(e, 'e')}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-emerald-500/20 transition-colors z-30"
              title="Redimensionar largura"
            />
            {/* BORDA INFERIOR */}
            <div 
              onMouseDown={(e) => handleMouseDownResize(e, 's')}
              className="absolute left-0 right-0 bottom-0 h-2 cursor-s-resize hover:bg-emerald-500/20 transition-colors z-30"
              title="Redimensionar altura"
            />
            {/* CANTO INFERIOR DIREITO */}
            <div 
              onMouseDown={(e) => handleMouseDownResize(e, 'se')}
              className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 z-40 group"
              title="Clique e arraste para redimensionar tamanho da janela"
            >
              <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-slate-500 group-hover:border-emerald-400 transition-colors rounded-br-sm"></div>
            </div>
          </>
        )}
      </div>

      {/* MODAL DE NOVA CONVERSA */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Nova Conversa de WhatsApp</h3>
                  <p className="text-[10px] text-slate-400">Inicie um atendimento direto com o motorista</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewChat} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Número de Telefone / WhatsApp *
                </label>
                <input
                  type="text"
                  required
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  placeholder="Ex: (64) 99305-8754 ou 5564993058754"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  DDD + Número (o DDI 55 é inserido automaticamente se omitido).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nome do Motorista / Contato (Opcional)
                </label>
                <input
                  type="text"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="Ex: João Ferreira (Bitrem)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Abrir Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL PARA IMAGENS & FIGURINHAS */}
      <ChatLightboxModal
        isOpen={!!lightboxMedia}
        url={lightboxMedia?.url || ''}
        filename={lightboxMedia?.filename}
        isSticker={lightboxMedia?.isSticker}
        onClose={() => setLightboxMedia(null)}
      />
    </>
  );
};
