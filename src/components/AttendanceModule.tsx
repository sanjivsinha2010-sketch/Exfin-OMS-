import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Home, 
  Briefcase, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Send,
  Calendar,
  Compass,
  History,
  Check
} from 'lucide-react';
import { Employee, AttendanceRecord, AttendanceType, TodayAttendanceSummary } from '../types';
import { getLocalAttendanceRecords, saveLocalAttendance, addToOfflineQueue } from '../lib/idb';

// Default Office Geo Fence settings (Delhi NCR / Configurable)
const DEFAULT_OFFICE_LAT = 28.6139;
const DEFAULT_OFFICE_LNG = 77.2090;
const GEO_FENCE_RADIUS_METERS = 500;

interface AttendanceModuleProps {
  employee: Employee;
  isOnline: boolean;
}

// Haversine Distance Formula in Meters
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

// Format distance helper
function formatDistance(meters: number | null): string {
  if (meters === null) return 'N/A';
  if (meters < 1000) {
    return `${meters} meters`;
  } else {
    return `${(meters / 1000).toFixed(2)} km`;
  }
}

// Format Time helper
function formatTime(isoString: string | null): string {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return 'N/A';
  }
}

// Format duration helper
function calculateWorkingHours(records: AttendanceRecord[]): string {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOfficeRecords = records.filter(
    (r) => r.attendanceType === 'OFFICE' && r.createdTime.startsWith(todayStr)
  );

  let totalMs = 0;

  for (const rec of todayOfficeRecords) {
    if (rec.checkInTime) {
      const inTime = new Date(rec.checkInTime).getTime();
      const outTime = rec.checkOutTime ? new Date(rec.checkOutTime).getTime() : Date.now();
      if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
        totalMs += outTime - inTime;
      }
    }
  }

  if (totalMs <= 0) return '0h 0m';
  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({ employee, isOnline }) => {
  const [selectedType, setSelectedType] = useState<AttendanceType>('OFFICE');
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // GeoFence Dynamic Configuration - Loaded from GeoFenceSettings cache without hardcoded coordinates
  const [officeLat, setOfficeLat] = useState<number | null>(() => {
    const cached = localStorage.getItem('exfin_office_lat');
    return cached ? parseFloat(cached) : null;
  });
  const [officeLng, setOfficeLng] = useState<number | null>(() => {
    const cached = localStorage.getItem('exfin_office_lng');
    return cached ? parseFloat(cached) : null;
  });
  const [geoRadiusMeters, setGeoRadiusMeters] = useState<number | null>(() => {
    const cached = localStorage.getItem('exfin_office_radius');
    return cached ? parseFloat(cached) : null;
  });

  // Verify office configuration parameters
  const isOfficeConfigValid = 
    officeLat !== null && 
    officeLng !== null && 
    geoRadiusMeters !== null &&
    officeLat >= -90 && officeLat <= 90 && 
    officeLng >= -180 && officeLng <= 180;

  // Load GeoFence parameters from backend and refresh cache
  useEffect(() => {
    if (isOnline) {
      fetch('/api/geofence')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            if (data.officeLat !== undefined) {
              setOfficeLat(data.officeLat);
              localStorage.setItem('exfin_office_lat', String(data.officeLat));
            }
            if (data.officeLng !== undefined) {
              setOfficeLng(data.officeLng);
              localStorage.setItem('exfin_office_lng', String(data.officeLng));
            }
            if (data.radiusMeters !== undefined) {
              setGeoRadiusMeters(data.radiusMeters);
              localStorage.setItem('exfin_office_radius', String(data.radiusMeters));
            }
          }
        })
        .catch(() => {});
    }
  }, [isOnline]);

  // Location Display state compliant with EXFIN OMS privacy standards (No raw GPS coordinates shown)
  const [currentAddress, setCurrentAddress] = useState<string>(`City Centre,\nDurgapur,\nWest Bengal`);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(18);
  const [isInsideOffice, setIsInsideOffice] = useState<boolean>(true);

  // Proactive Location verification (Internal-only, never displaying GPS coordinates)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (officeLat !== null && officeLng !== null) {
            const dist = calculateDistanceMeters(lat, lng, officeLat, officeLng);
            setDistanceToOffice(dist);
            if (geoRadiusMeters !== null) {
              setIsInsideOffice(dist <= geoRadiusMeters);
            }
          } else {
            setDistanceToOffice(null);
            setIsInsideOffice(false);
          }

          if (isOnline) {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
              .then((res) => res.json())
              .then((data) => {
                if (data && data.address) {
                  const addr = data.address;
                  const suburb = addr.suburb || addr.neighbourhood || addr.commercial || addr.residential || addr.village || 'City Centre';
                  const city = addr.city || addr.town || addr.county || 'Durgapur';
                  const state = addr.state || 'West Bengal';
                  setCurrentAddress(`${suburb},\n${city},\n${state}`);
                }
              })
              .catch(() => {});
          }
        },
        () => {
          // Fallback to default enterprise office location as specified
          setCurrentAddress(`City Centre,\nDurgapur,\nWest Bengal`);
          setDistanceToOffice(18);
          setIsInsideOffice(true);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }, [officeLat, officeLng, geoRadiusMeters, isOnline]);

  // Client Visit Form modal state
  const [showClientModal, setShowClientModal] = useState<boolean>(false);
  const [clientName, setClientName] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // History modal view
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Load today's attendance records
  const loadAttendance = useCallback(async () => {
    try {
      const records = await getLocalAttendanceRecords(employee.employeeId);
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRecs = records.filter((r) => r.createdTime.startsWith(todayStr));
      setTodayRecords(todayRecs);
    } catch (err) {
      console.error('Failed to load local attendance:', err);
    }
  }, [employee.employeeId]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Derived state for Today's Attendance Status Card
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Sort records ascending by createdTime to identify the very first (earliest) attendance record today
  const sortedTodayRecords = [...todayRecords]
    .filter((r) => r.createdTime.startsWith(todayStr))
    .sort((a, b) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime());
  
  const activeType = sortedTodayRecords.length > 0 ? sortedTodayRecords[0].attendanceType : null;

  // Auto-synchronize tab with active attendance type on load or whenever records change
  useEffect(() => {
    if (activeType) {
      setSelectedType(activeType);
    }
  }, [activeType]);

  const todayOffice = todayRecords.find((r) => r.attendanceType === 'OFFICE' && r.createdTime.startsWith(todayStr));
  const todayWFH = todayRecords.find((r) => r.attendanceType === 'WFH' && r.createdTime.startsWith(todayStr));
  const todayClientVisits = todayRecords.filter((r) => r.attendanceType === 'CLIENT_VISIT' && r.createdTime.startsWith(todayStr));

  const officeRecords = todayRecords.filter((r) => r.attendanceType === 'OFFICE' && r.createdTime.startsWith(todayStr));
  const hasOfficeCheckIn = officeRecords.some((r) => r.status === 'Checked In');
  const hasOfficeCheckOut = officeRecords.some((r) => r.status === 'Checked Out');

  const isOfficeCheckedIn = hasOfficeCheckIn && !hasOfficeCheckOut;
  const isOfficeCheckedOut = hasOfficeCheckOut;
  const isWFHDone = !!todayWFH;
  const isClientVisitDone = todayClientVisits.length > 0;

  // Compute status summary
  let todayStatusText = 'Not Marked Yet';
  let primaryTypeDisplay: AttendanceType | 'NONE' = 'NONE';
  let lastAttendanceTime: string | null = null;

  const latestRec = todayRecords.slice().sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())[0];

  if (latestRec) {
    primaryTypeDisplay = latestRec.attendanceType;
    lastAttendanceTime = latestRec.checkOutTime || latestRec.checkInTime || latestRec.createdTime;

    if (latestRec.attendanceType === 'OFFICE') {
      todayStatusText = latestRec.status === 'Checked In' ? 'Checked In (Office)' : 'Checked Out (Office)';
    } else if (latestRec.attendanceType === 'WFH') {
      todayStatusText = 'WFH Completed';
    } else if (latestRec.attendanceType === 'CLIENT_VISIT') {
      todayStatusText = `Client Visit Logged (${todayClientVisits.length})`;
    }
  }

  const workingHoursDisplay = calculateWorkingHours(todayRecords);

  // Get GPS Position Promise
  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Location permission required.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => {
          let msg = 'Unable to connect to server. Please try again.';
          if (err.code === err.PERMISSION_DENIED) {
            msg = 'Location permission required.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            msg = 'Network unavailable. Please try again.';
          } else if (err.code === err.TIMEOUT) {
            msg = 'Please try again.';
          }
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  // Submit Attendance Handler
  const handleRecordAttendance = async (
    type: AttendanceType,
    actionType: 'checkIn' | 'checkOut',
    extraFields?: { clientName?: string; purpose?: string; remarks?: string }
  ) => {
    setStatusMessage(null);
    setIsLoading(true);
    setGeoLoading(true);

    try {
      // 1. Acquire GPS
      const pos = await getCurrentPosition();
      setGeoLoading(false);

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // 2. OFFICE Geo-Fence Validation
      if (type === 'OFFICE' && actionType === 'checkIn') {
        if (!isOfficeConfigValid) {
          setIsLoading(false);
          setStatusMessage({
            type: 'error',
            text: `Office location is not configured correctly.`,
          });
          return;
        }
        const distance = calculateDistanceMeters(lat, lng, officeLat!, officeLng!);
        if (distance > geoRadiusMeters!) {
          setIsLoading(false);
          setStatusMessage({
            type: 'error',
            text: `You are outside the office location.`,
          });
          return;
        }
      }

      // Active attendance type restriction check
      if (activeType && activeType !== type) {
        setIsLoading(false);
        setStatusMessage({
          type: 'error',
          text: `You already have an active attendance session for ${activeType} today.`,
        });
        return;
      }

      // Single attendance session per day check (excluding check-out for office)
      if (actionType === 'checkIn') {
        const alreadyCheckedIn = sortedTodayRecords.some((r) => r.status === 'Checked In' || r.attendanceType === 'WFH' || r.attendanceType === 'CLIENT_VISIT');
        if (alreadyCheckedIn) {
          setIsLoading(false);
          setStatusMessage({
            type: 'error',
            text: 'You have already recorded attendance for today.',
          });
          return;
        }
      }

      // 3. WFH Single Daily Check constraint
      if (type === 'WFH' && isWFHDone) {
        setIsLoading(false);
        setStatusMessage({
          type: 'info',
          text: 'Work From Home (WFH) attendance has already been recorded for today.',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const attendanceId = `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      let status = 'Checked In';
      let checkInTime = nowIso;
      let checkOutTime = '';

      if (type === 'OFFICE') {
        if (actionType === 'checkOut') {
          status = 'Checked Out';
          checkInTime = todayOffice?.checkInTime || nowIso;
          checkOutTime = nowIso;
        } else {
          status = 'Checked In';
          checkInTime = nowIso;
          checkOutTime = '';
        }
      } else if (type === 'WFH') {
        status = 'WFH Marked';
        checkInTime = nowIso;
        checkOutTime = nowIso;
      } else if (type === 'CLIENT_VISIT') {
        status = 'Client Visit Logged';
        checkInTime = nowIso;
        checkOutTime = nowIso;
      }

      const record: AttendanceRecord = {
        attendanceId,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        attendanceType: type,
        checkInTime,
        checkOutTime,
        latitude: lat,
        longitude: lng,
        address: currentAddress.replace(/\n/g, ', '),
        clientName: extraFields?.clientName || '',
        purpose: extraFields?.purpose || '',
        remarks: extraFields?.remarks || '',
        deviceId: employee.deviceId,
        status,
        createdTime: nowIso,
        syncedToGoogleSheets: isOnline,
      };

      // 4. Save to local IndexedDB store immediately
      await saveLocalAttendance(record);

      // 5. Send to Server / Queue if Offline
      if (isOnline) {
        try {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record),
          });
          if (!res.ok) {
            await addToOfflineQueue({ type: 'ATTENDANCE', payload: record, createdAt: nowIso });
          }
        } catch {
          await addToOfflineQueue({ type: 'ATTENDANCE', payload: record, createdAt: nowIso });
        }
      } else {
        await addToOfflineQueue({ type: 'ATTENDANCE', payload: record, createdAt: nowIso });
      }

      // Reload local attendance list
      await loadAttendance();

      setIsLoading(false);
      setShowClientModal(false);
      setClientName('');
      setPurpose('');
      setRemarks('');

      const actionText =
        type === 'OFFICE'
          ? actionType === 'checkIn'
            ? 'Office Check-In successful!'
            : 'Office Check-Out successful!'
          : type === 'WFH'
          ? 'WFH Attendance marked successfully!'
          : 'Client Visit recorded successfully!';

      setStatusMessage({ type: 'success', text: actionText });
    } catch (err: any) {
      setIsLoading(false);
      setGeoLoading(false);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to record attendance. Please check GPS permissions.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* TODAY'S ATTENDANCE STATUS CARD */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-inner">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Today's Attendance Status</span>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
          >
            <History className="w-3.5 h-3.5" /> History
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Status</span>
            <span className="text-xs font-bold text-emerald-400 mt-1 block truncate">{todayStatusText}</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Attendance Type</span>
            <span className="text-xs font-bold text-white mt-1 block tracking-wide">
              {primaryTypeDisplay === 'NONE' ? 'None' : primaryTypeDisplay}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Last Record Time</span>
            <span className="text-xs font-mono font-semibold text-indigo-300 mt-1 block">
              {formatTime(lastAttendanceTime)}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Today's Working Hours</span>
            <span className="text-xs font-mono font-bold text-white mt-1 block">{workingHoursDisplay}</span>
          </div>
        </div>
      </div>

      {/* EXFIN ENTERPRISE LOCATION DISPLAY STANDARD (No raw coordinates are displayed) */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            📍 Current Location
          </span>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 rounded-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active Verification
          </span>
        </div>

        <div className="space-y-4 text-slate-300">
          <div>
            <p className="text-sm font-bold text-white whitespace-pre-line leading-relaxed pl-1">
              {currentAddress}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                🏢 Office
              </span>
              <span className="text-xs font-bold text-white block">
                EXFIN Head Office
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                📏 Distance from Office
              </span>
              <span className="text-xs font-bold text-white block">
                {formatDistance(distanceToOffice)}
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Protection Zone Status
            </span>
            {isInsideOffice ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                🟢 Inside Office Area
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                🟡 Outside Office Area
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SINGLE MAIN ATTENDANCE MODULE */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">Attendance</h3>
        </div>

        {/* Status / Error Toast Notice */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2 border ${
                statusMessage.type === 'error'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                  : statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-800'
              }`}
            >
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-relaxed">{statusMessage.text}</span>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ATTENDANCE TYPE SELECTOR (Office / Work From Home / Client Visit) */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setSelectedType('OFFICE')}
            disabled={activeType !== null && activeType !== 'OFFICE'}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              selectedType === 'OFFICE'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            } ${activeType !== null && activeType !== 'OFFICE' ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Building2 className="w-3.5 h-3.5" /> Office
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('WFH')}
            disabled={activeType !== null && activeType !== 'WFH'}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              selectedType === 'WFH'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            } ${activeType !== null && activeType !== 'WFH' ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Home className="w-3.5 h-3.5" /> WFH
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('CLIENT_VISIT')}
            disabled={activeType !== null && activeType !== 'CLIENT_VISIT'}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              selectedType === 'CLIENT_VISIT'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            } ${activeType !== null && activeType !== 'CLIENT_VISIT' ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Briefcase className="w-3.5 h-3.5" /> Client Visit
          </button>
        </div>

        {/* TYPE 1: OFFICE */}
        {selectedType === 'OFFICE' && (
          <div className="space-y-3">
            {!isOfficeConfigValid && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="flex-1 font-semibold leading-relaxed">Office location is not configured correctly.</span>
              </div>
            )}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" /> Office Geo-Fence Active
              </span>
              <span className="text-emerald-400 font-semibold text-[10px]">Location Protection On</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => handleRecordAttendance('OFFICE', 'checkIn')}
                disabled={isLoading || isOfficeCheckedIn || hasOfficeCheckIn || !isOfficeConfigValid}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  isOfficeCheckedIn || hasOfficeCheckIn || !isOfficeConfigValid
                    ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                }`}
              >
                {isLoading && selectedType === 'OFFICE' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {geoLoading ? 'Acquiring GPS...' : 'Processing...'}
                  </>
                ) : isOfficeCheckedIn ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Checked In
                  </>
                ) : hasOfficeCheckIn ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-400" /> Session Completed
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" /> Check In
                  </>
                )}
              </button>

              <button
                onClick={() => handleRecordAttendance('OFFICE', 'checkOut')}
                disabled={isLoading || !isOfficeCheckedIn || isOfficeCheckedOut}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  !isOfficeCheckedIn || isOfficeCheckedOut
                    ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50'
                }`}
              >
                {isLoading && selectedType === 'OFFICE' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                  </>
                ) : isOfficeCheckedOut ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-400" /> Checked Out
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" /> Check Out
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TYPE 2: WORK FROM HOME */}
        {selectedType === 'WFH' && (
          <div className="space-y-3">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-[11px] text-slate-400 flex items-center justify-between">
              <span>GPS required &bull; 1 submission per day</span>
              <span className="text-indigo-400 font-semibold">{isWFHDone ? 'Completed Today' : 'Available'}</span>
            </div>

            <button
              onClick={() => handleRecordAttendance('WFH', 'checkIn')}
              disabled={isLoading || isWFHDone}
              className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                isWFHDone
                  ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950/50'
              }`}
            >
              {isLoading && selectedType === 'WFH' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {geoLoading ? 'Acquiring GPS...' : 'Recording WFH...'}
                </>
              ) : isWFHDone ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" /> WFH Check-In Completed
                </>
              ) : (
                <>
                  <Home className="w-4 h-4" /> WFH Check-In
                </>
              )}
            </button>
          </div>
        )}

        {/* TYPE 3: CLIENT VISIT */}
        {selectedType === 'CLIENT_VISIT' && (
          <div className="space-y-3">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-[11px] text-slate-400 flex items-center justify-between">
              <span>GPS required &bull; 1 submission per day</span>
              <span className="text-indigo-400 font-semibold">{isClientVisitDone ? 'Completed Today' : 'Available'}</span>
            </div>

            <button
              onClick={() => {
                setStatusMessage(null);
                setShowClientModal(true);
              }}
              disabled={isLoading || isClientVisitDone}
              className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                isClientVisitDone
                  ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/50'
              }`}
            >
              {isClientVisitDone ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" /> Client Visit Completed
                </>
              ) : (
                <>
                  <Briefcase className="w-4 h-4" /> Client Visit Check-In
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* CLIENT VISIT FORM MODAL */}
      <AnimatePresence>
        {showClientModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Briefcase className="w-4 h-4 text-indigo-400" /> Client Visit Check-In
                </div>
                <button
                  onClick={() => setShowClientModal(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!clientName.trim() || !purpose.trim()) return;
                  handleRecordAttendance('CLIENT_VISIT', 'checkIn', {
                    clientName: clientName.trim(),
                    purpose: purpose.trim(),
                    remarks: remarks.trim(),
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Client Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Enter Client or Company Name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Purpose <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Sales Meeting, Technical Audit"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Remarks <span className="text-slate-500">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Additional notes..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClientModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !clientName.trim() || !purpose.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Submit Check-In
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TODAY'S ATTENDANCE HISTORY MODAL */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 shrink-0">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <History className="w-4 h-4 text-indigo-400" /> Attendance Records Today
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-3 flex-1 pr-1">
                {todayRecords.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No attendance records logged for today yet.
                  </div>
                ) : (
                  todayRecords.map((rec) => (
                    <div
                      key={rec.attendanceId}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-300">{rec.attendanceType}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatTime(rec.createdTime)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span>Status: <strong className="text-emerald-400">{rec.status}</strong></span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {rec.attendanceId.slice(-8)}
                        </span>
                      </div>

                      {rec.clientName && (
                        <div className="text-[11px] text-slate-400 border-t border-slate-900 pt-1.5">
                          <strong>Client:</strong> {rec.clientName} &bull; <strong>Purpose:</strong> {rec.purpose}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
