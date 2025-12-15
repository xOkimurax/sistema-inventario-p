// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, ShoppingCart, TrendingUp, AlertTriangle, Boxes, Weight, Settings, Shirt } from 'lucide-react';
import { formatGuaranies } from '../../utils/currency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardData {
  inventario: {
    total_productos: number;
    total_unidades: number;
    total_paquetes: number;
    total_kg: number;
    total_ropa_calzado: number;
  };
  estadisticas_semana: {
    total_ventas: number;
    cantidad_ventas: number;
    total_compras: number;
    cantidad_compras: number;
  };
  alertas_stock_bajo: Array<{
    id: string;
    codigo: string;
    nombre: string;
    tipo: string;
    stock_actual: number;
    stock_minimo: number;
  }>;
  grafico_ventas: Array<{
    periodo: string;
    actual: number;
    anterior: number;
  }>;
  ultimas_ventas: Array<{
    id: string;
    productos: string;
    fecha: string;
    total: number;
  }>;
  ultimas_compras: Array<{
    id: string;
    productos: string;
    fecha: string;
    total: number;
  }>;
}

type TipoComparativa = 'diaria' | 'semanal' | 'mensual';

type CardId = 'total_productos' | 'stock_unidades' | 'stock_paquetes' | 'stock_kg' | 'ropa_calzado';

interface CardConfig {
  id: CardId;
  label: string;
  icon: any;
  color: string;
  bgColor: string;
  getValue: (data: DashboardData) => string | number;
}

const AVAILABLE_CARDS: CardConfig[] = [
  {
    id: 'total_productos',
    label: 'Total Productos',
    icon: Package,
    color: '#3b82f6',
    bgColor: 'bg-blue-100',
    getValue: (data) => data.inventario.total_productos
  },
  {
    id: 'stock_unidades',
    label: 'Stock Unidades',
    icon: Boxes,
    color: '#10b981',
    bgColor: 'bg-green-100',
    getValue: (data) => Math.round(data.inventario.total_unidades)
  },
  {
    id: 'stock_paquetes',
    label: 'Stock Paquetes',
    icon: Package,
    color: '#a855f7',
    bgColor: 'bg-purple-100',
    getValue: (data) => data.inventario.total_paquetes
  },
  {
    id: 'stock_kg',
    label: 'Stock Kg',
    icon: Weight,
    color: '#f97316',
    bgColor: 'bg-orange-100',
    getValue: (data) => data.inventario.total_kg.toFixed(2)
  },
  {
    id: 'ropa_calzado',
    label: 'Ropa y Calzado',
    icon: Shirt,
    color: '#ec4899',
    bgColor: 'bg-pink-100',
    getValue: (data) => data.inventario.total_ropa_calzado
  }
];

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipoComparativa, setTipoComparativa] = useState<TipoComparativa>('diaria');
  const [visibleCards, setVisibleCards] = useState<CardId[]>(() => {
    const saved = localStorage.getItem('dashboardCards');
    return saved ? JSON.parse(saved) : ['total_productos', 'stock_unidades', 'stock_paquetes', 'stock_kg'];
  });
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [tipoComparativa]);

  useEffect(() => {
    localStorage.setItem('dashboardCards', JSON.stringify(visibleCards));
  }, [visibleCards]);

  const toggleCard = (cardId: CardId) => {
    setVisibleCards(prev =>
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // Cargar datos de inventario
      const { data: productos } = await supabase
        .from('productos')
        .select('id, codigo, nombre, tipo, stock_unidades, stock_paquetes, stock_kg, stock_minimo, es_ropa_calzado')
        .eq('is_active', true);

      const inventario = {
        total_productos: productos?.length || 0,
        total_unidades: productos?.reduce((sum, p) => sum + (p.stock_unidades || 0), 0) || 0,
        total_paquetes: productos?.reduce((sum, p) => sum + (p.stock_paquetes || 0), 0) || 0,
        total_kg: productos?.reduce((sum, p) => sum + (p.stock_kg || 0), 0) || 0,
        total_ropa_calzado: productos?.filter(p => p.es_ropa_calzado).length || 0
      };

      // Alertas de stock bajo
      const alertas_stock_bajo = (productos || [])
        .filter(p => {
          if (p.tipo === 'unidad') return p.stock_unidades <= p.stock_minimo;
          if (p.tipo === 'paquete') return p.stock_paquetes <= p.stock_minimo;
          if (p.tipo === 'peso') return p.stock_kg <= p.stock_minimo;
          return false;
        })
        .map(p => {
          let stock_actual = 0;
          if (p.tipo === 'unidad') stock_actual = Math.round(p.stock_unidades);
          else if (p.tipo === 'paquete') stock_actual = p.stock_paquetes;
          else if (p.tipo === 'peso') stock_actual = parseFloat(p.stock_kg.toFixed(2));

          return {
            id: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            tipo: p.tipo === 'unidad' ? 'Unidad' : p.tipo === 'paquete' ? 'Paquete' : 'Peso',
            stock_actual,
            stock_minimo: p.stock_minimo
          };
        });

      // Estadísticas de la semana (últimos 7 días)
      const hace7Dias = new Date();
      hace7Dias.setDate(hace7Dias.getDate() - 7);

      const { data: ventas } = await supabase
        .from('ventas')
        .select('total, fecha')
        .gte('fecha', hace7Dias.toISOString())
        .order('fecha', { ascending: true });

      const { data: compras } = await supabase
        .from('compras')
        .select('total, fecha')
        .gte('fecha', hace7Dias.toISOString())
        .order('fecha', { ascending: true });

      const estadisticas_semana = {
        total_ventas: ventas?.reduce((sum, v) => sum + v.total, 0) || 0,
        cantidad_ventas: ventas?.length || 0,
        total_compras: compras?.reduce((sum, c) => sum + c.total, 0) || 0,
        cantidad_compras: compras?.length || 0
      };

      // Gráfico de ventas comparativo
      let grafico_ventas: Array<{ periodo: string; actual: number; anterior: number }> = [];

      if (tipoComparativa === 'diaria') {
        // Comparativa diaria: últimos 7 días vs 7 días anteriores
        const hoy = new Date();
        hoy.setHours(23, 59, 59, 999);

        const hace7Dias = new Date(hoy);
        hace7Dias.setDate(hoy.getDate() - 6);
        hace7Dias.setHours(0, 0, 0, 0);

        const hace14Dias = new Date(hace7Dias);
        hace14Dias.setDate(hace7Dias.getDate() - 7);

        const hace8Dias = new Date(hace7Dias);
        hace8Dias.setDate(hace7Dias.getDate() - 1);
        hace8Dias.setHours(23, 59, 59, 999);

        // Obtener ventas de últimos 7 días
        const { data: ventasUltimos7Dias } = await supabase
          .from('ventas')
          .select('total, fecha')
          .gte('fecha', hace7Dias.toISOString())
          .lte('fecha', hoy.toISOString());

        // Obtener ventas de 7 días anteriores
        const { data: ventas7DiasAnteriores } = await supabase
          .from('ventas')
          .select('total, fecha')
          .gte('fecha', hace14Dias.toISOString())
          .lte('fecha', hace8Dias.toISOString());

        // Agrupar por día
        const ventasPorDiaActual = new Array(7).fill(0);
        const ventasPorDiaAnterior = new Array(7).fill(0);
        const etiquetasDias: string[] = [];

        // Generar etiquetas y preparar arrays
        for (let i = 0; i < 7; i++) {
          const fecha = new Date(hace7Dias);
          fecha.setDate(hace7Dias.getDate() + i);
          etiquetasDias.push(fecha.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' }));
        }

        (ventasUltimos7Dias || []).forEach(v => {
          const fechaVenta = new Date(v.fecha);
          const diffDias = Math.floor((fechaVenta.getTime() - hace7Dias.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDias >= 0 && diffDias < 7) {
            ventasPorDiaActual[diffDias] += v.total;
          }
        });

        (ventas7DiasAnteriores || []).forEach(v => {
          const fechaVenta = new Date(v.fecha);
          const diffDias = Math.floor((fechaVenta.getTime() - hace14Dias.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDias >= 0 && diffDias < 7) {
            ventasPorDiaAnterior[diffDias] += v.total;
          }
        });

        grafico_ventas = etiquetasDias.map((dia, index) => ({
          periodo: dia,
          actual: ventasPorDiaActual[index],
          anterior: ventasPorDiaAnterior[index]
        }));

      } else if (tipoComparativa === 'semanal') {
        // Comparativa semanal: esta semana vs semana anterior (totales completos)
        const hoy = new Date();
        const inicioDeSemana = new Date(hoy);
        inicioDeSemana.setDate(hoy.getDate() - hoy.getDay()); // Domingo de esta semana
        inicioDeSemana.setHours(0, 0, 0, 0);

        const finDeSemana = new Date(inicioDeSemana);
        finDeSemana.setDate(inicioDeSemana.getDate() + 6); // Sábado de esta semana
        finDeSemana.setHours(23, 59, 59, 999);

        const inicioSemanaAnterior = new Date(inicioDeSemana);
        inicioSemanaAnterior.setDate(inicioDeSemana.getDate() - 7);

        const finSemanaAnterior = new Date(finDeSemana);
        finSemanaAnterior.setDate(finDeSemana.getDate() - 7);

        // Obtener ventas de esta semana
        const { data: ventasEstaSemana } = await supabase
          .from('ventas')
          .select('total, fecha')
          .gte('fecha', inicioDeSemana.toISOString())
          .lte('fecha', finDeSemana.toISOString());

        // Obtener ventas de semana anterior
        const { data: ventasSemanaAnterior } = await supabase
          .from('ventas')
          .select('total, fecha')
          .gte('fecha', inicioSemanaAnterior.toISOString())
          .lte('fecha', finSemanaAnterior.toISOString());

        // Sumar totales completos de cada semana
        const totalEstaSemana = (ventasEstaSemana || []).reduce((sum, v) => sum + v.total, 0);
        const totalSemanaAnterior = (ventasSemanaAnterior || []).reduce((sum, v) => sum + v.total, 0);

        // Formato de etiquetas con rangos de fechas
        const etiquetaSemanaActual = `${inicioDeSemana.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })} - ${finDeSemana.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })}`;
        const etiquetaSemanaAnterior = `${inicioSemanaAnterior.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })} - ${finSemanaAnterior.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })}`;

        grafico_ventas = [
          {
            periodo: etiquetaSemanaActual,
            actual: totalEstaSemana,
            anterior: 0
          },
          {
            periodo: etiquetaSemanaAnterior,
            actual: 0,
            anterior: totalSemanaAnterior
          }
        ];

      } else {
        // Comparativa mensual: este mes vs mes anterior (totales completos)
        const hoy = new Date();
        const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

        const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999);

        // Obtener ventas de este mes
        const { data: ventasEsteMes } = await supabase
          .from('ventas')
          .select('total, fecha')
          .gte('fecha', inicioMesActual.toISOString())
          .lte('fecha', finMesActual.toISOString());

        // Obtener ventas de mes anterior
        const { data: ventasMesAnterior } = await supabase
          .from('ventas')
          .select('total, fecha')
          .gte('fecha', inicioMesAnterior.toISOString())
          .lte('fecha', finMesAnterior.toISOString());

        // Sumar totales completos de cada mes
        const totalEsteMes = (ventasEsteMes || []).reduce((sum, v) => sum + v.total, 0);
        const totalMesAnterior = (ventasMesAnterior || []).reduce((sum, v) => sum + v.total, 0);

        // Formato de etiquetas con rangos de fechas
        const etiquetaMesActual = `${inicioMesActual.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })} - ${finMesActual.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })}`;
        const etiquetaMesAnterior = `${inicioMesAnterior.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })} - ${finMesAnterior.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })}`;

        grafico_ventas = [
          {
            periodo: etiquetaMesActual,
            actual: totalEsteMes,
            anterior: 0
          },
          {
            periodo: etiquetaMesAnterior,
            actual: 0,
            anterior: totalMesAnterior
          }
        ];
      }

      // Últimas 5 ventas con nombre de productos
      const { data: ultimasVentasData } = await supabase
        .from('ventas')
        .select(`
          id,
          fecha,
          total,
          venta_items (
            cantidad,
            productos (nombre)
          )
        `)
        .order('fecha', { ascending: false })
        .limit(5);

      const ultimas_ventas = (ultimasVentasData || []).map(v => {
        const productos = (v.venta_items || [])
          .map(item => item.productos?.nombre)
          .filter(Boolean)
          .slice(0, 2)
          .join(', ');

        const masProductos = v.venta_items.length > 2 ? ` +${v.venta_items.length - 2}` : '';

        return {
          id: v.id,
          productos: productos + masProductos || 'Sin productos',
          fecha: v.fecha,
          total: v.total
        };
      });

      // Últimas 5 compras con nombre de productos
      const { data: ultimasComprasData } = await supabase
        .from('compras')
        .select(`
          id,
          fecha,
          total,
          compra_items (
            cantidad,
            productos (nombre)
          )
        `)
        .order('fecha', { ascending: false })
        .limit(5);

      const ultimas_compras = (ultimasComprasData || []).map(c => {
        const productos = (c.compra_items || [])
          .map(item => item.productos?.nombre)
          .filter(Boolean)
          .slice(0, 2)
          .join(', ');

        const masProductos = c.compra_items.length > 2 ? ` +${c.compra_items.length - 2}` : '';

        return {
          id: c.id,
          productos: productos + masProductos || 'Sin productos',
          fecha: c.fecha,
          total: c.total
        };
      });

      setData({
        inventario,
        estadisticas_semana,
        alertas_stock_bajo,
        grafico_ventas,
        ultimas_ventas,
        ultimas_compras
      });

    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Error al cargar el dashboard
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm md:text-base"
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
            Configurar Tarjetas
          </button>
          <button
            onClick={loadDashboard}
            className="flex items-center justify-center px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm md:text-base"
          >
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6">
        {AVAILABLE_CARDS.filter(card => visibleCards.includes(card.id)).map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4"
              style={{ borderLeftColor: card.color }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm md:text-base text-gray-600 mb-1">{card.label}</p>
                  <p className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800">{card.getValue(data)}</p>
                </div>
                <div className={`${card.bgColor} p-2 md:p-3 rounded-full`}>
                  <Icon className="w-6 h-6 md:w-8 md:h-8" style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Estadísticas de la Semana</h2>
            <TrendingUp className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Total Ventas</p>
                <p className="text-2xl font-bold text-green-700">{formatGuaranies(data.estadisticas_semana.total_ventas)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Cantidad</p>
                <p className="text-xl font-semibold text-gray-800">{data.estadisticas_semana.cantidad_ventas}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Total Compras</p>
                <p className="text-2xl font-bold text-blue-700">{formatGuaranies(data.estadisticas_semana.total_compras)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Cantidad</p>
                <p className="text-xl font-semibold text-gray-800">{data.estadisticas_semana.cantidad_compras}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Alertas de Stock Bajo</h2>
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.alertas_stock_bajo.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No hay alertas de stock bajo</p>
            ) : (
              data.alertas_stock_bajo.map((alerta) => (
                <div key={alerta.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">{alerta.nombre}</p>
                      <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-mono rounded">
                        {alerta.codigo}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Tipo: {alerta.tipo}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm text-red-600 font-semibold">Stock: {alerta.stock_actual}</p>
                    <p className="text-xs text-gray-500">Mínimo: {alerta.stock_minimo}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Comparativa de Ventas
            {tipoComparativa === 'diaria' && ' (Últimos 7 días)'}
            {tipoComparativa === 'semanal' && ' (Semanal)'}
            {tipoComparativa === 'mensual' && ' (Mensual)'}
          </h2>
          <select
            value={tipoComparativa}
            onChange={(e) => setTipoComparativa(e.target.value as TipoComparativa)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="diaria">Por Días</option>
            <option value="semanal">Por Semana</option>
            <option value="mensual">Por Mes</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.grafico_ventas}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="periodo" />
            <YAxis />
            <Tooltip formatter={(value) => formatGuaranies(value as number)} />
            <Legend />
            <Bar dataKey="actual" fill="#4f46e5" name={
              tipoComparativa === 'diaria' ? 'Últimos 7 días' :
              tipoComparativa === 'semanal' ? 'Esta semana' :
              'Este mes'
            } />
            <Bar dataKey="anterior" fill="#94a3b8" name={
              tipoComparativa === 'diaria' ? '7 días anteriores' :
              tipoComparativa === 'semanal' ? 'Semana anterior' :
              'Mes anterior'
            } />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Últimas Ventas</h2>
            <ShoppingCart className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.ultimas_ventas.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No hay ventas recientes</p>
            ) : (
              data.ultimas_ventas.map((venta) => (
                <div key={venta.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{venta.productos}</p>
                    <p className="text-sm text-gray-600">{new Date(venta.fecha).toLocaleString('es-PY')}</p>
                  </div>
                  <p className="font-bold text-green-600 ml-3">{formatGuaranies(venta.total)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Últimas Compras</h2>
            <Package className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.ultimas_compras.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No hay compras recientes</p>
            ) : (
              data.ultimas_compras.map((compra) => (
                <div key={compra.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{compra.productos}</p>
                    <p className="text-sm text-gray-600">{new Date(compra.fecha).toLocaleString('es-PY')}</p>
                  </div>
                  <p className="font-bold text-blue-600 ml-3">{formatGuaranies(compra.total)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de Configuración de Tarjetas */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Configurar Tarjetas</h2>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">Selecciona las tarjetas que deseas mostrar en el dashboard:</p>
                {AVAILABLE_CARDS.map(card => {
                  const Icon = card.icon;
                  const isSelected = visibleCards.includes(card.id);
                  return (
                    <div
                      key={card.id}
                      onClick={() => toggleCard(card.id)}
                      className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition"
                      style={{
                        borderColor: isSelected ? card.color : '#e5e7eb'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                      />
                      <div className={`${card.bgColor} p-2 rounded-lg`}>
                        <Icon className="w-6 h-6" style={{ color: card.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{card.label}</p>
                        <p className="text-xs text-gray-500">
                          {card.id === 'total_productos' && 'Cantidad total de productos activos'}
                          {card.id === 'stock_unidades' && 'Total de unidades en stock'}
                          {card.id === 'stock_paquetes' && 'Total de paquetes en stock'}
                          {card.id === 'stock_kg' && 'Total de kilogramos en stock'}
                          {card.id === 'ropa_calzado' && 'Cantidad de productos de ropa y calzado'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
