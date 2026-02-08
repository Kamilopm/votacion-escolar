const { getSupabaseAdmin } = require('../../lib/supabase');
const { readJson, send, sendError } = require('../../lib/http');

module.exports = async (req, res) => {
  try {
    const sb = getSupabaseAdmin();

    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('config')
        .select('id,school_name,logo_url,election_status,updated_at')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;

      const cfg = data || { id: 1, school_name: 'Institución Educativa', logo_url: null, election_status: 'active' };

      // Compatibilidad con frontend (camelCase)
      send(res, 200, {
        electionStatus: cfg.election_status || 'active',
        schoolName: cfg.school_name || 'Institución Educativa',
        schoolLogo: cfg.logo_url || null
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      // Aceptar varias claves del frontend
      const electionStatus = body.electionStatus || body.election_status || body.status || body.electionState;
      const schoolName = body.schoolName || body.school_name;
      const schoolLogo = body.schoolLogo || body.logoUrl || body.logo_url || null;

      const payload = { id: 1 };
      if (electionStatus !== undefined) payload.election_status = String(electionStatus);
      if (schoolName !== undefined) payload.school_name = String(schoolName);
      if (schoolLogo !== undefined) payload.logo_url = schoolLogo ? String(schoolLogo) : null;

      const { error } = await sb.from('config').upsert(payload);
      if (error) throw error;

      send(res, 200, { success: true });
      return;
    }

    res.setHeader('Allow', 'GET,POST');
    send(res, 405, { success: false, error: 'Método no permitido' });
  } catch (err) {
    sendError(res, err);
  }
};
