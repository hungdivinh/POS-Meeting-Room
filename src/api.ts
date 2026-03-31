const API_BASE = import.meta.env.VITE_API_URL || 'https://dat-phong-api.hungdivinh.workers.dev';

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
}

export interface Booking {
  id: string;
  roomId: string;
  userName: string;
  userPhone: string;
  project: string;
  purpose: string;
  startTime: string;
  endTime: string;
  date: string;
  repeatGroupId?: string;
  color?: string;
}

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
  create: (data: Omit<Booking, 'id'> | Omit<Booking, 'id'>[]) =>
    request<Booking | Booking[]>('/api/bookings', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Booking>) =>
    request<Booking>(`/api/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
