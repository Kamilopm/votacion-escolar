/**
 * Sistema de Votación Escolar - Aplicación Principal
 * Punto de entrada principal que coordina todos los módulos
 */

const App = {
    /**
     * Inicializa la aplicación
     */
    init: function() {
        console.log('🏫 Inicializando Sistema de Votación Escolar...');
        
        // Configurar navegación de pantallas
        this.setupScreenNavigation();
        
        // Configurar eventos globales
        this.setupGlobalEvents();
        
        // Configurar página de resultados
        this.setupResultsPage();
        
        // Ocultar pantalla de carga
        setTimeout(() => {
            document.getElementById('loading-screen').classList.remove('active');
            document.getElementById('welcome-screen').classList.add('active');
        }, 500);
        
        // Verificar conexión a Firebase
        this.checkConnection();
        
        console.log('✅ Sistema de Votación inicializado');
    },
    
    /**
     * Configura la navegación entre pantallas
     */
    setupScreenNavigation: function() {
        // Los handlers ya están definidos en los onclick de los elementos HTML
    },
    
    /**
     * Muestra una pantalla específica
     */
    showScreen: function(screenId) {
        // Ocultar todas las pantallas
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Mostrar la pantalla solicitada
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            
            // Actualizar resultados si es la pantalla de resultados
            if (screenId === 'view-results') {
                Charts.updatePublicResults();
            }
        }
    },
    
    /**
     * Configura eventos globales
     */
    setupGlobalEvents: function() {
        // Prevenir navegación hacia atrás
        window.addEventListener('beforeunload', (e) => {
            if (Voting.currentStudent) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
        
        // Manejar redimensionamiento
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                // Recalcular layouts si es necesario
            }, 250);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape para cerrar modales
            if (e.key === 'Escape') {
                const modal = document.querySelector('.modal.active');
                if (modal) {
                    Admin.closeCandidateModal();
                }
            }
        });
    },
    
    /**
     * Configura la página de resultados
     */
    setupResultsPage: function() {
        // La página de resultados se actualiza automáticamente
        // cuando se muestra, gracias al watcher en showScreen
    },
    
    /**
     * Verifica el estado de conexión
     */
    checkConnection: function() {
        const statusEl = document.getElementById('connection-status');
        const adminStatusEl = document.getElementById('admin-connection-text');
        
        if (window.isDemoMode) {
            if (statusEl) {
                statusEl.innerHTML = `
                    <span class="status-dot" style="background: #f39c12;"></span>
                    <span class="status-text">Modo Demo</span>
                `;
            }
            if (adminStatusEl) {
                adminStatusEl.textContent = 'Demo';
            }
            console.log('📝 Modo DEMO: Los datos se almacenan localmente');
        } else if (window.isServerMode) {
            if (statusEl) {
                statusEl.innerHTML = `
                    <span class="status-dot"></span>
                    <span class="status-text">Servidor</span>
                `;
            }
            if (adminStatusEl) {
                adminStatusEl.textContent = 'Servidor';
            }
            console.log('🖥️  Modo SERVIDOR: Datos via /api/*');
        } else {
            if (statusEl) {
                statusEl.innerHTML = `
                    <span class="status-dot"></span>
                    <span class="status-text">Conectado</span>
                `;
            }
            console.log('📡 Modo PRODUCCIÓN: Sincronización en tiempo real activa');
        }
    },
    
    /**
     * Maneja errores globales
     */
    handleError: function(error, source) {
        console.error(`Error en ${source}:`, error);
        
        // Mostrar mensaje de error amigable
        const errorTitle = document.getElementById('error-title');
        const errorMessage = document.getElementById('error-message');
        
        if (errorTitle && errorMessage) {
            errorTitle.textContent = 'Error de Conexión';
            errorMessage.textContent = 'Ha ocurrido un error. Por favor, recarga la página e intenta nuevamente.';
            this.showScreen('error-screen');
        }
    }
};

/**
 * Funciones globales de navegación
 */

// Mostrar pantalla específica
function showScreen(screenId) {
    App.showScreen(screenId);
}

// Navegación de voting
function nextVotingStep(step) {
    Voting.goToStep(step);
}

function confirmVote() {
    Voting.confirmVote();
}

function cancelVoting() {
    Voting.cancel();
}

function endVoting() {
    Voting.finish();
}

// Navegación de admin
function logoutAdmin() {
    Admin.logout();
}

// Generación de PDFs
function generateIdCards() {
    PDFGenerator.downloadIdCards();
}

function generateResults() {
    PDFGenerator.downloadResults();
}

// Resetear votación
function resetVoting() {
    Admin.confirmResetVotes();
}

// Generar reporte final
function generateFinalReport() {
    PDFGenerator.downloadResults();
}

// Exportar datos
function exportData() {
    Admin.exportCSV();
}

// Navegación de páginas en códigos
let currentPage = 1;
const itemsPerPage = 20;

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        // Recargar tabla
    }
}

function nextPage() {
    currentPage++;
    // Recargar tabla
}

// Abrir/cerrar modal de candidato
function openCandidateModal(candidateId = null) {
    Admin.openCandidateModal(candidateId);
}

function closeCandidateModal() {
    Admin.closeCandidateModal();
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Manejar errores no capturados
window.addEventListener('error', (event) => {
    App.handleError(event.error, 'Global Error Handler');
});

window.addEventListener('unhandledrejection', (event) => {
    App.handleError(event.reason, 'Unhandled Promise Rejection');
});

// Exportar para uso global
window.App = App;
window.showScreen = showScreen;
window.nextVotingStep = nextVotingStep;
window.confirmVote = confirmVote;
window.cancelVoting = cancelVoting;
window.endVoting = endVoting;
window.logoutAdmin = logoutAdmin;
window.generateIdCards = generateIdCards;
window.generateResults = generateResults;
window.resetVoting = resetVoting;
window.generateFinalReport = generateFinalReport;
window.exportData = exportData;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.openCandidateModal = openCandidateModal;
window.closeCandidateModal = closeCandidateModal;
