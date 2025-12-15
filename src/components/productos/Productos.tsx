import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Producto, Proveedor } from '../../types';
import { Package, Plus, Edit, Trash2, Search, ShoppingBag, Camera } from 'lucide-react';
import { formatGuaranies, parseGuaranies, formatGuaraniesInput } from '../../utils/currency';
import { toast } from 'sonner';
import { ConfirmModal } from '../common/ConfirmModal';
import { Compras } from '../compras/Compras';
import { BarcodeScanner } from '../ventas/BarcodeScanner';

// Función para calcular el estado del producto
const getProductoEstado = (producto: any) => {
  const stockActual = producto.tipo === 'unidad'
    ? producto.stock_unidades
    : producto.tipo === 'paquete'
    ? producto.stock_paquetes
    : producto.stock_kg;

  const stockMinimo = producto.stock_minimo || 0;

  if (stockActual <= stockMinimo) {
    return { estado: 'Bajo', color: 'text-red-600 font-semibold', bgColor: 'bg-red-100 text-red-700' };
  } else if (stockActual <= stockMinimo * 1.5) {
    return { estado: 'Medio', color: 'text-yellow-600 font-semibold', bgColor: 'bg-yellow-100 text-yellow-700' };
  } else {
    return { estado: 'Normal', color: 'text-green-600 font-semibold', bgColor: 'bg-green-100 text-green-700' };
  }
};

// Función para obtener el stock como texto
const getStockTexto = (producto: any) => {
  if (producto.tipo === 'unidad') {
    return `${Math.round(producto.stock_unidades)} unidades`;
  } else if (producto.tipo === 'paquete') {
    return `${producto.stock_paquetes} paquetes`;
  } else {
    return `${producto.stock_kg.toFixed(2)} kg`;
  }
};

const ITEMS_PER_PAGE = 20;

export const Productos: React.FC = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showReposiciones, setShowReposiciones] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [focusedProductIndex, setFocusedProductIndex] = useState(-1);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');

  // Función para recargar productos cuando se complete una compra
  const handleCompraCompleted = () => {
    loadData();
  };

  // Función para manejar la navegación al módulo de productos (desde Compras)
  const handleNavigateToProductos = () => {
    // Mostrar el modal de agregar producto
    setShowModal(true);
    setEditingProduct(null); // Asegurarse de que esté en modo "crear"
  };

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
    codigo: '',
    nombre: '',
    descripcion: '',
    tipo: 'unidad' as 'unidad' | 'paquete' | 'peso',
    pesable: false,
    peso_por_unidad: '',
    unidades_por_paquete: '',
    precio_compra: '',
    precio_venta_unidad: '',
    precio_venta_paquete: '',
    precio_venta_kg: '',
    precio_mayorista_unidad: '',
    precio_mayorista_paquete: '',
    precio_mayorista_kg: '',
    stock_unidades: '',
    stock_paquetes: '',
    stock_kg: '',
    stock_minimo: '',
    is_active: true,
    proveedor_principal_id: '',
    categoria_id: '',
    es_ropa_calzado: false,
    talle: ''
  });

  // Unidades de medida para productos pesables
  const [unidadPeso, setUnidadPeso] = useState<'kg' | 'gramos'>('kg');
  const [unidadStock, setUnidadStock] = useState<'kg' | 'gramos'>('kg');
  const [unidadPrecio, setUnidadPrecio] = useState<'kg' | 'gramos'>('kg');

  // Estados para calculadora de porcentajes (NO se guardan en BD)
  const [calculadoraVisible, setCalculadoraVisible] = useState({
    precio_venta_unidad: false,
    precio_venta_paquete: false,
    precio_venta_kg: false,
    precio_mayorista_unidad: false,
    precio_mayorista_paquete: false,
    precio_mayorista_kg: false,
    precio_venta_unidad_paquete: false,
    precio_mayorista_unidad_paquete: false
  });

  const [porcentajes, setPorcentajes] = useState({
    precio_venta_unidad: '',
    precio_venta_paquete: '',
    precio_venta_kg: '',
    precio_mayorista_unidad: '',
    precio_mayorista_paquete: '',
    precio_mayorista_kg: '',
    precio_venta_unidad_paquete: '',
    precio_mayorista_unidad_paquete: ''
  });

  // Para paquetes - base personalizada para calcular precio por unidad
  const [basePrecioUnidadPaquete, setBasePrecioUnidadPaquete] = useState('');
  const [basePrecioMayoristaUnidadPaquete, setBasePrecioMayoristaUnidadPaquete] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Cerrar modal con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
        resetForm();
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showModal]);

  // Función para manejar el código escaneado desde la cámara
  const handleBarcodeScanned = (codigo: string) => {
    setFormData(prev => ({ ...prev, codigo }));
    setShowBarcodeScanner(false);
    toast.success('Código escaneado correctamente');
  };

  const loadData = async () => {
    try {
      const [productosRes, proveedoresRes, categoriasRes] = await Promise.all([
        supabase.from('productos').select('*').order('nombre'),
        supabase.from('proveedores').select('*').eq('is_active', true).order('nombre'),
        supabase.from('categorias').select('*').order('nombre')
      ]);

      if (productosRes.data) {
        const productos = productosRes.data;
        
        if (productos.length > 0 && proveedoresRes.data) {
          const productosConProveedor = productos.map(producto => {
            const proveedor = proveedoresRes.data.find(p => p.id === producto.proveedor_principal_id);
            const categoria = categoriasRes.data?.find(c => c.id === producto.categoria_id);
            return {
              ...producto,
              proveedor_principal: proveedor || null,
              categoria: categoria || null
            };
          });
          setProductos(productosConProveedor);
        } else {
          setProductos(productos);
        }
      }
      
      if (proveedoresRes.data) setProveedores(proveedoresRes.data);
      if (categoriasRes.data) setCategorias(categoriasRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name.includes('precio') || name.includes('stock')) {
      const numValue = parseGuaranies(value);
      setFormData(prev => ({ ...prev, [name]: numValue.toString() }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Funciones de conversión
  const convertirAKg = (valor: number, unidad: 'kg' | 'gramos'): number => {
    return unidad === 'gramos' ? valor / 1000 : valor;
  };

  const convertirDesdeKg = (valorKg: number, unidad: 'kg' | 'gramos'): number => {
    return unidad === 'gramos' ? valorKg * 1000 : valorKg;
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      tipo: 'unidad',
      pesable: false,
      peso_por_unidad: '',
      unidades_por_paquete: '',
      precio_compra: '',
      precio_venta_unidad: '',
      precio_venta_paquete: '',
      precio_venta_kg: '',
      precio_mayorista_unidad: '',
      precio_mayorista_paquete: '',
      precio_mayorista_kg: '',
      stock_unidades: '',
      stock_paquetes: '',
      stock_kg: '',
      stock_minimo: '',
      is_active: true,
      proveedor_principal_id: '',
      categoria_id: '',
      es_ropa_calzado: false,
      talle: ''
    });
    setEditingProduct(null);
    setUnidadPeso('kg');
    setUnidadStock('kg');
    setUnidadPrecio('kg');
    // Resetear calculadora de porcentajes
    setCalculadoraVisible({
      precio_venta_unidad: false,
      precio_venta_paquete: false,
      precio_venta_kg: false,
      precio_mayorista_unidad: false,
      precio_mayorista_paquete: false,
      precio_mayorista_kg: false,
      precio_venta_unidad_paquete: false,
      precio_mayorista_unidad_paquete: false
    });
    setPorcentajes({
      precio_venta_unidad: '',
      precio_venta_paquete: '',
      precio_venta_kg: '',
      precio_mayorista_unidad: '',
      precio_mayorista_paquete: '',
      precio_mayorista_kg: '',
      precio_venta_unidad_paquete: '',
      precio_mayorista_unidad_paquete: ''
    });
    setBasePrecioUnidadPaquete('');
    setBasePrecioMayoristaUnidadPaquete('');
  };

  // Funciones para calculadora de porcentajes
  const toggleCalculadora = (campo: keyof typeof calculadoraVisible) => {
    setCalculadoraVisible(prev => ({
      ...prev,
      [campo]: !prev[campo]
    }));
  };

  const handlePorcentajeChange = (campo: keyof typeof porcentajes, valor: string) => {
    setPorcentajes(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const calcularGanancia = (campo: keyof typeof porcentajes): string => {
    const porcentaje = parseFloat(porcentajes[campo] || '0');
    let base = 0;

    // Determinar la base según el campo
    if (campo === 'precio_venta_unidad_paquete' || campo === 'precio_mayorista_unidad_paquete') {
      // Para unidades de paquete, usar la base personalizada
      base = parseFloat(
        campo === 'precio_venta_unidad_paquete'
          ? basePrecioUnidadPaquete
          : basePrecioMayoristaUnidadPaquete
      ) || 0;
    } else {
      // Para el resto, usar precio_compra
      base = parseFloat(formData.precio_compra || '0');
    }

    const ganancia = (base * porcentaje) / 100;
    return ganancia.toString();
  };

  const calcularPrecioFinal = (campo: keyof typeof porcentajes): string => {
    const porcentaje = parseFloat(porcentajes[campo] || '0');
    let base = 0;

    if (campo === 'precio_venta_unidad_paquete' || campo === 'precio_mayorista_unidad_paquete') {
      base = parseFloat(
        campo === 'precio_venta_unidad_paquete'
          ? basePrecioUnidadPaquete
          : basePrecioMayoristaUnidadPaquete
      ) || 0;
    } else {
      base = parseFloat(formData.precio_compra || '0');
    }

    const precioFinal = base + (base * porcentaje / 100);
    // Redondear a entero ya que trabajamos con guaraníes (sin decimales)
    return Math.round(precioFinal).toString();
  };

  const aplicarPrecioCalculado = (campo: keyof typeof porcentajes) => {
    const precioFinal = calcularPrecioFinal(campo);

    // Mapear el campo de calculadora al campo del formulario
    let campoFormulario = campo as string;
    if (campo === 'precio_venta_unidad_paquete') {
      campoFormulario = 'precio_venta_unidad';
    } else if (campo === 'precio_mayorista_unidad_paquete') {
      campoFormulario = 'precio_mayorista_unidad';
    }

    setFormData(prev => ({
      ...prev,
      [campoFormulario]: precioFinal
    }));

    // Cerrar la calculadora después de aplicar
    setCalculadoraVisible(prev => ({
      ...prev,
      [campo]: false
    }));

    toast.success('Precio aplicado correctamente');
  };

  // Handler para prevenir Enter en el formulario general
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Handler para Enter en campos de calculadora
  const handleCalculadoraKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, campo: keyof typeof porcentajes) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // Solo aplicar si hay un porcentaje ingresado
      if (porcentajes[campo]) {
        // Para campos de paquete, verificar que haya base
        if (campo === 'precio_venta_unidad_paquete' && !basePrecioUnidadPaquete) return;
        if (campo === 'precio_mayorista_unidad_paquete' && !basePrecioMayoristaUnidadPaquete) return;

        aplicarPrecioCalculado(campo);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const productData: any = {
        codigo: formData.codigo,
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        tipo: formData.tipo,
        pesable: formData.pesable,
        precio_compra: parseFloat(formData.precio_compra) || 0,
        proveedor_principal_id: formData.proveedor_principal_id || null,
        categoria_id: formData.categoria_id || null,
        is_active: formData.is_active
      };

      if (formData.tipo === 'unidad') {
        productData.precio_venta_unidad = parseFloat(formData.precio_venta_unidad) || 0;
        productData.precio_mayorista_unidad = parseFloat(formData.precio_mayorista_unidad) || null;
        productData.stock_unidades = parseFloat(formData.stock_unidades) || 0;
        productData.stock_minimo = parseFloat(formData.stock_minimo) || 0;
        productData.es_ropa_calzado = formData.es_ropa_calzado;
        productData.talle = formData.es_ropa_calzado ? formData.talle : null;
        // Limpiar campos de otros tipos
        productData.precio_venta_paquete = 0;
        productData.precio_mayorista_paquete = null;
        productData.precio_venta_kg = 0;
        productData.precio_mayorista_kg = null;
        productData.stock_paquetes = 0;
        productData.stock_kg = 0;
        productData.unidades_por_paquete = null;
      } else if (formData.tipo === 'paquete') {
        productData.unidades_por_paquete = parseInt(formData.unidades_por_paquete) || 0;
        productData.precio_venta_paquete = parseFloat(formData.precio_venta_paquete) || 0;
        productData.precio_mayorista_paquete = parseFloat(formData.precio_mayorista_paquete) || null;
        productData.stock_paquetes = parseInt(formData.stock_paquetes) || 0;
        productData.stock_minimo = parseFloat(formData.stock_minimo) || 0;

        if (formData.precio_venta_unidad) {
          productData.precio_venta_unidad = parseFloat(formData.precio_venta_unidad) || 0;
          productData.precio_mayorista_unidad = parseFloat(formData.precio_mayorista_unidad) || null;
        } else {
          productData.precio_venta_unidad = 0;
          productData.precio_mayorista_unidad = null;
        }

        if (formData.stock_unidades) {
          productData.stock_unidades = parseInt(formData.stock_unidades) || 0;
        } else {
          productData.stock_unidades = 0;
        }

        // Limpiar campos de tipo peso
        productData.precio_venta_kg = 0;
        productData.precio_mayorista_kg = null;
        productData.stock_kg = 0;
        // Limpiar campos de ropa/calzado
        productData.es_ropa_calzado = false;
        productData.talle = null;
      } else if (formData.tipo === 'peso') {
        // Convertir a kg si está en gramos
        const precioEnKg = convertirAKg(parseFloat(formData.precio_venta_kg) || 0, unidadPrecio);
        const stockEnKg = convertirAKg(parseFloat(formData.stock_kg) || 0, unidadStock);
        const precioMayoristaEnKg = formData.precio_mayorista_kg
          ? convertirAKg(parseFloat(formData.precio_mayorista_kg) || 0, unidadPrecio)
          : null;

        productData.precio_venta_kg = precioEnKg;
        productData.precio_mayorista_kg = precioMayoristaEnKg;
        productData.stock_kg = stockEnKg;
        productData.stock_minimo = parseFloat(formData.stock_minimo) || 0;
        // Limpiar campos de otros tipos
        productData.precio_venta_unidad = 0;
        productData.precio_venta_paquete = 0;
        productData.stock_unidades = 0;
        productData.stock_paquetes = 0;
        productData.unidades_por_paquete = null;
        // Limpiar campos de ropa/calzado
        productData.es_ropa_calzado = false;
        productData.talle = null;
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('productos')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('Producto actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('productos')
          .insert(productData);

        if (error) throw error;
        toast.success('Producto creado exitosamente');
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error guardando producto:', error);
      toast.error(error.message || 'Error al guardar el producto');
    }
  };

  const handleEdit = (producto: Producto) => {
    setEditingProduct(producto);
    setFormData({
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      tipo: producto.tipo,
      pesable: producto.pesable,
      peso_por_unidad: producto.peso_por_unidad?.toString() || '',
      unidades_por_paquete: producto.unidades_por_paquete?.toString() || '',
      precio_compra: producto.precio_compra?.toString() || '',
      precio_venta_unidad: producto.precio_venta_unidad?.toString() || '',
      precio_venta_paquete: producto.precio_venta_paquete?.toString() || '',
      precio_venta_kg: producto.precio_venta_kg?.toString() || '',
      precio_mayorista_unidad: producto.precio_mayorista_unidad?.toString() || '',
      precio_mayorista_paquete: producto.precio_mayorista_paquete?.toString() || '',
      precio_mayorista_kg: producto.precio_mayorista_kg?.toString() || '',
      stock_unidades: producto.stock_unidades?.toString() || '',
      stock_paquetes: producto.stock_paquetes?.toString() || '',
      stock_kg: producto.stock_kg?.toString() || '',
      stock_minimo: producto.stock_minimo?.toString() || '',
      is_active: producto.is_active ?? true,
      proveedor_principal_id: producto.proveedor_principal_id || '',
      categoria_id: producto.categoria_id || '',
      es_ropa_calzado: producto.es_ropa_calzado || false,
      talle: producto.talle || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (producto: Producto) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Desactivar Producto?',
      message: `¿Estás seguro de desactivar el producto "${producto.nombre}"?\n\nAl desactivar este producto:\n• NO aparecerá en el módulo de Ventas\n• NO se podrá vender ni agregar al carrito\n• Seguirá visible en Inventario con marca de "INACTIVO"\n• Podrás reactivarlo en cualquier momento desde el botón de estado\n\nNota: El producto NO se elimina, solo se desactiva.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('productos')
            .update({ is_active: false })
            .eq('id', producto.id);

          if (error) throw error;
          toast.success('Producto desactivado exitosamente');
          setConfirmModal({ ...confirmModal, isOpen: false });
          loadData();
        } catch (error: any) {
          console.error('Error desactivando producto:', error);
          toast.error(error.message || 'Error al desactivar el producto');
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      }
    });
  };

  const filteredProductos = productos.filter(p => {
    // Filtro de búsqueda
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro de estado
    const matchesEstado = filtroEstado === 'todos' ? true :
      filtroEstado === 'activos' ? p.is_active === true :
      p.is_active === false;

    // Filtro de categoría
    const matchesCategoria = filtroCategoria === 'todas' ? true :
      p.categoria_id === filtroCategoria;

    return matchesSearch && matchesEstado && matchesCategoria;
  });

  // Calcular paginación
  const totalPages = Math.ceil(filteredProductos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProductos = filteredProductos.slice(startIndex, endIndex);

  // Resetear página cuando cambia el término de búsqueda o filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filtroEstado, filtroCategoria]);

  // Navegación con teclado en la lista de productos
  useEffect(() => {
    if (paginatedProductos.length === 0 || showModal || showReposiciones) {
      setFocusedProductIndex(-1);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Si hay solo un resultado con búsqueda activa, Enter lo abre directamente
      if (e.key === 'Enter' && searchTerm && paginatedProductos.length === 1) {
        e.preventDefault();
        handleEdit(paginatedProductos[0]);
        return;
      }

      // Navegación con flechas
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedProductIndex(prev => {
            // Si no hay selección, empezar en 0
            if (prev === -1) return 0;
            const next = prev + 1;
            return next >= paginatedProductos.length ? 0 : next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedProductIndex(prev => {
            // Si no hay selección, empezar en el último
            if (prev === -1) return paginatedProductos.length - 1;
            const next = prev - 1;
            return next < 0 ? paginatedProductos.length - 1 : next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedProductIndex >= 0 && focusedProductIndex < paginatedProductos.length) {
            handleEdit(paginatedProductos[focusedProductIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paginatedProductos, focusedProductIndex, searchTerm, showModal, showReposiciones]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-1 md:p-6 space-y-3 md:space-y-6">
      <div className="space-y-3 md:space-y-4">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800">Productos</h1>
        <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm md:text-base"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="whitespace-nowrap">Nuevo Producto</span>
          </button>
          <button
            onClick={() => setShowReposiciones(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md text-sm md:text-base"
          >
            <ShoppingBag className="w-4 h-4 md:w-5 md:h-5" />
            <span className="whitespace-nowrap">Reposiciones</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-1.5 md:p-4">
        <div className="space-y-2 md:space-y-3 mb-3 md:mb-4">
          {/* Barra de búsqueda */}
          <div className="flex items-center gap-1.5 md:gap-2">
            <Search className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-2 py-1.5 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm md:text-base"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as 'todos' | 'activos' | 'inactivos')}
                className="w-full px-2 py-1.5 md:px-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full px-2 py-1.5 md:px-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              >
                <option value="todas">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredProductos.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {searchTerm ? 'No se encontraron productos' : 'No hay productos registrados'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm
                ? 'Intenta con otros términos de búsqueda'
                : 'Haz clic en "Nuevo Producto" para crear tu primer producto'
              }
            </p>
          </div>
        ) : (
          <>
          {/* Vista Desktop - Tabla */}
          <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Código</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Talle</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Precio Compra</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Precio Venta</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stock Mín.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Proveedor</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProductos.map((producto, idx) => {
                const estado = getProductoEstado(producto);
                const isFocused = focusedProductIndex === idx;
                const isInactive = !producto.is_active;
                return (
                <tr key={producto.id} className={`border-b ${isInactive ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'} ${isFocused ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500' : ''} ${isInactive ? 'relative' : ''}`}>
                  <td className={`px-4 py-3 text-sm ${isInactive ? 'text-gray-500' : 'text-gray-800'}`}>{producto.codigo}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <span className={isInactive ? 'text-gray-500' : 'text-gray-800'}>{producto.nombre}</span>
                      {isInactive && (
                        <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">INACTIVO</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      producto.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                      producto.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {producto.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {producto.es_ropa_calzado && producto.talle ? (
                      <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                        {producto.talle}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {formatGuaranies(producto.precio_compra || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {producto.tipo === 'unidad'
                      ? formatGuaranies(producto.precio_venta_unidad || 0)
                      : producto.tipo === 'paquete'
                      ? formatGuaranies(producto.precio_venta_paquete || 0)
                      : formatGuaranies(producto.precio_venta_kg || 0) + '/kg'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={estado.estado === 'Bajo' ? 'text-red-600 font-semibold' : 'text-gray-800'}>
                      {getStockTexto(producto)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {producto.stock_minimo || 0} {producto.tipo === 'unidad' ? 'unidades' :
                     producto.tipo === 'peso' ? 'kg' : 'paquetes'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${estado.bgColor}`}>
                      {estado.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {producto.proveedor_principal?.nombre || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(producto)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(producto)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* Vista Móvil - Tarjetas */}
          <div className="lg:hidden space-y-1.5">
            {paginatedProductos.map((producto, idx) => {
              const estado = getProductoEstado(producto);
              const isFocused = focusedProductIndex === idx;
              const isInactive = !producto.is_active;
              return (
                <div key={producto.id} className={`border rounded-lg p-2 space-y-1.5 ${isInactive ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'} ${isFocused ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}>
                  {/* Header de la tarjeta */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold text-sm ${isInactive ? 'text-gray-500' : 'text-gray-900'}`}>{producto.nombre}</h3>
                        {isInactive && (
                          <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">INACTIVO</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Código: {producto.codigo}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleEdit(producto)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(producto)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Información en grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 block mb-0.5">Tipo</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold inline-block ${
                        producto.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                        producto.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {producto.tipo}
                      </span>
                    </div>

                    {producto.es_ropa_calzado && producto.talle && (
                      <div>
                        <span className="text-gray-500 block mb-0.5">Talle</span>
                        <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-md text-xs font-medium inline-block">
                          {producto.talle}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-gray-500 block mb-0.5">Precio Compra</span>
                      <span className="font-medium text-gray-900">{formatGuaranies(producto.precio_compra || 0)}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 block mb-0.5">Precio Venta</span>
                      <span className="font-medium text-gray-900">
                        {producto.tipo === 'unidad'
                          ? formatGuaranies(producto.precio_venta_unidad || 0)
                          : producto.tipo === 'paquete'
                          ? formatGuaranies(producto.precio_venta_paquete || 0)
                          : formatGuaranies(producto.precio_venta_kg || 0) + '/kg'}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 block mb-0.5">Stock</span>
                      <span className={estado.estado === 'Bajo' ? 'text-red-600 font-semibold' : 'text-gray-900 font-medium'}>
                        {getStockTexto(producto)}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 block mb-0.5">Stock Mín.</span>
                      <span className="text-gray-900">
                        {producto.stock_minimo || 0} {producto.tipo === 'unidad' ? 'unidades' :
                         producto.tipo === 'peso' ? 'kg' : 'paquetes'}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 block mb-0.5">Estado</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold inline-block ${estado.bgColor}`}>
                        {estado.estado}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 block mb-0.5">Proveedor</span>
                      <span className="text-gray-900">{producto.proveedor_principal?.nombre || '-'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border">
              <div className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredProductos.length)} de {filteredProductos.length} productos
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Primera
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Anterior
                </button>
                <span className="px-4 py-2 text-sm font-medium">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Última
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl md:max-w-7xl max-h-[90vh] overflow-y-auto">
            <div className="p-3 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Código <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="codigo"
                        value={formData.codigo}
                        onChange={handleInputChange}
                        required
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      {/* Botón de cámara - solo visible en móviles */}
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="md:hidden p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                        title="Escanear código de barras"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nombre <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Producto <span className="text-red-500">*</span></label>
                    <select
                      name="tipo"
                      value={formData.tipo}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="unidad">Unidad</option>
                      <option value="paquete">Paquete</option>
                      <option value="peso">Peso (Kg)</option>
                    </select>
                  </div>

                  {/* Botón interruptor de estado activo/inactivo */}
                  <div className="col-span-full">
                    <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition cursor-pointer">
                      <div className="flex-1 pr-4">
                        <span className="text-sm font-medium text-gray-700">Estado del Producto</span>
                        <p className="text-xs text-gray-500 mt-1">
                          {formData.is_active ? 'Producto activo (visible y utilizable)' : 'Producto inactivo (oculto y no utilizable)'}
                        </p>
                        {!formData.is_active && (
                          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs text-red-700 font-medium mb-1">⚠️ Al desactivar este producto:</p>
                            <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                              <li>NO aparecerá en el módulo de <strong>Ventas</strong></li>
                              <li>NO se podrá vender ni agregar al carrito</li>
                              <li>Seguirá visible en <strong>Inventario</strong> con marca de "INACTIVO"</li>
                              <li>Podrás reactivarlo en cualquier momento</li>
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="relative flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                          className="sr-only"
                        />
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.is_active ? 'bg-green-600' : 'bg-red-400'
                        }`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </div>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor Principal</label>
                    <select
                      name="proveedor_principal_id"
                      value={formData.proveedor_principal_id}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Sin proveedor</option>
                      {proveedores.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                    <select
                      name="categoria_id"
                      value={formData.categoria_id}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Sin categoría</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Precio de Compra - Campo común para todos los productos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.tipo === 'peso' ? 'Precio de Compra por Kg' : 'Precio de Compra'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">₲</span>
                    <input
                      type="text"
                      name="precio_compra"
                      value={formatGuaraniesInput(formData.precio_compra)}
                      onChange={handleInputChange}
                      required
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                </div>

                {formData.tipo === 'unidad' && (
                  <div className="p-4 bg-blue-50 rounded-lg space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Precio Venta/Unidad <span className="text-red-500">*</span>
                          <button
                            type="button"
                            onClick={() => toggleCalculadora('precio_venta_unidad')}
                            className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm"
                            title="Calculadora de porcentaje"
                          >
                            🧮 %
                          </button>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">₲</span>
                          <input
                            type="text"
                            name="precio_venta_unidad"
                            value={formatGuaraniesInput(formData.precio_venta_unidad)}
                            onChange={handleInputChange}
                            required
                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>

                        {/* Calculadora de porcentaje */}
                        {calculadoraVisible.precio_venta_unidad && (
                          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                            <div className="text-xs">
                              <span className="font-medium text-gray-700">Precio base:</span>
                              <span className="ml-2 text-indigo-900 font-semibold">
                                {formatGuaranies(formData.precio_compra || '0')}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-700">Ganancia:</label>
                              <input
                                type="number"
                                value={porcentajes.precio_venta_unidad}
                                onChange={(e) => handlePorcentajeChange('precio_venta_unidad', e.target.value)}
                                onKeyDown={(e) => handleCalculadoraKeyDown(e, 'precio_venta_unidad')}
                                className="w-16 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="0"
                                min="0"
                                step="0.1"
                              />
                              <span className="text-xs font-medium">%</span>

                              {porcentajes.precio_venta_unidad && (
                                <span className="ml-1 text-xs text-green-700 font-medium">
                                  = +{formatGuaranies(calcularGanancia('precio_venta_unidad'))}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                              <div className="text-xs">
                                <span className="font-medium text-gray-700">Precio final:</span>
                                <span className="ml-2 text-sm font-bold text-indigo-900">
                                  {formatGuaranies(calcularPrecioFinal('precio_venta_unidad'))}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => aplicarPrecioCalculado('precio_venta_unidad')}
                                className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 flex items-center gap-1"
                              >
                                ✓ Aplicar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Precio Mayorista/Unidad <span className="text-xs text-gray-500">(opcional)</span>
                          <button
                            type="button"
                            onClick={() => toggleCalculadora('precio_mayorista_unidad')}
                            className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm"
                            title="Calculadora de porcentaje"
                          >
                            🧮 %
                          </button>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">₲</span>
                          <input
                            type="text"
                            name="precio_mayorista_unidad"
                            value={formatGuaraniesInput(formData.precio_mayorista_unidad)}
                            onChange={handleInputChange}
                            placeholder="0"
                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>

                        {/* Calculadora de porcentaje */}
                        {calculadoraVisible.precio_mayorista_unidad && (
                          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                            <div className="text-xs">
                              <span className="font-medium text-gray-700">Precio base:</span>
                              <span className="ml-2 text-indigo-900 font-semibold">
                                {formatGuaranies(formData.precio_compra || '0')}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-700">Ganancia:</label>
                              <input
                                type="number"
                                value={porcentajes.precio_mayorista_unidad}
                                onChange={(e) => handlePorcentajeChange('precio_mayorista_unidad', e.target.value)}
                                onKeyDown={(e) => handleCalculadoraKeyDown(e, 'precio_mayorista_unidad')}
                                className="w-16 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="0"
                                min="0"
                                step="0.1"
                              />
                              <span className="text-xs font-medium">%</span>

                              {porcentajes.precio_mayorista_unidad && (
                                <span className="ml-1 text-xs text-green-700 font-medium">
                                  = +{formatGuaranies(calcularGanancia('precio_mayorista_unidad'))}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                              <div className="text-xs">
                                <span className="font-medium text-gray-700">Precio final:</span>
                                <span className="ml-2 text-sm font-bold text-indigo-900">
                                  {formatGuaranies(calcularPrecioFinal('precio_mayorista_unidad'))}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => aplicarPrecioCalculado('precio_mayorista_unidad')}
                                className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 flex items-center gap-1"
                              >
                                ✓ Aplicar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock Unidades <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          step="0.01"
                          name="stock_unidades"
                          value={formData.stock_unidades}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock Mínimo <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          step="0.01"
                          name="stock_minimo"
                          value={formData.stock_minimo}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Checkbox para ropa/calzado */}
                    <div className="border-t border-blue-200 pt-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="es_ropa_calzado"
                          checked={formData.es_ropa_calzado}
                          onChange={handleInputChange}
                          className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">¿Es ropa o calzado?</span>
                      </label>
                    </div>

                    {/* Campo de talle (solo si es ropa/calzado) */}
                    {formData.es_ropa_calzado && (
                      <div className="pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Talle <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="talle"
                          value={formData.talle}
                          onChange={handleInputChange}
                          placeholder="Ej: M, L, XL, 42, 43, etc."
                          required={formData.es_ropa_calzado}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Ingresa el talle o número del producto</p>
                      </div>
                    )}
                  </div>
                )}

                {formData.tipo === 'peso' && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-3">Configuración de Producto por Peso</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Precio de Venta por Kg */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Precio de Venta por Kg <span className="text-red-500">*</span>
                          <button
                            type="button"
                            onClick={() => toggleCalculadora('precio_venta_kg')}
                            className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm"
                            title="Calculadora de porcentaje"
                          >
                            🧮 %
                          </button>
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-2 text-gray-500">₲</span>
                            <input
                              type="text"
                              name="precio_venta_kg"
                              value={formatGuaraniesInput(formData.precio_venta_kg)}
                              onChange={handleInputChange}
                              required
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder="0"
                            />
                          </div>
                          <select
                            value={unidadPrecio}
                            onChange={(e) => setUnidadPrecio(e.target.value as 'kg' | 'gramos')}
                            className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-sm font-medium"
                          >
                            <option value="kg">/Kg</option>
                            <option value="gramos">/g</option>
                          </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Precio por kilogramo del producto</p>

                        {/* Calculadora de porcentaje */}
                        {calculadoraVisible.precio_venta_kg && (
                          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                            <div className="text-xs">
                              <span className="font-medium text-gray-700">Precio base:</span>
                              <span className="ml-2 text-indigo-900 font-semibold">
                                {formatGuaranies(formData.precio_compra || '0')}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-700">Ganancia:</label>
                              <input
                                type="number"
                                value={porcentajes.precio_venta_kg}
                                onChange={(e) => handlePorcentajeChange('precio_venta_kg', e.target.value)}
                                onKeyDown={(e) => handleCalculadoraKeyDown(e, 'precio_venta_kg')}
                                className="w-16 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="0"
                                min="0"
                                step="0.1"
                              />
                              <span className="text-xs font-medium">%</span>

                              {porcentajes.precio_venta_kg && (
                                <span className="ml-1 text-xs text-green-700 font-medium">
                                  = +{formatGuaranies(calcularGanancia('precio_venta_kg'))}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                              <div className="text-xs">
                                <span className="font-medium text-gray-700">Precio final:</span>
                                <span className="ml-2 text-sm font-bold text-indigo-900">
                                  {formatGuaranies(calcularPrecioFinal('precio_venta_kg'))}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => aplicarPrecioCalculado('precio_venta_kg')}
                                className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 flex items-center gap-1"
                              >
                                ✓ Aplicar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Precio Mayorista por Kg */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Precio Mayorista por Kg
                          <button
                            type="button"
                            onClick={() => toggleCalculadora('precio_mayorista_kg')}
                            className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm"
                            title="Calculadora de porcentaje"
                          >
                            🧮 %
                          </button>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">₲</span>
                          <input
                            type="text"
                            name="precio_mayorista_kg"
                            value={formatGuaraniesInput(formData.precio_mayorista_kg)}
                            onChange={handleInputChange}
                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Precio mayorista por kg (opcional)</p>

                        {/* Calculadora de porcentaje */}
                        {calculadoraVisible.precio_mayorista_kg && (
                          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                            <div className="text-xs">
                              <span className="font-medium text-gray-700">Precio base:</span>
                              <span className="ml-2 text-indigo-900 font-semibold">
                                {formatGuaranies(formData.precio_compra || '0')}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-700">Ganancia:</label>
                              <input
                                type="number"
                                value={porcentajes.precio_mayorista_kg}
                                onChange={(e) => handlePorcentajeChange('precio_mayorista_kg', e.target.value)}
                                onKeyDown={(e) => handleCalculadoraKeyDown(e, 'precio_mayorista_kg')}
                                className="w-16 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="0"
                                min="0"
                                step="0.1"
                              />
                              <span className="text-xs font-medium">%</span>

                              {porcentajes.precio_mayorista_kg && (
                                <span className="ml-1 text-xs text-green-700 font-medium">
                                  = +{formatGuaranies(calcularGanancia('precio_mayorista_kg'))}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                              <div className="text-xs">
                                <span className="font-medium text-gray-700">Precio final:</span>
                                <span className="ml-2 text-sm font-bold text-indigo-900">
                                  {formatGuaranies(calcularPrecioFinal('precio_mayorista_kg'))}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => aplicarPrecioCalculado('precio_mayorista_kg')}
                                className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 flex items-center gap-1"
                              >
                                ✓ Aplicar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stock Actual */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock Actual <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            name="stock_kg"
                            value={formData.stock_kg}
                            onChange={handleInputChange}
                            required
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="0.00"
                          />
                          <select
                            value={unidadStock}
                            onChange={(e) => setUnidadStock(e.target.value as 'kg' | 'gramos')}
                            className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-sm font-medium"
                          >
                            <option value="kg">Kg</option>
                            <option value="gramos">g</option>
                          </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Cantidad en kilogramos disponible</p>
                      </div>

                      {/* Stock Mínimo */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock Mínimo (Kg) <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          step="0.01"
                          name="stock_minimo"
                          value={formData.stock_minimo}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                        <p className="text-xs text-gray-500 mt-1">Alerta de stock bajo</p>
                      </div>
                    </div>
                  </div>
                )}

                {formData.tipo === 'paquete' && (
                  <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-3">Configuración de Paquetes</h4>

                    {/* Unidades por paquete */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unidades por Paquete <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="unidades_por_paquete"
                        value={formData.unidades_por_paquete}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Ej: 12"
                      />
                      <p className="text-xs text-gray-500 mt-1">¿Cuántas unidades contiene cada paquete?</p>
                    </div>

                    {/* Precios de Venta */}
                    <div className="border-t pt-4">
                      <h5 className="font-medium text-gray-700 mb-3">Precios de Venta</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Precio por Paquete <span className="text-red-500">*</span>
                            <button
                              type="button"
                              onClick={() => toggleCalculadora('precio_venta_paquete')}
                              className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm"
                              title="Calculadora de porcentaje"
                            >
                              🧮 %
                            </button>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">₲</span>
                            <input
                              type="text"
                              name="precio_venta_paquete"
                              value={formatGuaraniesInput(formData.precio_venta_paquete)}
                              onChange={handleInputChange}
                              required
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder="0"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Precio de venta por paquete completo</p>

                          {/* Calculadora de porcentaje */}
                          {calculadoraVisible.precio_venta_paquete && (
                            <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                              <div className="text-xs">
                                <span className="font-medium text-gray-700">Precio base:</span>
                                <span className="ml-2 text-indigo-900 font-semibold">
                                  {formatGuaranies(formData.precio_compra || '0')}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-700">Ganancia:</label>
                                <input
                                  type="number"
                                  value={porcentajes.precio_venta_paquete}
                                  onChange={(e) => handlePorcentajeChange('precio_venta_paquete', e.target.value)}
                                  onKeyDown={(e) => handleCalculadoraKeyDown(e, 'precio_venta_paquete')}
                                  className="w-16 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                  placeholder="0"
                                  min="0"
                                  step="0.1"
                                />
                                <span className="text-xs font-medium">%</span>

                                {porcentajes.precio_venta_paquete && (
                                  <span className="ml-1 text-xs text-green-700 font-medium">
                                    = +{formatGuaranies(calcularGanancia('precio_venta_paquete'))}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                                <div className="text-xs">
                                  <span className="font-medium text-gray-700">Precio final:</span>
                                  <span className="ml-2 text-sm font-bold text-indigo-900">
                                    {formatGuaranies(calcularPrecioFinal('precio_venta_paquete'))}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => aplicarPrecioCalculado('precio_venta_paquete')}
                                  className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 flex items-center gap-1"
                                >
                                  ✓ Aplicar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Precio Mayorista Paquete <span className="text-xs text-gray-500">(Opcional)</span>
                            <button
                              type="button"
                              onClick={() => toggleCalculadora('precio_mayorista_paquete')}
                              className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm"
                              title="Calculadora de porcentaje"
                            >
                              🧮 %
                            </button>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">₲</span>
                            <input
                              type="text"
                              name="precio_mayorista_paquete"
                              value={formatGuaraniesInput(formData.precio_mayorista_paquete)}
                              onChange={handleInputChange}
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder="0"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Precio mayorista por paquete</p>

                          {/* Calculadora de porcentaje */}
                          {calculadoraVisible.precio_mayorista_paquete && (
                            <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                              <div className="text-xs">
                                <span className="font-medium text-gray-700">Precio base:</span>
                                <span className="ml-2 text-indigo-900 font-semibold">
                                  {formatGuaranies(formData.precio_compra || '0')}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-700">Ganancia:</label>
                                <input
                                  type="number"
                                  value={porcentajes.precio_mayorista_paquete}
                                  onChange={(e) => handlePorcentajeChange('precio_mayorista_paquete', e.target.value)}
                                  onKeyDown={(e) => handleCalculadoraKeyDown(e, 'precio_mayorista_paquete')}
                                  className="w-16 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                  placeholder="0"
                                  min="0"
                                  step="0.1"
                                />
                                <span className="text-xs font-medium">%</span>

                                {porcentajes.precio_mayorista_paquete && (
                                  <span className="ml-1 text-xs text-green-700 font-medium">
                                    = +{formatGuaranies(calcularGanancia('precio_mayorista_paquete'))}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                                <div className="text-xs">
                                  <span className="font-medium text-gray-700">Precio final:</span>
                                  <span className="ml-2 text-sm font-bold text-indigo-900">
                                    {formatGuaranies(calcularPrecioFinal('precio_mayorista_paquete'))}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => aplicarPrecioCalculado('precio_mayorista_paquete')}
                                  className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 flex items-center gap-1"
                                >
                                  ✓ Aplicar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Precio por Unidad <span className="text-xs text-gray-500">(Opcional)</span>
                            <button
                              type="button"
                              onClick={() => toggleCalculadora('precio_venta_unidad_paquete')}
                              className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm"
                              title="Calculadora de porcentaje"
                            >
                              🧮 %
                            </button>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">₲</span>
                            <input
                              type="text"
                              name="precio_venta_unidad"
                              value={formatGuaraniesInput(formData.precio_venta_unidad)}
                              onChange={handleInputChange}
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder="0"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Para vender unidades sueltas del paquete</p>

                          {/* Calculadora de porcentaje con base personalizable */}
                          {calculadoraVisible.precio_venta_unidad_paquete && (
                            <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                              {/* Campo para ingresar base personalizada */}
                              <div>
                                <label className="text-xs font-medium text-gray-700">Precio base por unidad:</label>
                                <div className="relative mt-1">
                                  <span className="absolute left-2 top-1.5 text-gray-500 text-xs">₲</span>
                                  <input
                                    type="text"
                                    value={formatGuaraniesInput(basePrecioUnidadPaquete)}
                                    onChange={(e) => setBasePrecioUnidadPaquete(parseGuaranies(e.target.value).toString())}
                                    className="w-full pl-6 pr-2 py-1.5 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                    placeholder={
                                      formData.precio_compra && formData.unidades_por_paquete
                                        ? `Sugerido: ${formatGuaranies((parseFloat(formData.precio_compra) / parseInt(formData.unidades_por_paquete || '1')).toString())}`
                                        : 'Ingresa precio base'
                                    }
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">Costo de cada unidad para calcular ganancia</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-700">Ganancia:</label>
                                <input
                                  type="number"
                                  value={porcentajes.precio_venta_unidad_paquete}
                                  onChange={(e) => handlePorcentajeChange('precio_venta_unidad_paquete', e.target.value)}
                                  onKeyDown={(e) => handleCalculadoraKeyDown(e, 'precio_venta_unidad_paquete')}
                                  className="w-16 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                  placeholder="0"
                                  min="0"
                                  step="0.1"
                                  disabled={!basePrecioUnidadPaquete}
                                />
                                <span className="text-xs font-medium">%</span>

                                {porcentajes.precio_venta_unidad_paquete && basePrecioUnidadPaquete && (
                                  <span className="ml-1 text-xs text-green-700 font-medium">
                                    = +{formatGuaranies(calcularGanancia('precio_venta_unidad_paquete'))}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                                <div className="text-xs">
                                  <span className="font-medium text-gray-700">Precio final:</span>
                                  <span className="ml-2 text-sm font-bold text-indigo-900">
                                    {formatGuaranies(calcularPrecioFinal('precio_venta_unidad_paquete'))}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => aplicarPrecioCalculado('precio_venta_unidad_paquete')}
                                  className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 flex items-center gap-1"
                                  disabled={!basePrecioUnidadPaquete}
                                >
                                  ✓ Aplicar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Precio Mayorista Unidad <span className="text-xs text-gray-500">(Opcional)</span>
                            <button
                              type="button"
                              onClick={() => toggleCalculadora('precio_mayorista_unidad_paquete')}
                              className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm"
                              title="Calculadora de porcentaje"
                            >
                              🧮 %
                            </button>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">₲</span>
                            <input
                              type="text"
                              name="precio_mayorista_unidad"
                              value={formatGuaraniesInput(formData.precio_mayorista_unidad)}
                              onChange={handleInputChange}
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder="0"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Precio mayorista por unidad suelta</p>

                          {/* Calculadora de porcentaje con base personalizable */}
                          {calculadoraVisible.precio_mayorista_unidad_paquete && (
                            <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                              {/* Campo para ingresar base personalizada */}
                              <div>
                                <label className="text-xs font-medium text-gray-700">Precio base por unidad:</label>
                                <div className="relative mt-1">
                                  <span className="absolute left-2 top-1.5 text-gray-500 text-xs">₲</span>
                                  <input
                                    type="text"
                                    value={formatGuaraniesInput(basePrecioMayoristaUnidadPaquete)}
                                    onChange={(e) => setBasePrecioMayoristaUnidadPaquete(parseGuaranies(e.target.value).toString())}
                                    className="w-full pl-6 pr-2 py-1.5 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                    placeholder={
                                      formData.precio_compra && formData.unidades_por_paquete
                                        ? `Sugerido: ${formatGuaranies((parseFloat(formData.precio_compra) / parseInt(formData.unidades_por_paquete || '1')).toString())}`
                                        : 'Ingresa precio base'
                                    }
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">Costo de cada unidad para calcular ganancia</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-700">Ganancia:</label>
                                <input
                                  type="number"
                                  value={porcentajes.precio_mayorista_unidad_paquete}
                                  onChange={(e) => handlePorcentajeChange('precio_mayorista_unidad_paquete', e.target.value)}
                                  onKeyDown={(e) => handleCalculadoraKeyDown(e, 'precio_mayorista_unidad_paquete')}
                                  className="w-16 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                  placeholder="0"
                                  min="0"
                                  step="0.1"
                                  disabled={!basePrecioMayoristaUnidadPaquete}
                                />
                                <span className="text-xs font-medium">%</span>

                                {porcentajes.precio_mayorista_unidad_paquete && basePrecioMayoristaUnidadPaquete && (
                                  <span className="ml-1 text-xs text-green-700 font-medium">
                                    = +{formatGuaranies(calcularGanancia('precio_mayorista_unidad_paquete'))}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                                <div className="text-xs">
                                  <span className="font-medium text-gray-700">Precio final:</span>
                                  <span className="ml-2 text-sm font-bold text-indigo-900">
                                    {formatGuaranies(calcularPrecioFinal('precio_mayorista_unidad_paquete'))}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => aplicarPrecioCalculado('precio_mayorista_unidad_paquete')}
                                  className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 flex items-center gap-1"
                                  disabled={!basePrecioMayoristaUnidadPaquete}
                                >
                                  ✓ Aplicar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stock */}
                    <div className="border-t pt-4">
                      <h5 className="font-medium text-gray-700 mb-3">Inventario</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Stock de Paquetes <span className="text-red-500">*</span></label>
                          <input
                            type="number"
                            name="stock_paquetes"
                            value={formData.stock_paquetes}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1">Paquetes completos en inventario</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Stock de Unidades Sueltas <span className="text-red-500">*</span></label>
                          <input
                            type="number"
                            name="stock_unidades"
                            value={formData.stock_unidades}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1">Unidades sueltas disponibles</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Stock Mínimo (Paquetes) <span className="text-red-500">*</span></label>
                          <input
                            type="number"
                            step="0.01"
                            name="stock_minimo"
                            value={formData.stock_minimo}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1">Alerta de stock bajo</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    {editingProduct ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
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

      {/* Modal de Reposiciones */}
      <Compras
        isOpen={showReposiciones}
        onClose={() => setShowReposiciones(false)}
        onCompraCompleted={handleCompraCompleted}
        onNavigateToProductos={handleNavigateToProductos}
      />

      {/* Escáner de código de barras */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
      />
    </div>
  );
};
