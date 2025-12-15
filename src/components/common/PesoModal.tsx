import { useState, useEffect } from 'react';
import { Producto } from '../../types';
import { formatGuaranies } from '../../utils/currency';

// Funciones auxiliares para convertir unidades
const convertirAKg = (valor: number, unidad: 'kg' | 'g'): number => {
  return unidad === 'kg' ? valor : valor / 1000;
};

// Función para formatear peso (mostrar sin decimales si es número exacto)
const formatearPeso = (kg: number): string => {
  if (Number.isInteger(kg)) {
    return kg.toString();
  }
  return kg.toFixed(3);
};

interface PesoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pesoEnKg: number) => void;
  producto: Producto;
  initialPeso?: string;
  initialUnidad?: 'kg' | 'g';
  title?: string;
}

export const PesoModal: React.FC<PesoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  producto,
  initialPeso = '',
  initialUnidad = 'kg',
  title
}) => {
  const [pesoIngresado, setPesoIngresado] = useState(initialPeso);
  const [unidadPeso, setUnidadPeso] = useState<'kg' | 'g'>(initialUnidad);

  // Resetear valores cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setPesoIngresado(initialPeso);
      setUnidadPeso(initialUnidad);
    }
  }, [isOpen, initialPeso, initialUnidad]);

  const handleConfirmar = () => {
    const pesoIngresadoNum = parseFloat(pesoIngresado);
    if (isNaN(pesoIngresadoNum) || pesoIngresadoNum <= 0) {
      return;
    }

    // Convertir a kg
    const pesoEnKg = convertirAKg(pesoIngresadoNum, unidadPeso);
    onConfirm(pesoEnKg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmar();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {title || 'Ingresar Peso'}
        </h3>

        <div className="mb-4">
          <p className="text-gray-700 font-medium mb-2">{producto.nombre}</p>
          <p className="text-sm text-gray-500 mb-4">
            Stock disponible: {formatearPeso(producto.stock_kg)} kg ({Math.round(producto.stock_kg * 1000)} g)
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Peso
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step={unidadPeso === 'kg' ? '0.001' : '1'}
              min={unidadPeso === 'kg' ? '0.001' : '1'}
              value={pesoIngresado}
              onChange={(e) => setPesoIngresado(e.target.value)}
              autoFocus
              className="w-56 sm:flex-1 px-3 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={unidadPeso === 'kg' ? '0.000' : '0'}
            />
            <select
              value={unidadPeso}
              onChange={(e) => setUnidadPeso(e.target.value as 'kg' | 'g')}
              className="w-14 sm:w-16 px-1 sm:px-2 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-center text-sm sm:text-base"
            >
              <option value="kg">Kg</option>
              <option value="g">g</option>
            </select>
          </div>
        </div>

        {/* Calculadora en tiempo real */}
        {pesoIngresado && !isNaN(parseFloat(pesoIngresado)) && parseFloat(pesoIngresado) > 0 && (
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 mb-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Precio por kg:</span>
                <span className="font-semibold text-gray-800">
                  {formatGuaranies(producto.precio_venta_kg || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Peso ingresado:</span>
                <span className="font-semibold text-gray-800">
                  {unidadPeso === 'kg'
                    ? formatearPeso(parseFloat(pesoIngresado))
                    : Math.round(parseFloat(pesoIngresado))
                  } {unidadPeso}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Equivalente en kg:</span>
                <span className="font-semibold text-gray-800">
                  {formatearPeso(convertirAKg(parseFloat(pesoIngresado), unidadPeso))} kg
                </span>
              </div>
              <div className="border-t border-indigo-300 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-700">Total:</span>
                  <span className="text-xl font-bold text-indigo-600">
                    {formatGuaranies((producto.precio_venta_kg || 0) * convertirAKg(parseFloat(pesoIngresado), unidadPeso))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!pesoIngresado || isNaN(parseFloat(pesoIngresado)) || parseFloat(pesoIngresado) <= 0}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};