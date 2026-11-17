import React, { useState, useMemo } from 'react';
import { askConfirm } from '../services/dialogStore';
import {
  Truck,
  Package,
  FileText,
  Building2,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  ArrowDownLeft,
  DollarSign,
  Download,
  Calendar,
  Layers,
  MapPin,
  Phone,
  Printer,
  ChevronRight,
  ExternalLink,
  Edit2,
  Trash2,
  Check,
  X,
  CreditCard,
  Eye,
  Sparkles,
  ShoppingBag,
  Info,
  ShieldCheck,
  Send,
  Box,
  ClipboardCheck,
  Copy,
  BarChart3,
  TrendingUp,
  Scale,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchasePaymentStatus,
  Vendor,
  VendorCategory,
  SKUItem,
  ApparelSize,
} from '../types';
import { VendorPerformanceSummary } from '../components/VendorPerformanceSummary';

export const PurchasesView: React.FC = () => {
  const {
    purchaseOrders,
    vendors,
    skus,
    series,
    cashAccounts,
    isOwner,
    currentUser,
    createPurchaseOrder,
    updatePurchaseOrder,
    updatePOShipping,
    receivePOGoods,
    payPurchaseOrder,
    deletePurchaseOrder,
    addVendor,
    updateVendor,
    deleteVendor,
  } = useApp();

  // Navigation Tabs: 'orders' | 'tracking' | 'inbound' | 'vendors' | 'performance'
  const [activeTab, setActiveTab] = useState<'orders' | 'tracking' | 'inbound' | 'vendors' | 'performance'>('orders');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [shippingFilter, setShippingFilter] = useState<string>('ALL');

  // Modals
  const [isCreatePOModalOpen, setIsCreatePOModalOpen] = useState(false);
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [selectedPOForShipping, setSelectedPOForShipping] = useState<PurchaseOrder | null>(null);

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedPOForReceiving, setSelectedPOForReceiving] = useState<PurchaseOrder | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPOForPayment, setSelectedPOForPayment] = useState<PurchaseOrder | null>(null);

  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [selectedPOForDocument, setSelectedPOForDocument] = useState<PurchaseOrder | null>(null);

  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [selectedPOForTracking, setSelectedPOForTracking] = useState<PurchaseOrder | null>(null);

  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Success Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // KPI Calculations
  const kpiStats = useMemo(() => {
    const activePOs = purchaseOrders.filter(
      (po) => po.statusPO === 'dipesan' || po.statusPO === 'dikirim' || po.statusPO === 'diterima_sebagian'
    );
    const inTransitPOs = purchaseOrders.filter((po) => po.statusPO === 'dikirim');
    const inTransitQty = inTransitPOs.reduce((sum, po) => sum + (po.totalQtyPesan - (po.totalQtyDiterima || 0)), 0);

    const todayMonth = new Date().toISOString().substring(0, 7);
    const currentMonthPOs = purchaseOrders.filter((po) => po.tanggalPO.startsWith(todayMonth) && po.statusPO !== 'batal');
    const currentMonthSpend = currentMonthPOs.reduce((sum, po) => sum + po.totalTagihan, 0);

    const totalUnpaidDebt = purchaseOrders
      .filter((po) => po.statusPO !== 'batal')
      .reduce((sum, po) => sum + (po.sisaHutang || 0), 0);

    return {
      activePOCount: activePOs.length,
      inTransitCount: inTransitPOs.length,
      inTransitQty,
      currentMonthSpend,
      totalUnpaidDebt,
    };
  }, [purchaseOrders]);

  // Derive simple shipping status: 'diproses' | 'dalam_perjalanan' | 'diterima'
  const getShippingStatusKey = (po: PurchaseOrder): 'diproses' | 'dalam_perjalanan' | 'diterima' => {
    if (po.statusPO === 'diterima') return 'diterima';
    if (po.statusPO === 'dikirim') return 'dalam_perjalanan';
    return 'diproses';
  };

  // Filtered Orders
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (statusFilter !== 'ALL' && po.statusPO !== statusFilter) return false;
      if (vendorFilter !== 'ALL' && po.vendorId !== vendorFilter) return false;
      if (paymentFilter !== 'ALL' && po.statusBayar !== paymentFilter) return false;
      if (shippingFilter !== 'ALL') {
        const shipKey = getShippingStatusKey(po);
        if (shipKey !== shippingFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNoPO = po.noPO.toLowerCase().includes(q);
        const matchVendor = po.vendorNama.toLowerCase().includes(q);
        const matchResi = po.noResi?.toLowerCase().includes(q) || false;
        const matchItem = po.items.some((it) => it.namaProduk.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q));
        if (!matchNoPO && !matchVendor && !matchResi && !matchItem) return false;
      }
      return true;
    });
  }, [purchaseOrders, statusFilter, vendorFilter, paymentFilter, shippingFilter, searchQuery]);

  // Quick Action to update shipping status
  const handleQuickChangeShippingStatus = (
    po: PurchaseOrder,
    newStatus: 'diproses' | 'dalam_perjalanan' | 'diterima'
  ) => {
    if (newStatus === 'dalam_perjalanan') {
      if (!po.noResi || !po.ekspedisi) {
        setSelectedPOForShipping(po);
        setIsShipModalOpen(true);
      } else {
        updatePurchaseOrder(po.id, { statusPO: 'dikirim' });
        showToast(`Status pengiriman PO #${po.noPO} diubah menjadi Dalam Perjalanan.`);
      }
    } else if (newStatus === 'diterima') {
      setSelectedPOForReceiving(po);
      setIsReceiveModalOpen(true);
    } else if (newStatus === 'diproses') {
      updatePurchaseOrder(po.id, { statusPO: 'dipesan' });
      showToast(`Status pengiriman PO #${po.noPO} diubah menjadi Diproses (Pabrik).`);
    }
  };

  // Shipping Status Badge Component
  const getShippingStatusBadge = (po: PurchaseOrder) => {
    const shipKey = getShippingStatusKey(po);

    if (shipKey === 'diterima') {
      return (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => {
              setSelectedPOForTracking(po);
              setIsTrackingModalOpen(true);
            }}
            title="Klik untuk melihat detail timeline tracking" aria-label="Klik untuk melihat detail timeline tracking"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition-all cursor-pointer group shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-bold">Diterima</span>
          </button>
          <span className="text-[11px] text-emerald-700/80 font-mono">
            {po.tanggalDiterima ? `Tiba: ${po.tanggalDiterima}` : 'Gudang Utama'}
          </span>
        </div>
      );
    }

    if (shipKey === 'dalam_perjalanan') {
      return (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => {
              setSelectedPOForTracking(po);
              setIsTrackingModalOpen(true);
            }}
            title="Klik untuk melihat detail timeline tracking" aria-label="Klik untuk melihat detail timeline tracking"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 transition-all cursor-pointer group shadow-2xs"
          >
            <Truck className="w-3.5 h-3.5 text-blue-600 animate-pulse shrink-0" />
            <span className="font-bold">Dalam Perjalanan</span>
          </button>
          <span className="text-[11px] text-blue-700/80 font-mono max-w-[140px] truncate text-center">
            {po.ekspedisi || 'Kargo'} {po.noResi ? `· ${po.noResi}` : ''}
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => {
            setSelectedPOForTracking(po);
            setIsTrackingModalOpen(true);
          }}
          title="Klik untuk melihat detail timeline tracking" aria-label="Klik untuk melihat detail timeline tracking"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 transition-all cursor-pointer group shadow-2xs"
        >
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="font-bold">Diproses</span>
        </button>
        <span className="text-[11px] text-amber-700/80 font-normal">
          Vendor Pabrik / CMT
        </span>
      </div>
    );
  };

  // Status Badge Helper
  const getStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" /> Draf PO
          </span>
        );
      case 'dipesan':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> Dipesan ke Vendor
          </span>
        );
      case 'dikirim':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Truck className="w-3 h-3 text-blue-600" /> Dalam Pengiriman (Kargo)
          </span>
        );
      case 'diterima_sebagian':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Layers className="w-3 h-3 text-purple-600" /> Tiba Sebagian
          </span>
        );
      case 'diterima':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Diterima di Gudang
          </span>
        );
      case 'batal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3 h-3 text-rose-600" /> Dibatalkan
          </span>
        );
      default:
        return null;
    }
  };

  const getPaymentBadge = (status: PurchasePaymentStatus, sisa: number) => {
    switch (status) {
      case 'lunas':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Lunas</span>
          </span>
        );
      case 'dp':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>DP (Sisa Rp {sisa.toLocaleString('id-ID')})</span>
          </span>
        );
      case 'belum_bayar':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <CreditCard className="w-3 h-3 text-rose-600" />
            <span>Belum Bayar</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-white border border-slate-200/90 text-slate-800 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium">{toastMessage}</span>
          <button aria-label="Tutup" data-modal-close onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Pengadaan & Pembelian Kaos (Vendor PO)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Alur lengkap order kaos polos ke pabrik/vendor konveksi, tracking ekspedisi logistik, hingga penerimaan stok gudang.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setEditingVendor(null);
              setIsVendorModalOpen(true);
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>+ Vendor Baru</span>
          </button>

          <button
            onClick={() => setIsCreatePOModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer hover:shadow-sm"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Buat PO Kaos Baru</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* PO Aktif */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1.5 font-medium">
            <span>PO Aktif Berjalan</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {kpiStats.activePOCount}{' '}
            <span className="text-xs text-slate-400 font-sans font-normal">pesanan</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Dalam proses pabrik & kargo</div>
        </div>

        {/* Sedang Dikirim (In-Transit) */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1.5 font-medium">
            <span>Kaos In-Transit (Ekspedisi)</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600">
            {kpiStats.inTransitQty.toLocaleString('id-ID')}{' '}
            <span className="text-xs text-slate-400 font-sans font-normal">pcs</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {kpiStats.inTransitCount} resi pengiriman kargo aktif
          </div>
        </div>

        {/* Belanja Bulan Ini */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1.5 font-medium">
            <span>Belanja Bahan Bulan Ini</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600">
            Rp {kpiStats.currentMonthSpend.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total pengadaan bahan & CMT</div>
        </div>

        {/* Sisa Hutang Vendor */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1.5 font-medium">
            <span>Hutang Vendor (Berjalan)</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-600">
            Rp {kpiStats.totalUnpaidDebt.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-400 mt-1">Kewajiban pelunasan PO berjalan</div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="segmented-pill-bar flex flex-wrap items-center gap-1 bg-white">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'segmented-pill-active'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Daftar Purchase Order ({purchaseOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tracking')}
            className={`px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'tracking'
                ? 'segmented-pill-active'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Pelacakan In-Transit ({purchaseOrders.filter((p) => p.statusPO === 'dikirim').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inbound')}
            className={`px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'inbound'
                ? 'segmented-pill-active'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Penerimaan Barang Gudang</span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'vendors'
                ? 'segmented-pill-active'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Direktori Vendor ({vendors.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('performance')}
            className={`px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'performance'
                ? 'segmented-pill-active'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Performa Vendor & Keterlambatan</span>
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari PO, vendor, resi, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 transition-colors shadow-2xs"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAFTAR PURCHASE ORDER */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Vendor Performance Quick Insight Banner */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-blue-100/80 text-blue-700 border border-blue-200 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </span>
              <div>
                <span className="text-slate-900 font-bold block">
                  Ringkasan Kinerja & Tingkat Keterlambatan Pengiriman Vendor
                </span>
                <span className="text-slate-600 text-xs">
                  Tingkat Ketepatan Waktu: <strong className="text-emerald-700 font-mono">92% On-Time</strong> · Rata-rata Terlambat: <strong className="text-amber-700 font-mono">0.6 Hari</strong> · Lead Time: <strong className="text-blue-700 font-mono">4.8 Hari</strong>
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('performance')}
              className="px-3.5 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <span>Buka Grafik & Analisis Lengkap</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs text-xs">
            <span className="text-slate-500 flex items-center gap-1 font-semibold pl-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" /> Filter:
            </span>

            {/* Status PO Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-slate-900 focus:bg-white cursor-pointer font-medium"
            >
              <option value="ALL">Semua Status PO</option>
              <option value="dipesan">Dipesan (Proses Vendor)</option>
              <option value="dikirim">Sedang Dikirim (Kargo)</option>
              <option value="diterima_sebagian">Tiba Sebagian</option>
              <option value="diterima">Diterima Lengkap</option>
              <option value="draft">Draf PO</option>
              <option value="batal">Dibatalkan</option>
            </select>

            {/* Status Pengiriman Filter */}
            <select
              value={shippingFilter}
              onChange={(e) => setShippingFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-slate-900 focus:bg-white cursor-pointer font-medium"
            >
              <option value="ALL">Semua Status Pengiriman</option>
              <option value="diproses">⏳ Diproses (Pabrik)</option>
              <option value="dalam_perjalanan">Dalam Perjalanan (Kargo)</option>
              <option value="diterima">Diterima (Gudang)</option>
            </select>

            {/* Vendor Filter */}
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-slate-900 focus:bg-white cursor-pointer max-w-[200px] font-medium"
            >
              <option value="ALL">Semua Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nama}
                </option>
              ))}
            </select>

            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-slate-900 focus:bg-white cursor-pointer font-medium"
            >
              <option value="ALL">Semua Status Bayar</option>
              <option value="lunas">Lunas</option>
              <option value="dp">DP (Masih Ada Sisa)</option>
              <option value="belum_bayar">Belum Bayar</option>
            </select>

            {(statusFilter !== 'ALL' || shippingFilter !== 'ALL' || vendorFilter !== 'ALL' || paymentFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setShippingFilter('ALL');
                  setVendorFilter('ALL');
                  setPaymentFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-slate-500 hover:text-slate-900 text-xs font-medium underline ml-auto cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/90 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">No. PO & Tanggal</th>
                  <th className="px-4 py-3.5">Vendor / Pabrik</th>
                  <th className="px-4 py-3.5">Rincian Kaos (Items)</th>
                  <th className="px-4 py-3.5 text-center">Progres Penerimaan</th>
                  <th className="px-4 py-3.5 text-right">Total Tagihan</th>
                  <th className="px-4 py-3.5 text-center min-w-[210px]">Status Pengiriman</th>
                  <th className="px-4 py-3.5 text-center">Status Bayar</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2 opacity-60" />
                      Tidak ada data Purchase Order yang sesuai dengan pencarian / filter.
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => {
                    const receivedPct =
                      po.totalQtyPesan > 0
                        ? Math.min(100, Math.round(((po.totalQtyDiterima || 0) / po.totalQtyPesan) * 100))
                        : 0;
                    const shipStatus = getShippingStatusKey(po);

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* No PO & Date */}
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{po.noPO}</span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{po.tanggalPO}</span>
                          </div>
                        </td>

                        {/* Vendor */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{po.vendorNama}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{po.vendorKota}</span>
                          </div>
                        </td>

                        {/* Items Summary */}
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800">
                            {po.totalQtyPesan} pcs ({po.items.length} artikel SKU)
                          </div>
                          <div className="text-xs text-slate-400 line-clamp-1 max-w-[220px]">
                            {po.items.map((it) => `${it.qtyPesan}x ${it.size} ${it.colorName}`).join(', ')}
                          </div>
                        </td>

                        {/* Progress Bar Penerimaan */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 font-mono text-xs">
                            <span className={po.totalQtyDiterima > 0 ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                              {po.totalQtyDiterima || 0}
                            </span>
                            <span className="text-slate-300">/</span>
                            <span className="text-slate-700">{po.totalQtyPesan} pcs</span>
                          </div>
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full mx-auto mt-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                receivedPct === 100
                                  ? 'bg-emerald-500'
                                  : receivedPct > 0
                                  ? 'bg-purple-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${receivedPct}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{receivedPct}% diterima</div>
                        </td>

                        {/* Total Tagihan */}
                        <td className="px-4 py-3.5 text-right font-mono">
                          <div className="font-bold text-slate-900 text-xs">
                            Rp {po.totalTagihan.toLocaleString('id-ID')}
                          </div>
                          {po.biayaEkspedisi > 0 && (
                            <div className="text-[11px] text-slate-400">
                              +Ongkir Rp {po.biayaEkspedisi.toLocaleString('id-ID')}
                            </div>
                          )}
                        </td>

                        {/* Kolom: Status Pengiriman */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1.5 min-w-[200px]">
                            {/* Visual Status Badge */}
                            {getShippingStatusBadge(po)}

                            {/* Dropdown Selector Pilihan Status: Diproses, Dalam Perjalanan, Diterima & Tombol Tracking */}
                            <div className="w-full flex items-center justify-center gap-1.5 mt-1">
                              <select
                                value={shipStatus}
                                onChange={(e) =>
                                  handleQuickChangeShippingStatus(
                                    po,
                                    e.target.value as 'diproses' | 'dalam_perjalanan' | 'diterima'
                                  )
                                }
                                title="Ubah Status Pengiriman Langsung"
                                className={`text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer transition-colors ${
                                  shipStatus === 'diterima'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300'
                                    : shipStatus === 'dalam_perjalanan'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-300'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300'
                                }`}
                              >
                                <option value="diproses" className="bg-white text-amber-700">
                                  ⏳ Diproses
                                </option>
                                <option value="dalam_perjalanan" className="bg-white text-blue-700">
                                  Dalam Perjalanan
                                </option>
                                <option value="diterima" className="bg-white text-emerald-700">
                                  Diterima
                                </option>
                              </select>

                              <button
                                onClick={() => {
                                  setSelectedPOForTracking(po);
                                  setIsTrackingModalOpen(true);
                                }}
                                title="Buka Modal Detail Tracking Pesanan Vendor" aria-label="Buka Modal Detail Tracking Pesanan Vendor"
                                className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              >
                                <Eye className="w-3 h-3 text-slate-500" />
                                <span>Lacak</span>
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Status Bayar */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            {getPaymentBadge(po.statusBayar, po.sisaHutang)}
                            {po.sisaHutang > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedPOForPayment(po);
                                  setIsPaymentModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                                title="Buka form pelunasan utang vendor" aria-label="Buka form pelunasan utang vendor"
                              >
                                <DollarSign className="w-3 h-3 text-amber-600" />
                                <span>Bayar Hutang</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Tracking Detail Modal Button */}
                            <button
                              onClick={() => {
                                setSelectedPOForTracking(po);
                                setIsTrackingModalOpen(true);
                              }}
                              title="Buka Modal Detail Tracking & Perjalanan Barang" aria-label="Buka Modal Detail Tracking & Perjalanan Barang"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                            >
                              <Truck className="w-3.5 h-3.5 text-blue-600" />
                            </button>

                            {/* Cetak PO Document */}
                            <button
                              onClick={() => {
                                setSelectedPOForDocument(po);
                                setIsDocumentModalOpen(true);
                              }}
                              title="Lihat & Cetak Dokumen PO Resmi" aria-label="Lihat & Cetak Dokumen PO Resmi"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-600" />
                            </button>

                            {/* Update Shipping (Resi) */}
                            {po.statusPO !== 'diterima' && po.statusPO !== 'batal' && (
                              <button
                                onClick={() => {
                                  setSelectedPOForShipping(po);
                                  setIsShipModalOpen(true);
                                }}
                                title="Update Ekspedisi & Nomor Resi Kargo" aria-label="Update Ekspedisi & Nomor Resi Kargo"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200/80 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Goods Receipt (Terima Barang ke Gudang) */}
                            {po.statusPO !== 'diterima' && po.statusPO !== 'batal' && (
                              <button
                                onClick={() => {
                                  setSelectedPOForReceiving(po);
                                  setIsReceiveModalOpen(true);
                                }}
                                title="Terima Barang & Masukkan ke Stok Gudang" aria-label="Terima Barang & Masukkan ke Stok Gudang"
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200/80 transition-colors cursor-pointer"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete PO (Owner only) */}
                            {isOwner && (
                              <button
                                onClick={async () => {
                                  if (await askConfirm(`Hapus ${po.noPO} dari sistem?`, { danger: true })) {
                                    deletePurchaseOrder(po.id);
                                    showToast(`Purchase Order #${po.noPO} berhasil dihapus.`);
                                  }
                                }}
                                title="Hapus PO" aria-label="Hapus PO"
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PELACAKAN PENGIRIMAN & IN-TRANSIT KARGO */}
      {/* ========================================================================= */}
      {activeTab === 'tracking' && (
        <div className="space-y-4">
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              Paket & Karung Kargo Sedang Dalam Perjalanan (*In-Transit*)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Pantau kiriman bahan kaos dari vendor ke Gudang Utama Kalima. Klik tombol konfirmasi ketika kurir tiba untuk langsung mencatat penerimaan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {purchaseOrders.filter((po) => po.statusPO === 'dikirim').length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2 opacity-50" />
                Saat ini tidak ada paket kaos yang sedang dalam status pengiriman (In-Transit).
              </div>
            ) : (
              purchaseOrders
                .filter((po) => po.statusPO === 'dikirim')
                .map((po) => (
                  <div
                    key={po.id}
                    className="bg-white rounded-2xl border border-blue-200/90 p-5 space-y-4 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">{po.noPO}</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-bold rounded border border-blue-200">
                            IN-TRANSIT
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 mt-1">{po.vendorNama}</div>
                        <div className="text-xs text-slate-500">{po.vendorKota}</div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedPOForReceiving(po);
                          setIsReceiveModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Barang Tiba (Terima)</span>
                      </button>
                    </div>

                    {/* Logistics Card Grid */}
                    <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-slate-400 text-xs block">Jasa Ekspedisi / Kargo</span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                          <Truck className="w-3.5 h-3.5 text-blue-600" />
                          {po.ekspedisi || 'Kargo Rekanan'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-xs block">Nomor Resi / AWB</span>
                        <span className="font-mono font-bold text-amber-700 mt-0.5 block">
                          {po.noResi || 'Menunggu Resi'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-xs block">Tanggal Pengiriman</span>
                        <span className="text-slate-700 mt-0.5 block font-mono">{po.tanggalKirim || '-'}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-xs block">Estimasi Tiba di Gudang</span>
                        <span className="font-semibold text-emerald-700 mt-0.5 block font-mono">
                          {po.estimasiTiba || '1-3 Hari Kerja'}
                        </span>
                      </div>
                    </div>

                    {/* Items payload breakdown */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="text-xs font-semibold text-slate-500 mb-1.5">
                        Muatan Kaos ({po.totalQtyPesan} pcs total):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {po.items.map((it) => (
                          <span
                            key={it.sku}
                            className="text-xs px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono"
                          >
                            <strong>{it.qtyPesan} pcs</strong> · {it.size} {it.colorName}
                          </span>
                        ))}
                      </div>
                    </div>

                    {po.catatanPengiriman && (
                      <div className="text-xs bg-slate-50 p-2.5 rounded-xl text-slate-600 border border-slate-200/60">
                        <span className="font-semibold text-slate-700">Catatan Driver/Kurir:</span>{' '}
                        {po.catatanPengiriman}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: POS PENERIMAAN BARANG GUDANG (GOODS RECEIPT STATION) */}
      {/* ========================================================================= */}
      {activeTab === 'inbound' && (
        <div className="space-y-4">
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" />
              Pos Penerimaan & Quality Control Barang Masuk (*Goods Receipt Station*)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Daftar seluruh Purchase Order yang siap atau sedang diproses masuk ke Gudang Utama. Petugas gudang dapat langsung mencocokkan jumlah fisik dan memasukkan ke inventori.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {purchaseOrders
              .filter((po) => po.statusPO === 'dikirim' || po.statusPO === 'dipesan' || po.statusPO === 'diterima_sebagian')
              .map((po) => (
                <div
                  key={po.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 flex flex-col justify-between shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-slate-900 text-xs">{po.noPO}</span>
                      {getStatusBadge(po.statusPO)}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{po.vendorNama}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Tujuan: {po.gudangTujuan || 'Gudang Utama'}</p>

                    <div className="mt-3.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Total Dipesan:</span>
                        <span className="font-bold text-slate-900 font-mono">{po.totalQtyPesan} pcs</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Sudah Diterima:</span>
                        <span className="font-bold text-emerald-700 font-mono">{po.totalQtyDiterima || 0} pcs</span>
                      </div>
                      <div className="flex justify-between text-slate-500 pt-1.5 border-t border-slate-200">
                        <span>Sisa Menunggu Masuk:</span>
                        <span className="font-bold text-amber-700 font-mono">
                          {Math.max(0, po.totalQtyPesan - (po.totalQtyDiterima || 0))} pcs
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPOForReceiving(po);
                      setIsReceiveModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs hover:shadow-sm"
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                    <span>Buka Checklist Penerimaan Gudang</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DIREKTORI VENDOR & SUPPLIER */}
      {/* ========================================================================= */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-600" />
                Direktori Vendor Pabrik Rajut & Konveksi Rekanan
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola data supplier bahan combed 210/290 GSM, penjahit CMT garmen, sablon presisi, dan packaging Kalima.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingVendor(null);
                setIsVendorModalOpen(true);
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Tambah Vendor Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vendors.map((ven) => (
              <div
                key={ven.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80">
                      {ven.kategori}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 mt-1.5">{ven.nama}</h4>
                    {ven.kontakPerson && (
                      <p className="text-xs text-slate-500">PIC: {ven.kontakPerson}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingVendor(ven);
                        setIsVendorModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Edit Vendor" aria-label="Edit Vendor"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isOwner && (
                      <button
                        onClick={async () => {
                          if (await askConfirm(`Hapus vendor ${ven.nama}?`, { danger: true })) {
                            const res = deleteVendor(ven.id);
                            if (res.success) {
                              showToast(`Vendor ${ven.nama} berhasil dihapus.`);
                            } else {
                              showToast(res.error || 'Gagal menghapus vendor.');
                            }
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus Vendor" aria-label="Hapus Vendor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-800">{ven.noHp}</span>
                    <a
                      href={`https://wa.me/${ven.noHp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold hover:underline flex items-center gap-0.5 ml-1"
                    >
                      <span>Chat WA</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      {ven.alamat}, {ven.kota}
                    </span>
                  </div>

                  {ven.rekeningBank && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">{ven.rekeningBank}</span>
                    </div>
                  )}
                </div>

                {ven.catatan && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    {ven.catatan}
                  </div>
                )}

                {/* Vendor PO Stats Footer */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
                  <div className="text-slate-500">
                    Total Order:{' '}
                    <strong className="text-slate-900 font-mono">{ven.totalPO || 0} PO</strong>
                  </div>
                  <div className="text-slate-500">
                    Akumulasi Belanja:{' '}
                    <strong className="text-slate-900 font-mono">
                      Rp {(ven.totalBelanja || 0).toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RINGKASAN PERFORMA VENDOR & KETERLAMBATAN PENGIRIMAN (RECHARTS) */}
      {/* ========================================================================= */}
      {activeTab === 'performance' && (
        <VendorPerformanceSummary
          purchaseOrders={purchaseOrders}
          vendors={vendors}
          onOpenCreatePO={() => setIsCreatePOModalOpen(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: BUAT PURCHASE ORDER BARU */}
      {/* ========================================================================= */}
      {isCreatePOModalOpen && (
        <CreatePOModal
          isOpen={isCreatePOModalOpen}
          onClose={() => setIsCreatePOModalOpen(false)}
          vendors={vendors}
          skus={skus}
          cashAccounts={cashAccounts}
          onCreated={(po) => {
            setIsCreatePOModalOpen(false);
            showToast(`Purchase Order #${po.noPO} berhasil diterbitkan!`);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: UPDATE EKSPEDISI & PENGIRIMAN (SHIPPING) */}
      {/* ========================================================================= */}
      {isShipModalOpen && selectedPOForShipping && (
        <ShipPOModal
          isOpen={isShipModalOpen}
          onClose={() => {
            setIsShipModalOpen(false);
            setSelectedPOForShipping(null);
          }}
          po={selectedPOForShipping}
          onSave={(shippingData) => {
            updatePOShipping(selectedPOForShipping.id, shippingData);
            setIsShipModalOpen(false);
            setSelectedPOForShipping(null);
            showToast(`Status pengiriman PO #${selectedPOForShipping.noPO} berhasil diupdate!`);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PENERIMAAN BARANG GUDANG (GOODS RECEIPT / QC) */}
      {/* ========================================================================= */}
      {isReceiveModalOpen && selectedPOForReceiving && (
        <ReceivePOModal
          isOpen={isReceiveModalOpen}
          onClose={() => {
            setIsReceiveModalOpen(false);
            setSelectedPOForReceiving(null);
          }}
          po={selectedPOForReceiving}
          currentUser={currentUser}
          onReceived={(receiptData) => {
            const res = receivePOGoods(selectedPOForReceiving.id, receiptData);
            setIsReceiveModalOpen(false);
            setSelectedPOForReceiving(null);
            showToast(res.message || 'Penerimaan barang berhasil diposting ke kartu stok gudang!');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PEMBAYARAN HUTANG PO */}
      {/* ========================================================================= */}
      {isPaymentModalOpen && selectedPOForPayment && (
        <PaymentPOModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPOForPayment(null);
          }}
          po={selectedPOForPayment}
          cashAccounts={cashAccounts}
          onPay={(payData) => {
            const res = payPurchaseOrder(selectedPOForPayment.id, payData);
            if (res.success) {
              setIsPaymentModalOpen(false);
              setSelectedPOForPayment(null);
              showToast(`Pembayaran PO #${selectedPOForPayment.noPO} berhasil. Jurnal otomatis terbit: Debit Utang Dagang & Kredit Kas/Bank.`);
            } else {
              showToast(res.error || 'Gagal memproses pembayaran PO.');
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DOKUMEN CETAK PO RESMI KALIMA */}
      {/* ========================================================================= */}
      {isDocumentModalOpen && selectedPOForDocument && (
        <PODocumentModal
          isOpen={isDocumentModalOpen}
          onClose={() => {
            setIsDocumentModalOpen(false);
            setSelectedPOForDocument(null);
          }}
          po={selectedPOForDocument}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: DETAIL TRACKING PENGIRIMAN & TIMELINE LOGISTIK */}
      {/* ========================================================================= */}
      {isTrackingModalOpen && selectedPOForTracking && (
        <TrackingDetailModal
          isOpen={isTrackingModalOpen}
          onClose={() => {
            setIsTrackingModalOpen(false);
            setSelectedPOForTracking(null);
          }}
          po={selectedPOForTracking}
          onOpenShipModal={() => {
            setSelectedPOForShipping(selectedPOForTracking);
            setIsShipModalOpen(true);
          }}
          onOpenReceiveModal={() => {
            setSelectedPOForReceiving(selectedPOForTracking);
            setIsReceiveModalOpen(true);
          }}
          onOpenDocumentModal={() => {
            setSelectedPOForDocument(selectedPOForTracking);
            setIsDocumentModalOpen(true);
          }}
          onChangeShippingStatus={(newStatus) => {
            handleQuickChangeShippingStatus(selectedPOForTracking, newStatus);
            // Sync current selected PO
            const updated = purchaseOrders.find((p) => p.id === selectedPOForTracking.id);
            if (updated) setSelectedPOForTracking(updated);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: FORM VENDOR (TAMBAH / EDIT) */}
      {/* ========================================================================= */}
      {isVendorModalOpen && (
        <VendorFormModal
          isOpen={isVendorModalOpen}
          onClose={() => {
            setIsVendorModalOpen(false);
            setEditingVendor(null);
          }}
          editingVendor={editingVendor}
          onSave={(venData) => {
            if (editingVendor) {
              updateVendor(editingVendor.id, venData);
              showToast(`Profil vendor ${venData.nama} berhasil diperbarui.`);
            } else {
              addVendor(venData);
              showToast(`Vendor baru ${venData.nama} berhasil ditambahkan.`);
            }
            setIsVendorModalOpen(false);
            setEditingVendor(null);
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: CREATE PURCHASE ORDER MODAL
// ============================================================================
interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  skus: SKUItem[];
  cashAccounts: any[];
  onCreated: (po: PurchaseOrder) => void;
}

const CreatePOModal: React.FC<CreatePOModalProps> = ({
  isOpen,
  onClose,
  vendors,
  skus,
  cashAccounts,
  onCreated,
}) => {
  const { createPurchaseOrder } = useApp();
  const todayStr = new Date().toISOString().split('T')[0];

  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [formError, setFormError] = useState<string | null>(null);
  const [tanggalPO, setTanggalPO] = useState(todayStr);
  const [jatuhTempoBayar, setJatuhTempoBayar] = useState('');
  const [biayaEkspedisi, setBiayaEkspedisi] = useState<number>(0);
  const [biayaTambahan, setBiayaTambahan] = useState<number>(0);
  const [catatanPO, setCatatanPO] = useState('');

  // Shipping details optional at creation
  const [ekspedisi, setEkspedisi] = useState('');
  const [noResi, setNoResi] = useState('');
  const [estimasiTiba, setEstimasiTiba] = useState('');

  // Payment at creation
  const [paymentOption, setPaymentOption] = useState<'belum_bayar' | 'dp' | 'lunas'>('belum_bayar');
  const [jumlahTerbayar, setJumlahTerbayar] = useState<number>(0);
  const [accountId, setAccountId] = useState(cashAccounts[0]?.id || '');

  // Line items
  const [poItems, setPoItems] = useState<
    { sku: string; qtyPesan: number; hargaBeliSatuan: number; catatan: string }[]
  >([
    {
      sku: skus[0]?.sku || '',
      qtyPesan: 50,
      hargaBeliSatuan: skus[0]?.hpp || 48000,
      catatan: '',
    },
  ]);

  // Calculations
  const totalBiayaBahan = useMemo(() => {
    return poItems.reduce((sum, it) => sum + it.qtyPesan * it.hargaBeliSatuan, 0);
  }, [poItems]);

  const totalQtyPcs = useMemo(() => {
    return poItems.reduce((sum, it) => sum + it.qtyPesan, 0);
  }, [poItems]);

  const totalTagihan = totalBiayaBahan + (biayaEkspedisi || 0) + (biayaTambahan || 0);

  // Sync payment amount when option changes
  const handlePaymentOptionChange = (opt: 'belum_bayar' | 'dp' | 'lunas') => {
    setPaymentOption(opt);
    if (opt === 'lunas') {
      setJumlahTerbayar(totalTagihan);
    } else if (opt === 'dp') {
      setJumlahTerbayar(Math.round(totalTagihan * 0.5));
    } else {
      setJumlahTerbayar(0);
    }
  };

  const handleAddItem = () => {
    const defaultSku = skus[0];
    setPoItems([
      ...poItems,
      {
        sku: defaultSku?.sku || '',
        qtyPesan: 50,
        hargaBeliSatuan: defaultSku?.hpp || 48000,
        catatan: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (poItems.length === 1) return;
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const next = [...poItems];
    if (field === 'sku') {
      const skuObj = skus.find((s) => s.sku === val);
      next[index].sku = val;
      if (skuObj && skuObj.hpp) {
        next[index].hargaBeliSatuan = skuObj.hpp;
      }
    } else if (field === 'qtyPesan') {
      next[index].qtyPesan = parseInt(val, 10) || 0;
    } else if (field === 'hargaBeliSatuan') {
      next[index].hargaBeliSatuan = parseInt(val, 10) || 0;
    } else if (field === 'catatan') {
      next[index].catatan = val;
    }
    setPoItems(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!vendorId) {
      setFormError('Pilih vendor supplier terlebih dahulu.');
      return;
    }
    if (poItems.length === 0 || poItems.some((it) => it.qtyPesan <= 0)) {
      setFormError('Pastikan setiap item memiliki jumlah kuantiti pesanan minimal 1 pcs.');
      return;
    }

    const res = createPurchaseOrder({
      vendorId,
      tanggalPO,
      items: poItems,
      biayaEkspedisi,
      biayaTambahan,
      statusBayar: paymentOption,
      jumlahTerbayar: paymentOption === 'belum_bayar' ? 0 : jumlahTerbayar,
      jatuhTempoBayar: jatuhTempoBayar || undefined,
      accountId: paymentOption !== 'belum_bayar' ? accountId : undefined,
      ekspedisi: ekspedisi.trim() || undefined,
      noResi: noResi.trim() || undefined,
      estimasiTiba: estimasiTiba.trim() || undefined,
      catatanPO: catatanPO.trim() || undefined,
    });

    if (res.success && res.po) {
      onCreated(res.po);
    } else {
      setFormError(res.error || 'Gagal membuat Purchase Order.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
              <Plus className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Buat Purchase Order (PO) Kaos Baru</h3>
              <p className="text-xs text-slate-500">Terbitkan order resmi pengadaan bahan / CMT ke vendor pabrik.</p>
            </div>
          </div>
          <button aria-label="Tutup" data-modal-close onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-600">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {formError}
            </div>
          )}
          {/* Vendor & General Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Pilih Vendor / Pabrik *</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900 font-medium cursor-pointer shadow-2xs"
                required
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nama} ({v.kategori}) - {v.kota}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Tanggal Terbit PO *</label>
              <input
                type="date"
                value={tanggalPO}
                onChange={(e) => setTanggalPO(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900 font-mono shadow-2xs"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Jatuh Tempo Pembayaran</label>
              <input
                type="date"
                value={jatuhTempoBayar}
                onChange={(e) => setJatuhTempoBayar(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900 font-mono shadow-2xs"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-amber-600" />
                Daftar Kaos & Bahan yang Dipesan ({totalQtyPcs} pcs)
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> + Tambah SKU Kaos
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="px-3.5 py-2.5">Artikel SKU Kaos</th>
                    <th className="px-3.5 py-2.5 w-28 text-center">Qty (Pcs)</th>
                    <th className="px-3.5 py-2.5 w-36 text-right">Harga Satuan (Rp)</th>
                    <th className="px-3.5 py-2.5 w-36 text-right">Subtotal</th>
                    <th className="px-3.5 py-2.5">Catatan Spesifikasi</th>
                    <th className="px-2 py-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {poItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="px-3.5 py-2">
                        <select
                          value={item.sku}
                          onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-slate-900 focus:bg-white font-medium"
                        >
                          {skus.map((s) => (
                            <option key={s.sku} value={s.sku}>
                              {s.sku} - {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3.5 py-2">
                        <input
                          type="number"
                          min="1"
                          value={item.qtyPesan}
                          onChange={(e) => handleItemChange(idx, 'qtyPesan', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-center font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white font-bold"
                        />
                      </td>
                      <td className="px-3.5 py-2">
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={item.hargaBeliSatuan}
                          onChange={(e) => handleItemChange(idx, 'hargaBeliSatuan', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-right font-mono text-amber-700 font-semibold focus:outline-none focus:border-slate-900 focus:bg-white"
                        />
                      </td>
                      <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900">
                        Rp {(item.qtyPesan * item.hargaBeliSatuan).toLocaleString('id-ID')}
                      </td>
                      <td className="px-3.5 py-2">
                        <input
                          type="text"
                          placeholder="e.g. Rib leher 3cm / Celup reaktif"
                          value={item.catatan}
                          onChange={(e) => handleItemChange(idx, 'catatan', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={poItems.length === 1}
                          className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shipping & Additional Costs Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Shipping Info */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                Informasi Ekspedisi / Kargo (Opsional)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 text-xs mb-1 font-medium">Jasa Kargo / Ekspedisi</label>
                  <input
                    type="text"
                    placeholder="e.g. Dakota, Indah Kargo, Baraka"
                    value={ekspedisi}
                    onChange={(e) => setEkspedisi(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-xs mb-1 font-medium">Nomor Resi / AWB</label>
                  <input
                    type="text"
                    placeholder="e.g. DKT-109283"
                    value={noResi}
                    onChange={(e) => setNoResi(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 text-xs mb-1 font-medium">Estimasi Tanggal Tiba</label>
                <input
                  type="date"
                  value={estimasiTiba}
                  onChange={(e) => setEstimasiTiba(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {/* Financial Summary & Payment */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                Kalkulasi Tagihan & Pembayaran
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 text-xs mb-1 font-medium">Ongkos Kirim Kargo (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={biayaEkspedisi}
                    onChange={(e) => setBiayaEkspedisi(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-right font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-xs mb-1 font-medium">Biaya Tambahan / Packing (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={biayaTambahan}
                    onChange={(e) => setBiayaTambahan(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-right font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 font-bold shadow-2xs">
                <span className="text-slate-600">Total Nilai Purchase Order:</span>
                <span className="text-slate-900 font-mono text-sm">
                  Rp {totalTagihan.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Payment Option */}
              <div className="space-y-2 pt-1">
                <label className="block text-slate-600 text-xs font-semibold">
                  Termin Pembayaran Awal:
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handlePaymentOptionChange('belum_bayar')}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      paymentOption === 'belum_bayar'
                        ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-2xs font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Belum Bayar
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentOptionChange('dp')}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      paymentOption === 'dp'
                        ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-2xs font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    DP (Uang Muka)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentOptionChange('lunas')}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      paymentOption === 'lunas'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-2xs font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Bayar Lunas
                  </button>
                </div>

                {paymentOption !== 'belum_bayar' && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-slate-500 text-[11px] mb-0.5 font-medium">Nominal Bayar Sekarang (Rp)</label>
                      <input
                        type="number"
                        min="1"
                        max={totalTagihan}
                        value={jumlahTerbayar}
                        onChange={(e) => setJumlahTerbayar(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-emerald-700 text-right font-bold focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 text-[11px] mb-0.5 font-medium">Debit dari Akun Kas/Bank</label>
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 font-medium cursor-pointer focus:outline-none focus:border-slate-900"
                      >
                        {cashAccounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.nama} (Rp {acc.saldo.toLocaleString('id-ID')})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {paymentOption !== 'belum_bayar' && jumlahTerbayar > 0 && (
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200/80 text-[11px] text-blue-700 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Terjurnal otomatis ke Neraca: <strong>Debit Utang/DP</strong> & <strong>Kredit Kas/Bank</strong> Rp {jumlahTerbayar.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Catatan PO Tambahan</label>
            <textarea
              rows={2}
              placeholder="Instruksi packing koli, tenggat pengiriman, atau catatan perjanjian..."
              value={catatanPO}
              onChange={(e) => setCatatanPO(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>Terbitkan Purchase Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: SHIP PO MODAL (UPDATE RESI & EKSPEDISI)
// ============================================================================
interface ShipPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder;
  onSave: (shippingData: {
    ekspedisi: string;
    noResi: string;
    tanggalKirim: string;
    estimasiTiba?: string;
    catatanPengiriman?: string;
  }) => void;
}

const ShipPOModal: React.FC<ShipPOModalProps> = ({ isOpen, onClose, po, onSave }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ekspedisi, setEkspedisi] = useState(po.ekspedisi || 'Dakota Cargo');
  const [noResi, setNoResi] = useState(po.noResi || '');
  const [tanggalKirim, setTanggalKirim] = useState(po.tanggalKirim || todayStr);
  const [estimasiTiba, setEstimasiTiba] = useState(po.estimasiTiba || '');
  const [catatanPengiriman, setCatatanPengiriman] = useState(po.catatanPengiriman || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!ekspedisi.trim()) {
      setErrorMsg('Masukkan nama jasa ekspedisi/kargo.');
      return;
    }
    if (!noResi.trim()) {
      setErrorMsg('Masukkan nomor resi pengiriman kargo.');
      return;
    }
    onSave({
      ekspedisi: ekspedisi.trim(),
      noResi: noResi.trim(),
      tanggalKirim,
      estimasiTiba: estimasiTiba || undefined,
      catatanPengiriman: catatanPengiriman.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 text-xs text-slate-600">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 shadow-2xs">
              <Truck className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Update Resi & Ekspedisi Pengiriman</h3>
              <p className="text-xs text-slate-500">{po.noPO} · Vendor: {po.vendorNama}</p>
            </div>
          </div>
          <button aria-label="Tutup" data-modal-close onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Jasa Ekspedisi / Kargo *</label>
            <input
              type="text"
              placeholder="e.g. Dakota Cargo, Indah Kargo, JNE Trucking, Baraka"
              value={ekspedisi}
              onChange={(e) => setEkspedisi(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-900 focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Nomor Resi / AWB Kargo *</label>
            <input
              type="text"
              placeholder="e.g. DKT-BDG-9988123"
              value={noResi}
              onChange={(e) => setNoResi(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-slate-900 focus:bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Tanggal Kirim *</label>
              <input
                type="date"
                value={tanggalKirim}
                onChange={(e) => setTanggalKirim(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-slate-900 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Estimasi Tiba</label>
              <input
                type="date"
                value={estimasiTiba}
                onChange={(e) => setEstimasiTiba(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-slate-900 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Catatan Pengiriman / Koli</label>
            <textarea
              rows={2}
              placeholder="e.g. 4 karung koli besar tersegel lakban Kalima..."
              value={catatanPengiriman}
              onChange={(e) => setCatatanPengiriman(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white"
            />
          </div>

          <div className="pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-blue-400" />
              <span>Simpan & Set Status IN-TRANSIT</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: RECEIVE PO GOODS MODAL (INBOUND QC & STOCK IN)
// ============================================================================
interface ReceivePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder;
  currentUser: any;
  onReceived: (receiptData: {
    tanggalDiterima: string;
    penerimaGudang: string;
    kondisiPenerimaan: 'lengkap_sempurna' | 'ada_reject' | 'selisih_kurang' | 'kelebihan_qc';
    itemsReceived: { sku: string; qtyDiterima: number }[];
    catatanPenerimaan?: string;
    autoStockIn?: boolean;
  }) => void;
}

const ReceivePOModal: React.FC<ReceivePOModalProps> = ({
  isOpen,
  onClose,
  po,
  currentUser,
  onReceived,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [tanggalDiterima, setTanggalDiterima] = useState(todayStr);
  const [penerimaGudang, setPenerimaGudang] = useState(currentUser?.name || 'Staff Gudang');
  const [kondisiPenerimaan, setKondisiPenerimaan] = useState<
    'lengkap_sempurna' | 'ada_reject' | 'selisih_kurang' | 'kelebihan_qc'
  >('lengkap_sempurna');
  const [catatanPenerimaan, setCatatanPenerimaan] = useState('');

  // Initial map of incoming quantities (default: remaining expected quantity)
  const [receivedMap, setReceivedMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    po.items.forEach((it) => {
      const remaining = Math.max(0, it.qtyPesan - (it.qtyDiterima || 0));
      map[it.sku] = remaining;
    });
    return map;
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalIncomingPcs = useMemo(() => {
    return Object.values(receivedMap).reduce((sum, val) => sum + (val || 0), 0);
  }, [receivedMap]);

  const handleQtyChange = (sku: string, val: string) => {
    const num = parseInt(val, 10) || 0;
    setReceivedMap((prev) => ({
      ...prev,
      [sku]: num,
    }));
  };

  const handleFullFillAll = () => {
    const map: Record<string, number> = {};
    po.items.forEach((it) => {
      const remaining = Math.max(0, it.qtyPesan - (it.qtyDiterima || 0));
      map[it.sku] = remaining;
    });
    setReceivedMap(map);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (totalIncomingPcs <= 0) {
      setErrorMsg('Masukkan jumlah kuantiti kaos yang diterima fisik (minimal 1 pcs).');
      return;
    }

    const itemsReceived = po.items.map((it) => ({
      sku: it.sku,
      qtyDiterima: receivedMap[it.sku] || 0,
    }));

    onReceived({
      tanggalDiterima,
      penerimaGudang,
      kondisiPenerimaan,
      itemsReceived,
      catatanPenerimaan: catatanPenerimaan.trim() || undefined,
      autoStockIn: true,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 text-xs text-slate-600 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 shadow-2xs">
              <ClipboardCheck className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Checklist & Penerimaan Barang Gudang</h3>
              <p className="text-xs text-slate-500">
                {po.noPO} · Vendor: {po.vendorNama}
              </p>
            </div>
          </div>
          <button aria-label="Tutup" data-modal-close onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Tanggal Diterima *</label>
              <input
                type="date"
                value={tanggalDiterima}
                onChange={(e) => setTanggalDiterima(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Petugas Penerima Gudang *</label>
              <input
                type="text"
                value={penerimaGudang}
                onChange={(e) => setPenerimaGudang(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Kondisi Paket / QC *</label>
              <select
                value={kondisiPenerimaan}
                onChange={(e) => setKondisiPenerimaan(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 cursor-pointer focus:outline-none focus:border-slate-900"
              >
                <option value="lengkap_sempurna">Lengkap Sempurna</option>
                <option value="ada_reject">Ada Cacat / Reject</option>
                <option value="selisih_kurang">Selisih Kurang Kirim</option>
                <option value="kelebihan_qc">Surplus / Lebih Kirim</option>
              </select>
            </div>
          </div>

          {/* SKU Checklist Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs">
                Hitung Fisik Kaos Masuk ({totalIncomingPcs} pcs baru)
              </span>
              <button
                type="button"
                onClick={handleFullFillAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer underline"
              >
                Isi Sesuai Sisa PO
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="px-3.5 py-2.5">Artikel SKU Kaos</th>
                    <th className="px-3.5 py-2.5 text-center">Total Order</th>
                    <th className="px-3.5 py-2.5 text-center">Telah Masuk</th>
                    <th className="px-3.5 py-2.5 text-center w-28">Fisik Tiba Saat Ini</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {po.items.map((it) => {
                    const previouslyReceived = it.qtyDiterima || 0;
                    const remaining = Math.max(0, it.qtyPesan - previouslyReceived);
                    const currentVal = receivedMap[it.sku] ?? 0;

                    return (
                      <tr key={it.sku} className="hover:bg-slate-50/60">
                        <td className="px-3.5 py-2.5">
                          <div className="font-mono font-bold text-slate-900">{it.sku}</div>
                          <div className="text-xs text-slate-500">{it.namaProduk}</div>
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono text-slate-700">
                          {it.qtyPesan} pcs
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono text-emerald-700 font-bold">
                          {previouslyReceived} pcs
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            value={currentVal}
                            onChange={(e) => handleQtyChange(it.sku, e.target.value)}
                            className="w-full bg-slate-50 border border-emerald-300 rounded-lg px-2 py-1 text-center font-mono font-bold text-emerald-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Automatic Warehouse Notification */}
          <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Posting Otomatis ke Kartu Stok Gudang</span>
              Ketika Anda menekan tombol simpan, sistem akan otomatis mencatat riwayat pergerakan stok masuk (*Stock Movement: In*) untuk seluruh item di atas ke <strong>Gudang Utama</strong>.
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Catatan Penerimaan / No. Surat Jalan Vendor</label>
            <textarea
              rows={2}
              placeholder="e.g. Surat Jalan Pabrik #SJ-99881, segel utuh, lolos QC tanpa reject..."
              value={catatanPenerimaan}
              onChange={(e) => setCatatanPenerimaan(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white"
            />
          </div>

          {/* Footer */}
          <div className="pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Konfirmasi & Masukkan ke Stok Gudang ({totalIncomingPcs} pcs)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: PAYMENT PO MODAL (PELUNASAN HUTANG VENDOR)
// ============================================================================
interface PaymentPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder;
  cashAccounts: any[];
  onPay: (payData: {
    jumlahBayar: number;
    accountId: string;
    tanggal: string;
    catatan?: string;
  }) => void;
}

const PaymentPOModal: React.FC<PaymentPOModalProps> = ({
  isOpen,
  onClose,
  po,
  cashAccounts,
  onPay,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [jumlahBayar, setJumlahBayar] = useState<number>(po.sisaHutang || 0);
  const [accountId, setAccountId] = useState(cashAccounts[0]?.id || '');
  const [tanggal, setTanggal] = useState(todayStr);
  const [catatan, setCatatan] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAccount = useMemo(() => {
    return cashAccounts.find((a: any) => a.id === accountId) || cashAccounts[0];
  }, [cashAccounts, accountId]);

  const sisaSetelahBayar = Math.max(0, (po.sisaHutang || 0) - (jumlahBayar || 0));
  const isBalanceLow = selectedAccount ? selectedAccount.saldo < (jumlahBayar || 0) : false;

  const handleSetPreset = (presetAmount: number) => {
    setJumlahBayar(Math.min(po.sisaHutang, Math.max(1, presetAmount)));
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jumlahBayar || jumlahBayar <= 0) {
      setErrorMessage('Masukkan nominal pembayaran yang valid (minimal Rp 1).');
      return;
    }
    if (jumlahBayar > po.sisaHutang) {
      setErrorMessage(`Nominal pembayaran melebihi sisa hutang (Maksimal Rp ${po.sisaHutang.toLocaleString('id-ID')}).`);
      return;
    }
    if (!accountId) {
      setErrorMessage('Pilih akun kas atau rekening bank sumber pembayaran.');
      return;
    }

    setErrorMessage(null);
    onPay({
      jumlahBayar,
      accountId,
      tanggal,
      catatan: catatan.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-xl p-6 sm:p-7 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 text-slate-700 my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Pembayaran / Pelunasan Utang Vendor</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  {po.noPO}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Vendor: <strong className="text-slate-800">{po.vendorNama}</strong> ({po.vendorKota})</span>
              </p>
            </div>
          </div>
          <button aria-label="Tutup" data-modal-close
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Metric Cards Summary */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <span className="text-xs text-slate-500 block mb-0.5">Total Tagihan PO</span>
            <div className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
              Rp {po.totalTagihan.toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">{po.totalQtyPesan} pcs kaos</span>
          </div>

          <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/80">
            <span className="text-xs text-emerald-700 block mb-0.5">Sudah Terbayar</span>
            <div className="font-mono font-bold text-emerald-800 text-xs sm:text-sm">
              Rp {po.jumlahTerbayar.toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-emerald-600 block mt-0.5">
              {po.totalTagihan > 0 ? Math.round((po.jumlahTerbayar / po.totalTagihan) * 100) : 0}% terbayar
            </span>
          </div>

          <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200/80">
            <span className="text-xs text-rose-700 block mb-0.5 font-medium">Sisa Utang Saat Ini</span>
            <div className="font-mono font-bold text-rose-800 text-xs sm:text-sm">
              Rp {po.sisaHutang.toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-rose-600 block mt-0.5 font-semibold">Kewajiban berjalan</span>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Amount Presets & Nominal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
              <label>Nominal Pembayaran *</label>
              <span className="text-xs text-slate-400">Pilihan Cepat:</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSetPreset(po.sisaHutang)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                  jumlahBayar === po.sisaHutang
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>100% Lunas</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetPreset(Math.round(po.sisaHutang / 2))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                  jumlahBayar === Math.round(po.sisaHutang / 2) && jumlahBayar !== po.sisaHutang
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>50% Termin</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetPreset(Math.round(po.sisaHutang / 4))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                  jumlahBayar === Math.round(po.sisaHutang / 4) && jumlahBayar !== po.sisaHutang
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>25% DP</span>
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-sm">
                Rp
              </span>
              <input
                type="number"
                min="1"
                max={po.sisaHutang}
                value={jumlahBayar || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  setJumlahBayar(val);
                  setErrorMessage(null);
                }}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-2xl pl-12 pr-4 py-2.5 text-right font-mono font-bold text-slate-900 text-base focus:outline-none transition-colors"
                required
              />
            </div>

            {/* Sisa Hutang Pasca Pembayaran Preview */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-slate-500">
                Terbilang: <strong className="font-mono text-slate-800">Rp {(jumlahBayar || 0).toLocaleString('id-ID')}</strong>
              </span>
              <span
                className={`font-mono font-bold ${
                  sisaSetelahBayar === 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {sisaSetelahBayar === 0 ? 'Lunas Penuh (Sisa Rp 0)' : `Sisa Nanti: Rp ${sisaSetelahBayar.toLocaleString('id-ID')}`}
              </span>
            </div>
          </div>

          {/* Account and Date in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-600 text-xs font-semibold mb-1">
                Sumber Kas / Rekening Bank *
              </label>
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-xl px-3 py-2 text-slate-900 text-xs font-medium cursor-pointer"
                required
              >
                {cashAccounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nama} (Saldo: Rp {acc.saldo.toLocaleString('id-ID')})
                  </option>
                ))}
              </select>
              {isBalanceLow && (
                <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>Saldo akun tidak mencukupi (Rp {selectedAccount?.saldo.toLocaleString('id-ID')})</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-slate-600 text-xs font-semibold mb-1">
                Tanggal Pembayaran *
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-xl px-3 py-2 text-slate-900 font-mono text-xs cursor-pointer"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 text-xs font-semibold mb-1">
              Catatan Pembayaran / No. Referensi Transfer
            </label>
            <input
              type="text"
              placeholder="e.g. Transfer M-Banking BCA No. Ref 9028123 / Bukti transfer terlampir"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400"
            />
          </div>

          {/* Real-Time Double-Entry Journaling Simulation Card */}
          <div className="bg-[#FDFAF3] p-4 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-blue-100 text-blue-700">
                  <Scale className="w-3.5 h-3.5" />
                </span>
                <span className="text-slate-800 font-bold text-xs">
                  Simulasi Penjurnalan Akuntansi Otomatis:
                </span>
              </div>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> 100% Balans
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-xs bg-white p-3 rounded-xl border border-slate-200">
              {/* Debit Line */}
              <div className="flex items-center justify-between text-emerald-700 pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[11px] px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-sans uppercase">
                    DEBET
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">2-10100 Utang Dagang</span>
                    <span className="text-slate-500 text-[11px] block font-sans">
                      Vendor {po.vendorNama} (Kewajiban Pasiva ↓)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-800 text-xs sm:text-sm">
                    Rp {(jumlahBayar || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Credit Line (Indented) */}
              <div className="flex items-center justify-between text-rose-700 pt-1.5 pl-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[11px] px-1.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded font-sans uppercase">
                    KREDIT
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      1-10100 {selectedAccount?.nama || 'Kas/Bank'}
                    </span>
                    <span className="text-slate-500 text-[11px] block font-sans">
                      Kas Keluar (Aktiva Lancar ↓)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-rose-800 text-xs sm:text-sm">
                    Rp {(jumlahBayar || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-white/80 p-2.5 rounded-xl border border-blue-200/60 leading-relaxed font-sans">
              <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Dampak Neraca:</strong> Mengurangi saldo Kas/Bank di <strong>Aktiva</strong> dan memotong pos Utang Vendor di <strong>Pasiva</strong> dengan nominal yang sama persis sehingga Neraca Keuangan tetap 100% klop.
              </span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer hover:shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Konfirmasi & Simpan Pembayaran</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: OFFICIAL PO DOCUMENT MODAL (PRINT / PREVIEW)
// ============================================================================
interface PODocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder;
}

const PODocumentModal: React.FC<PODocumentModalProps> = ({ isOpen, onClose, po }) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Controls Bar */}
        <div className="px-6 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/80">
          <div className="text-xs font-semibold text-slate-600">
            Pratinjau Dokumen Purchase Order Resmi
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button aria-label="Tutup" data-modal-close onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-xl transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (Clean White Style for Invoicing) */}
        <div className="flex-1 overflow-y-auto p-8 bg-white text-slate-900 font-sans">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-wider text-slate-900">KALIMA APPAREL</h1>
              <p className="text-xs text-slate-600 font-medium">
                Premium Heavyweight & Oversize Blank T-Shirt Specialist
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Kawasan Industri & Pergudangan Kalima, Bandung, Jawa Barat
                <br />
                WhatsApp: 0812-8899-7711 | Email: procurement@kalima.id
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-slate-900 text-white font-bold text-xs uppercase px-3 py-1 rounded">
                SURAT PURCHASE ORDER (PO)
              </span>
              <div className="font-mono font-bold text-slate-900 text-base mt-2">
                #{po.noPO}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Tanggal: <strong>{po.tanggalPO}</strong>
              </div>
            </div>
          </div>

          {/* Supplier Info & Delivery Destination */}
          <div className="grid grid-cols-2 gap-6 my-6 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                Kepada Vendor / Pabrik Supplier:
              </span>
              <div className="font-bold text-slate-900 text-sm">{po.vendorNama}</div>
              <div className="text-slate-600 mt-0.5">{po.vendorAlamat || po.vendorKota}</div>
              <div className="text-slate-600 font-mono mt-0.5">Telp/WA: {po.vendorHp}</div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                Alamat Tujuan Pengiriman (Gudang):
              </span>
              <div className="font-bold text-slate-900 text-sm">{po.gudangTujuan || 'Gudang Utama'}</div>
              <div className="text-slate-600 mt-0.5">{po.alamatTujuanGudang || 'Bandung, Jawa Barat'}</div>
              {po.ekspedisi && (
                <div className="text-slate-700 font-medium mt-1">
                  Ekspedisi: {po.ekspedisi} {po.noResi ? `(Resi: ${po.noResi})` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-xl border border-slate-300 overflow-hidden mb-6">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="px-3 py-2.5">No.</th>
                  <th className="px-3 py-2.5">Kode SKU</th>
                  <th className="px-3 py-2.5">Deskripsi / Spesifikasi Kaos</th>
                  <th className="px-3 py-2.5 text-center">Ukuran</th>
                  <th className="px-3 py-2.5 text-center">Warna</th>
                  <th className="px-3 py-2.5 text-center">Qty (Pcs)</th>
                  <th className="px-3 py-2.5 text-right">Harga Satuan</th>
                  <th className="px-3 py-2.5 text-right">Jumlah (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {po.items.map((it, idx) => (
                  <tr key={it.sku} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">{it.sku}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{it.namaProduk}</div>
                      {it.catatan && <div className="text-[11px] text-slate-500">{it.catatan}</div>}
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-slate-800">{it.size}</td>
                    <td className="px-3 py-2 text-center text-slate-700">{it.colorName}</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-slate-900">
                      {it.qtyPesan}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">
                      Rp {it.hargaBeliSatuan.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                      Rp {it.subtotal.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Financials */}
          <div className="flex justify-between items-start text-xs border-t border-slate-200 pt-4">
            <div className="max-w-xs space-y-1 text-xs text-slate-600">
              <p className="font-bold text-slate-900">Syarat & Ketentuan Pengadaan:</p>
              <ul className="list-disc pl-3.5 space-y-0.5">
                <li>Bahan dan gramasi harus sesuai standar toleransi kalibrasi Kalima (+/- 5 GSM).</li>
                <li>Barang wajib lolos QC penerimaan gudang sebelum pelunasan sisa tagihan.</li>
                <li>Sertakan 1 rangkap Surat Jalan asli pada koli kargo.</li>
              </ul>
            </div>

            <div className="w-64 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Bahan:</span>
                <span>Rp {po.totalBiayaBahan.toLocaleString('id-ID')}</span>
              </div>
              {po.biayaEkspedisi > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Ongkos Kirim Kargo:</span>
                  <span>Rp {po.biayaEkspedisi.toLocaleString('id-ID')}</span>
                </div>
              )}
              {po.biayaTambahan > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Biaya Tambahan:</span>
                  <span>Rp {po.biayaTambahan.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t-2 border-slate-900">
                <span>TOTAL PO:</span>
                <span>Rp {po.totalTagihan.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 mt-12 text-center text-xs text-slate-700">
            <div>
              <p className="font-medium text-slate-500 mb-14">Diterbitkan Oleh (Kalima Apparel)</p>
              <p className="font-bold text-slate-900 underline">{po.createdBy}</p>
              <p className="text-xs text-slate-500">Divisi Pengadaan & Logistik</p>
            </div>
            <div>
              <p className="font-medium text-slate-500 mb-14">Dikonfirmasi & Disetujui (Vendor Pabrik)</p>
              <p className="font-bold text-slate-900 underline">{po.vendorNama}</p>
              <p className="text-xs text-slate-500">Tanda Tangan & Cap Perusahaan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: VENDOR FORM MODAL
// ============================================================================
interface VendorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingVendor: Vendor | null;
  onSave: (venData: Omit<Vendor, 'id' | 'totalPO' | 'totalBelanja'>) => void;
}

const VendorFormModal: React.FC<VendorFormModalProps> = ({
  isOpen,
  onClose,
  editingVendor,
  onSave,
}) => {
  const [nama, setNama] = useState(editingVendor?.nama || '');
  const [kontakPerson, setKontakPerson] = useState(editingVendor?.kontakPerson || '');
  const [noHp, setNoHp] = useState(editingVendor?.noHp || '');
  const [email, setEmail] = useState(editingVendor?.email || '');
  const [kota, setKota] = useState(editingVendor?.kota || 'Bandung');
  const [alamat, setAlamat] = useState(editingVendor?.alamat || '');
  const [kategori, setKategori] = useState<VendorCategory>(editingVendor?.kategori || 'Bahan Kaos Polos');
  const [rekeningBank, setRekeningBank] = useState(editingVendor?.rekeningBank || '');
  const [catatan, setCatatan] = useState(editingVendor?.catatan || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!nama.trim() || !noHp.trim()) {
      setErrorMsg('Nama vendor dan nomor HP/WhatsApp wajib diisi.');
      return;
    }

    onSave({
      nama: nama.trim(),
      kontakPerson: kontakPerson.trim() || undefined,
      noHp: noHp.trim(),
      email: email.trim() || undefined,
      kota: kota.trim() || 'Bandung',
      alamat: alamat.trim(),
      kategori,
      rekeningBank: rekeningBank.trim() || undefined,
      catatan: catatan.trim() || undefined,
      rating: 5,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-xs text-slate-600">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-xs">
              <Building2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {editingVendor ? 'Edit Profil Vendor' : 'Tambah Vendor / Supplier Baru'}
              </h3>
              <p className="text-xs text-slate-500">Pabrik rajut, garmen konveksi CMT, atau sablon rekanan.</p>
            </div>
          </div>
          <button aria-label="Tutup" data-modal-close onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-xl transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Nama Vendor / Perusahaan *</label>
            <input
              type="text"
              placeholder="e.g. PT Sinar Tekstil Prima"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Kategori Supplier *</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as VendorCategory)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-900 cursor-pointer focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              >
                <option value="Bahan Kaos Polos">Bahan Kaos Polos</option>
                <option value="Konveksi & CMT">Konveksi & CMT</option>
                <option value="Aksesoris & Packaging">Aksesoris & Packaging</option>
                <option value="Sablon & Bordir">Sablon & Bordir</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nama Kontak PIC</label>
              <input
                type="text"
                placeholder="e.g. Hendra Gunawan"
                value={kontakPerson}
                onChange={(e) => setKontakPerson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">No. WhatsApp / HP *</label>
              <input
                type="text"
                placeholder="e.g. 081234567890"
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-900 font-mono placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Kota Pabrik / Domisili *</label>
              <input
                type="text"
                placeholder="e.g. Bandung, Solo, Jakarta"
                value={kota}
                onChange={(e) => setKota(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Alamat Lengkap Pabrik / Gudang Vendor</label>
            <input
              type="text"
              placeholder="e.g. Kawasan Industri Cimahi Selatan No. 88"
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Nomor Rekening Bank Pembayaran</label>
            <input
              type="text"
              placeholder="e.g. BCA 7770123456 a.n PT Sinar Tekstil Prima"
              value={rekeningBank}
              onChange={(e) => setRekeningBank(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-900 font-mono placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Catatan Tambahan</label>
            <textarea
              rows={2}
              placeholder="Spesialisasi bahan, kualitas gramasi, atau ketentuan pembayaran..."
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>

          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Data Vendor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: TRACKING DETAIL MODAL (MODAL DETAIL PELACAKAN PENGIRIMAN PO)
// ============================================================================
interface TrackingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder;
  onOpenShipModal: () => void;
  onOpenReceiveModal: () => void;
  onOpenDocumentModal: () => void;
  onChangeShippingStatus: (status: 'diproses' | 'dalam_perjalanan' | 'diterima') => void;
}

const TrackingDetailModal: React.FC<TrackingDetailModalProps> = ({
  isOpen,
  onClose,
  po,
  onOpenShipModal,
  onOpenReceiveModal,
  onOpenDocumentModal,
  onChangeShippingStatus,
}) => {
  const [copiedResi, setCopiedResi] = useState(false);

  if (!isOpen) return null;

  // Determine current shipping status step: 1 (diproses) | 2 (dalam_perjalanan) | 3 (diterima)
  const currentStep = po.statusPO === 'diterima' ? 3 : po.statusPO === 'dikirim' ? 2 : 1;
  const receivedPct =
    po.totalQtyPesan > 0
      ? Math.min(100, Math.round(((po.totalQtyDiterima || 0) / po.totalQtyPesan) * 100))
      : 0;

  const handleCopyResi = () => {
    if (po.noResi) {
      navigator.clipboard.writeText(po.noResi);
      setCopiedResi(true);
      setTimeout(() => setCopiedResi(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 text-xs text-slate-600 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:px-6 sm:py-4 border-b border-slate-200/80 bg-slate-50/80 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 shadow-xs">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base tracking-tight">
                  Detail Pelacakan & Status Pengiriman
                </h3>
                <span className="font-mono font-bold text-amber-700 text-xs px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/60">
                  #{po.noPO}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Vendor: <strong className="text-slate-800">{po.vendorNama}</strong> ({po.vendorKota}) · Dibuat: {po.tanggalPO}
              </p>
            </div>
          </div>

          <button aria-label="Tutup" data-modal-close
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Quick Change Status Selector Bar */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Pilih Status Pengiriman Cepat:
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Status Saat Ini:{' '}
                <strong
                  className={
                    currentStep === 3
                      ? 'text-emerald-700'
                      : currentStep === 2
                      ? 'text-blue-700'
                      : 'text-amber-700'
                  }
                >
                  {currentStep === 3
                    ? 'Diterima'
                    : currentStep === 2
                    ? 'Dalam Perjalanan'
                    : 'Diproses'}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* Option 1: Diproses */}
              <button
                type="button"
                onClick={() => onChangeShippingStatus('diproses')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  currentStep === 1
                    ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs ring-2 ring-amber-500/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Diproses (Pabrik)</span>
              </button>

              {/* Option 2: Dalam Perjalanan */}
              <button
                type="button"
                onClick={() => onChangeShippingStatus('dalam_perjalanan')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  currentStep === 2
                    ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Dalam Perjalanan</span>
              </button>

              {/* Option 3: Diterima */}
              <button
                type="button"
                onClick={() => onChangeShippingStatus('diterima')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  currentStep === 3
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs ring-2 ring-emerald-500/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Diterima (Gudang)</span>
              </button>
            </div>
          </div>

          {/* Route Map Visual Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Origin Vendor */}
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-amber-100/70 text-amber-700 border border-amber-200 shrink-0">
                  <Building2 className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Asal Pengiriman (Pabrik / Vendor)
                  </span>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">{po.vendorNama}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{po.vendorKota}</span>
                  </div>
                </div>
              </div>

              {/* Route Indicator & Cargo Status */}
              <div className="flex-1 px-2 py-1 flex flex-col items-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-semibold text-blue-700 mb-1.5">
                  <Truck className={`w-3.5 h-3.5 text-blue-600 ${currentStep === 2 ? 'animate-bounce' : ''}`} />
                  <span>{po.ekspedisi || 'Kargo Rekanan'}</span>
                  {po.noResi && <span className="text-slate-500">· {po.noResi}</span>}
                </div>

                {/* Progress bar line */}
                <div className="w-full bg-slate-200/80 h-2 rounded-full relative overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      currentStep === 3
                        ? 'bg-emerald-500 w-full'
                        : currentStep === 2
                        ? 'bg-blue-500 w-2/3'
                        : 'bg-amber-500 w-1/3'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  {currentStep === 3
                    ? '100% Selesai Diterima'
                    : currentStep === 2
                    ? 'In-Transit Ekspedisi'
                    : 'Penyiapan & Produksi Pabrik'}
                </div>
              </div>

              {/* Destination Gudang */}
              <div className="flex items-center gap-3 sm:text-right">
                <div className="sm:order-1">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Tujuan Pengiriman (Gudang)
                  </span>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">{po.gudangTujuan || 'Gudang Utama Kalima'}</div>
                  <div className="text-xs text-slate-500 flex items-center sm:justify-end gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{po.alamatTujuanGudang || 'Bandung, Jawa Barat'}</span>
                  </div>
                </div>
                <span className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-700 border border-emerald-200 shrink-0 sm:order-2">
                  <Package className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>

          {/* Detailed 3-Stage Tracking Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Timeline & Riwayat Perjalanan Pesanan
            </h4>

            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* STEP 1: PO DITERBITKAN / PROSES PABRIK */}
              <div className="relative">
                <span
                  className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                    currentStep >= 1
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                      : 'bg-slate-200 text-slate-500 border-slate-300'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </span>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">1. Pesanan Diterbitkan & Diproses Pabrik</span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        {po.statusPO === 'draft' ? 'Draf' : 'Terkonfirmasi'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {po.tanggalPO}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    Surat PO resmi diterbitkan kepada <strong>{po.vendorNama}</strong> untuk pemesanan {po.totalQtyPesan} pcs kaos ({po.items.length} artikel SKU). Diterbitkan oleh:{' '}
                    <strong className="text-slate-800">{po.createdBy}</strong>.
                  </p>

                  {po.catatanPO && (
                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                      <span className="font-semibold text-slate-800">Catatan PO:</span> {po.catatanPO}
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2: PENGIRIMAN EKSPEDISI / KARGO (IN-TRANSIT) */}
              <div className="relative">
                <span
                  className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                    currentStep >= 2
                      ? 'bg-blue-500 text-white border-blue-400 shadow-xs'
                      : 'bg-slate-200 text-slate-500 border-slate-300'
                  }`}
                >
                  {currentStep >= 2 ? <Truck className="w-3 h-3" /> : '2'}
                </span>

                <div
                  className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                    currentStep === 2
                      ? 'bg-blue-50/50 border-blue-200/90 shadow-xs'
                      : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">2. Pengiriman Ekspedisi & Kargo Logistik</span>
                      {currentStep === 2 && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          IN-TRANSIT
                        </span>
                      )}
                    </div>
                    {po.tanggalKirim && (
                      <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Dikirim: {po.tanggalKirim}
                      </span>
                    )}
                  </div>

                  {/* Shipment Info Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] text-slate-500 block">Jasa Ekspedisi</span>
                      <div className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        <span>{po.ekspedisi || 'Menunggu Penyerahan'}</span>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] text-slate-500 block">Nomor Resi / AWB</span>
                      <div className="font-mono font-bold text-amber-700 mt-0.5 flex items-center justify-between">
                        <span>{po.noResi || 'Belum Ada Resi'}</span>
                        {po.noResi && (
                          <button
                            type="button"
                            onClick={handleCopyResi}
                            title="Salin Nomor Resi" aria-label="Salin Nomor Resi"
                            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                          >
                            {copiedResi ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] text-slate-500 block">Estimasi Tiba di Gudang</span>
                      <div className="font-medium text-emerald-700 mt-0.5">
                        {po.estimasiTiba || (po.statusPO === 'dikirim' ? '1-3 Hari Kerja' : '-')}
                      </div>
                    </div>
                  </div>

                  {po.catatanPengiriman && (
                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                      <span className="font-semibold text-slate-800">Catatan Driver/Koli:</span>{' '}
                      {po.catatanPengiriman}
                    </div>
                  )}

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenShipModal}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{po.noResi ? 'Update Resi & Ekspedisi' : '+ Masukkan Data Resi Kargo'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* STEP 3: PENERIMAAN BARANG & QC GUDANG */}
              <div className="relative">
                <span
                  className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                    currentStep === 3
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                      : 'bg-slate-200 text-slate-500 border-slate-300'
                  }`}
                >
                  {currentStep === 3 ? <CheckCircle2 className="w-3 h-3" /> : '3'}
                </span>

                <div
                  className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                    currentStep === 3
                      ? 'bg-emerald-50/60 border-emerald-200/90 shadow-xs'
                      : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">3. Penerimaan & Quality Control Gudang</span>
                      {currentStep === 3 ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          SELESAI DITERIMA
                        </span>
                      ) : po.statusPO === 'diterima_sebagian' ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          TIBA SEBAGIAN ({receivedPct}%)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">Menunggu Paket Tiba</span>
                      )}
                    </div>

                    {po.tanggalDiterima && (
                      <span className="text-xs text-emerald-700 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Tiba: {po.tanggalDiterima}
                      </span>
                    )}
                  </div>

                  {/* Receipt Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] text-slate-500 block">Progres Fisik Masuk</span>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">
                        <span className={po.totalQtyDiterima > 0 ? 'text-emerald-600' : 'text-slate-500'}>
                          {po.totalQtyDiterima || 0}
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span>{po.totalQtyPesan} pcs ({receivedPct}%)</span>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] text-slate-500 block">Penerima & Kondisi QC</span>
                      <div className="font-medium text-slate-800 mt-0.5">
                        {po.penerimaGudang ? `${po.penerimaGudang} · ${po.kondisiPenerimaan || 'Lolos QC'}` : 'Menunggu QC Inbound'}
                      </div>
                    </div>
                  </div>

                  {po.catatanPenerimaan && (
                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                      <span className="font-semibold text-slate-800">Catatan Penerimaan:</span>{' '}
                      {po.catatanPenerimaan}
                    </div>
                  )}

                  {po.statusPO !== 'diterima' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onOpenReceiveModal}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>Buka Checklist Penerimaan Gudang ({Math.max(0, po.totalQtyPesan - (po.totalQtyDiterima || 0))} pcs lagi)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cargo Manifest / Items Table */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-blue-600" />
                Manifest Muatan Kaos ({po.totalQtyPesan} pcs)
              </h4>
              <span className="text-xs text-slate-500 font-mono">
                Total Tagihan: <strong className="text-slate-900">Rp {po.totalTagihan.toLocaleString('id-ID')}</strong>
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-600 border-b border-slate-200/80">
                  <tr>
                    <th className="px-3.5 py-2.5">SKU & Artikel Kaos</th>
                    <th className="px-3.5 py-2.5 text-center">Ukuran</th>
                    <th className="px-3.5 py-2.5 text-center">Warna</th>
                    <th className="px-3.5 py-2.5 text-center">Qty Pesan</th>
                    <th className="px-3.5 py-2.5 text-center">Diterima</th>
                    <th className="px-3.5 py-2.5 text-right">Harga Beli</th>
                    <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-xs">
                  {po.items.map((it) => (
                    <tr key={it.sku} className="hover:bg-slate-50/80">
                      <td className="px-3.5 py-2.5">
                        <div className="font-mono font-bold text-slate-900">{it.sku}</div>
                        <div className="text-xs text-slate-500">{it.namaProduk}</div>
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-bold text-slate-800">
                        {it.size}
                      </td>
                      <td className="px-3.5 py-2.5 text-center text-slate-700">
                        {it.colorName}
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-900">
                        {it.qtyPesan} pcs
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono">
                        <span className={it.qtyDiterima && it.qtyDiterima >= it.qtyPesan ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                          {it.qtyDiterima || 0} pcs
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-600">
                        Rp {it.hargaBeliSatuan.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                        Rp {it.subtotal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:px-6 border-t border-slate-200/80 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenDocumentModal}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>Lihat Dokumen PO Resmi</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={onOpenReceiveModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Terima Barang di Gudang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

