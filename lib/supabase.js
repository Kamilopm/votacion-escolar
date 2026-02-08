const { createClient } = require('@supabase/supabase-js');

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const err = new Error('Faltan variables SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
    err.statusCode = 500;
    throw err;
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

module.exports = { getSupabaseAdmin };
