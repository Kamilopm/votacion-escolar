const { getSupabaseAdmin } = require('../../lib/supabase');
const { readJson, send, sendError } = require('../../lib/http');

function buildCode(grade, course, listNumber) {
  const prefix = `${grade}${course}`;
  const suffix = String(listNumber).padStart(2, '0');
  return `${prefix}${suffix}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { success: false, error: 'Método no permitido' });
      return;
    }

    const body = await readJson(req);
    const grade = Number(body.grade);
    const course = Number(body.course);
    const count = Number(body.count);
    if (!grade || Number.isNaN(course) || !count || count < 1 || count > 200) {
      send(res, 400, { success: false, error: 'Datos inválidos (grade/course/count)' });
      return;
    }

    const sb = getSupabaseAdmin();

    // Obtener max list_number para el grado/curso
    const { data: existing, error: err1 } = await sb
      .from('students')
      .select('list_number,access_code')
      .eq('grade', grade)
      .eq('course', course);
    if (err1) throw err1;

    let maxList = 0;
    const prefix = `${grade}${course}`;
    for (const s of existing || []) {
      if (s.list_number && s.list_number > maxList) maxList = s.list_number;
      const code = String(s.access_code || '');
      if (code.startsWith(prefix)) {
        const rest = Number(code.slice(prefix.length));
        if (!Number.isNaN(rest) && rest > maxList) maxList = rest;
      }
    }

    const rows = [];
    for (let i = 1; i <= count; i++) {
      const listNumber = maxList + i;
      const access_code = buildCode(grade, course, listNumber);
      rows.push({
        name: `Estudiante ${access_code}`,
        grade,
        course,
        list_number: listNumber,
        access_code,
        has_voted: false
      });
    }

    const { error: err2 } = await sb
      .from('students')
      .upsert(rows, { onConflict: 'access_code' });
    if (err2) throw err2;

    send(res, 200, { success: true, students: rows.map(r => ({
      name: r.name,
      grade: r.grade,
      course: r.course,
      listNumber: r.list_number,
      accessCode: r.access_code,
      hasVoted: r.has_voted
    })) });
  } catch (err) {
    sendError(res, err);
  }
};
