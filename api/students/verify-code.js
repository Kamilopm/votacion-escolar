const { getSupabaseAdmin } = require('../../lib/supabase');
const { readJson, send, sendError } = require('../../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { success: false, error: 'Método no permitido' });
      return;
    }

    const { code } = await readJson(req);
    const accessCode = String(code || '').trim();
    if (!accessCode) {
      send(res, 400, { success: false, error: 'Código requerido' });
      return;
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('students')
      .select('id,name,grade,course,list_number,access_code,has_voted')
      .eq('access_code', accessCode)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      // Compatibilidad con el frontend
      send(res, 200, { found: false });
      return;
    }

    send(res, 200, {
      found: true,
      id: data.id,
      student: {
        id: data.id,
        name: data.name,
        grade: data.grade,
        course: data.course,
        listNumber: data.list_number,
        accessCode: data.access_code,
        hasVoted: data.has_voted
      }
    });
  } catch (err) {
    sendError(res, err);
  }
};
