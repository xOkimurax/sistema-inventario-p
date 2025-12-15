import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatGuaranies } from '../../utils/currency';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  Filter,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface VentaItemDetalle {
  producto: string;
  tipo: string;
  talle: string | null;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  subtotal: number;
}

interface VentaReporte {
  id: string;
  numero_venta: number;
  fecha: string;
  total: number;
  usuario: string;
  items_count: number;
  items: VentaItemDetalle[];
  es_fiado: boolean;
  desconto_stock: boolean;
  fiado_completado: boolean;
  es_mayorista: boolean;
}

interface CompraItemDetalle {
  producto: string;
  tipo: string;
  talle: string | null;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  subtotal: number;
}

interface CompraReporte {
  id: string;
  fecha: string;
  total: number;
  proveedor: string;
  items_count: number;
  items: CompraItemDetalle[];
}

interface InventarioReporte {
  producto: string;
  tipo: string;
  talle: string | null;
  categoria: string;
  proveedor: string;
  stock_unidades: number;
  stock_paquetes: number;
  stock_kg: number;
  stock_minimo: number;
  precio_compra: number;
  precio_venta: number;
  precio_venta_unidad?: number; // Para productos de tipo paquete
  valor_total_compra: number; // Valor total de compra (stock × precio_compra)
  valor_total: number; // Valor total de venta (stock × precio_venta)
  is_active: boolean; // Estado activo/inactivo del producto
}

interface ProductoMasVendido {
  producto: string;
  tipo_producto: string;
  talle: string | null;
  unidad_medida: string;
  cantidad_vendida: number;
  total_ventas: number;
}

interface ProveedorPrincipal {
  proveedor: string;
  total_compras: number;
  cantidad_compras: number;
}

interface AnulacionReporte {
  id: string;
  fecha: string;
  venta_id: string;
  numero_venta: number;
  tipo_anulacion: 'completa' | 'parcial';
  items_anulados: any[];
  total_anulado: number;
  motivo: string;
  anulado_por: string;
}

interface AnulacionDetalladaReporte {
  anulacion_id: string;
  fecha: string;
  numero_venta: number;
  tipo_anulacion: 'completa' | 'parcial';
  producto: string;
  categoria: string;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  subtotal_anulado: number;
  motivo: string;
  anulado_por: string;
}

type TipoReporte = 'ventas' | 'compras' | 'inventario' | 'productos_vendidos' | 'proveedores' | 'anulaciones';
type VistaReporte = 'agrupada' | 'detallada';

export const Reportes: React.FC = () => {
  const { user } = useAuth();
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('ventas');
  const [vistaReporte, setVistaReporte] = useState<VistaReporte>('agrupada');
  const [modoFiltroFecha, setModoFiltroFecha] = useState<'ninguno' | 'fecha' | 'rango'>('ninguno');
  const [fechaDesde, setFechaDesde] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fechaEspecifica, setFechaEspecifica] = useState<string>(new Date().toISOString().split('T')[0]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [filtroVentasFiadas, setFiltroVentasFiadas] = useState<'todas' | 'solo_fiadas' | 'solo_normales'>('todas');
  const [filtroEstadoVenta, setFiltroEstadoVenta] = useState<'todos' | 'solo_fiado' | 'solo_fuera_stock' | 'ambos'>('todos');
  const [filtroEstadoInventario, setFiltroEstadoInventario] = useState<'todos' | 'activos' | 'inactivos'>('todos');

  const [ventasData, setVentasData] = useState<VentaReporte[]>([]);
  const [comprasData, setComprasData] = useState<CompraReporte[]>([]);
  const [inventarioData, setInventarioData] = useState<InventarioReporte[]>([]);
  const [productosVendidosData, setProductosVendidosData] = useState<ProductoMasVendido[]>([]);
  const [proveedoresData, setProveedoresData] = useState<ProveedorPrincipal[]>([]);
  const [anulacionesData, setAnulacionesData] = useState<AnulacionReporte[]>([]);
  const [anulacionesDetalladasData, setAnulacionesDetalladasData] = useState<AnulacionDetalladaReporte[]>([]);

  // Estados para almacenar TODOS los datos (sin paginar) - para totales y exportaciones
  const [ventasDataCompleto, setVentasDataCompleto] = useState<VentaReporte[]>([]);
  const [comprasDataCompleto, setComprasDataCompleto] = useState<CompraReporte[]>([]);
  const [inventarioDataCompleto, setInventarioDataCompleto] = useState<InventarioReporte[]>([]);
  const [anulacionesDataCompleto, setAnulacionesDataCompleto] = useState<AnulacionReporte[]>([]);
  const [anulacionesDetalladasDataCompleto, setAnulacionesDetalladasDataCompleto] = useState<AnulacionDetalladaReporte[]>([]);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const registrosPorPagina = 15;

  useEffect(() => {
    cargarCategorias();
  }, []);

  useEffect(() => {
    setExpandedRows(new Set());  // Reset expanded rows when data changes
    setPaginaActual(1);  // Reset page when filters change
    cargarDatos();
  }, [tipoReporte, modoFiltroFecha, fechaDesde, fechaHasta, fechaEspecifica, categoriaSeleccionada, filtroVentasFiadas, filtroEstadoVenta, filtroEstadoInventario]);

  useEffect(() => {
    cargarDatos();
  }, [paginaActual]);

  // Función helper para aplicar filtro de fecha según el modo
  const aplicarFiltroFecha = (query: any, campoFecha: string = 'fecha') => {
    if (modoFiltroFecha === 'ninguno') {
      return query; // Sin filtro, devolver todos los registros
    } else if (modoFiltroFecha === 'fecha') {
      // Filtrar por una fecha específica
      return query
        .gte(campoFecha, `${fechaEspecifica}T00:00:00`)
        .lt(campoFecha, `${getFechaHastaAjustada(fechaEspecifica)}T00:00:00`);
    } else {
      // Filtrar por rango de fechas
      return query
        .gte(campoFecha, `${fechaDesde}T00:00:00`)
        .lt(campoFecha, `${getFechaHastaAjustada(fechaHasta)}T00:00:00`);
    }
  };

  const cargarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('id, nombre')
        .eq('is_active', true)
        .order('nombre');

      if (error) throw error;
      setCategorias(data || []);
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Funciones para comparar solo la parte de fecha, ignorando la hora y timezone
  const getFechaDesdeAjustada = (fecha: string): string => {
    return fecha; // Retorna en formato YYYY-MM-DD para comparación
  };

  const getFechaHastaAjustada = (fecha: string): string => {
    // Sumar un día para hacer la comparación con < en lugar de <=
    const [year, month, day] = fecha.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0]; // Retorna YYYY-MM-DD del día siguiente
  };

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);

    try {
      switch (tipoReporte) {
        case 'ventas':
          await cargarVentas();
          break;
        case 'compras':
          await cargarCompras();
          break;
        case 'inventario':
          await cargarInventario();
          break;
        case 'productos_vendidos':
          await cargarProductosMasVendidos();
          break;
        case 'proveedores':
          await cargarProveedoresPrincipales();
          break;
        case 'anulaciones':
          await cargarAnulaciones();
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar los datos');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const cargarVentas = async () => {
    // Primero obtener TODAS las ventas (sin paginación) para totales y exportaciones
    let queryCompleto = supabase
      .from('ventas')
      .select(`
        *,
        venta_items (
          cantidad,
          unidad_medida,
          precio_unitario,
          subtotal,
          productos (
            nombre,
            tipo,
            es_ropa_calzado,
            talle,
            categoria_id
          )
        )
      `);

    queryCompleto = aplicarFiltroFecha(queryCompleto, 'fecha');

    // Aplicar filtro de ventas fiadas
    if (filtroVentasFiadas === 'solo_fiadas') {
      queryCompleto = queryCompleto.eq('es_fiado', true).eq('fiado_completado', false);
    } else if (filtroVentasFiadas === 'solo_normales') {
      queryCompleto = queryCompleto.or('es_fiado.eq.false,fiado_completado.eq.true');
    }

    queryCompleto = queryCompleto.order('fecha', { ascending: false });

    const { data: ventasCompleto, error: ventasCompletoError } = await queryCompleto;

    if (ventasCompletoError) throw ventasCompletoError;

    // Calcular offset para datos paginados
    const offset = (paginaActual - 1) * registrosPorPagina;

    let queryPaginado = supabase
      .from('ventas')
      .select(`
        *,
        venta_items (
          cantidad,
          unidad_medida,
          precio_unitario,
          subtotal,
          productos (
            nombre,
            tipo,
            es_ropa_calzado,
            talle,
            categoria_id
          )
        )
      `);

    queryPaginado = aplicarFiltroFecha(queryPaginado, 'fecha');

    // Aplicar filtro de ventas fiadas
    if (filtroVentasFiadas === 'solo_fiadas') {
      queryPaginado = queryPaginado.eq('es_fiado', true).eq('fiado_completado', false);
    } else if (filtroVentasFiadas === 'solo_normales') {
      queryPaginado = queryPaginado.or('es_fiado.eq.false,fiado_completado.eq.true');
    }

    queryPaginado = queryPaginado
      .order('fecha', { ascending: false })
      .range(offset, offset + registrosPorPagina - 1);

    const { data: ventasPaginado, error: ventasPaginadoError } = await queryPaginado;

    if (ventasPaginadoError) throw ventasPaginadoError;

    // Función para transformar venta
    const transformarVenta = async (venta: any) => {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', venta.vendedor_id)
        .maybeSingle();

      let items: VentaItemDetalle[] = (venta.venta_items || []).map((item: any) => ({
        producto: item.productos?.nombre || 'Producto desconocido',
        tipo: item.productos?.tipo || 'unidad',
        talle: item.productos?.es_ropa_calzado && item.productos?.talle ? item.productos.talle : null,
        cantidad: item.cantidad,
        unidad_medida: item.unidad_medida,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
        categoria_id: item.productos?.categoria_id
      }));

      // Filtrar items por categoría si está seleccionada
      if (categoriaSeleccionada) {
        items = items.filter((item: any) => item.categoria_id === categoriaSeleccionada);
      }

      // Solo incluir la venta si tiene items después del filtro
      if (categoriaSeleccionada && items.length === 0) {
        return null;
      }

      return {
        id: venta.id,
        numero_venta: venta.numero_venta,
        fecha: new Date(venta.fecha).toLocaleDateString('es-PY'),
        total: categoriaSeleccionada ? items.reduce((sum, item) => sum + item.subtotal, 0) : venta.total,
        usuario: profile?.full_name || 'Usuario',
        items_count: items.length,
        items: items.map(({ categoria_id, ...rest }: any) => rest),
        es_fiado: venta.es_fiado || false,
        desconto_stock: venta.desconto_stock !== false,
        fiado_completado: venta.fiado_completado || false,
        es_mayorista: venta.es_mayorista || false
      };
    };

    // Transformar datos completos (para totales y exportaciones)
    const ventasConDetallesCompleto = await Promise.all(
      (ventasCompleto || []).map(transformarVenta)
    );
    const ventasCompletoFiltrado = ventasConDetallesCompleto.filter(v => v !== null) as VentaReporte[];
    setVentasDataCompleto(ventasCompletoFiltrado);
    setTotalRegistros(ventasCompletoFiltrado.length);

    // Transformar datos paginados (para visualización)
    const ventasConDetallesPaginado = await Promise.all(
      (ventasPaginado || []).map(transformarVenta)
    );
    setVentasData(ventasConDetallesPaginado.filter(v => v !== null) as VentaReporte[]);
  };

  const cargarCompras = async () => {
    // Primero obtener TODAS las compras (sin paginación) para totales y exportaciones
    let queryCompleto = supabase
      .from('compras')
      .select(`
        *,
        compra_items (
          cantidad,
          unidad_medida,
          precio_unitario,
          subtotal,
          productos (
            nombre,
            tipo,
            es_ropa_calzado,
            talle,
            categoria_id
          )
        )
      `);

    queryCompleto = aplicarFiltroFecha(queryCompleto, 'fecha');
    queryCompleto = queryCompleto.order('fecha', { ascending: false });

    const { data: comprasCompleto, error: comprasCompletoError } = await queryCompleto;

    if (comprasCompletoError) throw comprasCompletoError;

    // Calcular offset para datos paginados
    const offset = (paginaActual - 1) * registrosPorPagina;

    let queryPaginado = supabase
      .from('compras')
      .select(`
        *,
        compra_items (
          cantidad,
          unidad_medida,
          precio_unitario,
          subtotal,
          productos (
            nombre,
            tipo,
            es_ropa_calzado,
            talle,
            categoria_id
          )
        )
      `);

    queryPaginado = aplicarFiltroFecha(queryPaginado, 'fecha');

    const { data: comprasPaginado, error: comprasPaginadoError } = await queryPaginado
      .order('fecha', { ascending: false })
      .range(offset, offset + registrosPorPagina - 1);

    if (comprasPaginadoError) throw comprasPaginadoError;

    // Función para transformar compra
    const transformarCompra = async (compra: any) => {
      const { data: proveedor } = await supabase
        .from('proveedores')
        .select('nombre')
        .eq('id', compra.proveedor_id)
        .single();

      let items: CompraItemDetalle[] = (compra.compra_items || []).map((item: any) => ({
        producto: item.productos?.nombre || 'Producto desconocido',
        tipo: item.productos?.tipo || 'unidad',
        talle: item.productos?.es_ropa_calzado && item.productos?.talle ? item.productos.talle : null,
        cantidad: item.cantidad,
        unidad_medida: item.unidad_medida,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
        categoria_id: item.productos?.categoria_id
      }));

      // Filtrar items por categoría si está seleccionada
      if (categoriaSeleccionada) {
        items = items.filter((item: any) => item.categoria_id === categoriaSeleccionada);
      }

      // Solo incluir la compra si tiene items después del filtro
      if (categoriaSeleccionada && items.length === 0) {
        return null;
      }

      return {
        id: compra.id,
        fecha: new Date(compra.fecha).toLocaleDateString('es-PY'),
        total: categoriaSeleccionada ? items.reduce((sum, item) => sum + item.subtotal, 0) : compra.total,
        proveedor: proveedor?.nombre || 'N/A',
        items_count: items.length,
        items: items.map(({ categoria_id, ...rest }: any) => rest)
      };
    };

    // Transformar datos completos (para totales y exportaciones)
    const comprasConDetallesCompleto = await Promise.all(
      (comprasCompleto || []).map(transformarCompra)
    );
    const comprasCompletoFiltrado = comprasConDetallesCompleto.filter(c => c !== null) as CompraReporte[];
    setComprasDataCompleto(comprasCompletoFiltrado);
    setTotalRegistros(comprasCompletoFiltrado.length);

    // Transformar datos paginados (para visualización)
    const comprasConDetallesPaginado = await Promise.all(
      (comprasPaginado || []).map(transformarCompra)
    );
    setComprasData(comprasConDetallesPaginado.filter(c => c !== null) as CompraReporte[]);
  };

  const cargarInventario = async () => {
    // Primero obtener TODOS los productos (sin paginación) para totales y exportaciones
    let queryCompleto = supabase
      .from('productos')
      .select('*')
      .order('nombre');

    if (categoriaSeleccionada) {
      queryCompleto = queryCompleto.eq('categoria_id', categoriaSeleccionada);
    }

    // Aplicar filtro de estado
    if (filtroEstadoInventario === 'activos') {
      queryCompleto = queryCompleto.eq('is_active', true);
    } else if (filtroEstadoInventario === 'inactivos') {
      queryCompleto = queryCompleto.eq('is_active', false);
    }

    const { data: productosCompleto, error: productosCompletoError, count } = await queryCompleto;

    if (productosCompletoError) throw productosCompletoError;

    setTotalRegistros(productosCompleto?.length || 0);

    // Calcular offset para datos paginados
    const offset = (paginaActual - 1) * registrosPorPagina;

    // Obtener datos paginados
    let queryPaginado = supabase
      .from('productos')
      .select('*')
      .order('nombre')
      .range(offset, offset + registrosPorPagina - 1);

    if (categoriaSeleccionada) {
      queryPaginado = queryPaginado.eq('categoria_id', categoriaSeleccionada);
    }

    // Aplicar filtro de estado
    if (filtroEstadoInventario === 'activos') {
      queryPaginado = queryPaginado.eq('is_active', true);
    } else if (filtroEstadoInventario === 'inactivos') {
      queryPaginado = queryPaginado.eq('is_active', false);
    }

    const { data: productosPaginado, error: productosPaginadoError } = await queryPaginado;

    if (productosPaginadoError) throw productosPaginadoError;

    // Obtener IDs únicos de proveedores y categorías de TODOS los productos
    const proveedorIdsCompleto = [...new Set((productosCompleto || []).map(p => p.proveedor_principal_id).filter(Boolean))];
    const categoriaIdsCompleto = [...new Set((productosCompleto || []).map(p => p.categoria_id).filter(Boolean))];

    // Cargar proveedores y categorías
    const [proveedoresRes, categoriasRes] = await Promise.all([
      proveedorIdsCompleto.length > 0
        ? supabase.from('proveedores').select('id, nombre').in('id', proveedorIdsCompleto)
        : Promise.resolve({ data: [] }),
      categoriaIdsCompleto.length > 0
        ? supabase.from('categorias').select('id, nombre').in('id', categoriaIdsCompleto)
        : Promise.resolve({ data: [] })
    ]);

    // Crear mapas para búsqueda rápida
    const proveedoresMap = new Map((proveedoresRes.data || []).map(p => [p.id, p.nombre]));
    const categoriasMap = new Map((categoriasRes.data || []).map(c => [c.id, c.nombre]));

    // Función para transformar producto a inventario
    const transformarProducto = (producto: any): InventarioReporte => {
      // Calcular precio de venta según el tipo
      let precioVenta = 0;
      let precioVentaUnidad = undefined;

      if (producto.tipo === 'unidad') {
        precioVenta = producto.precio_venta_unidad || 0;
      } else if (producto.tipo === 'paquete') {
        precioVenta = producto.precio_venta_paquete || 0;
        precioVentaUnidad = producto.precio_venta_unidad || 0;
      } else if (producto.tipo === 'peso') {
        precioVenta = producto.precio_venta_kg || 0;
      }

      // Calcular valor total de venta según el tipo de producto
      let valorTotal = 0;
      if (producto.tipo === 'unidad') {
        valorTotal = producto.stock_unidades * precioVenta;
      } else if (producto.tipo === 'paquete') {
        valorTotal = producto.stock_paquetes * precioVenta;
      } else if (producto.tipo === 'peso') {
        valorTotal = producto.stock_kg * precioVenta;
      }

      // Calcular valor total de compra según el tipo de producto
      let valorTotalCompra = 0;
      const precioCompra = producto.precio_compra || 0;
      if (producto.tipo === 'unidad') {
        valorTotalCompra = producto.stock_unidades * precioCompra;
      } else if (producto.tipo === 'paquete') {
        valorTotalCompra = producto.stock_paquetes * precioCompra;
      } else if (producto.tipo === 'peso') {
        valorTotalCompra = producto.stock_kg * precioCompra;
      }

      return {
        producto: producto.nombre,
        tipo: producto.tipo,
        talle: producto.es_ropa_calzado && producto.talle ? producto.talle : null,
        categoria: categoriasMap.get(producto.categoria_id) || 'Sin categoría',
        proveedor: proveedoresMap.get(producto.proveedor_principal_id) || 'Sin proveedor',
        stock_unidades: producto.stock_unidades || 0,
        stock_paquetes: producto.stock_paquetes || 0,
        stock_kg: producto.stock_kg || 0,
        stock_minimo: producto.stock_minimo || 0,
        precio_compra: producto.precio_compra || 0,
        precio_venta: precioVenta,
        precio_venta_unidad: precioVentaUnidad,
        valor_total_compra: valorTotalCompra,
        valor_total: valorTotal,
        is_active: producto.is_active !== false // Por defecto true si no está definido
      };
    };

    // Transformar datos completos (para totales y exportaciones)
    const inventarioCompleto = (productosCompleto || []).map(transformarProducto);
    setInventarioDataCompleto(inventarioCompleto);

    // Transformar datos paginados (para visualización)
    const inventarioPaginado = (productosPaginado || []).map(transformarProducto);
    setInventarioData(inventarioPaginado);
  };

  const cargarProductosMasVendidos = async () => {
    const { data: items, error: itemsError } = await supabase
      .from('venta_items')
      .select('producto_id, cantidad, unidad_medida, precio_unitario, ventas!inner(fecha)')
      .gte('ventas.fecha', `${fechaDesde}T00:00:00`)
      .lt('ventas.fecha', `${getFechaHastaAjustada(fechaHasta)}T00:00:00`);

    if (itemsError) throw itemsError;

    // Obtener todos los IDs de productos únicos
    const productoIds = [...new Set((items || []).map(item => item.producto_id))];

    // Obtener datos de productos en una sola consulta
    let productosQuery = supabase
      .from('productos')
      .select('id, nombre, tipo, es_ropa_calzado, talle, categoria_id')
      .in('id', productoIds);

    // Aplicar filtro de categoría si está seleccionado
    if (categoriaSeleccionada) {
      productosQuery = productosQuery.eq('categoria_id', categoriaSeleccionada);
    }

    const { data: productos, error: productosError } = await productosQuery;

    if (productosError) throw productosError;

    // Crear mapa de productos por ID
    const productosMap = new Map<string, { nombre: string; tipo: string; talle: string | null }>();
    (productos || []).forEach(producto => {
      productosMap.set(producto.id, {
        nombre: producto.nombre,
        tipo: producto.tipo,
        talle: producto.es_ropa_calzado && producto.talle ? producto.talle : null
      });
    });

    // Agrupar por producto + unidad de medida para detallar el tipo de venta
    const productosVendidosMap = new Map<string, {
      cantidad: number;
      total: number;
      nombre: string;
      tipo_producto: string;
      talle: string | null;
      unidad_medida: string;
    }>();

    for (const item of items || []) {
      const productoId = item.producto_id;
      const productoInfo = productosMap.get(productoId);

      // Si el filtro de categoría está activo y este producto no está en el mapa, skip
      if (categoriaSeleccionada && !productoInfo) {
        continue;
      }

      const nombreProducto = productoInfo?.nombre || 'Producto desconocido';
      const tipoProducto = productoInfo?.tipo || 'unidad';
      const talle = productoInfo?.talle || null;
      const unidadMedida = item.unidad_medida || 'unidad';

      // Usar clave única: producto + unidad de medida
      const key = `${productoId}-${unidadMedida}`;

      const existing = productosVendidosMap.get(key) || {
        cantidad: 0,
        total: 0,
        nombre: nombreProducto,
        tipo_producto: tipoProducto,
        talle: talle,
        unidad_medida: unidadMedida
      };

      productosVendidosMap.set(key, {
        cantidad: existing.cantidad + item.cantidad,
        total: existing.total + (item.cantidad * item.precio_unitario),
        nombre: nombreProducto,
        tipo_producto: tipoProducto,
        talle: talle,
        unidad_medida: unidadMedida
      });
    }

    const productosVendidos = Array.from(productosVendidosMap.values())
      .map(p => ({
        producto: p.nombre,
        tipo_producto: p.tipo_producto,
        talle: p.talle,
        unidad_medida: p.unidad_medida,
        cantidad_vendida: p.cantidad,
        total_ventas: p.total
      }))
      .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
      .slice(0, 20);

    setProductosVendidosData(productosVendidos);
  };

  const cargarProveedoresPrincipales = async () => {
    let query = supabase
      .from('compras')
      .select('proveedor_id, total');

    query = aplicarFiltroFecha(query, 'fecha');

    const { data: compras, error: comprasError } = await query;

    if (comprasError) throw comprasError;

    // Obtener todos los IDs de proveedores únicos
    const proveedorIds = [...new Set((compras || []).map(compra => compra.proveedor_id))];
    
    // Obtener nombres de proveedores en una sola consulta
    const { data: proveedoresData, error: proveedoresError } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .in('id', proveedorIds);

    if (proveedoresError) throw proveedoresError;

    // Crear mapa de proveedores por ID
    const proveedoresMap = new Map<string, { nombre: string }>();
    (proveedoresData || []).forEach(proveedor => {
      proveedoresMap.set(proveedor.id, { nombre: proveedor.nombre });
    });

    const proveedoresStatsMap = new Map<string, { total: number; cantidad: number; nombre: string }>();

    for (const compra of compras || []) {
      const proveedorId = compra.proveedor_id;
      const proveedorInfo = proveedoresMap.get(proveedorId);
      const nombreProveedor = proveedorInfo?.nombre || 'Proveedor desconocido';
      
      const existing = proveedoresStatsMap.get(proveedorId) || {
        total: 0,
        cantidad: 0,
        nombre: nombreProveedor
      };
      
      proveedoresStatsMap.set(proveedorId, {
        total: existing.total + compra.total,
        cantidad: existing.cantidad + 1,
        nombre: nombreProveedor
      });
    }

    const proveedoresResult = Array.from(proveedoresStatsMap.values())
      .map(p => ({
        proveedor: p.nombre,
        cantidad_compras: p.cantidad,
        total_compras: p.total
      }))
      .sort((a, b) => b.total_compras - a.total_compras);

    setProveedoresData(proveedoresResult);
  };

  const cargarAnulaciones = async () => {
    // Primero contar el total de registros usando comparación de fechas sin hora
    let countQuery = supabase
      .from('operaciones')
      .select('*', { count: 'exact', head: true })
      .in('tipo_operacion', ['anulacion_completa', 'anulacion_parcial']);

    countQuery = aplicarFiltroFecha(countQuery, 'created_at');

    const { count } = await countQuery;

    setTotalRegistros(count || 0);

    // Calcular offset
    const offset = (paginaActual - 1) * registrosPorPagina;

    let query = supabase
      .from('operaciones')
      .select(`
        *,
        ventas!inner(numero_venta)
      `)
      .in('tipo_operacion', ['anulacion_completa', 'anulacion_parcial']);

    query = aplicarFiltroFecha(query, 'created_at');

    const { data: anulaciones, error: anulacionesError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + registrosPorPagina - 1);

    if (anulacionesError) throw anulacionesError;

    // Obtener IDs de usuarios únicos
    const usuariosIds = new Set<string>();
    (anulaciones || []).forEach((anulacion: any) => {
      if (anulacion.anulado_por) usuariosIds.add(anulacion.anulado_por);
    });

    // Obtener información de usuarios
    const { data: usuariosData } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', Array.from(usuariosIds));

    const usuariosMap = new Map();
    (usuariosData || []).forEach((user: any) => {
      usuariosMap.set(user.id, user.full_name);
    });

    // Obtener todos los producto_ids únicos de items_anulados
    const productosIds = new Set<string>();
    (anulaciones || []).forEach((anulacion: any) => {
      const items = anulacion.items_anulados || [];
      items.forEach((item: any) => {
        if (item.producto_id) productosIds.add(item.producto_id);
      });
    });

    // Obtener información de productos con categorías
    const { data: productosData } = await supabase
      .from('productos')
      .select('id, nombre, categoria_id, categorias(nombre)')
      .in('id', Array.from(productosIds));

    const productosMap = new Map();
    (productosData || []).forEach((prod: any) => {
      productosMap.set(prod.id, {
        nombre: prod.nombre,
        categoria: prod.categorias?.nombre || 'Sin categoría',
        categoria_id: prod.categoria_id
      });
    });

    // Vista agrupada (por anulación)
    const anulacionesFormateadas: AnulacionReporte[] = (anulaciones || []).map((anulacion: any) => ({
      id: anulacion.id,
      fecha: anulacion.created_at,
      venta_id: anulacion.venta_id,
      numero_venta: anulacion.ventas?.numero_venta || 0,
      tipo_anulacion: anulacion.tipo_operacion === 'anulacion_completa' ? 'completa' : 'parcial',
      items_anulados: anulacion.items_anulados || [],
      total_anulado: anulacion.total_anulado || 0,
      motivo: anulacion.motivo || 'Sin motivo especificado',
      anulado_por: usuariosMap.get(anulacion.anulado_por) || 'Usuario desconocido'
    }));

    // Vista detallada (por producto)
    const anulacionesDetalladas: AnulacionDetalladaReporte[] = [];
    (anulaciones || []).forEach((anulacion: any) => {
      const items = anulacion.items_anulados || [];
      items.forEach((item: any) => {
        const prodInfo = productosMap.get(item.producto_id);

        // Filtrar por categoría si está seleccionada
        if (categoriaSeleccionada && prodInfo?.categoria_id !== categoriaSeleccionada) {
          return;
        }

        anulacionesDetalladas.push({
          anulacion_id: anulacion.id,
          fecha: anulacion.created_at,
          numero_venta: anulacion.ventas?.numero_venta || 0,
          tipo_anulacion: anulacion.tipo_operacion === 'anulacion_completa' ? 'completa' : 'parcial',
          producto: prodInfo?.nombre || item.producto_nombre || 'Desconocido',
          categoria: prodInfo?.categoria || 'Sin categoría',
          cantidad: item.cantidad || 0,
          unidad_medida: item.unidad_medida || '',
          precio_unitario: item.precio_unitario || 0,
          subtotal_anulado: item.subtotal || 0,
          motivo: anulacion.motivo || 'Sin motivo especificado',
          anulado_por: usuariosMap.get(anulacion.anulado_por) || 'Usuario desconocido'
        });
      });
    });

    setAnulacionesData(anulacionesFormateadas);
    setAnulacionesDetalladasData(anulacionesDetalladas);
  };

  // Función para formatear precios en PDF sin el "2" extra
  const formatPrecioPDF = (value: number): string => {
    const rounded = Math.round(value);
    const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Gs ' + formatted;
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    const titulo = obtenerTituloReporte();

    // Encabezado
    doc.setFontSize(18);
    doc.text(titulo, 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${fechaDesde} a ${fechaHasta}`, 14, 28);
    doc.text(`Generado: ${new Date().toLocaleString('es-PY')}`, 14, 34);

    let tableData: any[] = [];
    let headers: string[] = [];

    switch (tipoReporte) {
      case 'ventas':
        if (vistaReporte === 'detallada') {
          // Vista detallada - todos los items
          headers = ['N° Venta', 'Fecha', 'Usuario', 'Producto', 'Tipo', 'Talle', 'Estado', 'Stock', 'Cantidad', 'Precio Unit.', 'Subtotal'];
          ventasDataCompleto.forEach(venta => {
            venta.items.forEach(item => {
              tableData.push([
                `#${venta.numero_venta}`,
                venta.fecha,
                venta.usuario,
                item.producto,
                item.tipo === 'unidad' ? 'Unidad' : item.tipo === 'paquete' ? 'Paquete' : 'Peso',
                item.talle || '-',
                venta.es_fiado ? 'FIADO' : '-',
                venta.desconto_stock ? 'Normal' : 'FUERA DE STOCK',
                `${item.cantidad} ${item.unidad_medida}`,
                formatPrecioPDF(item.precio_unitario),
                formatPrecioPDF(item.subtotal)
              ]);
            });
          });
        } else {
          // Vista agrupada
          headers = ['N° Venta', 'Fecha', 'Usuario', 'Estado', 'Stock', 'Cantidad', 'Total'];
          ventasDataCompleto.forEach(venta => {
            // Fila principal
            tableData.push([
              `#${venta.numero_venta}`,
              venta.fecha,
              venta.usuario,
              venta.es_fiado ? 'FIADO' : '-',
              venta.desconto_stock ? 'Normal' : 'FUERA DE STOCK',
              venta.items_count.toString() + ' items',
              formatPrecioPDF(venta.total)
            ]);
            // Detalles de items
            venta.items.forEach(item => {
              tableData.push([
                '',
                '',
                '',
                `  - ${item.producto}`,
                '',
                `${item.cantidad} ${item.unidad_medida}`,
                formatPrecioPDF(item.subtotal)
              ]);
            });
          });
        }
        break;
      case 'compras':
        if (vistaReporte === 'detallada') {
          // Vista detallada - todos los items
          headers = ['Fecha', 'Proveedor', 'Producto', 'Tipo', 'Talle', 'Cantidad', 'Precio Unit.', 'Subtotal'];
          comprasDataCompleto.forEach(compra => {
            compra.items.forEach(item => {
              tableData.push([
                compra.fecha,
                compra.proveedor,
                item.producto,
                item.tipo === 'unidad' ? 'Unidad' : item.tipo === 'paquete' ? 'Paquete' : 'Peso',
                item.talle || '-',
                `${item.cantidad} ${item.unidad_medida}`,
                formatPrecioPDF(item.precio_unitario),
                formatPrecioPDF(item.subtotal)
              ]);
            });
          });
        } else {
          // Vista agrupada
          headers = ['Fecha', 'Proveedor', 'Cantidad', 'Total'];
          comprasDataCompleto.forEach(compra => {
            // Fila principal
            tableData.push([
              compra.fecha,
              compra.proveedor,
              compra.items_count.toString() + ' items',
              formatPrecioPDF(compra.total)
            ]);
            // Detalles de items
            compra.items.forEach(item => {
              tableData.push([
                '',
                `  - ${item.producto}`,
                `${item.cantidad} ${item.unidad_medida}`,
                formatPrecioPDF(item.subtotal)
              ]);
            });
          });
        }
        break;
      case 'inventario':
        headers = ['Producto', 'Tipo', 'Talle', 'Categoría', 'Proveedor', 'Stock Unid.', 'Stock Paq.', 'Stock Kg', 'P. Compra', 'P. Venta', 'V.T. Compra', 'V.T. Venta'];
        tableData = inventarioDataCompleto.map(i => {
          const tipoTexto = i.tipo === 'unidad' ? 'Unidad' : i.tipo === 'paquete' ? 'Paquete' : 'Peso';
          const stockUnid = i.stock_unidades > 0 ? Math.round(i.stock_unidades).toString() : '-';
          const stockPaq = i.stock_paquetes > 0 ? i.stock_paquetes.toString() : '-';
          const stockKg = i.stock_kg > 0 ? i.stock_kg.toFixed(2) : '-';

          let precioCompra = formatPrecioPDF(i.precio_compra);
          if (i.tipo === 'unidad') precioCompra += ' /Un';
          else if (i.tipo === 'paquete') precioCompra += ' /Pq';
          else if (i.tipo === 'peso') precioCompra += ' /kg';

          let precioVenta = formatPrecioPDF(i.precio_venta);
          if (i.tipo === 'unidad') precioVenta += ' /Un';
          else if (i.tipo === 'paquete') precioVenta += ' /Pq';
          else if (i.tipo === 'peso') precioVenta += ' /kg';

          // Añadir indicador de inactivo al nombre del producto
          const productoNombre = i.is_active ? i.producto : `${i.producto} [INACTIVO]`;

          return [
            productoNombre,
            tipoTexto,
            i.talle || '-',
            i.categoria,
            i.proveedor,
            stockUnid,
            stockPaq,
            stockKg,
            precioCompra,
            precioVenta,
            formatPrecioPDF(i.valor_total_compra),
            formatPrecioPDF(i.valor_total)
          ];
        });
        break;
      case 'productos_vendidos':
        headers = ['Producto', 'Tipo', 'Talle', 'Tipo de Venta', 'Cantidad Vendida', 'Total Ventas'];
        tableData = productosVendidosData.map(p => {
          const tipoTexto = p.tipo_producto === 'unidad' ? 'Unidad' :
                           p.tipo_producto === 'paquete' ? 'Paquete' : 'Peso';
          return [
            p.producto,
            tipoTexto,
            p.talle || '-',
            p.unidad_medida,
            `${p.cantidad_vendida} ${p.unidad_medida}`,
            formatPrecioPDF(p.total_ventas)
          ];
        });
        break;
      case 'proveedores':
        headers = ['Proveedor', 'N° Compras', 'Total Compras'];
        tableData = proveedoresData.map(p => [
          p.proveedor,
          p.cantidad_compras.toString(),
          formatPrecioPDF(p.total_compras)
        ]);
        break;
      case 'anulaciones':
        if (vistaReporte === 'detallada') {
          headers = ['Fecha', 'N° Venta', 'Tipo', 'Producto', 'Categoría', 'Cant.', 'P.Unit', 'Subtotal', 'Motivo', 'Usuario'];
          tableData = anulacionesDetalladasData.map(a => [
            new Date(a.fecha).toLocaleString('es-PY'),
            `#${a.numero_venta}`,
            a.tipo_anulacion === 'completa' ? 'C' : 'P',
            a.producto,
            a.categoria,
            `${a.cantidad} ${a.unidad_medida}`,
            formatPrecioPDF(a.precio_unitario),
            formatPrecioPDF(a.subtotal_anulado),
            a.motivo.substring(0, 20) + (a.motivo.length > 20 ? '...' : ''),
            a.anulado_por
          ]);
        } else {
          headers = ['Fecha', 'N° Venta', 'Tipo', 'Productos', 'Total Anulado', 'Motivo', 'Anulado Por'];
          tableData = anulacionesData.map(a => [
            new Date(a.fecha).toLocaleString('es-PY'),
            `#${a.numero_venta}`,
            a.tipo_anulacion === 'completa' ? 'Completa' : 'Parcial',
            a.items_anulados.map((item: any) => `${item.producto_nombre || 'Producto'} (${item.cantidad} ${item.unidad_medida})`).join(', '),
            formatPrecioPDF(a.total_anulado),
            a.motivo.substring(0, 30) + (a.motivo.length > 30 ? '...' : ''),
            a.anulado_por
          ]);
        }
        break;
    }

    // Configuración de autoTable con estilos condicionales para productos inactivos
    const autoTableConfig: any = {
      head: [headers],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    };

    // Si es reporte de inventario, aplicar estilos a productos inactivos
    if (tipoReporte === 'inventario') {
      autoTableConfig.didParseCell = function(data: any) {
        // Verificar si la celda pertenece al cuerpo de la tabla (no al header)
        if (data.section === 'body') {
          // Verificar si el producto es inactivo (tiene [INACTIVO] en el nombre)
          const productoCelda = data.row.raw[0]; // Primera columna es el producto
          if (typeof productoCelda === 'string' && productoCelda.includes('[INACTIVO]')) {
            // Aplicar fondo rojo claro a toda la fila
            data.cell.styles.fillColor = [254, 226, 226]; // bg-red-100 en RGB
            data.cell.styles.textColor = [107, 114, 128]; // text-gray-500 en RGB
          }
        }
      };
    }

    autoTable(doc, autoTableConfig);

    // Totales
    if (tipoReporte === 'ventas') {
      const totalVentas = ventasDataCompleto.reduce((sum, v) => sum + v.total, 0);
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(12);
      doc.text(`Total General: ${formatPrecioPDF(totalVentas)}`, 14, finalY + 10);
    } else if (tipoReporte === 'compras') {
      const totalCompras = comprasDataCompleto.reduce((sum, c) => sum + c.total, 0);
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(12);
      doc.text(`Total General: ${formatPrecioPDF(totalCompras)}`, 14, finalY + 10);
    } else if (tipoReporte === 'inventario') {
      const valorTotalCompra = inventarioDataCompleto.reduce((sum, i) => sum + i.valor_total_compra, 0);
      const valorTotalVenta = inventarioDataCompleto.reduce((sum, i) => sum + i.valor_total, 0);
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(12);
      doc.text(`Valor Total Precio Compra: ${formatPrecioPDF(valorTotalCompra)}`, 14, finalY + 10);
      doc.text(`Valor Total Precio Venta: ${formatPrecioPDF(valorTotalVenta)}`, 14, finalY + 18);
    } else if (tipoReporte === 'anulaciones') {
      const totalAnulaciones = vistaReporte === 'detallada'
        ? anulacionesDetalladasData.reduce((sum, a) => sum + a.subtotal_anulado, 0)
        : anulacionesData.reduce((sum, a) => sum + a.total_anulado, 0);
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(12);
      doc.text(`Total Anulado: ${formatPrecioPDF(totalAnulaciones)}`, 14, finalY + 10);
    }

    doc.save(`reporte-${tipoReporte}-${new Date().getTime()}.pdf`);
  };

  const exportarExcel = () => {
    let data: any[] = [];
    let filename = '';

    switch (tipoReporte) {
      case 'ventas':
        if (vistaReporte === 'detallada') {
          // Vista detallada
          ventasDataCompleto.forEach(venta => {
            venta.items.forEach(item => {
              data.push({
                'N° Venta': venta.numero_venta,
                'Fecha': venta.fecha,
                'Usuario': venta.usuario,
                'Producto': item.producto,
                'Tipo': item.tipo === 'unidad' ? 'Unidad' : item.tipo === 'paquete' ? 'Paquete' : 'Peso',
                'Talle': item.talle || '-',
                'Estado': venta.es_fiado && !venta.fiado_completado ? 'FIADO' : 'Normal',
                'Stock': venta.desconto_stock ? 'Normal' : 'Fuera de Stock',
                'Cantidad': item.cantidad,
                'Unidad Medida': item.unidad_medida,
                'Precio Unitario': item.precio_unitario,
                'Subtotal': item.subtotal
              });
            });
          });
        } else {
          // Vista agrupada con detalles
          ventasDataCompleto.forEach(venta => {
            data.push({
              'N° Venta': venta.numero_venta,
              'Fecha': venta.fecha,
              'Usuario': venta.usuario,
              'Estado': venta.es_fiado && !venta.fiado_completado ? 'FIADO' : 'Normal',
              'Stock': venta.desconto_stock ? 'Normal' : 'Fuera de Stock',
              'Cantidad Items': venta.items_count,
              'Total': venta.total,
              'Tipo Fila': 'VENTA'
            });
            venta.items.forEach(item => {
              data.push({
                'N° Venta': '',
                'Fecha': '',
                'Usuario': `  → ${item.producto}`,
                'Estado': '',
                'Cantidad Items': `${item.cantidad} ${item.unidad_medida}`,
                'Total': item.subtotal,
                'Tipo Fila': 'DETALLE'
              });
            });
          });
        }
        filename = 'reporte-ventas';
        break;
      case 'compras':
        if (vistaReporte === 'detallada') {
          // Vista detallada
          comprasDataCompleto.forEach(compra => {
            compra.items.forEach(item => {
              data.push({
                'Fecha': compra.fecha,
                'Proveedor': compra.proveedor,
                'Producto': item.producto,
                'Tipo': item.tipo === 'unidad' ? 'Unidad' : item.tipo === 'paquete' ? 'Paquete' : 'Peso',
                'Talle': item.talle || '-',
                'Cantidad': item.cantidad,
                'Unidad Medida': item.unidad_medida,
                'Precio Unitario': item.precio_unitario,
                'Subtotal': item.subtotal
              });
            });
          });
        } else {
          // Vista agrupada con detalles
          comprasDataCompleto.forEach(compra => {
            data.push({
              'Fecha': compra.fecha,
              'Proveedor': compra.proveedor,
              'Cantidad Items': compra.items_count,
              'Total': compra.total,
              'Tipo Fila': 'COMPRA'
            });
            compra.items.forEach(item => {
              data.push({
                'Fecha': '',
                'Proveedor': `  → ${item.producto}`,
                'Cantidad Items': `${item.cantidad} ${item.unidad_medida}`,
                'Total': item.subtotal,
                'Tipo Fila': 'DETALLE'
              });
            });
          });
        }
        filename = 'reporte-compras';
        break;
      case 'inventario':
        data = inventarioDataCompleto.map(i => {
          const tipoTexto = i.tipo === 'unidad' ? 'Unidad' : i.tipo === 'paquete' ? 'Paquete' : 'Peso';
          const stockUnid = i.stock_unidades > 0 ? Math.round(i.stock_unidades) : '-';
          const stockPaq = i.stock_paquetes > 0 ? i.stock_paquetes : '-';
          const stockKg = i.stock_kg > 0 ? parseFloat(i.stock_kg.toFixed(2)) : '-';

          let sufijo = '';
          if (i.tipo === 'unidad') sufijo = ' /Un';
          else if (i.tipo === 'paquete') sufijo = ' /Pq';
          else if (i.tipo === 'peso') sufijo = ' /kg';

          return {
            'Producto': i.producto,
            'Tipo': tipoTexto,
            'Talle': i.talle || '-',
            'Categoría': i.categoria,
            'Proveedor': i.proveedor,
            'Stock Unidades': stockUnid,
            'Stock Paquetes': stockPaq,
            'Stock Kg': stockKg,
            'Precio Compra': i.precio_compra.toString() + sufijo,
            'Precio Venta': i.precio_venta.toString() + sufijo,
            'Valor Total Compra': i.valor_total_compra,
            'Valor Total Venta': i.valor_total
          };
        });
        filename = 'reporte-inventario';
        break;
      case 'productos_vendidos':
        data = productosVendidosData.map(p => {
          const tipoTexto = p.tipo_producto === 'unidad' ? 'Unidad' :
                           p.tipo_producto === 'paquete' ? 'Paquete' : 'Peso';
          return {
            'Producto': p.producto,
            'Tipo': tipoTexto,
            'Talle': p.talle || '-',
            'Tipo de Venta': p.unidad_medida,
            'Cantidad Vendida': `${p.cantidad_vendida} ${p.unidad_medida}`,
            'Total Ventas': p.total_ventas
          };
        });
        filename = 'reporte-productos-vendidos';
        break;
      case 'proveedores':
        data = proveedoresData.map(p => ({
          'Proveedor': p.proveedor,
          'Número de Compras': p.cantidad_compras,
          'Total Compras': p.total_compras
        }));
        filename = 'reporte-proveedores';
        break;
      case 'anulaciones':
        if (vistaReporte === 'detallada') {
          data = anulacionesDetalladasData.map(a => ({
            'Fecha': new Date(a.fecha).toLocaleString('es-PY'),
            'N° Venta': a.numero_venta,
            'Tipo': a.tipo_anulacion === 'completa' ? 'Completa' : 'Parcial',
            'Producto': a.producto,
            'Categoría': a.categoria,
            'Cantidad': a.cantidad,
            'Unidad': a.unidad_medida,
            'Precio Unitario': a.precio_unitario,
            'Subtotal Anulado': a.subtotal_anulado,
            'Motivo': a.motivo,
            'Anulado Por': a.anulado_por
          }));
          filename = 'reporte-anulaciones-detallada';
        } else {
          data = anulacionesData.map(a => ({
            'Fecha': new Date(a.fecha).toLocaleString('es-PY'),
            'N° Venta': a.numero_venta,
            'Tipo': a.tipo_anulacion === 'completa' ? 'Completa' : 'Parcial',
            'Productos': a.items_anulados.map((item: any) => `${item.producto_nombre || 'Producto'} (${item.cantidad} ${item.unidad_medida})`).join(', '),
            'Total Anulado': a.total_anulado,
            'Motivo': a.motivo,
            'Anulado Por': a.anulado_por
          }));
          filename = 'reporte-anulaciones-agrupada';
        }
        break;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
    XLSX.writeFile(workbook, `${filename}-${new Date().getTime()}.xlsx`);
  };

  const obtenerTituloReporte = () => {
    const titulos: Record<TipoReporte, string> = {
      ventas: 'Reporte de Ventas',
      compras: 'Reporte de Compras',
      inventario: 'Reporte de Inventario',
      productos_vendidos: 'Productos Más Vendidos',
      proveedores: 'Proveedores Principales',
      anulaciones: 'Reporte de Anulaciones'
    };
    return titulos[tipoReporte];
  };

  const renderPaginacion = () => {
    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

    if (totalPaginas <= 1) return null;

    const paginas: number[] = [];
    const maxPaginasVisibles = 5;

    let inicio = Math.max(1, paginaActual - Math.floor(maxPaginasVisibles / 2));
    let fin = Math.min(totalPaginas, inicio + maxPaginasVisibles - 1);

    if (fin - inicio + 1 < maxPaginasVisibles) {
      inicio = Math.max(1, fin - maxPaginasVisibles + 1);
    }

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
        <p className="text-sm text-gray-600">
          Mostrando {((paginaActual - 1) * registrosPorPagina) + 1} - {Math.min(paginaActual * registrosPorPagina, totalRegistros)} de {totalRegistros} registros
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
              {inicio > 2 && <span className="text-gray-400">...</span>}
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
              {fin < totalPaginas - 1 && <span className="text-gray-400">...</span>}
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

  const renderTabla = () => {
    // Mostrar selector de vista solo para ventas y compras
    const mostrarSelectorVista = tipoReporte === 'ventas' || tipoReporte === 'compras';

    switch (tipoReporte) {
      case 'ventas':
        if (vistaReporte === 'detallada') {
          // Vista detallada - todos los productos en una tabla plana
          let todosLosItems = ventasData.flatMap(venta =>
            venta.items.map(item => ({
              numero_venta: venta.numero_venta,
              fecha: venta.fecha,
              usuario: venta.usuario,
              producto: item.producto,
              tipo: item.tipo,
              talle: item.talle,
              cantidad: item.cantidad,
              unidad_medida: item.unidad_medida,
              precio_unitario: item.precio_unitario,
              subtotal: item.subtotal,
              es_fiado: venta.es_fiado,
              desconto_stock: venta.desconto_stock,
              fiado_completado: venta.fiado_completado,
              es_mayorista: venta.es_mayorista
            }))
          );

          // Aplicar filtro de estado
          if (filtroEstadoVenta === 'solo_fiado') {
            todosLosItems = todosLosItems.filter(item => item.es_fiado && !item.fiado_completado);
          } else if (filtroEstadoVenta === 'solo_fuera_stock') {
            todosLosItems = todosLosItems.filter(item => !item.desconto_stock);
          } else if (filtroEstadoVenta === 'ambos') {
            todosLosItems = todosLosItems.filter(item =>
              (item.es_fiado && !item.fiado_completado) && !item.desconto_stock
            );
          }

          const total = todosLosItems.reduce((sum, item) => sum + item.subtotal, 0);

          return (
            <>
              {/* Vista de escritorio */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Venta</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Talle</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {todosLosItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">#{item.numero_venta}</td>
                        <td className="px-4 py-3 text-sm">{item.fecha}</td>
                        <td className="px-4 py-3 text-sm">{item.usuario}</td>
                        <td className="px-4 py-3 text-sm font-medium">{item.producto}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                            item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {item.tipo === 'unidad' ? 'Unidad' :
                             item.tipo === 'paquete' ? 'Paquete' :
                             'Peso'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {item.talle ? (
                            <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                              {item.talle}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {item.es_fiado && !item.fiado_completado && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md text-xs font-semibold">
                                FIADO
                              </span>
                            )}
                            {item.es_mayorista && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">
                                MAYORISTA
                              </span>
                            )}
                            {!item.desconto_stock && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-semibold">
                                FUERA DE STOCK
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{item.cantidad} {item.unidad_medida}</td>
                        <td className="px-4 py-3 text-sm text-center">{formatGuaranies(item.precio_unitario)}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-indigo-600">{formatGuaranies(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td colSpan={9} className="px-4 py-3 text-sm font-bold text-right">Total:</td>
                      <td className="px-4 py-3 text-sm font-bold text-right">
                        {formatGuaranies(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Vista móvil */}
              <div className="md:hidden space-y-4">
                {todosLosItems.map((item, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{item.producto}</p>
                          <p className="text-xs text-gray-500">Venta #{item.numero_venta} • {item.fecha} • {item.usuario}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                          item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.tipo === 'unidad' ? 'Unidad' :
                           item.tipo === 'paquete' ? 'Paquete' :
                           'Peso'}
                        </span>
                      </div>

                      {item.talle && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Talle:</span>
                          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                            {item.talle}
                          </span>
                        </div>
                      )}

                      {((item.es_fiado && !item.fiado_completado) || item.es_mayorista || !item.desconto_stock) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.es_fiado && !item.fiado_completado && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md text-xs font-semibold">
                              FIADO
                            </span>
                          )}
                          {item.es_mayorista && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">
                              MAYORISTA
                            </span>
                          )}
                          {!item.desconto_stock && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-semibold">
                              FUERA DE STOCK
                            </span>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500">Cantidad</p>
                          <p className="font-medium text-gray-900">{item.cantidad} {item.unidad_medida}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Precio Unit.</p>
                          <p className="font-medium text-gray-900">{formatGuaranies(item.precio_unitario)}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">Subtotal:</span>
                          <span className="text-base font-bold text-indigo-600">{formatGuaranies(item.subtotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total en vista móvil */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total General:</span>
                    <span className="text-xl font-bold text-indigo-600">{formatGuaranies(total)}</span>
                  </div>
                </div>
              </div>

              {renderPaginacion()}
            </>
          );
        }

        // Vista agrupada (original con expansión)
        const totalVentas = ventasDataCompleto.reduce((sum, v) => sum + v.total, 0);

        return (
          <>
            {/* Vista de escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Venta</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasData.flatMap((venta) => {
                    const rows = [
                      <tr
                        key={`venta-${venta.id}`}
                        className="hover:bg-gray-50 cursor-pointer border-b border-gray-200"
                        onClick={() => toggleRow(venta.id)}
                      >
                        <td className="px-4 py-3 text-center">
                          {expandedRows.has(venta.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            #{venta.numero_venta}
                            {venta.es_fiado && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md text-xs font-semibold">
                                FIADO
                              </span>
                            )}
                            {venta.es_mayorista && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">
                                MAYORISTA
                              </span>
                            )}
                            {!venta.desconto_stock && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-semibold">
                                FUERA DE STOCK
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{venta.fecha}</td>
                        <td className="px-4 py-3 text-sm font-medium">{venta.usuario}</td>
                        <td className="px-4 py-3 text-sm text-center">{venta.items_count}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-indigo-600">{formatGuaranies(venta.total)}</td>
                      </tr>
                    ];

                    if (expandedRows.has(venta.id)) {
                      rows.push(
                        <tr key={`detail-${venta.id}`} className="bg-gray-50 border-b border-gray-200">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="ml-8">
                              <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Detalle de Productos</h4>
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Producto</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Tipo</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Talle</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Cantidad</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Precio Unit.</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {venta.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-100">
                                      <td className="px-3 py-2">{item.producto}</td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                          item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                                          item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                                          'bg-green-100 text-green-700'
                                        }`}>
                                          {item.tipo === 'unidad' ? 'Unidad' :
                                           item.tipo === 'paquete' ? 'Paquete' :
                                           'Peso'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {item.talle ? (
                                          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                                            {item.talle}
                                          </span>
                                        ) : (
                                          '-'
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-center">{item.cantidad} {item.unidad_medida}</td>
                                      <td className="px-3 py-2 text-center">{formatGuaranies(item.precio_unitario)}</td>
                                      <td className="px-3 py-2 text-right font-medium">{formatGuaranies(item.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return rows;
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-bold text-right">Total:</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">
                      {formatGuaranies(totalVentas)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Vista móvil */}
            <div className="md:hidden space-y-4">
              {ventasData.map((venta) => (
                <div key={venta.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleRow(venta.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">Venta #{venta.numero_venta}</p>
                          {venta.es_fiado && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md text-xs font-semibold">
                              FIADO
                            </span>
                          )}
                          {venta.es_mayorista && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">
                              MAYORISTA
                            </span>
                          )}
                          {!venta.desconto_stock && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-semibold">
                              SIN STOCK
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{venta.fecha} • {venta.usuario}</p>
                      </div>
                      {expandedRows.has(venta.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">{venta.items_count} items</span>
                      <span className="text-lg font-bold text-indigo-600">{formatGuaranies(venta.total)}</span>
                    </div>
                  </div>

                  {expandedRows.has(venta.id) && (
                    <div className="bg-gray-50 p-4 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase">Detalle de Productos</h4>
                      <div className="space-y-2">
                        {venta.items.map((item, idx) => (
                          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-medium text-gray-900 flex-1">{item.producto}</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ml-2 ${
                                item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                                item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {item.tipo === 'unidad' ? 'Unidad' :
                                 item.tipo === 'paquete' ? 'Paquete' :
                                 'Peso'}
                              </span>
                            </div>

                            {item.talle && (
                              <div className="mb-2">
                                <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                                  Talle: {item.talle}
                                </span>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-gray-500">Cantidad</p>
                                <p className="font-medium">{item.cantidad} {item.unidad_medida}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Precio Unit.</p>
                                <p className="font-medium">{formatGuaranies(item.precio_unitario)}</p>
                              </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                              <span className="text-xs text-gray-500">Subtotal:</span>
                              <span className="font-bold text-indigo-600">{formatGuaranies(item.subtotal)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Total en vista móvil */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total General:</span>
                  <span className="text-xl font-bold text-indigo-600">{formatGuaranies(totalVentas)}</span>
                </div>
              </div>
            </div>

            {renderPaginacion()}
          </>
        );

      case 'compras':
        if (vistaReporte === 'detallada') {
          // Vista detallada - todos los productos en una tabla plana
          const todosLosItems = comprasData.flatMap(compra =>
            compra.items.map(item => ({
              fecha: compra.fecha,
              proveedor: compra.proveedor,
              producto: item.producto,
              tipo: item.tipo,
              talle: item.talle,
              cantidad: item.cantidad,
              unidad_medida: item.unidad_medida,
              precio_unitario: item.precio_unitario,
              subtotal: item.subtotal
            }))
          );

          const total = todosLosItems.reduce((sum, item) => sum + item.subtotal, 0);

          return (
            <>
              {/* Vista de escritorio */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Talle</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {todosLosItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{item.fecha}</td>
                        <td className="px-4 py-3 text-sm">{item.proveedor}</td>
                        <td className="px-4 py-3 text-sm font-medium">{item.producto}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                            item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {item.tipo === 'unidad' ? 'Unidad' :
                             item.tipo === 'paquete' ? 'Paquete' :
                             'Peso'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {item.talle ? (
                            <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                              {item.talle}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{item.cantidad} {item.unidad_medida}</td>
                        <td className="px-4 py-3 text-sm text-center">{formatGuaranies(item.precio_unitario)}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-indigo-600">{formatGuaranies(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-sm font-bold text-right">Total:</td>
                      <td className="px-4 py-3 text-sm font-bold text-right">
                        {formatGuaranies(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Vista móvil */}
              <div className="md:hidden space-y-4">
                {todosLosItems.map((item, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{item.producto}</p>
                          <p className="text-xs text-gray-500">{item.fecha} • {item.proveedor}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                          item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.tipo === 'unidad' ? 'Unidad' :
                           item.tipo === 'paquete' ? 'Paquete' :
                           'Peso'}
                        </span>
                      </div>

                      {item.talle && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Talle:</span>
                          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                            {item.talle}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500">Cantidad</p>
                          <p className="font-medium text-gray-900">{item.cantidad} {item.unidad_medida}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Precio Unit.</p>
                          <p className="font-medium text-gray-900">{formatGuaranies(item.precio_unitario)}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">Subtotal:</span>
                          <span className="text-base font-bold text-indigo-600">{formatGuaranies(item.subtotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total en vista móvil */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total General:</span>
                    <span className="text-xl font-bold text-indigo-600">{formatGuaranies(total)}</span>
                  </div>
                </div>
              </div>

              {renderPaginacion()}
            </>
          );
        }

        // Vista agrupada (con expansión)
        const totalCompras = comprasDataCompleto.reduce((sum, c) => sum + c.total, 0);

        return (
          <>
            {/* Vista de escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasData.flatMap((compra) => {
                    const rows = [
                      <tr
                        key={`compra-${compra.id}`}
                        className="hover:bg-gray-50 cursor-pointer border-b border-gray-200"
                        onClick={() => toggleRow(compra.id)}
                      >
                        <td className="px-4 py-3 text-center">
                          {expandedRows.has(compra.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{compra.fecha}</td>
                        <td className="px-4 py-3 text-sm font-medium">{compra.proveedor}</td>
                        <td className="px-4 py-3 text-sm text-center">{compra.items_count}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-indigo-600">{formatGuaranies(compra.total)}</td>
                      </tr>
                    ];

                    if (expandedRows.has(compra.id)) {
                      rows.push(
                        <tr key={`detail-${compra.id}`} className="bg-gray-50 border-b border-gray-200">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="ml-8">
                              <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Detalle de Productos</h4>
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Producto</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Tipo</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Talle</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Cantidad</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Precio Unit.</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {compra.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-100">
                                      <td className="px-3 py-2">{item.producto}</td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                          item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                                          item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                                          'bg-green-100 text-green-700'
                                        }`}>
                                          {item.tipo === 'unidad' ? 'Unidad' :
                                           item.tipo === 'paquete' ? 'Paquete' :
                                           'Peso'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {item.talle ? (
                                          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                                            {item.talle}
                                          </span>
                                        ) : (
                                          '-'
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-center">{item.cantidad} {item.unidad_medida}</td>
                                      <td className="px-3 py-2 text-center">{formatGuaranies(item.precio_unitario)}</td>
                                      <td className="px-3 py-2 text-right font-medium">{formatGuaranies(item.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return rows;
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-right">Total:</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">
                      {formatGuaranies(totalCompras)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Vista móvil */}
            <div className="md:hidden space-y-4">
              {comprasData.map((compra) => (
                <div key={compra.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleRow(compra.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{compra.fecha}</p>
                        <p className="text-sm text-gray-600">{compra.proveedor}</p>
                      </div>
                      {expandedRows.has(compra.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">{compra.items_count} items</span>
                      <span className="text-lg font-bold text-indigo-600">{formatGuaranies(compra.total)}</span>
                    </div>
                  </div>

                  {expandedRows.has(compra.id) && (
                    <div className="bg-gray-50 p-4 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase">Detalle de Productos</h4>
                      <div className="space-y-2">
                        {compra.items.map((item, idx) => (
                          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-medium text-gray-900 flex-1">{item.producto}</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ml-2 ${
                                item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                                item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {item.tipo === 'unidad' ? 'Unidad' :
                                 item.tipo === 'paquete' ? 'Paquete' :
                                 'Peso'}
                              </span>
                            </div>

                            {item.talle && (
                              <div className="mb-2">
                                <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                                  Talle: {item.talle}
                                </span>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-gray-500">Cantidad</p>
                                <p className="font-medium">{item.cantidad} {item.unidad_medida}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Precio Unit.</p>
                                <p className="font-medium">{formatGuaranies(item.precio_unitario)}</p>
                              </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                              <span className="text-xs text-gray-500">Subtotal:</span>
                              <span className="font-bold text-indigo-600">{formatGuaranies(item.subtotal)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Total en vista móvil */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total General:</span>
                  <span className="text-xl font-bold text-indigo-600">{formatGuaranies(totalCompras)}</span>
                </div>
              </div>
            </div>

            {renderPaginacion()}
          </>
        );

      case 'inventario':
        const valorTotalCompra = inventarioDataCompleto.reduce((sum, i) => sum + i.valor_total_compra, 0);
        const valorTotalVenta = inventarioDataCompleto.reduce((sum, i) => sum + i.valor_total, 0);

        return (
          <>
            {/* Vista de escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Talle</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock Unidades</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock Paquetes</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock Kg</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style={{minWidth: '140px'}}>Precio Compra</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style={{minWidth: '140px'}}>Precio Venta</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" style={{minWidth: '160px'}}>Valor Total Compra</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" style={{minWidth: '160px'}}>Valor Total Venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inventarioData.map((item, idx) => {
                    // Determinar si el stock está bajo
                    let stockBajo = false;
                    if (item.tipo === 'unidad') {
                      stockBajo = item.stock_unidades <= item.stock_minimo;
                    } else if (item.tipo === 'paquete') {
                      stockBajo = item.stock_paquetes <= item.stock_minimo;
                    } else if (item.tipo === 'peso') {
                      stockBajo = item.stock_kg <= item.stock_minimo;
                    }

                    const isInactive = !item.is_active;

                    return (
                      <tr key={idx} className={isInactive ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <span className={isInactive ? 'text-gray-500' : ''}>{item.producto}</span>
                            {isInactive && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">INACTIVO</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                            item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {item.tipo === 'unidad' ? 'Unidad' :
                             item.tipo === 'paquete' ? 'Paquete' :
                             'Peso'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm text-center ${isInactive ? 'text-gray-500' : ''}`}>
                          {item.talle ? (
                            <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                              {item.talle}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm ${isInactive ? 'text-gray-500' : ''}`}>{item.categoria}</td>
                        <td className={`px-4 py-3 text-sm ${isInactive ? 'text-gray-500' : ''}`}>{item.proveedor}</td>
                        <td className={`px-4 py-3 text-sm text-center ${isInactive ? 'text-gray-500' : (item.tipo === 'unidad' && stockBajo ? 'text-red-600 font-bold' : '')}`}>
                          {item.stock_unidades > 0 ? Math.round(item.stock_unidades) : '-'}
                        </td>
                        <td className={`px-4 py-3 text-sm text-center ${isInactive ? 'text-gray-500' : (item.tipo === 'paquete' && stockBajo ? 'text-red-600 font-bold' : '')}`}>
                          {item.stock_paquetes > 0 ? item.stock_paquetes : '-'}
                        </td>
                        <td className={`px-4 py-3 text-sm text-center ${isInactive ? 'text-gray-500' : (item.tipo === 'peso' && stockBajo ? 'text-red-600 font-bold' : '')}`}>
                          {item.stock_kg > 0 ? item.stock_kg.toFixed(2) : '-'}
                        </td>
                        <td className={`px-6 py-3 text-sm text-center ${isInactive ? 'text-gray-500' : ''}`}>
                          {formatGuaranies(item.precio_compra)}
                          {item.tipo === 'unidad' && ' /Un'}
                          {item.tipo === 'paquete' && ' /Pq'}
                          {item.tipo === 'peso' && ' /kg'}
                        </td>
                        <td className={`px-6 py-3 text-sm text-center ${isInactive ? 'text-gray-500' : ''}`}>
                          {formatGuaranies(item.precio_venta)}
                          {item.tipo === 'unidad' && ' /Un'}
                          {item.tipo === 'paquete' && ' /Pq'}
                          {item.tipo === 'peso' && ' /kg'}
                        </td>
                        <td className={`px-6 py-3 text-sm text-right font-medium ${isInactive ? 'text-gray-500' : ''}`}>{formatGuaranies(item.valor_total_compra)}</td>
                        <td className={`px-6 py-3 text-sm text-right font-medium ${isInactive ? 'text-gray-500' : ''}`}>{formatGuaranies(item.valor_total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2">
                  <tr>
                    <td colSpan={5} className="px-6 py-3 text-sm font-bold text-left">Totales:</td>
                    <td colSpan={5} className="px-6 py-3 text-sm font-bold text-right text-green-700">
                      Total Precio Compra: {formatGuaranies(valorTotalCompra)}
                    </td>
                    <td colSpan={2} className="px-6 py-3 text-sm font-bold text-right text-indigo-700">
                      Total Precio Venta: {formatGuaranies(valorTotalVenta)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Vista móvil */}
            <div className="md:hidden space-y-4">
              {inventarioData.map((item, idx) => {
                // Determinar si el stock está bajo
                let stockBajo = false;
                if (item.tipo === 'unidad') {
                  stockBajo = item.stock_unidades <= item.stock_minimo;
                } else if (item.tipo === 'paquete') {
                  stockBajo = item.stock_paquetes <= item.stock_minimo;
                } else if (item.tipo === 'peso') {
                  stockBajo = item.stock_kg <= item.stock_minimo;
                }

                const isInactive = !item.is_active;

                return (
                  <div key={idx} className={`border rounded-lg p-4 shadow-sm ${isInactive ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`font-semibold ${isInactive ? 'text-gray-500' : 'text-gray-900'}`}>{item.producto}</p>
                            {isInactive && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">INACTIVO</span>
                            )}
                          </div>
                          <p className={`text-xs mt-1 ${isInactive ? 'text-gray-400' : 'text-gray-500'}`}>{item.categoria} • {item.proveedor}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.tipo === 'unidad' ? 'bg-blue-100 text-blue-700' :
                          item.tipo === 'paquete' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.tipo === 'unidad' ? 'Unidad' :
                           item.tipo === 'paquete' ? 'Paquete' :
                           'Peso'}
                        </span>
                      </div>

                      {item.talle && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Talle:</span>
                          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                            {item.talle}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500">Stock Unid.</p>
                          <p className={`font-medium ${item.tipo === 'unidad' && stockBajo ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                            {item.stock_unidades > 0 ? Math.round(item.stock_unidades) : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Stock Paq.</p>
                          <p className={`font-medium ${item.tipo === 'paquete' && stockBajo ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                            {item.stock_paquetes > 0 ? item.stock_paquetes : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Stock Kg</p>
                          <p className={`font-medium ${item.tipo === 'peso' && stockBajo ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                            {item.stock_kg > 0 ? item.stock_kg.toFixed(2) : '-'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500">Precio Compra</p>
                          <p className="font-medium text-gray-900 text-sm">
                            {formatGuaranies(item.precio_compra)}
                            {item.tipo === 'unidad' && ' /Un'}
                            {item.tipo === 'paquete' && ' /Pq'}
                            {item.tipo === 'peso' && ' /kg'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Precio Venta</p>
                          <p className="font-medium text-gray-900 text-sm">
                            {formatGuaranies(item.precio_venta)}
                            {item.tipo === 'unidad' && ' /Un'}
                            {item.tipo === 'paquete' && ' /Pq'}
                            {item.tipo === 'peso' && ' /kg'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500">Valor Total Compra</p>
                          <p className="font-medium text-gray-900 text-sm">
                            {formatGuaranies(item.valor_total_compra)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Valor Total Venta</p>
                          <p className="font-medium text-indigo-600 text-sm">
                            {formatGuaranies(item.valor_total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Totales en vista móvil */}
              <div className="space-y-3">
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Valor Total Precio Compra:</span>
                    <span className="text-xl font-bold text-green-600">{formatGuaranies(valorTotalCompra)}</span>
                  </div>
                </div>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Valor Total Precio Venta:</span>
                    <span className="text-xl font-bold text-indigo-600">{formatGuaranies(valorTotalVenta)}</span>
                  </div>
                </div>
              </div>
            </div>

            {renderPaginacion()}
          </>
        );

      case 'productos_vendidos':
        return (
          <>
            {/* Vista de escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Talle</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tipo de Venta</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad Vendida</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {productosVendidosData.map((producto, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{producto.producto}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          producto.tipo_producto === 'unidad' ? 'bg-blue-100 text-blue-700' :
                          producto.tipo_producto === 'paquete' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {producto.tipo_producto === 'unidad' ? 'Unidad' :
                           producto.tipo_producto === 'paquete' ? 'Paquete' :
                           'Peso'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {producto.talle ? (
                          <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                            {producto.talle}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                          {producto.unidad_medida}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{producto.cantidad_vendida} {producto.unidad_medida}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatGuaranies(producto.total_ventas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vista móvil */}
            <div className="md:hidden space-y-4">
              {productosVendidosData.map((producto, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{producto.producto}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        producto.tipo_producto === 'unidad' ? 'bg-blue-100 text-blue-700' :
                        producto.tipo_producto === 'paquete' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {producto.tipo_producto === 'unidad' ? 'Unidad' :
                         producto.tipo_producto === 'paquete' ? 'Paquete' :
                         'Peso'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {producto.talle && (
                        <>
                          <span className="text-xs text-gray-500">Talle:</span>
                          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md text-xs font-medium">
                            {producto.talle}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500">Tipo de Venta</p>
                        <span className="inline-block mt-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                          {producto.unidad_medida}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Cantidad Vendida</p>
                        <p className="font-medium text-gray-900 mt-1">{producto.cantidad_vendida} {producto.unidad_medida}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">Total Ventas:</span>
                        <span className="text-base font-bold text-indigo-600">{formatGuaranies(producto.total_ventas)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      case 'proveedores':
        const totalProveedores = proveedoresData.reduce((sum, p) => sum + p.total_compras, 0);

        return (
          <>
            {/* Vista de escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">N° Compras</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Compras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {proveedoresData.map((proveedor, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{proveedor.proveedor}</td>
                      <td className="px-4 py-3 text-sm text-right">{proveedor.cantidad_compras}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatGuaranies(proveedor.total_compras)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-right">Total:</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">
                      {formatGuaranies(totalProveedores)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Vista móvil */}
            <div className="md:hidden space-y-4">
              {proveedoresData.map((proveedor, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-gray-900">{proveedor.proveedor}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500">N° de Compras</p>
                        <p className="font-medium text-gray-900 text-lg">{proveedor.cantidad_compras}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total Compras</p>
                        <p className="font-bold text-indigo-600 text-lg">{formatGuaranies(proveedor.total_compras)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Total en vista móvil */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total General:</span>
                  <span className="text-xl font-bold text-indigo-600">{formatGuaranies(totalProveedores)}</span>
                </div>
              </div>
            </div>
          </>
        );

      case 'anulaciones':
        if (vistaReporte === 'detallada') {
          // Vista detallada: Una fila por producto
          const totalAnulacionesDetallada = anulacionesDetalladasData.reduce((sum, a) => sum + a.subtotal_anulado, 0);

          return (
            <>
              {/* Vista de escritorio */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Venta</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P. Unit</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {anulacionesDetalladasData.map((item, idx) => (
                      <tr key={`${item.anulacion_id}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{new Date(item.fecha).toLocaleString('es-PY')}</td>
                        <td className="px-4 py-3 text-sm font-medium">#{item.numero_venta}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.tipo_anulacion === 'completa'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {item.tipo_anulacion === 'completa' ? 'C' : 'P'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{item.producto}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.categoria}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.cantidad} {item.unidad_medida}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatGuaranies(item.precio_unitario)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-red-600">{formatGuaranies(item.subtotal_anulado)}</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate" title={item.motivo}>{item.motivo}</td>
                        <td className="px-4 py-3 text-sm">{item.anulado_por}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-sm font-bold text-right">Total Anulado:</td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-red-600">
                        {formatGuaranies(totalAnulacionesDetallada)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Vista móvil */}
              <div className="md:hidden space-y-4">
                {anulacionesDetalladasData.map((item, idx) => (
                  <div key={`${item.anulacion_id}-${idx}`} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-gray-500">Venta</p>
                          <p className="font-bold text-gray-900 text-lg">#{item.numero_venta}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.tipo_anulacion === 'completa'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {item.tipo_anulacion === 'completa' ? 'Completa' : 'Parcial'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500">Producto</p>
                        <p className="font-medium text-gray-900">{item.producto}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.categoria}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500">Cantidad</p>
                          <p className="font-medium text-gray-900">{item.cantidad} {item.unidad_medida}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">P. Unitario</p>
                          <p className="font-medium text-gray-900">{formatGuaranies(item.precio_unitario)}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500">Subtotal Anulado</p>
                        <p className="font-bold text-red-600 text-lg">{formatGuaranies(item.subtotal_anulado)}</p>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500">Fecha</p>
                        <p className="text-sm text-gray-900">{new Date(item.fecha).toLocaleString('es-PY')}</p>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500">Motivo</p>
                        <p className="text-sm text-gray-900">{item.motivo}</p>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500">Anulado por</p>
                        <p className="text-sm text-gray-900">{item.anulado_por}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total en vista móvil */}
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total Anulado:</span>
                    <span className="text-xl font-bold text-red-600">{formatGuaranies(totalAnulacionesDetallada)}</span>
                  </div>
                </div>
              </div>
            </>
          );
        } else {
          // Vista agrupada: Una fila por anulación con productos resumidos
          const totalAnulaciones = anulacionesData.reduce((sum, a) => sum + a.total_anulado, 0);

          return (
            <>
              {/* Vista de escritorio */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-8"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Venta</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Anulado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anulado Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anulacionesData.flatMap((anulacion) => {
                      const rows = [
                        <tr
                          key={`anulacion-${anulacion.id}`}
                          className="hover:bg-gray-50 cursor-pointer border-b border-gray-200"
                          onClick={() => toggleRow(anulacion.id)}
                        >
                          <td className="px-4 py-3 text-center">
                            {expandedRows.has(anulacion.id) ? (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">{new Date(anulacion.fecha).toLocaleString('es-PY')}</td>
                          <td className="px-4 py-3 text-sm font-medium">#{anulacion.numero_venta}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              anulacion.tipo_anulacion === 'completa'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {anulacion.tipo_anulacion === 'completa' ? 'Completa' : 'Parcial'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">{anulacion.items_anulados.length}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                            {formatGuaranies(anulacion.total_anulado)}
                          </td>
                          <td className="px-4 py-3 text-sm max-w-xs truncate" title={anulacion.motivo}>
                            {anulacion.motivo}
                          </td>
                          <td className="px-4 py-3 text-sm">{anulacion.anulado_por}</td>
                        </tr>
                      ];

                      if (expandedRows.has(anulacion.id)) {
                        rows.push(
                          <tr key={`detail-${anulacion.id}`} className="bg-gray-50 border-b border-gray-200">
                            <td colSpan={8} className="px-4 py-3">
                              <div className="ml-8">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Productos Anulados</h4>
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Producto</th>
                                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Cantidad</th>
                                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Precio Unit.</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {anulacion.items_anulados.map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-gray-100">
                                        <td className="px-3 py-2">{item.producto_nombre || 'Producto'}</td>
                                        <td className="px-3 py-2 text-center">{item.cantidad} {item.unidad_medida}</td>
                                        <td className="px-3 py-2 text-center">{formatGuaranies(item.precio_unitario || 0)}</td>
                                        <td className="px-3 py-2 text-right font-medium">{formatGuaranies(item.subtotal || 0)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return rows;
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-sm font-bold text-right">Total Anulado:</td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-red-600">
                        {formatGuaranies(totalAnulaciones)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Vista móvil */}
              <div className="md:hidden space-y-4">
                {anulacionesData.map((anulacion) => (
                  <div key={anulacion.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleRow(anulacion.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Venta #{anulacion.numero_venta}</p>
                          <p className="font-semibold text-gray-900">{new Date(anulacion.fecha).toLocaleString('es-PY')}</p>
                        </div>
                        {expandedRows.has(anulacion.id) ? (
                          <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          anulacion.tipo_anulacion === 'completa'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {anulacion.tipo_anulacion === 'completa' ? 'Completa' : 'Parcial'}
                        </span>
                        <span className="text-sm font-medium text-gray-600">{anulacion.items_anulados.length} items</span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Anulado:</span>
                          <span className="text-base font-bold text-red-600">{formatGuaranies(anulacion.total_anulado)}</span>
                        </div>
                      </div>
                    </div>

                    {expandedRows.has(anulacion.id) && (
                      <div className="px-4 pb-4 border-t border-gray-200 bg-gray-50">
                        <div className="space-y-3 mt-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Productos Anulados</p>
                            <div className="space-y-2">
                              {anulacion.items_anulados.map((item: any, idx: number) => (
                                <div key={idx} className="bg-white p-2 rounded border border-gray-200">
                                  <p className="font-medium text-sm text-gray-900">{item.producto_nombre || 'Producto'}</p>
                                  <div className="flex justify-between mt-1">
                                    <span className="text-xs text-gray-600">{item.cantidad} {item.unidad_medida}</span>
                                    <span className="text-xs font-medium text-gray-900">{formatGuaranies(item.subtotal || 0)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500">Motivo</p>
                            <p className="text-sm text-gray-900 mt-1">{anulacion.motivo}</p>
                          </div>

                          <div className="pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500">Anulado por</p>
                            <p className="text-sm text-gray-900 mt-1">{anulacion.anulado_por}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Total en vista móvil */}
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total Anulado:</span>
                    <span className="text-xl font-bold text-red-600">{formatGuaranies(totalAnulaciones)}</span>
                  </div>
                </div>
              </div>
            </>
          );
        }

      default:
        return null;
    }
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 md:space-y-6">
      {/* Encabezado */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="p-2 md:p-3 bg-blue-100 rounded-lg">
            <FileText className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Reportes</h1>
            <p className="text-xs md:text-sm text-gray-500">Genera y exporta reportes del sistema</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-3 md:p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <Filter className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
          <h2 className="text-base md:text-lg font-semibold">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Reporte
            </label>
            <select
              value={tipoReporte}
              onChange={(e) => setTipoReporte(e.target.value as TipoReporte)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ventas">Ventas</option>
              <option value="compras">Compras</option>
              <option value="inventario">Inventario</option>
              <option value="productos_vendidos">Productos Más Vendidos</option>
              <option value="proveedores">Proveedores Principales</option>
              <option value="anulaciones">Anulaciones</option>
            </select>
          </div>

          {(tipoReporte === 'ventas' || tipoReporte === 'compras' || tipoReporte === 'anulaciones') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vista
              </label>
              <select
                value={vistaReporte}
                onChange={(e) => setVistaReporte(e.target.value as VistaReporte)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="agrupada">Agrupada</option>
                <option value="detallada">Detallada</option>
              </select>
            </div>
          )}

          {(tipoReporte === 'inventario' || tipoReporte === 'ventas' || tipoReporte === 'compras' || tipoReporte === 'anulaciones') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría
              </label>
              <select
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {tipoReporte === 'inventario' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={filtroEstadoInventario}
                onChange={(e) => setFiltroEstadoInventario(e.target.value as 'todos' | 'activos' | 'inactivos')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>
          )}

          {tipoReporte === 'ventas' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Venta
                </label>
                <select
                  value={filtroVentasFiadas}
                  onChange={(e) => setFiltroVentasFiadas(e.target.value as 'todas' | 'solo_fiadas' | 'solo_normales')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="todas">Todas las ventas</option>
                  <option value="solo_fiadas">Solo fiadas</option>
                  <option value="solo_normales">Solo normales (no fiadas)</option>
                </select>
              </div>

              {vistaReporte === 'detallada' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado del Producto
                  </label>
                  <select
                    value={filtroEstadoVenta}
                    onChange={(e) => setFiltroEstadoVenta(e.target.value as 'todos' | 'solo_fiado' | 'solo_fuera_stock' | 'ambos')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="todos">Todos los productos</option>
                    <option value="solo_fiado">Solo productos fiados</option>
                    <option value="solo_fuera_stock">Solo fuera de stock</option>
                    <option value="ambos">Fiado y fuera de stock</option>
                  </select>
                </div>
              )}
            </>
          )}

          {tipoReporte !== 'inventario' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtro por Fecha
                </label>
                <select
                  value={modoFiltroFecha}
                  onChange={(e) => setModoFiltroFecha(e.target.value as 'ninguno' | 'fecha' | 'rango')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ninguno">Todos los registros</option>
                  <option value="fecha">Fecha específica</option>
                  <option value="rango">Rango de fechas</option>
                </select>
              </div>

              {modoFiltroFecha === 'fecha' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={fechaEspecifica}
                    onChange={(e) => setFechaEspecifica(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {modoFiltroFecha === 'rango' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha Desde
                    </label>
                    <input
                      type="date"
                      value={fechaDesde}
                      onChange={(e) => setFechaDesde(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha Hasta
                    </label>
                    <input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="col-span-1 sm:col-span-2 xl:col-span-1 flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
            <button
              onClick={exportarPDF}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 min-h-[42px] text-sm"
            >
              <Download className="h-4 w-4" />
              <span className="inline sm:inline">PDF</span>
            </button>
            <button
              onClick={exportarExcel}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 min-h-[42px] text-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="inline sm:inline">Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido del Reporte */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">{obtenerTituloReporte()}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {modoFiltroFecha === 'ninguno'
              ? 'Todos los registros'
              : modoFiltroFecha === 'fecha'
              ? `Fecha: ${fechaEspecifica}`
              : `Período: ${fechaDesde} a ${fechaHasta}`
            }
          </p>
        </div>

        {error && (
          <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500">Cargando datos...</p>
          </div>
        ) : (
          <div className="p-6">
            {renderTabla()}
          </div>
        )}
      </div>
    </div>
  );
};
