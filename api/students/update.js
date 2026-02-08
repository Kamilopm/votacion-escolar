const { getSupabaseAdmin } = require('../../lib/supabase');
const { readJson, send, sendError } = require('../../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { success: false, error: 'Método no permitido' });
      return;
    }

    const sb = getSupabaseAdmin();
    const body = await readJson(req);
    const id = String(body.id || '').trim();
    const updates = body.updates || {};

    if (!id) {
      send(res, 400, { success: false, error: 'id requerido' });
      return;
    }

    const payload = {};
    if (updates.name) payload.name = String(updates.name).trim();
    if (updates.grade != null) payload.grade = Number(updates.grade);
    if (updates.course != null) payload.course = Number(updates.course);
    if (updates.listNumber != null) payload.list_number = Number(updates.listNumber);
    if (updates.accessCode) payload.access_code = String(updates.accessCode).trim();
    if (updates.hasVoted != null) payload.has_voted = !!updates.hasVoted;
    if (updates.votedAt !== undefined) payload.voted_at = updates.votedAt ? String(updates.votedAt) : null;

    const { error } = await sb.from('students').update(payload).eq('id', id);
    if (error) throw error;

    send(res, 200, { success: true });
  } catch (err) {
    sendError(res, err);
  }
};
