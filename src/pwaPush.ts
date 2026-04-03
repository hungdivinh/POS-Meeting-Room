const PUSH_SERVICE_WORKER_URL = '/push-sw.js';

function hasWindowSupport(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

export function isIosDevice(): boolean {
  if (!hasWindowSupport()) return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function isStandaloneDisplayMode(): boolean {
  if (!hasWindowSupport()) return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function getPushSupportStatus(): {
  supported: boolean;
  message?: string;
} {
  if (!hasWindowSupport()) {
    return { supported: false, message: 'Trình duyệt hiện tại chưa sẵn sàng cho thông báo nền.' };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, message: 'Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.' };
  }

  if (isIosDevice() && !isStandaloneDisplayMode()) {
    return {
      supported: false,
      message: 'Trên iPhone, hãy Add to Home Screen rồi mở ứng dụng từ biểu tượng ngoài màn hình chính trước khi bật thông báo nền.',
    };
  }

  return { supported: true };
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!hasWindowSupport() || !('serviceWorker' in navigator)) {
    return null;
  }

  return navigator.serviceWorker.register(PUSH_SERVICE_WORKER_URL, {
    scope: '/',
    updateViaCache: 'none',
  });
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await registerPushServiceWorker();
  if (!registration) {
    return null;
  }

  return registration.pushManager.getSubscription();
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Bạn chưa cấp quyền thông báo cho trình duyệt này.');
  }

  const registration = await registerPushServiceWorker();
  if (!registration) {
    throw new Error('Không thể khởi tạo service worker để bật thông báo nền.');
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
  });
}

export async function unsubscribeFromPush(): Promise<PushSubscription | null> {
  const existing = await getCurrentPushSubscription();
  if (!existing) {
    return null;
  }

  await existing.unsubscribe();
  return existing;
}
