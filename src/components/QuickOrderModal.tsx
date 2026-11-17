import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Receipt,
  UserPlus,
  DollarSign,
  Truck,
  Percent,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useCashBank } from '../hooks/useCashBank';
import { useRenderTracker } from '../hooks/useRenderTracker';
import { SalesChannelName, PaymentStatus, Order, getLocalDateString } from '../types';

const formatDisplayDate = (dStr: string) => {
  if (!dStr) return '';
  const d = new Date(dStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dStr;
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

// Normalize search text (remove punctuation, en-dashes, extra spaces, and handle common typos)
const normalizeSearchText = (str: string) => {
  return (str || '')
    .toLowerCase()
    .replace(/[\u2013\u2014-]/g, ' ')
    .replace(/pastekl/g, 'pastel')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: Order) => void;
}

export const QuickOrderModal = React.memo<QuickOrderModalProps>(function QuickOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
}) {
  const {
    channels,
    customers,
    skus,
    calculateStock,
    addOrder,
    addCustomer,
    isOwner,
  } = useApp();

  const {
    cashAccounts,
    defaultAccount,
    handleSalesTransactionSaved,
  } = useCashBank();

  const formContainerRef = useRef<HTMLFormElement>(null);

  // Tanggal Transaksi & Presets (Local Date safe across all timezones)
  const todayStr = useMemo(() => getLocalDateString(), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  }, []);
  const h2Str = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return getLocalDateString(d);
  }, []);
  const h3Str = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return getLocalDateString(d);
  }, []);
  const [orderDate, setOrderDate] = useState<string>(() => getLocalDateString());

  // Channel & Customer
  const [selectedChannel, setSelectedChannel] = useState<SalesChannelName | ''>('');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [newCustNama, setNewCustNama] = useState('');
  const [newCustHp, setNewCustHp] = useState('');
  const [newCustKota, setNewCustKota] = useState('Jakarta');

  // Items in cart
  const [cartItems, setCartItems] = useState<
    { sku: string; qty: number; customPrice?: number }[]
  >([]);

  // Search SKU
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('ALL');

  // Order Totals & Adjustments
  const [diskon, setDiskon] = useState<number>(0);
  const [ongkir, setOngkir] = useState<number>(0);
  const [statusBayar, setStatusBayar] = useState<PaymentStatus>('lunas');
  const [totalTerbayar, setTotalTerbayar] = useState<number>(0);
  const [jatuhTempo, setJatuhTempo] = useState<string>('');
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [potongOngkirDariKas, setPotongOngkirDariKas] = useState<boolean>(false);
  const [potongOngkirAccountId, setPotongOngkirAccountId] = useState<string>('');
  const [noResi, setNoResi] = useState('');
  const [catatan, setCatatan] = useState('');
  const [overrideStock, setOverrideStock] = useState(false);

  // Status & error
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trace and log re-render cycle, verifying if parent components or hooks pass new object/array references
  useRenderTracker(
    'QuickOrderModal',
    {
      // Parent component props
      prop_isOpen: isOpen,
      prop_onClose: onClose,
      prop_onOrderCreated: onOrderCreated,
      // Context arrays & callbacks
      ctx_channels: channels,
      ctx_customers: customers,
      ctx_skus: skus,
      ctx_calculateStock: calculateStock,
      ctx_addOrder: addOrder,
      ctx_addCustomer: addCustomer,
      ctx_isOwner: isOwner,
      // Cash/Bank hook references
      cash_accounts: cashAccounts,
      cash_defaultAccount: defaultAccount,
      cash_handler: handleSalesTransactionSaved,
      // Internal form states
      state_orderDate: orderDate,
      state_channel: selectedChannel,
      state_customerMode: customerMode,
      state_customerId: selectedCustomerId,
      state_cartItemsCount: cartItems.length,
      state_skuQuery: skuSearchQuery,
      state_sizeFilter: selectedSizeFilter,
      state_diskon: diskon,
      state_ongkir: ongkir,
      state_statusBayar: statusBayar,
      state_totalTerbayar: totalTerbayar,
    },
    { enabled: false, logToConsole: false }
  );

  // Clean form state reset
  const resetFormState = React.useCallback(() => {
    setCartItems([]);
    setOrderDate(getLocalDateString());
    setSelectedChannel('');
    setCustomerMode('existing');
    setSelectedCustomerId('');
    setNewCustNama('');
    setNewCustHp('');
    setNewCustKota('Jakarta');
    setSkuSearchQuery('');
    setSelectedSizeFilter('ALL');
    setDiskon(0);
    setOngkir(0);
    setStatusBayar('lunas');
    setTotalTerbayar(0);
    setJatuhTempo('');
    setPaymentAccountId('');
    setPotongOngkirDariKas(false);
    setPotongOngkirAccountId('');
    setNoResi('');
    setCatatan('');
    setOverrideStock(false);
    setErrorMessage(null);
    setIsSubmitting(false);
  }, [customers]);

  // Available sizes dynamically
  const availableSizes = useMemo(() => {
    const setSizes = new Set<string>();
    skus.forEach((s) => {
      if (s.size) setSizes.add(s.size);
    });
    return Array.from(setSizes);
  }, [skus]);

  // Filtered SKUs for selection with flexible multi-field token matching
  const filteredSkus = useMemo(() => {
    const rawQ = skuSearchQuery.trim();
    const standardSizes = new Set(['s', 'm', 'l', 'xl', 'xxl', '2xl', '3xl']);

    if (!rawQ) {
      if (selectedSizeFilter === 'ALL') return skus;
      return skus.filter((item) => item.size?.toUpperCase() === selectedSizeFilter.toUpperCase());
    }

    const normQ = normalizeSearchText(rawQ);
    const tokens = normQ.split(' ').filter(Boolean);
    const explicitSizeToken = tokens.find((t) => standardSizes.has(t));

    return skus.filter((item) => {
      // Composite searchable string from all item fields
      const itemComposite = normalizeSearchText(
        `${item.sku} ${item.name} ${item.colorName || ''} ${item.seriesCode || ''} ${item.size || ''} ${item.colorCode || ''}`
      );

      // Check all tokens must match
      const matchesAllTokens = tokens.every((token) => {
        if (itemComposite.includes(token)) return true;

        if (standardSizes.has(token) && item.size?.toLowerCase() === token) {
          return true;
        }

        // Fuzzy match for minor typos (length >= 4)
        if (token.length >= 4) {
          const words = itemComposite.split(' ');
          return words.some((w) => {
            if (w.startsWith(token) || token.startsWith(w)) return true;
            if (Math.abs(w.length - token.length) <= 1) {
              let diff = 0;
              for (let i = 0; i < Math.min(w.length, token.length); i++) {
                if (w[i] !== token[i]) diff++;
              }
              return diff <= 1;
            }
            return false;
          });
        }

        return false;
      });

      // Size match logic:
      // If user typed a specific size in the search bar, that takes priority
      let matchesSize = true;
      if (explicitSizeToken) {
        const itemSz = item.size?.toLowerCase() || '';
        matchesSize =
          itemSz === explicitSizeToken ||
          (explicitSizeToken === 'xxl' && itemSz === '2xl') ||
          (explicitSizeToken === '2xl' && itemSz === 'xxl');
      } else if (selectedSizeFilter !== 'ALL') {
        matchesSize = item.size?.toUpperCase() === selectedSizeFilter.toUpperCase();
      }

      return matchesAllTokens && matchesSize;
    });
  }, [skus, skuSearchQuery, selectedSizeFilter]);

  // Subtotal calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, it) => {
      const skuObj = skus.find((s) => s.sku === it.sku);
      const price = it.customPrice !== undefined ? it.customPrice : (skuObj?.price || 0);
      return acc + price * it.qty;
    }, 0);
  }, [cartItems, skus]);

  const netSales = Math.max(0, subtotal - (diskon || 0));
  const totalTagihan = netSales + (ongkir || 0);

  // Sync totalTerbayar default with statusBayar
  const handleStatusBayarChange = (val: PaymentStatus) => {
    setStatusBayar(val);
    if (val === 'lunas') {
      setTotalTerbayar(totalTagihan);
    } else if (val === 'piutang') {
      setTotalTerbayar(0);
      // Auto set 7 days default
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setJatuhTempo(d.toISOString().split('T')[0]);
    } else {
      // Sebagian (DP 50%)
      setTotalTerbayar(Math.round(totalTagihan / 2));
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setJatuhTempo(d.toISOString().split('T')[0]);
    }
  };

  const handleAddItem = (skuCode: string) => {
    setCartItems((prev) => {
      const existing = prev.find((it) => it.sku === skuCode);
      if (existing) {
        return prev.map((it) =>
          it.sku === skuCode ? { ...it, qty: it.qty + 1 } : it
        );
      }
      return [...prev, { sku: skuCode, qty: 1 }];
    });
  };

  const handleUpdatePrice = (skuCode: string, newPrice: number | undefined) => {
    setCartItems((prev) =>
      prev.map((it) =>
        it.sku === skuCode
          ? { ...it, customPrice: newPrice !== undefined ? Math.max(0, newPrice) : undefined }
          : it
      )
    );
  };

  const handleUpdateQty = (skuCode: string, newQty: number) => {
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((it) => it.sku !== skuCode));
    } else {
      setCartItems((prev) =>
        prev.map((it) => (it.sku === skuCode ? { ...it, qty: newQty } : it))
      );
    }
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    // Prevent double submission race conditions
    if (isSubmitting) return;
    setErrorMessage(null);

    if (cartItems.length === 0) {
      setErrorMessage(
        'Keranjang order masih kosong. Silakan pilih minimal 1 produk/kaos pada daftar produk di atas dengan menekan tombol "+ Tambah".'
      );
      formContainerRef.current?.scrollTo({ top: 160, behavior: 'smooth' });
      return;
    }

    if (!selectedChannel) {
      setErrorMessage('Pilih sales channel terlebih dahulu.');
      formContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (customerMode === 'existing' && !customers.some((c) => c.id === selectedCustomerId)) {
      setErrorMessage('Pilih pelanggan terlebih dahulu, atau tambahkan sebagai pelanggan baru.');
      formContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    let customerId = selectedCustomerId;
    let customerNama = '';
    let customerHp = '';
    let customerKota = '';

    if (customerMode === 'new') {
      if (!newCustNama.trim()) {
        setErrorMessage('Nama pelanggan baru wajib diisi.');
        formContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const createdCust = addCustomer({
        nama: newCustNama.trim(),
        noHp: newCustHp.trim() || '-',
        kota: newCustKota.trim() || 'Jakarta',
        tipe: 'Retail',
      });
      customerId = createdCust.id;
      customerNama = createdCust.nama;
      customerHp = createdCust.noHp;
      customerKota = createdCust.kota;
    } else {
      const cust = customers.find((c) => c.id === selectedCustomerId);
      customerId = cust?.id || `cust-umum-${Date.now()}`;
      customerNama = cust?.nama || 'Pelanggan Umum';
      customerHp = cust?.noHp || '-';
      customerKota = cust?.kota || 'Jakarta';
    }

    // Auto default jatuhTempo jika pembayaran piutang/sebagian
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 7);
    const finalJatuhTempo =
      statusBayar !== 'lunas'
        ? jatuhTempo || defaultDueDate.toISOString().split('T')[0]
        : undefined;

    setIsSubmitting(true);

    try {
      // Await persistence and synchronous state update to avoid race conditions
      const result = await addOrder({
        tanggal: orderDate,
        channel: selectedChannel as SalesChannelName,
        customerId,
        customerNama,
        customerHp,
        customerKota,
        items: cartItems.map((it) => {
          const skuObj = skus.find((s) => s.sku === it.sku);
          const defaultPrice = skuObj?.price ?? 129000;
          return {
            sku: it.sku,
            qty: it.qty,
            hargaSatuan: it.customPrice !== undefined ? it.customPrice : defaultPrice,
          };
        }),
        diskon: Number(diskon) || 0,
        ongkir: Number(ongkir) || 0,
        statusBayar,
        totalTerbayar: statusBayar === 'lunas' ? totalTagihan : (Number(totalTerbayar) || 0),
        jatuhTempo: finalJatuhTempo,
        noResi: noResi.trim() || undefined,
        catatan: catatan.trim() || undefined,
        overrideStock,
      });

      if (!result.success) {
        setIsSubmitting(false);
        setErrorMessage(result.error || 'Gagal menyimpan transaksi.');
        formContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Catat mutasi kas masuk dan potong saldo ongkir/admin secara otomatis via useCashBank
      if (result.order) {
        try {
          handleSalesTransactionSaved({
            order: result.order,
            paymentAccountId: paymentAccountId || defaultAccount?.id,
            potongOngkirDariKas: potongOngkirDariKas && (ongkir || 0) > 0,
            potongOngkirAccountId: potongOngkirAccountId || paymentAccountId || defaultAccount?.id,
          });
        } catch (cashErr) {
          console.error('Error recording sales cash transaction:', cashErr);
        }
      }

      // Reset form states cleanly
      resetFormState();

      if (result.order && onOrderCreated) {
        onOrderCreated(result.order);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving order:', err);
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem saat menyimpan transaksi.');
      formContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleClose = () => {
    resetFormState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              +
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Input Penjualan Cepat (Target &lt; 60 dtk)
              </h2>
              <p className="text-xs text-slate-500">
                Otomatis mengurangi stok gudang & mencatat piutang bila belum lunas
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          ref={formContainerRef}
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const target = e.target as HTMLElement;
              if (target.tagName === 'INPUT' && (target as HTMLInputElement).name === 'skuSearch') {
                e.preventDefault();
                if (filteredSkus.length > 0) {
                  handleAddItem(filteredSkus[0].sku);
                }
                return;
              }
              if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'submit') {
                e.preventDefault();
              }
            }
          }}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5"
        >
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Tanggal Transaksi Penjualan */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>1. Tanggal Transaksi Penjualan</span>
              </label>

              {/* Preset Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOrderDate(todayStr)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    orderDate === todayStr
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setOrderDate(yesterdayStr)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    orderDate === yesterdayStr
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Kemarin
                </button>
                <button
                  type="button"
                  onClick={() => setOrderDate(h2Str)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    orderDate === h2Str
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  H-2
                </button>
                <button
                  type="button"
                  onClick={() => setOrderDate(h3Str)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    orderDate === h3Str
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  H-3
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-slate-900 shadow-2xs font-mono cursor-pointer"
                />
              </div>

              <div>
                {orderDate === todayStr ? (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs font-semibold text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Hari Ini ({formatDisplayDate(orderDate)})</span>
                  </div>
                ) : orderDate < todayStr ? (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Penjualan Lampau: {formatDisplayDate(orderDate)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-900">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Pre-Order / Mendatang: {formatDisplayDate(orderDate)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Channel Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              2. Pilih Sales Channel
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {channels.map((ch) => {
                const isSelected = selectedChannel === ch.name;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannel(ch.name)}
                    className={`p-2.5 rounded-2xl text-center border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white font-bold border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-semibold">{ch.name}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        isSelected ? 'text-slate-300 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {ch.adminFeePercent > 0 ? `Biaya ${ch.adminFeePercent}%` : 'Biaya 0%'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Customer Information */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                3. Pelanggan
              </label>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  className={`px-3 py-1 rounded-xl font-medium cursor-pointer transition-colors ${
                    customerMode === 'existing'
                      ? 'bg-white text-slate-900 font-bold border border-slate-200/90 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Pelanggan Lama
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`px-3 py-1 rounded-xl font-medium cursor-pointer transition-colors ${
                    customerMode === 'new'
                      ? 'bg-white text-slate-900 font-bold border border-slate-200/90 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  + Pelanggan Baru
                </button>
              </div>
            </div>

            {customerMode === 'existing' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-slate-900 cursor-pointer"
                >
                  <option value="" disabled>
                    — Pilih pelanggan —
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama} - {c.kota} ({c.noHp})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="No. Resi Pengiriman (Opsional)"
                  value={noResi}
                  onChange={(e) => setNoResi(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900 font-mono"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Nama Lengkap *"
                  value={newCustNama}
                  onChange={(e) => setNewCustNama(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
                  required
                />
                <input
                  type="text"
                  placeholder="No. WhatsApp / HP"
                  value={newCustHp}
                  onChange={(e) => setNewCustHp(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900 font-mono"
                />
                <input
                  type="text"
                  placeholder="Kota / Daerah"
                  value={newCustKota}
                  onChange={(e) => setNewCustKota(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
                />
              </div>
            )}
          </div>

          {/* 4. Fast SKU Search & Add */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                4. Tambah Produk / Kaos
              </label>
              {/* Quick Size Filter Pills */}
              <div className="flex items-center gap-1 text-xs overflow-x-auto pb-0.5">
                {['ALL', ...Array.from(new Set(['S', 'M', 'L', 'XL', '2XL', ...availableSizes]))].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSelectedSizeFilter(sz)}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      selectedSizeFilter === sz
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-2.5">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="skuSearch"
                placeholder="Cari SKU / Warna / Seri (contoh: pastel green, 210 hitam, oversize, regular)..."
                value={skuSearchQuery}
                onChange={(e) => setSkuSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-slate-900"
              />
            </div>

            {/* Active Size Filter Notice */}
            {selectedSizeFilter !== 'ALL' && (
              <div className="flex items-center justify-between text-[11px] bg-slate-100/90 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 mb-2.5">
                <span>
                  Filter ukuran aktif: <strong className="text-slate-900 font-bold uppercase">{selectedSizeFilter}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSizeFilter('ALL')}
                  className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                >
                  Tampilkan Semua Ukuran (ALL) ✕
                </button>
              </div>
            )}

            {/* Quick SKU Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              {filteredSkus.length === 0 ? (
                <div className="col-span-full py-8 px-4 text-center space-y-2 bg-white rounded-xl border border-slate-200/70">
                  <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Tidak ditemukan produk yang cocok dengan pencarian &quot;{skuSearchQuery}&quot;
                  </p>
                  {selectedSizeFilter !== 'ALL' && (
                    <p className="text-[11px] text-slate-500">
                      Ukuran saat ini difilter ke <strong>{selectedSizeFilter}</strong>.{' '}
                      <button
                        type="button"
                        onClick={() => setSelectedSizeFilter('ALL')}
                        className="text-blue-600 font-bold underline hover:text-blue-800 cursor-pointer ml-1"
                      >
                        Klik di sini untuk tampilkan semua ukuran (ALL)
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                filteredSkus.slice(0, 60).map((sku) => {
                  const stockGudang = calculateStock(sku.sku, 'Gudang Utama');
                  const isOutOfStock = stockGudang <= 0;
                  const inCart = cartItems.find((c) => c.sku === sku.sku);

                  return (
                    <button
                      key={sku.sku}
                      type="button"
                      onClick={() => handleAddItem(sku.sku)}
                      className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between text-xs cursor-pointer ${
                        inCart
                          ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono text-[11px] text-slate-700 font-bold truncate">
                            {sku.sku}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums shrink-0 ${
                              stockGudang < 0
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isOutOfStock
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : stockGudang <= sku.minStock
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {stockGudang} pcs
                          </span>
                        </div>
                        <div className="text-slate-800 text-[11px] font-medium line-clamp-2 leading-snug">
                          {sku.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 font-bold rounded">
                            {sku.size || 'OS'}
                          </span>
                          {sku.colorName && (
                            <span className="truncate text-slate-500 font-medium">
                              {sku.colorName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                        <span className="font-semibold text-slate-900 tabular-nums">
                          Rp {sku.price.toLocaleString('id-ID')}
                        </span>
                        {inCart ? (
                          <span className="bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                            {inCart.qty}x
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 hover:text-slate-900 font-semibold">
                            + Tambah
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 5. Cart Items Table */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                5. Daftar Item ({cartItems.reduce((a, b) => a + b.qty, 0)} pcs)
              </label>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Belum ada produk dipilih. Klik "+ Tambah" pada daftar produk di atas untuk memasukkan ke keranjang.
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.some((it) => calculateStock(it.sku, 'Gudang Utama') < it.qty) && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Sebagian produk melebihi stok fisik gudang saat ini.</span>
                    </div>
                    <label className="flex items-center gap-2 font-bold cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-amber-300 hover:bg-amber-100/60 shrink-0 select-none">
                      <input
                        type="checkbox"
                        checked={overrideStock}
                        onChange={(e) => setOverrideStock(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-0"
                      />
                      <span>Izinkan Stok Minus / Pre-Order</span>
                    </label>
                  </div>
                )}
                {cartItems.map((it) => {
                  const skuObj = skus.find((s) => s.sku === it.sku);
                  const defaultPrice = skuObj?.price || 0;
                  const price = it.customPrice !== undefined ? it.customPrice : defaultPrice;
                  const isCustomized = it.customPrice !== undefined && it.customPrice !== defaultPrice;
                  const stockGudang = calculateStock(it.sku, 'Gudang Utama');
                  const isStockDeficit = stockGudang < it.qty;

                  return (
                    <div
                      key={it.sku}
                      className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 text-xs shadow-2xs space-y-2.5 transition-all"
                    >
                      {/* Top Header: Title, SKU details, and Delete button */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                              {skuObj?.name || it.sku}
                            </span>
                            {isCustomized && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                Harga Khusus / Custom
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono text-slate-700 font-semibold">{it.sku}</span>
                            <span>·</span>
                            <span>Size: <strong className="text-slate-800">{skuObj?.size || 'OS'}</strong></span>
                            {skuObj?.colorName && (
                              <>
                                <span>·</span>
                                <span>Warna: <strong className="text-slate-800">{skuObj.colorName}</strong></span>
                              </>
                            )}
                            <span>·</span>
                            <span>Stok Gudang: {stockGudang}</span>
                            {isStockDeficit && (
                              <span className="text-rose-600 font-bold">
                                (Defisit {- (stockGudang - it.qty)} pcs!)
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUpdateQty(it.sku, 0)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title="Hapus dari keranjang"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Bottom Controls: Unit Price Customizer, Qty, and Subtotal */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        {/* Harga Satuan input */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600">
                            Harga Satuan:
                          </span>
                          <div className="relative flex items-center">
                            <span className="absolute left-2.5 text-[11px] font-medium text-slate-400 select-none">
                              Rp
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={price}
                              onFocus={(e) => { if (price === 0) e.target.select(); }}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') {
                                  handleUpdatePrice(it.sku, 0);
                                } else {
                                  const val = parseFloat(raw);
                                  handleUpdatePrice(it.sku, isNaN(val) ? 0 : Math.max(0, val));
                                }
                              }}
                              className={`w-28 sm:w-32 bg-slate-50 border pl-7 pr-2 py-1 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none transition-colors ${
                                isCustomized
                                  ? 'border-amber-400 bg-amber-50/50 text-amber-950 focus:border-amber-600 ring-1 ring-amber-400'
                                  : 'border-slate-200 focus:border-slate-800'
                              }`}
                              title="Ketik untuk mengubah harga satuan khusus order ini"
                            />
                          </div>

                          {isCustomized ? (
                            <button
                              type="button"
                              onClick={() => handleUpdatePrice(it.sku, undefined)}
                              className="text-[10px] text-amber-700 hover:text-rose-600 font-semibold underline cursor-pointer"
                              title={`Kembalikan ke harga normal Rp ${defaultPrice.toLocaleString('id-ID')}`}
                            >
                              Reset Normal (Rp {defaultPrice.toLocaleString('id-ID')})
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              (Harga Normal)
                            </span>
                          )}
                        </div>

                        {/* Qty & Item Subtotal */}
                        <div className="flex items-center gap-3 ml-auto">
                          {/* Stepper */}
                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(it.sku, it.qty - 1)}
                              className="px-2.5 py-1 text-slate-700 hover:bg-slate-200 cursor-pointer font-bold select-none"
                            >
                              -
                            </button>
                            <span className="px-3 py-1 text-slate-900 font-bold tabular-nums font-mono text-xs select-none">
                              {it.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(it.sku, it.qty + 1)}
                              className="px-2.5 py-1 text-slate-700 hover:bg-slate-200 cursor-pointer font-bold select-none"
                            >
                              +
                            </button>
                          </div>

                          {/* Subtotal */}
                          <div className="text-right min-w-[90px]">
                            <div className="text-[10px] text-slate-400 font-medium">Subtotal</div>
                            <div className="font-bold text-slate-900 tabular-nums font-mono text-xs sm:text-sm">
                              Rp {(price * it.qty).toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Discounts, Ongkir & Payments */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Diskon / Potongan (Rp)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={diskon}
                  onFocus={(e) => { if (diskon === 0) e.target.select(); }}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setDiskon(raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0));
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Ongkos Kirim (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={ongkir}
                onFocus={(e) => { if (ongkir === 0) e.target.select(); }}
                onChange={(e) => {
                  const raw = e.target.value;
                  setOngkir(raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0));
                }}
                placeholder="0"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Status Pembayaran
              </label>
              <select
                value={statusBayar}
                onChange={(e) => handleStatusBayarChange(e.target.value as PaymentStatus)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:border-slate-900 cursor-pointer"
              >
                <option value="lunas">Lunas</option>
                <option value="piutang">Belum Lunas (Piutang Penuh)</option>
                <option value="sebagian">Sebagian (DP / Cicil)</option>
              </select>
            </div>

            {statusBayar !== 'lunas' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Jumlah Terbayar (DP) Rp
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalTagihan > 0 ? totalTagihan : undefined}
                    value={totalTerbayar}
                    onFocus={(e) => { if (totalTerbayar === 0) e.target.select(); }}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setTotalTerbayar(raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0));
                    }}
                    placeholder="0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Sisa Piutang
                  </label>
                  <div className="bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-700 font-mono font-bold">
                    Rp {Math.max(0, totalTagihan - totalTerbayar).toLocaleString('id-ID')}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Jatuh Tempo Pembayaran *
                  </label>
                  <input
                    type="date"
                    value={jatuhTempo}
                    onChange={(e) => setJatuhTempo(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-slate-900 font-mono"
                  />
                </div>
              </>
            )}

            {statusBayar !== 'piutang' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Masuk ke Akun Kas/Bank
                </label>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:border-slate-900 cursor-pointer"
                >
                  <option value="">-- Rekening Utama / Kasir --</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama} (Rp {a.saldo.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {ongkir > 0 && (
              <div className="col-span-1 sm:col-span-3 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-2">
                <label className="flex items-center gap-2 text-xs text-amber-900 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={potongOngkirDariKas}
                    onChange={(e) => setPotongOngkirDariKas(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-0"
                  />
                  <span>Potong Kas/Bank untuk Talangan Ongkir Kirim (Rp {ongkir.toLocaleString('id-ID')})</span>
                </label>
                {potongOngkirDariKas && (
                  <div>
                    <label className="block text-[10px] text-amber-800 font-medium mb-1">
                      Pilih Akun Kas/Bank untuk Dipotong Ongkir:
                    </label>
                    <select
                      value={potongOngkirAccountId}
                      onChange={(e) => setPotongOngkirAccountId(e.target.value)}
                      className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="">-- Sama dengan Akun Penerimaan / Default --</option>
                      {cashAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nama} (Saldo: Rp {a.saldo.toLocaleString('id-ID')})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-amber-700 mt-1 font-medium">
                      ⚡ Saldo akun ini akan dipotong Rp {ongkir.toLocaleString('id-ID')} saat transaksi disimpan.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes & Stock Override */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Catatan pesanan (opsional, misal: Packing kayu, dropship, promo 9.9)..."
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900"
            />

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1 select-none">
              <input
                type="checkbox"
                checked={overrideStock}
                onChange={(e) => setOverrideStock(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <span>
                Izinkan simpan stok minus / pre-order (Fisik barang tersedia di toko tapi belum tercatat PO konveksi)
              </span>
            </label>
          </div>
        </form>

        {/* Footer Summary & Submit */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col gap-3">
          {/* Prominent Footer Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
              {errorMessage.includes('Stok tidak cukup') && (
                <button
                  type="button"
                  onClick={() => {
                    setOverrideStock(true);
                    setErrorMessage(null);
                  }}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shrink-0 cursor-pointer shadow-xs"
                >
                  ✓ Izinkan Stok Minus & Lanjut
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Total Tagihan</div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  Rp {totalTagihan.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="text-right sm:text-left text-xs text-slate-500">
                <div>Subtotal: Rp {subtotal.toLocaleString('id-ID')}</div>
                {diskon > 0 && <div className="text-rose-600 font-medium">- Diskon: Rp {diskon.toLocaleString('id-ID')}</div>}
                {ongkir > 0 && <div>+ Ongkir: Rp {ongkir.toLocaleString('id-ID')}</div>}
              </div>
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Menyimpan Order...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 stroke-[2.5]" />
                    <span>Simpan Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
