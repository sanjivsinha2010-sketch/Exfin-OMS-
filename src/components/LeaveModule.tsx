import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Send,
  WifiOff,
  RefreshCw,
  PlusCircle,
  History,
  Paperclip,
  ChevronDown,
  Info,
  CalendarDays
} from 'lucide-react';
import { Employee, LeaveApplication, LeaveBalance, LeaveTypeConfig, HolidayItem } from '../types';

interface LeaveModuleProps {
  employee: Employee;
  isOnline?: boolean;
}

const DEFAULT_LEAVE_TYPES: LeaveTypeConfig[] = [
  { key: 'CL', name: 'Casual Leave (CL)', annualLimit: 12, status: 'Active' },
  { key: 'SL', name: 'Sick Leave (SL)', annualLimit: 10, status: 'Active' },
  { key: 'EL', name: 'Earned Leave (EL)', annualLimit: 15, status: 'Active' },
  { key: 'HALF_DAY', name: 'Half Day', annualLimit: 12, status: 'Active' },
  { key: 'WFH', name: 'Work From Home', annualLimit: 24, status: 'Active' },
  { key: 'ON_DUTY', name: 'On Duty', annualLimit: 30, status: 'Active' },
  { key: 'COMP_OFF', name: 'Compensatory Off', annualLimit: 10, status: 'Active' },
  { key: 'MATERNITY', name: 'Maternity Leave', annualLimit: 180, status: 'Active' },
  { key: 'PATERNITY', name: 'Paternity Leave', annualLimit: 15, status: 'Active' },
  { key: 'LWP', name: 'Leave Without Pay (LWP)', annualLimit: 365, status: 'Active' }
];

export const LeaveModule: React.FC<LeaveModuleProps> = ({ employee, isOnline = true }) => {
  const [activeTab, setActiveTab] = useState<'balance' | 'apply' | 'history'>('apply');
  const [balance, setBalance] = useState<LeaveBalance>({
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    cl: 12,
    sl: 10,
    el: 15,
    compOff: 2,
    lwp: 0,
    lastUpdated: new Date().toISOString()
  });
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>(DEFAULT_LEAVE_TYPES);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Apply Form State
  const [leaveType, setLeaveType] = useState<string>('Casual Leave (CL)');
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [calculatedDays, setCalculatedDays] = useState<number>(1);

  // Status & Feedback Messages
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [offlineQueuedCount, setOfflineQueuedCount] = useState<number>(0);

  // Fetch Leave Data
  useEffect(() => {
    fetchLeaveData();
    checkOfflineQueue();
  }, [employee.employeeId]);

  // Sync offline queued leaves when internet returns
  useEffect(() => {
    if (isOnline) {
      syncOfflineLeaves();
    }
  }, [isOnline]);

  // Recalculate total leave days on date or halfday change
  useEffect(() => {
    calculateTotalDays();
  }, [fromDate, toDate, isHalfDay, holidays]);

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Leave Types
      const resTypes = await fetch('/api/leave/types');
      if (resTypes.ok) {
        const data = await resTypes.json();
        if (data.leaveTypes && data.leaveTypes.length > 0) {
          setLeaveTypes(data.leaveTypes);
        }
      }

      // 2. Fetch Employee Balance
      const resBal = await fetch(`/api/leave/balance?employeeId=${encodeURIComponent(employee.employeeId)}&employeeName=${encodeURIComponent(employee.employeeName)}`);
      if (resBal.ok) {
        const data = await resBal.json();
        if (data.balance) {
          setBalance(data.balance);
        }
      }

      // 3. Fetch My Leaves
      const resLeaves = await fetch(`/api/leave/my-leaves?employeeId=${encodeURIComponent(employee.employeeId)}`);
      if (resLeaves.ok) {
        const data = await resLeaves.json();
        if (data.leaves) {
          setLeaves(data.leaves);
        }
      }

      // 4. Fetch Holiday Calendar
      const resHols = await fetch('/api/admin/holidays');
      if (resHols.ok) {
        const data = await resHols.json();
        if (data.holidays) {
          setHolidays(data.holidays);
        }
      }
    } catch (err) {
      console.warn('Network issue fetching leave data; falling back to offline state:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalDays = () => {
    if (isHalfDay) {
      setCalculatedDays(0.5);
      return;
    }
    if (!fromDate || !toDate) {
      setCalculatedDays(0);
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      setCalculatedDays(0);
      return;
    }

    let days = 0;
    const cur = new Date(start);
    const holidayDates = new Set(holidays.map(h => h.date));

    while (cur <= end) {
      const curStr = cur.toISOString().split('T')[0];
      if (!holidayDates.has(curStr)) {
        days++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    setCalculatedDays(days > 0 ? days : 0);
  };

  const checkOfflineQueue = () => {
    try {
      const raw = localStorage.getItem('EXFIN_OFFLINE_LEAVES');
      if (raw) {
        const queue: LeaveApplication[] = JSON.parse(raw);
        const myQueued = queue.filter(q => q.employeeId === employee.employeeId);
        setOfflineQueuedCount(myQueued.length);
      } else {
        setOfflineQueuedCount(0);
      }
    } catch (e) {
      console.error('Error reading offline leave queue:', e);
    }
  };

  const saveToOfflineQueue = (newLeave: LeaveApplication) => {
    try {
      const raw = localStorage.getItem('EXFIN_OFFLINE_LEAVES');
      const queue: LeaveApplication[] = raw ? JSON.parse(raw) : [];
      queue.unshift(newLeave);
      localStorage.setItem('EXFIN_OFFLINE_LEAVES', JSON.stringify(queue));
      setOfflineQueuedCount(queue.filter(q => q.employeeId === employee.employeeId).length);
      setLeaves(prev => [newLeave, ...prev]);
    } catch (e) {
      console.error('Error saving to offline leave queue:', e);
    }
  };

  const syncOfflineLeaves = async () => {
    try {
      const raw = localStorage.getItem('EXFIN_OFFLINE_LEAVES');
      if (!raw) return;
      const queue: LeaveApplication[] = JSON.parse(raw);
      if (queue.length === 0) return;

      setFeedback({ type: 'info', message: 'Syncing offline leave applications...' });

      const remainingQueue: LeaveApplication[] = [];
      for (const item of queue) {
        try {
          const res = await fetch('/api/leave/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });
          if (!res.ok) {
            remainingQueue.push(item);
          }
        } catch (e) {
          remainingQueue.push(item);
        }
      }

      localStorage.setItem('EXFIN_OFFLINE_LEAVES', JSON.stringify(remainingQueue));
      setOfflineQueuedCount(remainingQueue.filter(q => q.employeeId === employee.employeeId).length);

      if (remainingQueue.length === 0) {
        setFeedback({ type: 'success', message: 'Offline leave applications synced successfully!' });
      } else {
        setFeedback({ type: 'info', message: `${queue.length - remainingQueue.length} offline leave(s) synced. ${remainingQueue.length} remaining.` });
      }

      fetchLeaveData();
    } catch (e) {
      console.error('Error syncing offline leaves:', e);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Validation 1: Invalid Date Range
    if (!fromDate || !toDate) {
      setFeedback({ type: 'error', message: 'Please select valid From Date and To Date.' });
      return;
    }

    if (fromDate > toDate) {
      setFeedback({ type: 'error', message: 'Invalid Date Range: From Date cannot be after To Date.' });
      return;
    }

    if (!reason.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a valid reason for applying leave.' });
      return;
    }

    // Validation 2: Duplicate / Overlapping Check
    const datesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
      aStart <= bEnd && aEnd >= bStart;

    const isDuplicate = leaves.some(
      l =>
        l.status !== 'Cancelled' &&
        l.status !== 'Rejected' &&
        datesOverlap(l.fromDate, l.toDate, fromDate, toDate)
    );

    if (isDuplicate) {
      setFeedback({
        type: 'error',
        message: 'Duplicate Application: You already have a leave request for overlapping dates.'
      });
      return;
    }

    const payload: LeaveApplication = {
      leaveId: `LVE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      leaveType,
      fromDate,
      toDate,
      isHalfDay,
      totalDays: calculatedDays,
      reason: reason.trim(),
      remarks: remarks.trim() || undefined,
      attachmentUrl: attachmentUrl.trim() || undefined,
      status: 'Pending',
      createdTime: new Date().toISOString()
    };

    if (!isOnline) {
      // Offline mode: queue locally
      payload.isOfflineQueued = true;
      saveToOfflineQueue(payload);
      setFeedback({
        type: 'info',
        message: 'Offline Mode: Your leave application has been queued locally and will automatically sync when internet returns.'
      });
      resetForm();
      setActiveTab('history');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/leave/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          message: 'Leave application submitted successfully! Status: Pending Approval.'
        });
        resetForm();
        fetchLeaveData();
        setActiveTab('history');
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to submit leave application.'
        });
      }
    } catch (err) {
      // Network error during fetch -> queue offline
      payload.isOfflineQueued = true;
      saveToOfflineQueue(payload);
      setFeedback({
        type: 'info',
        message: 'Network Unavailable: Leave request queued offline and will sync automatically when reconnected.'
      });
      resetForm();
      setActiveTab('history');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave application?')) return;

    // Check if it's in local offline queue first
    try {
      const raw = localStorage.getItem('EXFIN_OFFLINE_LEAVES');
      if (raw) {
        let queue: LeaveApplication[] = JSON.parse(raw);
        if (queue.some(q => q.leaveId === leaveId)) {
          queue = queue.filter(q => q.leaveId !== leaveId);
          localStorage.setItem('EXFIN_OFFLINE_LEAVES', JSON.stringify(queue));
          setLeaves(prev => prev.filter(l => l.leaveId !== leaveId));
          setFeedback({ type: 'success', message: 'Queued offline leave request cancelled.' });
          checkOfflineQueue();
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (!isOnline) {
      setFeedback({ type: 'error', message: 'Cannot cancel server-submitted leave while offline.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/leave/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveId, employeeId: employee.employeeId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: 'Leave application cancelled successfully.' });
        fetchLeaveData();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to cancel leave application.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Connection error while cancelling leave.' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReason('');
    setRemarks('');
    setAttachmentUrl('');
    setIsHalfDay(false);
    setFromDate(new Date().toISOString().split('T')[0]);
    setToDate(new Date().toISOString().split('T')[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Attachment file size must be less than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getStatusBadge = (status: string, isOffline?: boolean) => {
    if (isOffline) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1">
          <WifiOff className="w-3 h-3" /> Queued Offline
        </span>
      );
    }
    switch (status) {
      case 'Approved':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case 'Rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-800 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      case 'Cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending Approval
          </span>
        );
    }
  };

  const filteredLeaves = leaves.filter(l => {
    if (filterStatus === 'ALL') return true;
    return l.status === filterStatus;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
      {/* Module Title Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/60">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">Leave Management</h3>
            <p className="text-[11px] text-slate-400">Apply leave, track approval & check balances</p>
          </div>
        </div>

        {offlineQueuedCount > 0 && (
          <div className="px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-semibold flex items-center gap-1">
            <WifiOff className="w-3 h-3" />
            <span>{offlineQueuedCount} Offline</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('apply')}
          className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'apply'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Apply Leave</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('balance')}
          className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'balance'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Leave Balance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History ({leaves.length})</span>
        </button>
      </div>

      {/* Global Feedback Message */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-rose-950/60 border-rose-800/80 text-rose-300'
                : 'bg-indigo-950/60 border-indigo-800/80 text-indigo-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TAB 1: APPLY LEAVE FORM */}
      {activeTab === 'apply' && (
        <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
          {/* Leave Type Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center justify-between">
              <span>Leave Type <span className="text-rose-400">*</span></span>
              <span className="text-[11px] text-slate-500">Configured by Admin</span>
            </label>
            <div className="relative">
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none appearance-none cursor-pointer"
                required
              >
                {leaveTypes
                  .filter(t => t.status === 'Active')
                  .map(t => (
                    <option key={t.key} value={t.name}>
                      {t.name} (Max {t.annualLimit}/yr)
                    </option>
                  ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Dates Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* From Date */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">
                From Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>

            {/* To Date */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">
                To Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                disabled={isHalfDay}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                required
              />
            </div>
          </div>

          {/* Half Day & Calculated Days Badge */}
          <div className="flex items-center justify-between p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={isHalfDay}
                onChange={e => {
                  setIsHalfDay(e.target.checked);
                  if (e.target.checked) setToDate(fromDate);
                }}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Half Day Request</span>
            </label>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">Total Days</span>
              <span className="text-sm font-bold text-indigo-400">{calculatedDays} Day(s)</span>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">
              Reason for Leave <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Provide a specific reason for leave application..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-none resize-none"
              required
            />
          </div>

          {/* Remarks (Optional) */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Remarks (Optional)</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Additional comments or handover details..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Attachment (Optional) */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-400" /> Attachment (Optional)
              </span>
              <span className="text-[10px] text-slate-500">Max 2MB (Medical cert, etc.)</span>
            </label>

            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-950 file:text-indigo-300 hover:file:bg-indigo-900 border border-slate-800 rounded-xl bg-slate-950 cursor-pointer"
              />
              {attachmentUrl && (
                <button
                  type="button"
                  onClick={() => setAttachmentUrl('')}
                  className="px-2 py-1 text-[10px] bg-rose-950 text-rose-300 border border-rose-800 rounded-lg hover:bg-rose-900"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{isOnline ? 'Submit Leave Request' : 'Queue Leave Request (Offline)'}</span>
          </button>
        </form>
      )}

      {/* TAB 2: LEAVE BALANCE */}
      {activeTab === 'balance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Casual Leave */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-semibold">Casual Leave (CL)</span>
                <span className="text-[10px] text-emerald-400 font-mono">12 Limit</span>
              </div>
              <p className="text-xl font-extrabold text-white">{balance.cl} <span className="text-xs font-normal text-slate-400">Days</span></p>
            </div>

            {/* Sick Leave */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-semibold">Sick Leave (SL)</span>
                <span className="text-[10px] text-emerald-400 font-mono">10 Limit</span>
              </div>
              <p className="text-xl font-extrabold text-white">{balance.sl} <span className="text-xs font-normal text-slate-400">Days</span></p>
            </div>

            {/* Earned Leave */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-semibold">Earned Leave (EL)</span>
                <span className="text-[10px] text-emerald-400 font-mono">15 Limit</span>
              </div>
              <p className="text-xl font-extrabold text-white">{balance.el} <span className="text-xs font-normal text-slate-400">Days</span></p>
            </div>

            {/* Compensatory Off */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-semibold">Comp Off</span>
                <span className="text-[10px] text-indigo-400 font-mono">2 Added</span>
              </div>
              <p className="text-xl font-extrabold text-white">{balance.compOff} <span className="text-xs font-normal text-slate-400">Days</span></p>
            </div>
          </div>

          {/* Leave Without Pay (LWP) Counter */}
          <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Leave Without Pay (LWP) Taken:</span>
            <span className="font-mono font-bold text-amber-400 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-800/80">
              {balance.lwp} Day(s)
            </span>
          </div>

          <div className="text-[10px] text-slate-500 text-center pt-1">
            Balances automatically deduct upon Administrator approval. Last updated:{' '}
            {new Date(balance.lastUpdated).toLocaleDateString()}
          </div>
        </div>
      )}

      {/* TAB 3: LEAVE HISTORY & APPROVAL STATUS */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold scrollbar-none">
            {['ALL', 'Pending', 'Approved', 'Rejected', 'Cancelled'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Leaves List */}
          {filteredLeaves.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl p-4">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No leave applications found under "{filterStatus}".</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {filteredLeaves.map(item => (
                <div
                  key={item.leaveId}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm">{item.leaveType}</span>
                        {item.isHalfDay && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                            Half Day
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5 font-mono">
                        {item.fromDate} to {item.toDate} ({item.totalDays} Day{item.totalDays > 1 ? 's' : ''})
                      </p>
                    </div>
                    {getStatusBadge(item.status, item.isOfflineQueued)}
                  </div>

                  <p className="text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-850 italic">
                    "{item.reason}"
                  </p>

                  {item.remarks && (
                    <p className="text-[11px] text-slate-400">
                      <strong className="text-slate-300">Remarks:</strong> {item.remarks}
                    </p>
                  )}

                  {item.attachmentUrl && (
                    <div className="pt-1">
                      <a
                        href={item.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Paperclip className="w-3 h-3" /> View Attached Document
                      </a>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-slate-900 text-[10px] text-slate-500">
                    <span>Applied: {new Date(item.createdTime).toLocaleDateString()}</span>
                    {item.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => handleCancelLeave(item.leaveId)}
                        className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-semibold transition cursor-pointer"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
