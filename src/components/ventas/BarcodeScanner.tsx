import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanning = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      // Detener el escáner si está activo
      if (scannerRef.current && isScanning.current) {
        scannerRef.current.stop().then(() => {
          scannerRef.current = null;
          isScanning.current = false;
        }).catch((err) => {
          console.error('Error stopping scanner:', err);
        });
      }
      return;
    }

    // Iniciar el escáner
    const startScanner = async () => {
      try {
        // Crear instancia del escáner
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        // Configuración del escáner
        const config = {
          fps: 10, // Frames por segundo
          qrbox: { width: 250, height: 250 }, // Área de escaneo
          aspectRatio: 1.0,
        };

        // Iniciar escaneo con cámara trasera si es posible
        await scanner.start(
          { facingMode: 'environment' }, // Cámara trasera
          config,
          (decodedText) => {
            // Código escaneado exitosamente
            console.log('Barcode detected:', decodedText);
            onScan(decodedText);

            // Detener escáner
            if (scannerRef.current && isScanning.current) {
              scannerRef.current.stop().catch(console.error);
              isScanning.current = false;
            }
          },
          (errorMessage) => {
            // Error de escaneo (normal, ocurre constantemente mientras busca)
            // No hacer nada
          }
        );

        isScanning.current = true;
      } catch (err) {
        console.error('Error starting scanner:', err);
        alert('No se pudo acceder a la cámara. Por favor verifica los permisos.');
        onClose();
      }
    };

    startScanner();

    // Cleanup al desmontar
    return () => {
      if (scannerRef.current && isScanning.current) {
        scannerRef.current.stop().catch(console.error);
        isScanning.current = false;
      }
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Escanear Código de Barras</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="p-4">
          <div id="qr-reader" className="w-full"></div>
          <p className="text-sm text-gray-600 mt-4 text-center">
            Apunta la cámara al código de barras del producto
          </p>
        </div>
      </div>
    </div>
  );
};
