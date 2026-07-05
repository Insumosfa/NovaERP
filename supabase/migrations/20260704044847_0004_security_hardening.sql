-- =============================================================
-- Security Hardening Migration
-- 1. Fix mutable search_path on set_updated_at()
-- 2. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated
-- 3. Replace all USING(true)/WITH CHECK(true) RLS policies with real membership checks
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Fix set_updated_at() — add immutable search_path
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------
-- 2. Fix handle_new_user() — add search_path, revoke EXECUTE
--    (trigger function only called by auth trigger, not REST)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ---------------------------------------------------------------
-- 3. Fix nextval_wrapper() — add search_path, revoke from anon
--    (keep authenticated since frontend calls it after sign-in)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nextval_wrapper(seq_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN nextval(pg_catalog.format('%I.%I', 'public', seq_name));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nextval_wrapper(text) FROM anon;

-- ---------------------------------------------------------------
-- 4. Replace all RLS policies with real membership checks
--    Pattern: active authenticated user exists
--    Admin-only DELETE on roles, usuarios
-- ---------------------------------------------------------------

-- Helper: we inline the predicate rather than create a separate function
-- to avoid another SECURITY DEFINER surface.

-- ============ roles ============
DROP POLICY IF EXISTS "auth_select_roles" ON roles;
CREATE POLICY "auth_select_roles" ON roles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_roles" ON roles;
CREATE POLICY "auth_insert_roles" ON roles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true AND u.rol_id IN (SELECT id FROM public.roles WHERE nombre = 'Administrador')));

DROP POLICY IF EXISTS "auth_update_roles" ON roles;
CREATE POLICY "auth_update_roles" ON roles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true AND u.rol_id IN (SELECT id FROM public.roles WHERE nombre = 'Administrador')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true AND u.rol_id IN (SELECT id FROM public.roles WHERE nombre = 'Administrador')));

DROP POLICY IF EXISTS "auth_delete_roles" ON roles;
CREATE POLICY "auth_delete_roles" ON roles
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true AND u.rol_id IN (SELECT id FROM public.roles WHERE nombre = 'Administrador')));

-- ============ usuarios ============
DROP POLICY IF EXISTS "auth_select_usuarios" ON usuarios;
CREATE POLICY "auth_select_usuarios" ON usuarios
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_usuarios" ON usuarios;
CREATE POLICY "auth_insert_usuarios" ON usuarios
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true AND u.rol_id IN (SELECT id FROM public.roles WHERE nombre = 'Administrador')));

DROP POLICY IF EXISTS "auth_update_usuarios" ON usuarios;
CREATE POLICY "auth_update_usuarios" ON usuarios
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true AND u.rol_id IN (SELECT id FROM public.roles WHERE nombre = 'Administrador')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true AND u.rol_id IN (SELECT id FROM public.roles WHERE nombre = 'Administrador')));

DROP POLICY IF EXISTS "auth_delete_usuarios" ON usuarios;
CREATE POLICY "auth_delete_usuarios" ON usuarios
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true AND u.rol_id IN (SELECT id FROM public.roles WHERE nombre = 'Administrador')));

-- ============ clientes ============
DROP POLICY IF EXISTS "auth_select_clientes" ON clientes;
CREATE POLICY "auth_select_clientes" ON clientes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_clientes" ON clientes;
CREATE POLICY "auth_insert_clientes" ON clientes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_clientes" ON clientes;
CREATE POLICY "auth_update_clientes" ON clientes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_clientes" ON clientes;
CREATE POLICY "auth_delete_clientes" ON clientes
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ proveedores ============
DROP POLICY IF EXISTS "auth_select_proveedores" ON proveedores;
CREATE POLICY "auth_select_proveedores" ON proveedores
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_proveedores" ON proveedores;
CREATE POLICY "auth_insert_proveedores" ON proveedores
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_proveedores" ON proveedores;
CREATE POLICY "auth_update_proveedores" ON proveedores
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_proveedores" ON proveedores;
CREATE POLICY "auth_delete_proveedores" ON proveedores
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ categorias ============
DROP POLICY IF EXISTS "auth_select_categorias" ON categorias;
CREATE POLICY "auth_select_categorias" ON categorias
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_categorias" ON categorias;
CREATE POLICY "auth_insert_categorias" ON categorias
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_categorias" ON categorias;
CREATE POLICY "auth_update_categorias" ON categorias
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_categorias" ON categorias;
CREATE POLICY "auth_delete_categorias" ON categorias
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ marcas ============
DROP POLICY IF EXISTS "auth_select_marcas" ON marcas;
CREATE POLICY "auth_select_marcas" ON marcas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_marcas" ON marcas;
CREATE POLICY "auth_insert_marcas" ON marcas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_marcas" ON marcas;
CREATE POLICY "auth_update_marcas" ON marcas
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_marcas" ON marcas;
CREATE POLICY "auth_delete_marcas" ON marcas
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ productos ============
DROP POLICY IF EXISTS "auth_select_productos" ON productos;
CREATE POLICY "auth_select_productos" ON productos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_productos" ON productos;
CREATE POLICY "auth_insert_productos" ON productos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_productos" ON productos;
CREATE POLICY "auth_update_productos" ON productos
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_productos" ON productos;
CREATE POLICY "auth_delete_productos" ON productos
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ inventario_movimientos ============
DROP POLICY IF EXISTS "auth_select_inventario_movimientos" ON inventario_movimientos;
CREATE POLICY "auth_select_inventario_movimientos" ON inventario_movimientos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_inventario_movimientos" ON inventario_movimientos;
CREATE POLICY "auth_insert_inventario_movimientos" ON inventario_movimientos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ compras ============
DROP POLICY IF EXISTS "auth_select_compras" ON compras;
CREATE POLICY "auth_select_compras" ON compras
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_compras" ON compras;
CREATE POLICY "auth_insert_compras" ON compras
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_compras" ON compras;
CREATE POLICY "auth_update_compras" ON compras
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_compras" ON compras;
CREATE POLICY "auth_delete_compras" ON compras
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ detalle_compras ============
DROP POLICY IF EXISTS "auth_select_detalle_compras" ON detalle_compras;
CREATE POLICY "auth_select_detalle_compras" ON detalle_compras
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_detalle_compras" ON detalle_compras;
CREATE POLICY "auth_insert_detalle_compras" ON detalle_compras
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_detalle_compras" ON detalle_compras;
CREATE POLICY "auth_update_detalle_compras" ON detalle_compras
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_detalle_compras" ON detalle_compras;
CREATE POLICY "auth_delete_detalle_compras" ON detalle_compras
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ ventas ============
DROP POLICY IF EXISTS "auth_select_ventas" ON ventas;
CREATE POLICY "auth_select_ventas" ON ventas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_ventas" ON ventas;
CREATE POLICY "auth_insert_ventas" ON ventas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_ventas" ON ventas;
CREATE POLICY "auth_update_ventas" ON ventas
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_ventas" ON ventas;
CREATE POLICY "auth_delete_ventas" ON ventas
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ detalle_ventas ============
DROP POLICY IF EXISTS "auth_select_detalle_ventas" ON detalle_ventas;
CREATE POLICY "auth_select_detalle_ventas" ON detalle_ventas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_detalle_ventas" ON detalle_ventas;
CREATE POLICY "auth_insert_detalle_ventas" ON detalle_ventas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_detalle_ventas" ON detalle_ventas;
CREATE POLICY "auth_update_detalle_ventas" ON detalle_ventas
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_detalle_ventas" ON detalle_ventas;
CREATE POLICY "auth_delete_detalle_ventas" ON detalle_ventas
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ entregas_ventas ============
DROP POLICY IF EXISTS "auth_select_entregas_ventas" ON entregas_ventas;
CREATE POLICY "auth_select_entregas_ventas" ON entregas_ventas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_entregas_ventas" ON entregas_ventas;
CREATE POLICY "auth_insert_entregas_ventas" ON entregas_ventas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_entregas_ventas" ON entregas_ventas;
CREATE POLICY "auth_update_entregas_ventas" ON entregas_ventas
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_entregas_ventas" ON entregas_ventas;
CREATE POLICY "auth_delete_entregas_ventas" ON entregas_ventas
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ pagos_ventas ============
DROP POLICY IF EXISTS "auth_select_pagos_ventas" ON pagos_ventas;
CREATE POLICY "auth_select_pagos_ventas" ON pagos_ventas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_pagos_ventas" ON pagos_ventas;
CREATE POLICY "auth_insert_pagos_ventas" ON pagos_ventas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_pagos_ventas" ON pagos_ventas;
CREATE POLICY "auth_update_pagos_ventas" ON pagos_ventas
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_pagos_ventas" ON pagos_ventas;
CREATE POLICY "auth_delete_pagos_ventas" ON pagos_ventas
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ cuentas_por_cobrar ============
DROP POLICY IF EXISTS "auth_select_cuentas_por_cobrar" ON cuentas_por_cobrar;
CREATE POLICY "auth_select_cuentas_por_cobrar" ON cuentas_por_cobrar
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_cuentas_por_cobrar" ON cuentas_por_cobrar;
CREATE POLICY "auth_insert_cuentas_por_cobrar" ON cuentas_por_cobrar
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_update_cuentas_por_cobrar" ON cuentas_por_cobrar;
CREATE POLICY "auth_update_cuentas_por_cobrar" ON cuentas_por_cobrar
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_delete_cuentas_por_cobrar" ON cuentas_por_cobrar;
CREATE POLICY "auth_delete_cuentas_por_cobrar" ON cuentas_por_cobrar
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

-- ============ auditoria (append-only: SELECT + INSERT only) ============
DROP POLICY IF EXISTS "auth_select_auditoria" ON auditoria;
CREATE POLICY "auth_select_auditoria" ON auditoria
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));

DROP POLICY IF EXISTS "auth_insert_auditoria" ON auditoria;
CREATE POLICY "auth_insert_auditoria" ON auditoria
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.activo = true));
