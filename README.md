# NovaERP — Sistema de Administración Comercial

Sistema ERP completo para gestión comercial, construido con **React + TypeScript + Vite + Tailwind CSS + Supabase**.

## 🚀 Módulos

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | KPIs en tiempo real: ventas del mes, inventario, cartera, stock bajo |
| **Clientes** | CRUD completo, límite de crédito, historial de saldo |
| **Proveedores** | Registro y gestión de proveedores |
| **Productos** | Catálogo con SKU, categorías, marcas, precios y stock |
| **Inventario** | Kardex, valorización, tab Ajustes con historial real |
| **Compras** | Órdenes de compra con ingreso automático a inventario |
| **Ventas** | Ventas y cotizaciones con descuento de stock en tiempo real |
| **Entregas** | Confirmación por usuario distinto al vendedor, con evidencia |
| **Cobranza** | Registro de pagos, abonos y pagos mixtos por línea |
| **Cuentas por Cobrar** | Aging de cartera, días de mora, estado vigente/vencida |
| **Auditoría** | Bitácora completa de todas las acciones del sistema |
| **Reportes** | Ventas, compras, inventario, utilidades, cartera — exporta CSV |
| **Usuarios** | Gestión de usuarios y asignación de roles |

## 🔐 Roles

| Rol | Acceso |
|-----|--------|
| Administrador | Todo |
| Supervisor | Todo excepto usuarios |
| Vendedor | Dashboard, Clientes, Productos, Ventas |
| Comprador | Dashboard, Proveedores, Productos, Inventario, Compras |
| Almacén | Dashboard, Productos, Inventario, Entregas |
| Caja | Dashboard, Cobranza, CxC, Ventas |
| Consulta | Dashboard, Reportes |

## ⚙️ Stack técnico

- **Frontend**: React 18, TypeScript 5, Vite 5
- **Estilos**: Tailwind CSS 3, lucide-react
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Seguridad**: Row Level Security habilitado, SECURITY DEFINER en triggers

## 🛠️ Configuración local

### 1. Clonar el repositorio

```bash
git clone https://github.com/Insumosfa/NovaERP.git
cd NovaERP
npm install
```

### 2. Variables de entorno

Crea un archivo `.env` en la raíz:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 3. Migraciones Supabase

Ejecuta los archivos SQL en orden desde `supabase/migrations/`:

```
0001_core_entities.sql        — tablas base, roles, usuarios
0002_transactional_tables.sql — compras, ventas, inventario, cobranza
0003_nextval_rpc.sql          — función RPC para numeración de documentos
0004_security_hardening.sql   — RLS policies y permisos
0005_fix_handle_new_user_role.sql — trigger de asignación de rol
```

### 4. Correr en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

## 📦 Scripts disponibles

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run preview    # Preview del build
npm run lint       # ESLint
npm run typecheck  # TypeScript check
```

## 📁 Estructura del proyecto

```
src/
├── components/
│   ├── Auth.tsx        # Pantalla de login / registro
│   ├── Sidebar.tsx     # Navegación lateral + topbar
│   └── ui.tsx          # Componentes reutilizables (Modal, Toast, Badge...)
├── lib/
│   ├── auth.tsx        # AuthProvider + contexto de sesión
│   ├── supabase.ts     # Cliente Supabase + helpers de formato
│   ├── inventory.ts    # adjustInventory, nextDocNumber
│   ├── audit.ts        # logAudit
│   ├── permissions.ts  # Control de acceso por rol
│   └── types.ts        # Tipos TypeScript globales
├── modules/            # Un archivo por módulo del ERP
└── index.css           # Estilos globales + clases Tailwind custom
supabase/
└── migrations/         # Scripts SQL de Supabase
```
