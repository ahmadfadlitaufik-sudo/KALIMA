import React, { useState, useMemo } from 'react';
import {
  Plus,
  Upload,
  Search,
  Filter,
  Receipt,
  CheckCircle,
  XCircle,
  Ban,
  Clock,
  AlertCircle,
  ChevronDown,
  DollarSign,
  ArrowRight,
  User,
  Eye,
  Trash2,
  FileText,
  Edit3,
  Calendar,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Order, PaymentStatus, OrderStatus, SalesChannelName, orderSortComparator, getLocalDateString } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { EditOrderModal } from '../components/EditOrderModal';
import { useCashBank } from '../hooks/useCashBank';

export const SalesView: React.FC = () => {
  const {
    orders,
    channels,
    isOwner,
    setQuickOrderModalOpen,
    requestCancelOrder,
    approveCancelOrder,
    rejectCancelOrder,
    deleteOrder,
    setCurrentView,
  } = useApp();

  const {
    cashAccounts,
    defaultAccount,
    handleSalesPaymentSaved,
    handleSalesRefund,
    potongSaldo,
  } = useCashBank();

  const todayStr = getLocalDateString();
  const currentMonthStr = todayStr.substring(0, 7);

  // Search & Basic Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedStatusBayar, setSelectedStatusBayar] = useState<string>('ALL');
  const [selectedStatusOrder, setSelectedStatusOrder] = useState<string>('ALL');

  // Period / Date Filters
  const [periodType, setPeriodType] = useState<'all' | 'month' | 'custom' | 'today' | '7days' | '30days'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [customStartDate, setCustomStartDate] = useState<string>(`${currentMonthStr}-01`);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Available Months for dropdown
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    orders.forEach((o) => {
      if (o.tanggal && o.tanggal.length >= 7) {
        monthsSet.add(o.tanggal.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [orders]);

  // Modals
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [editModalOrder, setEditModalOrder] = useState<Order | null>(null);
  const [deleteModalOrder, setDeleteModalOrder] = useState<Order | null>(null);

  // Cancellation Modal
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundToCustomer, setRefundToCustomer] = useState<boolean>(true);
  const [refundAccountId, setRefundAccountId] = useState<string>('');

  // Payment Modal
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Transfer BCA');
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');

  // Pagination state for ultra-smooth rendering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Filtered & sorted orders (terbaru di atas)
  const filteredOrders = useMemo(() => {
    const today = new Date();

    return [...orders]
      .filter((o) => {
        // Query search
        const matchQuery =
          !searchQuery.trim() ||
          o.noOrder.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.customerNama.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (o.customerHp && o.customerHp.includes(searchQuery)) ||
          (o.customerKota && o.customerKota.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (o.noResi && o.noResi.toLowerCase().includes(searchQuery.toLowerCase())) ||
          o.items.some((it) => it.namaProduk.toLowerCase().includes(searchQuery.toLowerCase()) || it.sku.toLowerCase().includes(searchQuery.toLowerCase()));

        // Channel, Payment & Status Order
        const matchChannel = selectedChannel === 'ALL' || o.channel === selectedChannel;
        const matchBayar = selectedStatusBayar === 'ALL' || o.statusBayar === selectedStatusBayar;
        const matchOrder = selectedStatusOrder === 'ALL' || o.statusOrder === selectedStatusOrder;

        // Period filter
        let matchPeriod = true;
        if (periodType === 'month') {
          matchPeriod = o.tanggal.startsWith(selectedMonth);
        } else if (periodType === 'custom') {
          if (customStartDate && o.tanggal < customStartDate) matchPeriod = false;
          if (customEndDate && o.tanggal > customEndDate) matchPeriod = false;
        } else if (periodType === 'today') {
          matchPeriod = o.tanggal === todayStr;
        } else if (periodType === '7days') {
          const orderDate = new Date(o.tanggal);
          const diffDays = (today.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
          matchPeriod = diffDays >= 0 && diffDays <= 7;
        } else if (periodType === '30days') {
          const orderDate = new Date(o.tanggal);
          const diffDays = (today.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
          matchPeriod = diffDays >= 0 && diffDays <= 30;
        }

        return matchQuery && matchChannel && matchBayar && matchOrder && matchPeriod;
      })
      .sort(orderSortComparator);
  }, [
    orders,
    searchQuery,
    selectedChannel,
    selectedStatusBayar,
    selectedStatusOrder,
    periodType,
    selectedMonth,
    customStartDate,
    customEndDate,
    todayStr,
  ]);

  // Auto reset page to 1 when orders list or filters change so latest orders are immediately visible
  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    orders.length,
    searchQuery,
    selectedChannel,
    selectedStatusBayar,
    selectedStatusOrder,
    periodType,
    selectedMonth,
    customStartDate,
    customEndDate,
  ]);

  // Total pages and paginated slice for max performance
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const startIndex = (Math.min(currentPage, totalPages) - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, currentPage, totalPages, pageSize]);

  // Aggregate Cross-Check Summary Stats for Filtered Data
  const summaryStats = useMemo(() => {
    let activeOrdersCount = 0;
    let totalPcs = 0;
    let totalOmzet = 0;
    let totalHpp = 0;
    let totalLabaKotor = 0;
    let totalPiutang = 0;

    filteredOrders.forEach((o) => {
      if (o.statusOrder !== 'batal') {
        activeOrdersCount++;
        totalPcs += o.items.reduce((acc, it) => acc + it.qty, 0);
        totalOmzet += o.totalTagihan;
        totalHpp += o.totalHpp;
        totalLabaKotor += o.labaKotor;
        totalPiutang += o.sisaPiutang;
      }
    });

    return {
      activeOrdersCount,
      totalOrders: filteredOrders.length,
      totalPcs,
      totalOmzet,
      totalHpp,
      totalLabaKotor,
      totalPiutang,
    };
  }, [filteredOrders]);

  const handleOpenPayment = (order: Order) => {
    setPaymentModalOrder(order);
    setPaymentAmount(order.sisaPiutang);
    setPaymentAccountId(defaultAccount?.id || '');
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder || paymentAmount <= 0) return;
    handleSalesPaymentSaved({
      orderId: paymentModalOrder.id,
      amount: paymentAmount,
      method: paymentMethod,
      accountId: paymentAccountId || undefined,
      note: paymentNote,
    });
    setPaymentModalOrder(null);
    setPaymentAmount(0);
    setPaymentAccountId('');
  };

  const handleOpenCancel = (order: Order) => {
    setCancelModalOrder(order);
    setCancelReason('');
    setRefundToCustomer(order.totalTerbayar > 0);
    setRefundAccountId(defaultAccount?.id || '');
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder) return;
    if (isOwner) {
      if (refundToCustomer && cancelModalOrder.totalTerbayar > 0) {
        handleSalesRefund({
          order: cancelModalOrder,
          refundAmount: cancelModalOrder.totalTerbayar,
          accountId: refundAccountId || undefined,
          alasan: cancelReason || 'Dibatalkan oleh Owner',
        });
      }
      requestCancelOrder(cancelModalOrder.id, cancelReason || 'Dibatalkan oleh Owner');
      approveCancelOrder(cancelModalOrder.id);
    } else {
      requestCancelOrder(cancelModalOrder.id, cancelReason || 'Pengajuan pembatalan oleh CS');
    }
    setCancelModalOrder(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteModalOrder) return;
    deleteOrder(deleteModalOrder.id);
    setDeleteModalOrder(null);
  };

  const getChannelBadgeClass = (channel: string) => {
    switch (channel) {
      case 'Shopee':
        return 'bg-orange-50 text-orange-700 border-orange-200/80';
      case 'TAPADA':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'TikTok':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      case 'Umum':
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
      case 'Reseller':
        return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'Marketing':
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
      case 'Internal':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getChannelFilterBtnClass = (chName: string, isSelected: boolean) => {
    if (isSelected) {
      switch (chName) {
        case 'Shopee':
          return 'bg-orange-600 text-white font-semibold shadow-xs';
        case 'TAPADA':
          return 'bg-emerald-600 text-white font-semibold shadow-xs';
        case 'TikTok':
          return 'bg-rose-600 text-white font-semibold shadow-xs';
        case 'Umum':
          return 'bg-blue-600 text-white font-semibold shadow-xs';
        case 'Reseller':
          return 'bg-amber-600 text-white font-semibold shadow-xs';
        case 'ALL':
        default:
          return 'bg-slate-900 text-white font-semibold shadow-xs';
      }
    }
    switch (chName) {
      case 'Shopee':
        return 'bg-orange-50/80 text-orange-800 border border-orange-200/80 hover:bg-orange-100';
      case 'TAPADA':
        return 'bg-emerald-50/80 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100';
      case 'TikTok':
        return 'bg-rose-50/80 text-rose-800 border border-rose-200/80 hover:bg-rose-100';
      case 'Umum':
        return 'bg-blue-50/80 text-blue-800 border border-blue-200/80 hover:bg-blue-100';
      case 'Reseller':
        return 'bg-amber-50/80 text-amber-800 border border-amber-200/80 hover:bg-amber-100';
      case 'ALL':
      default:
        return 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-200/80';
    }
  };

  /** Tombol aksi per order (dipakai di tabel desktop dan kartu HP). */
  const renderOrderActions = (ord: Order) => (
        <div className="flex items-center justify-center gap-1.5">
          {/* Edit Order Button */}
          <button
            type="button"
            onClick={() => setEditModalOrder(ord)}
            aria-label="Edit order"
            title="Edit Order (Ganti Produk / Size / Harga / Customer / Tanggal)"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200/60"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          {/* Receipt */}
          <button
            type="button"
            onClick={() => setSelectedReceiptOrder(ord)}
            aria-label="Lihat nota"
            title="Lihat / Cetak Nota Transaksi"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200/60"
          >
            <Receipt className="w-3.5 h-3.5" />
          </button>

          {/* Payment button if receivable */}
          {ord.sisaPiutang > 0 && ord.statusOrder !== 'batal' && (
            <button
              type="button"
              onClick={() => handleOpenPayment(ord)}
              aria-label="Catat pelunasan"
              title="Bayar / Pelunasan Piutang"
              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer border border-emerald-200/80"
            >
              <DollarSign className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Cancel button */}
          {ord.statusOrder !== 'batal' && (
            <button
              type="button"
              onClick={() => handleOpenCancel(ord)}
              aria-label={isOwner ? 'Batalkan order' : 'Ajukan pembatalan'}
              title={
                isOwner
                  ? 'Batalkan Order & Kembalikan Stok'
                  : 'Ajukan Pembatalan ke Owner'
              }
              className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer border border-amber-200/80"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Permanent Delete for Owner */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setDeleteModalOrder(ord)}
              aria-label="Hapus order permanen"
              title="Hapus Order Permanen"
              className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer border border-slate-200/60"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Daftar Penjualan Multi-Channel
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {orders.length} transaksi tercatat dari 6 sales channel & konsinyasi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCurrentView('import_export')}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3.5 py-2.5 rounded-2xl text-xs border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
            title="Import transaksi penjualan massal dari file Excel (.xlsx, .xls) atau .CSV" aria-label="Import transaksi penjualan massal dari file Excel (.xlsx, .xls) atau .CSV"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Upload Penjualan (Excel/CSV)</span>
          </button>

          <button
            onClick={() => setQuickOrderModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Input Order Baru (&lt; 60 dtk)</span>
          </button>
        </div>
      </div>

      {/* Pending Cancellations Banner for Owner */}
      {isOwner && orders.some((o) => o.statusOrder === 'menunggu_approval_batal') && (
        <div className="bg-rose-50/70 border border-rose-200/80 p-4 sm:p-5 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-rose-800 text-xs font-bold uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Permintaan Pembatalan Order Perlu Persetujuan Owner</span>
          </div>

          <div className="space-y-2">
            {orders
              .filter((o) => o.statusOrder === 'menunggu_approval_batal')
              .map((ord) => (
                <div
                  key={ord.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white rounded-2xl border border-rose-100 text-xs gap-3 shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">{ord.noOrder}</span>
                      <span className="text-slate-400">·</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getChannelBadgeClass(ord.channel)}`}>
                        {ord.channel}
                      </span>
                      <span className="text-slate-700 font-semibold">{ord.customerNama}</span>
                    </div>
                    <div className="text-xs text-rose-700 mt-1">
                      Alasan: "{ord.cancellationReason || 'Tidak ada keterangan'}" (Diajukan oleh: {ord.cancellationRequestedBy || 'CS'})
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        if (ord.totalTerbayar > 0) {
                          handleSalesRefund({
                            order: ord,
                            refundAmount: ord.totalTerbayar,
                            alasan: ord.cancellationReason || 'Disetujui Owner',
                          });
                        }
                        approveCancelOrder(ord.id);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                    >
                      {ord.totalTerbayar > 0 ? 'Setujui Batal & Potong Refund Kas' : 'Setujui Batal (Kembalikan Stok)'}
                    </button>
                    <button
                      onClick={() => rejectCancelOrder(ord.id)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* FILTER PERIODE & PENCARIAN (MEMUDAHKAN KROSCEK REKONSILIASI) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Row 1: Periode / Bulan Buttons & Date Pickers */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-900">Filter Periode Kroscek:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Quick Select */}
            <div className="segmented-pill-bar flex items-center gap-1 bg-white border border-slate-200/80 p-1 rounded-full">
              <button
                type="button"
                onClick={() => setPeriodType('all')}
                className={`px-3 py-1.5 text-xs rounded-full font-bold cursor-pointer transition-colors ${
                  periodType === 'all'
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('month')}
                className={`px-3 py-1.5 text-xs rounded-full font-bold cursor-pointer transition-colors ${
                  periodType === 'month'
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Per Bulan
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('custom')}
                className={`px-3 py-1.5 text-xs rounded-full font-bold cursor-pointer transition-colors ${
                  periodType === 'custom'
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                📅 Rentang
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('today')}
                className={`px-3 py-1.5 text-xs rounded-full font-bold cursor-pointer transition-colors ${
                  periodType === 'today'
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('7days')}
                className={`px-3 py-1.5 text-xs rounded-full font-bold cursor-pointer transition-colors ${
                  periodType === '7days'
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('30days')}
                className={`px-3 py-1.5 text-xs rounded-full font-bold cursor-pointer transition-colors ${
                  periodType === '30days'
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                30 Hari
              </button>
            </div>

            {/* Per Bulan selector */}
            {periodType === 'month' && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-2xl border border-slate-200">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 cursor-pointer font-medium focus:border-slate-900"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      Bulan {m}
                    </option>
                  ))}
                </select>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-2 py-0.5 text-xs text-slate-800 focus:border-slate-900"
                />
              </div>
            )}

            {/* Rentang Tanggal Custom Selector */}
            {periodType === 'custom' && (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1 text-xs text-slate-700">
                  <span className="text-[11px] text-slate-500 font-medium">Dari:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-800 font-mono focus:border-slate-900"
                  />
                </div>
                <span className="text-slate-400 text-xs">-</span>
                <div className="flex items-center gap-1 text-xs text-slate-700">
                  <span className="text-[11px] text-slate-500 font-medium">Sampai:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-800 font-mono focus:border-slate-900"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Search Query & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No Order, Customer, HP, Resi, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition-colors"
            />
          </div>

          {/* Channel */}
          <div>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:border-slate-900 cursor-pointer transition-colors"
            >
              <option value="ALL">Semua Channel Penjualan</option>
              {channels.map((c) => (
                <option key={c.id} value={c.name}>
                  Channel: {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <select
              value={selectedStatusBayar}
              onChange={(e) => setSelectedStatusBayar(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:border-slate-900 cursor-pointer transition-colors"
            >
              <option value="ALL">Semua Status Bayar</option>
              <option value="lunas">Lunas</option>
              <option value="piutang">Piutang (Belum Lunas)</option>
              <option value="sebagian">Sebagian (DP)</option>
            </select>
          </div>

          {/* Order Status */}
          <div>
            <select
              value={selectedStatusOrder}
              onChange={(e) => setSelectedStatusOrder(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:border-slate-900 cursor-pointer transition-colors"
            >
              <option value="ALL">Semua Status Order</option>
              <option value="selesai">Selesai</option>
              <option value="diproses">Diproses</option>
              <option value="menunggu_approval_batal">Menunggu Batal</option>
              <option value="batal">Batal</option>
            </select>
          </div>
        </div>

        {/* Row 3: Quick Channel Pills (Umum, Reseller, Shopee, TikTok, etc.) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-medium mr-1">Filter Channel:</span>
          <button
            type="button"
            onClick={() => setSelectedChannel('ALL')}
            className={`px-3 py-1.5 text-xs rounded-xl cursor-pointer transition-all ${getChannelFilterBtnClass(
              'ALL',
              selectedChannel === 'ALL'
            )}`}
          >
            Semua Channel ({orders.filter((o) => o.statusOrder !== 'batal').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedChannel('Shopee')}
            className={`px-3 py-1.5 text-xs rounded-xl cursor-pointer transition-all ${getChannelFilterBtnClass(
              'Shopee',
              selectedChannel === 'Shopee'
            )}`}
          >
            🛒 Shopee ({orders.filter((o) => o.channel === 'Shopee' && o.statusOrder !== 'batal').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedChannel('Umum')}
            className={`px-3 py-1.5 text-xs rounded-xl cursor-pointer transition-all ${getChannelFilterBtnClass(
              'Umum',
              selectedChannel === 'Umum'
            )}`}
          >
            🛍️ Umum / Retail ({orders.filter((o) => o.channel === 'Umum' && o.statusOrder !== 'batal').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedChannel('Reseller')}
            className={`px-3 py-1.5 text-xs rounded-xl cursor-pointer transition-all ${getChannelFilterBtnClass(
              'Reseller',
              selectedChannel === 'Reseller'
            )}`}
          >
            ⭐ Reseller ({orders.filter((o) => o.channel === 'Reseller' && o.statusOrder !== 'batal').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedChannel('TikTok')}
            className={`px-3 py-1.5 text-xs rounded-xl cursor-pointer transition-all ${getChannelFilterBtnClass(
              'TikTok',
              selectedChannel === 'TikTok'
            )}`}
          >
            🎬 TikTok Shop ({orders.filter((o) => o.channel === 'TikTok' && o.statusOrder !== 'batal').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedChannel('TAPADA')}
            className={`px-3 py-1.5 text-xs rounded-xl cursor-pointer transition-all ${getChannelFilterBtnClass(
              'TAPADA',
              selectedChannel === 'TAPADA'
            )}`}
          >
            🏪 TAPADA ({orders.filter((o) => o.channel === 'TAPADA' && o.statusOrder !== 'batal').length})
          </button>
        </div>
      </div>

      {/* REKAPITULASI KROSCEK RINGKAS (Hasil Filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Pesanan Tervalidasi</div>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {summaryStats.activeOrdersCount} <span className="text-xs font-normal text-slate-500">order</span>
          </div>
          {summaryStats.totalOrders !== summaryStats.activeOrdersCount && (
            <div className="text-xs text-rose-600 font-medium mt-0.5">
              ({summaryStats.totalOrders - summaryStats.activeOrdersCount} order batal)
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Kaos Terjual</div>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {summaryStats.totalPcs.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">pcs</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Omzet Penjualan</div>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            Rp {summaryStats.totalOmzet.toLocaleString('id-ID')}
          </div>
        </div>

        {isOwner && (
          <div className="bg-emerald-50/30 p-4 rounded-3xl border border-emerald-200/80 shadow-sm">
            <div className="text-xs text-emerald-800 font-semibold uppercase tracking-wider">Laba Kotor Penjualan</div>
            <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
              Rp {summaryStats.totalLabaKotor.toLocaleString('id-ID')}
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Piutang Belum Lunas</div>
          <div className={`text-xl font-bold font-mono mt-1 ${summaryStats.totalPiutang > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            Rp {summaryStats.totalPiutang.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
        {/* HP: daftar kartu */}
        <ul className="md:hidden divide-y divide-slate-100">
          {filteredOrders.length === 0 ? (
            <li className="py-12 text-center text-slate-400 text-xs">Tidak ada pesanan yang sesuai dengan filter pencarian.</li>
          ) : (
            paginatedOrders.map((ord) => (
              <li key={ord.id} className={`p-4 space-y-2 ${ord.statusOrder === 'batal' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-sm text-slate-900">{ord.noOrder}</div>
                    <div className="text-xs text-slate-500">
                      {ord.tanggal} · {ord.channel}
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-sm text-slate-900 whitespace-nowrap">
                    Rp {ord.totalTagihan.toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="text-sm text-slate-800">
                  <span className="font-semibold">{ord.customerNama}</span>
                  <span className="text-slate-500"> · {ord.items.reduce((a, b) => a + b.qty, 0)} pcs</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    {ord.statusBayar === 'lunas' ? 'Lunas' : `Sisa Rp ${ord.sisaPiutang.toLocaleString('id-ID')}`} ·{' '}
                    {ord.statusOrder === 'selesai' ? 'Selesai' : ord.statusOrder === 'diproses' ? 'Diproses' : ord.statusOrder === 'batal' ? 'Batal' : 'Req batal'}
                  </span>
                  {renderOrderActions(ord)}
                </div>
              </li>
            ))
          )}
        </ul>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/90 border-b border-slate-200/90 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">No. Order & Tgl</th>
                <th className="py-3.5 px-3 font-semibold">Channel</th>
                <th className="py-3.5 px-3 font-semibold">Pelanggan</th>
                <th className="py-3.5 px-3 font-semibold">Item Produk</th>
                <th className="py-3.5 px-3 text-right font-semibold">Total Tagihan</th>
                {isOwner && <th className="py-3.5 px-3 text-right font-semibold">HPP</th>}
                {isOwner && <th className="py-3.5 px-3 text-right font-semibold">Laba Kotor</th>}
                <th className="py-3.5 px-3 text-center font-semibold">Status Bayar</th>
                <th className="py-3.5 px-3 text-center font-semibold">Status Order</th>
                <th className="py-3.5 px-4 text-center font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 10 : 8}
                    className="py-12 text-center text-slate-400 text-xs"
                  >
                    Tidak ada pesanan yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((ord) => {
                  const totalItemsQty = ord.items.reduce((a, b) => a + b.qty, 0);

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        ord.statusOrder === 'batal' ? 'opacity-60 line-through bg-slate-50/40' : ''
                      }`}
                    >
                      {/* No Order */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 whitespace-nowrap">
                          {ord.noOrder}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{ord.tanggal}</div>
                        {ord.noResi && (
                          <div className="text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60 font-mono mt-1 inline-block">
                            Resi: {ord.noResi}
                          </div>
                        )}
                      </td>

                      {/* Channel */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getChannelBadgeClass(
                            ord.channel
                          )}`}
                        >
                          {ord.channel}
                        </span>
                      </td>

                      {/* Pelanggan */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900 truncate max-w-[130px]">
                          {ord.customerNama}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[130px] mt-0.5">
                          {ord.customerKota} · {ord.customerHp}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-800">
                          {totalItemsQty} pcs kaos
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[160px] mt-0.5">
                          {ord.items.map((i) => `${i.qty}x ${i.namaProduk}`).join(', ')}
                        </div>
                      </td>

                      {/* Tagihan */}
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs">
                          Rp {ord.totalTagihan.toLocaleString('id-ID')}
                        </div>
                        {ord.diskon > 0 && (
                          <div className="text-[11px] text-rose-600 mt-0.5 font-medium">
                            Disc: Rp {ord.diskon.toLocaleString('id-ID')}
                          </div>
                        )}
                      </td>

                      {/* HPP (Owner only) */}
                      {isOwner && (
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          Rp {ord.totalHpp.toLocaleString('id-ID')}
                        </td>
                      )}

                      {/* Laba Kotor (Owner only) */}
                      {isOwner && (
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={`font-bold ${
                              ord.labaKotor >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            Rp {ord.labaKotor.toLocaleString('id-ID')}
                          </span>
                        </td>
                      )}

                      {/* Status Bayar */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {ord.statusBayar === 'lunas' ? (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 inline-block">
                            LUNAS
                          </span>
                        ) : ord.statusBayar === 'sebagian' ? (
                          <div>
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 inline-block">
                              DP / SEBAGIAN
                            </span>
                            <div className="text-[11px] text-rose-600 font-mono mt-1 font-medium">
                              Sisa: Rp {ord.sisaPiutang.toLocaleString('id-ID')}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 inline-block">
                              PIUTANG
                            </span>
                            <div className="text-[11px] text-slate-500 font-mono mt-1">
                              Tempo: {ord.jatuhTempo || '-'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Status Order */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {ord.statusOrder === 'selesai' ? (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full inline-block">
                            Selesai
                          </span>
                        ) : ord.statusOrder === 'diproses' ? (
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full inline-block">
                            Diproses
                          </span>
                        ) : ord.statusOrder === 'menunggu_approval_batal' ? (
                          <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200/80 inline-block">
                            Req Batal
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full inline-block">
                            Batal
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {renderOrderActions(ord)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredOrders.length > pageSize && (
          <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              Menampilkan <span className="font-semibold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> - <span className="font-semibold text-slate-900">{Math.min(currentPage * pageSize, filteredOrders.length)}</span> dari <span className="font-semibold text-slate-900">{filteredOrders.length}</span> transaksi
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer text-xs font-semibold shadow-2xs transition-colors"
              >
                &larr; Sebelumnya
              </button>
              <div className="px-2 font-mono text-slate-700 font-semibold text-xs">
                {currentPage} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer text-xs font-semibold shadow-2xs transition-colors"
              >
                Selanjutnya &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Settlement Modal */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              Catat Pembayaran #{paymentModalOrder.noOrder}
            </h3>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
              <div className="text-slate-600 font-medium">Pelanggan: <strong className="text-slate-900">{paymentModalOrder.customerNama}</strong></div>
              <div className="text-slate-500">Total Tagihan: Rp {paymentModalOrder.totalTagihan.toLocaleString('id-ID')}</div>
              <div className="text-rose-600 font-bold font-mono">
                Sisa Piutang: Rp {paymentModalOrder.sisaPiutang.toLocaleString('id-ID')}
              </div>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Nominal Dibayarkan (Rp)
                </label>
                <input
                  type="number"
                  min="1"
                  max={paymentModalOrder.sisaPiutang}
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono font-bold focus:bg-white focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:bg-white focus:border-slate-900 cursor-pointer"
                >
                  <option value="Transfer BCA">Transfer BCA</option>
                  <option value="Transfer Mandiri">Transfer Mandiri</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Cash">Cash / Tunai</option>
                  <option value="COD">COD</option>
                  <option value="Marketplace Saldo">Marketplace Saldo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Masuk ke Akun Kas & Bank
                </label>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:bg-white focus:border-slate-900 cursor-pointer"
                >
                  <option value="">-- Otomatis Sesuai Metode Pembayaran / Default --</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama} ({a.tipe.toUpperCase()} - Saldo: Rp {a.saldo.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-emerald-700 mt-1 font-medium">
                  ⚡ Saldo kas/bank otomatis bertambah saat pelunasan disimpan
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Catatan Pelunasan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Bukti transfer terlampir via WA"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs cursor-pointer transition-colors"
                >
                  Simpan Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-rose-200 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              {isOwner ? 'Batalkan Order' : 'Ajukan Pembatalan Order'}
            </h3>
            <p className="text-xs text-slate-600">
              {isOwner
                ? `Order #${cancelModalOrder.noOrder} akan dibatalkan dan seluruh stok item akan otomatis dikembalikan ke Gudang Utama.`
                : `Pengajuan pembatalan #${cancelModalOrder.noOrder} akan dikirimkan ke Owner untuk disetujui.`}
            </p>

            <form onSubmit={handleConfirmCancel} className="space-y-3.5">
              {cancelModalOrder.totalTerbayar > 0 && isOwner && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-2 text-xs">
                  <label className="flex items-center gap-2 text-amber-900 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundToCustomer}
                      onChange={(e) => setRefundToCustomer(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-0"
                    />
                    <span>Potong Saldo Kas/Bank (Refund Dana Rp {cancelModalOrder.totalTerbayar.toLocaleString('id-ID')})</span>
                  </label>
                  {refundToCustomer && (
                    <div>
                      <label className="block text-[11px] text-amber-800 font-medium mb-1">
                        Pilih Akun Kas/Bank untuk Dipotong:
                      </label>
                      <select
                        value={refundAccountId}
                        onChange={(e) => setRefundAccountId(e.target.value)}
                        className="w-full bg-white border border-amber-200 rounded-xl p-2 text-xs text-slate-800 font-medium"
                      >
                        {cashAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nama} (Saldo: Rp {a.saldo.toLocaleString('id-ID')})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-amber-700 mt-1 font-medium">
                        ⚡ Saldo akun ini akan dipotong sebesar Rp {cancelModalOrder.totalTerbayar.toLocaleString('id-ID')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Alasan Pembatalan *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Customer membatalkan via Shopee / salah pilih ukuran..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:border-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs shadow-xs cursor-pointer transition-colors"
                >
                  {isOwner ? 'Ya, Batalkan & Kembalikan Stok' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Thermal Modal */}
      <ReceiptModal
        order={selectedReceiptOrder}
        onClose={() => setSelectedReceiptOrder(null)}
      />

      {/* Edit Order Modal (Koreksi Produk / Size / Harga / Customer / Tanggal) */}
      <EditOrderModal
        order={editModalOrder}
        isOpen={!!editModalOrder}
        onClose={() => setEditModalOrder(null)}
      />

      {/* Permanent Delete Confirmation Modal */}
      {deleteModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-rose-200 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              Hapus Order Permanen
            </h3>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="font-mono text-slate-900 font-bold">#{deleteModalOrder.noOrder}</div>
              <div className="text-slate-700">Customer: {deleteModalOrder.customerNama}</div>
              <div className="text-slate-500">Total: Rp {deleteModalOrder.totalTagihan.toLocaleString('id-ID')}</div>
            </div>
            <p className="text-xs text-rose-700 leading-relaxed">
              Peringatan: Order ini dan seluruh mutasi stok penjualannya akan dihapus secara permanen dari sistem. Tindakan ini cocok untuk menghapus data salah input atau order duplikat.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs shadow-xs cursor-pointer transition-colors"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
