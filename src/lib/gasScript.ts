export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Exfin OMS Enterprise PWA v1.0 - Google Apps Script Backend
 * Paste this script into Extensions > Apps Script in your Google Sheet,
 * then click "Deploy as Web App" (Execute as: Me, Access: Anyone).
 */

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Employees Sheet
  let empSheet = ss.getSheetByName("Employees");
  if (!empSheet) {
    empSheet = ss.insertSheet("Employees");
    empSheet.appendRow([
      "Employee ID",
      "Employee Name",
      "Mobile Number",
      "Browser Device ID",
      "User Agent",
      "Browser Name",
      "Registration Date",
      "App Version",
      "Status",
      "Approved At"
    ]);
    empSheet.getRange("1:1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }

  // 2. SyncLog Sheet
  let syncSheet = ss.getSheetByName("SyncLog");
  if (!syncSheet) {
    syncSheet = ss.insertSheet("SyncLog");
    syncSheet.appendRow([
      "Log ID",
      "Device ID",
      "Action",
      "Timestamp",
      "Network Status",
      "Payload"
    ]);
    syncSheet.getRange("1:1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }

  // 3. SystemSettings Sheet
  let settingsSheet = ss.getSheetByName("SystemSettings");
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet("SystemSettings");
    settingsSheet.appendRow(["Key", "Value", "Updated At"]);
    settingsSheet.appendRow(["APP_NAME", "Exfin OMS Enterprise PWA", new Date().toISOString()]);
    settingsSheet.appendRow(["APP_VERSION", "1.0.0", new Date().toISOString()]);
    settingsSheet.appendRow(["AUTO_APPROVE", "false", new Date().toISOString()]);
    settingsSheet.getRange("1:1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }

  // 4. GeoFenceSettings Sheet (Conforming exactly to specified schema)
  let geoSheet = ss.getSheetByName("GeoFenceSettings");
  if (!geoSheet) {
    geoSheet = ss.insertSheet("GeoFenceSettings");
    geoSheet.appendRow([
      "Office Name",
      "Office Address",
      "Latitude",
      "Longitude",
      "Radius",
      "Status",
      "Updated By",
      "Updated Time"
    ]);
    geoSheet.appendRow([
      "EXFIN Head Office",
      "New Delhi, India",
      28.6139,
      77.2090,
      500,
      "Active",
      "System",
      new Date().toISOString()
    ]);
    geoSheet.getRange("1:1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }

  // 5. GeoFenceBackups Sheet
  let backupSheet = ss.getSheetByName("GeoFenceBackups");
  if (!backupSheet) {
    backupSheet = ss.insertSheet("GeoFenceBackups");
    backupSheet.appendRow([
      "Office Name",
      "Office Address",
      "Latitude",
      "Longitude",
      "Radius",
      "Status",
      "Updated By",
      "Updated Time",
      "Backup Time"
    ]);
    backupSheet.getRange("1:1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }

  // 6. GeoFenceAuditLogs Sheet
  let auditSheet = ss.getSheetByName("GeoFenceAuditLogs");
  if (!auditSheet) {
    auditSheet = ss.insertSheet("GeoFenceAuditLogs");
    auditSheet.appendRow(["Date", "Time", "Admin Name", "Old Office Name", "New Office Name", "Old Latitude", "Old Longitude", "New Latitude", "New Longitude", "Old Radius", "New Radius", "Browser", "Device"]);
    auditSheet.getRange("1:1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }
  
  ensureAttendanceSheet();
  
  return "Database Setup Completed Successfully!";
}

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const action = contents.action;
    
    setupDatabase(); // ensure sheets exist
    
    if (action === 'registerDevice' || action === 'register') {
      return handleRegister(contents);
    } else if (action === 'checkRegistration' || action === 'check_status') {
      return checkEmployeeStatus(contents.deviceId || contents.data?.deviceId);
    } else if (action === 'sync_queue') {
      return handleSyncQueue(contents.data || contents);
    } else if (action === 'saveGeoFence' || action === 'saveGeofence' || action === 'save_geofence') {
      return saveGeoFence(contents.data || contents);
    } else if (action === 'rollbackGeoFence' || action === 'rollbackGeofence' || action === 'rollback_geofence') {
      return rollbackGeoFence(contents.data || contents);
    } else if (action === 'getGeoFence' || action === 'getGeofence' || action === 'get_geofence') {
      return getGeoFence();
    } else if (action === 'recordAttendance' || action === 'record_attendance') {
      return recordAttendance(contents.data || contents);
    }
    
    return responseJSON({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  try {
    const action = e.parameter ? e.parameter.action : '';
    const deviceId = e.parameter ? e.parameter.deviceId : '';
    
    setupDatabase();
    
    if (action === 'checkRegistration' || action === 'check_status') {
      return checkEmployeeStatus(deviceId);
    } else if (action === 'list_employees') {
      return listAllEmployees();
    } else if (action === 'getGeoFence' || action === 'getGeofence' || action === 'get_geofence') {
      return getGeoFence();
    }
    
    return responseJSON({ status: 'ok', app: 'Exfin OMS Backend' });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function handleRegister(contents) {
  const data = contents.data || contents;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Employees");
  const rows = sheet.getDataRange().getValues();
  
  let existingRow = -1;
  let employeeId = "";
  let status = "Pending";
  let approvedAt = "";
  
  const deviceId = data.deviceId || "";
  const employeeName = data.employeeName || "";
  const mobileNumber = data.mobileNumber || "";
  const browser = data.browser || data.browserName || data.userAgent || "Browser";
  const appVersion = data.appVersion || "1.0.0";
  const timestamp = data.timestamp || data.registrationDate || new Date().toISOString();

  if (!employeeName || !mobileNumber || !deviceId) {
    return responseJSON({ success: false, error: "Missing required fields: employeeName, mobileNumber, or deviceId" });
  }

  // Check if device already registered
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][3] === deviceId) {
      existingRow = i + 1;
      employeeId = rows[i][0];
      status = rows[i][8];
      approvedAt = rows[i][9];
      break;
    }
  }
  
  if (existingRow === -1) {
    // Generate new Employee ID e.g. EXF-1001
    const nextNum = 1000 + rows.length;
    employeeId = "EXF-" + nextNum;
    
    sheet.appendRow([
      employeeId,
      employeeName,
      mobileNumber,
      deviceId,
      data.userAgent || browser,
      browser,
      timestamp,
      appVersion,
      status,
      approvedAt
    ]);
    
    logSync(deviceId, "REGISTRATION_SUBMITTED", "ONLINE", JSON.stringify(data));
  } else {
    // If device was previously rejected, reset status to Pending to allow re-registration
    if (status === "Rejected") {
      status = "Pending";
      sheet.getRange(existingRow, 9).setValue("Pending");
      sheet.getRange(existingRow, 2).setValue(employeeName);
      sheet.getRange(existingRow, 3).setValue(mobileNumber);
    }
  }
  
  return responseJSON({
    success: true,
    message: "Registration submitted. Please wait for administrator approval.",
    employee: {
      employeeId: employeeId,
      employeeName: employeeName,
      mobileNumber: mobileNumber,
      deviceId: deviceId,
      browser: browser,
      browserName: browser,
      appVersion: appVersion,
      timestamp: timestamp,
      registrationDate: timestamp,
      status: status,
      approvedAt: approvedAt
    }
  });
}

function checkEmployeeStatus(deviceId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Employees");
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][3] === deviceId) {
      return responseJSON({
        success: true,
        employee: {
          employeeId: rows[i][0],
          employeeName: rows[i][1],
          mobileNumber: rows[i][2],
          deviceId: rows[i][3],
          userAgent: rows[i][4],
          browserName: rows[i][5],
          registrationDate: rows[i][6],
          appVersion: rows[i][7],
          status: rows[i][8],
          approvedAt: rows[i][9]
        }
      });
    }
  }
  
  return responseJSON({ success: false, error: 'Employee not found' });
}

function listAllEmployees() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Employees");
  if (!sheet) return responseJSON({ success: false, error: "Employees sheet not found" });
  
  const rows = sheet.getDataRange().getValues();
  const employees = [];
  for (let i = 1; i < rows.length; i++) {
    employees.push({
      employeeId: rows[i][0],
      employeeName: rows[i][1],
      mobileNumber: rows[i][2],
      deviceId: rows[i][3],
      userAgent: rows[i][4],
      browserName: rows[i][5],
      registrationDate: rows[i][6],
      appVersion: rows[i][7],
      status: rows[i][8],
      approvedAt: rows[i][9]
    });
  }
  return responseJSON({ success: true, employees: employees });
}

function handleSyncQueue(data) {
  const deviceId = data.deviceId || "Unknown";
  logSync(deviceId, "SYNC_QUEUE", "ONLINE", JSON.stringify(data));
  return responseJSON({ success: true, message: "Sync queue processed successfully" });
}

function logSync(deviceId, action, networkStatus, payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SyncLog");
  const logId = "LOG-" + Date.now();
  sheet.appendRow([logId, deviceId, action, new Date().toISOString(), networkStatus, payload]);
}

function getGeoFence() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("GeoFenceSettings");
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName("GeoFenceSettings");
  }
  const rows = sheet.getDataRange().getValues();
  
  let activeOfficeName = "EXFIN Head Office";
  let activeOfficeAddress = "New Delhi, India";
  let activeLat = 28.6139;
  let activeLng = 77.2090;
  let activeRadius = 500;
  let activeUpdatedBy = "System";
  let activeUpdatedAt = new Date().toISOString();
  let activeVersion = 1;
  
  const history = [];
  
  if (rows[0][0] === "Office Name") {
    for (let i = 1; i < rows.length; i++) {
      const oName = String(rows[i][0]);
      const oAddr = String(rows[i][1]);
      const lat = Number(rows[i][2]);
      const lng = Number(rows[i][3]);
      const rad = Number(rows[i][4]);
      const status = String(rows[i][5]);
      const uBy = String(rows[i][6]);
      const uAt = String(rows[i][7]);
      
      const record = {
        version: i,
        officeName: oName,
        officeAddress: oAddr,
        officeLat: lat,
        officeLng: lng,
        radiusMeters: rad,
        latitude: lat,
        longitude: lng,
        radius: rad,
        status: status,
        updatedBy: uBy,
        updatedAt: uAt
      };
      
      history.push(record);
      
      if (status === "Active" || i === rows.length - 1) {
        activeOfficeName = oName;
        activeOfficeAddress = oAddr;
        activeLat = lat;
        activeLng = lng;
        activeRadius = rad;
        activeUpdatedBy = uBy;
        activeUpdatedAt = uAt;
        activeVersion = i;
      }
    }
  } else {
    for (let i = 1; i < rows.length; i++) {
      const v = Number(rows[i][0]);
      const oName = String(rows[i][1]);
      const oAddr = String(rows[i][2]);
      const lat = Number(rows[i][3]);
      const lng = Number(rows[i][4]);
      const rad = Number(rows[i][5]);
      const uBy = String(rows[i][6]);
      const uAt = String(rows[i][7]);
      
      const record = {
        version: v,
        officeName: oName,
        officeAddress: oAddr,
        officeLat: lat,
        officeLng: lng,
        radiusMeters: rad,
        latitude: lat,
        longitude: lng,
        radius: rad,
        status: "Active",
        updatedBy: uBy,
        updatedAt: uAt
      };
      
      history.push(record);
      
      if (v >= activeVersion) {
        activeVersion = v;
        activeOfficeName = oName;
        activeOfficeAddress = oAddr;
        activeLat = lat;
        activeLng = lng;
        activeRadius = rad;
        activeUpdatedBy = uBy;
        activeUpdatedAt = uAt;
      }
    }
  }
  
  history.sort(function(a, b) { return b.version - a.version; });
  
  return responseJSON({
    success: true,
    "Office Name": activeOfficeName,
    "Office Address": activeOfficeAddress,
    "Latitude": activeLat,
    "Longitude": activeLng,
    "Radius": activeRadius,
    officeName: activeOfficeName,
    officeAddress: activeOfficeAddress,
    latitude: activeLat,
    longitude: activeLng,
    radius: activeRadius,
    officeLat: activeLat,
    officeLng: activeLng,
    radiusMeters: activeRadius,
    version: activeVersion,
    updatedBy: activeUpdatedBy,
    updatedAt: activeUpdatedAt,
    history: history
  });
}

function saveGeoFence(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("GeoFenceSettings");
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName("GeoFenceSettings");
  }
  
  const rows = sheet.getDataRange().getValues();
  
  // Backup the previously active row to backupSheet if possible
  let backupSheet = ss.getSheetByName("GeoFenceBackups");
  if (!backupSheet) {
    backupSheet = ss.insertSheet("GeoFenceBackups");
    backupSheet.appendRow(["Office Name", "Office Address", "Latitude", "Longitude", "Radius", "Status", "Updated By", "Updated Time", "Backup Time"]);
  }
  
  let previousActive = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][5] === "Active") {
      previousActive = rows[i];
      break;
    }
  }
  if (!previousActive && rows.length > 1) {
    previousActive = rows[rows.length - 1];
  }
  
  if (previousActive) {
    backupSheet.appendRow([
      previousActive[0],
      previousActive[1],
      previousActive[2],
      previousActive[3],
      previousActive[4],
      previousActive[5],
      previousActive[6],
      previousActive[7],
      new Date().toISOString()
    ]);
  }
  
  // Update all previous active entries to "Inactive"
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][5] === "Active") {
      sheet.getRange(i + 1, 6).setValue("Inactive");
    }
  }
  
  const officeName = data.officeName !== undefined ? data.officeName : (data.officeName || "EXFIN Head Office");
  const officeAddress = data.officeAddress !== undefined ? data.officeAddress : (data.officeAddress || "New Delhi, India");
  const latitude = Number(data.latitude !== undefined ? data.latitude : (data.officeLat !== undefined ? data.officeLat : 28.6139));
  const longitude = Number(data.longitude !== undefined ? data.longitude : (data.officeLng !== undefined ? data.officeLng : 77.2090));
  const radius = Number(data.radius !== undefined ? data.radius : (data.radiusMeters !== undefined ? data.radiusMeters : 500));
  const updatedBy = data.updatedBy || "System";
  const timestamp = new Date().toISOString();
  
  sheet.appendRow([
    officeName,
    officeAddress,
    latitude,
    longitude,
    radius,
    "Active",
    updatedBy,
    timestamp
  ]);
  
  let auditSheet = ss.getSheetByName("GeoFenceAuditLogs");
  if (!auditSheet) {
    auditSheet = ss.insertSheet("GeoFenceAuditLogs");
    auditSheet.appendRow(["Date", "Time", "Admin Name", "Old Office Name", "New Office Name", "Old Latitude", "Old Longitude", "New Latitude", "New Longitude", "Old Radius", "New Radius", "Browser", "Device"]);
  }
  
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];
  
  auditSheet.appendRow([
    dateStr,
    timeStr,
    updatedBy,
    previousActive ? previousActive[0] : "-",
    officeName,
    previousActive ? previousActive[2] : "-",
    previousActive ? previousActive[3] : "-",
    latitude,
    longitude,
    previousActive ? previousActive[4] : "-",
    radius,
    data.browser || "Browser",
    data.device || "Device"
  ]);
  
  return responseJSON({
    success: true,
    message: "GeoFence configuration updated successfully in Google Sheets.",
    "Office Name": officeName,
    "Office Address": officeAddress,
    "Latitude": latitude,
    "Longitude": longitude,
    "Radius": radius,
    officeName: officeName,
    officeAddress: officeAddress,
    latitude: latitude,
    longitude: longitude,
    radius: radius,
    version: rows.length // new version number (row index)
  });
}

function rollbackGeoFence(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("GeoFenceSettings");
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName("GeoFenceSettings");
  }
  
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 3) {
    return responseJSON({
      success: false,
      error: "No previous version available to restore."
    });
  }
  
  let activeIdx = -1;
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][5] === "Active") {
      activeIdx = i;
      break;
    }
  }
  if (activeIdx === -1) {
    activeIdx = rows.length - 1;
  }
  
  let previousIdx = -1;
  for (let i = activeIdx - 1; i >= 1; i--) {
    previousIdx = i;
    break;
  }
  
  if (previousIdx === -1) {
    return responseJSON({
      success: false,
      error: "No previous version available to restore."
    });
  }
  
  const currentActive = rows[activeIdx];
  const previous = rows[previousIdx];
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][5] === "Active") {
      sheet.getRange(i + 1, 6).setValue("Inactive");
    }
  }
  
  const officeName = previous[0];
  const officeAddress = previous[1];
  const latitude = Number(previous[2]);
  const longitude = Number(previous[3]);
  const radius = Number(previous[4]);
  const updatedBy = (data && data.updatedBy) || "Rollback Admin";
  const timestamp = new Date().toISOString();
  
  sheet.appendRow([
    officeName,
    officeAddress,
    latitude,
    longitude,
    radius,
    "Active",
    updatedBy,
    timestamp
  ]);
  
  return responseJSON({
    success: true,
    message: "GeoFence restored to previous version successfully."
  });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureAttendanceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Attendance");
  if (!sheet) {
    sheet = ss.insertSheet("Attendance");
    sheet.appendRow([
      "Attendance ID",
      "Employee ID",
      "Employee Name",
      "Attendance Type",
      "Check In Time",
      "Check Out Time",
      "Current Location Address",
      "Office Name",
      "Distance From Office",
      "Client Name",
      "Purpose",
      "Remarks",
      "Status",
      "Created Time"
    ]);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }
  return sheet;
}

function recordAttendance(data) {
  const sheet = ensureAttendanceSheet();
  const rows = sheet.getDataRange().getValues();
  
  const attendanceId = data.attendanceId || "";
  const employeeId = data.employeeId || "";
  const employeeName = data.employeeName || "";
  const attendanceType = data.attendanceType || "";
  const checkInTime = data.checkInTime || "";
  const checkOutTime = data.checkOutTime || "";
  const currentLocationAddress = data.address || data.currentLocationAddress || "";
  const clientName = data.clientName || "";
  const purpose = data.purpose || "";
  const remarks = data.remarks || "";
  const status = data.status || "";
  const createdTime = data.createdTime || new Date().toISOString();
  
  // Get active office name and calculate distance
  let officeName = "-";
  let distanceFromOffice = "-";
  
  const typeStr = String(attendanceType).trim().toUpperCase();
  if (typeStr === "WFH") {
    officeName = "WFH";
    distanceFromOffice = "N/A";
  } else if (typeStr === "CLIENT_VISIT" || typeStr === "CLIENT VISIT" || typeStr === "CLIENTSITE" || typeStr === "CLIENT SITE") {
    officeName = "Client Site";
    distanceFromOffice = "N/A";
  } else {
    const geoSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GeoFenceSettings");
    if (geoSheet) {
      const geoRows = geoSheet.getDataRange().getValues();
      if (geoRows.length > 1) {
        let activeRowIdx = -1;
        for (let i = 1; i < geoRows.length; i++) {
          if (geoRows[i][5] === "Active") {
            activeRowIdx = i;
            break;
          }
        }
        if (activeRowIdx === -1) {
          activeRowIdx = geoRows.length - 1;
        }
        
        const activeOffice = geoRows[activeRowIdx];
        officeName = activeOffice[0] || "-";
        const officeLat = Number(activeOffice[2]);
        const officeLng = Number(activeOffice[3]);
        
        const empLat = Number(data.latitude);
        const empLng = Number(data.longitude);
        
        if (!isNaN(empLat) && !isNaN(empLng) && !isNaN(officeLat) && !isNaN(officeLng) && empLat !== 0 && empLng !== 0) {
          const dist = calculateDistance(empLat, empLng, officeLat, officeLng);
          if (typeof dist === 'number') {
            distanceFromOffice = dist + "m";
          } else {
            distanceFromOffice = dist;
          }
        }
      }
    }
  }

  // Check if row already exists with this Attendance ID
  let existingRowIdx = -1;
  if (attendanceId) {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(attendanceId)) {
        existingRowIdx = i + 1;
        break;
      }
    }
  }

  const rowData = [
    attendanceId,
    employeeId,
    employeeName,
    attendanceType,
    checkInTime,
    checkOutTime,
    currentLocationAddress,
    officeName,
    distanceFromOffice,
    clientName,
    purpose,
    remarks,
    status,
    createdTime
  ];

  if (existingRowIdx !== -1) {
    // Update existing row
    sheet.getRange(existingRowIdx, 6).setValue(checkOutTime); // Check Out Time
    sheet.getRange(existingRowIdx, 13).setValue(status);      // Status
    if (remarks) sheet.getRange(existingRowIdx, 12).setValue(remarks); // Remarks
    if (currentLocationAddress) sheet.getRange(existingRowIdx, 7).setValue(currentLocationAddress); // Address
  } else {
    // Append new row
    sheet.appendRow(rowData);
  }

  return responseJSON({
    success: true,
    message: "Attendance recorded successfully in Google Sheets.",
    attendanceId: attendanceId
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return "-";
  const R = 6371e3; // meters
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const d = R * c; // in meters
  return Math.round(d * 10) / 10; // round to 1 decimal place
}
`;
