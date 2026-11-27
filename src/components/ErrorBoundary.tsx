import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Une erreur inattendue est survenue.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090E] text-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#12121A] border border-white/10 p-6 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <h1 className="font-display text-2xl font-bold text-white">DJOUMA FOOT LIVE</h1>
            <p className="text-sm text-zinc-300">
              Un problème temporaire est survenu lors de l&apos;affichage des données.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger l&apos;application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
