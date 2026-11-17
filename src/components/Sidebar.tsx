import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  PackageCheck,
  Truck,
  Tag,
  Store,
  DollarSign,
  FileSpreadsheet,
  History,
  ShieldCheck,
  UserCheck,
  Users,
  X,
  ChevronRight,
  ChevronLeft,
  LogOut,
  UserCog,
} from 'lucide-react';
import { useApp, AppView } from '../context/AppContext';

const SIDEBAR_EXPANDED_KEY = 'kalima_app_v1_sidebar_expanded';

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    mobileMenuOpen,
    setMobileMenuOpen,
    currentUser,
    isOwner,
    orders,
    purchaseOrders,
    getLowStockSKUs,
    logout,
  } = useApp();

  // Label menu tampil secara bawaan; pilihan ciutkan diingat per browser.
  const [expanded, setExpandedState] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_EXPANDED_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const setExpanded = (value: boolean) => {
    setExpandedState(value);
    try {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, value ? '1' : '0');
    } catch {
      // abaikan: hanya preferensi tampilan
    }
  };

  // Pending cancellation approvals
  const pendingCancellations = orders.filter(
    (o) => o.statusOrder === 'menunggu_approval_batal'
  ).length;

  const lowStockCount = getLowStockSKUs().length;

  // Active in-transit or pending POs
  const activePOCount = purchaseOrders.filter(
    (po) => po.statusPO === 'dikirim' || po.statusPO === 'dipesan'
  ).length;

  type NavItem = {
    id: AppView;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: string;
    description: string;
  };

  // Menu dikelompokkan per seksi; seksi tanpa isi (mis. Pengaturan untuk staf) tidak tampil.
  const navSections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Operasional',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Omzet & ringkasan operasional' },
        {
          id: 'sales',
          label: 'Penjualan',
          icon: ShoppingBag,
          badge: pendingCancellations > 0 && isOwner ? pendingCancellations : undefined,
          badgeColor: 'bg-rose-600 text-white',
          description: 'Pesanan multi-channel & POS',
        },
        {
          id: 'inventory',
          label: 'Inventori',
          icon: PackageCheck,
          badge: lowStockCount > 0 ? lowStockCount : undefined,
          badgeColor: 'bg-amber-100 text-amber-900',
          description: 'Stok fisik & gudang',
        },
        {
          id: 'purchases',
          label: 'Pengadaan PO',
          icon: Truck,
          badge: activePOCount > 0 ? activePOCount : undefined,
          badgeColor: 'bg-slate-100 text-slate-700',
          description: 'Order vendor & resi kargo',
        },
        { id: 'products', label: 'Master SKU', icon: Tag, description: '210, 290, 185 GSM Kaos Polos' },
      ],
    },
    {
      title: 'Pelanggan',
      items: [
        { id: 'customers', label: 'Customer CRM', icon: Users, description: 'Data pelanggan & repeat order' },
        { id: 'reseller', label: 'Reseller & Konsinyasi', icon: Store, description: 'Titip jual & bagi hasil' },
      ],
    },
    {
      title: 'Keuangan',
      items: [
        { id: 'finance', label: 'Keuangan & Neraca', icon: DollarSign, description: 'Kas, bank & neraca keuangan' },
        { id: 'audit', label: 'Jejak Audit', icon: History, description: 'Riwayat aktivitas sistem' },
      ],
    },
    {
      title: 'Pengaturan',
      items: isOwner
        ? [
            { id: 'import_export', label: 'Impor & Ekspor', icon: FileSpreadsheet, description: 'Excel workbook & sinkronisasi' },
            { id: 'users', label: 'Pengguna', icon: UserCog, description: 'Siapa yang boleh masuk & perannya' },
          ]
        : [],
    },
  ];

  const handleNavClick = (viewId: AppView) => {
    setCurrentView(viewId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Modern Desktop Rail Dock / Mobile Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200/80 flex flex-col justify-between py-5 transition-all duration-300 ease-in-out lg:static ${
          expanded ? 'w-64' : 'w-20'
        } ${
          mobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top: Logo & Toggle */}
        <div className="flex flex-col items-center px-3 gap-4">
          <div className="w-full flex items-center justify-between px-2">
            <button
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
              title="Kalima Apparel" aria-label="Kalima Apparel"
            >
              {expanded || mobileMenuOpen ? (
                <div className="text-left animate-in fade-in space-y-1">
                  <img src="/brand/kalima-logo-dark.png" alt="Kalima" className="h-7 w-auto" />
                  <span className="block text-[11px] text-slate-500 font-medium">Apparel ERP</span>
                </div>
              ) : (
                <img src="/brand/kalima-icon-dark.png" alt="Kalima" className="w-9 h-auto transition-transform group-hover:scale-105" />
              )}
            </button>

            {/* Mobile close */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg lg:hidden"
              aria-label="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* Center: Navigation Icon Squircles (Exact Reference Style) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-none" aria-label="Menu utama">
          {navSections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <div key={section.title} className="space-y-1">
                {expanded || mobileMenuOpen ? (
                  <h2 className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</h2>
                ) : (
                  <div className="mx-auto w-6 border-t border-slate-200" aria-hidden="true" />
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  const showLabels = expanded || mobileMenuOpen;

                  return (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => handleNavClick(item.id)}
                        aria-label={item.badge !== undefined ? `${item.label} (${item.badge})` : item.label}
                        aria-current={isActive ? 'page' : undefined}
                        title={showLabels ? item.description : undefined}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors cursor-pointer ${
                          isActive ? 'nav-item-active' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        } ${!showLabels ? 'justify-center' : ''}`}
                      >
                        <span className="relative shrink-0 flex items-center justify-center">
                          <Icon className="w-5 h-5" aria-hidden="true" />
                          {!showLabels && item.badge !== undefined && (
                            <span className={`absolute -top-1.5 -right-2 text-[11px] font-bold px-1.5 rounded-full ring-2 ring-white tabular-nums ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                        </span>

                        {showLabels && (
                          <>
                            <span className="flex-1 text-left text-sm font-medium truncate">{item.label}</span>
                            {item.badge !== undefined && (
                              <span className={`shrink-0 min-w-6 text-center text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${item.badgeColor}`}>
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </button>

                      {/* Tooltip saat sidebar diciutkan */}
                      {!showLabels && (
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden group-hover:flex flex-col bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{item.label}</span>
                          <span className="text-[11px] text-slate-500">{item.description}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </nav>

        {/* Bottom: User Avatar Ring & Expand Toggle (Reference Image Style) */}
        <div className="px-3 pt-2 flex flex-col items-center gap-2 border-t border-slate-100">
          <div className="w-full flex items-center justify-between gap-1.5">
            <div
              className={`flex items-center gap-2.5 p-1 rounded-2xl flex-1 min-w-0 ${
                !expanded && !mobileMenuOpen ? 'justify-center' : ''
              }`}
              title={`Login: ${currentUser.name} (${currentUser.role}) — ${currentUser.email}`}
            >
              {/* Circular Avatar with Ring (Reference: Bottom-left avatar in reference image) */}
              <div className="relative shrink-0">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full ring-2 ring-slate-200 shadow-sm bg-slate-800 text-white flex items-center justify-center text-sm font-bold">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                    isOwner ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </div>

              {(expanded || mobileMenuOpen) && (
                <div className="text-left min-w-0 flex-1 animate-in fade-in">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {currentUser.name}
                  </div>
                  <span className="text-[11px] uppercase font-semibold text-slate-400">
                    {currentUser.role}
                  </span>
                </div>
              )}
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              title="Keluar dari Aplikasi (Logout)" aria-label="Keluar dari Aplikasi (Logout)"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop Expand / Collapse Dock Toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            title={expanded ? 'Kecilkan Sidebar Dock' : 'Perluas Sidebar Dock'} aria-label={expanded ? 'Kecilkan Sidebar Dock' : 'Perluas Sidebar Dock'}
          >
            {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
};
