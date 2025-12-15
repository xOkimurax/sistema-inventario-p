import { useState, useEffect } from 'react';
import { X, Search, User, Phone, Edit2, Trash2, Plus, Save } from 'lucide-react';
import { Cliente } from '../../types';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface GestionClientesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClienteUpdated?: () => void;
}

export function GestionClientesModal({ isOpen, onClose, onClienteUpdated }: GestionClientesModalProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNuevoForm, setShowNuevoForm] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [clienteEliminar, setClienteEliminar] = useState<Cliente | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    notas: ''
  });

  // Cargar clientes
  useEffect(() => {
    if (isOpen) {
      loadClientes();
      setSearchTerm('');
      setShowNuevoForm(false);
      setClienteEditando(null);
    }
  }, [isOpen]);

  // Manejo de tecla Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();

        // Prioridad: modal de confirmación de eliminación
        if (showConfirmDelete) {
          setShowConfirmDelete(false);
          setClienteEliminar(null);
        }
        // Segundo: formulario de nuevo/editar cliente
        else if (showNuevoForm) {
          setShowNuevoForm(false);
          setClienteEditando(null);
          setFormData({ nombre: '', telefono: '', notas: '' });
        }
        // Tercero: cerrar el modal principal
        else if (isOpen) {
          onClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, showNuevoForm, showConfirmDelete, onClose]);

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
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar clientes
  const filteredClientes = searchTerm
    ? clientes.filter(
        (c) =>
          c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.telefono.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : clientes;

  const handleNuevoCliente = () => {
    setFormData({ nombre: '', telefono: '', notas: '' });
    setClienteEditando(null);
    setShowNuevoForm(true);
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setFormData({
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      notas: cliente.notas || ''
    });
    setClienteEditando(cliente);
    setShowNuevoForm(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (!formData.telefono.trim()) {
      toast.error('El teléfono es requerido');
      return;
    }

    setLoading(true);
    try {
      if (clienteEditando) {
        // Actualizar cliente existente
        const { error } = await supabase
          .from('clientes')
          .update({
            nombre: formData.nombre.trim(),
            telefono: formData.telefono.trim(),
            notas: formData.notas.trim() || null
          })
          .eq('id', clienteEditando.id);

        if (error) throw error;
        toast.success('Cliente actualizado exitosamente');
      } else {
        // Crear nuevo cliente
        const { error } = await supabase
          .from('clientes')
          .insert([
            {
              nombre: formData.nombre.trim(),
              telefono: formData.telefono.trim(),
              notas: formData.notas.trim() || null,
              is_active: true
            }
          ]);

        if (error) throw error;
        toast.success('Cliente creado exitosamente');
      }

      setShowNuevoForm(false);
      setClienteEditando(null);
      setFormData({ nombre: '', telefono: '', notas: '' });
      await loadClientes();
      onClienteUpdated?.();
    } catch (error) {
      console.error('Error al guardar cliente:', error);
      toast.error('Error al guardar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarClick = async (cliente: Cliente) => {
    // Primero validar si el cliente tiene deudas pendientes
    try {
      const { data: deudas, error } = await supabase
        .from('ventas')
        .select('id, numero_venta, total, monto_pagado')
        .eq('cliente_id', cliente.id)
        .eq('es_fiado', true)
        .eq('fiado_completado', false);

      if (error) throw error;

      if (deudas && deudas.length > 0) {
        const totalDeuda = deudas.reduce((sum, venta) => {
          const montoPagado = venta.monto_pagado || 0;
          return sum + (venta.total - montoPagado);
        }, 0);

        toast.error(
          `No se puede eliminar el cliente "${cliente.nombre}" porque tiene ${deudas.length} deuda(s) pendiente(s) por un total de Gs. ${totalDeuda.toLocaleString('es-PY')}. Primero debes liquidar todas las deudas.`,
          { duration: 6000 }
        );
        return;
      }

      // Si no tiene deudas pendientes, proceder con la confirmación
      setClienteEliminar(cliente);
      setShowConfirmDelete(true);
    } catch (error) {
      console.error('Error validando cliente:', error);
      toast.error('Error al validar el cliente');
    }
  };

  const confirmarEliminar = async () => {
    if (!clienteEliminar) return;

    setLoading(true);
    try {
      // Marcar como inactivo en lugar de eliminar
      const { error } = await supabase
        .from('clientes')
        .update({ is_active: false })
        .eq('id', clienteEliminar.id);

      if (error) throw error;

      toast.success('Cliente eliminado exitosamente');
      setShowConfirmDelete(false);
      setClienteEliminar(null);
      await loadClientes();
      onClienteUpdated?.();
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      toast.error('Error al eliminar cliente');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-semibold">Gestión de Clientes</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!showNuevoForm ? (
            <>
              {/* Búsqueda y botón nuevo */}
              <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o teléfono..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleNuevoCliente}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Cliente
                </button>
              </div>

              {/* Lista de clientes */}
              {loading ? (
                <div className="text-center py-12 text-gray-500">
                  Cargando clientes...
                </div>
              ) : filteredClientes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredClientes.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="p-4 border rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {cliente.nombre}
                            </h3>
                            <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                              <Phone className="w-4 h-4" />
                              <span>{cliente.telefono}</span>
                            </div>
                            {cliente.notas && (
                              <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                                {cliente.notas}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleEditarCliente(cliente)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar cliente"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleEliminarClick(cliente)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Eliminar cliente"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Formulario crear/editar */}
              <form onSubmit={handleGuardar} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nombre completo del cliente"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Número de teléfono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    placeholder="Información adicional del cliente"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNuevoForm(false);
                      setClienteEditando(null);
                      setFormData({ nombre: '', telefono: '', notas: '' });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    disabled={loading}
                  >
                    <Save className="w-5 h-5" />
                    {loading ? 'Guardando...' : clienteEditando ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showConfirmDelete && clienteEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Confirmar Eliminación</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar al cliente <strong>{clienteEliminar.nombre}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmDelete(false);
                  setClienteEliminar(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminar}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
