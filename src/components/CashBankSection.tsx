import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Building2,
  Smartphone,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  AlertCircle,
  HelpCircle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CashAccount, CashAccountType, CashMutation, CashMutationType } from '../types';
import { BankReconciliationModal } from './BankReconciliationModal';

/** Jumlah baris buku kas yang ditampilkan sekaligus. */
const LEDGER_PAGE_SIZE = 25;

export const CashBankSection: React.FC = () => {
  const {
    cashAccounts,
    cashMutations,
    addCashAccount,
    updateCashAccount,
    deleteCashAccount,
    recordCashTransaction,
    transferCashAccount,
    isOwner,
  } = useApp();

  // Filter States
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [accountViewMode, setAccountViewMode] = useState<'both' | 'cards' | 'table'>('table');
  const [visibleMutationCount, setVisibleMutationCount] = useState(LEDGER_PAGE_SIZE);

  // Bank Reconciliation Modal
  const [isReconciliationOpen, setIsReconciliationOpen] = useState<boolean>(false);
  const [reconcileAccountId, setReconcileAccountId] = useState<string | undefined>(undefined);

  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<CashAccount | null>(null);
  const [accountForm, setAccountForm] = useState<{
    nama: string;
    tipe: CashAccountType;
    nomorRekening: string;
    atasNama: string;
    saldoAwal: number;
    warna: string;
    keterangan: string;
  }>({
    nama: '',
    tipe: 'bank',
    nomorRekening: '',
    atasNama: '',
    saldoAwal: 0,
    warna: 'blue',
    keterangan: '',
  });

  // Modal Kas Masuk / Keluar
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false);
  const [trxType, setTrxType] = useState<'masuk' | 'keluar'>('masuk');
  const [trxAccountId, setTrxAccountId] = useState<string>('');
  const [trxJumlah, setTrxJumlah] = useState<number>(0);
  const [trxKategori, setTrxKategori] = useState<string>('Penjualan Tunai / COD');
  const [trxDeskripsi, setTrxDeskripsi] = useState<string>('');
  const [trxReferensi, setTrxReferensi] = useState<string>('');
  const [trxTanggal, setTrxTanggal] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Modal Transfer Antar Akun
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferFromId, setTransferFromId] = useState<string>('');
  const [transferToId, setTransferToId] = useState<string>('');
  const [transferJumlah, setTransferJumlah] = useState<number>(0);
  const [transferDeskripsi, setTransferDeskripsi] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');

  // Delete confirmation
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  // Summary Computations
  const totalLikuiditas = useMemo(() => {
    return cashAccounts.reduce((sum, acc) => sum + (acc.saldo || 0), 0);
  }, [cashAccounts]);

  const totalKasTunai = useMemo(() => {
    return cashAccounts
      .filter((a) => a.tipe === 'tunai')
      .reduce((sum, acc) => sum + (acc.saldo || 0), 0);
  }, [cashAccounts]);

  const totalBank = useMemo(() => {
    return cashAccounts
      .filter((a) => a.tipe === 'bank')
      .reduce((sum, acc) => sum + (acc.saldo || 0), 0);
  }, [cashAccounts]);

  const totalEWallet = useMemo(() => {
    return cashAccounts
      .filter((a) => a.tipe === 'e-wallet')
      .reduce((sum, acc) => sum + (acc.saldo || 0), 0);
  }, [cashAccounts]);

  // Current Month Inflow & Outflow
  const todayMonth = new Date().toISOString().substring(0, 7);
  const monthMutations = useMemo(() => {
    return cashMutations.filter((m) => m.tanggal.startsWith(todayMonth));
  }, [cashMutations, todayMonth]);

  const totalMasukBulanIni = useMemo(() => {
    return monthMutations
      .filter((m) => m.tipe === 'masuk')
      .reduce((sum, m) => sum + m.jumlah, 0);
  }, [monthMutations]);

  const totalKeluarBulanIni = useMemo(() => {
    return monthMutations
      .filter((m) => m.tipe === 'keluar')
      .reduce((sum, m) => sum + m.jumlah, 0);
  }, [monthMutations]);

  // Filtered Mutations
  const filteredMutations = useMemo(() => {
    return cashMutations.filter((m) => {
      if (selectedAccountId !== 'all' && m.accountId !== selectedAccountId) {
        return false;
      }
      if (selectedType !== 'all' && m.tipe !== selectedType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = m.deskripsi.toLowerCase().includes(q);
        const matchKat = m.kategori.toLowerCase().includes(q);
        const matchRef = m.referensi?.toLowerCase().includes(q) || false;
        const matchAcc = m.accountNama.toLowerCase().includes(q);
        if (!matchDesc && !matchKat && !matchRef && !matchAcc) return false;
      }
      return true;
    });
  }, [cashMutations, selectedAccountId, selectedType, searchQuery]);

  // Handler Copy Rekening
  const handleCopyRekening = (acc: CashAccount) => {
    const textToCopy = `${acc.nama}\nNo. Rek: ${acc.nomorRekening || '-'}\na/n: ${acc.atasNama || '-'}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(acc.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Modal Tambah Akun
  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    setAccountForm({
      nama: '',
      tipe: 'bank',
      nomorRekening: '',
      atasNama: '',
      saldoAwal: 0,
      warna: 'blue',
      keterangan: '',
    });
    setIsAccountModalOpen(true);
  };

  // Open Modal Edit Akun
  const handleOpenEditAccount = (acc: CashAccount) => {
    setEditingAccount(acc);
    setAccountForm({
      nama: acc.nama,
      tipe: acc.tipe,
      nomorRekening: acc.nomorRekening || '',
      atasNama: acc.atasNama || '',
      saldoAwal: acc.saldoAwal,
      warna: acc.warna || 'blue',
      keterangan: acc.keterangan || '',
    });
    setIsAccountModalOpen(true);
  };

  // Save Akun
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.nama.trim()) return;

    if (editingAccount) {
      updateCashAccount(editingAccount.id, {
        nama: accountForm.nama.trim(),
        tipe: accountForm.tipe,
        nomorRekening: accountForm.nomorRekening.trim(),
        atasNama: accountForm.atasNama.trim(),
        warna: accountForm.warna,
        keterangan: accountForm.keterangan.trim(),
      });
    } else {
      addCashAccount({
        nama: accountForm.nama.trim(),
        tipe: accountForm.tipe,
        nomorRekening: accountForm.nomorRekening.trim(),
        atasNama: accountForm.atasNama.trim(),
        saldoAwal: Number(accountForm.saldoAwal) || 0,
        warna: accountForm.warna,
        keterangan: accountForm.keterangan.trim(),
      });
    }
    setIsAccountModalOpen(false);
  };

  // Open Quick Trx Modal
  const handleOpenTrx = (type: 'masuk' | 'keluar', accountId?: string) => {
    setTrxType(type);
    setTrxAccountId(accountId || (cashAccounts[0]?.id ?? ''));
    setTrxJumlah(0);
    setTrxKategori(type === 'masuk' ? 'Penjualan Tunai / COD' : 'Operasional Harian');
    setTrxDeskripsi('');
    setTrxReferensi('');
    setTrxTanggal(new Date().toISOString().split('T')[0]);
    setIsTransactionModalOpen(true);
  };

  // Save Quick Trx
  const handleSaveTrx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxAccountId || trxJumlah <= 0) return;

    recordCashTransaction({
      accountId: trxAccountId,
      tipe: trxType,
      jumlah: trxJumlah,
      kategori: trxKategori,
      deskripsi: trxDeskripsi.trim() || trxKategori,
      referensi: trxReferensi.trim() || undefined,
      tanggal: trxTanggal,
    });

    setIsTransactionModalOpen(false);
  };

  // Open Transfer Modal
  const handleOpenTransfer = (fromId?: string) => {
    const defaultFrom = fromId || cashAccounts[0]?.id || '';
    const defaultTo = cashAccounts.find((a) => a.id !== defaultFrom)?.id || '';
    setTransferFromId(defaultFrom);
    setTransferToId(defaultTo);
    setTransferJumlah(0);
    setTransferDeskripsi('');
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  // Save Transfer
  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');

    if (!transferFromId || !transferToId) {
      setTransferError('Pilih akun sumber dan akun tujuan transfer.');
      return;
    }
    if (transferFromId === transferToId) {
      setTransferError('Akun sumber dan akun tujuan tidak boleh sama.');
      return;
    }
    if (transferJumlah <= 0) {
      setTransferError('Nominal transfer harus lebih besar dari 0.');
      return;
    }

    const sourceAcc = cashAccounts.find((a) => a.id === transferFromId);
    if (sourceAcc && sourceAcc.saldo < transferJumlah) {
      setTransferError(
        `Saldo ${sourceAcc.nama} tidak mencukupi (Tersedia: Rp ${sourceAcc.saldo.toLocaleString('id-ID')}).`
      );
      return;
    }

    const res = transferCashAccount({
      fromAccountId: transferFromId,
      toAccountId: transferToId,
      jumlah: transferJumlah,
      deskripsi: transferDeskripsi.trim(),
    });

    if (res.success) {
      setIsTransferModalOpen(false);
    } else {
      setTransferError(res.error || 'Gagal memproses transfer');
    }
  };

  // Export CSV Mutasi
  const handleExportCSV = () => {
    const headers = ['ID', 'Tanggal', 'Waktu', 'Akun', 'Tipe', 'Kategori', 'Deskripsi', 'Referensi', 'Jumlah (Rp)', 'Saldo Setelahnya (Rp)', 'Dicatat Oleh'];
    const rows = filteredMutations.map((m) => [
      m.id,
      m.tanggal,
      m.waktu || '-',
      `"${m.accountNama}"`,
      m.tipe.toUpperCase(),
      `"${m.kategori}"`,
      `"${m.deskripsi.replace(/"/g, '""')}"`,
      `"${m.referensi || '-'}"`,
      m.jumlah,
      m.saldoSetelah,
      `"${m.dicatatOleh}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `buku_kas_bank_kalima_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for color styles of account cards
  const getAccountTheme = (warna?: string, tipe?: CashAccountType) => {
    switch (warna) {
      case 'emerald':
        return {
          border: 'border-emerald-500/40 hover:border-emerald-500/80',
          bg: 'from-emerald-950/40 to-slate-900/90',
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          accent: 'text-emerald-400',
          gradientText: 'from-emerald-400 to-teal-300',
        };
      case 'blue':
        return {
          border: 'border-blue-500/40 hover:border-blue-500/80',
          bg: 'from-blue-950/40 to-slate-900/90',
          badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          accent: 'text-blue-400',
          gradientText: 'from-blue-400 to-cyan-300',
        };
      case 'amber':
        return {
          border: 'border-amber-500/40 hover:border-amber-500/80',
          bg: 'from-amber-950/40 to-slate-900/90',
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          accent: 'text-amber-400',
          gradientText: 'from-amber-400 to-yellow-300',
        };
      case 'teal':
        return {
          border: 'border-teal-500/40 hover:border-teal-500/80',
          bg: 'from-teal-950/40 to-slate-900/90',
          badge: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
          accent: 'text-teal-400',
          gradientText: 'from-teal-400 to-emerald-300',
        };
      case 'purple':
        return {
          border: 'border-purple-500/40 hover:border-purple-500/80',
          bg: 'from-purple-950/40 to-slate-900/90',
          badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          accent: 'text-purple-400',
          gradientText: 'from-purple-400 to-pink-300',
        };
      default:
        return {
          border: 'border-slate-700 hover:border-slate-500',
          bg: 'from-slate-900 to-slate-950',
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          accent: 'text-slate-300',
          gradientText: 'from-white to-slate-400',
        };
    }
  };

  const getTypeIcon = (tipe: CashAccountType) => {
    switch (tipe) {
      case 'tunai':
        return <Wallet className="w-4 h-4 text-emerald-400" />;
      case 'bank':
        return <Building2 className="w-4 h-4 text-blue-400" />;
      case 'e-wallet':
        return <Smartphone className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Manajemen Kas & Rekening Bank
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pantau saldo kas tunai toko, rekening bank operasional, mutasi buku kas, dan pemindahan saldo real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleOpenTrx('masuk')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2.5 rounded-full text-xs shadow-sm transition-all cursor-pointer"
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>+ Kas Masuk</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenTrx('keluar')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold px-3.5 py-2.5 rounded-full text-xs shadow-sm transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>- Kas Keluar</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenTransfer()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2.5 rounded-full text-xs shadow-sm transition-all cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>⇄ Pindah Saldo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReconcileAccountId(selectedAccountId !== 'all' ? selectedAccountId : undefined);
              setIsReconciliationOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-full text-xs shadow-sm transition-all cursor-pointer"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Rekonsiliasi Bank</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddAccount}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold px-4 py-2.5 rounded-full text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Tambah Akun</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Likuiditas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-rose-500" />
              Total Likuiditas
            </span>
            <span className="text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-mono font-bold">
              {cashAccounts.length} Akun
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight mt-1">
            Rp {totalLikuiditas.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Seluruh kas tunai, bank & e-wallet
          </div>
        </div>

        {/* Kas Tunai Fisik */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              Kas Tunai Fisik
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
              Laci Kasir
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono tracking-tight mt-1">
            Rp {totalKasTunai.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Uang fisik di kasir toko & COD
          </div>
        </div>

        {/* Rekening Bank */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Saldo Rekening Bank
            </span>
            <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
              BCA, Mandiri, BSI
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-600 font-mono tracking-tight mt-1">
            Rp {totalBank.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Rekening operasional & transfer mitra
          </div>
        </div>

        {/* Arus Kas Bulan Ini */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
              Arus Kas Bulan Ini
            </span>
            <span className="text-[11px] text-slate-400 font-mono font-bold">{todayMonth}</span>
          </div>
          <div className="flex items-center justify-between mt-1 pt-1">
            <div className="text-xs">
              <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
                <ArrowDownRight className="w-3 h-3" /> Masuk
              </div>
              <div className="font-black text-slate-900 font-mono text-sm">
                Rp {totalMasukBulanIni.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="text-xs text-right">
              <div className="text-[11px] text-rose-600 font-bold flex items-center justify-end gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> Keluar
              </div>
              <div className="font-black text-slate-900 font-mono text-sm">
                Rp {totalKeluarBulanIni.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Visual Grid of Cash & Bank Accounts */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Daftar Akun Kas & Bank Aktif</span>
              <span className="text-xs font-bold text-rose-600 font-mono">({cashAccounts.length} Akun Terdaftar)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Saldo masing-masing akun ter-update secara real-time dari seluruh transaksi penjualan, pelunasan, dan beban operasional.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="segmented-pill-bar flex items-center gap-1 bg-slate-100/80">
              <button
                type="button"
                onClick={() => setAccountViewMode('both')}
                className={`px-3 py-1.5 text-xs rounded-full font-bold cursor-pointer transition-colors ${
                  accountViewMode === 'both'
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setAccountViewMode('cards')}
                className={`px-3 py-1.5 text-xs rounded-full font-bold cursor-pointer transition-colors ${
                  accountViewMode === 'cards'
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Kartu Visual
              </button>
              <button
                type="button"
                onClick={() => setAccountViewMode('table')}
                className={`px-3 py-1.5 text-xs rounded-full font-bold cursor-pointer transition-colors ${
                  accountViewMode === 'table'
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Tabel Rincian
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenAddAccount}
              className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold px-3.5 py-2 rounded-full text-xs transition-colors cursor-pointer ml-auto sm:ml-0 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tambah Akun</span>
            </button>
          </div>
        </div>

        {/* Visual Cards View */}
        {accountViewMode !== 'table' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cashAccounts.map((acc) => {
              const theme = getAccountTheme(acc.warna, acc.tipe);
              const isCopied = copiedId === acc.id;

              return (
                <div
                  key={acc.id}
                  className={`bg-white dark:bg-gradient-to-br ${theme.bg} rounded-2xl p-5 border border-slate-200 dark:${theme.border} transition-all duration-200 shadow-xs dark:shadow-lg relative flex flex-col justify-between group`}
                >
                  {/* Card Top: Type badge & Menu Actions */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 shrink-0">
                        {getTypeIcon(acc.tipe)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-1.5">
                          <span>{acc.nama}</span>
                          {acc.isDefault && (
                            <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded font-normal">
                              Utama
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                          {acc.tipe === 'tunai'
                            ? 'Kas Tunai / Kasir'
                            : acc.tipe === 'bank'
                            ? 'Rekening Bank'
                            : 'E-Wallet / Platform'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        title="Edit Akun" aria-label="Edit Akun"
                        onClick={() => handleOpenEditAccount(acc)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!acc.isDefault && cashAccounts.length > 1 && (
                        <button
                          type="button"
                          title="Hapus Akun" aria-label="Hapus Akun"
                          onClick={() => setDeletingAccountId(acc.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Middle: Account Number & Atas Nama */}
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 mb-4 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-xs text-slate-400">No. Rekening / ID:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyRekening(acc)}
                        className="flex items-center gap-1 text-xs font-mono font-bold text-white hover:text-amber-400 transition-colors cursor-pointer"
                      >
                        <span>{acc.nomorRekening || '-'}</span>
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                    </div>
                    {acc.atasNama && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Atas Nama:</span>
                        <span className="text-slate-200 font-medium truncate max-w-[180px]">
                          {acc.atasNama}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Balance */}
                  <div className="mb-4">
                    <div className="text-[11px] text-slate-400 uppercase font-semibold">
                      Saldo Real-Time
                    </div>
                    <div className="text-2xl font-black font-mono text-white tracking-tight mt-0.5">
                      Rp {acc.saldo.toLocaleString('id-ID')}
                    </div>
                    {acc.keterangan && (
                      <div className="text-[11px] text-slate-400 italic mt-0.5 truncate">
                        {acc.keterangan}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Quick Actions */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-800/80 text-xs">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenTrx('masuk', acc.id)}
                        className="flex items-center justify-center gap-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Masuk</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenTrx('keluar', acc.id)}
                        className="flex items-center justify-center gap-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold rounded-lg border border-rose-500/20 transition-colors cursor-pointer"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        <span>Keluar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenTransfer(acc.id)}
                        className="flex items-center justify-center gap-1 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-semibold rounded-lg border border-blue-500/20 transition-colors cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Transfer</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReconcileAccountId(acc.id);
                        setIsReconciliationOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-semibold rounded-lg border border-indigo-500/20 transition-colors cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Rekonsiliasi Bank Ini</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Real-Time Balance Details Table */}
        {accountViewMode !== 'cards' && (
          <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>Rincian Saldo Real-Time Seluruh Rekening & Kas Tunai</span>
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                Total Likuiditas: <strong className="text-amber-400 font-bold">Rp {totalLikuiditas.toLocaleString('id-ID')}</strong>
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Akun & Tipe</th>
                    <th className="py-2.5 px-3">Nomor Rekening / ID</th>
                    <th className="py-2.5 px-3">Atas Nama</th>
                    <th className="py-2.5 px-3 text-right">Saldo Real-Time</th>
                    <th className="py-2.5 px-3 text-center">Porsi Likuiditas</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3 text-center">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {cashAccounts.map((acc) => {
                    const percent = totalLikuiditas > 0 ? ((acc.saldo / totalLikuiditas) * 100).toFixed(1) : '0';
                    const isCopied = copiedId === acc.id;

                    return (
                      <tr key={acc.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-slate-900 border border-slate-700 shrink-0">
                              {getTypeIcon(acc.tipe)}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1">
                                <span>{acc.nama}</span>
                                {acc.isDefault && (
                                  <span className="text-[11px] bg-amber-500/20 text-amber-300 px-1 rounded font-normal">
                                    Utama
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 uppercase font-semibold">
                                {acc.tipe}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-200">
                          <button
                            type="button"
                            onClick={() => handleCopyRekening(acc)}
                            className="flex items-center gap-1 hover:text-amber-400 transition-colors cursor-pointer"
                            title="Salin No. Rekening" aria-label="Salin No. Rekening"
                          >
                            <span>{acc.nomorRekening || '-'}</span>
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-500" />
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-medium">
                          {acc.atasNama || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white text-sm">
                          Rp {acc.saldo.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.min(100, Number(percent))}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs text-slate-400">{percent}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-400 max-w-xs truncate">
                          {acc.keterangan || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenTrx('masuk', acc.id)}
                              className="px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-[11px] font-bold rounded border border-emerald-500/30 cursor-pointer"
                              title="Catat Kas Masuk" aria-label="Catat Kas Masuk"
                            >
                              + Masuk
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenTrx('keluar', acc.id)}
                              className="px-2 py-0.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 text-[11px] font-bold rounded border border-rose-500/30 cursor-pointer"
                              title="Catat Kas Keluar" aria-label="Catat Kas Keluar"
                            >
                              - Keluar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenTransfer(acc.id)}
                              className="px-2 py-0.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[11px] font-bold rounded border border-blue-500/30 cursor-pointer"
                              title="Pindah Saldo" aria-label="Pindah Saldo"
                            >
                              ⇄ Trf
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditAccount(acc)}
                              className="p-1 text-slate-400 hover:text-white rounded"
                              title="Edit Akun" aria-label="Edit Akun"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. Buku Kas & Riwayat Mutasi (Ledger) */}
      <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              Buku Kas & Riwayat Mutasi Rekening
            </h3>
            <p className="text-xs text-slate-400">
              Menampilkan {filteredMutations.length} catatan mutasi kas masuk, keluar, dan transfer
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari keterangan, ref..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Filter Akun */}
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white cursor-pointer font-medium"
            >
              <option value="all">Semua Akun ({cashAccounts.length})</option>
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nama}
                </option>
              ))}
            </select>

            {/* Filter Tipe */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white cursor-pointer font-medium"
            >
              <option value="all">Semua Tipe</option>
              <option value="masuk">Kas Masuk (+)</option>
              <option value="keluar">Kas Keluar (-)</option>
              <option value="transfer">Pindah Saldo (⇄)</option>
            </select>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Table of Mutations */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Tgl & Jam</th>
                <th className="py-2.5 px-3">Akun Kas / Bank</th>
                <th className="py-2.5 px-3">Tipe</th>
                <th className="py-2.5 px-3">Kategori & Keterangan</th>
                <th className="py-2.5 px-3">Referensi</th>
                <th className="py-2.5 px-3 text-right">Nominal</th>
                <th className="py-2.5 px-3 text-right">Saldo Setelahnya</th>
                <th className="py-2.5 px-3">Pencatat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredMutations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                    Tidak ada transaksi mutasi kas/bank yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredMutations.slice(0, visibleMutationCount).map((m) => {
                  const isMasuk = m.tipe === 'masuk';
                  const isKeluar = m.tipe === 'keluar';
                  const isTransfer = m.tipe === 'transfer';

                  return (
                    <tr key={m.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                        <div>{m.tanggal}</div>
                        <div className="text-[11px] text-slate-500">{m.waktu || '12:00'}</div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
                        {m.accountNama}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isMasuk && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <ArrowDownRight className="w-3 h-3" /> MASUK
                          </span>
                        )}
                        {isKeluar && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <ArrowUpRight className="w-3 h-3" /> KELUAR
                          </span>
                        )}
                        {isTransfer && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            <ArrowRightLeft className="w-3 h-3" /> PINDAH SALDO
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <div className="font-semibold text-slate-200">{m.deskripsi}</div>
                        <div className="text-[11px] text-slate-400">
                          {m.kategori}
                          {m.targetAccountNama && (
                            <span className="text-blue-300"> → Ke: {m.targetAccountNama}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs font-mono text-slate-400 whitespace-nowrap">
                        {m.referensi || '-'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap text-xs ${
                          isMasuk ? 'text-emerald-400' : isKeluar ? 'text-rose-400' : 'text-blue-400'
                        }`}
                      >
                        {isMasuk ? '+' : isKeluar ? '-' : ''} Rp {m.jumlah.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                        Rp {m.saldoSetelah.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-400 whitespace-nowrap">
                        {m.dicatatOleh}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredMutations.length > visibleMutationCount && (
          <div className="pt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleMutationCount((count) => count + LEDGER_PAGE_SIZE)}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Tampilkan {Math.min(LEDGER_PAGE_SIZE, filteredMutations.length - visibleMutationCount)} lagi ({visibleMutationCount} dari {filteredMutations.length})
            </button>
          </div>
        )}
      </div>

      {/* MODAL 1: Tambah / Edit Akun Kas & Bank */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#121620] border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                {editingAccount ? 'Edit Akun Kas / Bank' : 'Tambah Akun Kas & Bank Baru'}
              </h3>
              <button aria-label="Tutup" data-modal-close
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3.5">
              {/* Quick Templates / Presets */}
              {!editingAccount && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                  <label className="block text-slate-400 font-semibold text-xs">
                    Pilih Cepat Template Rekening / Kas:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Kas Tunai Toko', nama: 'Kas Tunai Toko & Kasir', tipe: 'tunai', warna: 'emerald', rek: 'Petty Cash Toko', an: 'Kasir Toko' },
                      { label: 'Bank BCA Bisnis', nama: 'Bank BCA Bisnis', tipe: 'bank', warna: 'blue', rek: '', an: 'CV Kalima Apparel' },
                      { label: 'Bank Mandiri', nama: 'Bank Mandiri Operasional', tipe: 'bank', warna: 'amber', rek: '', an: 'CV Kalima Apparel' },
                      { label: 'Bank BRI', nama: 'Bank BRI Bisnis', tipe: 'bank', warna: 'blue', rek: '', an: 'CV Kalima Apparel' },
                      { label: 'Bank BNI', nama: 'Bank BNI', tipe: 'bank', warna: 'teal', rek: '', an: 'CV Kalima Apparel' },
                      { label: 'Bank BSI', nama: 'Bank BSI Syariah', tipe: 'bank', warna: 'teal', rek: '', an: 'Kalima Fashion' },
                      { label: 'QRIS / E-Wallet', nama: 'QRIS & Saldo Marketplace', tipe: 'e-wallet', warna: 'purple', rek: 'Merchant ID: KLM-QR', an: 'Kalima Store' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setAccountForm((prev) => ({
                            ...prev,
                            nama: preset.nama,
                            tipe: preset.tipe as CashAccountType,
                            warna: preset.warna,
                            nomorRekening: preset.rek || prev.nomorRekening,
                            atasNama: preset.an || prev.atasNama,
                          }))
                        }
                        className="px-2 py-1 bg-slate-900 hover:bg-amber-500/20 hover:text-amber-300 text-slate-300 border border-slate-700/80 hover:border-amber-500/40 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Nama Akun / Rekening *
                </label>
                <input
                  type="text"
                  required
                  value={accountForm.nama}
                  onChange={(e) => setAccountForm({ ...accountForm, nama: e.target.value })}
                  placeholder="Contoh: Bank BCA Bisnis, Kas Toko Cabang 2, dll."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tipe Akun</label>
                  <select
                    value={accountForm.tipe}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        tipe: e.target.value as CashAccountType,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="bank">Rekening Bank</option>
                    <option value="tunai">Kas Tunai (Fisik/Petty Cash)</option>
                    <option value="e-wallet">E-Wallet / QRIS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Warna Aksen</label>
                  <select
                    value={accountForm.warna}
                    onChange={(e) => setAccountForm({ ...accountForm, warna: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="blue">Biru (Bank BCA/Mandiri)</option>
                    <option value="emerald">Hijau Emerald (Kas Tunai)</option>
                    <option value="amber">Amber Gold (Operasional)</option>
                    <option value="teal">Teal (BSI / Syariah)</option>
                    <option value="purple">Ungu (QRIS / E-Wallet)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Nomor Rekening / ID Kasir
                </label>
                <input
                  type="text"
                  value={accountForm.nomorRekening}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, nomorRekening: e.target.value })
                  }
                  placeholder="Contoh: 8020-9988-77 atau Laci Kasir Utama"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Atas Nama Rekening
                </label>
                <input
                  type="text"
                  value={accountForm.atasNama}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, atasNama: e.target.value })
                  }
                  placeholder="Contoh: CV Kalima Apparel / Ahmad Fadli"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {!editingAccount && (
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Saldo Awal (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={accountForm.saldoAwal || ''}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        saldoAwal: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm"
                  />
                  <span className="text-[11px] text-slate-400">
                    Saldo awal saat akun pertama kali dicatat ke pembukuan
                  </span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Keterangan / Catatan</label>
                <input
                  type="text"
                  value={accountForm.keterangan}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, keterangan: e.target.value })
                  }
                  placeholder="Contoh: Digunakan untuk transaksi offline & kasir toko"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  {editingAccount ? 'Simpan Perubahan' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Catat Kas Masuk / Kas Keluar */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#121620] border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {trxType === 'masuk' ? (
                  <>
                    <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                    <span>Catat Kas Masuk (Pemasukan)</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-rose-400" />
                    <span>Catat Kas Keluar (Pengeluaran Langsung)</span>
                  </>
                )}
              </h3>
              <button aria-label="Tutup" data-modal-close
                type="button"
                onClick={() => setIsTransactionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveTrx} className="space-y-3.5">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  {trxType === 'masuk' ? 'Akun Tujuan Penerimaan *' : 'Bayar Dari Akun *'}
                </label>
                <select
                  value={trxAccountId}
                  onChange={(e) => setTrxAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama} (Saldo: Rp {a.saldo.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Nominal Transaksi (Rp) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={trxJumlah || ''}
                  onChange={(e) => setTrxJumlah(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Kategori</label>
                  <select
                    value={trxKategori}
                    onChange={(e) => setTrxKategori(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    {trxType === 'masuk' ? (
                      <>
                        <option value="Penjualan Tunai / COD">Penjualan Tunai / COD</option>
                        <option value="Setoran Modal / Investor">Setoran Modal / Investor</option>
                        <option value="Pendapatan Jasa / Lain-lain">Pendapatan Lain-lain</option>
                        <option value="Penerimaan Piutang">Penerimaan Piutang</option>
                        <option value="Pengembalian Dana / Refund">Pengembalian Dana</option>
                      </>
                    ) : (
                      <>
                        <option value="Operasional Harian">Operasional Harian Toko</option>
                        <option value="Transport / BBM / Parkir">Transport / BBM / Logistik</option>
                        <option value="Konsumsi & Pantry Tim">Konsumsi & Pantry Tim</option>
                        <option value="Biaya Admin Bank / Pajak">Biaya Admin Bank / Transfer</option>
                        <option value="Perlengkapan Toko">Perlengkapan Toko / Kasir</option>
                        <option value="Pengeluaran Lain-lain">Pengeluaran Lain-lain</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tanggal</label>
                  <input
                    type="date"
                    value={trxTanggal}
                    onChange={(e) => setTrxTanggal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Deskripsi / Keterangan *
                </label>
                <input
                  type="text"
                  required
                  value={trxDeskripsi}
                  onChange={(e) => setTrxDeskripsi(e.target.value)}
                  placeholder={
                    trxType === 'masuk'
                      ? 'Contoh: Setoran uang hasil penjualan offline bazaar'
                      : 'Contoh: Beli bensin motor kurir pengiriman darurat'
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  No. Bukti / Referensi (Opsional)
                </label>
                <input
                  type="text"
                  value={trxReferensi}
                  onChange={(e) => setTrxReferensi(e.target.value)}
                  placeholder="Contoh: Nota #0192, Resi #JNE123, Bukti Transfer"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 font-bold rounded-xl text-white ${
                    trxType === 'masuk'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {trxType === 'masuk' ? 'Simpan Kas Masuk' : 'Simpan Kas Keluar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Pindah Saldo / Transfer Antar Akun */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#121620] border border-blue-500/40 rounded-2xl p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                <span>Pindah Saldo (Transfer Antar Kas & Bank)</span>
              </h3>
              <button aria-label="Tutup" data-modal-close
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTransfer} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Dari Akun Sumber *
                  </label>
                  <select
                    value={transferFromId}
                    onChange={(e) => setTransferFromId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  >
                    {cashAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nama} (Rp {a.saldo.toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Ke Akun Tujuan *
                  </label>
                  <select
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  >
                    {cashAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Nominal yang Dipindahkan (Rp) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferJumlah || ''}
                  onChange={(e) => setTransferJumlah(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Keterangan Pindah Saldo
                </label>
                <input
                  type="text"
                  value={transferDeskripsi}
                  onChange={(e) => setTransferDeskripsi(e.target.value)}
                  placeholder="Contoh: Tarik tunai dari BCA untuk modal kasir / Setor tunai ke rekening"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl text-white cursor-pointer"
                >
                  Proses Pindah Saldo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Konfirmasi Hapus Akun */}
      {deletingAccountId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#121620] border border-rose-500/40 rounded-2xl p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Hapus Akun Ini?</h3>
                <p className="text-xs text-slate-400">Akun tidak dapat dikembalikan setelah dihapus</p>
              </div>
            </div>

            <p className="text-slate-300">
              Pastikan Anda telah memindahkan saldo tersisa ke rekening atau kas lain sebelum menghapus akun ini.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAccountId(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCashAccount(deletingAccountId);
                  setDeletingAccountId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl"
              >
                Ya, Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rekonsiliasi Bank */}
      <BankReconciliationModal
        isOpen={isReconciliationOpen}
        onClose={() => setIsReconciliationOpen(false)}
        preSelectedAccountId={reconcileAccountId}
      />
    </div>
  );
};
