import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  Search,
  DollarSign,
  Layers,
  Edit2,
  Trash2,
  CheckCircle2,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Palette,
  ImageOff,
  RotateCcw,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SKUItem, ApparelSize, ProductSeries, ApparelFit, BOMItem } from '../types';
import { INITIAL_COLORS } from '../data/initialData';
import { askConfirm } from '../services/dialogStore';
import {
  averageMarginPercent,
  productImageUrl,
  sizeOptions,
  skuStockTotals,
  sortSkus,
  stockStatus,
  SkuSortKey,
  StockStatus,
} from '../services/skuCatalog';

const LIST_PAGE_SIZE = 25;

const rupiah = (value: number): string => `Rp ${Math.round(value).toLocaleString('id-ID')}`;

const CARD = 'bg-white rounded-2xl border border-slate-200';
const INPUT = 'w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-slate-500';
const OUTLINE_BUTTON =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer';
const PRIMARY_BUTTON = 'segmented-pill-active inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer';

const STATUS_BADGE: Record<StockStatus, { label: string; className: string }> = {
  minus: { label: 'Minus', className: 'bg-rose-100 text-rose-800' },
  habis: { label: 'Habis', className: 'bg-rose-50 text-rose-700' },
  menipis: { label: 'Menipis', className: 'bg-amber-100 text-amber-800' },
  aman: { label: 'Aman', className: 'bg-slate-100 text-slate-700' },
};

const SORT_LABELS: Record<SkuSortKey, string> = {
  kode: 'Urut: Kode SKU',
  stok_terendah: 'Urut: Stok terendah',
  stok_tertinggi: 'Urut: Stok tertinggi',
  margin_tertinggi: 'Urut: Margin tertinggi',
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-slate-600 mb-1">{label}</span>
    {children}
  </label>
);

const Modal: React.FC<{ title: React.ReactNode; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; narrow?: boolean }> = ({
  title,
  icon,
  onClose,
  children,
  narrow,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
    <div className={`w-full ${narrow ? 'max-w-sm' : 'max-w-md'} bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xl text-xs max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <button type="button" onClick={onClose} aria-label="Tutup" className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

/** Foto lini; bila gagal dimuat diganti kotak polos agar teks alt tidak menumpuk. */
const SeriesPhoto: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  const url = productImageUrl(src);
  if (!url || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400">
        <ImageOff className="w-6 h-6" />
        <span className="text-[11px]">Foto belum ada</span>
      </div>
    );
  }
  return <img src={url} alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="w-full h-full object-cover object-center" />;
};

export const ProductsView: React.FC = () => {
  const {
    series,
    skus,
    bomItems,
    isOwner,
    updateSeries,
    updateSKU,
    addSKU,
    deleteSKU,
    updateBOM,
    calculateStockSummary,
    syncAllSkuNames,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'katalog_seri' | 'semua_sku' | 'bom_aksesoris'>('semua_sku');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<string>('ALL');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SkuSortKey>('kode');
  const [visibleSkuCount, setVisibleSkuCount] = useState(LIST_PAGE_SIZE);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Edit Series (Owner Only)
  const [editingSeries, setEditingSeries] = useState<ProductSeries | null>(null);
  const [editSeriesName, setEditSeriesName] = useState('');
  const [editSeriesGsm, setEditSeriesGsm] = useState<number>(210);
  const [editSeriesFit, setEditSeriesFit] = useState<ApparelFit>('Oversize');
  const [editSeriesBaseCost, setEditSeriesBaseCost] = useState<number>(0);
  const [editSeriesPrice, setEditSeriesPrice] = useState<number>(0);
  const [editSeriesDesc, setEditSeriesDesc] = useState('');

  // Modal Add SKU
  const [isAddSkuOpen, setIsAddSkuOpen] = useState(false);
  const [newSkuCode, setNewSkuCode] = useState('');
  const [newCustomName, setNewCustomName] = useState('');
  const [newSeriesCode, setNewSeriesCode] = useState('210OV');
  const [newColorCode, setNewColorCode] = useState('HT');
  const [newColorName, setNewColorName] = useState('Hitam');
  const [newSize, setNewSize] = useState<string>('XL');
  const [newPrice, setNewPrice] = useState<number>(129000);
  const [newHppCustom, setNewHppCustom] = useState<number>(0);
  const [newMinStock, setNewMinStock] = useState<number>(10);

  // Edit SKU Modal
  const [editingSku, setEditingSku] = useState<SKUItem | null>(null);
  const [editSkuCode, setEditSkuCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editColorName, setEditColorName] = useState('');
  const [editSize, setEditSize] = useState<string>('L');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editHpp, setEditHpp] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(0);
  const [skuToDelete, setSkuToDelete] = useState<SKUItem | null>(null);

  // BOM Edit State (Owner Only)
  const [tempBom, setTempBom] = useState<BOMItem[]>(bomItems);

  const totalAksesoris = useMemo(() => bomItems.reduce((acc, it) => acc + it.biayaPerUnit, 0), [bomItems]);
  const tempBomTotal = tempBom.reduce((acc, it) => acc + (it.biayaPerUnit || 0), 0);
  const bomChanged = JSON.stringify(tempBom) !== JSON.stringify(bomItems);

  const stockSummary = useMemo(() => calculateStockSummary(), [calculateStockSummary]);
  const stockOf = (code: string) => {
    const entry = stockSummary[code];
    return { gudang: entry?.gudang ?? 0, total: entry?.total ?? 0 };
  };

  const allSizes = useMemo(() => sizeOptions(skus.map((s) => s.size)), [skus]);
  const seriesCodes = useMemo(() => new Set(series.map((s) => s.code)), [series]);
  const otherSeriesCodes = useMemo(
    () => [...new Set(skus.map((s) => s.seriesCode).filter((code) => code && !seriesCodes.has(code)))].sort(),
    [skus, seriesCodes],
  );
  const skusOutsideSeries = skus.filter((s) => !seriesCodes.has(s.seriesCode));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredSkus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matches = skus.filter((item) => {
      const matchesSearch =
        !q ||
        [item.sku, item.name, item.colorName, item.seriesCode, item.size].some((value) => value && value.toLowerCase().includes(q));
      const matchesSeries = selectedSeries === 'ALL' || item.seriesCode === selectedSeries;
      const matchesSize = selectedSizeFilter === 'ALL' || item.size === selectedSizeFilter;
      return matchesSearch && matchesSeries && matchesSize;
    });
    return sortSkus(matches, sortKey, (code) => stockSummary[code]?.gudang ?? 0);
  }, [skus, searchQuery, selectedSeries, selectedSizeFilter, sortKey, stockSummary]);

  const filteredTotals = skuStockTotals(filteredSkus, stockOf);
  const filteredMargin = averageMarginPercent(filteredSkus);

  /** Ubah filter sekaligus kembali ke halaman pertama daftar. */
  const withReset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setVisibleSkuCount(LIST_PAGE_SIZE);
  };

  const openSeriesSkus = (code: string) => {
    setSelectedSeries(code);
    setSearchQuery('');
    setSelectedSizeFilter('ALL');
    setVisibleSkuCount(LIST_PAGE_SIZE);
    setActiveTab('semua_sku');
  };

  const handleOpenEditSeries = (ser: ProductSeries) => {
    setEditingSeries(ser);
    setEditSeriesName(ser.name);
    setEditSeriesGsm(ser.gsm);
    setEditSeriesFit(ser.fit);
    setEditSeriesBaseCost(ser.baseCost);
    setEditSeriesPrice(ser.defaultPrice);
    setEditSeriesDesc(ser.description);
  };

  const handleSaveEditSeries = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeries) {
      return;
    }
    updateSeries(editingSeries.id, {
      name: editSeriesName.trim() || editingSeries.name,
      gsm: editSeriesGsm || editingSeries.gsm,
      fit: editSeriesFit || editingSeries.fit,
      baseCost: editSeriesBaseCost,
      defaultPrice: editSeriesPrice,
      description: editSeriesDesc.trim() || editingSeries.description,
    });
    setEditingSeries(null);
    showToast(`Lini "${editSeriesName}" diperbarui.`);
  };

  const handleOpenEditSku = (sku: SKUItem) => {
    setEditingSku(sku);
    setEditSkuCode(sku.sku);
    setEditName(sku.name);
    setEditColorName(sku.colorName || '');
    setEditSize(sku.size || 'L');
    setEditPrice(sku.price);
    setEditHpp(sku.hpp);
    setEditMinStock(sku.minStock);
  };

  const handleSaveAddSku = (e: React.FormEvent) => {
    e.preventDefault();
    const serObj = series.find((s) => s.code === newSeriesCode);
    const generatedSku = newSkuCode.trim() || `KL-${newSeriesCode}-${newColorCode || 'STD'}-${newSize}`;
    const baseCost = serObj?.baseCost || 45000;
    const defaultHpp = baseCost + totalAksesoris;
    const finalHpp = newHppCustom > 0 ? newHppCustom : defaultHpp;
    const finalName = newCustomName.trim() || `Kalima ${serObj?.name || newSeriesCode} - ${newColorName || 'Standard'} (${newSize})`;

    const item: SKUItem = {
      sku: generatedSku,
      seriesId: serObj?.id || 'ser-custom',
      seriesCode: newSeriesCode,
      colorCode: newColorCode || 'STD',
      colorName: newColorName || 'Standard',
      size: newSize as ApparelSize,
      name: finalName,
      price: newPrice,
      hpp: finalHpp,
      minStock: newMinStock,
      active: true,
    };

    addSKU(item);
    setIsAddSkuOpen(false);
    setNewSkuCode('');
    setNewCustomName('');
    setNewHppCustom(0);
    showToast(`SKU ${item.sku} ditambahkan.`);
  };

  const handleSaveEditSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSku) {
      return;
    }
    updateSKU(editingSku.sku, {
      sku: editSkuCode.trim() || editingSku.sku,
      name: editName.trim() || editingSku.name,
      colorName: editColorName.trim() || editingSku.colorName,
      size: (editSize as ApparelSize) || editingSku.size,
      price: editPrice,
      hpp: editHpp > 0 ? editHpp : editingSku.hpp,
      minStock: editMinStock,
    });
    setEditingSku(null);
    showToast(`SKU ${editingSku.sku} diperbarui.`);
  };

  const handleDeleteSku = (skuCode: string) => {
    deleteSKU(skuCode);
    setSkuToDelete(null);
    setEditingSku(null);
    showToast(`SKU ${skuCode} dihapus.`);
  };

  const updateBomRow = (index: number, changes: Partial<BOMItem>) =>
    setTempBom((prev) => prev.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  const handleSaveBom = async (e: React.FormEvent) => {
    e.preventDefault();
    const confirmed = await askConfirm(
      `Total aksesoris menjadi ${rupiah(tempBomTotal)}/pcs. HPP seluruh ${skus.length} SKU akan diganti menjadi HPP standar seri (kaos polos + aksesoris). HPP yang pernah diubah manual per SKU ikut tertimpa.`,
      { title: 'Simpan BOM & hitung ulang HPP?', confirmLabel: 'Simpan & hitung ulang' },
    );
    if (!confirmed) {
      return;
    }
    updateBOM(tempBom);
    showToast('BOM disimpan; HPP seluruh SKU dihitung ulang.');
  };

  const handleSyncNames = () => {
    syncAllSkuNames();
    showToast('Nama seluruh SKU disamakan dengan format standar.');
  };

  const tabClass = (tab: typeof activeTab) =>
    `flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
      activeTab === tab ? 'segmented-pill-active' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  const visibleSkus = filteredSkus.slice(0, visibleSkuCount);
  const deleteStock = skuToDelete ? stockOf(skuToDelete.sku) : null;

  return (
    <div className="space-y-5 pb-12">
      {toastMessage && (
        <div
          role="status"
          className="fixed top-20 right-5 z-50 p-3.5 bg-white border border-slate-200 text-slate-900 text-xs rounded-xl shadow-2xl flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Subnav Tabs */}
      <div className="segmented-pill-bar flex items-center gap-1 overflow-x-auto bg-white">
        <button type="button" onClick={() => setActiveTab('katalog_seri')} className={tabClass('katalog_seri')}>
          <Layers className="w-4 h-4 hidden sm:block" />
          <span>Lini Produk</span>
        </button>
        <button type="button" onClick={() => setActiveTab('semua_sku')} className={tabClass('semua_sku')}>
          <Tag className="w-4 h-4 hidden sm:block" />
          <span>Daftar SKU ({skus.length})</span>
        </button>
        {isOwner && (
          <button type="button" onClick={() => setActiveTab('bom_aksesoris')} className={tabClass('bom_aksesoris')}>
            <DollarSign className="w-4 h-4 hidden sm:block" />
            <span>BOM & HPP</span>
          </button>
        )}
      </div>

      {/* TAB 1: LINI PRODUK */}
      {activeTab === 'katalog_seri' && (
        <div className="space-y-4">
          <div className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">{series.length} Lini Produk</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                HPP standar = kaos polos + BOM aksesoris {rupiah(totalAksesoris)}. Nilai stok memakai HPP masing-masing SKU.
              </p>
            </div>
            {isOwner && (
              <button type="button" onClick={handleSyncNames} className={`${OUTLINE_BUTTON} shrink-0`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Samakan Nama SKU</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {series.map((ser) => {
              const seriesSkus = skus.filter((s) => s.seriesCode === ser.code);
              const totals = skuStockTotals(seriesSkus, stockOf);
              const colorPalette = INITIAL_COLORS[ser.code] || [];
              const hppStandar = ser.baseCost + totalAksesoris;
              const marginRp = ser.defaultPrice - hppStandar;
              const marginPct = ser.defaultPrice > 0 ? ((marginRp / ser.defaultPrice) * 100).toFixed(1).replace('.', ',') : '0';

              return (
                <div key={ser.id} className={`${CARD} overflow-hidden flex flex-col`}>
                  <div className="h-40 bg-slate-100">
                    <SeriesPhoto src={ser.image} alt={ser.name} />
                  </div>

                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">{ser.name}</h3>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditSeries(ser)}
                            title="Edit lini produk"
                            aria-label={`Edit lini ${ser.name}`}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {[ser.code, `${ser.gsm} GSM`, `${ser.fit} Fit`].map((chip) => (
                          <span key={chip} className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                            {chip}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mt-2">{ser.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {colorPalette.map((col) => (
                        <span key={col.code} className="flex items-center gap-1 text-[11px] text-slate-600" title={`${col.name} (${col.code})`}>
                          <span className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: col.hex }} />
                          {col.name}
                        </span>
                      ))}
                    </div>

                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t border-slate-100 pt-3">
                      <div>
                        <dt className="text-slate-500">Harga jual</dt>
                        <dd className="font-mono font-bold text-slate-900">{rupiah(ser.defaultPrice)}</dd>
                      </div>
                      {isOwner ? (
                        <div>
                          <dt className="text-slate-500">Margin standar</dt>
                          <dd className="font-mono font-bold text-slate-900">
                            {rupiah(marginRp)} <span className="text-slate-500 font-normal">({marginPct}%)</span>
                          </dd>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-500">
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>HPP & margin khusus owner</span>
                        </div>
                      )}
                      <div>
                        <dt className="text-slate-500">Stok gudang</dt>
                        <dd className="font-mono font-bold text-slate-900">{totals.gudang.toLocaleString('id-ID')} pcs</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Titipan reseller</dt>
                        <dd className="font-mono font-bold text-slate-900">{totals.reseller.toLocaleString('id-ID')} pcs</dd>
                      </div>
                      {isOwner && (
                        <div className="col-span-2">
                          <dt className="text-slate-500">Nilai HPP stok</dt>
                          <dd className="font-mono font-bold text-slate-900">{rupiah(totals.value)}</dd>
                        </div>
                      )}
                    </dl>

                    {totals.minusCount > 0 && (
                      <p className="text-[11px] text-rose-700">{totals.minusCount} SKU stoknya minus (tidak dihitung di atas).</p>
                    )}

                    {isOwner && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-600 font-semibold">Rincian HPP standar {rupiah(hppStandar)}</summary>
                        <div className="mt-2 space-y-1 text-slate-600">
                          <div className="flex justify-between">
                            <span>Kaos polos konveksi</span>
                            <span className="font-mono">{rupiah(ser.baseCost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>BOM aksesoris & packing</span>
                            <span className="font-mono">{rupiah(totalAksesoris)}</span>
                          </div>
                        </div>
                      </details>
                    )}

                    <button type="button" onClick={() => openSeriesSkus(ser.code)} className={`${OUTLINE_BUTTON} w-full mt-auto`}>
                      <span>Lihat {seriesSkus.length} SKU</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {skusOutsideSeries.length > 0 && (
            <div className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs`}>
              <span className="text-slate-600">
                {skusOutsideSeries.length} SKU di luar lini ({otherSeriesCodes.join(', ')}), misalnya tas atau aksesoris.
              </span>
              <button
                type="button"
                onClick={() => openSeriesSkus(otherSeriesCodes.length === 1 ? otherSeriesCodes[0] : 'ALL')}
                className={OUTLINE_BUTTON}
              >
                Lihat SKU
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAFTAR SKU */}
      {activeTab === 'semua_sku' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`${CARD} p-3`}>
              <span className="text-xs text-slate-500">Jumlah SKU</span>
              <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{filteredSkus.length} SKU</p>
            </div>
            <div className={`${CARD} p-3`}>
              <span className="text-xs text-slate-500">Stok gudang</span>
              <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{filteredTotals.gudang.toLocaleString('id-ID')} pcs</p>
              {filteredTotals.minusCount > 0 && (
                <p className="text-[11px] text-rose-700 mt-0.5">{filteredTotals.minusCount} SKU minus, tidak dihitung</p>
              )}
            </div>
            {isOwner ? (
              <>
                <div className={`${CARD} p-3`}>
                  <span className="text-xs text-slate-500" title="Total (harga − HPP) dibagi total harga dari SKU yang tampil">
                    Margin kotor gabungan
                  </span>
                  <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{filteredMargin === null ? '–' : `${filteredMargin.toLocaleString('id-ID')}%`}</p>
                </div>
                <div className={`${CARD} p-3`}>
                  <span className="text-xs text-slate-500" title="(Stok gudang + reseller) × HPP SKU; stok minus tidak dihitung">
                    Nilai HPP stok
                  </span>
                  <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{rupiah(filteredTotals.value)}</p>
                </div>
              </>
            ) : (
              <div className={`${CARD} p-3`}>
                <span className="text-xs text-slate-500">Titipan reseller</span>
                <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{filteredTotals.reseller.toLocaleString('id-ID')} pcs</p>
              </div>
            )}
          </div>

          <div className={`${CARD} p-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-3`}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Cari SKU"
                placeholder="Cari kode SKU, nama, warna, ukuran…"
                value={searchQuery}
                onChange={(e) => withReset(setSearchQuery)(e.target.value)}
                className="w-full bg-white border border-slate-300 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <select
                aria-label="Lini"
                value={selectedSeries}
                onChange={(e) => withReset(setSelectedSeries)(e.target.value)}
                className="bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua lini</option>
                {series.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name}
                  </option>
                ))}
                {otherSeriesCodes.map((code) => (
                  <option key={code} value={code}>
                    Lainnya: {code}
                  </option>
                ))}
              </select>

              <select
                aria-label="Ukuran"
                value={selectedSizeFilter}
                onChange={(e) => withReset(setSelectedSizeFilter)(e.target.value)}
                className="bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua ukuran</option>
                {allSizes.map((size) => (
                  <option key={size} value={size}>
                    Size {size}
                  </option>
                ))}
              </select>

              <select
                aria-label="Urutan"
                value={sortKey}
                onChange={(e) => withReset(setSortKey)(e.target.value as SkuSortKey)}
                className="bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none cursor-pointer"
              >
                {(Object.keys(SORT_LABELS) as SkuSortKey[])
                  .filter((key) => isOwner || key !== 'margin_tertinggi')
                  .map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABELS[key]}
                    </option>
                  ))}
              </select>

              {isOwner && (
                <button type="button" onClick={() => setIsAddSkuOpen(true)} className={`${PRIMARY_BUTTON} whitespace-nowrap`}>
                  <Plus className="w-4 h-4" />
                  <span>Buat SKU</span>
                </button>
              )}
            </div>
          </div>

          <div className={`${CARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Kode SKU</th>
                    <th className="py-3 px-3">Produk</th>
                    <th className="py-3 px-3">Warna & Ukuran</th>
                    <th className="py-3 px-3 text-right">Harga Jual</th>
                    {isOwner && <th className="py-3 px-3 text-right">HPP</th>}
                    {isOwner && <th className="py-3 px-3 text-right">Margin</th>}
                    <th className="py-3 px-3 text-right">Stok Gudang</th>
                    <th className="py-3 px-3 text-right">Min.</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    {isOwner && <th className="py-3 px-2 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSkus.length === 0 ? (
                    <tr>
                      <td colSpan={isOwner ? 10 : 7} className="py-8 text-center text-slate-500">
                        Tidak ada SKU yang cocok.
                      </td>
                    </tr>
                  ) : (
                    visibleSkus.map((sku) => {
                      const stock = stockOf(sku.sku);
                      const titipan = Math.max(0, stock.total - stock.gudang);
                      const margin = sku.price - sku.hpp;
                      const marginPct = sku.price > 0 ? ((margin / sku.price) * 100).toFixed(0) : '0';
                      const status = STATUS_BADGE[stockStatus(stock.gudang, sku.minStock)];
                      const matchedCol = (INITIAL_COLORS[sku.seriesCode] || []).find(
                        (c) => c.code === sku.colorCode || c.name.toLowerCase() === (sku.colorName || '').toLowerCase(),
                      );

                      return (
                        <tr key={sku.sku} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">{sku.sku}</td>
                          <td className="py-3 px-3 min-w-[160px]">
                            <div className="font-semibold text-slate-900 line-clamp-2" title={sku.name}>
                              {sku.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
                              {sku.seriesCode}
                              {titipan > 0 && ` · titipan ${titipan} pcs`}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {matchedCol && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                                  style={{ backgroundColor: matchedCol.hex }}
                                  aria-hidden="true"
                                />
                              )}
                              <span>{sku.colorName || '-'}</span>
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 rounded">{sku.size || '-'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            {rupiah(sku.price)}
                          </td>
                          {isOwner && <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">{rupiah(sku.hpp)}</td>}
                          {isOwner && (
                            <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                              <span className="font-semibold text-slate-900">{rupiah(margin)}</span>
                              <span className="text-[11px] text-slate-500 ml-1">({marginPct}%)</span>
                            </td>
                          )}
                          <td
                            className={`py-3 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                              stock.gudang < 0 ? 'text-rose-700' : 'text-slate-900'
                            }`}
                          >
                            {stock.gudang} pcs
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-500 tabular-nums whitespace-nowrap">{sku.minStock}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
                          </td>
                          {isOwner && (
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSku(sku)}
                                  title="Edit SKU"
                                  aria-label={`Edit ${sku.sku}`}
                                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSkuToDelete(sku)}
                                  title="Hapus SKU"
                                  aria-label={`Hapus ${sku.sku}`}
                                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filteredSkus.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Menampilkan {visibleSkus.length} dari {filteredSkus.length} SKU
                </span>
                {filteredSkus.length > visibleSkuCount && (
                  <button type="button" onClick={() => setVisibleSkuCount((count) => count + LIST_PAGE_SIZE)} className={OUTLINE_BUTTON}>
                    Tampilkan {Math.min(LIST_PAGE_SIZE, filteredSkus.length - visibleSkuCount)} lagi
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BOM AKSESORIS */}
      {activeTab === 'bom_aksesoris' && isOwner && (
        <div className={`${CARD} p-5 sm:p-6 max-w-2xl mx-auto space-y-5`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">BOM Aksesoris per Pcs</h3>
              <p className="text-xs text-slate-500 mt-1">Biaya pelengkap per kaos: label, hangtag, packaging, sablon, dll.</p>
            </div>
            <div className="sm:text-right shrink-0">
              <span className="text-xs text-slate-500">Total aksesoris</span>
              <div className="text-base font-mono font-bold text-slate-900">{rupiah(tempBomTotal)} / pcs</div>
            </div>
          </div>

          <form onSubmit={handleSaveBom} className="space-y-3">
            {tempBom.map((item, idx) => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex-1 min-w-0 space-y-1">
                  <input
                    type="text"
                    required
                    aria-label="Nama komponen"
                    value={item.komponen}
                    onChange={(e) => updateBomRow(idx, { komponen: e.target.value })}
                    className="w-full bg-transparent font-semibold text-xs text-slate-900 focus:outline-none"
                  />
                  <input
                    type="text"
                    aria-label="Keterangan"
                    value={item.keterangan}
                    onChange={(e) => updateBomRow(idx, { keterangan: e.target.value })}
                    placeholder="Spesifikasi / keterangan"
                    className="w-full bg-transparent text-xs text-slate-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-mono">Rp</span>
                  <input
                    type="number"
                    min="0"
                    required
                    aria-label={`Biaya ${item.komponen}`}
                    value={item.biayaPerUnit}
                    onChange={(e) => updateBomRow(idx, { biayaPerUnit: Number(e.target.value) || 0 })}
                    className="w-28 bg-white border border-slate-300 rounded-lg py-1.5 px-2 text-right text-xs text-slate-900 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setTempBom((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label={`Hapus komponen ${item.komponen}`}
                    title="Hapus komponen"
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-700 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setTempBom((prev) => [...prev, { id: `bom-${Date.now()}`, komponen: 'Komponen baru', keterangan: '', biayaPerUnit: 0 }])}
              className={`${OUTLINE_BUTTON} w-full`}
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah komponen
            </button>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {bomChanged && (
                <button type="button" onClick={() => setTempBom(bomItems)} className={OUTLINE_BUTTON}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Batalkan perubahan
                </button>
              )}
              <button type="submit" disabled={!bomChanged} className={`${PRIMARY_BUTTON} flex-1 disabled:opacity-40 disabled:cursor-default`}>
                Simpan & hitung ulang HPP semua SKU
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT LINI */}
      {editingSeries && (
        <Modal title={`Edit Lini ${editingSeries.code}`} icon={<Edit2 className="w-4 h-4 text-slate-500" />} onClose={() => setEditingSeries(null)}>
          <form onSubmit={handleSaveEditSeries} className="space-y-3">
            <Field label="Nama lini">
              <input type="text" required value={editSeriesName} onChange={(e) => setEditSeriesName(e.target.value)} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Gramasi (GSM)">
                <input
                  type="number"
                  required
                  value={editSeriesGsm}
                  onChange={(e) => setEditSeriesGsm(Number(e.target.value) || 0)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
              <Field label="Potongan (fit)">
                <select value={editSeriesFit} onChange={(e) => setEditSeriesFit(e.target.value as ApparelFit)} className={INPUT}>
                  <option value="Oversize">Oversize</option>
                  <option value="Regular">Regular</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Kaos polos (Rp)">
                <input
                  type="number"
                  required
                  value={editSeriesBaseCost}
                  onChange={(e) => setEditSeriesBaseCost(Number(e.target.value) || 0)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
              <Field label="Harga jual (Rp)">
                <input
                  type="number"
                  required
                  value={editSeriesPrice}
                  onChange={(e) => setEditSeriesPrice(Number(e.target.value) || 0)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
            </div>
            <p className="text-[11px] text-slate-500">Mengubah kaos polos atau harga jual akan mengubah HPP dan harga semua SKU di lini ini.</p>
            <Field label="Deskripsi bahan">
              <textarea rows={3} value={editSeriesDesc} onChange={(e) => setEditSeriesDesc(e.target.value)} className={INPUT} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingSeries(null)} className={OUTLINE_BUTTON}>
                Batal
              </button>
              <button type="submit" className={PRIMARY_BUTTON}>
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: TAMBAH SKU */}
      {isAddSkuOpen && (
        <Modal title="Buat SKU Baru" icon={<Plus className="w-4 h-4 text-slate-500" />} onClose={() => setIsAddSkuOpen(false)}>
          <form onSubmit={handleSaveAddSku} className="space-y-3">
            <Field label="Lini *">
              <select
                value={newSeriesCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setNewSeriesCode(code);
                  const matchedSer = series.find((s) => s.code === code);
                  if (matchedSer) {
                    setNewPrice(matchedSer.defaultPrice);
                  }
                }}
                className={INPUT}
              >
                {series.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
                <option value="ACC">Aksesoris / Merchandise (ACC)</option>
                <option value="BAG">Tas / Goodie Bag (BAG)</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Kode warna">
                <input
                  type="text"
                  value={newColorCode}
                  onChange={(e) => setNewColorCode(e.target.value.toUpperCase())}
                  placeholder="HT, PT, WB"
                  className={`${INPUT} font-mono uppercase`}
                />
              </Field>
              <Field label="Nama warna *">
                <input
                  type="text"
                  required
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  placeholder="Washed Black"
                  className={INPUT}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ukuran *">
                <select value={newSize} onChange={(e) => setNewSize(e.target.value)} className={INPUT}>
                  {allSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stok minimum">
                <input
                  type="number"
                  min="0"
                  value={newMinStock}
                  onChange={(e) => setNewMinStock(Number(e.target.value) || 0)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Harga jual (Rp) *">
                <input
                  type="number"
                  min="0"
                  required
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
              <Field label="HPP khusus (0 = ikut lini)">
                <input
                  type="number"
                  min="0"
                  value={newHppCustom}
                  onChange={(e) => setNewHppCustom(Number(e.target.value) || 0)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
            </div>
            <Field label="Kode SKU (opsional)">
              <input
                type="text"
                value={newSkuCode}
                onChange={(e) => setNewSkuCode(e.target.value.toUpperCase())}
                placeholder={`KL-${newSeriesCode}-${newColorCode || 'STD'}-${newSize}`}
                className={`${INPUT} font-mono uppercase`}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsAddSkuOpen(false)} className={OUTLINE_BUTTON}>
                Batal
              </button>
              <button type="submit" className={PRIMARY_BUTTON}>
                Simpan SKU
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: EDIT SKU */}
      {editingSku && (
        <Modal
          title={<span className="font-mono">{editingSku.sku}</span>}
          icon={<Edit2 className="w-4 h-4 text-slate-500" />}
          onClose={() => setEditingSku(null)}
        >
          <form onSubmit={handleSaveEditSku} className="space-y-3">
            <Field label="Kode SKU">
              <input
                type="text"
                required
                value={editSkuCode}
                onChange={(e) => setEditSkuCode(e.target.value.toUpperCase())}
                className={`${INPUT} font-mono uppercase`}
              />
            </Field>
            <Field label="Nama produk">
              <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Warna">
                <input type="text" value={editColorName} onChange={(e) => setEditColorName(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Ukuran">
                <select value={editSize} onChange={(e) => setEditSize(e.target.value)} className={INPUT}>
                  {sizeOptions([...allSizes, editSize]).map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Harga jual">
                <input
                  type="number"
                  min="0"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
              <Field label="HPP">
                <input
                  type="number"
                  min="0"
                  value={editHpp}
                  onChange={(e) => setEditHpp(Number(e.target.value) || 0)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
              <Field label="Stok min.">
                <input
                  type="number"
                  min="0"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(Number(e.target.value) || 0)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingSku(null)} className={OUTLINE_BUTTON}>
                Batal
              </button>
              <button type="submit" className={PRIMARY_BUTTON}>
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: HAPUS SKU */}
      {skuToDelete && deleteStock && (
        <Modal title="Hapus SKU?" icon={<ShieldAlert className="w-4 h-4 text-rose-700" />} onClose={() => setSkuToDelete(null)} narrow>
          <div className="space-y-2 text-slate-700">
            <p>
              <span className="font-mono font-bold text-slate-900">{skuToDelete.sku}</span> ({skuToDelete.name}) akan hilang dari daftar SKU.
            </p>
            <p>
              Stok saat ini: gudang <b>{deleteStock.gudang} pcs</b>, titipan reseller <b>{Math.max(0, deleteStock.total - deleteStock.gudang)} pcs</b>.
            </p>
            <p className="text-slate-500">Riwayat order dan mutasi stok yang memakai kode ini tidak ikut terhapus.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setSkuToDelete(null)} className={OUTLINE_BUTTON}>
              Batal
            </button>
            <button
              type="button"
              onClick={() => handleDeleteSku(skuToDelete.sku)}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl cursor-pointer"
            >
              Hapus SKU
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
