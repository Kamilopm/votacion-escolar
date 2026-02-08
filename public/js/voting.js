/**
 * Sistema de Votación Escolar - Módulo de Votación
 * Maneja todo el proceso de votación de estudiantes
 */

const Voting = {
    // Estado actual
    currentStep: 1,
    currentStudent: null,
    selectedCandidate: null,

    /**
     * Verifica si un código de estudiante existe y está habilitado para votar.
     * Retorna true/false (para uso por el escáner QR).
     */
    verifyCode: async function(code) {
        try {
            const normalized = (code || '').trim().toUpperCase();
            if (!normalized || normalized.length < 4) return false;

            if (!window.isDemoMode) {
                // Si la votación está cerrada, no permitir validar códigos.
                const cfg = await FirebaseAPI.getConfig();
                if (cfg && cfg.electionStatus === 'closed') return false;

                const result = await FirebaseAPI.verifyStudentCode(normalized);
                if (!result.found) return false;
                if (result.student && result.student.hasVoted) return false;
                return true;
            }

            // Modo demo
            const student = LocalStorage.getStudentByCode(normalized);
            if (!student) return false;
            if (student.hasVoted) return false;
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Atajo para iniciar login desde el escáner QR.
     */
    login: async function(code) {
        const codeInput = document.getElementById('student-code');
        if (codeInput) {
            codeInput.value = (code || '').trim().toUpperCase();
        }
        return this.handleLogin();
    },
    
    /**
     * Inicializa el módulo de votación
     */
    init: function() {
        this.bindEvents();
    },
    
    /**
     * Asocia los eventos del formulario de login
     */
    bindEvents: function() {
        const form = document.getElementById('student-login-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
            
            // Formatear código mientras escribe
            const codeInput = document.getElementById('student-code');
            if (codeInput) {
                codeInput.addEventListener('input', (e) => {
                    e.target.value = e.target.value.toUpperCase();
                });
            }
        }
    },
    
    /**
     * Maneja el login del estudiante
     */
    handleLogin: async function() {
        const codeInput = document.getElementById('student-code');
        const code = codeInput.value.trim().toUpperCase();
        
        if (!code || code.length < 4) {
            this.showError('Por favor ingresa tu código de votación');
            return;
        }
        
        // Mostrar indicador de carga
        this.setLoading(true);
        
        try {
            let studentData;

            // Bloquear si la votación está cerrada (solo en producción)
            if (!window.isDemoMode) {
                const cfg = await FirebaseAPI.getConfig();
                if (cfg && cfg.electionStatus === 'closed') {
                    throw new Error('La votación está cerrada');
                }
            }
            
            // Verificar código
            if (!window.isDemoMode) {
                const result = await FirebaseAPI.verifyStudentCode(code);
                if (!result.found) {
                    throw new Error('Código no encontrado');
                }
                if (result.student.hasVoted) {
                    throw new Error('Este código ya fue utilizado');
                }
                studentData = result;
            } else {
                // Modo demo
                const student = LocalStorage.getStudentByCode(code);
                if (!student) {
                    throw new Error('Código no encontrado');
                }
                if (student.hasVoted) {
                    throw new Error('Este código ya fue utilizado');
                }
                studentData = { student: student, id: student.id };
            }
            
            // Código válido - iniciar proceso
            this.currentStudent = studentData;
            this.currentStep = 1;
            this.selectedCandidate = null;
            
            // Limpiar input
            codeInput.value = '';
            
            // Mostrar información del estudiante
            this.showStudentInfo();
            
            // Ir al paso 1
            this.goToStep(1);
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    },
    
    /**
     * Muestra información del estudiante
     */
    showStudentInfo: function() {
        const infoEl = document.getElementById('student-info');
        if (!infoEl) return;
        
        const gradeNames = {
            6: 'Sexto', 7: 'Séptimo', 8: 'Octavo',
            9: 'Noveno', 10: 'Décimo', 11: 'Undécimo'
        };
        
        infoEl.innerHTML = `
            <p><strong>Grado:</strong> ${gradeNames[this.currentStudent.student.grade] || this.currentStudent.student.grade}</p>
        `;
    },
    
    /**
     * Muestra la pantalla de votación
     */
    goToStep: function(step) {
        this.currentStep = step;
        
        // Ocultar todas las pantallas
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        
        // Mostrar pantalla de votación
        document.getElementById('voting-screen').classList.add('active');
        
        // Ocultar todos los pasos
        document.querySelectorAll('.voting-step').forEach(s => s.classList.remove('active'));
        
        // Mostrar paso actual
        const stepEl = document.getElementById(`voting-step-${step}`);
        if (stepEl) {
            stepEl.classList.add('active');
        }
        
        // Actualizar indicador de progreso
        this.updateProgress();
        
        // Cargar contenido específico del paso
        if (step === 2) {
            this.loadCandidates();
        } else if (step === 3) {
            this.loadSelectedCandidate();
        }
    },
    
    /**
     * Actualiza el indicador de progreso
     */
    updateProgress: function() {
        const stepIndicator = document.getElementById('step-indicator');
        const progressFill = document.getElementById('progress-fill');
        
        if (stepIndicator) {
            stepIndicator.textContent = `Paso ${this.currentStep} de 4`;
        }
        
        if (progressFill) {
            const percentage = (this.currentStep / 4) * 100;
            progressFill.style.width = `${percentage}%`;
        }
    },
    
    /**
     * Avanza al siguiente paso
     */
    nextStep: function() {
        if (this.currentStep < 4) {
            this.goToStep(this.currentStep + 1);
        }
    },
    
    /**
     * Retrocede al paso anterior
     */
    prevStep: function() {
        if (this.currentStep > 1) {
            this.goToStep(this.currentStep - 1);
        }
    },
    
    /**
     * Carga los candidatos para la pantalla de votación
     */
    loadCandidates: async function() {
        const container = document.getElementById('candidates-grid');
        if (!container) return;
        
        container.innerHTML = '<div class="loading-spinner"></div>';
        
        try {
            let candidates;
            
            if (!window.isDemoMode) {
                candidates = await FirebaseAPI.getCandidates();
            } else {
                candidates = LocalStorage.getCandidates();
            }
            
            if (candidates.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                        <p style="color: #666; font-size: 18px;">No hay candidatos registrados.</p>
                        <p style="color: #999;">Contacta al administrador del sistema.</p>
                    </div>
                `;
                return;
            }
            
            // Ordenar por número o nombre
            const sortedCandidates = [...candidates].sort((a, b) => {
                if (a.number && b.number) return a.number - b.number;
                return a.name.localeCompare(b.name);
            });
            
            let html = '';
            
            sortedCandidates.forEach(candidate => {
                const photo = candidate.photo || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect fill="%23ddd" width="150" height="150"/><text fill="%23999" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">👤</text></svg>';
                
                html += `
                    <div class="candidate-voting-card" data-id="${candidate.id}" onclick="Voting.selectCandidate('${candidate.id}')">
                        <img src="${photo}" alt="${candidate.name}" class="photo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22150%22 viewBox=%220 0 150 150%22><rect fill=%22%23ddd%22 width=%22150%22 height=%22150%22/><text fill=%22%23999%22 x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2240%22>👤</text></svg>'">
                        <div class="info">
                            <p class="name">${candidate.name}</p>
                            ${candidate.number ? `<span class="number">${candidate.number}</span>` : ''}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            
        } catch (error) {
            console.error('Error cargando candidatos:', error);
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <p style="color: #e74c3c;">Error al cargar candidatos</p>
                </div>
            `;
        }
    },
    
    /**
     * Selecciona un candidato
     */
    selectCandidate: async function(candidateId) {
        // Quitar selección anterior
        document.querySelectorAll('.candidate-voting-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Marcar nuevo candidato
        const selectedCard = document.querySelector(`.candidate-voting-card[data-id="${candidateId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        // Obtener datos del candidato
        if (!window.isDemoMode) {
            const candidates = await FirebaseAPI.getCandidates();
            this.selectedCandidate = candidates.find(c => c.id === candidateId);
        } else {
            this.selectedCandidate = LocalStorage.getCandidateById(candidateId);
        }
        
        // Auto-avanzar
        setTimeout(() => {
            this.goToStep(3);
        }, 300);
    },
    
    /**
     * Carga la información del candidato seleccionado
     */
    loadSelectedCandidate: function() {
        if (!this.selectedCandidate) return;
        
        const photoEl = document.getElementById('selected-photo');
        const nameEl = document.getElementById('selected-name');
        const gradeEl = document.getElementById('selected-grade');
        
        const gradeNames = {
            6: 'Sexto', 7: 'Séptimo', 8: 'Octavo',
            9: 'Noveno', 10: 'Décimo', 11: 'Undécimo'
        };
        
        if (photoEl) {
            photoEl.src = this.selectedCandidate.photo || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect fill="%23ddd" width="150" height="150"/><text fill="%23999" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">👤</text></svg>';
            photoEl.onerror = function() {
                this.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22150%22 viewBox=%220 0 150 150%22><rect fill=%22%23ddd%22 width=%22150%22 height=%22150%22/><text fill=%22%23999%22 x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2240%22>👤</text></svg>';
            };
        }
        
        if (nameEl) {
            nameEl.textContent = this.selectedCandidate.name;
        }
        
        if (gradeEl) {
            gradeEl.textContent = gradeNames[this.selectedCandidate.grade] || 'Grado ' + this.selectedCandidate.grade;
        }
    },
    
    /**
     * Confirma el voto
     */
    confirmVote: async function() {
        if (!this.selectedCandidate || !this.currentStudent) {
            this.showError('Error: No hay candidato seleccionado');
            return;
        }
        
        this.setLoading(true);
        
        try {
            const code = this.currentStudent.student.accessCode;
            const candidateId = this.selectedCandidate.id;

            // Validar estado de votación nuevamente (por si se cerró durante el proceso)
            if (!window.isDemoMode) {
                const cfg = await FirebaseAPI.getConfig();
                if (cfg && cfg.electionStatus === 'closed') {
                    throw new Error('La votación está cerrada');
                }
            }
            
            if (!window.isDemoMode) {
                // En modo SERVIDOR, el backend registra el voto y marca hasVoted.
                // En modo FIREBASE, se marca aquí.
                await FirebaseAPI.castVote(code, candidateId);

                if (!window.isServerMode) {
                    await FirebaseAPI.updateStudent(this.currentStudent.id, {
                        hasVoted: true,
                        votedAt: new Date().toISOString()
                    });
                }
            } else {
                // Votar en localStorage
                LocalStorage.castVote(code, candidateId);
            }
            
            // Generar código de comprobante
            const receiptCode = 'V' + Date.now().toString(36).toUpperCase();
            document.getElementById('receipt-code').textContent = receiptCode;
            
            // Ir a pantalla de éxito
            this.goToStep(4);
            
            // Actualizar dashboard si está abierto
            if (typeof Charts !== 'undefined') {
                Charts.updateDashboard();
            }
            
        } catch (error) {
            this.showError(error.message || 'Error al registrar el voto');
        } finally {
            this.setLoading(false);
        }
    },
    
    /**
     * Cancela la votación
     */
    cancel: function() {
        this.reset();
        App.showScreen('welcome-screen');
    },
    
    /**
     * Finaliza la votación
     */
    finish: function() {
        this.reset();
        App.showScreen('welcome-screen');
    },
    
    /**
     * Resetea el estado
     */
    reset: function() {
        this.currentStudent = null;
        this.selectedCandidate = null;
        this.currentStep = 1;
    },
    
    /**
     * Muestra pantalla de error
     */
    showError: function(message) {
        const errorTitle = document.getElementById('error-title');
        const errorMessage = document.getElementById('error-message');
        
        if (errorTitle) errorTitle.textContent = message.includes('ya fue') ? 'Código Utilizado' : 'Código Inválido';
        if (errorMessage) errorMessage.textContent = message;
        
        App.showScreen('error-screen');
    },
    
    /**
     * Controla el estado de carga
     */
    setLoading: function(loading) {
        const form = document.getElementById('student-login-form');
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
        
        if (submitBtn) {
            submitBtn.disabled = loading;
            submitBtn.innerHTML = loading ? '<span class="spinner"></span> Verificando...' : 'Continuar';
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    Voting.init();
});

// Exportar para uso global
window.Voting = Voting;
