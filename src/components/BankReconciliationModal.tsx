import React, { useState, useMemo } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  Sparkles,
  ClipboardCheck,
  FileText,
  DollarSign,
  ChevronRight,
  History,
  RotateCcw,
  CheckCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CashAccount, CashMutation, BankReconciliationSession } from '../types';

interface BankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedAccountId?: string;
}

export const BankReconciliationModal: React.FC<BankReconciliationModalProps> = ({
  isOpen,
  onClose,
  preSelectedAccountId,
}) => {
  const {
    cashAccounts,
    cashMutations,
    bankReconciliations,
    saveBankReconciliationSession,
    deleteBankReconciliationSession,
    recordCashTransaction,
    currentUser,
    isOwner,
  } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStart = `${todayStr.substring(0, 7)}-01`;

  // Active View Tab: 'new_reconcile' | 'history'
  const [activeTab, setActiveTab] = useState<'new_reconcile' | 'history'>('new_reconcile');

  // Account & Period Selection
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (preSelectedAccountId) return preSelectedAccountId;
    const defaultBank = cashAccounts.find((a) => a.tipe === 'bank') || cashAccounts[0];
    return defaultBank?.id || '';
  });

  const [startDate, setStartDate] = useState<string>(currentMonthStart);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Bank Statement Balance input by user
  const selectedAccount = useMemo(() => {
    return cashAccounts.find((a) => a.id === selectedAccountId) || cashAccounts[0];
  }, [cashAccounts, selectedAccountId]);

  const [bankStatementBalance, setBankStatementBalance] = useState<number>(() => {
    return selectedAccount?.saldo || 0;
  });

  // Keep bankStatementBalance in sync when account changes if untouched
  const handleAccountChange = (newAccId: string) => {
    setSelectedAccountId(newAccId);
    const acc = cashAccounts.find((a) => a.id === newAccId);
    if (acc) {
      setBankStatementBalance(acc.saldo);
      setSelectedMutationIds(new Set());
    }
  };

  // Filter mutations for this account and date range
  const accountMutations = useMemo(() => {
    if (!selectedAccountId) return [];
    return cashMutations.filter((m) => {
      if (m.accountId !== selectedAccountId) return false;
      if (m.tanggal < startDate || m.tanggal > endDate) return false;
      return true;
    });
  }, [cashMutations, selectedAccountId, startDate, endDate]);

  // Selected (Matched/Cleared) Mutation IDs in the current session
  const [selectedMutationIds, setSelectedMutationIds] = useState<Set<string>>(() => {
    const matched = new Set<string>();
    accountMutations.forEach((m) => {
      if (m.isReconciled) matched.add(m.id);
    });
    return matched;
  });

  // Smart text import / parser modal
  const [isSmartParserOpen, setIsSmartParserOpen] = useState(false);
  const [statementRawText, setStatementRawText] = useState('');
  const [parserFeedback, setParserFeedback] = useState<string | null>(null);

  // Filter status in table: 'all' | 'unreconciled' | 'matched'
  const [filterCleared, setFilterCleared] = useState<'all' | 'unreconciled' | 'matched'>('all');
  const [searchMutationQuery, setSearchMutationQuery] = useState('');

  // Quick action modal state (Admin fee / Interest)
  const [isQuickActionModalOpen, setIsQuickActionModalOpen] = useState(false);
  const [quickActionType, setQuickActionType] = useState<'admin_fee' | 'interest' | 'adjustment'>('admin_fee');
  const [quickActionAmount, setQuickActionAmount] = useState<number>(15000);
  const [quickActionDesc, setQuickActionDesc] = useState<string>('Biaya Administrasi Bulanan Bank');
  const [quickActionDate, setQuickActionDate] = useState<string>(todayStr);

  // Session Note
  const [sessionNotes, setSessionNotes] = useState<string>('');

  // Success banner / modal
  const [lastSavedSession, setLastSavedSession] = useState<BankReconciliationSession | null>(null);

  // Detail Modal for Historical Session
  const [viewingHistorySession, setViewingHistorySession] = useState<BankReconciliationSession | null>(null);

  // Calculations
  const systemClosingBalance = selectedAccount?.saldo || 0;

  // Calculate sum of cleared/matched items
  const matchedMutationsList = useMemo(() => {
    return accountMutations.filter((m) => selectedMutationIds.has(m.id));
  }, [accountMutations, selectedMutationIds]);

  const totalMasukCleared = useMemo(() => {
    return matchedMutationsList.filter((m) => m.tipe === 'masuk').reduce((sum, m) => sum + m.jumlah, 0);
  }, [matchedMutationsList]);

  const totalKeluarCleared = useMemo(() => {
    return matchedMutationsList.filter((m) => m.tipe === 'keluar' || m.tipe === 'transfer').reduce((sum, m) => sum + m.jumlah, 0);
  }, [matchedMutationsList]);

  // Discrepancy (Selisih)
  const selisih = systemClosingBalance - bankStatementBalance;
  const isBalanced = Math.abs(selisih) === 0;

  // Filtered displayed mutations in table
  const displayedMutations = useMemo(() => {
    return accountMutations.filter((m) => {
      const isMatched = selectedMutationIds.has(m.id);
      if (filterCleared === 'matched' && !isMatched) return false;
      if (filterCleared === 'unreconciled' && isMatched) return false;

      if (searchMutationQuery.trim()) {
        const q = searchMutationQuery.toLowerCase();
        const matchDesc = m.deskripsi.toLowerCase().includes(q);
        const matchKat = m.kategori.toLowerCase().includes(q);
        const matchRef = m.referensi?.toLowerCase().includes(q) || false;
        if (!matchDesc && !matchKat && !matchRef) return false;
      }
      return true;
    });
  }, [accountMutations, selectedMutationIds, filterCleared, searchMutationQuery]);

  // Toggle single mutation
  const toggleMutation = (id: string) => {
    setSelectedMutationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Match All
  const handleMatchAll = () => {
    const allIds = new Set(accountMutations.map((m) => m.id));
    setSelectedMutationIds(allIds);
  };

  // Clear All
  const handleClearAll = () => {
    setSelectedMutationIds(new Set());
  };

  // Save Reconciliation Session
  const handleSaveSession = () => {
    if (!selectedAccount) return;

    const res = saveBankReconciliationSession({
      accountId: selectedAccount.id,
      periodeAwal: startDate,
      periodeAkhir: endDate,
      tanggalRekonsiliasi: todayStr,
      saldoAwalBuku: selectedAccount.saldoAwal || 0,
      saldoAkhirBuku: systemClosingBalance,
      saldoRekeningKoranBank: bankStatementBalance,
      matchedMutationIds: Array.from(selectedMutationIds),
      catatan: sessionNotes.trim() || undefined,
    });

    if (res.success && res.session) {
      setLastSavedSession(res.session);
    }
  };

  // Open Quick Action
  const openQuickAction = (type: 'admin_fee' | 'interest' | 'adjustment') => {
    setQuickActionType(type);
    if (type === 'admin_fee') {
      setQuickActionAmount(15000);
      setQuickActionDesc('Biaya Administrasi Bulanan Bank');
    } else if (type === 'interest') {
      setQuickActionAmount(25000);
      setQuickActionDesc('Pendapatan Bunga / Jasa Giro Rekening');
    } else {
      setQuickActionAmount(Math.abs(selisih) || 10000);
      setQuickActionDesc(`Penyesuaian Selisih Kas/Bank ${selisih > 0 ? 'Kurang' : 'Lebih'}`);
    }
    setQuickActionDate(todayStr);
    setIsQuickActionModalOpen(true);
  };

  // Submit Quick Action
  const handleSaveQuickAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || quickActionAmount <= 0) return;

    if (quickActionType === 'admin_fee') {
      recordCashTransaction({
        accountId: selectedAccount.id,
        tipe: 'keluar',
        jumlah: quickActionAmount,
        kategori: 'Biaya Bank & Admin',
        deskripsi: quickActionDesc || 'Biaya Administrasi Bulanan Bank',
        referensi: 'Rekonsiliasi Bank',
        tanggal: quickActionDate,
      });
    } else if (quickActionType === 'interest') {
      recordCashTransaction({
        accountId: selectedAccount.id,
        tipe: 'masuk',
        jumlah: quickActionAmount,
        kategori: 'Pendapatan Bunga Bank',
        deskripsi: quickActionDesc || 'Pendapatan Bunga / Jasa Giro',
        referensi: 'Rekonsiliasi Bank',
        tanggal: quickActionDate,
      });
    } else {
      // Adjustment
      const isOutflow = selisih > 0;
      recordCashTransaction({
        accountId: selectedAccount.id,
        tipe: isOutflow ? 'keluar' : 'masuk',
        jumlah: quickActionAmount,
        kategori: 'Koreksi & Penyesuaian Kas',
        deskripsi: quickActionDesc || 'Penyesuaian Selisih Saldo Rekonsiliasi Bank',
        referensi: 'Penyesuaian Rekonsiliasi',
        tanggal: quickActionDate,
      });
    }

    setIsQuickActionModalOpen(false);
  };

  // Smart Parser for pasting e-statement text
  const handleParseStatementText = () => {
    if (!statementRawText.trim()) return;

    let matchedCount = 0;
    const lines = statementRawText.split('\n');
    const newMatchedSet = new Set(selectedMutationIds);

    lines.forEach((line) => {
      const numbersInLine = line.match(/[\d.,]+/g);
      if (numbersInLine) {
        numbersInLine.forEach((numStr) => {
          const cleanNum = parseInt(numStr.replace(/[.,]/g, ''), 10);
          if (!isNaN(cleanNum) && cleanNum > 1000) {
            // Find an unmatched mutation with exact or approximate amount
            const candidate = accountMutations.find(
              (m) => !newMatchedSet.has(m.id) && m.jumlah === cleanNum
            );
            if (candidate) {
              newMatchedSet.add(candidate.id);
              matchedCount++;
            }
          }
        });
      }
    });

    setSelectedMutationIds(newMatchedSet);
    setParserFeedback(
      matchedCount > 0
        ? `Berhasil mencocokkan ${matchedCount} transaksi secara otomatis dari data rekening koran!`
        : 'Tidak ditemukan transaksi baru yang cocok dengan nominal teks rekening koran.'
    );

    setTimeout(() => {
      setIsSmartParserOpen(false);
      setParserFeedback(null);
      setStatementRawText('');
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-[#0e1219] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <ClipboardCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Rekonsiliasi Bank & Buku Kas
                </h2>
                <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Audit & Komparasi
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pencocokan mutasi buku kas internal dengan mutasi rekening koran bank secara presisi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Navigation */}
            <div className="hidden sm:flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('new_reconcile')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'new_reconcile'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sesi Rekonsiliasi
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Riwayat ({bankReconciliations.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MOBILE TAB NAV */}
        <div className="flex sm:hidden border-b border-slate-800 bg-slate-950 p-2 gap-2">
          <button
            onClick={() => setActiveTab('new_reconcile')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg text-center ${
              activeTab === 'new_reconcile' ? 'bg-blue-600 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            Sesi Rekonsiliasi
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg text-center ${
              activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            Riwayat ({bankReconciliations.length})
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'new_reconcile' ? (
            <>
              {/* SUCCESS BANNER WHEN RECONCILIATION SAVED */}
              {lastSavedSession && (
                <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 flex items-start justify-between gap-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-300">
                        Sesi Rekonsiliasi Berhasil Disimpan ({lastSavedSession.noRekonsiliasi})
                      </h4>
                      <p className="text-xs text-emerald-400/90 mt-0.5">
                        {lastSavedSession.totalItemTerekonsiliasi} transaksi berhasil dicatat sebagai klir.
                        Status: <strong className="uppercase">{lastSavedSession.status}</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLastSavedSession(null)}
                    className="text-xs font-semibold text-emerald-400 hover:text-white px-2 py-1 bg-emerald-900/50 rounded-lg"
                  >
                    Tutup
                  </button>
                </div>
              )}

              {/* TOP BAR: ACCOUNT & DATE PERIOD CONTROLS */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#0e1219] p-4 rounded-2xl border border-slate-800/80">
                {/* Account Picker */}
                <div className="md:col-span-4 space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Akun Kas / Bank Target</span>
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => handleAccountChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {cashAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nama} ({acc.tipe.toUpperCase()}) - Rp {acc.saldo.toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Period Start */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Periode Awal</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Period End */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Periode Akhir</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Input Saldo Rekening Koran Bank */}
                <div className="md:col-span-4 space-y-1">
                  <label className="text-xs font-semibold text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                      <span>Saldo Akhir Rekening Koran Bank</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">(e-Statement)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 font-mono">Rp</span>
                    <input
                      type="number"
                      value={bankStatementBalance}
                      onChange={(e) => setBankStatementBalance(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-amber-500/50 text-amber-300 font-bold font-mono text-sm rounded-xl pl-10 pr-3 py-1.5 focus:outline-none focus:border-amber-400"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* RECONCILIATION SUMMARY COMPARISON CARD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Saldo Sistem (Buku Kas) */}
                <div className="bg-[#0e1219] p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs font-semibold text-slate-400">Saldo Akhir Sistem (Buku)</span>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    Rp {systemClosingBalance.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Saldo berjalan tercatat di aplikasi
                  </div>
                </div>

                {/* 2. Saldo Bank (Rekening Koran) */}
                <div className="bg-[#0e1219] p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs font-semibold text-slate-400">Saldo Rekening Koran Bank</span>
                  <div className="text-lg font-bold text-amber-300 font-mono mt-1">
                    Rp {bankStatementBalance.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Mutasi fisik menurut bank
                  </div>
                </div>

                {/* 3. Mutasi Terekonsiliasi (Matched) */}
                <div className="bg-[#0e1219] p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs font-semibold text-slate-400">Total Klir Dicocokkan</span>
                  <div className="text-lg font-bold text-blue-400 font-mono mt-1">
                    {selectedMutationIds.size} / {accountMutations.length} Transaksi
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center gap-1.5">
                    <span className="text-emerald-400">+{totalMasukCleared.toLocaleString('id-ID')}</span>
                    <span>·</span>
                    <span className="text-rose-400">-{totalKeluarCleared.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                {/* 4. Discrepancy / Selisih Status */}
                <div
                  className={`p-4 rounded-2xl border transition-colors ${
                    isBalanced
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Selisih (Discrepancy)</span>
                    {isBalanced ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        KLOP / SEIMBANG
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        ADA SELISIH
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-black font-mono mt-1">
                    Rp {Math.abs(selisih).toLocaleString('id-ID')}
                  </div>
                  <div className="text-[11px] opacity-80 mt-1">
                    {isBalanced
                      ? '✓ Buku kas & bank sinkron 100%'
                      : selisih > 0
                      ? 'Saldo sistem lebih tinggi dari bank'
                      : 'Saldo bank lebih tinggi dari sistem'}
                  </div>
                </div>
              </div>

              {/* QUICK ACTIONS TOOLBAR (Admin fee, Interest, Auto-Adjust, Smart Parser) */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0e1219] p-3 rounded-2xl border border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 mr-1">Tindakan Cepat:</span>
                  <button
                    onClick={() => openQuickAction('admin_fee')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-900/50 hover:border-rose-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-rose-400" />
                    <span>+ Biaya Admin Bank</span>
                  </button>

                  <button
                    onClick={() => openQuickAction('interest')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-900/50 hover:border-emerald-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ Bunga Bank / Giro</span>
                  </button>

                  {!isBalanced && (
                    <button
                      onClick={() => openQuickAction('adjustment')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>+ Penyesuaian Selisih (Rp {Math.abs(selisih).toLocaleString('id-ID')})</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSmartParserOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Paste Rekening Koran</span>
                  </button>
                </div>
              </div>

              {/* MUTATION CHECKLIST TABLE */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Mutasi Kas Internal ({accountMutations.length} Transaksi)
                    </h3>
                    <span className="text-xs text-slate-400">
                      Tandai transaksi yang telah tercantum di rekening koran bank
                    </span>
                  </div>

                  {/* Filter & Batch selection */}
                  <div className="flex items-center gap-2">
                    <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-xs">
                      <button
                        onClick={() => setFilterCleared('all')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          filterCleared === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Semua ({accountMutations.length})
                      </button>
                      <button
                        onClick={() => setFilterCleared('matched')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          filterCleared === 'matched' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Klir ({selectedMutationIds.size})
                      </button>
                      <button
                        onClick={() => setFilterCleared('unreconciled')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          filterCleared === 'unreconciled' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Belum ({accountMutations.length - selectedMutationIds.size})
                      </button>
                    </div>

                    <button
                      onClick={handleMatchAll}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      Batal Semua
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#0e1219]">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] sticky top-0 border-b border-slate-800 z-10">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-12">Klir</th>
                          <th className="py-2.5 px-3">Tanggal</th>
                          <th className="py-2.5 px-3">Kategori & Deskripsi</th>
                          <th className="py-2.5 px-3">Referensi</th>
                          <th className="py-2.5 px-3 text-right">Nominal Masuk (+)</th>
                          <th className="py-2.5 px-3 text-right">Nominal Keluar (-)</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {displayedMutations.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-slate-500">
                              Tidak ada mutasi kas/bank pada filter dan rentang tanggal ini.
                            </td>
                          </tr>
                        ) : (
                          displayedMutations.map((m) => {
                            const isChecked = selectedMutationIds.has(m.id);
                            const isMasuk = m.tipe === 'masuk';

                            return (
                              <tr
                                key={m.id}
                                onClick={() => toggleMutation(m.id)}
                                className={`cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-blue-950/20 hover:bg-blue-950/30'
                                    : 'hover:bg-slate-900/50'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleMutation(m.id)}
                                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-300">
                                  {m.tanggal} {m.waktu && <span className="text-slate-500 text-[11px]">({m.waktu})</span>}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-white">{m.deskripsi}</div>
                                  <div className="text-[11px] text-slate-400">{m.kategori}</div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 font-mono text-xs">
                                  {m.referensi || '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                                  {isMasuk ? `+Rp ${m.jumlah.toLocaleString('id-ID')}` : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                                  {!isMasuk ? `-Rp ${m.jumlah.toLocaleString('id-ID')}` : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {isChecked ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <Check className="w-3 h-3" /> Klir
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                      Belum Klir
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* NOTES & FINAL SUBMIT BAR */}
              <div className="bg-[#0e1219] p-4 rounded-2xl border border-slate-800 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">
                    Catatan Rekonsiliasi (Berita Acara / Keterangan Auditor)
                  </label>
                  <input
                    type="text"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Contoh: Rekonsiliasi bulanan BCA Klir, seluruh transfer marketplace telah cocok dengan mutasi koran."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-1"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Dicatat oleh: <strong>{currentUser.name}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Batal
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveSession}
                      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                      <span>Simpan Berita Acara Rekonsiliasi</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* TAB RIWAYAT REKONSILIASI */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Riwayat Sesi Rekonsiliasi Bank</h3>
                  <p className="text-xs text-slate-400">
                    Daftar seluruh audit rekonsiliasi yang pernah diselesaikan dan disimpan.
                  </p>
                </div>
              </div>

              {bankReconciliations.length === 0 ? (
                <div className="text-center py-12 bg-[#0e1219] border border-slate-800 rounded-2xl p-6">
                  <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-white">Belum Ada Sesi Rekonsiliasi Tersimpan</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Silakan lakukan pencocokan saldo buku dan rekening koran bank pada tab &quot;Sesi Rekonsiliasi&quot;.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bankReconciliations.map((session) => (
                    <div
                      key={session.id}
                      className="bg-[#0e1219] p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono text-sm">
                            {session.noRekonsiliasi}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {session.accountNama}
                          </span>
                          {session.status === 'seimbang' ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Check className="w-3 h-3" /> KLOP / SEIMBANG
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              SELISIH Rp {Math.abs(session.selisih).toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-y-1 gap-x-3">
                          <span>Periode: <strong>{session.periodeAwal}</strong> s/d <strong>{session.periodeAkhir}</strong></span>
                          <span>·</span>
                          <span>Tanggal Audit: <strong>{session.tanggalRekonsiliasi}</strong></span>
                          <span>·</span>
                          <span>Oleh: <strong>{session.dicatatOleh}</strong></span>
                        </div>

                        {session.catatan && (
                          <p className="text-xs text-slate-300 italic pt-1">
                            &quot;{session.catatan}&quot;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right font-mono">
                          <div className="text-xs text-slate-400">Saldo Akhir Bank</div>
                          <div className="text-sm font-bold text-amber-300">
                            Rp {session.saldoRekeningKoranBank.toLocaleString('id-ID')}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {session.totalItemTerekonsiliasi} mutasi klir
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingHistorySession(session)}
                            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                            title="Lihat Detail Berita Acara"
                          >
                            <FileText className="w-4 h-4 text-blue-400" />
                          </button>

                          {isOwner && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Hapus sesi rekonsiliasi ${session.noRekonsiliasi}?`)) {
                                  deleteBankReconciliationSession(session.id);
                                }
                              }}
                              className="p-2 bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                              title="Hapus Sesi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QUICK ACTION MODAL (ADMIN FEE / INTEREST / ADJUSTMENT) */}
      {isQuickActionModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#161b26] border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {quickActionType === 'admin_fee' && <span className="text-rose-400">+ Catat Biaya Admin Bank</span>}
                {quickActionType === 'interest' && <span className="text-emerald-400">+ Catat Pendapatan Bunga Bank</span>}
                {quickActionType === 'adjustment' && <span className="text-amber-400">+ Penyesuaian Selisih Saldo</span>}
              </h3>
              <button
                onClick={() => setIsQuickActionModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickAction} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Akun Kas / Bank</label>
                <input
                  type="text"
                  disabled
                  value={selectedAccount?.nama || ''}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-400 text-xs rounded-xl px-3 py-2 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Tanggal</label>
                  <input
                    type="date"
                    value={quickActionDate}
                    onChange={(e) => setQuickActionDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-mono rounded-xl px-3 py-2 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Nominal (Rp)</label>
                  <input
                    type="number"
                    min="1"
                    value={quickActionAmount}
                    onChange={(e) => setQuickActionAmount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold rounded-xl px-3 py-2 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Deskripsi / Keterangan</label>
                <input
                  type="text"
                  value={quickActionDesc}
                  onChange={(e) => setQuickActionDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuickActionModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-900 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SMART PARSER MODAL */}
      {isSmartParserOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#161b26] border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Smart Auto-Match Rekening Koran</span>
              </h3>
              <button
                onClick={() => setIsSmartParserOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Salin dan tempel (paste) teks tabel mutasi rekening dari KlikBCA, Livin by Mandiri, atau CSV bank Anda.
              Sistem akan otomatis mencocokkan nominal transaksi yang sesuai.
            </p>

            <textarea
              rows={6}
              value={statementRawText}
              onChange={(e) => setStatementRawText(e.target.value)}
              placeholder="Contoh format paste dari m-Banking:&#10;15/09 TRANSFER TRSF E-COMMERCE CR 2.500.000&#10;16/09 BIAYA ADM BULANAN DB 15.000&#10;18/09 TRSF TO MANDIRI DB 10.000.000"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
            />

            {parserFeedback && (
              <div className="p-3 bg-blue-950/60 border border-blue-800 text-blue-200 text-xs rounded-xl">
                {parserFeedback}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSmartParserOpen(false)}
                className="px-3 py-1.5 bg-slate-900 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleParseStatementText}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Cocokkan Otomatis</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL BERITA ACARA MODAL */}
      {viewingHistorySession && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#121620] border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Berita Acara Rekonsiliasi Bank
                </h3>
                <span className="text-xs text-blue-400 font-mono">
                  {viewingHistorySession.noRekonsiliasi}
                </span>
              </div>
              <button
                onClick={() => setViewingHistorySession(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#0e1219] p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400">Akun Rekening:</span>
                  <div className="font-bold text-white">{viewingHistorySession.accountNama}</div>
                </div>
                <div>
                  <span className="text-slate-400">Tanggal Audit:</span>
                  <div className="font-bold text-white">{viewingHistorySession.tanggalRekonsiliasi}</div>
                </div>
                <div>
                  <span className="text-slate-400">Periode Audit:</span>
                  <div className="font-bold text-white">{viewingHistorySession.periodeAwal} s/d {viewingHistorySession.periodeAkhir}</div>
                </div>
                <div>
                  <span className="text-slate-400">Auditor:</span>
                  <div className="font-bold text-white">{viewingHistorySession.dicatatOleh}</div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Saldo Akhir Menurut Buku (Sistem)</span>
                  <span className="font-mono font-bold text-white">
                    Rp {viewingHistorySession.saldoAkhirBuku.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Saldo Akhir Rekening Koran Bank</span>
                  <span className="font-mono font-bold text-amber-300">
                    Rp {viewingHistorySession.saldoRekeningKoranBank.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Selisih Rekonsiliasi</span>
                  <span className={`font-mono font-bold ${viewingHistorySession.status === 'seimbang' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    Rp {Math.abs(viewingHistorySession.selisih).toLocaleString('id-ID')} ({viewingHistorySession.status.toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Total Transaksi Klir</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {viewingHistorySession.totalItemTerekonsiliasi} Transaksi
                  </span>
                </div>
              </div>

              {viewingHistorySession.catatan && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                  <span className="font-bold text-slate-400 block mb-1">Catatan:</span>
                  {viewingHistorySession.catatan}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Cetak Berita Acara</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingHistorySession(null)}
                className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
