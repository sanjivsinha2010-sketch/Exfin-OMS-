import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, ShieldAlert, RefreshCw, User, Phone, Laptop, ShieldCheck, RotateCcw } from 'lucide-react';
import { Employee } from '../types';
import logoImg from '../assets/images/exfin_app_logo_1785659161519.jpg';

interface WaitingScreenProps {
  employee: Employee;
  onCheckStatus: () => Promise<Employee | null>;
  onApproved: (updatedEmployee: Employee) => void;
  onResetRegistration?: () => void;
  onReRegister?: () => void;
  isOnline: boolean;
}

export const WaitingScreen: React.FC<WaitingScreenProps> = ({
  employee,
  onCheckStatus,
  onApproved,
  onResetRegistration,
  onReRegister,
  isOnline,
}) => {
  const [secondsUntilNextCheck, setSecondsUntilNextCheck] = useState(60);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>(new Date().toLocaleTimeString());
  const [statusError, setStatusError] = useState<string | null>(null);

  // Automatic approval check loop every 60s
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;

    const performCheck = async () => {
      if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setStatusError('You are offline. Your registration will be submitted automatically when internet returns.');
        return;
      }
      setIsChecking(true);
      setStatusError(null);
      try {
        const updated = await onCheckStatus();
        setLastCheckTime(new Date().toLocaleTimeString());
        if (updated && (updated.status === 'Approved' || updated.status?.toUpperCase() === 'APPROVED')) {
          onApproved(updated);
        }
      } catch (e) {
        setStatusError('Server unavailable.');
      } finally {
        setIsChecking(false);
        setSecondsUntilNextCheck(60);
      }
    };

    // Countdown ticker every 1 sec
    countdownInterval = setInterval(() => {
      setSecondsUntilNextCheck((prev) => {
        if (prev <= 1) {
          performCheck();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [onCheckStatus, onApproved, isOnline]);

  const handleManualCheck = async () => {
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setStatusError('You are offline. Your registration will be submitted automatically when internet returns.');
      return;
    }
    setIsChecking(true);
    setStatusError(null);
    try {
      const updated = await onCheckStatus();
      setLastCheckTime(new Date().toLocaleTimeString());
      if (updated && (updated.status === 'Approved' || updated.status?.toUpperCase() === 'APPROVED')) {
        onApproved(updated);
      }
    } catch (e) {
      setStatusError('Server unavailable.');
    } finally {
      setIsChecking(false);
      setSecondsUntilNextCheck(60);
    }
  };

  const isRejected = employee.status === 'Rejected' || employee.status?.toUpperCase() === 'REJECTED';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start pt-3 sm:pt-6 pb-6 px-4 sm:px-6 md:px-8">
      <div className="max-w-md w-full space-y-5">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <img
              src={logoImg}
              alt="EXFIN OMS"
              className="w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] object-contain rounded-xl border border-slate-700/80 shadow-md bg-slate-900 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col justify-center">
              <h2 className="text-lg font-bold text-white tracking-wide leading-tight">EXFIN OMS</h2>
              <p className="text-xs text-slate-400 font-medium leading-tight mt-0.5">Office Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
              isRejected
                ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                : 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isRejected ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'}`} />
              {isRejected ? 'Rejected' : 'Pending Approval'}
            </span>
          </div>
        </div>

        {/* Main Content Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-indigo-950/40 relative overflow-hidden"
        >
          {/* Top Progress / Glow bar */}
          <div className={`absolute top-0 left-0 right-0 h-1 ${
            isRejected
              ? 'bg-gradient-to-r from-rose-500 via-red-500 to-amber-500'
              : 'bg-gradient-to-r from-emerald-500 via-indigo-500 to-blue-500'
          }`} />

          {/* Green Success / Check Icon badge */}
          <div className="flex justify-center mb-4">
            {isRejected ? (
              <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-xl relative">
                <ShieldAlert className="w-8 h-8" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-xl relative">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Title & Status Message */}
          <div className="text-center mb-5 space-y-2">
            <h1 className="text-lg font-bold text-white leading-snug">
              {isRejected ? 'Registration Rejected' : 'Registration Submitted'}
            </h1>

            {isRejected ? (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-200 text-left space-y-1">
                <span className="font-semibold block text-rose-300">Reason:</span>
                <p className="text-rose-100 leading-relaxed">
                  {employee.rejectionReason || 'Your registration request was rejected by Admin.'}
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1">
                <p>Your registration request has been sent to Admin.</p>
                <p className="text-amber-300 font-medium">Please wait until approval.</p>
              </div>
            )}
          </div>

          {statusError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs font-medium">
              {statusError}
            </div>
          )}

          {/* Employee & Registration Summary Details */}
          <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 text-xs space-y-3 mb-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Employee Name
              </span>
              <span className="text-white font-semibold">{employee.employeeName}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-400" /> Mobile Number
              </span>
              <span className="text-slate-200 font-medium">{employee.mobileNumber}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Status
              </span>
              <span className={`font-semibold px-2 py-0.5 rounded text-[11px] border ${
                isRejected
                  ? 'bg-rose-950 text-rose-400 border-rose-800'
                  : 'bg-amber-950 text-amber-400 border-amber-800'
              }`}>
                {isRejected ? 'REJECTED' : 'PENDING'}
              </span>
            </div>
          </div>

          {/* Action Button */}
          {!isRejected ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleManualCheck}
                disabled={isChecking}
                className="w-full h-11 bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-white font-medium text-xs rounded-xl border border-slate-700/80 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Checking Status...' : 'Refresh Status'}
              </button>

              {onResetRegistration && (
                <button
                  type="button"
                  onClick={onResetRegistration}
                  className="w-full h-11 bg-rose-950/40 hover:bg-rose-900/60 active:scale-[0.99] text-rose-300 font-medium text-xs rounded-xl border border-rose-800/60 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  Reset Registration
                </button>
              )}

              <div className="text-center text-[11px] text-slate-500">
                Checking automatically every 60 seconds ({secondsUntilNextCheck}s)
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onReRegister}
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Register Again
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
};
