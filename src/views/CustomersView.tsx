import React, { useState, useMemo } from 'react';
import { useSearchHandoff } from '../hooks/useSearchHandoff';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  ShoppingBag,
  Store,
  Crown,
  ShieldAlert,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Clock,
  ChevronRight,
  Receipt,
  Edit2,
  Trash2,
  ExternalLink,
  DollarSign,
  Package,
  Sparkles,
  UserCheck,
  TrendingUp,
  Tag,
  Zap,
  Layers,
  ChevronDown,
  Upload,
  Download,
  FileSpreadsheet,
  Trash,
  CheckSquare,
  Square,
  AlertTriangle,
  RefreshCw,
  X,
  ArrowUpDown,
  Building2,
} from 'lucide-react';
import { useApp, normalizePhone } from '../context/AppContext';
import { Customer, Order, SalesChannelName, Reseller, CustomerCategory } from '../types';
import { ResellerView } from './ResellerView';

export type MainCategoryTab = 'ALL' | 'Umum' | 'Reseller' | 'Marketplace' | 'VIP';
export type FrequencyFilter = 'ALL' | 'baru' | 'reguler' | 'loyal' | 'no_order';
export type SortOption = 'ltv_desc' | 'orders_desc' | 'recent' | 'name_asc';

export const CustomersView: React.FC = () => {
  const {
    customers,
    orders,
    resellers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers,
    mergeDuplicateCustomers,
    promoteCustomerToReseller,
    syncCustomersFromOrders,
    setQuickOrderModalOpen,
    isOwner,
  } = useApp();

  // Top View Toggle: Database Customer vs CRM Mitra Hub
  const [activeMainView, setActiveMainView] = useState<'customer_db' | 'crm_mitra'>('customer_db');

  // Category Filter Bar State
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<MainCategoryTab>('ALL');
  const [selectedFreqFilter, setSelectedFreqFilter] = useState<FrequencyFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('ltv_desc');
  const [searchQuery, setSearchQuery] = useState('');
  useSearchHandoff('customers', setSearchQuery);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Selection & Bulk Action State
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<Customer | null>(null);

  // Quick tag dropdown state for a specific customer row
  const [activeTagDropdownId, setActiveTagDropdownId] = useState<string | null>(null);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [editCustomerModal, setEditCustomerModal] = useState<Customer | null>(null);
  const [historyCustomerModal, setHistoryCustomerModal] = useState<Customer | null>(null);
  const [promoteCustomerModal, setPromoteCustomerModal] = useState<Customer | null>(null);

  // New Customer Form State
  const [newCustNama, setNewCustNama] = useState('');
  const [newCustHp, setNewCustHp] = useState('');
  const [newCustKota, setNewCustKota] = useState('Jakarta');
  const [newCustCategory, setNewCustCategory] = useState<'Umum' | 'Reseller' | 'Marketplace' | 'VIP'>('Umum');
  const [newCustAlamat, setNewCustAlamat] = useState('');
  const [newCustCatatan, setNewCustCatatan] = useState('');

  // Promote to Reseller / Mitra Form State
  const [mitraLevel, setMitraLevel] = useState<'Platinum' | 'Gold' | 'Silver'>('Gold');
  const [mitraDiskon, setMitraDiskon] = useState<number>(20);
  const [mitraPlafon, setMitraPlafon] = useState<number>(10000000);
  const [mitraJadwal, setMitraJadwal] = useState('Setiap Hari Senin');
  const [mitraAlamat, setMitraAlamat] = useState('');

  // 1. Calculate stats & resolved category for every customer
  const customerStatsMap = useMemo(() => {
    const stats: Record<
      string,
      {
        totalOrders: number;
        totalPcs: number;
        totalSpent: number;
        lastOrderDate?: string;
        lastChannel?: SalesChannelName;
        channelsUsed: Set<SalesChannelName>;
        marketplaceOrdersCount: number;
        directOrdersCount: number;
        resellerOrdersCount: number;
        topItem?: string;
        ordersList: Order[];
        resolvedCategory: 'Umum' | 'Reseller' | 'Marketplace' | 'VIP';
        isManualTagged: boolean;
        frequencyTier: 'baru' | 'reguler' | 'loyal' | 'no_order';
      }
    > = {};

    const phoneMap = new Map<string, string>();
    const nameMap = new Map<string, string>();

    customers.forEach((c) => {
      const normPhone = normalizePhone(c.noHp);
      if (normPhone && normPhone.length >= 8) {
        phoneMap.set(normPhone, c.id);
      }
      if (c.nama) {
        nameMap.set(c.nama.trim().toLowerCase(), c.id);
      }

      stats[c.id] = {
        totalOrders: 0,
        totalPcs: 0,
        totalSpent: 0,
        channelsUsed: new Set<SalesChannelName>(),
        marketplaceOrdersCount: 0,
        directOrdersCount: 0,
        resellerOrdersCount: 0,
        ordersList: [],
        resolvedCategory: 'Umum',
        isManualTagged: false,
        frequencyTier: 'no_order',
      };
    });

    // Populate from orders
    orders.forEach((ord) => {
      let targetCustId = ord.customerId;
      const ordNormPhone = normalizePhone(ord.customerHp);

      if (!stats[targetCustId]) {
        if (ordNormPhone && phoneMap.has(ordNormPhone)) {
          targetCustId = phoneMap.get(ordNormPhone)!;
        } else if (ord.customerNama && nameMap.has(ord.customerNama.trim().toLowerCase())) {
          targetCustId = nameMap.get(ord.customerNama.trim().toLowerCase())!;
        }
      }

      if (stats[targetCustId]) {
        const s = stats[targetCustId];
        if (ord.statusOrder !== 'batal') {
          s.totalOrders += 1;
          const orderPcs = ord.items.reduce((acc, it) => acc + it.qty, 0);
          s.totalPcs += orderPcs;
          s.totalSpent += ord.totalTagihan;
          s.channelsUsed.add(ord.channel);
          s.ordersList.push(ord);

          if (ord.channel === 'Shopee' || ord.channel === 'TikTok') {
            s.marketplaceOrdersCount += 1;
          } else if (ord.channel === 'Reseller') {
            s.resellerOrdersCount += 1;
          } else {
            s.directOrdersCount += 1;
          }

          if (!s.lastOrderDate || ord.tanggal > s.lastOrderDate) {
            s.lastOrderDate = ord.tanggal;
            s.lastChannel = ord.channel;
          }
        }
      }
    });

    // Resolve Category and Frequency Tier for each customer
    customers.forEach((cust) => {
      const s = stats[cust.id];
      if (!s) return;

      // Frequency Tier
      if (s.totalOrders === 0) {
        s.frequencyTier = 'no_order';
      } else if (s.totalOrders === 1) {
        s.frequencyTier = 'baru';
      } else if (s.totalOrders >= 2 && s.totalOrders <= 4) {
        s.frequencyTier = 'reguler';
      } else {
        s.frequencyTier = 'loyal';
      }

      // Favorite product calculation
      if (s.ordersList.length > 0) {
        const itemFrequency: Record<string, number> = {};
        s.ordersList.forEach((ord) => {
          ord.items.forEach((it) => {
            itemFrequency[it.namaProduk] = (itemFrequency[it.namaProduk] || 0) + it.qty;
          });
        });
        const sortedItems = Object.entries(itemFrequency).sort((a, b) => b[1] - a[1]);
        if (sortedItems[0]) {
          s.topItem = `${sortedItems[0][0]} (${sortedItems[0][1]} pcs)`;
        }
      }

      // TAGGING CATEGORIZATION LOGIC:
      if (cust.kategoriManual) {
        s.resolvedCategory = cust.kategoriManual;
        s.isManualTagged = true;
      } else if (cust.tipe === 'VIP') {
        s.resolvedCategory = 'VIP';
        s.isManualTagged = true;
      } else if (cust.tipe === 'Reseller' || cust.resellerIdRef || s.resellerOrdersCount > 0) {
        s.resolvedCategory = 'Reseller';
        s.isManualTagged = cust.tipe === 'Reseller';
      } else if (cust.tipe === 'Marketplace') {
        s.resolvedCategory = 'Marketplace';
        s.isManualTagged = true;
      } else {
        if (s.marketplaceOrdersCount > 0 && s.marketplaceOrdersCount >= s.directOrdersCount) {
          s.resolvedCategory = 'Marketplace';
        } else if (s.totalOrders >= 5 || s.totalSpent >= 2500000) {
          s.resolvedCategory = 'VIP';
        } else if (s.resellerOrdersCount > 0) {
          s.resolvedCategory = 'Reseller';
        } else {
          s.resolvedCategory = 'Umum';
        }
      }
    });

    return stats;
  }, [customers, orders]);

  // 2. Count metrics for the Category Filter Bar
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: { count: customers.length, totalSpent: 0 },
      Umum: { count: 0, totalSpent: 0 },
      Reseller: { count: 0, totalSpent: 0 },
      Marketplace: { count: 0, totalSpent: 0 },
      VIP: { count: 0, totalSpent: 0 },
    };

    customers.forEach((c) => {
      const s = customerStatsMap[c.id];
      const cat = s?.resolvedCategory || 'Umum';
      const spent = s?.totalSpent || 0;

      counts.ALL.totalSpent += spent;
      if (counts[cat]) {
        counts[cat].count += 1;
        counts[cat].totalSpent += spent;
      }
    });

    return counts;
  }, [customers, customerStatsMap]);

  // 3. Filtered Customers List
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return customers.filter((cust) => {
      const stats = customerStatsMap[cust.id];
      if (!stats) return false;

      // Category Tab Match
      if (selectedCategoryTab !== 'ALL' && stats.resolvedCategory !== selectedCategoryTab) {
        return false;
      }

      // Frequency Filter Match
      if (selectedFreqFilter !== 'ALL' && stats.frequencyTier !== selectedFreqFilter) {
        return false;
      }

      // Search Query Match
      if (q) {
        const matchName = cust.nama.toLowerCase().includes(q);
        const matchPhone = cust.noHp.includes(q);
        const matchCity = cust.kota.toLowerCase().includes(q);
        const matchAddr = cust.alamat ? cust.alamat.toLowerCase().includes(q) : false;
        const matchNote = cust.catatan ? cust.catatan.toLowerCase().includes(q) : false;
        const matchCat = stats.resolvedCategory.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCity && !matchAddr && !matchNote && !matchCat) {
          return false;
        }
      }

      return true;
    });
  }, [customers, selectedCategoryTab, selectedFreqFilter, searchQuery, customerStatsMap]);

  // 4. Sorted Customers
  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      const statsA = customerStatsMap[a.id];
      const statsB = customerStatsMap[b.id];

      if (sortBy === 'ltv_desc') {
        return (statsB?.totalSpent || 0) - (statsA?.totalSpent || 0);
      }
      if (sortBy === 'orders_desc') {
        return (statsB?.totalOrders || 0) - (statsA?.totalOrders || 0);
      }
      if (sortBy === 'recent') {
        const dateA = statsA?.lastOrderDate || '';
        const dateB = statsB?.lastOrderDate || '';
        return dateB.localeCompare(dateA);
      }
      if (sortBy === 'name_asc') {
        return a.nama.localeCompare(b.nama);
      }
      return 0;
    });
  }, [filteredCustomers, customerStatsMap, sortBy]);

  const [customerPage, setCustomerPage] = useState<number>(1);
  const customerPageSize = 20;

  const totalCustomerPages = Math.max(1, Math.ceil(sortedCustomers.length / customerPageSize));
  const paginatedCustomers = useMemo(() => {
    const start = (Math.min(customerPage, totalCustomerPages) - 1) * customerPageSize;
    return sortedCustomers.slice(start, start + customerPageSize);
  }, [sortedCustomers, customerPage, totalCustomerPages, customerPageSize]);

  // Handlers
  const handleSetQuickTag = (customerId: string, newCategory: 'Umum' | 'Reseller' | 'Marketplace' | 'VIP') => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;

    updateCustomer(customerId, {
      tipe: newCategory === 'Umum' ? 'Retail' : newCategory,
      kategoriManual: newCategory,
    });

    setActiveTagDropdownId(null);
    setSyncStatus(`Kategori "${cust.nama}" berhasil diubah menjadi "${newCategory}".`);
    setTimeout(() => setSyncStatus(null), 3500);
  };

  const handleResetToAutoTag = (customerId: string) => {
    updateCustomer(customerId, {
      kategoriManual: undefined,
    });
    setActiveTagDropdownId(null);
    setSyncStatus(`Tagging dikembalikan ke deteksi otomatis sistem.`);
    setTimeout(() => setSyncStatus(null), 3500);
  };

  const handleSaveNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustNama.trim()) return;

    addCustomer({
      nama: newCustNama.trim(),
      noHp: newCustHp.trim(),
      kota: newCustKota.trim() || 'Jakarta',
      tipe: newCustCategory === 'Umum' ? 'Retail' : newCustCategory,
      kategoriManual: newCustCategory,
      alamat: newCustAlamat.trim(),
      catatan: newCustCatatan.trim(),
    });

    setIsAddCustomerOpen(false);
    setNewCustNama('');
    setNewCustHp('');
    setNewCustKota('Jakarta');
    setNewCustCategory('Umum');
    setNewCustAlamat('');
    setNewCustCatatan('');
  };

  const handleSaveEditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomerModal) return;

    updateCustomer(editCustomerModal.id, {
      nama: editCustomerModal.nama,
      noHp: editCustomerModal.noHp,
      kota: editCustomerModal.kota,
      tipe: editCustomerModal.tipe,
      kategoriManual: editCustomerModal.kategoriManual,
      alamat: editCustomerModal.alamat,
      catatan: editCustomerModal.catatan,
    });

    setEditCustomerModal(null);
  };

  const handleOpenPromote = (cust: Customer) => {
    setPromoteCustomerModal(cust);
    setMitraLevel('Gold');
    setMitraDiskon(20);
    setMitraPlafon(10000000);
    setMitraJadwal('Setiap Hari Senin');
    setMitraAlamat(cust.alamat || cust.kota || '');
  };

  const handleConfirmPromote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteCustomerModal) return;

    promoteCustomerToReseller(promoteCustomerModal.id, {
      level: mitraLevel,
      diskonPersen: mitraDiskon,
      batasPlafonTitipan: mitraPlafon,
      jadwalSetoran: mitraJadwal,
      alamat: mitraAlamat,
    });

    setPromoteCustomerModal(null);
    setSyncStatus(`Status kemitraan untuk "${promoteCustomerModal.nama}" berhasil disimpan.`);
    setTimeout(() => setSyncStatus(null), 4000);
  };

  const handleSyncOrders = () => {
    const res = syncCustomersFromOrders();
    if (res.count > 0 || res.mergedCount > 0) {
      setSyncStatus(
        `Sinkronisasi berhasil! ${res.count} customer baru diekstrak & ${res.mergedCount} kontak nomor HP duplikat otomatis digabungkan.`
      );
    } else {
      setSyncStatus(
        `Database customer sudah sinkron dengan seluruh (${orders.length}) riwayat order & tidak ditemukan nomor HP ganda.`
      );
    }
    setTimeout(() => {
      setSyncStatus(null);
    }, 6000);
  };

  const handleMergeDuplicates = () => {
    const res = mergeDuplicateCustomers();
    if (res.mergedCount > 0) {
      setSyncStatus(
        `Berhasil menggabungkan ${res.mergedCount} kontak dengan nomor HP yang sama menjadi profil customer tunggal!`
      );
    } else {
      setSyncStatus(
        `Semua data nomor HP sudah unik dan rapi. Tidak ditemukan kontak duplikat di database.`
      );
    }
    setTimeout(() => {
      setSyncStatus(null);
    }, 6000);
  };

  // Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedCustomerIds.size === sortedCustomers.length && sortedCustomers.length > 0) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(sortedCustomers.map((c) => c.id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmSingleDelete = () => {
    if (!deleteConfirmCustomer) return;
    deleteCustomer(deleteConfirmCustomer.id);
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteConfirmCustomer.id);
      return next;
    });
    setSyncStatus(`Customer "${deleteConfirmCustomer.nama}" berhasil dihapus dari database.`);
    setDeleteConfirmCustomer(null);
    setTimeout(() => setSyncStatus(null), 5000);
  };

  const handleConfirmBulkDelete = () => {
    if (selectedCustomerIds.size === 0) return;
    const count = selectedCustomerIds.size;
    bulkDeleteCustomers(Array.from(selectedCustomerIds));
    setSelectedCustomerIds(new Set());
    setIsBulkDeleteModalOpen(false);
    setSyncStatus(`Berhasil menghapus ${count} data customer terpilih.`);
    setTimeout(() => setSyncStatus(null), 5000);
  };

  const handleBulkSetCategory = (newCat: 'Umum' | 'Reseller' | 'Marketplace' | 'VIP') => {
    if (selectedCustomerIds.size === 0) return;
    selectedCustomerIds.forEach((id) => {
      updateCustomer(id, {
        tipe: newCat === 'Umum' ? 'Retail' : newCat,
        kategoriManual: newCat,
      });
    });
    setSyncStatus(`Berhasil mengubah kategori ${selectedCustomerIds.size} customer terpilih menjadi "${newCat}".`);
    setSelectedCustomerIds(new Set());
    setTimeout(() => setSyncStatus(null), 4000);
  };

  // Export Customer List to CSV
  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Nama Customer',
      'Nomor WhatsApp/HP',
      'Kota',
      'Kategori Tag',
      'Tipe Customer',
      'Total Order',
      'Total Qty (Pcs)',
      'Total Belanja (LTV)',
      'Order Terakhir',
      'Channel Terakhir',
      'Alamat',
      'Catatan',
    ];

    const rows = customers.map((c) => {
      const s = customerStatsMap[c.id];
      return [
        `"${c.id}"`,
        `"${c.nama.replace(/"/g, '""')}"`,
        `"${(c.noHp || '').replace(/"/g, '""')}"`,
        `"${(c.kota || '').replace(/"/g, '""')}"`,
        `"${s?.resolvedCategory || 'Umum'}"`,
        `"${c.tipe}"`,
        s?.totalOrders || 0,
        s?.totalPcs || 0,
        s?.totalSpent || 0,
        `"${s?.lastOrderDate || '-'}"`,
        `"${s?.lastChannel || '-'}"`,
        `"${(c.alamat || '').replace(/"/g, '""')}"`,
        `"${(c.catatan || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Kalima_Customers_Database_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSyncStatus('File CSV Database Customer berhasil diunduh!');
    setTimeout(() => setSyncStatus(null), 4000);
  };

  // Process Bulk CSV / Excel text import
  const handleProcessImportCsv = () => {
    setImportError(null);
    if (!importCsvText.trim()) {
      setImportError('Silakan tempel (paste) data teks CSV atau Excel terlebih dahulu.');
      return;
    }

    try {
      const lines = importCsvText.trim().split(/\r?\n/);
      let successCount = 0;

      lines.forEach((line, idx) => {
        if (!line.trim()) return;
        if (
          idx === 0 &&
          (line.toLowerCase().includes('nama') || line.toLowerCase().includes('customer') || line.toLowerCase().includes('telepon'))
        ) {
          return;
        }

        const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
        const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));

        const nama = parts[0] || '';
        const noHp = parts[1] || '';
        const kota = parts[2] || 'Jakarta';
        const rawCat = parts[3] || 'Umum';
        const alamat = parts[4] || '';
        const catatan = parts[5] || '';

        if (nama.trim()) {
          const categoryValid: 'Umum' | 'Reseller' | 'Marketplace' | 'VIP' =
            rawCat.toLowerCase().includes('reseller') || rawCat.toLowerCase().includes('mitra')
              ? 'Reseller'
              : rawCat.toLowerCase().includes('shopee') || rawCat.toLowerCase().includes('tiktok') || rawCat.toLowerCase().includes('market')
              ? 'Marketplace'
              : rawCat.toLowerCase().includes('vip')
              ? 'VIP'
              : 'Umum';

          addCustomer({
            nama: nama.trim(),
            noHp: noHp.trim(),
            kota: kota.trim(),
            tipe: categoryValid === 'Umum' ? 'Retail' : categoryValid,
            kategoriManual: categoryValid,
            alamat: alamat.trim(),
            catatan: catatan.trim(),
          });
          successCount++;
        }
      });

      setIsImportModalOpen(false);
      setImportCsvText('');
      setSyncStatus(`Berhasil mengimpor ${successCount} kontak customer baru ke database!`);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setImportError('Gagal memproses data. Pastikan format kolom sesuai contoh.');
    }
  };

  const formatRupiah = (val: number) => {
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const formatCompact = (val: number) => {
    if (Math.abs(val) >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} jt`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)} rb`;
    return val.toString();
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name.trim().slice(0, 2) || 'CU').toUpperCase();
  };

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'Reseller':
        return {
          badge: 'text-amber-300 bg-amber-500/10 border border-amber-500/30',
          avatar: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
          label: 'Reseller',
          icon: Store,
        };
      case 'VIP':
        return {
          badge: 'text-purple-300 bg-purple-500/10 border border-purple-500/30',
          avatar: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          dot: 'bg-purple-400',
          label: 'VIP & Loyal',
          icon: Crown,
        };
      case 'Marketplace':
        return {
          badge: 'text-orange-300 bg-orange-500/10 border border-orange-500/30',
          avatar: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
          dot: 'bg-orange-400',
          label: 'Marketplace',
          icon: Zap,
        };
      case 'Umum':
      default:
        return {
          badge: 'text-blue-300 bg-blue-500/10 border border-blue-500/30',
          avatar: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          dot: 'bg-blue-400',
          label: 'Umum (Retail)',
          icon: ShoppingBag,
        };
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {syncStatus && (
        <div className="bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xl backdrop-blur-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{syncStatus}</span>
          </div>
          <button
            onClick={() => setSyncStatus(null)}
            className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP VIEW MODE SWITCHER (Segmented control: Database Customer vs CRM Mitra) */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121620] p-2 rounded-2xl border border-slate-800/80 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveMainView('customer_db')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainView === 'customer_db'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Database Customer ({customers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainView('crm_mitra')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainView === 'crm_mitra'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>CRM Mitra Reseller ({resellers.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 px-2 flex items-center gap-2">
          <span>Total LTV Bisnis:</span>
          <span className="font-mono font-bold text-emerald-400">
            {formatRupiah(categoryCounts.ALL.totalSpent)}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE: CRM MITRA RESELLER HUB */}
      {/* ========================================================================= */}
      {activeMainView === 'crm_mitra' ? (
        <div className="animate-in fade-in duration-200">
          <ResellerView />
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW MODE: DATABASE CUSTOMER MASTER */
        /* ========================================================================= */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Executive Header Banner */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#121620] p-5 sm:p-6 rounded-3xl border border-slate-800/80 shadow-md">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Database Customer & Profil Pelanggan
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {customers.length} Kontak Terdaftar · {categoryCounts.Reseller.count} Mitra Reseller · {categoryCounts.VIP.count} Pelanggan VIP · Total Belanja {formatCompact(categoryCounts.ALL.totalSpent)}
                  </p>
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSyncOrders}
                title="Tarik kontak dari transaksi order & deduplikasi nomor HP otomatis" aria-label="Tarik kontak dari transaksi order & deduplikasi nomor HP otomatis"
                className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 font-semibold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Tarik dari Order</span>
              </button>

              <button
                onClick={handleMergeDuplicates}
                title="Satukan profil customer yang memiliki nomor WhatsApp/HP yang sama" aria-label="Satukan profil customer yang memiliki nomor WhatsApp/HP yang sama"
                className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 font-semibold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                <span>Rapikan Duplikat</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                title="Impor kontak dari Excel atau CSV" aria-label="Impor kontak dari Excel atau CSV"
                className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 font-medium px-3 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Impor</span>
              </button>

              <button
                onClick={handleExportCsv}
                title="Download kontak ke format Excel / CSV" aria-label="Download kontak ke format Excel / CSV"
                className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 font-medium px-3 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ekspor</span>
              </button>

              <button
                onClick={() => setIsAddCustomerOpen(true)}
                className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Tambah Customer</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEGMENTATION METRIC CARDS (Zero-Pill Discipline) */}
          {/* ========================================================================= */}
          <div className="bg-[#121620] p-4 sm:p-5 rounded-3xl border border-slate-800/80 space-y-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Segmentasi Pasar & Kategori CRM
                </h3>
              </div>
              <div className="text-xs text-slate-400">
                Pilih segmen untuk memfilter kontak dan memantau performa LTV
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* TAB: SEMUA CUSTOMER */}
              <button
                type="button"
                onClick={() => setSelectedCategoryTab('ALL')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  selectedCategoryTab === 'ALL'
                    ? 'bg-slate-900 border-amber-500/80 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Semua Kontak</span>
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-1.5">
                  {categoryCounts.ALL.count}
                </div>
                <div className="text-xs text-slate-400 mt-1 truncate font-mono">
                  LTV: {formatCompact(categoryCounts.ALL.totalSpent)}
                </div>
                {selectedCategoryTab === 'ALL' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
                )}
              </button>

              {/* TAB: UMUM (RETAIL) */}
              <button
                type="button"
                onClick={() => setSelectedCategoryTab('Umum')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  selectedCategoryTab === 'Umum'
                    ? 'bg-blue-950/60 border-blue-500/80 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-blue-900/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Umum (Retail)</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-1.5">
                  {categoryCounts.Umum.count}
                </div>
                <div className="text-xs text-blue-300/80 mt-1 truncate font-mono">
                  LTV: {formatCompact(categoryCounts.Umum.totalSpent)}
                </div>
                {selectedCategoryTab === 'Umum' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
                )}
              </button>

              {/* TAB: RESELLER (MITRA) */}
              <button
                type="button"
                onClick={() => setSelectedCategoryTab('Reseller')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  selectedCategoryTab === 'Reseller'
                    ? 'bg-amber-950/60 border-amber-500/80 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-amber-900/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>Reseller (Mitra)</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-1.5">
                  {categoryCounts.Reseller.count}
                </div>
                <div className="text-xs text-amber-300/80 mt-1 truncate font-mono">
                  LTV: {formatCompact(categoryCounts.Reseller.totalSpent)}
                </div>
                {selectedCategoryTab === 'Reseller' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
                )}
              </button>

              {/* TAB: MARKETPLACE */}
              <button
                type="button"
                onClick={() => setSelectedCategoryTab('Marketplace')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  selectedCategoryTab === 'Marketplace'
                    ? 'bg-orange-950/60 border-orange-500/80 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-orange-900/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Marketplace</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-1.5">
                  {categoryCounts.Marketplace.count}
                </div>
                <div className="text-xs text-orange-300/80 mt-1 truncate font-mono">
                  LTV: {formatCompact(categoryCounts.Marketplace.totalSpent)}
                </div>
                {selectedCategoryTab === 'Marketplace' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />
                )}
              </button>

              {/* TAB: VIP & LOYAL */}
              <button
                type="button"
                onClick={() => setSelectedCategoryTab('VIP')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  selectedCategoryTab === 'VIP'
                    ? 'bg-purple-950/60 border-purple-500/80 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-purple-900/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    <span>VIP & Loyal</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-1.5">
                  {categoryCounts.VIP.count}
                </div>
                <div className="text-xs text-purple-300/80 mt-1 truncate font-mono">
                  LTV: {formatCompact(categoryCounts.VIP.totalSpent)}
                </div>
                {selectedCategoryTab === 'VIP' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
                )}
              </button>
            </div>

            {/* Quick Reseller Switch Notice when Reseller tab is active */}
            {selectedCategoryTab === 'Reseller' && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Store className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-amber-200">
                    Menampilkan <strong>{categoryCounts.Reseller.count}</strong> customer yang bertindak sebagai mitra reseller.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMainView('crm_mitra')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Buka Hub CRM Mitra Lengkap &rarr;</span>
                </button>
              </div>
            )}

            {/* Secondary Filter Row: Search, Frequency, and Sort */}
            <div className="pt-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              {/* Search Input with Clear Button */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari nama customer, no. WhatsApp, kota domisili, atau catatan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/80 pl-9 pr-8 py-2 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                {searchQuery && (
                  <button aria-label="Hapus pencarian"
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Frequency Filter Segmented Controls */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800/80 text-xs overflow-x-auto scrollbar-none">
                <span className="text-xs text-slate-400 font-medium px-2 shrink-0">
                  Frekuensi:
                </span>
                <button
                  onClick={() => setSelectedFreqFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedFreqFilter === 'ALL'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setSelectedFreqFilter('baru')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedFreqFilter === 'baru'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Baru (1x)
                </button>
                <button
                  onClick={() => setSelectedFreqFilter('reguler')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedFreqFilter === 'reguler'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Reguler (2-4x)
                </button>
                <button
                  onClick={() => setSelectedFreqFilter('loyal')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedFreqFilter === 'loyal'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Loyal (≥5x)
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800/80 text-xs shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 text-xs">Sortir:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs"
                >
                  <option value="ltv_desc">Total Belanja (LTV) Tertinggi</option>
                  <option value="orders_desc">Order Terbanyak</option>
                  <option value="recent">Order Terkini</option>
                  <option value="name_asc">Nama (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MAIN CUSTOMERS TABLE */}
          {/* ========================================================================= */}
          <div className="bg-[#121620] rounded-3xl border border-slate-800/80 overflow-hidden shadow-md">
            <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#141924]/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Daftar Customer ({sortedCustomers.length} dari {customers.length})
                </span>
                {selectedCategoryTab !== 'ALL' && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Segmen: {selectedCategoryTab}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                Klik kategori untuk mengubah segmen • Centang kotak untuk aksi massal
              </div>
            </div>

            {/* Floating Bulk Action Bar */}
            {selectedCustomerIds.size > 0 && (
              <div className="bg-amber-950/40 border-b border-amber-500/30 p-3 px-5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    <span className="text-amber-400">{selectedCustomerIds.size}</span> customer dipilih
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Batch Category Quick Tagging */}
                  <div className="flex items-center gap-1 text-xs bg-slate-900/90 p-1 rounded-xl border border-slate-700">
                    <span className="text-slate-400 text-[11px] font-semibold px-1.5">Tandai Segmen:</span>
                    <button
                      type="button"
                      onClick={() => handleBulkSetCategory('Umum')}
                      className="px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-700 rounded-lg hover:bg-blue-900 transition-colors text-[11px] font-bold cursor-pointer"
                    >
                      Umum
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetCategory('Reseller')}
                      className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-700 rounded-lg hover:bg-amber-900 transition-colors text-[11px] font-bold cursor-pointer"
                    >
                      Reseller
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetCategory('Marketplace')}
                      className="px-2 py-0.5 bg-orange-950 text-orange-300 border border-orange-700 rounded-lg hover:bg-orange-900 transition-colors text-[11px] font-bold cursor-pointer"
                    >
                      Marketplace
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetCategory('VIP')}
                      className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-700 rounded-lg hover:bg-purple-900 transition-colors text-[11px] font-bold cursor-pointer"
                    >
                      VIP
                    </button>
                  </div>

                  {/* Bulk Delete Button */}
                  <button
                    type="button"
                    onClick={() => setIsBulkDeleteModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus {selectedCustomerIds.size} Kontak</span>
                  </button>

                  {/* Cancel selection */}
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerIds(new Set())}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0e1219] text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800/80">
                  <tr>
                    <th className="w-10 px-3.5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        title={
                          selectedCustomerIds.size === sortedCustomers.length && sortedCustomers.length > 0
                            ? 'Batalkan semua pilihan'
                            : 'Pilih semua customer yang tampil'
                        } aria-label={
                          selectedCustomerIds.size === sortedCustomers.length && sortedCustomers.length > 0
                            ? 'Batalkan semua pilihan'
                            : 'Pilih semua customer yang tampil'
                        }
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        {selectedCustomerIds.size > 0 && selectedCustomerIds.size === sortedCustomers.length ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3.5 font-bold">Customer & Kontak</th>
                    <th className="px-4 py-3.5 font-bold">Segmen CRM</th>
                    <th className="px-4 py-3.5 font-bold">Channel & Produk Favorit</th>
                    <th className="px-4 py-3.5 font-bold text-center">Repeat Buy</th>
                    <th className="px-4 py-3.5 font-bold text-right">Total Belanja (LTV)</th>
                    <th className="px-4 py-3.5 font-bold">Order Terakhir</th>
                    <th className="px-4 py-3.5 font-bold text-center">Aksi & Kemitraan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {sortedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                        <Users className="w-9 h-9 mx-auto text-slate-600 mb-2 opacity-40" />
                        <p className="text-sm font-semibold text-slate-400">Tidak ada customer yang sesuai kriteria.</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Coba sesuaikan kata kunci pencarian atau ganti filter kategori di atas.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedCustomers.map((cust) => {
                      const stats = customerStatsMap[cust.id] || {
                        totalOrders: 0,
                        totalPcs: 0,
                        totalSpent: 0,
                        channelsUsed: new Set(),
                        marketplaceOrdersCount: 0,
                        directOrdersCount: 0,
                        resellerOrdersCount: 0,
                        ordersList: [],
                        resolvedCategory: 'Umum',
                        isManualTagged: false,
                        frequencyTier: 'no_order',
                      };

                      const cat = stats.resolvedCategory;
                      const theme = getCategoryTheme(cat);
                      const isReseller = cat === 'Reseller';
                      const initials = getInitials(cust.nama);

                      // Format WhatsApp Phone Number
                      const cleanPhone = cust.noHp ? cust.noHp.replace(/[^0-9]/g, '') : '';
                      const waNumber = cleanPhone.startsWith('0')
                        ? '62' + cleanPhone.substring(1)
                        : cleanPhone;

                      return (
                        <tr
                          key={cust.id}
                          className={`hover:bg-slate-900/60 transition-colors group relative ${
                            selectedCustomerIds.has(cust.id) ? 'bg-amber-500/10' : ''
                          }`}
                        >
                          {/* Checkbox Row Selection */}
                          <td className="px-3.5 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectRow(cust.id)}
                              className="text-slate-500 hover:text-white cursor-pointer"
                            >
                              {selectedCustomerIds.has(cust.id) ? (
                                <CheckSquare className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* Customer Info with Initials Avatar */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 border ${theme.avatar}`}
                              >
                                <span>{initials}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-white flex items-center gap-1.5 text-sm truncate">
                                  <span className="truncate">{cust.nama}</span>
                                  {cust.kategoriManual && (
                                    <span
                                      title="Kategori ini ditetapkan secara manual oleh Admin"
                                      className="text-[11px] text-slate-400 font-mono tracking-tight"
                                    >
                                      (Manual)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                  {cleanPhone ? (
                                    <a
                                      href={`https://wa.me/${waNumber}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors font-mono"
                                      title="Hubungi via WhatsApp"
                                    >
                                      <Phone className="w-3 h-3 text-emerald-500" />
                                      <span>{cust.noHp}</span>
                                      <ArrowUpRight className="w-2.5 h-2.5 opacity-60" />
                                    </a>
                                  ) : (
                                    <span className="text-slate-600 font-mono">-</span>
                                  )}
                                  <span className="text-slate-600">·</span>
                                  <span className="flex items-center gap-1 truncate text-slate-400">
                                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span className="truncate">{cust.kota || 'Jakarta'}</span>
                                  </span>
                                </div>
                                {cust.catatan && (
                                  <div className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-xs">
                                    {cust.catatan}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Interactive Category Segmen with Quick Toggle Menu */}
                          <td className="px-4 py-3.5 relative">
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveTagDropdownId(
                                    activeTagDropdownId === cust.id ? null : cust.id
                                  )
                                }
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs ${theme.badge} hover:brightness-110`}
                                title="Klik untuk mengubah segmen customer" aria-label="Klik untuk mengubah segmen customer"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                                <span>{cat}</span>
                                <ChevronDown className="w-3 h-3 opacity-60" />
                              </button>

                              {/* Quick Tagging Popover Dropdown */}
                              {activeTagDropdownId === cust.id && (
                                <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#0f141d] border border-slate-700/80 rounded-2xl p-1.5 z-40 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 space-y-0.5">
                                  <div className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-slate-800">
                                    Ubah Segmen:
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSetQuickTag(cust.id, 'Umum')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-blue-300 hover:bg-blue-950/80 transition-colors text-left"
                                  >
                                    <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Umum (Retail)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetQuickTag(cust.id, 'Reseller')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-amber-300 hover:bg-amber-950/80 transition-colors text-left"
                                  >
                                    <Store className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Reseller (Mitra)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetQuickTag(cust.id, 'Marketplace')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-orange-300 hover:bg-orange-950/80 transition-colors text-left"
                                  >
                                    <Zap className="w-3.5 h-3.5 text-orange-400" />
                                    <span>Marketplace</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetQuickTag(cust.id, 'VIP')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-purple-300 hover:bg-purple-950/80 transition-colors text-left"
                                  >
                                    <Crown className="w-3.5 h-3.5 text-purple-400" />
                                    <span>VIP & Loyal</span>
                                  </button>
                                  {cust.kategoriManual && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetToAutoTag(cust.id)}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-slate-400 hover:bg-slate-800 transition-colors text-left border-t border-slate-800 mt-1"
                                    >
                                      <Sparkles className="w-3 h-3 text-slate-400" />
                                      <span>Reset ke Auto-Detect</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Quiet Unboxed Loyalty Tier Subtext */}
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
                              {stats.frequencyTier === 'loyal' && (
                                <span className="text-amber-400">Loyal ({stats.totalOrders}x order)</span>
                              )}
                              {stats.frequencyTier === 'reguler' && (
                                <span className="text-blue-400">Reguler ({stats.totalOrders}x order)</span>
                              )}
                              {stats.frequencyTier === 'baru' && (
                                <span className="text-emerald-400">Pelanggan Baru (1x)</span>
                              )}
                              {stats.frequencyTier === 'no_order' && (
                                <span className="text-slate-500">Belum ada order</span>
                              )}
                            </div>
                          </td>

                          {/* Sales Channels Used & Favorite Product */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {stats.channelsUsed.size === 0 ? (
                                <span className="text-slate-500 text-xs">-</span>
                              ) : (
                                Array.from(stats.channelsUsed).map((ch) => {
                                  return (
                                    <span
                                      key={ch}
                                      className="text-xs text-slate-300 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md font-medium"
                                    >
                                      {ch}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                            {stats.topItem && (
                              <div className="text-xs text-slate-400 mt-1 truncate max-w-[210px]">
                                Top: <span className="text-slate-300 font-medium">{stats.topItem}</span>
                              </div>
                            )}
                          </td>

                          {/* Repeat Buy & Total Qty */}
                          <td className="px-4 py-3.5 text-center">
                            {stats.totalOrders > 0 ? (
                              <div>
                                <span className="text-sm font-black text-white font-mono">
                                  {stats.totalOrders}x
                                </span>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  {stats.totalPcs} pcs
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-xs font-mono">0x</span>
                            )}
                          </td>

                          {/* Total Spending (LTV) */}
                          <td className="px-4 py-3.5 text-right font-mono">
                            {stats.totalSpent > 0 ? (
                              <div>
                                <div className="text-sm font-black text-emerald-400">
                                  {formatRupiah(stats.totalSpent)}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  AOV: {formatRupiah(Math.round(stats.totalSpent / (stats.totalOrders || 1)))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-xs font-mono">Rp 0</span>
                            )}
                          </td>

                          {/* Order Terakhir */}
                          <td className="px-4 py-3.5">
                            {stats.lastOrderDate ? (
                              <div>
                                <div className="font-semibold text-slate-200 text-xs font-mono">
                                  {stats.lastOrderDate}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  via {stats.lastChannel || 'Direct'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-xs">-</span>
                            )}
                          </td>

                          {/* Actions: Jadikan Mitra / Histori / Edit */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Button: Jadikan Mitra / Kelola Mitra */}
                              {!isReseller ? (
                                <button
                                  onClick={() => handleOpenPromote(cust)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold border border-amber-500/30 text-xs transition-all cursor-pointer shadow-2xs"
                                  title="Tentukan customer ini sebagai Mitra / Reseller resmi" aria-label="Tentukan customer ini sebagai Mitra / Reseller resmi"
                                >
                                  <Store className="w-3.5 h-3.5" />
                                  <span>+ Mitra</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setActiveMainView('crm_mitra');
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                  title="Buka Hub CRM Mitra untuk toko ini" aria-label="Buka Hub CRM Mitra untuk toko ini"
                                >
                                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Kelola Mitra</span>
                                </button>
                              )}

                              {/* Button: Lihat Histori Order */}
                              <button
                                onClick={() => setHistoryCustomerModal(cust)}
                                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                                title="Lihat Rincian Seluruh Riwayat Order Customer" aria-label="Lihat Rincian Seluruh Riwayat Order Customer"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>

                              {/* Button: Edit Customer Data */}
                              <button
                                onClick={() => setEditCustomerModal(cust)}
                                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                                title="Edit Data Kontak & Catatan" aria-label="Edit Data Kontak & Catatan"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Button: Hapus Customer */}
                              <button
                                onClick={() => setDeleteConfirmCustomer(cust)}
                                className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/70 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-500/50 transition-colors cursor-pointer"
                                title="Hapus customer ini dari database" aria-label="Hapus customer ini dari database"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar for Customers */}
            {sortedCustomers.length > customerPageSize && (
              <div className="px-5 py-3.5 bg-[#141924]/60 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-400">
                <div>
                  Menampilkan <span className="font-semibold text-white">{(customerPage - 1) * customerPageSize + 1}</span> - <span className="font-semibold text-white">{Math.min(customerPage * customerPageSize, sortedCustomers.length)}</span> dari <span className="font-semibold text-white">{sortedCustomers.length}</span> customer
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                    disabled={customerPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer text-xs font-medium transition-colors"
                  >
                    &larr; Sebelumnya
                  </button>
                  <div className="px-2 font-mono text-white text-xs">
                    {customerPage} / {totalCustomerPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerPage((p) => Math.min(totalCustomerPages, p + 1))}
                    disabled={customerPage >= totalCustomerPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer text-xs font-medium transition-colors"
                  >
                    Selanjutnya &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Tentukan Jadi Mitra / Reseller */}
      {/* ========================================================================= */}
      {promoteCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-amber-500/50 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Tentukan Customer Sebagai Mitra / Reseller
                  </h3>
                  <p className="text-xs text-slate-400">
                    {promoteCustomerModal.nama} ({promoteCustomerModal.noHp})
                  </p>
                </div>
              </div>
              <button aria-label="Tutup" data-modal-close
                onClick={() => setPromoteCustomerModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-sm cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleConfirmPromote} className="space-y-4 text-xs">
              <div className="bg-amber-950/40 border border-amber-800/60 p-3.5 rounded-xl text-amber-200 text-xs leading-relaxed">
                <strong>Hak Akses Mitra Reseller:</strong> Customer akan resmi tercatat di modul <strong>CRM Mitra Reseller</strong> untuk pengiriman surat jalan titip konsinyasi, harga khusus reseller, serta monitoring piutang dan stok di toko mitra.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Tingkatan Level Mitra
                  </label>
                  <select
                    value={mitraLevel}
                    onChange={(e) => setMitraLevel(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Platinum">Platinum (Prioritas Utama)</option>
                    <option value="Gold">Gold (Standar Mitra)</option>
                    <option value="Silver">Silver (Mitra Pemula)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Diskon Khusus Mitra (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="70"
                      value={mitraDiskon}
                      onChange={(e) => setMitraDiskon(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white pr-8 focus:outline-none focus:border-amber-500 font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 font-bold">%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Plafon Maksimal Titipan (Rp)
                  </label>
                  <input
                    type="number"
                    step="500000"
                    value={mitraPlafon}
                    onChange={(e) => setMitraPlafon(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {formatRupiah(mitraPlafon)}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Jadwal Setoran & Opname
                  </label>
                  <select
                    value={mitraJadwal}
                    onChange={(e) => setMitraJadwal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Setiap Hari Senin">Setiap Hari Senin</option>
                    <option value="Setiap Hari Jumat">Setiap Hari Jumat</option>
                    <option value="Tiap Tanggal 1 & 15">Tiap Tanggal 1 & 15</option>
                    <option value="Akhir Bulan">Akhir Bulan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Alamat Lengkap Toko / Pengiriman Mitra
                </label>
                <textarea
                  rows={2}
                  value={mitraAlamat}
                  onChange={(e) => setMitraAlamat(e.target.value)}
                  placeholder="Jl. Nama Jalan No. XX, Kecamatan, Kota..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPromoteCustomerModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Simpan Status Mitra</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Histori Order Lengkap Customer */}
      {/* ========================================================================= */}
      {historyCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base">
                    Riwayat Transaksi: {historyCustomerModal.nama}
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {customerStatsMap[historyCustomerModal.id]?.resolvedCategory || 'Umum'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {historyCustomerModal.noHp} • {historyCustomerModal.kota}
                </p>
              </div>
              <button aria-label="Tutup" data-modal-close
                onClick={() => setHistoryCustomerModal(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {customerStatsMap[historyCustomerModal.id]?.ordersList.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <ShoppingBag className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-40" />
                  <p className="font-semibold text-slate-400">Belum ada riwayat pesanan.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Buat order baru menggunakan tombol di bawah.
                  </p>
                </div>
              ) : (
                customerStatsMap[historyCustomerModal.id]?.ordersList.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">
                          {ord.noOrder}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                            ord.channel === 'Shopee'
                              ? 'bg-orange-950 text-orange-300 border-orange-800'
                              : ord.channel === 'Umum'
                              ? 'bg-blue-950 text-blue-300 border-blue-800'
                              : ord.channel === 'Reseller'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {ord.channel}
                        </span>
                        <span className="text-slate-400 text-xs">{ord.tanggal}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            ord.statusBayar === 'lunas'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : ord.statusBayar === 'piutang'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {ord.statusBayar.toUpperCase()}
                        </span>
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          {formatRupiah(ord.totalTagihan)}
                        </span>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      {ord.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-slate-200">
                            • {it.namaProduk} <span className="text-amber-400 font-bold">x{it.qty}</span>
                          </span>
                          <span className="text-slate-400 font-mono">
                            {formatRupiah(it.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {ord.noResi && (
                      <div className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg inline-block">
                        No. Resi: <span className="text-white font-mono">{ord.noResi}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0e1219] flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Total Akumulasi:{' '}
                <strong className="text-emerald-400 font-mono">
                  {formatRupiah(customerStatsMap[historyCustomerModal.id]?.totalSpent || 0)}
                </strong>
              </div>
              <button
                onClick={() => {
                  setHistoryCustomerModal(null);
                  setQuickOrderModalOpen(true);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Buat Order untuk Customer Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Tambah Customer Baru */}
      {/* ========================================================================= */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Tambah Customer Baru</h3>
              <button aria-label="Tutup" data-modal-close
                onClick={() => setIsAddCustomerOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveNewCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Nama Customer / Toko *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Budi Santoso / Distro Street Makassar"
                  value={newCustNama}
                  onChange={(e) => setNewCustNama(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 081298765432"
                    value={newCustHp}
                    onChange={(e) => setNewCustHp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Kota Domisili
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bandung, Jakarta"
                    value={newCustKota}
                    onChange={(e) => setNewCustKota(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Kategori Customer (Tagging)
                </label>
                <select
                  value={newCustCategory}
                  onChange={(e) => setNewCustCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Umum">Umum (Retail / Direct Walk-in / WhatsApp)</option>
                  <option value="Reseller">Reseller (Mitra Konsinyasi & Grosir)</option>
                  <option value="Marketplace">Marketplace (Shopee / TikTok Shop)</option>
                  <option value="VIP">VIP (Pelanggan Prioritas / Loyal)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Alamat Pengiriman (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap tujuan pengiriman ekspedisi..."
                  value={newCustAlamat}
                  onChange={(e) => setNewCustAlamat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Catatan Customer (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sering order via Shopee Live, langganan 210 OV"
                  value={newCustCatatan}
                  onChange={(e) => setNewCustCatatan(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Simpan Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Edit Customer Data & Manual Tag */}
      {/* ========================================================================= */}
      {editCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Edit Data & Tagging Customer</h3>
              <button aria-label="Tutup" data-modal-close
                onClick={() => setEditCustomerModal(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Nama Customer
                </label>
                <input
                  type="text"
                  required
                  value={editCustomerModal.nama}
                  onChange={(e) =>
                    setEditCustomerModal({ ...editCustomerModal, nama: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    No. HP / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={editCustomerModal.noHp}
                    onChange={(e) =>
                      setEditCustomerModal({ ...editCustomerModal, noHp: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Kota
                  </label>
                  <input
                    type="text"
                    value={editCustomerModal.kota}
                    onChange={(e) =>
                      setEditCustomerModal({ ...editCustomerModal, kota: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Kategori / Tagging Tetap (Manual Override)
                </label>
                <select
                  value={
                    editCustomerModal.kategoriManual ||
                    (editCustomerModal.tipe === 'Retail' ? 'Umum' : editCustomerModal.tipe) ||
                    'Umum'
                  }
                  onChange={(e) => {
                    const val = e.target.value as 'Umum' | 'Reseller' | 'Marketplace' | 'VIP';
                    setEditCustomerModal({
                      ...editCustomerModal,
                      tipe: val === 'Umum' ? 'Retail' : val,
                      kategoriManual: val,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 cursor-pointer font-semibold"
                >
                  <option value="Umum">Umum (Retail / Direct)</option>
                  <option value="Reseller">Reseller (Mitra Konsinyasi & Grosir)</option>
                  <option value="Marketplace">Marketplace (Shopee / TikTok Shop)</option>
                  <option value="VIP">VIP (Pelanggan Prioritas)</option>
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Menetapkan kategori ini akan menimpa deteksi otomatis sistem.
                </span>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={editCustomerModal.alamat || ''}
                  onChange={(e) =>
                    setEditCustomerModal({ ...editCustomerModal, alamat: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  value={editCustomerModal.catatan || ''}
                  onChange={(e) =>
                    setEditCustomerModal({ ...editCustomerModal, catatan: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = editCustomerModal;
                      setEditCustomerModal(null);
                      setDeleteConfirmCustomer(target);
                    }}
                    className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Customer</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditCustomerModal(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Impor Kontak CSV / Excel */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-blue-500/50 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Impor Kontak Customer (CSV / Excel)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Salin (copy-paste) data kontak langsung dari spreadsheet Anda
                  </p>
                </div>
              </div>
              <button aria-label="Tutup" data-modal-close
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-sm cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-slate-300 space-y-1.5">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Format Kolom (Bisa dipisahkan Koma atau Tab Excel):</span>
                </div>
                <code className="block bg-slate-950 p-2 rounded text-xs font-mono text-emerald-300">
                  Nama, Nomor HP, Kota, Kategori (Umum/Reseller/Marketplace/VIP), Alamat, Catatan
                </code>
                <div className="text-xs text-slate-400">
                  Contoh: <br />
                  <code className="text-slate-300">
                    Budi Santoso, 08123456789, Bandung, Reseller, Jl. Riau No 10, Toko Distro
                  </code>
                </div>
              </div>

              {importError && (
                <div className="bg-rose-950/70 border border-rose-500/50 text-rose-300 p-2.5 rounded-xl text-xs">
                  {importError}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Tempel (Paste) Baris Data Teks / CSV di Sini:
                </label>
                <textarea
                  rows={7}
                  placeholder={`Contoh tempel langsung dari Excel:\nDimas Setiawan\t081299887766\tJakarta\tUmum\tJl. Thamrin No 5\nKurnia Fashion\t085211223344\tSurabaya\tReseller\tPasar Turi Blok B`}
                  value={importCsvText}
                  onChange={(e) => setImportCsvText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleProcessImportCsv}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  Proses & Simpan ke Database
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Konfirmasi Hapus Single Customer */}
      {/* ========================================================================= */}
      {deleteConfirmCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-rose-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Hapus Data Customer?</h3>
                <p className="text-xs text-slate-400">Konfirmasi penghapusan data master customer</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Anda akan menghapus data customer berikut dari database sistem:
              </p>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="text-sm font-bold text-white flex items-center justify-between">
                  <span>{deleteConfirmCustomer.nama}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {deleteConfirmCustomer.id}
                  </span>
                </div>
                <div className="text-slate-400 text-xs flex items-center gap-2">
                  <span>{deleteConfirmCustomer.noHp || 'Tidak ada no. HP'}</span>
                  <span>•</span>
                  <span>{deleteConfirmCustomer.kota || 'Jakarta'}</span>
                </div>
                {customerStatsMap[deleteConfirmCustomer.id] && (
                  <div className="text-xs text-amber-400 pt-1 border-t border-slate-900 flex justify-between">
                    <span>Total Order: {customerStatsMap[deleteConfirmCustomer.id].totalOrders}x</span>
                    <span>Total Belanja: {formatRupiah(customerStatsMap[deleteConfirmCustomer.id].totalSpent)}</span>
                  </div>
                )}
              </div>

              <div className="bg-rose-950/40 border border-rose-800/60 p-3 rounded-xl text-rose-200 text-xs leading-relaxed">
                <strong>Catatan:</strong> Data customer ini akan dihapus dari daftar CRM master. Riwayat nota penjualan dan buku kas yang pernah tercatat sebelumnya tetap aman.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmCustomer(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Konfirmasi Hapus Massal (Bulk Delete) */}
      {/* ========================================================================= */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-rose-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
                <Trash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Hapus {selectedCustomerIds.size} Customer Terpilih?
                </h3>
                <p className="text-xs text-slate-400">Tindakan ini menghapus banyak data customer sekaligus</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus <strong className="text-white font-bold">{selectedCustomerIds.size} kontak customer</strong> yang Anda centang dari database?
              </p>

              <div className="bg-rose-950/40 border border-rose-800/60 p-3 rounded-xl text-rose-200 text-xs leading-relaxed">
                Kontak yang dihapus tidak dapat dipulihkan secara otomatis kecuali diimpor ulang atau disinkronkan kembali dari transaksi order.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus {selectedCustomerIds.size} Data Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
