import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { FolderOpen, Plus, Edit, Trash2, Tag, Package } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '../common/ConfirmModal';
import { formatGuaranies } from '../../utils/currency';

interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  productos_count?: number;
}

interface ProductoCategoria {
  id: string;
  nombre: string;
  tipo: string;
  stock_unidades: number;
  stock_paquetes: number;
  stock_kg: number;
  stock_minimo: number;
  precio_compra: number;
  precio_venta_unidad: number;
  precio_venta_paquete: number;
  precio_venta_kg: number;
  pesable: boolean;
  created_at: string;
  talle?: string;
}

export const Categorias: React.FC = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);

  // Estados para historial de productos
  const [showProductos, setShowProductos] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<Categoria | null>(null);
  const [productosCategoria, setProductosCategoria] = useState<ProductoCategoria[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);

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
    descripcion: ''
  });

  useEffect(() => {
    loadCategorias();
  }, []);

  // Cerrar modal con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
        setEditingCategoria(null);
        setFormData({
          nombre: '',
          descripcion: ''
        });
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showModal]);

  const loadCategorias = async () => {
    try {
      // Obtener categorías
      const { data: categoriasData, error: categoriasError } = await supabase
        .from('categorias')
        .select('*')
        .eq('is_active', true)
        .order('nombre');

      if (categoriasError) throw categoriasError;

      // Contar productos por categoría
      if (categoriasData) {
        const categoriasConConteo = await Promise.all(
          categoriasData.map(async (categoria) => {
            const { count } = await supabase
              .from('productos')
              .select('*', { count: 'exact', head: true })
              .eq('categoria_id', categoria.id)
              .eq('is_active', true);

            return {
              ...categoria,
              productos_count: count || 0
            };
          })
        );
        setCategorias(categoriasConConteo);
      }
    } catch (error: any) {
      console.error('Error cargando categorías:', error);
      toast.error('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: ''
    });
    setEditingCategoria(null);
  };

  const handleVerProductos = async (categoria: Categoria) => {
    setCategoriaSeleccionada(categoria);
    setShowProductos(true);
    setLoadingProductos(true);

    try {
      const { data: productos, error } = await supabase
        .from('productos')
        .select('id, nombre, tipo, stock_unidades, stock_paquetes, stock_kg, stock_minimo, precio_compra, precio_venta_unidad, precio_venta_paquete, precio_venta_kg, pesable, created_at, talle')
        .eq('categoria_id', categoria.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error cargando productos:', error);
        throw error;
      }

      console.log('Productos obtenidos:', productos);
      setProductosCategoria(productos || []);
    } catch (error: any) {
      console.error('Error cargando productos de la categoría:', error);
      toast.error('Error al cargar los productos');
    } finally {
      setLoadingProductos(false);
    }
  };

  const getStockTexto = (producto: ProductoCategoria) => {
    if (producto.tipo === 'unidad') {
      return `${Math.round(producto.stock_unidades)} unidades`;
    } else if (producto.tipo === 'paquete') {
      return `${producto.stock_paquetes} paquetes`;
    } else {
      return `${producto.stock_kg.toFixed(2)} kg`;
    }
  };

  const getPrecioVenta = (producto: ProductoCategoria) => {
    if (producto.tipo === 'unidad') {
      return producto.precio_venta_unidad;
    } else if (producto.tipo === 'paquete') {
      return producto.precio_venta_paquete;
    } else {
      return producto.precio_venta_kg;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCategoria) {
        const { error } = await supabase
          .from('categorias')
          .update({
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCategoria.id);

        if (error) throw error;
        toast.success('Categoría actualizada exitosamente');
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert({
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            is_active: true
          });

        if (error) throw error;
        toast.success('Categoría creada exitosamente');
      }

      setShowModal(false);
      resetForm();
      loadCategorias();
    } catch (error: any) {
      console.error('Error guardando categoría:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una categoría con ese nombre');
      } else {
        toast.error(error.message || 'Error al guardar la categoría');
      }
    }
  };

  const handleEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setFormData({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (categoria: Categoria) => {
    // Verificar si tiene productos asignados
    if (categoria.productos_count && categoria.productos_count > 0) {
      toast.error(`No se puede eliminar. Esta categoría tiene ${categoria.productos_count} producto(s) asignado(s)`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Categoría?',
      message: `¿Estás seguro de eliminar la categoría "${categoria.nombre}"? Esta acción se puede revertir desde la base de datos.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('categorias')
            .update({ is_active: false })
            .eq('id', categoria.id);

          if (error) throw error;
          toast.success('Categoría eliminada exitosamente');
          setConfirmModal({ ...confirmModal, isOpen: false });
          loadCategorias();
        } catch (error: any) {
          console.error('Error eliminando categoría:', error);
          toast.error(error.message || 'Error al eliminar la categoría');
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      }
    });
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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Categorías de Productos</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm md:text-base"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          Nueva Categoría
        </button>
      </div>

      {categorias.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No hay categorías registradas
          </h3>
          <p className="text-gray-500 mb-6">
            Haz clic en "Nueva Categoría" para crear tu primera categoría
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {categorias.map((categoria) => (
            <div
              key={categoria.id}
              className="bg-white rounded-xl shadow-md p-4 md:p-6 hover:shadow-lg transition border-2 border-transparent hover:border-indigo-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-3 rounded-full">
                    <Tag className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{categoria.nombre}</h3>
                    <p className="text-sm text-gray-500">
                      {categoria.productos_count || 0} producto(s)
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(categoria)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Editar categoría"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(categoria)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar categoría"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {categoria.descripcion && (
                <p className="text-sm text-gray-600 mt-2">{categoria.descripcion}</p>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                <p className="text-xs text-gray-500">
                  Creada: {new Date(categoria.created_at).toLocaleDateString('es-PY')}
                </p>
                <button
                  onClick={() => handleVerProductos(categoria)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                >
                  <Package className="w-4 h-4" />
                  Ver Productos
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar Categoría */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">
              {editingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Descripción de la categoría (opcional)"
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
                  {editingCategoria ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
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

      {/* Modal de Productos de la Categoría */}
      {showProductos && categoriaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-3 rounded-full">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Productos de la Categoría</h2>
                  <p className="text-gray-600">{categoriaSeleccionada.nombre}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowProductos(false);
                  setCategoriaSeleccionada(null);
                  setProductosCategoria([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingProductos ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                </div>
              ) : productosCategoria.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No hay productos</h3>
                  <p className="text-gray-500">
                    Esta categoría aún no tiene productos asignados
                  </p>
                </div>
              ) : (
                <>
                  {/* Vista Desktop - Tabla */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Producto</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Tipo</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Talle</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Stock</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Stock Mín.</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Precio Compra</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Precio Venta</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Agregado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {productosCategoria.map((producto) => (
                          <tr key={producto.id} className="hover:bg-gray-50">
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
                            <td className="px-4 py-3 text-center text-sm">
                              {producto.talle ? (
                                <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                                  {producto.talle}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-800">
                              {getStockTexto(producto)}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-800">
                              {producto.stock_minimo} {producto.tipo === 'unidad' ? 'un' : producto.tipo === 'paquete' ? 'pq' : 'kg'}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-800">
                              {formatGuaranies(producto.precio_compra || 0)}
                              {producto.tipo === 'peso' && '/kg'}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-semibold text-green-600">
                              {formatGuaranies(getPrecioVenta(producto) || 0)}
                              {producto.tipo === 'peso' && '/kg'}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                              {new Date(producto.created_at).toLocaleDateString('es-PY')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista Móvil - Tarjetas */}
                  <div className="md:hidden grid grid-cols-1 gap-4">
                    {productosCategoria.map((producto) => (
                      <div
                        key={producto.id}
                        className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-800">{producto.nombre}</h3>
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

                        {producto.talle && (
                          <div className="mb-2">
                            <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                              Talle: {producto.talle}
                            </span>
                          </div>
                        )}

                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Stock:</span>
                            <span className="font-medium">{getStockTexto(producto)}</span>
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
                            <span className="font-medium text-green-600">
                              {formatGuaranies(getPrecioVenta(producto) || 0)}
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
