const { getSupabaseAdmin } = require('../../lib/supabase');
const { readJson, send, sendError } = require('../../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { success: false, error: 'Método no permitido' });
      return;
    }
    const body = await readJson(req);
    const code = String(body.code || '').trim();
    if (!code) {
      send(res, 400, { success: false, error: 'Código requerido' });
      return;
    }

    const sb = getSupabaseAdmin();
    const { error } = await sb.from('students').delete().eq('access_code', code);
    if (error) throw error;

    send(res, 200, { success: true });
  } catch (err) {
    sendError(res, err);
  }
};
