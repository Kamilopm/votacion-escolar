import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-code');
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/', '').split('/').filter(Boolean);
  const main = path[0];
  const sub = path[1];

  try {
    switch (main) {
      case 'health': return res.json({ ok: true });
      case 'check-status': return checkStatus(req, res);
      case 'verify-code': return verifyCode(req, res);
      case 'cast-vote': return castVote(req, res);
      case 'get-candidates': return getCandidates(req, res);
      case 'config': return handleConfig(req, res);
      case 'stats': return getStats(req, res);
      case 'results': return getResults(req, res);
      case 'monitor': return getMonitor(req, res);
      case 'admin': return handleAdmin(req, res, sub);
      default: return res.status(404).json({ error: 'Endpoint no encontrado' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

/* ===================== PUBLIC ===================== */

async function checkStatus(req, res) {
  const { data } = await supabase.from('config')
    .select('election_status, school_name, school_logo_url')
    .eq('id', 1).single();
  return res.json({
    open: data.election_status === 'open',
    status: data.election_status,
    school_name: data.school_name,
    school_logo: data.school_logo_url
  });
}

async function verifyCode(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { access_code } = req.body;
  const { data } = await supabase.from('students')
    .select('id,full_name,grade,course,has_voted')
    .eq('access_code', access_code).single();
  if (!data) return res.status(404).json({ error: 'Código inválido' });
  if (data.has_voted) return res.status(403).json({ error: 'Ya votó' });
  return res.json({ valid: true, student: data });
}

async function castVote(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { access_code, candidate_id } = req.body;
  const { data, error } = await supabase.rpc('cast_vote', {
    p_access_code: access_code,
    p_candidate_id: candidate_id
  });
  if (error || !data.success)
    return res.status(400).json({ error: data?.error || 'Error' });
  return res.json({ success: true, student: data.student });
}

async function getCandidates(req, res) {
  const { data } = await supabase.from('candidates')
    .select('id,name,party,photo_url')
    .order('name');
  return res.json({ candidates: data });
}

/* ===================== ADMIN ===================== */

async function adminAuth(req) {
  const code = req.headers['x-admin-code'] || req.body?.admin_code;
  const { data } = await supabase.from('config')
    .select('admin_code').eq('id', 1).single();
  return code && data && code === data.admin_code;
}

async function handleAdmin(req, res, sub) {
  if (!(await adminAuth(req)))
    return res.status(401).json({ error: 'No autorizado' });

  switch (sub) {
    case 'login': return res.json({ success: true });
    case 'students': return adminStudents(req, res);
    case 'candidates': return adminCandidates(req, res);
    case 'import': return adminImport(req, res);
    case 'clear-data': return clearData(req, res);
    case 'reset-codes': return resetCodes(req, res);
    case 'election': return toggleElection(req, res);
    default: return res.status(404).json({ error: 'Admin endpoint inválido' });
  }
}

async function adminStudents(req, res) {
  const { data } = await supabase.from('students')
    .select('*').order('grade').order('course').order('list_number');
  return res.json({ students: data });
}

async function adminCandidates(req, res) {
  const { data } = await supabase.from('candidates')
    .select('*').order('name');
  return res.json({ candidates: data });
}

async function toggleElection(req, res) {
  const { action } = req.body;
  await supabase.from('config')
    .update({ election_status: action === 'open' ? 'open' : 'closed' })
    .eq('id', 1);
  return res.json({ success: true });
}

async function clearData(req, res) {
  const { confirm } = req.body;
  if (confirm !== 'ELIMINAR TODO')
    return res.status(400).json({ error: 'Confirmación inválida' });

  await supabase.from('votes').delete().neq('id', '0');
  await supabase.from('students').delete().neq('id', '0');
  await supabase.from('candidates').delete().neq('id', '0');
  await supabase.from('config')
    .update({ election_status: 'closed' }).eq('id', 1);

  return res.json({ success: true });
}

async function resetCodes(req, res) {
  const { data: students } = await supabase.from('students')
    .select('id,grade,course,list_number');
  for (const s of students) {
    const code = `${s.grade}${s.course}${String(s.list_number).padStart(2,'0')}`;
    await supabase.from('students')
      .update({ access_code: code }).eq('id', s.id);
  }
  return res.json({ success: true });
}

async function adminImport(req, res) {
  const { students } = req.body;
  if (!Array.isArray(students)) return res.status(400).end();

  const grouped = {};
  students.forEach(s => {
    const k = `${s.grade}-${s.course}`;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(s.full_name);
  });

  const insert = [];
  Object.entries(grouped).forEach(([k, list]) => {
    const [g,c] = k.split('-');
    list.forEach((name,i)=>{
      insert.push({
        full_name: name,
        grade: +g,
        course: +c,
        list_number: i+1,
        access_code: `${g}${c}${String(i+1).padStart(2,'0')}`
      });
    });
  });

  await supabase.from('students').insert(insert);
  return res.json({ success:true, imported: insert.length });
}

/* ===================== STATS ===================== */

async function getStats(req, res) {
  if (!(await adminAuth(req))) return res.status(401).end();
  const { data: byGrade } = await supabase.from('participation_by_grade').select('*');
  const { data: results } = await supabase.from('election_results').select('*');
  return res.json({ byGrade, results });
}

async function getResults(req, res) {
  if (!(await adminAuth(req))) return res.status(401).end();
  const { data } = await supabase.from('election_results').select('*');
  return res.json({ results: data });
}

async function getMonitor(req, res) {
  if (!(await adminAuth(req))) return res.status(401).end();
  const { data } = await supabase.from('students')
    .select('grade,course,has_voted');
  return res.json({ students: data });
}

async function handleConfig(req, res) {
  if (req.method === 'GET') {
    const { data } = await supabase.from('config')
      .select('school_name,school_logo_url').eq('id',1).single();
    return res.json(data);
  }
}
