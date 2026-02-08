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

    const name = String(body.name || body.Nombre || '').trim();
    const grade = Number(body.grade ?? body.Grado);
    const course = Number(body.course ?? body.Curso);
    const list_number = body.listNumber != null ? Number(body.listNumber) : (body.list_number != null ? Number(body.list_number) : null);
    const access_code = String(body.accessCode || body.access_code || '').trim();

    if (!name || !grade || Number.isNaN(course) || !access_code) {
      send(res, 400, { success: false, error: 'Datos inválidos (Nombre/Grado/Curso/Código)' });
      return;
    }

    const { data, error } = await sb
      .from('students')
      .insert({ name, grade, course, list_number, access_code, has_voted: false })
      .select('id')
      .single();
    if (error) throw error;

    send(res, 200, { success: true, id: data.id });
  } catch (err) {
    sendError(res, err);
  }
};
