const { getSupabaseAdmin } = require('../lib/supabase');
const { readJson, send, sendError } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { success: false, error: 'Método no permitido' });
      return;
    }

    const { studentCode, candidateId } = await readJson(req);
    const accessCode = String(studentCode || '').trim();
    const cand = String(candidateId || '').trim();
    if (!accessCode || !cand) {
      send(res, 400, { success: false, error: 'studentCode y candidateId son requeridos' });
      return;
    }

    const sb = getSupabaseAdmin();

    const { data, error } = await sb.rpc('cast_vote', {
      p_access_code: accessCode,
      p_candidate_id: cand
    });
    if (error) throw error;

    send(res, 200, { success: true, result: data });
  } catch (err) {
    sendError(res, err);
  }
};
