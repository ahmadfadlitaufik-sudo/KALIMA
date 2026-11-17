import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Search,
  DollarSign,
  Truck,
  Percent,
  Calendar,
  Layers,
  Save,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Order, OrderItem, SalesChannelName, PaymentStatus, OrderStatus, ApparelSize } from '../types';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: (order: Order) => void;
}

export const EditOrderModal = React.memo<EditOrderModalProps>(function EditOrderModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}) {
  const { channels, skus, customers, calculateStock, updateOrder, isOwner } = useApp();

  // Form State
  const [tanggal, setTanggal] = useState('');
  const [channel, setChannel] = useState<SalesChannelName>('Shopee');
  const [customerNama, setCustomerNama] = useState('');
  const [customerHp, setCustomerHp] = useState('');
  const [customerKota, setCustomerKota] = useState('');
  const [noResi, setNoResi] = useState('');
  const [catatan, setCatatan] = useState('');
  const [statusOrder, setStatusOrder] = useState<OrderStatus>('selesai');

  // Items State
  const [cartItems, setCartItems] = useState<
    { sku: string; qty: number; hargaSatuan: number }[]
  >([]);

  // SKU Picker & Search
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('ALL');

  // Financials
  const [diskon, setDiskon] = useState<number>(0);
  const [ongkir, setOngkir] = useState<number>(0);
  const [statusBayar, setStatusBayar] = useState<PaymentStatus>('lunas');
  const [totalTerbayar, setTotalTerbayar] = useState<number>(0);
  const [jatuhTempo, setJatuhTempo] = useState<string>('');
  const [overrideStock, setOverrideStock] = useState<boolean>(true);

  // Status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track initialized order ID and open state to prevent wiping inputs while user is actively editing
  const lastInitializedOrderIdRef = useRef<string | null>(null);
  const wasOpenRef = useRef<boolean>(false);

  // Initialize form only when newly opened or when switching to a different order
  useEffect(() => {
    if (order && isOpen) {
      const isNewlyOpened = isOpen && !wasOpenRef.current;
      const isDifferentOrder = order.id !== lastInitializedOrderIdRef.current;

      if (isNewlyOpened || isDifferentOrder) {
        lastInitializedOrderIdRef.current = order.id;
        setTanggal(order.tanggal);
        setChannel(order.channel);
        setCustomerNama(order.customerNama);
        setCustomerHp(order.customerHp);
        setCustomerKota(order.customerKota);
        setNoResi(order.noResi || '');
        setCatatan(order.catatan || '');
        setStatusOrder(order.statusOrder);
        setDiskon(order.diskon || 0);
        setOngkir(order.ongkir || 0);
        setStatusBayar(order.statusBayar);
        setTotalTerbayar(order.totalTerbayar || 0);
        setJatuhTempo(order.jatuhTempo || '');
        setOverrideStock(true); // Default allow adjustments
        setErrorMessage(null);

        // Map existing items
        setCartItems(
          order.items.map((it) => ({
            sku: it.sku,
            qty: it.qty,
            hargaSatuan: it.hargaSatuan,
          }))
        );
      }
    }
    wasOpenRef.current = isOpen;
    if (!isOpen) {
      lastInitializedOrderIdRef.current = null;
    }
  }, [order?.id, isOpen]);

  // Calculations
  const channelObj = channels.find((c) => c.name === channel);
  const adminFeePct = channelObj?.adminFeePercent ?? 0;

  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, it) => acc + (it.hargaSatuan || 0) * it.qty, 0);
  }, [cartItems]);

  const totalHpp = useMemo(() => {
    return cartItems.reduce((acc, it) => {
      const skuObj = skus.find((s) => s.sku === it.sku);
      const hpp = skuObj?.hpp || 55000;
      return acc + hpp * it.qty;
    }, 0);
  }, [cartItems, skus]);

  const netSales = Math.max(0, subtotal - (diskon || 0));
  const adminFeeAmount = Math.round((netSales * adminFeePct) / 100);
  const totalTagihan = netSales + (ongkir || 0);
  const labaKotor = netSales - totalHpp - adminFeeAmount;
  const sisaPiutang = Math.max(0, totalTagihan - (totalTerbayar || 0));

  // Handle status bayar preset click
  const handleStatusBayarChange = (val: PaymentStatus) => {
    setStatusBayar(val);
    if (val === 'lunas') {
      setTotalTerbayar(totalTagihan);
    } else if (val === 'piutang') {
      setTotalTerbayar(0);
      if (!jatuhTempo) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setJatuhTempo(d.toISOString().split('T')[0]);
      }
    } else {
      setTotalTerbayar(Math.round(totalTagihan / 2));
      if (!jatuhTempo) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setJatuhTempo(d.toISOString().split('T')[0]);
      }
    }
  };

  // Add Item to cart
  const handleAddItem = (skuCode: string) => {
    const skuObj = skus.find((s) => s.sku === skuCode);
    if (!skuObj) return;

    setCartItems((prev) => {
      const existing = prev.find((it) => it.sku === skuCode);
      if (existing) {
        return prev.map((it) =>
          it.sku === skuCode ? { ...it, qty: it.qty + 1 } : it
        );
      }
      return [
        ...prev,
        {
          sku: skuCode,
          qty: 1,
          hargaSatuan: skuObj.price,
        },
      ];
    });
    setErrorMessage(null);
  };

  const handleUpdateItemQty = (skuCode: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveItem(skuCode);
      return;
    }
    setCartItems((prev) =>
      prev.map((it) => (it.sku === skuCode ? { ...it, qty } : it))
    );
  };

  const handleUpdateItemPrice = (skuCode: string, hargaSatuan: number) => {
    setCartItems((prev) =>
      prev.map((it) => (it.sku === skuCode ? { ...it, hargaSatuan } : it))
    );
  };

  const handleRemoveItem = (skuCode: string) => {
    setCartItems((prev) => prev.filter((it) => it.sku !== skuCode));
  };

  // Extract available sizes dynamically from existing SKUs
  const availableSizes = useMemo(() => {
    const setSizes = new Set<string>();
    skus.forEach((s) => {
      if (s.size) setSizes.add(s.size);
    });
    return Array.from(setSizes);
  }, [skus]);

  // Filtered SKUs for selection with flexible multi-field matching
  const filteredSkus = useMemo(() => {
    const q = skuSearchQuery.trim().toLowerCase();
    return skus.filter((item) => {
      const matchesSearch =
        !q ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.colorName && item.colorName.toLowerCase().includes(q)) ||
        (item.seriesCode && item.seriesCode.toLowerCase().includes(q)) ||
        (item.size && item.size.toLowerCase().includes(q));
      const matchesSize =
        selectedSizeFilter === 'ALL' || item.size === selectedSizeFilter;
      return matchesSearch && matchesSize;
    });
  }, [skus, skuSearchQuery, selectedSizeFilter]);

  // Submit edits
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (cartItems.length === 0) {
      setErrorMessage('Order harus memiliki minimal 1 produk kaos!');
      return;
    }

    if (!customerNama.trim()) {
      setErrorMessage('Nama pelanggan tidak boleh kosong!');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = updateOrder(order.id, {
      tanggal,
      channel,
      customerNama: customerNama.trim(),
      customerHp: customerHp.trim(),
      customerKota: customerKota.trim(),
      noResi: noResi.trim() || undefined,
      catatan: catatan.trim() || undefined,
      statusOrder,
      items: cartItems,
      diskon,
      ongkir,
      statusBayar,
      totalTerbayar,
      jatuhTempo: statusBayar !== 'lunas' ? jatuhTempo : undefined,
      overrideStock,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Gagal memperbarui order.');
      return;
    }

    if (result.order && onOrderUpdated) {
      onOrderUpdated(result.order);
    }
    onClose();
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="w-full max-w-4xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50/80 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Edit Detail Order #{order.noOrder}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold border border-slate-200">
                  {order.channel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Koreksi produk yang salah, jumlah pcs, harga khusus, channel, tanggal, dan pembayaran
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form
          onSubmit={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const target = e.target as HTMLElement;
              if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'submit') {
                e.preventDefault();
              }
            }
          }}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5"
        >
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Tanggal, Channel & Pelanggan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Tanggal Transaksi *
              </label>
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Sales Channel *
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as SalesChannelName)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-slate-900 cursor-pointer"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} (Admin {c.adminFeePercent}%)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Status Pesanan
              </label>
              <select
                value={statusOrder}
                onChange={(e) => setStatusOrder(e.target.value as OrderStatus)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-slate-900 cursor-pointer"
              >
                <option value="selesai">Selesai</option>
                <option value="diproses">Diproses</option>
                <option value="menunggu_approval_batal">Menunggu Batal</option>
                <option value="batal">Batal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Nama Customer / Pembeli *
              </label>
              <input
                type="text"
                required
                value={customerNama}
                onChange={(e) => setCustomerNama(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Nomor WhatsApp / HP
              </label>
              <input
                type="text"
                value={customerHp}
                onChange={(e) => setCustomerHp(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Kota / Domisili
              </label>
              <input
                type="text"
                value={customerKota}
                onChange={(e) => setCustomerKota(e.target.value)}
                placeholder="Jakarta / Bandung / dll"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-slate-900"
              />
            </div>
          </div>

          {/* Section 2: Items in Order (Edit Produk, Ganti Size / SKU) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>Daftar Produk Dipesan ({cartItems.reduce((a, b) => a + b.qty, 0)} Pcs)</span>
              </h4>
              <span className="text-xs text-slate-700 font-mono font-bold">
                Subtotal Produk: Rp {subtotal.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Current Items List */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-3.5">Produk & SKU</th>
                    <th className="py-3 px-2 text-center w-20">Qty (Pcs)</th>
                    <th className="py-3 px-2 text-right w-28">Harga Satuan</th>
                    <th className="py-3 px-3 text-right w-28">Subtotal</th>
                    <th className="py-3 px-2 text-center w-12">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cartItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        Belum ada item produk. Silakan pilih dan tambahkan produk di bawah.
                      </td>
                    </tr>
                  ) : (
                    cartItems.map((item) => {
                      const skuObj = skus.find((s) => s.sku === item.sku);
                      const currentStock = calculateStock(item.sku, 'Gudang Utama');
                      const itemSub = (item.hargaSatuan || 0) * item.qty;

                      return (
                        <tr key={item.sku} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-slate-900">
                              {skuObj?.name || item.sku}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200 font-bold">
                                {item.sku}
                              </span>
                              <span>Size: {skuObj?.size}</span>
                              <span>Warna: {skuObj?.colorName}</span>
                              <span className="text-slate-400">· Gudang: {currentStock} pcs</span>
                            </div>
                          </td>

                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) =>
                                  handleUpdateItemQty(item.sku, parseInt(e.target.value) || 0)
                                }
                                className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-center text-xs text-slate-900 font-mono font-bold"
                              />
                            </div>
                          </td>

                          <td className="py-3 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={item.hargaSatuan}
                              onChange={(e) =>
                                handleUpdateItemPrice(
                                  item.sku,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right text-xs text-slate-900 font-mono"
                            />
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            Rp {itemSub.toLocaleString('id-ID')}
                          </td>

                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.sku)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* SKU Selector / Search to Add new products */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  + Tambah / Ganti Produk ke Pesanan:
                </span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari SKU, nama kaos, warna..."
                      value={skuSearchQuery}
                      onChange={(e) => setSkuSearchQuery(e.target.value)}
                      className="bg-white border border-slate-200 pl-8 pr-3 py-1.5 rounded-xl text-xs text-slate-800 w-48 sm:w-60 focus:border-slate-900"
                    />
                  </div>

                  <select
                    value={selectedSizeFilter}
                    onChange={(e) => setSelectedSizeFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium"
                  >
                    <option value="ALL">Semua Size</option>
                    {availableSizes.map((sz) => (
                      <option key={sz} value={sz}>
                        Size {sz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SKU Quick List */}
              {filteredSkus.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                  Tidak ada SKU master yang cocok dengan kata kunci &quot;{skuSearchQuery}&quot;.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {filteredSkus.slice(0, 12).map((s) => {
                    const stockGudang = calculateStock(s.sku, 'Gudang Utama');
                    const isAdded = cartItems.some((it) => it.sku === s.sku);
                    const isOutOfStock = stockGudang <= 0;

                    return (
                      <div
                        key={s.sku}
                        className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 flex flex-col justify-between gap-2 text-xs transition-colors shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200 truncate">
                              {s.sku}
                            </span>
                            <span
                              className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold font-mono ${
                                isOutOfStock
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : stockGudang <= s.minStock
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {stockGudang} pcs
                            </span>
                          </div>

                          <div className="font-semibold text-slate-900 text-xs leading-tight line-clamp-2" title={s.name}>
                            {s.name}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            {s.size && (
                              <span className="bg-slate-100 px-1.5 rounded text-slate-600 font-mono">
                                Size: {s.size}
                              </span>
                            )}
                            {s.colorName && (
                              <span className="text-slate-500">
                                {s.colorName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div className="text-xs font-bold text-slate-900 font-mono">
                            Rp {s.price.toLocaleString('id-ID')}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddItem(s.sku)}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                              isAdded
                                ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                          >
                            {isAdded ? '+1 Tambah' : '+ Pilih'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Ongkir, Diskon & Keuangan */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Diskon Potongan (Rp)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
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

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Ongkir (Rp)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
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
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                No. Resi Pengiriman
              </label>
              <input
                type="text"
                placeholder="Misal: JNT-1234567"
                value={noResi}
                onChange={(e) => setNoResi(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Catatan Transaksi
              </label>
              <input
                type="text"
                placeholder="Catatan pesanan..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-slate-900"
              />
            </div>
          </div>

          {/* Section 4: Status Pembayaran */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Status Pembayaran:
              </span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                {(['lunas', 'sebagian', 'piutang'] as PaymentStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusBayarChange(st)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                      statusBayar === st
                        ? st === 'lunas'
                          ? 'bg-emerald-600 text-white font-bold'
                          : st === 'sebagian'
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-rose-600 text-white font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {st === 'sebagian' ? 'DP (Sebagian)' : st}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Total Terbayar (Rp)
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-bold focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Sisa Piutang (Rp)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`Rp ${sisaPiutang.toLocaleString('id-ID')}`}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-rose-600 font-mono font-bold"
                />
              </div>

              {statusBayar !== 'lunas' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Jatuh Tempo Piutang
                  </label>
                  <input
                    type="date"
                    value={jatuhTempo}
                    onChange={(e) => setJatuhTempo(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-slate-900"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Financial Summary Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Subtotal Produk:</span>
              <span className="font-mono text-slate-900 font-semibold">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            {diskon > 0 && (
              <div className="flex justify-between items-center text-rose-600 font-medium">
                <span>Potongan Diskon:</span>
                <span className="font-mono">- Rp {diskon.toLocaleString('id-ID')}</span>
              </div>
            )}
            {ongkir > 0 && (
              <div className="flex justify-between items-center text-slate-600">
                <span>Ongkos Kirim:</span>
                <span className="font-mono text-slate-900 font-semibold">+ Rp {ongkir.toLocaleString('id-ID')}</span>
              </div>
            )}
            {adminFeeAmount > 0 && (
              <div className="flex justify-between items-center text-slate-500 text-xs">
                <span>Biaya Admin Marketplace ({channel} {adminFeePct}%):</span>
                <span className="font-mono">- Rp {adminFeeAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
            {isOwner && (
              <div className="flex justify-between items-center text-slate-500 text-xs">
                <span>Total HPP Modal Bahan & BOM:</span>
                <span className="font-mono">Rp {totalHpp.toLocaleString('id-ID')}</span>
              </div>
            )}

            <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
              <span>Total Tagihan Pesanan:</span>
              <span className="font-mono text-lg font-black text-slate-900">
                Rp {totalTagihan.toLocaleString('id-ID')}
              </span>
            </div>

            {isOwner && (
              <div className="flex justify-between items-center text-xs font-semibold pt-1">
                <span className="text-slate-600">Estimasi Laba Kotor:</span>
                <span
                  className={`font-mono font-bold ${
                    labaKotor >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  Rp {labaKotor.toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50/80 border-t border-slate-200/80">
          <div className="text-xs text-slate-500 hidden sm:block">
            Perubahan stok & laba rugi disinkronkan secara real-time.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan Order'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
