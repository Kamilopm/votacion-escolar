const { getSupabaseAdmin } = require('../../lib/supabase');
const { readJson, send, sendError } = require('../../lib/http');

function normalizeInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).trim());
  if (Number.isNaN(n)) return null;
  return Math.trunc(n);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { success: false, error: 'Método no permitido' });
      return;
    }

    const body = await readJson(req);
    const students = Array.isArray(body.students) ? body.students : [];
    if (!students.length) {
      send(res, 400, { success: false, error: 'No se recibieron estudiantes' });
      return;
    }

    const sb = getSupabaseAdmin();

    // Prepara registros y valida mínimos
    const cleaned = [];
    const errors = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i] || {};
      const name = String(s.name || s.Nombre || '').trim();
      const grade = normalizeInt(s.grade ?? s.Grado);
      const course = normalizeInt(s.course ?? s.Curso);
      const listNumber = normalizeInt(s.listNumber ?? s.Lista ?? s.list_number);
      const accessCode = String(s.accessCode || s.access_code || '').trim();

      if (!name || !grade || course === null || course === undefined || !accessCode) {
        errors.push({ row: i + 1, reason: 'Faltan datos (Nombre/Grado/Curso/Código)', value: s });
        continue;
      }

      cleaned.push({
        name,
        grade,
        course,
        list_number: listNumber,
        access_code: accessCode,
        has_voted: false
      });
    }

    if (!cleaned.length) {
      send(res, 400, { success: false, error: 'Todas las filas están inválidas', details: errors.slice(0, 10) });
      return;
    }

    // UPSERT por access_code
    const { data, error } = await sb
      .from('students')
      .upsert(cleaned, { onConflict: 'access_code' })
      .select('id');
    if (error) throw error;

    send(res, 200, {
      success: true,
      imported: cleaned.length,
      skipped: errors.length,
      details: errors.slice(0, 10)
    });
  } catch (err) {
    sendError(res, err);
  }
};
