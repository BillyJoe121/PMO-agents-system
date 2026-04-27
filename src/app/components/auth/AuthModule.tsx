import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type AuthView = 'login' | 'recovery' | 'recovery-success';

export default function AuthModule() {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Recovery state
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryEmailError, setRecoveryEmailError] = useState('');
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);

  const validateEmail = (val: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val);
  };

  const handleEmailBlur = () => {
    if (!email) {
      setEmailError('El correo electrónico es requerido.');
    } else if (!validateEmail(email)) {
      setEmailError('Por favor ingrese un correo electrónico válido.');
    } else {
      setEmailError('');
    }
  };

  const handlePasswordBlur = () => {
    if (!password) {
      setPasswordError('La contraseña es requerida.');
    } else if (password.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.');
    } else {
      setPasswordError('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    handleEmailBlur();
    handlePasswordBlur();
    if (!email || !password || emailError || passwordError) return;

    setIsLoading(true);
    setLoginError('');

    // TODO: Integrar supabase.auth.signInWithPassword()
    // TODO: Manejar redirección condicional por rol (auditor vs usuario_externo)
    // RF-AUTH-04: El middleware de la App debe validar la expiración del JWT a las 8 horas.
    await new Promise(r => setTimeout(r, 1500));

    // Demo: allow any valid-looking credentials or show error
    if (email === 'admin@icesi.edu.co' && password === 'demo1234') {
      navigate('/dashboard');
    } else {
      setLoginError('El correo electrónico o la contraseña son incorrectos. Por favor, intente de nuevo.');
    }
    setIsLoading(false);
  };

  const handleRecoveryEmailBlur = () => {
    if (!recoveryEmail) {
      setRecoveryEmailError('El correo electrónico es requerido.');
    } else if (!validateEmail(recoveryEmail)) {
      setRecoveryEmailError('Por favor ingrese un correo electrónico válido.');
    } else {
      setRecoveryEmailError('');
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    handleRecoveryEmailBlur();
    if (!recoveryEmail || recoveryEmailError) return;

    setIsRecoveryLoading(true);
    // TODO: Integrar supabase.auth.resetPasswordForEmail() para recuperación
    await new Promise(r => setTimeout(r, 1200));
    setIsRecoveryLoading(false);
    setView('recovery-success');
  };

  // Demo login hint
  const fillDemo = () => {
    setEmail('admin@icesi.edu.co');
    setPassword('demo1234');
    setEmailError('');
    setPasswordError('');
    setLoginError('');
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* LEFT — Branding */}
      <div
        className="hidden lg:flex w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #010108 0%, #030213 55%, #0a0a20 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full opacity-10" style={{ background: '#ffffff' }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full opacity-10" style={{ background: '#ffffff' }} />
        <div className="absolute top-1/2 left-[-40px] w-32 h-32 rounded-full opacity-5" style={{ background: '#ffffff' }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          {/* Logo placeholder */}
          <div className="w-24 h-24 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-8 shadow-2xl">
            <span className="text-white text-3xl font-bold tracking-tight">IC</span>
          </div>

          <h1 className="text-4xl text-white mb-4" style={{ fontWeight: 700, lineHeight: 1.2 }}>
            PMO Intelligence<br />Platform
          </h1>
          <p className="text-white/60 text-lg max-w-sm leading-relaxed" style={{ fontWeight: 400 }}>
            Sistema avanzado de auditoría y diagnóstico organizacional mediante agentes de IA
          </p>

          <div className="mt-12 flex flex-col gap-4 w-full max-w-xs">
            {[
              { label: 'Diagnóstico con IA', desc: '8 fases de análisis profundo' },
              { label: 'Colaboración en tiempo real', desc: 'Equipos sincronizados' },
              { label: 'Reportes ejecutivos', desc: 'Insights accionables' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.15 }}
                className="flex items-start gap-3 text-left"
              >
                <div className="w-2 h-2 rounded-full bg-white/40 mt-2 flex-shrink-0" />
                <div>
                  <p className="text-white text-sm" style={{ fontWeight: 600 }}>{item.label}</p>
                  <p className="text-white/50 text-xs">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <p className="absolute bottom-6 text-white/30 text-xs">
          © 2024 Universidad ICESI · Todos los derechos reservados
        </p>
      </div>

      {/* RIGHT — Form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <AnimatePresence mode="wait">
            {/* LOGIN VIEW */}
            {view === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8">
                  <h2 className="text-gray-900 mb-2" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                    Bienvenido
                  </h2>
                  <p className="text-gray-500 text-sm">Ingrese sus credenciales para acceder a la plataforma</p>
                </div>

                {/* Error banner */}
                <AnimatePresence>
                  {loginError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                    >
                      <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <p className="text-red-700 text-sm">{loginError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                  {/* Email */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setLoginError(''); }}
                        onBlur={handleEmailBlur}
                        placeholder="nombre@icesi.edu.co"
                        className={`w-full pl-10 pr-4 py-3 bg-white border rounded-lg text-sm outline-none transition-all
                          ${emailError ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100'}
                        `}
                      />
                    </div>
                    {emailError && (
                      <p className="text-red-500 text-xs flex items-center gap-1">
                        <AlertCircle size={12} /> {emailError}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setLoginError(''); }}
                        onBlur={handlePasswordBlur}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-12 py-3 bg-white border rounded-lg text-sm outline-none transition-all
                          ${passwordError ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100'}
                        `}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-red-500 text-xs flex items-center gap-1">
                        <AlertCircle size={12} /> {passwordError}
                      </p>
                    )}
                  </div>

                  {/* Remember me */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 accent-zinc-900"
                    />
                    {/* RF-AUTH-04: El middleware de la App debe validar la expiración del JWT a las 8 horas. */}
                    <label htmlFor="remember" className="text-gray-600 text-sm cursor-pointer" style={{ fontWeight: 400 }}>
                      Mantener sesión iniciada (8 horas)
                    </label>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-lg text-white text-sm transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{ background: isLoading ? '#6b7280' : '#030213', fontWeight: 600 }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Verificando credenciales...
                      </>
                    ) : (
                      'Ingresar al Sistema'
                    )}
                  </button>

                  {/* Demo hint */}
                  <p className="text-center text-gray-400 text-xs">
                    Demo: {' '}
                    <button type="button" onClick={fillDemo} className="text-zinc-700 underline hover:text-zinc-900">
                      admin@icesi.edu.co / demo1234
                    </button>
                  </p>

                  {/* Forgot password */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setView('recovery')}
                      className="text-sm hover:underline transition-colors"
                      style={{ color: '#030213', fontWeight: 500 }}
                    >
                      ¿Olvidó su contraseña?
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* RECOVERY VIEW */}
            {view === 'recovery' && (
              <motion.div
                key="recovery"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  onClick={() => setView('login')}
                  className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors"
                >
                  <ArrowLeft size={16} /> Volver al inicio de sesión
                </button>

                <div className="mb-8">
                  <h2 className="text-gray-900 mb-2" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                    Recuperar contraseña
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Ingrese su correo institucional y le enviaremos un enlace para restablecer su contraseña.
                  </p>
                </div>

                <form onSubmit={handleRecovery} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>
                      Correo electrónico institucional
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={recoveryEmail}
                        onChange={e => { setRecoveryEmail(e.target.value); setRecoveryEmailError(''); }}
                        onBlur={handleRecoveryEmailBlur}
                        placeholder="nombre@icesi.edu.co"
                        className={`w-full pl-10 pr-4 py-3 bg-white border rounded-lg text-sm outline-none transition-all
                          ${recoveryEmailError ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100'}
                        `}
                      />
                    </div>
                    {recoveryEmailError && (
                      <p className="text-red-500 text-xs flex items-center gap-1">
                        <AlertCircle size={12} /> {recoveryEmailError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isRecoveryLoading}
                    className="w-full py-3 rounded-lg text-white text-sm transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{ background: '#030213', fontWeight: 600 }}
                  >
                    {isRecoveryLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Enviando enlace...
                      </>
                    ) : (
                      'Enviar enlace de recuperación'
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* RECOVERY SUCCESS */}
            {view === 'recovery-success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="text-green-600" size={32} />
                </div>
                <h2 className="text-gray-900 mb-3" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  ¡Enlace enviado!
                </h2>
                <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                  Hemos enviado un enlace de recuperación a <strong>{recoveryEmail}</strong>.<br />
                  Revise su bandeja de entrada y siga las instrucciones.
                </p>
                <button
                  onClick={() => setView('login')}
                  className="text-sm hover:underline"
                  style={{ color: '#030213', fontWeight: 500 }}
                >
                  ← Volver al inicio de sesión
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}