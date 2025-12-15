import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Cliente, Venta, VentaItem, Producto } from '../../types';
import { ArrowLeft, User, Phone, DollarSign, Calendar, Search, Filter, Plus, X, ShoppingCart, Package, Eye, Edit2, Trash2, Users } from 'lucide-react';
import { formatGuaranies, parseGuaranies, formatGuaraniesInput } from '../../utils/currency';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { ClienteModal } from '../common/ClienteModal';
import { PesoModal } from '../common/PesoModal';
import { GestionClientesModal } from '../common/GestionClientesModal';

interface ClienteConDeuda extends Cliente {
  total_adeudado: number;
  cantidad_compras: number;
}

interface VentaFiada extends Venta {
  items: VentaItem[];
  saldo_pendiente: number;
}

const ITEMS_PER_PAGE = 20;

export const Fiados = () => {
  const [clientes, setClientes] = useState<ClienteConDeuda[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteConDeuda | null>(null);
  const [ventas, setVentas] = useState<VentaFiada[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal de pago
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [ventaPagar, setVentaPagar] = useState<VentaFiada | null>(null);
  const [montoPago, setMontoPago] = useState('');
  const [pagoCompleto, setPagoCompleto] = useState(true);
  const [dineroRecibido, setDineroRecibido] = useState('');

  // Modal de pago total
  const [showPagoTotalModal, setShowPagoTotalModal] = useState(false);

  // Navegación con teclado
  const [focusedClienteIndex, setFocusedClienteIndex] = useState(-1);

  // Modal de agregar cliente
  const [showClienteModal, setShowClienteModal] = useState(false);

  // Modal de gestión de clientes
  const [showGestionClientesModal, setShowGestionClientesModal] = useState(false);

  // Modal de agregar deuda manual
  const [showDeudaManualModal, setShowDeudaManualModal] = useState(false);
  const [clienteDeuda, setClienteDeuda] = useState<Cliente | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosDeuda, setProductosDeuda] = useState<Array<{
    id: string;
    producto: Producto;
    tipo: 'unidad' | 'paquete' | 'kg';
    cantidad: number;
    precio_unitario: number;
    es_mayorista: boolean;
  }>>([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [busquedaClienteModal, setBusquedaClienteModal] = useState('');
  const [clientesDisponibles, setClientesDisponibles] = useState<Cliente[]>([]);
  const [esMayoristaDeuda, setEsMayoristaDeuda] = useState(false);
  const [descontarInventario, setDescontarInventario] = useState(true);
  const [focusedProductoIndex, setFocusedProductoIndex] = useState(-1);

  // Modal de peso para productos pesables
  const [showPesoModal, setShowPesoModal] = useState(false);
  const [productoPesable, setProductoPesable] = useState<Producto | null>(null);

  // Modal de selección de tipo (unidad/paquete) para productos paquete
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [productoTipoSeleccion, setProductoTipoSeleccion] = useState<Producto | null>(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<'paquete' | 'unidad'>('paquete'); // Por defecto paquete

  // Estados para eliminación
  const [ventaEliminar, setVentaEliminar] = useState<VentaFiada | null>(null);
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false);
  const [eliminandoTodoCliente, setEliminandoTodoCliente] = useState(false);
  const [clienteEliminar, setClienteEliminar] = useState<ClienteConDeuda | null>(null);

  // Estados para edición
  const [ventaEditando, setVentaEditando] = useState<VentaFiada | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);

  const { user } = useAuth();

  // Función para formatear peso (mostrar sin decimales si es número exacto)
  const formatearPeso = (kg: number): string => {
    if (Number.isInteger(kg)) {
      return kg.toString();
    }
    return kg.toFixed(3);
  };

  useEffect(() => {
    loadClientes();
    corregirVentasFiadasCompletadas();
  }, []);

  // Función para corregir ventas antiguas que tienen fiado_completado=true pero es_fiado=true
  const corregirVentasFiadasCompletadas = async () => {
    try {
      // Actualizar todas las ventas que están marcadas como fiado_completado pero siguen siendo es_fiado
      const { error } = await supabase
        .from('ventas')
        .update({ es_fiado: false })
        .eq('fiado_completado', true)
        .eq('es_fiado', true);

      if (error) {
        console.error('Error al corregir ventas fiadas completadas:', error);
      }
    } catch (error) {
      console.error('Error al corregir ventas fiadas completadas:', error);
    }
  };

  // Manejador de Escape para cerrar modales en el orden correcto
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();

        // Cerrar modales en orden de prioridad (el que está más al frente primero)
        if (showPagoModal) {
          setShowPagoModal(false);
          setVentaPagar(null);
        } else if (showPagoTotalModal) {
          setShowPagoTotalModal(false);
          setDineroRecibido('');
          setMontoPago('');
        } else if (showPesoModal) {
          setShowPesoModal(false);
          setProductoPesable(null);
        } else if (showTipoModal) {
          setShowTipoModal(false);
          setProductoTipoSeleccion(null);
        } else if (showClienteModal) {
          setShowClienteModal(false);
        } else if (showGestionClientesModal) {
          setShowGestionClientesModal(false);
        } else if (showDeudaManualModal) {
          setShowDeudaManualModal(false);
        } else if (clienteSeleccionado) {
          // Si no hay modales abiertos, cerrar el modal de detalles del cliente
          setClienteSeleccionado(null);
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showPagoModal, showPagoTotalModal, showPesoModal, showTipoModal, showClienteModal, showDeudaManualModal, clienteSeleccionado]);

  // Prevenir Backspace cuando no está en un input (evita navegación hacia atrás del navegador)
  useEffect(() => {
    const handleBackspace = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();

        // Solo permitir Backspace en inputs, textareas y elementos editables
        if (
          tagName !== 'input' &&
          tagName !== 'textarea' &&
          !target.isContentEditable
        ) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleBackspace);
    return () => window.removeEventListener('keydown', handleBackspace);
  }, []);

  // Navegación con teclado para búsqueda de clientes en modal de deuda
  const [focusedClienteModalIndex, setFocusedClienteModalIndex] = useState(-1);

  useEffect(() => {
    if (!showDeudaManualModal || !busquedaClienteModal || clienteDeuda) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const filtered = clientesFiltradosModal;

      if (filtered.length === 0) return;

      // Si hay solo 1 resultado y se presiona Enter, seleccionarlo directamente
      if (e.key === 'Enter' && filtered.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        setClienteDeuda(filtered[0]);
        setBusquedaClienteModal('');
        setFocusedClienteModalIndex(-1);
        toast.success(`Cliente ${filtered[0].nombre} seleccionado`);
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setFocusedClienteModalIndex((prev) => {
            const next = prev + 1;
            return next >= filtered.length ? 0 : next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setFocusedClienteModalIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? filtered.length - 1 : next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (focusedClienteModalIndex >= 0 && focusedClienteModalIndex < filtered.length) {
            const cliente = filtered[focusedClienteModalIndex];
            setClienteDeuda(cliente);
            setBusquedaClienteModal('');
            setFocusedClienteModalIndex(-1);
            toast.success(`Cliente ${cliente.nombre} seleccionado`);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          setFocusedClienteModalIndex(-1);
          setBusquedaClienteModal('');
          break;
      }
    };

    // Agregar listener solo al modal de deuda
    const modalElement = document.querySelector('[data-deuda-modal]');
    if (modalElement) {
      modalElement.addEventListener('keydown', handleKeyDown, true);
      return () => {
        modalElement.removeEventListener('keydown', handleKeyDown, true);
      };
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeudaManualModal, busquedaClienteModal, focusedClienteModalIndex, clientesDisponibles, clienteDeuda]);

  // Navegación con teclado para modal de selección de tipo (paquete/unidad)
  useEffect(() => {
    if (!showTipoModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          setTipoSeleccionado('paquete');
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          setTipoSeleccionado('unidad');
          break;
        case 'Enter':
          e.preventDefault();
          if (productoTipoSeleccion) {
            addToCartDeuda(productoTipoSeleccion, tipoSeleccionado);
            setShowTipoModal(false);
            setProductoTipoSeleccion(null);
            setTipoSeleccionado('paquete'); // Reset
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTipoModal, tipoSeleccionado, productoTipoSeleccion]);

  const loadClientes = async () => {
    setLoading(true);
    try {
      // Obtener todos los clientes con deudas pendientes
      const { data: ventasData, error } = await supabase
        .from('ventas')
        .select(`
          id,
          total,
          monto_pagado,
          cliente_id,
          clientes (
            id,
            nombre,
            telefono,
            notas
          )
        `)
        .eq('es_fiado', true)
        .eq('fiado_completado', false);

      if (error) throw error;

      // Agrupar por cliente y calcular deuda total
      const clientesMap = new Map<string, ClienteConDeuda>();

      ventasData?.forEach((venta: any) => {
        if (!venta.clientes) return;

        const clienteId = venta.clientes.id;
        const saldo = venta.total - (venta.monto_pagado || 0);

        if (clientesMap.has(clienteId)) {
          const cliente = clientesMap.get(clienteId)!;
          cliente.total_adeudado += saldo;
          cliente.cantidad_compras += 1;
        } else {
          clientesMap.set(clienteId, {
            ...venta.clientes,
            total_adeudado: saldo,
            cantidad_compras: 1,
            is_active: true,
            created_at: '',
            updated_at: ''
          });
        }
      });

      const clientesArray = Array.from(clientesMap.values())
        .filter(c => c.total_adeudado > 0)
        .sort((a, b) => b.total_adeudado - a.total_adeudado);

      setClientes(clientesArray);
    } catch (error) {
      console.error('Error al cargar clientes con deudas:', error);
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const loadVentasCliente = async (clienteId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          venta_items (
            *,
            productos (*)
          )
        `)
        .eq('cliente_id', clienteId)
        .eq('es_fiado', true)
        .eq('fiado_completado', false)
        .order('fecha', { ascending: false });

      if (error) throw error;

      const ventasConSaldo: VentaFiada[] = (data || []).map((venta: any) => ({
        ...venta,
        items: (venta.venta_items || []).map((item: any) => ({
          ...item,
          producto: item.productos // Mapear productos a producto
        })),
        saldo_pendiente: venta.total - (venta.monto_pagado || 0),
        cliente: undefined,
        vendedor: undefined
      }));

      setVentas(ventasConSaldo.filter(v => v.saldo_pendiente > 0));
    } catch (error) {
      console.error('Error al cargar ventas del cliente:', error);
      toast.error('Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCliente = (cliente: ClienteConDeuda) => {
    setClienteSeleccionado(cliente);
    loadVentasCliente(cliente.id);
  };

  const handlePagar = (venta: VentaFiada) => {
    setVentaPagar(venta);
    setMontoPago(venta.saldo_pendiente.toString());
    setPagoCompleto(true);
    setDineroRecibido('');
    setShowPagoModal(true);
  };

  const handleConfirmarPago = async () => {
    if (!ventaPagar) return;

    const montoPagoNum = parseFloat(montoPago) || 0;
    const dineroRecibidoNum = dineroRecibido ? parseFloat(dineroRecibido) : 0;

    if (montoPagoNum <= 0) {
      toast.error('El monto de pago debe ser mayor a 0');
      return;
    }

    // Validar dinero recibido solo cuando es pago completo
    if (pagoCompleto && dineroRecibidoNum > 0 && dineroRecibidoNum < ventaPagar.saldo_pendiente) {
      toast.error('El dinero recibido es menor al saldo a pagar');
      return;
    }

    setLoading(true);
    try {
      // Si el monto es mayor al saldo, pagar solo el saldo y calcular vuelto
      const montoAPagar = Math.min(montoPagoNum, ventaPagar.saldo_pendiente);
      const nuevoMontoPagado = (ventaPagar.monto_pagado || 0) + montoAPagar;
      const fiadoCompletado = nuevoMontoPagado >= ventaPagar.total;

      // Actualizar venta
      const { error: updateError } = await supabase
        .from('ventas')
        .update({
          monto_pagado: nuevoMontoPagado,
          fiado_completado: fiadoCompletado,
          es_fiado: !fiadoCompletado, // Cuando se completa el pago, ya no es fiado
          tipo_pago: fiadoCompletado ? 'contado' : 'fiado'
        })
        .eq('id', ventaPagar.id);

      if (updateError) throw updateError;

      // Registrar operación
      const { error: opError } = await supabase
        .from('operaciones')
        .insert({
          venta_id: ventaPagar.id,
          tipo_operacion: fiadoCompletado ? 'cancelacion_fiado' : 'abono_parcial',
          total_anulado: 0,
          motivo: fiadoCompletado
            ? 'Cancelación completa de fiado'
            : `Abono parcial: ${formatGuaranies(montoAPagar)}`,
          anulado_por: user?.id,
          cliente_id: ventaPagar.cliente_id,
          monto_operacion: montoAPagar,
          items_anulados: []
        });

      if (opError) throw opError;

      // Calcular vuelto
      let vuelto = 0;
      if (pagoCompleto && dineroRecibidoNum > 0) {
        vuelto = dineroRecibidoNum - ventaPagar.saldo_pendiente;
      } else if (!pagoCompleto && montoPagoNum > ventaPagar.saldo_pendiente) {
        vuelto = montoPagoNum - ventaPagar.saldo_pendiente;
      }

      if (fiadoCompletado) {
        toast.success('Fiado cancelado completamente');
      } else {
        toast.success(`Abono registrado: ${formatGuaranies(montoAPagar)}`);
      }

      if (vuelto > 0) {
        toast.info(`Vuelto: ${formatGuaranies(vuelto)}`);
      }

      setShowPagoModal(false);
      setVentaPagar(null);
      setMontoPago('');
      setDineroRecibido('');

      // Recargar datos
      if (clienteSeleccionado) {
        await loadVentasCliente(clienteSeleccionado.id);
      }
      await loadClientes();

      // Si se completó el fiado y no hay más ventas, volver a la lista
      if (fiadoCompletado && ventas.length <= 1) {
        setClienteSeleccionado(null);
      }
    } catch (error) {
      console.error('Error al registrar pago:', error);
      toast.error('Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  const handlePagarTodo = async () => {
    if (!clienteSeleccionado) return;

    const totalDeuda = ventas.reduce((sum, v) => sum + v.saldo_pendiente, 0);
    const montoPagoNum = parseFloat(montoPago) || 0;
    const dineroRecibidoNum = dineroRecibido ? parseFloat(dineroRecibido) : 0;

    if (montoPagoNum <= 0) {
      toast.error('El monto de pago debe ser mayor a 0');
      return;
    }

    // Validar dinero recibido solo cuando es pago completo
    if (pagoCompleto && dineroRecibidoNum > 0 && dineroRecibidoNum < totalDeuda) {
      toast.error('El dinero recibido es menor a la deuda total');
      return;
    }

    setLoading(true);
    try {
      // Si el monto es mayor o igual a la deuda total, pagar todo
      const montoAPagar = Math.min(montoPagoNum, totalDeuda);
      let montoRestante = montoAPagar;

      // Distribuir el pago entre las ventas (en orden)
      for (const venta of ventas) {
        if (montoRestante <= 0) break;

        const pagoVenta = Math.min(montoRestante, venta.saldo_pendiente);
        const nuevoMontoPagado = (venta.monto_pagado || 0) + pagoVenta;
        const fiadoCompletado = nuevoMontoPagado >= venta.total;

        // Actualizar venta
        const { error: updateError } = await supabase
          .from('ventas')
          .update({
            monto_pagado: nuevoMontoPagado,
            fiado_completado: fiadoCompletado,
            es_fiado: !fiadoCompletado, // Cuando se completa el pago, ya no es fiado
            tipo_pago: fiadoCompletado ? 'contado' : 'fiado'
          })
          .eq('id', venta.id);

        if (updateError) throw updateError;

        // Registrar operación
        const { error: opError } = await supabase
          .from('operaciones')
          .insert({
            venta_id: venta.id,
            tipo_operacion: fiadoCompletado ? 'cancelacion_fiado' : 'abono_parcial',
            total_anulado: 0,
            motivo: fiadoCompletado
              ? 'Cancelación completa de fiado'
              : `Abono parcial: ${formatGuaranies(pagoVenta)}`,
            anulado_por: user?.id,
            cliente_id: venta.cliente_id,
            monto_operacion: pagoVenta,
            items_anulados: []
          });

        if (opError) throw opError;

        montoRestante -= pagoVenta;
      }

      // Calcular vuelto
      let vuelto = 0;
      if (pagoCompleto && dineroRecibidoNum > 0) {
        vuelto = dineroRecibidoNum - totalDeuda;
      } else if (!pagoCompleto && montoPagoNum > totalDeuda) {
        vuelto = montoPagoNum - totalDeuda;
      }

      if (montoAPagar >= totalDeuda) {
        toast.success(`Deuda total cancelada: ${formatGuaranies(totalDeuda)}`);
      } else {
        toast.success(`Abono registrado: ${formatGuaranies(montoAPagar)}`);
      }

      if (vuelto > 0) {
        toast.info(`Vuelto: ${formatGuaranies(vuelto)}`);
      }

      setShowPagoTotalModal(false);
      setDineroRecibido('');
      setMontoPago('');

      // Recargar datos
      if (clienteSeleccionado) {
        await loadVentasCliente(clienteSeleccionado.id);
      }
      await loadClientes();

      // Si se completó toda la deuda, cerrar modal
      if (montoAPagar >= totalDeuda) {
        setClienteSeleccionado(null);
      }
    } catch (error) {
      console.error('Error al procesar pago:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('is_active', true)
        .order('nombre');

      if (error) throw error;
      setProductos(data || []);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      toast.error('Error al cargar productos');
    }
  };

  const loadClientesDisponibles = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('is_active', true)
        .order('nombre');

      if (error) throw error;
      setClientesDisponibles(data || []);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      toast.error('Error al cargar clientes');
    }
  };

  // ============ FUNCIONES HELPER PARA INVENTARIO ============

  // Restaurar inventario de una venta
  const restaurarInventarioVenta = async (venta: VentaFiada) => {
    try {
      for (const item of venta.items) {
        const { data: producto, error: fetchError } = await supabase
          .from('productos')
          .select('stock_unidades, stock_paquetes, stock_kg')
          .eq('id', item.producto_id)
          .single();

        if (fetchError) throw fetchError;

        const updates: any = {};

        if (item.unidad_medida === 'unidad') {
          updates.stock_unidades = producto.stock_unidades + item.cantidad;
        } else if (item.unidad_medida === 'paquete') {
          updates.stock_paquetes = producto.stock_paquetes + item.cantidad;
        } else if (item.unidad_medida === 'kg') {
          updates.stock_kg = producto.stock_kg + item.cantidad;
        }

        const { error: updateError } = await supabase
          .from('productos')
          .update(updates)
          .eq('id', item.producto_id);

        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error al restaurar inventario:', error);
      throw new Error('Error al restaurar inventario');
    }
  };

  // Descontar inventario de productos
  const descontarInventarioProductos = async (items: Array<{
    producto: Producto;
    tipo: 'unidad' | 'paquete' | 'kg';
    cantidad: number;
  }>) => {
    try {
      for (const item of items) {
        const updates: any = {};

        if (item.tipo === 'unidad') {
          const { data: producto } = await supabase
            .from('productos')
            .select('stock_unidades')
            .eq('id', item.producto.id)
            .single();

          updates.stock_unidades = producto!.stock_unidades - item.cantidad;
        } else if (item.tipo === 'paquete') {
          const { data: producto } = await supabase
            .from('productos')
            .select('stock_paquetes')
            .eq('id', item.producto.id)
            .single();

          updates.stock_paquetes = producto!.stock_paquetes - item.cantidad;
        } else if (item.tipo === 'kg') {
          const { data: producto } = await supabase
            .from('productos')
            .select('stock_kg')
            .eq('id', item.producto.id)
            .single();

          updates.stock_kg = producto!.stock_kg - item.cantidad;
        }

        const { error } = await supabase
          .from('productos')
          .update(updates)
          .eq('id', item.producto.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error al descontar inventario:', error);
      throw new Error('Error al descontar inventario');
    }
  };

  // Validar stock suficiente
  const validarStockSuficiente = async (items: Array<{
    producto: Producto;
    tipo: 'unidad' | 'paquete' | 'kg';
    cantidad: number;
  }>) => {
    for (const item of items) {
      const { data: producto, error } = await supabase
        .from('productos')
        .select('stock_unidades, stock_paquetes, stock_kg, nombre')
        .eq('id', item.producto.id)
        .single();

      if (error) throw error;

      if (item.tipo === 'unidad' && producto.stock_unidades < item.cantidad) {
        throw new Error(`Stock insuficiente de ${producto.nombre}. Disponible: ${producto.stock_unidades} unidades`);
      } else if (item.tipo === 'paquete' && producto.stock_paquetes < item.cantidad) {
        throw new Error(`Stock insuficiente de ${producto.nombre}. Disponible: ${producto.stock_paquetes} paquetes`);
      } else if (item.tipo === 'kg' && producto.stock_kg < item.cantidad) {
        throw new Error(`Stock insuficiente de ${producto.nombre}. Disponible: ${producto.stock_kg.toFixed(3)} kg`);
      }
    }
  };

  // Navegación con teclado para productos en modal de deuda
  useEffect(() => {
    if (!showDeudaManualModal || !busquedaProducto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const filtered = productosFiltrados;

      if (filtered.length === 0) return;

      // Si hay solo 1 resultado y se presiona Enter, seleccionarlo directamente
      if (e.key === 'Enter' && filtered.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        handleSeleccionarProducto(filtered[0]);
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setFocusedProductoIndex((prev) => {
            const next = prev + 1;
            return next >= filtered.length ? 0 : next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setFocusedProductoIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? filtered.length - 1 : next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (focusedProductoIndex >= 0 && focusedProductoIndex < filtered.length) {
            const producto = filtered[focusedProductoIndex];
            handleSeleccionarProducto(producto);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          setFocusedProductoIndex(-1);
          setBusquedaProducto('');
          break;
      }
    };

    // Agregar listener solo al modal de deuda
    const modalElement = document.querySelector('[data-deuda-modal]');
    if (modalElement) {
      modalElement.addEventListener('keydown', handleKeyDown, true);
      return () => {
        modalElement.removeEventListener('keydown', handleKeyDown, true);
      };
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeudaManualModal, busquedaProducto, focusedProductoIndex, productos]);

  const handleSeleccionarProducto = (producto: Producto) => {
    // Determinar tipo a usar - PRIORIDAD A PRODUCTOS PESABLES
    if (producto.pesable || producto.tipo === 'peso') {
      // Producto pesable - abrir modal de peso
      setProductoPesable(producto);
      setShowPesoModal(true);
      setBusquedaProducto('');
      setFocusedProductoIndex(-1);
      return;
    } else if (producto.tipo === 'paquete' && producto.precio_venta_unidad) {
      // Tiene opción de vender por unidad o paquete - mostrar modal de selección
      setProductoTipoSeleccion(producto);
      setTipoSeleccionado('paquete'); // Reset a paquete por defecto
      setShowTipoModal(true);
      setBusquedaProducto('');
      setFocusedProductoIndex(-1);
      return;
    } else if (producto.tipo === 'paquete' && !producto.precio_venta_unidad) {
      addToCartDeuda(producto, 'paquete');
    } else if (producto.tipo === 'unidad') {
      addToCartDeuda(producto, 'unidad');
    } else {
      addToCartDeuda(producto, 'unidad');
    }
    setBusquedaProducto('');
    setFocusedProductoIndex(-1);
  };

  const addToCartDeuda = (producto: Producto, tipo: 'unidad' | 'paquete' | 'kg') => {
    // Validar stock si está activo descontar inventario
    if (descontarInventario) {
      let stockDisponible = 0;
      if (tipo === 'unidad') {
        stockDisponible = producto.stock_unidades;
      } else if (tipo === 'paquete') {
        stockDisponible = producto.stock_paquetes;
      } else if (tipo === 'kg') {
        stockDisponible = producto.stock_kg;
      }

      // Calcular cantidad ya en el carrito
      const existingItem = productosDeuda.find(item =>
        item.producto.id === producto.id && item.tipo === tipo
      );
      const cantidadEnCarrito = existingItem ? existingItem.cantidad : 0;

      if (cantidadEnCarrito + 1 > stockDisponible) {
        toast.error(`Stock insuficiente. Disponible: ${stockDisponible}`);
        return;
      }
    }

    const existingItem = productosDeuda.find(item =>
      item.producto.id === producto.id && item.tipo === tipo
    );

    if (existingItem) {
      setProductosDeuda(productosDeuda.map(item =>
        item.id === existingItem.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
      toast.success('Cantidad actualizada');
    } else {
      // Determinar precio según si es mayorista
      let precioUnitario = 0;
      if (tipo === 'unidad') {
        precioUnitario = esMayoristaDeuda && producto.precio_mayorista_unidad
          ? producto.precio_mayorista_unidad
          : (producto.precio_venta_unidad || 0);
      } else if (tipo === 'paquete') {
        precioUnitario = esMayoristaDeuda && producto.precio_mayorista_paquete
          ? producto.precio_mayorista_paquete
          : (producto.precio_venta_paquete || 0);
      } else {
        // kg - usar precio mayorista si está disponible
        precioUnitario = esMayoristaDeuda && producto.precio_mayorista_kg
          ? producto.precio_mayorista_kg
          : (producto.precio_venta_kg || 0);
      }

      const newItem = {
        id: Date.now().toString(),
        producto,
        tipo,
        cantidad: 1,
        precio_unitario: precioUnitario,
        es_mayorista: esMayoristaDeuda
      };
      setProductosDeuda([...productosDeuda, newItem]);
      toast.success('Producto agregado');
    }
  };

  const handleConfirmarPesoDeuda = (pesoEnKg: number) => {
    if (!productoPesable) return;

    // Validar stock si está activo descontar inventario
    if (descontarInventario) {
      const existingItem = productosDeuda.find(item =>
        item.producto.id === productoPesable.id && item.tipo === 'kg'
      );
      const cantidadEnCarrito = existingItem ? existingItem.cantidad : 0;

      if (cantidadEnCarrito + pesoEnKg > productoPesable.stock_kg) {
        toast.error(`Stock insuficiente. Disponible: ${formatearPeso(productoPesable.stock_kg)} kg`);
        return;
      }
    }

    const existingItem = productosDeuda.find(item =>
      item.producto.id === productoPesable.id && item.tipo === 'kg'
    );

    if (existingItem) {
      setProductosDeuda(productosDeuda.map(item =>
        item.id === existingItem.id
          ? { ...item, cantidad: item.cantidad + pesoEnKg }
          : item
      ));
      toast.success('Peso actualizado');
    } else {
      const precioUnitario = esMayoristaDeuda && productoPesable.precio_mayorista_kg
        ? productoPesable.precio_mayorista_kg
        : (productoPesable.precio_venta_kg || 0);
      const newItem = {
        id: Date.now().toString(),
        producto: productoPesable,
        tipo: 'kg' as const,
        cantidad: pesoEnKg,
        precio_unitario: precioUnitario,
        es_mayorista: esMayoristaDeuda
      };
      setProductosDeuda([...productosDeuda, newItem]);
      toast.success('Producto pesable agregado');
    }

    setShowPesoModal(false);
    setProductoPesable(null);
  };

  const handleRemoverProductoDeuda = (index: number) => {
    setProductosDeuda(productosDeuda.filter((_, i) => i !== index));
  };

  const handleActualizarCantidadDeuda = (index: number, cantidad: number, unidad?: 'kg' | 'g', permitirCero: boolean = false) => {
    // Si la cantidad es 0 y no se permite, simplemente no actualizar (permitir edición temporal)
    if (cantidad <= 0 && !permitirCero) {
      return;
    }

    const item = productosDeuda[index];
    let nuevaCantidad = cantidad;

    // Si es producto pesable y se especifica unidad, convertir a kg
    if (item.tipo === 'kg' && unidad && item.producto.pesable) {
      nuevaCantidad = unidad === 'g' ? cantidad / 1000 : cantidad;
    }

    const nuevosProductos = [...productosDeuda];
    nuevosProductos[index].cantidad = nuevaCantidad;
    setProductosDeuda(nuevosProductos);
  };

  // Estado para manejar las unidades temporales de edición de cantidad por producto
  const [unidadesCantidadEditando, setUnidadesCantidadEditando] = useState<Record<string, 'kg' | 'g'>>({});

  // ============ FUNCIONES DE ELIMINACIÓN ============

  // Eliminar venta individual
  const handleEliminarVenta = (venta: VentaFiada) => {
    setVentaEliminar(venta);
    setEliminandoTodoCliente(false);
    setShowConfirmEliminar(true);
  };

  // Eliminar todas las deudas de un cliente
  const handleEliminarTodasDeudas = (cliente: ClienteConDeuda) => {
    setClienteEliminar(cliente);
    setEliminandoTodoCliente(true);
    setShowConfirmEliminar(true);
  };

  // Confirmar eliminación
  const confirmarEliminarVenta = async () => {
    try {
      setLoading(true);

      if (eliminandoTodoCliente && clienteEliminar) {
        // Eliminar todas las ventas del cliente
        const { data: ventasCliente, error: ventasError } = await supabase
          .from('ventas')
          .select(`
            *,
            venta_items (
              *,
              productos (*)
            )
          `)
          .eq('cliente_id', clienteEliminar.id)
          .eq('es_fiado', true)
          .eq('fiado_completado', false);

        if (ventasError) throw ventasError;

        for (const venta of (ventasCliente || [])) {
          // Restaurar inventario si corresponde
          if (venta.desconto_stock) {
            await restaurarInventarioVenta(venta as VentaFiada);
          }

          // Eliminar items de venta
          const { error: deleteItemsError } = await supabase
            .from('venta_items')
            .delete()
            .eq('venta_id', venta.id);

          if (deleteItemsError) throw deleteItemsError;

          // Eliminar venta
          const { error: deleteVentaError } = await supabase
            .from('ventas')
            .delete()
            .eq('id', venta.id);

          if (deleteVentaError) throw deleteVentaError;
        }

        toast.success('Todas las deudas eliminadas correctamente');
        setClienteSeleccionado(null);
        await loadClientes();

      } else if (ventaEliminar) {
        // Eliminar venta individual
        // Restaurar inventario si corresponde
        if (ventaEliminar.desconto_stock) {
          await restaurarInventarioVenta(ventaEliminar);
        }

        // Eliminar items de venta
        const { error: deleteItemsError } = await supabase
          .from('venta_items')
          .delete()
          .eq('venta_id', ventaEliminar.id);

        if (deleteItemsError) throw deleteItemsError;

        // Eliminar venta
        const { error: deleteVentaError } = await supabase
          .from('ventas')
          .delete()
          .eq('id', ventaEliminar.id);

        if (deleteVentaError) throw deleteVentaError;

        toast.success('Venta eliminada correctamente');

        // Recargar ventas del cliente
        if (clienteSeleccionado) {
          await loadVentasCliente(clienteSeleccionado.id);

          // Si no quedan más ventas, cerrar modal
          const ventasRestantes = ventas.filter(v => v.id !== ventaEliminar.id);
          if (ventasRestantes.length === 0) {
            setClienteSeleccionado(null);
          }
        }

        await loadClientes();
      }

      setShowConfirmEliminar(false);
      setVentaEliminar(null);
      setClienteEliminar(null);

    } catch (error: any) {
      console.error('Error al eliminar:', error);
      toast.error(error.message || 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  };

  // ============ FUNCIÓN DE EDICIÓN ============

  const handleEditarVenta = (venta: VentaFiada) => {
    setVentaEditando(venta);
    setModoEdicion(true);
    setClienteDeuda(clienteSeleccionado as Cliente);

    // Cargar productos de la venta en el estado
    setProductosDeuda(venta.items.map(item => ({
      id: Date.now().toString() + Math.random(),
      producto: item.producto!,
      tipo: item.unidad_medida as 'unidad' | 'paquete' | 'kg',
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      es_mayorista: venta.es_mayorista
    })));

    setDescontarInventario(venta.desconto_stock);
    setEsMayoristaDeuda(venta.es_mayorista);

    // Cargar productos disponibles para poder agregar más
    loadProductos();

    setShowDeudaManualModal(true);
  };

  const handleGuardarDeuda = async () => {
    if (!clienteDeuda) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    if (productosDeuda.length === 0) {
      toast.error('Debe agregar al menos un producto');
      return;
    }

    const totalDeuda = productosDeuda.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);

    if (totalDeuda <= 0) {
      toast.error('El total de la deuda debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      if (modoEdicion && ventaEditando) {
        // ============ MODO EDICIÓN ============

        // Paso 1: Restaurar inventario original si corresponde
        if (ventaEditando.desconto_stock) {
          await restaurarInventarioVenta(ventaEditando);
        }

        // Paso 2: Validar stock si nuevo estado requiere descuento
        if (descontarInventario) {
          await validarStockSuficiente(productosDeuda.map(item => ({
            producto: item.producto,
            tipo: item.tipo,
            cantidad: item.cantidad
          })));
        }

        // Paso 3: Actualizar venta
        const { error: updateVentaError } = await supabase
          .from('ventas')
          .update({
            total: totalDeuda,
            desconto_stock: descontarInventario,
            es_mayorista: esMayoristaDeuda
          })
          .eq('id', ventaEditando.id);

        if (updateVentaError) throw updateVentaError;

        // Paso 4: Eliminar items antiguos
        const { error: deleteItemsError } = await supabase
          .from('venta_items')
          .delete()
          .eq('venta_id', ventaEditando.id);

        if (deleteItemsError) throw deleteItemsError;

        // Paso 5: Crear items nuevos
        const nuevosItems = productosDeuda.map(item => ({
          venta_id: ventaEditando.id,
          producto_id: item.producto.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.cantidad * item.precio_unitario,
          unidad_medida: item.tipo
        }));

        const { error: insertItemsError } = await supabase
          .from('venta_items')
          .insert(nuevosItems);

        if (insertItemsError) throw insertItemsError;

        // Paso 6: Descontar inventario nuevo si corresponde
        if (descontarInventario) {
          await descontarInventarioProductos(productosDeuda.map(item => ({
            producto: item.producto,
            tipo: item.tipo,
            cantidad: item.cantidad
          })));
        }

        toast.success('Venta actualizada correctamente');

        // Recargar ventas del cliente
        if (clienteSeleccionado) {
          await loadVentasCliente(clienteSeleccionado.id);
        }

      } else {
        // ============ MODO CREACIÓN ============

        // Obtener el siguiente número de venta
        const { data: ultimaVenta } = await supabase
          .from('ventas')
          .select('numero_venta')
          .order('numero_venta', { ascending: false })
          .limit(1)
          .single();

        const numeroVenta = (ultimaVenta?.numero_venta || 0) + 1;

        // Crear la venta fiada
        const { data: venta, error: ventaError } = await supabase
          .from('ventas')
          .insert({
            numero_venta: numeroVenta,
            total: totalDeuda,
            tipo_pago: 'fiado',
            es_fiado: true,
            fiado_completado: false,
            monto_pagado: 0,
            cliente_id: clienteDeuda.id,
            vendedor_id: user?.id,
            fecha: new Date().toISOString(),
            desconto_stock: descontarInventario,
            es_mayorista: esMayoristaDeuda
          })
          .select()
          .single();

        if (ventaError) throw ventaError;

        // Crear los items de venta
        const ventaItems = productosDeuda.map(item => ({
          venta_id: venta.id,
          producto_id: item.producto.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.cantidad * item.precio_unitario,
          unidad_medida: item.tipo
        }));

        const { error: itemsError } = await supabase
          .from('venta_items')
          .insert(ventaItems);

        if (itemsError) throw itemsError;

        // Si está activo descontar inventario, actualizar stock
        if (descontarInventario) {
          for (const item of productosDeuda) {
            let updateData: any = {};

            if (item.tipo === 'unidad') {
              updateData.stock_unidades = item.producto.stock_unidades - item.cantidad;
            } else if (item.tipo === 'paquete') {
              updateData.stock_paquetes = item.producto.stock_paquetes - item.cantidad;
            } else if (item.tipo === 'kg') {
              updateData.stock_kg = item.producto.stock_kg - item.cantidad;
            }

            const { error: updateError } = await supabase
              .from('productos')
              .update(updateData)
              .eq('id', item.producto.id);

            if (updateError) throw updateError;
          }
        }

        toast.success(`Deuda manual creada: ${formatGuaranies(totalDeuda)}`);
      }

      // Limpiar y cerrar modal
      setShowDeudaManualModal(false);
      setClienteDeuda(null);
      setProductosDeuda([]);
      setBusquedaProducto('');
      setBusquedaClienteModal('');
      setEsMayoristaDeuda(false);
      setDescontarInventario(true);
      setModoEdicion(false);
      setVentaEditando(null);

      // Recargar clientes
      await loadClientes();

    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const filteredClientes = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telefono.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular paginación
  const totalPages = Math.ceil(filteredClientes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedClientes = filteredClientes.slice(startIndex, endIndex);

  // Resetear página cuando cambia el término de búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Navegación con teclado en la lista de clientes
  useEffect(() => {
    if (paginatedClientes.length === 0 || clienteSeleccionado) {
      setFocusedClienteIndex(-1);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Si hay solo un resultado con búsqueda activa, Enter lo abre directamente
      if (e.key === 'Enter' && searchTerm && paginatedClientes.length === 1) {
        e.preventDefault();
        handleSelectCliente(paginatedClientes[0]);
        return;
      }

      // Navegación con flechas
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedClienteIndex(prev => {
            // Si no hay selección, empezar en 0
            if (prev === -1) return 0;
            const next = prev + 1;
            return next >= paginatedClientes.length ? 0 : next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedClienteIndex(prev => {
            // Si no hay selección, empezar en el último
            if (prev === -1) return paginatedClientes.length - 1;
            const next = prev - 1;
            return next < 0 ? paginatedClientes.length - 1 : next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedClienteIndex >= 0 && focusedClienteIndex < paginatedClientes.length) {
            handleSelectCliente(paginatedClientes[focusedClienteIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paginatedClientes, focusedClienteIndex, searchTerm, clienteSeleccionado]);

  // Recalcular precios cuando cambia el toggle de mayorista en el modal de deuda
  useEffect(() => {
    if (!showDeudaManualModal || productosDeuda.length === 0) return;

    const nuevosProductos = productosDeuda.map(item => {
      const producto = item.producto;
      let nuevoPrecio = item.precio_unitario;

      if (item.tipo === 'unidad') {
        nuevoPrecio = esMayoristaDeuda && producto.precio_mayorista_unidad
          ? producto.precio_mayorista_unidad
          : (producto.precio_venta_unidad || 0);
      } else if (item.tipo === 'paquete') {
        nuevoPrecio = esMayoristaDeuda && producto.precio_mayorista_paquete
          ? producto.precio_mayorista_paquete
          : (producto.precio_venta_paquete || 0);
      } else if (item.tipo === 'kg') {
        nuevoPrecio = esMayoristaDeuda && producto.precio_mayorista_kg
          ? producto.precio_mayorista_kg
          : (producto.precio_venta_kg || 0);
      }

      return {
        ...item,
        precio_unitario: nuevoPrecio
      };
    });

    setProductosDeuda(nuevosProductos);
  }, [esMayoristaDeuda]);

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  const clientesFiltradosModal = clientesDisponibles.filter(c =>
    c.nombre.toLowerCase().includes(busquedaClienteModal.toLowerCase()) ||
    c.telefono.toLowerCase().includes(busquedaClienteModal.toLowerCase())
  );

  const totalDeuda = clienteSeleccionado ? ventas.reduce((sum, v) => sum + v.saldo_pendiente, 0) : 0;

  // Vista principal: lista de clientes
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Fiados</h1>
        <p className="text-gray-600">Gestión de ventas a crédito</p>
      </div>

      {/* Búsqueda y Botón */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente por nombre o teléfono..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGestionClientesModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Clientes</span>
            </button>
            <button
              onClick={() => {
                setShowDeudaManualModal(true);
                loadProductos();
                loadClientesDisponibles();
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium">Nueva Deuda Manual</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Cargando clientes...</p>
        </div>
      ) : filteredClientes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes con deudas pendientes'}
          </p>
        </div>
      ) : (
        <>
          {/* Vista Desktop - Tabla */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Teléfono</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">N° Compras</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Deuda Total</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClientes.map((cliente, idx) => {
                  const isFocused = focusedClienteIndex === idx;
                  return (
                    <tr
                      key={cliente.id}
                      className={`border-b hover:bg-gray-50 ${
                        isFocused ? 'bg-gray-100 ring-2 ring-inset ring-indigo-500' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">{cliente.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{cliente.telefono}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{cliente.cantidad_compras}</td>
                      <td className="px-4 py-3 text-sm text-red-600 font-semibold">
                        {formatGuaranies(cliente.total_adeudado)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleSelectCliente(cliente)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEliminarTodasDeudas(cliente)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Eliminar todas las deudas"
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

          {/* Vista Mobile - Tarjetas */}
          <div className="lg:hidden space-y-3">
            {paginatedClientes.map((cliente, idx) => {
              const isFocused = focusedClienteIndex === idx;
              return (
                <div
                  key={cliente.id}
                  className={`bg-white border border-gray-200 rounded-lg p-4 space-y-3 ${
                    isFocused ? 'ring-2 ring-indigo-500' : ''
                  }`}
                >
                  {/* Header de la tarjeta */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-base">{cliente.nombre}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                        <Phone className="w-4 h-4" />
                        <span>{cliente.telefono}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSelectCliente(cliente)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEliminarTodasDeudas(cliente)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar todas las deudas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Detalles */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">N° Compras</p>
                      <p className="font-semibold text-gray-900">{cliente.cantidad_compras}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Deuda Total</p>
                      <p className="font-semibold text-red-600">{formatGuaranies(cliente.total_adeudado)}</p>
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
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredClientes.length)} de {filteredClientes.length} clientes
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

      {/* Modal de detalles del cliente */}
      {clienteSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{clienteSeleccionado.nombre}</h2>
                <div className="flex items-center gap-2 text-gray-600 mt-1">
                  <Phone className="w-4 h-4" />
                  <span>{clienteSeleccionado.telefono}</span>
                </div>
                {clienteSeleccionado.notas && (
                  <p className="text-sm text-gray-500 mt-2">{clienteSeleccionado.notas}</p>
                )}
              </div>
              <div className="text-right ml-4">
                <p className="text-sm text-gray-600">Deuda Total</p>
                <p className="text-3xl font-bold text-red-600">{formatGuaranies(totalDeuda)}</p>
                <p className="text-sm text-gray-600 mt-1">{ventas.length} compra(s) pendiente(s)</p>
              </div>
              <button
                onClick={() => setClienteSeleccionado(null)}
                className="ml-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <button
                onClick={() => {
                  setShowPagoTotalModal(true);
                  setMontoPago(totalDeuda.toString());
                  setPagoCompleto(true);
                  setDineroRecibido('');
                }}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium mb-6"
              >
                Pagar
              </button>

              {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-4">Cargando ventas...</p>
          </div>
        ) : ventas.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-600">No hay ventas fiadas pendientes</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Ventas que descontaron stock */}
            {ventas.filter(v => v.desconto_stock !== false).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Ventas con Stock</h3>
                <div className="space-y-4">
                  {ventas.filter(v => v.desconto_stock !== false).map((venta) => (
                    <div key={venta.id} className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">Venta #{venta.numero_venta}</h3>
                            {venta.es_mayorista && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">
                                MAYORISTA
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(venta.fecha).toLocaleString('es-PY')}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Saldo Pendiente</p>
                          <p className="text-2xl font-bold text-red-600">
                            {formatGuaranies(venta.saldo_pendiente)}
                          </p>
                          {venta.monto_pagado > 0 && (
                            <p className="text-sm text-gray-600 mt-1">
                              Pagado: {formatGuaranies(venta.monto_pagado)} de {formatGuaranies(venta.total)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-medium text-gray-700 mb-2">Productos:</h4>
                        <div className="space-y-2">
                          {venta.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                {item.producto?.nombre} x {item.cantidad} {item.unidad_medida}
                              </span>
                              <span className="font-medium">{formatGuaranies(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t pt-4 mt-4 flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditarVenta(venta)}
                          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="font-medium">Editar</span>
                        </button>
                        <button
                          onClick={() => handleEliminarVenta(venta)}
                          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="font-medium">Eliminar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ventas que NO descontaron stock */}
            {ventas.filter(v => v.desconto_stock === false).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <span>Ventas Fuera de Stock</span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-semibold">
                    FUERA DE INVENTARIO
                  </span>
                </h3>
                <div className="space-y-4">
                  {ventas.filter(v => v.desconto_stock === false).map((venta) => (
              <div key={venta.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">Venta #{venta.numero_venta}</h3>
                      {venta.es_mayorista && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">
                          MAYORISTA
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(venta.fecha).toLocaleString('es-PY')}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Saldo Pendiente</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatGuaranies(venta.saldo_pendiente)}
                    </p>
                    {venta.monto_pagado > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Pagado: {formatGuaranies(venta.monto_pagado)} de {formatGuaranies(venta.total)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-700 mb-2">Productos:</h4>
                  <div className="space-y-2">
                    {venta.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {item.producto?.nombre} x {item.cantidad} {item.unidad_medida}
                        </span>
                        <span className="font-medium">{formatGuaranies(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4 mt-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEditarVenta(venta)}
                    className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="font-medium">Editar</span>
                  </button>
                  <button
                    onClick={() => handleEliminarVenta(venta)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="font-medium">Eliminar</span>
                  </button>
                </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de pago individual */}
        {showPagoModal && ventaPagar && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-4">Pagar Venta #{ventaPagar.numero_venta}</h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Saldo Pendiente</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatGuaranies(ventaPagar.saldo_pendiente)}
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        checked={pagoCompleto}
                        onChange={() => {
                          setPagoCompleto(true);
                          setMontoPago(ventaPagar.saldo_pendiente.toString());
                        }}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="font-medium">Pagar monto completo</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!pagoCompleto}
                        onChange={() => {
                          setPagoCompleto(false);
                          setMontoPago('');
                        }}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="font-medium">Abonar parcialmente</span>
                    </label>
                  </div>

                  {!pagoCompleto && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monto a Abonar
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">₲</span>
                        <input
                          type="text"
                          value={formatGuaraniesInput(montoPago)}
                          onChange={(e) => {
                            const value = e.target.value;
                            const onlyNumbers = value.replace(/\D/g, '');
                            setMontoPago(onlyNumbers);
                          }}
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {pagoCompleto && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dinero Recibido (opcional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">₲</span>
                        <input
                          type="text"
                          value={formatGuaraniesInput(dineroRecibido)}
                          onChange={(e) => {
                            const value = e.target.value;
                            const onlyNumbers = value.replace(/\D/g, '');
                            setDineroRecibido(onlyNumbers);
                          }}
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {/* Vuelto cuando paga completo y dinero recibido es mayor */}
                  {pagoCompleto && dineroRecibido && parseFloat(dineroRecibido) > ventaPagar.saldo_pendiente && (
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium text-gray-700">Vuelto:</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatGuaranies(parseFloat(dineroRecibido) - ventaPagar.saldo_pendiente)}
                      </span>
                    </div>
                  )}

                  {/* Vuelto cuando abona parcialmente y monto es mayor al saldo */}
                  {!pagoCompleto && montoPago && parseFloat(montoPago) > ventaPagar.saldo_pendiente && (
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium text-gray-700">Vuelto:</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatGuaranies(parseFloat(montoPago) - ventaPagar.saldo_pendiente)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowPagoModal(false);
                      setVentaPagar(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmarPago}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Procesando...' : 'Confirmar Pago'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de pago total */}
        {showPagoTotalModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-4">Pagar Deuda</h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Resumen de compras:</p>
                    {ventas.map((venta) => (
                      <div key={venta.id} className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">Venta #{venta.numero_venta}</span>
                        <span className="font-medium">{formatGuaranies(venta.saldo_pendiente)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Saldo Pendiente Total:</span>
                      <span className="text-2xl font-bold text-red-600">
                        {formatGuaranies(totalDeuda)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        checked={pagoCompleto}
                        onChange={() => {
                          setPagoCompleto(true);
                          setMontoPago(totalDeuda.toString());
                        }}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="font-medium">Pagar monto completo</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!pagoCompleto}
                        onChange={() => {
                          setPagoCompleto(false);
                          setMontoPago('');
                        }}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="font-medium">Abonar parcialmente</span>
                    </label>
                  </div>

                  {!pagoCompleto && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monto a Abonar
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">₲</span>
                        <input
                          type="text"
                          value={formatGuaraniesInput(montoPago)}
                          onChange={(e) => {
                            const value = e.target.value;
                            const onlyNumbers = value.replace(/\D/g, '');
                            setMontoPago(onlyNumbers);
                          }}
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {pagoCompleto && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dinero Recibido (opcional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">₲</span>
                        <input
                          type="text"
                          value={formatGuaraniesInput(dineroRecibido)}
                          onChange={(e) => {
                            const value = e.target.value;
                            const onlyNumbers = value.replace(/\D/g, '');
                            setDineroRecibido(onlyNumbers);
                          }}
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {/* Vuelto cuando paga completo y dinero recibido es mayor */}
                  {pagoCompleto && dineroRecibido && parseFloat(dineroRecibido) > totalDeuda && (
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium text-gray-700">Vuelto:</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatGuaranies(parseFloat(dineroRecibido) - totalDeuda)}
                      </span>
                    </div>
                  )}

                  {/* Mensaje de error cuando abona parcialmente y monto es mayor al saldo */}
                  {!pagoCompleto && montoPago && parseFloat(montoPago) > totalDeuda && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700 font-medium">
                        ⚠️ El monto ingresado es mayor a la deuda pendiente
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Para pagar más del saldo pendiente, seleccione la opción "Pagar monto completo"
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowPagoTotalModal(false);
                      setDineroRecibido('');
                      setMontoPago('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePagarTodo}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                    disabled={loading || (!pagoCompleto && montoPago && parseFloat(montoPago) > totalDeuda)}
                  >
                    {loading ? 'Procesando...' : 'Confirmar Pago'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Modal de Agregar Cliente */}
      {showClienteModal && (
        <ClienteModal
          isOpen={showClienteModal}
          onClose={() => setShowClienteModal(false)}
          onSelectCliente={async (cliente) => {
            setShowClienteModal(false);

            // Si estamos en el modal de deuda manual, asignar el cliente y actualizar lista
            if (showDeudaManualModal) {
              setClienteDeuda(cliente);
              setBusquedaClienteModal('');
              await loadClientesDisponibles(); // Actualizar lista de clientes disponibles
              toast.success(`Cliente ${cliente.nombre} seleccionado`);
            } else {
              // Si no, es un nuevo cliente agregado desde la vista principal
              toast.success(`Cliente ${cliente.nombre} agregado correctamente`);
              await loadClientes();
            }
          }}
        />
      )}

      {/* Modal de Deuda Manual */}
      {showDeudaManualModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            data-deuda-modal
          >
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {modoEdicion && ventaEditando
                  ? `Editar Venta #${ventaEditando.numero_venta}`
                  : 'Crear Deuda Manual'}
              </h3>
              <button
                onClick={() => {
                  setShowDeudaManualModal(false);
                  setClienteDeuda(null);
                  setProductosDeuda([]);
                  setBusquedaProducto('');
                  setBusquedaClienteModal('');
                  setEsMayoristaDeuda(false);
                  setModoEdicion(false);
                  setVentaEditando(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Selección de Cliente - Solo visible al crear nueva deuda, no al editar */}
              {!modoEdicion && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente *
                  </label>
                  {!clienteDeuda ? (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      {/* Búsqueda y Botón para crear cliente */}
                      <div className="mb-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="text"
                              value={busquedaClienteModal}
                              onChange={(e) => {
                                setBusquedaClienteModal(e.target.value);
                                setFocusedClienteModalIndex(-1);
                              }}
                              placeholder="Buscar cliente existente..."
                              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                          <button
                            onClick={() => setShowClienteModal(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-indigo-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:inline">Nuevo Cliente</span>
                            <span className="sm:hidden">Nuevo</span>
                          </button>
                        </div>
                      </div>

                      {/* Lista de clientes disponibles */}
                      {busquedaClienteModal && clientesFiltradosModal.length > 0 && (
                        <div className="border rounded-lg bg-white max-h-60 overflow-y-auto">
                          {clientesFiltradosModal.slice(0, 10).map((cliente, idx) => {
                            const isFocused = focusedClienteModalIndex === idx;
                            return (
                              <button
                                key={cliente.id}
                                onClick={() => {
                                  setClienteDeuda(cliente);
                                  setBusquedaClienteModal('');
                                  setFocusedClienteModalIndex(-1);
                                  toast.success(`Cliente ${cliente.nombre} seleccionado`);
                                }}
                                className={`w-full px-4 py-3 hover:bg-indigo-50 flex items-center gap-3 border-b last:border-b-0 text-left transition ${
                                  isFocused ? 'bg-indigo-100 ring-2 ring-indigo-500' : ''
                                }`}
                              >
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                  <User className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900">{cliente.nombre}</p>
                                  <p className="text-sm text-gray-600">{cliente.telefono}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {busquedaClienteModal && clientesFiltradosModal.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No se encontraron clientes. Crea uno nuevo arriba.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{clienteDeuda.nombre}</p>
                          <p className="text-sm text-gray-600">{clienteDeuda.telefono}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setClienteDeuda(null)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Toggle Mayorista */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-700">Precios Mayorista</span>
                </div>
                <button
                  onClick={() => {
                    const nuevoEstado = !esMayoristaDeuda;

                    // Actualizar precios del carrito cuando cambia el estado de mayorista
                    if (productosDeuda.length > 0) {
                      const deudaActualizada = productosDeuda.map(item => {
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

                      setProductosDeuda(deudaActualizada);
                      toast.success(`Precios actualizados a ${nuevoEstado ? 'mayorista' : 'normal'}`);
                    }

                    setEsMayoristaDeuda(nuevoEstado);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    esMayoristaDeuda ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      esMayoristaDeuda ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Checkbox Descontar Inventario */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-700">Descontar de Inventario</span>
                    <span className="text-xs text-gray-500">
                      {descontarInventario ? 'Valida y descuenta stock' : 'Deuda anterior (no descuenta stock)'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setDescontarInventario(!descontarInventario)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    descontarInventario ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      descontarInventario ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Búsqueda de Productos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agregar Productos *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaProducto}
                    onChange={(e) => {
                      setBusquedaProducto(e.target.value);
                      setFocusedProductoIndex(-1);
                    }}
                    placeholder="Buscar producto por nombre o código..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Lista de productos encontrados */}
                {busquedaProducto && productosFiltrados.length > 0 && (
                  <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                    {productosFiltrados.slice(0, 10).map((producto, idx) => {
                      const isFocused = focusedProductoIndex === idx;
                      return (
                        <button
                          key={producto.id}
                          onClick={() => handleSeleccionarProducto(producto)}
                          className={`w-full px-4 py-3 hover:bg-indigo-50 flex items-center justify-between border-b last:border-b-0 text-left transition ${
                            isFocused ? 'bg-indigo-100 ring-2 ring-indigo-500' : ''
                          }`}
                        >
                          <div>
                            <p className="font-medium text-gray-900">{producto.nombre}</p>
                            <p className="text-sm text-gray-600">
                              {producto.codigo} • {formatGuaranies(producto.precio_venta_unidad || 0)}
                            </p>
                          </div>
                          <Plus className="w-5 h-5 text-indigo-600" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lista de Productos Agregados */}
              {productosDeuda.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Productos en la Deuda:</h4>
                  <div className="space-y-2">
                    {productosDeuda.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{item.producto.nombre}</p>
                              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-800">
                                {item.tipo === 'unidad' ? 'UNIDAD' : item.tipo === 'paquete' ? 'PAQUETE' : 'KG'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{item.producto.codigo}</p>
                          </div>
                          <button
                            onClick={() => handleRemoverProductoDeuda(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Cantidad
                            </label>
                            {item.tipo === 'kg' && item.producto.pesable ? (
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  step={unidadesCantidadEditando[item.id] === 'g' ? '1' : '0.001'}
                                  min={unidadesCantidadEditando[item.id] === 'g' ? '1' : '0.001'}
                                  value={
                                    item.cantidad === 0
                                      ? ''
                                      : unidadesCantidadEditando[item.id] === 'g'
                                      ? Math.round(item.cantidad * 1000)
                                      : formatearPeso(item.cantidad)
                                  }
                                  onChange={(e) => {
                                    const valor = e.target.value;
                                    // Permitir valor vacío temporalmente para poder borrar
                                    if (valor === '' || valor === '0') {
                                      const nuevosProductos = [...productosDeuda];
                                      nuevosProductos[index] = { ...nuevosProductos[index], cantidad: 0 };
                                      setProductosDeuda(nuevosProductos);
                                      return;
                                    }
                                    const newValue = parseFloat(valor);
                                    if (!isNaN(newValue) && newValue > 0) {
                                      const unidadActual = unidadesCantidadEditando[item.id] || 'kg';
                                      handleActualizarCantidadDeuda(index, newValue, unidadActual);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const valor = parseFloat(e.target.value);
                                    // Al perder el foco, si el valor es 0 o inválido, eliminar el producto
                                    if (!valor || valor <= 0) {
                                      handleRemoverProductoDeuda(index);
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 border rounded text-sm text-center"
                                  placeholder={
                                    unidadesCantidadEditando[item.id] === 'g'
                                      ? '0'
                                      : '0.000'
                                  }
                                />
                                <select
                                  value={unidadesCantidadEditando[item.id] || 'kg'}
                                  onChange={(e) => {
                                    const nuevaUnidad = e.target.value as 'kg' | 'g';
                                    setUnidadesCantidadEditando(prev => ({ ...prev, [item.id]: nuevaUnidad }));
                                    // Convertir el valor actual a la nueva unidad y actualizar
                                    const valorActual = item.cantidad;
                                    if (nuevaUnidad === 'g') {
                                      // Convertir kg a gramos para el input
                                      const nuevoValor = valorActual * 1000;
                                      handleActualizarCantidadDeuda(index, nuevoValor, 'g');
                                    } else {
                                      // Ya está en kg, solo actualizar el estado
                                      handleActualizarCantidadDeuda(index, valorActual, 'kg');
                                    }
                                  }}
                                  className="w-12 px-1 py-1 border rounded text-xs text-center bg-white"
                                >
                                  <option value="kg">Kg</option>
                                  <option value="g">g</option>
                                </select>
                              </div>
                            ) : (
                              <input
                                type="number"
                                min="0.01"
                                step={item.tipo === 'kg' ? '0.01' : '1'}
                                value={item.cantidad === 0 ? '' : item.cantidad}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  // Permitir valor vacío temporalmente para poder borrar
                                  if (valor === '' || valor === '0') {
                                    const nuevosProductos = [...productosDeuda];
                                    nuevosProductos[index] = { ...nuevosProductos[index], cantidad: 0 };
                                    setProductosDeuda(nuevosProductos);
                                    return;
                                  }
                                  const numValor = parseFloat(valor);
                                  if (!isNaN(numValor) && numValor > 0) {
                                    handleActualizarCantidadDeuda(index, numValor);
                                  }
                                }}
                                onBlur={(e) => {
                                  const valor = parseFloat(e.target.value);
                                  // Al perder el foco, si el valor es 0 o inválido, eliminar el producto
                                  if (!valor || valor <= 0) {
                                    handleRemoverProductoDeuda(index);
                                  }
                                }}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {item.tipo === 'kg' && item.producto.pesable
                                ? (esMayoristaDeuda ? 'Precio por kg Mayorista' : 'Precio por kg')
                                : (esMayoristaDeuda ? 'Precio Mayorista' : 'Precio Unitario')}
                            </label>
                            <div className={`px-3 py-2 border rounded-lg text-sm font-semibold ${
                              esMayoristaDeuda && (
                                (item.tipo === 'unidad' && !item.producto.precio_mayorista_unidad) ||
                                (item.tipo === 'paquete' && !item.producto.precio_mayorista_paquete) ||
                                (item.tipo === 'kg' && !item.producto.precio_mayorista_kg)
                              )
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {formatGuaranies(item.precio_unitario)}
                              {esMayoristaDeuda && (
                                (item.tipo === 'unidad' && !item.producto.precio_mayorista_unidad) ||
                                (item.tipo === 'paquete' && !item.producto.precio_mayorista_paquete) ||
                                (item.tipo === 'kg' && !item.producto.precio_mayorista_kg)
                              ) && (
                                <span className="block text-xs mt-1">⚠️ Sin precio</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Subtotal
                            </label>
                            <div className="px-3 py-2 bg-white border rounded-lg text-sm font-semibold">
                              {formatGuaranies(item.cantidad * item.precio_unitario)}
                            </div>
                          </div>
                        </div>
                        {item.tipo === 'kg' && item.producto.pesable && (
                          <div className="mt-2 text-xs text-gray-500">
                            Total: {formatearPeso(item.cantidad)} kg ({Math.round(item.cantidad * 1000)} g)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total */}
              {productosDeuda.length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                    <span className="text-base md:text-lg font-semibold text-gray-700">Total de la Deuda:</span>
                    <span className="text-xl md:text-2xl font-bold text-red-600">
                      {formatGuaranies(productosDeuda.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Advertencia de productos sin precio mayorista */}
              {esMayoristaDeuda && productosDeuda.some(item =>
                (item.tipo === 'unidad' && !item.producto.precio_mayorista_unidad) ||
                (item.tipo === 'paquete' && !item.producto.precio_mayorista_paquete) ||
                (item.tipo === 'kg' && !item.producto.precio_mayorista_kg)
              ) && (
                <div className="border-t pt-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Hay productos sin precio mayorista configurado. Desactiva el modo mayorista o configura los precios faltantes para poder crear la deuda.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="sticky bottom-0 bg-white border-t p-4 md:p-6 flex flex-col gap-3">
              <div className="flex flex-col md:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowDeudaManualModal(false);
                    setClienteDeuda(null);
                    setProductosDeuda([]);
                    setBusquedaProducto('');
                    setBusquedaClienteModal('');
                    setEsMayoristaDeuda(false);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarDeuda}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
                  disabled={
                    loading ||
                    !clienteDeuda ||
                    productosDeuda.length === 0 ||
                    (esMayoristaDeuda && productosDeuda.some(item =>
                      (item.tipo === 'unidad' && !item.producto.precio_mayorista_unidad) ||
                      (item.tipo === 'paquete' && !item.producto.precio_mayorista_paquete) ||
                      (item.tipo === 'kg' && !item.producto.precio_mayorista_kg)
                    ))
                  }
                  title={
                    esMayoristaDeuda && productosDeuda.some(item =>
                      (item.tipo === 'unidad' && !item.producto.precio_mayorista_unidad) ||
                      (item.tipo === 'paquete' && !item.producto.precio_mayorista_paquete) ||
                      (item.tipo === 'kg' && !item.producto.precio_mayorista_kg)
                    )
                      ? 'Hay productos sin precio mayorista configurado'
                      : ''
                  }
                >
                  {loading
                    ? (modoEdicion ? 'Guardando...' : 'Creando...')
                    : (modoEdicion ? 'Guardar Cambios' : 'Crear Deuda')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Peso para Productos Pesables */}
      {showPesoModal && productoPesable && (
        <PesoModal
          isOpen={showPesoModal}
          onClose={() => {
            setShowPesoModal(false);
            setProductoPesable(null);
          }}
          onConfirm={handleConfirmarPesoDeuda}
          producto={productoPesable}
        />
      )}

      {/* Modal de Selección de Tipo (Unidad/Paquete) */}
      {showTipoModal && productoTipoSeleccion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">Seleccionar Tipo de Venta</h3>
              <p className="text-sm text-gray-600 mb-4">
                ¿Cómo deseas agregar <span className="font-semibold">{productoTipoSeleccion.nombre}</span>?
              </p>
              <p className="text-xs text-gray-500 mb-4">
                💡 Usa las flechas ↑↓ para navegar y Enter para seleccionar
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    addToCartDeuda(productoTipoSeleccion, 'paquete');
                    setShowTipoModal(false);
                    setProductoTipoSeleccion(null);
                    setTipoSeleccionado('paquete');
                  }}
                  className={`w-full p-4 border-2 rounded-lg transition text-left ${
                    tipoSeleccionado === 'paquete'
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500'
                      : 'border-purple-200 hover:border-purple-500 hover:bg-purple-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">Por Paquete</p>
                      <p className="text-sm text-gray-600">
                        Precio: {formatGuaranies(
                          esMayoristaDeuda && productoTipoSeleccion.precio_mayorista_paquete
                            ? productoTipoSeleccion.precio_mayorista_paquete
                            : (productoTipoSeleccion.precio_venta_paquete || 0)
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {productoTipoSeleccion.unidades_por_paquete} unidades por paquete
                      </p>
                    </div>
                    <div className={tipoSeleccionado === 'paquete' ? 'text-purple-600' : 'text-purple-400'}>
                      <Package className="w-6 h-6" />
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    addToCartDeuda(productoTipoSeleccion, 'unidad');
                    setShowTipoModal(false);
                    setProductoTipoSeleccion(null);
                    setTipoSeleccionado('paquete');
                  }}
                  className={`w-full p-4 border-2 rounded-lg transition text-left ${
                    tipoSeleccionado === 'unidad'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500'
                      : 'border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">Por Unidad</p>
                      <p className="text-sm text-gray-600">
                        Precio: {formatGuaranies(
                          esMayoristaDeuda && productoTipoSeleccion.precio_mayorista_unidad
                            ? productoTipoSeleccion.precio_mayorista_unidad
                            : (productoTipoSeleccion.precio_venta_unidad || 0)
                        )}
                      </p>
                    </div>
                    <div className={tipoSeleccionado === 'unidad' ? 'text-indigo-600' : 'text-indigo-400'}>
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => {
                  setShowTipoModal(false);
                  setProductoTipoSeleccion(null);
                  setTipoSeleccionado('paquete');
                }}
                className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar venta */}
      {showConfirmEliminar && ventaEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-900">
                {eliminandoTodoCliente ? 'Eliminar Todas las Deudas' : 'Eliminar Venta'}
              </h3>
              <p className="text-gray-600 mb-6">
                {eliminandoTodoCliente
                  ? `¿Está seguro de eliminar todas las deudas del cliente ${clienteEliminar?.nombre}?`
                  : `¿Está seguro de eliminar la Venta #${ventaEliminar.numero_venta}?`}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {ventaEliminar.desconto_stock
                  ? 'Esta venta descontó del inventario, por lo que se restaurarán las cantidades de los productos.'
                  : 'Esta venta NO descontó del inventario, por lo que no se restaurará nada.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmEliminar(false);
                    setVentaEliminar(null);
                    setClienteEliminar(null);
                    setEliminandoTodoCliente(false);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarEliminarVenta}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Clientes */}
      <GestionClientesModal
        isOpen={showGestionClientesModal}
        onClose={() => setShowGestionClientesModal(false)}
        onClienteUpdated={() => {
          // Recargar lista de clientes si el cliente seleccionado fue modificado/eliminado
          loadClientes();
          loadClientesDisponibles();
        }}
      />
    </div>
  );
};
