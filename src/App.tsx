import React, { useState, useCallback, Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { QuickOrderModal } from './components/QuickOrderModal';
import { ReceiptModal } from './components/ReceiptModal';
import { LoginPage } from './components/LoginPage';
import { Order } from './types';
import { CheckCircle2, Receipt } from 'lucide-react';

// Dynamic code-splitting for views to optimize bundle size and instant initial load
const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const SalesView = lazy(() => import('./views/SalesView').then(m => ({ default: m.SalesView })));
const InventoryView = lazy(() => import('./views/InventoryView').then(m => ({ default: m.InventoryView })));
const ProductsView = lazy(() => import('./views/ProductsView').then(m => ({ default: m.ProductsView })));
const CustomersView = lazy(() => import('./views/CustomersView').then(m => ({ default: m.CustomersView })));
const ResellerView = lazy(() => import('./views/ResellerView').then(m => ({ default: m.ResellerView })));
const FinanceView = lazy(() => import('./views/FinanceView').then(m => ({ default: m.FinanceView })));
const PurchasesView = lazy(() => import('./views/PurchasesView').then(m => ({ default: m.PurchasesView })));
const ImportExportView = lazy(() => import('./views/ImportExportView').then(m => ({ default: m.ImportExportView })));
const AuditLogView = lazy(() => import('./views/AuditLogView').then(m => ({ default: m.AuditLogView })));
const UsersView = lazy(() => import('./views/UsersView').then(m => ({ default: m.UsersView })));

const MainLayout: React.FC = () => {
  const { currentView, quickOrderModalOpen, setQuickOrderModalOpen, theme, isOwner } = useApp();
  const [createdOrderForReceipt, setCreatedOrderForReceipt] = useState<Order | null>(null);
  const [showOrderSuccessBanner, setShowOrderSuccessBanner] = useState<Order | null>(null);

  const handleCloseQuickOrder = useCallback(() => {
    setQuickOrderModalOpen(false);
  }, [setQuickOrderModalOpen]);

  const handleOrderCreated = useCallback((order: Order) => {
    setShowOrderSuccessBanner(order);
    setTimeout(() => {
      setShowOrderSuccessBanner((current) => (current?.id === order.id ? null : current));
    }, 8000);
  }, []);

  return (
    <div
      className={`min-h-screen ${
        theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0d14] text-slate-100'
      } flex flex-col lg:flex-row antialiased font-sans selection:bg-amber-500 selection:text-black transition-colors duration-200`}
    >
      {/* Responsive Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <Header />

        {/* Floating Order Success Toast / Notification */}
        {showOrderSuccessBanner && (
          <div className="fixed bottom-5 right-5 z-40 bg-[#161c28] border border-amber-500/50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs pr-2">
              <div className="font-bold text-white">
                Pesanan Berhasil Disimpan! #{showOrderSuccessBanner.noOrder}
              </div>
              <div className="text-slate-400">
                Stok gudang telah terpotong otomatis ({showOrderSuccessBanner.items.reduce((a, b) => a + b.qty, 0)} pcs).
              </div>
            </div>
            <button
              onClick={() => {
                setCreatedOrderForReceipt(showOrderSuccessBanner);
                setShowOrderSuccessBanner(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Cetak Nota</span>
            </button>
            <button
              onClick={() => setShowOrderSuccessBanner(null)}
              className="p-1 text-slate-500 hover:text-white rounded"
            >
              ✕
            </button>
          </div>
        )}

        {/* View Switcher */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center min-h-[380px] gap-3">
                <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-slate-400">Memuat antarmuka modul...</span>
              </div>
            }
          >
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'sales' && <SalesView />}
            {currentView === 'inventory' && <InventoryView />}
            {currentView === 'purchases' && <PurchasesView />}
            {currentView === 'products' && <ProductsView />}
            {currentView === 'customers' && <CustomersView />}
            {currentView === 'reseller' && <ResellerView />}
            {currentView === 'finance' && <FinanceView />}
            {currentView === 'import_export' && <ImportExportView />}
            {currentView === 'audit' && <AuditLogView />}
            {currentView === 'users' && isOwner && <UsersView />}
          </Suspense>
        </main>
      </div>

      {/* Global Quick Order Modal (< 60s input) */}
      {quickOrderModalOpen && (
        <QuickOrderModal
          isOpen={quickOrderModalOpen}
          onClose={handleCloseQuickOrder}
          onOrderCreated={handleOrderCreated}
        />
      )}

      {/* Instant Receipt Printing Modal */}
      <ReceiptModal
        order={createdOrderForReceipt}
        onClose={() => setCreatedOrderForReceipt(null)}
      />
    </div>
  );
};

/** Data ERP hanya dimuat setelah pengguna login (sesi Worker) dan akunnya aktif. */
const AuthGate: React.FC = () => {
  const { status, appUser, signOut } = useAuth();

  if (status !== 'authorized' || !appUser) {
    return <LoginPage />;
  }

  return (
    <AppProvider key={appUser.id} authUser={appUser} onSignOut={signOut}>
      <MainLayout />
    </AppProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
