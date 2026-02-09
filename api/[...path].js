import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// Supabase client (SERVICE ROLE)
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
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-code');
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/', '').split('/').filter(Boolean);
  const endpoint = path[0];
  const action = path[1];

  try {
    switch (endpoint) {
      case 'check-status':   return await checkStatus(req, res);
      case 'verify-code':    return await verifyCode(req, res);
      case 'cast-vote':      return await castVote(req, res);
      case 'get-candidates': return await getCandidates(req, res);
      case 'admin':          return await handleAdmin(req, res, action);
      case 'stats':          return await getStats(req, res);
      case 'config':         return await handleConfig(req, res);
      case 'results':        return await getResults(req, res);
      case 'monitor':        return await getMonitor(req, res);
      default:
        return res.status(404).json({ error: 'Endpoint no encontrado' });
    }
  } catch (err) {
    console.error('API ERROR:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────
// ENDPOINTS PÚBLICOS
// ─────────────────────────────────────────────
async function checkStatus(req, res) {
  const { data, error } = await supabase
    .from('config')
    .select('election_status, school_logo_url, school_name')
    .eq('id', 1)
    .single();

  if (error) return res.status(500).json({ error: 'Error estado' });

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
  if (!access_code)
    return res.status(400).json({ error: 'Código requerido' });

  const { data, error } = await supabase
    .from('students')
    .select('full_name, grade, course, has_voted')
    .eq('access_code', access_code)
    .single();

  if (error || !data)
    return res.status(404).json({ error: 'Código no válido' });

  if (data.has_voted)
    return res.status(403).json({ error: 'Este código ya fue usado' });

  return res.json({
    student: {
      name: data.full_name,
      grade: data.grade,
      course: data.course
    }
  });
}

async function getCandidates(req, res) {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, name, party, photo_url')
    .order('name');

  if (error) return res.status(500).json({ error: 'Error candidatos' });
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

  if (error || data?.success === false)
    return res.status(400).json({ error: data?.error || 'Error al votar' });

  return res.json({ success: true, student: data.student });
}

// ─────────────────────────────────────────────
// ADMIN (LOGIN + CONTROL)
// ─────────────────────────────────────────────
async function handleAdmin(req, res, action) {
  const adminCode =
    req.headers['x-admin-code'] ||
    req.body?.admin_code;

  if (!adminCode)
    return res.status(401).json({ error: 'Código requerido' });

  const { data: config, error } = await supabase
    .from('config')
    .select('admin_code, election_status')
    .eq('id', 1)
    .single();

  if (error || !config)
    return res.status(500).json({ error: 'Config no encontrada' });

  if (adminCode !== config.admin_code)
    return res.status(401).json({ error: 'Código incorrecto' });

  // LOGIN
  if (action === 'login')
    return res.json({ success: true });

  // ABRIR / CERRAR VOTACIÓN
  if (action === 'election' && req.method === 'POST') {
    const { action: voteAction } = req.body;
    const newStatus = voteAction === 'open' ? 'open' : 'closed';

    await supabase
      .from('config')
      .update({ election_status: newStatus })
      .eq('id', 1);

    return res.json({ success: true, status: newStatus });
  }

  return res.status(404).json({ error: 'Acción admin inválida' });
}

// ─────────────────────────────────────────────
// STATS / RESULTS / MONITOR (BÁSICO)
// ─────────────────────────────────────────────
async function getStats(req, res) {
  const total = await supabase.from('students').select('id', { count: 'exact' });
  const voted = await supabase.from('students').select('id', { count: 'exact' }).eq('has_voted', true);

  return res.json({
    general: {
      totalStudents: total.count || 0,
      totalVoted: voted.count || 0,
      participation: total.count ? Math.round((voted.count / total.count) * 100) : 0
    },
    byGrade: []
  });
}

async function handleConfig(req, res) {
  const { data } = await supabase.from('config').select('*').eq('id', 1).single();
  return res.json(data);
}

async function getResults(req, res) {
  const { data } = await supabase.from('candidates').select('*').order('votes', { ascending: false });
  return res.json({ results: data || [] });
}

async function getMonitor(req, res) {
  return res.json({ lastUpdate: new Date().toLocaleString(), summary: {} });
}
