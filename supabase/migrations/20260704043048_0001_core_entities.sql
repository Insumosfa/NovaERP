/*
# Core Entities: Roles, Users, Clients, Suppliers, Products, Inventory

## Purpose
Foundation tables for the ERP system. Establishes role-based access control,
master data for clients and suppliers, the product catalog, and inventory
movement tracking (kardex).

## New Tables

### roles
- `id` (uuid PK): Role identifier.
- `nombre` (text, unique): Role name (Administrador, Supervisor, Vendedor, Comprador, Almacen, Caja, Consulta).
- `descripcion` (text): Optional description.
- `permisos` (jsonb): Granular permissions per module.
- `created_at` / `updated_at` (timestamptz): Control fields.

### usuarios
- `id` (uuid PK): Mirrors `auth.users.id` (one-to-one with auth).
- `rol_id` (uuid FK -> roles): Assigned role.
- `nombre` (text): Full name.
- `email` (text, unique): Login email.
- `activo` (boolean): Active/locked status (session blocking).
- `created_at` / `updated_at` (timestamptz): Control fields.

### clientes
- `id` (uuid PK): Customer identifier.
- `nombre` (text): Business or contact name.
- `tipo_documento` (text): RUC/DNI/CE.
- `numero_documento` (text, unique): Tax ID.
- `direccion` (text): Address.
- `telefono` (text): Phone.
- `email` (text): Email.
- `limite_credito` (numeric): Credit limit.
- `saldo` (numeric): Current outstanding balance.
- `condiciones_pago` (text): Payment terms.
- `contacto` (text): Contact person.
- `activo` (boolean): Active status.
- `created_at` / `updated_at` / `created_by` / `updated_by`: Control fields.

### proveedores
- `id` (uuid PK): Supplier identifier.
- `nombre` (text): Business name.
- `numero_documento` (text, unique): Tax ID.
- `direccion` (text): Address.
- `telefono` (text): Phone.
- `email` (text): Email.
- `contacto` (text): Contact person.
- `condiciones_comerciales` (text): Commercial terms.
- `activo` (boolean): Active status.
- `created_at` / `updated_at` / `created_by` / `updated_by`: Control fields.

### categorias
- `id` (uuid PK): Category identifier.
- `nombre` (text, unique): Category name.
- `descripcion` (text): Description.

### marcas
- `id` (uuid PK): Brand identifier.
- `nombre` (text, unique): Brand name.

### productos
- `id` (uuid PK): Product identifier.
- `sku` (text, unique): Internal code.
- `codigo_barras` (text, unique): Barcode.
- `nombre` (text): Product name.
- `descripcion` (text): Description.
- `categoria_id` (uuid FK -> categorias): Category.
- `marca_id` (uuid FK -> marcas): Brand.
- `unidad` (text): Unit of measure (UND, KG, LT).
- `costo` (numeric): Last cost.
- `precio` (numeric): Sale price.
- `stock` (numeric): Current stock.
- `stock_minimo` (numeric): Reorder point.
- `activo` (boolean): Active status.
- `created_at` / `updated_at` / `created_by` / `updated_by`: Control fields.

### inventario_movimientos
- `id` (uuid PK): Movement identifier.
- `producto_id` (uuid FK -> productos): Product.
- `tipo_movimiento` (text): ENTRADA, SALIDA, AJUSTE, DEVOLUCION.
- `cantidad` (numeric): Quantity (positive for in, negative for out).
- `stock_resultante` (numeric): Stock after movement (trazabilidad).
- `motivo` (text): Reason / reference.
- `documento_tipo` (text): COMPRA, VENTA, AJUSTE, DEVOLUCION_PROV, DEVOLUCION_CLI.
- `documento_id` (uuid): Reference document ID.
- `created_at` / `created_by`: Control fields.

## Security
- RLS enabled on all tables.
- Policies scoped to `authenticated` (this app has a sign-in screen).
- Owner-scoped where applicable; role-based access is enforced at the application layer via the `usuarios` table.
- `inventario_movimientos` is append-only (no UPDATE/DELETE policies) to preserve kardex integrity.
*/

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  descripcion text,
  permisos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_roles" ON roles;
CREATE POLICY "auth_select_roles" ON roles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_roles" ON roles;
CREATE POLICY "auth_insert_roles" ON roles FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_roles" ON roles;
CREATE POLICY "auth_update_roles" ON roles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- USUARIOS (profile table linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol_id uuid REFERENCES roles(id),
  nombre text NOT NULL,
  email text UNIQUE NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_usuarios" ON usuarios;
CREATE POLICY "auth_select_usuarios" ON usuarios FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_usuarios" ON usuarios;
CREATE POLICY "auth_insert_usuarios" ON usuarios FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_usuarios" ON usuarios;
CREATE POLICY "auth_update_usuarios" ON usuarios FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo_documento text NOT NULL DEFAULT 'RUC',
  numero_documento text UNIQUE,
  direccion text,
  telefono text,
  email text,
  limite_credito numeric(14,2) NOT NULL DEFAULT 0,
  saldo numeric(14,2) NOT NULL DEFAULT 0,
  condiciones_pago text,
  contacto text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_clientes" ON clientes;
CREATE POLICY "auth_select_clientes" ON clientes FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_clientes" ON clientes;
CREATE POLICY "auth_insert_clientes" ON clientes FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_clientes" ON clientes;
CREATE POLICY "auth_update_clientes" ON clientes FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_clientes" ON clientes;
CREATE POLICY "auth_delete_clientes" ON clientes FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- PROVEEDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  numero_documento text UNIQUE,
  direccion text,
  telefono text,
  email text,
  contacto text,
  condiciones_comerciales text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_proveedores" ON proveedores;
CREATE POLICY "auth_select_proveedores" ON proveedores FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_proveedores" ON proveedores;
CREATE POLICY "auth_insert_proveedores" ON proveedores FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_proveedores" ON proveedores;
CREATE POLICY "auth_update_proveedores" ON proveedores FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_proveedores" ON proveedores;
CREATE POLICY "auth_delete_proveedores" ON proveedores FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- CATEGORIAS & MARCAS
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_categorias" ON categorias;
CREATE POLICY "auth_select_categorias" ON categorias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_categorias" ON categorias;
CREATE POLICY "auth_insert_categorias" ON categorias FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_categorias" ON categorias;
CREATE POLICY "auth_update_categorias" ON categorias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_categorias" ON categorias;
CREATE POLICY "auth_delete_categorias" ON categorias FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_marcas" ON marcas;
CREATE POLICY "auth_select_marcas" ON marcas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_marcas" ON marcas;
CREATE POLICY "auth_insert_marcas" ON marcas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_marcas" ON marcas;
CREATE POLICY "auth_update_marcas" ON marcas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_marcas" ON marcas;
CREATE POLICY "auth_delete_marcas" ON marcas FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PRODUCTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  codigo_barras text UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  categoria_id uuid REFERENCES categorias(id),
  marca_id uuid REFERENCES marcas(id),
  unidad text NOT NULL DEFAULT 'UND',
  costo numeric(14,2) NOT NULL DEFAULT 0,
  precio numeric(14,2) NOT NULL DEFAULT 0,
  stock numeric(14,2) NOT NULL DEFAULT 0,
  stock_minimo numeric(14,2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_productos" ON productos;
CREATE POLICY "auth_select_productos" ON productos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_productos" ON productos;
CREATE POLICY "auth_insert_productos" ON productos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_productos" ON productos;
CREATE POLICY "auth_update_productos" ON productos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_productos" ON productos;
CREATE POLICY "auth_delete_productos" ON productos FOR DELETE TO authenticated USING (true);

-- ============================================================
-- INVENTARIO MOVIMIENTOS (Kardex - append only)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  tipo_movimiento text NOT NULL,
  cantidad numeric(14,2) NOT NULL,
  stock_resultante numeric(14,2) NOT NULL,
  motivo text,
  documento_tipo text,
  documento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE inventario_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_inventario_mov" ON inventario_movimientos;
CREATE POLICY "auth_select_inventario_mov" ON inventario_movimientos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_inventario_mov" ON inventario_movimientos;
CREATE POLICY "auth_insert_inventario_mov" ON inventario_movimientos FOR INSERT TO authenticated WITH CHECK (true);
-- No UPDATE or DELETE policies: kardex is append-only (no physical deletes per business rules).

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(numero_documento);
CREATE INDEX IF NOT EXISTS idx_proveedores_documento ON proveedores(numero_documento);
CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_inventario_mov_producto ON inventario_movimientos(producto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventario_mov_documento ON inventario_movimientos(documento_tipo, documento_id);

-- ============================================================
-- SEED ROLES
-- ============================================================
INSERT INTO roles (nombre, descripcion, permisos) VALUES
  ('Administrador', 'Acceso total al sistema', '{"all": true}'::jsonb),
  ('Supervisor', 'Supervisa operaciones y autoriza modificaciones', '{"ventas": true, "compras": true, "inventario": true, "reportes": true, "auditoria": true}'::jsonb),
  ('Vendedor', 'Registra ventas y cotizaciones', '{"ventas": true, "clientes": true, "productos": "read"}'::jsonb),
  ('Comprador', 'Registra compras y gestiona proveedores', '{"compras": true, "proveedores": true, "productos": true}'::jsonb),
  ('Almacen', 'Controla inventario y confirma entregas', '{"inventario": true, "entregas": true, "productos": "read"}'::jsonb),
  ('Caja', 'Cobra y registra pagos', '{"cobranza": true, "ventas": "read"}'::jsonb),
  ('Consulta', 'Solo lectura de reportes', '{"reportes": true, "dashboard": true}'::jsonb)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- TRIGGER: sync usuarios on auth user creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at auto-update function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_roles_updated ON roles;
CREATE TRIGGER trg_roles_updated BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_usuarios_updated ON usuarios;
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clientes_updated ON clientes;
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_proveedores_updated ON proveedores;
CREATE TRIGGER trg_proveedores_updated BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_productos_updated ON productos;
CREATE TRIGGER trg_productos_updated BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
