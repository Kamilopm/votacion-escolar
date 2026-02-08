const { getSupabaseAdmin } = require('../../lib/supabase');
const { readJson, send, sendError } = require('../../lib/http');

module.exports = async (req, res) => {
  try {
    const sb = getSupabaseAdmin();

    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('candidates')
        .select('id,name,photo_url,created_at')
        .order('name', { ascending: true });
      if (error) throw error;

      // Compatibilidad: devolver ARRAY
      const candidates = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        photoUrl: c.photo_url,
        createdAt: c.created_at
      }));

      send(res, 200, candidates);
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const name = String(body.name || '').trim();
      const photoUrl = body.photoUrl ? String(body.photoUrl) : null;
      if (!name) {
        send(res, 400, { success: false, error: 'Nombre requerido' });
        return;
      }
      const { data, error } = await sb
        .from('candidates')
        .insert({ name, photo_url: photoUrl })
        .select('id,name,photo_url')
        .single();
      if (error) throw error;
      send(res, 200, { id: data.id });
      return;
    }

    res.setHeader('Allow', 'GET,POST');
    send(res, 405, { success: false, error: 'Método no permitido' });
  } catch (err) {
    sendError(res, err);
  }
};
