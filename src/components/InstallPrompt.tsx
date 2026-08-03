import React from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface InstallPromptProps {
  deferredPrompt: any;
  onInstall: () => void;
  onDismiss: () => void;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({
  deferredPrompt,
  onInstall,
  onDismiss,
}) => {
  if (!deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/80 rounded-2xl p-4 shadow-2xl flex items-center justify-between text-slate-100">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-xs text-white">Install Exfin OMS App</h4>
          <p className="text-[11px] text-slate-300">Add to Home Screen for fast offline enterprise access</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onInstall}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 shadow transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> Install
        </button>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
