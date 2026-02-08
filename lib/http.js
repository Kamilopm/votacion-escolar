async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Cuerpo JSON inválido');
    err.statusCode = 400;
    throw err;
  }
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function sendError(res, err) {
  const status = err.statusCode || 500;
  send(res, status, { success: false, error: err.message || 'Error interno' });
}

module.exports = { readJson, send, sendError };
