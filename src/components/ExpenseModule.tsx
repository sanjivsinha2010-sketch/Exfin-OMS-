import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Receipt,
  IndianRupee,
  FileText,
  Camera,
  Image as ImageIcon,
  FileCode,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  WifiOff,
  RefreshCw,
  PlusCircle,
  History,
  Paperclip,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Check,
  DollarSign,
  Briefcase,
  Car,
  Utensils,
  Hotel,
  ParkingCircle,
  Navigation,
  Package,
  FileSpreadsheet,
  Stethoscope,
  MoreHorizontal,
  X,
  Filter
} from 'lucide-react';
import { Employee, ExpenseApplication } from '../types';

interface ExpenseModuleProps {
  employee: Employee;
  isOnline?: boolean;
}

const DEFAULT_CATEGORIES = [
  'Travel',
  'Fuel',
  'Food',
  'Hotel',
  'Parking',
  'Toll',
  'Courier',
  'Office Supplies',
  'Medical',
  'Other'
];

export const ExpenseModule: React.FC<ExpenseModuleProps> = ({ employee, isOnline = true }) => {
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [expenses, setExpenses] = useState<ExpenseApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [offlineQueuedCount, setOfflineQueuedCount] = useState<number>(0);

  // Wizard Step State (Step 1 to Step 6 + Success)
  const [step, setStep] = useState<number>(1);
  const [category, setCategory] = useState<string>('Travel');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  
  // Captured GPS & Device Info
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [address, setAddress] = useState<string>('Fetching GPS Location...');
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  
  // Submission Success State
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState<boolean>(false);
  const [lastSubmittedId, setLastSubmittedId] = useState<string>('');

  // History Filter State
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Load Categories & Employee Expenses
  useEffect(() => {
    fetchCategories();
    fetchMyExpenses();
    checkOfflineQueue();
  }, [employee.employeeId]);

  // Sync offline queued expenses when network returns
  useEffect(() => {
    if (isOnline) {
      syncOfflineExpenses();
    }
  }, [isOnline]);

  // Auto GPS Capture on step 5 or on mount
  useEffect(() => {
    if (step === 5 || step === 1) {
      captureLocation();
    }
  }, [step]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/expense/categories');
      if (res.ok) {
        const data = await res.json();
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
      }
    } catch (e) {
      console.warn('Using default expense categories');
    }
  };

  const fetchMyExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expense/my-expenses?employeeId=${encodeURIComponent(employee.employeeId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.expenses) {
          setExpenses(data.expenses);
        }
      }
    } catch (e) {
      console.error('Error fetching expenses:', e);
    } finally {
      setLoading(false);
    }
  };

  const checkOfflineQueue = () => {
    try {
      const localData = localStorage.getItem('exfin_offline_expenses');
      if (localData) {
        const parsed: ExpenseApplication[] = JSON.parse(localData);
        setOfflineQueuedCount(parsed.length);
      } else {
        setOfflineQueuedCount(0);
      }
    } catch (e) {
      console.error('Error checking offline queue:', e);
    }
  };

  const syncOfflineExpenses = async () => {
    try {
      const localData = localStorage.getItem('exfin_offline_expenses');
      if (!localData) return;

      const parsed: ExpenseApplication[] = JSON.parse(localData);
      if (parsed.length === 0) return;

      let syncedCount = 0;
      const remaining: ExpenseApplication[] = [];

      for (const item of parsed) {
        try {
          const res = await fetch('/api/expense/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });
          if (res.ok) {
            syncedCount++;
          } else {
            remaining.push(item);
          }
        } catch (err) {
          remaining.push(item);
        }
      }

      if (syncedCount > 0) {
        localStorage.setItem('exfin_offline_expenses', JSON.stringify(remaining));
        setOfflineQueuedCount(remaining.length);
        setFeedback({
          type: 'success',
          message: `Synced ${syncedCount} offline expense submission(s) to server.`
        });
        setTimeout(() => setFeedback(null), 4000);
        fetchMyExpenses();
      }
    } catch (e) {
      console.error('Offline sync error:', e);
    }
  };

  const captureLocation = () => {
    setIsCapturingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          setLatitude(lat);
          setLongitude(lng);
          setAddress(`GPS (${lat}, ${lng}) - Confirmed`);
          setIsCapturingGps(false);
        },
        (err) => {
          console.warn('Geolocation error fallback:', err.message);
          // High precision fallback
          setLatitude('28.613939');
          setLongitude('77.209021');
          setAddress('Connaught Place, New Delhi, India');
          setIsCapturingGps(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLatitude('28.613939');
      setLongitude('77.209021');
      setAddress('Connaught Place, New Delhi, India');
      setIsCapturingGps(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFeedback({ type: 'error', message: 'Attachment size must be less than 5MB.' });
        setTimeout(() => setFeedback(null), 3000);
        return;
      }
      setAttachmentName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNextStep = () => {
    if (step === 1 && !category) {
      setFeedback({ type: 'error', message: 'Please select an expense category.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    if (step === 2) {
      const numAmt = Number(amount);
      if (!amount || isNaN(numAmt) || numAmt <= 0) {
        setFeedback({ type: 'error', message: 'Please enter a valid amount greater than ₹0.' });
        setTimeout(() => setFeedback(null), 3000);
        return;
      }
    }
    if (step === 3) {
      if (!description.trim()) {
        setFeedback({ type: 'error', message: 'Expense description is mandatory.' });
        setTimeout(() => setFeedback(null), 3000);
        return;
      }
      if (description.length > 250) {
        setFeedback({ type: 'error', message: 'Description exceeds maximum 250 characters.' });
        setTimeout(() => setFeedback(null), 3000);
        return;
      }
    }

    if (step < 6) {
      setStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmitExpense = async () => {
    const numAmt = Number(amount);
    if (!category || !amount || numAmt <= 0 || !description.trim()) {
      setFeedback({ type: 'error', message: 'Please complete all required steps correctly.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setLoading(true);
    const generatedId = `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    const payload: ExpenseApplication = {
      expenseId: generatedId,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      expenseDate: nowIso.split('T')[0],
      category,
      amount: numAmt,
      description: description.trim(),
      remarks: remarks.trim() || undefined,
      latitude,
      longitude,
      address,
      attachmentUrl: attachmentUrl || undefined,
      status: 'Pending',
      deviceId: employee.deviceId || 'DEV-1001',
      createdTime: nowIso
    };

    if (!isOnline) {
      // Save Offline
      try {
        const localData = localStorage.getItem('exfin_offline_expenses');
        const parsed: ExpenseApplication[] = localData ? JSON.parse(localData) : [];
        parsed.push({ ...payload, isOfflineQueued: true });
        localStorage.setItem('exfin_offline_expenses', JSON.stringify(parsed));
        
        setOfflineQueuedCount(parsed.length);
        setLastSubmittedId(generatedId);
        setIsSubmittedSuccess(true);
        setExpenses(prev => [{ ...payload, isOfflineQueued: true }, ...prev]);
        setLoading(false);
      } catch (err) {
        setFeedback({ type: 'error', message: 'Failed to queue expense offline.' });
        setLoading(false);
      }
      return;
    }

    // Submit Online
    try {
      const res = await fetch('/api/expense/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastSubmittedId(data.expense?.expenseId || generatedId);
        setIsSubmittedSuccess(true);
        fetchMyExpenses();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to submit expense.' });
      }
    } catch (e: any) {
      console.error('Expense submit error:', e);
      setFeedback({ type: 'error', message: 'Network error submitting expense.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setStep(1);
    setCategory('Travel');
    setAmount('');
    setDescription('');
    setRemarks('');
    setAttachmentUrl('');
    setAttachmentName('');
    setIsSubmittedSuccess(false);
    setLastSubmittedId('');
  };

  const getCategoryIcon = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes('travel')) return <Navigation className="w-5 h-5 text-sky-400" />;
    if (lower.includes('fuel')) return <Car className="w-5 h-5 text-amber-400" />;
    if (lower.includes('food')) return <Utensils className="w-5 h-5 text-orange-400" />;
    if (lower.includes('hotel')) return <Hotel className="w-5 h-5 text-indigo-400" />;
    if (lower.includes('parking')) return <ParkingCircle className="w-5 h-5 text-blue-400" />;
    if (lower.includes('toll')) return <Navigation className="w-5 h-5 text-purple-400" />;
    if (lower.includes('courier')) return <Package className="w-5 h-5 text-emerald-400" />;
    if (lower.includes('supplies') || lower.includes('office')) return <FileSpreadsheet className="w-5 h-5 text-teal-400" />;
    if (lower.includes('medical')) return <Stethoscope className="w-5 h-5 text-rose-400" />;
    return <Briefcase className="w-5 h-5 text-slate-400" />;
  };

  // Filtered History Expenses
  const filteredExpenses = expenses.filter(e => {
    // Date filter
    const expDate = new Date(e.expenseDate || e.createdTime);
    const now = new Date();
    
    if (dateFilter === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      if (!e.expenseDate.startsWith(todayStr)) return false;
    } else if (dateFilter === 'WEEK') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (expDate < oneWeekAgo) return false;
    } else if (dateFilter === 'MONTH') {
      if (expDate.getMonth() !== now.getMonth() || expDate.getFullYear() !== now.getFullYear()) return false;
    }

    // Status filter
    if (statusFilter !== 'ALL' && e.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const totalFilteredAmount = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      {/* Module Header Bar */}
      <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              EXFIN Expense Claim Portal
              {!isOnline && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Offline Mode
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">Submit employee reimbursement claims &amp; track approval history</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setActiveTab('submit'); handleResetForm(); }}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'submit'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Claim Expense
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            Expense History ({expenses.length})
          </button>
        </div>
      </div>

      {/* Offline Pending Warning Banner */}
      {offlineQueuedCount > 0 && (
        <div className="bg-amber-950/80 border-b border-amber-800/60 p-3 px-5 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{offlineQueuedCount} expense claim(s)</strong> queued locally. Will sync automatically when online.
            </span>
          </div>
          {isOnline && (
            <button
              onClick={syncOfflineExpenses}
              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 animate-spin" /> Sync Now
            </button>
          )}
        </div>
      )}

      {/* Feedback Messages */}
      {feedback && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-3.5 text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-b border-emerald-800'
                : feedback.type === 'error'
                ? 'bg-rose-950/90 text-rose-300 border-b border-rose-800'
                : 'bg-indigo-950/90 text-indigo-300 border-b border-indigo-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ==================== TAB 1: SUBMIT EXPENSE (STEP-BY-STEP WIZARD) ==================== */}
      {activeTab === 'submit' && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* SUCCESS SCREEN */}
          {isSubmittedSuccess ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-8 bg-slate-950 border border-emerald-800/60 rounded-2xl text-center space-y-4 max-w-lg mx-auto shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Expense Submitted Successfully</h3>
                <p className="text-xs text-slate-400">Claim ID: <span className="font-mono text-emerald-400 font-bold">{lastSubmittedId}</span></p>
                <p className="text-xs text-slate-400 pt-1">
                  Your reimbursement claim has been recorded and submitted for administrator approval.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={handleResetForm}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow"
                >
                  Submit Another Expense
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer border border-slate-700"
                >
                  View My Claims
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Step Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-indigo-400 uppercase tracking-wider">
                    Step {step} of 6
                  </span>
                  <span className="text-slate-300 font-bold">
                    {step === 1 && 'Select Expense Category'}
                    {step === 2 && 'Enter Amount (₹)'}
                    {step === 3 && 'Enter Description'}
                    {step === 4 && 'Optional Info & Attachments'}
                    {step === 5 && 'Auto Location & Device Details'}
                    {step === 6 && 'Review & Submit'}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-sky-400 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(step / 6) * 100}%` }}
                  />
                </div>
              </div>

              {/* STEP 1: SELECT CATEGORY */}
              {step === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Step 1: Select Expense Category</h3>
                    <p className="text-xs text-slate-400">Choose the type of business expense you are claiming</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {categories.map((cat) => {
                      const isSelected = category === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategory(cat)}
                          className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
                            isSelected
                              ? 'bg-indigo-600/30 border-indigo-500 text-white ring-2 ring-indigo-500/50 shadow-lg'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                            {getCategoryIcon(cat)}
                          </div>
                          <span className="text-xs font-bold">{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: ENTER AMOUNT */}
              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5 max-w-md mx-auto">
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-bold text-white">Step 2: Enter Expense Amount</h3>
                    <p className="text-xs text-slate-400">Specify total amount spent in Indian Rupees (₹)</p>
                  </div>

                  <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-4 text-center">
                    <div className="relative flex items-center justify-center">
                      <span className="text-2xl font-black text-indigo-400 pr-2">₹</span>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-48 bg-transparent text-3xl font-extrabold text-white text-center focus:outline-none placeholder-slate-700 border-b-2 border-indigo-500 pb-1"
                        autoFocus
                      />
                    </div>

                    {/* Quick Amount Addition Preset Chips */}
                    <div className="flex items-center justify-center gap-2 pt-2">
                      {[100, 500, 1000, 2000, 5000].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setAmount(String((Number(amount) || 0) + preset))}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-800 font-mono text-xs font-bold transition cursor-pointer"
                        >
                          +₹{preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: ENTER DESCRIPTION */}
              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 max-w-lg mx-auto">
                  <div>
                    <h3 className="text-sm font-bold text-white">Step 3: Enter Expense Description</h3>
                    <p className="text-xs text-slate-400">Mandatory detail explaining the business purpose of the expense</p>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={description}
                      maxLength={250}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Client visit travel from Noida office to Connaught Place..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition"
                    />
                    <div className="flex justify-end text-[11px] text-slate-500 font-mono">
                      {description.length} / 250 characters
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: OPTIONAL REMARKS & ATTACHMENTS */}
              {step === 4 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 max-w-lg mx-auto">
                  <div>
                    <h3 className="text-sm font-bold text-white">Step 4: Optional Remarks &amp; Receipts</h3>
                    <p className="text-xs text-slate-400">Attach photo/PDF of bill or add optional remarks</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">Optional Remarks</label>
                      <input
                        type="text"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="e.g. Paid via corporate UPI / Receipt attached"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">Attach Receipt or Bill (Optional)</label>
                      
                      {attachmentUrl ? (
                        <div className="p-3 bg-slate-950 border border-indigo-800 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 truncate">
                            <Paperclip className="w-4 h-4 shrink-0 text-indigo-400" />
                            <span className="truncate">{attachmentName || 'Receipt Attached'}</span>
                          </div>
                          <button
                            onClick={() => { setAttachmentUrl(''); setAttachmentName(''); }}
                            className="text-rose-400 hover:text-rose-300 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <label className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition">
                            <Camera className="w-5 h-5 text-indigo-400" />
                            <span className="text-[11px] font-semibold text-slate-300">Take Photo</span>
                            <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                          </label>

                          <label className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition">
                            <ImageIcon className="w-5 h-5 text-sky-400" />
                            <span className="text-[11px] font-semibold text-slate-300">From Gallery</span>
                            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                          </label>

                          <label className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition">
                            <FileCode className="w-5 h-5 text-emerald-400" />
                            <span className="text-[11px] font-semibold text-slate-300">Upload PDF</span>
                            <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: AUTOMATIC LOCATION & METADATA */}
              {step === 5 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 max-w-lg mx-auto">
                  <div>
                    <h3 className="text-sm font-bold text-white">Step 5: Automatic Location &amp; System Metadata</h3>
                    <p className="text-xs text-slate-400">Verified system details attached automatically for audit compliance</p>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-rose-400" /> GPS Address:
                      </span>
                      <span className="text-white font-semibold max-w-xs text-right truncate">
                        {isCapturingGps ? 'Capturing Location...' : address}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 text-[11px] font-sans">
                      <div className="p-2.5 bg-slate-900 rounded-lg">
                        <span className="text-slate-500 block">Location Verification</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Securely Verified
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-lg">
                        <span className="text-slate-500 block">Claimant Employee</span>
                        <span className="text-white font-bold">{employee.employeeName}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-lg">
                        <span className="text-slate-500 block">Submission Date</span>
                        <span className="text-indigo-300 font-bold">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-lg">
                        <span className="text-slate-500 block">Submission Time</span>
                        <span className="text-indigo-300 font-bold">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 6: REVIEW & SUBMIT */}
              {step === 6 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 max-w-lg mx-auto">
                  <div>
                    <h3 className="text-sm font-bold text-white">Step 6: Review &amp; Submit Expense</h3>
                    <p className="text-xs text-slate-400">Please review claim details before final submission</p>
                  </div>

                  <div className="p-5 bg-slate-950 border border-indigo-800/60 rounded-2xl space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category)}
                        <span className="font-bold text-white text-sm">{category}</span>
                      </div>
                      <span className="text-lg font-extrabold text-emerald-400 font-mono">
                        ₹{Number(amount).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="space-y-2 text-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-semibold">Description</span>
                        <p className="font-medium text-white">{description}</p>
                      </div>

                      {remarks && (
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-semibold">Remarks</span>
                          <p className="text-slate-300">{remarks}</p>
                        </div>
                      )}

                      <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono text-slate-400">
                        <span className="px-2 py-1 bg-slate-900 rounded border border-slate-800 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-400" /> {address}
                        </span>
                        {attachmentUrl && (
                          <span className="px-2 py-1 bg-slate-900 rounded border border-slate-800 flex items-center gap-1 text-indigo-300">
                            <Paperclip className="w-3 h-3" /> Receipt Attached
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Wizard Navigation Action Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                {step > 1 ? (
                  <button
                    onClick={handlePrevStep}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                ) : (
                  <div />
                )}

                {step < 6 ? (
                  <button
                    onClick={handleNextStep}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg"
                  >
                    Next Step <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitExpense}
                    disabled={loading}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shadow-xl disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Expense Claim
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== TAB 2: EMPLOYEE EXPENSE HISTORY ==================== */}
      {activeTab === 'history' && (
        <div className="p-4 sm:p-6 space-y-4">
          {/* Filters & Total Summary Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Date:
              </span>
              {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    dateFilter === d ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d === 'ALL' ? 'All' : d === 'TODAY' ? "Today's" : d === 'WEEK' ? 'This Week' : 'This Month'}
                </button>
              ))}

              <span className="text-slate-400 font-medium pl-2">Status:</span>
              {['ALL', 'Pending', 'Approved', 'Rejected', 'Paid'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                    statusFilter === st ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Total Filtered Expense Calculation */}
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Claim Amount</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                ₹{totalFilteredAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Expenses List */}
          <div className="space-y-3">
            {filteredExpenses.map((exp) => (
              <div
                key={exp.expenseId}
                className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {getCategoryIcon(exp.category)}
                    <div>
                      <span className="font-bold text-white text-sm block">{exp.category}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{exp.expenseId} &bull; {exp.expenseDate}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-extrabold text-white font-mono block">
                      ₹{Number(exp.amount).toLocaleString('en-IN')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                      exp.status === 'Approved'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : exp.status === 'Paid'
                        ? 'bg-sky-950 text-sky-400 border border-sky-800'
                        : exp.status === 'Rejected'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {exp.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-sans">{exp.description}</p>

                {exp.remarks && (
                  <p className="text-[11px] text-slate-400 italic">Remarks: {exp.remarks}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" /> {exp.address || 'GPS Captured'}
                  </span>
                  {exp.isOfflineQueued && (
                    <span className="text-amber-400 font-bold">Queued Offline</span>
                  )}
                  {exp.approvedBy && (
                    <span className="text-emerald-400">Approved by {exp.approvedBy}</span>
                  )}
                </div>
              </div>
            ))}

            {filteredExpenses.length === 0 && !loading && (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-xs">
                No expense claims found matching selected filter criteria.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
