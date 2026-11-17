import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SetupPanel } from './SetupPage';
import { ErrorNotice, PasswordInput, inputClassName, primaryButtonClassName } from './AuthFormParts';
import {
  Mail,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Boxes,
} from 'lucide-react';

const SignInPanel: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const error = await signIn(email, password);
    setLoading(false);
    if (error) {
      setMessage(error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Selamat Datang Kembali</h2>
        <p className="text-xs text-slate-400 mt-1">Masuk dengan email dan kata sandi akun Kalima Anda.</p>
      </div>

      {message && <ErrorNotice>{message}</ErrorNotice>}

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

        <div>
          <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Kata Sandi
          </label>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
          />
        </div>

        <button type="submit" disabled={loading} className={primaryButtonClassName}>
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <span>Masuk ke Aplikasi</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className="pt-4 border-t border-white/10 text-[11px] text-slate-500">
        Lupa kata sandi? Minta Owner me-reset dari menu Pengguna.
      </p>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const { status, errorMessage } = useAuth();

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
          <span>Login aman</span>
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

          {/* Right Column: Sign In / Setup */}
          <div className="lg:col-span-7 flex flex-col justify-center p-6 sm:p-10 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-xl">
            <div className="max-w-md w-full mx-auto">
              {status === 'loading' ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-400">Memeriksa sesi...</span>
                </div>
              ) : status === 'error' ? (
                <ErrorNotice>{errorMessage} Muat ulang halaman untuk mencoba lagi.</ErrorNotice>
              ) : status === 'setup' ? (
                <SetupPanel />
              ) : (
                <SignInPanel />
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
