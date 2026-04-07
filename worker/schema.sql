-- Cloudflare D1 schema for the PTSC-POS meeting room booking app.
-- This file is kept in sync with the current Worker API contract in worker/src/index.ts.

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  location TEXT DEFAULT '',
  status TEXT DEFAULT 'Đang hoạt động',
  building TEXT DEFAULT '',
  floor TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS needs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#fbbf24',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_phones (
  phone TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_phone TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_department TEXT DEFAULT '',
  user_phone TEXT NOT NULL,
  user_email TEXT DEFAULT '',
  project TEXT DEFAULT '',
  purpose TEXT DEFAULT '',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  date TEXT NOT NULL,
  repeat_group_id TEXT,
  color TEXT DEFAULT '',
  need_ids TEXT DEFAULT '',
  attendee_count INTEGER,
  needs_status TEXT NOT NULL DEFAULT 'confirmed',
  needs_status_updated_at TEXT,
  needs_confirmed INTEGER NOT NULL DEFAULT 1,
  needs_confirmed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  user_email TEXT DEFAULT '',
  action TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name);
CREATE INDEX IF NOT EXISTS idx_needs_sort_order ON needs(sort_order);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings(room_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_repeat_group_id ON bookings(repeat_group_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_phone ON push_subscriptions(user_phone);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
