const DEVICE_ID_KEY = 'np-live-device-id';

function makeDeviceId() {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : null;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `np-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getClientDevice() {
  if (typeof window === 'undefined') return { deviceId: '', deviceName: '' };

  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = makeDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  const deviceName = [navigator.platform, navigator.userAgent.split(' ').slice(0, 3).join(' ')]
    .filter(Boolean)
    .join(' / ')
    .slice(0, 160);

  return { deviceId, deviceName };
}
