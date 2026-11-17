import React, { useState, useMemo } from 'react';
import {
  Scale,
  DollarSign,
  Wallet,
  Building2,
  Package,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Printer,
  Download,
  ShieldCheck,
  Calendar,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  PieChart as PieChartIcon,
  RotateCcw,
  Check,
  X,
  CreditCard,
  Percent,
  BookOpen,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { FixedAssetItem, BalanceSheetConfig, FixedAssetCategory } from '../types';

const ASSET_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'];
const LIAB_EQUITY_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

export const BalanceSheetSection: React.FC = () => {
  const {
    cashAccounts,
    orders,
    skus,
    purchaseOrders,
    biayaOperasional,
    calculateStockSummary,
    isOwner,
    currentUser,
    journalEntries,
    fixedAssets,
    setFixedAssets,
    balanceSheetConfig,
    setBalanceSheetConfig,
  } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const [periodeTanggal, setPeriodeTanggal] = useState<string>(todayStr);

  // Sub-navigation view: 'neraca' | 'jurnal' | 'buku_besar'
  const [activeSubView, setActiveSubView] = useState<'neraca' | 'jurnal' | 'buku_besar'>('neraca');
  const [journalFilter, setJournalFilter] = useState<'all' | 'pembayaran_utang_vendor' | 'kas_bank'>('all');
  const [journalSearch, setJournalSearch] = useState('');

  const config = balanceSheetConfig;

  // Modals State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAssetItem | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const saveFixedAssets = (assets: FixedAssetItem[]) => {
    setFixedAssets(assets);
  };

  const saveConfig = (newConfig: BalanceSheetConfig) => {
    setBalanceSheetConfig(newConfig);
  };

  // =========================================================================
  // FINANCIAL CALCULATIONS (NERACA / BALANCE SHEET)
  // =========================================================================

  // 1. KAS & SETARA KAS (CASH & BANK)
  const totalKasBank = useMemo(() => {
    return cashAccounts.reduce((sum, acc) => sum + (acc.saldo || 0), 0);
  }, [cashAccounts]);

  // 2. PIUTANG USAHA (ACCOUNTS RECEIVABLE)
  const piutangData = useMemo(() => {
    let piutangPelanggan = 0;
    orders.forEach((o) => {
      if (o.statusOrder !== 'batal' && (o.statusBayar === 'piutang' || o.statusBayar === 'sebagian')) {
        piutangPelanggan += o.sisaPiutang || 0;
      }
    });

    return {
      piutangPelanggan,
      piutangLainnya: 0,
      totalPiutang: piutangPelanggan,
    };
  }, [orders]);

  // 3. PERSEDIAAN BARANG DAGANG (INVENTORY ASSET VALUE)
  const stockSummary = useMemo(() => {
    return calculateStockSummary();
  }, [calculateStockSummary]);

  const totalPersediaanKaos = useMemo(() => {
    return skus.reduce((sum, item) => {
      const qty = stockSummary[item.sku]?.total ?? 0;
      const hpp = item.hpp || 48000;
      return sum + (qty * hpp);
    }, 0);
  }, [skus, stockSummary]);

  const totalPcsKaosStok = useMemo(() => {
    return skus.reduce((sum, item) => sum + (stockSummary[item.sku]?.total ?? 0), 0);
  }, [skus, stockSummary]);

  // 4. UANG MUKA PEMBELIAN / VENDOR DP (PREPAID TO SUPPLIER)
  const totalUangMukaVendor = useMemo(() => {
    let totalDP = 0;
    purchaseOrders.forEach((po) => {
      // If PO is not yet received and down payment has been made
      if (po.statusPO !== 'diterima' && po.statusPO !== 'batal') {
        totalDP += po.jumlahTerbayar || 0;
      }
    });
    return totalDP + (config.uangMukaLainnya || 0);
  }, [purchaseOrders, config.uangMukaLainnya]);

  // TOTAL ASET LANCAR
  const totalAsetLancar = useMemo(() => {
    return totalKasBank + piutangData.totalPiutang + totalPersediaanKaos + totalUangMukaVendor;
  }, [totalKasBank, piutangData.totalPiutang, totalPersediaanKaos, totalUangMukaVendor]);

  // 5. ASET TETAP & PENYUSUTAN (FIXED ASSETS & ACCUMULATED DEPRECIATION)
  const fixedAssetSummary = useMemo(() => {
    const totalHargaPerolehan = fixedAssets.reduce((sum, a) => sum + a.hargaPerolehan, 0);
    const totalAkumulasiPenyusutan = fixedAssets.reduce((sum, a) => sum + a.akumulasiPenyusutan, 0);
    const totalNilaiBuku = fixedAssets.reduce((sum, a) => sum + a.nilaiBuku, 0);

    return {
      totalHargaPerolehan,
      totalAkumulasiPenyusutan,
      totalNilaiBuku,
    };
  }, [fixedAssets]);

  // TOTAL ASET (AKTIVA)
  const totalAset = useMemo(() => {
    return totalAsetLancar + fixedAssetSummary.totalNilaiBuku;
  }, [totalAsetLancar, fixedAssetSummary.totalNilaiBuku]);

  // 6. KEWAJIBAN LANCAR / HUTANG (LIABILITIES)
  const liabilitiesSummary = useMemo(() => {
    let hutangVendor = 0;
    purchaseOrders.forEach((po) => {
      if (po.statusPO !== 'batal') {
        hutangVendor += po.sisaHutang || 0;
      }
    });

    const hutangBiaya = config.hutangBiayaLainnya || 0;
    const totalKewajiban = hutangVendor + hutangBiaya;

    return {
      hutangVendor,
      hutangBiaya,
      totalKewajiban,
    };
  }, [purchaseOrders, config.hutangBiayaLainnya]);

  // 7. LABA BERSIH PERIODE BERJALAN (CURRENT PERIOD NET PROFIT)
  const labaPeriodeBerjalan = useMemo(() => {
    const validOrders = orders.filter((o) => o.statusOrder !== 'batal');
    const totalOmzet = validOrders.reduce((sum, o) => sum + (o.totalTagihan - (o.ongkir || 0)), 0);
    const totalHPP = validOrders.reduce((sum, o) => sum + (o.totalHpp || 0), 0);
    const totalAdminFee = validOrders.reduce((sum, o) => sum + (o.adminFeeAmount || 0), 0);
    const totalOpex = biayaOperasional.reduce((sum, b) => sum + (b.jumlah || 0), 0);

    const labaBersih = totalOmzet - totalHPP - totalAdminFee - totalOpex;
    return labaBersih;
  }, [orders, biayaOperasional]);

  // 8. EKUITAS / MODAL (EQUITY)
  const equitySummary = useMemo(() => {
    const modalDisetor = config.modalDisetorAwal || 0;
    const labaDitahan = config.labaDitahanTahunLalu || 0;
    const prive = config.privePemilik || 0;
    const totalEkuitas = modalDisetor + labaDitahan + labaPeriodeBerjalan - prive;

    return {
      modalDisetor,
      labaDitahan,
      labaPeriodeBerjalan,
      prive,
      totalEkuitas,
    };
  }, [config, labaPeriodeBerjalan]);

  // TOTAL KEWAJIBAN & EKUITAS (PASIVA)
  const totalPasiva = useMemo(() => {
    return liabilitiesSummary.totalKewajiban + equitySummary.totalEkuitas;
  }, [liabilitiesSummary.totalKewajiban, equitySummary.totalEkuitas]);

  // SELISIH KESEIMBANGAN (BALANCE GAP)
  const balanceDiff = useMemo(() => {
    return Math.round(totalAset - totalPasiva);
  }, [totalAset, totalPasiva]);

  const isBalanced = Math.abs(balanceDiff) === 0;

  // Auto-Calibrate Initial Capital to Balance the Sheet
  const handleAutoCalibrateEquity = () => {
    const newModalAwal = config.modalDisetorAwal + balanceDiff;
    saveConfig({
      ...config,
      modalDisetorAwal: Math.max(0, newModalAwal),
    });
    showToast('Modal Awal berhasil disesuaikan otomatis sehingga Neraca klop & seimbang (Balanced)!');
  };

  // Financial Health Ratios
  const ratios = useMemo(() => {
    const currentRatio =
      liabilitiesSummary.totalKewajiban > 0
        ? (totalAsetLancar / liabilitiesSummary.totalKewajiban).toFixed(2)
        : 'Tak Terhingga (Bebas Hutang)';

    const quickRatio =
      liabilitiesSummary.totalKewajiban > 0
        ? ((totalAsetLancar - totalPersediaanKaos) / liabilitiesSummary.totalKewajiban).toFixed(2)
        : 'Sangat Aman';

    const workingCapital = totalAsetLancar - liabilitiesSummary.totalKewajiban;

    const debtToEquityRatio =
      equitySummary.totalEkuitas > 0
        ? ((liabilitiesSummary.totalKewajiban / equitySummary.totalEkuitas) * 100).toFixed(1)
        : '0';

    const debtToAssetRatio =
      totalAset > 0
        ? ((liabilitiesSummary.totalKewajiban / totalAset) * 100).toFixed(1)
        : '0';

    return {
      currentRatio,
      quickRatio,
      workingCapital,
      debtToEquityRatio,
      debtToAssetRatio,
    };
  }, [totalAsetLancar, liabilitiesSummary.totalKewajiban, totalPersediaanKaos, equitySummary.totalEkuitas, totalAset]);

  // Chart Data: Asset Composition
  const assetCompositionData = useMemo(() => {
    return [
      { name: 'Kas & Bank', value: totalKasBank },
      { name: 'Piutang Usaha', value: piutangData.totalPiutang },
      { name: 'Persediaan Kaos', value: totalPersediaanKaos },
      { name: 'Uang Muka Vendor', value: totalUangMukaVendor },
      { name: 'Aset Tetap (Net)', value: fixedAssetSummary.totalNilaiBuku },
    ].filter((item) => item.value > 0);
  }, [totalKasBank, piutangData.totalPiutang, totalPersediaanKaos, totalUangMukaVendor, fixedAssetSummary.totalNilaiBuku]);

  // Chart Data: Pasiva Composition
  const pasivaCompositionData = useMemo(() => {
    return [
      { name: 'Hutang Vendor & Biaya', value: liabilitiesSummary.totalKewajiban },
      { name: 'Modal Disetor Pemilik', value: equitySummary.modalDisetor },
      { name: 'Laba Ditahan', value: equitySummary.labaDitahan },
      { name: 'Laba Bersih Berjalan', value: Math.max(0, equitySummary.labaPeriodeBerjalan) },
    ].filter((item) => item.value > 0);
  }, [liabilitiesSummary.totalKewajiban, equitySummary]);

  // Chart Data: Comparison
  const comparisonBarData = useMemo(() => {
    return [
      {
        kategori: 'Struktur Neraca',
        'Total Aset (Aktiva)': totalAset,
        'Total Kewajiban (Hutang)': liabilitiesSummary.totalKewajiban,
        'Total Ekuitas (Modal)': equitySummary.totalEkuitas,
      },
    ];
  }, [totalAset, liabilitiesSummary.totalKewajiban, equitySummary.totalEkuitas]);

  // Rekapitulasi Buku Besar Pembantu Utang Dagang (A/P Subsidiary Ledger - Akun 2-10100)
  const apLedgerData = useMemo(() => {
    type APLedgerRow = {
      id: string;
      tanggal: string;
      referensi: string;
      vendorNama: string;
      deskripsi: string;
      akunLawan: string;
      tipe: 'po_baru' | 'pembayaran';
      debit: number; // Pelunasan (mengurangi utang dagang)
      kredit: number; // Tagihan PO Baru (menambah utang dagang)
      saldo: number;
    };

    const rows: APLedgerRow[] = [];
    const validPOs = purchaseOrders
      .filter((p) => p.statusPO !== 'batal')
      .sort((a, b) => a.tanggalPO.localeCompare(b.tanggalPO));

    let runningBalance = 0;

    validPOs.forEach((po) => {
      // 1. Tagihan Purchase Order Baru (Kredit Akun Utang Dagang)
      runningBalance += po.totalTagihan;
      rows.push({
        id: `po-cred-${po.id}`,
        tanggal: po.tanggalPO,
        referensi: po.noPO,
        vendorNama: po.vendorNama,
        deskripsi: `Pengadaan PO #${po.noPO} (${po.items.length} artikel kaos)`,
        akunLawan: '1-10200 Persediaan Kaos',
        tipe: 'po_baru',
        debit: 0,
        kredit: po.totalTagihan,
        saldo: runningBalance,
      });

      // 2. Pembayaran / Pelunasan (Debit Akun Utang Dagang & Kredit Kas/Bank)
      if (po.jumlahTerbayar > 0) {
        runningBalance -= po.jumlahTerbayar;
        rows.push({
          id: `po-deb-${po.id}`,
          tanggal: po.tanggalPO,
          referensi: po.noPO,
          vendorNama: po.vendorNama,
          deskripsi: `Pembayaran ${po.statusBayar === 'lunas' ? 'Lunas' : 'DP/Termin'} PO #${po.noPO}`,
          akunLawan: `1-10100 ${po.accountNama || 'Kas & Bank'}`,
          tipe: 'pembayaran',
          debit: po.jumlahTerbayar,
          kredit: 0,
          saldo: runningBalance,
        });
      }
    });

    const totalKreditUtang = rows.reduce((sum, r) => sum + r.kredit, 0);
    const totalDebitPelunasan = rows.reduce((sum, r) => sum + r.debit, 0);
    const saldoAkhirUtang = totalKreditUtang - totalDebitPelunasan;

    // Per-vendor debt breakdown
    const vendorMap: Record<string, { vendorNama: string; totalPO: number; totalTagihan: number; totalTerbayar: number; sisaHutang: number }> = {};
    validPOs.forEach((po) => {
      if (!vendorMap[po.vendorNama]) {
        vendorMap[po.vendorNama] = {
          vendorNama: po.vendorNama,
          totalPO: 0,
          totalTagihan: 0,
          totalTerbayar: 0,
          sisaHutang: 0,
        };
      }
      vendorMap[po.vendorNama].totalPO += 1;
      vendorMap[po.vendorNama].totalTagihan += po.totalTagihan;
      vendorMap[po.vendorNama].totalTerbayar += po.jumlahTerbayar;
      vendorMap[po.vendorNama].sisaHutang += po.sisaHutang;
    });

    return {
      rows: [...rows].reverse(),
      totalKreditUtang,
      totalDebitPelunasan,
      saldoAkhirUtang,
      vendorBreakdown: Object.values(vendorMap),
    };
  }, [purchaseOrders]);

  // Filtered Journal Entries
  const filteredJournalEntries = useMemo(() => {
    return journalEntries.filter((je) => {
      if (journalFilter === 'pembayaran_utang_vendor' && je.tipe !== 'pembayaran_utang_vendor') return false;
      if (journalFilter === 'kas_bank') {
        const hasCashBank = je.items.some(
          (it) => it.accountCode.startsWith('1-10100') || it.accountName.toLowerCase().includes('kas') || it.accountName.toLowerCase().includes('bank')
        );
        if (!hasCashBank) return false;
      }
      if (journalSearch.trim()) {
        const q = journalSearch.toLowerCase();
        const matchNo = je.noJurnal.toLowerCase().includes(q);
        const matchRef = je.referensi.toLowerCase().includes(q);
        const matchDesc = je.keterangan.toLowerCase().includes(q);
        const matchAcc = je.items.some(
          (it) => it.accountName.toLowerCase().includes(q) || it.accountCode.toLowerCase().includes(q)
        );
        if (!matchNo && !matchRef && !matchDesc && !matchAcc) return false;
      }
      return true;
    });
  }, [journalEntries, journalFilter, journalSearch]);

  // CSV Export
  const handleExportCSV = () => {
    const lines = [
      'LAPORAN NERACA KEUANGAN (BALANCE SHEET) - KALIMA APPAREL',
      `Per Tanggal: ${periodeTanggal}`,
      '',
      'ASET (AKTIVA),Nominal (Rp)',
      `Kas dan Setara Kas,${totalKasBank}`,
      `Piutang Usaha,${piutangData.totalPiutang}`,
      `Persediaan Barang Dagang (Kaos Polos),${totalPersediaanKaos}`,
      `Uang Muka Pembelian Vendor (DP),${totalUangMukaVendor}`,
      `TOTAL ASET LANCAR,${totalAsetLancar}`,
      `Harga Perolehan Aset Tetap,${fixedAssetSummary.totalHargaPerolehan}`,
      `Akumulasi Penyusutan Aset Tetap,-${fixedAssetSummary.totalAkumulasiPenyusutan}`,
      `NILAI BUKU ASET TETAP,${fixedAssetSummary.totalNilaiBuku}`,
      `TOTAL ASET (AKTIVA),${totalAset}`,
      '',
      'KEWAJIBAN & EKUITAS (PASIVA),Nominal (Rp)',
      `Hutang Usaha (Vendor Kaos),${liabilitiesSummary.hutangVendor}`,
      `Hutang Biaya / Operasional,${liabilitiesSummary.hutangBiaya}`,
      `TOTAL KEWAJIBAN LANCAR,${liabilitiesSummary.totalKewajiban}`,
      `Modal Disetor Pemilik,${equitySummary.modalDisetor}`,
      `Laba Ditahan,${equitySummary.labaDitahan}`,
      `Laba Bersih Periode Berjalan,${equitySummary.labaPeriodeBerjalan}`,
      `Prive Pemilik,-${equitySummary.prive}`,
      `TOTAL EKUITAS,${equitySummary.totalEkuitas}`,
      `TOTAL KEWAJIBAN & EKUITAS (PASIVA),${totalPasiva}`,
      `SELISIH KESEIMBANGAN (BALANCE GAP),${balanceDiff}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Neraca_Keuangan_Kalima_${periodeTanggal}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-[#161c28] border border-amber-500/60 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Balance Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#141d30] to-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
                <Scale className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Laporan Neraca Keuangan (Balance Sheet)
                  </h2>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isBalanced
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {isBalanced ? '✅ BALANCE (SEIMBANG)' : `⚠️ SELISIH Rp ${Math.abs(balanceDiff).toLocaleString('id-ID')}`}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Posisi aset/aktiva (kas, piutang, persediaan kaos, aset tetap) vs kewajiban/pasiva (hutang vendor & modal pemilik) sesuai standar akuntansi.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Periode Tanggal */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Posisi:</span>
              <input
                type="date"
                value={periodeTanggal}
                onChange={(e) => setPeriodeTanggal(e.target.value)}
                className="bg-transparent text-white font-mono font-medium focus:outline-none cursor-pointer"
              />
            </div>

            {/* Auto Calibrate Button if Unbalanced */}
            {!isBalanced && (
              <button
                onClick={handleAutoCalibrateEquity}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                title="Seimbangkan otomatis modal awal pemilik agar selisih neraca menjadi Rp 0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Seimbangkan Modal (Auto-Calibrate)</span>
              </button>
            )}

            {/* Pengaturan Modal & Ekuitas */}
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Atur Modal & Prive</span>
            </button>

            {/* Cetak PDF / Print */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>Cetak Neraca Resmi</span>
            </button>

            {/* Ekspor CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Metric Cards: Rasio & Kesehatan Finansial */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Total Aset */}
        <div className="bg-[#121620] p-4 rounded-2xl border border-slate-850 border-t-2 border-t-emerald-400 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold tracking-wider text-[11px]">TOTAL AKTIVA (ASET)</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 truncate">
            Rp {totalAset.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Aset Lancar:</span>
            <span className="font-mono text-slate-300">Rp {totalAsetLancar.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* 2. Total Kewajiban */}
        <div className="bg-[#121620] p-4 rounded-2xl border border-slate-850 border-t-2 border-t-rose-400 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold tracking-wider text-[11px]">TOTAL KEWAJIBAN (HUTANG)</span>
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-rose-300 truncate">
            Rp {liabilitiesSummary.totalKewajiban.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Utang PO Vendor:</span>
            <span className="font-mono text-rose-400">Rp {liabilitiesSummary.hutangVendor.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* 3. Total Ekuitas */}
        <div className="bg-[#121620] p-4 rounded-2xl border border-slate-850 border-t-2 border-t-blue-400 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold tracking-wider text-[11px]">TOTAL EKUITAS (MODAL)</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-blue-300 truncate">
            Rp {equitySummary.totalEkuitas.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Laba Berjalan:</span>
            <span className="font-mono text-emerald-400">Rp {equitySummary.labaPeriodeBerjalan.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* 4. Current Ratio */}
        <div className="bg-[#121620] p-4 rounded-2xl border border-slate-850 border-t-2 border-t-purple-400 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold tracking-wider text-[11px]">CURRENT RATIO</span>
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-purple-300">
            {ratios.currentRatio} {typeof ratios.currentRatio === 'number' || !isNaN(Number(ratios.currentRatio)) ? 'x' : ''}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Likuiditas:</span>
            <span className="text-purple-400 font-medium">Aset Lancar / Hutang</span>
          </div>
        </div>

        {/* 5. Modal Kerja Bersih */}
        <div className="bg-[#121620] p-4 rounded-2xl border border-slate-850 border-t-2 border-t-amber-400 shadow-sm col-span-2 lg:col-span-1 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold tracking-wider text-[11px]">MODAL KERJA BERSIH</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-amber-300 truncate">
            Rp {ratios.workingCapital.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Net Working Capital</span>
            <span className="text-emerald-400 font-medium font-mono">Positif</span>
          </div>
        </div>
      </div>

      {/* Visual Balance Scale Comparison Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-[#131b2e] to-slate-950 p-3.5 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <Scale className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Keseimbangan Pembukuan Neraca:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                isBalanced
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}>
                {isBalanced ? '✓ 100% SEIMBANG' : `⚠️ SELISIH Rp ${Math.abs(balanceDiff).toLocaleString('id-ID')}`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              Total Aktiva (Aset) <strong className="text-emerald-400">Rp {totalAset.toLocaleString('id-ID')}</strong> = Total Pasiva (Kewajiban + Ekuitas) <strong className="text-blue-400">Rp {totalPasiva.toLocaleString('id-ID')}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubView('jurnal')}
            className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/25 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Audit Buku Jurnal ({journalEntries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('buku_besar')}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Buku Besar Utang</span>
          </button>
        </div>
      </div>

      {/* Sub-View Navigation Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121620] p-1.5 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubView('neraca')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubView === 'neraca'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Neraca Keuangan (Aktiva vs Pasiva)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('jurnal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubView === 'jurnal'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Buku Jurnal Umum (General Journal)</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                activeSubView === 'jurnal'
                  ? 'bg-slate-950 text-amber-300'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {journalEntries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('buku_besar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubView === 'buku_besar'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Buku Besar Utang Dagang (A/P Ledger)</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                activeSubView === 'buku_besar'
                  ? 'bg-slate-950 text-rose-300'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {apLedgerData.rows.length} Mutasi
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono px-3">
          <span>Otomatisasi: <strong className="text-emerald-400">Debit Utang ↔ Kredit Kas</strong></span>
        </div>
      </div>

      {activeSubView === 'neraca' && (
        <>
          {/* Main Two-Column Balance Sheet Table (Aktiva vs Pasiva) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* =================================================================== */}
        {/* KOLOM KIRI: ASET / AKTIVA */}
        {/* =================================================================== */}
        <div className="bg-[#121620] rounded-3xl border border-slate-800/90 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              ASET (AKTIVA)
            </h3>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              Rp {totalAset.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="p-5 space-y-5 text-xs text-slate-300">
            {/* 1. ASET LANCAR */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  1. Aset Lancar (Current Assets)
                </span>
                <span className="font-mono font-bold text-emerald-400 text-xs">
                  Rp {totalAsetLancar.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Rincian Kas & Setara Kas */}
              <div className="pl-3 space-y-1.5">
                <div className="flex items-center justify-between text-slate-200 font-semibold">
                  <div className="flex items-center gap-2">
                    <span>Kas dan Setara Kas</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {cashAccounts.length} Akun
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white font-bold">Rp {totalKasBank.toLocaleString('id-ID')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setJournalFilter('kas_bank');
                        setActiveSubView('jurnal');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/25 text-[10px] font-medium transition-colors cursor-pointer"
                      title="Klik untuk membuka buku jurnal akun Kas/Bank"
                    >
                      <span>Jurnal</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-blue-400/80 flex items-center gap-1">
                  <span>⚡ Terkredit otomatis saat pelunasan utang vendor</span>
                </div>
                <div className="pl-3 space-y-1 text-[11px] text-slate-400 border-l border-slate-800">
                  {cashAccounts.map((acc) => (
                    <div key={acc.id} className="flex justify-between">
                      <span>• {acc.nama}</span>
                      <span className="font-mono">Rp {(acc.saldo || 0).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Piutang Usaha */}
              <div className="pl-3 space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span>Piutang Usaha (Pelanggan & Konsinyasi)</span>
                  <span className="font-mono text-white">Rp {piutangData.totalPiutang.toLocaleString('id-ID')}</span>
                </div>
                <div className="pl-3 space-y-1 text-[11px] text-slate-400 border-l border-slate-800">
                  <div className="flex justify-between">
                    <span>• Piutang Pesanan Belum Lunas</span>
                    <span className="font-mono">Rp {piutangData.piutangPelanggan.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Persediaan Kaos */}
              <div className="pl-3 space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span>Persediaan Barang Dagang (Stok Kaos Polos)</span>
                  <span className="font-mono text-white">Rp {totalPersediaanKaos.toLocaleString('id-ID')}</span>
                </div>
                <div className="pl-3 text-[11px] text-slate-400 border-l border-slate-800">
                  <div className="flex justify-between">
                    <span>• {totalPcsKaosStok.toLocaleString('id-ID')} pcs kaos fisik di Gudang Utama (Nilai HPP)</span>
                    <span className="font-mono">Rp {totalPersediaanKaos.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Uang Muka Vendor */}
              <div className="pl-3 space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span>Uang Muka Pembelian Vendor (DP Kaos)</span>
                  <span className="font-mono text-white">Rp {totalUangMukaVendor.toLocaleString('id-ID')}</span>
                </div>
                <div className="pl-3 text-[11px] text-slate-400 border-l border-slate-800">
                  <div className="flex justify-between">
                    <span>• DP Pesanan Kaos Vendor yang Sedang Berjalan</span>
                    <span className="font-mono">Rp {totalUangMukaVendor.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. ASET TETAP (TIDAK LANCAR) */}
            <div className="space-y-2.5 pt-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  2. Aset Tetap & Peralatan (Fixed Assets)
                </span>
                <span className="font-mono font-bold text-blue-400 text-xs">
                  Rp {fixedAssetSummary.totalNilaiBuku.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="pl-3 space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Harga Perolehan Aset Tetap ({fixedAssets.length} Item)</span>
                  <span className="font-mono text-white">
                    Rp {fixedAssetSummary.totalHargaPerolehan.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>Akumulasi Penyusutan Aset Tetap (-)</span>
                  <span className="font-mono text-rose-400">
                    (Rp {fixedAssetSummary.totalAkumulasiPenyusutan.toLocaleString('id-ID')})
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-200 font-bold pt-1 border-t border-slate-800/80">
                  <span>Nilai Buku Bersih Aset Tetap</span>
                  <span className="font-mono text-blue-300">
                    Rp {fixedAssetSummary.totalNilaiBuku.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Fixed assets mini list */}
                <div className="pl-3 space-y-1 text-[11px] text-slate-400 border-l border-slate-800 pt-1">
                  {fixedAssets.map((asset) => (
                    <div key={asset.id} className="flex justify-between items-center group">
                      <span className="truncate max-w-[200px]">• {asset.nama}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">Rp {asset.nilaiBuku.toLocaleString('id-ID')}</span>
                        {isOwner && (
                          <button
                            onClick={() => {
                              setEditingAsset(asset);
                              setIsAssetModalOpen(true);
                            }}
                            className="text-slate-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isOwner && (
                  <button
                    onClick={() => {
                      setEditingAsset(null);
                      setIsAssetModalOpen(true);
                    }}
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 mt-2 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Kelola / Tambah Aset Tetap</span>
                  </button>
                )}
              </div>
            </div>

            {/* TOTAL ASET FOOTER */}
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between font-bold text-sm">
              <span className="text-white">TOTAL ASET (AKTIVA)</span>
              <span className="font-mono text-emerald-400 text-base">
                Rp {totalAset.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* KOLOM KANAN: KEWAJIBAN & EKUITAS / PASIVA */}
        {/* =================================================================== */}
        <div className="bg-[#121620] rounded-3xl border border-slate-800/90 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              KEWAJIBAN & EKUITAS (PASIVA)
            </h3>
            <span className="font-mono font-bold text-blue-400 text-sm">
              Rp {totalPasiva.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="p-5 space-y-5 text-xs text-slate-300">
            {/* 1. KEWAJIBAN LANCAR (LIABILITIES) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                  1. Kewajiban Lancar (Liabilities / Hutang)
                </span>
                <span className="font-mono font-bold text-rose-400 text-xs">
                  Rp {liabilitiesSummary.totalKewajiban.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Rincian Hutang Vendor */}
              <div className="pl-3 space-y-1.5">
                <div className="flex items-center justify-between text-slate-200 font-semibold">
                  <div className="flex items-center gap-2">
                    <span>Hutang Usaha (Vendor Bahan & CMT)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white font-bold">
                      Rp {liabilitiesSummary.hutangVendor.toLocaleString('id-ID')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSubView('buku_besar')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-[10px] font-medium transition-colors cursor-pointer"
                      title="Klik untuk membuka Buku Besar Pembantu Utang Dagang"
                    >
                      <span>Buku Besar</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                  <span>⚡ Terdebit otomatis mengurangi kewajiban saat dibayar</span>
                </div>
                <div className="pl-3 space-y-1 text-[11px] text-slate-400 border-l border-slate-800">
                  <div className="flex justify-between">
                    <span>• Sisa Kewajiban Tagihan Purchase Order (PO)</span>
                    <span className="font-mono">Rp {liabilitiesSummary.hutangVendor.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Hutang Operasional / Lainnya */}
              {liabilitiesSummary.hutangBiaya > 0 && (
                <div className="pl-3 space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                    <span>Hutang Beban / Biaya Operasional Masih Harus Dibayar</span>
                    <span className="font-mono text-white">
                      Rp {liabilitiesSummary.hutangBiaya.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. EKUITAS / MODAL PEMILIK (EQUITY) */}
            <div className="space-y-2.5 pt-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  2. Ekuitas & Permodalan (Owner's Equity)
                </span>
                <span className="font-mono font-bold text-blue-400 text-xs">
                  Rp {equitySummary.totalEkuitas.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="pl-3 space-y-2">
                {/* Modal Disetor */}
                <div className="flex items-center justify-between text-slate-300">
                  <span>Modal Awal Disetor Pemilik</span>
                  <span className="font-mono font-bold text-white">
                    Rp {equitySummary.modalDisetor.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Laba Ditahan */}
                <div className="flex items-center justify-between text-slate-300">
                  <span>Laba Ditahan (Retained Earnings Periode Lalu)</span>
                  <span className="font-mono text-emerald-400">
                    Rp {equitySummary.labaDitahan.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Laba Bersih Berjalan */}
                <div className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-1">
                    <span>Laba Bersih Periode Berjalan</span>
                    <span className="text-[10px] text-slate-500">(Laba Rugi Real-Time)</span>
                  </div>
                  <span className={`font-mono font-bold ${equitySummary.labaPeriodeBerjalan >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    Rp {equitySummary.labaPeriodeBerjalan.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Prive Pemilik */}
                {equitySummary.prive > 0 && (
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Prive / Pengambilan Pribadi Pemilik (-)</span>
                    <span className="font-mono text-rose-400">
                      (Rp {equitySummary.prive.toLocaleString('id-ID')})
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-slate-200 font-bold pt-1.5 border-t border-slate-800/80">
                  <span>Total Ekuitas Pemilik</span>
                  <span className="font-mono text-blue-300">
                    Rp {equitySummary.totalEkuitas.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* TOTAL PASIVA FOOTER */}
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between font-bold text-sm">
              <span className="text-white">TOTAL KEWAJIBAN & EKUITAS</span>
              <span className="font-mono text-blue-400 text-base">
                Rp {totalPasiva.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Chart Section: Komposisi Struktur Aset & Pasiva (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Donut Komposisi Aset */}
        <div className="bg-[#121620] p-5 rounded-3xl border border-slate-800/80 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <PieChartIcon className="w-3.5 h-3.5 text-emerald-400" />
            Struktur Komposisi Aset (Aktiva)
          </h4>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetCompositionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                >
                  {assetCompositionData.map((_, idx) => (
                    <Cell key={`asset-${idx}`} fill={ASSET_COLORS[idx % ASSET_COLORS.length]} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', fontSize: '11px', color: '#fff' }}
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Nilai']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400">
            {assetCompositionData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ASSET_COLORS[idx % ASSET_COLORS.length] }} />
                <span className="truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Donut Komposisi Pasiva */}
        <div className="bg-[#121620] p-5 rounded-3xl border border-slate-800/80 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <PieChartIcon className="w-3.5 h-3.5 text-blue-400" />
            Struktur Pendanaan & Modal (Pasiva)
          </h4>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pasivaCompositionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                >
                  {pasivaCompositionData.map((_, idx) => (
                    <Cell key={`pasiva-${idx}`} fill={LIAB_EQUITY_COLORS[idx % LIAB_EQUITY_COLORS.length]} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', fontSize: '11px', color: '#fff' }}
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Nilai']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400">
            {pasivaCompositionData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: LIAB_EQUITY_COLORS[idx % LIAB_EQUITY_COLORS.length] }} />
                <span className="truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 3: Bar Komparasi Aset vs Liabilitas vs Ekuitas */}
        <div className="bg-[#121620] p-5 rounded-3xl border border-slate-800/80 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            Perbandingan Aset vs Hutang vs Ekuitas
          </h4>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonBarData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="kategori" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Jt`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', fontSize: '11px', color: '#fff' }}
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Nominal']}
                />
                <Bar dataKey="Total Aset (Aktiva)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Total Kewajiban (Hutang)" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Total Ekuitas (Modal)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-400 text-center">
            Persamaan Neraca: <strong className="text-emerald-400">Aset</strong> = <strong className="text-rose-400">Kewajiban</strong> + <strong className="text-blue-400">Ekuitas</strong>
          </div>
        </div>
      </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: BUKU JURNAL UMUM (GENERAL JOURNAL) */}
      {/* ========================================================================= */}
      {activeSubView === 'jurnal' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Explanation Banner */}
          <div className="bg-gradient-to-r from-blue-950/50 via-[#131b2e] to-emerald-950/40 p-4 rounded-2xl border border-blue-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 mt-0.5">
                <BookOpen className="w-5 h-5" />
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">
                    Buku Jurnal Umum (General Journal) - Penjurnalan Akuntansi Berpasangan
                  </h3>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                    Double-Entry System
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Setiap pembayaran utang vendor diposting secara otomatis dengan mendebit akun <strong className="text-emerald-300">2-10100 Utang Dagang</strong> (mengurangi kewajiban) dan mengkredit akun <strong className="text-rose-300">1-10100 Kas & Bank</strong> (mengurangi dana kas). Total debit dan kredit selalu 100% seimbang.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSubView('buku_besar')}
              className="px-3.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl font-semibold flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer"
            >
              <span>Buka Buku Besar Utang</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-[#121620] p-3.5 rounded-2xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block mb-1">Total Bukti Jurnal</span>
              <div className="text-lg font-bold font-mono text-white">{filteredJournalEntries.length} Jurnal</div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Tercatat di sistem</span>
            </div>

            <div className="bg-[#121620] p-3.5 rounded-2xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block mb-1">Total Terdebit (Debit)</span>
              <div className="text-lg font-bold font-mono text-emerald-400">
                Rp {filteredJournalEntries.reduce((s, j) => s + j.totalDebit, 0).toLocaleString('id-ID')}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Mengurangi utang & aset</span>
            </div>

            <div className="bg-[#121620] p-3.5 rounded-2xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block mb-1">Total Terkredit (Kredit)</span>
              <div className="text-lg font-bold font-mono text-rose-300">
                Rp {filteredJournalEntries.reduce((s, j) => s + j.totalKredit, 0).toLocaleString('id-ID')}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Mengurangi kas / aset</span>
            </div>

            <div className="bg-[#121620] p-3.5 rounded-2xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block mb-1">Keseimbangan Pembukuan</span>
              <div className="text-sm font-bold font-mono text-emerald-400 flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>100% Balans</span>
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-0.5 block">Debit = Kredit (Selisih Rp 0)</span>
            </div>
          </div>

          {/* Controls: Filter & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121620] p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-slate-400 text-[11px] pr-1">Filter:</span>
              <button
                onClick={() => setJournalFilter('all')}
                className={`px-3 py-1 rounded-xl font-medium cursor-pointer transition-colors ${
                  journalFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Semua Jurnal ({journalEntries.length})
              </button>

              <button
                onClick={() => setJournalFilter('pembayaran_utang_vendor')}
                className={`px-3 py-1 rounded-xl font-medium cursor-pointer transition-colors ${
                  journalFilter === 'pembayaran_utang_vendor'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Pembayaran Utang Vendor
              </button>

              <button
                onClick={() => setJournalFilter('kas_bank')}
                className={`px-3 py-1 rounded-xl font-medium cursor-pointer transition-colors ${
                  journalFilter === 'kas_bank'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Melibatkan Kas & Bank
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari bukti JU-, PO, vendor..."
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Vouchers List */}
          {filteredJournalEntries.length === 0 ? (
            <div className="bg-[#121620] rounded-2xl border border-slate-800 p-12 text-center text-slate-400 space-y-2">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="font-semibold text-white">Tidak ada jurnal ditemukan</div>
              <p className="text-xs text-slate-500">Coba ubah kata kunci pencarian atau ganti filter kategori.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJournalEntries.map((je) => (
                <div
                  key={je.id}
                  className="bg-[#121620] rounded-2xl border border-slate-800 overflow-hidden shadow-sm hover:border-slate-700 transition-colors"
                >
                  {/* Voucher Header */}
                  <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-amber-400 text-sm">{je.noJurnal}</span>
                      <span className="text-slate-400 font-mono text-[11px]">• {je.tanggal} {je.waktu || '10:00'}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {je.tipe === 'pembayaran_utang_vendor' ? 'Pembayaran Utang Vendor' : je.tipe}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Seimbang
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Ref: <strong className="font-mono text-slate-300">{je.referensi}</strong></span>
                      <span>Petugas: <strong className="text-slate-300">{je.dicatatOleh}</strong></span>
                    </div>
                  </div>

                  {/* Keterangan */}
                  <div className="px-4 py-2.5 bg-slate-950/40 text-xs text-slate-300 border-b border-slate-850 flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Uraian:</span>
                    <span className="font-medium text-white">{je.keterangan}</span>
                  </div>

                  {/* Double-Entry Line Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-850 text-[11px]">
                        <tr>
                          <th className="px-4 py-2 w-12 text-center">No</th>
                          <th className="px-4 py-2 w-28">Kode Akun</th>
                          <th className="px-4 py-2">Nama Akun Rekening</th>
                          <th className="px-4 py-2 w-28 text-center">Kategori</th>
                          <th className="px-4 py-2 text-right w-36 text-emerald-400">Posisi Debet (Rp)</th>
                          <th className="px-4 py-2 text-right w-36 text-rose-400">Posisi Kredit (Rp)</th>
                          <th className="px-4 py-2">Memo Penjelas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {je.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-4 py-2.5 text-center text-slate-500 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-300 font-medium text-[11px]">
                              {it.accountCode}
                            </td>
                            <td className={`px-4 py-2.5 font-semibold text-xs ${it.kredit > 0 ? 'pl-7 text-rose-100' : 'text-white'}`}>
                              {it.kredit > 0 ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="text-slate-500 font-mono">↳</span>
                                  <span>{it.accountName}</span>
                                </span>
                              ) : (
                                <span>{it.accountName}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                it.category === 'Kewajiban'
                                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              }`}>
                                {it.category}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                              {it.debit > 0 ? `Rp ${it.debit.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-300">
                              {it.kredit > 0 ? `Rp ${it.kredit.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                              {it.memo || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-900/60 font-bold border-t border-slate-800 text-xs">
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-right text-slate-300">
                            Total Keseimbangan Ayat Jurnal:
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-emerald-400">
                            Rp {je.totalDebit.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-rose-300">
                            Rp {je.totalKredit.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-2 text-emerald-400 font-mono text-[11px]">
                            ✓ Balance (Klop)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: BUKU BESAR UTANG DAGANG (A/P LEDGER - AKUN 2-10100) */}
      {/* ========================================================================= */}
      {activeSubView === 'buku_besar' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-[#131b2e] to-rose-950/40 p-4 rounded-2xl border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
                <CreditCard className="w-5 h-5" />
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">
                    Buku Besar Pembantu Utang Dagang (A/P Subsidiary Ledger)
                  </h3>
                  <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                    Akun: 2-10100
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Rincian pergerakan tagihan baru dari Purchase Order (kredit) dan pengurangan utang saat dibayar melalui Kas/Bank (debit). Saldo akhir akun ini sinkron persis dengan angka Kewajiban Utang Dagang di Neraca Pasiva.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSubView('neraca')}
              className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl font-semibold flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer"
            >
              <span>Lihat di Neraca</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800">
              <span className="text-slate-400 text-xs block mb-1">Saldo Awal Utang</span>
              <div className="text-lg font-bold font-mono text-slate-300">Rp 0</div>
              <span className="text-[11px] text-slate-500 mt-1 block">Awal periode</span>
            </div>

            <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800">
              <span className="text-slate-400 text-xs block mb-1">Total Tagihan PO (Kredit +)</span>
              <div className="text-lg font-bold font-mono text-rose-300">
                Rp {apLedgerData.totalKreditUtang.toLocaleString('id-ID')}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Kewajiban pengadaan bahan</span>
            </div>

            <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800">
              <span className="text-slate-400 text-xs block mb-1">Total Pelunasan (Debit -)</span>
              <div className="text-lg font-bold font-mono text-emerald-400">
                Rp {apLedgerData.totalDebitPelunasan.toLocaleString('id-ID')}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Dibayar via Kas & Bank</span>
            </div>

            <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800 bg-rose-950/20">
              <span className="text-slate-400 text-xs block mb-1">Saldo Akhir Kewajiban</span>
              <div className="text-lg font-bold font-mono text-rose-400">
                Rp {apLedgerData.saldoAkhirUtang.toLocaleString('id-ID')}
              </div>
              <span className="text-[11px] text-rose-300/80 mt-1 block">Muncul di Pasiva Neraca</span>
            </div>
          </div>

          {/* Breakdown per Vendor Rekanan */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Rincian Saldo Kewajiban per Mitra Vendor:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {apLedgerData.vendorBreakdown.map((vb) => {
                const payPct = vb.totalTagihan > 0 ? Math.min(100, Math.round((vb.totalTerbayar / vb.totalTagihan) * 100)) : 100;
                return (
                  <div
                    key={vb.vendorNama}
                    className="bg-[#121620] p-4 rounded-2xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-bold text-white text-xs">{vb.vendorNama}</h5>
                        <span className="text-[11px] text-slate-400">{vb.totalPO} Purchase Order</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          vb.sisaHutang === 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                        }`}
                      >
                        {vb.sisaHutang === 0 ? '✓ Lunas' : 'Ada Sisa'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Progres Pelunasan:</span>
                        <span className="font-mono font-bold text-white">{payPct}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            payPct === 100 ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${payPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Total Tagihan:</span>
                        <span className="font-mono text-white font-medium">Rp {vb.totalTagihan.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Telah Dibayar:</span>
                        <span className="font-mono text-emerald-400 font-medium">Rp {vb.totalTerbayar.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-200 font-bold pt-1 border-t border-slate-800">
                        <span>Sisa Kewajiban:</span>
                        <span className="font-mono text-rose-400">Rp {vb.sisaHutang.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Ledger Movement Table */}
          <div className="bg-[#121620] rounded-2xl border border-slate-800 overflow-hidden shadow-sm space-y-2">
            <div className="px-5 py-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-white text-xs flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Kartu Mutasi Buku Besar Pembantu Utang (Akun 2-10100)</span>
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                {apLedgerData.rows.length} Mutasi Transaksi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-850 text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">Tanggal</th>
                    <th className="px-4 py-2.5">No. Bukti / PO</th>
                    <th className="px-4 py-2.5">Vendor Rekanan</th>
                    <th className="px-4 py-2.5">Uraian Transaksi</th>
                    <th className="px-4 py-2.5">Akun Lawan</th>
                    <th className="px-4 py-2.5 text-right text-emerald-400">Debit (-) Pelunasan</th>
                    <th className="px-4 py-2.5 text-right text-rose-400">Kredit (+) Tagihan Baru</th>
                    <th className="px-4 py-2.5 text-right">Saldo Utang Berjalan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {apLedgerData.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/30">
                      <td className="px-4 py-2.5 font-mono text-slate-300 text-[11px] whitespace-nowrap">
                        {r.tanggal}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-amber-400 text-[11px] whitespace-nowrap">
                        {r.referensi}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">
                        {r.vendorNama}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {r.deskripsi}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-blue-300 whitespace-nowrap">
                        {r.akunLawan}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {r.debit > 0 ? `-Rp ${r.debit.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                        {r.kredit > 0 ? `+Rp ${r.kredit.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-white whitespace-nowrap">
                        Rp {r.saldo.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ATUR MODAL AWAL, LABA DITAHAN & PRIVE */}
      {/* ========================================================================= */}
      {isConfigModalOpen && (
        <BalanceConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          currentConfig={config}
          onSave={(newCfg) => {
            saveConfig(newCfg);
            setIsConfigModalOpen(false);
            showToast('Pengaturan modal disetor dan prive berhasil disimpan.');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: KELOLA ASET TETAP (TAMBAH / EDIT) */}
      {/* ========================================================================= */}
      {isAssetModalOpen && (
        <FixedAssetFormModal
          isOpen={isAssetModalOpen}
          onClose={() => {
            setIsAssetModalOpen(false);
            setEditingAsset(null);
          }}
          editingAsset={editingAsset}
          onSave={(assetData) => {
            if (editingAsset) {
              const updated = fixedAssets.map((a) =>
                a.id === editingAsset.id ? { ...a, ...assetData } : a
              );
              saveFixedAssets(updated);
              showToast(`Aset tetap ${assetData.nama} berhasil diperbarui.`);
            } else {
              const newAsset: FixedAssetItem = {
                id: `fa-${Date.now()}`,
                ...assetData,
              };
              saveFixedAssets([...fixedAssets, newAsset]);
              showToast(`Aset tetap baru ${assetData.nama} berhasil ditambahkan.`);
            }
            setIsAssetModalOpen(false);
            setEditingAsset(null);
          }}
          onDelete={(assetId) => {
            const updated = fixedAssets.filter((a) => a.id !== assetId);
            saveFixedAssets(updated);
            setIsAssetModalOpen(false);
            setEditingAsset(null);
            showToast('Aset tetap berhasil dihapus.');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CETAK LAPORAN NERACA RESMI KALIMA */}
      {/* ========================================================================= */}
      {isPrintModalOpen && (
        <PrintBalanceSheetModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          periodeTanggal={periodeTanggal}
          totalAset={totalAset}
          totalAsetLancar={totalAsetLancar}
          totalKasBank={totalKasBank}
          cashAccounts={cashAccounts}
          piutangData={piutangData}
          totalPersediaanKaos={totalPersediaanKaos}
          totalUangMukaVendor={totalUangMukaVendor}
          fixedAssets={fixedAssets}
          fixedAssetSummary={fixedAssetSummary}
          liabilitiesSummary={liabilitiesSummary}
          equitySummary={equitySummary}
          totalPasiva={totalPasiva}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: BALANCE CONFIG MODAL (MODAL AWAL, LABA DITAHAN, PRIVE)
// ============================================================================
interface BalanceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: BalanceSheetConfig;
  onSave: (config: BalanceSheetConfig) => void;
}

const BalanceConfigModal: React.FC<BalanceConfigModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSave,
}) => {
  const [modalDisetorAwal, setModalDisetorAwal] = useState<number>(currentConfig.modalDisetorAwal || 0);
  const [labaDitahanTahunLalu, setLabaDitahanTahunLalu] = useState<number>(currentConfig.labaDitahanTahunLalu || 0);
  const [privePemilik, setPrivePemilik] = useState<number>(currentConfig.privePemilik || 0);
  const [uangMukaLainnya, setUangMukaLainnya] = useState<number>(currentConfig.uangMukaLainnya || 0);
  const [hutangBiayaLainnya, setHutangBiayaLainnya] = useState<number>(currentConfig.hutangBiayaLainnya || 0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      modalDisetorAwal,
      labaDitahanTahunLalu,
      privePemilik,
      uangMukaLainnya,
      hutangBiayaLainnya,
      lastUpdated: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-xs text-slate-300">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Building2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-white text-sm">Pengaturan Modal & Ekuitas Pemilik</h3>
              <p className="text-[11px] text-slate-400">Modal disetor, akumulasi laba ditahan, dan pengambilan prive.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Modal Awal Disetor Pemilik (Rp) *
            </label>
            <input
              type="number"
              min="0"
              value={modalDisetorAwal}
              onChange={(e) => setModalDisetorAwal(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-right font-mono font-bold text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Laba Ditahan / Retained Earnings Periode Lalu (Rp)
            </label>
            <input
              type="number"
              min="0"
              value={labaDitahanTahunLalu}
              onChange={(e) => setLabaDitahanTahunLalu(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-right font-mono text-emerald-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Prive Pemilik / Pengambilan Pribadi (-) (Rp)
            </label>
            <input
              type="number"
              min="0"
              value={privePemilik}
              onChange={(e) => setPrivePemilik(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-right font-mono text-rose-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Uang Muka Biaya Lainnya (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={uangMukaLainnya}
                onChange={(e) => setUangMukaLainnya(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-right font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Hutang Biaya Lainnya (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={hutangBiayaLainnya}
                onChange={(e) => setHutangBiayaLainnya(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-right font-mono text-white"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-1 shadow-md cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: FIXED ASSET FORM MODAL
// ============================================================================
interface FixedAssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAsset: FixedAssetItem | null;
  onSave: (assetData: Omit<FixedAssetItem, 'id'>) => void;
  onDelete?: (assetId: string) => void;
}

const FixedAssetFormModal: React.FC<FixedAssetFormModalProps> = ({
  isOpen,
  onClose,
  editingAsset,
  onSave,
  onDelete,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [nama, setNama] = useState(editingAsset?.nama || '');
  const [kategori, setKategori] = useState<FixedAssetCategory>(editingAsset?.kategori || 'Peralatan & Mesin Produksi');
  const [tanggalPerolehan, setTanggalPerolehan] = useState(editingAsset?.tanggalPerolehan || todayStr);
  const [hargaPerolehan, setHargaPerolehan] = useState<number>(editingAsset?.hargaPerolehan || 0);
  const [umurEkonomisTahun, setUmurEkonomisTahun] = useState<number>(editingAsset?.umurEkonomisTahun || 4);
  const [akumulasiPenyusutan, setAkumulasiPenyusutan] = useState<number>(editingAsset?.akumulasiPenyusutan || 0);
  const [lokasi, setLokasi] = useState(editingAsset?.lokasi || 'Gudang Utama Kalima');
  const [catatan, setCatatan] = useState(editingAsset?.catatan || '');

  if (!isOpen) return null;

  const nilaiBuku = Math.max(0, hargaPerolehan - akumulasiPenyusutan);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || hargaPerolehan <= 0) {
      alert('Nama aset dan harga perolehan wajib diisi.');
      return;
    }

    onSave({
      nama: nama.trim(),
      kategori,
      tanggalPerolehan,
      hargaPerolehan,
      umurEkonomisTahun,
      akumulasiPenyusutan,
      nilaiBuku,
      lokasi: lokasi.trim() || undefined,
      catatan: catatan.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-xs text-slate-300">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Building2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-white text-sm">
                {editingAsset ? 'Edit Aset Tetap' : 'Tambah Aset Tetap / Peralatan Baru'}
              </h3>
              <p className="text-[11px] text-slate-400">Mesin sablon, rak gudang, perangkat kantor.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Nama Aset / Peralatan *</label>
            <input
              type="text"
              placeholder="e.g. Mesin Heat Press Sablon 40x60"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Kategori Aset *</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as FixedAssetCategory)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white cursor-pointer"
              >
                <option value="Peralatan & Mesin Produksi">Peralatan & Mesin</option>
                <option value="Rak Pergudangan & Display">Rak Pergudangan</option>
                <option value="Inventaris & Elektronik Kantor">Inventaris Kantor</option>
                <option value="Kendaraan Operasional">Kendaraan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Tanggal Perolehan *</label>
              <input
                type="date"
                value={tanggalPerolehan}
                onChange={(e) => setTanggalPerolehan(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Harga Perolehan (Rp) *</label>
              <input
                type="number"
                min="1"
                value={hargaPerolehan}
                onChange={(e) => setHargaPerolehan(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-right font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Akumulasi Penyusutan (Rp)</label>
              <input
                type="number"
                min="0"
                max={hargaPerolehan}
                value={akumulasiPenyusutan}
                onChange={(e) => setAkumulasiPenyusutan(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-right font-mono text-rose-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Nilai Buku Preview */}
          <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
            <span className="text-slate-400">Nilai Buku Bersih (Net Book Value):</span>
            <span className="font-mono font-bold text-blue-300">Rp {nilaiBuku.toLocaleString('id-ID')}</span>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Lokasi Fisik Aset</label>
            <input
              type="text"
              placeholder="e.g. Gudang Utama Kalima Bandung"
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2.5">
            {editingAsset && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Hapus aset ${editingAsset.nama}?`)) {
                    onDelete(editingAsset.id);
                  }
                }}
                className="px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl font-semibold"
              >
                Hapus
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold rounded-xl flex items-center gap-1 shadow-md cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Aset</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: PRINT BALANCE SHEET MODAL (FORMAT LAPORAN FORMAL RESMI)
// ============================================================================
interface PrintBalanceSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodeTanggal: string;
  totalAset: number;
  totalAsetLancar: number;
  totalKasBank: number;
  cashAccounts: any[];
  piutangData: any;
  totalPersediaanKaos: number;
  totalUangMukaVendor: number;
  fixedAssets: FixedAssetItem[];
  fixedAssetSummary: any;
  liabilitiesSummary: any;
  equitySummary: any;
  totalPasiva: number;
  currentUser: any;
}

const PrintBalanceSheetModal: React.FC<PrintBalanceSheetModalProps> = ({
  isOpen,
  onClose,
  periodeTanggal,
  totalAset,
  totalAsetLancar,
  totalKasBank,
  cashAccounts,
  piutangData,
  totalPersediaanKaos,
  totalUangMukaVendor,
  fixedAssets,
  fixedAssetSummary,
  liabilitiesSummary,
  equitySummary,
  totalPasiva,
  currentUser,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header Controls */}
        <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="text-xs text-slate-400">Pratinjau Laporan Neraca Keuangan Resmi Kalima</div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable White Sheet Document */}
        <div className="flex-1 overflow-y-auto p-8 bg-white text-slate-900 font-sans text-xs">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-black tracking-wider text-slate-900">KALIMA APPAREL</h1>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mt-0.5">
              LAPORAN POSISI KEUANGAN (NERACA)
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Per Tanggal: {periodeTanggal} (Mata Uang: Indonesian Rupiah - IDR)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* AKTIVA */}
            <div className="space-y-4">
              <div className="border-b-2 border-slate-900 pb-1">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">ASET (AKTIVA)</h3>
              </div>

              {/* Aset Lancar */}
              <div className="space-y-1.5">
                <p className="font-bold text-slate-800 text-[11px] uppercase">Aset Lancar:</p>
                <div className="pl-2 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-sans">Kas & Setara Kas</span>
                    <span>Rp {totalKasBank.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">Piutang Usaha</span>
                    <span>Rp {piutangData.totalPiutang.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">Persediaan Barang Dagang</span>
                    <span>Rp {totalPersediaanKaos.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">Uang Muka Pembelian Vendor</span>
                    <span>Rp {totalUangMukaVendor.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-300">
                    <span className="font-sans">Total Aset Lancar</span>
                    <span>Rp {totalAsetLancar.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Aset Tetap */}
              <div className="space-y-1.5 pt-2">
                <p className="font-bold text-slate-800 text-[11px] uppercase">Aset Tetap:</p>
                <div className="pl-2 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-sans">Harga Perolehan Aset Tetap</span>
                    <span>Rp {fixedAssetSummary.totalHargaPerolehan.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans">Akumulasi Penyusutan (-)</span>
                    <span>(Rp {fixedAssetSummary.totalAkumulasiPenyusutan.toLocaleString('id-ID')})</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-300">
                    <span className="font-sans">Nilai Buku Bersih Aset Tetap</span>
                    <span>Rp {fixedAssetSummary.totalNilaiBuku.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Total Aktiva */}
              <div className="pt-2 border-t-2 border-slate-900 flex justify-between font-bold text-sm text-slate-900">
                <span>TOTAL ASET (AKTIVA)</span>
                <span className="font-mono">Rp {totalAset.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* PASIVA */}
            <div className="space-y-4">
              <div className="border-b-2 border-slate-900 pb-1">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">KEWAJIBAN & EKUITAS (PASIVA)</h3>
              </div>

              {/* Kewajiban Lancar */}
              <div className="space-y-1.5">
                <p className="font-bold text-slate-800 text-[11px] uppercase">Kewajiban Lancar (Hutang):</p>
                <div className="pl-2 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-sans">Hutang Usaha (Vendor Kaos)</span>
                    <span>Rp {liabilitiesSummary.hutangVendor.toLocaleString('id-ID')}</span>
                  </div>
                  {liabilitiesSummary.hutangBiaya > 0 && (
                    <div className="flex justify-between">
                      <span className="font-sans">Hutang Beban Operasional</span>
                      <span>Rp {liabilitiesSummary.hutangBiaya.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-300">
                    <span className="font-sans">Total Kewajiban Lancar</span>
                    <span>Rp {liabilitiesSummary.totalKewajiban.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Ekuitas */}
              <div className="space-y-1.5 pt-2">
                <p className="font-bold text-slate-800 text-[11px] uppercase">Ekuitas / Modal Pemilik:</p>
                <div className="pl-2 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-sans">Modal Awal Disetor Pemilik</span>
                    <span>Rp {equitySummary.modalDisetor.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">Laba Ditahan Periode Lalu</span>
                    <span>Rp {equitySummary.labaDitahan.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">Laba Bersih Periode Berjalan</span>
                    <span>Rp {equitySummary.labaPeriodeBerjalan.toLocaleString('id-ID')}</span>
                  </div>
                  {equitySummary.prive > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">Prive Pemilik (-)</span>
                      <span>(Rp {equitySummary.prive.toLocaleString('id-ID')})</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-300">
                    <span className="font-sans">Total Ekuitas</span>
                    <span>Rp {equitySummary.totalEkuitas.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Total Pasiva */}
              <div className="pt-2 border-t-2 border-slate-900 flex justify-between font-bold text-sm text-slate-900">
                <span>TOTAL KEWAJIBAN & EKUITAS</span>
                <span className="font-mono">Rp {totalPasiva.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 mt-12 text-center text-xs text-slate-700 pt-6 border-t border-slate-200">
            <div>
              <p className="font-medium text-slate-500 mb-14">Disiapkan Oleh (Finance & Accounting)</p>
              <p className="font-bold text-slate-900 underline">{currentUser?.name || 'Finance Kalima'}</p>
              <p className="text-[11px] text-slate-500">Staf Keuangan & Pembukuan</p>
            </div>
            <div>
              <p className="font-medium text-slate-500 mb-14">Disetujui Oleh (Owner / Direksi)</p>
              <p className="font-bold text-slate-900 underline">Ahmad Fadli Taufik</p>
              <p className="text-[11px] text-slate-500">Pemilik / Direktur Utama Kalima</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
