import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  X, Database, CheckCircle, RefreshCw, FileText, Shield, Layers, Settings, Trash2, MapPin, Save, RotateCcw,
  Lock, Smartphone, AlertTriangle, KeyRound, Users, Calendar, DollarSign, BarChart3, Download,
  UserCheck, Clock, Plus, Search, Building2, Activity, LogOut, Check, XCircle
} from 'lucide-react';
import { Employee } from '../types';
import { getOrCreateDeviceId, detectBrowserName } from '../lib/device';

// Haversine Distance Formula in Meters for Admin Diagnostics
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshEmployees: () => Promise<void>;
  onClearStorage: () => void;
}

type TabType =
  | 'dashboard'
  | 'approval'
  | 'attendance'
  | 'geofence'
  | 'expenses'
  | 'leave'
  | 'employees'
  | 'holidays'
  | 'reports'
  | 'settings'
  | 'audit'
  | 'sheets';

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  onRefreshEmployees,
  onClearStorage,
}) => {
  // Authentication & Trusted Device States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  
  // Emergency Recovery Modal
  const [showRecovery, setShowRecovery] = useState<boolean>(false);
  const [masterPinInput, setMasterPinInput] = useState<string>('');
  const [recoveryNewPin, setRecoveryNewPin] = useState<string>('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  // Trusted Device Information
  const [trustedDeviceInfo, setTrustedDeviceInfo] = useState<any>(null);
  const currentDeviceId = typeof window !== 'undefined' ? getOrCreateDeviceId() : '';
  const currentBrowser = typeof window !== 'undefined' ? detectBrowserName() : 'Browser';

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Admin Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sheetsData, setSheetsData] = useState<any>(null);
  const [gasUrl, setGasUrl] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [leaveTypesConfig, setLeaveTypesConfig] = useState<any[]>([]);
  const [leaveSubTab, setLeaveSubTab] = useState<'applications' | 'balances' | 'types'>('applications');
  const [editingBalance, setEditingBalance] = useState<any | null>(null);

  // EXFIN OMS EXPENSES STATE
  const [expenseCategoriesConfig, setExpenseCategoriesConfig] = useState<string[]>([]);
  const [expenseSubTab, setExpenseSubTab] = useState<'claims' | 'categories'>('claims');
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [editExpenseCategory, setEditExpenseCategory] = useState<string>('');
  const [editExpenseAmount, setEditExpenseAmount] = useState<string>('');
  const [editExpenseDesc, setEditExpenseDesc] = useState<string>('');
  const [editExpenseRemarks, setEditExpenseRemarks] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [expenseSearch, setExpenseSearch] = useState<string>('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('ALL');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<string>('ALL');
  const [holidays, setHolidays] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);

  // GeoFence Admin Config State
  const [adminLat, setAdminLat] = useState<string>('28.6139');
  const [adminLng, setAdminLng] = useState<string>('77.2090');
  const [adminRadius, setAdminRadius] = useState<string>('500');
  const [adminOfficeName, setAdminOfficeName] = useState<string>('EXFIN Head Office');
  const [adminOfficeAddress, setAdminOfficeAddress] = useState<string>('New Delhi, India');
  const [adminGeofenceVersion, setAdminGeofenceVersion] = useState<string>('1');
  const [adminGeofenceUpdatedBy, setAdminGeofenceUpdatedBy] = useState<string>('System');
  const [adminGeofenceUpdatedAt, setAdminGeofenceUpdatedAt] = useState<string>(new Date().toISOString());
  const [adminGeofenceHistory, setAdminGeofenceHistory] = useState<any[]>([]);
  const [isSavingGeofence, setIsSavingGeofence] = useState<boolean>(false);
  const [isRollingBackGeofence, setIsRollingBackGeofence] = useState<boolean>(false);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);
  const [geofenceDebugPopup, setGeofenceDebugPopup] = useState<{
    url: string;
    body: string;
    action: string;
    response: string;
    status: number;
  } | null>(null);

  // Location Debug States
  const [debugSwitchOn, setDebugSwitchOn] = useState<boolean>(() => {
    const cached = localStorage.getItem('exfin_admin_debug_switch');
    return cached === 'true'; // Defaults to false
  });
  const [debugOpen, setDebugOpen] = useState<boolean>(false);
  const [debugEmpLat, setDebugEmpLat] = useState<number | null>(null);
  const [debugEmpLng, setDebugEmpLng] = useState<number | null>(null);
  const [debugAccuracy, setDebugAccuracy] = useState<number | null>(null);
  const [debugLoading, setDebugLoading] = useState<boolean>(false);
  const [debugError, setDebugError] = useState<string | null>(null);

  const handleToggleDebugSwitch = (val: boolean) => {
    setDebugSwitchOn(val);
    localStorage.setItem('exfin_admin_debug_switch', String(val));
  };

  const runLocationDiagnostics = () => {
    setDebugLoading(true);
    setDebugError(null);
    if (!navigator.geolocation) {
      setDebugError('Geolocation is not supported by this browser.');
      setDebugLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDebugEmpLat(pos.coords.latitude);
        setDebugEmpLng(pos.coords.longitude);
        setDebugAccuracy(pos.coords.accuracy);
        setDebugLoading(false);
      },
      (err) => {
        setDebugError(`Failed to acquire GPS: ${err.message}`);
        setDebugLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Change PIN Form
  const [currentPinForm, setCurrentPinForm] = useState<string>('');
  const [newPinForm, setNewPinForm] = useState<string>('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Holiday Form
  const [newHolDate, setNewHolDate] = useState<string>('');
  const [newHolName, setNewHolName] = useState<string>('');
  const [newHolType, setNewHolType] = useState<string>('Public Holiday');

  // Search Filters
  const [empSearch, setEmpSearch] = useState<string>('');
  const [attSearch, setAttSearch] = useState<string>('');
  const [attTypeFilter, setAttTypeFilter] = useState<string>('ALL');

  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Authenticate Admin PIN & Device
  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput || pinInput.length !== 6) {
      setAuthError('Please enter a 6-digit Administrator PIN.');
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pinInput,
          deviceId: currentDeviceId,
          browser: currentBrowser
        })
      });

      const data = await res.json();

      if (data.success) {
        // Authenticate with Firebase BEFORE reading Firestore
        try {
          if (data.email && data.password) {
            await signInWithEmailAndPassword(auth, data.email, data.password);
          }
        } catch (authErr: any) {
          setAuthError('Firebase Authentication failed: ' + authErr.message);
          setIsAuthLoading(false);
          return;
        }

        setIsAuthenticated(true);
        setPinInput('');
        fetchAdminData();
      } else {
        if (data.unauthorizedDevice) {
          setAuthError('This device is not authorized for Administrator access.');
        } else {
          setAuthError(data.error || 'Authentication failed. Invalid PIN.');
        }
      }
    } catch (err: any) {
      setAuthError('Server communication error during authentication.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Emergency Recovery Submission using Master Recovery PIN
  const handleEmergencyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPinInput || masterPinInput.length !== 6) {
      setRecoveryError('Please enter a valid 6-digit Master Recovery PIN.');
      return;
    }

    setIsAuthLoading(true);
    setRecoveryError(null);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isRecovery: true,
          masterPin: masterPinInput,
          newPin: recoveryNewPin,
          deviceId: currentDeviceId,
          browser: currentBrowser
        })
      });

      const data = await res.json();

      if (data.success) {
        try {
          if (data.email && data.password) {
            await signInWithEmailAndPassword(auth, data.email, data.password);
          }
        } catch (authErr) {
           console.log("Firebase Auth error during recovery:", authErr);
        }

        setRecoverySuccess('Emergency recovery successful! Current device is now registered as Trusted Administrator Device.');
        setTimeout(() => {
          setShowRecovery(false);
          setIsAuthenticated(true);
          fetchAdminData();
        }, 1500);
      } else {
        setRecoveryError(data.error || 'Emergency recovery failed.');
      }
    } catch (err) {
      setRecoveryError('Error processing emergency recovery.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Background Auto-Refresh Polling for GeoFence settings to resolve simultaneous edits
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/geofence');
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            if (json.history) setAdminGeofenceHistory(json.history || []);
            
            const currentVerNum = parseInt(adminGeofenceVersion) || 1;
            const backendVerNum = parseInt(json.version) || 1;
            
            if (backendVerNum > currentVerNum) {
              if (json.officeLat) setAdminLat(String(json.officeLat));
              if (json.officeLng) setAdminLng(String(json.officeLng));
              if (json.radiusMeters) setAdminRadius(String(json.radiusMeters));
              if (json.officeName) setAdminOfficeName(String(json.officeName));
              if (json.officeAddress) setAdminOfficeAddress(String(json.officeAddress));
              
              setAdminGeofenceVersion(String(json.version));
              if (json.updatedBy) setAdminGeofenceUpdatedBy(String(json.updatedBy));
              if (json.updatedAt) setAdminGeofenceUpdatedAt(String(json.updatedAt));
            }
          }
        }
      } catch (err) {}
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, adminGeofenceVersion]);

  // Fetch all admin data once authenticated
  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [empRes, sheetsRes, settingsRes, geoRes, auditRes, expRes, catRes, leaveRes, leaveBalRes, leaveTypesRes, holRes, repRes, devRes] = await Promise.all([
        fetch('/api/admin/employees'),
        fetch('/api/sheets-preview'),
        fetch('/api/admin/settings'),
        fetch('/api/admin/geofence'),
        fetch('/api/admin/audit-logs'),
        fetch('/api/admin/expenses'),
        fetch('/api/expense/categories'),
        fetch('/api/admin/leaves'),
        fetch('/api/admin/leave/balances'),
        fetch('/api/leave/types'),
        fetch('/api/admin/holidays'),
        fetch('/api/admin/reports'),
        fetch('/api/admin/trusted-device')
      ]);

      if (empRes.ok) {
        const json = await empRes.json();
        if (json.success) setEmployees(json.employees || []);
      }

      if (sheetsRes.ok) {
        const json = await sheetsRes.json();
        if (json.success) setSheetsData(json.sheets);
      }

      if (settingsRes.ok) {
        const json = await settingsRes.json();
        if (json.success && json.settings) {
          setGasUrl(json.settings.GOOGLE_APPS_SCRIPT_URL || '');
        }
      }

      if (geoRes.ok) {
        const json = await geoRes.json();
        if (json.success) {
          if (json.officeLat) setAdminLat(String(json.officeLat));
          if (json.officeLng) setAdminLng(String(json.officeLng));
          if (json.radiusMeters) setAdminRadius(String(json.radiusMeters));
          if (json.officeName) setAdminOfficeName(String(json.officeName));
          if (json.officeAddress) setAdminOfficeAddress(String(json.officeAddress));
          if (json.version) setAdminGeofenceVersion(String(json.version));
          if (json.updatedBy) setAdminGeofenceUpdatedBy(String(json.updatedBy));
          if (json.updatedAt) setAdminGeofenceUpdatedAt(String(json.updatedAt));
          if (json.history) setAdminGeofenceHistory(json.history || []);
        }
      }

      if (auditRes.ok) {
        const json = await auditRes.json();
        if (json.success) setAuditLogs(json.auditLogs || []);
      }

      if (expRes.ok) {
        const json = await expRes.json();
        if (json.success) setExpenses(json.expenses || []);
      }

      if (catRes.ok) {
        const json = await catRes.json();
        if (json.success) setExpenseCategoriesConfig(json.categories || []);
      }

      if (leaveRes.ok) {
        const json = await leaveRes.json();
        if (json.success) setLeaves(json.leaves || []);
      }

      if (leaveBalRes.ok) {
        const json = await leaveBalRes.json();
        if (json.success) setLeaveBalances(json.balances || []);
      }

      if (leaveTypesRes.ok) {
        const json = await leaveTypesRes.json();
        if (json.success) setLeaveTypesConfig(json.leaveTypes || []);
      }

      if (holRes.ok) {
        const json = await holRes.json();
        if (json.success) setHolidays(json.holidays || []);
      }

      if (repRes.ok) {
        const json = await repRes.json();
        if (json.success) setReportsData(json.reports || null);
      }

      if (devRes.ok) {
        const json = await devRes.json();
        if (json.success) setTrustedDeviceInfo(json.trustedDevice || null);
      }
    } catch (err) {
      console.error('Error loading admin portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (deviceId: string, status: 'Approved' | 'Rejected') => {
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, status })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Employee registration set to ${status}!`);
        setTimeout(() => setActionSuccess(null), 3000);
        await onRefreshEmployees();
        await fetchAdminData();
      }
    } catch (e) {
      console.error('Approval error:', e);
    }
  };

  const handleDeleteEmployee = async (deviceId: string) => {
    if (!window.confirm('Are you sure you want to delete/reset registration for this employee device?')) return;
    try {
      const res = await fetch('/api/admin/employees/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, adminDeviceId: currentDeviceId, browser: currentBrowser })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Employee registration reset successfully.');
        setTimeout(() => setActionSuccess(null), 3000);
        await fetchAdminData();
      }
    } catch (e) {
      console.error('Delete employee error:', e);
    }
  };

  const handleUpdateLeaveStatus = async (leaveId: string, status: 'Approved' | 'Rejected' | 'Cancelled') => {
    try {
      const res = await fetch('/api/admin/leave/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveId,
          status,
          adminDeviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Leave application set to ${status}. Balances updated automatically!`);
        setTimeout(() => setActionSuccess(null), 3500);
        await fetchAdminData();
      }
    } catch (e) {
      console.error('Update leave status error:', e);
    }
  };

  const handleSaveLeaveBalance = async (bal: any) => {
    try {
      const res = await fetch('/api/admin/leave/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: bal.employeeId,
          employeeName: bal.employeeName,
          cl: Number(bal.cl),
          sl: Number(bal.sl),
          el: Number(bal.el),
          compOff: Number(bal.compOff),
          lwp: Number(bal.lwp),
          adminDeviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Updated leave balance for ${bal.employeeName}`);
        setTimeout(() => setActionSuccess(null), 3000);
        setEditingBalance(null);
        await fetchAdminData();
      }
    } catch (e) {
      console.error('Save leave balance error:', e);
    }
  };

  const handleUpdateLeaveTypeLimit = async (typeKey: string, newLimit: number) => {
    const updatedTypes = leaveTypesConfig.map(t =>
      t.key === typeKey ? { ...t, annualLimit: newLimit } : t
    );
    try {
      const res = await fetch('/api/admin/leave/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveTypes: updatedTypes,
          adminDeviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Leave type limit updated successfully!');
        setTimeout(() => setActionSuccess(null), 3000);
        await fetchAdminData();
      }
    } catch (e) {
      console.error('Update leave type limit error:', e);
    }
  };

  const handleSaveGeofence = async () => {
    setGeofenceError(null);
    setIsSavingGeofence(true);

    if (!adminOfficeName || adminOfficeName.trim() === '') {
      setGeofenceError('Office Name cannot be blank.');
      setIsSavingGeofence(false);
      return;
    }

    const lat = parseFloat(adminLat);
    const lng = parseFloat(adminLng);
    const radius = parseFloat(adminRadius);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setGeofenceError('Office Latitude must be a valid number between -90 and 90.');
      setIsSavingGeofence(false);
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setGeofenceError('Office Longitude must be a valid number between -180 and 180.');
      setIsSavingGeofence(false);
      return;
    }
    if (isNaN(radius) || radius <= 0) {
      setGeofenceError('GeoFence Radius must be a valid number greater than 0.');
      setIsSavingGeofence(false);
      return;
    }

    // Duplicate Check: Check if current values are exactly equal to the active database parameters
    const activeVersionData = adminGeofenceHistory.find(h => String(h.version) === adminGeofenceVersion);
    if (activeVersionData) {
      if (
        adminOfficeName.trim() === activeVersionData.officeName &&
        adminOfficeAddress.trim() === activeVersionData.officeAddress &&
        lat === activeVersionData.officeLat &&
        lng === activeVersionData.officeLng &&
        radius === activeVersionData.radiusMeters
      ) {
        setGeofenceError('Duplicate office. This configuration is identical to the current active GeoFence.');
        setIsSavingGeofence(false);
        return;
      }
    }

    try {
      const adminName = `Admin (${currentDeviceId})`;
      const requestPayload = {
        action: 'saveGeoFence',
        officeName: adminOfficeName.trim(),
        officeAddress: adminOfficeAddress.trim(),
        officeLat: lat,
        officeLng: lng,
        radiusMeters: radius,
        updatedBy: adminName,
        browser: currentBrowser,
        device: currentDeviceId
      };

      console.log('GeoFence Save Request Body:', JSON.stringify(requestPayload, null, 2));

      const res = await fetch('/api/admin/geofence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      const statusCode = res.status;
      const rawText = await res.text();

      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        console.error('Failed to parse response text:', err);
      }

      setGeofenceDebugPopup({
        url: `${window.location.origin}/api/admin/geofence`,
        body: JSON.stringify(requestPayload, null, 2),
        action: 'saveGeoFence',
        response: rawText,
        status: statusCode
      });

      if (res.ok && data.success) {
        // Update local cache
        localStorage.setItem('exfin_office_lat', String(lat));
        localStorage.setItem('exfin_office_lng', String(lng));
        localStorage.setItem('exfin_office_radius', String(radius));

        setActionSuccess('GeoFence settings saved successfully.');
        setTimeout(() => setActionSuccess(null), 3000);
        await fetchAdminData();
      } else {
        setGeofenceError(data.error || 'Failed to save GeoFence configuration.');
      }
    } catch (e: any) {
      console.error('Error saving geofence:', e);
      setGeofenceError(e.message || 'Error occurred while saving GeoFence settings.');
      setGeofenceDebugPopup({
        url: `${window.location.origin}/api/admin/geofence`,
        body: JSON.stringify({
          action: 'saveGeoFence',
          officeName: adminOfficeName.trim(),
          officeAddress: adminOfficeAddress.trim(),
          officeLat: lat,
          officeLng: lng,
          radiusMeters: radius,
          updatedBy: `Admin (${currentDeviceId})`,
          browser: currentBrowser,
          device: currentDeviceId
        }, null, 2),
        action: 'saveGeoFence',
        response: e.message || 'Network Error',
        status: 0
      });
    } finally {
      setIsSavingGeofence(false);
    }
  };

  const handleRollbackGeofence = async () => {
    setGeofenceError(null);
    setIsRollingBackGeofence(true);
    try {
      const adminName = `Admin (${currentDeviceId})`;
      const res = await fetch('/api/admin/geofence/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedBy: `${adminName} (Rollback)`,
          browser: currentBrowser,
          device: currentDeviceId
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.geofence) {
          localStorage.setItem('exfin_office_lat', String(data.geofence.officeLat));
          localStorage.setItem('exfin_office_lng', String(data.geofence.officeLng));
          localStorage.setItem('exfin_office_radius', String(data.geofence.radiusMeters));
        }

        setActionSuccess('GeoFence settings saved successfully.'); // match standard save message or show restoration success
        setTimeout(() => setActionSuccess(null), 3000);
        await fetchAdminData();
      } else {
        setGeofenceError(data.error || 'Failed to rollback GeoFence.');
      }
    } catch (e: any) {
      console.error('Error rolling back geofence:', e);
      setGeofenceError(e.message || 'Error occurred during rollback.');
    } finally {
      setIsRollingBackGeofence(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPinForm || !newPinForm || newPinForm.length !== 6) {
      setPinChangeMsg({ type: 'error', text: 'Please enter current PIN and a 6-digit new PIN.' });
      return;
    }

    try {
      const res = await fetch('/api/admin/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: currentPinForm,
          newPin: newPinForm,
          deviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        setPinChangeMsg({ type: 'success', text: 'Administrator PIN updated successfully!' });
        setCurrentPinForm('');
        setNewPinForm('');
        fetchAdminData();
      } else {
        setPinChangeMsg({ type: 'error', text: data.error || 'Failed to update PIN.' });
      }
    } catch (err) {
      setPinChangeMsg({ type: 'error', text: 'Error changing PIN.' });
    }
  };

  const handleManageTrustedDevice = async (action: 'replace' | 'remove') => {
    if (action === 'remove' && !window.confirm('Are you sure you want to remove the trusted admin device? You will need PIN/Recovery on next login.')) return;
    try {
      const res = await fetch('/api/admin/trusted-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          deviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message);
        setTimeout(() => setActionSuccess(null), 3000);
        fetchAdminData();
      }
    } catch (err) {
      console.error('Trusted device action error:', err);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolDate || !newHolName) return;
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          date: newHolDate,
          name: newHolName,
          type: newHolType,
          adminDeviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewHolDate('');
        setNewHolName('');
        setActionSuccess('Holiday added successfully.');
        setTimeout(() => setActionSuccess(null), 3000);
        fetchAdminData();
      }
    } catch (err) {
      console.error('Add holiday error:', err);
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          holidayId,
          adminDeviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchAdminData();
      }
    } catch (err) {
      console.error('Delete holiday error:', err);
    }
  };

  const handleExpenseAction = async (expenseId: string, action: 'approve' | 'reject' | 'pay' | 'delete' | 'edit', editPayload?: any) => {
    try {
      const res = await fetch('/api/admin/expense/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          expenseId,
          editPayload,
          adminDeviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Expense ${action} completed successfully.`);
        setTimeout(() => setActionSuccess(null), 3000);
        setEditingExpense(null);
        fetchAdminData();
      } else {
        alert(data.error || 'Failed to update expense.');
      }
    } catch (err) {
      console.error('Expense action error:', err);
    }
  };

  const handleAddExpenseCategory = async (categoryName: string) => {
    if (!categoryName.trim()) return;
    try {
      const res = await fetch('/api/expense/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          category: categoryName.trim(),
          adminDeviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Category added successfully.');
        setTimeout(() => setActionSuccess(null), 3000);
        fetchAdminData();
      } else {
        alert(data.error || 'Failed to add category.');
      }
    } catch (err) {
      console.error('Add category error:', err);
    }
  };

  const handleDeleteExpenseCategory = async (categoryName: string) => {
    try {
      const res = await fetch('/api/expense/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          category: categoryName,
          adminDeviceId: currentDeviceId,
          browser: currentBrowser
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Category deleted successfully.');
        setTimeout(() => setActionSuccess(null), 3000);
        fetchAdminData();
      } else {
        alert(data.error || 'Failed to delete category.');
      }
    } catch (err) {
      console.error('Delete category error:', err);
    }
  };

  const downloadExpensesCSV = () => {
    if (!expenses || expenses.length === 0) return;
    const headers = [
      'Expense ID', 'Employee ID', 'Employee Name', 'Expense Date', 'Expense Category',
      'Amount', 'Description', 'Remarks', 'Current Location Address',
      'Attachment URL', 'Status', 'Approved By', 'Approved Date', 'Paid Date', 'Created Time'
    ].join(',');

    const rows = expenses.map((row: any) => {
      const expId = row.expenseId || row.id || '';
      return [
        expId,
        row.employeeId || '',
        row.employeeName || '',
        row.expenseDate || '',
        row.category || '',
        row.amount || '',
        row.description || '',
        row.remarks || '',
        row.address || 'City Centre, Durgapur, West Bengal',
        row.attachmentUrl || '',
        row.status || '',
        row.approvedBy || '',
        row.approvedDate || '',
        row.paidDate || '',
        row.createdTime || ''
      ].map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EXFIN_Expenses_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveGasUrl = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ GOOGLE_APPS_SCRIPT_URL: gasUrl.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Web App URL saved successfully!');
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (e) {
      console.error('Error saving URL:', e);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const downloadAttendanceCSV = () => {
    if (!sheetsData?.Attendance) return;
    const items = sheetsData.Attendance;
    if (items.length === 0) return;

    const headers = Object.keys(items[0]).join(',');
    const rows = items.map((row: any) =>
      Object.values(row)
        .map((v: any) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EXFIN_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
      >
        {/* ==================== SECURITY AUTHENTICATION GATE ==================== */}
        {!isAuthenticated ? (
          <div className="p-6 sm:p-10 max-w-md w-full mx-auto my-auto space-y-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shadow-inner">
              <Shield className="w-8 h-8 text-indigo-400" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">
                Admin Security Authentication
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Enterprise Restricted Portal &bull; Enter your 6-Digit Administrator PIN
              </p>
            </div>

            {!showRecovery ? (
              <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">
                    6-Digit Administrator PIN
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="&bull;&bull;&bull;&bull;&bull;&bull;"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <KeyRound className="absolute right-3.5 top-3.5 w-5 h-5 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {authError && (
                  <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">{authError}</p>
                      {authError.includes('not authorized') && (
                        <p className="text-[11px] text-rose-200">
                          This device ID (<span className="font-mono">{currentDeviceId.slice(0, 10)}...</span>) does not match the registered Trusted Administrator Device.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-bold text-sm transition cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isAuthLoading ? 'Authenticating...' : 'Authenticate Admin Access'}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecovery(true);
                      setAuthError(null);
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition cursor-pointer font-medium"
                  >
                    Lost Trusted Device? Use Emergency Recovery
                  </button>
                </div>
              </form>
            ) : (
              /* Emergency Recovery View */
              <form onSubmit={handleEmergencyRecovery} className="space-y-4 text-left">
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs">
                  <strong className="block font-bold">Emergency Device Recovery Mode</strong>
                  Enter your 6-digit Master Recovery PIN to authorize this device as the new Trusted Administrator Device.
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">
                    Master Recovery PIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={masterPinInput}
                    onChange={(e) => setMasterPinInput(e.target.value)}
                    placeholder="Master Recovery PIN"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-lg font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Set New Administrator PIN (Optional)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={recoveryNewPin}
                    onChange={(e) => setRecoveryNewPin(e.target.value)}
                    placeholder="New 6-digit PIN"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-base font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {recoveryError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold">
                    {recoveryError}
                  </div>
                )}

                {recoverySuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-semibold">
                    {recoverySuccess}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRecovery(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isAuthLoading ? 'Recovering...' : 'Authorize Device'}
                  </button>
                </div>
              </form>
            )}

            <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Device: {currentDeviceId.slice(0, 12)}...</span>
              <button onClick={onClose} className="hover:text-slate-300 cursor-pointer">
                Cancel &amp; Return
              </button>
            </div>
          </div>
        ) : (
          /* ==================== AUTHENTICATED ADMIN DASHBOARD PORTAL ==================== */
          <>
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Exfin OMS Enterprise Admin Portal</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Lock className="w-3 h-3" /> Trusted Device Verified
                    </span>
                    <span>&bull;</span>
                    <span className="font-mono text-[11px] text-slate-500">{currentDeviceId.slice(0, 14)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAdminData}
                  title="Refresh Admin Data"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
                <button
                  onClick={() => setIsAuthenticated(false)}
                  title="Lock Admin Session"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="px-4 bg-slate-950 border-b border-slate-800 flex items-center gap-1 overflow-x-auto text-xs scrollbar-thin">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Activity },
                { id: 'approval', label: 'Approvals', icon: UserCheck, badge: employees.filter(e => e.status === 'Pending').length },
                { id: 'attendance', label: 'Attendance', icon: Clock },
                { id: 'geofence', label: 'GeoFence', icon: MapPin },
                { id: 'expenses', label: 'Expenses', icon: DollarSign },
                { id: 'leave', label: 'Leave', icon: Calendar },
                { id: 'employees', label: 'Employees', icon: Users },
                { id: 'holidays', label: 'Holidays', icon: Building2 },
                { id: 'reports', label: 'Reports', icon: BarChart3 },
                { id: 'settings', label: 'Settings', icon: Settings },
                { id: 'audit', label: 'Audit Logs', icon: Layers },
                { id: 'sheets', label: 'Live Sheets', icon: Database }
              ].map((tab) => {
                const IconComp = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`py-2.5 px-3 border-b-2 font-medium flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.badge ? (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Success Toast */}
            {actionSuccess && (
              <div className="bg-emerald-950/90 border-b border-emerald-800 text-emerald-300 text-xs px-4 py-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> {actionSuccess}
              </div>
            )}

            {/* Modal Body Scroll Container */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-slate-900">
              
              {/* ==================== TAB 1: DASHBOARD ==================== */}
              {activeTab === 'dashboard' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Registered</p>
                      <p className="text-2xl font-black text-white">{employees.length}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Pending Approvals</p>
                      <p className="text-2xl font-black text-amber-400">{employees.filter(e => e.status === 'Pending').length}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Approved Active</p>
                      <p className="text-2xl font-black text-emerald-400">{employees.filter(e => e.status === 'Approved').length}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Today's Check-ins</p>
                      <p className="text-2xl font-black text-indigo-400">{sheetsData?.Attendance?.length || 0}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-indigo-400" /> Recent Administrator Activity Stream
                    </h4>
                    <div className="space-y-2">
                      {auditLogs.slice(0, 5).map((log, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-indigo-300 font-mono">
                              {log.action}
                            </span>
                            <span className="text-slate-300 font-medium">{log.result}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">{log.date} {log.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== TAB 2: EMPLOYEE APPROVAL ==================== */}
              {activeTab === 'approval' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Device Registrations &amp; Approvals</h4>
                      <p className="text-xs text-slate-400">Review pending device authorization requests</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-medium">
                      Pending: {employees.filter(e => e.status === 'Pending').length}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                        <tr>
                          <th className="p-3">Employee Name</th>
                          <th className="p-3">Mobile</th>
                          <th className="p-3">Browser Device ID</th>
                          <th className="p-3">Browser / Platform</th>
                          <th className="p-3">Registration Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                        {employees.map((emp) => (
                          <tr key={emp.deviceId} className="hover:bg-slate-900/50 transition">
                            <td className="p-3 font-sans font-bold text-white">{emp.employeeName}</td>
                            <td className="p-3">{emp.mobileNumber}</td>
                            <td className="p-3 font-semibold text-indigo-400">{emp.deviceId.slice(0, 14)}...</td>
                            <td className="p-3 font-sans text-slate-400">{emp.browserName || 'Browser'}</td>
                            <td className="p-3 text-slate-400">
                              {emp.registrationDate ? new Date(emp.registrationDate).toLocaleDateString() : '-'}
                            </td>
                            <td className="p-3 font-sans">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                emp.status === 'Approved' ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' :
                                emp.status === 'Pending' ? 'bg-amber-950 border border-amber-800 text-amber-400' :
                                'bg-rose-950 border border-rose-800 text-rose-400'
                              }`}>
                                {emp.status}
                              </span>
                            </td>
                            <td className="p-3 font-sans text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {emp.status !== 'Approved' && (
                                  <button
                                    onClick={() => handleUpdateStatus(emp.deviceId, 'Approved')}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Approve
                                  </button>
                                )}
                                {emp.status !== 'Rejected' && (
                                  <button
                                    onClick={() => handleUpdateStatus(emp.deviceId, 'Rejected')}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ==================== TAB 3: ATTENDANCE LOGS ==================== */}
              {activeTab === 'attendance' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Attendance Audit Records</h4>
                      <p className="text-xs text-slate-400">Live employee check-in and check-out logs</p>
                    </div>
                    <button
                      onClick={downloadAttendanceCSV}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
                    >
                      <Download className="w-4 h-4" /> Download CSV Report
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                        <tr>
                          <th className="p-3">Attendance ID</th>
                          <th className="p-3">Employee</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Check-In</th>
                          <th className="p-3">Check-Out</th>
                          <th className="p-3">Client / Details</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                        {sheetsData?.Attendance?.map((a: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-3 font-semibold text-indigo-400">{a['Attendance ID']}</td>
                            <td className="p-3 font-sans font-bold text-white">{a['Employee Name']} ({a['Employee ID']})</td>
                            <td className="p-3 font-sans font-medium text-emerald-300">{a['Attendance Type']}</td>
                            <td className="p-3 text-slate-400">{a['Check-In Time'] ? new Date(a['Check-In Time']).toLocaleString() : '-'}</td>
                            <td className="p-3 text-slate-400">{a['Check-Out Time'] ? new Date(a['Check-Out Time']).toLocaleString() : '-'}</td>
                            <td className="p-3 font-sans text-slate-300">{a['Client Name'] ? `${a['Client Name']} (${a['Purpose']})` : '-'}</td>
                            <td className="p-3 font-sans">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-indigo-300 font-semibold">
                                {a['Status']}
                              </span>
                            </td>
                          </tr>
                        )) || (
                          <tr><td colSpan={7} className="p-4 text-center text-slate-500 font-sans">No attendance records found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ==================== TAB 4: GEOFENCE ==================== */}
              {activeTab === 'geofence' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-indigo-400" /> Protected GeoFenceSettings Configuration
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Office boundary parameters stored in protected sheet <strong className="text-slate-200">GeoFenceSettings</strong>. Only authenticated administrators can modify these parameters.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Office Name
                        </label>
                        <input
                          type="text"
                          value={adminOfficeName}
                          onChange={(e) => setAdminOfficeName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                          placeholder="EXFIN Head Office"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Office Address
                        </label>
                        <input
                          type="text"
                          value={adminOfficeAddress}
                          onChange={(e) => setAdminOfficeAddress(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                          placeholder="New Delhi, India"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Office Latitude
                        </label>
                        <input
                          type="text"
                          value={adminLat}
                          onChange={(e) => setAdminLat(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Office Longitude
                        </label>
                        <input
                          type="text"
                          value={adminLng}
                          onChange={(e) => setAdminLng(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          GeoFence Radius (Meters)
                        </label>
                        <input
                          type="number"
                          value={adminRadius}
                          onChange={(e) => setAdminRadius(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Version Control Metadata Display */}
                    <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl text-[11px] text-slate-400 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-300">GeoFence Version:</span>
                        <span className="font-mono text-indigo-400 font-bold bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30">v{adminGeofenceVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-300">Last Updated By:</span>
                        <span className="text-slate-400">{adminGeofenceUpdatedBy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-300">Last Updated Time:</span>
                        <span className="text-slate-400">{new Date(adminGeofenceUpdatedAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {geofenceError && (
                      <div className="p-3 bg-rose-950/40 border border-rose-900/60 text-rose-300 rounded-xl text-xs flex items-center gap-1.5 font-sans">
                        <span className="text-sm">⚠️</span>
                        <span>{geofenceError}</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      {adminGeofenceHistory.length > 1 && (
                        <button
                          type="button"
                          onClick={handleRollbackGeofence}
                          disabled={isRollingBackGeofence}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                          {isRollingBackGeofence ? 'Restoring Version...' : 'Rollback Version'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSaveGeofence}
                        disabled={isSavingGeofence}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSavingGeofence ? 'Saving Configuration...' : 'Save GeoFence Settings'}
                      </button>
                    </div>

                    {/* Temporary Testing Debug configuration */}
                    <div className="pt-4 border-t border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-300 block">Location Debug Switch</span>
                          <span className="text-[10px] text-slate-500 block">Enable or disable the hidden geolocation tester switch.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleDebugSwitch(!debugSwitchOn)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            debugSwitchOn ? 'bg-indigo-600' : 'bg-slate-800'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              debugSwitchOn ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {debugSwitchOn && (
                        <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-bold text-indigo-400 block">Geolocation Diagnostic Tester</span>
                            <span className="text-[10px] text-slate-400 block">Verify GPS accuracies, employee location drift, and geofence coordinates.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDebugOpen(true);
                              runLocationDiagnostics();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition cursor-pointer shadow-sm"
                          >
                            Launch Tester
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Diagnostic Hidden Debug Dialog (Only visible if switch is ON) */}
                    {debugSwitchOn && debugOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl relative text-left">
                          <button
                            onClick={() => setDebugOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                          >
                            <X className="w-5 h-5" />
                          </button>
                          
                          <div>
                            <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider">
                              🛠️ Location Debug Diagnostic Tool
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                              Internal testing tool for office boundary and distance calculations.
                            </p>
                          </div>

                          <div className="space-y-3 pt-2">
                            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Employee Latitude</span>
                                <span className="font-mono text-white font-bold">
                                  {debugLoading ? 'Acquiring...' : debugEmpLat !== null ? debugEmpLat.toFixed(6) : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Employee Longitude</span>
                                <span className="font-mono text-white font-bold">
                                  {debugLoading ? 'Acquiring...' : debugEmpLng !== null ? debugEmpLng.toFixed(6) : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">GPS Accuracy</span>
                                <span className="font-mono text-emerald-400 font-bold">
                                  {debugLoading ? 'Acquiring...' : debugAccuracy !== null ? `${debugAccuracy.toFixed(1)} meters` : 'N/A'}
                                </span>
                              </div>
                            </div>

                            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Office Latitude</span>
                                <span className="font-mono text-white font-bold">
                                  {adminLat ? parseFloat(adminLat).toFixed(6) : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Office Longitude</span>
                                <span className="font-mono text-white font-bold">
                                  {adminLng ? parseFloat(adminLng).toFixed(6) : 'N/A'}
                                </span>
                              </div>
                            </div>

                            <div className="p-3 bg-indigo-950/40 border border-indigo-900/60 rounded-xl flex justify-between items-center text-xs">
                              <span className="text-indigo-300 font-semibold">Calculated Distance</span>
                              <span className="font-mono text-indigo-400 font-extrabold text-sm">
                                {debugEmpLat !== null && debugEmpLng !== null && adminLat && adminLng
                                  ? `${calculateDistanceMeters(debugEmpLat, debugEmpLng, parseFloat(adminLat), parseFloat(adminLng))} meters`
                                  : 'N/A'}
                              </span>
                            </div>

                            {debugError && (
                              <p className="text-[10px] text-rose-400 bg-rose-950/20 border border-rose-900/40 p-2 rounded-lg">
                                ⚠️ {debugError}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={runLocationDiagnostics}
                              disabled={debugLoading}
                              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50"
                            >
                              {debugLoading ? 'Acquiring GPS...' : 'Refresh GPS Check'}
                            </button>
                            <button
                              onClick={() => setDebugOpen(false)}
                              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== TAB 5: EXPENSES ==================== */}
              {activeTab === 'expenses' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Expense Claims Management Portal</h4>
                      <p className="text-xs text-slate-400">Approve claims, process payments, edit entries, and manage categories</p>
                    </div>

                    {/* Sub-tabs */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
                      <button
                        onClick={() => setExpenseSubTab('claims')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                          expenseSubTab === 'claims'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Claims History ({expenses.length})
                      </button>
                      <button
                        onClick={() => setExpenseSubTab('categories')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                          expenseSubTab === 'categories'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Expense Categories
                      </button>
                    </div>
                  </div>

                  {/* SUB-TAB 1: CLAIMS LIST & ACTIONS */}
                  {expenseSubTab === 'claims' && (
                    <div className="space-y-4">
                      {/* Search and Filters Bar */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center gap-3 justify-between">
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                          {/* Search Input */}
                          <div className="relative w-full sm:w-60">
                            <input
                              type="text"
                              value={expenseSearch}
                              onChange={(e) => setExpenseSearch(e.target.value)}
                              placeholder="Search employee, ID, desc..."
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                          </div>

                          {/* Category Filter */}
                          <select
                            value={expenseCategoryFilter}
                            onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="ALL">All Categories</option>
                            {expenseCategoriesConfig.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>

                          {/* Status Filter */}
                          <select
                            value={expenseStatusFilter}
                            onChange={(e) => setExpenseStatusFilter(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="ALL">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Paid">Paid</option>
                          </select>
                        </div>

                        {/* Export Excel Button */}
                        <button
                          onClick={downloadExpensesCSV}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export Excel
                        </button>
                      </div>

                      {/* Editing Overlay/Modal inline */}
                      {editingExpense && (
                        <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/50 space-y-3">
                          <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                            Edit Expense Claim {editingExpense.expenseId || editingExpense.id}
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Category</label>
                              <select
                                value={editExpenseCategory}
                                onChange={(e) => setEditExpenseCategory(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                              >
                                {expenseCategoriesConfig.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Amount (₹)</label>
                              <input
                                type="number"
                                value={editExpenseAmount}
                                onChange={(e) => setEditExpenseAmount(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Description</label>
                              <input
                                type="text"
                                maxLength={250}
                                value={editExpenseDesc}
                                onChange={(e) => setEditExpenseDesc(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Remarks</label>
                              <input
                                type="text"
                                value={editExpenseRemarks}
                                onChange={(e) => setEditExpenseRemarks(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingExpense(null)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                const numAmt = Number(editExpenseAmount);
                                if (isNaN(numAmt) || numAmt <= 0) {
                                  alert('Amount must be greater than zero.');
                                  return;
                                }
                                if (!editExpenseDesc.trim()) {
                                  alert('Description is mandatory.');
                                  return;
                                }
                                handleExpenseAction(editingExpense.expenseId || editingExpense.id, 'edit', {
                                  category: editExpenseCategory,
                                  amount: numAmt,
                                  description: editExpenseDesc,
                                  remarks: editExpenseRemarks
                                });
                              }}
                              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Claims Table */}
                      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                            <tr>
                              <th className="p-3">Claim ID / Date</th>
                              <th className="p-3">Employee</th>
                              <th className="p-3">Category</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3">Description &amp; Remarks</th>
                              <th className="p-3">Device / GPS</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                            {expenses.filter((exp: any) => {
                              const term = expenseSearch.toLowerCase();
                              const matchesSearch =
                                !term ||
                                (exp.expenseId || exp.id || '').toLowerCase().includes(term) ||
                                (exp.employeeId || '').toLowerCase().includes(term) ||
                                (exp.employeeName || '').toLowerCase().includes(term) ||
                                (exp.description || '').toLowerCase().includes(term);

                              const matchesCategory = expenseCategoryFilter === 'ALL' || exp.category === expenseCategoryFilter;
                              const matchesStatus = expenseStatusFilter === 'ALL' || exp.status === expenseStatusFilter;

                              return matchesSearch && matchesCategory && matchesStatus;
                            }).map((exp: any) => {
                              const expId = exp.expenseId || exp.id;
                              return (
                                <tr key={expId} className="hover:bg-slate-900/45">
                                  <td className="p-3">
                                    <span className="text-indigo-400 font-semibold block">{expId}</span>
                                    <span className="text-[10px] text-slate-500 block">{exp.expenseDate}</span>
                                  </td>
                                  <td className="p-3 font-sans">
                                    <strong className="text-white block">{exp.employeeName}</strong>
                                    <span className="text-[10px] text-slate-500 font-mono">{exp.employeeId}</span>
                                  </td>
                                  <td className="p-3 font-sans text-slate-300 font-medium">{exp.category}</td>
                                  <td className="p-3 font-bold text-emerald-400">₹{Number(exp.amount).toLocaleString('en-IN')}</td>
                                  <td className="p-3 font-sans text-slate-400 max-w-xs">
                                    <p className="line-clamp-2" title={exp.description}>{exp.description}</p>
                                    {exp.remarks && (
                                      <p className="text-[10px] text-slate-500 italic mt-0.5">Remarks: {exp.remarks}</p>
                                    )}
                                    {exp.attachmentUrl && (
                                      <a
                                        href={exp.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block mt-1 text-[10px] text-indigo-400 hover:underline font-bold"
                                      >
                                        View Attachment
                                      </a>
                                    )}
                                  </td>
                                  <td className="p-3 font-mono text-[10px] text-slate-500 max-w-xxs truncate">
                                    <span className="block" title={`Device ID: ${exp.deviceId}`}>Dev: {exp.deviceId}</span>
                                    <span className="block text-[9px] truncate" title={exp.address}>{exp.address || 'GPS Verified'}</span>
                                  </td>
                                  <td className="p-3 font-sans">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
                                  </td>
                                  <td className="p-3 font-sans text-right">
                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                      {exp.status === 'Pending' && (
                                        <>
                                          <button
                                            onClick={() => handleExpenseAction(expId, 'approve')}
                                            className="px-2 py-1 rounded bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 font-semibold text-[10px] transition cursor-pointer"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => handleExpenseAction(expId, 'reject')}
                                            className="px-2 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-semibold text-[10px] transition cursor-pointer"
                                          >
                                            Reject
                                          </button>
                                        </>
                                      )}
                                      {exp.status === 'Approved' && (
                                        <button
                                          onClick={() => handleExpenseAction(expId, 'pay')}
                                          className="px-2 py-1 rounded bg-sky-900/80 hover:bg-sky-800 text-sky-200 font-semibold text-[10px] transition cursor-pointer"
                                        >
                                          Mark Paid
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          setEditingExpense(exp);
                                          setEditExpenseCategory(exp.category);
                                          setEditExpenseAmount(String(exp.amount));
                                          setEditExpenseDesc(exp.description);
                                          setEditExpenseRemarks(exp.remarks || '');
                                        }}
                                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[10px] transition cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm('Are you sure you want to delete this claim?')) {
                                            handleExpenseAction(expId, 'delete');
                                          }
                                        }}
                                        className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-semibold text-[10px] transition cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {expenses.length === 0 && (
                              <tr>
                                <td colSpan={8} className="p-6 text-center text-slate-500 font-sans">
                                  No expense claims recorded
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: CATEGORY SETTINGS */}
                  {expenseSubTab === 'categories' && (
                    <div className="space-y-4 max-w-xl">
                      {/* Add Category Form */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                        <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                          Add New Expense Category
                        </h5>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="e.g. Broadband / Stationery"
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            onClick={() => {
                              if (!newCategoryName.trim()) return;
                              handleAddExpenseCategory(newCategoryName);
                              setNewCategoryName('');
                            }}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Category
                          </button>
                        </div>
                      </div>

                      {/* Categories List */}
                      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                            <tr>
                              <th className="p-3">Category Name</th>
                              <th className="p-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-300 font-sans">
                            {expenseCategoriesConfig.map((cat) => (
                              <tr key={cat} className="hover:bg-slate-900/40">
                                <td className="p-3 font-bold text-white text-xs">{cat}</td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => {
                                      if (confirm(`Delete category "${cat}"? This will not affect existing claims.`)) {
                                        handleDeleteExpenseCategory(cat);
                                      }
                                    }}
                                    className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 inline" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {expenseCategoriesConfig.length === 0 && (
                              <tr>
                                <td colSpan={2} className="p-4 text-center text-slate-500">
                                  No categories configured
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== TAB 6: LEAVE MANAGEMENT ==================== */}
              {activeTab === 'leave' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Leave Management Portal</h4>
                      <p className="text-xs text-slate-400">Approve leave applications, edit balances &amp; configure limits</p>
                    </div>

                    {/* Sub-tabs */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
                      <button
                        onClick={() => setLeaveSubTab('applications')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                          leaveSubTab === 'applications'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Leave Requests ({leaves.length})
                      </button>
                      <button
                        onClick={() => setLeaveSubTab('balances')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                          leaveSubTab === 'balances'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Employee Balances
                      </button>
                      <button
                        onClick={() => setLeaveSubTab('types')}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                          leaveSubTab === 'types'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Configure Leave Types
                      </button>
                    </div>
                  </div>

                  {/* SUB-TAB 1: LEAVE APPLICATIONS & WORKFLOW */}
                  {leaveSubTab === 'applications' && (
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                          <tr>
                            <th className="p-3">Leave ID</th>
                            <th className="p-3">Employee</th>
                            <th className="p-3">Leave Type</th>
                            <th className="p-3">Dates</th>
                            <th className="p-3">Total Days</th>
                            <th className="p-3">Reason</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Approval Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                          {leaves.map((lve) => (
                            <tr key={lve.leaveId || lve.id}>
                              <td className="p-3 text-indigo-400 font-semibold">{lve.leaveId || lve.id}</td>
                              <td className="p-3 font-sans">
                                <strong className="text-white block">{lve.employeeName}</strong>
                                <span className="text-[10px] text-slate-500">{lve.employeeId}</span>
                              </td>
                              <td className="p-3 font-sans font-medium text-slate-200">{lve.leaveType}</td>
                              <td className="p-3 text-slate-400">
                                {lve.fromDate || lve.startDate} to {lve.toDate || lve.endDate}
                              </td>
                              <td className="p-3 font-bold text-indigo-300">{lve.totalDays || 1} Day(s)</td>
                              <td className="p-3 font-sans text-slate-400 max-w-xs truncate" title={lve.reason}>
                                {lve.reason}
                              </td>
                              <td className="p-3 font-sans">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  lve.status === 'Approved'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : lve.status === 'Rejected'
                                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                    : lve.status === 'Cancelled'
                                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                                }`}>
                                  {lve.status}
                                </span>
                              </td>
                              <td className="p-3 font-sans text-right">
                                {lve.status === 'Pending' ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleUpdateLeaveStatus(lve.leaveId || lve.id, 'Approved')}
                                      className="px-2.5 py-1 rounded bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
                                    >
                                      <Check className="w-3 h-3" /> Approve
                                    </button>
                                    <button
                                      onClick={() => handleUpdateLeaveStatus(lve.leaveId || lve.id, 'Rejected')}
                                      className="px-2.5 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
                                    >
                                      <XCircle className="w-3 h-3" /> Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    Processed
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {leaves.length === 0 && (
                            <tr><td colSpan={8} className="p-6 text-center text-slate-500 font-sans">No leave requests recorded</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SUB-TAB 2: EMPLOYEE LEAVE BALANCES */}
                  {leaveSubTab === 'balances' && (
                    <div className="space-y-4">
                      {editingBalance ? (
                        <div className="p-4 rounded-xl bg-slate-950 border border-indigo-800 space-y-3">
                          <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                            Edit Leave Balance for {editingBalance.employeeName} ({editingBalance.employeeId})
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                            <div>
                              <label className="text-slate-400 font-medium block mb-1">CL (Casual)</label>
                              <input
                                type="number"
                                value={editingBalance.cl}
                                onChange={(e) => setEditingBalance({ ...editingBalance, cl: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 font-medium block mb-1">SL (Sick)</label>
                              <input
                                type="number"
                                value={editingBalance.sl}
                                onChange={(e) => setEditingBalance({ ...editingBalance, sl: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 font-medium block mb-1">EL (Earned)</label>
                              <input
                                type="number"
                                value={editingBalance.el}
                                onChange={(e) => setEditingBalance({ ...editingBalance, el: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 font-medium block mb-1">Comp Off</label>
                              <input
                                type="number"
                                value={editingBalance.compOff}
                                onChange={(e) => setEditingBalance({ ...editingBalance, compOff: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 font-medium block mb-1">LWP Taken</label>
                              <input
                                type="number"
                                value={editingBalance.lwp}
                                onChange={(e) => setEditingBalance({ ...editingBalance, lwp: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              onClick={() => setEditingBalance(null)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveLeaveBalance(editingBalance)}
                              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer"
                            >
                              Save Balance Changes
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                            <tr>
                              <th className="p-3">Employee ID</th>
                              <th className="p-3">Employee Name</th>
                              <th className="p-3">CL</th>
                              <th className="p-3">SL</th>
                              <th className="p-3">EL</th>
                              <th className="p-3">Comp Off</th>
                              <th className="p-3">LWP</th>
                              <th className="p-3">Last Updated</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                            {leaveBalances.map((bal) => (
                              <tr key={bal.employeeId}>
                                <td className="p-3 text-indigo-400 font-semibold">{bal.employeeId}</td>
                                <td className="p-3 font-sans font-bold text-white">{bal.employeeName}</td>
                                <td className="p-3 text-emerald-400 font-bold">{bal.cl}</td>
                                <td className="p-3 text-emerald-400 font-bold">{bal.sl}</td>
                                <td className="p-3 text-emerald-400 font-bold">{bal.el}</td>
                                <td className="p-3 text-indigo-300 font-bold">{bal.compOff}</td>
                                <td className="p-3 text-amber-400 font-bold">{bal.lwp}</td>
                                <td className="p-3 text-slate-500">{new Date(bal.lastUpdated).toLocaleDateString()}</td>
                                <td className="p-3 text-right font-sans">
                                  <button
                                    onClick={() => setEditingBalance(bal)}
                                    className="px-2.5 py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 font-semibold text-[11px] transition cursor-pointer"
                                  >
                                    Edit Balance
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {leaveBalances.length === 0 && (
                              <tr><td colSpan={9} className="p-6 text-center text-slate-500 font-sans">No employee balances recorded</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 3: CONFIGURE LEAVE TYPES */}
                  {leaveSubTab === 'types' && (
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-4">
                      <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                        Configurable Enterprise Leave Types &amp; Annual Limits
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {leaveTypesConfig.map((lt) => (
                          <div
                            key={lt.key}
                            className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-white block">{lt.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Key: {lt.key}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-[11px]">Limit/Yr:</span>
                              <input
                                type="number"
                                value={lt.annualLimit}
                                onChange={(e) => handleUpdateLeaveTypeLimit(lt.key, Number(e.target.value))}
                                className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center font-mono text-white text-xs focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== TAB 7: EMPLOYEE MANAGEMENT ==================== */}
              {activeTab === 'employees' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Employee Master Directory</h4>
                      <p className="text-xs text-slate-400">View and reset employee device authorizations</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                        <tr>
                          <th className="p-3">Employee ID</th>
                          <th className="p-3">Name</th>
                          <th className="p-3">Mobile</th>
                          <th className="p-3">Device ID</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Reset Registration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                        {employees.map((emp) => (
                          <tr key={emp.deviceId}>
                            <td className="p-3 font-semibold text-indigo-400">{emp.employeeId}</td>
                            <td className="p-3 font-sans font-bold text-white">{emp.employeeName}</td>
                            <td className="p-3">{emp.mobileNumber}</td>
                            <td className="p-3 text-slate-400">{emp.deviceId}</td>
                            <td className="p-3 font-sans">{emp.status}</td>
                            <td className="p-3 font-sans text-right">
                              <button
                                onClick={() => handleDeleteEmployee(emp.deviceId)}
                                className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-300 font-semibold text-[11px] transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Reset
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ==================== TAB 8: HOLIDAYS ==================== */}
              {activeTab === 'holidays' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-indigo-400" /> Add Official Company Holiday
                    </h4>
                    <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input
                        type="date"
                        value={newHolDate}
                        onChange={(e) => setNewHolDate(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Holiday Name (e.g. Independence Day)"
                        value={newHolName}
                        onChange={(e) => setNewHolName(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        required
                      />
                      <select
                        value={newHolType}
                        onChange={(e) => setNewHolType(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Public Holiday">Public Holiday</option>
                        <option value="Festival">Festival</option>
                        <option value="Company Event">Company Event</option>
                      </select>
                      <button
                        type="submit"
                        className="py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow-md"
                      >
                        Add Holiday
                      </button>
                    </form>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Holiday Name</th>
                          <th className="p-3">Type</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                        {holidays.map((h) => (
                          <tr key={h.id}>
                            <td className="p-3 text-indigo-400 font-semibold">{h.date}</td>
                            <td className="p-3 font-sans font-bold text-white">{h.name}</td>
                            <td className="p-3 font-sans text-slate-300">{h.type}</td>
                            <td className="p-3 font-sans text-right">
                              <button
                                onClick={() => handleDeleteHoliday(h.id)}
                                className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px] font-semibold cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ==================== TAB 9: REPORTS ==================== */}
              {activeTab === 'reports' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase">Approved Rate</p>
                      <p className="text-xl font-black text-emerald-400">
                        {reportsData?.totalEmployees ? Math.round((reportsData.approvedEmployees / reportsData.totalEmployees) * 100) : 100}%
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase">Office Check-ins</p>
                      <p className="text-xl font-black text-indigo-400">{reportsData?.officeAttendance || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase">Audit Log Volume</p>
                      <p className="text-xl font-black text-white">{reportsData?.totalAuditLogs || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== TAB 10: SYSTEM SETTINGS ==================== */}
              {activeTab === 'settings' && (
                <div className="space-y-5">
                  {/* Web App URL - Fully retired in favor of direct Firebase integration */}
                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-indigo-400" /> Cloud Firestore &amp; Firebase Security Status
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      This application has been successfully migrated to an enterprise-grade, high-availability <strong className="text-white">Cloud Firestore</strong> backend with role-based access controls. All legacy dependencies on Google Sheets and Google Apps Script have been fully retired to eliminate rate limits, quota limits, and database locks.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                        Database: Cloud Firestore Active
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                        Authentication: Firebase Auth Active
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                        Apps Script: Retired
                      </span>
                    </div>
                  </div>

                  {/* Change Admin PIN */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-indigo-400" /> Change Administrator PIN
                    </h4>
                    <form onSubmit={handleChangePin} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="Current 6-Digit PIN"
                        value={currentPinForm}
                        onChange={(e) => setCurrentPinForm(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="New 6-Digit PIN"
                        value={newPinForm}
                        onChange={(e) => setNewPinForm(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        className="py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow-md"
                      >
                        Update Admin PIN
                      </button>
                    </form>
                    {pinChangeMsg && (
                      <p className={`text-xs font-semibold ${pinChangeMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pinChangeMsg.text}
                      </p>
                    )}
                  </div>

                  {/* Trusted Device Management */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-400" /> Admin Trusted Device Management
                    </h4>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1 font-mono text-slate-300">
                      <p><strong className="text-slate-100 font-sans">Trusted Device ID:</strong> {trustedDeviceInfo?.deviceId || 'None Registered'}</p>
                      <p><strong className="text-slate-100 font-sans">Browser Info:</strong> {trustedDeviceInfo?.browser || '-'}</p>
                      <p><strong className="text-slate-100 font-sans">Registration Date:</strong> {trustedDeviceInfo?.registrationDate ? new Date(trustedDeviceInfo.registrationDate).toLocaleString() : '-'}</p>
                      <p><strong className="text-slate-100 font-sans">Last Login Time:</strong> {trustedDeviceInfo?.lastLogin ? new Date(trustedDeviceInfo.lastLogin).toLocaleString() : '-'}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => handleManageTrustedDevice('replace')}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer shadow-md"
                      >
                        Replace Trusted Device with Current
                      </button>
                      <button
                        onClick={() => handleManageTrustedDevice('remove')}
                        className="px-3.5 py-2 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-semibold text-xs transition cursor-pointer"
                      >
                        Remove Trusted Device
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== TAB 11: AUDIT LOGS ==================== */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Protected AuditLog Records</h4>
                      <p className="text-xs text-slate-400">Security audit records stored in hidden protected sheet <strong className="text-slate-200">AuditLog</strong></p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                        <tr>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Admin Device ID</th>
                          <th className="p-2.5">Action</th>
                          <th className="p-2.5">Old Value</th>
                          <th className="p-2.5">New Value</th>
                          <th className="p-2.5">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-900/50">
                            <td className="p-2.5">{log.date}</td>
                            <td className="p-2.5">{log.time}</td>
                            <td className="p-2.5 text-indigo-400 font-semibold">{log.adminDeviceId.slice(0, 10)}...</td>
                            <td className="p-2.5 font-sans font-bold text-amber-300">{log.action}</td>
                            <td className="p-2.5 text-slate-400">{log.oldValue}</td>
                            <td className="p-2.5 text-slate-400">{log.newValue}</td>
                            <td className="p-2.5 font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.result.includes('SUCCESS') ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                              }`}>
                                {log.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ==================== TAB 12: LIVE SHEETS ==================== */}
              {activeTab === 'sheets' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Live enterprise database sheet synchronization: <strong className="text-slate-200">Employees</strong>, <strong className="text-slate-200">Attendance</strong>, <strong className="text-slate-200">SyncLog</strong>, and protected <strong className="text-slate-200">SystemSettings</strong>.
                  </p>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Employees Table
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs font-mono">
                      <pre className="text-[11px] text-slate-300">{JSON.stringify(sheetsData?.Employees || [], null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 text-slate-400 text-center text-xs">
              Exfin OMS Protected Enterprise Administration Portal &bull; System Active &amp; Verified
            </div>
          </>
        )}
      </motion.div>

      {geofenceDebugPopup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 font-sans text-left">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <span className="text-xs uppercase font-mono tracking-wider text-indigo-400 font-bold">GeoFence Request Debugger</span>
              <button
                type="button"
                onClick={() => setGeofenceDebugPopup(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 font-semibold block mb-1 font-sans">1. Exact POST URL:</span>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-200 select-all break-all">{geofenceDebugPopup.url}</div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1 font-sans">2. Complete JSON Request Body:</span>
                <pre className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-200 overflow-x-auto whitespace-pre-wrap select-all break-all">{geofenceDebugPopup.body}</pre>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1 font-sans">3. Action Value:</span>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-200 select-all font-bold text-amber-400">{geofenceDebugPopup.action}</div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1 font-sans">4. Raw HTTP Response:</span>
                <pre className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-200 overflow-x-auto whitespace-pre-wrap select-all break-all">{geofenceDebugPopup.response}</pre>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1 font-sans">5. HTTP Status Code:</span>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-200 select-all font-bold text-emerald-400">{geofenceDebugPopup.status}</div>
              </div>
            </div>
            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setGeofenceDebugPopup(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
