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

    const [{ data: students, error: e1 }, { data: candidates, error: e2 }, { data: votes, error: e3 }] = await Promise.all([
      sb.from('students').select('name,grade,course,list_number,access_code,has_voted,voted_at').order('grade',{ascending:true}).order('course',{ascending:true}).order('list_number',{ascending:true}),
      sb.from('candidates').select('id,name').order('name',{ascending:true}),
      sb.from('votes').select('candidate_id,created_at')
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    // Resumen votos por candidato
    const counts = {};
    for (const v of votes || []) counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1;
    const results = (candidates || []).map(c => ({ id: c.id, name: c.name, voteCount: counts[c.id] || 0 }));

    send(res, 200, {
      success: true,
      exportedAt: new Date().toISOString(),
      students: (students || []).map(s => ({
        name: s.name,
        grade: s.grade,
        course: s.course,
        listNumber: s.list_number,
        accessCode: s.access_code,
        hasVoted: s.has_voted,
        votedAt: s.voted_at
      })),
      results
    });
  } catch (err) {
    sendError(res, err);
  }
};
