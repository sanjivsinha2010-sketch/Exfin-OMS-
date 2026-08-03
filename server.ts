import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { collection, doc, setDoc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './src/lib/firebase';
import {
  bootstrapFirebase,
  ensureAdminAuth,
  getGeofenceSettings,
  saveGeofenceSettings,
  rollbackGeofenceSettings,
  getEmployee,
  saveEmployee,
  getAllEmployees,
  deleteEmployee,
  getAttendanceRecords,
  submitAttendance,
  getMyExpenses,
  submitExpense,
  getAllExpenses,
  updateExpenseStatus,
  editExpense,
  deleteExpense,
  getMyLeaves,
  applyLeave,
  cancelLeave,
  getAllLeaves,
  updateLeaveStatus,
  getAllLeaveBalances,
  editLeaveBalance,
  getHolidays,
  addHoliday,
  deleteHoliday,
  getSystemSetting,
  setSystemSetting,
  getExpenseCategories,
  saveExpenseCategories,
  getAuditLogs,
  getReportsSummary,
  getSheetsPreviewData,
  addAuditLog,
  getOrCreateLeaveBalance
} from './src/lib/firebaseService';

export const app = express();

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Headers for Vercel and cross-origin deployments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Lazy Bootstrap for Firebase
let bootstrapDone = false;
let bootstrapPromise: Promise<void> | null = null;

async function ensureBootstrapped() {
  if (bootstrapDone) return;
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        await ensureAdminAuth();
        await bootstrapFirebase();
        bootstrapDone = true;
      } catch (err) {
        console.error('[Firebase Bootstrap Error]:', err);
      }
    })();
  }
  await bootstrapPromise;
}

// Request logger & Firebase Auth initializer
app.use('/api', async (req, res, next) => {
  console.log(`[Backend API Request] ${req.method} ${req.url}`);
  await ensureBootstrapped();
  next();
});

// -----------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'Firestore' });
  });

  // Employee Registration
  app.post('/api/register', async (req, res) => {
    try {
      const { employeeName, mobileNumber, deviceId, userAgent, browserName, registrationDate, appVersion } = req.body;

      if (!employeeName || !mobileNumber || !deviceId) {
        return res.status(400).json({ success: false, error: 'All fields are required.' });
      }

      // Check auto-approval
      const autoApproveSetting = await getSystemSetting('AUTO_APPROVAL', 'false');
      const isAutoApprove = autoApproveSetting === 'true';

      const existingEmp = await getEmployee(deviceId);
      
      // Determine unique sequential Employee ID
      let empId = existingEmp ? existingEmp.employeeId : '';
      if (!empId) {
        const counterDocRef = doc(db, 'appSettings', 'counters');
        const counterSnap = await getDoc(counterDocRef);
        let nextId = 1001;
        if (counterSnap.exists()) {
          nextId = (counterSnap.data().employeeCounter || 1000) + 1;
        }
        await setDoc(counterDocRef, { employeeCounter: nextId }, { merge: true });
        empId = `EXF-${nextId}`;
      }

      const employeeRecord = {
        employeeId: empId,
        employeeName,
        mobileNumber,
        deviceId,
        userAgent: userAgent || 'N/A',
        browserName: browserName || 'N/A',
        registrationDate: registrationDate || new Date().toISOString(),
        appVersion: appVersion || '1.0.0',
        status: isAutoApprove ? 'Approved' : 'Pending',
        approvedAt: isAutoApprove ? new Date().toISOString() : '',
        syncedToGoogleSheets: true
      };

      await saveEmployee(employeeRecord);

      // Create empty leave balance for the new employee
      await getOrCreateLeaveBalance(empId, employeeName);

      await addAuditLog(
        deviceId,
        isAutoApprove ? 'AUTO_APPROVE_REGISTRATION' : 'SUBMIT_REGISTRATION',
        '-',
        `${employeeName} (${empId})`,
        browserName || 'Browser',
        'Success'
      );

      return res.json({
        success: true,
        employee: employeeRecord
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check Registration Status
  app.get('/api/checkRegistration', async (req, res) => {
    try {
      const deviceId = req.query.deviceId as string;
      if (!deviceId) {
        return res.status(400).json({ success: false, error: 'deviceId is required' });
      }

      const emp = await getEmployee(deviceId);
      if (emp) {
        return res.json({ success: true, registered: true, employee: emp });
      }
      return res.json({ success: true, registered: false });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/check-status', async (req, res) => {
    try {
      const deviceId = req.query.deviceId as string;
      if (!deviceId) return res.status(400).json({ success: false, error: 'deviceId required' });
      const emp = await getEmployee(deviceId);
      return res.json({ success: true, employee: emp || null });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get Geofence Coordinates
  app.get('/api/geofence', async (req, res) => {
    try {
      const settings = await getGeofenceSettings();
      return res.json({
        success: true,
        officeLat: settings.officeLat,
        officeLng: settings.officeLng,
        radiusMeters: settings.radiusMeters,
        officeName: settings.officeName,
        officeAddress: settings.officeAddress,
        version: settings.version,
        updatedBy: settings.updatedBy,
        updatedAt: settings.updatedAt
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Submit Attendance
  app.post('/api/attendance', async (req, res) => {
    try {
      const record = req.body;
      if (!record.employeeId || !record.attendanceId) {
        return res.status(400).json({ success: false, error: 'Invalid attendance data.' });
      }

      // Check Distance Calculation requirement:
      // Run ONLY for Office attendance. For WFH or Client Visit, save custom Office Name and skip.
      if (record.attendanceType === 'WFH') {
        record.distanceFromOffice = 'N/A';
        record.officeName = 'WFH';
      } else if (record.attendanceType === 'Client Visit') {
        record.distanceFromOffice = 'N/A';
        record.officeName = 'Client Site';
      }

      const saved = await submitAttendance(record);
      return res.json({ success: true, record: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get My Attendance Today
  app.get('/api/attendance', async (req, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const deviceId = req.query.deviceId as string;

      const records = await getAttendanceRecords(employeeId, deviceId);
      return res.json({ success: true, attendance: records });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Offline Sync Queue
  app.post('/api/sync', async (req, res) => {
    try {
      const { items, deviceId, browser } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }

      let empCount = 0;
      let attCount = 0;

      for (const item of items) {
        if (item.type === 'REGISTRATION') {
          await saveEmployee(item.payload);
          empCount++;
        } else if (item.type === 'ATTENDANCE') {
          await submitAttendance(item.payload);
          attCount++;
        }
      }

      await addAuditLog(deviceId, 'OFFLINE_SYNC', `Synced: ${items.length} items`, `Emps: ${empCount}, Att: ${attCount}`, browser || 'Browser', 'Success');
      return res.json({ success: true, syncedEmployees: empCount, syncedAttendance: attCount });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Auth
  app.post('/api/admin/auth', async (req, res) => {
    try {
      const { pin, deviceId, browser, isRecovery, masterPin, newPin } = req.body;

      // 1. Ensure Firebase Auth user (auth.currentUser) exists BEFORE any Firestore read
      await ensureAdminAuth();

      // 2. First Firestore query after authentication: appSettings/ADMIN_PIN
      const adminPinSnap = await getDoc(doc(db, 'appSettings', 'ADMIN_PIN'));
      let validAdminPin = '123456';
      if (adminPinSnap.exists() && adminPinSnap.data()?.value) {
        validAdminPin = adminPinSnap.data().value;
      } else {
        await setDoc(doc(db, 'appSettings', 'ADMIN_PIN'), {
          key: 'ADMIN_PIN',
          value: '123456',
          updatedAt: new Date().toISOString()
        });
      }

      const masterRecoveryPin = process.env.MASTER_RECOVERY_PIN || '999888';

      if (isRecovery) {
        if (masterPin === masterRecoveryPin) {
          if (newPin) {
            await setSystemSetting('ADMIN_PIN', newPin);
          }
          await setSystemSetting('TRUSTED_ADMIN_DEVICE_ID', deviceId);
          await setSystemSetting('TRUSTED_ADMIN_BROWSER', browser);
          await setSystemSetting('TRUSTED_ADMIN_REGDATE', new Date().toISOString());
          await setSystemSetting('TRUSTED_ADMIN_LASTLOGIN', new Date().toISOString());
          await addAuditLog(deviceId, 'EMERGENCY_RECOVERY', 'Success', 'Device authorized as Master Admin', browser, 'Success');

          return res.json({ 
            success: true, 
            role: 'Master Admin',
            email: 'sanjivsinha2010@gmail.com',
            password: 'Admin@123456'
          });
        }
        return res.status(401).json({ success: false, error: 'Invalid Master Recovery PIN.' });
      }

      let loggedIn = false;
      let role = 'Admin';

      if (pin === validAdminPin) {
        loggedIn = true;
        role = 'Admin';
      } else if (pin === '123456') { // Master PIN
        loggedIn = true;
        role = 'Master Admin';
      }

      if (!loggedIn) {
        return res.status(401).json({ success: false, error: 'Invalid PIN.' });
      }

      // Check trusted device settings
      const trustedDeviceId = await getSystemSetting('TRUSTED_ADMIN_DEVICE_ID', '');

      if (!trustedDeviceId) {
        await setDoc(doc(db, 'appSettings', 'TRUSTED_ADMIN_DEVICE_ID'), {
          key: 'TRUSTED_ADMIN_DEVICE_ID',
          value: deviceId,
          updatedAt: new Date().toISOString()
        });
        await setSystemSetting('TRUSTED_ADMIN_BROWSER', browser);
        await setSystemSetting('TRUSTED_ADMIN_REGDATE', new Date().toISOString());
      } else if (deviceId !== trustedDeviceId) {
        return res.json({ success: false, unauthorizedDevice: true, error: 'Device is not authorized for administrator access.' });
      }

      await setSystemSetting('TRUSTED_ADMIN_LASTLOGIN', new Date().toISOString());
      const adminEmail = 'sanjivsinha2010@gmail.com';
      const adminPassword = 'Admin@123456';
      await addAuditLog(deviceId, 'ADMIN_LOGIN', adminEmail, 'Login successful', browser, 'Success');

      return res.json({ 
        success: true, 
        authenticated: true,
        role: role,
        email: adminEmail,
        password: adminPassword
      });

    } catch (err: any) {
      console.error('Auth Error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Authentication error' });
    }
  });

  // System Settings
  app.get('/api/admin/settings', async (req, res) => {
    try {
      const autoApproval = await getSystemSetting('AUTO_APPROVAL', 'false');
      const scriptUrl = await getSystemSetting('GOOGLE_APPS_SCRIPT_URL', '');
      return res.json({
        success: true,
        settings: {
          AUTO_APPROVAL: autoApproval,
          GOOGLE_APPS_SCRIPT_URL: scriptUrl
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/settings', async (req, res) => {
    try {
      const { GOOGLE_APPS_SCRIPT_URL, AUTO_APPROVAL, adminDeviceId, browser } = req.body;
      if (AUTO_APPROVAL !== undefined) {
        await setSystemSetting('AUTO_APPROVAL', String(AUTO_APPROVAL));
      }
      if (GOOGLE_APPS_SCRIPT_URL !== undefined) {
        await setSystemSetting('GOOGLE_APPS_SCRIPT_URL', String(GOOGLE_APPS_SCRIPT_URL));
      }
      await addAuditLog(adminDeviceId, 'UPDATE_SETTINGS', 'Settings updated', `Auto-Approve: ${AUTO_APPROVAL}`, browser, 'Success');
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get Audit Logs
  app.get('/api/admin/audit-logs', async (req, res) => {
    try {
      const logs = await getAuditLogs();
      return res.json({ success: true, logs });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Expense Categories
  app.get('/api/expense/categories', async (req, res) => {
    try {
      const cats = await getExpenseCategories();
      return res.json({ success: true, categories: cats });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/expense/categories', async (req, res) => {
    try {
      const { categories, adminDeviceId, browser } = req.body;
      await saveExpenseCategories(categories, adminDeviceId, browser);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Employee Expenses
  app.get('/api/expense/my-expenses', async (req, res) => {
    try {
      const empId = req.query.employeeId as string;
      const exps = await getMyExpenses(empId);
      return res.json({ success: true, expenses: exps });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/expense/submit', async (req, res) => {
    try {
      const expense = req.body;
      const saved = await submitExpense(expense);
      return res.json({ success: true, expense: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Expenses
  app.get('/api/admin/expenses', async (req, res) => {
    try {
      const exps = await getAllExpenses();
      return res.json({ success: true, expenses: exps });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/expense/status', async (req, res) => {
    try {
      const { expenseId, status, adminDeviceId, browser } = req.body;
      const updated = await updateExpenseStatus(expenseId, status, adminDeviceId, browser);
      return res.json({ success: true, expense: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/expense/edit', async (req, res) => {
    try {
      const { expenseId, category, amount, description, remarks, adminDeviceId, browser } = req.body;
      const updated = await editExpense(expenseId, category, parseFloat(amount), description, remarks, adminDeviceId, browser);
      return res.json({ success: true, expense: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/expense/delete', async (req, res) => {
    try {
      const { expenseId, adminDeviceId, browser } = req.body;
      await deleteExpense(expenseId, adminDeviceId, browser);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Leave Types
  app.get('/api/leave/types', async (req, res) => {
    try {
      // List active types
      const leaveTypes = [
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
      return res.json({ success: true, leaveTypes });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Leave Balance
  app.get('/api/leave/balance', async (req, res) => {
    try {
      const { employeeId, employeeName } = req.query;
      const bal = await getOrCreateLeaveBalance(employeeId as string, employeeName as string);
      return res.json({ success: true, balance: bal });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // My Leave Applications
  app.get('/api/leave/my-leaves', async (req, res) => {
    try {
      const empId = req.query.employeeId as string;
      const leaves = await getMyLeaves(empId);
      return res.json({ success: true, leaves });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leave/apply', async (req, res) => {
    try {
      const leave = req.body;
      const saved = await applyLeave(leave);
      return res.json({ success: true, leave: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/leave/cancel', async (req, res) => {
    try {
      const { leaveId, employeeId } = req.body;
      const cancelled = await cancelLeave(leaveId, employeeId);
      return res.json({ success: true, leave: cancelled });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Leave Applications
  app.get('/api/admin/leaves', async (req, res) => {
    try {
      const leaves = await getAllLeaves();
      return res.json({ success: true, leaves });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/leave/status', async (req, res) => {
    try {
      const { leaveId, status, adminDeviceId, browser } = req.body;
      const updated = await updateLeaveStatus(leaveId, status, adminDeviceId, browser);
      return res.json({ success: true, leave: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/leave/balances', async (req, res) => {
    try {
      const bals = await getAllLeaveBalances();
      return res.json({ success: true, balances: bals });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/leave/balance', async (req, res) => {
    try {
      const balance = req.body;
      const updated = await editLeaveBalance(balance);
      return res.json({ success: true, balance: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Holidays
  app.get('/api/admin/holidays', async (req, res) => {
    try {
      const hols = await getHolidays();
      return res.json({ success: true, holidays: hols });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/holidays', async (req, res) => {
    try {
      const holiday = req.body;
      const saved = await addHoliday(holiday);
      return res.json({ success: true, holiday: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/holidays/:id', async (req, res) => {
    try {
      await deleteHoliday(req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Employees Delete
  app.post('/api/admin/employees/delete', async (req, res) => {
    try {
      const { deviceId, adminDeviceId, browser } = req.body;
      await deleteEmployee(deviceId, adminDeviceId, browser);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Dashboard Reports Summary
  app.get('/api/admin/reports', async (req, res) => {
    try {
      const summary = await getReportsSummary();
      return res.json({ success: true, reports: summary });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // List all Registered Employees
  app.get('/api/admin/employees', async (req, res) => {
    try {
      const emps = await getAllEmployees();
      return res.json({ success: true, employees: emps });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Approve employee registration
  app.post('/api/admin/approve', async (req, res) => {
    try {
      const { deviceId, status, rejectionReason, adminDeviceId, browser } = req.body;
      const emp = await getEmployee(deviceId);
      if (!emp) {
        return res.status(404).json({ success: false, error: 'Employee registration not found.' });
      }

      emp.status = status;
      emp.approvedAt = status === 'Approved' ? new Date().toISOString() : '';
      if (rejectionReason) emp.rejectionReason = rejectionReason;

      await saveEmployee(emp);

      await addAuditLog(
        adminDeviceId,
        status === 'Approved' ? 'APPROVE_EMPLOYEE' : 'REJECT_EMPLOYEE',
        emp.employeeName,
        status,
        browser,
        'Success'
      );

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Geofence Admin Endpoint
  app.post('/api/admin/geofence', async (req, res) => {
    try {
      const data = req.body;
      const nextVer = await saveGeofenceSettings(data);
      await addAuditLog(
        data.adminDeviceId,
        'UPDATE_GEOFENCE',
        `Radius: ${data.radiusMeters}m`,
        `Lat: ${data.officeLat}, Lng: ${data.officeLng}, Ver: ${nextVer}`,
        data.browser,
        'Success'
      );
      return res.json({ success: true, version: nextVer });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Rollback Geofence
  app.post('/api/admin/geofence/rollback', async (req, res) => {
    try {
      const { adminDeviceId, browser } = req.body;
      const rolled = await rollbackGeofenceSettings(adminDeviceId);
      await addAuditLog(
        adminDeviceId,
        'ROLLBACK_GEOFENCE',
        `Rollback active`,
        `Ver: ${rolled.version}`,
        browser,
        'Success'
      );
      return res.json({ success: true, ...rolled });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Trusted Device Endpoints
  app.get('/api/admin/trusted-device', async (req, res) => {
    try {
      const deviceId = await getSystemSetting('TRUSTED_ADMIN_DEVICE_ID', '');
      const browser = await getSystemSetting('TRUSTED_ADMIN_BROWSER', '');
      const regDate = await getSystemSetting('TRUSTED_ADMIN_REGDATE', '');
      const lastLogin = await getSystemSetting('TRUSTED_ADMIN_LASTLOGIN', '');

      return res.json({
        success: true,
        deviceId,
        browser,
        registrationDate: regDate,
        lastLogin
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Change Admin Pin
  app.post('/api/admin/change-pin', async (req, res) => {
    try {
      const { currentPin, newPin, adminDeviceId, browser } = req.body;
      const adminPin = await getSystemSetting('ADMIN_PIN', '123456');

      if (currentPin !== adminPin) {
        return res.status(400).json({ success: false, error: 'Current PIN is incorrect.' });
      }

      await setSystemSetting('ADMIN_PIN', newPin);
      await addAuditLog(adminDeviceId, 'CHANGE_ADMIN_PIN', 'PIN changed', 'Success', browser, 'Success');

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Sheets visual preview
  app.get('/api/sheets-preview', async (req, res) => {
    try {
      const data = await getSheetsPreviewData();
      return res.json({ success: true, sheets: data });
    } catch (err: any) {
      console.error('Sheets preview formatting error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite static file server middleware logic / Standalone server setup
  async function initStandaloneServer() {
    const PORT = 3000;

    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } else if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    if (!process.env.VERCEL) {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`EXFIN OMS Enterprise Server running on port ${PORT}`);
      });
    }
  }

  initStandaloneServer();
