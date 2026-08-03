import { DeviceMetadata } from '../types';

export const APP_VERSION = '1.0.0';

const DEVICE_KEY = 'exfin_device_id';

/**
 * Gets or creates a unique Browser Device ID stored locally.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    // Fallback check for previous storage key
    deviceId = localStorage.getItem('exfin_oms_device_id');
    if (!deviceId) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        deviceId = `DEV-${crypto.randomUUID()}`;
      } else {
        deviceId = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
      }
    }
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
}

export const currentDeviceId = typeof window !== 'undefined' ? getOrCreateDeviceId() : '';

/**
 * Detects friendly browser name from userAgent string.
 */
export function detectBrowserName(ua: string = navigator.userAgent): string {
  if (/chrome|crios|crmo/i.test(ua) && !/edg/i.test(ua) && !/opr|opera/i.test(ua)) {
    return 'Google Chrome';
  } else if (/edg/i.test(ua)) {
    return 'Microsoft Edge';
  } else if (/safari/i.test(ua) && !/chrome|crios|crmo/i.test(ua)) {
    return 'Apple Safari';
  } else if (/firefox|fxios/i.test(ua)) {
    return 'Mozilla Firefox';
  } else if (/opr|opera/i.test(ua)) {
    return 'Opera';
  } else if (/android/i.test(ua)) {
    return 'Android Web Browser';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    return 'iOS Safari';
  }
  return 'Web Browser';
}

/**
 * Collects automatic device metadata required for registration.
 */
export function collectDeviceMetadata(): DeviceMetadata {
  const userAgent = navigator.userAgent;
  return {
    deviceId: getOrCreateDeviceId(),
    userAgent: userAgent,
    browserName: detectBrowserName(userAgent),
    registrationDate: new Date().toISOString(),
    appVersion: APP_VERSION,
  };
}
