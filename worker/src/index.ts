export interface Env {
  DB: D1Database;
  DEFAULT_ADMIN_PHONES?: string;
}

function corsHeaders(origin: string = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function getConfiguredAdminPhones(env: Env): string[] {
  return String(env.DEFAULT_ADMIN_PHONES || '')
    .split(',')
    .map((phone) => phone.trim())
    .filter(Boolean);
}

const BOOKING_OVERLAP_ERROR = 'Khung giờ này đã có người đặt. Vui lòng chọn khung giờ khác.';

type BookingNeedsStatus = 'pending' | 'confirmed' | 'rejected';
const BOOKING_NEEDS_STATUSES: BookingNeedsStatus[] = ['pending', 'confirmed', 'rejected'];

interface BookingWriteInput {
  roomId?: unknown;
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  userName?: unknown;
  userPhone?: unknown;
  attendeeCount?: unknown;
  needsStatus?: unknown;
  needsConfirmed?: unknown;
  project?: unknown;
  purpose?: unknown;
  repeatGroupId?: unknown;
  color?: unknown;
  needIds?: unknown;
}

function parseAttendeeCount(input: unknown): { value: number | null; valid: boolean } {
  if (input === null || input === undefined) {
    return { value: null, valid: true };
  }

  if (typeof input === 'string' && !input.trim()) {
    return { value: null, valid: true };
  }

  const parsed = typeof input === 'number' ? input : Number(input);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return { value: null, valid: false };
  }

  return { value: parsed, valid: true };
}

function getBookingValidationError(input: BookingWriteInput, requireContact = false): string | null {
  if (typeof input.roomId !== 'string' || !input.roomId.trim()) {
    return 'Thiếu phòng họp.';
  }

  if (typeof input.date !== 'string' || !input.date.trim()) {
    return 'Thiếu ngày đặt phòng.';
  }

  if (typeof input.startTime !== 'string' || typeof input.endTime !== 'string') {
    return 'Thiếu khung giờ đặt phòng.';
  }

  if (!input.startTime.startsWith(`${input.date}T`) || !input.endTime.startsWith(`${input.date}T`)) {
    return 'Ngày đặt phòng không khớp với khung giờ.';
  }

  if (input.startTime >= input.endTime) {
    return 'Giờ kết thúc phải sau giờ bắt đầu.';
  }

  if (requireContact) {
    if (typeof input.userName !== 'string' || !input.userName.trim()) {
      return 'Thiếu tên người đặt.';
    }

    if (typeof input.userPhone !== 'string' || !input.userPhone.trim()) {
      return 'Thiếu số điện thoại người đặt.';
    }
  }

  const attendeeCount = parseAttendeeCount(input.attendeeCount);
  if (!attendeeCount.valid) {
    return 'Số người phải là số nguyên lớn hơn 0.';
  }

  return null;
}

function normalizeNeedIdList(needIds: string[]): string {
  return Array.from(new Set(
    needIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  ))
    .sort((a, b) => a.localeCompare(b))
    .join(',');
}

function serializeNeedIds(needIds: unknown): string {
  if (Array.isArray(needIds)) {
    return normalizeNeedIdList(needIds);
  }

  if (typeof needIds === 'string') {
    return normalizeNeedIdList(needIds.split(','));
  }

  return '';
}

function normalizeNeedsStatus(input: unknown): BookingNeedsStatus | null {
  if (typeof input !== 'string') {
    return null;
  }

  const normalized = input.trim().toLowerCase();
  return BOOKING_NEEDS_STATUSES.includes(normalized as BookingNeedsStatus)
    ? (normalized as BookingNeedsStatus)
    : null;
}

function getNeedsStatusPayload(
  needIds: unknown,
  explicitNeedsStatus?: unknown,
  explicitNeedsConfirmed?: unknown,
  previous?: {
    serializedNeedIds?: unknown;
    needsStatus?: unknown;
    needsStatusUpdatedAt?: unknown;
    needsConfirmed?: unknown;
    needsConfirmedAt?: unknown;
  }
): {
  serializedNeedIds: string;
  needsStatus: BookingNeedsStatus;
  needsStatusUpdatedAt: string | null;
  needsConfirmed: number;
  needsConfirmedAt: string | null;
} {
  const serializedNeedIds = serializeNeedIds(needIds);
  const hasNeeds = serializedNeedIds.length > 0;

  if (!hasNeeds) {
    return {
      serializedNeedIds,
      needsStatus: 'confirmed',
      needsStatusUpdatedAt: null,
      needsConfirmed: 1,
      needsConfirmedAt: null,
    };
  }

  const previousNeedIds = serializeNeedIds(previous?.serializedNeedIds);
  const previousStatus =
    normalizeNeedsStatus(previous?.needsStatus) ??
    (previous?.needsConfirmed === 1 || previous?.needsConfirmed === true ? 'confirmed' : 'pending');
  const previousStatusUpdatedAt =
    typeof previous?.needsStatusUpdatedAt === 'string' && previous.needsStatusUpdatedAt
      ? previous.needsStatusUpdatedAt
      : typeof previous?.needsConfirmedAt === 'string' && previous.needsConfirmedAt
        ? previous.needsConfirmedAt
        : null;
  const explicitStatus =
    normalizeNeedsStatus(explicitNeedsStatus) ??
    (explicitNeedsConfirmed === true
      ? 'confirmed'
      : explicitNeedsConfirmed === false
        ? 'pending'
        : null);

  if (explicitStatus) {
    const now = new Date().toISOString();
    const confirmedAt =
      explicitStatus === 'confirmed'
        ? previousNeedIds === serializedNeedIds && previousStatus === explicitStatus
          ? (typeof previous?.needsConfirmedAt === 'string' ? previous.needsConfirmedAt : previousStatusUpdatedAt ?? now)
          : now
        : null;

    return {
      serializedNeedIds,
      needsStatus: explicitStatus,
      needsStatusUpdatedAt:
        previousNeedIds === serializedNeedIds && previousStatus === explicitStatus
          ? previousStatusUpdatedAt ?? now
          : now,
      needsConfirmed: explicitStatus === 'confirmed' ? 1 : 0,
      needsConfirmedAt: confirmedAt,
    };
  }

  if (previousNeedIds === serializedNeedIds && (previousStatus === 'confirmed' || previousStatus === 'rejected')) {
    return {
      serializedNeedIds,
      needsStatus: previousStatus,
      needsStatusUpdatedAt: previousStatusUpdatedAt,
      needsConfirmed: previousStatus === 'confirmed' ? 1 : 0,
      needsConfirmedAt:
        previousStatus === 'confirmed'
          ? (typeof previous?.needsConfirmedAt === 'string' ? previous.needsConfirmedAt : previousStatusUpdatedAt)
          : null,
    };
  }

  return {
    serializedNeedIds,
    needsStatus: 'pending',
    needsStatusUpdatedAt: new Date().toISOString(),
    needsConfirmed: 0,
    needsConfirmedAt: null,
  };
}

function getResultChanges(result: D1Result<unknown>): number {
  return result.meta.changes ?? 0;
}

async function ensureBookingAttendeeCountColumn(db: D1Database): Promise<void> {
  try {
    await db.prepare('ALTER TABLE bookings ADD COLUMN attendee_count INTEGER').run();
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw err;
    }
  }
}

async function ensureBookingNeedsConfirmationColumns(db: D1Database): Promise<void> {
  try {
    await db.prepare("ALTER TABLE bookings ADD COLUMN needs_status TEXT NOT NULL DEFAULT 'confirmed'").run();
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw err;
    }
  }

  try {
    await db.prepare('ALTER TABLE bookings ADD COLUMN needs_status_updated_at TEXT').run();
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw err;
    }
  }

  try {
    await db.prepare('ALTER TABLE bookings ADD COLUMN needs_confirmed INTEGER NOT NULL DEFAULT 1').run();
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw err;
    }
  }

  try {
    await db.prepare('ALTER TABLE bookings ADD COLUMN needs_confirmed_at TEXT').run();
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (!message.includes('duplicate column name') && !message.includes('already exists')) {
      throw err;
    }
  }

  await db.prepare(
    `UPDATE bookings
     SET needs_confirmed = CASE WHEN COALESCE(need_ids, '') != '' THEN 0 ELSE 1 END
     WHERE needs_confirmed IS NULL`
  ).run();

  await db.prepare(
    `UPDATE bookings
     SET needs_status = CASE
       WHEN COALESCE(need_ids, '') = '' THEN 'confirmed'
       WHEN COALESCE(needs_confirmed, 0) = 1 THEN 'confirmed'
       ELSE 'pending'
     END
     WHERE COALESCE(needs_status, '') = ''
        OR needs_status NOT IN ('pending', 'confirmed', 'rejected')`
  ).run();

  await db.prepare(
    `UPDATE bookings
     SET needs_status_updated_at = CASE
       WHEN COALESCE(need_ids, '') = '' THEN NULL
       ELSE COALESCE(needs_confirmed_at, needs_status_updated_at, created_at, datetime('now'))
     END
     WHERE COALESCE(needs_status_updated_at, '') = ''`
  ).run();

  await db.prepare(
    `UPDATE bookings
     SET needs_confirmed = CASE
       WHEN COALESCE(need_ids, '') = '' THEN 1
       WHEN needs_status = 'confirmed' THEN 1
       ELSE 0
     END`
  ).run();
}

async function ensureBookingSchema(db: D1Database): Promise<void> {
  await ensureBookingAttendeeCountColumn(db);
  await ensureBookingNeedsConfirmationColumns(db);
}

function mapBookingRow(r: any) {
  const hasNeeds = Boolean(r.need_ids && String(r.need_ids).length > 0);
  const needsStatus = normalizeNeedsStatus(r.needs_status)
    ?? (hasNeeds
      ? (typeof r.needs_confirmed === 'number' && r.needs_confirmed === 1 ? 'confirmed' : 'pending')
      : 'confirmed');

  return {
    id: r.id,
    roomId: r.room_id,
    userName: r.user_name,
    userPhone: r.user_phone,
    attendeeCount: typeof r.attendee_count === 'number' ? r.attendee_count : null,
    needsStatus,
    needsStatusUpdatedAt: r.needs_status_updated_at ?? r.needs_confirmed_at ?? null,
    needsConfirmed: needsStatus === 'confirmed',
    needsConfirmedAt: needsStatus === 'confirmed' ? (r.needs_confirmed_at ?? r.needs_status_updated_at ?? null) : null,
    project: r.project,
    purpose: r.purpose,
    startTime: r.start_time,
    endTime: r.end_time,
    date: r.date,
    repeatGroupId: r.repeat_group_id,
    color: r.color,
    needIds: r.need_ids ? r.need_ids.split(',').filter(Boolean) : [],
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // === ROOMS ===
      if (path === '/api/rooms' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM rooms ORDER BY name'
        ).all();
        return json(results);
      }

      if (path === '/api/rooms' && method === 'POST') {
        const body = await request.json<any>();
        const id = crypto.randomUUID().replace(/-/g, '');
        await env.DB.prepare(
          'INSERT INTO rooms (id, name, capacity, color, location, status, building, floor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, body.name, body.capacity ?? 0, body.color ?? '#3b82f6', body.location ?? '', body.status ?? 'Đang hoạt động', body.building ?? '', body.floor ?? '').run();
        return json({ id, ...body }, 201);
      }

      if (path.match(/^\/api\/rooms\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop()!;
        const body = await request.json<any>();
        await env.DB.prepare(
          'UPDATE rooms SET name = ?, capacity = ?, color = ?, location = ?, status = ?, building = ?, floor = ? WHERE id = ?'
        ).bind(body.name, body.capacity ?? 0, body.color ?? '#3b82f6', body.location ?? '', body.status ?? 'Đang hoạt động', body.building ?? '', body.floor ?? '', id).run();
        return json({ id, ...body });
      }

      if (path.match(/^\/api\/rooms\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop()!;
        await env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // === ADMIN PHONES ===
      if (path === '/api/admin-phones' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT phone FROM admin_phones').all();
        const mergedPhones = Array.from(
          new Set([
            ...results.map((r: any) => String(r.phone).trim()).filter(Boolean),
            ...getConfiguredAdminPhones(env),
          ])
        ).sort((a, b) => a.localeCompare(b, 'vi'));
        return json(mergedPhones);
      }

      if (path === '/api/admin-phones' && method === 'POST') {
        const body = await request.json<any>();
        await env.DB.prepare('INSERT OR IGNORE INTO admin_phones (phone) VALUES (?)').bind(body.phone).run();
        return json({ success: true }, 201);
      }

      if (path.match(/^\/api\/admin-phones\/[\w-]+$/) && method === 'DELETE') {
        const phone = decodeURIComponent(path.split('/').pop()!);
        await env.DB.prepare('DELETE FROM admin_phones WHERE phone = ?').bind(phone).run();
        return json({ success: true });
      }

      // === NEEDS ===
      if (path === '/api/needs' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM needs ORDER BY sort_order').all();
        return json(results);
      }

      if (path === '/api/needs' && method === 'POST') {
        const body = await request.json<any>();
        const id = crypto.randomUUID().replace(/-/g, '');
        await env.DB.prepare(
          'INSERT INTO needs (id, name, color, sort_order) VALUES (?, ?, ?, ?)'
        ).bind(id, body.name, body.color, body.sort_order ?? 0).run();
        return json({ id, ...body }, 201);
      }

      if (path.match(/^\/api\/needs\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop()!;
        const body = await request.json<any>();
        await env.DB.prepare(
          'UPDATE needs SET name = ?, color = ?, sort_order = ? WHERE id = ?'
        ).bind(body.name, body.color, body.sort_order ?? 0, id).run();
        return json({ id, ...body });
      }

      if (path.match(/^\/api\/needs\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop()!;
        await env.DB.prepare('DELETE FROM needs WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // === BOOKINGS ===
      if ((path === '/api/bookings/needs-notifications' || path === '/api/bookings/pending-needs') && method === 'GET') {
        await ensureBookingSchema(env.DB);
        const userPhone = url.searchParams.get('userPhone');
        const requestedStatuses =
          path === '/api/bookings/pending-needs'
            ? ['pending']
            : String(url.searchParams.get('statuses') || '')
                .split(',')
                .map((status) => normalizeNeedsStatus(status))
                .filter((status): status is BookingNeedsStatus => Boolean(status));
        const statuses = requestedStatuses.length > 0 ? requestedStatuses : ['pending'];
        const placeholders = statuses.map(() => '?').join(', ');
        const bindings: string[] = [...statuses];
        const query = userPhone
          ? `SELECT *
             FROM bookings
             WHERE COALESCE(need_ids, '') != ''
               AND COALESCE(needs_status, CASE WHEN COALESCE(needs_confirmed, 0) = 1 THEN 'confirmed' ELSE 'pending' END) IN (${placeholders})
               AND user_phone = ?
             ORDER BY date, start_time`
          : `SELECT *
             FROM bookings
             WHERE COALESCE(need_ids, '') != ''
               AND COALESCE(needs_status, CASE WHEN COALESCE(needs_confirmed, 0) = 1 THEN 'confirmed' ELSE 'pending' END) IN (${placeholders})
             ORDER BY date, start_time`;

        if (userPhone) {
          bindings.push(userPhone);
        }

        const result = await env.DB.prepare(query).bind(...bindings).all();
        return json(result.results.map((row: any) => mapBookingRow(row)));
      }

      if (path === '/api/bookings' && method === 'GET') {
        await ensureBookingSchema(env.DB);
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        if (!startDate || !endDate) {
          return error('startDate and endDate query params required');
        }

        const { results } = await env.DB.prepare(
          'SELECT * FROM bookings WHERE date >= ? AND date <= ? ORDER BY start_time'
        ).bind(startDate, endDate).all();

        // Map snake_case DB columns to camelCase for frontend
        const mapped = results.map((r: any) => mapBookingRow(r));
        return json(mapped);
      }

      if (path === '/api/bookings' && method === 'POST') {
        await ensureBookingSchema(env.DB);
        const body = await request.json<any>();

        // Support batch creation (array of bookings)
        const items: any[] = Array.isArray(body) ? body : [body];
        const created: any[] = [];
        const session = env.DB.withSession('first-primary');

        for (const item of items) {
          const validationError = getBookingValidationError(item, true);
          if (validationError) {
            return error(validationError);
          }
        }

        for (const item of items) {
          const attendeeCount = parseAttendeeCount(item.attendeeCount).value;
          const {
            serializedNeedIds,
            needsStatus,
            needsStatusUpdatedAt,
            needsConfirmed,
            needsConfirmedAt,
          } = getNeedsStatusPayload(item.needIds, item.needsStatus, item.needsConfirmed);
          const id = crypto.randomUUID().replace(/-/g, '');
          const result = await session.prepare(
            `INSERT INTO bookings (id, room_id, user_name, user_phone, user_email, project, purpose, start_time, end_time, date, repeat_group_id, color, need_ids, attendee_count, needs_status, needs_status_updated_at, needs_confirmed, needs_confirmed_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (
               SELECT 1
               FROM bookings
               WHERE room_id = ?
                 AND date = ?
                 AND start_time < ?
                 AND end_time > ?
             )`
          ).bind(
            id,
            item.roomId,
            item.userName,
            item.userPhone,
            item.userPhone,
            item.project ?? '',
            item.purpose ?? '',
            item.startTime,
            item.endTime,
            item.date,
            item.repeatGroupId ?? null,
            item.color ?? '',
            serializedNeedIds,
            attendeeCount,
            needsStatus,
            needsStatusUpdatedAt,
            needsConfirmed,
            needsConfirmedAt,
            item.roomId,
            item.date,
            item.endTime,
            item.startTime
          ).run();

          if (getResultChanges(result) === 0) {
            if (created.length > 0) {
              await session.batch(
                created.map((booking) =>
                  session.prepare('DELETE FROM bookings WHERE id = ?').bind(booking.id)
                )
              );
            }

            return error(BOOKING_OVERLAP_ERROR, 409);
          }
          created.push({
            id,
            ...item,
            needIds: serializedNeedIds ? serializedNeedIds.split(',').filter(Boolean) : [],
            attendeeCount,
            needsStatus,
            needsStatusUpdatedAt,
            needsConfirmed: needsConfirmed === 1,
            needsConfirmedAt,
          });
        }

        return json(Array.isArray(body) ? created : created[0], 201);
      }

      if (path.match(/^\/api\/bookings\/[\w-]+$/) && method === 'PUT') {
        await ensureBookingSchema(env.DB);
        const id = path.split('/').pop()!;
        const body = await request.json<any>();
        const validationError = getBookingValidationError(body);
        if (validationError) {
          return error(validationError);
        }

        const session = env.DB.withSession('first-primary');
        const existingBooking = await session.prepare(
          'SELECT id, need_ids, needs_status, needs_status_updated_at, needs_confirmed, needs_confirmed_at FROM bookings WHERE id = ?'
        ).bind(id).first<any>();
        if (!existingBooking) {
          return error('Booking not found', 404);
        }

        const attendeeCount = parseAttendeeCount(body.attendeeCount).value;
        const {
          serializedNeedIds,
          needsStatus,
          needsStatusUpdatedAt,
          needsConfirmed,
          needsConfirmedAt,
        } = getNeedsStatusPayload(
          body.needIds,
          body.needsStatus,
          body.needsConfirmed,
          {
            serializedNeedIds: existingBooking.need_ids,
            needsStatus: existingBooking.needs_status,
            needsStatusUpdatedAt: existingBooking.needs_status_updated_at,
            needsConfirmed: existingBooking.needs_confirmed,
            needsConfirmedAt: existingBooking.needs_confirmed_at,
          }
        );
        const result = await session.prepare(
          `UPDATE bookings
           SET room_id = ?, project = ?, purpose = ?, start_time = ?, end_time = ?, date = ?, color = ?, need_ids = ?, attendee_count = ?, needs_status = ?, needs_status_updated_at = ?, needs_confirmed = ?, needs_confirmed_at = ?, user_name = COALESCE(?, user_name), user_phone = COALESCE(?, user_phone), user_email = COALESCE(?, user_email)
           WHERE id = ?
             AND NOT EXISTS (
               SELECT 1
               FROM bookings
               WHERE id != ?
                 AND room_id = ?
                 AND date = ?
                 AND start_time < ?
                 AND end_time > ?
             )`
        ).bind(
          body.roomId,
          body.project ?? '',
          body.purpose ?? '',
          body.startTime,
          body.endTime,
          body.date,
          body.color ?? '',
          serializedNeedIds,
          attendeeCount,
          needsStatus,
          needsStatusUpdatedAt,
          needsConfirmed,
          needsConfirmedAt,
          body.userName ?? null,
          body.userPhone ?? null,
          body.userPhone ?? null,
          id,
          id,
          body.roomId,
          body.date,
          body.endTime,
          body.startTime
        ).run();

        if (getResultChanges(result) === 0) {
          const overlap = await session.prepare(
            `SELECT id
             FROM bookings
             WHERE id != ?
               AND room_id = ?
               AND date = ?
               AND start_time < ?
               AND end_time > ?`
          ).bind(
            id,
            body.roomId,
            body.date,
            body.endTime,
            body.startTime
          ).first();

          if (overlap) {
            return error(BOOKING_OVERLAP_ERROR, 409);
          }

          const unchanged = await session.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<any>();
          if (!unchanged) {
            return error('Booking not found', 404);
          }

          return json(mapBookingRow(unchanged));
        }

        return json({
          id,
          ...body,
          needIds: serializedNeedIds ? serializedNeedIds.split(',').filter(Boolean) : [],
          attendeeCount,
          needsStatus,
          needsStatusUpdatedAt,
          needsConfirmed: needsConfirmed === 1,
          needsConfirmedAt,
        });
      }

      if (path.match(/^\/api\/bookings\/[\w-]+\/needs-status$/) && method === 'PUT') {
        await ensureBookingSchema(env.DB);
        const id = path.split('/')[3]!;
        const body = await request.json<{ status?: unknown }>();
        const status = normalizeNeedsStatus(body.status);
        if (!status) {
          return error('Trạng thái nhu cầu không hợp lệ.');
        }

        const existing = await env.DB.prepare('SELECT id, need_ids FROM bookings WHERE id = ?').bind(id).first<any>();
        if (!existing) {
          return error('Booking not found', 404);
        }

        if (!existing.need_ids) {
          return error('Booking does not have requested needs', 400);
        }

        const now = new Date().toISOString();
        await env.DB.prepare(
          `UPDATE bookings
           SET needs_status = ?, needs_status_updated_at = ?, needs_confirmed = ?, needs_confirmed_at = ?
           WHERE id = ?`
        ).bind(
          status,
          now,
          status === 'confirmed' ? 1 : 0,
          status === 'confirmed' ? now : null,
          id,
        ).run();

        const updated = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<any>();
        if (!updated) {
          return error('Booking not found', 404);
        }

        return json(mapBookingRow(updated));
      }

      if (path.match(/^\/api\/bookings\/[\w-]+\/confirm-needs$/) && method === 'PUT') {
        await ensureBookingSchema(env.DB);
        const id = path.split('/')[3]!;
        const now = new Date().toISOString();
        const result = await env.DB.prepare(
          `UPDATE bookings
           SET needs_status = 'confirmed', needs_status_updated_at = ?, needs_confirmed = 1, needs_confirmed_at = ?
           WHERE id = ? AND COALESCE(need_ids, '') != ''`
        ).bind(now, now, id).run();

        if (getResultChanges(result) === 0) {
          const existing = await env.DB.prepare('SELECT id, need_ids FROM bookings WHERE id = ?').bind(id).first<any>();
          if (!existing) {
            return error('Booking not found', 404);
          }

          if (!existing.need_ids) {
            return error('Booking does not have requested needs', 400);
          }
        }

        const updated = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<any>();
        if (!updated) {
          return error('Booking not found', 404);
        }

        return json(mapBookingRow(updated));
      }

      if (path.match(/^\/api\/bookings\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop()!;
        const deleteGroup = url.searchParams.get('deleteGroup') === 'true';

        if (deleteGroup) {
          // Find the booking to get its repeatGroupId
          const { results } = await env.DB.prepare(
            'SELECT repeat_group_id FROM bookings WHERE id = ?'
          ).bind(id).all();
          const groupId = results[0]?.repeat_group_id;
          if (groupId) {
            const countResult = await env.DB.prepare(
              'SELECT COUNT(*) as count FROM bookings WHERE repeat_group_id = ?'
            ).bind(groupId).all();
            await env.DB.prepare('DELETE FROM bookings WHERE repeat_group_id = ?').bind(groupId).run();
            return json({ success: true, deletedCount: (countResult.results[0] as any)?.count || 0 });
          }
        }

        await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run();
        return json({ success: true, deletedCount: 1 });
      }

      // === ACTIVITY LOGS ===
      if (path === '/api/logs' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '200');
        const { results } = await env.DB.prepare(
          'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?'
        ).bind(limit).all();

        const mapped = results.map((r: any) => ({
          id: r.id,
          userName: r.user_name,
          userPhone: r.user_phone,
          action: r.action,
          detail: r.detail,
          createdAt: r.created_at,
        }));
        return json(mapped);
      }

      if (path === '/api/logs' && method === 'POST') {
        const body = await request.json<any>();
        const id = crypto.randomUUID().replace(/-/g, '');
        await env.DB.prepare(
          'INSERT INTO activity_logs (id, user_name, user_phone, user_email, action, detail) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, body.userName, body.userPhone, body.userPhone, body.action, body.detail ?? '').run();
        return json({ id }, 201);
      }

      return error('Not found', 404);
    } catch (e: any) {
      return error(e.message || 'Internal server error', 500);
    }
  },
};
