export type RoleName =
  | 'Administrador'
  | 'Supervisor'
  | 'Vendedor'
  | 'Comprador'
  | 'Almacen'
  | 'Caja'
  | 'Consulta';

export interface Rol {
  id: string;
  nombre: RoleName;
  descripcion: string | null;
  permisos: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Usuario {
  id: string;
  rol_id: string | null;
  nombre: string;
  email: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  rol?: Rol | null;
}

export interface Cliente {
  id: string;
  nombre: string;
  tipo_documento: string;
  numero_documento: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  limite_credito: number;
  saldo: number;
  condiciones_pago: string | null;
  contacto: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  numero_documento: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  condiciones_comerciales: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface Marca {
  id: string;
  nombre: string;
}

export interface Producto {
  id: string;
  sku: string;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  categoria_id: string | null;
  marca_id: string | null;
  unidad: string;
  costo: number;
  precio: number;
  stock: number;
  stock_minimo: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
  categoria?: Categoria | null;
  marca?: Marca | null;
}

export interface InventarioMovimiento {
  id: string;
  producto_id: string;
  tipo_movimiento: string;
  cantidad: number;
  stock_resultante: number;
  motivo: string | null;
  documento_tipo: string | null;
  documento_id: string | null;
  created_at: string;
  created_by: string | null;
  producto?: Producto | null;
}

export interface Compra {
  id: string;
  numero: string;
  proveedor_id: string;
  fecha: string;
  estado: string;
  subtotal: number;
  igv: number;
  total: number;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  proveedor?: Proveedor | null;
  detalle?: DetalleCompra[];
}

export interface DetalleCompra {
  id: string;
  compra_id: string;
  producto_id: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
  producto?: Producto | null;
}

export type VentaEstado =
  | 'PENDIENTE'
  | 'PENDIENTE_ENTREGA'
  | 'ENTREGADA'
  | 'PARCIALMENTE_PAGADA'
  | 'PAGADA'
  | 'POR_COBRAR'
  | 'CANCELADA';

export interface Venta {
  id: string;
  numero: string;
  cliente_id: string;
  vendedor_id: string | null;
  fecha: string;
  estado: VentaEstado;
  tipo: string;
  subtotal: number;
  igv: number;
  total: number;
  monto_pagado: number;
  saldo: number;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  cliente?: Cliente | null;
  vendedor?: { id: string; nombre: string; email: string } | null;
  detalle?: DetalleVenta[];
  entregas?: Entrega[];
  pagos?: PagoVenta[];
}

export interface DetalleVenta {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  subtotal: number;
  producto?: Producto | null;
}

export interface Entrega {
  id: string;
  venta_id: string;
  confirmado_por: string | null;
  fecha_entrega: string | null;
  direccion_entrega: string | null;
  evidencia_tipo: string | null;
  evidencia_url: string | null;
  evidencia_nota: string | null;
  estado: string;
  created_at: string;
  updated_at: string;
  confirmado_por_usuario?: { id: string; nombre: string; email: string } | null;
}

export interface PagoVenta {
  id: string;
  venta_id: string;
  monto: number;
  metodo: string;
  fecha_pago: string;
  referencia: string | null;
  created_at: string;
  created_by: string | null;
}

export interface CuentaPorCobrar {
  id: string;
  venta_id: string;
  cliente_id: string;
  monto_total: number;
  monto_pagado: number;
  saldo: number;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  estado: string;
  dias_mora: number;
  created_at: string;
  updated_at: string;
  cliente?: Cliente | null;
  venta?: { id: string; numero: string } | null;
}

export interface Auditoria {
  id: string;
  usuario_id: string | null;
  modulo: string;
  accion: string;
  tabla_afectada: string | null;
  registro_id: string | null;
  valor_previo: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
  fecha: string;
  ip: string | null;
  usuario?: { id: string; nombre: string; email: string } | null;
}
