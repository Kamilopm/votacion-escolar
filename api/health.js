const { send } = require('../lib/http');

module.exports = async (req, res) => {
  send(res, 200, { ok: true, ts: new Date().toISOString() });
};
