import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Building2, Lock, Mail, User as UserIcon, Loader2, ShieldCheck } from 'lucide-react';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email.trim(), password);
      if (error) setError(error);
    } else {
      if (nombre.trim().length < 2) {
        setError('Ingrese su nombre completo.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        setLoading(false);
        return;
      }
      const savedEmail = email.trim();
      const savedPassword = password;
      const { error } = await signUp(savedEmail, savedPassword, nombre.trim());
      if (error) {
        setError(error);
      } else {
        // Try automatic sign-in; if email confirmation is required it will fail gracefully
        const { error: signInErr } = await signIn(savedEmail, savedPassword);
        if (signInErr) {
          // Email confirmation required — show info and redirect to sign-in form
          setMode('signin');
          setEmail(savedEmail);
          setPassword('');
          setInfo('Cuenta creada. Revise su correo para confirmar la cuenta y luego inicie sesión.');
        }
        // If signIn succeeded the AuthProvider will redirect automatically
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-sky-800 via-sky-900 to-slate-900">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)', backgroundSize: '40px 40px, 60px 60px' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <Building2 size={24} />
            </div>
            <div>
              <p className="font-display text-xl font-bold">NovaERP</p>
              <p className="text-xs text-sky-200">Sistema de Administración Comercial</p>
            </div>
          </div>
          <div className="space-y-6">
            <h1 className="font-display text-4xl font-bold leading-tight">
              Gestione compras, ventas,<br />inventario y cobranza<br />en un solo lugar.
            </h1>
            <p className="text-sky-100 max-w-md">
              Control integral de operaciones comerciales con trazabilidad completa,
              control de roles y reportes en tiempo real.
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              {[
                { label: 'Compras & Inventario', icon: '📦' },
                { label: 'Ventas & Cotización', icon: '🧾' },
                { label: 'Entregas & Evidencia', icon: '🚚' },
                { label: 'Cobranza & Cartera', icon: '💰' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5 backdrop-blur">
                  <span className="text-lg">{f.icon}</span>
                  <span className="text-sm text-sky-50">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-sky-300">© 2026 NovaERP. Todos los derechos reservados.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-700 text-white">
                <Building2 size={24} />
              </div>
              <div>
                <p className="font-display text-xl font-bold text-slate-900">NovaERP</p>
                <p className="text-xs text-slate-500">Sistema de Administración Comercial</p>
              </div>
            </div>
          </div>

          <div className="card p-8">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              {mode === 'signin' ? 'Bienvenido de nuevo' : 'Crear cuenta'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'signin' ? 'Ingrese sus credenciales para continuar.' : 'Registre su cuenta para acceder al sistema.'}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="label">Nombre completo</label>
                  <div className="relative">
                    <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-9"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Juan Pérez"
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="label">Correo electrónico</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    className="input pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    className="input pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {info && (
                <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-sm text-sky-700">
                  {info}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-sm text-slate-500">
              {mode === 'signin' ? (
                <>
                  ¿No tiene cuenta?
                  <button onClick={() => { setMode('signup'); setError(null); }} className="font-semibold text-sky-700 hover:text-sky-800">
                    Regístrese aquí
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tiene cuenta?
                  <button onClick={() => { setMode('signin'); setError(null); }} className="font-semibold text-sky-700 hover:text-sky-800">
                    Inicie sesión
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck size={14} />
            <span>Conexión segura · RLS habilitado · Bitácora de auditoría</span>
          </div>
        </div>
      </div>
    </div>
  );
}
