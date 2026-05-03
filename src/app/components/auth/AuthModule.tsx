import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye, EyeOff, ArrowLeft, Loader2, AlertCircle,
  CheckCircle2, ArrowRight, Mail, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type AuthView = 'login' | 'recovery' | 'recovery-success';

export default function AuthModule() {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>('login');

  /* ── Login state ── */
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [loginError, setLoginError]     = useState('');
  const [emailError, setEmailError]     = useState('');
  const [passwordError, setPasswordError] = useState('');

  /* ── Recovery state ── */
  const [recoveryEmail, setRecoveryEmail]           = useState('');
  const [recoveryEmailError, setRecoveryEmailError] = useState('');
  const [isRecoveryLoading, setIsRecoveryLoading]   = useState(false);

  /* ── Validators ── */
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleEmailBlur = () => {
    if (!email) setEmailError('El correo es requerido.');
    else if (!isValidEmail(email)) setEmailError('Correo electrónico inválido.');
    else setEmailError('');
  };

  const handlePasswordBlur = () => {
    if (!password) setPasswordError('La contraseña es requerida.');
    else if (password.length < 6) setPasswordError('Mínimo 6 caracteres.');
    else setPasswordError('');
  };

  /* ── Handlers ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    handleEmailBlur();
    handlePasswordBlur();
    if (!email || !password || emailError || passwordError) return;

    setIsLoading(true);
    setLoginError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoginError('Credenciales incorrectas. Verifique su correo y contraseña.');
    } else {
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  const handleRecoveryEmailBlur = () => {
    if (!recoveryEmail) setRecoveryEmailError('El correo es requerido.');
    else if (!isValidEmail(recoveryEmail)) setRecoveryEmailError('Correo electrónico inválido.');
    else setRecoveryEmailError('');
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    handleRecoveryEmailBlur();
    if (!recoveryEmail || recoveryEmailError) return;

    setIsRecoveryLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsRecoveryLoading(false);

    if (error) {
      setRecoveryEmailError('No se pudo enviar el enlace. Verifica el correo.');
    } else {
      setView('recovery-success');
    }
  };

  /* ─────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex bg-[#fafaf9]" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ═══════════════════════════════════════
          LEFT — Editorial brand panel
      ═══════════════════════════════════════ */}
      <div
        className="hidden lg:flex w-[48%] flex-col justify-between p-12 relative overflow-hidden flex-shrink-0"
        style={{ background: '#0a0a0a' }}
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #fff 0, #fff 1px, transparent 1px, transparent 48px)',
          }}
        />

        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 flex items-center justify-between"
        >
          {/* Logomark */}
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-[12px] uppercase tracking-[0.14em]" style={{ fontWeight: 500 }}>
              Universidad Icesi
            </span>
          </div>
        </motion.div>

        {/* Center: main brand statement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative z-10"
        >
          <p
            className="text-white/30 uppercase tracking-[0.2em] mb-5 text-[11px]"
            style={{ fontWeight: 500 }}
          >
            Plataforma de diagnóstico
          </p>

          <h1
            className="text-white mb-6"
            style={{
              fontSize: 'clamp(2rem, 3.2vw, 2.75rem)',
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}
          >
            PMO<br />Intelligence<br />Platform
          </h1>

          {/* Capilar divider */}
          <div className="w-12 h-px bg-white/15 mb-6" />

          <p className="text-white/40 text-[14px] leading-relaxed max-w-xs" style={{ fontWeight: 400 }}>
            Auditoría organizacional guiada por agentes de inteligencia artificial. Ocho fases de diagnóstico profundo.
          </p>
        </motion.div>

        {/* Bottom copyright */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative z-10 text-white/15 text-[11px]"
          style={{ fontWeight: 400 }}
        >
          © 2025 Universidad ICESI · Todos los derechos reservados
        </motion.p>
      </div>

      {/* ═══════════════════════════════════════
          RIGHT — Form panel
      ═══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-[#fafaf9]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[380px]"
        >
          <AnimatePresence mode="wait">

            {/* ─── LOGIN ─── */}
            {view === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
              >
                {/* Header */}
                <div className="mb-9">
                  <p className="uppercase tracking-[0.18em] text-neutral-400 text-[11px] mb-3" style={{ fontWeight: 500 }}>
                    Acceso seguro
                  </p>
                  <h2
                    className="text-[#0a0a0a]"
                    style={{ fontSize: '2.25rem', fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}
                  >
                    Bienvenido
                  </h2>
                  <p className="text-neutral-500 text-[13px] mt-2.5 leading-relaxed">
                    Ingrese sus credenciales para acceder a la plataforma
                  </p>
                </div>

                {/* Error banner */}
                <AnimatePresence>
                  {loginError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-6 overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2.5">
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                        <p className="text-red-600 text-[13px] leading-relaxed">{loginError}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleLogin} className="flex flex-col gap-5">

                  {/* Email */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail
                        size={13}
                        strokeWidth={1.75}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                      />
                      <input
                        type="text"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setLoginError(''); }}
                        onBlur={handleEmailBlur}
                        placeholder="nombre@icesi.edu.co"
                        className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-[13px] outline-none transition-all placeholder:text-neutral-300
                          ${emailError
                            ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-50'
                            : 'border-neutral-200/80 focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100'
                          }
                        `}
                        style={{ color: '#0a0a0a', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                      />
                    </div>
                    <AnimatePresence>
                      {emailError && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-red-500 text-[11px] flex items-center gap-1"
                        >
                          <AlertCircle size={11} strokeWidth={1.75} />
                          {emailError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Password */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>
                        Contraseña
                      </label>
                      <button
                        type="button"
                        onClick={() => setView('recovery')}
                        className="text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        ¿La olvidó?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock
                        size={13}
                        strokeWidth={1.75}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setLoginError(''); }}
                        onBlur={handlePasswordBlur}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-11 py-3 bg-white border rounded-xl text-[13px] outline-none transition-all placeholder:text-neutral-300
                          ${passwordError
                            ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-50'
                            : 'border-neutral-200/80 focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100'
                          }
                        `}
                        style={{ color: '#0a0a0a', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors"
                      >
                        {showPassword
                          ? <EyeOff size={13} strokeWidth={1.75} />
                          : <Eye size={13} strokeWidth={1.75} />
                        }
                      </button>
                    </div>
                    <AnimatePresence>
                      {passwordError && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-red-500 text-[11px] flex items-center gap-1"
                        >
                          <AlertCircle size={11} strokeWidth={1.75} />
                          {passwordError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Remember me */}
                  <label className="flex items-center gap-2.5 cursor-pointer group w-fit">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded border transition-all ${
                          rememberMe
                            ? 'bg-neutral-900 border-neutral-900'
                            : 'bg-white border-neutral-200/80 group-hover:border-neutral-400'
                        }`}
                      >
                        {rememberMe && (
                          <svg className="w-full h-full p-0.5 text-white" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-[12px] text-neutral-500 group-hover:text-neutral-700 transition-colors" style={{ fontWeight: 400 }}>
                      Mantener sesión iniciada
                    </span>
                  </label>

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    whileHover={!isLoading ? { y: -1 } : {}}
                    whileTap={!isLoading ? { y: 0 } : {}}
                    className="w-full py-3.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                    style={{
                      background: '#0a0a0a',
                      fontWeight: 500,
                      boxShadow: isLoading
                        ? 'none'
                        : '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.22)',
                    }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={13} strokeWidth={1.75} className="animate-spin" />
                        Verificando…
                      </>
                    ) : (
                      <>
                        Ingresar a la plataforma
                        <ArrowRight size={13} strokeWidth={1.75} />
                      </>
                    )}
                  </motion.button>

                </form>
              </motion.div>
            )}

            {/* ─── RECOVERY ─── */}
            {view === 'recovery' && (
              <motion.div
                key="recovery"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  onClick={() => setView('login')}
                  className="group inline-flex items-center gap-1.5 text-neutral-400 hover:text-neutral-700 text-[12px] mb-8 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <ArrowLeft size={12} strokeWidth={1.75} className="transition-transform group-hover:-translate-x-0.5" />
                  Volver
                </button>

                <div className="mb-9">
                  <p className="uppercase tracking-[0.18em] text-neutral-400 text-[11px] mb-3" style={{ fontWeight: 500 }}>
                    Recuperación
                  </p>
                  <h2
                    className="text-[#0a0a0a]"
                    style={{ fontSize: '2.25rem', fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}
                  >
                    Restablecer<br />contraseña
                  </h2>
                  <p className="text-neutral-500 text-[13px] mt-2.5 leading-relaxed">
                    Le enviaremos un enlace a su correo institucional para restablecer el acceso.
                  </p>
                </div>

                <form onSubmit={handleRecovery} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail size={13} strokeWidth={1.75} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                      <input
                        type="text"
                        value={recoveryEmail}
                        onChange={e => { setRecoveryEmail(e.target.value); setRecoveryEmailError(''); }}
                        onBlur={handleRecoveryEmailBlur}
                        placeholder="nombre@icesi.edu.co"
                        className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl text-[13px] outline-none transition-all placeholder:text-neutral-300
                          ${recoveryEmailError
                            ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-50'
                            : 'border-neutral-200/80 focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100'
                          }
                        `}
                        style={{ color: '#0a0a0a', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                      />
                    </div>
                    <AnimatePresence>
                      {recoveryEmailError && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-red-500 text-[11px] flex items-center gap-1"
                        >
                          <AlertCircle size={11} strokeWidth={1.75} />
                          {recoveryEmailError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isRecoveryLoading}
                    whileHover={!isRecoveryLoading ? { y: -1 } : {}}
                    whileTap={!isRecoveryLoading ? { y: 0 } : {}}
                    className="w-full py-3.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: '#0a0a0a',
                      fontWeight: 500,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.22)',
                    }}
                  >
                    {isRecoveryLoading ? (
                      <>
                        <Loader2 size={13} strokeWidth={1.75} className="animate-spin" />
                        Enviando enlace…
                      </>
                    ) : (
                      <>
                        Enviar enlace de recuperación
                        <ArrowRight size={13} strokeWidth={1.75} />
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ─── RECOVERY SUCCESS ─── */}
            {view === 'recovery-success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-9">
                  <div
                    className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6"
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                  >
                    <CheckCircle2 size={18} strokeWidth={1.75} className="text-emerald-600" />
                  </div>
                  <p className="uppercase tracking-[0.18em] text-neutral-400 text-[11px] mb-3" style={{ fontWeight: 500 }}>
                    Enlace enviado
                  </p>
                  <h2
                    className="text-[#0a0a0a]"
                    style={{ fontSize: '2.25rem', fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}
                  >
                    Revise su<br />bandeja
                  </h2>
                  <p className="text-neutral-500 text-[13px] mt-3 leading-relaxed">
                    Hemos enviado un enlace de recuperación a{' '}
                    <span className="text-neutral-700" style={{ fontWeight: 500 }}>{recoveryEmail}</span>.{' '}
                    Siga las instrucciones del correo.
                  </p>
                </div>

                <div className="pt-6 border-t border-neutral-200/60">
                  <button
                    onClick={() => setView('login')}
                    className="group inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 text-[13px] transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <ArrowLeft size={13} strokeWidth={1.75} className="transition-transform group-hover:-translate-x-0.5" />
                    Volver al inicio de sesión
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}