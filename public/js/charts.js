/**
 * Sistema de Votación Escolar - Gráficos y Visualización
 * Genera gráficos interactivos para estadísticas en tiempo real
 */

const Charts = {
    // Colores para los gráficos
    COLORS: [
        '#1a5f2a', '#2d7a42', '#3498db', '#e74c3c', 
        '#f39c12', '#9b59b6', '#1abc9c', '#e67e22',
        '#34495e', '#16a085', '#c0392b', '#27ae60'
    ],
    
    /**
     * Genera un gráfico de barras horizontales
     */
    createBarChart: function(containerId, data, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const {
            labelKey = 'label',
            valueKey = 'value',
            showValues = true,
            animate = true
        } = options;
        
        const maxValue = Math.max(...data.map(d => d[valueKey]), 1);
        
        let html = '<div class="bar-chart">';
        
        data.forEach((item, index) => {
            const percentage = maxValue > 0 ? (item[valueKey] / maxValue) * 100 : 0;
            const barColor = this.COLORS[index % this.COLORS.length];
            const displayValue = typeof item[valueKey] === 'number' 
                ? item[valueKey].toLocaleString() 
                : item[valueKey];
            
            html += `
                <div class="bar-item">
                    <span class="bar-label">${item[labelKey]}</span>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${percentage}%; background: ${barColor}">
                            ${showValues ? `<span class="bar-value">${displayValue}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    /**
     * Genera gráfico de participación por grado
     */
    createParticipationChart: function(containerId, gradeData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Mostrar solo los grados cargados (no asumir 6-11)
        const grades = Object.keys(gradeData || {})
            .map(g => parseInt(g))
            .filter(g => !isNaN(g))
            .sort((a, b) => a - b);

        // Si todavía no hay datos, mostrar estado vacío
        if (!grades.length) {
            container.innerHTML = `
                <div style="text-align:center; padding:20px; color:#666;">
                    <p>No hay datos de participación por grado</p>
                </div>
            `;
            return;
        }

        const gradeNames = {
            6: 'Sexto', 7: 'Séptimo', 8: 'Octavo',
            9: 'Noveno', 10: 'Décimo', 11: 'Undécimo'
        };
        
        let html = '<div class="bar-chart">';
        
        grades.forEach(grade => {
            const data = gradeData[grade] || { total: 0, voted: 0 };
            const percentage = data.total > 0 ? (data.voted / data.total) * 100 : 0;
            const barColor = '#27ae60';
            
            html += `
                <div class="bar-item">
                    <span class="bar-label">${gradeNames[grade] || ('Grado ' + grade)}</span>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${percentage}%; background: ${barColor}">
                            <span class="bar-value">${data.voted}/${data.total}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    /**
     * Genera visualización de resultados para pantalla pública
     */
    createPublicResults: function(containerId, candidates) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const sortedCandidates = [...candidates].sort((a, b) => b.voteCount - a.voteCount);
        const totalVotes = sortedCandidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);
        
        if (sortedCandidates.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <p style="font-size: 18px;">No hay candidatos registrados</p>
                    <p style="font-size: 14px;">Los resultados se mostrarán aquí cuando haya candidatos</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        sortedCandidates.forEach((candidate, index) => {
            const votes = candidate.voteCount || 0;
            const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
            const isWinner = index === 0 && totalVotes > 0;
            
            html += `
                <div class="public-candidate-result ${isWinner ? 'winner' : ''}">
                    <img src="${candidate.photo || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22><rect fill=%22%23ddd%22 width=%2260%22 height=%2260%22/><text fill=%22%23999%22 x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2224%22>👤</text></svg>'}" 
                         alt="${candidate.name}"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22><rect fill=%22%23ddd%22 width=%2260%22 height=%2260%22/><text fill=%22%23999%22 x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2224%22>👤</text></svg>'">
                    <div class="info">
                        <p class="name">${candidate.name} ${isWinner ? '🎉' : ''}</p>
                        <p class="votes">${votes} votos</p>
                    </div>
                    <div class="percentage">
                        ${percentage}%
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },
    
    /**
     * Actualiza los gráficos del dashboard
     */
    updateDashboard: async function() {
        try {
            // Intentar obtener datos de Firebase primero
            if (!window.isDemoMode) {
                const stats = await FirebaseAPI.getStats();
                
                // Actualizar estadísticas
                document.getElementById('stat-total-students').textContent = stats.totalStudents || 0;
                document.getElementById('stat-total-votes').textContent = stats.totalVotes || 0;
                document.getElementById('stat-participation').textContent = (stats.participation || 0) + '%';
                document.getElementById('stat-total-candidates').textContent = stats.totalCandidates || 0;
                
                // Gráfico de candidatos
                const candidateData = (stats.candidates || []).map(c => ({
                    label: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
                    value: c.voteCount || 0
                }));
                
                this.createBarChart('results-chart', candidateData, {
                    labelKey: 'label',
                    valueKey: 'value',
                    showValues: true
                });
                
                // Gráfico de participación
                this.createParticipationChart('participation-chart', stats.participationByGrade || {});
                
                return stats;
            }
        } catch (error) {
            console.error('Error actualizando dashboard:', error);
        }
        
        // Fallback a localStorage
        const stats = LocalStorage.getStats();
        
        document.getElementById('stat-total-students').textContent = stats.totalStudents || 0;
        document.getElementById('stat-total-votes').textContent = stats.totalVotes || 0;
        document.getElementById('stat-participation').textContent = (stats.participation || 0) + '%';
        document.getElementById('stat-total-candidates').textContent = stats.totalCandidates || 0;
        
        const candidateData = (stats.candidates || []).map(c => ({
            label: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
            value: c.voteCount || 0
        }));
        
        this.createBarChart('results-chart', candidateData, {
            labelKey: 'label',
            valueKey: 'value',
            showValues: true
        });
        
        this.createParticipationChart('participation-chart', stats.participationByGrade || {});
        
        return stats;
    },
    
    /**
     * Actualiza resultados públicos
     */
    updatePublicResults: async function() {
        try {
            let stats;
            
            if (!window.isDemoMode) {
                stats = await FirebaseAPI.getStats();
            } else {
                stats = LocalStorage.getStats();
            }
            
            // Actualizar contadores
            const totalVotesEl = document.getElementById('public-total-votes');
            const participationEl = document.getElementById('public-participation');
            
            if (totalVotesEl) totalVotesEl.textContent = stats.totalVotes || 0;
            if (participationEl) participationEl.textContent = (stats.participation || 0) + '%';
            
            // Actualizar lista de candidatos
            const publicResultsEl = document.getElementById('public-results');
            if (publicResultsEl) {
                this.createPublicResults('public-results', stats.candidates || []);
            }
            
        } catch (error) {
            console.error('Error actualizando resultados públicos:', error);
        }
    },
    
    /**
     * Inicializa listener en tiempo real para el dashboard
     */
    initRealtimeUpdates: function() {
        if (window.isDemoMode || window.isServerMode) {
            // En modo demo, actualizar cada 2 segundos
            setInterval(() => {
                if (document.getElementById('admin-panel').classList.contains('active')) {
                    this.updateDashboard();
                }
                if (document.getElementById('view-results').classList.contains('active')) {
                    this.updatePublicResults();
                }
            }, 2000);
            return;
        }
        
        // En modo Firebase, escuchar cambios en candidatos
        FirebaseAPI.onCandidatesChange(() => {
            if (document.getElementById('admin-panel').classList.contains('active')) {
                this.updateDashboard();
            }
            if (document.getElementById('view-results').classList.contains('active')) {
                this.updatePublicResults();
            }
        });
    }
};

// Exportar para uso global
window.Charts = Charts;
