import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  Send,
  FileCheck,
  RotateCcw,
  DollarSign,
  Plus,
  Search,
  Package,
  Clock,
  UserCheck,
  AlertCircle,
  FileText,
  Printer,
  X,
  Check,
  CheckCircle2,
  MapPin,
  Phone,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Trash2,
  Edit2,
  Percent,
  Calendar,
  Layers,
  ArrowRight,
  ArrowDownLeft,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Reseller, PaymentStatus, SuratTitip } from '../types';

export const ResellerView: React.FC = () => {
  const {
    resellers,
    skus,
    suratTitip,
    laporanTitipLaku,
    orders,
    stockMovements,
    calculateStock,
    createSuratTitip,
    createLaporanTitipLaku,
    recordReturTitip,
    recordSetoranReseller,
    addReseller,
    updateReseller,
    deleteReseller,
    cashAccounts,
    cashMutations,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'daftar_reseller' | 'stok_titipan' | 'surat_titip' | 'laporan_laku' | 'retur_setoran'>('daftar_reseller');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'Platinum' | 'Gold' | 'Silver'>('ALL');

  // Modal Surat Titip
  const [isSuratModalOpen, setIsSuratModalOpen] = useState(false);
  const [selectedResellerId, setSelectedResellerId] = useState<string>(resellers[0]?.id || '');
  const [suratItems, setSuratItems] = useState<{ sku: string; qty: number; hargaTitip: number }[]>([
    { sku: skus[0]?.sku || '', qty: 10, hargaTitip: 105000 },
  ]);
  const [suratCatatan, setSuratCatatan] = useState('Pengiriman batch konsinyasi');
  const [suratError, setSuratError] = useState<string | null>(null);

  // Modal Laporan Laku
  const [isLakuModalOpen, setIsLakuModalOpen] = useState(false);
  const [lakuResellerId, setLakuResellerId] = useState<string>(resellers[0]?.id || '');
  const [lakuPeriode, setLakuPeriode] = useState('September 2026');
  const [lakuItems, setLakuItems] = useState<{ sku: string; qty: number; hargaTitip: number }[]>([
    { sku: skus[0]?.sku || '', qty: 5, hargaTitip: 105000 },
  ]);
  const [lakuStatusBayar, setLakuStatusBayar] = useState<PaymentStatus>('lunas');
  const [lakuTerbayar, setLakuTerbayar] = useState<number>(0);

  // Modal Retur Titip
  const [isReturModalOpen, setIsReturModalOpen] = useState(false);
  const [returResellerId, setReturResellerId] = useState<string>(resellers[0]?.id || '');
  const [returItems, setReturItems] = useState<
    { sku: string; qty: number; kondisi: 'baik_ke_gudang' | 'rusak_ke_reject' }[]
  >([{ sku: skus[0]?.sku || '', qty: 2, kondisi: 'baik_ke_gudang' }]);
  const [returAlasan, setReturAlasan] = useState('Rotasi barang tidak laku');

  // Modal Setoran
  const [isSetoranModalOpen, setIsSetoranModalOpen] = useState(false);
  const [setoranResellerId, setSetoranResellerId] = useState<string>(resellers[0]?.id || '');
  const [setoranAmount, setSetoranAmount] = useState<number>(0);
  const [setoranMethod, setSetoranMethod] = useState('Transfer BCA');
  const [setoranAccountId, setSetoranAccountId] = useState('');
  const [setoranNote, setSetoranNote] = useState('Setoran hasil penjualan konsinyasi');

  // Auto-sync initial reseller selection when resellers list is loaded
  useEffect(() => {
    if (resellers.length > 0) {
      if (!selectedResellerId) setSelectedResellerId(resellers[0].id);
      if (!lakuResellerId) setLakuResellerId(resellers[0].id);
      if (!returResellerId) setReturResellerId(resellers[0].id);
      if (!setoranResellerId) setSetoranResellerId(resellers[0].id);
    }
  }, [resellers]);

  // Modal Reseller Form (New & Edit)
  const [isResellerModalOpen, setIsResellerModalOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [resNama, setResNama] = useState('');
  const [resPic, setResPic] = useState('');
  const [resHp, setResHp] = useState('');
  const [resKota, setResKota] = useState('Bandung');
  const [resAlamat, setResAlamat] = useState('');
  const [resLevel, setResLevel] = useState<'Platinum' | 'Gold' | 'Silver'>('Gold');
  const [resDiskon, setResDiskon] = useState<number>(20);
  const [resPlafon, setResPlafon] = useState<number>(10000000);
  const [resJadwal, setResJadwal] = useState('Setiap Hari Senin');
  const [resellerFormError, setResellerFormError] = useState<string | null>(null);

  // Modal Delete Reseller Confirmation
  const [deleteModalReseller, setDeleteModalReseller] = useState<Reseller | null>(null);
  const [deleteReturnStock, setDeleteReturnStock] = useState<boolean>(true);
  const [deleteNotification, setDeleteNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteResellerError, setDeleteResellerError] = useState<string | null>(null);

  // Modal Print Surat Jalan Titip
  const [selectedSuratForPrint, setSelectedSuratForPrint] = useState<SuratTitip | null>(null);
  const [isPrintSuratOpen, setIsPrintSuratOpen] = useState(false);

  // Calculate stock at reseller
  const getResellerStock = (resellerNama: string) => {
    const loc = `Reseller: ${resellerNama}`;
    const map: Record<string, number> = {};
    stockMovements.forEach((m) => {
      if (m.lokasi === loc) {
        map[m.sku] = (map[m.sku] || 0) + m.qty;
      }
    });
    return map;
  };

  // Reseller Piutang Summary
  const getResellerPiutang = (resellerId: string) => {
    return orders
      .filter((o) => o.channel === 'Reseller' && o.customerId === resellerId && o.statusOrder !== 'batal')
      .reduce((sum, o) => sum + o.sisaPiutang, 0);
  };

  // Estimate Nilai Stok Titip
  const getResellerStockValue = (resellerNama: string) => {
    const stockMap = getResellerStock(resellerNama);
    return Object.entries(stockMap).reduce((total, [skuCode, qty]) => {
      if (qty <= 0) return total;
      const skuObj = skus.find((s) => s.sku === skuCode);
      const price = skuObj?.price || 105000;
      return total + qty * price;
    }, 0);
  };

  // Filtered Resellers
  const filteredResellers = useMemo(() => {
    return resellers.filter((res) => {
      const matchSearch =
        res.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        res.kota.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (res.kontakPerson && res.kontakPerson.toLowerCase().includes(searchQuery.toLowerCase())) ||
        res.noHp.includes(searchQuery);

      const matchLevel = levelFilter === 'ALL' || res.level === levelFilter;
      return matchSearch && matchLevel;
    });
  }, [resellers, searchQuery, levelFilter]);

  // Overall KPI Calculations
  const metrics = useMemo(() => {
    let totalTitipanPcs = 0;
    let totalTitipanValue = 0;
    let totalPiutang = 0;
    let resellersWithPiutang = 0;

    resellers.forEach((res) => {
      const stockMap = getResellerStock(res.nama);
      const pcs = Object.values(stockMap).reduce((a, b) => a + Math.max(0, b), 0);
      totalTitipanPcs += pcs;
      totalTitipanValue += getResellerStockValue(res.nama);

      const piutang = getResellerPiutang(res.id);
      if (piutang > 0) {
        totalPiutang += piutang;
        resellersWithPiutang += 1;
      }
    });

    const totalLakuRevenue = laporanTitipLaku.reduce((acc, lt) => acc + lt.totalTagihan, 0);
    const totalLakuQty = laporanTitipLaku.reduce(
      (acc, lt) => acc + lt.items.reduce((sum, it) => sum + it.qty, 0),
      0
    );

    return {
      totalMitra: resellers.length,
      platinumCount: resellers.filter((r) => r.level === 'Platinum').length,
      goldCount: resellers.filter((r) => r.level === 'Gold').length,
      silverCount: resellers.filter((r) => r.level === 'Silver' || !r.level).length,
      totalTitipanPcs,
      totalTitipanValue,
      totalPiutang,
      resellersWithPiutang,
      totalLakuRevenue,
      totalLakuQty,
      totalSuratJalan: suratTitip.length,
    };
  }, [resellers, stockMovements, orders, laporanTitipLaku, suratTitip]);

  // Handlers for Modals
  const openNewResellerModal = () => {
    setEditingReseller(null);
    setResNama('');
    setResPic('');
    setResHp('');
    setResKota('Bandung');
    setResAlamat('');
    setResLevel('Gold');
    setResDiskon(20);
    setResPlafon(10000000);
    setResJadwal('Setiap Hari Senin');
    setResellerFormError(null);
    setIsResellerModalOpen(true);
  };

  const openEditResellerModal = (res: Reseller) => {
    setEditingReseller(res);
    setResNama(res.nama);
    setResPic(res.kontakPerson || '');
    setResHp(res.noHp);
    setResKota(res.kota || 'Bandung');
    setResAlamat(res.alamat || '');
    setResLevel(res.level || 'Gold');
    setResDiskon(res.diskonPersen ?? 20);
    setResPlafon(res.batasPlafonTitipan ?? 10000000);
    setResJadwal(res.jadwalSetoran || 'Setiap Hari Senin');
    setResellerFormError(null);
    setIsResellerModalOpen(true);
  };

  const handleSaveResellerForm = (e: React.FormEvent) => {
    e.preventDefault();
    setResellerFormError(null);
    if (!resNama.trim() || !resHp.trim()) {
      setResellerFormError('Nama Toko Mitra dan Nomor WhatsApp wajib diisi.');
      return;
    }

    if (editingReseller) {
      updateReseller(editingReseller.id, {
        nama: resNama.trim(),
        kontakPerson: resPic.trim() || undefined,
        noHp: resHp.trim(),
        kota: resKota.trim(),
        alamat: resAlamat.trim(),
        level: resLevel,
        diskonPersen: resDiskon,
        komisiPercent: resDiskon,
        batasPlafonTitipan: resPlafon,
        jadwalSetoran: resJadwal,
      });
      setDeleteNotification({
        type: 'success',
        message: `Data mitra "${resNama.trim()}" berhasil diperbarui.`,
      });
    } else {
      addReseller({
        nama: resNama.trim(),
        kontakPerson: resPic.trim() || undefined,
        noHp: resHp.trim(),
        alamat: resAlamat.trim(),
        kota: resKota.trim(),
        level: resLevel,
        diskonPersen: resDiskon,
        komisiPercent: resDiskon,
        batasPlafonTitipan: resPlafon,
        jadwalSetoran: resJadwal,
      });
      setDeleteNotification({
        type: 'success',
        message: `Mitra baru "${resNama.trim()}" berhasil didaftarkan.`,
      });
    }

    setIsResellerModalOpen(false);
    setTimeout(() => setDeleteNotification(null), 4000);
  };

  const handleConfirmDeleteReseller = () => {
    if (!deleteModalReseller) return;
    setDeleteResellerError(null);
    const resName = deleteModalReseller.nama;
    const resId = deleteModalReseller.id;
    const result = deleteReseller(resId, { returnStockToWarehouse: deleteReturnStock, force: false });

    if (result.success) {
      setDeleteNotification({
        type: 'success',
        message: `Mitra "${resName}" berhasil dihapus.${result.returnedQty ? ` Sebanyak ${result.returnedQty} pcs sisa stok titip fisik otomatis ditarik kembali ke Gudang Utama.` : ''}`,
      });
      setDeleteModalReseller(null);
      setDeleteResellerError(null);
      setTimeout(() => setDeleteNotification(null), 6000);
    } else {
      setDeleteResellerError(result.error || 'Gagal menghapus mitra konsinyasi.');
      setDeleteNotification({
        type: 'error',
        message: result.error || 'Gagal menghapus mitra konsinyasi.',
      });
      setTimeout(() => setDeleteNotification(null), 6000);
    }
  };

  // Submit Surat Titip
  const handleSaveSurat = (e: React.FormEvent) => {
    e.preventDefault();
    setSuratError(null);
    const validItems = suratItems.filter((it) => it.sku && it.qty > 0);
    if (validItems.length === 0) {
      setSuratError('Pilih minimal 1 SKU dengan kuantitas lebih dari 0.');
      return;
    }

    const res = createSuratTitip(selectedResellerId, validItems, suratCatatan);
    if (!res.success) {
      setSuratError(res.error || 'Gagal membuat surat titip');
      return;
    }
    setIsSuratModalOpen(false);
  };

  // Submit Laporan Laku
  const handleSaveLaku = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = lakuItems.filter((it) => it.sku && it.qty > 0);
    if (validItems.length === 0) return;

    const total = validItems.reduce((acc, it) => acc + it.qty * it.hargaTitip, 0);
    const paid = lakuStatusBayar === 'lunas' ? total : lakuTerbayar;

    createLaporanTitipLaku(lakuResellerId, lakuPeriode, validItems, lakuStatusBayar, paid);
    setIsLakuModalOpen(false);
  };

  // Submit Retur
  const handleSaveRetur = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = returItems.filter((it) => it.sku && it.qty > 0);
    if (validItems.length === 0) return;

    recordReturTitip(returResellerId, validItems, returAlasan);
    setIsReturModalOpen(false);
  };

  // Submit Setoran
  const handleSaveSetoran = (e: React.FormEvent) => {
    e.preventDefault();
    if (setoranAmount <= 0) return;
    recordSetoranReseller(setoranResellerId, setoranAmount, setoranMethod, setoranNote, setoranAccountId || undefined);
    setIsSetoranModalOpen(false);
    setSetoranAmount(0);
    setSetoranAccountId('');
  };

  // Retur history derived from stock movements
  const returHistory = useMemo(() => {
    return stockMovements.filter(
      (m) => m.tipe === 'retur_titip' || (m.tipe === 'reject' && m.referensi?.startsWith('Retur Cacat:'))
    );
  }, [stockMovements]);

  // Setoran history derived from cash mutations
  const setoranHistory = useMemo(() => {
    return cashMutations.filter((c) => c.kategori === 'Setoran Reseller');
  }, [cashMutations]);

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification Banner */}
      {deleteNotification && (
        <div
          className={`px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xl backdrop-blur-md animate-in fade-in ${
            deleteNotification.type === 'success'
              ? 'bg-emerald-950/90 border border-emerald-500/60 text-emerald-200'
              : 'bg-rose-950/90 border border-rose-500/60 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {deleteNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{deleteNotification.message}</span>
          </div>
          <button
            onClick={() => setDeleteNotification(null)}
            className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE HEADER & ACTION TOOLBAR (DARK & POLISHED) */}
      {/* ========================================================================= */}
      <div className="bg-[#121620] p-5 sm:p-6 rounded-3xl border border-slate-800/80 shadow-md relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-xs">
              <Store className="w-6 h-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Mitra Reseller & Titip Jual (Konsinyasi)
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Consignment Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Pantau distribusi fisik kaos di toko mitra rekanan, batas plafon kredit konsinyasi, surat jalan pengiriman, rekonsiliasi laporan penjualan laku, dan pelunasan piutang.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openNewResellerModal}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700/80 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Mitra Baru</span>
            </button>

            <button
              onClick={() => {
                setSelectedResellerId(resellers[0]?.id || '');
                setIsSuratModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>+ Kirim Titipan</span>
            </button>

            <button
              onClick={() => {
                setLakuResellerId(resellers[0]?.id || '');
                setIsLakuModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>+ Lapor Laku</span>
            </button>

            <button
              onClick={() => {
                setReturResellerId(resellers[0]?.id || '');
                setIsReturModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/70 text-rose-300 text-xs font-bold border border-slate-800 hover:border-rose-500/50 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Retur</span>
            </button>

            <button
              onClick={() => {
                const firstWithPiutang = resellers.find((r) => getResellerPiutang(r.id) > 0);
                setSetoranResellerId(firstWithPiutang?.id || resellers[0]?.id || '');
                setSetoranAmount(firstWithPiutang ? getResellerPiutang(firstWithPiutang.id) : 0);
                setIsSetoranModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-blue-950/70 text-blue-300 text-xs font-bold border border-slate-800 hover:border-blue-500/50 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 text-blue-400" />
              <span>Catat Setoran</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP METRICS & INTELLIGENCE SUMMARY (5 EXECUTIVE DARK CARDS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Mitra */}
        <div className="bg-[#121620] p-4.5 rounded-2xl border border-slate-800/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold text-slate-300">Mitra Konsinyasi</span>
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Store className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {metrics.totalMitra}{' '}
            <span className="text-xs text-slate-400 font-sans font-normal">Toko Mitra</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
            <span className="font-medium text-purple-400">{metrics.platinumCount} Plat</span>
            <span>·</span>
            <span className="font-medium text-amber-400">{metrics.goldCount} Gold</span>
            <span>·</span>
            <span className="font-medium text-slate-400">{metrics.silverCount} Silv</span>
          </div>
        </div>

        {/* Card 2: Total Stok Titip Fisik */}
        <div className="bg-[#121620] p-4.5 rounded-2xl border border-slate-800/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold text-slate-300">Stok di Rak Mitra</span>
            <span className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-400">
            {metrics.totalTitipanPcs}{' '}
            <span className="text-xs text-slate-400 font-sans font-normal">pcs</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 truncate font-mono">
            Aset: Rp {metrics.totalTitipanValue.toLocaleString('id-ID')}
          </div>
        </div>

        {/* Card 3: Total Piutang Konsinyasi */}
        <div className="bg-[#121620] p-4.5 rounded-2xl border border-slate-800/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold text-slate-300">Piutang Belum Setor</span>
            <span className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 truncate">
            Rp {metrics.totalPiutang.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {metrics.resellersWithPiutang > 0 ? (
              <span className="text-amber-400 font-medium">⚠️ {metrics.resellersWithPiutang} mitra ada tagihan</span>
            ) : (
              <span className="text-emerald-400 font-medium">✓ Semua mitra tertib lunas</span>
            )}
          </div>
        </div>

        {/* Card 4: Omset Laku Konsinyasi */}
        <div className="bg-[#121620] p-4.5 rounded-2xl border border-slate-800/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold text-slate-300">Omset Laku Titip</span>
            <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 truncate">
            Rp {metrics.totalLakuRevenue.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Total {metrics.totalLakuQty} pcs terjual
          </div>
        </div>

        {/* Card 5: Surat Jalan Pengiriman */}
        <div className="bg-[#121620] p-4.5 rounded-2xl border border-slate-800/80 shadow-xs relative overflow-hidden col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold text-slate-300">Surat Jalan Titip</span>
            <span className="p-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {metrics.totalSuratJalan}{' '}
            <span className="text-xs text-slate-400 font-sans font-normal">Dokumen</span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {returHistory.length} transaksi retur tercatat
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODERN SUBNAV TABS */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121620] p-2 rounded-2xl border border-slate-800/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto p-0.5 scrollbar-none">
          {[
            { id: 'daftar_reseller', label: 'Mitra Reseller & Piutang', icon: Store, count: resellers.length },
            { id: 'stok_titipan', label: 'Stok Fisik di Mitra', icon: Package, count: `${metrics.totalTitipanPcs} pcs` },
            { id: 'surat_titip', label: 'Surat Jalan Titip (Kirim)', icon: Send, count: suratTitip.length },
            { id: 'laporan_laku', label: 'Laporan Laku & Tagihan', icon: FileCheck, count: laporanTitipLaku.length },
            { id: 'retur_setoran', label: 'Riwayat Retur & Setoran', icon: RotateCcw, count: returHistory.length + setoranHistory.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-amber-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Global Search Bar */}
        <div className="relative min-w-[240px] px-1 sm:px-0">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari toko mitra, PIC, atau kota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MITRA RESELLER & ACTION CARDS */}
      {/* ========================================================================= */}
      {activeTab === 'daftar_reseller' && (
        <div className="space-y-4">
          {/* Level Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121620] p-3.5 rounded-2xl border border-slate-800/80 shadow-xs text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-400">Filter Level:</span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['ALL', 'Platinum', 'Gold', 'Silver'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                      levelFilter === lvl
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lvl === 'ALL' ? 'Semua Level' : lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-slate-400 text-xs">
              Menampilkan <strong className="text-white">{filteredResellers.length}</strong> dari {resellers.length} mitra
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {filteredResellers.map((res) => {
              const stockMap = getResellerStock(res.nama);
              const totalTitipanPcs = Object.values(stockMap).reduce((a, b) => a + Math.max(0, b), 0);
              const totalTitipanValue = getResellerStockValue(res.nama);
              const totalPiutang = getResellerPiutang(res.id);
              const plafonLimit = res.batasPlafonTitipan || 10000000;
              const plafonUsagePercent = Math.min(100, Math.round((totalTitipanValue / plafonLimit) * 100));

              // Level styling
              const isPlatinum = res.level === 'Platinum';
              const isGold = res.level === 'Gold';

              return (
                <div
                  key={res.id}
                  className="bg-[#121620] rounded-3xl border border-slate-800/80 p-5 shadow-xs hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3.5">
                    {/* Header: Name, Level, and Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                              isPlatinum
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                                : isGold
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                : 'bg-slate-900 text-slate-300 border-slate-800'
                            }`}
                          >
                            ⭐ {res.level || 'Silver'}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            Diskon: {res.diskonPersen ?? 20}%
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white tracking-tight truncate">
                          {res.nama}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{res.kota}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditResellerModal(res)}
                          title="Edit Data Mitra"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteModalReseller(res);
                            setDeleteReturnStock(true);
                          }}
                          title="Hapus Mitra Konsinyasi"
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Contact & Address Strip */}
                    <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">PIC / Pengelola:</span>
                        <span className="font-semibold text-white">{res.kontakPerson || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">WhatsApp:</span>
                        <a
                          href={`https://wa.me/${res.noHp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline"
                        >
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{res.noHp}</span>
                        </a>
                      </div>
                      {res.alamat && (
                        <div className="pt-1 border-t border-slate-800/80 text-xs text-slate-400 truncate">
                          {res.alamat}
                        </div>
                      )}
                    </div>

                    {/* Plafon Kredit Konsinyasi Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-xs font-semibold">Plafon Konsinyasi:</span>
                        <span className="font-mono text-xs text-slate-300">
                          <strong>Rp {totalTitipanValue.toLocaleString('id-ID')}</strong> / Rp {plafonLimit.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            plafonUsagePercent >= 90
                              ? 'bg-rose-500'
                              : plafonUsagePercent >= 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${plafonUsagePercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Terpakai {plafonUsagePercent}%</span>
                        <span>Jadwal: {res.jadwalSetoran || 'Tiap Senin'}</span>
                      </div>
                    </div>

                    {/* Metrics 2-column box */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                        <span className="text-slate-400 text-xs block">Stok Aktif</span>
                        <div className="text-base font-bold text-blue-400 font-mono mt-0.5">
                          {totalTitipanPcs} pcs
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                          Rp {totalTitipanValue.toLocaleString('id-ID')}
                        </div>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                        <span className="text-slate-400 text-xs block">Piutang Tagihan</span>
                        <div
                          className={`text-base font-bold font-mono mt-0.5 truncate ${
                            totalPiutang > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          Rp {totalPiutang.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {totalPiutang > 0 ? 'Belum disetor' : 'Lunas tertib'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div className="space-y-2 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        setSetoranResellerId(res.id);
                        setSetoranAmount(totalPiutang);
                        setIsSetoranModalOpen(true);
                      }}
                      disabled={totalPiutang <= 0}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{totalPiutang > 0 ? `Catat Setoran (Rp ${totalPiutang.toLocaleString('id-ID')})` : 'Setoran Lunas'}</span>
                    </button>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedResellerId(res.id);
                          setIsSuratModalOpen(true);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3 text-amber-400" />
                        <span>Kirim</span>
                      </button>

                      <button
                        onClick={() => {
                          setLakuResellerId(res.id);
                          setIsLakuModalOpen(true);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <FileCheck className="w-3 h-3 text-emerald-400" />
                        <span>Laku</span>
                      </button>

                      <button
                        onClick={() => {
                          setReturResellerId(res.id);
                          setIsReturModalOpen(true);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-800 text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 text-rose-400" />
                        <span>Retur</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STOK FISIK DI RAK RESELLER */}
      {/* ========================================================================= */}
      {activeTab === 'stok_titipan' && (
        <div className="space-y-4">
          <div className="bg-[#121620] p-4.5 rounded-2xl border border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Rincian Stok Barang Konsinyasi di Rak Toko Mitra
              </h3>
              <p className="text-xs text-slate-400">
                Stok fisik tercatat di lokasi masing-masing reseller dan tetap berstatus aset persediaan Kalima Apparel hingga dilaporkan laku atau diretur.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSuratModalOpen(true)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kirim Stok Tambahan</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {resellers.map((res) => {
              const stockMap = getResellerStock(res.nama);
              const itemsWithStock = Object.entries(stockMap).filter(([_, qty]) => qty > 0);
              const totalPcs = itemsWithStock.reduce((a, [_, q]) => a + q, 0);
              const totalValue = getResellerStockValue(res.nama);

              return (
                <div
                  key={res.id}
                  className="bg-[#121620] p-5 rounded-3xl border border-slate-800/80 shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{res.nama}</h4>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-semibold">
                            {res.kota}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Jadwal Setoran: {res.jadwalSetoran || 'Tiap Senin'}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-blue-300 bg-blue-950/80 px-3 py-1 rounded-xl border border-blue-800 inline-block">
                          {totalPcs} pcs
                        </span>
                        <div className="text-xs font-mono text-slate-400 mt-0.5">
                          Rp {totalValue.toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {itemsWithStock.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500">
                          <Package className="w-8 h-8 text-slate-600 mx-auto mb-1.5 opacity-50" />
                          <span>Tidak ada stok titipan aktif di mitra ini.</span>
                        </div>
                      ) : (
                        itemsWithStock.map(([skuCode, qty]) => {
                          const skuObj = skus.find((s) => s.sku === skuCode);
                          return (
                            <div
                              key={skuCode}
                              className="flex items-center justify-between p-2.5 bg-slate-950 rounded-2xl border border-slate-800/80 text-xs"
                            >
                              <div className="min-w-0 mr-2">
                                <div className="font-semibold text-white truncate">
                                  {skuObj?.name || skuCode}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[11px] text-amber-400 font-bold">
                                    {skuCode}
                                  </span>
                                  {skuObj && (
                                    <span className="text-[11px] text-slate-400">
                                      Size: <strong className="text-slate-200">{skuObj.size}</strong> · {skuObj.colorName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-mono font-bold text-white text-sm">
                                  {qty} <span className="text-xs font-normal text-slate-500">pcs</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        setSelectedResellerId(res.id);
                        setIsSuratModalOpen(true);
                      }}
                      className="flex-1 py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-amber-400" />
                      <span>Kirim Tambahan</span>
                    </button>
                    <button
                      onClick={() => {
                        setReturResellerId(res.id);
                        setIsReturModalOpen(true);
                      }}
                      disabled={totalPcs <= 0}
                      className="py-2 px-3 bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-800 rounded-xl text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      <span>Tarik Retur</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SURAT JALAN TITIP (KIRIM) */}
      {/* ========================================================================= */}
      {activeTab === 'surat_titip' && (
        <div className="bg-[#121620] rounded-3xl border border-slate-800/80 overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Riwayat Surat Jalan Titip Jual (Konsinyasi)</h3>
              <p className="text-xs text-slate-400">
                Dokumen resmi pengiriman stok dari Gudang Utama ke lokasi toko mitra.
              </p>
            </div>
            <button
              onClick={() => setIsSuratModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>+ Buat Surat Jalan Titip</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0e1219] border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">No. Surat & Tgl</th>
                  <th className="py-3 px-3">Mitra Reseller</th>
                  <th className="py-3 px-3">Item Kaos Dititipkan</th>
                  <th className="py-3 px-3 text-center">Total Qty</th>
                  <th className="py-3 px-3 text-right">Nilai Barang</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {suratTitip.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      Belum ada surat jalan titip yang diterbitkan.
                    </td>
                  </tr>
                ) : (
                  suratTitip.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-amber-400 text-xs">{st.noSurat}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{st.tanggal}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-white">{st.resellerNama}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-300">
                          {st.items.map((it) => `${it.qty}x ${it.sku}`).join(', ')}
                        </div>
                        {st.catatan && (
                          <div className="text-xs text-slate-500 italic mt-0.5">
                            {st.catatan}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-white">
                        {st.totalQty} pcs
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-white">
                        Rp {st.totalNilai.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase">
                          {st.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedSuratForPrint(st);
                            setIsPrintSuratOpen(true);
                          }}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Cetak Surat Jalan</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LAPORAN LAKU & TAGIHAN */}
      {/* ========================================================================= */}
      {activeTab === 'laporan_laku' && (
        <div className="bg-[#121620] rounded-3xl border border-slate-800/80 overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Laporan Penjualan Titip Laku & Rekonsiliasi Tagihan</h3>
              <p className="text-xs text-slate-400">
                Pencatatan laporan barang laku secara otomatis memotong stok fisik di toko reseller dan membuat order penjualan resmi.
              </p>
            </div>
            <button
              onClick={() => setIsLakuModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>+ Catat Laporan Laku Baru</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0e1219] border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">No. Laporan & Tgl</th>
                  <th className="py-3 px-3">Periode</th>
                  <th className="py-3 px-3">Mitra Reseller</th>
                  <th className="py-3 px-3">Rincian Kaos Laku</th>
                  <th className="py-3 px-3 text-right">Total Tagihan</th>
                  <th className="py-3 px-3 text-right">Terbayar</th>
                  <th className="py-3 px-3 text-right">Sisa Piutang</th>
                  <th className="py-3 px-4 text-center">Status Bayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {laporanTitipLaku.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-500">
                      Belum ada laporan laku yang dicatat.
                    </td>
                  </tr>
                ) : (
                  laporanTitipLaku.map((lt) => {
                    const sisa = Math.max(0, lt.totalTagihan - lt.terbayar);
                    return (
                      <tr key={lt.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-white text-xs">{lt.noLaporan}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{lt.tanggal}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-medium text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800 text-xs">
                            {lt.periode}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-white">
                          {lt.resellerNama}
                        </td>
                        <td className="py-3.5 px-3 text-slate-300">
                          {lt.items.map((it) => `${it.qty}x ${it.namaProduk}`).join(', ')}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-white">
                          Rp {lt.totalTagihan.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-400">
                          Rp {lt.terbayar.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold">
                          <span className={sisa > 0 ? 'text-rose-400' : 'text-slate-500'}>
                            Rp {sisa.toLocaleString('id-ID')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                              lt.statusBayar === 'lunas'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-rose-950 text-rose-300 border-rose-800'
                            }`}
                          >
                            {lt.statusBayar}
                          </span>
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
      {/* TAB 5: RIWAYAT RETUR & SETORAN */}
      {/* ========================================================================= */}
      {activeTab === 'retur_setoran' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Box 1: Riwayat Retur */}
          <div className="bg-[#121620] p-5 rounded-3xl border border-slate-800/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <RotateCcw className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-bold text-white text-sm">Riwayat Retur Konsinyasi</h4>
                  <p className="text-xs text-slate-400">Barang ditarik kembali dari toko mitra</p>
                </div>
              </div>
              <button
                onClick={() => setIsReturModalOpen(true)}
                className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                + Form Retur
              </button>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {returHistory.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Belum ada transaksi retur konsinyasi.
                </div>
              ) : (
                returHistory.map((rh) => (
                  <div
                    key={rh.id}
                    className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{rh.referensi}</span>
                      <span className="text-xs text-slate-500 font-mono">{rh.tanggal}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-mono font-bold text-amber-400">{rh.sku}</span>
                      <span className="font-mono font-bold text-rose-400">
                        {Math.abs(rh.qty)} pcs
                      </span>
                    </div>
                    {rh.catatan && (
                      <p className="text-xs text-slate-400 italic pt-1 border-t border-slate-800">
                        {rh.catatan}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Box 2: Riwayat Setoran */}
          <div className="bg-[#121620] p-5 rounded-3xl border border-slate-800/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <DollarSign className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-bold text-white text-sm">Riwayat Penerimaan Setoran Uang</h4>
                  <p className="text-xs text-slate-400">Mutasi kas masuk pelunasan piutang mitra</p>
                </div>
              </div>
              <button
                onClick={() => setIsSetoranModalOpen(true)}
                className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                + Form Setoran
              </button>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {setoranHistory.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Belum ada catatan setoran uang dari reseller.
                </div>
              ) : (
                setoranHistory.map((sh) => (
                  <div
                    key={sh.id}
                    className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{sh.referensi || 'Setoran Reseller'}</span>
                      <span className="text-xs text-slate-500 font-mono">{sh.tanggal}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">
                        Masuk ke: <strong className="text-slate-200">{sh.accountNama}</strong>
                      </span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        +Rp {sh.jumlah.toLocaleString('id-ID')}
                      </span>
                    </div>
                    {sh.deskripsi && (
                      <p className="text-xs text-slate-400 pt-1 border-t border-slate-800">
                        {sh.deskripsi}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: BUAT SURAT JALAN TITIP (KIRIM KONSINYASI) */}
      {/* ========================================================================= */}
      {isSuratModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl bg-[#121620] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Send className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Buat Surat Jalan Titip (Kirim Konsinyasi)</h3>
                  <p className="text-xs text-slate-400">Kirim stok dari Gudang Utama ke rak toko mitra.</p>
                </div>
              </div>
              <button
                onClick={() => setIsSuratModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {suratError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{suratError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSurat} className="space-y-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Pilih Toko Mitra Reseller *</label>
                <select
                  value={selectedResellerId}
                  onChange={(e) => setSelectedResellerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:border-amber-500/60 focus:outline-none"
                >
                  {resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama} - {r.kota} ({r.level || 'Silver'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Daftar Artikel Kaos Dititipkan</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSuratItems((prev) => [
                        ...prev,
                        { sku: skus[0]?.sku || '', qty: 10, hargaTitip: 105000 },
                      ])
                    }
                    className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {suratItems.map((row, idx) => {
                    const stockAvail = calculateStock(row.sku, 'Gudang Utama');
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
                        <div className="flex-1">
                          <select
                            value={row.sku}
                            onChange={(e) => {
                              const val = e.target.value;
                              const skuObj = skus.find((s) => s.sku === val);
                              const defaultPrice = skuObj ? Math.round(skuObj.price * 0.8) : 105000;
                              setSuratItems((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, sku: val, hargaTitip: defaultPrice } : r))
                              );
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-xs"
                          >
                            {skus.map((s) => (
                              <option key={s.sku} value={s.sku}>
                                {s.sku} - {s.name} ({calculateStock(s.sku, 'Gudang Utama')} pcs)
                              </option>
                            ))}
                          </select>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Stok Gudang: <strong className={stockAvail > 0 ? 'text-emerald-400' : 'text-rose-400'}>{stockAvail} pcs</strong>
                          </div>
                        </div>

                        <div className="w-20">
                          <input
                            type="number"
                            min="1"
                            value={row.qty || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setSuratItems((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, qty: val } : r))
                              );
                            }}
                            placeholder="Qty"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono text-center font-bold"
                          />
                          <span className="text-[11px] text-slate-500 block text-center mt-1">Qty (Pcs)</span>
                        </div>

                        <div className="w-28">
                          <input
                            type="number"
                            value={row.hargaTitip || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setSuratItems((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, hargaTitip: val } : r))
                              );
                            }}
                            placeholder="Harga Titip"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono text-right font-bold"
                          />
                          <span className="text-[11px] text-slate-500 block text-right mt-1">Harga Titip (Rp)</span>
                        </div>

                        {suratItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSuratItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal Preview */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-sans">
                    Total: <strong className="text-white">{suratItems.reduce((sum, it) => sum + (it.qty || 0), 0)} pcs</strong>
                  </span>
                  <span className="text-emerald-400 font-bold text-sm">
                    Rp {suratItems.reduce((sum, it) => sum + (it.qty || 0) * (it.hargaTitip || 0), 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Catatan / Ekspedisi Surat Jalan</label>
                <input
                  type="text"
                  value={suratCatatan}
                  onChange={(e) => setSuratCatatan(e.target.value)}
                  placeholder="Contoh: Kirim via Lalamove / Paxel Big"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSuratModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim & Potong Stok Gudang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LAPOR PENJUALAN TITIP LAKU */}
      {/* ========================================================================= */}
      {isLakuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl bg-[#121620] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileCheck className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Catat Penjualan Titip Laku Konsinyasi</h3>
                  <p className="text-xs text-slate-400">Barang terjual otomatis memotong stok di toko reseller.</p>
                </div>
              </div>
              <button
                onClick={() => setIsLakuModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLaku} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Pilih Reseller *</label>
                  <select
                    value={lakuResellerId}
                    onChange={(e) => setLakuResellerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    {resellers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Periode Laporan</label>
                  <input
                    type="text"
                    value={lakuPeriode}
                    onChange={(e) => setLakuPeriode(e.target.value)}
                    placeholder="Contoh: September 2026"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Item Kaos yang Terjual</span>
                  <button
                    type="button"
                    onClick={() =>
                      setLakuItems((prev) => [
                        ...prev,
                        { sku: skus[0]?.sku || '', qty: 5, hargaTitip: 105000 },
                      ])
                    }
                    className="text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {lakuItems.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
                      <select
                        value={row.sku}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLakuItems((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, sku: val } : r))
                          );
                        }}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-2 text-white text-xs"
                      >
                        {skus.map((s) => (
                          <option key={s.sku} value={s.sku}>
                            {s.sku} - {s.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={row.qty || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setLakuItems((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, qty: val } : r))
                          );
                        }}
                        placeholder="Qty"
                        className="w-20 bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono text-center font-bold"
                      />

                      <input
                        type="number"
                        value={row.hargaTitip || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setLakuItems((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, hargaTitip: val } : r))
                          );
                        }}
                        placeholder="Harga Net"
                        className="w-28 bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono text-right font-bold"
                      />

                      {lakuItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLakuItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-sans">Total Tagihan:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    Rp {lakuItems.reduce((acc, it) => acc + (it.qty || 0) * (it.hargaTitip || 0), 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status Pembayaran</label>
                  <select
                    value={lakuStatusBayar}
                    onChange={(e) => setLakuStatusBayar(e.target.value as PaymentStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-semibold"
                  >
                    <option value="lunas">Lunas Seketika</option>
                    <option value="piutang">Piutang (Belum Setor)</option>
                    <option value="sebagian">Sebagian (DP Setoran)</option>
                  </select>
                </div>

                {lakuStatusBayar === 'sebagian' && (
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Jumlah Terbayar (Rp)</label>
                    <input
                      type="number"
                      value={lakuTerbayar || ''}
                      onChange={(e) => setLakuTerbayar(Number(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLakuModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Laporan & Buat Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RETUR KONSINYASI */}
      {/* ========================================================================= */}
      {isReturModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121620] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <RotateCcw className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Retur Barang Titipan dari Mitra</h3>
                  <p className="text-xs text-slate-400">Tarik barang kembali ke Gudang Utama atau Reject.</p>
                </div>
              </div>
              <button
                onClick={() => setIsReturModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRetur} className="space-y-3.5">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Pilih Reseller *</label>
                <select
                  value={returResellerId}
                  onChange={(e) => setReturResellerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium"
                >
                  {resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama} - {r.kota}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">SKU yang Diretur</label>
                <select
                  value={returItems[0]?.sku}
                  onChange={(e) =>
                    setReturItems([{ ...returItems[0], sku: e.target.value }])
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                >
                  {skus.map((s) => (
                    <option key={s.sku} value={s.sku}>
                      {s.sku} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Jumlah Retur (Pcs)</label>
                  <input
                    type="number"
                    min="1"
                    value={returItems[0]?.qty || 1}
                    onChange={(e) =>
                      setReturItems([{ ...returItems[0], qty: Number(e.target.value) || 1 }])
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Kondisi Barang</label>
                  <select
                    value={returItems[0]?.kondisi}
                    onChange={(e) =>
                      setReturItems([
                        {
                          ...returItems[0],
                          kondisi: e.target.value as 'baik_ke_gudang' | 'rusak_ke_reject',
                        },
                      ])
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="baik_ke_gudang">Kondisi Baik (Masuk Gudang)</option>
                    <option value="rusak_ke_reject">Kondisi Rusak (Masuk Reject)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Alasan Retur</label>
                <input
                  type="text"
                  value={returAlasan}
                  onChange={(e) => setReturAlasan(e.target.value)}
                  placeholder="Contoh: Rotasi varian warna lambat laku"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReturModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Proses Retur</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CATAT SETORAN RESELLER */}
      {/* ========================================================================= */}
      {isSetoranModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121620] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <DollarSign className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Penerimaan Setoran Uang Reseller</h3>
                  <p className="text-xs text-slate-400">Saldo akun kas/bank akan bertambah seketika.</p>
                </div>
              </div>
              <button
                onClick={() => setIsSetoranModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSetoran} className="space-y-3.5">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Pilih Reseller Pembayar *</label>
                <select
                  value={setoranResellerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSetoranResellerId(id);
                    setSetoranAmount(getResellerPiutang(id));
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium"
                >
                  {resellers.map((r) => {
                    const piutang = getResellerPiutang(r.id);
                    return (
                      <option key={r.id} value={r.id}>
                        {r.nama} (Piutang: Rp {piutang.toLocaleString('id-ID')})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nominal Setoran (Rp) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={setoranAmount || ''}
                  onChange={(e) => setSetoranAmount(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Metode Penerimaan</label>
                <select
                  value={setoranMethod}
                  onChange={(e) => setSetoranMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                >
                  <option value="Transfer BCA">Transfer BCA</option>
                  <option value="Transfer Mandiri">Transfer Mandiri</option>
                  <option value="Cash / Tunai">Cash / Tunai</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Masuk ke Akun Kas/Bank</label>
                <select
                  value={setoranAccountId}
                  onChange={(e) => setSetoranAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium"
                >
                  <option value="">-- Otomatis sesuai metode ({setoranMethod}) --</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama} ({a.tipe.toUpperCase()} - Saldo: Rp {a.saldo.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
                <div className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Saldo akun tujuan akan otomatis terisi dan piutang terpotong</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Catatan Pembayaran</label>
                <input
                  type="text"
                  value={setoranNote}
                  onChange={(e) => setSetoranNote(e.target.value)}
                  placeholder="Contoh: Setoran hasil penjualan periode September"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSetoranModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Setoran & Potong Piutang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: TAMBAH / EDIT MITRA RESELLER */}
      {/* ========================================================================= */}
      {isResellerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-[#121620] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Store className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingReseller ? 'Edit Profil Mitra Konsinyasi' : 'Tambah Mitra Reseller Baru'}
                  </h3>
                  <p className="text-xs text-slate-400">Atur level kemitraan, plafon titipan, dan kontak toko.</p>
                </div>
              </div>
              <button
                onClick={() => setIsResellerModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveResellerForm} className="space-y-3.5">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nama Toko / Distro Mitra *</label>
                <input
                  type="text"
                  required
                  value={resNama}
                  onChange={(e) => setResNama(e.target.value)}
                  placeholder="Contoh: Distro Syndicate Bandung"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nama PIC / Pengelola</label>
                  <input
                    type="text"
                    value={resPic}
                    onChange={(e) => setResPic(e.target.value)}
                    placeholder="Contoh: Kang Deni"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">No. WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={resHp}
                    onChange={(e) => setResHp(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Level Mitra</label>
                  <select
                    value={resLevel}
                    onChange={(e) => {
                      const lvl = e.target.value as 'Platinum' | 'Gold' | 'Silver';
                      setResLevel(lvl);
                      if (lvl === 'Platinum') {
                        setResDiskon(25);
                        setResPlafon(15000000);
                      } else if (lvl === 'Gold') {
                        setResDiskon(20);
                        setResPlafon(10000000);
                      } else {
                        setResDiskon(15);
                        setResPlafon(5000000);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-semibold"
                  >
                    <option value="Platinum">Platinum (25%)</option>
                    <option value="Gold">Gold (20%)</option>
                    <option value="Silver">Silver (15%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Komisi / Diskon (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={resDiskon}
                    onChange={(e) => setResDiskon(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Kota Domisili</label>
                  <input
                    type="text"
                    value={resKota}
                    onChange={(e) => setResKota(e.target.value)}
                    placeholder="Bandung / Jakarta"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Batas Plafon Titipan (Rp)</label>
                  <input
                    type="number"
                    min="1000000"
                    step="500000"
                    value={resPlafon}
                    onChange={(e) => setResPlafon(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Jadwal Setoran Rutin</label>
                  <input
                    type="text"
                    value={resJadwal}
                    onChange={(e) => setResJadwal(e.target.value)}
                    placeholder="Contoh: Setiap Hari Senin"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Alamat Lengkap Toko Fisik</label>
                <textarea
                  rows={2}
                  value={resAlamat}
                  onChange={(e) => setResAlamat(e.target.value)}
                  placeholder="Alamat toko, jalan, nomor ruko..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
                {editingReseller && (
                  <button
                    type="button"
                    onClick={() => {
                      const resToDelete = editingReseller;
                      setIsResellerModalOpen(false);
                      setDeleteModalReseller(resToDelete);
                      setDeleteReturnStock(true);
                      setDeleteResellerError(null);
                    }}
                    className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Hapus Mitra</span>
                  </button>
                )}

                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsResellerModalOpen(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingReseller ? 'Perbarui Data Mitra' : 'Simpan Mitra Baru'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: KONFIRMASI HAPUS MITRA RESELLER */}
      {/* ========================================================================= */}
      {deleteModalReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-[#121620] border border-rose-500/40 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Hapus Mitra Konsinyasi
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Konfirmasi penonaktifan & penghapusan akun mitra
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteModalReseller(null);
                  setDeleteResellerError(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message inside modal if any */}
            {deleteResellerError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-2xl text-xs text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{deleteResellerError}</div>
              </div>
            )}

            {/* Partner Info Summary Card */}
            {(() => {
              const stockMap = getResellerStock(deleteModalReseller.nama);
              const totalStockPcs = Object.values(stockMap).reduce((a, b) => a + Math.max(0, b), 0);
              const totalStockVal = getResellerStockValue(deleteModalReseller.nama);
              const totalPiutang = getResellerPiutang(deleteModalReseller.id);

              return (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{deleteModalReseller.nama}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800">
                        {deleteModalReseller.level || 'Silver'} ({deleteModalReseller.diskonPersen || 20}%)
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center justify-between">
                      <span>PIC: <strong className="text-slate-200">{deleteModalReseller.kontakPerson || '-'}</strong></span>
                      <span className="font-mono text-emerald-400">{deleteModalReseller.noHp}</span>
                    </div>
                    {deleteModalReseller.alamat && (
                      <p className="text-xs text-slate-400 border-t border-slate-900 pt-1.5">
                        {deleteModalReseller.alamat}, {deleteModalReseller.kota}
                      </p>
                    )}
                  </div>

                  {/* Stock Notice & Auto-Return Option */}
                  {totalStockPcs > 0 ? (
                    <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-2xl space-y-2.5">
                      <div className="flex items-start gap-2 text-xs text-amber-300">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block">Perhatian: Masih Ada Stok Konsinyasi Aktif</strong>
                          <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
                            Tercatat masih ada <strong>{totalStockPcs} pcs</strong> barang (estimasi nilai Rp {totalStockVal.toLocaleString('id-ID')}) di rak toko mitra ini.
                          </p>
                        </div>
                      </div>

                      <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/90 border border-amber-900/50 cursor-pointer hover:border-amber-700/60 transition-colors">
                        <input
                          type="checkbox"
                          checked={deleteReturnStock}
                          onChange={(e) => setDeleteReturnStock(e.target.checked)}
                          className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500/20 bg-slate-900 w-4 h-4 cursor-pointer"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-white block">Tarik otomatis sisa stok ({totalStockPcs} pcs) ke Gudang Utama</span>
                          <span className="text-slate-400 text-xs block mt-0.5 leading-normal">
                            Sistem otomatis mencatat mutasi pengembalian barang (*retur titip*) sehingga stok fisik Gudang Utama bertambah sesuai fisik riil.
                          </span>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Tidak ada sisa stok fisik titipan di rak toko mitra ini.</span>
                    </div>
                  )}

                  {/* Piutang Warning if any */}
                  {totalPiutang > 0 && (
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        Mitra ini memiliki sisa piutang berjalan sebesar <strong className="text-amber-400 font-mono">Rp {totalPiutang.toLocaleString('id-ID')}</strong>. Riwayat piutang & buku kas tetap tersimpan utuh di laporan keuangan.
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Menghapus mitra ini akan mencopot profil konsinyasi toko. Pelanggan terkait di database customer akan dikembalikan ke status pelanggan Retail biasa.
                  </p>
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalReseller(null);
                  setDeleteResellerError(null);
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteReseller}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Mitra Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: PRATINJAU & CETAK SURAT JALAN TITIP (OFFICIAL DOCUMENT) */}
      {/* ========================================================================= */}
      {isPrintSuratOpen && selectedSuratForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Control Bar */}
            <div className="px-6 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#0e1219]">
              <div className="text-xs font-semibold text-slate-300">
                Pratinjau Surat Jalan Titip Jual Resmi (Konsinyasi)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  onClick={() => setIsPrintSuratOpen(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Printable Sheet (White for real paper printing) */}
            <div className="flex-1 overflow-y-auto p-8 bg-white text-slate-900 font-sans text-xs">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-2xl font-black tracking-wider text-slate-900">KALIMA APPAREL</h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Premium Heavyweight & Oversize Blank T-Shirt Specialist
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Gudang Pusat Kalima Apparel, Bandung, Jawa Barat
                    <br />
                    WhatsApp: 0812-8899-7711 | Email: logistics@kalima.id
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-slate-900 text-white font-bold text-xs uppercase px-3 py-1 rounded">
                    SURAT JALAN KONSINYASI
                  </span>
                  <div className="font-mono font-bold text-slate-900 text-base mt-2">
                    {selectedSuratForPrint.noSurat}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Tanggal: <strong>{selectedSuratForPrint.tanggal}</strong>
                  </div>
                </div>
              </div>

              {/* Destination Shop */}
              <div className="grid grid-cols-2 gap-6 my-6 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Toko Mitra Penerima Konsinyasi:
                  </span>
                  <div className="font-bold text-slate-900 text-sm">{selectedSuratForPrint.resellerNama}</div>
                  <div className="text-slate-600 mt-0.5">
                    {resellers.find((r) => r.id === selectedSuratForPrint.resellerId)?.alamat || 'Alamat Toko Mitra'}
                  </div>
                  <div className="text-slate-600 font-mono mt-0.5">
                    Kontak: {resellers.find((r) => r.id === selectedSuratForPrint.resellerId)?.kontakPerson || '-'} (
                    {resellers.find((r) => r.id === selectedSuratForPrint.resellerId)?.noHp})
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Keterangan Pengiriman:
                  </span>
                  <div className="text-slate-700">
                    {selectedSuratForPrint.catatan || 'Pengiriman stok konsinyasi'}
                  </div>
                  <div className="text-slate-500 mt-2 text-xs">
                    Status: <strong className="uppercase text-emerald-700">{selectedSuratForPrint.status}</strong>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-xl border border-slate-300 overflow-hidden mb-6">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <tr>
                      <th className="px-3 py-2.5">No.</th>
                      <th className="px-3 py-2.5">Kode SKU</th>
                      <th className="px-3 py-2.5">Deskripsi Produk Kaos</th>
                      <th className="px-3 py-2.5 text-center">Qty (Pcs)</th>
                      <th className="px-3 py-2.5 text-right">Harga Titip (Rp)</th>
                      <th className="px-3 py-2.5 text-right">Jumlah Nilai (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedSuratForPrint.items.map((it, idx) => (
                      <tr key={it.sku} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">{it.sku}</td>
                        <td className="px-3 py-2">{it.namaProduk}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-slate-900">
                          {it.qty}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700">
                          Rp {it.hargaTitip.toLocaleString('id-ID')}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                          Rp {(it.qty * it.hargaTitip).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right">
                        TOTAL BARANG TITIPAN:
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{selectedSuratForPrint.totalQty} pcs</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right font-mono">
                        Rp {selectedSuratForPrint.totalNilai.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-12 mt-12 text-center text-xs text-slate-700">
                <div>
                  <p className="font-medium text-slate-500 mb-14">Diserahkan Oleh (Gudang Kalima)</p>
                  <p className="font-bold text-slate-900 underline">Petugas Logistik</p>
                  <p className="text-xs text-slate-500">Divisi Pengiriman & Gudang</p>
                </div>
                <div>
                  <p className="font-medium text-slate-500 mb-14">Diterima Oleh (Toko Mitra Reseller)</p>
                  <p className="font-bold text-slate-900 underline">{selectedSuratForPrint.resellerNama}</p>
                  <p className="text-xs text-slate-500">Tanda Tangan & Cap Toko</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
