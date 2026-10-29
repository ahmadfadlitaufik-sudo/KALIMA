import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { INITIAL_USERS } from '../data/initialData';
import { UserRole } from '../types';
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
  Users,
  CheckCircle2,
  AlertCircle,
  Crown,
  LogIn,
  KeyRound,
  CloudCheck,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, cloudSyncStatus } = useApp();

  const [email, setEmail] = useState('fadli.owner@kalima.id');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Silakan masukkan alamat email akun Anda.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // Simulate snappy realistic authentication
    setTimeout(async () => {
      const res = await login(email, password);
      setLoading(false);
      if (!res.success) {
        setErrorMessage(res.error || 'Autentikasi gagal. Silakan periksa kembali email Anda.');
      }
    }, 400);
  };

  const handleQuickLogin = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('••••••••');
    setErrorMessage(null);
    setLoading(true);
    setTimeout(async () => {
      const res = await login(userEmail);
      setLoading(false);
      if (!res.success) {
        setErrorMessage(res.error || 'Gagal masuk akun.');
      }
    }, 300);
  };

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
          <CloudCheck className="w-4 h-4 text-emerald-400" />
          <span>Cloud Database Terkoneksi</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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

          {/* Right Column: Sign In Form & Quick Access Cards */}
          <div className="lg:col-span-7 flex flex-col justify-center p-6 sm:p-10 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-xl">
            <div className="max-w-md w-full mx-auto space-y-6">
              
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Selamat Datang Kembali
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Masukkan email dan kata sandi Anda untuk mengakses dashboard.
                </p>
              </div>

              {/* Error Notification */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Alamat Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh: fadli.owner@kalima.id"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Kata Sandi
                    </label>
                    <button
                      type="button"
                      onClick={() => setPassword('kalima2026')}
                      className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Bantuan Sandi?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 bg-slate-950"
                    />
                    <span>Ingat sesi masuk di perangkat ini</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Memverifikasi Akun...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Aplikasi</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Login Preset Badges */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Pilih Cepat Profil Pengguna:
                  </span>
                  <span className="text-[10px] text-amber-400 font-medium">1-Klik Langsung Masuk</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {INITIAL_USERS.map((user) => {
                    const isOwnerRole = user.role === 'owner';
                    const isSelected = email.toLowerCase() === user.email.toLowerCase();

                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleQuickLogin(user.email)}
                        className={`p-3 rounded-2xl border text-left transition-all relative group cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-white truncate group-hover:text-amber-300">
                              {user.name.split(' ')[0]} {user.name.split(' ')[1] || ''}
                            </div>
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full uppercase ${
                                isOwnerRole
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {user.role}
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
                          <span className="truncate">{user.email.split('@')[0]}</span>
                          <LogIn className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

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
