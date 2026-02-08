const { getSupabaseAdmin } = require('../lib/supabase');
const { send, sendError } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      send(res, 405, { success: false, error: 'Método no permitido' });
      return;
    }

    const sb = getSupabaseAdmin();

    const [
      { count: totalStudents, error: e1 },
      { count: totalVotes, error: e2 },
      { data: candidates, error: e3 }
    ] = await Promise.all([
      sb.from('students').select('*', { count: 'exact', head: true }),
      sb.from('votes').select('*', { count: 'exact', head: true }),
      sb.from('candidates').select('id,name').order('name', { ascending: true })
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    const { data: studentsRows, error: e4 } = await sb
      .from('students')
      .select('grade,has_voted');
    if (e4) throw e4;

    const participationByGrade = {};
    for (const r of studentsRows || []) {
      const g = String(r.grade);
      if (!participationByGrade[g]) participationByGrade[g] = { total: 0, voted: 0 };
      participationByGrade[g].total += 1;
      if (r.has_voted) participationByGrade[g].voted += 1;
    }
    for (const g of Object.keys(participationByGrade)) {
      const t = participationByGrade[g].total;
      const v = participationByGrade[g].voted;
      participationByGrade[g].participation = t > 0 ? ((v / t) * 100).toFixed(2) : '0.00';
    }

    const { data: votesRows, error: e5 } = await sb
      .from('votes')
      .select('candidate_id');
    if (e5) throw e5;

    const voteCounts = {};
    for (const v of votesRows || []) {
      voteCounts[v.candidate_id] = (voteCounts[v.candidate_id] || 0) + 1;
    }

    const candidatesOut = (candidates || []).map(c => ({
      id: c.id,
      name: c.name,
      voteCount: voteCounts[c.id] || 0
    })).sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));

    const participation = (totalStudents || 0) > 0 ? (((totalVotes || 0) / (totalStudents || 1)) * 100).toFixed(2) : '0.00';

    send(res, 200, {
      totalStudents: totalStudents || 0,
      totalVotes: totalVotes || 0,
      totalCandidates: candidatesOut.length,
      participation,
      participationByGrade,
      candidates: candidatesOut
    });
  } catch (err) {
    sendError(res, err);
  }
};
