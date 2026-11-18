/** Hitungan & urutan untuk halaman Master SKU. */

type PricedSku = { sku: string; price: number; hpp: number };

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL'];
const STANDARD_SIZES = ['S', 'M', 'L', 'XL', '2XL'];

/** Ukuran untuk filter & form: ukuran standar ditambah yang ada di data, urut seperti ukuran baju. */
export const sizeOptions = (sizes: string[]): string[] => {
  const rank = (size: string) => {
    const index = SIZE_ORDER.indexOf(size);
    return index === -1 ? SIZE_ORDER.length : index;
  };
  return [...new Set([...STANDARD_SIZES, ...sizes.filter(Boolean)])].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
};

/** Total stok gudang, titipan reseller, dan nilai HPP; stok minus tidak dihitung tetapi jumlah SKU-nya dicatat. */
export const skuStockTotals = (
  skus: PricedSku[],
  stockOf: (sku: string) => { gudang: number; total: number },
): { gudang: number; reseller: number; value: number; minusCount: number } => {
  let gudang = 0;
  let reseller = 0;
  let value = 0;
  let minusCount = 0;
  for (const item of skus) {
    const stock = stockOf(item.sku);
    gudang += Math.max(0, stock.gudang);
    reseller += Math.max(0, stock.total - stock.gudang);
    value += Math.max(0, stock.total) * (item.hpp || 0);
    if (stock.gudang < 0) {
      minusCount++;
    }
  }
  return { gudang, reseller, value: Math.round(value), minusCount };
};

/** Margin kotor gabungan (total margin ÷ total harga) dalam persen satu desimal, atau null bila tak ada harga. */
export const averageMarginPercent = (skus: PricedSku[]): number | null => {
  const price = skus.reduce((sum, item) => sum + item.price, 0);
  const margin = skus.reduce((sum, item) => sum + item.price - item.hpp, 0);
  return price > 0 ? Math.round((margin / price) * 1000) / 10 : null;
};

export type StockStatus = 'minus' | 'habis' | 'menipis' | 'aman';

export const stockStatus = (stock: number, minStock: number): StockStatus =>
  stock < 0 ? 'minus' : stock === 0 ? 'habis' : stock <= minStock ? 'menipis' : 'aman';

export type SkuSortKey = 'kode' | 'stok_terendah' | 'stok_tertinggi' | 'margin_tertinggi';

const marginRatio = (item: PricedSku): number => (item.price > 0 ? (item.price - item.hpp) / item.price : 0);

/** Salinan daftar SKU yang diurutkan. */
export const sortSkus = <T extends PricedSku>(skus: T[], key: SkuSortKey, stockOf: (sku: string) => number): T[] =>
  [...skus].sort((a, b) => {
    if (key === 'stok_terendah') {
      return stockOf(a.sku) - stockOf(b.sku);
    }
    if (key === 'stok_tertinggi') {
      return stockOf(b.sku) - stockOf(a.sku);
    }
    if (key === 'margin_tertinggi') {
      return marginRatio(b) - marginRatio(a);
    }
    return a.sku.localeCompare(b.sku);
  });

const OLD_IMAGE_FOLDER = '/src/assets/images/';

/** Foto lini lama disimpan dengan alamat folder sumber yang tidak ikut ter-deploy; arahkan ke /products/. */
export const productImageUrl = (path: string | undefined): string | undefined =>
  path?.startsWith(OLD_IMAGE_FOLDER) ? `/products/${path.slice(OLD_IMAGE_FOLDER.length)}` : path;
