import React, { Component, ErrorInfo, ReactNode } from 'react';
import { LoaderIcon } from './icons/LoaderIcon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('agromercantil_themeImage');
      localStorage.removeItem('transcunha_themeImage');
      localStorage.removeItem('trancunha_themeImage');
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  private handleFullReset = () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <LoaderIcon className="w-8 h-8 animate-spin" />
            </div>
            
            <h2 className="text-xl font-bold mb-2">Ops! Algo deu errado ao carregar o sistema</h2>
            <p className="text-sm text-slate-400 mb-6">
              Identificamos um problema na renderização da interface (possivelmente dados de tema ou cache corrompidos).
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-sm"
              >
                <LoaderIcon className="w-4 h-4" />
                Restaurar Tema Padrão e Recarregar
              </button>

              <button
                onClick={this.handleFullReset}
                className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-colors text-xs"
              >
                Limpar Todo o Cache Local
              </button>
            </div>

            {this.state.error && (
              <div className="mt-6 p-3 bg-slate-950/50 rounded-lg text-left overflow-x-auto max-h-32 border border-slate-800">
                <p className="text-[11px] font-mono text-red-400 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
