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
          'INSERT INTO rooms (id, name, capacity, color, location, status) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, body.name, body.capacity ?? 0, body.color ?? '#3b82f6', body.location ?? '', body.status ?? 'Đang hoạt động').run();
        return json({ id, ...body }, 201);
      }

      if (path.match(/^\/api\/rooms\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop()!;
        const body = await request.json<any>();
        await env.DB.prepare(
          'UPDATE rooms SET name = ?, capacity = ?, color = ?, location = ?, status = ? WHERE id = ?'
        ).bind(body.name, body.capacity ?? 0, body.color ?? '#3b82f6', body.location ?? '', body.status ?? 'Đang hoạt động', id).run();
        return json({ id, ...body });
      }

      if (path.match(/^\/api\/rooms\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop()!;
        await env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // === BOOKINGS ===
      if (path === '/api/bookings' && method === 'GET') {
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
          project: r.project,
          purpose: r.purpose,
          startTime: r.start_time,
          endTime: r.end_time,
          date: r.date,
          repeatGroupId: r.repeat_group_id,
          color: r.color,
        }));
        return json(mapped);
      }

      if (path === '/api/bookings' && method === 'POST') {
        const body = await request.json<any>();

        // Support batch creation (array of bookings)
        const items: any[] = Array.isArray(body) ? body : [body];
        const created: any[] = [];

        for (const item of items) {
          const id = crypto.randomUUID().replace(/-/g, '');
          await env.DB.prepare(
            'INSERT INTO bookings (id, room_id, user_name, user_phone, project, purpose, start_time, end_time, date, repeat_group_id, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            id,
            item.roomId,
            item.userName,
            item.userPhone,
            item.project ?? '',
            item.purpose ?? '',
            item.startTime,
            item.endTime,
            item.date,
            item.repeatGroupId ?? null,
            item.color ?? ''
          ).run();
          created.push({ id, ...item });
        }

        return json(Array.isArray(body) ? created : created[0], 201);
      }

      if (path.match(/^\/api\/bookings\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop()!;
        const body = await request.json<any>();
        await env.DB.prepare(
          'UPDATE bookings SET room_id = ?, project = ?, purpose = ?, start_time = ?, end_time = ?, date = ?, color = ? WHERE id = ?'
        ).bind(
          body.roomId,
          body.project ?? '',
          body.purpose ?? '',
          body.startTime,
          body.endTime,
          body.date,
          body.color ?? '',
          id
        ).run();
        return json({ id, ...body });
      }

      if (path.match(/^\/api\/bookings\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop()!;
        await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run();
        return json({ success: true });
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
          'INSERT INTO activity_logs (id, user_name, user_phone, action, detail) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, body.userName, body.userPhone, body.action, body.detail ?? '').run();
        return json({ id }, 201);
      }

      return error('Not found', 404);
    } catch (e: any) {
      return error(e.message || 'Internal server error', 500);
    }
  },
};
