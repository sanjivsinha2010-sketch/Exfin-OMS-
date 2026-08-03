import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from 'firebase/auth';
import { db, auth, uploadBase64File } from './firebase';

// Helper to write to Firestore Audit Logs
export async function addAuditLog(
  adminDeviceId: string,
  action: string,
  oldValue: string,
  newValue: string,
  browser: string,
  result: string
) {
  try {
    const now = new Date();
    const logId = `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      adminDeviceId: adminDeviceId || 'UNKNOWN_DEVICE',
      action,
      oldValue: oldValue || '-',
      newValue: newValue || '-',
      browser: browser || 'Browser',
      result,
      timestamp: now.toISOString()
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Leave Balance Management
export async function getOrCreateLeaveBalance(employeeId: string, employeeName: string): Promise<any> {
  const balRef = doc(db, 'leaveBalances', employeeId);
  const snap = await getDoc(balRef);
  if (!snap.exists()) {
    const defaultBalance = {
      employeeId,
      employeeName: employeeName || 'Employee',
      cl: 12,
      sl: 10,
      el: 15,
      compOff: 2,
      lwp: 0,
      lastUpdated: new Date().toISOString()
    };
    await setDoc(balRef, defaultBalance);
    return defaultBalance;
  }
  return snap.data();
}

// Calculate total leave days excluding active holidays
export async function calculateTotalLeaveDays(fromDateStr: string, toDateStr: string, isHalfDay: boolean): Promise<number> {
  if (isHalfDay) return 0.5;
  const start = new Date(fromDateStr);
  const end = new Date(toDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  const holSnap = await getDocs(collection(db, 'holidays'));
  const holidayDates = new Set<string>();
  holSnap.forEach(d => {
    const hol = d.data();
    if (hol.status === 'Active' && hol.date) {
      holidayDates.add(hol.date);
    }
  });

  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const curStr = cur.toISOString().split('T')[0];
    if (!holidayDates.has(curStr)) {
      days++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days > 0 ? days : 1;
}

// Get Geofence config
export async function getGeofenceSettings(): Promise<any> {
  const geoRef = doc(db, 'appSettings', 'geofence');
  const snap = await getDoc(geoRef);
  if (snap.exists()) {
    const data = snap.data();
    return {
      officeLat: parseFloat(data.officeLat || '28.6139'),
      officeLng: parseFloat(data.officeLng || '77.2090'),
      radiusMeters: parseFloat(data.radiusMeters || '500'),
      officeName: data.officeName || 'EXFIN Head Office',
      officeAddress: data.officeAddress || 'New Delhi, India',
      version: data.version || '1',
      updatedBy: data.updatedBy || 'System',
      updatedAt: data.updatedAt || new Date().toISOString()
    };
  }
  return {
    officeLat: 28.6139,
    officeLng: 77.2090,
    radiusMeters: 500,
    officeName: 'EXFIN Head Office',
    officeAddress: 'New Delhi, India',
    version: '1',
    updatedBy: 'System',
    updatedAt: new Date().toISOString()
  };
}

// Save Geofence settings and add to history log
export async function saveGeofenceSettings(data: any): Promise<string> {
  const current = await getGeofenceSettings();
  const nextVersion = String((parseInt(current.version) || 1) + 1);
  const nowIso = new Date().toISOString();

  // Save active configuration
  await setDoc(doc(db, 'appSettings', 'geofence'), {
    officeLat: String(data.officeLat),
    officeLng: String(data.officeLng),
    radiusMeters: String(data.radiusMeters),
    officeName: data.officeName,
    officeAddress: data.officeAddress,
    version: nextVersion,
    updatedBy: data.updatedBy,
    updatedAt: nowIso
  });

  // Log in history collection
  await setDoc(doc(db, 'geofence', nextVersion), {
    officeLat: data.officeLat,
    officeLng: data.officeLng,
    radiusMeters: data.radiusMeters,
    officeName: data.officeName,
    officeAddress: data.officeAddress,
    version: nextVersion,
    updatedBy: data.updatedBy,
    updatedAt: nowIso
  });

  return nextVersion;
}

// Rollback Geofence settings to previous version
export async function rollbackGeofenceSettings(updatedBy: string): Promise<any> {
  const current = await getGeofenceSettings();
  const currentVer = parseInt(current.version) || 1;
  if (currentVer <= 1) {
    throw new Error('No previous version exists to rollback to.');
  }

  const prevVer = String(currentVer - 1);
  const prevSnap = await getDoc(doc(db, 'geofence', prevVer));
  if (!prevSnap.exists()) {
    throw new Error(`Geofence configuration version ${prevVer} not found.`);
  }

  const prevData = prevSnap.data();
  const nowIso = new Date().toISOString();
  const nextVer = String(currentVer + 1);

  // Write new rollback version as active
  const rollbackConfig = {
    officeLat: String(prevData.officeLat),
    officeLng: String(prevData.officeLng),
    radiusMeters: String(prevData.radiusMeters),
    officeName: prevData.officeName,
    officeAddress: prevData.officeAddress,
    version: nextVer,
    updatedBy: updatedBy || 'Rollback',
    updatedAt: nowIso
  };

  await setDoc(doc(db, 'appSettings', 'geofence'), rollbackConfig);

  // Add rollback version to history
  await setDoc(doc(db, 'geofence', nextVer), {
    officeLat: prevData.officeLat,
    officeLng: prevData.officeLng,
    radiusMeters: prevData.radiusMeters,
    officeName: prevData.officeName,
    officeAddress: prevData.officeAddress,
    version: nextVer,
    updatedBy: updatedBy || 'Rollback',
    updatedAt: nowIso
  });

  return rollbackConfig;
}

// -----------------------------------------------------------------
// EMPLOYEE REGISTER & RETRIEVAL
// -----------------------------------------------------------------

export async function getEmployee(deviceId: string): Promise<any | null> {
  const docSnap = await getDoc(doc(db, 'employees', deviceId));
  return docSnap.exists() ? docSnap.data() : null;
}

export async function saveEmployee(employee: any): Promise<void> {
  await setDoc(doc(db, 'employees', employee.deviceId), employee, { merge: true });
}

export async function getAllEmployees(): Promise<any[]> {
  const qSnap = await getDocs(collection(db, 'employees'));
  const emps: any[] = [];
  qSnap.forEach(d => emps.push(d.data()));
  return emps;
}

export async function deleteEmployee(deviceId: string, adminDeviceId: string, browser: string): Promise<void> {
  const emp = await getEmployee(deviceId);
  const empName = emp ? emp.employeeName : deviceId;
  await deleteDoc(doc(db, 'employees', deviceId));
  await addAuditLog(adminDeviceId, 'DELETE_EMPLOYEE', empName, 'Deleted', browser, 'Success');
}

// -----------------------------------------------------------------
// ATTENDANCE MANAGEMENT
// -----------------------------------------------------------------

export async function getAttendanceRecords(employeeId?: string, deviceId?: string): Promise<any[]> {
  const qSnap = await getDocs(collection(db, 'attendance'));
  const records: any[] = [];
  qSnap.forEach(d => {
    const data = d.data();
    if (employeeId && data.employeeId === employeeId) {
      records.push(data);
    } else if (deviceId && data.deviceId === deviceId) {
      records.push(data);
    } else if (!employeeId && !deviceId) {
      records.push(data);
    }
  });
  return records;
}

export async function submitAttendance(record: any): Promise<any> {
  // If it's a Check-Out and for OFFICE attendance, find and merge with corresponding Checked In record for today
  if (record.checkOutTime && record.attendanceType === 'OFFICE') {
    const todayStr = record.checkOutTime.split(' ')[0] || new Date().toISOString().split('T')[0];
    const qSnap = await getDocs(collection(db, 'attendance'));
    let matchedDocId: string | null = null;
    let matchedRecord: any = null;

    qSnap.forEach(d => {
      const data = d.data();
      if (data.employeeId === record.employeeId && 
          data.attendanceType === 'OFFICE' && 
          data.status === 'Checked In' && 
          data.checkInTime && 
          data.checkInTime.startsWith(todayStr)) {
        matchedDocId = d.id;
        matchedRecord = data;
      }
    });

    if (matchedDocId && matchedRecord) {
      const updated = {
        ...matchedRecord,
        checkOutTime: record.checkOutTime,
        status: 'Checked Out',
        remarks: record.remarks || matchedRecord.remarks,
        address: record.address || matchedRecord.address
      };
      await setDoc(doc(db, 'attendance', matchedDocId), updated, { merge: true });
      return updated;
    }
  }

  // Create new attendance record
  await setDoc(doc(db, 'attendance', record.attendanceId), record);
  return record;
}

// -----------------------------------------------------------------
// EXPENSE MANAGEMENT
// -----------------------------------------------------------------

export async function getMyExpenses(employeeId: string): Promise<any[]> {
  const qSnap = await getDocs(collection(db, 'expenses'));
  const expenses: any[] = [];
  qSnap.forEach(d => {
    const data = d.data();
    if (data.employeeId === employeeId) {
      expenses.push(data);
    }
  });
  return expenses;
}

export async function submitExpense(expense: any): Promise<any> {
  // Check if attachment is base64; upload to Firebase Storage if yes
  if (expense.attachmentUrl && expense.attachmentUrl.startsWith('data:')) {
    console.log(`Uploading expense bill to Firebase Storage: ${expense.expenseId}`);
    const storagePath = `expenses/${expense.employeeId}/${expense.expenseId}.png`;
    const downloadUrl = await uploadBase64File(expense.attachmentUrl, storagePath);
    expense.attachmentUrl = downloadUrl;
  }

  await setDoc(doc(db, 'expenses', expense.expenseId), expense);
  return expense;
}

export async function getAllExpenses(): Promise<any[]> {
  const qSnap = await getDocs(collection(db, 'expenses'));
  const expenses: any[] = [];
  qSnap.forEach(d => expenses.push(d.data()));
  return expenses;
}

export async function updateExpenseStatus(
  expenseId: string, 
  status: string, 
  adminDeviceId: string, 
  browser: string
): Promise<any> {
  const docRef = doc(db, 'expenses', expenseId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Expense record not found.');
  }

  const current = snap.data();
  const oldVal = current.status || 'Pending';
  const updated: any = { status };

  const nowStr = new Date().toISOString().split('T')[0];
  if (status === 'Approved') {
    updated.approvedBy = 'Administrator';
    updated.approvedDate = nowStr;
  } else if (status === 'Paid') {
    updated.paidDate = nowStr;
  }

  await setDoc(docRef, updated, { merge: true });
  await addAuditLog(adminDeviceId, 'UPDATE_EXPENSE_STATUS', `${expenseId} Status: ${oldVal}`, status, browser, 'Success');

  return { ...current, ...updated };
}

export async function editExpense(
  expenseId: string,
  category: string,
  amount: number,
  description: string,
  remarks: string,
  adminDeviceId: string,
  browser: string
): Promise<any> {
  const docRef = doc(db, 'expenses', expenseId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Expense record not found.');
  }

  const current = snap.data();
  const updated = { category, amount, description, remarks };
  await setDoc(docRef, updated, { merge: true });

  await addAuditLog(
    adminDeviceId, 
    'EDIT_EXPENSE', 
    `${expenseId} details`, 
    `Amt: ₹${amount}, Desc: ${description}`, 
    browser, 
    'Success'
  );

  return { ...current, ...updated };
}

export async function deleteExpense(expenseId: string, adminDeviceId: string, browser: string): Promise<void> {
  await deleteDoc(doc(db, 'expenses', expenseId));
  await addAuditLog(adminDeviceId, 'DELETE_EXPENSE', expenseId, 'Deleted', browser, 'Success');
}

// -----------------------------------------------------------------
// LEAVE MANAGEMENT
// -----------------------------------------------------------------

export async function getMyLeaves(employeeId: string): Promise<any[]> {
  const qSnap = await getDocs(collection(db, 'leaveRequests'));
  const leaves: any[] = [];
  qSnap.forEach(d => {
    const data = d.data();
    if (data.employeeId === employeeId) {
      leaves.push(data);
    }
  });
  return leaves;
}

export async function applyLeave(leave: any): Promise<any> {
  // Check overlapping leave
  const qSnap = await getDocs(collection(db, 'leaveRequests'));
  let overlap = false;

  qSnap.forEach(d => {
    const data = d.data();
    if (data.employeeId === leave.employeeId && data.status !== 'Rejected' && data.status !== 'Cancelled') {
      const lStart = new Date(leave.fromDate);
      const lEnd = new Date(leave.toDate);
      const eStart = new Date(data.fromDate);
      const eEnd = new Date(data.toDate);

      if (lStart <= eEnd && lEnd >= eStart) {
        overlap = true;
      }
    }
  });

  if (overlap) {
    throw new Error('Overlap! Leave request already exists for selected dates.');
  }

  // Handle base64 leave attachment if present
  if (leave.attachmentUrl && leave.attachmentUrl.startsWith('data:')) {
    console.log(`Uploading leave proof to Firebase Storage: ${leave.leaveId}`);
    const storagePath = `leaves/${leave.employeeId}/${leave.leaveId}.png`;
    const downloadUrl = await uploadBase64File(leave.attachmentUrl, storagePath);
    leave.attachmentUrl = downloadUrl;
  }

  await setDoc(doc(db, 'leaveRequests', leave.leaveId), leave);
  return leave;
}

export async function cancelLeave(leaveId: string, employeeId: string): Promise<any> {
  const docRef = doc(db, 'leaveRequests', leaveId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Leave request not found.');
  }

  const current = snap.data();
  if (current.employeeId !== employeeId) {
    throw new Error('Access denied.');
  }

  if (current.status !== 'Pending') {
    throw new Error('Only Pending leave requests can be cancelled.');
  }

  await setDoc(docRef, { status: 'Cancelled' }, { merge: true });
  return { ...current, status: 'Cancelled' };
}

export async function getAllLeaves(): Promise<any[]> {
  const qSnap = await getDocs(collection(db, 'leaveRequests'));
  const leaves: any[] = [];
  qSnap.forEach(d => leaves.push(d.data()));
  return leaves;
}

export async function updateLeaveStatus(
  leaveId: string,
  status: string,
  adminDeviceId: string,
  browser: string
): Promise<any> {
  const docRef = doc(db, 'leaveRequests', leaveId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Leave request not found.');
  }

  const current = snap.data();
  const oldStatus = current.status || 'Pending';
  const updated: any = {
    status,
    approvedBy: 'Administrator',
    approvedDate: new Date().toISOString().split('T')[0]
  };

  await setDoc(docRef, updated, { merge: true });

  // Update Leave Balance if Approved
  if (status === 'Approved' && oldStatus !== 'Approved') {
    const bal = await getOrCreateLeaveBalance(current.employeeId, current.employeeName);
    const leaveTypeKey = String(current.leaveType || '').toLowerCase();
    
    let currentBal = parseFloat(bal[leaveTypeKey]) || 0;
    let lwpBal = parseFloat(bal.lwp) || 0;
    const leaveDays = parseFloat(current.totalDays) || 0;

    if (leaveTypeKey !== 'lwp' && currentBal >= leaveDays) {
      bal[leaveTypeKey] = currentBal - leaveDays;
    } else {
      bal.lwp = lwpBal + leaveDays;
    }

    bal.lastUpdated = new Date().toISOString();
    await setDoc(doc(db, 'leaveBalances', current.employeeId), bal);
  }

  await addAuditLog(
    adminDeviceId, 
    'UPDATE_LEAVE_STATUS', 
    `${leaveId} Status: ${oldStatus}`, 
    status, 
    browser, 
    'Success'
  );

  return { ...current, ...updated };
}

export async function getAllLeaveBalances(): Promise<any[]> {
  const qSnap = await getDocs(collection(db, 'leaveBalances'));
  const balances: any[] = [];
  qSnap.forEach(d => balances.push(d.data()));
  return balances;
}

export async function editLeaveBalance(balance: any): Promise<any> {
  await setDoc(doc(db, 'leaveBalances', balance.employeeId), {
    ...balance,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
  return balance;
}

// -----------------------------------------------------------------
// HOLIDAY MANAGEMENT
// -----------------------------------------------------------------

export async function getHolidays(): Promise<any[]> {
  const qSnap = await getDocs(collection(db, 'holidays'));
  const holidays: any[] = [];
  qSnap.forEach(d => holidays.push(d.data()));
  return holidays;
}

export async function addHoliday(holiday: any): Promise<any> {
  await setDoc(doc(db, 'holidays', holiday.id), holiday);
  return holiday;
}

export async function deleteHoliday(id: string): Promise<void> {
  await deleteDoc(doc(db, 'holidays', id));
}

// -----------------------------------------------------------------
// SYSTEM SETTINGS & UTILS
// -----------------------------------------------------------------

let isAuthInitialized = false;
let systemSettingsCache: Record<string, string> = {};

const authReadyPromise = new Promise<void>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    isAuthInitialized = true;
    if (user) {
      try {
        const qSnap = await getDocs(collection(db, 'appSettings'));
        qSnap.forEach(d => {
          const data = d.data();
          if (data.key) {
            systemSettingsCache[data.key] = data.value;
          }
        });
      } catch(e) {
        console.warn("Failed to reload system settings", e);
      }
    }
    resolve();
  });
});

export async function getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
  await authReadyPromise;
  if (!auth.currentUser) {
    return systemSettingsCache[key] || defaultValue;
  }
  try {
    const snap = await getDoc(doc(db, 'appSettings', key));
    if (snap.exists()) {
      const val = snap.data().value || defaultValue;
      systemSettingsCache[key] = val;
      return val;
    }
  } catch(e) {
    console.warn("Error fetching setting, using cache", e);
  }
  return systemSettingsCache[key] || defaultValue;
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
  await setDoc(doc(db, 'appSettings', key), {
    key,
    value,
    updatedAt: new Date().toISOString()
  });
}

export async function getExpenseCategories(): Promise<string[]> {
  const snap = await getDoc(doc(db, 'appSettings', 'expenseCategories'));
  if (snap.exists() && snap.data().categories) {
    return snap.data().categories;
  }
  return ['Travel', 'Fuel', 'Food', 'Hotel', 'Parking', 'Toll', 'Courier', 'Office Supplies', 'Medical', 'Other'];
}

export async function saveExpenseCategories(categories: string[], adminDeviceId: string, browser: string): Promise<void> {
  await setDoc(doc(db, 'appSettings', 'expenseCategories'), { categories });
  await addAuditLog(adminDeviceId, 'UPDATE_EXPENSE_CATEGORIES', 'Categories updated', categories.join(', '), browser, 'Success');
}

export async function getAuditLogs(): Promise<any[]> {
  const qSnap = await getDocs(collection(db, 'auditLogs'));
  const logs: any[] = [];
  qSnap.forEach(d => logs.push(d.data()));
  // Sort descending by timestamp/date/time
  return logs.sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime());
}

export async function getReportsSummary(): Promise<any> {
  const emps = await getAllEmployees();
  const att = await getAttendanceRecords();
  const exp = await getAllExpenses();
  const lvs = await getAllLeaves();

  const totalEmployees = emps.length;
  const activeToday = att.filter(a => {
    const checkTime = a.checkInTime || '';
    return checkTime.startsWith(new Date().toISOString().split('T')[0]);
  }).length;

  const pendingExpensesCount = exp.filter(e => e.status === 'Pending').length;
  const pendingLeavesCount = lvs.filter(l => l.status === 'Pending').length;

  return {
    totalEmployees,
    activeToday,
    pendingExpensesCount,
    pendingLeavesCount
  };
}

export async function getSystemSettingsList(): Promise<any[]> {
  await authReadyPromise;
  if (!auth.currentUser) return [];
  const qSnap = await getDocs(collection(db, 'appSettings'));
  const settings: any[] = [];
  qSnap.forEach(d => {
    const data = d.data();
    if (data.key) {
      settings.push(data);
    }
  });
  return settings;
}

// -----------------------------------------------------------------
// DATABASE BOOTSTRAPPING
// -----------------------------------------------------------------

export async function bootstrapFirebase() {
  await authReadyPromise;
  
  try {
    console.log('Checking if Firebase bootstrap is required...');
    
    // NOTE: Auth is disabled in the project. The server doesn't have privileges to read the DB without admin credentials.
    // For now we will return, we can't do anything else unless Admin SDK is used.
    console.log('Auth check skipped because Email/Password is disabled in the Firebase Project.');

    // 1. Detect whether Firestore users collection is empty
    let isFirestoreEmpty = false;
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        isFirestoreEmpty = usersSnap.empty;
    } catch (e: any) {
        console.error("Failed to fetch users (Permissions likely missing). Assuming empty.", e.message);
        isFirestoreEmpty = true;
    }

    // We ensure all required collections are seeded if empty or missing docs
    // Collections required: users, employees, attendance, expenses, leaveRequests, leaveBalances, notifications, holidays, geofence, companySettings, auditLogs, admins, hr, teamLeaders

    // 2. Seed companySettings
    const companySettingsSnap = await getDocs(collection(db, 'companySettings'));
    if (companySettingsSnap.empty) {
      await setDoc(doc(db, 'companySettings', 'config'), {
        companyName: 'EXFIN OMS Enterprise',
        version: '1.0.0',
        autoApprove: false,
        currency: 'INR',
        headquarters: 'New Delhi, India',
        updatedAt: new Date().toISOString()
      });
    }

    // 3. Seed geofence
    const geofenceSnap = await getDocs(collection(db, 'geofence'));
    if (geofenceSnap.empty) {
      await setDoc(doc(db, 'geofence', '1'), {
        officeLat: 28.6139,
        officeLng: 77.2090,
        radiusMeters: 500,
        officeName: 'EXFIN Head Office',
        officeAddress: 'New Delhi, India',
        version: '1',
        updatedBy: 'System',
        updatedAt: new Date().toISOString()
      });
    }

    // 4. Seed appSettings / counters / expenseCategories / leaveTypes
    const counterDocRef = doc(db, 'appSettings', 'counters');
    const counterSnap = await getDoc(counterDocRef);
    if (!counterSnap.exists()) {
      await setDoc(counterDocRef, {
        employeeCounter: 1005,
        attendanceCounter: 5000
      });
    }

    const expCatDocRef = doc(db, 'appSettings', 'expenseCategories');
    const expCatSnap = await getDoc(expCatDocRef);
    if (!expCatSnap.exists()) {
      await setDoc(expCatDocRef, {
        categories: [
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
        ]
      });
    }

    const leaveTypesToSeed = [
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

    for (const lt of leaveTypesToSeed) {
      const docRef = doc(db, 'appSettings', `leaveType_${lt.key}`);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, lt);
      }
    }

    // 5. Seed holidays
    const holidaysToSeed = [
      { id: 'HOL-1', date: '2026-08-15', name: 'Independence Day', state: 'All', type: 'Public Holiday', status: 'Active' },
      { id: 'HOL-2', date: '2026-10-02', name: 'Gandhi Jayanti', state: 'All', type: 'Public Holiday', status: 'Active' },
      { id: 'HOL-3', date: '2026-11-01', name: 'Diwali', state: 'All', type: 'Festival', status: 'Active' },
      { id: 'HOL-4', date: '2026-12-25', name: 'Christmas Day', state: 'All', type: 'Public Holiday', status: 'Active' }
    ];

    for (const hol of holidaysToSeed) {
      const docRef = doc(db, 'holidays', hol.id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, hol);
      }
    }

    // 6. Automatically create Master Admin Firebase Auth user if not present in users collection
    const masterEmail = 'sanjivsinha2010@gmail.com';
    const masterUid = 'MASTER_ADMIN_USER';
    const masterQuery = query(collection(db, 'users'), where('email', '==', masterEmail));
    const masterSnap = await getDocs(masterQuery);

    if (masterSnap.empty) {
      console.log('Creating Master Admin users document...');
      
      // Create users/{uid} document for Master Admin
      const nowIso = new Date().toISOString();
      await setDoc(doc(db, 'users', masterUid), {
        uid: masterUid,
        role: 'MASTER_ADMIN',
        name: 'Master Admin',
        email: masterEmail,
        status: 'ACTIVE',
        pin: '123456',
        createdAt: nowIso,
        updatedAt: nowIso,
        trusted: true
      });

      // Seed Master Admin in employees, admins, and leaveBalances
      await setDoc(doc(db, 'employees', 'EXF-1001'), {
        employeeId: 'EXF-1001',
        employeeName: 'Master Admin',
        mobileNumber: '9876543210',
        deviceId: 'DEV-EXF-1001',
        userAgent: 'Enterprise PWA System',
        browserName: 'Chrome / Enterprise',
        registrationDate: nowIso,
        appVersion: '1.0.0',
        status: 'Approved',
        approvedAt: nowIso,
        syncedToGoogleSheets: true
      });

      await setDoc(doc(db, 'admins', 'EXF-1001'), {
        employeeId: 'EXF-1001',
        name: 'Master Admin',
        role: 'MASTER_ADMIN',
        updatedAt: nowIso
      });

      await setDoc(doc(db, 'leaveBalances', 'EXF-1001'), {
        employeeId: 'EXF-1001',
        employeeName: 'Master Admin',
        cl: 12,
        sl: 10,
        el: 15,
        compOff: 2,
        lwp: 0,
        lastUpdated: nowIso
      });
    }

    // 7. Seed other essential roles (Admin, HR, Team Leader) if not present
    const otherUsersToSeed = [
      { email: 'admin@exfin.com', pin: '123456', role: 'Admin', name: 'Admin Manager', employeeId: 'EXF-1002', mobile: '9876543211', coll: 'admins' },
      { email: 'hr@exfin.com', pin: '222222', role: 'HR', name: 'HR Executive', employeeId: 'EXF-1003', mobile: '9876543212', coll: 'hr' },
      { email: 'teamleader@exfin.com', pin: '333333', role: 'Team Leader', name: 'Team Leader', employeeId: 'EXF-1004', mobile: '9876543213', coll: 'teamLeaders' }
    ];

    for (const u of otherUsersToSeed) {
      const q = query(collection(db, 'users'), where('email', '==', u.email));
      const qSnap = await getDocs(q);
      if (qSnap.empty) {
        let uId = u.email.replace(/[@.]/g, '_');
        try {
          const cred = await createUserWithEmailAndPassword(auth, u.email, u.pin);
          uId = cred.user.uid;
        } catch (e: any) {
          console.log(`Auth notice for ${u.email}:`, e.message);
        }
        const nowIso = new Date().toISOString();
        await setDoc(doc(db, 'users', uId), {
          uid: uId,
          email: u.email,
          pin: u.pin,
          role: u.role,
          name: u.name,
          status: 'ACTIVE',
          createdAt: nowIso,
          updatedAt: nowIso,
          trusted: true
        });

        await setDoc(doc(db, 'employees', u.employeeId), {
          employeeId: u.employeeId,
          employeeName: u.name,
          mobileNumber: u.mobile,
          deviceId: `DEV-${u.employeeId}`,
          userAgent: 'Enterprise PWA System',
          browserName: 'Chrome / Enterprise',
          registrationDate: nowIso,
          appVersion: '1.0.0',
          status: 'Approved',
          approvedAt: nowIso,
          syncedToGoogleSheets: true
        });

        await setDoc(doc(db, u.coll, u.employeeId), {
          employeeId: u.employeeId,
          name: u.name,
          role: u.role,
          updatedAt: nowIso
        });

        await setDoc(doc(db, 'leaveBalances', u.employeeId), {
          employeeId: u.employeeId,
          employeeName: u.name,
          cl: 12,
          sl: 10,
          el: 15,
          compOff: 2,
          lwp: 0,
          lastUpdated: nowIso
        });
      }
    }

    // 8. Seed sample collections if empty (attendance, expenses, leaveRequests, notifications, auditLogs)
    const attendanceSnap = await getDocs(collection(db, 'attendance'));
    if (attendanceSnap.empty) {
      await setDoc(doc(db, 'attendance', 'ATT-5001'), {
        attendanceId: 'ATT-5001',
        employeeId: 'EXF-1002',
        employeeName: 'Admin Manager',
        attendanceType: 'Office',
        checkInTime: new Date().toISOString(),
        checkOutTime: '',
        address: 'New Delhi, India',
        officeName: 'EXFIN Head Office',
        distanceFromOffice: '15.4 meters',
        remarks: 'Initial system check-in',
        status: 'Checked In',
        createdTime: new Date().toISOString()
      });
    }

    const expensesSnap = await getDocs(collection(db, 'expenses'));
    if (expensesSnap.empty) {
      await setDoc(doc(db, 'expenses', 'EXP-3001'), {
        expenseId: 'EXP-3001',
        employeeId: 'EXF-1002',
        employeeName: 'Admin Manager',
        expenseDate: new Date().toISOString().split('T')[0],
        category: 'Travel',
        amount: 450,
        description: 'Client site visit taxi fare',
        remarks: 'Approved automatically',
        address: 'Connaught Place, New Delhi',
        attachmentUrl: '',
        status: 'Approved',
        approvedBy: 'Master Admin',
        approvedDate: new Date().toISOString(),
        createdTime: new Date().toISOString()
      });
    }

    const leaveSnap = await getDocs(collection(db, 'leaveRequests'));
    if (leaveSnap.empty) {
      await setDoc(doc(db, 'leaveRequests', 'LV-2001'), {
        leaveId: 'LV-2001',
        employeeId: 'EXF-1003',
        employeeName: 'HR Executive',
        leaveType: 'Casual Leave (CL)',
        fromDate: new Date().toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0],
        isHalfDay: false,
        totalDays: 1,
        reason: 'Personal errand',
        remarks: 'Approved',
        attachmentUrl: '',
        status: 'Approved',
        approvedBy: 'Admin Manager',
        approvedDate: new Date().toISOString(),
        createdTime: new Date().toISOString()
      });
    }

    const notifSnap = await getDocs(collection(db, 'notifications'));
    if (notifSnap.empty) {
      await setDoc(doc(db, 'notifications', 'NOTIF-1'), {
        id: 'NOTIF-1',
        title: 'Welcome to EXFIN OMS Enterprise',
        message: 'Cloud Firestore synchronization and enterprise security protocols are fully operational.',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
    }

    const auditSnap = await getDocs(collection(db, 'auditLogs'));
    if (auditSnap.empty) {
      await setDoc(doc(db, 'auditLogs', 'AUDIT-SYSTEM-INIT'), {
        id: 'AUDIT-SYSTEM-INIT',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        adminDeviceId: 'SYSTEM_BOOTSTRAP',
        action: 'BOOTSTRAP_FIRESTORE_COLLECTIONS',
        oldValue: '-',
        newValue: 'All collections and Master Admin seeded successfully',
        browser: 'Enterprise PWA Server',
        result: 'Success',
        timestamp: new Date().toISOString()
      });
    }

    console.log('Firebase bootstrap completed successfully across all required collections.');
  } catch (err) {
    console.error('Error during Firebase bootstrapping:', err);
  }
}

// -----------------------------------------------------------------
// VISUAL SHEETS PREVIEW
// -----------------------------------------------------------------

export async function getSheetsPreviewData(): Promise<any> {
  const emps = await getAllEmployees();
  const atts = await getAttendanceRecords();
  const exps = await getAllExpenses();
  const lvs = await getAllLeaves();
  const bals = await getAllLeaveBalances();
  const hols = await getHolidays();
  const logs = await getAuditLogs();

  const employeesSheet = emps.map(e => ({
    'Employee ID': e.employeeId || '',
    'Employee Name': e.employeeName || '',
    'Mobile Number': e.mobileNumber || '',
    'Device ID': e.deviceId || '',
    'Browser Name': e.browserName || '',
    'Registration Date': e.registrationDate || '',
    'App Version': e.appVersion || '',
    'Status': e.status || '',
    'Approved At': e.approvedAt || '',
    'Rejection Reason': e.rejectionReason || '',
    'Synced': e.syncedToGoogleSheets ? 'Yes' : 'No'
  }));

  const attendanceSheet = atts.map(a => ({
    'Attendance ID': a.attendanceId || '',
    'Employee ID': a.employeeId || '',
    'Employee Name': a.employeeName || '',
    'Attendance Type': a.attendanceType || '',
    'Check In Time': a.checkInTime || '',
    'Check Out Time': a.checkOutTime || '',
    'Current Location Address': a.address || '',
    'Office Name': a.officeName || (a.attendanceType === 'WFH' ? 'WFH' : a.attendanceType === 'CLIENT_VISIT' ? 'Client Site' : 'EXFIN Head Office'),
    'Distance From Office': a.distanceFromOffice || 'N/A',
    'Client Name': a.clientName || 'N/A',
    'Purpose': a.purpose || 'N/A',
    'Remarks': a.remarks || '',
    'Status': a.status || '',
    'Created Time': a.createdTime || ''
  }));

  const expensesSheet = exps.map(e => ({
    'Expense ID': e.expenseId || '',
    'Employee ID': e.employeeId || '',
    'Employee Name': e.employeeName || '',
    'Expense Date': e.expenseDate || '',
    'Category': e.category || '',
    'Amount': e.amount || 0,
    'Description': e.description || '',
    'Remarks': e.remarks || '',
    'Location Address': e.address || '',
    'Attachment URL': e.attachmentUrl || '',
    'Status': e.status || '',
    'Approved By': e.approvedBy || '',
    'Approved Date': e.approvedDate || '',
    'Paid Date': e.paidDate || '',
    'Created Time': e.createdTime || ''
  }));

  const leaveSheet = lvs.map(l => ({
    'Leave ID': l.leaveId || '',
    'Employee ID': l.employeeId || '',
    'Employee Name': l.employeeName || '',
    'Leave Type': l.leaveType || '',
    'From Date': l.fromDate || '',
    'To Date': l.toDate || '',
    'Is Half Day': l.isHalfDay ? 'Yes' : 'No',
    'Total Days': l.totalDays || 0,
    'Reason': l.reason || '',
    'Remarks': l.remarks || '',
    'Attachment URL': l.attachmentUrl || '',
    'Status': l.status || '',
    'Approved By': l.approvedBy || '',
    'Approved Date': l.approvedDate || '',
    'Created Time': l.createdTime || ''
  }));

  const leaveBalanceSheet = bals.map(b => ({
    'Employee ID': b.employeeId || '',
    'Employee Name': b.employeeName || '',
    'Casual Leave': b.cl || 0,
    'Sick Leave': b.sl || 0,
    'Earned Leave': b.el || 0,
    'Comp Off': b.compOff || 0,
    'Leave Without Pay': b.lwp || 0,
    'Last Updated': b.lastUpdated || ''
  }));

  const holidayCalendarSheet = hols.map(h => ({
    'Holiday ID': h.id || '',
    'Date': h.date || '',
    'Name': h.name || '',
    'State': h.state || '',
    'Type': h.type || '',
    'Status': h.status || ''
  }));

  const syncLogSheet = logs.map(l => ({
    'Log ID': l.id || '',
    'Device ID': l.adminDeviceId || '',
    'Action': l.action || '',
    'Timestamp': l.timestamp || l.date || '',
    'Network Status': 'Online',
    'Payload': l.newValue || ''
  }));

  const sysSettings = await getSystemSettingsList();
  const systemSettingsSheet = sysSettings.map(s => ({
    'Setting Key': s.key || '',
    'Setting Value': s.value || '',
    'Last Updated': s.updatedAt || ''
  }));

  return {
    'Employees': employeesSheet,
    'Attendance': attendanceSheet,
    'Expenses': expensesSheet,
    'Leave': leaveSheet,
    'LeaveBalance': leaveBalanceSheet,
    'HolidayCalendar': holidayCalendarSheet,
    'SyncLog': syncLogSheet,
    'SystemSettings': systemSettingsSheet
  };
}


