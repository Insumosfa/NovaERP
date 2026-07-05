import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { AuthScreen } from './components/Auth';
import { Sidebar, Topbar } from './components/Sidebar';
import { LoadingScreen } from './components/ui';
import { canAccess, moduleLabel, type Module } from './lib/permissions';
import type { RoleName } from './lib/types';

import { Dashboard } from './modules/Dashboard';
import { Clientes } from './modules/Clientes';
import { Proveedores } from './modules/Proveedores';
import { Productos } from './modules/Productos';
import { Inventario } from './modules/Inventario';
import { Compras } from './modules/Compras';
import { Ventas } from './modules/Ventas';
import { Entregas } from './modules/Entregas';
import { Cobranza } from './modules/Cobranza';
import { CuentasPorCobrar } from './modules/CuentasPorCobrar';
import { Auditoria } from './modules/Auditoria';
import { Reportes } from './modules/Reportes';
import { Usuarios } from './modules/Usuarios';

function Shell() {
  const { session, usuario, rol, loading } = useAuth();
  const [current, setCurrent] = useState<Module>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) return <LoadingScreen label="Cargando sesión..." />;
  if (!session) return <AuthScreen />;
  if (!usuario) return <LoadingScreen label="Cargando perfil de usuario..." />;

  const role = rol?.nombre as RoleName | null;
  const effective: Module = canAccess(role, current) ? current : 'dashboard';

  const render = () => {
    switch (effective) {
      case 'dashboard': return <Dashboard onNavigate={setCurrent} />;
      case 'clientes': return <Clientes />;
      case 'proveedores': return <Proveedores />;
      case 'productos': return <Productos />;
      case 'inventario': return <Inventario />;
      case 'compras': return <Compras />;
      case 'ventas': return <Ventas />;
      case 'entregas': return <Entregas />;
      case 'cobranza': return <Cobranza />;
      case 'cuentas_por_cobrar': return <CuentasPorCobrar />;
      case 'auditoria': return <Auditoria />;
      case 'reportes': return <Reportes />;
      case 'usuarios': return <Usuarios />;
      default: return <Dashboard onNavigate={setCurrent} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        current={effective}
        onNavigate={setCurrent}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} title={moduleLabel(effective)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            {render()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
