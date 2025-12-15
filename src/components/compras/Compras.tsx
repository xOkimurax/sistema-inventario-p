import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Producto, Proveedor } from '../../types';
import { ShoppingBag, Plus, Trash2, Search, AlertCircle, Package, ArrowRight, Edit3, X } from 'lucide-react';
import { formatGuaranies, parseGuaranies, formatGuaraniesInput } from '../../utils/currency';
import { toast } from 'sonner';
import { AlertModal } from '../common/AlertModal';
import { ConfirmModal } from '../common/ConfirmModal';

interface CompraItem {
  producto: Producto;
  proveedor_id: string;
  cantidad: number;
  unidad_medida: 'unidad' | 'paquete' | 'kg';
  precio_unitario: number;
  precio_venta: number;
  subtotal: number;
  nuevos_precios?: any;
  nuevo_precio_proveedor?: any;
}

interface ReposicionesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompraCompleted?: () => void;
  onNavigateToProductos?: () => void;
}

export const Compras: React.FC<ReposicionesModalProps> = ({ isOpen, onClose, onCompraCompleted, onNavigateToProductos }) => {
  if (!isOpen) return null;

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [items, setItems] = useState<CompraItem[]>([]);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  // Variables para el modal de agregar producto
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [modalProveedor, setModalProveedor] = useState('');
  const [modalCantidad, setModalCantidad] = useState(0);
  const [modalPrecio, setModalPrecio] = useState(0);
  const [modalPrecioVenta, setModalPrecioVenta] = useState(0);
  const [modalProveedorAuto, setModalProveedorAuto] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // Búsqueda inteligente
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'codigo' | 'nombre'>('nombre');
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [productosFiltrados, setProductosFiltrados] = useState<Producto[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);


  // Alert modal
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'warning' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

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

  useEffect(() => {
    loadData();
  }, []);

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

  // Re-filtrar cuando cambia el tipo de búsqueda
  useEffect(() => {
    if (searchTerm.trim()) {
      const searchValue = searchTerm.trim().toLowerCase();
      let resultados: Producto[] = [];

      if (searchType === 'codigo') {
        resultados = productos.filter(p => p.codigo.toLowerCase().startsWith(searchValue));
      } else {
        resultados = productos.filter(p => p.nombre.toLowerCase().startsWith(searchValue));
      }

      setProductosFiltrados(resultados);
      setMostrarResultados(true);
    }
  }, [searchType, productos]);

  const loadData = async () => {
    try {
      const [proveedoresRes, productosRes] = await Promise.all([
        supabase.from('proveedores').select('*').eq('is_active', true).order('nombre'),
        supabase.from('productos').select('*').eq('is_active', true).order('nombre')
      ]);

      if (proveedoresRes.data) setProveedores(proveedoresRes.data);
      if (productosRes.data) setProductos(productosRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const handleSearchProduct = () => {
    if (!searchTerm.trim()) {
      setProductosFiltrados([]);
      setMostrarResultados(false);
      return;
    }

    const searchValue = searchTerm.trim().toLowerCase();
    let resultados: Producto[] = [];

    if (searchType === 'codigo') {
      // Búsqueda exacta por código
      resultados = productos.filter(p => p.codigo.toLowerCase() === searchValue);
    } else {
      // Búsqueda por prefijo en nombre (productos que COMIENZAN con el término)
      resultados = productos.filter(p => p.nombre.toLowerCase().startsWith(searchValue));
    }

    setProductosFiltrados(resultados);
    setMostrarResultados(true);

    if (resultados.length === 0) {
      setShowNewProductModal(true);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    
    // Filtrar en tiempo real mientras escribe
    if (value.trim()) {
      const searchValue = value.trim().toLowerCase();
      let resultados: Producto[] = [];

      if (searchType === 'codigo') {
        resultados = productos.filter(p => p.codigo.toLowerCase().startsWith(searchValue));
      } else {
        resultados = productos.filter(p => p.nombre.toLowerCase().startsWith(searchValue));
      }

      setProductosFiltrados(resultados);
      setMostrarResultados(true);
    } else {
      setProductosFiltrados([]);
      setMostrarResultados(false);
    }
  };

  const handleSelectProducto = async (producto: Producto) => {
    setMostrarResultados(false);
    setSearchTerm('');
    setProductosFiltrados([]);
    await addProducto(producto);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Si hay exactamente un resultado, seleccionarlo automáticamente
      if (productosFiltrados.length === 1) {
        handleSelectProducto(productosFiltrados[0]);
      } else if (productosFiltrados.length === 0 && searchTerm.trim()) {
        // Si no hay resultados, mostrar modal de producto no encontrado
        setShowNewProductModal(true);
      }
    } else if (e.key === 'Escape') {
      // Cerrar lista de resultados con ESC
      setMostrarResultados(false);
      setProductosFiltrados([]);
    }
  };

  // Función helper para obtener precio de venta según tipo de producto
  const getPrecioVentaProducto = (producto: Producto): number => {
    if (producto.pesable) {
      return producto.precio_venta_kg || 0;
    } else if (producto.tipo === 'paquete') {
      return producto.precio_venta_paquete || 0;
    } else {
      return producto.precio_venta_unidad || 0;
    }
  };

  const addProducto = async (producto: Producto) => {
    // Verificar si ya está en la lista
    const existingItemIndex = items.findIndex(item => item.producto.id === producto.id);

    if (existingItemIndex !== -1) {
      // Si ya existe y es tipo unidad o paquete, sumar 1 a la cantidad
      if (producto.tipo === 'unidad' || producto.tipo === 'paquete') {
        const newItems = [...items];
        newItems[existingItemIndex].cantidad += 1;
        newItems[existingItemIndex].subtotal = newItems[existingItemIndex].cantidad * newItems[existingItemIndex].precio_unitario;
        setItems(newItems);
        toast.success(`Cantidad de ${producto.nombre} incrementada`);
        return;
      } else {
        // Si es tipo peso, mostrar advertencia
        toast.warning('Este producto ya está en la lista');
        return;
      }
    }

    // Autocargar precio actual del producto
    const precioActual = getPrecioVentaProducto(producto);

    // Auto-seleccionar proveedor basado en última compra
    let proveedorId = '';

    try {
      // Query mejorada: Obtener proveedor de la última compra del producto
      const { data: compraItems, error } = await supabase
        .from('compra_items')
        .select(`
          id,
          created_at,
          compra_id,
          compras!inner (
            id,
            proveedor_id,
            fecha
          )
        `)
        .eq('producto_id', producto.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && compraItems && compraItems.length > 0) {
        const ultimaCompra = compraItems[0];
        if (ultimaCompra.compras && typeof ultimaCompra.compras === 'object') {
          const compraData = ultimaCompra.compras as any;
          if (compraData.proveedor_id) {
            proveedorId = compraData.proveedor_id;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error buscando historial:', error);
    }

    // Si no hay historial, usar proveedor principal del producto
    if (!proveedorId && producto.proveedor_principal_id) {
      proveedorId = producto.proveedor_principal_id;
    }

    // Si hay items y el proveedor es diferente, usar el proveedor de los items existentes
    if (items.length > 0) {
      proveedorId = items[0].proveedor_id;
    }

    // Si aún no hay proveedor, usar el primero disponible
    if (!proveedorId && proveedores.length > 0) {
      proveedorId = proveedores[0].id;
    }

    // Agregar directamente a la lista
    const unidad_medida = producto.tipo === 'paquete' ? 'paquete' : producto.tipo === 'peso' ? 'kg' : 'unidad';
    const cantidad = producto.tipo === 'peso' ? 1 : 1;

    const newItem: CompraItem = {
      producto,
      proveedor_id: proveedorId,
      cantidad,
      unidad_medida,
      precio_unitario: producto.precio_compra || 0,
      precio_venta: precioActual,
      subtotal: (producto.precio_compra || 0) * cantidad
    };

    setItems([...items, newItem]);
    toast.success(`${producto.nombre} agregado a la compra`);
  };

  const handleConfirmAddProduct = () => {
    if (!productoSeleccionado) return;
    
    if (!modalProveedor) {
      toast.error('Debes seleccionar un proveedor');
      return;
    }

    if (modalPrecio <= 0) {
      toast.error('El precio debe ser mayor a cero');
      return;
    }

    if (modalCantidad <= 0) {
      toast.error('La cantidad debe ser mayor a cero');
      return;
    }

    // Verificar si hay items y si el proveedor es diferente
    if (items.length > 0 && items[0].proveedor_id !== modalProveedor) {
      const proveedorActual = proveedores.find(p => p.id === items[0].proveedor_id);
      const proveedorNuevo = proveedores.find(p => p.id === modalProveedor);
      
      setConfirmModal({
        isOpen: true,
        title: 'Cambiar Proveedor',
        message: `Los items actuales son del proveedor "${proveedorActual?.nombre}". ¿Deseas cambiar todos los items al proveedor "${proveedorNuevo?.nombre}"?`,
        onConfirm: () => {
          // Cambiar proveedor de todos los items
          const updatedItems = items.map(item => ({ ...item, proveedor_id: modalProveedor }));
          setItems(updatedItems);
          addItemToList();
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
      });
      return;
    }

    addItemToList();
  };

  const addItemToList = () => {
    if (!productoSeleccionado) return;

    const unidad_medida = productoSeleccionado.tipo === 'paquete' ? 'paquete' : productoSeleccionado.tipo === 'peso' ? 'kg' : 'unidad';

    const newItem: CompraItem = {
      producto: productoSeleccionado,
      proveedor_id: modalProveedor,
      cantidad: modalCantidad,
      unidad_medida,
      precio_unitario: modalPrecio,
      precio_venta: modalPrecioVenta,
      subtotal: modalPrecio * modalCantidad
    };

    setItems([...items, newItem]);
    const proveedorNombre = proveedores.find(p => p.id === modalProveedor)?.nombre || 'Proveedor';
    toast.success(`${productoSeleccionado.nombre} agregado (${proveedorNombre})`);
    
    // Cerrar modal y resetear
    setShowAddProductModal(false);
    setProductoSeleccionado(null);
    setModalCantidad(1);
    setModalPrecio(0);
    setModalPrecioVenta(0);
    setModalProveedor('');
    setModalProveedorAuto(false);
  };

  const handleGoToProductos = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Ir a Agregar Producto?',
      message: 'Serás redirigido al módulo de Productos. Los items de esta reposición se perderán.',
      onConfirm: () => {
        // Cerrar modal de reposición
        onClose();
        
        // Notificar al componente padre que necesita navegar a productos
        if (onNavigateToProductos) {
          onNavigateToProductos();
        }
        
        setShowNewProductModal(false);
        setSearchTerm('');
      }
    });
  };

  const actualizarCantidad = (index: number, cantidad: number) => {
    const newItems = [...items];
    newItems[index].cantidad = cantidad;
    newItems[index].subtotal = cantidad * newItems[index].precio_unitario;
    setItems(newItems);
  };

  const actualizarPrecio = (index: number, precio: number) => {
    const newItems = [...items];
    newItems[index].precio_unitario = precio;
    newItems[index].subtotal = newItems[index].cantidad * precio;
    setItems(newItems);
  };

  const actualizarPrecioVenta = (index: number, precio: number) => {
    const newItems = [...items];
    newItems[index].precio_venta = precio;
    setItems(newItems);
  };

  const actualizarProveedor = (index: number, proveedorId: string) => {
    const newItems = [...items];
    newItems[index].proveedor_id = proveedorId;
    setItems(newItems);
  };

  const eliminarItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const getTotal = () => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const procesarCompra = async () => {
    if (items.length === 0) {
      setAlertModal({
        isOpen: true,
        title: 'Datos Incompletos',
        message: 'Debes agregar al menos un item a la compra',
        type: 'warning'
      });
      return;
    }

    // Verificar que todos los items tengan proveedor seleccionado
    const itemsSinProveedor = items.filter(item => !item.proveedor_id);
    if (itemsSinProveedor.length > 0) {
      setAlertModal({
        isOpen: true,
        title: 'Proveedores Faltantes',
        message: `Hay ${itemsSinProveedor.length} producto${itemsSinProveedor.length !== 1 ? 's' : ''} sin proveedor seleccionado. Por favor selecciona un proveedor para todos los items.`,
        type: 'warning'
      });
      return;
    }

    // Agrupar items por proveedor
    const itemsPorProveedor = items.reduce((acc, item) => {
      if (!acc[item.proveedor_id]) {
        acc[item.proveedor_id] = [];
      }
      acc[item.proveedor_id].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    const proveedoresUnicos = Object.keys(itemsPorProveedor);

    // Si hay múltiples proveedores, mostrar confirmación
    if (proveedoresUnicos.length > 1) {
      const detalleProveedores = proveedoresUnicos.map(provId => {
        const proveedor = proveedores.find(p => p.id === provId);
        const cantidad = itemsPorProveedor[provId].length;
        return `• ${proveedor?.nombre}: ${cantidad} producto${cantidad !== 1 ? 's' : ''}`;
      }).join('\n');

      setConfirmModal({
        isOpen: true,
        title: 'Múltiples Proveedores Detectados',
        message: `Has seleccionado items de ${proveedoresUnicos.length} proveedores diferentes:\n\n${detalleProveedores}\n\nSe crearán ${proveedoresUnicos.length} reposiciones separadas. ¿Deseas continuar?`,
        onConfirm: async () => {
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          await ejecutarCompras(itemsPorProveedor);
        }
      });
      return;
    }

    // Si todos los items son del mismo proveedor, procesar directamente
    await ejecutarCompras(itemsPorProveedor);
  };

  const ejecutarCompras = async (itemsPorProveedor: Record<string, typeof items>) => {
    try {
      setLoading(true);

      const proveedoresIds = Object.keys(itemsPorProveedor);
      let comprasExitosas = 0;
      let comprasFallidas = 0;

      for (const proveedorId of proveedoresIds) {
        const itemsProveedor = itemsPorProveedor[proveedorId];

        const compraItems = itemsProveedor.map(item => ({
          producto_id: item.producto.id,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida,
          precio_unitario: item.precio_unitario,
          precio_venta: item.precio_venta
        }));

        console.log('📦 Enviando compra:', { proveedor_id: proveedorId, items: compraItems, actualizar_precios: false, notas });
        console.log('📦 Items detallados:', JSON.stringify(compraItems, null, 2));

        try {
          const { data, error } = await supabase.functions.invoke('procesar-compra', {
            body: {
              proveedor_id: proveedorId,
              items: compraItems,
              actualizar_precios: false,
              notas
            }
          });

          if (error) throw error;
          comprasExitosas++;
        } catch (error: any) {
          console.error(`Error procesando compra del proveedor ${proveedorId}:`, error);
          comprasFallidas++;

          setAlertModal({
            isOpen: true,
            title: 'Error al Procesar Reposición',
            message: error.message || 'Ocurrió un error al procesar una de las reposiciones',
            type: 'error'
          });
        }
      }

      if (comprasExitosas > 0) {
        const mensaje = proveedoresIds.length === 1
          ? '¡Reposición procesada exitosamente!'
          : `¡${comprasExitosas} reposición${comprasExitosas !== 1 ? 'es' : ''} procesada${comprasExitosas !== 1 ? 's' : ''} exitosamente!`;
        toast.success(mensaje);

        setItems([]);
        setNotas('');
        loadData();

        // Notificar al componente padre que la compra se completó exitosamente
        if (onCompraCompleted) {
          onCompraCompleted();
        }

        // Cerrar modal después de 1 segundo
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error procesando reposiciones:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error al Procesar Reposiciones',
        message: error.message || 'Ocurrió un error al procesar las reposiciones',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto">
        <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 bg-indigo-100 rounded-lg">
            <ShoppingBag className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800">Reposiciones</h1>
            <p className="text-xs sm:text-sm text-gray-500">Gestiona las reposiciones de inventario</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition mt-1 sm:mt-0"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Card Principal */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 md:p-6 space-y-6">
          {/* Búsqueda Inteligente de Productos */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 md:p-6 border border-indigo-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              Buscar Producto
            </h3>

            {/* Campo de búsqueda */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="w-full md:w-48">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as 'nombre' | 'codigo')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base bg-white"
                >
                  <option value="nombre">Buscar por Nombre</option>
                  <option value="codigo">Buscar por Código</option>
                </select>
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={searchType === 'codigo' ? 'Ingresa el código del producto' : 'Ingresa el nombre del producto'}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSearchProduct}
                className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-md hover:shadow-lg"
              >
                Buscar
              </button>
            </div>

            <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Escribe para filtrar productos que comiencen con el término
            </p>

            {/* Lista de productos filtrados */}
            {mostrarResultados && productosFiltrados.length > 0 && (
              <div className="mt-4 border border-indigo-200 rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2">
                  <p className="text-sm font-semibold text-gray-700 px-3 py-2">
                    {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''} encontrado{productosFiltrados.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-1">
                    {productosFiltrados.map((producto) => (
                      <button
                        key={producto.id}
                        onClick={() => handleSelectProducto(producto)}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 rounded-lg transition flex items-center justify-between group"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 group-hover:text-indigo-600">
                            {producto.nombre}
                          </p>
                          <p className="text-xs text-gray-500">
                            Código: {producto.codigo} | Stock: {producto.stock_unidades} unidades
                          </p>
                        </div>
                        <div className="text-sm font-medium text-indigo-600">
                          {formatGuaranies(getPrecioVentaProducto(producto))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Items de Compra */}
          {items.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Items de Reposición ({items.length})
              </h3>
              
              {/* Desktop: Tabla */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Producto</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Tipo</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Talle</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Proveedor</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Cantidad</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Precio Compra</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Precio Venta</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Subtotal</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, index) => {
                      const proveedor = proveedores.find(p => p.id === item.proveedor_id);
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold text-gray-800">{item.producto.nombre}</p>
                              <p className="text-sm text-gray-500">{item.producto.codigo}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                item.producto.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                                item.producto.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {item.producto.tipo === 'unidad' ? 'Unidad' :
                                 item.producto.tipo === 'paquete' ? 'Paquete' :
                                 'Peso'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.producto.es_ropa_calzado && item.producto.talle ? (
                              <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                                {item.producto.talle}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={item.proveedor_id}
                              onChange={(e) => actualizarProveedor(index, e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                            >
                              <option value="">Seleccionar proveedor</option>
                              {proveedores.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={item.cantidad}
                                onChange={(e) => actualizarCantidad(index, parseFloat(e.target.value) || 0)}
                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center"
                              />
                              {item.producto.tipo === 'peso' && (
                                <span className="text-sm text-gray-600 font-medium">kg</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₲</span>
                                <input
                                  type="text"
                                  value={formatGuaraniesInput(item.precio_unitario.toString())}
                                  onChange={(e) => actualizarPrecio(index, parseGuaranies(e.target.value))}
                                  className="w-32 pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-right"
                                />
                              </div>
                              {item.producto.tipo === 'peso' && (
                                <span className="text-sm text-gray-600 font-medium">/kg</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₲</span>
                                <input
                                  type="text"
                                  value={formatGuaraniesInput(item.precio_venta.toString())}
                                  onChange={(e) => actualizarPrecioVenta(index, parseGuaranies(e.target.value))}
                                  className="w-32 pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-right"
                                />
                              </div>
                              {item.producto.tipo === 'peso' && (
                                <span className="text-sm text-gray-600 font-medium">/kg</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-indigo-600">
                            {formatGuaranies(item.subtotal)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => eliminarItem(index)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Cards */}
              <div className="lg:hidden space-y-3">
                {items.map((item, index) => {
                  const proveedor = proveedores.find(p => p.id === item.proveedor_id);
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-semibold text-gray-800">{item.producto.nombre}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              item.producto.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                              item.producto.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {item.producto.tipo === 'unidad' ? 'Unidad' :
                               item.producto.tipo === 'paquete' ? 'Paquete' :
                               'Peso'}
                            </span>
                            {item.producto.es_ropa_calzado && item.producto.talle && (
                              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                                Talle: {item.producto.talle}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{item.producto.codigo}</p>
                        </div>
                        <button
                          onClick={() => eliminarItem(index)}
                          className="text-red-600 hover:bg-red-100 p-2 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                        <select
                          value={item.proveedor_id}
                          onChange={(e) => actualizarProveedor(index, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                        >
                          <option value="">Seleccionar proveedor</option>
                          {proveedores.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.cantidad}
                            onChange={(e) => actualizarCantidad(index, parseFloat(e.target.value) || 0)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          {item.producto.tipo === 'peso' && (
                            <span className="text-sm text-gray-600 font-medium">kg</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Precio Compra{item.producto.tipo === 'peso' ? ' /kg' : ''}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₲</span>
                            <input
                              type="text"
                              value={formatGuaraniesInput(item.precio_unitario.toString())}
                              onChange={(e) => actualizarPrecio(index, parseGuaranies(e.target.value))}
                              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-right text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Precio Venta{item.producto.tipo === 'peso' ? ' /kg' : ''}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₲</span>
                            <input
                              type="text"
                              value={formatGuaraniesInput(item.precio_venta.toString())}
                              onChange={(e) => actualizarPrecioVenta(index, parseGuaranies(e.target.value))}
                              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-right text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Subtotal:</span>
                          <span className="text-lg font-bold text-indigo-600">{formatGuaranies(item.subtotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Total y acciones */}
              <div className="mt-6 pt-6 border-t space-y-4">
                <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-lg">
                  <span className="text-lg font-semibold text-gray-700">Total de la Compra:</span>
                  <span className="text-2xl md:text-3xl font-bold text-indigo-600">{formatGuaranies(getTotal())}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    placeholder="Agrega notas adicionales sobre esta compra..."
                  />
                </div>

                <button
                  onClick={procesarCompra}
                  disabled={loading || items.length === 0}
                  className="w-full py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl text-lg"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-6 h-6" />
                      Confirmar Compra
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">No hay productos en la compra</p>
              <p className="text-sm text-gray-500">Usa el buscador para agregar productos</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Producto No Encontrado */}
      {showNewProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Producto No Encontrado</h2>
              <p className="text-gray-600">
                No se encontró ningún producto con {searchType === 'codigo' ? 'el código' : 'el nombre'}: <span className="font-semibold">"{searchTerm}"</span>
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 font-medium">¿Es un producto nuevo?</p>
              <p className="text-xs text-blue-600 mt-1">Puedes agregarlo en el módulo de Productos</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoToProductos}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium flex items-center justify-center gap-2"
              >
                <Package className="w-5 h-5" />
                Ir a Agregar Producto
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowNewProductModal(false);
                  setSearchTerm('');
                }}
                className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
        </div>
      </div>
    </div>
  );
};
