const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '' : 'https://dat-phong-api.hungdivinh.workers.dev');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error || 'Request failed');
  }
  return res.json() as Promise<T>;
}

// Types
export interface Room {
  id: string;
  name: string;
  capacity: number;
  equipment?: string[];
  color: string;
  location?: string;
  status?: string;
  building?: string;
  floor?: string;
}

export type BookingNeedsStatus = 'pending' | 'confirmed' | 'rejected';

export interface Booking {
  id: string;
  roomId: string;
  userName: string;
  userPhone: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  attendeeCount?: number | null;
  needsStatus?: BookingNeedsStatus;
  needsStatusUpdatedAt?: string | null;
  needsConfirmed?: boolean;
  needsConfirmedAt?: string | null;
  project: string;
  purpose: string;
  startTime: string;
  endTime: string;
  date: string;
  repeatGroupId?: string;
  color?: string;
  needIds?: string[];
}

export interface Need {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface PushConfig {
  enabled: boolean;
  vapidPublicKey: string | null;
  appName: string;
}

// Needs API
export const needsApi = {
  list: () => request<Need[]>('/api/needs'),
  create: (data: Omit<Need, 'id'>) => request<Need>('/api/needs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Need>) => request<Need>(`/api/needs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean }>(`/api/needs/${id}`, { method: 'DELETE' }),
};

// Rooms API
export const roomsApi = {
  list: () => request<Room[]>('/api/rooms'),
  create: (data: Omit<Room, 'id'>) => request<Room>('/api/rooms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Room>) => request<Room>(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean }>(`/api/rooms/${id}`, { method: 'DELETE' }),
};

// Bookings API
export const bookingsApi = {
  list: (startDate: string, endDate: string) =>
    request<Booking[]>(`/api/bookings?startDate=${startDate}&endDate=${endDate}`),
  listNeedsNotifications: (statuses: BookingNeedsStatus[], userPhone?: string) =>
    request<Booking[]>(
      `/api/bookings/needs-notifications?statuses=${encodeURIComponent(statuses.join(','))}${
        userPhone ? `&userPhone=${encodeURIComponent(userPhone)}` : ''
      }`,
    ),
  listPendingNeeds: (userPhone?: string) =>
    request<Booking[]>(`/api/bookings/pending-needs${userPhone ? `?userPhone=${encodeURIComponent(userPhone)}` : ''}`),
  create: (data: Omit<Booking, 'id'> | Omit<Booking, 'id'>[]) =>
    request<Booking | Booking[]>('/api/bookings', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Booking>) =>
    request<Booking>(`/api/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateNeedsStatus: (id: string, status: BookingNeedsStatus) =>
    request<Booking>(`/api/bookings/${id}/needs-status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  confirmNeeds: (id: string) =>
    request<Booking>(`/api/bookings/${id}/confirm-needs`, { method: 'PUT' }),
  delete: (id: string) => request<{ success: boolean }>(`/api/bookings/${id}`, { method: 'DELETE' }),
  deleteGroup: (id: string) => request<{ success: boolean; deletedCount: number }>(`/api/bookings/${id}?deleteGroup=true`, { method: 'DELETE' }),
};

// Activity Logs
export interface ActivityLog {
  id: string;
  userName: string;
  userPhone: string;
  action: string;
  detail: string;
  createdAt: string;
}

export const logsApi = {
  list: (limit = 200) => request<ActivityLog[]>(`/api/logs?limit=${limit}`),
  create: (data: { userName: string; userPhone: string; action: string; detail?: string }) =>
    request<{ id: string }>('/api/logs', { method: 'POST', body: JSON.stringify(data) }),
};

// Admin Phones API
export const adminPhonesApi = {
  list: () => request<string[]>('/api/admin-phones'),
  add: (phone: string) => request<{ success: boolean }>('/api/admin-phones', { method: 'POST', body: JSON.stringify({ phone }) }),
  remove: (phone: string) => request<{ success: boolean }>(`/api/admin-phones/${encodeURIComponent(phone)}`, { method: 'DELETE' }),
};

export const pushApi = {
  getConfig: () => request<PushConfig>('/api/push/config'),
  subscribe: (userPhone: string, subscription: PushSubscriptionJSON) =>
    request<{ success: boolean }>('/api/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ userPhone, subscription }),
    }),
  unsubscribe: (userPhone: string, endpoint: string) =>
    request<{ success: boolean }>('/api/push/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ userPhone, endpoint }),
    }),
};
