/**
 * Sistema de Votación Escolar - Panel de Administración
 * Maneja todas las funciones administrativas del sistema
 */

const Admin = {
    isLoggedIn: false,
    currentTab: 'dashboard',
    adminCode: null,
    
    /**
     * Inicializa el módulo de administración
     */
    init: function() {
        this.bindEvents();
        this.loadSettings();
    },
    
    /**
     * Asocia los eventos de la interfaz
     */
    bindEvents: function() {
        // Login de administrador
        const loginForm = document.getElementById('admin-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
        
        // Navegación por tabs
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                if (tab) {
                    this.showTab(tab);
                }
            });
        });
        
        // Formulario de candidatos
        const candidateForm = document.getElementById('candidate-form');
        if (candidateForm) {
            candidateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCandidate();
            });
        }
        
        // Generación de códigos
        const generateCodesForm = document.getElementById('generate-codes-form');
        if (generateCodesForm) {
            generateCodesForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.generateCodes();
            });
        }
        
        // Configuración
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSettings();
            });
        }
        
        // Subida de logo
        const logoUpload = document.getElementById('school-logo-upload');
        if (logoUpload) {
            logoUpload.addEventListener('change', (e) => {
                this.handleLogoUpload(e);
            });
        }
        
        // Foto de candidato
        const photoPreview = document.getElementById('photo-preview');
        if (photoPreview) {
            photoPreview.addEventListener('click', () => {
                document.getElementById('candidate-photo').click();
            });
        }
        
        const candidatePhoto = document.getElementById('candidate-photo');
        if (candidatePhoto) {
            candidatePhoto.addEventListener('change', (e) => {
                this.handleCandidatePhotoUpload(e);
            });
        }
        
        // Formulario de importación Excel
        const importExcelForm = document.getElementById('import-excel-form');
        if (importExcelForm) {
            importExcelForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.importExcel();
            });
        }
   

        // Eliminar estudiante desde la tabla de códigos
        const codesTable = document.getElementById('codes-table') || document.getElementById('codes-container') || document;
        codesTable.addEventListener('click', async (e) => {
            const btn = e.target.closest && e.target.closest('button[data-action="delete-student"]');
            if (!btn) return;
            const code = btn.getAttribute('data-code');
            if (!code) return;

            const ok = confirm(`¿Eliminar al alumno/código ${code}? Esta acción no se puede deshacer.`);
            if (!ok) return;

            try {
                await this.deleteStudentByCode(code);
                await this.loadStudentsCodes();
                await this.updateSummaryStats();
                this.showNotification('Alumno eliminado', 'success');
            } catch (err) {
                console.error(err);
                this.showNotification('No se pudo eliminar el alumno', 'error');
            }
        });
 },
    
    /**
     * Maneja el login de administrador
     */
    handleLogin: function() {
        const codeInput = document.getElementById('admin-code');
        const code = codeInput.value;
        
        let isValid;
        
        if (!window.isDemoMode) {
            // Verificar con el servidor
            isValid = code === 'ADMIN2026'; // El servidor validará
        } else {
            isValid = LocalStorage.verifyAdminCode(code);
        }
        
        if (isValid) {
            this.isLoggedIn = true;
            this.adminCode = code;
            codeInput.value = '';
            
            // Mostrar panel
            document.getElementById('login-admin').classList.remove('active');
            document.getElementById('admin-panel').classList.add('active');
            
            // Cargar dashboard
            this.showTab('dashboard');
            
            // Iniciar actualizaciones en tiempo real
            Charts.initRealtimeUpdates();
            
            this.showNotification('Bienvenido al panel de administración', 'success');
        } else {
            this.showNotification('Código de administrador incorrecto', 'error');
            
            // Vibrar en móviles
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }
        }
    },
    
    /**
     * Cierra la sesión
     */
    logout: function() {
        this.isLoggedIn = false;
        document.getElementById('admin-panel').classList.remove('active');
        App.showScreen('welcome-screen');
    },
    
    /**
     * Cambia entre tabs
     */
    showTab: function(tabName) {
        this.currentTab = tabName;
        
        // Actualizar navegación
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Actualizar contenido
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const tabContent = document.getElementById(`tab-${tabName}`);
        if (tabContent) {
            tabContent.classList.add('active');
        }
        
        // Cargar datos del tab
        this.loadTabData(tabName);
    },
    
    /**
     * Carga datos específicos del tab
     */
    loadTabData: async function(tabName) {
        switch (tabName) {
            case 'dashboard':
                await Charts.updateDashboard();
                await this.updateSummaryStats();
                break;
            case 'candidates':
                this.loadCandidates();
                break;
            case 'students':
                await this.loadStudentsCodes();
                await this.updateSummaryStats();
                break;
            case 'reports':
                this.loadReports();
                break;
            case 'settings':
                // Ya cargado en init
                break;
        }
    },
    
    /**
     * Actualiza estadísticas de resumen
     */
    updateSummaryStats: async function() {
        let stats;
        
        if (!window.isDemoMode) {
            stats = await FirebaseAPI.getStats();
        } else {
            stats = LocalStorage.getStats();
        }
        
        // Actualizar summary
        const summaryTotal = document.getElementById('summary-total');
        const summaryUsed = document.getElementById('summary-used');
        const summaryPending = document.getElementById('summary-pending');
        
        if (summaryTotal) summaryTotal.textContent = stats.totalStudents || 0;
        if (summaryUsed) summaryUsed.textContent = stats.totalVotes || 0;
        if (summaryPending) {
            const pending = (stats.totalStudents || 0) - (stats.totalVotes || 0);
            summaryPending.textContent = Math.max(0, pending);
        }
    },
    
    /**
     * Carga la lista de candidatos
     */
    loadCandidates: async function() {
        const container = document.getElementById('candidates-list');
        if (!container) return;
        
        let candidates;
        
        if (!window.isDemoMode) {
            candidates = await FirebaseAPI.getCandidates();
        } else {
            candidates = LocalStorage.getCandidates();
        }
        
        if (candidates.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                    <p style="font-size: 18px; margin-bottom: 10px;">No hay candidatos registrados</p>
                    <p>Agrega el primer candidato usando el botón de arriba</p>
                </div>
            `;
            return;
        }
        
        // Ordenar por número
        const sortedCandidates = [...candidates].sort((a, b) => {
            if (a.number && b.number) return a.number - b.number;
            return a.name.localeCompare(b.name);
        });
        
        let html = '';
        
        sortedCandidates.forEach(candidate => {
            const photo = candidate.photo || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="%23ddd" width="200" height="200"/><text fill="%23999" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">👤</text></svg>';
            
            html += `
                <div class="candidate-card" data-id="${candidate.id}">
                    <div class="candidate-photo">
                        <img src="${photo}" alt="${candidate.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22><rect fill=%22%23ddd%22 width=%22200%22 height=%22200%22/><text fill=%22%23999%22 x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2240%22>👤</text></svg>'">
                    </div>
                    <div class="candidate-info">
                        <h4 class="candidate-name">${candidate.name}</h4>
                        <p class="candidate-grade">${this.getGradeName(candidate.grade)}</p>
                        <span class="candidate-votes">${candidate.voteCount || 0} votos</span>
                    </div>
                    <div class="candidate-actions">
                        <button class="btn-icon btn-edit" onclick="Admin.editCandidate('${candidate.id}')" title="Editar">✏️</button>
                        <button class="btn-icon btn-delete" onclick="Admin.deleteCandidate('${candidate.id}')" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },
    
    /**
     * Abre el modal de candidato
     */
    openCandidateModal: function(candidateId = null) {
        const modal = document.getElementById('candidate-modal');
        const form = document.getElementById('candidate-form');
        const title = document.getElementById('modal-title');
        
        // Resetear formulario
        form.reset();
        document.getElementById('candidate-id').value = '';
        document.getElementById('photo-preview').innerHTML = `
            <span class="placeholder">📷</span>
            <span class="text">Click para subir foto</span>
        `;
        
        if (candidateId) {
            // Modo edición
            const candidate = LocalStorage.getCandidateById(candidateId);
            if (candidate) {
                title.textContent = 'Editar Candidato';
                document.getElementById('candidate-id').value = candidate.id;
                document.getElementById('candidate-name').value = candidate.name;
                document.getElementById('candidate-grade').value = candidate.grade;
                document.getElementById('candidate-number').value = candidate.number || '';
                
                if (candidate.photo) {
                    document.getElementById('photo-preview').innerHTML = `
                        <img src="${candidate.photo}" alt="Foto" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                    `;
                }
            }
        } else {
            // Modo nuevo
            title.textContent = 'Agregar Candidato';
            
            // Sugerir siguiente número
            const candidates = LocalStorage.getCandidates();
            const nextNumber = candidates.length + 1;
            document.getElementById('candidate-number').value = nextNumber;
        }
        
        modal.classList.add('active');
    },
    
    /**
     * Cierra el modal
     */
    closeCandidateModal: function() {
        document.getElementById('candidate-modal').classList.remove('active');
    },
    
    /**
     * Guarda un candidato
     */
    saveCandidate: async function() {
        const id = document.getElementById('candidate-id').value;
        const name = document.getElementById('candidate-name').value.trim();
        const grade = document.getElementById('candidate-grade').value;
        const number = document.getElementById('candidate-number').value;
        const photoEl = document.getElementById('photo-preview img');
        const photo = photoEl ? photoEl.src : null;
        
        if (!name) {
            this.showNotification('Por favor ingresa el nombre del candidato', 'error');
            return;
        }
        
        if (!grade) {
            this.showNotification('Por favor selecciona el grado del candidato', 'error');
            return;
        }
        
        const candidate = {
            id: id || null,
            name: name,
            grade: parseInt(grade),
            number: parseInt(number) || null,
            photo: photo
        };
        
        try {
            if (!window.isDemoMode) {
                if (id) {
                    await FirebaseAPI.updateCandidate(id, candidate);
                } else {
                    await FirebaseAPI.addCandidate(candidate);
                }
            } else {
                LocalStorage.saveCandidate(candidate);
            }
            
            this.closeCandidateModal();
            this.loadCandidates();
            this.showNotification(id ? 'Candidato actualizado' : 'Candidato agregado', 'success');
        } catch (error) {
            this.showNotification('Error al guardar el candidato', 'error');
        }
    },
    
    /**
     * Edita un candidato
     */
    editCandidate: function(id) {
        this.openCandidateModal(id);
    },
    
    /**
     * Elimina un candidato
     */
    deleteCandidate: async function(id) {
        if (!confirm('¿Estás seguro de eliminar este candidato?')) return;
        
        try {
            if (!window.isDemoMode) {
                await FirebaseAPI.deleteCandidate(id);
            } else {
                LocalStorage.deleteCandidate(id);
            }
            
            this.loadCandidates();
            this.showNotification('Candidato eliminado', 'success');
        } catch (error) {
            this.showNotification('Error al eliminar', 'error');
        }
    },
    
    /**
     * Genera códigos de estudiantes
     */
    generateCodes: async function() {
        const grade = document.getElementById('grade-select').value;
        const course = document.getElementById('course-select').value;
        const numStudents = parseInt(document.getElementById('num-students').value);
        
        if (numStudents < 1 || numStudents > 50) {
            this.showNotification('La cantidad debe ser entre 1 y 50', 'error');
            return;
        }
        
        this.showNotification('Generando códigos...', 'info');
        
        try {
            let students;
            
            if (!window.isDemoMode) {
                students = await FirebaseAPI.generateCodes(grade, course, numStudents);
            } else {
                students = LocalStorage.generateStudentCodes(grade, course, numStudents);
            }
            
            this.showNotification(`Se generaron ${students.length} códigos para ${this.getGradeName(grade)}-${course}`, 'success');
            this.loadStudentsCodes();
            this.updateSummaryStats();
        } catch (error) {
            this.showNotification('Error al generar códigos', 'error');
        }
    },
    
    /**
     * Carga la lista de códigos
     */
    
    /**
     * Elimina un estudiante por código de acceso
     */
    deleteStudentByCode: async function(accessCode) {
        if (!accessCode) return;

        if (!window.isDemoMode) {
            // Producción: borrar en Firebase (por accessCode)
            if (FirebaseAPI.deleteStudentByCode) {
                await FirebaseAPI.deleteStudentByCode(accessCode);
            } else {
                // fallback server
                await fetch('/api/students/delete-by-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessCode })
                }).then(async (r) => {
                    if (!r.ok) {
                        const d = await r.json().catch(() => ({}));
                        throw new Error(d.error || 'Error eliminando estudiante');
                    }
                });
            }
        } else {
            // Demo: borrar de LocalStorage
            if (LocalStorage.deleteStudentByCode) {
                LocalStorage.deleteStudentByCode(accessCode);
            } else {
                const students = LocalStorage.getStudents();
                const filtered = students.filter(s => s.accessCode !== accessCode);
                LocalStorage.set(LocalStorage.KEYS.STUDENTS, filtered);
            }
        }
    },
loadStudentsCodes: async function() {
        const tbody = document.getElementById('codes-tbody');
        if (!tbody) return;
        
        let students;
        
        if (!window.isDemoMode) {
            students = await FirebaseAPI.getStudents();
        } else {
            students = LocalStorage.getStudents();
        }
        
        // Ordenar por código
        const sortedStudents = [...students].sort((a, b) => 
            a.accessCode.localeCompare(b.accessCode)
        );
        
        // Mostrar solo los primeros 50
        const displayStudents = sortedStudents.slice(0, 50);
        
        let html = '';
        
        displayStudents.forEach(student => {
            const statusClass = student.hasVoted ? 'status-used' : 'status-pending';
            const statusText = student.hasVoted ? 'Utilizado' : 'Pendiente';
            
            html += `
                <tr>
                    <td><strong>${student.accessCode}</strong></td>
                    <td>${this.getGradeName(student.grade)}-${student.course}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td><button class="btn btn-danger btn-sm" data-action="delete-student" data-code="${student.accessCode}">Eliminar</button></td>
                </tr>
            `;
        });
        
        if (students.length > 50) {
            html += `
                <tr>
                    <td colspan="4" style="text-align: center; color: #666;">
                        ... y ${students.length - 50} más
                    </td>
                </tr>
            `;
        }
        
        tbody.innerHTML = html || '<tr><td colspan="4" style="text-align: center;">No hay códigos generados</td></tr>';
    },
    
    /**
     * Carga la configuración
     */
    loadSettings: async function() {
        let config;
        
        if (!window.isDemoMode) {
            config = await FirebaseAPI.getConfig();
        } else {
            config = LocalStorage.getConfig();
        }
        
        if (config) {
            const title = document.getElementById('election-title-main');
            const schoolInput = document.getElementById('school-name');
            const titleInput = document.getElementById('election-title');
            const votingTitle = document.getElementById('voting-title-text');
            
            if (title && config.electionTitle) title.textContent = config.electionTitle;
            if (schoolInput) schoolInput.value = config.schoolName || '';
            if (titleInput) titleInput.value = config.electionTitle || '';
            if (votingTitle) votingTitle.textContent = config.electionTitle || 'Elección de Personero';
        }
    },
    
    /**
     * Guarda la configuración
     */
    saveSettings: async function() {
        const updates = {
            schoolName: document.getElementById('school-name').value,
            electionTitle: document.getElementById('election-title').value
        };
        
        const newPassword = document.getElementById('new-admin-password').value;
        if (newPassword) {
            LocalStorage.changeAdminCode(newPassword);
        }
        
        try {
            if (!window.isDemoMode) {
                await FirebaseAPI.updateConfig(updates);
            } else {
                LocalStorage.updateConfig(updates);
            }
            
            // Actualizar títulos
            this.loadSettings();
            
            this.showNotification('Configuración guardada', 'success');
        } catch (error) {
            this.showNotification('Error al guardar', 'error');
        }
    },
    
    /**
     * Maneja la subida del logo
     */
    handleLogoUpload: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('logo-preview').innerHTML = `
                <img src="${e.target.result}" alt="Logo" style="max-width: 150px; border-radius: 8px;">
            `;
        };
        reader.readAsDataURL(file);
    },
    
    /**
     * Maneja la subida de foto de candidato
     */
    handleCandidatePhotoUpload: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('photo-preview').innerHTML = `
                <img src="${e.target.result}" alt="Foto" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
            `;
        };
        reader.readAsDataURL(file);
    },
    
    /**
     * Carga los reportes
     */
    loadReports: async function() {
        const preview = document.getElementById('live-results-preview');
        if (!preview) return;
        
        let stats;
        
        if (!window.isDemoMode) {
            stats = await FirebaseAPI.getStats();
        } else {
            stats = LocalStorage.getStats();
        }
        
        Charts.createPublicResults('live-results-preview', stats.candidates || []);
    },
    
    /**
     * Confirma reinicio de votación
     */
    confirmResetVotes: function() {
        if (!confirm('¿Estás seguro de reiniciar la votación?\n\nEsto:\n- Eliminará todos los votos emitidos\n- Reseteará los contadores de candidatos\n- Marcará todos los códigos como no utilizados\n\nEsta acción no se puede deshacer.')) {
            return;
        }
        
        if (!confirm('¿REALMENTE desea continuar?')) return;
        
        this.resetVoting();
    },
    
    /**
     * Reinicia la votación
     */
    resetVoting: async function() {
        try {
            if (!window.isDemoMode) {
                await fetch('/api/admin/reset-votes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminCode: this.adminCode || 'ADMIN2026', confirm: true })
                });
            } else {
                LocalStorage.resetVoting();
            }
            
            await Charts.updateDashboard();
            this.loadStudentsCodes();
            this.updateSummaryStats();
            
            this.showNotification('Votación reiniciada correctamente', 'success');
        } catch (error) {
            this.showNotification('Error al reiniciar', 'error');
        }
    },
    
    /**
     * Exporta datos a CSV
     */
    exportCSV: async function() {
        try {
            let stats;
            
            if (!window.isDemoMode) {
                const response = await fetch('/api/admin/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                stats = data;
            } else {
                stats = LocalStorage.exportData();
            }
            
            // Generar CSV
            let csv = 'CÓDIGO,ESTUDIANTE,GRADO,CURSO,VOTÓ,FECHA VOTO\n';
            
            const studentsList = Array.isArray(stats.students)
                ? stats.students
                : Object.values(stats.students || {});

            studentsList.forEach(student => {
                csv += `${student.accessCode},,${student.grade},${student.course},${student.hasVoted ? 'Sí' : 'No'},${student.votedAt || ''}\n`;
            });
            
            // Descargar
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `votacion_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            this.showNotification('Datos exportados', 'success');
        } catch (error) {
            this.showNotification('Error al exportar', 'error');
        }
    },
    
    /**
     * Muestra el monitor en vivo
     */
    showLiveMonitor: function() {
        App.showScreen('view-results');
    },
    
    /**
     * Obtiene el nombre del grado
     */
    getGradeName: function(grade) {
        const names = {
            6: 'Sexto', 7: 'Séptimo', 8: 'Octavo',
            9: 'Noveno', 10: 'Décimo', 11: 'Undécimo'
        };
        return names[grade] || 'Grado ' + grade;
    },
    
    /**
     * Alterna estado de votación
     */
    toggleVotingStatus: async function() {
        const btn = document.getElementById('btn-close-voting');
        const isClosing = btn.textContent.includes('Cerrar');
        
        try {
            if (!window.isDemoMode) {
                await FirebaseAPI.updateConfig({
                    electionStatus: isClosing ? 'closed' : 'active'
                });
            } else {
                LocalStorage.updateConfig({
                    electionStatus: isClosing ? 'closed' : 'active'
                });
            }
            
            btn.textContent = isClosing ? 'Abrir Votación' : 'Cerrar Votación';
            btn.className = isClosing ? 'btn btn-success' : 'btn btn-warning';
            
            this.showNotification(
                isClosing ? 'Votación cerrada' : 'Votación abierta', 
                'success'
            );
        } catch (error) {
            this.showNotification('Error al cambiar estado', 'error');
        }
    },
    
    /**
     * Descarga la plantilla de Excel
     */
    downloadTemplate: function() {
        // Crear datos de ejemplo para la plantilla
        const templateData = [
            { Nombre: 'Juan Pérez', Grado: 6, Curso: 1 },
            { Nombre: 'María García', Grado: 6, Curso: 1 },
            { Nombre: 'Carlos López', Grado: 7, Curso: 2 },
            { Nombre: 'Ana Martínez', Grado: 10, Curso: 1 },
            { Nombre: 'Pedro Rodríguez', Grado: 11, Curso: 3 }
        ];
        
        // Crear worksheet
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes');
        
        // Descargar archivo
        XLSX.writeFile(wb, 'plantilla_estudiantes_votacion.xlsx');
        
        this.showNotification('Plantilla descargada', 'success');
    },
    
    /**
     * Importa estudiantes desde archivo Excel
     */
    importExcel: async function() {
        const fileInput = document.getElementById('excel-file');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showNotification('Por favor selecciona un archivo', 'error');
            return;
        }
        
        // Validar extensión
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));
        
        if (!isValid) {
            this.showNotification('El archivo debe ser .xlsx, .xls o .csv', 'error');
            return;
        }
        
        
        // Si estás en modo DEMO (sin Firebase configurado), importa SIEMPRE en el navegador
        // para que los estudiantes queden en LocalStorage (el servidor demo no comparte estado con el navegador).
        if (window.isDemoMode) {
            const progressDiv = document.getElementById('import-progress');
            const progressFill = document.getElementById('import-progress-fill');
            const statusText = document.getElementById('import-status');
            const resultDiv = document.getElementById('import-result');

            progressDiv.style.display = 'block';
            resultDiv.style.display = 'none';
            progressFill.style.width = '0%';
            statusText.textContent = 'Importando en el navegador...';

            try {
                const result = await this.importExcelClientSide(file, (pct, msg) => {
                    progressFill.style.width = `${pct}%`;
                    if (msg) statusText.textContent = msg;
                });

                progressFill.style.width = '100%';
                statusText.textContent = `Importados: ${result.imported} estudiantes`;

                setTimeout(() => {
                    progressDiv.style.display = 'none';
                    resultDiv.style.display = 'block';

                    let html = `<div class="import-result success">`;
                    html += `<strong>✅ Importación exitosa</strong>`;
                    html += `<p>Estudiantes importados: ${result.imported}</p>`;

                    if (result.errors && result.errors.length > 0) {
                        html += `<p>Errores (${result.errors.length}):</p>`;
                        html += `<ul>`;
                        result.errors.forEach(err => { html += `<li>${err}</li>`; });
                        html += `</ul>`;
                    }

                    html += `</div>`;
                    resultDiv.innerHTML = html;

                    this.loadStudentsCodes().then(() => this.updateSummaryStats()).catch((e) => {
                        console.warn('Error recargando estudiantes luego de importar (demo):', e);
                    });

                    this.showNotification(`${result.imported} estudiantes importados`, 'success');
                }, 300);

            } catch (error) {
                progressDiv.style.display = 'none';
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = `<div class="import-result error"><strong>❌ Error:</strong> ${error.message}</div>`;
                this.showNotification('Error al importar archivo', 'error');
            }

            return;
        }

        // Mostrar progreso
        const progressDiv = document.getElementById('import-progress');
        const progressFill = document.getElementById('import-progress-fill');
        const statusText = document.getElementById('import-status');
        const resultDiv = document.getElementById('import-result');
        
        progressDiv.style.display = 'block';
        resultDiv.style.display = 'none';
        progressFill.style.width = '0%';
        statusText.textContent = 'Subiendo archivo...';
        
        try {
            const formData = new FormData();
            formData.append('file', file);

            // Intentar importar vía servidor (recomendado si estás corriendo Node/Express)
            let response;
            try {
                response = await fetch('/api/students/import-excel', {
                    method: 'POST',
                    body: formData
                });
            } catch (networkErr) {
                response = null;
            }

            // Si no hay servidor (hosting estático) o falló la petición, hacer importación en el navegador
            if (!response || response.status === 404) {
                statusText.textContent = 'Importando en el navegador...';
                const result = await this.importExcelClientSide(file, (pct, msg) => {
                    progressFill.style.width = `${pct}%`;
                    if (msg) statusText.textContent = msg;
                });

                // Completar UI con el mismo formato que el servidor
                progressFill.style.width = '100%';
                statusText.textContent = `Importados: ${result.imported} estudiantes`;

                setTimeout(() => {
                    progressDiv.style.display = 'none';
                    resultDiv.style.display = 'block';

                    let html = `<div class="import-result success">`;
                    html += `<strong>✅ Importación exitosa</strong>`;
                    html += `<p>Estudiantes importados: ${result.imported}</p>`;

                    if (result.errors && result.errors.length > 0) {
                        html += `<p>Errores (${result.errors.length}):</p>`;
                        html += `<ul>`;
                        result.errors.forEach(err => {
                            html += `<li>${err}</li>`;
                        });
                        html += `</ul>`;
                    }

                    html += `</div>`;
                    resultDiv.innerHTML = html;

                    // Recargar datos. Ojo: si una promesa rechaza dentro de setTimeout,
                    // el manejador global de errores muestra la pantalla "Error de Conexión".
                    // Por eso encapsulamos en catch.
                    this.loadStudentsCodes().then(() => {
                        this.updateSummaryStats();
                    }).catch((e) => {
                        console.warn('Error recargando estudiantes luego de importar:', e);
                    });
                    this.showNotification(`${result.imported} estudiantes importados`, 'success');
                }, 500);

                return; // salir: ya manejamos el flujo
            }

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                // Mostrar detalles si el servidor los provee
                const details = Array.isArray(result.details) ? result.details : (Array.isArray(result.errors) ? result.errors : null);
                const msg = result.error || result.message || 'Error al importar';
                if (details && details.length) {
                    throw new Error(`${msg}\n${details.slice(0, 10).join('\n')}${details.length > 10 ? `\n... y ${details.length - 10} más` : ''}`);
                }
                throw new Error(msg);
            }
            
            // Mostrar progreso completo
            progressFill.style.width = '100%';
            statusText.textContent = `Importados: ${result.imported} estudiantes`;
            
            // Mostrar resultados
            setTimeout(() => {
                progressDiv.style.display = 'none';
                resultDiv.style.display = 'block';
                
                let html = `<div class="import-result success">`;
                html += `<strong>✅ Importación exitosa</strong>`;
                html += `<p>Estudiantes importados: ${result.imported}</p>`;
                
                if (result.errors && result.errors.length > 0) {
                    html += `<p>Errores (${result.errors.length}):</p>`;
                    html += `<ul>`;
                    result.errors.forEach(err => {
                        html += `<li>${err}</li>`;
                    });
                    html += `</ul>`;
                }
                
                html += `</div>`;
                resultDiv.innerHTML = html;
                
                // Recargar datos (proteger contra unhandled rejection)
                this.loadStudentsCodes().then(() => this.updateSummaryStats()).catch((e) => {
                    console.warn('Error recargando estudiantes luego de importar:', e);
                });
                
                this.showNotification(`${result.imported} estudiantes importados`, 'success');
            }, 500);
            
        } catch (error) {
            progressDiv.style.display = 'none';
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `<div class="import-result error"><strong>❌ Error:</strong> ${error.message}</div>`;
            this.showNotification('Error al importar archivo', 'error');
        }
    },


/**
 * Importa estudiantes desde Excel directamente en el navegador (fallback para hosting estático)
 * @param {File} file
 * @param {(pct:number, msg?:string)=>void} onProgress
 */
importExcelClientSide: async function(file, onProgress) {
    const errors = [];
    let imported = 0;

    if (typeof XLSX === 'undefined') {
        throw new Error('No se encontró la librería XLSX en el navegador');
    }

    onProgress && onProgress(5, 'Leyendo archivo...');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
        throw new Error('El archivo está vacío o no tiene datos válidos');
    }

    // Obtener estudiantes existentes para evitar colisiones de código
    onProgress && onProgress(10, 'Validando y preparando...');
    const existing = window.isDemoMode ? LocalStorage.getStudents() : await FirebaseAPI.getStudents();
    const existingCodes = new Set(existing.map(s => String(s.accessCode)));

    const studentsToImport = [];
    const payloadToSend = [];
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const name = row.Nombre || row.nombre || row.Name || row.name || row.Estudiante || row.estudiante;
        const grade = row.Grado || row.grado || row.Grade || row.grade;
        const course = row.Curso || row.curso || row.Course || row.course || row.Grupo || row.grupo;

        if (!name || !grade || !course) {
            errors.push(`Fila ${i + 1}: Faltan datos requeridos (nombre, grado, curso)`);
            continue;
        }

        const gradeNum = parseInt(grade);
        const courseNum = parseInt(course);
        if (isNaN(gradeNum) || isNaN(courseNum)) {
            errors.push(`Fila ${i + 1}: Grado y curso deben ser números`);
            continue;
        }
        if (gradeNum <= 0 || courseNum <= 0) {
            errors.push(`Fila ${i + 1}: Grado y curso deben ser mayores que 0`);
            continue;
        }

        const listNumberRaw = row.Lista || row.lista || row['N°'] || row['No'] || row['Numero'] || row['Número'] || row['numero'] || row['número'] || row['#'] || row['Lista #'] || row['lista #'];
        const listNumber = listNumberRaw != null && listNumberRaw !== '' ? parseInt(listNumberRaw) : null;

        studentsToImport.push({
            name: String(name).trim(),
            grade: gradeNum,
            course: courseNum,
            listNumber: (!isNaN(listNumber) && listNumber > 0) ? listNumber : null
        });
    }

    if (studentsToImport.length === 0) {
        return { success: false, imported: 0, errors };
    }

    // Generar códigos con formato: <grado><curso><númeroLista 2 dígitos>
const buildCode = (g, c, n) => {
    const prefix = `${g}${c}`;
    const suffix = String(n).padStart(2, '0');
    return `${prefix}${suffix}`;
};

// Determinar el siguiente número de lista por grado/curso (desde existentes)
const nextByGroup = new Map();
const computeNext = (g, c) => {
    const key = `${g}-${c}`;
    if (nextByGroup.has(key)) return nextByGroup.get(key);

    const prefix = `${g}${c}`;
    let maxList = 0;
    for (const s of existing) {
        if (parseInt(s.grade) !== g || parseInt(s.course) !== c) continue;

        const ln = parseInt(s.listNumber);
        if (!isNaN(ln) && ln > maxList) { maxList = ln; continue; }

        const code = String(s.accessCode || '');
        if (code.startsWith(prefix)) {
            const rest = parseInt(code.slice(prefix.length));
            if (!isNaN(rest) && rest > maxList) maxList = rest;
        }
    }

    nextByGroup.set(key, maxList + 1);
    return maxList + 1;
};

for (let idx = 0; idx < studentsToImport.length; idx++) {
    const student = studentsToImport[idx];

    // Si el Excel trae número de lista, se usa; si no, se asigna secuencial
    const key = `${student.grade}-${student.course}`;
    let listNum = student.listNumber;
    if (!listNum) {
        listNum = computeNext(student.grade, student.course);
        nextByGroup.set(key, listNum + 1);
    }

    let code = buildCode(student.grade, student.course, listNum);

    // Evitar colisiones de códigos
    let attempts = 0;
    while (existingCodes.has(code) && attempts < 300) {
        listNum++;
        code = buildCode(student.grade, student.course, listNum);
        attempts++;
    }
    if (attempts >= 300) {
        errors.push(`No se pudo generar código único para: ${student.name}`);
        continue;
    }

    // En modo Internet (servidor), enviamos en lote al final (más rápido)
    if (window.isDemoMode) {
        try {
            LocalStorage.saveStudent({
                name: student.name,
                grade: student.grade,
                course: student.course,
                listNumber: listNum,
                accessCode: code
            });
            imported++;
        } catch (e) {
            errors.push(`Error importando ${student.name}: ${e.message || e}`);
        }
    } else {
        payloadToSend.push({
            name: student.name,
            grade: student.grade,
            course: student.course,
            listNumber: listNum,
            accessCode: code
        });
    }

    existingCodes.add(code);

    const pct = 10 + Math.round(((idx + 1) / studentsToImport.length) * 85);
    onProgress && onProgress(pct);
}


    if (!window.isDemoMode) {
        onProgress && onProgress(97, 'Guardando en servidor...');
        try {
            const res = await fetch('/api/students/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ students: payloadToSend })
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(out.error || 'Error guardando estudiantes');
            }
            imported = out.imported != null ? out.imported : payloadToSend.length;
            if (out.details && Array.isArray(out.details)) {
                out.details.forEach(d => {
                    errors.push(`Fila ${d.row}: ${d.reason}`);
                });
            }
        } catch (e) {
            errors.push(e.message || String(e));
        }
    }

return { success: true, imported, errors };
},
    
    /**
     * Muestra notificación
     */
    showNotification: function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});

// Exportar para uso global
window.Admin = Admin;
