import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Producto, CartItem, TicketConfig, Venta, VentaItem, Cliente } from '../../types';
import { ShoppingCart, Search, Plus, Minus, Trash2, Check, Package, Edit2, FileX, Camera, DollarSign, Users } from 'lucide-react';
import { formatGuaranies, parseGuaranies, formatGuaraniesInput } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { AlertModal } from '../common/AlertModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { openTicketPDF } from '../../utils/generateTicketPDF';
import { BarcodeScanner } from './BarcodeScanner';
import { ClienteModal } from '../common/ClienteModal';

export const Ventas: React.FC = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAbrirPaquete, setShowAbrirPaquete] = useState(false);
  const [productoAbrir, setProductoAbrir] = useState<Producto | null>(null);
  const [cantidadPaquetes, setCantidadPaquetes] = useState('1');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingCantidad, setEditingCantidad] = useState('');
  const [productoPorSeleccionar, setProductoPorSeleccionar] = useState<Producto | null>(null);
  // Navegación con teclado
  const [focusedProductIndex, setFocusedProductIndex] = useState(-1);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(0);
  const [keyboardNavigationEnabled, setKeyboardNavigationEnabled] = useState(false);
  const { user, hasPermission } = useAuth();
  const [showAnulaciones, setShowAnulaciones] = useState(false);
  const [ventasRecientes, setVentasRecientes] = useState<any[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<any | null>(null);
  const [itemsAnular, setItemsAnular] = useState<Map<string, number>>(new Map()); // venta_item_id -> cantidad a anular
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [cantidadesYaAnuladas, setCantidadesYaAnuladas] = useState<Map<string, number>>(new Map()); // venta_item_id -> cantidad ya anulada
  // Estados para búsqueda y filtros de anulaciones
  const [searchNumeroVenta, setSearchNumeroVenta] = useState('');
  const [tipoFiltroFecha, setTipoFiltroFecha] = useState<'todos' | 'fecha_especifica' | 'rango'>('todos');
  const [fechaEspecifica, setFechaEspecifica] = useState('');
  const [fechaDesdeAnulacion, setFechaDesdeAnulacion] = useState('');
  const [fechaHastaAnulacion, setFechaHastaAnulacion] = useState('');
  const [focusedVentaIndex, setFocusedVentaIndex] = useState(-1);
  const [keyboardNavAnulaciones, setKeyboardNavAnulaciones] = useState(false);
  const [focusedItemAnularIndex, setFocusedItemAnularIndex] = useState(-1);
  const [unidadesPesoAnular, setUnidadesPesoAnular] = useState<Map<string, 'kg' | 'g'>>(new Map()); // venta_item_id -> unidad de peso
  const [cantidadesAnularTemp, setCantidadesAnularTemp] = useState<Map<string, string>>(new Map()); // Para edición temporal

  // Estados para marcar como fiado en operaciones
  const [showClienteModalOperaciones, setShowClienteModalOperaciones] = useState(false);
  const [clienteSeleccionadoFiado, setClienteSeleccionadoFiado] = useState<Cliente | null>(null);

  // Paginación de productos
  const [paginaActualProductos, setPaginaActualProductos] = useState(1);
  const [totalProductos, setTotalProductos] = useState(0);
  const productosPorPagina = 15;

  // Paginación de ventas recientes en modal de anulaciones
  const [paginaActualVentas, setPaginaActualVentas] = useState(1);
  const [totalVentas, setTotalVentas] = useState(0);
  const ventasPorPagina = 15;

  // Escáner de código de barras
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Modal de ingreso de peso
  const [showPesoModal, setShowPesoModal] = useState(false);
  const [productoPesable, setProductoPesable] = useState<Producto | null>(null);
  const [pesoIngresado, setPesoIngresado] = useState('');
  const [editingPesableIndex, setEditingPesableIndex] = useState<number | null>(null);
  const [unidadPesoVenta, setUnidadPesoVenta] = useState<'kg' | 'g'>('kg');

  // Estados para vuelto, fiado y mayorista
  const [dineroRecibido, setDineroRecibido] = useState('');
  const [esFiado, setEsFiado] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [esMayorista, setEsMayorista] = useState(false);

  // Modal de confirmación de venta
  const [showConfirmVentaModal, setShowConfirmVentaModal] = useState(false);
  const [dineroRecibidoModal, setDineroRecibidoModal] = useState('');
  const [blockConfirmVentaModal, setBlockConfirmVentaModal] = useState(false);

  // Funciones de conversión
  const convertirAKg = (valor: number, unidad: 'kg' | 'g'): number => {
    return unidad === 'g' ? valor / 1000 : valor;
  };

  const convertirDesdeKg = (valorKg: number, unidad: 'kg' | 'g'): number => {
    return unidad === 'g' ? valorKg * 1000 : valorKg;
  };

  // Función para formatear peso (mostrar sin decimales si es número exacto)
  const formatearPeso = (kg: number): string => {
    if (Number.isInteger(kg)) {
      return kg.toString();
    }
    return kg.toFixed(3);
  };

  // Función para obtener el precio correcto según el modo mayorista
  const obtenerPrecio = (producto: Producto, tipo: 'unidad' | 'paquete' | 'kg'): number => {
    if (tipo === 'unidad') {
      return esMayorista && producto.precio_mayorista_unidad
        ? producto.precio_mayorista_unidad
        : (producto.precio_venta_unidad || 0);
    } else if (tipo === 'paquete') {
      return esMayorista && producto.precio_mayorista_paquete
        ? producto.precio_mayorista_paquete
        : (producto.precio_venta_paquete || 0);
    } else {
      // kg también tiene precio mayorista
      return esMayorista && producto.precio_mayorista_kg
        ? producto.precio_mayorista_kg
        : (producto.precio_venta_kg || 0);
    }
  };

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

  // Confirm modal para abrir paquete
  const [confirmAbrirPaquete, setConfirmAbrirPaquete] = useState<{
    isOpen: boolean;
    producto: Producto | null;
  }>({
    isOpen: false,
    producto: null
  });

  useEffect(() => {
    loadProductos();
  }, []);

  useEffect(() => {
    loadProductos();
  }, [paginaActualProductos]);

  // Event listener para navegación con teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // No procesar si hay algún modal abierto
      if (showAnulaciones || showPesoModal || showClienteModal || showClienteModalOperaciones || showConfirmVentaModal) return;

      // Filtrar productos según búsqueda
      const currentFiltered = productos.filter(producto =>
        producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        producto.codigo.toLowerCase().includes(searchTerm.toLowerCase())
      );

      switch (e.key) {
        case 'ArrowDown':
          // Solo procesar flechas si hay productos filtrados
          if (currentFiltered.length === 0) return;
          e.preventDefault();
          // Solo activar si no está habilitada aún
          if (!keyboardNavigationEnabled) {
            setKeyboardNavigationEnabled(true);
            setFocusedProductIndex(0);
            setFocusedOptionIndex(0);
          } else {
            // Down: siguiente opción del producto enfocado
            const productoDown = currentFiltered[focusedProductIndex];
            if (productoDown.tipo === 'paquete' && productoDown.precio_venta_unidad) {
              setFocusedOptionIndex(prev => (prev + 1) % 2); // alternar entre 0 y 1
            }
          }
          break;
        case 'ArrowUp':
          // Solo procesar flechas si hay productos filtrados
          if (currentFiltered.length === 0) return;
          e.preventDefault();
          // Solo activar si no está habilitada aún
          if (!keyboardNavigationEnabled) {
            setKeyboardNavigationEnabled(true);
            setFocusedProductIndex(0);
            setFocusedOptionIndex(0);
          } else {
            // Up: opción anterior del producto enfocado
            const productoUp = currentFiltered[focusedProductIndex];
            if (productoUp.tipo === 'paquete' && productoUp.precio_venta_unidad) {
              setFocusedOptionIndex(prev => (prev - 1 + 2) % 2); // alternar entre 0 y 1
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          // Si hay una selección activa de producto, procesar esa selección
          if (focusedProductIndex !== -1 && focusedProductIndex < currentFiltered.length) {
            // Ejecutar la acción basada en la opción enfocada
            const producto = currentFiltered[focusedProductIndex];
            if (producto.tipo === 'unidad' && !producto.pesable) {
              addToCart(producto, 'unidad');
              setSearchTerm('');
              setFocusedProductIndex(-1); // Desactivar selección
              setKeyboardNavigationEnabled(false); // Desactivar navegación
            } else if (producto.tipo === 'peso') {
              addToCart(producto, 'kg');
              setSearchTerm('');
              setFocusedProductIndex(-1); // Desactivar selección
              setKeyboardNavigationEnabled(false); // Desactivar navegación
            } else if (producto.tipo === 'paquete' && !producto.precio_venta_unidad) {
              addToCart(producto, 'paquete');
              setSearchTerm('');
              setFocusedProductIndex(-1); // Desactivar selección
              setKeyboardNavigationEnabled(false); // Desactivar navegación
            } else if (producto.tipo === 'paquete' && producto.precio_venta_unidad) {
              // Producto con múltiples opciones - usar la opción enfocada
              const tipo = focusedOptionIndex === 0 ? 'paquete' : 'unidad';
              addToCart(producto, tipo);
              setSearchTerm('');
              setFocusedProductIndex(-1); // Desactivar selección
              setKeyboardNavigationEnabled(false); // Desactivar navegación
            }
          }
          // Finalizar venta requiere Shift + Enter para evitar activación accidental
          if (e.shiftKey && cart.length > 0 && !blockConfirmVentaModal) {
            e.preventDefault();
            handlePrepararVenta();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productos, searchTerm, focusedProductIndex, focusedOptionIndex, keyboardNavigationEnabled, showAnulaciones, showPesoModal, showClienteModal, showClienteModalOperaciones, showConfirmVentaModal, blockConfirmVentaModal, cart]);

  // Resetear índices cuando cambian los productos filtrados
  useEffect(() => {
    const currentFiltered = productos.filter(producto =>
      producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (currentFiltered.length > 0) {
      setFocusedProductIndex(-1); // Mantener sin selección
      setKeyboardNavigationEnabled(false); // Mantener navegación desactivada
      setFocusedOptionIndex(0);
    }
  }, [productos, searchTerm.length]);

  // Manejador de teclas para el modal de peso
  useEffect(() => {
    const handleKeyDownPeso = (e: KeyboardEvent) => {
      if (showPesoModal && e.key === 'Escape') {
        e.preventDefault();
        setShowPesoModal(false);
        setPesoIngresado('');
        setProductoPesable(null);
        setEditingPesableIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDownPeso);
    return () => window.removeEventListener('keydown', handleKeyDownPeso);
  }, [showPesoModal]);

  // Manejador de teclas para el modal de confirmación de venta
  useEffect(() => {
    const handleKeyDownConfirmVenta = (e: KeyboardEvent) => {
      if (showConfirmVentaModal && e.key === 'Escape') {
        e.preventDefault();
        setShowConfirmVentaModal(false);
        setDineroRecibidoModal('');
      }
    };

    window.addEventListener('keydown', handleKeyDownConfirmVenta);
    return () => window.removeEventListener('keydown', handleKeyDownConfirmVenta);
  }, [showConfirmVentaModal]);

  // Cargar ventas recientes cuando se abre el modal de anulaciones
  useEffect(() => {
    if (showAnulaciones) {
      cargarVentasRecientes();
    }
  }, [showAnulaciones]);

  // Recargar ventas cuando cambien los filtros o la página
  useEffect(() => {
    if (showAnulaciones) {
      cargarVentasRecientes();
    }
  }, [searchNumeroVenta, tipoFiltroFecha, fechaEspecifica, fechaDesdeAnulacion, fechaHastaAnulacion, paginaActualVentas]);

  // Navegación con teclado en modal de anulaciones
  useEffect(() => {
    if (!showAnulaciones) return;

    const handleKeyDownAnulaciones = (e: KeyboardEvent) => {
      // Escape para cerrar modal
      if (e.key === 'Escape') {
        if (ventaSeleccionada) {
          // Si hay venta seleccionada, volver a la lista
          setVentaSeleccionada(null);
          setItemsAnular(new Map());
          setMotivoAnulacion('');
          setCantidadesYaAnuladas(new Map());
          setUnidadesPesoAnular(new Map());
          setCantidadesAnularTemp(new Map());
          setFocusedItemAnularIndex(-1);
        } else {
          // Si no hay venta seleccionada, cerrar modal
          setShowAnulaciones(false);
          setSearchNumeroVenta('');
          setFechaDesdeAnulacion('');
          setFechaHastaAnulacion('');
          setFocusedVentaIndex(-1);
          setKeyboardNavAnulaciones(false);
        }
        return;
      }

      // Solo procesar navegación si no hay venta seleccionada (estamos en la lista)
      if (ventaSeleccionada) return;
      if (ventasRecientes.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!keyboardNavAnulaciones) {
            setKeyboardNavAnulaciones(true);
            setFocusedVentaIndex(0);
          } else {
            setFocusedVentaIndex(prev => Math.min(prev + 1, ventasRecientes.length - 1));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!keyboardNavAnulaciones) {
            setKeyboardNavAnulaciones(true);
            setFocusedVentaIndex(0);
          } else {
            setFocusedVentaIndex(prev => Math.max(prev - 1, 0));
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (ventasRecientes.length === 1 && !keyboardNavAnulaciones) {
            // Selección automática si solo hay un resultado
            seleccionarVentaParaAnular(ventasRecientes[0]);
          } else if (keyboardNavAnulaciones && focusedVentaIndex >= 0 && focusedVentaIndex < ventasRecientes.length) {
            // Selección con teclado
            seleccionarVentaParaAnular(ventasRecientes[focusedVentaIndex]);
            setKeyboardNavAnulaciones(false);
            setFocusedVentaIndex(-1);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDownAnulaciones);
    return () => window.removeEventListener('keydown', handleKeyDownAnulaciones);
  }, [showAnulaciones, ventasRecientes, ventaSeleccionada, keyboardNavAnulaciones, focusedVentaIndex]);

  // Scroll automático al item enfocado
  useEffect(() => {
    if (focusedItemAnularIndex >= 0 && ventaSeleccionada?.venta_items) {
      const items = ventaSeleccionada.venta_items;
      if (focusedItemAnularIndex < items.length) {
        const itemId = items[focusedItemAnularIndex].id;
        const element = document.getElementById(`item-anular-${itemId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [focusedItemAnularIndex, ventaSeleccionada]);

  // Navegación con teclado en items de anulación
  useEffect(() => {
    if (!showAnulaciones || !ventaSeleccionada) return;

    const handleKeyDownItems = (e: KeyboardEvent) => {
      // Si el foco está en un input, no procesar navegación
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const items = ventaSeleccionada.venta_items || [];
      if (items.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedItemAnularIndex(prev => {
            if (prev === -1) return 0;
            return Math.min(prev + 1, items.length - 1);
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedItemAnularIndex(prev => {
            if (prev === -1) return 0;
            return Math.max(prev - 1, 0);
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedItemAnularIndex >= 0 && focusedItemAnularIndex < items.length) {
            const item = items[focusedItemAnularIndex];
            const cantidadYaAnulada = cantidadesYaAnuladas.get(item.id) || 0;
            const cantidadDisponible = item.cantidad - cantidadYaAnulada;
            const itemTotalmenteAnulado = cantidadDisponible <= 0;

            if (!itemTotalmenteAnulado) {
              toggleItemAnular(item.id, cantidadDisponible);

              // Si se está marcando el item, hacer focus en el input después de un pequeño delay
              if (!itemsAnular.has(item.id)) {
                setTimeout(() => {
                  const input = document.getElementById(`cantidad-anular-${item.id}`);
                  if (input) {
                    input.focus();
                    (input as HTMLInputElement).select();
                  }
                }, 50);
              }
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDownItems);
    return () => window.removeEventListener('keydown', handleKeyDownItems);
  }, [showAnulaciones, ventaSeleccionada, focusedItemAnularIndex, itemsAnular, cantidadesYaAnuladas]);

  const loadProductos = async () => {
    try {
      // Primero contar el total de productos activos
      const { count } = await supabase
        .from('productos')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setTotalProductos(count || 0);

      // Calcular offset
      const offset = (paginaActualProductos - 1) * productosPorPagina;

      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('is_active', true)
        .order('nombre')
        .range(offset, offset + productosPorPagina - 1);

      if (error) throw error;
      if (data) setProductos(data);
    } catch (error) {
      console.error('Error cargando productos:', error);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const filteredProductos = productos.filter(producto =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producto.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular stock visual (temporal) basado en el carrito
  const getStockVisual = (producto: Producto) => {
    let stockPaquetes = producto.stock_paquetes || 0;
    let stockUnidades = producto.stock_unidades || 0;
    let stockKg = producto.stock_kg || 0;

    // Revisar todos los items del carrito para este producto
    cart.forEach(item => {
      if (item.producto.id === producto.id) {
        if (item.tipo === 'paquete') {
          // Descontar paquetes
          stockPaquetes = Math.max(0, stockPaquetes - item.cantidad);
        } else if (item.tipo === 'unidad') {
          // Simular lógica de apertura de paquetes
          const cantidadEnCarrito = item.cantidad;

          if (cantidadEnCarrito <= stockUnidades) {
            // Hay suficientes unidades sueltas
            stockUnidades = Math.max(0, stockUnidades - cantidadEnCarrito);
          } else {
            // Necesitamos abrir paquetes
            const unidadesNecesarias = cantidadEnCarrito - stockUnidades;
            const unidadesPorPaquete = producto.unidades_por_paquete || 0;
            const paquetesAAbrir = Math.ceil(unidadesNecesarias / unidadesPorPaquete);

            if (paquetesAAbrir <= stockPaquetes) {
              // Simular apertura de paquetes
              const unidadesTotalesDisponibles = stockUnidades + (paquetesAAbrir * unidadesPorPaquete);
              const unidadesRestantes = unidadesTotalesDisponibles - cantidadEnCarrito;

              stockPaquetes = Math.max(0, stockPaquetes - paquetesAAbrir);
              stockUnidades = Math.max(0, unidadesRestantes);
            } else {
              // No hay suficiente stock
              stockUnidades = 0;
              stockPaquetes = 0;
            }
          }
        } else if (item.tipo === 'kg') {
          // Descontar kg
          stockKg = Math.max(0, stockKg - item.cantidad);
        }
      }
    });

    return {
      stock_paquetes: stockPaquetes,
      stock_unidades: stockUnidades,
      stock_kg: stockKg
    };
  };

  const addToCart = (producto: Producto, tipo: 'unidad' | 'paquete' | 'kg') => {
    // Determinar precio según si es mayorista
    let precioUnitario = 0;
    if (tipo === 'unidad') {
      precioUnitario = esMayorista && producto.precio_mayorista_unidad
        ? producto.precio_mayorista_unidad
        : (producto.precio_venta_unidad || 0);
    } else if (tipo === 'paquete') {
      precioUnitario = esMayorista && producto.precio_mayorista_paquete
        ? producto.precio_mayorista_paquete
        : (producto.precio_venta_paquete || 0);
    } else {
      // kg también tiene precio mayorista
      precioUnitario = esMayorista && producto.precio_mayorista_kg
        ? producto.precio_mayorista_kg
        : (producto.precio_venta_kg || 0);
    }

    // Verificar que el precio no sea 0
    if (precioUnitario === 0) {
      toast.error('No se puede vender este producto: precio de venta es 0');
      return;
    }

    // Si es producto pesable (tipo kg), abrir modal para ingresar peso
    if (tipo === 'kg' && producto.pesable) {
      setProductoPesable(producto);
      setPesoIngresado('');
      setEditingPesableIndex(null);
      setShowPesoModal(true);
      return;
    }

    const existingItem = cart.find(item =>
      item.producto.id === producto.id && item.tipo === tipo
    );

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === existingItem.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
      toast.success('Cantidad actualizada en el carrito');
    } else {
      const newItem: CartItem = {
        id: Date.now().toString(),
        producto,
        tipo,
        cantidad: 1,
        precio_unitario: precioUnitario,
        es_mayorista: esMayorista
      };
      setCart([...cart, newItem]);
      toast.success('Producto agregado al carrito');
    }
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    toast.success('Producto eliminado del carrito');
  };

  const updateCartQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    setCart(cart.map((item, i) =>
      i === index ? { ...item, cantidad: newQuantity } : item
    ));
  };

  const handleConfirmarPeso = () => {
    if (!productoPesable) return;

    const pesoIngresadoNum = parseFloat(pesoIngresado);
    if (isNaN(pesoIngresadoNum) || pesoIngresadoNum <= 0) {
      toast.error('Ingresa un peso válido');
      return;
    }

    // Determinar precio según si es mayorista
    const precioUnitario = esMayorista && productoPesable.precio_mayorista_kg
      ? productoPesable.precio_mayorista_kg
      : (productoPesable.precio_venta_kg || 0);

    // Verificar que el precio no sea 0
    if (precioUnitario === 0) {
      toast.error('No se puede vender este producto: precio de venta es 0');
      return;
    }

    // Convertir el peso ingresado a kg para comparar con el stock
    const pesoEnKg = convertirAKg(pesoIngresadoNum, unidadPesoVenta);

    if (pesoEnKg > productoPesable.stock_kg) {
      const stockDisponible = convertirDesdeKg(productoPesable.stock_kg, unidadPesoVenta);
      toast.error(`Stock insuficiente. Disponible: ${stockDisponible.toFixed(unidadPesoVenta === 'kg' ? 3 : 0)} ${unidadPesoVenta}`);
      return;
    }

    // Si estamos editando un item existente
    if (editingPesableIndex !== null) {
      setCart(cart.map((item, i) =>
        i === editingPesableIndex
          ? { ...item, cantidad: pesoEnKg }
          : item
      ));
      toast.success('Peso actualizado en el carrito');
    } else {
      // Agregar nuevo item al carrito (guardamos en kg)
      const newItem: CartItem = {
        id: Date.now().toString(),
        producto: productoPesable,
        tipo: 'kg',
        cantidad: pesoEnKg,
        precio_unitario: precioUnitario,
        es_mayorista: esMayorista
      };
      setCart([...cart, newItem]);
      toast.success('Producto agregado al carrito');
    }

    setShowPesoModal(false);
    setPesoIngresado('');
    setProductoPesable(null);
    setEditingPesableIndex(null);
    setUnidadPesoVenta('kg');

    // Bloquear temporalmente el modal de confirmar venta para evitar activación accidental
    setBlockConfirmVentaModal(true);
    setTimeout(() => {
      setBlockConfirmVentaModal(false);
    }, 300);
  };

  const handleEditarPeso = (index: number) => {
    const item = cart[index];
    if (item.tipo === 'kg' && item.producto.pesable) {
      setProductoPesable(item.producto);
      setPesoIngresado(item.cantidad.toString());
      setEditingPesableIndex(index);
      setShowPesoModal(true);
    }
  };

  const getTotal = () => {
    return cart.reduce((total, item) => total + (item.precio_unitario * item.cantidad), 0);
  };

  // Función para abrir modal de confirmación
  const handlePrepararVenta = () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    // Validar cliente si es fiado
    if (esFiado && !clienteSeleccionado) {
      toast.error('Debes seleccionar un cliente para venta fiada');
      setShowClienteModal(true);
      return;
    }

    // Transferir el valor de dinero recibido del carrito al modal
    setDineroRecibidoModal(dineroRecibido);
    setShowConfirmVentaModal(true);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    // Validar cliente si es fiado
    if (esFiado && !clienteSeleccionado) {
      toast.error('Debes seleccionar un cliente para venta fiada');
      setShowClienteModal(true);
      return;
    }

    // Calcular vuelto usando el dinero recibido del modal
    const total = getTotal();
    const dineroRecibidoNum = dineroRecibidoModal ? parseFloat(dineroRecibidoModal) : 0;
    const vuelto = !esFiado && dineroRecibidoNum > 0 ? dineroRecibidoNum - total : 0;

    // Validar que el dinero recibido sea suficiente (solo si no es fiado)
    if (!esFiado && dineroRecibidoNum > 0 && dineroRecibidoNum < total) {
      toast.error('El dinero recibido es menor al total');
      return;
    }

    try {
      setLoading(true);

      // Crear número de venta único
      const numeroVenta = `V-${Date.now()}`;

      // Crear venta
      const { data: ventaData, error: ventaError } = await supabase
        .from('ventas')
        .insert({
          numero_venta: numeroVenta,
          total: total,
          vendedor_id: user?.id || null,
          tipo_pago: esFiado ? 'fiado' : 'contado',
          cliente_id: esFiado ? clienteSeleccionado?.id : null,
          es_fiado: esFiado,
          monto_pagado: esFiado ? 0 : total,
          fiado_completado: !esFiado,
          es_mayorista: esMayorista,
          dinero_recibido: !esFiado && dineroRecibidoNum > 0 ? dineroRecibidoNum : null,
          vuelto: !esFiado && vuelto > 0 ? vuelto : null
        })
        .select()
        .single();

      if (ventaError) throw ventaError;

      // Crear detalles de venta y actualizar inventario
      const ventaItems: VentaItem[] = [];
      
      for (const item of cart) {
        // Insertar detalle de venta
        const { data: detalleData, error: detalleError } = await supabase
          .from('venta_items')
          .insert({
            venta_id: ventaData.id,
            producto_id: item.producto.id,
            cantidad: item.cantidad,
            unidad_medida: item.tipo,
            precio_unitario: item.precio_unitario,
            subtotal: item.precio_unitario * item.cantidad
          })
          .select()
          .single();

        if (detalleError) throw detalleError;

        // Agregar a la lista de items para el PDF
        ventaItems.push({
          id: detalleData.id,
          venta_id: ventaData.id,
          producto_id: item.producto.id,
          cantidad: item.cantidad,
          unidad_medida: item.tipo,
          precio_unitario: item.precio_unitario,
          subtotal: item.precio_unitario * item.cantidad,
          created_at: detalleData.created_at,
          producto: item.producto
        });

        // Actualizar inventario con lógica de conversión paquete-unidad
        let updates: any = {};

        if (item.tipo === 'paquete') {
          // Venta de paquetes: solo descontar paquetes, NO tocar las unidades sueltas
          const newStockPaquetes = Math.max(0, (item.producto.stock_paquetes || 0) - item.cantidad);
          updates.stock_paquetes = newStockPaquetes;
        } else if (item.tipo === 'unidad') {
          // Venta de unidades: verificar si necesitamos abrir un paquete
          const stockUnidadesActual = item.producto.stock_unidades || 0;
          const stockPaquetesActual = item.producto.stock_paquetes || 0;
          const unidadesPorPaquete = item.producto.unidades_por_paquete || 0;
          const cantidadVendida = item.cantidad;

          if (cantidadVendida <= stockUnidadesActual) {
            // Hay suficientes unidades sueltas
            updates.stock_unidades = Math.max(0, stockUnidadesActual - cantidadVendida);
          } else {
            // Necesitamos abrir paquete(s)
            const unidadesNecesarias = cantidadVendida - stockUnidadesActual;
            const paquetesAAbrir = Math.ceil(unidadesNecesarias / unidadesPorPaquete);

            if (paquetesAAbrir <= stockPaquetesActual) {
              // Abrir paquetes y calcular unidades restantes
              const unidadesTotalesDisponibles = stockUnidadesActual + (paquetesAAbrir * unidadesPorPaquete);
              const unidadesRestantes = unidadesTotalesDisponibles - cantidadVendida;

              updates.stock_paquetes = stockPaquetesActual - paquetesAAbrir;
              updates.stock_unidades = unidadesRestantes;
            } else {
              // No hay suficiente stock (esto no debería pasar si validamos antes)
              throw new Error(`Stock insuficiente para ${item.producto.nombre}`);
            }
          }
        } else if (item.tipo === 'kg') {
          // Venta por peso
          const newStockKg = Math.max(0, (item.producto.stock_kg || 0) - item.cantidad);
          updates.stock_kg = newStockKg;
        }

        const { error: updateError } = await supabase
          .from('productos')
          .update(updates)
          .eq('id', item.producto.id);

        if (updateError) throw updateError;
      }

      // Verificar si se debe generar el ticket automáticamente
      const autoGenerarTickets = localStorage.getItem('autoGenerarTickets');
      const debeGenerarTicket = autoGenerarTickets !== null ? autoGenerarTickets === 'true' : true;

      if (debeGenerarTicket) {
        // Generar PDF del ticket automáticamente
        try {
          // Cargar configuración del ticket
          const { data: configData, error: configError } = await supabase
            .from('ticket_config')
            .select('*')
            .eq('is_active', true)
            .single();

          if (configError && configError.code !== 'PGRST116') {
            console.warn('No se pudo cargar la configuración del ticket:', configError);
          }

          // Si no hay configuración, usar valores por defecto
          const config: TicketConfig = configData || {
            id: 'default',
            nombre_empresa: 'MI EMPRESA',
            encabezado: null,
            pie_pagina: '¡Gracias por su compra!',
            logo_url: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Cargar perfil del vendedor
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', user?.id || '')
            .single();

          const vendedor = profileData?.full_name || user?.email || 'Vendedor';

          // Preparar datos para el PDF
          const venta: Venta = {
            id: ventaData.id,
            numero_venta: ventaData.numero_venta,
            fecha: ventaData.fecha || new Date().toISOString(),
            vendedor_id: ventaData.vendedor_id,
            total: ventaData.total,
            tipo_pago: ventaData.tipo_pago,
            notas: ventaData.notas,
            created_at: ventaData.created_at,
            es_fiado: ventaData.es_fiado || false,
            monto_pagado: ventaData.monto_pagado || 0,
            fiado_completado: ventaData.fiado_completado || false,
            es_mayorista: ventaData.es_mayorista || false,
            cliente_id: ventaData.cliente_id || undefined,
            venta_origen_id: ventaData.venta_origen_id || undefined,
            dinero_recibido: ventaData.dinero_recibido || undefined,
            vuelto: ventaData.vuelto || undefined
          };

          // Generar y abrir PDF
          await openTicketPDF({
            venta,
            items: ventaItems,
            vendedor,
            config
          });

          toast.success('Ticket generado correctamente');
        } catch (pdfError: any) {
          console.error('Error al generar PDF:', pdfError);
          toast.warning('Venta procesada, pero hubo un error al generar el ticket PDF');
        }
      }

      // Limpiar carrito y estados
      setCart([]);
      setDineroRecibido('');
      setDineroRecibidoModal('');
      setEsFiado(false);
      setClienteSeleccionado(null);
      setEsMayorista(false);
      setShowConfirmVentaModal(false);

      // Mostrar mensaje según tipo de venta
      if (esFiado) {
        toast.success(`Venta fiada registrada para ${clienteSeleccionado?.nombre}`);
      } else {
        toast.success('Venta procesada exitosamente');
        if (vuelto > 0) {
          toast.info(`Vuelto: ${formatGuaranies(vuelto)}`);
        }
      }

      // Recargar productos para actualizar stock
      await loadProductos();

    } catch (error: any) {
      console.error('Error procesando venta:', error);
      toast.error('Error al procesar la venta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const cerrarAvisoSeleccion = () => {
    setProductoPorSeleccionar(null);
  };

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      console.log('Buscando producto:', searchTerm);

      // Si hay una selección activa en los productos visibles, usar ese
      if (focusedProductIndex !== -1 && filteredProductos.length > 0 && focusedProductIndex < filteredProductos.length) {
        const producto = filteredProductos[focusedProductIndex];
        console.log('Producto enfocado:', producto);
        console.log('Tipo:', producto.tipo, 'Pesable:', producto.pesable);

        // Verificar si se vende por unidad (tipo 'unidad' y no pesable)
        if (producto.tipo === 'unidad' && !producto.pesable && producto.stock_unidades > 0) {
          setKeyboardNavigationEnabled(false); // Desactivar navegación
          console.log('Agregando por unidad');
          addToCart(producto, 'unidad');
          setSearchTerm(''); // Limpiar búsqueda
          setFocusedProductIndex(-1); // Desactivar selección
          setKeyboardNavigationEnabled(false); // Desactivar navegación
        }
        // Productos por paquete que también tienen precio por unidad - REQUIEREN SELECCIÓN
        else if (producto.tipo === 'paquete' && producto.precio_venta_unidad) {
          console.log('Producto paquete con opciones múltiples - requiere selección');
          // NO limpiar búsqueda para productos con múltiples opciones
          toast.info('Este producto se puede vender por unidad o por paquete. Selecciona una opción usando los botones +.');
        }
        // Productos por paquete simples
        else if (producto.tipo === 'paquete' && producto.stock_paquetes > 0) {
          console.log('Agregando por paquete');
          addToCart(producto, 'paquete');
          setSearchTerm(''); // Limpiar búsqueda
          setFocusedProductIndex(-1); // Desactivar selección
          setKeyboardNavigationEnabled(false); // Desactivar navegación
        }
        // Productos unidad pesables
        else if (producto.tipo === 'peso' && producto.stock_kg > 0) {
          console.log('Agregando por kg');
          addToCart(producto, 'kg');
          setSearchTerm(''); // Limpiar búsqueda
          setFocusedProductIndex(-1); // Desactivar selección
          setKeyboardNavigationEnabled(false); // Desactivar navegación
        }
        else {
          console.log('No se puede agregar. Stock disponible:', {
            stock_unidades: producto.stock_unidades,
            stock_paquetes: producto.stock_paquetes,
            stock_kg: producto.stock_kg
          });
          toast.error('No hay stock disponible para este producto');
        }
        return;
      }

      // Si no hay selección, buscar en TODA la base de datos (sin paginación)
      try {
        const searchValue = searchTerm.trim().toLowerCase();
        const { data: productosEncontrados, error } = await supabase
          .from('productos')
          .select('*')
          .eq('is_active', true)
          .or(`nombre.ilike.%${searchValue}%,codigo.ilike.%${searchValue}%`)
          .order('nombre');

        if (error) throw error;

        console.log('Productos encontrados en BD:', productosEncontrados?.length || 0);

        if (!productosEncontrados || productosEncontrados.length === 0) {
          toast.error('No se encontró ningún producto');
          return;
        }

        if (productosEncontrados.length === 1) {
          const producto = productosEncontrados[0];
          console.log('Producto único encontrado:', producto);
          console.log('Tipo:', producto.tipo, 'Pesable:', producto.pesable);

          // Verificar si se vende por unidad (tipo 'unidad' y no pesable)
          if (producto.tipo === 'unidad' && !producto.pesable && producto.stock_unidades > 0) {
            console.log('Agregando por unidad');
            addToCart(producto, 'unidad');
            setSearchTerm(''); // Limpiar búsqueda
            setFocusedProductIndex(-1); // Desactivar selección
            setKeyboardNavigationEnabled(false); // Desactivar navegación
          }
          // Productos por paquete que también tienen precio por unidad - REQUIEREN SELECCIÓN
          else if (producto.tipo === 'paquete' && producto.precio_venta_unidad) {
            console.log('Producto paquete con opciones múltiples - requiere selección');
            // Agregar a la lista visible para que el usuario seleccione
            setSearchTerm(producto.nombre);
            toast.info('Este producto se puede vender por unidad o por paquete. Usa los botones + para seleccionar.');
          }
          // Productos por paquete simples
          else if (producto.tipo === 'paquete' && producto.stock_paquetes > 0) {
            console.log('Agregando por paquete');
            addToCart(producto, 'paquete');
            setSearchTerm(''); // Limpiar búsqueda
            setFocusedProductIndex(-1); // Desactivar selección
            setKeyboardNavigationEnabled(false); // Desactivar navegación
          }
          // Productos unidad pesables
          else if (producto.tipo === 'peso' && producto.stock_kg > 0) {
            console.log('Agregando por kg');
            addToCart(producto, 'kg');
            setSearchTerm(''); // Limpiar búsqueda
            setFocusedProductIndex(-1); // Desactivar selección
            setKeyboardNavigationEnabled(false); // Desactivar navegación
          }
          else {
            console.log('No se puede agregar. Stock disponible:', {
              stock_unidades: producto.stock_unidades,
              stock_paquetes: producto.stock_paquetes,
              stock_kg: producto.stock_kg
            });
            toast.error('No hay stock disponible para este producto');
          }
        } else {
          toast.error(`Se encontraron ${productosEncontrados.length} productos. Sé más específico en la búsqueda`);
        }
      } catch (error) {
        console.error('Error buscando producto:', error);
        toast.error('Error al buscar producto');
      }
    }
  };

  // Función para manejar código de barras escaneado
  const handleBarcodeScanned = async (decodedText: string) => {
    console.log('Código escaneado:', decodedText);

    // Cerrar el escáner
    setShowBarcodeScanner(false);

    // Buscar producto por código de barras en TODA la base de datos (sin paginación)
    try {
      const { data: productosEncontrados, error } = await supabase
        .from('productos')
        .select('*')
        .eq('is_active', true)
        .ilike('codigo', decodedText)
        .limit(1);

      if (error) throw error;

      if (!productosEncontrados || productosEncontrados.length === 0) {
        toast.error('Producto no encontrado con ese código de barras');
        return;
      }

      const producto = productosEncontrados[0];
      console.log('Producto encontrado por código de barras:', producto);

      // Verificar stock y agregar al carrito
      if (producto.tipo === 'unidad' && !producto.pesable && producto.stock_unidades > 0) {
        addToCart(producto, 'unidad');
        toast.success(`${producto.nombre} agregado al carrito`);
      } else if (producto.tipo === 'paquete' && !producto.precio_venta_unidad && producto.stock_paquetes > 0) {
        addToCart(producto, 'paquete');
        toast.success(`${producto.nombre} agregado al carrito`);
      } else if (producto.tipo === 'peso' && producto.stock_kg > 0) {
        addToCart(producto, 'kg');
        toast.success(`${producto.nombre} agregado al carrito`);
      } else if (producto.tipo === 'paquete' && producto.precio_venta_unidad) {
        // Producto con múltiples opciones - requiere selección manual
        setSearchTerm(producto.nombre);
        toast.info('Este producto tiene múltiples opciones. Selecciona una opción manualmente.');
      } else {
        toast.error('No hay stock disponible para este producto');
      }
    } catch (error) {
      console.error('Error buscando producto por código de barras:', error);
      toast.error('Error al buscar producto');
    }
  };

  // Funciones para anulaciones
  const cargarVentasRecientes = async () => {
    setLoadingVentas(true);
    try {
      // Contar total de ventas con los filtros aplicados
      let countQuery = supabase
        .from('ventas')
        .select('*', { count: 'exact', head: true });

      // Aplicar mismos filtros para el conteo
      if (searchNumeroVenta.trim()) {
        // Remover el símbolo # si existe y buscar por texto
        const searchTerm = searchNumeroVenta.trim().replace('#', '');
        countQuery = countQuery.ilike('numero_venta', `%${searchTerm}%`);
      }

      // Filtrar conteo por fecha según el tipo de filtro seleccionado
      if (tipoFiltroFecha === 'fecha_especifica' && fechaEspecifica) {
        const fechaInicio = new Date(fechaEspecifica + 'T00:00:00');
        const fechaFin = new Date(fechaEspecifica + 'T23:59:59');
        countQuery = countQuery.gte('fecha', fechaInicio.toISOString()).lte('fecha', fechaFin.toISOString());
      } else if (tipoFiltroFecha === 'rango') {
        if (fechaDesdeAnulacion) {
          const fechaDesde = new Date(fechaDesdeAnulacion + 'T00:00:00');
          countQuery = countQuery.gte('fecha', fechaDesde.toISOString());
        }

        if (fechaHastaAnulacion) {
          const fechaHasta = new Date(fechaHastaAnulacion + 'T23:59:59');
          countQuery = countQuery.lte('fecha', fechaHasta.toISOString());
        }
      }

      const { count } = await countQuery;
      setTotalVentas(count || 0);

      // Calcular offset para paginación
      const offset = (paginaActualVentas - 1) * ventasPorPagina;

      let query = supabase
        .from('ventas')
        .select(`
          *,
          venta_items (
            id,
            producto_id,
            cantidad,
            unidad_medida,
            precio_unitario,
            subtotal,
            productos (
              nombre,
              tipo
            )
          ),
          user_profiles (
            full_name
          ),
          clientes (
            nombre
          )
        `);

      // Filtrar por número de venta si existe búsqueda
      if (searchNumeroVenta.trim()) {
        // Remover el símbolo # si existe y buscar por texto
        const searchTerm = searchNumeroVenta.trim().replace('#', '');
        query = query.ilike('numero_venta', `%${searchTerm}%`);
      }

      // Filtrar por fecha según el tipo de filtro seleccionado
      if (tipoFiltroFecha === 'fecha_especifica' && fechaEspecifica) {
        const fechaInicio = new Date(fechaEspecifica + 'T00:00:00');
        const fechaFin = new Date(fechaEspecifica + 'T23:59:59');
        query = query.gte('fecha', fechaInicio.toISOString()).lte('fecha', fechaFin.toISOString());
      } else if (tipoFiltroFecha === 'rango') {
        // Filtrar por fecha desde
        if (fechaDesdeAnulacion) {
          const fechaDesde = new Date(fechaDesdeAnulacion + 'T00:00:00');
          query = query.gte('fecha', fechaDesde.toISOString());
        }

        // Filtrar por fecha hasta
        if (fechaHastaAnulacion) {
          const fechaHasta = new Date(fechaHastaAnulacion + 'T23:59:59');
          query = query.lte('fecha', fechaHasta.toISOString());
        }
      }

      query = query.order('fecha', { ascending: false }).range(offset, offset + ventasPorPagina - 1);

      const { data, error } = await query;

      if (error) throw error;

      // Filtrar ventas que ya tienen anulación completa
      if (data && data.length > 0) {
        const ventaIds = data.map(v => v.id);

        const { data: anulaciones, error: errorAnulaciones } = await supabase
          .from('operaciones')
          .select('venta_id, tipo_operacion')
          .in('venta_id', ventaIds);

        if (errorAnulaciones) throw errorAnulaciones;

        // Crear set de ventas completamente anuladas
        const ventasCompletamenteAnuladas = new Set(
          (anulaciones || [])
            .filter((a: any) => a.tipo_operacion === 'anulacion_completa')
            .map((a: any) => a.venta_id)
        );

        // Filtrar ventas que no están completamente anuladas
        const ventasFiltradas = data.filter(v => !ventasCompletamenteAnuladas.has(v.id));

        setVentasRecientes(ventasFiltradas);

        // Si solo hay un resultado y el usuario está buscando, resetear índice
        if (ventasFiltradas.length === 1 && searchNumeroVenta.trim()) {
          setFocusedVentaIndex(-1);
          setKeyboardNavAnulaciones(false);
        } else {
          setFocusedVentaIndex(-1);
          setKeyboardNavAnulaciones(false);
        }
      } else {
        setVentasRecientes([]);
      }
    } catch (error: any) {
      console.error('Error cargando ventas:', error);
      toast.error('Error al cargar ventas');
    } finally {
      setLoadingVentas(false);
    }
  };

  const handleAnularVenta = async () => {
    if (!ventaSeleccionada) return;

    if (itemsAnular.size === 0) {
      toast.error('Selecciona al menos un item para anular');
      return;
    }

    // Prevenir múltiples clics
    if (loading) return;

    // Calcular el total de los items seleccionados
    let totalItemsSeleccionados = 0;
    for (const [itemId, cantidadSeleccionada] of itemsAnular.entries()) {
      const ventaItem = ventaSeleccionada.venta_items.find((vi: any) => vi.id === itemId);
      if (ventaItem) {
        totalItemsSeleccionados += cantidadSeleccionada * ventaItem.precio_unitario;
      }
    }

    // Si la venta ya es fiado y tiene monto pendiente, validar que no se exceda
    if (ventaSeleccionada.es_fiado && !ventaSeleccionada.fiado_completado) {
      const montoRestante = ventaSeleccionada.total - (ventaSeleccionada.monto_pagado || 0);

      if (totalItemsSeleccionados > montoRestante) {
        toast.error(
          `El total de los items seleccionados (${formatGuaranies(totalItemsSeleccionados)}) excede el monto pendiente de la deuda (${formatGuaranies(montoRestante)}). Por favor, selecciona items por un monto menor o igual al monto pendiente.`,
          { duration: 6000 }
        );
        return;
      }
    }

    setLoading(true);
    try {
      // Verificar anulaciones previas para calcular cantidades ya anuladas
      const { data: anulacionesPrevias, error: errorAnulaciones } = await supabase
        .from('operaciones')
        .select('*')
        .eq('venta_id', ventaSeleccionada.id)
        .in('tipo_operacion', ['anulacion_completa', 'anulacion_parcial']);

      if (errorAnulaciones) throw errorAnulaciones;

      // Calcular cantidades ya anuladas por item
      const cantidadesYaAnuladas = new Map<string, number>();
      anulacionesPrevias?.forEach((anulacion: any) => {
        const items = anulacion.items_anulados || [];
        items.forEach((item: any) => {
          const itemId = item.venta_item_id;
          const cantidadPrevia = cantidadesYaAnuladas.get(itemId) || 0;
          cantidadesYaAnuladas.set(itemId, cantidadPrevia + item.cantidad);
        });
      });

      const items: any[] = [];
      let totalAnulado = 0;

      // Preparar items para anular y devolver stock
      for (const [itemId, cantidadAnular] of itemsAnular.entries()) {
        const ventaItem = ventaSeleccionada.venta_items.find((vi: any) => vi.id === itemId);
        if (!ventaItem) continue;

        // Validar que no se exceda la cantidad original
        const cantidadYaAnulada = cantidadesYaAnuladas.get(itemId) || 0;
        const cantidadDisponible = ventaItem.cantidad - cantidadYaAnulada;

        if (cantidadAnular > cantidadDisponible) {
          toast.error(`No puedes anular más de ${cantidadDisponible} ${ventaItem.unidad_medida} del producto "${ventaItem.productos?.nombre}". Ya se anularon ${cantidadYaAnulada}.`);
          return;
        }

        const subtotalAnulado = cantidadAnular * ventaItem.precio_unitario;
        totalAnulado += subtotalAnulado;

        items.push({
          venta_item_id: itemId,
          producto_id: ventaItem.producto_id,
          cantidad: cantidadAnular,
          unidad_medida: ventaItem.unidad_medida,
          precio_unitario: ventaItem.precio_unitario,
          subtotal: subtotalAnulado,
          producto_nombre: ventaItem.productos?.nombre
        });

        // Devolver stock
        const { data: producto } = await supabase
          .from('productos')
          .select('*')
          .eq('id', ventaItem.producto_id)
          .single();

        if (producto) {
          const updates: any = {};

          if (ventaItem.unidad_medida === 'unidad') {
            updates.stock_unidades = (producto.stock_unidades || 0) + cantidadAnular;
          } else if (ventaItem.unidad_medida === 'paquete') {
            updates.stock_paquetes = (producto.stock_paquetes || 0) + cantidadAnular;
          } else if (ventaItem.unidad_medida === 'kg') {
            updates.stock_kg = (producto.stock_kg || 0) + cantidadAnular;
          }

          await supabase
            .from('productos')
            .update(updates)
            .eq('id', ventaItem.producto_id);
        }
      }

      // Determinar tipo de anulación
      const totalItemsVenta = ventaSeleccionada.venta_items.length;
      const tipoAnulacion = itemsAnular.size === totalItemsVenta ? 'anulacion_completa' : 'anulacion_parcial';

      // Registrar anulación
      const { error: anulacionError } = await supabase
        .from('operaciones')
        .insert({
          venta_id: ventaSeleccionada.id,
          tipo_operacion: tipoAnulacion,
          items_anulados: items,
          total_anulado: totalAnulado,
          motivo: motivoAnulacion || 'Sin motivo especificado',
          anulado_por: user?.id
        });

      if (anulacionError) throw anulacionError;

      // Actualizar el total de la venta restando el monto anulado
      const nuevoTotal = ventaSeleccionada.total - totalAnulado;

      // Si la venta es fiado, también actualizar el monto pendiente si es necesario
      let updateVentaData: any = {
        total: nuevoTotal
      };

      // Si es fiado y el monto pagado es mayor que el nuevo total, ajustar monto_pagado
      if (ventaSeleccionada.es_fiado) {
        const montoPagadoActual = ventaSeleccionada.monto_pagado || 0;
        if (montoPagadoActual > nuevoTotal) {
          // El monto pagado excede el nuevo total, ajustarlo
          updateVentaData.monto_pagado = nuevoTotal;
        }
      }

      const { error: updateVentaError } = await supabase
        .from('ventas')
        .update(updateVentaData)
        .eq('id', ventaSeleccionada.id);

      if (updateVentaError) throw updateVentaError;

      toast.success(`Venta ${tipoAnulacion === 'anulacion_completa' ? 'anulada completamente' : 'anulada parcialmente'}`);

      // Resetear estados
      setShowAnulaciones(false);
      setVentaSeleccionada(null);
      setItemsAnular(new Map());
      setMotivoAnulacion('');
      setCantidadesYaAnuladas(new Map());
      setUnidadesPesoAnular(new Map());
      setCantidadesAnularTemp(new Map());
      setFocusedItemAnularIndex(-1);
    } catch (error: any) {
      console.error('Error al anular venta:', error);
      toast.error('Error al anular venta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarComoFiado = async () => {
    if (!ventaSeleccionada) return;

    if (itemsAnular.size === 0) {
      toast.error('Selecciona al menos un item para marcar como fiado');
      return;
    }

    // Calcular el total de los items seleccionados
    let totalItemsSeleccionados = 0;
    for (const [itemId, cantidadSeleccionada] of itemsAnular.entries()) {
      const ventaItem = ventaSeleccionada.venta_items.find((vi: any) => vi.id === itemId);
      if (ventaItem) {
        totalItemsSeleccionados += cantidadSeleccionada * ventaItem.precio_unitario;
      }
    }

    // Si la venta ya es fiado y tiene monto pendiente, validar que no se exceda
    if (ventaSeleccionada.es_fiado && !ventaSeleccionada.fiado_completado) {
      const montoRestante = ventaSeleccionada.total - (ventaSeleccionada.monto_pagado || 0);

      if (totalItemsSeleccionados > montoRestante) {
        toast.error(
          `El total de los items seleccionados (${formatGuaranies(totalItemsSeleccionados)}) excede el monto pendiente de la deuda (${formatGuaranies(montoRestante)}). Por favor, selecciona items por un monto menor o igual al monto pendiente.`,
          { duration: 6000 }
        );
        return;
      }
    }

    // Abrir modal de cliente
    setShowClienteModalOperaciones(true);
  };

  const handleClienteSeleccionadoFiado = async (cliente: Cliente) => {
    if (!ventaSeleccionada) return;

    setShowClienteModalOperaciones(false);
    setClienteSeleccionadoFiado(cliente);

    try {
      // Verificar anulaciones previas para calcular cantidades ya anuladas
      const { data: anulacionesPrevias, error: errorAnulaciones } = await supabase
        .from('operaciones')
        .select('*')
        .eq('venta_id', ventaSeleccionada.id)
        .in('tipo_operacion', ['anulacion_completa', 'anulacion_parcial']);

      if (errorAnulaciones) throw errorAnulaciones;

      // Calcular cantidades ya anuladas por item
      const cantidadesYaAnuladas = new Map<string, number>();
      anulacionesPrevias?.forEach((anulacion: any) => {
        const items = anulacion.items_anulados || [];
        items.forEach((item: any) => {
          const itemId = item.venta_item_id;
          const cantidadPrevia = cantidadesYaAnuladas.get(itemId) || 0;
          cantidadesYaAnuladas.set(itemId, cantidadPrevia + item.cantidad);
        });
      });

      const itemsParaFiado: any[] = [];
      const itemsActualizados: any[] = [];
      let totalFiado = 0;
      let esConversionCompleta = true;

      // Preparar items para convertir a fiado
      for (const ventaItem of ventaSeleccionada.venta_items) {
        const cantidadSeleccionada = itemsAnular.get(ventaItem.id);
        const cantidadYaAnulada = cantidadesYaAnuladas.get(ventaItem.id) || 0;
        const cantidadDisponible = ventaItem.cantidad - cantidadYaAnulada;

        if (cantidadSeleccionada) {
          // Validar que no se exceda la cantidad disponible
          if (cantidadSeleccionada > cantidadDisponible) {
            toast.error(`No puedes marcar como fiado más de ${cantidadDisponible} ${ventaItem.unidad_medida} del producto "${ventaItem.productos?.nombre}". Ya se anularon ${cantidadYaAnulada}.`);
            return;
          }

          // Item que irá al fiado
          const subtotal = cantidadSeleccionada * ventaItem.precio_unitario;
          totalFiado += subtotal;

          itemsParaFiado.push({
            producto_id: ventaItem.producto_id,
            cantidad: cantidadSeleccionada,
            unidad_medida: ventaItem.unidad_medida,
            precio_unitario: ventaItem.precio_unitario,
            subtotal: subtotal
          });

          // Si la cantidad seleccionada es menor a la disponible, hay que actualizar el item original
          if (cantidadSeleccionada < cantidadDisponible) {
            esConversionCompleta = false;
            itemsActualizados.push({
              id: ventaItem.id,
              cantidad: cantidadDisponible - cantidadSeleccionada,
              subtotal: (cantidadDisponible - cantidadSeleccionada) * ventaItem.precio_unitario
            });
          }
        } else {
          // Item que permanece en la venta original
          esConversionCompleta = false;
          itemsActualizados.push({
            id: ventaItem.id,
            cantidad: cantidadDisponible,
            subtotal: cantidadDisponible * ventaItem.precio_unitario
          });
        }
      }

      // Obtener el siguiente número de venta
      const { data: ultimaVenta } = await supabase
        .from('ventas')
        .select('numero_venta')
        .order('numero_venta', { ascending: false })
        .limit(1)
        .single();

      const nuevoNumeroVenta = (ultimaVenta?.numero_venta || 0) + 1;

      if (esConversionCompleta) {
        // Conversión completa: actualizar la venta existente
        const { error: updateVentaError } = await supabase
          .from('ventas')
          .update({
            es_fiado: true,
            cliente_id: cliente.id,
            monto_pagado: 0,
            fiado_completado: false
          })
          .eq('id', ventaSeleccionada.id);

        if (updateVentaError) throw updateVentaError;

        // Registrar operación
        const { error: operacionError } = await supabase
          .from('operaciones')
          .insert({
            venta_id: ventaSeleccionada.id,
            tipo_operacion: 'conversion_fiado',
            items_anulados: itemsParaFiado,
            total_anulado: totalFiado,
            motivo: `Venta completa marcada como fiado para ${cliente.nombre}`,
            anulado_por: user?.id,
            cliente_id: cliente.id,
            monto_operacion: totalFiado
          });

        if (operacionError) throw operacionError;

        toast.success(`Venta #${ventaSeleccionada.numero_venta} marcada como fiado para ${cliente.nombre}`);
      } else {
        // Conversión parcial: crear nueva venta fiado y actualizar original
        // 1. Crear nueva venta fiado
        const { data: nuevaVentaFiado, error: ventaFiadoError } = await supabase
          .from('ventas')
          .insert({
            numero_venta: nuevoNumeroVenta,
            vendedor_id: ventaSeleccionada.vendedor_id,
            total: totalFiado,
            tipo_pago: 'fiado',
            es_fiado: true,
            cliente_id: cliente.id,
            monto_pagado: 0,
            fiado_completado: false,
            venta_origen_id: ventaSeleccionada.id,
            notas: `Conversión parcial de venta #${ventaSeleccionada.numero_venta}`
          })
          .select()
          .single();

        if (ventaFiadoError) throw ventaFiadoError;

        // 2. Insertar items de la nueva venta fiado
        const itemsFiadoConVentaId = itemsParaFiado.map(item => ({
          ...item,
          venta_id: nuevaVentaFiado.id
        }));

        const { error: itemsFiadoError } = await supabase
          .from('venta_items')
          .insert(itemsFiadoConVentaId);

        if (itemsFiadoError) throw itemsFiadoError;

        // 3. Actualizar items de la venta original (reducir cantidades)
        for (const itemActualizado of itemsActualizados) {
          const { error: updateItemError } = await supabase
            .from('venta_items')
            .update({
              cantidad: itemActualizado.cantidad,
              subtotal: itemActualizado.subtotal
            })
            .eq('id', itemActualizado.id);

          if (updateItemError) throw updateItemError;
        }

        // 4. Actualizar total de la venta original
        const nuevoTotalOriginal = itemsActualizados.reduce((sum, item) => sum + item.subtotal, 0);
        const { error: updateVentaTotalError } = await supabase
          .from('ventas')
          .update({ total: nuevoTotalOriginal })
          .eq('id', ventaSeleccionada.id);

        if (updateVentaTotalError) throw updateVentaTotalError;

        // 5. Registrar operación
        const { error: operacionError } = await supabase
          .from('operaciones')
          .insert({
            venta_id: ventaSeleccionada.id,
            tipo_operacion: 'conversion_fiado',
            items_anulados: itemsParaFiado,
            total_anulado: totalFiado,
            motivo: `Conversión parcial a fiado para ${cliente.nombre}. Nueva venta #${nuevoNumeroVenta}`,
            anulado_por: user?.id,
            cliente_id: cliente.id,
            monto_operacion: totalFiado
          });

        if (operacionError) throw operacionError;

        toast.success(`Items marcados como fiado para ${cliente.nombre}. Nueva venta #${nuevoNumeroVenta} creada.`);
      }

      // Resetear estados
      setShowAnulaciones(false);
      setVentaSeleccionada(null);
      setItemsAnular(new Map());
      setMotivoAnulacion('');
      setCantidadesYaAnuladas(new Map());
      setUnidadesPesoAnular(new Map());
      setCantidadesAnularTemp(new Map());
      setFocusedItemAnularIndex(-1);
      setClienteSeleccionadoFiado(null);
    } catch (error: any) {
      console.error('Error al marcar como fiado:', error);
      toast.error('Error al marcar como fiado: ' + error.message);
    }
  };

  const toggleItemAnular = (itemId: string, cantidadMaxima: number) => {
    const newMap = new Map(itemsAnular);
    const isMarking = !newMap.has(itemId);

    if (newMap.has(itemId)) {
      newMap.delete(itemId);
      // Limpiar también la unidad de peso y cantidad temporal
      const newUnidades = new Map(unidadesPesoAnular);
      newUnidades.delete(itemId);
      setUnidadesPesoAnular(newUnidades);

      const newTemp = new Map(cantidadesAnularTemp);
      newTemp.delete(itemId);
      setCantidadesAnularTemp(newTemp);
    } else {
      newMap.set(itemId, cantidadMaxima);

      // Si se está marcando, hacer focus en el input después de un pequeño delay
      setTimeout(() => {
        const input = document.getElementById(`cantidad-anular-${itemId}`);
        if (input) {
          input.focus();
          (input as HTMLInputElement).select();
        }
      }, 50);
    }
    setItemsAnular(newMap);
  };

  const updateCantidadAnular = (itemId: string, cantidad: number) => {
    const newMap = new Map(itemsAnular);
    newMap.set(itemId, cantidad);
    setItemsAnular(newMap);
  };

  const handleCambioUnidadPeso = (itemId: string, nuevaUnidad: 'kg' | 'g') => {
    const unidadActual = unidadesPesoAnular.get(itemId) || 'kg';
    if (unidadActual === nuevaUnidad) return;

    const cantidadActual = itemsAnular.get(itemId) || 0;
    let nuevaCantidad = cantidadActual;

    if (nuevaUnidad === 'g') {
      // Convertir de kg a g
      nuevaCantidad = cantidadActual * 1000;
    } else {
      // Convertir de g a kg
      nuevaCantidad = cantidadActual / 1000;
    }

    const newUnidades = new Map(unidadesPesoAnular);
    newUnidades.set(itemId, nuevaUnidad);
    setUnidadesPesoAnular(newUnidades);

    updateCantidadAnular(itemId, nuevaCantidad);

    // Actualizar también el valor temporal para el input
    const newTemp = new Map(cantidadesAnularTemp);
    newTemp.set(itemId, nuevaCantidad.toString());
    setCantidadesAnularTemp(newTemp);
  };

  const seleccionarVentaParaAnular = async (venta: any) => {
    try {
      // Obtener anulaciones previas para calcular cantidades ya anuladas
      const { data: anulacionesPrevias, error } = await supabase
        .from('operaciones')
        .select('*')
        .eq('venta_id', venta.id)
        .in('tipo_operacion', ['anulacion_completa', 'anulacion_parcial']);

      if (error) throw error;

      // Calcular cantidades ya anuladas por item
      const cantidadesMap = new Map<string, number>();
      anulacionesPrevias?.forEach((anulacion: any) => {
        const items = anulacion.items_anulados || [];
        items.forEach((item: any) => {
          const itemId = item.venta_item_id;
          const cantidadPrevia = cantidadesMap.get(itemId) || 0;
          cantidadesMap.set(itemId, cantidadPrevia + item.cantidad);
        });
      });

      setCantidadesYaAnuladas(cantidadesMap);
      setVentaSeleccionada(venta);
    } catch (error: any) {
      console.error('Error verificando anulaciones:', error);
      toast.error('Error al verificar anulaciones previas');
    }
  };

  const renderPaginacionProductos = () => {
    const totalPaginas = Math.ceil(totalProductos / productosPorPagina);

    if (totalPaginas <= 1) return null;

    const paginas: number[] = [];
    const maxPaginasVisibles = 5;

    let inicio = Math.max(1, paginaActualProductos - Math.floor(maxPaginasVisibles / 2));
    let fin = Math.min(totalPaginas, inicio + maxPaginasVisibles - 1);

    if (fin - inicio + 1 < maxPaginasVisibles) {
      inicio = Math.max(1, fin - maxPaginasVisibles + 1);
    }

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
        <p className="text-sm text-gray-600">
          Mostrando {((paginaActualProductos - 1) * productosPorPagina) + 1} - {Math.min(paginaActualProductos * productosPorPagina, totalProductos)} de {totalProductos} productos
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaginaActualProductos(1)}
            disabled={paginaActualProductos === 1}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            ««
          </button>

          <button
            onClick={() => setPaginaActualProductos(prev => Math.max(1, prev - 1))}
            disabled={paginaActualProductos === 1}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            «
          </button>

          {inicio > 1 && (
            <>
              <button
                onClick={() => setPaginaActualProductos(1)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                1
              </button>
              {inicio > 2 && <span className="text-gray-400">...</span>}
            </>
          )}

          {paginas.map(pagina => (
            <button
              key={pagina}
              onClick={() => setPaginaActualProductos(pagina)}
              className={`px-3 py-1 border rounded-lg transition text-sm ${
                pagina === paginaActualProductos
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {pagina}
            </button>
          ))}

          {fin < totalPaginas && (
            <>
              {fin < totalPaginas - 1 && <span className="text-gray-400">...</span>}
              <button
                onClick={() => setPaginaActualProductos(totalPaginas)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                {totalPaginas}
              </button>
            </>
          )}

          <button
            onClick={() => setPaginaActualProductos(prev => Math.min(totalPaginas, prev + 1))}
            disabled={paginaActualProductos === totalPaginas}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            »
          </button>

          <button
            onClick={() => setPaginaActualProductos(totalPaginas)}
            disabled={paginaActualProductos === totalPaginas}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            »»
          </button>
        </div>
      </div>
    );
  };

  const renderPaginacionVentas = () => {
    const totalPaginas = Math.ceil(totalVentas / ventasPorPagina);

    if (totalPaginas <= 1) return null;

    const paginas: number[] = [];
    const maxPaginasVisibles = 5;

    let inicio = Math.max(1, paginaActualVentas - Math.floor(maxPaginasVisibles / 2));
    let fin = Math.min(totalPaginas, inicio + maxPaginasVisibles - 1);

    if (fin - inicio + 1 < maxPaginasVisibles) {
      inicio = Math.max(1, fin - maxPaginasVisibles + 1);
    }

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
        <p className="text-sm text-gray-600">
          Mostrando {((paginaActualVentas - 1) * ventasPorPagina) + 1} - {Math.min(paginaActualVentas * ventasPorPagina, totalVentas)} de {totalVentas} ventas
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaginaActualVentas(1)}
            disabled={paginaActualVentas === 1}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            ««
          </button>

          <button
            onClick={() => setPaginaActualVentas(prev => Math.max(1, prev - 1))}
            disabled={paginaActualVentas === 1}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            «
          </button>

          {inicio > 1 && (
            <>
              <button
                onClick={() => setPaginaActualVentas(1)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                1
              </button>
              {inicio > 2 && <span className="text-gray-400">...</span>}
            </>
          )}

          {paginas.map(pagina => (
            <button
              key={pagina}
              onClick={() => setPaginaActualVentas(pagina)}
              className={`px-3 py-1 border rounded-lg transition text-sm ${
                pagina === paginaActualVentas
                  ? 'bg-red-600 text-white border-red-600'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {pagina}
            </button>
          ))}

          {fin < totalPaginas && (
            <>
              {fin < totalPaginas - 1 && <span className="text-gray-400">...</span>}
              <button
                onClick={() => setPaginaActualVentas(totalPaginas)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                {totalPaginas}
              </button>
            </>
          )}

          <button
            onClick={() => setPaginaActualVentas(prev => Math.min(totalPaginas, prev + 1))}
            disabled={paginaActualVentas === totalPaginas}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            »
          </button>

          <button
            onClick={() => setPaginaActualVentas(totalPaginas)}
            disabled={paginaActualVentas === totalPaginas}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            »»
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Punto de Venta (POS)</h1>
        {hasPermission('ventas', 'view') && (
          <button
            onClick={() => {
              setPaginaActualVentas(1);
              setShowAnulaciones(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md text-sm md:text-base"
          >
            <FileX className="w-4 h-4 md:w-5 md:h-5" />
            <span>Operaciones</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="xl:col-span-2 space-y-4 md:space-y-6">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                id="search-input"
                type="text"
                placeholder="Buscar producto... (Enter: agregar, ↑↓: activar navegación)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {/* Botón de cámara - solo visible en móviles */}
              <button
                onClick={() => setShowBarcodeScanner(true)}
                className="md:hidden p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                title="Escanear código de barras"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-4">
              <span className="inline-block mr-4">↑↓ Activar navegación y navegar opciones</span>
              <span className="inline-block mr-4">Enter: Agregar al carrito</span>
              <span className="inline-block">Shift+Enter: Finalizar venta</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4 max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
              {filteredProductos.map((producto, index) => {
                const isFocused = focusedProductIndex === index;
                const stockVisual = getStockVisual(producto);
                return (
                <div
                  key={producto.id}
                  className={`relative border rounded-lg p-3 md:p-4 hover:shadow-md transition ${
                    isFocused
                      ? 'border-indigo-500 bg-indigo-50 shadow-lg'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-800">{producto.nombre}</h3>
                        <p className="text-sm text-gray-500">{producto.codigo}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        producto.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                        producto.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {producto.tipo}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {producto.tipo === 'unidad' && (
                        <div className={`flex items-center justify-between rounded-lg p-2 transition ${
                          isFocused ? 'bg-indigo-100 border-2 border-indigo-400' : ''
                        }`}>
                          <div>
                            <p className="text-sm text-gray-600">Precio</p>
                            <p className="font-bold text-indigo-600">{formatGuaranies(obtenerPrecio(producto, 'unidad'))}</p>
                            <p className="text-xs text-gray-500">Stock: {Math.round(stockVisual.stock_unidades)} unidades</p>
                          </div>
                          <button
                            onClick={() => addToCart(producto, 'unidad')}
                            disabled={stockVisual.stock_unidades <= 0}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                      {producto.tipo === 'peso' && (
                        <div className={`flex items-center justify-between rounded-lg p-2 transition ${
                          isFocused ? 'bg-indigo-100 border-2 border-indigo-400' : ''
                        }`}>
                          <div>
                            <p className="text-sm text-gray-600">Precio/Kg</p>
                            <p className="font-bold text-indigo-600">{formatGuaranies(obtenerPrecio(producto, 'kg'))}</p>
                            <p className="text-xs text-gray-500">Stock: {stockVisual.stock_kg.toFixed(2)} kg</p>
                          </div>
                          <button
                            onClick={() => addToCart(producto, 'kg')}
                            disabled={stockVisual.stock_kg <= 0}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                      {producto.tipo === 'paquete' && (
                        <>
                          <div className={`flex items-center justify-between rounded-lg p-2 transition ${
                            isFocused && focusedOptionIndex === 0 
                              ? 'bg-indigo-100 border-2 border-indigo-400' 
                              : ''
                          }`}>
                            <div>
                              <p className="text-sm text-gray-600">Precio/Paquete</p>
                              <p className="font-bold text-indigo-600">{formatGuaranies(obtenerPrecio(producto, 'paquete'))}</p>
                              <p className="text-xs text-gray-500">Stock: {stockVisual.stock_paquetes} paquetes</p>
                            </div>
                            <button
                              onClick={() => addToCart(producto, 'paquete')}
                              disabled={stockVisual.stock_paquetes <= 0}
                              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                          {producto.precio_venta_unidad && (
                            <div className={`flex items-center justify-between pt-2 border-t rounded-lg p-2 transition ${
                              isFocused && focusedOptionIndex === 1
                                ? 'bg-purple-100 border-2 border-purple-400'
                                : ''
                            }`}>
                              <div>
                                <p className="text-sm text-gray-600">Precio/Unidad</p>
                                <p className="font-bold text-purple-600">{formatGuaranies(obtenerPrecio(producto, 'unidad'))}</p>
                                <p className="text-xs text-gray-500">Stock: {Math.round(stockVisual.stock_unidades)} unidades</p>
                              </div>
                              <button
                                onClick={() => addToCart(producto, 'unidad')}
                                disabled={stockVisual.stock_unidades <= 0 && stockVisual.stock_paquetes <= 0}
                                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                </div>
                );
              })}
            </div>

            {renderPaginacionProductos()}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-6">
              <ShoppingCart className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-800">Carrito</h2>
            </div>

            {cart.length === 0 ? (
              <p className="text-center text-gray-500 py-8">El carrito está vacío</p>
            ) : (
              <>
                <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto">
                  {cart.map((item, index) => {
                    // Verificar si falta precio mayorista cuando está activo el modo mayorista
                    const faltaPrecioMayorista = esMayorista &&
                      ((item.tipo === 'unidad' && (!item.producto.precio_mayorista_unidad || item.producto.precio_mayorista_unidad === 0)) ||
                       (item.tipo === 'paquete' && (!item.producto.precio_mayorista_paquete || item.producto.precio_mayorista_paquete === 0)) ||
                       (item.tipo === 'kg' && (!item.producto.precio_mayorista_kg || item.producto.precio_mayorista_kg === 0)));

                    return (
                      <div
                        key={index}
                        className={`border rounded-lg p-3 ${
                          faltaPrecioMayorista
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-800 text-sm">{item.producto.nombre}</p>
                              {faltaPrecioMayorista && (
                                <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-500 text-white">
                                  ⚠️ SIN PRECIO MAYORISTA
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{item.tipo}</p>
                            <p className="text-sm font-medium text-indigo-600">
                              {formatGuaranies(item.precio_unitario)} {item.tipo === 'kg' ? '/kg' : 'c/u'}
                            </p>
                          </div>
                        <div className="flex gap-2">
                          {item.tipo === 'kg' && item.producto.pesable && (
                            <button
                              onClick={() => handleEditarPeso(index)}
                              className="text-blue-500 hover:text-blue-700"
                              title="Editar peso"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => removeFromCart(index)}
                            className="text-red-500 hover:text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        {item.tipo === 'kg' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">
                              {formatearPeso(item.cantidad)} kg
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartQuantity(index, item.cantidad - 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-sm">{item.cantidad}</span>
                            <button
                              onClick={() => updateCartQuantity(index, item.cantidad + 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <p className="font-semibold text-gray-800">
                          {formatGuaranies(item.precio_unitario * item.cantidad)}
                        </p>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <div className="border-t pt-4 space-y-4">
                  {/* Toggle Mayorista */}
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-gray-700">Precio Mayorista</span>
                    </div>
                    <button
                      onClick={() => {
                        const nuevoEstado = !esMayorista;

                        // Primero actualizar el estado de mayorista
                        setEsMayorista(nuevoEstado);

                        // Luego actualizar precios del carrito cuando cambia el estado de mayorista
                        if (cart.length > 0) {
                          const cartActualizado = cart.map(item => {
                            let nuevoPrecio = item.precio_unitario;

                            if (nuevoEstado) {
                              // Activando mayorista: cambiar a precio mayorista
                              if (item.tipo === 'unidad' && item.producto.precio_mayorista_unidad) {
                                nuevoPrecio = item.producto.precio_mayorista_unidad;
                              } else if (item.tipo === 'paquete' && item.producto.precio_mayorista_paquete) {
                                nuevoPrecio = item.producto.precio_mayorista_paquete;
                              } else if (item.tipo === 'kg' && item.producto.precio_mayorista_kg) {
                                nuevoPrecio = item.producto.precio_mayorista_kg;
                              }
                            } else {
                              // Desactivando mayorista: cambiar a precio normal
                              if (item.tipo === 'unidad') {
                                nuevoPrecio = item.producto.precio_venta_unidad || 0;
                              } else if (item.tipo === 'paquete') {
                                nuevoPrecio = item.producto.precio_venta_paquete || 0;
                              } else if (item.tipo === 'kg') {
                                nuevoPrecio = item.producto.precio_venta_kg || 0;
                              }
                            }

                            return {
                              ...item,
                              precio_unitario: nuevoPrecio,
                              es_mayorista: nuevoEstado
                            };
                          });

                          setCart(cartActualizado);
                          toast.success(`Precios actualizados a ${nuevoEstado ? 'mayorista' : 'normal'}`);
                        } else {
                          toast.success(`Modo ${nuevoEstado ? 'mayorista' : 'normal'} activado`);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        esMayorista ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          esMayorista ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Checkbox Fiado */}
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="esFiado"
                        checked={esFiado}
                        onChange={(e) => {
                          setEsFiado(e.target.checked);
                          if (e.target.checked && !clienteSeleccionado) {
                            setShowClienteModal(true);
                          }
                          if (!e.target.checked) {
                            setClienteSeleccionado(null);
                          }
                        }}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-2 focus:ring-amber-500"
                      />
                      <label htmlFor="esFiado" className="font-medium text-gray-700 cursor-pointer">
                        Venta Fiada (Crédito)
                      </label>
                    </div>
                    {esFiado && clienteSeleccionado && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{clienteSeleccionado.nombre}</span>
                        <button
                          onClick={() => setShowClienteModal(true)}
                          className="text-xs text-amber-600 hover:text-amber-700"
                        >
                          Cambiar
                        </button>
                      </div>
                    )}
                    {esFiado && !clienteSeleccionado && (
                      <button
                        onClick={() => setShowClienteModal(true)}
                        className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
                      >
                        <Users className="w-4 h-4" />
                        Seleccionar
                      </button>
                    )}
                  </div>

                  {/* Dinero Recibido movido al modal de confirmación */}

                  {/* Total */}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-indigo-600">
                      {formatGuaranies(getTotal())}
                    </span>
                  </div>

                  {/* Advertencia de productos sin precio mayorista */}
                  {esMayorista && cart.some(item =>
                    (item.tipo === 'unidad' && (!item.producto.precio_mayorista_unidad || item.producto.precio_mayorista_unidad === 0)) ||
                    (item.tipo === 'paquete' && (!item.producto.precio_mayorista_paquete || item.producto.precio_mayorista_paquete === 0)) ||
                    (item.tipo === 'kg' && (!item.producto.precio_mayorista_kg || item.producto.precio_mayorista_kg === 0))
                  ) && (
                    <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                      <p className="text-red-800 font-medium text-sm">
                        ⚠️ Hay productos sin precio mayorista configurado. Desactiva el modo mayorista o configura los precios faltantes para poder finalizar la venta.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handlePrepararVenta}
                    disabled={
                      loading ||
                      cart.length === 0 ||
                      (esMayorista && cart.some(item =>
                        (item.tipo === 'unidad' && (!item.producto.precio_mayorista_unidad || item.producto.precio_mayorista_unidad === 0)) ||
                        (item.tipo === 'paquete' && (!item.producto.precio_mayorista_paquete || item.producto.precio_mayorista_paquete === 0)) ||
                        (item.tipo === 'kg' && (!item.producto.precio_mayorista_kg || item.producto.precio_mayorista_kg === 0))
                      ))
                    }
                    title={
                      esMayorista && cart.some(item =>
                        (item.tipo === 'unidad' && (!item.producto.precio_mayorista_unidad || item.producto.precio_mayorista_unidad === 0)) ||
                        (item.tipo === 'paquete' && (!item.producto.precio_mayorista_paquete || item.producto.precio_mayorista_paquete === 0)) ||
                        (item.tipo === 'kg' && (!item.producto.precio_mayorista_kg || item.producto.precio_mayorista_kg === 0))
                      )
                        ? 'Hay productos sin precio mayorista configurado'
                        : cart.length === 0
                        ? 'Agrega productos al carrito'
                        : 'Finalizar venta'
                    }
                    className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      'Procesando...'
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        {esFiado ? 'Registrar Venta Fiada' : 'Finalizar Venta'}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de abrir paquete temporalmente comentado */}
      {/* {showAbrirPaquete && productoAbrir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Abrir Paquete</h3>
            <p className="text-gray-600 mb-4">
              ¿Cuántas unidades del paquete "{productoAbrir.nombre}" deseas abrir?
            </p>
            <input
              type="number"
              min="1"
              max={productoAbrir.stock_paquetes}
              value={cantidadPaquetes}
              onChange={(e) => setCantidadPaquetes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAbrirPaquete(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    const cantidad = parseInt(cantidadPaquetes);
                    if (cantidad > productoAbrir.stock_paquetes) {
                      toast.error('No hay suficientes paquetes');
                      return;
                    }

                    // Actualizar stock
                    const { error } = await supabase
                      .from('productos')
                      .update({
                        stock_paquetes: productoAbrir.stock_paquetes - cantidad,
                        stock_unidades: productoAbrir.stock_unidades + (cantidad * (productoAbrir.unidades_por_paquete || 0))
                      })
                      .eq('id', productoAbrir.id);

                    if (error) throw error;

                    // Crear ajuste de inventario
                    const { error: ajusteError } = await supabase
                      .from('ajustes_inventario')
                      .insert({
                        producto_id: productoAbrir.id,
                        tipo_ajuste: 'apertura_paquete',
                        cantidad_ajuste: cantidad,
                        razon: `Apertura de ${cantidad} paquetes`,
                        usuario_id: user?.id || null
                      });

                    if (ajusteError) throw ajusteError;

                    toast.success('Paquetes abiertos exitosamente');
                    setShowAbrirPaquete(false);
                    loadProductos();
                  } catch (error: any) {
                    toast.error('Error al abrir paquetes: ' + error.message);
                  }
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )} */}

      {/* Confirm Modal para abrir paquete temporalmente comentado */}
      {/* {confirmAbrirPaquete.isOpen && (
        <ConfirmModal
          isOpen={confirmAbrirPaquete.isOpen}
          title="Abrir Paquete"
          message={`¿Deseas abrir un paquete de "${confirmAbrirPaquete.producto?.nombre}"?`}
          onConfirm={() => {
            setProductoAbrir(confirmAbrirPaquete.producto);
            setShowAbrirPaquete(true);
            setConfirmAbrirPaquete({ isOpen: false, producto: null });
          }}
          onCancel={() => setConfirmAbrirPaquete({ isOpen: false, producto: null })}
        />
      )} */}

      {/* Modal de ingreso de peso */}
      {showPesoModal && productoPesable && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setShowPesoModal(false);
              setPesoIngresado('');
              setProductoPesable(null);
              setEditingPesableIndex(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingPesableIndex !== null ? 'Editar Peso' : 'Ingresar Peso'}
            </h3>

            <div className="mb-4">
              <p className="text-gray-700 font-medium mb-2">{productoPesable.nombre}</p>
              <p className="text-sm text-gray-500 mb-4">
                Stock disponible: {formatearPeso(productoPesable.stock_kg)} kg ({Math.round(productoPesable.stock_kg * 1000)} g)
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Peso
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step={unidadPesoVenta === 'kg' ? '0.001' : '1'}
                  min={unidadPesoVenta === 'kg' ? '0.001' : '1'}
                  value={pesoIngresado}
                  onChange={(e) => setPesoIngresado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleConfirmarPeso();
                    }
                  }}
                  autoFocus
                  className="w-56 sm:flex-1 px-3 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={unidadPesoVenta === 'kg' ? '0.000' : '0'}
                />
                <select
                  value={unidadPesoVenta}
                  onChange={(e) => setUnidadPesoVenta(e.target.value as 'kg' | 'g')}
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
                      {formatGuaranies(productoPesable.precio_venta_kg || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Peso ingresado:</span>
                    <span className="font-semibold text-gray-800">
                      {unidadPesoVenta === 'kg'
                        ? formatearPeso(parseFloat(pesoIngresado))
                        : Math.round(parseFloat(pesoIngresado))
                      } {unidadPesoVenta}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Equivalente en kg:</span>
                    <span className="font-semibold text-gray-800">
                      {formatearPeso(convertirAKg(parseFloat(pesoIngresado), unidadPesoVenta))} kg
                    </span>
                  </div>
                  <div className="border-t border-indigo-300 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold text-gray-700">Total:</span>
                      <span className="text-xl font-bold text-indigo-600">
                        {formatGuaranies((productoPesable.precio_venta_kg || 0) * convertirAKg(parseFloat(pesoIngresado), unidadPesoVenta))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPesoModal(false);
                  setPesoIngresado('');
                  setProductoPesable(null);
                  setEditingPesableIndex(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarPeso}
                disabled={!pesoIngresado || isNaN(parseFloat(pesoIngresado)) || parseFloat(pesoIngresado) <= 0}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Operaciones */}
      {showAnulaciones && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowAnulaciones(false);
              setVentaSeleccionada(null);
              setItemsAnular(new Map());
              setUnidadesPesoAnular(new Map());
              setCantidadesAnularTemp(new Map());
              setFocusedItemAnularIndex(-1);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <FileX className="w-6 h-6" />
                Operaciones de Ventas
              </h2>
              <p className="text-sm text-indigo-100 mt-1">Últimas 20 ventas - Selecciona items para anular o marcar como fiado</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {!ventaSeleccionada ? (
                /* Lista de ventas */
                <div className="space-y-4">
                  {/* Filtros de búsqueda */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-gray-700 text-sm">Filtros de Búsqueda</h3>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="w-full md:w-auto md:flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            N° de Venta
                          </label>
                          <input
                            type="text"
                            value={searchNumeroVenta}
                            onChange={(e) => setSearchNumeroVenta(e.target.value)}
                            placeholder="Buscar por número de venta (ej: #123 o 123)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div className="w-full md:w-auto md:flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Filtro de Fecha
                          </label>
                          <select
                            value={tipoFiltroFecha}
                            onChange={(e) => {
                              setTipoFiltroFecha(e.target.value as 'todos' | 'fecha_especifica' | 'rango');
                              setFechaEspecifica('');
                              setFechaDesdeAnulacion('');
                              setFechaHastaAnulacion('');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                          >
                            <option value="todos">Todos los registros</option>
                            <option value="fecha_especifica">Fecha específica</option>
                            <option value="rango">Rango de fechas</option>
                          </select>
                        </div>
                      </div>
                      {tipoFiltroFecha === 'fecha_especifica' && (
                        <div className="flex flex-col md:flex-row gap-3">
                          <div className="w-full md:flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Fecha
                            </label>
                            <input
                              type="date"
                              value={fechaEspecifica}
                              onChange={(e) => setFechaEspecifica(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                            />
                          </div>
                        </div>
                      )}
                      {tipoFiltroFecha === 'rango' && (
                        <div className="flex flex-col md:flex-row gap-3">
                          <div className="w-full md:flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Fecha Desde
                            </label>
                            <input
                              type="date"
                              value={fechaDesdeAnulacion}
                              onChange={(e) => setFechaDesdeAnulacion(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                            />
                          </div>
                          <div className="w-full md:flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Fecha Hasta
                            </label>
                            <input
                              type="date"
                              value={fechaHastaAnulacion}
                              onChange={(e) => setFechaHastaAnulacion(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                            />
                          </div>
                        </div>
                      )}
                      <div className="w-full md:w-auto md:flex-shrink-0">
                        <button
                          onClick={() => {
                            setSearchNumeroVenta('');
                            setTipoFiltroFecha('todos');
                            setFechaEspecifica('');
                            setFechaDesdeAnulacion('');
                            setFechaHastaAnulacion('');
                            setPaginaActualVentas(1);
                          }}
                          className="w-full md:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                        >
                          Limpiar Filtros
                        </button>
                      </div>
                    </div>
                  </div>

                  {loadingVentas ? (
                    <p className="text-center text-gray-500 py-8">Cargando ventas...</p>
                  ) : ventasRecientes.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No hay ventas recientes</p>
                  ) : (
                    ventasRecientes.map((venta, idx) => {
                      const montoRestante = venta.es_fiado ? (venta.total - (venta.monto_pagado || 0)) : 0;
                      const esFiadoPendiente = venta.es_fiado && !venta.fiado_completado;

                      return (
                        <div
                          key={venta.id}
                          className={`border rounded-lg p-4 hover:border-red-300 hover:shadow-md transition cursor-pointer ${
                            keyboardNavAnulaciones && focusedVentaIndex === idx
                              ? 'border-red-500 bg-red-50 shadow-md'
                              : esFiadoPendiente
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200'
                          }`}
                          onClick={() => seleccionarVentaParaAnular(venta)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-gray-900">Venta #{venta.numero_venta}</p>
                                {venta.es_fiado && (
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                    venta.fiado_completado
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {venta.fiado_completado ? 'FIADO PAGADO' : 'FIADO'}
                                  </span>
                                )}
                                {venta.es_mayorista && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                                    MAYORISTA
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{new Date(venta.fecha).toLocaleString('es-PY')}</p>
                              {venta.es_fiado && venta.clientes && (
                                <p className="text-sm text-blue-700 font-medium mt-1">
                                  Cliente: {venta.clientes.nombre}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              {esFiadoPendiente ? (
                                <>
                                  <p className="text-sm text-gray-500 line-through">{formatGuaranies(venta.total)}</p>
                                  <p className="text-lg font-bold text-blue-700">{formatGuaranies(montoRestante)}</p>
                                  <p className="text-xs text-blue-600">Monto pendiente</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-lg font-bold text-gray-900">{formatGuaranies(venta.total)}</p>
                                  <p className="text-xs text-gray-500">{venta.venta_items?.length || 0} items</p>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600">
                            Vendedor: {venta.user_profiles?.full_name || 'N/A'}
                          </p>
                        </div>
                      );
                    })
                  )}
                  {!ventaSeleccionada && renderPaginacionVentas()}
                </div>
              ) : (
                /* Detalle de venta para anular */
                <div className="space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">Venta #{ventaSeleccionada.numero_venta}</p>
                          {ventaSeleccionada.es_fiado && (
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              ventaSeleccionada.fiado_completado
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {ventaSeleccionada.fiado_completado ? 'FIADO PAGADO' : 'FIADO'}
                            </span>
                          )}
                          {ventaSeleccionada.es_mayorista && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                              MAYORISTA
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{new Date(ventaSeleccionada.fecha).toLocaleString('es-PY')}</p>
                        {ventaSeleccionada.es_fiado && ventaSeleccionada.clientes && (
                          <p className="text-sm text-blue-700 font-medium mt-1">
                            Cliente: {ventaSeleccionada.clientes.nombre}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setVentaSeleccionada(null);
                          setItemsAnular(new Map());
                          setCantidadesYaAnuladas(new Map());
                          setUnidadesPesoAnular(new Map());
                          setCantidadesAnularTemp(new Map());
                          setFocusedItemAnularIndex(-1);
                        }}
                        className="text-gray-600 hover:text-gray-800 ml-2"
                      >
                        ← Volver
                      </button>
                    </div>
                    {ventaSeleccionada.es_fiado && !ventaSeleccionada.fiado_completado ? (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-500">Total original: <span className="line-through">{formatGuaranies(ventaSeleccionada.total)}</span></p>
                        <p className="text-sm text-gray-600">Monto pagado: {formatGuaranies(ventaSeleccionada.monto_pagado || 0)}</p>
                        <p className="text-lg font-bold text-blue-700">
                          Monto pendiente: {formatGuaranies(ventaSeleccionada.total - (ventaSeleccionada.monto_pagado || 0))}
                        </p>
                      </div>
                    ) : (
                      <p className="text-lg font-bold text-gray-900">{formatGuaranies(ventaSeleccionada.total)}</p>
                    )}
                  </div>

                  {/* Botón para descargar ticket con items no anulados */}
                  <div className="mt-4">
                    <button
                      onClick={async () => {
                        if (!ventaSeleccionada) return;

                        // Filtrar items no anulados
                        const itemsNoAnulados = ventaSeleccionada.venta_items?.filter((item: any) => {
                          const cantidadYaAnulada = cantidadesYaAnuladas.get(item.id) || 0;
                          const cantidadDisponible = item.cantidad - cantidadYaAnulada;
                          return cantidadDisponible > 0;
                        }).map((item: any) => {
                          const cantidadYaAnulada = cantidadesYaAnuladas.get(item.id) || 0;
                          return {
                            ...item,
                            cantidad: item.cantidad - cantidadYaAnulada,
                            subtotal: (item.cantidad - cantidadYaAnulada) * item.precio_unitario
                          };
                        }) || [];

                        if (itemsNoAnulados.length === 0) {
                          toast.error('No hay items disponibles para generar el ticket');
                          return;
                        }

                        // Calcular nuevo total
                        const nuevoTotal = itemsNoAnulados.reduce((sum: number, item: any) => sum + item.subtotal, 0);

                        try {
                          // Obtener configuración de ticket de la base de datos
                          const { data: configData, error: configError } = await supabase
                            .from('ticket_config')
                            .select('*')
                            .eq('is_active', true)
                            .single();

                          if (configError) {
                            console.error('Error al cargar configuración de ticket:', configError);
                            toast.error('Error al cargar configuración del ticket');
                            return;
                          }

                          // Preparar datos para el ticket
                          const ticketData = {
                            venta: {
                              ...ventaSeleccionada,
                              total: nuevoTotal
                            },
                            items: itemsNoAnulados,
                            vendedor: ventaSeleccionada.user_profiles?.full_name || 'Vendedor',
                            config: configData
                          };

                          await openTicketPDF(ticketData);
                          toast.success('Ticket generado correctamente');
                        } catch (error) {
                          console.error('Error al generar ticket:', error);
                          toast.error('Error al generar el ticket');
                        }
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <FileX className="w-4 h-4" />
                      Descargar Ticket (Items No Anulados)
                    </button>
                  </div>

                  {/* Items de la venta */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Selecciona items a anular:
                      <span className="text-xs text-gray-500 ml-2">(Usa ↑↓ para navegar, Enter para marcar/desmarcar)</span>
                    </h3>
                    {ventaSeleccionada.venta_items?.map((item: any, idx: number) => {
                      const cantidadYaAnulada = cantidadesYaAnuladas.get(item.id) || 0;
                      const cantidadDisponible = item.cantidad - cantidadYaAnulada;
                      const itemTotalmenteAnulado = cantidadDisponible <= 0;
                      const isFocused = focusedItemAnularIndex === idx;
                      const esPesable = item.unidad_medida === 'kg';
                      const unidadPeso = unidadesPesoAnular.get(item.id) || 'kg';

                      // Calcular cantidad en la unidad seleccionada
                      let cantidadEnUnidad = itemsAnular.get(item.id) || cantidadDisponible;
                      let cantidadMaxEnUnidad = cantidadDisponible;
                      if (esPesable && unidadPeso === 'g') {
                        cantidadEnUnidad = cantidadEnUnidad * 1000;
                        cantidadMaxEnUnidad = cantidadMaxEnUnidad * 1000;
                      }

                      return (
                        <div
                          key={item.id}
                          id={`item-anular-${item.id}`}
                          className={`border rounded-lg p-3 transition-all ${
                            itemTotalmenteAnulado
                              ? 'border-gray-300 bg-gray-100 opacity-60'
                              : isFocused
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : itemsAnular.has(item.id)
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={itemsAnular.has(item.id)}
                              onChange={() => toggleItemAnular(item.id, cantidadDisponible)}
                              disabled={itemTotalmenteAnulado}
                              className="mt-1 w-5 h-5 text-red-600 disabled:opacity-50"
                            />
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{item.productos?.nombre}</p>
                              <p className="text-sm text-gray-600">
                                {item.cantidad} {item.unidad_medida} × {formatGuaranies(item.precio_unitario)} = {formatGuaranies(item.subtotal)}
                              </p>
                              {cantidadYaAnulada > 0 && (
                                <p className="text-xs text-orange-600 mt-1">
                                  ⚠ Ya anulado: {cantidadYaAnulada} {item.unidad_medida}
                                  {itemTotalmenteAnulado ? ' (Completamente anulado)' : ` | Disponible: ${cantidadDisponible} ${item.unidad_medida}`}
                                </p>
                              )}
                              {itemsAnular.has(item.id) && !itemTotalmenteAnulado && (
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  <label className="text-sm text-gray-700">Cantidad a anular:</label>
                                  <input
                                    id={`cantidad-anular-${item.id}`}
                                    type="number"
                                    min={esPesable ? "0.01" : "1"}
                                    max={cantidadMaxEnUnidad}
                                    step={esPesable ? "0.01" : "1"}
                                    value={cantidadesAnularTemp.get(item.id) ?? cantidadEnUnidad}
                                    onFocus={(e) => {
                                      // Guardar valor actual en estado temporal
                                      const newTemp = new Map(cantidadesAnularTemp);
                                      newTemp.set(item.id, e.target.value);
                                      setCantidadesAnularTemp(newTemp);
                                    }}
                                    onKeyDown={(e) => {
                                      // Enter para quitar el foco y volver a navegar
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                        return;
                                      }

                                      // Prevenir decimales en unidades y paquetes
                                      if (!esPesable && (e.key === '.' || e.key === ',')) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onChange={(e) => {
                                      const inputVal = e.target.value;

                                      // Actualizar estado temporal
                                      const newTemp = new Map(cantidadesAnularTemp);
                                      newTemp.set(item.id, inputVal);
                                      setCantidadesAnularTemp(newTemp);

                                      // Si el input está vacío, no validar aún
                                      if (inputVal === '') return;

                                      const val = parseFloat(inputVal);
                                      if (isNaN(val)) return;

                                      // Para unidades y paquetes, solo permitir enteros
                                      if (!esPesable) {
                                        const valEntero = Math.floor(val);
                                        if (valEntero >= 1 && valEntero <= cantidadMaxEnUnidad) {
                                          updateCantidadAnular(item.id, valEntero);
                                        }
                                      } else {
                                        // Para kg, permitir decimales y convertir si es necesario
                                        if (val > 0 && val <= cantidadMaxEnUnidad) {
                                          const cantidadEnKg = unidadPeso === 'g' ? val / 1000 : val;
                                          if (cantidadEnKg <= cantidadDisponible) {
                                            updateCantidadAnular(item.id, cantidadEnKg);
                                          }
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      // Al perder el foco, asegurar que el valor sea válido
                                      const val = parseFloat(e.target.value);
                                      if (isNaN(val) || val <= 0) {
                                        // Restaurar valor mínimo válido
                                        const minVal = esPesable ? 0.01 : 1;
                                        updateCantidadAnular(item.id, esPesable && unidadPeso === 'g' ? minVal / 1000 : minVal);
                                      }
                                      // Limpiar estado temporal
                                      const newTemp = new Map(cantidadesAnularTemp);
                                      newTemp.delete(item.id);
                                      setCantidadesAnularTemp(newTemp);
                                    }}
                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  {esPesable && (
                                    <select
                                      value={unidadPeso}
                                      onChange={(e) => handleCambioUnidadPeso(item.id, e.target.value as 'kg' | 'g')}
                                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                                    >
                                      <option value="kg">Kg</option>
                                      <option value="g">g</option>
                                    </select>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    de {esPesable && unidadPeso === 'g' ? (cantidadMaxEnUnidad).toFixed(0) : cantidadMaxEnUnidad} disponibles
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resumen de selección */}
                  {itemsAnular.size > 0 && (() => {
                    let totalSeleccionado = 0;
                    for (const [itemId, cantidad] of itemsAnular.entries()) {
                      const item = ventaSeleccionada.venta_items.find((vi: any) => vi.id === itemId);
                      if (item) {
                        totalSeleccionado += cantidad * item.precio_unitario;
                      }
                    }

                    const esFiadoPendiente = ventaSeleccionada.es_fiado && !ventaSeleccionada.fiado_completado;
                    const montoRestante = esFiadoPendiente
                      ? ventaSeleccionada.total - (ventaSeleccionada.monto_pagado || 0)
                      : 0;
                    const excedeLimite = esFiadoPendiente && totalSeleccionado > montoRestante;

                    return (
                      <div className={`border rounded-lg p-4 ${
                        excedeLimite
                          ? 'bg-red-50 border-red-300'
                          : 'bg-blue-50 border-blue-300'
                      }`}>
                        <h4 className="font-semibold text-gray-900 mb-2">Resumen de Selección</h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-700">
                            Items seleccionados: <span className="font-bold">{itemsAnular.size}</span>
                          </p>
                          <p className="text-gray-700">
                            Total de items seleccionados: <span className="font-bold">{formatGuaranies(totalSeleccionado)}</span>
                          </p>
                          {esFiadoPendiente && (
                            <>
                              <p className="text-blue-700 font-medium">
                                Monto pendiente de deuda: <span className="font-bold">{formatGuaranies(montoRestante)}</span>
                              </p>
                              {excedeLimite && (
                                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                                  <p className="text-red-800 font-medium text-xs">
                                    ⚠️ El total seleccionado excede el monto pendiente en {formatGuaranies(totalSeleccionado - montoRestante)}.
                                    No podrás marcar estos items como fiado ni anularlos hasta ajustar la selección.
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Motivo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo de operación (opcional):
                    </label>
                    <textarea
                      value={motivoAnulacion}
                      onChange={(e) => setMotivoAnulacion(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                      rows={3}
                      placeholder="Ej: Error en el pedido, cliente solicitó cancelación, conversión a fiado, etc."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 md:p-6 bg-gray-50 flex gap-3">
              {!ventaSeleccionada ? (
                <button
                  onClick={() => {
                    setShowAnulaciones(false);
                    setVentaSeleccionada(null);
                    setItemsAnular(new Map());
                    setMotivoAnulacion('');
                    setUnidadesPesoAnular(new Map());
                    setCantidadesAnularTemp(new Map());
                    setFocusedItemAnularIndex(-1);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
                >
                  Cerrar
                </button>
              ) : (() => {
                // Calcular si los botones deben estar deshabilitados
                let totalItemsSeleccionados = 0;
                for (const [itemId, cantidad] of itemsAnular.entries()) {
                  const item = ventaSeleccionada.venta_items.find((vi: any) => vi.id === itemId);
                  if (item) {
                    totalItemsSeleccionados += cantidad * item.precio_unitario;
                  }
                }

                const esFiadoPendiente = ventaSeleccionada.es_fiado && !ventaSeleccionada.fiado_completado;
                const montoRestante = esFiadoPendiente
                  ? ventaSeleccionada.total - (ventaSeleccionada.monto_pagado || 0)
                  : 0;
                const excedeLimite = esFiadoPendiente && totalItemsSeleccionados > montoRestante;

                const deshabilitarPorSinSeleccion = itemsAnular.size === 0;
                const deshabilitarPorExceso = excedeLimite;

                return (
                  <>
                    <button
                      onClick={() => {
                        setVentaSeleccionada(null);
                        setItemsAnular(new Map());
                        setMotivoAnulacion('');
                        setUnidadesPesoAnular(new Map());
                        setCantidadesAnularTemp(new Map());
                        setFocusedItemAnularIndex(-1);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleMarcarComoFiado}
                      disabled={deshabilitarPorSinSeleccion || deshabilitarPorExceso || ventaSeleccionada.es_fiado}
                      title={
                        ventaSeleccionada.es_fiado
                          ? 'Esta venta ya está marcada como fiado'
                          : deshabilitarPorSinSeleccion
                          ? 'Selecciona al menos un item'
                          : deshabilitarPorExceso
                          ? `El total seleccionado (${formatGuaranies(totalItemsSeleccionados)}) excede el monto pendiente (${formatGuaranies(montoRestante)})`
                          : 'Marcar items como fiado'
                      }
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Marcar como Fiado
                    </button>
                    <button
                      onClick={handleAnularVenta}
                      disabled={loading || deshabilitarPorSinSeleccion || deshabilitarPorExceso}
                      title={
                        loading
                          ? 'Procesando anulación...'
                          : deshabilitarPorSinSeleccion
                          ? 'Selecciona al menos un item'
                          : deshabilitarPorExceso
                          ? `El total seleccionado (${formatGuaranies(totalItemsSeleccionados)}) excede el monto pendiente (${formatGuaranies(montoRestante)})`
                          : 'Anular items seleccionados'
                      }
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Procesando...' : 'Anular Items Seleccionados'}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Escáner de código de barras */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Cliente Modal para marcar como fiado desde operaciones */}
      <ClienteModal
        isOpen={showClienteModalOperaciones}
        onClose={() => setShowClienteModalOperaciones(false)}
        onSelectCliente={handleClienteSeleccionadoFiado}
        title="Seleccionar Cliente para Fiado"
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
      />

      {/* Cliente Modal */}
      <ClienteModal
        isOpen={showClienteModal}
        onClose={() => setShowClienteModal(false)}
        onSelectCliente={(cliente) => {
          setClienteSeleccionado(cliente);
          setShowClienteModal(false);
        }}
        title="Seleccionar Cliente para Venta Fiada"
      />

      {/* Modal de Confirmación de Venta */}
      {showConfirmVentaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-900">Confirmar Venta</h3>

            <div className="space-y-4">
              {/* Total a Cobrar */}
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-700">Total a Cobrar:</span>
                  <span className="text-2xl font-bold text-indigo-600">
                    {formatGuaranies(getTotal())}
                  </span>
                </div>
              </div>

              {/* Dinero Recibido */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {esFiado ? 'Pago Inicial (opcional)' : 'Dinero Recibido (opcional)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">₲</span>
                  <input
                    type="text"
                    value={formatGuaraniesInput(dineroRecibidoModal)}
                    onChange={(e) => {
                      const value = e.target.value;
                      const onlyNumbers = value.replace(/\D/g, '');
                      setDineroRecibidoModal(onlyNumbers);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCheckout();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowConfirmVentaModal(false);
                        setDineroRecibidoModal('');
                      }
                    }}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                {/* Mostrar vuelto solo si NO es fiado */}
                {!esFiado && dineroRecibidoModal && parseFloat(dineroRecibidoModal) >= getTotal() && (
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg mt-2">
                    <span className="font-medium text-gray-700">Vuelto:</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatGuaranies(parseFloat(dineroRecibidoModal) - getTotal())}
                    </span>
                  </div>
                )}
                {/* Mostrar monto pendiente si ES fiado y hay pago parcial */}
                {esFiado && dineroRecibidoModal && parseFloat(dineroRecibidoModal) > 0 && (
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg mt-2">
                    <span className="font-medium text-gray-700">Monto Pendiente:</span>
                    <span className="text-xl font-bold text-amber-600">
                      {formatGuaranies(Math.max(0, getTotal() - parseFloat(dineroRecibidoModal)))}
                    </span>
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowConfirmVentaModal(false);
                    setDineroRecibidoModal('');
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Procesando...'
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Confirmar Venta
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
