import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Proveedor } from '../../types';
import { Users, Plus, Edit, Trash2, Phone, Mail, ShoppingBag, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatGuaranies } from '../../utils/currency';
import { ConfirmModal } from '../common/ConfirmModal';

interface CompraHistorial {
  id: string;
  fecha: string;
  numero_compra: string | null;
  total: number;
  tipo: 'compra' | 'producto_nuevo';
  productos: {
    nombre: string;
    tipo: string;
    cantidad: number;
    unidad_medida: string;
    precio_unitario: number;
    subtotal: number;
  }[];
}

interface ProductoAsignado {
  id: string;
  nombre: string;
  tipo: string;
  pesable?: boolean;
  stock_unidades: number;
  stock_paquetes: number;
  stock_kg: number;
  stock_minimo: number;
  precio_compra?: number;
  precio_venta_unidad?: number;
  precio_venta_paquete?: number;
  precio_venta_kg?: number;
  created_at: string;
}

// Función para obtener el stock como texto según el tipo
const getStockTextoProducto = (producto: any) => {
  if (producto.tipo === 'unidad') {
    return `${Math.round(producto.stock_unidades)} unidades`;
  } else if (producto.tipo === 'paquete') {
    return `${producto.stock_paquetes} paquetes`;
  } else {
    return `${producto.stock_kg.toFixed(2)} kg`;
  }
};

// Función para obtener el precio de venta según el tipo
const getPrecioVentaProducto = (producto: any) => {
  if (producto.tipo === 'unidad') {
    return producto.precio_venta_unidad;
  } else if (producto.tipo === 'paquete') {
    return producto.precio_venta_paquete;
  } else {
    return producto.precio_venta_kg;
  }
};

export const Proveedores: React.FC = () => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historialProveedor, setHistorialProveedor] = useState<Proveedor | null>(null);
  const [comprasHistorial, setComprasHistorial] = useState<CompraHistorial[]>([]);
  const [productosAsignados, setProductosAsignados] = useState<ProductoAsignado[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    notas: ''
  });

  useEffect(() => {
    loadProveedores();
  }, []);

  // Cerrar modales con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHistorial) {
          setShowHistorial(false);
          setHistorialProveedor(null);
          setComprasHistorial([]);
          setProductosAsignados([]);
        } else if (showModal) {
          setShowModal(false);
          setEditingProveedor(null);
          setFormData({
            nombre: '',
            telefono: '',
            email: '',
            direccion: '',
            notas: ''
          });
        }
      }
    };

    if (showModal || showHistorial) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showModal, showHistorial]);

  const loadProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .eq('is_active', true)
        .order('nombre');

      if (error) throw error;
      if (data) setProveedores(data);
    } catch (error) {
      console.error('Error cargando proveedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      telefono: '',
      email: '',
      direccion: '',
      notas: ''
    });
    setEditingProveedor(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingProveedor) {
        const { error } = await supabase
          .from('proveedores')
          .update(formData)
          .eq('id', editingProveedor.id);

        if (error) throw error;
        toast.success('Proveedor actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('proveedores')
          .insert({ ...formData, is_active: true });

        if (error) throw error;
        toast.success('Proveedor creado exitosamente');
      }

      setShowModal(false);
      resetForm();
      loadProveedores();
    } catch (error: any) {
      console.error('Error guardando proveedor:', error);
      toast.error(error.message || 'Error al guardar el proveedor');
    }
  };

  const handleEdit = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    setFormData({
      nombre: proveedor.nombre,
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
      direccion: proveedor.direccion || '',
      notas: proveedor.notas || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (proveedor: Proveedor) => {
    // Primero validar si el proveedor tiene productos ligados
    try {
      // Verificar productos donde es proveedor principal
      const { data: productos, error } = await supabase
        .from('productos')
        .select('id, nombre')
        .eq('proveedor_principal_id', proveedor.id);

      if (error) throw error;

      if (productos && productos.length > 0) {
        toast.error(
          `No se puede eliminar el proveedor "${proveedor.nombre}" porque está siendo usado en ${productos.length} producto(s). Primero debes reasignar o eliminar los productos.`,
          { duration: 5000 }
        );
        return;
      }

      // Si no tiene productos, proceder con la confirmación de eliminación
      setConfirmModal({
        isOpen: true,
        title: '¿Eliminar Proveedor?',
        message: `¿Estás seguro de eliminar al proveedor "${proveedor.nombre}"? Esta acción se puede revertir desde la base de datos.`,
        onConfirm: async () => {
          try {
            const { error } = await supabase
              .from('proveedores')
              .update({ is_active: false })
              .eq('id', proveedor.id);

            if (error) throw error;
            toast.success('Proveedor eliminado exitosamente');
            setConfirmModal({ ...confirmModal, isOpen: false });
            loadProveedores();
          } catch (error: any) {
            console.error('Error eliminando proveedor:', error);
            toast.error(error.message || 'Error al eliminar el proveedor');
            setConfirmModal({ ...confirmModal, isOpen: false });
          }
        }
      });
    } catch (error: any) {
      console.error('Error validando proveedor:', error);
      toast.error('Error al validar el proveedor');
    }
  };

  const handleVerHistorial = async (proveedor: Proveedor) => {
    setHistorialProveedor(proveedor);
    setShowHistorial(true);
    setLoadingHistorial(true);

    try {
      // Obtener TODAS las compras del proveedor con sus items y productos
      const { data: compras, error } = await supabase
        .from('compras')
        .select(`
          id,
          fecha,
          numero_compra,
          total,
          compra_items (
            cantidad,
            unidad_medida,
            precio_unitario,
            subtotal,
            productos (
              id,
              nombre,
              tipo
            )
          )
        `)
        .eq('proveedor_id', proveedor.id)
        .order('fecha', { ascending: false });

      if (error) {
        console.error('Error cargando historial:', error);
        throw error;
      }

      console.log('Compras obtenidas:', compras);

      // Obtener productos nuevos creados con este proveedor como proveedor principal
      const { data: productosNuevos, error: productosError } = await supabase
        .from('productos')
        .select('id, nombre, tipo, created_at, precio_compra, stock_unidades, stock_paquetes, stock_kg')
        .eq('proveedor_principal_id', proveedor.id)
        .order('created_at', { ascending: false });

      if (productosError) {
        console.error('Error obteniendo productos nuevos:', productosError);
      }

      console.log('Productos nuevos obtenidos:', productosNuevos);

      // Transformar datos de compras (reposiciones)
      const historialCompras = (compras || []).map(compra => ({
        id: compra.id,
        fecha: compra.fecha,
        numero_compra: compra.numero_compra,
        total: compra.total,
        tipo: 'compra' as const,
        productos: (compra.compra_items || []).map((item: any) => ({
          nombre: item.productos?.nombre || 'Producto desconocido',
          tipo: item.productos?.tipo || 'unidad',
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal
        }))
      }));

      // Transformar datos de productos nuevos
      const historialProductosNuevos = (productosNuevos || []).map(producto => {
        // Calcular stock inicial según tipo
        let stockInicial = 0;
        let unidadMedida = 'unidades';

        if (producto.tipo === 'unidad') {
          stockInicial = producto.stock_unidades || 0;
          unidadMedida = 'unidades';
        } else if (producto.tipo === 'paquete') {
          stockInicial = producto.stock_paquetes || 0;
          unidadMedida = 'paquetes';
        } else if (producto.tipo === 'peso') {
          stockInicial = producto.stock_kg || 0;
          unidadMedida = 'kg';
        }

        return {
          id: `nuevo-${producto.id}`,
          fecha: producto.created_at,
          numero_compra: null,
          total: (producto.precio_compra || 0) * stockInicial,
          tipo: 'producto_nuevo' as const,
          productos: [{
            nombre: producto.nombre,
            tipo: producto.tipo,
            cantidad: stockInicial,
            unidad_medida: unidadMedida,
            precio_unitario: producto.precio_compra || 0,
            subtotal: (producto.precio_compra || 0) * stockInicial
          }]
        };
      });

      // Combinar y ordenar por fecha
      const historialCombinado = [...historialCompras, ...historialProductosNuevos].sort((a, b) => {
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });

      setComprasHistorial(historialCombinado);

      // Obtener productos que se han comprado a este proveedor
      // Primero obtener los IDs de las compras del proveedor
      const { data: comprasIds, error: comprasIdsError } = await supabase
        .from('compras')
        .select('id')
        .eq('proveedor_id', proveedor.id);

      if (comprasIdsError) {
        console.error('Error obteniendo IDs de compras:', comprasIdsError);
        toast.error(`Error al recuperar compras: ${comprasIdsError.message}`);
        setProductosAsignados([]);
      } else if (!comprasIds || comprasIds.length === 0) {
        // No hay compras, no hay productos
        setProductosAsignados([]);
      } else {
        // Ahora obtener los productos de esas compras
        const compraIdsList = comprasIds.map(c => c.id);

        const { data: productosComprados, error: productosCompradosError } = await supabase
          .from('compra_items')
          .select(`
            producto_id,
            compra_id,
            productos (
              id,
              nombre,
              tipo,
              stock_unidades,
              stock_paquetes,
              stock_kg,
              stock_minimo,
              precio_compra,
              precio_venta_unidad,
              precio_venta_paquete,
              precio_venta_kg,
              pesable,
              created_at
            )
          `)
          .in('compra_id', compraIdsList);

        if (productosCompradosError) {
          console.error('Error cargando productos del proveedor:', productosCompradosError);
          toast.error(`Error al recuperar productos: ${productosCompradosError.message}`);
          setProductosAsignados([]);
        } else {
          // Filtrar productos duplicados usando Map (mismo producto puede aparecer en varias compras)
          const productosUnicos = new Map<string, any>();

          (productosComprados || []).forEach((item: any) => {
            // Verificar que el producto existe y tiene datos válidos
            if (item.productos && item.productos.id) {
              const productoId = item.productos.id;
              // Solo agregar el primer producto encontrado (eliminar duplicados)
              if (!productosUnicos.has(productoId)) {
                productosUnicos.set(productoId, item.productos);
              }
            }
          });

          const productosArray = Array.from(productosUnicos.values());
          setProductosAsignados(productosArray);
          console.log(`✅ Productos únicos del proveedor (${productosArray.length}):`, productosArray);
        }
      }
    } catch (error: any) {
      console.error('Error cargando historial:', error);
      toast.error('Error al cargar el historial de compras');
    } finally {
      setLoadingHistorial(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Proveedores</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm md:text-base"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          Nuevo Proveedor
        </button>
      </div>

      {proveedores.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No hay proveedores registrados
          </h3>
          <p className="text-gray-500 mb-6">
            Haz clic en "Nuevo Proveedor" para crear tu primer proveedor
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {proveedores.map((proveedor) => (
            <div
              key={proveedor.id}
              className="bg-white rounded-xl shadow-md p-4 md:p-6 hover:shadow-lg transition border-2 border-transparent hover:border-indigo-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-3 rounded-full">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{proveedor.nombre}</h3>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(proveedor)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Editar proveedor"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(proveedor)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar proveedor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {proveedor.telefono && (
                  <a
                    href={`https://wa.me/${proveedor.telefono.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="w-4 h-4" />
                    {proveedor.telefono}
                  </a>
                )}
                {proveedor.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    {proveedor.email}
                  </div>
                )}
                {proveedor.direccion && (
                  <p className="text-sm text-gray-600 mt-2">{proveedor.direccion}</p>
                )}
                {proveedor.notas && (
                  <p className="text-sm text-gray-500 italic mt-2">{proveedor.notas}</p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleVerHistorial(proveedor)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Ver Historial
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                <input
                  type="text"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  {editingProveedor ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistorial && historialProveedor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-3 rounded-full">
                  <ShoppingBag className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Historial de Compras</h2>
                  <p className="text-gray-600">{historialProveedor.nombre}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowHistorial(false);
                  setHistorialProveedor(null);
                  setComprasHistorial([]);
                  setProductosAsignados([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingHistorial ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : (comprasHistorial.length === 0 && productosAsignados.length === 0) ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  No hay datos registrados
                </h3>
                <p className="text-gray-500">
                  No se encontraron compras ni productos de este proveedor
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Productos Asignados */}
                {productosAsignados.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-indigo-600" />
                      Productos Asignados ({productosAsignados.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {productosAsignados.map((producto) => (
                        <div key={producto.id} className="border border-gray-200 rounded-lg p-4 bg-blue-50">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-800">{producto.nombre}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              producto.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                              producto.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {producto.tipo === 'unidad' ? 'Unidad' :
                               producto.tipo === 'paquete' ? 'Paquete' :
                               'Peso'}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Stock:</span>
                              <span className="font-medium">{getStockTextoProducto(producto)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Stock Mínimo:</span>
                              <span className="font-medium">
                                {producto.stock_minimo} {producto.tipo === 'unidad' ? 'unidades' : producto.tipo === 'paquete' ? 'paquetes' : 'kg'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Precio Compra:</span>
                              <span className="font-medium text-gray-800">
                                {formatGuaranies(producto.precio_compra || 0)}
                                {producto.tipo === 'peso' && '/kg'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Precio Venta:</span>
                              <span className="font-medium text-indigo-600">
                                {formatGuaranies(getPrecioVentaProducto(producto) || 0)}
                                {producto.tipo === 'peso' && '/kg'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Agregado:</span>
                              <span className="font-medium">{new Date(producto.created_at).toLocaleDateString('es-PY')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial de Compras */}
                {comprasHistorial.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-green-600" />
                      Historial de Compras y Productos ({comprasHistorial.length} registros)
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tipo</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fecha y Hora</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Producto</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Tipo Prod.</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Cantidad</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Precio Compra</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {comprasHistorial.map((compra) => (
                            compra.productos.map((producto, idx) => (
                              <tr key={`${compra.id}-${idx}`} className={`hover:bg-gray-50 ${compra.tipo === 'producto_nuevo' ? 'bg-blue-50' : ''}`}>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    compra.tipo === 'producto_nuevo'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {compra.tipo === 'producto_nuevo' ? 'Producto Nuevo' : 'Reposición'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-800">
                                  {new Date(compra.fecha).toLocaleString('es-PY', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm font-medium text-gray-800">{producto.nombre}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      producto.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                                      producto.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      {producto.tipo === 'unidad' ? 'Unidad' :
                                       producto.tipo === 'paquete' ? 'Paquete' :
                                       'Peso'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-gray-800">
                                  {producto.cantidad} {producto.unidad_medida}
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-gray-800">
                                  {formatGuaranies(producto.precio_unitario)}
                                  {producto.tipo === 'peso' && '/kg'}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-indigo-600">
                                  {formatGuaranies(producto.subtotal)}
                                </td>
                              </tr>
                            ))
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type="danger"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
};
