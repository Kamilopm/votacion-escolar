/**
 * Sistema de Votación Escolar - Generador de PDF
 * Genera carnés de votación y reportes en formato PDF
 */

const PDFGenerator = {
    /**
     * Genera PDF con carnés de estudiantes
     */
    downloadIdCards: async function(grade = 'all') {
        this.showNotification('Generando carnés...', 'info');
        
        try {
            // Obtener estudiantes
            let students;
            
            if (!window.isDemoMode) {
                const response = await fetch('/api/pdf/id-cards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ grade })
                });
                
                if (!response.ok) {
                    throw new Error('Error generando PDF');
                }
                
                const blob = await response.blob();
                this.downloadBlob(blob, `carnes-votacion-${grade}.pdf`);
                return;
            } else {
                // Modo demo - generar HTML imprimible
                students = LocalStorage.getStudents();
                
                if (grade !== 'all') {
                    students = students.filter(s => s.grade === parseInt(grade));
                }
            }
            
            if (students.length === 0) {
                this.showNotification('No hay códigos generados', 'error');
                return;
            }
            
            // Generar HTML para impresión
            this.generateIdCardsHTML(students, grade);
            
        } catch (error) {
            console.error('Error generando carnés:', error);
            this.showNotification('Error al generar carnés', 'error');
        }
    },
    
    /**
     * Genera HTML imprimible para carnés
     */
    generateIdCardsHTML: function(students, grade) {
        const config = LocalStorage.getConfig();
        
        // Organizar por páginas (6 carnés por página A4)
        const cardsPerPage = 6;
        const pages = [];
        
        // Ordenar por grado y curso
        students.sort((a, b) => {
            if (a.grade !== b.grade) return a.grade - b.grade;
            return a.course - b.course;
        });
        
        for (let i = 0; i < students.length; i += cardsPerPage) {
            pages.push(students.slice(i, i + cardsPerPage));
        }
        
        const gradeNames = {
            6: 'Sexto', 7: 'Séptimo', 8: 'Octavo',
            9: 'Noveno', 10: 'Décimo', 11: 'Undécimo'
        };
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${config.electionTitle || 'Carnés de Votación'}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; font-size: 12px; }
                    
                    .print-page {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 15px;
                        padding: 20px;
                        page-break-after: always;
                    }
                    
                    .id-card {
                        border: 2px solid #1a5f2a;
                        border-radius: 10px;
                        padding: 15px;
                        width: 100%;
                        max-width: 400px;
                        background: white;
                    }
                    
                    .card-header {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        border-bottom: 2px solid #1a5f2a;
                        padding-bottom: 8px;
                        margin-bottom: 10px;
                    }
                    
                    .card-title h3 {
                        font-size: 11px;
                        color: #1a5f2a;
                        margin: 0;
                    }
                    
                    .card-title p {
                        font-size: 9px;
                        color: #666;
                        margin: 2px 0 0;
                    }
                    
                    .card-body { text-align: center; }
                    
                    .card-label {
                        font-size: 9px;
                        color: #666;
                        margin-bottom: 5px;
                    }
                    
                    .card-code {
                        font-size: 28px;
                        font-weight: bold;
                        color: #1a5f2a;
                        letter-spacing: 4px;
                        padding: 12px;
                        background: #f5f5f5;
                        border-radius: 6px;
                        display: inline-block;
                        font-family: 'Courier New', monospace;
                    }
                    
                    .card-info {
                        margin-top: 10px;
                        font-size: 10px;
                        color: #666;
                    }
                    
                    .card-footer {
                        margin-top: 10px;
                        padding-top: 8px;
                        border-top: 1px dotted #ccc;
                        text-align: center;
                        font-size: 8px;
                        color: #999;
                    }
                    
                    .no-print {
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        padding: 10px 20px;
                        background: #1a5f2a;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        z-index: 1000;
                    }
                    
                    @media print {
                        .no-print { display: none; }
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <button class="no-print" onclick="window.print()">🖨️ Imprimir</button>
        `;
        
        pages.forEach((pageStudents, pageIndex) => {
            html += `<div class="print-page">`;
            
            pageStudents.forEach((student, index) => {
                const cardNumber = pageIndex * cardsPerPage + index + 1;
                
                html += `
                    <div class="id-card">
                        <div class="card-header">
                            <div class="card-title">
                                <h3>${config.schoolName || 'Colegio'}</h3>
                                <p>${config.electionTitle || 'Elección de Personero'}</p>
                            </div>
                        </div>
                        <div class="card-body">
                            <p class="card-label">CÓDIGO DE VOTACIÓN</p>
                            <p class="card-code">${student.accessCode}</p>
                            <div class="card-info">
                                <p>${gradeNames[student.grade] || 'Grado ' + student.grade} - Curso ${student.course}</p>
                            </div>
                        </div>
                        <div class="card-footer">
                            Carné #${cardNumber} - Este código es personal e intransferible
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        });
        
        html += `</body></html>`;
        
        // Abrir en nueva ventana
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        
        this.showNotification('Carnés generados', 'success');
    },
    
    /**
     * Genera PDF de resultados
     */
    downloadResults: async function() {
        this.showNotification('Generando reporte...', 'info');
        
        try {
            if (!window.isDemoMode) {
                const response = await fetch('/api/pdf/results', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!response.ok) {
                    throw new Error('Error generando PDF');
                }
                
                const blob = await response.blob();
                this.downloadBlob(blob, `resultados-votacion-${new Date().toISOString().split('T')[0]}.pdf`);
                return;
            }
            
            // Modo demo - generar HTML
            this.generateResultsHTML();
            
        } catch (error) {
            console.error('Error generando resultados:', error);
            this.showNotification('Error al generar reporte', 'error');
        }
    },
    
    /**
     * Genera HTML de resultados para impresión
     */
    generateResultsHTML: function() {
        const config = LocalStorage.getConfig();
        const stats = LocalStorage.getStats();
        const gradeNames = {
            6: 'Sexto', 7: 'Séptimo', 8: 'Octavo',
            9: 'Noveno', 10: 'Décimo', 11: 'Undécimo'
        };
        
        const sortedCandidates = [...(stats.candidates || [])].sort((a, b) => b.voteCount - a.voteCount);
        const totalVotes = stats.totalVotes || 0;
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Resultados - ${config.electionTitle}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif; 
                        font-size: 12px; 
                        padding: 40px; 
                        max-width: 800px; 
                        margin: 0 auto;
                    }
                    
                    .report-header {
                        text-align: center;
                        padding-bottom: 20px;
                        border-bottom: 3px solid #1a5f2a;
                        margin-bottom: 30px;
                    }
                    
                    .report-header h1 {
                        color: #1a5f2a;
                        font-size: 24px;
                        margin-bottom: 5px;
                    }
                    
                    .report-header h2 {
                        color: #666;
                        font-size: 16px;
                        font-weight: normal;
                    }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 15px;
                        margin-bottom: 30px;
                    }
                    
                    .stat-box {
                        background: #f5f5f5;
                        padding: 15px;
                        border-radius: 8px;
                        text-align: center;
                    }
                    
                    .stat-box .value {
                        font-size: 28px;
                        font-weight: bold;
                        color: #1a5f2a;
                    }
                    
                    .stat-box .label {
                        font-size: 11px;
                        color: #666;
                        margin-top: 5px;
                    }
                    
                    .results-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    
                    .results-table th,
                    .results-table td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }
                    
                    .results-table th {
                        background: #1a5f2a;
                        color: white;
                    }
                    
                    .results-table tr:nth-child(even) {
                        background: #f9f9f9;
                    }
                    
                    .percentage-bar {
                        width: 100%;
                        height: 20px;
                        background: #e0e0e0;
                        border-radius: 10px;
                        overflow: hidden;
                    }
                    
                    .percentage-fill {
                        height: 100%;
                        background: #1a5f2a;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        padding-right: 8px;
                        color: white;
                        font-size: 10px;
                        font-weight: bold;
                    }
                    
                    .winner-badge {
                        background: #f39c12;
                        color: white;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 10px;
                        margin-left: 5px;
                    }
                    
                    .participation-section {
                        margin: 30px 0;
                    }
                    
                    .grade-row {
                        display: flex;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    
                    .grade-label {
                        width: 100px;
                        font-size: 12px;
                    }
                    
                    .grade-bar-container {
                        flex: 1;
                        height: 24px;
                        background: #e0e0e0;
                        border-radius: 5px;
                        overflow: hidden;
                    }
                    
                    .grade-bar {
                        height: 100%;
                        background: #27ae60;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        padding-right: 8px;
                        color: white;
                        font-size: 11px;
                        font-weight: bold;
                    }
                    
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        text-align: center;
                        color: #666;
                        font-size: 11px;
                    }
                    
                    .no-print {
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        padding: 10px 20px;
                        background: #1a5f2a;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                    
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <button class="no-print" onclick="window.print()">🖨️ Imprimir</button>
                
                <div class="report-header">
                    <h1>${config.schoolName || 'Colegio'}</h1>
                    <h2>${config.electionTitle || 'Elección de Personero Estudiantil'}</h2>
                    <p>${new Date().toLocaleDateString('es-CO', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</p>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="value">${stats.totalStudents || 0}</div>
                        <div class="label">Total Estudiantes</div>
                    </div>
                    <div class="stat-box">
                        <div class="value">${totalVotes}</div>
                        <div class="label">Votos Emitidos</div>
                    </div>
                    <div class="stat-box">
                        <div class="value">${stats.participation || 0}%</div>
                        <div class="label">Participación</div>
                    </div>
                    <div class="stat-box">
                        <div class="value">${stats.totalCandidates || 0}</div>
                        <div class="label">Candidatos</div>
                    </div>
                </div>
                
                <h3>Resultados por Candidato</h3>
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Candidato</th>
                            <th>Grado</th>
                            <th>Votos</th>
                            <th>Porcentaje</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedCandidates.map((c, i) => {
                            const percentage = totalVotes > 0 ? ((c.voteCount || 0) / totalVotes * 100).toFixed(1) : 0;
                            return `
                                <tr class="${i === 0 && totalVotes > 0 ? 'winner' : ''}">
                                    <td>${i + 1}${i === 0 && totalVotes > 0 ? '<span class="winner-badge">GANADOR</span>' : ''}</td>
                                    <td>${c.name}</td>
                                    <td>${gradeNames[c.grade] || 'Grado ' + c.grade}</td>
                                    <td>${c.voteCount || 0}</td>
                                    <td>
                                        <div class="percentage-bar">
                                            <div class="percentage-fill" style="width: ${percentage}%">
                                                ${percentage}%
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                
                <div class="participation-section">
                    <h3>Participación por Grado</h3>
                    ${Object.entries(stats.participationByGrade || {}).map(([grade, data]) => {
                        const percentage = data.total > 0 ? (data.voted / data.total * 100) : 0;
                        return `
                            <div class="grade-row">
                                <span class="grade-label">${gradeNames[grade] || 'Grado ' + grade}</span>
                                <div class="grade-bar-container">
                                    <div class="grade-bar" style="width: ${percentage}%">
                                        ${data.voted}/${data.total} (${percentage.toFixed(0)}%)
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="footer">
                    <p>Reporte generado automáticamente por el Sistema de Votación</p>
                    <p style="margin-top: 20px;">Firma del Presidente de la Comisión: ____________________________</p>
                    <p>Fecha: ____________________________</p>
                </div>
            </body>
            </html>
        `;
        
        const reportWindow = window.open('', '_blank');
        reportWindow.document.write(html);
        reportWindow.document.close();
        
        this.showNotification('Reporte generado', 'success');
    },
    
    /**
     * Descarga un blob como archivo
     */
    downloadBlob: function(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showNotification('PDF descargado', 'success');
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
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};

// Exportar para uso global
window.PDFGenerator = PDFGenerator;
