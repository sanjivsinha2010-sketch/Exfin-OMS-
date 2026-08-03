import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Smartphone, Cpu } from 'lucide-react';
import logoImg from '../assets/images/exfin_app_logo_1785659161519.jpg';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950 p-6 text-white selection:bg-indigo-500"
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm w-full">
        {/* Animated App Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-8"
        >
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-50 blur-lg animate-pulse" />
          <img
            src={logoImg}
            alt="Exfin OMS Logo"
            className="relative w-28 h-28 rounded-2xl object-cover shadow-2xl border border-slate-700/60"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            EXFIN OMS Enterprise
          </h1>
          <p className="text-xs uppercase tracking-widest text-indigo-400 font-semibold mt-1">
            Order Management System
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Authorized Device Authorization Portal
          </p>
        </motion.div>
      </div>

      {/* Progress & Metadata */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="w-full max-w-xs flex flex-col items-center gap-4 pb-4"
      >
        <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden p-0.5 border border-slate-700/50">
          <motion.div
            className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.0, ease: "easeInOut" }}
          />
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-400 font-medium">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Secure SSL
          </span>
          <span className="flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Authorized Device
          </span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-blue-400" /> Live Sync
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Version 1.0.0
        </div>
      </motion.div>
    </motion.div>
  );
};
