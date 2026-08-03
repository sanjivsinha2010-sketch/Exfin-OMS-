import React, { useState, useEffect, useCallback } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { RegistrationScreen } from './components/RegistrationScreen';
import { WaitingScreen } from './components/WaitingScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { AdminModal } from './components/AdminModal';
import { OfflineBanner } from './components/OfflineBanner';
import { InstallPrompt } from './components/InstallPrompt';
import { getOrCreateDeviceId } from './lib/device';
import {
  saveLocalEmployee,
  getLocalEmployee,
  deleteLocalEmployee,
  getOfflineQueue,
  clearOfflineQueueItem,
} from './lib/idb';
import { Employee, DeviceMetadata } from './types';

export default function App() {
  const [screen, setScreen] = useState<'splash' | 'register' | 'waiting' | 'dashboard'>('splash');
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Refresh offline queue counter
  const updateOfflineCount = useCallback(async () => {
    try {
      const queue = await getOfflineQueue();
      setPendingOfflineCount(queue.length);
    } catch (e) {
      console.error('Error getting offline queue count:', e);
    }
  }, []);

  // Perform background approval check with Google Apps Script backend
  const performBackgroundCheck = useCallback(async (deviceId: string) => {
    if (!navigator.onLine) return;

    try {
      const res = await fetch(`/api/check-status?deviceId=${encodeURIComponent(deviceId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.employee) {
          const updatedEmp = data.employee as Employee;
          await saveLocalEmployee(updatedEmp);
          localStorage.setItem('registrationCompleted', 'true');
          if (updatedEmp.employeeId) localStorage.setItem('employeeId', updatedEmp.employeeId);
          if (updatedEmp.employeeName) localStorage.setItem('employeeName', updatedEmp.employeeName);
          if (updatedEmp.mobileNumber) localStorage.setItem('mobileNumber', updatedEmp.mobileNumber);
          
          setCurrentEmployee(updatedEmp);

          if (updatedEmp.status === 'Approved') {
            setScreen((prev) => (prev === 'waiting' ? 'dashboard' : prev));
          } else if (updatedEmp.status === 'Pending') {
            setScreen('waiting');
          } else if (updatedEmp.status === 'Rejected') {
            alert('This device is no longer authorized.');
            await handleResetRegistration();
          }
        } else if (data.success === false && (data.deleted || data.status === 'Rejected')) {
          alert('This device is no longer authorized.');
          await handleResetRegistration();
        }
      }
    } catch (e) {
      console.error('Background check error:', e);
    }
  }, []);

  // Online / Offline Status Listeners & Automatic Sync
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (reg) => console.log('[ServiceWorker] Registered with scope:', reg.scope),
          (err) => console.error('[ServiceWorker] Registration failed:', err)
        );
      });
    }

    // Capture PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Online / Offline Status Listeners
    const handleOnline = () => {
      setIsOnline(true);
      triggerAutoSync();
      const deviceId = getOrCreateDeviceId();
      if (deviceId) {
        performBackgroundCheck(deviceId);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performBackgroundCheck]);

  // Periodic Background Verification
  useEffect(() => {
    if (!currentEmployee || !isOnline) return;
    const interval = setInterval(() => {
      const deviceId = getOrCreateDeviceId();
      if (deviceId) {
        performBackgroundCheck(deviceId);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentEmployee, isOnline, performBackgroundCheck]);

  // Initialize App State from IndexedDB & LocalStorage, and trigger silent background check
  useEffect(() => {
    // Enable Admin Panel ONLY via administrator URL (/admin or ?admin)
    if (typeof window !== 'undefined' && (
      window.location.pathname.toLowerCase().includes('/admin') ||
      window.location.search.toLowerCase().includes('admin')
    )) {
      setIsAdminOpen(true);
    }

    const initApp = async () => {
      try {
        const deviceId = getOrCreateDeviceId();
        const localEmp = await getLocalEmployee(deviceId);
        await updateOfflineCount();

        // Immediately set current employee from local storage without waiting for network
        setCurrentEmployee(localEmp);

        // Perform background verification if online
        if (deviceId && navigator.onLine) {
          performBackgroundCheck(deviceId);
        }
      } catch (err) {
        console.error('Init error:', err);
      }
    };

    initApp();
  }, [updateOfflineCount, performBackgroundCheck]);

  // Handle Splash Complete: Automatically route to Dashboard, Waiting, or Registration
  const handleSplashComplete = () => {
    if (currentEmployee) {
      if (currentEmployee.status === 'Approved') {
        setScreen('dashboard');
      } else if (currentEmployee.status === 'Pending') {
        setScreen('waiting');
      } else {
        setScreen('register');
      }
    } else {
      setScreen('register');
    }
  };

  // Trigger Automatic Synchronization when online
  const triggerAutoSync = async () => {
    setIsSyncing(true);
    try {
      const queue = await getOfflineQueue();
      if (queue.length > 0) {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: queue })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.employees) {
            const deviceId = getOrCreateDeviceId();
            const matching = data.employees.find((e: Employee) => e.deviceId === deviceId);
            if (matching) {
              await saveLocalEmployee(matching);
              localStorage.setItem('registrationCompleted', 'true');
              if (matching.employeeId) localStorage.setItem('employeeId', matching.employeeId);
              if (matching.employeeName) localStorage.setItem('employeeName', matching.employeeName);
              if (matching.mobileNumber) localStorage.setItem('mobileNumber', matching.mobileNumber);
              setCurrentEmployee(matching);
            }

            // Clear processed queue
            for (const item of queue) {
              if (item.id) await clearOfflineQueueItem(item.id);
            }
          }
        }
      }
    } catch (e) {
      console.error('Auto sync error:', e);
    } finally {
      setIsSyncing(false);
      await updateOfflineCount();
    }
  };

  // Handle Employee Registration Submission
  const handleRegisterSubmit = async (
    employeeName: string,
    mobileNumber: string,
    metadata: DeviceMetadata
  ) => {
    // Check if browser is already registered
    const deviceId = metadata.deviceId;
    const existingEmp = await getLocalEmployee(deviceId);
    if (existingEmp && localStorage.getItem('registrationCompleted') === 'true' && existingEmp.status !== 'Rejected') {
      setCurrentEmployee(existingEmp);
      if (existingEmp.status === 'Approved') {
        setScreen('dashboard');
      } else {
        setScreen('waiting');
      }
      return;
    }

    const payload = {
      action: 'registerDevice',
      employeeName,
      mobileNumber,
      deviceId: metadata.deviceId,
      browser: metadata.browserName,
      userAgent: metadata.userAgent,
      appVersion: metadata.appVersion,
      timestamp: metadata.registrationDate || new Date().toISOString()
    };

    console.log('[RegisterDevice API Call] Endpoint: /api/register');
    console.log('[RegisterDevice API Call] Payload:', payload);

    let res;
    try {
      res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[RegisterDevice API Call] Response status:', res?.status, res?.statusText);
    } catch (e: any) {
      console.error('[RegisterDevice API Call] Fetch network exception:', e);
      throw new Error('Server unavailable.');
    }

    if (!res) {
      throw new Error('Server unavailable.');
    }

    let data: any = null;
    try {
      data = await res.json();
      console.log('[RegisterDevice API Call] Response data:', data);
    } catch (e: any) {
      console.error('[RegisterDevice API Call] JSON parse error:', e);
      throw new Error('Server unavailable.');
    }

    if (!data || !data.success) {
      const errMsg = (data?.error || data?.message || '').toString();
      const lower = errMsg.toLowerCase();
      if (lower.includes('already registered') || lower.includes('already exists')) {
        throw new Error('Already registered.');
      } else if (errMsg) {
        throw new Error(errMsg);
      } else {
        throw new Error('Registration failed.');
      }
    }

    const savedEmp = data.employee as Employee;
    // Save registration status permanently in browser so device registration is a one-time process
    await saveLocalEmployee(savedEmp);
    localStorage.setItem('registrationCompleted', 'true');
    localStorage.setItem('employeeId', savedEmp.employeeId || 'EXF-PENDING');
    localStorage.setItem('employeeName', savedEmp.employeeName);
    localStorage.setItem('mobileNumber', savedEmp.mobileNumber);

    setCurrentEmployee(savedEmp);

    if (savedEmp.status === 'Approved') {
      setScreen('dashboard');
    } else {
      setScreen('waiting');
    }
  };

  // Poll approval status (called by WaitingScreen automatically every 60s)
  const handleCheckStatus = async (): Promise<Employee | null> => {
    if (!currentEmployee) return currentEmployee;

    console.log('[CheckStatus API Call] Requesting status for deviceId:', currentEmployee.deviceId);

    try {
      const res = await fetch(`/api/check-status?deviceId=${encodeURIComponent(currentEmployee.deviceId)}`);
      console.log('[CheckStatus API Call] Response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[CheckStatus API Call] Response data:', data);
        if (data.success && data.employee) {
          const updatedEmp = data.employee as Employee;
          await saveLocalEmployee(updatedEmp);
          localStorage.setItem('registrationCompleted', 'true');
          if (updatedEmp.employeeId) localStorage.setItem('employeeId', updatedEmp.employeeId);
          if (updatedEmp.employeeName) localStorage.setItem('employeeName', updatedEmp.employeeName);
          if (updatedEmp.mobileNumber) localStorage.setItem('mobileNumber', updatedEmp.mobileNumber);
          setCurrentEmployee(updatedEmp);
          if (updatedEmp.status === 'Rejected') {
            await handleResetRegistration();
            return null;
          }
          return updatedEmp;
        } else if (data.success === false && data.deleted) {
          // Administrator deleted device registration
          await handleResetRegistration();
          return null;
        }
      }
    } catch (e: any) {
      console.error('[CheckStatus API Call] Fetch error:', e);
      throw new Error('Server unavailable.');
    }
    return currentEmployee;
  };

  // Handle Reset Registration (Clears registration data from local storage/IndexedDB if rejected/deleted)
  const handleResetRegistration = async () => {
    const deviceId = getOrCreateDeviceId();
    await deleteLocalEmployee(deviceId);
    localStorage.removeItem('registrationCompleted');
    localStorage.removeItem('employeeId');
    localStorage.removeItem('employeeName');
    localStorage.removeItem('mobileNumber');
    setCurrentEmployee(null);
    setScreen('register');
  };

  // Refresh Admin Data callback
  const handleRefreshEmployees = async () => {
    if (currentEmployee) {
      const updated = await handleCheckStatus();
      if (updated && updated.status === 'Approved' && screen === 'waiting') {
        setScreen('dashboard');
      }
    }
  };

  // Handle Clear Local Demo Data
  const handleClearStorage = async () => {
    await handleResetRegistration();
    setIsAdminOpen(false);
  };

  // Install PWA Prompt Action
  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted PWA installation');
        }
        setDeferredPrompt(null);
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Offline Connectivity Banner */}
      <OfflineBanner
        isOnline={isOnline}
        pendingOfflineCount={pendingOfflineCount}
        onManualSync={triggerAutoSync}
        isSyncing={isSyncing}
      />

      {/* Screen Routing */}
      {screen === 'splash' && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}

      {screen === 'register' && (
        <RegistrationScreen
          onRegisterSubmit={handleRegisterSubmit}
          isOnline={isOnline}
          pendingOfflineCount={pendingOfflineCount}
        />
      )}

      {screen === 'waiting' && currentEmployee && (
        <WaitingScreen
          employee={currentEmployee}
          onCheckStatus={handleCheckStatus}
          onApproved={(updated) => {
            setCurrentEmployee(updated);
            setScreen('dashboard');
          }}
          onReRegister={handleResetRegistration}
          onResetRegistration={handleResetRegistration}
          isOnline={isOnline}
        />
      )}

      {screen === 'dashboard' && currentEmployee && (
        <DashboardScreen
          employee={currentEmployee}
          deferredPrompt={deferredPrompt}
          onInstallPWA={handleInstallPWA}
          isOnline={isOnline}
          onOpenAdmin={() => setIsAdminOpen(true)}
        />
      )}

      {/* PWA Installation Card */}
      <InstallPrompt
        deferredPrompt={deferredPrompt}
        onInstall={handleInstallPWA}
        onDismiss={() => setDeferredPrompt(null)}
      />

      {/* Admin Panel Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onRefreshEmployees={handleRefreshEmployees}
        onClearStorage={handleClearStorage}
      />
    </div>
  );
}
