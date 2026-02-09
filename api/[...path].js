import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

// ─────────────────────────────────────────────
// Router principal
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.url === '/api/health' || req.url === '/api/health/') {
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-code');
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/', '');
  const [endpoint, subEndpoint] = path.split('/');

  try {
    switch (endpoint) {
      case 'check-status':   return checkStatus(req, res);
      case 'verify-code':    return verifyCode(req, res);
      case 'cast-vote':      return castVote(req, res);
      case 'get-candidates': return getCandidates(req, res);
      case 'admin':          return handleAdmin(req, res, subEndpoint);
      case 'stats':          return getStats(req, res);
      case 'results':        return getFinalResults(req, res);
      case 'monitor':        return getMonitorData(req, res);
      case 'config':         return handleConfig(req, res);
      default:
        return res.status(404).json({ error: 'Endpoint no encontrado' });
    }
  } catch (err) {
    console.error('API ERROR:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────
// Endpoints públicos
// ─────────────────────────────────────────────
async function checkStatus(req, res) {
  const { data, error } = await supabase
    .from('config')
    .select('election_status, school_logo_url, school_name')
    .eq('id', 1)
    .single();

  if (error) return res.status(500).json({ error: 'Error al consultar estado' });

  return res.json({
    open: data.election_status === 'open',
    status: data.election_status,
    school_logo: data.school_logo_url,
    school_name: data.school_name
  });
}

async function verifyCode(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Método no permitido' });

  const { access_code } = req.body || {};

  if (!access_code || !/^\d{3,5}$/.test(access_code))
    return res.status(400).json({ error: 'Código inválido' });

  const { data: student, error } = await supabase
    .from('students')
    .select('id, full_name, grade, course, has_voted')
    .eq('access_code', access_code)
    .single();

  if (error || !student)
    return res.status(404).json({ error: 'Código no encontrado' });

  if (student.has_voted)
    return res.status(403).json({ error: 'Este código ya ha sido utilizado' });

  return res.json({
    valid: true,
    student: {
      name: student.full_name,
      grade: student.grade,
      course: student.course
    }
  });
}

async function getCandidates(req, res) {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, name, party, photo_url')
    .order('name');

  if (error)
    return res.status(500).json({ error: 'Error al cargar candidatos' });

  return res.json({ candidates: data });
}

async function castVote(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Método no permitido' });

  const { access_code, candidate_id } = req.body || {};

  if (!access_code || !candidate_id)
    return res.status(400).json({ error: 'Datos incompletos' });

  const { data, error } = await supabase.rpc('cast_vote', {
    p_access_code: access_code,
    p_candidate_id: candidate_id
  });

  if (error)
    return res.status(500).json({ error: 'Error al procesar voto' });

  if (!data.success)
    return res.status(400).json({ error: data.error });

  return res.json({ success: true, student: data.student });
}

// ─────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────
async function handleAdmin(req, res, sub) {
  const adminCode =
    req.headers['x-admin-code'] ||
    req.body?.admin_code;

  if (!adminCode)
    return res.status(401).json({ error: 'Clave admin requerida' });

  const { data: config } = await supabase
    .from('config')
    .select('admin_code')
    .eq('id', 1)
    .single();

  if (!config || adminCode !== config.admin_code)
    return res.status(401).json({ error: 'Clave de administrador incorrecta' });

  switch (sub) {
    case 'login':       return res.json({ success: true });
    case 'students':    return handleStudents(req, res);
    case 'candidates':  return handleCandidates(req, res);
    case 'election':    return handleElection(req, res);
    case 'import':      return importStudents(req, res);
    case 'reset-codes': return resetCodes(req, res);
    case 'clear-data':  return clearData(req, res);
    default:
      return res.status(404).json({ error: 'Sub-endpoint admin no encontrado' });
  }
}

// ─────────────────────────────────────────────
// ADMIN helpers
// ─────────────────────────────────────────────
async function handleStudents(req, res) {
  const { data } = await supabase
    .from('students')
    .select('*')
    .order('grade')
    .order('course')
    .order('list_number');

  return res.json({ students: data });
}

async function handleCandidates(req, res) {
  if (req.method === 'GET') {
    const { data } = await supabase
      .from('candidates')
      .select('*')
      .order('name');
    return res.json({ candidates: data });
  }

  if (req.method === 'POST') {
    const { name, party, photo_url } = req.body;
    const { data } = await supabase
      .from('candidates')
      .insert([{ name, party, photo_url }])
      .select()
      .single();
    return res.json({ candidate: data });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

async function handleElection(req, res) {
  const { action } = req.body;
  await supabase
    .from('config')
    .update({ election_status: action === 'open' ? 'open' : 'closed' })
    .eq('id', 1);
  return res.json({ success: true });
}

// ─────────────────────────────────────────────
// Stats / results / monitor
// ─────────────────────────────────────────────
async function getStats(req, res) {
  const { data } = await supabase.from('participation_by_grade').select('*');
  return res.json({ byGrade: data });
}

async function getFinalResults(req, res) {
  const { data } = await supabase.from('election_results').select('*');
  return res.json({ results: data });
}

async function getMonitorData(req, res) {
  const { data } = await supabase.from('students').select('grade, course, has_voted');
  return res.json({ students: data });
}

// ─────────────────────────────────────────────
// Stubs (no rompen el sistema)
// ─────────────────────────────────────────────
async function importStudents(req, res) {
  return res.json({ success: true });
}
async function resetCodes(req, res) {
  return res.json({ success: true });
}
async function clearData(req, res) {
  return res.json({ success: true });
}
async function handleConfig(req, res) {
  return res.json({ ok: true });
}
