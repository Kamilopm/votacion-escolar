const { getSupabaseAdmin } = require('../../lib/supabase');
const { send, sendError } = require('../../lib/http');

module.exports = async (req, res) => {
  try {
    const sb = getSupabaseAdmin();

    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('students')
        .select('id,name,grade,course,list_number,access_code,has_voted,created_at')
        .order('grade', { ascending: true })
        .order('course', { ascending: true })
        .order('list_number', { ascending: true });
      if (error) throw error;

      // Compatibilidad con el frontend existente: devolver ARRAY
      const students = (data || []).map(r => ({
        id: r.id,
        name: r.name,
        grade: r.grade,
        course: r.course,
        listNumber: r.list_number,
        accessCode: r.access_code,
        hasVoted: r.has_voted,
        createdAt: r.created_at
      }));

      send(res, 200, students);
      return;
    }

    res.setHeader('Allow', 'GET');
    send(res, 405, { success: false, error: 'Método no permitido' });
  } catch (err) {
    sendError(res, err);
  }
};
