/**
 * Configuración (Internet - Vercel + Supabase)
 * Este proyecto NO usa Firebase ni modo demo.
 * Todo se maneja por /api/*.
 */

window.isDemoMode = false;
window.isServerMode = true;

const FirebaseAPI = {
  _fetchJsonSafe: async (url, opts = {}) => {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data && (data.error || data.message) ? (data.error || data.message) : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  },

  // Config
  getConfig: async () => await FirebaseAPI._fetchJsonSafe('/api/config'),
  updateConfig: async (updates) => await FirebaseAPI._fetchJsonSafe('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates || {})
  }),

  // Candidates
  getCandidates: async () => await FirebaseAPI._fetchJsonSafe('/api/candidates'),
  addCandidate: async (candidate) => {
    const res = await FirebaseAPI._fetchJsonSafe('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate || {})
    });
    return res.id;
  },
  updateCandidate: async (id, updates) => await FirebaseAPI._fetchJsonSafe(`/api/candidates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates || {})
  }),
  deleteCandidate: async (id) => await FirebaseAPI._fetchJsonSafe(`/api/candidates/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  }),

  // Students
  getStudents: async () => await FirebaseAPI._fetchJsonSafe('/api/students'),
  addStudent: async (student) => {
    const res = await FirebaseAPI._fetchJsonSafe('/api/students/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student || {})
    });
    return res.id;
  },
  updateStudent: async (id, updates) => await FirebaseAPI._fetchJsonSafe('/api/students/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, updates: updates || {} })
  }),
  deleteStudentByCode: async (accessCode) => await FirebaseAPI._fetchJsonSafe('/api/students/delete-by-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode })
  }),
  verifyStudentCode: async (code) => await FirebaseAPI._fetchJsonSafe('/api/students/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  }),
  generateCodes: async (grade, course, count) => {
    const res = await FirebaseAPI._fetchJsonSafe('/api/students/generate-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade: Number(grade), course: Number(course), count: Number(count) })
    });
    return res.students || [];
  },

  // Votes
  castVote: async (studentCode, candidateId) => await FirebaseAPI._fetchJsonSafe('/api/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentCode, candidateId })
  }),

  // Stats
  getStats: async () => await FirebaseAPI._fetchJsonSafe('/api/stats'),

  // Realtime (polling)
  onCandidatesChange: (callback) => {
    const interval = setInterval(() => {
      try { callback(); } catch (_) {}
    }, 2000);
    return interval;
  }
};

window.FirebaseAPI = FirebaseAPI;
