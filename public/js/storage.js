/**
 * Sistema de Votación Escolar - Almacenamiento Local
 * Fallback usando localStorage cuando Firebase no está disponible
 */

const LocalStorage = {
    // Claves de almacenamiento
    KEYS: {
        CANDIDATES: 'svs_candidates',
        STUDENTS: 'svs_students',
        VOTES: 'svs_votes',
        CONFIG: 'svs_config',
        ADMIN_CODE: 'svs_admin_code'
    },
    
    /**
     * Inicializa el almacenamiento local
     */
    init: function() {
        if (!localStorage.getItem(this.KEYS.CONFIG)) {
            this.saveConfig({
                electionStatus: 'active',
                electionTitle: 'Elección de Personero Estudiantil',
                schoolName: 'Colegio',
                createdAt: new Date().toISOString()
            });
        }
        
        if (!localStorage.getItem(this.KEYS.ADMIN_CODE)) {
            localStorage.setItem(this.KEYS.ADMIN_CODE, 'ADMIN2026');
        }
        
        console.log('📦 Almacenamiento local inicializado');
    },
    
    /**
     * Guarda datos en localStorage
     */
    set: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error guardando en localStorage:', error);
            return false;
        }
    },
    
    /**
     * Obtiene datos de localStorage
     */
    get: function(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Error leyendo de localStorage:', error);
            return defaultValue;
        }
    },
    
    /**
     * Elimina datos de localStorage
     */
    remove: function(key) {
        localStorage.removeItem(key);
    },
    
    // ============================================
    // CONFIGURACIÓN
    // ============================================
    
    getConfig: function() {
        return this.get(this.KEYS.CONFIG, {
            electionStatus: 'active',
            electionTitle: 'Elección de Personero Estudiantil',
            schoolName: 'Colegio'
        });
    },
    
    saveConfig: function(config) {
        return this.set(this.KEYS.CONFIG, config);
    },
    
    updateConfig: function(updates) {
        const current = this.getConfig();
        const newConfig = { ...current, ...updates };
        return this.saveConfig(newConfig);
    },
    
    // ============================================
    // CANDIDATOS
    // ============================================
    
    getCandidates: function() {
        return this.get(this.KEYS.CANDIDATES, []);
    },
    
    saveCandidate: function(candidate) {
        const candidates = this.getCandidates();
        
        if (candidate.id) {
            // Actualizar existente
            const index = candidates.findIndex(c => c.id === candidate.id);
            if (index !== -1) {
                candidates[index] = candidate;
            }
        } else {
            // Nuevo candidato
            candidate.id = 'cand_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            candidate.voteCount = 0;
            candidate.createdAt = new Date().toISOString();
            candidates.push(candidate);
        }
        
        this.set(this.KEYS.CANDIDATES, candidates);
        return candidate;
    },
    
    deleteCandidate: function(id) {
        const candidates = this.getCandidates().filter(c => c.id !== id);
        this.set(this.KEYS.CANDIDATES, candidates);
    },
    
    getCandidateById: function(id) {
        return this.getCandidates().find(c => c.id === id);
    },
    
    // ============================================
    // ESTUDIANTES
    // ============================================
    
    getStudents: function() {
        return this.get(this.KEYS.STUDENTS, []);
    },
    
    saveStudent: function(student) {
        const students = this.getStudents();
        
        // Verificar si ya existe
        const existing = students.find(s => s.accessCode === student.accessCode);
        if (existing) {
            return existing;
        }
        
        student.id = 'stud_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        student.hasVoted = false;
        student.votedAt = null;
        student.createdAt = new Date().toISOString();
        
        students.push(student);
        this.set(this.KEYS.STUDENTS, students);
        
        return student;
    },

    /**
     * Elimina un estudiante por su código de acceso
     */
    deleteStudentByCode: function(accessCode) {
        const students = this.getStudents();
        const filtered = students.filter(s => s.accessCode !== accessCode);
        this.set(this.KEYS.STUDENTS, filtered);
        return true;
    },
    
    getStudentByCode: function(code) {
        return this.getStudents().find(s => s.accessCode === code);
    },
    
    generateStudentCodes: function(grade, course, count) {
    const students = [];
    const gradeNum = parseInt(grade);
    const courseNum = parseInt(course);

    const buildCode = (g, c, n) => {
        const prefix = `${g}${c}`;
        const suffix = String(n).padStart(2, '0');
        return `${prefix}${suffix}`;
    };

    const existing = this.getStudents().filter(s => parseInt(s.grade) === gradeNum && parseInt(s.course) === courseNum);
    let maxList = 0;
    for (const s of existing) {
        const ln = parseInt(s.listNumber);
        if (!isNaN(ln)) { if (ln > maxList) maxList = ln; continue; }

        const code = String(s.accessCode || '');
        const prefix = `${gradeNum}${courseNum}`;
        if (code.startsWith(prefix)) {
            const restNum = parseInt(code.slice(prefix.length));
            if (!isNaN(restNum) && restNum > maxList) maxList = restNum;
        }
    }

    const existingCodes = new Set(this.getStudents().map(s => String(s.accessCode)));
    let nextList = maxList + 1;

    for (let i = 0; i < count; i++) {
        let tries = 0;
        let code = buildCode(gradeNum, courseNum, nextList);
        while (existingCodes.has(code) && tries < 200) {
            nextList++;
            code = buildCode(gradeNum, courseNum, nextList);
            tries++;
        }
        if (tries >= 200) break;

        const student = this.saveStudent({
            grade: gradeNum,
            course: courseNum,
            listNumber: nextList,
            accessCode: code
        });

        students.push(student);
        existingCodes.add(code);
        nextList++;
    }

    return students;
},
,
    
    // ============================================
    // VOTOS
    // ============================================
    
    getVotes: function() {
        return this.get(this.KEYS.VOTES, []);
    },
    
    castVote: function(studentCode, candidateId) {
        const students = this.getStudents();
        const student = students.find(s => s.accessCode === studentCode);
        
        if (!student) {
            throw new Error('Estudiante no encontrado');
        }
        
        if (student.hasVoted) {
            throw new Error('Este código ya fue utilizado');
        }
        
        // Marcar estudiante como votado
        student.hasVoted = true;
        student.votedAt = new Date().toISOString();
        this.set(this.KEYS.STUDENTS, students);
        
        // Actualizar contador del candidato
        const candidates = this.getCandidates();
        const candidate = candidates.find(c => c.id === candidateId);
        
        if (candidate) {
            candidate.voteCount = (candidate.voteCount || 0) + 1;
            this.set(this.KEYS.CANDIDATES, candidates);
        }
        
        // Registrar voto
        const votes = this.getVotes();
        votes.push({
            id: 'vote_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
            studentCode: studentCode,
            candidateId: candidateId,
            timestamp: new Date().toISOString()
        });
        this.set(this.KEYS.VOTES, votes);
        
        return true;
    },
    
    // ============================================
    // ESTADÍSTICAS
    // ============================================
    
    getStats: function() {
        const students = this.getStudents();
        const candidates = this.getCandidates();
        const votes = this.getVotes();
        
        const totalStudents = students.length;
        const totalVotes = votes.length;
        const participation = totalStudents > 0 ? ((totalVotes / totalStudents) * 100) : 0;
        
        // Participación por grado
        const participationByGrade = {};
        students.forEach(s => {
            const grade = s.grade;
            if (!participationByGrade[grade]) {
                participationByGrade[grade] = { total: 0, voted: 0 };
            }
            participationByGrade[grade].total++;
            if (s.hasVoted) {
                participationByGrade[grade].voted++;
            }
        });
        
        return {
            totalStudents,
            totalVotes,
            totalCandidates: candidates.length,
            participation: participation.toFixed(2),
            participationByGrade,
            candidates: candidates.sort((a, b) => b.voteCount - a.voteCount)
        };
    },
    
    // ============================================
    // ADMINISTRACIÓN
    // ============================================
    
    getAdminCode: function() {
        return this.get(this.KEYS.ADMIN_CODE, 'ADMIN2026');
    },
    
    verifyAdminCode: function(code) {
        return this.getAdminCode() === code;
    },
    
    changeAdminCode: function(newCode) {
        localStorage.setItem(this.KEYS.ADMIN_CODE, newCode);
    },
    
    // ============================================
    // MANTENIMIENTO
    // ============================================
    
    resetVoting: function() {
        // Resetear estudiantes
        const students = this.getStudents().map(s => ({
            ...s,
            hasVoted: false,
            votedAt: null
        }));
        this.set(this.KEYS.STUDENTS, students);
        
        // Resetear candidatos
        const candidates = this.getCandidates().map(c => ({
            ...c,
            voteCount: 0
        }));
        this.set(this.KEYS.CANDIDATES, candidates);
        
        // Eliminar votos
        this.set(this.KEYS.VOTES, []);
    },
    
    clearAll: function() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },
    
    exportData: function() {
        return {
            config: this.getConfig(),
            candidates: this.getCandidates(),
            students: this.getStudents(),
            votes: this.getVotes(),
            exportedAt: new Date().toISOString()
        };
    },
    
    importData: function(data) {
        if (data.config) this.saveConfig(data.config);
        if (data.candidates) this.set(this.KEYS.CANDIDATES, data.candidates);
        if (data.students) this.set(this.KEYS.STUDENTS, data.students);
        if (data.votes) this.set(this.KEYS.VOTES, data.votes);
    }
};

// Inicializar al cargar
LocalStorage.init();

// Exportar para uso global
window.LocalStorage = LocalStorage;
