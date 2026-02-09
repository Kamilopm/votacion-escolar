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
  // Health check
  if (req.url === '/api/health' || req.url === '/api/health/') {
    return res.status(200).json({ ok: true });
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-code');
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/', '').split('/').filter(Boolean);
  const endpoint = pathParts[0];
  const subEndpoint = pathParts[1];

  try {
    switch (endpoint) {
      case 'check-status':   return await checkStatus(req, res);
      case 'verify-code':    return await verifyCode(req, res);
      case 'cast-vote':      return await castVote(req, res);
      case 'get-candidates': return await getCandidates(req, res);
      case 'admin':          return await handleAdmin(req, res, subEndpoint);
      case 'stats':          return await getStats(req, res);
      case 'config':         return await handleConfig(req, res);
      case 'results':        return await getFinalResults(req, res);
      case 'monitor':        return await getMonitorData(req, res);
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

  return res.status(200).json({
    open: data.election_status === 'open',
    status: data.election_status,
    school_logo: data.school_logo_url,
    school_name: data.school_name
  });
}

async function verifyCode(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Método no permitido' });

  const { access_code, accessCode } = req.body || {};
  const finalCode = access_code || accessCode;

  if (!finalCode || !/^\d{3,5}$/.test(finalCode))
    return res.status(400).json({ error: 'Código inválido' });

  const { data: student, error } = await supabase
    .from('students')
    .select('id, full_name, grade, course, has_voted')
    .eq('access_code', finalCode)
    .single();

  if (error || !student)
    return res.status(404).json({ error: 'Código no encontrado' });

  if (student.has_voted)
    return res.status(403).json({ error: 'Este código ya ha sido utilizado' });

  return res.status(200).json({
    valid: true,
    student: {
      name: student.full_name,
      grade: student.grade,
      course: student.course
    }
  });
}

// ─────────────────────────────────────────────
// CAST VOTE (CORREGIDO DEFINITIVO)
// ─────────────────────────────────────────────
async function castVote(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Método no permitido' });

  const {
    access_code,
    candidate_id,
    accessCode,
    candidateId
  } = req.body || {};

  const finalAccessCode = access_code || accessCode;
  const finalCandidateId = candidate_id || candidateId;

  if (!finalAccessCode || !finalCandidateId)
    return res.status(400).json({ error: 'Datos incompletos' });

  const { data, error } = await supabase.rpc('cast_vote', {
    p_access_code: finalAccessCode,
    p_candidate_id: finalCandidateId
  });

  if (error) {
    console.error('RPC ERROR:', error);
    return res.status(500).json({ error: 'Error al procesar voto' });
  }

  if (!data || data.success === false) {
    return res.status(400).json({ error: data?.error || 'Error desconocido' });
  }

  return res.status(200).json({
    success: true,
    message: 'Voto registrado correctamente',
    student: data.student
  });
}

async function getCandidates(req, res) {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, name, party, photo_url')
    .order('name');

  if (error) return res.status(500).json({ error: 'Error al cargar candidatos' });

  return res.status(200).json({ candidates: data });
}

// ─────────────────────────────────────────────
// Admin / stats / results (SIN CAMBIOS LÓGICOS)
// ─────────────────────────────────────────────
// ⬇️ Todo lo demás puede quedarse exactamente
// como lo tienes ahora en tu archivo original.
// No afecta al problema del voto.
// ─────────────────────────────────────────────
