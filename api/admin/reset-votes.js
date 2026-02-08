const { getSupabaseAdmin } = require('../../lib/supabase');
const { send, sendError } = require('../../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { success: false, error: 'Método no permitido' });
      return;
    }

    const sb = getSupabaseAdmin();

    // Borrar votos
    const { error: e1 } = await sb.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e1) throw e1;

    // Reset has_voted
    const { error: e2 } = await sb.from('students').update({ has_voted: false, voted_at: null }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (e2) throw e2;

    send(res, 200, { success: true });
  } catch (err) {
    sendError(res, err);
  }
};
