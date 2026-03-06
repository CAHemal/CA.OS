import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed before
    const dismissed = localStorage.getItem('caos_install_dismissed');
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const daysSince = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return; // Don't show for 7 days after dismiss
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setShowBanner(false);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('caos_install_dismissed', new Date().toISOString());
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div
      data-testid="install-prompt-banner"
      className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-40 animate-fade-up"
    >
      <div className="bg-white rounded-xl shadow-lg border border-zinc-200 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm font-heading">CA</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 font-heading">Install CA.OS</p>
          <p className="text-xs text-zinc-500 mt-0.5">Add to home screen for quick access</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            data-testid="install-app-btn"
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs px-3"
            onClick={handleInstall}
          >
            <Download size={14} className="mr-1" /> Install
          </Button>
          <Button
            data-testid="dismiss-install-btn"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400"
            onClick={handleDismiss}
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
