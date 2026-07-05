import type { RoleName } from './types';

export type Module =
  | 'dashboard'
  | 'clientes'
  | 'proveedores'
  | 'productos'
  | 'inventario'
  | 'compras'
  | 'ventas'
  | 'entregas'
  | 'cobranza'
  | 'cuentas_por_cobrar'
  | 'auditoria'
  | 'reportes'
  | 'usuarios';

const FULL: Module[] = [
  'dashboard', 'clientes', 'proveedores', 'productos', 'inventario',
  'compras', 'ventas', 'entregas', 'cobranza', 'cuentas_por_cobrar',
  'auditoria', 'reportes', 'usuarios',
];

const ACCESS: Record<RoleName, Module[]> = {
  Administrador: FULL,
  Supervisor: ['dashboard', 'clientes', 'proveedores', 'productos', 'inventario', 'compras', 'ventas', 'entregas', 'cobranza', 'cuentas_por_cobrar', 'auditoria', 'reportes'],
  Vendedor: ['dashboard', 'clientes', 'productos', 'ventas'],
  Comprador: ['dashboard', 'proveedores', 'productos', 'inventario', 'compras'],
  Almacen: ['dashboard', 'productos', 'inventario', 'entregas'],
  Caja: ['dashboard', 'cobranza', 'cuentas_por_cobrar', 'ventas'],
  Consulta: ['dashboard', 'reportes'],
};

export function canAccess(role: RoleName | undefined | null, module: Module): boolean {
  if (!role) return false;
  return ACCESS[role]?.includes(module) ?? false;
}

export function moduleLabel(m: Module): string {
  const labels: Record<Module, string> = {
    dashboard: 'Dashboard',
    clientes: 'Clientes',
    proveedores: 'Proveedores',
    productos: 'Productos',
    inventario: 'Inventario',
    compras: 'Compras',
    ventas: 'Ventas',
    entregas: 'Entregas',
    cobranza: 'Cobranza',
    cuentas_por_cobrar: 'Cuentas por Cobrar',
    auditoria: 'Auditoría',
    reportes: 'Reportes',
    usuarios: 'Usuarios',
  };
  return labels[m];
}
