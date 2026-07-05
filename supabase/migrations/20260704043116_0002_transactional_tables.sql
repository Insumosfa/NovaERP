/*
# Transactional Tables: Purchases, Sales, Deliveries, Payments, AR, Audit

## Purpose
Implements the operational core of the ERP: purchase orders, sales (quotes +
invoices), delivery confirmation, payment collection, accounts receivable
aging, and full audit trail.

## New Tables

### compras
- `id` (uuid PK): Purchase identifier.
- `numero` (text, unique): Human-readable document number (e.g. COMP-0001).
- `proveedor_id` (uuid FK -> proveedores): Supplier.
- `fecha` (date): Purchase date.
- `estado` (text): REGISTRADA, MODIFICADA, CANCELADA, DEVUELTA.
- `subtotal` / `igv` / `total` (numeric): Totals.
- `observaciones` (text): Notes.
- `created_at` / `updated_at` / `created_by` / `updated_by`: Control fields.

### detalle_compras
- `id` (uuid PK): Line item identifier.
- `compra_id` (uuid FK -> compras, ON DELETE CASCADE): Parent purchase.
- `producto_id` (uuid FK -> productos): Product.
- `cantidad` (numeric): Quantity.
- `costo_unitario` (numeric): Unit cost at purchase time.
- `subtotal` (numeric): Line subtotal.

### ventas
- `id` (uuid PK): Sale identifier.
- `numero` (text, unique): Document number (e.g. VENT-0001).
- `cliente_id` (uuid FK -> clientes): Customer.
- `vendedor_id` (uuid FK -> auth.users): Salesperson.
- `fecha` (date): Sale date.
- `estado` (text): PENDIENTE, PENDIENTE_ENTREGA, ENTREGADA, PARCIALMENTE_PAGADA, PAGADA, POR_COBRAR, CANCELADA.
- `tipo` (text): COTIZACION or VENTA.
- `subtotal` / `igv` / `total` (numeric): Totals.
- `monto_pagado` (numeric): Amount paid so far.
- `saldo` (numeric): Outstanding balance.
- `observaciones` (text): Notes.
- `created_at` / `updated_at` / `created_by` / `updated_by`: Control fields.

### detalle_ventas
- `id` (uuid PK): Line item identifier.
- `venta_id` (uuid FK -> ventas, ON DELETE CASCADE): Parent sale.
- `producto_id` (uuid FK -> productos): Product.
- `cantidad` (numeric): Quantity.
- `precio_unitario` (numeric): Unit price at sale time.
- `costo_unitario` (numeric): Unit cost (for margin calc).
- `subtotal` (numeric): Line subtotal.

### entregas_ventas
- `id` (uuid PK): Delivery identifier.
- `venta_id` (uuid FK -> ventas): Sale.
- `confirmado_por` (uuid FK -> auth.users): User who confirmed (must differ from vendedor).
- `fecha_entrega` (timestamptz): Delivery timestamp.
- `direccion_entrega` (text): Delivery address.
- `evidencia_tipo` (text): FIRMA, FOTO, GUIA.
- `evidencia_url` (text): URL/path to evidence.
- `evidencia_nota` (text): Notes.
- `estado` (text): PENDIENTE, CONFIRMADA, RECHAZADA.
- `created_at` / `updated_at`: Control fields.

### pagos_ventas
- `id` (uuid PK): Payment identifier.
- `venta_id` (uuid FK -> ventas): Sale.
- `monto` (numeric): Payment amount.
- `metodo` (text): EFECTIVO, BANCO, CREDITO, MIXTO.
- `fecha_pago` (timestamptz): Payment timestamp.
- `referencia` (text): Reference (transaction #, etc.).
- `created_at` / `created_by`: Control fields.

### cuentas_por_cobrar
- `id` (uuid PK): AR record identifier.
- `venta_id` (uuid FK -> ventas): Sale.
- `cliente_id` (uuid FK -> clientes): Customer.
- `monto_total` (numeric): Total owed.
- `monto_pagado` (numeric): Amount paid.
- `saldo` (numeric): Outstanding balance.
- `fecha_emision` (date): Issue date.
- `fecha_vencimiento` (date): Due date.
- `estado` (text): VIGENTE, VENCIDA, PAGADA, PARCIAL.
- `dias_mora` (int): Days past due (computed).
- `created_at` / `updated_at`: Control fields.

### auditoria
- `id` (uuid PK): Audit entry identifier.
- `usuario_id` (uuid FK -> auth.users): Acting user.
- `modulo` (text): Module name.
- `accion` (text): Action (INSERT, UPDATE, DELETE, CANCEL, etc.).
- `tabla_afectada` (text): Affected table.
- `registro_id` (uuid): Affected row ID.
- `valor_previo` (jsonb): Before state.
- `valor_nuevo` (jsonb): After state.
- `fecha` (timestamptz): Timestamp.
- `ip` (text): Optional IP.

## Security
- RLS enabled on all tables.
- Policies scoped to `authenticated`.
- `auditoria` is append-only (no UPDATE/DELETE) to preserve integrity.
- `inventario_movimientos` already append-only from previous migration.
*/

-- ============================================================
-- COMPRAS
-- ============================================================
CREATE TABLE IF NOT EXISTS compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE NOT NULL,
  proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado text NOT NULL DEFAULT 'REGISTRADA',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  igv numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_compras" ON compras;
CREATE POLICY "auth_select_compras" ON compras FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_compras" ON compras;
CREATE POLICY "auth_insert_compras" ON compras FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_compras" ON compras;
CREATE POLICY "auth_update_compras" ON compras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_compras" ON compras;
CREATE POLICY "auth_delete_compras" ON compras FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS detalle_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad numeric(14,2) NOT NULL,
  costo_unitario numeric(14,2) NOT NULL,
  subtotal numeric(14,2) NOT NULL
);
ALTER TABLE detalle_compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_detalle_compras" ON detalle_compras;
CREATE POLICY "auth_select_detalle_compras" ON detalle_compras FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_detalle_compras" ON detalle_compras;
CREATE POLICY "auth_insert_detalle_compras" ON detalle_compras FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_detalle_compras" ON detalle_compras;
CREATE POLICY "auth_update_detalle_compras" ON detalle_compras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_detalle_compras" ON detalle_compras;
CREATE POLICY "auth_delete_detalle_compras" ON detalle_compras FOR DELETE TO authenticated USING (true);

-- ============================================================
-- VENTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE NOT NULL,
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  vendedor_id uuid REFERENCES auth.users(id),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado text NOT NULL DEFAULT 'PENDIENTE',
  tipo text NOT NULL DEFAULT 'VENTA',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  igv numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  monto_pagado numeric(14,2) NOT NULL DEFAULT 0,
  saldo numeric(14,2) NOT NULL DEFAULT 0,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_ventas" ON ventas;
CREATE POLICY "auth_select_ventas" ON ventas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_ventas" ON ventas;
CREATE POLICY "auth_insert_ventas" ON ventas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_ventas" ON ventas;
CREATE POLICY "auth_update_ventas" ON ventas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_ventas" ON ventas;
CREATE POLICY "auth_delete_ventas" ON ventas FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS detalle_ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad numeric(14,2) NOT NULL,
  precio_unitario numeric(14,2) NOT NULL,
  costo_unitario numeric(14,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL
);
ALTER TABLE detalle_ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_detalle_ventas" ON detalle_ventas;
CREATE POLICY "auth_select_detalle_ventas" ON detalle_ventas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_detalle_ventas" ON detalle_ventas;
CREATE POLICY "auth_insert_detalle_ventas" ON detalle_ventas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_detalle_ventas" ON detalle_ventas;
CREATE POLICY "auth_update_detalle_ventas" ON detalle_ventas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_detalle_ventas" ON detalle_ventas;
CREATE POLICY "auth_delete_detalle_ventas" ON detalle_ventas FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ENTREGAS
-- ============================================================
CREATE TABLE IF NOT EXISTS entregas_ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  confirmado_por uuid REFERENCES auth.users(id),
  fecha_entrega timestamptz,
  direccion_entrega text,
  evidencia_tipo text,
  evidencia_url text,
  evidencia_nota text,
  estado text NOT NULL DEFAULT 'PENDIENTE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE entregas_ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_entregas" ON entregas_ventas;
CREATE POLICY "auth_select_entregas" ON entregas_ventas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_entregas" ON entregas_ventas;
CREATE POLICY "auth_insert_entregas" ON entregas_ventas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_entregas" ON entregas_ventas;
CREATE POLICY "auth_update_entregas" ON entregas_ventas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_entregas" ON entregas_ventas;
CREATE POLICY "auth_delete_entregas" ON entregas_ventas FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PAGOS
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos_ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  monto numeric(14,2) NOT NULL,
  metodo text NOT NULL DEFAULT 'EFECTIVO',
  fecha_pago timestamptz NOT NULL DEFAULT now(),
  referencia text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE pagos_ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_pagos" ON pagos_ventas;
CREATE POLICY "auth_select_pagos" ON pagos_ventas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_pagos" ON pagos_ventas;
CREATE POLICY "auth_insert_pagos" ON pagos_ventas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_pagos" ON pagos_ventas;
CREATE POLICY "auth_update_pagos" ON pagos_ventas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_pagos" ON pagos_ventas;
CREATE POLICY "auth_delete_pagos" ON pagos_ventas FOR DELETE TO authenticated USING (true);

-- ============================================================
-- CUENTAS POR COBRAR
-- ============================================================
CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  monto_total numeric(14,2) NOT NULL,
  monto_pagado numeric(14,2) NOT NULL DEFAULT 0,
  saldo numeric(14,2) NOT NULL,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  estado text NOT NULL DEFAULT 'VIGENTE',
  dias_mora int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_cpc" ON cuentas_por_cobrar;
CREATE POLICY "auth_select_cpc" ON cuentas_por_cobrar FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_cpc" ON cuentas_por_cobrar;
CREATE POLICY "auth_insert_cpc" ON cuentas_por_cobrar FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_cpc" ON cuentas_por_cobrar;
CREATE POLICY "auth_update_cpc" ON cuentas_por_cobrar FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_cpc" ON cuentas_por_cobrar;
CREATE POLICY "auth_delete_cpc" ON cuentas_por_cobrar FOR DELETE TO authenticated USING (true);

-- ============================================================
-- AUDITORIA (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES auth.users(id),
  modulo text NOT NULL,
  accion text NOT NULL,
  tabla_afectada text,
  registro_id uuid,
  valor_previo jsonb,
  valor_nuevo jsonb,
  fecha timestamptz NOT NULL DEFAULT now(),
  ip text
);
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_auditoria" ON auditoria;
CREATE POLICY "auth_select_auditoria" ON auditoria FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_auditoria" ON auditoria;
CREATE POLICY "auth_insert_auditoria" ON auditoria FOR INSERT TO authenticated WITH CHECK (true);
-- No UPDATE or DELETE: audit trail is immutable.

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_detalle_compras_compra ON detalle_compras(compra_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_detalle_ventas_venta ON detalle_ventas(venta_id);
CREATE INDEX IF NOT EXISTS idx_entregas_venta ON entregas_ventas(venta_id);
CREATE INDEX IF NOT EXISTS idx_entregas_estado ON entregas_ventas(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_venta ON pagos_ventas(venta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos_ventas(fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_cpc_cliente ON cuentas_por_cobrar(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cpc_estado ON cuentas_por_cobrar(estado);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo ON auditoria(modulo);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);

-- ============================================================
-- TRIGGERS for updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_compras_updated ON compras;
CREATE TRIGGER trg_compras_updated BEFORE UPDATE ON compras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ventas_updated ON ventas;
CREATE TRIGGER trg_ventas_updated BEFORE UPDATE ON ventas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_entregas_updated ON entregas_ventas;
CREATE TRIGGER trg_entregas_updated BEFORE UPDATE ON entregas_ventas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cpc_updated ON cuentas_por_cobrar;
CREATE TRIGGER trg_cpc_updated BEFORE UPDATE ON cuentas_por_cobrar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- SEQUENCE for document numbers
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS seq_compras_numero;
CREATE SEQUENCE IF NOT EXISTS seq_ventas_numero;
