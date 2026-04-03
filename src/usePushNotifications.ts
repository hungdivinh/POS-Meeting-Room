import { useCallback, useEffect, useMemo, useState } from 'react';
import { pushApi, type PushConfig } from './api';
import { getCurrentPushSubscription, getPushSupportStatus, subscribeToPush, unsubscribeFromPush } from './pwaPush';

export type PushDeliveryRole = 'admin' | 'user';
export type PushState = 'checking' | 'enabled' | 'disabled' | 'unsupported' | 'blocked' | 'error';

function createFallbackConfig(): PushConfig {
  return {
    enabled: false,
    vapidPublicKey: null,
    appName: 'Lịch Phòng Họp',
  };
}

export function usePushNotifications(userPhone: string | undefined, role: PushDeliveryRole) {
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [status, setStatus] = useState<PushState>('checking');
  const [message, setMessage] = useState('Đang kiểm tra thông báo nền trên thiết bị này...');
  const [busy, setBusy] = useState(false);

  const roleMessages = useMemo(() => {
    if (role === 'admin') {
      return {
        enabled: 'Thiết bị này sẽ nhận thông báo khi có lịch cần admin xác nhận nhu cầu.',
        disabled: 'Bật thông báo nền để admin nhận ngay khi có lịch cần xác nhận nhu cầu.',
      };
    }

    return {
      enabled: 'Thiết bị này sẽ nhận thông báo khi admin từ chối nhu cầu hậu cần của bạn.',
      disabled: 'Bật thông báo nền để biết ngay khi admin từ chối nhu cầu hậu cần.',
    };
  }, [role]);

  useEffect(() => {
    let cancelled = false;

    pushApi.getConfig()
      .then((value) => {
        if (!cancelled) {
          setConfig(value);
        }
      })
      .catch((error) => {
        console.error('Failed to load push config:', error);
        if (!cancelled) {
          setConfig(createFallbackConfig());
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!userPhone) {
      setStatus('disabled');
      setMessage('Đăng nhập trên thiết bị này rồi bật thông báo nền khi cần.');
      return;
    }

    const support = getPushSupportStatus();
    if (!support.supported) {
      setStatus('unsupported');
      setMessage(support.message || 'Thiết bị này chưa sẵn sàng cho thông báo nền.');
      return;
    }

    if (!config) {
      setStatus('checking');
      setMessage('Đang kiểm tra cấu hình thông báo nền...');
      return;
    }

    if (!config.enabled || !config.vapidPublicKey) {
      setStatus('unsupported');
      setMessage('Máy chủ chưa bật cấu hình thông báo nền cho ứng dụng này.');
      return;
    }

    try {
      const subscription = await getCurrentPushSubscription();
      if (subscription) {
        await pushApi.subscribe(userPhone, subscription.toJSON());
        setStatus('enabled');
        setMessage(roleMessages.enabled);
        return;
      }

      if (Notification.permission === 'denied') {
        setStatus('blocked');
        setMessage('Trình duyệt đang chặn thông báo. Hãy bật lại trong cài đặt của Chrome hoặc Safari.');
        return;
      }

      setStatus('disabled');
      setMessage(roleMessages.disabled);
    } catch (error) {
      console.error('Failed to refresh push notification status:', error);
      setStatus('error');
      setMessage('Không thể kiểm tra trạng thái thông báo nền lúc này.');
    }
  }, [config, roleMessages, userPhone]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const enable = useCallback(async () => {
    if (!userPhone) {
      throw new Error('Bạn cần đăng nhập trước khi bật thông báo nền.');
    }

    if (!config?.enabled || !config.vapidPublicKey) {
      throw new Error('Máy chủ chưa được cấu hình để gửi thông báo nền.');
    }

    const support = getPushSupportStatus();
    if (!support.supported) {
      throw new Error(support.message || 'Thiết bị này chưa hỗ trợ thông báo nền.');
    }

    setBusy(true);
    try {
      const subscription = await subscribeToPush(config.vapidPublicKey);
      await pushApi.subscribe(userPhone, subscription.toJSON());
      setStatus('enabled');
      setMessage(roleMessages.enabled);
    } finally {
      setBusy(false);
      void refreshStatus();
    }
  }, [config, refreshStatus, roleMessages, userPhone]);

  const disable = useCallback(async (phoneOverride?: string) => {
    setBusy(true);
    try {
      const currentSubscription = await getCurrentPushSubscription();
      const endpoint = currentSubscription?.toJSON().endpoint || currentSubscription?.endpoint;
      const targetPhone = phoneOverride || userPhone;

      if (endpoint && targetPhone) {
        await pushApi.unsubscribe(targetPhone, endpoint).catch((error) => {
          console.error('Failed to unsubscribe push endpoint on server:', error);
        });
      }

      await unsubscribeFromPush();
      setStatus('disabled');
      setMessage(roleMessages.disabled);
    } finally {
      setBusy(false);
      void refreshStatus();
    }
  }, [refreshStatus, roleMessages, userPhone]);

  return {
    config,
    status,
    message,
    busy,
    enable,
    disable,
    refreshStatus,
  };
}
