export type EmployeeStatus = 'Pending' | 'Approved' | 'Rejected';

export type AttendanceType = 'OFFICE' | 'WFH' | 'CLIENT_VISIT';

export interface AttendanceRecord {
  attendanceId: string;
  employeeId: string;
  employeeName: string;
  attendanceType: AttendanceType;
  checkInTime: string;
  checkOutTime: string;
  latitude: number;
  longitude: number;
  address: string;
  clientName?: string;
  purpose?: string;
  remarks?: string;
  deviceId: string;
  status: string;
  createdTime: string;
  syncedToGoogleSheets?: boolean;
}

export interface TodayAttendanceSummary {
  status: string;
  attendanceType: AttendanceType | 'NONE';
  lastAttendanceTime: string | null;
  workingHours: string;
  officeCheckedIn: boolean;
  wfhDoneToday: boolean;
  clientVisitsTodayCount: number;
  latestRecord?: AttendanceRecord;
}

export interface Employee {
  employeeId: string;
  employeeName: string;
  mobileNumber: string;
  deviceId: string;
  userAgent: string;
  browserName: string;
  registrationDate: string;
  appVersion: string;
  status: EmployeeStatus;
  approvedAt?: string;
  syncedToGoogleSheets?: boolean;
}

export interface SyncLog {
  id: string;
  deviceId: string;
  action: 'REGISTRATION_SUBMITTED' | 'STATUS_POLL' | 'OFFLINE_QUEUE_SYNC' | 'APPROVAL_CHANGE';
  timestamp: string;
  networkStatus: 'ONLINE' | 'OFFLINE';
  payload: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

export interface SystemSettings {
  googleAppsScriptUrl: string;
  autoApprovalMode: boolean;
  pollIntervalSeconds: number;
  lastSyncedAt: string;
}

export interface RegistrationFormData {
  employeeName: string;
  mobileNumber: string;
}

export interface DeviceMetadata {
  deviceId: string;
  userAgent: string;
  browserName: string;
  registrationDate: string;
  appVersion: string;
}

export interface LeaveApplication {
  leaveId: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  isHalfDay: boolean;
  totalDays: number;
  reason: string;
  remarks?: string;
  attachmentUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  approvedBy?: string;
  approvedDate?: string;
  createdTime: string;
  isOfflineQueued?: boolean;
}

export interface LeaveBalance {
  employeeId: string;
  employeeName: string;
  cl: number;
  sl: number;
  el: number;
  compOff: number;
  lwp: number;
  lastUpdated: string;
}

export interface LeaveTypeConfig {
  key: string;
  name: string;
  annualLimit: number;
  status: 'Active' | 'Inactive';
}

export interface HolidayItem {
  id: string;
  date: string;
  name: string;
  state: string;
  type: string;
  status: string;
}

export interface ExpenseApplication {
  expenseId: string;
  employeeId: string;
  employeeName: string;
  expenseDate: string;
  category: string;
  amount: number;
  description: string;
  remarks?: string;
  latitude?: number | string;
  longitude?: number | string;
  address?: string;
  attachmentUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
  approvedBy?: string;
  approvedDate?: string;
  paidDate?: string;
  deviceId?: string;
  createdTime: string;
  isOfflineQueued?: boolean;
}

export interface AppState {
  screen: 'splash' | 'register' | 'waiting' | 'dashboard';
  currentEmployee: Employee | null;
  isOnline: boolean;
  pendingOfflineCount: number;
  lastPollTime: string | null;
}
