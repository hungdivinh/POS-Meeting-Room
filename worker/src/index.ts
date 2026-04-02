export interface Env {
  DB: D1Database;
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

const BOOKING_OVERLAP_ERROR = 'Khung giờ này đã có người đặt. Vui lòng chọn khung giờ khác.';

interface BookingWriteInput {
  roomId?: unknown;
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  userName?: unknown;
  userPhone?: unknown;
  attendeeCount?: unknown;
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

function serializeNeedIds(needIds: unknown): string {
  if (Array.isArray(needIds)) {
    return needIds
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .join(',');
  }

  return typeof needIds === 'string' ? needIds : '';
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
        return json(results.map((r: any) => r.phone));
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
      if (path === '/api/bookings' && method === 'GET') {
        await ensureBookingAttendeeCountColumn(env.DB);
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        if (!startDate || !endDate) {
          return error('startDate and endDate query params required');
        }

        const { results } = await env.DB.prepare(
          'SELECT * FROM bookings WHERE date >= ? AND date <= ? ORDER BY start_time'
        ).bind(startDate, endDate).all();

        // Map snake_case DB columns to camelCase for frontend
        const mapped = results.map((r: any) => ({
          id: r.id,
          roomId: r.room_id,
          userName: r.user_name,
          userPhone: r.user_phone,
          attendeeCount: typeof r.attendee_count === 'number' ? r.attendee_count : null,
          project: r.project,
          purpose: r.purpose,
          startTime: r.start_time,
          endTime: r.end_time,
          date: r.date,
          repeatGroupId: r.repeat_group_id,
          color: r.color,
          needIds: r.need_ids ? r.need_ids.split(',').filter(Boolean) : [],
        }));
        return json(mapped);
      }

      if (path === '/api/bookings' && method === 'POST') {
        await ensureBookingAttendeeCountColumn(env.DB);
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
          const id = crypto.randomUUID().replace(/-/g, '');
          const result = await session.prepare(
            `INSERT INTO bookings (id, room_id, user_name, user_phone, user_email, project, purpose, start_time, end_time, date, repeat_group_id, color, need_ids, attendee_count)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
            serializeNeedIds(item.needIds),
            attendeeCount,
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

          created.push({ id, ...item });
        }

        return json(Array.isArray(body) ? created : created[0], 201);
      }

      if (path.match(/^\/api\/bookings\/[\w-]+$/) && method === 'PUT') {
        await ensureBookingAttendeeCountColumn(env.DB);
        const id = path.split('/').pop()!;
        const body = await request.json<any>();
        const validationError = getBookingValidationError(body);
        if (validationError) {
          return error(validationError);
        }

        const attendeeCount = parseAttendeeCount(body.attendeeCount).value;
        const session = env.DB.withSession('first-primary');
        const result = await session.prepare(
          `UPDATE bookings
           SET room_id = ?, project = ?, purpose = ?, start_time = ?, end_time = ?, date = ?, color = ?, need_ids = ?, attendee_count = ?, user_name = COALESCE(?, user_name), user_phone = COALESCE(?, user_phone), user_email = COALESCE(?, user_email)
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
          serializeNeedIds(body.needIds),
          attendeeCount,
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
          const existing = await session.prepare('SELECT id FROM bookings WHERE id = ?').bind(id).first();
          if (!existing) {
            return error('Booking not found', 404);
          }

          return error(BOOKING_OVERLAP_ERROR, 409);
        }

        return json({ id, ...body });
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
