import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Phone, Send, WifiOff, CheckCircle2 } from 'lucide-react';
import { collectDeviceMetadata } from '../lib/device';
import { DeviceMetadata } from '../types';
import logoImg from '../assets/images/exfin_app_logo_1785659161519.jpg';

interface RegistrationScreenProps {
  onRegisterSubmit: (employeeName: string, mobileNumber: string, metadata: DeviceMetadata) => Promise<void>;
  isOnline: boolean;
  pendingOfflineCount: number;
}

export const RegistrationScreen: React.FC<RegistrationScreenProps> = ({
  onRegisterSubmit,
  isOnline,
}) => {
  const [employeeName, setEmployeeName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [metadata, setMetadata] = useState<DeviceMetadata | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field validation error states
  const [nameError, setNameError] = useState<string | null>(null);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const meta = collectDeviceMetadata();
    setMetadata(meta);
  }, []);

  const validateEmployeeName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      return 'Employee Name is required.';
    }
    if (trimmed.length < 3) {
      return 'Employee Name must be at least 3 characters.';
    }
    if (trimmed.length > 50) {
      return 'Employee Name cannot exceed 50 characters.';
    }
    if (!/^[A-Za-z\s]+$/.test(trimmed)) {
      return 'Employee Name must contain letters and spaces only.';
    }
    return null;
  };

  const validateMobileNumber = (mobile: string): string | null => {
    const trimmed = mobile.trim();
    if (!trimmed) {
      return 'Mobile Number is required.';
    }
    if (!/^[6-9]\d{9}$/.test(trimmed)) {
      return 'Please enter a valid 10-digit mobile number.';
    }
    return null;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmployeeName(value);
    if (nameError) {
      setNameError(validateEmployeeName(value));
    }
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Sanitize to digits only, max 10 chars
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobileNumber(cleaned);
    if (mobileError) {
      setMobileError(validateMobileNumber(cleaned));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submissions

    setFormError(null);
    setFormSuccess(null);

    const nErr = validateEmployeeName(employeeName);
    const mErr = validateMobileNumber(mobileNumber);

    setNameError(nErr);
    setMobileError(mErr);

    if (nErr || mErr) {
      return;
    }

    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      // Allow submitting offline so registration is queued and saved locally
      try {
        setIsSubmitting(true);
        const meta = metadata || collectDeviceMetadata();
        await onRegisterSubmit(employeeName.trim(), mobileNumber.trim(), meta);
      } catch (err) {
        setFormError('You are offline. Your registration will be submitted automatically when internet returns.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const meta = metadata || collectDeviceMetadata();

    try {
      setIsSubmitting(true);
      await onRegisterSubmit(employeeName.trim(), mobileNumber.trim(), meta);
      setFormSuccess('Registration successful. Waiting for Admin approval.');
    } catch (err: any) {
      const rawMsg = (err?.message || err?.toString() || '').toLowerCase();
      if (rawMsg.includes('already registered') || rawMsg.includes('already exists')) {
        setFormError('Already registered.');
      } else if (rawMsg.includes('server') || rawMsg.includes('unavailable') || rawMsg.includes('fetch') || rawMsg.includes('network') || rawMsg.includes('500') || rawMsg.includes('502') || rawMsg.includes('503')) {
        setFormError('Server unavailable.');
      } else if (rawMsg.includes('internet') || rawMsg.includes('offline')) {
        setFormError('Internet unavailable.');
      } else {
        setFormError('Registration failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start pt-3 sm:pt-6 pb-6 px-4 sm:px-6 md:px-8">
      <div className="max-w-md w-full space-y-5">
        {/* Header Bar - Reduced space above, centered logo and title */}
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

          <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border shrink-0 ${
            isOnline
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
              : 'bg-amber-950/60 text-amber-400 border-amber-800/60 animate-pulse'
          }`}>
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </>
            )}
          </div>
        </div>

        {/* Device Registration Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-slate-900/90 backdrop-blur-sm border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-indigo-950/40 relative overflow-hidden"
        >
          {/* Subtle Accent Top Bar */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-b-full" />

          <div className="mb-5">
            <h1 className="text-xl font-bold text-white tracking-tight">Device Registration</h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Register your device to access the Exfin Office Management System.
            </p>
          </div>

          {!isOnline && (
            <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-start gap-2.5">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-amber-200">You are offline.</strong>
                Your registration will be submitted automatically when internet returns.
              </div>
            </div>
          )}

          {formSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {formSuccess}
            </div>
          )}

          {formError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs font-medium">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field 1: Employee Name */}
            <div>
              <label htmlFor="employeeName" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Employee Name <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="employeeName"
                  type="text"
                  disabled={isSubmitting}
                  value={employeeName}
                  onChange={handleNameChange}
                  onBlur={() => setNameError(validateEmployeeName(employeeName))}
                  placeholder="e.g. Sanjiv Sinha"
                  className={`w-full h-12 bg-slate-950 border rounded-xl pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                    nameError
                      ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                  } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              {nameError && (
                <p className="text-rose-400 text-[11px] mt-1 font-medium">{nameError}</p>
              )}
            </div>

            {/* Field 2: Mobile Number */}
            <div>
              <label htmlFor="mobileNumber" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Mobile Number <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="mobileNumber"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  disabled={isSubmitting}
                  value={mobileNumber}
                  onChange={handleMobileChange}
                  onBlur={() => setMobileError(validateMobileNumber(mobileNumber))}
                  placeholder="e.g. 9876543210"
                  className={`w-full h-12 bg-slate-950 border rounded-xl pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                    mobileError
                      ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                  } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              {mobileError && (
                <p className="text-rose-400 text-[11px] mt-1 font-medium">{mobileError}</p>
              )}
            </div>

            {/* Register Device Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 mt-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Registering Device...
                </>
              ) : (
                <>
                  Register & Continue
                  <Send className="w-4 h-4 ml-0.5" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};
