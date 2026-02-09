import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// SUPABASE (SERVICE ROLE)
// ─────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

// ─────────────────────────────────────────────
// ROUTER ÚNICO (como indica el documento)
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-code');
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/', '').replace(/\/$/, '');

  try {
    // ───────── HEALTH
    if (path === 'health') {
      return res.json({ ok: true });
    }

    // ───────── CHECK STATUS
    if (path === 'check-status') {
      const { data, error } = await supabase
        .from('config')
        .select('election_status, school_name, school_logo_url')
        .eq('id', 1)
        .single();

      if (error) return res.status(500).json({ error: 'Config error' });

      return res.json({
        open: data.election_status === 'open',
        status: data.election_status,
        school_name: data.school_name,
        school_logo: data.school_logo_url
      });
    }

    // ───────── VERIFY CODE
    if (path === 'verify-code' && req.method === 'POST') {
      const { access_code } = req.body || {};
      if (!access_code) {
        return res.status(400).json({ error: 'Código requerido' });
      }

      const { data, error } = await supabase
        .from('students')
        .select('full_name, grade, course, has_voted')
        .eq('access_code', access_code)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Código no válido' });
      }

      if (data.has_voted) {
        return res.status(403).json({ error: 'Este código ya fue usado' });
      }

      return res.json({
        student: {
          name: data.full_name,
          grade: data.grade,
          course: data.course
        }
      });
    }

    // ───────── GET CANDIDATES
    if (path === 'get-candidates') {
      const { data, error } = await supabase
        .from('candidates')
        .select('id, name, party, photo_url')
        .order('name');

      if (error) {
        return res.status(500).json({ error: 'Error candidatos' });
      }

      return res.json({ candidates: data });
    }

    // ───────── CAST VOTE (RPC)
    if (path === 'cast-vote' && req.method === 'POST') {
      const { access_code, candidate_id } = req.body || {};

      if (!access_code || !candidate_id) {
        return res.status(400).json({ error: 'Datos incompletos' });
      }

      const { data, error } = await supabase.rpc('cast_vote', {
        p_access_code: access_code,
        p_candidate_id: candidate_id
      });

      if (error || data?.success === false) {
        return res.status(400).json({
          error: data?.error || 'Error al registrar voto'
        });
      }

      return res.json({
        success: true,
        student: data.student
      });
    }

    // ─────────────────────────────
    // ADMIN (LOGIN + CONTROL)
    // ─────────────────────────────
    if (path.startsWith('admin')) {
      const adminCode =
        req.headers['x-admin-code'] ||
        req.body?.admin_code;

      if (!adminCode) {
        return res.status(401).json({ error: 'Código requerido' });
      }

      const { data: config, error } = await supabase
        .from('config')
        .select('admin_code, election_status')
        .eq('id', 1)
        .single();

      if (error || !config) {
        return res.status(500).json({ error: 'Config no encontrada' });
      }

      if (adminCode !== config.admin_code) {
        return res.status(401).json({ error: 'Código incorrecto' });
      }

      // LOGIN
      if (path === 'admin/login') {
        return res.json({ success: true });
      }

      // ABRIR / CERRAR VOTACIÓN
      if (path === 'admin/election' && req.method === 'POST') {
        const { action } = req.body;
        const newStatus = action === 'open' ? 'open' : 'closed';

        await supabase
          .from('config')
          .update({ election_status: newStatus })
          .eq('id', 1);

        return res.json({ success: true, status: newStatus });
      }

      return res.status(404).json({ error: 'Acción admin inválida' });
    }

    // ───────── DEFAULT
    return res.status(404).json({ error: 'Ruta no encontrada' });

  } catch (err) {
    console.error('API ERROR:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
