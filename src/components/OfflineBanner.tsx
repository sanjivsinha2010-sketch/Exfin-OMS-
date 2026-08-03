import React from 'react';
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';

interface OfflineBannerProps {
  isOnline: boolean;
  pendingOfflineCount: number;
  onManualSync: () => void;
  isSyncing: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  pendingOfflineCount,
  onManualSync,
  isSyncing,
}) => {
  if (isOnline && pendingOfflineCount === 0) return null;

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 py-2 px-4">
      <div className="max-w-md mx-auto flex items-center justify-between text-xs">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300 font-semibold flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" /> Working Offline
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-emerald-300 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Internet Restored
                </span>
              </>
            )}

            {pendingOfflineCount > 0 && (
              <span className="text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono text-[11px]">
                {pendingOfflineCount} queued offline item{pendingOfflineCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {!isOnline && (
            <div className="text-[10px] text-amber-400/80 font-medium">
              Offline Mode. Using cached office location.
            </div>
          )}
        </div>

        {isOnline && pendingOfflineCount > 0 && (
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1 text-[11px] transition cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
};
