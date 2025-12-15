export interface UserProfile {
  id: string;
  full_name: string;
  nombre_usuario?: string;
  role_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role?: Role;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: any;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  notas?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo: 'unidad' | 'paquete' | 'peso';
  pesable: boolean;
  peso_por_unidad?: number;
  unidades_por_paquete?: number;
  precio_compra?: number;
  precio_venta_unidad?: number;
  precio_venta_paquete?: number;
  precio_venta_kg?: number;
  precio_mayorista_unidad?: number;
  precio_mayorista_paquete?: number;
  precio_mayorista_kg?: number;
  stock_unidades: number;
  stock_paquetes: number;
  stock_kg: number;
  stock_minimo: number;
  proveedor_principal_id?: string;
  categoria_id?: string;
  es_ropa_calzado?: boolean;
  talle?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  proveedor_principal?: Proveedor;
  categoria?: Categoria;
}

export interface ProductoProveedor {
  id: string;
  producto_id: string;
  proveedor_id: string;
  precio_proveedor_unidad?: number;
  precio_proveedor_paquete?: number;
  precio_proveedor_kg?: number;
  is_principal: boolean;
  created_at: string;
  updated_at: string;
  producto?: Producto;
  proveedor?: Proveedor;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  notas?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Venta {
  id: string;
  numero_venta: string;
  fecha: string;
  vendedor_id: string;
  total: number;
  tipo_pago: string;
  notas?: string;
  created_at: string;
  cliente_id?: string;
  es_fiado: boolean;
  monto_pagado: number;
  desconto_stock?: boolean;
  fiado_completado: boolean;
  es_mayorista: boolean;
  venta_origen_id?: string;
  dinero_recibido?: number;
  vuelto?: number;
  cliente?: Cliente;
  vendedor?: UserProfile;
}

export interface VentaItem {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  unidad_medida: 'unidad' | 'paquete' | 'kg';
  precio_unitario: number;
  subtotal: number;
  created_at: string;
  producto?: Producto;
}

export interface Compra {
  id: string;
  numero_compra: string;
  fecha: string;
  proveedor_id: string;
  total: number;
  actualizar_precios: boolean;
  notas?: string;
  registrado_por: string;
  created_at: string;
  proveedor?: Proveedor;
}

export interface CompraItem {
  id: string;
  compra_id: string;
  producto_id: string;
  cantidad: number;
  unidad_medida: 'unidad' | 'paquete' | 'kg';
  precio_unitario: number;
  subtotal: number;
  created_at: string;
  producto?: Producto;
}

export interface AjusteInventario {
  id: string;
  producto_id: string;
  tipo_ajuste: 'entrada' | 'salida' | 'apertura_paquete';
  cantidad_anterior: number;
  cantidad_ajuste: number;
  cantidad_nueva: number;
  unidad_medida: 'unidad' | 'paquete' | 'kg';
  razon: string;
  realizado_por: string;
  created_at: string;
  producto?: Producto;
}

export interface DashboardData {
  inventario: {
    total_unidades: number;
    total_paquetes: number;
    total_kg: number;
    total_productos: number;
  };
  alertas_stock_bajo: Array<{
    id: string;
    nombre: string;
    stock_actual: number;
    stock_minimo: number;
    tipo: string;
  }>;
  ultimas_ventas: Venta[];
  ultimas_compras: Compra[];
  estadisticas_semana: {
    total_ventas: number;
    total_compras: number;
    cantidad_ventas: number;
    cantidad_compras: number;
  };
  grafico_ventas: Array<{
    fecha: string;
    total: number;
  }>;
}

export interface Operacion {
  id: string;
  venta_id: string;
  tipo_operacion: 'anulacion_completa' | 'anulacion_parcial' | 'cancelacion_fiado' | 'conversion_fiado' | 'abono_parcial';
  items_anulados: any;
  total_anulado: number;
  motivo?: string;
  anulado_por: string;
  created_at: string;
  cliente_id?: string;
  monto_operacion?: number;
  venta?: Venta;
  cliente?: Cliente;
  usuario?: UserProfile;
}

export interface CartItem {
  id: string;
  producto: Producto;
  cantidad: number;
  tipo: 'unidad' | 'paquete' | 'kg';
  precio_unitario: number;
  es_mayorista?: boolean;
}

export interface TicketConfig {
  id: string;
  nombre_empresa: string;
  encabezado?: string;
  pie_pagina?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
