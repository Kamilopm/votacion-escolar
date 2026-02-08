/**
 * Sistema de Votación Escolar - Escáner de Códigos QR
 * Maneja el escaneo de códigos QR usando html5-qrcode
 */

const QRScanner = {
    html5QrCode: null,
    isScanning: false,
    
    /**
     * Inicia el escáner QR
     */
    start: async function() {
        const scannerContainer = document.getElementById('qr-scanner-container');
        const qrReader = document.getElementById('qr-reader');
        
        if (!scannerContainer || !qrReader) {
            console.error('Elementos del escáner no encontrados');
            return;
        }
        
        // Verificar permisos de cámara
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            // Si llegamos aquí, tenemos permiso
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            alert('Se requiere permiso de cámara para escanear códigos QR. Por favor, habilita el acceso a la cámara.');
            return;
        }
        
        // Mostrar contenedor del escáner
        scannerContainer.style.display = 'flex';
        this.isScanning = true;
        
        // Inicializar html5-qrcode
        this.html5QrCode = new Html5Qrcode("qr-reader");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false,
            verbose: false
        };
        
        // Preferir cámara trasera
        const cameras = await Html5Qrcode.getCameras();
        const rearCamera = cameras.find(cam => 
            cam.label.toLowerCase().includes('back') || 
            cam.label.toLowerCase().includes('rear') ||
            cam.label.toLowerCase().includes('trasera')
        );
        
        const cameraId = rearCamera ? rearCamera.id : (cameras[0] ? cameras[0].id : null);
        
        if (!cameraId) {
            this.stop();
            alert('No se encontró una cámara disponible');
            return;
        }
        
        try {
            await this.html5QrCode.start(
                cameraId,
                config,
                (decodedText, decodedResult) => {
                    // Código QR detectado
                    this.onScanSuccess(decodedText, decodedResult);
                },
                (errorMessage) => {
                    // Error de escaneo (normal, se ignora)
                }
            );
        } catch (error) {
            console.error('Error iniciando escáner:', error);
            this.stop();
            alert('Error al iniciar la cámara. Por favor, intenta de nuevo.');
        }
    },
    
    /**
     * Detiene el escáner
     */
    stop: function() {
        const scannerContainer = document.getElementById('qr-scanner-container');
        
        if (this.html5QrCode && this.isScanning) {
            this.html5QrCode.stop().then(() => {
                this.html5QrCode.clear();
                this.isScanning = false;
                scannerContainer.style.display = 'none';
            }).catch(error => {
                console.error('Error deteniendo escáner:', error);
                this.isScanning = false;
                scannerContainer.style.display = 'none';
            });
        } else {
            scannerContainer.style.display = 'none';
        }
    },
    
    /**
     * Se llama cuando se escanea exitosamente un código QR
     */
    onScanSuccess: async function(decodedText, decodedResult) {
        // Reproducir sonido de éxito
        this.playBeep();
        
        // Detener escáner
        this.stop();
        
        try {
            // Parsear datos del QR
            const qrData = JSON.parse(decodedText);
            
            // Validar estructura del QR
            if (!qrData.accessCode) {
                throw new Error('Código QR inválido');
            }
            
            // Verificar el código con el servidor
            const isValid = await Voting.verifyCode(qrData.accessCode);
            
            if (isValid) {
                // El código es válido, proceder con el voto
                document.getElementById('student-code').value = qrData.accessCode;
                Voting.login(qrData.accessCode);
            }
            
        } catch (error) {
            console.error('Error procesando QR:', error);
            alert('Código QR no reconocido. Por favor, intenta de nuevo o ingresa el código manualmente.');
        }
    },
    
    /**
     * Reproduce un sonido de beep al escanear
     */
    playBeep: function() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 1000;
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            
            setTimeout(() => {
                oscillator.stop();
            }, 100);
        } catch (error) {
            // Si falla el audio, simplemente continuar
        }
    }
};

// Exportar para uso global
window.QRScanner = QRScanner;
