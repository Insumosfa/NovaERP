import { useState } from 'react';
import {
  LayoutDashboard, Users, Truck, Package, Boxes,
  ShoppingCart, Receipt, Truck as DeliverIcon, Wallet,
  FileText, ScrollText, BarChart3, UsersRound, LogOut,
  Building2, Menu, X, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { canAccess, moduleLabel, type Module } from '../lib/permissions';
import type { RoleName } from '../lib/types';

const NAV: { module: Module; icon: typeof LayoutDashboard }[] = [
  { module: 'dashboard', icon: LayoutDashboard },
  { module: 'clientes', icon: Users },
  { module: 'proveedores', icon: Truck },
  { module: 'productos', icon: Package },
  { module: 'inventario', icon: Boxes },
  { module: 'compras', icon: ShoppingCart },
  { module: 'ventas', icon: Receipt },
  { module: 'entregas', icon: DeliverIcon },
  { module: 'cobranza', icon: Wallet },
  { module: 'cuentas_por_cobrar', icon: FileText },
  { module: 'auditoria', icon: ScrollText },
  { module: 'reportes', icon: BarChart3 },
  { module: 'usuarios', icon: UsersRound },
];

export function Sidebar({
  current,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}: {
  current: Module;
  onNavigate: (m: Module) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { usuario, rol, signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const items = NAV.filter((n) => canAccess(rol?.nombre as RoleName | null, n.module));

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white">
              <Building2 size={20} />
            </div>
            <div>
              <p className="font-display text-base font-bold text-white">NovaERP</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Comercial</p>
            </div>
          </div>
          <button onClick={onCloseMobile} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {items.map(({ module, icon: Icon }) => {
            const active = current === module;
            return (
              <button
                key={module}
                onClick={() => { onNavigate(module); onCloseMobile(); }}
                className={`sidebar-link w-full text-left ${active ? 'sidebar-link-active' : ''}`}
              >
                <Icon size={18} />
                <span>{moduleLabel(module)}</span>
              </button>
            );
          })}
        </nav>

        <div className="relative border-t border-slate-800 p-3">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-800"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
              {usuario?.nombre?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-white">{usuario?.nombre ?? 'Usuario'}</p>
              <p className="truncate text-xs text-slate-400">{rol?.nombre ?? 'Sin rol'}</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {userMenuOpen && (
            <div className="absolute bottom-16 left-3 right-3 rounded-lg border border-slate-700 bg-slate-800 p-1 shadow-xl">
              <button
                onClick={() => { signOut(); }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function Topbar({ onMenuClick, title }: { onMenuClick: () => void; title: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:px-6">
      <button onClick={onMenuClick} className="lg:hidden text-slate-600 hover:text-slate-900">
        <Menu size={22} />
      </button>
      <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
    </header>
  );
}
