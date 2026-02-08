const { getSupabaseAdmin } = require('../../lib/supabase');
const { readJson, send, sendError } = require('../../lib/http');

module.exports = async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    const id = String(req.query?.id || '').trim();
    if (!id) {
      send(res, 400, { success: false, error: 'id requerido' });
      return;
    }

    if (req.method === 'PUT') {
      const updates = await readJson(req);
      const payload = {};
      if (updates.name) payload.name = String(updates.name).trim();
      if (updates.photoUrl !== undefined) payload.photo_url = updates.photoUrl ? String(updates.photoUrl) : null;

      const { error } = await sb.from('candidates').update(payload).eq('id', id);
      if (error) throw error;
      send(res, 200, { success: true });
      return;
    }

    if (req.method === 'DELETE') {
      const { error } = await sb.from('candidates').delete().eq('id', id);
      if (error) throw error;
      send(res, 200, { success: true });
      return;
    }

    res.setHeader('Allow', 'PUT,DELETE');
    send(res, 405, { success: false, error: 'Método no permitido' });
  } catch (err) {
    sendError(res, err);
  }
};
