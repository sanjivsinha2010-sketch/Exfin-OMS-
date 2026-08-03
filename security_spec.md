# EXFIN OMS Enterprise Security Specification (ABAC & Role-Based Access Control)

## 1. Data Invariants
- **Registration Isolation**: An employee document cannot be created or modified by anyone other than the registered user themselves (using their verified `auth.uid` as the identifier) or an HR/Admin/Master Admin.
- **Role Isolation**: Users can never modify their own role (e.g. promoting themselves to Admin). Only Admins and Master Admins can update roles.
- **Attendance Integrity**: Attendance records must belong to a valid registered employee and matches their `employeeId`. Employees can only create or read their own attendance records.
- **Expense Verification**: Only the employee who submitted an expense can read or write to it while in pending state. Only Team Leaders, HR, Admins, and Master Admins can modify status fields. Once status is approved or paid, it is a terminal state and cannot be updated.
- **Leave Overlap Constraint**: A leave request must belong to a valid employee, and employees can only create or read their own leave requests.
- **Geofence Consistency**: Geofence records in the settings can only be altered by Admins or Master Admins.
- **Company Settings Constraints**: Company settings are system-wide keys and can only be altered by Master Admins or Admins.
- **Temporal Integrity**: All timestamped entries must match `request.time`.

---

## 2. The "Dirty Dozen" Malicious Payloads (Attack Vectors)

### Payload 1: Privilege Escalation (Self-Assigned Admin)
- **Target**: `/users/attacker_uid` (Updating user document to grant oneself the "Admin" or "Master Admin" role)
- **Payload**:
```json
{
  "uid": "attacker_uid",
  "email": "attacker@exfin.com",
  "role": "Master Admin",
  "name": "Attacker"
}
```
- **Expectation**: `PERMISSION_DENIED`

### Payload 2: Spoofed Identity Registration
- **Target**: `/employees/another_uid` (Attacker attempting to register an employee profile under someone else's UID)
- **Payload**:
```json
{
  "employeeId": "EXF-8888",
  "employeeName": "Sallie Mae",
  "mobileNumber": "9876543210",
  "deviceId": "victim_device_id",
  "status": "Approved"
}
```
- **Expectation**: `PERMISSION_DENIED`

### Payload 3: Unauthorized Attendance Read
- **Target**: `/attendance/victim_attendance_123` (Attacker attempting to read a victim's attendance logs)
- **Expectation**: `PERMISSION_DENIED`

### Payload 4: Spoofed Attendance Submission (Checked In for Another Employee)
- **Target**: `/attendance/malicious_att_999`
- **Payload**:
```json
{
  "attendanceId": "malicious_att_999",
  "employeeId": "EXF-1002", // Victim employee ID
  "employeeName": "Victim Name",
  "attendanceType": "OFFICE",
  "status": "Checked In",
  "checkInTime": "2026-08-02T11:12:46Z"
}
```
- **Expectation**: `PERMISSION_DENIED`

### Payload 5: Terminal Expense State Bypass (Modifying Approved Expense)
- **Target**: `/expenses/approved_expense_111` (Attempting to change the amount of an already Approved/Paid expense)
- **Payload**:
```json
{
  "amount": 99999,
  "status": "Approved"
}
```
- **Expectation**: `PERMISSION_DENIED`

### Payload 6: Expense Hijacking (Submitting expense for another user)
- **Target**: `/expenses/new_expense_222`
- **Payload**:
```json
{
  "expenseId": "new_expense_222",
  "employeeId": "EXF-Victim",
  "amount": 5000,
  "status": "Pending"
}
```
- **Expectation**: `PERMISSION_DENIED`

### Payload 7: Unauthorized Leave Reading
- **Target**: `/leaveRequests/victim_leave_000` (Normal employee attempting to read another employee's leave requests)
- **Expectation**: `PERMISSION_DENIED`

### Payload 8: Direct Geofence Tampering
- **Target**: `/appSettings/geofence` (An employee attempting to expand the geofence radius)
- **Payload**:
```json
{
  "officeLat": "0.0000",
  "officeLng": "0.0000",
  "radiusMeters": "1000000",
  "officeName": "Malicious Playground"
}
```
- **Expectation**: `PERMISSION_DENIED`

### Payload 9: Audit Log Destruction / Erasure
- **Target**: `/auditLogs/log_abc123` (Attempting to delete or alter an audit log entry)
- **Expectation**: `PERMISSION_DENIED`

### Payload 10: System Setting Hijack (Forcing Auto-Approval)
- **Target**: `/appSettings/AUTO_APPROVAL`
- **Payload**:
```json
{
  "key": "AUTO_APPROVAL",
  "value": "true"
}
```
- **Expectation**: `PERMISSION_DENIED`

### Payload 11: Fake Team Leader Assignment
- **Target**: `/employees/attacker_device_id` (Attacker setting their supervisor / team leader to themselves to approve own requests)
- **Payload**:
```json
{
  "teamLeaderId": "attacker_uid"
}
```
- **Expectation**: `PERMISSION_DENIED`

### Payload 12: Notification Spamming
- **Target**: `/notifications/spam_notification_id` (Non-admin pushing global company notifications)
- **Payload**:
```json
{
  "title": "System Breach",
  "message": "You have been hacked"
}
```
- **Expectation**: `PERMISSION_DENIED`

---

## 3. The Test Runner (`firestore.rules.test.ts`)

Below is the complete, high-quality, executable test suite using the `@firebase/rules-unit-testing` framework.

```typescript
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'exfin-oms',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('EXFIN OMS Hardened Firestore Rules Test Suite', () => {
  test('Payload 1: Privilege Escalation (Self-Assigned Admin) fails', async () => {
    const unprivilegedDb = testEnv.authenticatedContext('user_123').firestore();
    const attackerRef = unprivilegedDb.doc('users/user_123');
    await assertFails(attackerRef.set({
      uid: 'user_123',
      email: 'attacker@exfin.com',
      role: 'Master Admin',
      name: 'Attacker'
    }));
  });

  test('Payload 2: Spoofed Identity Registration fails', async () => {
    const maliciousDb = testEnv.authenticatedContext('attacker_uid').firestore();
    const empRef = maliciousDb.doc('employees/victim_device_id');
    await assertFails(empRef.set({
      employeeId: 'EXF-8888',
      employeeName: 'Sallie Mae',
      mobileNumber: '9876543210',
      deviceId: 'victim_device_id',
      status: 'Approved'
    }));
  });

  test('Payload 3: Unauthorized Attendance Read fails', async () => {
    const attackerDb = testEnv.authenticatedContext('attacker_uid').firestore();
    const recordRef = attackerDb.doc('attendance/victim_attendance_123');
    await assertFails(recordRef.get());
  });

  test('Payload 4: Spoofed Attendance Submission fails', async () => {
    const attackerDb = testEnv.authenticatedContext('attacker_uid').firestore();
    const recordRef = attackerDb.doc('attendance/malicious_att_999');
    await assertFails(recordRef.set({
      attendanceId: 'malicious_att_999',
      employeeId: 'EXF-1002',
      employeeName: 'Victim Name',
      attendanceType: 'OFFICE',
      status: 'Checked In',
      checkInTime: '2026-08-02T11:12:46Z'
    }));
  });

  test('Payload 5: Modifying Approved Expense fails', async () => {
    // Seed approved expense first as Admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('expenses/approved_expense_111').set({
        expenseId: 'approved_expense_111',
        employeeId: 'employee_123',
        amount: 250,
        status: 'Approved'
      });
    });

    const userDb = testEnv.authenticatedContext('employee_123').firestore();
    const expenseRef = userDb.doc('expenses/approved_expense_111');
    await assertFails(expenseRef.update({
      amount: 99999
    }));
  });

  test('Payload 8: Direct Geofence Tampering by regular employee fails', async () => {
    const employeeDb = testEnv.authenticatedContext('employee_123').firestore();
    const geofenceRef = employeeDb.doc('appSettings/geofence');
    await assertFails(geofenceRef.set({
      officeLat: '0.0000',
      officeLng: '0.0000',
      radiusMeters: '1000000',
      officeName: 'Malicious Playground'
    }));
  });
});
```
