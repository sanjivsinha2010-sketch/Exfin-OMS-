import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, ShieldCheck, User, Tag, Download, Home, Clock, Receipt,
  CalendarDays, Bell, BarChart3, Settings, LogOut, ArrowRight, Sparkles,
  MapPin, ChevronRight, FileText, Check, AlertCircle, Building2, Smartphone
} from 'lucide-react';
import { Employee } from '../types';
import logoImg from '../assets/images/exfin_app_logo_1785659161519.jpg';
import { AttendanceModule } from './AttendanceModule';
import { LeaveModule } from './LeaveModule';
import { ExpenseModule } from './ExpenseModule';

interface DashboardScreenProps {
  employee: Employee;
  deferredPrompt: any;
  onInstallPWA: () => void;
  isOnline?: boolean;
  onOpenAdmin?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  employee,
  deferredPrompt,
  onInstallPWA,
  isOnline = true,
  onOpenAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'expense' | 'leave' | 'notifications' | 'reports' | 'profile'>('home');
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString());
  const [currentDate, setCurrentDate] = useState<string>(new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }));
  
  // Stats summary states
  const [attendanceStatus, setAttendanceStatus] = useState<string>('Checked Out');
  const [leaveBalanceSummary, setLeaveBalanceSummary] = useState<string>('CL: 12 | SL: 10');
  const [pendingExpensesCount, setPendingExpensesCount] = useState<number>(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch quick stats summary
  useEffect(() => {
    const fetchQuickStats = async () => {
      try {
        // Fetch attendance
        const attRes = await fetch(`/api/attendance/my-attendance?employeeId=${encodeURIComponent(employee.employeeId)}`);
        if (attRes.ok) {
          const data = await attRes.json();
          if (data.attendance && data.attendance.length > 0) {
            const latest = data.attendance[0];
            setAttendanceStatus(latest.status || 'Checked Out');
          }
        }

        // Fetch leaves balance
        const leaveRes = await fetch(`/api/leave/balance?employeeId=${encodeURIComponent(employee.employeeId)}&employeeName=${encodeURIComponent(employee.employeeName)}`);
        if (leaveRes.ok) {
          const data = await leaveRes.json();
          if (data.balance) {
            setLeaveBalanceSummary(`CL: ${data.balance.cl ?? 12} | SL: ${data.balance.sl ?? 10} | EL: ${data.balance.el ?? 15}`);
          }
        }

        // Fetch expenses
        const expRes = await fetch(`/api/expense/my-expenses?employeeId=${encodeURIComponent(employee.employeeId)}`);
        if (expRes.ok) {
          const data = await expRes.json();
          if (data.expenses) {
            const pending = data.expenses.filter((e: any) => e.status === 'Pending').length;
            setPendingExpensesCount(pending);
          }
        }

        // Fetch notifications
        const notifRes = await fetch('/api/notifications');
        if (notifRes.ok) {
          const data = await notifRes.json();
          if (data.notifications) {
            setNotificationsList(data.notifications);
            setUnreadNotificationsCount(data.notifications.length);
          }
        }
      } catch (e) {
        console.warn('Error fetching quick stats:', e);
      }
    };

    fetchQuickStats();
  }, [employee.employeeId, employee.employeeName]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between pb-20 sm:pb-24 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={logoImg}
            alt="Exfin OMS"
            className="w-10 h-10 rounded-xl object-cover border border-slate-700/80 shadow-md"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">EXFIN OMS</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-950 text-indigo-400 border border-indigo-800/60 rounded-full">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">{currentDate} &bull; {currentTime}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {deferredPrompt && (
            <button
              onClick={onInstallPWA}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800 flex items-center gap-1.5 hover:bg-emerald-900 transition cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Install PWA</span>
            </button>
          )}

          {/* Admin Button for Admin / HR / Master Admin */}
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/80 flex items-center gap-1.5 hover:bg-indigo-900 transition cursor-pointer shadow-sm"
              title="Enterprise Admin Dashboard"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> <span className="hidden sm:inline">Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Welcome Banner Card */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-800/50 px-3 py-1 rounded-full text-emerald-300 text-xs font-medium w-fit">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verified Employee Profile &bull; {employee.status}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {greeting()}, {employee.employeeName}
                    </h1>
                    <p className="text-sm text-slate-400 max-w-xl">
                      Welcome to your centralized enterprise workspace. Manage your attendance, leave applications, expense claims, and notifications securely.
                    </p>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:min-w-[220px] shadow-inner space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Employee ID</span>
                      <span className="font-mono font-bold text-indigo-300">{employee.employeeId}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Mobile</span>
                      <span className="font-mono text-white">{employee.mobileNumber}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Attendance</span>
                      <span className="font-semibold text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        {attendanceStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div 
                  onClick={() => setActiveTab('attendance')}
                  className="bg-slate-900/90 border border-slate-800/80 hover:border-indigo-500/50 transition-all rounded-2xl p-4 sm:p-5 shadow-md cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Today's Status</span>
                    <div className="p-2 rounded-xl bg-indigo-950/80 text-indigo-400 group-hover:scale-110 transition-transform">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-white">{attendanceStatus}</p>
                  <p className="text-[11px] text-indigo-400 mt-1 flex items-center gap-1 font-medium">
                    View attendance logs <ChevronRight className="w-3 h-3" />
                  </p>
                </div>

                <div 
                  onClick={() => setActiveTab('leave')}
                  className="bg-slate-900/90 border border-slate-800/80 hover:border-indigo-500/50 transition-all rounded-2xl p-4 sm:p-5 shadow-md cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Leave Balance</span>
                    <div className="p-2 rounded-xl bg-blue-950/80 text-blue-400 group-hover:scale-110 transition-transform">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white truncate">{leaveBalanceSummary}</p>
                  <p className="text-[11px] text-blue-400 mt-1 flex items-center gap-1 font-medium">
                    Apply or view leave <ChevronRight className="w-3 h-3" />
                  </p>
                </div>

                <div 
                  onClick={() => setActiveTab('expense')}
                  className="bg-slate-900/90 border border-slate-800/80 hover:border-indigo-500/50 transition-all rounded-2xl p-4 sm:p-5 shadow-md cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Pending Expenses</span>
                    <div className="p-2 rounded-xl bg-amber-950/80 text-amber-400 group-hover:scale-110 transition-transform">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-white">{pendingExpensesCount} Claims</p>
                  <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 font-medium">
                    Submit expense claim <ChevronRight className="w-3 h-3" />
                  </p>
                </div>

                <div 
                  onClick={() => setActiveTab('notifications')}
                  className="bg-slate-900/90 border border-slate-800/80 hover:border-indigo-500/50 transition-all rounded-2xl p-4 sm:p-5 shadow-md cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Notifications</span>
                    <div className="p-2 rounded-xl bg-emerald-950/80 text-emerald-400 group-hover:scale-110 transition-transform">
                      <Bell className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-white">{unreadNotificationsCount} Unread</p>
                  <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                    View bulletins <ChevronRight className="w-3 h-3" />
                  </p>
                </div>
              </div>

              {/* Feature Modules 2-Column Grid */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider px-1">Enterprise Workflows</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Attendance Card */}
                  <div 
                    onClick={() => setActiveTab('attendance')}
                    className="bg-slate-900 border border-slate-800/80 hover:border-indigo-500/60 transition-all rounded-2xl p-5 shadow-lg flex flex-col justify-between cursor-pointer group hover:shadow-indigo-500/10"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-indigo-800/50">
                        <Clock className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">Attendance & Geofence</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Check-in/out with precise GPS geofence validation for office, WFH, and client visits.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-indigo-400">
                      <span>Launch module</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Expense Card */}
                  <div 
                    onClick={() => setActiveTab('expense')}
                    className="bg-slate-900 border border-slate-800/80 hover:border-indigo-500/60 transition-all rounded-2xl p-5 shadow-lg flex flex-col justify-between cursor-pointer group hover:shadow-indigo-500/10"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-amber-800/50">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">Expense Claims</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Submit traveling, fuel, food, and hotel bills with photo attachments and instant tracking.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-amber-400">
                      <span>Launch module</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Leave Card */}
                  <div 
                    onClick={() => setActiveTab('leave')}
                    className="bg-slate-900 border border-slate-800/80 hover:border-indigo-500/60 transition-all rounded-2xl p-5 shadow-lg flex flex-col justify-between cursor-pointer group hover:shadow-indigo-500/10"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-blue-950 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-blue-800/50">
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">Leave Management</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Apply for casual, sick, or earned leaves and check live holiday calendar balances.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-blue-400">
                      <span>Launch module</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Notifications Card */}
                  <div 
                    onClick={() => setActiveTab('notifications')}
                    className="bg-slate-900 border border-slate-800/80 hover:border-indigo-500/60 transition-all rounded-2xl p-5 shadow-lg flex flex-col justify-between cursor-pointer group hover:shadow-indigo-500/10"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-emerald-800/50">
                        <Bell className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">Company Bulletins</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Read official enterprise announcements, policy updates, and broadcast alerts.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                      <span>Launch module</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Reports Card */}
                  <div 
                    onClick={() => setActiveTab('reports')}
                    className="bg-slate-900 border border-slate-800/80 hover:border-indigo-500/60 transition-all rounded-2xl p-5 shadow-lg flex flex-col justify-between cursor-pointer group hover:shadow-indigo-500/10"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-purple-800/50">
                        <BarChart3 className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">Enterprise Reports</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Access attendance summaries, monthly work hours, and expense claim analytics.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-purple-400">
                      <span>Launch module</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Profile Card */}
                  <div 
                    onClick={() => setActiveTab('profile')}
                    className="bg-slate-900 border border-slate-800/80 hover:border-indigo-500/60 transition-all rounded-2xl p-5 shadow-lg flex flex-col justify-between cursor-pointer group hover:shadow-indigo-500/10"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-cyan-800/50">
                        <User className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">Employee Profile</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        View device binding details, browser metadata, and enterprise authorization status.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-cyan-400">
                      <span>Launch module</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'attendance' && (
            <motion.div
              key="attendance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-400" /> Attendance & Geofence
                </h2>
                <button
                  onClick={() => setActiveTab('home')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
                >
                  &larr; Back to Dashboard
                </button>
              </div>
              <AttendanceModule employee={employee} isOnline={isOnline} />
            </motion.div>
          )}

          {activeTab === 'expense' && (
            <motion.div
              key="expense"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-400" /> Expense Claims
                </h2>
                <button
                  onClick={() => setActiveTab('home')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
                >
                  &larr; Back to Dashboard
                </button>
              </div>
              <ExpenseModule employee={employee} isOnline={isOnline} />
            </motion.div>
          )}

          {activeTab === 'leave' && (
            <motion.div
              key="leave"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-400" /> Leave Management
                </h2>
                <button
                  onClick={() => setActiveTab('home')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
                >
                  &larr; Back to Dashboard
                </button>
              </div>
              <LeaveModule employee={employee} isOnline={isOnline} />
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-400" /> Company Bulletins & Notifications
                </h2>
                <button
                  onClick={() => setActiveTab('home')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
                >
                  &larr; Back to Dashboard
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Recent Enterprise Broadcasts</h3>
                {notificationsList.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No active company notifications at this time.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notificationsList.map((notif: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white">{notif.title || 'Announcement'}</h4>
                          <span className="text-[10px] text-slate-500">{notif.date || 'Today'}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" /> Enterprise Reports & Analytics
                </h2>
                <button
                  onClick={() => setActiveTab('home')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
                >
                  &larr; Back to Dashboard
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Attendance Compliance</span>
                  <p className="text-2xl font-extrabold text-emerald-400">98.4%</p>
                  <p className="text-[11px] text-slate-500">Based on verified office &amp; WFH check-ins</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Leave Utilization</span>
                  <p className="text-2xl font-extrabold text-blue-400">3 Days</p>
                  <p className="text-[11px] text-slate-500">Utilized out of 37 annual allocated days</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Expense Approval Rate</span>
                  <p className="text-2xl font-extrabold text-indigo-400">100%</p>
                  <p className="text-[11px] text-slate-500">All submitted claims successfully approved</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Monthly Activity Summary</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your enterprise account is synchronized with Cloud Firestore. All logs are securely recorded and available for audit review.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-cyan-400" /> Employee Profile & Settings
                </h2>
                <button
                  onClick={() => setActiveTab('home')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
                >
                  &larr; Back to Dashboard
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 max-w-xl mx-auto">
                <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-950 text-indigo-300 font-extrabold text-2xl flex items-center justify-center border border-indigo-800/80 shadow-inner">
                    {employee.employeeName ? employee.employeeName.charAt(0).toUpperCase() : 'E'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{employee.employeeName}</h3>
                    <p className="text-xs font-mono text-indigo-400">{employee.employeeId}</p>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Status: {employee.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-indigo-400" /> Device UUID</span>
                    <span className="text-xs font-mono text-white truncate max-w-[200px]">{employee.deviceId}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5"><Tag className="w-4 h-4 text-indigo-400" /> Mobile Number</span>
                    <span className="text-xs font-mono text-white">{employee.mobileNumber}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-indigo-400" /> Browser / Client</span>
                    <span className="text-xs font-mono text-white">{employee.browserName || 'Enterprise PWA'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-indigo-400" /> Registration Date</span>
                    <span className="text-xs font-mono text-white">{employee.registrationDate ? new Date(employee.registrationDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 px-4 py-2 sm:py-3 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              activeTab === 'home' ? 'text-indigo-400 font-bold bg-indigo-950/50' : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              activeTab === 'attendance' ? 'text-indigo-400 font-bold bg-indigo-950/50' : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">Attendance</span>
          </button>

          <button
            onClick={() => setActiveTab('expense')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              activeTab === 'expense' ? 'text-indigo-400 font-bold bg-indigo-950/50' : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px]">Expense</span>
          </button>

          <button
            onClick={() => setActiveTab('leave')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              activeTab === 'leave' ? 'text-indigo-400 font-bold bg-indigo-950/50' : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px]">Leave</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
              activeTab === 'profile' ? 'text-indigo-400 font-bold bg-indigo-950/50' : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Profile</span>
          </button>

          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-950/80 border border-indigo-800/60"
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[10px]">Admin</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};

