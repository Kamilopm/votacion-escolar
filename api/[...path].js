import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const getHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
});

export default async function handler(req, res) {
  if (req.url === '/api/health' || req.url === '/api/health/') {
    return res.status(200).json({ ok: true });
  }
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/', '').split('/').filter(Boolean);
  const endpoint = pathParts[0];
  const subEndpoint = pathParts[1];

  try {
    switch (endpoint) {
      case 'check-status': return await checkStatus(req, res);
      case 'verify-code': return await verifyCode(req, res);
      case 'cast-vote': return await castVote(req, res);
      case 'get-candidates': return await getCandidates(req, res);
      case 'admin': return await handleAdmin(req, res, subEndpoint);
      case 'stats': return await getStats(req, res);
      case 'config': return await handleConfig(req, res);
      case 'carnets': return await generateCarnets(req, res);
      default: return res.status(404).json({ error: 'Endpoint no encontrado' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function checkStatus(req, res) {
  const { data, error } = await supabase.from('config').select('election_status, school_logo_url, school_name').eq('id', 1).single();
  if (error) return res.status(500).json({ error: 'Error al consultar estado' });
  return res.status(200).json({ 
    open: data.election_status === 'open', 
    status: data.election_status,
    school_logo: data.school_logo_url,
    school_name: data.school_name
  });
}

async function verifyCode(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { access_code } = req.body || {};
  if (!access_code || !/^\d{3,5}$/.test(access_code)) return res.status(400).json({ error: 'Código inválido' });
  const { data: student, error } = await supabase.from('students').select('id, full_name, grade, course, has_voted').eq('access_code', access_code).single();
  if (error || !student) return res.status(404).json({ error: 'Código no encontrado' });
  if (student.has_voted) return res.status(403).json({ error: 'Este código ya ha sido utilizado' });
  return res.status(200).json({ valid: true, student: { name: student.full_name, grade: student.grade, course: student.course } });
}

async function castVote(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { access_code, candidate_id } = req.body || {};
  if (!access_code || !candidate_id) return res.status(400).json({ error: 'Datos incompletos' });
  const { data, error } = await supabase.rpc('cast_vote', { p_access_code: access_code, p_candidate_id: candidate_id });
  if (error) return res.status(500).json({ error: 'Error al procesar voto' });
  const result = data;
  if (!result.success) return res.status(400).json({ error: result.error });
  return res.status(200).json({ success: true, message: 'Voto registrado correctamente', student: result.student });
}

async function getCandidates(req, res) {
  const { data, error } = await supabase.from('candidates').select('id, name, party, photo_url').order('name');
  if (error) return res.status(500).json({ error: 'Error al cargar candidatos' });
  return res.status(200).json({ candidates: data });
}

async function handleConfig(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('config').select('school_logo_url, school_name').eq('id', 1).single();
    if (error) return res.status(500).json({ error: 'Error' });
    return res.status(200).json(data);
  }
  
  if (req.method === 'POST') {
    const adminCode = req.headers['x-admin-code'];
    const { data: config } = await supabase.from('config').select('admin_code').eq('id', 1).single();
    if (!config || adminCode !== config.admin_code) return res.status(401).json({ error: 'No autorizado' });
    
    const { school_logo_url, school_name } = req.body || {};
    const { error } = await supabase.from('config').update({ 
      school_logo_url: school_logo_url || null,
      school_name: school_name || 'Colegio'
    }).eq('id', 1);
    
    if (error) return res.status(500).json({ error: 'Error al actualizar' });
    return res.status(200).json({ success: true });
  }
  
  return res.status(405).json({ error: 'Método no permitido' });
}

async function generateCarnets(req, res) {
  const adminCode = req.headers['x-admin-code'];
  const { data: config } = await supabase.from('config').select('admin_code, school_logo_url, school_name').eq('id', 1).single();
  if (!config || adminCode !== config.admin_code) return res.status(401).json({ error: 'No autorizado' });
  
  const { data: students } = await supabase.from('students').select('full_name, grade, course, list_number, access_code').order('grade').order('course').order('list_number');
  if (!students) return res.status(500).json({ error: 'Error al cargar estudiantes' });
  
  return res.status(200).json({ 
    students, 
    school_logo: config.school_logo_url,
    school_name: config.school_name
  });
}

async function handleAdmin(req, res, subEndpoint) {
  const adminCode = req.headers['x-admin-code'] || req.body?.admin_code;
  const { data: config } = await supabase.from('config').select('admin_code').eq('id', 1).single();
  if (!config || adminCode !== config.admin_code) return res.status(401).json({ error: 'Código de administrador inválido' });
  
  switch (subEndpoint) {
    case 'login': return res.status(200).json({ success: true });
    case 'students': return await handleStudents(req, res);
    case 'candidates': return await handleCandidates(req, res);
    case 'election': return await handleElection(req, res);
    case 'import': return await importStudents(req, res);
    case 'reset-codes': return await resetCodes(req, res);
    case 'clear-data': return await clearData(req, res);
    default: return res.status(404).json({ error: 'Sub-endpoint no encontrado' });
  }
}

async function handleStudents(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('students').select('id, full_name, grade, course, list_number, access_code, has_voted').order('grade').order('course').order('list_number');
    if (error) return res.status(500).json({ error: 'Error al cargar estudiantes' });
    return res.status(200).json({ students: data });
  }
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Error al eliminar' });
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ error: 'Método no permitido' });
}

async function handleCandidates(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('candidates').select('*').order('name');
    if (error) return res.status(500).json({ error: 'Error al cargar candidatos' });
    return res.status(200).json({ candidates: data });
  }
  if (req.method === 'POST') {
    const { name, party, photo_url } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const { data, error } = await supabase.from('candidates').insert([{ name, party: party || '', photo_url: photo_url || '' }]).select().single();
    if (error) return res.status(500).json({ error: 'Error al crear candidato' });
    return res.status(200).json({ candidate: data });
  }
  if (req.method === 'PUT') {
    const { id, photo_url } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    const { error } = await supabase.from('candidates').update({ photo_url }).eq('id', id);
    if (error) return res.status(500).json({ error: 'Error al actualizar foto' });
    return res.status(200).json({ success: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    await supabase.from('votes').delete().eq('candidate_id', id);
    const { error } = await supabase.from('candidates').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Error al eliminar' });
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ error: 'Método no permitido' });
}

async function handleElection(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { action } = req.body || {};
  if (!['open', 'close'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });
  const { error } = await supabase.from('config').update({ election_status: action === 'open' ? 'open' : 'closed' }).eq('id', 1);
  if (error) return res.status(500).json({ error: 'Error al cambiar estado' });
  return res.status(200).json({ success: true, status: action === 'open' ? 'open' : 'closed' });
}

async function importStudents(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { students } = req.body || {};
  if (!Array.isArray(students) || students.length === 0) return res.status(400).json({ error: 'No hay estudiantes para importar' });
  const validStudents = students.filter(s => s.full_name && s.grade && s.course && !isNaN(parseInt(s.grade)) && !isNaN(parseInt(s.course))).map(s => ({
    full_name: s.full_name.trim(),
    grade: parseInt(s.grade),
    course: parseInt(s.course),
    list_number: parseInt(s.list_number) || 0
  }));
  if (validStudents.length === 0) return res.status(400).json({ error: 'No hay estudiantes válidos para importar' });
  const batchSize = 100;
  let inserted = 0;
  let errors = [];
  for (let i = 0; i < validStudents.length; i += batchSize) {
    const batch = validStudents.slice(i, i + batchSize);
    const { data, error } = await supabase.from('students').insert(batch).select('id, full_name, grade, course, list_number, access_code');
    if (error) {
      if (error.code === '23505') {
        for (const student of batch) {
          const { error: singleError } = await supabase.from('students').insert(student);
          if (singleError) { errors.push(`${student.full_name}: ${singleError.message}`); } else { inserted++; }
        }
      } else { errors.push(`Lote ${i/batchSize + 1}: ${error.message}`); }
    } else { inserted += data.length; }
  }
  return res.status(200).json({ success: true, imported: inserted, total: validStudents.length, errors: errors.length > 0 ? errors : undefined });
}

async function resetCodes(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { data: students, error: fetchError } = await supabase.from('students').select('id, grade, course, list_number');
  if (fetchError) return res.status(500).json({ error: 'Error al cargar estudiantes' });
  let updated = 0;
  for (const student of students) {
    const newCode = `${student.grade}${student.course}${String(student.list_number).padStart(2, '0')}`;
    const { error } = await supabase.from('students').update({ access_code: newCode }).eq('id', student.id);
    if (!error) updated++;
  }
  return res.status(200).json({ success: true, message: `${updated} códigos regenerados` });
}

async function clearData(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { confirm } = req.body || {};
  if (confirm !== 'ELIMINAR TODO') return res.status(400).json({ error: 'Confirmación requerida' });
  await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('candidates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('config').update({ election_status: 'closed' }).eq('id', 1);
  return res.status(200).json({ success: true, message: 'Datos eliminados' });
}

async function getStats(req, res) {
  const adminCode = req.headers['x-admin-code'];
  const { data: config } = await supabase.from('config').select('admin_code').eq('id', 1).single();
  if (!config || adminCode !== config.admin_code) return res.status(401).json({ error: 'No autorizado' });
  const { data: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
  const { data: votedStudents } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('has_voted', true);
  const { data: totalVotes } = await supabase.from('candidates').select('votes');
  const sumVotes = totalVotes?.reduce((a, b) => a + (b.votes || 0), 0) || 0;
  const { data: byGrade } = await supabase.from('participation_by_grade').select('*');
  const { data: results } = await supabase.from('election_results').select('*');
  return res.status(200).json({
    general: { totalStudents: totalStudents?.length || 0, totalVoted: votedStudents?.length || 0, totalVotes: sumVotes, participation: totalStudents?.length > 0 ? Math.round((votedStudents?.length || 0) / totalStudents.length * 100) : 0 },
    byGrade: byGrade || [],
    results: results || []
  });
}
Actualizar backend - fotos y carnets
