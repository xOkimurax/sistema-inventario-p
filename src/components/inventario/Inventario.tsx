import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Producto, AjusteInventario } from '../../types';
import { Package, Plus, Minus, History } from 'lucide-react';
import { formatGuaranies } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';

export const Inventario: React.FC = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ajustes, setAjustes] = useState<AjusteInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { user } = useAuth();

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalProductos, setTotalProductos] = useState(0);
  const productosPorPagina = 15;

  const [formData, setFormData] = useState({
    tipo_ajuste: 'entrada' as 'entrada' | 'salida' | 'apertura_paquete',
    cantidad_ajuste: '',
    razon: '',
    precio_compra: '',
    precio_venta: ''
  });

  useEffect(() => {
    loadData();
  }, [paginaActual]);

  const loadData = async () => {
    try {
      // Contar total de productos activos
      const { count } = await supabase
        .from('productos')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setTotalProductos(count || 0);

      // Calcular offset
      const offset = (paginaActual - 1) * productosPorPagina;

      const { data: productosData, error: productosError } = await supabase
        .from('productos')
        .select('*')
        .eq('is_active', true)
        .order('nombre')
        .range(offset, offset + productosPorPagina - 1);

      if (productosError) throw productosError;
      if (productosData) setProductos(productosData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAjustes = async (productoId: string) => {
    try {
      const { data, error } = await supabase
        .from('ajustes_inventario')
        .select('*')
        .eq('producto_id', productoId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (data) setAjustes(data);
    } catch (error) {
      console.error('Error cargando ajustes:', error);
    }
  };

  const handleAjusteClick = (producto: Producto) => {
    setSelectedProduct(producto);

    // Pre-cargar precios actuales del producto
    let precioVentaActual = '';
    if (producto.tipo === 'unidad') {
      if (producto.pesable) {
        precioVentaActual = producto.precio_venta_kg?.toString() || '';
      } else {
        precioVentaActual = producto.precio_venta_unidad?.toString() || '';
      }
    } else {
      precioVentaActual = producto.precio_venta_paquete?.toString() || '';
    }

    setFormData({
      tipo_ajuste: 'entrada',
      cantidad_ajuste: '',
      razon: '',
      precio_compra: producto.precio_compra?.toString() || '',
      precio_venta: precioVentaActual
    });
    setShowModal(true);
  };

  const handleHistoryClick = (producto: Producto) => {
    setSelectedProduct(producto);
    loadAjustes(producto.id);
    setShowHistory(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !user) return;

    try {
      const cantidadAjuste = parseFloat(formData.cantidad_ajuste);
      let cantidadAnterior = 0;
      let cantidadNueva = 0;
      let unidadMedida: 'unidad' | 'paquete' | 'kg' = 'unidad';

      // Determinar valores según tipo de producto
      if (selectedProduct.tipo === 'unidad') {
        if (selectedProduct.pesable) {
          unidadMedida = 'kg';
          cantidadAnterior = selectedProduct.stock_kg;
        } else {
          unidadMedida = 'unidad';
          cantidadAnterior = selectedProduct.stock_unidades;
        }
      } else {
        unidadMedida = 'paquete';
        cantidadAnterior = selectedProduct.stock_paquetes;
      }

      // Calcular nueva cantidad
      if (formData.tipo_ajuste === 'entrada') {
        cantidadNueva = cantidadAnterior + cantidadAjuste;
      } else if (formData.tipo_ajuste === 'salida') {
        cantidadNueva = cantidadAnterior - cantidadAjuste;
        if (cantidadNueva < 0) {
          alert('No se puede tener stock negativo');
          return;
        }
      }

      // Registrar ajuste
      const { error: ajusteError } = await supabase
        .from('ajustes_inventario')
        .insert({
          producto_id: selectedProduct.id,
          tipo_ajuste: formData.tipo_ajuste,
          cantidad_anterior: cantidadAnterior,
          cantidad_ajuste: cantidadAjuste,
          cantidad_nueva: cantidadNueva,
          unidad_medida: unidadMedida,
          razon: formData.razon,
          realizado_por: user.id
        });

      if (ajusteError) throw ajusteError;

      // Actualizar stock del producto y precios
      const updateData: any = {};
      if (unidadMedida === 'unidad') {
        updateData.stock_unidades = cantidadNueva;
      } else if (unidadMedida === 'paquete') {
        updateData.stock_paquetes = cantidadNueva;
      } else if (unidadMedida === 'kg') {
        updateData.stock_kg = cantidadNueva;
      }

      // Actualizar precios si se proporcionaron
      if (formData.precio_compra) {
        updateData.precio_compra = parseFloat(formData.precio_compra);
      }

      if (formData.precio_venta) {
        const precioVenta = parseFloat(formData.precio_venta);
        if (selectedProduct.tipo === 'unidad') {
          if (selectedProduct.pesable) {
            updateData.precio_venta_kg = precioVenta;
          } else {
            updateData.precio_venta_unidad = precioVenta;
          }
        } else {
          updateData.precio_venta_paquete = precioVenta;
        }
      }

      const { error: updateError } = await supabase
        .from('productos')
        .update(updateData)
        .eq('id', selectedProduct.id);

      if (updateError) throw updateError;

      alert('Ajuste de inventario realizado exitosamente');
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error realizando ajuste:', error);
      alert('Error al realizar ajuste de inventario');
    }
  };

  const renderPaginacion = () => {
    const totalPaginas = Math.ceil(totalProductos / productosPorPagina);

    if (totalPaginas <= 1) return null;

    const maxPaginasVisibles = 5;
    let inicio = Math.max(1, paginaActual - Math.floor(maxPaginasVisibles / 2));
    let fin = Math.min(totalPaginas, inicio + maxPaginasVisibles - 1);

    if (fin - inicio < maxPaginasVisibles - 1) {
      inicio = Math.max(1, fin - maxPaginasVisibles + 1);
    }

    const paginas = [];
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 pb-4">
        <p className="text-sm text-gray-600">
          Mostrando {((paginaActual - 1) * productosPorPagina) + 1} - {Math.min(paginaActual * productosPorPagina, totalProductos)} de {totalProductos} productos
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaginaActual(1)}
            disabled={paginaActual === 1}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            ««
          </button>
          <button
            onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
            disabled={paginaActual === 1}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            «
          </button>

          {inicio > 1 && (
            <>
              <button
                onClick={() => setPaginaActual(1)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                1
              </button>
              {inicio > 2 && <span className="text-gray-500">...</span>}
            </>
          )}

          {paginas.map(pagina => (
            <button
              key={pagina}
              onClick={() => setPaginaActual(pagina)}
              className={`px-3 py-1 border rounded-lg transition text-sm ${
                pagina === paginaActual
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {pagina}
            </button>
          ))}

          {fin < totalPaginas && (
            <>
              {fin < totalPaginas - 1 && <span className="text-gray-500">...</span>}
              <button
                onClick={() => setPaginaActual(totalPaginas)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                {totalPaginas}
              </button>
            </>
          )}

          <button
            onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
            disabled={paginaActual === totalPaginas}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            »
          </button>
          <button
            onClick={() => setPaginaActual(totalPaginas)}
            disabled={paginaActual === totalPaginas}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            »»
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Inventario</h1>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Código</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stock Actual</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stock Mínimo</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((producto) => {
                const stockActual = producto.tipo === 'unidad'
                  ? producto.pesable
                    ? producto.stock_kg
                    : producto.stock_unidades
                  : producto.stock_paquetes;

                const stockBajo = stockActual <= producto.stock_minimo;

                return (
                  <tr key={producto.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-800">{producto.codigo}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">{producto.nombre}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        producto.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {producto.tipo}
                        {producto.pesable && ' (Pesable)'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={stockBajo ? 'text-red-600 font-semibold' : 'text-gray-800'}>
                        {producto.tipo === 'unidad'
                          ? producto.pesable
                            ? `${stockActual.toFixed(2)} kg`
                            : `${Math.round(stockActual)} unidades`
                          : `${stockActual} paquetes`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {producto.stock_minimo}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {stockBajo ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                          Stock Bajo
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleAjusteClick(producto)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Ajustar inventario"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleHistoryClick(producto)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          title="Ver historial"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderPaginacion()}
      </div>

      {showModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Ajustar Inventario
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{selectedProduct.nombre}</strong> ({selectedProduct.codigo})
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Ajuste
                </label>
                <select
                  value={formData.tipo_ajuste}
                  onChange={(e) => setFormData({ ...formData, tipo_ajuste: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="entrada">Entrada (Agregar stock)</option>
                  <option value="salida">Salida (Reducir stock)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cantidad_ajuste}
                  onChange={(e) => setFormData({ ...formData, cantidad_ajuste: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio de Compra
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.precio_compra}
                    onChange={(e) => setFormData({ ...formData, precio_compra: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="₲"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio de Venta
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.precio_venta}
                    onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="₲"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón del Ajuste
                </label>
                <textarea
                  value={formData.razon}
                  onChange={(e) => setFormData({ ...formData, razon: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Explica el motivo del ajuste..."
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistory && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Historial de Ajustes
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              <strong>{selectedProduct.nombre}</strong> ({selectedProduct.codigo})
            </p>

            <div className="space-y-3">
              {ajustes.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No hay ajustes registrados</p>
              ) : (
                ajustes.map((ajuste) => (
                  <div key={ajuste.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          ajuste.tipo_ajuste === 'entrada'
                            ? 'bg-green-100 text-green-700'
                            : ajuste.tipo_ajuste === 'salida'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {ajuste.tipo_ajuste === 'entrada' ? 'Entrada' : ajuste.tipo_ajuste === 'salida' ? 'Salida' : 'Apertura Paquete'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(ajuste.created_at).toLocaleString('es-PY')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                      <div>
                        <p className="text-gray-600">Anterior</p>
                        <p className="font-semibold">{ajuste.cantidad_anterior} {ajuste.unidad_medida}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Ajuste</p>
                        <p className="font-semibold">{ajuste.cantidad_ajuste} {ajuste.unidad_medida}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Nuevo</p>
                        <p className="font-semibold">{ajuste.cantidad_nueva} {ajuste.unidad_medida}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">
                      <strong>Razón:</strong> {ajuste.razon}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
