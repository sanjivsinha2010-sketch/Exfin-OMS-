import { Employee, SyncLog, SystemSettings, AttendanceRecord } from '../types';

const DB_NAME = 'ExfinOMS_DB';
const DB_VERSION = 2;

const STORES = {
  EMPLOYEES: 'employees',
  ATTENDANCE: 'attendance',
  OFFLINE_QUEUE: 'offline_queue',
  SYNC_LOGS: 'sync_logs',
  SETTINGS: 'settings',
};

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.EMPLOYEES)) {
        db.createObjectStore(STORES.EMPLOYEES, { keyPath: 'deviceId' });
      }
      if (!db.objectStoreNames.contains(STORES.ATTENDANCE)) {
        db.createObjectStore(STORES.ATTENDANCE, { keyPath: 'attendanceId' });
      }
      if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
        db.createObjectStore(STORES.OFFLINE_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.SYNC_LOGS)) {
        db.createObjectStore(STORES.SYNC_LOGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Local Employee Management
export async function saveLocalEmployee(employee: Employee): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EMPLOYEES, 'readwrite');
    const store = tx.objectStore(STORES.EMPLOYEES);
    const req = store.put(employee);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalEmployee(deviceId: string): Promise<Employee | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EMPLOYEES, 'readonly');
    const store = tx.objectStore(STORES.EMPLOYEES);
    const req = store.get(deviceId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalEmployee(deviceId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EMPLOYEES, 'readwrite');
    const store = tx.objectStore(STORES.EMPLOYEES);
    const req = store.delete(deviceId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Local Attendance Management
export async function saveLocalAttendance(record: AttendanceRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ATTENDANCE, 'readwrite');
    const store = tx.objectStore(STORES.ATTENDANCE);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalAttendanceRecords(employeeId?: string): Promise<AttendanceRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ATTENDANCE, 'readonly');
    const store = tx.objectStore(STORES.ATTENDANCE);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = (req.result || []) as AttendanceRecord[];
      if (employeeId) {
        resolve(records.filter(r => r.employeeId === employeeId));
      } else {
        resolve(records);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// Offline Queue Management
export interface OfflineQueueItem {
  id?: number;
  type: 'REGISTRATION' | 'ATTENDANCE';
  payload: any;
  createdAt: string;
}

export async function addToOfflineQueue(item: Omit<OfflineQueueItem, 'id'>): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_QUEUE);
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_QUEUE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function clearOfflineQueueItem(id: number): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_QUEUE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Sync Log Management
export async function addSyncLog(log: SyncLog): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_LOGS, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_LOGS);
    const req = store.put(log);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSyncLogs(): Promise<SyncLog[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_LOGS, 'readonly');
    const store = tx.objectStore(STORES.SYNC_LOGS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// System Settings
export async function saveSystemSetting(key: string, value: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);
    const req = store.put({ key, value, updatedAt: new Date().toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSystemSetting(key: string): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORES.SETTINGS);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}
