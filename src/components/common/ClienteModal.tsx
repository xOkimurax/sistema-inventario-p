import { useState, useEffect, useRef } from 'react';
import { X, Search, UserPlus, Phone, User } from 'lucide-react';
import { Cliente } from '../../types';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface ClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCliente: (cliente: Cliente) => void;
  title?: string;
}

export function ClienteModal({ isOpen, onClose, onSelectCliente, title = 'Seleccionar Cliente' }: ClienteModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNuevoForm, setShowNuevoForm] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Nuevo cliente form
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    telefono: '',
    notas: ''
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const nombreInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Cargar clientes
  useEffect(() => {
    if (isOpen) {
      loadClientes();
      setSearchTerm('');
      setShowNuevoForm(false);
      setNuevoCliente({ nombre: '', telefono: '', notas: '' });
      setSelectedIndex(0);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadClientes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('is_active', true)
        .order('nombre');

      if (error) throw error;
      setClientes(data || []);
      setFilteredClientes(data || []);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar clientes por búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      // No mostrar resultados hasta que el usuario escriba algo
      setFilteredClientes([]);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = clientes.filter(
        (c) =>
          c.nombre.toLowerCase().includes(term) ||
          c.telefono.toLowerCase().includes(term)
      );
      setFilteredClientes(filtered);
    }
    setSelectedIndex(0);
  }, [searchTerm, clientes]);

  // Navegación por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (showNuevoForm) {
        // En el formulario de nuevo cliente
        if (e.key === 'Escape') {
          setShowNuevoForm(false);
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
      } else {
        // En la lista de clientes
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredClientes.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && filteredClientes.length > 0) {
          e.preventDefault();
          handleSelectCliente(filteredClientes[selectedIndex]);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showNuevoForm, filteredClientes, selectedIndex]);

  // Auto-scroll al item seleccionado
  useEffect(() => {
    const selectedElement = document.getElementById(`cliente-${selectedIndex}`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleSelectCliente = (cliente: Cliente) => {
    onSelectCliente(cliente);
    onClose();
  };

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nuevoCliente.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (!nuevoCliente.telefono.trim()) {
      toast.error('El teléfono es requerido');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([
          {
            nombre: nuevoCliente.nombre.trim(),
            telefono: nuevoCliente.telefono.trim(),
            notas: nuevoCliente.notas.trim() || null,
            is_active: true
          }
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success('Cliente creado exitosamente');
      onSelectCliente(data);
      onClose();
    } catch (error) {
      console.error('Error al crear cliente:', error);
      toast.error('Error al crear cliente');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!showNuevoForm ? (
            <>
              {/* Búsqueda */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o teléfono..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Botón nuevo cliente */}
              <button
                onClick={() => {
                  setShowNuevoForm(true);
                  setTimeout(() => nombreInputRef.current?.focus(), 100);
                }}
                className="w-full mb-4 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
              >
                <UserPlus className="w-5 h-5" />
                <span className="font-medium">Nuevo Cliente</span>
              </button>

              {/* Lista de clientes */}
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Cargando clientes...
                </div>
              ) : filteredClientes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No se encontraron clientes' : 'Escribe para buscar clientes...'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredClientes.map((cliente, index) => (
                    <button
                      key={cliente.id}
                      id={`cliente-${index}`}
                      onClick={() => handleSelectCliente(cliente)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        index === selectedIndex
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {cliente.nombre}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                            <Phone className="w-4 h-4" />
                            <span>{cliente.telefono}</span>
                          </div>
                          {cliente.notas && (
                            <p className="text-sm text-gray-500 mt-1 truncate">
                              {cliente.notas}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Ayuda de teclado */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
                <p><kbd className="px-2 py-1 bg-white border rounded">↑↓</kbd> Navegar</p>
                <p><kbd className="px-2 py-1 bg-white border rounded">Enter</kbd> Seleccionar</p>
                <p><kbd className="px-2 py-1 bg-white border rounded">Esc</kbd> Cerrar</p>
              </div>
            </>
          ) : (
            <>
              {/* Formulario nuevo cliente */}
              <form onSubmit={handleCrearCliente} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={nombreInputRef}
                    type="text"
                    value={nuevoCliente.nombre}
                    onChange={(e) =>
                      setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nombre completo del cliente"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={nuevoCliente.telefono}
                    onChange={(e) =>
                      setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Número de teléfono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={nuevoCliente.notas}
                    onChange={(e) =>
                      setNuevoCliente({ ...nuevoCliente, notas: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Información adicional del cliente"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNuevoForm(false);
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Creando...' : 'Crear Cliente'}
                  </button>
                </div>
              </form>

              {/* Ayuda de teclado */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <p><kbd className="px-2 py-1 bg-white border rounded">Esc</kbd> Volver a la búsqueda</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
