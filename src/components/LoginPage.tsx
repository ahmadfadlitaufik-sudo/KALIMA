import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Boxes,
  AlertCircle,
  CheckCircle2,
  LogOut,
  RefreshCw,
  MailCheck,
  ShieldAlert,
} from 'lucide-react';

type FormMode = 'signIn' | 'register' | 'reset';

const inputClassName =
  'w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all';

const primaryButtonClassName =
  'w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer';

const secondaryButtonClassName =
  'w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer';

const GoogleLogo: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const Notice: React.FC<{ tone: 'error' | 'success'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
      tone === 'error'
        ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
    }`}
  >
    {tone === 'error' ? (
      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
    ) : (
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
    )}
    <span>{children}</span>
  </div>
);

/** Panel saat akun Firebase sudah masuk tapi belum boleh memakai aplikasi. */
const AccountStatusPanel: React.FC = () => {
  const { status, firebaseEmail, errorMessage, resendVerification, recheckVerification, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const handleResend = async () => {
    setBusy(true);
    const error = await resendVerification();
    setBusy(false);
    setMessage(error ? { tone: 'error', text: error } : { tone: 'success', text: 'Email verifikasi dikirim ulang. Cek kotak masuk / spam.' });
  };

  const handleRecheck = async () => {
    setBusy(true);
    await recheckVerification();
    setBusy(false);
    setMessage({ tone: 'error', text: 'Email belum terverifikasi. Klik tautan di email terlebih dahulu.' });
  };

  if (status === 'unverified') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-amber-300">
          <MailCheck className="w-5 h-5" />
          <h2 className="text-lg font-bold text-white">Verifikasi email Anda</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Kami sudah mengirim tautan verifikasi ke <strong className="text-slate-200">{firebaseEmail}</strong>. Klik tautan itu, lalu tekan tombol di bawah.
        </p>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <button type="button" onClick={handleRecheck} disabled={busy} className={primaryButtonClassName}>
          <RefreshCw className="w-4 h-4" />
          <span>Saya sudah verifikasi</span>
        </button>
        <button type="button" onClick={handleResend} disabled={busy} className={secondaryButtonClassName}>
          Kirim ulang email verifikasi
        </button>
        <button type="button" onClick={signOut} className={secondaryButtonClassName}>
          <LogOut className="w-4 h-4" />
          <span>Keluar / pakai akun lain</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-rose-300">
        <ShieldAlert className="w-5 h-5" />
        <h2 className="text-lg font-bold text-white">
          {status === 'error' ? 'Tidak bisa memeriksa akses' : 'Akun belum diberi akses'}
        </h2>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        {status === 'error'
          ? errorMessage
          : (
            <>
              Akun <strong className="text-slate-200">{firebaseEmail}</strong> belum terdaftar sebagai pengguna Kalima.
              Minta Owner menambahkan email ini di menu <strong className="text-slate-200">Pengguna</strong>, lalu masuk lagi.
            </>
          )}
      </p>
      <button type="button" onClick={signOut} className={secondaryButtonClassName}>
        <LogOut className="w-4 h-4" />
        <span>Keluar / pakai akun lain</span>
      </button>
    </div>
  );
};

const SignInPanel: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, registerWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState<FormMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const switchMode = (nextMode: FormMode) => {
    setMode(nextMode);
    setMessage(null);
  };

  const handleGoogle = async () => {
    setLoading(true);
    setMessage(null);
    const error = await signInWithGoogle();
    setLoading(false);
    if (error) {
      setMessage({ tone: 'error', text: error });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === 'reset') {
      const error = await resetPassword(email);
      setLoading(false);
      setMessage(
        error
          ? { tone: 'error', text: error }
          : { tone: 'success', text: 'Jika email terdaftar, tautan untuk membuat kata sandi baru sudah dikirim.' },
      );
      return;
    }

    const error = mode === 'register'
      ? await registerWithEmail(email, password)
      : await signInWithEmail(email, password);
    setLoading(false);
    if (error) {
      setMessage({ tone: 'error', text: error });
    }
  };

  const titles: Record<FormMode, { heading: string; description: string; submit: string }> = {
    signIn: {
      heading: 'Selamat Datang Kembali',
      description: 'Masuk dengan akun Google atau email & kata sandi yang terdaftar.',
      submit: 'Masuk ke Aplikasi',
    },
    register: {
      heading: 'Buat Kata Sandi',
      description: 'Untuk staf yang emailnya sudah didaftarkan Owner. Setelah ini, verifikasi email Anda.',
      submit: 'Buat Akun',
    },
    reset: {
      heading: 'Lupa Kata Sandi',
      description: 'Kami kirim tautan untuk membuat kata sandi baru ke email Anda.',
      submit: 'Kirim Tautan',
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">{titles[mode].heading}</h2>
        <p className="text-xs text-slate-400 mt-1">{titles[mode].description}</p>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {mode === 'signIn' && (
        <>
          <button type="button" onClick={handleGoogle} disabled={loading} className={secondaryButtonClassName}>
            <GoogleLogo />
            <span>Masuk dengan Google</span>
          </button>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 uppercase tracking-wider">
            <span className="h-px flex-1 bg-white/10" />
            <span>atau dengan email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Alamat Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className={inputClassName}
              required
            />
          </div>
        </div>

        {mode !== 'reset' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300">
                Kata Sandi
              </label>
              {mode === 'signIn' && (
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Lupa kata sandi?
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Minimal 6 karakter' : 'Masukkan kata sandi'}
                minLength={6}
                className={`${inputClassName} pr-10`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <button type="submit" disabled={loading} className={primaryButtonClassName}>
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <span>{titles[mode].submit}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-white/10 text-xs text-slate-400 space-y-2">
        {mode === 'signIn' ? (
          <p>
            Staf baru tanpa akun Google?{' '}
            <button type="button" onClick={() => switchMode('register')} className="text-amber-400 hover:text-amber-300 font-semibold">
              Buat kata sandi
            </button>
          </p>
        ) : (
          <button type="button" onClick={() => switchMode('signIn')} className="text-amber-400 hover:text-amber-300 font-semibold">
            ← Kembali ke halaman masuk
          </button>
        )}
        <p className="text-[11px] text-slate-500">
          Hanya email yang didaftarkan Owner yang bisa membuka aplikasi.
        </p>
      </div>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const { status } = useAuth();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-[#0e1626] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Top Navigation Bar */}
      <header className="w-full px-6 py-5 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl tracking-tight">
            K
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                KALIMA APPAREL
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PRO ERP
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Sistem Operasional & Penjualan Terpadu Muslim Fashion
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Login aman via Firebase</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Brand Showcase & Value Props */}
          <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kalima Apparel Enterprise System</span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                  Kelola Penjualan & Inventori Busana Muslim Lebih Cepat
                </h1>
                <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                  Solusi terintegrasi untuk POS kasir kilat, monitoring stok SKU multi-gudang, manajemen reseller, dan laporan laba rugi otomatis.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Kasir Kilat & Cetak Nota</h4>
                    <p className="text-[11px] text-slate-400">Input pesanan di bawah 60 detik dengan auto cetak struk thermal.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Akurasi Stok Real-Time</h4>
                    <p className="text-[11px] text-slate-400">Sinkronisasi stok aman, peringatan low stock, dan alur pengadaan PO.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Audit Log & Hak Akses Berjenjang</h4>
                    <p className="text-[11px] text-slate-400">Pemisahan wewenang Owner dan Admin/CS dengan pencatatan lengkap.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-6 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
              <span>Keamanan Bank-Grade SSL</span>
              <span>v2.4.0 Build 2026</span>
            </div>
          </div>

          {/* Right Column: Sign In Form / Account Status */}
          <div className="lg:col-span-7 flex flex-col justify-center p-6 sm:p-10 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-xl">
            <div className="max-w-md w-full mx-auto">
              {status === 'loading' ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-400">Memeriksa akun...</span>
                </div>
              ) : status === 'signedOut' ? (
                <SignInPanel />
              ) : (
                <AccountStatusPanel />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          © {new Date().getFullYear()} Kalima Apparel Indonesia. Hak Cipta Dilindungi Undang-Undang.
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>Panduan Penggunaan</span>
          <span>•</span>
          <span>Bantuan Teknis</span>
          <span>•</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Sistem Aktif
          </span>
        </div>
      </footer>
    </div>
  );
};
