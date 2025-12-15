import React, { useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  buttonText?: string;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  type = 'info',
  buttonText = 'Entendido',
  onClose
}) => {
  // Cerrar modal con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <XCircle className="w-16 h-16 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-16 h-16 text-yellow-600" />;
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-600" />;
      default:
        return <Info className="w-16 h-16 text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'error':
        return 'bg-red-50';
      case 'warning':
        return 'bg-yellow-50';
      case 'success':
        return 'bg-green-50';
      default:
        return 'bg-blue-50';
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700';
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fadeIn`}>
        <div className={`flex flex-col items-center text-center mb-6 p-4 rounded-lg ${getBgColor()}`}>
          {getIcon()}
          <h2 className="text-2xl font-bold text-gray-800 mt-4 mb-2">{title}</h2>
          <p className="text-gray-700">{message}</p>
        </div>

        <button
          onClick={onClose}
          className={`w-full px-4 py-3 text-white font-semibold rounded-lg transition ${getButtonClass()}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default AlertModal;
