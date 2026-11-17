import React, { useState } from 'react';
import {
  Menu,
  Bell,
  Plus,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  CloudCheck,
  CloudOff,
  Check,
  RefreshCw,
  Sparkles,
  Activity,
  LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VIEW_TITLES } from '../services/viewRoute';
import { ChangePasswordModal } from './ChangePasswordModal';
import { GlobalSearch } from './GlobalSearch';

export const Header: React.FC = () => {
  const {
    currentView,
    setMobileMenuOpen,
    currentUser,
    isOwner,
    orders,
    getLowStockSKUs,
    setQuickOrderModalOpen,
    cloudSyncStatus,
    lastSyncedAt,
    syncToCloudNow,
    logout,
  } = useApp();

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  const lowStockCount = getLowStockSKUs().length;
  const pendingCancellations = orders.filter(
    (o) => o.statusOrder === 'menunggu_approval_batal'
  ).length;


  return (
    <header className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
      {/* Left: Brand Badge & Segmented Top Nav Pills (Exact match to Reference Image) */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="btn-circle-action lg:hidden shrink-0"
          aria-label="Buka Menu"
        >
          <Menu className="w-4 h-4 text-slate-700" />
        </button>

        <h1 className="text-lg font-extrabold text-slate-900 tracking-tight truncate">{VIEW_TITLES[currentView]}</h1>
      </div>

      {/* Right Action Icons (Reference: Circular white buttons & Dark CTA) */}
      <div className="flex flex-wrap items-center justify-end gap-2 md:shrink-0">
        <GlobalSearch />

        {/* Notifications Button with Red Dot */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationPopup(!showNotificationPopup)}
            title="Notifikasi & Peringatan Sistem" aria-label="Notifikasi & Peringatan Sistem"
            className="btn-circle-action cursor-pointer relative"
          >
            <Bell className="w-4 h-4 text-slate-600" />
            {(lowStockCount > 0 || pendingCancellations > 0) && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] ring-2 ring-white absolute top-2 right-2 animate-pulse" />
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotificationPopup && (
            <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-3xl p-4 shadow-2xl border border-slate-150 animate-in fade-in zoom-in-95 space-y-2 text-xs">
              <div className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                Pemberitahuan Sistem
              </div>
              {lowStockCount > 0 && (
                <div className="p-2.5 bg-amber-50 rounded-2xl border border-amber-200/60 text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span><strong>{lowStockCount} SKU</strong> berada di bawah batas minimum stok.</span>
                </div>
              )}
              {isOwner && pendingCancellations > 0 && (
                <div className="p-2.5 bg-rose-50 rounded-2xl border border-rose-200/60 text-rose-800 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-rose-600 shrink-0" />
                  <span><strong>{pendingCancellations} order</strong> menunggu konfirmasi pembatalan.</span>
                </div>
              )}
              {lowStockCount === 0 && (!isOwner || pendingCancellations === 0) && (
                <div className="p-3 text-center text-slate-400">
                  Semua operasional berjalan normal dan lancar.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cloud Sync Status Indicator & Multi-User Refresh */}
        <div className="relative flex items-center gap-1.5">
          <button
            onClick={async () => {
              const res = await syncToCloudNow();
              if (res?.success) {
                setSyncSuccessMessage('Data terbaru ditarik!');
                setTimeout(() => setSyncSuccessMessage(null), 3000);
              }
            }}
            title={
              cloudSyncStatus === 'connected'
                ? `Server Terhubung (Multi-User). Terakhir sinkron: ${lastSyncedAt || 'Baru saja'}. Klik untuk tarik data terbaru dari tim.`
                : cloudSyncStatus === 'syncing'
                ? 'Sedang menyinkronkan data dengan server...'
                : 'Cloud Terputus/Offline. Klik untuk sambungkan & sinkronkan data sekarang.'
            } aria-label={
              cloudSyncStatus === 'connected'
                ? `Server Terhubung (Multi-User). Terakhir sinkron: ${lastSyncedAt || 'Baru saja'}. Klik untuk tarik data terbaru dari tim.`
                : cloudSyncStatus === 'syncing'
                ? 'Sedang menyinkronkan data dengan server...'
                : 'Cloud Terputus/Offline. Klik untuk sambungkan & sinkronkan data sekarang.'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
              cloudSyncStatus === 'connected'
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 shadow-2xs'
                : cloudSyncStatus === 'syncing'
                ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 shadow-xs'
            }`}
          >
            {cloudSyncStatus === 'connected' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <CloudCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline font-medium text-xs">Sync Cloud</span>
              </>
            ) : cloudSyncStatus === 'syncing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                <span className="hidden sm:inline font-medium text-xs">Menyinkronkan...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                <CloudOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="font-bold text-xs">Offline · Klik Sync</span>
              </>
            )}
          </button>


          {syncSuccessMessage && (
            <div className="absolute right-0 top-full mt-1.5 bg-slate-900 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1.5 whitespace-nowrap z-50 animate-fade-in">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>{syncSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* Akun yang sedang masuk (peran ditentukan Owner di menu Pengguna) */}
        <button
          type="button"
          onClick={() => setChangePasswordOpen(true)}
          title={`${currentUser.name} — ${currentUser.email}. Klik untuk ganti kata sandi.`} aria-label={`${currentUser.name} — ${currentUser.email}. Klik untuk ganti kata sandi.`}
          className="px-3 py-2 rounded-full bg-white border border-slate-200/80 shadow-sm text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
        >
          {isOwner ? (
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <span className="hidden sm:inline">{currentUser.name.split(' ')[0]}</span>
          <span className="text-[11px] uppercase font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
            {currentUser.role}
          </span>
        </button>
        {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}

        {/* Logout Button */}
        <button
          onClick={logout}
          title="Keluar / Logout Akun" aria-label="Keluar / Logout Akun"
          className="btn-circle-action text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>

        {/* Quick Order CTA Button (Solid Dark Capsule Pill) */}
        <button
          onClick={() => setQuickOrderModalOpen(true)}
          className="btn-primary-dark flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer shadow-md"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Order Baru</span>
        </button>
      </div>

    </header>
  );
};
