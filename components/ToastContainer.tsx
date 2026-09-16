
import React from 'react';
import type { Toast, ToastType } from '../hooks/useToast';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';


interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  };

  const bgStyles: Record<ToastType, string> = {
    success: 'border-emerald-500/20 bg-emerald-50/90 dark:bg-emerald-950/90',
    error: 'border-rose-500/20 bg-rose-50/90 dark:bg-rose-950/90',
    info: 'border-blue-500/20 bg-blue-50/90 dark:bg-blue-950/90',
    warning: 'border-amber-500/20 bg-amber-50/90 dark:bg-amber-950/90',
  };

  return (
    <div
      className={`
        pointer-events-auto
        flex items-center gap-3 px-4 py-3 min-w-[300px] max-w-md
        rounded-lg border shadow-lg backdrop-blur-sm
        animate-in slide-in-from-right fade-in duration-300
        ${bgStyles[toast.type]}
      `}
      role="alert"
    >
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <div className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
        {toast.message}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
      >
        <X className="w-4 h-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
      </button>
    </div>
  );
};

export default ToastContainer;
